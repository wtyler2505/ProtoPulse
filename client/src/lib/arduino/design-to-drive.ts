// ---------------------------------------------------------------------------
// BL-0465 — Design-to-Drive Mode
// ---------------------------------------------------------------------------
// DesignToDriveManager: singleton that infers pin mappings from schematic
// circuit instances, generates test firmware sketches for common test modes
// (blink, io_scan, sensor_read, motor_test, serial_echo, comprehensive).
// Component-to-test mapping determines which tests are relevant based on
// component types found in the schematic.
//
// Singleton+subscribe pattern for useSyncExternalStore compatibility.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = () => void;

/** Supported test modes for firmware generation. */
export type TestMode =
  | 'blink'
  | 'io_scan'
  | 'sensor_read'
  | 'motor_test'
  | 'serial_echo'
  | 'comprehensive';

/** A pin mapping inferred from a schematic instance. */
export interface PinMapping {
  /** Pin number or analog identifier (e.g. "13", "A0"). */
  pin: string;
  /** Human-readable label (e.g. "LED_BUILTIN", "MOTOR_PWM"). */
  label: string;
  /** Direction inferred from context. */
  direction: 'input' | 'output' | 'bidirectional';
  /** Component type that owns this pin. */
  componentType: ComponentCategory;
  /** Reference designator of the owning instance. */
  refDes: string;
  /** Optional net name this pin is connected to. */
  netName?: string;
}

/** Categories of components relevant to test generation. */
export type ComponentCategory =
  | 'led'
  | 'resistor'
  | 'capacitor'
  | 'motor'
  | 'sensor'
  | 'switch'
  | 'relay'
  | 'display'
  | 'communication'
  | 'mcu'
  | 'regulator'
  | 'unknown';

/** A simplified schematic instance for pin inference. */
export interface SchematicInstance {
  /** Reference designator (e.g. "R1", "U1", "LED1"). */
  refDes: string;
  /** Component label/name. */
  label: string;
  /** Properties bag (may contain packageType, value, pins, etc.). */
  properties: Record<string, unknown>;
  /** Connected net names (optional — used for mapping). */
  connectedNets?: string[];
}

/** A net from the circuit design. */
export interface CircuitNet {
  name: string;
  netType: string;
  voltage?: string | null;
}

/** Configuration for test firmware generation. */
export interface FirmwareConfig {
  /** Board type for pin numbering context. */
  boardType: BoardType;
  /** Baud rate for Serial.begin(). Default 9600. */
  baudRate: number;
  /** Delay between test iterations in ms. Default 1000. */
  delayMs: number;
  /** Whether to include verbose serial reporting. Default true. */
  verboseSerial: boolean;
  /** Custom header comment. */
  headerComment?: string;
}

/** Supported board types for pin-mapping context. */
export type BoardType =
  | 'arduino_uno'
  | 'arduino_mega'
  | 'arduino_nano'
  | 'esp32'
  | 'esp8266'
  | 'raspberry_pi_pico'
  | 'generic';

/** Generated firmware sketch result. */
export interface GeneratedFirmware {
  /** The Arduino sketch source code. */
  sketch: string;
  /** The test mode used. */
  mode: TestMode;
  /** Pin mappings used in generation. */
  pinMappings: PinMapping[];
  /** Suggested filename. */
  filename: string;
  /** Human-readable summary of what the sketch does. */
  summary: string;
  /** Warnings/notes about the generation. */
  warnings: string[];
}

/** Snapshot of the manager state for useSyncExternalStore. */
export interface DesignToDriveSnapshot {
  /** Inferred pin mappings from the last analysis. */
  pinMappings: PinMapping[];
  /** Available test modes for the current design. */
  availableModes: TestMode[];
  /** Last generated firmware (null if none). */
  lastGenerated: GeneratedFirmware | null;
  /** Current config. */
  config: FirmwareConfig;
  /** Number of instances analyzed. */
  instanceCount: number;
}

// ---------------------------------------------------------------------------
// Board pin databases
// ---------------------------------------------------------------------------

/** Board-specific information for pin count and analog pins. */
export interface BoardPinInfo {
  digitalPinCount: number;
  analogPins: string[];
  pwmPins: number[];
  defaultLedPin: number;
}

export const BOARD_PIN_INFO: Record<BoardType, BoardPinInfo> = {
  arduino_uno: {
    digitalPinCount: 14,
    analogPins: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'],
    pwmPins: [3, 5, 6, 9, 10, 11],
    defaultLedPin: 13,
  },
  arduino_mega: {
    digitalPinCount: 54,
    analogPins: Array.from({ length: 16 }, (_, i) => `A${i}`),
    pwmPins: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    defaultLedPin: 13,
  },
  arduino_nano: {
    digitalPinCount: 14,
    analogPins: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'],
    pwmPins: [3, 5, 6, 9, 10, 11],
    defaultLedPin: 13,
  },
  esp32: {
    digitalPinCount: 40,
    analogPins: Array.from({ length: 18 }, (_, i) => `A${i}`),
    pwmPins: Array.from({ length: 16 }, (_, i) => i),
    defaultLedPin: 2,
  },
  esp8266: {
    digitalPinCount: 17,
    analogPins: ['A0'],
    pwmPins: [0, 2, 4, 5, 12, 13, 14, 15],
    defaultLedPin: 2,
  },
  raspberry_pi_pico: {
    digitalPinCount: 29,
    analogPins: ['A0', 'A1', 'A2', 'A3'],
    pwmPins: Array.from({ length: 16 }, (_, i) => i),
    defaultLedPin: 25,
  },
  generic: {
    digitalPinCount: 20,
    analogPins: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'],
    pwmPins: [3, 5, 6, 9, 10, 11],
    defaultLedPin: 13,
  },
};

// ---------------------------------------------------------------------------
// Component classification
// ---------------------------------------------------------------------------

/** Rules for classifying components by reference designator prefix and label keywords. */
const REFDES_CATEGORY_MAP: Array<{ prefix: string; category: ComponentCategory }> = [
  { prefix: 'LED', category: 'led' },
  { prefix: 'D', category: 'led' },
  { prefix: 'R', category: 'resistor' },
  { prefix: 'C', category: 'capacitor' },
  { prefix: 'M', category: 'motor' },
  { prefix: 'MOT', category: 'motor' },
  { prefix: 'SW', category: 'switch' },
  { prefix: 'BTN', category: 'switch' },
  { prefix: 'K', category: 'relay' },
  { prefix: 'RLY', category: 'relay' },
  { prefix: 'DISP', category: 'display' },
  { prefix: 'LCD', category: 'display' },
  { prefix: 'OLED', category: 'display' },
  { prefix: 'U', category: 'mcu' },
  { prefix: 'IC', category: 'mcu' },
  { prefix: 'VR', category: 'regulator' },
  { prefix: 'REG', category: 'regulator' },
];

const LABEL_CATEGORY_KEYWORDS: Array<{ keyword: string; category: ComponentCategory }> = [
  // More-specific keywords must appear before less-specific ones
  // (e.g. "oled" before "led", "stepper" before generic "motor")
  { keyword: 'oled', category: 'display' },
  { keyword: 'led', category: 'led' },
  { keyword: 'stepper', category: 'motor' },
  { keyword: 'motor', category: 'motor' },
  { keyword: 'servo', category: 'motor' },
  { keyword: 'stepper', category: 'motor' },
  { keyword: 'sensor', category: 'sensor' },
  { keyword: 'temp', category: 'sensor' },
  { keyword: 'humid', category: 'sensor' },
  { keyword: 'accel', category: 'sensor' },
  { keyword: 'gyro', category: 'sensor' },
  { keyword: 'ultrasonic', category: 'sensor' },
  { keyword: 'ir', category: 'sensor' },
  { keyword: 'photo', category: 'sensor' },
  { keyword: 'ldr', category: 'sensor' },
  { keyword: 'pir', category: 'sensor' },
  { keyword: 'bme', category: 'sensor' },
  { keyword: 'bmp', category: 'sensor' },
  { keyword: 'dht', category: 'sensor' },
  { keyword: 'mpu', category: 'sensor' },
  { keyword: 'switch', category: 'switch' },
  { keyword: 'button', category: 'switch' },
  { keyword: 'relay', category: 'relay' },
  { keyword: 'display', category: 'display' },
  { keyword: 'lcd', category: 'display' },
  { keyword: 'oled', category: 'display' },
  { keyword: 'screen', category: 'display' },
  { keyword: 'uart', category: 'communication' },
  { keyword: 'spi', category: 'communication' },
  { keyword: 'i2c', category: 'communication' },
  { keyword: 'bluetooth', category: 'communication' },
  { keyword: 'wifi', category: 'communication' },
  { keyword: 'lora', category: 'communication' },
  { keyword: 'xbee', category: 'communication' },
  { keyword: 'arduino', category: 'mcu' },
  { keyword: 'esp32', category: 'mcu' },
  { keyword: 'esp8266', category: 'mcu' },
  { keyword: 'atmega', category: 'mcu' },
  { keyword: 'regulator', category: 'regulator' },
  { keyword: 'lm7805', category: 'regulator' },
  { keyword: 'ams1117', category: 'regulator' },
];

/** Component categories that map to specific test modes. */
export const COMPONENT_TEST_MAP: Record<ComponentCategory, TestMode[]> = {
  led: ['blink', 'io_scan'],
  resistor: ['io_scan'],
  capacitor: [],
  motor: ['motor_test', 'io_scan'],
  sensor: ['sensor_read', 'io_scan'],
  switch: ['io_scan', 'sensor_read'],
  relay: ['io_scan', 'blink'],
  display: ['serial_echo', 'io_scan'],
  communication: ['serial_echo'],
  mcu: ['serial_echo', 'blink'],
  regulator: [],
  unknown: ['io_scan'],
};

// ---------------------------------------------------------------------------
// Classification helpers
// ---------------------------------------------------------------------------

/**
 * Classify a schematic instance into a component category.
 */
export function classifyComponent(instance: SchematicInstance): ComponentCategory {
  const refUpper = instance.refDes.toUpperCase();
  const labelLower = instance.label.toLowerCase();

  // 1. Check label keywords first (more specific)
  for (const { keyword, category } of LABEL_CATEGORY_KEYWORDS) {
    if (labelLower.includes(keyword)) {
      return category;
    }
  }

  // 2. Check ref-des prefix
  // Sort by longest prefix first so "MOT" matches before "M"
  const sorted = [...REFDES_CATEGORY_MAP].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const { prefix, category } of sorted) {
    if (refUpper.startsWith(prefix)) {
      return category;
    }
  }

  // 3. Check properties
  const props = instance.properties;
  if (typeof props.type === 'string') {
    const typeStr = props.type.toLowerCase();
    for (const { keyword, category } of LABEL_CATEGORY_KEYWORDS) {
      if (typeStr.includes(keyword)) {
        return category;
      }
    }
  }

  return 'unknown';
}

/**
 * Infer pin direction from component category and net context.
 */
export function inferPinDirection(
  category: ComponentCategory,
  netName?: string,
): 'input' | 'output' | 'bidirectional' {
  // Outputs
  if (category === 'led' || category === 'motor' || category === 'relay' || category === 'display') {
    return 'output';
  }
  // Inputs
  if (category === 'sensor' || category === 'switch') {
    return 'input';
  }
  // Bidirectional
  if (category === 'communication') {
    return 'bidirectional';
  }
  // Net-name heuristic
  if (netName) {
    const lower = netName.toLowerCase();
    if (lower.includes('out') || lower.includes('tx') || lower.includes('pwm')) {
      return 'output';
    }
    if (lower.includes('in') || lower.includes('rx') || lower.includes('adc')) {
      return 'input';
    }
  }
  return 'bidirectional';
}

/**
 * Extract pin mappings from a list of schematic instances.
 */
export function inferPinMappings(
  instances: SchematicInstance[],
  nets: CircuitNet[],
  boardType: BoardType,
): PinMapping[] {
  const mappings: PinMapping[] = [];
  const boardInfo = BOARD_PIN_INFO[boardType];
  const usedPins = new Set<string>(); // Track assigned pins to avoid collisions
  let nextDigitalPin = 2; // Start after TX/RX (0, 1)
  let nextAnalogIdx = 0;

  /** Advance nextDigitalPin past any already-used pins. */
  const advanceDigital = (): void => {
    while (usedPins.has(String(nextDigitalPin)) && nextDigitalPin < boardInfo.digitalPinCount) {
      nextDigitalPin++;
    }
  };

  for (const inst of instances) {
    const category = classifyComponent(inst);

    // Skip passive/internal components that don't need direct pin mapping
    if (category === 'capacitor' || category === 'regulator') {
      continue;
    }

    // Determine pin from properties or assign next available
    const props = inst.properties;
    let pin: string;

    if (typeof props.pin === 'string' || typeof props.pin === 'number') {
      pin = String(props.pin);
    } else if (typeof props.pinNumber === 'string' || typeof props.pinNumber === 'number') {
      pin = String(props.pinNumber);
    } else if (category === 'sensor' && nextAnalogIdx < boardInfo.analogPins.length) {
      // Sensors default to analog pins
      pin = boardInfo.analogPins[nextAnalogIdx];
      nextAnalogIdx++;
    } else if (category === 'motor' && boardInfo.pwmPins.length > 0) {
      // Motors default to PWM pins — pick first unused PWM pin
      const pwmCandidates = boardInfo.pwmPins.filter((p) => !usedPins.has(String(p)));
      if (pwmCandidates.length > 0) {
        pin = String(pwmCandidates[0]);
      } else {
        advanceDigital();
        pin = String(Math.min(nextDigitalPin, boardInfo.digitalPinCount - 1));
        nextDigitalPin++;
      }
    } else if (category === 'led' && !usedPins.has(String(boardInfo.defaultLedPin))) {
      pin = String(boardInfo.defaultLedPin);
    } else {
      advanceDigital();
      pin = String(Math.min(nextDigitalPin, boardInfo.digitalPinCount - 1));
      nextDigitalPin++;
    }

    usedPins.add(pin);

    // Build label
    const label = sanitizeLabel(inst.refDes, inst.label, category);
    const direction = inferPinDirection(category, inst.connectedNets?.[0]);

    // Find connected net name
    const netName = inst.connectedNets?.[0] ?? undefined;

    mappings.push({
      pin,
      label,
      direction,
      componentType: category,
      refDes: inst.refDes,
      netName,
    });
  }

  return mappings;
}

/**
 * Create a C-safe label from ref-des and component label.
 */
export function sanitizeLabel(refDes: string, label: string, category: ComponentCategory): string {
  // Prefer a meaningful label; fall back to generic category + refDes
  let raw = label.trim();
  if (!raw || raw.toLowerCase() === refDes.toLowerCase()) {
    raw = `${category}_${refDes}`;
  }

  // Convert to upper-snake-case, remove non-alphanumeric
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 32)
    || `PIN_${refDes.toUpperCase()}`;
}

/**
 * Determine which test modes are available given a set of pin mappings.
 */
export function getAvailableModes(mappings: PinMapping[]): TestMode[] {
  const modeSet = new Set<TestMode>();

  // serial_echo and comprehensive are always available
  modeSet.add('serial_echo');
  modeSet.add('comprehensive');
  modeSet.add('io_scan');

  for (const m of mappings) {
    const tests = COMPONENT_TEST_MAP[m.componentType];
    for (const t of tests) {
      modeSet.add(t);
    }
  }

  // Stable ordering
  const ORDER: TestMode[] = ['blink', 'io_scan', 'sensor_read', 'motor_test', 'serial_echo', 'comprehensive'];
  return ORDER.filter((m) => modeSet.has(m));
}

// ---------------------------------------------------------------------------
// Firmware code generators
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: FirmwareConfig = {
  boardType: 'arduino_uno',
  baudRate: 9600,
  delayMs: 1000,
  verboseSerial: true,
};

function generateHeader(config: FirmwareConfig, mode: TestMode): string {
  const lines: string[] = [];
  lines.push('// ═══════════════════════════════════════════════════════════════');
  lines.push(`// ProtoPulse Design-to-Drive — ${mode.toUpperCase()} Test`);
  lines.push('// Auto-generated firmware for hardware validation');
  if (config.headerComment) {
    lines.push(`// ${config.headerComment}`);
  }
  lines.push('// ═══════════════════════════════════════════════════════════════');
  lines.push('');
  return lines.join('\n');
}

function generatePinDefines(mappings: PinMapping[]): string {
  if (mappings.length === 0) {
    return '// No pin mappings inferred from schematic\n';
  }
  const lines: string[] = ['// --- Pin Definitions ---'];
  for (const m of mappings) {
    const comment = ` // ${m.refDes} (${m.componentType}, ${m.direction})`;
    const pinValue = /^A\d+$/.test(m.pin) ? m.pin : m.pin;
    lines.push(`#define PIN_${m.label} ${pinValue}${comment}`);
  }
  lines.push('');
  return lines.join('\n');
}

function generateBlink(mappings: PinMapping[], config: FirmwareConfig): string {
  const leds = mappings.filter((m) => m.componentType === 'led' || m.direction === 'output');
  const target = leds.length > 0 ? leds[0] : null;
  const pinRef = target ? `PIN_${target.label}` : String(BOARD_PIN_INFO[config.boardType].defaultLedPin);

  const lines: string[] = [];
  lines.push('void setup() {');
  lines.push(`  Serial.begin(${config.baudRate});`);
  lines.push(`  pinMode(${pinRef}, OUTPUT);`);
  if (config.verboseSerial) {
    lines.push(`  Serial.println(F("[BLINK] Testing pin ${pinRef}"));`);
  }
  lines.push('}');
  lines.push('');
  lines.push('void loop() {');
  lines.push(`  digitalWrite(${pinRef}, HIGH);`);
  if (config.verboseSerial) {
    lines.push(`  Serial.println(F("[BLINK] ${pinRef} -> HIGH"));`);
  }
  lines.push(`  delay(${config.delayMs});`);
  lines.push(`  digitalWrite(${pinRef}, LOW);`);
  if (config.verboseSerial) {
    lines.push(`  Serial.println(F("[BLINK] ${pinRef} -> LOW"));`);
  }
  lines.push(`  delay(${config.delayMs});`);
  lines.push('}');
  return lines.join('\n');
}

function generateIoScan(mappings: PinMapping[], config: FirmwareConfig): string {
  const outputs = mappings.filter((m) => m.direction === 'output');
  const inputs = mappings.filter((m) => m.direction === 'input');

  const lines: string[] = [];
  lines.push('void setup() {');
  lines.push(`  Serial.begin(${config.baudRate});`);
  for (const m of outputs) {
    lines.push(`  pinMode(PIN_${m.label}, OUTPUT);`);
  }
  for (const m of inputs) {
    const isAnalog = /^A\d+$/.test(m.pin);
    if (!isAnalog) {
      lines.push(`  pinMode(PIN_${m.label}, INPUT_PULLUP);`);
    }
  }
  if (config.verboseSerial) {
    lines.push(`  Serial.println(F("[IO_SCAN] Scanning ${outputs.length} outputs, ${inputs.length} inputs"));`);
  }
  lines.push('}');
  lines.push('');
  lines.push('void loop() {');
  if (config.verboseSerial) {
    lines.push('  Serial.println(F("[IO_SCAN] --- Scan Start ---"));');
  }
  // Toggle each output
  for (const m of outputs) {
    lines.push(`  digitalWrite(PIN_${m.label}, HIGH);`);
    lines.push(`  delay(${Math.max(100, Math.floor(config.delayMs / 4))});`);
    lines.push(`  digitalWrite(PIN_${m.label}, LOW);`);
    if (config.verboseSerial) {
      lines.push(`  Serial.println(F("[IO_SCAN] Toggled PIN_${m.label}"));`);
    }
  }
  // Read each input
  for (const m of inputs) {
    const isAnalog = /^A\d+$/.test(m.pin);
    if (isAnalog) {
      lines.push(`  int val_${m.label} = analogRead(PIN_${m.label});`);
      lines.push(`  Serial.print(F("[IO_SCAN] PIN_${m.label} = "));`);
      lines.push(`  Serial.println(val_${m.label});`);
    } else {
      lines.push(`  int val_${m.label} = digitalRead(PIN_${m.label});`);
      lines.push(`  Serial.print(F("[IO_SCAN] PIN_${m.label} = "));`);
      lines.push(`  Serial.println(val_${m.label} ? "HIGH" : "LOW");`);
    }
  }
  if (config.verboseSerial) {
    lines.push('  Serial.println(F("[IO_SCAN] --- Scan End ---"));');
  }
  lines.push(`  delay(${config.delayMs});`);
  lines.push('}');
  return lines.join('\n');
}

function generateSensorRead(mappings: PinMapping[], config: FirmwareConfig): string {
  const sensors = mappings.filter((m) => m.componentType === 'sensor' || m.direction === 'input');

  const lines: string[] = [];
  lines.push('void setup() {');
  lines.push(`  Serial.begin(${config.baudRate});`);
  for (const s of sensors) {
    const isAnalog = /^A\d+$/.test(s.pin);
    if (!isAnalog) {
      lines.push(`  pinMode(PIN_${s.label}, INPUT);`);
    }
  }
  if (config.verboseSerial) {
    lines.push(`  Serial.println(F("[SENSOR] Monitoring ${sensors.length} sensor(s)"));`);
  }
  lines.push('}');
  lines.push('');
  lines.push('void loop() {');
  for (const s of sensors) {
    const isAnalog = /^A\d+$/.test(s.pin);
    if (isAnalog) {
      lines.push(`  int raw_${s.label} = analogRead(PIN_${s.label});`);
      lines.push(`  float voltage_${s.label} = raw_${s.label} * (5.0 / 1023.0);`);
      lines.push(`  Serial.print(F("[SENSOR] ${s.refDes} (PIN_${s.label}) raw="));`);
      lines.push(`  Serial.print(raw_${s.label});`);
      lines.push(`  Serial.print(F(" V="));`);
      lines.push(`  Serial.println(voltage_${s.label}, 2);`);
    } else {
      lines.push(`  int state_${s.label} = digitalRead(PIN_${s.label});`);
      lines.push(`  Serial.print(F("[SENSOR] ${s.refDes} (PIN_${s.label}) = "));`);
      lines.push(`  Serial.println(state_${s.label} ? "HIGH" : "LOW");`);
    }
  }
  lines.push(`  delay(${config.delayMs});`);
  lines.push('}');
  return lines.join('\n');
}

function generateMotorTest(mappings: PinMapping[], config: FirmwareConfig): string {
  const motors = mappings.filter((m) => m.componentType === 'motor');
  const boardInfo = BOARD_PIN_INFO[config.boardType];

  const lines: string[] = [];
  lines.push('void setup() {');
  lines.push(`  Serial.begin(${config.baudRate});`);
  for (const m of motors) {
    lines.push(`  pinMode(PIN_${m.label}, OUTPUT);`);
  }
  if (config.verboseSerial) {
    lines.push(`  Serial.println(F("[MOTOR] Testing ${motors.length} motor(s)"));`);
  }
  lines.push('}');
  lines.push('');
  lines.push('void loop() {');
  for (const m of motors) {
    const pinNum = parseInt(m.pin, 10);
    const isPwm = !isNaN(pinNum) && boardInfo.pwmPins.includes(pinNum);

    if (isPwm) {
      // Ramp up
      if (config.verboseSerial) {
        lines.push(`  Serial.println(F("[MOTOR] PIN_${m.label} ramp up"));`);
      }
      lines.push(`  for (int pwm = 0; pwm <= 255; pwm += 51) {`);
      lines.push(`    analogWrite(PIN_${m.label}, pwm);`);
      lines.push(`    Serial.print(F("[MOTOR] PWM="));`);
      lines.push(`    Serial.println(pwm);`);
      lines.push(`    delay(${Math.max(200, Math.floor(config.delayMs / 5))});`);
      lines.push('  }');
      // Stop
      lines.push(`  analogWrite(PIN_${m.label}, 0);`);
      if (config.verboseSerial) {
        lines.push(`  Serial.println(F("[MOTOR] PIN_${m.label} stopped"));`);
      }
    } else {
      // Simple on/off
      lines.push(`  digitalWrite(PIN_${m.label}, HIGH);`);
      if (config.verboseSerial) {
        lines.push(`  Serial.println(F("[MOTOR] PIN_${m.label} -> ON"));`);
      }
      lines.push(`  delay(${config.delayMs});`);
      lines.push(`  digitalWrite(PIN_${m.label}, LOW);`);
      if (config.verboseSerial) {
        lines.push(`  Serial.println(F("[MOTOR] PIN_${m.label} -> OFF"));`);
      }
    }
  }
  lines.push(`  delay(${config.delayMs * 2});`);
  lines.push('}');
  return lines.join('\n');
}

function generateSerialEcho(config: FirmwareConfig): string {
  const lines: string[] = [];
  lines.push('void setup() {');
  lines.push(`  Serial.begin(${config.baudRate});`);
  lines.push('  while (!Serial) { ; }');
  lines.push('  Serial.println(F("[ECHO] Serial echo test ready. Type to echo."));');
  lines.push('}');
  lines.push('');
  lines.push('void loop() {');
  lines.push('  if (Serial.available() > 0) {');
  lines.push('    String input = Serial.readStringUntil(\'\\n\');');
  lines.push('    input.trim();');
  lines.push('    Serial.print(F("[ECHO] Received: "));');
  lines.push('    Serial.println(input);');
  lines.push('    Serial.print(F("[ECHO] Length: "));');
  lines.push('    Serial.println(input.length());');
  lines.push('    Serial.print(F("[ECHO] Millis: "));');
  lines.push('    Serial.println(millis());');
  lines.push('  }');
  lines.push('}');
  return lines.join('\n');
}

function generateComprehensive(mappings: PinMapping[], config: FirmwareConfig): string {
  const outputs = mappings.filter((m) => m.direction === 'output');
  const inputs = mappings.filter((m) => m.direction === 'input');
  const motors = mappings.filter((m) => m.componentType === 'motor');

  const lines: string[] = [];
  lines.push('int testPhase = 0;');
  lines.push('unsigned long lastPhaseChange = 0;');
  lines.push(`const unsigned long PHASE_DURATION = ${config.delayMs * 3}UL;`);
  lines.push('');
  lines.push('void setup() {');
  lines.push(`  Serial.begin(${config.baudRate});`);
  for (const m of outputs) {
    lines.push(`  pinMode(PIN_${m.label}, OUTPUT);`);
  }
  for (const m of inputs) {
    const isAnalog = /^A\d+$/.test(m.pin);
    if (!isAnalog) {
      lines.push(`  pinMode(PIN_${m.label}, INPUT_PULLUP);`);
    }
  }
  lines.push('  Serial.println(F("[COMP] Comprehensive test starting..."));');
  lines.push('  Serial.print(F("[COMP] Outputs: "));');
  lines.push(`  Serial.println(${outputs.length});`);
  lines.push('  Serial.print(F("[COMP] Inputs: "));');
  lines.push(`  Serial.println(${inputs.length});`);
  lines.push('}');
  lines.push('');
  lines.push('void loop() {');
  lines.push('  unsigned long now = millis();');
  lines.push('  if (now - lastPhaseChange > PHASE_DURATION) {');
  lines.push('    testPhase = (testPhase + 1) % 4;');
  lines.push('    lastPhaseChange = now;');
  lines.push('    Serial.print(F("[COMP] Phase "));');
  lines.push('    Serial.println(testPhase);');
  lines.push('  }');
  lines.push('');
  lines.push('  switch (testPhase) {');
  lines.push('    case 0: // Blink all outputs');
  for (const m of outputs) {
    lines.push(`      digitalWrite(PIN_${m.label}, (millis() / 500) % 2 ? HIGH : LOW);`);
  }
  lines.push('      break;');
  lines.push('    case 1: // Read all inputs');
  for (const m of inputs) {
    const isAnalog = /^A\d+$/.test(m.pin);
    if (isAnalog) {
      lines.push(`      Serial.print(F("[COMP] ${m.refDes}="));`);
      lines.push(`      Serial.println(analogRead(PIN_${m.label}));`);
    } else {
      lines.push(`      Serial.print(F("[COMP] ${m.refDes}="));`);
      lines.push(`      Serial.println(digitalRead(PIN_${m.label}));`);
    }
  }
  lines.push('      break;');
  lines.push('    case 2: // Motor ramp');
  if (motors.length > 0) {
    for (const m of motors) {
      lines.push(`      analogWrite(PIN_${m.label}, (millis() / 10) % 256);`);
    }
  } else {
    lines.push('      // No motors in design');
  }
  lines.push('      break;');
  lines.push('    case 3: // Serial echo');
  lines.push('      if (Serial.available() > 0) {');
  lines.push('        Serial.print(F("[COMP] Echo: "));');
  lines.push('        Serial.println(Serial.readStringUntil(\'\\n\'));');
  lines.push('      }');
  lines.push('      break;');
  lines.push('  }');
  lines.push(`  delay(${Math.max(50, Math.floor(config.delayMs / 10))});`);
  lines.push('}');
  return lines.join('\n');
}

/**
 * Generate firmware sketch for a given test mode.
 */
export function generateFirmware(
  mode: TestMode,
  mappings: PinMapping[],
  config: FirmwareConfig,
): GeneratedFirmware {
  const warnings: string[] = [];
  const header = generateHeader(config, mode);
  const pinDefs = generatePinDefines(mappings);

  let body: string;
  let summary: string;

  switch (mode) {
    case 'blink': {
      const leds = mappings.filter((m) => m.componentType === 'led' || m.direction === 'output');
      if (leds.length === 0) {
        warnings.push('No LEDs or output pins found — using default LED pin.');
      }
      body = generateBlink(mappings, config);
      summary = `Blinks ${leds.length > 0 ? leds[0].label : 'default LED'} at ${1000 / config.delayMs}Hz`;
      break;
    }
    case 'io_scan': {
      const outputs = mappings.filter((m) => m.direction === 'output');
      const inputs = mappings.filter((m) => m.direction === 'input');
      if (mappings.length === 0) {
        warnings.push('No pin mappings — IO scan will be empty.');
      }
      body = generateIoScan(mappings, config);
      summary = `Scans ${outputs.length} outputs and ${inputs.length} inputs with serial reporting`;
      break;
    }
    case 'sensor_read': {
      const sensors = mappings.filter((m) => m.componentType === 'sensor' || m.direction === 'input');
      if (sensors.length === 0) {
        warnings.push('No sensors found — sensor read sketch will be empty.');
      }
      body = generateSensorRead(mappings, config);
      summary = `Reads ${sensors.length} sensor(s) with voltage conversion and serial output`;
      break;
    }
    case 'motor_test': {
      const motors = mappings.filter((m) => m.componentType === 'motor');
      if (motors.length === 0) {
        warnings.push('No motors found — motor test sketch will be empty.');
      }
      body = generateMotorTest(mappings, config);
      summary = `Tests ${motors.length} motor(s) with PWM ramp and serial reporting`;
      break;
    }
    case 'serial_echo':
      body = generateSerialEcho(config);
      summary = `Serial echo at ${config.baudRate} baud — type to echo with timestamps`;
      break;
    case 'comprehensive':
      body = generateComprehensive(mappings, config);
      summary = `4-phase comprehensive test: blink, sensor read, motor ramp, serial echo`;
      break;
  }

  const sketch = header + pinDefs + body + '\n';
  const filename = `protopulse_${mode}_test.ino`;

  return { sketch, mode, pinMappings: mappings, filename, summary, warnings };
}

// ---------------------------------------------------------------------------
// DesignToDriveManager (singleton + subscribe)
// ---------------------------------------------------------------------------

export class DesignToDriveManager {
  private listeners: Set<Listener> = new Set();
  private pinMappings: PinMapping[] = [];
  private availableModes: TestMode[] = ['serial_echo', 'comprehensive', 'io_scan'];
  private lastGenerated: GeneratedFirmware | null = null;
  private config: FirmwareConfig = { ...DEFAULT_CONFIG };
  private instanceCount = 0;

  // ── subscribe / getSnapshot ────────────────────────────────────────

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): DesignToDriveSnapshot {
    return {
      pinMappings: [...this.pinMappings],
      availableModes: [...this.availableModes],
      lastGenerated: this.lastGenerated,
      config: { ...this.config },
      instanceCount: this.instanceCount,
    };
  }

  private notify(): void {
    this.listeners.forEach((fn) => {
      fn();
    });
  }

  // ── Configuration ──────────────────────────────────────────────────

  updateConfig(partial: Partial<FirmwareConfig>): void {
    this.config = { ...this.config, ...partial };
    this.notify();
  }

  getConfig(): FirmwareConfig {
    return { ...this.config };
  }

  // ── Analysis ───────────────────────────────────────────────────────

  /**
   * Analyze schematic instances and infer pin mappings.
   */
  analyzeDesign(instances: SchematicInstance[], nets: CircuitNet[]): PinMapping[] {
    this.pinMappings = inferPinMappings(instances, nets, this.config.boardType);
    this.availableModes = getAvailableModes(this.pinMappings);
    this.instanceCount = instances.length;
    this.notify();
    return [...this.pinMappings];
  }

  /**
   * Get pin mappings (without re-analyzing).
   */
  getPinMappings(): PinMapping[] {
    return [...this.pinMappings];
  }

  /**
   * Get available test modes for current design.
   */
  getAvailableModes(): TestMode[] {
    return [...this.availableModes];
  }

  // ── Firmware Generation ────────────────────────────────────────────

  /**
   * Generate firmware for the given mode using current pin mappings and config.
   */
  generate(mode: TestMode): GeneratedFirmware {
    const result = generateFirmware(mode, this.pinMappings, this.config);
    this.lastGenerated = result;
    this.notify();
    return result;
  }

  /**
   * Generate firmware for all available modes.
   */
  generateAll(): GeneratedFirmware[] {
    const results: GeneratedFirmware[] = [];
    for (const mode of this.availableModes) {
      results.push(generateFirmware(mode, this.pinMappings, this.config));
    }
    if (results.length > 0) {
      this.lastGenerated = results[results.length - 1];
      this.notify();
    }
    return results;
  }

  // ── Component mapping ──────────────────────────────────────────────

  /**
   * Get test modes recommended for a specific component category.
   */
  getTestsForCategory(category: ComponentCategory): TestMode[] {
    return [...COMPONENT_TEST_MAP[category]];
  }

  /**
   * Classify a single instance.
   */
  classifyInstance(instance: SchematicInstance): ComponentCategory {
    return classifyComponent(instance);
  }

  // ── Reset ──────────────────────────────────────────────────────────

  reset(): void {
    this.pinMappings = [];
    this.availableModes = ['serial_echo', 'comprehensive', 'io_scan'];
    this.lastGenerated = null;
    this.config = { ...DEFAULT_CONFIG };
    this.instanceCount = 0;
    this.notify();
  }
}

// ---------------------------------------------------------------------------
// Singleton accessor
// ---------------------------------------------------------------------------

let instance: DesignToDriveManager | null = null;

/** Get the singleton DesignToDriveManager. */
export function getDesignToDriveManager(): DesignToDriveManager {
  if (!instance) {
    instance = new DesignToDriveManager();
  }
  return instance;
}

/** Reset the singleton (for testing). */
export function resetDesignToDriveManager(): void {
  instance = null;
}
