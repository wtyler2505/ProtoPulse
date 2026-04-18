// ---------------------------------------------------------------------------
// handleSendHelpers — pure helpers extracted from ChatPanel.handleSend
// (AI audit HIGH #78). These are intentionally free of React/state setters so
// they can be unit-tested in isolation. handleSend stays as the orchestrator
// that owns side effects (setState, fetch, abort, refs).
// ---------------------------------------------------------------------------

import type {
  AIAction,
} from '../chat-types';
import type {
  ToolCallInfo,
  ToolSource,
  ConfidenceScore,
  ViewMode,
} from '@/lib/project-context';
import { estimateCost, approximateTokens } from '@shared/model-pricing';

// Set of action types that are navigation-only (do not mutate design state).
// Kept in sync with ChatPanel.tsx so pure decision helpers can see it too.
export const NAVIGATIONAL_ACTIONS = new Set<string>([
  'switch_view',
  'switch_schematic_sheet',
  'undo',
  'redo',
  'project_summary',
  'show_help',
  'start_tutorial',
]);

// ---------------------------------------------------------------------------
// validateMessageInput — gate the textual payload before async work.
// ---------------------------------------------------------------------------
export interface ValidationResult {
  valid: boolean;
  reason?: 'empty' | 'busy';
}

export function validateMessageInput(
  msgText: string,
  opts: { isGenerating: boolean },
): ValidationResult {
  if (!msgText.trim()) return { valid: false, reason: 'empty' };
  if (opts.isGenerating) return { valid: false, reason: 'busy' };
  return { valid: true };
}

// ---------------------------------------------------------------------------
// buildChatRequestBody — construct the JSON payload sent to /api/chat/ai/stream.
// Mirrors exactly the shape the previous inline code produced, including the
// BL-0003 rule that server-stored keys mean we do NOT ship the raw key.
// ---------------------------------------------------------------------------
export interface ChatRequestSnapshot {
  aiProvider: 'gemini';
  aiModel: string;
  aiApiKey: string;
  aiTemperature: number;
  projectId: number;
  customSystemPrompt: string;
  activeView: ViewMode;
  activeSheetId: string | null;
  selectedNodeId: string | null;
  routingStrategy: string;
  changeDiff: unknown;
}

export interface AttachedImage {
  base64: string;
  mimeType: string;
  name: string;
  previewUrl: string;
}

export function buildChatRequestBody(
  snapshot: ChatRequestSnapshot,
  msgText: string,
  currentImage: AttachedImage | null,
  hasSession: boolean,
): string {
  return JSON.stringify({
    message: msgText,
    provider: snapshot.aiProvider,
    model: snapshot.aiModel,
    apiKey: hasSession ? '' : snapshot.aiApiKey,
    projectId: snapshot.projectId,
    temperature: snapshot.aiTemperature,
    customSystemPrompt: snapshot.customSystemPrompt,
    activeView: snapshot.activeView,
    activeSheetId: snapshot.activeSheetId,
    selectedNodeId: snapshot.selectedNodeId,
    changeDiff: snapshot.changeDiff,
    routingStrategy: snapshot.routingStrategy,
    ...(currentImage
      ? {
          imageBase64: currentImage.base64,
          imageMimeType: currentImage.mimeType,
        }
      : {}),
  });
}

// ---------------------------------------------------------------------------
// reduceStreamEvent — pure state reducer over a single parsed SSE event.
// Accumulator holds everything handleSend needs after the stream closes.
// The reducer does NOT call setState; instead it returns, in addition to the
// new accumulator, an optional `streamingDisplay` string that handleSend can
// forward to setStreamingContent. This keeps UI feedback identical while
// leaving the reducer pure.
// ---------------------------------------------------------------------------
export interface StreamAccumulator {
  fullText: string;
  finalActions: AIAction[];
  finalToolCalls: ToolCallInfo[];
  finalSources: ToolSource[];
  finalConfidence: ConfidenceScore | undefined;
  hasServerToolCalls: boolean;
  reportedUsage:
    | { model: string; inputTokens: number; outputTokens: number }
    | undefined;
  resolvedModel: string | undefined;
  tokenInfo:
    | { input: number; output: number; cost: number; estimated: boolean }
    | null;
}

export function initialStreamAccumulator(): StreamAccumulator {
  return {
    fullText: '',
    finalActions: [],
    finalToolCalls: [],
    finalSources: [],
    finalConfidence: undefined,
    hasServerToolCalls: false,
    reportedUsage: undefined,
    resolvedModel: undefined,
    tokenInfo: null,
  };
}

export interface StreamEvent {
  type: string;
  text?: string;
  name?: string;
  result?: { success?: boolean } & Record<string, unknown>;
  message?: string;
  actions?: AIAction[];
  toolCalls?: ToolCallInfo[];
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  code?: string;
}

export interface ReduceResult {
  accum: StreamAccumulator;
  // Non-null means handleSend should call setStreamingContent(<value>).
  streamingDisplay: string | null;
}

/**
 * Pure reducer over SSE events. Does NOT touch DOM/React.
 * handleSend is responsible for:
 *   - calling setStreamingContent(streamingDisplay) when non-null
 *   - calling setTokenInfo(accum.tokenInfo) after a 'done' event
 *
 * The `errorMapper` is injected so the reducer can remain free of app imports
 * and be easy to test. In production, pass `mapStreamErrorToUserMessage`.
 */
export function reduceStreamEvent(
  event: StreamEvent,
  prev: StreamAccumulator,
  msgText: string,
  errorMapper: (e: { message?: string; code?: string }) => {
    title: string;
    description: string;
  },
): ReduceResult {
  const accum: StreamAccumulator = { ...prev };

  switch (event.type) {
    case 'text':
    case 'chunk': {
      accum.fullText = prev.fullText + (event.text ?? '');
      return { accum, streamingDisplay: accum.fullText };
    }
    case 'tool_call': {
      return {
        accum,
        streamingDisplay: `${prev.fullText}\n\n_Using tool: ${event.name ?? ''}..._`,
      };
    }
    case 'tool_result': {
      const status = event.result?.success ? 'done' : 'failed';
      accum.hasServerToolCalls = true;
      return {
        accum,
        streamingDisplay: `${prev.fullText}\n\n_Tool ${event.name ?? ''}: ${status}_`,
      };
    }
    case 'usage': {
      if (
        typeof event.model === 'string' &&
        typeof event.inputTokens === 'number' &&
        typeof event.outputTokens === 'number'
      ) {
        accum.reportedUsage = {
          model: event.model,
          inputTokens: event.inputTokens,
          outputTokens: event.outputTokens,
        };
        accum.resolvedModel = event.model;
      }
      return { accum, streamingDisplay: null };
    }
    case 'done': {
      accum.fullText = event.message ?? prev.fullText;
      accum.finalActions = event.actions ?? [];
      accum.finalToolCalls = event.toolCalls ?? [];
      if (accum.finalToolCalls.length > 0) {
        accum.hasServerToolCalls = true;
      }
      accum.finalSources = dedupeSources(
        accum.finalToolCalls.flatMap((tc) => tc.result.sources ?? []),
      );
      accum.finalConfidence =
        pickFinalConfidence(accum.finalToolCalls) ?? prev.finalConfidence;
      accum.tokenInfo = computeTokenInfo(
        accum.reportedUsage,
        msgText,
        accum.fullText,
        accum.resolvedModel,
      );
      return { accum, streamingDisplay: null };
    }
    case 'error': {
      const mapped = errorMapper({ message: event.message, code: event.code });
      accum.fullText = `${mapped.title}: ${mapped.description}`;
      return { accum, streamingDisplay: null };
    }
    default:
      return { accum, streamingDisplay: null };
  }
}

// ---------------------------------------------------------------------------
// dedupeSources — stable-order dedupe by `${type}-${id ?? label}`.
// ---------------------------------------------------------------------------
export function dedupeSources(sources: ToolSource[]): ToolSource[] {
  const seen = new Set<string>();
  return sources.filter((s) => {
    const key = `${s.type}-${s.id ?? s.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// pickFinalConfidence — the last confidence score reported by a tool (if any).
// ---------------------------------------------------------------------------
export function pickFinalConfidence(
  toolCalls: ToolCallInfo[],
): ConfidenceScore | undefined {
  for (let i = toolCalls.length - 1; i >= 0; i--) {
    const c = toolCalls[i].result.confidence;
    if (c) return c;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// computeTokenInfo — prefer provider-reported usage, fallback to approximation.
// Mirrors the exact behavior of the inline code it replaces (AI-audit H-2).
// ---------------------------------------------------------------------------
export function computeTokenInfo(
  reportedUsage:
    | { model: string; inputTokens: number; outputTokens: number }
    | undefined,
  msgText: string,
  fullText: string,
  resolvedModel: string | undefined,
): { input: number; output: number; cost: number; estimated: boolean } {
  if (reportedUsage) {
    const cost = estimateCost(
      reportedUsage.model,
      reportedUsage.inputTokens,
      reportedUsage.outputTokens,
    );
    return {
      input: reportedUsage.inputTokens,
      output: reportedUsage.outputTokens,
      cost,
      estimated: false,
    };
  }
  const inputTokens = approximateTokens(msgText);
  const outputTokens = approximateTokens(fullText);
  const cost = estimateCost(resolvedModel ?? '', inputTokens, outputTokens);
  return { input: inputTokens, output: outputTokens, cost, estimated: true };
}

// ---------------------------------------------------------------------------
// decideRoute — given finalActions + feature flags, decide whether we need:
//   'confirm' — preview dialog (destructive or previewAiChanges + non-nav)
//   'safety'  — safety-mode confirmation for a single flagged action
//   'execute' — just run them (or skip if empty)
// ---------------------------------------------------------------------------
export type RouteDecision =
  | { kind: 'confirm' }
  | {
      kind: 'safety';
      firstUnsafe: AIAction;
      remaining: AIAction[];
    }
  | { kind: 'execute' };

export interface RouteDeciders {
  destructiveActions: readonly string[];
  previewAiChanges: boolean;
  needsSafetyConfirmation: (actionType: string) => boolean;
}

export function decideRoute(
  finalActions: AIAction[],
  deciders: RouteDeciders,
): RouteDecision {
  const hasDestructive = finalActions.some((a) =>
    deciders.destructiveActions.includes(a.type),
  );
  const hasNonNavigational = finalActions.some(
    (a) => !NAVIGATIONAL_ACTIONS.has(a.type),
  );
  const needsConfirmation =
    (hasDestructive || (deciders.previewAiChanges && hasNonNavigational)) &&
    finalActions.length > 0;
  if (needsConfirmation) return { kind: 'confirm' };

  if (finalActions.length > 0) {
    const firstUnsafe = finalActions.find((a) =>
      deciders.needsSafetyConfirmation(a.type),
    );
    if (firstUnsafe) {
      return {
        kind: 'safety',
        firstUnsafe,
        remaining: finalActions.filter((a) => a !== firstUnsafe),
      };
    }
  }
  return { kind: 'execute' };
}

// ---------------------------------------------------------------------------
// mapAbortToMessage — produce the assistant message body for an abort, either
// a real user-cancel or a timeout signal.
// ---------------------------------------------------------------------------
export function mapAbortToMessage(abortReason: unknown): {
  content: string;
  isError: boolean;
} {
  const isTimeout = abortReason === 'timeout';
  return {
    content: isTimeout
      ? 'AI response timed out after 150 seconds. Please try again.'
      : 'Request was cancelled.',
    isError: isTimeout,
  };
}
