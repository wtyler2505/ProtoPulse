/**
 * Accessibility Audit Dashboard
 *
 * Tracks, scores, and grades accessibility (a11y) compliance across the
 * ProtoPulse UI.  Each check maps to a WCAG criterion and one of six
 * categories.  The engine aggregates pass/fail/manual statuses into a
 * 0-100 score with a letter grade and per-category breakdowns.
 *
 * Pure TypeScript — no React dependencies.  Pair with a React hook or
 * component for live dashboard rendering.
 *
 * Usage:
 *   const checks: A11yAuditCheck[] = [ ... ];
 *   const result = runAccessibilityAudit(checks);
 *   console.log(result.score, result.grade);
 *
 *   // Track a fix over time
 *   const updated = trackFix(result, 'contrast-btn-primary');
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The six categories that every audit item belongs to. */
export type A11yAuditCategory =
  | 'contrast'
  | 'keyboard'
  | 'screen_reader'
  | 'focus'
  | 'motion'
  | 'touch';

/** Status of an individual check. */
export type A11yAuditStatus = 'pass' | 'fail' | 'manual';

/** WCAG conformance level. */
export type WcagLevel = 'A' | 'AA' | 'AAA';

/** A single audit item (resolved from a check). */
export interface A11yAuditItem {
  id: string;
  category: A11yAuditCategory;
  description: string;
  status: A11yAuditStatus;
  wcagLevel: WcagLevel;
  /** ISO timestamp when this item was marked fixed (pass after previously failing). */
  fixedAt?: string;
  /** Optional WCAG criterion reference, e.g. "1.4.3". */
  wcagCriterion?: string;
  /** Severity weight override (1-10, default derived from wcagLevel). */
  severity?: number;
}

/** Input check definition — before it has been evaluated. */
export interface A11yAuditCheck {
  id: string;
  category: A11yAuditCategory;
  description: string;
  wcagLevel: WcagLevel;
  /** A synchronous predicate that returns the check status. */
  evaluate: () => A11yAuditStatus;
  wcagCriterion?: string;
  severity?: number;
}

/** Per-category breakdown in the audit result. */
export interface A11yCategoryBreakdown {
  category: A11yAuditCategory;
  total: number;
  passed: number;
  failed: number;
  manual: number;
  score: number;
}

/** Overall audit result. */
export interface A11yAuditResult {
  items: A11yAuditItem[];
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  passRate: number;
  byCategory: Record<A11yAuditCategory, A11yCategoryBreakdown>;
  timestamp: string;
  totalChecks: number;
  failedChecks: number;
  manualChecks: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** All valid categories in deterministic order. */
export const ALL_CATEGORIES: readonly A11yAuditCategory[] = [
  'contrast',
  'keyboard',
  'screen_reader',
  'focus',
  'motion',
  'touch',
] as const;

/** Default severity weight by WCAG level (higher = more impactful). */
const LEVEL_SEVERITY: Record<WcagLevel, number> = {
  A: 10,
  AA: 7,
  AAA: 4,
};

/** Grade thresholds — first match wins. */
const GRADE_THRESHOLDS: Array<{ min: number; grade: A11yAuditResult['grade'] }> = [
  { min: 90, grade: 'A' },
  { min: 80, grade: 'B' },
  { min: 70, grade: 'C' },
  { min: 60, grade: 'D' },
  { min: 0, grade: 'F' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(val: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, val));
}

function severityFor(item: Pick<A11yAuditItem, 'wcagLevel' | 'severity'>): number {
  return item.severity ?? LEVEL_SEVERITY[item.wcagLevel];
}

function gradeFor(score: number): A11yAuditResult['grade'] {
  for (const t of GRADE_THRESHOLDS) {
    if (score >= t.min) {
      return t.grade;
    }
  }
  return 'F';
}

function emptyCategoryBreakdown(category: A11yAuditCategory): A11yCategoryBreakdown {
  return { category, total: 0, passed: 0, failed: 0, manual: 0, score: 100 };
}

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

/**
 * Run a full accessibility audit from a set of check definitions.
 *
 * Each check's `evaluate()` is called synchronously.  The results are
 * aggregated into a weighted 0-100 score where severity determines each
 * item's influence.  `manual` items are excluded from the score
 * calculation (they are neither pass nor fail).
 */
export function runAccessibilityAudit(checks: A11yAuditCheck[]): A11yAuditResult {
  const items: A11yAuditItem[] = checks.map((c) => ({
    id: c.id,
    category: c.category,
    description: c.description,
    status: c.evaluate(),
    wcagLevel: c.wcagLevel,
    wcagCriterion: c.wcagCriterion,
    severity: c.severity,
  }));

  return buildResult(items);
}

/**
 * Build an audit result from pre-evaluated items (useful when items are
 * already resolved, e.g. loaded from storage).
 */
export function buildResult(items: A11yAuditItem[]): A11yAuditResult {
  // ---- per-category buckets ----
  const byCategory = {} as Record<A11yAuditCategory, A11yCategoryBreakdown>;
  for (const cat of ALL_CATEGORIES) {
    byCategory[cat] = emptyCategoryBreakdown(cat);
  }

  let weightedSum = 0;
  let totalWeight = 0;
  let failedChecks = 0;
  let manualChecks = 0;

  for (const item of items) {
    const bucket = byCategory[item.category];
    bucket.total++;

    const sev = severityFor(item);

    if (item.status === 'pass') {
      bucket.passed++;
      weightedSum += sev;
      totalWeight += sev;
    } else if (item.status === 'fail') {
      bucket.failed++;
      failedChecks++;
      // fail contributes 0 to weightedSum but counts in totalWeight
      totalWeight += sev;
    } else {
      // 'manual' — excluded from scoring
      bucket.manual++;
      manualChecks++;
    }
  }

  // ---- per-category scores ----
  for (const cat of ALL_CATEGORIES) {
    const b = byCategory[cat];
    const scorable = b.passed + b.failed;
    b.score = scorable === 0 ? 100 : Math.round((b.passed / scorable) * 100);
  }

  // ---- overall score ----
  const rawScore = totalWeight === 0 ? 100 : (weightedSum / totalWeight) * 100;
  const score = clamp(Math.round(rawScore), 0, 100);

  // ---- pass rate (pass / (pass + fail), excluding manual) ----
  const scorable = items.filter((i) => i.status !== 'manual').length;
  const passed = items.filter((i) => i.status === 'pass').length;
  const passRate = scorable === 0 ? 1 : passed / scorable;

  return {
    items,
    score,
    grade: gradeFor(score),
    passRate,
    byCategory,
    timestamp: new Date().toISOString(),
    totalChecks: items.length,
    failedChecks,
    manualChecks,
  };
}

// ---------------------------------------------------------------------------
// Score / Grade utilities (operate on a pre-built result)
// ---------------------------------------------------------------------------

/**
 * Re-derive the numeric score from an existing result's items.
 * Useful after mutating items in-place (e.g. via `trackFix`).
 */
export function getAuditScore(items: A11yAuditItem[]): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const item of items) {
    if (item.status === 'manual') {
      continue;
    }
    const sev = severityFor(item);
    totalWeight += sev;
    if (item.status === 'pass') {
      weightedSum += sev;
    }
  }

  return totalWeight === 0 ? 100 : clamp(Math.round((weightedSum / totalWeight) * 100), 0, 100);
}

/** Map a numeric score to a letter grade. */
export function getAuditGrade(score: number): A11yAuditResult['grade'] {
  return gradeFor(score);
}

// ---------------------------------------------------------------------------
// Fix tracking
// ---------------------------------------------------------------------------

/**
 * Mark an item as fixed (status → pass, fixedAt → now).
 *
 * Returns a **new** `A11yAuditResult` with updated items, score, and
 * grade.  The original result is not mutated.
 *
 * Throws if `itemId` is not found in the result.
 */
export function trackFix(result: A11yAuditResult, itemId: string): A11yAuditResult {
  const idx = result.items.findIndex((i) => i.id === itemId);
  if (idx === -1) {
    throw new Error(`A11y audit item not found: ${itemId}`);
  }

  const original = result.items[idx];
  if (original.status === 'pass') {
    // Already passing — return unchanged result.
    return result;
  }

  const updatedItems: A11yAuditItem[] = result.items.map((item, i) =>
    i === idx ? { ...item, status: 'pass' as const, fixedAt: new Date().toISOString() } : item,
  );

  return buildResult(updatedItems);
}

// ---------------------------------------------------------------------------
// Filtering helpers
// ---------------------------------------------------------------------------

/** Return items matching a specific category. */
export function filterByCategory(items: A11yAuditItem[], category: A11yAuditCategory): A11yAuditItem[] {
  return items.filter((i) => i.category === category);
}

/** Return items matching a specific status. */
export function filterByStatus(items: A11yAuditItem[], status: A11yAuditStatus): A11yAuditItem[] {
  return items.filter((i) => i.status === status);
}

/** Return items matching a specific WCAG level. */
export function filterByWcagLevel(items: A11yAuditItem[], level: WcagLevel): A11yAuditItem[] {
  return items.filter((i) => i.wcagLevel === level);
}

/** Return failed items sorted by severity (most severe first). */
export function getFailuresByPriority(items: A11yAuditItem[]): A11yAuditItem[] {
  return items
    .filter((i) => i.status === 'fail')
    .sort((a, b) => severityFor(b) - severityFor(a));
}
