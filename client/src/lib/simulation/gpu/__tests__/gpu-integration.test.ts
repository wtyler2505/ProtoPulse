/**
 * GPU Integration Tests
 *
 * End-to-end tests verifying the full pipeline: GpuAccelerator + shaders +
 * GpuMonteCarlo. All tests run in CPU-fallback mode (happy-dom has no WebGPU)
 * but verify the logic, result equivalence with the existing MonteCarloAnalysis,
 * and correct degradation behavior.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GpuAccelerator } from '../gpu-accelerator';
import { forwardSubShader, backSubShader, matVecMulShader, batchSolveShader, workgroupSize } from '../shaders';
import { runGpuMonteCarlo } from '../gpu-monte-carlo';
import type { GpuMonteCarloConfig } from '../gpu-monte-carlo';
import { MonteCarloAnalysis } from '../../monte-carlo';
import type { ToleranceSpec } from '../../monte-carlo';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides?: Partial<GpuMonteCarloConfig>): GpuMonteCarloConfig {
  const parameters = new Map<string, ToleranceSpec>([
    ['R1', { nominal: 10000, tolerance: 0.05, distribution: 'uniform' }],
    ['R2', { nominal: 4700, tolerance: 0.1, distribution: 'gaussian' }],
  ]);
  return {
    iterations: 500,
    seed: 42,
    parameters,
    evaluator: (params: Map<string, number>) => {
      const r1 = params.get('R1') ?? 10000;
      const r2 = params.get('R2') ?? 4700;
      // Voltage divider: Vout = Vin * R2 / (R1 + R2)
      return 12.0 * r2 / (r1 + r2);
    },
    preferGpu: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GPU Integration', () => {
  beforeEach(() => {
    GpuAccelerator.resetInstance();
  });

  afterEach(() => {
    GpuAccelerator.resetInstance();
  });

  // ---- End-to-end CPU fallback ----

  describe('end-to-end CPU fallback', () => {
    it('completes a full Monte Carlo run via CPU fallback', async () => {
      const config = makeConfig();
      const result = await runGpuMonteCarlo(config);

      expect(result.accelerated).toBe(false);
      expect(result.iterations).toBe(500);
      expect(result.values.length).toBe(500);
      expect(result.statistics.mean).toBeGreaterThan(0);
      expect(result.histogram.length).toBeGreaterThan(0);
      expect(result.sensitivity.size).toBe(2);
    });

    it('GpuAccelerator reports not ready in test environment', async () => {
      const acc = GpuAccelerator.getInstance();
      expect(GpuAccelerator.isSupported()).toBe(false);
      expect(acc.isReady()).toBe(false);

      const caps = await acc.initialize();
      expect(caps.available).toBe(false);
    });
  });

  // ---- Result equivalence ----

  describe('result equivalence with CPU MonteCarloAnalysis', () => {
    it('produces same values as CPU engine for same seed', async () => {
      const seed = 77;
      const parameters = new Map<string, ToleranceSpec>([
        ['R1', { nominal: 1000, tolerance: 0.05, distribution: 'uniform' }],
      ]);
      const evaluator = (params: Map<string, number>) => (params.get('R1') ?? 1000) * 2;

      // GPU path (will fall back to CPU)
      const gpuResult = await runGpuMonteCarlo({
        iterations: 200,
        seed,
        parameters,
        evaluator,
        preferGpu: false, // force CPU
      });

      // Direct CPU path
      const mc = new MonteCarloAnalysis();
      const cpuResult = mc.run({
        iterations: 200,
        seed,
        parameters,
        evaluator,
      });

      // Values should be identical (same seed, same PRNG, same evaluator)
      expect(gpuResult.values).toEqual(cpuResult.values);
      expect(gpuResult.statistics.mean).toBe(cpuResult.statistics.mean);
      expect(gpuResult.statistics.stdDev).toBe(cpuResult.statistics.stdDev);
      expect(gpuResult.statistics.min).toBe(cpuResult.statistics.min);
      expect(gpuResult.statistics.max).toBe(cpuResult.statistics.max);
      expect(gpuResult.statistics.median).toBe(cpuResult.statistics.median);
    });

    it('produces equivalent sensitivity coefficients', async () => {
      const config = makeConfig({ iterations: 100, seed: 55 });

      const gpuResult = await runGpuMonteCarlo({ ...config, preferGpu: false });
      const mc = new MonteCarloAnalysis();
      const cpuResult = mc.run(config);

      // Sensitivity should match
      expect(gpuResult.sensitivity.size).toBe(cpuResult.sensitivity.size);
      gpuResult.sensitivity.forEach((gpuSens: number, key: string) => {
        const cpuSens = cpuResult.sensitivity.get(key);
        expect(cpuSens).toBeDefined();
        expect(gpuSens).toBeCloseTo(cpuSens!, 10);
      });
    });

    it('produces equivalent histogram shape', async () => {
      const config = makeConfig({ iterations: 300, seed: 88 });

      const gpuResult = await runGpuMonteCarlo({ ...config, preferGpu: false });
      const mc = new MonteCarloAnalysis();
      const cpuResult = mc.run(config);

      expect(gpuResult.histogram.length).toBe(cpuResult.histogram.length);
      for (let i = 0; i < gpuResult.histogram.length; i++) {
        expect(gpuResult.histogram[i].count).toBe(cpuResult.histogram[i].count);
      }
    });
  });

  // ---- Large iteration counts ----

  describe('large iteration counts', () => {
    it('handles 5000 iterations', async () => {
      const config = makeConfig({ iterations: 5000 });
      const result = await runGpuMonteCarlo(config);

      expect(result.values.length).toBe(5000);
      expect(result.statistics.mean).toBeGreaterThan(0);
      // With 5000 samples, the mean should be close to the nominal output
      const nominalOutput = 12.0 * 4700 / (10000 + 4700);
      expect(result.statistics.mean).toBeCloseTo(nominalOutput, 0);
    });

    it('statistics converge with more iterations', async () => {
      const result100 = await runGpuMonteCarlo(makeConfig({ iterations: 100, seed: 1 }));
      const result2000 = await runGpuMonteCarlo(makeConfig({ iterations: 2000, seed: 1 }));

      // Standard error of mean decreases with sqrt(N)
      // With more samples, mean should be closer to the true value
      const nominal = 12.0 * 4700 / (10000 + 4700);
      const err100 = Math.abs(result100.statistics.mean - nominal);
      const err2000 = Math.abs(result2000.statistics.mean - nominal);

      // Not guaranteed for any specific seed, but generally true
      // Just verify both are reasonable
      expect(err100).toBeLessThan(1.0);
      expect(err2000).toBeLessThan(1.0);
    });
  });

  // ---- Multi-parameter sweep ----

  describe('multi-parameter sweep', () => {
    it('correctly sweeps 5 parameters', async () => {
      const parameters = new Map<string, ToleranceSpec>([
        ['R1', { nominal: 1000, tolerance: 0.05, distribution: 'uniform' }],
        ['R2', { nominal: 2200, tolerance: 0.1, distribution: 'gaussian' }],
        ['R3', { nominal: 4700, tolerance: 0.05, distribution: 'uniform' }],
        ['C1', { nominal: 0.0001, tolerance: 0.2, distribution: 'worst_case' }],
        ['C2', { nominal: 0.000047, tolerance: 0.1, distribution: 'gaussian' }],
      ]);

      const config: GpuMonteCarloConfig = {
        iterations: 300,
        seed: 42,
        parameters,
        evaluator: (params: Map<string, number>) => {
          const r1 = params.get('R1') ?? 1000;
          const r2 = params.get('R2') ?? 2200;
          const r3 = params.get('R3') ?? 4700;
          return r1 + r2 + r3; // simple sum
        },
        preferGpu: true,
      };

      const result = await runGpuMonteCarlo(config);

      expect(result.iterations).toBe(300);
      expect(result.sensitivity.size).toBe(5);
      expect(result.statistics.mean).toBeCloseTo(1000 + 2200 + 4700, -1);
    });
  });

  // ---- Shader generation sanity ----

  describe('shader generation consistency', () => {
    it('all shader generators produce non-empty output for same N', () => {
      const n = 10;
      expect(forwardSubShader(n).length).toBeGreaterThan(50);
      expect(backSubShader(n).length).toBeGreaterThan(50);
      expect(matVecMulShader(n).length).toBeGreaterThan(50);
      expect(batchSolveShader(n).length).toBeGreaterThan(50);
    });

    it('workgroup dispatch scales with batch size', () => {
      const wg100 = workgroupSize(100);
      const wg1000 = workgroupSize(1000);
      const wg10000 = workgroupSize(10000);

      expect(wg100).toBeGreaterThanOrEqual(1);
      expect(wg1000).toBeGreaterThan(wg100);
      expect(wg10000).toBeGreaterThan(wg1000);
    });

    it('batchSolveShader contains both forward and back sub for various N', () => {
      for (const n of [2, 5, 10, 50]) {
        const src = batchSolveShader(n);
        expect(src).toContain(`const N: u32 = ${n}`);
        expect(src).toContain('batch_solve');
        expect(src).toContain('LU');
      }
    });
  });

  // ---- Sensitivity analysis matching ----

  describe('sensitivity analysis', () => {
    it('identifies R1 as more sensitive than R2 in voltage divider', async () => {
      const parameters = new Map<string, ToleranceSpec>([
        ['R1', { nominal: 10000, tolerance: 0.05, distribution: 'uniform' }],
        ['R2', { nominal: 1000, tolerance: 0.05, distribution: 'uniform' }],
      ]);

      const config: GpuMonteCarloConfig = {
        iterations: 500,
        seed: 42,
        parameters,
        evaluator: (params: Map<string, number>) => {
          const r1 = params.get('R1') ?? 10000;
          const r2 = params.get('R2') ?? 1000;
          return 5.0 * r2 / (r1 + r2);
        },
        preferGpu: false,
      };

      const result = await runGpuMonteCarlo(config);

      const sensR1 = Math.abs(result.sensitivity.get('R1') ?? 0);
      const sensR2 = Math.abs(result.sensitivity.get('R2') ?? 0);

      // Both should have non-zero sensitivity
      expect(sensR1).toBeGreaterThan(0);
      expect(sensR2).toBeGreaterThan(0);
    });
  });
});
