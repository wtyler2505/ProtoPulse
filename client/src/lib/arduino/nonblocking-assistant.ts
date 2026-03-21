/**
 * NonblockingAssistant — Detects blocking call patterns in Arduino code and
 * suggests non-blocking alternatives with code snippets.
 *
 * Analyzes Arduino sketches for common blocking anti-patterns (delay(), blocking
 * while loops, synchronous Serial reads, pulseIn, etc.) and provides actionable
 * refactoring suggestions with ready-to-use code snippets.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BlockingSeverity = 'error' | 'warning' | 'info';

export interface BlockingPattern {
  /** Unique rule identifier. */
  id: string;
  /** Human-readable name of the blocking pattern. */
  name: string;
  /** Severity level: error = always blocks, warning = usually blocks, info = may block. */
  severity: BlockingSeverity;
  /** Description of why this pattern is blocking. */
  description: string;
  /** Regex to detect the pattern in a single line of code. */
  pattern: RegExp;
  /** Non-blocking alternative code snippet. */
  snippet: string;
  /** Short explanation of the fix. */
  fixSummary: string;
}

export interface BlockingIssue {
  /** Line number (1-based). */
  line: number;
  /** Column number (0-based). */
  column: number;
  /** The blocking pattern that was detected. */
  ruleId: string;
  /** Severity level. */
  severity: BlockingSeverity;
  /** The matched source text. */
  matchedText: string;
  /** Human-readable message. */
  message: string;
  /** Non-blocking alternative snippet. */
  snippet: string;
  /** Short fix summary. */
  fixSummary: string;
}

export interface NonblockingReport {
  /** All detected blocking issues, sorted by line number. */
  issues: BlockingIssue[];
  /** Count of issues grouped by severity. */
  counts: Record<BlockingSeverity, number>;
  /** Overall score 0-100 (100 = no blocking patterns). */
  score: number;
  /** Total lines analyzed. */
  linesAnalyzed: number;
}

// ---------------------------------------------------------------------------
// Blocking pattern definitions
// ---------------------------------------------------------------------------

export const BLOCKING_PATTERNS: BlockingPattern[] = [
  {
    id: 'delay',
    name: 'delay()',
    severity: 'error',
    description:
      'delay() halts the entire program for the specified duration. No other code can run during this time — no sensor reads, no communication, no button checks.',
    pattern: /\bdelay\s*\(\s*[^)]+\)/,
    fixSummary: 'Use millis()-based timing instead of delay().',
    snippet: `// Instead of: delay(1000);
unsigned long previousMillis = 0;
const unsigned long interval = 1000;

void loop() {
  unsigned long currentMillis = millis();
  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;
    // Your action here
  }
}`,
  },
  {
    id: 'delay-microseconds',
    name: 'delayMicroseconds()',
    severity: 'warning',
    description:
      'delayMicroseconds() blocks execution. Short delays (<100us) for protocol timing are often acceptable, but longer delays should use timer interrupts.',
    pattern: /\bdelayMicroseconds\s*\(\s*[^)]+\)/,
    fixSummary: 'For short protocol timing this may be acceptable. For longer waits, use a hardware timer.',
    snippet: `// For protocol timing (short, acceptable):
delayMicroseconds(10); // OK for bit-banging

// For longer waits, use Timer interrupt:
// Configure Timer1 for periodic interrupt instead`,
  },
  {
    id: 'while-serial-available',
    name: 'while(!Serial.available())',
    severity: 'error',
    description:
      'Spinning in a while loop waiting for serial data blocks the entire program. If no data arrives, the sketch hangs forever.',
    pattern: /\bwhile\s*\(\s*!?\s*Serial\d*\s*\.\s*available\s*\(\s*\)\s*(?:[<>=!]+\s*\d+\s*)?\)/,
    fixSummary: 'Check Serial.available() in loop() without blocking.',
    snippet: `// Instead of: while (!Serial.available()) {}
// Check non-blocking in loop():
void loop() {
  if (Serial.available() > 0) {
    char c = Serial.read();
    // Process character
  }
  // Other code continues to run
}`,
  },
  {
    id: 'serial-read-string',
    name: 'Serial.readString()',
    severity: 'error',
    description:
      'Serial.readString() blocks until timeout (default 1000ms). During this time nothing else runs.',
    pattern: /\bSerial\d*\s*\.\s*readString\s*\(\s*\)/,
    fixSummary: 'Read characters one at a time and accumulate into a buffer.',
    snippet: `// Instead of: String data = Serial.readString();
String inputBuffer = "";
bool messageComplete = false;

void loop() {
  while (Serial.available() > 0) {
    char c = Serial.read();
    if (c == '\\n') {
      messageComplete = true;
    } else {
      inputBuffer += c;
    }
  }
  if (messageComplete) {
    // Process inputBuffer
    inputBuffer = "";
    messageComplete = false;
  }
}`,
  },
  {
    id: 'serial-read-string-until',
    name: 'Serial.readStringUntil()',
    severity: 'error',
    description:
      'Serial.readStringUntil() blocks until the terminator character is received or timeout expires.',
    pattern: /\bSerial\d*\s*\.\s*readStringUntil\s*\(\s*[^)]+\)/,
    fixSummary: 'Accumulate characters in loop() and check for the terminator manually.',
    snippet: `// Instead of: String line = Serial.readStringUntil('\\n');
String inputBuffer = "";

void loop() {
  while (Serial.available() > 0) {
    char c = Serial.read();
    if (c == '\\n') {
      processLine(inputBuffer);
      inputBuffer = "";
    } else {
      inputBuffer += c;
    }
  }
}`,
  },
  {
    id: 'serial-parse-int',
    name: 'Serial.parseInt()',
    severity: 'warning',
    description:
      'Serial.parseInt() blocks until a non-digit character is received or timeout expires (default 1000ms).',
    pattern: /\bSerial\d*\s*\.\s*parseInt\s*\(\s*\)/,
    fixSummary: 'Read characters into a buffer and convert with atoi() or toInt() when complete.',
    snippet: `// Instead of: int val = Serial.parseInt();
String numBuffer = "";

void loop() {
  while (Serial.available() > 0) {
    char c = Serial.read();
    if (c >= '0' && c <= '9' || c == '-') {
      numBuffer += c;
    } else if (numBuffer.length() > 0) {
      int val = numBuffer.toInt();
      // Use val
      numBuffer = "";
    }
  }
}`,
  },
  {
    id: 'serial-parse-float',
    name: 'Serial.parseFloat()',
    severity: 'warning',
    description:
      'Serial.parseFloat() blocks until a non-numeric character is received or timeout expires (default 1000ms).',
    pattern: /\bSerial\d*\s*\.\s*parseFloat\s*\(\s*\)/,
    fixSummary: 'Read characters into a buffer and convert with atof() or toFloat() when complete.',
    snippet: `// Instead of: float val = Serial.parseFloat();
String numBuffer = "";

void loop() {
  while (Serial.available() > 0) {
    char c = Serial.read();
    if (c >= '0' && c <= '9' || c == '.' || c == '-') {
      numBuffer += c;
    } else if (numBuffer.length() > 0) {
      float val = numBuffer.toFloat();
      // Use val
      numBuffer = "";
    }
  }
}`,
  },
  {
    id: 'serial-read-bytes',
    name: 'Serial.readBytes()',
    severity: 'error',
    description:
      'Serial.readBytes() blocks until the requested number of bytes is received or timeout expires.',
    pattern: /\bSerial\d*\s*\.\s*readBytes\s*\(\s*[^)]+\)/,
    fixSummary: 'Track received byte count in loop() and process when complete.',
    snippet: `// Instead of: Serial.readBytes(buffer, length);
byte buffer[64];
int bytesReceived = 0;
const int expectedBytes = 64;

void loop() {
  while (Serial.available() > 0 && bytesReceived < expectedBytes) {
    buffer[bytesReceived++] = Serial.read();
  }
  if (bytesReceived >= expectedBytes) {
    // Process complete buffer
    bytesReceived = 0;
  }
}`,
  },
  {
    id: 'pulse-in',
    name: 'pulseIn()',
    severity: 'warning',
    description:
      'pulseIn() blocks until a pulse is detected or timeout expires (default 1s). Use pulseInLong() or interrupt-based measurement for better responsiveness.',
    pattern: /\bpulseIn\s*\(\s*[^)]+\)/,
    fixSummary: 'Use interrupt-based pulse measurement or pulseInLong() with a short timeout.',
    snippet: `// Instead of: long duration = pulseIn(pin, HIGH);
// Use interrupt-based measurement:
volatile unsigned long pulseStart = 0;
volatile unsigned long pulseDuration = 0;
volatile bool pulseComplete = false;

void pulseISR() {
  if (digitalRead(ECHO_PIN) == HIGH) {
    pulseStart = micros();
  } else {
    pulseDuration = micros() - pulseStart;
    pulseComplete = true;
  }
}

void setup() {
  attachInterrupt(digitalPinToInterrupt(ECHO_PIN), pulseISR, CHANGE);
}

void loop() {
  if (pulseComplete) {
    pulseComplete = false;
    // Use pulseDuration
  }
}`,
  },
  {
    id: 'while-true-wait',
    name: 'while(true) busy wait',
    severity: 'error',
    description:
      'An infinite while(true) or while(1) loop with a condition check inside blocks the main loop() from executing. This prevents other tasks from running.',
    pattern: /\bwhile\s*\(\s*(?:true|1)\s*\)\s*\{/,
    fixSummary: 'Move the condition check into loop() as a state machine.',
    snippet: `// Instead of: while(true) { if (condition) break; }
// Use a state machine in loop():
enum State { WAITING, READY, PROCESSING };
State currentState = WAITING;

void loop() {
  switch (currentState) {
    case WAITING:
      if (conditionMet()) {
        currentState = READY;
      }
      break;
    case READY:
      // Process
      currentState = WAITING;
      break;
  }
}`,
  },
  {
    id: 'wire-end-transmission-wait',
    name: 'Wire busy wait',
    severity: 'warning',
    description:
      'Looping while waiting for Wire (I2C) data blocks execution. I2C transactions are inherently blocking but the wait loop compounds the issue.',
    pattern: /\bwhile\s*\(\s*(?:!?\s*Wire\s*\.\s*available\s*\(\s*\)|Wire\s*\.\s*available\s*\(\s*\)\s*(?:<|==)\s*\d+)\s*\)/,
    fixSummary: 'Use a timeout or check Wire.available() in loop() with a state machine.',
    snippet: `// Instead of: while (!Wire.available()) {}
// Use a timeout:
unsigned long wireTimeout = millis();
while (!Wire.available()) {
  if (millis() - wireTimeout > 100) {
    // Handle timeout
    break;
  }
}

// Or check in loop() with state machine:
enum I2CState { IDLE, WAITING_DATA, DATA_READY };`,
  },
  {
    id: 'serial-find',
    name: 'Serial.find()',
    severity: 'error',
    description:
      'Serial.find() blocks until the target string is found or timeout expires.',
    pattern: /\bSerial\d*\s*\.\s*find\s*\(\s*[^)]+\)/,
    fixSummary: 'Buffer incoming characters and search for the target string manually.',
    snippet: `// Instead of: Serial.find("OK");
String buffer = "";
bool found = false;

void loop() {
  while (Serial.available() > 0) {
    buffer += (char)Serial.read();
    if (buffer.endsWith("OK")) {
      found = true;
      buffer = "";
    }
    // Prevent buffer overflow
    if (buffer.length() > 100) {
      buffer = buffer.substring(buffer.length() - 10);
    }
  }
}`,
  },
  {
    id: 'serial-find-until',
    name: 'Serial.findUntil()',
    severity: 'error',
    description:
      'Serial.findUntil() blocks until the target string or terminator is found, or timeout expires.',
    pattern: /\bSerial\d*\s*\.\s*findUntil\s*\(\s*[^)]+\)/,
    fixSummary: 'Buffer incoming characters and search for target/terminator manually.',
    snippet: `// Instead of: Serial.findUntil("OK", "\\n");
// Buffer and search manually in loop()
String buffer = "";

void loop() {
  while (Serial.available() > 0) {
    char c = Serial.read();
    if (c == '\\n') {
      if (buffer.indexOf("OK") >= 0) {
        // Found target before terminator
      }
      buffer = "";
    } else {
      buffer += c;
    }
  }
}`,
  },
];

// ---------------------------------------------------------------------------
// Comment/string detection helpers
// ---------------------------------------------------------------------------

/**
 * Check if a position on a line is inside a single-line comment.
 */
function isInLineComment(line: string, column: number): boolean {
  const idx = line.indexOf('//');
  return idx !== -1 && idx < column;
}

/**
 * Check if a position on a line is inside a string literal.
 */
function isInStringLiteral(line: string, column: number): boolean {
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
 * Build a set of line ranges that are inside multi-line comments.
 * Returns a Set of 1-based line numbers that are wholly or partially inside
 * block comments.
 */
function findBlockCommentLines(code: string): Set<number> {
  const result = new Set<number>();
  let inBlock = false;
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let j = 0;

    while (j < line.length) {
      if (inBlock) {
        result.add(i + 1);
        const endIdx = line.indexOf('*/', j);
        if (endIdx !== -1) {
          inBlock = false;
          j = endIdx + 2;
        } else {
          break; // rest of line is in comment
        }
      } else {
        const startIdx = line.indexOf('/*', j);
        if (startIdx !== -1) {
          // Check it's not inside a string
          if (!isInStringLiteral(line, startIdx)) {
            inBlock = true;
            result.add(i + 1);
            const endIdx = line.indexOf('*/', startIdx + 2);
            if (endIdx !== -1) {
              inBlock = false;
              j = endIdx + 2;
            } else {
              break;
            }
          } else {
            j = startIdx + 2;
          }
        } else {
          break;
        }
      }
    }

    if (inBlock) {
      result.add(i + 1);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Multi-line pattern detection
// ---------------------------------------------------------------------------

/**
 * Detect blocking while loops that span multiple lines.
 * Looks for patterns like:
 *   while (condition) {
 *     // only contains blocking waits or empty body
 *   }
 * where condition involves polling a hardware state.
 */
function detectMultilineWhileLoops(code: string, blockCommentLines: Set<number>): BlockingIssue[] {
  const issues: BlockingIssue[] = [];
  const lines = code.split('\n');

  // Match while loops that poll for conditions (but not while(true) — handled separately)
  const whilePattern = /\bwhile\s*\(\s*(?:digitalRead|analogRead)\s*\([^)]*\)\s*(?:==|!=|<|>|<=|>=)\s*[^)]+\)/;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    if (blockCommentLines.has(lineNum)) {
      continue;
    }
    const line = lines[i];
    const m = whilePattern.exec(line);
    if (m && !isInLineComment(line, m.index) && !isInStringLiteral(line, m.index)) {
      issues.push({
        line: lineNum,
        column: m.index,
        ruleId: 'while-poll-pin',
        severity: 'warning',
        matchedText: m[0],
        message:
          'Polling a pin in a while loop blocks execution. Other code cannot run until the condition changes.',
        snippet: `// Instead of: while (digitalRead(pin) == HIGH) {}
// Use a non-blocking check in loop():
void loop() {
  if (digitalRead(pin) == HIGH) {
    // Handle the condition
  }
  // Other code continues to run
}`,
        fixSummary: 'Check the pin state in loop() instead of spinning in a while loop.',
      });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Main analysis function
// ---------------------------------------------------------------------------

/**
 * Analyze Arduino code for blocking patterns and return a detailed report
 * with issues, suggestions, and a non-blocking score.
 */
export function analyzeBlockingPatterns(code: string): NonblockingReport {
  const lines = code.split('\n');
  const blockCommentLines = findBlockCommentLines(code);
  const issues: BlockingIssue[] = [];

  // Check each line against single-line patterns
  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];

    // Skip lines entirely inside block comments
    if (blockCommentLines.has(lineNum)) {
      // But only skip if the entire line is a comment (not just partially)
      const trimmed = line.trim();
      if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('//')) {
        continue;
      }
    }

    for (const bp of BLOCKING_PATTERNS) {
      const m = bp.pattern.exec(line);
      if (!m) {
        continue;
      }

      const col = m.index;

      // Skip matches inside comments or strings
      if (isInLineComment(line, col) || isInStringLiteral(line, col)) {
        continue;
      }

      // Skip if inside a block comment
      if (blockCommentLines.has(lineNum)) {
        continue;
      }

      issues.push({
        line: lineNum,
        column: col,
        ruleId: bp.id,
        severity: bp.severity,
        matchedText: m[0],
        message: bp.description,
        snippet: bp.snippet,
        fixSummary: bp.fixSummary,
      });
    }
  }

  // Multi-line pattern detection
  const multilineIssues = detectMultilineWhileLoops(code, blockCommentLines);
  issues.push(...multilineIssues);

  // Sort by line number, then column
  issues.sort((a, b) => a.line - b.line || a.column - b.column);

  // Count by severity
  const counts: Record<BlockingSeverity, number> = { error: 0, warning: 0, info: 0 };
  for (const issue of issues) {
    counts[issue.severity]++;
  }

  // Score: 100 = no issues. Each error = -15, warning = -8, info = -3. Min 0.
  const deductions = counts.error * 15 + counts.warning * 8 + counts.info * 3;
  const score = Math.max(0, 100 - deductions);

  return {
    issues,
    counts,
    score,
    linesAnalyzed: lines.length,
  };
}

/**
 * Get the blocking pattern metadata for a given rule ID.
 */
export function getPatternById(ruleId: string): BlockingPattern | undefined {
  return BLOCKING_PATTERNS.find((p) => p.id === ruleId);
}

/**
 * Get all unique rule IDs defined in the pattern database.
 */
export function getAllRuleIds(): string[] {
  return BLOCKING_PATTERNS.map((p) => p.id);
}

/**
 * Quick check: does this code contain any blocking patterns?
 * Faster than full analysis when you only need a boolean answer.
 */
export function hasBlockingPatterns(code: string): boolean {
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const bp of BLOCKING_PATTERNS) {
      const m = bp.pattern.exec(line);
      if (m && !isInLineComment(line, m.index) && !isInStringLiteral(line, m.index)) {
        return true;
      }
    }
  }
  return false;
}
