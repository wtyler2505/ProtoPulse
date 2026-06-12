import { sweepVectorName } from './types.js';

import type { McTrial, SimResult, StepRun } from './types.js';

/**
 * Pure trial→trace flattening + label building for Monte Carlo and
 * parameter-step results. SimPanel filters the flat list by the trace
 * checkboxes (via `key`) and hands it to the Plot; nothing here touches
 * React or canvas.
 */

/** Spaghetti opacity for non-nominal Monte Carlo trials. */
export const MC_TRIAL_ALPHA = 0.15;

export interface MultiTrace {
  /** Display / legend name. */
  name: string;
  /** Underlying vector name — the checkbox key (shared across runs). */
  key: string;
  xs: number[];
  /** Raw values — caller applies dB / log transforms. */
  ys: number[];
  imag?: number[];
  /** Trace opacity (Monte Carlo spaghetti uses MC_TRIAL_ALPHA). */
  alpha?: number;
  /** Color-cycle index. */
  colorIndex: number;
  /** False suppresses legend + cursor readout (spaghetti trials). */
  legend?: boolean;
}

function vectorsOf(result: SimResult): { key: string; xs: number[]; ys: number[]; imag?: number[] }[] {
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

/** Vector names a result set offers as trace checkboxes (sweep excluded). */
export function traceKeys(results: SimResult[]): string[] {
  const first = results[0];
  if (!first) return [];
  return vectorsOf(first).map((v) => v.key);
}

/**
 * Monte Carlo spaghetti: every trial's vectors, the nominal (first)
 * trial at full opacity with a legend entry, the rest translucent and
 * legend-less. A vector keeps one color across all trials.
 */
export function flattenMcTrials(trials: McTrial[]): MultiTrace[] {
  const out: MultiTrace[] = [];
  const colorByKey = new Map<string, number>();
  trials.forEach((trial, t) => {
    const nominal = t === 0;
    for (const vec of vectorsOf(trial)) {
      let colorIndex = colorByKey.get(vec.key);
      if (colorIndex === undefined) {
        colorIndex = colorByKey.size;
        colorByKey.set(vec.key, colorIndex);
      }
      out.push({
        ...vec,
        name: nominal ? vec.key : `${vec.key} #${String(trial.trial)}`,
        colorIndex,
        alpha: nominal ? 1 : MC_TRIAL_ALPHA,
        legend: nominal,
      });
    }
  });
  return out;
}

/** Label for one stepped run of one vector: "v(led_a) [330]". */
export function stepLabel(vectorName: string, value: string): string {
  return `${vectorName} [${value}]`;
}

/**
 * Parameter step: one full-opacity trace per (vector, run) pair, named
 * via stepLabel and color-cycled across the whole flat list.
 */
export function flattenStepRuns(runs: StepRun[]): MultiTrace[] {
  const out: MultiTrace[] = [];
  for (const run of runs) {
    for (const vec of vectorsOf(run)) {
      out.push({
        ...vec,
        name: stepLabel(vec.key, run.value),
        colorIndex: out.length,
        legend: true,
      });
    }
  }
  return out;
}
