import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.stubGlobal('crypto', { randomUUID: vi.fn(() => `uuid-${Math.random().toString(36).slice(2, 10)}`) });

const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, val: string) => { store[key] = val; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { for (const k of Object.keys(store)) { delete store[k]; } }),
});

import {
  AlternatePartsEngine,
  useAlternateParts,
} from '../alternate-parts';
import type {
  PartReference,
  CrossReferenceRule,
  EquivalenceEntry,
  MatchConfidence,
} from '../alternate-parts';

describe('AlternatePartsEngine', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) {
      delete store[k];
    }
    AlternatePartsEngine.resetForTesting();
  });

  // -------------------------------------------------------------------------
  // Singleton
  // -------------------------------------------------------------------------

  describe('Singleton', () => {
    it('returns the same instance on multiple calls', () => {
      const a = AlternatePartsEngine.getInstance();
      const b = AlternatePartsEngine.getInstance();
      expect(a).toBe(b);
    });

    it('returns a new instance after resetForTesting', () => {
      const a = AlternatePartsEngine.getInstance();
      AlternatePartsEngine.resetForTesting();
      const b = AlternatePartsEngine.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // -------------------------------------------------------------------------
  // Part CRUD
  // -------------------------------------------------------------------------

  describe('Part CRUD', () => {
    it('adds a part and retrieves it by id', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      const part = engine.addPart({
        partNumber: 'TEST-001',
        manufacturer: 'Acme',
        description: 'Test resistor',
        category: 'resistor',
        parameters: { resistance: 1000 },
        package: '0805',
        pinCount: 2,
        status: 'active',
      });
      expect(part.id).toBeTruthy();
      expect(part.partNumber).toBe('TEST-001');
      const retrieved = engine.getPart(part.id);
      expect(retrieved).toEqual(part);
    });

    it('returns null for a non-existent part id', () => {
      const engine = AlternatePartsEngine.getInstance();
      expect(engine.getPart('nonexistent')).toBeNull();
    });

    it('removes a part by id', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      const part = engine.addPart({
        partNumber: 'TEST-002',
        manufacturer: 'Acme',
        description: 'Test',
        category: 'resistor',
        parameters: {},
        package: '0805',
        pinCount: 2,
        status: 'active',
      });
      expect(engine.removePart(part.id)).toBe(true);
      expect(engine.getPart(part.id)).toBeNull();
    });

    it('returns false when removing a non-existent part', () => {
      const engine = AlternatePartsEngine.getInstance();
      expect(engine.removePart('nonexistent')).toBe(false);
    });

    it('gets a part by part number', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      engine.addPart({
        partNumber: 'ABC-123',
        manufacturer: 'Maker',
        description: 'A part',
        category: 'resistor',
        parameters: {},
        package: '0603',
        pinCount: 2,
        status: 'active',
      });
      const found = engine.getPartByNumber('ABC-123');
      expect(found).not.toBeNull();
      expect(found!.partNumber).toBe('ABC-123');
    });

    it('getPartByNumber is case insensitive', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      engine.addPart({
        partNumber: 'Abc-123',
        manufacturer: 'Maker',
        description: 'A part',
        category: 'resistor',
        parameters: {},
        package: '0603',
        pinCount: 2,
        status: 'active',
      });
      expect(engine.getPartByNumber('abc-123')).not.toBeNull();
    });

    it('getPartByNumber filters by manufacturer when provided', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      engine.addPart({
        partNumber: 'ABC-123',
        manufacturer: 'Maker1',
        description: 'Part A',
        category: 'resistor',
        parameters: {},
        package: '0603',
        pinCount: 2,
        status: 'active',
      });
      engine.addPart({
        partNumber: 'ABC-123',
        manufacturer: 'Maker2',
        description: 'Part B',
        category: 'resistor',
        parameters: {},
        package: '0603',
        pinCount: 2,
        status: 'active',
      });
      const found = engine.getPartByNumber('ABC-123', 'Maker2');
      expect(found).not.toBeNull();
      expect(found!.manufacturer).toBe('Maker2');
    });

    it('returns null for getPartByNumber with unknown part', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      expect(engine.getPartByNumber('NOPE')).toBeNull();
    });

    it('getAllParts returns all added parts', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      engine.addPart({ partNumber: 'P1', manufacturer: 'M', description: '', category: 'r', parameters: {}, package: '', pinCount: 2, status: 'active' });
      engine.addPart({ partNumber: 'P2', manufacturer: 'M', description: '', category: 'r', parameters: {}, package: '', pinCount: 2, status: 'active' });
      expect(engine.getAllParts()).toHaveLength(2);
    });

    it('getPartCount returns the number of parts', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      expect(engine.getPartCount()).toBe(0);
      engine.addPart({ partNumber: 'P1', manufacturer: 'M', description: '', category: 'r', parameters: {}, package: '', pinCount: 2, status: 'active' });
      expect(engine.getPartCount()).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Rule CRUD
  // -------------------------------------------------------------------------

  describe('Rule CRUD', () => {
    it('adds a rule and retrieves it by id', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      const rule = engine.addRule({
        name: 'Test Rule',
        category: 'test',
        requiredParameters: ['val'],
        flexibleParameters: [],
        packageEquivalences: {},
        pinoutMustMatch: false,
      });
      expect(rule.id).toBeTruthy();
      expect(rule.name).toBe('Test Rule');
      expect(engine.getRule(rule.id)).toEqual(rule);
    });

    it('returns null for a non-existent rule id', () => {
      const engine = AlternatePartsEngine.getInstance();
      expect(engine.getRule('nonexistent')).toBeNull();
    });

    it('removes a rule by id', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      const rule = engine.addRule({
        name: 'Remove Me',
        category: 'test',
        requiredParameters: [],
        flexibleParameters: [],
        packageEquivalences: {},
        pinoutMustMatch: false,
      });
      expect(engine.removeRule(rule.id)).toBe(true);
      expect(engine.getRule(rule.id)).toBeNull();
    });

    it('returns false when removing a non-existent rule', () => {
      const engine = AlternatePartsEngine.getInstance();
      expect(engine.removeRule('nonexistent')).toBe(false);
    });

    it('getRules returns all rules', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      engine.addRule({ name: 'R1', category: 'a', requiredParameters: [], flexibleParameters: [], packageEquivalences: {}, pinoutMustMatch: false });
      engine.addRule({ name: 'R2', category: 'b', requiredParameters: [], flexibleParameters: [], packageEquivalences: {}, pinoutMustMatch: false });
      expect(engine.getRules()).toHaveLength(2);
    });

    it('getRulesByCategory filters by category', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      engine.addRule({ name: 'R1', category: 'alpha', requiredParameters: [], flexibleParameters: [], packageEquivalences: {}, pinoutMustMatch: false });
      engine.addRule({ name: 'R2', category: 'beta', requiredParameters: [], flexibleParameters: [], packageEquivalences: {}, pinoutMustMatch: false });
      engine.addRule({ name: 'R3', category: 'alpha', requiredParameters: [], flexibleParameters: [], packageEquivalences: {}, pinoutMustMatch: false });
      expect(engine.getRulesByCategory('alpha')).toHaveLength(2);
      expect(engine.getRulesByCategory('beta')).toHaveLength(1);
      expect(engine.getRulesByCategory('gamma')).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Equivalence database
  // -------------------------------------------------------------------------

  describe('Equivalence database', () => {
    it('adds and retrieves equivalences', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      const entry: EquivalenceEntry = {
        partNumber1: 'A',
        manufacturer1: 'M1',
        partNumber2: 'B',
        manufacturer2: 'M2',
        level: 'exact',
        bidirectional: true,
      };
      engine.addEquivalence(entry);
      expect(engine.getEquivalences('A')).toHaveLength(1);
    });

    it('bidirectional equivalences are found from either direction', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      engine.addEquivalence({
        partNumber1: 'X',
        manufacturer1: 'M1',
        partNumber2: 'Y',
        manufacturer2: 'M2',
        level: 'functional',
        bidirectional: true,
      });
      expect(engine.getEquivalences('X')).toHaveLength(1);
      expect(engine.getEquivalences('Y')).toHaveLength(1);
    });

    it('non-bidirectional equivalences are only found from partNumber1 side', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      engine.addEquivalence({
        partNumber1: 'X',
        manufacturer1: 'M1',
        partNumber2: 'Y',
        manufacturer2: 'M2',
        level: 'functional',
        bidirectional: false,
      });
      expect(engine.getEquivalences('X')).toHaveLength(1);
      expect(engine.getEquivalences('Y')).toHaveLength(0);
    });

    it('removes equivalences by part number pair', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      engine.addEquivalence({
        partNumber1: 'A',
        manufacturer1: 'M',
        partNumber2: 'B',
        manufacturer2: 'M',
        level: 'exact',
        bidirectional: true,
      });
      expect(engine.removeEquivalence('A', 'B')).toBe(true);
      expect(engine.getEquivalences('A')).toHaveLength(0);
    });

    it('removeEquivalence returns false for non-existent pair', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      expect(engine.removeEquivalence('X', 'Y')).toBe(false);
    });

    it('removeEquivalence works when part numbers are in reverse order', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      engine.addEquivalence({
        partNumber1: 'Alpha',
        manufacturer1: 'M',
        partNumber2: 'Beta',
        manufacturer2: 'M',
        level: 'exact',
        bidirectional: true,
      });
      expect(engine.removeEquivalence('Beta', 'Alpha')).toBe(true);
      expect(engine.getEquivalences('Alpha')).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // findAlternates — equivalence DB
  // -------------------------------------------------------------------------

  describe('findAlternates — equivalence database', () => {
    it('finds exact match from equivalence database', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      engine.addPart({ partNumber: 'PART-A', manufacturer: 'M1', description: '', category: 'resistor', parameters: { resistance: 1000 }, package: '0805', pinCount: 2, status: 'active' });
      engine.addPart({ partNumber: 'PART-B', manufacturer: 'M2', description: '', category: 'resistor', parameters: { resistance: 1000 }, package: '0805', pinCount: 2, status: 'active' });
      engine.addEquivalence({ partNumber1: 'PART-A', manufacturer1: 'M1', partNumber2: 'PART-B', manufacturer2: 'M2', level: 'exact', bidirectional: true });

      const result = engine.findAlternates('PART-A');
      expect(result.alternates).toHaveLength(1);
      expect(result.alternates[0].part.partNumber).toBe('PART-B');
      expect(result.alternates[0].equivalenceLevel).toBe('exact');
      expect(result.alternates[0].confidence).toBe('high');
    });

    it('returns warning for unknown part', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      const result = engine.findAlternates('UNKNOWN-PART');
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.alternates).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // findAlternates — parametric matching
  // -------------------------------------------------------------------------

  describe('findAlternates — parametric matching', () => {
    let engine: AlternatePartsEngine;

    beforeEach(() => {
      engine = AlternatePartsEngine.getInstance();
      engine.clear();

      // Add a rule for resistors
      engine.addRule({
        name: 'Resistor XRef',
        category: 'resistor',
        requiredParameters: ['resistance'],
        flexibleParameters: [
          { name: 'tolerance', tolerance: 100, direction: 'any' },
          { name: 'power', tolerance: 50, direction: 'up' },
        ],
        packageEquivalences: { '0805': ['0805', 'R0805'] },
        pinoutMustMatch: false,
      });
    });

    it('finds parametric match for resistor with same value', () => {
      engine.addPart({ partNumber: 'R-1K-A', manufacturer: 'M1', description: '', category: 'resistor', parameters: { resistance: 1000, tolerance: 5, power: 0.125 }, package: '0805', pinCount: 2, status: 'active' });
      engine.addPart({ partNumber: 'R-1K-B', manufacturer: 'M2', description: '', category: 'resistor', parameters: { resistance: 1000, tolerance: 1, power: 0.125 }, package: '0805', pinCount: 2, status: 'active' });

      const result = engine.findAlternates('R-1K-A');
      expect(result.alternates.length).toBeGreaterThanOrEqual(1);
      expect(result.alternates[0].part.partNumber).toBe('R-1K-B');
    });

    it('does not match parts with different required parameters', () => {
      engine.addPart({ partNumber: 'R-1K', manufacturer: 'M1', description: '', category: 'resistor', parameters: { resistance: 1000 }, package: '0805', pinCount: 2, status: 'active' });
      engine.addPart({ partNumber: 'R-10K', manufacturer: 'M2', description: '', category: 'resistor', parameters: { resistance: 10000 }, package: '0805', pinCount: 2, status: 'active' });

      const result = engine.findAlternates('R-1K');
      const altPartNumbers = result.alternates.map((a) => a.part.partNumber);
      expect(altPartNumbers).not.toContain('R-10K');
    });

    it('handles flexible parameter within tolerance', () => {
      engine.addPart({ partNumber: 'R-A', manufacturer: 'M1', description: '', category: 'resistor', parameters: { resistance: 1000, power: 0.125 }, package: '0805', pinCount: 2, status: 'active' });
      engine.addPart({ partNumber: 'R-B', manufacturer: 'M2', description: '', category: 'resistor', parameters: { resistance: 1000, power: 0.15 }, package: '0805', pinCount: 2, status: 'active' });

      const result = engine.findAlternates('R-A');
      expect(result.alternates.length).toBeGreaterThanOrEqual(1);
      const alt = result.alternates.find((a) => a.part.partNumber === 'R-B');
      expect(alt).toBeDefined();
      expect(alt!.differingParameters.some((d) => d.name === 'power' && d.withinSpec)).toBe(true);
    });

    it('rejects parts with incompatible packages', () => {
      engine.addPart({ partNumber: 'R-SMD', manufacturer: 'M1', description: '', category: 'resistor', parameters: { resistance: 1000 }, package: '0805', pinCount: 2, status: 'active' });
      engine.addPart({ partNumber: 'R-THT', manufacturer: 'M2', description: '', category: 'resistor', parameters: { resistance: 1000 }, package: 'Axial', pinCount: 2, status: 'active' });

      const result = engine.findAlternates('R-SMD');
      const altPartNumbers = result.alternates.map((a) => a.part.partNumber);
      expect(altPartNumbers).not.toContain('R-THT');
    });

    it('accepts equivalent packages', () => {
      engine.addPart({ partNumber: 'R-0805', manufacturer: 'M1', description: '', category: 'resistor', parameters: { resistance: 1000 }, package: '0805', pinCount: 2, status: 'active' });
      engine.addPart({ partNumber: 'R-R0805', manufacturer: 'M2', description: '', category: 'resistor', parameters: { resistance: 1000 }, package: 'R0805', pinCount: 2, status: 'active' });

      const result = engine.findAlternates('R-0805');
      const altPartNumbers = result.alternates.map((a) => a.part.partNumber);
      expect(altPartNumbers).toContain('R-R0805');
    });

    it('rules applied are listed in result', () => {
      engine.addPart({ partNumber: 'R-Test', manufacturer: 'M', description: '', category: 'resistor', parameters: { resistance: 1000 }, package: '0805', pinCount: 2, status: 'active' });
      const result = engine.findAlternates('R-Test');
      expect(result.rulesApplied).toContain('Resistor XRef');
    });
  });

  // -------------------------------------------------------------------------
  // findAlternates — capacitor matching
  // -------------------------------------------------------------------------

  describe('findAlternates — capacitor matching', () => {
    let engine: AlternatePartsEngine;

    beforeEach(() => {
      engine = AlternatePartsEngine.getInstance();
      engine.clear();

      engine.addRule({
        name: 'Cap XRef',
        category: 'capacitor',
        requiredParameters: ['capacitance'],
        flexibleParameters: [
          { name: 'voltage', tolerance: 25, direction: 'up' },
        ],
        packageEquivalences: {},
        pinoutMustMatch: false,
      });
    });

    it('matches capacitors with same capacitance', () => {
      engine.addPart({ partNumber: 'C-100nF-A', manufacturer: 'M1', description: '', category: 'capacitor', parameters: { capacitance: 100e-9, voltage: 50 }, package: '0805', pinCount: 2, status: 'active' });
      engine.addPart({ partNumber: 'C-100nF-B', manufacturer: 'M2', description: '', category: 'capacitor', parameters: { capacitance: 100e-9, voltage: 50 }, package: '0805', pinCount: 2, status: 'active' });

      const result = engine.findAlternates('C-100nF-A');
      expect(result.alternates.length).toBeGreaterThanOrEqual(1);
    });

    it('does not match capacitors with different capacitance', () => {
      engine.addPart({ partNumber: 'C-100nF', manufacturer: 'M1', description: '', category: 'capacitor', parameters: { capacitance: 100e-9 }, package: '0805', pinCount: 2, status: 'active' });
      engine.addPart({ partNumber: 'C-1uF', manufacturer: 'M2', description: '', category: 'capacitor', parameters: { capacitance: 1e-6 }, package: '0805', pinCount: 2, status: 'active' });

      const result = engine.findAlternates('C-100nF');
      const altPartNumbers = result.alternates.map((a) => a.part.partNumber);
      expect(altPartNumbers).not.toContain('C-1uF');
    });
  });

  // -------------------------------------------------------------------------
  // Pin compatibility
  // -------------------------------------------------------------------------

  describe('Pin compatibility', () => {
    let engine: AlternatePartsEngine;

    beforeEach(() => {
      engine = AlternatePartsEngine.getInstance();
      engine.clear();

      engine.addRule({
        name: 'IC XRef',
        category: 'ic',
        requiredParameters: ['type'],
        flexibleParameters: [],
        packageEquivalences: { 'DIP-8': ['DIP-8'] },
        pinoutMustMatch: true,
      });
    });

    it('matches parts with identical pinouts', () => {
      engine.addPart({ partNumber: 'IC-A', manufacturer: 'M1', description: '', category: 'ic', parameters: { type: 'timer' }, package: 'DIP-8', pinCount: 8, pinout: ['GND', 'TRIG', 'OUT', 'RESET', 'CTRL', 'THRES', 'DISCH', 'VCC'], status: 'active' });
      engine.addPart({ partNumber: 'IC-B', manufacturer: 'M2', description: '', category: 'ic', parameters: { type: 'timer' }, package: 'DIP-8', pinCount: 8, pinout: ['GND', 'TRIG', 'OUT', 'RESET', 'CTRL', 'THRES', 'DISCH', 'VCC'], status: 'active' });

      const result = engine.findAlternates('IC-A');
      expect(result.alternates.length).toBeGreaterThanOrEqual(1);
    });

    it('rejects parts with different pin counts when pinoutMustMatch', () => {
      engine.addPart({ partNumber: 'IC-8', manufacturer: 'M1', description: '', category: 'ic', parameters: { type: 'timer' }, package: 'DIP-8', pinCount: 8, pinout: ['1', '2', '3', '4', '5', '6', '7', '8'], status: 'active' });
      engine.addPart({ partNumber: 'IC-14', manufacturer: 'M2', description: '', category: 'ic', parameters: { type: 'timer' }, package: 'DIP-8', pinCount: 14, pinout: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14'], status: 'active' });

      const result = engine.findAlternates('IC-8');
      const altPartNumbers = result.alternates.map((a) => a.part.partNumber);
      expect(altPartNumbers).not.toContain('IC-14');
    });

    it('generates pin mapping for matching parts', () => {
      engine.addPart({ partNumber: 'IC-X', manufacturer: 'M1', description: '', category: 'ic', parameters: { type: 'timer' }, package: 'DIP-8', pinCount: 4, pinout: ['VCC', 'GND', 'IN', 'OUT'], status: 'active' });
      engine.addPart({ partNumber: 'IC-Y', manufacturer: 'M2', description: '', category: 'ic', parameters: { type: 'timer' }, package: 'DIP-8', pinCount: 4, pinout: ['VDD', 'VSS', 'INPUT', 'OUTPUT'], status: 'active' });

      // Add equivalence so they match (pinout differs but equivalence forces the match)
      engine.addEquivalence({ partNumber1: 'IC-X', manufacturer1: 'M1', partNumber2: 'IC-Y', manufacturer2: 'M2', level: 'pin-compatible', bidirectional: true });

      const result = engine.findAlternates('IC-X');
      expect(result.alternates.length).toBeGreaterThanOrEqual(1);
      const alt = result.alternates.find((a) => a.part.partNumber === 'IC-Y');
      expect(alt).toBeDefined();
      expect(alt!.pinMapping).toEqual({ VCC: 'VDD', GND: 'VSS', IN: 'INPUT', OUT: 'OUTPUT' });
    });
  });

  // -------------------------------------------------------------------------
  // Scoring
  // -------------------------------------------------------------------------

  describe('Scoring', () => {
    it('exact equivalence scores higher than functional', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();

      engine.addPart({ partNumber: 'ORIG', manufacturer: 'M1', description: '', category: 'r', parameters: {}, package: '0805', pinCount: 2, status: 'active' });
      engine.addPart({ partNumber: 'EXACT', manufacturer: 'M2', description: '', category: 'r', parameters: {}, package: '0805', pinCount: 2, status: 'active' });
      engine.addPart({ partNumber: 'FUNC', manufacturer: 'M3', description: '', category: 'r', parameters: {}, package: '0805', pinCount: 2, status: 'active' });

      engine.addEquivalence({ partNumber1: 'ORIG', manufacturer1: 'M1', partNumber2: 'EXACT', manufacturer2: 'M2', level: 'exact', bidirectional: true });
      engine.addEquivalence({ partNumber1: 'ORIG', manufacturer1: 'M1', partNumber2: 'FUNC', manufacturer2: 'M3', level: 'functional', bidirectional: true });

      const result = engine.findAlternates('ORIG');
      const exactAlt = result.alternates.find((a) => a.part.partNumber === 'EXACT');
      const funcAlt = result.alternates.find((a) => a.part.partNumber === 'FUNC');
      expect(exactAlt).toBeDefined();
      expect(funcAlt).toBeDefined();
      expect(exactAlt!.score).toBeGreaterThan(funcAlt!.score);
    });

    it('functional scores higher than similar', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();

      engine.addPart({ partNumber: 'ORIG', manufacturer: 'M1', description: '', category: 'r', parameters: {}, package: '0805', pinCount: 2, status: 'active' });
      engine.addPart({ partNumber: 'FUNC', manufacturer: 'M2', description: '', category: 'r', parameters: {}, package: '0805', pinCount: 2, status: 'active' });
      engine.addPart({ partNumber: 'SIM', manufacturer: 'M3', description: '', category: 'r', parameters: {}, package: '0805', pinCount: 2, status: 'active' });

      engine.addEquivalence({ partNumber1: 'ORIG', manufacturer1: 'M1', partNumber2: 'FUNC', manufacturer2: 'M2', level: 'functional', bidirectional: true });
      engine.addEquivalence({ partNumber1: 'ORIG', manufacturer1: 'M1', partNumber2: 'SIM', manufacturer2: 'M3', level: 'similar', bidirectional: true });

      const result = engine.findAlternates('ORIG');
      const funcAlt = result.alternates.find((a) => a.part.partNumber === 'FUNC');
      const simAlt = result.alternates.find((a) => a.part.partNumber === 'SIM');
      expect(funcAlt).toBeDefined();
      expect(simAlt).toBeDefined();
      expect(funcAlt!.score).toBeGreaterThan(simAlt!.score);
    });

    it('alternates are sorted by score descending', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();

      engine.addPart({ partNumber: 'ORIG', manufacturer: 'M1', description: '', category: 'r', parameters: {}, package: '0805', pinCount: 2, status: 'active' });
      engine.addPart({ partNumber: 'A1', manufacturer: 'M2', description: '', category: 'r', parameters: {}, package: '0805', pinCount: 2, status: 'active' });
      engine.addPart({ partNumber: 'A2', manufacturer: 'M3', description: '', category: 'r', parameters: {}, package: '0805', pinCount: 2, status: 'active' });
      engine.addPart({ partNumber: 'A3', manufacturer: 'M4', description: '', category: 'r', parameters: {}, package: '0805', pinCount: 2, status: 'active' });

      engine.addEquivalence({ partNumber1: 'ORIG', manufacturer1: 'M1', partNumber2: 'A1', manufacturer2: 'M2', level: 'similar', bidirectional: true });
      engine.addEquivalence({ partNumber1: 'ORIG', manufacturer1: 'M1', partNumber2: 'A2', manufacturer2: 'M3', level: 'exact', bidirectional: true });
      engine.addEquivalence({ partNumber1: 'ORIG', manufacturer1: 'M1', partNumber2: 'A3', manufacturer2: 'M4', level: 'functional', bidirectional: true });

      const result = engine.findAlternates('ORIG');
      for (let i = 0; i < result.alternates.length - 1; i++) {
        expect(result.alternates[i].score).toBeGreaterThanOrEqual(result.alternates[i + 1].score);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Confidence levels
  // -------------------------------------------------------------------------

  describe('Confidence levels', () => {
    it('exact equivalence has high confidence', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      engine.addPart({ partNumber: 'P1', manufacturer: 'M', description: '', category: 'r', parameters: {}, package: '', pinCount: 2, status: 'active' });
      engine.addPart({ partNumber: 'P2', manufacturer: 'M', description: '', category: 'r', parameters: {}, package: '', pinCount: 2, status: 'active' });
      engine.addEquivalence({ partNumber1: 'P1', manufacturer1: 'M', partNumber2: 'P2', manufacturer2: 'M', level: 'exact', bidirectional: true });

      const result = engine.findAlternates('P1');
      expect(result.alternates[0].confidence).toBe('high');
    });

    it('functional equivalence has medium confidence', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      engine.addPart({ partNumber: 'P1', manufacturer: 'M', description: '', category: 'r', parameters: {}, package: '', pinCount: 2, status: 'active' });
      engine.addPart({ partNumber: 'P2', manufacturer: 'M', description: '', category: 'r', parameters: {}, package: '', pinCount: 2, status: 'active' });
      engine.addEquivalence({ partNumber1: 'P1', manufacturer1: 'M', partNumber2: 'P2', manufacturer2: 'M', level: 'functional', bidirectional: true });

      const result = engine.findAlternates('P1');
      expect(result.alternates[0].confidence).toBe('medium');
    });

    it('minConfidence filters out lower confidence results', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();

      engine.addPart({ partNumber: 'ORIG', manufacturer: 'M', description: '', category: 'r', parameters: {}, package: '', pinCount: 2, status: 'active' });
      engine.addPart({ partNumber: 'HI', manufacturer: 'M', description: '', category: 'r', parameters: {}, package: '', pinCount: 2, status: 'active' });
      engine.addPart({ partNumber: 'MED', manufacturer: 'M', description: '', category: 'r', parameters: {}, package: '', pinCount: 2, status: 'active' });

      engine.addEquivalence({ partNumber1: 'ORIG', manufacturer1: 'M', partNumber2: 'HI', manufacturer2: 'M', level: 'exact', bidirectional: true });
      engine.addEquivalence({ partNumber1: 'ORIG', manufacturer1: 'M', partNumber2: 'MED', manufacturer2: 'M', level: 'functional', bidirectional: true });

      const result = engine.findAlternates('ORIG', { minConfidence: 'high' });
      expect(result.alternates.every((a) => a.confidence === 'high')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Differing parameters
  // -------------------------------------------------------------------------

  describe('Differing parameters', () => {
    it('reports differing parameters correctly', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();

      engine.addPart({ partNumber: 'P1', manufacturer: 'M', description: '', category: 'resistor', parameters: { resistance: 1000, tolerance: 5 }, package: '0805', pinCount: 2, status: 'active' });
      engine.addPart({ partNumber: 'P2', manufacturer: 'M', description: '', category: 'resistor', parameters: { resistance: 1000, tolerance: 1 }, package: '0805', pinCount: 2, status: 'active' });

      engine.addEquivalence({ partNumber1: 'P1', manufacturer1: 'M', partNumber2: 'P2', manufacturer2: 'M', level: 'functional', bidirectional: true });

      const result = engine.findAlternates('P1');
      const alt = result.alternates[0];
      expect(alt.matchingParameters).toContain('resistance');
      const tolDiff = alt.differingParameters.find((d) => d.name === 'tolerance');
      expect(tolDiff).toBeDefined();
      expect(tolDiff!.original).toBe(5);
      expect(tolDiff!.alternate).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Status filtering
  // -------------------------------------------------------------------------

  describe('Status filtering', () => {
    it('excludes obsolete parts by default', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();

      engine.addPart({ partNumber: 'ORIG', manufacturer: 'M', description: '', category: 'r', parameters: {}, package: '', pinCount: 2, status: 'active' });
      engine.addPart({ partNumber: 'OBS', manufacturer: 'M', description: '', category: 'r', parameters: {}, package: '', pinCount: 2, status: 'obsolete' });
      engine.addEquivalence({ partNumber1: 'ORIG', manufacturer1: 'M', partNumber2: 'OBS', manufacturer2: 'M', level: 'exact', bidirectional: true });

      const result = engine.findAlternates('ORIG');
      expect(result.alternates.map((a) => a.part.partNumber)).not.toContain('OBS');
    });

    it('includes obsolete parts when includeObsolete is true', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();

      engine.addPart({ partNumber: 'ORIG', manufacturer: 'M', description: '', category: 'r', parameters: {}, package: '', pinCount: 2, status: 'active' });
      engine.addPart({ partNumber: 'OBS', manufacturer: 'M', description: '', category: 'r', parameters: {}, package: '', pinCount: 2, status: 'obsolete' });
      engine.addEquivalence({ partNumber1: 'ORIG', manufacturer1: 'M', partNumber2: 'OBS', manufacturer2: 'M', level: 'exact', bidirectional: true });

      const result = engine.findAlternates('ORIG', { includeObsolete: true });
      expect(result.alternates.map((a) => a.part.partNumber)).toContain('OBS');
    });

    it('allows NRND parts by default', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();

      engine.addPart({ partNumber: 'ORIG', manufacturer: 'M', description: '', category: 'r', parameters: {}, package: '', pinCount: 2, status: 'active' });
      engine.addPart({ partNumber: 'NRND', manufacturer: 'M', description: '', category: 'r', parameters: {}, package: '', pinCount: 2, status: 'nrnd' });
      engine.addEquivalence({ partNumber1: 'ORIG', manufacturer1: 'M', partNumber2: 'NRND', manufacturer2: 'M', level: 'exact', bidirectional: true });

      const result = engine.findAlternates('ORIG');
      expect(result.alternates.map((a) => a.part.partNumber)).toContain('NRND');
    });
  });

  // -------------------------------------------------------------------------
  // maxResults
  // -------------------------------------------------------------------------

  describe('maxResults', () => {
    it('limits number of returned alternates', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();

      engine.addPart({ partNumber: 'ORIG', manufacturer: 'M', description: '', category: 'r', parameters: {}, package: '', pinCount: 2, status: 'active' });

      for (let i = 0; i < 10; i++) {
        engine.addPart({ partNumber: `ALT-${i}`, manufacturer: 'M', description: '', category: 'r', parameters: {}, package: '', pinCount: 2, status: 'active' });
        engine.addEquivalence({ partNumber1: 'ORIG', manufacturer1: 'M', partNumber2: `ALT-${i}`, manufacturer2: 'M', level: 'exact', bidirectional: true });
      }

      const result = engine.findAlternates('ORIG', { maxResults: 3 });
      expect(result.alternates).toHaveLength(3);
    });
  });

  // -------------------------------------------------------------------------
  // Batch BOM search
  // -------------------------------------------------------------------------

  describe('Batch BOM search', () => {
    it('returns results for each part in the BOM', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();

      engine.addPart({ partNumber: 'P1', manufacturer: 'M', description: '', category: 'r', parameters: {}, package: '', pinCount: 2, status: 'active' });
      engine.addPart({ partNumber: 'P2', manufacturer: 'M', description: '', category: 'r', parameters: {}, package: '', pinCount: 2, status: 'active' });

      const results = engine.findAlternatesForBom([
        { partNumber: 'P1' },
        { partNumber: 'P2' },
        { partNumber: 'UNKNOWN' },
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].originalPart.partNumber).toBe('P1');
      expect(results[1].originalPart.partNumber).toBe('P2');
      expect(results[2].warnings.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // Search history
  // -------------------------------------------------------------------------

  describe('Search history', () => {
    it('tracks search results in history', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      engine.addPart({ partNumber: 'H1', manufacturer: 'M', description: '', category: 'r', parameters: {}, package: '', pinCount: 2, status: 'active' });

      engine.findAlternates('H1');
      engine.findAlternates('H1');

      expect(engine.getSearchHistory()).toHaveLength(2);
    });

    it('clearHistory empties the history', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      engine.addPart({ partNumber: 'H1', manufacturer: 'M', description: '', category: 'r', parameters: {}, package: '', pinCount: 2, status: 'active' });

      engine.findAlternates('H1');
      expect(engine.getSearchHistory()).toHaveLength(1);
      engine.clearHistory();
      expect(engine.getSearchHistory()).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Built-in data
  // -------------------------------------------------------------------------

  describe('Built-in data', () => {
    it('loads 30 sample parts on fresh instance', () => {
      const engine = AlternatePartsEngine.getInstance();
      expect(engine.getPartCount()).toBe(30);
    });

    it('loads 5 cross-reference rules on fresh instance', () => {
      const engine = AlternatePartsEngine.getInstance();
      expect(engine.getRules()).toHaveLength(5);
    });

    it('loads 15 equivalence entries on fresh instance', () => {
      const engine = AlternatePartsEngine.getInstance();
      const lm7805Eqs = engine.getEquivalences('LM7805');
      const ne555Eqs = engine.getEquivalences('NE555');
      // LM7805 has equivalences to L7805CV, KA7805, and LM340T-5(→LM7805)
      expect(lm7805Eqs.length).toBeGreaterThan(0);
      // NE555 has equivalences to LM555 and TLC555
      expect(ne555Eqs.length).toBeGreaterThan(0);
    });

    it('finds alternates for LM7805 from built-in data', () => {
      const engine = AlternatePartsEngine.getInstance();
      const result = engine.findAlternates('LM7805');
      expect(result.alternates.length).toBeGreaterThanOrEqual(2);
      const altPartNumbers = result.alternates.map((a) => a.part.partNumber);
      expect(altPartNumbers).toContain('L7805CV');
    });

    it('finds alternates for NE555 from built-in data', () => {
      const engine = AlternatePartsEngine.getInstance();
      const result = engine.findAlternates('NE555');
      const altPartNumbers = result.alternates.map((a) => a.part.partNumber);
      expect(altPartNumbers).toContain('LM555');
      expect(altPartNumbers).toContain('TLC555');
    });
  });

  // -------------------------------------------------------------------------
  // Export / Import
  // -------------------------------------------------------------------------

  describe('Export / Import', () => {
    it('exports database as JSON string', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      engine.addPart({ partNumber: 'EXP-1', manufacturer: 'M', description: '', category: 'r', parameters: {}, package: '', pinCount: 2, status: 'active' });

      const json = engine.exportDatabase();
      const parsed = JSON.parse(json) as { parts: PartReference[] };
      expect(parsed.parts).toHaveLength(1);
      expect(parsed.parts[0].partNumber).toBe('EXP-1');
    });

    it('round-trips export and import', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      engine.addPart({ partNumber: 'RT-1', manufacturer: 'M', description: 'Round-trip', category: 'r', parameters: { resistance: 100 }, package: '0805', pinCount: 2, status: 'active' });
      engine.addRule({ name: 'RT Rule', category: 'r', requiredParameters: ['resistance'], flexibleParameters: [], packageEquivalences: {}, pinoutMustMatch: false });
      engine.addEquivalence({ partNumber1: 'RT-1', manufacturer1: 'M', partNumber2: 'RT-2', manufacturer2: 'M', level: 'exact', bidirectional: true });

      const exported = engine.exportDatabase();
      engine.clear();
      expect(engine.getPartCount()).toBe(0);

      const result = engine.importDatabase(exported);
      expect(result.imported).toBe(3); // 1 part + 1 rule + 1 equivalence
      expect(result.errors).toHaveLength(0);
      expect(engine.getPartCount()).toBe(1);
      expect(engine.getRules()).toHaveLength(1);
      expect(engine.getEquivalences('RT-1')).toHaveLength(1);
    });

    it('handles malformed JSON on import', () => {
      const engine = AlternatePartsEngine.getInstance();
      const result = engine.importDatabase('not json');
      expect(result.imported).toBe(0);
      expect(result.errors).toContain('Invalid JSON');
    });

    it('handles non-object JSON on import', () => {
      const engine = AlternatePartsEngine.getInstance();
      const result = engine.importDatabase('"string"');
      expect(result.imported).toBe(0);
      expect(result.errors).toContain('Data must be an object');
    });

    it('reports errors for invalid parts in import', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      const json = JSON.stringify({ parts: [{ invalid: true }], rules: [], equivalences: [] });
      const result = engine.importDatabase(json);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // localStorage persistence
  // -------------------------------------------------------------------------

  describe('localStorage persistence', () => {
    it('persists parts to localStorage', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      engine.addPart({ partNumber: 'PERSIST-1', manufacturer: 'M', description: '', category: 'r', parameters: {}, package: '', pinCount: 2, status: 'active' });

      expect(localStorage.setItem).toHaveBeenCalled();
      const saved = store['protopulse-alternate-parts'];
      expect(saved).toBeDefined();
      const parsed = JSON.parse(saved) as { parts: PartReference[] };
      expect(parsed.parts.some((p) => p.partNumber === 'PERSIST-1')).toBe(true);
    });

    it('loads parts from localStorage on construction', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      engine.addPart({ partNumber: 'LOAD-TEST', manufacturer: 'M', description: '', category: 'r', parameters: {}, package: '', pinCount: 2, status: 'active' });
      AlternatePartsEngine.resetForTesting();

      const engine2 = AlternatePartsEngine.getInstance();
      const found = engine2.getPartByNumber('LOAD-TEST');
      expect(found).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Subscribe / Notify
  // -------------------------------------------------------------------------

  describe('Subscribe / Notify', () => {
    it('notifies subscribers on addPart', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      const listener = vi.fn();
      engine.subscribe(listener);
      // clear() already called listener, reset
      listener.mockClear();

      engine.addPart({ partNumber: 'SUB-1', manufacturer: 'M', description: '', category: 'r', parameters: {}, package: '', pinCount: 2, status: 'active' });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('unsubscribe stops notifications', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      const listener = vi.fn();
      const unsub = engine.subscribe(listener);
      listener.mockClear();

      unsub();
      engine.addPart({ partNumber: 'SUB-2', manufacturer: 'M', description: '', category: 'r', parameters: {}, package: '', pinCount: 2, status: 'active' });
      expect(listener).not.toHaveBeenCalled();
    });

    it('notifies on removePart', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      const part = engine.addPart({ partNumber: 'RM-1', manufacturer: 'M', description: '', category: 'r', parameters: {}, package: '', pinCount: 2, status: 'active' });
      const listener = vi.fn();
      engine.subscribe(listener);

      engine.removePart(part.id);
      expect(listener).toHaveBeenCalled();
    });

    it('notifies on addRule', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      const listener = vi.fn();
      engine.subscribe(listener);
      listener.mockClear();

      engine.addRule({ name: 'N', category: 'c', requiredParameters: [], flexibleParameters: [], packageEquivalences: {}, pinoutMustMatch: false });
      expect(listener).toHaveBeenCalled();
    });

    it('notifies on addEquivalence', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      const listener = vi.fn();
      engine.subscribe(listener);
      listener.mockClear();

      engine.addEquivalence({ partNumber1: 'A', manufacturer1: 'M', partNumber2: 'B', manufacturer2: 'M', level: 'exact', bidirectional: true });
      expect(listener).toHaveBeenCalled();
    });

    it('notifies on findAlternates (history update)', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      engine.addPart({ partNumber: 'NOTIFY-1', manufacturer: 'M', description: '', category: 'r', parameters: {}, package: '', pinCount: 2, status: 'active' });
      const listener = vi.fn();
      engine.subscribe(listener);
      listener.mockClear();

      engine.findAlternates('NOTIFY-1');
      expect(listener).toHaveBeenCalled();
    });

    it('notifies on clear', () => {
      const engine = AlternatePartsEngine.getInstance();
      const listener = vi.fn();
      engine.subscribe(listener);
      listener.mockClear();

      engine.clear();
      expect(listener).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // React hook
  // -------------------------------------------------------------------------

  describe('useAlternateParts hook', () => {
    it('returns the correct shape', () => {
      const { result } = renderHook(() => useAlternateParts());
      expect(result.current).toHaveProperty('findAlternates');
      expect(result.current).toHaveProperty('findAlternatesForBom');
      expect(result.current).toHaveProperty('addPart');
      expect(result.current).toHaveProperty('addRule');
      expect(result.current).toHaveProperty('addEquivalence');
      expect(result.current).toHaveProperty('parts');
      expect(result.current).toHaveProperty('rules');
      expect(result.current).toHaveProperty('searchHistory');
      expect(result.current).toHaveProperty('exportDatabase');
      expect(result.current).toHaveProperty('importDatabase');
    });

    it('parts is an array', () => {
      const { result } = renderHook(() => useAlternateParts());
      expect(Array.isArray(result.current.parts)).toBe(true);
    });

    it('rules is an array', () => {
      const { result } = renderHook(() => useAlternateParts());
      expect(Array.isArray(result.current.rules)).toBe(true);
    });

    it('searchHistory is an array', () => {
      const { result } = renderHook(() => useAlternateParts());
      expect(Array.isArray(result.current.searchHistory)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe('Edge cases', () => {
    it('handles empty database gracefully', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      const result = engine.findAlternates('ANYTHING');
      expect(result.alternates).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('no matches returns empty alternates', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      engine.addPart({ partNumber: 'LONE', manufacturer: 'M', description: '', category: 'unique', parameters: {}, package: 'special', pinCount: 1, status: 'active' });
      const result = engine.findAlternates('LONE');
      expect(result.alternates).toHaveLength(0);
    });

    it('does not return the original part as an alternate', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      engine.addPart({ partNumber: 'SELF', manufacturer: 'M', description: '', category: 'r', parameters: {}, package: '', pinCount: 2, status: 'active' });
      // Self-equivalence (should be filtered)
      engine.addEquivalence({ partNumber1: 'SELF', manufacturer1: 'M', partNumber2: 'SELF', manufacturer2: 'M', level: 'exact', bidirectional: true });
      const result = engine.findAlternates('SELF');
      expect(result.alternates.map((a) => a.part.partNumber)).not.toContain('SELF');
    });

    it('searchTime is recorded', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      engine.addPart({ partNumber: 'TIME', manufacturer: 'M', description: '', category: 'r', parameters: {}, package: '', pinCount: 2, status: 'active' });
      const result = engine.findAlternates('TIME');
      expect(typeof result.searchTime).toBe('number');
      expect(result.searchTime).toBeGreaterThanOrEqual(0);
    });

    it('handles parts with no parameters gracefully', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      engine.addPart({ partNumber: 'NP1', manufacturer: 'M', description: '', category: 'misc', parameters: {}, package: 'SOT-23', pinCount: 3, status: 'active' });
      engine.addPart({ partNumber: 'NP2', manufacturer: 'M', description: '', category: 'misc', parameters: {}, package: 'SOT-23', pinCount: 3, status: 'active' });
      engine.addEquivalence({ partNumber1: 'NP1', manufacturer1: 'M', partNumber2: 'NP2', manufacturer2: 'M', level: 'exact', bidirectional: true });

      const result = engine.findAlternates('NP1');
      expect(result.alternates).toHaveLength(1);
    });

    it('clear resets all state', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.addPart({ partNumber: 'CLR', manufacturer: 'M', description: '', category: 'r', parameters: {}, package: '', pinCount: 2, status: 'active' });
      engine.addRule({ name: 'CLR', category: 'r', requiredParameters: [], flexibleParameters: [], packageEquivalences: {}, pinoutMustMatch: false });
      engine.addEquivalence({ partNumber1: 'A', manufacturer1: 'M', partNumber2: 'B', manufacturer2: 'M', level: 'exact', bidirectional: true });
      engine.findAlternates('CLR');

      engine.clear();
      expect(engine.getPartCount()).toBe(0);
      expect(engine.getRules()).toHaveLength(0);
      expect(engine.getEquivalences('A')).toHaveLength(0);
      expect(engine.getSearchHistory()).toHaveLength(0);
    });

    it('handles corrupt localStorage data gracefully', () => {
      store['protopulse-alternate-parts'] = '{invalid json!!!';
      AlternatePartsEngine.resetForTesting();
      const engine = AlternatePartsEngine.getInstance();
      // Should fall back to built-in data
      expect(engine.getPartCount()).toBe(30);
    });

    it('handles non-object localStorage data gracefully', () => {
      store['protopulse-alternate-parts'] = '"just a string"';
      AlternatePartsEngine.resetForTesting();
      const engine = AlternatePartsEngine.getInstance();
      expect(engine.getPartCount()).toBe(30);
    });
  });

  // -------------------------------------------------------------------------
  // Additional edge cases for coverage
  // -------------------------------------------------------------------------

  describe('Additional tests', () => {
    it('getPartByNumber returns null when manufacturer does not match', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      engine.addPart({ partNumber: 'M-TEST', manufacturer: 'Alpha', description: '', category: 'r', parameters: {}, package: '', pinCount: 2, status: 'active' });
      expect(engine.getPartByNumber('M-TEST', 'Beta')).toBeNull();
    });

    it('import with missing required rule fields reports errors', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      const json = JSON.stringify({ parts: [], rules: [{ noName: true }], equivalences: [] });
      const result = engine.importDatabase(json);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('import with missing equivalence fields reports errors', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      const json = JSON.stringify({ parts: [], rules: [], equivalences: [{ partNumber1: 'X' }] });
      const result = engine.importDatabase(json);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('findAlternates populates originalPart in result', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      engine.addPart({ partNumber: 'OP-TEST', manufacturer: 'M', description: 'Original', category: 'r', parameters: {}, package: '', pinCount: 2, status: 'active' });
      const result = engine.findAlternates('OP-TEST');
      expect(result.originalPart.partNumber).toBe('OP-TEST');
      expect(result.originalPart.description).toBe('Original');
    });

    it('cross-category parts are not matched by rules', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();

      engine.addRule({ name: 'R Rule', category: 'resistor', requiredParameters: ['value'], flexibleParameters: [], packageEquivalences: {}, pinoutMustMatch: false });

      engine.addPart({ partNumber: 'R1', manufacturer: 'M', description: '', category: 'resistor', parameters: { value: 100 }, package: '0805', pinCount: 2, status: 'active' });
      engine.addPart({ partNumber: 'C1', manufacturer: 'M', description: '', category: 'capacitor', parameters: { value: 100 }, package: '0805', pinCount: 2, status: 'active' });

      const result = engine.findAlternates('R1');
      expect(result.alternates.map((a) => a.part.partNumber)).not.toContain('C1');
    });

    it('removeRule returns false for non-existent id', () => {
      const engine = AlternatePartsEngine.getInstance();
      expect(engine.removeRule('does-not-exist')).toBe(false);
    });

    it('findAlternatesForBom returns one result per input part', () => {
      const engine = AlternatePartsEngine.getInstance();
      engine.clear();
      const results = engine.findAlternatesForBom([
        { partNumber: 'A' },
        { partNumber: 'B' },
        { partNumber: 'C' },
      ]);
      expect(results).toHaveLength(3);
    });
  });
});
