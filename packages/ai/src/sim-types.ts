import type { DesignGraph } from '@protopulse/graph';
import type { PartDb } from '@protopulse/parts';

// Pinned @protopulse/sim API (v0.2); swap to direct import after integration.
// The sim package is built on a parallel track — these local declarations
// keep @protopulse/ai typechecking (and its tests running against fakes)
// independent of that track's timing. The shapes are the contract.

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

/** The pinned simulate() signature. The HOST injects the real engine
 *  (or a fake in tests) — this package never imports it eagerly. */
export type PinnedSimulateFn = (
  graph: DesignGraph,
  parts: PartDb,
  analysis: Analysis,
) => Promise<SimResultWithManifest>;

/**
 * Local mirror of @protopulse/sim's fidelitySummary() — simulations never
 * lie about what they are. Swap to the engine's own once integrated.
 */
export function fidelitySummary(manifest: FidelityEntry[]): string {
  if (manifest.length === 0) return 'Fidelity: no models in manifest';
  const tiers: ModelTier[] = ['spice', 'behavioral', 'stub'];
  const counts = tiers
    .map((tier) => ({ tier, n: manifest.filter((e) => e.tier === tier).length }))
    .filter((c) => c.n > 0)
    .map((c) => `${String(c.n)} ${c.tier}`);
  const stubs = manifest
    .filter((e) => e.tier === 'stub')
    .map((e) => `${e.ref}${e.note ? ` (${e.note})` : ''}`);
  const stubNote = stubs.length > 0 ? `; STUB models: ${stubs.join(', ')}` : '';
  return `Fidelity: ${counts.join(', ')}${stubNote}`;
}
