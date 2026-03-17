import { describe, it, expect } from 'vitest';
import {
  calculateRiskEnvelope,
  classifyRisk,
  getYieldEstimate,
  formatRiskSummary,
  identifySensitiveParameters,
} from '../monte-carlo-risk-envelope';
import type {
  MonteCarloSample,
  RiskEnvelope,
  RiskLevel,
  SpecLimits,
} from '../monte-carlo-risk-envelope';

// ---------------------------------------------------------------------------
// Helpers — reusable builders
// ---------------------------------------------------------------------------

/** Create a sample with a single result and optional parameter values. */
function makeSample(result: number, parameterValues: Record<string, number> = {}): MonteCarloSample {
  return { parameterValues, result };
}

/** Generate N uniformly spaced samples in [min, max]. */
function uniformSamples(min: number, max: number, count: number): MonteCarloSample[] {
  const samples: MonteCarloSample[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    samples.push(makeSample(min + t * (max - min)));
  }
  return samples;
}

/**
 * Generate samples with a single parameter that has a known linear relationship
 * to the result: result = slope * param + noise.
 */
function linearSamples(
  paramName: string,
  count: number,
  slope: number,
  noise: number = 0,
): MonteCarloSample[] {
  const samples: MonteCarloSample[] = [];
  for (let i = 0; i < count; i++) {
    const paramValue = i + 1;
    const noiseValue = noise > 0 ? (i % 2 === 0 ? noise : -noise) : 0;
    samples.push({
      parameterValues: { [paramName]: paramValue },
      result: slope * paramValue + noiseValue,
    });
  }
  return samples;
}

// ---------------------------------------------------------------------------
// calculateRiskEnvelope
// ---------------------------------------------------------------------------

describe('calculateRiskEnvelope', () => {
  it('throws on empty samples', () => {
    expect(() => calculateRiskEnvelope([])).toThrow('Cannot calculate risk envelope from empty samples array');
  });

  it('handles a single sample', () => {
    const envelope = calculateRiskEnvelope([makeSample(42)]);
    expect(envelope.mean).toBe(42);
    expect(envelope.median).toBe(42);
    expect(envelope.p5).toBe(42);
    expect(envelope.p25).toBe(42);
    expect(envelope.p75).toBe(42);
    expect(envelope.p95).toBe(42);
    expect(envelope.stdDev).toBe(0);
  });

  it('computes correct percentiles for a uniform distribution', () => {
    // 0, 1, 2, ..., 100 (101 values)
    const samples = Array.from({ length: 101 }, (_, i) => makeSample(i));
    const envelope = calculateRiskEnvelope(samples);

    expect(envelope.p5).toBe(5);
    expect(envelope.p25).toBe(25);
    expect(envelope.median).toBe(50);
    expect(envelope.p75).toBe(75);
    expect(envelope.p95).toBe(95);
    expect(envelope.mean).toBe(50);
  });

  it('computes correct mean and stdDev', () => {
    // 4 samples: 2, 4, 6, 8 — mean = 5, stdDev = sqrt(5) ≈ 2.236
    const samples = [2, 4, 6, 8].map((v) => makeSample(v));
    const envelope = calculateRiskEnvelope(samples);

    expect(envelope.mean).toBe(5);
    expect(envelope.stdDev).toBeCloseTo(Math.sqrt(5), 10);
  });

  it('handles negative values', () => {
    const samples = [-10, -5, 0, 5, 10].map((v) => makeSample(v));
    const envelope = calculateRiskEnvelope(samples);

    expect(envelope.mean).toBe(0);
    expect(envelope.median).toBe(0);
    expect(envelope.p5).toBeLessThan(envelope.p25);
    expect(envelope.p95).toBeGreaterThan(envelope.p75);
  });

  it('handles all identical values', () => {
    const samples = Array.from({ length: 50 }, () => makeSample(7.5));
    const envelope = calculateRiskEnvelope(samples);

    expect(envelope.mean).toBe(7.5);
    expect(envelope.median).toBe(7.5);
    expect(envelope.p5).toBe(7.5);
    expect(envelope.p95).toBe(7.5);
    expect(envelope.stdDev).toBe(0);
  });

  it('percentile interpolation works for two samples', () => {
    const samples = [makeSample(0), makeSample(100)];
    const envelope = calculateRiskEnvelope(samples);

    // With linear interpolation: p50 of [0, 100] = 50
    expect(envelope.median).toBe(50);
    expect(envelope.p5).toBe(5);
    expect(envelope.p95).toBe(95);
    expect(envelope.mean).toBe(50);
  });

  it('handles very large sample counts', () => {
    const samples = Array.from({ length: 10000 }, (_, i) => makeSample(i));
    const envelope = calculateRiskEnvelope(samples);

    expect(envelope.mean).toBeCloseTo(4999.5, 5);
    expect(envelope.median).toBeCloseTo(4999.5, 1);
    expect(envelope.p5).toBeLessThan(600);
    expect(envelope.p95).toBeGreaterThan(9400);
  });
});

// ---------------------------------------------------------------------------
// classifyRisk
// ---------------------------------------------------------------------------

describe('classifyRisk', () => {
  const spec: SpecLimits = { min: 4.5, max: 5.5 };

  it('returns "low" when 90% band is within spec', () => {
    const envelope: RiskEnvelope = {
      p5: 4.6, p25: 4.8, median: 5.0, p75: 5.2, p95: 5.4,
      mean: 5.0, stdDev: 0.2,
    };
    expect(classifyRisk(envelope, spec)).toBe('low');
  });

  it('returns "medium" when median is within spec but tails exceed', () => {
    const envelope: RiskEnvelope = {
      p5: 4.0, p25: 4.6, median: 5.0, p75: 5.4, p95: 6.0,
      mean: 5.0, stdDev: 0.5,
    };
    expect(classifyRisk(envelope, spec)).toBe('medium');
  });

  it('returns "medium" when only lower tail exceeds', () => {
    const envelope: RiskEnvelope = {
      p5: 4.2, p25: 4.6, median: 5.0, p75: 5.2, p95: 5.4,
      mean: 4.9, stdDev: 0.3,
    };
    expect(classifyRisk(envelope, spec)).toBe('medium');
  });

  it('returns "high" when median is outside spec but overlap exists', () => {
    const envelope: RiskEnvelope = {
      p5: 3.5, p25: 3.8, median: 4.2, p75: 4.6, p95: 5.2,
      mean: 4.2, stdDev: 0.5,
    };
    expect(classifyRisk(envelope, spec)).toBe('high');
  });

  it('returns "high" when median above spec but overlap exists', () => {
    const envelope: RiskEnvelope = {
      p5: 5.3, p25: 5.6, median: 5.8, p75: 6.0, p95: 6.5,
      mean: 5.8, stdDev: 0.3,
    };
    expect(classifyRisk(envelope, spec)).toBe('high');
  });

  it('returns "critical" when entire 90% band is outside spec', () => {
    const envelope: RiskEnvelope = {
      p5: 6.0, p25: 6.5, median: 7.0, p75: 7.5, p95: 8.0,
      mean: 7.0, stdDev: 0.5,
    };
    expect(classifyRisk(envelope, spec)).toBe('critical');
  });

  it('returns "critical" when entirely below spec', () => {
    const envelope: RiskEnvelope = {
      p5: 1.0, p25: 1.5, median: 2.0, p75: 2.5, p95: 3.0,
      mean: 2.0, stdDev: 0.5,
    };
    expect(classifyRisk(envelope, spec)).toBe('critical');
  });

  it('returns "low" when envelope exactly matches spec boundaries', () => {
    const envelope: RiskEnvelope = {
      p5: 4.5, p25: 4.8, median: 5.0, p75: 5.2, p95: 5.5,
      mean: 5.0, stdDev: 0.2,
    };
    expect(classifyRisk(envelope, spec)).toBe('low');
  });

  it('returns "medium" when p5 is exactly on lower boundary but p95 exceeds', () => {
    const envelope: RiskEnvelope = {
      p5: 4.5, p25: 4.8, median: 5.0, p75: 5.3, p95: 5.8,
      mean: 5.0, stdDev: 0.3,
    };
    expect(classifyRisk(envelope, spec)).toBe('medium');
  });
});

// ---------------------------------------------------------------------------
// getYieldEstimate
// ---------------------------------------------------------------------------

describe('getYieldEstimate', () => {
  const spec: SpecLimits = { min: 4.5, max: 5.5 };

  it('returns 0 for empty samples', () => {
    expect(getYieldEstimate([], spec)).toBe(0);
  });

  it('returns 100% when all samples within spec', () => {
    const samples = [4.5, 4.8, 5.0, 5.2, 5.5].map((v) => makeSample(v));
    expect(getYieldEstimate(samples, spec)).toBe(100);
  });

  it('returns 0% when no samples within spec', () => {
    const samples = [3.0, 6.0, 7.0].map((v) => makeSample(v));
    expect(getYieldEstimate(samples, spec)).toBe(0);
  });

  it('returns correct percentage for mixed results', () => {
    const samples = [4.0, 4.5, 5.0, 5.5, 6.0].map((v) => makeSample(v));
    // 4.5, 5.0, 5.5 are within spec → 3/5 = 60%
    expect(getYieldEstimate(samples, spec)).toBe(60);
  });

  it('includes boundary values in yield', () => {
    const samples = [4.5, 5.5].map((v) => makeSample(v));
    expect(getYieldEstimate(samples, spec)).toBe(100);
  });

  it('handles large sample sets correctly', () => {
    // 0..99, spec [25, 75] → 51 values in range (25, 26, ..., 75)
    const samples = Array.from({ length: 100 }, (_, i) => makeSample(i));
    const wideSpec: SpecLimits = { min: 25, max: 75 };
    expect(getYieldEstimate(samples, wideSpec)).toBe(51);
  });

  it('returns 100% for single sample within spec', () => {
    expect(getYieldEstimate([makeSample(5.0)], spec)).toBe(100);
  });

  it('returns 0% for single sample outside spec', () => {
    expect(getYieldEstimate([makeSample(6.0)], spec)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// formatRiskSummary
// ---------------------------------------------------------------------------

describe('formatRiskSummary', () => {
  const spec: SpecLimits = { min: 4.5, max: 5.5 };

  it('includes risk level label', () => {
    const envelope: RiskEnvelope = {
      p5: 4.6, p25: 4.8, median: 5.0, p75: 5.2, p95: 5.4,
      mean: 5.0, stdDev: 0.2,
    };
    const summary = formatRiskSummary(envelope, spec);
    expect(summary).toContain('LOW');
    expect(summary).toContain('robust');
  });

  it('includes spec range', () => {
    const envelope: RiskEnvelope = {
      p5: 4.6, p25: 4.8, median: 5.0, p75: 5.2, p95: 5.4,
      mean: 5.0, stdDev: 0.2,
    };
    const summary = formatRiskSummary(envelope, spec);
    expect(summary).toContain('4.5');
    expect(summary).toContain('5.5');
  });

  it('includes statistical values', () => {
    const envelope: RiskEnvelope = {
      p5: 4.6, p25: 4.8, median: 5.0, p75: 5.2, p95: 5.4,
      mean: 5.0, stdDev: 0.2,
    };
    const summary = formatRiskSummary(envelope, spec);
    expect(summary).toContain('Mean');
    expect(summary).toContain('Median');
    expect(summary).toContain('StdDev');
    expect(summary).toContain('90% Band');
    expect(summary).toContain('IQR');
  });

  it('shows CRITICAL label for critical risk', () => {
    const envelope: RiskEnvelope = {
      p5: 8.0, p25: 8.5, median: 9.0, p75: 9.5, p95: 10.0,
      mean: 9.0, stdDev: 0.5,
    };
    const summary = formatRiskSummary(envelope, spec);
    expect(summary).toContain('CRITICAL');
  });

  it('shows MEDIUM label for medium risk', () => {
    const envelope: RiskEnvelope = {
      p5: 4.0, p25: 4.6, median: 5.0, p75: 5.4, p95: 6.0,
      mean: 5.0, stdDev: 0.5,
    };
    const summary = formatRiskSummary(envelope, spec);
    expect(summary).toContain('MEDIUM');
  });

  it('shows HIGH label for high risk', () => {
    const envelope: RiskEnvelope = {
      p5: 3.5, p25: 3.8, median: 4.2, p75: 4.6, p95: 5.2,
      mean: 4.2, stdDev: 0.5,
    };
    const summary = formatRiskSummary(envelope, spec);
    expect(summary).toContain('HIGH');
  });

  it('formats zero values correctly', () => {
    const envelope: RiskEnvelope = {
      p5: 0, p25: 0, median: 0, p75: 0, p95: 0,
      mean: 0, stdDev: 0,
    };
    const zeroSpec: SpecLimits = { min: -1, max: 1 };
    const summary = formatRiskSummary(envelope, zeroSpec);
    expect(summary).toContain('0');
  });
});

// ---------------------------------------------------------------------------
// identifySensitiveParameters
// ---------------------------------------------------------------------------

describe('identifySensitiveParameters', () => {
  it('returns empty array when samples have no parameters', () => {
    const samples = [makeSample(1), makeSample(2)];
    expect(identifySensitiveParameters(samples)).toEqual([]);
  });

  it('returns zero correlation for single sample', () => {
    const samples = [{ parameterValues: { R1: 100 }, result: 5 }];
    const result = identifySensitiveParameters(samples);
    expect(result).toHaveLength(1);
    expect(result[0].param).toBe('R1');
    expect(result[0].correlation).toBe(0);
  });

  it('detects strong positive correlation', () => {
    // result = 2 * R1 (perfect positive correlation)
    const samples = linearSamples('R1', 100, 2);
    const result = identifySensitiveParameters(samples);

    expect(result).toHaveLength(1);
    expect(result[0].param).toBe('R1');
    expect(result[0].correlation).toBeCloseTo(1.0, 5);
  });

  it('detects strong negative correlation', () => {
    // result = -3 * R1 (perfect negative correlation)
    const samples = linearSamples('R1', 100, -3);
    const result = identifySensitiveParameters(samples);

    expect(result).toHaveLength(1);
    expect(result[0].param).toBe('R1');
    expect(result[0].correlation).toBeCloseTo(-1.0, 5);
  });

  it('returns zero correlation for constant parameter', () => {
    const samples: MonteCarloSample[] = [];
    for (let i = 0; i < 50; i++) {
      samples.push({ parameterValues: { R1: 100 }, result: i * 2 });
    }
    const result = identifySensitiveParameters(samples);

    expect(result).toHaveLength(1);
    expect(result[0].correlation).toBe(0);
  });

  it('returns zero correlation for constant result', () => {
    const samples: MonteCarloSample[] = [];
    for (let i = 0; i < 50; i++) {
      samples.push({ parameterValues: { R1: i }, result: 42 });
    }
    const result = identifySensitiveParameters(samples);

    expect(result).toHaveLength(1);
    expect(result[0].correlation).toBe(0);
  });

  it('sorts by absolute correlation descending', () => {
    // R1: strong positive, R2: weak positive, R3: strong negative
    const samples: MonteCarloSample[] = [];
    for (let i = 0; i < 100; i++) {
      samples.push({
        parameterValues: { R1: i, R2: i + (i % 3) * 10, R3: i },
        result: 5 * i - 3 * i, // = 2 * i
      });
    }
    // Both R1 and R3 are perfectly correlated with result (all are linear in i)
    const result = identifySensitiveParameters(samples);

    expect(result).toHaveLength(3);
    // First should have highest |correlation|
    expect(Math.abs(result[0].correlation)).toBeGreaterThanOrEqual(Math.abs(result[1].correlation));
    expect(Math.abs(result[1].correlation)).toBeGreaterThanOrEqual(Math.abs(result[2].correlation));
  });

  it('handles multiple parameters with varying correlations', () => {
    // result = 10 * R1 + 0.01 * R2 (R1 dominates)
    const samples: MonteCarloSample[] = [];
    for (let i = 1; i <= 50; i++) {
      samples.push({
        parameterValues: { R1: i, R2: i * 100 },
        result: 10 * i + 0.01 * (i * 100),
      });
    }
    const result = identifySensitiveParameters(samples);

    expect(result).toHaveLength(2);
    // Both perfectly correlated (both linear in i), so both should be ~1.0
    expect(result[0].correlation).toBeCloseTo(1.0, 5);
    expect(result[1].correlation).toBeCloseTo(1.0, 5);
  });

  it('returns empty array for empty samples', () => {
    expect(identifySensitiveParameters([])).toEqual([]);
  });

  it('correlation values are bounded to [-1, 1]', () => {
    const samples = linearSamples('R1', 1000, 5, 0.001);
    const result = identifySensitiveParameters(samples);

    for (const s of result) {
      expect(s.correlation).toBeGreaterThanOrEqual(-1);
      expect(s.correlation).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// Integration: end-to-end workflow
// ---------------------------------------------------------------------------

describe('end-to-end workflow', () => {
  it('processes a realistic voltage divider Monte Carlo result', () => {
    // Simulate a voltage divider: Vout = Vin * R2 / (R1 + R2)
    // Vin = 5V, R1 nominal 10k, R2 nominal 10k → nominal Vout = 2.5V
    const samples: MonteCarloSample[] = [];
    const nominalR1 = 10000;
    const nominalR2 = 10000;
    const tolerance = 0.05; // 5%

    // Generate 200 samples with pseudo-random variation
    for (let i = 0; i < 200; i++) {
      const t = i / 199;
      const r1 = nominalR1 * (1 + tolerance * (2 * t - 1));
      const r2 = nominalR2 * (1 - tolerance * (2 * t - 1));
      const vout = 5 * r2 / (r1 + r2);
      samples.push({
        parameterValues: { R1: r1, R2: r2 },
        result: vout,
      });
    }

    const envelope = calculateRiskEnvelope(samples);
    const spec: SpecLimits = { min: 2.3, max: 2.7 };
    const risk = classifyRisk(envelope, spec);
    const yieldPct = getYieldEstimate(samples, spec);
    const summary = formatRiskSummary(envelope, spec);
    const sensitivity = identifySensitiveParameters(samples);

    // Envelope sanity checks
    expect(envelope.p5).toBeLessThan(envelope.median);
    expect(envelope.median).toBeLessThan(envelope.p95);
    expect(envelope.p25).toBeLessThan(envelope.p75);
    expect(envelope.mean).toBeCloseTo(2.5, 0);

    // Risk should be reasonable for a 5% tolerance divider with +-0.2V spec
    expect(['low', 'medium'] as RiskLevel[]).toContain(risk);

    // Yield should be high
    expect(yieldPct).toBeGreaterThan(50);

    // Summary should be a non-empty string
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Risk Level');

    // Sensitivity should identify R1 and R2
    expect(sensitivity).toHaveLength(2);
    const paramNames = sensitivity.map((s) => s.param);
    expect(paramNames).toContain('R1');
    expect(paramNames).toContain('R2');
    // Both should have high absolute correlation
    expect(Math.abs(sensitivity[0].correlation)).toBeGreaterThan(0.5);
  });

  it('detects a failing design correctly', () => {
    // Spec is [9.0, 11.0] but values are centered around 5.0
    const samples = uniformSamples(3, 7, 100);
    const spec: SpecLimits = { min: 9, max: 11 };

    const envelope = calculateRiskEnvelope(samples);
    const risk = classifyRisk(envelope, spec);
    const yieldPct = getYieldEstimate(samples, spec);

    expect(risk).toBe('critical');
    expect(yieldPct).toBe(0);
  });
});
