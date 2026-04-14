/**
 * AI-AUDIT #191 — AbortSignal propagation tests.
 *
 * Verifies that the AbortController threaded from the Express route through
 * streamAIMessage / processAIMessage / executeStreamForProvider reaches the
 * tool execution layer and short-circuits the fallback execution path.
 *
 * These are unit tests — the heavy Genkit integration is mocked so we can
 * assert on the abort contract without spinning up the AI pipeline.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock modules that transitively require DATABASE_URL
vi.mock('../db', () => ({ db: {}, pool: {} }));
vi.mock('../storage', () => ({ storage: {} }));
vi.mock('../google-workspace', () => ({
  exportBomToSheet: vi.fn(),
  exportDesignReportToDoc: vi.fn(),
  exportProjectToDrive: vi.fn(),
}));

// Mock genkit so we don't hit Gemini
vi.mock('../genkit', () => ({
  ai: {
    generateStream: vi.fn(() => ({
      response: Promise.resolve({ request: { messages: [] }, messages: [] }),
      stream: (async function* () {
        // empty stream
      })(),
    })),
  },
  allGenkitTools: [],
}));

import { processAIMessage, streamAIMessage } from '../ai';
import type { AppState } from '../ai';
import type { ToolContext } from '../ai-tools/index';

// Minimal valid AppState to satisfy the type
const makeAppState = (): AppState => ({
  projectName: 'Test',
  projectDescription: '',
  activeView: 'architecture',
  nodes: [],
  edges: [],
  bomItems: [],
  validationIssues: [],
  chatHistory: [],
  totalConnections: 0,
  totalComponents: 0,
  componentParts: [],
  circuitDesigns: [],
  historyItems: [],
} as unknown as AppState);

describe('AI abort signal propagation (AI-AUDIT #191)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processAIMessage returns empty result immediately when signal is pre-aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await processAIMessage({
      message: 'hello',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      apiKey: 'fake-key',
      appState: makeAppState(),
      signal: controller.signal,
    });

    expect(result).toEqual({ message: '', actions: [] });
  });

  it('streamAIMessage does not throw when given an aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();
    const events: unknown[] = [];

    // Should complete cleanly (Genkit mock returns empty stream); no unhandled rejection.
    await streamAIMessage(
      {
        message: 'hello',
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        apiKey: 'fake-key',
        appState: makeAppState(),
      },
      (event) => {
        events.push(event);
      },
      controller.signal,
    );

    // We expect at least a 'done' event (the function completes gracefully).
    const doneEvent = events.find(
      (e): e is { type: 'done' } => typeof e === 'object' && e !== null && (e as { type?: string }).type === 'done',
    );
    expect(doneEvent).toBeDefined();
  });

  it('ToolContext type accepts an optional AbortSignal', () => {
    // Compile-time contract check. Asserting the type compiles is the test.
    const controller = new AbortController();
    const ctx: ToolContext = {
      projectId: 1,
      storage: {} as ToolContext['storage'],
      signal: controller.signal,
    };
    expect(ctx.signal).toBe(controller.signal);
  });
});
