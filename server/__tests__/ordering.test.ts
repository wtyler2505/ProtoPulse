import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import { registerOrderingRoutes } from '../routes/ordering';
import type { PcbOrder } from '@shared/schema';

// ---------------------------------------------------------------------------
// Mock storage
// ---------------------------------------------------------------------------

const {
  mockGetOrders,
  mockGetOrder,
  mockCreateOrder,
  mockUpdateOrder,
  mockDeleteOrder,
} = vi.hoisted(() => ({
  mockGetOrders: vi.fn(),
  mockGetOrder: vi.fn(),
  mockCreateOrder: vi.fn(),
  mockUpdateOrder: vi.fn(),
  mockDeleteOrder: vi.fn(),
}));

vi.mock('../storage', () => ({
  storage: {
    getOrders: mockGetOrders,
    getOrder: mockGetOrder,
    createOrder: mockCreateOrder,
    updateOrder: mockUpdateOrder,
    deleteOrder: mockDeleteOrder,
  },
}));

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const NOW = new Date('2026-03-05T12:00:00Z');

function makeOrder(overrides: Partial<PcbOrder> = {}): PcbOrder {
  return {
    id: 1,
    projectId: 1,
    fabricatorId: 'jlcpcb',
    boardSpec: { width: 50, height: 30, layers: 2 },
    quantity: 5,
    turnaround: 'standard',
    status: 'draft',
    quoteData: null,
    fabOrderNumber: null,
    trackingNumber: null,
    notes: null,
    submittedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as PcbOrder;
}

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

let app: express.Express;
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  app = express();
  app.use(express.json({ limit: '150kb' }));
  registerOrderingRoutes(app);

  // Global error handler for HttpError
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
    server.close((err) => {
      if (err) { reject(err); } else { resolve(); }
    });
  });
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// GET /api/projects/:projectId/orders
// ---------------------------------------------------------------------------

describe('GET /api/projects/:projectId/orders', () => {
  it('returns empty array when no orders exist', async () => {
    mockGetOrders.mockResolvedValue([]);
    const res = await fetch(`${baseUrl}/api/projects/1/orders`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
    expect(body.total).toBe(0);
    expect(mockGetOrders).toHaveBeenCalledWith(1);
  });

  it('returns list of orders for a project', async () => {
    const orders = [makeOrder({ id: 1 }), makeOrder({ id: 2, fabricatorId: 'pcbway' })];
    mockGetOrders.mockResolvedValue(orders);
    const res = await fetch(`${baseUrl}/api/projects/1/orders`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(2);
  });

  it('returns 400 for invalid project ID', async () => {
    const res = await fetch(`${baseUrl}/api/projects/abc/orders`);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /api/projects/:projectId/orders/:orderId
// ---------------------------------------------------------------------------

describe('GET /api/projects/:projectId/orders/:orderId', () => {
  it('returns single order', async () => {
    const order = makeOrder();
    mockGetOrder.mockResolvedValue(order);
    const res = await fetch(`${baseUrl}/api/projects/1/orders/1`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(1);
    expect(body.fabricatorId).toBe('jlcpcb');
  });

  it('returns 404 when order not found', async () => {
    mockGetOrder.mockResolvedValue(undefined);
    const res = await fetch(`${baseUrl}/api/projects/1/orders/999`);
    expect(res.status).toBe(404);
  });

  it('returns 404 when order belongs to different project', async () => {
    const order = makeOrder({ projectId: 2 });
    mockGetOrder.mockResolvedValue(order);
    const res = await fetch(`${baseUrl}/api/projects/1/orders/1`);
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid order ID', async () => {
    const res = await fetch(`${baseUrl}/api/projects/1/orders/xyz`);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/projects/:projectId/orders
// ---------------------------------------------------------------------------

describe('POST /api/projects/:projectId/orders', () => {
  it('creates an order with required fields', async () => {
    const created = makeOrder();
    mockCreateOrder.mockResolvedValue(created);

    const res = await fetch(`${baseUrl}/api/projects/1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fabricatorId: 'jlcpcb',
        boardSpec: { width: 50, height: 30, layers: 2 },
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe(1);
    expect(mockCreateOrder).toHaveBeenCalledTimes(1);
    const callArg = mockCreateOrder.mock.calls[0][0];
    expect(callArg.projectId).toBe(1);
    expect(callArg.fabricatorId).toBe('jlcpcb');
    expect(callArg.quantity).toBe(5); // default
    expect(callArg.turnaround).toBe('standard'); // default
    expect(callArg.status).toBe('draft'); // default
  });

  it('creates an order with all fields', async () => {
    const created = makeOrder({ quantity: 10, turnaround: 'express', notes: 'Rush order' });
    mockCreateOrder.mockResolvedValue(created);

    const res = await fetch(`${baseUrl}/api/projects/1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fabricatorId: 'pcbway',
        boardSpec: { width: 100, height: 80, layers: 4 },
        quantity: 10,
        turnaround: 'express',
        notes: 'Rush order',
      }),
    });

    expect(res.status).toBe(201);
    const callArg = mockCreateOrder.mock.calls[0][0];
    expect(callArg.fabricatorId).toBe('pcbway');
    expect(callArg.quantity).toBe(10);
    expect(callArg.turnaround).toBe('express');
    expect(callArg.notes).toBe('Rush order');
  });

  it('returns 400 for invalid fabricatorId', async () => {
    const res = await fetch(`${baseUrl}/api/projects/1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fabricatorId: 'invalid_fab',
        boardSpec: { width: 50, height: 30 },
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toBeTruthy();
  });

  it('returns 400 when boardSpec is missing', async () => {
    const res = await fetch(`${baseUrl}/api/projects/1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fabricatorId: 'jlcpcb',
      }),
    });

    expect(res.status).toBe(400);
  });

  it('returns 400 when fabricatorId is missing', async () => {
    const res = await fetch(`${baseUrl}/api/projects/1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        boardSpec: { width: 50, height: 30 },
      }),
    });

    expect(res.status).toBe(400);
  });

  it('returns 400 for negative quantity', async () => {
    const res = await fetch(`${baseUrl}/api/projects/1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fabricatorId: 'jlcpcb',
        boardSpec: { width: 50, height: 30 },
        quantity: -1,
      }),
    });

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid turnaround', async () => {
    const res = await fetch(`${baseUrl}/api/projects/1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fabricatorId: 'jlcpcb',
        boardSpec: { width: 50, height: 30 },
        turnaround: 'instant',
      }),
    });

    expect(res.status).toBe(400);
  });

  it('accepts all valid fabricator IDs', async () => {
    const fabs = ['jlcpcb', 'pcbway', 'oshpark', 'pcbgogo', 'seeed'];
    for (const fab of fabs) {
      mockCreateOrder.mockResolvedValue(makeOrder({ fabricatorId: fab }));
      const res = await fetch(`${baseUrl}/api/projects/1/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fabricatorId: fab,
          boardSpec: { width: 50, height: 30 },
        }),
      });
      expect(res.status).toBe(201);
    }
  });

  it('returns 400 for invalid project ID', async () => {
    const res = await fetch(`${baseUrl}/api/projects/notanumber/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fabricatorId: 'jlcpcb',
        boardSpec: { width: 50, height: 30 },
      }),
    });

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/projects/:projectId/orders/:orderId
// ---------------------------------------------------------------------------

describe('PUT /api/projects/:projectId/orders/:orderId', () => {
  it('updates an order', async () => {
    const existing = makeOrder();
    const updated = makeOrder({ quantity: 20 });
    mockGetOrder.mockResolvedValue(existing);
    mockUpdateOrder.mockResolvedValue(updated);

    const res = await fetch(`${baseUrl}/api/projects/1/orders/1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 20 }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.quantity).toBe(20);
    expect(mockUpdateOrder).toHaveBeenCalledWith(1, { quantity: 20 });
  });

  it('updates order status', async () => {
    const existing = makeOrder();
    const updated = makeOrder({ status: 'quoting' });
    mockGetOrder.mockResolvedValue(existing);
    mockUpdateOrder.mockResolvedValue(updated);

    const res = await fetch(`${baseUrl}/api/projects/1/orders/1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'quoting' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('quoting');
  });

  it('returns 404 when order not found', async () => {
    mockGetOrder.mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/projects/1/orders/999`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 10 }),
    });

    expect(res.status).toBe(404);
  });

  it('returns 404 when order belongs to different project', async () => {
    mockGetOrder.mockResolvedValue(makeOrder({ projectId: 2 }));

    const res = await fetch(`${baseUrl}/api/projects/1/orders/1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 10 }),
    });

    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid fabricatorId update', async () => {
    mockGetOrder.mockResolvedValue(makeOrder());

    const res = await fetch(`${baseUrl}/api/projects/1/orders/1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fabricatorId: 'fakefab' }),
    });

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid status update', async () => {
    mockGetOrder.mockResolvedValue(makeOrder());

    const res = await fetch(`${baseUrl}/api/projects/1/orders/1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'nonexistent_status' }),
    });

    expect(res.status).toBe(400);
  });

  it('updates tracking number', async () => {
    const existing = makeOrder({ status: 'shipped' });
    const updated = makeOrder({ status: 'shipped', trackingNumber: 'TRACK123' });
    mockGetOrder.mockResolvedValue(existing);
    mockUpdateOrder.mockResolvedValue(updated);

    const res = await fetch(`${baseUrl}/api/projects/1/orders/1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackingNumber: 'TRACK123' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trackingNumber).toBe('TRACK123');
  });

  it('updates notes', async () => {
    const existing = makeOrder();
    const updated = makeOrder({ notes: 'Updated note' });
    mockGetOrder.mockResolvedValue(existing);
    mockUpdateOrder.mockResolvedValue(updated);

    const res = await fetch(`${baseUrl}/api/projects/1/orders/1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'Updated note' }),
    });

    expect(res.status).toBe(200);
    expect((await res.json()).notes).toBe('Updated note');
  });
});

// ---------------------------------------------------------------------------
// POST /api/projects/:projectId/orders/:orderId/submit
// ---------------------------------------------------------------------------

describe('POST /api/projects/:projectId/orders/:orderId/submit', () => {
  it('submits an order in ready status', async () => {
    const existing = makeOrder({ status: 'ready' });
    const submitted = makeOrder({ status: 'submitted', submittedAt: NOW });
    mockGetOrder.mockResolvedValue(existing);
    mockUpdateOrder.mockResolvedValue(submitted);

    const res = await fetch(`${baseUrl}/api/projects/1/orders/1/submit`, {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('submitted');
    expect(mockUpdateOrder).toHaveBeenCalledTimes(1);
    const updateArgs = mockUpdateOrder.mock.calls[0];
    expect(updateArgs[0]).toBe(1);
    expect(updateArgs[1].status).toBe('submitted');
    expect(updateArgs[1].submittedAt).toBeInstanceOf(Date);
  });

  it('returns 400 when order is in draft status', async () => {
    mockGetOrder.mockResolvedValue(makeOrder({ status: 'draft' }));

    const res = await fetch(`${baseUrl}/api/projects/1/orders/1/submit`, {
      method: 'POST',
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('draft');
  });

  it('returns 400 when order is already submitted', async () => {
    mockGetOrder.mockResolvedValue(makeOrder({ status: 'submitted' }));

    const res = await fetch(`${baseUrl}/api/projects/1/orders/1/submit`, {
      method: 'POST',
    });

    expect(res.status).toBe(400);
  });

  it('returns 404 when order not found', async () => {
    mockGetOrder.mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/projects/1/orders/999/submit`, {
      method: 'POST',
    });

    expect(res.status).toBe(404);
  });

  it('returns 404 when order belongs to different project', async () => {
    mockGetOrder.mockResolvedValue(makeOrder({ status: 'ready', projectId: 2 }));

    const res = await fetch(`${baseUrl}/api/projects/1/orders/1/submit`, {
      method: 'POST',
    });

    expect(res.status).toBe(404);
  });

  it('rejects submit for each non-ready status', async () => {
    const nonReadyStatuses = ['draft', 'dfm-check', 'quoting', 'submitted', 'processing', 'shipped', 'delivered', 'error'];
    for (const status of nonReadyStatuses) {
      mockGetOrder.mockResolvedValue(makeOrder({ status }));
      const res = await fetch(`${baseUrl}/api/projects/1/orders/1/submit`, {
        method: 'POST',
      });
      expect(res.status).toBe(400);
    }
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/projects/:projectId/orders/:orderId
// ---------------------------------------------------------------------------

describe('DELETE /api/projects/:projectId/orders/:orderId', () => {
  it('deletes an order', async () => {
    mockGetOrder.mockResolvedValue(makeOrder());
    mockDeleteOrder.mockResolvedValue(true);

    const res = await fetch(`${baseUrl}/api/projects/1/orders/1`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(204);
    expect(mockDeleteOrder).toHaveBeenCalledWith(1);
  });

  it('returns 404 when order not found', async () => {
    mockGetOrder.mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/projects/1/orders/999`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(404);
  });

  it('returns 404 when order belongs to different project', async () => {
    mockGetOrder.mockResolvedValue(makeOrder({ projectId: 2 }));

    const res = await fetch(`${baseUrl}/api/projects/1/orders/1`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid order ID', async () => {
    const res = await fetch(`${baseUrl}/api/projects/1/orders/abc`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Schema / type validation edge cases
// ---------------------------------------------------------------------------

describe('Schema validation edge cases', () => {
  it('rejects quantity of zero', async () => {
    const res = await fetch(`${baseUrl}/api/projects/1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fabricatorId: 'jlcpcb',
        boardSpec: { width: 50, height: 30 },
        quantity: 0,
      }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects quantity exceeding max', async () => {
    const res = await fetch(`${baseUrl}/api/projects/1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fabricatorId: 'jlcpcb',
        boardSpec: { width: 50, height: 30 },
        quantity: 100001,
      }),
    });
    expect(res.status).toBe(400);
  });

  it('accepts boardSpec with arbitrary properties', async () => {
    mockCreateOrder.mockResolvedValue(makeOrder());
    const res = await fetch(`${baseUrl}/api/projects/1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fabricatorId: 'oshpark',
        boardSpec: {
          width: 50,
          height: 30,
          layers: 4,
          surfaceFinish: 'HASL',
          soldermaskColor: 'green',
          copperWeight: '1oz',
        },
      }),
    });
    expect(res.status).toBe(201);
  });

  it('handles null optional fields in create', async () => {
    mockCreateOrder.mockResolvedValue(makeOrder());
    const res = await fetch(`${baseUrl}/api/projects/1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fabricatorId: 'jlcpcb',
        boardSpec: { width: 50, height: 30 },
        quoteData: null,
        fabOrderNumber: null,
        trackingNumber: null,
        notes: null,
      }),
    });
    expect(res.status).toBe(201);
  });

  it('rejects empty body on create', async () => {
    const res = await fetch(`${baseUrl}/api/projects/1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});
