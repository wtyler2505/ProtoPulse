/**
 * Firmware Snapshot Manager
 *
 * Tracks firmware compilation snapshots per project. Each snapshot captures
 * the board target, sketch source code, compilation timestamp, and a quality
 * status (good / bad / untested). Persists to localStorage with a maximum of
 * 10 snapshots per project (FIFO eviction on the oldest entry when the limit
 * is exceeded).
 *
 * Usage:
 *   const mgr = FirmwareSnapshotManager.getInstance();
 *   mgr.saveSnapshot({ id: crypto.randomUUID(), projectId: '1', board: 'arduino:avr:mega',
 *     sketchCode: '...', compiledAt: Date.now(), status: 'untested' });
 *   mgr.getLastKnownGood('1'); // latest snapshot with status === 'good'
 *
 * React hook:
 *   const { snapshots, saveSnapshot, restoreSnapshot, ... } = useFirmwareSnapshots('1');
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FirmwareSnapshotStatus = 'good' | 'bad' | 'untested';

export interface FirmwareSnapshot {
  id: string;
  projectId: string;
  board: string;
  sketchCode: string;
  compiledAt: number;
  status: FirmwareSnapshotStatus;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse:firmware-snapshots';
const MAX_SNAPSHOTS_PER_PROJECT = 10;

// ---------------------------------------------------------------------------
// FirmwareSnapshotManager
// ---------------------------------------------------------------------------

/**
 * Manages firmware compilation snapshots with localStorage persistence.
 * Singleton per application. Notifies subscribers on state changes.
 */
export class FirmwareSnapshotManager {
  private static instance: FirmwareSnapshotManager | null = null;

  private snapshots: FirmwareSnapshot[];
  private subscribers: Set<() => void>;

  constructor() {
    this.snapshots = [];
    this.subscribers = new Set();
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): FirmwareSnapshotManager {
    if (!FirmwareSnapshotManager.instance) {
      FirmwareSnapshotManager.instance = new FirmwareSnapshotManager();
    }
    return FirmwareSnapshotManager.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetInstance(): void {
    FirmwareSnapshotManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /**
   * Get all snapshots for a given project, sorted by compiledAt descending
   * (newest first). Returns a copy to prevent external mutation.
   */
  getSnapshots(projectId: string): FirmwareSnapshot[] {
    return this.snapshots
      .filter((s) => s.projectId === projectId)
      .sort((a, b) => b.compiledAt - a.compiledAt)
      .map((s) => ({ ...s }));
  }

  /**
   * Get the most recent snapshot with status === 'good' for a project.
   * Returns null if none exists.
   */
  getLastKnownGood(projectId: string): FirmwareSnapshot | null {
    const goods = this.snapshots
      .filter((s) => s.projectId === projectId && s.status === 'good')
      .sort((a, b) => b.compiledAt - a.compiledAt);
    return goods.length > 0 ? { ...goods[0] } : null;
  }

  /**
   * Restore a snapshot's sketch code by ID.
   * Returns the sketchCode string, or null if not found.
   */
  restoreSnapshot(id: string): string | null {
    const snapshot = this.snapshots.find((s) => s.id === id);
    return snapshot ? snapshot.sketchCode : null;
  }

  /** Get a single snapshot by ID. Returns null if not found. */
  getSnapshot(id: string): FirmwareSnapshot | null {
    const snapshot = this.snapshots.find((s) => s.id === id);
    return snapshot ? { ...snapshot } : null;
  }

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------

  /**
   * Save a new firmware snapshot. Enforces a maximum of 10 snapshots per
   * project — when exceeded, the oldest snapshot (by compiledAt) is evicted.
   * If a snapshot with the same ID already exists, this is a no-op.
   */
  saveSnapshot(snapshot: FirmwareSnapshot): void {
    // Duplicate ID guard
    if (this.snapshots.some((s) => s.id === snapshot.id)) {
      return;
    }

    this.snapshots.push({ ...snapshot });

    // Enforce per-project limit
    const projectSnapshots = this.snapshots
      .filter((s) => s.projectId === snapshot.projectId)
      .sort((a, b) => a.compiledAt - b.compiledAt); // oldest first

    if (projectSnapshots.length > MAX_SNAPSHOTS_PER_PROJECT) {
      const evictCount = projectSnapshots.length - MAX_SNAPSHOTS_PER_PROJECT;
      const idsToEvict = new Set(projectSnapshots.slice(0, evictCount).map((s) => s.id));
      this.snapshots = this.snapshots.filter((s) => !idsToEvict.has(s.id));
    }

    this.save();
    this.notify();
  }

  /** Mark a snapshot as 'good'. Returns false if not found. */
  markAsGood(id: string): boolean {
    return this.setStatus(id, 'good');
  }

  /** Mark a snapshot as 'bad'. Returns false if not found. */
  markAsBad(id: string): boolean {
    return this.setStatus(id, 'bad');
  }

  /** Delete a snapshot by ID. Returns false if not found. */
  deleteSnapshot(id: string): boolean {
    const initialLength = this.snapshots.length;
    this.snapshots = this.snapshots.filter((s) => s.id !== id);
    if (this.snapshots.length !== initialLength) {
      this.save();
      this.notify();
      return true;
    }
    return false;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   * Callback is invoked whenever snapshots are saved/deleted/modified.
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

  /** Persist snapshots to localStorage. */
  private save(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.snapshots));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

  /** Load snapshots from localStorage. */
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
        this.snapshots = [];
        return;
      }
      // Validate each entry
      this.snapshots = parsed.filter(
        (item: unknown): item is FirmwareSnapshot =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as FirmwareSnapshot).id === 'string' &&
          typeof (item as FirmwareSnapshot).projectId === 'string' &&
          typeof (item as FirmwareSnapshot).board === 'string' &&
          typeof (item as FirmwareSnapshot).sketchCode === 'string' &&
          typeof (item as FirmwareSnapshot).compiledAt === 'number' &&
          typeof (item as FirmwareSnapshot).status === 'string' &&
          ['good', 'bad', 'untested'].includes((item as FirmwareSnapshot).status),
      );
    } catch {
      // Corrupt data — start fresh
      this.snapshots = [];
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

  /** Set a snapshot's status. Returns false if not found. */
  private setStatus(id: string, status: FirmwareSnapshotStatus): boolean {
    const snapshot = this.snapshots.find((s) => s.id === id);
    if (!snapshot) {
      return false;
    }
    if (snapshot.status === status) {
      return true; // already at desired status — still a success
    }
    snapshot.status = status;
    this.save();
    this.notify();
    return true;
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook for accessing firmware snapshots in React components.
 * Subscribes to the FirmwareSnapshotManager and triggers re-renders on
 * state changes. Scoped to a single projectId.
 * Safe for SSR (checks typeof window).
 */
export function useFirmwareSnapshots(projectId: string): {
  snapshots: FirmwareSnapshot[];
  lastKnownGood: FirmwareSnapshot | null;
  saveSnapshot: (snapshot: FirmwareSnapshot) => void;
  restoreSnapshot: (id: string) => string | null;
  markAsGood: (id: string) => boolean;
  markAsBad: (id: string) => boolean;
  deleteSnapshot: (id: string) => boolean;
  count: number;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const manager = FirmwareSnapshotManager.getInstance();
    const unsubscribe = manager.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const saveSnapshot = useCallback((snapshot: FirmwareSnapshot) => {
    FirmwareSnapshotManager.getInstance().saveSnapshot(snapshot);
  }, []);

  const restoreSnapshot = useCallback((id: string) => {
    return FirmwareSnapshotManager.getInstance().restoreSnapshot(id);
  }, []);

  const markAsGood = useCallback((id: string) => {
    return FirmwareSnapshotManager.getInstance().markAsGood(id);
  }, []);

  const markAsBad = useCallback((id: string) => {
    return FirmwareSnapshotManager.getInstance().markAsBad(id);
  }, []);

  const deleteSnapshot = useCallback((id: string) => {
    return FirmwareSnapshotManager.getInstance().deleteSnapshot(id);
  }, []);

  const manager = typeof window !== 'undefined' ? FirmwareSnapshotManager.getInstance() : null;

  return {
    snapshots: manager?.getSnapshots(projectId) ?? [],
    lastKnownGood: manager?.getLastKnownGood(projectId) ?? null,
    saveSnapshot,
    restoreSnapshot,
    markAsGood,
    markAsBad,
    deleteSnapshot,
    count: manager?.getSnapshots(projectId).length ?? 0,
  };
}
