// ---------------------------------------------------------------------------
// Sketch Explainer
// ---------------------------------------------------------------------------
// Pure TypeScript Arduino sketch parser and explainer. Breaks Arduino .ino
// sketches into structural sections (includes, globals, setup, loop,
// functions, ISRs, comments) and generates educational explanations at
// configurable difficulty levels.
//
// Usage:
//   const sections = parseSketchSections(code);
//   const explanation = explainSketch(code, 'beginner');
//   const concept = CONCEPT_DATABASE['pinMode'];
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Structural section types found in an Arduino sketch. */
export type SketchSectionType =
  | 'include'
  | 'global'
  | 'setup'
  | 'loop'
  | 'function'
  | 'isr'
  | 'comment';

/** A contiguous section of sketch code. */
export interface SketchSection {
  type: SketchSectionType;
  startLine: number;
  endLine: number;
  code: string;
}

/** Difficulty level for explanations. */
export type ExplanationLevel = 'beginner' | 'intermediate' | 'advanced';

/** Single section with its explanation. */
export interface SectionExplanation {
  section: SketchSection;
  explanation: string;
  conceptsUsed: string[];
}

/** Full sketch explanation. */
export interface SketchExplanation {
  sections: SectionExplanation[];
  overallSummary: string;
  difficulty: ExplanationLevel;
  conceptsIntroduced: string[];
}

/** A concept entry in the knowledge database. */
export interface ConceptEntry {
  name: string;
  explanation: string;
  example: string;
}

// ---------------------------------------------------------------------------
// Concept Database (40+ Arduino/embedded concepts)
// ---------------------------------------------------------------------------

export const CONCEPT_DATABASE: Record<string, ConceptEntry> = {
  pinMode: {
    name: 'pinMode',
    explanation: 'Configures a digital pin as INPUT, OUTPUT, or INPUT_PULLUP. Must be called in setup() before using the pin.',
    example: 'pinMode(13, OUTPUT);',
  },
  digitalWrite: {
    name: 'digitalWrite',
    explanation: 'Sets a digital pin to HIGH (5V/3.3V) or LOW (0V). The pin must be configured as OUTPUT first.',
    example: 'digitalWrite(13, HIGH);',
  },
  digitalRead: {
    name: 'digitalRead',
    explanation: 'Reads the state of a digital pin, returning HIGH or LOW. Useful for reading buttons, switches, and digital sensors.',
    example: 'int state = digitalRead(2);',
  },
  analogRead: {
    name: 'analogRead',
    explanation: 'Reads an analog voltage on an analog pin (A0-A5) and returns a value from 0 to 1023 (10-bit ADC resolution).',
    example: 'int value = analogRead(A0);',
  },
  analogWrite: {
    name: 'analogWrite',
    explanation: 'Outputs a PWM signal on a PWM-capable pin. Value ranges from 0 (always off) to 255 (always on).',
    example: 'analogWrite(9, 128); // 50% duty cycle',
  },
  Serial: {
    name: 'Serial',
    explanation: 'Hardware serial communication interface for sending/receiving data over USB or TX/RX pins. Essential for debugging.',
    example: 'Serial.begin(9600); Serial.println("Hello");',
  },
  'Serial.begin': {
    name: 'Serial.begin',
    explanation: 'Initializes serial communication at the specified baud rate. Common rates: 9600, 115200.',
    example: 'Serial.begin(9600);',
  },
  'Serial.print': {
    name: 'Serial.print',
    explanation: 'Sends data to the serial port as human-readable text. Does not add a newline at the end.',
    example: 'Serial.print("Value: "); Serial.print(42);',
  },
  'Serial.println': {
    name: 'Serial.println',
    explanation: 'Like Serial.print but appends a newline character at the end. Preferred for debugging output.',
    example: 'Serial.println("Hello World");',
  },
  'Serial.available': {
    name: 'Serial.available',
    explanation: 'Returns the number of bytes available for reading from the serial buffer. Used to check before reading.',
    example: 'if (Serial.available() > 0) { char c = Serial.read(); }',
  },
  'Serial.read': {
    name: 'Serial.read',
    explanation: 'Reads the next byte from the serial receive buffer. Returns -1 if no data is available.',
    example: 'char c = Serial.read();',
  },
  millis: {
    name: 'millis',
    explanation: 'Returns the number of milliseconds since the Arduino started running. Overflows after ~49 days. Used for non-blocking timing instead of delay().',
    example: 'unsigned long now = millis();',
  },
  micros: {
    name: 'micros',
    explanation: 'Returns microseconds since program start. Higher resolution than millis() but overflows sooner (~70 minutes).',
    example: 'unsigned long us = micros();',
  },
  delay: {
    name: 'delay',
    explanation: 'Pauses the program for the specified number of milliseconds. Blocks all code execution — avoid in time-sensitive applications.',
    example: 'delay(1000); // wait 1 second',
  },
  delayMicroseconds: {
    name: 'delayMicroseconds',
    explanation: 'Pauses execution for the specified number of microseconds. More precise than delay() for short pauses.',
    example: 'delayMicroseconds(100); // wait 100us',
  },
  interrupts: {
    name: 'interrupts',
    explanation: 'Hardware interrupts allow the processor to immediately respond to external events. attachInterrupt() connects a pin change to a handler function (ISR).',
    example: 'attachInterrupt(digitalPinToInterrupt(2), myISR, RISING);',
  },
  attachInterrupt: {
    name: 'attachInterrupt',
    explanation: 'Attaches a function (ISR) to an external interrupt pin. Trigger modes: LOW, CHANGE, RISING, FALLING.',
    example: 'attachInterrupt(digitalPinToInterrupt(2), onPress, FALLING);',
  },
  detachInterrupt: {
    name: 'detachInterrupt',
    explanation: 'Disables the interrupt on the specified pin, removing the ISR handler.',
    example: 'detachInterrupt(digitalPinToInterrupt(2));',
  },
  volatile: {
    name: 'volatile',
    explanation: 'Keyword that tells the compiler a variable may change unexpectedly (e.g., in an ISR). Prevents optimization that could skip re-reading its value.',
    example: 'volatile bool flag = false;',
  },
  I2C: {
    name: 'I2C',
    explanation: 'Two-wire communication protocol (SDA/SCL) for connecting multiple devices on a shared bus. Each device has a unique 7-bit address. Uses the Wire library.',
    example: 'Wire.begin(); Wire.beginTransmission(0x3C);',
  },
  Wire: {
    name: 'Wire',
    explanation: 'Arduino library for I2C communication. Wire.begin() initializes as controller; Wire.beginTransmission(addr) starts communication with a device.',
    example: 'Wire.begin(); Wire.requestFrom(0x68, 6);',
  },
  SPI: {
    name: 'SPI',
    explanation: 'Fast serial communication protocol using 4 wires: MOSI, MISO, SCK, and SS (chip select). Faster than I2C, but requires more pins.',
    example: 'SPI.begin(); SPI.transfer(0x42);',
  },
  PWM: {
    name: 'PWM',
    explanation: 'Pulse Width Modulation — a technique to simulate analog output using rapid digital on/off switching. The duty cycle (0-255) controls average voltage.',
    example: 'analogWrite(9, 128); // 50% duty cycle',
  },
  tone: {
    name: 'tone',
    explanation: 'Generates a square wave on a pin at the specified frequency. Used for buzzers and simple audio output.',
    example: 'tone(8, 440); // A4 note on pin 8',
  },
  noTone: {
    name: 'noTone',
    explanation: 'Stops the tone being generated on the specified pin.',
    example: 'noTone(8);',
  },
  map: {
    name: 'map',
    explanation: 'Re-maps a value from one range to another. Commonly used to scale analogRead (0-1023) to a usable range.',
    example: 'int angle = map(analogRead(A0), 0, 1023, 0, 180);',
  },
  constrain: {
    name: 'constrain',
    explanation: 'Clamps a value to a range [min, max]. Prevents values from exceeding expected bounds.',
    example: 'int safe = constrain(reading, 0, 255);',
  },
  Servo: {
    name: 'Servo',
    explanation: 'Library for controlling servo motors. attach() connects to a pin, write() sets the angle (0-180 degrees).',
    example: 'Servo myServo; myServo.attach(9); myServo.write(90);',
  },
  EEPROM: {
    name: 'EEPROM',
    explanation: 'Non-volatile memory that persists across power cycles. Limited to ~100,000 write cycles per address. Good for storing settings.',
    example: 'EEPROM.write(0, 42); int val = EEPROM.read(0);',
  },
  'String': {
    name: 'String',
    explanation: 'Arduino String class for dynamic text manipulation. Convenient but uses heap memory — prefer char arrays in memory-constrained situations.',
    example: 'String msg = "Temp: " + String(25.5) + "C";',
  },
  setup: {
    name: 'setup',
    explanation: 'Called once when the Arduino powers on or resets. Use it to initialize pins, serial communication, and libraries.',
    example: 'void setup() { pinMode(13, OUTPUT); }',
  },
  loop: {
    name: 'loop',
    explanation: 'Called repeatedly after setup(). Contains the main program logic that runs continuously. Think of it as an infinite while loop.',
    example: 'void loop() { digitalWrite(13, HIGH); delay(1000); }',
  },
  '#include': {
    name: '#include',
    explanation: 'Preprocessor directive that imports a library header file. Angle brackets (<>) for system libraries, quotes ("") for local files.',
    example: '#include <Servo.h>',
  },
  '#define': {
    name: '#define',
    explanation: 'Preprocessor macro that creates a text substitution. No memory used — the compiler replaces all occurrences before compilation.',
    example: '#define LED_PIN 13',
  },
  const: {
    name: 'const',
    explanation: 'Declares a variable whose value cannot change after initialization. Preferred over #define for typed constants.',
    example: 'const int LED_PIN = 13;',
  },
  static: {
    name: 'static',
    explanation: 'Inside a function, a static variable retains its value between function calls. Useful for counters and state tracking.',
    example: 'static unsigned long lastTime = 0;',
  },
  struct: {
    name: 'struct',
    explanation: 'Groups related variables into a single composite type. Useful for organizing sensor data, configuration, or state.',
    example: 'struct SensorData { float temp; float humidity; };',
  },
  enum: {
    name: 'enum',
    explanation: 'Defines a set of named integer constants. Great for state machines and improving code readability.',
    example: 'enum State { IDLE, RUNNING, ERROR };',
  },
  'for': {
    name: 'for loop',
    explanation: 'Repeats a block of code a specific number of times. The three parts are: initialization, condition, and increment.',
    example: 'for (int i = 0; i < 10; i++) { Serial.println(i); }',
  },
  'while': {
    name: 'while loop',
    explanation: 'Repeats a block of code as long as a condition is true. Be careful of infinite loops without an exit condition.',
    example: 'while (digitalRead(2) == HIGH) { /* wait */ }',
  },
  'if': {
    name: 'if statement',
    explanation: 'Conditional execution — runs a block of code only when the condition evaluates to true.',
    example: 'if (temperature > 30) { turnOnFan(); }',
  },
  'switch': {
    name: 'switch statement',
    explanation: 'Multi-way branch based on a variable value. Cleaner than multiple if-else chains. Always include break statements.',
    example: 'switch(state) { case IDLE: idle(); break; }',
  },
  array: {
    name: 'array',
    explanation: 'A fixed-size collection of elements of the same type. Index starts at 0. Size must be known at compile time.',
    example: 'int pins[] = {2, 3, 4, 5};',
  },
  pointer: {
    name: 'pointer',
    explanation: 'A variable that stores the memory address of another variable. Used for efficient data passing and hardware register access.',
    example: 'int *ptr = &myVariable;',
  },
  bitwise: {
    name: 'bitwise operations',
    explanation: 'Operations on individual bits: & (AND), | (OR), ^ (XOR), ~ (NOT), << (left shift), >> (right shift). Essential for register manipulation.',
    example: 'PORTB |= (1 << 5); // set bit 5 of PORTB',
  },
  Watchdog: {
    name: 'Watchdog Timer',
    explanation: 'Hardware timer that resets the MCU if not periodically cleared ("fed"). Prevents the system from hanging indefinitely on errors.',
    example: 'wdt_enable(WDTO_2S); wdt_reset();',
  },
  ISR: {
    name: 'ISR (Interrupt Service Routine)',
    explanation: 'A special function called automatically in response to a hardware interrupt. Must be short — no delay(), Serial, or blocking operations inside.',
    example: 'ISR(TIMER1_COMPA_vect) { counter++; }',
  },
  noInterrupts: {
    name: 'noInterrupts / cli()',
    explanation: 'Globally disables interrupts. Used to protect critical sections of code from being interrupted. Always re-enable with interrupts().',
    example: 'noInterrupts(); criticalCode(); interrupts();',
  },
  LiquidCrystal: {
    name: 'LiquidCrystal',
    explanation: 'Library for driving character LCD displays (16x2, 20x4). Supports printing text, positioning cursor, and custom characters.',
    example: 'LiquidCrystal lcd(12, 11, 5, 4, 3, 2); lcd.print("Hello");',
  },
  shiftOut: {
    name: 'shiftOut',
    explanation: 'Shifts out a byte of data one bit at a time on a data pin with a clock pin. Used to control shift registers (74HC595).',
    example: 'shiftOut(dataPin, clockPin, MSBFIRST, value);',
  },
  pulseIn: {
    name: 'pulseIn',
    explanation: 'Reads a pulse (HIGH or LOW) on a pin. Returns pulse duration in microseconds. Used for ultrasonic sensors and IR receivers.',
    example: 'long duration = pulseIn(echoPin, HIGH);',
  },
};

// ---------------------------------------------------------------------------
// Concept Detection Patterns
// ---------------------------------------------------------------------------

/**
 * Map of concept keys to regex patterns that detect their usage in code.
 * Order matters: more specific patterns should come before general ones.
 */
const CONCEPT_PATTERNS: Array<{ key: string; pattern: RegExp }> = [
  // Specific Serial methods first
  { key: 'Serial.begin', pattern: /Serial\d*\.begin\s*\(/ },
  { key: 'Serial.println', pattern: /Serial\d*\.println\s*\(/ },
  { key: 'Serial.print', pattern: /Serial\d*\.print\s*\(/ },
  { key: 'Serial.available', pattern: /Serial\d*\.available\s*\(/ },
  { key: 'Serial.read', pattern: /Serial\d*\.read\s*\(/ },
  // General Serial (only if none of the above matched)
  { key: 'Serial', pattern: /\bSerial\d*\b/ },
  // Pin I/O
  { key: 'pinMode', pattern: /\bpinMode\s*\(/ },
  { key: 'digitalWrite', pattern: /\bdigitalWrite\s*\(/ },
  { key: 'digitalRead', pattern: /\bdigitalRead\s*\(/ },
  { key: 'analogRead', pattern: /\banalogRead\s*\(/ },
  { key: 'analogWrite', pattern: /\banalogWrite\s*\(/ },
  // Timing
  { key: 'millis', pattern: /\bmillis\s*\(/ },
  { key: 'micros', pattern: /\bmicros\s*\(/ },
  { key: 'delay', pattern: /\bdelay\s*\(/ },
  { key: 'delayMicroseconds', pattern: /\bdelayMicroseconds\s*\(/ },
  // Interrupts
  { key: 'attachInterrupt', pattern: /\battachInterrupt\s*\(/ },
  { key: 'detachInterrupt', pattern: /\bdetachInterrupt\s*\(/ },
  { key: 'noInterrupts', pattern: /\bnoInterrupts\s*\(|cli\s*\(\s*\)/ },
  { key: 'ISR', pattern: /\bISR\s*\(/ },
  { key: 'volatile', pattern: /\bvolatile\b/ },
  // Communication
  { key: 'Wire', pattern: /\bWire\b/ },
  { key: 'I2C', pattern: /\bWire\b/ },
  { key: 'SPI', pattern: /\bSPI\b/ },
  // Libraries / peripherals
  { key: 'Servo', pattern: /\bServo\b/ },
  { key: 'EEPROM', pattern: /\bEEPROM\b/ },
  { key: 'LiquidCrystal', pattern: /\bLiquidCrystal\b/ },
  { key: 'Watchdog', pattern: /\bwdt_enable\b|\bwdt_reset\b|\bWatchdog\b/ },
  // Audio
  { key: 'tone', pattern: /\btone\s*\(/ },
  { key: 'noTone', pattern: /\bnoTone\s*\(/ },
  // Utility
  { key: 'map', pattern: /\bmap\s*\(/ },
  { key: 'constrain', pattern: /\bconstrain\s*\(/ },
  { key: 'shiftOut', pattern: /\bshiftOut\s*\(/ },
  { key: 'pulseIn', pattern: /\bpulseIn\s*\(/ },
  // Preprocessor
  { key: '#include', pattern: /^\s*#\s*include\b/m },
  { key: '#define', pattern: /^\s*#\s*define\b/m },
  // Language constructs
  { key: 'const', pattern: /\bconst\b/ },
  { key: 'static', pattern: /\bstatic\b/ },
  { key: 'struct', pattern: /\bstruct\b/ },
  { key: 'enum', pattern: /\benum\b/ },
  { key: 'for', pattern: /\bfor\s*\(/ },
  { key: 'while', pattern: /\bwhile\s*\(/ },
  { key: 'if', pattern: /\bif\s*\(/ },
  { key: 'switch', pattern: /\bswitch\s*\(/ },
  { key: 'String', pattern: /\bString\s*[\s(]/ },
  { key: 'bitwise', pattern: /[|&^~]\s*\(?\s*1\s*<<|PORTB|PORTD|DDRB|DDRD/ },
  { key: 'pointer', pattern: /\*\s*\w+\s*=\s*&|\bint\s*\*|\bchar\s*\*|\bvoid\s*\*|\bfloat\s*\*/ },
  { key: 'array', pattern: /\w+\s*\[\s*\d*\s*\]\s*[=;{]/ },
  // setup/loop (for concept tracking, not section detection)
  { key: 'setup', pattern: /\bvoid\s+setup\s*\(/ },
  { key: 'loop', pattern: /\bvoid\s+loop\s*\(/ },
];

// ---------------------------------------------------------------------------
// Section Parsing
// ---------------------------------------------------------------------------

/** Known ISR macro patterns. */
const ISR_PATTERNS = [
  /^ISR\s*\(/,
  /^void\s+\w+_ISR\s*\(/,
  /^void\s+\w+_isr\s*\(/,
  /^void\s+IRAM_ATTR\s+\w+\s*\(/,
  /^void\s+__attribute__\s*\(\s*\(\s*interrupt\s*\)\s*\)\s+\w+\s*\(/,
];

/** Check whether a line introduces an ISR. */
function isIsrLine(line: string): boolean {
  const trimmed = line.trim();
  return ISR_PATTERNS.some((p) => p.test(trimmed));
}

/** Check whether a line is a function definition (not setup/loop). */
function isFunctionDefinition(line: string): boolean {
  const trimmed = line.trim();
  // Must look like: <returnType> <name>(<...>) {?
  // Exclude setup, loop, ISR, preprocessor, and common false positives.
  if (/^\s*#/.test(trimmed)) {
    return false;
  }
  if (/^(if|else|for|while|switch|return|case|do)\b/.test(trimmed)) {
    return false;
  }
  if (isIsrLine(trimmed)) {
    return false;
  }
  // Match: <type> <name>(...) potentially with {
  const funcPattern = /^[\w*&:<>]+\s+[\w:<>]+\s*\([^)]*\)\s*(\{?\s*)$/;
  const multiLineFuncPattern = /^[\w*&:<>]+\s+[\w:<>]+\s*\([^)]*$/;
  if (funcPattern.test(trimmed) || multiLineFuncPattern.test(trimmed)) {
    // Exclude setup() and loop()
    if (/\bsetup\s*\(/.test(trimmed) || /\bloop\s*\(/.test(trimmed)) {
      return false;
    }
    return true;
  }
  return false;
}

/**
 * Find the matching closing brace for an opening brace, respecting nesting
 * and ignoring braces inside strings and comments.
 */
function findClosingBrace(lines: string[], startIdx: number): number {
  let depth = 0;
  let inString = false;
  let inChar = false;
  let inLineComment = false;
  let inBlockComment = false;
  let stringChar = '';

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    inLineComment = false; // reset per line
    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      const next = j + 1 < line.length ? line[j + 1] : '';

      if (inBlockComment) {
        if (c === '*' && next === '/') {
          inBlockComment = false;
          j++; // skip /
        }
        continue;
      }
      if (inLineComment) {
        continue;
      }
      if (inString) {
        if (c === '\\') {
          j++; // skip escaped char
          continue;
        }
        if (c === stringChar) {
          inString = false;
        }
        continue;
      }
      if (inChar) {
        if (c === '\\') {
          j++;
          continue;
        }
        if (c === "'") {
          inChar = false;
        }
        continue;
      }

      // Not inside any special context
      if (c === '/' && next === '/') {
        inLineComment = true;
        j++;
        continue;
      }
      if (c === '/' && next === '*') {
        inBlockComment = true;
        j++;
        continue;
      }
      if (c === '"') {
        inString = true;
        stringChar = '"';
        continue;
      }
      if (c === "'") {
        inChar = true;
        continue;
      }
      if (c === '{') {
        depth++;
      } else if (c === '}') {
        depth--;
        if (depth === 0) {
          return i;
        }
      }
    }
  }
  // If we never found the closing brace, return the last line
  return lines.length - 1;
}

/**
 * Parse an Arduino sketch into structural sections.
 *
 * Sections are identified top-down:
 * 1. `#include` directives → 'include'
 * 2. Block comments at file level → 'comment'
 * 3. `void setup()` → 'setup'
 * 4. `void loop()` → 'loop'
 * 5. ISR definitions → 'isr'
 * 6. Other function definitions → 'function'
 * 7. Everything else at file scope → 'global'
 */
export function parseSketchSections(code: string): SketchSection[] {
  if (!code.trim()) {
    return [];
  }

  const lines = code.split('\n');
  const sections: SketchSection[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip blank lines between sections
    if (trimmed === '') {
      i++;
      continue;
    }

    // --- #include directives ---
    if (/^\s*#\s*include\b/.test(line)) {
      const startLine = i + 1; // 1-indexed
      let endIdx = i;
      // Collect consecutive include lines (allow blank lines between them)
      while (endIdx + 1 < lines.length) {
        const nextNonBlank = findNextNonBlankLine(lines, endIdx + 1);
        if (nextNonBlank === -1) {
          break;
        }
        if (/^\s*#\s*include\b/.test(lines[nextNonBlank])) {
          endIdx = nextNonBlank;
        } else {
          break;
        }
      }
      sections.push({
        type: 'include',
        startLine,
        endLine: endIdx + 1,
        code: lines.slice(i, endIdx + 1).join('\n'),
      });
      i = endIdx + 1;
      continue;
    }

    // --- Block comments at file scope ---
    if (trimmed.startsWith('/*')) {
      const startLine = i + 1;
      let endIdx = i;
      // Find end of block comment
      let found = false;
      for (let j = i; j < lines.length; j++) {
        if (lines[j].includes('*/')) {
          endIdx = j;
          found = true;
          break;
        }
      }
      if (!found) {
        endIdx = lines.length - 1;
      }
      sections.push({
        type: 'comment',
        startLine,
        endLine: endIdx + 1,
        code: lines.slice(i, endIdx + 1).join('\n'),
      });
      i = endIdx + 1;
      continue;
    }

    // --- Single-line comment blocks ---
    if (trimmed.startsWith('//')) {
      const startLine = i + 1;
      let endIdx = i;
      while (endIdx + 1 < lines.length && lines[endIdx + 1].trim().startsWith('//')) {
        endIdx++;
      }
      sections.push({
        type: 'comment',
        startLine,
        endLine: endIdx + 1,
        code: lines.slice(i, endIdx + 1).join('\n'),
      });
      i = endIdx + 1;
      continue;
    }

    // --- void setup() ---
    if (/\bvoid\s+setup\s*\(/.test(trimmed)) {
      const startLine = i + 1;
      const braceStart = findFirstBraceLine(lines, i);
      const endIdx = findClosingBrace(lines, braceStart);
      sections.push({
        type: 'setup',
        startLine,
        endLine: endIdx + 1,
        code: lines.slice(i, endIdx + 1).join('\n'),
      });
      i = endIdx + 1;
      continue;
    }

    // --- void loop() ---
    if (/\bvoid\s+loop\s*\(/.test(trimmed)) {
      const startLine = i + 1;
      const braceStart = findFirstBraceLine(lines, i);
      const endIdx = findClosingBrace(lines, braceStart);
      sections.push({
        type: 'loop',
        startLine,
        endLine: endIdx + 1,
        code: lines.slice(i, endIdx + 1).join('\n'),
      });
      i = endIdx + 1;
      continue;
    }

    // --- ISR ---
    if (isIsrLine(trimmed)) {
      const startLine = i + 1;
      const braceStart = findFirstBraceLine(lines, i);
      const endIdx = findClosingBrace(lines, braceStart);
      sections.push({
        type: 'isr',
        startLine,
        endLine: endIdx + 1,
        code: lines.slice(i, endIdx + 1).join('\n'),
      });
      i = endIdx + 1;
      continue;
    }

    // --- Function definitions ---
    if (isFunctionDefinition(trimmed)) {
      const startLine = i + 1;
      const braceStart = findFirstBraceLine(lines, i);
      const endIdx = findClosingBrace(lines, braceStart);
      sections.push({
        type: 'function',
        startLine,
        endLine: endIdx + 1,
        code: lines.slice(i, endIdx + 1).join('\n'),
      });
      i = endIdx + 1;
      continue;
    }

    // --- #define and other preprocessor at global scope ---
    if (/^\s*#\s*define\b/.test(line) || /^\s*#\s*(ifdef|ifndef|endif|pragma|if|else|elif|undef)\b/.test(line)) {
      const startLine = i + 1;
      // Collect consecutive preprocessor lines
      let endIdx = i;
      while (endIdx + 1 < lines.length) {
        const nextLine = lines[endIdx + 1].trim();
        if (/^#\s*(define|ifdef|ifndef|endif|pragma|if|else|elif|undef)\b/.test(nextLine)) {
          endIdx++;
        } else {
          break;
        }
      }
      sections.push({
        type: 'global',
        startLine,
        endLine: endIdx + 1,
        code: lines.slice(i, endIdx + 1).join('\n'),
      });
      i = endIdx + 1;
      continue;
    }

    // --- Global declarations (variables, constants, typedefs, structs, enums) ---
    {
      const startLine = i + 1;
      let endIdx = i;

      // If the line contains an opening brace (struct/enum/class), find closing brace
      if (trimmed.includes('{')) {
        endIdx = findClosingBrace(lines, i);
      } else {
        // Single or multi-line statement — find the semicolon
        while (endIdx < lines.length - 1 && !lines[endIdx].includes(';')) {
          endIdx++;
        }
      }

      // Collect consecutive global lines of the same type
      sections.push({
        type: 'global',
        startLine,
        endLine: endIdx + 1,
        code: lines.slice(i, endIdx + 1).join('\n'),
      });
      i = endIdx + 1;
    }
  }

  return sections;
}

/** Find the next non-blank line index starting from `from`. Returns -1 if none. */
function findNextNonBlankLine(lines: string[], from: number): number {
  for (let j = from; j < lines.length; j++) {
    if (lines[j].trim() !== '') {
      return j;
    }
  }
  return -1;
}

/** Find the line index containing the first opening brace at or after `from`. */
function findFirstBraceLine(lines: string[], from: number): number {
  for (let j = from; j < lines.length; j++) {
    if (lines[j].includes('{')) {
      return j;
    }
  }
  // Fallback: the brace might be on the same line or missing entirely
  return from;
}

// ---------------------------------------------------------------------------
// Concept Detection
// ---------------------------------------------------------------------------

/** Detect which concepts from CONCEPT_DATABASE are used in a code fragment. */
export function detectConcepts(code: string): string[] {
  const found = new Set<string>();

  for (const { key, pattern } of CONCEPT_PATTERNS) {
    if (found.has(key)) {
      continue;
    }
    if (pattern.test(code)) {
      found.add(key);
    }
  }

  // Deduplicate: if a specific Serial.xxx method is found, remove general 'Serial'
  const serialMethods = ['Serial.begin', 'Serial.print', 'Serial.println', 'Serial.available', 'Serial.read'];
  if (serialMethods.some((m) => found.has(m))) {
    found.delete('Serial');
  }

  // Deduplicate: Wire implies I2C
  if (found.has('Wire') && found.has('I2C')) {
    found.delete('I2C');
  }

  return Array.from(found).sort();
}

// ---------------------------------------------------------------------------
// Section Explanation
// ---------------------------------------------------------------------------

/** Generate an explanation for a single section at the given level. */
export function explainSection(section: SketchSection, level: ExplanationLevel): string {
  switch (section.type) {
    case 'include':
      return explainInclude(section, level);
    case 'global':
      return explainGlobal(section, level);
    case 'setup':
      return explainSetup(section, level);
    case 'loop':
      return explainLoop(section, level);
    case 'function':
      return explainFunction(section, level);
    case 'isr':
      return explainIsr(section, level);
    case 'comment':
      return explainComment(section, level);
    default: {
      const _exhaustive: never = section.type;
      return `Unknown section type: ${String(_exhaustive)}`;
    }
  }
}

function explainInclude(section: SketchSection, level: ExplanationLevel): string {
  const libs = extractIncludedLibraries(section.code);
  const libList = libs.length > 0 ? libs.join(', ') : 'header files';

  switch (level) {
    case 'beginner':
      return `This imports libraries (${libList}) that provide pre-written code for hardware features. Think of it like installing an app on your phone — it gives your Arduino new abilities without writing everything from scratch.`;
    case 'intermediate':
      return `Include directives for ${libList}. These pull in library headers that declare functions, classes, and constants needed by the sketch. Angle brackets mean system/library headers; quotes mean local project files.`;
    case 'advanced':
      return `Preprocessor #include directives for ${libList}. The C preprocessor textually inserts the header content before compilation. Include guards (or #pragma once) in those headers prevent multiple-definition errors. Order can matter when one header depends on types declared in another.`;
    default:
      return `Includes: ${libList}`;
  }
}

function explainGlobal(section: SketchSection, level: ExplanationLevel): string {
  const concepts = detectConcepts(section.code);
  const hasDefine = /^\s*#\s*define\b/m.test(section.code);
  const hasConst = /\bconst\b/.test(section.code);
  const hasVolatile = /\bvolatile\b/.test(section.code);
  const hasStruct = /\bstruct\b/.test(section.code);
  const hasEnum = /\benum\b/.test(section.code);

  const features: string[] = [];
  if (hasDefine) {
    features.push('macro definitions');
  }
  if (hasConst) {
    features.push('constants');
  }
  if (hasVolatile) {
    features.push('volatile variables (shared with interrupts)');
  }
  if (hasStruct) {
    features.push('data structures');
  }
  if (hasEnum) {
    features.push('enumerations');
  }
  if (features.length === 0) {
    features.push('global variables');
  }

  switch (level) {
    case 'beginner':
      return `This section creates ${features.join(' and ')} that the entire program can use. These are like labels or containers that hold values your Arduino needs to remember throughout the program.`;
    case 'intermediate':
      return `Global declarations: ${features.join(', ')}. These are accessible from setup(), loop(), and all functions. ${hasVolatile ? 'Volatile variables are used here because they are modified inside an interrupt handler.' : 'Consider using const for values that should not change.'}${concepts.length > 0 ? ` Concepts: ${concepts.join(', ')}.` : ''}`;
    case 'advanced':
      return `File-scope declarations: ${features.join(', ')}. Global variables reside in SRAM and persist for program lifetime. ${hasDefine ? '#define macros are resolved at preprocessor time with zero runtime cost. ' : ''}${hasVolatile ? 'The volatile qualifier prevents the compiler from caching reads, ensuring ISR-modified values are always re-read from SRAM. ' : ''}${hasStruct ? 'Struct layout follows C ABI with potential padding for alignment. ' : ''}Consider memory constraints — ATmega328P has only 2KB SRAM.`;
    default:
      return `Global section with ${features.join(', ')}.`;
  }
}

function explainSetup(section: SketchSection, level: ExplanationLevel): string {
  const concepts = detectConcepts(section.code);
  const conceptList = concepts.length > 0 ? concepts.join(', ') : 'initialization';

  switch (level) {
    case 'beginner':
      return `The setup() function runs once when your Arduino turns on or is reset. It prepares everything your program needs: ${conceptList}. Think of it as the "get ready" phase before the main action starts.`;
    case 'intermediate':
      return `setup() executes once at startup. Initializes: ${conceptList}. Pin modes, serial communication, and library initialization belong here. Code runs top-to-bottom before loop() begins.`;
    case 'advanced':
      return `setup() is called once by the Arduino runtime after hardware initialization (timers, ADC, etc.) and before the infinite loop() cycle. Initializes: ${conceptList}. The init() function (called before setup) configures Timer0 for millis()/micros() and enables global interrupts. Heavy initialization here delays the first loop() iteration.`;
    default:
      return `Setup function initializing ${conceptList}.`;
  }
}

function explainLoop(section: SketchSection, level: ExplanationLevel): string {
  const concepts = detectConcepts(section.code);
  const hasDelay = /\bdelay\s*\(/.test(section.code);
  const hasMillis = /\bmillis\s*\(/.test(section.code);
  const conceptList = concepts.length > 0 ? concepts.join(', ') : 'main logic';

  switch (level) {
    case 'beginner':
      return `The loop() function is the heart of your Arduino program — it runs over and over forever. Each time it reaches the end, it starts again from the top. It uses: ${conceptList}.${hasDelay ? ' The delay() call pauses everything, which is simple but means your Arduino cannot do anything else during that time.' : ''}`;
    case 'intermediate':
      return `loop() is called repeatedly after setup(). Concepts used: ${conceptList}.${hasDelay ? ' Note: delay() blocks the entire processor. Consider millis()-based timing for non-blocking behavior.' : ''}${hasMillis ? ' Good — using millis() for non-blocking timing allows the loop to remain responsive.' : ''}`;
    case 'advanced':
      return `Main execution loop. Concepts: ${conceptList}. The Arduino runtime calls loop() in an infinite cycle with no delay between iterations (main.cpp: for(;;) { loop(); ... }). Loop frequency depends on code execution time.${hasDelay ? ' WARNING: delay() halts the CPU in a busy-wait loop — blocks interrupts on some implementations and prevents any concurrent task processing.' : ''}${hasMillis ? ' Using millis() for cooperative multitasking is the correct approach for responsive real-time behavior.' : ''} Consider loop iteration time for real-time requirements.`;
    default:
      return `Loop function with ${conceptList}.`;
  }
}

function explainFunction(section: SketchSection, level: ExplanationLevel): string {
  const concepts = detectConcepts(section.code);
  const funcName = extractFunctionName(section.code);
  const params = extractFunctionParams(section.code);
  const returnType = extractReturnType(section.code);

  switch (level) {
    case 'beginner':
      return `This is a custom function called "${funcName}"${params ? ` that takes ${params}` : ''}${returnType && returnType !== 'void' ? ` and returns a ${returnType} value` : ''}. Functions are reusable blocks of code — like a recipe you can follow whenever you need it, instead of writing the same steps every time.${concepts.length > 0 ? ` It uses: ${concepts.join(', ')}.` : ''}`;
    case 'intermediate':
      return `Function "${funcName}"${params ? ` (${params})` : ''}${returnType ? ` → ${returnType}` : ''}. ${concepts.length > 0 ? `Uses: ${concepts.join(', ')}. ` : ''}Encapsulates reusable logic called from setup(), loop(), or other functions.`;
    case 'advanced':
      return `Function definition: ${returnType ?? 'void'} ${funcName}(${params ?? ''}).${concepts.length > 0 ? ` Concepts: ${concepts.join(', ')}.` : ''} Stack frame allocated on each call — recursive calls can overflow the limited stack (ATmega328P: ~1KB usable). Consider inlining small functions with the __attribute__((always_inline)) hint for performance-critical paths.`;
    default:
      return `Function "${funcName}".`;
  }
}

function explainIsr(section: SketchSection, level: ExplanationLevel): string {
  const concepts = detectConcepts(section.code);
  const isrName = extractIsrName(section.code);

  switch (level) {
    case 'beginner':
      return `This is an Interrupt Service Routine (ISR)${isrName ? ` called "${isrName}"` : ''}. It is a special function that the Arduino calls automatically when a hardware event happens (like a button press or a timer tick). It interrupts whatever the main program is doing, runs quickly, and then lets the main program continue.`;
    case 'intermediate':
      return `ISR${isrName ? ` "${isrName}"` : ''}: executes in response to a hardware interrupt. Must be short and fast — no delay(), Serial.print(), or dynamic memory allocation allowed. Use volatile variables to communicate with main code.${concepts.length > 0 ? ` Concepts: ${concepts.join(', ')}.` : ''}`;
    case 'advanced':
      return `ISR${isrName ? ` "${isrName}"` : ''}: hardware interrupt vector handler. Runs with global interrupts disabled (unless explicitly re-enabled with sei()). Context save/restore is automatic. Keep execution under ~100us to avoid missing other interrupts. Only volatile-qualified shared variables are safe; consider atomic access for multi-byte values (ATOMIC_BLOCK or cli/sei guards). No heap allocation, no blocking I/O.${concepts.length > 0 ? ` Concepts: ${concepts.join(', ')}.` : ''}`;
    default:
      return `ISR${isrName ? ` "${isrName}"` : ''}.`;
  }
}

function explainComment(section: SketchSection, _level: ExplanationLevel): string {
  const lineCount = section.code.split('\n').length;
  if (lineCount === 1) {
    return 'A comment explaining the code. Comments are ignored by the compiler and exist only for human readers.';
  }
  return `A ${lineCount}-line comment block. Comments document the code for human readers and are completely ignored during compilation.`;
}

// ---------------------------------------------------------------------------
// Helper Extractors
// ---------------------------------------------------------------------------

function extractIncludedLibraries(code: string): string[] {
  const libs: string[] = [];
  const regex = /#\s*include\s*[<"]([^>"]+)[>"]/g;
  let match = regex.exec(code);
  while (match) {
    libs.push(match[1]);
    match = regex.exec(code);
  }
  return libs;
}

function extractFunctionName(code: string): string {
  const match = /^[\w*&:<>]+\s+([\w:<>]+)\s*\(/m.exec(code.trim());
  return match ? match[1] : 'unknown';
}

function extractFunctionParams(code: string): string | null {
  const match = /\(([^)]*)\)/m.exec(code);
  if (!match || !match[1].trim()) {
    return null;
  }
  return match[1].trim();
}

function extractReturnType(code: string): string | null {
  const match = /^([\w*&:<>]+)\s+\w+\s*\(/m.exec(code.trim());
  return match ? match[1] : null;
}

function extractIsrName(code: string): string | null {
  // ISR(VECTOR_NAME)
  const isrMacro = /ISR\s*\(\s*(\w+)/.exec(code);
  if (isrMacro) {
    return isrMacro[1];
  }
  // void myISR() or void IRAM_ATTR myHandler()
  const funcName = /void\s+(?:IRAM_ATTR\s+)?(\w+)\s*\(/.exec(code);
  if (funcName) {
    return funcName[1];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Difficulty Assessment
// ---------------------------------------------------------------------------

/** Assess the difficulty of a sketch based on concepts used. */
function assessDifficulty(concepts: string[]): ExplanationLevel {
  const advancedConcepts = new Set([
    'ISR', 'volatile', 'noInterrupts', 'attachInterrupt', 'detachInterrupt',
    'SPI', 'bitwise', 'pointer', 'Watchdog', 'EEPROM', 'struct',
  ]);
  const intermediateConcepts = new Set([
    'millis', 'Wire', 'I2C', 'Servo', 'LiquidCrystal', 'enum',
    'static', 'String', 'map', 'constrain', 'pulseIn', 'shiftOut',
    'analogRead', 'analogWrite', 'tone',
  ]);

  let advCount = 0;
  let intCount = 0;

  for (const c of concepts) {
    if (advancedConcepts.has(c)) {
      advCount++;
    }
    if (intermediateConcepts.has(c)) {
      intCount++;
    }
  }

  if (advCount >= 2) {
    return 'advanced';
  }
  if (advCount >= 1 || intCount >= 3) {
    return 'intermediate';
  }
  return 'beginner';
}

// ---------------------------------------------------------------------------
// Full Sketch Explanation
// ---------------------------------------------------------------------------

/** Generate a summary of the entire sketch based on its sections and concepts. */
function generateOverallSummary(
  sections: SketchSection[],
  allConcepts: string[],
  level: ExplanationLevel,
): string {
  const sectionTypes = new Set(sections.map((s) => s.type));
  const hasSetup = sectionTypes.has('setup');
  const hasLoop = sectionTypes.has('loop');
  const functionCount = sections.filter((s) => s.type === 'function').length;
  const isrCount = sections.filter((s) => s.type === 'isr').length;
  const includeCount = sections.filter((s) => s.type === 'include').length;

  const parts: string[] = [];

  if (level === 'beginner') {
    parts.push(`This Arduino sketch has ${sections.length} sections.`);
    if (hasSetup && hasLoop) {
      parts.push('It follows the standard Arduino pattern with a setup() for initialization and a loop() for the main program.');
    }
    if (functionCount > 0) {
      parts.push(`It defines ${functionCount} helper function${functionCount > 1 ? 's' : ''} to keep the code organized.`);
    }
    if (isrCount > 0) {
      parts.push(`It uses ${isrCount} interrupt handler${isrCount > 1 ? 's' : ''} to respond to hardware events.`);
    }
    if (allConcepts.length > 0) {
      parts.push(`Key concepts: ${allConcepts.slice(0, 8).join(', ')}.`);
    }
  } else if (level === 'intermediate') {
    parts.push(`Sketch structure: ${sections.length} sections (${includeCount} includes, ${functionCount} functions, ${isrCount} ISRs).`);
    if (allConcepts.length > 0) {
      parts.push(`Concepts used: ${allConcepts.join(', ')}.`);
    }
    const hasDelay = allConcepts.includes('delay');
    const hasMillis = allConcepts.includes('millis');
    if (hasDelay && !hasMillis) {
      parts.push('Consider replacing delay() with millis()-based timing for better responsiveness.');
    }
  } else {
    parts.push(`Sketch analysis: ${sections.length} sections, ${allConcepts.length} distinct concepts.`);
    parts.push(`Structure: ${includeCount} includes, ${functionCount} functions, ${isrCount} ISRs.`);
    if (allConcepts.length > 0) {
      parts.push(`Full concept list: ${allConcepts.join(', ')}.`);
    }
    const totalLines = sections.reduce((acc, s) => acc + (s.endLine - s.startLine + 1), 0);
    parts.push(`Approximate size: ${totalLines} lines of code.`);
  }

  return parts.join(' ');
}

/**
 * Parse and explain an entire Arduino sketch.
 *
 * @param code - The full sketch source code.
 * @param level - The explanation difficulty level.
 * @returns A SketchExplanation with per-section explanations, summary, and concepts.
 */
export function explainSketch(code: string, level: ExplanationLevel): SketchExplanation {
  const sections = parseSketchSections(code);

  // Build per-section explanations and collect all concepts
  const allConceptsSet = new Set<string>();
  const sectionExplanations: SectionExplanation[] = sections.map((section) => {
    const concepts = detectConcepts(section.code);
    for (const c of concepts) {
      allConceptsSet.add(c);
    }
    return {
      section,
      explanation: explainSection(section, level),
      conceptsUsed: concepts,
    };
  });

  const allConcepts = Array.from(allConceptsSet).sort();
  const difficulty = assessDifficulty(allConcepts);
  const overallSummary = generateOverallSummary(sections, allConcepts, level);

  return {
    sections: sectionExplanations,
    overallSummary,
    difficulty,
    conceptsIntroduced: allConcepts,
  };
}
