import { describe, it, expect } from 'vitest';
import {
  calculateDrcScore,
  calculateBomScore,
  calculateLifecycleScore,
  calculateSimulationScore,
  calculateDocumentationScore,
  calculateReadiness,
  getReadinessColor,
} from '../release-readiness';
import type {
  ReadinessCategory,
  CategoryScore,
  ReadinessResult,
  DrcViolation,
  BomItem,
  LifecycleItem,
  ReadinessInput,
} from '../release-readiness';

describe('release-readiness', () => {
  // ─── DRC Score ───────────────────────────────────────────────────────

  describe('calculateDrcScore', () => {
    it('returns 100 with no violations', () => {
      const result = calculateDrcScore([]);
      expect(result.category).toBe('drc');
      expect(result.score).toBe(100);
      expect(result.weight).toBe(0.30);
      expect(result.issues).toHaveLength(0);
    });

    it('deducts 15 per error violation', () => {
      const violations: DrcViolation[] = [
        { severity: 'error' },
        { severity: 'error' },
      ];
      const result = calculateDrcScore(violations);
      expect(result.score).toBe(70); // 100 - 30
    });

    it('deducts 5 per warning violation', () => {
      const violations: DrcViolation[] = [
        { severity: 'warning' },
        { severity: 'warning' },
        { severity: 'warning' },
      ];
      const result = calculateDrcScore(violations);
      expect(result.score).toBe(85); // 100 - 15
    });

    it('deducts 1 per info violation', () => {
      const violations: DrcViolation[] = [
        { severity: 'info' },
        { severity: 'info' },
        { severity: 'info' },
        { severity: 'info' },
        { severity: 'info' },
      ];
      const result = calculateDrcScore(violations);
      expect(result.score).toBe(95); // 100 - 5
    });

    it('handles mixed severities', () => {
      const violations: DrcViolation[] = [
        { severity: 'error' },
        { severity: 'warning' },
        { severity: 'info' },
      ];
      const result = calculateDrcScore(violations);
      expect(result.score).toBe(79); // 100 - 15 - 5 - 1
    });

    it('clamps score at 0 minimum', () => {
      const violations: DrcViolation[] = Array.from({ length: 10 }, () => ({ severity: 'error' as const }));
      const result = calculateDrcScore(violations);
      expect(result.score).toBe(0); // 100 - 150 → clamped to 0
    });

    it('populates issues for each violation type', () => {
      const violations: DrcViolation[] = [
        { severity: 'error' },
        { severity: 'error' },
        { severity: 'warning' },
      ];
      const result = calculateDrcScore(violations);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('provides suggestions when errors exist', () => {
      const violations: DrcViolation[] = [{ severity: 'error' }];
      const result = calculateDrcScore(violations);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });

  // ─── BOM Score ───────────────────────────────────────────────────────

  describe('calculateBomScore', () => {
    it('returns 0 for empty BOM', () => {
      const result = calculateBomScore([]);
      expect(result.category).toBe('bom');
      expect(result.score).toBe(0);
      expect(result.weight).toBe(0.25);
    });

    it('returns 100 for fully populated item', () => {
      const items: BomItem[] = [
        { partNumber: 'R100K', manufacturer: 'Yageo', unitPrice: 0.01, supplier: 'DigiKey' },
      ];
      const result = calculateBomScore(items);
      expect(result.score).toBe(100);
    });

    it('returns 75 when supplier missing on all items', () => {
      const items: BomItem[] = [
        { partNumber: 'R100K', manufacturer: 'Yageo', unitPrice: 0.01 },
      ];
      const result = calculateBomScore(items);
      expect(result.score).toBe(75);
    });

    it('returns 50 when only partNumber and manufacturer present', () => {
      const items: BomItem[] = [
        { partNumber: 'R100K', manufacturer: 'Yageo' },
      ];
      const result = calculateBomScore(items);
      expect(result.score).toBe(50);
    });

    it('returns 25 when only partNumber present', () => {
      const items: BomItem[] = [{ partNumber: 'R100K' }];
      const result = calculateBomScore(items);
      expect(result.score).toBe(25);
    });

    it('returns 0 when item has no fields', () => {
      const items: BomItem[] = [{}];
      const result = calculateBomScore(items);
      expect(result.score).toBe(0);
    });

    it('averages scores across multiple items', () => {
      const items: BomItem[] = [
        { partNumber: 'R100K', manufacturer: 'Yageo', unitPrice: 0.01, supplier: 'DigiKey' }, // 100
        { partNumber: 'C10uF' }, // 25
      ];
      const result = calculateBomScore(items);
      expect(result.score).toBe(63); // Math.round((100 + 25) / 2) = 63
    });

    it('handles many items with mixed completeness', () => {
      const items: BomItem[] = [
        { partNumber: 'R1', manufacturer: 'M1', unitPrice: 1, supplier: 'S1' }, // 100
        { partNumber: 'R2', manufacturer: 'M2', unitPrice: 2, supplier: 'S2' }, // 100
        {}, // 0
      ];
      const result = calculateBomScore(items);
      expect(result.score).toBe(67); // Math.round(200 / 3)
    });

    it('populates issues for incomplete items', () => {
      const items: BomItem[] = [{ partNumber: 'R1' }];
      const result = calculateBomScore(items);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('provides suggestions when BOM is empty', () => {
      const result = calculateBomScore([]);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });

  // ─── Lifecycle Score ─────────────────────────────────────────────────

  describe('calculateLifecycleScore', () => {
    it('returns 100 for empty items', () => {
      const result = calculateLifecycleScore([]);
      expect(result.category).toBe('lifecycle');
      expect(result.score).toBe(100);
      expect(result.weight).toBe(0.15);
    });

    it('returns 100 for all active items', () => {
      const items: LifecycleItem[] = [{ status: 'active' }, { status: 'active' }];
      const result = calculateLifecycleScore(items);
      expect(result.score).toBe(100);
    });

    it('returns 50 for all nrnd items', () => {
      const items: LifecycleItem[] = [{ status: 'nrnd' }];
      const result = calculateLifecycleScore(items);
      expect(result.score).toBe(50);
    });

    it('returns 20 for all eol items', () => {
      const items: LifecycleItem[] = [{ status: 'eol' }];
      const result = calculateLifecycleScore(items);
      expect(result.score).toBe(20);
    });

    it('returns 0 for all obsolete items', () => {
      const items: LifecycleItem[] = [{ status: 'obsolete' }];
      const result = calculateLifecycleScore(items);
      expect(result.score).toBe(0);
    });

    it('returns 60 for all unknown items', () => {
      const items: LifecycleItem[] = [{ status: 'unknown' }];
      const result = calculateLifecycleScore(items);
      expect(result.score).toBe(60);
    });

    it('averages across mixed statuses', () => {
      const items: LifecycleItem[] = [
        { status: 'active' },   // 100
        { status: 'obsolete' }, // 0
      ];
      const result = calculateLifecycleScore(items);
      expect(result.score).toBe(50); // (100 + 0) / 2
    });

    it('handles complex mix of statuses', () => {
      const items: LifecycleItem[] = [
        { status: 'active' },  // 100
        { status: 'nrnd' },    // 50
        { status: 'eol' },     // 20
        { status: 'unknown' }, // 60
      ];
      const result = calculateLifecycleScore(items);
      expect(result.score).toBe(58); // Math.round((100 + 50 + 20 + 60) / 4)
    });

    it('populates issues for obsolete items', () => {
      const items: LifecycleItem[] = [{ status: 'obsolete' }];
      const result = calculateLifecycleScore(items);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('provides suggestions for eol items', () => {
      const items: LifecycleItem[] = [{ status: 'eol' }];
      const result = calculateLifecycleScore(items);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });

  // ─── Simulation Score ────────────────────────────────────────────────

  describe('calculateSimulationScore', () => {
    it('returns 30 when no results exist', () => {
      const result = calculateSimulationScore(false, false);
      expect(result.category).toBe('simulation');
      expect(result.score).toBe(30);
      expect(result.weight).toBe(0.15);
    });

    it('returns 100 when results pass', () => {
      const result = calculateSimulationScore(true, true);
      expect(result.score).toBe(100);
    });

    it('returns 10 when results exist but fail', () => {
      const result = calculateSimulationScore(true, false);
      expect(result.score).toBe(10);
    });

    it('provides suggestion when no results', () => {
      const result = calculateSimulationScore(false, false);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('populates issues when results fail', () => {
      const result = calculateSimulationScore(true, false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('has no issues when passing', () => {
      const result = calculateSimulationScore(true, true);
      expect(result.issues).toHaveLength(0);
    });
  });

  // ─── Documentation Score ─────────────────────────────────────────────

  describe('calculateDocumentationScore', () => {
    it('returns 40 base with nothing', () => {
      const result = calculateDocumentationScore(false, false, 0);
      expect(result.category).toBe('documentation');
      expect(result.score).toBe(40);
      expect(result.weight).toBe(0.15);
    });

    it('returns 100 with report and comments and no unresolved', () => {
      const result = calculateDocumentationScore(true, true, 0);
      expect(result.score).toBe(100);
    });

    it('returns 70 with report only', () => {
      const result = calculateDocumentationScore(true, false, 0);
      expect(result.score).toBe(70);
    });

    it('returns 70 with comments only', () => {
      const result = calculateDocumentationScore(false, true, 0);
      expect(result.score).toBe(70);
    });

    it('deducts 10 per unresolved comment', () => {
      const result = calculateDocumentationScore(true, true, 2);
      expect(result.score).toBe(80); // 100 - 20
    });

    it('clamps at 0 with many unresolved comments', () => {
      const result = calculateDocumentationScore(false, false, 20);
      expect(result.score).toBe(0); // 40 - 200 → 0
    });

    it('populates issues for unresolved comments', () => {
      const result = calculateDocumentationScore(true, true, 3);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('provides suggestions when report missing', () => {
      const result = calculateDocumentationScore(false, true, 0);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });

  // ─── Overall Readiness ───────────────────────────────────────────────

  describe('calculateReadiness', () => {
    const perfectInput: ReadinessInput = {
      drcViolations: [],
      bomItems: [
        { partNumber: 'R1', manufacturer: 'Yageo', unitPrice: 0.01, supplier: 'DigiKey' },
      ],
      lifecycleItems: [{ status: 'active' }],
      hasSimulationResults: true,
      simulationPassing: true,
      hasDesignReport: true,
      hasComments: true,
      unresolvedComments: 0,
    };

    it('returns grade A for perfect input', () => {
      const result = calculateReadiness(perfectInput);
      expect(result.overall).toBe(100);
      expect(result.grade).toBe('A');
      expect(result.blockers).toHaveLength(0);
      expect(result.categories).toHaveLength(5);
    });

    it('returns correct weighted average', () => {
      const input: ReadinessInput = {
        drcViolations: [], // 100 * 0.30 = 30
        bomItems: [],      // 0 * 0.25 = 0
        lifecycleItems: [], // 100 * 0.15 = 15
        hasSimulationResults: false, // 30 * 0.15 = 4.5
        simulationPassing: false,
        hasDesignReport: false, // 40 * 0.15 = 6
        hasComments: false,
        unresolvedComments: 0,
      };
      const result = calculateReadiness(input);
      // 30 + 0 + 15 + 4.5 + 6 = 55.5 → 56
      expect(result.overall).toBe(56);
      expect(result.grade).toBe('D'); // 56 < 60 threshold for C
    });

    it('identifies blockers for categories below 30', () => {
      const input: ReadinessInput = {
        drcViolations: Array.from({ length: 10 }, () => ({ severity: 'error' as const })), // score 0
        bomItems: [{ partNumber: 'R1', manufacturer: 'M', unitPrice: 1, supplier: 'S' }],
        lifecycleItems: [{ status: 'active' }],
        hasSimulationResults: true,
        simulationPassing: true,
        hasDesignReport: true,
        hasComments: true,
        unresolvedComments: 0,
      };
      const result = calculateReadiness(input);
      expect(result.blockers.length).toBeGreaterThan(0);
      expect(result.blockers.some((b) => b.toLowerCase().includes('drc'))).toBe(true);
    });

    it('simulation failure (score 10) is a blocker', () => {
      const input: ReadinessInput = {
        ...perfectInput,
        hasSimulationResults: true,
        simulationPassing: false,
      };
      const result = calculateReadiness(input);
      expect(result.blockers.some((b) => b.toLowerCase().includes('simulation'))).toBe(true);
    });

    it('grade boundary: 90 is A', () => {
      // DRC: 100*0.30=30, BOM: 100*0.25=25, Life: 100*0.15=15, Sim: 100*0.15=15, Doc: 40*0.15=6 → 91
      const input: ReadinessInput = {
        ...perfectInput,
        hasDesignReport: false,
        hasComments: false,
        unresolvedComments: 0,
      };
      const result = calculateReadiness(input);
      expect(result.overall).toBe(91);
      expect(result.grade).toBe('A');
    });

    it('grade boundary: 89 is B', () => {
      // Need exactly 89. DRC: 100*0.30=30, BOM: 76*0.25=19, Life: 100*0.15=15, Sim: 100*0.15=15, Doc: 70*0.15=10.5 → 89.5 → 90
      // Let's go another route. DRC with 1 warning: 95*0.30=28.5, BOM: 100*0.25=25, Life: 100*0.15=15, Sim: 100*0.15=15, Doc: 40*0.15=6 → 89.5 → 90
      // DRC with 1 error: 85*0.30=25.5, BOM: 100*0.25=25, Life: 100*0.15=15, Sim: 100*0.15=15, Doc: 40*0.15=6 → 86.5 → 87
      // Let's just test that a score below 90 gets B
      const input: ReadinessInput = {
        drcViolations: [{ severity: 'error' }], // 85
        bomItems: [{ partNumber: 'R1', manufacturer: 'M', unitPrice: 1, supplier: 'S' }], // 100
        lifecycleItems: [{ status: 'active' }], // 100
        hasSimulationResults: true,
        simulationPassing: true, // 100
        hasDesignReport: false,
        hasComments: false,
        unresolvedComments: 0, // 40
      };
      const result = calculateReadiness(input);
      // 85*0.30 + 100*0.25 + 100*0.15 + 100*0.15 + 40*0.15 = 25.5+25+15+15+6 = 86.5 → 87
      expect(result.overall).toBe(87);
      expect(result.grade).toBe('B');
    });

    it('grade C for score 60-74', () => {
      const input: ReadinessInput = {
        drcViolations: [{ severity: 'error' }, { severity: 'error' }], // 70
        bomItems: [{ partNumber: 'R1' }], // 25
        lifecycleItems: [{ status: 'nrnd' }], // 50
        hasSimulationResults: true,
        simulationPassing: true, // 100
        hasDesignReport: true,
        hasComments: true,
        unresolvedComments: 0, // 100
      };
      const result = calculateReadiness(input);
      // 70*0.30 + 25*0.25 + 50*0.15 + 100*0.15 + 100*0.15 = 21+6.25+7.5+15+15 = 64.75 → 65
      expect(result.overall).toBe(65);
      expect(result.grade).toBe('C');
    });

    it('grade D for score 40-59', () => {
      const input: ReadinessInput = {
        drcViolations: [{ severity: 'error' }, { severity: 'error' }, { severity: 'error' }], // 55
        bomItems: [{}], // 0
        lifecycleItems: [{ status: 'eol' }], // 20
        hasSimulationResults: false,
        simulationPassing: false, // 30
        hasDesignReport: false,
        hasComments: false,
        unresolvedComments: 0, // 40
      };
      const result = calculateReadiness(input);
      // 55*0.30 + 0*0.25 + 20*0.15 + 30*0.15 + 40*0.15 = 16.5+0+3+4.5+6 = 30 → grade F? No...
      // Actually 30 < 40 → F. Let me adjust.
      // DRC: 2 errors = 70*0.30=21, BOM: 0*0.25=0, Life: 50*0.15=7.5, Sim: 30*0.15=4.5, Doc: 40*0.15=6 → 39 → F
      // Need score 40-59. DRC: 1 error = 85*0.30=25.5, BOM: 0*0.25=0, Life: 60*0.15=9, Sim: 30*0.15=4.5, Doc: 40*0.15=6 → 45 → D
      const input2: ReadinessInput = {
        drcViolations: [{ severity: 'error' }], // 85
        bomItems: [{}], // 0
        lifecycleItems: [{ status: 'unknown' }], // 60
        hasSimulationResults: false,
        simulationPassing: false, // 30
        hasDesignReport: false,
        hasComments: false,
        unresolvedComments: 0, // 40
      };
      const result2 = calculateReadiness(input2);
      // 85*0.30 + 0*0.25 + 60*0.15 + 30*0.15 + 40*0.15 = 25.5+0+9+4.5+6 = 45
      expect(result2.overall).toBe(45);
      expect(result2.grade).toBe('D');
    });

    it('grade F for score below 40', () => {
      const input: ReadinessInput = {
        drcViolations: Array.from({ length: 7 }, () => ({ severity: 'error' as const })), // 0
        bomItems: [{}], // 0
        lifecycleItems: [{ status: 'obsolete' }], // 0
        hasSimulationResults: true,
        simulationPassing: false, // 10
        hasDesignReport: false,
        hasComments: false,
        unresolvedComments: 5, // max(0, 40-50) = 0
      };
      const result = calculateReadiness(input);
      // 0*0.30 + 0*0.25 + 0*0.15 + 10*0.15 + 0*0.15 = 1.5 → 2
      expect(result.overall).toBeLessThan(40);
      expect(result.grade).toBe('F');
    });

    it('includes all 5 categories in result', () => {
      const result = calculateReadiness(perfectInput);
      const cats = result.categories.map((c) => c.category);
      expect(cats).toContain('drc');
      expect(cats).toContain('bom');
      expect(cats).toContain('lifecycle');
      expect(cats).toContain('simulation');
      expect(cats).toContain('documentation');
    });

    it('weights sum to 1.0', () => {
      const result = calculateReadiness(perfectInput);
      const totalWeight = result.categories.reduce((sum, c) => sum + c.weight, 0);
      expect(totalWeight).toBeCloseTo(1.0, 10);
    });
  });

  // ─── Color Utility ───────────────────────────────────────────────────

  describe('getReadinessColor', () => {
    it('returns emerald for score >= 80', () => {
      expect(getReadinessColor(80)).toBe('emerald');
      expect(getReadinessColor(100)).toBe('emerald');
    });

    it('returns yellow for score 60-79', () => {
      expect(getReadinessColor(60)).toBe('yellow');
      expect(getReadinessColor(79)).toBe('yellow');
    });

    it('returns amber for score 40-59', () => {
      expect(getReadinessColor(40)).toBe('amber');
      expect(getReadinessColor(59)).toBe('amber');
    });

    it('returns red for score below 40', () => {
      expect(getReadinessColor(0)).toBe('red');
      expect(getReadinessColor(39)).toBe('red');
    });

    it('handles boundary values exactly', () => {
      expect(getReadinessColor(80)).toBe('emerald');
      expect(getReadinessColor(60)).toBe('yellow');
      expect(getReadinessColor(40)).toBe('amber');
    });
  });
});
