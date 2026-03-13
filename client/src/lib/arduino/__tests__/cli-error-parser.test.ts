import { describe, it, expect } from 'vitest';
import {
  parseCompileOutput,
  getHint,
  formatDiagnostic,
  groupByFile,
} from '../cli-error-parser';
import type {
  CompileDiagnostic,
  ParseResult,
  DiagnosticSeverity,
} from '../cli-error-parser';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDiagnostic(overrides: Partial<CompileDiagnostic> = {}): CompileDiagnostic {
  return {
    file: 'sketch.ino',
    line: 1,
    column: 0,
    severity: 'error',
    message: 'test message',
    rawLine: 'sketch.ino:1: error: test message',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// parseCompileOutput — GCC format
// ---------------------------------------------------------------------------

describe('parseCompileOutput', () => {
  describe('GCC diagnostic format', () => {
    it('parses a standard GCC error with file:line:col', () => {
      const stderr = 'sketch.ino:42:5: error: expected \';\' before \'}\' token';
      const result = parseCompileOutput(stderr);

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].file).toBe('sketch.ino');
      expect(result.diagnostics[0].line).toBe(42);
      expect(result.diagnostics[0].column).toBe(5);
      expect(result.diagnostics[0].severity).toBe('error');
      expect(result.diagnostics[0].message).toContain('expected');
      expect(result.summary.errors).toBe(1);
    });

    it('parses a GCC warning', () => {
      const stderr = 'main.cpp:10:3: warning: unused variable \'x\' [-Wunused-variable]';
      const result = parseCompileOutput(stderr);

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].severity).toBe('warning');
      expect(result.diagnostics[0].file).toBe('main.cpp');
      expect(result.diagnostics[0].line).toBe(10);
      expect(result.diagnostics[0].column).toBe(3);
      expect(result.summary.warnings).toBe(1);
      expect(result.summary.errors).toBe(0);
    });

    it('parses a GCC note', () => {
      const stderr = 'lib/Servo.h:20:6: note: candidate expects 2 arguments, 1 provided';
      const result = parseCompileOutput(stderr);

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].severity).toBe('note');
      expect(result.summary.notes).toBe(1);
    });

    it('parses a fatal error as severity "error"', () => {
      const stderr = 'sketch.ino:1:10: fatal error: NonExistent.h: No such file or directory';
      const result = parseCompileOutput(stderr);

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].severity).toBe('error');
      expect(result.diagnostics[0].message).toContain('No such file or directory');
    });

    it('handles GCC format without column number', () => {
      const stderr = '/tmp/build/sketch.ino:15: error: \'foo\' was not declared in this scope';
      const result = parseCompileOutput(stderr);

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].line).toBe(15);
      expect(result.diagnostics[0].column).toBe(0);
      expect(result.diagnostics[0].file).toBe('/tmp/build/sketch.ino');
    });

    it('parses multiple diagnostics from multi-line output', () => {
      const stderr = [
        'sketch.ino:10:5: error: \'myVar\' was not declared in this scope',
        'sketch.ino:10:5: note: suggested alternative: \'myVAR\'',
        'sketch.ino:20:1: warning: control reaches end of non-void function',
      ].join('\n');

      const result = parseCompileOutput(stderr);

      expect(result.diagnostics).toHaveLength(3);
      expect(result.summary.errors).toBe(1);
      expect(result.summary.warnings).toBe(1);
      expect(result.summary.notes).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Toolchain detection
  // -------------------------------------------------------------------------

  describe('toolchain detection', () => {
    it('detects avr-gcc toolchain', () => {
      const stderr =
        '/usr/lib/avr-gcc/sketch.ino:10:5: error: \'x\' was not declared in this scope';
      const result = parseCompileOutput(stderr);

      expect(result.diagnostics[0].toolchain).toBe('avr-gcc');
    });

    it('detects xtensa (ESP32) toolchain', () => {
      const stderr =
        '/home/user/.platformio/packages/toolchain-xtensa/bin/xtensa-esp32-elf-g++:5:1: error: test';
      const result = parseCompileOutput(stderr);

      expect(result.diagnostics[0].toolchain).toBe('xtensa-gcc');
    });

    it('detects arm-none-eabi toolchain', () => {
      const stderr =
        '/usr/bin/arm-none-eabi-gcc/src/main.cpp:3:1: error: test error';
      const result = parseCompileOutput(stderr);

      expect(result.diagnostics[0].toolchain).toBe('arm-gcc');
    });

    it('returns undefined toolchain for unknown paths', () => {
      const stderr = 'sketch.ino:1:1: error: test';
      const result = parseCompileOutput(stderr);

      expect(result.diagnostics[0].toolchain).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Linker errors
  // -------------------------------------------------------------------------

  describe('linker errors', () => {
    it('parses undefined reference with backtick quotes', () => {
      const stderr = '/tmp/build/sketch.ino.o:10: undefined reference to `setup\'';
      const result = parseCompileOutput(stderr);

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].severity).toBe('error');
      expect(result.diagnostics[0].message).toContain('undefined reference');
      expect(result.diagnostics[0].message).toContain('setup');
      expect(result.diagnostics[0].hint).toBeDefined();
    });

    it('parses undefined reference with single quotes', () => {
      const stderr = "sketch.o:5: undefined reference to 'loop'";
      const result = parseCompileOutput(stderr);

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].message).toContain("undefined reference to 'loop'");
    });

    it('parses multiple definition linker error', () => {
      const stderr = "build/lib.o:20: multiple definition of 'globalVar'";
      const result = parseCompileOutput(stderr);

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].severity).toBe('error');
      expect(result.diagnostics[0].message).toContain('multiple definition');
      expect(result.diagnostics[0].hint).toBe('Function defined in more than one file');
    });

    it('parses linker error without line number', () => {
      const stderr = "sketch.o: undefined reference to 'missingFunc'";
      const result = parseCompileOutput(stderr);

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].line).toBe(0);
      expect(result.diagnostics[0].file).toBe('sketch.o');
    });
  });

  // -------------------------------------------------------------------------
  // Arduino-specific errors
  // -------------------------------------------------------------------------

  describe('Arduino-specific errors', () => {
    it('parses "Compilation error:" lines', () => {
      const stderr = 'Compilation error: exit status 1';
      const result = parseCompileOutput(stderr);

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].severity).toBe('error');
      expect(result.diagnostics[0].file).toBe('<arduino>');
      expect(result.diagnostics[0].message).toBe('exit status 1');
    });

    it('parses "Error:" lines', () => {
      const stderr = 'Error: 2 UNKNOWN: platform not installed';
      const result = parseCompileOutput(stderr);

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].severity).toBe('error');
      expect(result.diagnostics[0].file).toBe('<arduino>');
    });

    it('parses upload errors', () => {
      const stderr = 'An error occurred while uploading: programmer not responding';
      const result = parseCompileOutput(stderr);

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].severity).toBe('error');
      expect(result.diagnostics[0].file).toBe('<upload>');
      expect(result.diagnostics[0].message).toBe('programmer not responding');
    });

    it('parses "Upload error:" variant', () => {
      const stderr = 'Upload error: port not found';
      const result = parseCompileOutput(stderr);

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].file).toBe('<upload>');
      expect(result.diagnostics[0].message).toBe('port not found');
    });

    it('extracts exit status code', () => {
      const stderr = [
        'sketch.ino:5:1: error: expected \';\' before \'}\' token',
        '',
        'exit status 1',
      ].join('\n');

      const result = parseCompileOutput(stderr);

      expect(result.exitCode).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('returns empty result for empty string', () => {
      const result = parseCompileOutput('');

      expect(result.diagnostics).toHaveLength(0);
      expect(result.summary.errors).toBe(0);
      expect(result.summary.warnings).toBe(0);
      expect(result.summary.notes).toBe(0);
      expect(result.exitCode).toBeUndefined();
    });

    it('returns empty result for whitespace-only string', () => {
      const result = parseCompileOutput('   \n  \n   ');

      expect(result.diagnostics).toHaveLength(0);
    });

    it('skips unrecognized lines gracefully', () => {
      const stderr = [
        'Some informational output from arduino-cli',
        'sketch.ino:10:1: error: test error',
        'Compiling libraries...',
        'Linking everything together...',
      ].join('\n');

      const result = parseCompileOutput(stderr);

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].line).toBe(10);
    });

    it('handles Windows-style paths', () => {
      const stderr = 'C:\\Users\\dev\\sketch.ino:5:3: error: test';
      const result = parseCompileOutput(stderr);

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].file).toBe('C:\\Users\\dev\\sketch.ino');
      expect(result.diagnostics[0].line).toBe(5);
    });

    it('handles deeply nested file paths', () => {
      const stderr =
        '/home/user/.arduino15/packages/esp32/tools/xtensa-esp32-elf-gcc/src/main.cpp:100:20: warning: test';
      const result = parseCompileOutput(stderr);

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].line).toBe(100);
      expect(result.diagnostics[0].column).toBe(20);
      expect(result.diagnostics[0].toolchain).toBe('xtensa-gcc');
    });

    it('preserves rawLine for each diagnostic', () => {
      const line = 'sketch.ino:1:1: error: something went wrong';
      const result = parseCompileOutput(line);

      expect(result.diagnostics[0].rawLine).toBe(line);
    });

    it('handles mixed GCC + Arduino errors in one output', () => {
      const stderr = [
        'sketch.ino:5:10: error: \'WiFi\' was not declared in this scope',
        'sketch.ino:5:10: note: did you mean \'WiFiClass\'?',
        'Compilation error: exit status 1',
        'exit status 1',
      ].join('\n');

      const result = parseCompileOutput(stderr);

      expect(result.diagnostics).toHaveLength(3);
      expect(result.diagnostics[0].severity).toBe('error');
      expect(result.diagnostics[1].severity).toBe('note');
      expect(result.diagnostics[2].severity).toBe('error');
      expect(result.exitCode).toBe(1);
      expect(result.summary.errors).toBe(2);
      expect(result.summary.notes).toBe(1);
    });

    it('handles exit status with various codes', () => {
      expect(parseCompileOutput('exit status 0').exitCode).toBe(0);
      expect(parseCompileOutput('exit status 2').exitCode).toBe(2);
      expect(parseCompileOutput('exit status 127').exitCode).toBe(127);
    });
  });

  // -------------------------------------------------------------------------
  // Summary calculation
  // -------------------------------------------------------------------------

  describe('summary', () => {
    it('correctly counts errors, warnings, and notes', () => {
      const stderr = [
        'a.cpp:1:1: error: error1',
        'a.cpp:2:1: error: error2',
        'a.cpp:3:1: warning: warn1',
        'a.cpp:4:1: note: note1',
        'a.cpp:5:1: note: note2',
        'a.cpp:6:1: note: note3',
      ].join('\n');

      const result = parseCompileOutput(stderr);

      expect(result.summary.errors).toBe(2);
      expect(result.summary.warnings).toBe(1);
      expect(result.summary.notes).toBe(3);
    });

    it('counts zero for categories with no matches', () => {
      const stderr = 'a.cpp:1:1: warning: only warnings here';
      const result = parseCompileOutput(stderr);

      expect(result.summary.errors).toBe(0);
      expect(result.summary.warnings).toBe(1);
      expect(result.summary.notes).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// getHint
// ---------------------------------------------------------------------------

describe('getHint', () => {
  it('returns hint for "was not declared in this scope"', () => {
    const diag = makeDiagnostic({ message: "'myVar' was not declared in this scope" });
    expect(getHint(diag)).toBe('Check spelling, or add #include for the library');
  });

  it('returns hint for "no matching function for call to"', () => {
    const diag = makeDiagnostic({ message: "no matching function for call to 'foo(int, int)'" });
    expect(getHint(diag)).toBe('Check argument types and count');
  });

  it('returns hint for "expected \';\'"', () => {
    const diag = makeDiagnostic({ message: "expected ';' before '}' token" });
    expect(getHint(diag)).toBe('Missing semicolon on the previous line');
  });

  it('returns hint for Serial not declared', () => {
    const diag = makeDiagnostic({ message: "'Serial' was not declared in this scope" });
    // Matches "was not declared in this scope" rule
    expect(getHint(diag)).toBe('Check spelling, or add #include for the library');
  });

  it('returns hint for "no such file or directory"', () => {
    const diag = makeDiagnostic({ message: 'SomeLib.h: No such file or directory' });
    expect(getHint(diag)).toBe('Library not installed — use Library Manager');
  });

  it('returns hint for "multiple definition of"', () => {
    const diag = makeDiagnostic({ message: "multiple definition of 'handleISR'" });
    expect(getHint(diag)).toBe('Function defined in more than one file');
  });

  it('returns hint for "redefinition of"', () => {
    const diag = makeDiagnostic({ message: "redefinition of 'class Foo'" });
    expect(getHint(diag)).toBe('Same name used twice — rename one');
  });

  it('returns hint for "invalid conversion from"', () => {
    const diag = makeDiagnostic({ message: "invalid conversion from 'int' to 'char*'" });
    expect(getHint(diag)).toBe('Type mismatch — check variable types');
  });

  it('returns hint for "expected primary-expression"', () => {
    const diag = makeDiagnostic({ message: "expected primary-expression before ')' token" });
    expect(getHint(diag)).toBe('Syntax error — check for typos or missing operators');
  });

  it('returns hint for "control reaches end of non-void function"', () => {
    const diag = makeDiagnostic({ message: 'control reaches end of non-void function' });
    expect(getHint(diag)).toBe('Function needs a return statement in all code paths');
  });

  it('returns hint for "array subscript"', () => {
    const diag = makeDiagnostic({ message: 'array subscript has type \'char\'' });
    expect(getHint(diag)).toBe('Array index out of bounds or wrong type');
  });

  it('returns hint for "undefined reference to"', () => {
    const diag = makeDiagnostic({ message: "undefined reference to 'setup'" });
    expect(getHint(diag)).toBe('Function declared but not defined — check linking or spelling');
  });

  it('returns hint for "cannot convert"', () => {
    const diag = makeDiagnostic({ message: "cannot convert 'String' to 'int'" });
    expect(getHint(diag)).toBe('Incompatible types — use an explicit cast or fix the type');
  });

  it('returns hint for "expected ... before"', () => {
    const diag = makeDiagnostic({ message: "expected '}' before 'else'" });
    expect(getHint(diag)).toBe('Missing bracket, parenthesis, or keyword before this point');
  });

  it('returns hint for "too few arguments"', () => {
    const diag = makeDiagnostic({ message: 'too few arguments to function \'analogWrite\'' });
    expect(getHint(diag)).toBe('Function call is missing required arguments');
  });

  it('returns hint for "too many arguments"', () => {
    const diag = makeDiagnostic({ message: 'too many arguments to function \'digitalRead\'' });
    expect(getHint(diag)).toBe('Function call has extra arguments — check the signature');
  });

  it('returns hint for "implicit declaration of function"', () => {
    const diag = makeDiagnostic({ message: "implicit declaration of function 'delay'" });
    expect(getHint(diag)).toBe('Function used before it is declared — add a prototype or #include');
  });

  it('returns hint for "incompatible types"', () => {
    const diag = makeDiagnostic({ message: 'incompatible types when assigning' });
    expect(getHint(diag)).toBe('Mismatched types — check assignment or return type');
  });

  it('returns hint for "variable-length array"', () => {
    const diag = makeDiagnostic({ message: 'variable-length array declaration' });
    expect(getHint(diag)).toBe('Use a constant or #define for the array size');
  });

  it('returns hint for "unused variable"', () => {
    const diag = makeDiagnostic({ message: "unused variable 'temp'" });
    expect(getHint(diag)).toBe('Remove the variable or prefix with (void) to suppress');
  });

  it('returns hint for "comparison between signed and unsigned"', () => {
    const diag = makeDiagnostic({ message: 'comparison between signed and unsigned integer expressions' });
    expect(getHint(diag)).toBe('Cast to the same type or change the variable declaration');
  });

  it('returns hint for "will be initialized after"', () => {
    const diag = makeDiagnostic({ message: "'member' will be initialized after 'other'" });
    expect(getHint(diag)).toBe('Reorder member initializers to match declaration order');
  });

  it('returns hint for "suggest parentheses"', () => {
    const diag = makeDiagnostic({ message: 'suggest parentheses around assignment' });
    expect(getHint(diag)).toBe('Add parentheses to clarify operator precedence');
  });

  it('returns hint for "does not name a type"', () => {
    const diag = makeDiagnostic({ message: "'SomeType' does not name a type" });
    expect(getHint(diag)).toBe('Missing #include or misspelled type name');
  });

  it('returns hint for "storage size isn\'t known"', () => {
    const diag = makeDiagnostic({ message: "storage size of 'x' isn't known" });
    expect(getHint(diag)).toBe('Incomplete type — check #include or forward declaration');
  });

  it('returns hint for "lvalue required"', () => {
    const diag = makeDiagnostic({ message: 'lvalue required as left operand of assignment' });
    expect(getHint(diag)).toBe('Left side of assignment must be a variable, not an expression');
  });

  it('returns hint for "read-only variable"', () => {
    const diag = makeDiagnostic({ message: 'assignment of read-only variable' });
    expect(getHint(diag)).toBe('Cannot modify a const variable — remove const or use a different variable');
  });

  it('returns hint for "unterminated string"', () => {
    const diag = makeDiagnostic({ message: 'missing terminating " character / unterminated string' });
    expect(getHint(diag)).toBe('Missing closing quote on a string literal');
  });

  it('returns hint for "stray in program"', () => {
    const diag = makeDiagnostic({ message: "stray '\\302' in program" });
    expect(getHint(diag)).toBe('Invalid character in source — check for copy-paste artifacts');
  });

  it('returns hint for "conflicting declaration"', () => {
    const diag = makeDiagnostic({ message: "conflicting declaration 'int x'" });
    expect(getHint(diag)).toBe('Same name declared with different types — rename one');
  });

  it('returns hint for "#error"', () => {
    const diag = makeDiagnostic({ message: '#error "Board not supported"' });
    expect(getHint(diag)).toBe('A #error directive was triggered — check preprocessor conditions');
  });

  it('returns hint for "expected unqualified-id"', () => {
    const diag = makeDiagnostic({ message: 'expected unqualified-id before numeric constant' });
    expect(getHint(diag)).toBe('Syntax error — possibly a misplaced keyword or extra semicolon');
  });

  it('returns hint for "ISO C++ forbids"', () => {
    const diag = makeDiagnostic({ message: 'ISO C++ forbids variable length array' });
    expect(getHint(diag)).toBe('Non-standard C++ usage — check language compatibility');
  });

  it('returns hint for "overflows"', () => {
    const diag = makeDiagnostic({ message: "integer overflow: value '300' overflows 'uint8_t'" });
    expect(getHint(diag)).toBe('Value is too large for the target type — use a wider type');
  });

  it('returns hint for "section will not fit"', () => {
    const diag = makeDiagnostic({ message: 'section .text will not fit in region text' });
    expect(getHint(diag)).toBe('Program too large for the target — reduce code or data size');
  });

  it('returns hint for "region overflowed"', () => {
    const diag = makeDiagnostic({ message: "region 'FLASH' overflowed by 1024 bytes" });
    expect(getHint(diag)).toBe('Not enough memory — reduce global variables or code size');
  });

  it('returns undefined for unrecognized messages', () => {
    const diag = makeDiagnostic({ message: 'something totally unknown and weird' });
    expect(getHint(diag)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// formatDiagnostic
// ---------------------------------------------------------------------------

describe('formatDiagnostic', () => {
  it('formats a diagnostic with column', () => {
    const d = makeDiagnostic({
      file: 'main.cpp',
      line: 42,
      column: 5,
      severity: 'error',
      message: 'test message',
    });

    expect(formatDiagnostic(d)).toBe('error: main.cpp:42:5 — test message');
  });

  it('formats a diagnostic without column (column = 0)', () => {
    const d = makeDiagnostic({
      file: 'lib.cpp',
      line: 10,
      column: 0,
      severity: 'warning',
      message: 'unused var',
    });

    expect(formatDiagnostic(d)).toBe('warning: lib.cpp:10 — unused var');
  });

  it('formats a note severity', () => {
    const d = makeDiagnostic({
      severity: 'note',
      message: 'candidate here',
    });

    expect(formatDiagnostic(d)).toMatch(/^note:/);
  });

  it('formats an info severity', () => {
    const d = makeDiagnostic({
      severity: 'info',
      message: 'informational',
    });

    expect(formatDiagnostic(d)).toMatch(/^info:/);
  });
});

// ---------------------------------------------------------------------------
// groupByFile
// ---------------------------------------------------------------------------

describe('groupByFile', () => {
  it('groups diagnostics by file path', () => {
    const diagnostics: CompileDiagnostic[] = [
      makeDiagnostic({ file: 'a.cpp', line: 1 }),
      makeDiagnostic({ file: 'b.cpp', line: 2 }),
      makeDiagnostic({ file: 'a.cpp', line: 3 }),
      makeDiagnostic({ file: 'c.cpp', line: 4 }),
      makeDiagnostic({ file: 'b.cpp', line: 5 }),
    ];

    const groups = groupByFile(diagnostics);

    expect(groups.size).toBe(3);
    expect(groups.get('a.cpp')).toHaveLength(2);
    expect(groups.get('b.cpp')).toHaveLength(2);
    expect(groups.get('c.cpp')).toHaveLength(1);
  });

  it('maintains insertion order within each group', () => {
    const diagnostics: CompileDiagnostic[] = [
      makeDiagnostic({ file: 'a.cpp', line: 10 }),
      makeDiagnostic({ file: 'a.cpp', line: 5 }),
      makeDiagnostic({ file: 'a.cpp', line: 20 }),
    ];

    const groups = groupByFile(diagnostics);
    const aGroup = groups.get('a.cpp')!;

    expect(aGroup[0].line).toBe(10);
    expect(aGroup[1].line).toBe(5);
    expect(aGroup[2].line).toBe(20);
  });

  it('returns empty map for empty input', () => {
    const groups = groupByFile([]);
    expect(groups.size).toBe(0);
  });

  it('handles single diagnostic', () => {
    const groups = groupByFile([makeDiagnostic({ file: 'only.cpp' })]);
    expect(groups.size).toBe(1);
    expect(groups.get('only.cpp')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Hint auto-attachment via parseCompileOutput
// ---------------------------------------------------------------------------

describe('hint auto-attachment', () => {
  it('attaches hints to parsed diagnostics', () => {
    const stderr = "sketch.ino:5:1: error: 'myVar' was not declared in this scope";
    const result = parseCompileOutput(stderr);

    expect(result.diagnostics[0].hint).toBe('Check spelling, or add #include for the library');
  });

  it('attaches hint to linker undefined reference', () => {
    const stderr = "sketch.o:10: undefined reference to 'setup'";
    const result = parseCompileOutput(stderr);

    expect(result.diagnostics[0].hint).toBe(
      'Function declared but not defined — check linking or spelling',
    );
  });

  it('attaches hint to Arduino "No such file or directory"', () => {
    const stderr = 'sketch.ino:1:10: fatal error: WiFi.h: No such file or directory';
    const result = parseCompileOutput(stderr);

    expect(result.diagnostics[0].hint).toBe('Library not installed — use Library Manager');
  });

  it('does not attach hint for messages with no matching rule', () => {
    const stderr = 'sketch.ino:1:1: error: some unique unknown error that matches nothing';
    const result = parseCompileOutput(stderr);

    expect(result.diagnostics[0].hint).toBeUndefined();
  });

  it('attaches hint to memory overflow linker errors', () => {
    const stderr = "sketch.ino:1:1: error: region 'FLASH' overflowed by 2048 bytes";
    const result = parseCompileOutput(stderr);

    expect(result.diagnostics[0].hint).toBe('Not enough memory — reduce global variables or code size');
  });
});

// ---------------------------------------------------------------------------
// Realistic multi-error scenarios
// ---------------------------------------------------------------------------

describe('realistic scenarios', () => {
  it('parses a typical Arduino compile failure', () => {
    const stderr = [
      '/tmp/arduino/sketch/sketch.ino:3:1: error: \'WiFi\' was not declared in this scope',
      '/tmp/arduino/sketch/sketch.ino:3:1: note: suggested alternative: \'WiFiClass\'',
      '/tmp/arduino/sketch/sketch.ino:10:12: error: \'ssid\' was not declared in this scope',
      '/tmp/arduino/sketch/sketch.ino:15:3: warning: unused variable \'led\' [-Wunused-variable]',
      '',
      'exit status 1',
      'Compilation error: exit status 1',
    ].join('\n');

    const result = parseCompileOutput(stderr);

    expect(result.diagnostics).toHaveLength(5); // 2 errors + 1 note + 1 warning + 1 Compilation error
    expect(result.summary.errors).toBe(3); // 2 GCC errors + "Compilation error"
    expect(result.summary.warnings).toBe(1);
    expect(result.summary.notes).toBe(1);
    expect(result.exitCode).toBe(1);
  });

  it('parses ESP32 xtensa output', () => {
    const stderr = [
      '/home/user/.platformio/packages/toolchain-xtensa/xtensa-esp32-elf-gcc/src/main.cpp:25:3: error: no matching function for call to \'WiFi.begin()\'',
      '/home/user/.platformio/packages/toolchain-xtensa/xtensa-esp32-elf-gcc/src/main.cpp:25:3: note: candidate: void WiFiClass::begin(const char*, const char*)',
    ].join('\n');

    const result = parseCompileOutput(stderr);

    expect(result.diagnostics).toHaveLength(2);
    expect(result.diagnostics[0].toolchain).toBe('xtensa-gcc');
    expect(result.diagnostics[0].hint).toBe('Check argument types and count');
    expect(result.diagnostics[1].toolchain).toBe('xtensa-gcc');
  });

  it('parses AVR linker failure', () => {
    const stderr = [
      '/usr/lib/avr/bin/avr-gcc/sketch.o: undefined reference to `customFunction\'',
      '/usr/lib/avr/bin/avr-gcc/lib.o:15: multiple definition of \'globalVar\'',
    ].join('\n');

    const result = parseCompileOutput(stderr);

    expect(result.diagnostics).toHaveLength(2);
    expect(result.diagnostics[0].toolchain).toBe('avr-gcc');
    expect(result.diagnostics[1].toolchain).toBe('avr-gcc');
  });

  it('parses ARM Cortex-M output', () => {
    const stderr =
      '/opt/arm-none-eabi-gcc/stm32/main.c:50:10: error: implicit declaration of function \'HAL_Init\'';
    const result = parseCompileOutput(stderr);

    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].toolchain).toBe('arm-gcc');
    expect(result.diagnostics[0].hint).toBe(
      'Function used before it is declared — add a prototype or #include',
    );
  });
});

// ---------------------------------------------------------------------------
// Type exports (compile-time checks)
// ---------------------------------------------------------------------------

describe('type exports', () => {
  it('exports CompileDiagnostic interface', () => {
    const d: CompileDiagnostic = makeDiagnostic();
    expect(d.file).toBeDefined();
  });

  it('exports ParseResult interface', () => {
    const r: ParseResult = {
      diagnostics: [],
      summary: { errors: 0, warnings: 0, notes: 0 },
    };
    expect(r.summary.errors).toBe(0);
  });

  it('exports DiagnosticSeverity type', () => {
    const s: DiagnosticSeverity = 'error';
    expect(s).toBe('error');
  });
});
