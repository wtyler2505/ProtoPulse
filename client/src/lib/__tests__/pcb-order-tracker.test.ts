import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  PcbOrderTracker,
  PCB_STATUS_PIPELINE,
  PCB_STATUS_LABELS,
  PCB_STATUS_COLORS,
  usePcbOrderTracker,
} from '../pcb-order-tracker';
import type {
  PcbOrderStatus,
  PcbOrder,
  CreatePcbOrderInput,
} from '../pcb-order-tracker';
import { renderHook, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROJECT_ID = 42;

function makeInput(overrides: Partial<CreatePcbOrderInput> = {}): CreatePcbOrderInput {
  return {
    fabHouse: 'JLCPCB',
    orderId: 'W202603150001',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Unit Tests — PcbOrderTracker
// ---------------------------------------------------------------------------

describe('PcbOrderTracker', () => {
  let tracker: PcbOrderTracker;
  const storageMock = new Map<string, string>();

  beforeEach(() => {
    PcbOrderTracker.resetForTesting();
    storageMock.clear();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => storageMock.get(key) ?? null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
      storageMock.set(key, value);
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key: string) => {
      storageMock.delete(key);
    });
    tracker = PcbOrderTracker.getInstance();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Singleton ──

  it('returns the same instance on repeated calls', () => {
    const a = PcbOrderTracker.getInstance();
    const b = PcbOrderTracker.getInstance();
    expect(a).toBe(b);
  });

  it('resetForTesting creates a new instance', () => {
    const a = PcbOrderTracker.getInstance();
    PcbOrderTracker.resetForTesting();
    const b = PcbOrderTracker.getInstance();
    expect(a).not.toBe(b);
  });

  // ── Constants ──

  it('PCB_STATUS_PIPELINE has 6 stages in order', () => {
    expect(PCB_STATUS_PIPELINE).toEqual([
      'gerbers_received',
      'in_review',
      'in_production',
      'testing',
      'shipped',
      'delivered',
    ]);
  });

  it('PCB_STATUS_LABELS has a label for every status', () => {
    for (const status of PCB_STATUS_PIPELINE) {
      expect(PCB_STATUS_LABELS[status]).toBeTruthy();
    }
  });

  it('PCB_STATUS_COLORS has a color class for every status', () => {
    for (const status of PCB_STATUS_PIPELINE) {
      expect(PCB_STATUS_COLORS[status]).toBeTruthy();
    }
  });

  // ── createOrder ──

  it('creates an order with gerbers_received status', () => {
    const order = tracker.createOrder(PROJECT_ID, makeInput());
    expect(order.status).toBe('gerbers_received');
    expect(order.fabHouse).toBe('JLCPCB');
    expect(order.orderId).toBe('W202603150001');
    expect(order.id).toBeTruthy();
    expect(order.statusHistory).toHaveLength(1);
    expect(order.statusHistory[0].status).toBe('gerbers_received');
  });

  it('persists created order to localStorage', () => {
    tracker.createOrder(PROJECT_ID, makeInput());
    const raw = storageMock.get(`protopulse-pcb-order-tracker:${PROJECT_ID}`);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveLength(1);
  });

  it('creates order with optional fields', () => {
    const order = tracker.createOrder(PROJECT_ID, makeInput({
      trackingUrl: 'https://track.example.com/123',
      estimatedDelivery: Date.now() + 7 * 24 * 60 * 60 * 1000,
      boardName: 'Main Controller Board',
      quantity: 5,
    }));
    expect(order.trackingUrl).toBe('https://track.example.com/123');
    expect(order.estimatedDelivery).toBeGreaterThan(Date.now());
    expect(order.boardName).toBe('Main Controller Board');
    expect(order.quantity).toBe(5);
  });

  // ── getOrders / getOrder ──

  it('getOrders returns all orders for a project', () => {
    tracker.createOrder(PROJECT_ID, makeInput({ orderId: 'A' }));
    tracker.createOrder(PROJECT_ID, makeInput({ orderId: 'B' }));
    tracker.createOrder(99, makeInput({ orderId: 'C' }));
    expect(tracker.getOrders(PROJECT_ID)).toHaveLength(2);
    expect(tracker.getOrders(99)).toHaveLength(1);
  });

  it('getOrders returns a copy (not a reference)', () => {
    tracker.createOrder(PROJECT_ID, makeInput());
    const a = tracker.getOrders(PROJECT_ID);
    const b = tracker.getOrders(PROJECT_ID);
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('getOrder finds order by id', () => {
    const created = tracker.createOrder(PROJECT_ID, makeInput());
    const found = tracker.getOrder(PROJECT_ID, created.id);
    expect(found).not.toBeNull();
    expect(found!.orderId).toBe('W202603150001');
  });

  it('getOrder returns null for non-existent order', () => {
    expect(tracker.getOrder(PROJECT_ID, 'nonexistent')).toBeNull();
  });

  // ── getActiveOrders / getCompletedOrders ──

  it('getActiveOrders excludes delivered orders', () => {
    const order = tracker.createOrder(PROJECT_ID, makeInput());
    expect(tracker.getActiveOrders(PROJECT_ID)).toHaveLength(1);

    // Advance through all stages to delivered
    tracker.updateStatus(PROJECT_ID, order.id, 'in_review');
    tracker.updateStatus(PROJECT_ID, order.id, 'in_production');
    tracker.updateStatus(PROJECT_ID, order.id, 'testing');
    tracker.updateStatus(PROJECT_ID, order.id, 'shipped');
    tracker.updateStatus(PROJECT_ID, order.id, 'delivered');

    expect(tracker.getActiveOrders(PROJECT_ID)).toHaveLength(0);
    expect(tracker.getCompletedOrders(PROJECT_ID)).toHaveLength(1);
  });

  // ── updateStatus ──

  it('advances status through the pipeline', () => {
    const order = tracker.createOrder(PROJECT_ID, makeInput());
    const result = tracker.updateStatus(PROJECT_ID, order.id, 'in_review');
    expect(result).not.toBeNull();
    expect(result!.status).toBe('in_review');
    expect(result!.statusHistory).toHaveLength(2);
  });

  it('records note in status history', () => {
    const order = tracker.createOrder(PROJECT_ID, makeInput());
    tracker.updateStatus(PROJECT_ID, order.id, 'in_review', 'Gerber files validated');
    const updated = tracker.getOrder(PROJECT_ID, order.id);
    expect(updated!.statusHistory[1].note).toBe('Gerber files validated');
  });

  it('rejects invalid status transition (skipping stages)', () => {
    const order = tracker.createOrder(PROJECT_ID, makeInput());
    // Skip from gerbers_received directly to in_production
    const result = tracker.updateStatus(PROJECT_ID, order.id, 'in_production');
    expect(result).toBeNull();
    expect(tracker.getOrder(PROJECT_ID, order.id)!.status).toBe('gerbers_received');
  });

  it('rejects backward status transition', () => {
    const order = tracker.createOrder(PROJECT_ID, makeInput());
    tracker.updateStatus(PROJECT_ID, order.id, 'in_review');
    const result = tracker.updateStatus(PROJECT_ID, order.id, 'gerbers_received');
    expect(result).toBeNull();
  });

  it('rejects update for non-existent order', () => {
    const result = tracker.updateStatus(PROJECT_ID, 'fake-id', 'in_review');
    expect(result).toBeNull();
  });

  it('delivered status has no valid transitions', () => {
    const order = tracker.createOrder(PROJECT_ID, makeInput());
    tracker.updateStatus(PROJECT_ID, order.id, 'in_review');
    tracker.updateStatus(PROJECT_ID, order.id, 'in_production');
    tracker.updateStatus(PROJECT_ID, order.id, 'testing');
    tracker.updateStatus(PROJECT_ID, order.id, 'shipped');
    tracker.updateStatus(PROJECT_ID, order.id, 'delivered');

    // Try to advance past delivered
    for (const status of PCB_STATUS_PIPELINE) {
      const result = tracker.updateStatus(PROJECT_ID, order.id, status);
      expect(result).toBeNull();
    }
  });

  // ── updateTracking ──

  it('updates tracking URL', () => {
    const order = tracker.createOrder(PROJECT_ID, makeInput());
    const result = tracker.updateTracking(PROJECT_ID, order.id, 'https://track.example.com/456');
    expect(result).not.toBeNull();
    expect(result!.trackingUrl).toBe('https://track.example.com/456');
  });

  it('returns null for non-existent order tracking update', () => {
    expect(tracker.updateTracking(PROJECT_ID, 'fake', 'https://x.com')).toBeNull();
  });

  // ── updateEstimatedDelivery ──

  it('updates estimated delivery date', () => {
    const order = tracker.createOrder(PROJECT_ID, makeInput());
    const future = Date.now() + 14 * 24 * 60 * 60 * 1000;
    const result = tracker.updateEstimatedDelivery(PROJECT_ID, order.id, future);
    expect(result).not.toBeNull();
    expect(result!.estimatedDelivery).toBe(future);
  });

  it('returns null for non-existent order delivery update', () => {
    expect(tracker.updateEstimatedDelivery(PROJECT_ID, 'fake', Date.now())).toBeNull();
  });

  // ── deleteOrder ──

  it('deletes an order', () => {
    const order = tracker.createOrder(PROJECT_ID, makeInput());
    expect(tracker.deleteOrder(PROJECT_ID, order.id)).toBe(true);
    expect(tracker.getOrders(PROJECT_ID)).toHaveLength(0);
  });

  it('returns false when deleting non-existent order', () => {
    expect(tracker.deleteOrder(PROJECT_ID, 'nonexistent')).toBe(false);
  });

  // ── clearAll ──

  it('clears all orders for a project', () => {
    tracker.createOrder(PROJECT_ID, makeInput({ orderId: 'A' }));
    tracker.createOrder(PROJECT_ID, makeInput({ orderId: 'B' }));
    tracker.clearAll(PROJECT_ID);
    expect(tracker.getOrders(PROJECT_ID)).toHaveLength(0);
  });

  // ── getStatusIndex ──

  it('returns correct pipeline index for each status', () => {
    expect(tracker.getStatusIndex('gerbers_received')).toBe(0);
    expect(tracker.getStatusIndex('in_review')).toBe(1);
    expect(tracker.getStatusIndex('in_production')).toBe(2);
    expect(tracker.getStatusIndex('testing')).toBe(3);
    expect(tracker.getStatusIndex('shipped')).toBe(4);
    expect(tracker.getStatusIndex('delivered')).toBe(5);
  });

  // ── getDaysUntilDelivery ──

  it('returns null when no estimated delivery set', () => {
    const order = tracker.createOrder(PROJECT_ID, makeInput());
    expect(tracker.getDaysUntilDelivery(order)).toBeNull();
  });

  it('returns positive days for future delivery', () => {
    const order = tracker.createOrder(PROJECT_ID, makeInput({
      estimatedDelivery: Date.now() + 7 * 24 * 60 * 60 * 1000,
    }));
    const days = tracker.getDaysUntilDelivery(order);
    expect(days).not.toBeNull();
    expect(days!).toBeGreaterThanOrEqual(6);
    expect(days!).toBeLessThanOrEqual(8);
  });

  it('returns negative days for past delivery', () => {
    const order = tracker.createOrder(PROJECT_ID, makeInput({
      estimatedDelivery: Date.now() - 3 * 24 * 60 * 60 * 1000,
    }));
    const days = tracker.getDaysUntilDelivery(order);
    expect(days).not.toBeNull();
    expect(days!).toBeLessThanOrEqual(-2);
  });

  // ── Subscribe / notify ──

  it('calls subscriber on createOrder', () => {
    const fn = vi.fn();
    tracker.subscribe(fn);
    tracker.createOrder(PROJECT_ID, makeInput());
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('calls subscriber on updateStatus', () => {
    const order = tracker.createOrder(PROJECT_ID, makeInput());
    const fn = vi.fn();
    tracker.subscribe(fn);
    tracker.updateStatus(PROJECT_ID, order.id, 'in_review');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe stops notifications', () => {
    const fn = vi.fn();
    const unsub = tracker.subscribe(fn);
    unsub();
    tracker.createOrder(PROJECT_ID, makeInput());
    expect(fn).not.toHaveBeenCalled();
  });

  // ── Persistence round-trip ──

  it('loads orders from localStorage on fresh instance', () => {
    tracker.createOrder(PROJECT_ID, makeInput());
    PcbOrderTracker.resetForTesting();
    const fresh = PcbOrderTracker.getInstance();
    expect(fresh.getOrders(PROJECT_ID)).toHaveLength(1);
  });

  it('handles corrupted localStorage gracefully', () => {
    storageMock.set(`protopulse-pcb-order-tracker:${PROJECT_ID}`, '{invalid json');
    PcbOrderTracker.resetForTesting();
    const fresh = PcbOrderTracker.getInstance();
    expect(fresh.getOrders(PROJECT_ID)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// React Hook Tests
// ---------------------------------------------------------------------------

describe('usePcbOrderTracker', () => {
  const storageMock = new Map<string, string>();

  beforeEach(() => {
    PcbOrderTracker.resetForTesting();
    storageMock.clear();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => storageMock.get(key) ?? null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
      storageMock.set(key, value);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty orders initially', () => {
    const { result } = renderHook(() => usePcbOrderTracker(PROJECT_ID));
    expect(result.current.orders).toHaveLength(0);
    expect(result.current.activeOrders).toHaveLength(0);
    expect(result.current.completedOrders).toHaveLength(0);
  });

  it('createOrder updates orders list', () => {
    const { result } = renderHook(() => usePcbOrderTracker(PROJECT_ID));
    act(() => {
      result.current.createOrder(makeInput());
    });
    expect(result.current.orders).toHaveLength(1);
    expect(result.current.activeOrders).toHaveLength(1);
  });

  it('updateStatus advances order', () => {
    const { result } = renderHook(() => usePcbOrderTracker(PROJECT_ID));
    let orderId: string;
    act(() => {
      const order = result.current.createOrder(makeInput());
      orderId = order.id;
    });
    act(() => {
      result.current.updateStatus(orderId!, 'in_review');
    });
    expect(result.current.orders[0].status).toBe('in_review');
  });

  it('deleteOrder removes order', () => {
    const { result } = renderHook(() => usePcbOrderTracker(PROJECT_ID));
    let orderId: string;
    act(() => {
      const order = result.current.createOrder(makeInput());
      orderId = order.id;
    });
    act(() => {
      result.current.deleteOrder(orderId!);
    });
    expect(result.current.orders).toHaveLength(0);
  });

  it('getDaysUntilDelivery returns days', () => {
    const { result } = renderHook(() => usePcbOrderTracker(PROJECT_ID));
    act(() => {
      result.current.createOrder(makeInput({
        estimatedDelivery: Date.now() + 5 * 24 * 60 * 60 * 1000,
      }));
    });
    const days = result.current.getDaysUntilDelivery(result.current.orders[0]);
    expect(days).not.toBeNull();
    expect(days!).toBeGreaterThanOrEqual(4);
  });
});
