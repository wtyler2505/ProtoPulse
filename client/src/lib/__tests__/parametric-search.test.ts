import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubGlobal('crypto', {
  randomUUID: vi.fn<() => string>(() => `uuid-${Math.random().toString(36).slice(2, 10)}`),
});

const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, val: string) => {
    store[key] = val;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    for (const k of Object.keys(store)) {
      delete store[k];
    }
  }),
});

import {
  ParametricSearchEngine,
  extractResistorParams,
  extractCapacitorParams,
  extractInductorParams,
  extractICParams,
  useParametricSearch,
} from '../parametric-search';
import type {
  IndexedComponent,
  ParametricFilter,
  ParameterUnit,
} from '../parametric-search';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeComponent(overrides: Partial<IndexedComponent> = {}): IndexedComponent {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: overrides.name ?? 'Test Component',
    category: overrides.category ?? 'Resistor',
    description: overrides.description ?? 'A test component',
    parameters: overrides.parameters ?? [],
    manufacturer: overrides.manufacturer,
    partNumber: overrides.partNumber,
    datasheet: overrides.datasheet,
    inStock: overrides.inStock,
    unitPrice: overrides.unitPrice,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ParametricSearchEngine', () => {
  let engine: ParametricSearchEngine;

  beforeEach(() => {
    ParametricSearchEngine.resetForTesting();
    engine = ParametricSearchEngine.getInstance();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance on multiple calls', () => {
      const a = ParametricSearchEngine.getInstance();
      const b = ParametricSearchEngine.getInstance();
      expect(a).toBe(b);
    });

    it('returns a fresh instance after resetForTesting', () => {
      const a = ParametricSearchEngine.getInstance();
      ParametricSearchEngine.resetForTesting();
      const b = ParametricSearchEngine.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // -----------------------------------------------------------------------
  // Built-in Sample Components
  // -----------------------------------------------------------------------

  describe('built-in sample components', () => {
    it('loads ~20 sample components on init', () => {
      expect(engine.getComponentCount()).toBe(20);
    });

    it('includes resistors, capacitors, inductors, and ICs', () => {
      const categories = engine.getCategories();
      expect(categories).toContain('Resistor');
      expect(categories).toContain('Capacitor');
      expect(categories).toContain('Inductor');
      expect(categories).toContain('IC');
    });

    it('sample components have parameters', () => {
      const result = engine.search([]);
      const withParams = result.components.filter((c) => c.parameters.length > 0);
      expect(withParams.length).toBe(result.components.length);
    });
  });

  // -----------------------------------------------------------------------
  // Index CRUD
  // -----------------------------------------------------------------------

  describe('index CRUD', () => {
    it('indexes a single component', () => {
      const initial = engine.getComponentCount();
      const comp = makeComponent({ id: 'test-1', name: 'Custom Part' });
      engine.indexComponent(comp);
      expect(engine.getComponentCount()).toBe(initial + 1);
    });

    it('indexes multiple components at once', () => {
      const initial = engine.getComponentCount();
      const comps = [
        makeComponent({ id: 'batch-1', name: 'Batch Part 1' }),
        makeComponent({ id: 'batch-2', name: 'Batch Part 2' }),
        makeComponent({ id: 'batch-3', name: 'Batch Part 3' }),
      ];
      engine.indexComponents(comps);
      expect(engine.getComponentCount()).toBe(initial + 3);
    });

    it('retrieves a component by ID', () => {
      const comp = makeComponent({ id: 'get-test', name: 'GetTest Part' });
      engine.indexComponent(comp);
      const found = engine.getComponent('get-test');
      expect(found).toBeDefined();
      expect(found!.name).toBe('GetTest Part');
    });

    it('returns undefined for non-existent component', () => {
      expect(engine.getComponent('non-existent')).toBeUndefined();
    });

    it('removes a component by ID', () => {
      const comp = makeComponent({ id: 'remove-test' });
      engine.indexComponent(comp);
      const removed = engine.removeComponent('remove-test');
      expect(removed).toBe(true);
      expect(engine.getComponent('remove-test')).toBeUndefined();
    });

    it('returns false when removing non-existent component', () => {
      expect(engine.removeComponent('does-not-exist')).toBe(false);
    });

    it('returns the correct component count', () => {
      engine.clear();
      expect(engine.getComponentCount()).toBe(0);
      engine.indexComponent(makeComponent({ id: 'c1' }));
      engine.indexComponent(makeComponent({ id: 'c2' }));
      expect(engine.getComponentCount()).toBe(2);
    });

    it('clears all components', () => {
      engine.clear();
      expect(engine.getComponentCount()).toBe(0);
    });

    it('overwrites a component with the same ID', () => {
      engine.indexComponent(makeComponent({ id: 'dup', name: 'Original' }));
      engine.indexComponent(makeComponent({ id: 'dup', name: 'Updated' }));
      const found = engine.getComponent('dup');
      expect(found!.name).toBe('Updated');
    });
  });

  // -----------------------------------------------------------------------
  // Search with Single Filter
  // -----------------------------------------------------------------------

  describe('search with single filter', () => {
    beforeEach(() => {
      engine.clear();
      engine.indexComponents([
        makeComponent({
          id: 'r1',
          name: '10k Resistor',
          category: 'Resistor',
          parameters: [{ name: 'resistance', value: 10000, unit: 'ohm' }],
        }),
        makeComponent({
          id: 'r2',
          name: '4.7k Resistor',
          category: 'Resistor',
          parameters: [{ name: 'resistance', value: 4700, unit: 'ohm' }],
        }),
        makeComponent({
          id: 'r3',
          name: '100 Resistor',
          category: 'Resistor',
          parameters: [{ name: 'resistance', value: 100, unit: 'ohm' }],
        }),
        makeComponent({
          id: 'c1',
          name: '100nF Capacitor',
          category: 'Capacitor',
          parameters: [{ name: 'capacitance', value: 100e-9, unit: 'farad' }],
        }),
      ]);
    });

    it('eq operator matches exact numeric value', () => {
      const result = engine.search([{ parameter: 'resistance', operator: 'eq', value: 10000 }]);
      expect(result.totalCount).toBe(1);
      expect(result.components[0].name).toBe('10k Resistor');
    });

    it('neq operator excludes matching value', () => {
      const result = engine.search([{ parameter: 'resistance', operator: 'neq', value: 10000 }]);
      expect(result.totalCount).toBe(2);
      expect(result.components.every((c) => c.name !== '10k Resistor')).toBe(true);
    });

    it('gt operator matches values greater than threshold', () => {
      const result = engine.search([{ parameter: 'resistance', operator: 'gt', value: 4700 }]);
      expect(result.totalCount).toBe(1);
      expect(result.components[0].name).toBe('10k Resistor');
    });

    it('gte operator matches values greater than or equal to threshold', () => {
      const result = engine.search([{ parameter: 'resistance', operator: 'gte', value: 4700 }]);
      expect(result.totalCount).toBe(2);
    });

    it('lt operator matches values less than threshold', () => {
      const result = engine.search([{ parameter: 'resistance', operator: 'lt', value: 4700 }]);
      expect(result.totalCount).toBe(1);
      expect(result.components[0].name).toBe('100 Resistor');
    });

    it('lte operator matches values less than or equal to threshold', () => {
      const result = engine.search([{ parameter: 'resistance', operator: 'lte', value: 4700 }]);
      expect(result.totalCount).toBe(2);
    });

    it('eq operator on category (string field)', () => {
      const result = engine.search([{ parameter: 'category', operator: 'eq', value: 'Capacitor' }]);
      expect(result.totalCount).toBe(1);
      expect(result.components[0].name).toBe('100nF Capacitor');
    });

    it('returns no results when no matches', () => {
      const result = engine.search([{ parameter: 'resistance', operator: 'eq', value: 999999 }]);
      expect(result.totalCount).toBe(0);
      expect(result.components).toHaveLength(0);
    });

    it('returns all results when filter parameter does not exist on components', () => {
      const result = engine.search([{ parameter: 'nonexistent', operator: 'eq', value: 42 }]);
      expect(result.totalCount).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Search with Range Filter
  // -----------------------------------------------------------------------

  describe('search with range filter', () => {
    beforeEach(() => {
      engine.clear();
      engine.indexComponents([
        makeComponent({
          id: 'r1',
          name: '100R',
          parameters: [{ name: 'resistance', value: 100, unit: 'ohm' }],
        }),
        makeComponent({
          id: 'r2',
          name: '1kR',
          parameters: [{ name: 'resistance', value: 1000, unit: 'ohm' }],
        }),
        makeComponent({
          id: 'r3',
          name: '10kR',
          parameters: [{ name: 'resistance', value: 10000, unit: 'ohm' }],
        }),
        makeComponent({
          id: 'r4',
          name: '100kR',
          parameters: [{ name: 'resistance', value: 100000, unit: 'ohm' }],
        }),
      ]);
    });

    it('range filter includes components within bounds', () => {
      const result = engine.search([
        { parameter: 'resistance', operator: 'range', value: 500, value2: 15000 },
      ]);
      expect(result.totalCount).toBe(2);
      const names = result.components.map((c) => c.name);
      expect(names).toContain('1kR');
      expect(names).toContain('10kR');
    });

    it('range filter is inclusive on both bounds', () => {
      const result = engine.search([
        { parameter: 'resistance', operator: 'range', value: 1000, value2: 10000 },
      ]);
      expect(result.totalCount).toBe(2);
    });

    it('range filter returns empty when no matches in range', () => {
      const result = engine.search([
        { parameter: 'resistance', operator: 'range', value: 200, value2: 500 },
      ]);
      expect(result.totalCount).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Search with Contains / StartsWith
  // -----------------------------------------------------------------------

  describe('search with string operators', () => {
    beforeEach(() => {
      engine.clear();
      engine.indexComponents([
        makeComponent({
          id: 's1',
          name: 'Blue LED 3mm',
          parameters: [{ name: 'color', value: 'Blue', unit: 'none' }],
        }),
        makeComponent({
          id: 's2',
          name: 'Red LED 5mm',
          parameters: [{ name: 'color', value: 'Red', unit: 'none' }],
        }),
        makeComponent({
          id: 's3',
          name: 'Blue-Green LED',
          parameters: [{ name: 'color', value: 'Blue-Green', unit: 'none' }],
        }),
      ]);
    });

    it('contains operator matches substring', () => {
      const result = engine.search([{ parameter: 'color', operator: 'contains', value: 'lue' }]);
      expect(result.totalCount).toBe(2);
    });

    it('startsWith operator matches prefix', () => {
      const result = engine.search([{ parameter: 'color', operator: 'startsWith', value: 'Blue' }]);
      expect(result.totalCount).toBe(2);
    });

    it('startsWith is case-insensitive', () => {
      const result = engine.search([{ parameter: 'color', operator: 'startsWith', value: 'blue' }]);
      expect(result.totalCount).toBe(2);
    });

    it('contains on name field', () => {
      const result = engine.search([{ parameter: 'name', operator: 'contains', value: 'LED' }]);
      expect(result.totalCount).toBe(3);
    });
  });

  // -----------------------------------------------------------------------
  // Multi-Filter AND Search
  // -----------------------------------------------------------------------

  describe('multi-filter AND search', () => {
    beforeEach(() => {
      engine.clear();
      engine.indexComponents([
        makeComponent({
          id: 'mf1',
          name: '10k 1% 0805',
          category: 'Resistor',
          parameters: [
            { name: 'resistance', value: 10000, unit: 'ohm' },
            { name: 'tolerance', value: 1, unit: 'none' },
            { name: 'package', value: '0805', unit: 'none' },
          ],
        }),
        makeComponent({
          id: 'mf2',
          name: '10k 5% 0805',
          category: 'Resistor',
          parameters: [
            { name: 'resistance', value: 10000, unit: 'ohm' },
            { name: 'tolerance', value: 5, unit: 'none' },
            { name: 'package', value: '0805', unit: 'none' },
          ],
        }),
        makeComponent({
          id: 'mf3',
          name: '10k 1% 0603',
          category: 'Resistor',
          parameters: [
            { name: 'resistance', value: 10000, unit: 'ohm' },
            { name: 'tolerance', value: 1, unit: 'none' },
            { name: 'package', value: '0603', unit: 'none' },
          ],
        }),
      ]);
    });

    it('AND mode requires all filters to match', () => {
      const filters: ParametricFilter[] = [
        { parameter: 'resistance', operator: 'eq', value: 10000 },
        { parameter: 'tolerance', operator: 'eq', value: 1 },
        { parameter: 'package', operator: 'eq', value: '0805' },
      ];
      const result = engine.search(filters, { combineMode: 'and' });
      expect(result.totalCount).toBe(1);
      expect(result.components[0].id).toBe('mf1');
    });

    it('AND is the default combine mode', () => {
      const filters: ParametricFilter[] = [
        { parameter: 'resistance', operator: 'eq', value: 10000 },
        { parameter: 'tolerance', operator: 'eq', value: 1 },
      ];
      const result = engine.search(filters);
      expect(result.totalCount).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // Multi-Filter OR Search
  // -----------------------------------------------------------------------

  describe('multi-filter OR search', () => {
    beforeEach(() => {
      engine.clear();
      engine.indexComponents([
        makeComponent({
          id: 'or1',
          name: '10k Resistor',
          parameters: [{ name: 'resistance', value: 10000, unit: 'ohm' }],
        }),
        makeComponent({
          id: 'or2',
          name: '100nF Cap',
          parameters: [{ name: 'capacitance', value: 100e-9, unit: 'farad' }],
        }),
        makeComponent({
          id: 'or3',
          name: '4.7k Resistor',
          parameters: [{ name: 'resistance', value: 4700, unit: 'ohm' }],
        }),
      ]);
    });

    it('OR mode matches if any filter matches', () => {
      const filters: ParametricFilter[] = [
        { parameter: 'resistance', operator: 'eq', value: 10000 },
        { parameter: 'capacitance', operator: 'eq', value: 100e-9 },
      ];
      const result = engine.search(filters, { combineMode: 'or' });
      expect(result.totalCount).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // Pagination
  // -----------------------------------------------------------------------

  describe('pagination', () => {
    beforeEach(() => {
      engine.clear();
      const comps: IndexedComponent[] = [];
      for (let i = 0; i < 25; i++) {
        comps.push(
          makeComponent({
            id: `page-${i}`,
            name: `Component ${String(i).padStart(2, '0')}`,
            parameters: [{ name: 'index', value: i, unit: 'none' }],
          }),
        );
      }
      engine.indexComponents(comps);
    });

    it('defaults to page 1 with 20 items per page', () => {
      const result = engine.search([]);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.components).toHaveLength(20);
      expect(result.totalCount).toBe(25);
      expect(result.totalPages).toBe(2);
    });

    it('second page contains remaining items', () => {
      const result = engine.search([], { page: 2 });
      expect(result.page).toBe(2);
      expect(result.components).toHaveLength(5);
    });

    it('custom page size', () => {
      const result = engine.search([], { pageSize: 5 });
      expect(result.components).toHaveLength(5);
      expect(result.totalPages).toBe(5);
    });

    it('totalPages is at least 1 even with no results', () => {
      engine.clear();
      const result = engine.search([]);
      expect(result.totalPages).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Sorting
  // -----------------------------------------------------------------------

  describe('sorting', () => {
    beforeEach(() => {
      engine.clear();
      engine.indexComponents([
        makeComponent({
          id: 'sort-a',
          name: 'Alpha',
          category: 'IC',
          unitPrice: 5.0,
          parameters: [{ name: 'voltage', value: 3.3, unit: 'volt' }],
        }),
        makeComponent({
          id: 'sort-b',
          name: 'Beta',
          category: 'Resistor',
          unitPrice: 0.01,
          parameters: [{ name: 'voltage', value: 5.0, unit: 'volt' }],
        }),
        makeComponent({
          id: 'sort-c',
          name: 'Charlie',
          category: 'Capacitor',
          unitPrice: 0.5,
          parameters: [{ name: 'voltage', value: 1.8, unit: 'volt' }],
        }),
      ]);
    });

    it('sorts by name ascending (default)', () => {
      const result = engine.search([]);
      expect(result.components.map((c) => c.name)).toEqual(['Alpha', 'Beta', 'Charlie']);
    });

    it('sorts by name descending', () => {
      const result = engine.search([], { sort: 'name', direction: 'desc' });
      expect(result.components.map((c) => c.name)).toEqual(['Charlie', 'Beta', 'Alpha']);
    });

    it('sorts by unitPrice ascending', () => {
      const result = engine.search([], { sort: 'unitPrice', direction: 'asc' });
      expect(result.components.map((c) => c.name)).toEqual(['Beta', 'Charlie', 'Alpha']);
    });

    it('sorts by parameter value', () => {
      const result = engine.search([], { sort: 'voltage', direction: 'asc' });
      expect(result.components.map((c) => c.name)).toEqual(['Charlie', 'Alpha', 'Beta']);
    });

    it('sorts by category', () => {
      const result = engine.search([], { sort: 'category', direction: 'asc' });
      expect(result.components.map((c) => c.name)).toEqual(['Charlie', 'Alpha', 'Beta']);
    });
  });

  // -----------------------------------------------------------------------
  // Facets
  // -----------------------------------------------------------------------

  describe('facets', () => {
    beforeEach(() => {
      engine.clear();
      engine.indexComponents([
        makeComponent({
          id: 'f1',
          name: 'R1',
          parameters: [
            { name: 'package', value: '0805', unit: 'none' },
            { name: 'resistance', value: 100, unit: 'ohm' },
          ],
        }),
        makeComponent({
          id: 'f2',
          name: 'R2',
          parameters: [
            { name: 'package', value: '0805', unit: 'none' },
            { name: 'resistance', value: 1000, unit: 'ohm' },
          ],
        }),
        makeComponent({
          id: 'f3',
          name: 'R3',
          parameters: [
            { name: 'package', value: '0603', unit: 'none' },
            { name: 'resistance', value: 10000, unit: 'ohm' },
          ],
        }),
      ]);
    });

    it('returns facet value counts for a parameter', () => {
      const facet = engine.getFacets('package');
      expect(facet.parameter).toBe('package');
      const pkg0805 = facet.values.find((v) => v.value === '0805');
      const pkg0603 = facet.values.find((v) => v.value === '0603');
      expect(pkg0805?.count).toBe(2);
      expect(pkg0603?.count).toBe(1);
    });

    it('returns min/max for numeric parameters', () => {
      const facet = engine.getFacets('resistance');
      expect(facet.min).toBe(100);
      expect(facet.max).toBe(10000);
      expect(facet.unit).toBe('ohm');
    });

    it('facets respect existing filters', () => {
      const facet = engine.getFacets('resistance', [
        { parameter: 'package', operator: 'eq', value: '0805' },
      ]);
      expect(facet.values).toHaveLength(2); // 100 and 1000
      expect(facet.min).toBe(100);
      expect(facet.max).toBe(1000);
    });

    it('search results include facets', () => {
      const result = engine.search([]);
      expect(result.facets.length).toBeGreaterThan(0);
      const packageFacet = result.facets.find((f) => f.parameter === 'package');
      expect(packageFacet).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // Suggestions
  // -----------------------------------------------------------------------

  describe('suggestions', () => {
    beforeEach(() => {
      engine.clear();
      engine.indexComponents([
        makeComponent({ id: 'sug1', name: '10k Resistor' }),
        makeComponent({ id: 'sug2', name: '100nF Capacitor' }),
        makeComponent({ id: 'sug3', name: '10uH Inductor' }),
        makeComponent({ id: 'sug4', name: 'ATmega328P' }),
      ]);
    });

    it('returns components matching prefix', () => {
      const results = engine.getSuggestions('10');
      expect(results.length).toBe(3);
    });

    it('is case-insensitive', () => {
      const results = engine.getSuggestions('atm');
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('ATmega328P');
    });

    it('respects limit', () => {
      const results = engine.getSuggestions('1', 2);
      expect(results.length).toBe(2);
    });

    it('returns empty array when no prefix match', () => {
      const results = engine.getSuggestions('xyz');
      expect(results).toHaveLength(0);
    });

    it('defaults to limit of 10', () => {
      engine.clear();
      for (let i = 0; i < 15; i++) {
        engine.indexComponent(makeComponent({ id: `s${i}`, name: `A Part ${i}` }));
      }
      const results = engine.getSuggestions('A');
      expect(results.length).toBe(10);
    });
  });

  // -----------------------------------------------------------------------
  // parseValueWithUnit
  // -----------------------------------------------------------------------

  describe('parseValueWithUnit', () => {
    it('parses "10kΩ" to 10000 ohm', () => {
      const result = engine.parseValueWithUnit('10k\u2126');
      expect(result).not.toBeNull();
      expect(result!.value).toBe(10000);
      expect(result!.unit).toBe('ohm');
    });

    it('parses "4.7uF" to 4.7e-6 farad', () => {
      const result = engine.parseValueWithUnit('4.7uF');
      expect(result).not.toBeNull();
      expect(result!.value).toBeCloseTo(4.7e-6, 12);
      expect(result!.unit).toBe('farad');
    });

    it('parses "100nH" to 100e-9 henry', () => {
      const result = engine.parseValueWithUnit('100nH');
      expect(result).not.toBeNull();
      expect(result!.value).toBeCloseTo(100e-9, 15);
      expect(result!.unit).toBe('henry');
    });

    it('parses "3.3V" to 3.3 volt', () => {
      const result = engine.parseValueWithUnit('3.3V');
      expect(result).not.toBeNull();
      expect(result!.value).toBeCloseTo(3.3);
      expect(result!.unit).toBe('volt');
    });

    it('parses "1.5A" to 1.5 amp', () => {
      const result = engine.parseValueWithUnit('1.5A');
      expect(result).not.toBeNull();
      expect(result!.value).toBeCloseTo(1.5);
      expect(result!.unit).toBe('amp');
    });

    it('parses "22pF" to 22e-12 farad', () => {
      const result = engine.parseValueWithUnit('22pF');
      expect(result).not.toBeNull();
      expect(result!.value).toBeCloseTo(22e-12, 18);
      expect(result!.unit).toBe('farad');
    });

    it('parses "1MW" to 1e6 watt', () => {
      const result = engine.parseValueWithUnit('1MW');
      expect(result).not.toBeNull();
      expect(result!.value).toBe(1e6);
      expect(result!.unit).toBe('watt');
    });

    it('parses "500mA" to 0.5 amp', () => {
      const result = engine.parseValueWithUnit('500mA');
      expect(result).not.toBeNull();
      expect(result!.value).toBeCloseTo(0.5);
      expect(result!.unit).toBe('amp');
    });

    it('returns null for invalid input', () => {
      expect(engine.parseValueWithUnit('')).toBeNull();
      expect(engine.parseValueWithUnit('abc')).toBeNull();
    });

    it('parses value with spaces', () => {
      const result = engine.parseValueWithUnit('  10 k ohm  ');
      expect(result).not.toBeNull();
      expect(result!.value).toBe(10000);
      expect(result!.unit).toBe('ohm');
    });
  });

  // -----------------------------------------------------------------------
  // normalizeValue
  // -----------------------------------------------------------------------

  describe('normalizeValue', () => {
    it('returns same value for same unit (identity)', () => {
      expect(engine.normalizeValue(1000, 'ohm')).toBe(1000);
    });

    it('converts mm to mil', () => {
      const result = engine.normalizeValue(1, 'mm', 'mil');
      expect(result).toBeCloseTo(39.3701, 2);
    });

    it('converts mil to mm', () => {
      const result = engine.normalizeValue(39.3701, 'mil', 'mm');
      expect(result).toBeCloseTo(1, 2);
    });

    it('converts mm to inch', () => {
      const result = engine.normalizeValue(25.4, 'mm', 'inch');
      expect(result).toBeCloseTo(1, 4);
    });

    it('converts inch to mm', () => {
      const result = engine.normalizeValue(1, 'inch', 'mm');
      expect(result).toBeCloseTo(25.4);
    });

    it('converts mil to inch', () => {
      const result = engine.normalizeValue(1000, 'mil', 'inch');
      expect(result).toBeCloseTo(1);
    });

    it('converts inch to mil', () => {
      const result = engine.normalizeValue(1, 'inch', 'mil');
      expect(result).toBeCloseTo(1000);
    });
  });

  // -----------------------------------------------------------------------
  // Parameter Extractors
  // -----------------------------------------------------------------------

  describe('extractResistorParams', () => {
    it('extracts resistance from "10k"', () => {
      const params = extractResistorParams('10k');
      const resistance = params.find((p) => p.name === 'resistance');
      expect(resistance).toBeDefined();
      expect(resistance!.value).toBe(10000);
      expect(resistance!.unit).toBe('ohm');
    });

    it('extracts resistance from "4.7kΩ"', () => {
      const params = extractResistorParams('4.7k\u2126');
      const resistance = params.find((p) => p.name === 'resistance');
      expect(resistance!.value).toBeCloseTo(4700);
    });

    it('extracts tolerance from "1%"', () => {
      const params = extractResistorParams('10k 1% 0805');
      const tolerance = params.find((p) => p.name === 'tolerance');
      expect(tolerance).toBeDefined();
      expect(tolerance!.value).toBe(1);
    });

    it('extracts power rating', () => {
      const params = extractResistorParams('100R 0.25W');
      const power = params.find((p) => p.name === 'power');
      expect(power).toBeDefined();
      expect(power!.value).toBe(0.25);
      expect(power!.unit).toBe('watt');
    });

    it('extracts package size', () => {
      const params = extractResistorParams('10k 0805');
      const pkg = params.find((p) => p.name === 'package');
      expect(pkg).toBeDefined();
      expect(pkg!.value).toBe('0805');
    });

    it('handles "1M" resistance', () => {
      const params = extractResistorParams('1M');
      const resistance = params.find((p) => p.name === 'resistance');
      expect(resistance!.value).toBe(1000000);
    });
  });

  describe('extractCapacitorParams', () => {
    it('extracts capacitance from "100nF"', () => {
      const params = extractCapacitorParams('100nF');
      const cap = params.find((p) => p.name === 'capacitance');
      expect(cap).toBeDefined();
      expect(cap!.value).toBeCloseTo(100e-9, 15);
      expect(cap!.unit).toBe('farad');
    });

    it('extracts capacitance from "4.7uF"', () => {
      const params = extractCapacitorParams('4.7uF');
      const cap = params.find((p) => p.name === 'capacitance');
      expect(cap!.value).toBeCloseTo(4.7e-6, 12);
    });

    it('extracts voltage rating', () => {
      const params = extractCapacitorParams('100nF 25V');
      const voltage = params.find((p) => p.name === 'voltage');
      expect(voltage).toBeDefined();
      expect(voltage!.value).toBe(25);
      expect(voltage!.unit).toBe('volt');
    });

    it('extracts dielectric type', () => {
      const params = extractCapacitorParams('100nF X7R 0805');
      const dielectric = params.find((p) => p.name === 'dielectric');
      expect(dielectric).toBeDefined();
      expect(dielectric!.value).toBe('X7R');
    });

    it('extracts package', () => {
      const params = extractCapacitorParams('10uF 0805');
      const pkg = params.find((p) => p.name === 'package');
      expect(pkg!.value).toBe('0805');
    });
  });

  describe('extractInductorParams', () => {
    it('extracts inductance from "10uH"', () => {
      const params = extractInductorParams('10uH');
      const ind = params.find((p) => p.name === 'inductance');
      expect(ind).toBeDefined();
      expect(ind!.value).toBeCloseTo(10e-6, 12);
      expect(ind!.unit).toBe('henry');
    });

    it('extracts inductance from "100nH"', () => {
      const params = extractInductorParams('100nH');
      const ind = params.find((p) => p.name === 'inductance');
      expect(ind!.value).toBeCloseTo(100e-9, 15);
    });

    it('extracts current rating', () => {
      const params = extractInductorParams('10uH 2A');
      const current = params.find((p) => p.name === 'current');
      expect(current).toBeDefined();
      expect(current!.value).toBe(2);
      expect(current!.unit).toBe('amp');
    });

    it('extracts package', () => {
      const params = extractInductorParams('4.7uH 0805');
      const pkg = params.find((p) => p.name === 'package');
      expect(pkg!.value).toBe('0805');
    });
  });

  describe('extractICParams', () => {
    it('extracts voltage from "5V"', () => {
      const params = extractICParams('ATmega328P 5V');
      const voltage = params.find((p) => p.name === 'voltage');
      expect(voltage).toBeDefined();
      expect(voltage!.value).toBe(5);
      expect(voltage!.unit).toBe('volt');
    });

    it('extracts package from "TQFP-32"', () => {
      const params = extractICParams('ATmega328P TQFP-32');
      const pkg = params.find((p) => p.name === 'package');
      expect(pkg).toBeDefined();
      expect(pkg!.value).toBe('TQFP-32');
    });

    it('extracts pin count from package designation', () => {
      const params = extractICParams('ATmega328P TQFP-32');
      const pinCount = params.find((p) => p.name === 'pinCount');
      expect(pinCount).toBeDefined();
      expect(pinCount!.value).toBe(32);
    });

    it('extracts pin count from "32-pin"', () => {
      const params = extractICParams('MCU 32-pin');
      const pinCount = params.find((p) => p.name === 'pinCount');
      expect(pinCount).toBeDefined();
      expect(pinCount!.value).toBe(32);
    });

    it('extracts DIP package', () => {
      const params = extractICParams('NE555 DIP-8');
      const pkg = params.find((p) => p.name === 'package');
      expect(pkg!.value).toBe('DIP-8');
    });
  });

  // -----------------------------------------------------------------------
  // Export / Import Index
  // -----------------------------------------------------------------------

  describe('export and import index', () => {
    it('round-trips through export/import', () => {
      engine.clear();
      engine.indexComponents([
        makeComponent({
          id: 'exp1',
          name: 'Export Test 1',
          category: 'Resistor',
          parameters: [{ name: 'resistance', value: 1000, unit: 'ohm' }],
        }),
        makeComponent({
          id: 'exp2',
          name: 'Export Test 2',
          category: 'Capacitor',
          parameters: [{ name: 'capacitance', value: 1e-6, unit: 'farad' }],
        }),
      ]);

      const json = engine.exportIndex();
      engine.clear();
      expect(engine.getComponentCount()).toBe(0);

      const result = engine.importIndex(json);
      expect(result.imported).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(engine.getComponentCount()).toBe(2);
      expect(engine.getComponent('exp1')!.name).toBe('Export Test 1');
    });

    it('handles malformed JSON', () => {
      const result = engine.importIndex('not valid json');
      expect(result.imported).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('handles missing components array', () => {
      const result = engine.importIndex('{"version": 1}');
      expect(result.imported).toBe(0);
      expect(result.errors).toContain('Missing "components" array');
    });

    it('handles invalid component entries', () => {
      const json = JSON.stringify({
        version: 1,
        components: [
          { id: 'valid', name: 'Valid', category: 'IC', parameters: [], description: '' },
          { invalid: true },
          'not an object',
        ],
      });
      const result = engine.importIndex(json);
      expect(result.imported).toBe(1);
      expect(result.errors.length).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // Category Listing
  // -----------------------------------------------------------------------

  describe('getCategories', () => {
    it('returns unique sorted categories', () => {
      engine.clear();
      engine.indexComponents([
        makeComponent({ id: 'cat1', category: 'Resistor' }),
        makeComponent({ id: 'cat2', category: 'Capacitor' }),
        makeComponent({ id: 'cat3', category: 'Resistor' }),
        makeComponent({ id: 'cat4', category: 'IC' }),
      ]);
      const categories = engine.getCategories();
      expect(categories).toEqual(['Capacitor', 'IC', 'Resistor']);
    });

    it('returns empty array when index is empty', () => {
      engine.clear();
      expect(engine.getCategories()).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Parameter Names
  // -----------------------------------------------------------------------

  describe('getParameterNames', () => {
    it('returns unique sorted parameter names', () => {
      engine.clear();
      engine.indexComponents([
        makeComponent({
          id: 'pn1',
          parameters: [
            { name: 'resistance', value: 100, unit: 'ohm' },
            { name: 'tolerance', value: 1, unit: 'none' },
          ],
        }),
        makeComponent({
          id: 'pn2',
          parameters: [
            { name: 'resistance', value: 200, unit: 'ohm' },
            { name: 'package', value: '0805', unit: 'none' },
          ],
        }),
      ]);
      const names = engine.getParameterNames();
      expect(names).toEqual(['package', 'resistance', 'tolerance']);
    });
  });

  // -----------------------------------------------------------------------
  // Subscribe / Notify
  // -----------------------------------------------------------------------

  describe('subscribe and notify', () => {
    it('notifies subscribers on indexComponent', () => {
      const listener = vi.fn();
      engine.subscribe(listener);
      engine.indexComponent(makeComponent({ id: 'notify-test' }));
      expect(listener).toHaveBeenCalled();
    });

    it('notifies subscribers on removeComponent', () => {
      engine.indexComponent(makeComponent({ id: 'notify-rm' }));
      const listener = vi.fn();
      engine.subscribe(listener);
      engine.removeComponent('notify-rm');
      expect(listener).toHaveBeenCalled();
    });

    it('notifies subscribers on clear', () => {
      const listener = vi.fn();
      engine.subscribe(listener);
      engine.clear();
      expect(listener).toHaveBeenCalled();
    });

    it('unsubscribe stops notifications', () => {
      const listener = vi.fn();
      const unsubscribe = engine.subscribe(listener);
      unsubscribe();
      engine.indexComponent(makeComponent({ id: 'after-unsub' }));
      expect(listener).not.toHaveBeenCalled();
    });

    it('multiple subscribers all get notified', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      engine.subscribe(listener1);
      engine.subscribe(listener2);
      engine.indexComponent(makeComponent({ id: 'multi-sub' }));
      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Edge Cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('empty index returns empty results', () => {
      engine.clear();
      const result = engine.search([]);
      expect(result.totalCount).toBe(0);
      expect(result.components).toHaveLength(0);
    });

    it('no matches returns empty components with correct pagination', () => {
      engine.clear();
      engine.indexComponent(
        makeComponent({
          id: 'edge1',
          parameters: [{ name: 'resistance', value: 100, unit: 'ohm' }],
        }),
      );
      const result = engine.search([{ parameter: 'resistance', operator: 'eq', value: 999 }]);
      expect(result.totalCount).toBe(0);
      expect(result.totalPages).toBe(1);
    });

    it('all components match with empty filters', () => {
      engine.clear();
      engine.indexComponents([
        makeComponent({ id: 'all1' }),
        makeComponent({ id: 'all2' }),
        makeComponent({ id: 'all3' }),
      ]);
      const result = engine.search([]);
      expect(result.totalCount).toBe(3);
    });

    it('duplicate IDs overwrite existing component', () => {
      engine.clear();
      engine.indexComponent(makeComponent({ id: 'dup-edge', name: 'First' }));
      engine.indexComponent(makeComponent({ id: 'dup-edge', name: 'Second' }));
      expect(engine.getComponentCount()).toBe(1);
      expect(engine.getComponent('dup-edge')!.name).toBe('Second');
    });

    it('search with empty string filters', () => {
      engine.clear();
      engine.indexComponents([
        makeComponent({
          id: 'str-edge',
          parameters: [{ name: 'color', value: 'Red', unit: 'none' }],
        }),
      ]);
      const result = engine.search([{ parameter: 'color', operator: 'contains', value: '' }]);
      expect(result.totalCount).toBe(1);
    });

    it('getComponent returns a copy, not a reference', () => {
      engine.clear();
      engine.indexComponent(makeComponent({ id: 'copy-test', name: 'Original' }));
      const comp = engine.getComponent('copy-test')!;
      comp.name = 'Modified';
      expect(engine.getComponent('copy-test')!.name).toBe('Original');
    });
  });

  // -----------------------------------------------------------------------
  // Hook Shape Validation
  // -----------------------------------------------------------------------

  describe('useParametricSearch hook', () => {
    it('exports the expected shape', () => {
      expect(typeof useParametricSearch).toBe('function');
    });
  });
});
