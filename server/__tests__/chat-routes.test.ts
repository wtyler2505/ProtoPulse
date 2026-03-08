/**
 * Chat Routes Tests — server/routes/chat.ts
 *
 * Tests the chat messages CRUD and AI actions endpoints.
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import { registerChatRoutes } from '../routes/chat';

// ---------------------------------------------------------------------------
// Mock storage
// ---------------------------------------------------------------------------

const {
  mockGetChatMessages,
  mockCreateChatMessage,
  mockDeleteChatMessages,
  mockDeleteChatMessage,
  mockGetAiActions,
  mockGetAiActionsByMessage,
  mockGetProject,
} = vi.hoisted(() => ({
  mockGetChatMessages: vi.fn(),
  mockCreateChatMessage: vi.fn(),
  mockDeleteChatMessages: vi.fn(),
  mockDeleteChatMessage: vi.fn(),
  mockGetAiActions: vi.fn(),
  mockGetAiActionsByMessage: vi.fn(),
  mockGetProject: vi.fn(),
}));

vi.mock('../storage', () => ({
  storage: {
    getProject: mockGetProject,
    getChatMessages: mockGetChatMessages,
    createChatMessage: mockCreateChatMessage,
    deleteChatMessages: mockDeleteChatMessages,
    deleteChatMessage: mockDeleteChatMessage,
    getAiActions: mockGetAiActions,
    getAiActionsByMessage: mockGetAiActionsByMessage,
  },
}));

vi.mock('../auth', () => ({
  validateSession: vi.fn().mockResolvedValue({ userId: 1, sessionId: 'test-session' }),
  getApiKey: vi.fn().mockResolvedValue(null),
}));

vi.mock('../db', () => ({
  db: {},
  pool: {},
  checkConnection: vi.fn(),
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../ai', () => ({
  processAIMessage: vi.fn(),
  streamAIMessage: vi.fn(),
  categorizeError: vi.fn().mockReturnValue({ userMessage: 'Error' }),
  routeToModel: vi.fn().mockReturnValue({ model: 'test-model' }),
}));

vi.mock('express-rate-limit', () => ({
  default: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => { next(); },
}));

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has('X-Session-Id')) {
    headers.set('X-Session-Id', 'test-session');
  }
  return fetch(url, { ...init, headers });
}

const NOW = new Date('2026-03-08T12:00:00Z');

function makeMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    projectId: 1,
    role: 'user',
    content: 'Hello',
    mode: null,
    branchId: null,
    metadata: null,
    createdAt: NOW,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: '150kb' }));
  registerChatRoutes(app);

  app.use((err: { status?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err.status ?? 500;
    res.status(status).json({ message: err.message ?? 'Internal error' });
  });

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
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetProject.mockResolvedValue({ id: 1, name: 'Test', ownerId: null });
});

// ===========================================================================
// GET /api/projects/:id/chat
// ===========================================================================

describe('GET /api/projects/:id/chat', () => {
  it('returns chat messages for a project', async () => {
    const msgs = [makeMessage(), makeMessage({ id: 2, content: 'World' })];
    mockGetChatMessages.mockResolvedValue(msgs);

    const res = await authFetch(`${baseUrl}/api/projects/1/chat`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number };
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(2);
  });

  it('returns 401 without session header', async () => {
    const res = await fetch(`${baseUrl}/api/projects/1/chat`);
    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// POST /api/projects/:id/chat
// ===========================================================================

describe('POST /api/projects/:id/chat', () => {
  it('creates a new chat message', async () => {
    const newMsg = makeMessage({ id: 10 });
    mockCreateChatMessage.mockResolvedValue(newMsg);

    const res = await authFetch(`${baseUrl}/api/projects/1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'user', content: 'Test message' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { id: number };
    expect(body.id).toBe(10);
  });

  it('returns 400 for invalid body', async () => {
    const res = await authFetch(`${baseUrl}/api/projects/1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('returns 401 without session header', async () => {
    const res = await fetch(`${baseUrl}/api/projects/1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'user', content: 'Test' }),
    });
    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// DELETE /api/projects/:id/chat
// ===========================================================================

describe('DELETE /api/projects/:id/chat', () => {
  it('deletes all chat messages for a project', async () => {
    mockDeleteChatMessages.mockResolvedValue(undefined);

    const res = await authFetch(`${baseUrl}/api/projects/1/chat`, { method: 'DELETE' });
    expect(res.status).toBe(204);
  });
});

// ===========================================================================
// DELETE /api/projects/:id/chat/:msgId
// ===========================================================================

describe('DELETE /api/projects/:id/chat/:msgId', () => {
  it('deletes a specific chat message', async () => {
    mockDeleteChatMessage.mockResolvedValue(true);

    const res = await authFetch(`${baseUrl}/api/projects/1/chat/5`, { method: 'DELETE' });
    expect(res.status).toBe(204);
  });

  it('returns 404 for non-existent message', async () => {
    mockDeleteChatMessage.mockResolvedValue(false);

    const res = await authFetch(`${baseUrl}/api/projects/1/chat/999`, { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// GET /api/projects/:id/ai-actions
// ===========================================================================

describe('GET /api/projects/:id/ai-actions', () => {
  it('returns AI actions for a project', async () => {
    const actions = [{ id: 1, toolName: 'add_node', status: 'completed' }];
    mockGetAiActions.mockResolvedValue(actions);

    const res = await authFetch(`${baseUrl}/api/projects/1/ai-actions`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number };
    expect(body.data).toHaveLength(1);
  });

  it('returns 404 if project not found', async () => {
    mockGetProject.mockResolvedValue(null);

    const res = await authFetch(`${baseUrl}/api/projects/999/ai-actions`);
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// GET /api/ai-actions/by-message/:messageId
// ===========================================================================

describe('GET /api/ai-actions/by-message/:messageId', () => {
  it('returns actions for a message', async () => {
    const actions = [{ id: 1, toolName: 'add_node' }];
    mockGetAiActionsByMessage.mockResolvedValue(actions);

    const res = await authFetch(`${baseUrl}/api/ai-actions/by-message/msg-123`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[] };
    expect(body.data).toHaveLength(1);
  });
});
