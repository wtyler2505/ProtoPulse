import { describe, it, expect, beforeEach } from 'vitest';

import {
  analyzeBomCost,
  _resetSuggestionCounter,
} from '../cost-optimizer';
import type {
  CostAnalysis,
  CostOptimizerOptions,
  CostSuggestion,
} from '../cost-optimizer';
import type { BomItem } from '@/lib/project-context';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBomItem(overrides: Partial<BomItem> = {}): BomItem {
  return {
    id: '1',
    partNumber: 'R100K',
    manufacturer: 'Yageo',
    description: '100K Resistor',
    quantity: 10,
    unitPrice: 0.05,
    totalPrice: 0.5,
    supplier: 'LCSC',
    stock: 100,
    status: 'In Stock',
    ...overrides,
  } as BomItem;
}

function defaultOpts(overrides: Partial<CostOptimizerOptions> = {}): CostOptimizerOptions {
  return {
    budget: 100,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('cost-optimizer', () => {
  beforeEach(() => {
    _resetSuggestionCounter();
  });

  // ── Basic analysis ──

  describe('analyzeBomCost', () => {
    it('returns correct totals for an empty BOM', () => {
      const result = analyzeBomCost([], defaultOpts());
      expect(result.componentCost).toBe(0);
      expect(result.pcbCost).toBe(5); // default
      expect(result.assemblyCost).toBe(0); // default
      expect(result.totalCost).toBe(5);
      expect(result.overBudget).toBe(false);
      expect(result.delta).toBe(-95);
      expect(result.suggestions).toHaveLength(0);
    });

    it('sums component costs from BOM items', () => {
      const bom = [
        makeBomItem({ id: '1', totalPrice: 10 }),
        makeBomItem({ id: '2', totalPrice: 25 }),
        makeBomItem({ id: '3', totalPrice: 5 }),
      ];
      const result = analyzeBomCost(bom, defaultOpts());
      expect(result.componentCost).toBe(40);
      expect(result.totalCost).toBe(45); // 40 + 5 (pcb)
    });

    it('applies custom pcbCost and assemblyCost', () => {
      const bom = [makeBomItem({ totalPrice: 20 })];
      const result = analyzeBomCost(bom, { budget: 100, pcbCost: 15, assemblyCost: 10 });
      expect(result.pcbCost).toBe(15);
      expect(result.assemblyCost).toBe(10);
      expect(result.totalCost).toBe(45); // 20 + 15 + 10
    });

    it('detects over-budget correctly', () => {
      const bom = [makeBomItem({ totalPrice: 100 })];
      const result = analyzeBomCost(bom, { budget: 50 });
      expect(result.overBudget).toBe(true);
      expect(result.delta).toBe(55); // 105 - 50
    });

    it('detects under-budget correctly', () => {
      const bom = [makeBomItem({ totalPrice: 10 })];
      const result = analyzeBomCost(bom, { budget: 200 });
      expect(result.overBudget).toBe(false);
      expect(result.delta).toBe(-185); // 15 - 200
    });

    it('computes bucket percentages correctly', () => {
      const bom = [makeBomItem({ totalPrice: 80 })];
      const result = analyzeBomCost(bom, { budget: 200, pcbCost: 10, assemblyCost: 10 });
      // total = 100
      const bucketMap = Object.fromEntries(result.buckets.map((b) => [b.bucket, b]));
      expect(bucketMap['component'].percentage).toBe(80);
      expect(bucketMap['pcb'].percentage).toBe(10);
      expect(bucketMap['assembly'].percentage).toBe(10);
    });

    it('handles bucket percentages when totalCost is zero', () => {
      const result = analyzeBomCost([], { budget: 100, pcbCost: 0, assemblyCost: 0 });
      for (const bucket of result.buckets) {
        expect(bucket.percentage).toBe(0);
      }
    });
  });

  // ── Suggestions ──

  describe('suggestions', () => {
    it('generates substitute suggestion for high-cost outlier', () => {
      // One item that accounts for >= 25% of component cost
      const bom = [
        makeBomItem({ id: '1', partNumber: 'ESP32', totalPrice: 30, unitPrice: 30, quantity: 1, description: 'MCU Module' }),
        makeBomItem({ id: '2', partNumber: 'R1K', totalPrice: 0.1, unitPrice: 0.01, quantity: 10, description: 'Resistor' }),
      ];
      const result = analyzeBomCost(bom, { budget: 20 });
      const substitutes = result.suggestions.filter((s) => s.type === 'substitute');
      expect(substitutes.length).toBeGreaterThanOrEqual(1);
      expect(substitutes[0].targetPartNumber).toBe('ESP32');
      expect(substitutes[0].estimatedSavings).toBeGreaterThan(0);
    });

    it('does NOT generate substitute for items below outlier threshold', () => {
      // Three items of roughly equal cost — none >= 25%
      const bom = [
        makeBomItem({ id: '1', totalPrice: 10 }),
        makeBomItem({ id: '2', totalPrice: 10 }),
        makeBomItem({ id: '3', totalPrice: 10 }),
        makeBomItem({ id: '4', totalPrice: 10 }),
      ];
      const result = analyzeBomCost(bom, { budget: 50 });
      expect(result.suggestions.filter((s) => s.type === 'substitute')).toHaveLength(0);
    });

    it('generates reduce_qty suggestion when quantity > 3 and unitPrice >= $0.50', () => {
      const bom = [
        makeBomItem({ id: '1', partNumber: 'LED-R', quantity: 20, unitPrice: 1, totalPrice: 20, description: 'Red LED' }),
      ];
      const result = analyzeBomCost(bom, { budget: 15 });
      const reduceQty = result.suggestions.filter((s) => s.type === 'reduce_qty');
      expect(reduceQty.length).toBeGreaterThanOrEqual(1);
      expect(reduceQty[0].targetPartNumber).toBe('LED-R');
      // Should reduce by floor(20 * 0.25) = 5
      expect(reduceQty[0].description).toContain('from 20 to 15');
      expect(reduceQty[0].estimatedSavings).toBe(5); // 5 * $1
    });

    it('does NOT generate reduce_qty for low-value items', () => {
      const bom = [
        makeBomItem({ id: '1', quantity: 100, unitPrice: 0.01, totalPrice: 1, description: 'Tiny resistor' }),
      ];
      const result = analyzeBomCost(bom, { budget: 5 });
      expect(result.suggestions.filter((s) => s.type === 'reduce_qty')).toHaveLength(0);
    });

    it('does NOT generate reduce_qty when quantity <= 3', () => {
      const bom = [
        makeBomItem({ id: '1', quantity: 3, unitPrice: 5, totalPrice: 15, description: 'Motor driver' }),
      ];
      const result = analyzeBomCost(bom, { budget: 10 });
      expect(result.suggestions.filter((s) => s.type === 'reduce_qty')).toHaveLength(0);
    });

    it('generates change_package suggestion for through-hole items', () => {
      const bom = [
        makeBomItem({ id: '1', partNumber: 'LM7805-TO-220', description: 'Voltage regulator TO-220', unitPrice: 2, quantity: 1, totalPrice: 2 }),
      ];
      const result = analyzeBomCost(bom, { budget: 5 });
      const pkgSuggestions = result.suggestions.filter((s) => s.type === 'change_package');
      expect(pkgSuggestions.length).toBeGreaterThanOrEqual(1);
      expect(pkgSuggestions[0].targetPartNumber).toBe('LM7805-TO-220');
    });

    it('generates change_package suggestion for DIP items', () => {
      const bom = [
        makeBomItem({ id: '1', partNumber: 'ATMEGA328-DIP', description: 'MCU DIP-28 package', unitPrice: 3, quantity: 1, totalPrice: 3 }),
      ];
      const result = analyzeBomCost(bom, { budget: 10 });
      const pkgSuggestions = result.suggestions.filter((s) => s.type === 'change_package');
      expect(pkgSuggestions).toHaveLength(1);
    });

    it('does NOT generate change_package for SMD items', () => {
      const bom = [
        makeBomItem({ id: '1', description: 'SMD 0603 capacitor', unitPrice: 0.8, quantity: 5, totalPrice: 4 }),
      ];
      const result = analyzeBomCost(bom, { budget: 5 });
      expect(result.suggestions.filter((s) => s.type === 'change_package')).toHaveLength(0);
    });

    it('generates eliminate suggestion for non-essential items', () => {
      const bom = [
        makeBomItem({ id: '1', partNumber: 'STANDOFF-M3', description: 'M3 standoff spacer', unitPrice: 0.5, quantity: 4, totalPrice: 2 }),
      ];
      const result = analyzeBomCost(bom, { budget: 5 });
      const eliminates = result.suggestions.filter((s) => s.type === 'eliminate');
      expect(eliminates.length).toBeGreaterThanOrEqual(1);
      expect(eliminates[0].estimatedSavings).toBe(2);
    });

    it('does NOT generate eliminate for essential items', () => {
      const bom = [
        makeBomItem({ id: '1', description: 'MCU ESP32-S3', unitPrice: 5, quantity: 1, totalPrice: 5 }),
      ];
      const result = analyzeBomCost(bom, { budget: 3 });
      expect(result.suggestions.filter((s) => s.type === 'eliminate')).toHaveLength(0);
    });

    it('sorts suggestions by estimatedSavings descending', () => {
      const bom = [
        makeBomItem({ id: '1', partNumber: 'EXPENSIVE', description: 'Expensive module', quantity: 1, unitPrice: 60, totalPrice: 60 }),
        makeBomItem({ id: '2', partNumber: 'CHEAP-LED', description: 'Red LED through-hole', quantity: 10, unitPrice: 0.8, totalPrice: 8 }),
        makeBomItem({ id: '3', partNumber: 'BRACKET', description: 'Mounting bracket', quantity: 2, unitPrice: 1, totalPrice: 2 }),
      ];
      const result = analyzeBomCost(bom, { budget: 30 });
      for (let i = 1; i < result.suggestions.length; i++) {
        expect(result.suggestions[i - 1].estimatedSavings).toBeGreaterThanOrEqual(
          result.suggestions[i].estimatedSavings,
        );
      }
    });

    it('assigns high priority to reduce_qty when savings exceed delta and over budget', () => {
      // Over budget by $10. A reduce_qty saving $15 should be high priority.
      const bom = [
        makeBomItem({ id: '1', partNumber: 'MOTOR', quantity: 8, unitPrice: 10, totalPrice: 80, description: 'DC Motor' }),
      ];
      const result = analyzeBomCost(bom, { budget: 75 });
      const reduceQty = result.suggestions.filter((s) => s.type === 'reduce_qty');
      expect(reduceQty.length).toBeGreaterThanOrEqual(1);
      expect(reduceQty[0].priority).toBe('high');
    });

    it('assigns medium priority to reduce_qty when not over budget', () => {
      const bom = [
        makeBomItem({ id: '1', partNumber: 'CAP', quantity: 20, unitPrice: 1, totalPrice: 20, description: 'Capacitor' }),
      ];
      const result = analyzeBomCost(bom, { budget: 200 });
      const reduceQty = result.suggestions.filter((s) => s.type === 'reduce_qty');
      expect(reduceQty.length).toBeGreaterThanOrEqual(1);
      expect(reduceQty[0].priority).toBe('medium');
    });
  });

  // ── Edge cases ──

  describe('edge cases', () => {
    it('handles BOM items with zero totalPrice', () => {
      const bom = [makeBomItem({ id: '1', totalPrice: 0, unitPrice: 0 })];
      const result = analyzeBomCost(bom, defaultOpts());
      expect(result.componentCost).toBe(0);
      expect(result.overBudget).toBe(false);
    });

    it('handles string-typed totalPrice (coerces via Number())', () => {
      const bom = [makeBomItem({ id: '1', totalPrice: '12.50' as unknown as number })];
      const result = analyzeBomCost(bom, defaultOpts());
      expect(result.componentCost).toBe(12.5);
    });

    it('handles budget of zero', () => {
      const bom = [makeBomItem({ totalPrice: 1 })];
      const result = analyzeBomCost(bom, { budget: 0 });
      expect(result.overBudget).toBe(true);
      expect(result.delta).toBe(6); // 1 + 5 (default pcb)
    });

    it('handles very large BOM', () => {
      const bom = Array.from({ length: 200 }, (_, i) =>
        makeBomItem({
          id: String(i),
          partNumber: `PART-${i}`,
          quantity: 1,
          unitPrice: 0.1,
          totalPrice: 0.1,
          description: `Part ${i}`,
        }),
      );
      const result = analyzeBomCost(bom, { budget: 100 });
      expect(result.componentCost).toBe(20);
      expect(result.totalCost).toBe(25);
      expect(result.overBudget).toBe(false);
    });

    it('suggestion IDs are unique', () => {
      const bom = [
        makeBomItem({ id: '1', partNumber: 'A', quantity: 10, unitPrice: 5, totalPrice: 50, description: 'Axial resistor DIP standoff' }),
        makeBomItem({ id: '2', partNumber: 'B', quantity: 10, unitPrice: 3, totalPrice: 30, description: 'TO-220 regulator bracket spacer' }),
      ];
      const result = analyzeBomCost(bom, { budget: 10 });
      const ids = result.suggestions.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('every suggestion has required fields', () => {
      const bom = [
        makeBomItem({ id: '1', partNumber: 'X', quantity: 20, unitPrice: 10, totalPrice: 200, description: 'Expensive through-hole standoff module' }),
      ];
      const result = analyzeBomCost(bom, { budget: 50 });
      expect(result.suggestions.length).toBeGreaterThan(0);
      for (const sug of result.suggestions) {
        expect(sug.id).toBeTruthy();
        expect(['substitute', 'reduce_qty', 'change_package', 'eliminate']).toContain(sug.type);
        expect(['high', 'medium', 'low']).toContain(sug.priority);
        expect(sug.targetItemId).toBeTruthy();
        expect(sug.targetPartNumber).toBeTruthy();
        expect(sug.description).toBeTruthy();
        expect(typeof sug.estimatedSavings).toBe('number');
        expect(sug.estimatedSavings).toBeGreaterThanOrEqual(0);
        expect(sug.rationale).toBeTruthy();
      }
    });

    it('does not produce duplicate suggestion types for the same item in simple cases', () => {
      // Multiple normal SMD resistors — no single item exceeds 25% of total, low value, qty <=3
      const bom = [
        makeBomItem({ id: '1', partNumber: 'R10K', quantity: 2, unitPrice: 0.02, totalPrice: 0.04, description: '10K 0402 SMD resistor' }),
        makeBomItem({ id: '2', partNumber: 'R4K7', quantity: 2, unitPrice: 0.02, totalPrice: 0.04, description: '4.7K 0402 SMD resistor' }),
        makeBomItem({ id: '3', partNumber: 'R1K', quantity: 2, unitPrice: 0.02, totalPrice: 0.04, description: '1K 0402 SMD resistor' }),
        makeBomItem({ id: '4', partNumber: 'R100', quantity: 2, unitPrice: 0.02, totalPrice: 0.04, description: '100R 0402 SMD resistor' }),
      ];
      const result = analyzeBomCost(bom, { budget: 5 });
      // Low-value, qty <=3, not through-hole, not non-essential, each is 25% (not >25%) => no suggestions
      expect(result.suggestions).toHaveLength(0);
    });
  });

  // ── Heuristic detection ──

  describe('heuristic detection', () => {
    it.each([
      ['M3 standoff spacer 10mm', true],
      ['Enclosure box ABS', true],
      ['Label sticker sheet', true],
      ['LED indicator light', true],
      ['Decorative bezel', true],
      ['Bracket mounting plate', true],
      ['ESP32-S3 WROOM', false],
      ['100uF capacitor', false],
      ['Motor driver L298N', false],
    ])('isNonEssential(%s) => %s', (desc, expected) => {
      const bom = [
        makeBomItem({ id: '1', description: desc, partNumber: 'X', quantity: 1, unitPrice: 5, totalPrice: 5 }),
      ];
      const result = analyzeBomCost(bom, { budget: 1 });
      const hasEliminate = result.suggestions.some((s) => s.type === 'eliminate');
      expect(hasEliminate).toBe(expected);
    });

    it.each([
      ['Voltage regulator TO-220', true],
      ['TO-92 transistor', true],
      ['DIP-8 op amp', true],
      ['Through-hole connector', true],
      ['Axial resistor 1/4W', true],
      ['0805 SMD capacitor', false],
      ['QFP-44 microcontroller', false],
    ])('hasPackageAlternative(%s) => %s', (desc, expected) => {
      const bom = [
        makeBomItem({ id: '1', description: desc, partNumber: 'X', quantity: 1, unitPrice: 2, totalPrice: 2 }),
      ];
      const result = analyzeBomCost(bom, { budget: 1 });
      const hasPkgSuggestion = result.suggestions.some((s) => s.type === 'change_package');
      expect(hasPkgSuggestion).toBe(expected);
    });
  });
});
