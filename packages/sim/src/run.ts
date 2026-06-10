import { SpiceEngine } from './engine.js';
import { generateSpiceNetlist } from './netlist.js';

import type { Analysis } from './analyses.js';
import type { SimResult } from './engine.js';
import type { FidelityEntry, ModelTier } from './models.js';
import type { NetlistOpts } from './netlist.js';
import type { DesignGraph } from '@protopulse/graph';
import type { PartDb } from '@protopulse/parts';

/**
 * One-call convenience: graph → netlist → engine → result, with the
 * fidelity manifest attached so callers can never mistake a stub-ridden
 * run for a faithful one.
 */

export interface SimulateOpts extends NetlistOpts {
  /** Reuse a booted engine (recommended — WASM boot takes seconds). */
  engine?: SpiceEngine;
}

export interface SimulateResult extends SimResult {
  manifest: FidelityEntry[];
}

export async function simulate(
  graph: DesignGraph,
  parts: PartDb,
  analysis: Analysis,
  opts: SimulateOpts = {},
): Promise<SimulateResult> {
  const { netlist, manifest } = generateSpiceNetlist(graph, parts, opts);
  const engine = opts.engine ?? new SpiceEngine();
  try {
    const result = await engine.run(netlist, analysis);
    return { ...result, manifest };
  } finally {
    if (opts.engine === undefined) await engine.stop();
  }
}

const TIER_ORDER: readonly ModelTier[] = ['spice', 'behavioral', 'stub'];

/**
 * Human-readable fidelity rollup: '3 spice, 2 behavioral, 1 stub (U1
 * excluded)'. Stub refs are named — exclusions must be visible.
 */
export function fidelitySummary(manifest: readonly FidelityEntry[]): string {
  if (manifest.length === 0) return 'no components';
  const parts: string[] = [];
  for (const tier of TIER_ORDER) {
    const entries = manifest.filter((e) => e.tier === tier);
    if (entries.length === 0) continue;
    let piece = `${String(entries.length)} ${tier}`;
    if (tier === 'stub') {
      piece += ` (${entries.map((e) => e.ref).join(', ')} excluded)`;
    }
    parts.push(piece);
  }
  return parts.join(', ');
}
