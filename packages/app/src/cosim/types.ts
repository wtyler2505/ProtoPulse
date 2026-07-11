import type { McuCore, PinEvent } from '../emu/types.js';
import type { FidelityEntry, SimResult } from '../sim/types.js';
import type { DesignGraph } from '@protopulse/graph';
import type { PartDb } from '@protopulse/parts';

// Pinned @protopulse/cosim API; swap to direct re-exports after the
// co-simulation track lands. The cosim package is built on a parallel
// track — these local declarations keep the app typechecking (and its
// tests running against fakes) independent of that track's timing. The
// shapes are the contract; the module itself is loaded LAZILY in
// runner.ts and runtime-checked there.

/** One MCU pin driven onto one design net for a co-sim window. */
export interface PinBinding {
  /** MCU pin name as the emulator reports it, e.g. "PB5". */
  pin: string;
  /** The graph net the pin drives, by net id. */
  netId: string;
  /** Logic-1 voltage; the engine defaults this (5 V rail) when omitted. */
  voltsHigh?: number;
  /** Logic-0 voltage; engine default 0 V. */
  voltsLow?: number;
  /** Driver output impedance; engine default applies when omitted. */
  routOhms?: number;
  /** Edge rise time in seconds; engine default applies when omitted. */
  riseS?: number;
}

/** A bounded co-sim window: step the MCU, solve the analog side. */
export interface CosimWindowSpec {
  /** Virtual length of the window, seconds. */
  windowS: number;
  /** Analog solver step, seconds. */
  stepS: number;
  bindings: PinBinding[];
}

export interface CosimResult {
  /** The analog transient result, with the usual fidelity manifest. */
  sim: SimResult & { manifest: FidelityEntry[] };
  /** Digital transitions the MCU made on bound (and other) pins. */
  pinEvents: PinEvent[];
  /** MCU cycles actually executed inside the window. */
  mcuCycles: number;
  /** Virtual time covered, seconds (≤ windowS if the core halted). */
  virtualTimeS: number;
  /** The PWL source text injected per net — the digital→analog bridge. */
  pwlSources: Record<string, string>;
}

export type RunCosimWindowFn = (args: {
  graph: DesignGraph;
  parts: PartDb;
  core: McuCore;
  spec: CosimWindowSpec;
}) => Promise<CosimResult>;

// ── Closed loop (FEEDBACK direction) ─────────────────────────────────

/** One analog net fed back onto an MCU *digital input* pin through the
 *  engine's Schmitt comparator (state retained per pin). */
export interface InputBinding {
  /** The graph net whose voltage is comparator-sampled, by net id. */
  netId: string;
  /** Digital input pin to drive, e.g. 'D2'. */
  pin: string;
}

/** One analog net fed back into an MCU ADC channel via the sampler. */
export interface AdcBinding {
  /** The graph net whose voltage the ADC converts, by net id. */
  netId: string;
  /** ADC mux channel. */
  channel: number;
}

/** An I2C slave device model: answers a master register read. */
export type I2cSlaveFn = (address: number, register: number) => number;
/** An SPI slave device model: answers the master's MISO phase. */
export type SpiSlaveFn = (mosi: readonly number[], misoIndex: number) => number;

/** One modeled I2C device installed on a controller port for the run. */
export interface I2cDeviceBinding {
  /** I2C controller port (0 = I2C0, 1 = I2C1). */
  port: 0 | 1;
  slave: I2cSlaveFn;
}

/** One modeled SPI device installed on a controller port for the run. */
export interface SpiDeviceBinding {
  /** SPI controller port (2 = GPSPI2, 3 = GPSPI3). */
  port: 2 | 3;
  slave: SpiSlaveFn;
}

/** A closed-loop window: outputs out, comparator + ADC back in,
 *  lock-stepped on a conservative quantum (engine default 50 µs). */
export interface ClosedLoopSpec extends CosimWindowSpec {
  /** Conservative quantum, seconds; engine defaults it when omitted. */
  quantumS?: number;
  inputs?: InputBinding[];
  adc?: AdcBinding[];
  /** I2C slave devices installed on the core for the run. Auto-resolved from
   *  the design's placed parts when omitted (see runner.ts). */
  i2cDevices?: I2cDeviceBinding[];
  /** SPI slave devices installed on the core for the run. Auto-resolved from
   *  the design's placed parts when omitted. */
  spiDevices?: SpiDeviceBinding[];
}

/** Pinned with the emu ADC track: one firmware-initiated conversion. */
export interface AdcReadRecord {
  channel: number;
  cycle: number;
  /** The volts the engine fed back for this conversion. */
  volts: number;
}

export interface ClosedLoopResult extends CosimResult {
  /** Conservative quanta the window was cut into. */
  quanta: number;
  /** Every firmware ADC conversion, with the volts it was fed. */
  adcReads: AdcReadRecord[];
  /** Comparator transitions driven onto digital input pins. */
  inputEdges: PinEvent[];
  /** Full from-zero re-solves — the batch engine cannot pause/resume,
   *  so each quantum re-runs the transient. The honesty counter. */
  rerunSolves: number;
}

export type RunCosimClosedLoopFn = (args: {
  graph: DesignGraph;
  parts: PartDb;
  core: McuCore;
  spec: ClosedLoopSpec;
}) => Promise<ClosedLoopResult>;

/** Shape of the lazily imported '@protopulse/cosim' module. Partial in
 *  practice until the cosim tracks land — runner.ts checks at runtime. */
export interface CosimModule {
  runCosimWindow: RunCosimWindowFn;
  runCosimClosedLoop: RunCosimClosedLoopFn;
  /** Resolve placed I2C parts in a design to device bindings. Optional — older
   *  builds of @protopulse/cosim may lack it; runner.ts probes at runtime. */
  i2cDevicesFromGraph?: (graph: DesignGraph) => I2cDeviceBinding[];
  /** Resolve placed SPI parts in a design to device bindings. Optional. */
  spiDevicesFromGraph?: (graph: DesignGraph) => SpiDeviceBinding[];
}
