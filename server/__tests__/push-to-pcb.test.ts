/**
 * Push to PCB Route Tests — server/circuit-routes/instances.ts
 *
 * Tests the POST /api/circuits/:circuitId/push-to-pcb endpoint that
 * performs schematic → PCB forward annotation by assigning PCB placement
 * coordinates to instances that don't yet have them.
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
    subDesignId: null,
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
    ...overrides,
  };
}

const mockStorage: Record<string, ReturnType<typeof vi.fn>> = {
  getCircuitInstances: vi.fn(),
  getCircuitInstance: vi.fn(),
  createCircuitInstance: vi.fn(),
  updateCircuitInstance: vi.fn(),
  deleteCircuitInstance: vi.fn(),
  getComponentPart: vi.fn(),
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
// POST /api/circuits/:circuitId/push-to-pcb
// ===========================================================================

describe('POST /api/circuits/:circuitId/push-to-pcb', () => {
  it('assigns PCB coordinates to instances that lack them', async () => {
    const unplacedA = makeInstance({ id: 1, referenceDesignator: 'U1', pcbX: null, pcbY: null, properties: { packageType: 'DIP-8' } });
    const unplacedB = makeInstance({ id: 2, referenceDesignator: 'R1', pcbX: null, pcbY: null, properties: { packageType: '0805' } });

    mockStorage.getCircuitInstances.mockResolvedValue([unplacedA, unplacedB]);
    mockStorage.updateCircuitInstance.mockImplementation(async (id: number, data: Record<string, unknown>) => {
      return { ...makeInstance({ id }), ...data };
    });

    const res = await fetch(`${baseUrl}/api/circuits/1/push-to-pcb`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { pushed: number; alreadyPlaced: number; total: number };
    expect(body.pushed).toBe(2);
    expect(body.alreadyPlaced).toBe(0);
    expect(body.total).toBe(2);

    // Verify updateCircuitInstance called for each unplaced instance
    expect(mockStorage.updateCircuitInstance).toHaveBeenCalledTimes(2);

    // Verify PCB coordinates are negative X (unplaced area) and staggered Y
    const firstCall = mockStorage.updateCircuitInstance.mock.calls[0] as [number, Record<string, unknown>];
    expect(firstCall[0]).toBe(1);
    expect(firstCall[1].pcbX).toBeLessThan(0);
    expect(typeof firstCall[1].pcbY).toBe('number');
    expect(firstCall[1].pcbRotation).toBe(0);
    expect(firstCall[1].pcbSide).toBe('front');

    const secondCall = mockStorage.updateCircuitInstance.mock.calls[1] as [number, Record<string, unknown>];
    expect(secondCall[0]).toBe(2);
    expect(secondCall[1].pcbX).toBeLessThan(0);
    // Second instance should be at a different Y than the first
    expect(secondCall[1].pcbY).not.toBe(firstCall[1].pcbY);
  });

  it('skips instances that already have PCB placement', async () => {
    const placed = makeInstance({ id: 1, pcbX: 10, pcbY: 20, properties: {} });
    const unplaced = makeInstance({ id: 2, referenceDesignator: 'R1', pcbX: null, pcbY: null, properties: {} });

    mockStorage.getCircuitInstances.mockResolvedValue([placed, unplaced]);
    mockStorage.updateCircuitInstance.mockImplementation(async (id: number, data: Record<string, unknown>) => {
      return { ...makeInstance({ id }), ...data };
    });

    const res = await fetch(`${baseUrl}/api/circuits/1/push-to-pcb`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { pushed: number; alreadyPlaced: number; total: number };
    expect(body.pushed).toBe(1);
    expect(body.alreadyPlaced).toBe(1);
    expect(body.total).toBe(2);

    // Only the unplaced instance should be updated
    expect(mockStorage.updateCircuitInstance).toHaveBeenCalledTimes(1);
    expect(mockStorage.updateCircuitInstance.mock.calls[0]![0]).toBe(2);
  });

  it('returns 200 with pushed=0 when all instances already placed', async () => {
    const placed = makeInstance({ id: 1, pcbX: 10, pcbY: 20, properties: {} });

    mockStorage.getCircuitInstances.mockResolvedValue([placed]);

    const res = await fetch(`${baseUrl}/api/circuits/1/push-to-pcb`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { pushed: number; alreadyPlaced: number; total: number };
    expect(body.pushed).toBe(0);
    expect(body.alreadyPlaced).toBe(1);
    expect(mockStorage.updateCircuitInstance).not.toHaveBeenCalled();
  });

  it('returns 400 when circuit has no instances', async () => {
    mockStorage.getCircuitInstances.mockResolvedValue([]);

    const res = await fetch(`${baseUrl}/api/circuits/1/push-to-pcb`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { message: string };
    expect(body.message).toContain('No instances');
  });

  it('returns pushed instances in the response', async () => {
    const unplaced = makeInstance({ id: 5, referenceDesignator: 'C1', pcbX: null, pcbY: null, properties: {} });

    mockStorage.getCircuitInstances.mockResolvedValue([unplaced]);
    mockStorage.updateCircuitInstance.mockImplementation(async (id: number, data: Record<string, unknown>) => {
      return { ...makeInstance({ id, referenceDesignator: 'C1' }), ...data };
    });

    const res = await fetch(`${baseUrl}/api/circuits/1/push-to-pcb`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { pushed: number; instances: Array<{ id: number; referenceDesignator: string }> };
    expect(body.instances).toHaveLength(1);
    expect(body.instances[0]!.id).toBe(5);
    expect(body.instances[0]!.referenceDesignator).toBe('C1');
  });
});
