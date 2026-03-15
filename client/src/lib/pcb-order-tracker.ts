/**
 * PCB Order Tracker
 *
 * Tracks PCB fabrication orders through manufacturing stages:
 *   gerbers_received -> in_review -> in_production -> testing -> shipped -> delivered
 *
 * Focused on the fab-house manufacturing pipeline (distinct from the general
 * order-history module which tracks all procurement orders at a higher level).
 *
 * Singleton + Subscribe pattern for React integration. Persists to localStorage
 * per project.
 *
 * Usage:
 *   const tracker = PcbOrderTracker.getInstance();
 *   const order = tracker.createOrder(1, { fabHouse: 'JLCPCB', orderId: 'W123' });
 *   tracker.updateStatus(1, order.id, 'in_review');
 *
 * React hook:
 *   const { orders, createOrder, updateStatus, ... } = usePcbOrderTracker(projectId);
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PcbOrderStatus =
  | 'gerbers_received'
  | 'in_review'
  | 'in_production'
  | 'testing'
  | 'shipped'
  | 'delivered';

export interface PcbStatusHistoryEntry {
  status: PcbOrderStatus;
  timestamp: number;
  note?: string;
}

export interface PcbOrder {
  id: string;
  fabHouse: string;
  orderId: string;
  status: PcbOrderStatus;
  statusHistory: PcbStatusHistoryEntry[];
  trackingUrl?: string;
  estimatedDelivery?: number; // epoch ms
  boardName?: string;
  quantity?: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreatePcbOrderInput {
  fabHouse: string;
  orderId: string;
  trackingUrl?: string;
  estimatedDelivery?: number;
  boardName?: string;
  quantity?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY_PREFIX = 'protopulse-pcb-order-tracker';

function storageKey(projectId: number): string {
  return `${STORAGE_KEY_PREFIX}:${String(projectId)}`;
}

/**
 * Ordered pipeline stages. Index order is the canonical progression order.
 */
export const PCB_STATUS_PIPELINE: PcbOrderStatus[] = [
  'gerbers_received',
  'in_review',
  'in_production',
  'testing',
  'shipped',
  'delivered',
];

export const PCB_STATUS_LABELS: Record<PcbOrderStatus, string> = {
  gerbers_received: 'Gerbers Received',
  in_review: 'In Review',
  in_production: 'In Production',
  testing: 'Testing',
  shipped: 'Shipped',
  delivered: 'Delivered',
};

export const PCB_STATUS_COLORS: Record<PcbOrderStatus, string> = {
  gerbers_received: 'text-blue-400 border-blue-400/30 bg-blue-400/10',
  in_review: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
  in_production: 'text-purple-400 border-purple-400/30 bg-purple-400/10',
  testing: 'text-orange-400 border-orange-400/30 bg-orange-400/10',
  shipped: 'text-cyan-400 border-cyan-400/30 bg-cyan-400/10',
  delivered: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
};

/**
 * Valid forward transitions. Each status can only advance to the next stage.
 */
const VALID_TRANSITIONS: Record<PcbOrderStatus, PcbOrderStatus[]> = {
  gerbers_received: ['in_review'],
  in_review: ['in_production'],
  in_production: ['testing'],
  testing: ['shipped'],
  shipped: ['delivered'],
  delivered: [],
};

type Listener = () => void;

// ---------------------------------------------------------------------------
// PcbOrderTracker
// ---------------------------------------------------------------------------

export class PcbOrderTracker {
  private static instance: PcbOrderTracker | null = null;

  private ordersByProject = new Map<number, PcbOrder[]>();
  private listeners = new Set<Listener>();

  static getInstance(): PcbOrderTracker {
    if (!PcbOrderTracker.instance) {
      PcbOrderTracker.instance = new PcbOrderTracker();
    }
    return PcbOrderTracker.instance;
  }

  static resetForTesting(): void {
    PcbOrderTracker.instance = null;
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

  private loadProject(projectId: number): PcbOrder[] {
    const cached = this.ordersByProject.get(projectId);
    if (cached) {
      return cached;
    }
    try {
      const raw = localStorage.getItem(storageKey(projectId));
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const orders = parsed as PcbOrder[];
          this.ordersByProject.set(projectId, orders);
          return orders;
        }
      }
    } catch {
      /* corrupted — start fresh */
    }
    const empty: PcbOrder[] = [];
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

  getOrders(projectId: number): PcbOrder[] {
    return [...this.loadProject(projectId)];
  }

  getOrder(projectId: number, orderId: string): PcbOrder | null {
    return this.loadProject(projectId).find((o) => o.id === orderId) ?? null;
  }

  getActiveOrders(projectId: number): PcbOrder[] {
    return this.loadProject(projectId).filter((o) => o.status !== 'delivered');
  }

  getCompletedOrders(projectId: number): PcbOrder[] {
    return this.loadProject(projectId).filter((o) => o.status === 'delivered');
  }

  /**
   * Returns the index (0-based) of the given status within the pipeline.
   */
  getStatusIndex(status: PcbOrderStatus): number {
    return PCB_STATUS_PIPELINE.indexOf(status);
  }

  /**
   * Compute days remaining until estimated delivery, or null if no estimate.
   */
  getDaysUntilDelivery(order: PcbOrder): number | null {
    if (order.estimatedDelivery == null) {
      return null;
    }
    const diff = order.estimatedDelivery - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------

  createOrder(projectId: number, input: CreatePcbOrderInput): PcbOrder {
    const now = Date.now();
    const order: PcbOrder = {
      id: crypto.randomUUID(),
      fabHouse: input.fabHouse,
      orderId: input.orderId,
      status: 'gerbers_received',
      statusHistory: [{ status: 'gerbers_received', timestamp: now }],
      trackingUrl: input.trackingUrl,
      estimatedDelivery: input.estimatedDelivery,
      boardName: input.boardName,
      quantity: input.quantity,
      createdAt: now,
      updatedAt: now,
    };

    const orders = this.loadProject(projectId);
    orders.push(order);
    this.saveProject(projectId);
    this.notify();
    return order;
  }

  updateStatus(
    projectId: number,
    orderId: string,
    newStatus: PcbOrderStatus,
    note?: string,
  ): PcbOrder | null {
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
    order.statusHistory.push({ status: newStatus, timestamp: order.updatedAt, note });

    this.saveProject(projectId);
    this.notify();
    return order;
  }

  updateTracking(
    projectId: number,
    orderId: string,
    trackingUrl: string,
  ): PcbOrder | null {
    const orders = this.loadProject(projectId);
    const order = orders.find((o) => o.id === orderId);
    if (!order) {
      return null;
    }

    order.trackingUrl = trackingUrl;
    order.updatedAt = Date.now();

    this.saveProject(projectId);
    this.notify();
    return order;
  }

  updateEstimatedDelivery(
    projectId: number,
    orderId: string,
    estimatedDelivery: number,
  ): PcbOrder | null {
    const orders = this.loadProject(projectId);
    const order = orders.find((o) => o.id === orderId);
    if (!order) {
      return null;
    }

    order.estimatedDelivery = estimatedDelivery;
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

export function usePcbOrderTracker(projectId: number) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const tracker = PcbOrderTracker.getInstance();
    return tracker.subscribe(() => {
      setTick((t) => t + 1);
    });
  }, []);

  const tracker = PcbOrderTracker.getInstance();

  const orders = tracker.getOrders(projectId);
  const activeOrders = tracker.getActiveOrders(projectId);
  const completedOrders = tracker.getCompletedOrders(projectId);

  const createOrder = useCallback(
    (input: CreatePcbOrderInput) => {
      return tracker.createOrder(projectId, input);
    },
    [projectId, tracker],
  );

  const updateStatus = useCallback(
    (orderId: string, status: PcbOrderStatus, note?: string) => {
      return tracker.updateStatus(projectId, orderId, status, note);
    },
    [projectId, tracker],
  );

  const updateTracking = useCallback(
    (orderId: string, trackingUrl: string) => {
      return tracker.updateTracking(projectId, orderId, trackingUrl);
    },
    [projectId, tracker],
  );

  const updateEstimatedDelivery = useCallback(
    (orderId: string, estimatedDelivery: number) => {
      return tracker.updateEstimatedDelivery(projectId, orderId, estimatedDelivery);
    },
    [projectId, tracker],
  );

  const deleteOrder = useCallback(
    (orderId: string) => {
      return tracker.deleteOrder(projectId, orderId);
    },
    [projectId, tracker],
  );

  const getDaysUntilDelivery = useCallback(
    (order: PcbOrder) => {
      return tracker.getDaysUntilDelivery(order);
    },
    [tracker],
  );

  return {
    orders,
    activeOrders,
    completedOrders,
    createOrder,
    updateStatus,
    updateTracking,
    updateEstimatedDelivery,
    deleteOrder,
    getDaysUntilDelivery,
  };
}
