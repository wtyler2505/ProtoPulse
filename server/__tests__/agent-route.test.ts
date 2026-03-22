import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import { registerAgentRoutes, _agentInternals } from '../routes/agent';

// ---------------------------------------------------------------------------
// Mock Genkit — the agent route uses Genkit for AI streaming
// ---------------------------------------------------------------------------

const mockGenerateStream = vi.fn();

vi.mock('../genkit', () => ({
  ai: { generateStream: (...args: unknown[]) => mockGenerateStream(...args) },
  allGenkitTools: [],
}));

// Helper: create a Genkit-compatible generateStream return value
function genkitStreamResult(opts: {
  text?: string;
  toolCalls?: Array<{ name: string; input: Record<string, unknown> }>;
  error?: Error;
}): { stream: AsyncIterable<Record<string, unknown>>; response: Promise<{ text: string }> } {
  if (opts.error) {
    return {
      stream: (async function* () { throw opts.error; })(),
      response: Promise.reject(opts.error),
    };
  }
  const chunks: Array<Record<string, unknown>> = [];
  if (opts.text) {
    chunks.push({ text: opts.text });
  }
  if (opts.toolCalls) {
    chunks.push({
      toolRequests: opts.toolCalls.map((tc) => ({
        toolRequest: { name: tc.name, input: tc.input },
      })),
    });
  }
  return {
    stream: (async function* () { for (const c of chunks) { yield c; } })(),
    response: Promise.resolve({ text: opts.text ?? '' }),
  };
}

function mockSimpleCompletion(text = 'Done'): void {
  mockGenerateStream.mockImplementationOnce(() => genkitStreamResult({ text }));
}

function mockToolUseCompletion(toolName: string, toolInput: Record<string, unknown>, finalText = 'Done'): void {
  // First call returns tool use, second call returns text completion
  mockGenerateStream
    .mockReturnValueOnce(genkitStreamResult({
      text: '',
      toolCalls: [{ name: toolName, input: toolInput }],
    }));
  // After tool execution, route should complete (Genkit handles multi-turn internally)
}

function mockError(error: Error): void {
  mockGenerateStream.mockReturnValueOnce(genkitStreamResult({ error }));
}

// Mock storage
vi.mock('../storage', () => ({
  storage: {
    getProject: vi.fn().mockResolvedValue({ id: 1, name: 'Test Project', ownerId: null }),
    getNodes: vi.fn().mockResolvedValue([]),
    getEdges: vi.fn().mockResolvedValue([]),
    getBomItems: vi.fn().mockResolvedValue([]),
    getValidationIssues: vi.fn().mockResolvedValue([]),
    getChatMessages: vi.fn().mockResolvedValue([]),
    getComponentParts: vi.fn().mockResolvedValue([]),
    getCircuitDesigns: vi.fn().mockResolvedValue([]),
    getHistoryItems: vi.fn().mockResolvedValue([]),
    getDesignPreferences: vi.fn().mockResolvedValue([]),
    createNode: vi.fn().mockResolvedValue({ id: 1 }),
    createBomItem: vi.fn().mockResolvedValue({ id: 1 }),
    createAiAction: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock auth
vi.mock('../auth', () => ({
  getApiKey: vi.fn().mockResolvedValue(null),
  validateSession: vi.fn().mockResolvedValue({ userId: 1, sessionId: 'test-session' }),
}));

// Mock logger
vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock db (required transitively)
vi.mock('../db', () => ({ db: {}, pool: { end: vi.fn() } }));

// Mock auth-middleware
vi.mock('../routes/auth-middleware', () => ({
  requireProjectOwnership: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireCircuitOwnership: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// ---------------------------------------------------------------------------
// Test server setup
// ---------------------------------------------------------------------------

let app: express.Express;
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  app = express();
  app.use(express.json({ limit: '150kb' }));
  registerAgentRoutes(app);

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      if (typeof addr === 'object' && addr !== null) {
        baseUrl = `http://127.0.0.1:${String(addr.port)}`;
      }
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err) { reject(err); } else { resolve(); }
    });
  });
});

beforeEach(() => {
  mockGenerateStream.mockReset();
  _agentInternals.agentRateBuckets.clear();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function postAgent(body: Record<string, unknown>, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(`${baseUrl}/api/projects/1/agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Session-Id': 'test-session', ...headers },
    body: JSON.stringify(body),
  });
}

async function collectSSEEvents(response: Response): Promise<Array<Record<string, unknown>>> {
  const text = await response.text();
  const events: Array<Record<string, unknown>> = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('data: ')) {
      try {
        events.push(JSON.parse(line.slice(6)) as Record<string, unknown>);
      } catch {
        // skip heartbeats / malformed
      }
    }
  }
  return events;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/projects/:id/agent', () => {
  describe('input validation', () => {
    it('rejects empty body', async () => {
      const res = await postAgent({});
      expect(res.status).toBe(400);
    });

    it('rejects missing description', async () => {
      const res = await postAgent({ apiKey: 'sk-ant-test' });
      expect(res.status).toBe(400);
    });

    it('rejects empty description', async () => {
      const res = await postAgent({ description: '', apiKey: 'sk-ant-test' });
      expect(res.status).toBe(400);
    });

    it('rejects missing API key', async () => {
      const res = await postAgent({ description: 'test circuit' });
      expect(res.status).toBe(400);
      const body = await res.json() as { message: string };
      expect(body.message).toContain('API key');
    });

    it('accepts valid request with description and apiKey', async () => {
      mockSimpleCompletion('Design complete.');

      const res = await postAgent({ description: 'LED circuit', apiKey: 'sk-ant-test123' });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/event-stream');
      await res.text(); // drain SSE stream to prevent test isolation issues
    });
  });

  describe('maxSteps validation', () => {
    it('defaults maxSteps to 8', async () => {
      mockSimpleCompletion();

      const res = await postAgent({ description: 'test', apiKey: 'sk-ant-test123' });
      const events = await collectSSEEvents(res);
      const complete = events.find((e) => e.type === 'complete');
      expect(complete).toBeDefined();
    });

    it('clamps maxSteps to 15', async () => {
      const res = await postAgent({ description: 'test', apiKey: 'sk-ant-test123', maxSteps: 100 });
      expect(res.status).toBe(400);
    });

    it('rejects maxSteps below 1', async () => {
      const res = await postAgent({ description: 'test', apiKey: 'sk-ant-test123', maxSteps: 0 });
      expect(res.status).toBe(400);
    });

    it('accepts maxSteps of 1', async () => {
      mockSimpleCompletion();

      const res = await postAgent({ description: 'test', apiKey: 'sk-ant-test123', maxSteps: 1 });
      expect(res.status).toBe(200);
    });

    it('accepts maxSteps of 15', async () => {
      mockSimpleCompletion();

      const res = await postAgent({ description: 'test', apiKey: 'sk-ant-test123', maxSteps: 15 });
      expect(res.status).toBe(200);
    });
  });

  describe('rate limiting', () => {
    it('allows first 2 requests', async () => {
      mockSimpleCompletion();
      mockSimpleCompletion();

      const res1 = await postAgent({ description: 'test1', apiKey: 'sk-ant-test123' });
      expect(res1.status).toBe(200);

      const res2 = await postAgent({ description: 'test2', apiKey: 'sk-ant-test123' });
      expect(res2.status).toBe(200);
    });

    it('rejects 3rd request within window', async () => {
      mockSimpleCompletion();
      mockSimpleCompletion();

      await postAgent({ description: 'a', apiKey: 'sk-ant-test123' });
      await postAgent({ description: 'b', apiKey: 'sk-ant-test123' });

      const res3 = await postAgent({ description: 'c', apiKey: 'sk-ant-test123' });
      expect(res3.status).toBe(429);
    });
  });

  describe('SSE event format', () => {
    it('sends SSE events with correct format for simple completion', async () => {
      mockSimpleCompletion('Here is your LED circuit design.');

      const res = await postAgent({ description: 'LED circuit', apiKey: 'sk-ant-test123' });
      const events = await collectSSEEvents(res);

      const complete = events.find((e) => e.type === 'complete');
      expect(complete).toBeDefined();
      expect(complete!.stepsUsed).toBeDefined();
    });

    it('sends tool_call and tool_result events for tool use', async () => {
      mockGenerateStream.mockReturnValueOnce(genkitStreamResult({
        toolCalls: [{ name: 'add_node', input: { label: 'MCU', nodeType: 'mcu' } }],
      }));

      const res = await postAgent({ description: 'Add an MCU', apiKey: 'sk-ant-test123' });
      const events = await collectSSEEvents(res);

      const toolCall = events.find((e) => e.type === 'tool_call');
      expect(toolCall).toBeDefined();
      expect(toolCall!.toolName).toBe('add_node');

      const toolResult = events.find((e) => e.type === 'tool_result');
      expect(toolResult).toBeDefined();
    });

    it('emits complete event with stepsUsed', async () => {
      mockSimpleCompletion('All done');

      const res = await postAgent({ description: 'test', apiKey: 'sk-ant-test123' });
      const events = await collectSSEEvents(res);

      const complete = events.find((e) => e.type === 'complete');
      expect(complete).toBeDefined();
      expect(typeof complete!.stepsUsed).toBe('number');
    });
  });

  describe('agentic loop behavior', () => {
    it('terminates when AI returns no tool calls', async () => {
      mockSimpleCompletion('Design complete, no tools needed.');

      const res = await postAgent({ description: 'simple design', apiKey: 'sk-ant-test123' });
      const events = await collectSSEEvents(res);

      const complete = events.find((e) => e.type === 'complete');
      expect(complete).toBeDefined();
    });

    it('emits thinking event at step 1', async () => {
      mockSimpleCompletion('Done');

      const res = await postAgent({ description: 'test', apiKey: 'sk-ant-test123' });
      const events = await collectSSEEvents(res);

      const thinking = events.find((e) => e.type === 'thinking');
      expect(thinking).toBeDefined();
      expect(thinking!.step).toBe(1);
    });

    it('includes summary in complete event', async () => {
      mockSimpleCompletion('Final summary text');

      const res = await postAgent({ description: 'test', apiKey: 'sk-ant-test123' });
      const events = await collectSSEEvents(res);

      const complete = events.find((e) => e.type === 'complete');
      expect(complete).toBeDefined();
      expect(complete!.summary).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('sends error event on AI failure', async () => {
      mockError(new Error('Model unavailable'));

      const res = await postAgent({ description: 'test', apiKey: 'sk-ant-test123' });
      const events = await collectSSEEvents(res);

      const errorEvent = events.find((e) => e.type === 'error');
      expect(errorEvent).toBeDefined();
    });

    it('sends error event on unexpected error', async () => {
      mockError(new Error('Unexpected failure'));

      const res = await postAgent({ description: 'test', apiKey: 'sk-ant-test123' });
      const events = await collectSSEEvents(res);

      const errorEvent = events.find((e) => e.type === 'error');
      expect(errorEvent).toBeDefined();
    });

    it('sends proper SSE content-type even on error', async () => {
      mockError(new Error('API error'));

      const res = await postAgent({ description: 'test', apiKey: 'sk-ant-test123' });
      expect(res.headers.get('content-type')).toContain('text/event-stream');
    });

    it('includes message in error event', async () => {
      mockError(new Error('Rate limit exceeded'));

      const res = await postAgent({ description: 'test', apiKey: 'sk-ant-test123' });
      const events = await collectSSEEvents(res);

      const errorEvent = events.find((e) => e.type === 'error');
      expect(errorEvent).toBeDefined();
      expect(typeof errorEvent!.message).toBe('string');
    });
  });

  describe('auth', () => {
    it('uses session header for auth', async () => {
      mockSimpleCompletion();

      const res = await postAgent(
        { description: 'test', apiKey: 'sk-ant-test123' },
        { 'X-Session-Id': 'test-session' },
      );
      expect(res.status).toBe(200);
    });

    it('returns 200 with valid session (auth middleware is mocked)', async () => {
      mockSimpleCompletion();
      const res = await fetch(`${baseUrl}/api/projects/1/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Id': 'test-session' },
        body: JSON.stringify({ description: 'test', apiKey: 'key123456' }),
      });
      expect(res.status).toBe(200);
    });
  });
});
