/**
 * Tests for SimCompareManager — snapshot CRUD, FIFO eviction, statistical comparison.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { simCompareManager, MAX_SNAPSHOTS } from '../sim-compare';
import type { SimulationData, Signal } from '../sim-compare';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a simple transient simulation with one signal. */
function makeSimData(
  signals: Signal[] = [makeSineSignal()],
  simType: SimulationData['simType'] = 'transient',
): SimulationData {
  return { simType, signals };
}

/** Create a sine-wave signal: y = amplitude * sin(2π * freq * x). */
function makeSineSignal(
  name = 'V(out)',
  points = 100,
  amplitude = 1,
  freq = 1,
  xUnit = 's',
  yUnit = 'V',
): Signal {
  const xValues: number[] = [];
  const yValues: number[] = [];
  for (let i = 0; i < points; i++) {
    const x = i / (points - 1);
    xValues.push(x);
    yValues.push(amplitude * Math.sin(2 * Math.PI * freq * x));
  }
  return { name, xValues, yValues, xUnit, yUnit };
}

/** Create a DC (constant) signal. */
function makeDCSignal(name = 'V(dc)', value = 5, points = 50): Signal {
  const xValues: number[] = [];
  const yValues: number[] = [];
  for (let i = 0; i < points; i++) {
    xValues.push(i / (points - 1));
    yValues.push(value);
  }
  return { name, xValues, yValues, xUnit: 's', yUnit: 'V' };
}

/** Create a linear ramp signal. */
function makeRampSignal(name = 'V(ramp)', start = 0, end = 10, points = 100): Signal {
  const xValues: number[] = [];
  const yValues: number[] = [];
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    xValues.push(t);
    yValues.push(start + (end - start) * t);
  }
  return { name, xValues, yValues, xUnit: 's', yUnit: 'V' };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  simCompareManager._reset();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SimCompareManager', () => {
  // ==================== Snapshot CRUD ====================

  describe('captureSnapshot', () => {
    it('creates a snapshot with correct fields', () => {
      const data = makeSimData();
      const snap = simCompareManager.captureSnapshot('Run 1', data);

      expect(snap.id).toBeTruthy();
      expect(snap.label).toBe('Run 1');
      expect(snap.capturedAt).toBeTruthy();
      expect(snap.data.simType).toBe('transient');
      expect(snap.data.signals).toHaveLength(1);
    });

    it('deep-clones the simulation data (mutations to original do not affect snapshot)', () => {
      const data = makeSimData();
      const snap = simCompareManager.captureSnapshot('Clone test', data);

      // Mutate the original
      data.signals[0].yValues[0] = 999;

      expect(snap.data.signals[0].yValues[0]).not.toBe(999);
    });

    it('assigns unique IDs to each snapshot', () => {
      const data = makeSimData();
      const a = simCompareManager.captureSnapshot('A', data);
      const b = simCompareManager.captureSnapshot('B', data);
      expect(a.id).not.toBe(b.id);
    });

    it('increments version on capture', () => {
      const v0 = simCompareManager.version;
      simCompareManager.captureSnapshot('V test', makeSimData());
      expect(simCompareManager.version).toBe(v0 + 1);
    });
  });

  describe('listSnapshots', () => {
    it('returns empty array initially', () => {
      expect(simCompareManager.listSnapshots()).toEqual([]);
    });

    it('returns snapshots in insertion order', () => {
      simCompareManager.captureSnapshot('First', makeSimData());
      simCompareManager.captureSnapshot('Second', makeSimData());
      simCompareManager.captureSnapshot('Third', makeSimData());

      const labels = simCompareManager.listSnapshots().map((s) => s.label);
      expect(labels).toEqual(['First', 'Second', 'Third']);
    });

    it('returns a copy (mutations do not affect internal state)', () => {
      simCompareManager.captureSnapshot('Original', makeSimData());
      const list = simCompareManager.listSnapshots();
      list.length = 0; // mutate the returned array
      expect(simCompareManager.listSnapshots()).toHaveLength(1);
    });
  });

  describe('getSnapshot', () => {
    it('returns a snapshot by ID', () => {
      const snap = simCompareManager.captureSnapshot('Findme', makeSimData());
      const found = simCompareManager.getSnapshot(snap.id);
      expect(found).toBeDefined();
      expect(found?.label).toBe('Findme');
    });

    it('returns undefined for unknown ID', () => {
      expect(simCompareManager.getSnapshot('nonexistent')).toBeUndefined();
    });
  });

  describe('deleteSnapshot', () => {
    it('removes a snapshot by ID', () => {
      const snap = simCompareManager.captureSnapshot('Delete me', makeSimData());
      expect(simCompareManager.deleteSnapshot(snap.id)).toBe(true);
      expect(simCompareManager.listSnapshots()).toHaveLength(0);
    });

    it('returns false for unknown ID', () => {
      expect(simCompareManager.deleteSnapshot('nope')).toBe(false);
    });

    it('increments version on delete', () => {
      const snap = simCompareManager.captureSnapshot('V', makeSimData());
      const v = simCompareManager.version;
      simCompareManager.deleteSnapshot(snap.id);
      expect(simCompareManager.version).toBe(v + 1);
    });
  });

  describe('renameSnapshot', () => {
    it('updates the label of an existing snapshot', () => {
      const snap = simCompareManager.captureSnapshot('Old', makeSimData());
      const renamed = simCompareManager.renameSnapshot(snap.id, 'New');
      expect(renamed?.label).toBe('New');
      expect(simCompareManager.getSnapshot(snap.id)?.label).toBe('New');
    });

    it('returns undefined for unknown ID', () => {
      expect(simCompareManager.renameSnapshot('nope', 'X')).toBeUndefined();
    });
  });

  describe('count', () => {
    it('reflects the number of stored snapshots', () => {
      expect(simCompareManager.count).toBe(0);
      simCompareManager.captureSnapshot('A', makeSimData());
      expect(simCompareManager.count).toBe(1);
      simCompareManager.captureSnapshot('B', makeSimData());
      expect(simCompareManager.count).toBe(2);
    });
  });

  // ==================== FIFO Eviction ====================

  describe('FIFO eviction', () => {
    it('evicts oldest snapshot when exceeding MAX_SNAPSHOTS', () => {
      // Fill to capacity
      for (let i = 0; i < MAX_SNAPSHOTS; i++) {
        simCompareManager.captureSnapshot(`Snap ${i}`, makeSimData());
      }
      expect(simCompareManager.count).toBe(MAX_SNAPSHOTS);

      // Add one more — should evict "Snap 0"
      simCompareManager.captureSnapshot('Overflow', makeSimData());
      expect(simCompareManager.count).toBe(MAX_SNAPSHOTS);

      const labels = simCompareManager.listSnapshots().map((s) => s.label);
      expect(labels).not.toContain('Snap 0');
      expect(labels).toContain('Overflow');
      expect(labels[0]).toBe('Snap 1');
    });

    it('evicts multiple oldest snapshots when many added at once', () => {
      for (let i = 0; i < MAX_SNAPSHOTS + 3; i++) {
        simCompareManager.captureSnapshot(`S${i}`, makeSimData());
      }
      expect(simCompareManager.count).toBe(MAX_SNAPSHOTS);

      const labels = simCompareManager.listSnapshots().map((s) => s.label);
      expect(labels[0]).toBe('S3');
      expect(labels[labels.length - 1]).toBe(`S${MAX_SNAPSHOTS + 2}`);
    });

    it('MAX_SNAPSHOTS is 10', () => {
      expect(MAX_SNAPSHOTS).toBe(10);
    });
  });

  // ==================== Subscribe Pattern ====================

  describe('subscribe', () => {
    it('calls listener on capture', () => {
      const listener = vi.fn();
      simCompareManager.subscribe(listener);
      simCompareManager.captureSnapshot('X', makeSimData());
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('calls listener on delete', () => {
      const snap = simCompareManager.captureSnapshot('X', makeSimData());
      const listener = vi.fn();
      simCompareManager.subscribe(listener);
      simCompareManager.deleteSnapshot(snap.id);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('calls listener on rename', () => {
      const snap = simCompareManager.captureSnapshot('X', makeSimData());
      const listener = vi.fn();
      simCompareManager.subscribe(listener);
      simCompareManager.renameSnapshot(snap.id, 'Y');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('unsubscribe stops notifications', () => {
      const listener = vi.fn();
      const unsub = simCompareManager.subscribe(listener);
      unsub();
      simCompareManager.captureSnapshot('After unsub', makeSimData());
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ==================== Comparison — RMS Error ====================

  describe('compare — RMS error', () => {
    it('returns 0 RMS for identical snapshots', () => {
      const data = makeSimData([makeSineSignal('V(out)')]);
      const a = simCompareManager.captureSnapshot('A', data);
      const b = simCompareManager.captureSnapshot('B', data);

      const result = simCompareManager.compare(a.id, b.id);
      expect(result).toBeDefined();
      expect(result!.overallRmsError).toBeCloseTo(0, 10);

      const diff = result!.signalDiffs.find((d) => d.signalName === 'V(out)');
      expect(diff?.rmsError).toBeCloseTo(0, 10);
    });

    it('computes correct RMS for known offset signals', () => {
      // Signal A: constant 0, Signal B: constant 1 → RMS = 1.0
      const dataA = makeSimData([makeDCSignal('V(x)', 0, 50)]);
      const dataB = makeSimData([makeDCSignal('V(x)', 1, 50)]);

      const a = simCompareManager.captureSnapshot('A', dataA);
      const b = simCompareManager.captureSnapshot('B', dataB);

      const result = simCompareManager.compare(a.id, b.id)!;
      const diff = result.signalDiffs.find((d) => d.signalName === 'V(x)');
      expect(diff?.rmsError).toBeCloseTo(1.0, 5);
    });

    it('computes correct RMS for known varying signals', () => {
      // A: [0, 1, 2, 3], B: [1, 2, 3, 4] → diff = [1,1,1,1] → RMS = 1.0
      const sigA: Signal = { name: 'V(t)', xValues: [0, 1, 2, 3], yValues: [0, 1, 2, 3] };
      const sigB: Signal = { name: 'V(t)', xValues: [0, 1, 2, 3], yValues: [1, 2, 3, 4] };

      const a = simCompareManager.captureSnapshot('A', makeSimData([sigA]));
      const b = simCompareManager.captureSnapshot('B', makeSimData([sigB]));

      const result = simCompareManager.compare(a.id, b.id)!;
      expect(result.signalDiffs[0].rmsError).toBeCloseTo(1.0, 5);
    });
  });

  // ==================== Comparison — Peak Deviation ====================

  describe('compare — peak deviation', () => {
    it('returns 0 peak deviation for identical snapshots', () => {
      const data = makeSimData([makeSineSignal()]);
      const a = simCompareManager.captureSnapshot('A', data);
      const b = simCompareManager.captureSnapshot('B', data);

      const result = simCompareManager.compare(a.id, b.id)!;
      expect(result.overallPeakDeviation).toBeCloseTo(0, 10);
    });

    it('finds the correct peak deviation', () => {
      // A: [0, 0, 0, 0], B: [0, 0, 5, 0] → peak = 5
      const sigA: Signal = { name: 'I(R1)', xValues: [0, 1, 2, 3], yValues: [0, 0, 0, 0] };
      const sigB: Signal = { name: 'I(R1)', xValues: [0, 1, 2, 3], yValues: [0, 0, 5, 0] };

      const a = simCompareManager.captureSnapshot('A', makeSimData([sigA]));
      const b = simCompareManager.captureSnapshot('B', makeSimData([sigB]));

      const result = simCompareManager.compare(a.id, b.id)!;
      expect(result.signalDiffs[0].peakDeviation).toBeCloseTo(5, 5);
      expect(result.overallPeakDeviation).toBeCloseTo(5, 5);
    });

    it('overall peak is the max across all signals', () => {
      const sigA1: Signal = { name: 'V(1)', xValues: [0, 1], yValues: [0, 0] };
      const sigA2: Signal = { name: 'V(2)', xValues: [0, 1], yValues: [0, 0] };
      const sigB1: Signal = { name: 'V(1)', xValues: [0, 1], yValues: [3, 0] };
      const sigB2: Signal = { name: 'V(2)', xValues: [0, 1], yValues: [7, 0] };

      const a = simCompareManager.captureSnapshot('A', makeSimData([sigA1, sigA2]));
      const b = simCompareManager.captureSnapshot('B', makeSimData([sigB1, sigB2]));

      const result = simCompareManager.compare(a.id, b.id)!;
      expect(result.overallPeakDeviation).toBeCloseTo(7, 5);
    });
  });

  // ==================== Comparison — Correlation ====================

  describe('compare — correlation', () => {
    it('returns 1.0 for identical signals', () => {
      const data = makeSimData([makeRampSignal('V(ramp)')]);
      const a = simCompareManager.captureSnapshot('A', data);
      const b = simCompareManager.captureSnapshot('B', data);

      const result = simCompareManager.compare(a.id, b.id)!;
      expect(result.signalDiffs[0].correlation).toBeCloseTo(1.0, 5);
    });

    it('returns -1.0 for perfectly inverted signals', () => {
      const sigA: Signal = { name: 'V(x)', xValues: [0, 1, 2, 3, 4], yValues: [1, 2, 3, 4, 5] };
      const sigB: Signal = { name: 'V(x)', xValues: [0, 1, 2, 3, 4], yValues: [-1, -2, -3, -4, -5] };

      const a = simCompareManager.captureSnapshot('A', makeSimData([sigA]));
      const b = simCompareManager.captureSnapshot('B', makeSimData([sigB]));

      const result = simCompareManager.compare(a.id, b.id)!;
      expect(result.signalDiffs[0].correlation).toBeCloseTo(-1.0, 5);
    });

    it('returns 1.0 for scaled signals (perfect linear relationship)', () => {
      const sigA: Signal = { name: 'V(x)', xValues: [0, 1, 2, 3], yValues: [1, 2, 3, 4] };
      const sigB: Signal = { name: 'V(x)', xValues: [0, 1, 2, 3], yValues: [10, 20, 30, 40] };

      const a = simCompareManager.captureSnapshot('A', makeSimData([sigA]));
      const b = simCompareManager.captureSnapshot('B', makeSimData([sigB]));

      const result = simCompareManager.compare(a.id, b.id)!;
      expect(result.signalDiffs[0].correlation).toBeCloseTo(1.0, 5);
    });

    it('returns 1.0 for two constant signals with the same value', () => {
      const a = simCompareManager.captureSnapshot('A', makeSimData([makeDCSignal('V(dc)', 5)]));
      const b = simCompareManager.captureSnapshot('B', makeSimData([makeDCSignal('V(dc)', 5)]));

      const result = simCompareManager.compare(a.id, b.id)!;
      expect(result.signalDiffs[0].correlation).toBeCloseTo(1.0, 5);
    });

    it('returns 0 for two constant signals with different values', () => {
      const a = simCompareManager.captureSnapshot('A', makeSimData([makeDCSignal('V(dc)', 5)]));
      const b = simCompareManager.captureSnapshot('B', makeSimData([makeDCSignal('V(dc)', 10)]));

      const result = simCompareManager.compare(a.id, b.id)!;
      expect(result.signalDiffs[0].correlation).toBe(0);
    });
  });

  // ==================== Comparison — Signal Matching ====================

  describe('compare — signal matching', () => {
    it('matches signals by name across snapshots', () => {
      const dataA = makeSimData([
        { name: 'V(1)', xValues: [0, 1], yValues: [0, 1] },
        { name: 'V(2)', xValues: [0, 1], yValues: [0, 2] },
      ]);
      const dataB = makeSimData([
        { name: 'V(2)', xValues: [0, 1], yValues: [0, 2] },
        { name: 'V(1)', xValues: [0, 1], yValues: [0, 1] },
      ]);

      const a = simCompareManager.captureSnapshot('A', dataA);
      const b = simCompareManager.captureSnapshot('B', dataB);

      const result = simCompareManager.compare(a.id, b.id)!;
      expect(result.signalDiffs).toHaveLength(2);
      for (const diff of result.signalDiffs) {
        expect(diff.inA).toBe(true);
        expect(diff.inB).toBe(true);
        expect(diff.rmsError).toBeCloseTo(0, 10);
      }
    });

    it('marks signals only in snapshot A', () => {
      const dataA = makeSimData([
        { name: 'V(only-A)', xValues: [0, 1], yValues: [1, 2] },
      ]);
      const dataB = makeSimData([
        { name: 'V(only-B)', xValues: [0, 1], yValues: [3, 4] },
      ]);

      const a = simCompareManager.captureSnapshot('A', dataA);
      const b = simCompareManager.captureSnapshot('B', dataB);

      const result = simCompareManager.compare(a.id, b.id)!;
      expect(result.signalDiffs).toHaveLength(2);

      const diffA = result.signalDiffs.find((d) => d.signalName === 'V(only-A)');
      expect(diffA?.inA).toBe(true);
      expect(diffA?.inB).toBe(false);

      const diffB = result.signalDiffs.find((d) => d.signalName === 'V(only-B)');
      expect(diffB?.inA).toBe(false);
      expect(diffB?.inB).toBe(true);
    });

    it('handles partial overlap — some shared, some unique', () => {
      const dataA = makeSimData([
        { name: 'V(shared)', xValues: [0, 1], yValues: [1, 1] },
        { name: 'V(a-only)', xValues: [0, 1], yValues: [2, 2] },
      ]);
      const dataB = makeSimData([
        { name: 'V(shared)', xValues: [0, 1], yValues: [1, 1] },
        { name: 'V(b-only)', xValues: [0, 1], yValues: [3, 3] },
      ]);

      const a = simCompareManager.captureSnapshot('A', dataA);
      const b = simCompareManager.captureSnapshot('B', dataB);

      const result = simCompareManager.compare(a.id, b.id)!;
      expect(result.signalDiffs).toHaveLength(3);

      const shared = result.signalDiffs.find((d) => d.signalName === 'V(shared)');
      expect(shared?.inA).toBe(true);
      expect(shared?.inB).toBe(true);
      expect(shared?.rmsError).toBeCloseTo(0, 10);
    });
  });

  // ==================== Comparison — Different-Length Signals ====================

  describe('compare — different-length signals', () => {
    it('handles signals with different point counts via interpolation', () => {
      // Same ramp, different resolution — should compare as nearly identical
      const sigA: Signal = { name: 'V(x)', xValues: [0, 0.5, 1], yValues: [0, 5, 10] };
      const sigB: Signal = { name: 'V(x)', xValues: [0, 0.25, 0.5, 0.75, 1], yValues: [0, 2.5, 5, 7.5, 10] };

      const a = simCompareManager.captureSnapshot('A', makeSimData([sigA]));
      const b = simCompareManager.captureSnapshot('B', makeSimData([sigB]));

      const result = simCompareManager.compare(a.id, b.id)!;
      expect(result.signalDiffs[0].rmsError).toBeCloseTo(0, 3);
      expect(result.signalDiffs[0].correlation).toBeCloseTo(1.0, 3);
    });

    it('handles signals with different x ranges (partial overlap)', () => {
      // A covers [0, 2], B covers [1, 3] — overlap is [1, 2]
      const sigA: Signal = { name: 'V(x)', xValues: [0, 1, 2], yValues: [0, 10, 20] };
      const sigB: Signal = { name: 'V(x)', xValues: [1, 2, 3], yValues: [10, 20, 30] };

      const a = simCompareManager.captureSnapshot('A', makeSimData([sigA]));
      const b = simCompareManager.captureSnapshot('B', makeSimData([sigB]));

      const result = simCompareManager.compare(a.id, b.id)!;
      // In the overlap region [1, 2] both signals have the same values
      expect(result.signalDiffs[0].rmsError).toBeCloseTo(0, 3);
    });
  });

  // ==================== Comparison — Edge Cases ====================

  describe('compare — edge cases', () => {
    it('returns undefined when snapshot A does not exist', () => {
      const b = simCompareManager.captureSnapshot('B', makeSimData());
      expect(simCompareManager.compare('nonexistent', b.id)).toBeUndefined();
    });

    it('returns undefined when snapshot B does not exist', () => {
      const a = simCompareManager.captureSnapshot('A', makeSimData());
      expect(simCompareManager.compare(a.id, 'nonexistent')).toBeUndefined();
    });

    it('handles empty signals (no data points)', () => {
      const emptySig: Signal = { name: 'V(empty)', xValues: [], yValues: [] };
      const a = simCompareManager.captureSnapshot('A', makeSimData([emptySig]));
      const b = simCompareManager.captureSnapshot('B', makeSimData([emptySig]));

      const result = simCompareManager.compare(a.id, b.id)!;
      expect(result.signalDiffs[0].rmsError).toBe(0);
      expect(result.signalDiffs[0].correlation).toBe(1);
    });

    it('handles single-point signals', () => {
      const sigA: Signal = { name: 'V(x)', xValues: [0], yValues: [5] };
      const sigB: Signal = { name: 'V(x)', xValues: [0], yValues: [5] };

      const a = simCompareManager.captureSnapshot('A', makeSimData([sigA]));
      const b = simCompareManager.captureSnapshot('B', makeSimData([sigB]));

      const result = simCompareManager.compare(a.id, b.id)!;
      expect(result.signalDiffs[0].rmsError).toBeCloseTo(0, 10);
      expect(result.signalDiffs[0].peakDeviation).toBeCloseTo(0, 10);
    });

    it('handles single-point signals with different values', () => {
      const sigA: Signal = { name: 'V(x)', xValues: [0], yValues: [5] };
      const sigB: Signal = { name: 'V(x)', xValues: [0], yValues: [8] };

      const a = simCompareManager.captureSnapshot('A', makeSimData([sigA]));
      const b = simCompareManager.captureSnapshot('B', makeSimData([sigB]));

      const result = simCompareManager.compare(a.id, b.id)!;
      expect(result.signalDiffs[0].rmsError).toBeCloseTo(3, 5);
      expect(result.signalDiffs[0].peakDeviation).toBeCloseTo(3, 5);
    });

    it('handles no shared signals (all unique)', () => {
      const dataA = makeSimData([{ name: 'V(a)', xValues: [0], yValues: [1] }]);
      const dataB = makeSimData([{ name: 'V(b)', xValues: [0], yValues: [2] }]);

      const a = simCompareManager.captureSnapshot('A', dataA);
      const b = simCompareManager.captureSnapshot('B', dataB);

      const result = simCompareManager.compare(a.id, b.id)!;
      expect(result.overallRmsError).toBe(0); // No paired signals
      expect(result.overallPeakDeviation).toBe(0);
    });

    it('comparing a snapshot with itself gives perfect results', () => {
      const data = makeSimData([makeSineSignal('V(out)', 200)]);
      const snap = simCompareManager.captureSnapshot('Self', data);

      const result = simCompareManager.compare(snap.id, snap.id)!;
      expect(result.overallRmsError).toBeCloseTo(0, 10);
      expect(result.overallPeakDeviation).toBeCloseTo(0, 10);
      expect(result.signalDiffs[0].correlation).toBeCloseTo(1.0, 10);
    });

    it('handles snapshots with no signals at all', () => {
      const a = simCompareManager.captureSnapshot('A', makeSimData([]));
      const b = simCompareManager.captureSnapshot('B', makeSimData([]));

      const result = simCompareManager.compare(a.id, b.id)!;
      expect(result.signalDiffs).toHaveLength(0);
      expect(result.overallRmsError).toBe(0);
      expect(result.overallPeakDeviation).toBe(0);
    });
  });

  // ==================== Overlay Data ====================

  describe('getOverlayData', () => {
    it('returns overlay series for shared signals', () => {
      const sigA: Signal = { name: 'V(out)', xValues: [0, 1, 2], yValues: [0, 5, 10], xUnit: 's', yUnit: 'V' };
      const sigB: Signal = { name: 'V(out)', xValues: [0, 1, 2], yValues: [1, 6, 11], xUnit: 's', yUnit: 'V' };

      const a = simCompareManager.captureSnapshot('A', makeSimData([sigA]));
      const b = simCompareManager.captureSnapshot('B', makeSimData([sigB]));

      const overlay = simCompareManager.getOverlayData(a.id, b.id);
      expect(overlay).toBeDefined();
      expect(overlay!.series).toHaveLength(1);

      const s = overlay!.series[0];
      expect(s.signalName).toBe('V(out)');
      expect(s.xA).toEqual([0, 1, 2]);
      expect(s.yA).toEqual([0, 5, 10]);
      expect(s.xB).toEqual([0, 1, 2]);
      expect(s.yB).toEqual([1, 6, 11]);
      expect(s.xUnit).toBe('s');
      expect(s.yUnit).toBe('V');
    });

    it('includes empty arrays for signals only in one snapshot', () => {
      const dataA = makeSimData([{ name: 'V(a)', xValues: [0, 1], yValues: [1, 2] }]);
      const dataB = makeSimData([{ name: 'V(b)', xValues: [0, 1], yValues: [3, 4] }]);

      const a = simCompareManager.captureSnapshot('A', dataA);
      const b = simCompareManager.captureSnapshot('B', dataB);

      const overlay = simCompareManager.getOverlayData(a.id, b.id)!;
      expect(overlay.series).toHaveLength(2);

      const sa = overlay.series.find((s) => s.signalName === 'V(a)');
      expect(sa?.xA).toEqual([0, 1]);
      expect(sa?.xB).toEqual([]);
      expect(sa?.yB).toEqual([]);

      const sb = overlay.series.find((s) => s.signalName === 'V(b)');
      expect(sb?.xA).toEqual([]);
      expect(sb?.yA).toEqual([]);
      expect(sb?.xB).toEqual([0, 1]);
    });

    it('returns undefined when snapshot does not exist', () => {
      const a = simCompareManager.captureSnapshot('A', makeSimData());
      expect(simCompareManager.getOverlayData(a.id, 'nope')).toBeUndefined();
      expect(simCompareManager.getOverlayData('nope', a.id)).toBeUndefined();
    });

    it('preserves units from available signals', () => {
      const sigA: Signal = { name: 'V(x)', xValues: [0], yValues: [1], xUnit: 'ms', yUnit: 'mV' };
      const dataA = makeSimData([sigA]);
      const dataB = makeSimData([]); // No signals in B

      const a = simCompareManager.captureSnapshot('A', dataA);
      const b = simCompareManager.captureSnapshot('B', dataB);

      const overlay = simCompareManager.getOverlayData(a.id, b.id)!;
      expect(overlay.series[0].xUnit).toBe('ms');
      expect(overlay.series[0].yUnit).toBe('mV');
    });
  });

  // ==================== Persistence ====================

  describe('persistence', () => {
    it('persists snapshots to localStorage', () => {
      simCompareManager.captureSnapshot('Persisted', makeSimData());
      const raw = localStorage.getItem('protopulse-sim-compare-snapshots');
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].label).toBe('Persisted');
    });

    it('survives corrupt localStorage data gracefully', () => {
      localStorage.setItem('protopulse-sim-compare-snapshots', 'NOT_JSON{{{');
      // Re-create to trigger load
      simCompareManager._reset();
      expect(simCompareManager.listSnapshots()).toEqual([]);
    });
  });

  // ==================== Reset ====================

  describe('_reset', () => {
    it('clears all snapshots and version', () => {
      simCompareManager.captureSnapshot('X', makeSimData());
      simCompareManager.captureSnapshot('Y', makeSimData());
      simCompareManager._reset();
      expect(simCompareManager.listSnapshots()).toEqual([]);
      expect(simCompareManager.version).toBe(0);
    });

    it('notifies listeners on reset', () => {
      simCompareManager.captureSnapshot('X', makeSimData());
      const listener = vi.fn();
      simCompareManager.subscribe(listener);
      simCompareManager._reset();
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});
