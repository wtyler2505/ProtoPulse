/**
 * LRU Cache Tests
 *
 * Tests for LRUClientCache in server/lib/lru-cache.ts
 * and SimpleCache in server/cache.ts.
 * Runs in server project config (node environment).
 */

import { describe, it, expect, vi } from 'vitest';
import { LRUClientCache } from '../lib/lru-cache';
import { SimpleCache, SWEEP_INTERVAL_MS } from '../cache';

describe('LRUClientCache', () => {
  it('set and get returns the stored value', () => {
    const cache = new LRUClientCache<string>(5);
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('get on a non-existent key returns undefined', () => {
    const cache = new LRUClientCache<string>(5);
    expect(cache.get('missing')).toBeUndefined();
  });

  it('evicts the least-recently-used key when maxSize is exceeded', () => {
    const cache = new LRUClientCache<string>(3);
    cache.set('a', 'A');
    cache.set('b', 'B');
    cache.set('c', 'C');
    // 'a' is the LRU; adding 'd' should evict 'a'
    cache.set('d', 'D');
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe('B');
    expect(cache.get('c')).toBe('C');
    expect(cache.get('d')).toBe('D');
  });

  it('get refreshes a key so it is not the next eviction target', () => {
    const cache = new LRUClientCache<string>(3);
    cache.set('a', 'A');
    cache.set('b', 'B');
    cache.set('c', 'C');
    // Access 'a' to make it recently used
    cache.get('a');
    // Now 'b' is the LRU — adding 'd' should evict 'b'
    cache.set('d', 'D');
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe('A');
    expect(cache.get('c')).toBe('C');
    expect(cache.get('d')).toBe('D');
  });

  it('after eviction the evicted key returns undefined', () => {
    const cache = new LRUClientCache<string>(2);
    cache.set('x', 'X');
    cache.set('y', 'Y');
    cache.set('z', 'Z'); // evicts 'x'
    expect(cache.get('x')).toBeUndefined();
  });

  it('cache size never exceeds maxSize when setting more than maxSize items', () => {
    const cache = new LRUClientCache<number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4);
    cache.set('e', 5);
    // After 5 sets with maxSize=3, exactly 3 keys should remain
    const presentCount = ['a', 'b', 'c', 'd', 'e'].filter(
      (k) => cache.get(k) !== undefined,
    ).length;
    // Note: each get() above refreshes the key, but we're interested in
    // the count after the sets. We re-create to test the count without
    // the get() side-effects skewing eviction order.
    const cache2 = new LRUClientCache<number>(3);
    cache2.set('a', 1);
    cache2.set('b', 2);
    cache2.set('c', 3);
    cache2.set('d', 4);
    cache2.set('e', 5);
    // 'a' and 'b' should have been evicted
    expect(cache2.get('a')).toBeUndefined();
    expect(cache2.get('b')).toBeUndefined();
    expect(cache2.get('c')).toBe(3);
    expect(cache2.get('d')).toBe(4);
    expect(cache2.get('e')).toBe(5);
  });

  it('overwriting a key updates its value', () => {
    const cache = new LRUClientCache<string>(3);
    cache.set('key', 'old');
    cache.set('key', 'new');
    expect(cache.get('key')).toBe('new');
  });

  it('overwriting a key refreshes its recency (not evicted immediately after)', () => {
    const cache = new LRUClientCache<string>(3);
    cache.set('a', 'A');
    cache.set('b', 'B');
    cache.set('c', 'C');
    // Overwrite 'a' — it should become the most recently used
    cache.set('a', 'A2');
    // 'b' is now the LRU; adding 'd' should evict 'b'
    cache.set('d', 'D');
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe('A2');
    expect(cache.get('c')).toBe('C');
    expect(cache.get('d')).toBe('D');
  });

  it('works with object values', () => {
    const cache = new LRUClientCache<{ count: number }>(2);
    cache.set('item', { count: 42 });
    const result = cache.get('item');
    expect(result).toBeDefined();
    expect(result?.count).toBe(42);
  });

  it('maxSize of 1 always keeps only the most recently set key', () => {
    const cache = new LRUClientCache<string>(1);
    cache.set('first', 'F');
    cache.set('second', 'S');
    expect(cache.get('first')).toBeUndefined();
    expect(cache.get('second')).toBe('S');
  });
});

describe('SimpleCache (LRU eviction with TTL)', () => {
  it('set and get returns the stored value', () => {
    const cache = new SimpleCache(5, 60_000);
    cache.set('key1', 'value1');
    expect(cache.get<string>('key1')).toBe('value1');
  });

  it('get on a non-existent key returns undefined', () => {
    const cache = new SimpleCache(5, 60_000);
    expect(cache.get<string>('missing')).toBeUndefined();
  });

  it('evicts the least-recently-used key when maxSize is exceeded', () => {
    const cache = new SimpleCache(3, 60_000);
    cache.set('a', 'A');
    cache.set('b', 'B');
    cache.set('c', 'C');
    // 'a' is the LRU; adding 'd' should evict 'a'
    cache.set('d', 'D');
    expect(cache.get<string>('a')).toBeUndefined();
    expect(cache.get<string>('b')).toBe('B');
    expect(cache.get<string>('c')).toBe('C');
    expect(cache.get<string>('d')).toBe('D');
  });

  it('get refreshes a key so it is not the next eviction target', () => {
    const cache = new SimpleCache(3, 60_000);
    cache.set('a', 'A');
    cache.set('b', 'B');
    cache.set('c', 'C');
    // Access 'a' to make it recently used
    cache.get<string>('a');
    // Now 'b' is the LRU — adding 'd' should evict 'b'
    cache.set('d', 'D');
    expect(cache.get<string>('b')).toBeUndefined();
    expect(cache.get<string>('a')).toBe('A');
    expect(cache.get<string>('c')).toBe('C');
    expect(cache.get<string>('d')).toBe('D');
  });

  it('overwriting a key refreshes its recency', () => {
    const cache = new SimpleCache(3, 60_000);
    cache.set('a', 'A');
    cache.set('b', 'B');
    cache.set('c', 'C');
    // Overwrite 'a' — it should become the most recently used
    cache.set('a', 'A2');
    // 'b' is now the LRU; adding 'd' should evict 'b'
    cache.set('d', 'D');
    expect(cache.get<string>('b')).toBeUndefined();
    expect(cache.get<string>('a')).toBe('A2');
    expect(cache.get<string>('c')).toBe('C');
    expect(cache.get<string>('d')).toBe('D');
  });

  it('overwriting an existing key does not increase size', () => {
    const cache = new SimpleCache(3, 60_000);
    cache.set('a', 'A');
    cache.set('b', 'B');
    cache.set('c', 'C');
    cache.set('a', 'A2');
    expect(cache.size).toBe(3);
    // All three keys should still be accessible
    expect(cache.get<string>('a')).toBe('A2');
    expect(cache.get<string>('b')).toBe('B');
    expect(cache.get<string>('c')).toBe('C');
  });

  it('returns undefined for expired entries', () => {
    vi.useFakeTimers();
    try {
      const cache = new SimpleCache(5, 100);
      cache.set('key', 'value');
      expect(cache.get<string>('key')).toBe('value');
      vi.advanceTimersByTime(150);
      expect(cache.get<string>('key')).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('invalidate removes keys matching a prefix', () => {
    const cache = new SimpleCache(10, 60_000);
    cache.set('nodes:1:a', 'A');
    cache.set('nodes:1:b', 'B');
    cache.set('nodes:2:a', 'C');
    cache.invalidate('nodes:1');
    expect(cache.get<string>('nodes:1:a')).toBeUndefined();
    expect(cache.get<string>('nodes:1:b')).toBeUndefined();
    expect(cache.get<string>('nodes:2:a')).toBe('C');
  });

  it('clear removes all entries', () => {
    const cache = new SimpleCache(5, 60_000);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get<number>('a')).toBeUndefined();
  });

  it('size never exceeds maxSize', () => {
    const cache = new SimpleCache(3, 60_000);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4);
    cache.set('e', 5);
    expect(cache.size).toBe(3);
  });

  it('SWEEP_INTERVAL_MS is exported and equals 60 seconds', () => {
    expect(SWEEP_INTERVAL_MS).toBe(60_000);
  });

  it('periodic sweep removes expired entries', () => {
    vi.useFakeTimers();
    try {
      const cache = new SimpleCache(10, 200);
      cache.startSweep(SWEEP_INTERVAL_MS);
      cache.set('short', 'value', 200);
      cache.set('long', 'value', 120_000);
      expect(cache.size).toBe(2);
      // Advance past TTL but not yet to sweep interval
      vi.advanceTimersByTime(500);
      // 'short' is expired but sweep hasn't run yet — still in store by size
      // (get would return undefined due to lazy expiry, but the entry is still in the map)
      expect(cache.size).toBe(2);
      // Advance to trigger the sweep
      vi.advanceTimersByTime(SWEEP_INTERVAL_MS);
      // Sweep should have removed the expired 'short' entry
      expect(cache.size).toBe(1);
      expect(cache.get<string>('short')).toBeUndefined();
      expect(cache.get<string>('long')).toBe('value');
      cache.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('destroy clears the sweep interval and empties the store', () => {
    vi.useFakeTimers();
    try {
      const cache = new SimpleCache(10, 200);
      cache.startSweep(SWEEP_INTERVAL_MS);
      cache.set('a', 'A');
      cache.set('b', 'B');
      cache.destroy();
      expect(cache.size).toBe(0);
      // After destroy, advancing timers should not cause errors
      vi.advanceTimersByTime(SWEEP_INTERVAL_MS * 2);
      // Cache should remain empty — sweep is stopped
      cache.set('c', 'C');
      expect(cache.size).toBe(1);
      cache.destroy();
    } finally {
      vi.useRealTimers();
    }
  });
});
