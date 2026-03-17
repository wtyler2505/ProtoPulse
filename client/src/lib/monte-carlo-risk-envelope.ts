/**
 * Monte Carlo Risk Envelope Analysis
 *
 * Post-processing layer for Monte Carlo simulation results. Takes raw
 * simulation samples and computes:
 *   - Risk envelope (percentile-based statistical summary)
 *   - Risk classification against design spec limits
 *   - Yield estimation (percentage of samples within spec)
 *   - Human-readable risk summary text
 *   - Sensitivity ranking via Pearson correlation analysis
 *
 * Pure function library — no React dependencies, no side effects.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single Monte Carlo sample with its parameter values and computed result. */
export interface MonteCarloSample {
  /** Map of parameter name to the randomized value used for this sample. */
  parameterValues: Record<string, number>;
  /** The output metric computed for this sample. */
  result: number;
}

/** Percentile-based statistical envelope of Monte Carlo results. */
export interface RiskEnvelope {
  /** 5th percentile (lower tail). */
  p5: number;
  /** 25th percentile (first quartile). */
  p25: number;
  /** 50th percentile (median). */
  median: number;
  /** 75th percentile (third quartile). */
  p75: number;
  /** 95th percentile (upper tail). */
  p95: number;
  /** Arithmetic mean. */
  mean: number;
  /** Population standard deviation. */
  stdDev: number;
}

/** Qualitative risk classification. */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/** Design specification limits. */
export interface SpecLimits {
  /** Minimum acceptable value (inclusive). */
  min: number;
  /** Maximum acceptable value (inclusive). */
  max: number;
}

/** Parameter sensitivity result. */
export interface ParameterSensitivity {
  /** Parameter name. */
  param: string;
  /** Pearson correlation coefficient between parameter values and results (-1 to 1). */
  correlation: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Compute a percentile from a **pre-sorted** array using linear interpolation.
 * Returns 0 for empty arrays.
 *
 * @param sorted - Values sorted ascending
 * @param p - Percentile in [0, 100]
 */
function percentile(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 0) {
    return 0;
  }
  if (n === 1) {
    return sorted[0];
  }

  // Linear interpolation method (same as NumPy default / Excel PERCENTILE.INC)
  const rank = (p / 100) * (n - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) {
    return sorted[lower];
  }
  const fraction = rank - lower;
  return sorted[lower] + fraction * (sorted[upper] - sorted[lower]);
}

/**
 * Compute the arithmetic mean of an array. Returns 0 for empty arrays.
 */
function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  let sum = 0;
  for (const v of values) {
    sum += v;
  }
  return sum / values.length;
}

/**
 * Compute population standard deviation. Returns 0 for empty or single-element arrays.
 */
function stdDev(values: number[], mu: number): number {
  if (values.length <= 1) {
    return 0;
  }
  let sumSqDiff = 0;
  for (const v of values) {
    const diff = v - mu;
    sumSqDiff += diff * diff;
  }
  return Math.sqrt(sumSqDiff / values.length);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculate the risk envelope (percentile summary) from Monte Carlo samples.
 *
 * @param samples - Array of Monte Carlo samples with parameter values and results
 * @returns Percentile-based risk envelope
 * @throws {Error} If samples array is empty
 */
export function calculateRiskEnvelope(samples: MonteCarloSample[]): RiskEnvelope {
  if (samples.length === 0) {
    throw new Error('Cannot calculate risk envelope from empty samples array');
  }

  const results = samples.map((s) => s.result);
  const sorted = [...results].sort((a, b) => a - b);
  const mu = mean(results);

  return {
    p5: percentile(sorted, 5),
    p25: percentile(sorted, 25),
    median: percentile(sorted, 50),
    p75: percentile(sorted, 75),
    p95: percentile(sorted, 95),
    mean: mu,
    stdDev: stdDev(results, mu),
  };
}

/**
 * Classify risk level based on how the risk envelope relates to spec limits.
 *
 * Classification logic:
 *   - `low`:      p5 and p95 both within spec (90% confidence band inside spec)
 *   - `medium`:   median within spec but tails exceed (p5 < min or p95 > max)
 *   - `high`:     median outside spec but some overlap exists
 *   - `critical`: entire 90% band (p5–p95) outside spec
 *
 * @param envelope - Pre-computed risk envelope
 * @param spec - Design specification limits {min, max}
 * @returns Qualitative risk level
 */
export function classifyRisk(envelope: RiskEnvelope, spec: SpecLimits): RiskLevel {
  const { p5, p95, median } = envelope;

  // Entire 90% band within spec — low risk
  if (p5 >= spec.min && p95 <= spec.max) {
    return 'low';
  }

  // Median within spec but tails exceed — medium risk
  if (median >= spec.min && median <= spec.max) {
    return 'medium';
  }

  // Median outside spec — check if any overlap remains
  // If the 90% band has zero overlap with spec, it's critical
  const bandOverlapsSpec = p95 >= spec.min && p5 <= spec.max;
  if (!bandOverlapsSpec) {
    return 'critical';
  }

  // Median outside spec but some overlap — high risk
  return 'high';
}

/**
 * Estimate manufacturing yield: the percentage of samples within spec limits.
 *
 * @param samples - Monte Carlo samples
 * @param spec - Design specification limits {min, max}
 * @returns Yield percentage (0–100), or 0 if no samples
 */
export function getYieldEstimate(samples: MonteCarloSample[], spec: SpecLimits): number {
  if (samples.length === 0) {
    return 0;
  }

  let passCount = 0;
  for (const sample of samples) {
    if (sample.result >= spec.min && sample.result <= spec.max) {
      passCount++;
    }
  }

  return (passCount / samples.length) * 100;
}

/**
 * Format a human-readable risk summary combining envelope stats, risk level, and yield.
 *
 * @param envelope - Pre-computed risk envelope
 * @param spec - Design specification limits {min, max}
 * @returns Multi-line summary string
 */
export function formatRiskSummary(envelope: RiskEnvelope, spec: SpecLimits): string {
  const risk = classifyRisk(envelope, spec);
  const specRange = `[${formatNumber(spec.min)}, ${formatNumber(spec.max)}]`;

  const riskLabels: Record<RiskLevel, string> = {
    low: 'LOW — design is robust',
    medium: 'MEDIUM — tails exceed spec limits',
    high: 'HIGH — median outside spec',
    critical: 'CRITICAL — entire distribution outside spec',
  };

  const lines = [
    `Risk Level: ${riskLabels[risk]}`,
    `Spec Range: ${specRange}`,
    `Mean: ${formatNumber(envelope.mean)} | Median: ${formatNumber(envelope.median)} | StdDev: ${formatNumber(envelope.stdDev)}`,
    `90% Band: [${formatNumber(envelope.p5)}, ${formatNumber(envelope.p95)}]`,
    `IQR: [${formatNumber(envelope.p25)}, ${formatNumber(envelope.p75)}]`,
  ];

  return lines.join('\n');
}

/**
 * Identify the most sensitive parameters by computing the Pearson correlation
 * coefficient between each parameter's values and the output result.
 *
 * Results are sorted by |correlation| descending (most impactful first).
 * Parameters with zero variance (constant across all samples) receive
 * correlation = 0.
 *
 * @param samples - Monte Carlo samples (must have at least 2 samples for meaningful correlation)
 * @returns Array of {param, correlation} sorted by |correlation| descending
 */
export function identifySensitiveParameters(samples: MonteCarloSample[]): ParameterSensitivity[] {
  if (samples.length < 2) {
    // Not enough data for correlation
    const params = samples.length > 0 ? Object.keys(samples[0].parameterValues) : [];
    return params.map((param) => ({ param, correlation: 0 }));
  }

  // Collect all parameter names from the first sample
  const paramNames = Object.keys(samples[0].parameterValues);
  if (paramNames.length === 0) {
    return [];
  }

  // Pre-compute result statistics
  const results = samples.map((s) => s.result);
  const resultMean = mean(results);
  let resultSumSqDiff = 0;
  for (const r of results) {
    const diff = r - resultMean;
    resultSumSqDiff += diff * diff;
  }
  const resultStdDev = Math.sqrt(resultSumSqDiff / samples.length);

  const sensitivities: ParameterSensitivity[] = [];

  for (const param of paramNames) {
    const paramValues = samples.map((s) => s.parameterValues[param]);
    const paramMean = mean(paramValues);

    let paramSumSqDiff = 0;
    for (const v of paramValues) {
      const diff = v - paramMean;
      paramSumSqDiff += diff * diff;
    }
    const paramStdDev = Math.sqrt(paramSumSqDiff / samples.length);

    // If either has zero variance, correlation is undefined — treat as 0
    if (paramStdDev === 0 || resultStdDev === 0) {
      sensitivities.push({ param, correlation: 0 });
      continue;
    }

    // Pearson correlation: sum((xi - mx)(yi - my)) / (n * sx * sy)
    let sumProduct = 0;
    for (let i = 0; i < samples.length; i++) {
      sumProduct += (paramValues[i] - paramMean) * (results[i] - resultMean);
    }
    const correlation = sumProduct / (samples.length * paramStdDev * resultStdDev);

    // Clamp to [-1, 1] to handle floating-point rounding
    sensitivities.push({
      param,
      correlation: Math.max(-1, Math.min(1, correlation)),
    });
  }

  // Sort by absolute correlation descending
  sensitivities.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

  return sensitivities;
}

// ---------------------------------------------------------------------------
// Formatting helper
// ---------------------------------------------------------------------------

/**
 * Format a number for display: use fixed notation for small numbers,
 * exponential for very large/small ones.
 */
function formatNumber(value: number): string {
  if (value === 0) {
    return '0';
  }
  const abs = Math.abs(value);
  if (abs >= 0.01 && abs < 1e6) {
    // Remove trailing zeros after decimal point
    return parseFloat(value.toFixed(4)).toString();
  }
  return value.toExponential(3);
}
