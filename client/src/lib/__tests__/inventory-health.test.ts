import { describe, it, expect } from 'vitest';
import { InventoryHealthAnalyzer } from '../inventory-health';
import type { InventoryItem } from '../inventory-health';

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeItem(overrides: Partial<InventoryItem> & { id: string; name: string }): InventoryItem {
  return { ...overrides };
}

function makeFullInventory(): InventoryItem[] {
  return [
    makeItem({
      id: '1',
      name: 'ATmega328P',
      partNumber: 'ATMEGA328P-PU',
      quantity: 10,
      minimumStock: 5,
      storageLocation: 'Bin A1',
      category: 'MCU',
    }),
    makeItem({
      id: '2',
      name: 'LED Red 5mm',
      partNumber: 'LED-R-5',
      quantity: 50,
      minimumStock: 20,
      storageLocation: 'Bin B2',
      category: 'LED',
    }),
    makeItem({
      id: '3',
      name: '10k Resistor',
      partNumber: 'RES-10K',
      quantity: 100,
      minimumStock: 30,
      storageLocation: 'Bin C3',
      category: 'Passive',
    }),
  ];
}

// ---------------------------------------------------------------------------
// Analyzer instance
// ---------------------------------------------------------------------------

const analyzer = new InventoryHealthAnalyzer();

// ---------------------------------------------------------------------------
// analyze — empty inventory
// ---------------------------------------------------------------------------

describe('InventoryHealthAnalyzer', () => {
  describe('analyze — empty inventory', () => {
    it('returns perfect score for empty inventory', () => {
      const report = analyzer.analyze([]);
      expect(report.overallScore).toBe(100);
      expect(report.grade).toBe('A');
    });

    it('returns info issue for empty inventory', () => {
      const report = analyzer.analyze([]);
      expect(report.issues).toHaveLength(1);
      expect(report.issues[0].severity).toBe('info');
    });

    it('returns a recommendation for empty inventory', () => {
      const report = analyzer.analyze([]);
      expect(report.recommendations.length).toBeGreaterThanOrEqual(1);
    });
  });

  // -------------------------------------------------------------------------
  // analyze — perfect inventory
  // -------------------------------------------------------------------------

  describe('analyze — perfect inventory', () => {
    it('returns high score for fully-tracked inventory with all active', () => {
      const items = makeFullInventory();
      const activeIds = items.map((i) => i.id);
      const report = analyzer.analyze(items, activeIds);
      expect(report.overallScore).toBeGreaterThanOrEqual(90);
      expect(report.grade).toBe('A');
    });

    it('returns all five scoring factors', () => {
      const items = makeFullInventory();
      const report = analyzer.analyze(items, items.map((i) => i.id));
      expect(report.factors).toHaveLength(5);
      const factorNames = report.factors.map((f) => f.name);
      expect(factorNames).toContain('Stock Coverage');
      expect(factorNames).toContain('Location Coverage');
      expect(factorNames).toContain('Low Stock Ratio');
      expect(factorNames).toContain('Dead Stock');
      expect(factorNames).toContain('Duplicate Detection');
    });

    it('factor weights sum to 1.0', () => {
      const report = analyzer.analyze(makeFullInventory());
      const totalWeight = report.factors.reduce((sum, f) => sum + f.weight, 0);
      expect(totalWeight).toBeCloseTo(1.0);
    });
  });

  // -------------------------------------------------------------------------
  // Grade thresholds
  // -------------------------------------------------------------------------

  describe('grades', () => {
    it('assigns grade A for score >= 90', () => {
      const items = makeFullInventory();
      const report = analyzer.analyze(items, items.map((i) => i.id));
      expect(report.overallScore).toBeGreaterThanOrEqual(90);
      expect(report.grade).toBe('A');
    });

    it('assigns grade F for very poor inventory', () => {
      // Items with no quantity, no location, no minimumStock
      const items: InventoryItem[] = [
        makeItem({ id: '1', name: 'Unknown 1' }),
        makeItem({ id: '2', name: 'Unknown 2' }),
        makeItem({ id: '3', name: 'Unknown 3' }),
      ];
      // All items are dead stock (none in active designs)
      const report = analyzer.analyze(items, ['active-1']);
      expect(report.overallScore).toBeLessThan(60);
      expect(report.grade).toBe('F');
    });
  });

  // -------------------------------------------------------------------------
  // Stock coverage factor
  // -------------------------------------------------------------------------

  describe('stock coverage', () => {
    it('gives 100 when all items have quantity', () => {
      const items = makeFullInventory();
      const report = analyzer.analyze(items);
      const factor = report.factors.find((f) => f.name === 'Stock Coverage')!;
      expect(factor.score).toBe(100);
    });

    it('gives 0 when no items have quantity', () => {
      const items: InventoryItem[] = [
        makeItem({ id: '1', name: 'A' }),
        makeItem({ id: '2', name: 'B' }),
      ];
      const report = analyzer.analyze(items);
      const factor = report.factors.find((f) => f.name === 'Stock Coverage')!;
      expect(factor.score).toBe(0);
    });

    it('gives 50 when half have quantity', () => {
      const items: InventoryItem[] = [
        makeItem({ id: '1', name: 'A', quantity: 5 }),
        makeItem({ id: '2', name: 'B' }),
      ];
      const report = analyzer.analyze(items);
      const factor = report.factors.find((f) => f.name === 'Stock Coverage')!;
      expect(factor.score).toBe(50);
    });
  });

  // -------------------------------------------------------------------------
  // Location coverage factor
  // -------------------------------------------------------------------------

  describe('location coverage', () => {
    it('gives 100 when all items have locations', () => {
      const items = makeFullInventory();
      const report = analyzer.analyze(items);
      const factor = report.factors.find((f) => f.name === 'Location Coverage')!;
      expect(factor.score).toBe(100);
    });

    it('gives 0 when no items have locations', () => {
      const items: InventoryItem[] = [
        makeItem({ id: '1', name: 'A', quantity: 5 }),
        makeItem({ id: '2', name: 'B', quantity: 3 }),
      ];
      const report = analyzer.analyze(items);
      const factor = report.factors.find((f) => f.name === 'Location Coverage')!;
      expect(factor.score).toBe(0);
    });

    it('treats empty string location as unassigned', () => {
      const items: InventoryItem[] = [
        makeItem({ id: '1', name: 'A', storageLocation: '' }),
      ];
      const report = analyzer.analyze(items);
      const factor = report.factors.find((f) => f.name === 'Location Coverage')!;
      expect(factor.score).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Low stock ratio factor
  // -------------------------------------------------------------------------

  describe('low stock ratio', () => {
    it('gives 100 when all items are above minimum', () => {
      const items = makeFullInventory(); // all well stocked
      const report = analyzer.analyze(items);
      const factor = report.factors.find((f) => f.name === 'Low Stock Ratio')!;
      expect(factor.score).toBe(100);
    });

    it('penalizes items below minimum stock', () => {
      const items: InventoryItem[] = [
        makeItem({ id: '1', name: 'A', quantity: 2, minimumStock: 10 }),
        makeItem({ id: '2', name: 'B', quantity: 20, minimumStock: 5 }),
      ];
      const report = analyzer.analyze(items);
      const factor = report.factors.find((f) => f.name === 'Low Stock Ratio')!;
      expect(factor.score).toBe(50); // 1 of 2 below minimum
    });

    it('gives 0 when all items are below minimum', () => {
      const items: InventoryItem[] = [
        makeItem({ id: '1', name: 'A', quantity: 1, minimumStock: 10 }),
        makeItem({ id: '2', name: 'B', quantity: 0, minimumStock: 5 }),
      ];
      const report = analyzer.analyze(items);
      const factor = report.factors.find((f) => f.name === 'Low Stock Ratio')!;
      expect(factor.score).toBe(0);
    });

    it('gives neutral score when no items have minimumStock configured', () => {
      const items: InventoryItem[] = [
        makeItem({ id: '1', name: 'A', quantity: 10 }),
      ];
      const report = analyzer.analyze(items);
      const factor = report.factors.find((f) => f.name === 'Low Stock Ratio')!;
      expect(factor.score).toBe(75);
    });
  });

  // -------------------------------------------------------------------------
  // Dead stock factor
  // -------------------------------------------------------------------------

  describe('dead stock', () => {
    it('gives 100 when all items are in active designs', () => {
      const items = makeFullInventory();
      const report = analyzer.analyze(items, items.map((i) => i.id));
      const factor = report.factors.find((f) => f.name === 'Dead Stock')!;
      expect(factor.score).toBe(100);
    });

    it('gives 0 when no items are in active designs', () => {
      const items = makeFullInventory();
      const report = analyzer.analyze(items, ['other-id']);
      const factor = report.factors.find((f) => f.name === 'Dead Stock')!;
      expect(factor.score).toBe(0);
    });

    it('gives neutral score when no active designs provided', () => {
      const items = makeFullInventory();
      const report = analyzer.analyze(items);
      const factor = report.factors.find((f) => f.name === 'Dead Stock')!;
      expect(factor.score).toBe(75);
    });

    it('gives neutral score with empty activeDesignBomIds array', () => {
      const items = makeFullInventory();
      const report = analyzer.analyze(items, []);
      const factor = report.factors.find((f) => f.name === 'Dead Stock')!;
      expect(factor.score).toBe(75);
    });
  });

  // -------------------------------------------------------------------------
  // Duplicate detection factor
  // -------------------------------------------------------------------------

  describe('duplicate detection', () => {
    it('gives 100 when no duplicates exist', () => {
      const items = makeFullInventory();
      const report = analyzer.analyze(items);
      const factor = report.factors.find((f) => f.name === 'Duplicate Detection')!;
      expect(factor.score).toBe(100);
    });

    it('penalizes duplicate part numbers', () => {
      const items: InventoryItem[] = [
        makeItem({ id: '1', name: 'A', partNumber: 'RES-10K', storageLocation: 'Bin 1', quantity: 50 }),
        makeItem({ id: '2', name: 'B', partNumber: 'RES-10K', storageLocation: 'Bin 2', quantity: 30 }),
        makeItem({ id: '3', name: 'C', partNumber: 'CAP-100', storageLocation: 'Bin 3', quantity: 20 }),
      ];
      const report = analyzer.analyze(items, items.map((i) => i.id));
      const factor = report.factors.find((f) => f.name === 'Duplicate Detection')!;
      expect(factor.score).toBeLessThan(100);
    });

    it('ignores items without part numbers', () => {
      const items: InventoryItem[] = [
        makeItem({ id: '1', name: 'A', quantity: 5, storageLocation: 'X' }),
        makeItem({ id: '2', name: 'B', quantity: 3, storageLocation: 'Y' }),
      ];
      const report = analyzer.analyze(items, items.map((i) => i.id));
      const factor = report.factors.find((f) => f.name === 'Duplicate Detection')!;
      expect(factor.score).toBe(100);
    });
  });

  // -------------------------------------------------------------------------
  // detectDeadStock
  // -------------------------------------------------------------------------

  describe('detectDeadStock', () => {
    it('returns items not in active designs', () => {
      const items = makeFullInventory();
      const dead = analyzer.detectDeadStock(items, ['1', '2']);
      expect(dead).toHaveLength(1);
      expect(dead[0].id).toBe('3');
    });

    it('returns empty array when all items are active', () => {
      const items = makeFullInventory();
      const dead = analyzer.detectDeadStock(items, items.map((i) => i.id));
      expect(dead).toHaveLength(0);
    });

    it('returns all items when none are active', () => {
      const items = makeFullInventory();
      const dead = analyzer.detectDeadStock(items, []);
      expect(dead).toHaveLength(3);
    });
  });

  // -------------------------------------------------------------------------
  // detectDuplicates
  // -------------------------------------------------------------------------

  describe('detectDuplicates', () => {
    it('detects items with same part number', () => {
      const items: InventoryItem[] = [
        makeItem({ id: '1', name: 'A', partNumber: 'RES-10K' }),
        makeItem({ id: '2', name: 'B', partNumber: 'RES-10K' }),
        makeItem({ id: '3', name: 'C', partNumber: 'CAP-100' }),
      ];
      const dupes = analyzer.detectDuplicates(items);
      expect(dupes).toHaveLength(1);
      expect(dupes[0].partNumber).toBe('RES-10K');
      expect(dupes[0].items).toHaveLength(2);
    });

    it('returns empty array when no duplicates', () => {
      const items = makeFullInventory();
      const dupes = analyzer.detectDuplicates(items);
      expect(dupes).toHaveLength(0);
    });

    it('ignores items without part numbers', () => {
      const items: InventoryItem[] = [
        makeItem({ id: '1', name: 'A' }),
        makeItem({ id: '2', name: 'B' }),
      ];
      const dupes = analyzer.detectDuplicates(items);
      expect(dupes).toHaveLength(0);
    });

    it('ignores empty string part numbers', () => {
      const items: InventoryItem[] = [
        makeItem({ id: '1', name: 'A', partNumber: '' }),
        makeItem({ id: '2', name: 'B', partNumber: '' }),
      ];
      const dupes = analyzer.detectDuplicates(items);
      expect(dupes).toHaveLength(0);
    });

    it('detects multiple duplicate groups', () => {
      const items: InventoryItem[] = [
        makeItem({ id: '1', name: 'A', partNumber: 'RES-10K' }),
        makeItem({ id: '2', name: 'B', partNumber: 'RES-10K' }),
        makeItem({ id: '3', name: 'C', partNumber: 'CAP-100' }),
        makeItem({ id: '4', name: 'D', partNumber: 'CAP-100' }),
        makeItem({ id: '5', name: 'E', partNumber: 'CAP-100' }),
      ];
      const dupes = analyzer.detectDuplicates(items);
      expect(dupes).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // Issues
  // -------------------------------------------------------------------------

  describe('issues', () => {
    it('reports critical issue for out-of-stock items', () => {
      const items: InventoryItem[] = [
        makeItem({ id: '1', name: 'A', quantity: 0, minimumStock: 5, storageLocation: 'X' }),
      ];
      const report = analyzer.analyze(items, ['1']);
      const critical = report.issues.filter((i) => i.severity === 'critical');
      expect(critical.length).toBeGreaterThanOrEqual(1);
      expect(critical.some((i) => i.message.includes('out of stock'))).toBe(true);
    });

    it('reports critical issue for below-minimum items', () => {
      const items: InventoryItem[] = [
        makeItem({ id: '1', name: 'A', quantity: 2, minimumStock: 10, storageLocation: 'X' }),
      ];
      const report = analyzer.analyze(items, ['1']);
      const critical = report.issues.filter((i) => i.severity === 'critical');
      expect(critical.some((i) => i.message.includes('below minimum'))).toBe(true);
    });

    it('reports warning for items without location', () => {
      const items: InventoryItem[] = [
        makeItem({ id: '1', name: 'A', quantity: 5 }),
      ];
      const report = analyzer.analyze(items, ['1']);
      const warnings = report.issues.filter((i) => i.severity === 'warning');
      expect(warnings.some((i) => i.message.includes('no storage location'))).toBe(true);
    });

    it('reports warning for items without quantity', () => {
      const items: InventoryItem[] = [
        makeItem({ id: '1', name: 'A', storageLocation: 'Bin A' }),
      ];
      const report = analyzer.analyze(items, ['1']);
      const warnings = report.issues.filter((i) => i.severity === 'warning');
      expect(warnings.some((i) => i.message.includes('no quantity'))).toBe(true);
    });

    it('reports info for dead stock', () => {
      const items: InventoryItem[] = [
        makeItem({ id: '1', name: 'A', quantity: 5, storageLocation: 'X', minimumStock: 2 }),
      ];
      const report = analyzer.analyze(items, ['other']);
      const info = report.issues.filter((i) => i.severity === 'info');
      expect(info.some((i) => i.message.includes('not used in any active design'))).toBe(true);
    });

    it('includes affected item IDs in issues', () => {
      const items: InventoryItem[] = [
        makeItem({ id: 'abc', name: 'A', quantity: 0, minimumStock: 5, storageLocation: 'X' }),
      ];
      const report = analyzer.analyze(items, ['abc']);
      const outOfStock = report.issues.find((i) => i.message.includes('out of stock'));
      expect(outOfStock?.affectedItems).toContain('abc');
    });
  });

  // -------------------------------------------------------------------------
  // Recommendations
  // -------------------------------------------------------------------------

  describe('recommendations', () => {
    it('recommends restocking when items are below minimum', () => {
      const items: InventoryItem[] = [
        makeItem({ id: '1', name: 'A', quantity: 1, minimumStock: 10, storageLocation: 'X' }),
        makeItem({ id: '2', name: 'B', quantity: 2, minimumStock: 20, storageLocation: 'Y' }),
      ];
      const report = analyzer.analyze(items, items.map((i) => i.id));
      const highPriority = report.recommendations.filter((r) => r.priority === 'high');
      expect(highPriority.some((r) => r.action.includes('Restock'))).toBe(true);
    });

    it('recommends adding quantity tracking', () => {
      const items: InventoryItem[] = [
        makeItem({ id: '1', name: 'A' }),
        makeItem({ id: '2', name: 'B' }),
        makeItem({ id: '3', name: 'C' }),
      ];
      const report = analyzer.analyze(items, items.map((i) => i.id));
      const recs = report.recommendations.filter((r) => r.action.includes('quantity tracking'));
      expect(recs.length).toBeGreaterThanOrEqual(1);
    });

    it('recommends assigning locations', () => {
      const items: InventoryItem[] = [
        makeItem({ id: '1', name: 'A', quantity: 5 }),
        makeItem({ id: '2', name: 'B', quantity: 3 }),
        makeItem({ id: '3', name: 'C', quantity: 7 }),
      ];
      const report = analyzer.analyze(items, items.map((i) => i.id));
      const recs = report.recommendations.filter((r) => r.action.includes('storage locations'));
      expect(recs.length).toBeGreaterThanOrEqual(1);
    });

    it('recommends consolidating duplicates', () => {
      const items: InventoryItem[] = [
        makeItem({ id: '1', name: 'A', partNumber: 'RES-10K', quantity: 50, minimumStock: 10, storageLocation: 'X' }),
        makeItem({ id: '2', name: 'B', partNumber: 'RES-10K', quantity: 30, minimumStock: 10, storageLocation: 'Y' }),
      ];
      const report = analyzer.analyze(items, items.map((i) => i.id));
      const recs = report.recommendations.filter((r) => r.action.includes('Consolidate'));
      expect(recs.length).toBeGreaterThanOrEqual(1);
    });

    it('recommends setting minimum stock thresholds', () => {
      const items: InventoryItem[] = [
        makeItem({ id: '1', name: 'A', quantity: 10, storageLocation: 'Bin A' }),
      ];
      const report = analyzer.analyze(items, ['1']);
      const recs = report.recommendations.filter((r) => r.action.includes('minimum stock thresholds'));
      expect(recs.length).toBeGreaterThanOrEqual(1);
    });

    it('all recommendations have required fields', () => {
      const items: InventoryItem[] = [
        makeItem({ id: '1', name: 'A' }),
      ];
      const report = analyzer.analyze(items);
      for (const rec of report.recommendations) {
        expect(rec.priority).toMatch(/^(high|medium|low)$/);
        expect(rec.action.length).toBeGreaterThan(0);
        expect(rec.impact.length).toBeGreaterThan(0);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Overall score computation
  // -------------------------------------------------------------------------

  describe('score computation', () => {
    it('overall score is weighted average of factors', () => {
      const items = makeFullInventory();
      const report = analyzer.analyze(items, items.map((i) => i.id));
      const expected = Math.round(
        report.factors.reduce((sum, f) => sum + f.score * f.weight, 0),
      );
      expect(report.overallScore).toBe(expected);
    });

    it('score is between 0 and 100', () => {
      const items: InventoryItem[] = [
        makeItem({ id: '1', name: 'A' }),
      ];
      const report = analyzer.analyze(items, ['other']);
      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.overallScore).toBeLessThanOrEqual(100);
    });
  });
});
