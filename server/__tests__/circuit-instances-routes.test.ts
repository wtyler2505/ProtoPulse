/**
 * Circuit Instances Routes Tests — server/circuit-routes/instances.ts
 *
 * Tests circuit component instance CRUD endpoints.
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import { registerCircuitInstanceRoutes } from '../circuit-routes/instances';
import type { IStorage } from '../storage';

// ---------------------------------------------------------------------------
// Mock storage
// ---------------------------------------------------------------------------

const NOW = new Date('2026-03-08T12:00:00Z');

function makeInstance(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    circuitId: 1,
    partId: 1,
    referenceDesignator: 'U1',
    schematicX: 100,
    schematicY: 200,
    schematicRotation: 0,
    breadboardX: null,
    breadboardY: null,
    breadboardRotation: null,
    pcbX: null,
    pcbY: null,
    pcbRotation: null,
    pcbSide: 'front',
    properties: {},
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const mockStorage: Record<string, ReturnType<typeof vi.fn>> = {
  getCircuitInstances: vi.fn(),
  getCircuitInstance: vi.fn(),
  createCircuitInstance: vi.fn(),
  updateCircuitInstance: vi.fn(),
  deleteCircuitInstance: vi.fn(),
};

vi.mock('../db', () => ({ db: {}, pool: {}, checkConnection: vi.fn() }));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: '150kb' }));
  registerCircuitInstanceRoutes(app, mockStorage as unknown as IStorage);

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
// GET /api/circuits/:circuitId/instances
// ===========================================================================

describe('GET /api/circuits/:circuitId/instances', () => {
  it('returns instances for a circuit', async () => {
    mockStorage.getCircuitInstances.mockResolvedValue([makeInstance(), makeInstance({ id: 2, referenceDesignator: 'R1' })]);

    const res = await fetch(`${baseUrl}/api/circuits/1/instances`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number };
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(2);
  });

  it('respects pagination parameters', async () => {
    mockStorage.getCircuitInstances.mockResolvedValue([
      makeInstance({ id: 1 }),
      makeInstance({ id: 2 }),
      makeInstance({ id: 3 }),
    ]);

    const res = await fetch(`${baseUrl}/api/circuits/1/instances?limit=2&offset=0`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number };
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(3);
  });
});

// ===========================================================================
// GET /api/circuits/:circuitId/instances/:id
// ===========================================================================

describe('GET /api/circuits/:circuitId/instances/:id', () => {
  it('returns a specific instance', async () => {
    mockStorage.getCircuitInstance.mockResolvedValue(makeInstance());

    const res = await fetch(`${baseUrl}/api/circuits/1/instances/1`);
    expect(res.status).toBe(200);
    const body = await res.json() as { referenceDesignator: string };
    expect(body.referenceDesignator).toBe('U1');
  });

  it('returns 404 for non-existent instance', async () => {
    mockStorage.getCircuitInstance.mockResolvedValue(null);

    const res = await fetch(`${baseUrl}/api/circuits/1/instances/999`);
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// POST /api/circuits/:circuitId/instances
// ===========================================================================

describe('POST /api/circuits/:circuitId/instances', () => {
  it('creates a circuit instance', async () => {
    mockStorage.createCircuitInstance.mockResolvedValue(makeInstance({ id: 10 }));

    const res = await fetch(`${baseUrl}/api/circuits/1/instances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partId: 1,
        referenceDesignator: 'C1',
        schematicX: 50,
        schematicY: 50,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { id: number };
    expect(body.id).toBe(10);
  });

  it('returns 400 for missing required fields', async () => {
    const res = await fetch(`${baseUrl}/api/circuits/1/instances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partId: 1 }),
    });
    expect(res.status).toBe(400);
  });
});

// ===========================================================================
// PATCH /api/circuits/:circuitId/instances/:id
// ===========================================================================

describe('PATCH /api/circuits/:circuitId/instances/:id', () => {
  it('updates an instance', async () => {
    mockStorage.updateCircuitInstance.mockResolvedValue(makeInstance({ schematicX: 300 }));

    const res = await fetch(`${baseUrl}/api/circuits/1/instances/1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schematicX: 300 }),
    });
    expect(res.status).toBe(200);
  });

  it('returns 404 for non-existent instance', async () => {
    mockStorage.updateCircuitInstance.mockResolvedValue(null);

    const res = await fetch(`${baseUrl}/api/circuits/1/instances/999`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schematicX: 0 }),
    });
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// DELETE /api/circuits/:circuitId/instances/:id
// ===========================================================================

describe('DELETE /api/circuits/:circuitId/instances/:id', () => {
  it('deletes an instance', async () => {
    mockStorage.deleteCircuitInstance.mockResolvedValue(true);

    const res = await fetch(`${baseUrl}/api/circuits/1/instances/1`, { method: 'DELETE' });
    expect(res.status).toBe(204);
  });

  it('returns 404 for non-existent instance', async () => {
    mockStorage.deleteCircuitInstance.mockResolvedValue(false);

    const res = await fetch(`${baseUrl}/api/circuits/1/instances/999`, { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});
