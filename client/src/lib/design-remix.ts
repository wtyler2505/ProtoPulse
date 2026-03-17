/**
 * Design Remix Manager
 *
 * Allows users to "remix" (fork) an existing project design, creating a new
 * project with selectively copied data (architecture, BOM, circuit, notes).
 * All IDs are remapped to fresh UUIDs so the remix is fully independent.
 *
 * Usage:
 *   const manager = DesignRemixManager.getInstance();
 *   const result = manager.createRemix(source, { keepArchitecture: true, keepBom: true, newName: 'My Fork' });
 *
 * React hook:
 *   const { createRemix, getRemixHistory, isRemix, getOriginalSource } = useDesignRemix();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Metadata about the original design that was remixed. */
export interface RemixSource {
  id: string;
  originalProjectId: string;
  originalName: string;
  author: string;
  remixedAt: number;
}

/** Options controlling what data to carry over from the original design. */
export interface RemixOptions {
  keepArchitecture: boolean;
  keepBom: boolean;
  keepCircuit: boolean;
  keepNotes: boolean;
  newName: string;
}

/** A single node/edge/item from source data, keyed by an id field. */
export interface RemixableItem {
  id: string;
  [key: string]: unknown;
}

/** The input data that can be remixed — all fields optional. */
export interface RemixInputData {
  architecture?: RemixableItem[];
  bom?: RemixableItem[];
  circuit?: RemixableItem[];
  notes?: RemixableItem[];
}

/** The result of creating a remix. */
export interface RemixResult {
  remixId: string;
  newProjectId: string;
  source: RemixSource;
  data: RemixInputData;
  idMap: Map<string, string>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-design-remix-history';
const MAX_HISTORY = 100;

// ---------------------------------------------------------------------------
// DesignRemixManager
// ---------------------------------------------------------------------------

/**
 * Manages design remixing: forking projects with selective data copy and
 * full ID remapping. Singleton per application with localStorage persistence.
 */
export class DesignRemixManager {
  private static instance: DesignRemixManager | null = null;

  private history: Map<string, RemixSource>;
  private subscribers: Set<() => void>;

  constructor() {
    this.history = new Map();
    this.subscribers = new Set();
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): DesignRemixManager {
    if (!DesignRemixManager.instance) {
      DesignRemixManager.instance = new DesignRemixManager();
    }
    return DesignRemixManager.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetInstance(): void {
    DesignRemixManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Core operations
  // -----------------------------------------------------------------------

  /**
   * Create a remix from a source project with the given options.
   *
   * - Generates a new project ID and remix ID.
   * - Deep-clones selected data sections, remapping all IDs to fresh UUIDs.
   * - Records the remix source in history for provenance tracking.
   * - Persists history and notifies subscribers.
   *
   * @param source Metadata about the original project (originalProjectId, originalName, author).
   * @param options Controls which data sections to keep and the new project name.
   * @param data The source data to selectively copy.
   * @returns A RemixResult with the new IDs, remapped data, and full ID map.
   */
  createRemix(
    source: Omit<RemixSource, 'id' | 'remixedAt'>,
    options: RemixOptions,
    data: RemixInputData = {},
  ): RemixResult {
    const remixId = crypto.randomUUID();
    const newProjectId = crypto.randomUUID();
    const idMap = new Map<string, string>();

    const remixSource: RemixSource = {
      ...source,
      id: remixId,
      remixedAt: Date.now(),
    };

    // Selectively remap data based on options
    const remixedData: RemixInputData = {};

    if (options.keepArchitecture && data.architecture) {
      remixedData.architecture = this.remapIds(data.architecture, idMap);
    }
    if (options.keepBom && data.bom) {
      remixedData.bom = this.remapIds(data.bom, idMap);
    }
    if (options.keepCircuit && data.circuit) {
      remixedData.circuit = this.remapIds(data.circuit, idMap);
    }
    if (options.keepNotes && data.notes) {
      remixedData.notes = this.remapIds(data.notes, idMap);
    }

    // Store provenance: newProjectId -> source info
    this.history.set(newProjectId, remixSource);
    this.enforceLimit();
    this.save();
    this.notify();

    return {
      remixId,
      newProjectId,
      source: remixSource,
      data: remixedData,
      idMap,
    };
  }

  /**
   * Get the full remix history for a given original project ID.
   * Returns all RemixSources where originalProjectId matches, sorted by
   * remixedAt descending (most recent first).
   */
  getRemixHistory(projectId: string): RemixSource[] {
    const results: RemixSource[] = Array.from(this.history.values()).filter(
      (source) => source.originalProjectId === projectId,
    );
    return results.sort((a, b) => b.remixedAt - a.remixedAt);
  }

  /** Check whether a project ID is the result of a remix. */
  isRemix(projectId: string): boolean {
    return this.history.has(projectId);
  }

  /** Get the original source info for a remixed project, or null if not a remix. */
  getOriginalSource(projectId: string): RemixSource | null {
    return this.history.get(projectId) ?? null;
  }

  /**
   * Remove a remix entry from history. Returns true if found and removed.
   */
  removeFromHistory(projectId: string): boolean {
    const deleted = this.history.delete(projectId);
    if (deleted) {
      this.save();
      this.notify();
    }
    return deleted;
  }

  /** Clear all remix history. */
  clearHistory(): void {
    if (this.history.size === 0) {
      return;
    }
    this.history.clear();
    this.save();
    this.notify();
  }

  /** Get the total number of remix entries in history. */
  getHistorySize(): number {
    return this.history.size;
  }

  // -----------------------------------------------------------------------
  // ID remapping
  // -----------------------------------------------------------------------

  /**
   * Deep-clone an array of items, replacing every `id` field with a new UUID.
   * Also replaces any string values that match a previously-remapped ID
   * (cross-references like sourceId, targetId, parentId, etc.).
   *
   * The idMap is populated as a side-effect: oldId -> newId.
   */
  remapIds(items: RemixableItem[], idMap: Map<string, string> = new Map()): RemixableItem[] {
    // First pass: generate new IDs for all items
    for (const item of items) {
      if (typeof item.id === 'string' && !idMap.has(item.id)) {
        idMap.set(item.id, crypto.randomUUID());
      }
    }

    // Second pass: deep-clone with remapped IDs
    return items.map((item) => this.deepRemapItem(item, idMap));
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   * Callback is invoked whenever history changes.
   */
  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Deep-clone a single item, replacing id and any string values that
   * appear in the idMap with their remapped counterparts.
   */
  private deepRemapItem(item: RemixableItem, idMap: Map<string, string>): RemixableItem {
    const cloned: RemixableItem = { id: '' };

    for (const [key, value] of Object.entries(item)) {
      if (key === 'id') {
        cloned.id = idMap.get(item.id) ?? crypto.randomUUID();
      } else {
        cloned[key] = this.deepRemapValue(value, idMap);
      }
    }

    return cloned;
  }

  /**
   * Recursively remap values:
   * - Strings that match an idMap key are replaced.
   * - Arrays are mapped recursively.
   * - Plain objects are recursively remapped.
   * - Primitives pass through unchanged.
   */
  private deepRemapValue(value: unknown, idMap: Map<string, string>): unknown {
    if (typeof value === 'string') {
      return idMap.get(value) ?? value;
    }
    if (Array.isArray(value)) {
      return value.map((v: unknown) => this.deepRemapValue(v, idMap));
    }
    if (typeof value === 'object' && value !== null) {
      const obj = value as Record<string, unknown>;
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        result[k] = this.deepRemapValue(v, idMap);
      }
      return result;
    }
    return value;
  }

  /** Notify all subscribers of a state change. */
  private notify(): void {
    this.subscribers.forEach((cb) => {
      cb();
    });
  }

  /** Enforce the max history limit by evicting oldest entries. */
  private enforceLimit(): void {
    if (this.history.size <= MAX_HISTORY) {
      return;
    }

    // Sort entries by remixedAt ascending (oldest first)
    const entries = Array.from(this.history.entries()).sort(
      ([, a], [, b]) => a.remixedAt - b.remixedAt,
    );

    // Remove oldest entries until within limit
    const toRemove = entries.length - MAX_HISTORY;
    for (let i = 0; i < toRemove; i++) {
      this.history.delete(entries[i][0]);
    }
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  /** Persist remix history to localStorage. */
  private save(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const entries = Array.from(this.history.entries());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

  /** Load remix history from localStorage. */
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
        this.history = new Map();
        return;
      }

      this.history = new Map();
      for (const entry of parsed as unknown[]) {
        if (!Array.isArray(entry) || entry.length !== 2) {
          continue;
        }
        const [key, value] = entry as [unknown, unknown];
        if (typeof key !== 'string' || !this.isValidRemixSource(value)) {
          continue;
        }
        this.history.set(key, value as RemixSource);
      }
    } catch {
      // Corrupt data — start fresh
      this.history = new Map();
    }
  }

  /** Type guard for validating a RemixSource from untrusted localStorage data. */
  private isValidRemixSource(value: unknown): value is RemixSource {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const obj = value as Record<string, unknown>;
    return (
      typeof obj.id === 'string' &&
      typeof obj.originalProjectId === 'string' &&
      typeof obj.originalName === 'string' &&
      typeof obj.author === 'string' &&
      typeof obj.remixedAt === 'number'
    );
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook for accessing the design remix system in React components.
 * Subscribes to DesignRemixManager and triggers re-renders on state changes.
 */
export function useDesignRemix(): {
  createRemix: (
    source: Omit<RemixSource, 'id' | 'remixedAt'>,
    options: RemixOptions,
    data?: RemixInputData,
  ) => RemixResult;
  getRemixHistory: (projectId: string) => RemixSource[];
  isRemix: (projectId: string) => boolean;
  getOriginalSource: (projectId: string) => RemixSource | null;
  removeFromHistory: (projectId: string) => boolean;
  clearHistory: () => void;
  historySize: number;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const manager = DesignRemixManager.getInstance();
    const unsubscribe = manager.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const createRemix = useCallback(
    (
      source: Omit<RemixSource, 'id' | 'remixedAt'>,
      options: RemixOptions,
      data?: RemixInputData,
    ) => {
      return DesignRemixManager.getInstance().createRemix(source, options, data);
    },
    [],
  );

  const getRemixHistory = useCallback((projectId: string) => {
    return DesignRemixManager.getInstance().getRemixHistory(projectId);
  }, []);

  const isRemix = useCallback((projectId: string) => {
    return DesignRemixManager.getInstance().isRemix(projectId);
  }, []);

  const getOriginalSource = useCallback((projectId: string) => {
    return DesignRemixManager.getInstance().getOriginalSource(projectId);
  }, []);

  const removeFromHistory = useCallback((projectId: string) => {
    return DesignRemixManager.getInstance().removeFromHistory(projectId);
  }, []);

  const clearHistory = useCallback(() => {
    DesignRemixManager.getInstance().clearHistory();
  }, []);

  const manager = typeof window !== 'undefined' ? DesignRemixManager.getInstance() : null;

  return {
    createRemix,
    getRemixHistory,
    isRemix,
    getOriginalSource,
    removeFromHistory,
    clearHistory,
    historySize: manager?.getHistorySize() ?? 0,
  };
}
