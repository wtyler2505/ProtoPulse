/**
 * GPU Accelerator — WebGPU device management with feature detection and CPU fallback.
 *
 * Singleton that handles adapter/device lifecycle, pipeline caching, and buffer helpers.
 * When WebGPU is unavailable (or the adapter is a software fallback), all methods
 * degrade gracefully so callers can fall back to CPU codepaths.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GpuCapabilities {
  available: boolean;
  adapterInfo: string;
  maxBufferSize: number;
  maxWorkgroupSize: number;
  isFallback: boolean;
}

// ---------------------------------------------------------------------------
// WebGPU constants (numeric values per spec — avoids runtime reference to
// GPUBufferUsage / GPUMapMode which don't exist in non-browser environments)
// ---------------------------------------------------------------------------

const BUFFER_USAGE_STORAGE = 0x0080;
const BUFFER_USAGE_COPY_SRC = 0x0004;
const BUFFER_USAGE_COPY_DST = 0x0008;
const BUFFER_USAGE_MAP_READ = 0x0001;
const MAP_MODE_READ = 0x0001;

// ---------------------------------------------------------------------------
// GpuAccelerator
// ---------------------------------------------------------------------------

export class GpuAccelerator {
  // ---- Singleton ----
  private static instance: GpuAccelerator | null = null;

  static getInstance(): GpuAccelerator {
    if (!GpuAccelerator.instance) {
      GpuAccelerator.instance = new GpuAccelerator();
    }
    return GpuAccelerator.instance;
  }

  static resetInstance(): void {
    if (GpuAccelerator.instance) {
      GpuAccelerator.instance.destroy();
      GpuAccelerator.instance = null;
    }
  }

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'gpu' in navigator;
  }

  // ---- Instance state ----
  private device: GPUDevice | null = null;
  private capabilities: GpuCapabilities | null = null;
  private pipelineCache = new Map<string, GPUComputePipeline>();
  private commandEncoders: GPUCommandEncoder[] = [];

  private constructor() {
    // private — use getInstance()
  }

  // ---- Initialization ----

  async initialize(): Promise<GpuCapabilities> {
    if (this.capabilities) {
      return this.capabilities;
    }

    if (!GpuAccelerator.isSupported()) {
      this.capabilities = {
        available: false,
        adapterInfo: 'WebGPU not available',
        maxBufferSize: 0,
        maxWorkgroupSize: 0,
        isFallback: false,
      };
      return this.capabilities;
    }

    try {
      const adapter = await navigator.gpu.requestAdapter();

      if (!adapter) {
        this.capabilities = {
          available: false,
          adapterInfo: 'No adapter found',
          maxBufferSize: 0,
          maxWorkgroupSize: 0,
          isFallback: false,
        };
        return this.capabilities;
      }

      if (adapter.info?.isFallbackAdapter) {
        this.capabilities = {
          available: false,
          adapterInfo: adapter.info?.description ?? 'Fallback adapter',
          maxBufferSize: 0,
          maxWorkgroupSize: 0,
          isFallback: true,
        };
        return this.capabilities;
      }

      const device = await adapter.requestDevice();
      this.device = device;

      this.capabilities = {
        available: true,
        adapterInfo: adapter.info?.description ?? 'Unknown GPU',
        maxBufferSize: device.limits.maxStorageBufferBindingSize,
        maxWorkgroupSize: device.limits.maxComputeWorkgroupSizeX,
        isFallback: false,
      };

      return this.capabilities;
    } catch {
      this.capabilities = {
        available: false,
        adapterInfo: 'Initialization failed',
        maxBufferSize: 0,
        maxWorkgroupSize: 0,
        isFallback: false,
      };
      return this.capabilities;
    }
  }

  isReady(): boolean {
    return this.device !== null && this.capabilities !== null && this.capabilities.available;
  }

  getDevice(): GPUDevice | null {
    return this.device;
  }

  getCapabilities(): GpuCapabilities | null {
    return this.capabilities;
  }

  // ---- Pipeline Cache ----

  async getOrCreatePipeline(key: string, shaderCode: string, entryPoint: string): Promise<GPUComputePipeline> {
    if (!this.device) {
      throw new Error('GpuAccelerator not initialized — call initialize() first');
    }

    const cached = this.pipelineCache.get(key);
    if (cached) {
      return cached;
    }

    const shaderModule = this.device.createShaderModule({ code: shaderCode });
    const pipeline = await this.device.createComputePipelineAsync({
      layout: 'auto',
      compute: { module: shaderModule, entryPoint },
    });

    this.pipelineCache.set(key, pipeline);
    return pipeline;
  }

  // ---- Buffer Helpers ----

  createStorageBuffer(data: Float32Array, usage?: number): GPUBuffer {
    if (!this.device) {
      throw new Error('GpuAccelerator not initialized — call initialize() first');
    }

    const gpuUsage = usage ?? (BUFFER_USAGE_STORAGE | BUFFER_USAGE_COPY_SRC);

    const buffer = this.device.createBuffer({
      size: data.byteLength,
      usage: gpuUsage,
      mappedAtCreation: false,
    });
    this.device.queue.writeBuffer(buffer, 0, data);
    return buffer;
  }

  createReadbackBuffer(size: number): GPUBuffer {
    if (!this.device) {
      throw new Error('GpuAccelerator not initialized — call initialize() first');
    }

    return this.device.createBuffer({
      size,
      usage: BUFFER_USAGE_MAP_READ | BUFFER_USAGE_COPY_DST,
    });
  }

  async readBuffer(buffer: GPUBuffer, size: number): Promise<Float32Array> {
    await buffer.mapAsync(MAP_MODE_READ);
    const arrayBuffer = buffer.getMappedRange(0, size);
    const result = new Float32Array(new Float32Array(arrayBuffer));
    buffer.unmap();
    return result;
  }

  // ---- Dispatch ----

  dispatch(
    pipeline: GPUComputePipeline,
    bindGroup: GPUBindGroup,
    workgroups: [number, number?, number?],
  ): void {
    if (!this.device) {
      throw new Error('GpuAccelerator not initialized — call initialize() first');
    }

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(workgroups[0], workgroups[1], workgroups[2]);
    pass.end();

    this.commandEncoders.push(encoder);
  }

  async submit(): Promise<void> {
    if (!this.device) {
      throw new Error('GpuAccelerator not initialized — call initialize() first');
    }

    const commandBuffers = this.commandEncoders.map((enc) => enc.finish());
    this.device.queue.submit(commandBuffers);
    this.commandEncoders = [];
  }

  // ---- Cleanup ----

  destroy(): void {
    this.pipelineCache.clear();
    this.commandEncoders = [];
    if (this.device) {
      this.device.destroy();
      this.device = null;
    }
    this.capabilities = null;
  }
}
