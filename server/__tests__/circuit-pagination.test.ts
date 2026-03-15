/**
 * Circuit Pagination Tests — BL-0285
 *
 * Comprehensive tests for limit/offset/sort pagination on all three
 * circuit GET list endpoints: instances, nets, and wires.
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import { registerCircuitInstanceRoutes } from '../circuit-routes/instances';
import { registerCircuitNetRoutes } from '../circuit-routes/nets';
import { registerCircuitWireRoutes } from '../circuit-routes/wires';
import type { IStorage } from '../storage';

// ---------------------------------------------------------------------------
// Mock storage
// ---------------------------------------------------------------------------

const NOW = new Date('2026-03-15T12:00:00Z');

function makeInstance(id: number) {
  return {
    id,
    circuitId: 1,
    partId: 1,
    referenceDesignator: `U${String(id)}`,
    schematicX: id * 100,
    schematicY: id * 100,
    schematicRotation: 0,
    breadboardX: null,
    breadboardY: null,
    breadboardRotation: null,
    pcbX: null,
    pcbY: null,
    pcbRotation: null,
    pcbSide: 'front',
    properties: {},
    createdAt: new Date(NOW.getTime() + id * 1000),
    updatedAt: new Date(NOW.getTime() + id * 1000),
  };
}

function makeNet(id: number) {
  return {
    id,
    circuitId: 1,
    name: `NET${String(id)}`,
    netType: 'signal',
    voltage: null,
    busWidth: null,
    segments: [],
    labels: [],
    style: {},
    createdAt: new Date(NOW.getTime() + id * 1000),
    updatedAt: new Date(NOW.getTime() + id * 1000),
  };
}

function makeWire(id: number) {
  return {
    id,
    circuitId: 1,
    netId: 1,
    view: 'schematic',
    points: [{ x: 0, y: 0 }, { x: id * 10, y: 0 }],
    layer: null,
    width: 1.0,
    color: null,
    wireType: 'wire',
    createdAt: new Date(NOW.getTime() + id * 1000),
    updatedAt: new Date(NOW.getTime() + id * 1000),
  };
}

const mockStorage: Record<string, ReturnType<typeof vi.fn>> = {
  getCircuitInstances: vi.fn(),
  getCircuitInstance: vi.fn(),
  createCircuitInstance: vi.fn(),
  updateCircuitInstance: vi.fn(),
  deleteCircuitInstance: vi.fn(),
  getCircuitNets: vi.fn(),
  getCircuitNet: vi.fn(),
  createCircuitNet: vi.fn(),
  updateCircuitNet: vi.fn(),
  deleteCircuitNet: vi.fn(),
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
  registerCircuitInstanceRoutes(app, mockStorage as unknown as IStorage);
  registerCircuitNetRoutes(app, mockStorage as unknown as IStorage);
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

// ---------------------------------------------------------------------------
// Generate test datasets
// ---------------------------------------------------------------------------

const INSTANCES_10 = Array.from({ length: 10 }, (_, i) => makeInstance(i + 1));
const NETS_10 = Array.from({ length: 10 }, (_, i) => makeNet(i + 1));
const WIRES_10 = Array.from({ length: 10 }, (_, i) => makeWire(i + 1));

// ===========================================================================
// Instances pagination
// ===========================================================================

describe('GET /api/circuits/:circuitId/instances — pagination', () => {
  it('applies default limit=50, offset=0, sort=desc when no params given', async () => {
    mockStorage.getCircuitInstances.mockResolvedValue(INSTANCES_10);

    const res = await authFetch(`${baseUrl}/api/circuits/1/instances`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ id: number }>; total: number };
    expect(body.total).toBe(10);
    expect(body.data).toHaveLength(10);
    // Default sort=desc means reversed order
    expect(body.data[0]!.id).toBe(10);
    expect(body.data[9]!.id).toBe(1);
  });

  it('respects limit parameter', async () => {
    mockStorage.getCircuitInstances.mockResolvedValue(INSTANCES_10);

    const res = await authFetch(`${baseUrl}/api/circuits/1/instances?limit=3`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ id: number }>; total: number };
    expect(body.data).toHaveLength(3);
    expect(body.total).toBe(10);
  });

  it('respects offset parameter', async () => {
    mockStorage.getCircuitInstances.mockResolvedValue(INSTANCES_10);

    const res = await authFetch(`${baseUrl}/api/circuits/1/instances?limit=3&offset=3`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ id: number }>; total: number };
    expect(body.data).toHaveLength(3);
    // sort=desc (default), so reversed: [10,9,8,7,6,5,4,3,2,1], offset=3 → [7,6,5]
    expect(body.data[0]!.id).toBe(7);
    expect(body.data[2]!.id).toBe(5);
  });

  it('sort=asc returns items in original order', async () => {
    mockStorage.getCircuitInstances.mockResolvedValue(INSTANCES_10);

    const res = await authFetch(`${baseUrl}/api/circuits/1/instances?sort=asc`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ id: number }>; total: number };
    expect(body.data[0]!.id).toBe(1);
    expect(body.data[9]!.id).toBe(10);
  });

  it('sort=desc returns items in reversed order', async () => {
    mockStorage.getCircuitInstances.mockResolvedValue(INSTANCES_10);

    const res = await authFetch(`${baseUrl}/api/circuits/1/instances?sort=desc`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ id: number }>; total: number };
    expect(body.data[0]!.id).toBe(10);
    expect(body.data[9]!.id).toBe(1);
  });

  it('offset beyond total returns empty data with correct total', async () => {
    mockStorage.getCircuitInstances.mockResolvedValue(INSTANCES_10);

    const res = await authFetch(`${baseUrl}/api/circuits/1/instances?offset=100`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number };
    expect(body.data).toHaveLength(0);
    expect(body.total).toBe(10);
  });

  it('returns 400 for limit=0 (below minimum)', async () => {
    const res = await authFetch(`${baseUrl}/api/circuits/1/instances?limit=0`);
    expect(res.status).toBe(400);
  });

  it('returns 400 for limit=501 (above max 500)', async () => {
    const res = await authFetch(`${baseUrl}/api/circuits/1/instances?limit=501`);
    expect(res.status).toBe(400);
  });

  it('returns 400 for negative offset', async () => {
    const res = await authFetch(`${baseUrl}/api/circuits/1/instances?offset=-1`);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid sort value', async () => {
    const res = await authFetch(`${baseUrl}/api/circuits/1/instances?sort=random`);
    expect(res.status).toBe(400);
  });

  it('handles empty result set', async () => {
    mockStorage.getCircuitInstances.mockResolvedValue([]);

    const res = await authFetch(`${baseUrl}/api/circuits/1/instances`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number };
    expect(body.data).toHaveLength(0);
    expect(body.total).toBe(0);
  });
});

// ===========================================================================
// Nets pagination
// ===========================================================================

describe('GET /api/circuits/:circuitId/nets — pagination', () => {
  it('applies default limit=50, offset=0, sort=desc when no params given', async () => {
    mockStorage.getCircuitNets.mockResolvedValue(NETS_10);

    const res = await authFetch(`${baseUrl}/api/circuits/1/nets`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ id: number }>; total: number };
    expect(body.total).toBe(10);
    expect(body.data).toHaveLength(10);
    expect(body.data[0]!.id).toBe(10);
  });

  it('respects limit parameter', async () => {
    mockStorage.getCircuitNets.mockResolvedValue(NETS_10);

    const res = await authFetch(`${baseUrl}/api/circuits/1/nets?limit=5`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number };
    expect(body.data).toHaveLength(5);
    expect(body.total).toBe(10);
  });

  it('respects offset parameter', async () => {
    mockStorage.getCircuitNets.mockResolvedValue(NETS_10);

    const res = await authFetch(`${baseUrl}/api/circuits/1/nets?limit=2&offset=8&sort=asc`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ id: number }>; total: number };
    expect(body.data).toHaveLength(2);
    // sort=asc, offset=8 → items 9 and 10
    expect(body.data[0]!.id).toBe(9);
    expect(body.data[1]!.id).toBe(10);
  });

  it('sort=asc preserves original order', async () => {
    mockStorage.getCircuitNets.mockResolvedValue(NETS_10);

    const res = await authFetch(`${baseUrl}/api/circuits/1/nets?sort=asc&limit=3`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ id: number; name: string }>; total: number };
    expect(body.data[0]!.id).toBe(1);
    expect(body.data[0]!.name).toBe('NET1');
    expect(body.data[2]!.id).toBe(3);
  });

  it('sort=desc reverses order', async () => {
    mockStorage.getCircuitNets.mockResolvedValue(NETS_10);

    const res = await authFetch(`${baseUrl}/api/circuits/1/nets?sort=desc&limit=3`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ id: number }>; total: number };
    expect(body.data[0]!.id).toBe(10);
    expect(body.data[2]!.id).toBe(8);
  });

  it('offset beyond total returns empty data', async () => {
    mockStorage.getCircuitNets.mockResolvedValue(NETS_10);

    const res = await authFetch(`${baseUrl}/api/circuits/1/nets?offset=50`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number };
    expect(body.data).toHaveLength(0);
    expect(body.total).toBe(10);
  });

  it('returns 400 for limit=0', async () => {
    const res = await authFetch(`${baseUrl}/api/circuits/1/nets?limit=0`);
    expect(res.status).toBe(400);
  });

  it('returns 400 for limit exceeding max', async () => {
    const res = await authFetch(`${baseUrl}/api/circuits/1/nets?limit=999`);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid sort', async () => {
    const res = await authFetch(`${baseUrl}/api/circuits/1/nets?sort=newest`);
    expect(res.status).toBe(400);
  });

  it('handles empty result set', async () => {
    mockStorage.getCircuitNets.mockResolvedValue([]);

    const res = await authFetch(`${baseUrl}/api/circuits/1/nets`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number };
    expect(body.data).toHaveLength(0);
    expect(body.total).toBe(0);
  });
});

// ===========================================================================
// Wires pagination
// ===========================================================================

describe('GET /api/circuits/:circuitId/wires — pagination', () => {
  it('applies default limit=50, offset=0, sort=desc when no params given', async () => {
    mockStorage.getCircuitWires.mockResolvedValue(WIRES_10);

    const res = await authFetch(`${baseUrl}/api/circuits/1/wires`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ id: number }>; total: number };
    expect(body.total).toBe(10);
    expect(body.data).toHaveLength(10);
    expect(body.data[0]!.id).toBe(10);
  });

  it('respects limit parameter', async () => {
    mockStorage.getCircuitWires.mockResolvedValue(WIRES_10);

    const res = await authFetch(`${baseUrl}/api/circuits/1/wires?limit=4`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number };
    expect(body.data).toHaveLength(4);
    expect(body.total).toBe(10);
  });

  it('respects offset parameter', async () => {
    mockStorage.getCircuitWires.mockResolvedValue(WIRES_10);

    const res = await authFetch(`${baseUrl}/api/circuits/1/wires?limit=2&offset=5&sort=asc`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ id: number }>; total: number };
    expect(body.data).toHaveLength(2);
    // sort=asc, offset=5 → items 6 and 7
    expect(body.data[0]!.id).toBe(6);
    expect(body.data[1]!.id).toBe(7);
  });

  it('sort=asc preserves original order', async () => {
    mockStorage.getCircuitWires.mockResolvedValue(WIRES_10);

    const res = await authFetch(`${baseUrl}/api/circuits/1/wires?sort=asc&limit=3`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ id: number }>; total: number };
    expect(body.data[0]!.id).toBe(1);
    expect(body.data[2]!.id).toBe(3);
  });

  it('sort=desc reverses order', async () => {
    mockStorage.getCircuitWires.mockResolvedValue(WIRES_10);

    const res = await authFetch(`${baseUrl}/api/circuits/1/wires?sort=desc&limit=3`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ id: number }>; total: number };
    expect(body.data[0]!.id).toBe(10);
    expect(body.data[2]!.id).toBe(8);
  });

  it('offset beyond total returns empty data', async () => {
    mockStorage.getCircuitWires.mockResolvedValue(WIRES_10);

    const res = await authFetch(`${baseUrl}/api/circuits/1/wires?offset=200`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number };
    expect(body.data).toHaveLength(0);
    expect(body.total).toBe(10);
  });

  it('returns 400 for limit=0', async () => {
    const res = await authFetch(`${baseUrl}/api/circuits/1/wires?limit=0`);
    expect(res.status).toBe(400);
  });

  it('returns 400 for limit exceeding max', async () => {
    const res = await authFetch(`${baseUrl}/api/circuits/1/wires?limit=600`);
    expect(res.status).toBe(400);
  });

  it('returns 400 for negative offset', async () => {
    const res = await authFetch(`${baseUrl}/api/circuits/1/wires?offset=-5`);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid sort', async () => {
    const res = await authFetch(`${baseUrl}/api/circuits/1/wires?sort=latest`);
    expect(res.status).toBe(400);
  });

  it('handles empty result set', async () => {
    mockStorage.getCircuitWires.mockResolvedValue([]);

    const res = await authFetch(`${baseUrl}/api/circuits/1/wires`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number };
    expect(body.data).toHaveLength(0);
    expect(body.total).toBe(0);
  });
});

// ===========================================================================
// Cross-cutting pagination edge cases
// ===========================================================================

describe('circuitPaginationSchema edge cases', () => {
  it('limit=500 (max) is accepted on instances', async () => {
    mockStorage.getCircuitInstances.mockResolvedValue(INSTANCES_10);

    const res = await authFetch(`${baseUrl}/api/circuits/1/instances?limit=500`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number };
    expect(body.data).toHaveLength(10);
  });

  it('limit=1 (min) is accepted on nets', async () => {
    mockStorage.getCircuitNets.mockResolvedValue(NETS_10);

    const res = await authFetch(`${baseUrl}/api/circuits/1/nets?limit=1`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number };
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(10);
  });

  it('limit and offset as string numbers are coerced on wires', async () => {
    mockStorage.getCircuitWires.mockResolvedValue(WIRES_10);

    const res = await authFetch(`${baseUrl}/api/circuits/1/wires?limit=2&offset=1&sort=asc`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ id: number }>; total: number };
    expect(body.data).toHaveLength(2);
    expect(body.data[0]!.id).toBe(2);
    expect(body.data[1]!.id).toBe(3);
  });

  it('returns 400 for non-numeric limit', async () => {
    const res = await authFetch(`${baseUrl}/api/circuits/1/instances?limit=abc`);
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-numeric offset', async () => {
    const res = await authFetch(`${baseUrl}/api/circuits/1/nets?offset=xyz`);
    expect(res.status).toBe(400);
  });

  it('returns 400 for float limit (not integer)', async () => {
    const res = await authFetch(`${baseUrl}/api/circuits/1/wires?limit=2.5`);
    expect(res.status).toBe(400);
  });

  it('total always reflects full collection size regardless of limit/offset', async () => {
    mockStorage.getCircuitInstances.mockResolvedValue(INSTANCES_10);

    const res = await authFetch(`${baseUrl}/api/circuits/1/instances?limit=1&offset=0`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number };
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(10);
  });

  it('last page returns remaining items when fewer than limit', async () => {
    mockStorage.getCircuitNets.mockResolvedValue(NETS_10);

    // sort=asc, limit=4, offset=8 → items 9, 10 (only 2 remaining)
    const res = await authFetch(`${baseUrl}/api/circuits/1/nets?limit=4&offset=8&sort=asc`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ id: number }>; total: number };
    expect(body.data).toHaveLength(2);
    expect(body.data[0]!.id).toBe(9);
    expect(body.data[1]!.id).toBe(10);
    expect(body.total).toBe(10);
  });
});
