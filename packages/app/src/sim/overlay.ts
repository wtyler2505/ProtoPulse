import { sweepVectorName } from './types.js';

import type { SimResult } from './types.js';

/**
 * Branch overlay merge — the Vol I promise: plot the same node on two
 * design branches against each other. Pure: takes the primary run and an
 * optional secondary (other-branch) run and produces a flat trace list;
 * SimPanel filters by the checkbox set and paints. Secondary traces keep
 * the primary's color (same node, same hue) but render DASHED and carry
 * an ' @<branch>' name suffix.
 */

/** Dash pattern for the secondary branch's traces. */
export const OVERLAY_DASH: readonly number[] = [6, 4];

export interface OverlayTrace {
  /** Display name; secondary traces are suffixed ' @<branch>'. */
  name: string;
  /** Underlying vector name — the checkbox key (shared across branches). */
  key: string;
  xs: number[];
  /** Raw values — caller applies dB / log transforms. */
  ys: number[];
  imag?: number[];
  /** Set for secondary-branch traces (ctx.setLineDash pattern). */
  dash?: number[];
  /** Color-cycle index; a node's solid and dashed traces share it. */
  colorIndex: number;
}

function tracesOf(result: SimResult): { key: string; xs: number[]; ys: number[]; imag?: number[] }[] {
  const sweep = sweepVectorName(result);
  const sweepVec = sweep !== null ? result.vectors.find((v) => v.name === sweep) : undefined;
  return result.vectors
    .filter((v) => v.name !== sweep)
    .map((vec) => ({
      key: vec.name,
      xs: sweepVec ? sweepVec.values : vec.values.map((_, j) => j),
      ys: vec.values,
      ...(vec.imag !== undefined ? { imag: vec.imag } : {}),
    }));
}

/**
 * Merge a primary run with an optional secondary (other-branch) run of
 * the SAME analysis. Secondary vectors with no primary counterpart still
 * appear (dashed, color-cycled after the primary's traces).
 */
export function combineRuns(
  primary: SimResult,
  secondary: SimResult | null,
  branchName: string,
): OverlayTrace[] {
  const out: OverlayTrace[] = [];
  const colorByKey = new Map<string, number>();

  for (const t of tracesOf(primary)) {
    const colorIndex = colorByKey.size;
    colorByKey.set(t.key, colorIndex);
    out.push({ ...t, name: t.key, colorIndex });
  }

  if (secondary) {
    for (const t of tracesOf(secondary)) {
      let colorIndex = colorByKey.get(t.key);
      if (colorIndex === undefined) {
        colorIndex = colorByKey.size;
        colorByKey.set(t.key, colorIndex);
      }
      out.push({
        ...t,
        name: `${t.key} @${branchName}`,
        dash: [...OVERLAY_DASH],
        colorIndex,
      });
    }
  }

  return out;
}
