import { engNotation } from './scales.js';

import type { DesignGraph } from '@protopulse/graph';
import type { PartDb } from '@protopulse/parts';
import type { RGBA } from '@protopulse/renderer';

/**
 * The sim ghost overlay: after a run, paint every net on the schematic
 * with its SOLVED voltage — cold blue at the bottom of the range, warm
 * orange at the top. Pure data plumbing: the netlist already records
 * netId → SPICE node (NetlistResult.nodeOf), and the result vectors
 * are named v(node), so a ghost is one join away.
 *
 * Honesty rules: only op (the operating point) and tran (the FINAL
 * timepoint of the window) produce a ghost — AC/noise/DC-sweep results
 * aren't a single voltage per net and would be a lie painted on wires.
 * A ghost is stamped with (branch, opsVersion) and is only drawn while
 * those still match the live session.
 */

export interface GhostVectors {
  name: string;
  values: number[];
}

export interface SimGhost {
  /** netId → volts at the captured instant. */
  voltsByNet: ReadonlyMap<string, number>;
  min: number;
  max: number;
  /** Which instant the voltages describe (legend text). */
  label: string;
  /** Freshness stamp — stale ghosts are never drawn. */
  branch: string;
  opsVersion: number;
}

/**
 * Join result vectors to nets. Returns null when the analysis kind has
 * no single-voltage-per-net meaning or nothing matched.
 */
export function ghostFromVectors(
  analysisKind: string,
  vectors: readonly GhostVectors[],
  nodeOf: ReadonlyMap<string, string>,
  stamp: { branch: string; opsVersion: number },
): SimGhost | null {
  if (analysisKind !== 'op' && analysisKind !== 'tran') return null;
  const byName = new Map(vectors.map((v) => [v.name.toLowerCase(), v]));
  const voltsByNet = new Map<string, number>();
  for (const [netId, node] of nodeOf) {
    if (node === '0') {
      voltsByNet.set(netId, 0);
      continue;
    }
    const last = byName.get(`v(${node.toLowerCase()})`)?.values.at(-1);
    if (last !== undefined && Number.isFinite(last)) voltsByNet.set(netId, last);
  }
  if (voltsByNet.size === 0) return null;

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const v of voltsByNet.values()) {
    if (v < min) min = v;
    if (v > max) max = v;
  }

  const tEnd = byName.get('time')?.values.at(-1);
  const label =
    analysisKind === 'op'
      ? 'operating point'
      : `t = ${tEnd !== undefined ? engNotation(tEnd) : 'end'}s`;
  return { voltsByNet, min, max, label, ...stamp };
}

/** The netlist planner slice of @protopulse/sim — pinned API cast, the
 *  same pattern the sim runner uses for its lazy import. */
interface NetlistPlanner {
  generateSpiceNetlist: (
    graph: DesignGraph,
    parts: PartDb,
  ) => { nodeOf: Map<string, string> };
}

/** Compute a ghost for a finished run: lazy-import the netlist planner
 *  (no engine boot — pure text generation) for the netId→node map and
 *  join. Any failure quietly means "no ghost"; the overlay is a bonus,
 *  never an error source. */
export async function computeGhost(
  graph: DesignGraph,
  parts: PartDb,
  analysisKind: string,
  vectors: readonly GhostVectors[],
  stamp: { branch: string; opsVersion: number },
): Promise<SimGhost | null> {
  if (analysisKind !== 'op' && analysisKind !== 'tran') return null;
  try {
    const mod = (await import('@protopulse/sim')) as unknown as Partial<NetlistPlanner>;
    if (typeof mod.generateSpiceNetlist !== 'function') return null;
    const { nodeOf } = mod.generateSpiceNetlist(graph, parts);
    return ghostFromVectors(analysisKind, vectors, nodeOf, stamp);
  } catch {
    return null;
  }
}

/** Cold → warm ramp endpoints (alpha 1 — these ARE the wire colors). */
const COLD: RGBA = [0.25, 0.45, 0.95, 1.0];
const WARM: RGBA = [1.0, 0.55, 0.2, 1.0];

export function voltageColor(volts: number, min: number, max: number): RGBA {
  const t = max > min ? (volts - min) / (max - min) : 0.5;
  return [
    COLD[0] + (WARM[0] - COLD[0]) * t,
    COLD[1] + (WARM[1] - COLD[1]) * t,
    COLD[2] + (WARM[2] - COLD[2]) * t,
    1.0,
  ];
}

/** The renderer-ready tint map for a ghost. */
export function ghostTint(ghost: SimGhost): Map<string, RGBA> {
  const tint = new Map<string, RGBA>();
  for (const [netId, volts] of ghost.voltsByNet) {
    tint.set(netId, voltageColor(volts, ghost.min, ghost.max));
  }
  return tint;
}

/** CSS legend gradient matching voltageColor's ramp. */
export function ghostLegendGradient(): string {
  const css = (c: RGBA): string =>
    `rgb(${String(Math.round(c[0] * 255))}, ${String(Math.round(c[1] * 255))}, ${String(Math.round(c[2] * 255))})`;
  return `linear-gradient(to right, ${css(COLD)}, ${css(voltageColor(0.5, 0, 1))}, ${css(WARM)})`;
}
