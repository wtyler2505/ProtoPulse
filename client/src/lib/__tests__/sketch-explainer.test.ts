import { describe, it, expect } from 'vitest';
import {
  parseSketchSections,
  explainSection,
  explainSketch,
  detectConcepts,
  CONCEPT_DATABASE,
} from '../sketch-explainer';
import type {
  SketchSection,
  SketchSectionType,
  ExplanationLevel,
  SketchExplanation,
  ConceptEntry,
} from '../sketch-explainer';

// ---------------------------------------------------------------------------
// Test Sketches
// ---------------------------------------------------------------------------

const BLINK_SKETCH = `
#include <Arduino.h>

// Blink LED on pin 13
const int LED_PIN = 13;

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  delay(1000);
  digitalWrite(LED_PIN, LOW);
  delay(1000);
}
`.trim();

const SERVO_SKETCH = `
#include <Servo.h>

Servo myServo;
int potPin = A0;

void setup() {
  myServo.attach(9);
  Serial.begin(9600);
}

void loop() {
  int val = analogRead(potPin);
  int angle = map(val, 0, 1023, 0, 180);
  myServo.write(angle);
  Serial.println(angle);
  delay(15);
}
`.trim();

const ISR_SKETCH = `
#include <avr/interrupt.h>

volatile int counter = 0;
const int BUTTON_PIN = 2;

void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), buttonISR, FALLING);
  Serial.begin(9600);
}

void loop() {
  noInterrupts();
  int copy = counter;
  interrupts();
  Serial.println(copy);
  delay(100);
}

ISR(TIMER1_COMPA_vect) {
  counter++;
}

void buttonISR() {
  counter++;
}
`.trim();

const MULTI_FUNCTION_SKETCH = `
#include <Wire.h>
#include <LiquidCrystal.h>

#define SENSOR_PIN A0
#define THRESHOLD 500

LiquidCrystal lcd(12, 11, 5, 4, 3, 2);

void setup() {
  Wire.begin();
  lcd.begin(16, 2);
  Serial.begin(115200);
}

void loop() {
  int reading = readSensor();
  displayValue(reading);
  if (reading > THRESHOLD) {
    sendAlert(reading);
  }
  delay(500);
}

int readSensor() {
  return analogRead(SENSOR_PIN);
}

void displayValue(int value) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Val: ");
  lcd.print(value);
}

void sendAlert(int value) {
  Wire.beginTransmission(0x3C);
  Wire.write(value);
  Wire.endTransmission();
}
`.trim();

const EMPTY_SKETCH = '';

const MINIMAL_SKETCH = `
void setup() {
}

void loop() {
}
`.trim();

const BLOCK_COMMENT_SKETCH = `
/*
 * Multi-line block comment
 * describing the sketch
 */

void setup() {
}
`.trim();

// ---------------------------------------------------------------------------
// CONCEPT_DATABASE
// ---------------------------------------------------------------------------

describe('CONCEPT_DATABASE', () => {
  it('contains at least 40 concepts', () => {
    const keys = Object.keys(CONCEPT_DATABASE);
    expect(keys.length).toBeGreaterThanOrEqual(40);
  });

  it('every entry has name, explanation, and example', () => {
    for (const [key, entry] of Object.entries(CONCEPT_DATABASE)) {
      expect(entry.name, `${key}.name missing`).toBeTruthy();
      expect(entry.explanation, `${key}.explanation missing`).toBeTruthy();
      expect(entry.explanation.length, `${key}.explanation too short`).toBeGreaterThan(10);
      expect(entry.example, `${key}.example missing`).toBeTruthy();
      expect(entry.example.length, `${key}.example too short`).toBeGreaterThan(0);
    }
  });

  it('contains core Arduino concepts', () => {
    const required = [
      'pinMode', 'digitalWrite', 'digitalRead', 'analogRead', 'analogWrite',
      'Serial', 'millis', 'delay', 'interrupts', 'I2C', 'SPI', 'PWM',
      'attachInterrupt', 'volatile', 'setup', 'loop', '#include', '#define',
    ];
    for (const key of required) {
      expect(CONCEPT_DATABASE[key], `Missing concept: ${key}`).toBeDefined();
    }
  });

  it('has unique names across all entries', () => {
    const names = Object.values(CONCEPT_DATABASE).map((e) => e.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('example code is syntactically plausible', () => {
    for (const [key, entry] of Object.entries(CONCEPT_DATABASE)) {
      // Ensure examples are not just descriptions
      expect(entry.example, `${key} example looks like a description, not code`).toMatch(/[;(){}=<>]|\/\//);
    }
  });
});

// ---------------------------------------------------------------------------
// detectConcepts
// ---------------------------------------------------------------------------

describe('detectConcepts', () => {
  it('detects pinMode and digitalWrite in blink code', () => {
    const concepts = detectConcepts('pinMode(13, OUTPUT);\ndigitalWrite(13, HIGH);');
    expect(concepts).toContain('pinMode');
    expect(concepts).toContain('digitalWrite');
  });

  it('detects analogRead', () => {
    const concepts = detectConcepts('int val = analogRead(A0);');
    expect(concepts).toContain('analogRead');
  });

  it('detects Serial.begin specifically instead of generic Serial', () => {
    const concepts = detectConcepts('Serial.begin(9600);');
    expect(concepts).toContain('Serial.begin');
    expect(concepts).not.toContain('Serial');
  });

  it('detects Serial.println specifically', () => {
    const concepts = detectConcepts('Serial.println("Hello");');
    expect(concepts).toContain('Serial.println');
    expect(concepts).not.toContain('Serial');
  });

  it('detects millis for non-blocking timing', () => {
    const concepts = detectConcepts('unsigned long now = millis();');
    expect(concepts).toContain('millis');
  });

  it('detects delay', () => {
    const concepts = detectConcepts('delay(1000);');
    expect(concepts).toContain('delay');
  });

  it('detects volatile keyword', () => {
    const concepts = detectConcepts('volatile int counter = 0;');
    expect(concepts).toContain('volatile');
  });

  it('detects attachInterrupt', () => {
    const concepts = detectConcepts('attachInterrupt(digitalPinToInterrupt(2), myISR, FALLING);');
    expect(concepts).toContain('attachInterrupt');
  });

  it('detects ISR macro', () => {
    const concepts = detectConcepts('ISR(TIMER1_COMPA_vect) { counter++; }');
    expect(concepts).toContain('ISR');
  });

  it('detects Wire (I2C) without duplicating I2C concept', () => {
    const concepts = detectConcepts('Wire.begin();\nWire.beginTransmission(0x3C);');
    expect(concepts).toContain('Wire');
    expect(concepts).not.toContain('I2C');
  });

  it('detects SPI', () => {
    const concepts = detectConcepts('SPI.begin();\nSPI.transfer(0x42);');
    expect(concepts).toContain('SPI');
  });

  it('detects Servo library', () => {
    const concepts = detectConcepts('Servo myServo;\nmyServo.attach(9);');
    expect(concepts).toContain('Servo');
  });

  it('detects map function', () => {
    const concepts = detectConcepts('int angle = map(val, 0, 1023, 0, 180);');
    expect(concepts).toContain('map');
  });

  it('detects #include directive', () => {
    const concepts = detectConcepts('#include <Servo.h>');
    expect(concepts).toContain('#include');
  });

  it('detects #define directive', () => {
    const concepts = detectConcepts('#define LED_PIN 13');
    expect(concepts).toContain('#define');
  });

  it('detects struct keyword', () => {
    const concepts = detectConcepts('struct SensorData { float temp; };');
    expect(concepts).toContain('struct');
  });

  it('detects enum keyword', () => {
    const concepts = detectConcepts('enum State { IDLE, RUNNING };');
    expect(concepts).toContain('enum');
  });

  it('returns sorted array', () => {
    const concepts = detectConcepts('delay(100);\npinMode(13, OUTPUT);\ndigitalWrite(13, HIGH);');
    const sorted = [...concepts].sort();
    expect(concepts).toEqual(sorted);
  });

  it('returns empty array for empty code', () => {
    expect(detectConcepts('')).toEqual([]);
  });

  it('does not produce duplicate entries', () => {
    const concepts = detectConcepts('delay(100);\ndelay(200);\ndelay(300);');
    const unique = new Set(concepts);
    expect(concepts.length).toBe(unique.size);
  });
});

// ---------------------------------------------------------------------------
// parseSketchSections
// ---------------------------------------------------------------------------

describe('parseSketchSections', () => {
  it('returns empty array for empty input', () => {
    expect(parseSketchSections('')).toEqual([]);
    expect(parseSketchSections('   \n  \n  ')).toEqual([]);
  });

  it('identifies include section in blink sketch', () => {
    const sections = parseSketchSections(BLINK_SKETCH);
    const includes = sections.filter((s) => s.type === 'include');
    expect(includes.length).toBe(1);
    expect(includes[0].code).toContain('#include <Arduino.h>');
  });

  it('identifies setup section', () => {
    const sections = parseSketchSections(BLINK_SKETCH);
    const setupSections = sections.filter((s) => s.type === 'setup');
    expect(setupSections.length).toBe(1);
    expect(setupSections[0].code).toContain('void setup()');
    expect(setupSections[0].code).toContain('pinMode');
  });

  it('identifies loop section', () => {
    const sections = parseSketchSections(BLINK_SKETCH);
    const loopSections = sections.filter((s) => s.type === 'loop');
    expect(loopSections.length).toBe(1);
    expect(loopSections[0].code).toContain('void loop()');
    expect(loopSections[0].code).toContain('digitalWrite');
  });

  it('identifies global section', () => {
    const sections = parseSketchSections(BLINK_SKETCH);
    const globals = sections.filter((s) => s.type === 'global');
    expect(globals.length).toBeGreaterThanOrEqual(1);
    const hasLedPin = globals.some((g) => g.code.includes('LED_PIN'));
    expect(hasLedPin).toBe(true);
  });

  it('identifies comment section', () => {
    const sections = parseSketchSections(BLINK_SKETCH);
    const comments = sections.filter((s) => s.type === 'comment');
    expect(comments.length).toBeGreaterThanOrEqual(1);
    expect(comments[0].code).toContain('Blink LED');
  });

  it('identifies ISR sections', () => {
    const sections = parseSketchSections(ISR_SKETCH);
    const isrs = sections.filter((s) => s.type === 'isr');
    expect(isrs.length).toBeGreaterThanOrEqual(1);
    expect(isrs[0].code).toContain('ISR(TIMER1_COMPA_vect)');
  });

  it('identifies function sections', () => {
    const sections = parseSketchSections(MULTI_FUNCTION_SKETCH);
    const funcs = sections.filter((s) => s.type === 'function');
    expect(funcs.length).toBe(3); // readSensor, displayValue, sendAlert
    const funcNames = funcs.map((f) => f.code);
    expect(funcNames.some((c) => c.includes('readSensor'))).toBe(true);
    expect(funcNames.some((c) => c.includes('displayValue'))).toBe(true);
    expect(funcNames.some((c) => c.includes('sendAlert'))).toBe(true);
  });

  it('assigns correct line numbers (1-indexed)', () => {
    const sections = parseSketchSections(MINIMAL_SKETCH);
    for (const section of sections) {
      expect(section.startLine).toBeGreaterThanOrEqual(1);
      expect(section.endLine).toBeGreaterThanOrEqual(section.startLine);
    }
  });

  it('handles block comments', () => {
    const sections = parseSketchSections(BLOCK_COMMENT_SKETCH);
    const comments = sections.filter((s) => s.type === 'comment');
    expect(comments.length).toBe(1);
    expect(comments[0].code).toContain('Multi-line block comment');
  });

  it('handles multiple consecutive includes', () => {
    const code = '#include <Wire.h>\n#include <LiquidCrystal.h>\n\nvoid setup() {\n}\n\nvoid loop() {\n}';
    const sections = parseSketchSections(code);
    const includes = sections.filter((s) => s.type === 'include');
    // Should group consecutive includes into one section
    expect(includes.length).toBe(1);
    expect(includes[0].code).toContain('Wire.h');
    expect(includes[0].code).toContain('LiquidCrystal.h');
  });

  it('does not classify setup/loop as function type', () => {
    const sections = parseSketchSections(MULTI_FUNCTION_SKETCH);
    const funcs = sections.filter((s) => s.type === 'function');
    for (const f of funcs) {
      expect(f.code).not.toMatch(/\bvoid\s+setup\s*\(/);
      expect(f.code).not.toMatch(/\bvoid\s+loop\s*\(/);
    }
  });

  it('every section has non-empty code', () => {
    const sections = parseSketchSections(MULTI_FUNCTION_SKETCH);
    for (const section of sections) {
      expect(section.code.trim().length).toBeGreaterThan(0);
    }
  });

  it('section types are all valid', () => {
    const validTypes: SketchSectionType[] = ['include', 'global', 'setup', 'loop', 'function', 'isr', 'comment'];
    const sections = parseSketchSections(ISR_SKETCH);
    for (const section of sections) {
      expect(validTypes).toContain(section.type);
    }
  });

  it('handles sketch with only setup and loop', () => {
    const sections = parseSketchSections(MINIMAL_SKETCH);
    const types = sections.map((s) => s.type);
    expect(types).toContain('setup');
    expect(types).toContain('loop');
  });
});

// ---------------------------------------------------------------------------
// explainSection
// ---------------------------------------------------------------------------

describe('explainSection', () => {
  const levels: ExplanationLevel[] = ['beginner', 'intermediate', 'advanced'];

  it('returns a non-empty string for every section type and level', () => {
    const sectionTypes: SketchSectionType[] = ['include', 'global', 'setup', 'loop', 'function', 'isr', 'comment'];
    for (const type of sectionTypes) {
      const section: SketchSection = { type, startLine: 1, endLine: 1, code: 'void test() {}' };
      for (const level of levels) {
        const explanation = explainSection(section, level);
        expect(explanation.length, `Empty explanation for ${type}/${level}`).toBeGreaterThan(0);
      }
    }
  });

  it('beginner explanations are more conversational', () => {
    const section: SketchSection = {
      type: 'setup',
      startLine: 1,
      endLine: 3,
      code: 'void setup() {\n  pinMode(13, OUTPUT);\n}',
    };
    const beginner = explainSection(section, 'beginner');
    expect(beginner).toMatch(/once|runs once|turns on|reset|get ready/i);
  });

  it('advanced explanations mention technical details', () => {
    const section: SketchSection = {
      type: 'setup',
      startLine: 1,
      endLine: 3,
      code: 'void setup() {\n  pinMode(13, OUTPUT);\n}',
    };
    const advanced = explainSection(section, 'advanced');
    expect(advanced).toMatch(/runtime|Timer0|init\(\)|hardware/i);
  });

  it('include explanation mentions library names', () => {
    const section: SketchSection = {
      type: 'include',
      startLine: 1,
      endLine: 1,
      code: '#include <Servo.h>',
    };
    const explanation = explainSection(section, 'beginner');
    expect(explanation).toContain('Servo.h');
  });

  it('loop explanation warns about delay() at beginner level', () => {
    const section: SketchSection = {
      type: 'loop',
      startLine: 1,
      endLine: 5,
      code: 'void loop() {\n  digitalWrite(13, HIGH);\n  delay(1000);\n  digitalWrite(13, LOW);\n  delay(1000);\n}',
    };
    const beginner = explainSection(section, 'beginner');
    expect(beginner).toMatch(/delay|pause/i);
  });

  it('function explanation includes the function name', () => {
    const section: SketchSection = {
      type: 'function',
      startLine: 1,
      endLine: 3,
      code: 'int readSensor() {\n  return analogRead(A0);\n}',
    };
    const explanation = explainSection(section, 'intermediate');
    expect(explanation).toContain('readSensor');
  });

  it('ISR explanation warns about restrictions', () => {
    const section: SketchSection = {
      type: 'isr',
      startLine: 1,
      endLine: 3,
      code: 'ISR(TIMER1_COMPA_vect) {\n  counter++;\n}',
    };
    const intermediate = explainSection(section, 'intermediate');
    expect(intermediate).toMatch(/short|fast|no delay|volatile/i);
  });

  it('comment explanation mentions human readers', () => {
    const section: SketchSection = {
      type: 'comment',
      startLine: 1,
      endLine: 1,
      code: '// This is a comment',
    };
    const explanation = explainSection(section, 'beginner');
    expect(explanation).toMatch(/human|reader|ignored|compiler/i);
  });

  it('global explanation mentions volatile when present', () => {
    const section: SketchSection = {
      type: 'global',
      startLine: 1,
      endLine: 1,
      code: 'volatile int counter = 0;',
    };
    const intermediate = explainSection(section, 'intermediate');
    expect(intermediate).toMatch(/volatile|interrupt/i);
  });
});

// ---------------------------------------------------------------------------
// explainSketch (full integration)
// ---------------------------------------------------------------------------

describe('explainSketch', () => {
  it('returns a valid SketchExplanation for the blink sketch', () => {
    const result = explainSketch(BLINK_SKETCH, 'beginner');
    expect(result.sections.length).toBeGreaterThan(0);
    expect(result.overallSummary.length).toBeGreaterThan(0);
    expect(result.difficulty).toBeTruthy();
    expect(result.conceptsIntroduced.length).toBeGreaterThan(0);
  });

  it('difficulty is beginner for a simple blink sketch', () => {
    const result = explainSketch(BLINK_SKETCH, 'beginner');
    expect(result.difficulty).toBe('beginner');
  });

  it('difficulty is at least intermediate for servo sketch', () => {
    const result = explainSketch(SERVO_SKETCH, 'beginner');
    expect(['intermediate', 'advanced']).toContain(result.difficulty);
  });

  it('difficulty is advanced for ISR sketch', () => {
    const result = explainSketch(ISR_SKETCH, 'beginner');
    expect(result.difficulty).toBe('advanced');
  });

  it('conceptsIntroduced are sorted alphabetically', () => {
    const result = explainSketch(MULTI_FUNCTION_SKETCH, 'beginner');
    const sorted = [...result.conceptsIntroduced].sort();
    expect(result.conceptsIntroduced).toEqual(sorted);
  });

  it('conceptsIntroduced has no duplicates', () => {
    const result = explainSketch(MULTI_FUNCTION_SKETCH, 'beginner');
    const unique = new Set(result.conceptsIntroduced);
    expect(result.conceptsIntroduced.length).toBe(unique.size);
  });

  it('each section explanation has conceptsUsed array', () => {
    const result = explainSketch(BLINK_SKETCH, 'intermediate');
    for (const se of result.sections) {
      expect(Array.isArray(se.conceptsUsed)).toBe(true);
    }
  });

  it('each section explanation has a non-empty explanation string', () => {
    const result = explainSketch(MULTI_FUNCTION_SKETCH, 'advanced');
    for (const se of result.sections) {
      expect(se.explanation.length).toBeGreaterThan(0);
    }
  });

  it('overallSummary mentions section count', () => {
    const result = explainSketch(BLINK_SKETCH, 'beginner');
    // Summary should reference section count
    expect(result.overallSummary).toMatch(/\d+\s+section/i);
  });

  it('overallSummary at intermediate level suggests millis if delay used without millis', () => {
    const result = explainSketch(BLINK_SKETCH, 'intermediate');
    expect(result.overallSummary).toMatch(/millis/i);
  });

  it('handles empty sketch gracefully', () => {
    const result = explainSketch(EMPTY_SKETCH, 'beginner');
    expect(result.sections).toEqual([]);
    expect(result.conceptsIntroduced).toEqual([]);
    expect(result.overallSummary).toBeTruthy();
  });

  it('handles minimal sketch (empty setup and loop)', () => {
    const result = explainSketch(MINIMAL_SKETCH, 'beginner');
    expect(result.sections.length).toBeGreaterThanOrEqual(2);
    const types = result.sections.map((s) => s.section.type);
    expect(types).toContain('setup');
    expect(types).toContain('loop');
  });

  it('produces different explanations for different levels', () => {
    const beginner = explainSketch(MULTI_FUNCTION_SKETCH, 'beginner');
    const advanced = explainSketch(MULTI_FUNCTION_SKETCH, 'advanced');
    // At least one section should have different explanation text
    const beginnerTexts = beginner.sections.map((s) => s.explanation);
    const advancedTexts = advanced.sections.map((s) => s.explanation);
    expect(beginnerTexts).not.toEqual(advancedTexts);
  });

  it('detects Wire, LiquidCrystal, and analogRead in multi-function sketch', () => {
    const result = explainSketch(MULTI_FUNCTION_SKETCH, 'beginner');
    expect(result.conceptsIntroduced).toContain('Wire');
    expect(result.conceptsIntroduced).toContain('LiquidCrystal');
    expect(result.conceptsIntroduced).toContain('analogRead');
  });

  it('detects ISR and volatile in ISR sketch', () => {
    const result = explainSketch(ISR_SKETCH, 'beginner');
    expect(result.conceptsIntroduced).toContain('ISR');
    expect(result.conceptsIntroduced).toContain('volatile');
    expect(result.conceptsIntroduced).toContain('attachInterrupt');
  });
});

// ---------------------------------------------------------------------------
// Type exports (compile-time checks)
// ---------------------------------------------------------------------------

describe('Type exports', () => {
  it('SketchSection type has required fields', () => {
    const section: SketchSection = {
      type: 'setup',
      startLine: 1,
      endLine: 5,
      code: 'void setup() {}',
    };
    expect(section.type).toBe('setup');
    expect(section.startLine).toBe(1);
    expect(section.endLine).toBe(5);
    expect(section.code).toBeTruthy();
  });

  it('ExplanationLevel accepts all valid values', () => {
    const levels: ExplanationLevel[] = ['beginner', 'intermediate', 'advanced'];
    expect(levels).toHaveLength(3);
  });

  it('SketchExplanation has all required fields', () => {
    const explanation: SketchExplanation = {
      sections: [],
      overallSummary: 'test',
      difficulty: 'beginner',
      conceptsIntroduced: [],
    };
    expect(explanation.sections).toEqual([]);
    expect(explanation.overallSummary).toBe('test');
    expect(explanation.difficulty).toBe('beginner');
    expect(explanation.conceptsIntroduced).toEqual([]);
  });

  it('ConceptEntry has name, explanation, and example', () => {
    const entry: ConceptEntry = {
      name: 'test',
      explanation: 'test explanation',
      example: 'test();',
    };
    expect(entry.name).toBe('test');
    expect(entry.explanation).toBeTruthy();
    expect(entry.example).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('Edge cases', () => {
  it('handles braces inside string literals without breaking section parsing', () => {
    const code = 'void setup() {\n  Serial.println("{hello}");\n}\n\nvoid loop() {\n}';
    const sections = parseSketchSections(code);
    const setup = sections.find((s) => s.type === 'setup');
    expect(setup).toBeDefined();
    expect(setup!.code).toContain('Serial.println("{hello}")');
  });

  it('handles braces inside comments without breaking section parsing', () => {
    const code = 'void setup() {\n  // { not a real brace }\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n}';
    const sections = parseSketchSections(code);
    const setup = sections.find((s) => s.type === 'setup');
    expect(setup).toBeDefined();
    expect(setup!.code).toContain('not a real brace');
  });

  it('handles nested braces in functions', () => {
    const code = 'void doStuff() {\n  if (true) {\n    for (int i=0; i<10; i++) {\n      Serial.println(i);\n    }\n  }\n}\n\nvoid setup() {\n}\n\nvoid loop() {\n}';
    const sections = parseSketchSections(code);
    const funcs = sections.filter((s) => s.type === 'function');
    expect(funcs.length).toBe(1);
    expect(funcs[0].code).toContain('doStuff');
    expect(funcs[0].code).toContain('Serial.println(i)');
  });

  it('handles sketch with no setup or loop', () => {
    const code = '#define FOO 42\nint x = FOO;';
    const sections = parseSketchSections(code);
    expect(sections.length).toBeGreaterThan(0);
    const types = sections.map((s) => s.type);
    expect(types).not.toContain('setup');
    expect(types).not.toContain('loop');
  });

  it('handles IRAM_ATTR ISR pattern (ESP32)', () => {
    const code = 'void IRAM_ATTR handleInterrupt() {\n  counter++;\n}\n\nvoid setup() {\n}\n\nvoid loop() {\n}';
    const sections = parseSketchSections(code);
    const isrs = sections.filter((s) => s.type === 'isr');
    expect(isrs.length).toBe(1);
    expect(isrs[0].code).toContain('IRAM_ATTR');
  });
});
