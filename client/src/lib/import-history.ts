/**
 * Import History Manager
 *
 * Tracks design imports and allows one-click restore to any previous
 * import state. Persists to localStorage with a max limit of 20 entries.
 * Singleton + subscribe pattern for React integration.
 *
 * Usage:
 *   const manager = ImportHistoryManager.getInstance();
 *   manager.addEntry({ sourceFormat: 'kicad-schematic', fileName: 'circuit.kicad_sch', ... });
 *
 * React hook:
 *   const { entries, addEntry, deleteEntry, clear } = useImportHistory();
 */

import { useCallback, useEffect, useState } from 'react';

import type { ImportFormat } from '@/lib/design-import';
import type { ImportPreview } from '@/lib/import-preview';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImportHistoryEntry {
  /** Unique identifier for this history entry. */
  id: string;
  /** ISO-8601 timestamp of when the import occurred. */
  timestamp: string;
  /** The detected source format of the imported file. */
  sourceFormat: ImportFormat;
  /** Original file name. */
  fileName: string;
  /** Diff summary from the import preview engine. */
  preview: ImportPreview;
  /** Serialized snapshot data that can be used for restore. */
  snapshotData: unknown;
}

export interface NewImportHistoryEntry {
  sourceFormat: ImportFormat;
  fileName: string;
  preview: ImportPreview;
  snapshotData: unknown;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-import-history';
const MAX_ENTRIES = 20;

// ---------------------------------------------------------------------------
// ImportHistoryManager
// ---------------------------------------------------------------------------

/**
 * Manages a list of import history entries with localStorage persistence.
 * Singleton per application. Notifies subscribers on state changes.
 */
export class ImportHistoryManager {
  private static instance: ImportHistoryManager | null = null;

  private entries: ImportHistoryEntry[];
  private subscribers: Set<() => void>;

  constructor() {
    this.entries = [];
    this.subscribers = new Set();
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): ImportHistoryManager {
    if (!ImportHistoryManager.instance) {
      ImportHistoryManager.instance = new ImportHistoryManager();
    }
    return ImportHistoryManager.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetInstance(): void {
    ImportHistoryManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /**
   * Get all entries sorted by timestamp descending (newest first).
   * Returns a copy to prevent external mutation.
   */
  getEntries(): ImportHistoryEntry[] {
    return [...this.entries].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }

  /** Get a single entry by ID. Returns undefined if not found. */
  getEntry(id: string): ImportHistoryEntry | undefined {
    return this.entries.find((e) => e.id === id);
  }

  /** Get the number of entries. */
  getCount(): number {
    return this.entries.length;
  }

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------

  /**
   * Add a new import history entry. Prepends to the list.
   * When adding beyond MAX_ENTRIES, evicts the oldest entry.
   */
  addEntry(data: NewImportHistoryEntry): ImportHistoryEntry {
    const entry: ImportHistoryEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      sourceFormat: data.sourceFormat,
      fileName: data.fileName,
      preview: data.preview,
      snapshotData: data.snapshotData,
    };

    this.entries.unshift(entry);

    // Enforce max limit — evict oldest (last in the array since we prepend)
    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(0, MAX_ENTRIES);
    }

    this.save();
    this.notify();
    return entry;
  }

  /** Remove an entry by ID. */
  deleteEntry(id: string): void {
    const initialLength = this.entries.length;
    this.entries = this.entries.filter((e) => e.id !== id);
    if (this.entries.length !== initialLength) {
      this.save();
      this.notify();
    }
  }

  /** Remove all entries. */
  clear(): void {
    if (this.entries.length === 0) {
      return;
    }
    this.entries = [];
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   * Callback is invoked whenever entries are added/removed/cleared.
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

  /** Persist entries to localStorage. */
  private save(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

  /** Load entries from localStorage. */
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
        this.entries = [];
        return;
      }
      // Validate each entry
      this.entries = parsed.filter(
        (item: unknown): item is ImportHistoryEntry =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as ImportHistoryEntry).id === 'string' &&
          typeof (item as ImportHistoryEntry).timestamp === 'string' &&
          typeof (item as ImportHistoryEntry).sourceFormat === 'string' &&
          typeof (item as ImportHistoryEntry).fileName === 'string' &&
          typeof (item as ImportHistoryEntry).preview === 'object' &&
          (item as ImportHistoryEntry).preview !== null,
      );
    } catch {
      // Corrupt data — start fresh
      this.entries = [];
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
 * Hook for accessing import history in React components.
 * Subscribes to the ImportHistoryManager and triggers re-renders on state changes.
 */
export function useImportHistory(): {
  entries: ImportHistoryEntry[];
  addEntry: (data: NewImportHistoryEntry) => ImportHistoryEntry;
  getEntry: (id: string) => ImportHistoryEntry | undefined;
  deleteEntry: (id: string) => void;
  clear: () => void;
  count: number;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const manager = ImportHistoryManager.getInstance();
    const unsubscribe = manager.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const addEntry = useCallback((data: NewImportHistoryEntry) => {
    return ImportHistoryManager.getInstance().addEntry(data);
  }, []);

  const getEntry = useCallback((id: string) => {
    return ImportHistoryManager.getInstance().getEntry(id);
  }, []);

  const deleteEntry = useCallback((id: string) => {
    ImportHistoryManager.getInstance().deleteEntry(id);
  }, []);

  const clear = useCallback(() => {
    ImportHistoryManager.getInstance().clear();
  }, []);

  const manager = ImportHistoryManager.getInstance();

  return {
    entries: typeof window !== 'undefined' ? manager.getEntries() : [],
    addEntry,
    getEntry,
    deleteEntry,
    clear,
    count: typeof window !== 'undefined' ? manager.getCount() : 0,
  };
}
