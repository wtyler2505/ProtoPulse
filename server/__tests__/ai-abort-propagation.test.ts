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
import type { ToolContext } from '../ai-tools/index';

// Minimal valid AppState shape (the internal type is not exported from ai.ts).
// Use `unknown` double-cast at call sites to bridge the parameter type.
type AppStateLike = {
  projectName: string;
  projectDescription: string;
  activeView: string;
  nodes: unknown[];
  edges: unknown[];
  bom: unknown[];
  validationIssues: unknown[];
  schematicSheets: unknown[];
  activeSheetId: string;
  chatHistory: unknown[];
  componentParts: unknown[];
  circuitDesigns: unknown[];
  historyItems: unknown[];
  bomMetadata: { totalCost: number; itemCount: number; outOfStockCount: number; lowStockCount: number };
  designPreferences: unknown[];
};

const makeAppState = (): AppStateLike => ({
  projectName: 'Test',
  projectDescription: '',
  activeView: 'architecture',
  nodes: [],
  edges: [],
  bom: [],
  validationIssues: [],
  schematicSheets: [],
  activeSheetId: '',
  chatHistory: [],
  componentParts: [],
  circuitDesigns: [],
  historyItems: [],
  bomMetadata: { totalCost: 0, itemCount: 0, outOfStockCount: 0, lowStockCount: 0 },
  designPreferences: [],
});

// Narrow helper: convince processAIMessage/streamAIMessage signatures without `any`.
type ProcessParams = Parameters<typeof processAIMessage>[0];
type StreamParams = Parameters<typeof streamAIMessage>[0];
const appStateAsProcess = (s: AppStateLike) => s as unknown as ProcessParams['appState'];
const appStateAsStream = (s: AppStateLike) => s as unknown as StreamParams['appState'];

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
      appState: appStateAsProcess(makeAppState()),
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
        appState: appStateAsStream(makeAppState()),
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
