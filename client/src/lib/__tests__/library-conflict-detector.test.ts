import { describe, it, expect } from 'vitest';
import {
  detectConflicts,
  parseIncludeDirectives,
  resolveLibraryForInclude,
  formatConflictReport,
  KNOWN_CONFLICTS,
} from '../library-conflict-detector';
import type { ArduinoLibrary, LibraryConflict } from '../library-conflict-detector';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLib(name: string, version: string, includes: string[]): ArduinoLibrary {
  return { name, version, includes };
}

// ---------------------------------------------------------------------------
// detectConflicts
// ---------------------------------------------------------------------------

describe('detectConflicts', () => {
  it('returns empty array for empty input', () => {
    expect(detectConflicts([])).toEqual([]);
  });

  it('returns empty array for a single library', () => {
    const libs = [makeLib('SPI', '1.0.0', ['SPI.h'])];
    expect(detectConflicts(libs)).toEqual([]);
  });

  it('returns empty array when no conflicts exist', () => {
    const libs = [
      makeLib('SPI', '1.0.0', ['SPI.h']),
      makeLib('Wire', '1.0.0', ['Wire.h']),
      makeLib('Servo', '1.2.1', ['Servo.h']),
    ];
    expect(detectConflicts(libs)).toEqual([]);
  });

  // -- Duplicate symbol detection --

  it('detects duplicate symbols from normalized name collision', () => {
    const libs = [
      makeLib('MyLib', '1.0.0', ['MyLib.h']),
      makeLib('my_lib', '1.0.0', ['my_lib.h']),
    ];
    const conflicts = detectConflicts(libs);
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
    const dup = conflicts.find((c) => c.type === 'duplicate_symbol');
    expect(dup).toBeDefined();
    expect(dup!.severity).toBe('error');
    expect(dup!.libraries).toContain('MyLib');
    expect(dup!.libraries).toContain('my_lib');
  });

  it('does not flag identical library name as duplicate', () => {
    const libs = [
      makeLib('SPI', '1.0.0', ['SPI.h']),
      makeLib('SPI', '1.0.0', ['SPI.h']),
    ];
    const conflicts = detectConflicts(libs);
    // Same exact name is not a "duplicate symbol" — it would be a version mismatch if versions differ
    const dup = conflicts.find((c) => c.type === 'duplicate_symbol');
    expect(dup).toBeUndefined();
  });

  // -- Version mismatch detection --

  it('detects version mismatch for same library at different versions', () => {
    const libs = [
      makeLib('Adafruit_SSD1306', '1.3.0', ['Adafruit_SSD1306.h']),
      makeLib('Adafruit_SSD1306', '2.5.7', ['Adafruit_SSD1306.h']),
    ];
    const conflicts = detectConflicts(libs);
    const mismatch = conflicts.find((c) => c.type === 'version_mismatch');
    expect(mismatch).toBeDefined();
    expect(mismatch!.libraries).toContain('Adafruit_SSD1306');
    expect(mismatch!.detail).toContain('1.3.0');
    expect(mismatch!.detail).toContain('2.5.7');
  });

  it('flags major version mismatch as error', () => {
    const libs = [
      makeLib('FastLED', '2.0.0', ['FastLED.h']),
      makeLib('FastLED', '3.6.0', ['FastLED.h']),
    ];
    const conflicts = detectConflicts(libs);
    const mismatch = conflicts.find((c) => c.type === 'version_mismatch');
    expect(mismatch).toBeDefined();
    expect(mismatch!.severity).toBe('error');
    expect(mismatch!.detail).toContain('major version mismatch');
  });

  it('flags minor version mismatch as warning', () => {
    const libs = [
      makeLib('Servo', '1.1.0', ['Servo.h']),
      makeLib('Servo', '1.2.3', ['Servo.h']),
    ];
    const conflicts = detectConflicts(libs);
    const mismatch = conflicts.find((c) => c.type === 'version_mismatch');
    expect(mismatch).toBeDefined();
    expect(mismatch!.severity).toBe('warning');
  });

  // -- Include collision detection --

  it('detects include collision when two libraries provide the same header', () => {
    const libs = [
      makeLib('WiFi', '1.0.0', ['WiFi.h']),
      makeLib('WiFiNINA', '1.8.0', ['WiFi.h']),
    ];
    const conflicts = detectConflicts(libs);
    const collision = conflicts.find((c) => c.type === 'include_collision');
    expect(collision).toBeDefined();
    expect(collision!.severity).toBe('error');
    expect(collision!.libraries).toContain('WiFi');
    expect(collision!.libraries).toContain('WiFiNINA');
  });

  it('detects case-insensitive include collision', () => {
    const libs = [
      makeLib('LibA', '1.0.0', ['Config.h']),
      makeLib('LibB', '1.0.0', ['config.h']),
    ];
    const conflicts = detectConflicts(libs);
    const collision = conflicts.find((c) => c.type === 'include_collision');
    expect(collision).toBeDefined();
    expect(collision!.detail).toContain('config.h');
  });

  it('does not flag same library appearing twice as include collision', () => {
    const libs = [
      makeLib('SPI', '1.0.0', ['SPI.h']),
      makeLib('SPI', '1.0.0', ['SPI.h']),
    ];
    const conflicts = detectConflicts(libs);
    const collision = conflicts.find((c) => c.type === 'include_collision');
    expect(collision).toBeUndefined();
  });

  // -- Known conflicts --

  it('detects known SPI + WiFi conflict', () => {
    const libs = [
      makeLib('SPI', '1.0.0', ['SPI.h']),
      makeLib('WiFi', '1.0.0', ['WiFi.h']),
    ];
    const conflicts = detectConflicts(libs);
    const dep = conflicts.find(
      (c) => c.type === 'dependency_conflict' && c.libraries.includes('SPI') && c.libraries.includes('WiFi'),
    );
    expect(dep).toBeDefined();
    expect(dep!.severity).toBe('warning');
  });

  it('detects known Wire + I2C conflict', () => {
    const libs = [
      makeLib('Wire', '1.0.0', ['Wire.h']),
      makeLib('I2C', '1.0.0', ['I2C.h']),
    ];
    const conflicts = detectConflicts(libs);
    const dup = conflicts.find(
      (c) => c.type === 'duplicate_symbol' && c.libraries.includes('Wire') && c.libraries.includes('I2C'),
    );
    expect(dup).toBeDefined();
    expect(dup!.severity).toBe('error');
  });

  it('detects known Servo + Tone timer conflict', () => {
    const libs = [
      makeLib('Servo', '1.2.0', ['Servo.h']),
      makeLib('Tone', '1.0.0', ['Tone.h']),
    ];
    const conflicts = detectConflicts(libs);
    const dep = conflicts.find(
      (c) => c.type === 'dependency_conflict' && c.libraries.includes('Servo') && c.libraries.includes('Tone'),
    );
    expect(dep).toBeDefined();
    expect(dep!.severity).toBe('error');
  });

  it('detects known FastLED + NeoPixel conflict', () => {
    const libs = [
      makeLib('FastLED', '3.6.0', ['FastLED.h']),
      makeLib('NeoPixel', '1.12.0', ['Adafruit_NeoPixel.h']),
    ];
    const conflicts = detectConflicts(libs);
    const dep = conflicts.find(
      (c) => c.type === 'dependency_conflict' && c.libraries.includes('FastLED') && c.libraries.includes('NeoPixel'),
    );
    expect(dep).toBeDefined();
  });

  it('does not flag known conflict when only one library is present', () => {
    const libs = [makeLib('SPI', '1.0.0', ['SPI.h'])];
    const conflicts = detectConflicts(libs);
    expect(conflicts).toEqual([]);
  });

  // -- Sorting --

  it('sorts errors before warnings', () => {
    const libs = [
      makeLib('SPI', '1.0.0', ['SPI.h']),
      makeLib('WiFi', '1.0.0', ['WiFi.h']),
      makeLib('Wire', '1.0.0', ['Wire.h']),
      makeLib('I2C', '1.0.0', ['I2C.h']),
    ];
    const conflicts = detectConflicts(libs);
    expect(conflicts.length).toBeGreaterThanOrEqual(2);
    const severities = conflicts.map((c) => c.severity);
    const firstWarning = severities.indexOf('warning');
    const lastError = severities.lastIndexOf('error');
    if (firstWarning !== -1 && lastError !== -1) {
      expect(lastError).toBeLessThan(firstWarning);
    }
  });

  // -- Multiple conflicts at once --

  it('detects multiple conflict types simultaneously', () => {
    const libs = [
      makeLib('MyLib', '1.0.0', ['Shared.h']),
      makeLib('my_lib', '2.0.0', ['shared.h']),
      makeLib('OtherLib', '1.0.0', ['Shared.h']),
    ];
    const conflicts = detectConflicts(libs);
    const types = new Set(conflicts.map((c) => c.type));
    expect(types.size).toBeGreaterThanOrEqual(2);
    expect(types.has('duplicate_symbol')).toBe(true);
    expect(types.has('include_collision')).toBe(true);
  });

  it('avoids duplicate known-conflict entries when also detected by other checks', () => {
    const libs = [
      makeLib('WiFi', '1.0.0', ['WiFi.h']),
      makeLib('WiFiNINA', '1.8.0', ['WiFi.h']),
    ];
    const conflicts = detectConflicts(libs);
    // WiFi + WiFiNINA is both a known conflict (include_collision) and detected by header scan
    // Should not appear twice with the same type
    const includeCollisions = conflicts.filter((c) => c.type === 'include_collision');
    expect(includeCollisions.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// parseIncludeDirectives
// ---------------------------------------------------------------------------

describe('parseIncludeDirectives', () => {
  it('returns empty array for empty string', () => {
    expect(parseIncludeDirectives('')).toEqual([]);
  });

  it('returns empty array for code without includes', () => {
    const code = 'void setup() {}\nvoid loop() {}';
    expect(parseIncludeDirectives(code)).toEqual([]);
  });

  it('parses angle-bracket includes', () => {
    const code = '#include <SPI.h>\n#include <Wire.h>\nvoid setup() {}';
    expect(parseIncludeDirectives(code)).toEqual(['SPI.h', 'Wire.h']);
  });

  it('parses quoted includes', () => {
    const code = '#include "MyLib.h"\nvoid setup() {}';
    expect(parseIncludeDirectives(code)).toEqual(['MyLib.h']);
  });

  it('parses mixed include styles', () => {
    const code = '#include <SPI.h>\n#include "config.h"\n#include <Wire.h>';
    expect(parseIncludeDirectives(code)).toEqual(['SPI.h', 'config.h', 'Wire.h']);
  });

  it('handles leading whitespace before #include', () => {
    const code = '  #include <SPI.h>\n\t#include <Wire.h>';
    expect(parseIncludeDirectives(code)).toEqual(['SPI.h', 'Wire.h']);
  });

  it('handles spaces between # and include', () => {
    const code = '#  include <SPI.h>';
    expect(parseIncludeDirectives(code)).toEqual(['SPI.h']);
  });

  it('deduplicates repeated includes', () => {
    const code = '#include <SPI.h>\n#include <Wire.h>\n#include <SPI.h>';
    expect(parseIncludeDirectives(code)).toEqual(['SPI.h', 'Wire.h']);
  });

  it('ignores commented-out includes', () => {
    // Only line-start #include is matched; a // comment prevents the line from starting with #
    const code = '// #include <Unused.h>\n#include <SPI.h>';
    const result = parseIncludeDirectives(code);
    expect(result).toContain('SPI.h');
    expect(result).not.toContain('Unused.h');
  });

  it('handles path-style includes', () => {
    const code = '#include <Adafruit/Sensor.h>';
    expect(parseIncludeDirectives(code)).toEqual(['Adafruit/Sensor.h']);
  });

  it('parses a realistic sketch', () => {
    const code = `
#include <SPI.h>
#include <Wire.h>
#include "Adafruit_SSD1306.h"
#include <Servo.h>

#define LED_PIN 13

void setup() {
  Serial.begin(9600);
}

void loop() {
  delay(100);
}
`;
    const result = parseIncludeDirectives(code);
    expect(result).toEqual(['SPI.h', 'Wire.h', 'Adafruit_SSD1306.h', 'Servo.h']);
  });
});

// ---------------------------------------------------------------------------
// resolveLibraryForInclude
// ---------------------------------------------------------------------------

describe('resolveLibraryForInclude', () => {
  const libs: ArduinoLibrary[] = [
    makeLib('SPI', '1.0.0', ['SPI.h']),
    makeLib('Wire', '1.0.0', ['Wire.h', 'utility/twi.h']),
    makeLib('Adafruit_SSD1306', '2.5.7', ['Adafruit_SSD1306.h', 'splash.h']),
    makeLib('Servo', '1.2.1', ['Servo.h']),
  ];

  it('returns null for empty available list', () => {
    expect(resolveLibraryForInclude('SPI.h', [])).toBeNull();
  });

  it('resolves exact case-sensitive match', () => {
    const result = resolveLibraryForInclude('SPI.h', libs);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('SPI');
  });

  it('resolves sub-path header', () => {
    const result = resolveLibraryForInclude('utility/twi.h', libs);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Wire');
  });

  it('resolves case-insensitive match when exact fails', () => {
    const result = resolveLibraryForInclude('spi.h', libs);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('SPI');
  });

  it('resolves by library name when header not in includes list', () => {
    const customLibs = [makeLib('MyCustomLib', '1.0.0', ['internal.h'])];
    const result = resolveLibraryForInclude('MyCustomLib.h', customLibs);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('MyCustomLib');
  });

  it('resolves by normalized library name (underscore/dash insensitive)', () => {
    const customLibs = [makeLib('My_Custom_Lib', '1.0.0', ['internal.h'])];
    const result = resolveLibraryForInclude('MyCustomLib.h', customLibs);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('My_Custom_Lib');
  });

  it('returns null when no match exists', () => {
    const result = resolveLibraryForInclude('NonExistent.h', libs);
    expect(result).toBeNull();
  });

  it('prefers exact match over name-based match', () => {
    const ambiguous = [
      makeLib('SPI', '1.0.0', ['SPI.h']),
      makeLib('SPI_Alternate', '1.0.0', ['SPI.h', 'SPI_Alternate.h']),
    ];
    // "SPI.h" should match the first library (exact match found first)
    const result = resolveLibraryForInclude('SPI.h', ambiguous);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('SPI');
  });

  it('strips .hpp extension for name matching', () => {
    const cppLibs = [makeLib('MyDriver', '1.0.0', ['internal.h'])];
    const result = resolveLibraryForInclude('MyDriver.hpp', cppLibs);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('MyDriver');
  });
});

// ---------------------------------------------------------------------------
// KNOWN_CONFLICTS
// ---------------------------------------------------------------------------

describe('KNOWN_CONFLICTS', () => {
  it('contains at least 5 entries', () => {
    expect(KNOWN_CONFLICTS.length).toBeGreaterThanOrEqual(5);
  });

  it('every entry has two library names', () => {
    for (const entry of KNOWN_CONFLICTS) {
      expect(entry.libraries).toHaveLength(2);
      expect(entry.libraries[0].length).toBeGreaterThan(0);
      expect(entry.libraries[1].length).toBeGreaterThan(0);
    }
  });

  it('every entry has a valid type', () => {
    const validTypes = new Set(['duplicate_symbol', 'version_mismatch', 'include_collision', 'dependency_conflict']);
    for (const entry of KNOWN_CONFLICTS) {
      expect(validTypes.has(entry.type)).toBe(true);
    }
  });

  it('every entry has a non-empty detail', () => {
    for (const entry of KNOWN_CONFLICTS) {
      expect(entry.detail.length).toBeGreaterThan(10);
    }
  });

  it('every entry has a valid severity', () => {
    for (const entry of KNOWN_CONFLICTS) {
      expect(['error', 'warning']).toContain(entry.severity);
    }
  });

  it('includes SPI + WiFi conflict', () => {
    const found = KNOWN_CONFLICTS.some(
      (e) => e.libraries.includes('SPI') && e.libraries.includes('WiFi'),
    );
    expect(found).toBe(true);
  });

  it('includes Wire + I2C conflict', () => {
    const found = KNOWN_CONFLICTS.some(
      (e) => e.libraries.includes('Wire') && e.libraries.includes('I2C'),
    );
    expect(found).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// formatConflictReport
// ---------------------------------------------------------------------------

describe('formatConflictReport', () => {
  it('returns empty string for no conflicts', () => {
    expect(formatConflictReport([])).toBe('');
  });

  it('produces a header line with counts', () => {
    const conflicts: LibraryConflict[] = [
      {
        type: 'duplicate_symbol',
        libraries: ['A', 'B'],
        detail: 'test detail',
        severity: 'error',
      },
    ];
    const report = formatConflictReport(conflicts);
    expect(report).toContain('1 issue found');
    expect(report).toContain('1 error');
    expect(report).toContain('0 warnings');
  });

  it('includes library names in the report', () => {
    const conflicts: LibraryConflict[] = [
      {
        type: 'include_collision',
        libraries: ['WiFi', 'WiFiNINA'],
        detail: 'Header collision on WiFi.h',
        severity: 'error',
      },
    ];
    const report = formatConflictReport(conflicts);
    expect(report).toContain('WiFi');
    expect(report).toContain('WiFiNINA');
  });

  it('includes type label in the report', () => {
    const conflicts: LibraryConflict[] = [
      {
        type: 'version_mismatch',
        libraries: ['FastLED'],
        detail: 'Versions differ',
        severity: 'warning',
      },
    ];
    const report = formatConflictReport(conflicts);
    expect(report).toContain('Version Mismatch');
    expect(report).toContain('[WARNING]');
  });

  it('includes severity prefix for errors', () => {
    const conflicts: LibraryConflict[] = [
      {
        type: 'dependency_conflict',
        libraries: ['Servo', 'Tone'],
        detail: 'Timer conflict',
        severity: 'error',
      },
    ];
    const report = formatConflictReport(conflicts);
    expect(report).toContain('[ERROR]');
    expect(report).toContain('Dependency Conflict');
  });

  it('formats multiple conflicts with separator', () => {
    const conflicts: LibraryConflict[] = [
      {
        type: 'duplicate_symbol',
        libraries: ['A', 'B'],
        detail: 'First conflict',
        severity: 'error',
      },
      {
        type: 'dependency_conflict',
        libraries: ['C', 'D'],
        detail: 'Second conflict',
        severity: 'warning',
      },
    ];
    const report = formatConflictReport(conflicts);
    expect(report).toContain('2 issues found');
    expect(report).toContain('First conflict');
    expect(report).toContain('Second conflict');
  });

  it('pluralizes correctly for single issue', () => {
    const conflicts: LibraryConflict[] = [
      {
        type: 'duplicate_symbol',
        libraries: ['X', 'Y'],
        detail: 'Only one',
        severity: 'error',
      },
    ];
    const report = formatConflictReport(conflicts);
    expect(report).toContain('1 issue found');
    expect(report).not.toContain('issues');
  });

  it('pluralizes correctly for multiple issues', () => {
    const conflicts: LibraryConflict[] = [
      { type: 'duplicate_symbol', libraries: ['A', 'B'], detail: 'c1', severity: 'error' },
      { type: 'include_collision', libraries: ['C', 'D'], detail: 'c2', severity: 'warning' },
      { type: 'dependency_conflict', libraries: ['E', 'F'], detail: 'c3', severity: 'warning' },
    ];
    const report = formatConflictReport(conflicts);
    expect(report).toContain('3 issues found');
    expect(report).toContain('1 error,');
    expect(report).toContain('2 warnings');
  });
});
