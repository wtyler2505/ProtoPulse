/**
 * CI Coverage Gates
 *
 * Evaluates code coverage results against configurable thresholds and
 * produces pass/fail verdicts, quality grades, and human-readable reports.
 * Designed for CI pipelines that need to enforce minimum coverage standards
 * per file and overall.
 *
 * Usage:
 *   const result = evaluateCoverage(fileResults, DEFAULT_THRESHOLDS);
 *   console.log(result.passed, getQualityGrade(result.overallCoverage));
 *   console.log(formatCoverageReport(result));
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CoverageThreshold {
  /** Statement coverage percentage (0-100) */
  statements: number;
  /** Branch coverage percentage (0-100) */
  branches: number;
  /** Function coverage percentage (0-100) */
  functions: number;
  /** Line coverage percentage (0-100) */
  lines: number;
}

export interface CoverageResult {
  /** Source file path */
  file: string;
  /** Actual measured coverage */
  actual: CoverageThreshold;
  /** Required coverage thresholds */
  required: CoverageThreshold;
}

export interface CoverageFailure {
  /** Source file path */
  file: string;
  /** Which metric failed */
  metric: keyof CoverageThreshold;
  /** Actual coverage percentage */
  actual: number;
  /** Required coverage percentage */
  required: number;
  /** Shortfall (required - actual) */
  gap: number;
}

export interface CoverageWarning {
  /** Source file path */
  file: string;
  /** Which metric is within the warning zone */
  metric: keyof CoverageThreshold;
  /** Actual coverage percentage */
  actual: number;
  /** Required coverage percentage */
  required: number;
}

export interface CoverageGateResult {
  /** Whether all files meet their thresholds */
  passed: boolean;
  /** Files and metrics that failed to meet thresholds */
  failures: CoverageFailure[];
  /** Files and metrics within WARNING_MARGIN of failing */
  warnings: CoverageWarning[];
  /** Averaged coverage across all files */
  overallCoverage: CoverageThreshold;
}

export type QualityGrade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default thresholds: 80% across all four metrics */
export const DEFAULT_THRESHOLDS: Readonly<CoverageThreshold> = {
  statements: 80,
  branches: 80,
  functions: 80,
  lines: 80,
} as const;

/** Metrics within this margin of the threshold trigger a warning */
const WARNING_MARGIN = 5;

/** All four metric keys in a stable order */
const METRIC_KEYS: ReadonlyArray<keyof CoverageThreshold> = [
  'statements',
  'branches',
  'functions',
  'lines',
] as const;

/** Grade thresholds — first match wins (descending order) */
const GRADE_THRESHOLDS: ReadonlyArray<{ min: number; grade: QualityGrade }> = [
  { min: 95, grade: 'A+' },
  { min: 90, grade: 'A' },
  { min: 80, grade: 'B' },
  { min: 70, grade: 'C' },
  { min: 60, grade: 'D' },
  { min: 0, grade: 'F' },
];

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function isValidPercent(value: number): boolean {
  return typeof value === 'number' && !Number.isNaN(value) && value >= 0 && value <= 100;
}

function validateThreshold(threshold: CoverageThreshold, label: string): void {
  for (const key of METRIC_KEYS) {
    if (!isValidPercent(threshold[key])) {
      throw new RangeError(`${label}.${key} must be a number between 0 and 100, got ${String(threshold[key])}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Core evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate a set of per-file coverage results against their thresholds.
 *
 * Each CoverageResult carries both the actual measured coverage and the
 * required thresholds. The `thresholds` parameter provides global defaults
 * that apply when individual results don't carry their own.
 */
export function evaluateCoverage(
  results: CoverageResult[],
  thresholds: CoverageThreshold = DEFAULT_THRESHOLDS,
): CoverageGateResult {
  validateThreshold(thresholds, 'thresholds');

  const failures: CoverageFailure[] = [];
  const warnings: CoverageWarning[] = [];

  // Accumulators for overall average
  const sums: CoverageThreshold = { statements: 0, branches: 0, functions: 0, lines: 0 };

  for (const result of results) {
    const required = result.required;
    const actual = result.actual;

    for (const metric of METRIC_KEYS) {
      const actualVal = clampPercent(actual[metric]);
      const requiredVal = required[metric];

      sums[metric] += actualVal;

      if (actualVal < requiredVal) {
        failures.push({
          file: result.file,
          metric,
          actual: actualVal,
          required: requiredVal,
          gap: Math.round((requiredVal - actualVal) * 100) / 100,
        });
      } else if (actualVal < requiredVal + WARNING_MARGIN) {
        warnings.push({
          file: result.file,
          metric,
          actual: actualVal,
          required: requiredVal,
        });
      }
    }
  }

  const count = results.length;
  const overallCoverage: CoverageThreshold =
    count === 0
      ? { statements: 0, branches: 0, functions: 0, lines: 0 }
      : {
          statements: Math.round((sums.statements / count) * 100) / 100,
          branches: Math.round((sums.branches / count) * 100) / 100,
          functions: Math.round((sums.functions / count) * 100) / 100,
          lines: Math.round((sums.lines / count) * 100) / 100,
        };

  return {
    passed: failures.length === 0,
    failures,
    warnings,
    overallCoverage,
  };
}

// ---------------------------------------------------------------------------
// Quality grade
// ---------------------------------------------------------------------------

/**
 * Compute a letter grade from a coverage threshold by averaging all four
 * metrics and mapping to A+/A/B/C/D/F.
 */
export function getQualityGrade(coverage: CoverageThreshold): QualityGrade {
  const avg = (coverage.statements + coverage.branches + coverage.functions + coverage.lines) / 4;

  for (const { min, grade } of GRADE_THRESHOLDS) {
    if (avg >= min) {
      return grade;
    }
  }

  // Unreachable — last threshold has min: 0
  return 'F';
}

// ---------------------------------------------------------------------------
// Report formatting
// ---------------------------------------------------------------------------

/**
 * Produce a multi-line human-readable coverage report suitable for CI logs.
 */
export function formatCoverageReport(result: CoverageGateResult): string {
  const lines: string[] = [];

  const grade = getQualityGrade(result.overallCoverage);
  const status = result.passed ? 'PASSED' : 'FAILED';

  lines.push(`Coverage Gate: ${status}  [Grade: ${grade}]`);
  lines.push('');

  // Overall coverage
  lines.push('Overall Coverage:');
  for (const metric of METRIC_KEYS) {
    const value = result.overallCoverage[metric];
    lines.push(`  ${metric}: ${value.toFixed(2)}%`);
  }
  lines.push('');

  // Failures
  if (result.failures.length > 0) {
    lines.push(`Failures (${String(result.failures.length)}):`);
    for (const f of result.failures) {
      lines.push(`  ${f.file} — ${f.metric}: ${f.actual.toFixed(2)}% < ${f.required.toFixed(2)}% (gap: ${f.gap.toFixed(2)}%)`);
    }
    lines.push('');
  }

  // Warnings
  if (result.warnings.length > 0) {
    lines.push(`Warnings (${String(result.warnings.length)}):`);
    for (const w of result.warnings) {
      lines.push(`  ${w.file} — ${w.metric}: ${w.actual.toFixed(2)}% (threshold: ${w.required.toFixed(2)}%)`);
    }
    lines.push('');
  }

  // Summary
  if (result.failures.length === 0 && result.warnings.length === 0) {
    lines.push('All files meet coverage thresholds with no warnings.');
  }

  return lines.join('\n');
}
