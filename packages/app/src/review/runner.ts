import type { ReviewDelta, ReviewModule, ReviewReport, ReviewRunOpts } from './types.js';
import type { DesignGraph } from '@protopulse/graph';
import type { PartDb } from '@protopulse/parts';

/**
 * Design-review runner: wraps the LAZY '@protopulse/review' import (the
 * package is built on a parallel track; never pay for it — or crash on
 * it — at app startup), caches reports per (branch, opsVersion) so
 * re-renders don't re-run, and surfaces errors as values — the panel
 * renders them, it never catches. Errors are never served from cache.
 *
 * It also keeps the PREVIOUS successful report per branch: every fresh
 * run is diffed against it via the module's diffReports so the panel can
 * say "N opened, M closed since last run".
 */

export type ReviewOutcome =
  | {
      ok: true;
      report: ReviewReport;
      /** The prior successful report on this branch, or null on first run. */
      previous: ReviewReport | null;
      /** diffReports(previous, report); null on the first run. */
      delta: ReviewDelta | null;
    }
  | { ok: false; error: string };

export interface ReviewRunKey {
  branch: string;
  opsVersion: number;
}

type ReviewModuleLoader = () => Promise<Partial<ReviewModule>>;



const defaultLoader: ReviewModuleLoader = async () =>
  // Pinned API cast over an opaque specifier: the package does not exist
  // in this build yet, so the import stays invisible to TS and the
  // runtime-checked below.
  (await import('@protopulse/review')) as unknown as Partial<ReviewModule>;

/** Primary branch + a few alternates without unbounded growth. */
const CACHE_LIMIT = 16;

export interface ReviewRunner {
  run: (
    graph: DesignGraph,
    parts: PartDb,
    opts: ReviewRunOpts,
    key: ReviewRunKey,
  ) => Promise<ReviewOutcome>;
}

export function createReviewRunner(loader: ReviewModuleLoader = defaultLoader): ReviewRunner {
  let modulePromise: Promise<Partial<ReviewModule>> | null = null;
  const cache = new Map<string, ReviewOutcome>();
  /** Latest successful report per branch, with the key it ran under. */
  const latest = new Map<string, { cacheKey: string; report: ReviewReport }>();

  const load = (): Promise<Partial<ReviewModule>> => (modulePromise ??= loader());

  const run = async (
    graph: DesignGraph,
    parts: PartDb,
    opts: ReviewRunOpts,
    key: ReviewRunKey,
  ): Promise<ReviewOutcome> => {
    const cacheKey = `review:${key.branch}@${String(key.opsVersion)}`;
    const hit = cache.get(cacheKey);
    // Errors are remembered but never served from cache — a retry re-runs.
    if (hit?.ok) return hit;

    let outcome: ReviewOutcome;
    try {
      const mod = await load();
      if (typeof mod.runReview !== 'function') {
        throw new Error(
          'design review not available yet — @protopulse/review is not in this build',
        );
      }
      const report = mod.runReview(graph, parts, opts);
      const prior = latest.get(key.branch);
      // A cache-expired re-run of the SAME head must not become its own
      // previous; only a different (branch, opsVersion) advances history.
      const previous = prior && prior.cacheKey !== cacheKey ? prior.report : null;
      const delta =
        previous !== null && typeof mod.diffReports === 'function'
          ? mod.diffReports(previous, report)
          : null;
      latest.set(key.branch, { cacheKey, report });
      outcome = { ok: true, report, previous, delta };
    } catch (err) {
      outcome = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    if (cache.size >= CACHE_LIMIT) cache.clear();
    cache.set(cacheKey, outcome);
    return outcome;
  };

  return { run };
}

/** The app-wide runner instance. */
export const reviewRunner: ReviewRunner = createReviewRunner();

/** Cached panel entry point. */
export function runDesignReview(
  graph: DesignGraph,
  parts: PartDb,
  opts: ReviewRunOpts,
  key: ReviewRunKey,
): Promise<ReviewOutcome> {
  return reviewRunner.run(graph, parts, opts, key);
}
