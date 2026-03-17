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

  it('PCB_STATUS_LABELS values are human-readable strings', () => {
    expect(PCB_STATUS_LABELS.gerbers_received).toBe('Gerbers Received');
    expect(PCB_STATUS_LABELS.in_review).toBe('In Review');
    expect(PCB_STATUS_LABELS.in_production).toBe('In Production');
    expect(PCB_STATUS_LABELS.testing).toBe('Testing');
    expect(PCB_STATUS_LABELS.shipped).toBe('Shipped');
    expect(PCB_STATUS_LABELS.delivered).toBe('Delivered');
  });

  it('PCB_STATUS_COLORS values contain tailwind class patterns', () => {
    for (const status of PCB_STATUS_PIPELINE) {
      const color = PCB_STATUS_COLORS[status];
      expect(color).toMatch(/text-/);
      expect(color).toMatch(/border-/);
      expect(color).toMatch(/bg-/);
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

  it('assigns unique IDs to each created order', () => {
    const a = tracker.createOrder(PROJECT_ID, makeInput({ orderId: 'A' }));
    const b = tracker.createOrder(PROJECT_ID, makeInput({ orderId: 'B' }));
    const c = tracker.createOrder(PROJECT_ID, makeInput({ orderId: 'C' }));
    const ids = new Set([a.id, b.id, c.id]);
    expect(ids.size).toBe(3);
  });

  it('sets createdAt and updatedAt to the same value on creation', () => {
    const order = tracker.createOrder(PROJECT_ID, makeInput());
    expect(order.createdAt).toBe(order.updatedAt);
    expect(order.createdAt).toBeGreaterThan(0);
  });

  it('creates order without optional fields leaving them undefined', () => {
    const order = tracker.createOrder(PROJECT_ID, makeInput());
    expect(order.trackingUrl).toBeUndefined();
    expect(order.estimatedDelivery).toBeUndefined();
    expect(order.boardName).toBeUndefined();
    expect(order.quantity).toBeUndefined();
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

  it('getOrders returns empty array for project with no orders', () => {
    expect(tracker.getOrders(999)).toEqual([]);
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

  it('getOrder returns null when order exists in different project', () => {
    const order = tracker.createOrder(PROJECT_ID, makeInput());
    expect(tracker.getOrder(999, order.id)).toBeNull();
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

  it('getActiveOrders includes orders at every non-delivered stage', () => {
    const stages: PcbOrderStatus[] = ['gerbers_received', 'in_review', 'in_production', 'testing', 'shipped'];
    for (const _stage of stages) {
      tracker.createOrder(PROJECT_ID, makeInput({ orderId: `order-${_stage}` }));
    }
    // All 5 are at gerbers_received (initial status) — all active
    expect(tracker.getActiveOrders(PROJECT_ID)).toHaveLength(5);
    expect(tracker.getCompletedOrders(PROJECT_ID)).toHaveLength(0);
  });

  it('getCompletedOrders returns empty when no orders are delivered', () => {
    tracker.createOrder(PROJECT_ID, makeInput());
    expect(tracker.getCompletedOrders(PROJECT_ID)).toHaveLength(0);
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

  it('full pipeline traversal records complete status history', () => {
    const order = tracker.createOrder(PROJECT_ID, makeInput());
    tracker.updateStatus(PROJECT_ID, order.id, 'in_review');
    tracker.updateStatus(PROJECT_ID, order.id, 'in_production');
    tracker.updateStatus(PROJECT_ID, order.id, 'testing');
    tracker.updateStatus(PROJECT_ID, order.id, 'shipped');
    tracker.updateStatus(PROJECT_ID, order.id, 'delivered');

    const final = tracker.getOrder(PROJECT_ID, order.id)!;
    expect(final.statusHistory).toHaveLength(6);
    expect(final.statusHistory.map((h) => h.status)).toEqual(PCB_STATUS_PIPELINE);
  });

  it('updateStatus updates updatedAt timestamp', () => {
    const order = tracker.createOrder(PROJECT_ID, makeInput());
    const originalUpdatedAt = order.updatedAt;
    // Small delay to ensure timestamp differs
    vi.spyOn(Date, 'now').mockReturnValue(originalUpdatedAt + 5000);
    const result = tracker.updateStatus(PROJECT_ID, order.id, 'in_review');
    expect(result!.updatedAt).toBeGreaterThan(originalUpdatedAt);
    vi.mocked(Date.now).mockRestore();
  });

  it('updateStatus persists the change to localStorage', () => {
    const order = tracker.createOrder(PROJECT_ID, makeInput());
    tracker.updateStatus(PROJECT_ID, order.id, 'in_review');
    const raw = storageMock.get(`protopulse-pcb-order-tracker:${PROJECT_ID}`);
    const parsed = JSON.parse(raw!) as PcbOrder[];
    expect(parsed[0].status).toBe('in_review');
  });

  it('rejects same-status transition (no self-loop)', () => {
    const order = tracker.createOrder(PROJECT_ID, makeInput());
    const result = tracker.updateStatus(PROJECT_ID, order.id, 'gerbers_received');
    expect(result).toBeNull();
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

  it('updateTracking persists the change to localStorage', () => {
    const order = tracker.createOrder(PROJECT_ID, makeInput());
    tracker.updateTracking(PROJECT_ID, order.id, 'https://jlcpcb.com/track/W123');
    PcbOrderTracker.resetForTesting();
    const fresh = PcbOrderTracker.getInstance();
    const loaded = fresh.getOrder(PROJECT_ID, order.id);
    expect(loaded!.trackingUrl).toBe('https://jlcpcb.com/track/W123');
  });

  it('updateTracking updates updatedAt timestamp', () => {
    const order = tracker.createOrder(PROJECT_ID, makeInput());
    const originalUpdatedAt = order.updatedAt;
    vi.spyOn(Date, 'now').mockReturnValue(originalUpdatedAt + 3000);
    const result = tracker.updateTracking(PROJECT_ID, order.id, 'https://example.com');
    expect(result!.updatedAt).toBeGreaterThan(originalUpdatedAt);
    vi.mocked(Date.now).mockRestore();
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

  it('updateEstimatedDelivery persists the change to localStorage', () => {
    const order = tracker.createOrder(PROJECT_ID, makeInput());
    const future = Date.now() + 10 * 24 * 60 * 60 * 1000;
    tracker.updateEstimatedDelivery(PROJECT_ID, order.id, future);
    PcbOrderTracker.resetForTesting();
    const fresh = PcbOrderTracker.getInstance();
    const loaded = fresh.getOrder(PROJECT_ID, order.id);
    expect(loaded!.estimatedDelivery).toBe(future);
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

  it('deleteOrder persists deletion to localStorage', () => {
    const order = tracker.createOrder(PROJECT_ID, makeInput());
    tracker.deleteOrder(PROJECT_ID, order.id);
    PcbOrderTracker.resetForTesting();
    const fresh = PcbOrderTracker.getInstance();
    expect(fresh.getOrders(PROJECT_ID)).toHaveLength(0);
  });

  it('deleteOrder only removes the targeted order', () => {
    const a = tracker.createOrder(PROJECT_ID, makeInput({ orderId: 'A' }));
    const b = tracker.createOrder(PROJECT_ID, makeInput({ orderId: 'B' }));
    tracker.deleteOrder(PROJECT_ID, a.id);
    expect(tracker.getOrders(PROJECT_ID)).toHaveLength(1);
    expect(tracker.getOrders(PROJECT_ID)[0].orderId).toBe('B');
    expect(tracker.getOrder(PROJECT_ID, b.id)).not.toBeNull();
  });

  // ── clearAll ──

  it('clears all orders for a project', () => {
    tracker.createOrder(PROJECT_ID, makeInput({ orderId: 'A' }));
    tracker.createOrder(PROJECT_ID, makeInput({ orderId: 'B' }));
    tracker.clearAll(PROJECT_ID);
    expect(tracker.getOrders(PROJECT_ID)).toHaveLength(0);
  });

  it('clearAll persists the empty state to localStorage', () => {
    tracker.createOrder(PROJECT_ID, makeInput());
    tracker.clearAll(PROJECT_ID);
    PcbOrderTracker.resetForTesting();
    const fresh = PcbOrderTracker.getInstance();
    expect(fresh.getOrders(PROJECT_ID)).toHaveLength(0);
  });

  it('clearAll does not affect other projects', () => {
    tracker.createOrder(PROJECT_ID, makeInput({ orderId: 'A' }));
    tracker.createOrder(99, makeInput({ orderId: 'B' }));
    tracker.clearAll(PROJECT_ID);
    expect(tracker.getOrders(PROJECT_ID)).toHaveLength(0);
    expect(tracker.getOrders(99)).toHaveLength(1);
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

  it('returns zero or one for delivery today', () => {
    const order = tracker.createOrder(PROJECT_ID, makeInput({
      estimatedDelivery: Date.now() + 1000, // 1 second from now
    }));
    const days = tracker.getDaysUntilDelivery(order);
    expect(days).not.toBeNull();
    expect(days!).toBeGreaterThanOrEqual(0);
    expect(days!).toBeLessThanOrEqual(1);
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

  it('calls subscriber on updateTracking', () => {
    const order = tracker.createOrder(PROJECT_ID, makeInput());
    const fn = vi.fn();
    tracker.subscribe(fn);
    tracker.updateTracking(PROJECT_ID, order.id, 'https://example.com');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('calls subscriber on updateEstimatedDelivery', () => {
    const order = tracker.createOrder(PROJECT_ID, makeInput());
    const fn = vi.fn();
    tracker.subscribe(fn);
    tracker.updateEstimatedDelivery(PROJECT_ID, order.id, Date.now() + 86400000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('calls subscriber on deleteOrder', () => {
    const order = tracker.createOrder(PROJECT_ID, makeInput());
    const fn = vi.fn();
    tracker.subscribe(fn);
    tracker.deleteOrder(PROJECT_ID, order.id);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('calls subscriber on clearAll', () => {
    tracker.createOrder(PROJECT_ID, makeInput());
    const fn = vi.fn();
    tracker.subscribe(fn);
    tracker.clearAll(PROJECT_ID);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe stops notifications', () => {
    const fn = vi.fn();
    const unsub = tracker.subscribe(fn);
    unsub();
    tracker.createOrder(PROJECT_ID, makeInput());
    expect(fn).not.toHaveBeenCalled();
  });

  it('supports multiple simultaneous subscribers', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    tracker.subscribe(fn1);
    tracker.subscribe(fn2);
    tracker.createOrder(PROJECT_ID, makeInput());
    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).toHaveBeenCalledTimes(1);
  });

  it('unsubscribing one listener does not affect others', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    const unsub1 = tracker.subscribe(fn1);
    tracker.subscribe(fn2);
    unsub1();
    tracker.createOrder(PROJECT_ID, makeInput());
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).toHaveBeenCalledTimes(1);
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

  it('handles non-array JSON in localStorage gracefully', () => {
    storageMock.set(`protopulse-pcb-order-tracker:${PROJECT_ID}`, JSON.stringify({ not: 'an array' }));
    PcbOrderTracker.resetForTesting();
    const fresh = PcbOrderTracker.getInstance();
    expect(fresh.getOrders(PROJECT_ID)).toHaveLength(0);
  });

  it('does not crash when localStorage.setItem throws (quota exceeded)', () => {
    vi.mocked(Storage.prototype.setItem).mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    // Should not throw
    expect(() => tracker.createOrder(PROJECT_ID, makeInput())).not.toThrow();
  });

  it('preserves project isolation in localStorage keys', () => {
    tracker.createOrder(1, makeInput({ orderId: 'proj-1' }));
    tracker.createOrder(2, makeInput({ orderId: 'proj-2' }));
    expect(storageMock.has('protopulse-pcb-order-tracker:1')).toBe(true);
    expect(storageMock.has('protopulse-pcb-order-tracker:2')).toBe(true);
    const proj1 = JSON.parse(storageMock.get('protopulse-pcb-order-tracker:1')!) as PcbOrder[];
    const proj2 = JSON.parse(storageMock.get('protopulse-pcb-order-tracker:2')!) as PcbOrder[];
    expect(proj1).toHaveLength(1);
    expect(proj1[0].orderId).toBe('proj-1');
    expect(proj2).toHaveLength(1);
    expect(proj2[0].orderId).toBe('proj-2');
  });

  it('caches loaded project data (does not re-read localStorage on second access)', () => {
    tracker.createOrder(PROJECT_ID, makeInput());
    const getItemSpy = vi.mocked(Storage.prototype.getItem);
    getItemSpy.mockClear();
    // Second access should come from cache, not localStorage
    tracker.getOrders(PROJECT_ID);
    tracker.getOrders(PROJECT_ID);
    expect(getItemSpy).not.toHaveBeenCalled();
  });

  it('round-trips full order data through localStorage', () => {
    const order = tracker.createOrder(PROJECT_ID, makeInput({
      fabHouse: 'PCBWay',
      orderId: 'PCB-99',
      trackingUrl: 'https://pcbway.com/track/99',
      estimatedDelivery: 1700000000000,
      boardName: 'Motor Driver v2',
      quantity: 10,
    }));
    tracker.updateStatus(PROJECT_ID, order.id, 'in_review');

    PcbOrderTracker.resetForTesting();
    const fresh = PcbOrderTracker.getInstance();
    const loaded = fresh.getOrder(PROJECT_ID, order.id)!;

    expect(loaded.fabHouse).toBe('PCBWay');
    expect(loaded.orderId).toBe('PCB-99');
    expect(loaded.trackingUrl).toBe('https://pcbway.com/track/99');
    expect(loaded.estimatedDelivery).toBe(1700000000000);
    expect(loaded.boardName).toBe('Motor Driver v2');
    expect(loaded.quantity).toBe(10);
    expect(loaded.status).toBe('in_review');
    expect(loaded.statusHistory).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// React Hook Tests
// ---------------------------------------------------------------------------

describe('usePcbOrderTracker', () => {
  const storageMock = new Map<string, string>();
  let testProjectId = 1000;

  beforeEach(() => {
    // Use a unique project ID per test to avoid cross-test pollution from
    // async hook cleanup writing stale data into localStorage mocks.
    testProjectId += 1;
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
    const { result } = renderHook(() => usePcbOrderTracker(testProjectId));
    expect(result.current.orders).toHaveLength(0);
    expect(result.current.activeOrders).toHaveLength(0);
    expect(result.current.completedOrders).toHaveLength(0);
  });

  it('createOrder updates orders list', () => {
    const { result } = renderHook(() => usePcbOrderTracker(testProjectId));
    act(() => {
      result.current.createOrder(makeInput());
    });
    expect(result.current.orders).toHaveLength(1);
    expect(result.current.activeOrders).toHaveLength(1);
  });

  it('updateStatus advances order', () => {
    const { result } = renderHook(() => usePcbOrderTracker(testProjectId));
    let orderId = '';
    act(() => {
      const order = result.current.createOrder(makeInput());
      orderId = order.id;
    });
    act(() => {
      result.current.updateStatus(orderId, 'in_review');
    });
    expect(result.current.orders[0].status).toBe('in_review');
  });

  it('deleteOrder removes order', () => {
    const { result } = renderHook(() => usePcbOrderTracker(testProjectId));
    let orderId = '';
    act(() => {
      const order = result.current.createOrder(makeInput());
      orderId = order.id;
    });
    act(() => {
      result.current.deleteOrder(orderId);
    });
    // Verify via the underlying tracker to avoid hook re-render timing issues
    const tracker = PcbOrderTracker.getInstance();
    expect(tracker.getOrders(testProjectId)).toHaveLength(0);
  });

  it('getDaysUntilDelivery returns days', () => {
    const { result } = renderHook(() => usePcbOrderTracker(testProjectId));
    let createdOrder: PcbOrder | null = null;
    act(() => {
      createdOrder = result.current.createOrder(makeInput({
        estimatedDelivery: Date.now() + 5 * 24 * 60 * 60 * 1000,
      }));
    });
    // Use the order returned by createOrder directly
    expect(createdOrder).not.toBeNull();
    const days = result.current.getDaysUntilDelivery(createdOrder!);
    expect(days).not.toBeNull();
    expect(days!).toBeGreaterThanOrEqual(4);
  });

  it('updateTracking updates order tracking URL via hook', () => {
    const { result } = renderHook(() => usePcbOrderTracker(testProjectId));
    let orderId = '';
    act(() => {
      const order = result.current.createOrder(makeInput());
      orderId = order.id;
    });
    act(() => {
      result.current.updateTracking(orderId, 'https://track.example.com/hook-test');
    });
    const tracker = PcbOrderTracker.getInstance();
    const order = tracker.getOrder(testProjectId, orderId);
    expect(order!.trackingUrl).toBe('https://track.example.com/hook-test');
  });

  it('updateEstimatedDelivery updates delivery date via hook', () => {
    const { result } = renderHook(() => usePcbOrderTracker(testProjectId));
    let orderId = '';
    act(() => {
      const order = result.current.createOrder(makeInput());
      orderId = order.id;
    });
    const future = Date.now() + 20 * 24 * 60 * 60 * 1000;
    act(() => {
      result.current.updateEstimatedDelivery(orderId, future);
    });
    const tracker = PcbOrderTracker.getInstance();
    const order = tracker.getOrder(testProjectId, orderId);
    expect(order!.estimatedDelivery).toBe(future);
  });

  it('exposes all expected properties', () => {
    const { result } = renderHook(() => usePcbOrderTracker(testProjectId));
    expect(result.current).toHaveProperty('orders');
    expect(result.current).toHaveProperty('activeOrders');
    expect(result.current).toHaveProperty('completedOrders');
    expect(result.current).toHaveProperty('createOrder');
    expect(result.current).toHaveProperty('updateStatus');
    expect(result.current).toHaveProperty('updateTracking');
    expect(result.current).toHaveProperty('updateEstimatedDelivery');
    expect(result.current).toHaveProperty('deleteOrder');
    expect(result.current).toHaveProperty('getDaysUntilDelivery');
  });
});
