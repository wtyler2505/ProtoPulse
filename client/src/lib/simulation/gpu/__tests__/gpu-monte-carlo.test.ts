import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  runGpuMonteCarlo,
} from '../gpu-monte-carlo';
import type {
  GpuMonteCarloConfig,
  GpuMonteCarloResult,
} from '../gpu-monte-carlo';
import type { ToleranceSpec } from '../../monte-carlo';
import { GpuAccelerator } from '../gpu-accelerator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function simpleConfig(overrides?: Partial<GpuMonteCarloConfig>): GpuMonteCarloConfig {
  const parameters = new Map<string, ToleranceSpec>([
    ['R1', { nominal: 10000, tolerance: 0.05, distribution: 'uniform' }],
  ]);
  return {
    iterations: 100,
    seed: 42,
    parameters,
    evaluator: (params: Map<string, number>) => {
      const r1 = params.get('R1') ?? 10000;
      return 5.0 / r1 * 1000; // current in mA
    },
    preferGpu: true,
    ...overrides,
  };
}

function multiParamConfig(overrides?: Partial<GpuMonteCarloConfig>): GpuMonteCarloConfig {
  const parameters = new Map<string, ToleranceSpec>([
    ['R1', { nominal: 1000, tolerance: 0.05, distribution: 'gaussian' }],
    ['R2', { nominal: 2200, tolerance: 0.1, distribution: 'uniform' }],
    ['C1', { nominal: 0.0001, tolerance: 0.2, distribution: 'worst_case' }],
  ]);
  return {
    iterations: 200,
    seed: 123,
    parameters,
    evaluator: (params: Map<string, number>) => {
      const r1 = params.get('R1') ?? 1000;
      const r2 = params.get('R2') ?? 2200;
      return r1 + r2;
    },
    preferGpu: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GPU Monte Carlo', () => {
  beforeEach(() => {
    GpuAccelerator.resetInstance();
  });

  afterEach(() => {
    GpuAccelerator.resetInstance();
  });

  // ---- CPU Fallback ----

  describe('CPU fallback', () => {
    it('falls back to CPU when WebGPU is unavailable', async () => {
      const config = simpleConfig({ preferGpu: true });
      const result = await runGpuMonteCarlo(config);

      expect(result.accelerated).toBe(false);
      expect(result.iterations).toBe(100);
      expect(result.values.length).toBe(100);
      expect(result.statistics.mean).toBeGreaterThan(0);
    });

    it('falls back to CPU when preferGpu is false', async () => {
      const config = simpleConfig({ preferGpu: false });
      const result = await runGpuMonteCarlo(config);

      expect(result.accelerated).toBe(false);
      expect(result.iterations).toBe(100);
    });

    it('produces deterministic results with the same seed', async () => {
      const config1 = simpleConfig({ seed: 99 });
      const config2 = simpleConfig({ seed: 99 });
      const result1 = await runGpuMonteCarlo(config1);
      const result2 = await runGpuMonteCarlo(config2);

      expect(result1.values).toEqual(result2.values);
      expect(result1.statistics.mean).toBe(result2.statistics.mean);
    });

    it('produces different results with different seeds', async () => {
      const result1 = await runGpuMonteCarlo(simpleConfig({ seed: 1 }));
      const result2 = await runGpuMonteCarlo(simpleConfig({ seed: 2 }));

      expect(result1.statistics.mean).not.toBe(result2.statistics.mean);
    });
  });

  // ---- Statistics ----

  describe('statistics', () => {
    it('computes correct statistics for single-parameter config', async () => {
      const result = await runGpuMonteCarlo(simpleConfig({ iterations: 500 }));

      expect(result.statistics.mean).toBeGreaterThan(0.45);
      expect(result.statistics.mean).toBeLessThan(0.55);
      expect(result.statistics.stdDev).toBeGreaterThan(0);
      expect(result.statistics.min).toBeLessThanOrEqual(result.statistics.mean);
      expect(result.statistics.max).toBeGreaterThanOrEqual(result.statistics.mean);
      expect(result.statistics.median).toBeGreaterThan(0);
    });

    it('computes histogram', async () => {
      const result = await runGpuMonteCarlo(simpleConfig({ iterations: 200 }));

      expect(result.histogram.length).toBeGreaterThan(0);
      const totalCount = result.histogram.reduce((sum: number, bin: { count: number }) => sum + bin.count, 0);
      expect(totalCount).toBe(200);
    });

    it('computes sensitivity coefficients', async () => {
      const result = await runGpuMonteCarlo(simpleConfig());

      expect(result.sensitivity.size).toBe(1);
      expect(result.sensitivity.has('R1')).toBe(true);
      const sens = result.sensitivity.get('R1')!;
      expect(typeof sens).toBe('number');
    });

    it('handles percentiles', async () => {
      const result = await runGpuMonteCarlo(simpleConfig({ iterations: 1000 }));

      expect(result.statistics.percentile5).toBeLessThanOrEqual(result.statistics.median);
      expect(result.statistics.percentile95).toBeGreaterThanOrEqual(result.statistics.median);
      expect(result.statistics.percentile1).toBeLessThanOrEqual(result.statistics.percentile5);
      expect(result.statistics.percentile99).toBeGreaterThanOrEqual(result.statistics.percentile95);
    });
  });

  // ---- Multi-parameter ----

  describe('multi-parameter', () => {
    it('supports multiple parameters', async () => {
      const result = await runGpuMonteCarlo(multiParamConfig());

      expect(result.iterations).toBe(200);
      expect(result.values.length).toBe(200);
      expect(result.sensitivity.size).toBe(3);
    });

    it('sensitivity includes all parameters', async () => {
      const result = await runGpuMonteCarlo(multiParamConfig());

      expect(result.sensitivity.has('R1')).toBe(true);
      expect(result.sensitivity.has('R2')).toBe(true);
      expect(result.sensitivity.has('C1')).toBe(true);
    });
  });

  // ---- GpuMonteCarloResult fields ----

  describe('result fields', () => {
    it('includes accelerated flag', async () => {
      const result = await runGpuMonteCarlo(simpleConfig());
      expect(typeof result.accelerated).toBe('boolean');
    });

    it('includes timing fields', async () => {
      const result = await runGpuMonteCarlo(simpleConfig());
      expect(typeof result.cpuTimeMs).toBe('number');
      expect(result.cpuTimeMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.gpuTimeMs).toBe('number');
      expect(typeof result.speedup).toBe('number');
    });

    it('reports speedup of 1 when CPU-only', async () => {
      const result = await runGpuMonteCarlo(simpleConfig());
      expect(result.accelerated).toBe(false);
      expect(result.speedup).toBe(1);
    });
  });

  // ---- Edge cases ----

  describe('edge cases', () => {
    it('handles single iteration', async () => {
      const result = await runGpuMonteCarlo(simpleConfig({ iterations: 1 }));
      expect(result.values.length).toBe(1);
      expect(result.statistics.mean).toBe(result.values[0]);
    });

    it('handles single parameter with zero tolerance', async () => {
      const parameters = new Map<string, ToleranceSpec>([
        ['R1', { nominal: 1000, tolerance: 0, distribution: 'uniform' }],
      ]);
      const result = await runGpuMonteCarlo(simpleConfig({ parameters }));

      // All values should be the same (no variation)
      const uniqueValues = new Set(result.values);
      expect(uniqueValues.size).toBe(1);
    });

    it('handles large iteration count', async () => {
      const result = await runGpuMonteCarlo(simpleConfig({ iterations: 5000 }));
      expect(result.values.length).toBe(5000);
      expect(result.statistics.mean).toBeGreaterThan(0);
    });

    it('gaussian distribution stays within reasonable bounds', async () => {
      const parameters = new Map<string, ToleranceSpec>([
        ['R1', { nominal: 10000, tolerance: 0.05, distribution: 'gaussian' }],
      ]);
      const result = await runGpuMonteCarlo(simpleConfig({ parameters, iterations: 1000 }));

      // Gaussian 3sigma = 5%, so values should be mostly within ~15% of nominal output
      const nominalOutput = 5.0 / 10000 * 1000;
      for (const v of result.values) {
        // Extremely generous bound — 4sigma should cover everything
        expect(v).toBeGreaterThan(nominalOutput * 0.5);
        expect(v).toBeLessThan(nominalOutput * 1.5);
      }
    });

    it('worst_case distribution produces only extreme values', async () => {
      const parameters = new Map<string, ToleranceSpec>([
        ['R1', { nominal: 1000, tolerance: 0.1, distribution: 'worst_case' }],
      ]);
      const config: GpuMonteCarloConfig = {
        iterations: 100,
        seed: 42,
        parameters,
        evaluator: (params: Map<string, number>) => params.get('R1')!,
        preferGpu: false,
      };
      const result = await runGpuMonteCarlo(config);

      const low = 1000 * (1 - 0.1);
      const high = 1000 * (1 + 0.1);
      for (const v of result.values) {
        expect(v === low || v === high).toBe(true);
      }
    });
  });
});
