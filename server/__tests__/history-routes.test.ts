/**
 * History Routes Tests — server/routes/history.ts
 *
 * Tests the history items CRUD endpoints.
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import { registerHistoryRoutes } from '../routes/history';

// ---------------------------------------------------------------------------
// Mock storage
// ---------------------------------------------------------------------------

const {
  mockGetHistoryItems,
  mockCreateHistoryItem,
  mockDeleteHistoryItems,
  mockDeleteHistoryItem,
  mockGetProject,
} = vi.hoisted(() => ({
  mockGetHistoryItems: vi.fn(),
  mockCreateHistoryItem: vi.fn(),
  mockDeleteHistoryItems: vi.fn(),
  mockDeleteHistoryItem: vi.fn(),
  mockGetProject: vi.fn(),
}));

vi.mock('../storage', () => ({
  storage: {
    getProject: mockGetProject,
    getHistoryItems: mockGetHistoryItems,
    createHistoryItem: mockCreateHistoryItem,
    deleteHistoryItems: mockDeleteHistoryItems,
    deleteHistoryItem: mockDeleteHistoryItem,
  },
}));

vi.mock('../auth', () => ({
  validateSession: vi.fn().mockResolvedValue({ userId: 1, sessionId: 'test-session' }),
}));

vi.mock('../db', () => ({
  db: {},
  pool: {},
  checkConnection: vi.fn(),
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has('X-Session-Id')) {
    headers.set('X-Session-Id', 'test-session');
  }
  return fetch(url, { ...init, headers });
}

const NOW = new Date('2026-03-08T12:00:00Z');

function makeHistoryItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    projectId: 1,
    action: 'Added component',
    user: 'admin',
    timestamp: NOW,
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
  registerHistoryRoutes(app);

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
// GET /api/projects/:id/history
// ===========================================================================

describe('GET /api/projects/:id/history', () => {
  it('returns history items for a project', async () => {
    const items = [makeHistoryItem(), makeHistoryItem({ id: 2, action: 'Modified BOM' })];
    mockGetHistoryItems.mockResolvedValue(items);

    const res = await authFetch(`${baseUrl}/api/projects/1/history`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number };
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(2);
  });

  it('returns 401 without session header', async () => {
    const res = await fetch(`${baseUrl}/api/projects/1/history`);
    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// POST /api/projects/:id/history
// ===========================================================================

describe('POST /api/projects/:id/history', () => {
  it('creates a new history item', async () => {
    const item = makeHistoryItem({ id: 10 });
    mockCreateHistoryItem.mockResolvedValue(item);

    const res = await authFetch(`${baseUrl}/api/projects/1/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'Added node', user: 'test-user' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { id: number };
    expect(body.id).toBe(10);
  });

  it('returns 400 for invalid body (missing required fields)', async () => {
    const res = await authFetch(`${baseUrl}/api/projects/1/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('returns 401 without session header', async () => {
    const res = await fetch(`${baseUrl}/api/projects/1/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'test', user: 'u' }),
    });
    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// DELETE /api/projects/:id/history
// ===========================================================================

describe('DELETE /api/projects/:id/history', () => {
  it('deletes all history items for a project', async () => {
    mockDeleteHistoryItems.mockResolvedValue(undefined);

    const res = await authFetch(`${baseUrl}/api/projects/1/history`, { method: 'DELETE' });
    expect(res.status).toBe(204);
  });
});

// ===========================================================================
// DELETE /api/projects/:id/history/:itemId
// ===========================================================================

describe('DELETE /api/projects/:id/history/:itemId', () => {
  it('deletes a specific history item', async () => {
    mockDeleteHistoryItem.mockResolvedValue(true);

    const res = await authFetch(`${baseUrl}/api/projects/1/history/5`, { method: 'DELETE' });
    expect(res.status).toBe(204);
  });

  it('returns 404 for non-existent item', async () => {
    mockDeleteHistoryItem.mockResolvedValue(false);

    const res = await authFetch(`${baseUrl}/api/projects/1/history/999`, { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});
