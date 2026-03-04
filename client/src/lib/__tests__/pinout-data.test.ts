/**
 * Pinout Data Module Tests
 *
 * Tests for client/src/lib/pinout-data.ts.
 * Covers lookup, search, generic generation, and data integrity.
 */

import { describe, it, expect } from 'vitest';
import {
  lookupPinout,
  getGenericPinout,
  getAllPinouts,
  searchPinouts,
} from '../pinout-data';
import type { PinInfo } from '../pinout-data';

// ---------------------------------------------------------------------------
// Valid pin types for assertions
// ---------------------------------------------------------------------------

const VALID_PIN_TYPES: ReadonlyArray<PinInfo['type']> = ['power', 'ground', 'io', 'analog', 'special', 'nc'];

// ---------------------------------------------------------------------------
// lookupPinout — exact name matching
// ---------------------------------------------------------------------------

describe('lookupPinout', () => {
  it('finds ATmega328P by exact name', () => {
    const result = lookupPinout('ATmega328P');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('ATmega328P');
    expect(result!.pinCount).toBe(28);
  });

  it('finds ESP32-WROOM-32 by exact name', () => {
    const result = lookupPinout('ESP32-WROOM-32');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('ESP32-WROOM-32');
    expect(result!.pinCount).toBe(38);
  });

  it('finds NE555 by exact name', () => {
    const result = lookupPinout('NE555');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('NE555');
    expect(result!.pinCount).toBe(8);
  });

  it('finds LM7805 by exact name', () => {
    const result = lookupPinout('LM7805');
    expect(result).not.toBeNull();
    expect(result!.pinCount).toBe(3);
    expect(result!.package).toBe('TO-220');
  });

  it('finds LM317 by exact name', () => {
    const result = lookupPinout('LM317');
    expect(result).not.toBeNull();
    expect(result!.pinCount).toBe(3);
  });

  it('finds LM358 by exact name', () => {
    const result = lookupPinout('LM358');
    expect(result).not.toBeNull();
    expect(result!.pinCount).toBe(8);
  });

  it('finds 2N2222 by exact name', () => {
    const result = lookupPinout('2N2222');
    expect(result).not.toBeNull();
    expect(result!.pinCount).toBe(3);
    expect(result!.package).toBe('TO-92');
  });

  it('finds IRF540N by exact name', () => {
    const result = lookupPinout('IRF540N');
    expect(result).not.toBeNull();
    expect(result!.pinCount).toBe(3);
  });

  it('finds Arduino Uno by exact name', () => {
    const result = lookupPinout('Arduino Uno');
    expect(result).not.toBeNull();
    expect(result!.package).toBe('Board');
  });

  it('finds Arduino Mega 2560 by exact name', () => {
    const result = lookupPinout('Arduino Mega 2560');
    expect(result).not.toBeNull();
    expect(result!.family).toBe('Development Board');
  });

  it('finds ATtiny85 by exact name', () => {
    const result = lookupPinout('ATtiny85');
    expect(result).not.toBeNull();
    expect(result!.pinCount).toBe(8);
  });

  it('finds L293D by exact name', () => {
    const result = lookupPinout('L293D');
    expect(result).not.toBeNull();
    expect(result!.pinCount).toBe(16);
  });

  it('finds 74HC595 by exact name', () => {
    const result = lookupPinout('74HC595');
    expect(result).not.toBeNull();
    expect(result!.family).toBe('Shift Register');
  });
});

// ---------------------------------------------------------------------------
// lookupPinout — alias/fuzzy matching
// ---------------------------------------------------------------------------

describe('lookupPinout — alias matching', () => {
  it('finds ATmega328P by alias "Arduino Uno MCU"', () => {
    const result = lookupPinout('Arduino Uno MCU');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('ATmega328P');
  });

  it('finds NE555 by alias "555 Timer"', () => {
    const result = lookupPinout('555 Timer');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('NE555');
  });

  it('finds NE555 by alias "LM555"', () => {
    const result = lookupPinout('LM555');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('NE555');
  });

  it('finds ESP32 by alias "ESP32"', () => {
    const result = lookupPinout('ESP32');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('ESP32-WROOM-32');
  });

  it('finds 2N2222 by alias "NPN Transistor"', () => {
    const result = lookupPinout('NPN Transistor');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('2N2222');
  });

  it('finds IRF540N by alias "N-Channel MOSFET"', () => {
    const result = lookupPinout('N-Channel MOSFET');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('IRF540N');
  });

  it('finds LM358 by alias "Dual Op-Amp"', () => {
    const result = lookupPinout('Dual Op-Amp');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('LM358');
  });

  it('finds L293D by alias "Motor Driver"', () => {
    const result = lookupPinout('Motor Driver');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('L293D');
  });

  it('finds 74HC595 by alias "Shift Register"', () => {
    const result = lookupPinout('Shift Register');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('74HC595');
  });

  it('handles case-insensitive matching', () => {
    const result = lookupPinout('ne555');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('NE555');
  });

  it('handles matching with extra characters stripped', () => {
    const result = lookupPinout('ATmega-328P');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('ATmega328P');
  });

  it('returns null for empty query', () => {
    expect(lookupPinout('')).toBeNull();
  });

  it('returns null for unknown component', () => {
    expect(lookupPinout('XYZZY9999')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getGenericPinout
// ---------------------------------------------------------------------------

describe('getGenericPinout', () => {
  it('generates a generic pinout with the correct pin count', () => {
    const result = getGenericPinout(14);
    expect(result.pinCount).toBe(14);
    expect(result.pins).toHaveLength(14);
    expect(result.name).toBe('Unknown Component');
    expect(result.family).toBe('Generic');
  });

  it('generates TO-92 package for 3 pins by default', () => {
    const result = getGenericPinout(3);
    expect(result.package).toBe('TO-92');
    expect(result.pins).toHaveLength(3);
    for (const pin of result.pins) {
      expect(pin.side).toBe('bottom');
    }
  });

  it('uses DIP-8 for 8 pins by default', () => {
    const result = getGenericPinout(8);
    expect(result.package).toBe('DIP-8');
  });

  it('uses provided package type', () => {
    const result = getGenericPinout(6, 'SOT-23');
    expect(result.package).toBe('SOT-23');
  });

  it('assigns left/right sides for DIP packages', () => {
    const result = getGenericPinout(16);
    const leftPins = result.pins.filter((p) => p.side === 'left');
    const rightPins = result.pins.filter((p) => p.side === 'right');
    expect(leftPins.length).toBe(8);
    expect(rightPins.length).toBe(8);
  });

  it('assigns sequential pin numbers', () => {
    const result = getGenericPinout(10);
    for (let i = 0; i < 10; i++) {
      expect(result.pins[i].number).toBe(i + 1);
    }
  });

  it('pins have default "io" type', () => {
    const result = getGenericPinout(4);
    for (const pin of result.pins) {
      expect(pin.type).toBe('io');
    }
  });

  it('generates valid pinout for 1 pin', () => {
    const result = getGenericPinout(1);
    expect(result.pins).toHaveLength(1);
    expect(result.pins[0].number).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getAllPinouts
// ---------------------------------------------------------------------------

describe('getAllPinouts', () => {
  it('returns at least 10 entries', () => {
    const all = getAllPinouts();
    expect(all.length).toBeGreaterThanOrEqual(10);
  });

  it('returns a copy (not a reference to internal array)', () => {
    const a = getAllPinouts();
    const b = getAllPinouts();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// searchPinouts
// ---------------------------------------------------------------------------

describe('searchPinouts', () => {
  it('returns relevant results for "timer"', () => {
    const results = searchPinouts('timer');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe('NE555');
  });

  it('returns results for "arduino"', () => {
    const results = searchPinouts('arduino');
    expect(results.length).toBeGreaterThanOrEqual(2);
    const names = results.map((r) => r.name);
    expect(names).toContain('Arduino Uno');
    expect(names).toContain('Arduino Mega 2560');
  });

  it('returns results for "motor"', () => {
    const results = searchPinouts('motor');
    expect(results.length).toBeGreaterThan(0);
    const names = results.map((r) => r.name);
    expect(names).toContain('L293D');
  });

  it('returns empty array for empty query', () => {
    expect(searchPinouts('')).toEqual([]);
  });

  it('returns empty array for non-matching query', () => {
    expect(searchPinouts('zzzzzzz999')).toEqual([]);
  });

  it('ranks exact name match higher than substring match', () => {
    const results = searchPinouts('NE555');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe('NE555');
  });

  it('returns results for partial matches like "avr"', () => {
    const results = searchPinouts('avr');
    expect(results.length).toBeGreaterThanOrEqual(1);
    for (const result of results) {
      const nameOrFamilyOrDesc =
        result.name.toLowerCase() +
        result.family.toLowerCase() +
        (result.description?.toLowerCase() ?? '');
      expect(nameOrFamilyOrDesc).toContain('avr');
    }
  });
});

// ---------------------------------------------------------------------------
// Data integrity
// ---------------------------------------------------------------------------

describe('data integrity', () => {
  const allPinouts = getAllPinouts();

  it('every entry has a non-empty name', () => {
    for (const entry of allPinouts) {
      expect(entry.name.length).toBeGreaterThan(0);
    }
  });

  it('every entry has a non-empty family', () => {
    for (const entry of allPinouts) {
      expect(entry.family.length).toBeGreaterThan(0);
    }
  });

  it('every entry has a non-empty package', () => {
    for (const entry of allPinouts) {
      expect(entry.package.length).toBeGreaterThan(0);
    }
  });

  it('pinCount matches actual pin array length', () => {
    for (const entry of allPinouts) {
      expect(entry.pins.length).toBe(entry.pinCount);
    }
  });

  it('all pin types are valid', () => {
    for (const entry of allPinouts) {
      for (const pin of entry.pins) {
        expect(VALID_PIN_TYPES).toContain(pin.type);
      }
    }
  });

  it('all pins have at least one function', () => {
    for (const entry of allPinouts) {
      for (const pin of entry.pins) {
        expect(pin.functions.length).toBeGreaterThan(0);
      }
    }
  });

  it('all pins have valid side assignments', () => {
    const validSides = ['left', 'right', 'top', 'bottom'];
    for (const entry of allPinouts) {
      for (const pin of entry.pins) {
        if (pin.side !== undefined) {
          expect(validSides).toContain(pin.side);
        }
      }
    }
  });

  it('all pin numbers are positive integers', () => {
    for (const entry of allPinouts) {
      for (const pin of entry.pins) {
        expect(pin.number).toBeGreaterThan(0);
        expect(Number.isInteger(pin.number)).toBe(true);
      }
    }
  });

  it('no duplicate names in the database', () => {
    const names = allPinouts.map((e) => e.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});
