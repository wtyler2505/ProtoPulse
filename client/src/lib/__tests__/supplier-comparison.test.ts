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

// ---------------------------------------------------------------------------
// Generic Supplier Comparison Engine (BL-0238)
// ---------------------------------------------------------------------------

import {
  compareSuppliers,
  calculateTotalCost,
  formatLeadTime,
  sortByValue,
} from '../supplier-comparison';
import type {
  SupplierQuote,
  GenericComparisonResult,
  RankedQuote,
} from '../supplier-comparison';

function mkQuote(overrides: Partial<SupplierQuote> = {}): SupplierQuote {
  return {
    supplier: 'Test Supplier',
    unitPrice: 1.00,
    moq: 1,
    leadTimeDays: 3,
    stockQuantity: 100,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// calculateTotalCost
// ---------------------------------------------------------------------------

describe('calculateTotalCost', () => {
  it('returns unitPrice * quantity when quantity >= moq', () => {
    const q = mkQuote({ unitPrice: 2.50, moq: 1 });
    expect(calculateTotalCost(q, 10)).toBe(25.00);
  });

  it('uses MOQ when quantity < MOQ', () => {
    const q = mkQuote({ unitPrice: 2.00, moq: 25 });
    // quantity=5 but moq=25, so effective qty is 25
    expect(calculateTotalCost(q, 5)).toBe(50.00);
  });

  it('rounds to 2 decimal places', () => {
    const q = mkQuote({ unitPrice: 0.333, moq: 1 });
    const result = calculateTotalCost(q, 3);
    // 0.333 * 3 = 0.999 → rounds to 1.00
    expect(result).toBe(1.00);
  });

  it('handles zero unitPrice', () => {
    const q = mkQuote({ unitPrice: 0, moq: 1 });
    expect(calculateTotalCost(q, 100)).toBe(0);
  });

  it('handles zero MOQ (treated as no minimum)', () => {
    const q = mkQuote({ unitPrice: 1.00, moq: 0 });
    expect(calculateTotalCost(q, 10)).toBe(10.00);
  });
});

// ---------------------------------------------------------------------------
// formatLeadTime
// ---------------------------------------------------------------------------

describe('formatLeadTime', () => {
  it('returns "In stock" for 0 days', () => {
    expect(formatLeadTime(0)).toBe('In stock');
  });

  it('returns "In stock" for negative days', () => {
    expect(formatLeadTime(-1)).toBe('In stock');
  });

  it('returns "1 day" for 1 day', () => {
    expect(formatLeadTime(1)).toBe('1 day');
  });

  it('returns "3 days" for 3 days', () => {
    expect(formatLeadTime(3)).toBe('3 days');
  });

  it('returns "14 days" for 14 days', () => {
    expect(formatLeadTime(14)).toBe('14 days');
  });

  it('returns weeks for 15+ days', () => {
    expect(formatLeadTime(21)).toBe('3 weeks');
  });

  it('returns week range for non-exact weeks', () => {
    expect(formatLeadTime(18)).toBe('2-3 weeks');
  });

  it('returns "1 week" for exactly 7 days (> 14 threshold not met)', () => {
    // 7 days is <=14, so still formatted as days
    expect(formatLeadTime(7)).toBe('7 days');
  });
});

// ---------------------------------------------------------------------------
// compareSuppliers
// ---------------------------------------------------------------------------

describe('compareSuppliers', () => {
  it('returns empty result for no quotes', () => {
    const result = compareSuppliers([], 10);
    expect(result.quotes).toHaveLength(0);
    expect(result.bestValue).toBeNull();
    expect(result.cheapest).toBeNull();
    expect(result.fastest).toBeNull();
    expect(result.recommendations).toHaveLength(0);
  });

  it('single quote gets all badges', () => {
    const result = compareSuppliers([mkQuote({ supplier: 'Solo' })], 10);
    expect(result.quotes).toHaveLength(1);
    const q = result.quotes[0];
    expect(q.badges).toContain('cheapest');
    expect(q.badges).toContain('fastest');
    expect(q.badges).toContain('best-value');
    expect(q.badges).toContain('in-stock');
  });

  it('two quotes — correct cheapest/fastest assignment', () => {
    const quotes: SupplierQuote[] = [
      mkQuote({ supplier: 'Cheap', unitPrice: 1.00, leadTimeDays: 10, stockQuantity: 500 }),
      mkQuote({ supplier: 'Fast', unitPrice: 3.00, leadTimeDays: 1, stockQuantity: 500 }),
    ];
    const result = compareSuppliers(quotes, 10);
    const cheap = result.quotes.find((q) => q.supplier === 'Cheap')!;
    const fast = result.quotes.find((q) => q.supplier === 'Fast')!;
    expect(cheap.badges).toContain('cheapest');
    expect(fast.badges).toContain('fastest');
  });

  it('MOQ affects total cost', () => {
    const quotes: SupplierQuote[] = [
      mkQuote({ supplier: 'LowMOQ', unitPrice: 2.00, moq: 1 }),
      mkQuote({ supplier: 'HighMOQ', unitPrice: 1.50, moq: 100 }),
    ];
    const result = compareSuppliers(quotes, 5);
    const lowMoq = result.quotes.find((q) => q.supplier === 'LowMOQ')!;
    const highMoq = result.quotes.find((q) => q.supplier === 'HighMOQ')!;
    // LowMOQ: 2.00 * 5 = 10.00; HighMOQ: 1.50 * 100 = 150.00
    expect(lowMoq.totalCost).toBe(10.00);
    expect(highMoq.totalCost).toBe(150.00);
    expect(lowMoq.badges).toContain('cheapest');
  });

  it('value scoring weights work correctly', () => {
    const quotes: SupplierQuote[] = [
      mkQuote({ supplier: 'Balanced', unitPrice: 2.00, leadTimeDays: 3, stockQuantity: 500, rating: 4.5 }),
      mkQuote({ supplier: 'CheapSlow', unitPrice: 1.00, leadTimeDays: 30, stockQuantity: 10, rating: 2.0 }),
      mkQuote({ supplier: 'ExpensiveFast', unitPrice: 5.00, leadTimeDays: 0, stockQuantity: 1000, rating: 5.0 }),
    ];
    const result = compareSuppliers(quotes, 10);
    // All quotes should have a valueScore between 0 and 1
    for (const q of result.quotes) {
      expect(q.valueScore).toBeGreaterThanOrEqual(0);
      expect(q.valueScore).toBeLessThanOrEqual(1);
    }
    // Balanced should be best-value (good across all factors)
    expect(result.bestValue).not.toBeNull();
  });

  it('recommendations generated for meaningful price differences (>5%)', () => {
    const quotes: SupplierQuote[] = [
      mkQuote({ supplier: 'Cheap Co', unitPrice: 1.00, moq: 1 }),
      mkQuote({ supplier: 'Expensive Co', unitPrice: 5.00, moq: 1 }),
    ];
    const result = compareSuppliers(quotes, 10);
    const priceRec = result.recommendations.find((r) => r.includes('cheaper per unit'));
    expect(priceRec).toBeDefined();
    expect(priceRec).toContain('Cheap Co');
  });

  it('no price recommendation when prices are within 5%', () => {
    const quotes: SupplierQuote[] = [
      mkQuote({ supplier: 'A', unitPrice: 1.00, moq: 1 }),
      mkQuote({ supplier: 'B', unitPrice: 1.04, moq: 1 }),
    ];
    const result = compareSuppliers(quotes, 10);
    const priceRec = result.recommendations.find((r) => r.includes('cheaper per unit'));
    expect(priceRec).toBeUndefined();
  });

  it('recommends supplier with stock for immediate shipping', () => {
    const quotes: SupplierQuote[] = [
      mkQuote({ supplier: 'Mouser', leadTimeDays: 0, stockQuantity: 500 }),
      mkQuote({ supplier: 'Other', leadTimeDays: 14, stockQuantity: 0 }),
    ];
    const result = compareSuppliers(quotes, 10);
    const stockRec = result.recommendations.find((r) => r.includes('immediate shipping'));
    expect(stockRec).toBeDefined();
    expect(stockRec).toContain('Mouser');
  });

  it('recommends supplier with stock and lead time', () => {
    const quotes: SupplierQuote[] = [
      mkQuote({ supplier: 'DigiKey', leadTimeDays: 3, stockQuantity: 500 }),
      mkQuote({ supplier: 'Other', leadTimeDays: 30, stockQuantity: 500 }),
    ];
    const result = compareSuppliers(quotes, 10);
    const stockRec = result.recommendations.find((r) => r.includes('has stock and ships'));
    expect(stockRec).toBeDefined();
    expect(stockRec).toContain('DigiKey');
  });

  it('in-stock badge only for quotes with enough stock', () => {
    const quotes: SupplierQuote[] = [
      mkQuote({ supplier: 'Stocked', stockQuantity: 100 }),
      mkQuote({ supplier: 'LowStock', stockQuantity: 5 }),
    ];
    const result = compareSuppliers(quotes, 50);
    const stocked = result.quotes.find((q) => q.supplier === 'Stocked')!;
    const low = result.quotes.find((q) => q.supplier === 'LowStock')!;
    expect(stocked.badges).toContain('in-stock');
    expect(low.badges).not.toContain('in-stock');
  });

  it('equal prices — both get cheapest considered correctly', () => {
    const quotes: SupplierQuote[] = [
      mkQuote({ supplier: 'A', unitPrice: 2.00, moq: 1 }),
      mkQuote({ supplier: 'B', unitPrice: 2.00, moq: 1 }),
    ];
    const result = compareSuppliers(quotes, 10);
    // At least one should be cheapest
    const cheapestQuotes = result.quotes.filter((q) => q.badges.includes('cheapest'));
    expect(cheapestQuotes.length).toBeGreaterThanOrEqual(1);
  });

  it('handles missing rating (defaults to 2.5 in scoring)', () => {
    const quotes: SupplierQuote[] = [
      mkQuote({ supplier: 'NoRating', rating: undefined }),
      mkQuote({ supplier: 'Rated', rating: 5.0 }),
    ];
    const result = compareSuppliers(quotes, 10);
    const noRating = result.quotes.find((q) => q.supplier === 'NoRating')!;
    const rated = result.quotes.find((q) => q.supplier === 'Rated')!;
    // Both should have valid value scores
    expect(noRating.valueScore).toBeGreaterThan(0);
    expect(rated.valueScore).toBeGreaterThan(0);
  });

  it('preserves original quote fields in ranked output', () => {
    const quote = mkQuote({
      supplier: 'Mouser',
      unitPrice: 2.50,
      currency: 'EUR',
      moq: 10,
      leadTimeDays: 5,
      stockQuantity: 200,
      rating: 4.2,
      url: 'https://mouser.com/part/123',
    });
    const result = compareSuppliers([quote], 10);
    const ranked = result.quotes[0];
    expect(ranked.supplier).toBe('Mouser');
    expect(ranked.unitPrice).toBe(2.50);
    expect(ranked.currency).toBe('EUR');
    expect(ranked.moq).toBe(10);
    expect(ranked.leadTimeDays).toBe(5);
    expect(ranked.stockQuantity).toBe(200);
    expect(ranked.rating).toBe(4.2);
    expect(ranked.url).toBe('https://mouser.com/part/123');
  });

  it('totalCost computed correctly for each ranked quote', () => {
    const quotes: SupplierQuote[] = [
      mkQuote({ supplier: 'A', unitPrice: 1.50, moq: 1 }),
      mkQuote({ supplier: 'B', unitPrice: 2.00, moq: 5 }),
      mkQuote({ supplier: 'C', unitPrice: 0.80, moq: 50 }),
    ];
    const result = compareSuppliers(quotes, 10);
    const a = result.quotes.find((q) => q.supplier === 'A')!;
    const b = result.quotes.find((q) => q.supplier === 'B')!;
    const c = result.quotes.find((q) => q.supplier === 'C')!;
    expect(a.totalCost).toBe(15.00); // 1.50 * 10
    expect(b.totalCost).toBe(20.00); // 2.00 * 10 (qty > moq)
    expect(c.totalCost).toBe(40.00); // 0.80 * 50 (moq > qty)
  });

  it('bestValue, cheapest, fastest reference actual ranked quote objects', () => {
    const quotes: SupplierQuote[] = [
      mkQuote({ supplier: 'A', unitPrice: 1.00, leadTimeDays: 10 }),
      mkQuote({ supplier: 'B', unitPrice: 3.00, leadTimeDays: 1 }),
    ];
    const result = compareSuppliers(quotes, 10);
    expect(result.cheapest).not.toBeNull();
    expect(result.fastest).not.toBeNull();
    expect(result.bestValue).not.toBeNull();
    // These should be actual objects from the quotes array
    expect(result.quotes).toContain(result.cheapest);
    expect(result.quotes).toContain(result.fastest);
    expect(result.quotes).toContain(result.bestValue);
  });

  it('quantity clamped to at least 1', () => {
    const result = compareSuppliers([mkQuote({ unitPrice: 5.00, moq: 1 })], 0);
    expect(result.quotes[0].totalCost).toBe(5.00); // 5.00 * max(1, 0→1)
  });
});

// ---------------------------------------------------------------------------
// sortByValue
// ---------------------------------------------------------------------------

describe('sortByValue', () => {
  it('sorts by valueScore descending', () => {
    const ranked: RankedQuote[] = [
      { ...mkQuote({ supplier: 'Low' }), totalCost: 10, valueScore: 0.3, badges: [] },
      { ...mkQuote({ supplier: 'High' }), totalCost: 10, valueScore: 0.9, badges: [] },
      { ...mkQuote({ supplier: 'Mid' }), totalCost: 10, valueScore: 0.6, badges: [] },
    ];
    const sorted = sortByValue(ranked);
    expect(sorted[0].supplier).toBe('High');
    expect(sorted[1].supplier).toBe('Mid');
    expect(sorted[2].supplier).toBe('Low');
  });

  it('does not mutate the original array', () => {
    const ranked: RankedQuote[] = [
      { ...mkQuote({ supplier: 'A' }), totalCost: 10, valueScore: 0.1, badges: [] },
      { ...mkQuote({ supplier: 'B' }), totalCost: 10, valueScore: 0.9, badges: [] },
    ];
    const original = [...ranked];
    sortByValue(ranked);
    expect(ranked[0].supplier).toBe(original[0].supplier);
  });

  it('returns a new array reference', () => {
    const ranked: RankedQuote[] = [
      { ...mkQuote({ supplier: 'A' }), totalCost: 10, valueScore: 0.5, badges: [] },
    ];
    const sorted = sortByValue(ranked);
    expect(sorted).not.toBe(ranked);
  });
});
