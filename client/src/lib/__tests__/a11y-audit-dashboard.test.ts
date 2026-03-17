import { describe, it, expect, vi } from 'vitest';
import {
  runAccessibilityAudit,
  buildResult,
  getAuditScore,
  getAuditGrade,
  trackFix,
  filterByCategory,
  filterByStatus,
  filterByWcagLevel,
  getFailuresByPriority,
  ALL_CATEGORIES,
} from '../accessibility-audit-dashboard';
import type {
  A11yAuditCheck,
  A11yAuditItem,
  A11yAuditCategory,
  A11yAuditStatus,
  WcagLevel,
} from '../accessibility-audit-dashboard';

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeCheck(overrides: Partial<A11yAuditCheck> & { id: string }): A11yAuditCheck {
  return {
    category: 'contrast',
    description: `Check ${overrides.id}`,
    wcagLevel: 'AA',
    evaluate: () => 'pass',
    ...overrides,
  };
}

function makeItem(overrides: Partial<A11yAuditItem> & { id: string }): A11yAuditItem {
  return {
    category: 'contrast',
    description: `Item ${overrides.id}`,
    status: 'pass',
    wcagLevel: 'AA',
    ...overrides,
  };
}

function makeChecksAllPassing(count: number): A11yAuditCheck[] {
  return Array.from({ length: count }, (_, i) =>
    makeCheck({ id: `pass-${i}`, evaluate: () => 'pass' }),
  );
}

function makeChecksAllFailing(count: number): A11yAuditCheck[] {
  return Array.from({ length: count }, (_, i) =>
    makeCheck({ id: `fail-${i}`, evaluate: () => 'fail' }),
  );
}

function makeMixedChecks(): A11yAuditCheck[] {
  return [
    makeCheck({ id: 'c1', category: 'contrast', evaluate: () => 'pass', wcagLevel: 'A' }),
    makeCheck({ id: 'c2', category: 'contrast', evaluate: () => 'fail', wcagLevel: 'AA' }),
    makeCheck({ id: 'k1', category: 'keyboard', evaluate: () => 'pass', wcagLevel: 'AA' }),
    makeCheck({ id: 'k2', category: 'keyboard', evaluate: () => 'fail', wcagLevel: 'A' }),
    makeCheck({ id: 'sr1', category: 'screen_reader', evaluate: () => 'manual', wcagLevel: 'AA' }),
    makeCheck({ id: 'f1', category: 'focus', evaluate: () => 'pass', wcagLevel: 'AAA' }),
    makeCheck({ id: 'm1', category: 'motion', evaluate: () => 'fail', wcagLevel: 'AAA' }),
    makeCheck({ id: 't1', category: 'touch', evaluate: () => 'pass', wcagLevel: 'A' }),
  ];
}

// ---------------------------------------------------------------------------
// runAccessibilityAudit
// ---------------------------------------------------------------------------

describe('runAccessibilityAudit', () => {
  describe('empty checks', () => {
    it('returns a perfect score when no checks are provided', () => {
      const result = runAccessibilityAudit([]);
      expect(result.score).toBe(100);
      expect(result.grade).toBe('A');
      expect(result.passRate).toBe(1);
      expect(result.totalChecks).toBe(0);
      expect(result.failedChecks).toBe(0);
      expect(result.manualChecks).toBe(0);
    });

    it('returns empty items array', () => {
      const result = runAccessibilityAudit([]);
      expect(result.items).toEqual([]);
    });

    it('returns 100 score for every category breakdown', () => {
      const result = runAccessibilityAudit([]);
      for (const cat of ALL_CATEGORIES) {
        expect(result.byCategory[cat].score).toBe(100);
        expect(result.byCategory[cat].total).toBe(0);
      }
    });
  });

  describe('all passing', () => {
    it('returns a perfect score when all checks pass', () => {
      const result = runAccessibilityAudit(makeChecksAllPassing(5));
      expect(result.score).toBe(100);
      expect(result.grade).toBe('A');
    });

    it('has passRate of 1 when all pass', () => {
      const result = runAccessibilityAudit(makeChecksAllPassing(5));
      expect(result.passRate).toBe(1);
    });

    it('reports correct totalChecks', () => {
      const result = runAccessibilityAudit(makeChecksAllPassing(7));
      expect(result.totalChecks).toBe(7);
      expect(result.failedChecks).toBe(0);
    });
  });

  describe('all failing', () => {
    it('returns a score of 0 when all checks fail', () => {
      const result = runAccessibilityAudit(makeChecksAllFailing(5));
      expect(result.score).toBe(0);
      expect(result.grade).toBe('F');
    });

    it('has passRate of 0 when all fail', () => {
      const result = runAccessibilityAudit(makeChecksAllFailing(5));
      expect(result.passRate).toBe(0);
    });

    it('reports all as failed', () => {
      const result = runAccessibilityAudit(makeChecksAllFailing(3));
      expect(result.failedChecks).toBe(3);
      expect(result.manualChecks).toBe(0);
    });
  });

  describe('mixed checks', () => {
    it('produces a score between 0 and 100', () => {
      const result = runAccessibilityAudit(makeMixedChecks());
      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThan(100);
    });

    it('excludes manual items from scoring', () => {
      const result = runAccessibilityAudit(makeMixedChecks());
      // manual item sr1 should not count as a failure
      expect(result.manualChecks).toBe(1);
      // passRate should be based on 7 scorable items (4 pass, 3 fail)
      expect(result.passRate).toBeCloseTo(4 / 7, 5);
    });

    it('populates byCategory correctly', () => {
      const result = runAccessibilityAudit(makeMixedChecks());
      expect(result.byCategory.contrast.total).toBe(2);
      expect(result.byCategory.contrast.passed).toBe(1);
      expect(result.byCategory.contrast.failed).toBe(1);
      expect(result.byCategory.keyboard.total).toBe(2);
      expect(result.byCategory.screen_reader.total).toBe(1);
      expect(result.byCategory.screen_reader.manual).toBe(1);
      expect(result.byCategory.focus.total).toBe(1);
      expect(result.byCategory.focus.passed).toBe(1);
      expect(result.byCategory.motion.total).toBe(1);
      expect(result.byCategory.motion.failed).toBe(1);
      expect(result.byCategory.touch.total).toBe(1);
      expect(result.byCategory.touch.passed).toBe(1);
    });

    it('calculates per-category score excluding manual', () => {
      const result = runAccessibilityAudit(makeMixedChecks());
      // contrast: 1 pass / 2 scorable = 50
      expect(result.byCategory.contrast.score).toBe(50);
      // screen_reader: 0 scorable → 100
      expect(result.byCategory.screen_reader.score).toBe(100);
      // focus: 1/1 = 100
      expect(result.byCategory.focus.score).toBe(100);
      // motion: 0/1 = 0
      expect(result.byCategory.motion.score).toBe(0);
    });

    it('includes a valid ISO timestamp', () => {
      const result = runAccessibilityAudit(makeMixedChecks());
      expect(() => new Date(result.timestamp)).not.toThrow();
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });
  });

  describe('evaluate is called', () => {
    it('invokes each check evaluate function exactly once', () => {
      const spy1 = vi.fn<() => A11yAuditStatus>(() => 'pass');
      const spy2 = vi.fn<() => A11yAuditStatus>(() => 'fail');
      runAccessibilityAudit([
        makeCheck({ id: 'a', evaluate: spy1 }),
        makeCheck({ id: 'b', evaluate: spy2 }),
      ]);
      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);
    });
  });

  describe('severity weighting', () => {
    it('weighs WCAG A failures more heavily than AAA failures', () => {
      // 1 A-level fail + 1 AAA-level pass vs 1 AAA-level fail + 1 A-level pass
      const resultHighFail = runAccessibilityAudit([
        makeCheck({ id: 'a', evaluate: () => 'fail', wcagLevel: 'A' }),
        makeCheck({ id: 'b', evaluate: () => 'pass', wcagLevel: 'AAA' }),
      ]);
      const resultLowFail = runAccessibilityAudit([
        makeCheck({ id: 'a', evaluate: () => 'pass', wcagLevel: 'A' }),
        makeCheck({ id: 'b', evaluate: () => 'fail', wcagLevel: 'AAA' }),
      ]);
      // Failing a more severe (A) item should result in a lower score
      expect(resultHighFail.score).toBeLessThan(resultLowFail.score);
    });

    it('respects custom severity overrides', () => {
      const resultDefault = runAccessibilityAudit([
        makeCheck({ id: 'a', evaluate: () => 'fail', wcagLevel: 'AAA' }),
        makeCheck({ id: 'b', evaluate: () => 'pass', wcagLevel: 'AAA' }),
      ]);
      const resultOverride = runAccessibilityAudit([
        makeCheck({ id: 'a', evaluate: () => 'fail', wcagLevel: 'AAA', severity: 10 }),
        makeCheck({ id: 'b', evaluate: () => 'pass', wcagLevel: 'AAA' }),
      ]);
      // Custom severity 10 on AAA fail makes it worse
      expect(resultOverride.score).toBeLessThan(resultDefault.score);
    });
  });
});

// ---------------------------------------------------------------------------
// buildResult
// ---------------------------------------------------------------------------

describe('buildResult', () => {
  it('builds result from pre-evaluated items', () => {
    const items: A11yAuditItem[] = [
      makeItem({ id: 'x1', status: 'pass' }),
      makeItem({ id: 'x2', status: 'fail' }),
    ];
    const result = buildResult(items);
    expect(result.totalChecks).toBe(2);
    expect(result.failedChecks).toBe(1);
    expect(result.items).toHaveLength(2);
  });

  it('preserves fixedAt on items', () => {
    const ts = '2026-03-01T00:00:00.000Z';
    const items: A11yAuditItem[] = [makeItem({ id: 'f1', status: 'pass', fixedAt: ts })];
    const result = buildResult(items);
    expect(result.items[0].fixedAt).toBe(ts);
  });
});

// ---------------------------------------------------------------------------
// getAuditScore
// ---------------------------------------------------------------------------

describe('getAuditScore', () => {
  it('returns 100 for all-passing items', () => {
    const items = [makeItem({ id: '1' }), makeItem({ id: '2' })];
    expect(getAuditScore(items)).toBe(100);
  });

  it('returns 0 for all-failing items', () => {
    const items = [
      makeItem({ id: '1', status: 'fail' }),
      makeItem({ id: '2', status: 'fail' }),
    ];
    expect(getAuditScore(items)).toBe(0);
  });

  it('returns 100 when all items are manual', () => {
    const items = [
      makeItem({ id: '1', status: 'manual' }),
      makeItem({ id: '2', status: 'manual' }),
    ];
    expect(getAuditScore(items)).toBe(100);
  });

  it('returns 100 for empty array', () => {
    expect(getAuditScore([])).toBe(100);
  });

  it('accounts for severity in scoring', () => {
    // 1 A-level pass (sev 10) + 1 AAA-level fail (sev 4) = 10/14 = 71
    const items = [
      makeItem({ id: '1', status: 'pass', wcagLevel: 'A' }),
      makeItem({ id: '2', status: 'fail', wcagLevel: 'AAA' }),
    ];
    expect(getAuditScore(items)).toBe(71);
  });
});

// ---------------------------------------------------------------------------
// getAuditGrade
// ---------------------------------------------------------------------------

describe('getAuditGrade', () => {
  it('returns A for score >= 90', () => {
    expect(getAuditGrade(90)).toBe('A');
    expect(getAuditGrade(95)).toBe('A');
    expect(getAuditGrade(100)).toBe('A');
  });

  it('returns B for score 80-89', () => {
    expect(getAuditGrade(80)).toBe('B');
    expect(getAuditGrade(89)).toBe('B');
  });

  it('returns C for score 70-79', () => {
    expect(getAuditGrade(70)).toBe('C');
    expect(getAuditGrade(79)).toBe('C');
  });

  it('returns D for score 60-69', () => {
    expect(getAuditGrade(60)).toBe('D');
    expect(getAuditGrade(69)).toBe('D');
  });

  it('returns F for score < 60', () => {
    expect(getAuditGrade(59)).toBe('F');
    expect(getAuditGrade(0)).toBe('F');
  });
});

// ---------------------------------------------------------------------------
// trackFix
// ---------------------------------------------------------------------------

describe('trackFix', () => {
  it('flips a failing item to pass', () => {
    const result = runAccessibilityAudit([
      makeCheck({ id: 'a', evaluate: () => 'fail' }),
      makeCheck({ id: 'b', evaluate: () => 'pass' }),
    ]);
    const updated = trackFix(result, 'a');
    const fixed = updated.items.find((i) => i.id === 'a');
    expect(fixed?.status).toBe('pass');
    expect(fixed?.fixedAt).toBeDefined();
  });

  it('improves the score after fixing a failure', () => {
    const result = runAccessibilityAudit([
      makeCheck({ id: 'a', evaluate: () => 'fail' }),
      makeCheck({ id: 'b', evaluate: () => 'pass' }),
    ]);
    const updated = trackFix(result, 'a');
    expect(updated.score).toBeGreaterThan(result.score);
  });

  it('does not mutate the original result', () => {
    const result = runAccessibilityAudit([
      makeCheck({ id: 'a', evaluate: () => 'fail' }),
    ]);
    const originalScore = result.score;
    trackFix(result, 'a');
    expect(result.score).toBe(originalScore);
    expect(result.items[0].status).toBe('fail');
  });

  it('returns the same result when item already passes', () => {
    const result = runAccessibilityAudit([
      makeCheck({ id: 'a', evaluate: () => 'pass' }),
    ]);
    const updated = trackFix(result, 'a');
    expect(updated).toBe(result); // same reference
  });

  it('throws for unknown item id', () => {
    const result = runAccessibilityAudit([
      makeCheck({ id: 'a', evaluate: () => 'pass' }),
    ]);
    expect(() => trackFix(result, 'nonexistent')).toThrow('A11y audit item not found: nonexistent');
  });

  it('can fix a manual item', () => {
    const result = runAccessibilityAudit([
      makeCheck({ id: 'm1', evaluate: () => 'manual' }),
      makeCheck({ id: 'p1', evaluate: () => 'pass' }),
    ]);
    const updated = trackFix(result, 'm1');
    expect(updated.items.find((i) => i.id === 'm1')?.status).toBe('pass');
    expect(updated.items.find((i) => i.id === 'm1')?.fixedAt).toBeDefined();
  });

  it('updates grade when fixing pushes score above threshold', () => {
    // 8 passes, 2 fails (all AA sev 7) = 56/70 = 80 → B
    const checks: A11yAuditCheck[] = [
      ...Array.from({ length: 8 }, (_, i) =>
        makeCheck({ id: `p${i}`, evaluate: () => 'pass' }),
      ),
      makeCheck({ id: 'f1', evaluate: () => 'fail' }),
      makeCheck({ id: 'f2', evaluate: () => 'fail' }),
    ];
    const result = runAccessibilityAudit(checks);
    expect(result.grade).toBe('B');

    // Fix both failures → 100 → A
    const step1 = trackFix(result, 'f1');
    const step2 = trackFix(step1, 'f2');
    expect(step2.score).toBe(100);
    expect(step2.grade).toBe('A');
  });
});

// ---------------------------------------------------------------------------
// filterByCategory
// ---------------------------------------------------------------------------

describe('filterByCategory', () => {
  it('returns only items of the specified category', () => {
    const items: A11yAuditItem[] = [
      makeItem({ id: '1', category: 'contrast' }),
      makeItem({ id: '2', category: 'keyboard' }),
      makeItem({ id: '3', category: 'contrast' }),
    ];
    const filtered = filterByCategory(items, 'contrast');
    expect(filtered).toHaveLength(2);
    expect(filtered.every((i) => i.category === 'contrast')).toBe(true);
  });

  it('returns empty array when no items match', () => {
    const items: A11yAuditItem[] = [makeItem({ id: '1', category: 'touch' })];
    expect(filterByCategory(items, 'motion')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// filterByStatus
// ---------------------------------------------------------------------------

describe('filterByStatus', () => {
  it('filters by pass status', () => {
    const items: A11yAuditItem[] = [
      makeItem({ id: '1', status: 'pass' }),
      makeItem({ id: '2', status: 'fail' }),
      makeItem({ id: '3', status: 'manual' }),
    ];
    expect(filterByStatus(items, 'pass')).toHaveLength(1);
    expect(filterByStatus(items, 'fail')).toHaveLength(1);
    expect(filterByStatus(items, 'manual')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// filterByWcagLevel
// ---------------------------------------------------------------------------

describe('filterByWcagLevel', () => {
  it('filters items by WCAG level', () => {
    const items: A11yAuditItem[] = [
      makeItem({ id: '1', wcagLevel: 'A' }),
      makeItem({ id: '2', wcagLevel: 'AA' }),
      makeItem({ id: '3', wcagLevel: 'AAA' }),
      makeItem({ id: '4', wcagLevel: 'A' }),
    ];
    expect(filterByWcagLevel(items, 'A')).toHaveLength(2);
    expect(filterByWcagLevel(items, 'AA')).toHaveLength(1);
    expect(filterByWcagLevel(items, 'AAA')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// getFailuresByPriority
// ---------------------------------------------------------------------------

describe('getFailuresByPriority', () => {
  it('returns only failed items', () => {
    const items: A11yAuditItem[] = [
      makeItem({ id: '1', status: 'pass' }),
      makeItem({ id: '2', status: 'fail', wcagLevel: 'A' }),
      makeItem({ id: '3', status: 'manual' }),
      makeItem({ id: '4', status: 'fail', wcagLevel: 'AAA' }),
    ];
    const failures = getFailuresByPriority(items);
    expect(failures).toHaveLength(2);
    expect(failures.every((i) => i.status === 'fail')).toBe(true);
  });

  it('sorts by severity descending (most severe first)', () => {
    const items: A11yAuditItem[] = [
      makeItem({ id: 'low', status: 'fail', wcagLevel: 'AAA' }),   // sev 4
      makeItem({ id: 'high', status: 'fail', wcagLevel: 'A' }),    // sev 10
      makeItem({ id: 'mid', status: 'fail', wcagLevel: 'AA' }),    // sev 7
    ];
    const failures = getFailuresByPriority(items);
    expect(failures[0].id).toBe('high');
    expect(failures[1].id).toBe('mid');
    expect(failures[2].id).toBe('low');
  });

  it('respects custom severity overrides in sort', () => {
    const items: A11yAuditItem[] = [
      makeItem({ id: 'custom-high', status: 'fail', wcagLevel: 'AAA', severity: 10 }),
      makeItem({ id: 'default-a', status: 'fail', wcagLevel: 'A' }), // sev 10
      makeItem({ id: 'custom-low', status: 'fail', wcagLevel: 'A', severity: 1 }),
    ];
    const failures = getFailuresByPriority(items);
    // custom-high and default-a both sev 10, custom-low sev 1
    expect(failures[2].id).toBe('custom-low');
  });

  it('returns empty array when no failures', () => {
    const items: A11yAuditItem[] = [
      makeItem({ id: '1', status: 'pass' }),
      makeItem({ id: '2', status: 'manual' }),
    ];
    expect(getFailuresByPriority(items)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// ALL_CATEGORIES constant
// ---------------------------------------------------------------------------

describe('ALL_CATEGORIES', () => {
  it('contains exactly six categories', () => {
    expect(ALL_CATEGORIES).toHaveLength(6);
  });

  it('contains all expected categories', () => {
    const expected: A11yAuditCategory[] = [
      'contrast',
      'keyboard',
      'screen_reader',
      'focus',
      'motion',
      'touch',
    ];
    expect([...ALL_CATEGORIES]).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// Edge cases / integration
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('handles single-item audit with fail', () => {
    const result = runAccessibilityAudit([
      makeCheck({ id: 'only', evaluate: () => 'fail' }),
    ]);
    expect(result.score).toBe(0);
    expect(result.grade).toBe('F');
    expect(result.failedChecks).toBe(1);
  });

  it('handles single-item audit with manual', () => {
    const result = runAccessibilityAudit([
      makeCheck({ id: 'only', evaluate: () => 'manual' }),
    ]);
    // manual-only → 100 score (no scorable items)
    expect(result.score).toBe(100);
    expect(result.grade).toBe('A');
    expect(result.manualChecks).toBe(1);
  });

  it('preserves wcagCriterion in results', () => {
    const result = runAccessibilityAudit([
      makeCheck({ id: 'c', evaluate: () => 'pass', wcagCriterion: '1.4.3' }),
    ]);
    expect(result.items[0].wcagCriterion).toBe('1.4.3');
  });

  it('handles all six categories with checks', () => {
    const checks: A11yAuditCheck[] = ALL_CATEGORIES.map((cat, i) =>
      makeCheck({ id: `cat-${i}`, category: cat, evaluate: () => 'pass' }),
    );
    const result = runAccessibilityAudit(checks);
    for (const cat of ALL_CATEGORIES) {
      expect(result.byCategory[cat].total).toBe(1);
      expect(result.byCategory[cat].passed).toBe(1);
    }
  });

  it('score is always an integer', () => {
    // 1 A-fail (sev 10) + 1 AA-pass (sev 7) + 1 AAA-pass (sev 4) = 11/21 = 52.38... → 52
    const result = runAccessibilityAudit([
      makeCheck({ id: 'a', evaluate: () => 'fail', wcagLevel: 'A' }),
      makeCheck({ id: 'b', evaluate: () => 'pass', wcagLevel: 'AA' }),
      makeCheck({ id: 'c', evaluate: () => 'pass', wcagLevel: 'AAA' }),
    ]);
    expect(Number.isInteger(result.score)).toBe(true);
  });

  it('score is clamped to 0-100 range', () => {
    // Verify 0 and 100 are reachable
    expect(runAccessibilityAudit(makeChecksAllPassing(1)).score).toBe(100);
    expect(runAccessibilityAudit(makeChecksAllFailing(1)).score).toBe(0);
  });

  it('large number of checks does not break scoring', () => {
    const checks: A11yAuditCheck[] = Array.from({ length: 1000 }, (_, i) =>
      makeCheck({ id: `large-${i}`, evaluate: () => (i % 3 === 0 ? 'fail' : 'pass') }),
    );
    const result = runAccessibilityAudit(checks);
    expect(result.totalChecks).toBe(1000);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
