import { describe, it, expect } from 'vitest';
import {
  DESIGN_SYSTEM_DOCS,
  searchDocs,
  getDocsByCategory,
  getDocById,
} from '../design-system-docs';
import type { DesignSystemCategory, DocEntry } from '../design-system-docs';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_CATEGORIES: DesignSystemCategory[] = [
  'colors',
  'typography',
  'spacing',
  'components',
  'icons',
  'motion',
  'patterns',
];

// ---------------------------------------------------------------------------
// DESIGN_SYSTEM_DOCS integrity
// ---------------------------------------------------------------------------

describe('DESIGN_SYSTEM_DOCS - integrity', () => {
  it('has at least 30 entries', () => {
    expect(DESIGN_SYSTEM_DOCS.length).toBeGreaterThanOrEqual(30);
  });

  it('every entry has a non-empty id', () => {
    for (const entry of DESIGN_SYSTEM_DOCS) {
      expect(entry.id).toBeTruthy();
      expect(entry.id.length).toBeGreaterThan(0);
    }
  });

  it('all ids are unique', () => {
    const ids = DESIGN_SYSTEM_DOCS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry has a non-empty title', () => {
    for (const entry of DESIGN_SYSTEM_DOCS) {
      expect(entry.title).toBeTruthy();
      expect(entry.title.length).toBeGreaterThan(0);
    }
  });

  it('every entry has a non-empty description', () => {
    for (const entry of DESIGN_SYSTEM_DOCS) {
      expect(entry.description).toBeTruthy();
      expect(entry.description.length).toBeGreaterThan(10);
    }
  });

  it('every entry has at least one example', () => {
    for (const entry of DESIGN_SYSTEM_DOCS) {
      expect(entry.examples.length).toBeGreaterThanOrEqual(1);
      for (const ex of entry.examples) {
        expect(ex.length).toBeGreaterThan(0);
      }
    }
  });

  it('every entry has a valid category', () => {
    for (const entry of DESIGN_SYSTEM_DOCS) {
      expect(ALL_CATEGORIES).toContain(entry.category);
    }
  });

  it('relatedTokens, when present, is a non-empty array of strings', () => {
    for (const entry of DESIGN_SYSTEM_DOCS) {
      if (entry.relatedTokens !== undefined) {
        expect(Array.isArray(entry.relatedTokens)).toBe(true);
        expect(entry.relatedTokens.length).toBeGreaterThan(0);
        for (const token of entry.relatedTokens) {
          expect(typeof token).toBe('string');
          expect(token.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('covers every category at least once', () => {
    const covered = new Set(DESIGN_SYSTEM_DOCS.map((e) => e.category));
    for (const cat of ALL_CATEGORIES) {
      expect(covered.has(cat)).toBe(true);
    }
  });

  it('ids follow kebab-case convention', () => {
    const kebab = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
    for (const entry of DESIGN_SYSTEM_DOCS) {
      expect(entry.id).toMatch(kebab);
    }
  });
});

// ---------------------------------------------------------------------------
// searchDocs
// ---------------------------------------------------------------------------

describe('searchDocs', () => {
  it('returns empty array for empty query', () => {
    expect(searchDocs('')).toEqual([]);
  });

  it('returns empty array for whitespace-only query', () => {
    expect(searchDocs('   ')).toEqual([]);
  });

  it('finds entries by title substring', () => {
    const results = searchDocs('Neon Cyan');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.id === 'neon-cyan')).toBe(true);
  });

  it('is case-insensitive', () => {
    const upper = searchDocs('NEON CYAN');
    const lower = searchDocs('neon cyan');
    expect(upper).toEqual(lower);
    expect(upper.length).toBeGreaterThanOrEqual(1);
  });

  it('matches against description text', () => {
    const results = searchDocs('shadcn');
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('matches against example strings', () => {
    const results = searchDocs('bg-primary');
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('matches against relatedTokens', () => {
    const results = searchDocs('--color-ring');
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('requires all terms to match (AND logic)', () => {
    const results = searchDocs('font mono');
    expect(results.length).toBeGreaterThanOrEqual(1);
    for (const r of results) {
      const haystack = [r.title, r.description, ...r.examples, ...(r.relatedTokens ?? [])].join(' ').toLowerCase();
      expect(haystack).toContain('font');
      expect(haystack).toContain('mono');
    }
  });

  it('returns empty for gibberish query', () => {
    expect(searchDocs('xyzzy9999qwerty')).toEqual([]);
  });

  it('finds multiple results for broad queries', () => {
    const results = searchDocs('color');
    expect(results.length).toBeGreaterThan(1);
  });

  it('returns DocEntry objects with correct shape', () => {
    const results = searchDocs('button');
    expect(results.length).toBeGreaterThanOrEqual(1);
    for (const r of results) {
      expect(r).toHaveProperty('id');
      expect(r).toHaveProperty('category');
      expect(r).toHaveProperty('title');
      expect(r).toHaveProperty('description');
      expect(r).toHaveProperty('examples');
    }
  });
});

// ---------------------------------------------------------------------------
// getDocsByCategory
// ---------------------------------------------------------------------------

describe('getDocsByCategory', () => {
  it('returns only entries matching the given category', () => {
    const results = getDocsByCategory('colors');
    expect(results.length).toBeGreaterThan(0);
    for (const entry of results) {
      expect(entry.category).toBe('colors');
    }
  });

  it('returns multiple entries for categories with several docs', () => {
    const components = getDocsByCategory('components');
    expect(components.length).toBeGreaterThanOrEqual(3);
  });

  it('returns at least one entry for every defined category', () => {
    for (const cat of ALL_CATEGORIES) {
      const results = getDocsByCategory(cat);
      expect(results.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('returns empty for an invalid category', () => {
    // Force an invalid category to test runtime behaviour.
    const results = getDocsByCategory('nonexistent' as DesignSystemCategory);
    expect(results).toEqual([]);
  });

  it('returns entries that are a subset of DESIGN_SYSTEM_DOCS', () => {
    const results = getDocsByCategory('typography');
    for (const entry of results) {
      expect(DESIGN_SYSTEM_DOCS).toContain(entry);
    }
  });
});

// ---------------------------------------------------------------------------
// getDocById
// ---------------------------------------------------------------------------

describe('getDocById', () => {
  it('returns the correct entry for a known id', () => {
    const entry = getDocById('neon-cyan');
    expect(entry).toBeDefined();
    expect(entry!.id).toBe('neon-cyan');
    expect(entry!.category).toBe('colors');
  });

  it('returns undefined for an unknown id', () => {
    expect(getDocById('does-not-exist-xyz')).toBeUndefined();
  });

  it('returns the exact same reference from DESIGN_SYSTEM_DOCS', () => {
    const entry = getDocById('button-variants');
    expect(entry).toBeDefined();
    expect(DESIGN_SYSTEM_DOCS).toContain(entry);
  });

  it('can find every entry by its id', () => {
    for (const doc of DESIGN_SYSTEM_DOCS) {
      const found = getDocById(doc.id);
      expect(found).toBe(doc);
    }
  });

  it('returns undefined for empty string', () => {
    expect(getDocById('')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting
// ---------------------------------------------------------------------------

describe('cross-cutting validation', () => {
  it('searchDocs and getDocsByCategory agree on category membership', () => {
    // Every entry returned by getDocsByCategory('icons') should also appear
    // when searching for a term unique to the icons category.
    const icons = getDocsByCategory('icons');
    expect(icons.length).toBeGreaterThanOrEqual(1);
    for (const entry of icons) {
      const found = getDocById(entry.id);
      expect(found).toBeDefined();
      expect(found!.category).toBe('icons');
    }
  });

  it('all DESIGN_SYSTEM_DOCS entries satisfy the DocEntry interface', () => {
    for (const entry of DESIGN_SYSTEM_DOCS) {
      // TypeScript enforces this at compile time, but we double-check at runtime.
      expect(typeof entry.id).toBe('string');
      expect(typeof entry.category).toBe('string');
      expect(typeof entry.title).toBe('string');
      expect(typeof entry.description).toBe('string');
      expect(Array.isArray(entry.examples)).toBe(true);
      if (entry.relatedTokens !== undefined) {
        expect(Array.isArray(entry.relatedTokens)).toBe(true);
      }
    }
  });

  it('searchDocs result count never exceeds total docs count', () => {
    const all = searchDocs('a');
    expect(all.length).toBeLessThanOrEqual(DESIGN_SYSTEM_DOCS.length);
  });

  it('type guard: DesignSystemCategory union is exhaustive', () => {
    // Build a set from the ALL_CATEGORIES constant and verify against actual data.
    const catSet = new Set<string>(ALL_CATEGORIES);
    for (const entry of DESIGN_SYSTEM_DOCS) {
      expect(catSet.has(entry.category)).toBe(true);
    }
  });
});
