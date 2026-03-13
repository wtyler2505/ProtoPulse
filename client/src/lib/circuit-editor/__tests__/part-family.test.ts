import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  partFamilyRegistry,
  parseSIValue,
  formatSIValue,
  PART_FAMILIES,
} from '../part-family';
import type {
  ComponentSwapCandidate,
  SwapResult,
  PartInfo,
} from '../part-family';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const RESISTOR_PARTS: PartInfo[] = [
  { id: 1, title: 'Resistor 100Ω', value: '100', pinCount: 2, packageType: 'Axial', manufacturer: 'Yageo' },
  { id: 2, title: 'Resistor 1kΩ', value: '1k', pinCount: 2, packageType: 'Axial', manufacturer: 'Yageo' },
  { id: 3, title: 'Resistor 4.7kΩ', value: '4.7k', pinCount: 2, packageType: 'Axial', manufacturer: 'Yageo' },
  { id: 4, title: 'Resistor 10kΩ', value: '10k', pinCount: 2, packageType: 'Axial', manufacturer: 'Yageo' },
  { id: 5, title: 'Resistor 100kΩ', value: '100k', pinCount: 2, packageType: 'Axial', manufacturer: 'Yageo' },
  { id: 6, title: 'Resistor 1MΩ', value: '1M', pinCount: 2, packageType: 'Axial', manufacturer: 'Yageo' },
];

const CAPACITOR_PARTS: PartInfo[] = [
  { id: 10, title: 'Capacitor 22pF', value: '22p', pinCount: 2, packageType: 'Ceramic', manufacturer: 'Murata' },
  { id: 11, title: 'Capacitor 100nF', value: '100n', pinCount: 2, packageType: 'Ceramic', manufacturer: 'Murata' },
  { id: 12, title: 'Capacitor 10μF', value: '10u', pinCount: 2, packageType: 'Ceramic', manufacturer: 'Murata' },
];

const TRANSISTOR_PARTS: PartInfo[] = [
  { id: 20, title: '2N2222 — NPN Transistor', value: undefined, pinCount: 3, packageType: 'TO-92', manufacturer: 'ON Semiconductor' },
  { id: 21, title: 'BC547 — NPN Transistor', value: undefined, pinCount: 3, packageType: 'TO-92', manufacturer: 'ON Semiconductor' },
  { id: 22, title: 'IRF540N — N-Channel MOSFET', value: undefined, pinCount: 3, packageType: 'TO-220', manufacturer: 'Infineon' },
];

const OPAMP_PARTS: PartInfo[] = [
  { id: 30, title: 'LM358 — Dual Op-Amp', value: undefined, pinCount: 8, packageType: 'DIP-8', manufacturer: 'TI' },
  { id: 31, title: 'LM741 — General Purpose Op-Amp', value: undefined, pinCount: 8, packageType: 'DIP-8', manufacturer: 'TI' },
];

const LED_PARTS: PartInfo[] = [
  { id: 40, title: 'Red LED', value: undefined, pinCount: 2, manufacturer: 'Broadcom' },
  { id: 41, title: 'Green LED', value: undefined, pinCount: 2, manufacturer: 'Broadcom' },
];

const CONNECTOR_PARTS: PartInfo[] = [
  { id: 50, title: 'JST PH 2-Pin Connector', value: undefined, pinCount: 2, manufacturer: 'JST' },
  { id: 51, title: 'USB Type-C Receptacle', value: undefined, pinCount: 4, manufacturer: 'GCT' },
];

const MCU_PARTS: PartInfo[] = [
  { id: 60, title: 'ATmega328P Microcontroller', value: undefined, pinCount: 28, packageType: 'DIP-28', manufacturer: 'Microchip' },
  { id: 61, title: 'ESP32-WROOM-32 MCU', value: undefined, pinCount: 38, manufacturer: 'Espressif' },
];

const DIODE_PARTS: PartInfo[] = [
  { id: 70, title: '1N4148 — Small Signal Diode', value: undefined, pinCount: 2, packageType: 'DO-35', manufacturer: 'Vishay' },
  { id: 71, title: 'Zener Diode 5.1V', value: '5.1', pinCount: 2, packageType: 'DO-35', manufacturer: 'ON Semiconductor' },
];

const ALL_PARTS: PartInfo[] = [
  ...RESISTOR_PARTS,
  ...CAPACITOR_PARTS,
  ...TRANSISTOR_PARTS,
  ...OPAMP_PARTS,
  ...LED_PARTS,
  ...CONNECTOR_PARTS,
  ...MCU_PARTS,
  ...DIODE_PARTS,
];

// ---------------------------------------------------------------------------
// parseSIValue
// ---------------------------------------------------------------------------

describe('parseSIValue', () => {
  it('parses plain numbers', () => {
    expect(parseSIValue('100')).toBe(100);
    expect(parseSIValue('4.7')).toBe(4.7);
    expect(parseSIValue('0')).toBe(0);
    expect(parseSIValue('0.001')).toBe(0.001);
  });

  it('parses kilo prefix', () => {
    expect(parseSIValue('1k')).toBe(1000);
    expect(parseSIValue('4.7k')).toBe(4700);
    expect(parseSIValue('10K')).toBe(10000);
    expect(parseSIValue('100k')).toBe(100000);
  });

  it('parses mega prefix', () => {
    expect(parseSIValue('1M')).toBe(1e6);
    expect(parseSIValue('10M')).toBe(1e7);
  });

  it('parses nano prefix', () => {
    expect(parseSIValue('100n')).toBeCloseTo(1e-7, 15);
    expect(parseSIValue('47n')).toBeCloseTo(4.7e-8, 15);
  });

  it('parses micro prefix (u and μ)', () => {
    expect(parseSIValue('10u')).toBeCloseTo(1e-5, 12);
    expect(parseSIValue('4.7μ')).toBeCloseTo(4.7e-6, 12);
    expect(parseSIValue('100μ')).toBeCloseTo(1e-4, 12);
  });

  it('parses pico prefix', () => {
    expect(parseSIValue('22p')).toBeCloseTo(2.2e-11, 18);
    expect(parseSIValue('100p')).toBeCloseTo(1e-10, 18);
  });

  it('parses milli prefix', () => {
    expect(parseSIValue('4.7m')).toBeCloseTo(0.0047, 6);
  });

  it('parses giga and tera prefixes', () => {
    expect(parseSIValue('1G')).toBe(1e9);
    expect(parseSIValue('1T')).toBe(1e12);
  });

  it('strips Ω suffix', () => {
    expect(parseSIValue('100Ω')).toBe(100);
    expect(parseSIValue('10kΩ')).toBe(10000);
    expect(parseSIValue('4.7kΩ')).toBe(4700);
  });

  it('strips F suffix', () => {
    expect(parseSIValue('100nF')).toBe(1e-7);
    expect(parseSIValue('22pF')).toBe(2.2e-11);
  });

  it('strips H suffix', () => {
    expect(parseSIValue('10μH')).toBe(1e-5);
    expect(parseSIValue('100μH')).toBe(1e-4);
  });

  it('returns null for empty string', () => {
    expect(parseSIValue('')).toBeNull();
  });

  it('returns null for non-numeric strings', () => {
    expect(parseSIValue('abc')).toBeNull();
    expect(parseSIValue('hello world')).toBeNull();
  });

  it('returns null for null/undefined input', () => {
    expect(parseSIValue(null as unknown as string)).toBeNull();
    expect(parseSIValue(undefined as unknown as string)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// formatSIValue
// ---------------------------------------------------------------------------

describe('formatSIValue', () => {
  it('formats base values', () => {
    expect(formatSIValue(100, 'Ω')).toContain('100');
    expect(formatSIValue(100, 'Ω')).toContain('Ω');
  });

  it('formats kilo values', () => {
    const result = formatSIValue(10000, 'Ω');
    expect(result).toContain('10');
    expect(result).toContain('k');
  });

  it('formats mega values', () => {
    const result = formatSIValue(1e6, 'Ω');
    expect(result).toContain('M');
  });

  it('formats micro values', () => {
    const result = formatSIValue(1e-6, 'F');
    expect(result).toContain('μ');
  });

  it('formats nano values', () => {
    const result = formatSIValue(1e-9, 'F');
    expect(result).toContain('n');
  });

  it('formats pico values', () => {
    const result = formatSIValue(1e-12, 'F');
    expect(result).toContain('p');
  });

  it('formats zero', () => {
    expect(formatSIValue(0, 'Ω')).toBe('0Ω');
  });

  it('formats without unit', () => {
    const result = formatSIValue(1000);
    expect(result).toContain('k');
    expect(result).not.toContain('Ω');
  });

  it('handles negative values', () => {
    const result = formatSIValue(-1000, 'V');
    expect(result).toContain('-');
    expect(result).toContain('k');
  });
});

// ---------------------------------------------------------------------------
// PART_FAMILIES
// ---------------------------------------------------------------------------

describe('PART_FAMILIES', () => {
  it('defines expected families', () => {
    const names = PART_FAMILIES.map((f) => f.name);
    expect(names).toContain('Resistors');
    expect(names).toContain('Capacitors');
    expect(names).toContain('Inductors');
    expect(names).toContain('Diodes');
    expect(names).toContain('LEDs');
    expect(names).toContain('Transistors');
    expect(names).toContain('Op-Amps');
    expect(names).toContain('Microcontrollers');
    expect(names).toContain('Connectors');
    expect(names.length).toBe(9);
  });

  it('each family has at least one keyword', () => {
    for (const family of PART_FAMILIES) {
      expect(family.keywords.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// PartFamilyRegistry — singleton
// ---------------------------------------------------------------------------

describe('PartFamilyRegistry', () => {
  beforeEach(() => {
    partFamilyRegistry.loadParts([]);
  });

  describe('singleton behavior', () => {
    it('is a singleton — same reference', () => {
      const a = partFamilyRegistry;
      const b = partFamilyRegistry;
      expect(a).toBe(b);
    });

    it('increments version on loadParts', () => {
      const v1 = partFamilyRegistry.version;
      partFamilyRegistry.loadParts(RESISTOR_PARTS);
      expect(partFamilyRegistry.version).toBe(v1 + 1);
    });
  });

  describe('subscribe/unsubscribe', () => {
    it('notifies listeners on loadParts', () => {
      const listener = vi.fn();
      const unsub = partFamilyRegistry.subscribe(listener);
      partFamilyRegistry.loadParts(RESISTOR_PARTS);
      expect(listener).toHaveBeenCalledTimes(1);
      unsub();
    });

    it('does not notify after unsubscribe', () => {
      const listener = vi.fn();
      const unsub = partFamilyRegistry.subscribe(listener);
      unsub();
      partFamilyRegistry.loadParts(RESISTOR_PARTS);
      expect(listener).not.toHaveBeenCalled();
    });

    it('supports multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const unsub1 = partFamilyRegistry.subscribe(listener1);
      const unsub2 = partFamilyRegistry.subscribe(listener2);
      partFamilyRegistry.loadParts(RESISTOR_PARTS);
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      unsub1();
      unsub2();
    });
  });

  describe('getFamily', () => {
    beforeEach(() => {
      partFamilyRegistry.loadParts(ALL_PARTS);
    });

    it('classifies resistors', () => {
      expect(partFamilyRegistry.getFamily('Resistor 100Ω')).toBe('Resistors');
      expect(partFamilyRegistry.getFamily('Resistor 10kΩ')).toBe('Resistors');
    });

    it('classifies capacitors', () => {
      expect(partFamilyRegistry.getFamily('Capacitor 22pF')).toBe('Capacitors');
      expect(partFamilyRegistry.getFamily('Capacitor 100nF')).toBe('Capacitors');
    });

    it('classifies transistors', () => {
      expect(partFamilyRegistry.getFamily('2N2222 — NPN Transistor')).toBe('Transistors');
      expect(partFamilyRegistry.getFamily('IRF540N — N-Channel MOSFET')).toBe('Transistors');
    });

    it('classifies op-amps', () => {
      expect(partFamilyRegistry.getFamily('LM358 — Dual Op-Amp')).toBe('Op-Amps');
    });

    it('classifies LEDs', () => {
      expect(partFamilyRegistry.getFamily('Red LED')).toBe('LEDs');
      expect(partFamilyRegistry.getFamily('Green LED')).toBe('LEDs');
    });

    it('classifies connectors', () => {
      expect(partFamilyRegistry.getFamily('JST PH 2-Pin Connector')).toBe('Connectors');
      expect(partFamilyRegistry.getFamily('USB Type-C Receptacle')).toBe('Connectors');
    });

    it('classifies microcontrollers', () => {
      expect(partFamilyRegistry.getFamily('ATmega328P Microcontroller')).toBe('Microcontrollers');
      expect(partFamilyRegistry.getFamily('ESP32-WROOM-32 MCU')).toBe('Microcontrollers');
    });

    it('classifies diodes', () => {
      expect(partFamilyRegistry.getFamily('1N4148 — Small Signal Diode')).toBe('Diodes');
      expect(partFamilyRegistry.getFamily('Zener Diode 5.1V')).toBe('Diodes');
    });

    it('returns null for unknown type', () => {
      expect(partFamilyRegistry.getFamily('SuperWidget 3000')).toBeNull();
    });

    it('is case-insensitive', () => {
      expect(partFamilyRegistry.getFamily('RESISTOR 100Ω')).toBe('Resistors');
      expect(partFamilyRegistry.getFamily('capacitor 22pf')).toBe('Capacitors');
    });
  });

  describe('getFamilyMembers', () => {
    beforeEach(() => {
      partFamilyRegistry.loadParts(ALL_PARTS);
    });

    it('returns all resistors for Resistors family', () => {
      const members = partFamilyRegistry.getFamilyMembers('Resistors');
      expect(members.length).toBe(RESISTOR_PARTS.length);
    });

    it('returns all capacitors for Capacitors family', () => {
      const members = partFamilyRegistry.getFamilyMembers('Capacitors');
      expect(members.length).toBe(CAPACITOR_PARTS.length);
    });

    it('returns all transistors for Transistors family', () => {
      const members = partFamilyRegistry.getFamilyMembers('Transistors');
      expect(members.length).toBe(TRANSISTOR_PARTS.length);
    });

    it('returns empty array for unknown family', () => {
      const members = partFamilyRegistry.getFamilyMembers('NonexistentFamily');
      expect(members).toEqual([]);
    });

    it('sorts numeric values ascending', () => {
      const members = partFamilyRegistry.getFamilyMembers('Resistors');
      const values = members.map((m) => m.numericValue).filter((v): v is number => v !== null);
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
      }
    });

    it('is case-insensitive for family name', () => {
      const a = partFamilyRegistry.getFamilyMembers('resistors');
      const b = partFamilyRegistry.getFamilyMembers('RESISTORS');
      expect(a.length).toBe(b.length);
    });

    it('includes expected fields in candidates', () => {
      const members = partFamilyRegistry.getFamilyMembers('Resistors');
      expect(members.length).toBeGreaterThan(0);
      const first = members[0];
      expect(first).toHaveProperty('title');
      expect(first).toHaveProperty('componentType');
      expect(first).toHaveProperty('numericValue');
      expect(first).toHaveProperty('displayValue');
      expect(first).toHaveProperty('pinCount');
      expect(first).toHaveProperty('packageType');
      expect(first).toHaveProperty('manufacturer');
    });
  });

  describe('getSwapCandidates', () => {
    beforeEach(() => {
      partFamilyRegistry.loadParts(ALL_PARTS);
    });

    it('returns other resistors for a resistor', () => {
      const candidates = partFamilyRegistry.getSwapCandidates({ type: 'Resistor 1kΩ' });
      expect(candidates.length).toBe(RESISTOR_PARTS.length - 1);
      const types = candidates.map((c) => c.componentType.toLowerCase());
      expect(types).not.toContain('resistor 1kω');
    });

    it('returns other capacitors for a capacitor', () => {
      const candidates = partFamilyRegistry.getSwapCandidates({ type: 'Capacitor 100nF' });
      expect(candidates.length).toBe(CAPACITOR_PARTS.length - 1);
    });

    it('returns empty for unknown component', () => {
      const candidates = partFamilyRegistry.getSwapCandidates({ type: 'Unknown Widget' });
      expect(candidates).toEqual([]);
    });

    it('does not include the current component', () => {
      const candidates = partFamilyRegistry.getSwapCandidates({ type: 'Resistor 10kΩ' });
      const types = candidates.map((c) => c.componentType.toLowerCase());
      expect(types).not.toContain('resistor 10kω');
    });

    it('returns candidates sorted by value', () => {
      const candidates = partFamilyRegistry.getSwapCandidates({ type: 'Resistor 10kΩ' });
      const values = candidates.map((c) => c.numericValue).filter((v): v is number => v !== null);
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
      }
    });
  });

  describe('performSwap', () => {
    beforeEach(() => {
      partFamilyRegistry.loadParts(ALL_PARTS);
    });

    it('returns feasible for same-family same-pin-count swap', () => {
      const result = partFamilyRegistry.performSwap('inst-1', 'Resistor 10kΩ', 'Resistor 1kΩ', 2);
      expect(result.feasible).toBe(true);
      expect(result.pinCompatible).toBe(true);
      expect(result.reason).toBeNull();
      expect(result.instanceId).toBe('inst-1');
      expect(result.previousType).toBe('Resistor 1kΩ');
      expect(result.newType).toBe('Resistor 10kΩ');
    });

    it('returns infeasible for cross-family swap', () => {
      const result = partFamilyRegistry.performSwap('inst-1', 'Capacitor 100nF', 'Resistor 1kΩ', 2);
      expect(result.feasible).toBe(false);
      expect(result.reason).toContain('families');
    });

    it('returns infeasible for pin count mismatch', () => {
      const result = partFamilyRegistry.performSwap('inst-1', '2N2222 — NPN Transistor', '2N2222 — NPN Transistor', 8);
      expect(result.feasible).toBe(false);
      expect(result.reason).toContain('Pin count');
    });

    it('returns infeasible for unknown component', () => {
      const result = partFamilyRegistry.performSwap('inst-1', 'Nonexistent Part');
      expect(result.feasible).toBe(false);
      expect(result.reason).toContain('not found');
    });

    it('is feasible when currentPinCount is undefined (no check)', () => {
      const result = partFamilyRegistry.performSwap('inst-1', 'Resistor 10kΩ', 'Resistor 1kΩ');
      expect(result.feasible).toBe(true);
      expect(result.pinCompatible).toBe(true);
    });

    it('handles missing currentType gracefully', () => {
      const result = partFamilyRegistry.performSwap('inst-1', 'Resistor 10kΩ');
      expect(result.feasible).toBe(true);
      expect(result.previousType).toBe('');
    });
  });

  describe('loadParts', () => {
    it('replaces all parts on reload', () => {
      partFamilyRegistry.loadParts(RESISTOR_PARTS);
      expect(partFamilyRegistry.getParts().length).toBe(RESISTOR_PARTS.length);

      partFamilyRegistry.loadParts(CAPACITOR_PARTS);
      expect(partFamilyRegistry.getParts().length).toBe(CAPACITOR_PARTS.length);
    });

    it('empty load clears all parts', () => {
      partFamilyRegistry.loadParts(ALL_PARTS);
      expect(partFamilyRegistry.getParts().length).toBe(ALL_PARTS.length);

      partFamilyRegistry.loadParts([]);
      expect(partFamilyRegistry.getParts().length).toBe(0);
    });

    it('does not mutate the input array', () => {
      const input = [...RESISTOR_PARTS];
      const originalLength = input.length;
      partFamilyRegistry.loadParts(input);
      expect(input.length).toBe(originalLength);
    });
  });

  describe('edge cases', () => {
    it('getFamilyMembers on empty registry returns empty', () => {
      partFamilyRegistry.loadParts([]);
      const members = partFamilyRegistry.getFamilyMembers('Resistors');
      expect(members).toEqual([]);
    });

    it('getSwapCandidates on empty registry returns empty', () => {
      partFamilyRegistry.loadParts([]);
      const candidates = partFamilyRegistry.getSwapCandidates({ type: 'Resistor 1kΩ' });
      expect(candidates).toEqual([]);
    });

    it('handles parts with no value', () => {
      partFamilyRegistry.loadParts(TRANSISTOR_PARTS);
      const members = partFamilyRegistry.getFamilyMembers('Transistors');
      expect(members.length).toBe(TRANSISTOR_PARTS.length);
      for (const m of members) {
        expect(m.numericValue).toBeNull();
      }
    });

    it('handles parts with explicit family field', () => {
      const partsWithFamily: PartInfo[] = [
        { id: 100, title: 'CustomPart X1', family: 'Resistors', value: '47k', pinCount: 2 },
      ];
      partFamilyRegistry.loadParts(partsWithFamily);
      expect(partFamilyRegistry.getFamily('CustomPart X1')).toBe('Resistors');
    });

    it('handles parts with category fallback', () => {
      // Category-only match requires keyword hit, so this should NOT match
      const partsWithCategory: PartInfo[] = [
        { id: 101, title: 'Mystery Component', category: 'Passives', pinCount: 2 },
      ];
      partFamilyRegistry.loadParts(partsWithCategory);
      // No keyword match, so family should be null
      expect(partFamilyRegistry.getFamily('Mystery Component')).toBeNull();
    });

    it('single-member family returns empty swap candidates', () => {
      const singlePart: PartInfo[] = [
        { id: 200, title: 'Resistor 999Ω', value: '999', pinCount: 2 },
      ];
      partFamilyRegistry.loadParts(singlePart);
      const candidates = partFamilyRegistry.getSwapCandidates({ type: 'Resistor 999Ω' });
      expect(candidates).toEqual([]);
    });
  });
});
