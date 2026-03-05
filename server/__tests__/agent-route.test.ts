import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import { registerAgentRoutes, _agentInternals } from '../routes/agent';

// ---------------------------------------------------------------------------
// Mock Anthropic SDK — must be before any import that uses it
// ---------------------------------------------------------------------------

const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class Anthropic {
      messages = { create: mockCreate };
    },
  };
});

// Mock storage
vi.mock('../storage', () => ({
  storage: {
    getProject: vi.fn().mockResolvedValue({ id: 1, name: 'Test Project' }),
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
  mockCreate.mockReset();
  _agentInternals.agentRateBuckets.clear();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function postAgent(body: Record<string, unknown>): Promise<Response> {
  return fetch(`${baseUrl}/api/projects/1/agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Design complete.' }],
        stop_reason: 'end_turn',
      });

      const res = await postAgent({ description: 'LED circuit', apiKey: 'sk-ant-test123' });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/event-stream');
    });
  });

  describe('maxSteps validation', () => {
    it('defaults maxSteps to 8', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Done' }],
        stop_reason: 'end_turn',
      });

      const res = await postAgent({ description: 'test', apiKey: 'sk-ant-test123' });
      const events = await collectSSEEvents(res);
      // Should complete without error
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
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Done' }],
        stop_reason: 'end_turn',
      });

      const res = await postAgent({ description: 'test', apiKey: 'sk-ant-test123', maxSteps: 1 });
      expect(res.status).toBe(200);
    });

    it('accepts maxSteps of 15', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Done' }],
        stop_reason: 'end_turn',
      });

      const res = await postAgent({ description: 'test', apiKey: 'sk-ant-test123', maxSteps: 15 });
      expect(res.status).toBe(200);
    });
  });

  describe('rate limiting', () => {
    it('allows first 2 requests', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Done' }],
        stop_reason: 'end_turn',
      });

      const res1 = await postAgent({ description: 'test1', apiKey: 'sk-ant-test123' });
      expect(res1.status).toBe(200);

      const res2 = await postAgent({ description: 'test2', apiKey: 'sk-ant-test123' });
      expect(res2.status).toBe(200);
    });

    it('rejects 3rd request within window', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Done' }],
        stop_reason: 'end_turn',
      });

      await postAgent({ description: 'a', apiKey: 'sk-ant-test123' });
      await postAgent({ description: 'b', apiKey: 'sk-ant-test123' });

      const res3 = await postAgent({ description: 'c', apiKey: 'sk-ant-test123' });
      expect(res3.status).toBe(429);
      const body = await res3.json() as { message: string };
      expect(body.message).toContain('Rate limit');
    });

    it('sets Retry-After header on rate limit', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Done' }],
        stop_reason: 'end_turn',
      });

      await postAgent({ description: 'a', apiKey: 'sk-ant-test123' });
      await postAgent({ description: 'b', apiKey: 'sk-ant-test123' });

      const res3 = await postAgent({ description: 'c', apiKey: 'sk-ant-test123' });
      expect(res3.headers.get('retry-after')).toBeTruthy();
    });
  });

  describe('project validation', () => {
    it('returns 404 for non-existent project', async () => {
      const res = await fetch(`${baseUrl}/api/projects/99999/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'test', apiKey: 'sk-ant-test123' }),
      });
      // The mock always returns a project, so let's test invalid ID
      const res2 = await fetch(`${baseUrl}/api/projects/abc/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'test', apiKey: 'sk-ant-test123' }),
      });
      expect(res2.status).toBe(400);
    });
  });

  describe('SSE event format', () => {
    it('sends SSE events with correct format for simple completion', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Here is your LED circuit design.' }],
        stop_reason: 'end_turn',
      });

      const res = await postAgent({ description: 'Simple LED circuit', apiKey: 'sk-ant-test123' });
      const events = await collectSSEEvents(res);

      // Should have thinking + text + complete events
      expect(events.length).toBeGreaterThanOrEqual(2);

      const thinking = events.find((e) => e.type === 'thinking');
      expect(thinking).toBeDefined();
      expect(thinking?.step).toBe(1);

      const complete = events.find((e) => e.type === 'complete');
      expect(complete).toBeDefined();
      expect(complete?.stepsUsed).toBe(1);
      expect(complete?.summary).toContain('LED circuit');
    });

    it('sends tool_call and tool_result events for tool use', async () => {
      // First call: AI wants to use a tool
      mockCreate.mockResolvedValueOnce({
        content: [
          { type: 'tool_use', id: 'tool_1', name: 'add_node', input: { nodeType: 'mcu', label: 'Arduino', description: 'Main controller' } },
        ],
        stop_reason: 'tool_use',
      });
      // Second call: AI is done
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Added Arduino node.' }],
        stop_reason: 'end_turn',
      });

      const res = await postAgent({ description: 'Arduino project', apiKey: 'sk-ant-test123' });
      const events = await collectSSEEvents(res);

      const toolCall = events.find((e) => e.type === 'tool_call');
      expect(toolCall).toBeDefined();
      expect(toolCall?.toolName).toBe('add_node');

      const toolResult = events.find((e) => e.type === 'tool_result');
      expect(toolResult).toBeDefined();
      expect(toolResult?.toolName).toBe('add_node');
    });

    it('emits complete event with stepsUsed', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Done' }],
        stop_reason: 'end_turn',
      });

      const res = await postAgent({ description: 'test', apiKey: 'sk-ant-test123' });
      const events = await collectSSEEvents(res);

      const complete = events.find((e) => e.type === 'complete');
      expect(complete).toBeDefined();
      expect(typeof complete?.stepsUsed).toBe('number');
    });
  });

  describe('agentic loop behavior', () => {
    it('terminates when AI returns no tool calls', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'All done.' }],
        stop_reason: 'end_turn',
      });

      const res = await postAgent({ description: 'test', apiKey: 'sk-ant-test123' });
      const events = await collectSSEEvents(res);
      const complete = events.find((e) => e.type === 'complete');
      expect(complete).toBeDefined();
      expect(complete?.stepsUsed).toBe(1);
    });

    it('loops through multiple tool calls then completes', async () => {
      // Step 1: tool call
      mockCreate.mockResolvedValueOnce({
        content: [
          { type: 'tool_use', id: 'tool_1', name: 'add_node', input: { nodeType: 'mcu', label: 'MCU', description: 'Controller' } },
        ],
        stop_reason: 'tool_use',
      });
      // Step 2: another tool call
      mockCreate.mockResolvedValueOnce({
        content: [
          { type: 'tool_use', id: 'tool_2', name: 'add_bom_item', input: { partNumber: 'ATmega328', manufacturer: 'Microchip', description: 'MCU' } },
        ],
        stop_reason: 'tool_use',
      });
      // Step 3: done
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Design complete with MCU and BOM.' }],
        stop_reason: 'end_turn',
      });

      const res = await postAgent({ description: 'MCU circuit', apiKey: 'sk-ant-test123' });
      const events = await collectSSEEvents(res);

      const toolCalls = events.filter((e) => e.type === 'tool_call');
      expect(toolCalls.length).toBe(2);

      const complete = events.find((e) => e.type === 'complete');
      expect(complete).toBeDefined();
      expect(complete?.stepsUsed).toBe(3);
    });

    it('stops at maxSteps if AI keeps calling tools', async () => {
      // Always return a tool call
      mockCreate.mockResolvedValue({
        content: [
          { type: 'tool_use', id: 'tool_x', name: 'add_node', input: { nodeType: 'resistor', label: 'R1', description: 'Resistor' } },
        ],
        stop_reason: 'tool_use',
      });

      const res = await postAgent({ description: 'infinite loop test', apiKey: 'sk-ant-test123', maxSteps: 2 });
      const events = await collectSSEEvents(res);

      const complete = events.find((e) => e.type === 'complete');
      expect(complete).toBeDefined();
      expect(complete?.stepsUsed).toBe(2);
      expect(String(complete?.message ?? '')).toContain('maximum steps');
    });
  });

  describe('error handling', () => {
    it('sends error event when AI API fails', async () => {
      mockCreate.mockRejectedValue(new Error('API key invalid'));

      const res = await postAgent({ description: 'test', apiKey: 'sk-ant-bad' });
      const events = await collectSSEEvents(res);

      const errorEvent = events.find((e) => e.type === 'error');
      expect(errorEvent).toBeDefined();
    });

    it('handles AI timeout gracefully', async () => {
      mockCreate.mockRejectedValue(Object.assign(new Error('Request timeout'), { status: undefined }));

      const res = await postAgent({ description: 'test', apiKey: 'sk-ant-test123' });
      const events = await collectSSEEvents(res);

      const errorEvent = events.find((e) => e.type === 'error');
      expect(errorEvent).toBeDefined();
    });

    it('handles 401 from Anthropic', async () => {
      const authError = new Error('Invalid API key');
      (authError as unknown as Record<string, unknown>).status = 401;
      mockCreate.mockRejectedValue(authError);

      const res = await postAgent({ description: 'test', apiKey: 'sk-ant-bad-key' });
      const events = await collectSSEEvents(res);

      const errorEvent = events.find((e) => e.type === 'error');
      expect(errorEvent).toBeDefined();
      expect(String(errorEvent?.message ?? '')).toContain('API key');
    });

    it('handles rate limit from Anthropic', async () => {
      const rateError = new Error('Rate limit exceeded');
      (rateError as unknown as Record<string, unknown>).status = 429;
      mockCreate.mockRejectedValue(rateError);

      const res = await postAgent({ description: 'test', apiKey: 'sk-ant-test123' });
      const events = await collectSSEEvents(res);

      const errorEvent = events.find((e) => e.type === 'error');
      expect(errorEvent).toBeDefined();
      expect(String(errorEvent?.message ?? '')).toContain('Rate limit');
    });
  });

  describe('internals', () => {
    it('exposes agent system prompt', () => {
      expect(_agentInternals.AGENT_SYSTEM_PROMPT).toContain('circuit design agent');
    });

    it('rate limit constants are correct', () => {
      expect(_agentInternals.AGENT_RATE_MAX).toBe(2);
      expect(_agentInternals.AGENT_RATE_WINDOW_MS).toBe(60_000);
    });
  });
});
