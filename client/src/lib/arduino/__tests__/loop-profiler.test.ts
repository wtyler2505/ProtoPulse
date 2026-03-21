import { describe, it, expect } from 'vitest';
import {
  profileLoop,
  extractLoopBody,
  getOperationTiming,
  getAllOperationNames,
  formatMicroseconds,
  categorizeTime,
  OPERATION_TIMING_DB,
} from '../loop-profiler';
import type { LoopProfile } from '../loop-profiler';

// ──────────────────────────────────────────────────────────────────
// OPERATION_TIMING_DB
// ──────────────────────────────────────────────────────────────────

describe('OPERATION_TIMING_DB', () => {
  it('contains at least 30 operations', () => {
    expect(Object.keys(OPERATION_TIMING_DB).length).toBeGreaterThanOrEqual(30);
  });

  it('every entry has required fields', () => {
    const entries = Object.entries(OPERATION_TIMING_DB);
    for (const [_key, timing] of entries) {
      expect(timing.name.length).toBeGreaterThan(0);
      expect(timing.microseconds).toBeGreaterThanOrEqual(0);
      expect(['fast', 'moderate', 'slow', 'blocking']).toContain(timing.category);
      expect(timing.description.length).toBeGreaterThan(5);
    }
  });

  it('has entries for core Arduino functions', () => {
    expect(OPERATION_TIMING_DB['digitalWrite']).toBeDefined();
    expect(OPERATION_TIMING_DB['digitalRead']).toBeDefined();
    expect(OPERATION_TIMING_DB['analogRead']).toBeDefined();
    expect(OPERATION_TIMING_DB['delay']).toBeDefined();
    expect(OPERATION_TIMING_DB['Serial.println']).toBeDefined();
    expect(OPERATION_TIMING_DB['pulseIn']).toBeDefined();
  });

  it('delay is categorized as blocking', () => {
    expect(OPERATION_TIMING_DB['delay'].category).toBe('blocking');
  });

  it('digitalWrite is categorized as fast', () => {
    expect(OPERATION_TIMING_DB['digitalWrite'].category).toBe('fast');
  });

  it('analogRead is categorized as moderate', () => {
    expect(OPERATION_TIMING_DB['analogRead'].category).toBe('moderate');
  });
});

// ──────────────────────────────────────────────────────────────────
// getOperationTiming / getAllOperationNames
// ──────────────────────────────────────────────────────────────────

describe('getOperationTiming', () => {
  it('returns timing for known operation', () => {
    const t = getOperationTiming('delay');
    expect(t).toBeDefined();
    expect(t?.microseconds).toBeGreaterThan(0);
  });

  it('returns undefined for unknown operation', () => {
    expect(getOperationTiming('nonexistentFunc')).toBeUndefined();
  });
});

describe('getAllOperationNames', () => {
  it('returns all operation names', () => {
    const names = getAllOperationNames();
    expect(names.length).toBe(Object.keys(OPERATION_TIMING_DB).length);
    expect(names).toContain('delay');
    expect(names).toContain('analogRead');
  });
});

// ──────────────────────────────────────────────────────────────────
// categorizeTime
// ──────────────────────────────────────────────────────────────────

describe('categorizeTime', () => {
  it('categorizes <100us as fast', () => {
    expect(categorizeTime(50)).toBe('fast');
    expect(categorizeTime(0)).toBe('fast');
    expect(categorizeTime(99)).toBe('fast');
  });

  it('categorizes 100-9999us as moderate', () => {
    expect(categorizeTime(100)).toBe('moderate');
    expect(categorizeTime(5000)).toBe('moderate');
    expect(categorizeTime(9999)).toBe('moderate');
  });

  it('categorizes 10000-99999us as slow', () => {
    expect(categorizeTime(10000)).toBe('slow');
    expect(categorizeTime(50000)).toBe('slow');
  });

  it('categorizes >=100000us as blocking', () => {
    expect(categorizeTime(100000)).toBe('blocking');
    expect(categorizeTime(1000000)).toBe('blocking');
  });
});

// ──────────────────────────────────────────────────────────────────
// formatMicroseconds
// ──────────────────────────────────────────────────────────────────

describe('formatMicroseconds', () => {
  it('formats microseconds', () => {
    expect(formatMicroseconds(50)).toBe('50us');
  });

  it('formats milliseconds', () => {
    expect(formatMicroseconds(1500)).toBe('1.50ms');
  });

  it('formats seconds', () => {
    expect(formatMicroseconds(2500000)).toBe('2.50s');
  });

  it('formats exactly 1 second', () => {
    expect(formatMicroseconds(1000000)).toBe('1.00s');
  });

  it('formats exactly 1 millisecond', () => {
    expect(formatMicroseconds(1000)).toBe('1.00ms');
  });
});

// ──────────────────────────────────────────────────────────────────
// extractLoopBody
// ──────────────────────────────────────────────────────────────────

describe('extractLoopBody', () => {
  it('extracts loop body from simple sketch', () => {
    const code = `
void setup() {}
void loop() {
  digitalWrite(LED, HIGH);
}
`;
    const result = extractLoopBody(code);
    expect(result).not.toBeNull();
    expect(result?.body).toContain('digitalWrite(LED, HIGH)');
  });

  it('returns null when no loop() exists', () => {
    const code = `void setup() { Serial.begin(9600); }`;
    expect(extractLoopBody(code)).toBeNull();
  });

  it('handles nested braces in loop', () => {
    const code = `
void loop() {
  if (x) {
    if (y) {
      z = 1;
    }
  }
}
`;
    const result = extractLoopBody(code);
    expect(result).not.toBeNull();
    expect(result?.body).toContain('z = 1');
  });

  it('tracks correct start and end lines', () => {
    const code = `line1
line2
void loop() {
  x = 1;
}
`;
    const result = extractLoopBody(code);
    expect(result?.startLine).toBe(3);
    expect(result?.endLine).toBe(5);
  });

  it('handles braces in strings inside loop', () => {
    const code = `
void loop() {
  char* msg = "{ not a brace }";
  x++;
}
`;
    const result = extractLoopBody(code);
    expect(result?.body).toContain('x++');
  });
});

// ──────────────────────────────────────────────────────────────────
// profileLoop — basic detection
// ──────────────────────────────────────────────────────────────────

describe('profileLoop — basic detection', () => {
  it('returns null when no loop() found', () => {
    expect(profileLoop('void setup() {}')).toBeNull();
  });

  it('profiles a simple blink sketch', () => {
    const code = `
void setup() { pinMode(LED_BUILTIN, OUTPUT); }
void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(1000);
  digitalWrite(LED_BUILTIN, LOW);
  delay(1000);
}
`;
    const profile = profileLoop(code);
    expect(profile).not.toBeNull();
    expect(profile!.totalMicroseconds).toBeGreaterThan(0);
    expect(profile!.category).toBe('blocking');
    expect(profile!.estimatedHz).toBeLessThan(1);
  });

  it('detects digitalWrite timing', () => {
    const code = `
void loop() {
  digitalWrite(13, HIGH);
}
`;
    const profile = profileLoop(code)!;
    const dwLines = profile.lines.filter((l) =>
      l.operations.some((o) => o.name === 'digitalWrite'),
    );
    expect(dwLines).toHaveLength(1);
    expect(dwLines[0].operations[0].microseconds).toBe(5);
  });

  it('detects analogRead timing', () => {
    const code = `
void loop() {
  int val = analogRead(A0);
}
`;
    const profile = profileLoop(code)!;
    const arLines = profile.lines.filter((l) =>
      l.operations.some((o) => o.name === 'analogRead'),
    );
    expect(arLines).toHaveLength(1);
    expect(arLines[0].operations[0].microseconds).toBe(112);
    expect(arLines[0].category).toBe('moderate');
  });

  it('detects Serial.println timing', () => {
    const code = `
void loop() {
  Serial.println("hello");
}
`;
    const profile = profileLoop(code)!;
    expect(profile.lines.some((l) => l.operations.some((o) => o.name === 'Serial.println'))).toBe(true);
  });

  it('detects pulseIn as blocking', () => {
    const code = `
void loop() {
  long d = pulseIn(echoPin, HIGH);
}
`;
    const profile = profileLoop(code)!;
    expect(profile.category).toBe('blocking');
    const piLines = profile.lines.filter((l) => l.operations.some((o) => o.name === 'pulseIn'));
    expect(piLines).toHaveLength(1);
  });
});

// ──────────────────────────────────────────────────────────────────
// profileLoop — delay argument extraction
// ──────────────────────────────────────────────────────────────────

describe('profileLoop — delay argument extraction', () => {
  it('extracts actual delay value in ms → us', () => {
    const code = `
void loop() {
  delay(500);
}
`;
    const profile = profileLoop(code)!;
    const delayLine = profile.lines.find((l) => l.operations.some((o) => o.name === 'delay'));
    expect(delayLine).toBeDefined();
    expect(delayLine!.totalMicroseconds).toBe(500 * 1000);
  });

  it('extracts delayMicroseconds value', () => {
    const code = `
void loop() {
  delayMicroseconds(10);
}
`;
    const profile = profileLoop(code)!;
    const dmLine = profile.lines.find((l) =>
      l.operations.some((o) => o.name === 'delayMicroseconds'),
    );
    expect(dmLine).toBeDefined();
    expect(dmLine!.totalMicroseconds).toBe(10);
  });

  it('uses default estimate for delay with variable argument', () => {
    const code = `
void loop() {
  delay(interval);
}
`;
    const profile = profileLoop(code)!;
    const delayLine = profile.lines.find((l) => l.operations.some((o) => o.name === 'delay'));
    expect(delayLine).toBeDefined();
    // Default delay estimate is 1_000_000us (1s)
    expect(delayLine!.totalMicroseconds).toBe(1_000_000);
  });
});

// ──────────────────────────────────────────────────────────────────
// profileLoop — estimated Hz
// ──────────────────────────────────────────────────────────────────

describe('profileLoop — estimated Hz', () => {
  it('calculates correct Hz for a 1ms loop', () => {
    // A loop with only delay(1) = 1000us
    const code = `
void loop() {
  delay(1);
}
`;
    const profile = profileLoop(code)!;
    expect(profile.estimatedHz).toBeCloseTo(1000, 0);
  });

  it('calculates correct Hz for a blocking loop', () => {
    const code = `
void loop() {
  delay(1000);
}
`;
    const profile = profileLoop(code)!;
    expect(profile.estimatedHz).toBeCloseTo(1, 1);
  });

  it('returns high Hz for a fast loop', () => {
    const code = `
void loop() {
  digitalWrite(13, HIGH);
}
`;
    const profile = profileLoop(code)!;
    expect(profile.estimatedHz).toBeGreaterThan(10000);
  });
});

// ──────────────────────────────────────────────────────────────────
// profileLoop — comment/string filtering
// ──────────────────────────────────────────────────────────────────

describe('profileLoop — comment filtering', () => {
  it('ignores operations in single-line comments', () => {
    const code = `
void loop() {
  // delay(1000);
  digitalWrite(13, HIGH);
}
`;
    const profile = profileLoop(code)!;
    expect(profile.lines.some((l) => l.operations.some((o) => o.name === 'delay'))).toBe(false);
  });

  it('ignores operations in string literals', () => {
    const code = `
void loop() {
  Serial.println("delay(1000)");
}
`;
    const profile = profileLoop(code)!;
    // Should detect Serial.println but NOT delay inside the string
    expect(profile.lines.some((l) => l.operations.some((o) => o.name === 'delay'))).toBe(false);
    expect(profile.lines.some((l) => l.operations.some((o) => o.name === 'Serial.println'))).toBe(true);
  });

  it('skips blank and comment-only lines', () => {
    const code = `
void loop() {

  // just a comment
  /* block comment */
  delay(100);
}
`;
    const profile = profileLoop(code)!;
    const blankLines = profile.lines.filter((l) => l.totalMicroseconds === 0);
    expect(blankLines.length).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// profileLoop — bottlenecks
// ──────────────────────────────────────────────────────────────────

describe('profileLoop — bottlenecks', () => {
  it('identifies the slowest operation as a bottleneck', () => {
    const code = `
void loop() {
  digitalWrite(13, HIGH);
  delay(500);
  digitalWrite(13, LOW);
}
`;
    const profile = profileLoop(code)!;
    expect(profile.bottlenecks.length).toBeGreaterThan(0);
    expect(profile.bottlenecks[0].operation).toBe('delay');
    expect(profile.bottlenecks[0].percentage).toBeGreaterThan(90);
  });

  it('limits bottlenecks to 5 entries', () => {
    const code = `
void loop() {
  analogRead(A0);
  analogRead(A1);
  analogRead(A2);
  analogRead(A3);
  analogRead(A4);
  analogRead(A5);
  analogRead(A6);
}
`;
    const profile = profileLoop(code)!;
    expect(profile.bottlenecks.length).toBeLessThanOrEqual(5);
  });

  it('calculates percentage of total loop time', () => {
    const code = `
void loop() {
  delay(100);
  digitalWrite(13, HIGH);
}
`;
    const profile = profileLoop(code)!;
    const totalPct = profile.bottlenecks.reduce((sum, b) => sum + b.percentage, 0);
    // Percentages should add up to roughly 100% (may be slightly off due to rounding)
    expect(totalPct).toBeGreaterThanOrEqual(90);
    expect(totalPct).toBeLessThanOrEqual(100);
  });
});

// ──────────────────────────────────────────────────────────────────
// profileLoop — multiple operations per line
// ──────────────────────────────────────────────────────────────────

describe('profileLoop — multiple operations per line', () => {
  it('detects multiple operations on one line', () => {
    const code = `
void loop() {
  if (digitalRead(2) == HIGH) { digitalWrite(13, HIGH); }
}
`;
    const profile = profileLoop(code)!;
    const multiLine = profile.lines.find(
      (l) => l.operations.length >= 2,
    );
    expect(multiLine).toBeDefined();
  });

  it('sums microseconds from multiple operations', () => {
    const code = `
void loop() {
  if (digitalRead(2) == HIGH) { digitalWrite(13, HIGH); }
}
`;
    const profile = profileLoop(code)!;
    const multiLine = profile.lines.find((l) => l.operations.length >= 2);
    expect(multiLine).toBeDefined();
    // digitalRead(5us) + digitalWrite(5us) = 10us
    expect(multiLine!.totalMicroseconds).toBeGreaterThanOrEqual(10);
  });
});

// ──────────────────────────────────────────────────────────────────
// profileLoop — I2C / SPI detection
// ──────────────────────────────────────────────────────────────────

describe('profileLoop — I2C and SPI', () => {
  it('detects Wire.requestFrom timing', () => {
    const code = `
void loop() {
  Wire.requestFrom(0x68, 6);
}
`;
    const profile = profileLoop(code)!;
    expect(profile.lines.some((l) => l.operations.some((o) => o.name === 'Wire.requestFrom'))).toBe(true);
  });

  it('detects SPI.transfer timing', () => {
    const code = `
void loop() {
  byte val = SPI.transfer(0xFF);
}
`;
    const profile = profileLoop(code)!;
    expect(profile.lines.some((l) => l.operations.some((o) => o.name === 'SPI.transfer'))).toBe(true);
  });

  it('detects Wire.endTransmission timing', () => {
    const code = `
void loop() {
  Wire.endTransmission();
}
`;
    const profile = profileLoop(code)!;
    const wtLine = profile.lines.find((l) =>
      l.operations.some((o) => o.name === 'Wire.endTransmission'),
    );
    expect(wtLine).toBeDefined();
    expect(wtLine!.category).toBe('moderate');
  });
});

// ──────────────────────────────────────────────────────────────────
// profileLoop — real-world sketches
// ──────────────────────────────────────────────────────────────────

describe('profileLoop — real-world sketches', () => {
  it('profiles an ultrasonic sensor sketch', () => {
    const code = `
void setup() {
  Serial.begin(9600);
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
}

void loop() {
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
    const profile = profileLoop(code)!;
    expect(profile).not.toBeNull();
    expect(profile.category).toBe('blocking');
    // pulseIn (500ms default) and delay(500) are both the biggest blocking calls
    expect(['delay', 'pulseIn']).toContain(profile.bottlenecks[0].operation);
    expect(profile.estimatedHz).toBeLessThan(5);
  });

  it('profiles a fast sensor polling loop', () => {
    const code = `
void loop() {
  int val = analogRead(A0);
  if (val > 512) {
    digitalWrite(LED, HIGH);
  } else {
    digitalWrite(LED, LOW);
  }
}
`;
    const profile = profileLoop(code)!;
    expect(profile.category).toBe('moderate');
    expect(profile.estimatedHz).toBeGreaterThan(1000);
  });

  it('profiles an empty loop', () => {
    const code = `void loop() {
}`;
    const profile = profileLoop(code)!;
    expect(profile).not.toBeNull();
    // Empty body has one blank line from the newline between { and }
    expect(profile.totalMicroseconds).toBe(0);
    expect(profile.estimatedHz).toBe(Infinity);
    expect(profile.category).toBe('fast');
  });

  it('profiles a loop with only assignments', () => {
    const code = `
void loop() {
  x = 1;
  y = 2;
}
`;
    const profile = profileLoop(code)!;
    expect(profile.category).toBe('fast');
    expect(profile.estimatedHz).toBeGreaterThan(100000);
  });

  it('detects numbered serial port (Serial1)', () => {
    const code = `
void loop() {
  Serial1.println("data");
}
`;
    const profile = profileLoop(code)!;
    expect(profile.lines.some((l) => l.operations.some((o) => o.name === 'Serial.println'))).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────
// profileLoop — edge cases
// ──────────────────────────────────────────────────────────────────

describe('profileLoop — edge cases', () => {
  it('handles loop with Windows line endings', () => {
    const code = 'void loop() {\r\n  delay(100);\r\n}';
    const profile = profileLoop(code)!;
    expect(profile).not.toBeNull();
    expect(profile.lines.some((l) => l.operations.some((o) => o.name === 'delay'))).toBe(true);
  });

  it('handles deeply nested code', () => {
    const code = `
void loop() {
  if (a) {
    if (b) {
      if (c) {
        delay(10);
      }
    }
  }
}
`;
    const profile = profileLoop(code)!;
    expect(profile.totalMicroseconds).toBeGreaterThan(0);
    expect(profile.lines.some((l) => l.operations.some((o) => o.name === 'delay'))).toBe(true);
  });

  it('reports correct loopStartLine and loopEndLine', () => {
    const code = `// header
void setup() {}
void loop() {
  delay(100);
}
`;
    const profile = profileLoop(code)!;
    expect(profile.loopStartLine).toBe(3);
    expect(profile.loopEndLine).toBe(5);
  });

  it('handles loop with no closing brace (malformed)', () => {
    const code = `void loop() { delay(100);`;
    // No closing brace → extractLoopBody fails
    expect(profileLoop(code)).toBeNull();
  });
});
