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

/** Shape of the lazily imported '@protopulse/sim' module. Partial in
 *  practice until the engine track lands — runner.ts checks at runtime. */
export interface SimModule {
  simulate: SimulateFn;
  fidelitySummary: (manifest: FidelityEntry[]) => string;
}

/** Name of the sweep (x-axis) vector for a result, or null for op. */
export function sweepVectorName(result: SimResult): string | null {
  switch (result.analysis.kind) {
    case 'op':
      return null;
    case 'tran':
      return 'time';
    case 'ac':
      return 'frequency';
    case 'dc':
      return result.variables[0] ?? null;
  }
}
