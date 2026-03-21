/**
 * PredictiveAlertManager — Detects trend anomalies in sensor telemetry streams
 * to predict failures before they happen (BL-0458).
 *
 * Anomaly types:
 *   1. Rising trend   — sustained upward slope exceeding threshold
 *   2. Falling trend   — sustained downward slope exceeding threshold
 *   3. Spike           — z-score exceeds threshold (sudden outlier)
 *   4. Drift           — cumulative deviation from baseline exceeds tolerance
 *   5. Oscillation     — alternating direction changes above frequency threshold
 *   6. Flatline        — variance drops below minimum (sensor stuck)
 *
 * Uses linear regression for trend detection, z-score for spike detection,
 * rolling variance for flatline, and direction-change counting for oscillation.
 * Time-to-threshold extrapolation estimates when a value will reach a critical limit.
 *
 * Singleton+subscribe pattern for useSyncExternalStore compatibility.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = () => void;

export type AnomalyType = 'rising' | 'falling' | 'spike' | 'drift' | 'oscillation' | 'flatline';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface AlertThresholds {
  /** Slope magnitude above which a rising/falling trend triggers (units/sec). Default 0.1 */
  slopeThreshold: number;
  /** Z-score above which a spike is detected. Default 3.0 */
  zScoreThreshold: number;
  /** Maximum allowed cumulative drift from baseline. Default 10.0 */
  driftTolerance: number;
  /** Minimum variance below which flatline triggers. Default 0.001 */
  flatlineVariance: number;
  /** Minimum direction changes per window to flag oscillation. Default 6 */
  oscillationFrequency: number;
  /** Critical upper bound for the variable (for time-to-threshold). */
  criticalMax?: number;
  /** Critical lower bound for the variable (for time-to-threshold). */
  criticalMin?: number;
  /** Window size in number of data points. Default 20 */
  windowSize: number;
}

export interface PredictiveAlert {
  /** Unique alert ID. */
  id: string;
  /** Variable name this alert pertains to. */
  variableName: string;
  /** Type of anomaly detected. */
  type: AnomalyType;
  /** Severity of the alert. */
  severity: AlertSeverity;
  /** Human-readable message. */
  message: string;
  /** Timestamp when the alert was generated (ms). */
  timestamp: number;
  /** Current value at alert time. */
  currentValue: number;
  /** Estimated seconds until critical threshold is reached (null if not computable). */
  timeToThreshold: number | null;
  /** Whether the alert has been acknowledged. */
  acknowledged: boolean;
}

export interface VariableConfig {
  /** Display name. */
  name: string;
  /** Per-variable thresholds (merged with defaults). */
  thresholds: Partial<AlertThresholds>;
}

export interface DataPoint {
  value: number;
  timestamp: number;
}

export interface AlertSnapshot {
  /** All active (unacknowledged) alerts, newest first. */
  activeAlerts: PredictiveAlert[];
  /** All alerts (including acknowledged), newest first. */
  allAlerts: PredictiveAlert[];
  /** Number of tracked variables. */
  trackedVariables: number;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_THRESHOLDS: AlertThresholds = {
  slopeThreshold: 0.1,
  zScoreThreshold: 3.0,
  driftTolerance: 10.0,
  flatlineVariance: 0.001,
  oscillationFrequency: 6,
  windowSize: 20,
};

const MAX_ALERTS = 500;

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

/** Compute mean of an array. */
export function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
  }
  return sum / values.length;
}

/** Compute population variance. */
export function variance(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const m = mean(values);
  let sumSq = 0;
  for (let i = 0; i < values.length; i++) {
    const diff = values[i] - m;
    sumSq += diff * diff;
  }
  return sumSq / values.length;
}

/** Compute population standard deviation. */
export function stdDev(values: number[]): number {
  return Math.sqrt(variance(values));
}

/**
 * Simple linear regression: y = slope * x + intercept.
 * x values are indices (0, 1, 2, ...) normalized by time delta if timestamps given.
 * Returns slope in units per second when timestamps are provided.
 */
export function linearRegression(
  points: DataPoint[],
): { slope: number; intercept: number; r2: number } {
  const n = points.length;
  if (n < 2) {
    return { slope: 0, intercept: points.length === 1 ? points[0].value : 0, r2: 0 };
  }

  // Use time in seconds relative to first point as x
  const t0 = points[0].timestamp;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < n; i++) {
    xs.push((points[i].timestamp - t0) / 1000);
    ys.push(points[i].value);
  }

  const xMean = mean(xs);
  const yMean = mean(ys);

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    const xDiff = xs[i] - xMean;
    numerator += xDiff * (ys[i] - yMean);
    denominator += xDiff * xDiff;
  }

  if (denominator === 0) {
    return { slope: 0, intercept: yMean, r2: 0 };
  }

  const slope = numerator / denominator;
  const intercept = yMean - slope * xMean;

  // R-squared
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const predicted = slope * xs[i] + intercept;
    ssRes += (ys[i] - predicted) ** 2;
    ssTot += (ys[i] - yMean) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return { slope, intercept, r2 };
}

/**
 * Count direction changes in a series of values.
 * A direction change occurs when the sign of consecutive differences alternates.
 */
export function countDirectionChanges(values: number[]): number {
  if (values.length < 3) {
    return 0;
  }
  let changes = 0;
  let prevDirection = 0; // 0 = unknown, 1 = up, -1 = down
  for (let i = 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    if (diff === 0) {
      continue;
    }
    const direction = diff > 0 ? 1 : -1;
    if (prevDirection !== 0 && direction !== prevDirection) {
      changes++;
    }
    prevDirection = direction;
  }
  return changes;
}

/**
 * Extrapolate time to reach a threshold given current value and slope.
 * Returns seconds until threshold, or null if slope is zero/wrong direction.
 */
export function timeToThreshold(
  currentValue: number,
  slope: number,
  threshold: number,
): number | null {
  if (slope === 0) {
    return null;
  }
  const delta = threshold - currentValue;
  // Slope must be in the same direction as the delta
  if ((delta > 0 && slope <= 0) || (delta < 0 && slope >= 0)) {
    return null;
  }
  const seconds = delta / slope;
  return seconds > 0 ? seconds : null;
}

// ---------------------------------------------------------------------------
// Alert ID generator
// ---------------------------------------------------------------------------

let alertCounter = 0;

function generateAlertId(): string {
  alertCounter++;
  return `alert-${Date.now()}-${alertCounter}`;
}

// ---------------------------------------------------------------------------
// PredictiveAlertManager (singleton + subscribe)
// ---------------------------------------------------------------------------

export class PredictiveAlertManager {
  private listeners: Set<Listener> = new Set();
  private variableData: Map<string, DataPoint[]> = new Map();
  private variableConfigs: Map<string, AlertThresholds> = new Map();
  private variableBaselines: Map<string, number> = new Map();
  private alerts: PredictiveAlert[] = [];
  private enabled = true;

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

  configureVariable(name: string, config: Partial<AlertThresholds>): void {
    const merged: AlertThresholds = { ...DEFAULT_THRESHOLDS, ...config };
    this.variableConfigs.set(name, merged);
    this.notify();
  }

  setBaseline(name: string, baseline: number): void {
    this.variableBaselines.set(name, baseline);
  }

  getThresholds(name: string): AlertThresholds {
    return this.variableConfigs.get(name) ?? { ...DEFAULT_THRESHOLDS };
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.notify();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // ── Data ingestion ─────────────────────────────────────────────────

  /**
   * Feed a new data point for a named variable.
   * Runs anomaly detection and may generate alerts.
   */
  ingest(variableName: string, value: number, timestamp?: number): PredictiveAlert[] {
    const ts = timestamp ?? Date.now();
    const point: DataPoint = { value, timestamp: ts };

    if (!this.variableData.has(variableName)) {
      this.variableData.set(variableName, []);
    }

    const data = this.variableData.get(variableName)!;
    data.push(point);

    const thresholds = this.getThresholds(variableName);

    // Trim to 2x window to keep enough history for analysis
    const maxLen = thresholds.windowSize * 2;
    if (data.length > maxLen) {
      data.splice(0, data.length - maxLen);
    }

    // Set baseline from first point if not explicitly set
    if (!this.variableBaselines.has(variableName)) {
      this.variableBaselines.set(variableName, value);
    }

    if (!this.enabled) {
      return [];
    }

    // Run detections
    const newAlerts = this.detectAnomalies(variableName, data, thresholds);

    if (newAlerts.length > 0) {
      this.alerts.push(...newAlerts);
      // Trim alert history
      if (this.alerts.length > MAX_ALERTS) {
        this.alerts = this.alerts.slice(this.alerts.length - MAX_ALERTS);
      }
      this.notify();
    }

    return newAlerts;
  }

  // ── Detection engine ───────────────────────────────────────────────

  private detectAnomalies(
    variableName: string,
    data: DataPoint[],
    thresholds: AlertThresholds,
  ): PredictiveAlert[] {
    const alerts: PredictiveAlert[] = [];
    const windowSize = thresholds.windowSize;

    if (data.length < 3) {
      return alerts;
    }

    // Use the most recent window
    const window = data.slice(-windowSize);
    const values = window.map((p) => p.value);
    const currentValue = values[values.length - 1];

    // 1. Trend detection (rising/falling) via linear regression
    if (window.length >= 3) {
      const reg = linearRegression(window);
      if (Math.abs(reg.slope) > thresholds.slopeThreshold && reg.r2 > 0.5) {
        const type: AnomalyType = reg.slope > 0 ? 'rising' : 'falling';
        const severity = this.trendSeverity(reg.slope, thresholds);

        let ttt: number | null = null;
        if (type === 'rising' && thresholds.criticalMax !== undefined) {
          ttt = timeToThreshold(currentValue, reg.slope, thresholds.criticalMax);
        } else if (type === 'falling' && thresholds.criticalMin !== undefined) {
          ttt = timeToThreshold(currentValue, reg.slope, thresholds.criticalMin);
        }

        alerts.push({
          id: generateAlertId(),
          variableName,
          type,
          severity,
          message: `${variableName}: ${type} trend detected (slope=${reg.slope.toFixed(4)}/s, R²=${reg.r2.toFixed(2)})`,
          timestamp: Date.now(),
          currentValue,
          timeToThreshold: ttt,
          acknowledged: false,
        });
      }
    }

    // 2. Spike detection via z-score
    if (data.length >= windowSize) {
      // Use all data except the last point for baseline stats
      const baselineValues = data.slice(-windowSize - 1, -1).map((p) => p.value);
      if (baselineValues.length > 0) {
        const m = mean(baselineValues);
        const sd = stdDev(baselineValues);
        if (sd > 0) {
          const zScore = Math.abs(currentValue - m) / sd;
          if (zScore > thresholds.zScoreThreshold) {
            alerts.push({
              id: generateAlertId(),
              variableName,
              type: 'spike',
              severity: zScore > thresholds.zScoreThreshold * 2 ? 'critical' : 'warning',
              message: `${variableName}: spike detected (z-score=${zScore.toFixed(2)}, value=${currentValue.toFixed(2)})`,
              timestamp: Date.now(),
              currentValue,
              timeToThreshold: null,
              acknowledged: false,
            });
          }
        }
      }
    }

    // 3. Drift detection
    const baseline = this.variableBaselines.get(variableName);
    if (baseline !== undefined) {
      const drift = Math.abs(currentValue - baseline);
      if (drift > thresholds.driftTolerance) {
        alerts.push({
          id: generateAlertId(),
          variableName,
          type: 'drift',
          severity: drift > thresholds.driftTolerance * 2 ? 'critical' : 'warning',
          message: `${variableName}: drift from baseline (deviation=${drift.toFixed(2)}, baseline=${baseline.toFixed(2)})`,
          timestamp: Date.now(),
          currentValue,
          timeToThreshold: null,
          acknowledged: false,
        });
      }
    }

    // 4. Oscillation detection
    if (values.length >= 5) {
      const changes = countDirectionChanges(values);
      if (changes >= thresholds.oscillationFrequency) {
        alerts.push({
          id: generateAlertId(),
          variableName,
          type: 'oscillation',
          severity: changes >= thresholds.oscillationFrequency * 2 ? 'critical' : 'warning',
          message: `${variableName}: oscillation detected (${changes} direction changes in ${values.length} samples)`,
          timestamp: Date.now(),
          currentValue,
          timeToThreshold: null,
          acknowledged: false,
        });
      }
    }

    // 5. Flatline detection
    if (values.length >= 5) {
      const v = variance(values);
      if (v < thresholds.flatlineVariance) {
        alerts.push({
          id: generateAlertId(),
          variableName,
          type: 'flatline',
          severity: 'warning',
          message: `${variableName}: flatline detected (variance=${v.toExponential(2)}, sensor may be stuck)`,
          timestamp: Date.now(),
          currentValue,
          timeToThreshold: null,
          acknowledged: false,
        });
      }
    }

    return alerts;
  }

  private trendSeverity(slope: number, thresholds: AlertThresholds): AlertSeverity {
    const magnitude = Math.abs(slope);
    if (magnitude > thresholds.slopeThreshold * 5) {
      return 'critical';
    }
    if (magnitude > thresholds.slopeThreshold * 2) {
      return 'warning';
    }
    return 'info';
  }

  // ── Alert management ───────────────────────────────────────────────

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert) {
      return false;
    }
    alert.acknowledged = true;
    this.notify();
    return true;
  }

  acknowledgeAll(variableName?: string): number {
    let count = 0;
    for (let i = 0; i < this.alerts.length; i++) {
      const alert = this.alerts[i];
      if (!alert.acknowledged && (!variableName || alert.variableName === variableName)) {
        alert.acknowledged = true;
        count++;
      }
    }
    if (count > 0) {
      this.notify();
    }
    return count;
  }

  clearAlerts(variableName?: string): void {
    if (variableName) {
      this.alerts = this.alerts.filter((a) => a.variableName !== variableName);
    } else {
      this.alerts = [];
    }
    this.notify();
  }

  getAlertsByVariable(variableName: string): PredictiveAlert[] {
    return this.alerts
      .filter((a) => a.variableName === variableName)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  getAlertsByType(type: AnomalyType): PredictiveAlert[] {
    return this.alerts
      .filter((a) => a.type === type)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  getAlertsBySeverity(severity: AlertSeverity): PredictiveAlert[] {
    return this.alerts
      .filter((a) => a.severity === severity)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  // ── Data access ────────────────────────────────────────────────────

  getVariableData(variableName: string): DataPoint[] {
    return this.variableData.get(variableName) ?? [];
  }

  getTrackedVariables(): string[] {
    return Array.from(this.variableData.keys());
  }

  // ── Snapshot (useSyncExternalStore) ────────────────────────────────

  getSnapshot(): AlertSnapshot {
    return {
      activeAlerts: this.alerts
        .filter((a) => !a.acknowledged)
        .sort((a, b) => b.timestamp - a.timestamp),
      allAlerts: [...this.alerts].sort((a, b) => b.timestamp - a.timestamp),
      trackedVariables: this.variableData.size,
    };
  }

  // ── Reset ──────────────────────────────────────────────────────────

  reset(): void {
    this.variableData.clear();
    this.variableConfigs.clear();
    this.variableBaselines.clear();
    this.alerts = [];
    this.enabled = true;
    this.notify();
  }

  removeVariable(variableName: string): void {
    this.variableData.delete(variableName);
    this.variableConfigs.delete(variableName);
    this.variableBaselines.delete(variableName);
    this.alerts = this.alerts.filter((a) => a.variableName !== variableName);
    this.notify();
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let instance: PredictiveAlertManager | null = null;

export function getPredictiveAlertManager(): PredictiveAlertManager {
  if (!instance) {
    instance = new PredictiveAlertManager();
  }
  return instance;
}

/** Reset singleton (for testing). */
export function resetPredictiveAlertManager(): void {
  instance = null;
}
