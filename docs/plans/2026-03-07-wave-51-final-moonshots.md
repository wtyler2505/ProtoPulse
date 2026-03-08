# Wave 51: Final Moonshots — IN-23 + IN-24 + IN-26

> **For Claude:** Use `/agent-teams` to implement this plan. 3 teammates, one per feature, with file ownership boundaries.

**Goal:** Complete the final 3 checklist items (163/166 → 166/166, 100%) — generative circuit design, WebGPU-accelerated simulation, and digital twin with IoT feedback.

**Architecture:** Three independent feature modules, each following singleton+subscribe pattern with React hooks. No shared file conflicts between teammates. Integration into ProjectWorkspace/Sidebar/command-palette done by lead after teammates complete.

**Tech Stack:** React 19 + TypeScript 5.6 + WebGPU (WGSL compute shaders) + uPlot (time-series charts) + Web Workers + Zod + Vitest

---

## Research Summary

### WebGPU (IN-24)
- Monte Carlo batch dispatch is the highest-value GPU target (~10x speedup for 1000+ iterations)
- Factor MNA on CPU, upload L/U once, dispatch all forward/back-sub solves in a single batch
- Single MNA solves: CPU faster for n<500 (GPU overhead dominates)
- WebGPU works from Web Workers (`WorkerNavigator.gpu`)
- f32 only in WGSL (no f64) — acceptable for Monte Carlo tolerance analysis
- Feature detection: `navigator.gpu` → `requestAdapter()` → `requestDevice()`, fallback to CPU
- Browser support ~70-75% desktop (Chrome/Edge 113+, Firefox 141+, Safari 26+)
- TypeGPU for type-safe WGSL, `@webgpu/types` for TypeScript types

### Generative Design (IN-23)
- Practical approach: AI generates N circuit candidates from spec → fitness scoring → evolutionary refinement
- CircuitIR as genome representation (already Zod-validated, maps to schema)
- Fitness functions from existing engines: DRC violations, component count/cost, power consumption, thermal rating
- Mutation operators: component value changes, topology changes (add/remove/swap components), net rewiring
- AI-guided crossover: Claude/Gemini proposes mutations informed by fitness scores

### Digital Twin (IN-26)
- JSON Lines protocol over serial (manifest on connect, telemetry at 10-50 Hz)
- Device Shadow pattern (reported/desired/delta) from AWS IoT, adapted for local serial
- SVG overlay: LED glow (feGaussianBlur), current flow dots (stroke-dashoffset animation), voltage color gradients
- Comparison mode: sim vs actual with 5%/20% deviation thresholds
- IndexedDB ring buffer for data logging (batch writes, 7-day retention)
- uPlot for time-series charts (50KB, 10% CPU at 3600pts/60fps)
- Firmware helper library: ~200 lines Arduino/ESP32, zero external deps

---

## Existing Infrastructure

| Module | File | Relevance |
|--------|------|-----------|
| Circuit IR | `client/src/lib/circuit-dsl/circuit-ir.ts` | Genome representation for IN-23 |
| Circuit API | `client/src/lib/circuit-dsl/circuit-api.ts` | Fluent builder for candidate generation |
| Code generator | `client/src/lib/circuit-dsl/code-generator.ts` | IR → DSL round-trip |
| Circuit solver | `client/src/lib/simulation/circuit-solver.ts` | MNA matrix + Gaussian elimination (GPU target) |
| Monte Carlo | `client/src/lib/simulation/monte-carlo.ts` | Primary GPU acceleration target |
| Transient analysis | `client/src/lib/simulation/transient-analysis.ts` | Secondary GPU acceleration target |
| DC analysis | `client/src/lib/simulation/dc-analysis.ts` | Fitness scoring for IN-23 |
| AC analysis | `client/src/lib/simulation/ac-analysis.ts` | Fitness scoring for IN-23 |
| Thermal analysis | `client/src/lib/simulation/thermal-analysis.ts` | Fitness scoring for IN-23 |
| SI advisor | `client/src/lib/simulation/si-advisor.ts` | Fitness scoring for IN-23 |
| DRC engine | `shared/drc-engine.ts` | Fitness scoring for IN-23 |
| Web Serial | `client/src/lib/web-serial.ts` | Foundation for IN-26 |
| Serial Monitor | `client/src/components/panels/SerialMonitorPanel.tsx` | Reference for IN-26 UI |
| Standard library | `shared/standard-library.ts` | Component catalog for candidate generation |
| ViewMode union | `client/src/lib/project-context.tsx:107` | Add 'generative_design', 'digital_twin' |
| ProjectWorkspace | `client/src/pages/ProjectWorkspace.tsx` | Wire new views (lead does this) |

---

## Phase Overview

| Phase | Description | Teammates | Dependencies |
|-------|-------------|-----------|--------------|
| **Phase 1** | Core libraries + views + tests (parallel) | 3 teammates | None — independent features |
| **Phase 2** | Integration wiring (sequential — lead) | Lead only | Phase 1 complete |

---

## Feature A: Generative Circuit Design (IN-23)

### Teammate: `generative-design`

**Owns (create):**
- `client/src/lib/generative-design/fitness-scorer.ts`
- `client/src/lib/generative-design/circuit-mutator.ts`
- `client/src/lib/generative-design/generative-engine.ts`
- `client/src/lib/generative-design/__tests__/fitness-scorer.test.ts`
- `client/src/lib/generative-design/__tests__/circuit-mutator.test.ts`
- `client/src/lib/generative-design/__tests__/generative-engine.test.ts`
- `client/src/components/views/GenerativeDesignView.tsx`
- `client/src/components/views/__tests__/GenerativeDesignView.test.tsx`
- `server/ai-tools/generative.ts`
- `server/__tests__/ai-tools-generative.test.ts`

**Owns (modify):**
- `server/ai-tools/index.ts` — register generative tools

**Must NOT touch:**
- `ProjectWorkspace.tsx`, `project-context.tsx`, `sidebar-constants.ts`, `command-palette.tsx`
- Any files owned by other teammates

### Task A1: Fitness Scorer

**Files:** Create `client/src/lib/generative-design/fitness-scorer.ts` + test

**Context:** Multi-criteria fitness evaluation for circuit candidates. Scores a CircuitIR on: component count, estimated cost, DRC violations, power budget compliance, thermal margin. Each criterion returns 0-1 (1 = best). Weighted sum produces overall fitness 0-1.

**Interface:**
```typescript
interface FitnessCriteria {
  componentCount: { weight: number; maxOptimal: number; maxAcceptable: number };
  estimatedCost: { weight: number; budgetUsd: number };
  drcViolations: { weight: number }; // 0 violations = 1.0, each violation reduces score
  powerBudget: { weight: number; maxWatts: number };
  thermalMargin: { weight: number; maxTempC: number };
}

interface FitnessResult {
  overall: number; // weighted 0-1
  breakdown: Record<string, { score: number; weight: number; detail: string }>;
  violations: string[];
  rank: number; // assigned during comparison
}

function scoreCircuit(ir: CircuitIR, criteria: FitnessCriteria): FitnessResult;
function rankCandidates(results: FitnessResult[]): FitnessResult[]; // sorts by overall desc
function defaultCriteria(): FitnessCriteria; // sensible defaults for makers
```

**Tests (~25):** Score empty circuit, single resistor, complex circuit, DRC penalty, cost over budget, thermal limit, ranking order, weight normalization, edge cases.

### Task A2: Circuit Mutator

**Files:** Create `client/src/lib/generative-design/circuit-mutator.ts` + test

**Context:** Mutation and crossover operators for evolving CircuitIR candidates. Mutations: change component values (within tolerance), swap component types (resistor ↔ different value), add/remove bypass capacitors, add/remove protection diodes, change net topology. Crossover: merge subsections of two parent IRs. Uses seeded PRNG (mulberry32) for reproducibility.

**Interface:**
```typescript
type MutationType = 'value_change' | 'component_swap' | 'add_bypass_cap' | 'add_protection' | 'remove_component' | 'rewire_net';

interface MutationConfig {
  seed: number;
  mutationRate: number; // 0-1, probability of mutating each component
  allowedMutations: MutationType[];
}

function mutateCircuit(ir: CircuitIR, config: MutationConfig): CircuitIR;
function crossover(parent1: CircuitIR, parent2: CircuitIR, seed: number): CircuitIR;
function generateVariant(base: CircuitIR, spec: string, seed: number): CircuitIR; // AI-informed mutation
```

**Tests (~30):** Value mutation bounds, component swap preserves net connections, bypass cap placement near power pins, protection diode on inputs, remove component updates nets, crossover merges correctly, seeded reproducibility, empty circuit handling, spec-guided variant.

### Task A3: Generative Engine

**Files:** Create `client/src/lib/generative-design/generative-engine.ts` + test

**Context:** Orchestrates the generative design loop. Singleton+subscribe pattern. Takes a design specification (text + constraints), generates N initial candidates (via AI tool or template-based), scores them, evolves top candidates through mutation/crossover, presents ranked results. Supports async iteration with progress callbacks.

**Interface:**
```typescript
interface DesignSpec {
  description: string; // "LED driver circuit for 12V, 350mA"
  constraints: FitnessCriteria;
  populationSize: number; // default 6
  generations: number; // default 5
  seed?: number;
}

interface GenerationResult {
  generation: number;
  candidates: Array<{ ir: CircuitIR; fitness: FitnessResult; id: string }>;
  bestFitness: number;
  averageFitness: number;
}

type EngineState = 'idle' | 'generating' | 'scoring' | 'evolving' | 'complete';

class GenerativeDesignEngine {
  static getInstance(): GenerativeDesignEngine;
  getState(): EngineState;
  subscribe(cb: () => void): () => void;

  async run(spec: DesignSpec): AsyncGenerator<GenerationResult>;
  cancel(): void;
  getResults(): GenerationResult[];
  getBestCandidate(): { ir: CircuitIR; fitness: FitnessResult } | null;
}

function useGenerativeDesign(): { state, results, run, cancel, best };
```

**Tests (~25):** Engine lifecycle, single generation, multi-generation improvement, cancel mid-run, best candidate selection, population size enforcement, subscribe/unsubscribe, progress tracking, empty spec handling.

### Task A4: GenerativeDesignView

**Files:** Create `client/src/components/views/GenerativeDesignView.tsx` + test

**Context:** Split-pane UI. Left side: design spec input (textarea for description, sliders for constraints — budget, power, temperature), population/generation controls, "Generate" button, progress indicator. Right side: candidate cards in a grid (2x3), each showing: mini schematic preview (reuse `irToSchematicLayout` from circuit-dsl), fitness score bar, component count, estimated cost. Click card to expand details. "Evolve" button to run next generation. "Apply" button to import best candidate into circuit editor.

**Tests (~15):** Renders spec form, generates candidates on submit, displays candidate cards, shows fitness scores, evolve button triggers next generation, apply imports to editor, cancel stops generation, loading states, empty state.

### Task A5: AI Generative Tool

**Files:** Create `server/ai-tools/generative.ts` + test, modify `server/ai-tools/index.ts`

**Context:** Register `generate_circuit_candidates` AI tool. Given a text description + constraints, generates N CircuitIR candidates as JSON. Uses the AI model to propose circuit topologies, then returns structured IR. Also register `explain_design_tradeoffs` tool that analyzes fitness results and explains why certain candidates score better.

**Tests (~15):** Tool registration, input validation, output IR schema validation, constraint forwarding, explanation generation.

---

## Feature B: WebGPU-Accelerated Simulation (IN-24)

### Teammate: `webgpu-sim`

**Owns (create):**
- `client/src/lib/simulation/gpu/gpu-accelerator.ts`
- `client/src/lib/simulation/gpu/gpu-monte-carlo.ts`
- `client/src/lib/simulation/gpu/shaders.ts`
- `client/src/lib/simulation/gpu/__tests__/gpu-accelerator.test.ts`
- `client/src/lib/simulation/gpu/__tests__/gpu-monte-carlo.test.ts`
- `client/src/lib/simulation/gpu/__tests__/shaders.test.ts`
- `client/src/lib/simulation/gpu/__tests__/gpu-integration.test.ts`

**Must NOT touch:**
- Existing simulation files (circuit-solver.ts, monte-carlo.ts, transient-analysis.ts) — read-only reference
- `ProjectWorkspace.tsx`, `project-context.tsx`, `sidebar-constants.ts`
- Any files owned by other teammates

### Task B1: GPU Accelerator

**Files:** Create `client/src/lib/simulation/gpu/gpu-accelerator.ts` + test

**Context:** WebGPU device management with feature detection and CPU fallback. Handles adapter/device lifecycle, pipeline caching, buffer management. Provides `isAvailable()`, `initialize()`, `createBuffer()`, `dispatch()`, `readback()`. Singleton pattern.

**Interface:**
```typescript
interface GpuCapabilities {
  available: boolean;
  adapterInfo: string;
  maxBufferSize: number;
  maxWorkgroupSize: number;
  isFallback: boolean; // software renderer — skip
}

class GpuAccelerator {
  static getInstance(): GpuAccelerator;
  static isSupported(): boolean; // typeof navigator !== 'undefined' && 'gpu' in navigator

  async initialize(): Promise<GpuCapabilities>;
  isReady(): boolean;
  getDevice(): GPUDevice | null;

  // Pipeline cache
  async getOrCreatePipeline(key: string, shaderCode: string, entryPoint: string): Promise<GPUComputePipeline>;

  // Buffer helpers
  createStorageBuffer(data: Float32Array, usage?: number): GPUBuffer;
  createReadbackBuffer(size: number): GPUBuffer;
  async readBuffer(buffer: GPUBuffer, size: number): Promise<Float32Array>;

  // Dispatch
  dispatch(pipeline: GPUComputePipeline, bindGroup: GPUBindGroup, workgroups: [number, number?, number?]): void;
  async submit(): Promise<void>;

  destroy(): void;
}
```

**Tests (~20):** Feature detection when WebGPU absent, feature detection when present (mock), initialize success/failure, pipeline caching, buffer creation, readback, fallback adapter rejection, destroy cleanup, singleton behavior.

**Mock pattern for tests:**
```typescript
// WebGPU is not available in happy-dom, so mock navigator.gpu
const mockDevice = {
  createShaderModule: vi.fn().mockReturnValue({}),
  createComputePipeline: vi.fn().mockReturnValue({}),
  createComputePipelineAsync: vi.fn().mockResolvedValue({}),
  createBuffer: vi.fn().mockReturnValue({ mapAsync: vi.fn(), getMappedRange: vi.fn().mockReturnValue(new ArrayBuffer(0)), unmap: vi.fn(), destroy: vi.fn() }),
  createBindGroup: vi.fn().mockReturnValue({}),
  createCommandEncoder: vi.fn().mockReturnValue({ beginComputePass: vi.fn().mockReturnValue({ setPipeline: vi.fn(), setBindGroup: vi.fn(), dispatchWorkgroups: vi.fn(), end: vi.fn() }), copyBufferToBuffer: vi.fn(), finish: vi.fn() }),
  queue: { writeBuffer: vi.fn(), submit: vi.fn() },
  destroy: vi.fn(),
};
```

### Task B2: WGSL Shaders

**Files:** Create `client/src/lib/simulation/gpu/shaders.ts` + test

**Context:** WGSL compute shader source strings for: (1) batched forward substitution (Ly=b for many b vectors), (2) batched back substitution (Ux=y for many y vectors), (3) batched matrix-vector multiply (Ax for many x vectors). All operate on f32 arrays. Shaders are exported as template literal strings with configurable matrix size N.

**Interface:**
```typescript
// Shader source generators — N is matrix dimension, batchSize is number of RHS vectors
function forwardSubShader(n: number): string; // WGSL source
function backSubShader(n: number): string; // WGSL source
function matVecMulShader(n: number): string; // WGSL source
function batchSolveShader(n: number): string; // Combined: forward + back sub pipeline

// Utility
function workgroupSize(batchSize: number): number; // optimal workgroup dispatch count
```

**Tests (~15):** Shader string generation for various N, valid WGSL syntax patterns (regex checks for @group, @binding, @compute), workgroup size calculation, N=0 edge case, large N (1000).

### Task B3: GPU Monte Carlo

**Files:** Create `client/src/lib/simulation/gpu/gpu-monte-carlo.ts` + test

**Context:** Batched Monte Carlo using WebGPU. Key insight: for a given circuit topology, the MNA matrix structure is fixed — only component values change per iteration. So: (1) CPU builds the symbolic MNA template, (2) CPU generates 1000+ randomized component values (using existing mulberry32 PRNG), (3) CPU stamps each set of values into the MNA matrix and extracts the RHS vector, (4) GPU batch-solves all 1000 systems in one dispatch, (5) CPU reads back results and computes statistics. Falls back to existing `MonteCarloAnalysis.run()` when WebGPU unavailable.

**Interface:**
```typescript
interface GpuMonteCarloConfig extends MonteCarloConfig {
  preferGpu?: boolean; // default true
  batchSize?: number; // how many iterations per GPU dispatch (default: all)
}

interface GpuMonteCarloResult extends MonteCarloResult {
  accelerated: boolean; // true if GPU was used
  gpuTimeMs: number;
  cpuTimeMs: number;
  speedup: number; // gpuTime > 0 ? cpuTime / gpuTime : 1
}

async function runGpuMonteCarlo(config: GpuMonteCarloConfig): Promise<GpuMonteCarloResult>;

// Hook for React integration
function useGpuMonteCarlo(): {
  run: (config: GpuMonteCarloConfig) => Promise<GpuMonteCarloResult>;
  isRunning: boolean;
  progress: number; // 0-1
  supportsGpu: boolean;
};
```

**Tests (~25):** CPU fallback when GPU unavailable, mock GPU path, batch size splitting, results match CPU Monte Carlo for same seed, statistics computation, progress reporting, cancel mid-run, empty parameters, single parameter, many parameters, speedup measurement.

### Task B4: GPU Integration Test

**Files:** Create `client/src/lib/simulation/gpu/__tests__/gpu-integration.test.ts`

**Context:** Integration tests verifying the full pipeline: accelerator → shaders → monte carlo. Tests run in CPU-fallback mode (happy-dom has no WebGPU) but verify the logic is correct. Also verify that GPU Monte Carlo produces statistically equivalent results to CPU Monte Carlo.

**Tests (~15):** End-to-end CPU fallback, result equivalence with existing MonteCarloAnalysis, large iteration count (5000), multi-parameter sweep, sensitivity analysis matches, histogram shape similarity.

---

## Feature C: Digital Twin with IoT Feedback Loop (IN-26)

### Teammate: `digital-twin`

**Owns (create):**
- `client/src/lib/digital-twin/telemetry-protocol.ts`
- `client/src/lib/digital-twin/device-shadow.ts`
- `client/src/lib/digital-twin/comparison-engine.ts`
- `client/src/lib/digital-twin/telemetry-logger.ts`
- `client/src/lib/digital-twin/firmware-templates.ts`
- `client/src/lib/digital-twin/__tests__/telemetry-protocol.test.ts`
- `client/src/lib/digital-twin/__tests__/device-shadow.test.ts`
- `client/src/lib/digital-twin/__tests__/comparison-engine.test.ts`
- `client/src/lib/digital-twin/__tests__/telemetry-logger.test.ts`
- `client/src/lib/digital-twin/__tests__/firmware-templates.test.ts`
- `client/src/components/views/DigitalTwinView.tsx`
- `client/src/components/views/__tests__/DigitalTwinView.test.tsx`

**Must NOT touch:**
- `web-serial.ts`, `SerialMonitorPanel.tsx` — read-only reference
- `ProjectWorkspace.tsx`, `project-context.tsx`, `sidebar-constants.ts`
- Any files owned by other teammates

### Task C1: Telemetry Protocol

**Files:** Create `client/src/lib/digital-twin/telemetry-protocol.ts` + test

**Context:** Parses JSON Lines from serial into typed telemetry frames. Three frame types: (1) Manifest — sent on connect, declares available channels (pin names, types, ranges); (2) Telemetry — periodic data frame with channel values; (3) Command response — ack/nack for desired state commands. Validates with Zod.

**Interface:**
```typescript
// Manifest frame (sent by firmware on connect or on '?' command)
interface TelemetryManifest {
  type: 'manifest';
  board: string; // "Arduino Mega 2560", "ESP32-DevKit"
  firmware: string; // version
  channels: TelemetryChannel[];
}

interface TelemetryChannel {
  id: string; // "A0", "D13", "temp1"
  name: string; // "Analog Pin 0", "Built-in LED"
  dataType: 'digital' | 'analog' | 'pwm' | 'float' | 'string';
  unit?: string; // "V", "C", "RPM", "%"
  min?: number;
  max?: number;
  pin?: number; // physical pin number
}

// Telemetry frame (periodic at 10-50 Hz)
interface TelemetryFrame {
  type: 'telemetry';
  ts: number; // millis() from firmware
  ch: Record<string, number | boolean | string>; // channel_id → value
}

// Command response
interface CommandResponse {
  type: 'response';
  cmd: string;
  ok: boolean;
  msg?: string;
}

type ProtocolFrame = TelemetryManifest | TelemetryFrame | CommandResponse;

function parseFrame(line: string): ProtocolFrame | null; // returns null for invalid
function serializeCommand(channel: string, value: number | boolean): string; // JSON line to send
function createHandshake(): string; // '{"type":"handshake","protocol":"protopulse-twin","version":1}\n'
```

**Tests (~30):** Parse valid manifest, telemetry, response frames. Reject malformed JSON. Reject missing fields. Handle partial lines. Parse digital/analog/pwm/float/string values. Serialize commands. Handshake format. Large frame. Unicode in string channels. Timestamp validation.

### Task C2: Device Shadow

**Files:** Create `client/src/lib/digital-twin/device-shadow.ts` + test

**Context:** Tracks the current state of the connected device. Singleton+subscribe pattern. Three state sections: `reported` (values from firmware telemetry), `desired` (values set from UI), `delta` (differences that need to be synced). Updates `reported` from telemetry frames. Calculates `delta` when desired != reported. Provides staleness detection (last update timestamp per channel). Integrates with WebSerialManager via event subscription.

**Interface:**
```typescript
interface ChannelState {
  value: number | boolean | string;
  timestamp: number; // Date.now() when last updated
  stale: boolean; // true if no update for >2 seconds
}

interface ShadowState {
  connected: boolean;
  manifest: TelemetryManifest | null;
  reported: Map<string, ChannelState>;
  desired: Map<string, number | boolean>;
  delta: Map<string, { reported: unknown; desired: unknown }>;
  lastUpdate: number;
  frameRate: number; // measured Hz
}

class DeviceShadow {
  static getInstance(): DeviceShadow;
  subscribe(cb: () => void): () => void;
  getState(): ShadowState;

  // Connect to WebSerialManager event stream
  attachSerial(manager: WebSerialManager): void;
  detachSerial(): void;

  // Process incoming frame
  processFrame(frame: ProtocolFrame): void;

  // Set desired state (triggers command send)
  setDesired(channel: string, value: number | boolean): void;

  // Channel queries
  getChannel(id: string): ChannelState | undefined;
  getChannelValue(id: string): number | boolean | string | undefined;
  isStale(id: string): boolean;

  reset(): void;
}

function useDeviceShadow(): ShadowState & { setDesired, attachSerial, detachSerial };
```

**Tests (~30):** Process manifest updates state, telemetry updates reported values, staleness detection after 2s, desired vs reported delta calculation, setDesired sends command, attach/detach serial, frame rate measurement, reset clears state, subscribe/unsubscribe, multiple rapid updates, unknown channel handling.

### Task C3: Comparison Engine

**Files:** Create `client/src/lib/digital-twin/comparison-engine.ts` + test

**Context:** Compares simulated values (from DC/AC analysis) against actual measured values (from device shadow). Detects deviations exceeding configurable thresholds. Produces comparison results per channel with pass/warn/fail status.

**Interface:**
```typescript
type ComparisonStatus = 'match' | 'warn' | 'fail' | 'no_data';

interface ComparisonResult {
  channelId: string;
  channelName: string;
  simulated: number | null;
  measured: number | null;
  deviation: number | null; // absolute
  deviationPercent: number | null; // relative
  status: ComparisonStatus;
  message: string;
}

interface ComparisonConfig {
  warnThresholdPercent: number; // default 5
  failThresholdPercent: number; // default 20
  absoluteMinThreshold: number; // below this voltage, use absolute comparison (default 0.1V)
}

function compareValues(simulated: number, measured: number, config: ComparisonConfig): ComparisonStatus;
function compareCircuit(
  shadow: ShadowState,
  simulationResults: Map<string, number>, // node/channel → voltage/value
  config?: ComparisonConfig
): ComparisonResult[];
function overallHealth(results: ComparisonResult[]): { status: ComparisonStatus; passCount: number; warnCount: number; failCount: number };
```

**Tests (~25):** Match within threshold, warn at 5%, fail at 20%, absolute threshold for small values, missing sim data, missing measured data, mixed results, overall health calculation, custom thresholds, zero voltage handling, negative values.

### Task C4: Telemetry Logger

**Files:** Create `client/src/lib/digital-twin/telemetry-logger.ts` + test

**Context:** Logs telemetry frames to IndexedDB with ring buffer eviction (max 100K entries, 7-day retention). Batch writes for performance (flush every 100 entries or 1 second). Provides time-range queries for chart data. Handles IndexedDB unavailability gracefully.

**Interface:**
```typescript
interface LogEntry {
  id?: number; // auto-increment
  timestamp: number; // Date.now()
  deviceTimestamp: number; // millis() from firmware
  channelId: string;
  value: number | boolean | string;
}

interface TimeSeriesPoint {
  time: number;
  value: number;
}

class TelemetryLogger {
  static getInstance(): TelemetryLogger;

  async initialize(): Promise<boolean>; // returns false if IndexedDB unavailable

  // Logging
  log(frame: TelemetryFrame): void; // buffers internally, flushes in batches
  async flush(): Promise<void>;

  // Queries
  async getTimeSeries(channelId: string, startTime: number, endTime: number): Promise<TimeSeriesPoint[]>;
  async getLatest(channelId: string, count: number): Promise<TimeSeriesPoint[]>;
  async getChannelIds(): Promise<string[]>;

  // Maintenance
  async prune(maxAge?: number): Promise<number>; // returns entries deleted
  async getEntryCount(): Promise<number>;
  async clear(): Promise<void>;

  destroy(): void;
}
```

**Tests (~20):** Initialize creates DB, log + flush writes entries, batch write performance, time range query, latest N query, prune old entries, ring buffer eviction, IndexedDB unavailable fallback, destroy cleanup, concurrent writes.

**Note:** Use `fake-indexeddb` package for tests, or mock IDBFactory. Check if project already has this dependency.

### Task C5: Firmware Templates

**Files:** Create `client/src/lib/digital-twin/firmware-templates.ts` + test

**Context:** Generates Arduino/ESP32 sketch code that implements the ProtoPulse telemetry protocol. Template-based code generation: user selects board type and pins to monitor, gets copy-pasteable sketch with the right Serial.begin(), pin reads, JSON formatting, and timing loop. Zero external deps in generated code (uses ArduinoJson only if user opts in).

**Interface:**
```typescript
type BoardType = 'arduino_uno' | 'arduino_mega' | 'esp32' | 'esp32_s3' | 'arduino_nano';

interface PinConfig {
  pin: number;
  id: string; // channel ID
  name: string;
  type: 'digital_in' | 'digital_out' | 'analog_in' | 'pwm_out';
}

interface FirmwareConfig {
  board: BoardType;
  baudRate: number; // default 115200
  sampleRateHz: number; // default 10
  pins: PinConfig[];
  includeManifest: boolean; // default true
  includeDesiredHandler: boolean; // default true
}

function generateFirmware(config: FirmwareConfig): string; // complete .ino sketch
function generateManifestCode(config: FirmwareConfig): string; // just the manifest function
function generateReadLoop(pins: PinConfig[]): string; // just the telemetry loop
function boardPinCount(board: BoardType): { digital: number; analog: number; pwm: number };
```

**Tests (~20):** Generate for each board type, correct Serial.begin baud rate, manifest JSON format, read loop timing, PWM output handling, digital input/output, analog read, desired state handler, pin validation (out of range), empty pins.

### Task C6: DigitalTwinView

**Files:** Create `client/src/components/views/DigitalTwinView.tsx` + test

**Context:** Four-section layout: (1) Connection bar — device info from manifest, connect/disconnect button (delegates to WebSerialManager), frame rate indicator; (2) Live Values — grid of channel cards showing current value, sparkline (last 30 values), staleness indicator, set desired value input; (3) Comparison — table of sim vs actual with color-coded status badges (green/yellow/red); (4) Time Series — uPlot chart showing selected channels over time, channel selector checkboxes, time range picker. Also includes a "Generate Firmware" dialog that shows the Arduino sketch.

**Note:** For uPlot, import dynamically to avoid SSR issues. If uPlot is not available, fall back to a simple SVG sparkline.

**Tests (~20):** Renders connection bar, displays channel values, staleness indicator, comparison table, firmware dialog, connect/disconnect actions, channel selection, empty state when disconnected, loading state.

---

## Phase 2: Integration Wiring (Lead)

After all 3 teammates complete, the lead wires everything into the shared files:

### Task I1: ViewMode + ProjectWorkspace

**Files (modify):**
- `client/src/lib/project-context.tsx` — add `'generative_design' | 'digital_twin'` to ViewMode union
- `client/src/pages/ProjectWorkspace.tsx` — lazy imports, prefetch (Tier 3), ErrorBoundary+Suspense rendering, alwaysVisibleIds
- `client/src/components/layout/sidebar/sidebar-constants.ts` — add nav items (Wand2 for generative, Radio for digital twin)
- `client/src/components/ui/command-palette.tsx` — add search items

### Task I2: AI Tools Registration

**Files (modify):**
- `server/ai-tools/index.ts` — import and register generative tools

### Task I3: Dependencies

**Files (modify):**
- `package.json` — add `@webgpu/types` (dev), `uplot` + `uplot-react`

### Task I4: Documentation

**Files (modify):**
- `docs/product-analysis-checklist.md` — mark IN-23, IN-24, IN-26 as done (166/166, 100%)
- `CLAUDE.md` / `AGENTS.md` — update test counts, file counts, ViewMode list

### Task I5: Verify

- `npm run check` — zero TS errors
- `npm test` — all tests pass
- Commit with Wave 51 message

---

## `/agent-teams` Prompts

### Teammate 1: `generative-design`

```
You are implementing IN-23: Generative Circuit Design for ProtoPulse.

## Your files (CREATE — you own these exclusively):
- client/src/lib/generative-design/fitness-scorer.ts
- client/src/lib/generative-design/circuit-mutator.ts
- client/src/lib/generative-design/generative-engine.ts
- client/src/lib/generative-design/__tests__/fitness-scorer.test.ts
- client/src/lib/generative-design/__tests__/circuit-mutator.test.ts
- client/src/lib/generative-design/__tests__/generative-engine.test.ts
- client/src/components/views/GenerativeDesignView.tsx
- client/src/components/views/__tests__/GenerativeDesignView.test.tsx
- server/ai-tools/generative.ts
- server/__tests__/ai-tools-generative.test.ts

## Your files (MODIFY):
- server/ai-tools/index.ts — add registerGenerativeTools import + call

## DO NOT TOUCH:
- ProjectWorkspace.tsx, project-context.tsx, sidebar-constants.ts, command-palette.tsx
- Any other teammate's files

## Context:
- Read docs/plans/2026-03-07-wave-51-final-moonshots.md for full spec (Tasks A1-A5)
- Read client/src/lib/circuit-dsl/circuit-ir.ts for CircuitIR schema (your genome type)
- Read client/src/lib/circuit-dsl/circuit-api.ts for fluent builder API
- Read shared/drc-engine.ts for DRC scoring
- Read client/src/lib/simulation/dc-analysis.ts for power analysis
- Read server/ai-tools/circuit.ts for AI tool registration pattern
- Read server/ai-tools/index.ts for barrel registration pattern

## Key patterns:
- Singleton+subscribe pattern (see web-serial.ts, diff-pair-manager.ts)
- React hook: useGenerativeDesign() wrapping the singleton
- Import type { CircuitIR } from circuit-ir.ts
- Seeded PRNG: mulberry32 from monte-carlo.ts
- AI tool registration: registry.register({ name, description, parameters: z.object(...), execute })
- data-testid on every interactive/display element
- import type for type-only imports

## TDD workflow:
For each task: write failing test → run `npx vitest run <test-file>` → implement → run → verify pass

## Expected output: ~110 tests across 8 test files
```

### Teammate 2: `webgpu-sim`

```
You are implementing IN-24: WebGPU-Accelerated Simulation for ProtoPulse.

## Your files (CREATE — you own these exclusively):
- client/src/lib/simulation/gpu/gpu-accelerator.ts
- client/src/lib/simulation/gpu/gpu-monte-carlo.ts
- client/src/lib/simulation/gpu/shaders.ts
- client/src/lib/simulation/gpu/__tests__/gpu-accelerator.test.ts
- client/src/lib/simulation/gpu/__tests__/gpu-monte-carlo.test.ts
- client/src/lib/simulation/gpu/__tests__/shaders.test.ts
- client/src/lib/simulation/gpu/__tests__/gpu-integration.test.ts

## DO NOT TOUCH:
- Existing simulation files (circuit-solver.ts, monte-carlo.ts, etc.) — READ ONLY
- ProjectWorkspace.tsx, project-context.tsx, sidebar-constants.ts
- Any other teammate's files

## Context:
- Read docs/plans/2026-03-07-wave-51-final-moonshots.md for full spec (Tasks B1-B4)
- Read client/src/lib/simulation/circuit-solver.ts for solveLinearSystem (MNA solver to accelerate)
- Read client/src/lib/simulation/monte-carlo.ts for MonteCarloAnalysis (primary GPU target)
- Read client/src/lib/simulation/transient-analysis.ts for transient sim structure

## Key design decisions:
- WebGPU is NOT available in happy-dom test environment — mock navigator.gpu
- GPU mock pattern: create mockDevice, mockAdapter objects with vi.fn() methods
- Primary value: batch Monte Carlo (1000+ iterations, same matrix structure, different values)
- CPU fallback is mandatory — GpuAccelerator.isSupported() returns false in tests
- f32 only in WGSL — acceptable for Monte Carlo tolerance analysis
- Singleton pattern for GpuAccelerator
- WGSL shaders are template literal strings (not separate .wgsl files)
- Shader generators take matrix dimension N as parameter

## Mock pattern for WebGPU:
```typescript
function mockNavigatorGpu() {
  const device = { createShaderModule: vi.fn(), createComputePipelineAsync: vi.fn(), createBuffer: vi.fn(), createBindGroup: vi.fn(), createCommandEncoder: vi.fn(), queue: { writeBuffer: vi.fn(), submit: vi.fn() }, destroy: vi.fn() };
  const adapter = { requestDevice: vi.fn().mockResolvedValue(device), info: { description: 'Mock GPU' }, isFallbackAdapter: false };
  Object.defineProperty(navigator, 'gpu', { value: { requestAdapter: vi.fn().mockResolvedValue(adapter) }, configurable: true });
  return { device, adapter };
}
```

## TDD workflow:
For each task: write failing test → run `npx vitest run <test-file>` → implement → run → verify pass

## Expected output: ~75 tests across 4 test files
```

### Teammate 3: `digital-twin`

```
You are implementing IN-26: Digital Twin with IoT Feedback Loop for ProtoPulse.

## Your files (CREATE — you own these exclusively):
- client/src/lib/digital-twin/telemetry-protocol.ts
- client/src/lib/digital-twin/device-shadow.ts
- client/src/lib/digital-twin/comparison-engine.ts
- client/src/lib/digital-twin/telemetry-logger.ts
- client/src/lib/digital-twin/firmware-templates.ts
- client/src/lib/digital-twin/__tests__/telemetry-protocol.test.ts
- client/src/lib/digital-twin/__tests__/device-shadow.test.ts
- client/src/lib/digital-twin/__tests__/comparison-engine.test.ts
- client/src/lib/digital-twin/__tests__/telemetry-logger.test.ts
- client/src/lib/digital-twin/__tests__/firmware-templates.test.ts
- client/src/components/views/DigitalTwinView.tsx
- client/src/components/views/__tests__/DigitalTwinView.test.tsx

## DO NOT TOUCH:
- web-serial.ts, SerialMonitorPanel.tsx — READ ONLY reference
- ProjectWorkspace.tsx, project-context.tsx, sidebar-constants.ts
- Any other teammate's files

## Context:
- Read docs/plans/2026-03-07-wave-51-final-moonshots.md for full spec (Tasks C1-C6)
- Read client/src/lib/web-serial.ts for WebSerialManager interface (you'll subscribe to its events)
- Read client/src/components/panels/SerialMonitorPanel.tsx for serial UI reference
- Read client/src/lib/simulation/dc-analysis.ts for DCOperatingPoint type (comparison source)

## Key design decisions:
- JSON Lines protocol (one JSON object per line, terminated with \n)
- Three frame types: manifest, telemetry, response — discriminated on `type` field
- DeviceShadow uses singleton+subscribe pattern (like WebSerialManager)
- Staleness threshold: 2 seconds without update
- Comparison thresholds: 5% warn, 20% fail (configurable)
- IndexedDB for telemetry logging — batch writes (flush every 100 entries or 1s)
- For IndexedDB in tests: mock IDBFactory or use fake-indexeddb if available
- Firmware templates generate complete .ino sketches (string output, no files written)
- DigitalTwinView: 4-section layout (connection, live values, comparison, time series)
- For chart: use simple SVG sparklines (no uPlot dependency needed in initial impl — lead will add uPlot later if needed)

## Zod validation for protocol frames:
Use z.discriminatedUnion('type', [...]) for ProtocolFrame parsing.

## TDD workflow:
For each task: write failing test → run `npx vitest run <test-file>` → implement → run → verify pass

## Expected output: ~145 tests across 6 test files
```

---

## Team Execution Checklist

- [ ] Write plan (this document)
- [ ] Create `/agent-teams` with 3 teammates
- [ ] Create tasks for each teammate (5-6 per teammate)
- [ ] Spawn all 3 teammates with prompts above
- [ ] Monitor teammate progress (Shift+Up/Down)
- [ ] After all teammates complete: verify tests pass
- [ ] Phase 2: Wire integration (ViewMode, ProjectWorkspace, Sidebar, command-palette)
- [ ] Add npm dependencies (`@webgpu/types`, `uplot`, `uplot-react`)
- [ ] `npm run check` — zero TS errors
- [ ] `npm test` — all tests pass
- [ ] Update checklist: IN-23, IN-24, IN-26 → done (166/166, 100%)
- [ ] Update AGENTS.md: test count, file count, ViewMode list
- [ ] Update MEMORY.md: Wave 51 summary
- [ ] Commit: "feat: Wave 51 — generative design, WebGPU sim, digital twin (166/166, 100%)"
