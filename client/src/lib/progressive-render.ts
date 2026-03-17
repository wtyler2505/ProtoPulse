/**
 * Progressive Render Utility
 *
 * Renders large lists incrementally to avoid blocking the main thread.
 * An initial batch is shown immediately, then subsequent batches are
 * appended on each animation frame (or configured interval).
 *
 * Exports:
 *   - ProgressiveRenderConfig — configuration interface
 *   - DEFAULT_CONFIG — sensible defaults (initialBatch: 20, batchSize: 10, intervalMs: 16)
 *   - useProgressiveRender<T>(items, config?) — React hook
 *   - renderInBatches<T>(items, batchSize, callback) — async generator
 *   - shouldUseProgressive(itemCount, threshold?) — boolean helper
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProgressiveRenderConfig {
  /** Number of items shown immediately on first render. */
  initialBatch: number;
  /** Number of items added per subsequent tick. */
  batchSize: number;
  /** Milliseconds between batches. 16 ≈ one animation frame. */
  intervalMs: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEFAULT_CONFIG: Readonly<ProgressiveRenderConfig> = {
  initialBatch: 20,
  batchSize: 10,
  intervalMs: 16,
} as const;

// ---------------------------------------------------------------------------
// shouldUseProgressive
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the item count is large enough to warrant progressive
 * rendering. Callers can gate the hook behind this check when they want to
 * skip the overhead for tiny lists.
 *
 * @param itemCount  Total number of items.
 * @param threshold  Minimum count that triggers progressive rendering (default 50).
 */
export function shouldUseProgressive(itemCount: number, threshold = 50): boolean {
  return itemCount >= threshold;
}

// ---------------------------------------------------------------------------
// renderInBatches (async generator)
// ---------------------------------------------------------------------------

/**
 * Yields items in batches, calling `callback` for each batch and awaiting a
 * microtask between batches so the caller (or the event loop) can interleave
 * other work.
 *
 * @param items     The full array to iterate over.
 * @param batchSize Number of items per batch.
 * @param callback  Invoked with each batch slice.
 */
export async function* renderInBatches<T>(
  items: readonly T[],
  batchSize: number,
  callback: (batch: readonly T[]) => void,
): AsyncGenerator<readonly T[], void, undefined> {
  const size = Math.max(1, batchSize);

  for (let offset = 0; offset < items.length; offset += size) {
    const batch = items.slice(offset, offset + size);
    callback(batch);
    yield batch;

    // Yield control back to the event loop between batches.
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  }
}

// ---------------------------------------------------------------------------
// useProgressiveRender hook
// ---------------------------------------------------------------------------

export interface UseProgressiveRenderResult<T> {
  /** The items that should be rendered right now. */
  visibleItems: readonly T[];
  /** `true` once every item has been scheduled for display. */
  isComplete: boolean;
  /** 0-1 fraction representing how much of the list has been revealed. */
  progress: number;
  /** Restart the progressive reveal from scratch (e.g. after a filter). */
  reset: () => void;
}

/**
 * Incrementally reveals a list of items so the browser can paint between
 * batches, keeping the UI responsive for large lists.
 *
 * ```tsx
 * const { visibleItems, isComplete, progress } = useProgressiveRender(bigList);
 * ```
 */
export function useProgressiveRender<T>(
  items: readonly T[],
  config?: Partial<ProgressiveRenderConfig>,
): UseProgressiveRenderResult<T> {
  const { initialBatch, batchSize, intervalMs } = { ...DEFAULT_CONFIG, ...config };

  // Track the current reveal cursor independently of React renders so that
  // the interval callback always sees the latest value.
  const cursorRef = useRef(0);

  // Monotonically increasing "generation" — bumped on reset or when the
  // source `items` array identity changes. Stale intervals compare their
  // captured generation against this ref and bail out.
  const generationRef = useRef(0);

  // The number of items currently visible (drives the slice).
  const [visibleCount, setVisibleCount] = useState(() => Math.min(initialBatch, items.length));

  // -------------------------------------------------------------------
  // Reset helper — callable externally via the returned `reset` function
  // and also invoked internally when `items` changes identity.
  // -------------------------------------------------------------------
  const resetInternal = useCallback(() => {
    generationRef.current += 1;
    const count = Math.min(initialBatch, items.length);
    cursorRef.current = count;
    setVisibleCount(count);
  }, [initialBatch, items]);

  // Re-initialise when the items array reference changes.
  const prevItemsRef = useRef(items);
  if (prevItemsRef.current !== items) {
    prevItemsRef.current = items;
    // Direct mutation is fine here — we're in the render phase before
    // effects run, and the state update below will trigger a re-render.
    generationRef.current += 1;
    const count = Math.min(initialBatch, items.length);
    cursorRef.current = count;
    // We intentionally call setState during render (the React docs call
    // this "adjusting state during rendering" — it's the idiomatic
    // pattern for synchronising derived state without useEffect).
    setVisibleCount(count);
  }

  // -------------------------------------------------------------------
  // Tick effect — schedules successive batches until the list is complete.
  // -------------------------------------------------------------------
  useEffect(() => {
    // Already showing everything — nothing to schedule.
    if (cursorRef.current >= items.length) {
      return;
    }

    const gen = generationRef.current;

    const id = setInterval(() => {
      // Bail out if a newer generation has started.
      if (gen !== generationRef.current) {
        clearInterval(id);
        return;
      }

      const next = Math.min(cursorRef.current + batchSize, items.length);
      cursorRef.current = next;
      setVisibleCount(next);

      if (next >= items.length) {
        clearInterval(id);
      }
    }, intervalMs);

    return () => {
      clearInterval(id);
    };
  }, [items, batchSize, intervalMs]);

  // -------------------------------------------------------------------
  // Derived values
  // -------------------------------------------------------------------
  const total = items.length;
  const clampedCount = Math.min(visibleCount, total);
  const visibleItems = items.slice(0, clampedCount);
  const isComplete = total === 0 || clampedCount >= total;
  const progress = total === 0 ? 1 : clampedCount / total;

  return { visibleItems, isComplete, progress, reset: resetInternal };
}
