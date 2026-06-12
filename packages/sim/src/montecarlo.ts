import { parseValue } from '@protopulse/graph';

import { SpiceEngine } from './engine.js';
import { compareRefs, generateSpiceNetlist } from './netlist.js';

import type { Analysis } from './analyses.js';
import type { SimResult } from './engine.js';
import type { FidelityEntry } from './models.js';
import type { SimulateOpts } from './run.js';
import type { DesignGraph, Uuid } from '@protopulse/graph';
import type { PartDb } from '@protopulse/parts';

/**
 * Monte Carlo — Vol II §D.1: tolerance-jittered component values over a
 * seeded RNG. Every trial re-emits the netlist with jittered R/C/L
 * values (via valueOverrides — the graph is never mutated) and runs the
 * same base analysis on one shared engine. Deterministic: the same seed
 * always draws the same jitters, on every platform.
 */

export type JitterClass = 'resistor' | 'capacitor' | 'inductor';

export interface MonteCarloSpec {
  base: Analysis;
  runs: number;
  /** RNG seed; omitted → drawn at random and reported in the result. */
  seed?: number;
  /** Fractional tolerances per class (0.05 = ±5%). */
  tolerances?: Partial<Record<JitterClass, number>>;
}

export interface McTrial extends SimResult {
  trial: number;
  /** ref → value multiplier drawn for this trial. */
  jitter: Record<string, number>;
}

export interface MonteCarloResult {
  trials: McTrial[];
  manifest: FidelityEntry[];
  /** The seed actually used — feed it back for an identical re-run. */
  seed: number;
}

export const DEFAULT_TOLERANCES: Readonly<Record<JitterClass, number>> = {
  resistor: 0.05,
  capacitor: 0.2,
  inductor: 0.1,
};

/** mulberry32 — tiny deterministic PRNG, identical on every platform. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Unit letter appended to overrides so re-parsing is class-unambiguous. */
const UNIT_LETTER: Readonly<Record<JitterClass, string>> = {
  resistor: '',
  capacitor: 'F',
  inductor: 'H',
};

const SI_PREFIXES: readonly [number, string][] = [
  [1e9, 'G'],
  [1e6, 'M'],
  [1e3, 'k'],
  [1, ''],
  [1e-3, 'm'],
  [1e-6, 'u'],
  [1e-9, 'n'],
];

/**
 * Format a value as an SI-prefixed string ("10.5uF") that parseValue
 * round-trips for the class. Plain decimals only — parseValue does not
 * accept exponent notation.
 */
export function siValueString(n: number, unit: string): string {
  if (n === 0) return `0${unit}`;
  const abs = Math.abs(n);
  for (const [mult, prefix] of SI_PREFIXES) {
    if (abs >= mult) {
      return `${String(Number((n / mult).toPrecision(9)))}${prefix}${unit}`;
    }
  }
  return `${String(Number((n / 1e-12).toPrecision(9)))}p${unit}`;
}

interface JitterTarget {
  id: Uuid;
  ref: string;
  cls: JitterClass;
  value: number;
  tol: number;
}

function isJitterClass(cls: string): cls is JitterClass {
  return cls === 'resistor' || cls === 'capacitor' || cls === 'inductor';
}

/**
 * R/C/L components eligible for jitter, in natural ref order so RNG
 * draws are consumed deterministically. Components without a parseable
 * value are skipped — the emitter's default-with-note path applies.
 */
function jitterTargets(
  graph: DesignGraph,
  parts: PartDb,
  tolerances: Record<JitterClass, number>,
): JitterTarget[] {
  const targets: JitterTarget[] = [];
  for (const component of graph.components.values()) {
    if (component.dnp) continue;
    const part = parts.get(component.partId, component.partRev);
    if (!part || !isJitterClass(part.class)) continue;
    const cls = part.class;
    const raw = component.value;
    if (raw === undefined || raw.trim() === '') continue;
    const parsed = parseValue(raw, cls);
    if ('error' in parsed) continue;
    targets.push({ id: component.id, ref: component.ref, cls, value: parsed.value, tol: tolerances[cls] });
  }
  return targets.sort((a, b) => compareRefs(a.ref, b.ref));
}

/** One pre-built Monte Carlo deck: the netlist body plus its jitters. */
export interface McDeck {
  /** Netlist body (no analysis card, no `.end`). */
  netlist: string;
  /** ref → value multiplier drawn for this trial. */
  jitter: Record<string, number>;
}

export interface MonteCarloPlan {
  /** One deck per trial, in trial order. */
  decks: McDeck[];
  /** Fidelity manifest (identical across trials — jitter never changes tiers). */
  manifest: FidelityEntry[];
  /** The seed actually used — feed it back for an identical plan. */
  seed: number;
}

/**
 * Build every trial's netlist WITHOUT running anything: validates the
 * spec, draws the seeded jitters, and emits one deck per trial. This is
 * the graph-side half of a Monte Carlo run — callers that execute SPICE
 * elsewhere (the app's sim worker) ship these bodies over the wire and
 * zip the results back up with each deck's jitter.
 */
export function planMonteCarloNetlists(
  graph: DesignGraph,
  parts: PartDb,
  spec: MonteCarloSpec,
  opts: Pick<SimulateOpts, 'title' | 'valueOverrides'> = {},
): MonteCarloPlan {
  if (!Number.isInteger(spec.runs) || spec.runs < 1) {
    throw new Error(`runs must be a positive integer (got ${String(spec.runs)})`);
  }
  const tolerances: Record<JitterClass, number> = { ...DEFAULT_TOLERANCES, ...spec.tolerances };
  for (const [cls, tol] of Object.entries(tolerances)) {
    if (!Number.isFinite(tol) || tol < 0) {
      throw new Error(`tolerance for ${cls} must be a finite number >= 0 (got ${String(tol)})`);
    }
  }

  const seed = (spec.seed ?? Math.floor(Math.random() * 0x100000000)) >>> 0;
  const rand = mulberry32(seed);
  const targets = jitterTargets(graph, parts, tolerances);

  const decks: McDeck[] = [];
  let manifest: FidelityEntry[] = [];
  for (let trial = 0; trial < spec.runs; trial++) {
    const overrides = new Map<Uuid, string>(opts.valueOverrides ?? []);
    const jitter: Record<string, number> = {};
    for (const target of targets) {
      const multiplier = 1 + target.tol * (2 * rand() - 1);
      jitter[target.ref] = multiplier;
      overrides.set(target.id, siValueString(target.value * multiplier, UNIT_LETTER[target.cls]));
    }
    const { netlist, manifest: trialManifest } = generateSpiceNetlist(graph, parts, {
      title: opts.title,
      valueOverrides: overrides,
    });
    if (trial === 0) manifest = trialManifest;
    decks.push({ netlist, jitter });
  }
  return { decks, manifest, seed };
}

export async function simulateMonteCarlo(
  graph: DesignGraph,
  parts: PartDb,
  spec: MonteCarloSpec,
  opts: SimulateOpts = {},
): Promise<MonteCarloResult> {
  const plan = planMonteCarloNetlists(graph, parts, spec, {
    title: opts.title,
    valueOverrides: opts.valueOverrides,
  });

  const engine = opts.engine ?? new SpiceEngine();
  const trials: McTrial[] = [];
  try {
    for (let trial = 0; trial < plan.decks.length; trial++) {
      const deck = plan.decks[trial];
      if (!deck) continue;
      const result = await engine.run(deck.netlist, spec.base);
      trials.push({ ...result, trial, jitter: deck.jitter });
    }
  } finally {
    if (opts.engine === undefined) await engine.stop();
  }
  return { trials, manifest: plan.manifest, seed: plan.seed };
}
