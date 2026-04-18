import { describe, it, expect } from 'vitest';
import {
  validateMessageInput,
  buildChatRequestBody,
  reduceStreamEvent,
  initialStreamAccumulator,
  dedupeSources,
  pickFinalConfidence,
  computeTokenInfo,
  decideRoute,
  mapAbortToMessage,
  NAVIGATIONAL_ACTIONS,
  type ChatRequestSnapshot,
  type StreamEvent,
} from '../handleSendHelpers';
import type { AIAction } from '../../chat-types';
import type { ToolCallInfo, ToolSource } from '@/lib/project-context';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
const baseSnapshot: ChatRequestSnapshot = {
  aiProvider: 'gemini',
  aiModel: 'gemini-3-pro-preview',
  aiApiKey: 'test-key',
  aiTemperature: 0.7,
  projectId: 42,
  customSystemPrompt: '',
  activeView: 'architecture',
  activeSheetId: null,
  selectedNodeId: null,
  routingStrategy: 'user',
  changeDiff: null,
};

const passthroughErrorMapper = (e: { message?: string; code?: string }) => ({
  title: 'Stream error',
  description: e.message ?? 'unknown',
});

// ---------------------------------------------------------------------------
// validateMessageInput
// ---------------------------------------------------------------------------
describe('validateMessageInput', () => {
  it('rejects empty / whitespace messages', () => {
    expect(validateMessageInput('', { isGenerating: false })).toEqual({
      valid: false,
      reason: 'empty',
    });
    expect(validateMessageInput('   \n\t', { isGenerating: false })).toEqual({
      valid: false,
      reason: 'empty',
    });
  });

  it('rejects when generator is busy', () => {
    expect(validateMessageInput('hi', { isGenerating: true })).toEqual({
      valid: false,
      reason: 'busy',
    });
  });

  it('accepts a real message while idle', () => {
    expect(validateMessageInput('hi', { isGenerating: false })).toEqual({
      valid: true,
    });
  });
});

// ---------------------------------------------------------------------------
// buildChatRequestBody
// ---------------------------------------------------------------------------
describe('buildChatRequestBody', () => {
  it('omits apiKey when a session is present (BL-0003)', () => {
    const body = JSON.parse(
      buildChatRequestBody(baseSnapshot, 'hello', null, true),
    );
    expect(body.apiKey).toBe('');
    expect(body.message).toBe('hello');
    expect(body.provider).toBe('gemini');
    expect(body.imageBase64).toBeUndefined();
  });

  it('includes apiKey when no session is present', () => {
    const body = JSON.parse(
      buildChatRequestBody(baseSnapshot, 'hello', null, false),
    );
    expect(body.apiKey).toBe('test-key');
  });

  it('attaches image fields when an image is present', () => {
    const body = JSON.parse(
      buildChatRequestBody(
        baseSnapshot,
        'describe',
        {
          base64: 'AAAA',
          mimeType: 'image/png',
          name: 'x.png',
          previewUrl: 'blob:123',
        },
        true,
      ),
    );
    expect(body.imageBase64).toBe('AAAA');
    expect(body.imageMimeType).toBe('image/png');
  });
});

// ---------------------------------------------------------------------------
// reduceStreamEvent — pure SSE reducer
// ---------------------------------------------------------------------------
describe('reduceStreamEvent', () => {
  it('accumulates text chunks and emits streaming display', () => {
    let accum = initialStreamAccumulator();
    const r1 = reduceStreamEvent(
      { type: 'text', text: 'Hello ' } as StreamEvent,
      accum,
      'prompt',
      passthroughErrorMapper,
    );
    expect(r1.streamingDisplay).toBe('Hello ');
    accum = r1.accum;

    const r2 = reduceStreamEvent(
      { type: 'chunk', text: 'world' } as StreamEvent,
      accum,
      'prompt',
      passthroughErrorMapper,
    );
    expect(r2.accum.fullText).toBe('Hello world');
    expect(r2.streamingDisplay).toBe('Hello world');
  });

  it('shows tool_call/tool_result hints without mutating fullText', () => {
    let accum = initialStreamAccumulator();
    accum = reduceStreamEvent(
      { type: 'text', text: 'working' } as StreamEvent,
      accum,
      'p',
      passthroughErrorMapper,
    ).accum;

    const tc = reduceStreamEvent(
      { type: 'tool_call', name: 'search_bom' } as StreamEvent,
      accum,
      'p',
      passthroughErrorMapper,
    );
    expect(tc.accum.fullText).toBe('working');
    expect(tc.streamingDisplay).toContain('_Using tool: search_bom..._');

    const tr = reduceStreamEvent(
      {
        type: 'tool_result',
        name: 'search_bom',
        result: { success: true },
      } as StreamEvent,
      tc.accum,
      'p',
      passthroughErrorMapper,
    );
    expect(tr.accum.hasServerToolCalls).toBe(true);
    expect(tr.streamingDisplay).toContain('_Tool search_bom: done_');
  });

  it('captures reportedUsage on usage event and finalizes tokenInfo on done', () => {
    let accum = initialStreamAccumulator();
    accum = reduceStreamEvent(
      {
        type: 'usage',
        model: 'gemini-3-pro-preview',
        inputTokens: 100,
        outputTokens: 50,
      } as StreamEvent,
      accum,
      'prompt',
      passthroughErrorMapper,
    ).accum;
    expect(accum.reportedUsage).toEqual({
      model: 'gemini-3-pro-preview',
      inputTokens: 100,
      outputTokens: 50,
    });

    const done = reduceStreamEvent(
      {
        type: 'done',
        message: 'final reply',
        actions: [],
        toolCalls: [],
      } as StreamEvent,
      accum,
      'prompt',
      passthroughErrorMapper,
    );
    expect(done.accum.fullText).toBe('final reply');
    expect(done.accum.tokenInfo).not.toBeNull();
    expect(done.accum.tokenInfo?.estimated).toBe(false);
    expect(done.accum.tokenInfo?.input).toBe(100);
  });

  it('maps stream errors into fullText without throwing', () => {
    const r = reduceStreamEvent(
      { type: 'error', message: 'quota', code: 'RATE_LIMIT' } as StreamEvent,
      initialStreamAccumulator(),
      'prompt',
      passthroughErrorMapper,
    );
    expect(r.accum.fullText).toBe('Stream error: quota');
  });

  it('ignores unknown event types', () => {
    const prev = initialStreamAccumulator();
    const r = reduceStreamEvent(
      { type: 'something_new' } as StreamEvent,
      prev,
      'prompt',
      passthroughErrorMapper,
    );
    expect(r.streamingDisplay).toBeNull();
    expect(r.accum).toEqual(prev);
  });
});

// ---------------------------------------------------------------------------
// dedupeSources / pickFinalConfidence / computeTokenInfo
// ---------------------------------------------------------------------------
describe('dedupeSources', () => {
  it('dedupes by type + id (falling back to label)', () => {
    const s: ToolSource[] = [
      { type: 'bom_item', id: '1', label: 'A' },
      { type: 'bom_item', id: '1', label: 'A-dup' },
      { type: 'bom_item', id: '2', label: 'B' },
      { type: 'node', label: 'only-label' },
      { type: 'node', label: 'only-label' },
    ];
    const deduped = dedupeSources(s);
    expect(deduped).toHaveLength(3);
    expect(deduped[0].label).toBe('A');
  });
});

describe('pickFinalConfidence', () => {
  it('returns the last confidence in the tool-call list', () => {
    const tcs: ToolCallInfo[] = [
      {
        id: 'a',
        name: 't1',
        input: {},
        result: {
          success: true,
          message: '',
          confidence: { score: 0.5, explanation: 'x', factors: [] },
        },
      },
      {
        id: 'b',
        name: 't2',
        input: {},
        result: { success: true, message: '' },
      },
      {
        id: 'c',
        name: 't3',
        input: {},
        result: {
          success: true,
          message: '',
          confidence: { score: 0.9, explanation: 'y', factors: [] },
        },
      },
    ];
    expect(pickFinalConfidence(tcs)?.score).toBe(0.9);
  });

  it('returns undefined when no tool has a confidence', () => {
    expect(pickFinalConfidence([])).toBeUndefined();
  });
});

describe('computeTokenInfo', () => {
  it('uses reported usage verbatim (estimated=false)', () => {
    const info = computeTokenInfo(
      { model: 'gemini-3-pro-preview', inputTokens: 123, outputTokens: 456 },
      'prompt',
      'reply',
      undefined,
    );
    expect(info.input).toBe(123);
    expect(info.output).toBe(456);
    expect(info.estimated).toBe(false);
  });

  it('approximates tokens when no usage is reported', () => {
    const info = computeTokenInfo(
      undefined,
      'a'.repeat(40),
      'b'.repeat(80),
      'gemini-3-pro-preview',
    );
    expect(info.estimated).toBe(true);
    expect(info.input).toBeGreaterThan(0);
    expect(info.output).toBeGreaterThan(info.input);
  });
});

// ---------------------------------------------------------------------------
// decideRoute
// ---------------------------------------------------------------------------
describe('decideRoute', () => {
  const deciders = (overrides: Partial<Parameters<typeof decideRoute>[1]> = {}) => ({
    destructiveActions: ['clear_canvas', 'remove_node'],
    previewAiChanges: false,
    needsSafetyConfirmation: () => false,
    ...overrides,
  });

  it('returns execute for empty action list', () => {
    expect(decideRoute([], deciders())).toEqual({ kind: 'execute' });
  });

  it('returns confirm for destructive actions', () => {
    const acts: AIAction[] = [{ type: 'clear_canvas' }];
    expect(decideRoute(acts, deciders()).kind).toBe('confirm');
  });

  it('returns confirm when previewAiChanges is on and action is non-navigational', () => {
    const acts: AIAction[] = [{ type: 'add_node', label: 'MCU' }];
    expect(
      decideRoute(acts, deciders({ previewAiChanges: true })).kind,
    ).toBe('confirm');
  });

  it('does NOT return confirm for purely navigational actions under preview mode', () => {
    const acts: AIAction[] = [{ type: 'switch_view' }];
    const decision = decideRoute(acts, deciders({ previewAiChanges: true }));
    expect(decision.kind).toBe('execute');
  });

  it('returns safety when an action needs safety confirmation', () => {
    const acts: AIAction[] = [
      { type: 'add_node', label: 'A' },
      { type: 'dangerous_tool' },
      { type: 'add_node', label: 'C' },
    ];
    const decision = decideRoute(
      acts,
      deciders({
        needsSafetyConfirmation: (t) => t === 'dangerous_tool',
      }),
    );
    expect(decision.kind).toBe('safety');
    if (decision.kind === 'safety') {
      expect(decision.firstUnsafe.type).toBe('dangerous_tool');
      expect(decision.remaining).toHaveLength(2);
    }
  });

  it('exposes the navigational action set', () => {
    expect(NAVIGATIONAL_ACTIONS.has('switch_view')).toBe(true);
    expect(NAVIGATIONAL_ACTIONS.has('add_node')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// mapAbortToMessage
// ---------------------------------------------------------------------------
describe('mapAbortToMessage', () => {
  it('renders a timeout message for reason="timeout"', () => {
    const { content, isError } = mapAbortToMessage('timeout');
    expect(content).toContain('timed out');
    expect(isError).toBe(true);
  });

  it('renders a cancellation message for any other reason', () => {
    const { content, isError } = mapAbortToMessage(undefined);
    expect(content).toContain('cancelled');
    expect(isError).toBe(false);
  });
});
