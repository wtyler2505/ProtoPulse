/**
 * Monte Carlo Tolerance Analysis Engine
 *
 * Performs statistical analysis of circuit behavior under component tolerances.
 * Supports uniform, Gaussian, and worst-case distributions.
 * Uses a seeded PRNG (mulberry32 from @shared/prng) for reproducible results.
 *
 * Usage:
 *   const mc = new MonteCarloAnalysis();
 *   const result = mc.run({
 *     iterations: 1000,
 *     seed: 42,
 *     parameters: new Map([['R1', { nominal: 10000, tolerance: 0.05, distribution: 'gaussian' }]]),
 *     evaluator: (params) => params.get('R1')! * 0.001, // V = I * R
 *   });
 *   const yield_ = mc.calculateYield(result, 9.5, 10.5);
 */

import { mulberry32 } from '@shared/prng';

// Re-export for backward compatibility (gpu-monte-carlo.ts imports from here)
export { mulberry32 };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Tolerance specification for a single parameter. */
export interface ToleranceSpec {
  /** Nominal value (e.g., 10000 for 10k ohm). */
  nominal: number;
  /** Tolerance as a fraction (e.g., 0.05 for 5%). */
  tolerance: number;
  /** Distribution type for random sampling. */
  distribution: 'uniform' | 'gaussian' | 'worst_case';
}

/** Configuration for a Monte Carlo analysis run. */
export interface MonteCarloConfig {
  /** Number of iterations to run (default 1000). */
  iterations: number;
  /** Optional seed for reproducible results. */
  seed?: number;
  /** Map of parameter name to tolerance specification. */
  parameters: Map<string, ToleranceSpec>;
  /** Evaluator function: given randomized parameter values, returns the output metric. */
  evaluator: (params: Map<string, number>) => number;
}

/** Statistical summary of Monte Carlo results. */
export interface MonteCarloStatistics {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  median: number;
  percentile1: number;
  percentile5: number;
  percentile95: number;
  percentile99: number;
}

/** A single histogram bin. */
export interface HistogramBin {
  binStart: number;
  binEnd: number;
  count: number;
}

/** Full result of a Monte Carlo analysis run. */
export interface MonteCarloResult {
  /** Number of iterations performed. */
  iterations: number;
  /** All output metric values, one per iteration. */
  values: number[];
  /** Statistical summary. */
  statistics: MonteCarloStatistics;
  /** Sensitivity coefficients: parameter name -> normalized sensitivity. */
  sensitivity: Map<string, number>;
  /** Histogram of output values. */
  histogram: HistogramBin[];
}

/** Yield analysis result. */
export interface YieldResult {
  /** Percentage of iterations within spec (0-100). */
  yieldPercent: number;
  /** Number of passing iterations. */
  passCount: number;
  /** Number of failing iterations. */
  failCount: number;
  /** Total iterations analyzed. */
  totalCount: number;
}

// ---------------------------------------------------------------------------
// MonteCarloAnalysis class
// ---------------------------------------------------------------------------

/**
 * Monte Carlo tolerance analysis engine.
 * Runs N iterations of a circuit evaluator with randomized parameters,
 * then computes statistics, sensitivity coefficients, and histograms.
 */
export class MonteCarloAnalysis {
  /**
   * Run a Monte Carlo analysis.
   *
   * @param config - Analysis configuration (iterations, parameters, evaluator, optional seed)
   * @returns Full analysis results including statistics, sensitivity, and histogram
   */
  run(config: MonteCarloConfig): MonteCarloResult {
    const { iterations, seed, parameters, evaluator } = config;
    const rng = seed !== undefined ? mulberry32(seed) : Math.random;

    // Run all iterations
    const values: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const randomizedParams = new Map<string, number>();
      parameters.forEach((spec, name) => {
        randomizedParams.set(name, MonteCarloAnalysis.generateRandomValue(spec, rng));
      });
      values.push(evaluator(randomizedParams));
    }

    // Compute statistics
    const statistics = MonteCarloAnalysis.computeStatistics(values);

    // Compute sensitivity
    const sensitivity = MonteCarloAnalysis.computeSensitivity(config);

    // Build histogram
    const histogram = MonteCarloAnalysis.buildHistogram(values);

    return {
      iterations,
      values,
      statistics,
      sensitivity,
      histogram,
    };
  }

  /**
   * Calculate yield: what fraction of results fall within [specMin, specMax].
   */
  calculateYield(result: MonteCarloResult, specMin: number, specMax: number): YieldResult {
    let passCount = 0;
    for (const v of result.values) {
      if (v >= specMin && v <= specMax) {
        passCount++;
      }
    }
    const totalCount = result.values.length;
    return {
      yieldPercent: totalCount > 0 ? (passCount / totalCount) * 100 : 0,
      passCount,
      failCount: totalCount - passCount,
      totalCount,
    };
  }

  // -----------------------------------------------------------------------
  // Static methods
  // -----------------------------------------------------------------------

  /**
   * Generate a random value from a tolerance specification.
   *
   * - uniform: flat distribution over [nominal * (1 - tolerance), nominal * (1 + tolerance)]
   * - gaussian: Box-Muller transform, 3sigma = tolerance * nominal
   * - worst_case: only the two extreme values nominal * (1 +/- tolerance)
   *
   * @param spec - Tolerance specification
   * @param rng - Random number generator returning values in [0, 1)
   */
  static generateRandomValue(spec: ToleranceSpec, rng?: () => number): number {
    const random = rng ?? Math.random;
    const { nominal, tolerance, distribution } = spec;

    if (tolerance === 0) {
      return nominal;
    }

    const delta = tolerance * Math.abs(nominal);

    switch (distribution) {
      case 'uniform': {
        // Uniform over [nominal - delta, nominal + delta]
        const u = random();
        return nominal - delta + u * 2 * delta;
      }

      case 'gaussian': {
        // Box-Muller transform: 3sigma = delta (99.7% within tolerance range)
        const sigma = delta / 3;
        const u1 = random();
        const u2 = random();
        // Clamp u1 away from 0 to avoid -Infinity from log(0)
        const safeU1 = Math.max(u1, 1e-15);
        const z = Math.sqrt(-2 * Math.log(safeU1)) * Math.cos(2 * Math.PI * u2);
        return nominal + z * sigma;
      }

      case 'worst_case': {
        // Only the two extreme values
        return random() < 0.5 ? nominal - delta : nominal + delta;
      }
    }
  }

  /**
   * Compute normalized sensitivity coefficients for each parameter.
   * Uses central-difference approximation: vary each parameter by +/- 1%
   * while holding all others at nominal.
   *
   * Sensitivity = (deltaOutput / output_nominal) / (deltaParam / param_nominal)
   *             = (f(p+dp) - f(p-dp)) / (2 * output_nominal * fraction)
   */
  static computeSensitivity(config: MonteCarloConfig): Map<string, number> {
    const { parameters, evaluator } = config;
    const fraction = 0.01; // 1% perturbation

    // Evaluate at nominal
    const nominalParams = new Map<string, number>();
    parameters.forEach((spec, name) => {
      nominalParams.set(name, spec.nominal);
    });
    const nominalOutput = evaluator(nominalParams);

    const sensitivity = new Map<string, number>();

    parameters.forEach((spec, name) => {
      const dp = fraction * Math.abs(spec.nominal);
      if (dp === 0) {
        sensitivity.set(name, 0);
        return;
      }

      // f(p + dp)
      const paramsPlus = new Map(nominalParams);
      paramsPlus.set(name, spec.nominal + dp);
      const outputPlus = evaluator(paramsPlus);

      // f(p - dp)
      const paramsMinus = new Map(nominalParams);
      paramsMinus.set(name, spec.nominal - dp);
      const outputMinus = evaluator(paramsMinus);

      // Normalized sensitivity
      if (nominalOutput === 0) {
        // Avoid division by zero — use absolute sensitivity
        sensitivity.set(name, (outputPlus - outputMinus) / (2 * dp));
      } else {
        const dOutput = outputPlus - outputMinus;
        sensitivity.set(name, (dOutput / nominalOutput) / (2 * fraction));
      }
    });

    return sensitivity;
  }

  /**
   * Compute descriptive statistics from an array of values.
   */
  static computeStatistics(values: number[]): MonteCarloStatistics {
    if (values.length === 0) {
      return {
        mean: 0,
        stdDev: 0,
        min: 0,
        max: 0,
        median: 0,
        percentile1: 0,
        percentile5: 0,
        percentile95: 0,
        percentile99: 0,
      };
    }

    const n = values.length;
    const sorted = [...values].sort((a, b) => a - b);

    // Mean
    let sum = 0;
    for (const v of values) {
      sum += v;
    }
    const mean = sum / n;

    // Standard deviation (population)
    let sumSqDiff = 0;
    for (const v of values) {
      const diff = v - mean;
      sumSqDiff += diff * diff;
    }
    const stdDev = Math.sqrt(sumSqDiff / n);

    // Min / max
    const min = sorted[0];
    const max = sorted[n - 1];

    // Median
    const median = n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)];

    // Percentiles using nearest-rank method
    const percentile = (p: number): number => {
      const idx = Math.ceil((p / 100) * n) - 1;
      return sorted[Math.max(0, Math.min(idx, n - 1))];
    };

    return {
      mean,
      stdDev,
      min,
      max,
      median,
      percentile1: percentile(1),
      percentile5: percentile(5),
      percentile95: percentile(95),
      percentile99: percentile(99),
    };
  }

  /**
   * Build a histogram from an array of values.
   *
   * @param values - The data to bin
   * @param bins - Number of bins (default: Sturges' rule)
   */
  static buildHistogram(values: number[], bins?: number): HistogramBin[] {
    if (values.length === 0) {
      return [];
    }

    const min = Math.min(...values);
    const max = Math.max(...values);

    // Handle all-same-value edge case
    if (min === max) {
      return [{ binStart: min, binEnd: min, count: values.length }];
    }

    // Default bin count: Sturges' rule
    const numBins = bins ?? Math.max(1, Math.ceil(Math.log2(values.length) + 1));
    const binWidth = (max - min) / numBins;

    const histogram: HistogramBin[] = [];
    for (let i = 0; i < numBins; i++) {
      histogram.push({
        binStart: min + i * binWidth,
        binEnd: min + (i + 1) * binWidth,
        count: 0,
      });
    }

    for (const v of values) {
      let idx = Math.floor((v - min) / binWidth);
      // Clamp the max value into the last bin
      if (idx >= numBins) {
        idx = numBins - 1;
      }
      histogram[idx].count++;
    }

    return histogram;
  }
}
