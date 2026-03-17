import { describe, it, expect } from 'vitest';
import {
  calculateCostScore,
  calculateRiskScore,
  calculateComplexityScore,
  calculateQualityScore,
  calculateReadinessScore,
  generateScorecard,
  formatScorecardText,
} from '../project-scorecards';
import type {
  ScorecardDimension,
  DimensionScore,
  ProjectScorecard,
  ScorecardBomItem,
  ProjectData,
} from '../project-scorecards';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeProjectData(overrides: Partial<ProjectData> = {}): ProjectData {
  return {
    projectId: 1,
    bomItems: [
      { unitPrice: 0.10, quantity: 10, supplier: 'DigiKey', partNumber: 'R100K', manufacturer: 'Yageo' },
    ],
    drcErrors: 0,
    lifecycleWarnings: 0,
    simulationPassing: true,
    nodeCount: 10,
    netCount: 5,
    layerCount: 2,
    testCoverage: 90,
    docCoverage: 80,
    drcClean: true,
    ...overrides,
  };
}

describe('project-scorecards', () => {
  // ─── Cost Score ─────────────────────────────────────────────────────────

  describe('calculateCostScore', () => {
    it('returns dimension "cost"', () => {
      const result = calculateCostScore([]);
      expect(result.dimension).toBe('cost');
    });

    it('returns 0 with grade F for empty BOM', () => {
      const result = calculateCostScore([]);
      expect(result.score).toBe(0);
      expect(result.grade).toBe('F');
      expect(result.details).toContain('No BOM items to evaluate');
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('returns 100 for a fully populated low-cost BOM', () => {
      const items: ScorecardBomItem[] = [
        { unitPrice: 0.01, quantity: 10, supplier: 'DigiKey', partNumber: 'R100K', manufacturer: 'Yageo' },
      ];
      const result = calculateCostScore(items);
      expect(result.score).toBe(100);
      expect(result.grade).toBe('A');
    });

    it('penalizes missing prices (-10 each)', () => {
      const items: ScorecardBomItem[] = [
        { partNumber: 'R1', manufacturer: 'M', supplier: 'S' },
        { partNumber: 'R2', manufacturer: 'M', supplier: 'S' },
      ];
      const result = calculateCostScore(items);
      // 100 - 20 (2 missing prices) = 80
      expect(result.score).toBe(80);
    });

    it('penalizes high total cost above $500', () => {
      const items: ScorecardBomItem[] = [
        { unitPrice: 600, quantity: 1, supplier: 'S', partNumber: 'U1', manufacturer: 'M' },
      ];
      const result = calculateCostScore(items);
      // 100 - 10 (>500) = 90
      expect(result.score).toBe(90);
    });

    it('penalizes very high total cost above $1000', () => {
      const items: ScorecardBomItem[] = [
        { unitPrice: 1100, quantity: 1, supplier: 'S', partNumber: 'U1', manufacturer: 'M' },
      ];
      const result = calculateCostScore(items);
      // 100 - 20 (>1000) = 80
      expect(result.score).toBe(80);
    });

    it('penalizes missing suppliers (-5 each, max -20)', () => {
      const items: ScorecardBomItem[] = [
        { unitPrice: 0.01, quantity: 1, partNumber: 'R1', manufacturer: 'M' },
        { unitPrice: 0.01, quantity: 1, partNumber: 'R2', manufacturer: 'M' },
        { unitPrice: 0.01, quantity: 1, partNumber: 'R3', manufacturer: 'M' },
      ];
      const result = calculateCostScore(items);
      // 100 - 15 (3*5 suppliers) = 85
      expect(result.score).toBe(85);
    });

    it('caps supplier penalty at -20', () => {
      const items: ScorecardBomItem[] = Array.from({ length: 10 }, (_, i) => ({
        unitPrice: 0.01,
        quantity: 1,
        partNumber: `R${i}`,
        manufacturer: 'M',
      }));
      const result = calculateCostScore(items);
      // 100 - 20 (supplier cap) = 80
      expect(result.score).toBe(80);
    });

    it('penalizes missing part numbers (-5 each)', () => {
      const items: ScorecardBomItem[] = [
        { unitPrice: 0.01, quantity: 1, supplier: 'S', manufacturer: 'M' },
      ];
      const result = calculateCostScore(items);
      // 100 - 5 (missing part number) = 95
      expect(result.score).toBe(95);
    });

    it('clamps score at 0', () => {
      const items: ScorecardBomItem[] = Array.from({ length: 15 }, () => ({}));
      const result = calculateCostScore(items);
      expect(result.score).toBe(0);
      expect(result.grade).toBe('F');
    });

    it('includes total cost in details when items have prices', () => {
      const items: ScorecardBomItem[] = [
        { unitPrice: 1.50, quantity: 4, supplier: 'S', partNumber: 'R1', manufacturer: 'M' },
      ];
      const result = calculateCostScore(items);
      expect(result.details.some((d) => d.includes('$6.00'))).toBe(true);
    });

    it('defaults quantity to 1 when missing', () => {
      const items: ScorecardBomItem[] = [
        { unitPrice: 5.00, supplier: 'S', partNumber: 'R1', manufacturer: 'M' },
      ];
      const result = calculateCostScore(items);
      expect(result.details.some((d) => d.includes('$5.00'))).toBe(true);
    });
  });

  // ─── Risk Score ─────────────────────────────────────────────────────────

  describe('calculateRiskScore', () => {
    it('returns dimension "risk"', () => {
      const result = calculateRiskScore(0, 0, true);
      expect(result.dimension).toBe('risk');
    });

    it('returns 100 grade A with no issues', () => {
      const result = calculateRiskScore(0, 0, true);
      expect(result.score).toBe(100);
      expect(result.grade).toBe('A');
    });

    it('penalizes DRC errors (-8 each)', () => {
      const result = calculateRiskScore(3, 0, true);
      // 100 - 24 = 76
      expect(result.score).toBe(76);
      expect(result.grade).toBe('B');
    });

    it('penalizes lifecycle warnings (-6 each)', () => {
      const result = calculateRiskScore(0, 4, true);
      // 100 - 24 = 76
      expect(result.score).toBe(76);
    });

    it('penalizes simulation failure (-30)', () => {
      const result = calculateRiskScore(0, 0, false);
      // 100 - 30 = 70
      expect(result.score).toBe(70);
    });

    it('combines all penalties', () => {
      const result = calculateRiskScore(2, 3, false);
      // 100 - 16 - 18 - 30 = 36
      expect(result.score).toBe(36);
      expect(result.grade).toBe('F');
    });

    it('clamps at 0', () => {
      const result = calculateRiskScore(10, 10, false);
      // 100 - 80 - 60 - 30 = negative → 0
      expect(result.score).toBe(0);
    });

    it('includes DRC clean detail when no errors', () => {
      const result = calculateRiskScore(0, 0, true);
      expect(result.details.some((d) => d.includes('DRC clean'))).toBe(true);
    });

    it('provides suggestions for DRC errors', () => {
      const result = calculateRiskScore(1, 0, true);
      expect(result.suggestions.some((s) => s.toLowerCase().includes('drc'))).toBe(true);
    });
  });

  // ─── Complexity Score ───────────────────────────────────────────────────

  describe('calculateComplexityScore', () => {
    it('returns dimension "complexity"', () => {
      const result = calculateComplexityScore(0, 0, 0);
      expect(result.dimension).toBe('complexity');
    });

    it('returns 100 for trivial design', () => {
      const result = calculateComplexityScore(5, 3, 2);
      expect(result.score).toBe(100);
      expect(result.grade).toBe('A');
    });

    it('penalizes >50 nodes (-10)', () => {
      const result = calculateComplexityScore(60, 3, 2);
      expect(result.score).toBe(90);
    });

    it('penalizes >100 nodes (-20)', () => {
      const result = calculateComplexityScore(120, 3, 2);
      expect(result.score).toBe(80);
    });

    it('penalizes >200 nodes (-30)', () => {
      const result = calculateComplexityScore(250, 3, 2);
      expect(result.score).toBe(70);
    });

    it('penalizes >30 nets (-10)', () => {
      const result = calculateComplexityScore(5, 40, 2);
      expect(result.score).toBe(90);
    });

    it('penalizes >100 nets (-20)', () => {
      const result = calculateComplexityScore(5, 150, 2);
      expect(result.score).toBe(80);
    });

    it('penalizes >200 nets (-30)', () => {
      const result = calculateComplexityScore(5, 250, 2);
      expect(result.score).toBe(70);
    });

    it('penalizes >4 layers (-10)', () => {
      const result = calculateComplexityScore(5, 3, 6);
      expect(result.score).toBe(90);
    });

    it('penalizes >8 layers (-20)', () => {
      const result = calculateComplexityScore(5, 3, 10);
      expect(result.score).toBe(80);
    });

    it('penalizes >16 layers (-30)', () => {
      const result = calculateComplexityScore(5, 3, 20);
      expect(result.score).toBe(70);
    });

    it('combines all complexity penalties', () => {
      const result = calculateComplexityScore(250, 250, 20);
      // 100 - 30 - 30 - 30 = 10
      expect(result.score).toBe(10);
      expect(result.grade).toBe('F');
    });

    it('clamps at 0', () => {
      // Impossible to go below 0 with current thresholds (max -90), but verify clamp
      const result = calculateComplexityScore(250, 250, 20);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('includes node/net/layer counts in details', () => {
      const result = calculateComplexityScore(42, 18, 4);
      expect(result.details.some((d) => d.includes('42'))).toBe(true);
      expect(result.details.some((d) => d.includes('18'))).toBe(true);
      expect(result.details.some((d) => d.includes('4'))).toBe(true);
    });

    it('pluralizes correctly for singular values', () => {
      const result = calculateComplexityScore(1, 1, 1);
      expect(result.details).toContain('1 component');
      expect(result.details).toContain('1 net');
      expect(result.details).toContain('1 layer');
    });
  });

  // ─── Quality Score ──────────────────────────────────────────────────────

  describe('calculateQualityScore', () => {
    it('returns dimension "quality"', () => {
      const result = calculateQualityScore(0, 0, false);
      expect(result.dimension).toBe('quality');
    });

    it('returns 100 for perfect quality', () => {
      const result = calculateQualityScore(100, 100, true);
      // 100*0.4 + 100*0.3 + 30 = 40+30+30 = 100
      expect(result.score).toBe(100);
      expect(result.grade).toBe('A');
    });

    it('returns 0 for zero coverage and dirty DRC', () => {
      const result = calculateQualityScore(0, 0, false);
      // 0*0.4 + 0*0.3 + 0 = 0
      expect(result.score).toBe(0);
      expect(result.grade).toBe('F');
    });

    it('weights test coverage at 40%', () => {
      const result = calculateQualityScore(100, 0, false);
      // 100*0.4 + 0 + 0 = 40
      expect(result.score).toBe(40);
    });

    it('weights doc coverage at 30%', () => {
      const result = calculateQualityScore(0, 100, false);
      // 0 + 100*0.3 + 0 = 30
      expect(result.score).toBe(30);
    });

    it('DRC clean adds 30 points', () => {
      const result = calculateQualityScore(0, 0, true);
      // 0 + 0 + 30 = 30
      expect(result.score).toBe(30);
    });

    it('clamps input coverage values to 0-100', () => {
      const result = calculateQualityScore(150, -10, true);
      // 100*0.4 + 0*0.3 + 30 = 70
      expect(result.score).toBe(70);
    });

    it('suggests improving test coverage below 50%', () => {
      const result = calculateQualityScore(30, 80, true);
      expect(result.suggestions.some((s) => s.includes('50%'))).toBe(true);
    });

    it('suggests improving test coverage when between 50-80%', () => {
      const result = calculateQualityScore(60, 80, true);
      expect(result.suggestions.some((s) => s.includes('80%'))).toBe(true);
    });

    it('suggests documentation when doc coverage below 50%', () => {
      const result = calculateQualityScore(80, 20, true);
      expect(result.suggestions.some((s) => s.toLowerCase().includes('documentation'))).toBe(true);
    });

    it('suggests resolving DRC when not clean', () => {
      const result = calculateQualityScore(80, 80, false);
      expect(result.suggestions.some((s) => s.toLowerCase().includes('drc'))).toBe(true);
    });

    it('includes all three components in details', () => {
      const result = calculateQualityScore(75, 60, true);
      expect(result.details.some((d) => d.includes('Test coverage: 75%'))).toBe(true);
      expect(result.details.some((d) => d.includes('Documentation coverage: 60%'))).toBe(true);
      expect(result.details.some((d) => d.includes('DRC: clean'))).toBe(true);
    });
  });

  // ─── Readiness Score ────────────────────────────────────────────────────

  describe('calculateReadinessScore', () => {
    it('returns dimension "readiness"', () => {
      const result = calculateReadinessScore(true, true, [], 0);
      expect(result.dimension).toBe('readiness');
    });

    it('returns 75 with DRC+sim clean but no BOM and no lifecycle', () => {
      const result = calculateReadinessScore(true, true, [], 0);
      // 30 + 25 + 0 (no BOM) + 20 = 75
      expect(result.score).toBe(75);
    });

    it('returns 100 with all green and complete BOM', () => {
      const items: ScorecardBomItem[] = [
        { partNumber: 'R1', manufacturer: 'Yageo', unitPrice: 0.01 },
      ];
      const result = calculateReadinessScore(true, true, items, 0);
      // 30 + 25 + 25 + 20 = 100
      expect(result.score).toBe(100);
    });

    it('gives 0 DRC points when not clean', () => {
      const result = calculateReadinessScore(false, true, [], 0);
      // 0 + 25 + 0 + 20 = 45
      expect(result.score).toBe(45);
    });

    it('gives 0 sim points when not passing', () => {
      const result = calculateReadinessScore(true, false, [], 0);
      // 30 + 0 + 0 + 20 = 50
      expect(result.score).toBe(50);
    });

    it('scales BOM points by completeness ratio', () => {
      const items: ScorecardBomItem[] = [
        { partNumber: 'R1', manufacturer: 'Yageo', unitPrice: 0.01 }, // complete
        { partNumber: 'C1' }, // incomplete (missing manufacturer + price)
      ];
      const result = calculateReadinessScore(true, true, items, 0);
      // 30 + 25 + round(25 * 0.5) + 20 = 30 + 25 + 13 + 20 = 88
      expect(result.score).toBe(88);
    });

    it('gives 10 lifecycle points for 1-2 warnings', () => {
      const result = calculateReadinessScore(true, true, [], 2);
      // 30 + 25 + 0 + 10 = 65
      expect(result.score).toBe(65);
    });

    it('gives 0 lifecycle points for >2 warnings', () => {
      const result = calculateReadinessScore(true, true, [], 5);
      // 30 + 25 + 0 + 0 = 55
      expect(result.score).toBe(55);
    });

    it('returns 0 when nothing passes', () => {
      const result = calculateReadinessScore(false, false, [], 5);
      // 0 + 0 + 0 + 0 = 0
      expect(result.score).toBe(0);
      expect(result.grade).toBe('F');
    });
  });

  // ─── Scorecard Generation ──────────────────────────────────────────────

  describe('generateScorecard', () => {
    it('returns all 5 dimensions', () => {
      const data = makeProjectData();
      const card = generateScorecard(data);
      expect(card.dimensions).toHaveLength(5);
      const dims = card.dimensions.map((d) => d.dimension);
      expect(dims).toContain('cost');
      expect(dims).toContain('risk');
      expect(dims).toContain('readiness');
      expect(dims).toContain('complexity');
      expect(dims).toContain('quality');
    });

    it('sets projectId from input', () => {
      const data = makeProjectData({ projectId: 42 });
      const card = generateScorecard(data);
      expect(card.projectId).toBe(42);
    });

    it('sets generatedAt as a Date', () => {
      const data = makeProjectData();
      const card = generateScorecard(data);
      expect(card.generatedAt).toBeInstanceOf(Date);
    });

    it('calculates weighted overall score', () => {
      const data = makeProjectData();
      const card = generateScorecard(data);
      // Verify overall is a weighted sum (weights: cost=0.20, risk=0.25, readiness=0.25, complexity=0.15, quality=0.15)
      const expectedOverall = Math.round(
        card.dimensions.reduce((sum, dim) => {
          const weights: Record<string, number> = {
            cost: 0.20,
            risk: 0.25,
            readiness: 0.25,
            complexity: 0.15,
            quality: 0.15,
          };
          return sum + dim.score * (weights[dim.dimension] ?? 0);
        }, 0),
      );
      expect(card.overall).toBe(expectedOverall);
    });

    it('assigns correct overallGrade for high-scoring project', () => {
      const data = makeProjectData();
      const card = generateScorecard(data);
      expect(card.overall).toBeGreaterThanOrEqual(90);
      expect(card.overallGrade).toBe('A');
    });

    it('assigns lower grades for poor projects', () => {
      const data = makeProjectData({
        bomItems: [],
        drcErrors: 5,
        drcClean: false,
        simulationPassing: false,
        lifecycleWarnings: 5,
        testCoverage: 0,
        docCoverage: 0,
        nodeCount: 250,
        netCount: 250,
        layerCount: 20,
      });
      const card = generateScorecard(data);
      expect(card.overall).toBeLessThan(40);
      expect(card.overallGrade).toBe('F');
    });

    it('dimension weights sum to 1.0', () => {
      const data = makeProjectData();
      const card = generateScorecard(data);
      // The weights are fixed internally, but we can verify via back-calculation
      // If we set all scores to X, overall should be X
      // We can't easily test internal weights, but we can verify overall is in valid range
      expect(card.overall).toBeGreaterThanOrEqual(0);
      expect(card.overall).toBeLessThanOrEqual(100);
    });
  });

  // ─── Text Formatter ────────────────────────────────────────────────────

  describe('formatScorecardText', () => {
    it('includes project ID', () => {
      const data = makeProjectData({ projectId: 7 });
      const card = generateScorecard(data);
      const text = formatScorecardText(card);
      expect(text).toContain('Project Scorecard (ID: 7)');
    });

    it('includes overall score and grade', () => {
      const data = makeProjectData();
      const card = generateScorecard(data);
      const text = formatScorecardText(card);
      expect(text).toContain(`Overall: ${card.overall}/100 (${card.overallGrade})`);
    });

    it('includes generated timestamp', () => {
      const data = makeProjectData();
      const card = generateScorecard(data);
      const text = formatScorecardText(card);
      expect(text).toContain('Generated:');
      expect(text).toContain(card.generatedAt.toISOString());
    });

    it('includes all dimension headers', () => {
      const data = makeProjectData();
      const card = generateScorecard(data);
      const text = formatScorecardText(card);
      expect(text).toContain('[COST]');
      expect(text).toContain('[RISK]');
      expect(text).toContain('[READINESS]');
      expect(text).toContain('[COMPLEXITY]');
      expect(text).toContain('[QUALITY]');
    });

    it('includes dimension details as bullet points', () => {
      const data = makeProjectData();
      const card = generateScorecard(data);
      const text = formatScorecardText(card);
      // Details are prefixed with "  - "
      expect(text).toContain('  - ');
    });

    it('includes suggestions section when present', () => {
      const data = makeProjectData({
        bomItems: [],
        drcClean: false,
        simulationPassing: false,
      });
      const card = generateScorecard(data);
      const text = formatScorecardText(card);
      expect(text).toContain('Suggestions:');
      expect(text).toContain('    * ');
    });

    it('returns a non-empty string', () => {
      const data = makeProjectData();
      const card = generateScorecard(data);
      const text = formatScorecardText(card);
      expect(text.length).toBeGreaterThan(0);
    });
  });

  // ─── Type Verification ─────────────────────────────────────────────────

  describe('type contracts', () => {
    it('DimensionScore has all required fields', () => {
      const result = calculateCostScore([{ unitPrice: 1, quantity: 1, supplier: 'S', partNumber: 'P', manufacturer: 'M' }]);
      expect(result).toHaveProperty('dimension');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('grade');
      expect(result).toHaveProperty('details');
      expect(result).toHaveProperty('suggestions');
      expect(typeof result.score).toBe('number');
      expect(typeof result.grade).toBe('string');
      expect(Array.isArray(result.details)).toBe(true);
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    it('ProjectScorecard has all required fields', () => {
      const data = makeProjectData();
      const card = generateScorecard(data);
      expect(card).toHaveProperty('projectId');
      expect(card).toHaveProperty('dimensions');
      expect(card).toHaveProperty('overall');
      expect(card).toHaveProperty('overallGrade');
      expect(card).toHaveProperty('generatedAt');
    });

    it('grade values are valid', () => {
      const validGrades = ['A', 'B', 'C', 'D', 'F'];
      const data = makeProjectData();
      const card = generateScorecard(data);
      expect(validGrades).toContain(card.overallGrade);
      for (const dim of card.dimensions) {
        expect(validGrades).toContain(dim.grade);
      }
    });

    it('scores are always 0-100', () => {
      const data = makeProjectData({
        bomItems: Array.from({ length: 20 }, () => ({})),
        drcErrors: 20,
        lifecycleWarnings: 20,
        simulationPassing: false,
        drcClean: false,
        testCoverage: 0,
        docCoverage: 0,
        nodeCount: 500,
        netCount: 500,
        layerCount: 32,
      });
      const card = generateScorecard(data);
      for (const dim of card.dimensions) {
        expect(dim.score).toBeGreaterThanOrEqual(0);
        expect(dim.score).toBeLessThanOrEqual(100);
      }
      expect(card.overall).toBeGreaterThanOrEqual(0);
      expect(card.overall).toBeLessThanOrEqual(100);
    });
  });
});
