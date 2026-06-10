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

/** Shape of the lazily imported '@protopulse/cosim' module. Partial in
 *  practice until the cosim track lands — runner.ts checks at runtime. */
export interface CosimModule {
  runCosimWindow: RunCosimWindowFn;
}
