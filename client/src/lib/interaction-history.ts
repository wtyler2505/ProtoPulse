/**
 * Interaction History Manager
 *
 * Tracks user interaction events (navigation, edits, creates, deletes, exports,
 * imports) with localStorage persistence. Supports stepping back through recent
 * history and filtering by view. FIFO eviction at 200 entries.
 *
 * Usage:
 *   const manager = InteractionHistoryManager.getInstance();
 *   manager.recordInteraction({
 *     id: crypto.randomUUID(),
 *     type: 'navigate',
 *     view: 'architecture',
 *     timestamp: Date.now(),
 *     undoable: false,
 *   });
 *
 * React hook:
 *   const { history, recordInteraction, stepBack, canStepBack } = useInteractionHistory();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InteractionType = 'navigate' | 'edit' | 'create' | 'delete' | 'export' | 'import';

export interface InteractionEvent {
  id: string;
  type: InteractionType;
  view: string;
  entityType?: string;
  entityId?: string;
  timestamp: number;
  undoable: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse:interaction-history';
const MAX_ENTRIES = 200;

// ---------------------------------------------------------------------------
// InteractionHistoryManager
// ---------------------------------------------------------------------------

/**
 * Manages a chronological list of user interaction events with localStorage
 * persistence. Singleton per application. Notifies subscribers on state changes.
 */
export class InteractionHistoryManager {
  private static instance: InteractionHistoryManager | null = null;

  private history: InteractionEvent[];
  private subscribers: Set<() => void>;
  private cursor: number;

  constructor() {
    this.history = [];
    this.subscribers = new Set();
    this.cursor = -1;
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): InteractionHistoryManager {
    if (!InteractionHistoryManager.instance) {
      InteractionHistoryManager.instance = new InteractionHistoryManager();
    }
    return InteractionHistoryManager.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetInstance(): void {
    InteractionHistoryManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Recording
  // -----------------------------------------------------------------------

  /**
   * Record a new interaction event. Appends to the end of history (newest last).
   * If the list exceeds MAX_ENTRIES, the oldest entry is evicted (FIFO).
   * Resets the step-back cursor to the end of the list.
   */
  recordInteraction(event: InteractionEvent): void {
    if (!event.id || !event.type || !event.view || typeof event.timestamp !== 'number') {
      return;
    }

    this.history.push(event);

    // FIFO eviction
    while (this.history.length > MAX_ENTRIES) {
      this.history.shift();
    }

    // Reset cursor to end
    this.cursor = this.history.length - 1;

    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /**
   * Get the most recent interaction events.
   * Returns a copy sorted newest-first.
   * @param limit Maximum number of entries to return. Defaults to all.
   */
  getHistory(limit?: number): InteractionEvent[] {
    const sorted = [...this.history].reverse();
    if (limit !== undefined && limit > 0) {
      return sorted.slice(0, limit);
    }
    return sorted;
  }

  /**
   * Get interaction events for a specific view, newest first.
   * @param view The view name to filter by.
   */
  getHistoryForView(view: string): InteractionEvent[] {
    return this.history.filter((e) => e.view === view).reverse();
  }

  /** Get the total number of recorded interactions. */
  getCount(): number {
    return this.history.length;
  }

  // -----------------------------------------------------------------------
  // Step-back navigation
  // -----------------------------------------------------------------------

  /**
   * Step back through the history by the given number of steps.
   * Returns the interaction event at the resulting position,
   * or undefined if stepping back is not possible.
   * @param steps Number of steps to go back (must be >= 1).
   */
  stepBack(steps = 1): InteractionEvent | undefined {
    if (steps < 1) {
      return undefined;
    }

    const targetCursor = this.cursor - steps;
    if (targetCursor < 0 || this.history.length === 0) {
      return undefined;
    }

    this.cursor = targetCursor;
    this.notify();
    return this.history[this.cursor];
  }

  /**
   * Check whether stepping back is possible from the current cursor position.
   */
  canStepBack(): boolean {
    return this.cursor > 0 && this.history.length > 0;
  }

  /** Get the current cursor position. */
  getCursor(): number {
    return this.cursor;
  }

  /** Get the event at the current cursor position, or undefined if empty. */
  getCurrentEvent(): InteractionEvent | undefined {
    if (this.cursor < 0 || this.cursor >= this.history.length) {
      return undefined;
    }
    return this.history[this.cursor];
  }

  // -----------------------------------------------------------------------
  // Clear
  // -----------------------------------------------------------------------

  /** Remove all interaction history. */
  clearHistory(): void {
    if (this.history.length === 0) {
      return;
    }
    this.history = [];
    this.cursor = -1;
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   * Callback is invoked whenever history is recorded, stepped through, or cleared.
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

  /** Persist history to localStorage. */
  private save(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

  /** Load history from localStorage. */
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
      if (!Array.isArray(parsed)) {
        this.history = [];
        return;
      }
      // Validate each entry
      this.history = parsed.filter(
        (item: unknown): item is InteractionEvent =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as InteractionEvent).id === 'string' &&
          typeof (item as InteractionEvent).type === 'string' &&
          typeof (item as InteractionEvent).view === 'string' &&
          typeof (item as InteractionEvent).timestamp === 'number' &&
          typeof (item as InteractionEvent).undoable === 'boolean',
      );

      // Enforce max on load in case storage was edited externally
      while (this.history.length > MAX_ENTRIES) {
        this.history.shift();
      }

      // Set cursor to end
      this.cursor = this.history.length > 0 ? this.history.length - 1 : -1;
    } catch {
      // Corrupt data - start fresh
      this.history = [];
      this.cursor = -1;
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
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook for accessing interaction history in React components.
 * Subscribes to InteractionHistoryManager and triggers re-renders on changes.
 */
export function useInteractionHistory(): {
  history: InteractionEvent[];
  recordInteraction: (event: InteractionEvent) => void;
  getHistoryForView: (view: string) => InteractionEvent[];
  stepBack: (steps?: number) => InteractionEvent | undefined;
  canStepBack: () => boolean;
  clearHistory: () => void;
  count: number;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const manager = InteractionHistoryManager.getInstance();
    const unsubscribe = manager.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const recordInteraction = useCallback((event: InteractionEvent) => {
    InteractionHistoryManager.getInstance().recordInteraction(event);
  }, []);

  const getHistoryForView = useCallback((view: string) => {
    return InteractionHistoryManager.getInstance().getHistoryForView(view);
  }, []);

  const stepBack = useCallback((steps?: number) => {
    return InteractionHistoryManager.getInstance().stepBack(steps);
  }, []);

  const canStepBack = useCallback(() => {
    return InteractionHistoryManager.getInstance().canStepBack();
  }, []);

  const clearHistory = useCallback(() => {
    InteractionHistoryManager.getInstance().clearHistory();
  }, []);

  const manager = InteractionHistoryManager.getInstance();

  return {
    history: typeof window !== 'undefined' ? manager.getHistory() : [],
    recordInteraction,
    getHistoryForView,
    stepBack,
    canStepBack,
    clearHistory,
    count: typeof window !== 'undefined' ? manager.getCount() : 0,
  };
}
