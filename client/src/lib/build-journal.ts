/**
 * Build Journal — per-project timestamped log of notes, milestones, decisions,
 * issues, and resolutions.
 *
 * Singleton + Subscribe pattern.  localStorage persistence keyed per project,
 * max 500 entries per project.  Supports manual entries and auto-generated
 * entries from project events.
 *
 * Usage:
 *   const journal = BuildJournalManager.getInstance();
 *   journal.addEntry({ projectId: '1', type: 'note', title: 'First test', body: '...', tags: [] });
 *
 * React hook:
 *   const { entries, addEntry, searchEntries, timeline } = useBuildJournal('1');
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type JournalEntryType = 'note' | 'milestone' | 'decision' | 'issue' | 'resolution';

export interface JournalEntry {
  id: string;
  projectId: string;
  timestamp: number;
  type: JournalEntryType;
  title: string;
  body: string;
  tags: string[];
  auto: boolean;
}

/** Input for creating a new journal entry (id and timestamp are auto-generated). */
export interface JournalEntryInput {
  projectId: string;
  type: JournalEntryType;
  title: string;
  body: string;
  tags?: string[];
  auto?: boolean;
}

export interface JournalFilter {
  type?: JournalEntryType;
  tags?: string[];
  auto?: boolean;
  since?: number;
  until?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse:build-journal';
const MAX_ENTRIES_PER_PROJECT = 500;

// ---------------------------------------------------------------------------
// BuildJournalManager
// ---------------------------------------------------------------------------

/**
 * Manages a per-project build journal with localStorage persistence.
 * Singleton per application.  Notifies subscribers on state changes.
 */
export class BuildJournalManager {
  private static instance: BuildJournalManager | null = null;

  /** projectId -> JournalEntry[] */
  private entries: Map<string, JournalEntry[]>;
  private subscribers: Set<() => void>;

  constructor() {
    this.entries = new Map();
    this.subscribers = new Set();
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): BuildJournalManager {
    if (!BuildJournalManager.instance) {
      BuildJournalManager.instance = new BuildJournalManager();
    }
    return BuildJournalManager.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetInstance(): void {
    BuildJournalManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------

  /**
   * Add a new entry to the journal.
   * Returns the created entry (with generated id + timestamp).
   */
  addEntry(input: JournalEntryInput): JournalEntry {
    const entry: JournalEntry = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      timestamp: Date.now(),
      type: input.type,
      title: input.title,
      body: input.body,
      tags: input.tags ?? [],
      auto: input.auto ?? false,
    };

    const projectEntries = this.entries.get(entry.projectId) ?? [];
    projectEntries.push(entry);

    // Enforce max limit — evict oldest entries first
    if (projectEntries.length > MAX_ENTRIES_PER_PROJECT) {
      const sorted = [...projectEntries].sort((a, b) => a.timestamp - b.timestamp);
      const toRemove = sorted.slice(0, projectEntries.length - MAX_ENTRIES_PER_PROJECT);
      const removeIds = new Set(toRemove.map((e) => e.id));
      const trimmed = projectEntries.filter((e) => !removeIds.has(e.id));
      this.entries.set(entry.projectId, trimmed);
    } else {
      this.entries.set(entry.projectId, projectEntries);
    }

    this.save();
    this.notify();
    return entry;
  }

  /**
   * Remove an entry by ID.  Returns true if the entry was found and removed.
   */
  removeEntry(entryId: string): boolean {
    for (const [projectId, projectEntries] of Array.from(this.entries.entries())) {
      const idx = projectEntries.findIndex((e) => e.id === entryId);
      if (idx !== -1) {
        projectEntries.splice(idx, 1);
        if (projectEntries.length === 0) {
          this.entries.delete(projectId);
        }
        this.save();
        this.notify();
        return true;
      }
    }
    return false;
  }

  /**
   * Update an existing entry (merges fields).
   * Returns the updated entry or null if not found.
   */
  updateEntry(entryId: string, updates: Partial<Pick<JournalEntry, 'title' | 'body' | 'tags' | 'type'>>): JournalEntry | null {
    for (const projectEntries of Array.from(this.entries.values())) {
      const entry = projectEntries.find((e) => e.id === entryId);
      if (entry) {
        if (updates.title !== undefined) { entry.title = updates.title; }
        if (updates.body !== undefined) { entry.body = updates.body; }
        if (updates.tags !== undefined) { entry.tags = updates.tags; }
        if (updates.type !== undefined) { entry.type = updates.type; }
        this.save();
        this.notify();
        return { ...entry };
      }
    }
    return null;
  }

  /**
   * Clear all entries for a specific project.
   */
  clearProject(projectId: string): void {
    if (!this.entries.has(projectId) || this.entries.get(projectId)!.length === 0) {
      return;
    }
    this.entries.delete(projectId);
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /**
   * Get all entries for a project, optionally filtered.
   * Returns a copy sorted by timestamp descending (newest first).
   */
  getEntries(projectId: string, filter?: JournalFilter): JournalEntry[] {
    const raw = this.entries.get(projectId) ?? [];
    let result = [...raw];

    if (filter) {
      if (filter.type !== undefined) {
        result = result.filter((e) => e.type === filter.type);
      }
      if (filter.auto !== undefined) {
        result = result.filter((e) => e.auto === filter.auto);
      }
      if (filter.tags !== undefined && filter.tags.length > 0) {
        const filterTags = new Set(filter.tags.map((t) => t.toLowerCase()));
        result = result.filter((e) =>
          e.tags.some((tag) => filterTags.has(tag.toLowerCase())),
        );
      }
      if (filter.since !== undefined) {
        result = result.filter((e) => e.timestamp >= filter.since!);
      }
      if (filter.until !== undefined) {
        result = result.filter((e) => e.timestamp <= filter.until!);
      }
    }

    return result.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Full-text search across title, body, and tags for a project.
   * Case-insensitive substring matching.
   */
  searchEntries(projectId: string, query: string): JournalEntry[] {
    if (!query.trim()) {
      return this.getEntries(projectId);
    }

    const lower = query.toLowerCase();
    const raw = this.entries.get(projectId) ?? [];

    return [...raw]
      .filter((e) =>
        e.title.toLowerCase().includes(lower) ||
        e.body.toLowerCase().includes(lower) ||
        e.tags.some((tag) => tag.toLowerCase().includes(lower)),
      )
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Convenience method: auto-generate an entry from a project event.
   * Sets `auto: true` on the created entry.
   */
  autoLog(projectId: string, type: JournalEntryType, title: string, body: string): JournalEntry {
    return this.addEntry({
      projectId,
      type,
      title,
      body,
      tags: ['auto'],
      auto: true,
    });
  }

  /**
   * Get the full timeline for a project — entries sorted by timestamp ascending
   * (chronological order).
   */
  getTimeline(projectId: string): JournalEntry[] {
    const raw = this.entries.get(projectId) ?? [];
    return [...raw].sort((a, b) => a.timestamp - b.timestamp);
  }

  /** Get a single entry by ID. */
  getEntry(entryId: string): JournalEntry | null {
    for (const projectEntries of Array.from(this.entries.values())) {
      const entry = projectEntries.find((e) => e.id === entryId);
      if (entry) {
        return { ...entry };
      }
    }
    return null;
  }

  /** Get the total count of entries for a project. */
  getCount(projectId: string): number {
    return (this.entries.get(projectId) ?? []).length;
  }

  /** Get all project IDs that have journal entries. */
  getProjectIds(): string[] {
    return Array.from(this.entries.keys());
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /**
   * Subscribe to state changes.  Returns an unsubscribe function.
   * Callback is invoked whenever entries are added/removed/updated/cleared.
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

  /** Persist all entries to localStorage. */
  private save(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const serializable: Record<string, JournalEntry[]> = {};
      for (const [key, value] of Array.from(this.entries.entries())) {
        serializable[key] = value;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
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
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        this.entries = new Map();
        return;
      }

      const record = parsed as Record<string, unknown>;
      for (const [projectId, value] of Object.entries(record)) {
        if (!Array.isArray(value)) {
          continue;
        }
        const validated = value.filter(
          (item: unknown): item is JournalEntry =>
            typeof item === 'object' &&
            item !== null &&
            typeof (item as JournalEntry).id === 'string' &&
            typeof (item as JournalEntry).projectId === 'string' &&
            typeof (item as JournalEntry).timestamp === 'number' &&
            typeof (item as JournalEntry).type === 'string' &&
            typeof (item as JournalEntry).title === 'string' &&
            typeof (item as JournalEntry).body === 'string' &&
            Array.isArray((item as JournalEntry).tags) &&
            typeof (item as JournalEntry).auto === 'boolean',
        );
        if (validated.length > 0) {
          this.entries.set(projectId, validated);
        }
      }
    } catch {
      // Corrupt data — start fresh
      this.entries = new Map();
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
 * Hook for accessing the build journal for a specific project.
 * Subscribes to the BuildJournalManager and triggers re-renders on state changes.
 */
export function useBuildJournal(projectId: string): {
  entries: JournalEntry[];
  timeline: JournalEntry[];
  count: number;
  addEntry: (input: Omit<JournalEntryInput, 'projectId'>) => JournalEntry;
  removeEntry: (entryId: string) => boolean;
  updateEntry: (entryId: string, updates: Partial<Pick<JournalEntry, 'title' | 'body' | 'tags' | 'type'>>) => JournalEntry | null;
  searchEntries: (query: string) => JournalEntry[];
  autoLog: (type: JournalEntryType, title: string, body: string) => JournalEntry;
  getEntries: (filter?: JournalFilter) => JournalEntry[];
  clearProject: () => void;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const manager = BuildJournalManager.getInstance();
    const unsubscribe = manager.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const addEntry = useCallback(
    (input: Omit<JournalEntryInput, 'projectId'>) => {
      return BuildJournalManager.getInstance().addEntry({ ...input, projectId });
    },
    [projectId],
  );

  const removeEntry = useCallback(
    (entryId: string) => {
      return BuildJournalManager.getInstance().removeEntry(entryId);
    },
    [],
  );

  const updateEntry = useCallback(
    (entryId: string, updates: Partial<Pick<JournalEntry, 'title' | 'body' | 'tags' | 'type'>>) => {
      return BuildJournalManager.getInstance().updateEntry(entryId, updates);
    },
    [],
  );

  const searchEntries = useCallback(
    (query: string) => {
      return BuildJournalManager.getInstance().searchEntries(projectId, query);
    },
    [projectId],
  );

  const autoLog = useCallback(
    (type: JournalEntryType, title: string, body: string) => {
      return BuildJournalManager.getInstance().autoLog(projectId, type, title, body);
    },
    [projectId],
  );

  const getEntries = useCallback(
    (filter?: JournalFilter) => {
      return BuildJournalManager.getInstance().getEntries(projectId, filter);
    },
    [projectId],
  );

  const clearProject = useCallback(() => {
    BuildJournalManager.getInstance().clearProject(projectId);
  }, [projectId]);

  const manager = BuildJournalManager.getInstance();

  return {
    entries: typeof window !== 'undefined' ? manager.getEntries(projectId) : [],
    timeline: typeof window !== 'undefined' ? manager.getTimeline(projectId) : [],
    count: typeof window !== 'undefined' ? manager.getCount(projectId) : 0,
    addEntry,
    removeEntry,
    updateEntry,
    searchEntries,
    autoLog,
    getEntries,
    clearProject,
  };
}
