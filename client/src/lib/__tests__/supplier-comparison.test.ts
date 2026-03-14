import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildComparison,
  sortComparisonRows,
  getUnitPriceForQuantity,
  findMockPart,
  getAvailableMpns,
  getMockDistributorCount,
  getMockDistributorIds,
} from '../supplier-comparison';
import type {
  ComparisonResult,
  ComparisonRow,
  SortState,
} from '../supplier-comparison';
import type { PricingTier } from '../supplier-api';

// ---------------------------------------------------------------------------
// getUnitPriceForQuantity
// ---------------------------------------------------------------------------

describe('getUnitPriceForQuantity', () => {
  const tiers: PricingTier[] = [
    { minQuantity: 1, maxQuantity: 9, unitPrice: 5.00, currency: 'USD' },
    { minQuantity: 10, maxQuantity: 99, unitPrice: 4.00, currency: 'USD' },
    { minQuantity: 100, maxQuantity: null, unitPrice: 3.00, currency: 'USD' },
  ];

  it('returns tier-1 price for quantity 1', () => {
    expect(getUnitPriceForQuantity(tiers, 1)).toBe(5.00);
  });

  it('returns tier-1 price for quantity 5 (within 1-9 range)', () => {
    expect(getUnitPriceForQuantity(tiers, 5)).toBe(5.00);
  });

  it('returns tier-2 price for quantity 10', () => {
    expect(getUnitPriceForQuantity(tiers, 10)).toBe(4.00);
  });

  it('returns tier-2 price for quantity 50', () => {
    expect(getUnitPriceForQuantity(tiers, 50)).toBe(4.00);
  });

  it('returns tier-3 price for quantity 100', () => {
    expect(getUnitPriceForQuantity(tiers, 100)).toBe(3.00);
  });

  it('returns tier-3 price for quantity 500 (above highest tier)', () => {
    expect(getUnitPriceForQuantity(tiers, 500)).toBe(3.00);
  });

  it('returns 0 for empty tiers', () => {
    expect(getUnitPriceForQuantity([], 10)).toBe(0);
  });

  it('handles unsorted tiers correctly', () => {
    const unsorted: PricingTier[] = [
      { minQuantity: 100, maxQuantity: null, unitPrice: 1.00, currency: 'USD' },
      { minQuantity: 1, maxQuantity: 9, unitPrice: 3.00, currency: 'USD' },
      { minQuantity: 10, maxQuantity: 99, unitPrice: 2.00, currency: 'USD' },
    ];
    expect(getUnitPriceForQuantity(unsorted, 50)).toBe(2.00);
  });
});

// ---------------------------------------------------------------------------
// findMockPart
// ---------------------------------------------------------------------------

describe('findMockPart', () => {
  it('finds a known part by exact MPN', () => {
    const part = findMockPart('ATmega328P');
    expect(part).not.toBeNull();
    expect(part!.mpn).toBe('ATmega328P');
  });

  it('finds a part case-insensitively', () => {
    const part = findMockPart('atmega328p');
    expect(part).not.toBeNull();
    expect(part!.mpn).toBe('ATmega328P');
  });

  it('trims whitespace', () => {
    const part = findMockPart('  LM7805  ');
    expect(part).not.toBeNull();
    expect(part!.mpn).toBe('LM7805');
  });

  it('returns null for unknown part', () => {
    expect(findMockPart('NONEXISTENT-PART-123')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(findMockPart('')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getAvailableMpns / getMockDistributorCount / getMockDistributorIds
// ---------------------------------------------------------------------------

describe('catalog metadata', () => {
  it('returns at least 5 available MPNs', () => {
    const mpns = getAvailableMpns();
    expect(mpns.length).toBeGreaterThanOrEqual(5);
  });

  it('includes known MPNs in the catalog', () => {
    const mpns = getAvailableMpns();
    expect(mpns).toContain('ATmega328P');
    expect(mpns).toContain('ESP32-WROOM-32');
    expect(mpns).toContain('NE555');
  });

  it('returns 5 mock distributors', () => {
    expect(getMockDistributorCount()).toBe(5);
  });

  it('returns the expected distributor IDs', () => {
    const ids = getMockDistributorIds();
    expect(ids).toContain('mouser');
    expect(ids).toContain('digikey');
    expect(ids).toContain('lcsc');
    expect(ids).toContain('farnell');
    expect(ids).toContain('arrow');
  });

  it('getMockDistributorIds returns a copy (not a reference)', () => {
    const a = getMockDistributorIds();
    const b = getMockDistributorIds();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// buildComparison
// ---------------------------------------------------------------------------

describe('buildComparison', () => {
  it('returns null for unknown part', () => {
    expect(buildComparison('UNKNOWN-MPN', 1)).toBeNull();
  });

  it('builds a comparison with 5 rows for a known part', () => {
    const result = buildComparison('ATmega328P', 1);
    expect(result).not.toBeNull();
    expect(result!.rows).toHaveLength(5);
  });

  it('populates mpn, manufacturer, and description', () => {
    const result = buildComparison('LM7805', 1)!;
    expect(result.mpn).toBe('LM7805');
    expect(result.manufacturer).toBe('Texas Instruments');
    expect(result.description).toContain('Voltage Regulator');
  });

  it('records the effective quantity', () => {
    const result = buildComparison('NE555', 25)!;
    expect(result.quantity).toBe(25);
  });

  it('rounds fractional quantity up to nearest integer', () => {
    const result = buildComparison('NE555', 3.7)!;
    expect(result.quantity).toBe(4);
  });

  it('clamps quantity to at least 1', () => {
    const result = buildComparison('NE555', 0)!;
    expect(result.quantity).toBe(1);
    const resultNeg = buildComparison('NE555', -5)!;
    expect(resultNeg.quantity).toBe(1);
  });

  it('calculates unitPrice based on quantity tier', () => {
    const result1 = buildComparison('ATmega328P', 1)!;
    const result100 = buildComparison('ATmega328P', 100)!;
    // At qty 1, unit price should be higher than at qty 100
    const mouserRow1 = result1.rows.find((r) => r.distributorId === 'mouser')!;
    const mouserRow100 = result100.rows.find((r) => r.distributorId === 'mouser')!;
    expect(mouserRow1.unitPrice).toBeGreaterThan(mouserRow100.unitPrice);
  });

  it('calculates totalPrice = unitPrice * quantity', () => {
    const result = buildComparison('ATmega328P', 10)!;
    for (const row of result.rows) {
      const expected = Math.round(row.unitPrice * 10 * 100) / 100;
      expect(row.totalPrice).toBe(expected);
    }
  });

  it('marks exactly one row as best value', () => {
    const result = buildComparison('ESP32-WROOM-32', 50)!;
    const bestRows = result.rows.filter((r) => r.isBestValue);
    expect(bestRows).toHaveLength(1);
  });

  it('bestValueIndex matches the best value row', () => {
    const result = buildComparison('LM7805', 1)!;
    expect(result.bestValueIndex).toBeGreaterThanOrEqual(0);
    expect(result.rows[result.bestValueIndex].isBestValue).toBe(true);
  });

  it('best value is the lowest totalPrice among in-stock parts', () => {
    const result = buildComparison('NE555', 10)!;
    const bestRow = result.rows[result.bestValueIndex];
    const inStockRows = result.rows.filter(
      (r) => r.stockStatus === 'in-stock' || r.stockStatus === 'low-stock',
    );
    for (const row of inStockRows) {
      expect(bestRow.totalPrice).toBeLessThanOrEqual(row.totalPrice);
    }
  });

  it('populates stockStatus on each row', () => {
    const result = buildComparison('STM32F103C8T6', 1)!;
    for (const row of result.rows) {
      expect(['in-stock', 'low-stock', 'out-of-stock']).toContain(row.stockStatus);
    }
  });

  it('populates sku, packaging, and url on each row', () => {
    const result = buildComparison('ATmega328P', 1)!;
    for (const row of result.rows) {
      expect(row.sku.length).toBeGreaterThan(0);
      expect(row.packaging.length).toBeGreaterThan(0);
      expect(row.url).toContain(row.distributorId);
    }
  });

  it('includes pricingTiers on each row', () => {
    const result = buildComparison('AMS1117-3.3', 1)!;
    for (const row of result.rows) {
      expect(row.pricingTiers.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('is case-insensitive for MPN lookup', () => {
    const result = buildComparison('ne555', 1);
    expect(result).not.toBeNull();
    expect(result!.mpn).toBe('NE555');
  });
});

// ---------------------------------------------------------------------------
// sortComparisonRows
// ---------------------------------------------------------------------------

describe('sortComparisonRows', () => {
  let rows: ComparisonRow[];

  function makeRow(overrides: Partial<ComparisonRow>): ComparisonRow {
    return {
      distributorId: 'mouser',
      distributorName: 'Mouser',
      sku: 'SKU-1',
      stock: 100,
      stockStatus: 'in-stock',
      leadTimeDays: null,
      moq: 1,
      packaging: 'tube',
      unitPrice: 1.00,
      totalPrice: 1.00,
      pricingTiers: [],
      url: 'https://example.com',
      isBestValue: false,
      ...overrides,
    };
  }

  beforeEach(() => {
    rows = [
      makeRow({ distributorName: 'DigiKey', unitPrice: 2.50, totalPrice: 25.00, stock: 500, leadTimeDays: 3, moq: 1 }),
      makeRow({ distributorName: 'Mouser', unitPrice: 2.80, totalPrice: 28.00, stock: 300, leadTimeDays: 5, moq: 1 }),
      makeRow({ distributorName: 'LCSC', unitPrice: 1.90, totalPrice: 19.00, stock: 12000, leadTimeDays: null, moq: 10 }),
      makeRow({ distributorName: 'Arrow', unitPrice: 2.40, totalPrice: 24.00, stock: 800, leadTimeDays: 7, moq: 5 }),
      makeRow({ distributorName: 'Farnell', unitPrice: 3.00, totalPrice: 30.00, stock: 200, leadTimeDays: 2, moq: 1 }),
    ];
  });

  it('sorts by unitPrice ascending', () => {
    const sorted = sortComparisonRows(rows, { field: 'unitPrice', direction: 'asc' });
    expect(sorted[0].distributorName).toBe('LCSC');
    expect(sorted[sorted.length - 1].distributorName).toBe('Farnell');
  });

  it('sorts by unitPrice descending', () => {
    const sorted = sortComparisonRows(rows, { field: 'unitPrice', direction: 'desc' });
    expect(sorted[0].distributorName).toBe('Farnell');
    expect(sorted[sorted.length - 1].distributorName).toBe('LCSC');
  });

  it('sorts by stock ascending', () => {
    const sorted = sortComparisonRows(rows, { field: 'stock', direction: 'asc' });
    expect(sorted[0].stock).toBe(200);
  });

  it('sorts by stock descending', () => {
    const sorted = sortComparisonRows(rows, { field: 'stock', direction: 'desc' });
    expect(sorted[0].stock).toBe(12000);
  });

  it('sorts by distributorName ascending', () => {
    const sorted = sortComparisonRows(rows, { field: 'distributorName', direction: 'asc' });
    expect(sorted[0].distributorName).toBe('Arrow');
    expect(sorted[sorted.length - 1].distributorName).toBe('Mouser');
  });

  it('sorts by distributorName descending', () => {
    const sorted = sortComparisonRows(rows, { field: 'distributorName', direction: 'desc' });
    expect(sorted[0].distributorName).toBe('Mouser');
  });

  it('sorts by leadTimeDays ascending, nulls last', () => {
    const sorted = sortComparisonRows(rows, { field: 'leadTimeDays', direction: 'asc' });
    expect(sorted[0].leadTimeDays).toBe(2);
    expect(sorted[sorted.length - 1].leadTimeDays).toBeNull();
  });

  it('sorts by leadTimeDays descending, nulls last', () => {
    const sorted = sortComparisonRows(rows, { field: 'leadTimeDays', direction: 'desc' });
    expect(sorted[0].leadTimeDays).toBe(7);
    expect(sorted[sorted.length - 1].leadTimeDays).toBeNull();
  });

  it('sorts by moq ascending', () => {
    const sorted = sortComparisonRows(rows, { field: 'moq', direction: 'asc' });
    expect(sorted[0].moq).toBe(1);
    expect(sorted[sorted.length - 1].moq).toBe(10);
  });

  it('sorts by totalPrice ascending', () => {
    const sorted = sortComparisonRows(rows, { field: 'totalPrice', direction: 'asc' });
    expect(sorted[0].totalPrice).toBe(19.00);
    expect(sorted[sorted.length - 1].totalPrice).toBe(30.00);
  });

  it('does not mutate the original array', () => {
    const original = [...rows];
    sortComparisonRows(rows, { field: 'unitPrice', direction: 'asc' });
    expect(rows).toEqual(original);
  });

  it('returns a new array reference', () => {
    const sorted = sortComparisonRows(rows, { field: 'unitPrice', direction: 'asc' });
    expect(sorted).not.toBe(rows);
  });
});

// ---------------------------------------------------------------------------
// Integration: buildComparison + sortComparisonRows
// ---------------------------------------------------------------------------

describe('buildComparison + sortComparisonRows integration', () => {
  it('can build and then sort by price', () => {
    const result = buildComparison('ATmega328P', 10)!;
    const sorted = sortComparisonRows(result.rows, { field: 'unitPrice', direction: 'asc' });
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].unitPrice).toBeGreaterThanOrEqual(sorted[i - 1].unitPrice);
    }
  });

  it('best value row is preserved after sorting', () => {
    const result = buildComparison('ESP32-WROOM-32', 25)!;
    const sorted = sortComparisonRows(result.rows, { field: 'stock', direction: 'desc' });
    const bestRows = sorted.filter((r) => r.isBestValue);
    expect(bestRows).toHaveLength(1);
  });

  it('quantity affects tier pricing correctly', () => {
    const result1 = buildComparison('AMS1117-3.3', 1)!;
    const result100 = buildComparison('AMS1117-3.3', 100)!;
    const lcsc1 = result1.rows.find((r) => r.distributorId === 'lcsc')!;
    const lcsc100 = result100.rows.find((r) => r.distributorId === 'lcsc')!;
    expect(lcsc1.unitPrice).toBeGreaterThan(lcsc100.unitPrice);
    expect(lcsc100.totalPrice).toBeGreaterThan(lcsc1.totalPrice); // 100 * lower price > 1 * higher price
  });
});
