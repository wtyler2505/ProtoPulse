import type { DesignGraph, OpBody } from '@protopulse/graph';
import type { PartDb } from '@protopulse/parts';

// Pinned @protopulse/review API (v0.3); swap to direct import after the
// review track lands. The review package is built on a parallel track —
// these local declarations keep the app typechecking (and its tests
// running against mocks) independent of that track's timing. The shapes
// are the contract; the module itself is loaded LAZILY in runner.ts.

/** Review anchors are a superset of ERC anchors; only kind is pinned. */
export interface ReviewAnchor {
  kind: string;
  [k: string]: unknown;
}

export interface ReviewFinding {
  severity: 'error' | 'warn' | 'info';
  code: string;
  message: string;
  anchors: ReviewAnchor[];
  /** Executable fix ops (pinned as OpBody[]); dispatched like ERC fixes. */
  fix?: OpBody[];
  /** Id of the check that produced this finding. */
  check: string;
}

export interface ReviewReport {
  tool: 'protopulse-review';
  /** Deck name the run was pinned to ('builtin' when none was given). */
  deck?: string;
  deckRev: string;
  date: string;
  counts: { error: number; warn: number; info: number };
  findings: ReviewFinding[];
}

/** Per-check deck configuration (pinned mirror of @protopulse/review's
 *  ReviewCheckConfig). Absent check ids run with defaults. */
export interface ReviewCheckConfig {
  enabled?: boolean;
  severity?: 'error' | 'warn' | 'info';
}

/** A versioned review deck — structural, anything matching works. */
export interface ReviewDeckLike {
  deck: string;
  rev: string;
  checks: Record<string, ReviewCheckConfig>;
}

export interface ReviewRunOpts {
  date: string;
  designId?: string;
  branch?: string;
  /** Versioned deck to run under; absent = 'builtin' (all defaults). */
  deck?: ReviewDeckLike;
}

export type RunReviewFn = (graph: DesignGraph, parts: PartDb, opts: ReviewRunOpts) => ReviewReport;

export interface ReviewDelta {
  opened: ReviewFinding[];
  closed: ReviewFinding[];
}

export type DiffReportsFn = (a: ReviewReport, b: ReviewReport) => ReviewDelta;

/** Shape of the lazily imported '@protopulse/review' module. Partial in
 *  practice until the review track lands — runner.ts checks at runtime. */
export interface ReviewModule {
  runReview: RunReviewFn;
  diffReports: DiffReportsFn;
}
