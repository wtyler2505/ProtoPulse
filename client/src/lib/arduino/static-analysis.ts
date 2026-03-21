// ──────────────────────────────────────────────────────────────────
// BL-0618 — Static Analysis Engine (Cppcheck/Clang-Tidy style)
// ──────────────────────────────────────────────────────────────────
// Regex-based C/C++ static analysis with 12+ checkers,
// rule metadata with CWE IDs, severity levels, and suggestions.
// ──────────────────────────────────────────────────────────────────

// ─── Types ───────────────────────────────────────────────────────

export type Severity = 'error' | 'warning' | 'style' | 'performance' | 'portability';

export interface AnalysisFinding {
  line: number;
  column: number;
  severity: Severity;
  ruleId: string;
  message: string;
  suggestion: string;
  cweId?: number;
  snippet?: string;
}

export interface AnalysisRule {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  cweId?: number;
  enabled: boolean;
  category: string;
}

export interface AnalysisResult {
  findings: AnalysisFinding[];
  totalFindings: number;
  errors: number;
  warnings: number;
  style: number;
  performance: number;
  portability: number;
  rulesChecked: number;
  linesAnalyzed: number;
}

export interface AnalysisConfig {
  enabledRules?: string[];
  disabledRules?: string[];
  minSeverity?: Severity;
}

// ─── Checker function type ───────────────────────────────────────

type Checker = (lines: string[], findings: AnalysisFinding[]) => void;

// ─── Rule Definitions ────────────────────────────────────────────

export const ANALYSIS_RULES: AnalysisRule[] = [
  {
    id: 'null-pointer-deref',
    name: 'Null Pointer Dereference',
    description: 'Detects potential null pointer dereferences where a pointer is used without a null check after a function that may return NULL.',
    severity: 'error',
    cweId: 476,
    enabled: true,
    category: 'memory',
  },
  {
    id: 'buffer-overflow',
    name: 'Buffer Overflow',
    description: 'Detects use of unsafe string/memory functions (strcpy, strcat, sprintf, gets) that do not check buffer boundaries.',
    severity: 'error',
    cweId: 120,
    enabled: true,
    category: 'memory',
  },
  {
    id: 'uninitialized-var',
    name: 'Uninitialized Variable',
    description: 'Detects local variable declarations without initialization that may lead to undefined behavior when read.',
    severity: 'warning',
    cweId: 457,
    enabled: true,
    category: 'correctness',
  },
  {
    id: 'integer-overflow',
    name: 'Integer Overflow',
    description: 'Detects operations on 8-bit or 16-bit types that may overflow before being stored in a wider type.',
    severity: 'warning',
    cweId: 190,
    enabled: true,
    category: 'correctness',
  },
  {
    id: 'dead-code',
    name: 'Dead Code',
    description: 'Detects unreachable code after return, break, or continue statements within the same block.',
    severity: 'style',
    cweId: 561,
    enabled: true,
    category: 'maintainability',
  },
  {
    id: 'resource-leak',
    name: 'Resource Leak',
    description: 'Detects opened file handles (fopen) or allocated memory (malloc/calloc/realloc) without corresponding close/free in the same function scope.',
    severity: 'error',
    cweId: 401,
    enabled: true,
    category: 'memory',
  },
  {
    id: 'dangerous-function',
    name: 'Dangerous Function',
    description: 'Detects use of banned/dangerous C functions (gets, scanf without width, system, atoi) that should be replaced with safer alternatives.',
    severity: 'error',
    cweId: 676,
    enabled: true,
    category: 'security',
  },
  {
    id: 'implicit-conversion',
    name: 'Implicit Type Conversion',
    description: 'Detects implicit narrowing conversions (e.g., assigning float/double to int, or long to short) that may lose data.',
    severity: 'warning',
    cweId: 681,
    enabled: true,
    category: 'correctness',
  },
  {
    id: 'unused-variable',
    name: 'Unused Variable',
    description: 'Detects variables that are declared (possibly initialized) but never referenced again in the code.',
    severity: 'style',
    cweId: 563,
    enabled: true,
    category: 'maintainability',
  },
  {
    id: 'infinite-loop',
    name: 'Potential Infinite Loop',
    description: 'Detects while(true)/while(1)/for(;;) loops without break, return, or goto statements inside, which may never terminate.',
    severity: 'warning',
    cweId: 835,
    enabled: true,
    category: 'correctness',
  },
  {
    id: 'magic-number',
    name: 'Magic Number',
    description: 'Detects literal numeric values (other than 0, 1, -1, 2) used directly in expressions instead of named constants.',
    severity: 'style',
    enabled: true,
    category: 'maintainability',
  },
  {
    id: 'missing-volatile',
    name: 'Missing Volatile Qualifier',
    description: 'Detects variables shared with ISRs (via attachInterrupt or ISR macro) that are not declared volatile, risking stale reads.',
    severity: 'warning',
    cweId: 667,
    enabled: true,
    category: 'concurrency',
  },
  {
    id: 'double-free',
    name: 'Double Free',
    description: 'Detects patterns where the same pointer is freed twice without reassignment, leading to undefined behavior.',
    severity: 'error',
    cweId: 415,
    enabled: true,
    category: 'memory',
  },
  {
    id: 'format-string',
    name: 'Format String Vulnerability',
    description: 'Detects printf/sprintf family calls where the format string is a variable rather than a string literal, enabling format string attacks.',
    severity: 'error',
    cweId: 134,
    enabled: true,
    category: 'security',
  },
];

// ─── Helper utilities ────────────────────────────────────────────

/**
 * Strip single-line (//) and multi-line comments from code.
 * Returns array of lines with comments replaced by spaces (to preserve column positions).
 */
export function stripComments(code: string): string[] {
  // Replace multi-line comments
  let stripped = code.replace(/\/\*[\s\S]*?\*\//g, (match) => {
    return match.replace(/[^\n]/g, ' ');
  });
  // Replace single-line comments
  stripped = stripped.replace(/\/\/.*$/gm, (match) => {
    return ' '.repeat(match.length);
  });
  return stripped.split('\n');
}

/**
 * Strip string literals from a line to avoid false positives.
 */
export function stripStrings(line: string): string {
  return line.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)*'/g, "''");
}

/**
 * Check if a line is inside a preprocessor directive.
 */
function isPreprocessorLine(line: string): boolean {
  return /^\s*#/.test(line);
}

/**
 * Get the column of a match in a line.
 */
function getColumn(line: string, match: RegExpExecArray): number {
  return match.index + 1;
}

// ─── Checkers ────────────────────────────────────────────────────

const checkNullPointerDeref: Checker = (lines, findings) => {
  // Detect: ptr = malloc/calloc/realloc/fopen/... then deref without null check
  const allocRe = /\b(\w+)\s*=\s*(?:malloc|calloc|realloc|fopen|strdup)\s*\(/;
  const nullCheckRe = /\bif\s*\(\s*!?\s*(\w+)\s*(?:==|!=)\s*NULL|if\s*\(\s*(\w+)\s*\)|if\s*\(\s*!(\w+)\s*\)/;

  lines.forEach((line, i) => {
    const stripped = stripStrings(line);
    if (isPreprocessorLine(stripped)) { return; }

    const allocMatch = allocRe.exec(stripped);
    if (allocMatch) {
      const varName = allocMatch[1];
      // Scan next 5 lines for usage without null check
      let hasNullCheck = false;
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        const nextLine = stripStrings(lines[j]);
        if (nullCheckRe.test(nextLine) && nextLine.includes(varName)) {
          hasNullCheck = true;
          break;
        }
        // If dereferenced before check
        const derefRe = new RegExp(`\\b${varName}\\s*(?:->|\\[)`);
        if (derefRe.test(nextLine) && !hasNullCheck) {
          findings.push({
            line: j + 1,
            column: 1,
            severity: 'error',
            ruleId: 'null-pointer-deref',
            message: `Pointer '${varName}' is dereferenced without null check after allocation at line ${i + 1}.`,
            suggestion: `Add a null check: if (${varName} == NULL) { /* handle error */ }`,
            cweId: 476,
            snippet: lines[j].trimEnd(),
          });
          break;
        }
      }
    }
  });
};

const checkBufferOverflow: Checker = (lines, findings) => {
  const unsafeFns = [
    { fn: 'strcpy', safe: 'strncpy', re: /\bstrcpy\s*\(/ },
    { fn: 'strcat', safe: 'strncat', re: /\bstrcat\s*\(/ },
    { fn: 'sprintf', safe: 'snprintf', re: /\bsprintf\s*\(/ },
    { fn: 'gets', safe: 'fgets', re: /\bgets\s*\(/ },
    { fn: 'vsprintf', safe: 'vsnprintf', re: /\bvsprintf\s*\(/ },
  ];

  lines.forEach((line, i) => {
    const stripped = stripStrings(line);
    if (isPreprocessorLine(stripped)) { return; }

    unsafeFns.forEach(({ fn, safe, re }) => {
      const match = re.exec(stripped);
      if (match) {
        findings.push({
          line: i + 1,
          column: getColumn(stripped, match),
          severity: 'error',
          ruleId: 'buffer-overflow',
          message: `Use of unsafe function '${fn}' which does not check buffer boundaries.`,
          suggestion: `Replace with '${safe}' and specify the buffer size.`,
          cweId: 120,
          snippet: line.trimEnd(),
        });
      }
    });
  });
};

const checkUninitializedVar: Checker = (lines, findings) => {
  // Match local var declarations without initialization:
  //   int x;  float y;  char* p;  uint8_t val;
  // But not: struct/enum/typedef, function params, extern
  const declRe = /^\s+(?:(?:unsigned|signed|const|static|volatile)\s+)*(?:int|char|short|long|float|double|uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|size_t|bool|byte)\s*\*?\s+(\w+)\s*;/;

  lines.forEach((line, i) => {
    const stripped = stripStrings(line);
    if (isPreprocessorLine(stripped)) { return; }

    const match = declRe.exec(stripped);
    if (match) {
      const varName = match[1];
      // Skip if it looks like a global (no indentation)
      if (/^\S/.test(line)) { return; }

      findings.push({
        line: i + 1,
        column: 1,
        severity: 'warning',
        ruleId: 'uninitialized-var',
        message: `Variable '${varName}' is declared without initialization.`,
        suggestion: `Initialize at declaration: ${match[0].trim().replace(';', '')} = 0;`,
        cweId: 457,
        snippet: line.trimEnd(),
      });
    }
  });
};

const checkIntegerOverflow: Checker = (lines, findings) => {
  // Detect: uint8_t/byte result = a * b; or a + b where a,b could overflow
  // Also: shifting 8-bit values by large amounts
  const overflowRe = /\b(?:uint8_t|byte|int8_t|char|uint16_t|int16_t|short)\s+\w+\s*=\s*\w+\s*[*+]\s*\w+/;
  const shiftRe = /\b(?:uint8_t|byte|int8_t|char)\s+\w+\s*=\s*\w+\s*(?:<<|>>)\s*(\d+)/;

  lines.forEach((line, i) => {
    const stripped = stripStrings(line);
    if (isPreprocessorLine(stripped)) { return; }

    if (overflowRe.test(stripped)) {
      findings.push({
        line: i + 1,
        column: 1,
        severity: 'warning',
        ruleId: 'integer-overflow',
        message: 'Arithmetic on narrow type may overflow before assignment.',
        suggestion: 'Cast operands to a wider type before the operation, e.g., (uint16_t)a * b.',
        cweId: 190,
        snippet: line.trimEnd(),
      });
    }

    const shiftMatch = shiftRe.exec(stripped);
    if (shiftMatch) {
      const bits = parseInt(shiftMatch[1], 10);
      if (bits >= 8) {
        findings.push({
          line: i + 1,
          column: 1,
          severity: 'warning',
          ruleId: 'integer-overflow',
          message: `Shifting 8-bit value by ${bits} bits results in zero or undefined behavior.`,
          suggestion: 'Cast to a wider type before shifting.',
          cweId: 190,
          snippet: line.trimEnd(),
        });
      }
    }
  });
};

const checkDeadCode: Checker = (lines, findings) => {
  // Detect code after return/break/continue in same block scope
  const terminatorRe = /^\s+(return\b|break\s*;|continue\s*;)/;

  lines.forEach((line, i) => {
    const stripped = stripStrings(line);
    if (isPreprocessorLine(stripped)) { return; }

    if (terminatorRe.test(stripped)) {
      // Check next lines until we hit a closing brace or new label/case
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j].trim();
        if (next === '' || next === '}' || /^(case\s|default\s*:|\w+:)/.test(next)) {
          break;
        }
        if (next.startsWith('#')) { continue; }
        if (next.startsWith('//') || next.startsWith('/*')) { continue; }

        findings.push({
          line: j + 1,
          column: 1,
          severity: 'style',
          ruleId: 'dead-code',
          message: 'Unreachable code after return/break/continue statement.',
          suggestion: 'Remove the dead code or restructure the control flow.',
          cweId: 561,
          snippet: lines[j].trimEnd(),
        });
        break; // Only report first unreachable line
      }
    }
  });
};

const checkResourceLeak: Checker = (lines, findings) => {
  // Track fopen/malloc/calloc/realloc within function bodies
  // and check for missing fclose/free before function end
  const allocRe = /\b(\w+)\s*=\s*(malloc|calloc|realloc|fopen)\s*\(/;
  const freeRe = /\b(free|fclose)\s*\(\s*(\w+)\s*\)/;
  const funcStartRe = /^\w[\w\s*]+\s+\w+\s*\([^)]*\)\s*\{/;
  const funcEndRe = /^}/;

  let inFunction = false;
  let allocated: Map<string, { line: number; type: string }> = new Map();

  lines.forEach((line, i) => {
    const stripped = stripStrings(line);

    if (funcStartRe.test(stripped)) {
      inFunction = true;
      allocated = new Map();
      return;
    }

    if (funcEndRe.test(stripped) && inFunction) {
      // Report any remaining allocations
      allocated.forEach((info, varName) => {
        const expected = info.type === 'fopen' ? 'fclose' : 'free';
        findings.push({
          line: info.line,
          column: 1,
          severity: 'error',
          ruleId: 'resource-leak',
          message: `Resource '${varName}' allocated with ${info.type}() is not released before function end.`,
          suggestion: `Add ${expected}(${varName}) before the function returns.`,
          cweId: 401,
        });
      });
      inFunction = false;
      allocated = new Map();
      return;
    }

    if (!inFunction) { return; }

    const allocMatch = allocRe.exec(stripped);
    if (allocMatch) {
      allocated.set(allocMatch[1], { line: i + 1, type: allocMatch[2] });
    }

    const freeMatch = freeRe.exec(stripped);
    if (freeMatch) {
      allocated.delete(freeMatch[2]);
    }

    // Also remove on reassignment to NULL
    const nullAssign = /\b(\w+)\s*=\s*NULL\s*;/.exec(stripped);
    if (nullAssign) {
      allocated.delete(nullAssign[1]);
    }
  });
};

const checkDangerousFunction: Checker = (lines, findings) => {
  const dangerous = [
    { fn: 'gets', reason: 'No buffer length check, trivially exploitable.', safe: 'fgets(buf, sizeof(buf), stdin)', re: /\bgets\s*\(/ },
    { fn: 'atoi', reason: 'No error detection on invalid input.', safe: 'strtol', re: /\batoi\s*\(/ },
    { fn: 'atof', reason: 'No error detection on invalid input.', safe: 'strtod', re: /\batof\s*\(/ },
    { fn: 'atol', reason: 'No error detection on invalid input.', safe: 'strtol', re: /\batol\s*\(/ },
    { fn: 'system', reason: 'Arbitrary shell command execution is a security risk.', safe: 'exec family', re: /\bsystem\s*\(/ },
    { fn: 'scanf', reason: 'No width limit on %s format specifier.', safe: 'scanf with width specifier (%99s)', re: /\bscanf\s*\(\s*"[^"]*%s/, useOriginal: true as const },
  ];

  lines.forEach((line, i) => {
    const stripped = stripStrings(line);
    if (isPreprocessorLine(stripped)) { return; }

    dangerous.forEach(({ fn, reason, safe, re, ...rest }) => {
      const searchLine = ('useOriginal' in rest && rest.useOriginal) ? line : stripped;
      const match = re.exec(searchLine);
      if (match) {
        findings.push({
          line: i + 1,
          column: getColumn(stripped, match),
          severity: 'error',
          ruleId: 'dangerous-function',
          message: `Use of dangerous function '${fn}': ${reason}`,
          suggestion: `Replace with '${safe}'.`,
          cweId: 676,
          snippet: line.trimEnd(),
        });
      }
    });
  });
};

const checkImplicitConversion: Checker = (lines, findings) => {
  // Detect: int x = floatVar; short x = longVar; etc.
  const narrowingPatterns = [
    { re: /\b(?:int|short|int8_t|int16_t|uint8_t|uint16_t)\s+\w+\s*=\s*\w+\s*[/]\s*\w+/, msg: 'Integer division may truncate the result.' },
    { re: /\bint\s+\w+\s*=\s*(?:\d+\.\d+|[\w]+)\s*;/, msg: 'Possible narrowing conversion from float/double to int.', check: (line: string) => /\b(?:float|double)\b/.test(line) || /\d+\.\d+/.test(line) },
  ];

  lines.forEach((line, i) => {
    const stripped = stripStrings(line);
    if (isPreprocessorLine(stripped)) { return; }

    narrowingPatterns.forEach(({ re, msg, check }) => {
      if (re.test(stripped)) {
        if (check && !check(stripped)) { return; }
        findings.push({
          line: i + 1,
          column: 1,
          severity: 'warning',
          ruleId: 'implicit-conversion',
          message: msg,
          suggestion: 'Use explicit cast or change the target type.',
          cweId: 681,
          snippet: line.trimEnd(),
        });
      }
    });
  });
};

const checkUnusedVariable: Checker = (lines, findings) => {
  // Simple heuristic: find local variable declarations and check if they appear elsewhere
  const declRe = /^\s+(?:(?:unsigned|signed|const|static|volatile)\s+)*(?:int|char|short|long|float|double|uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|size_t|bool|byte|void)\s*\*?\s+(\w+)\s*(?:=\s*[^;]+)?;/;

  const allText = lines.join('\n');

  lines.forEach((line, i) => {
    const stripped = stripStrings(line);
    if (isPreprocessorLine(stripped)) { return; }
    if (/^\S/.test(line)) { return; } // Skip global scope

    const match = declRe.exec(stripped);
    if (match) {
      const varName = match[1];
      if (varName.startsWith('_')) { return; } // Convention for intentionally unused

      // Count occurrences in entire text (crude but effective for single-file analysis)
      const varRe = new RegExp(`\\b${varName}\\b`, 'g');
      const matches = allText.match(varRe);
      const count = matches ? matches.length : 0;

      if (count <= 1) {
        findings.push({
          line: i + 1,
          column: 1,
          severity: 'style',
          ruleId: 'unused-variable',
          message: `Variable '${varName}' is declared but never used.`,
          suggestion: `Remove the unused variable or prefix with '_' if intentionally unused.`,
          cweId: 563,
          snippet: line.trimEnd(),
        });
      }
    }
  });
};

const checkInfiniteLoop: Checker = (lines, findings) => {
  // Detect: while(1), while(true), for(;;) without break/return/goto
  const loopRe = /\b(?:while\s*\(\s*(?:1|true)\s*\)|for\s*\(\s*;\s*;\s*\))\s*\{/;

  lines.forEach((line, i) => {
    const stripped = stripStrings(line);
    if (isPreprocessorLine(stripped)) { return; }

    if (loopRe.test(stripped)) {
      // Scan the loop body for break/return/goto
      let braceDepth = 0;
      let hasExit = false;
      let started = false;

      for (let j = i; j < lines.length; j++) {
        const bodyLine = stripStrings(lines[j]);
        for (let k = 0; k < bodyLine.length; k++) {
          if (bodyLine[k] === '{') {
            braceDepth++;
            started = true;
          } else if (bodyLine[k] === '}') {
            braceDepth--;
            if (started && braceDepth === 0) {
              // End of loop body
              if (!hasExit) {
                findings.push({
                  line: i + 1,
                  column: 1,
                  severity: 'warning',
                  ruleId: 'infinite-loop',
                  message: 'Infinite loop without break, return, or goto — may never terminate.',
                  suggestion: 'Add an exit condition or a break/return statement inside the loop.',
                  cweId: 835,
                  snippet: line.trimEnd(),
                });
              }
              return;
            }
          }
        }
        if (/\b(break|return|goto)\b/.test(bodyLine)) {
          hasExit = true;
        }
      }
    }
  });
};

const checkMagicNumber: Checker = (lines, findings) => {
  // Detect numeric literals (other than 0, 1, -1, 2) used in expressions
  // Skip: array sizes, #define, enum values, case labels, string literals
  const magicRe = /(?<![.\w])(-?\d+\.?\d*(?:e[+-]?\d+)?|0x[0-9a-fA-F]+)(?![.\w])/g;
  const allowed = new Set(['0', '1', '-1', '2', '0x00', '0xFF', '0xff', '0x0', '0x1']);

  lines.forEach((line, i) => {
    const stripped = stripStrings(line);
    if (isPreprocessorLine(stripped)) { return; }
    if (/^\s*(case\s|\/\/|\/\*|\*|enum\s|#)/.test(stripped)) { return; }
    // Skip array declarations and sizeof
    if (/\[\s*\d+\s*\]/.test(stripped)) { return; }
    // Skip const/define
    if (/\bconst\b/.test(stripped) || /\b(define|DEFINE)\b/.test(stripped)) { return; }

    let match: RegExpExecArray | null = null;
    const workingRe = new RegExp(magicRe.source, 'g');
    while ((match = workingRe.exec(stripped)) !== null) {
      const value = match[1];
      if (allowed.has(value)) { continue; }
      // Skip if it's part of a variable name (already handled by word boundary)
      // Skip if it's a pin number assignment (common in Arduino)
      if (/\b(?:pin|PIN|Pin)\w*\s*=/.test(stripped)) { continue; }

      findings.push({
        line: i + 1,
        column: match.index + 1,
        severity: 'style',
        ruleId: 'magic-number',
        message: `Magic number '${value}' used directly in code.`,
        suggestion: 'Define as a named constant, e.g., #define or const.',
        snippet: line.trimEnd(),
      });
      break; // Only report first magic number per line
    }
  });
};

const checkMissingVolatile: Checker = (lines, findings) => {
  // Find variables modified in ISR or attachInterrupt callbacks
  // that are also used in non-ISR code and not volatile
  const allText = lines.join('\n');
  const volatileVars = new Set<string>();
  const isrVars = new Set<string>();

  // Collect volatile declarations
  const volatileRe = /\bvolatile\b[^;]*\b(\w+)\s*(?:=|;)/g;
  let vMatch: RegExpExecArray | null = null;
  while ((vMatch = volatileRe.exec(allText)) !== null) {
    volatileVars.add(vMatch[1]);
  }

  // Find ISR/attachInterrupt bodies and extract modified variables
  const isrBodyRe = /\b(?:ISR|SIGNAL)\s*\([^)]+\)\s*\{([^}]*)}/g;
  let isrMatch: RegExpExecArray | null = null;
  while ((isrMatch = isrBodyRe.exec(allText)) !== null) {
    const body = isrMatch[1];
    const assignRe = /\b(\w+)\s*(?:[+\-*/%&|^]?=|(?:\+\+|--))/g;
    let aMatch: RegExpExecArray | null = null;
    while ((aMatch = assignRe.exec(body)) !== null) {
      isrVars.add(aMatch[1]);
    }
  }

  // Report ISR-modified vars that aren't volatile
  isrVars.forEach((varName) => {
    if (volatileVars.has(varName)) { return; }
    if (/^[A-Z_]+$/.test(varName)) { return; } // Skip constants

    // Find the declaration line
    lines.forEach((line, i) => {
      const stripped = stripStrings(line);
      const declRe = new RegExp(`\\b(?:int|char|uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|long|short|bool|byte|float|double)\\s+(?:\\*\\s*)?${varName}\\b`);
      if (declRe.test(stripped) && !/\bvolatile\b/.test(stripped)) {
        findings.push({
          line: i + 1,
          column: 1,
          severity: 'warning',
          ruleId: 'missing-volatile',
          message: `Variable '${varName}' is modified in an ISR but not declared volatile.`,
          suggestion: `Add volatile qualifier: volatile ${stripped.trim().replace(';', '').trim()};`,
          cweId: 667,
          snippet: line.trimEnd(),
        });
      }
    });
  });
};

const checkDoubleFree: Checker = (lines, findings) => {
  // Track free() calls and detect same pointer freed twice
  const freeRe = /\bfree\s*\(\s*(\w+)\s*\)/;
  const assignRe = /\b(\w+)\s*=/;
  const freed: Map<string, number> = new Map();

  lines.forEach((line, i) => {
    const stripped = stripStrings(line);
    if (isPreprocessorLine(stripped)) { return; }

    // Check for reassignment (which resets tracking)
    const assignMatch = assignRe.exec(stripped);
    if (assignMatch && !freeRe.test(stripped)) {
      freed.delete(assignMatch[1]);
    }

    const freeMatch = freeRe.exec(stripped);
    if (freeMatch) {
      const varName = freeMatch[1];
      if (freed.has(varName)) {
        findings.push({
          line: i + 1,
          column: freeMatch.index + 1,
          severity: 'error',
          ruleId: 'double-free',
          message: `Pointer '${varName}' may be freed twice (first free at line ${freed.get(varName)}).`,
          suggestion: `Set '${varName} = NULL' after free, or remove the duplicate free.`,
          cweId: 415,
          snippet: line.trimEnd(),
        });
      } else {
        freed.set(varName, i + 1);
      }
    }
  });
};

const checkFormatString: Checker = (lines, findings) => {
  // Detect printf/sprintf where the format argument is a variable, not a string literal.
  // We check the ORIGINAL line (not stripped) so string literals are visible.
  const printfCallRe = /\b(printf|sprintf)\s*\(\s*(\w+)\s*[,)]/;

  lines.forEach((line, i) => {
    if (isPreprocessorLine(line)) { return; }

    // Use original line so we can see if first arg is a string literal
    const match = printfCallRe.exec(line);
    if (match) {
      const fn = match[1];
      const arg = match[2];
      // arg is the first argument — if it's a variable name (not a string literal),
      // that's a format string vulnerability
      if (arg && !/^(stdout|stderr|stdin)$/.test(arg)) {
        findings.push({
          line: i + 1,
          column: match.index + 1,
          severity: 'error',
          ruleId: 'format-string',
          message: `Format string for '${fn}' is a variable '${arg}', not a string literal.`,
          suggestion: `Use a literal format string: ${fn}("%s", ${arg}) or validate the format.`,
          cweId: 134,
          snippet: line.trimEnd(),
        });
      }
    }
  });
};

// ─── Checker Registry ────────────────────────────────────────────

const CHECKERS: Map<string, Checker> = new Map([
  ['null-pointer-deref', checkNullPointerDeref],
  ['buffer-overflow', checkBufferOverflow],
  ['uninitialized-var', checkUninitializedVar],
  ['integer-overflow', checkIntegerOverflow],
  ['dead-code', checkDeadCode],
  ['resource-leak', checkResourceLeak],
  ['dangerous-function', checkDangerousFunction],
  ['implicit-conversion', checkImplicitConversion],
  ['unused-variable', checkUnusedVariable],
  ['infinite-loop', checkInfiniteLoop],
  ['magic-number', checkMagicNumber],
  ['missing-volatile', checkMissingVolatile],
  ['double-free', checkDoubleFree],
  ['format-string', checkFormatString],
]);

// ─── Severity Ordering ──────────────────────────────────────────

const SEVERITY_ORDER: Record<Severity, number> = {
  error: 0,
  warning: 1,
  performance: 2,
  portability: 3,
  style: 4,
};

function severityValue(sev: Severity): number {
  return SEVERITY_ORDER[sev] ?? 5;
}

// ─── Main Analysis Function ──────────────────────────────────────

/**
 * Run static analysis on C/C++ source code.
 */
export function analyzeCode(code: string, config?: AnalysisConfig): AnalysisResult {
  const strippedLines = stripComments(code);
  const findings: AnalysisFinding[] = [];

  // Determine which rules to run
  let activeRules = ANALYSIS_RULES.filter((r) => r.enabled);

  if (config?.enabledRules && config.enabledRules.length > 0) {
    const enabled = new Set(config.enabledRules);
    activeRules = activeRules.filter((r) => enabled.has(r.id));
  }

  if (config?.disabledRules && config.disabledRules.length > 0) {
    const disabled = new Set(config.disabledRules);
    activeRules = activeRules.filter((r) => !disabled.has(r.id));
  }

  const minSev = config?.minSeverity ? severityValue(config.minSeverity) : Infinity;

  // Run each active checker
  activeRules.forEach((rule) => {
    const checker = CHECKERS.get(rule.id);
    if (checker) {
      checker(strippedLines, findings);
    }
  });

  // Filter by min severity
  const filtered = minSev < Infinity
    ? findings.filter((f) => severityValue(f.severity) <= minSev)
    : findings;

  // Sort by line, then severity
  filtered.sort((a, b) => {
    if (a.line !== b.line) { return a.line - b.line; }
    return severityValue(a.severity) - severityValue(b.severity);
  });

  return {
    findings: filtered,
    totalFindings: filtered.length,
    errors: filtered.filter((f) => f.severity === 'error').length,
    warnings: filtered.filter((f) => f.severity === 'warning').length,
    style: filtered.filter((f) => f.severity === 'style').length,
    performance: filtered.filter((f) => f.severity === 'performance').length,
    portability: filtered.filter((f) => f.severity === 'portability').length,
    rulesChecked: activeRules.length,
    linesAnalyzed: strippedLines.length,
  };
}

// ─── Utility Exports ─────────────────────────────────────────────

export function getRuleById(id: string): AnalysisRule | undefined {
  return ANALYSIS_RULES.find((r) => r.id === id);
}

export function getRulesByCategory(category: string): AnalysisRule[] {
  return ANALYSIS_RULES.filter((r) => r.category === category);
}

export function getRuleCategories(): string[] {
  const cats = new Set<string>();
  ANALYSIS_RULES.forEach((r) => {
    cats.add(r.category);
  });
  return Array.from(cats);
}

export function getCheckerCount(): number {
  return CHECKERS.size;
}
