import { emptyGraph } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { describe, expect, it, vi } from 'vitest';

import { createReviewRunner } from './runner.js';

import type { ReviewFinding, ReviewModule, ReviewReport, ReviewRunOpts } from './types.js';

const graph = emptyGraph();
const parts = seedPartDb();
const OPTS: ReviewRunOpts = { date: '2026-06-10', designId: 'd1', branch: 'main' };

function finding(code: string, severity: ReviewFinding['severity'] = 'warn'): ReviewFinding {
  return { severity, code, message: `msg ${code}`, anchors: [], check: 'check-topology' };
}

function report(findings: ReviewFinding[], deckRev = 'deck-1'): ReviewReport {
  return {
    tool: 'protopulse-review',
    deckRev,
    date: '2026-06-10',
    counts: {
      error: findings.filter((f) => f.severity === 'error').length,
      warn: findings.filter((f) => f.severity === 'warn').length,
      info: findings.filter((f) => f.severity === 'info').length,
    },
    findings,
  };
}

/** Mocked @protopulse/review honoring the pinned API. */
function mockModule(reports: ReviewReport[]): {
  loader: () => Promise<Partial<ReviewModule>>;
  runReview: ReturnType<typeof vi.fn>;
  diffReports: ReturnType<typeof vi.fn>;
  loads: () => number;
} {
  let cursor = 0;
  let loads = 0;
  const runReview = vi.fn((): ReviewReport => {
    const r = reports[Math.min(cursor, reports.length - 1)];
    cursor += 1;
    if (!r) throw new Error('mock exhausted');
    return r;
  });
  const diffReports = vi.fn((a: ReviewReport, b: ReviewReport) => {
    const key = (f: ReviewFinding) => `${f.code}|${f.message}`;
    const aKeys = new Set(a.findings.map(key));
    const bKeys = new Set(b.findings.map(key));
    return {
      opened: b.findings.filter((f) => !aKeys.has(key(f))),
      closed: a.findings.filter((f) => !bKeys.has(key(f))),
    };
  });
  return {
    loader: () => {
      loads += 1;
      return Promise.resolve({ runReview, diffReports } as Partial<ReviewModule>);
    },
    runReview,
    diffReports,
    loads: () => loads,
  };
}

describe('createReviewRunner', () => {
  it('runs the review and returns the report (first run has no previous/delta)', async () => {
    const mod = mockModule([report([finding('REV-NO-DECOUPLING')])]);
    const runner = createReviewRunner(mod.loader);

    const outcome = await runner.run(graph, parts, OPTS, { branch: 'main', opsVersion: 1 });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.report.findings.map((f) => f.code)).toEqual(['REV-NO-DECOUPLING']);
      expect(outcome.previous).toBeNull();
      expect(outcome.delta).toBeNull();
    }
    expect(mod.runReview).toHaveBeenCalledTimes(1);
    expect(mod.runReview).toHaveBeenCalledWith(graph, parts, OPTS);
  });

  it('caches by (branch, opsVersion) — re-render does not re-run', async () => {
    const mod = mockModule([report([finding('REV-A')])]);
    const runner = createReviewRunner(mod.loader);
    const key = { branch: 'main', opsVersion: 3 };

    const first = await runner.run(graph, parts, OPTS, key);
    const second = await runner.run(graph, parts, OPTS, key);
    expect(mod.runReview).toHaveBeenCalledTimes(1);
    expect(mod.loads()).toBe(1); // module imported once, lazily
    expect(second).toEqual(first);
  });

  it('a new opsVersion re-runs and reports the opened/closed delta vs the previous report', async () => {
    const before = report([finding('REV-A'), finding('REV-B')]);
    const after = report([finding('REV-B'), finding('REV-C')]);
    const mod = mockModule([before, after]);
    const runner = createReviewRunner(mod.loader);

    await runner.run(graph, parts, OPTS, { branch: 'main', opsVersion: 1 });
    const outcome = await runner.run(graph, parts, OPTS, { branch: 'main', opsVersion: 2 });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.previous).toEqual(before);
      expect(outcome.delta?.opened.map((f) => f.code)).toEqual(['REV-C']);
      expect(outcome.delta?.closed.map((f) => f.code)).toEqual(['REV-A']);
    }
    expect(mod.diffReports).toHaveBeenCalledWith(before, after);
  });

  it('keeps previous reports PER BRANCH — branches do not cross-pollinate deltas', async () => {
    const mainReport = report([finding('REV-A')]);
    const expReport = report([finding('REV-Z')]);
    const mod = mockModule([mainReport, expReport]);
    const runner = createReviewRunner(mod.loader);

    await runner.run(graph, parts, OPTS, { branch: 'main', opsVersion: 1 });
    const onExp = await runner.run(
      graph,
      parts,
      { ...OPTS, branch: 'exp' },
      { branch: 'exp', opsVersion: 1 },
    );
    expect(onExp.ok).toBe(true);
    if (onExp.ok) {
      // First run ON THIS BRANCH: no previous, even though main already ran.
      expect(onExp.previous).toBeNull();
      expect(onExp.delta).toBeNull();
    }
  });

  it('the deck is part of the cache key AND the history key — decks do not cross-pollinate', async () => {
    const builtinReport = report([finding('REV-A')]);
    const deckReport = report([finding('REV-B')], 'deck-2');
    const mod = mockModule([builtinReport, deckReport]);
    const runner = createReviewRunner(mod.loader);
    const deck = { deck: 'strict', rev: '2', checks: {} };

    // Same (branch, opsVersion), two decks: both runs execute (no cache
    // collision)…
    await runner.run(graph, parts, OPTS, { branch: 'main', opsVersion: 1 });
    const underDeck = await runner.run(
      graph,
      parts,
      { ...OPTS, deck },
      { branch: 'main', opsVersion: 1 },
    );
    expect(mod.runReview).toHaveBeenCalledTimes(2);
    expect(underDeck.ok).toBe(true);
    if (underDeck.ok) {
      // …and the deck's first run has no previous — the builtin run's
      // report must not become another deck's diff baseline.
      expect(underDeck.previous).toBeNull();
      expect(underDeck.delta).toBeNull();
    }

    // The deck run is itself cached: same key, no third execution.
    await runner.run(graph, parts, { ...OPTS, deck }, { branch: 'main', opsVersion: 1 });
    expect(mod.runReview).toHaveBeenCalledTimes(2);
  });

  it('surfaces a missing runReview as an error value, not a throw', async () => {
    const runner = createReviewRunner(() => Promise.resolve({}));
    const outcome = await runner.run(graph, parts, OPTS, { branch: 'main', opsVersion: 1 });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toMatch(/design review not available yet/);
  });

  it('surfaces a throwing runReview as an error value', async () => {
    const runner = createReviewRunner(() =>
      Promise.resolve({
        runReview: () => {
          throw new Error('deck failed to parse');
        },
      }),
    );
    const outcome = await runner.run(graph, parts, OPTS, { branch: 'main', opsVersion: 1 });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toBe('deck failed to parse');
  });

  it('errors are never served from cache — a retry re-runs', async () => {
    let attempts = 0;
    const good = report([finding('REV-A')]);
    const runner = createReviewRunner(() =>
      Promise.resolve({
        runReview: () => {
          attempts += 1;
          if (attempts === 1) throw new Error('transient');
          return good;
        },
        diffReports: () => ({ opened: [], closed: [] }),
      }),
    );
    const key = { branch: 'main', opsVersion: 1 };
    const first = await runner.run(graph, parts, OPTS, key);
    expect(first.ok).toBe(false);
    const second = await runner.run(graph, parts, OPTS, key);
    expect(second.ok).toBe(true);
    expect(attempts).toBe(2);
  });

  it('works without diffReports (delta stays null) — partial pinned module', async () => {
    let cursor = 0;
    const reports = [report([finding('REV-A')]), report([finding('REV-B')])];
    const runner = createReviewRunner(() =>
      Promise.resolve({
        runReview: () => {
          const r = reports[cursor];
          cursor += 1;
          if (!r) throw new Error('exhausted');
          return r;
        },
      }),
    );
    await runner.run(graph, parts, OPTS, { branch: 'main', opsVersion: 1 });
    const second = await runner.run(graph, parts, OPTS, { branch: 'main', opsVersion: 2 });
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.previous?.findings.map((f) => f.code)).toEqual(['REV-A']);
      expect(second.delta).toBeNull();
    }
  });
});
