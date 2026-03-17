import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  DEFAULT_CONFIG,
  shouldUseProgressive,
  renderInBatches,
  useProgressiveRender,
} from '../progressive-render';
import type { ProgressiveRenderConfig } from '../progressive-render';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate an array [0, 1, 2, ..., n-1]. */
function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

/** Advance fake timers by one tick and flush pending state updates. */
async function tick(ms = 16): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

/** Advance until the hook reports isComplete. Safety cap to avoid infinite loops. */
async function drainUntilComplete(
  result: { current: { isComplete: boolean } },
  intervalMs = 16,
  maxTicks = 500,
): Promise<void> {
  let n = 0;
  while (!result.current.isComplete && n < maxTicks) {
    await tick(intervalMs);
    n++;
  }
}

// ===========================================================================
// DEFAULT_CONFIG
// ===========================================================================

describe('DEFAULT_CONFIG', () => {
  it('has expected default values', () => {
    expect(DEFAULT_CONFIG.initialBatch).toBe(20);
    expect(DEFAULT_CONFIG.batchSize).toBe(10);
    expect(DEFAULT_CONFIG.intervalMs).toBe(16);
  });

  it('is frozen / readonly (cannot be mutated at runtime)', () => {
    // TypeScript enforces Readonly, but verify the object is effectively
    // immutable at runtime too.
    const cfg = DEFAULT_CONFIG as ProgressiveRenderConfig;
    expect(() => {
      cfg.initialBatch = 999;
    }).toThrow();
  });
});

// ===========================================================================
// shouldUseProgressive
// ===========================================================================

describe('shouldUseProgressive', () => {
  it('returns false when itemCount is below default threshold (50)', () => {
    expect(shouldUseProgressive(0)).toBe(false);
    expect(shouldUseProgressive(1)).toBe(false);
    expect(shouldUseProgressive(49)).toBe(false);
  });

  it('returns true when itemCount equals or exceeds default threshold', () => {
    expect(shouldUseProgressive(50)).toBe(true);
    expect(shouldUseProgressive(100)).toBe(true);
    expect(shouldUseProgressive(10_000)).toBe(true);
  });

  it('supports a custom threshold', () => {
    expect(shouldUseProgressive(9, 10)).toBe(false);
    expect(shouldUseProgressive(10, 10)).toBe(true);
    expect(shouldUseProgressive(11, 10)).toBe(true);
  });

  it('returns true for zero threshold (every list is progressive)', () => {
    expect(shouldUseProgressive(0, 0)).toBe(true);
    expect(shouldUseProgressive(1, 0)).toBe(true);
  });

  it('handles negative itemCount gracefully', () => {
    expect(shouldUseProgressive(-5)).toBe(false);
  });
});

// ===========================================================================
// renderInBatches
// ===========================================================================

describe('renderInBatches', () => {
  it('yields items in correctly sized batches', async () => {
    const items = range(25);
    const batches: number[][] = [];
    const callback = vi.fn((batch: readonly number[]) => {
      batches.push([...batch]);
    });

    const gen = renderInBatches(items, 10, callback);
    // Exhaust the generator.
    let result = await gen.next();
    while (!result.done) {
      result = await gen.next();
    }

    expect(batches).toHaveLength(3);
    expect(batches[0]).toEqual(range(10));
    expect(batches[1]).toEqual(range(10).map((i) => i + 10));
    expect(batches[2]).toEqual([20, 21, 22, 23, 24]);
    expect(callback).toHaveBeenCalledTimes(3);
  });

  it('handles empty array', async () => {
    const callback = vi.fn();
    const gen = renderInBatches([], 5, callback);
    const result = await gen.next();
    expect(result.done).toBe(true);
    expect(callback).not.toHaveBeenCalled();
  });

  it('handles batchSize larger than items', async () => {
    const items = [1, 2, 3];
    const batches: number[][] = [];
    const gen = renderInBatches(items, 100, (batch) => {
      batches.push([...batch]);
    });
    let result = await gen.next();
    while (!result.done) {
      result = await gen.next();
    }
    expect(batches).toEqual([[1, 2, 3]]);
  });

  it('clamps batchSize of zero to 1', async () => {
    const items = [10, 20, 30];
    const batches: number[][] = [];
    const gen = renderInBatches(items, 0, (batch) => {
      batches.push([...batch]);
    });
    let result = await gen.next();
    while (!result.done) {
      result = await gen.next();
    }
    // batchSize clamped to 1 → 3 batches of 1
    expect(batches).toHaveLength(3);
    expect(batches[0]).toEqual([10]);
    expect(batches[1]).toEqual([20]);
    expect(batches[2]).toEqual([30]);
  });

  it('yields each batch as the return value', async () => {
    const items = range(5);
    const gen = renderInBatches(items, 3, () => {});
    const first = await gen.next();
    expect(first.value).toEqual([0, 1, 2]);
    const second = await gen.next();
    expect(second.value).toEqual([3, 4]);
    const third = await gen.next();
    expect(third.done).toBe(true);
  });

  it('works with non-number generic types', async () => {
    const items = ['alpha', 'beta', 'gamma', 'delta'];
    const batches: string[][] = [];
    const gen = renderInBatches(items, 2, (batch) => {
      batches.push([...batch]);
    });
    let result = await gen.next();
    while (!result.done) {
      result = await gen.next();
    }
    expect(batches).toEqual([
      ['alpha', 'beta'],
      ['gamma', 'delta'],
    ]);
  });
});

// ===========================================================================
// useProgressiveRender
// ===========================================================================

describe('useProgressiveRender', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // Initial render
  // -----------------------------------------------------------------------

  describe('initial render', () => {
    it('returns initialBatch items immediately', () => {
      const items = range(100);
      const { result } = renderHook(() => useProgressiveRender(items));
      expect(result.current.visibleItems).toHaveLength(20);
      expect(result.current.visibleItems).toEqual(range(20));
    });

    it('returns all items when list is smaller than initialBatch', () => {
      const items = range(5);
      const { result } = renderHook(() => useProgressiveRender(items));
      expect(result.current.visibleItems).toEqual(range(5));
      expect(result.current.isComplete).toBe(true);
      expect(result.current.progress).toBe(1);
    });

    it('returns empty visibleItems for an empty list', () => {
      const { result } = renderHook(() => useProgressiveRender([]));
      expect(result.current.visibleItems).toEqual([]);
      expect(result.current.isComplete).toBe(true);
      expect(result.current.progress).toBe(1);
    });

    it('reports isComplete false when items exceed initialBatch', () => {
      const items = range(100);
      const { result } = renderHook(() => useProgressiveRender(items));
      expect(result.current.isComplete).toBe(false);
    });

    it('reports correct initial progress', () => {
      const items = range(100);
      const { result } = renderHook(() => useProgressiveRender(items));
      expect(result.current.progress).toBeCloseTo(0.2);
    });
  });

  // -----------------------------------------------------------------------
  // Batch progression
  // -----------------------------------------------------------------------

  describe('batch progression', () => {
    it('reveals additional batchSize items after each interval', async () => {
      const items = range(50);
      const { result } = renderHook(() => useProgressiveRender(items));

      // After first tick: 20 + 10 = 30
      await tick();
      expect(result.current.visibleItems).toHaveLength(30);

      // After second tick: 30 + 10 = 40
      await tick();
      expect(result.current.visibleItems).toHaveLength(40);

      // After third tick: 40 + 10 = 50 (complete)
      await tick();
      expect(result.current.visibleItems).toHaveLength(50);
      expect(result.current.isComplete).toBe(true);
      expect(result.current.progress).toBe(1);
    });

    it('stops ticking once all items are visible', async () => {
      const items = range(30);
      const { result } = renderHook(() => useProgressiveRender(items));

      // tick 1: 20 + 10 = 30 (complete)
      await tick();
      expect(result.current.isComplete).toBe(true);

      // Additional ticks should be no-ops.
      await tick();
      await tick();
      expect(result.current.visibleItems).toHaveLength(30);
    });

    it('preserves item ordering', async () => {
      const items = range(40);
      const { result } = renderHook(() => useProgressiveRender(items));
      await drainUntilComplete(result);
      expect(result.current.visibleItems).toEqual(range(40));
    });
  });

  // -----------------------------------------------------------------------
  // Custom config
  // -----------------------------------------------------------------------

  describe('custom config', () => {
    it('respects custom initialBatch', () => {
      const items = range(100);
      const { result } = renderHook(() => useProgressiveRender(items, { initialBatch: 5 }));
      expect(result.current.visibleItems).toHaveLength(5);
    });

    it('respects custom batchSize', async () => {
      const items = range(50);
      const { result } = renderHook(() => useProgressiveRender(items, { batchSize: 5 }));

      // initial: 20, then +5 per tick
      await tick();
      expect(result.current.visibleItems).toHaveLength(25);
      await tick();
      expect(result.current.visibleItems).toHaveLength(30);
    });

    it('respects custom intervalMs', async () => {
      const items = range(50);
      const { result } = renderHook(() => useProgressiveRender(items, { intervalMs: 100 }));

      // After 16ms — no new batch (interval is 100ms).
      await tick(16);
      expect(result.current.visibleItems).toHaveLength(20);

      // After 100ms — next batch.
      await tick(100);
      expect(result.current.visibleItems).toHaveLength(30);
    });

    it('uses defaults for omitted config fields', async () => {
      const items = range(50);
      const { result } = renderHook(() => useProgressiveRender(items, { initialBatch: 10 }));
      // initialBatch overridden, batchSize defaults to 10
      expect(result.current.visibleItems).toHaveLength(10);
      await tick();
      expect(result.current.visibleItems).toHaveLength(20);
    });
  });

  // -----------------------------------------------------------------------
  // reset()
  // -----------------------------------------------------------------------

  describe('reset', () => {
    it('restarts the progressive reveal from the beginning', async () => {
      const items = range(50);
      const { result } = renderHook(() => useProgressiveRender(items));

      // Advance until complete.
      await drainUntilComplete(result);
      expect(result.current.isComplete).toBe(true);

      // Reset.
      act(() => {
        result.current.reset();
      });

      expect(result.current.visibleItems).toHaveLength(20);
      expect(result.current.isComplete).toBe(false);
      expect(result.current.progress).toBeCloseTo(0.4);
    });

    it('allows the reveal to continue after reset', async () => {
      const items = range(40);
      const { result } = renderHook(() => useProgressiveRender(items));

      await drainUntilComplete(result);
      expect(result.current.isComplete).toBe(true);

      act(() => {
        result.current.reset();
      });

      // Progress again.
      await tick();
      expect(result.current.visibleItems).toHaveLength(30);
      await tick();
      expect(result.current.visibleItems).toHaveLength(40);
      expect(result.current.isComplete).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Changing items array
  // -----------------------------------------------------------------------

  describe('items identity change', () => {
    it('resets when items reference changes', async () => {
      let items = range(50);
      const { result, rerender } = renderHook(({ list }) => useProgressiveRender(list), {
        initialProps: { list: items },
      });

      // Advance partially.
      await tick();
      expect(result.current.visibleItems).toHaveLength(30);

      // New items array.
      items = range(60);
      rerender({ list: items });

      // Should reset to initialBatch of the new array.
      expect(result.current.visibleItems).toHaveLength(20);
      expect(result.current.isComplete).toBe(false);
    });

    it('completes with the new items after reference change', async () => {
      let items = range(40);
      const { result, rerender } = renderHook(({ list }) => useProgressiveRender(list), {
        initialProps: { list: items },
      });

      items = range(25);
      rerender({ list: items });

      await drainUntilComplete(result);
      expect(result.current.visibleItems).toEqual(range(25));
      expect(result.current.isComplete).toBe(true);
    });

    it('does not reset when items reference stays the same', async () => {
      const items = range(50);
      const { result, rerender } = renderHook(({ list }) => useProgressiveRender(list), {
        initialProps: { list: items },
      });

      await tick();
      expect(result.current.visibleItems).toHaveLength(30);

      // Re-render with the SAME reference.
      rerender({ list: items });
      expect(result.current.visibleItems).toHaveLength(30);
    });
  });

  // -----------------------------------------------------------------------
  // Progress tracking
  // -----------------------------------------------------------------------

  describe('progress', () => {
    it('increases monotonically from initial to 1', async () => {
      const items = range(50);
      const { result } = renderHook(() => useProgressiveRender(items));

      const progressValues: number[] = [result.current.progress];
      while (!result.current.isComplete) {
        await tick();
        progressValues.push(result.current.progress);
      }

      // Verify monotonic increase.
      for (let i = 1; i < progressValues.length; i++) {
        expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1]);
      }
      expect(progressValues[progressValues.length - 1]).toBe(1);
    });

    it('is always 1 for empty arrays', () => {
      const { result } = renderHook(() => useProgressiveRender([]));
      expect(result.current.progress).toBe(1);
    });

    it('is always 1 when items fit in initialBatch', () => {
      const items = range(10);
      const { result } = renderHook(() => useProgressiveRender(items));
      expect(result.current.progress).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Generic type support
  // -----------------------------------------------------------------------

  describe('generic types', () => {
    it('works with string items', async () => {
      const items = Array.from({ length: 30 }, (_, i) => `item-${i}`);
      const { result } = renderHook(() => useProgressiveRender(items));
      expect(result.current.visibleItems[0]).toBe('item-0');
      await drainUntilComplete(result);
      expect(result.current.visibleItems).toEqual(items);
    });

    it('works with object items', async () => {
      const items = Array.from({ length: 30 }, (_, i) => ({ id: i, label: `Node ${i}` }));
      const { result } = renderHook(() => useProgressiveRender(items));
      expect(result.current.visibleItems[0]).toEqual({ id: 0, label: 'Node 0' });
      await drainUntilComplete(result);
      expect(result.current.visibleItems).toEqual(items);
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles initialBatch of 0 (starts empty, fills via batches)', async () => {
      const items = range(25);
      const { result } = renderHook(() => useProgressiveRender(items, { initialBatch: 0 }));
      expect(result.current.visibleItems).toHaveLength(0);
      expect(result.current.isComplete).toBe(false);

      await tick();
      expect(result.current.visibleItems).toHaveLength(10);
    });

    it('handles initialBatch larger than items length', () => {
      const items = range(5);
      const { result } = renderHook(() => useProgressiveRender(items, { initialBatch: 100 }));
      expect(result.current.visibleItems).toEqual(range(5));
      expect(result.current.isComplete).toBe(true);
    });

    it('handles single-item list', () => {
      const { result } = renderHook(() => useProgressiveRender([42]));
      expect(result.current.visibleItems).toEqual([42]);
      expect(result.current.isComplete).toBe(true);
      expect(result.current.progress).toBe(1);
    });

    it('handles exactly initialBatch items', () => {
      const items = range(20);
      const { result } = renderHook(() => useProgressiveRender(items));
      expect(result.current.visibleItems).toEqual(range(20));
      expect(result.current.isComplete).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  describe('cleanup', () => {
    it('clears interval on unmount', async () => {
      const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
      const items = range(100);
      const { unmount } = renderHook(() => useProgressiveRender(items));

      unmount();
      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });
  });
});
