import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  DurationTracker,
  formatDuration,
  useOperationDuration,
  HEURISTIC_DURATIONS,
} from '../operation-duration';
import type { DurationRecord, OperationType } from '../operation-duration';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

function createMockLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
    get length() {
      return store.size;
    },
    key: vi.fn((_index: number) => null),
  };
}

// ---------------------------------------------------------------------------
// DurationTracker
// ---------------------------------------------------------------------------

describe('DurationTracker', () => {
  let tracker: DurationTracker;
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    DurationTracker.resetInstance();
    tracker = DurationTracker.getInstance();
  });

  afterEach(() => {
    DurationTracker.resetInstance();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  it('returns the same instance on repeated calls', () => {
    const a = DurationTracker.getInstance();
    const b = DurationTracker.getInstance();
    expect(a).toBe(b);
  });

  it('creates a fresh instance after resetInstance', () => {
    tracker.recordDuration('compile', 5000);
    DurationTracker.resetInstance();
    const fresh = DurationTracker.getInstance();
    // fresh instance loads from localStorage, so it should still have the sample
    expect(fresh.getSampleCount('compile')).toBe(1);
  });

  // -----------------------------------------------------------------------
  // recordDuration
  // -----------------------------------------------------------------------

  it('records a duration sample', () => {
    tracker.recordDuration('compile', 5000);
    expect(tracker.getSampleCount('compile')).toBe(1);
  });

  it('records multiple samples for the same operation', () => {
    tracker.recordDuration('drc', 1000);
    tracker.recordDuration('drc', 1500);
    tracker.recordDuration('drc', 2000);
    expect(tracker.getSampleCount('drc')).toBe(3);
  });

  it('ignores zero duration', () => {
    tracker.recordDuration('compile', 0);
    expect(tracker.getSampleCount('compile')).toBe(0);
  });

  it('ignores negative duration', () => {
    tracker.recordDuration('compile', -100);
    expect(tracker.getSampleCount('compile')).toBe(0);
  });

  it('ignores NaN duration', () => {
    tracker.recordDuration('compile', NaN);
    expect(tracker.getSampleCount('compile')).toBe(0);
  });

  it('ignores Infinity duration', () => {
    tracker.recordDuration('compile', Infinity);
    expect(tracker.getSampleCount('compile')).toBe(0);
  });

  it('enforces max 50 samples by evicting oldest', () => {
    const baseTime = Date.now();
    const dateSpy = vi.spyOn(Date, 'now');

    for (let i = 0; i < 55; i++) {
      dateSpy.mockReturnValueOnce(baseTime + i);
      tracker.recordDuration('simulate', 1000 + i);
    }

    expect(tracker.getSampleCount('simulate')).toBe(50);

    // The oldest 5 samples (recordedAt = baseTime+0..4) should be evicted
    const samples = tracker.getSamples('simulate');
    const oldest = Math.min(...samples.map((s) => s.recordedAt));
    expect(oldest).toBe(baseTime + 5);

    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // getSamples
  // -----------------------------------------------------------------------

  it('returns a copy of samples (not the internal array)', () => {
    tracker.recordDuration('drc', 2000);
    const samples1 = tracker.getSamples('drc');
    const samples2 = tracker.getSamples('drc');
    expect(samples1).not.toBe(samples2);
    expect(samples1).toEqual(samples2);
  });

  it('returns empty array for unknown operation', () => {
    expect(tracker.getSamples('compile')).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // getEstimate — heuristic fallback
  // -----------------------------------------------------------------------

  it('returns heuristic estimate when no historical data', () => {
    const estimate = tracker.getEstimate('compile');
    expect(estimate.operation).toBe('compile');
    expect(estimate.estimatedMs).toBe(HEURISTIC_DURATIONS.compile);
    expect(estimate.confidence).toBe('low');
    expect(estimate.basis).toBe('heuristic');
  });

  it('returns heuristic for all operation types', () => {
    const operations: OperationType[] = ['export', 'compile', 'simulate', 'drc', 'import', 'ai_chat', 'autoroute'];
    for (const op of operations) {
      const estimate = tracker.getEstimate(op);
      expect(estimate.estimatedMs).toBe(HEURISTIC_DURATIONS[op]);
      expect(estimate.basis).toBe('heuristic');
    }
  });

  it('applies complexity multiplier to heuristic', () => {
    const estimate = tracker.getEstimate('compile', 2.5);
    expect(estimate.estimatedMs).toBe(Math.round(HEURISTIC_DURATIONS.compile * 2.5));
    expect(estimate.basis).toBe('heuristic');
  });

  // -----------------------------------------------------------------------
  // getEstimate — historical
  // -----------------------------------------------------------------------

  it('returns historical estimate with single sample', () => {
    tracker.recordDuration('drc', 3000);
    const estimate = tracker.getEstimate('drc');
    expect(estimate.estimatedMs).toBe(3000);
    expect(estimate.confidence).toBe('low');
    expect(estimate.basis).toBe('historical');
  });

  it('returns median for odd number of samples', () => {
    tracker.recordDuration('drc', 1000);
    tracker.recordDuration('drc', 3000);
    tracker.recordDuration('drc', 2000);
    const estimate = tracker.getEstimate('drc');
    expect(estimate.estimatedMs).toBe(2000); // median of [1000, 2000, 3000]
  });

  it('returns median for even number of samples', () => {
    tracker.recordDuration('drc', 1000);
    tracker.recordDuration('drc', 2000);
    tracker.recordDuration('drc', 3000);
    tracker.recordDuration('drc', 4000);
    const estimate = tracker.getEstimate('drc');
    expect(estimate.estimatedMs).toBe(2500); // median of [1000, 2000, 3000, 4000]
  });

  it('applies complexity multiplier to historical estimate', () => {
    tracker.recordDuration('drc', 2000);
    const estimate = tracker.getEstimate('drc', 3);
    expect(estimate.estimatedMs).toBe(6000);
    expect(estimate.basis).toBe('historical');
  });

  it('ignores non-positive complexity multiplier', () => {
    tracker.recordDuration('drc', 2000);
    const est0 = tracker.getEstimate('drc', 0);
    const estNeg = tracker.getEstimate('drc', -1);
    const estNaN = tracker.getEstimate('drc', NaN);
    expect(est0.estimatedMs).toBe(2000);
    expect(estNeg.estimatedMs).toBe(2000);
    expect(estNaN.estimatedMs).toBe(2000);
  });

  // -----------------------------------------------------------------------
  // Confidence levels
  // -----------------------------------------------------------------------

  it('returns low confidence with 1-2 samples', () => {
    tracker.recordDuration('export', 1000);
    tracker.recordDuration('export', 2000);
    expect(tracker.getEstimate('export').confidence).toBe('low');
  });

  it('returns medium confidence with 3-9 samples', () => {
    for (let i = 0; i < 3; i++) {
      tracker.recordDuration('export', 1000 + i * 100);
    }
    expect(tracker.getEstimate('export').confidence).toBe('medium');

    for (let i = 0; i < 6; i++) {
      tracker.recordDuration('export', 2000 + i * 100);
    }
    expect(tracker.getSampleCount('export')).toBe(9);
    expect(tracker.getEstimate('export').confidence).toBe('medium');
  });

  it('returns high confidence with 10+ samples', () => {
    for (let i = 0; i < 10; i++) {
      tracker.recordDuration('export', 1000 + i * 100);
    }
    expect(tracker.getEstimate('export').confidence).toBe('high');
  });

  // -----------------------------------------------------------------------
  // clearOperation
  // -----------------------------------------------------------------------

  it('clears samples for a specific operation', () => {
    tracker.recordDuration('compile', 5000);
    tracker.recordDuration('drc', 2000);
    tracker.clearOperation('compile');
    expect(tracker.getSampleCount('compile')).toBe(0);
    expect(tracker.getSampleCount('drc')).toBe(1);
  });

  it('clearOperation is safe for empty operation', () => {
    expect(() => {
      tracker.clearOperation('compile');
    }).not.toThrow();
  });

  // -----------------------------------------------------------------------
  // clearAll
  // -----------------------------------------------------------------------

  it('clears all recorded durations', () => {
    tracker.recordDuration('compile', 5000);
    tracker.recordDuration('drc', 2000);
    tracker.clearAll();
    expect(tracker.getSampleCount('compile')).toBe(0);
    expect(tracker.getSampleCount('drc')).toBe(0);
  });

  it('clearAll is safe when already empty', () => {
    expect(() => {
      tracker.clearAll();
    }).not.toThrow();
  });

  // -----------------------------------------------------------------------
  // localStorage persistence
  // -----------------------------------------------------------------------

  it('persists to localStorage on recordDuration', () => {
    tracker.recordDuration('compile', 5000);
    expect(mockStorage.setItem).toHaveBeenCalledWith(
      'protopulse:op-durations',
      expect.any(String),
    );
  });

  it('persists to localStorage on clearOperation', () => {
    tracker.recordDuration('compile', 5000);
    vi.mocked(mockStorage.setItem).mockClear();
    tracker.clearOperation('compile');
    expect(mockStorage.setItem).toHaveBeenCalled();
  });

  it('loads from localStorage on init', () => {
    const data: Record<string, DurationRecord[]> = {
      compile: [{ ms: 5000, recordedAt: Date.now() }],
    };
    vi.mocked(mockStorage.getItem).mockReturnValue(JSON.stringify(data));

    DurationTracker.resetInstance();
    const loaded = DurationTracker.getInstance();
    expect(loaded.getSampleCount('compile')).toBe(1);
    expect(loaded.getEstimate('compile').estimatedMs).toBe(5000);
  });

  it('handles corrupt localStorage gracefully', () => {
    vi.mocked(mockStorage.getItem).mockReturnValue('not valid json{{{');
    DurationTracker.resetInstance();
    const loaded = DurationTracker.getInstance();
    expect(loaded.getSampleCount('compile')).toBe(0);
  });

  it('handles non-object localStorage data gracefully', () => {
    vi.mocked(mockStorage.getItem).mockReturnValue('"just a string"');
    DurationTracker.resetInstance();
    const loaded = DurationTracker.getInstance();
    expect(loaded.getSampleCount('compile')).toBe(0);
  });

  it('handles array localStorage data gracefully', () => {
    vi.mocked(mockStorage.getItem).mockReturnValue('[1, 2, 3]');
    DurationTracker.resetInstance();
    const loaded = DurationTracker.getInstance();
    expect(loaded.getSampleCount('compile')).toBe(0);
  });

  it('filters out invalid entries from localStorage', () => {
    const data: Record<string, unknown[]> = {
      compile: [
        { ms: 5000, recordedAt: 123456 },
        { invalid: true }, // missing required fields
        { ms: 3000, recordedAt: 123457 },
      ],
    };
    vi.mocked(mockStorage.getItem).mockReturnValue(JSON.stringify(data));
    DurationTracker.resetInstance();
    const loaded = DurationTracker.getInstance();
    expect(loaded.getSampleCount('compile')).toBe(2);
  });

  it('ignores invalid operation types in localStorage', () => {
    const data: Record<string, DurationRecord[]> = {
      compile: [{ ms: 5000, recordedAt: Date.now() }],
      bogus_operation: [{ ms: 1000, recordedAt: Date.now() }],
    };
    vi.mocked(mockStorage.getItem).mockReturnValue(JSON.stringify(data));
    DurationTracker.resetInstance();
    const loaded = DurationTracker.getInstance();
    expect(loaded.getSampleCount('compile')).toBe(1);
    expect(loaded.getSamples('compile')).toHaveLength(1);
  });

  // -----------------------------------------------------------------------
  // Subscribe / unsubscribe
  // -----------------------------------------------------------------------

  it('calls subscriber on recordDuration', () => {
    const callback = vi.fn();
    tracker.subscribe(callback);
    tracker.recordDuration('compile', 5000);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('calls subscriber on clearOperation', () => {
    tracker.recordDuration('compile', 5000);
    const callback = vi.fn();
    tracker.subscribe(callback);
    tracker.clearOperation('compile');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('calls subscriber on clearAll', () => {
    tracker.recordDuration('compile', 5000);
    const callback = vi.fn();
    tracker.subscribe(callback);
    tracker.clearAll();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not call subscriber after unsubscribe', () => {
    const callback = vi.fn();
    const unsub = tracker.subscribe(callback);
    unsub();
    tracker.recordDuration('compile', 5000);
    expect(callback).not.toHaveBeenCalled();
  });

  it('does not notify on invalid recordDuration', () => {
    const callback = vi.fn();
    tracker.subscribe(callback);
    tracker.recordDuration('compile', 0);
    tracker.recordDuration('compile', -1);
    tracker.recordDuration('compile', NaN);
    expect(callback).not.toHaveBeenCalled();
  });

  it('does not notify on clearOperation of empty operation', () => {
    const callback = vi.fn();
    tracker.subscribe(callback);
    tracker.clearOperation('compile');
    expect(callback).not.toHaveBeenCalled();
  });

  it('does not notify on clearAll when already empty', () => {
    const callback = vi.fn();
    tracker.subscribe(callback);
    tracker.clearAll();
    expect(callback).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// formatDuration
// ---------------------------------------------------------------------------

describe('formatDuration', () => {
  it('formats sub-second durations', () => {
    expect(formatDuration(0)).toBe('< 1s');
    expect(formatDuration(500)).toBe('< 1s');
    expect(formatDuration(999)).toBe('< 1s');
  });

  it('formats 1-9 second durations', () => {
    expect(formatDuration(1000)).toBe('~1s');
    expect(formatDuration(1500)).toBe('~2s');
    expect(formatDuration(2000)).toBe('~2s');
    expect(formatDuration(5000)).toBe('~5s');
    expect(formatDuration(9400)).toBe('~9s');
  });

  it('formats 10-59 second durations rounded to nearest 5', () => {
    expect(formatDuration(10000)).toBe('~10s');
    expect(formatDuration(12000)).toBe('~10s');
    expect(formatDuration(13000)).toBe('~15s');
    expect(formatDuration(30000)).toBe('~30s');
    expect(formatDuration(57000)).toBe('~55s');
    expect(formatDuration(58000)).toBe('~60s');
  });

  it('formats 60-119 seconds as ~1 min', () => {
    expect(formatDuration(60000)).toBe('~1 min');
    expect(formatDuration(90000)).toBe('~1 min');
    expect(formatDuration(119000)).toBe('~1 min');
  });

  it('formats 120+ seconds as N-M min range', () => {
    expect(formatDuration(120000)).toBe('~2 min');
    expect(formatDuration(150000)).toBe('2-3 min');
    expect(formatDuration(300000)).toBe('~5 min');
    expect(formatDuration(330000)).toBe('5-6 min');
  });

  it('handles negative values', () => {
    expect(formatDuration(-1000)).toBe('< 1s');
  });

  it('handles NaN', () => {
    expect(formatDuration(NaN)).toBe('< 1s');
  });

  it('handles Infinity', () => {
    expect(formatDuration(Infinity)).toBe('< 1s');
  });
});

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

describe('useOperationDuration', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    DurationTracker.resetInstance();
  });

  afterEach(() => {
    DurationTracker.resetInstance();
  });

  it('returns heuristic estimate when no data', () => {
    const { result } = renderHook(() => useOperationDuration('compile'));
    expect(result.current.estimate.basis).toBe('heuristic');
    expect(result.current.estimate.estimatedMs).toBe(HEURISTIC_DURATIONS.compile);
    expect(result.current.estimate.confidence).toBe('low');
    expect(result.current.sampleCount).toBe(0);
  });

  it('returns formatted string', () => {
    const { result } = renderHook(() => useOperationDuration('drc'));
    expect(result.current.formatted).toBe(formatDuration(HEURISTIC_DURATIONS.drc));
  });

  it('records duration and updates estimate', () => {
    const { result } = renderHook(() => useOperationDuration('drc'));
    act(() => {
      result.current.recordDuration(4500);
    });
    expect(result.current.estimate.estimatedMs).toBe(4500);
    expect(result.current.estimate.basis).toBe('historical');
    expect(result.current.sampleCount).toBe(1);
  });

  it('respects complexity parameter', () => {
    const { result } = renderHook(() => useOperationDuration('compile', 2));
    expect(result.current.estimate.estimatedMs).toBe(HEURISTIC_DURATIONS.compile * 2);
  });

  it('cleans up subscription on unmount', () => {
    const { unmount } = renderHook(() => useOperationDuration('compile'));
    unmount();
    // Should not throw when tracker notifies after unmount
    expect(() => {
      DurationTracker.getInstance().recordDuration('compile', 5000);
    }).not.toThrow();
  });
});
