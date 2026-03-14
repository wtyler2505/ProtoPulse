/**
 * Circuit Nets Routes Tests — server/circuit-routes/nets.ts
 *
 * Tests circuit nets CRUD endpoints.
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import { registerCircuitNetRoutes } from '../circuit-routes/nets';
import type { IStorage } from '../storage';

// ---------------------------------------------------------------------------
// Mock storage
// ---------------------------------------------------------------------------

const NOW = new Date('2026-03-08T12:00:00Z');

function makeNet(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    circuitId: 1,
    name: 'VCC',
    netType: 'power',
    voltage: '5V',
    busWidth: null,
    segments: [],
    labels: [],
    style: {},
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const mockStorage: Record<string, ReturnType<typeof vi.fn>> = {
  getCircuitNets: vi.fn(),
  getCircuitNet: vi.fn(),
  createCircuitNet: vi.fn(),
  updateCircuitNet: vi.fn(),
  deleteCircuitNet: vi.fn(),
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
  registerCircuitNetRoutes(app, mockStorage as unknown as IStorage);

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
// GET /api/circuits/:circuitId/nets
// ===========================================================================

describe('GET /api/circuits/:circuitId/nets', () => {
  it('returns nets for a circuit', async () => {
    mockStorage.getCircuitNets.mockResolvedValue([makeNet(), makeNet({ id: 2, name: 'GND', netType: 'ground' })]);

    const res = await authFetch(`${baseUrl}/api/circuits/1/nets`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number };
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(2);
  });
});

// ===========================================================================
// GET /api/circuits/:circuitId/nets/:id
// ===========================================================================

describe('GET /api/circuits/:circuitId/nets/:id', () => {
  it('returns a specific net', async () => {
    mockStorage.getCircuitNet.mockResolvedValue(makeNet());

    const res = await authFetch(`${baseUrl}/api/circuits/1/nets/1`);
    expect(res.status).toBe(200);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('VCC');
  });

  it('returns 404 for non-existent net', async () => {
    mockStorage.getCircuitNet.mockResolvedValue(null);

    const res = await authFetch(`${baseUrl}/api/circuits/1/nets/999`);
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// POST /api/circuits/:circuitId/nets
// ===========================================================================

describe('POST /api/circuits/:circuitId/nets', () => {
  it('creates a circuit net', async () => {
    mockStorage.createCircuitNet.mockResolvedValue(makeNet({ id: 10 }));

    const res = await authFetch(`${baseUrl}/api/circuits/1/nets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'SDA' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { id: number };
    expect(body.id).toBe(10);
  });

  it('returns 400 for missing name', async () => {
    const res = await authFetch(`${baseUrl}/api/circuits/1/nets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid netType', async () => {
    const res = await authFetch(`${baseUrl}/api/circuits/1/nets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'TEST', netType: 'invalid' }),
    });
    expect(res.status).toBe(400);
  });
});

// ===========================================================================
// PATCH /api/circuits/:circuitId/nets/:id
// ===========================================================================

describe('PATCH /api/circuits/:circuitId/nets/:id', () => {
  it('updates a net', async () => {
    mockStorage.getCircuitNet.mockResolvedValue(makeNet());
    mockStorage.updateCircuitNet.mockResolvedValue(makeNet({ name: 'MOSI' }));

    const res = await authFetch(`${baseUrl}/api/circuits/1/nets/1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'MOSI' }),
    });
    expect(res.status).toBe(200);
  });

  it('returns 404 for non-existent net', async () => {
    mockStorage.updateCircuitNet.mockResolvedValue(null);

    const res = await authFetch(`${baseUrl}/api/circuits/1/nets/999`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X' }),
    });
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// DELETE /api/circuits/:circuitId/nets/:id
// ===========================================================================

describe('DELETE /api/circuits/:circuitId/nets/:id', () => {
  it('deletes a net', async () => {
    mockStorage.getCircuitNet.mockResolvedValue(makeNet());
    mockStorage.deleteCircuitNet.mockResolvedValue(true);

    const res = await authFetch(`${baseUrl}/api/circuits/1/nets/1`, { method: 'DELETE' });
    expect(res.status).toBe(204);
  });

  it('returns 404 for non-existent net', async () => {
    mockStorage.deleteCircuitNet.mockResolvedValue(false);

    const res = await authFetch(`${baseUrl}/api/circuits/1/nets/999`, { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});
