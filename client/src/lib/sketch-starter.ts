// ---------------------------------------------------------------------------
// Sketch Starter — Schematic-to-Arduino Sketch Generator
// ---------------------------------------------------------------------------
// Takes a schematic context (components + connections) and generates a
// compilable Arduino .ino sketch. Maps common component types to Arduino
// init/read/write patterns via COMPONENT_CODE_MAP. Supports board-specific
// defaults (Uno, Mega, Nano, ESP32).
//
// Pure module — no React/DOM dependencies.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A pin on a schematic component. */
export interface SchematicPin {
  readonly name: string;
  /** Physical Arduino pin number or analog alias (e.g. 'A0'). */
  readonly pin?: number | string;
}

/** A component in the schematic context. */
export interface SchematicComponent {
  readonly type: string;
  readonly refdes: string;
  readonly pins: readonly SchematicPin[];
}

/** A wire/net connection between two component pins. */
export interface SchematicConnection {
  readonly from: { refdes: string; pin: string };
  readonly to: { refdes: string; pin: string };
}

/** Full schematic context fed into the generator. */
export interface SchematicContext {
  readonly components: readonly SchematicComponent[];
  readonly connections: readonly SchematicConnection[];
}

/** Structured sketch template before final formatting. */
export interface SketchTemplate {
  readonly board: string;
  readonly includes: readonly string[];
  readonly globals: readonly string[];
  readonly setupCode: readonly string[];
  readonly loopCode: readonly string[];
  readonly comments: readonly string[];
}

/** Code snippets for a single component type. */
export interface ComponentCodeEntry {
  /** #include directives required by this component (without the #include). */
  readonly includes: readonly string[];
  /** Global variable declarations (pin constants, object instances, etc.). */
  readonly globals: (refdes: string, pins: readonly SchematicPin[]) => readonly string[];
  /** Lines to emit inside setup(). */
  readonly setup: (refdes: string, pins: readonly SchematicPin[]) => readonly string[];
  /** Lines to emit inside loop(). Empty if the component is passive/no loop action. */
  readonly loop: (refdes: string, pins: readonly SchematicPin[]) => readonly string[];
  /** Human-readable comment describing what this component code does. */
  readonly comment: string;
}

// ---------------------------------------------------------------------------
// Board Defaults
// ---------------------------------------------------------------------------

const BOARD_DEFAULTS: Record<string, { label: string; serialBegin: string; baudRate: number }> = {
  uno: { label: 'Arduino Uno', serialBegin: 'Serial', baudRate: 9600 },
  mega: { label: 'Arduino Mega 2560', serialBegin: 'Serial', baudRate: 9600 },
  nano: { label: 'Arduino Nano', serialBegin: 'Serial', baudRate: 9600 },
  esp32: { label: 'ESP32 DevKit', serialBegin: 'Serial', baudRate: 115200 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sanitize a refdes or label into a valid C identifier fragment.
 * Strips non-alphanumeric chars, collapses underscores, prefixes if starts
 * with a digit.
 */
function sanitizeId(raw: string): string {
  let result = raw.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_{2,}/g, '_').replace(/^_+|_+$/g, '');
  if (/^\d/.test(result)) {
    result = '_' + result;
  }
  return result;
}

/**
 * Resolve a pin value from a SchematicPin. Falls back to a placeholder comment
 * when no physical pin is assigned.
 */
function pinValue(pin: SchematicPin | undefined): string {
  if (!pin) {
    return '/* UNASSIGNED */';
  }
  if (pin.pin !== undefined) {
    return String(pin.pin);
  }
  return '/* UNASSIGNED */';
}

/**
 * Find a pin by name (case-insensitive) from a component's pin list.
 */
function findPin(pins: readonly SchematicPin[], name: string): SchematicPin | undefined {
  const lower = name.toLowerCase();
  return pins.find((p) => p.name.toLowerCase() === lower);
}

// ---------------------------------------------------------------------------
// COMPONENT_CODE_MAP
// ---------------------------------------------------------------------------

/**
 * Maps component type strings (lowercase-normalised) to Arduino code
 * generation patterns. Each entry describes what includes, globals, setup,
 * and loop code a component type requires.
 */
export const COMPONENT_CODE_MAP: Record<string, ComponentCodeEntry> = {
  led: {
    includes: [],
    globals: (refdes, pins) => {
      const p = findPin(pins, 'anode') ?? pins[0];
      return [`const int PIN_${sanitizeId(refdes).toUpperCase()} = ${pinValue(p)};`];
    },
    setup: (refdes) => [`pinMode(PIN_${sanitizeId(refdes).toUpperCase()}, OUTPUT);`],
    loop: (refdes) => [`digitalWrite(PIN_${sanitizeId(refdes).toUpperCase()}, HIGH);`],
    comment: 'LED — digital output, drive HIGH to light',
  },

  resistor: {
    includes: [],
    globals: () => [],
    setup: () => [],
    loop: () => [],
    comment: 'Resistor — passive, no code needed',
  },

  capacitor: {
    includes: [],
    globals: () => [],
    setup: () => [],
    loop: () => [],
    comment: 'Capacitor — passive, no code needed',
  },

  button: {
    includes: [],
    globals: (refdes, pins) => {
      const p = findPin(pins, 'input') ?? findPin(pins, 'sig') ?? pins[0];
      return [
        `const int PIN_${sanitizeId(refdes).toUpperCase()} = ${pinValue(p)};`,
        `int ${sanitizeId(refdes)}_state = 0;`,
      ];
    },
    setup: (refdes) => [`pinMode(PIN_${sanitizeId(refdes).toUpperCase()}, INPUT_PULLUP);`],
    loop: (refdes) => [
      `${sanitizeId(refdes)}_state = digitalRead(PIN_${sanitizeId(refdes).toUpperCase()});`,
    ],
    comment: 'Button — digital input with internal pullup',
  },

  potentiometer: {
    includes: [],
    globals: (refdes, pins) => {
      const p = findPin(pins, 'wiper') ?? findPin(pins, 'sig') ?? pins[0];
      return [
        `const int PIN_${sanitizeId(refdes).toUpperCase()} = ${pinValue(p)};`,
        `int ${sanitizeId(refdes)}_value = 0;`,
      ];
    },
    setup: () => [],
    loop: (refdes) => [
      `${sanitizeId(refdes)}_value = analogRead(PIN_${sanitizeId(refdes).toUpperCase()});`,
    ],
    comment: 'Potentiometer — analog input (0–1023)',
  },

  servo: {
    includes: ['<Servo.h>'],
    globals: (refdes, pins) => {
      const p = findPin(pins, 'signal') ?? findPin(pins, 'sig') ?? pins[0];
      return [
        `const int PIN_${sanitizeId(refdes).toUpperCase()} = ${pinValue(p)};`,
        `Servo ${sanitizeId(refdes)}_servo;`,
      ];
    },
    setup: (refdes) => [`${sanitizeId(refdes)}_servo.attach(PIN_${sanitizeId(refdes).toUpperCase()});`],
    loop: (refdes) => [`${sanitizeId(refdes)}_servo.write(90); // center position`],
    comment: 'Servo motor — PWM signal, Servo library',
  },

  motor: {
    includes: [],
    globals: (refdes, pins) => {
      const en = findPin(pins, 'enable') ?? findPin(pins, 'en') ?? pins[0];
      const in1 = findPin(pins, 'in1') ?? findPin(pins, 'dir') ?? pins[1];
      return [
        `const int PIN_${sanitizeId(refdes).toUpperCase()}_EN = ${pinValue(en)};`,
        ...(in1 ? [`const int PIN_${sanitizeId(refdes).toUpperCase()}_DIR = ${pinValue(in1)};`] : []),
      ];
    },
    setup: (refdes, pins) => {
      const lines = [`pinMode(PIN_${sanitizeId(refdes).toUpperCase()}_EN, OUTPUT);`];
      const in1 = findPin(pins, 'in1') ?? findPin(pins, 'dir') ?? pins[1];
      if (in1) {
        lines.push(`pinMode(PIN_${sanitizeId(refdes).toUpperCase()}_DIR, OUTPUT);`);
      }
      return lines;
    },
    loop: (refdes) => [`analogWrite(PIN_${sanitizeId(refdes).toUpperCase()}_EN, 128); // 50% speed`],
    comment: 'DC Motor — PWM speed via enable pin',
  },

  buzzer: {
    includes: [],
    globals: (refdes, pins) => {
      const p = findPin(pins, 'signal') ?? findPin(pins, 'sig') ?? pins[0];
      return [`const int PIN_${sanitizeId(refdes).toUpperCase()} = ${pinValue(p)};`];
    },
    setup: (refdes) => [`pinMode(PIN_${sanitizeId(refdes).toUpperCase()}, OUTPUT);`],
    loop: (refdes) => [`tone(PIN_${sanitizeId(refdes).toUpperCase()}, 1000, 100); // 1kHz beep`],
    comment: 'Buzzer — tone output',
  },

  ldr: {
    includes: [],
    globals: (refdes, pins) => {
      const p = findPin(pins, 'sig') ?? findPin(pins, 'anode') ?? pins[0];
      return [
        `const int PIN_${sanitizeId(refdes).toUpperCase()} = ${pinValue(p)};`,
        `int ${sanitizeId(refdes)}_value = 0;`,
      ];
    },
    setup: () => [],
    loop: (refdes) => [
      `${sanitizeId(refdes)}_value = analogRead(PIN_${sanitizeId(refdes).toUpperCase()});`,
    ],
    comment: 'Light-dependent resistor — analog input',
  },

  thermistor: {
    includes: [],
    globals: (refdes, pins) => {
      const p = findPin(pins, 'sig') ?? pins[0];
      return [
        `const int PIN_${sanitizeId(refdes).toUpperCase()} = ${pinValue(p)};`,
        `int ${sanitizeId(refdes)}_raw = 0;`,
      ];
    },
    setup: () => [],
    loop: (refdes) => [
      `${sanitizeId(refdes)}_raw = analogRead(PIN_${sanitizeId(refdes).toUpperCase()});`,
    ],
    comment: 'Thermistor — analog temperature sensing',
  },

  relay: {
    includes: [],
    globals: (refdes, pins) => {
      const p = findPin(pins, 'coil') ?? findPin(pins, 'sig') ?? pins[0];
      return [`const int PIN_${sanitizeId(refdes).toUpperCase()} = ${pinValue(p)};`];
    },
    setup: (refdes) => [
      `pinMode(PIN_${sanitizeId(refdes).toUpperCase()}, OUTPUT);`,
      `digitalWrite(PIN_${sanitizeId(refdes).toUpperCase()}, LOW); // relay off`,
    ],
    loop: () => [],
    comment: 'Relay — digital output, LOW = off',
  },

  lcd_i2c: {
    includes: ['<Wire.h>', '<LiquidCrystal_I2C.h>'],
    globals: (refdes) => [`LiquidCrystal_I2C ${sanitizeId(refdes)}_lcd(0x27, 16, 2);`],
    setup: (refdes) => [
      `${sanitizeId(refdes)}_lcd.init();`,
      `${sanitizeId(refdes)}_lcd.backlight();`,
      `${sanitizeId(refdes)}_lcd.setCursor(0, 0);`,
      `${sanitizeId(refdes)}_lcd.print("ProtoPulse");`,
    ],
    loop: () => [],
    comment: 'I2C LCD — 16x2 display at address 0x27',
  },

  ultrasonic: {
    includes: [],
    globals: (refdes, pins) => {
      const trig = findPin(pins, 'trig') ?? pins[0];
      const echo = findPin(pins, 'echo') ?? pins[1];
      return [
        `const int PIN_${sanitizeId(refdes).toUpperCase()}_TRIG = ${pinValue(trig)};`,
        `const int PIN_${sanitizeId(refdes).toUpperCase()}_ECHO = ${pinValue(echo)};`,
        `long ${sanitizeId(refdes)}_distance = 0;`,
      ];
    },
    setup: (refdes) => [
      `pinMode(PIN_${sanitizeId(refdes).toUpperCase()}_TRIG, OUTPUT);`,
      `pinMode(PIN_${sanitizeId(refdes).toUpperCase()}_ECHO, INPUT);`,
    ],
    loop: (refdes) => [
      `digitalWrite(PIN_${sanitizeId(refdes).toUpperCase()}_TRIG, LOW);`,
      `delayMicroseconds(2);`,
      `digitalWrite(PIN_${sanitizeId(refdes).toUpperCase()}_TRIG, HIGH);`,
      `delayMicroseconds(10);`,
      `digitalWrite(PIN_${sanitizeId(refdes).toUpperCase()}_TRIG, LOW);`,
      `${sanitizeId(refdes)}_distance = pulseIn(PIN_${sanitizeId(refdes).toUpperCase()}_ECHO, HIGH) / 58;`,
    ],
    comment: 'Ultrasonic sensor — HC-SR04 trig/echo distance',
  },

  dht: {
    includes: ['<DHT.h>'],
    globals: (refdes, pins) => {
      const p = findPin(pins, 'data') ?? findPin(pins, 'sig') ?? pins[0];
      return [
        `const int PIN_${sanitizeId(refdes).toUpperCase()} = ${pinValue(p)};`,
        `DHT ${sanitizeId(refdes)}_dht(PIN_${sanitizeId(refdes).toUpperCase()}, DHT11);`,
        `float ${sanitizeId(refdes)}_temp = 0;`,
        `float ${sanitizeId(refdes)}_hum = 0;`,
      ];
    },
    setup: (refdes) => [`${sanitizeId(refdes)}_dht.begin();`],
    loop: (refdes) => [
      `${sanitizeId(refdes)}_temp = ${sanitizeId(refdes)}_dht.readTemperature();`,
      `${sanitizeId(refdes)}_hum = ${sanitizeId(refdes)}_dht.readHumidity();`,
    ],
    comment: 'DHT temperature/humidity sensor',
  },

  ir_receiver: {
    includes: ['<IRremote.h>'],
    globals: (refdes, pins) => {
      const p = findPin(pins, 'sig') ?? findPin(pins, 'data') ?? pins[0];
      return [
        `const int PIN_${sanitizeId(refdes).toUpperCase()} = ${pinValue(p)};`,
        // IRremote 4.x API
      ];
    },
    setup: (refdes) => [
      `IrReceiver.begin(PIN_${sanitizeId(refdes).toUpperCase()}, ENABLE_LED_FEEDBACK);`,
    ],
    loop: (refdes) => [
      `if (IrReceiver.decode()) {`,
      `  // ${sanitizeId(refdes)}: process IrReceiver.decodedIRData`,
      `  IrReceiver.resume();`,
      `}`,
    ],
    comment: 'IR receiver — IRremote library',
  },

  neopixel: {
    includes: ['<Adafruit_NeoPixel.h>'],
    globals: (refdes, pins) => {
      const p = findPin(pins, 'data') ?? findPin(pins, 'sig') ?? pins[0];
      return [
        `const int PIN_${sanitizeId(refdes).toUpperCase()} = ${pinValue(p)};`,
        `const int ${sanitizeId(refdes).toUpperCase()}_COUNT = 8;`,
        `Adafruit_NeoPixel ${sanitizeId(refdes)}_strip(${sanitizeId(refdes).toUpperCase()}_COUNT, PIN_${sanitizeId(refdes).toUpperCase()}, NEO_GRB + NEO_KHZ800);`,
      ];
    },
    setup: (refdes) => [
      `${sanitizeId(refdes)}_strip.begin();`,
      `${sanitizeId(refdes)}_strip.show(); // all off`,
    ],
    loop: () => [],
    comment: 'NeoPixel/WS2812B addressable LED strip',
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Look up the code entry for a component type. Returns undefined for
 * unrecognised types.
 */
export function getComponentInitCode(component: SchematicComponent): {
  includes: readonly string[];
  globals: readonly string[];
  setup: readonly string[];
  loop: readonly string[];
  comment: string;
} | undefined {
  const key = component.type.toLowerCase().replace(/[\s_-]+/g, '_');
  const entry = COMPONENT_CODE_MAP[key];
  if (!entry) {
    return undefined;
  }
  return {
    includes: entry.includes,
    globals: entry.globals(component.refdes, component.pins),
    setup: entry.setup(component.refdes, component.pins),
    loop: entry.loop(component.refdes, component.pins),
    comment: entry.comment,
  };
}

/**
 * Generate a comment line describing how two component pins are wired.
 * This is informational — the physical wiring is on the breadboard/PCB,
 * but the comment helps the user understand the circuit.
 */
export function getConnectionCode(connection: SchematicConnection): string {
  return `// Wire: ${connection.from.refdes}.${connection.from.pin} -> ${connection.to.refdes}.${connection.to.pin}`;
}

/**
 * Generate a full SketchTemplate from a schematic context.
 *
 * @param ctx      The schematic context (components + connections).
 * @param board    Board identifier (default: 'uno').
 * @returns        A structured SketchTemplate ready for formatSketch().
 */
export function generateSketchFromSchematic(
  ctx: SchematicContext,
  board?: string,
): SketchTemplate {
  const boardId = (board ?? 'uno').toLowerCase();
  const boardInfo = BOARD_DEFAULTS[boardId] ?? BOARD_DEFAULTS['uno'];

  const includes = new Set<string>();
  const globals: string[] = [];
  const setupCode: string[] = [];
  const loopCode: string[] = [];
  const comments: string[] = [];

  // Serial init is always first in setup
  setupCode.push(`${boardInfo.serialBegin}.begin(${boardInfo.baudRate});`);

  // Process each component
  for (const comp of ctx.components) {
    const code = getComponentInitCode(comp);
    if (!code) {
      comments.push(`// ${comp.refdes} (${comp.type}): unknown component type — add code manually`);
      continue;
    }

    // Collect includes
    for (const inc of code.includes) {
      includes.add(inc);
    }

    // Collect globals
    if (code.globals.length > 0) {
      globals.push(`// ${comp.refdes} — ${code.comment}`);
      globals.push(...code.globals);
    }

    // Collect setup
    if (code.setup.length > 0) {
      setupCode.push(...code.setup);
    }

    // Collect loop
    if (code.loop.length > 0) {
      loopCode.push(...code.loop);
    }

    // Passive components get a note in comments
    if (code.globals.length === 0 && code.setup.length === 0 && code.loop.length === 0) {
      comments.push(`// ${comp.refdes} (${comp.type}): ${code.comment}`);
    }
  }

  // Process connections as informational comments
  for (const conn of ctx.connections) {
    comments.push(getConnectionCode(conn));
  }

  return {
    board: boardId,
    includes: Array.from(includes).sort(),
    globals,
    setupCode,
    loopCode,
    comments,
  };
}

/**
 * Format a SketchTemplate into a compilable .ino string.
 *
 * Output structure:
 *   1. Header comment (board, generation date)
 *   2. #include directives
 *   3. Wiring/passive comments
 *   4. Global declarations
 *   5. void setup() { ... }
 *   6. void loop() { ... }
 */
export function formatSketch(template: SketchTemplate): string {
  const boardInfo = BOARD_DEFAULTS[template.board] ?? BOARD_DEFAULTS['uno'];
  const lines: string[] = [];

  // Header
  lines.push('// ProtoPulse — Generated Arduino Sketch');
  lines.push(`// Board: ${boardInfo.label}`);
  lines.push(`// Generated: ${new Date().toISOString().split('T')[0]}`);
  lines.push('');

  // Includes
  if (template.includes.length > 0) {
    for (const inc of template.includes) {
      lines.push(`#include ${inc}`);
    }
    lines.push('');
  }

  // Wiring / passive comments
  if (template.comments.length > 0) {
    for (const c of template.comments) {
      lines.push(c);
    }
    lines.push('');
  }

  // Globals
  if (template.globals.length > 0) {
    for (const g of template.globals) {
      lines.push(g);
    }
    lines.push('');
  }

  // setup()
  lines.push('void setup() {');
  for (const s of template.setupCode) {
    lines.push(`  ${s}`);
  }
  lines.push('}');
  lines.push('');

  // loop()
  lines.push('void loop() {');
  if (template.loopCode.length > 0) {
    for (const l of template.loopCode) {
      lines.push(`  ${l}`);
    }
  } else {
    lines.push('  // No loop actions generated — add your logic here');
  }
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}
