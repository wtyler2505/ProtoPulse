/**
 * Tests for the unified parts catalog Drizzle schema + Zod insert schemas.
 *
 * Validates:
 *   - Zod round-trip for every insert schema (6 tables)
 *   - Enum enforcement on trust_level, origin, assembly_category, surface, container_type
 *   - Default values applied correctly
 *   - Required fields rejected when missing
 */

import { describe, it, expect } from 'vitest';
import {
  insertPartSchema,
  insertPartStockSchema,
  insertPartPlacementSchema,
  insertPartLifecycleSchema,
  insertPartSpiceModelSchema,
  insertPartAlternateSchema,
  TRUST_LEVELS,
  PART_ORIGINS,
  ASSEMBLY_CATEGORIES,
  PLACEMENT_SURFACES,
  PLACEMENT_CONTAINER_TYPES,
  trustRank,
} from '../schema';

// ---------------------------------------------------------------------------
// insertPartSchema
// ---------------------------------------------------------------------------

describe('insertPartSchema', () => {
  it('accepts a minimal valid part', () => {
    const result = insertPartSchema.safeParse({
      slug: 'res-10k-0402-1pct',
      title: '10kΩ Resistor 0402 1%',
      canonicalCategory: 'resistor',
      origin: 'library',
    });
    expect(result.success).toBe(true);
  });

  it('applies default trust_level of "user"', () => {
    const result = insertPartSchema.safeParse({
      slug: 'test',
      title: 'Test',
      canonicalCategory: 'resistor',
      origin: 'library',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.trustLevel).toBe('user');
    }
  });

  it('applies default empty object for meta', () => {
    const result = insertPartSchema.safeParse({
      slug: 'test',
      title: 'Test',
      canonicalCategory: 'resistor',
      origin: 'library',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.meta).toEqual({});
    }
  });

  it('applies default empty array for connectors', () => {
    const result = insertPartSchema.safeParse({
      slug: 'test',
      title: 'Test',
      canonicalCategory: 'resistor',
      origin: 'library',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.connectors).toEqual([]);
    }
  });

  it('rejects missing slug', () => {
    const result = insertPartSchema.safeParse({
      title: 'Test',
      canonicalCategory: 'resistor',
      origin: 'library',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing title', () => {
    const result = insertPartSchema.safeParse({
      slug: 'test',
      canonicalCategory: 'resistor',
      origin: 'library',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty title', () => {
    const result = insertPartSchema.safeParse({
      slug: 'test',
      title: '',
      canonicalCategory: 'resistor',
      origin: 'library',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid origin', () => {
    const result = insertPartSchema.safeParse({
      slug: 'test',
      title: 'Test',
      canonicalCategory: 'resistor',
      origin: 'bogus' as unknown,
    });
    expect(result.success).toBe(false);
  });

  it('accepts all six trust levels', () => {
    for (const level of TRUST_LEVELS) {
      const result = insertPartSchema.safeParse({
        slug: `test-${level}`,
        title: 'Test',
        canonicalCategory: 'resistor',
        origin: 'library',
        trustLevel: level,
      });
      expect(result.success).toBe(true);
    }
  });

  it('accepts all documented origins', () => {
    for (const origin of PART_ORIGINS) {
      const result = insertPartSchema.safeParse({
        slug: `test-${origin}`,
        title: 'Test',
        canonicalCategory: 'resistor',
        origin,
      });
      expect(result.success).toBe(true);
    }
  });

  it('accepts all documented assembly categories', () => {
    for (const cat of ASSEMBLY_CATEGORIES) {
      const result = insertPartSchema.safeParse({
        slug: `test-${cat}`,
        title: 'Test',
        canonicalCategory: 'resistor',
        origin: 'library',
        assemblyCategory: cat,
      });
      expect(result.success).toBe(true);
    }
  });

  it('accepts null assemblyCategory', () => {
    const result = insertPartSchema.safeParse({
      slug: 'test',
      title: 'Test',
      canonicalCategory: 'resistor',
      origin: 'library',
      assemblyCategory: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts arbitrary meta JSONB content', () => {
    const result = insertPartSchema.safeParse({
      slug: 'test',
      title: 'Test',
      canonicalCategory: 'resistor',
      origin: 'library',
      meta: { pinout: { vcc: 1, gnd: 2 }, rating: '1/4W', tags: ['smd', 'passive'] },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.meta).toHaveProperty('pinout');
    }
  });
});

// ---------------------------------------------------------------------------
// insertPartStockSchema
// ---------------------------------------------------------------------------

describe('insertPartStockSchema', () => {
  const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

  it('accepts a minimal valid stock row', () => {
    const result = insertPartStockSchema.safeParse({
      projectId: 1,
      partId: VALID_UUID,
    });
    expect(result.success).toBe(true);
  });

  it('applies default quantityNeeded of 0', () => {
    const result = insertPartStockSchema.safeParse({
      projectId: 1,
      partId: VALID_UUID,
    });
    if (result.success) {
      expect(result.data.quantityNeeded).toBe(0);
    }
  });

  it('applies default status of "In Stock"', () => {
    const result = insertPartStockSchema.safeParse({
      projectId: 1,
      partId: VALID_UUID,
    });
    if (result.success) {
      expect(result.data.status).toBe('In Stock');
    }
  });

  it('rejects negative quantityNeeded', () => {
    const result = insertPartStockSchema.safeParse({
      projectId: 1,
      partId: VALID_UUID,
      quantityNeeded: -5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative unitPrice', () => {
    const result = insertPartStockSchema.safeParse({
      projectId: 1,
      partId: VALID_UUID,
      unitPrice: '-0.50',
    });
    expect(result.success).toBe(false);
  });

  it('accepts numeric unitPrice as string', () => {
    const result = insertPartStockSchema.safeParse({
      projectId: 1,
      partId: VALID_UUID,
      unitPrice: '0.0023',
    });
    expect(result.success).toBe(true);
  });

  it('accepts numeric unitPrice as number', () => {
    const result = insertPartStockSchema.safeParse({
      projectId: 1,
      partId: VALID_UUID,
      unitPrice: 0.0023,
    });
    expect(result.success).toBe(true);
  });

  it('accepts null unitPrice', () => {
    const result = insertPartStockSchema.safeParse({
      projectId: 1,
      partId: VALID_UUID,
      unitPrice: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts all four documented status values', () => {
    for (const status of ['In Stock', 'Low Stock', 'Out of Stock', 'On Order']) {
      const result = insertPartStockSchema.safeParse({
        projectId: 1,
        partId: VALID_UUID,
        status,
      });
      expect(result.success).toBe(true);
    }
  });

  it('accepts missing projectId (personal inventory rows have null projectId)', () => {
    const result = insertPartStockSchema.safeParse({ partId: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it('rejects missing partId', () => {
    const result = insertPartStockSchema.safeParse({ projectId: 1 });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// insertPartPlacementSchema
// ---------------------------------------------------------------------------

describe('insertPartPlacementSchema', () => {
  const VALID_UUID = '550e8400-e29b-41d4-a716-446655440001';

  it('accepts a minimal valid placement', () => {
    const result = insertPartPlacementSchema.safeParse({
      partId: VALID_UUID,
      surface: 'schematic',
      containerType: 'circuit',
      containerId: 1,
      referenceDesignator: 'R1',
    });
    expect(result.success).toBe(true);
  });

  it('accepts all documented surfaces', () => {
    for (const surface of PLACEMENT_SURFACES) {
      const result = insertPartPlacementSchema.safeParse({
        partId: VALID_UUID,
        surface,
        containerType: 'circuit',
        containerId: 1,
        referenceDesignator: 'R1',
      });
      expect(result.success).toBe(true);
    }
  });

  it('accepts all documented container types', () => {
    for (const ct of PLACEMENT_CONTAINER_TYPES) {
      const result = insertPartPlacementSchema.safeParse({
        partId: VALID_UUID,
        surface: 'schematic',
        containerType: ct,
        containerId: 1,
        referenceDesignator: 'R1',
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid surface', () => {
    const result = insertPartPlacementSchema.safeParse({
      partId: VALID_UUID,
      surface: 'bogus' as unknown,
      containerType: 'circuit',
      containerId: 1,
      referenceDesignator: 'R1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty reference designator', () => {
    const result = insertPartPlacementSchema.safeParse({
      partId: VALID_UUID,
      surface: 'schematic',
      containerType: 'circuit',
      containerId: 1,
      referenceDesignator: '',
    });
    expect(result.success).toBe(false);
  });

  it('applies default empty properties object', () => {
    const result = insertPartPlacementSchema.safeParse({
      partId: VALID_UUID,
      surface: 'schematic',
      containerType: 'circuit',
      containerId: 1,
      referenceDesignator: 'R1',
    });
    if (result.success) {
      expect(result.data.properties).toEqual({});
    }
  });

  it('accepts optional xy coordinates', () => {
    const result = insertPartPlacementSchema.safeParse({
      partId: VALID_UUID,
      surface: 'pcb',
      containerType: 'circuit',
      containerId: 1,
      referenceDesignator: 'U1',
      x: 10.5,
      y: 25.3,
      rotation: 90,
      layer: 'front',
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// insertPartLifecycleSchema
// ---------------------------------------------------------------------------

describe('insertPartLifecycleSchema', () => {
  const VALID_UUID_1 = '550e8400-e29b-41d4-a716-446655440002';
  const VALID_UUID_2 = '550e8400-e29b-41d4-a716-446655440003';

  it('accepts a minimal lifecycle row with just partId', () => {
    const result = insertPartLifecycleSchema.safeParse({
      partId: VALID_UUID_1,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a full lifecycle row', () => {
    const result = insertPartLifecycleSchema.safeParse({
      partId: VALID_UUID_1,
      obsoleteDate: new Date('2027-01-01'),
      replacementPartId: VALID_UUID_2,
      notes: 'Replaced by newer revision',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing partId', () => {
    const result = insertPartLifecycleSchema.safeParse({ notes: 'test' });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// insertPartSpiceModelSchema
// ---------------------------------------------------------------------------

describe('insertPartSpiceModelSchema', () => {
  const VALID_UUID = '550e8400-e29b-41d4-a716-446655440004';

  it('accepts a minimal valid SPICE model row', () => {
    const result = insertPartSpiceModelSchema.safeParse({
      partId: VALID_UUID,
      filename: '1n4148.mod',
      modelText: '.MODEL D1N4148 D(IS=2.52n ...)',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty filename', () => {
    const result = insertPartSpiceModelSchema.safeParse({
      partId: VALID_UUID,
      filename: '',
      modelText: '.MODEL',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty model text', () => {
    const result = insertPartSpiceModelSchema.safeParse({
      partId: VALID_UUID,
      filename: 'test.mod',
      modelText: '',
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional category', () => {
    const result = insertPartSpiceModelSchema.safeParse({
      partId: VALID_UUID,
      filename: '2n2222.mod',
      modelText: '.MODEL Q2N2222 NPN(...)',
      category: 'bjt',
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// insertPartAlternateSchema
// ---------------------------------------------------------------------------

describe('insertPartAlternateSchema', () => {
  const VALID_UUID_1 = '550e8400-e29b-41d4-a716-446655440005';
  const VALID_UUID_2 = '550e8400-e29b-41d4-a716-446655440006';

  it('accepts a minimal valid alternate pairing', () => {
    const result = insertPartAlternateSchema.safeParse({
      partId: VALID_UUID_1,
      altPartId: VALID_UUID_2,
      matchScore: 0.95,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a matchScore of exactly 1.0', () => {
    const result = insertPartAlternateSchema.safeParse({
      partId: VALID_UUID_1,
      altPartId: VALID_UUID_2,
      matchScore: 1.0,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a matchScore of exactly 0', () => {
    const result = insertPartAlternateSchema.safeParse({
      partId: VALID_UUID_1,
      altPartId: VALID_UUID_2,
      matchScore: 0,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a matchScore greater than 1', () => {
    const result = insertPartAlternateSchema.safeParse({
      partId: VALID_UUID_1,
      altPartId: VALID_UUID_2,
      matchScore: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a negative matchScore', () => {
    const result = insertPartAlternateSchema.safeParse({
      partId: VALID_UUID_1,
      altPartId: VALID_UUID_2,
      matchScore: -0.1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing matchScore', () => {
    const result = insertPartAlternateSchema.safeParse({
      partId: VALID_UUID_1,
      altPartId: VALID_UUID_2,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Trust rank ordering
// ---------------------------------------------------------------------------

describe('trustRank', () => {
  it('ranks manufacturer_verified as the most trusted (rank 0)', () => {
    expect(trustRank('manufacturer_verified')).toBe(0);
  });

  it('ranks user as the least trusted', () => {
    expect(trustRank('user')).toBe(TRUST_LEVELS.length - 1);
  });

  it('enforces the documented ordering manufacturer_verified > protopulse_gold > verified > library > community > user', () => {
    expect(trustRank('manufacturer_verified')).toBeLessThan(trustRank('protopulse_gold'));
    expect(trustRank('protopulse_gold')).toBeLessThan(trustRank('verified'));
    expect(trustRank('verified')).toBeLessThan(trustRank('library'));
    expect(trustRank('library')).toBeLessThan(trustRank('community'));
    expect(trustRank('community')).toBeLessThan(trustRank('user'));
  });

  it('returns a distinct rank for every trust level', () => {
    const ranks = new Set(TRUST_LEVELS.map((l) => trustRank(l)));
    expect(ranks.size).toBe(TRUST_LEVELS.length);
  });
});
