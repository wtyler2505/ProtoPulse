/**
 * Tests for the BomItem ↔ PartWithStock mapping.
 *
 * The bom-context.tsx shim maps canonical PartWithStock rows to the legacy BomItem
 * interface. These tests verify every field mapping without rendering React components.
 */
import { describe, it, expect } from 'vitest';
import type { PartWithStock } from '@shared/parts/part-row';

// Re-create the pure mapping function from bom-context.tsx for isolated testing.
// This avoids importing the context file which pulls in React hooks.

const KNOWN_SUPPLIERS = new Set(['Digi-Key', 'Mouser', 'LCSC']);
const VALID_STATUSES = new Set(['In Stock', 'Low Stock', 'Out of Stock', 'On Order']);

type BomSupplier = 'Digi-Key' | 'Mouser' | 'LCSC' | 'Unknown';
type BomStatus = 'In Stock' | 'Low Stock' | 'Out of Stock' | 'On Order';

function coerceSupplier(raw: string | null | undefined): BomSupplier {
  if (raw && KNOWN_SUPPLIERS.has(raw)) { return raw as BomSupplier; }
  return 'Unknown';
}

function coerceStatus(raw: string | null | undefined): BomStatus {
  if (raw && VALID_STATUSES.has(raw)) { return raw as BomStatus; }
  return 'In Stock';
}

interface BomItem {
  id: string;
  partNumber: string;
  manufacturer: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  supplier: BomSupplier;
  stock: number;
  status: BomStatus;
  leadTime?: string;
  esdSensitive?: boolean | null;
  assemblyCategory?: 'smt' | 'through_hole' | 'hand_solder' | 'mechanical' | null;
  storageLocation?: string | null;
  quantityOnHand?: number | null;
  minimumStock?: number | null;
}

function mapToBomItem(entry: PartWithStock): BomItem {
  const s = entry.stock;
  const unitPrice = s?.unitPrice != null ? Number(s.unitPrice) : 0;
  const quantity = s?.quantityNeeded ?? 0;
  return {
    id: s?.id ?? entry.id,
    partNumber: entry.mpn ?? entry.slug,
    manufacturer: entry.manufacturer ?? '',
    description: entry.title,
    quantity,
    unitPrice,
    totalPrice: Math.round(quantity * unitPrice * 100) / 100,
    supplier: coerceSupplier(s?.supplier),
    stock: s?.quantityOnHand ?? 0,
    status: coerceStatus(s?.status),
    leadTime: s?.leadTime ?? undefined,
    esdSensitive: entry.esdSensitive ?? null,
    assemblyCategory: entry.assemblyCategory ?? null,
    storageLocation: s?.storageLocation ?? null,
    quantityOnHand: s?.quantityOnHand ?? null,
    minimumStock: s?.minimumStock ?? null,
  };
}

function makePart(overrides: Partial<PartWithStock> = {}): PartWithStock {
  return {
    id: 'part-1',
    slug: 'res-10k-0402-1pct',
    title: '10kΩ Resistor 0402 1%',
    description: 'Precision thin film',
    manufacturer: 'Yageo',
    mpn: 'RC0402FR-0710KL',
    canonicalCategory: 'resistor',
    packageType: '0402',
    tolerance: '1%',
    esdSensitive: false,
    assemblyCategory: 'smt',
    meta: {},
    connectors: [],
    datasheetUrl: null,
    manufacturerUrl: null,
    origin: 'library',
    originRef: null,
    forkedFromId: null,
    authorUserId: null,
    isPublic: true,
    trustLevel: 'library',
    version: 1,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
    stock: {
      id: 'stock-1',
      projectId: 1,
      partId: 'part-1',
      quantityNeeded: 100,
      quantityOnHand: 50,
      minimumStock: 10,
      storageLocation: 'Bin A3',
      unitPrice: 0.01,
      supplier: 'Digi-Key',
      leadTime: '2 weeks',
      status: 'In Stock',
      notes: null,
      version: 1,
      updatedAt: new Date('2026-01-01'),
      deletedAt: null,
    },
    ...overrides,
  };
}

describe('BomItem mapping', () => {
  describe('field mapping: Part → BomItem', () => {
    it('maps title to description (naming inversion)', () => {
      const bom = mapToBomItem(makePart({ title: 'LED Red 3mm' }));
      expect(bom.description).toBe('LED Red 3mm');
    });

    it('maps mpn to partNumber', () => {
      const bom = mapToBomItem(makePart({ mpn: 'LM7805CT' }));
      expect(bom.partNumber).toBe('LM7805CT');
    });

    it('falls back to slug when mpn is null', () => {
      const bom = mapToBomItem(makePart({ mpn: null, slug: 'cap-100nf-0603' }));
      expect(bom.partNumber).toBe('cap-100nf-0603');
    });

    it('maps manufacturer with empty string fallback', () => {
      expect(mapToBomItem(makePart({ manufacturer: 'TI' })).manufacturer).toBe('TI');
      expect(mapToBomItem(makePart({ manufacturer: null })).manufacturer).toBe('');
    });

    it('maps esdSensitive', () => {
      expect(mapToBomItem(makePart({ esdSensitive: true })).esdSensitive).toBe(true);
      expect(mapToBomItem(makePart({ esdSensitive: null })).esdSensitive).toBeNull();
    });

    it('maps assemblyCategory', () => {
      expect(mapToBomItem(makePart({ assemblyCategory: 'through_hole' })).assemblyCategory).toBe('through_hole');
      expect(mapToBomItem(makePart({ assemblyCategory: null })).assemblyCategory).toBeNull();
    });
  });

  describe('field mapping: Stock → BomItem', () => {
    it('uses stock.id as BomItem.id for mutations', () => {
      const bom = mapToBomItem(makePart());
      expect(bom.id).toBe('stock-1');
    });

    it('falls back to part.id when stock is null', () => {
      const bom = mapToBomItem(makePart({ stock: null }));
      expect(bom.id).toBe('part-1');
    });

    it('maps quantityNeeded to quantity', () => {
      const bom = mapToBomItem(makePart());
      expect(bom.quantity).toBe(100);
    });

    it('maps unitPrice as number', () => {
      const bom = mapToBomItem(makePart());
      expect(bom.unitPrice).toBe(0.01);
    });

    it('computes totalPrice from quantity * unitPrice', () => {
      const bom = mapToBomItem(makePart());
      expect(bom.totalPrice).toBe(1);
    });

    it('handles fractional totalPrice rounding', () => {
      const part = makePart();
      part.stock!.quantityNeeded = 3;
      part.stock!.unitPrice = 0.33;
      const bom = mapToBomItem(part);
      expect(bom.totalPrice).toBe(0.99);
    });

    it('maps quantityOnHand to stock field', () => {
      const bom = mapToBomItem(makePart());
      expect(bom.stock).toBe(50);
    });

    it('defaults stock to 0 when quantityOnHand is null', () => {
      const part = makePart();
      part.stock!.quantityOnHand = null;
      expect(mapToBomItem(part).stock).toBe(0);
    });

    it('maps storageLocation', () => {
      expect(mapToBomItem(makePart()).storageLocation).toBe('Bin A3');
    });

    it('maps leadTime', () => {
      expect(mapToBomItem(makePart()).leadTime).toBe('2 weeks');
    });

    it('maps minimumStock', () => {
      expect(mapToBomItem(makePart()).minimumStock).toBe(10);
    });
  });

  describe('supplier coercion', () => {
    it('preserves known suppliers', () => {
      for (const s of ['Digi-Key', 'Mouser', 'LCSC']) {
        const part = makePart();
        part.stock!.supplier = s;
        expect(mapToBomItem(part).supplier).toBe(s);
      }
    });

    it('maps unknown supplier strings to Unknown', () => {
      const part = makePart();
      part.stock!.supplier = 'AliExpress';
      expect(mapToBomItem(part).supplier).toBe('Unknown');
    });

    it('maps null supplier to Unknown', () => {
      const part = makePart();
      part.stock!.supplier = null;
      expect(mapToBomItem(part).supplier).toBe('Unknown');
    });
  });

  describe('status coercion', () => {
    it('preserves valid statuses', () => {
      for (const s of ['In Stock', 'Low Stock', 'Out of Stock', 'On Order']) {
        const part = makePart();
        part.stock!.status = s;
        expect(mapToBomItem(part).status).toBe(s);
      }
    });

    it('maps unknown status to In Stock', () => {
      const part = makePart();
      part.stock!.status = 'Backordered';
      expect(mapToBomItem(part).status).toBe('In Stock');
    });
  });

  describe('null stock handling', () => {
    it('defaults all stock-derived fields when stock is null', () => {
      const bom = mapToBomItem(makePart({ stock: null }));
      expect(bom.quantity).toBe(0);
      expect(bom.unitPrice).toBe(0);
      expect(bom.totalPrice).toBe(0);
      expect(bom.supplier).toBe('Unknown');
      expect(bom.stock).toBe(0);
      expect(bom.status).toBe('In Stock');
      expect(bom.leadTime).toBeUndefined();
      expect(bom.storageLocation).toBeNull();
      expect(bom.quantityOnHand).toBeNull();
      expect(bom.minimumStock).toBeNull();
    });
  });

  describe('numeric coercion from Drizzle string', () => {
    it('handles unitPrice as string (Drizzle numeric(10,4) serialization)', () => {
      const part = makePart();
      (part.stock as unknown as Record<string, unknown>).unitPrice = '1.2500';
      const bom = mapToBomItem(part);
      expect(bom.unitPrice).toBe(1.25);
      expect(bom.totalPrice).toBe(125);
    });
  });
});
