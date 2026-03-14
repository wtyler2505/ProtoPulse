/**
 * Recent Projects Manager
 *
 * Tracks recently accessed projects in localStorage with support for
 * search, sorting (recent / name / pinned-first), and pin/unpin.
 * Pinned entries always appear at the top when pinned-first sort is active.
 *
 * Usage:
 *   const mgr = RecentProjectsManager.getInstance();
 *   mgr.recordAccess({ id: 1, name: 'My Project' });
 *   mgr.togglePin(1);
 *
 * React hook:
 *   const { entries, pinned, search, sort, ... } = useRecentProjects();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RecentSortMode = 'recent' | 'name' | 'pinned';

export interface RecentProjectEntry {
  /** Project ID (matches Project.id). */
  projectId: number;
  /** Snapshot of the project name at last access. */
  name: string;
  /** Optional snapshot of description. */
  description?: string;
  /** Epoch ms of last access. */
  lastAccessedAt: number;
  /** Whether the entry is pinned. */
  pinned: boolean;
}

export interface RecentProjectsData {
  entries: RecentProjectEntry[];
}

type Listener = () => void;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-recent-projects';
const MAX_ENTRIES = 50;

// ---------------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------------

export class RecentProjectsManager {
  private static instance: RecentProjectsManager | null = null;

  private entries: RecentProjectEntry[];
  private listeners = new Set<Listener>();

  constructor() {
    this.entries = [];
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): RecentProjectsManager {
    if (!RecentProjectsManager.instance) {
      RecentProjectsManager.instance = new RecentProjectsManager();
    }
    return RecentProjectsManager.instance;
  }

  /** Reset singleton — test-only. */
  static resetForTesting(): void {
    RecentProjectsManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscribe
  // -----------------------------------------------------------------------

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   */
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

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as RecentProjectsData;
        if (Array.isArray(parsed.entries)) {
          this.entries = parsed.entries.slice(0, MAX_ENTRIES);
          return;
        }
      }
    } catch {
      // Corrupt data — start fresh
    }
    this.entries = [];
  }

  private save(): void {
    try {
      const data: RecentProjectsData = { entries: this.entries };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage full or unavailable
    }
  }

  // -----------------------------------------------------------------------
  // Accessors
  // -----------------------------------------------------------------------

  /** Return all entries (unsorted copy). */
  getEntries(): RecentProjectEntry[] {
    return this.entries.map((e) => ({ ...e }));
  }

  /** Return pinned entries only. */
  getPinnedEntries(): RecentProjectEntry[] {
    return this.entries.filter((e) => e.pinned).map((e) => ({ ...e }));
  }

  /** Return the total number of entries. */
  getCount(): number {
    return this.entries.length;
  }

  /** Find an entry by project ID. */
  findEntry(projectId: number): RecentProjectEntry | undefined {
    const e = this.entries.find((entry) => entry.projectId === projectId);
    return e ? { ...e } : undefined;
  }

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------

  /**
   * Record a project access. Creates or updates the entry and bumps
   * `lastAccessedAt` to now. Trims to MAX_ENTRIES oldest-first (unpinned
   * entries are evicted before pinned ones).
   */
  recordAccess(project: { id: number; name: string; description?: string | null }): void {
    const now = Date.now();
    const existing = this.entries.find((e) => e.projectId === project.id);
    if (existing) {
      existing.name = project.name;
      existing.description = project.description ?? undefined;
      existing.lastAccessedAt = now;
    } else {
      this.entries.push({
        projectId: project.id,
        name: project.name,
        description: project.description ?? undefined,
        lastAccessedAt: now,
        pinned: false,
      });
    }

    // Trim — evict oldest unpinned first, then oldest pinned if still over
    if (this.entries.length > MAX_ENTRIES) {
      const unpinned = this.entries
        .filter((e) => !e.pinned)
        .sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
      while (this.entries.length > MAX_ENTRIES && unpinned.length > 0) {
        const victim = unpinned.shift()!;
        const idx = this.entries.indexOf(victim);
        if (idx !== -1) {
          this.entries.splice(idx, 1);
        }
      }
      // If still over (all pinned), evict oldest pinned
      if (this.entries.length > MAX_ENTRIES) {
        this.entries.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
        this.entries.splice(0, this.entries.length - MAX_ENTRIES);
      }
    }

    this.save();
    this.notify();
  }

  /** Toggle the pinned state of a project. Returns new pinned value or null if not found. */
  togglePin(projectId: number): boolean | null {
    const entry = this.entries.find((e) => e.projectId === projectId);
    if (!entry) {
      return null;
    }
    entry.pinned = !entry.pinned;
    this.save();
    this.notify();
    return entry.pinned;
  }

  /** Explicitly set pinned state. */
  setPin(projectId: number, pinned: boolean): boolean {
    const entry = this.entries.find((e) => e.projectId === projectId);
    if (!entry) {
      return false;
    }
    entry.pinned = pinned;
    this.save();
    this.notify();
    return true;
  }

  /** Remove an entry by project ID. */
  removeEntry(projectId: number): boolean {
    const idx = this.entries.findIndex((e) => e.projectId === projectId);
    if (idx === -1) {
      return false;
    }
    this.entries.splice(idx, 1);
    this.save();
    this.notify();
    return true;
  }

  /** Clear all entries. */
  clearAll(): void {
    this.entries = [];
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Query
  // -----------------------------------------------------------------------

  /**
   * Search entries by name/description substring match (case-insensitive).
   * Returns matching entries without sorting.
   */
  search(query: string): RecentProjectEntry[] {
    const q = query.toLowerCase().trim();
    if (!q) {
      return this.getEntries();
    }
    return this.entries
      .filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          (e.description && e.description.toLowerCase().includes(q)),
      )
      .map((e) => ({ ...e }));
  }

  /**
   * Return entries sorted by the given mode.
   *  - 'recent':  most recently accessed first
   *  - 'name':    alphabetical A-Z
   *  - 'pinned':  pinned first (then by most recent within each group)
   */
  sorted(mode: RecentSortMode): RecentProjectEntry[] {
    const copy = this.entries.map((e) => ({ ...e }));
    switch (mode) {
      case 'recent':
        copy.sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);
        break;
      case 'name':
        copy.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'pinned':
        copy.sort((a, b) => {
          if (a.pinned !== b.pinned) {
            return a.pinned ? -1 : 1;
          }
          return b.lastAccessedAt - a.lastAccessedAt;
        });
        break;
    }
    return copy;
  }

  /**
   * Combined search + sort. Convenience for UI usage.
   */
  query(searchQuery: string, sortMode: RecentSortMode): RecentProjectEntry[] {
    const q = searchQuery.toLowerCase().trim();
    let results = q
      ? this.entries.filter(
          (e) =>
            e.name.toLowerCase().includes(q) ||
            (e.description && e.description.toLowerCase().includes(q)),
        )
      : [...this.entries];

    switch (sortMode) {
      case 'recent':
        results.sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);
        break;
      case 'name':
        results.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'pinned':
        results.sort((a, b) => {
          if (a.pinned !== b.pinned) {
            return a.pinned ? -1 : 1;
          }
          return b.lastAccessedAt - a.lastAccessedAt;
        });
        break;
    }

    return results.map((e) => ({ ...e }));
  }

  // -----------------------------------------------------------------------
  // Import / Export
  // -----------------------------------------------------------------------

  exportData(): RecentProjectsData {
    return { entries: this.getEntries() };
  }

  importData(data: RecentProjectsData): void {
    if (!Array.isArray(data.entries)) {
      return;
    }
    this.entries = data.entries.slice(0, MAX_ENTRIES).map((e) => ({ ...e }));
    this.save();
    this.notify();
  }
}

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

export function useRecentProjects() {
  const [tick, setTick] = useState(0);
  void tick; // suppress unused warning

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const mgr = RecentProjectsManager.getInstance();
    const unsubscribe = mgr.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const recordAccess = useCallback(
    (project: { id: number; name: string; description?: string | null }) => {
      RecentProjectsManager.getInstance().recordAccess(project);
    },
    [],
  );

  const togglePin = useCallback((projectId: number) => {
    return RecentProjectsManager.getInstance().togglePin(projectId);
  }, []);

  const setPin = useCallback((projectId: number, pinned: boolean) => {
    return RecentProjectsManager.getInstance().setPin(projectId, pinned);
  }, []);

  const removeEntry = useCallback((projectId: number) => {
    return RecentProjectsManager.getInstance().removeEntry(projectId);
  }, []);

  const clearAll = useCallback(() => {
    RecentProjectsManager.getInstance().clearAll();
  }, []);

  const search = useCallback((q: string) => {
    return RecentProjectsManager.getInstance().search(q);
  }, []);

  const sorted = useCallback((mode: RecentSortMode) => {
    return RecentProjectsManager.getInstance().sorted(mode);
  }, []);

  const queryEntries = useCallback((searchQuery: string, sortMode: RecentSortMode) => {
    return RecentProjectsManager.getInstance().query(searchQuery, sortMode);
  }, []);

  const mgr = typeof window !== 'undefined' ? RecentProjectsManager.getInstance() : null;

  return {
    entries: mgr?.getEntries() ?? [],
    pinnedEntries: mgr?.getPinnedEntries() ?? [],
    count: mgr?.getCount() ?? 0,
    recordAccess,
    togglePin,
    setPin,
    removeEntry,
    clearAll,
    search,
    sorted,
    query: queryEntries,
    findEntry: mgr ? (id: number) => mgr.findEntry(id) : () => undefined,
  };
}
