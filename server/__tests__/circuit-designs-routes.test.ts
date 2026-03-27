/**
 * Circuit Designs Routes Tests — server/circuit-routes/designs.ts
 *
 * Tests circuit designs CRUD with optimistic concurrency (ETag/If-Match).
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import { registerCircuitDesignRoutes } from '../circuit-routes/designs';
import type { IStorage } from '../storage';

// ---------------------------------------------------------------------------
// Mock storage
// ---------------------------------------------------------------------------

const NOW = new Date('2026-03-08T12:00:00Z');

function makeDesign(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    projectId: 1,
    name: 'Main Schematic',
    description: null,
    settings: {},
    parentDesignId: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const {
  mockGetProject,
  mockGetCircuitDesigns,
  mockGetCircuitDesign,
  mockCreateCircuitDesign,
  mockUpdateCircuitDesign,
  mockDeleteCircuitDesign,
} = vi.hoisted(() => ({
  mockGetProject: vi.fn(),
  mockGetCircuitDesigns: vi.fn(),
  mockGetCircuitDesign: vi.fn(),
  mockCreateCircuitDesign: vi.fn(),
  mockUpdateCircuitDesign: vi.fn(),
  mockDeleteCircuitDesign: vi.fn(),
}));

const mockStorage: Record<string, ReturnType<typeof vi.fn>> = {
  getProject: mockGetProject,
  getCircuitDesigns: mockGetCircuitDesigns,
  getCircuitDesign: mockGetCircuitDesign,
  createCircuitDesign: mockCreateCircuitDesign,
  updateCircuitDesign: mockUpdateCircuitDesign,
  deleteCircuitDesign: mockDeleteCircuitDesign,
};

vi.mock('../auth', () => ({
  validateSession: vi.fn().mockResolvedValue({ userId: 1, sessionId: 'test-session' }),
}));

vi.mock('../storage', () => {
  class VersionConflictError extends Error {
    currentVersion: number;
    constructor(entity: string, id: number, currentVersion: number) {
      super('Version conflict');
      this.name = 'VersionConflictError';
      this.currentVersion = currentVersion;
    }
  }
  return {
    storage: {
      getProject: mockGetProject,
      getCircuitDesigns: mockGetCircuitDesigns,
      getCircuitDesign: mockGetCircuitDesign,
      createCircuitDesign: mockCreateCircuitDesign,
      updateCircuitDesign: mockUpdateCircuitDesign,
      deleteCircuitDesign: mockDeleteCircuitDesign,
    },
    VersionConflictError,
  };
});

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

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: '150kb' }));
  registerCircuitDesignRoutes(app, mockStorage as unknown as IStorage);

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
// GET /api/projects/:projectId/circuits
// ===========================================================================

describe('GET /api/projects/:projectId/circuits', () => {
  it('returns circuit designs for a project', async () => {
    mockGetCircuitDesigns.mockResolvedValue([makeDesign(), makeDesign({ id: 2, name: 'Sub' })]);

    const res = await authFetch(`${baseUrl}/api/projects/1/circuits`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number };
    expect(body.data).toHaveLength(2);
  });

  it('returns 401 without session', async () => {
    const res = await fetch(`${baseUrl}/api/projects/1/circuits`);
    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// GET /api/projects/:projectId/circuits/:id
// ===========================================================================

describe('GET /api/projects/:projectId/circuits/:id', () => {
  it('returns a circuit design with ETag', async () => {
    mockGetCircuitDesign.mockResolvedValue(makeDesign());

    const res = await authFetch(`${baseUrl}/api/projects/1/circuits/1`);
    expect(res.status).toBe(200);
    expect(res.headers.get('etag')).toBe('"1"');
  });

  it('returns 404 for non-existent design', async () => {
    mockGetCircuitDesign.mockResolvedValue(null);

    const res = await authFetch(`${baseUrl}/api/projects/1/circuits/999`);
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// POST /api/projects/:projectId/circuits
// ===========================================================================

describe('POST /api/projects/:projectId/circuits', () => {
  it('creates a circuit design', async () => {
    mockCreateCircuitDesign.mockResolvedValue(makeDesign({ id: 10 }));

    const res = await authFetch(`${baseUrl}/api/projects/1/circuits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Circuit' }),
    });
    expect(res.status).toBe(201);
    expect(res.headers.get('etag')).toBe('"1"');
  });

  it('uses default name when body is empty', async () => {
    // name defaults to "Main Circuit" in schema, so empty body is valid
    mockCreateCircuitDesign.mockResolvedValue(makeDesign({ name: 'Main Circuit' }));

    const res = await authFetch(`${baseUrl}/api/projects/1/circuits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(201);
  });
});

// ===========================================================================
// PATCH /api/projects/:projectId/circuits/:id
// ===========================================================================

describe('PATCH /api/projects/:projectId/circuits/:id', () => {
  it('updates a circuit design', async () => {
    mockGetCircuitDesign.mockResolvedValue(makeDesign());
    mockUpdateCircuitDesign.mockResolvedValue(makeDesign({ name: 'Renamed', version: 2 }));

    const res = await authFetch(`${baseUrl}/api/projects/1/circuits/1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Renamed' }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('etag')).toBe('"2"');
  });

  it('returns 404 for non-existent design', async () => {
    mockUpdateCircuitDesign.mockResolvedValue(null);

    const res = await authFetch(`${baseUrl}/api/projects/1/circuits/999`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 409 on version conflict', async () => {
    mockGetCircuitDesign.mockResolvedValue(makeDesign());
    const { VersionConflictError } = await import('../storage');
    mockUpdateCircuitDesign.mockRejectedValue(new VersionConflictError('circuit_design', 1, 5));

    const res = await authFetch(`${baseUrl}/api/projects/1/circuits/1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'If-Match': '"2"' },
      body: JSON.stringify({ name: 'Conflict' }),
    });
    expect(res.status).toBe(409);
    const body = await res.json() as { error: string; currentVersion: number };
    expect(body.error).toBe('Conflict');
    expect(body.currentVersion).toBe(5);
  });
});

// ===========================================================================
// DELETE /api/projects/:projectId/circuits/:id
// ===========================================================================

describe('DELETE /api/projects/:projectId/circuits/:id', () => {
  it('deletes a circuit design', async () => {
    mockGetCircuitDesign.mockResolvedValue(makeDesign());
    mockDeleteCircuitDesign.mockResolvedValue(true);

    const res = await authFetch(`${baseUrl}/api/projects/1/circuits/1`, { method: 'DELETE' });
    expect(res.status).toBe(204);
  });

  it('returns 404 for non-existent design', async () => {
    mockDeleteCircuitDesign.mockResolvedValue(false);

    const res = await authFetch(`${baseUrl}/api/projects/1/circuits/999`, { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});
