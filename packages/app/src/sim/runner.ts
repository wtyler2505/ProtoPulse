import type {
  Analysis,
  FidelityEntry,
  MonteCarloResult,
  MonteCarloSpec,
  SimModule,
  SimResultWithManifest,
  SimulateFn,
  StepResult,
  StepSpec,
} from './types.js';
import type { DesignGraph } from '@protopulse/graph';
import type { PartDb } from '@protopulse/parts';

/**
 * Simulation runner: wraps the LAZY '@protopulse/sim' import (engine
 * boot costs seconds; never pay it at app startup), caches results per
 * (mode, branch, opsVersion, spec-JSON) so re-renders and branch-overlay
 * pairs don't re-run, and surfaces errors as values — the panel renders
 * them, it never catches. Errors are never served from cache: a retry
 * re-runs.
 */

export type SimOutcome =
  | { ok: true; result: SimResultWithManifest; fidelity: string }
  | { ok: false; error: string };

export type McOutcome =
  | { ok: true; result: MonteCarloResult; fidelity: string }
  | { ok: false; error: string };

export type StepOutcome =
  | { ok: true; result: StepResult; fidelity: string }
  | { ok: false; error: string };

export interface SimRunKey {
  branch: string;
  opsVersion: number;
}

type SimModuleLoader = () => Promise<Partial<SimModule>>;

const defaultLoader: SimModuleLoader = async () =>
  // Pinned API cast — the stub index exports nothing yet; runtime-checked below.
  (await import('@protopulse/sim')) as unknown as Partial<SimModule>;

/** Keep the primary + overlay + a few alternates without unbounded growth. */
const CACHE_LIMIT = 16;

/** Fallback used until the engine ships its own fidelitySummary(). */
export function fallbackFidelitySummary(manifest: FidelityEntry[]): string {
  if (manifest.length === 0) return 'Fidelity: no models in manifest';
  const tiers = ['spice', 'behavioral', 'stub'] as const;
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

export interface SimRunner {
  run: (
    graph: DesignGraph,
    parts: PartDb,
    analysis: Analysis,
    key: SimRunKey,
  ) => Promise<SimOutcome>;
  runMonteCarlo: (
    graph: DesignGraph,
    parts: PartDb,
    spec: MonteCarloSpec,
    key: SimRunKey,
  ) => Promise<McOutcome>;
  runStep: (
    graph: DesignGraph,
    parts: PartDb,
    spec: StepSpec,
    key: SimRunKey,
  ) => Promise<StepOutcome>;
  /** Uncached raw simulate for the Analyst (the agent decides when to run);
   *  throws if the engine is unavailable — the agent loop reports it. */
  simulate: SimulateFn;
}

export function createSimRunner(loader: SimModuleLoader = defaultLoader): SimRunner {
  let modulePromise: Promise<Partial<SimModule>> | null = null;
  const cache = new Map<string, { ok: true; result: unknown; fidelity: string } | { ok: false; error: string }>();

  const load = (): Promise<Partial<SimModule>> => (modulePromise ??= loader());

  const simulate: SimulateFn = async (graph, parts, analysis) => {
    const mod = await load();
    if (typeof mod.simulate !== 'function') {
      throw new Error('simulation engine not available yet — @protopulse/sim is a stub in this build');
    }
    return mod.simulate(graph, parts, analysis);
  };

  /** Shared cache + error-as-value wrapper for all three run modes. */
  const runCached = async <R>(
    cacheKey: string,
    exec: (mod: Partial<SimModule>) => Promise<{ result: R; manifest: FidelityEntry[] }>,
  ): Promise<{ ok: true; result: R; fidelity: string } | { ok: false; error: string }> => {
    const hit = cache.get(cacheKey);
    // Errors are remembered but never served from cache — a retry re-runs.
    if (hit?.ok) return hit as { ok: true; result: R; fidelity: string };

    let outcome: { ok: true; result: R; fidelity: string } | { ok: false; error: string };
    try {
      const mod = await load();
      const { result, manifest } = await exec(mod);
      const fidelity =
        typeof mod.fidelitySummary === 'function'
          ? mod.fidelitySummary(manifest)
          : fallbackFidelitySummary(manifest);
      outcome = { ok: true, result, fidelity };
    } catch (err) {
      outcome = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    if (cache.size >= CACHE_LIMIT) cache.clear();
    cache.set(cacheKey, outcome);
    return outcome;
  };

  const run = (
    graph: DesignGraph,
    parts: PartDb,
    analysis: Analysis,
    key: SimRunKey,
  ): Promise<SimOutcome> =>
    runCached(
      `sim:${key.branch}@${String(key.opsVersion)}@${JSON.stringify(analysis)}`,
      async (_mod) => {
        const result = await simulate(graph, parts, analysis);
        return { result, manifest: result.manifest };
      },
    );

  const runMonteCarlo = (
    graph: DesignGraph,
    parts: PartDb,
    spec: MonteCarloSpec,
    key: SimRunKey,
  ): Promise<McOutcome> =>
    runCached(`mc:${key.branch}@${String(key.opsVersion)}@${JSON.stringify(spec)}`, async (mod) => {
      if (typeof mod.simulateMonteCarlo !== 'function') {
        throw new Error(
          'Monte Carlo not available yet — this @protopulse/sim build lacks simulateMonteCarlo',
        );
      }
      const result = await mod.simulateMonteCarlo(graph, parts, spec);
      return { result, manifest: result.manifest };
    });

  const runStep = (
    graph: DesignGraph,
    parts: PartDb,
    spec: StepSpec,
    key: SimRunKey,
  ): Promise<StepOutcome> =>
    runCached(`step:${key.branch}@${String(key.opsVersion)}@${JSON.stringify(spec)}`, async (mod) => {
      if (typeof mod.simulateStep !== 'function') {
        throw new Error('Stepping not available yet — this @protopulse/sim build lacks simulateStep');
      }
      const result = await mod.simulateStep(graph, parts, spec);
      return { result, manifest: result.manifest };
    });

  return { run, runMonteCarlo, runStep, simulate };
}

/** The app-wide runner instance. */
export const simRunner: SimRunner = createSimRunner();

/** Cached panel entry point. */
export function runSimulation(
  graph: DesignGraph,
  parts: PartDb,
  analysis: Analysis,
  key: SimRunKey,
): Promise<SimOutcome> {
  return simRunner.run(graph, parts, analysis, key);
}

/** Cached Monte Carlo entry point. */
export function runMonteCarlo(
  graph: DesignGraph,
  parts: PartDb,
  spec: MonteCarloSpec,
  key: SimRunKey,
): Promise<McOutcome> {
  return simRunner.runMonteCarlo(graph, parts, spec, key);
}

/** Cached parameter-step entry point. */
export function runStep(
  graph: DesignGraph,
  parts: PartDb,
  spec: StepSpec,
  key: SimRunKey,
): Promise<StepOutcome> {
  return simRunner.runStep(graph, parts, spec, key);
}

/** The real engine's simulate(), lazily loaded — wired into the Analyst. */
export const simulateViaEngine: SimulateFn = (graph, parts, analysis) =>
  simRunner.simulate(graph, parts, analysis);
