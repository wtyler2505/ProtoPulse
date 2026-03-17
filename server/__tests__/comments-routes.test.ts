/**
 * Comments Routes Tests — server/routes/comments.ts
 *
 * Tests the design comments CRUD + resolve/unresolve endpoints.
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import { registerCommentRoutes } from '../routes/comments';

// ---------------------------------------------------------------------------
// Mock storage
// ---------------------------------------------------------------------------

const {
  mockGetComments,
  mockGetComment,
  mockCreateComment,
  mockUpdateComment,
  mockUpdateCommentStatus,
  mockDeleteComment,
  mockGetProject,
} = vi.hoisted(() => ({
  mockGetComments: vi.fn(),
  mockGetComment: vi.fn(),
  mockCreateComment: vi.fn(),
  mockUpdateComment: vi.fn(),
  mockUpdateCommentStatus: vi.fn(),
  mockDeleteComment: vi.fn(),
  mockGetProject: vi.fn(),
}));

vi.mock('../storage', () => ({
  storage: {
    getProject: mockGetProject,
    getComments: mockGetComments,
    getComment: mockGetComment,
    createComment: mockCreateComment,
    updateComment: mockUpdateComment,
    updateCommentStatus: mockUpdateCommentStatus,
    deleteComment: mockDeleteComment,
  },
}));

vi.mock('../auth', () => ({
  validateSession: vi.fn().mockResolvedValue({ userId: 1, sessionId: 'test-session' }),
}));

vi.mock('../db', () => ({ db: {}, pool: {}, checkConnection: vi.fn() }));

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

function makeComment(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    projectId: 1,
    content: 'Check the power supply design',
    targetType: 'general',
    targetId: null,
    parentId: null,
    userId: null,
    status: 'open',
    statusUpdatedAt: null,
    statusUpdatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
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
  registerCommentRoutes(app);

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
// GET /api/projects/:id/comments
// ===========================================================================

describe('GET /api/projects/:id/comments', () => {
  it('returns comments for a project', async () => {
    mockGetComments.mockResolvedValue([makeComment(), makeComment({ id: 2 })]);

    const res = await authFetch(`${baseUrl}/api/projects/1/comments`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number };
    expect(body.data).toHaveLength(2);
  });

  it('returns 401 without session', async () => {
    const res = await fetch(`${baseUrl}/api/projects/1/comments`);
    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// POST /api/projects/:id/comments
// ===========================================================================

describe('POST /api/projects/:id/comments', () => {
  it('creates a comment', async () => {
    mockCreateComment.mockResolvedValue(makeComment({ id: 10 }));

    const res = await authFetch(`${baseUrl}/api/projects/1/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'New comment' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { id: number };
    expect(body.id).toBe(10);
  });

  it('creates a spatial comment', async () => {
    mockCreateComment.mockResolvedValue(makeComment({ id: 11, targetType: 'spatial', spatialX: 100, spatialY: 200, spatialView: 'pcb' }));

    const res = await authFetch(`${baseUrl}/api/projects/1/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'Spatial fix',
        targetType: 'spatial',
        spatialX: 100,
        spatialY: 200,
        spatialView: 'pcb'
      }),
    });
    expect(res.status).toBe(201);
    expect(mockCreateComment).toHaveBeenCalledWith(expect.objectContaining({
      targetType: 'spatial',
      spatialX: 100,
      spatialY: 200,
      spatialView: 'pcb'
    }));
  });

  it('returns 400 for empty content', async () => {
    const res = await authFetch(`${baseUrl}/api/projects/1/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent parent comment', async () => {
    mockGetComment.mockResolvedValue(null);

    const res = await authFetch(`${baseUrl}/api/projects/1/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Reply', parentId: 999 }),
    });
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// PATCH /api/projects/:id/comments/:commentId
// ===========================================================================

describe('PATCH /api/projects/:id/comments/:commentId', () => {
  it('updates a comment', async () => {
    mockUpdateComment.mockResolvedValue(makeComment({ content: 'Updated' }));

    const res = await authFetch(`${baseUrl}/api/projects/1/comments/1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Updated' }),
    });
    expect(res.status).toBe(200);
  });

  it('returns 404 for non-existent comment', async () => {
    mockUpdateComment.mockResolvedValue(null);

    const res = await authFetch(`${baseUrl}/api/projects/1/comments/999`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'X' }),
    });
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// PATCH /api/projects/:id/comments/:commentId/status
// ===========================================================================

describe('PATCH /api/projects/:id/comments/:commentId/status', () => {
  it('updates comment status', async () => {
    mockUpdateCommentStatus.mockResolvedValue(makeComment({ status: 'resolved' }));

    const res = await authFetch(`${baseUrl}/api/projects/1/comments/1/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved' }),
    });
    expect(res.status).toBe(200);
  });

  it('returns 400 for missing status', async () => {
    const res = await authFetch(`${baseUrl}/api/projects/1/comments/1/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent comment', async () => {
    mockUpdateCommentStatus.mockResolvedValue(null);

    const res = await authFetch(`${baseUrl}/api/projects/1/comments/999/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved' }),
    });
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// DELETE /api/projects/:id/comments/:commentId
// ===========================================================================

describe('DELETE /api/projects/:id/comments/:commentId', () => {
  it('deletes a comment', async () => {
    mockDeleteComment.mockResolvedValue(true);

    const res = await authFetch(`${baseUrl}/api/projects/1/comments/1`, { method: 'DELETE' });
    expect(res.status).toBe(204);
  });

  it('returns 404 for non-existent comment', async () => {
    mockDeleteComment.mockResolvedValue(false);

    const res = await authFetch(`${baseUrl}/api/projects/1/comments/999`, { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});
