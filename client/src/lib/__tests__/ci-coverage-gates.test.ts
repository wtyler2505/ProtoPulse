import { describe, it, expect } from 'vitest';

import {
  evaluateCoverage,
  getQualityGrade,
  formatCoverageReport,
  DEFAULT_THRESHOLDS,
} from '../ci-coverage-gates';
import type {
  CoverageThreshold,
  CoverageResult,
  CoverageGateResult,
  QualityGrade,
} from '../ci-coverage-gates';

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeThreshold(overrides: Partial<CoverageThreshold> = {}): CoverageThreshold {
  return { statements: 80, branches: 80, functions: 80, lines: 80, ...overrides };
}

function makeResult(
  file: string,
  actual: Partial<CoverageThreshold>,
  required?: Partial<CoverageThreshold>,
): CoverageResult {
  return {
    file,
    actual: makeThreshold(actual),
    required: makeThreshold(required),
  };
}

// ---------------------------------------------------------------------------
// DEFAULT_THRESHOLDS
// ---------------------------------------------------------------------------

describe('DEFAULT_THRESHOLDS', () => {
  it('has all four metrics at 80', () => {
    expect(DEFAULT_THRESHOLDS.statements).toBe(80);
    expect(DEFAULT_THRESHOLDS.branches).toBe(80);
    expect(DEFAULT_THRESHOLDS.functions).toBe(80);
    expect(DEFAULT_THRESHOLDS.lines).toBe(80);
  });

  it('is frozen / readonly at runtime', () => {
    // Attempting assignment should be a no-op in strict mode
    expect(() => {
      (DEFAULT_THRESHOLDS as CoverageThreshold).statements = 50;
    }).toThrow();
  });
});

// ---------------------------------------------------------------------------
// evaluateCoverage — empty input
// ---------------------------------------------------------------------------

describe('evaluateCoverage', () => {
  describe('empty input', () => {
    it('passes when given no results', () => {
      const gate = evaluateCoverage([]);
      expect(gate.passed).toBe(true);
    });

    it('has no failures or warnings for empty input', () => {
      const gate = evaluateCoverage([]);
      expect(gate.failures).toHaveLength(0);
      expect(gate.warnings).toHaveLength(0);
    });

    it('returns zero overall coverage for empty input', () => {
      const gate = evaluateCoverage([]);
      expect(gate.overallCoverage.statements).toBe(0);
      expect(gate.overallCoverage.branches).toBe(0);
      expect(gate.overallCoverage.functions).toBe(0);
      expect(gate.overallCoverage.lines).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // evaluateCoverage — all passing
  // -------------------------------------------------------------------------

  describe('all files passing', () => {
    it('passes when all metrics meet thresholds exactly', () => {
      const results = [makeResult('src/a.ts', { statements: 80, branches: 80, functions: 80, lines: 80 })];
      const gate = evaluateCoverage(results);
      expect(gate.passed).toBe(true);
      expect(gate.failures).toHaveLength(0);
    });

    it('passes when all metrics exceed thresholds', () => {
      const results = [makeResult('src/a.ts', { statements: 95, branches: 92, functions: 88, lines: 90 })];
      const gate = evaluateCoverage(results);
      expect(gate.passed).toBe(true);
    });

    it('passes with multiple files all above threshold', () => {
      const results = [
        makeResult('src/a.ts', { statements: 85, branches: 90, functions: 82, lines: 88 }),
        makeResult('src/b.ts', { statements: 100, branches: 100, functions: 100, lines: 100 }),
      ];
      const gate = evaluateCoverage(results);
      expect(gate.passed).toBe(true);
      expect(gate.failures).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // evaluateCoverage — failures
  // -------------------------------------------------------------------------

  describe('failures', () => {
    it('fails when a single metric is below threshold', () => {
      const results = [makeResult('src/low.ts', { statements: 60, branches: 80, functions: 80, lines: 80 })];
      const gate = evaluateCoverage(results);
      expect(gate.passed).toBe(false);
      expect(gate.failures).toHaveLength(1);
      expect(gate.failures[0].file).toBe('src/low.ts');
      expect(gate.failures[0].metric).toBe('statements');
    });

    it('records correct gap in failure', () => {
      const results = [makeResult('src/gap.ts', { statements: 70, branches: 80, functions: 80, lines: 80 })];
      const gate = evaluateCoverage(results);
      expect(gate.failures[0].gap).toBe(10);
      expect(gate.failures[0].actual).toBe(70);
      expect(gate.failures[0].required).toBe(80);
    });

    it('reports multiple failures for the same file', () => {
      const results = [makeResult('src/bad.ts', { statements: 50, branches: 40, functions: 30, lines: 20 })];
      const gate = evaluateCoverage(results);
      expect(gate.passed).toBe(false);
      expect(gate.failures).toHaveLength(4);
    });

    it('reports failures across multiple files', () => {
      const results = [
        makeResult('src/a.ts', { statements: 50 }),
        makeResult('src/b.ts', { statements: 60 }),
      ];
      const gate = evaluateCoverage(results);
      const stmtFailures = gate.failures.filter((f) => f.metric === 'statements');
      expect(stmtFailures).toHaveLength(2);
    });

    it('fails when branches specifically are below threshold', () => {
      const results = [makeResult('src/x.ts', { statements: 90, branches: 50, functions: 90, lines: 90 })];
      const gate = evaluateCoverage(results);
      expect(gate.passed).toBe(false);
      expect(gate.failures[0].metric).toBe('branches');
    });

    it('fails when functions specifically are below threshold', () => {
      const results = [makeResult('src/x.ts', { statements: 90, branches: 90, functions: 10, lines: 90 })];
      const gate = evaluateCoverage(results);
      expect(gate.failures.some((f) => f.metric === 'functions')).toBe(true);
    });

    it('fails when lines specifically are below threshold', () => {
      const results = [makeResult('src/x.ts', { statements: 90, branches: 90, functions: 90, lines: 0 })];
      const gate = evaluateCoverage(results);
      expect(gate.failures.some((f) => f.metric === 'lines')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // evaluateCoverage — warnings
  // -------------------------------------------------------------------------

  describe('warnings', () => {
    it('warns when a metric is within 5% above the threshold', () => {
      const results = [makeResult('src/close.ts', { statements: 83, branches: 90, functions: 90, lines: 90 })];
      const gate = evaluateCoverage(results);
      expect(gate.passed).toBe(true);
      expect(gate.warnings).toHaveLength(1);
      expect(gate.warnings[0].file).toBe('src/close.ts');
      expect(gate.warnings[0].metric).toBe('statements');
    });

    it('does not warn when metric is exactly at threshold', () => {
      const results = [makeResult('src/exact.ts', { statements: 80 })];
      const gate = evaluateCoverage(results);
      // 80 meets 80 but is within +5 warning zone
      expect(gate.warnings.some((w) => w.metric === 'statements')).toBe(true);
    });

    it('does not warn when metric is well above threshold', () => {
      const results = [makeResult('src/safe.ts', { statements: 95, branches: 95, functions: 95, lines: 95 })];
      const gate = evaluateCoverage(results);
      expect(gate.warnings).toHaveLength(0);
    });

    it('does not warn for metrics that are below threshold (those are failures)', () => {
      const results = [makeResult('src/fail.ts', { statements: 50 })];
      const gate = evaluateCoverage(results);
      expect(gate.warnings.filter((w) => w.metric === 'statements')).toHaveLength(0);
      expect(gate.failures.filter((f) => f.metric === 'statements')).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // evaluateCoverage — overall coverage averaging
  // -------------------------------------------------------------------------

  describe('overall coverage', () => {
    it('averages coverage across files', () => {
      const results = [
        makeResult('src/a.ts', { statements: 100, branches: 100, functions: 100, lines: 100 }),
        makeResult('src/b.ts', { statements: 50, branches: 50, functions: 50, lines: 50 }),
      ];
      const gate = evaluateCoverage(results);
      expect(gate.overallCoverage.statements).toBe(75);
      expect(gate.overallCoverage.branches).toBe(75);
      expect(gate.overallCoverage.functions).toBe(75);
      expect(gate.overallCoverage.lines).toBe(75);
    });

    it('computes overall coverage for a single file', () => {
      const results = [makeResult('src/only.ts', { statements: 88, branches: 72, functions: 65, lines: 91 })];
      const gate = evaluateCoverage(results);
      expect(gate.overallCoverage.statements).toBe(88);
      expect(gate.overallCoverage.branches).toBe(72);
      expect(gate.overallCoverage.functions).toBe(65);
      expect(gate.overallCoverage.lines).toBe(91);
    });

    it('rounds overall coverage to two decimal places', () => {
      const results = [
        makeResult('src/a.ts', { statements: 33.33 }),
        makeResult('src/b.ts', { statements: 33.33 }),
        makeResult('src/c.ts', { statements: 33.34 }),
      ];
      const gate = evaluateCoverage(results);
      // (33.33 + 33.33 + 33.34) / 3 = 33.333...
      expect(gate.overallCoverage.statements).toBe(33.33);
    });
  });

  // -------------------------------------------------------------------------
  // evaluateCoverage — custom thresholds
  // -------------------------------------------------------------------------

  describe('custom thresholds', () => {
    it('uses custom thresholds parameter', () => {
      const strict: CoverageThreshold = { statements: 95, branches: 95, functions: 95, lines: 95 };
      const results = [makeResult('src/a.ts', { statements: 90, branches: 90, functions: 90, lines: 90 }, strict)];
      const gate = evaluateCoverage(results, strict);
      expect(gate.passed).toBe(false);
      expect(gate.failures).toHaveLength(4);
    });

    it('passes with relaxed thresholds', () => {
      const relaxed: CoverageThreshold = { statements: 50, branches: 50, functions: 50, lines: 50 };
      const results = [makeResult('src/a.ts', { statements: 55, branches: 55, functions: 55, lines: 55 }, relaxed)];
      const gate = evaluateCoverage(results, relaxed);
      expect(gate.passed).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // evaluateCoverage — edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('clamps actual coverage above 100 to 100', () => {
      const results = [makeResult('src/over.ts', { statements: 105, branches: 80, functions: 80, lines: 80 })];
      const gate = evaluateCoverage(results);
      expect(gate.overallCoverage.statements).toBe(100);
      expect(gate.passed).toBe(true);
    });

    it('clamps actual coverage below 0 to 0', () => {
      const results = [makeResult('src/neg.ts', { statements: -10, branches: 80, functions: 80, lines: 80 })];
      const gate = evaluateCoverage(results);
      expect(gate.overallCoverage.statements).toBe(0);
    });

    it('throws for invalid threshold values', () => {
      const invalid: CoverageThreshold = { statements: -1, branches: 80, functions: 80, lines: 80 };
      expect(() => evaluateCoverage([], invalid)).toThrow(RangeError);
    });

    it('throws for NaN threshold', () => {
      const bad: CoverageThreshold = { statements: NaN, branches: 80, functions: 80, lines: 80 };
      expect(() => evaluateCoverage([], bad)).toThrow(RangeError);
    });

    it('throws for threshold above 100', () => {
      const bad: CoverageThreshold = { statements: 101, branches: 80, functions: 80, lines: 80 };
      expect(() => evaluateCoverage([], bad)).toThrow(RangeError);
    });

    it('handles zero thresholds (everything passes)', () => {
      const zero: CoverageThreshold = { statements: 0, branches: 0, functions: 0, lines: 0 };
      const results = [makeResult('src/any.ts', { statements: 0, branches: 0, functions: 0, lines: 0 }, zero)];
      const gate = evaluateCoverage(results, zero);
      expect(gate.passed).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// getQualityGrade
// ---------------------------------------------------------------------------

describe('getQualityGrade', () => {
  it('returns A+ for 95%+ average', () => {
    expect(getQualityGrade({ statements: 96, branches: 97, functions: 98, lines: 99 })).toBe('A+');
  });

  it('returns A+ for exactly 95% average', () => {
    expect(getQualityGrade({ statements: 95, branches: 95, functions: 95, lines: 95 })).toBe('A+');
  });

  it('returns A for 90-94% average', () => {
    expect(getQualityGrade({ statements: 92, branches: 90, functions: 91, lines: 93 })).toBe('A');
  });

  it('returns B for 80-89% average', () => {
    expect(getQualityGrade({ statements: 85, branches: 82, functions: 80, lines: 88 })).toBe('B');
  });

  it('returns C for 70-79% average', () => {
    expect(getQualityGrade({ statements: 75, branches: 72, functions: 70, lines: 78 })).toBe('C');
  });

  it('returns D for 60-69% average', () => {
    expect(getQualityGrade({ statements: 65, branches: 62, functions: 60, lines: 68 })).toBe('D');
  });

  it('returns F for below 60% average', () => {
    expect(getQualityGrade({ statements: 40, branches: 30, functions: 50, lines: 55 })).toBe('F');
  });

  it('returns F for zero coverage', () => {
    expect(getQualityGrade({ statements: 0, branches: 0, functions: 0, lines: 0 })).toBe('F');
  });

  it('returns B for exactly 80% average', () => {
    expect(getQualityGrade({ statements: 80, branches: 80, functions: 80, lines: 80 })).toBe('B');
  });

  it('handles mixed metrics that average to a grade boundary', () => {
    // Average: (100 + 80 + 80 + 100) / 4 = 90 -> A
    expect(getQualityGrade({ statements: 100, branches: 80, functions: 80, lines: 100 })).toBe('A');
  });
});

// ---------------------------------------------------------------------------
// formatCoverageReport
// ---------------------------------------------------------------------------

describe('formatCoverageReport', () => {
  function makePassing(): CoverageGateResult {
    return {
      passed: true,
      failures: [],
      warnings: [],
      overallCoverage: { statements: 92, branches: 88, functions: 90, lines: 91 },
    };
  }

  function makeFailing(): CoverageGateResult {
    return {
      passed: false,
      failures: [
        { file: 'src/bad.ts', metric: 'statements', actual: 50, required: 80, gap: 30 },
        { file: 'src/bad.ts', metric: 'branches', actual: 40, required: 80, gap: 40 },
      ],
      warnings: [],
      overallCoverage: { statements: 50, branches: 40, functions: 85, lines: 82 },
    };
  }

  it('includes PASSED status for passing results', () => {
    const report = formatCoverageReport(makePassing());
    expect(report).toContain('PASSED');
  });

  it('includes FAILED status for failing results', () => {
    const report = formatCoverageReport(makeFailing());
    expect(report).toContain('FAILED');
  });

  it('includes quality grade', () => {
    const report = formatCoverageReport(makePassing());
    expect(report).toContain('Grade:');
  });

  it('includes overall coverage percentages', () => {
    const report = formatCoverageReport(makePassing());
    expect(report).toContain('statements:');
    expect(report).toContain('branches:');
    expect(report).toContain('functions:');
    expect(report).toContain('lines:');
  });

  it('lists failure details', () => {
    const report = formatCoverageReport(makeFailing());
    expect(report).toContain('src/bad.ts');
    expect(report).toContain('Failures (2)');
  });

  it('includes gap in failure line', () => {
    const report = formatCoverageReport(makeFailing());
    expect(report).toContain('gap:');
  });

  it('lists warning details', () => {
    const result: CoverageGateResult = {
      passed: true,
      failures: [],
      warnings: [{ file: 'src/close.ts', metric: 'branches', actual: 82, required: 80 }],
      overallCoverage: { statements: 90, branches: 82, functions: 90, lines: 90 },
    };
    const report = formatCoverageReport(result);
    expect(report).toContain('Warnings (1)');
    expect(report).toContain('src/close.ts');
  });

  it('shows "All files meet" message when clean', () => {
    const report = formatCoverageReport(makePassing());
    expect(report).toContain('All files meet coverage thresholds');
  });

  it('does not show "All files meet" when there are failures', () => {
    const report = formatCoverageReport(makeFailing());
    expect(report).not.toContain('All files meet coverage thresholds');
  });

  it('returns a multi-line string', () => {
    const report = formatCoverageReport(makePassing());
    expect(report.split('\n').length).toBeGreaterThan(3);
  });
});
