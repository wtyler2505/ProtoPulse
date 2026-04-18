/**
 * CORE-02 — tool double-execution guard tests.
 *
 * Verifies that when Genkit's generateStream auto-executes a tool during the
 * stream, the last-resort fallback-execution path in executeStreamForProvider
 * does NOT re-execute it — even when the primary result-extraction path fails
 * to surface the tool response into `allToolCalls`.
 *
 * Strategy: mock `genkit` so it:
 *   1. streams exactly one tool request with a known ref ("X"), which
 *      populates `streamingToolRequests`.
 *   2. resolves `response` with a tool-role message in `request.messages`
 *      whose `part.toolResponse.ref === "X"`. This is how Genkit signals it
 *      already auto-ran the tool.
 *
 * Mock `../ai-tools` so `toolRegistry.get()` returns a non-destructive tool
 * whose `execute` is a Vitest spy. Assertion: the spy is NEVER called — the
 * new `genkitExecutedIds` seen-set must prevent re-execution.
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

// ---------------------------------------------------------------------------
// Spy on a fake non-destructive tool's execute function. This lets the test
// prove that the fallback path did NOT invoke it when Genkit already did.
// ---------------------------------------------------------------------------
const executeSpy = vi.fn(async () => ({ success: true, data: { type: 'switch_view', view: 'dashboard' } }));

vi.mock('../ai-tools', () => ({
  DESTRUCTIVE_TOOLS: [] as string[],
  toolRegistry: {
    get: (name: string) => {
      if (name === 'fake_non_destructive_tool') {
        return {
          name: 'fake_non_destructive_tool',
          execute: executeSpy,
        };
      }
      return undefined;
    },
  },
}));

// ---------------------------------------------------------------------------
// Genkit mock: streams one tool request with ref "X", then resolves with a
// tool-response whose ref is also "X" — simulating Genkit's auto-execution.
// ---------------------------------------------------------------------------
const generateStreamMock = vi.fn(() => ({
  response: Promise.resolve({
    request: {
      messages: [
        {
          role: 'tool',
          content: [
            {
              toolResponse: {
                ref: 'X',
                name: 'fake_non_destructive_tool',
                // Shape mismatch on purpose: missing ToolResult shape so that
                // (in a pre-fix world) allToolCalls.push would still run but
                // the extracted data could be malformed. The seen-set must
                // still fire regardless.
                output: null,
              },
            },
          ],
        },
      ],
    },
    messages: [],
  }),
  stream: (async function* () {
    yield {
      text: '',
      toolRequests: [
        {
          toolRequest: {
            ref: 'X',
            name: 'fake_non_destructive_tool',
            input: {},
          },
        },
      ],
    };
  })(),
}));

vi.mock('../genkit', () => ({
  ai: { generateStream: generateStreamMock },
  allGenkitTools: [],
}));

import { streamAIMessage } from '../ai';

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

type StreamParams = Parameters<typeof streamAIMessage>[0];
const appStateAsStream = (s: AppStateLike) => s as unknown as StreamParams['appState'];

describe('CORE-02: tool double-execution guard', () => {
  beforeEach(() => {
    executeSpy.mockClear();
    generateStreamMock.mockClear();
  });

  it('does NOT re-execute a tool via the fallback path when Genkit already ran it (ref surfaces in request.messages)', async () => {
    const events: unknown[] = [];

    await streamAIMessage(
      {
        message: 'hello',
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        apiKey: 'fake-key',
        appState: appStateAsStream(makeAppState()),
        toolContext: { projectId: 1, storage: {} as never },
      },
      (event) => {
        events.push(event);
      },
    );

    // The seen-set guard must prevent the last-resort path from calling
    // toolDef.execute(). Genkit already executed the tool during the stream;
    // re-executing would cause double side-effects (e.g., duplicate DB writes).
    expect(executeSpy).not.toHaveBeenCalled();

    // Sanity: the stream completed.
    const doneEvent = events.find(
      (e): e is { type: 'done' } => typeof e === 'object' && e !== null && (e as { type?: string }).type === 'done',
    );
    expect(doneEvent).toBeDefined();
  });
});
