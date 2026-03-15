/**
 * Circuit Selector — per-project active circuit selection
 *
 * Manages which circuit design is currently selected for export, ordering,
 * and simulation flows. Persists selection per project to localStorage.
 * Singleton+subscribe pattern for React integration.
 *
 * Usage:
 *   const selector = CircuitSelector.getInstance();
 *   selector.select(projectId, circuitId, 'Main Circuit');
 *   selector.getSelected(projectId); // { circuitId: 42, circuitName: 'Main Circuit' }
 *
 * React hook:
 *   const { selected, select, clear } = useCircuitSelector(projectId);
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CircuitSelection {
  circuitId: number;
  circuitName: string;
  selectedAt: number;
}

/** Serialized shape in localStorage — keyed by project ID. */
interface PersistedSelections {
  [projectId: string]: CircuitSelection;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-circuit-selection';

// ---------------------------------------------------------------------------
// CircuitSelector
// ---------------------------------------------------------------------------

/**
 * Manages per-project circuit selection with localStorage persistence.
 * Singleton per application. Notifies subscribers on state changes.
 */
export class CircuitSelector {
  private static instance: CircuitSelector | null = null;

  private selections: Map<number, CircuitSelection>;
  private subscribers: Set<() => void>;

  constructor() {
    this.selections = new Map();
    this.subscribers = new Set();
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): CircuitSelector {
    if (!CircuitSelector.instance) {
      CircuitSelector.instance = new CircuitSelector();
    }
    return CircuitSelector.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetInstance(): void {
    CircuitSelector.instance = null;
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /** Get the selected circuit for a project, or null if none selected. */
  getSelected(projectId: number): CircuitSelection | null {
    return this.selections.get(projectId) ?? null;
  }

  /** Check whether a specific circuit is selected for a project. */
  isSelected(projectId: number, circuitId: number): boolean {
    const sel = this.selections.get(projectId);
    return sel !== null && sel !== undefined && sel.circuitId === circuitId;
  }

  /** Get all project IDs that have a selection. */
  getProjectIds(): number[] {
    return Array.from(this.selections.keys());
  }

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------

  /** Select a circuit for a project. Overwrites any previous selection. */
  select(projectId: number, circuitId: number, circuitName: string): void {
    const existing = this.selections.get(projectId);
    if (existing && existing.circuitId === circuitId) {
      return; // Already selected — no-op
    }

    this.selections.set(projectId, {
      circuitId,
      circuitName,
      selectedAt: Date.now(),
    });

    this.save();
    this.notify();
  }

  /** Clear the selection for a project. */
  clear(projectId: number): void {
    if (!this.selections.has(projectId)) {
      return;
    }

    this.selections.delete(projectId);
    this.save();
    this.notify();
  }

  /** Clear all selections across all projects. */
  clearAll(): void {
    if (this.selections.size === 0) {
      return;
    }

    this.selections.clear();
    this.save();
    this.notify();
  }

  /**
   * Validate and auto-correct the selection for a project.
   * If the selected circuit ID is no longer in the available list,
   * clear the selection. If no circuit is selected but circuits exist,
   * auto-select the first one.
   *
   * Returns the resolved selection (may be null if no circuits available).
   */
  reconcile(
    projectId: number,
    availableCircuits: ReadonlyArray<{ id: number; name: string }>,
  ): CircuitSelection | null {
    const current = this.selections.get(projectId);

    if (availableCircuits.length === 0) {
      // No circuits available — clear any stale selection
      if (current) {
        this.selections.delete(projectId);
        this.save();
        this.notify();
      }
      return null;
    }

    // If current selection is still valid, keep it
    if (current && availableCircuits.some((c) => c.id === current.circuitId)) {
      return current;
    }

    // Current selection is stale or missing — auto-select first circuit
    const first = availableCircuits[0];
    const selection: CircuitSelection = {
      circuitId: first.id,
      circuitName: first.name,
      selectedAt: Date.now(),
    };

    this.selections.set(projectId, selection);
    this.save();
    this.notify();

    return selection;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   * Callback is invoked whenever selections change.
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

  /** Persist selections to localStorage. */
  private save(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const obj: PersistedSelections = {};
      for (const [projectId, sel] of Array.from(this.selections.entries())) {
        obj[String(projectId)] = sel;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

  /** Load selections from localStorage. */
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
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return;
      }

      const obj = parsed as Record<string, unknown>;
      for (const [key, value] of Object.entries(obj)) {
        const projectId = Number(key);
        if (Number.isNaN(projectId) || projectId <= 0) {
          continue;
        }
        if (
          typeof value === 'object' &&
          value !== null &&
          typeof (value as CircuitSelection).circuitId === 'number' &&
          typeof (value as CircuitSelection).circuitName === 'string' &&
          typeof (value as CircuitSelection).selectedAt === 'number'
        ) {
          this.selections.set(projectId, value as CircuitSelection);
        }
      }
    } catch {
      // Corrupt data — start fresh
      this.selections = new Map();
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
 * Hook for accessing circuit selection in React components.
 * Subscribes to the CircuitSelector and triggers re-renders on state changes.
 * Automatically reconciles selection against available circuits.
 */
export function useCircuitSelector(
  projectId: number,
  availableCircuits?: ReadonlyArray<{ id: number; name: string }>,
): {
  selected: CircuitSelection | null;
  select: (circuitId: number, circuitName: string) => void;
  clear: () => void;
  isSelected: (circuitId: number) => boolean;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const selector = CircuitSelector.getInstance();
    const unsubscribe = selector.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  // Auto-reconcile when available circuits change
  useEffect(() => {
    if (typeof window === 'undefined' || !availableCircuits) {
      return;
    }
    CircuitSelector.getInstance().reconcile(projectId, availableCircuits);
  }, [projectId, availableCircuits]);

  const select = useCallback(
    (circuitId: number, circuitName: string) => {
      CircuitSelector.getInstance().select(projectId, circuitId, circuitName);
    },
    [projectId],
  );

  const clear = useCallback(() => {
    CircuitSelector.getInstance().clear(projectId);
  }, [projectId]);

  const isSelected = useCallback(
    (circuitId: number) => {
      return CircuitSelector.getInstance().isSelected(projectId, circuitId);
    },
    [projectId],
  );

  const selector = CircuitSelector.getInstance();

  return {
    selected: typeof window !== 'undefined' ? selector.getSelected(projectId) : null,
    select,
    clear,
    isSelected,
  };
}
