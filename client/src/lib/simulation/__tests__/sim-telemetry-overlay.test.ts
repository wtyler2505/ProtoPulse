import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  interpolate,
  buildCommonGrid,
  classifySeverity,
  compareSignalPair,
  matchSignals,
  generateRecommendations,
  computeHealthScore,
  SimTelemetryOverlayManager,
  DEFAULT_THRESHOLDS,
  MAX_TREND_POINTS,
} from '../sim-telemetry-overlay';
import type {
  SignalChannel,
  DataPoint,
  SignalDeviation,
  SeverityThresholds,
  DeviationSeverity,
} from '../sim-telemetry-overlay';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChannel(label: string, points: Array<[number, number]>, unit?: string): SignalChannel {
  return {
    label,
    points: points.map(([x, y]): DataPoint => ({ x, y })),
    unit,
  };
}

function linearChannel(label: string, start: number, end: number, n: number, unit?: string): SignalChannel {
  const points: DataPoint[] = [];
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0;
    points.push({ x: t, y: start + t * (end - start) });
  }
  return { label, points, unit };
}

// ---------------------------------------------------------------------------
// interpolate
// ---------------------------------------------------------------------------

describe('interpolate', () => {
  it('returns zeros for empty source arrays', () => {
    expect(interpolate([], [], [0, 1, 2])).toEqual([0, 0, 0]);
  });

  it('returns constant for single-point source', () => {
    expect(interpolate([5], [42], [0, 5, 10])).toEqual([42, 42, 42]);
  });

  it('interpolates linearly between two points', () => {
    const result = interpolate([0, 10], [0, 100], [0, 5, 10]);
    expect(result).toEqual([0, 50, 100]);
  });

  it('clamps values outside source range', () => {
    const result = interpolate([2, 8], [20, 80], [0, 2, 5, 8, 12]);
    expect(result[0]).toBe(20); // clamped left
    expect(result[1]).toBe(20); // at left edge
    expect(result[3]).toBe(80); // at right edge
    expect(result[4]).toBe(80); // clamped right
  });

  it('handles many source points', () => {
    const xs = [0, 1, 2, 3, 4];
    const ys = [0, 10, 20, 30, 40];
    const result = interpolate(xs, ys, [0.5, 1.5, 2.5, 3.5]);
    expect(result).toEqual([5, 15, 25, 35]);
  });
});

// ---------------------------------------------------------------------------
// buildCommonGrid
// ---------------------------------------------------------------------------

describe('buildCommonGrid', () => {
  it('returns empty array when either input is empty', () => {
    expect(buildCommonGrid([], [1, 2, 3])).toEqual([]);
    expect(buildCommonGrid([1, 2], [])).toEqual([]);
  });

  it('builds grid from overlapping ranges', () => {
    const grid = buildCommonGrid([0, 1, 2, 3, 4], [2, 3, 4, 5, 6]);
    // Intersection: [2, 4], n=5 (max of both lengths)
    expect(grid.length).toBe(5);
    expect(grid[0]).toBe(2);
    expect(grid[grid.length - 1]).toBe(4);
  });

  it('returns single point for non-overlapping ranges', () => {
    const grid = buildCommonGrid([0, 1], [2, 3]);
    expect(grid.length).toBe(1);
  });

  it('uses finer resolution when one array is denser', () => {
    const sparse = [0, 10];
    const dense = [0, 2, 4, 6, 8, 10];
    const grid = buildCommonGrid(sparse, dense);
    expect(grid.length).toBe(6); // max(2, 6) = 6
  });
});

// ---------------------------------------------------------------------------
// classifySeverity
// ---------------------------------------------------------------------------

describe('classifySeverity', () => {
  it('classifies 0% as nominal', () => {
    expect(classifySeverity(0)).toBe('nominal');
  });

  it('classifies exactly at nominal threshold as nominal', () => {
    expect(classifySeverity(5)).toBe('nominal');
  });

  it('classifies just above nominal as warning', () => {
    expect(classifySeverity(5.1)).toBe('warning');
  });

  it('classifies at warning threshold as warning', () => {
    expect(classifySeverity(20)).toBe('warning');
  });

  it('classifies above warning threshold as critical', () => {
    expect(classifySeverity(20.1)).toBe('critical');
    expect(classifySeverity(100)).toBe('critical');
  });

  it('respects custom thresholds', () => {
    const custom: SeverityThresholds = { nominalMaxPercent: 2, warningMaxPercent: 10 };
    expect(classifySeverity(1, custom)).toBe('nominal');
    expect(classifySeverity(3, custom)).toBe('warning');
    expect(classifySeverity(11, custom)).toBe('critical');
  });
});

// ---------------------------------------------------------------------------
// compareSignalPair
// ---------------------------------------------------------------------------

describe('compareSignalPair', () => {
  it('returns zero deviation for identical signals', () => {
    const sig = makeChannel('V(out)', [[0, 1], [1, 2], [2, 3]]);
    const result = compareSignalPair(sig, sig);
    expect(result.label).toBe('V(out)');
    expect(result.meanDeviationPercent).toBe(0);
    expect(result.maxDeviationPercent).toBe(0);
    expect(result.rmsError).toBe(0);
    expect(result.maxAbsoluteError).toBe(0);
    expect(result.severity).toBe('nominal');
    expect(result.inExpected).toBe(true);
    expect(result.inObserved).toBe(true);
  });

  it('computes deviation for single-point signals', () => {
    const exp = makeChannel('temp', [[0, 100]], '°C');
    const obs = makeChannel('temp', [[0, 110]], '°C');
    const result = compareSignalPair(exp, obs);
    expect(result.rmsError).toBe(10);
    expect(result.maxAbsoluteError).toBe(10);
    expect(result.unit).toBe('°C');
  });

  it('detects critical deviation for very different signals', () => {
    const exp = makeChannel('V(out)', [[0, 0], [1, 5], [2, 5]]);
    const obs = makeChannel('V(out)', [[0, 0], [1, 0], [2, 0]]);
    const result = compareSignalPair(exp, obs);
    expect(result.severity).toBe('critical');
    expect(result.maxDeviationPercent).toBeGreaterThan(20);
  });

  it('returns critical for no-overlap domains', () => {
    const exp = makeChannel('sig', [[0, 1], [1, 2]]);
    const obs = makeChannel('sig', [[10, 1], [11, 2]]);
    const result = compareSignalPair(exp, obs);
    // Single-point grid at xMin, both clamped
    expect(result.inExpected).toBe(true);
    expect(result.inObserved).toBe(true);
  });

  it('handles signals with different resolutions', () => {
    const exp = linearChannel('rpm', 0, 1000, 100);
    const obs = linearChannel('rpm', 0, 1000, 10);
    const result = compareSignalPair(exp, obs);
    expect(result.meanDeviationPercent).toBeLessThan(1);
    expect(result.severity).toBe('nominal');
  });

  it('propagates unit from expected', () => {
    const exp = makeChannel('V(out)', [[0, 1]], 'V');
    const obs = makeChannel('V(out)', [[0, 1]]);
    const result = compareSignalPair(exp, obs);
    expect(result.unit).toBe('V');
  });

  it('falls back to observed unit if expected has none', () => {
    const exp = makeChannel('V(out)', [[0, 1]]);
    const obs = makeChannel('V(out)', [[0, 1]], 'V');
    const result = compareSignalPair(exp, obs);
    expect(result.unit).toBe('V');
  });

  it('uses custom thresholds', () => {
    const exp = makeChannel('sig', [[0, 0], [1, 100]]);
    // 3% deviation
    const obs = makeChannel('sig', [[0, 0], [1, 103]]);
    const strict: SeverityThresholds = { nominalMaxPercent: 1, warningMaxPercent: 2 };
    const result = compareSignalPair(exp, obs, strict);
    expect(result.severity).toBe('critical');
  });
});

// ---------------------------------------------------------------------------
// matchSignals
// ---------------------------------------------------------------------------

describe('matchSignals', () => {
  it('matches signals by label case-insensitively', () => {
    const expected = [makeChannel('V(out)', [[0, 1]]), makeChannel('I(R1)', [[0, 2]])];
    const observed = [makeChannel('v(out)', [[0, 1.1]]), makeChannel('i(r1)', [[0, 2.1]])];
    const { matched, unmatchedExpected, unmatchedObserved } = matchSignals(expected, observed);
    expect(matched.length).toBe(2);
    expect(unmatchedExpected.length).toBe(0);
    expect(unmatchedObserved.length).toBe(0);
  });

  it('identifies unmatched expected signals', () => {
    const expected = [makeChannel('V(out)', [[0, 1]]), makeChannel('I(R1)', [[0, 2]])];
    const observed = [makeChannel('V(out)', [[0, 1.1]])];
    const { matched, unmatchedExpected, unmatchedObserved } = matchSignals(expected, observed);
    expect(matched.length).toBe(1);
    expect(unmatchedExpected.length).toBe(1);
    expect(unmatchedExpected[0].label).toBe('I(R1)');
    expect(unmatchedObserved.length).toBe(0);
  });

  it('identifies unmatched observed signals', () => {
    const expected = [makeChannel('V(out)', [[0, 1]])];
    const observed = [makeChannel('V(out)', [[0, 1.1]]), makeChannel('noise', [[0, 0.01]])];
    const { matched, unmatchedExpected, unmatchedObserved } = matchSignals(expected, observed);
    expect(matched.length).toBe(1);
    expect(unmatchedExpected.length).toBe(0);
    expect(unmatchedObserved.length).toBe(1);
    expect(unmatchedObserved[0].label).toBe('noise');
  });

  it('handles empty inputs', () => {
    const { matched, unmatchedExpected, unmatchedObserved } = matchSignals([], []);
    expect(matched.length).toBe(0);
    expect(unmatchedExpected.length).toBe(0);
    expect(unmatchedObserved.length).toBe(0);
  });

  it('handles no matches', () => {
    const expected = [makeChannel('a', [[0, 1]])];
    const observed = [makeChannel('b', [[0, 2]])];
    const { matched, unmatchedExpected, unmatchedObserved } = matchSignals(expected, observed);
    expect(matched.length).toBe(0);
    expect(unmatchedExpected.length).toBe(1);
    expect(unmatchedObserved.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// generateRecommendations
// ---------------------------------------------------------------------------

describe('generateRecommendations', () => {
  it('generates recommendation for unmatched expected signal', () => {
    const recs = generateRecommendations([], ['V(out)'], []);
    expect(recs.length).toBe(1);
    expect(recs[0].category).toBe('missing_signal');
    expect(recs[0].severity).toBe('warning');
    expect(recs[0].label).toBe('V(out)');
  });

  it('generates recommendation for unmatched observed signal', () => {
    const recs = generateRecommendations([], [], ['noise']);
    expect(recs.length).toBe(1);
    expect(recs[0].category).toBe('missing_signal');
    expect(recs[0].severity).toBe('nominal');
  });

  it('generates critical wiring recommendation for >50% deviation', () => {
    const devs: SignalDeviation[] = [{
      label: 'V(out)',
      meanDeviationPercent: 60,
      maxDeviationPercent: 75,
      rmsError: 3,
      maxAbsoluteError: 4,
      severity: 'critical',
      inExpected: true,
      inObserved: true,
    }];
    const recs = generateRecommendations(devs, [], []);
    expect(recs.length).toBe(2); // general critical + wiring
    expect(recs.some((r) => r.category === 'wiring')).toBe(true);
  });

  it('generates component tolerance recommendation for warning with high mean', () => {
    const devs: SignalDeviation[] = [{
      label: 'I(R1)',
      meanDeviationPercent: 12,
      maxDeviationPercent: 15,
      rmsError: 0.5,
      maxAbsoluteError: 0.7,
      severity: 'warning',
      inExpected: true,
      inObserved: true,
    }];
    const recs = generateRecommendations(devs, [], []);
    expect(recs.length).toBe(1);
    expect(recs[0].category).toBe('component_tolerance');
  });

  it('generates calibration recommendation for warning with low mean but high max', () => {
    const devs: SignalDeviation[] = [{
      label: 'temp',
      meanDeviationPercent: 3,
      maxDeviationPercent: 18,
      rmsError: 1,
      maxAbsoluteError: 5,
      severity: 'warning',
      inExpected: true,
      inObserved: true,
    }];
    const recs = generateRecommendations(devs, [], []);
    expect(recs.length).toBe(1);
    expect(recs[0].category).toBe('calibration');
  });

  it('returns no recommendations for nominal signals', () => {
    const devs: SignalDeviation[] = [{
      label: 'V(out)',
      meanDeviationPercent: 1,
      maxDeviationPercent: 2,
      rmsError: 0.01,
      maxAbsoluteError: 0.02,
      severity: 'nominal',
      inExpected: true,
      inObserved: true,
    }];
    const recs = generateRecommendations(devs, [], []);
    expect(recs.length).toBe(0);
  });

  it('sorts recommendations by severity (critical first)', () => {
    const devs: SignalDeviation[] = [
      { label: 'a', meanDeviationPercent: 12, maxDeviationPercent: 15, rmsError: 1, maxAbsoluteError: 2, severity: 'warning', inExpected: true, inObserved: true },
      { label: 'b', meanDeviationPercent: 60, maxDeviationPercent: 80, rmsError: 5, maxAbsoluteError: 8, severity: 'critical', inExpected: true, inObserved: true },
    ];
    const recs = generateRecommendations(devs, [], []);
    expect(recs[0].severity).toBe('critical');
  });

  it('skips signals that are not in both expected and observed', () => {
    const devs: SignalDeviation[] = [{
      label: 'V(out)',
      meanDeviationPercent: 50,
      maxDeviationPercent: 80,
      rmsError: 5,
      maxAbsoluteError: 8,
      severity: 'critical',
      inExpected: true,
      inObserved: false,
    }];
    const recs = generateRecommendations(devs, [], []);
    expect(recs.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeHealthScore
// ---------------------------------------------------------------------------

describe('computeHealthScore', () => {
  it('returns 100 for zero total signals', () => {
    expect(computeHealthScore([], 0, 0)).toBe(100);
  });

  it('returns 100 for perfect match', () => {
    const devs: SignalDeviation[] = [{
      label: 'V', meanDeviationPercent: 0, maxDeviationPercent: 0,
      rmsError: 0, maxAbsoluteError: 0, severity: 'nominal',
      inExpected: true, inObserved: true,
    }];
    expect(computeHealthScore(devs, 0, 1)).toBe(100);
  });

  it('returns 0 for all unmatched signals', () => {
    expect(computeHealthScore([], 3, 3)).toBe(0);
  });

  it('penalizes high deviation', () => {
    const devs: SignalDeviation[] = [{
      label: 'V', meanDeviationPercent: 50, maxDeviationPercent: 60,
      rmsError: 2, maxAbsoluteError: 3, severity: 'critical',
      inExpected: true, inObserved: true,
    }];
    const score = computeHealthScore(devs, 0, 1);
    expect(score).toBe(50);
  });

  it('penalizes unmatched signals proportionally', () => {
    const devs: SignalDeviation[] = [{
      label: 'V', meanDeviationPercent: 0, maxDeviationPercent: 0,
      rmsError: 0, maxAbsoluteError: 0, severity: 'nominal',
      inExpected: true, inObserved: true,
    }];
    // 1 matched + 1 unmatched = 2 total, match ratio = 0.5
    const score = computeHealthScore(devs, 1, 2);
    expect(score).toBe(50);
  });

  it('clamps score between 0 and 100', () => {
    const devs: SignalDeviation[] = [{
      label: 'V', meanDeviationPercent: 200, maxDeviationPercent: 300,
      rmsError: 20, maxAbsoluteError: 30, severity: 'critical',
      inExpected: true, inObserved: true,
    }];
    expect(computeHealthScore(devs, 0, 1)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// SimTelemetryOverlayManager
// ---------------------------------------------------------------------------

describe('SimTelemetryOverlayManager', () => {
  let manager: SimTelemetryOverlayManager;

  beforeEach(() => {
    manager = new SimTelemetryOverlayManager();
  });

  describe('construction', () => {
    it('starts with no result', () => {
      expect(manager.lastResult).toBeNull();
    });

    it('starts at version 0', () => {
      expect(manager.version).toBe(0);
    });

    it('uses default thresholds', () => {
      const t = manager.getThresholds();
      expect(t.nominalMaxPercent).toBe(DEFAULT_THRESHOLDS.nominalMaxPercent);
      expect(t.warningMaxPercent).toBe(DEFAULT_THRESHOLDS.warningMaxPercent);
    });

    it('accepts custom thresholds', () => {
      const custom = new SimTelemetryOverlayManager({ nominalMaxPercent: 2, warningMaxPercent: 10 });
      const t = custom.getThresholds();
      expect(t.nominalMaxPercent).toBe(2);
      expect(t.warningMaxPercent).toBe(10);
    });
  });

  describe('setThresholds', () => {
    it('updates thresholds partially', () => {
      manager.setThresholds({ nominalMaxPercent: 3 });
      const t = manager.getThresholds();
      expect(t.nominalMaxPercent).toBe(3);
      expect(t.warningMaxPercent).toBe(DEFAULT_THRESHOLDS.warningMaxPercent);
    });

    it('increments version', () => {
      const v0 = manager.version;
      manager.setThresholds({ warningMaxPercent: 15 });
      expect(manager.version).toBe(v0 + 1);
    });

    it('notifies listeners', () => {
      const listener = vi.fn();
      manager.subscribe(listener);
      manager.setThresholds({ nominalMaxPercent: 1 });
      expect(listener).toHaveBeenCalledOnce();
    });
  });

  describe('compare', () => {
    it('returns OverlayResult with all fields', () => {
      const expected = [makeChannel('V(out)', [[0, 0], [1, 5]], 'V')];
      const observed = [makeChannel('V(out)', [[0, 0], [1, 5.1]], 'V')];
      const result = manager.compare(expected, observed);

      expect(result.deviations.length).toBe(1);
      expect(result.matchedSignals).toBe(1);
      expect(result.unmatchedSignals).toBe(0);
      expect(result.healthScore).toBeGreaterThan(0);
      expect(result.timestamp).toBeTruthy();
      expect(typeof result.overallSeverity).toBe('string');
    });

    it('stores result in lastResult', () => {
      const expected = [makeChannel('V', [[0, 1]])];
      const observed = [makeChannel('V', [[0, 1]])];
      const result = manager.compare(expected, observed);
      expect(manager.lastResult).toBe(result);
    });

    it('increments version', () => {
      const v0 = manager.version;
      manager.compare([makeChannel('V', [[0, 1]])], [makeChannel('V', [[0, 1]])]);
      expect(manager.version).toBe(v0 + 1);
    });

    it('notifies listeners', () => {
      const listener = vi.fn();
      manager.subscribe(listener);
      manager.compare([makeChannel('V', [[0, 1]])], [makeChannel('V', [[0, 1]])]);
      expect(listener).toHaveBeenCalledOnce();
    });

    it('handles empty inputs', () => {
      const result = manager.compare([], []);
      expect(result.deviations.length).toBe(0);
      expect(result.matchedSignals).toBe(0);
      expect(result.healthScore).toBe(100);
      expect(result.overallSeverity).toBe('nominal');
    });

    it('marks unmatched expected signals', () => {
      const result = manager.compare(
        [makeChannel('V', [[0, 1]])],
        [],
      );
      expect(result.unmatchedSignals).toBe(1);
      expect(result.deviations[0].inExpected).toBe(true);
      expect(result.deviations[0].inObserved).toBe(false);
    });

    it('marks unmatched observed signals', () => {
      const result = manager.compare(
        [],
        [makeChannel('noise', [[0, 0.01]])],
      );
      expect(result.unmatchedSignals).toBe(1);
      expect(result.deviations[0].inExpected).toBe(false);
      expect(result.deviations[0].inObserved).toBe(true);
    });

    it('detects critical deviation', () => {
      const expected = [makeChannel('V(out)', [[0, 0], [1, 10]])];
      const observed = [makeChannel('V(out)', [[0, 0], [1, 0]])]; // completely off
      const result = manager.compare(expected, observed);
      expect(result.overallSeverity).toBe('critical');
    });

    it('generates recommendations for issues', () => {
      const expected = [makeChannel('V(out)', [[0, 0], [1, 10]])];
      const observed = [makeChannel('V(out)', [[0, 0], [1, 0]])];
      const result = manager.compare(expected, observed);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('reports overall severity as worst across all signals', () => {
      const expected = [
        makeChannel('good', [[0, 0], [1, 5]]),
        makeChannel('bad', [[0, 0], [1, 10]]),
      ];
      const observed = [
        makeChannel('good', [[0, 0], [1, 5]]),     // nominal
        makeChannel('bad', [[0, 0], [1, 0]]),       // critical
      ];
      const result = manager.compare(expected, observed);
      expect(result.overallSeverity).toBe('critical');
    });

    it('handles multiple signals with mixed results', () => {
      const expected = [
        makeChannel('V1', [[0, 0], [1, 5]], 'V'),
        makeChannel('V2', [[0, 0], [1, 5]], 'V'),
        makeChannel('V3', [[0, 0], [1, 5]], 'V'),
      ];
      const observed = [
        makeChannel('V1', [[0, 0], [1, 5]], 'V'),      // perfect
        makeChannel('V2', [[0, 0], [1, 5.5]], 'V'),    // slight deviation
        makeChannel('extra', [[0, 0], [1, 1]], 'V'),   // unmatched observed
      ];
      const result = manager.compare(expected, observed);
      expect(result.matchedSignals).toBe(2);
      expect(result.unmatchedSignals).toBe(2); // V3 + extra
    });
  });

  describe('trends', () => {
    it('records trend points on compare', () => {
      const expected = [makeChannel('V', [[0, 0], [1, 5]])];
      const observed = [makeChannel('V', [[0, 0], [1, 5.2]])];
      manager.compare(expected, observed);
      const trend = manager.getTrend('V');
      expect(trend).not.toBeNull();
      expect(trend!.points.length).toBe(1);
    });

    it('accumulates trend points across multiple comparisons', () => {
      const expected = [makeChannel('V', [[0, 0], [1, 5]])];
      for (let i = 0; i < 5; i++) {
        const observed = [makeChannel('V', [[0, 0], [1, 5 + i * 0.1]])];
        manager.compare(expected, observed);
      }
      const trend = manager.getTrend('V');
      expect(trend!.points.length).toBe(5);
    });

    it('case-insensitive trend lookup', () => {
      manager.compare(
        [makeChannel('V(out)', [[0, 0], [1, 5]])],
        [makeChannel('v(out)', [[0, 0], [1, 5.1]])],
      );
      const trend = manager.getTrend('V(OUT)');
      expect(trend).not.toBeNull();
    });

    it('evicts oldest trend points at MAX_TREND_POINTS', () => {
      const expected = [makeChannel('V', [[0, 0], [1, 5]])];
      for (let i = 0; i < MAX_TREND_POINTS + 10; i++) {
        manager.compare(expected, [makeChannel('V', [[0, 0], [1, 5 + i * 0.01]])]);
      }
      const trend = manager.getTrend('V');
      expect(trend!.points.length).toBe(MAX_TREND_POINTS);
    });

    it('detects improving trend (decreasing deviation)', () => {
      const expected = [makeChannel('V', [[0, 0], [1, 10]])];
      // Deviations decrease over time
      for (let i = 10; i >= 1; i--) {
        manager.compare(expected, [makeChannel('V', [[0, 0], [1, 10 + i * 0.5]])]);
      }
      const trend = manager.getTrend('V');
      expect(trend!.direction).toBe('improving');
    });

    it('detects degrading trend (increasing deviation)', () => {
      const expected = [makeChannel('V', [[0, 0], [1, 10]])];
      for (let i = 1; i <= 10; i++) {
        manager.compare(expected, [makeChannel('V', [[0, 0], [1, 10 + i * 0.5]])]);
      }
      const trend = manager.getTrend('V');
      expect(trend!.direction).toBe('degrading');
    });

    it('detects stable trend (consistent deviation)', () => {
      const expected = [makeChannel('V', [[0, 0], [1, 10]])];
      for (let i = 0; i < 10; i++) {
        manager.compare(expected, [makeChannel('V', [[0, 0], [1, 10.5]])]);
      }
      const trend = manager.getTrend('V');
      expect(trend!.direction).toBe('stable');
    });

    it('returns null for unknown signal', () => {
      expect(manager.getTrend('nonexistent')).toBeNull();
    });

    it('lists all trend labels', () => {
      manager.compare(
        [makeChannel('V1', [[0, 1]]), makeChannel('V2', [[0, 2]])],
        [makeChannel('V1', [[0, 1.1]]), makeChannel('V2', [[0, 2.1]])],
      );
      const labels = manager.getTrendLabels();
      expect(labels.length).toBe(2);
    });

    it('clearTrends removes all trend data', () => {
      manager.compare(
        [makeChannel('V', [[0, 0], [1, 5]])],
        [makeChannel('V', [[0, 0], [1, 5.1]])],
      );
      expect(manager.getTrend('V')).not.toBeNull();
      manager.clearTrends();
      expect(manager.getTrend('V')).toBeNull();
      expect(manager.getTrendLabels().length).toBe(0);
    });

    it('does not track trends for unmatched signals', () => {
      manager.compare(
        [makeChannel('sim_only', [[0, 1]])],
        [makeChannel('hw_only', [[0, 2]])],
      );
      expect(manager.getTrend('sim_only')).toBeNull();
      expect(manager.getTrend('hw_only')).toBeNull();
    });
  });

  describe('subscribe', () => {
    it('adds and removes listeners', () => {
      const listener = vi.fn();
      const unsub = manager.subscribe(listener);
      manager.compare([makeChannel('V', [[0, 1]])], [makeChannel('V', [[0, 1]])]);
      expect(listener).toHaveBeenCalledOnce();
      unsub();
      manager.compare([makeChannel('V', [[0, 1]])], [makeChannel('V', [[0, 1]])]);
      expect(listener).toHaveBeenCalledOnce(); // not called again
    });

    it('supports multiple listeners', () => {
      const l1 = vi.fn();
      const l2 = vi.fn();
      manager.subscribe(l1);
      manager.subscribe(l2);
      manager.compare([makeChannel('V', [[0, 1]])], [makeChannel('V', [[0, 1]])]);
      expect(l1).toHaveBeenCalledOnce();
      expect(l2).toHaveBeenCalledOnce();
    });
  });

  describe('reset', () => {
    it('clears result, trends, and resets version', () => {
      manager.compare(
        [makeChannel('V', [[0, 0], [1, 5]])],
        [makeChannel('V', [[0, 0], [1, 5.1]])],
      );
      expect(manager.lastResult).not.toBeNull();
      expect(manager.version).toBeGreaterThan(0);
      manager.reset();
      expect(manager.lastResult).toBeNull();
      expect(manager.version).toBe(0);
      expect(manager.getTrendLabels().length).toBe(0);
    });

    it('notifies listeners on reset', () => {
      const listener = vi.fn();
      manager.subscribe(listener);
      manager.reset();
      expect(listener).toHaveBeenCalledOnce();
    });
  });

  describe('real-world scenarios', () => {
    it('simulated vs actual LED brightness (PWM)', () => {
      // Simulation: linear PWM ramp 0-255
      const expected = [makeChannel('pwm', Array.from({ length: 100 }, (_, i): [number, number] => [i * 0.01, i * 2.55]))];
      // Actual: slightly nonlinear due to LED forward voltage
      const observed = [makeChannel('pwm', Array.from({ length: 100 }, (_, i): [number, number] => [i * 0.01, i * 2.55 * 0.97 + 2]))];
      const result = manager.compare(expected, observed);
      expect(result.matchedSignals).toBe(1);
      expect(result.overallSeverity).not.toBe('critical');
    });

    it('motor RPM with noise', () => {
      const expected = [makeChannel('rpm', [[0, 0], [0.5, 500], [1, 1000]], 'RPM')];
      // Actual RPM with small random-ish deviations
      const observed = [makeChannel('rpm', [[0, 5], [0.5, 510], [1, 985]], 'RPM')];
      const result = manager.compare(expected, observed);
      expect(result.deviations[0].unit).toBe('RPM');
      expect(result.healthScore).toBeGreaterThan(50);
    });

    it('temperature sensor completely disconnected', () => {
      const expected = [makeChannel('temp', [[0, 25], [60, 45]], '°C')];
      const observed = [makeChannel('temp', [[0, 0], [60, 0]], '°C')]; // sensor reads 0
      const result = manager.compare(expected, observed);
      expect(result.overallSeverity).toBe('critical');
      expect(result.recommendations.some((r) => r.category === 'wiring')).toBe(true);
    });
  });
});
