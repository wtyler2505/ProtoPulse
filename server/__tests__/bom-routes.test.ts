/**
 * BOM Routes Tests — server/routes/bom.ts
 *
 * Tests BOM items CRUD endpoints.
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import { registerBomRoutes } from '../routes/bom';

// ---------------------------------------------------------------------------
// Mock storage
// ---------------------------------------------------------------------------

const {
  mockGetBomItems,
  mockGetBomItem,
  mockCreateBomItem,
  mockUpdateBomItem,
  mockDeleteBomItem,
  mockGetLowStockItems,
  mockGetStorageLocations,
  mockGetProject,
} = vi.hoisted(() => ({
  mockGetBomItems: vi.fn(),
  mockGetBomItem: vi.fn(),
  mockCreateBomItem: vi.fn(),
  mockUpdateBomItem: vi.fn(),
  mockDeleteBomItem: vi.fn(),
  mockGetLowStockItems: vi.fn(),
  mockGetStorageLocations: vi.fn(),
  mockGetProject: vi.fn(),
}));

vi.mock('../storage', () => ({
  storage: {
    getProject: mockGetProject,
    getBomItems: mockGetBomItems,
    getBomItem: mockGetBomItem,
    createBomItem: mockCreateBomItem,
    updateBomItem: mockUpdateBomItem,
    deleteBomItem: mockDeleteBomItem,
    getLowStockItems: mockGetLowStockItems,
    getStorageLocations: mockGetStorageLocations,
  },
  VersionConflictError: class VersionConflictError extends Error {
    currentVersion: number;
    constructor(entity: string, id: number, currentVersion: number) {
      super('Version conflict');
      this.name = 'VersionConflictError';
      this.currentVersion = currentVersion;
    }
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

function makeBomItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    projectId: 1,
    partNumber: 'ATmega2560',
    manufacturer: 'Microchip',
    description: 'AVR Microcontroller',
    quantity: 1,
    unitPrice: '12.50',
    totalPrice: '12.50',
    supplier: 'DigiKey',
    stock: 100,
    status: 'In Stock',
    leadTime: null,
    version: 1,
    deletedAt: null,
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
  registerBomRoutes(app);

  app.use((err: { status?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err.status ?? 500;
    res.status(status).json({ message: err.message ?? 'Internal error' });
  });

  await new Promise<void>((resolve) => {
    const instance = app.listen(0, () => {
      const addr = instance.address();
      if (typeof addr === 'object' && addr !== null) {
        baseUrl = `http://127.0.0.1:${String(addr.port)}`;
      }
      server = instance;
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
// GET /api/projects/:id/bom
// ===========================================================================

describe('GET /api/projects/:id/bom', () => {
  it('returns BOM items for a project', async () => {
    mockGetBomItems.mockResolvedValue([makeBomItem(), makeBomItem({ id: 2, partNumber: 'ESP32' })]);

    const res = await authFetch(`${baseUrl}/api/projects/1/bom`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number };
    expect(body.data).toHaveLength(2);
  });

  it('returns 401 without session', async () => {
    const res = await fetch(`${baseUrl}/api/projects/1/bom`);
    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// GET /api/projects/:id/bom/low-stock
// ===========================================================================

describe('GET /api/projects/:id/bom/low-stock', () => {
  it('returns low-stock items', async () => {
    mockGetLowStockItems.mockResolvedValue([makeBomItem({ status: 'Low Stock', stock: 2 })]);

    const res = await authFetch(`${baseUrl}/api/projects/1/bom/low-stock`);
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(body).toHaveLength(1);
  });
});

// ===========================================================================
// GET /api/projects/:id/bom/storage-locations
// ===========================================================================

describe('GET /api/projects/:id/bom/storage-locations', () => {
  it('returns storage locations', async () => {
    mockGetStorageLocations.mockResolvedValue([{ location: 'Shelf A', count: 5 }]);

    const res = await authFetch(`${baseUrl}/api/projects/1/bom/storage-locations`);
    expect(res.status).toBe(200);
  });
});

// ===========================================================================
// GET /api/projects/:id/bom/:bomId
// ===========================================================================

describe('GET /api/projects/:id/bom/:bomId', () => {
  it('returns a specific BOM item with ETag', async () => {
    mockGetBomItem.mockResolvedValue(makeBomItem());

    const res = await authFetch(`${baseUrl}/api/projects/1/bom/1`);
    expect(res.status).toBe(200);
    expect(res.headers.get('etag')).toBe('"1"');
  });

  it('returns 404 for non-existent item', async () => {
    mockGetBomItem.mockResolvedValue(null);

    const res = await authFetch(`${baseUrl}/api/projects/1/bom/999`);
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// POST /api/projects/:id/bom
// ===========================================================================

describe('POST /api/projects/:id/bom', () => {
  it('creates a BOM item', async () => {
    mockCreateBomItem.mockResolvedValue(makeBomItem({ id: 10 }));

    const res = await authFetch(`${baseUrl}/api/projects/1/bom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partNumber: 'LM7805',
        manufacturer: 'TI',
        description: '5V Regulator',
        quantity: 2,
        unitPrice: '0.50',
        totalPrice: '1.00',
        supplier: 'Mouser',
        stock: 500,
        status: 'In Stock',
      }),
    });
    expect(res.status).toBe(201);
    expect(res.headers.get('etag')).toBe('"1"');
  });

  it('accepts numeric unitPrice input and normalizes it before storage', async () => {
    mockCreateBomItem.mockResolvedValue(makeBomItem({ id: 11, unitPrice: '0', totalPrice: '0' }));

    const res = await authFetch(`${baseUrl}/api/projects/1/bom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partNumber: 'CALC-250R',
        manufacturer: 'Calculated',
        description: '250 Ohm resistor from Ohm\'s Law',
        quantity: 1,
        unitPrice: 0,
        supplier: 'Unknown',
        stock: 0,
        status: 'In Stock',
      }),
    });

    expect(res.status).toBe(201);
    expect(mockCreateBomItem).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 1,
      unitPrice: '0',
    }));
  });

  it('returns 400 for missing fields', async () => {
    const res = await authFetch(`${baseUrl}/api/projects/1/bom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partNumber: 'X' }),
    });
    expect(res.status).toBe(400);
  });
});

// ===========================================================================
// PATCH /api/projects/:id/bom/:bomId
// ===========================================================================

describe('PATCH /api/projects/:id/bom/:bomId', () => {
  it('updates a BOM item', async () => {
    mockUpdateBomItem.mockResolvedValue(makeBomItem({ quantity: 5, version: 2 }));

    const res = await authFetch(`${baseUrl}/api/projects/1/bom/1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 5 }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('etag')).toBe('"2"');
  });

  it('accepts numeric unitPrice in PATCH payloads and normalizes it before storage', async () => {
    mockUpdateBomItem.mockResolvedValue(makeBomItem({ unitPrice: '0.25', totalPrice: '0.25', version: 2 }));

    const res = await authFetch(`${baseUrl}/api/projects/1/bom/1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unitPrice: 0.25 }),
    });

    expect(res.status).toBe(200);
    expect(mockUpdateBomItem).toHaveBeenCalledWith(1, 1, expect.objectContaining({
      unitPrice: '0.25',
    }), undefined);
  });

  it('returns 404 for non-existent item', async () => {
    mockUpdateBomItem.mockResolvedValue(null);

    const res = await authFetch(`${baseUrl}/api/projects/1/bom/999`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 1 }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 409 on version conflict', async () => {
    const { VersionConflictError } = await import('../storage');
    mockUpdateBomItem.mockRejectedValue(new VersionConflictError('bom_item', 1, 3));

    const res = await authFetch(`${baseUrl}/api/projects/1/bom/1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'If-Match': '"1"' },
      body: JSON.stringify({ quantity: 2 }),
    });
    expect(res.status).toBe(409);
  });
});

// ===========================================================================
// DELETE /api/projects/:id/bom/:bomId
// ===========================================================================

describe('DELETE /api/projects/:id/bom/:bomId', () => {
  it('deletes a BOM item', async () => {
    mockDeleteBomItem.mockResolvedValue(true);

    const res = await authFetch(`${baseUrl}/api/projects/1/bom/1`, { method: 'DELETE' });
    expect(res.status).toBe(204);
  });

  it('returns 404 for non-existent item', async () => {
    mockDeleteBomItem.mockResolvedValue(false);

    const res = await authFetch(`${baseUrl}/api/projects/1/bom/999`, { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});
