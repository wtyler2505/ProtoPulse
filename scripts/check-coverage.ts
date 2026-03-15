import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Coverage thresholds — CI gate fails if any metric falls below these.
 * Values are percentages (0–100).
 */
export interface CoverageThresholds {
  lines: number;
  branches: number;
  functions: number;
  statements: number;
}

export const DEFAULT_THRESHOLDS: CoverageThresholds = {
  lines: 60,
  branches: 50,
  functions: 55,
  statements: 60,
};

/**
 * Shape of a single file entry in Vitest/Istanbul `coverage-summary.json`.
 */
export interface CoverageSummaryEntry {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
}

export interface CoverageSummaryFile {
  lines: CoverageSummaryEntry;
  statements: CoverageSummaryEntry;
  functions: CoverageSummaryEntry;
  branches: CoverageSummaryEntry;
}

/**
 * The full `coverage-summary.json` shape — keyed by file path, plus a
 * top-level `"total"` key with aggregated numbers.
 */
export interface CoverageSummary {
  total: CoverageSummaryFile;
  [filePath: string]: CoverageSummaryFile;
}

export type MetricName = keyof CoverageThresholds;

export interface CoverageCheckFailure {
  metric: MetricName;
  actual: number;
  threshold: number;
}

export interface CoverageCheckResult {
  passed: boolean;
  failures: CoverageCheckFailure[];
  totals: Record<MetricName, number>;
}

/**
 * Validates a parsed coverage summary against the given thresholds.
 */
export function checkCoverage(
  summary: CoverageSummary,
  thresholds: CoverageThresholds = DEFAULT_THRESHOLDS,
): CoverageCheckResult {
  const total = summary.total;
  if (!total) {
    return {
      passed: false,
      failures: [],
      totals: { lines: 0, branches: 0, functions: 0, statements: 0 },
    };
  }

  const metrics: MetricName[] = ['lines', 'branches', 'functions', 'statements'];
  const totals: Record<MetricName, number> = {
    lines: 0,
    branches: 0,
    functions: 0,
    statements: 0,
  };
  const failures: CoverageCheckFailure[] = [];

  for (const metric of metrics) {
    const pct = total[metric].pct;
    totals[metric] = pct;
    if (pct < thresholds[metric]) {
      failures.push({
        metric,
        actual: pct,
        threshold: thresholds[metric],
      });
    }
  }

  return {
    passed: failures.length === 0,
    failures,
    totals,
  };
}

/**
 * Loads and parses a coverage-summary.json file from disk.
 */
export async function loadCoverageSummary(coverageDir: string): Promise<CoverageSummary> {
  const summaryPath = resolve(coverageDir, 'coverage-summary.json');
  const raw = await readFile(summaryPath, 'utf-8');
  return JSON.parse(raw) as CoverageSummary;
}

/**
 * Formats check results into human-readable lines for CI output.
 */
export function formatResults(result: CoverageCheckResult): string {
  const lines: string[] = ['Coverage Report:'];

  const metrics: MetricName[] = ['lines', 'branches', 'functions', 'statements'];
  for (const metric of metrics) {
    const pct = result.totals[metric];
    const fail = result.failures.find((f) => f.metric === metric);
    const status = fail ? 'FAIL' : 'PASS';
    const threshold = fail ? ` (threshold: ${String(fail.threshold)}%)` : '';
    lines.push(`  ${metric}: ${String(pct)}% [${status}]${threshold}`);
  }

  if (!result.passed) {
    lines.push('');
    lines.push('Coverage gate FAILED.');
  } else {
    lines.push('');
    lines.push('Coverage gate passed.');
  }

  return lines.join('\n');
}

/**
 * Parses threshold overrides from CLI arguments.
 * Accepts `--lines=70 --branches=55 --functions=60 --statements=65`.
 */
export function parseThresholdArgs(args: string[]): Partial<CoverageThresholds> {
  const overrides: Partial<CoverageThresholds> = {};
  const validKeys = new Set<MetricName>(['lines', 'branches', 'functions', 'statements']);

  for (const arg of args) {
    const match = /^--(\w+)=(\d+(?:\.\d+)?)$/.exec(arg);
    if (match) {
      const key = match[1] as MetricName;
      if (validKeys.has(key)) {
        overrides[key] = parseFloat(match[2]);
      }
    }
  }

  return overrides;
}

/**
 * Parses the coverage directory from CLI arguments.
 * Accepts `--coverage-dir=path/to/coverage`.
 */
export function parseCoverageDirArg(args: string[]): string | undefined {
  for (const arg of args) {
    const match = /^--coverage-dir=(.+)$/.exec(arg);
    if (match) {
      return match[1];
    }
  }
  return undefined;
}

/**
 * Main entry point — runs when this file is executed directly.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const coverageDir = parseCoverageDirArg(args) ?? resolve(process.cwd(), 'coverage');
  const overrides = parseThresholdArgs(args);
  const thresholds: CoverageThresholds = { ...DEFAULT_THRESHOLDS, ...overrides };

  let summary: CoverageSummary;
  try {
    summary = await loadCoverageSummary(coverageDir);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to load coverage summary from ${coverageDir}: ${message}`);
    process.exit(2);
  }

  const result = checkCoverage(summary, thresholds);
  console.log(formatResults(result));

  if (!result.passed) {
    process.exit(1);
  }
}

// Only run main when executed directly (not imported as a module)
const isDirectExecution = process.argv[1]?.endsWith('check-coverage.ts') ?? false;
if (isDirectExecution) {
  void main();
}
