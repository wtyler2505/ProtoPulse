import { describe, it, expect, beforeEach } from 'vitest';
import {
  PredictiveAlertManager,
  getPredictiveAlertManager,
  resetPredictiveAlertManager,
  mean,
  variance,
  stdDev,
  linearRegression,
  countDirectionChanges,
  timeToThreshold,
} from '../predictive-alerts';
import type {
  AlertSnapshot,
  PredictiveAlert,
  DataPoint,
} from '../predictive-alerts';

// ──────────────────────────────────────────────────────────────────
// Math helpers
// ──────────────────────────────────────────────────────────────────

describe('mean', () => {
  it('returns 0 for empty array', () => {
    expect(mean([])).toBe(0);
  });

  it('computes mean of single value', () => {
    expect(mean([5])).toBe(5);
  });

  it('computes mean of multiple values', () => {
    expect(mean([2, 4, 6])).toBe(4);
  });

  it('handles negative values', () => {
    expect(mean([-3, 3])).toBe(0);
  });
});

describe('variance', () => {
  it('returns 0 for empty array', () => {
    expect(variance([])).toBe(0);
  });

  it('returns 0 for single value', () => {
    expect(variance([42])).toBe(0);
  });

  it('computes population variance', () => {
    // [2, 4, 6] mean=4, deviations: [-2,0,2], squares: [4,0,4], variance = 8/3
    expect(variance([2, 4, 6])).toBeCloseTo(8 / 3, 10);
  });

  it('computes variance of identical values as 0', () => {
    expect(variance([7, 7, 7, 7])).toBe(0);
  });
});

describe('stdDev', () => {
  it('returns 0 for empty array', () => {
    expect(stdDev([])).toBe(0);
  });

  it('returns sqrt of variance', () => {
    expect(stdDev([2, 4, 6])).toBeCloseTo(Math.sqrt(8 / 3), 10);
  });
});

describe('linearRegression', () => {
  it('returns zero slope for single point', () => {
    const result = linearRegression([{ value: 5, timestamp: 1000 }]);
    expect(result.slope).toBe(0);
    expect(result.intercept).toBe(5);
  });

  it('returns zero slope for empty array', () => {
    const result = linearRegression([]);
    expect(result.slope).toBe(0);
    expect(result.intercept).toBe(0);
  });

  it('computes positive slope for rising data', () => {
    const points: DataPoint[] = [
      { value: 0, timestamp: 0 },
      { value: 1, timestamp: 1000 },
      { value: 2, timestamp: 2000 },
      { value: 3, timestamp: 3000 },
    ];
    const result = linearRegression(points);
    expect(result.slope).toBeCloseTo(1.0, 5); // 1 unit per second
    expect(result.r2).toBeCloseTo(1.0, 5);
  });

  it('computes negative slope for falling data', () => {
    const points: DataPoint[] = [
      { value: 10, timestamp: 0 },
      { value: 8, timestamp: 1000 },
      { value: 6, timestamp: 2000 },
      { value: 4, timestamp: 3000 },
    ];
    const result = linearRegression(points);
    expect(result.slope).toBeCloseTo(-2.0, 5);
    expect(result.r2).toBeCloseTo(1.0, 5);
  });

  it('returns low R² for noisy data', () => {
    const points: DataPoint[] = [
      { value: 5, timestamp: 0 },
      { value: 1, timestamp: 1000 },
      { value: 8, timestamp: 2000 },
      { value: 2, timestamp: 3000 },
      { value: 7, timestamp: 4000 },
    ];
    const result = linearRegression(points);
    expect(result.r2).toBeLessThan(0.5);
  });

  it('handles constant values (zero slope)', () => {
    const points: DataPoint[] = [
      { value: 5, timestamp: 0 },
      { value: 5, timestamp: 1000 },
      { value: 5, timestamp: 2000 },
    ];
    const result = linearRegression(points);
    expect(result.slope).toBe(0);
  });
});

describe('countDirectionChanges', () => {
  it('returns 0 for fewer than 3 values', () => {
    expect(countDirectionChanges([])).toBe(0);
    expect(countDirectionChanges([1])).toBe(0);
    expect(countDirectionChanges([1, 2])).toBe(0);
  });

  it('returns 0 for monotonically increasing', () => {
    expect(countDirectionChanges([1, 2, 3, 4, 5])).toBe(0);
  });

  it('returns 0 for monotonically decreasing', () => {
    expect(countDirectionChanges([5, 4, 3, 2, 1])).toBe(0);
  });

  it('counts direction changes for oscillating data', () => {
    // up, down, up, down, up = 4 changes
    expect(countDirectionChanges([1, 3, 1, 3, 1, 3])).toBe(4);
  });

  it('ignores consecutive equal values', () => {
    expect(countDirectionChanges([1, 1, 2, 2, 1])).toBe(1);
  });
});

describe('timeToThreshold', () => {
  it('returns positive time for approaching threshold', () => {
    expect(timeToThreshold(50, 2, 100)).toBeCloseTo(25, 5);
  });

  it('returns null for zero slope', () => {
    expect(timeToThreshold(50, 0, 100)).toBeNull();
  });

  it('returns null when slope moves away from threshold', () => {
    expect(timeToThreshold(50, -1, 100)).toBeNull();
  });

  it('handles negative threshold approach', () => {
    expect(timeToThreshold(50, -2, 0)).toBeCloseTo(25, 5);
  });

  it('returns null for negative slope moving away from lower threshold', () => {
    expect(timeToThreshold(50, 1, 0)).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────
// PredictiveAlertManager — Singleton
// ──────────────────────────────────────────────────────────────────

describe('PredictiveAlertManager singleton', () => {
  beforeEach(() => {
    resetPredictiveAlertManager();
  });

  it('returns same instance', () => {
    const a = getPredictiveAlertManager();
    const b = getPredictiveAlertManager();
    expect(a).toBe(b);
  });

  it('reset creates new instance', () => {
    const a = getPredictiveAlertManager();
    resetPredictiveAlertManager();
    const b = getPredictiveAlertManager();
    expect(a).not.toBe(b);
  });
});

// ──────────────────────────────────────────────────────────────────
// PredictiveAlertManager — Configuration
// ──────────────────────────────────────────────────────────────────

describe('PredictiveAlertManager configuration', () => {
  let mgr: PredictiveAlertManager;

  beforeEach(() => {
    mgr = new PredictiveAlertManager();
  });

  it('returns default thresholds for unconfigured variable', () => {
    const t = mgr.getThresholds('unknown');
    expect(t.slopeThreshold).toBe(0.1);
    expect(t.zScoreThreshold).toBe(3.0);
    expect(t.windowSize).toBe(20);
  });

  it('configures per-variable thresholds', () => {
    mgr.configureVariable('temp', { slopeThreshold: 0.5, criticalMax: 100 });
    const t = mgr.getThresholds('temp');
    expect(t.slopeThreshold).toBe(0.5);
    expect(t.criticalMax).toBe(100);
    expect(t.windowSize).toBe(20); // default preserved
  });

  it('setEnabled / isEnabled toggle detection', () => {
    expect(mgr.isEnabled()).toBe(true);
    mgr.setEnabled(false);
    expect(mgr.isEnabled()).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────
// PredictiveAlertManager — Subscribe / notify
// ──────────────────────────────────────────────────────────────────

describe('PredictiveAlertManager subscribe', () => {
  let mgr: PredictiveAlertManager;

  beforeEach(() => {
    mgr = new PredictiveAlertManager();
  });

  it('notifies listeners on configuration change', () => {
    let called = 0;
    mgr.subscribe(() => called++);
    mgr.configureVariable('x', { slopeThreshold: 5 });
    expect(called).toBe(1);
  });

  it('unsubscribe stops notifications', () => {
    let called = 0;
    const unsub = mgr.subscribe(() => called++);
    unsub();
    mgr.configureVariable('x', { slopeThreshold: 5 });
    expect(called).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// PredictiveAlertManager — Rising trend detection
// ──────────────────────────────────────────────────────────────────

describe('rising trend detection', () => {
  let mgr: PredictiveAlertManager;

  beforeEach(() => {
    mgr = new PredictiveAlertManager();
    mgr.configureVariable('temp', {
      slopeThreshold: 0.05,
      windowSize: 10,
      criticalMax: 100,
    });
  });

  it('detects rising trend from linear ramp', () => {
    let alerts: PredictiveAlert[] = [];
    for (let i = 0; i < 15; i++) {
      // 1 unit per second — slope = 1.0
      alerts = mgr.ingest('temp', 20 + i, i * 1000);
    }
    const rising = alerts.filter((a) => a.type === 'rising');
    expect(rising.length).toBeGreaterThanOrEqual(1);
    expect(rising[0].variableName).toBe('temp');
  });

  it('includes time-to-threshold when criticalMax is set', () => {
    let alerts: PredictiveAlert[] = [];
    for (let i = 0; i < 15; i++) {
      alerts = mgr.ingest('temp', 50 + i, i * 1000);
    }
    const rising = alerts.filter((a) => a.type === 'rising');
    expect(rising.length).toBeGreaterThanOrEqual(1);
    expect(rising[0].timeToThreshold).not.toBeNull();
    expect(rising[0].timeToThreshold!).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// PredictiveAlertManager — Falling trend detection
// ──────────────────────────────────────────────────────────────────

describe('falling trend detection', () => {
  let mgr: PredictiveAlertManager;

  beforeEach(() => {
    mgr = new PredictiveAlertManager();
    mgr.configureVariable('voltage', {
      slopeThreshold: 0.05,
      windowSize: 10,
      criticalMin: 0,
    });
  });

  it('detects falling trend', () => {
    let alerts: PredictiveAlert[] = [];
    for (let i = 0; i < 15; i++) {
      alerts = mgr.ingest('voltage', 10 - i * 0.5, i * 1000);
    }
    const falling = alerts.filter((a) => a.type === 'falling');
    expect(falling.length).toBeGreaterThanOrEqual(1);
  });

  it('includes time-to-threshold for falling towards criticalMin', () => {
    let alerts: PredictiveAlert[] = [];
    for (let i = 0; i < 15; i++) {
      alerts = mgr.ingest('voltage', 10 - i * 0.5, i * 1000);
    }
    const falling = alerts.filter((a) => a.type === 'falling');
    expect(falling.length).toBeGreaterThanOrEqual(1);
    expect(falling[0].timeToThreshold).not.toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────
// PredictiveAlertManager — Spike detection
// ──────────────────────────────────────────────────────────────────

describe('spike detection', () => {
  let mgr: PredictiveAlertManager;

  beforeEach(() => {
    mgr = new PredictiveAlertManager();
    mgr.configureVariable('pressure', {
      zScoreThreshold: 2.5,
      windowSize: 10,
      slopeThreshold: 100, // disable trend detection for these tests
    });
  });

  it('detects spike outlier', () => {
    // Feed stable values then a spike
    for (let i = 0; i < 12; i++) {
      mgr.ingest('pressure', 100, i * 1000);
    }
    const alerts = mgr.ingest('pressure', 200, 12000);
    const spikes = alerts.filter((a) => a.type === 'spike');
    expect(spikes.length).toBe(1);
    expect(spikes[0].severity).toBe('warning');
  });

  it('critical spike for extreme outlier', () => {
    for (let i = 0; i < 15; i++) {
      mgr.ingest('pressure', 100 + (i % 2) * 0.1, i * 1000);
    }
    // Inject a massive spike
    const alerts = mgr.ingest('pressure', 500, 15000);
    const spikes = alerts.filter((a) => a.type === 'spike');
    expect(spikes.length).toBe(1);
    expect(spikes[0].severity).toBe('critical');
  });

  it('does not flag normal variation', () => {
    for (let i = 0; i < 15; i++) {
      mgr.ingest('pressure', 100 + Math.sin(i) * 2, i * 1000);
    }
    // Value within normal range
    const alerts = mgr.ingest('pressure', 101, 15000);
    const spikes = alerts.filter((a) => a.type === 'spike');
    expect(spikes.length).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// PredictiveAlertManager — Drift detection
// ──────────────────────────────────────────────────────────────────

describe('drift detection', () => {
  let mgr: PredictiveAlertManager;

  beforeEach(() => {
    mgr = new PredictiveAlertManager();
    mgr.configureVariable('sensor', {
      driftTolerance: 5,
      windowSize: 5,
      slopeThreshold: 100, // disable trend
    });
  });

  it('detects drift from baseline', () => {
    mgr.setBaseline('sensor', 50);
    // Feed values that drift far from baseline
    let alerts: PredictiveAlert[] = [];
    for (let i = 0; i < 6; i++) {
      alerts = mgr.ingest('sensor', 50 + i * 2, i * 1000);
    }
    const driftAlerts = alerts.filter((a) => a.type === 'drift');
    expect(driftAlerts.length).toBeGreaterThanOrEqual(1);
  });

  it('auto-sets baseline from first ingest if not explicit', () => {
    const alerts = mgr.ingest('auto', 100, 0);
    // First point = baseline, so no drift
    const drift = alerts.filter((a) => a.type === 'drift');
    expect(drift.length).toBe(0);
  });

  it('critical drift for very large deviation', () => {
    mgr.setBaseline('sensor', 50);
    const alerts = mgr.ingest('sensor', 65, 0); // deviation = 15 > 5*2 = 10
    const driftAlerts = alerts.filter((a) => a.type === 'drift');
    expect(driftAlerts.length).toBe(1);
    expect(driftAlerts[0].severity).toBe('critical');
  });
});

// ──────────────────────────────────────────────────────────────────
// PredictiveAlertManager — Oscillation detection
// ──────────────────────────────────────────────────────────────────

describe('oscillation detection', () => {
  let mgr: PredictiveAlertManager;

  beforeEach(() => {
    mgr = new PredictiveAlertManager();
    mgr.configureVariable('motor', {
      oscillationFrequency: 4,
      windowSize: 10,
      slopeThreshold: 100,
      driftTolerance: 1000,
    });
  });

  it('detects oscillating signal', () => {
    let alerts: PredictiveAlert[] = [];
    for (let i = 0; i < 12; i++) {
      const val = i % 2 === 0 ? 100 : 50;
      alerts = mgr.ingest('motor', val, i * 1000);
    }
    const osc = alerts.filter((a) => a.type === 'oscillation');
    expect(osc.length).toBeGreaterThanOrEqual(1);
  });

  it('does not flag stable signal', () => {
    let alerts: PredictiveAlert[] = [];
    for (let i = 0; i < 12; i++) {
      alerts = mgr.ingest('motor', 100 + i, i * 1000);
    }
    const osc = alerts.filter((a) => a.type === 'oscillation');
    expect(osc.length).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// PredictiveAlertManager — Flatline detection
// ──────────────────────────────────────────────────────────────────

describe('flatline detection', () => {
  let mgr: PredictiveAlertManager;

  beforeEach(() => {
    mgr = new PredictiveAlertManager();
    mgr.configureVariable('sensor', {
      flatlineVariance: 0.01,
      windowSize: 10,
      slopeThreshold: 100,
      driftTolerance: 1000,
    });
  });

  it('detects flatline (stuck sensor)', () => {
    let alerts: PredictiveAlert[] = [];
    for (let i = 0; i < 12; i++) {
      alerts = mgr.ingest('sensor', 42, i * 1000);
    }
    const flat = alerts.filter((a) => a.type === 'flatline');
    expect(flat.length).toBeGreaterThanOrEqual(1);
    expect(flat[0].severity).toBe('warning');
  });

  it('does not flag varying signal', () => {
    let alerts: PredictiveAlert[] = [];
    for (let i = 0; i < 12; i++) {
      alerts = mgr.ingest('sensor', 42 + i * 5, i * 1000);
    }
    const flat = alerts.filter((a) => a.type === 'flatline');
    expect(flat.length).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// PredictiveAlertManager — Disabled state
// ──────────────────────────────────────────────────────────────────

describe('disabled state', () => {
  it('does not generate alerts when disabled', () => {
    const mgr = new PredictiveAlertManager();
    mgr.setEnabled(false);
    for (let i = 0; i < 20; i++) {
      mgr.ingest('temp', 20 + i * 10, i * 1000);
    }
    const snap = mgr.getSnapshot();
    expect(snap.allAlerts.length).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// PredictiveAlertManager — Alert management
// ──────────────────────────────────────────────────────────────────

describe('alert management', () => {
  let mgr: PredictiveAlertManager;

  beforeEach(() => {
    mgr = new PredictiveAlertManager();
    mgr.configureVariable('temp', { slopeThreshold: 0.05, windowSize: 5 });
    // Generate some alerts via rising trend
    for (let i = 0; i < 10; i++) {
      mgr.ingest('temp', 20 + i * 2, i * 1000);
    }
  });

  it('acknowledges single alert', () => {
    const snap = mgr.getSnapshot();
    expect(snap.activeAlerts.length).toBeGreaterThan(0);
    const alertId = snap.activeAlerts[0].id;
    expect(mgr.acknowledgeAlert(alertId)).toBe(true);
    const snap2 = mgr.getSnapshot();
    expect(snap2.activeAlerts.length).toBeLessThan(snap.activeAlerts.length);
  });

  it('acknowledgeAll clears all active alerts', () => {
    const count = mgr.acknowledgeAll();
    expect(count).toBeGreaterThan(0);
    const snap = mgr.getSnapshot();
    expect(snap.activeAlerts.length).toBe(0);
  });

  it('acknowledgeAll by variable name', () => {
    // Also ingest for another variable
    mgr.configureVariable('voltage', { slopeThreshold: 0.05, windowSize: 5 });
    for (let i = 0; i < 10; i++) {
      mgr.ingest('voltage', 5 - i * 0.5, i * 1000);
    }

    const beforeCount = mgr.getSnapshot().activeAlerts.length;
    mgr.acknowledgeAll('temp');
    const afterSnap = mgr.getSnapshot();
    // Should still have voltage alerts
    const voltageActive = afterSnap.activeAlerts.filter((a) => a.variableName === 'voltage');
    expect(voltageActive.length).toBeGreaterThan(0);
    expect(afterSnap.activeAlerts.length).toBeLessThan(beforeCount);
  });

  it('clearAlerts removes all alerts', () => {
    mgr.clearAlerts();
    expect(mgr.getSnapshot().allAlerts.length).toBe(0);
  });

  it('clearAlerts by variable', () => {
    mgr.configureVariable('other', { slopeThreshold: 0.05, windowSize: 5 });
    for (let i = 0; i < 10; i++) {
      mgr.ingest('other', i * 3, i * 1000);
    }
    mgr.clearAlerts('temp');
    const snap = mgr.getSnapshot();
    expect(snap.allAlerts.every((a) => a.variableName !== 'temp')).toBe(true);
  });

  it('returns false for acknowledging unknown alert', () => {
    expect(mgr.acknowledgeAlert('nonexistent')).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────
// PredictiveAlertManager — Query helpers
// ──────────────────────────────────────────────────────────────────

describe('alert queries', () => {
  let mgr: PredictiveAlertManager;

  beforeEach(() => {
    mgr = new PredictiveAlertManager();
    mgr.configureVariable('temp', { slopeThreshold: 0.05, windowSize: 5, flatlineVariance: 1000 });
    for (let i = 0; i < 10; i++) {
      mgr.ingest('temp', 20 + i * 2, i * 1000);
    }
  });

  it('getAlertsByVariable filters by name', () => {
    const alerts = mgr.getAlertsByVariable('temp');
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.every((a) => a.variableName === 'temp')).toBe(true);
  });

  it('getAlertsByVariable returns empty for unknown', () => {
    expect(mgr.getAlertsByVariable('unknown').length).toBe(0);
  });

  it('getAlertsByType filters by type', () => {
    const rising = mgr.getAlertsByType('rising');
    expect(rising.every((a) => a.type === 'rising')).toBe(true);
  });

  it('getAlertsBySeverity filters by severity', () => {
    const all = mgr.getSnapshot().allAlerts;
    if (all.length > 0) {
      const severity = all[0].severity;
      const filtered = mgr.getAlertsBySeverity(severity);
      expect(filtered.every((a) => a.severity === severity)).toBe(true);
    }
  });
});

// ──────────────────────────────────────────────────────────────────
// PredictiveAlertManager — Data access
// ──────────────────────────────────────────────────────────────────

describe('data access', () => {
  let mgr: PredictiveAlertManager;

  beforeEach(() => {
    mgr = new PredictiveAlertManager();
  });

  it('getVariableData returns ingested points', () => {
    mgr.ingest('x', 1, 100);
    mgr.ingest('x', 2, 200);
    const data = mgr.getVariableData('x');
    expect(data.length).toBe(2);
    expect(data[0].value).toBe(1);
    expect(data[1].value).toBe(2);
  });

  it('getVariableData returns empty for unknown', () => {
    expect(mgr.getVariableData('nope').length).toBe(0);
  });

  it('getTrackedVariables lists all tracked', () => {
    mgr.ingest('a', 1);
    mgr.ingest('b', 2);
    const tracked = mgr.getTrackedVariables();
    expect(tracked).toContain('a');
    expect(tracked).toContain('b');
  });

  it('trimmed to 2x window size', () => {
    mgr.configureVariable('x', { windowSize: 5 });
    for (let i = 0; i < 20; i++) {
      mgr.ingest('x', i, i * 1000);
    }
    const data = mgr.getVariableData('x');
    expect(data.length).toBeLessThanOrEqual(10);
  });
});

// ──────────────────────────────────────────────────────────────────
// PredictiveAlertManager — Snapshot
// ──────────────────────────────────────────────────────────────────

describe('snapshot', () => {
  it('returns correct structure', () => {
    const mgr = new PredictiveAlertManager();
    const snap: AlertSnapshot = mgr.getSnapshot();
    expect(snap.activeAlerts).toEqual([]);
    expect(snap.allAlerts).toEqual([]);
    expect(snap.trackedVariables).toBe(0);
  });

  it('reflects tracked variable count', () => {
    const mgr = new PredictiveAlertManager();
    mgr.ingest('a', 1);
    mgr.ingest('b', 2);
    expect(mgr.getSnapshot().trackedVariables).toBe(2);
  });
});

// ──────────────────────────────────────────────────────────────────
// PredictiveAlertManager — Reset and removeVariable
// ──────────────────────────────────────────────────────────────────

describe('reset and removeVariable', () => {
  let mgr: PredictiveAlertManager;

  beforeEach(() => {
    mgr = new PredictiveAlertManager();
    mgr.configureVariable('temp', { slopeThreshold: 0.05, windowSize: 5 });
    for (let i = 0; i < 10; i++) {
      mgr.ingest('temp', 20 + i, i * 1000);
    }
  });

  it('reset clears everything', () => {
    mgr.reset();
    expect(mgr.getTrackedVariables().length).toBe(0);
    expect(mgr.getSnapshot().allAlerts.length).toBe(0);
    expect(mgr.isEnabled()).toBe(true);
  });

  it('removeVariable clears specific variable', () => {
    mgr.ingest('other', 1);
    mgr.removeVariable('temp');
    expect(mgr.getTrackedVariables()).not.toContain('temp');
    expect(mgr.getTrackedVariables()).toContain('other');
    expect(mgr.getAlertsByVariable('temp').length).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// PredictiveAlertManager — Trend severity classification
// ──────────────────────────────────────────────────────────────────

describe('trend severity classification', () => {
  it('info for moderate slope', () => {
    const mgr = new PredictiveAlertManager();
    mgr.configureVariable('x', { slopeThreshold: 1.0, windowSize: 5 });
    // slope ~1.5 => 1.5x threshold => info
    for (let i = 0; i < 8; i++) {
      mgr.ingest('x', i * 1.5, i * 1000);
    }
    const snap = mgr.getSnapshot();
    const rising = snap.allAlerts.filter((a) => a.type === 'rising');
    if (rising.length > 0) {
      expect(rising[0].severity).toBe('info');
    }
  });

  it('critical for very steep slope', () => {
    const mgr = new PredictiveAlertManager();
    mgr.configureVariable('x', { slopeThreshold: 0.1, windowSize: 5 });
    // slope ~10 => 100x threshold => critical
    for (let i = 0; i < 8; i++) {
      mgr.ingest('x', i * 10, i * 1000);
    }
    const snap = mgr.getSnapshot();
    const rising = snap.allAlerts.filter((a) => a.type === 'rising');
    expect(rising.length).toBeGreaterThan(0);
    expect(rising.some((a) => a.severity === 'critical')).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────
// PredictiveAlertManager — Edge cases
// ──────────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('no alerts from fewer than 3 points', () => {
    const mgr = new PredictiveAlertManager();
    const a1 = mgr.ingest('x', 1, 0);
    const a2 = mgr.ingest('x', 100, 1000);
    expect(a1.length).toBe(0);
    expect(a2.length).toBe(0);
  });

  it('handles simultaneous timestamps', () => {
    const mgr = new PredictiveAlertManager();
    for (let i = 0; i < 10; i++) {
      mgr.ingest('x', i, 1000); // all same timestamp
    }
    // Should not crash
    const snap = mgr.getSnapshot();
    expect(snap.trackedVariables).toBe(1);
  });

  it('alert trimming works at MAX_ALERTS boundary', () => {
    const mgr = new PredictiveAlertManager();
    mgr.configureVariable('x', {
      slopeThreshold: 0.0001,
      windowSize: 3,
      driftTolerance: 0.0001,
      flatlineVariance: 1000,
      oscillationFrequency: 1000,
    });
    // Generate many alerts
    for (let i = 0; i < 600; i++) {
      mgr.ingest('x', i * 100, i * 1000);
    }
    const snap = mgr.getSnapshot();
    expect(snap.allAlerts.length).toBeLessThanOrEqual(500);
  });
});
