/**
 * SimTelemetryOverlay — Expected-vs-Observed Simulation Overlay (BL-0433)
 *
 * Compares simulation predictions against actual telemetry data from hardware.
 * Matches signals by label, computes deviation percentages, classifies severity,
 * generates actionable recommendations, and tracks deviation trends over time.
 *
 * Designed to bridge the gap between "what the simulation says" and "what the
 * hardware actually does," helping makers identify model inaccuracies, wiring
 * errors, or component tolerance issues.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single data point with timestamp and value. */
export interface DataPoint {
  /** Time or x-axis value. */
  x: number;
  /** Measured or simulated value. */
  y: number;
}

/** A named signal channel (from simulation or telemetry). */
export interface SignalChannel {
  /** Human-readable label (e.g. "V(out)", "temp", "motor_rpm"). */
  label: string;
  /** Data points in ascending x order. */
  points: DataPoint[];
  /** Unit of measurement (e.g. "V", "A", "°C", "RPM"). */
  unit?: string;
}

/** Severity classification for deviation. */
export type DeviationSeverity = 'nominal' | 'warning' | 'critical';

/** Configurable thresholds for severity classification. */
export interface SeverityThresholds {
  /** Max deviation % for 'nominal' (default 5). */
  nominalMaxPercent: number;
  /** Max deviation % for 'warning' (default 20). */
  warningMaxPercent: number;
  // Above warningMaxPercent → 'critical'
}

/** Result of comparing a single signal pair. */
export interface SignalDeviation {
  /** Signal label that was matched. */
  label: string;
  /** Mean absolute deviation as a percentage of the expected signal range. */
  meanDeviationPercent: number;
  /** Maximum absolute deviation as a percentage of the expected signal range. */
  maxDeviationPercent: number;
  /** RMS error between expected and observed (in signal units). */
  rmsError: number;
  /** Maximum absolute error (in signal units). */
  maxAbsoluteError: number;
  /** Severity classification based on thresholds. */
  severity: DeviationSeverity;
  /** Whether the signal was found in the expected (simulation) data. */
  inExpected: boolean;
  /** Whether the signal was found in the observed (telemetry) data. */
  inObserved: boolean;
  /** Unit of measurement (from expected or observed). */
  unit?: string;
}

/** A single recommendation based on deviation analysis. */
export interface Recommendation {
  /** Signal label this recommendation pertains to. */
  label: string;
  /** Severity of the issue. */
  severity: DeviationSeverity;
  /** Human-readable recommendation text. */
  message: string;
  /** Category of the recommendation. */
  category: RecommendationCategory;
}

/** Categories for recommendations. */
export type RecommendationCategory =
  | 'model_accuracy'
  | 'wiring'
  | 'component_tolerance'
  | 'calibration'
  | 'missing_signal'
  | 'general';

/** Full overlay comparison result. */
export interface OverlayResult {
  /** Per-signal deviation analysis. */
  deviations: SignalDeviation[];
  /** Overall health score (0–100, 100 = perfect match). */
  healthScore: number;
  /** Overall severity (worst across all signals). */
  overallSeverity: DeviationSeverity;
  /** Actionable recommendations sorted by severity. */
  recommendations: Recommendation[];
  /** Timestamp of this comparison. */
  timestamp: string;
  /** Number of matched signal pairs. */
  matchedSignals: number;
  /** Number of unmatched signals (in expected or observed only). */
  unmatchedSignals: number;
}

/** A trend data point tracking deviation over time. */
export interface TrendPoint {
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** Mean deviation % at this point. */
  meanDeviationPercent: number;
  /** Health score at this point. */
  healthScore: number;
}

/** Trend data for a specific signal. */
export interface SignalTrend {
  /** Signal label. */
  label: string;
  /** Historical trend points, oldest first. */
  points: TrendPoint[];
  /** Direction of the trend: improving, degrading, or stable. */
  direction: 'improving' | 'degrading' | 'stable';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_THRESHOLDS: SeverityThresholds = {
  nominalMaxPercent: 5,
  warningMaxPercent: 20,
};

const MAX_TREND_POINTS = 50;

// Minimum signal range to avoid division by zero or inflated percentages
const MIN_SIGNAL_RANGE = 1e-12;

// ---------------------------------------------------------------------------
// Helper functions (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Linearly interpolate array `ys` (at positions `xs`) onto `xTarget`.
 * Assumes `xs` is sorted ascending. Values outside range are clamped.
 */
export function interpolate(xs: number[], ys: number[], xTarget: number[]): number[] {
  const n = xs.length;
  if (n === 0) {
    return xTarget.map(() => 0);
  }
  if (n === 1) {
    return xTarget.map(() => ys[0]);
  }

  const result: number[] = [];
  let j = 0;

  for (const xt of xTarget) {
    if (xt <= xs[0]) {
      result.push(ys[0]);
      continue;
    }
    if (xt >= xs[n - 1]) {
      result.push(ys[n - 1]);
      continue;
    }

    while (j < n - 2 && xs[j + 1] < xt) {
      j++;
    }

    const x0 = xs[j];
    const x1 = xs[j + 1];
    const t = (xt - x0) / (x1 - x0);
    result.push(ys[j] + t * (ys[j + 1] - ys[j]));
  }

  return result;
}

/**
 * Build a common x-axis grid from two sets of x values.
 * Uses the intersection of domains with the finer resolution.
 */
export function buildCommonGrid(xA: number[], xB: number[]): number[] {
  if (xA.length === 0 || xB.length === 0) {
    return [];
  }

  const xMin = Math.max(xA[0], xB[0]);
  const xMax = Math.min(xA[xA.length - 1], xB[xB.length - 1]);

  if (xMin >= xMax) {
    return [xMin];
  }

  const nPoints = Math.max(xA.length, xB.length, 2);
  const step = (xMax - xMin) / (nPoints - 1);
  const grid: number[] = [];
  for (let i = 0; i < nPoints; i++) {
    grid.push(xMin + i * step);
  }
  return grid;
}

/** Classify deviation percentage into a severity level. */
export function classifySeverity(
  deviationPercent: number,
  thresholds: SeverityThresholds = DEFAULT_THRESHOLDS,
): DeviationSeverity {
  if (deviationPercent <= thresholds.nominalMaxPercent) {
    return 'nominal';
  }
  if (deviationPercent <= thresholds.warningMaxPercent) {
    return 'warning';
  }
  return 'critical';
}

/** Compute the range (max - min) of a numeric array. */
function signalRange(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  let min = values[0];
  let max = values[0];
  for (let i = 1; i < values.length; i++) {
    if (values[i] < min) {
      min = values[i];
    }
    if (values[i] > max) {
      max = values[i];
    }
  }
  return max - min;
}

/** Severity ordering for comparison. */
const SEVERITY_ORDER: Record<DeviationSeverity, number> = {
  nominal: 0,
  warning: 1,
  critical: 2,
};

/** Get the worse of two severities. */
function worseSeverity(a: DeviationSeverity, b: DeviationSeverity): DeviationSeverity {
  return SEVERITY_ORDER[a] >= SEVERITY_ORDER[b] ? a : b;
}

// ---------------------------------------------------------------------------
// Core comparison logic
// ---------------------------------------------------------------------------

/**
 * Compare a single expected signal against an observed signal.
 * Both must have at least 1 data point.
 */
export function compareSignalPair(
  expected: SignalChannel,
  observed: SignalChannel,
  thresholds: SeverityThresholds = DEFAULT_THRESHOLDS,
): SignalDeviation {
  const xExp = expected.points.map((p) => p.x);
  const yExp = expected.points.map((p) => p.y);
  const xObs = observed.points.map((p) => p.x);
  const yObs = observed.points.map((p) => p.y);

  // Single-point comparison
  if (xExp.length === 1 && xObs.length === 1) {
    const absErr = Math.abs(yExp[0] - yObs[0]);
    const range = Math.max(Math.abs(yExp[0]), MIN_SIGNAL_RANGE);
    const pct = (absErr / range) * 100;
    const severity = classifySeverity(pct, thresholds);
    return {
      label: expected.label,
      meanDeviationPercent: pct,
      maxDeviationPercent: pct,
      rmsError: absErr,
      maxAbsoluteError: absErr,
      severity,
      inExpected: true,
      inObserved: true,
      unit: expected.unit ?? observed.unit,
    };
  }

  // Build common grid and interpolate both signals
  const commonX = buildCommonGrid(xExp, xObs);
  if (commonX.length === 0) {
    return {
      label: expected.label,
      meanDeviationPercent: 100,
      maxDeviationPercent: 100,
      rmsError: 0,
      maxAbsoluteError: 0,
      severity: 'critical',
      inExpected: true,
      inObserved: true,
      unit: expected.unit ?? observed.unit,
    };
  }

  const yExpInterp = interpolate(xExp, yExp, commonX);
  const yObsInterp = interpolate(xObs, yObs, commonX);

  // Compute errors
  const n = commonX.length;
  let sumAbsErr = 0;
  let sumSqErr = 0;
  let maxAbsErr = 0;

  for (let i = 0; i < n; i++) {
    const err = Math.abs(yExpInterp[i] - yObsInterp[i]);
    sumAbsErr += err;
    sumSqErr += err * err;
    if (err > maxAbsErr) {
      maxAbsErr = err;
    }
  }

  const meanAbsErr = sumAbsErr / n;
  const rmsError = Math.sqrt(sumSqErr / n);

  // Compute deviation percentages relative to expected signal range
  const range = Math.max(signalRange(yExpInterp), MIN_SIGNAL_RANGE);
  const meanDeviationPercent = (meanAbsErr / range) * 100;
  const maxDeviationPercent = (maxAbsErr / range) * 100;

  const severity = classifySeverity(maxDeviationPercent, thresholds);

  return {
    label: expected.label,
    meanDeviationPercent,
    maxDeviationPercent,
    rmsError,
    maxAbsoluteError: maxAbsErr,
    severity,
    inExpected: true,
    inObserved: true,
    unit: expected.unit ?? observed.unit,
  };
}

/**
 * Match expected and observed signals by label (case-insensitive).
 * Returns matched pairs and unmatched signals.
 */
export function matchSignals(
  expected: SignalChannel[],
  observed: SignalChannel[],
): {
  matched: Array<{ expected: SignalChannel; observed: SignalChannel }>;
  unmatchedExpected: SignalChannel[];
  unmatchedObserved: SignalChannel[];
} {
  const observedMap = new Map<string, SignalChannel>();
  for (const sig of observed) {
    observedMap.set(sig.label.toLowerCase(), sig);
  }

  const matched: Array<{ expected: SignalChannel; observed: SignalChannel }> = [];
  const unmatchedExpected: SignalChannel[] = [];
  const matchedObservedKeys = new Set<string>();

  for (const exp of expected) {
    const key = exp.label.toLowerCase();
    const obs = observedMap.get(key);
    if (obs) {
      matched.push({ expected: exp, observed: obs });
      matchedObservedKeys.add(key);
    } else {
      unmatchedExpected.push(exp);
    }
  }

  const unmatchedObserved: SignalChannel[] = [];
  for (const obs of observed) {
    if (!matchedObservedKeys.has(obs.label.toLowerCase())) {
      unmatchedObserved.push(obs);
    }
  }

  return { matched, unmatchedExpected, unmatchedObserved };
}

// ---------------------------------------------------------------------------
// Recommendation generator
// ---------------------------------------------------------------------------

/** Generate recommendations based on deviation analysis. */
export function generateRecommendations(
  deviations: SignalDeviation[],
  unmatchedExpected: string[],
  unmatchedObserved: string[],
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Recommendations for unmatched expected signals (simulation has it, telemetry doesn't)
  for (const label of unmatchedExpected) {
    recommendations.push({
      label,
      severity: 'warning',
      message: `Signal "${label}" exists in simulation but has no matching telemetry channel. Check that the sensor is connected and outputting data with this label.`,
      category: 'missing_signal',
    });
  }

  // Recommendations for unmatched observed signals (telemetry has it, simulation doesn't)
  for (const label of unmatchedObserved) {
    recommendations.push({
      label,
      severity: 'nominal',
      message: `Telemetry channel "${label}" has no matching simulation signal. Consider adding it to your simulation model for complete coverage.`,
      category: 'missing_signal',
    });
  }

  // Recommendations for matched signals with deviations
  for (const dev of deviations) {
    if (!dev.inExpected || !dev.inObserved) {
      continue;
    }

    if (dev.severity === 'critical') {
      recommendations.push({
        label: dev.label,
        severity: 'critical',
        message: `Signal "${dev.label}" shows ${dev.maxDeviationPercent.toFixed(1)}% maximum deviation. This likely indicates a wiring error, wrong component value, or fundamentally incorrect simulation model.`,
        category: dev.maxDeviationPercent > 50 ? 'wiring' : 'model_accuracy',
      });

      if (dev.maxDeviationPercent > 50) {
        recommendations.push({
          label: dev.label,
          severity: 'critical',
          message: `Verify the physical wiring for "${dev.label}" — the >50% deviation suggests a connection issue rather than a tolerance problem.`,
          category: 'wiring',
        });
      }
    } else if (dev.severity === 'warning') {
      if (dev.meanDeviationPercent > 10) {
        recommendations.push({
          label: dev.label,
          severity: 'warning',
          message: `Signal "${dev.label}" has ${dev.meanDeviationPercent.toFixed(1)}% mean deviation. This may be caused by component tolerances (e.g., resistor ±5% vs simulation nominal values). Consider running a Monte Carlo analysis to validate.`,
          category: 'component_tolerance',
        });
      } else {
        recommendations.push({
          label: dev.label,
          severity: 'warning',
          message: `Signal "${dev.label}" shows occasional spikes up to ${dev.maxDeviationPercent.toFixed(1)}% deviation while the mean is ${dev.meanDeviationPercent.toFixed(1)}%. This pattern suggests noise or transient effects not captured in the simulation.`,
          category: 'calibration',
        });
      }
    }
  }

  // Sort by severity (critical first), then alphabetically
  recommendations.sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
    if (sevDiff !== 0) {
      return sevDiff;
    }
    return a.label.localeCompare(b.label);
  });

  return recommendations;
}

// ---------------------------------------------------------------------------
// Health score calculation
// ---------------------------------------------------------------------------

/**
 * Compute overall health score (0–100).
 * 100 = all signals perfectly matched.
 * Penalized by deviation percentage and unmatched signals.
 */
export function computeHealthScore(
  deviations: SignalDeviation[],
  unmatchedCount: number,
  totalSignalCount: number,
): number {
  if (totalSignalCount === 0) {
    return 100;
  }

  const matchedDevs = deviations.filter((d) => d.inExpected && d.inObserved);

  if (matchedDevs.length === 0 && unmatchedCount > 0) {
    return 0;
  }

  if (matchedDevs.length === 0) {
    return 100;
  }

  // Average deviation score (each signal contributes 0–100)
  let totalScore = 0;
  for (const dev of matchedDevs) {
    // Map deviation % to a 0–100 score: 0% → 100, 100%+ → 0
    const signalScore = Math.max(0, 100 - dev.meanDeviationPercent);
    totalScore += signalScore;
  }

  const matchedScore = totalScore / matchedDevs.length;

  // Penalty for unmatched signals: each unmatched signal reduces score proportionally
  const matchRatio = matchedDevs.length / totalSignalCount;
  const finalScore = matchedScore * matchRatio;

  return Math.max(0, Math.min(100, Math.round(finalScore * 100) / 100));
}

// ---------------------------------------------------------------------------
// SimTelemetryOverlayManager
// ---------------------------------------------------------------------------

type Listener = () => void;

export class SimTelemetryOverlayManager {
  private _thresholds: SeverityThresholds;
  private _lastResult: OverlayResult | null = null;
  private _trends = new Map<string, TrendPoint[]>();
  private _listeners = new Set<Listener>();
  private _version = 0;

  constructor(thresholds: SeverityThresholds = DEFAULT_THRESHOLDS) {
    this._thresholds = { ...thresholds };
  }

  /** Current comparison result, or null if never compared. */
  get lastResult(): OverlayResult | null {
    return this._lastResult;
  }

  /** Monotonic version for useSyncExternalStore. */
  get version(): number {
    return this._version;
  }

  /** Update severity thresholds. */
  setThresholds(thresholds: Partial<SeverityThresholds>): void {
    if (thresholds.nominalMaxPercent !== undefined) {
      this._thresholds.nominalMaxPercent = thresholds.nominalMaxPercent;
    }
    if (thresholds.warningMaxPercent !== undefined) {
      this._thresholds.warningMaxPercent = thresholds.warningMaxPercent;
    }
    this._version++;
    this._notify();
  }

  /** Get current thresholds. */
  getThresholds(): SeverityThresholds {
    return { ...this._thresholds };
  }

  /**
   * Compare expected (simulation) signals against observed (telemetry) signals.
   * Updates lastResult, trends, and notifies listeners.
   */
  compare(expected: SignalChannel[], observed: SignalChannel[]): OverlayResult {
    const { matched, unmatchedExpected, unmatchedObserved } = matchSignals(expected, observed);

    // Compute deviations for matched pairs
    const deviations: SignalDeviation[] = [];
    for (const pair of matched) {
      deviations.push(compareSignalPair(pair.expected, pair.observed, this._thresholds));
    }

    // Add entries for unmatched expected signals
    for (const sig of unmatchedExpected) {
      deviations.push({
        label: sig.label,
        meanDeviationPercent: 0,
        maxDeviationPercent: 0,
        rmsError: 0,
        maxAbsoluteError: 0,
        severity: 'warning',
        inExpected: true,
        inObserved: false,
        unit: sig.unit,
      });
    }

    // Add entries for unmatched observed signals
    for (const sig of unmatchedObserved) {
      deviations.push({
        label: sig.label,
        meanDeviationPercent: 0,
        maxDeviationPercent: 0,
        rmsError: 0,
        maxAbsoluteError: 0,
        severity: 'nominal',
        inExpected: false,
        inObserved: true,
        unit: sig.unit,
      });
    }

    // Overall severity
    let overallSeverity: DeviationSeverity = 'nominal';
    for (const dev of deviations) {
      overallSeverity = worseSeverity(overallSeverity, dev.severity);
    }

    // Health score
    const totalSignalCount = new Set([
      ...expected.map((s) => s.label.toLowerCase()),
      ...observed.map((s) => s.label.toLowerCase()),
    ]).size;
    const unmatchedCount = unmatchedExpected.length + unmatchedObserved.length;
    const healthScore = computeHealthScore(deviations, unmatchedCount, totalSignalCount);

    // Recommendations
    const recommendations = generateRecommendations(
      deviations,
      unmatchedExpected.map((s) => s.label),
      unmatchedObserved.map((s) => s.label),
    );

    const timestamp = new Date().toISOString();

    const result: OverlayResult = {
      deviations,
      healthScore,
      overallSeverity,
      recommendations,
      timestamp,
      matchedSignals: matched.length,
      unmatchedSignals: unmatchedCount,
    };

    this._lastResult = result;

    // Update trends for matched signals
    for (const dev of deviations) {
      if (dev.inExpected && dev.inObserved) {
        this._addTrendPoint(dev.label, {
          timestamp,
          meanDeviationPercent: dev.meanDeviationPercent,
          healthScore: Math.max(0, 100 - dev.meanDeviationPercent),
        });
      }
    }

    this._version++;
    this._notify();

    return result;
  }

  /**
   * Get trend data for a specific signal.
   * Returns null if no trend data exists for this label.
   */
  getTrend(label: string): SignalTrend | null {
    const points = this._trends.get(label.toLowerCase());
    if (!points || points.length === 0) {
      return null;
    }

    return {
      label,
      points: [...points],
      direction: this._computeDirection(points),
    };
  }

  /** Get all signal labels that have trend data. */
  getTrendLabels(): string[] {
    return Array.from(this._trends.keys());
  }

  /** Clear all trend history. */
  clearTrends(): void {
    this._trends.clear();
    this._version++;
    this._notify();
  }

  /** Clear everything (result + trends). */
  reset(): void {
    this._lastResult = null;
    this._trends.clear();
    this._version = 0;
    this._notify();
  }

  // ---- Subscribe pattern ----

  subscribe(listener: Listener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  // ---- Internal ----

  private _addTrendPoint(label: string, point: TrendPoint): void {
    const key = label.toLowerCase();
    let points = this._trends.get(key);
    if (!points) {
      points = [];
      this._trends.set(key, points);
    }
    points.push(point);
    while (points.length > MAX_TREND_POINTS) {
      points.shift();
    }
  }

  private _computeDirection(points: TrendPoint[]): 'improving' | 'degrading' | 'stable' {
    if (points.length < 2) {
      return 'stable';
    }

    // Use simple linear regression on the last N points (up to 10)
    const recent = points.slice(-Math.min(points.length, 10));
    const n = recent.length;

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += recent[i].meanDeviationPercent;
      sumXY += i * recent[i].meanDeviationPercent;
      sumX2 += i * i;
    }

    const denom = n * sumX2 - sumX * sumX;
    if (Math.abs(denom) < 1e-12) {
      return 'stable';
    }

    const slope = (n * sumXY - sumX * sumY) / denom;

    // Threshold: slope must be significant relative to the mean value
    const meanDev = sumY / n;
    const relativeSlope = meanDev > 0 ? Math.abs(slope) / meanDev : Math.abs(slope);

    if (relativeSlope < 0.05) {
      return 'stable';
    }

    // Negative slope = deviation decreasing = improving
    return slope < 0 ? 'improving' : 'degrading';
  }

  private _notify(): void {
    const listeners = Array.from(this._listeners);
    for (let i = 0; i < listeners.length; i++) {
      listeners[i]();
    }
  }
}

// Re-export constants for test assertions
export { DEFAULT_THRESHOLDS, MAX_TREND_POINTS };
