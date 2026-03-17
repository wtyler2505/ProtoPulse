import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  generateSketchFromSchematic,
  formatSketch,
  getComponentInitCode,
  getConnectionCode,
  COMPONENT_CODE_MAP,
} from '../sketch-starter';
import type {
  SchematicContext,
  SchematicComponent,
  SchematicConnection,
  SketchTemplate,
} from '../sketch-starter';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeComponent(type: string, refdes: string, pins: { name: string; pin?: number | string }[] = []): SchematicComponent {
  return { type, refdes, pins };
}

function makeConnection(fromRefdes: string, fromPin: string, toRefdes: string, toPin: string): SchematicConnection {
  return { from: { refdes: fromRefdes, pin: fromPin }, to: { refdes: toRefdes, pin: toPin } };
}

function makeCtx(
  components: SchematicComponent[] = [],
  connections: SchematicConnection[] = [],
): SchematicContext {
  return { components, connections };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sketch-starter', () => {
  // Freeze Date for deterministic header output
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-17T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // COMPONENT_CODE_MAP coverage
  // -----------------------------------------------------------------------

  describe('COMPONENT_CODE_MAP', () => {
    it('contains entries for all documented component types', () => {
      const expectedTypes = [
        'led', 'resistor', 'capacitor', 'button', 'potentiometer', 'servo',
        'motor', 'buzzer', 'ldr', 'thermistor', 'relay', 'lcd_i2c',
        'ultrasonic', 'dht', 'ir_receiver', 'neopixel',
      ];
      for (const t of expectedTypes) {
        expect(COMPONENT_CODE_MAP[t]).toBeDefined();
      }
    });

    it('passive components (resistor, capacitor) produce empty code arrays', () => {
      for (const type of ['resistor', 'capacitor']) {
        const entry = COMPONENT_CODE_MAP[type];
        expect(entry.includes).toHaveLength(0);
        expect(entry.globals('R1', [])).toHaveLength(0);
        expect(entry.setup('R1', [])).toHaveLength(0);
        expect(entry.loop('R1', [])).toHaveLength(0);
      }
    });

    it('servo entry requires Servo.h include', () => {
      expect(COMPONENT_CODE_MAP['servo'].includes).toContain('<Servo.h>');
    });

    it('dht entry requires DHT.h include', () => {
      expect(COMPONENT_CODE_MAP['dht'].includes).toContain('<DHT.h>');
    });

    it('neopixel entry requires Adafruit_NeoPixel.h', () => {
      expect(COMPONENT_CODE_MAP['neopixel'].includes).toContain('<Adafruit_NeoPixel.h>');
    });

    it('lcd_i2c entry requires Wire.h and LiquidCrystal_I2C.h', () => {
      const inc = COMPONENT_CODE_MAP['lcd_i2c'].includes;
      expect(inc).toContain('<Wire.h>');
      expect(inc).toContain('<LiquidCrystal_I2C.h>');
    });

    it('ir_receiver entry requires IRremote.h', () => {
      expect(COMPONENT_CODE_MAP['ir_receiver'].includes).toContain('<IRremote.h>');
    });
  });

  // -----------------------------------------------------------------------
  // getComponentInitCode
  // -----------------------------------------------------------------------

  describe('getComponentInitCode', () => {
    it('returns undefined for unknown component types', () => {
      const comp = makeComponent('flux_capacitor', 'U99');
      expect(getComponentInitCode(comp)).toBeUndefined();
    });

    it('returns code for a known type (LED)', () => {
      const comp = makeComponent('led', 'D1', [{ name: 'anode', pin: 13 }]);
      const code = getComponentInitCode(comp);
      expect(code).toBeDefined();
      expect(code!.globals.some((g) => g.includes('PIN_D1'))).toBe(true);
      expect(code!.setup.some((s) => s.includes('pinMode'))).toBe(true);
      expect(code!.loop.some((l) => l.includes('digitalWrite'))).toBe(true);
    });

    it('normalises type with hyphens/spaces/underscores', () => {
      // 'LCD I2C' should map to 'lcd_i2c'
      const comp = makeComponent('LCD I2C', 'LCD1', [{ name: 'sda', pin: 20 }]);
      const code = getComponentInitCode(comp);
      expect(code).toBeDefined();
      expect(code!.includes).toContain('<Wire.h>');
    });

    it('uses fallback pin when no matching pin name is found', () => {
      const comp = makeComponent('led', 'D2', [{ name: 'pin1', pin: 7 }]);
      const code = getComponentInitCode(comp);
      expect(code).toBeDefined();
      expect(code!.globals.some((g) => g.includes('7'))).toBe(true);
    });

    it('inserts UNASSIGNED placeholder when pin has no physical assignment', () => {
      const comp = makeComponent('led', 'D3', [{ name: 'anode' }]);
      const code = getComponentInitCode(comp);
      expect(code).toBeDefined();
      expect(code!.globals.some((g) => g.includes('UNASSIGNED'))).toBe(true);
    });

    it('handles button with INPUT_PULLUP', () => {
      const comp = makeComponent('button', 'SW1', [{ name: 'input', pin: 2 }]);
      const code = getComponentInitCode(comp);
      expect(code).toBeDefined();
      expect(code!.setup.some((s) => s.includes('INPUT_PULLUP'))).toBe(true);
      expect(code!.loop.some((l) => l.includes('digitalRead'))).toBe(true);
    });

    it('handles potentiometer with analogRead', () => {
      const comp = makeComponent('potentiometer', 'POT1', [{ name: 'wiper', pin: 'A0' }]);
      const code = getComponentInitCode(comp);
      expect(code).toBeDefined();
      expect(code!.loop.some((l) => l.includes('analogRead'))).toBe(true);
    });

    it('handles ultrasonic with trig and echo pins', () => {
      const comp = makeComponent('ultrasonic', 'US1', [
        { name: 'trig', pin: 9 },
        { name: 'echo', pin: 10 },
      ]);
      const code = getComponentInitCode(comp);
      expect(code).toBeDefined();
      expect(code!.globals.some((g) => g.includes('TRIG'))).toBe(true);
      expect(code!.globals.some((g) => g.includes('ECHO'))).toBe(true);
      expect(code!.loop.some((l) => l.includes('pulseIn'))).toBe(true);
    });

    it('handles motor with enable and direction pins', () => {
      const comp = makeComponent('motor', 'M1', [
        { name: 'enable', pin: 5 },
        { name: 'in1', pin: 6 },
      ]);
      const code = getComponentInitCode(comp);
      expect(code).toBeDefined();
      expect(code!.globals.some((g) => g.includes('_EN'))).toBe(true);
      expect(code!.globals.some((g) => g.includes('_DIR'))).toBe(true);
      expect(code!.loop.some((l) => l.includes('analogWrite'))).toBe(true);
    });

    it('handles relay with default-off init', () => {
      const comp = makeComponent('relay', 'K1', [{ name: 'coil', pin: 4 }]);
      const code = getComponentInitCode(comp);
      expect(code).toBeDefined();
      expect(code!.setup.some((s) => s.includes('LOW'))).toBe(true);
    });

    it('handles DHT sensor with begin() in setup', () => {
      const comp = makeComponent('dht', 'DHT1', [{ name: 'data', pin: 7 }]);
      const code = getComponentInitCode(comp);
      expect(code).toBeDefined();
      expect(code!.setup.some((s) => s.includes('.begin()'))).toBe(true);
      expect(code!.loop.some((l) => l.includes('readTemperature'))).toBe(true);
      expect(code!.loop.some((l) => l.includes('readHumidity'))).toBe(true);
    });

    it('handles neopixel strip init', () => {
      const comp = makeComponent('neopixel', 'LED1', [{ name: 'data', pin: 6 }]);
      const code = getComponentInitCode(comp);
      expect(code).toBeDefined();
      expect(code!.setup.some((s) => s.includes('.begin()'))).toBe(true);
      expect(code!.setup.some((s) => s.includes('.show()'))).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // getConnectionCode
  // -----------------------------------------------------------------------

  describe('getConnectionCode', () => {
    it('returns a comment describing the connection', () => {
      const conn = makeConnection('R1', 'pin1', 'D1', 'anode');
      const result = getConnectionCode(conn);
      expect(result).toBe('// Wire: R1.pin1 -> D1.anode');
    });

    it('handles complex refdes names', () => {
      const conn = makeConnection('IC3', 'OUT', 'LED_STRIP', 'DIN');
      expect(getConnectionCode(conn)).toBe('// Wire: IC3.OUT -> LED_STRIP.DIN');
    });
  });

  // -----------------------------------------------------------------------
  // generateSketchFromSchematic
  // -----------------------------------------------------------------------

  describe('generateSketchFromSchematic', () => {
    it('returns a valid SketchTemplate for an empty context', () => {
      const tmpl = generateSketchFromSchematic(makeCtx());
      expect(tmpl.board).toBe('uno');
      expect(tmpl.includes).toHaveLength(0);
      expect(tmpl.globals).toHaveLength(0);
      expect(tmpl.setupCode).toHaveLength(1); // Serial.begin
      expect(tmpl.loopCode).toHaveLength(0);
      expect(tmpl.comments).toHaveLength(0);
    });

    it('defaults board to uno when not specified', () => {
      const tmpl = generateSketchFromSchematic(makeCtx());
      expect(tmpl.board).toBe('uno');
    });

    it('accepts custom board identifier', () => {
      const tmpl = generateSketchFromSchematic(makeCtx(), 'mega');
      expect(tmpl.board).toBe('mega');
    });

    it('falls back to uno for unknown board', () => {
      const ctx = makeCtx([makeComponent('led', 'D1', [{ name: 'anode', pin: 13 }])]);
      const tmpl = generateSketchFromSchematic(ctx, 'unknown_board_xyz');
      // Should still produce valid output (falls back to uno defaults)
      expect(tmpl.setupCode[0]).toContain('Serial.begin(9600)');
    });

    it('uses 115200 baud for esp32', () => {
      const ctx = makeCtx([makeComponent('led', 'D1', [{ name: 'anode', pin: 13 }])]);
      const tmpl = generateSketchFromSchematic(ctx, 'esp32');
      expect(tmpl.setupCode[0]).toContain('115200');
    });

    it('collects includes from multiple components', () => {
      const ctx = makeCtx([
        makeComponent('servo', 'SRV1', [{ name: 'signal', pin: 9 }]),
        makeComponent('dht', 'DHT1', [{ name: 'data', pin: 7 }]),
      ]);
      const tmpl = generateSketchFromSchematic(ctx);
      expect(tmpl.includes).toContain('<Servo.h>');
      expect(tmpl.includes).toContain('<DHT.h>');
    });

    it('deduplicates includes when multiple components need the same library', () => {
      const ctx = makeCtx([
        makeComponent('servo', 'SRV1', [{ name: 'signal', pin: 9 }]),
        makeComponent('servo', 'SRV2', [{ name: 'signal', pin: 10 }]),
      ]);
      const tmpl = generateSketchFromSchematic(ctx);
      const servoIncludes = tmpl.includes.filter((i) => i === '<Servo.h>');
      expect(servoIncludes).toHaveLength(1);
    });

    it('puts Serial.begin as first setup line', () => {
      const ctx = makeCtx([makeComponent('led', 'D1', [{ name: 'anode', pin: 13 }])]);
      const tmpl = generateSketchFromSchematic(ctx);
      expect(tmpl.setupCode[0]).toContain('Serial.begin');
    });

    it('adds comments for passive components', () => {
      const ctx = makeCtx([
        makeComponent('resistor', 'R1', [{ name: 'pin1', pin: 2 }]),
        makeComponent('capacitor', 'C1', [{ name: 'pin1', pin: 3 }]),
      ]);
      const tmpl = generateSketchFromSchematic(ctx);
      expect(tmpl.comments.some((c) => c.includes('R1') && c.includes('passive'))).toBe(true);
      expect(tmpl.comments.some((c) => c.includes('C1') && c.includes('passive'))).toBe(true);
    });

    it('adds comments for unknown component types', () => {
      const ctx = makeCtx([makeComponent('quantum_entangler', 'QE1')]);
      const tmpl = generateSketchFromSchematic(ctx);
      expect(tmpl.comments.some((c) => c.includes('QE1') && c.includes('unknown'))).toBe(true);
    });

    it('adds connection comments', () => {
      const ctx = makeCtx([], [makeConnection('R1', 'pin1', 'D1', 'anode')]);
      const tmpl = generateSketchFromSchematic(ctx);
      expect(tmpl.comments.some((c) => c.includes('R1.pin1') && c.includes('D1.anode'))).toBe(true);
    });

    it('generates globals with component comment headers', () => {
      const ctx = makeCtx([makeComponent('led', 'D1', [{ name: 'anode', pin: 13 }])]);
      const tmpl = generateSketchFromSchematic(ctx);
      expect(tmpl.globals.some((g) => g.includes('// D1'))).toBe(true);
    });

    it('handles a realistic multi-component circuit', () => {
      const ctx = makeCtx(
        [
          makeComponent('button', 'SW1', [{ name: 'input', pin: 2 }]),
          makeComponent('led', 'D1', [{ name: 'anode', pin: 13 }]),
          makeComponent('resistor', 'R1', [{ name: 'pin1' }, { name: 'pin2' }]),
          makeComponent('buzzer', 'BZ1', [{ name: 'signal', pin: 8 }]),
        ],
        [
          makeConnection('SW1', 'input', 'R1', 'pin1'),
          makeConnection('R1', 'pin2', 'D1', 'anode'),
        ],
      );
      const tmpl = generateSketchFromSchematic(ctx);
      expect(tmpl.globals.length).toBeGreaterThan(0);
      expect(tmpl.setupCode.length).toBeGreaterThan(1); // Serial + pinModes
      expect(tmpl.loopCode.length).toBeGreaterThan(0); // digitalRead + digitalWrite + tone
      expect(tmpl.comments.length).toBeGreaterThan(0); // R1 passive + connections
    });
  });

  // -----------------------------------------------------------------------
  // formatSketch
  // -----------------------------------------------------------------------

  describe('formatSketch', () => {
    it('produces a string with header, setup, and loop', () => {
      const tmpl: SketchTemplate = {
        board: 'uno',
        includes: [],
        globals: [],
        setupCode: ['Serial.begin(9600);'],
        loopCode: [],
        comments: [],
      };
      const output = formatSketch(tmpl);
      expect(output).toContain('// ProtoPulse');
      expect(output).toContain('Arduino Uno');
      expect(output).toContain('void setup()');
      expect(output).toContain('Serial.begin(9600)');
      expect(output).toContain('void loop()');
    });

    it('includes the generation date in the header', () => {
      const tmpl: SketchTemplate = {
        board: 'uno',
        includes: [],
        globals: [],
        setupCode: ['Serial.begin(9600);'],
        loopCode: [],
        comments: [],
      };
      const output = formatSketch(tmpl);
      expect(output).toContain('2026-03-17');
    });

    it('emits #include directives', () => {
      const tmpl: SketchTemplate = {
        board: 'uno',
        includes: ['<Servo.h>', '<DHT.h>'],
        globals: [],
        setupCode: ['Serial.begin(9600);'],
        loopCode: [],
        comments: [],
      };
      const output = formatSketch(tmpl);
      expect(output).toContain('#include <Servo.h>');
      expect(output).toContain('#include <DHT.h>');
    });

    it('indents setup code with 2 spaces', () => {
      const tmpl: SketchTemplate = {
        board: 'uno',
        includes: [],
        globals: [],
        setupCode: ['Serial.begin(9600);', 'pinMode(13, OUTPUT);'],
        loopCode: [],
        comments: [],
      };
      const output = formatSketch(tmpl);
      const lines = output.split('\n');
      const setupIdx = lines.findIndex((l) => l.startsWith('void setup()'));
      expect(lines[setupIdx + 1]).toBe('  Serial.begin(9600);');
      expect(lines[setupIdx + 2]).toBe('  pinMode(13, OUTPUT);');
    });

    it('indents loop code with 2 spaces', () => {
      const tmpl: SketchTemplate = {
        board: 'uno',
        includes: [],
        globals: [],
        setupCode: ['Serial.begin(9600);'],
        loopCode: ['digitalWrite(13, HIGH);'],
        comments: [],
      };
      const output = formatSketch(tmpl);
      const lines = output.split('\n');
      const loopIdx = lines.findIndex((l) => l.startsWith('void loop()'));
      expect(lines[loopIdx + 1]).toBe('  digitalWrite(13, HIGH);');
    });

    it('adds placeholder comment when loop is empty', () => {
      const tmpl: SketchTemplate = {
        board: 'uno',
        includes: [],
        globals: [],
        setupCode: ['Serial.begin(9600);'],
        loopCode: [],
        comments: [],
      };
      const output = formatSketch(tmpl);
      expect(output).toContain('add your logic here');
    });

    it('emits global declarations before setup', () => {
      const tmpl: SketchTemplate = {
        board: 'uno',
        includes: [],
        globals: ['const int PIN_D1 = 13;'],
        setupCode: ['Serial.begin(9600);'],
        loopCode: [],
        comments: [],
      };
      const output = formatSketch(tmpl);
      const globIdx = output.indexOf('PIN_D1');
      const setupIdx = output.indexOf('void setup()');
      expect(globIdx).toBeLessThan(setupIdx);
    });

    it('shows board label for mega', () => {
      const tmpl: SketchTemplate = {
        board: 'mega',
        includes: [],
        globals: [],
        setupCode: ['Serial.begin(9600);'],
        loopCode: [],
        comments: [],
      };
      const output = formatSketch(tmpl);
      expect(output).toContain('Arduino Mega 2560');
    });

    it('shows board label for esp32', () => {
      const tmpl: SketchTemplate = {
        board: 'esp32',
        includes: [],
        globals: [],
        setupCode: ['Serial.begin(115200);'],
        loopCode: [],
        comments: [],
      };
      const output = formatSketch(tmpl);
      expect(output).toContain('ESP32 DevKit');
    });

    it('end-to-end: generates compilable-looking .ino from a schematic', () => {
      const ctx = makeCtx(
        [
          makeComponent('led', 'D1', [{ name: 'anode', pin: 13 }]),
          makeComponent('button', 'SW1', [{ name: 'input', pin: 2 }]),
          makeComponent('resistor', 'R1', [{ name: 'pin1' }]),
        ],
        [makeConnection('SW1', 'input', 'R1', 'pin1')],
      );
      const tmpl = generateSketchFromSchematic(ctx, 'nano');
      const output = formatSketch(tmpl);

      // Structural checks
      expect(output).toContain('void setup() {');
      expect(output).toContain('void loop() {');
      expect(output).toContain('PIN_D1');
      expect(output).toContain('PIN_SW1');
      expect(output).toContain('Serial.begin(9600)');
      expect(output).toContain('pinMode');
      expect(output).toContain('digitalRead');
      expect(output).toContain('digitalWrite');
      // Ends with newline
      expect(output.endsWith('\n')).toBe(true);
    });
  });
});
