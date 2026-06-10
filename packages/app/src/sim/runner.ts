import type { Analysis, FidelityEntry, SimModule, SimResultWithManifest, SimulateFn } from './types.js';
import type { DesignGraph } from '@protopulse/graph';
import type { PartDb } from '@protopulse/parts';

/**
 * Simulation runner: wraps the LAZY '@protopulse/sim' import (engine
 * boot costs seconds; never pay it at app startup), caches the last
 * result per (branch, opsVersion, analysis-JSON) so re-renders don't
 * re-run, and surfaces errors as values — the panel renders them, it
 * never catches.
 */

export type SimOutcome =
  | { ok: true; result: SimResultWithManifest; fidelity: string }
  | { ok: false; error: string };

export interface SimRunKey {
  branch: string;
  opsVersion: number;
}

type SimModuleLoader = () => Promise<Partial<SimModule>>;

const defaultLoader: SimModuleLoader = async () =>
  // Pinned API cast — the stub index exports nothing yet; runtime-checked below.
  (await import('@protopulse/sim')) as unknown as Partial<SimModule>;

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
  /** Uncached raw simulate for the Analyst (the agent decides when to run);
   *  throws if the engine is unavailable — the agent loop reports it. */
  simulate: SimulateFn;
}

export function createSimRunner(loader: SimModuleLoader = defaultLoader): SimRunner {
  let modulePromise: Promise<Partial<SimModule>> | null = null;
  let cacheKey: string | null = null;
  let cached: SimOutcome | null = null;

  const load = (): Promise<Partial<SimModule>> => (modulePromise ??= loader());

  const simulate: SimulateFn = async (graph, parts, analysis) => {
    const mod = await load();
    if (typeof mod.simulate !== 'function') {
      throw new Error('simulation engine not available yet — @protopulse/sim is a stub in this build');
    }
    return mod.simulate(graph, parts, analysis);
  };

  const run = async (
    graph: DesignGraph,
    parts: PartDb,
    analysis: Analysis,
    key: SimRunKey,
  ): Promise<SimOutcome> => {
    const k = `${key.branch}@${String(key.opsVersion)}@${JSON.stringify(analysis)}`;
    if (cacheKey === k && cached?.ok) return cached;

    let outcome: SimOutcome;
    try {
      const mod = await load();
      const result = await simulate(graph, parts, analysis);
      const fidelity =
        typeof mod.fidelitySummary === 'function'
          ? mod.fidelitySummary(result.manifest)
          : fallbackFidelitySummary(result.manifest);
      outcome = { ok: true, result, fidelity };
    } catch (err) {
      outcome = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    // Errors are remembered but never served from cache — a retry re-runs.
    cacheKey = k;
    cached = outcome;
    return outcome;
  };

  return { run, simulate };
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

/** The real engine's simulate(), lazily loaded — wired into the Analyst. */
export const simulateViaEngine: SimulateFn = (graph, parts, analysis) =>
  simRunner.simulate(graph, parts, analysis);
