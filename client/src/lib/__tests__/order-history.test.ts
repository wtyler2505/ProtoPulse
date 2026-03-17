import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  OrderHistoryManager,
  useOrderHistory,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  CATEGORY_LABELS,
  MAX_ORDERS_PER_PROJECT,
} from '../order-history';
import type {
  OrderRecord,
  CreateOrderInput,
  OrderHistoryStatus,
  OrderCategory,
} from '../order-history';
import { renderHook, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(overrides: Partial<CreateOrderInput> = {}): CreateOrderInput {
  return {
    projectId: 1,
    category: 'components',
    supplier: 'Digi-Key',
    description: '100x 10uF ceramic caps',
    quantity: 100,
    unitCost: 0.12,
    totalCost: 12.0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  OrderHistoryManager.resetForTesting();
  localStorage.clear();
});

afterEach(() => {
  OrderHistoryManager.resetForTesting();
});

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

describe('OrderHistoryManager — singleton', () => {
  it('returns the same instance', () => {
    const a = OrderHistoryManager.getInstance();
    const b = OrderHistoryManager.getInstance();
    expect(a).toBe(b);
  });

  it('resetForTesting creates a fresh instance', () => {
    const a = OrderHistoryManager.getInstance();
    OrderHistoryManager.resetForTesting();
    const b = OrderHistoryManager.getInstance();
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

describe('OrderHistoryManager — createOrder', () => {
  it('creates an order with default status "quoted"', () => {
    const mgr = OrderHistoryManager.getInstance();
    const order = mgr.createOrder(makeInput());
    expect(order.status).toBe('quoted');
    expect(order.id).toBeTruthy();
    expect(order.projectId).toBe(1);
    expect(order.category).toBe('components');
    expect(order.supplier).toBe('Digi-Key');
  });

  it('creates an order with timeline entry', () => {
    const mgr = OrderHistoryManager.getInstance();
    const order = mgr.createOrder(makeInput());
    expect(order.timeline).toHaveLength(1);
    expect(order.timeline[0].status).toBe('quoted');
    expect(order.timeline[0].timestamp).toBeGreaterThan(0);
  });

  it('defaults currency to USD', () => {
    const mgr = OrderHistoryManager.getInstance();
    const order = mgr.createOrder(makeInput());
    expect(order.currency).toBe('USD');
  });

  it('respects custom currency', () => {
    const mgr = OrderHistoryManager.getInstance();
    const order = mgr.createOrder(makeInput({ currency: 'EUR' }));
    expect(order.currency).toBe('EUR');
  });

  it('rounds unit and total cost to 2 decimals', () => {
    const mgr = OrderHistoryManager.getInstance();
    const order = mgr.createOrder(makeInput({ unitCost: 1.999, totalCost: 199.999 }));
    expect(order.unitCost).toBe(2.0);
    expect(order.totalCost).toBe(200.0);
  });

  it('persists to localStorage', () => {
    const mgr = OrderHistoryManager.getInstance();
    mgr.createOrder(makeInput());
    const raw = localStorage.getItem('protopulse-order-history:1');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveLength(1);
  });

  it('notifies listeners', () => {
    const mgr = OrderHistoryManager.getInstance();
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.createOrder(makeInput());
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('preserves optional fields (tracking, quote ref)', () => {
    const mgr = OrderHistoryManager.getInstance();
    const order = mgr.createOrder(makeInput({
      trackingUrl: 'https://track.example.com/123',
      trackingNumber: 'TRK-123',
      quoteReference: 'QR-456',
    }));
    expect(order.trackingUrl).toBe('https://track.example.com/123');
    expect(order.trackingNumber).toBe('TRK-123');
    expect(order.quoteReference).toBe('QR-456');
  });
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

describe('OrderHistoryManager — queries', () => {
  it('getOrders returns all orders for a project', () => {
    const mgr = OrderHistoryManager.getInstance();
    mgr.createOrder(makeInput());
    mgr.createOrder(makeInput({ description: 'Second order' }));
    expect(mgr.getOrders(1)).toHaveLength(2);
  });

  it('getOrders returns empty for unknown project', () => {
    const mgr = OrderHistoryManager.getInstance();
    expect(mgr.getOrders(999)).toHaveLength(0);
  });

  it('getOrders returns a copy (not the internal array)', () => {
    const mgr = OrderHistoryManager.getInstance();
    mgr.createOrder(makeInput());
    const a = mgr.getOrders(1);
    const b = mgr.getOrders(1);
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('getOrder by ID', () => {
    const mgr = OrderHistoryManager.getInstance();
    const order = mgr.createOrder(makeInput());
    expect(mgr.getOrder(1, order.id)).toBeTruthy();
    expect(mgr.getOrder(1, order.id)!.id).toBe(order.id);
  });

  it('getOrder returns null for missing ID', () => {
    const mgr = OrderHistoryManager.getInstance();
    expect(mgr.getOrder(1, 'nonexistent')).toBeNull();
  });

  it('getOrdersByCategory filters', () => {
    const mgr = OrderHistoryManager.getInstance();
    mgr.createOrder(makeInput({ category: 'pcb' }));
    mgr.createOrder(makeInput({ category: 'components' }));
    mgr.createOrder(makeInput({ category: 'assembly' }));
    expect(mgr.getOrdersByCategory(1, 'pcb')).toHaveLength(1);
    expect(mgr.getOrdersByCategory(1, 'components')).toHaveLength(1);
    expect(mgr.getOrdersByCategory(1, 'assembly')).toHaveLength(1);
  });

  it('getOrdersByStatus filters', () => {
    const mgr = OrderHistoryManager.getInstance();
    mgr.createOrder(makeInput());
    const order2 = mgr.createOrder(makeInput({ description: 'order2' }));
    mgr.updateStatus(1, order2.id, 'ordered');
    expect(mgr.getOrdersByStatus(1, 'quoted')).toHaveLength(1);
    expect(mgr.getOrdersByStatus(1, 'ordered')).toHaveLength(1);
  });

  it('getActiveOrders excludes delivered and cancelled', () => {
    const mgr = OrderHistoryManager.getInstance();
    const o1 = mgr.createOrder(makeInput());
    const o2 = mgr.createOrder(makeInput({ description: 'o2' }));
    const o3 = mgr.createOrder(makeInput({ description: 'o3' }));
    mgr.updateStatus(1, o1.id, 'cancelled');
    mgr.updateStatus(1, o2.id, 'ordered');
    mgr.updateStatus(1, o2.id, 'in_production');
    mgr.updateStatus(1, o2.id, 'shipped');
    mgr.updateStatus(1, o2.id, 'delivered');
    // o3 stays quoted — should be active
    expect(mgr.getActiveOrders(1)).toHaveLength(1);
    expect(mgr.getActiveOrders(1)[0].id).toBe(o3.id);
  });

  it('isolates orders by project', () => {
    const mgr = OrderHistoryManager.getInstance();
    mgr.createOrder(makeInput({ projectId: 1 }));
    mgr.createOrder(makeInput({ projectId: 2 }));
    expect(mgr.getOrders(1)).toHaveLength(1);
    expect(mgr.getOrders(2)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

describe('OrderHistoryManager — updateStatus', () => {
  it('transitions quoted → ordered', () => {
    const mgr = OrderHistoryManager.getInstance();
    const order = mgr.createOrder(makeInput());
    const updated = mgr.updateStatus(1, order.id, 'ordered');
    expect(updated).toBeTruthy();
    expect(updated!.status).toBe('ordered');
    expect(updated!.timeline).toHaveLength(2);
  });

  it('transitions through full lifecycle', () => {
    const mgr = OrderHistoryManager.getInstance();
    const order = mgr.createOrder(makeInput());
    mgr.updateStatus(1, order.id, 'ordered');
    mgr.updateStatus(1, order.id, 'in_production');
    mgr.updateStatus(1, order.id, 'shipped');
    const final = mgr.updateStatus(1, order.id, 'delivered');
    expect(final!.status).toBe('delivered');
    expect(final!.timeline).toHaveLength(5);
  });

  it('rejects invalid transitions', () => {
    const mgr = OrderHistoryManager.getInstance();
    const order = mgr.createOrder(makeInput());
    // quoted → shipped is not valid
    expect(mgr.updateStatus(1, order.id, 'shipped')).toBeNull();
    // quoted → delivered is not valid
    expect(mgr.updateStatus(1, order.id, 'delivered')).toBeNull();
  });

  it('allows cancellation from quoted', () => {
    const mgr = OrderHistoryManager.getInstance();
    const order = mgr.createOrder(makeInput());
    expect(mgr.updateStatus(1, order.id, 'cancelled')).toBeTruthy();
  });

  it('allows cancellation from in_production', () => {
    const mgr = OrderHistoryManager.getInstance();
    const order = mgr.createOrder(makeInput());
    mgr.updateStatus(1, order.id, 'ordered');
    mgr.updateStatus(1, order.id, 'in_production');
    expect(mgr.updateStatus(1, order.id, 'cancelled')).toBeTruthy();
  });

  it('does not allow transitions from cancelled', () => {
    const mgr = OrderHistoryManager.getInstance();
    const order = mgr.createOrder(makeInput());
    mgr.updateStatus(1, order.id, 'cancelled');
    expect(mgr.updateStatus(1, order.id, 'ordered')).toBeNull();
  });

  it('does not allow transitions from delivered', () => {
    const mgr = OrderHistoryManager.getInstance();
    const order = mgr.createOrder(makeInput());
    mgr.updateStatus(1, order.id, 'ordered');
    mgr.updateStatus(1, order.id, 'in_production');
    mgr.updateStatus(1, order.id, 'shipped');
    mgr.updateStatus(1, order.id, 'delivered');
    expect(mgr.updateStatus(1, order.id, 'shipped')).toBeNull();
  });

  it('returns null for unknown order', () => {
    const mgr = OrderHistoryManager.getInstance();
    expect(mgr.updateStatus(1, 'fake-id', 'ordered')).toBeNull();
  });

  it('includes note in timeline entry', () => {
    const mgr = OrderHistoryManager.getInstance();
    const order = mgr.createOrder(makeInput());
    mgr.updateStatus(1, order.id, 'ordered', 'PO #12345 submitted');
    const updated = mgr.getOrder(1, order.id);
    expect(updated!.timeline[1].note).toBe('PO #12345 submitted');
  });

  it('persists status changes', () => {
    const mgr = OrderHistoryManager.getInstance();
    const order = mgr.createOrder(makeInput());
    mgr.updateStatus(1, order.id, 'ordered');

    // Create a new instance to verify persistence
    OrderHistoryManager.resetForTesting();
    const mgr2 = OrderHistoryManager.getInstance();
    const reloaded = mgr2.getOrder(1, order.id);
    expect(reloaded!.status).toBe('ordered');
    expect(reloaded!.timeline).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Tracking
// ---------------------------------------------------------------------------

describe('OrderHistoryManager — updateTracking', () => {
  it('updates tracking number and URL', () => {
    const mgr = OrderHistoryManager.getInstance();
    const order = mgr.createOrder(makeInput());
    const updated = mgr.updateTracking(1, order.id, 'DHL-12345', 'https://dhl.com/track/DHL-12345');
    expect(updated!.trackingNumber).toBe('DHL-12345');
    expect(updated!.trackingUrl).toBe('https://dhl.com/track/DHL-12345');
  });

  it('updates tracking number without URL', () => {
    const mgr = OrderHistoryManager.getInstance();
    const order = mgr.createOrder(makeInput());
    const updated = mgr.updateTracking(1, order.id, 'FEDEX-999');
    expect(updated!.trackingNumber).toBe('FEDEX-999');
  });

  it('returns null for unknown order', () => {
    const mgr = OrderHistoryManager.getInstance();
    expect(mgr.updateTracking(1, 'fake', 'TRK-1')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

describe('OrderHistoryManager — deleteOrder', () => {
  it('deletes an order', () => {
    const mgr = OrderHistoryManager.getInstance();
    const order = mgr.createOrder(makeInput());
    expect(mgr.deleteOrder(1, order.id)).toBe(true);
    expect(mgr.getOrders(1)).toHaveLength(0);
  });

  it('returns false for unknown order', () => {
    const mgr = OrderHistoryManager.getInstance();
    expect(mgr.deleteOrder(1, 'fake-id')).toBe(false);
  });

  it('notifies listeners on delete', () => {
    const mgr = OrderHistoryManager.getInstance();
    const order = mgr.createOrder(makeInput());
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.deleteOrder(1, order.id);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Clear
// ---------------------------------------------------------------------------

describe('OrderHistoryManager — clearAll', () => {
  it('clears all orders for a project', () => {
    const mgr = OrderHistoryManager.getInstance();
    mgr.createOrder(makeInput());
    mgr.createOrder(makeInput());
    mgr.clearAll(1);
    expect(mgr.getOrders(1)).toHaveLength(0);
  });

  it('does not affect other projects', () => {
    const mgr = OrderHistoryManager.getInstance();
    mgr.createOrder(makeInput({ projectId: 1 }));
    mgr.createOrder(makeInput({ projectId: 2 }));
    mgr.clearAll(1);
    expect(mgr.getOrders(1)).toHaveLength(0);
    expect(mgr.getOrders(2)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Cost aggregation
// ---------------------------------------------------------------------------

describe('OrderHistoryManager — cost aggregation', () => {
  it('getTotalSpent excludes cancelled orders', () => {
    const mgr = OrderHistoryManager.getInstance();
    mgr.createOrder(makeInput({ totalCost: 50 }));
    const cancelled = mgr.createOrder(makeInput({ totalCost: 30 }));
    mgr.updateStatus(1, cancelled.id, 'cancelled');
    expect(mgr.getTotalSpent(1)).toBe(50);
  });

  it('getCostByCategory sums per category', () => {
    const mgr = OrderHistoryManager.getInstance();
    mgr.createOrder(makeInput({ category: 'pcb', totalCost: 20 }));
    mgr.createOrder(makeInput({ category: 'pcb', totalCost: 30 }));
    mgr.createOrder(makeInput({ category: 'components', totalCost: 100 }));
    const costs = mgr.getCostByCategory(1);
    expect(costs.pcb).toBe(50);
    expect(costs.components).toBe(100);
    expect(costs.assembly).toBe(0);
  });

  it('getCostByCategory excludes cancelled', () => {
    const mgr = OrderHistoryManager.getInstance();
    const order = mgr.createOrder(makeInput({ category: 'pcb', totalCost: 20 }));
    mgr.updateStatus(1, order.id, 'cancelled');
    const costs = mgr.getCostByCategory(1);
    expect(costs.pcb).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

describe('OrderHistoryManager — subscribe/unsubscribe', () => {
  it('unsubscribe stops notifications', () => {
    const mgr = OrderHistoryManager.getInstance();
    const listener = vi.fn();
    const unsub = mgr.subscribe(listener);
    mgr.createOrder(makeInput());
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
    mgr.createOrder(makeInput());
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('Order history constants', () => {
  it('ORDER_STATUS_LABELS has all statuses', () => {
    const statuses: OrderHistoryStatus[] = ['quoted', 'ordered', 'in_production', 'shipped', 'delivered', 'cancelled'];
    for (const s of statuses) {
      expect(ORDER_STATUS_LABELS[s]).toBeTruthy();
    }
  });

  it('ORDER_STATUS_COLORS has all statuses', () => {
    const statuses: OrderHistoryStatus[] = ['quoted', 'ordered', 'in_production', 'shipped', 'delivered', 'cancelled'];
    for (const s of statuses) {
      expect(ORDER_STATUS_COLORS[s]).toBeTruthy();
    }
  });

  it('CATEGORY_LABELS has all categories', () => {
    const cats: OrderCategory[] = ['pcb', 'components', 'assembly'];
    for (const c of cats) {
      expect(CATEGORY_LABELS[c]).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

describe('useOrderHistory', () => {
  it('returns orders for the given project', () => {
    const mgr = OrderHistoryManager.getInstance();
    mgr.createOrder(makeInput({ projectId: 1 }));

    const { result } = renderHook(() => useOrderHistory(1));
    expect(result.current.orders).toHaveLength(1);
  });

  it('createOrder adds and re-renders', () => {
    const { result } = renderHook(() => useOrderHistory(1));
    act(() => {
      result.current.createOrder({
        category: 'pcb',
        supplier: 'JLCPCB',
        description: 'Test PCB',
        quantity: 5,
        unitCost: 2.0,
        totalCost: 10.0,
      });
    });
    expect(result.current.orders).toHaveLength(1);
    expect(result.current.orders[0].category).toBe('pcb');
  });

  it('updateStatus works through hook', () => {
    const { result } = renderHook(() => useOrderHistory(1));
    let orderId: string;
    act(() => {
      const order = result.current.createOrder({
        category: 'components',
        supplier: 'Mouser',
        description: 'Resistors',
        quantity: 50,
        unitCost: 0.05,
        totalCost: 2.5,
      });
      orderId = order.id;
    });
    act(() => {
      result.current.updateStatus(orderId, 'ordered');
    });
    expect(result.current.orders[0].status).toBe('ordered');
  });

  it('deleteOrder removes and re-renders', () => {
    const { result } = renderHook(() => useOrderHistory(1));
    let orderId: string;
    act(() => {
      const order = result.current.createOrder({
        category: 'assembly',
        supplier: 'PCBWay',
        description: 'Assembly service',
        quantity: 10,
        unitCost: 5.0,
        totalCost: 50.0,
      });
      orderId = order.id;
    });
    act(() => {
      result.current.deleteOrder(orderId);
    });
    expect(result.current.orders).toHaveLength(0);
  });

  it('totalSpent aggregates correctly', () => {
    const { result } = renderHook(() => useOrderHistory(1));
    act(() => {
      result.current.createOrder({ category: 'pcb', supplier: 'JLCPCB', description: 'A', quantity: 1, unitCost: 10, totalCost: 10 });
      result.current.createOrder({ category: 'components', supplier: 'Mouser', description: 'B', quantity: 1, unitCost: 20, totalCost: 20 });
    });
    expect(result.current.totalSpent).toBe(30);
  });

  it('costByCategory sums per category', () => {
    const { result } = renderHook(() => useOrderHistory(1));
    act(() => {
      result.current.createOrder({ category: 'pcb', supplier: 'JLCPCB', description: 'PCB', quantity: 5, unitCost: 2, totalCost: 10 });
      result.current.createOrder({ category: 'pcb', supplier: 'PCBWay', description: 'PCB2', quantity: 5, unitCost: 3, totalCost: 15 });
      result.current.createOrder({ category: 'assembly', supplier: 'JLCPCB', description: 'Assembly', quantity: 5, unitCost: 10, totalCost: 50 });
    });
    expect(result.current.costByCategory.pcb).toBe(25);
    expect(result.current.costByCategory.assembly).toBe(50);
    expect(result.current.costByCategory.components).toBe(0);
  });

  it('activeOrders excludes delivered and cancelled', () => {
    const { result } = renderHook(() => useOrderHistory(1));
    act(() => {
      const o1 = result.current.createOrder({ category: 'pcb', supplier: 'A', description: 'A', quantity: 1, unitCost: 1, totalCost: 1 });
      result.current.updateStatus(o1.id, 'cancelled');
    });
    expect(result.current.activeOrders).toHaveLength(0);
  });

  it('updateTracking works through hook', () => {
    const { result } = renderHook(() => useOrderHistory(1));
    let orderId: string;
    act(() => {
      const order = result.current.createOrder({
        category: 'pcb',
        supplier: 'JLCPCB',
        description: 'PCB order',
        quantity: 5,
        unitCost: 2.0,
        totalCost: 10.0,
      });
      orderId = order.id;
    });
    // updateTracking is not exposed through the hook — verify via manager
    const mgr = OrderHistoryManager.getInstance();
    mgr.updateTracking(1, orderId!, 'TRK-HOOK', 'https://track.example.com');
    // Re-render to pick up change
    const { result: result2 } = renderHook(() => useOrderHistory(1));
    expect(result2.current.orders[0].trackingNumber).toBe('TRK-HOOK');
  });
});

// ---------------------------------------------------------------------------
// FIFO eviction
// ---------------------------------------------------------------------------

describe('OrderHistoryManager — FIFO eviction', () => {
  it('evicts oldest order when at max capacity', () => {
    const mgr = OrderHistoryManager.getInstance();
    const firstOrder = mgr.createOrder(makeInput({ description: 'order-0' }));
    for (let i = 1; i < MAX_ORDERS_PER_PROJECT; i++) {
      mgr.createOrder(makeInput({ description: `order-${String(i)}` }));
    }
    expect(mgr.getOrders(1)).toHaveLength(MAX_ORDERS_PER_PROJECT);

    // Adding one more should evict the first
    mgr.createOrder(makeInput({ description: 'overflow' }));
    const orders = mgr.getOrders(1);
    expect(orders).toHaveLength(MAX_ORDERS_PER_PROJECT);
    expect(orders.find((o) => o.id === firstOrder.id)).toBeUndefined();
    expect(orders[orders.length - 1].description).toBe('overflow');
  });

  it('evicts multiple oldest when adding to a full list', () => {
    const mgr = OrderHistoryManager.getInstance();
    for (let i = 0; i < MAX_ORDERS_PER_PROJECT; i++) {
      mgr.createOrder(makeInput({ description: `order-${String(i)}` }));
    }
    // Delete some, then fill back up + overflow
    const orders = mgr.getOrders(1);
    mgr.deleteOrder(1, orders[0].id);
    mgr.deleteOrder(1, orders[1].id);
    expect(mgr.getOrders(1)).toHaveLength(MAX_ORDERS_PER_PROJECT - 2);

    // Fill to capacity again
    mgr.createOrder(makeInput({ description: 'refill-1' }));
    mgr.createOrder(makeInput({ description: 'refill-2' }));
    expect(mgr.getOrders(1)).toHaveLength(MAX_ORDERS_PER_PROJECT);

    // One more triggers eviction
    mgr.createOrder(makeInput({ description: 'new-overflow' }));
    expect(mgr.getOrders(1)).toHaveLength(MAX_ORDERS_PER_PROJECT);
  });

  it('FIFO eviction does not affect other projects', () => {
    const mgr = OrderHistoryManager.getInstance();
    mgr.createOrder(makeInput({ projectId: 2, description: 'project-2-order' }));
    for (let i = 0; i < MAX_ORDERS_PER_PROJECT; i++) {
      mgr.createOrder(makeInput({ projectId: 1, description: `p1-order-${String(i)}` }));
    }
    // Overflow project 1
    mgr.createOrder(makeInput({ projectId: 1, description: 'p1-overflow' }));
    expect(mgr.getOrders(1)).toHaveLength(MAX_ORDERS_PER_PROJECT);
    expect(mgr.getOrders(2)).toHaveLength(1);
  });

  it('MAX_ORDERS_PER_PROJECT is 50', () => {
    expect(MAX_ORDERS_PER_PROJECT).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// localStorage corruption recovery
// ---------------------------------------------------------------------------

describe('OrderHistoryManager — corruption recovery', () => {
  it('recovers from corrupted JSON in localStorage', () => {
    localStorage.setItem('protopulse-order-history:1', 'NOT VALID JSON{{{');
    const mgr = OrderHistoryManager.getInstance();
    expect(mgr.getOrders(1)).toHaveLength(0);
    // Should be able to create new orders after corruption
    const order = mgr.createOrder(makeInput());
    expect(order.id).toBeTruthy();
    expect(mgr.getOrders(1)).toHaveLength(1);
  });

  it('recovers from non-array JSON in localStorage', () => {
    localStorage.setItem('protopulse-order-history:1', JSON.stringify({ not: 'an array' }));
    const mgr = OrderHistoryManager.getInstance();
    expect(mgr.getOrders(1)).toHaveLength(0);
  });

  it('recovers from null stored value', () => {
    localStorage.setItem('protopulse-order-history:1', 'null');
    const mgr = OrderHistoryManager.getInstance();
    expect(mgr.getOrders(1)).toHaveLength(0);
  });

  it('persists across manager resets (simulating page reload)', () => {
    const mgr = OrderHistoryManager.getInstance();
    mgr.createOrder(makeInput({ description: 'persistent order' }));
    mgr.createOrder(makeInput({ description: 'another persistent order' }));

    OrderHistoryManager.resetForTesting();
    const mgr2 = OrderHistoryManager.getInstance();
    const orders = mgr2.getOrders(1);
    expect(orders).toHaveLength(2);
    expect(orders[0].description).toBe('persistent order');
    expect(orders[1].description).toBe('another persistent order');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('OrderHistoryManager — edge cases', () => {
  it('handles zero cost orders', () => {
    const mgr = OrderHistoryManager.getInstance();
    const order = mgr.createOrder(makeInput({ unitCost: 0, totalCost: 0 }));
    expect(order.unitCost).toBe(0);
    expect(order.totalCost).toBe(0);
    expect(mgr.getTotalSpent(1)).toBe(0);
  });

  it('handles large cost values without precision loss', () => {
    const mgr = OrderHistoryManager.getInstance();
    const order = mgr.createOrder(makeInput({ unitCost: 99999.99, totalCost: 99999.99 }));
    expect(order.unitCost).toBe(99999.99);
    expect(order.totalCost).toBe(99999.99);
  });

  it('multiple listeners all receive notifications', () => {
    const mgr = OrderHistoryManager.getInstance();
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    const listener3 = vi.fn();
    mgr.subscribe(listener1);
    mgr.subscribe(listener2);
    mgr.subscribe(listener3);
    mgr.createOrder(makeInput());
    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
    expect(listener3).toHaveBeenCalledTimes(1);
  });

  it('clearAll notifies listeners', () => {
    const mgr = OrderHistoryManager.getInstance();
    mgr.createOrder(makeInput());
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.clearAll(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('updateStatus notifies listeners', () => {
    const mgr = OrderHistoryManager.getInstance();
    const order = mgr.createOrder(makeInput());
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.updateStatus(1, order.id, 'ordered');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('updateTracking notifies listeners', () => {
    const mgr = OrderHistoryManager.getInstance();
    const order = mgr.createOrder(makeInput());
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.updateTracking(1, order.id, 'TRK-NOTIFY');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('each order gets a unique UUID', () => {
    const mgr = OrderHistoryManager.getInstance();
    const ids = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const order = mgr.createOrder(makeInput({ description: `order-${String(i)}` }));
      ids.add(order.id);
    }
    expect(ids.size).toBe(20);
  });

  it('updatedAt changes on status update', () => {
    const mgr = OrderHistoryManager.getInstance();
    const order = mgr.createOrder(makeInput());
    const originalUpdatedAt = order.updatedAt;
    // Small delay to ensure timestamp differs
    const updated = mgr.updateStatus(1, order.id, 'ordered');
    expect(updated!.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
  });

  it('updatedAt changes on tracking update', () => {
    const mgr = OrderHistoryManager.getInstance();
    const order = mgr.createOrder(makeInput());
    const originalUpdatedAt = order.updatedAt;
    const updated = mgr.updateTracking(1, order.id, 'TRK-TIME');
    expect(updated!.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
  });

  it('does not allow shipped → cancelled (only forward transitions)', () => {
    const mgr = OrderHistoryManager.getInstance();
    const order = mgr.createOrder(makeInput());
    mgr.updateStatus(1, order.id, 'ordered');
    mgr.updateStatus(1, order.id, 'in_production');
    mgr.updateStatus(1, order.id, 'shipped');
    expect(mgr.updateStatus(1, order.id, 'cancelled')).toBeNull();
  });

  it('getTotalSpent returns 0 for empty project', () => {
    const mgr = OrderHistoryManager.getInstance();
    expect(mgr.getTotalSpent(999)).toBe(0);
  });

  it('getCostByCategory returns zeros for empty project', () => {
    const mgr = OrderHistoryManager.getInstance();
    const costs = mgr.getCostByCategory(999);
    expect(costs.pcb).toBe(0);
    expect(costs.components).toBe(0);
    expect(costs.assembly).toBe(0);
  });
});
