import { describe, it, expect } from 'vitest';
import {
  extractBomMapping,
  mapCommunityPartToBom,
  shouldPromptBomAdd,
} from '../community-bom-bridge';
import type { CommunityComponent } from '../community-library';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePart(overrides: Partial<CommunityComponent> = {}): CommunityComponent {
  return {
    id: 'comm-001',
    name: 'Generic Resistor',
    description: '10k 0603 resistor',
    type: 'schematic-symbol',
    category: 'Passives',
    tags: ['resistor'],
    author: { id: 'u1', name: 'Author', reputation: 50 },
    version: '1.0.0',
    license: 'MIT',
    downloads: 100,
    rating: 4.5,
    ratingCount: 10,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    size: 512,
    data: {},
    dependencies: [],
    compatibility: ['protopulse'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// extractBomMapping
// ---------------------------------------------------------------------------

describe('extractBomMapping', () => {
  it('extracts mpn from data.mpn', () => {
    const part = makePart({ data: { mpn: 'RC0603FR-0710KL' } });
    const mapping = extractBomMapping(part);
    expect(mapping.mpn).toBe('RC0603FR-0710KL');
  });

  it('falls back to data.partNumber when mpn is absent', () => {
    const part = makePart({ data: { partNumber: 'PN-1234' } });
    const mapping = extractBomMapping(part);
    expect(mapping.mpn).toBe('PN-1234');
  });

  it('prefers mpn over partNumber', () => {
    const part = makePart({ data: { mpn: 'MPN-1', partNumber: 'PN-2' } });
    const mapping = extractBomMapping(part);
    expect(mapping.mpn).toBe('MPN-1');
  });

  it('extracts manufacturer', () => {
    const part = makePart({ data: { manufacturer: 'Yageo' } });
    expect(extractBomMapping(part).manufacturer).toBe('Yageo');
  });

  it('extracts supplier', () => {
    const part = makePart({ data: { supplier: 'DigiKey' } });
    expect(extractBomMapping(part).supplier).toBe('DigiKey');
  });

  it('uses part.category for category field', () => {
    const part = makePart({ category: 'Capacitors' });
    expect(extractBomMapping(part).category).toBe('Capacitors');
  });

  it('extracts packageType from data.packageType', () => {
    const part = makePart({ data: { packageType: '0603' } });
    expect(extractBomMapping(part).packageType).toBe('0603');
  });

  it('falls back to data.package for packageType', () => {
    const part = makePart({ data: { package: 'SOIC-8' } });
    expect(extractBomMapping(part).packageType).toBe('SOIC-8');
  });

  it('returns undefined for missing fields', () => {
    const part = makePart({ data: {} });
    const mapping = extractBomMapping(part);
    expect(mapping.mpn).toBeUndefined();
    expect(mapping.manufacturer).toBeUndefined();
    expect(mapping.supplier).toBeUndefined();
    expect(mapping.packageType).toBeUndefined();
  });

  it('trims whitespace from string fields', () => {
    const part = makePart({ data: { mpn: '  RC0603  ', manufacturer: '  Yageo  ' } });
    const mapping = extractBomMapping(part);
    expect(mapping.mpn).toBe('RC0603');
    expect(mapping.manufacturer).toBe('Yageo');
  });

  it('ignores empty strings', () => {
    const part = makePart({ data: { mpn: '', manufacturer: '   ' } });
    const mapping = extractBomMapping(part);
    expect(mapping.mpn).toBeUndefined();
    expect(mapping.manufacturer).toBeUndefined();
  });

  it('always includes communityPartId', () => {
    const part = makePart({ id: 'my-custom-id' });
    expect(extractBomMapping(part).communityPartId).toBe('my-custom-id');
  });
});

// ---------------------------------------------------------------------------
// mapCommunityPartToBom
// ---------------------------------------------------------------------------

describe('mapCommunityPartToBom', () => {
  it('uses mpn as partNumber when available', () => {
    const part = makePart({ data: { mpn: 'RC0603FR-0710KL' } });
    const bomItem = mapCommunityPartToBom(part);
    expect(bomItem.partNumber).toBe('RC0603FR-0710KL');
  });

  it('falls back to part name when no mpn', () => {
    const part = makePart({ name: 'My Resistor', data: {} });
    const bomItem = mapCommunityPartToBom(part);
    expect(bomItem.partNumber).toBe('My Resistor');
  });

  it('uses manufacturer from data', () => {
    const part = makePart({ data: { manufacturer: 'Texas Instruments' } });
    expect(mapCommunityPartToBom(part).manufacturer).toBe('Texas Instruments');
  });

  it('defaults manufacturer to empty string', () => {
    const part = makePart({ data: {} });
    expect(mapCommunityPartToBom(part).manufacturer).toBe('');
  });

  it('uses description from part', () => {
    const part = makePart({ description: 'High precision resistor' });
    expect(mapCommunityPartToBom(part).description).toBe('High precision resistor');
  });

  it('falls back to name for description when description is empty', () => {
    const part = makePart({ name: 'Some Part', description: '' });
    expect(mapCommunityPartToBom(part).description).toBe('Some Part');
  });

  it('sets quantity to 1', () => {
    expect(mapCommunityPartToBom(makePart()).quantity).toBe(1);
  });

  it('uses unitPrice from data when available', () => {
    const part = makePart({ data: { unitPrice: 0.42 } });
    const bomItem = mapCommunityPartToBom(part);
    expect(bomItem.unitPrice).toBe(0.42);
    expect(bomItem.totalPrice).toBe(0.42);
  });

  it('defaults unitPrice to 0 when absent', () => {
    const bomItem = mapCommunityPartToBom(makePart({ data: {} }));
    expect(bomItem.unitPrice).toBe(0);
    expect(bomItem.totalPrice).toBe(0);
  });

  it('resolves Digi-Key supplier', () => {
    const part = makePart({ data: { supplier: 'Digi-Key' } });
    expect(mapCommunityPartToBom(part).supplier).toBe('Digi-Key');
  });

  it('resolves DigiKey without hyphen', () => {
    const part = makePart({ data: { supplier: 'DigiKey' } });
    expect(mapCommunityPartToBom(part).supplier).toBe('Digi-Key');
  });

  it('resolves Mouser supplier', () => {
    const part = makePart({ data: { supplier: 'Mouser Electronics' } });
    expect(mapCommunityPartToBom(part).supplier).toBe('Mouser');
  });

  it('resolves LCSC supplier', () => {
    const part = makePart({ data: { supplier: 'LCSC' } });
    expect(mapCommunityPartToBom(part).supplier).toBe('LCSC');
  });

  it('defaults to Unknown supplier', () => {
    const part = makePart({ data: { supplier: 'Arrow' } });
    expect(mapCommunityPartToBom(part).supplier).toBe('Unknown');
  });

  it('defaults to Unknown when no supplier', () => {
    expect(mapCommunityPartToBom(makePart({ data: {} })).supplier).toBe('Unknown');
  });

  it('sets assemblyCategory to smt for SMT packages', () => {
    for (const pkg of ['0603', 'SOIC-8', 'QFP-44', 'BGA-256', 'SOT-23']) {
      const part = makePart({ data: { packageType: pkg } });
      expect(mapCommunityPartToBom(part).assemblyCategory).toBe('smt');
    }
  });

  it('sets assemblyCategory to through_hole for THT packages', () => {
    for (const pkg of ['DIP-8', 'TO-92', 'PDIP-14', 'axial', 'radial']) {
      const part = makePart({ data: { packageType: pkg } });
      expect(mapCommunityPartToBom(part).assemblyCategory).toBe('through_hole');
    }
  });

  it('returns undefined assemblyCategory for unknown packages', () => {
    const part = makePart({ data: { packageType: 'custom-connector' } });
    expect(mapCommunityPartToBom(part).assemblyCategory).toBeUndefined();
  });

  it('returns undefined assemblyCategory when no packageType', () => {
    expect(mapCommunityPartToBom(makePart({ data: {} })).assemblyCategory).toBeUndefined();
  });

  it('maps esdSensitive boolean from data', () => {
    const part = makePart({ data: { esdSensitive: true } });
    expect(mapCommunityPartToBom(part).esdSensitive).toBe(true);
  });

  it('leaves esdSensitive undefined when not boolean', () => {
    const part = makePart({ data: { esdSensitive: 'yes' } });
    expect(mapCommunityPartToBom(part).esdSensitive).toBeUndefined();
  });

  it('defaults status to In Stock', () => {
    expect(mapCommunityPartToBom(makePart()).status).toBe('In Stock');
  });

  it('defaults stock to 0', () => {
    expect(mapCommunityPartToBom(makePart()).stock).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// shouldPromptBomAdd
// ---------------------------------------------------------------------------

describe('shouldPromptBomAdd', () => {
  it('returns true when mpn is present', () => {
    const part = makePart({ data: { mpn: 'RC0603FR-0710KL' } });
    expect(shouldPromptBomAdd(part)).toBe(true);
  });

  it('returns true when partNumber is present', () => {
    const part = makePart({ data: { partNumber: 'PN-1234' } });
    expect(shouldPromptBomAdd(part)).toBe(true);
  });

  it('returns true when manufacturer is present', () => {
    const part = makePart({ data: { manufacturer: 'TI' } });
    expect(shouldPromptBomAdd(part)).toBe(true);
  });

  it('returns true when both mpn and manufacturer are present', () => {
    const part = makePart({ data: { mpn: 'LM7805', manufacturer: 'TI' } });
    expect(shouldPromptBomAdd(part)).toBe(true);
  });

  it('returns false when neither mpn nor manufacturer is present', () => {
    const part = makePart({ data: {} });
    expect(shouldPromptBomAdd(part)).toBe(false);
  });

  it('returns false when data has only supplier', () => {
    const part = makePart({ data: { supplier: 'Mouser' } });
    expect(shouldPromptBomAdd(part)).toBe(false);
  });

  it('returns false when mpn is empty string', () => {
    const part = makePart({ data: { mpn: '' } });
    expect(shouldPromptBomAdd(part)).toBe(false);
  });

  it('returns false when manufacturer is whitespace-only', () => {
    const part = makePart({ data: { manufacturer: '   ' } });
    expect(shouldPromptBomAdd(part)).toBe(false);
  });
});
