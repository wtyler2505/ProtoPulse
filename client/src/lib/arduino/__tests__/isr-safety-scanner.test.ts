import { describe, it, expect } from 'vitest';
import { findIsrBodies, scanForIsrViolations, ISR_RULES } from '../isr-safety-scanner';
import type { IsrViolation } from '../isr-safety-scanner';

// ──────────────────────────────────────────────────────────────────
// findIsrBodies
// ──────────────────────────────────────────────────────────────────

describe('findIsrBodies', () => {
  it('finds ISR(VECTOR) bodies', () => {
    const code = `
ISR(TIMER1_COMPA_vect) {
  count++;
}
`;
    const bodies = findIsrBodies(code);
    expect(bodies).toHaveLength(1);
    expect(bodies[0].name).toBe('ISR(TIMER1_COMPA_vect)');
    expect(bodies[0].body).toContain('count++');
  });

  it('finds multiple ISR bodies', () => {
    const code = `
ISR(TIMER1_COMPA_vect) {
  count++;
}

ISR(INT0_vect) {
  flag = 1;
}
`;
    const bodies = findIsrBodies(code);
    expect(bodies).toHaveLength(2);
    expect(bodies[0].name).toBe('ISR(TIMER1_COMPA_vect)');
    expect(bodies[1].name).toBe('ISR(INT0_vect)');
  });

  it('finds SIGNAL(VECTOR) bodies', () => {
    const code = `
SIGNAL(SIG_OVERFLOW0) {
  overflowCount++;
}
`;
    const bodies = findIsrBodies(code);
    expect(bodies).toHaveLength(1);
    expect(bodies[0].name).toBe('SIGNAL(SIG_OVERFLOW0)');
    expect(bodies[0].body).toContain('overflowCount++');
  });

  it('finds attachInterrupt callback by name', () => {
    const code = `
void handleButtonPress() {
  buttonPressed = true;
}

void setup() {
  attachInterrupt(digitalPinToInterrupt(2), handleButtonPress, FALLING);
}
`;
    const bodies = findIsrBodies(code);
    expect(bodies).toHaveLength(1);
    expect(bodies[0].name).toBe('handleButtonPress');
    expect(bodies[0].body).toContain('buttonPressed = true');
  });

  it('finds inline lambda attachInterrupt', () => {
    const code = `
void setup() {
  attachInterrupt(digitalPinToInterrupt(2), []() {
    counter++;
  }, RISING);
}
`;
    const bodies = findIsrBodies(code);
    expect(bodies).toHaveLength(1);
    expect(bodies[0].name).toBe('attachInterrupt(lambda)');
    expect(bodies[0].body).toContain('counter++');
  });

  it('handles nested braces in ISR body', () => {
    const code = `
ISR(TIMER1_COMPA_vect) {
  if (count > 10) {
    count = 0;
  } else {
    count++;
  }
}
`;
    const bodies = findIsrBodies(code);
    expect(bodies).toHaveLength(1);
    expect(bodies[0].body).toContain('if (count > 10)');
    expect(bodies[0].body).toContain('count = 0');
  });

  it('handles ISR without _vect suffix', () => {
    const code = `
ISR(PCINT0) {
  pinChanged = true;
}
`;
    const bodies = findIsrBodies(code);
    expect(bodies).toHaveLength(1);
    expect(bodies[0].name).toBe('ISR(PCINT0)');
  });

  it('returns empty array when no ISRs found', () => {
    const code = `
void setup() {}
void loop() { delay(1000); }
`;
    expect(findIsrBodies(code)).toHaveLength(0);
  });

  it('handles braces inside strings in ISR body', () => {
    const code = `
ISR(TIMER1_COMPA_vect) {
  char msg[] = "{ not a brace }";
  count++;
}
`;
    const bodies = findIsrBodies(code);
    expect(bodies).toHaveLength(1);
    expect(bodies[0].body).toContain('count++');
  });

  it('handles comments with braces in ISR body', () => {
    const code = `
ISR(TIMER1_COMPA_vect) {
  // { this is a comment }
  count++;
}
`;
    const bodies = findIsrBodies(code);
    expect(bodies).toHaveLength(1);
    expect(bodies[0].body).toContain('count++');
  });

  it('does not duplicate attachInterrupt callbacks attached multiple times', () => {
    const code = `
void onPulse() {
  pulseCount++;
}

void setup() {
  attachInterrupt(0, onPulse, RISING);
  attachInterrupt(1, onPulse, FALLING);
}
`;
    const bodies = findIsrBodies(code);
    expect(bodies).toHaveLength(1);
    expect(bodies[0].name).toBe('onPulse');
  });

  it('tracks correct line numbers', () => {
    const code = `line1
line2
ISR(TIMER1_COMPA_vect) {
  count++;
}
`;
    const bodies = findIsrBodies(code);
    expect(bodies).toHaveLength(1);
    expect(bodies[0].startLine).toBe(3);
    expect(bodies[0].endLine).toBe(5);
  });
});

// ──────────────────────────────────────────────────────────────────
// ISR_RULES
// ──────────────────────────────────────────────────────────────────

describe('ISR_RULES', () => {
  it('contains exactly 8 rules', () => {
    expect(ISR_RULES).toHaveLength(8);
  });

  it('has unique rule IDs', () => {
    const ids = ISR_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every rule has a description', () => {
    for (const rule of ISR_RULES) {
      expect(rule.description.length).toBeGreaterThan(10);
    }
  });

  it('has the expected rule IDs', () => {
    const ids = ISR_RULES.map((r) => r.id);
    expect(ids).toContain('no-serial-in-isr');
    expect(ids).toContain('no-delay-in-isr');
    expect(ids).toContain('no-malloc-in-isr');
    expect(ids).toContain('volatile-missing');
    expect(ids).toContain('no-millis-in-isr');
    expect(ids).toContain('long-isr');
    expect(ids).toContain('no-i2c-in-isr');
    expect(ids).toContain('no-spi-in-isr');
  });
});

// ──────────────────────────────────────────────────────────────────
// scanForIsrViolations — Rule 1: no-serial-in-isr
// ──────────────────────────────────────────────────────────────────

describe('scanForIsrViolations — no-serial-in-isr', () => {
  it('detects Serial.println in ISR', () => {
    const code = `
ISR(TIMER1_COMPA_vect) {
  Serial.println("tick");
}
`;
    const violations = scanForIsrViolations(code);
    const serial = violations.filter((v) => v.rule === 'no-serial-in-isr');
    expect(serial).toHaveLength(1);
    expect(serial[0].severity).toBe('error');
  });

  it('detects Serial.print in ISR', () => {
    const code = `
ISR(TIMER1_COMPA_vect) {
  Serial.print(count);
}
`;
    const violations = scanForIsrViolations(code);
    expect(violations.some((v) => v.rule === 'no-serial-in-isr')).toBe(true);
  });

  it('detects Serial.write in ISR', () => {
    const code = `
ISR(TIMER1_COMPA_vect) {
  Serial.write(0x42);
}
`;
    const violations = scanForIsrViolations(code);
    expect(violations.some((v) => v.rule === 'no-serial-in-isr')).toBe(true);
  });

  it('detects Serial.read in ISR', () => {
    const code = `
ISR(TIMER1_COMPA_vect) {
  byte b = Serial.read();
}
`;
    const violations = scanForIsrViolations(code);
    expect(violations.some((v) => v.rule === 'no-serial-in-isr')).toBe(true);
  });

  it('does not flag Serial outside ISR', () => {
    const code = `
void loop() {
  Serial.println("hello");
}
`;
    expect(scanForIsrViolations(code)).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// scanForIsrViolations — Rule 2: no-delay-in-isr
// ──────────────────────────────────────────────────────────────────

describe('scanForIsrViolations — no-delay-in-isr', () => {
  it('detects delay() in ISR', () => {
    const code = `
ISR(INT0_vect) {
  delay(100);
}
`;
    const violations = scanForIsrViolations(code);
    const delays = violations.filter((v) => v.rule === 'no-delay-in-isr');
    expect(delays).toHaveLength(1);
    expect(delays[0].severity).toBe('error');
  });

  it('detects delayMicroseconds() in ISR', () => {
    const code = `
ISR(INT0_vect) {
  delayMicroseconds(10);
}
`;
    const violations = scanForIsrViolations(code);
    expect(violations.some((v) => v.rule === 'no-delay-in-isr')).toBe(true);
  });

  it('does not flag delay outside ISR', () => {
    const code = `
void loop() { delay(1000); }
`;
    expect(scanForIsrViolations(code)).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// scanForIsrViolations — Rule 3: no-malloc-in-isr
// ──────────────────────────────────────────────────────────────────

describe('scanForIsrViolations — no-malloc-in-isr', () => {
  it('detects malloc in ISR', () => {
    const code = `
ISR(TIMER1_COMPA_vect) {
  void* p = malloc(32);
}
`;
    const violations = scanForIsrViolations(code);
    expect(violations.some((v) => v.rule === 'no-malloc-in-isr')).toBe(true);
  });

  it('detects new in ISR', () => {
    const code = `
ISR(TIMER1_COMPA_vect) {
  int* arr = new int[10];
}
`;
    const violations = scanForIsrViolations(code);
    expect(violations.some((v) => v.rule === 'no-malloc-in-isr')).toBe(true);
  });

  it('detects calloc in ISR', () => {
    const code = `
ISR(TIMER1_COMPA_vect) {
  void* p = calloc(10, 4);
}
`;
    const violations = scanForIsrViolations(code);
    expect(violations.some((v) => v.rule === 'no-malloc-in-isr')).toBe(true);
  });

  it('detects free in ISR', () => {
    const code = `
ISR(TIMER1_COMPA_vect) {
  free(buffer);
}
`;
    const violations = scanForIsrViolations(code);
    expect(violations.some((v) => v.rule === 'no-malloc-in-isr')).toBe(true);
  });

  it('detects realloc in ISR', () => {
    const code = `
ISR(TIMER1_COMPA_vect) {
  void* p = realloc(buf, 64);
}
`;
    const violations = scanForIsrViolations(code);
    expect(violations.some((v) => v.rule === 'no-malloc-in-isr')).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────
// scanForIsrViolations — Rule 4: volatile-missing
// ──────────────────────────────────────────────────────────────────

describe('scanForIsrViolations — volatile-missing', () => {
  it('warns when non-volatile variable is modified in ISR', () => {
    const code = `
int counter = 0;

ISR(TIMER1_COMPA_vect) {
  counter++;
}
`;
    const violations = scanForIsrViolations(code);
    const vol = violations.filter((v) => v.rule === 'volatile-missing');
    expect(vol).toHaveLength(1);
    expect(vol[0].severity).toBe('warning');
    expect(vol[0].message).toContain('counter');
  });

  it('does not warn when variable is declared volatile', () => {
    const code = `
volatile int counter = 0;

ISR(TIMER1_COMPA_vect) {
  counter++;
}
`;
    const violations = scanForIsrViolations(code);
    expect(violations.filter((v) => v.rule === 'volatile-missing')).toHaveLength(0);
  });

  it('does not warn for local variables inside ISR', () => {
    const code = `
ISR(TIMER1_COMPA_vect) {
  int temp = 5;
  temp++;
}
`;
    const violations = scanForIsrViolations(code);
    expect(violations.filter((v) => v.rule === 'volatile-missing')).toHaveLength(0);
  });

  it('does not warn for loop variables', () => {
    const code = `
int data = 0;

ISR(TIMER1_COMPA_vect) {
  for (int i = 0; i < 3; i++) {
    data++;
  }
}
`;
    const violations = scanForIsrViolations(code);
    // 'i' should not trigger volatile-missing (loop var), but 'data' should
    const vol = violations.filter((v) => v.rule === 'volatile-missing');
    expect(vol).toHaveLength(1);
    expect(vol[0].message).toContain('data');
  });

  it('handles compound assignment operators', () => {
    const code = `
int total = 0;

ISR(TIMER1_COMPA_vect) {
  total += 10;
}
`;
    const violations = scanForIsrViolations(code);
    const vol = violations.filter((v) => v.rule === 'volatile-missing');
    expect(vol).toHaveLength(1);
    expect(vol[0].message).toContain('total');
  });
});

// ──────────────────────────────────────────────────────────────────
// scanForIsrViolations — Rule 5: no-millis-in-isr
// ──────────────────────────────────────────────────────────────────

describe('scanForIsrViolations — no-millis-in-isr', () => {
  it('warns on millis() in ISR', () => {
    const code = `
ISR(TIMER1_COMPA_vect) {
  unsigned long t = millis();
}
`;
    const violations = scanForIsrViolations(code);
    const mill = violations.filter((v) => v.rule === 'no-millis-in-isr');
    expect(mill).toHaveLength(1);
    expect(mill[0].severity).toBe('warning');
  });

  it('warns on micros() in ISR', () => {
    const code = `
ISR(TIMER1_COMPA_vect) {
  unsigned long t = micros();
}
`;
    const violations = scanForIsrViolations(code);
    expect(violations.some((v) => v.rule === 'no-millis-in-isr')).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────
// scanForIsrViolations — Rule 6: long-isr
// ──────────────────────────────────────────────────────────────────

describe('scanForIsrViolations — long-isr', () => {
  it('warns when ISR body exceeds 20 significant lines', () => {
    const lines = Array.from({ length: 25 }, (_, i) => `  val${i} = ${i};`);
    const code = `
ISR(TIMER1_COMPA_vect) {
${lines.join('\n')}
}
`;
    const violations = scanForIsrViolations(code);
    const longIsr = violations.filter((v) => v.rule === 'long-isr');
    expect(longIsr).toHaveLength(1);
    expect(longIsr[0].severity).toBe('warning');
    expect(longIsr[0].message).toContain('25');
  });

  it('does not warn when ISR body is 20 lines or fewer', () => {
    const lines = Array.from({ length: 20 }, (_, i) => `  val${i} = ${i};`);
    const code = `
ISR(TIMER1_COMPA_vect) {
${lines.join('\n')}
}
`;
    const violations = scanForIsrViolations(code);
    expect(violations.filter((v) => v.rule === 'long-isr')).toHaveLength(0);
  });

  it('does not count blank lines and comments', () => {
    const significantLines = Array.from({ length: 15 }, (_, i) => `  val${i} = ${i};`);
    const code = `
ISR(TIMER1_COMPA_vect) {
  // This is a comment
  /* Another comment */

${significantLines.join('\n')}

  // More comments

}
`;
    const violations = scanForIsrViolations(code);
    expect(violations.filter((v) => v.rule === 'long-isr')).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// scanForIsrViolations — Rule 7: no-i2c-in-isr
// ──────────────────────────────────────────────────────────────────

describe('scanForIsrViolations — no-i2c-in-isr', () => {
  it('detects Wire.beginTransmission in ISR', () => {
    const code = `
ISR(INT0_vect) {
  Wire.beginTransmission(0x68);
}
`;
    const violations = scanForIsrViolations(code);
    const i2c = violations.filter((v) => v.rule === 'no-i2c-in-isr');
    expect(i2c).toHaveLength(1);
    expect(i2c[0].severity).toBe('error');
  });

  it('detects Wire.requestFrom in ISR', () => {
    const code = `
ISR(INT0_vect) {
  Wire.requestFrom(0x68, 6);
}
`;
    const violations = scanForIsrViolations(code);
    expect(violations.some((v) => v.rule === 'no-i2c-in-isr')).toBe(true);
  });

  it('detects Wire.read in ISR', () => {
    const code = `
ISR(INT0_vect) {
  byte val = Wire.read();
}
`;
    const violations = scanForIsrViolations(code);
    expect(violations.some((v) => v.rule === 'no-i2c-in-isr')).toBe(true);
  });

  it('detects Wire.write in ISR', () => {
    const code = `
ISR(INT0_vect) {
  Wire.write(0x01);
}
`;
    const violations = scanForIsrViolations(code);
    expect(violations.some((v) => v.rule === 'no-i2c-in-isr')).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────
// scanForIsrViolations — Rule 8: no-spi-in-isr
// ──────────────────────────────────────────────────────────────────

describe('scanForIsrViolations — no-spi-in-isr', () => {
  it('detects SPI.transfer in ISR', () => {
    const code = `
ISR(TIMER1_COMPA_vect) {
  SPI.transfer(0xFF);
}
`;
    const violations = scanForIsrViolations(code);
    const spi = violations.filter((v) => v.rule === 'no-spi-in-isr');
    expect(spi).toHaveLength(1);
    expect(spi[0].severity).toBe('warning');
  });

  it('detects SPI.beginTransaction in ISR', () => {
    const code = `
ISR(TIMER1_COMPA_vect) {
  SPI.beginTransaction(SPISettings(1000000, MSBFIRST, SPI_MODE0));
}
`;
    const violations = scanForIsrViolations(code);
    expect(violations.some((v) => v.rule === 'no-spi-in-isr')).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────
// scanForIsrViolations — combined / edge cases
// ──────────────────────────────────────────────────────────────────

describe('scanForIsrViolations — combined & edge cases', () => {
  it('returns empty for code with no ISRs', () => {
    const code = `
void setup() { Serial.begin(9600); }
void loop() { delay(1000); Serial.println("hello"); }
`;
    expect(scanForIsrViolations(code)).toHaveLength(0);
  });

  it('detects multiple violations in one ISR', () => {
    const code = `
ISR(TIMER1_COMPA_vect) {
  Serial.println("tick");
  delay(100);
}
`;
    const violations = scanForIsrViolations(code);
    expect(violations.some((v) => v.rule === 'no-serial-in-isr')).toBe(true);
    expect(violations.some((v) => v.rule === 'no-delay-in-isr')).toBe(true);
  });

  it('detects violations in attachInterrupt callbacks', () => {
    const code = `
void onButton() {
  Serial.println("pressed");
}

void setup() {
  attachInterrupt(0, onButton, FALLING);
}
`;
    const violations = scanForIsrViolations(code);
    expect(violations.some((v) => v.rule === 'no-serial-in-isr')).toBe(true);
  });

  it('does not flag code in comments', () => {
    const code = `
ISR(TIMER1_COMPA_vect) {
  // Serial.println("debug");
  count++;
}
`;
    const violations = scanForIsrViolations(code);
    expect(violations.filter((v) => v.rule === 'no-serial-in-isr')).toHaveLength(0);
  });

  it('does not flag code in string literals', () => {
    const code = `
ISR(TIMER1_COMPA_vect) {
  const char* msg = "delay(100)";
  count++;
}
`;
    const violations = scanForIsrViolations(code);
    expect(violations.filter((v) => v.rule === 'no-delay-in-isr')).toHaveLength(0);
  });

  it('violations are sorted by line number', () => {
    const code = `
ISR(TIMER1_COMPA_vect) {
  delay(10);
  Serial.println("x");
  Wire.read();
}
`;
    const violations = scanForIsrViolations(code);
    for (let i = 1; i < violations.length; i++) {
      expect(violations[i].line).toBeGreaterThanOrEqual(violations[i - 1].line);
    }
  });

  it('every violation has required fields', () => {
    const code = `
ISR(TIMER1_COMPA_vect) {
  Serial.println("tick");
  delay(100);
  millis();
  Wire.read();
  SPI.transfer(0);
}
`;
    const violations = scanForIsrViolations(code);
    expect(violations.length).toBeGreaterThanOrEqual(5);

    for (const v of violations) {
      expect(typeof v.line).toBe('number');
      expect(typeof v.column).toBe('number');
      expect(['error', 'warning', 'info']).toContain(v.severity);
      expect(v.rule.length).toBeGreaterThan(0);
      expect(v.message.length).toBeGreaterThan(0);
      expect(v.suggestion.length).toBeGreaterThan(0);
    }
  });

  it('handles SIGNAL macro violations', () => {
    const code = `
SIGNAL(SIG_OVERFLOW0) {
  Serial.println("overflow");
}
`;
    const violations = scanForIsrViolations(code);
    expect(violations.some((v) => v.rule === 'no-serial-in-isr')).toBe(true);
  });

  it('handles real-world ISR with volatile flag pattern (clean)', () => {
    const code = `
volatile bool isrFlag = false;

ISR(INT0_vect) {
  isrFlag = true;
}

void loop() {
  if (isrFlag) {
    Serial.println("triggered");
    isrFlag = false;
  }
}
`;
    const violations = scanForIsrViolations(code);
    // Should have zero violations — proper volatile flag pattern
    expect(violations).toHaveLength(0);
  });

  it('handles ISR with inline lambda violations', () => {
    const code = `
void setup() {
  attachInterrupt(digitalPinToInterrupt(2), []() {
    delay(50);
  }, RISING);
}
`;
    const violations = scanForIsrViolations(code);
    expect(violations.some((v) => v.rule === 'no-delay-in-isr')).toBe(true);
  });

  it('includes suggestion in every violation', () => {
    const code = `
int counter = 0;

ISR(TIMER1_COMPA_vect) {
  counter++;
  Serial.println(counter);
  delay(10);
  malloc(32);
  millis();
  Wire.begin();
  SPI.transfer(0);
}
`;
    const violations = scanForIsrViolations(code);
    for (const v of violations) {
      expect(v.suggestion.length).toBeGreaterThan(5);
    }
  });

  it('correctly maps rule severity', () => {
    const ruleMap = new Map(ISR_RULES.map((r) => [r.id, r.severity]));

    const code = `
ISR(TIMER1_COMPA_vect) {
  Serial.println("x");
  delay(1);
  malloc(1);
  millis();
  Wire.read();
  SPI.transfer(0);
}
`;
    const violations = scanForIsrViolations(code);
    for (const v of violations) {
      const expectedSeverity = ruleMap.get(v.rule);
      if (expectedSeverity) {
        expect(v.severity).toBe(expectedSeverity);
      }
    }
  });

  it('scans mixed ISR and non-ISR code', () => {
    const code = `
#include <Arduino.h>
#include <Wire.h>

volatile int count = 0;

void setup() {
  Serial.begin(9600);
  Wire.begin();
}

ISR(TIMER1_COMPA_vect) {
  count++;
}

void loop() {
  Serial.println(count);
  delay(1000);
}
`;
    const violations = scanForIsrViolations(code);
    // Only count++ in ISR, which is volatile — no violations expected
    expect(violations).toHaveLength(0);
  });
});
