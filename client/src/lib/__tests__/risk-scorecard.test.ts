import { describe, it, expect } from 'vitest';
import {
  calculateScorecard,
  readinessColor,
  readinessLabel,
  severityClasses,
  CATEGORY_WEIGHTS,
} from '../risk-scorecard';
import type {
  ScorecardInput,
  ScorecardBomItem,
  ScorecardValidationIssue,
  ScorecardNode,
  ScorecardEdge,
  ScorecardResult,
  ReadinessLevel,
} from '../risk-scorecard';

// ---------------------------------------------------------------------------
// Helpers — reusable builders
// ---------------------------------------------------------------------------

function makeBomItem(overrides: Partial<ScorecardBomItem> = {}): ScorecardBomItem {
  return {
    partNumber: 'R-10K',
    manufacturer: 'Yageo',
    description: '10kΩ 0402 resistor',
    quantity: 10,
    unitPrice: 0.01,
    totalPrice: 0.10,
    stock: 5000,
    status: 'In Stock',
    esdSensitive: false,
    assemblyCategory: 'smt',
    ...overrides,
  };
}

function makeIssue(overrides: Partial<ScorecardValidationIssue> = {}): ScorecardValidationIssue {
  return {
    severity: 'info',
    message: 'Test issue',
    ...overrides,
  };
}

function makeNode(overrides: Partial<ScorecardNode> = {}): ScorecardNode {
  return {
    id: crypto.randomUUID(),
    label: 'ESP32',
    type: 'mcu',
    description: 'Main microcontroller',
    ...overrides,
  };
}

function makeEdge(source: string, target: string): ScorecardEdge {
  return { id: crypto.randomUUID(), source, target };
}

function emptyInput(): ScorecardInput {
  return { validationIssues: [], bomItems: [], nodes: [], edges: [] };
}

function healthyInput(): ScorecardInput {
  const n1 = makeNode({ id: 'n1', label: 'ESP32', description: 'MCU' });
  const n2 = makeNode({ id: 'n2', label: 'LDO', description: 'Voltage regulator' });
  return {
    validationIssues: [makeIssue({ severity: 'info', message: 'Minor note' })],
    bomItems: [
      makeBomItem(),
      makeBomItem({ partNumber: 'AMS1117', manufacturer: 'AMS', description: 'LDO 3.3V' }),
    ],
    nodes: [n1, n2],
    edges: [makeEdge('n1', 'n2')],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('risk-scorecard', () => {
  // ── Overall structure ──

  describe('calculateScorecard', () => {
    it('returns a result with all 5 categories', () => {
      const result = calculateScorecard(emptyInput());
      expect(result.categories).toHaveLength(5);

      const ids = result.categories.map((c) => c.id);
      expect(ids).toEqual(['drc', 'bom', 'manufacturing', 'documentation', 'testing']);
    });

    it('overall score is 0–100', () => {
      const result = calculateScorecard(emptyInput());
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
    });

    it('includes a timestamp', () => {
      const before = Date.now();
      const result = calculateScorecard(emptyInput());
      expect(result.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('category weights sum to 1.0', () => {
      const sum = Object.values(CATEGORY_WEIGHTS).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 10);
    });

    it('all category scores are 0–100', () => {
      const result = calculateScorecard(healthyInput());
      for (const cat of result.categories) {
        expect(cat.score).toBeGreaterThanOrEqual(0);
        expect(cat.score).toBeLessThanOrEqual(100);
      }
    });
  });

  // ── Readiness levels ──

  describe('readiness level', () => {
    it('returns green for a healthy design', () => {
      const result = calculateScorecard(healthyInput());
      expect(result.readiness).toBe('green');
      expect(result.overallScore).toBeGreaterThanOrEqual(80);
    });

    it('returns red for a design with critical failures', () => {
      const result = calculateScorecard({
        validationIssues: [
          makeIssue({ severity: 'error' }),
          makeIssue({ severity: 'error' }),
          makeIssue({ severity: 'error' }),
        ],
        bomItems: [],
        nodes: [makeNode({ label: '', description: '' })],
        edges: [],
      });
      expect(result.readiness).toBe('red');
      expect(result.overallScore).toBeLessThan(50);
    });

    it('returns yellow for a design with moderate issues', () => {
      const n1 = makeNode({ id: 'n1' });
      const result = calculateScorecard({
        validationIssues: [
          makeIssue({ severity: 'warning' }),
          makeIssue({ severity: 'info' }),
        ],
        bomItems: [makeBomItem({ unitPrice: 0, status: 'Low Stock', assemblyCategory: null })],
        nodes: [n1],
        edges: [makeEdge('n1', 'n1')],
      });
      // Score should be in the 50-79 range
      expect(result.overallScore).toBeGreaterThanOrEqual(50);
      expect(result.overallScore).toBeLessThan(80);
      expect(result.readiness).toBe('yellow');
    });
  });

  // ── DRC category ──

  describe('DRC scoring', () => {
    it('scores 100 with no validation issues', () => {
      const result = calculateScorecard(emptyInput());
      const drc = result.categories.find((c) => c.id === 'drc');
      expect(drc).toBeDefined();
      expect(drc!.score).toBe(100);
    });

    it('penalizes heavily for DRC errors', () => {
      const result = calculateScorecard({
        ...emptyInput(),
        validationIssues: [makeIssue({ severity: 'error' })],
      });
      const drc = result.categories.find((c) => c.id === 'drc')!;
      expect(drc.score).toBeLessThan(100);
      // Error is critical weight, so score drop is significant
      expect(drc.items.find((i) => i.id === 'drc-no-errors')!.passed).toBe(false);
    });

    it('penalizes moderately for warnings', () => {
      const result = calculateScorecard({
        ...emptyInput(),
        validationIssues: [makeIssue({ severity: 'warning' })],
      });
      const drc = result.categories.find((c) => c.id === 'drc')!;
      expect(drc.score).toBeLessThan(100);
      expect(drc.items.find((i) => i.id === 'drc-no-warnings')!.passed).toBe(false);
    });

    it('penalizes lightly for many info issues', () => {
      const result = calculateScorecard({
        ...emptyInput(),
        validationIssues: [
          makeIssue({ severity: 'info' }),
          makeIssue({ severity: 'info' }),
          makeIssue({ severity: 'info' }),
          makeIssue({ severity: 'info' }),
        ],
      });
      const drc = result.categories.find((c) => c.id === 'drc')!;
      expect(drc.score).toBeLessThan(100);
      expect(drc.items.find((i) => i.id === 'drc-info-review')!.passed).toBe(false);
    });

    it('passes info review for 3 or fewer info issues', () => {
      const result = calculateScorecard({
        ...emptyInput(),
        validationIssues: [
          makeIssue({ severity: 'info' }),
          makeIssue({ severity: 'info' }),
          makeIssue({ severity: 'info' }),
        ],
      });
      const drc = result.categories.find((c) => c.id === 'drc')!;
      expect(drc.items.find((i) => i.id === 'drc-info-review')!.passed).toBe(true);
    });

    it('has 3 items', () => {
      const result = calculateScorecard(emptyInput());
      const drc = result.categories.find((c) => c.id === 'drc')!;
      expect(drc.items).toHaveLength(3);
    });
  });

  // ── BOM category ──

  describe('BOM scoring', () => {
    it('scores 100 with fully populated BOM', () => {
      const result = calculateScorecard({
        ...emptyInput(),
        bomItems: [makeBomItem()],
      });
      const bom = result.categories.find((c) => c.id === 'bom')!;
      expect(bom.score).toBe(100);
    });

    it('penalizes for empty BOM', () => {
      const result = calculateScorecard(emptyInput());
      const bom = result.categories.find((c) => c.id === 'bom')!;
      expect(bom.items.find((i) => i.id === 'bom-non-empty')!.passed).toBe(false);
    });

    it('penalizes for missing part numbers', () => {
      const result = calculateScorecard({
        ...emptyInput(),
        bomItems: [makeBomItem({ partNumber: '' })],
      });
      const bom = result.categories.find((c) => c.id === 'bom')!;
      expect(bom.items.find((i) => i.id === 'bom-part-numbers')!.passed).toBe(false);
    });

    it('penalizes for unknown manufacturers', () => {
      const result = calculateScorecard({
        ...emptyInput(),
        bomItems: [makeBomItem({ manufacturer: 'Unknown' })],
      });
      const bom = result.categories.find((c) => c.id === 'bom')!;
      expect(bom.items.find((i) => i.id === 'bom-manufacturers')!.passed).toBe(false);
    });

    it('penalizes for zero pricing', () => {
      const result = calculateScorecard({
        ...emptyInput(),
        bomItems: [makeBomItem({ unitPrice: 0 })],
      });
      const bom = result.categories.find((c) => c.id === 'bom')!;
      expect(bom.items.find((i) => i.id === 'bom-pricing')!.passed).toBe(false);
    });

    it('penalizes for out-of-stock items', () => {
      const result = calculateScorecard({
        ...emptyInput(),
        bomItems: [makeBomItem({ status: 'Out of Stock' })],
      });
      const bom = result.categories.find((c) => c.id === 'bom')!;
      expect(bom.items.find((i) => i.id === 'bom-stock')!.passed).toBe(false);
    });

    it('has 5 items', () => {
      const result = calculateScorecard({
        ...emptyInput(),
        bomItems: [makeBomItem()],
      });
      const bom = result.categories.find((c) => c.id === 'bom')!;
      expect(bom.items).toHaveLength(5);
    });
  });

  // ── Manufacturing category ──

  describe('Manufacturing scoring', () => {
    it('scores 100 with all items categorized and in stock', () => {
      const result = calculateScorecard({
        ...emptyInput(),
        bomItems: [makeBomItem()],
      });
      const mfg = result.categories.find((c) => c.id === 'manufacturing')!;
      expect(mfg.score).toBe(100);
    });

    it('penalizes for uncategorized assembly types', () => {
      const result = calculateScorecard({
        ...emptyInput(),
        bomItems: [makeBomItem({ assemblyCategory: null })],
      });
      const mfg = result.categories.find((c) => c.id === 'manufacturing')!;
      expect(mfg.items.find((i) => i.id === 'mfg-assembly-categories')!.passed).toBe(false);
    });

    it('flags hand-solder items', () => {
      const result = calculateScorecard({
        ...emptyInput(),
        bomItems: [makeBomItem({ assemblyCategory: 'hand_solder' })],
      });
      const mfg = result.categories.find((c) => c.id === 'manufacturing')!;
      expect(mfg.items.find((i) => i.id === 'mfg-hand-solder')!.passed).toBe(false);
    });

    it('flags low-stock items', () => {
      const result = calculateScorecard({
        ...emptyInput(),
        bomItems: [makeBomItem({ status: 'Low Stock' })],
      });
      const mfg = result.categories.find((c) => c.id === 'manufacturing')!;
      expect(mfg.items.find((i) => i.id === 'mfg-low-stock')!.passed).toBe(false);
    });

    it('passes ESD check (always passes, informational)', () => {
      const result = calculateScorecard({
        ...emptyInput(),
        bomItems: [makeBomItem({ esdSensitive: true })],
      });
      const mfg = result.categories.find((c) => c.id === 'manufacturing')!;
      expect(mfg.items.find((i) => i.id === 'mfg-esd-flagged')!.passed).toBe(true);
    });

    it('has 4 items', () => {
      const result = calculateScorecard({
        ...emptyInput(),
        bomItems: [makeBomItem()],
      });
      const mfg = result.categories.find((c) => c.id === 'manufacturing')!;
      expect(mfg.items).toHaveLength(4);
    });
  });

  // ── Documentation category ──

  describe('Documentation scoring', () => {
    it('scores 100 with fully documented design', () => {
      const result = calculateScorecard({
        ...emptyInput(),
        nodes: [makeNode({ id: 'n1', description: 'MCU' })],
        edges: [makeEdge('n1', 'n1')],
        bomItems: [makeBomItem()],
      });
      const doc = result.categories.find((c) => c.id === 'documentation')!;
      expect(doc.score).toBe(100);
    });

    it('penalizes for no architecture nodes', () => {
      const result = calculateScorecard(emptyInput());
      const doc = result.categories.find((c) => c.id === 'documentation')!;
      expect(doc.items.find((i) => i.id === 'doc-architecture')!.passed).toBe(false);
    });

    it('penalizes for no connections', () => {
      const result = calculateScorecard({
        ...emptyInput(),
        nodes: [makeNode()],
      });
      const doc = result.categories.find((c) => c.id === 'documentation')!;
      expect(doc.items.find((i) => i.id === 'doc-connections')!.passed).toBe(false);
    });

    it('penalizes for unlabeled nodes', () => {
      const result = calculateScorecard({
        ...emptyInput(),
        nodes: [makeNode({ label: '' })],
        edges: [makeEdge('a', 'b')],
      });
      const doc = result.categories.find((c) => c.id === 'documentation')!;
      expect(doc.items.find((i) => i.id === 'doc-labels')!.passed).toBe(false);
    });

    it('penalizes for mostly missing descriptions', () => {
      const result = calculateScorecard({
        ...emptyInput(),
        nodes: [
          makeNode({ id: 'n1', description: '' }),
          makeNode({ id: 'n2', description: '' }),
        ],
        edges: [makeEdge('n1', 'n2')],
      });
      const doc = result.categories.find((c) => c.id === 'documentation')!;
      // >50% missing = fail
      expect(doc.items.find((i) => i.id === 'doc-descriptions')!.passed).toBe(false);
    });

    it('passes descriptions when <=50% missing', () => {
      const result = calculateScorecard({
        ...emptyInput(),
        nodes: [
          makeNode({ id: 'n1', description: 'Has desc' }),
          makeNode({ id: 'n2', description: '' }),
        ],
        edges: [makeEdge('n1', 'n2')],
      });
      const doc = result.categories.find((c) => c.id === 'documentation')!;
      expect(doc.items.find((i) => i.id === 'doc-descriptions')!.passed).toBe(true);
    });

    it('penalizes for missing BOM descriptions', () => {
      const result = calculateScorecard({
        ...emptyInput(),
        bomItems: [makeBomItem({ description: '' })],
        nodes: [makeNode()],
        edges: [makeEdge('a', 'b')],
      });
      const doc = result.categories.find((c) => c.id === 'documentation')!;
      expect(doc.items.find((i) => i.id === 'doc-bom-descriptions')!.passed).toBe(false);
    });

    it('has 5 items', () => {
      const result = calculateScorecard(healthyInput());
      const doc = result.categories.find((c) => c.id === 'documentation')!;
      expect(doc.items).toHaveLength(5);
    });
  });

  // ── Testing category ──

  describe('Testing scoring', () => {
    it('passes validation-run when issues exist', () => {
      const result = calculateScorecard({
        ...emptyInput(),
        validationIssues: [makeIssue()],
        nodes: [makeNode()],
      });
      const test = result.categories.find((c) => c.id === 'testing')!;
      expect(test.items.find((i) => i.id === 'test-validation-run')!.passed).toBe(true);
    });

    it('fails validation-run when no issues and design exists', () => {
      const result = calculateScorecard({
        ...emptyInput(),
        nodes: [makeNode()],
      });
      const test = result.categories.find((c) => c.id === 'testing')!;
      expect(test.items.find((i) => i.id === 'test-validation-run')!.passed).toBe(false);
    });

    it('passes validation-run for empty design with no issues', () => {
      const result = calculateScorecard(emptyInput());
      const test = result.categories.find((c) => c.id === 'testing')!;
      expect(test.items.find((i) => i.id === 'test-validation-run')!.passed).toBe(true);
    });

    it('penalizes for unresolved errors', () => {
      const result = calculateScorecard({
        ...emptyInput(),
        validationIssues: [makeIssue({ severity: 'error' })],
      });
      const test = result.categories.find((c) => c.id === 'testing')!;
      expect(test.items.find((i) => i.id === 'test-error-resolution')!.passed).toBe(false);
    });

    it('checks BOM-to-architecture coverage', () => {
      // 4 nodes, 0 BOM items => coverage < 50%
      const result = calculateScorecard({
        ...emptyInput(),
        validationIssues: [makeIssue()],
        nodes: [
          makeNode({ id: 'n1' }),
          makeNode({ id: 'n2' }),
          makeNode({ id: 'n3' }),
          makeNode({ id: 'n4' }),
        ],
        bomItems: [makeBomItem()],
      });
      const test = result.categories.find((c) => c.id === 'testing')!;
      expect(test.items.find((i) => i.id === 'test-component-coverage')!.passed).toBe(false);
    });

    it('passes coverage when BOM >= 50% of nodes', () => {
      const result = calculateScorecard({
        ...emptyInput(),
        validationIssues: [makeIssue()],
        nodes: [makeNode({ id: 'n1' }), makeNode({ id: 'n2' })],
        bomItems: [makeBomItem()],
      });
      const test = result.categories.find((c) => c.id === 'testing')!;
      expect(test.items.find((i) => i.id === 'test-component-coverage')!.passed).toBe(true);
    });

    it('penalizes excessive warnings', () => {
      // With 1 node, threshold = max(3, ceil(1*0.3)) = 3. 4 warnings => fail
      const result = calculateScorecard({
        ...emptyInput(),
        validationIssues: Array.from({ length: 4 }, () => makeIssue({ severity: 'warning' })),
        nodes: [makeNode()],
      });
      const test = result.categories.find((c) => c.id === 'testing')!;
      expect(test.items.find((i) => i.id === 'test-warning-ratio')!.passed).toBe(false);
    });

    it('passes warning ratio within threshold', () => {
      const result = calculateScorecard({
        ...emptyInput(),
        validationIssues: [
          makeIssue({ severity: 'warning' }),
          makeIssue({ severity: 'warning' }),
          makeIssue({ severity: 'warning' }),
        ],
        nodes: [makeNode()],
      });
      const test = result.categories.find((c) => c.id === 'testing')!;
      expect(test.items.find((i) => i.id === 'test-warning-ratio')!.passed).toBe(true);
    });

    it('has 4 items', () => {
      const result = calculateScorecard(healthyInput());
      const test = result.categories.find((c) => c.id === 'testing')!;
      expect(test.items).toHaveLength(4);
    });
  });

  // ── Weighted score calculation ──

  describe('weighted score calculation', () => {
    it('overall score reflects category weights', () => {
      const result = calculateScorecard(healthyInput());
      // Manual calculation: each category score * weight should sum to overall
      const expected = Math.round(
        result.categories.reduce((acc, cat) => acc + cat.score * cat.weight, 0),
      );
      expect(result.overallScore).toBe(expected);
    });

    it('empty input with all defaults returns a valid result', () => {
      const result = calculateScorecard(emptyInput());
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
      expect(['green', 'yellow', 'red']).toContain(result.readiness);
    });

    it('clamps overall score to 0–100 range', () => {
      // Even with artificially extreme inputs, score stays bounded
      const result = calculateScorecard({
        validationIssues: Array.from({ length: 50 }, () => makeIssue({ severity: 'error' })),
        bomItems: [],
        nodes: [],
        edges: [],
      });
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
    });
  });

  // ── Utility functions ──

  describe('readinessColor', () => {
    it('returns green color for green', () => {
      expect(readinessColor('green')).toBe('#22c55e');
    });

    it('returns yellow color for yellow', () => {
      expect(readinessColor('yellow')).toBe('#eab308');
    });

    it('returns red color for red', () => {
      expect(readinessColor('red')).toBe('#ef4444');
    });
  });

  describe('readinessLabel', () => {
    it('returns correct labels', () => {
      expect(readinessLabel('green')).toBe('Ready for Release');
      expect(readinessLabel('yellow')).toBe('Needs Attention');
      expect(readinessLabel('red')).toBe('Not Ready');
    });
  });

  describe('severityClasses', () => {
    it('returns classes for each severity', () => {
      expect(severityClasses('critical')).toContain('red');
      expect(severityClasses('major')).toContain('yellow');
      expect(severityClasses('minor')).toContain('blue');
    });
  });

  // ── Edge cases ──

  describe('edge cases', () => {
    it('handles BOM items with empty string manufacturer', () => {
      const result = calculateScorecard({
        ...emptyInput(),
        bomItems: [makeBomItem({ manufacturer: '' })],
      });
      const bom = result.categories.find((c) => c.id === 'bom')!;
      expect(bom.items.find((i) => i.id === 'bom-manufacturers')!.passed).toBe(false);
    });

    it('handles BOM items with whitespace-only part numbers', () => {
      const result = calculateScorecard({
        ...emptyInput(),
        bomItems: [makeBomItem({ partNumber: '   ' })],
      });
      const bom = result.categories.find((c) => c.id === 'bom')!;
      expect(bom.items.find((i) => i.id === 'bom-part-numbers')!.passed).toBe(false);
    });

    it('handles nodes with whitespace-only labels', () => {
      const result = calculateScorecard({
        ...emptyInput(),
        nodes: [makeNode({ label: '  ' })],
        edges: [makeEdge('a', 'b')],
      });
      const doc = result.categories.find((c) => c.id === 'documentation')!;
      expect(doc.items.find((i) => i.id === 'doc-labels')!.passed).toBe(false);
    });

    it('handles mixed severity validation issues', () => {
      const result = calculateScorecard({
        ...emptyInput(),
        validationIssues: [
          makeIssue({ severity: 'error' }),
          makeIssue({ severity: 'warning' }),
          makeIssue({ severity: 'info' }),
        ],
      });
      const drc = result.categories.find((c) => c.id === 'drc')!;
      expect(drc.items.find((i) => i.id === 'drc-no-errors')!.passed).toBe(false);
      expect(drc.items.find((i) => i.id === 'drc-no-warnings')!.passed).toBe(false);
      expect(drc.items.find((i) => i.id === 'drc-info-review')!.passed).toBe(true);
      expect(drc.score).toBeLessThan(50);
    });

    it('handles large BOM lists', () => {
      const items = Array.from({ length: 100 }, (_, i) =>
        makeBomItem({ partNumber: `PART-${String(i)}` }),
      );
      const result = calculateScorecard({ ...emptyInput(), bomItems: items });
      const bom = result.categories.find((c) => c.id === 'bom')!;
      expect(bom.score).toBe(100);
    });

    it('handles all categories having zero scores', () => {
      const result = calculateScorecard({
        validationIssues: [
          makeIssue({ severity: 'error' }),
          makeIssue({ severity: 'error' }),
        ],
        bomItems: [],
        nodes: [makeNode({ label: '', description: '' })],
        edges: [],
      });
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.readiness).toBe('red');
    });

    it('each ScorecardItem has a non-empty detail', () => {
      const result = calculateScorecard(healthyInput());
      for (const cat of result.categories) {
        for (const item of cat.items) {
          expect(item.detail.length).toBeGreaterThan(0);
        }
      }
    });

    it('each ScorecardItem has a non-empty label', () => {
      const result = calculateScorecard(healthyInput());
      for (const cat of result.categories) {
        for (const item of cat.items) {
          expect(item.label.length).toBeGreaterThan(0);
        }
      }
    });
  });
});
