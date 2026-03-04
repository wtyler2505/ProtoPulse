/**
 * AI Review Queue Manager
 *
 * Collects AI actions that fall below a confidence threshold for human review.
 * Low-confidence actions are queued as pending items that can be approved or rejected.
 *
 * Usage:
 *   const manager = ReviewQueueManager.getInstance();
 *   if (manager.shouldQueue(confidence)) {
 *     manager.addToQueue({ action: 'add_bom_item', description: 'Add 10K resistor', confidence: 35 });
 *   }
 *
 * React hook:
 *   const { pendingItems, approveItem, rejectItem, stats } = useReviewQueue();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReviewItem {
  id: string;
  action: string;
  description: string;
  confidence: number;
  timestamp: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  rejectionReason?: string;
  metadata?: Record<string, unknown>;
}

export interface ReviewQueueStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  expired: number;
  averageConfidence: number;
  oldestPendingAge: number | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-ai-review-queue';
const MAX_ITEMS = 200;
const DEFAULT_THRESHOLD = 50;
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEDUP_WINDOW_MS = 1000; // 1 second deduplication window

// ---------------------------------------------------------------------------
// ReviewQueueManager
// ---------------------------------------------------------------------------

/**
 * Manages a queue of AI actions pending human review.
 * Singleton per application. Notifies subscribers on state changes.
 */
export class ReviewQueueManager {
  private static instance: ReviewQueueManager | null = null;

  private items: ReviewItem[];
  private threshold: number;
  private subscribers: Set<() => void>;

  constructor() {
    this.items = [];
    this.threshold = DEFAULT_THRESHOLD;
    this.subscribers = new Set();
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): ReviewQueueManager {
    if (!ReviewQueueManager.instance) {
      ReviewQueueManager.instance = new ReviewQueueManager();
    }
    return ReviewQueueManager.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetInstance(): void {
    ReviewQueueManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------

  /**
   * Add an item to the review queue. Auto-generates id, timestamp, and sets status to 'pending'.
   * Deduplicates items with the same action and description added within 1 second.
   * Enforces a max of 200 items — evicts oldest resolved first, then oldest pending.
   * Returns the item id.
   */
  addToQueue(item: Omit<ReviewItem, 'id' | 'status' | 'timestamp'>): string {
    const now = Date.now();

    // Deduplicate: same action + description within 1 second
    const isDuplicate = this.items.some(
      (existing) =>
        existing.action === item.action &&
        existing.description === item.description &&
        Math.abs(now - existing.timestamp) < DEDUP_WINDOW_MS,
    );
    if (isDuplicate) {
      const existing = this.items.find(
        (e) =>
          e.action === item.action &&
          e.description === item.description &&
          Math.abs(now - e.timestamp) < DEDUP_WINDOW_MS,
      );
      return existing!.id;
    }

    const id = crypto.randomUUID();
    const newItem: ReviewItem = {
      ...item,
      id,
      status: 'pending',
      timestamp: now,
    };

    this.items.push(newItem);
    this.enforceLimit();
    this.save();
    this.notify();
    return id;
  }

  /** Approve a pending item. Returns false if not found. */
  approveItem(id: string): boolean {
    const item = this.items.find((i) => i.id === id);
    if (!item) {
      return false;
    }
    item.status = 'approved';
    this.save();
    this.notify();
    return true;
  }

  /** Reject a pending item with an optional reason. Returns false if not found. */
  rejectItem(id: string, reason?: string): boolean {
    const item = this.items.find((i) => i.id === id);
    if (!item) {
      return false;
    }
    item.status = 'rejected';
    if (reason !== undefined) {
      item.rejectionReason = reason;
    }
    this.save();
    this.notify();
    return true;
  }

  /** Remove all resolved (approved + rejected + expired) items. */
  clearResolved(): void {
    const before = this.items.length;
    this.items = this.items.filter((i) => i.status === 'pending');
    if (this.items.length !== before) {
      this.save();
      this.notify();
    }
  }

  /**
   * Expire pending items older than maxAgeMs (default 24 hours).
   * Returns the count of items expired.
   */
  expireOldItems(maxAgeMs: number = DEFAULT_MAX_AGE_MS): number {
    const cutoff = Date.now() - maxAgeMs;
    let expired = 0;

    for (const item of this.items) {
      if (item.status === 'pending' && item.timestamp < cutoff) {
        item.status = 'expired';
        expired++;
      }
    }

    if (expired > 0) {
      this.save();
      this.notify();
    }

    return expired;
  }

  /** Set the confidence threshold (clamped to 0-100). */
  setThreshold(value: number): void {
    this.threshold = Math.max(0, Math.min(100, value));
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /** Get all pending items sorted by confidence ascending (lowest first). */
  getPendingItems(): ReviewItem[] {
    return this.items
      .filter((i) => i.status === 'pending')
      .sort((a, b) => a.confidence - b.confidence);
  }

  /** Get all approved items. */
  getApprovedItems(): ReviewItem[] {
    return this.items.filter((i) => i.status === 'approved');
  }

  /** Get all rejected items. */
  getRejectedItems(): ReviewItem[] {
    return this.items.filter((i) => i.status === 'rejected');
  }

  /** Get all items (copy). */
  getAllItems(): ReviewItem[] {
    return [...this.items];
  }

  /** Get a single item by ID, or null if not found. */
  getItemById(id: string): ReviewItem | null {
    return this.items.find((i) => i.id === id) ?? null;
  }

  /** Check if a confidence value is below the threshold and should be queued. */
  shouldQueue(confidence: number): boolean {
    return confidence < this.threshold;
  }

  /** Get the current threshold. */
  getThreshold(): number {
    return this.threshold;
  }

  /** Compute aggregate stats about the queue. */
  getStats(): ReviewQueueStats {
    const pending = this.items.filter((i) => i.status === 'pending');
    const approved = this.items.filter((i) => i.status === 'approved');
    const rejected = this.items.filter((i) => i.status === 'rejected');
    const expired = this.items.filter((i) => i.status === 'expired');

    const totalConfidence = this.items.reduce((sum, i) => sum + i.confidence, 0);
    const averageConfidence = this.items.length > 0 ? totalConfidence / this.items.length : 0;

    let oldestPendingAge: number | null = null;
    if (pending.length > 0) {
      const oldestTimestamp = Math.min(...pending.map((i) => i.timestamp));
      oldestPendingAge = Date.now() - oldestTimestamp;
    }

    return {
      total: this.items.length,
      pending: pending.length,
      approved: approved.length,
      rejected: rejected.length,
      expired: expired.length,
      averageConfidence,
      oldestPendingAge,
    };
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   * Callback is invoked whenever items are added, approved, rejected, expired, or cleared.
   */
  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  /** Persist queue to localStorage. */
  private save(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const data = { items: this.items, threshold: this.threshold };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

  /** Load queue from localStorage. */
  private load(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) {
        this.items = [];
        return;
      }

      const data = parsed as Record<string, unknown>;

      // Load threshold
      if (typeof data.threshold === 'number') {
        this.threshold = Math.max(0, Math.min(100, data.threshold));
      }

      // Load items
      if (!Array.isArray(data.items)) {
        this.items = [];
        return;
      }

      this.items = (data.items as unknown[]).filter(
        (item: unknown): item is ReviewItem =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as ReviewItem).id === 'string' &&
          typeof (item as ReviewItem).action === 'string' &&
          typeof (item as ReviewItem).description === 'string' &&
          typeof (item as ReviewItem).confidence === 'number' &&
          typeof (item as ReviewItem).timestamp === 'number' &&
          typeof (item as ReviewItem).status === 'string' &&
          ['pending', 'approved', 'rejected', 'expired'].includes((item as ReviewItem).status),
      );
    } catch {
      // Corrupt data — start fresh
      this.items = [];
    }
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /** Notify all subscribers of a state change. */
  private notify(): void {
    this.subscribers.forEach((cb) => {
      cb();
    });
  }

  /**
   * Enforce the max items limit. When over MAX_ITEMS:
   * 1. Evict oldest resolved (approved/rejected/expired) first
   * 2. If still over, evict oldest pending
   */
  private enforceLimit(): void {
    while (this.items.length > MAX_ITEMS) {
      // Try to find resolved items to evict (oldest first)
      const resolvedIndices: number[] = [];
      this.items.forEach((item, index) => {
        if (item.status !== 'pending') {
          resolvedIndices.push(index);
        }
      });

      if (resolvedIndices.length > 0) {
        // Find the oldest resolved item
        let oldestIdx = resolvedIndices[0];
        for (const idx of resolvedIndices) {
          if (this.items[idx].timestamp < this.items[oldestIdx].timestamp) {
            oldestIdx = idx;
          }
        }
        this.items.splice(oldestIdx, 1);
      } else {
        // All items are pending — evict the oldest
        let oldestIdx = 0;
        for (let i = 1; i < this.items.length; i++) {
          if (this.items[i].timestamp < this.items[oldestIdx].timestamp) {
            oldestIdx = i;
          }
        }
        this.items.splice(oldestIdx, 1);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook for accessing the AI review queue in React components.
 * Subscribes to the ReviewQueueManager and triggers re-renders on state changes.
 * Safe for SSR (checks typeof window).
 */
export function useReviewQueue(): {
  pendingItems: ReviewItem[];
  approvedItems: ReviewItem[];
  rejectedItems: ReviewItem[];
  stats: ReviewQueueStats;
  approveItem: (id: string) => boolean;
  rejectItem: (id: string, reason?: string) => boolean;
  addToQueue: (item: Omit<ReviewItem, 'id' | 'status' | 'timestamp'>) => string;
  clearResolved: () => void;
  threshold: number;
  setThreshold: (value: number) => void;
  shouldQueue: (confidence: number) => boolean;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const manager = ReviewQueueManager.getInstance();
    const unsubscribe = manager.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const addToQueue = useCallback((item: Omit<ReviewItem, 'id' | 'status' | 'timestamp'>) => {
    return ReviewQueueManager.getInstance().addToQueue(item);
  }, []);

  const approveItem = useCallback((id: string) => {
    return ReviewQueueManager.getInstance().approveItem(id);
  }, []);

  const rejectItem = useCallback((id: string, reason?: string) => {
    return ReviewQueueManager.getInstance().rejectItem(id, reason);
  }, []);

  const clearResolved = useCallback(() => {
    ReviewQueueManager.getInstance().clearResolved();
  }, []);

  const setThreshold = useCallback((value: number) => {
    ReviewQueueManager.getInstance().setThreshold(value);
  }, []);

  const shouldQueue = useCallback((confidence: number) => {
    return ReviewQueueManager.getInstance().shouldQueue(confidence);
  }, []);

  const manager = typeof window !== 'undefined' ? ReviewQueueManager.getInstance() : null;

  const emptyStats: ReviewQueueStats = {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    expired: 0,
    averageConfidence: 0,
    oldestPendingAge: null,
  };

  return {
    pendingItems: manager?.getPendingItems() ?? [],
    approvedItems: manager?.getApprovedItems() ?? [],
    rejectedItems: manager?.getRejectedItems() ?? [],
    stats: manager?.getStats() ?? emptyStats,
    approveItem,
    rejectItem,
    addToQueue,
    clearResolved,
    threshold: manager?.getThreshold() ?? DEFAULT_THRESHOLD,
    setThreshold,
    shouldQueue,
  };
}
