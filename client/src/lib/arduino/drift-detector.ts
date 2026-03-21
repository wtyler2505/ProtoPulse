/**
 * DriftDetector — Tracks sensor calibration drift over time (BL-0463).
 *
 * Monitors how sensor readings deviate from a known calibration reference over
 * time. Maintains a rolling window of readings, computes drift rate (units per
 * hour), estimates when recalibration will be needed, and generates calibration
 * reports.
 *
 * Use cases:
 *   - Temperature sensors drifting after thermal cycling
 *   - Analog sensors losing accuracy after extended operation
 *   - Load cells creeping under sustained load
 *   - pH probes degrading over days/weeks
 *
 * Singleton+subscribe pattern for useSyncExternalStore compatibility.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = () => void;

export type DriftDirection = 'positive' | 'negative' | 'stable' | 'erratic';

export type CalibrationHealth = 'good' | 'acceptable' | 'warning' | 'critical';

export interface CalibrationPoint {
  /** Reference (known true) value at calibration time. */
  referenceValue: number;
  /** Sensor's measured value at calibration time. */
  measuredValue: number;
  /** Timestamp when calibration was performed (ms). */
  timestamp: number;
}

export interface DriftReading {
  /** Measured value from sensor. */
  measured: number;
  /** Expected (true) reference value if known, or null. */
  reference: number | null;
  /** Timestamp of reading (ms). */
  timestamp: number;
  /** Computed deviation from calibration baseline. */
  deviation: number;
}

export interface DriftConfig {
  /** Maximum acceptable deviation before warning. Default 1.0. */
  warningThreshold: number;
  /** Maximum acceptable deviation before critical. Default 5.0. */
  criticalThreshold: number;
  /** Rolling window size (number of readings). Default 100. */
  windowSize: number;
  /** Maximum acceptable drift rate (units/hour). Default 0.5. */
  maxDriftRate: number;
  /** Recalibration interval recommendation (hours). Default 168 (1 week). */
  recalibrationInterval: number;
}

export interface DriftStats {
  /** Current deviation from calibration. */
  currentDeviation: number;
  /** Average deviation in the window. */
  averageDeviation: number;
  /** Maximum absolute deviation seen. */
  maxDeviation: number;
  /** Drift rate in units per hour. */
  driftRate: number;
  /** Direction of drift. */
  direction: DriftDirection;
  /** Calibration health assessment. */
  health: CalibrationHealth;
  /** Estimated hours until recalibration is needed (null if stable). */
  hoursUntilRecalibration: number | null;
  /** Number of readings in the window. */
  readingCount: number;
  /** Time since last calibration in hours. */
  hoursSinceCalibration: number | null;
}

export interface CalibrationReport {
  /** Sensor name. */
  sensorName: string;
  /** Current calibration health. */
  health: CalibrationHealth;
  /** Drift statistics. */
  stats: DriftStats;
  /** Last calibration point. */
  lastCalibration: CalibrationPoint | null;
  /** All calibration history. */
  calibrationHistory: CalibrationPoint[];
  /** Recommendations. */
  recommendations: string[];
  /** Report generation timestamp. */
  generatedAt: number;
}

export interface DriftSnapshot {
  /** All tracked sensors and their stats. */
  sensors: Array<{ name: string; stats: DriftStats }>;
  /** Number of sensors being tracked. */
  trackedCount: number;
  /** Sensors needing recalibration. */
  needsRecalibration: string[];
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: DriftConfig = {
  warningThreshold: 1.0,
  criticalThreshold: 5.0,
  windowSize: 100,
  maxDriftRate: 0.5,
  recalibrationInterval: 168,
};

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

function linearRegressionSlope(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) {
    return 0;
  }

  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i];
    sumY += ys[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    num += dx * (ys[i] - meanY);
    den += dx * dx;
  }

  return den === 0 ? 0 : num / den;
}

// ---------------------------------------------------------------------------
// SensorDriftTracker (per-sensor state)
// ---------------------------------------------------------------------------

class SensorDriftTracker {
  readonly name: string;
  private config: DriftConfig;
  private readings: DriftReading[] = [];
  private calibrations: CalibrationPoint[] = [];
  private calibrationOffset = 0; // correction = reference - measured at cal time

  constructor(name: string, config: DriftConfig) {
    this.name = name;
    this.config = { ...config };
  }

  getConfig(): DriftConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<DriftConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * Record a calibration event: sensor read `measured` when the true value was `reference`.
   */
  calibrate(referenceValue: number, measuredValue: number, timestamp?: number): void {
    const ts = timestamp ?? Date.now();
    this.calibrationOffset = referenceValue - measuredValue;
    this.calibrations.push({ referenceValue, measuredValue, timestamp: ts });
    // Clear readings after recalibration — fresh start
    this.readings = [];
  }

  /**
   * Record a sensor reading. `reference` is optional (known true value for comparison).
   */
  addReading(measured: number, reference?: number, timestamp?: number): DriftReading {
    const ts = timestamp ?? Date.now();
    // Deviation = (measured + offset) - expected
    // If we have a reference, deviation is from that; otherwise from calibration-corrected zero
    const corrected = measured + this.calibrationOffset;
    const deviation = reference !== undefined ? measured - reference : corrected - (this.calibrations.length > 0 ? this.calibrations[this.calibrations.length - 1].referenceValue : measured);

    const reading: DriftReading = {
      measured,
      reference: reference ?? null,
      timestamp: ts,
      deviation,
    };

    this.readings.push(reading);

    // Trim to window
    if (this.readings.length > this.config.windowSize) {
      this.readings.splice(0, this.readings.length - this.config.windowSize);
    }

    return reading;
  }

  getReadings(): DriftReading[] {
    return [...this.readings];
  }

  getCalibrationHistory(): CalibrationPoint[] {
    return [...this.calibrations];
  }

  getLastCalibration(): CalibrationPoint | null {
    return this.calibrations.length > 0 ? this.calibrations[this.calibrations.length - 1] : null;
  }

  /**
   * Compute drift statistics from the current reading window.
   */
  computeStats(): DriftStats {
    const deviations = this.readings.map((r) => r.deviation);
    const currentDeviation = deviations.length > 0 ? deviations[deviations.length - 1] : 0;

    const avgDeviation =
      deviations.length > 0
        ? deviations.reduce((sum, d) => sum + d, 0) / deviations.length
        : 0;

    const maxDeviation =
      deviations.length > 0
        ? deviations.reduce((max, d) => Math.max(max, Math.abs(d)), 0)
        : 0;

    // Drift rate via linear regression of deviation over time (units per hour)
    let driftRate = 0;
    if (this.readings.length >= 2) {
      const t0 = this.readings[0].timestamp;
      const xs = this.readings.map((r) => (r.timestamp - t0) / 3600000); // hours
      const ys = deviations;
      driftRate = linearRegressionSlope(xs, ys);
    }

    const direction = this.classifyDirection(deviations, driftRate);
    const health = this.assessHealth(maxDeviation, Math.abs(driftRate));

    // Time until recalibration needed
    let hoursUntilRecalibration: number | null = null;
    if (Math.abs(driftRate) > 0 && health !== 'critical') {
      const remaining = this.config.criticalThreshold - Math.abs(currentDeviation);
      if (remaining > 0 && Math.abs(driftRate) > 0) {
        hoursUntilRecalibration = remaining / Math.abs(driftRate);
      }
    }

    const lastCal = this.getLastCalibration();
    const hoursSinceCalibration = lastCal
      ? (Date.now() - lastCal.timestamp) / 3600000
      : null;

    return {
      currentDeviation,
      averageDeviation: avgDeviation,
      maxDeviation,
      driftRate,
      direction,
      health,
      hoursUntilRecalibration,
      readingCount: this.readings.length,
      hoursSinceCalibration,
    };
  }

  private classifyDirection(deviations: number[], driftRate: number): DriftDirection {
    if (deviations.length < 3) {
      return 'stable';
    }

    // Check for erratic: count sign changes in consecutive differences
    let signChanges = 0;
    for (let i = 2; i < deviations.length; i++) {
      const prev = deviations[i - 1] - deviations[i - 2];
      const curr = deviations[i] - deviations[i - 1];
      if (prev !== 0 && curr !== 0 && Math.sign(prev) !== Math.sign(curr)) {
        signChanges++;
      }
    }

    const changeRatio = signChanges / (deviations.length - 2);
    if (changeRatio > 0.6) {
      return 'erratic';
    }

    if (Math.abs(driftRate) < this.config.maxDriftRate * 0.1) {
      return 'stable';
    }

    return driftRate > 0 ? 'positive' : 'negative';
  }

  private assessHealth(maxDeviation: number, absDriftRate: number): CalibrationHealth {
    if (maxDeviation >= this.config.criticalThreshold) {
      return 'critical';
    }
    if (maxDeviation >= this.config.warningThreshold || absDriftRate > this.config.maxDriftRate) {
      if (maxDeviation >= this.config.warningThreshold * 2 || absDriftRate > this.config.maxDriftRate * 2) {
        return 'warning';
      }
      return 'acceptable';
    }
    return 'good';
  }

  /**
   * Generate a calibration report with recommendations.
   */
  generateReport(): CalibrationReport {
    const stats = this.computeStats();
    const recommendations: string[] = [];

    if (stats.health === 'critical') {
      recommendations.push('Immediate recalibration required — deviation exceeds critical threshold.');
    } else if (stats.health === 'warning') {
      recommendations.push('Recalibration recommended soon — drift rate or deviation is elevated.');
    }

    if (stats.direction === 'erratic') {
      recommendations.push('Erratic readings detected — check sensor connections and shielding.');
    }

    if (stats.hoursUntilRecalibration !== null && stats.hoursUntilRecalibration < 24) {
      recommendations.push(`Estimated ${stats.hoursUntilRecalibration.toFixed(1)} hours until critical drift — schedule recalibration.`);
    }

    if (stats.hoursSinceCalibration !== null && stats.hoursSinceCalibration > this.config.recalibrationInterval) {
      recommendations.push(`${stats.hoursSinceCalibration.toFixed(0)} hours since last calibration — exceeds ${this.config.recalibrationInterval}h recommended interval.`);
    }

    if (Math.abs(stats.driftRate) > this.config.maxDriftRate) {
      recommendations.push(`Drift rate ${stats.driftRate.toFixed(3)} units/hr exceeds limit of ${this.config.maxDriftRate}.`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Sensor calibration is within normal parameters.');
    }

    return {
      sensorName: this.name,
      health: stats.health,
      stats,
      lastCalibration: this.getLastCalibration(),
      calibrationHistory: this.getCalibrationHistory(),
      recommendations,
      generatedAt: Date.now(),
    };
  }
}

// ---------------------------------------------------------------------------
// DriftDetector (singleton + subscribe)
// ---------------------------------------------------------------------------

export class DriftDetector {
  private listeners: Set<Listener> = new Set();
  private trackers: Map<string, SensorDriftTracker> = new Map();
  private defaultConfig: DriftConfig = { ...DEFAULT_CONFIG };

  // ── Subscribe ──────────────────────────────────────────────────────

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  // ── Configuration ──────────────────────────────────────────────────

  setDefaultConfig(config: Partial<DriftConfig>): void {
    Object.assign(this.defaultConfig, config);
  }

  getDefaultConfig(): DriftConfig {
    return { ...this.defaultConfig };
  }

  // ── Sensor management ──────────────────────────────────────────────

  registerSensor(name: string, config?: Partial<DriftConfig>): void {
    if (!this.trackers.has(name)) {
      const merged = { ...this.defaultConfig, ...config };
      this.trackers.set(name, new SensorDriftTracker(name, merged));
      this.notify();
    }
  }

  removeSensor(name: string): boolean {
    const removed = this.trackers.delete(name);
    if (removed) {
      this.notify();
    }
    return removed;
  }

  getSensorNames(): string[] {
    return Array.from(this.trackers.keys());
  }

  hasSensor(name: string): boolean {
    return this.trackers.has(name);
  }

  configureSensor(name: string, config: Partial<DriftConfig>): boolean {
    const tracker = this.trackers.get(name);
    if (!tracker) {
      return false;
    }
    tracker.updateConfig(config);
    this.notify();
    return true;
  }

  // ── Calibration ────────────────────────────────────────────────────

  calibrate(sensorName: string, referenceValue: number, measuredValue: number, timestamp?: number): boolean {
    const tracker = this.trackers.get(sensorName);
    if (!tracker) {
      return false;
    }
    tracker.calibrate(referenceValue, measuredValue, timestamp);
    this.notify();
    return true;
  }

  getCalibrationHistory(sensorName: string): CalibrationPoint[] {
    const tracker = this.trackers.get(sensorName);
    return tracker ? tracker.getCalibrationHistory() : [];
  }

  // ── Data ingestion ─────────────────────────────────────────────────

  /**
   * Add a reading for a sensor. Auto-registers if not already tracked.
   */
  addReading(
    sensorName: string,
    measured: number,
    reference?: number,
    timestamp?: number,
  ): DriftReading {
    if (!this.trackers.has(sensorName)) {
      this.registerSensor(sensorName);
    }
    const tracker = this.trackers.get(sensorName)!;
    const reading = tracker.addReading(measured, reference, timestamp);
    this.notify();
    return reading;
  }

  getReadings(sensorName: string): DriftReading[] {
    const tracker = this.trackers.get(sensorName);
    return tracker ? tracker.getReadings() : [];
  }

  // ── Statistics ─────────────────────────────────────────────────────

  getStats(sensorName: string): DriftStats | null {
    const tracker = this.trackers.get(sensorName);
    return tracker ? tracker.computeStats() : null;
  }

  // ── Reports ────────────────────────────────────────────────────────

  generateReport(sensorName: string): CalibrationReport | null {
    const tracker = this.trackers.get(sensorName);
    return tracker ? tracker.generateReport() : null;
  }

  generateAllReports(): CalibrationReport[] {
    const reports: CalibrationReport[] = [];
    this.trackers.forEach((tracker) => {
      reports.push(tracker.generateReport());
    });
    return reports;
  }

  /**
   * Get list of sensors that need recalibration (warning or critical health).
   */
  getSensorsNeedingRecalibration(): string[] {
    const result: string[] = [];
    this.trackers.forEach((tracker, name) => {
      const stats = tracker.computeStats();
      if (stats.health === 'warning' || stats.health === 'critical') {
        result.push(name);
      }
    });
    return result;
  }

  // ── Snapshot ────────────────────────────────────────────────────────

  getSnapshot(): DriftSnapshot {
    const sensors: Array<{ name: string; stats: DriftStats }> = [];
    this.trackers.forEach((tracker, name) => {
      sensors.push({ name, stats: tracker.computeStats() });
    });

    return {
      sensors,
      trackedCount: this.trackers.size,
      needsRecalibration: this.getSensorsNeedingRecalibration(),
    };
  }

  // ── Reset ──────────────────────────────────────────────────────────

  reset(): void {
    this.trackers.clear();
    this.defaultConfig = { ...DEFAULT_CONFIG };
    this.notify();
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let instance: DriftDetector | null = null;

export function getDriftDetector(): DriftDetector {
  if (!instance) {
    instance = new DriftDetector();
  }
  return instance;
}

/** Reset singleton (for testing). */
export function resetDriftDetector(): void {
  instance = null;
}
