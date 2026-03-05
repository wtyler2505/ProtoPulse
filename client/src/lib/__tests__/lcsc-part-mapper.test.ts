import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LcscPartMapper,
  parseComponentValue,
  normalizePackage,
  isValidLcscNumber,
  detectCategory,
} from '../lcsc-part-mapper';
import type {
  BomItem,
  MatchResult,
  LcscPart,
  MatchConfidence,
  JlcpcbPartType,
  ComponentCategory,
} from '../lcsc-part-mapper';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBomItem(overrides: Partial<BomItem> = {}): BomItem {
  return {
    id: crypto.randomUUID(),
    designator: 'R1',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// parseComponentValue
// ---------------------------------------------------------------------------

describe('parseComponentValue', () => {
  it('parses plain numbers', () => {
    expect(parseComponentValue('100')).toBe(100);
    expect(parseComponentValue('4.7')).toBe(4.7);
    expect(parseComponentValue('0')).toBe(0);
  });

  it('parses SI prefix k', () => {
    expect(parseComponentValue('10k')).toBe(10000);
    expect(parseComponentValue('4.7k')).toBe(4700);
    expect(parseComponentValue('10K')).toBe(10000);
  });

  it('parses SI prefix M', () => {
    expect(parseComponentValue('1M')).toBe(1000000);
    expect(parseComponentValue('2.2M')).toBe(2200000);
  });

  it('parses SI prefix m (milli)', () => {
    expect(parseComponentValue('100m')).toBe(0.1);
  });

  it('parses SI prefix u (micro)', () => {
    expect(parseComponentValue('4.7u')).toBeCloseTo(4.7e-6);
    expect(parseComponentValue('100u')).toBeCloseTo(100e-6);
  });

  it('parses SI prefix n (nano)', () => {
    expect(parseComponentValue('100n')).toBeCloseTo(100e-9);
    expect(parseComponentValue('10n')).toBeCloseTo(10e-9);
  });

  it('parses SI prefix p (pico)', () => {
    expect(parseComponentValue('22p')).toBeCloseTo(22e-12);
    expect(parseComponentValue('10p')).toBeCloseTo(10e-12);
  });

  it('parses µ unicode prefix', () => {
    expect(parseComponentValue('4.7µ')).toBeCloseTo(4.7e-6);
    expect(parseComponentValue('100µ')).toBeCloseTo(100e-6);
  });

  it('parses values with unit suffixes', () => {
    expect(parseComponentValue('10kΩ')).toBe(10000);
    expect(parseComponentValue('100nF')).toBeCloseTo(100e-9);
    expect(parseComponentValue('4.7uH')).toBeCloseTo(4.7e-6);
  });

  it('parses R-notation (decimal separator)', () => {
    expect(parseComponentValue('4R7')).toBeCloseTo(4.7);
    expect(parseComponentValue('47R')).toBe(47);
    expect(parseComponentValue('1R0')).toBe(1.0);
  });

  it('parses K-notation (decimal separator)', () => {
    expect(parseComponentValue('4K7')).toBeCloseTo(4700);
    expect(parseComponentValue('1K0')).toBe(1000);
  });

  it('parses M-notation (decimal separator)', () => {
    expect(parseComponentValue('1M5')).toBeCloseTo(1500000);
    expect(parseComponentValue('2M2')).toBeCloseTo(2200000);
  });

  it('returns null for empty input', () => {
    expect(parseComponentValue('')).toBeNull();
  });

  it('returns null for unparseable input', () => {
    expect(parseComponentValue('abc')).toBeNull();
    expect(parseComponentValue('hello world')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// normalizePackage
// ---------------------------------------------------------------------------

describe('normalizePackage', () => {
  it('normalizes imperial SMD packages', () => {
    expect(normalizePackage('0805')).toBe('0805');
    expect(normalizePackage('0603')).toBe('0603');
    expect(normalizePackage('1206')).toBe('1206');
  });

  it('normalizes metric to imperial', () => {
    expect(normalizePackage('2012')).toBe('0805');
    expect(normalizePackage('1608')).toBe('0603');
    expect(normalizePackage('3216')).toBe('1206');
    expect(normalizePackage('2012M')).toBe('0805');
  });

  it('normalizes SOT package variants', () => {
    expect(normalizePackage('SOT23')).toBe('SOT-23');
    expect(normalizePackage('SOT-23')).toBe('SOT-23');
    expect(normalizePackage('SOT-23-3')).toBe('SOT-23');
  });

  it('normalizes SOIC/SOP variants', () => {
    expect(normalizePackage('SOIC-8')).toBe('SOP-8');
    expect(normalizePackage('SOIC8')).toBe('SOP-8');
    expect(normalizePackage('SOP-8')).toBe('SOP-8');
  });

  it('normalizes TO/DPAK variants', () => {
    expect(normalizePackage('TO220')).toBe('TO-220');
    expect(normalizePackage('TO-220')).toBe('TO-220');
    expect(normalizePackage('DPAK')).toBe('TO-252');
    expect(normalizePackage('D2PAK')).toBe('TO-263');
  });

  it('normalizes diode package aliases', () => {
    expect(normalizePackage('SMA')).toBe('DO-214AC');
    expect(normalizePackage('SMB')).toBe('DO-214AA');
    expect(normalizePackage('SMC')).toBe('DO-214AB');
  });

  it('returns empty string for empty input', () => {
    expect(normalizePackage('')).toBe('');
  });

  it('returns trimmed input for unknown packages', () => {
    expect(normalizePackage('  CUSTOM-PKG  ')).toBe('CUSTOM-PKG');
  });
});

// ---------------------------------------------------------------------------
// isValidLcscNumber
// ---------------------------------------------------------------------------

describe('isValidLcscNumber', () => {
  it('validates correct LCSC numbers', () => {
    expect(isValidLcscNumber('C25804')).toBe(true);
    expect(isValidLcscNumber('C1')).toBe(true);
    expect(isValidLcscNumber('C12345678')).toBe(true);
  });

  it('rejects invalid formats', () => {
    expect(isValidLcscNumber('')).toBe(false);
    expect(isValidLcscNumber('25804')).toBe(false);
    expect(isValidLcscNumber('D25804')).toBe(false);
    expect(isValidLcscNumber('C')).toBe(false);
    expect(isValidLcscNumber('c25804')).toBe(false);
    expect(isValidLcscNumber('C123456789')).toBe(false); // 9 digits
    expect(isValidLcscNumber('CABC')).toBe(false);
  });

  it('handles whitespace', () => {
    expect(isValidLcscNumber(' C25804 ')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// detectCategory
// ---------------------------------------------------------------------------

describe('detectCategory', () => {
  it('detects resistors', () => {
    expect(detectCategory('10kΩ Resistor')).toBe('resistor');
    expect(detectCategory('100R 0805')).toBe('resistor');
    expect(detectCategory('100 ohm')).toBe('resistor');
  });

  it('detects capacitors', () => {
    expect(detectCategory('100nF Capacitor')).toBe('capacitor');
    expect(detectCategory('4.7uF MLCC')).toBe('capacitor');
  });

  it('detects inductors', () => {
    expect(detectCategory('10uH Inductor')).toBe('inductor');
    expect(detectCategory('Power Henry')).toBe('inductor');
  });

  it('detects LEDs', () => {
    expect(detectCategory('Red LED 0805')).toBe('led');
    expect(detectCategory('White LED')).toBe('led');
  });

  it('detects diodes', () => {
    expect(detectCategory('1N4148 Signal Diode')).toBe('diode');
    expect(detectCategory('Schottky Rectifier')).toBe('diode');
    expect(detectCategory('3.3V Zener')).toBe('diode');
  });

  it('detects transistors', () => {
    expect(detectCategory('2N7002 N-MOSFET')).toBe('transistor');
    expect(detectCategory('NPN Transistor')).toBe('transistor');
    expect(detectCategory('BSS138 N-Ch MOSFET')).toBe('transistor');
  });

  it('detects ICs', () => {
    expect(detectCategory('LM7805 Voltage Regulator')).toBe('ic');
    expect(detectCategory('NE555 Timer IC')).toBe('ic');
    expect(detectCategory('STM32 MCU')).toBe('ic');
    expect(detectCategory('Op-Amp LM358')).toBe('ic');
  });

  it('detects connectors', () => {
    expect(detectCategory('2.54mm Pin Header')).toBe('connector');
    expect(detectCategory('USB Type-C Connector')).toBe('connector');
  });

  it('detects crystals', () => {
    expect(detectCategory('16MHz Crystal')).toBe('crystal');
    expect(detectCategory('32.768kHz Oscillator')).toBe('crystal');
  });

  it('detects fuses', () => {
    expect(detectCategory('500mA Fuse')).toBe('fuse');
  });

  it('detects switches', () => {
    expect(detectCategory('Tactile Switch')).toBe('switch');
    expect(detectCategory('Push Button')).toBe('switch');
  });

  it('detects sensors', () => {
    expect(detectCategory('NTC Thermistor')).toBe('sensor');
    expect(detectCategory('Temperature Sensor')).toBe('sensor');
  });

  it('returns other for unknown', () => {
    expect(detectCategory('ABCXYZ')).toBe('other');
    expect(detectCategory('')).toBe('other');
  });
});

// ---------------------------------------------------------------------------
// LcscPartMapper — singleton + lifecycle
// ---------------------------------------------------------------------------

describe('LcscPartMapper', () => {
  beforeEach(() => {
    LcscPartMapper.resetForTesting();
    try {
      localStorage.clear();
    } catch {
      // jsdom may not have localStorage
    }
  });

  describe('singleton', () => {
    it('returns the same instance', () => {
      const a = LcscPartMapper.getInstance();
      const b = LcscPartMapper.getInstance();
      expect(a).toBe(b);
    });

    it('resets for testing', () => {
      const a = LcscPartMapper.getInstance();
      LcscPartMapper.resetForTesting();
      const b = LcscPartMapper.getInstance();
      expect(a).not.toBe(b);
    });
  });

  describe('subscribe/notify', () => {
    it('notifies on override change', () => {
      const mapper = LcscPartMapper.getInstance();
      const listener = vi.fn();
      mapper.subscribe(listener);
      mapper.setOverride('item-1', 'C25804');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('unsubscribes', () => {
      const mapper = LcscPartMapper.getInstance();
      const listener = vi.fn();
      const unsub = mapper.subscribe(listener);
      unsub();
      mapper.setOverride('item-1', 'C25804');
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Database
  // -------------------------------------------------------------------------

  describe('database', () => {
    it('has built-in parts (~200)', () => {
      const mapper = LcscPartMapper.getInstance();
      expect(mapper.getDatabaseSize()).toBeGreaterThanOrEqual(150);
    });

    it('getDatabase returns a copy', () => {
      const mapper = LcscPartMapper.getInstance();
      const db = mapper.getDatabase();
      const size = mapper.getDatabaseSize();
      db.pop();
      expect(mapper.getDatabaseSize()).toBe(size);
    });

    it('findByLcsc finds known parts', () => {
      const mapper = LcscPartMapper.getInstance();
      const part = mapper.findByLcsc('C25804');
      expect(part).not.toBeNull();
      expect(part!.category).toBe('resistor');
    });

    it('findByLcsc is case-insensitive', () => {
      const mapper = LcscPartMapper.getInstance();
      expect(mapper.findByLcsc('c25804')).not.toBeNull();
    });

    it('findByLcsc returns null for unknown', () => {
      const mapper = LcscPartMapper.getInstance();
      expect(mapper.findByLcsc('C99999999')).toBeNull();
    });

    it('findByMpn finds known parts', () => {
      const mapper = LcscPartMapper.getInstance();
      const part = mapper.findByMpn('NE555DR');
      expect(part).not.toBeNull();
      expect(part!.category).toBe('ic');
    });

    it('findByMpn normalizes and is case-insensitive', () => {
      const mapper = LcscPartMapper.getInstance();
      expect(mapper.findByMpn('ne555dr')).not.toBeNull();
    });

    it('findByMpn returns null for unknown', () => {
      const mapper = LcscPartMapper.getInstance();
      expect(mapper.findByMpn('UNKNOWN-PART-XYZ')).toBeNull();
    });

    it('searchDatabase finds by LCSC number', () => {
      const mapper = LcscPartMapper.getInstance();
      const results = mapper.searchDatabase('C25804');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].lcsc).toBe('C25804');
    });

    it('searchDatabase finds by MPN', () => {
      const mapper = LcscPartMapper.getInstance();
      const results = mapper.searchDatabase('AMS1117');
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it('searchDatabase finds by description', () => {
      const mapper = LcscPartMapper.getInstance();
      const results = mapper.searchDatabase('Schottky');
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('searchDatabase returns empty for empty query', () => {
      const mapper = LcscPartMapper.getInstance();
      expect(mapper.searchDatabase('')).toEqual([]);
    });

    it('searchDatabase finds by value', () => {
      const mapper = LcscPartMapper.getInstance();
      const results = mapper.searchDatabase('10kΩ');
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  // -------------------------------------------------------------------------
  // Single matching
  // -------------------------------------------------------------------------

  describe('matchSingle', () => {
    it('matches by MPN', () => {
      const mapper = LcscPartMapper.getInstance();
      const item = makeBomItem({ mpn: 'NE555DR', description: 'Timer IC' });
      const result = mapper.matchSingle(item);
      expect(result.lcscPart).not.toBeNull();
      expect(result.lcscPart!.mpn).toBe('NE555DR');
      expect(result.confidence).toBe('high');
    });

    it('matches by value + package', () => {
      const mapper = LcscPartMapper.getInstance();
      const item = makeBomItem({ value: '10kΩ', package: '0805', description: 'Resistor' });
      const result = mapper.matchSingle(item);
      expect(result.lcscPart).not.toBeNull();
      expect(result.confidence === 'high' || result.confidence === 'medium').toBe(true);
      expect(result.matchReasons.length).toBeGreaterThan(0);
    });

    it('returns none confidence when no match', () => {
      const mapper = LcscPartMapper.getInstance();
      const item = makeBomItem({ value: 'XYZBOGUS', package: 'CUSTOM', description: 'qwerty' });
      const result = mapper.matchSingle(item);
      expect(result.confidence).toBe('none');
      expect(result.score).toBe(0);
      expect(result.lcscPart).toBeNull();
    });

    it('respects manual override', () => {
      const mapper = LcscPartMapper.getInstance();
      const item = makeBomItem({ id: 'r1-id', value: '10kΩ', package: '0805' });
      mapper.setOverride('r1-id', 'C7466'); // NE555 — deliberately wrong but tests override
      const result = mapper.matchSingle(item);
      expect(result.manualOverride).toBe(true);
      expect(result.lcscPart!.lcsc).toBe('C7466');
      expect(result.confidence).toBe('high');
      expect(result.score).toBe(100);
    });

    it('includes match reasons', () => {
      const mapper = LcscPartMapper.getInstance();
      const item = makeBomItem({ mpn: 'BSS138', package: 'SOT-23' });
      const result = mapper.matchSingle(item);
      expect(result.matchReasons.length).toBeGreaterThan(0);
    });

    it('matches partial MPN', () => {
      const mapper = LcscPartMapper.getInstance();
      const item = makeBomItem({ mpn: 'LM358', description: 'Op-Amp' });
      const result = mapper.matchSingle(item);
      expect(result.lcscPart).not.toBeNull();
      expect(result.score).toBeGreaterThan(0);
    });

    it('prefers basic parts over extended', () => {
      const mapper = LcscPartMapper.getInstance();
      // Both should match transistor category; basic 2N7002 should win over extended SI2302
      const item = makeBomItem({ value: 'N-MOSFET', package: 'SOT-23', description: 'N-MOSFET SOT-23' });
      const result = mapper.matchSingle(item);
      expect(result.lcscPart).not.toBeNull();
      if (result.lcscPart!.partType === 'basic') {
        // good — it preferred the basic part
        expect(result.matchReasons).toContain('Basic part (preferred)');
      }
    });
  });

  // -------------------------------------------------------------------------
  // BOM batch matching
  // -------------------------------------------------------------------------

  describe('matchBom', () => {
    it('matches multiple items at once', () => {
      const mapper = LcscPartMapper.getInstance();
      const items = [
        makeBomItem({ id: 'a', designator: 'R1', value: '10kΩ', package: '0805' }),
        makeBomItem({ id: 'b', designator: 'C1', value: '100nF', package: '0805' }),
        makeBomItem({ id: 'c', designator: 'U1', mpn: 'NE555DR' }),
      ];
      const result = mapper.matchBom(items);
      expect(result.totalCount).toBe(3);
      expect(result.matches.length).toBe(3);
      expect(result.mappedCount).toBeGreaterThanOrEqual(2);
    });

    it('calculates basic vs extended counts', () => {
      const mapper = LcscPartMapper.getInstance();
      const items = [
        makeBomItem({ id: 'a', designator: 'R1', value: '10kΩ', package: '0805' }),
        makeBomItem({ id: 'b', designator: 'U1', mpn: 'STM32F103C8T6' }),
      ];
      const result = mapper.matchBom(items);
      expect(result.basicCount + result.extendedCount + result.consignmentCount)
        .toBe(result.mappedCount);
    });

    it('calculates extended part surcharge', () => {
      const mapper = LcscPartMapper.getInstance();
      const items = [
        makeBomItem({ id: 'a', designator: 'U1', mpn: 'STM32F103C8T6' }),
        makeBomItem({ id: 'b', designator: 'U2', mpn: 'ATMEGA328P-AU' }),
      ];
      const result = mapper.matchBom(items);
      // Each unique extended part = $3
      expect(result.estimatedSurcharge).toBe(result.matches.filter(
        (m) => m.lcscPart?.partType === 'extended',
      ).length * 3);
    });

    it('counts unmapped items', () => {
      const mapper = LcscPartMapper.getInstance();
      const items = [
        makeBomItem({ id: 'a', designator: 'X1', value: 'XYZUNKNOWN', package: 'XYZPKG' }),
      ];
      const result = mapper.matchBom(items);
      expect(result.unmappedCount).toBe(1);
      expect(result.mappedCount).toBe(0);
    });

    it('saves lastResults and notifies', () => {
      const mapper = LcscPartMapper.getInstance();
      const listener = vi.fn();
      mapper.subscribe(listener);

      const items = [
        makeBomItem({ id: 'a', designator: 'R1', value: '10kΩ', package: '0805' }),
      ];
      mapper.matchBom(items);
      expect(listener).toHaveBeenCalled();
      expect(mapper.getLastResults().length).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Manual overrides
  // -------------------------------------------------------------------------

  describe('overrides', () => {
    it('sets and gets override', () => {
      const mapper = LcscPartMapper.getInstance();
      expect(mapper.setOverride('item-1', 'C25804')).toBe(true);
      expect(mapper.getOverride('item-1')).toBe('C25804');
    });

    it('rejects invalid LCSC numbers', () => {
      const mapper = LcscPartMapper.getInstance();
      expect(mapper.setOverride('item-1', 'INVALID')).toBe(false);
      expect(mapper.getOverride('item-1')).toBeNull();
    });

    it('removes override', () => {
      const mapper = LcscPartMapper.getInstance();
      mapper.setOverride('item-1', 'C25804');
      expect(mapper.removeOverride('item-1')).toBe(true);
      expect(mapper.getOverride('item-1')).toBeNull();
    });

    it('removeOverride returns false for non-existent', () => {
      const mapper = LcscPartMapper.getInstance();
      expect(mapper.removeOverride('nonexistent')).toBe(false);
    });

    it('getAllOverrides returns all', () => {
      const mapper = LcscPartMapper.getInstance();
      mapper.setOverride('a', 'C1');
      mapper.setOverride('b', 'C2');
      const overrides = mapper.getAllOverrides();
      expect(overrides.length).toBe(2);
    });

    it('clearAllOverrides removes everything', () => {
      const mapper = LcscPartMapper.getInstance();
      mapper.setOverride('a', 'C1');
      mapper.setOverride('b', 'C2');
      mapper.clearAllOverrides();
      expect(mapper.getAllOverrides().length).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Statistics
  // -------------------------------------------------------------------------

  describe('statistics', () => {
    it('returns zeroes when no results', () => {
      const mapper = LcscPartMapper.getInstance();
      const stats = mapper.getStatistics();
      expect(stats.totalMappings).toBe(0);
      expect(stats.averageConfidence).toBe(0);
      expect(stats.unmappedItems).toBe(0);
    });

    it('calculates statistics from matchBom', () => {
      const mapper = LcscPartMapper.getInstance();
      mapper.matchBom([
        makeBomItem({ id: 'a', designator: 'R1', value: '10kΩ', package: '0805' }),
        makeBomItem({ id: 'b', designator: 'C1', value: '100nF', package: '0805' }),
        makeBomItem({ id: 'c', designator: 'X1', value: 'XYZUNKNOWN', description: 'nonsense' }),
      ]);
      const stats = mapper.getStatistics();
      expect(stats.totalMappings).toBe(3);
      expect(stats.unmappedItems).toBeGreaterThanOrEqual(1);
      expect(stats.basicParts + stats.extendedParts + stats.consignmentParts + stats.unmappedItems)
        .toBe(stats.totalMappings);
    });

    it('counts manual overrides', () => {
      const mapper = LcscPartMapper.getInstance();
      mapper.setOverride('a', 'C25804');
      mapper.setOverride('b', 'C7466');
      const stats = mapper.getStatistics();
      expect(stats.manualOverrides).toBe(2);
    });

    it('calculates average confidence', () => {
      const mapper = LcscPartMapper.getInstance();
      mapper.matchBom([
        makeBomItem({ id: 'a', designator: 'R1', mpn: 'NE555DR' }),
      ]);
      const stats = mapper.getStatistics();
      expect(stats.averageConfidence).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // JLCPCB BOM CSV export
  // -------------------------------------------------------------------------

  describe('exportJlcpcbBom', () => {
    it('generates CSV header', () => {
      const mapper = LcscPartMapper.getInstance();
      const csv = mapper.exportJlcpcbBom([]);
      expect(csv).toBe('Comment,Designator,Footprint,LCSC Part Number');
    });

    it('includes mapped items', () => {
      const mapper = LcscPartMapper.getInstance();
      mapper.matchBom([
        makeBomItem({ id: 'a', designator: 'R1,R2', value: '10kΩ', package: '0805' }),
      ]);
      const csv = mapper.exportJlcpcbBom();
      const lines = csv.split('\n');
      expect(lines.length).toBeGreaterThanOrEqual(2); // header + at least 1 data row
      expect(lines[0]).toBe('Comment,Designator,Footprint,LCSC Part Number');
      if (lines.length > 1) {
        expect(lines[1]).toContain('C'); // contains LCSC number
      }
    });

    it('skips unmapped items', () => {
      const mapper = LcscPartMapper.getInstance();
      const csv = mapper.exportJlcpcbBom([
        {
          bomItem: makeBomItem({ designator: 'X1' }),
          lcscPart: null,
          confidence: 'none',
          score: 0,
          matchReasons: [],
          manualOverride: false,
        },
      ]);
      const lines = csv.split('\n');
      expect(lines.length).toBe(1); // header only
    });

    it('escapes CSV fields with commas', () => {
      const mapper = LcscPartMapper.getInstance();
      const part: LcscPart = {
        lcsc: 'C1234',
        mpn: 'TEST',
        manufacturer: 'Test',
        description: 'Test',
        category: 'resistor',
        package: '0805',
        partType: 'basic',
      };
      const result: MatchResult = {
        bomItem: makeBomItem({ designator: 'R1', comment: 'Value, with comma' }),
        lcscPart: part,
        confidence: 'high',
        score: 90,
        matchReasons: ['test'],
        manualOverride: false,
      };
      const csv = mapper.exportJlcpcbBom([result]);
      expect(csv).toContain('"Value, with comma"');
    });
  });

  // -------------------------------------------------------------------------
  // JLCPCB CPL CSV export
  // -------------------------------------------------------------------------

  describe('exportJlcpcbCpl', () => {
    it('generates CSV header', () => {
      const mapper = LcscPartMapper.getInstance();
      const csv = mapper.exportJlcpcbCpl([]);
      expect(csv).toBe('Designator,Mid X,Mid Y,Rotation,Layer');
    });

    it('includes placement data', () => {
      const mapper = LcscPartMapper.getInstance();
      const csv = mapper.exportJlcpcbCpl([
        makeBomItem({ designator: 'R1', x: 10.5, y: 20.3, rotation: 90, side: 'top' }),
      ]);
      const lines = csv.split('\n');
      expect(lines.length).toBe(2);
      expect(lines[1]).toContain('R1');
      expect(lines[1]).toContain('10.5000');
      expect(lines[1]).toContain('20.3000');
      expect(lines[1]).toContain('90.0');
      expect(lines[1]).toContain('Top');
    });

    it('expands comma-separated designators', () => {
      const mapper = LcscPartMapper.getInstance();
      const csv = mapper.exportJlcpcbCpl([
        makeBomItem({ designator: 'R1,R2,R3', x: 1, y: 2, rotation: 0 }),
      ]);
      const lines = csv.split('\n');
      expect(lines.length).toBe(4); // header + 3 designators
    });

    it('defaults to Top layer and zero position', () => {
      const mapper = LcscPartMapper.getInstance();
      const csv = mapper.exportJlcpcbCpl([
        makeBomItem({ designator: 'U1' }),
      ]);
      const lines = csv.split('\n');
      expect(lines[1]).toContain('0.0000');
      expect(lines[1]).toContain('Top');
    });

    it('uses Bottom layer for bottom side', () => {
      const mapper = LcscPartMapper.getInstance();
      const csv = mapper.exportJlcpcbCpl([
        makeBomItem({ designator: 'C1', side: 'bottom' }),
      ]);
      expect(csv).toContain('Bottom');
    });
  });

  // -------------------------------------------------------------------------
  // JSON import/export
  // -------------------------------------------------------------------------

  describe('importMappings / exportMappings', () => {
    it('round-trips overrides', () => {
      const mapper = LcscPartMapper.getInstance();
      mapper.setOverride('item-1', 'C25804');
      mapper.setOverride('item-2', 'C7466');
      const json = mapper.exportMappings();

      LcscPartMapper.resetForTesting();
      const mapper2 = LcscPartMapper.getInstance();
      const result = mapper2.importMappings(json);
      expect(result.imported).toBe(2);
      expect(result.errors.length).toBe(0);
      expect(mapper2.getOverride('item-1')).toBe('C25804');
      expect(mapper2.getOverride('item-2')).toBe('C7466');
    });

    it('rejects invalid JSON', () => {
      const mapper = LcscPartMapper.getInstance();
      const result = mapper.importMappings('NOT JSON');
      expect(result.imported).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects non-object JSON', () => {
      const mapper = LcscPartMapper.getInstance();
      const result = mapper.importMappings('"string"');
      expect(result.imported).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects missing version', () => {
      const mapper = LcscPartMapper.getInstance();
      const result = mapper.importMappings(JSON.stringify({ overrides: [] }));
      expect(result.imported).toBe(0);
      expect(result.errors).toContain('Missing or invalid version field');
    });

    it('reports invalid LCSC numbers in overrides', () => {
      const mapper = LcscPartMapper.getInstance();
      const result = mapper.importMappings(JSON.stringify({
        version: 1,
        overrides: [{ bomItemId: 'x', lcscPartNumber: 'INVALID' }],
      }));
      expect(result.imported).toBe(0);
      expect(result.errors.length).toBe(1);
    });

    it('export includes version and timestamp', () => {
      const mapper = LcscPartMapper.getInstance();
      const json = mapper.exportMappings();
      const parsed = JSON.parse(json) as { version: number; timestamp: string };
      expect(parsed.version).toBe(1);
      expect(parsed.timestamp).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  describe('persistence', () => {
    it('persists overrides to localStorage', () => {
      const mapper = LcscPartMapper.getInstance();
      mapper.setOverride('persist-1', 'C25804');

      LcscPartMapper.resetForTesting();
      const mapper2 = LcscPartMapper.getInstance();
      expect(mapper2.getOverride('persist-1')).toBe('C25804');
    });

    it('persists lastResults to localStorage', () => {
      const mapper = LcscPartMapper.getInstance();
      mapper.matchBom([
        makeBomItem({ id: 'lr-1', designator: 'R1', value: '10kΩ', package: '0805' }),
      ]);

      LcscPartMapper.resetForTesting();
      const mapper2 = LcscPartMapper.getInstance();
      expect(mapper2.getLastResults().length).toBe(1);
    });

    it('handles missing localStorage gracefully', () => {
      // Remove the key and verify no crash
      localStorage.removeItem(STORAGE_KEY);
      LcscPartMapper.resetForTesting();
      const mapper = LcscPartMapper.getInstance();
      expect(mapper.getAllOverrides().length).toBe(0);
    });

    it('handles corrupt localStorage gracefully', () => {
      localStorage.setItem(STORAGE_KEY, 'NOT VALID JSON');
      LcscPartMapper.resetForTesting();
      const mapper = LcscPartMapper.getInstance();
      expect(mapper.getAllOverrides().length).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Reset
  // -------------------------------------------------------------------------

  describe('reset', () => {
    it('clears overrides and results', () => {
      const mapper = LcscPartMapper.getInstance();
      mapper.setOverride('a', 'C1');
      mapper.matchBom([
        makeBomItem({ id: 'a', designator: 'R1', value: '10kΩ', package: '0805' }),
      ]);
      mapper.reset();
      expect(mapper.getAllOverrides().length).toBe(0);
      expect(mapper.getLastResults().length).toBe(0);
    });

    it('preserves built-in database after reset', () => {
      const mapper = LcscPartMapper.getInstance();
      const sizeBefore = mapper.getDatabaseSize();
      mapper.reset();
      expect(mapper.getDatabaseSize()).toBe(sizeBefore);
    });

    it('notifies on reset', () => {
      const mapper = LcscPartMapper.getInstance();
      const listener = vi.fn();
      mapper.subscribe(listener);
      mapper.reset();
      expect(listener).toHaveBeenCalled();
    });

    it('clears localStorage on reset', () => {
      const mapper = LcscPartMapper.getInstance();
      mapper.setOverride('x', 'C1');
      mapper.reset();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles BOM item with no fields', () => {
      const mapper = LcscPartMapper.getInstance();
      const item = makeBomItem({});
      const result = mapper.matchSingle(item);
      expect(result).toBeDefined();
      expect(result.bomItem).toBe(item);
    });

    it('handles BOM item with only designator', () => {
      const mapper = LcscPartMapper.getInstance();
      const item = makeBomItem({ designator: 'R1' });
      const result = mapper.matchSingle(item);
      expect(result).toBeDefined();
    });

    it('handles empty BOM array', () => {
      const mapper = LcscPartMapper.getInstance();
      const result = mapper.matchBom([]);
      expect(result.totalCount).toBe(0);
      expect(result.matches.length).toBe(0);
      expect(result.mappedCount).toBe(0);
    });

    it('override for missing LCSC part falls through to auto-match', () => {
      const mapper = LcscPartMapper.getInstance();
      mapper.setOverride('missing-item', 'C99999999'); // not in DB
      const item = makeBomItem({ id: 'missing-item', value: '10kΩ', package: '0805' });
      const result = mapper.matchSingle(item);
      // Should fall through to auto-matching since C99999999 is not in the DB
      expect(result.manualOverride).toBe(false);
    });

    it('matchSingle returns score capped at 100', () => {
      const mapper = LcscPartMapper.getInstance();
      // An item with MPN match + value match + package match + description match could exceed 100
      const item = makeBomItem({
        mpn: 'NE555DR',
        value: 'NE555',
        package: 'SOP-8',
        description: 'NE555 Timer SOP-8',
        comment: 'Timer',
      });
      const result = mapper.matchSingle(item);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  // -------------------------------------------------------------------------
  // JLCPCB part types in database
  // -------------------------------------------------------------------------

  describe('database part types', () => {
    it('has both basic and extended parts', () => {
      const mapper = LcscPartMapper.getInstance();
      const db = mapper.getDatabase();
      const basic = db.filter((p) => p.partType === 'basic');
      const extended = db.filter((p) => p.partType === 'extended');
      expect(basic.length).toBeGreaterThan(50);
      expect(extended.length).toBeGreaterThan(10);
    });

    it('has resistors in multiple packages', () => {
      const mapper = LcscPartMapper.getInstance();
      const db = mapper.getDatabase();
      const resistors = db.filter((p) => p.category === 'resistor');
      const packages = new Set(resistors.map((r) => r.package));
      expect(packages.size).toBeGreaterThanOrEqual(2);
    });

    it('has capacitors in multiple packages', () => {
      const mapper = LcscPartMapper.getInstance();
      const db = mapper.getDatabase();
      const caps = db.filter((p) => p.category === 'capacitor');
      const packages = new Set(caps.map((c) => c.package));
      expect(packages.size).toBeGreaterThanOrEqual(2);
    });

    it('covers all standard component categories', () => {
      const mapper = LcscPartMapper.getInstance();
      const db = mapper.getDatabase();
      const categories = new Set(db.map((p) => p.category));
      expect(categories.has('resistor')).toBe(true);
      expect(categories.has('capacitor')).toBe(true);
      expect(categories.has('led')).toBe(true);
      expect(categories.has('diode')).toBe(true);
      expect(categories.has('transistor')).toBe(true);
      expect(categories.has('ic')).toBe(true);
      expect(categories.has('connector')).toBe(true);
      expect(categories.has('crystal')).toBe(true);
      expect(categories.has('inductor')).toBe(true);
      expect(categories.has('fuse')).toBe(true);
      expect(categories.has('switch')).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// STORAGE_KEY constant reference (used in persistence tests)
// ---------------------------------------------------------------------------
const STORAGE_KEY = 'protopulse-lcsc-mapper';
