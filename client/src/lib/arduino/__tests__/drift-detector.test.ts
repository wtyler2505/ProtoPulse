import { describe, it, expect, beforeEach } from 'vitest';
import {
  DriftDetector,
  getDriftDetector,
  resetDriftDetector,
} from '../drift-detector';
import type {
  DriftReading,
  DriftStats,
  CalibrationReport,
  DriftSnapshot,
  CalibrationHealth,
  DriftDirection,
} from '../drift-detector';

// ──────────────────────────────────────────────────────────────────
// DriftDetector — Singleton
// ──────────────────────────────────────────────────────────────────

describe('DriftDetector singleton', () => {
  beforeEach(() => {
    resetDriftDetector();
  });

  it('returns same instance', () => {
    const a = getDriftDetector();
    const b = getDriftDetector();
    expect(a).toBe(b);
  });

  it('reset creates new instance', () => {
    const a = getDriftDetector();
    resetDriftDetector();
    const b = getDriftDetector();
    expect(a).not.toBe(b);
  });
});

// ──────────────────────────────────────────────────────────────────
// DriftDetector — Sensor management
// ──────────────────────────────────────────────────────────────────

describe('DriftDetector sensor management', () => {
  let dd: DriftDetector;

  beforeEach(() => {
    dd = new DriftDetector();
  });

  it('registers sensor', () => {
    dd.registerSensor('temp');
    expect(dd.hasSensor('temp')).toBe(true);
    expect(dd.getSensorNames()).toContain('temp');
  });

  it('registerSensor is idempotent', () => {
    dd.registerSensor('temp');
    dd.registerSensor('temp');
    expect(dd.getSensorNames().filter((n) => n === 'temp').length).toBe(1);
  });

  it('removes sensor', () => {
    dd.registerSensor('temp');
    expect(dd.removeSensor('temp')).toBe(true);
    expect(dd.hasSensor('temp')).toBe(false);
  });

  it('removeSensor returns false for unknown', () => {
    expect(dd.removeSensor('nope')).toBe(false);
  });

  it('registers with custom config', () => {
    dd.registerSensor('temp', { warningThreshold: 2.5 });
    expect(dd.hasSensor('temp')).toBe(true);
  });

  it('configureSensor updates config', () => {
    dd.registerSensor('temp');
    expect(dd.configureSensor('temp', { warningThreshold: 0.5 })).toBe(true);
  });

  it('configureSensor returns false for unknown', () => {
    expect(dd.configureSensor('nope', {})).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────
// DriftDetector — Default config
// ──────────────────────────────────────────────────────────────────

describe('DriftDetector default config', () => {
  let dd: DriftDetector;

  beforeEach(() => {
    dd = new DriftDetector();
  });

  it('has default thresholds', () => {
    const cfg = dd.getDefaultConfig();
    expect(cfg.warningThreshold).toBe(1.0);
    expect(cfg.criticalThreshold).toBe(5.0);
    expect(cfg.windowSize).toBe(100);
    expect(cfg.maxDriftRate).toBe(0.5);
    expect(cfg.recalibrationInterval).toBe(168);
  });

  it('setDefaultConfig updates defaults', () => {
    dd.setDefaultConfig({ warningThreshold: 2.0 });
    expect(dd.getDefaultConfig().warningThreshold).toBe(2.0);
    expect(dd.getDefaultConfig().criticalThreshold).toBe(5.0); // unchanged
  });
});

// ──────────────────────────────────────────────────────────────────
// DriftDetector — Subscribe
// ──────────────────────────────────────────────────────────────────

describe('DriftDetector subscribe', () => {
  let dd: DriftDetector;

  beforeEach(() => {
    dd = new DriftDetector();
  });

  it('notifies on sensor register', () => {
    let called = 0;
    dd.subscribe(() => called++);
    dd.registerSensor('temp');
    expect(called).toBe(1);
  });

  it('notifies on addReading', () => {
    let called = 0;
    dd.registerSensor('temp');
    dd.subscribe(() => called++);
    dd.addReading('temp', 22.5);
    expect(called).toBe(1);
  });

  it('unsubscribe stops notifications', () => {
    let called = 0;
    const unsub = dd.subscribe(() => called++);
    unsub();
    dd.registerSensor('temp');
    expect(called).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// DriftDetector — Calibration
// ──────────────────────────────────────────────────────────────────

describe('DriftDetector calibration', () => {
  let dd: DriftDetector;

  beforeEach(() => {
    dd = new DriftDetector();
    dd.registerSensor('temp');
  });

  it('records calibration point', () => {
    dd.calibrate('temp', 25.0, 24.8, 1000);
    const history = dd.getCalibrationHistory('temp');
    expect(history.length).toBe(1);
    expect(history[0].referenceValue).toBe(25.0);
    expect(history[0].measuredValue).toBe(24.8);
  });

  it('returns false for unknown sensor', () => {
    expect(dd.calibrate('nope', 25, 25)).toBe(false);
  });

  it('getCalibrationHistory returns empty for unknown', () => {
    expect(dd.getCalibrationHistory('nope').length).toBe(0);
  });

  it('multiple calibrations are tracked', () => {
    dd.calibrate('temp', 25, 24.8, 1000);
    dd.calibrate('temp', 25, 25.1, 5000);
    expect(dd.getCalibrationHistory('temp').length).toBe(2);
  });

  it('calibration clears readings window', () => {
    dd.addReading('temp', 22, undefined, 100);
    dd.addReading('temp', 23, undefined, 200);
    dd.calibrate('temp', 25, 24.8, 300);
    expect(dd.getReadings('temp').length).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// DriftDetector — Reading ingestion
// ──────────────────────────────────────────────────────────────────

describe('DriftDetector reading ingestion', () => {
  let dd: DriftDetector;

  beforeEach(() => {
    dd = new DriftDetector();
    dd.registerSensor('temp');
    dd.calibrate('temp', 25.0, 25.0, 0);
  });

  it('adds reading with reference', () => {
    const reading = dd.addReading('temp', 25.2, 25.0, 1000);
    expect(reading.measured).toBe(25.2);
    expect(reading.reference).toBe(25.0);
    expect(reading.deviation).toBeCloseTo(0.2, 10);
  });

  it('adds reading without reference (uses calibration baseline)', () => {
    const reading = dd.addReading('temp', 25.5, undefined, 1000);
    expect(reading.reference).toBeNull();
    expect(reading.deviation).toBeCloseTo(0.5, 10);
  });

  it('auto-registers unknown sensor on addReading', () => {
    const reading = dd.addReading('newSensor', 10, undefined, 1000);
    expect(dd.hasSensor('newSensor')).toBe(true);
    expect(typeof reading.deviation).toBe('number');
  });

  it('getReadings returns readings', () => {
    dd.addReading('temp', 25.1, 25.0, 1000);
    dd.addReading('temp', 25.2, 25.0, 2000);
    const readings = dd.getReadings('temp');
    expect(readings.length).toBe(2);
  });

  it('getReadings returns empty for unknown', () => {
    expect(dd.getReadings('nope').length).toBe(0);
  });

  it('trims readings to window size', () => {
    dd.configureSensor('temp', { windowSize: 5 });
    for (let i = 0; i < 10; i++) {
      dd.addReading('temp', 25 + i * 0.1, 25.0, i * 1000);
    }
    expect(dd.getReadings('temp').length).toBeLessThanOrEqual(5);
  });
});

// ──────────────────────────────────────────────────────────────────
// DriftDetector — Statistics
// ──────────────────────────────────────────────────────────────────

describe('DriftDetector statistics', () => {
  let dd: DriftDetector;

  beforeEach(() => {
    dd = new DriftDetector();
    dd.registerSensor('temp', { warningThreshold: 1.0, criticalThreshold: 5.0 });
    dd.calibrate('temp', 25.0, 25.0, 0);
  });

  it('returns null for unknown sensor', () => {
    expect(dd.getStats('nope')).toBeNull();
  });

  it('returns zero deviation with no readings', () => {
    const stats = dd.getStats('temp');
    expect(stats).not.toBeNull();
    expect(stats!.currentDeviation).toBe(0);
    expect(stats!.readingCount).toBe(0);
  });

  it('computes current deviation', () => {
    dd.addReading('temp', 25.5, 25.0, 1000);
    const stats = dd.getStats('temp')!;
    expect(stats.currentDeviation).toBeCloseTo(0.5, 10);
  });

  it('computes average deviation', () => {
    dd.addReading('temp', 25.2, 25.0, 1000);
    dd.addReading('temp', 25.4, 25.0, 2000);
    dd.addReading('temp', 25.6, 25.0, 3000);
    const stats = dd.getStats('temp')!;
    expect(stats.averageDeviation).toBeCloseTo(0.4, 10);
  });

  it('computes max deviation', () => {
    dd.addReading('temp', 25.1, 25.0, 1000);
    dd.addReading('temp', 26.0, 25.0, 2000);
    dd.addReading('temp', 25.3, 25.0, 3000);
    const stats = dd.getStats('temp')!;
    expect(stats.maxDeviation).toBeCloseTo(1.0, 10);
  });

  it('computes drift rate (units per hour)', () => {
    // Add readings with increasing deviation over 1 hour
    for (let i = 0; i < 10; i++) {
      dd.addReading('temp', 25 + i * 0.1, 25.0, i * 360000); // 360s apart = 3600s total
    }
    const stats = dd.getStats('temp')!;
    // Drift rate should be approximately 0.1/360s * 3600 = 1.0 units/hr
    expect(Math.abs(stats.driftRate)).toBeGreaterThan(0);
  });

  it('health is good for small deviation', () => {
    dd.addReading('temp', 25.05, 25.0, 1000);
    const stats = dd.getStats('temp')!;
    expect(stats.health).toBe('good');
  });

  it('health is acceptable for moderate deviation', () => {
    // warningThreshold = 1.0
    dd.addReading('temp', 26.2, 25.0, 1000);
    const stats = dd.getStats('temp')!;
    expect(stats.health).toBe('acceptable');
  });

  it('health is critical for large deviation', () => {
    dd.addReading('temp', 30.5, 25.0, 1000);
    const stats = dd.getStats('temp')!;
    expect(stats.health).toBe('critical');
  });

  it('direction is stable for constant readings', () => {
    for (let i = 0; i < 10; i++) {
      dd.addReading('temp', 25.0, 25.0, i * 1000);
    }
    const stats = dd.getStats('temp')!;
    expect(stats.direction).toBe('stable');
  });

  it('direction is positive for increasing deviation', () => {
    for (let i = 0; i < 20; i++) {
      dd.addReading('temp', 25 + i * 0.5, 25.0, i * 1000);
    }
    const stats = dd.getStats('temp')!;
    expect(stats.direction).toBe('positive');
  });

  it('direction is negative for decreasing deviation', () => {
    for (let i = 0; i < 20; i++) {
      dd.addReading('temp', 25 - i * 0.5, 25.0, i * 1000);
    }
    const stats = dd.getStats('temp')!;
    expect(stats.direction).toBe('negative');
  });

  it('direction is erratic for oscillating deviation', () => {
    for (let i = 0; i < 20; i++) {
      const dev = i % 2 === 0 ? 2 : -2;
      dd.addReading('temp', 25 + dev, 25.0, i * 1000);
    }
    const stats = dd.getStats('temp')!;
    expect(stats.direction).toBe('erratic');
  });
});

// ──────────────────────────────────────────────────────────────────
// DriftDetector — Hours until recalibration
// ──────────────────────────────────────────────────────────────────

describe('DriftDetector recalibration estimation', () => {
  let dd: DriftDetector;

  beforeEach(() => {
    dd = new DriftDetector();
    dd.registerSensor('temp', { warningThreshold: 1.0, criticalThreshold: 5.0, windowSize: 50 });
    dd.calibrate('temp', 25.0, 25.0, 0);
  });

  it('estimates hours until recalibration for drifting sensor', () => {
    // 1 hour of data, drifting 0.5 per hour
    for (let i = 0; i < 20; i++) {
      dd.addReading('temp', 25 + i * 0.025, 25.0, i * 180000); // 3 min apart, 1hr total
    }
    const stats = dd.getStats('temp')!;
    if (stats.hoursUntilRecalibration !== null) {
      expect(stats.hoursUntilRecalibration).toBeGreaterThan(0);
    }
  });

  it('returns null hoursUntilRecalibration for stable sensor', () => {
    for (let i = 0; i < 10; i++) {
      dd.addReading('temp', 25.0, 25.0, i * 1000);
    }
    const stats = dd.getStats('temp')!;
    // Stable sensor — either null or very large
    if (stats.hoursUntilRecalibration !== null) {
      expect(stats.hoursUntilRecalibration).toBeGreaterThan(100);
    }
  });
});

// ──────────────────────────────────────────────────────────────────
// DriftDetector — Reports
// ──────────────────────────────────────────────────────────────────

describe('DriftDetector reports', () => {
  let dd: DriftDetector;

  beforeEach(() => {
    dd = new DriftDetector();
    dd.registerSensor('temp', { warningThreshold: 1.0, criticalThreshold: 5.0 });
    dd.calibrate('temp', 25.0, 25.0, 0);
  });

  it('returns null report for unknown sensor', () => {
    expect(dd.generateReport('nope')).toBeNull();
  });

  it('generates report for healthy sensor', () => {
    dd.addReading('temp', 25.05, 25.0, 1000);
    const report = dd.generateReport('temp')!;
    expect(report.sensorName).toBe('temp');
    expect(report.health).toBe('good');
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(report.recommendations[0]).toContain('normal');
    expect(report.lastCalibration).not.toBeNull();
    expect(report.generatedAt).toBeGreaterThan(0);
  });

  it('generates report with warning recommendations for drifting sensor', () => {
    dd.addReading('temp', 27, 25.0, 1000);
    const report = dd.generateReport('temp')!;
    expect(report.health).not.toBe('good');
    expect(report.recommendations.some((r) => r.toLowerCase().includes('recalibration'))).toBe(true);
  });

  it('generates report with critical recommendation', () => {
    dd.addReading('temp', 35, 25.0, 1000);
    const report = dd.generateReport('temp')!;
    expect(report.health).toBe('critical');
    expect(report.recommendations.some((r) => r.toLowerCase().includes('immediate'))).toBe(true);
  });

  it('includes erratic recommendation', () => {
    for (let i = 0; i < 20; i++) {
      const dev = i % 2 === 0 ? 2 : -2;
      dd.addReading('temp', 25 + dev, 25.0, i * 1000);
    }
    const report = dd.generateReport('temp')!;
    expect(report.recommendations.some((r) => r.toLowerCase().includes('erratic'))).toBe(true);
  });

  it('includes overdue interval recommendation', () => {
    // Calibrated 200 hours ago
    const oldTs = Date.now() - 200 * 3600000;
    dd.calibrate('temp', 25, 25, oldTs);
    dd.addReading('temp', 25.05, 25.0, Date.now());
    const report = dd.generateReport('temp')!;
    expect(report.recommendations.some((r) => r.includes('hours since last calibration'))).toBe(true);
  });

  it('generateAllReports returns reports for all sensors', () => {
    dd.registerSensor('pressure');
    dd.calibrate('pressure', 1013, 1013, 0);
    dd.addReading('temp', 25.1, 25.0, 1000);
    dd.addReading('pressure', 1013.5, 1013.0, 1000);
    const reports = dd.generateAllReports();
    expect(reports.length).toBe(2);
    expect(reports.map((r) => r.sensorName).sort()).toEqual(['pressure', 'temp']);
  });
});

// ──────────────────────────────────────────────────────────────────
// DriftDetector — Sensors needing recalibration
// ──────────────────────────────────────────────────────────────────

describe('DriftDetector sensors needing recalibration', () => {
  let dd: DriftDetector;

  beforeEach(() => {
    dd = new DriftDetector();
  });

  it('returns empty when all sensors are healthy', () => {
    dd.registerSensor('temp', { warningThreshold: 10 });
    dd.calibrate('temp', 25, 25, 0);
    dd.addReading('temp', 25.01, 25.0, 1000);
    expect(dd.getSensorsNeedingRecalibration().length).toBe(0);
  });

  it('returns sensors with warning/critical health', () => {
    dd.registerSensor('temp', { warningThreshold: 1.0, criticalThreshold: 5.0 });
    dd.calibrate('temp', 25, 25, 0);
    dd.addReading('temp', 28, 25.0, 1000); // deviation = 3, > warning * 2 = 2
    const needing = dd.getSensorsNeedingRecalibration();
    expect(needing).toContain('temp');
  });
});

// ──────────────────────────────────────────────────────────────────
// DriftDetector — Snapshot
// ──────────────────────────────────────────────────────────────────

describe('DriftDetector snapshot', () => {
  it('returns correct structure with no sensors', () => {
    const dd = new DriftDetector();
    const snap: DriftSnapshot = dd.getSnapshot();
    expect(snap.sensors).toEqual([]);
    expect(snap.trackedCount).toBe(0);
    expect(snap.needsRecalibration).toEqual([]);
  });

  it('reflects tracked sensors', () => {
    const dd = new DriftDetector();
    dd.registerSensor('temp');
    dd.registerSensor('pressure');
    const snap = dd.getSnapshot();
    expect(snap.trackedCount).toBe(2);
    expect(snap.sensors.length).toBe(2);
  });

  it('includes stats per sensor', () => {
    const dd = new DriftDetector();
    dd.registerSensor('temp');
    dd.calibrate('temp', 25, 25, 0);
    dd.addReading('temp', 25.1, 25.0, 1000);
    const snap = dd.getSnapshot();
    const tempSensor = snap.sensors.find((s) => s.name === 'temp');
    expect(tempSensor).toBeDefined();
    expect(typeof tempSensor!.stats.currentDeviation).toBe('number');
    expect(typeof tempSensor!.stats.health).toBe('string');
  });
});

// ──────────────────────────────────────────────────────────────────
// DriftDetector — Reset
// ──────────────────────────────────────────────────────────────────

describe('DriftDetector reset', () => {
  it('clears all state', () => {
    const dd = new DriftDetector();
    dd.registerSensor('temp');
    dd.registerSensor('pressure');
    dd.setDefaultConfig({ warningThreshold: 99 });
    dd.reset();
    expect(dd.getSensorNames().length).toBe(0);
    expect(dd.getDefaultConfig().warningThreshold).toBe(1.0); // back to default
  });
});

// ──────────────────────────────────────────────────────────────────
// DriftDetector — Edge cases
// ──────────────────────────────────────────────────────────────────

describe('DriftDetector edge cases', () => {
  it('stats with single reading', () => {
    const dd = new DriftDetector();
    dd.registerSensor('x');
    dd.calibrate('x', 10, 10, 0);
    dd.addReading('x', 10.5, 10, 1000);
    const stats = dd.getStats('x')!;
    expect(stats.readingCount).toBe(1);
    expect(stats.currentDeviation).toBeCloseTo(0.5, 10);
    expect(stats.driftRate).toBe(0); // need 2+ readings for regression
  });

  it('multiple calibrations update offset', () => {
    const dd = new DriftDetector();
    dd.registerSensor('x');
    dd.calibrate('x', 10, 9, 0); // offset = 1
    dd.addReading('x', 9.5, undefined, 1000);
    const stats1 = dd.getStats('x')!;
    // corrected = 9.5 + 1 = 10.5, deviation from ref=10 => 0.5
    expect(stats1.currentDeviation).toBeCloseTo(0.5, 10);

    dd.calibrate('x', 10, 10.5, 2000); // new offset = -0.5
    dd.addReading('x', 10.5, undefined, 3000);
    const stats2 = dd.getStats('x')!;
    // corrected = 10.5 + (-0.5) = 10.0, deviation from ref=10 => 0.0
    expect(stats2.currentDeviation).toBeCloseTo(0, 10);
  });

  it('auto-registered sensor has default config', () => {
    const dd = new DriftDetector();
    dd.addReading('auto', 42);
    expect(dd.hasSensor('auto')).toBe(true);
  });

  it('report includes calibration history', () => {
    const dd = new DriftDetector();
    dd.registerSensor('x');
    dd.calibrate('x', 10, 10, 0);
    dd.calibrate('x', 10, 10.1, 5000);
    dd.addReading('x', 10.05, 10, 6000);
    const report = dd.generateReport('x')!;
    expect(report.calibrationHistory.length).toBe(2);
  });

  it('drift rate recommendation when rate exceeds max', () => {
    const dd = new DriftDetector();
    dd.registerSensor('x', { maxDriftRate: 0.01, warningThreshold: 10, criticalThreshold: 50, windowSize: 20 });
    dd.calibrate('x', 10, 10, 0);
    // Large drift rate: 1 unit over 1 hour = 1.0 units/hr >> 0.01
    for (let i = 0; i < 10; i++) {
      dd.addReading('x', 10 + i * 0.1, 10, i * 360000);
    }
    const report = dd.generateReport('x')!;
    expect(report.recommendations.some((r) => r.includes('Drift rate'))).toBe(true);
  });

  it('hours since calibration is computed', () => {
    const dd = new DriftDetector();
    dd.registerSensor('x');
    const twoHoursAgo = Date.now() - 2 * 3600000;
    dd.calibrate('x', 10, 10, twoHoursAgo);
    dd.addReading('x', 10.1, 10, Date.now());
    const stats = dd.getStats('x')!;
    expect(stats.hoursSinceCalibration).not.toBeNull();
    expect(stats.hoursSinceCalibration!).toBeCloseTo(2, 0);
  });

  it('hoursSinceCalibration is null with no calibration', () => {
    const dd = new DriftDetector();
    dd.registerSensor('x');
    dd.addReading('x', 10);
    const stats = dd.getStats('x')!;
    expect(stats.hoursSinceCalibration).toBeNull();
  });
});
