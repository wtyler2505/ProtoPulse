import { describe, it, expect, beforeEach } from 'vitest';
import {
  CodeSimulator,
  parseSketch,
  BOARD_PROFILES,
} from '../code-simulator';
import type {
  SimulatorSnapshot,
  BoardProfile,
  PinState,
  SimVariable,
} from '../code-simulator';

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function sim(): CodeSimulator {
  return CodeSimulator.getInstance();
}

// ──────────────────────────────────────────────────────────────────
// parseSketch
// ──────────────────────────────────────────────────────────────────

describe('parseSketch', () => {
  it('parses a minimal sketch with setup and loop', () => {
    const source = `
void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
}
`;
    const parsed = parseSketch(source);
    expect(parsed.setupBody).toContain('pinMode(13, OUTPUT);');
    expect(parsed.loopBody).toContain('digitalWrite(13, HIGH);');
    expect(parsed.loopBody).toContain('delay(1000);');
  });

  it('parses global variable declarations', () => {
    const source = `
int ledPin = 13;
float voltage = 3.3;

void setup() {
  pinMode(ledPin, OUTPUT);
}

void loop() {
}
`;
    const parsed = parseSketch(source);
    expect(parsed.globals.some((g) => g.includes('int ledPin = 13'))).toBe(true);
    expect(parsed.globals.some((g) => g.includes('float voltage = 3.3'))).toBe(true);
  });

  it('parses user-defined functions', () => {
    const source = `
int addValues(int a, int b) {
  return a + b;
}

void setup() {
}

void loop() {
}
`;
    const parsed = parseSketch(source);
    expect(parsed.functions.has('addValues')).toBe(true);
    const func = parsed.functions.get('addValues')!;
    expect(func.params).toEqual(['int a', 'int b']);
    expect(func.body.some((l) => l.includes('return'))).toBe(true);
  });

  it('preserves comments in globals', () => {
    const source = `
// This is a comment
#include <Wire.h>

void setup() {
}

void loop() {
}
`;
    const parsed = parseSketch(source);
    expect(parsed.globals.some((g) => g.includes('// This is a comment'))).toBe(true);
    expect(parsed.globals.some((g) => g.includes('#include <Wire.h>'))).toBe(true);
  });

  it('handles empty setup and loop', () => {
    const source = `
void setup() {
}

void loop() {
}
`;
    const parsed = parseSketch(source);
    expect(parsed.setupBody).toHaveLength(0);
    expect(parsed.loopBody).toHaveLength(0);
  });

  it('handles block comments', () => {
    const source = `
/* This is
   a multi-line comment */

void setup() {
}

void loop() {
}
`;
    const parsed = parseSketch(source);
    expect(parsed.globals.some((g) => g.includes('multi-line comment'))).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────
// Board profiles
// ──────────────────────────────────────────────────────────────────

describe('Board profiles', () => {
  it('has 4 board profiles', () => {
    expect(Object.keys(BOARD_PROFILES)).toHaveLength(4);
  });

  it('Arduino Uno has correct specs', () => {
    const uno = BOARD_PROFILES['arduino:avr:uno'];
    expect(uno.name).toBe('Arduino Uno');
    expect(uno.digitalPins).toBe(14);
    expect(uno.analogPins).toBe(6);
    expect(uno.clockMHz).toBe(16);
    expect(uno.flashKB).toBe(32);
    expect(uno.sramKB).toBe(2);
    expect(uno.hasSerial1).toBe(false);
    expect(uno.analogReadMax).toBe(1023);
  });

  it('Arduino Mega has Serial1 support', () => {
    const mega = BOARD_PROFILES['arduino:avr:mega'];
    expect(mega.hasSerial1).toBe(true);
    expect(mega.digitalPins).toBe(54);
    expect(mega.analogPins).toBe(16);
  });

  it('Arduino Nano has correct specs', () => {
    const nano = BOARD_PROFILES['arduino:avr:nano'];
    expect(nano.digitalPins).toBe(14);
    expect(nano.analogPins).toBe(8);
    expect(nano.hasSerial1).toBe(false);
  });

  it('ESP32 has higher resolution ADC', () => {
    const esp = BOARD_PROFILES['esp32:esp32:esp32'];
    expect(esp.analogReadMax).toBe(4095);
    expect(esp.clockMHz).toBe(240);
    expect(esp.hasSerial1).toBe(true);
    expect(esp.digitalPins).toBe(40);
  });
});

// ──────────────────────────────────────────────────────────────────
// CodeSimulator — singleton
// ──────────────────────────────────────────────────────────────────

describe('CodeSimulator — singleton', () => {
  beforeEach(() => {
    CodeSimulator.resetInstance();
  });

  it('returns same instance', () => {
    const a = CodeSimulator.getInstance();
    const b = CodeSimulator.getInstance();
    expect(a).toBe(b);
  });

  it('resetInstance creates a fresh instance', () => {
    const a = CodeSimulator.getInstance();
    a.loadSketch('void setup() {} void loop() {}');
    CodeSimulator.resetInstance();
    const b = CodeSimulator.getInstance();
    expect(b.getStatus()).toBe('idle');
    expect(b.getSketchName()).toBe('');
  });
});

// ──────────────────────────────────────────────────────────────────
// CodeSimulator — subscribe
// ──────────────────────────────────────────────────────────────────

describe('CodeSimulator — subscribe', () => {
  beforeEach(() => {
    CodeSimulator.resetInstance();
  });

  it('notifies listeners on state changes', () => {
    const s = sim();
    let count = 0;
    s.subscribe(() => { count++; });
    s.loadSketch('void setup() {} void loop() {}');
    expect(count).toBeGreaterThan(0);
  });

  it('unsubscribe removes listener', () => {
    const s = sim();
    let count = 0;
    const unsub = s.subscribe(() => { count++; });
    s.loadSketch('void setup() {} void loop() {}');
    const afterLoad = count;
    unsub();
    s.reset();
    expect(count).toBe(afterLoad);
  });
});

// ──────────────────────────────────────────────────────────────────
// CodeSimulator — board management
// ──────────────────────────────────────────────────────────────────

describe('CodeSimulator — board management', () => {
  beforeEach(() => {
    CodeSimulator.resetInstance();
  });

  it('defaults to Arduino Uno', () => {
    const board = sim().getBoard();
    expect(board.fqbn).toBe('arduino:avr:uno');
  });

  it('setBoard changes the board', () => {
    const s = sim();
    s.setBoard('arduino:avr:mega');
    expect(s.getBoard().name).toBe('Arduino Mega');
  });

  it('setBoard throws for unknown board', () => {
    expect(() => sim().setBoard('unknown:board:id')).toThrow('Unknown board');
  });

  it('setBoard resets MCU state', () => {
    const s = sim();
    s.loadSketch('void setup() { Serial.begin(9600); } void loop() {}');
    s.start();
    s.setBoard('esp32:esp32:esp32');
    expect(s.getStatus()).toBe('idle');
  });
});

// ──────────────────────────────────────────────────────────────────
// CodeSimulator — sketch loading
// ──────────────────────────────────────────────────────────────────

describe('CodeSimulator — sketch loading', () => {
  beforeEach(() => {
    CodeSimulator.resetInstance();
  });

  it('loads a sketch and sets name', () => {
    const s = sim();
    s.loadSketch('void setup() {} void loop() {}', 'blink.ino');
    expect(s.getSketchName()).toBe('blink.ino');
    expect(s.getStatus()).toBe('idle');
  });

  it('defaults sketch name to sketch.ino', () => {
    const s = sim();
    s.loadSketch('void setup() {} void loop() {}');
    expect(s.getSketchName()).toBe('sketch.ino');
  });

  it('parses global variables on load', () => {
    const s = sim();
    s.loadSketch(`
int ledPin = 13;
void setup() {}
void loop() {}
`);
    const v = s.getVariable('ledPin');
    expect(v).toBeDefined();
    expect(v!.value).toBe(13);
    expect(v!.type).toBe('int');
  });

  it('parses boolean globals', () => {
    const s = sim();
    s.loadSketch(`
bool flag = true;
void setup() {}
void loop() {}
`);
    const v = s.getVariable('flag');
    expect(v).toBeDefined();
    expect(v!.value).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────
// CodeSimulator — digital I/O
// ──────────────────────────────────────────────────────────────────

describe('CodeSimulator — digital I/O', () => {
  beforeEach(() => {
    CodeSimulator.resetInstance();
  });

  it('executes pinMode and digitalWrite in setup', () => {
    const s = sim();
    s.loadSketch(`
void setup() {
  pinMode(13, OUTPUT);
  digitalWrite(13, HIGH);
}
void loop() {}
`);
    s.start();
    const pin = s.getPinState(13);
    expect(pin).toBeDefined();
    expect(pin!.mode).toBe('OUTPUT');
    expect(pin!.digital).toBe(1);
  });

  it('sets pin LOW', () => {
    const s = sim();
    s.loadSketch(`
void setup() {
  pinMode(13, OUTPUT);
  digitalWrite(13, HIGH);
  digitalWrite(13, LOW);
}
void loop() {}
`);
    s.start();
    expect(s.getPinState(13)!.digital).toBe(0);
  });

  it('INPUT_PULLUP sets pin HIGH by default', () => {
    const s = sim();
    s.loadSketch(`
void setup() {
  pinMode(2, INPUT_PULLUP);
}
void loop() {}
`);
    s.start();
    expect(s.getPinState(2)!.mode).toBe('INPUT_PULLUP');
    expect(s.getPinState(2)!.digital).toBe(1);
  });

  it('digitalRead returns pin state', () => {
    const s = sim();
    s.loadSketch(`
void setup() {
  pinMode(2, INPUT_PULLUP);
}
void loop() {}
`);
    s.start();
    expect(s.digitalRead(2)).toBe(1);
  });
});

// ──────────────────────────────────────────────────────────────────
// CodeSimulator — analog I/O
// ──────────────────────────────────────────────────────────────────

describe('CodeSimulator — analog I/O', () => {
  beforeEach(() => {
    CodeSimulator.resetInstance();
  });

  it('analogWrite sets PWM value', () => {
    const s = sim();
    s.loadSketch(`
void setup() {
  analogWrite(3, 128);
}
void loop() {}
`);
    s.start();
    const pin = s.getPinState(3);
    expect(pin).toBeDefined();
    expect(pin!.analog).toBe(128);
    expect(pin!.pwm).toBe(true);
  });

  it('analogWrite errors on non-PWM pin', () => {
    const s = sim();
    s.loadSketch(`
void setup() {
  analogWrite(2, 128);
}
void loop() {}
`);
    s.start();
    expect(s.getStatus()).toBe('error');
    const errors = s.getErrors();
    expect(errors.some((e) => e.message.includes('PWM'))).toBe(true);
  });

  it('analogRead returns sensor input value', () => {
    const s = sim();
    s.loadSketch(`
void setup() {}
void loop() {}
`);
    s.start();
    s.injectSensorInput(0, 512);
    expect(s.analogRead(0)).toBe(512);
  });

  it('sensor input clamps to board max', () => {
    const s = sim();
    s.loadSketch(`
void setup() {}
void loop() {}
`);
    s.start();
    s.injectSensorInput(0, 2000);
    // Uno max is 1023
    expect(s.analogRead(0)).toBe(1023);
  });
});

// ──────────────────────────────────────────────────────────────────
// CodeSimulator — Serial
// ──────────────────────────────────────────────────────────────────

describe('CodeSimulator — Serial', () => {
  beforeEach(() => {
    CodeSimulator.resetInstance();
  });

  it('Serial.begin enables serial', () => {
    const s = sim();
    s.loadSketch(`
void setup() {
  Serial.begin(115200);
}
void loop() {}
`);
    s.start();
    const snap = s.getSnapshot();
    expect(snap.mcu.serial.enabled).toBe(true);
    expect(snap.mcu.serial.baudRate).toBe(115200);
  });

  it('Serial.println outputs text with newline', () => {
    const s = sim();
    s.loadSketch(`
void setup() {
  Serial.begin(9600);
  Serial.println("Hello");
}
void loop() {}
`);
    s.start();
    const output = s.getSerialOutput();
    expect(output).toContain('Hello\n');
  });

  it('Serial.print outputs text without newline', () => {
    const s = sim();
    s.loadSketch(`
void setup() {
  Serial.begin(9600);
  Serial.print("Hi");
}
void loop() {}
`);
    s.start();
    const output = s.getSerialOutput();
    expect(output).toContain('Hi');
  });

  it('Serial output includes variable values', () => {
    const s = sim();
    s.loadSketch(`
int x = 42;
void setup() {
  Serial.begin(9600);
  Serial.println(x);
}
void loop() {}
`);
    s.start();
    const output = s.getSerialOutput();
    expect(output.some((line) => line.includes('42'))).toBe(true);
  });

  it('Serial.print without begin raises error', () => {
    const s = sim();
    s.loadSketch(`
void setup() {
  Serial.println("oops");
}
void loop() {}
`);
    s.start();
    expect(s.getStatus()).toBe('error');
  });

  it('Serial1 works on Mega', () => {
    const s = sim();
    s.setBoard('arduino:avr:mega');
    s.loadSketch(`
void setup() {
  Serial1.begin(9600);
  Serial1.println("Mega serial1");
}
void loop() {}
`);
    s.start();
    const output = s.getSerial1Output();
    expect(output.some((line) => line.includes('Mega serial1'))).toBe(true);
  });

  it('Serial1 errors on Uno', () => {
    const s = sim();
    s.loadSketch(`
void setup() {
  Serial1.begin(9600);
}
void loop() {}
`);
    s.start();
    expect(s.getStatus()).toBe('error');
  });
});

// ──────────────────────────────────────────────────────────────────
// CodeSimulator — timing
// ──────────────────────────────────────────────────────────────────

describe('CodeSimulator — timing', () => {
  beforeEach(() => {
    CodeSimulator.resetInstance();
  });

  it('delay advances millis', () => {
    const s = sim();
    s.loadSketch(`
void setup() {
  delay(1000);
}
void loop() {}
`);
    s.start();
    expect(s.getMillis()).toBeGreaterThanOrEqual(1000);
  });

  it('delayMicroseconds advances micros', () => {
    const s = sim();
    s.loadSketch(`
void setup() {
  delayMicroseconds(500);
}
void loop() {}
`);
    s.start();
    expect(s.getMicros()).toBeGreaterThanOrEqual(500);
  });

  it('millis accumulates across loop iterations', () => {
    const s = sim();
    s.loadSketch(`
void setup() {}
void loop() {
  delay(100);
}
`);
    s.start();
    s.runLoops(5);
    expect(s.getMillis()).toBeGreaterThanOrEqual(500);
  });
});

// ──────────────────────────────────────────────────────────────────
// CodeSimulator — variables and expressions
// ──────────────────────────────────────────────────────────────────

describe('CodeSimulator — variables and expressions', () => {
  beforeEach(() => {
    CodeSimulator.resetInstance();
  });

  it('declares and assigns variables in setup', () => {
    const s = sim();
    s.loadSketch(`
void setup() {
  int x = 5;
  int y = 10;
}
void loop() {}
`);
    s.start();
    expect(s.getVariable('x')?.value).toBe(5);
    expect(s.getVariable('y')?.value).toBe(10);
  });

  it('supports increment and decrement', () => {
    const s = sim();
    s.loadSketch(`
int counter = 0;
void setup() {
  counter++;
  counter++;
  counter--;
}
void loop() {}
`);
    s.start();
    expect(s.getVariable('counter')?.value).toBe(1);
  });

  it('supports compound assignment operators', () => {
    const s = sim();
    s.loadSketch(`
int x = 10;
void setup() {
  x += 5;
  x -= 3;
  x *= 2;
}
void loop() {}
`);
    s.start();
    expect(s.getVariable('x')?.value).toBe(24);
  });

  it('evaluates arithmetic expressions', () => {
    const s = sim();
    s.loadSketch(`
void setup() {
  int result = 2 + 3;
}
void loop() {}
`);
    s.start();
    expect(s.getVariable('result')?.value).toBe(5);
  });

  it('evaluates Arduino map function', () => {
    const s = sim();
    s.loadSketch(`
void setup() {
  int mapped = map(512, 0, 1023, 0, 255);
}
void loop() {}
`);
    s.start();
    const v = s.getVariable('mapped');
    expect(v).toBeDefined();
    // map(512, 0, 1023, 0, 255) ≈ 127.5 → rounds to 128
    expect(v!.value).toBe(128);
  });

  it('evaluates constrain function', () => {
    const s = sim();
    s.loadSketch(`
void setup() {
  int clamped = constrain(300, 0, 255);
}
void loop() {}
`);
    s.start();
    expect(s.getVariable('clamped')?.value).toBe(255);
  });

  it('evaluates abs function', () => {
    const s = sim();
    s.loadSketch(`
void setup() {
  int positive = abs(-42);
}
void loop() {}
`);
    s.start();
    expect(s.getVariable('positive')?.value).toBe(42);
  });

  it('evaluates min/max functions', () => {
    const s = sim();
    s.loadSketch(`
void setup() {
  int small = min(3, 7);
  int big = max(3, 7);
}
void loop() {}
`);
    s.start();
    expect(s.getVariable('small')?.value).toBe(3);
    expect(s.getVariable('big')?.value).toBe(7);
  });

  it('evaluates pow and sqrt', () => {
    const s = sim();
    s.loadSketch(`
void setup() {
  float p = pow(2, 8);
  float sq = sqrt(144);
}
void loop() {}
`);
    s.start();
    expect(s.getVariable('p')?.value).toBe(256);
    expect(s.getVariable('sq')?.value).toBe(12);
  });

  it('getAllVariables returns all defined variables', () => {
    const s = sim();
    s.loadSketch(`
int a = 1;
float b = 2.5;
void setup() {}
void loop() {}
`);
    const vars = s.getAllVariables();
    expect(vars.length).toBeGreaterThanOrEqual(2);
    expect(vars.some((v) => v.name === 'a')).toBe(true);
    expect(vars.some((v) => v.name === 'b')).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────
// CodeSimulator — control flow
// ──────────────────────────────────────────────────────────────────

describe('CodeSimulator — control flow', () => {
  beforeEach(() => {
    CodeSimulator.resetInstance();
  });

  it('executes if block when true', () => {
    const s = sim();
    s.loadSketch(`
int x = 0;
void setup() {
  if (1 == 1) {
    x = 42;
  }
}
void loop() {}
`);
    s.start();
    expect(s.getVariable('x')?.value).toBe(42);
  });

  it('skips if block when false', () => {
    const s = sim();
    s.loadSketch(`
int x = 0;
void setup() {
  if (1 == 2) {
    x = 42;
  }
}
void loop() {}
`);
    s.start();
    expect(s.getVariable('x')?.value).toBe(0);
  });

  it('executes for loop', () => {
    const s = sim();
    s.loadSketch(`
int sum = 0;
void setup() {
  for (int i = 0; i < 5; i++) {
    sum += 1;
  }
}
void loop() {}
`);
    s.start();
    expect(s.getVariable('sum')?.value).toBe(5);
  });

  it('executes while loop', () => {
    const s = sim();
    s.loadSketch(`
int count = 0;
void setup() {
  while (count < 3) {
    count++;
  }
}
void loop() {}
`);
    s.start();
    expect(s.getVariable('count')?.value).toBe(3);
  });

  it('loop() executes on each stepLoop call', () => {
    const s = sim();
    s.loadSketch(`
int ticks = 0;
void setup() {}
void loop() {
  ticks++;
}
`);
    s.start();
    s.stepLoop();
    s.stepLoop();
    s.stepLoop();
    expect(s.getVariable('ticks')?.value).toBe(3);
    expect(s.getLoopIndex()).toBe(3);
  });
});

// ──────────────────────────────────────────────────────────────────
// CodeSimulator — user functions
// ──────────────────────────────────────────────────────────────────

describe('CodeSimulator — user functions', () => {
  beforeEach(() => {
    CodeSimulator.resetInstance();
  });

  it('calls a user-defined function', () => {
    const s = sim();
    s.loadSketch(`
int result = 0;

int add(int a, int b) {
  return a + b;
}

void setup() {
  result = add(3, 4);
}

void loop() {}
`);
    s.start();
    expect(s.getVariable('result')?.value).toBe(7);
  });

  it('supports void functions', () => {
    const s = sim();
    s.loadSketch(`
int flag = 0;

void setFlag() {
  flag = 1;
}

void setup() {
  setFlag();
}

void loop() {}
`);
    s.start();
    expect(s.getVariable('flag')?.value).toBe(1);
  });
});

// ──────────────────────────────────────────────────────────────────
// CodeSimulator — interrupts
// ──────────────────────────────────────────────────────────────────

describe('CodeSimulator — interrupts', () => {
  beforeEach(() => {
    CodeSimulator.resetInstance();
  });

  it('attaches interrupt handler', () => {
    const s = sim();
    s.loadSketch(`
void isr() {}
void setup() {
  attachInterrupt(digitalPinToInterrupt(2), isr, RISING);
}
void loop() {}
`);
    s.start();
    const snap = s.getSnapshot();
    expect(snap.mcu.interrupts.has(2)).toBe(true);
    expect(snap.mcu.interrupts.get(2)!.mode).toBe('RISING');
  });

  it('errors on non-interrupt pin', () => {
    const s = sim();
    s.loadSketch(`
void isr() {}
void setup() {
  attachInterrupt(digitalPinToInterrupt(5), isr, FALLING);
}
void loop() {}
`);
    s.start();
    expect(s.getStatus()).toBe('error');
  });

  it('noInterrupts/interrupts toggle', () => {
    const s = sim();
    s.loadSketch(`
void setup() {
  noInterrupts();
}
void loop() {}
`);
    s.start();
    expect(s.getSnapshot().mcu.interruptsEnabled).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────
// CodeSimulator — breakpoints
// ──────────────────────────────────────────────────────────────────

describe('CodeSimulator — breakpoints', () => {
  beforeEach(() => {
    CodeSimulator.resetInstance();
  });

  it('adds a breakpoint', () => {
    const s = sim();
    s.addBreakpoint(5);
    const snap = s.getSnapshot();
    expect(snap.breakpoints).toHaveLength(1);
    expect(snap.breakpoints[0].line).toBe(5);
    expect(snap.breakpoints[0].enabled).toBe(true);
  });

  it('removes a breakpoint', () => {
    const s = sim();
    s.addBreakpoint(5);
    s.removeBreakpoint(5);
    expect(s.getSnapshot().breakpoints).toHaveLength(0);
  });

  it('toggles a breakpoint', () => {
    const s = sim();
    s.addBreakpoint(5);
    s.toggleBreakpoint(5);
    expect(s.getSnapshot().breakpoints[0].enabled).toBe(false);
    s.toggleBreakpoint(5);
    expect(s.getSnapshot().breakpoints[0].enabled).toBe(true);
  });

  it('clearBreakpoints removes all', () => {
    const s = sim();
    s.addBreakpoint(1);
    s.addBreakpoint(2);
    s.addBreakpoint(3);
    s.clearBreakpoints();
    expect(s.getSnapshot().breakpoints).toHaveLength(0);
  });

  it('adds conditional breakpoint', () => {
    const s = sim();
    s.addBreakpoint(10, 'x > 5');
    expect(s.getSnapshot().breakpoints[0].condition).toBe('x > 5');
  });
});

// ──────────────────────────────────────────────────────────────────
// CodeSimulator — lifecycle
// ──────────────────────────────────────────────────────────────────

describe('CodeSimulator — lifecycle', () => {
  beforeEach(() => {
    CodeSimulator.resetInstance();
  });

  it('start → running → pause → resume → stop', () => {
    const s = sim();
    s.loadSketch('void setup() {} void loop() {}');
    expect(s.getStatus()).toBe('idle');

    s.start();
    expect(s.getStatus()).toBe('running');

    s.pause();
    expect(s.getStatus()).toBe('paused');

    s.resume();
    expect(s.getStatus()).toBe('running');

    s.stop();
    expect(s.getStatus()).toBe('stopped');
  });

  it('start without sketch generates error', () => {
    const s = sim();
    s.start();
    expect(s.getStatus()).toBe('error');
  });

  it('reset clears all state', () => {
    const s = sim();
    s.loadSketch(`
int x = 5;
void setup() {
  Serial.begin(9600);
  Serial.println("hello");
}
void loop() {}
`);
    s.start();
    s.reset();
    expect(s.getStatus()).toBe('idle');
    expect(s.getSerialOutput()).toHaveLength(0);
    expect(s.getExecutionCount()).toBe(0);
    expect(s.getElapsedMs()).toBe(0);
  });

  it('isSetupDone tracks setup execution', () => {
    const s = sim();
    s.loadSketch('void setup() {} void loop() {}');
    expect(s.isSetupDone()).toBe(false);
    s.start();
    expect(s.isSetupDone()).toBe(true);
  });

  it('stepLoop auto-starts if setup not done', () => {
    const s = sim();
    s.loadSketch('void setup() {} void loop() {}');
    s.stepLoop();
    expect(s.isSetupDone()).toBe(true);
  });

  it('stepLoop does nothing when stopped', () => {
    const s = sim();
    s.loadSketch(`
int x = 0;
void setup() {}
void loop() { x++; }
`);
    s.start();
    s.stop();
    const before = s.getExecutionCount();
    s.stepLoop();
    expect(s.getExecutionCount()).toBe(before);
  });
});

// ──────────────────────────────────────────────────────────────────
// CodeSimulator — snapshot
// ──────────────────────────────────────────────────────────────────

describe('CodeSimulator — snapshot', () => {
  beforeEach(() => {
    CodeSimulator.resetInstance();
  });

  it('getSnapshot returns all expected fields', () => {
    const s = sim();
    s.loadSketch('void setup() {} void loop() {}', 'test.ino');
    const snap: SimulatorSnapshot = s.getSnapshot();
    expect(snap.status).toBe('idle');
    expect(snap.sketchName).toBe('test.ino');
    expect(snap.board.fqbn).toBe('arduino:avr:uno');
    expect(snap.breakpoints).toEqual([]);
    expect(snap.errors).toEqual([]);
    expect(snap.totalLines).toBeGreaterThan(0);
  });

  it('snapshot reflects execution state after start', () => {
    const s = sim();
    s.loadSketch(`
void setup() {
  Serial.begin(9600);
  Serial.println("hi");
}
void loop() {}
`);
    s.start();
    const snap = s.getSnapshot();
    expect(snap.status).toBe('running');
    expect(snap.executionCount).toBeGreaterThan(0);
    expect(snap.elapsedMs).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// CodeSimulator — sensor input
// ──────────────────────────────────────────────────────────────────

describe('CodeSimulator — sensor input', () => {
  beforeEach(() => {
    CodeSimulator.resetInstance();
  });

  it('injectSensorInput sets analog and digital values', () => {
    const s = sim();
    s.loadSketch('void setup() {} void loop() {}');
    s.start();
    s.injectSensorInput(0, 800);
    const pin = s.getPinState(0);
    expect(pin).toBeDefined();
    expect(pin!.analog).toBe(800);
    // 800 > 1023/2 = 511.5 → digital HIGH
    expect(pin!.digital).toBe(1);
  });

  it('low sensor value sets digital LOW', () => {
    const s = sim();
    s.loadSketch('void setup() {} void loop() {}');
    s.start();
    s.injectSensorInput(0, 100);
    expect(s.getPinState(0)!.digital).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// CodeSimulator — runLoops
// ──────────────────────────────────────────────────────────────────

describe('CodeSimulator — runLoops', () => {
  beforeEach(() => {
    CodeSimulator.resetInstance();
  });

  it('runs multiple loop iterations', () => {
    const s = sim();
    s.loadSketch(`
int count = 0;
void setup() {}
void loop() {
  count++;
}
`);
    s.start();
    s.runLoops(10);
    expect(s.getVariable('count')?.value).toBe(10);
    expect(s.getLoopIndex()).toBe(10);
  });

  it('stops on error during runLoops', () => {
    const s = sim();
    // analogWrite on non-PWM pin will error
    s.loadSketch(`
void setup() {}
void loop() {
  analogWrite(2, 128);
}
`);
    s.start();
    s.runLoops(5);
    expect(s.getStatus()).toBe('error');
    // Should not have completed all 5 loops
    expect(s.getLoopIndex()).toBeLessThanOrEqual(1);
  });
});

// ──────────────────────────────────────────────────────────────────
// CodeSimulator — bitwise operations
// ──────────────────────────────────────────────────────────────────

describe('CodeSimulator — bitwise operations', () => {
  beforeEach(() => {
    CodeSimulator.resetInstance();
  });

  it('supports bitwise OR assignment', () => {
    const s = sim();
    s.loadSketch(`
int flags = 0;
void setup() {
  flags |= 4;
}
void loop() {}
`);
    s.start();
    expect(s.getVariable('flags')?.value).toBe(4);
  });

  it('supports bitwise AND assignment', () => {
    const s = sim();
    s.loadSketch(`
int val = 0xFF;
void setup() {
  val &= 0x0F;
}
void loop() {}
`);
    s.start();
    expect(s.getVariable('val')?.value).toBe(0x0F);
  });
});

// ──────────────────────────────────────────────────────────────────
// CodeSimulator — Arduino constants
// ──────────────────────────────────────────────────────────────────

describe('CodeSimulator — Arduino constants', () => {
  beforeEach(() => {
    CodeSimulator.resetInstance();
  });

  it('resolves LED_BUILTIN to 13', () => {
    const s = sim();
    s.loadSketch(`
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, HIGH);
}
void loop() {}
`);
    s.start();
    expect(s.getPinState(13)!.mode).toBe('OUTPUT');
    expect(s.getPinState(13)!.digital).toBe(1);
  });

  it('resolves HIGH/LOW in global declarations', () => {
    const s = sim();
    s.loadSketch(`
int onState = HIGH;
int offState = LOW;
void setup() {}
void loop() {}
`);
    expect(s.getVariable('onState')?.value).toBe(1);
    expect(s.getVariable('offState')?.value).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// CodeSimulator — string output
// ──────────────────────────────────────────────────────────────────

describe('CodeSimulator — string concatenation in Serial', () => {
  beforeEach(() => {
    CodeSimulator.resetInstance();
  });

  it('concatenates string + variable', () => {
    const s = sim();
    s.loadSketch(`
int val = 42;
void setup() {
  Serial.begin(9600);
  Serial.println("Value: " + val);
}
void loop() {}
`);
    s.start();
    const output = s.getSerialOutput();
    expect(output.some((line) => line.includes('Value: 42'))).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────
// CodeSimulator — ESP32 board
// ──────────────────────────────────────────────────────────────────

describe('CodeSimulator — ESP32 board', () => {
  beforeEach(() => {
    CodeSimulator.resetInstance();
  });

  it('ESP32 has 4095 ADC max', () => {
    const s = sim();
    s.setBoard('esp32:esp32:esp32');
    s.loadSketch('void setup() {} void loop() {}');
    s.start();
    s.injectSensorInput(0, 5000);
    expect(s.analogRead(0)).toBe(4095);
  });

  it('ESP32 supports Serial1', () => {
    const s = sim();
    s.setBoard('esp32:esp32:esp32');
    s.loadSketch(`
void setup() {
  Serial1.begin(115200);
  Serial1.println("ESP32");
}
void loop() {}
`);
    s.start();
    expect(s.getStatus()).not.toBe('error');
    const output = s.getSerial1Output();
    expect(output.some((l) => l.includes('ESP32'))).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────
// CodeSimulator — hex and binary literals
// ──────────────────────────────────────────────────────────────────

describe('CodeSimulator — hex and binary literals', () => {
  beforeEach(() => {
    CodeSimulator.resetInstance();
  });

  it('parses hex values', () => {
    const s = sim();
    s.loadSketch(`
int mask = 0xFF;
void setup() {}
void loop() {}
`);
    expect(s.getVariable('mask')?.value).toBe(255);
  });
});

// ──────────────────────────────────────────────────────────────────
// CodeSimulator — getPinState returns undefined for invalid pins
// ──────────────────────────────────────────────────────────────────

describe('CodeSimulator — getPinState edge cases', () => {
  beforeEach(() => {
    CodeSimulator.resetInstance();
  });

  it('returns undefined for pin beyond range', () => {
    const s = sim();
    expect(s.getPinState(999)).toBeUndefined();
  });
});
