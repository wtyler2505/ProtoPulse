/**
 * LoopProfiler — Static analysis of Arduino loop() to estimate execution time
 * per code section.
 *
 * Parses the loop() function body, identifies operations (digitalRead/Write,
 * analogRead/Write, Serial I/O, delay, math, I2C, SPI, etc.), estimates their
 * execution time in microseconds, and categorizes code sections by speed.
 *
 * Produces a per-line timing breakdown with estimated loop frequency (Hz).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SpeedCategory = 'fast' | 'moderate' | 'slow' | 'blocking';

export interface OperationTiming {
  /** Name of the Arduino function/operation. */
  name: string;
  /** Estimated time in microseconds. */
  microseconds: number;
  /** Speed category. */
  category: SpeedCategory;
  /** Description of what this timing represents. */
  description: string;
}

export interface ProfiledLine {
  /** 1-based line number relative to the full source. */
  line: number;
  /** Source text of this line. */
  text: string;
  /** Operations detected on this line. */
  operations: OperationTiming[];
  /** Total estimated microseconds for this line. */
  totalMicroseconds: number;
  /** Speed category for this line (worst of its operations). */
  category: SpeedCategory;
}

export interface LoopProfile {
  /** Per-line timing breakdown. */
  lines: ProfiledLine[];
  /** Total estimated microseconds for one loop() iteration. */
  totalMicroseconds: number;
  /** Estimated loop frequency in Hz. */
  estimatedHz: number;
  /** Overall speed category. */
  category: SpeedCategory;
  /** Start line of loop() body in the source (1-based). */
  loopStartLine: number;
  /** End line of loop() body in the source (1-based). */
  loopEndLine: number;
  /** Summary of slowest operations. */
  bottlenecks: BottleneckEntry[];
}

export interface BottleneckEntry {
  /** Line number (1-based). */
  line: number;
  /** Operation name. */
  operation: string;
  /** Estimated microseconds. */
  microseconds: number;
  /** Percentage of total loop time. */
  percentage: number;
}

// ---------------------------------------------------------------------------
// Operation timing database (microseconds, based on 16MHz AVR @ Arduino Uno)
// ---------------------------------------------------------------------------

export const OPERATION_TIMING_DB: Record<string, OperationTiming> = {
  // Digital I/O
  'digitalWrite': {
    name: 'digitalWrite',
    microseconds: 5,
    category: 'fast',
    description: 'Sets a digital pin HIGH or LOW. ~5us on AVR (port register write).',
  },
  'digitalRead': {
    name: 'digitalRead',
    microseconds: 5,
    category: 'fast',
    description: 'Reads a digital pin state. ~5us on AVR.',
  },
  'pinMode': {
    name: 'pinMode',
    microseconds: 5,
    category: 'fast',
    description: 'Configures a pin as INPUT/OUTPUT. ~5us.',
  },

  // Analog I/O
  'analogRead': {
    name: 'analogRead',
    microseconds: 112,
    category: 'moderate',
    description: 'ADC conversion. ~112us on AVR (13 ADC clock cycles at 125kHz).',
  },
  'analogWrite': {
    name: 'analogWrite',
    microseconds: 8,
    category: 'fast',
    description: 'Sets PWM duty cycle. ~8us (timer register write).',
  },

  // Timing
  'delay': {
    name: 'delay',
    microseconds: 1000000,
    category: 'blocking',
    description: 'Blocks for N milliseconds. Default estimate: 1000ms (1s).',
  },
  'delayMicroseconds': {
    name: 'delayMicroseconds',
    microseconds: 100,
    category: 'slow',
    description: 'Blocks for N microseconds. Default estimate: 100us.',
  },
  'millis': {
    name: 'millis',
    microseconds: 2,
    category: 'fast',
    description: 'Returns elapsed milliseconds. ~2us (reads timer counter).',
  },
  'micros': {
    name: 'micros',
    microseconds: 2,
    category: 'fast',
    description: 'Returns elapsed microseconds. ~2us.',
  },

  // Serial
  'Serial.begin': {
    name: 'Serial.begin',
    microseconds: 50,
    category: 'fast',
    description: 'Initialize UART. ~50us (one-time setup, usually in setup()).',
  },
  'Serial.print': {
    name: 'Serial.print',
    microseconds: 500,
    category: 'moderate',
    description: 'Print to serial. ~500us at 9600 baud for short string (~5 chars).',
  },
  'Serial.println': {
    name: 'Serial.println',
    microseconds: 600,
    category: 'moderate',
    description: 'Print line to serial. ~600us at 9600 baud (includes \\r\\n).',
  },
  'Serial.write': {
    name: 'Serial.write',
    microseconds: 100,
    category: 'moderate',
    description: 'Write a byte to serial. ~100us at 9600 baud.',
  },
  'Serial.read': {
    name: 'Serial.read',
    microseconds: 5,
    category: 'fast',
    description: 'Read a byte from the serial buffer (non-blocking if data available). ~5us.',
  },
  'Serial.available': {
    name: 'Serial.available',
    microseconds: 2,
    category: 'fast',
    description: 'Check bytes available in serial buffer. ~2us.',
  },
  'Serial.readString': {
    name: 'Serial.readString',
    microseconds: 1000000,
    category: 'blocking',
    description: 'Blocks until timeout (default 1000ms). ~1s worst case.',
  },
  'Serial.readStringUntil': {
    name: 'Serial.readStringUntil',
    microseconds: 1000000,
    category: 'blocking',
    description: 'Blocks until terminator or timeout (default 1000ms).',
  },
  'Serial.parseInt': {
    name: 'Serial.parseInt',
    microseconds: 1000000,
    category: 'blocking',
    description: 'Blocks until non-digit or timeout (default 1000ms).',
  },
  'Serial.parseFloat': {
    name: 'Serial.parseFloat',
    microseconds: 1000000,
    category: 'blocking',
    description: 'Blocks until non-numeric or timeout (default 1000ms).',
  },
  'Serial.readBytes': {
    name: 'Serial.readBytes',
    microseconds: 1000000,
    category: 'blocking',
    description: 'Blocks until N bytes received or timeout.',
  },
  'Serial.find': {
    name: 'Serial.find',
    microseconds: 1000000,
    category: 'blocking',
    description: 'Blocks until target found or timeout.',
  },
  'Serial.flush': {
    name: 'Serial.flush',
    microseconds: 5000,
    category: 'slow',
    description: 'Waits for outgoing serial data to transmit. ~5ms for a full buffer at 9600 baud.',
  },

  // I2C (Wire)
  'Wire.begin': {
    name: 'Wire.begin',
    microseconds: 100,
    category: 'fast',
    description: 'Initialize I2C. ~100us (one-time setup).',
  },
  'Wire.beginTransmission': {
    name: 'Wire.beginTransmission',
    microseconds: 10,
    category: 'fast',
    description: 'Begin I2C transmission (buffers address). ~10us.',
  },
  'Wire.write': {
    name: 'Wire.write',
    microseconds: 10,
    category: 'fast',
    description: 'Buffer data for I2C transmission. ~10us.',
  },
  'Wire.endTransmission': {
    name: 'Wire.endTransmission',
    microseconds: 500,
    category: 'moderate',
    description: 'Transmit buffered I2C data. ~500us at 100kHz for a few bytes.',
  },
  'Wire.requestFrom': {
    name: 'Wire.requestFrom',
    microseconds: 800,
    category: 'moderate',
    description: 'Request bytes from I2C device. ~800us at 100kHz for 6 bytes.',
  },
  'Wire.read': {
    name: 'Wire.read',
    microseconds: 5,
    category: 'fast',
    description: 'Read from I2C buffer (non-blocking). ~5us.',
  },

  // SPI
  'SPI.begin': {
    name: 'SPI.begin',
    microseconds: 50,
    category: 'fast',
    description: 'Initialize SPI. ~50us (one-time setup).',
  },
  'SPI.transfer': {
    name: 'SPI.transfer',
    microseconds: 4,
    category: 'fast',
    description: 'Transfer one byte via SPI. ~4us at 4MHz clock.',
  },
  'SPI.beginTransaction': {
    name: 'SPI.beginTransaction',
    microseconds: 10,
    category: 'fast',
    description: 'Begin SPI transaction with settings. ~10us.',
  },
  'SPI.endTransaction': {
    name: 'SPI.endTransaction',
    microseconds: 5,
    category: 'fast',
    description: 'End SPI transaction. ~5us.',
  },

  // Pulse measurement
  'pulseIn': {
    name: 'pulseIn',
    microseconds: 500000,
    category: 'blocking',
    description: 'Measure pulse width. Blocks until pulse or timeout (default 1s). Estimate: 500ms.',
  },
  'pulseInLong': {
    name: 'pulseInLong',
    microseconds: 500000,
    category: 'blocking',
    description: 'Measure pulse width (interrupt-friendly). Blocks until pulse or timeout.',
  },

  // Servo
  'Servo.write': {
    name: 'Servo.write',
    microseconds: 20,
    category: 'fast',
    description: 'Set servo angle. ~20us (timer register write).',
  },
  'Servo.writeMicroseconds': {
    name: 'Servo.writeMicroseconds',
    microseconds: 20,
    category: 'fast',
    description: 'Set servo pulse width in us. ~20us.',
  },
  'Servo.read': {
    name: 'Servo.read',
    microseconds: 5,
    category: 'fast',
    description: 'Read last written servo angle. ~5us.',
  },

  // Tone
  'tone': {
    name: 'tone',
    microseconds: 20,
    category: 'fast',
    description: 'Start generating tone. ~20us (timer setup). Non-blocking.',
  },
  'noTone': {
    name: 'noTone',
    microseconds: 10,
    category: 'fast',
    description: 'Stop tone generation. ~10us.',
  },

  // Math / utility
  'map': {
    name: 'map',
    microseconds: 5,
    category: 'fast',
    description: 'Re-maps a value from one range to another. ~5us (integer math).',
  },
  'constrain': {
    name: 'constrain',
    microseconds: 2,
    category: 'fast',
    description: 'Constrains a value between min and max. ~2us.',
  },
  'abs': {
    name: 'abs',
    microseconds: 1,
    category: 'fast',
    description: 'Absolute value. ~1us (macro).',
  },
  'min': {
    name: 'min',
    microseconds: 1,
    category: 'fast',
    description: 'Minimum of two values. ~1us (macro).',
  },
  'max': {
    name: 'max',
    microseconds: 1,
    category: 'fast',
    description: 'Maximum of two values. ~1us (macro).',
  },
  'sqrt': {
    name: 'sqrt',
    microseconds: 30,
    category: 'fast',
    description: 'Square root (float). ~30us on AVR (software float).',
  },
  'sin': {
    name: 'sin',
    microseconds: 120,
    category: 'moderate',
    description: 'Sine (float). ~120us on AVR (software float).',
  },
  'cos': {
    name: 'cos',
    microseconds: 120,
    category: 'moderate',
    description: 'Cosine (float). ~120us on AVR (software float).',
  },
  'tan': {
    name: 'tan',
    microseconds: 150,
    category: 'moderate',
    description: 'Tangent (float). ~150us on AVR (software float).',
  },
  'pow': {
    name: 'pow',
    microseconds: 200,
    category: 'moderate',
    description: 'Power (float). ~200us on AVR (software float).',
  },
  'log': {
    name: 'log',
    microseconds: 150,
    category: 'moderate',
    description: 'Natural logarithm (float). ~150us on AVR.',
  },

  // String
  'String': {
    name: 'String()',
    microseconds: 50,
    category: 'moderate',
    description: 'String constructor/conversion. ~50us (heap allocation).',
  },
  'sprintf': {
    name: 'sprintf',
    microseconds: 100,
    category: 'moderate',
    description: 'Formatted string print. ~100us (depends on format string).',
  },
  'dtostrf': {
    name: 'dtostrf',
    microseconds: 80,
    category: 'moderate',
    description: 'Double to string conversion. ~80us.',
  },
};

// ---------------------------------------------------------------------------
// Category ordering for "worst-of" comparisons
// ---------------------------------------------------------------------------

const CATEGORY_ORDER: Record<SpeedCategory, number> = {
  fast: 0,
  moderate: 1,
  slow: 2,
  blocking: 3,
};

function worstCategory(a: SpeedCategory, b: SpeedCategory): SpeedCategory {
  return CATEGORY_ORDER[a] >= CATEGORY_ORDER[b] ? a : b;
}

/**
 * Categorize a microsecond duration.
 */
export function categorizeTime(microseconds: number): SpeedCategory {
  if (microseconds >= 100000) {
    return 'blocking';
  }
  if (microseconds >= 10000) {
    return 'slow';
  }
  if (microseconds >= 100) {
    return 'moderate';
  }
  return 'fast';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isInLineComment(line: string, column: number): boolean {
  const idx = line.indexOf('//');
  return idx !== -1 && idx < column;
}

function isInStringLiteral(line: string, column: number): boolean {
  let inStr = false;
  let strChar = '';
  for (let i = 0; i < column && i < line.length; i++) {
    const ch = line[i];
    if (inStr) {
      if (ch === '\\') {
        i++;
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
 * Find matching closing brace from an opening brace index.
 */
function findMatchingBrace(code: string, openIndex: number): number {
  let depth = 1;
  let i = openIndex + 1;
  let inStr = false;
  let strChar = '';
  let inSingleComment = false;
  let inMultiComment = false;

  while (i < code.length && depth > 0) {
    const ch = code[i];
    const next = i + 1 < code.length ? code[i + 1] : '';

    if (inSingleComment) {
      if (ch === '\n') {
        inSingleComment = false;
      }
      i++;
      continue;
    }
    if (inMultiComment) {
      if (ch === '*' && next === '/') {
        inMultiComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (inStr) {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === strChar) {
        inStr = false;
      }
      i++;
      continue;
    }

    if (ch === '/' && next === '/') {
      inSingleComment = true;
      i += 2;
      continue;
    }
    if (ch === '/' && next === '*') {
      inMultiComment = true;
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = true;
      strChar = ch;
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
 * Count newlines before an index (1-based line number).
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
 * Try to extract a numeric argument from a function call (e.g., delay(500) → 500).
 * Returns null if the argument is not a simple numeric literal.
 */
function extractNumericArg(callText: string): number | null {
  const m = /\(\s*(\d+(?:\.\d+)?)\s*[,)]/.exec(callText);
  if (m) {
    return Number(m[1]);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Loop body extraction
// ---------------------------------------------------------------------------

export interface LoopBodyInfo {
  body: string;
  startLine: number;
  endLine: number;
}

/**
 * Extract the loop() function body from Arduino code.
 * Returns null if no loop() is found.
 */
export function extractLoopBody(code: string): LoopBodyInfo | null {
  const pattern = /\bvoid\s+loop\s*\(\s*\)\s*\{/g;
  const match = pattern.exec(code);
  if (!match) {
    return null;
  }

  const openBrace = code.indexOf('{', match.index + match[0].length - 1);
  if (openBrace === -1) {
    return null;
  }

  const closeBrace = findMatchingBrace(code, openBrace);
  if (closeBrace === -1) {
    return null;
  }

  return {
    body: code.slice(openBrace + 1, closeBrace),
    startLine: lineNumberAt(code, openBrace),
    endLine: lineNumberAt(code, closeBrace),
  };
}

// ---------------------------------------------------------------------------
// Line profiling
// ---------------------------------------------------------------------------

/**
 * Build operation-matching patterns from the timing DB.
 * Each entry produces a regex that matches the function call.
 */
function buildOperationPatterns(): Array<{ name: string; regex: RegExp; timing: OperationTiming }> {
  const patterns: Array<{ name: string; regex: RegExp; timing: OperationTiming }> = [];

  const entries = Object.entries(OPERATION_TIMING_DB);
  for (const [key, timing] of entries) {
    // Handle dot-separated names (e.g., "Serial.println")
    let regexStr: string;
    if (key.includes('.')) {
      const parts = key.split('.');
      regexStr = `\\b${parts[0]}\\d*\\s*\\.\\s*${parts[1]}\\s*\\(`;
    } else {
      regexStr = `\\b${key}\\s*\\(`;
    }

    patterns.push({
      name: key,
      regex: new RegExp(regexStr),
      timing,
    });
  }

  return patterns;
}

const OPERATION_PATTERNS = buildOperationPatterns();

/**
 * Profile a single line of code, detecting operations and estimating timing.
 */
function profileLine(line: string, absoluteLineNumber: number): ProfiledLine {
  const operations: OperationTiming[] = [];
  let totalMicroseconds = 0;
  let category: SpeedCategory = 'fast';

  const trimmed = line.trim();

  // Skip empty lines and comment-only lines
  if (trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
    return {
      line: absoluteLineNumber,
      text: line,
      operations: [],
      totalMicroseconds: 0,
      category: 'fast',
    };
  }

  for (const op of OPERATION_PATTERNS) {
    const m = op.regex.exec(line);
    if (!m) {
      continue;
    }

    // Skip if in comment or string
    if (isInLineComment(line, m.index) || isInStringLiteral(line, m.index)) {
      continue;
    }

    // For delay() and delayMicroseconds(), try to extract the actual argument
    let timing = { ...op.timing };
    if (op.name === 'delay') {
      const arg = extractNumericArg(line.slice(m.index));
      if (arg !== null) {
        timing = {
          ...timing,
          microseconds: arg * 1000, // delay is in ms → convert to us
          description: `delay(${arg}) — blocks for ${arg}ms.`,
        };
      }
    } else if (op.name === 'delayMicroseconds') {
      const arg = extractNumericArg(line.slice(m.index));
      if (arg !== null) {
        timing = {
          ...timing,
          microseconds: arg,
          description: `delayMicroseconds(${arg}) — blocks for ${arg}us.`,
        };
      }
    }

    // Recategorize based on actual argument-derived timing
    timing.category = categorizeTime(timing.microseconds);

    operations.push(timing);
    totalMicroseconds += timing.microseconds;
    category = worstCategory(category, timing.category);
  }

  // Baseline cost for non-empty, non-comment lines (variable assignment, if-check, etc.)
  if (operations.length === 0 && trimmed.length > 0) {
    totalMicroseconds = 1; // ~1us for simple instructions on AVR
  }

  return {
    line: absoluteLineNumber,
    text: line,
    operations,
    totalMicroseconds,
    category,
  };
}

// ---------------------------------------------------------------------------
// Main profiler
// ---------------------------------------------------------------------------

/**
 * Profile the loop() function in Arduino code.
 * Returns null if no loop() function is found.
 */
export function profileLoop(code: string): LoopProfile | null {
  const loopInfo = extractLoopBody(code);
  if (!loopInfo) {
    return null;
  }

  const bodyLines = loopInfo.body.split('\n');
  const profiledLines: ProfiledLine[] = [];
  let totalMicroseconds = 0;

  for (let i = 0; i < bodyLines.length; i++) {
    // +1 because loopStartLine is the line with {, body starts on next line
    const absoluteLine = loopInfo.startLine + 1 + i;
    const profiled = profileLine(bodyLines[i], absoluteLine);
    profiledLines.push(profiled);
    totalMicroseconds += profiled.totalMicroseconds;
  }

  // Calculate estimated Hz
  const estimatedHz = totalMicroseconds > 0 ? 1_000_000 / totalMicroseconds : Infinity;

  // Overall category
  let overallCategory: SpeedCategory = 'fast';
  for (const pl of profiledLines) {
    overallCategory = worstCategory(overallCategory, pl.category);
  }

  // Build bottlenecks (top 5 slowest lines)
  const slowLines = profiledLines
    .filter((pl) => pl.totalMicroseconds > 0 && pl.operations.length > 0)
    .sort((a, b) => b.totalMicroseconds - a.totalMicroseconds)
    .slice(0, 5);

  const bottlenecks: BottleneckEntry[] = slowLines.map((pl) => ({
    line: pl.line,
    operation: pl.operations.length > 0 ? pl.operations[0].name : 'unknown',
    microseconds: pl.totalMicroseconds,
    percentage: totalMicroseconds > 0 ? Math.round((pl.totalMicroseconds / totalMicroseconds) * 100) : 0,
  }));

  return {
    lines: profiledLines,
    totalMicroseconds,
    estimatedHz,
    category: overallCategory,
    loopStartLine: loopInfo.startLine,
    loopEndLine: loopInfo.endLine,
    bottlenecks,
  };
}

/**
 * Get the timing for a specific Arduino operation from the DB.
 */
export function getOperationTiming(name: string): OperationTiming | undefined {
  return OPERATION_TIMING_DB[name];
}

/**
 * Get all operation names in the timing database.
 */
export function getAllOperationNames(): string[] {
  return Object.keys(OPERATION_TIMING_DB);
}

/**
 * Format microseconds into a human-readable string.
 */
export function formatMicroseconds(us: number): string {
  if (us >= 1_000_000) {
    return `${(us / 1_000_000).toFixed(2)}s`;
  }
  if (us >= 1000) {
    return `${(us / 1000).toFixed(2)}ms`;
  }
  return `${us}us`;
}
