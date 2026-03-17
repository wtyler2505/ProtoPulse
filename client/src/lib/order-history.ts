/**
 * Order History Manager
 *
 * Tracks quotes and orders across PCB fabrication, BOM procurement, and assembly.
 * Singleton + Subscribe pattern for React integration. Persists to localStorage
 * per project.
 *
 * Statuses: quoted → ordered → in_production → shipped → delivered (or cancelled at any stage).
 *
 * Usage:
 *   const manager = OrderHistoryManager.getInstance();
 *   const order = manager.createOrder({ ... });
 *   manager.updateStatus(order.id, 'ordered');
 *
 * React hook:
 *   const { orders, createOrder, updateStatus, ... } = useOrderHistory(projectId);
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OrderCategory = 'pcb' | 'components' | 'assembly';

export type OrderHistoryStatus =
  | 'quoted'
  | 'ordered'
  | 'in_production'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export interface OrderTimelineEntry {
  status: OrderHistoryStatus;
  timestamp: number;
  note?: string;
}

export interface OrderRecord {
  id: string;
  projectId: number;
  category: OrderCategory;
  supplier: string;
  description: string;
  status: OrderHistoryStatus;
  quantity: number;
  unitCost: number;
  totalCost: number;
  currency: string;
  trackingUrl?: string;
  trackingNumber?: string;
  quoteReference?: string;
  timeline: OrderTimelineEntry[];
  createdAt: number;
  updatedAt: number;
}

export interface CreateOrderInput {
  projectId: number;
  category: OrderCategory;
  supplier: string;
  description: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  currency?: string;
  trackingUrl?: string;
  trackingNumber?: string;
  quoteReference?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY_PREFIX = 'protopulse-order-history';

function storageKey(projectId: number): string {
  return `${STORAGE_KEY_PREFIX}:${String(projectId)}`;
}

type Listener = () => void;

export const ORDER_STATUS_LABELS: Record<OrderHistoryStatus, string> = {
  quoted: 'Quoted',
  ordered: 'Ordered',
  in_production: 'In Production',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const ORDER_STATUS_COLORS: Record<OrderHistoryStatus, string> = {
  quoted: 'text-blue-400 border-blue-400/30 bg-blue-400/10',
  ordered: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
  in_production: 'text-purple-400 border-purple-400/30 bg-purple-400/10',
  shipped: 'text-cyan-400 border-cyan-400/30 bg-cyan-400/10',
  delivered: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
  cancelled: 'text-red-400 border-red-400/30 bg-red-400/10',
};

export const CATEGORY_LABELS: Record<OrderCategory, string> = {
  pcb: 'PCB Fabrication',
  components: 'Components',
  assembly: 'Assembly',
};

export const MAX_ORDERS_PER_PROJECT = 50;

const VALID_TRANSITIONS: Record<OrderHistoryStatus, OrderHistoryStatus[]> = {
  quoted: ['ordered', 'cancelled'],
  ordered: ['in_production', 'cancelled'],
  in_production: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

// ---------------------------------------------------------------------------
// OrderHistoryManager
// ---------------------------------------------------------------------------

export class OrderHistoryManager {
  private static instance: OrderHistoryManager | null = null;

  private ordersByProject = new Map<number, OrderRecord[]>();
  private listeners = new Set<Listener>();

  static getInstance(): OrderHistoryManager {
    if (!OrderHistoryManager.instance) {
      OrderHistoryManager.instance = new OrderHistoryManager();
    }
    return OrderHistoryManager.instance;
  }

  static resetForTesting(): void {
    OrderHistoryManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => {
      l();
    });
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  private loadProject(projectId: number): OrderRecord[] {
    const cached = this.ordersByProject.get(projectId);
    if (cached) {
      return cached;
    }
    try {
      const raw = localStorage.getItem(storageKey(projectId));
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const orders = parsed as OrderRecord[];
          this.ordersByProject.set(projectId, orders);
          return orders;
        }
      }
    } catch {
      /* corrupted — start fresh */
    }
    const empty: OrderRecord[] = [];
    this.ordersByProject.set(projectId, empty);
    return empty;
  }

  private saveProject(projectId: number): void {
    const orders = this.ordersByProject.get(projectId) ?? [];
    try {
      localStorage.setItem(storageKey(projectId), JSON.stringify(orders));
    } catch {
      /* quota exceeded */
    }
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  getOrders(projectId: number): OrderRecord[] {
    return [...this.loadProject(projectId)];
  }

  getOrder(projectId: number, orderId: string): OrderRecord | null {
    return this.loadProject(projectId).find((o) => o.id === orderId) ?? null;
  }

  getOrdersByCategory(projectId: number, category: OrderCategory): OrderRecord[] {
    return this.loadProject(projectId).filter((o) => o.category === category);
  }

  getOrdersByStatus(projectId: number, status: OrderHistoryStatus): OrderRecord[] {
    return this.loadProject(projectId).filter((o) => o.status === status);
  }

  getActiveOrders(projectId: number): OrderRecord[] {
    return this.loadProject(projectId).filter(
      (o) => o.status !== 'delivered' && o.status !== 'cancelled',
    );
  }

  // -----------------------------------------------------------------------
  // Cost Aggregation
  // -----------------------------------------------------------------------

  getTotalSpent(projectId: number): number {
    return this.loadProject(projectId)
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + o.totalCost, 0);
  }

  getCostByCategory(projectId: number): Record<OrderCategory, number> {
    const result: Record<OrderCategory, number> = { pcb: 0, components: 0, assembly: 0 };
    for (const order of this.loadProject(projectId)) {
      if (order.status !== 'cancelled') {
        result[order.category] += order.totalCost;
      }
    }
    return result;
  }

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------

  createOrder(input: CreateOrderInput): OrderRecord {
    const now = Date.now();
    const order: OrderRecord = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      category: input.category,
      supplier: input.supplier,
      description: input.description,
      status: 'quoted',
      quantity: input.quantity,
      unitCost: Math.round(input.unitCost * 100) / 100,
      totalCost: Math.round(input.totalCost * 100) / 100,
      currency: input.currency ?? 'USD',
      trackingUrl: input.trackingUrl,
      trackingNumber: input.trackingNumber,
      quoteReference: input.quoteReference,
      timeline: [{ status: 'quoted', timestamp: now }],
      createdAt: now,
      updatedAt: now,
    };

    const orders = this.loadProject(input.projectId);
    // FIFO eviction: remove oldest orders when at capacity
    while (orders.length >= MAX_ORDERS_PER_PROJECT) {
      orders.shift();
    }
    orders.push(order);
    this.saveProject(input.projectId);
    this.notify();
    return order;
  }

  updateStatus(
    projectId: number,
    orderId: string,
    newStatus: OrderHistoryStatus,
    note?: string,
  ): OrderRecord | null {
    const orders = this.loadProject(projectId);
    const order = orders.find((o) => o.id === orderId);
    if (!order) {
      return null;
    }

    const allowed = VALID_TRANSITIONS[order.status];
    if (!allowed.includes(newStatus)) {
      return null;
    }

    order.status = newStatus;
    order.updatedAt = Date.now();
    order.timeline.push({ status: newStatus, timestamp: order.updatedAt, note });

    this.saveProject(projectId);
    this.notify();
    return order;
  }

  updateTracking(
    projectId: number,
    orderId: string,
    trackingNumber: string,
    trackingUrl?: string,
  ): OrderRecord | null {
    const orders = this.loadProject(projectId);
    const order = orders.find((o) => o.id === orderId);
    if (!order) {
      return null;
    }

    order.trackingNumber = trackingNumber;
    if (trackingUrl !== undefined) {
      order.trackingUrl = trackingUrl;
    }
    order.updatedAt = Date.now();

    this.saveProject(projectId);
    this.notify();
    return order;
  }

  deleteOrder(projectId: number, orderId: string): boolean {
    const orders = this.loadProject(projectId);
    const idx = orders.findIndex((o) => o.id === orderId);
    if (idx === -1) {
      return false;
    }

    orders.splice(idx, 1);
    this.saveProject(projectId);
    this.notify();
    return true;
  }

  clearAll(projectId: number): void {
    this.ordersByProject.set(projectId, []);
    this.saveProject(projectId);
    this.notify();
  }
}

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

export function useOrderHistory(projectId: number) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const manager = OrderHistoryManager.getInstance();
    return manager.subscribe(() => {
      setTick((t) => t + 1);
    });
  }, []);

  const manager = OrderHistoryManager.getInstance();

  const orders = manager.getOrders(projectId);

  const createOrder = useCallback(
    (input: Omit<CreateOrderInput, 'projectId'>) => {
      return manager.createOrder({ ...input, projectId });
    },
    [projectId, manager],
  );

  const updateStatus = useCallback(
    (orderId: string, status: OrderHistoryStatus, note?: string) => {
      return manager.updateStatus(projectId, orderId, status, note);
    },
    [projectId, manager],
  );

  const updateTracking = useCallback(
    (orderId: string, trackingNumber: string, trackingUrl?: string) => {
      return manager.updateTracking(projectId, orderId, trackingNumber, trackingUrl);
    },
    [projectId, manager],
  );

  const deleteOrder = useCallback(
    (orderId: string) => {
      return manager.deleteOrder(projectId, orderId);
    },
    [projectId, manager],
  );

  const totalSpent = manager.getTotalSpent(projectId);
  const costByCategory = manager.getCostByCategory(projectId);
  const activeOrders = manager.getActiveOrders(projectId);

  return {
    orders,
    activeOrders,
    totalSpent,
    costByCategory,
    createOrder,
    updateStatus,
    updateTracking,
    deleteOrder,
  };
}
