interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class SimpleCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private maxSize: number;
  private defaultTTLMs: number;

  constructor(maxSize = 200, defaultTTLMs = 60_000) {
    this.maxSize = maxSize;
    this.defaultTTLMs = defaultTTLMs;
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.data;
  }

  set<T>(key: string, data: T, ttlMs?: number): void {
    if (this.store.size >= this.maxSize) {
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

export const cache = new SimpleCache();
