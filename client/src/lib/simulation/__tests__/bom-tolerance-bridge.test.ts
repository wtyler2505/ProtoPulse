import { describe, expect, it } from 'vitest';
import type { BomItem } from '@shared/schema';
import type { ToleranceSpec } from '../monte-carlo';
import {
  parseTolerance,
  bomItemsToToleranceSpecs,
  DEFAULT_TOLERANCE_BY_KEYWORD,
} from '../bom-tolerance-bridge';

// ---------------------------------------------------------------------------
// Helper: create a minimal BomItem for testing
// ---------------------------------------------------------------------------
function makeBomItem(overrides: Partial<BomItem>): BomItem {
  return {
    id: 1,
    projectId: 1,
    partNumber: 'R1',
    manufacturer: 'Generic',
    description: 'Resistor 10k',
    quantity: 1,
    unitPrice: '0.01',
    totalPrice: '0.01',
    supplier: 'Mouser',
    stock: 100,
    status: 'In Stock',
    leadTime: null,
    datasheetUrl: null,
    manufacturerUrl: null,
    storageLocation: null,
    quantityOnHand: null,
    minimumStock: null,
    esdSensitive: null,
    assemblyCategory: null,
    tolerance: null,
    version: 1,
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as BomItem;
}

// ---------------------------------------------------------------------------
// parseTolerance
// ---------------------------------------------------------------------------
describe('parseTolerance', () => {
  it('parses "5%" to 0.05', () => {
    expect(parseTolerance('5%')).toBeCloseTo(0.05);
  });

  it('parses "±1%" to 0.01', () => {
    expect(parseTolerance('±1%')).toBeCloseTo(0.01);
  });

  it('parses "0.5%" to 0.005', () => {
    expect(parseTolerance('0.5%')).toBeCloseTo(0.005);
  });

  it('parses "10%" to 0.1', () => {
    expect(parseTolerance('10%')).toBeCloseTo(0.1);
  });

  it('parses plain fraction "0.01" to 0.01', () => {
    expect(parseTolerance('0.01')).toBeCloseTo(0.01);
  });

  it('parses "0.05" as fraction (not percent)', () => {
    expect(parseTolerance('0.05')).toBeCloseTo(0.05);
  });

  it('returns default 0.05 for null', () => {
    expect(parseTolerance(null)).toBeCloseTo(0.05);
  });

  it('returns default 0.05 for empty string', () => {
    expect(parseTolerance('')).toBeCloseTo(0.05);
  });

  it('returns default 0.05 for non-numeric string', () => {
    expect(parseTolerance('N/A')).toBeCloseTo(0.05);
  });

  it('parses "+/-2%" to 0.02', () => {
    expect(parseTolerance('+/-2%')).toBeCloseTo(0.02);
  });

  it('parses "20 %" with space to 0.2', () => {
    expect(parseTolerance('20 %')).toBeCloseTo(0.2);
  });

  it('handles leading/trailing whitespace', () => {
    expect(parseTolerance('  5%  ')).toBeCloseTo(0.05);
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_TOLERANCE_BY_KEYWORD
// ---------------------------------------------------------------------------
describe('DEFAULT_TOLERANCE_BY_KEYWORD', () => {
  it('contains resistor → 0.05', () => {
    expect(DEFAULT_TOLERANCE_BY_KEYWORD.get('resistor')).toBe(0.05);
  });

  it('contains capacitor → 0.10', () => {
    expect(DEFAULT_TOLERANCE_BY_KEYWORD.get('capacitor')).toBe(0.10);
  });

  it('contains inductor → 0.10', () => {
    expect(DEFAULT_TOLERANCE_BY_KEYWORD.get('inductor')).toBe(0.10);
  });

  it('contains crystal → 0.005', () => {
    expect(DEFAULT_TOLERANCE_BY_KEYWORD.get('crystal')).toBe(0.005);
  });

  it('contains voltage regulator → 0.02', () => {
    expect(DEFAULT_TOLERANCE_BY_KEYWORD.get('voltage regulator')).toBe(0.02);
  });
});

// ---------------------------------------------------------------------------
// bomItemsToToleranceSpecs
// ---------------------------------------------------------------------------
describe('bomItemsToToleranceSpecs', () => {
  it('returns empty map for empty array', () => {
    const result = bomItemsToToleranceSpecs([]);
    expect(result.size).toBe(0);
  });

  it('uses explicit tolerance when present', () => {
    const items = [makeBomItem({ partNumber: 'R1', tolerance: '1%', description: 'Resistor 10k' })];
    const result = bomItemsToToleranceSpecs(items);
    expect(result.has('R1')).toBe(true);
    const spec = result.get('R1')!;
    expect(spec.tolerance).toBeCloseTo(0.01);
    expect(spec.distribution).toBe('gaussian');
    expect(spec.nominal).toBe(1);
  });

  it('falls back to keyword-based tolerance when no explicit tolerance', () => {
    const items = [makeBomItem({ partNumber: 'C1', tolerance: null, description: 'Ceramic Capacitor 100nF' })];
    const result = bomItemsToToleranceSpecs(items);
    expect(result.has('C1')).toBe(true);
    expect(result.get('C1')!.tolerance).toBeCloseTo(0.10);
  });

  it('falls back to default 0.05 for unknown component type', () => {
    const items = [makeBomItem({ partNumber: 'X1', tolerance: null, description: 'Custom Widget' })];
    const result = bomItemsToToleranceSpecs(items);
    expect(result.has('X1')).toBe(true);
    expect(result.get('X1')!.tolerance).toBeCloseTo(0.05);
  });

  it('maps multiple BOM items', () => {
    const items = [
      makeBomItem({ partNumber: 'R1', tolerance: '5%', description: 'Resistor' }),
      makeBomItem({ partNumber: 'C1', tolerance: '10%', description: 'Capacitor' }),
      makeBomItem({ partNumber: 'L1', tolerance: null, description: 'Inductor 100uH' }),
    ];
    const result = bomItemsToToleranceSpecs(items);
    expect(result.size).toBe(3);
    expect(result.get('R1')!.tolerance).toBeCloseTo(0.05);
    expect(result.get('C1')!.tolerance).toBeCloseTo(0.10);
    expect(result.get('L1')!.tolerance).toBeCloseTo(0.10); // keyword default
  });

  it('uses partNumber as the key', () => {
    const items = [makeBomItem({ partNumber: 'MFR-25FBF52-10K', tolerance: '1%', description: 'Resistor' })];
    const result = bomItemsToToleranceSpecs(items);
    expect(result.has('MFR-25FBF52-10K')).toBe(true);
  });

  it('sets nominal to 1 (normalized) for all specs', () => {
    const items = [makeBomItem({ partNumber: 'R1', tolerance: '5%', description: 'Resistor' })];
    const result = bomItemsToToleranceSpecs(items);
    expect(result.get('R1')!.nominal).toBe(1);
  });

  it('sets distribution to gaussian for all specs', () => {
    const items = [makeBomItem({ partNumber: 'R1', tolerance: '5%', description: 'Resistor' })];
    const result = bomItemsToToleranceSpecs(items);
    expect(result.get('R1')!.distribution).toBe('gaussian');
  });

  it('handles case-insensitive keyword matching in description', () => {
    const items = [makeBomItem({ partNumber: 'C1', tolerance: null, description: 'CERAMIC CAPACITOR 100nF' })];
    const result = bomItemsToToleranceSpecs(items);
    expect(result.get('C1')!.tolerance).toBeCloseTo(0.10);
  });
});
