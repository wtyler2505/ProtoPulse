// ---------------------------------------------------------------------------
// Arduino CLI Compile/Upload Error Parser
// ---------------------------------------------------------------------------
// Parses stderr from arduino-cli compile / upload commands into structured
// diagnostics with severity, location, and plain-English hints.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DiagnosticSeverity = 'error' | 'warning' | 'note' | 'info';

export interface CompileDiagnostic {
  file: string;
  line: number;
  column: number;
  severity: DiagnosticSeverity;
  message: string;
  hint?: string;
  rawLine: string;
  toolchain?: string;
}

export interface ParseSummary {
  errors: number;
  warnings: number;
  notes: number;
}

export interface ParseResult {
  diagnostics: CompileDiagnostic[];
  summary: ParseSummary;
  exitCode?: number;
}

// ---------------------------------------------------------------------------
// Toolchain detection
// ---------------------------------------------------------------------------

/** Detect the toolchain from a compiler path or file path in the diagnostic. */
function detectToolchain(filePath: string): string | undefined {
  if (/avr-g(?:cc|\+\+)/.test(filePath) || /\/avr\//.test(filePath)) {
    return 'avr-gcc';
  }
  if (/xtensa-(?:esp32|lx106)-elf-g(?:cc|\+\+)/.test(filePath) || /\/xtensa/.test(filePath)) {
    return 'xtensa-gcc';
  }
  if (/arm-none-eabi-g(?:cc|\+\+)/.test(filePath) || /\/arm-none-eabi\//.test(filePath)) {
    return 'arm-gcc';
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Hint database — 25+ common GCC/Arduino error patterns → plain-English hints
// ---------------------------------------------------------------------------

interface HintRule {
  pattern: RegExp;
  hint: string;
}

const HINT_RULES: HintRule[] = [
  {
    pattern: /was not declared in this scope/i,
    hint: 'Check spelling, or add #include for the library',
  },
  {
    pattern: /no matching function for call to/i,
    hint: 'Check argument types and count',
  },
  {
    pattern: /expected\s+['''];\s*[''']|expected\s+';'/i,
    hint: 'Missing semicolon on the previous line',
  },
  {
    pattern: /[''"']Serial['''"']\s*was not declared/i,
    hint: "Add #include <Arduino.h> or check board selection",
  },
  {
    pattern: /no such file or directory/i,
    hint: 'Library not installed — use Library Manager',
  },
  {
    pattern: /multiple definition of/i,
    hint: 'Function defined in more than one file',
  },
  {
    pattern: /redefinition of/i,
    hint: 'Same name used twice — rename one',
  },
  {
    pattern: /invalid conversion from/i,
    hint: 'Type mismatch — check variable types',
  },
  {
    pattern: /expected primary-expression/i,
    hint: 'Syntax error — check for typos or missing operators',
  },
  {
    pattern: /control reaches end of non-void function/i,
    hint: 'Function needs a return statement in all code paths',
  },
  {
    pattern: /array subscript/i,
    hint: 'Array index out of bounds or wrong type',
  },
  {
    pattern: /undefined reference to/i,
    hint: 'Function declared but not defined — check linking or spelling',
  },
  {
    pattern: /cannot convert/i,
    hint: 'Incompatible types — use an explicit cast or fix the type',
  },
  {
    pattern: /expected.*before/i,
    hint: 'Missing bracket, parenthesis, or keyword before this point',
  },
  {
    pattern: /too few arguments/i,
    hint: 'Function call is missing required arguments',
  },
  {
    pattern: /too many arguments/i,
    hint: 'Function call has extra arguments — check the signature',
  },
  {
    pattern: /implicit declaration of function/i,
    hint: 'Function used before it is declared — add a prototype or #include',
  },
  {
    pattern: /incompatible types/i,
    hint: 'Mismatched types — check assignment or return type',
  },
  {
    pattern: /variable[- ]length array/i,
    hint: 'Use a constant or #define for the array size',
  },
  {
    pattern: /unused variable/i,
    hint: 'Remove the variable or prefix with (void) to suppress',
  },
  {
    pattern: /comparison between signed and unsigned/i,
    hint: 'Cast to the same type or change the variable declaration',
  },
  {
    pattern: /will be initialized after/i,
    hint: 'Reorder member initializers to match declaration order',
  },
  {
    pattern: /suggest parentheses/i,
    hint: 'Add parentheses to clarify operator precedence',
  },
  {
    pattern: /does not name a type/i,
    hint: 'Missing #include or misspelled type name',
  },
  {
    pattern: /storage size.*isn['']t known/i,
    hint: 'Incomplete type — check #include or forward declaration',
  },
  {
    pattern: /lvalue required/i,
    hint: 'Left side of assignment must be a variable, not an expression',
  },
  {
    pattern: /read-only variable/i,
    hint: 'Cannot modify a const variable — remove const or use a different variable',
  },
  {
    pattern: /unterminated.*string/i,
    hint: 'Missing closing quote on a string literal',
  },
  {
    pattern: /stray.*in program/i,
    hint: 'Invalid character in source — check for copy-paste artifacts',
  },
  {
    pattern: /conflicting declaration/i,
    hint: 'Same name declared with different types — rename one',
  },
  {
    pattern: /#error/i,
    hint: 'A #error directive was triggered — check preprocessor conditions',
  },
  {
    pattern: /expected unqualified-id/i,
    hint: 'Syntax error — possibly a misplaced keyword or extra semicolon',
  },
  {
    pattern: /ISO C\+\+ forbids/i,
    hint: 'Non-standard C++ usage — check language compatibility',
  },
  {
    pattern: /overflows/i,
    hint: 'Value is too large for the target type — use a wider type',
  },
  {
    pattern: /section.*will not fit/i,
    hint: 'Program too large for the target — reduce code or data size',
  },
  {
    pattern: /region.*overflowed/i,
    hint: 'Not enough memory — reduce global variables or code size',
  },
];

/**
 * Look up a plain-English hint for a given diagnostic based on its message.
 * Returns undefined when no hint matches.
 */
export function getHint(diagnostic: CompileDiagnostic): string | undefined {
  for (const rule of HINT_RULES) {
    if (rule.pattern.test(diagnostic.message)) {
      return rule.hint;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// GCC diagnostic line regex
// ---------------------------------------------------------------------------
// Matches: filename:line:col: severity: message
// Also matches: filename:line: severity: message  (no column)
// Captures:  1=file  2=line  3=col (optional)  4=severity  5=message

const GCC_DIAGNOSTIC_RE =
  /^(.+?):(\d+):(?:(\d+):)?\s*(error|warning|note|fatal error):\s*(.+)$/;

// ---------------------------------------------------------------------------
// Linker error patterns
// ---------------------------------------------------------------------------

const LINKER_UNDEF_RE = /^(.+?):(?:(\d+):)?\s*undefined reference to [`''"](.+?)[`''"]$/;
const LINKER_MULTIDEF_RE = /^(.+?):(?:(\d+):)?\s*multiple definition of [`''"](.+?)[`''"]$/;
const LINKER_GENERIC_RE = /^(.+?\.\w+):(\d+)?:?\s*(.*(?:ld|linker|collect2).*)$/i;

// ---------------------------------------------------------------------------
// Arduino-specific patterns
// ---------------------------------------------------------------------------

const EXIT_STATUS_RE = /exit status (\d+)/i;
const COMPILATION_ERROR_RE = /^Compilation error:\s*(.+)$/i;
const ARDUINO_ERROR_RE = /^Error:\s*(.+)$/i;
const UPLOAD_ERROR_RE = /^(?:An error occurred while uploading|Upload error):\s*(.+)$/i;

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

function parseSeverity(raw: string): DiagnosticSeverity {
  const normalized = raw.toLowerCase().trim();
  if (normalized === 'fatal error') {
    return 'error';
  }
  if (normalized === 'error' || normalized === 'warning' || normalized === 'note') {
    return normalized;
  }
  return 'info';
}

/**
 * Parse raw stderr output from arduino-cli compile/upload into structured
 * diagnostics with severity, file location, and optional hints.
 */
export function parseCompileOutput(stderr: string): ParseResult {
  const diagnostics: CompileDiagnostic[] = [];
  let exitCode: number | undefined;

  if (!stderr || stderr.trim().length === 0) {
    return {
      diagnostics: [],
      summary: { errors: 0, warnings: 0, notes: 0 },
      exitCode: undefined,
    };
  }

  const lines = stderr.split('\n');

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (trimmed.length === 0) {
      continue;
    }

    // Check for exit status
    const exitMatch = EXIT_STATUS_RE.exec(trimmed);
    if (exitMatch) {
      exitCode = parseInt(exitMatch[1], 10);
    }

    // Try GCC diagnostic format
    const gccMatch = GCC_DIAGNOSTIC_RE.exec(trimmed);
    if (gccMatch) {
      const file = gccMatch[1];
      const line = parseInt(gccMatch[2], 10);
      const column = gccMatch[3] ? parseInt(gccMatch[3], 10) : 0;
      const severity = parseSeverity(gccMatch[4]);
      const message = gccMatch[5].trim();
      const toolchain = detectToolchain(trimmed);

      const diag: CompileDiagnostic = {
        file,
        line,
        column,
        severity,
        message,
        rawLine: trimmed,
        toolchain,
      };
      diag.hint = getHint(diag);
      diagnostics.push(diag);
      continue;
    }

    // Try linker: undefined reference
    const undefMatch = LINKER_UNDEF_RE.exec(trimmed);
    if (undefMatch) {
      const file = undefMatch[1];
      const line = undefMatch[2] ? parseInt(undefMatch[2], 10) : 0;
      const symbol = undefMatch[3];
      const toolchain = detectToolchain(trimmed);

      const diag: CompileDiagnostic = {
        file,
        line,
        column: 0,
        severity: 'error',
        message: `undefined reference to '${symbol}'`,
        rawLine: trimmed,
        toolchain,
      };
      diag.hint = getHint(diag);
      diagnostics.push(diag);
      continue;
    }

    // Try linker: multiple definition
    const multidefMatch = LINKER_MULTIDEF_RE.exec(trimmed);
    if (multidefMatch) {
      const file = multidefMatch[1];
      const line = multidefMatch[2] ? parseInt(multidefMatch[2], 10) : 0;
      const symbol = multidefMatch[3];
      const toolchain = detectToolchain(trimmed);

      const diag: CompileDiagnostic = {
        file,
        line,
        column: 0,
        severity: 'error',
        message: `multiple definition of '${symbol}'`,
        rawLine: trimmed,
        toolchain,
      };
      diag.hint = getHint(diag);
      diagnostics.push(diag);
      continue;
    }

    // Try generic linker errors (collect2, ld)
    const linkerGenericMatch = LINKER_GENERIC_RE.exec(trimmed);
    if (linkerGenericMatch) {
      const file = linkerGenericMatch[1];
      const line = linkerGenericMatch[2] ? parseInt(linkerGenericMatch[2], 10) : 0;
      const message = linkerGenericMatch[3].trim();

      // Skip if message is empty or just a path
      if (message.length > 0) {
        diagnostics.push({
          file,
          line,
          column: 0,
          severity: 'error',
          message,
          rawLine: trimmed,
        });
        continue;
      }
    }

    // Arduino-specific: "Compilation error: ..."
    const compilationMatch = COMPILATION_ERROR_RE.exec(trimmed);
    if (compilationMatch) {
      const diag: CompileDiagnostic = {
        file: '<arduino>',
        line: 0,
        column: 0,
        severity: 'error',
        message: compilationMatch[1].trim(),
        rawLine: trimmed,
      };
      diag.hint = getHint(diag);
      diagnostics.push(diag);
      continue;
    }

    // Arduino-specific: "Error: ..."
    const arduinoErrorMatch = ARDUINO_ERROR_RE.exec(trimmed);
    if (arduinoErrorMatch) {
      const diag: CompileDiagnostic = {
        file: '<arduino>',
        line: 0,
        column: 0,
        severity: 'error',
        message: arduinoErrorMatch[1].trim(),
        rawLine: trimmed,
      };
      diag.hint = getHint(diag);
      diagnostics.push(diag);
      continue;
    }

    // Arduino-specific: upload errors
    const uploadMatch = UPLOAD_ERROR_RE.exec(trimmed);
    if (uploadMatch) {
      diagnostics.push({
        file: '<upload>',
        line: 0,
        column: 0,
        severity: 'error',
        message: uploadMatch[1].trim(),
        rawLine: trimmed,
      });
      continue;
    }
  }

  const summary: ParseSummary = {
    errors: diagnostics.filter((d) => d.severity === 'error').length,
    warnings: diagnostics.filter((d) => d.severity === 'warning').length,
    notes: diagnostics.filter((d) => d.severity === 'note' || d.severity === 'info').length,
  };

  return { diagnostics, summary, exitCode };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format a single diagnostic into a human-readable string.
 * Output: "error: sketch.ino:42:5 — was not declared in this scope"
 */
export function formatDiagnostic(d: CompileDiagnostic): string {
  const location = d.column > 0 ? `${d.file}:${d.line}:${d.column}` : `${d.file}:${d.line}`;
  return `${d.severity}: ${location} — ${d.message}`;
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

/**
 * Group diagnostics by their source file path.
 * Within each group, diagnostics maintain their original order (by line number
 * as they appeared in the compiler output).
 */
export function groupByFile(diagnostics: CompileDiagnostic[]): Map<string, CompileDiagnostic[]> {
  const groups = new Map<string, CompileDiagnostic[]>();
  for (const d of diagnostics) {
    const existing = groups.get(d.file);
    if (existing) {
      existing.push(d);
    } else {
      groups.set(d.file, [d]);
    }
  }
  return groups;
}
