import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  GpuMonteCarloEngine,
} from '../gpu-monte-carlo';
import type {
  GpuMonteCarloConfig,
} from '../gpu-monte-carlo';
import type { ToleranceSpec } from '../../monte-carlo';
import { GpuAccelerator } from '../gpu-accelerator';

// ---------------------------------------------------------------------------
// Mock WebGPU types
// ---------------------------------------------------------------------------

interface MockGPUBuffer {
  size: number;
  usage: number;
  mapAsync: ReturnType<typeof vi.fn>;
  getMappedRange: ReturnType<typeof vi.fn>;
  unmap: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

interface MockGPUDevice {
  createBuffer: ReturnType<typeof vi.fn>;
  createShaderModule: ReturnType<typeof vi.fn>;
  createComputePipelineAsync: ReturnType<typeof vi.fn>;
  createComputePipeline: ReturnType<typeof vi.fn>;
  createBindGroup: ReturnType<typeof vi.fn>;
  createCommandEncoder: ReturnType<typeof vi.fn>;
  queue: {
    submit: ReturnType<typeof vi.fn>;
    writeBuffer: ReturnType<typeof vi.fn>;
    onSubmittedWorkDone: ReturnType<typeof vi.fn>;
  };
  destroy: ReturnType<typeof vi.fn>;
  limits: {
    maxStorageBufferBindingSize: number;
    maxComputeWorkgroupSizeX: number;
  };
}

interface MockGPUAdapter {
  requestDevice: ReturnType<typeof vi.fn>;
  info: {
    description: string;
    isFallbackAdapter: boolean;
  };
}

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
      return 5.0 / r1 * 1000;
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

function createMockBuffer(data?: Float32Array): MockGPUBuffer {
  const arrayBuffer = data ? data.buffer.slice(0) : new ArrayBuffer(16);
  return {
    size: data ? data.byteLength : 16,
    usage: 0,
    mapAsync: vi.fn().mockResolvedValue(undefined),
    getMappedRange: vi.fn().mockReturnValue(arrayBuffer),
    unmap: vi.fn(),
    destroy: vi.fn(),
  };
}

function createMockDevice(): MockGPUDevice {
  return {
    createBuffer: vi.fn().mockImplementation(() => createMockBuffer()),
    createShaderModule: vi.fn().mockReturnValue({ label: 'mock-shader' }),
    createComputePipelineAsync: vi.fn().mockResolvedValue({ label: 'mock-pipeline' }),
    createComputePipeline: vi.fn().mockReturnValue({ label: 'mock-pipeline' }),
    createBindGroup: vi.fn().mockReturnValue({ label: 'mock-bind-group' }),
    createCommandEncoder: vi.fn().mockReturnValue({
      beginComputePass: vi.fn().mockReturnValue({
        setPipeline: vi.fn(),
        setBindGroup: vi.fn(),
        dispatchWorkgroups: vi.fn(),
        end: vi.fn(),
      }),
      copyBufferToBuffer: vi.fn(),
      finish: vi.fn().mockReturnValue({ label: 'mock-command-buffer' }),
    }),
    queue: {
      submit: vi.fn(),
      writeBuffer: vi.fn(),
      onSubmittedWorkDone: vi.fn().mockResolvedValue(undefined),
    },
    destroy: vi.fn(),
    limits: {
      maxStorageBufferBindingSize: 134217728,
      maxComputeWorkgroupSizeX: 256,
    },
  };
}

function createMockAdapter(device?: MockGPUDevice): MockGPUAdapter {
  return {
    requestDevice: vi.fn().mockResolvedValue(device ?? createMockDevice()),
    info: {
      description: 'Mock GPU Adapter',
      isFallbackAdapter: false,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GpuMonteCarloEngine', () => {
  beforeEach(() => {
    GpuAccelerator.resetInstance();
  });

  afterEach(() => {
    GpuAccelerator.resetInstance();
    // Clean up navigator.gpu mock
    if ('gpu' in navigator) {
      (navigator as unknown as Record<string, unknown>).gpu = undefined;
    }
  });

  // ---- Constructor and lifecycle ----

  describe('constructor and lifecycle', () => {
    it('creates an engine instance', () => {
      const engine = new GpuMonteCarloEngine();
      expect(engine).toBeDefined();
    });

    it('is not ready before init', () => {
      const engine = new GpuMonteCarloEngine();
      expect(engine.isReady()).toBe(false);
    });

    it('init returns false when WebGPU is unavailable', async () => {
      const engine = new GpuMonteCarloEngine();
      const ready = await engine.init();
      expect(ready).toBe(false);
      expect(engine.isReady()).toBe(false);
    });

    it('init returns true when WebGPU is available', async () => {
      const device = createMockDevice();
      const adapter = createMockAdapter(device);
      (navigator as unknown as Record<string, unknown>).gpu = {
        requestAdapter: vi.fn().mockResolvedValue(adapter),
      };

      const engine = new GpuMonteCarloEngine();
      const ready = await engine.init();
      expect(ready).toBe(true);
      expect(engine.isReady()).toBe(true);
    });

    it('dispose cleans up resources', async () => {
      const engine = new GpuMonteCarloEngine();
      // Should not throw even if not initialized
      engine.dispose();
      expect(engine.isReady()).toBe(false);
    });

    it('dispose after init resets ready state', async () => {
      const device = createMockDevice();
      const adapter = createMockAdapter(device);
      (navigator as unknown as Record<string, unknown>).gpu = {
        requestAdapter: vi.fn().mockResolvedValue(adapter),
      };

      const engine = new GpuMonteCarloEngine();
      await engine.init();
      expect(engine.isReady()).toBe(true);

      engine.dispose();
      expect(engine.isReady()).toBe(false);
    });
  });

  // ---- Retry logic ----

  describe('adapter retry logic', () => {
    it('retries adapter request on failure', async () => {
      const requestAdapter = vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createMockAdapter());

      (navigator as unknown as Record<string, unknown>).gpu = { requestAdapter };

      const engine = new GpuMonteCarloEngine();
      const ready = await engine.init();

      expect(ready).toBe(true);
      expect(requestAdapter).toHaveBeenCalledTimes(3);
    });

    it('gives up after 3 failed attempts', async () => {
      const requestAdapter = vi.fn().mockResolvedValue(null);
      (navigator as unknown as Record<string, unknown>).gpu = { requestAdapter };

      const engine = new GpuMonteCarloEngine();
      const ready = await engine.init();

      expect(ready).toBe(false);
      expect(requestAdapter).toHaveBeenCalledTimes(3);
    });

    it('retries on requestAdapter exception', async () => {
      const adapter = createMockAdapter();
      const requestAdapter = vi.fn()
        .mockRejectedValueOnce(new Error('GPU busy'))
        .mockResolvedValueOnce(adapter);

      (navigator as unknown as Record<string, unknown>).gpu = { requestAdapter };

      const engine = new GpuMonteCarloEngine();
      const ready = await engine.init();

      expect(ready).toBe(true);
      expect(requestAdapter).toHaveBeenCalledTimes(2);
    });

    it('rejects fallback adapters', async () => {
      const adapter = createMockAdapter();
      adapter.info.isFallbackAdapter = true;
      const requestAdapter = vi.fn().mockResolvedValue(adapter);
      (navigator as unknown as Record<string, unknown>).gpu = { requestAdapter };

      const engine = new GpuMonteCarloEngine();
      const ready = await engine.init();

      expect(ready).toBe(false);
    });
  });

  // ---- run() CPU fallback ----

  describe('run() CPU fallback', () => {
    it('falls back to CPU when not initialized', async () => {
      const engine = new GpuMonteCarloEngine();
      const result = await engine.run(simpleConfig());

      expect(result.accelerated).toBe(false);
      expect(result.iterations).toBe(100);
      expect(result.values).toHaveLength(100);
      expect(result.cpuTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.speedup).toBe(1);
    });

    it('falls back to CPU when preferGpu is false', async () => {
      const engine = new GpuMonteCarloEngine();
      const result = await engine.run(simpleConfig({ preferGpu: false }));

      expect(result.accelerated).toBe(false);
    });

    it('produces deterministic results with same seed', async () => {
      const engine = new GpuMonteCarloEngine();
      const r1 = await engine.run(simpleConfig({ seed: 77 }));
      const r2 = await engine.run(simpleConfig({ seed: 77 }));

      expect(r1.values).toEqual(r2.values);
      expect(r1.statistics.mean).toBe(r2.statistics.mean);
    });

    it('produces different results with different seeds', async () => {
      const engine = new GpuMonteCarloEngine();
      const r1 = await engine.run(simpleConfig({ seed: 1 }));
      const r2 = await engine.run(simpleConfig({ seed: 2 }));

      expect(r1.statistics.mean).not.toBe(r2.statistics.mean);
    });

    it('computes statistics for multi-parameter config', async () => {
      const engine = new GpuMonteCarloEngine();
      const result = await engine.run(multiParamConfig());

      expect(result.iterations).toBe(200);
      expect(result.values).toHaveLength(200);
      expect(result.sensitivity.size).toBe(3);
      expect(result.histogram.length).toBeGreaterThan(0);
    });

    it('handles single iteration', async () => {
      const engine = new GpuMonteCarloEngine();
      const result = await engine.run(simpleConfig({ iterations: 1 }));

      expect(result.values).toHaveLength(1);
      expect(result.statistics.mean).toBe(result.values[0]);
    });
  });

  // ---- run() GPU path (mocked) ----

  describe('run() with GPU available', () => {
    let mockDevice: MockGPUDevice;

    beforeEach(() => {
      mockDevice = createMockDevice();
      const adapter = createMockAdapter(mockDevice);
      (navigator as unknown as Record<string, unknown>).gpu = {
        requestAdapter: vi.fn().mockResolvedValue(adapter),
      };
    });

    it('uses GPU path when initialized and preferGpu is true', async () => {
      const engine = new GpuMonteCarloEngine();
      await engine.init();
      const result = await engine.run(simpleConfig());

      // Still runs evaluator on CPU since evaluator is JS, but uses GPU infrastructure
      expect(result.iterations).toBe(100);
      expect(result.values).toHaveLength(100);
      expect(result.statistics.mean).toBeGreaterThan(0);
      expect(typeof result.gpuTimeMs).toBe('number');
    });

    it('falls back to CPU even with GPU init when preferGpu is false', async () => {
      const engine = new GpuMonteCarloEngine();
      await engine.init();
      const result = await engine.run(simpleConfig({ preferGpu: false }));

      expect(result.accelerated).toBe(false);
      expect(result.speedup).toBe(1);
    });

    it('reports timing metrics', async () => {
      const engine = new GpuMonteCarloEngine();
      await engine.init();
      const result = await engine.run(simpleConfig({ iterations: 50 }));

      expect(typeof result.gpuTimeMs).toBe('number');
      expect(typeof result.cpuTimeMs).toBe('number');
      expect(typeof result.speedup).toBe('number');
      expect(result.gpuTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.cpuTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('produces correct statistics on GPU path', async () => {
      const engine = new GpuMonteCarloEngine();
      await engine.init();
      const result = await engine.run(simpleConfig({ iterations: 500, seed: 42 }));

      expect(result.statistics.mean).toBeGreaterThan(0.4);
      expect(result.statistics.mean).toBeLessThan(0.6);
      expect(result.statistics.stdDev).toBeGreaterThan(0);
      expect(result.statistics.min).toBeLessThanOrEqual(result.statistics.mean);
      expect(result.statistics.max).toBeGreaterThanOrEqual(result.statistics.mean);
    });

    it('produces histogram on GPU path', async () => {
      const engine = new GpuMonteCarloEngine();
      await engine.init();
      const result = await engine.run(simpleConfig({ iterations: 200 }));

      expect(result.histogram.length).toBeGreaterThan(0);
      const totalCount = result.histogram.reduce((sum, bin) => sum + bin.count, 0);
      expect(totalCount).toBe(200);
    });

    it('computes sensitivity on GPU path', async () => {
      const engine = new GpuMonteCarloEngine();
      await engine.init();
      const result = await engine.run(simpleConfig());

      expect(result.sensitivity.size).toBe(1);
      expect(result.sensitivity.has('R1')).toBe(true);
    });
  });

  // ---- Edge cases ----

  describe('edge cases', () => {
    it('handles zero-tolerance parameter', async () => {
      const engine = new GpuMonteCarloEngine();
      const parameters = new Map<string, ToleranceSpec>([
        ['R1', { nominal: 1000, tolerance: 0, distribution: 'uniform' }],
      ]);
      const result = await engine.run(simpleConfig({ parameters }));

      const uniqueValues = new Set(result.values);
      expect(uniqueValues.size).toBe(1);
    });

    it('handles large iteration count', async () => {
      const engine = new GpuMonteCarloEngine();
      const result = await engine.run(simpleConfig({ iterations: 5000 }));

      expect(result.values).toHaveLength(5000);
      expect(result.statistics.mean).toBeGreaterThan(0);
    });

    it('gaussian distribution stays within bounds', async () => {
      const engine = new GpuMonteCarloEngine();
      const parameters = new Map<string, ToleranceSpec>([
        ['R1', { nominal: 10000, tolerance: 0.05, distribution: 'gaussian' }],
      ]);
      const result = await engine.run(simpleConfig({ parameters, iterations: 1000 }));

      const nominalOutput = 5.0 / 10000 * 1000;
      for (const v of result.values) {
        expect(v).toBeGreaterThan(nominalOutput * 0.5);
        expect(v).toBeLessThan(nominalOutput * 1.5);
      }
    });

    it('worst_case distribution produces only extreme values', async () => {
      const engine = new GpuMonteCarloEngine();
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
      const result = await engine.run(config);

      const low = 1000 * (1 - 0.1);
      const high = 1000 * (1 + 0.1);
      for (const v of result.values) {
        expect(v === low || v === high).toBe(true);
      }
    });

    it('can run multiple analyses sequentially', async () => {
      const engine = new GpuMonteCarloEngine();
      const r1 = await engine.run(simpleConfig({ seed: 10 }));
      const r2 = await engine.run(multiParamConfig({ seed: 20 }));

      expect(r1.values).toHaveLength(100);
      expect(r2.values).toHaveLength(200);
    });

    it('can re-init after dispose', async () => {
      const device = createMockDevice();
      const adapter = createMockAdapter(device);
      (navigator as unknown as Record<string, unknown>).gpu = {
        requestAdapter: vi.fn().mockResolvedValue(adapter),
      };

      const engine = new GpuMonteCarloEngine();
      await engine.init();
      expect(engine.isReady()).toBe(true);

      engine.dispose();
      expect(engine.isReady()).toBe(false);

      // Re-init should work
      GpuAccelerator.resetInstance();
      const ready = await engine.init();
      expect(ready).toBe(true);
    });
  });
});
