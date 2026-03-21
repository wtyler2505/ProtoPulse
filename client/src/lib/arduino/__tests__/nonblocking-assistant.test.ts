import { describe, it, expect } from 'vitest';
import {
  analyzeBlockingPatterns,
  getPatternById,
  getAllRuleIds,
  hasBlockingPatterns,
  BLOCKING_PATTERNS,
} from '../nonblocking-assistant';
import type { BlockingIssue, NonblockingReport } from '../nonblocking-assistant';

// ──────────────────────────────────────────────────────────────────
// BLOCKING_PATTERNS metadata
// ──────────────────────────────────────────────────────────────────

describe('BLOCKING_PATTERNS', () => {
  it('contains at least 10 patterns', () => {
    expect(BLOCKING_PATTERNS.length).toBeGreaterThanOrEqual(10);
  });

  it('has unique IDs', () => {
    const ids = BLOCKING_PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every pattern has required fields', () => {
    for (const p of BLOCKING_PATTERNS) {
      expect(p.id.length).toBeGreaterThan(0);
      expect(p.name.length).toBeGreaterThan(0);
      expect(['error', 'warning', 'info']).toContain(p.severity);
      expect(p.description.length).toBeGreaterThan(10);
      expect(p.snippet.length).toBeGreaterThan(10);
      expect(p.fixSummary.length).toBeGreaterThan(5);
      expect(p.pattern).toBeInstanceOf(RegExp);
    }
  });

  it('contains the core blocking patterns', () => {
    const ids = BLOCKING_PATTERNS.map((p) => p.id);
    expect(ids).toContain('delay');
    expect(ids).toContain('delay-microseconds');
    expect(ids).toContain('serial-read-string');
    expect(ids).toContain('pulse-in');
    expect(ids).toContain('while-true-wait');
    expect(ids).toContain('while-serial-available');
  });
});

// ──────────────────────────────────────────────────────────────────
// getPatternById
// ──────────────────────────────────────────────────────────────────

describe('getPatternById', () => {
  it('returns a pattern by ID', () => {
    const p = getPatternById('delay');
    expect(p).toBeDefined();
    expect(p?.name).toBe('delay()');
  });

  it('returns undefined for unknown ID', () => {
    expect(getPatternById('nonexistent-rule')).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────
// getAllRuleIds
// ──────────────────────────────────────────────────────────────────

describe('getAllRuleIds', () => {
  it('returns all rule IDs', () => {
    const ids = getAllRuleIds();
    expect(ids.length).toBe(BLOCKING_PATTERNS.length);
    expect(ids).toContain('delay');
    expect(ids).toContain('pulse-in');
  });
});

// ──────────────────────────────────────────────────────────────────
// analyzeBlockingPatterns — delay()
// ──────────────────────────────────────────────────────────────────

describe('analyzeBlockingPatterns — delay', () => {
  it('detects delay() in loop', () => {
    const code = `
void loop() {
  digitalWrite(LED, HIGH);
  delay(1000);
  digitalWrite(LED, LOW);
  delay(1000);
}
`;
    const report = analyzeBlockingPatterns(code);
    const delays = report.issues.filter((i) => i.ruleId === 'delay');
    expect(delays).toHaveLength(2);
    expect(delays[0].severity).toBe('error');
  });

  it('detects delay with variable argument', () => {
    const code = `
void loop() {
  delay(interval);
}
`;
    const report = analyzeBlockingPatterns(code);
    expect(report.issues.some((i) => i.ruleId === 'delay')).toBe(true);
  });

  it('does not flag delay in a comment', () => {
    const code = `
void loop() {
  // delay(1000); — removed for non-blocking
  unsigned long t = millis();
}
`;
    const report = analyzeBlockingPatterns(code);
    expect(report.issues.filter((i) => i.ruleId === 'delay')).toHaveLength(0);
  });

  it('does not flag delay in a string literal', () => {
    const code = `
void loop() {
  Serial.println("Use delay(1000) for timing");
}
`;
    const report = analyzeBlockingPatterns(code);
    expect(report.issues.filter((i) => i.ruleId === 'delay')).toHaveLength(0);
  });

  it('provides a snippet for delay', () => {
    const code = `void loop() { delay(500); }`;
    const report = analyzeBlockingPatterns(code);
    const issue = report.issues.find((i) => i.ruleId === 'delay');
    expect(issue).toBeDefined();
    expect(issue?.snippet).toContain('millis()');
    expect(issue?.fixSummary.length).toBeGreaterThan(5);
  });
});

// ──────────────────────────────────────────────────────────────────
// analyzeBlockingPatterns — delayMicroseconds()
// ──────────────────────────────────────────────────────────────────

describe('analyzeBlockingPatterns — delayMicroseconds', () => {
  it('detects delayMicroseconds()', () => {
    const code = `
void loop() {
  delayMicroseconds(100);
}
`;
    const report = analyzeBlockingPatterns(code);
    const issues = report.issues.filter((i) => i.ruleId === 'delay-microseconds');
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warning');
  });
});

// ──────────────────────────────────────────────────────────────────
// analyzeBlockingPatterns — Serial blocking reads
// ──────────────────────────────────────────────────────────────────

describe('analyzeBlockingPatterns — Serial blocking reads', () => {
  it('detects Serial.readString()', () => {
    const code = `
void loop() {
  String data = Serial.readString();
}
`;
    const report = analyzeBlockingPatterns(code);
    expect(report.issues.some((i) => i.ruleId === 'serial-read-string')).toBe(true);
  });

  it('detects Serial.readStringUntil()', () => {
    const code = `
void loop() {
  String line = Serial.readStringUntil('\\n');
}
`;
    const report = analyzeBlockingPatterns(code);
    expect(report.issues.some((i) => i.ruleId === 'serial-read-string-until')).toBe(true);
  });

  it('detects Serial.parseInt()', () => {
    const code = `
void loop() {
  int val = Serial.parseInt();
}
`;
    const report = analyzeBlockingPatterns(code);
    expect(report.issues.some((i) => i.ruleId === 'serial-parse-int')).toBe(true);
  });

  it('detects Serial.parseFloat()', () => {
    const code = `
void loop() {
  float val = Serial.parseFloat();
}
`;
    const report = analyzeBlockingPatterns(code);
    expect(report.issues.some((i) => i.ruleId === 'serial-parse-float')).toBe(true);
  });

  it('detects Serial.readBytes()', () => {
    const code = `
void loop() {
  Serial.readBytes(buf, 10);
}
`;
    const report = analyzeBlockingPatterns(code);
    expect(report.issues.some((i) => i.ruleId === 'serial-read-bytes')).toBe(true);
  });

  it('detects Serial.find()', () => {
    const code = `
void loop() {
  if (Serial.find("OK")) {
    // got response
  }
}
`;
    const report = analyzeBlockingPatterns(code);
    expect(report.issues.some((i) => i.ruleId === 'serial-find')).toBe(true);
  });

  it('detects Serial.findUntil()', () => {
    const code = `
void loop() {
  Serial.findUntil("OK", "\\n");
}
`;
    const report = analyzeBlockingPatterns(code);
    expect(report.issues.some((i) => i.ruleId === 'serial-find-until')).toBe(true);
  });

  it('detects Serial1.readString() (numbered serial port)', () => {
    const code = `
void loop() {
  String data = Serial1.readString();
}
`;
    const report = analyzeBlockingPatterns(code);
    expect(report.issues.some((i) => i.ruleId === 'serial-read-string')).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────
// analyzeBlockingPatterns — while loops
// ──────────────────────────────────────────────────────────────────

describe('analyzeBlockingPatterns — while loops', () => {
  it('detects while(!Serial.available())', () => {
    const code = `
void loop() {
  while (!Serial.available()) {}
  char c = Serial.read();
}
`;
    const report = analyzeBlockingPatterns(code);
    expect(report.issues.some((i) => i.ruleId === 'while-serial-available')).toBe(true);
  });

  it('detects while(Serial.available() == 0)', () => {
    const code = `
void loop() {
  while (Serial.available() == 0) {}
}
`;
    const report = analyzeBlockingPatterns(code);
    expect(report.issues.some((i) => i.ruleId === 'while-serial-available')).toBe(true);
  });

  it('detects while(true) busy wait', () => {
    const code = `
void waitForButton() {
  while(true) {
    if (digitalRead(2) == LOW) break;
  }
}
`;
    const report = analyzeBlockingPatterns(code);
    expect(report.issues.some((i) => i.ruleId === 'while-true-wait')).toBe(true);
  });

  it('detects while(1) busy wait', () => {
    const code = `
void setup() {
  while(1) {
    if (ready) break;
  }
}
`;
    const report = analyzeBlockingPatterns(code);
    expect(report.issues.some((i) => i.ruleId === 'while-true-wait')).toBe(true);
  });

  it('detects while polling digitalRead', () => {
    const code = `
void loop() {
  while (digitalRead(2) == HIGH) {}
}
`;
    const report = analyzeBlockingPatterns(code);
    expect(report.issues.some((i) => i.ruleId === 'while-poll-pin')).toBe(true);
  });

  it('detects Wire busy wait', () => {
    const code = `
void loop() {
  Wire.requestFrom(0x68, 6);
  while (!Wire.available()) {}
}
`;
    const report = analyzeBlockingPatterns(code);
    expect(report.issues.some((i) => i.ruleId === 'wire-end-transmission-wait')).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────
// analyzeBlockingPatterns — pulseIn
// ──────────────────────────────────────────────────────────────────

describe('analyzeBlockingPatterns — pulseIn', () => {
  it('detects pulseIn()', () => {
    const code = `
void loop() {
  long duration = pulseIn(echoPin, HIGH);
}
`;
    const report = analyzeBlockingPatterns(code);
    const issues = report.issues.filter((i) => i.ruleId === 'pulse-in');
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warning');
  });

  it('detects pulseIn with timeout', () => {
    const code = `
void loop() {
  long d = pulseIn(pin, HIGH, 30000);
}
`;
    const report = analyzeBlockingPatterns(code);
    expect(report.issues.some((i) => i.ruleId === 'pulse-in')).toBe(true);
  });

  it('provides interrupt-based alternative snippet', () => {
    const code = `void loop() { pulseIn(pin, HIGH); }`;
    const report = analyzeBlockingPatterns(code);
    const issue = report.issues.find((i) => i.ruleId === 'pulse-in');
    expect(issue?.snippet).toContain('attachInterrupt');
  });
});

// ──────────────────────────────────────────────────────────────────
// analyzeBlockingPatterns — report structure
// ──────────────────────────────────────────────────────────────────

describe('analyzeBlockingPatterns — report', () => {
  it('returns correct counts by severity', () => {
    const code = `
void loop() {
  delay(1000);
  delayMicroseconds(50);
  Serial.readString();
}
`;
    const report = analyzeBlockingPatterns(code);
    // delay = error, delayMicroseconds = warning, readString = error
    expect(report.counts.error).toBe(2);
    expect(report.counts.warning).toBe(1);
  });

  it('returns score of 100 for clean code', () => {
    const code = `
void setup() {
  Serial.begin(9600);
}

void loop() {
  if (Serial.available() > 0) {
    char c = Serial.read();
  }
}
`;
    const report = analyzeBlockingPatterns(code);
    expect(report.score).toBe(100);
    expect(report.issues).toHaveLength(0);
  });

  it('decreases score based on severity', () => {
    const code = `
void loop() {
  delay(1000);
}
`;
    const report = analyzeBlockingPatterns(code);
    expect(report.score).toBeLessThan(100);
    expect(report.score).toBeGreaterThanOrEqual(0);
  });

  it('score does not go below 0', () => {
    const code = `
void loop() {
  delay(1); delay(2); delay(3); delay(4); delay(5);
  delay(6); delay(7); delay(8); delay(9); delay(10);
  Serial.readString();
  Serial.readStringUntil('x');
  pulseIn(1, HIGH);
}
`;
    const report = analyzeBlockingPatterns(code);
    expect(report.score).toBe(0);
  });

  it('reports linesAnalyzed', () => {
    const code = 'line1\nline2\nline3\n';
    const report = analyzeBlockingPatterns(code);
    expect(report.linesAnalyzed).toBe(4); // trailing newline = extra empty line
  });

  it('issues are sorted by line number', () => {
    const code = `
void loop() {
  Serial.readString();
  delay(100);
  pulseIn(pin, HIGH);
}
`;
    const report = analyzeBlockingPatterns(code);
    for (let i = 1; i < report.issues.length; i++) {
      expect(report.issues[i].line).toBeGreaterThanOrEqual(report.issues[i - 1].line);
    }
  });

  it('every issue has all required fields', () => {
    const code = `
void loop() {
  delay(1000);
  Serial.readString();
  pulseIn(pin, HIGH);
  while (true) { if (x) break; }
}
`;
    const report = analyzeBlockingPatterns(code);
    expect(report.issues.length).toBeGreaterThanOrEqual(4);

    for (const issue of report.issues) {
      expect(typeof issue.line).toBe('number');
      expect(issue.line).toBeGreaterThan(0);
      expect(typeof issue.column).toBe('number');
      expect(issue.column).toBeGreaterThanOrEqual(0);
      expect(issue.ruleId.length).toBeGreaterThan(0);
      expect(['error', 'warning', 'info']).toContain(issue.severity);
      expect(issue.matchedText.length).toBeGreaterThan(0);
      expect(issue.message.length).toBeGreaterThan(10);
      expect(issue.snippet.length).toBeGreaterThan(10);
      expect(issue.fixSummary.length).toBeGreaterThan(5);
    }
  });
});

// ──────────────────────────────────────────────────────────────────
// analyzeBlockingPatterns — comment & string filtering
// ──────────────────────────────────────────────────────────────────

describe('analyzeBlockingPatterns — comment filtering', () => {
  it('ignores patterns in single-line comments', () => {
    const code = `
void loop() {
  // delay(1000);
  // Serial.readString();
}
`;
    const report = analyzeBlockingPatterns(code);
    expect(report.issues).toHaveLength(0);
  });

  it('ignores patterns in block comments', () => {
    const code = `
void loop() {
  /* delay(1000); */
  /*
   * Serial.readString();
   * pulseIn(pin, HIGH);
   */
}
`;
    const report = analyzeBlockingPatterns(code);
    expect(report.issues).toHaveLength(0);
  });

  it('ignores patterns in string literals', () => {
    const code = `
void loop() {
  Serial.println("delay(1000)");
  char* msg = "Serial.readString()";
}
`;
    const report = analyzeBlockingPatterns(code);
    expect(report.issues).toHaveLength(0);
  });

  it('detects patterns after a comment on the same line', () => {
    const code = `
void loop() {
  int x = 1; delay(1000);
}
`;
    const report = analyzeBlockingPatterns(code);
    expect(report.issues.some((i) => i.ruleId === 'delay')).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────
// analyzeBlockingPatterns — real-world sketches
// ──────────────────────────────────────────────────────────────────

describe('analyzeBlockingPatterns — real-world sketches', () => {
  it('analyzes a classic blink sketch', () => {
    const code = `
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(1000);
  digitalWrite(LED_BUILTIN, LOW);
  delay(1000);
}
`;
    const report = analyzeBlockingPatterns(code);
    expect(report.issues).toHaveLength(2);
    expect(report.issues.every((i) => i.ruleId === 'delay')).toBe(true);
  });

  it('gives perfect score to millis-based blink', () => {
    const code = `
unsigned long previousMillis = 0;
const long interval = 1000;
int ledState = LOW;

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  unsigned long currentMillis = millis();
  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;
    ledState = (ledState == LOW) ? HIGH : LOW;
    digitalWrite(LED_BUILTIN, ledState);
  }
}
`;
    const report = analyzeBlockingPatterns(code);
    expect(report.score).toBe(100);
    expect(report.issues).toHaveLength(0);
  });

  it('detects multiple issues in a sensor sketch', () => {
    const code = `
void setup() {
  Serial.begin(9600);
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
}

void loop() {
  // Trigger ultrasonic
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);

  long duration = pulseIn(ECHO, HIGH);
  float distance = duration * 0.034 / 2;

  Serial.print("Distance: ");
  Serial.println(distance);
  delay(500);
}
`;
    const report = analyzeBlockingPatterns(code);
    // 2x delayMicroseconds (warning), 1x pulseIn (warning), 1x delay (error)
    expect(report.issues.length).toBeGreaterThanOrEqual(4);
    expect(report.counts.error).toBeGreaterThanOrEqual(1);
    expect(report.counts.warning).toBeGreaterThanOrEqual(3);
  });

  it('detects blocking serial command parser', () => {
    const code = `
void loop() {
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\\n');
    if (cmd == "LED_ON") {
      digitalWrite(LED, HIGH);
    }
  }
}
`;
    const report = analyzeBlockingPatterns(code);
    expect(report.issues.some((i) => i.ruleId === 'serial-read-string-until')).toBe(true);
  });

  it('handles empty code', () => {
    const report = analyzeBlockingPatterns('');
    expect(report.issues).toHaveLength(0);
    expect(report.score).toBe(100);
    expect(report.linesAnalyzed).toBe(1);
  });

  it('handles code with only comments', () => {
    const code = `
// This is a comment
/* Block comment */
// delay(1000);
`;
    const report = analyzeBlockingPatterns(code);
    expect(report.issues).toHaveLength(0);
    expect(report.score).toBe(100);
  });
});

// ──────────────────────────────────────────────────────────────────
// hasBlockingPatterns
// ──────────────────────────────────────────────────────────────────

describe('hasBlockingPatterns', () => {
  it('returns true when blocking code exists', () => {
    expect(hasBlockingPatterns('void loop() { delay(1000); }')).toBe(true);
  });

  it('returns false for clean code', () => {
    const code = `
void loop() {
  if (millis() - prev >= 1000) {
    prev = millis();
  }
}
`;
    expect(hasBlockingPatterns(code)).toBe(false);
  });

  it('returns false for commented-out blocking code', () => {
    expect(hasBlockingPatterns('// delay(1000);')).toBe(false);
  });

  it('returns false for blocking code in strings', () => {
    expect(hasBlockingPatterns('Serial.println("delay(1000)");')).toBe(false);
  });

  it('returns true for any single blocking pattern', () => {
    expect(hasBlockingPatterns('pulseIn(pin, HIGH);')).toBe(true);
    expect(hasBlockingPatterns('Serial.readString();')).toBe(true);
    expect(hasBlockingPatterns('delayMicroseconds(500);')).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────
// analyzeBlockingPatterns — line/column accuracy
// ──────────────────────────────────────────────────────────────────

describe('analyzeBlockingPatterns — line/column accuracy', () => {
  it('reports correct line numbers', () => {
    const code = `line1
line2
void loop() {
  delay(100);
}
`;
    const report = analyzeBlockingPatterns(code);
    const issue = report.issues.find((i) => i.ruleId === 'delay');
    expect(issue).toBeDefined();
    expect(issue?.line).toBe(4);
  });

  it('reports correct column for indented code', () => {
    const code = `void loop() {
    delay(100);
}`;
    const report = analyzeBlockingPatterns(code);
    const issue = report.issues.find((i) => i.ruleId === 'delay');
    expect(issue).toBeDefined();
    expect(issue?.column).toBe(4);
  });

  it('captures matched text', () => {
    const code = `void loop() { delay(500); }`;
    const report = analyzeBlockingPatterns(code);
    const issue = report.issues.find((i) => i.ruleId === 'delay');
    expect(issue?.matchedText).toBe('delay(500)');
  });
});

// ──────────────────────────────────────────────────────────────────
// analyzeBlockingPatterns — edge cases
// ──────────────────────────────────────────────────────────────────

describe('analyzeBlockingPatterns — edge cases', () => {
  it('does not flag non-blocking Serial.read()', () => {
    const code = `
void loop() {
  if (Serial.available()) {
    char c = Serial.read();
  }
}
`;
    const report = analyzeBlockingPatterns(code);
    expect(report.issues).toHaveLength(0);
  });

  it('does not flag Serial.available() check', () => {
    const code = `
void loop() {
  int n = Serial.available();
}
`;
    const report = analyzeBlockingPatterns(code);
    expect(report.issues).toHaveLength(0);
  });

  it('does not flag Serial.begin()', () => {
    const code = `
void setup() {
  Serial.begin(9600);
}
`;
    const report = analyzeBlockingPatterns(code);
    expect(report.issues).toHaveLength(0);
  });

  it('does not flag millis() usage', () => {
    const code = `
void loop() {
  unsigned long t = millis();
}
`;
    const report = analyzeBlockingPatterns(code);
    expect(report.issues).toHaveLength(0);
  });

  it('handles multiple patterns on the same line', () => {
    const code = `void f() { delay(1); Serial.readString(); }`;
    const report = analyzeBlockingPatterns(code);
    expect(report.issues.length).toBeGreaterThanOrEqual(2);
  });

  it('handles code with no newline at end', () => {
    const code = 'void loop() { delay(100); }';
    const report = analyzeBlockingPatterns(code);
    expect(report.issues).toHaveLength(1);
  });

  it('handles code with Windows line endings', () => {
    const code = 'void loop() {\r\n  delay(100);\r\n}';
    const report = analyzeBlockingPatterns(code);
    expect(report.issues.some((i) => i.ruleId === 'delay')).toBe(true);
  });

  it('handles deeply nested blocking calls', () => {
    const code = `
void loop() {
  if (x) {
    if (y) {
      if (z) {
        delay(100);
      }
    }
  }
}
`;
    const report = analyzeBlockingPatterns(code);
    expect(report.issues.some((i) => i.ruleId === 'delay')).toBe(true);
  });
});
