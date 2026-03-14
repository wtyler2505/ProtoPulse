/**
 * Circuit Wires Routes Tests — server/circuit-routes/wires.ts
 *
 * Tests circuit wire CRUD endpoints.
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import { registerCircuitWireRoutes } from '../circuit-routes/wires';
import type { IStorage } from '../storage';

// ---------------------------------------------------------------------------
// Mock storage
// ---------------------------------------------------------------------------

const NOW = new Date('2026-03-08T12:00:00Z');

function makeWire(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    circuitId: 1,
    netId: 1,
    view: 'schematic',
    points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    layer: null,
    width: 1.0,
    color: null,
    wireType: 'wire',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const mockStorage: Record<string, ReturnType<typeof vi.fn>> = {
  getCircuitWires: vi.fn(),
  getCircuitWire: vi.fn(),
  createCircuitWire: vi.fn(),
  updateCircuitWire: vi.fn(),
  deleteCircuitWire: vi.fn(),
};

vi.mock('../auth', () => ({
  validateSession: vi.fn().mockResolvedValue({ userId: 1, sessionId: 'test-session' }),
}));

vi.mock('../routes/auth-middleware', () => ({
  requireProjectOwnership: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireCircuitOwnership: (_req: unknown, _res: unknown, next: () => void) => next(),
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

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: '150kb' }));
  registerCircuitWireRoutes(app, mockStorage as unknown as IStorage);

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
});

// ===========================================================================
// GET /api/circuits/:circuitId/wires
// ===========================================================================

describe('GET /api/circuits/:circuitId/wires', () => {
  it('returns wires for a circuit', async () => {
    mockStorage.getCircuitWires.mockResolvedValue([makeWire(), makeWire({ id: 2 })]);

    const res = await authFetch(`${baseUrl}/api/circuits/1/wires`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number };
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(2);
  });
});

// ===========================================================================
// POST /api/circuits/:circuitId/wires
// ===========================================================================

describe('POST /api/circuits/:circuitId/wires', () => {
  it('creates a wire', async () => {
    mockStorage.createCircuitWire.mockResolvedValue(makeWire({ id: 10 }));

    const res = await authFetch(`${baseUrl}/api/circuits/1/wires`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        netId: 1,
        view: 'schematic',
        points: [{ x: 0, y: 0 }, { x: 50, y: 50 }],
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { id: number };
    expect(body.id).toBe(10);
  });

  it('returns 400 for missing required fields', async () => {
    const res = await authFetch(`${baseUrl}/api/circuits/1/wires`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

// ===========================================================================
// PATCH /api/circuits/:circuitId/wires/:id
// ===========================================================================

describe('PATCH /api/circuits/:circuitId/wires/:id', () => {
  it('updates a wire', async () => {
    mockStorage.getCircuitWire.mockResolvedValue(makeWire());
    mockStorage.updateCircuitWire.mockResolvedValue(makeWire({ width: 2.0 }));

    const res = await authFetch(`${baseUrl}/api/circuits/1/wires/1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ width: 2.0 }),
    });
    expect(res.status).toBe(200);
  });

  it('returns 404 for non-existent wire', async () => {
    mockStorage.updateCircuitWire.mockResolvedValue(null);

    const res = await authFetch(`${baseUrl}/api/circuits/1/wires/999`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ width: 1.0 }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid width (not positive)', async () => {
    mockStorage.getCircuitWire.mockResolvedValue(makeWire());

    const res = await authFetch(`${baseUrl}/api/circuits/1/wires/1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ width: -1 }),
    });
    expect(res.status).toBe(400);
  });
});

// ===========================================================================
// DELETE /api/circuits/:circuitId/wires/:id
// ===========================================================================

describe('DELETE /api/circuits/:circuitId/wires/:id', () => {
  it('deletes a wire', async () => {
    mockStorage.getCircuitWire.mockResolvedValue(makeWire());
    mockStorage.deleteCircuitWire.mockResolvedValue(true);

    const res = await authFetch(`${baseUrl}/api/circuits/1/wires/1`, { method: 'DELETE' });
    expect(res.status).toBe(204);
  });

  it('returns 404 for non-existent wire', async () => {
    mockStorage.deleteCircuitWire.mockResolvedValue(false);

    const res = await authFetch(`${baseUrl}/api/circuits/1/wires/999`, { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});
