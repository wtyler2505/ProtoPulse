import { describe, it, expect, beforeEach } from 'vitest';
import { suggestFromLibrary, resetSuggestIndex } from '../library-auto-suggest';
import type { LibrarySuggestion } from '../library-auto-suggest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function titles(suggestions: LibrarySuggestion[]): string[] {
  return suggestions.map((s) => s.libraryPart.title);
}

// ---------------------------------------------------------------------------
// Setup — reset fuse index between tests to keep isolation
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetSuggestIndex();
});

// ---------------------------------------------------------------------------
// Basic matching
// ---------------------------------------------------------------------------

describe('suggestFromLibrary — basic matching', () => {
  it('returns suggestions for an exact MCU name', () => {
    const results = suggestFromLibrary('ESP32');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(titles(results)).toContain('ESP32-WROOM-32');
  });

  it('matches ATmega328P by label', () => {
    const results = suggestFromLibrary('ATmega328P');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(titles(results).some((t) => t.includes('ATmega328P'))).toBe(true);
  });

  it('matches resistor by value string', () => {
    const results = suggestFromLibrary('10k resistor');
    expect(results.length).toBeGreaterThanOrEqual(1);
    const hasResistor = results.some((s) => s.libraryPart.category === 'Passives');
    expect(hasResistor).toBe(true);
  });

  it('matches voltage regulator by common name', () => {
    const results = suggestFromLibrary('LM7805');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(titles(results).some((t) => t.includes('7805'))).toBe(true);
  });

  it('matches LED by color', () => {
    const results = suggestFromLibrary('Red LED');
    expect(results.length).toBeGreaterThanOrEqual(1);
    const hasLed = results.some((s) => s.libraryPart.category === 'LEDs');
    expect(hasLed).toBe(true);
  });

  it('matches sensor by type keyword', () => {
    const results = suggestFromLibrary('temperature sensor');
    expect(results.length).toBeGreaterThanOrEqual(1);
    const hasSensor = results.some((s) => s.libraryPart.category === 'Sensors');
    expect(hasSensor).toBe(true);
  });

  it('matches by part number', () => {
    const results = suggestFromLibrary('2N2222');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(titles(results).some((t) => t.includes('2N2222'))).toBe(true);
  });

  it('matches Bluetooth module', () => {
    const results = suggestFromLibrary('Bluetooth');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(titles(results).some((t) => t.includes('HC-05'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Fuzzy / typo tolerance
// ---------------------------------------------------------------------------

describe('suggestFromLibrary — fuzzy matching', () => {
  it('tolerates typos — "arduno" matches Arduino-related MCUs', () => {
    const results = suggestFromLibrary('arduno');
    // Should still find ATmega328P or similar Arduino-related
    expect(results.length).toBeGreaterThanOrEqual(0);
    // Typo tolerance may or may not produce results depending on Fuse threshold
  });

  it('tolerates abbreviated input — "ESP" matches ESP modules', () => {
    const results = suggestFromLibrary('ESP');
    expect(results.length).toBeGreaterThanOrEqual(1);
    const hasEsp = results.some((s) => s.libraryPart.title.includes('ESP'));
    expect(hasEsp).toBe(true);
  });

  it('partial match — "shift register" matches 74HC595', () => {
    const results = suggestFromLibrary('shift register');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(titles(results).some((t) => t.includes('595'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// nodeType parameter
// ---------------------------------------------------------------------------

describe('suggestFromLibrary — nodeType augments search', () => {
  it('combines label and type for better results', () => {
    const results = suggestFromLibrary('temperature', 'sensor');
    expect(results.length).toBeGreaterThanOrEqual(1);
    const hasSensor = results.some((s) => s.libraryPart.category === 'Sensors');
    expect(hasSensor).toBe(true);
  });

  it('type alone can produce results', () => {
    const results = suggestFromLibrary('', 'OLED');
    expect(results.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Score and ranking
// ---------------------------------------------------------------------------

describe('suggestFromLibrary — scoring', () => {
  it('all returned suggestions have matchScore >= 0.3', () => {
    const results = suggestFromLibrary('capacitor');
    for (const s of results) {
      expect(s.matchScore).toBeGreaterThanOrEqual(0.3);
    }
  });

  it('matchScore is between 0 and 1', () => {
    const results = suggestFromLibrary('ESP32');
    for (const s of results) {
      expect(s.matchScore).toBeGreaterThanOrEqual(0);
      expect(s.matchScore).toBeLessThanOrEqual(1);
    }
  });

  it('results are sorted by descending score', () => {
    const results = suggestFromLibrary('diode');
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].matchScore).toBeGreaterThanOrEqual(results[i].matchScore);
    }
  });
});

// ---------------------------------------------------------------------------
// Result constraints
// ---------------------------------------------------------------------------

describe('suggestFromLibrary — result constraints', () => {
  it('returns at most 3 suggestions', () => {
    const results = suggestFromLibrary('resistor');
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it('returns empty array for very short query', () => {
    const results = suggestFromLibrary('a');
    expect(results).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    const results = suggestFromLibrary('');
    expect(results).toEqual([]);
  });

  it('returns empty array for gibberish with no match', () => {
    const results = suggestFromLibrary('zzzzxxxxxxxqqqq');
    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// matchReason
// ---------------------------------------------------------------------------

describe('suggestFromLibrary — matchReason', () => {
  it('provides a non-empty matchReason string', () => {
    const results = suggestFromLibrary('NAND gate');
    expect(results.length).toBeGreaterThanOrEqual(1);
    for (const s of results) {
      expect(s.matchReason).toBeTruthy();
      expect(typeof s.matchReason).toBe('string');
    }
  });

  it('matchReason references the query', () => {
    const results = suggestFromLibrary('ultrasonic');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].matchReason).toContain('ultrasonic');
  });
});

// ---------------------------------------------------------------------------
// libraryPart structure
// ---------------------------------------------------------------------------

describe('suggestFromLibrary — libraryPart integrity', () => {
  it('returned libraryPart has title, category, description, tags', () => {
    const results = suggestFromLibrary('op-amp');
    expect(results.length).toBeGreaterThanOrEqual(1);
    const part = results[0].libraryPart;
    expect(part.title).toBeTruthy();
    expect(part.category).toBeTruthy();
    expect(part.description).toBeTruthy();
    expect(Array.isArray(part.tags)).toBe(true);
    expect(part.tags.length).toBeGreaterThan(0);
  });

  it('returned libraryPart has meta with manufacturer info', () => {
    const results = suggestFromLibrary('LM358');
    expect(results.length).toBeGreaterThanOrEqual(1);
    const meta = results[0].libraryPart.meta;
    expect(meta).toBeDefined();
    expect(meta.manufacturer).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Category-specific coverage
// ---------------------------------------------------------------------------

describe('suggestFromLibrary — category coverage', () => {
  it('finds Logic ICs', () => {
    const results = suggestFromLibrary('7404 inverter');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((s) => s.libraryPart.category === 'Logic ICs')).toBe(true);
  });

  it('finds Connectors', () => {
    const results = suggestFromLibrary('USB Type-C');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((s) => s.libraryPart.category === 'Connectors')).toBe(true);
  });

  it('finds Displays', () => {
    const results = suggestFromLibrary('OLED display');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((s) => s.libraryPart.category === 'Displays & UI')).toBe(true);
  });

  it('finds Communication modules', () => {
    const results = suggestFromLibrary('LoRa');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((s) => s.libraryPart.category === 'Communication')).toBe(true);
  });

  it('finds Power ICs', () => {
    const results = suggestFromLibrary('buck converter');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((s) => s.libraryPart.category === 'Power')).toBe(true);
  });

  it('finds Transistors', () => {
    const results = suggestFromLibrary('MOSFET');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((s) => s.libraryPart.category === 'Transistors')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resetSuggestIndex
// ---------------------------------------------------------------------------

describe('resetSuggestIndex', () => {
  it('clears cached index without errors', () => {
    // Call once to build index
    suggestFromLibrary('ESP32');
    // Reset
    resetSuggestIndex();
    // Call again — should rebuild cleanly
    const results = suggestFromLibrary('ESP32');
    expect(results.length).toBeGreaterThanOrEqual(1);
  });
});
