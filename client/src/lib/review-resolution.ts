/**
 * ReviewResolutionManager — Tracks resolution status and notes for validation
 * issues. Persists to localStorage. Singleton + subscribe pattern
 * (useSyncExternalStore compatible).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = () => void;

export type ResolutionStatus = 'open' | 'resolved' | 'blocked' | 'wontfix';

export interface ResolutionEntry {
  issueId: string;
  status: ResolutionStatus;
  note: string;
  updatedAt: number;
}

export interface ResolutionSnapshot {
  entries: ReadonlyMap<string, ResolutionEntry>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse:review-resolutions';

export const RESOLUTION_LABELS: Record<ResolutionStatus, string> = {
  open: 'Open',
  resolved: 'Resolved',
  blocked: 'Blocked',
  wontfix: "Won't Fix",
};

export const RESOLUTION_COLORS: Record<ResolutionStatus, string> = {
  open: 'text-muted-foreground',
  resolved: 'text-emerald-500',
  blocked: 'text-amber-500',
  wontfix: 'text-rose-500',
};

export const ALL_STATUSES: readonly ResolutionStatus[] = ['open', 'resolved', 'blocked', 'wontfix'] as const;

// ---------------------------------------------------------------------------
// ReviewResolutionManager
// ---------------------------------------------------------------------------

export class ReviewResolutionManager {
  private entries = new Map<string, ResolutionEntry>();
  private listeners = new Set<Listener>();
  private static instance: ReviewResolutionManager | null = null;

  private constructor() {
    this.loadFromStorage();
  }

  static getInstance(): ReviewResolutionManager {
    if (!ReviewResolutionManager.instance) {
      ReviewResolutionManager.instance = new ReviewResolutionManager();
    }
    return ReviewResolutionManager.instance;
  }

  /** Reset singleton — primarily for testing. */
  static resetInstance(): void {
    ReviewResolutionManager.instance = null;
  }

  /**
   * Create a standalone instance (for testing).
   * Does NOT replace the singleton.
   */
  static createInstance(): ReviewResolutionManager {
    const inst = Object.create(ReviewResolutionManager.prototype) as ReviewResolutionManager;
    inst.entries = new Map();
    inst.listeners = new Set();
    return inst;
  }

  // -----------------------------------------------------------------------
  // Subscription (useSyncExternalStore compatible)
  // -----------------------------------------------------------------------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): ResolutionSnapshot {
    return { entries: this.entries };
  }

  private notify(): void {
    for (const listener of Array.from(this.listeners)) {
      listener();
    }
  }

  // -----------------------------------------------------------------------
  // Core API
  // -----------------------------------------------------------------------

  /** Set or update the resolution status for an issue. */
  setStatus(issueId: string, status: ResolutionStatus): void {
    const existing = this.entries.get(issueId);
    const entry: ResolutionEntry = {
      issueId,
      status,
      note: existing?.note ?? '',
      updatedAt: Date.now(),
    };
    this.entries.set(issueId, entry);
    this.persist();
    this.notify();
  }

  /** Set or update the resolution note for an issue. */
  setNote(issueId: string, note: string): void {
    const existing = this.entries.get(issueId);
    const entry: ResolutionEntry = {
      issueId,
      status: existing?.status ?? 'open',
      note,
      updatedAt: Date.now(),
    };
    this.entries.set(issueId, entry);
    this.persist();
    this.notify();
  }

  /** Get the resolution entry for an issue, or undefined if none set. */
  getEntry(issueId: string): ResolutionEntry | undefined {
    return this.entries.get(issueId);
  }

  /** Get the status for an issue (defaults to 'open' if no entry). */
  getStatus(issueId: string): ResolutionStatus {
    return this.entries.get(issueId)?.status ?? 'open';
  }

  /** Get the note for an issue (defaults to empty string). */
  getNote(issueId: string): string {
    return this.entries.get(issueId)?.note ?? '';
  }

  /** Remove resolution tracking for an issue. */
  remove(issueId: string): void {
    if (this.entries.delete(issueId)) {
      this.persist();
      this.notify();
    }
  }

  /** Clear all resolution entries. */
  clear(): void {
    if (this.entries.size === 0) { return; }
    this.entries.clear();
    this.persist();
    this.notify();
  }

  /** Get all entries as an array. */
  getAllEntries(): ResolutionEntry[] {
    return Array.from(this.entries.values());
  }

  /** Get count of entries by status. */
  getCountByStatus(): Record<ResolutionStatus, number> {
    const counts: Record<ResolutionStatus, number> = { open: 0, resolved: 0, blocked: 0, wontfix: 0 };
    for (const [, entry] of Array.from(this.entries)) {
      counts[entry.status]++;
    }
    return counts;
  }

  /** Get total number of tracked entries. */
  get size(): number {
    return this.entries.size;
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  private persist(): void {
    try {
      const data = Array.from(this.entries.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage full or unavailable — silently ignore
    }
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { return; }
      const data = JSON.parse(raw) as unknown;
      if (!Array.isArray(data)) { return; }
      for (const item of data) {
        if (isValidEntry(item)) {
          this.entries.set(item.issueId, item);
        }
      }
    } catch {
      // Corrupt data — start fresh
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidEntry(value: unknown): value is ResolutionEntry {
  if (typeof value !== 'object' || value === null) { return false; }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.issueId === 'string' &&
    typeof obj.status === 'string' &&
    ALL_STATUSES.includes(obj.status as ResolutionStatus) &&
    typeof obj.note === 'string' &&
    typeof obj.updatedAt === 'number'
  );
}
