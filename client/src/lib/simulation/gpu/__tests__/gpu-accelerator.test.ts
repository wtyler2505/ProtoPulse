import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GpuAccelerator } from '../gpu-accelerator';
import type { GpuCapabilities } from '../gpu-accelerator';

// ---------------------------------------------------------------------------
// WebGPU Mock Helpers
// ---------------------------------------------------------------------------

function createMockBuffer(size = 64) {
  return {
    mapAsync: vi.fn().mockResolvedValue(undefined),
    getMappedRange: vi.fn().mockReturnValue(new Float32Array(size / 4).buffer),
    unmap: vi.fn(),
    destroy: vi.fn(),
    size,
    usage: 0,
    label: '',
  };
}

function createMockCommandEncoder() {
  return {
    beginComputePass: vi.fn().mockReturnValue({
      setPipeline: vi.fn(),
      setBindGroup: vi.fn(),
      dispatchWorkgroups: vi.fn(),
      end: vi.fn(),
    }),
    copyBufferToBuffer: vi.fn(),
    finish: vi.fn().mockReturnValue({}),
  };
}

function createMockDevice() {
  return {
    createShaderModule: vi.fn().mockReturnValue({
      compilationInfo: vi.fn().mockResolvedValue({ messages: [] }),
    }),
    createComputePipelineAsync: vi.fn().mockResolvedValue({ getBindGroupLayout: vi.fn().mockReturnValue({}) }),
    createBuffer: vi.fn().mockImplementation((desc: { size: number }) => createMockBuffer(desc.size)),
    createBindGroup: vi.fn().mockReturnValue({}),
    createBindGroupLayout: vi.fn().mockReturnValue({}),
    createPipelineLayout: vi.fn().mockReturnValue({}),
    createCommandEncoder: vi.fn().mockReturnValue(createMockCommandEncoder()),
    queue: { writeBuffer: vi.fn(), submit: vi.fn() },
    destroy: vi.fn(),
    limits: {
      maxStorageBufferBindingSize: 134217728,
      maxComputeWorkgroupSizeX: 256,
    },
  };
}

function createMockAdapter(device: ReturnType<typeof createMockDevice>, isFallback = false) {
  return {
    requestDevice: vi.fn().mockResolvedValue(device),
    info: { description: 'Mock GPU', vendor: 'TestVendor', isFallbackAdapter: isFallback },
  };
}

function installMockGpu(adapter: ReturnType<typeof createMockAdapter>) {
  Object.defineProperty(navigator, 'gpu', {
    value: { requestAdapter: vi.fn().mockResolvedValue(adapter) },
    configurable: true,
    writable: true,
  });
}

function removeMockGpu() {
  if ('gpu' in navigator) {
    delete (navigator as unknown as Record<string, unknown>).gpu;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GpuAccelerator', () => {
  beforeEach(() => {
    GpuAccelerator.resetInstance();
    removeMockGpu();
  });

  afterEach(() => {
    GpuAccelerator.resetInstance();
    removeMockGpu();
  });

  // ---- Singleton ----

  describe('singleton', () => {
    it('returns the same instance', () => {
      const a = GpuAccelerator.getInstance();
      const b = GpuAccelerator.getInstance();
      expect(a).toBe(b);
    });

    it('returns a fresh instance after resetInstance()', () => {
      const a = GpuAccelerator.getInstance();
      GpuAccelerator.resetInstance();
      const b = GpuAccelerator.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // ---- Feature Detection ----

  describe('isSupported', () => {
    it('returns false when navigator.gpu is absent', () => {
      removeMockGpu();
      expect(GpuAccelerator.isSupported()).toBe(false);
    });

    it('returns true when navigator.gpu exists', () => {
      const device = createMockDevice();
      const adapter = createMockAdapter(device);
      installMockGpu(adapter);
      expect(GpuAccelerator.isSupported()).toBe(true);
    });
  });

  // ---- Initialization ----

  describe('initialize', () => {
    it('returns unavailable capabilities when WebGPU absent', async () => {
      removeMockGpu();
      const acc = GpuAccelerator.getInstance();
      const caps = await acc.initialize();
      expect(caps.available).toBe(false);
      expect(acc.isReady()).toBe(false);
      expect(acc.getDevice()).toBeNull();
    });

    it('initializes successfully with mock WebGPU', async () => {
      const device = createMockDevice();
      const adapter = createMockAdapter(device);
      installMockGpu(adapter);

      const acc = GpuAccelerator.getInstance();
      const caps = await acc.initialize();

      expect(caps.available).toBe(true);
      expect(caps.adapterInfo).toContain('Mock GPU');
      expect(caps.maxBufferSize).toBe(134217728);
      expect(caps.maxWorkgroupSize).toBe(256);
      expect(caps.isFallback).toBe(false);
      expect(acc.isReady()).toBe(true);
      expect(acc.getDevice()).toBe(device);
    });

    it('rejects fallback (software) adapter', async () => {
      const device = createMockDevice();
      const adapter = createMockAdapter(device, true);
      installMockGpu(adapter);

      const acc = GpuAccelerator.getInstance();
      const caps = await acc.initialize();

      expect(caps.available).toBe(false);
      expect(caps.isFallback).toBe(true);
      expect(acc.isReady()).toBe(false);
    });

    it('handles requestAdapter returning null', async () => {
      Object.defineProperty(navigator, 'gpu', {
        value: { requestAdapter: vi.fn().mockResolvedValue(null) },
        configurable: true,
        writable: true,
      });

      const acc = GpuAccelerator.getInstance();
      const caps = await acc.initialize();

      expect(caps.available).toBe(false);
      expect(acc.isReady()).toBe(false);
    });

    it('handles requestDevice throwing', async () => {
      const adapter = {
        requestDevice: vi.fn().mockRejectedValue(new Error('Device lost')),
        info: { description: 'Bad GPU', vendor: 'Test', isFallbackAdapter: false },
      };
      installMockGpu(adapter as unknown as ReturnType<typeof createMockAdapter>);

      const acc = GpuAccelerator.getInstance();
      const caps = await acc.initialize();

      expect(caps.available).toBe(false);
      expect(acc.isReady()).toBe(false);
    });

    it('returns cached capabilities on second call', async () => {
      const device = createMockDevice();
      const adapter = createMockAdapter(device);
      installMockGpu(adapter);

      const acc = GpuAccelerator.getInstance();
      const caps1 = await acc.initialize();
      const caps2 = await acc.initialize();

      expect(caps1).toEqual(caps2);
      // requestAdapter called only once
      expect((navigator.gpu as unknown as { requestAdapter: ReturnType<typeof vi.fn> }).requestAdapter).toHaveBeenCalledTimes(1);
    });
  });

  // ---- Pipeline Caching ----

  describe('getOrCreatePipeline', () => {
    it('creates a pipeline and caches it', async () => {
      const device = createMockDevice();
      const adapter = createMockAdapter(device);
      installMockGpu(adapter);

      const acc = GpuAccelerator.getInstance();
      await acc.initialize();

      const pipeline1 = await acc.getOrCreatePipeline('test-shader', '@compute fn main() {}', 'main');
      const pipeline2 = await acc.getOrCreatePipeline('test-shader', '@compute fn main() {}', 'main');

      expect(pipeline1).toBe(pipeline2);
      expect(device.createComputePipelineAsync).toHaveBeenCalledTimes(1);
    });

    it('creates different pipelines for different keys', async () => {
      const device = createMockDevice();
      let callCount = 0;
      device.createComputePipelineAsync = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({ getBindGroupLayout: vi.fn().mockReturnValue({}), id: callCount });
      });
      const adapter = createMockAdapter(device);
      installMockGpu(adapter);

      const acc = GpuAccelerator.getInstance();
      await acc.initialize();

      const p1 = await acc.getOrCreatePipeline('shader-a', 'code-a', 'main');
      const p2 = await acc.getOrCreatePipeline('shader-b', 'code-b', 'main');

      expect(p1).not.toBe(p2);
      expect(device.createComputePipelineAsync).toHaveBeenCalledTimes(2);
    });

    it('throws when device not initialized', async () => {
      const acc = GpuAccelerator.getInstance();
      await expect(acc.getOrCreatePipeline('key', 'code', 'main')).rejects.toThrow('not initialized');
    });
  });

  // ---- Buffer Operations ----

  describe('buffer operations', () => {
    it('createStorageBuffer creates a buffer with correct size', async () => {
      const device = createMockDevice();
      const adapter = createMockAdapter(device);
      installMockGpu(adapter);

      const acc = GpuAccelerator.getInstance();
      await acc.initialize();

      const data = new Float32Array([1, 2, 3, 4]);
      const buffer = acc.createStorageBuffer(data);

      expect(device.createBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          size: data.byteLength,
        }),
      );
      expect(device.queue.writeBuffer).toHaveBeenCalledWith(buffer, 0, data);
    });

    it('createReadbackBuffer creates a MAP_READ buffer', async () => {
      const device = createMockDevice();
      const adapter = createMockAdapter(device);
      installMockGpu(adapter);

      const acc = GpuAccelerator.getInstance();
      await acc.initialize();

      acc.createReadbackBuffer(256);

      expect(device.createBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          size: 256,
        }),
      );
    });

    it('readBuffer maps, reads, and unmaps', async () => {
      const device = createMockDevice();
      const adapter = createMockAdapter(device);
      installMockGpu(adapter);

      const acc = GpuAccelerator.getInstance();
      await acc.initialize();

      const mockBuf = createMockBuffer(16);
      const result = await acc.readBuffer(mockBuf as unknown as GPUBuffer, 16);

      expect(mockBuf.mapAsync).toHaveBeenCalled();
      expect(mockBuf.getMappedRange).toHaveBeenCalledWith(0, 16);
      expect(mockBuf.unmap).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(4);
    });

    it('createStorageBuffer throws when not initialized', () => {
      const acc = GpuAccelerator.getInstance();
      expect(() => acc.createStorageBuffer(new Float32Array([1]))).toThrow('not initialized');
    });

    it('createReadbackBuffer throws when not initialized', () => {
      const acc = GpuAccelerator.getInstance();
      expect(() => acc.createReadbackBuffer(64)).toThrow('not initialized');
    });
  });

  // ---- Dispatch ----

  describe('dispatch and submit', () => {
    it('dispatches compute workgroups and submits', async () => {
      const device = createMockDevice();
      const encoder = createMockCommandEncoder();
      device.createCommandEncoder = vi.fn().mockReturnValue(encoder);
      const adapter = createMockAdapter(device);
      installMockGpu(adapter);

      const acc = GpuAccelerator.getInstance();
      await acc.initialize();

      const mockPipeline = {} as GPUComputePipeline;
      const mockBindGroup = {} as GPUBindGroup;

      acc.dispatch(mockPipeline, mockBindGroup, [16]);

      const pass = encoder.beginComputePass.mock.results[0].value;
      expect(pass.setPipeline).toHaveBeenCalledWith(mockPipeline);
      expect(pass.setBindGroup).toHaveBeenCalledWith(0, mockBindGroup);
      expect(pass.dispatchWorkgroups).toHaveBeenCalledWith(16, undefined, undefined);
      expect(pass.end).toHaveBeenCalled();
    });

    it('submit sends command buffer to queue', async () => {
      const device = createMockDevice();
      const encoder = createMockCommandEncoder();
      device.createCommandEncoder = vi.fn().mockReturnValue(encoder);
      const adapter = createMockAdapter(device);
      installMockGpu(adapter);

      const acc = GpuAccelerator.getInstance();
      await acc.initialize();

      const mockPipeline = {} as GPUComputePipeline;
      const mockBindGroup = {} as GPUBindGroup;

      acc.dispatch(mockPipeline, mockBindGroup, [8, 4]);
      await acc.submit();

      expect(encoder.finish).toHaveBeenCalled();
      expect(device.queue.submit).toHaveBeenCalled();
    });

    it('dispatch throws when not initialized', () => {
      const acc = GpuAccelerator.getInstance();
      expect(() => acc.dispatch({} as GPUComputePipeline, {} as GPUBindGroup, [1])).toThrow('not initialized');
    });
  });

  // ---- Destroy ----

  describe('destroy', () => {
    it('destroys device and resets state', async () => {
      const device = createMockDevice();
      const adapter = createMockAdapter(device);
      installMockGpu(adapter);

      const acc = GpuAccelerator.getInstance();
      await acc.initialize();
      expect(acc.isReady()).toBe(true);

      acc.destroy();
      expect(device.destroy).toHaveBeenCalled();
      expect(acc.isReady()).toBe(false);
      expect(acc.getDevice()).toBeNull();
    });

    it('destroy is safe to call when not initialized', () => {
      const acc = GpuAccelerator.getInstance();
      expect(() => acc.destroy()).not.toThrow();
    });
  });

  // ---- getCapabilities ----

  describe('getCapabilities', () => {
    it('returns null before initialization', () => {
      const acc = GpuAccelerator.getInstance();
      expect(acc.getCapabilities()).toBeNull();
    });

    it('returns capabilities after initialization', async () => {
      const device = createMockDevice();
      const adapter = createMockAdapter(device);
      installMockGpu(adapter);

      const acc = GpuAccelerator.getInstance();
      await acc.initialize();
      const caps = acc.getCapabilities();

      expect(caps).not.toBeNull();
      expect(caps!.available).toBe(true);
    });
  });
});
