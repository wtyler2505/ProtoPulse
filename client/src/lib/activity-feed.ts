/**
 * ActivityFeedManager — Tracks project-level activity events (created, updated,
 * deleted, commented, exported, imported, validated) and surfaces them in a
 * scrollable, filterable feed panel.
 *
 * Singleton + subscribe pattern for useSyncExternalStore integration.
 * Pure module — no React/DOM dependencies (except the hook at the bottom).
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = () => void;

/** Actions that can appear in the activity feed. */
export type ActivityAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'commented'
  | 'exported'
  | 'imported'
  | 'validated';

/** The kind of entity the action was performed on. */
export type ActivityEntityType =
  | 'project'
  | 'architecture_node'
  | 'architecture_edge'
  | 'bom_item'
  | 'circuit_design'
  | 'circuit_instance'
  | 'circuit_wire'
  | 'circuit_net'
  | 'component'
  | 'validation'
  | 'comment'
  | 'export'
  | 'simulation';

/** A single activity event. */
export interface ActivityEntry {
  readonly id: string;
  readonly timestamp: number;
  readonly action: ActivityAction;
  readonly entityType: ActivityEntityType;
  readonly entityId: string;
  readonly entityLabel: string;
  readonly userId?: string;
  readonly userName?: string;
  readonly details?: string;
}

/** Serialised shape stored in localStorage. */
interface PersistedEntry {
  id: string;
  timestamp: number;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  userId?: string;
  userName?: string;
  details?: string;
}

/** Filter criteria for querying the feed. */
export interface ActivityFilter {
  action?: ActivityAction;
  entityType?: ActivityEntityType;
  userId?: string;
  search?: string;
}

/** Snapshot shape exposed to React via useSyncExternalStore-style subscription. */
export interface ActivityFeedState {
  readonly entries: readonly ActivityEntry[];
  readonly version: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_PREFIX = 'protopulse-activity-feed-';
const MAX_ENTRIES = 200;

const VALID_ACTIONS = new Set<string>([
  'created',
  'updated',
  'deleted',
  'commented',
  'exported',
  'imported',
  'validated',
]);

const VALID_ENTITY_TYPES = new Set<string>([
  'project',
  'architecture_node',
  'architecture_edge',
  'bom_item',
  'circuit_design',
  'circuit_instance',
  'circuit_wire',
  'circuit_net',
  'component',
  'validation',
  'comment',
  'export',
  'simulation',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function storageKey(projectId: number | string): string {
  return `${STORAGE_PREFIX}${projectId}`;
}

function safeGetLS(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetLS(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage full or unavailable — silently ignore.
  }
}

function isValidEntry(item: unknown): item is PersistedEntry {
  if (typeof item !== 'object' || item === null) {
    return false;
  }
  const e = item as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.timestamp === 'number' &&
    typeof e.action === 'string' &&
    VALID_ACTIONS.has(e.action) &&
    typeof e.entityType === 'string' &&
    VALID_ENTITY_TYPES.has(e.entityType) &&
    typeof e.entityId === 'string' &&
    typeof e.entityLabel === 'string'
  );
}

function loadEntries(projectId: number | string): ActivityEntry[] {
  const raw = safeGetLS(storageKey(projectId));
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter(isValidEntry)
        .map((e) => ({
          id: e.id,
          timestamp: e.timestamp,
          action: e.action as ActivityAction,
          entityType: e.entityType as ActivityEntityType,
          entityId: e.entityId,
          entityLabel: e.entityLabel,
          userId: e.userId,
          userName: e.userName,
          details: e.details,
        }));
    }
  } catch {
    // Corrupted data — start fresh.
  }
  return [];
}

/** Generate a unique entry ID. */
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// ActivityFeedManager
// ---------------------------------------------------------------------------

export class ActivityFeedManager {
  private _entries: ActivityEntry[];
  private _version = 0;
  private _listeners = new Set<Listener>();
  private _projectId: number | string;

  private constructor(projectId: number | string) {
    this._projectId = projectId;
    this._entries = loadEntries(projectId);
  }

  /** Factory — creates a fresh instance (testing-friendly, no global singleton). */
  static create(projectId: number | string): ActivityFeedManager {
    return new ActivityFeedManager(projectId);
  }

  // -----------------------------------------------------------------------
  // Subscription (useSyncExternalStore compatible)
  // -----------------------------------------------------------------------

  subscribe = (listener: Listener): (() => void) => {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  };

  getSnapshot = (): ActivityFeedState => {
    return { entries: this._entries, version: this._version };
  };

  private notify(): void {
    this._version++;
    const listeners = Array.from(this._listeners);
    for (let i = 0; i < listeners.length; i++) {
      listeners[i]();
    }
  }

  private persist(): void {
    safeSetLS(storageKey(this._projectId), JSON.stringify(this._entries));
  }

  // -----------------------------------------------------------------------
  // Entry management
  // -----------------------------------------------------------------------

  /** Add a new activity entry. Trims to MAX_ENTRIES (oldest evicted). */
  addEntry(
    params: Omit<ActivityEntry, 'id' | 'timestamp'>,
  ): ActivityEntry {
    const entry: ActivityEntry = {
      ...params,
      id: generateId(),
      timestamp: Date.now(),
    };

    // Prepend (newest first) and trim
    this._entries = [entry, ...this._entries].slice(0, MAX_ENTRIES);
    this.persist();
    this.notify();
    return entry;
  }

  /** Remove a single entry by ID. */
  removeEntry(id: string): boolean {
    const before = this._entries.length;
    this._entries = this._entries.filter((e) => e.id !== id);
    if (this._entries.length !== before) {
      this.persist();
      this.notify();
      return true;
    }
    return false;
  }

  /** Clear all entries. */
  clearAll(): void {
    if (this._entries.length === 0) {
      return;
    }
    this._entries = [];
    this.persist();
    this.notify();
  }

  /** Return all entries (newest first). */
  getAllEntries(): readonly ActivityEntry[] {
    return this._entries;
  }

  /** Return entries matching a filter. */
  getFilteredEntries(filter: ActivityFilter): readonly ActivityEntry[] {
    let result: ActivityEntry[] = [...this._entries];

    if (filter.action) {
      result = result.filter((e) => e.action === filter.action);
    }
    if (filter.entityType) {
      result = result.filter((e) => e.entityType === filter.entityType);
    }
    if (filter.userId) {
      result = result.filter((e) => e.userId === filter.userId);
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(
        (e) =>
          e.entityLabel.toLowerCase().includes(q) ||
          (e.details?.toLowerCase().includes(q) ?? false) ||
          (e.userName?.toLowerCase().includes(q) ?? false) ||
          e.action.toLowerCase().includes(q),
      );
    }

    return result;
  }

  /** Return distinct user IDs that appear in the feed. */
  getDistinctUsers(): Array<{ userId: string; userName?: string }> {
    const seen = new Map<string, string | undefined>();
    for (const entry of this._entries) {
      if (entry.userId && !seen.has(entry.userId)) {
        seen.set(entry.userId, entry.userName);
      }
    }
    return Array.from(seen.entries()).map(([userId, userName]) => ({
      userId,
      userName,
    }));
  }

  /** Return the total number of entries. */
  get count(): number {
    return this._entries.length;
  }

  /** Return the project ID this manager is bound to. */
  get projectId(): number | string {
    return this._projectId;
  }
}

// ---------------------------------------------------------------------------
// Global singleton
// ---------------------------------------------------------------------------

let _instance: ActivityFeedManager | null = null;

/** Get or create the global ActivityFeedManager singleton for a project. */
export function getActivityFeedManager(projectId: number | string): ActivityFeedManager {
  if (!_instance || ((_instance as unknown as { _projectId: number | string })._projectId !== projectId)) {
    _instance = ActivityFeedManager.create(projectId);
  }
  return _instance;
}

/** Reset the global singleton (for testing). */
export function resetActivityFeedManager(): void {
  _instance = null;
}

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

/**
 * React hook for using the activity feed manager.
 * Re-renders on state changes.
 */
export function useActivityFeed(projectId: number | string): {
  entries: readonly ActivityEntry[];
  filteredEntries: readonly ActivityEntry[];
  filter: ActivityFilter;
  setFilter: (filter: ActivityFilter) => void;
  addEntry: (params: Omit<ActivityEntry, 'id' | 'timestamp'>) => ActivityEntry;
  removeEntry: (id: string) => boolean;
  clearAll: () => void;
  distinctUsers: Array<{ userId: string; userName?: string }>;
  count: number;
} {
  const manager = getActivityFeedManager(projectId);
  const [, setTick] = useState(0);
  const [filter, setFilter] = useState<ActivityFilter>({});

  useEffect(() => {
    return manager.subscribe(() => {
      setTick((t) => t + 1);
    });
  }, [manager]);

  const addEntry = useCallback(
    (params: Omit<ActivityEntry, 'id' | 'timestamp'>) => {
      return manager.addEntry(params);
    },
    [manager],
  );

  const removeEntry = useCallback(
    (id: string) => {
      return manager.removeEntry(id);
    },
    [manager],
  );

  const clearAll = useCallback(() => {
    manager.clearAll();
  }, [manager]);

  const entries = manager.getAllEntries();
  const filteredEntries = Object.keys(filter).length > 0
    ? manager.getFilteredEntries(filter)
    : entries;

  return {
    entries,
    filteredEntries,
    filter,
    setFilter,
    addEntry,
    removeEntry,
    clearAll,
    distinctUsers: manager.getDistinctUsers(),
    count: manager.count,
  };
}
