import { describe, it, expect } from 'vitest';
import {
  exportBomJlcpcb,
  exportBomMouser,
  exportBomDigikey,
  exportBomGeneric,
  exportBom,
  type BomExportFormat,
  type BomExportOptions,
} from '../export/bom-exporter';
import type { BomItem } from '@shared/types/bom-compat';

// =============================================================================
// Fixtures
// =============================================================================

function makeBomItem(overrides: Partial<BomItem> = {}): BomItem {
  return {
    id: 1,
    projectId: 1,
    partNumber: 'RC0402FR-0710KL',
    manufacturer: 'Yageo',
    description: 'Resistor 10k 0402 1%',
    quantity: 10,
    unitPrice: '0.0100',
    totalPrice: '0.1000',
    supplier: 'Digi-Key',
    stock: 50000,
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
  };
}

function makeLcscItem(overrides: Partial<BomItem> = {}): BomItem {
  return makeBomItem({
    partNumber: 'C25804',
    manufacturer: 'Yageo',
    description: 'Capacitor 100nF 0402',
    quantity: 20,
    unitPrice: '0.0050',
    totalPrice: '0.1000',
    supplier: 'LCSC',
    ...overrides,
  });
}

function makeCommaItem(): BomItem {
  return makeBomItem({
    id: 2,
    partNumber: 'PART,WITH,COMMAS',
    manufacturer: 'Mfr, Inc.',
    description: 'A "quoted" description, with commas',
    quantity: 1,
    unitPrice: '1.0000',
    totalPrice: '1.0000',
  });
}

// =============================================================================
// exportBomJlcpcb
// =============================================================================

describe('exportBomJlcpcb', () => {
  it('header row has 4 columns', () => {
    const result = exportBomJlcpcb([makeBomItem()]);
    const header = result.split('\n')[0];
    expect(header).toBe('Comment,Designator,Footprint,LCSC Part #');
  });

  it('data row has 4 columns', () => {
    const result = exportBomJlcpcb([makeBomItem()]);
    const dataLine = result.split('\n')[1];
    let inQuote = false;
    let commas = 0;
    for (const ch of dataLine) {
      if (ch === '"') inQuote = !inQuote;
      else if (ch === ',' && !inQuote) commas++;
    }
    expect(commas).toBe(3);
  });

  it('LCSC supplier populates LCSC Part # column', () => {
    const result = exportBomJlcpcb([makeLcscItem()]);
    const dataLine = result.split('\n')[1];
    expect(dataLine).toContain('C25804');
  });

  it('non-LCSC supplier leaves LCSC Part # column empty', () => {
    const result = exportBomJlcpcb([makeBomItem()]);
    const dataLine = result.split('\n')[1];
    // Last column should be empty (ends with trailing comma or just empty)
    expect(dataLine.endsWith(',')).toBe(true);
  });

  it('footprint extracted from description when known size present', () => {
    const result = exportBomJlcpcb([makeBomItem()]);
    const dataLine = result.split('\n')[1];
    // "Resistor 10k 0402 1%" → footprint = "0402"
    expect(dataLine).toContain('0402');
  });

  it('empty items array produces only header', () => {
    const result = exportBomJlcpcb([]);
    const lines = result.split('\n').filter((l) => l.trim() !== '');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('Comment');
  });
});

// =============================================================================
// exportBomMouser
// =============================================================================

describe('exportBomMouser', () => {
  it('header row has 5 columns', () => {
    const result = exportBomMouser([makeBomItem()]);
    const header = result.split('\n')[0];
    expect(header).toBe('Manufacturer Part Number,Manufacturer,Quantity,Description,Unit Price');
  });

  it('data row has 5 columns', () => {
    const result = exportBomMouser([makeBomItem()]);
    const dataLine = result.split('\n')[1];
    let inQuote = false;
    let commas = 0;
    for (const ch of dataLine) {
      if (ch === '"') inQuote = !inQuote;
      else if (ch === ',' && !inQuote) commas++;
    }
    expect(commas).toBe(4);
  });

  it('manufacturer name appears in row', () => {
    const result = exportBomMouser([makeBomItem()]);
    expect(result).toContain('Yageo');
  });

  it('quantity is correct string value', () => {
    const result = exportBomMouser([makeBomItem({ quantity: 42 })]);
    expect(result).toContain('42');
  });

  it('empty items array produces only header', () => {
    const result = exportBomMouser([]);
    const lines = result.split('\n').filter((l) => l.trim() !== '');
    expect(lines).toHaveLength(1);
  });
});

// =============================================================================
// exportBomDigikey
// =============================================================================

describe('exportBomDigikey', () => {
  it('header row has 7 columns', () => {
    const result = exportBomDigikey([makeBomItem()]);
    const header = result.split('\n')[0];
    expect(header).toBe(
      'Digi-Key Part Number,Manufacturer Part Number,Manufacturer,Quantity,Description,Unit Price,Extended Price',
    );
  });

  it('data row has 7 columns', () => {
    const result = exportBomDigikey([makeBomItem()]);
    const dataLine = result.split('\n')[1];
    let inQuote = false;
    let commas = 0;
    for (const ch of dataLine) {
      if (ch === '"') inQuote = !inQuote;
      else if (ch === ',' && !inQuote) commas++;
    }
    expect(commas).toBe(6);
  });

  it('totalPrice appears as Extended Price', () => {
    const item = makeBomItem({ totalPrice: '1.2340' });
    const result = exportBomDigikey([item]);
    expect(result).toContain('1.2340');
  });

  it('part number appears in both Digi-Key Part Number and Manufacturer Part Number columns', () => {
    const result = exportBomDigikey([makeBomItem()]);
    const dataLine = result.split('\n')[1];
    // partNumber is first and second column
    const fields = dataLine.split(',');
    expect(fields[0]).toBe('RC0402FR-0710KL');
    expect(fields[1]).toBe('RC0402FR-0710KL');
  });

  it('empty items array produces only header', () => {
    const result = exportBomDigikey([]);
    const lines = result.split('\n').filter((l) => l.trim() !== '');
    expect(lines).toHaveLength(1);
  });
});

// =============================================================================
// exportBomGeneric
// =============================================================================

describe('exportBomGeneric', () => {
  it('header row has 10 columns', () => {
    const result = exportBomGeneric([makeBomItem()]);
    const header = result.split('\n')[0];
    expect(header).toBe(
      'Part Number,Manufacturer,Description,Quantity,Unit Price,Total Price,Supplier,Stock,Status,Lead Time',
    );
  });

  it('data row has 10 columns', () => {
    const result = exportBomGeneric([makeBomItem()]);
    const dataLine = result.split('\n')[1];
    let inQuote = false;
    let commas = 0;
    for (const ch of dataLine) {
      if (ch === '"') inQuote = !inQuote;
      else if (ch === ',' && !inQuote) commas++;
    }
    expect(commas).toBe(9);
  });

  it('all key fields appear in output', () => {
    const result = exportBomGeneric([makeBomItem()]);
    expect(result).toContain('RC0402FR-0710KL');
    expect(result).toContain('Yageo');
    expect(result).toContain('Digi-Key');
    expect(result).toContain('In Stock');
  });

  it('null leadTime produces empty string in Lead Time column', () => {
    const result = exportBomGeneric([makeBomItem({ leadTime: null })]);
    // Last column is lead time — row should end with trailing comma (empty field)
    const dataLine = result.split('\n')[1];
    expect(dataLine.endsWith(',')).toBe(true);
  });

  it('empty items array produces only header', () => {
    const result = exportBomGeneric([]);
    const lines = result.split('\n').filter((l) => l.trim() !== '');
    expect(lines).toHaveLength(1);
  });
});

// =============================================================================
// exportBom — unified entry point
// =============================================================================

describe('exportBom — groupByPartNumber', () => {
  it('two rows with same partNumber merge into one row with summed quantities', () => {
    const items = [
      makeBomItem({ id: 1, quantity: 5, unitPrice: '1.0000', totalPrice: '5.0000' }),
      makeBomItem({ id: 2, quantity: 3, unitPrice: '1.0000', totalPrice: '3.0000' }),
    ];
    const result = exportBom(items, { format: 'generic', groupByPartNumber: true });
    const lines = result.split('\n').filter((l) => !l.startsWith('#'));
    // Header + 1 merged row
    expect(lines.length).toBe(2);
    expect(lines[1]).toContain('8'); // summed quantity
  });

  it('merged row totalPrice is recalculated as quantity * unitPrice', () => {
    const items = [
      makeBomItem({ id: 1, quantity: 5, unitPrice: '2.0000', totalPrice: '10.0000' }),
      makeBomItem({ id: 2, quantity: 3, unitPrice: '2.0000', totalPrice: '6.0000' }),
    ];
    const result = exportBom(items, { format: 'generic', groupByPartNumber: true });
    const lines = result.split('\n').filter((l) => !l.startsWith('#'));
    const dataLine = lines[1];
    // quantity=8, unitPrice=2 → totalPrice=16.0000
    expect(dataLine).toContain('16.0000');
  });

  it('rows with different partNumbers are not merged', () => {
    const items = [
      makeBomItem({ id: 1, partNumber: 'PART-A' }),
      makeBomItem({ id: 2, partNumber: 'PART-B' }),
    ];
    const result = exportBom(items, { format: 'generic', groupByPartNumber: true });
    const lines = result.split('\n').filter((l) => !l.startsWith('#'));
    // Header + 2 data rows
    expect(lines.length).toBe(3);
  });
});

describe('exportBom — includeHeader', () => {
  it('includeHeader: true includes the header row', () => {
    const result = exportBom([makeBomItem()], { format: 'generic', includeHeader: true });
    const lines = result.split('\n').filter((l) => !l.startsWith('#'));
    expect(lines[0]).toContain('Part Number');
  });

  it('includeHeader: false omits the header row', () => {
    const result = exportBom([makeBomItem()], { format: 'generic', includeHeader: false });
    const lines = result.split('\n').filter((l) => !l.startsWith('#'));
    // First non-comment line should be data, not a header
    expect(lines[0]).not.toContain('Part Number');
    expect(lines[0]).toContain('RC0402FR-0710KL');
  });

  it('summary comment line is always present regardless of includeHeader', () => {
    const result = exportBom([makeBomItem()], { format: 'generic', includeHeader: false });
    expect(result.split('\n')[0]).toContain('# Generated by ProtoPulse');
  });
});

describe('exportBom — CSV field escaping', () => {
  it('field containing comma is wrapped in double quotes', () => {
    const result = exportBomGeneric([makeCommaItem()]);
    expect(result).toContain('"PART,WITH,COMMAS"');
  });

  it('field containing double quote uses doubled-quote escaping', () => {
    const result = exportBomGeneric([makeCommaItem()]);
    // description = 'A "quoted" description, with commas' → "A ""quoted"" description, with commas"
    expect(result).toContain('""quoted""');
  });
});

describe('exportBom — empty items array', () => {
  it('jlcpcb empty output contains summary comment and header', () => {
    const result = exportBom([], { format: 'jlcpcb' });
    expect(result).toContain('# Generated by ProtoPulse');
    expect(result).toContain('Comment,Designator,Footprint,LCSC Part #');
  });

  it('generic empty output has 0 line items in summary', () => {
    const result = exportBom([], { format: 'generic' });
    expect(result).toContain('0 line items');
  });
});
