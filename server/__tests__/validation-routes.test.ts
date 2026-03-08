/**
 * Validation Routes Tests — server/routes/validation.ts
 *
 * Tests validation issues CRUD endpoints.
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import { registerValidationRoutes } from '../routes/validation';

// ---------------------------------------------------------------------------
// Mock storage
// ---------------------------------------------------------------------------

const {
  mockGetValidationIssues,
  mockCreateValidationIssue,
  mockDeleteValidationIssue,
  mockReplaceValidationIssues,
  mockGetProject,
} = vi.hoisted(() => ({
  mockGetValidationIssues: vi.fn(),
  mockCreateValidationIssue: vi.fn(),
  mockDeleteValidationIssue: vi.fn(),
  mockReplaceValidationIssues: vi.fn(),
  mockGetProject: vi.fn(),
}));

vi.mock('../storage', () => ({
  storage: {
    getProject: mockGetProject,
    getValidationIssues: mockGetValidationIssues,
    createValidationIssue: mockCreateValidationIssue,
    deleteValidationIssue: mockDeleteValidationIssue,
    replaceValidationIssues: mockReplaceValidationIssues,
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

function makeIssue(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    projectId: 1,
    severity: 'warning',
    message: 'Missing decoupling capacitor',
    componentId: 'node-1',
    suggestion: 'Add 100nF cap near VCC',
    ruleType: null,
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
  app.use(express.json({ limit: '1mb' }));
  registerValidationRoutes(app);

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
// GET /api/projects/:id/validation
// ===========================================================================

describe('GET /api/projects/:id/validation', () => {
  it('returns validation issues for a project', async () => {
    mockGetValidationIssues.mockResolvedValue([makeIssue(), makeIssue({ id: 2, severity: 'error' })]);

    const res = await authFetch(`${baseUrl}/api/projects/1/validation`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number };
    expect(body.data).toHaveLength(2);
  });

  it('returns 401 without session', async () => {
    const res = await fetch(`${baseUrl}/api/projects/1/validation`);
    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// POST /api/projects/:id/validation
// ===========================================================================

describe('POST /api/projects/:id/validation', () => {
  it('creates a validation issue', async () => {
    mockCreateValidationIssue.mockResolvedValue(makeIssue({ id: 10 }));

    const res = await authFetch(`${baseUrl}/api/projects/1/validation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        severity: 'error',
        message: 'Missing ground connection',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { id: number };
    expect(body.id).toBe(10);
  });

  it('returns 400 for invalid body', async () => {
    const res = await authFetch(`${baseUrl}/api/projects/1/validation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ severity: 'invalid_level', message: 'test' }),
    });
    expect(res.status).toBe(400);
  });
});

// ===========================================================================
// DELETE /api/projects/:id/validation/:issueId
// ===========================================================================

describe('DELETE /api/projects/:id/validation/:issueId', () => {
  it('deletes a validation issue', async () => {
    mockDeleteValidationIssue.mockResolvedValue(true);

    const res = await authFetch(`${baseUrl}/api/projects/1/validation/1`, { method: 'DELETE' });
    expect(res.status).toBe(204);
  });

  it('returns 404 for non-existent issue', async () => {
    mockDeleteValidationIssue.mockResolvedValue(false);

    const res = await authFetch(`${baseUrl}/api/projects/1/validation/999`, { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// PUT /api/projects/:id/validation
// ===========================================================================

describe('PUT /api/projects/:id/validation', () => {
  it('replaces all validation issues', async () => {
    const issues = [makeIssue(), makeIssue({ id: 2 })];
    mockReplaceValidationIssues.mockResolvedValue(issues);

    const res = await authFetch(`${baseUrl}/api/projects/1/validation`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { severity: 'warning', message: 'Issue 1' },
        { severity: 'error', message: 'Issue 2' },
      ]),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(body).toHaveLength(2);
  });

  it('returns 400 for invalid array body', async () => {
    const res = await authFetch(`${baseUrl}/api/projects/1/validation`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bad: true }),
    });
    expect(res.status).toBe(400);
  });
});
