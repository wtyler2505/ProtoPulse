import { describe, it, expect } from 'vitest';

import {
  checkCoverage,
  DEFAULT_THRESHOLDS,
  formatResults,
  parseCoverageDirArg,
  parseThresholdArgs,
} from '../check-coverage';
import type {
  CoverageSummary,
  CoverageSummaryFile,
  CoverageThresholds,
} from '../check-coverage';

/** Helper to build a CoverageSummaryFile with uniform percentages. */
function makeSummaryFile(pct: number): CoverageSummaryFile {
  return {
    lines: { total: 100, covered: pct, skipped: 0, pct },
    statements: { total: 100, covered: pct, skipped: 0, pct },
    functions: { total: 100, covered: pct, skipped: 0, pct },
    branches: { total: 100, covered: pct, skipped: 0, pct },
  };
}

/** Helper to build a CoverageSummaryFile with distinct metric percentages. */
function makeMixedSummaryFile(lines: number, branches: number, functions: number, statements: number): CoverageSummaryFile {
  return {
    lines: { total: 100, covered: lines, skipped: 0, pct: lines },
    branches: { total: 100, covered: branches, skipped: 0, pct: branches },
    functions: { total: 100, covered: functions, skipped: 0, pct: functions },
    statements: { total: 100, covered: statements, skipped: 0, pct: statements },
  };
}

describe('checkCoverage', () => {
  it('passes when all metrics meet default thresholds', () => {
    const summary: CoverageSummary = { total: makeSummaryFile(80) };
    const result = checkCoverage(summary);
    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it('fails when all metrics are below default thresholds', () => {
    const summary: CoverageSummary = { total: makeSummaryFile(10) };
    const result = checkCoverage(summary);
    expect(result.passed).toBe(false);
    expect(result.failures).toHaveLength(4);
  });

  it('fails only for the metric that is below threshold', () => {
    // branches threshold is 50%, rest are 60/55/60
    const summary: CoverageSummary = {
      total: makeMixedSummaryFile(70, 40, 60, 70),
    };
    const result = checkCoverage(summary);
    expect(result.passed).toBe(false);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].metric).toBe('branches');
    expect(result.failures[0].actual).toBe(40);
    expect(result.failures[0].threshold).toBe(50);
  });

  it('passes when metrics exactly equal thresholds', () => {
    const summary: CoverageSummary = {
      total: makeMixedSummaryFile(60, 50, 55, 60),
    };
    const result = checkCoverage(summary);
    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it('uses custom thresholds when provided', () => {
    const summary: CoverageSummary = { total: makeSummaryFile(90) };
    const thresholds: CoverageThresholds = {
      lines: 95,
      branches: 95,
      functions: 95,
      statements: 95,
    };
    const result = checkCoverage(summary, thresholds);
    expect(result.passed).toBe(false);
    expect(result.failures).toHaveLength(4);
    for (const f of result.failures) {
      expect(f.threshold).toBe(95);
      expect(f.actual).toBe(90);
    }
  });

  it('returns totals for all four metrics', () => {
    const summary: CoverageSummary = {
      total: makeMixedSummaryFile(65, 52, 58, 72),
    };
    const result = checkCoverage(summary);
    expect(result.totals.lines).toBe(65);
    expect(result.totals.branches).toBe(52);
    expect(result.totals.functions).toBe(58);
    expect(result.totals.statements).toBe(72);
  });

  it('handles 0% coverage gracefully', () => {
    const summary: CoverageSummary = { total: makeSummaryFile(0) };
    const result = checkCoverage(summary);
    expect(result.passed).toBe(false);
    expect(result.failures).toHaveLength(4);
    for (const f of result.failures) {
      expect(f.actual).toBe(0);
    }
  });

  it('handles 100% coverage', () => {
    const summary: CoverageSummary = { total: makeSummaryFile(100) };
    const result = checkCoverage(summary);
    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it('handles missing total by failing gracefully', () => {
    const summary = {} as CoverageSummary;
    const result = checkCoverage(summary);
    expect(result.passed).toBe(false);
    expect(result.totals.lines).toBe(0);
  });

  it('handles fractional percentages', () => {
    const summary: CoverageSummary = {
      total: makeMixedSummaryFile(59.99, 49.99, 54.99, 59.99),
    };
    const result = checkCoverage(summary);
    expect(result.passed).toBe(false);
    expect(result.failures).toHaveLength(4);
  });

  it('ignores per-file entries and only uses total', () => {
    const summary: CoverageSummary = {
      total: makeSummaryFile(80),
      'src/foo.ts': makeSummaryFile(5),
      'src/bar.ts': makeSummaryFile(2),
    };
    const result = checkCoverage(summary);
    expect(result.passed).toBe(true);
  });

  it('reports multiple failures in metric order', () => {
    const summary: CoverageSummary = {
      total: makeMixedSummaryFile(30, 20, 10, 40),
    };
    const result = checkCoverage(summary);
    expect(result.failures.map((f) => f.metric)).toEqual([
      'lines',
      'branches',
      'functions',
      'statements',
    ]);
  });
});

describe('formatResults', () => {
  it('includes PASS for passing metrics', () => {
    const summary: CoverageSummary = { total: makeSummaryFile(80) };
    const result = checkCoverage(summary);
    const output = formatResults(result);
    expect(output).toContain('[PASS]');
    expect(output).toContain('Coverage gate passed.');
    expect(output).not.toContain('[FAIL]');
  });

  it('includes FAIL and threshold for failing metrics', () => {
    const summary: CoverageSummary = {
      total: makeMixedSummaryFile(70, 30, 70, 70),
    };
    const result = checkCoverage(summary);
    const output = formatResults(result);
    expect(output).toContain('branches: 30% [FAIL] (threshold: 50%)');
    expect(output).toContain('Coverage gate FAILED.');
  });

  it('starts with Coverage Report header', () => {
    const summary: CoverageSummary = { total: makeSummaryFile(80) };
    const result = checkCoverage(summary);
    const output = formatResults(result);
    expect(output.startsWith('Coverage Report:')).toBe(true);
  });

  it('shows all four metrics', () => {
    const summary: CoverageSummary = { total: makeSummaryFile(80) };
    const result = checkCoverage(summary);
    const output = formatResults(result);
    expect(output).toContain('lines:');
    expect(output).toContain('branches:');
    expect(output).toContain('functions:');
    expect(output).toContain('statements:');
  });
});

describe('parseThresholdArgs', () => {
  it('parses all four threshold flags', () => {
    const args = ['--lines=70', '--branches=55', '--functions=60', '--statements=65'];
    const result = parseThresholdArgs(args);
    expect(result).toEqual({ lines: 70, branches: 55, functions: 60, statements: 65 });
  });

  it('returns empty object for no args', () => {
    expect(parseThresholdArgs([])).toEqual({});
  });

  it('ignores unknown flags', () => {
    const result = parseThresholdArgs(['--unknown=42', '--lines=70']);
    expect(result).toEqual({ lines: 70 });
  });

  it('handles decimal thresholds', () => {
    const result = parseThresholdArgs(['--lines=59.5']);
    expect(result).toEqual({ lines: 59.5 });
  });

  it('ignores malformed args', () => {
    const result = parseThresholdArgs(['--lines', '70', 'lines=70', '--lines=']);
    expect(result).toEqual({});
  });
});

describe('parseCoverageDirArg', () => {
  it('extracts coverage dir from args', () => {
    const result = parseCoverageDirArg(['--coverage-dir=/tmp/cov']);
    expect(result).toBe('/tmp/cov');
  });

  it('returns undefined when not present', () => {
    expect(parseCoverageDirArg(['--lines=70'])).toBeUndefined();
  });

  it('handles relative paths', () => {
    const result = parseCoverageDirArg(['--coverage-dir=./coverage']);
    expect(result).toBe('./coverage');
  });
});

describe('DEFAULT_THRESHOLDS', () => {
  it('has the expected default values', () => {
    expect(DEFAULT_THRESHOLDS.lines).toBe(60);
    expect(DEFAULT_THRESHOLDS.branches).toBe(50);
    expect(DEFAULT_THRESHOLDS.functions).toBe(55);
    expect(DEFAULT_THRESHOLDS.statements).toBe(60);
  });
});
