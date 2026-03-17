import { describe, it, expect } from 'vitest';
import {
  parseCompileErrors,
  suggestLibrariesForErrors,
  getInstallCommand,
  INCLUDE_TO_LIBRARY_MAP,
} from '../smart-library-installer';
import type { CompileError, LibrarySuggestion } from '../smart-library-installer';

// ---------------------------------------------------------------------------
// parseCompileErrors — missing include detection
// ---------------------------------------------------------------------------

describe('parseCompileErrors — missing include', () => {
  it('parses a single missing include error', () => {
    const output = 'sketch.ino:3:10: fatal error: DHT.h: No such file or directory';
    const errors = parseCompileErrors(output);
    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe('missing_include');
    expect(errors[0].line).toBe(3);
    expect(errors[0].message).toContain('DHT.h');
  });

  it('parses multiple missing include errors', () => {
    const output = [
      '/home/user/sketch.ino:1:10: fatal error: Adafruit_NeoPixel.h: No such file or directory',
      '/home/user/sketch.ino:2:10: fatal error: DHT.h: No such file or directory',
    ].join('\n');
    const errors = parseCompileErrors(output);
    expect(errors).toHaveLength(2);
    expect(errors[0].message).toContain('Adafruit_NeoPixel.h');
    expect(errors[1].message).toContain('DHT.h');
  });

  it('handles full path in file reference', () => {
    const output = '/tmp/arduino_build/src/main.cpp:15:12: fatal error: FastLED.h: No such file or directory';
    const errors = parseCompileErrors(output);
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(15);
    expect(errors[0].type).toBe('missing_include');
  });

  it('deduplicates identical missing include errors', () => {
    const output = [
      'sketch.ino:3:10: fatal error: DHT.h: No such file or directory',
      'sketch.ino:7:10: fatal error: DHT.h: No such file or directory',
    ].join('\n');
    const errors = parseCompileErrors(output);
    expect(errors).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// parseCompileErrors — undefined symbol detection
// ---------------------------------------------------------------------------

describe('parseCompileErrors — undefined symbol', () => {
  it('parses a single undefined symbol error', () => {
    const output = "sketch.ino:12:3: error: 'DHT' was not declared in this scope";
    const errors = parseCompileErrors(output);
    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe('undefined_symbol');
    expect(errors[0].line).toBe(12);
    expect(errors[0].message).toContain('DHT');
  });

  it('parses Adafruit_NeoPixel undefined symbol', () => {
    const output = "sketch.ino:5:1: error: 'Adafruit_NeoPixel' was not declared in this scope";
    const errors = parseCompileErrors(output);
    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe('undefined_symbol');
    expect(errors[0].message).toContain('Adafruit_NeoPixel');
  });

  it('deduplicates identical symbol errors', () => {
    const output = [
      "sketch.ino:10:3: error: 'FastLED' was not declared in this scope",
      "sketch.ino:15:3: error: 'FastLED' was not declared in this scope",
    ].join('\n');
    const errors = parseCompileErrors(output);
    expect(errors).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// parseCompileErrors — generic/other errors
// ---------------------------------------------------------------------------

describe('parseCompileErrors — other errors', () => {
  it('parses a generic syntax error', () => {
    const output = "sketch.ino:20:5: error: expected ';' before '}' token";
    const errors = parseCompileErrors(output);
    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe('other');
    expect(errors[0].line).toBe(20);
  });

  it('classifies non-scope errors as other', () => {
    const output = 'sketch.ino:8:1: error: unknown type name int32';
    const errors = parseCompileErrors(output);
    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe('other');
  });
});

// ---------------------------------------------------------------------------
// parseCompileErrors — mixed output
// ---------------------------------------------------------------------------

describe('parseCompileErrors — mixed output', () => {
  it('parses a mix of missing include, undefined symbol, and generic errors', () => {
    const output = [
      'sketch.ino:1:10: fatal error: DHT.h: No such file or directory',
      "sketch.ino:12:3: error: 'FastLED' was not declared in this scope",
      "sketch.ino:20:5: error: expected ';' before '}' token",
    ].join('\n');
    const errors = parseCompileErrors(output);
    expect(errors).toHaveLength(3);
    expect(errors[0].type).toBe('missing_include');
    expect(errors[1].type).toBe('undefined_symbol');
    expect(errors[2].type).toBe('other');
  });

  it('ignores non-error lines (warnings, notes, blank lines)', () => {
    const output = [
      'Compiling sketch...',
      '',
      'sketch.ino:1:10: fatal error: DHT.h: No such file or directory',
      'compilation terminated.',
      'exit status 1',
    ].join('\n');
    const errors = parseCompileErrors(output);
    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe('missing_include');
  });
});

// ---------------------------------------------------------------------------
// parseCompileErrors — edge cases
// ---------------------------------------------------------------------------

describe('parseCompileErrors — edge cases', () => {
  it('returns empty array for empty string', () => {
    expect(parseCompileErrors('')).toEqual([]);
  });

  it('returns empty array for null-ish input', () => {
    expect(parseCompileErrors(null as unknown as string)).toEqual([]);
    expect(parseCompileErrors(undefined as unknown as string)).toEqual([]);
  });

  it('returns empty array when no errors present', () => {
    const output = [
      'Compiling sketch...',
      'Sketch uses 4500 bytes (13%) of program storage space.',
      'Global variables use 200 bytes (9%) of dynamic memory.',
    ].join('\n');
    expect(parseCompileErrors(output)).toEqual([]);
  });

  it('correctly parses line numbers as integers', () => {
    const output = 'sketch.ino:999:10: fatal error: SomeLib.h: No such file or directory';
    const errors = parseCompileErrors(output);
    expect(errors[0].line).toBe(999);
    expect(typeof errors[0].line).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// suggestLibrariesForErrors — missing include suggestions
// ---------------------------------------------------------------------------

describe('suggestLibrariesForErrors — missing include', () => {
  it('suggests DHT sensor library for DHT.h', () => {
    const errors: CompileError[] = [
      { line: 1, message: 'Missing header: DHT.h', type: 'missing_include' },
    ];
    const suggestions = suggestLibrariesForErrors(errors);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].libraryName).toBe('DHT sensor library');
    expect(suggestions[0].confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('suggests Adafruit NeoPixel for Adafruit_NeoPixel.h', () => {
    const errors: CompileError[] = [
      { line: 2, message: 'Missing header: Adafruit_NeoPixel.h', type: 'missing_include' },
    ];
    const suggestions = suggestLibrariesForErrors(errors);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].libraryName).toBe('Adafruit NeoPixel');
  });

  it('produces no suggestion for built-in headers (Wire.h)', () => {
    const errors: CompileError[] = [
      { line: 1, message: 'Missing header: Wire.h', type: 'missing_include' },
    ];
    const suggestions = suggestLibrariesForErrors(errors);
    expect(suggestions).toHaveLength(0);
  });

  it('produces no suggestion for built-in headers (Servo.h)', () => {
    const errors: CompileError[] = [
      { line: 1, message: 'Missing header: Servo.h', type: 'missing_include' },
    ];
    const suggestions = suggestLibrariesForErrors(errors);
    expect(suggestions).toHaveLength(0);
  });

  it('guesses library name for unknown headers', () => {
    const errors: CompileError[] = [
      { line: 1, message: 'Missing header: SomeCustomLib.h', type: 'missing_include' },
    ];
    const suggestions = suggestLibrariesForErrors(errors);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].libraryName).toBe('SomeCustomLib');
    expect(suggestions[0].confidence).toBeLessThan(0.9);
  });
});

// ---------------------------------------------------------------------------
// suggestLibrariesForErrors — undefined symbol suggestions
// ---------------------------------------------------------------------------

describe('suggestLibrariesForErrors — undefined symbol', () => {
  it('suggests library for known symbol DHT', () => {
    const errors: CompileError[] = [
      { line: 10, message: "Undefined symbol: 'DHT'", type: 'undefined_symbol' },
    ];
    const suggestions = suggestLibrariesForErrors(errors);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].libraryName).toBe('DHT sensor library');
    expect(suggestions[0].confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('suggests IRremote for decode_results symbol', () => {
    const errors: CompileError[] = [
      { line: 5, message: "Undefined symbol: 'decode_results'", type: 'undefined_symbol' },
    ];
    const suggestions = suggestLibrariesForErrors(errors);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].libraryName).toBe('IRremote');
  });

  it('produces no suggestion for unknown symbols', () => {
    const errors: CompileError[] = [
      { line: 5, message: "Undefined symbol: 'myCustomVariable'", type: 'undefined_symbol' },
    ];
    const suggestions = suggestLibrariesForErrors(errors);
    expect(suggestions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// suggestLibrariesForErrors — deduplication & sorting
// ---------------------------------------------------------------------------

describe('suggestLibrariesForErrors — deduplication & sorting', () => {
  it('deduplicates when include and symbol point to same library', () => {
    const errors: CompileError[] = [
      { line: 1, message: 'Missing header: DHT.h', type: 'missing_include' },
      { line: 10, message: "Undefined symbol: 'DHT'", type: 'undefined_symbol' },
    ];
    const suggestions = suggestLibrariesForErrors(errors);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].libraryName).toBe('DHT sensor library');
  });

  it('returns multiple suggestions for different libraries', () => {
    const errors: CompileError[] = [
      { line: 1, message: 'Missing header: Adafruit_NeoPixel.h', type: 'missing_include' },
      { line: 2, message: 'Missing header: DHT.h', type: 'missing_include' },
      { line: 3, message: 'Missing header: FastLED.h', type: 'missing_include' },
    ];
    const suggestions = suggestLibrariesForErrors(errors);
    expect(suggestions).toHaveLength(3);
    const names = suggestions.map((s) => s.libraryName);
    expect(names).toContain('Adafruit NeoPixel');
    expect(names).toContain('DHT sensor library');
    expect(names).toContain('FastLED');
  });

  it('sorts suggestions by descending confidence', () => {
    const errors: CompileError[] = [
      { line: 1, message: 'Missing header: UnknownLib.h', type: 'missing_include' },
      { line: 2, message: 'Missing header: DHT.h', type: 'missing_include' },
    ];
    const suggestions = suggestLibrariesForErrors(errors);
    expect(suggestions.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i - 1].confidence).toBeGreaterThanOrEqual(suggestions[i].confidence);
    }
  });

  it('ignores "other" type errors entirely', () => {
    const errors: CompileError[] = [
      { line: 20, message: "expected ';' before '}' token", type: 'other' },
    ];
    const suggestions = suggestLibrariesForErrors(errors);
    expect(suggestions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// suggestLibrariesForErrors — edge cases
// ---------------------------------------------------------------------------

describe('suggestLibrariesForErrors — edge cases', () => {
  it('returns empty array for empty error list', () => {
    expect(suggestLibrariesForErrors([])).toEqual([]);
  });

  it('returns empty array for null-ish input', () => {
    expect(suggestLibrariesForErrors(null as unknown as CompileError[])).toEqual([]);
  });

  it('each suggestion has a non-empty reason string', () => {
    const errors: CompileError[] = [
      { line: 1, message: 'Missing header: Adafruit_NeoPixel.h', type: 'missing_include' },
      { line: 2, message: "Undefined symbol: 'FastLED'", type: 'undefined_symbol' },
    ];
    const suggestions = suggestLibrariesForErrors(errors);
    for (const s of suggestions) {
      expect(s.reason).toBeTruthy();
      expect(typeof s.reason).toBe('string');
      expect(s.reason.length).toBeGreaterThan(0);
    }
  });

  it('confidence is always in [0, 1]', () => {
    const errors: CompileError[] = [
      { line: 1, message: 'Missing header: DHT.h', type: 'missing_include' },
      { line: 2, message: 'Missing header: SomeCustomLib.h', type: 'missing_include' },
      { line: 3, message: "Undefined symbol: 'AccelStepper'", type: 'undefined_symbol' },
    ];
    const suggestions = suggestLibrariesForErrors(errors);
    for (const s of suggestions) {
      expect(s.confidence).toBeGreaterThanOrEqual(0);
      expect(s.confidence).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// getInstallCommand
// ---------------------------------------------------------------------------

describe('getInstallCommand', () => {
  it('generates correct command for a simple library name', () => {
    const suggestion: LibrarySuggestion = {
      libraryName: 'DHT sensor library',
      confidence: 0.95,
      reason: 'test',
    };
    expect(getInstallCommand(suggestion)).toBe('arduino-cli lib install "DHT sensor library"');
  });

  it('generates command with version when specified', () => {
    const suggestion: LibrarySuggestion = {
      libraryName: 'Adafruit NeoPixel',
      version: '1.12.0',
      confidence: 0.95,
      reason: 'test',
    };
    expect(getInstallCommand(suggestion)).toBe('arduino-cli lib install "Adafruit NeoPixel@1.12.0"');
  });

  it('generates command without version when version is undefined', () => {
    const suggestion: LibrarySuggestion = {
      libraryName: 'FastLED',
      confidence: 0.95,
      reason: 'test',
    };
    const cmd = getInstallCommand(suggestion);
    expect(cmd).toBe('arduino-cli lib install "FastLED"');
    expect(cmd).not.toContain('@');
  });

  it('wraps library name in double quotes', () => {
    const suggestion: LibrarySuggestion = {
      libraryName: 'Adafruit PWM Servo Driver Library',
      confidence: 0.95,
      reason: 'test',
    };
    const cmd = getInstallCommand(suggestion);
    expect(cmd).toContain('"Adafruit PWM Servo Driver Library"');
  });
});

// ---------------------------------------------------------------------------
// INCLUDE_TO_LIBRARY_MAP
// ---------------------------------------------------------------------------

describe('INCLUDE_TO_LIBRARY_MAP', () => {
  it('has at least 50 entries', () => {
    const keys = Object.keys(INCLUDE_TO_LIBRARY_MAP);
    expect(keys.length).toBeGreaterThanOrEqual(50);
  });

  it('maps DHT.h to DHT sensor library', () => {
    expect(INCLUDE_TO_LIBRARY_MAP['DHT.h']).toBe('DHT sensor library');
  });

  it('maps Wire.h to built-in', () => {
    expect(INCLUDE_TO_LIBRARY_MAP['Wire.h']).toBe('built-in');
  });

  it('maps Servo.h to built-in', () => {
    expect(INCLUDE_TO_LIBRARY_MAP['Servo.h']).toBe('built-in');
  });

  it('maps Adafruit_NeoPixel.h to Adafruit NeoPixel', () => {
    expect(INCLUDE_TO_LIBRARY_MAP['Adafruit_NeoPixel.h']).toBe('Adafruit NeoPixel');
  });

  it('maps FastLED.h to FastLED', () => {
    expect(INCLUDE_TO_LIBRARY_MAP['FastLED.h']).toBe('FastLED');
  });

  it('maps ArduinoJson.h to ArduinoJson', () => {
    expect(INCLUDE_TO_LIBRARY_MAP['ArduinoJson.h']).toBe('ArduinoJson');
  });

  it('maps PubSubClient.h to PubSubClient', () => {
    expect(INCLUDE_TO_LIBRARY_MAP['PubSubClient.h']).toBe('PubSubClient');
  });

  it('maps LiquidCrystal_I2C.h to LiquidCrystal I2C', () => {
    expect(INCLUDE_TO_LIBRARY_MAP['LiquidCrystal_I2C.h']).toBe('LiquidCrystal I2C');
  });

  it('maps RTClib.h to RTClib', () => {
    expect(INCLUDE_TO_LIBRARY_MAP['RTClib.h']).toBe('RTClib');
  });

  it('all values are non-empty strings', () => {
    for (const [key, value] of Object.entries(INCLUDE_TO_LIBRARY_MAP)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
      expect(typeof key).toBe('string');
    }
  });

  it('all keys end with .h or .hpp or contain a slash (path headers)', () => {
    for (const key of Object.keys(INCLUDE_TO_LIBRARY_MAP)) {
      const valid = key.endsWith('.h') || key.endsWith('.hpp') || key.includes('/');
      expect(valid).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// End-to-end: compiler output → install command
// ---------------------------------------------------------------------------

describe('end-to-end: output → suggestions → command', () => {
  it('full pipeline for DHT.h missing include', () => {
    const output = 'sketch.ino:3:10: fatal error: DHT.h: No such file or directory';
    const errors = parseCompileErrors(output);
    const suggestions = suggestLibrariesForErrors(errors);
    expect(suggestions.length).toBeGreaterThanOrEqual(1);
    const cmd = getInstallCommand(suggestions[0]);
    expect(cmd).toBe('arduino-cli lib install "DHT sensor library"');
  });

  it('full pipeline for multiple missing libraries', () => {
    const output = [
      'sketch.ino:1:10: fatal error: Adafruit_NeoPixel.h: No such file or directory',
      'sketch.ino:2:10: fatal error: RF24.h: No such file or directory',
    ].join('\n');
    const errors = parseCompileErrors(output);
    const suggestions = suggestLibrariesForErrors(errors);
    expect(suggestions).toHaveLength(2);
    const commands = suggestions.map((s) => getInstallCommand(s));
    expect(commands).toContain('arduino-cli lib install "Adafruit NeoPixel"');
    expect(commands).toContain('arduino-cli lib install "RF24"');
  });

  it('full pipeline for undefined symbol with known mapping', () => {
    const output = "sketch.ino:8:3: error: 'Adafruit_SSD1306' was not declared in this scope";
    const errors = parseCompileErrors(output);
    const suggestions = suggestLibrariesForErrors(errors);
    expect(suggestions.length).toBeGreaterThanOrEqual(1);
    expect(suggestions[0].libraryName).toBe('Adafruit SSD1306');
    const cmd = getInstallCommand(suggestions[0]);
    expect(cmd).toBe('arduino-cli lib install "Adafruit SSD1306"');
  });
});
