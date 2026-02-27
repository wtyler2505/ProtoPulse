/**
 * LRU Cache Tests
 *
 * Tests for LRUClientCache in server/lib/lru-cache.ts.
 * Runs in server project config (node environment).
 */

import { describe, it, expect } from 'vitest';
import { LRUClientCache } from '../lib/lru-cache';

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
