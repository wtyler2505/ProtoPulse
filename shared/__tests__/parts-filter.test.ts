/**
 * Tests for `shared/parts/part-filter.ts` — filter composition + defaults.
 */

import { describe, it, expect } from 'vitest';
import {
  composeFilter,
  DEFAULT_PART_PAGINATION,
  PART_SORT_FIELDS,
  type PartFilter,
} from '../parts/part-filter';

describe('composeFilter', () => {
  it('returns override values when base is empty', () => {
    const result = composeFilter({}, { category: 'resistor' });
    expect(result.category).toBe('resistor');
  });

  it('returns base values when override is empty', () => {
    const result = composeFilter({ category: 'resistor' }, {});
    expect(result.category).toBe('resistor');
  });

  it('override wins for scalar fields', () => {
    const result = composeFilter(
      { category: 'resistor', minTrustLevel: 'user' },
      { category: 'capacitor' },
    );
    expect(result.category).toBe('capacitor');
    expect(result.minTrustLevel).toBe('user');
  });

  it('preserves all fields from base when override does not specify them', () => {
    const base: PartFilter = {
      text: 'ESP32',
      category: 'mcu',
      minTrustLevel: 'verified',
      origin: 'library',
      projectId: 10,
      isPublic: true,
      hasMpn: true,
      tags: ['microcontroller'],
    };
    const result = composeFilter(base, {});
    expect(result).toEqual(base);
  });

  it('intersects tags when both base and override specify them', () => {
    const result = composeFilter(
      { tags: ['a', 'b', 'c'] },
      { tags: ['b', 'c', 'd'] },
    );
    expect(result.tags).toEqual(['b', 'c']);
  });

  it('returns empty tags intersection when there is no overlap', () => {
    const result = composeFilter(
      { tags: ['a', 'b'] },
      { tags: ['c', 'd'] },
    );
    expect(result.tags).toEqual([]);
  });

  it('uses override tags when base has none', () => {
    const result = composeFilter({}, { tags: ['resistor'] });
    expect(result.tags).toEqual(['resistor']);
  });

  it('uses base tags when override has none', () => {
    const result = composeFilter({ tags: ['resistor'] }, {});
    expect(result.tags).toEqual(['resistor']);
  });

  it('does not mutate inputs', () => {
    const base: PartFilter = { category: 'resistor', tags: ['a'] };
    const override: PartFilter = { category: 'capacitor', tags: ['b'] };
    const beforeBase = JSON.stringify(base);
    const beforeOverride = JSON.stringify(override);
    composeFilter(base, override);
    expect(JSON.stringify(base)).toBe(beforeBase);
    expect(JSON.stringify(override)).toBe(beforeOverride);
  });

  it('composes multiple filters correctly', () => {
    const f1: PartFilter = { category: 'resistor', minTrustLevel: 'library' };
    const f2: PartFilter = { minTrustLevel: 'verified', projectId: 5 };
    const f3: PartFilter = { isPublic: true };
    const combined = composeFilter(composeFilter(f1, f2), f3);
    expect(combined.category).toBe('resistor');
    expect(combined.minTrustLevel).toBe('verified'); // f2 overrides f1
    expect(combined.projectId).toBe(5);
    expect(combined.isPublic).toBe(true);
  });
});

describe('DEFAULT_PART_PAGINATION', () => {
  it('has sensible defaults', () => {
    expect(DEFAULT_PART_PAGINATION.limit).toBe(50);
    expect(DEFAULT_PART_PAGINATION.offset).toBe(0);
    expect(DEFAULT_PART_PAGINATION.sortBy).toBe('updatedAt');
    expect(DEFAULT_PART_PAGINATION.sortDir).toBe('desc');
  });
});

describe('PART_SORT_FIELDS', () => {
  it('includes all documented sort fields', () => {
    expect(PART_SORT_FIELDS).toContain('title');
    expect(PART_SORT_FIELDS).toContain('createdAt');
    expect(PART_SORT_FIELDS).toContain('updatedAt');
    expect(PART_SORT_FIELDS).toContain('canonicalCategory');
    expect(PART_SORT_FIELDS).toContain('trustLevel');
  });

  it('is a readonly const array', () => {
    // TypeScript enforces this at compile time — runtime check just asserts array shape.
    expect(Array.isArray(PART_SORT_FIELDS)).toBe(true);
    expect(PART_SORT_FIELDS.length).toBeGreaterThanOrEqual(5);
  });
});
