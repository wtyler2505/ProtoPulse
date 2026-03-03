import { describe, it, expect } from 'vitest';
import {
  MonteCarloAnalysis,
  mulberry32,
} from '../monte-carlo';
import type {
  ToleranceSpec,
  MonteCarloConfig,
} from '../monte-carlo';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simple resistor-divider evaluator: Vout = Vin * R2 / (R1 + R2). */
function voltageDivider(params: Map<string, number>): number {
  const r1 = params.get('R1') ?? 10000;
  const r2 = params.get('R2') ?? 10000;
  const vin = 10; // 10V input
  return vin * r2 / (r1 + r2);
}

/** Identity evaluator that returns R1 directly. */
function identityR1(params: Map<string, number>): number {
  return params.get('R1') ?? 0;
}

// ---------------------------------------------------------------------------
// Seeded PRNG
// ---------------------------------------------------------------------------

describe('mulberry32', () => {
  it('produces deterministic results from the same seed', () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    const values1 = Array.from({ length: 100 }, () => rng1());
    const values2 = Array.from({ length: 100 }, () => rng2());
    expect(values1).toEqual(values2);
  });

  it('produces different results from different seeds', () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(99);
    const v1 = rng1();
    const v2 = rng2();
    expect(v1).not.toBe(v2);
  });

  it('produces values in [0, 1)', () => {
    const rng = mulberry32(123);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

// ---------------------------------------------------------------------------
// generateRandomValue
// ---------------------------------------------------------------------------

describe('MonteCarloAnalysis.generateRandomValue', () => {
  describe('uniform distribution', () => {
    it('produces values within tolerance range', () => {
      const spec: ToleranceSpec = { nominal: 10000, tolerance: 0.05, distribution: 'uniform' };
      const rng = mulberry32(42);
      const min = 10000 * (1 - 0.05);
      const max = 10000 * (1 + 0.05);

      for (let i = 0; i < 1000; i++) {
        const v = MonteCarloAnalysis.generateRandomValue(spec, () => rng());
        expect(v).toBeGreaterThanOrEqual(min);
        expect(v).toBeLessThanOrEqual(max);
      }
    });

    it('spans the full range (not clustered at center)', () => {
      const spec: ToleranceSpec = { nominal: 10000, tolerance: 0.1, distribution: 'uniform' };
      const rng = mulberry32(42);
      let foundLow = false;
      let foundHigh = false;
      const midpoint = 10000;

      for (let i = 0; i < 10000; i++) {
        const v = MonteCarloAnalysis.generateRandomValue(spec, () => rng());
        if (v < midpoint - 800) {
          foundLow = true;
        }
        if (v > midpoint + 800) {
          foundHigh = true;
        }
      }
      expect(foundLow).toBe(true);
      expect(foundHigh).toBe(true);
    });
  });

  describe('gaussian distribution', () => {
    it('produces mean approximately equal to nominal', () => {
      const spec: ToleranceSpec = { nominal: 10000, tolerance: 0.05, distribution: 'gaussian' };
      const rng = mulberry32(42);
      let sum = 0;
      const n = 10000;
      for (let i = 0; i < n; i++) {
        sum += MonteCarloAnalysis.generateRandomValue(spec, () => rng());
      }
      const mean = sum / n;
      // Mean should be within 1% of nominal
      expect(Math.abs(mean - 10000) / 10000).toBeLessThan(0.01);
    });

    it('99.7% of values fall within 3sigma (tolerance range)', () => {
      const spec: ToleranceSpec = { nominal: 10000, tolerance: 0.05, distribution: 'gaussian' };
      const rng = mulberry32(42);
      const delta = 10000 * 0.05;
      let withinRange = 0;
      const n = 10000;
      for (let i = 0; i < n; i++) {
        const v = MonteCarloAnalysis.generateRandomValue(spec, () => rng());
        if (v >= 10000 - delta && v <= 10000 + delta) {
          withinRange++;
        }
      }
      // At least 99% should be within range (3sigma ~ 99.7%)
      expect(withinRange / n).toBeGreaterThan(0.99);
    });
  });

  describe('worst_case distribution', () => {
    it('produces only 2 unique values', () => {
      const spec: ToleranceSpec = { nominal: 10000, tolerance: 0.05, distribution: 'worst_case' };
      const rng = mulberry32(42);
      const values = new Set<number>();
      for (let i = 0; i < 1000; i++) {
        values.add(MonteCarloAnalysis.generateRandomValue(spec, () => rng()));
      }
      expect(values.size).toBe(2);
      expect(values).toContain(10000 * 0.95);
      expect(values).toContain(10000 * 1.05);
    });
  });

  describe('zero tolerance', () => {
    it('always returns nominal value', () => {
      const spec: ToleranceSpec = { nominal: 4700, tolerance: 0, distribution: 'uniform' };
      const rng = mulberry32(42);
      for (let i = 0; i < 100; i++) {
        expect(MonteCarloAnalysis.generateRandomValue(spec, () => rng())).toBe(4700);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// computeStatistics
// ---------------------------------------------------------------------------

describe('MonteCarloAnalysis.computeStatistics', () => {
  it('computes correct mean', () => {
    const stats = MonteCarloAnalysis.computeStatistics([1, 2, 3, 4, 5]);
    expect(stats.mean).toBe(3);
  });

  it('computes correct stdDev', () => {
    const stats = MonteCarloAnalysis.computeStatistics([2, 4, 4, 4, 5, 5, 7, 9]);
    // Population stdDev of this dataset = 2.0
    expect(stats.stdDev).toBeCloseTo(2.0, 1);
  });

  it('computes min and max', () => {
    const stats = MonteCarloAnalysis.computeStatistics([5, 1, 9, 3, 7]);
    expect(stats.min).toBe(1);
    expect(stats.max).toBe(9);
  });

  it('computes median for odd-length array', () => {
    const stats = MonteCarloAnalysis.computeStatistics([3, 1, 4, 1, 5]);
    // Sorted: [1, 1, 3, 4, 5] -> median = 3
    expect(stats.median).toBe(3);
  });

  it('computes median for even-length array', () => {
    const stats = MonteCarloAnalysis.computeStatistics([1, 2, 3, 4]);
    // Sorted: [1, 2, 3, 4] -> median = (2+3)/2 = 2.5
    expect(stats.median).toBe(2.5);
  });

  it('computes percentiles', () => {
    // 100 values from 1 to 100
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    const stats = MonteCarloAnalysis.computeStatistics(values);
    expect(stats.percentile1).toBe(1);
    expect(stats.percentile5).toBe(5);
    expect(stats.percentile95).toBe(95);
    expect(stats.percentile99).toBe(99);
  });

  it('handles single-element array', () => {
    const stats = MonteCarloAnalysis.computeStatistics([42]);
    expect(stats.mean).toBe(42);
    expect(stats.stdDev).toBe(0);
    expect(stats.min).toBe(42);
    expect(stats.max).toBe(42);
    expect(stats.median).toBe(42);
  });

  it('handles empty array', () => {
    const stats = MonteCarloAnalysis.computeStatistics([]);
    expect(stats.mean).toBe(0);
    expect(stats.stdDev).toBe(0);
    expect(stats.min).toBe(0);
    expect(stats.max).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildHistogram
// ---------------------------------------------------------------------------

describe('MonteCarloAnalysis.buildHistogram', () => {
  it('covers all values', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const histogram = MonteCarloAnalysis.buildHistogram(values, 5);
    const totalCount = histogram.reduce((sum, bin) => sum + bin.count, 0);
    expect(totalCount).toBe(values.length);
  });

  it('creates the requested number of bins', () => {
    const values = Array.from({ length: 100 }, (_, i) => i);
    const histogram = MonteCarloAnalysis.buildHistogram(values, 10);
    expect(histogram.length).toBe(10);
  });

  it('handles all-same-value edge case', () => {
    const values = [5, 5, 5, 5];
    const histogram = MonteCarloAnalysis.buildHistogram(values);
    expect(histogram.length).toBe(1);
    expect(histogram[0].count).toBe(4);
    expect(histogram[0].binStart).toBe(5);
    expect(histogram[0].binEnd).toBe(5);
  });

  it('handles empty array', () => {
    const histogram = MonteCarloAnalysis.buildHistogram([]);
    expect(histogram.length).toBe(0);
  });

  it('bins span from min to max', () => {
    const values = [0, 10, 20, 30, 40, 50];
    const histogram = MonteCarloAnalysis.buildHistogram(values, 5);
    expect(histogram[0].binStart).toBe(0);
    expect(histogram[histogram.length - 1].binEnd).toBe(50);
  });

  it('uses Sturges rule when bins not specified', () => {
    const values = Array.from({ length: 256 }, (_, i) => i);
    const histogram = MonteCarloAnalysis.buildHistogram(values);
    // Sturges: ceil(log2(256) + 1) = ceil(9) = 9
    expect(histogram.length).toBe(9);
  });
});

// ---------------------------------------------------------------------------
// computeSensitivity
// ---------------------------------------------------------------------------

describe('MonteCarloAnalysis.computeSensitivity', () => {
  it('identifies the more sensitive parameter', () => {
    // Voltage divider: Vout = 10 * R2 / (R1 + R2)
    // At R1=R2=10k, Vout = 5V
    // Sensitivity to R1 is negative (increasing R1 decreases Vout)
    // Sensitivity to R2 is positive (increasing R2 increases Vout)
    const config: MonteCarloConfig = {
      iterations: 100,
      seed: 42,
      parameters: new Map<string, ToleranceSpec>([
        ['R1', { nominal: 10000, tolerance: 0.05, distribution: 'uniform' }],
        ['R2', { nominal: 10000, tolerance: 0.05, distribution: 'uniform' }],
      ]),
      evaluator: voltageDivider,
    };

    const sensitivity = MonteCarloAnalysis.computeSensitivity(config);
    expect(sensitivity.has('R1')).toBe(true);
    expect(sensitivity.has('R2')).toBe(true);
    // Both should have equal magnitude sensitivity (symmetric divider)
    const absR1 = Math.abs(sensitivity.get('R1')!);
    const absR2 = Math.abs(sensitivity.get('R2')!);
    expect(absR1).toBeCloseTo(absR2, 2);
  });

  it('returns zero sensitivity for zero-nominal parameter', () => {
    const config: MonteCarloConfig = {
      iterations: 10,
      parameters: new Map<string, ToleranceSpec>([
        ['R1', { nominal: 0, tolerance: 0.05, distribution: 'uniform' }],
      ]),
      evaluator: identityR1,
    };
    const sensitivity = MonteCarloAnalysis.computeSensitivity(config);
    expect(sensitivity.get('R1')).toBe(0);
  });

  it('shows higher sensitivity for parameter with more impact', () => {
    // Linear: output = 3*R1 + 0.5*R2
    const config: MonteCarloConfig = {
      iterations: 100,
      seed: 42,
      parameters: new Map<string, ToleranceSpec>([
        ['R1', { nominal: 100, tolerance: 0.1, distribution: 'uniform' }],
        ['R2', { nominal: 100, tolerance: 0.1, distribution: 'uniform' }],
      ]),
      evaluator: (params) => {
        const r1 = params.get('R1') ?? 100;
        const r2 = params.get('R2') ?? 100;
        return 3 * r1 + 0.5 * r2;
      },
    };
    const sensitivity = MonteCarloAnalysis.computeSensitivity(config);
    const absR1 = Math.abs(sensitivity.get('R1')!);
    const absR2 = Math.abs(sensitivity.get('R2')!);
    expect(absR1).toBeGreaterThan(absR2);
  });
});

// ---------------------------------------------------------------------------
// MonteCarloAnalysis.run (full integration)
// ---------------------------------------------------------------------------

describe('MonteCarloAnalysis.run', () => {
  const mc = new MonteCarloAnalysis();

  it('runs the specified number of iterations', () => {
    const config: MonteCarloConfig = {
      iterations: 500,
      seed: 42,
      parameters: new Map<string, ToleranceSpec>([
        ['R1', { nominal: 10000, tolerance: 0.05, distribution: 'uniform' }],
      ]),
      evaluator: identityR1,
    };
    const result = mc.run(config);
    expect(result.iterations).toBe(500);
    expect(result.values.length).toBe(500);
  });

  it('produces reproducible results with same seed', () => {
    const config: MonteCarloConfig = {
      iterations: 100,
      seed: 42,
      parameters: new Map<string, ToleranceSpec>([
        ['R1', { nominal: 10000, tolerance: 0.05, distribution: 'gaussian' }],
        ['R2', { nominal: 10000, tolerance: 0.05, distribution: 'gaussian' }],
      ]),
      evaluator: voltageDivider,
    };
    const result1 = mc.run(config);
    const result2 = mc.run(config);
    expect(result1.values).toEqual(result2.values);
    expect(result1.statistics).toEqual(result2.statistics);
  });

  it('produces different results with different seeds', () => {
    const base: Omit<MonteCarloConfig, 'seed'> = {
      iterations: 100,
      parameters: new Map<string, ToleranceSpec>([
        ['R1', { nominal: 10000, tolerance: 0.05, distribution: 'uniform' }],
      ]),
      evaluator: identityR1,
    };
    const result1 = mc.run({ ...base, seed: 42 });
    const result2 = mc.run({ ...base, seed: 99 });
    expect(result1.values).not.toEqual(result2.values);
  });

  it('includes valid statistics', () => {
    const config: MonteCarloConfig = {
      iterations: 1000,
      seed: 42,
      parameters: new Map<string, ToleranceSpec>([
        ['R1', { nominal: 10000, tolerance: 0.05, distribution: 'uniform' }],
        ['R2', { nominal: 10000, tolerance: 0.05, distribution: 'uniform' }],
      ]),
      evaluator: voltageDivider,
    };
    const result = mc.run(config);
    expect(result.statistics.mean).toBeCloseTo(5, 0); // ~5V for equal resistor divider
    expect(result.statistics.min).toBeLessThan(result.statistics.mean);
    expect(result.statistics.max).toBeGreaterThan(result.statistics.mean);
    expect(result.statistics.stdDev).toBeGreaterThan(0);
    expect(result.statistics.percentile5).toBeLessThan(result.statistics.percentile95);
  });

  it('includes non-empty histogram', () => {
    const config: MonteCarloConfig = {
      iterations: 100,
      seed: 42,
      parameters: new Map<string, ToleranceSpec>([
        ['R1', { nominal: 10000, tolerance: 0.05, distribution: 'uniform' }],
      ]),
      evaluator: identityR1,
    };
    const result = mc.run(config);
    expect(result.histogram.length).toBeGreaterThan(0);
    const totalCount = result.histogram.reduce((s, b) => s + b.count, 0);
    expect(totalCount).toBe(100);
  });

  it('includes sensitivity map', () => {
    const config: MonteCarloConfig = {
      iterations: 100,
      seed: 42,
      parameters: new Map<string, ToleranceSpec>([
        ['R1', { nominal: 10000, tolerance: 0.05, distribution: 'uniform' }],
        ['R2', { nominal: 10000, tolerance: 0.05, distribution: 'uniform' }],
      ]),
      evaluator: voltageDivider,
    };
    const result = mc.run(config);
    expect(result.sensitivity.size).toBe(2);
    expect(result.sensitivity.has('R1')).toBe(true);
    expect(result.sensitivity.has('R2')).toBe(true);
  });

  it('handles single iteration', () => {
    const config: MonteCarloConfig = {
      iterations: 1,
      seed: 42,
      parameters: new Map<string, ToleranceSpec>([
        ['R1', { nominal: 10000, tolerance: 0.05, distribution: 'uniform' }],
      ]),
      evaluator: identityR1,
    };
    const result = mc.run(config);
    expect(result.values.length).toBe(1);
    expect(result.statistics.min).toBe(result.statistics.max);
    expect(result.statistics.stdDev).toBe(0);
  });

  it('completes 10000 iterations in reasonable time', () => {
    const config: MonteCarloConfig = {
      iterations: 10000,
      seed: 42,
      parameters: new Map<string, ToleranceSpec>([
        ['R1', { nominal: 10000, tolerance: 0.05, distribution: 'gaussian' }],
        ['R2', { nominal: 10000, tolerance: 0.05, distribution: 'gaussian' }],
        ['R3', { nominal: 4700, tolerance: 0.1, distribution: 'uniform' }],
      ]),
      evaluator: (params) => {
        const r1 = params.get('R1') ?? 10000;
        const r2 = params.get('R2') ?? 10000;
        const r3 = params.get('R3') ?? 4700;
        return 10 * (r2 * r3 / (r2 + r3)) / (r1 + r2 * r3 / (r2 + r3));
      },
    };
    const start = performance.now();
    const result = mc.run(config);
    const elapsed = performance.now() - start;
    expect(result.values.length).toBe(10000);
    // Should complete in under 5 seconds even on slow machines
    expect(elapsed).toBeLessThan(5000);
  });
});

// ---------------------------------------------------------------------------
// calculateYield
// ---------------------------------------------------------------------------

describe('MonteCarloAnalysis.calculateYield', () => {
  const mc = new MonteCarloAnalysis();

  it('returns 100% yield when all values in spec', () => {
    const config: MonteCarloConfig = {
      iterations: 100,
      seed: 42,
      parameters: new Map<string, ToleranceSpec>([
        ['R1', { nominal: 10000, tolerance: 0, distribution: 'uniform' }],
      ]),
      evaluator: identityR1,
    };
    const result = mc.run(config);
    const yield_ = mc.calculateYield(result, 9000, 11000);
    expect(yield_.yieldPercent).toBe(100);
    expect(yield_.passCount).toBe(100);
    expect(yield_.failCount).toBe(0);
    expect(yield_.totalCount).toBe(100);
  });

  it('returns 0% yield when all values out of spec', () => {
    const config: MonteCarloConfig = {
      iterations: 100,
      seed: 42,
      parameters: new Map<string, ToleranceSpec>([
        ['R1', { nominal: 10000, tolerance: 0.05, distribution: 'uniform' }],
      ]),
      evaluator: identityR1,
    };
    const result = mc.run(config);
    // Spec range is way outside the tolerance range
    const yield_ = mc.calculateYield(result, 20000, 30000);
    expect(yield_.yieldPercent).toBe(0);
    expect(yield_.passCount).toBe(0);
    expect(yield_.failCount).toBe(100);
  });

  it('returns partial yield for mixed results', () => {
    const config: MonteCarloConfig = {
      iterations: 1000,
      seed: 42,
      parameters: new Map<string, ToleranceSpec>([
        ['R1', { nominal: 10000, tolerance: 0.05, distribution: 'uniform' }],
      ]),
      evaluator: identityR1,
    };
    const result = mc.run(config);
    // Narrow spec: only values between 9750 and 10250 (half the tolerance range)
    const yield_ = mc.calculateYield(result, 9750, 10250);
    expect(yield_.yieldPercent).toBeGreaterThan(20);
    expect(yield_.yieldPercent).toBeLessThan(80);
    expect(yield_.passCount + yield_.failCount).toBe(yield_.totalCount);
  });

  it('handles boundary values inclusively', () => {
    // Create a result with known values
    const fakeResult = {
      iterations: 3,
      values: [1, 2, 3],
      statistics: MonteCarloAnalysis.computeStatistics([1, 2, 3]),
      sensitivity: new Map<string, number>(),
      histogram: [],
    };
    const yield_ = mc.calculateYield(fakeResult, 1, 3);
    expect(yield_.yieldPercent).toBe(100);
    expect(yield_.passCount).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Edge cases & robustness
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  const mc = new MonteCarloAnalysis();

  it('handles negative nominal values', () => {
    const spec: ToleranceSpec = { nominal: -100, tolerance: 0.1, distribution: 'uniform' };
    const rng = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const v = MonteCarloAnalysis.generateRandomValue(spec, () => rng());
      expect(v).toBeGreaterThanOrEqual(-110);
      expect(v).toBeLessThanOrEqual(-90);
    }
  });

  it('handles very large tolerance (100%)', () => {
    const spec: ToleranceSpec = { nominal: 100, tolerance: 1.0, distribution: 'uniform' };
    const rng = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const v = MonteCarloAnalysis.generateRandomValue(spec, () => rng());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(200);
    }
  });

  it('handles zero iterations gracefully', () => {
    const config: MonteCarloConfig = {
      iterations: 0,
      seed: 42,
      parameters: new Map<string, ToleranceSpec>([
        ['R1', { nominal: 10000, tolerance: 0.05, distribution: 'uniform' }],
      ]),
      evaluator: identityR1,
    };
    const result = mc.run(config);
    expect(result.values.length).toBe(0);
    expect(result.statistics.mean).toBe(0);
  });

  it('worst_case with multiple parameters explores all combinations over many runs', () => {
    // Use asymmetric evaluator so all 4 combinations produce distinct values
    // output = R1 + 2*R2  (asymmetric, so swapping extremes gives different results)
    const config: MonteCarloConfig = {
      iterations: 1000,
      seed: 42,
      parameters: new Map<string, ToleranceSpec>([
        ['R1', { nominal: 10000, tolerance: 0.05, distribution: 'worst_case' }],
        ['R2', { nominal: 10000, tolerance: 0.05, distribution: 'worst_case' }],
      ]),
      evaluator: (params) => {
        const r1 = params.get('R1') ?? 10000;
        const r2 = params.get('R2') ?? 10000;
        return r1 + 2 * r2;
      },
    };
    const result = mc.run(config);
    // With worst_case on both params and asymmetric evaluator, we get 4 possible output values
    const uniqueValues = new Set(result.values.map((v) => v.toFixed(6)));
    expect(uniqueValues.size).toBe(4);
  });
});
