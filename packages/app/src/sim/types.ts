import type { DesignGraph } from '@protopulse/graph';
import type { PartDb } from '@protopulse/parts';

// Pinned @protopulse/sim API (v0.2); swap to direct import after integration.
// The sim engine is built on a parallel track and its package currently
// ships a stub index, so re-exporting from '@protopulse/sim' is NOT safe
// yet. This module is the app's single source for the sim types; the
// engine itself is loaded LAZILY in runner.ts and typed through these.

export type Analysis =
  | { kind: 'op' }
  | { kind: 'tran'; stepS: number; stopS: number; startS?: number }
  | { kind: 'dc'; source: string; start: number; stop: number; step: number }
  | {
      kind: 'ac';
      variation: 'dec' | 'oct' | 'lin';
      points: number;
      fStart: number;
      fStop: number;
    }
  | {
      kind: 'noise';
      /** Net name the noise is referred to. */
      output: string;
      /** Input source ref (battery / rail) for the noise figure. */
      source: string;
      variation: 'dec' | 'oct' | 'lin';
      points: number;
      fStart: number;
      fStop: number;
    };

export interface SimVector {
  name: string;
  values: number[];
  imag?: number[];
}

export interface SimResult {
  analysis: Analysis;
  variables: string[];
  points: number;
  vectors: SimVector[];
}

export type ModelTier = 'spice' | 'behavioral' | 'stub';

export interface FidelityEntry {
  ref: string;
  partId: string;
  tier: ModelTier;
  note?: string;
}

export type SimResultWithManifest = SimResult & { manifest: FidelityEntry[] };

export type SimulateFn = (
  graph: DesignGraph,
  parts: PartDb,
  analysis: Analysis,
) => Promise<SimResultWithManifest>;

// ── Monte Carlo ──

export interface MonteCarloSpec {
  base: Analysis;
  runs: number;
  seed?: number;
  /** Component-class tolerances as fractions (0.05 = ±5%). */
  tolerances?: Partial<Record<'resistor' | 'capacitor' | 'inductor', number>>;
}

export interface McTrial extends SimResult {
  trial: number;
  /** Per-ref multiplier actually applied in this trial. */
  jitter: Record<string, number>;
}

export interface MonteCarloResult {
  trials: McTrial[];
  manifest: FidelityEntry[];
  /** The seed used (engine picks one when the spec omits it). */
  seed: number;
}

export type SimulateMonteCarloFn = (
  graph: DesignGraph,
  parts: PartDb,
  spec: MonteCarloSpec,
) => Promise<MonteCarloResult>;

// ── Parameter stepping ──

export interface StepSpec {
  base: Analysis;
  componentRef: string;
  /** Component values to step through ("330", "1k", …). */
  values: string[];
}

export interface StepRun extends SimResult {
  value: string;
}

export interface StepResult {
  runs: StepRun[];
  manifest: FidelityEntry[];
}

export type SimulateStepFn = (
  graph: DesignGraph,
  parts: PartDb,
  spec: StepSpec,
) => Promise<StepResult>;

// ── Worker-path planning ──
// The sim worker protocol is graph-less: the MAIN thread builds netlist
// bodies with these engine entry points and ships plain strings to the
// worker (see worker.ts). Pinned to @protopulse/sim's exports.

export interface NetlistWithManifest {
  /** SPICE netlist body — no analysis card, no `.end`. */
  netlist: string;
  manifest: FidelityEntry[];
}

export interface McDeck {
  netlist: string;
  /** ref → value multiplier drawn for this trial. */
  jitter: Record<string, number>;
}

export interface MonteCarloPlan {
  decks: McDeck[];
  manifest: FidelityEntry[];
  seed: number;
}

export interface StepDeck {
  netlist: string;
  value: string;
}

export interface StepPlan {
  decks: StepDeck[];
  manifest: FidelityEntry[];
}

/** Shape of the lazily imported '@protopulse/sim' module. Partial in
 *  practice until the engine track lands — runner.ts checks at runtime. */
export interface SimModule {
  simulate: SimulateFn;
  fidelitySummary: (manifest: FidelityEntry[]) => string;
  simulateMonteCarlo: SimulateMonteCarloFn;
  simulateStep: SimulateStepFn;
  generateSpiceNetlist: (graph: DesignGraph, parts: PartDb) => NetlistWithManifest;
  planMonteCarloNetlists: (graph: DesignGraph, parts: PartDb, spec: MonteCarloSpec) => MonteCarloPlan;
  planStepNetlists: (graph: DesignGraph, parts: PartDb, spec: StepSpec) => StepPlan;
}

/** Name of the sweep (x-axis) vector for a result, or null for op. */
export function sweepVectorName(result: SimResult): string | null {
  switch (result.analysis.kind) {
    case 'op':
      return null;
    case 'tran':
      return 'time';
    case 'ac':
    case 'noise':
      return 'frequency';
    case 'dc':
      return result.variables[0] ?? null;
  }
}
