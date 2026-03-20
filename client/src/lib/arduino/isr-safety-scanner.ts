export interface IsrViolation {
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  rule: string;
  message: string;
  suggestion: string;
}

export interface IsrRuleMetadata {
  id: string;
  severity: 'error' | 'warning' | 'info';
  description: string;
}

export interface IsrBody {
  name: string;
  startLine: number;
  endLine: number;
  body: string;
}

export const ISR_RULES: IsrRuleMetadata[] = [
  {
    id: 'no-serial-in-isr',
    severity: 'error',
    description: 'Serial communication functions must not be called inside ISRs. They rely on interrupts being enabled and can cause deadlocks.',
  },
  {
    id: 'no-delay-in-isr',
    severity: 'error',
    description: 'delay() and delayMicroseconds() must not be used in ISRs. delay() relies on interrupts (which are disabled in ISRs) and will hang forever.',
  },
  {
    id: 'no-malloc-in-isr',
    severity: 'error',
    description: 'Dynamic memory allocation (new/malloc/calloc/realloc/free) must not be used in ISRs. The heap is not reentrant and can corrupt memory.',
  },
  {
    id: 'volatile-missing',
    severity: 'warning',
    description: 'Variables modified inside an ISR should be declared volatile. Without volatile, the compiler may optimize away reads from main code, causing stale values.',
  },
  {
    id: 'no-millis-in-isr',
    severity: 'warning',
    description: 'millis() and micros() are unreliable inside ISRs because the timer interrupt that updates them is disabled.',
  },
  {
    id: 'long-isr',
    severity: 'warning',
    description: 'ISR bodies should be short (≤20 lines). Long ISRs block all other interrupts and can cause missed events or timing issues.',
  },
  {
    id: 'no-i2c-in-isr',
    severity: 'error',
    description: 'I2C (Wire) functions must not be called inside ISRs. The Wire library uses interrupts internally and will deadlock.',
  },
  {
    id: 'no-spi-in-isr',
    severity: 'warning',
    description: 'SPI functions should be avoided in ISRs. SPI.transfer() can conflict with main-loop SPI usage and cause data corruption.',
  },
];

/**
 * Find the matching closing brace for an opening brace at a given position.
 * Returns the index of the closing brace, or -1 if not found.
 */
function findMatchingBrace(code: string, openBraceIndex: number): number {
  let depth = 1;
  let i = openBraceIndex + 1;
  let inSingleLineComment = false;
  let inMultiLineComment = false;
  let inString = false;
  let stringChar = '';

  while (i < code.length && depth > 0) {
    const ch = code[i];
    const next = i + 1 < code.length ? code[i + 1] : '';

    if (inSingleLineComment) {
      if (ch === '\n') {
        inSingleLineComment = false;
      }
      i++;
      continue;
    }

    if (inMultiLineComment) {
      if (ch === '*' && next === '/') {
        inMultiLineComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    if (inString) {
      if (ch === '\\') {
        i += 2; // skip escaped character
        continue;
      }
      if (ch === stringChar) {
        inString = false;
      }
      i++;
      continue;
    }

    if (ch === '/' && next === '/') {
      inSingleLineComment = true;
      i += 2;
      continue;
    }

    if (ch === '/' && next === '*') {
      inMultiLineComment = true;
      i += 2;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
      i++;
      continue;
    }

    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return i;
      }
    }

    i++;
  }

  return -1;
}

/**
 * Count newlines before a given index to determine line number (1-based).
 */
function lineNumberAt(code: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < code.length; i++) {
    if (code[i] === '\n') {
      line++;
    }
  }
  return line;
}

/**
 * Locate ISR bodies in Arduino code. Recognizes:
 * - ISR(VECTOR_NAME) { ... }
 * - attachInterrupt(pin, callback, ...) — finds the callback function body
 * - ISR vector macros like SIGNAL(VECTOR) { ... }
 */
export function findIsrBodies(code: string): IsrBody[] {
  const results: IsrBody[] = [];

  // Pattern 1: ISR(VECTOR_NAME) { ... }
  const isrPattern = /\bISR\s*\(\s*([A-Za-z0-9_]+(?:_vect)?)\s*\)\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = isrPattern.exec(code)) !== null) {
    const openBraceIndex = code.indexOf('{', match.index + match[0].length - 1);
    if (openBraceIndex === -1) {
      continue;
    }
    const closeBraceIndex = findMatchingBrace(code, openBraceIndex);
    if (closeBraceIndex === -1) {
      continue;
    }

    const body = code.slice(openBraceIndex + 1, closeBraceIndex);
    const startLine = lineNumberAt(code, openBraceIndex);
    const endLine = lineNumberAt(code, closeBraceIndex);

    results.push({
      name: `ISR(${match[1]})`,
      startLine,
      endLine,
      body,
    });
  }

  // Pattern 2: SIGNAL(VECTOR) { ... } (legacy AVR ISR macro)
  const signalPattern = /\bSIGNAL\s*\(\s*([A-Za-z0-9_]+)\s*\)\s*\{/g;

  while ((match = signalPattern.exec(code)) !== null) {
    const openBraceIndex = code.indexOf('{', match.index + match[0].length - 1);
    if (openBraceIndex === -1) {
      continue;
    }
    const closeBraceIndex = findMatchingBrace(code, openBraceIndex);
    if (closeBraceIndex === -1) {
      continue;
    }

    const body = code.slice(openBraceIndex + 1, closeBraceIndex);
    const startLine = lineNumberAt(code, openBraceIndex);
    const endLine = lineNumberAt(code, closeBraceIndex);

    results.push({
      name: `SIGNAL(${match[1]})`,
      startLine,
      endLine,
      body,
    });
  }

  // Pattern 3: attachInterrupt(pin, callbackName, mode) — find the named callback
  const attachPattern = /\battachInterrupt\s*\(\s*[^,]+,\s*([A-Za-z_][A-Za-z0-9_]*)\s*,/g;

  while ((match = attachPattern.exec(code)) !== null) {
    const callbackName = match[1];

    // Find the function definition for this callback
    const funcPattern = new RegExp(
      `\\bvoid\\s+${callbackName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\(\\s*\\)\\s*\\{`,
    );
    const funcMatch = funcPattern.exec(code);
    if (!funcMatch) {
      continue;
    }

    const openBraceIndex = code.indexOf('{', funcMatch.index + funcMatch[0].length - 1);
    if (openBraceIndex === -1) {
      continue;
    }
    const closeBraceIndex = findMatchingBrace(code, openBraceIndex);
    if (closeBraceIndex === -1) {
      continue;
    }

    const body = code.slice(openBraceIndex + 1, closeBraceIndex);
    const startLine = lineNumberAt(code, openBraceIndex);
    const endLine = lineNumberAt(code, closeBraceIndex);

    // Avoid duplicates if same callback is attached multiple times
    if (!results.some((r) => r.name === callbackName && r.startLine === startLine)) {
      results.push({
        name: callbackName,
        startLine,
        endLine,
        body,
      });
    }
  }

  // Pattern 4: attachInterrupt with inline lambda: attachInterrupt(pin, []() { ... }, mode)
  const lambdaPattern = /\battachInterrupt\s*\(\s*[^,]+,\s*\[\s*\]\s*\(\s*\)\s*\{/g;

  while ((match = lambdaPattern.exec(code)) !== null) {
    const openBraceIndex = code.indexOf('{', match.index + match[0].length - 1);
    if (openBraceIndex === -1) {
      continue;
    }
    const closeBraceIndex = findMatchingBrace(code, openBraceIndex);
    if (closeBraceIndex === -1) {
      continue;
    }

    const body = code.slice(openBraceIndex + 1, closeBraceIndex);
    const startLine = lineNumberAt(code, openBraceIndex);
    const endLine = lineNumberAt(code, closeBraceIndex);

    results.push({
      name: 'attachInterrupt(lambda)',
      startLine,
      endLine,
      body,
    });
  }

  return results;
}

interface ViolationPattern {
  rule: string;
  severity: 'error' | 'warning' | 'info';
  pattern: RegExp;
  message: string;
  suggestion: string;
}

const VIOLATION_PATTERNS: ViolationPattern[] = [
  // Rule 1: no-serial-in-isr
  {
    rule: 'no-serial-in-isr',
    severity: 'error',
    pattern: /\bSerial\s*\.\s*(?:print|println|write|read|available|begin|end|flush|readString|readStringUntil|parseInt|parseFloat|peek|find|findUntil|setTimeout|readBytes|readBytesUntil)\s*\(/,
    message: 'Serial communication in ISR will deadlock — Serial relies on interrupts being enabled.',
    suggestion: 'Set a volatile flag in the ISR and handle Serial communication in loop().',
  },
  // Rule 2: no-delay-in-isr
  {
    rule: 'no-delay-in-isr',
    severity: 'error',
    pattern: /\b(?:delay|delayMicroseconds)\s*\(/,
    message: 'delay()/delayMicroseconds() in ISR will hang — delay() depends on interrupts which are disabled in ISRs.',
    suggestion: 'Remove the delay. ISRs should execute as fast as possible. Use a state machine in loop() if timing is needed.',
  },
  // Rule 3: no-malloc-in-isr
  {
    rule: 'no-malloc-in-isr',
    severity: 'error',
    pattern: /\b(?:malloc|calloc|realloc|free)\s*\(/,
    message: 'Dynamic memory allocation in ISR can corrupt the heap — the allocator is not reentrant.',
    suggestion: 'Pre-allocate buffers before the ISR runs. Use statically allocated arrays or ring buffers.',
  },
  {
    rule: 'no-malloc-in-isr',
    severity: 'error',
    pattern: /\bnew\s+[A-Za-z_][A-Za-z0-9_]*(?:\s*\[|\s*\(|\s*;|\s*{)/,
    message: 'C++ new operator in ISR can corrupt the heap — the allocator is not reentrant.',
    suggestion: 'Pre-allocate objects before the ISR runs. Use static or global instances.',
  },
  // Rule 5: no-millis-in-isr
  {
    rule: 'no-millis-in-isr',
    severity: 'warning',
    pattern: /\b(?:millis|micros)\s*\(\s*\)/,
    message: 'millis()/micros() are unreliable in ISRs — the timer interrupt that updates them is disabled.',
    suggestion: 'If you need timing, read a hardware timer register directly or capture the timestamp before entering the ISR.',
  },
  // Rule 7: no-i2c-in-isr
  {
    rule: 'no-i2c-in-isr',
    severity: 'error',
    pattern: /\bWire\s*\.\s*(?:begin|read|write|requestFrom|beginTransmission|endTransmission|available|setClock|onReceive|onRequest)\s*\(/,
    message: 'I2C (Wire) in ISR will deadlock — the Wire library uses interrupts internally.',
    suggestion: 'Set a volatile flag in the ISR and perform I2C communication in loop().',
  },
  // Rule 8: no-spi-in-isr
  {
    rule: 'no-spi-in-isr',
    severity: 'warning',
    pattern: /\bSPI\s*\.\s*(?:transfer|transfer16|begin|end|beginTransaction|endTransaction|setBitOrder|setClockDivider|setDataMode)\s*\(/,
    message: 'SPI in ISR can conflict with main-loop SPI usage and corrupt data.',
    suggestion: 'Set a volatile flag in the ISR and perform SPI communication in loop(). If unavoidable, use noInterrupts()/interrupts() guards in loop() SPI code.',
  },
];

/**
 * Check if a line is inside a comment (single-line // or block comment content).
 * This is a heuristic — it checks if the matched column comes after a // on the same line.
 */
function isInComment(line: string, column: number): boolean {
  // Check for single-line comment before the match
  const commentIdx = line.indexOf('//');
  if (commentIdx !== -1 && commentIdx < column) {
    return true;
  }
  return false;
}

/**
 * Check if a match is inside a string literal.
 */
function isInString(line: string, column: number): boolean {
  let inStr = false;
  let strChar = '';
  for (let i = 0; i < column && i < line.length; i++) {
    const ch = line[i];
    if (inStr) {
      if (ch === '\\') {
        i++; // skip escaped char
        continue;
      }
      if (ch === strChar) {
        inStr = false;
      }
    } else if (ch === '"' || ch === "'") {
      inStr = true;
      strChar = ch;
    }
  }
  return inStr;
}

/**
 * Scan Arduino code for ISR safety violations.
 * Returns violations sorted by line number.
 */
export function scanForIsrViolations(code: string): IsrViolation[] {
  const violations: IsrViolation[] = [];
  const isrBodies = findIsrBodies(code);

  if (isrBodies.length === 0) {
    return violations;
  }

  // Collect all variable names assigned inside ISR bodies (for volatile check)
  const assignedInIsr = new Set<string>();

  for (const isr of isrBodies) {
    const bodyLines = isr.body.split('\n');

    // Rule 6: long-isr — count non-empty, non-comment lines
    const significantLines = bodyLines.filter((l) => {
      const trimmed = l.trim();
      return trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*');
    });

    if (significantLines.length > 20) {
      violations.push({
        line: isr.startLine,
        column: 0,
        severity: 'warning',
        rule: 'long-isr',
        message: `ISR '${isr.name}' is ${significantLines.length} lines long (limit: 20). Long ISRs block other interrupts.`,
        suggestion: 'Move complex logic to loop() using a volatile flag. Keep the ISR body minimal.',
      });
    }

    // Check each line of the ISR body for pattern-based violations
    for (let i = 0; i < bodyLines.length; i++) {
      const line = bodyLines[i];
      const absoluteLine = isr.startLine + i;

      for (const vp of VIOLATION_PATTERNS) {
        const m = vp.pattern.exec(line);
        if (m) {
          const col = m.index;

          // Skip matches inside comments or strings
          if (isInComment(line, col) || isInString(line, col)) {
            continue;
          }

          violations.push({
            line: absoluteLine,
            column: col,
            severity: vp.severity,
            rule: vp.rule,
            message: vp.message,
            suggestion: vp.suggestion,
          });
        }
      }

      // Collect variable assignments for volatile check
      // Match: varName = expr; (but not ==, !=, <=, >=)
      const assignmentPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:\+\+|--|(?:[+\-*/%&|^]|<<|>>)?=(?!=))/g;
      let assignMatch: RegExpExecArray | null;
      while ((assignMatch = assignmentPattern.exec(line)) !== null) {
        if (!isInComment(line, assignMatch.index) && !isInString(line, assignMatch.index)) {
          assignedInIsr.add(assignMatch[1]);
        }
      }
    }
  }

  // Rule 4: volatile-missing — check variables assigned in ISR for volatile declaration
  if (assignedInIsr.size > 0) {
    const codeLines = code.split('\n');

    for (const varName of Array.from(assignedInIsr)) {
      // Skip common loop variables and temporaries
      if (/^[ijk]$/.test(varName) || varName.startsWith('_')) {
        continue;
      }

      // Check if variable is declared volatile anywhere in the code
      const volatilePattern = new RegExp(`\\bvolatile\\b[^;]*\\b${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      if (volatilePattern.test(code)) {
        continue;
      }

      // Check if variable is declared as a local in the ISR body (locals don't need volatile)
      let isLocal = false;
      for (const isr of isrBodies) {
        const localDeclPattern = new RegExp(
          `(?:int|uint8_t|uint16_t|uint32_t|long|unsigned|byte|char|float|double|bool|boolean|auto|short|size_t)\\s+(?:\\*\\s*)?${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[=;\\[]`,
        );
        if (localDeclPattern.test(isr.body)) {
          isLocal = true;
          break;
        }
      }
      if (isLocal) {
        continue;
      }

      // Find the first assignment line in any ISR for this variable
      let firstAssignLine = 0;
      let firstAssignCol = 0;
      for (const isr of isrBodies) {
        const bodyLines = isr.body.split('\n');
        for (let i = 0; i < bodyLines.length; i++) {
          const assignPat = new RegExp(`\\b${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(?:\\+\\+|--|(?:[+\\-*/%&|^]|<<|>>)?=(?!=))`);
          const am = assignPat.exec(bodyLines[i]);
          if (am && !isInComment(bodyLines[i], am.index) && !isInString(bodyLines[i], am.index)) {
            firstAssignLine = isr.startLine + i;
            firstAssignCol = am.index;
            break;
          }
        }
        if (firstAssignLine > 0) {
          break;
        }
      }

      // Check if there's any non-ISR usage of this variable (declared outside ISR)
      let declaredOutsideIsr = false;
      for (let li = 0; li < codeLines.length; li++) {
        const lineNum = li + 1;
        // Skip lines inside any ISR body
        const inIsr = isrBodies.some((b) => lineNum >= b.startLine && lineNum <= b.endLine);
        if (inIsr) {
          continue;
        }

        const declPattern = new RegExp(
          `(?:int|uint8_t|uint16_t|uint32_t|long|unsigned|byte|char|float|double|bool|boolean|short|size_t)\\s+(?:\\*\\s*)?${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
        );
        if (declPattern.test(codeLines[li]) && !isInComment(codeLines[li], 0)) {
          declaredOutsideIsr = true;
          break;
        }
      }

      if (declaredOutsideIsr && firstAssignLine > 0) {
        violations.push({
          line: firstAssignLine,
          column: firstAssignCol,
          severity: 'warning',
          rule: 'volatile-missing',
          message: `Variable '${varName}' is modified in an ISR but not declared volatile. Main-loop reads may see stale values.`,
          suggestion: `Declare as: volatile <type> ${varName};`,
        });
      }
    }
  }

  // Sort violations by line number, then column
  violations.sort((a, b) => a.line - b.line || a.column - b.column);

  return violations;
}
