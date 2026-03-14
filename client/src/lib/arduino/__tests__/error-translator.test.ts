import { describe, it, expect } from 'vitest';
import { translateCompileError, translateCompileOutput } from '../error-translator';
import type { ErrorTranslation } from '../error-translator';

// ---------------------------------------------------------------------------
// Helper — asserts a non-null translation with expected fields
// ---------------------------------------------------------------------------

function expectTranslation(
  input: string,
  checks: {
    severity?: ErrorTranslation['severity'];
    translatedContains?: string;
    suggestionContains?: string;
    lineNumber?: number;
    file?: string;
  },
): ErrorTranslation {
  const result = translateCompileError(input);
  expect(result).not.toBeNull();
  const t = result!;

  if (checks.severity) {
    expect(t.severity).toBe(checks.severity);
  }
  if (checks.translatedContains) {
    expect(t.translated.toLowerCase()).toContain(checks.translatedContains.toLowerCase());
  }
  if (checks.suggestionContains) {
    expect(t.suggestion.toLowerCase()).toContain(checks.suggestionContains.toLowerCase());
  }
  if (checks.lineNumber !== undefined) {
    expect(t.lineNumber).toBe(checks.lineNumber);
  }
  if (checks.file) {
    expect(t.file).toBe(checks.file);
  }

  return t;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('error-translator', () => {
  // -----------------------------------------------------------------------
  // translateCompileError — Scope / declaration errors
  // -----------------------------------------------------------------------

  describe('scope and declaration errors', () => {
    it('translates "was not declared in this scope"', () => {
      expectTranslation(
        "sketch.ino:10:5: error: 'myVar' was not declared in this scope",
        {
          severity: 'error',
          translatedContains: "doesn't exist",
          suggestionContains: 'spelling',
          lineNumber: 10,
          file: 'sketch.ino',
        },
      );
    });

    it('translates "does not name a type"', () => {
      expectTranslation(
        "sketch.ino:3:1: error: 'WiFiClient' does not name a type",
        {
          severity: 'error',
          translatedContains: 'not recognized as a type',
          suggestionContains: '#include',
        },
      );
    });

    it('translates "use of undeclared identifier"', () => {
      expectTranslation(
        'main.cpp:15:3: error: use of undeclared identifier \'counter\'',
        {
          severity: 'error',
          translatedContains: "hasn't been declared",
          suggestionContains: 'define',
        },
      );
    });
  });

  // -----------------------------------------------------------------------
  // Semicolons and syntax errors
  // -----------------------------------------------------------------------

  describe('syntax errors', () => {
    it('translates "expected \';\' before"', () => {
      expectTranslation(
        "sketch.ino:7:12: error: expected ';' before 'int'",
        {
          severity: 'error',
          translatedContains: 'semicolon',
          suggestionContains: ';',
        },
      );
    });

    it('translates "expected primary-expression"', () => {
      expectTranslation(
        'sketch.ino:20:8: error: expected primary-expression before \')\' token',
        {
          severity: 'error',
          translatedContains: 'syntax error',
          suggestionContains: 'typos',
        },
      );
    });

    it('translates "expected unqualified-id"', () => {
      expectTranslation(
        'sketch.ino:1:1: error: expected unqualified-id before \'{\' token',
        {
          severity: 'error',
          translatedContains: 'syntax error',
          suggestionContains: 'semicolon',
        },
      );
    });

    it('translates "stray \\xxx in program" (numeric)', () => {
      expectTranslation(
        'sketch.ino:5:1: error: stray \'\\342\' in program',
        {
          severity: 'error',
          translatedContains: 'invalid character',
          suggestionContains: 'copy-past',
        },
      );
    });

    it('translates "stray char in program" (character)', () => {
      expectTranslation(
        'sketch.ino:5:1: error: stray \'@\' in program',
        {
          severity: 'error',
          translatedContains: 'invalid character',
          suggestionContains: 'retype',
        },
      );
    });

    it('translates "expected X before Y"', () => {
      expectTranslation(
        "sketch.ino:12:5: error: expected ')' before ';' token",
        {
          severity: 'error',
          translatedContains: 'missing',
          suggestionContains: 'bracket',
        },
      );
    });
  });

  // -----------------------------------------------------------------------
  // Function call errors
  // -----------------------------------------------------------------------

  describe('function call errors', () => {
    it('translates "no matching function for call to"', () => {
      expectTranslation(
        "sketch.ino:14:3: error: no matching function for call to 'Serial.begin'",
        {
          severity: 'error',
          translatedContains: 'wrong arguments',
          suggestionContains: 'function signature',
        },
      );
    });

    it('translates "too few arguments"', () => {
      expectTranslation(
        "sketch.ino:22:3: error: too few arguments to function 'analogWrite'",
        {
          severity: 'error',
          translatedContains: 'not enough arguments',
          suggestionContains: 'missing arguments',
        },
      );
    });

    it('translates "too many arguments"', () => {
      expectTranslation(
        "sketch.ino:30:3: error: too many arguments to function 'digitalRead'",
        {
          severity: 'error',
          translatedContains: 'too many arguments',
          suggestionContains: 'remove',
        },
      );
    });

    it('translates "implicit declaration of function"', () => {
      expectTranslation(
        "sketch.ino:8:3: warning: implicit declaration of function 'myFunc'",
        {
          severity: 'warning',
          translatedContains: 'before it is declared',
          suggestionContains: 'prototype',
        },
      );
    });
  });

  // -----------------------------------------------------------------------
  // Type errors
  // -----------------------------------------------------------------------

  describe('type errors', () => {
    it('translates "invalid conversion from"', () => {
      expectTranslation(
        "sketch.ino:18:10: error: invalid conversion from 'int' to 'char*'",
        {
          severity: 'error',
          translatedContains: 'type mismatch',
          suggestionContains: 'cast',
        },
      );
    });

    it('translates "cannot convert"', () => {
      expectTranslation(
        "sketch.ino:25:12: error: cannot convert 'String' to 'const char*'",
        {
          severity: 'error',
          translatedContains: 'cannot convert',
          suggestionContains: 'cast',
        },
      );
    });

    it('translates "incompatible types"', () => {
      expectTranslation(
        'sketch.ino:30:8: error: incompatible types in assignment',
        {
          severity: 'error',
          translatedContains: "types don't match",
          suggestionContains: 'assignment',
        },
      );
    });
  });

  // -----------------------------------------------------------------------
  // Class / member errors
  // -----------------------------------------------------------------------

  describe('class and member errors', () => {
    it('translates "class has no member named"', () => {
      expectTranslation(
        "'class Servo' has no member named 'writeMicroSeconds'",
        {
          translatedContains: "doesn't have a method",
          suggestionContains: 'documentation',
        },
      );
    });

    it('translates "request for member in non-class type"', () => {
      expectTranslation(
        "sketch.ino:12:5: error: request for member 'length' in 'x', which is of non-class type 'int'",
        {
          severity: 'error',
          translatedContains: 'not an object',
          suggestionContains: 'pointer',
        },
      );
    });
  });

  // -----------------------------------------------------------------------
  // Redefinition / multiple definition
  // -----------------------------------------------------------------------

  describe('redefinition errors', () => {
    it('translates "redefinition of"', () => {
      expectTranslation(
        "sketch.ino:5:6: error: redefinition of 'setup'",
        {
          severity: 'error',
          translatedContains: 'defined more than once',
          suggestionContains: 'rename',
        },
      );
    });

    it('translates "multiple definition of"', () => {
      expectTranslation(
        "main.o:5: error: multiple definition of 'counter'",
        {
          severity: 'error',
          translatedContains: 'more than one file',
          suggestionContains: 'extern',
        },
      );
    });

    it('translates "conflicting declaration"', () => {
      expectTranslation(
        "sketch.ino:10:5: error: conflicting declaration 'float counter'",
        {
          severity: 'error',
          translatedContains: 'different types',
          suggestionContains: 'same type',
        },
      );
    });
  });

  // -----------------------------------------------------------------------
  // Linker errors
  // -----------------------------------------------------------------------

  describe('linker errors', () => {
    it('translates "undefined reference to"', () => {
      expectTranslation(
        "sketch.ino:0: error: undefined reference to `setup'",
        {
          severity: 'error',
          translatedContains: "can't find the code",
          suggestionContains: 'defined',
        },
      );
    });
  });

  // -----------------------------------------------------------------------
  // Include / library errors
  // -----------------------------------------------------------------------

  describe('include and library errors', () => {
    it('translates "No such file or directory"', () => {
      expectTranslation(
        'sketch.ino:1:10: fatal error: WiFi.h: No such file or directory',
        {
          severity: 'error',
          translatedContains: "can't be found",
          suggestionContains: 'library manager',
        },
      );
    });
  });

  // -----------------------------------------------------------------------
  // Return / control flow
  // -----------------------------------------------------------------------

  describe('control flow errors', () => {
    it('translates "control reaches end of non-void function"', () => {
      expectTranslation(
        'sketch.ino:25:1: warning: control reaches end of non-void function',
        {
          severity: 'warning',
          translatedContains: 'return a value',
          suggestionContains: 'return statement',
        },
      );
    });

    it('translates "return-statement with no value"', () => {
      expectTranslation(
        'sketch.ino:18:3: error: return-statement with no value, in function returning \'int\'',
        {
          severity: 'error',
          translatedContains: 'without a value',
          suggestionContains: 'return value',
        },
      );
    });
  });

  // -----------------------------------------------------------------------
  // Array / memory
  // -----------------------------------------------------------------------

  describe('array and memory errors', () => {
    it('translates "variable-length array"', () => {
      expectTranslation(
        'sketch.ino:10:3: error: variable-length array bound is not an integer constant',
        {
          severity: 'error',
          translatedContains: 'not standard',
          suggestionContains: 'constant',
        },
      );
    });

    it('translates "section .text will not fit"', () => {
      expectTranslation(
        "/tmp/build/main.elf:0: error: section '.text' will not fit in region 'text'",
        {
          severity: 'error',
          translatedContains: 'too large',
          suggestionContains: 'reduce code',
        },
      );
    });

    it('translates "region RAM overflowed"', () => {
      expectTranslation(
        '/tmp/build/main.elf:0: error: region \'RAM\' overflowed by 512 bytes',
        {
          severity: 'error',
          translatedContains: 'more ram',
          suggestionContains: 'progmem',
        },
      );
    });
  });

  // -----------------------------------------------------------------------
  // Const / read-only
  // -----------------------------------------------------------------------

  describe('const and read-only errors', () => {
    it('translates "read-only variable"', () => {
      expectTranslation(
        "sketch.ino:15:3: error: assignment of read-only variable 'LED_PIN'",
        {
          severity: 'error',
          translatedContains: 'const',
          suggestionContains: 'remove the const',
        },
      );
    });

    it('translates "lvalue required"', () => {
      expectTranslation(
        'sketch.ino:20:3: error: lvalue required as left operand of assignment',
        {
          severity: 'error',
          translatedContains: 'variable',
          suggestionContains: 'variable name',
        },
      );
    });
  });

  // -----------------------------------------------------------------------
  // String / character
  // -----------------------------------------------------------------------

  describe('string errors', () => {
    it('translates "unterminated string"', () => {
      expectTranslation(
        'sketch.ino:8:15: error: missing terminating " character (unterminated string literal)',
        {
          severity: 'error',
          translatedContains: 'missing',
          suggestionContains: 'quote',
        },
      );
    });
  });

  // -----------------------------------------------------------------------
  // Warnings
  // -----------------------------------------------------------------------

  describe('warnings', () => {
    it('translates "unused variable"', () => {
      expectTranslation(
        "sketch.ino:6:7: warning: unused variable 'temp'",
        {
          severity: 'warning',
          translatedContains: 'never used',
          suggestionContains: 'remove',
        },
      );
    });

    it('translates "comparison between signed and unsigned"', () => {
      expectTranslation(
        'sketch.ino:12:7: warning: comparison between signed and unsigned integer expressions',
        {
          severity: 'warning',
          translatedContains: 'signed',
          suggestionContains: 'cast',
        },
      );
    });

    it('translates "suggest parentheses"', () => {
      expectTranslation(
        'sketch.ino:9:8: warning: suggest parentheses around \'&&\' within \'||\'',
        {
          severity: 'warning',
          translatedContains: 'precedence',
          suggestionContains: 'parentheses',
        },
      );
    });

    it('translates "will be initialized after"', () => {
      expectTranslation(
        "MyClass.cpp:5:3: warning: 'MyClass::b' will be initialized after 'MyClass::a'",
        {
          severity: 'warning',
          translatedContains: 'different order',
          suggestionContains: 'reorder',
        },
      );
    });

    it('translates "ISO C++ forbids"', () => {
      expectTranslation(
        'sketch.ino:15:5: warning: ISO C++ forbids variable length array',
        {
          severity: 'warning',
          translatedContains: 'not part of standard',
          suggestionContains: 'standard c++',
        },
      );
    });
  });

  // -----------------------------------------------------------------------
  // Preprocessor
  // -----------------------------------------------------------------------

  describe('preprocessor errors', () => {
    it('translates "#error directive"', () => {
      expectTranslation(
        'config.h:10:2: error: #error "Board not supported"',
        {
          severity: 'error',
          translatedContains: '#error directive',
          suggestionContains: 'preprocessor',
        },
      );
    });

    it('translates "integer overflow"', () => {
      expectTranslation(
        'sketch.ino:8:20: warning: integer overflow in expression',
        {
          severity: 'warning',
          translatedContains: 'too large',
          suggestionContains: 'larger data type',
        },
      );
    });
  });

  // -----------------------------------------------------------------------
  // Storage size
  // -----------------------------------------------------------------------

  describe('storage size errors', () => {
    it('translates "storage size isn\'t known"', () => {
      expectTranslation(
        "sketch.ino:5:10: error: storage size of 'myStruct' isn't known",
        {
          severity: 'error',
          translatedContains: 'incomplete',
          suggestionContains: '#include',
        },
      );
    });
  });

  // -----------------------------------------------------------------------
  // Arduino-specific upload/serial errors
  // -----------------------------------------------------------------------

  describe('Arduino-specific errors', () => {
    it('translates avrdude sync error', () => {
      expectTranslation(
        'Error: avrdude: stk500_recv(): programmer is not in sync',
        {
          severity: 'error',
          translatedContains: 'cannot communicate',
          suggestionContains: 'reset button',
        },
      );
    });

    it('translates port not found error', () => {
      expectTranslation(
        'Error: serial port /dev/ttyUSB0 not found',
        {
          severity: 'error',
          translatedContains: 'not found',
          suggestionContains: 'plugged in',
        },
      );
    });

    it('translates "Compilation error:" prefix', () => {
      const result = translateCompileError(
        "Compilation error: 'WiFi' was not declared in this scope",
      );
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
      expect(result!.translated.toLowerCase()).toContain("doesn't exist");
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('returns null for empty string', () => {
      expect(translateCompileError('')).toBeNull();
    });

    it('returns null for whitespace-only string', () => {
      expect(translateCompileError('   \n  ')).toBeNull();
    });

    it('returns null for non-diagnostic lines', () => {
      expect(translateCompileError('Compiling sketch...')).toBeNull();
      expect(translateCompileError('Using board uno')).toBeNull();
    });

    it('handles GCC errors without column number', () => {
      const result = translateCompileError(
        "sketch.ino:10: error: 'x' was not declared in this scope",
      );
      expect(result).not.toBeNull();
      expect(result!.lineNumber).toBe(10);
      expect(result!.file).toBe('sketch.ino');
    });

    it('handles fatal error severity', () => {
      const result = translateCompileError(
        'sketch.ino:1:10: fatal error: SomeLib.h: No such file or directory',
      );
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });

    it('provides fallback translation for unrecognized GCC errors', () => {
      const result = translateCompileError(
        'sketch.ino:5:3: error: some weird unique error message xyz123',
      );
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
      expect(result!.translated).toBe('some weird unique error message xyz123');
      expect(result!.suggestion).toBeTruthy();
    });

    it('provides fallback for generic Error: lines', () => {
      const result = translateCompileError(
        'Error: some unrecognized error message',
      );
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });

    it('preserves original line in output', () => {
      const input = "sketch.ino:10:5: error: 'x' was not declared in this scope";
      const result = translateCompileError(input);
      expect(result!.original).toBe(input);
    });
  });

  // -----------------------------------------------------------------------
  // translateCompileOutput — batch translation
  // -----------------------------------------------------------------------

  describe('translateCompileOutput', () => {
    it('returns empty array for empty input', () => {
      expect(translateCompileOutput('')).toEqual([]);
    });

    it('returns empty array for whitespace input', () => {
      expect(translateCompileOutput('  \n  \n  ')).toEqual([]);
    });

    it('translates multiple errors from compile output', () => {
      const output = [
        'Compiling sketch...',
        "sketch.ino:10:5: error: 'x' was not declared in this scope",
        "sketch.ino:15:3: warning: unused variable 'temp'",
        'Using board Arduino Uno',
        "sketch.ino:20:1: error: expected ';' before '}' token",
        'exit status 1',
      ].join('\n');

      const translations = translateCompileOutput(output);
      // Should get 3 diagnostics: the 2 errors + 1 warning
      // "exit status 1" is not a diagnostic with location
      expect(translations.length).toBeGreaterThanOrEqual(2);

      const errors = translations.filter(t => t.severity === 'error');
      const warnings = translations.filter(t => t.severity === 'warning');
      expect(errors.length).toBe(2);
      expect(warnings.length).toBe(1);
    });

    it('skips non-diagnostic lines', () => {
      const output = [
        'Compiling sketch...',
        'Using board Arduino Uno',
        'Sketch uses 1234 bytes',
      ].join('\n');

      const translations = translateCompileOutput(output);
      expect(translations).toEqual([]);
    });

    it('handles multi-file errors', () => {
      const output = [
        "main.ino:5:3: error: 'x' was not declared in this scope",
        "helpers.h:10:1: error: 'WiFiClient' does not name a type",
      ].join('\n');

      const translations = translateCompileOutput(output);
      expect(translations).toHaveLength(2);
      expect(translations[0].file).toBe('main.ino');
      expect(translations[1].file).toBe('helpers.h');
    });
  });
});
