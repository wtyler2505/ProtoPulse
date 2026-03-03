interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export const SWEEP_INTERVAL_MS = 60_000;

class SimpleCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private maxSize: number;
  private defaultTTLMs: number;
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor(maxSize = 200, defaultTTLMs = 60_000) {
    this.maxSize = maxSize;
    this.defaultTTLMs = defaultTTLMs;
  }

  startSweep(intervalMs = SWEEP_INTERVAL_MS): void {
    if (this.sweepTimer) return;
    this.sweepTimer = setInterval(() => {
      this.sweep();
    }, intervalMs);
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of Array.from(this.store.entries())) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
    this.store.clear();
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    // LRU: move accessed entry to the end of Map iteration order
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.data;
  }

  set<T>(key: string, data: T, ttlMs?: number): void {
    // Delete first so overwrites refresh position and don't count toward maxSize
    if (this.store.has(key)) {
      this.store.delete(key);
    }
    if (this.store.size >= this.maxSize) {
      // Evict the least recently used entry (first in Map iteration order)
      const firstKey = this.store.keys().next().value;
      if (firstKey !== undefined) this.store.delete(firstKey);
    }
    this.store.set(key, { data, expiresAt: Date.now() + (ttlMs ?? this.defaultTTLMs) });
  }

  invalidate(pattern: string): void {
    const keys = Array.from(this.store.keys());
    for (const key of keys) {
      if (key.startsWith(pattern)) {
        this.store.delete(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

export { SimpleCache };
export const cache = new SimpleCache();
cache.startSweep();
