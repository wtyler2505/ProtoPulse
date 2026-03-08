/**
 * Firmware Templates — Arduino/ESP32 sketch code generation
 *
 * Generates complete .ino sketch code implementing the ProtoPulse telemetry
 * protocol. Template-based: user selects board type and pins, gets a
 * copy-pasteable sketch with correct Serial.begin(), pin reads, JSON
 * formatting, and timing loop.
 *
 * Zero external deps in generated code — uses raw Serial.print() JSON
 * formatting (no ArduinoJson library required).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BoardType = 'arduino_uno' | 'arduino_mega' | 'esp32' | 'esp32_s3' | 'arduino_nano';

export interface PinConfig {
  pin: number;
  id: string;
  name: string;
  type: 'digital_in' | 'digital_out' | 'analog_in' | 'pwm_out';
}

export interface FirmwareConfig {
  board: BoardType;
  baudRate: number;
  sampleRateHz: number;
  pins: PinConfig[];
  includeManifest: boolean;
  includeDesiredHandler: boolean;
}

export interface BoardPinInfo {
  digital: number;
  analog: number;
  pwm: number;
}

// ---------------------------------------------------------------------------
// Board definitions
// ---------------------------------------------------------------------------

const BOARD_INFO: Record<BoardType, { label: string; pins: BoardPinInfo; serialBegin: string }> = {
  arduino_uno: {
    label: 'Arduino Uno',
    pins: { digital: 14, analog: 6, pwm: 6 },
    serialBegin: 'Serial',
  },
  arduino_mega: {
    label: 'Arduino Mega 2560',
    pins: { digital: 54, analog: 16, pwm: 15 },
    serialBegin: 'Serial',
  },
  arduino_nano: {
    label: 'Arduino Nano',
    pins: { digital: 14, analog: 8, pwm: 6 },
    serialBegin: 'Serial',
  },
  esp32: {
    label: 'ESP32-DevKit',
    pins: { digital: 34, analog: 18, pwm: 16 },
    serialBegin: 'Serial',
  },
  esp32_s3: {
    label: 'ESP32-S3',
    pins: { digital: 45, analog: 20, pwm: 16 },
    serialBegin: 'Serial',
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the pin count for a board type.
 */
export function boardPinCount(board: BoardType): BoardPinInfo {
  return { ...BOARD_INFO[board].pins };
}

/**
 * Generate a complete Arduino/ESP32 sketch implementing the telemetry protocol.
 */
export function generateFirmware(config: FirmwareConfig): string {
  const board = BOARD_INFO[config.board];
  const intervalMs = Math.max(1, Math.round(1000 / config.sampleRateHz));

  const lines: string[] = [];

  // Header comment
  lines.push('// ProtoPulse Digital Twin — Telemetry Firmware');
  lines.push(`// Board: ${board.label}`);
  lines.push(`// Generated at: ${new Date().toISOString().split('T')[0]}`);
  lines.push('// Protocol: JSON Lines (one JSON object per line)');
  lines.push('');

  // Timing variables
  lines.push(`const unsigned long SAMPLE_INTERVAL_MS = ${intervalMs};`);
  lines.push('unsigned long lastSampleTime = 0;');
  lines.push('');

  // Pin definitions
  if (config.pins.length > 0) {
    lines.push('// Pin definitions');
    for (const pin of config.pins) {
      lines.push(`const int PIN_${pin.id.toUpperCase()} = ${pin.pin};`);
    }
    lines.push('');
  }

  // Setup function
  lines.push('void setup() {');
  lines.push(`  ${board.serialBegin}.begin(${config.baudRate});`);
  lines.push(`  while (!${board.serialBegin}) { ; } // Wait for serial`);
  lines.push('');

  // Pin modes
  for (const pin of config.pins) {
    switch (pin.type) {
      case 'digital_in':
        lines.push(`  pinMode(PIN_${pin.id.toUpperCase()}, INPUT);`);
        break;
      case 'digital_out':
        lines.push(`  pinMode(PIN_${pin.id.toUpperCase()}, OUTPUT);`);
        break;
      case 'analog_in':
        // No pinMode needed for analog input
        break;
      case 'pwm_out':
        lines.push(`  pinMode(PIN_${pin.id.toUpperCase()}, OUTPUT);`);
        break;
    }
  }

  if (config.pins.length > 0) {
    lines.push('');
  }

  // Send manifest on startup
  if (config.includeManifest) {
    lines.push('  // Send manifest on connect');
    lines.push('  sendManifest();');
  }

  lines.push('}');
  lines.push('');

  // Loop function
  lines.push('void loop() {');

  if (config.includeDesiredHandler) {
    lines.push('  // Check for incoming commands');
    lines.push('  handleSerial();');
    lines.push('');
  }

  lines.push('  unsigned long now = millis();');
  lines.push('  if (now - lastSampleTime >= SAMPLE_INTERVAL_MS) {');
  lines.push('    lastSampleTime = now;');
  lines.push('    sendTelemetry();');
  lines.push('  }');
  lines.push('}');
  lines.push('');

  // Telemetry function
  lines.push(...generateTelemetryFunction(config, board.serialBegin));

  // Manifest function
  if (config.includeManifest) {
    lines.push('');
    lines.push(...generateManifestFunction(config, board));
  }

  // Desired handler
  if (config.includeDesiredHandler) {
    lines.push('');
    lines.push(...generateDesiredHandler(config, board.serialBegin));
  }

  return lines.join('\n') + '\n';
}

/**
 * Generate just the manifest sending function.
 */
export function generateManifestCode(config: FirmwareConfig): string {
  const board = BOARD_INFO[config.board];
  return generateManifestFunction(config, board).join('\n') + '\n';
}

/**
 * Generate just the telemetry read loop code.
 */
export function generateReadLoop(pins: PinConfig[]): string {
  const lines: string[] = [];
  for (const pin of pins) {
    switch (pin.type) {
      case 'digital_in':
      case 'digital_out':
        lines.push(`  int val_${pin.id} = digitalRead(PIN_${pin.id.toUpperCase()});`);
        break;
      case 'analog_in':
        lines.push(`  int val_${pin.id} = analogRead(PIN_${pin.id.toUpperCase()});`);
        break;
      case 'pwm_out':
        lines.push(`  // PWM output — no read needed for ${pin.id}`);
        break;
    }
  }
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Internal generators
// ---------------------------------------------------------------------------

function generateTelemetryFunction(config: FirmwareConfig, serial: string): string[] {
  const lines: string[] = [];

  lines.push('void sendTelemetry() {');

  // Read pins
  for (const pin of config.pins) {
    switch (pin.type) {
      case 'digital_in':
      case 'digital_out':
        lines.push(`  int val_${pin.id} = digitalRead(PIN_${pin.id.toUpperCase()});`);
        break;
      case 'analog_in':
        lines.push(`  int val_${pin.id} = analogRead(PIN_${pin.id.toUpperCase()});`);
        break;
      case 'pwm_out':
        // PWM outputs don't have a read — skip
        break;
    }
  }

  if (config.pins.length > 0) {
    lines.push('');
  }

  // Build JSON telemetry frame
  lines.push(`  ${serial}.print("{\\"type\\":\\"telemetry\\",\\"ts\\":");`);
  lines.push(`  ${serial}.print(millis());`);
  lines.push(`  ${serial}.print(",\\"ch\\":{");`);

  const readablePins = config.pins.filter((p) => p.type !== 'pwm_out');
  for (let i = 0; i < readablePins.length; i++) {
    const pin = readablePins[i];
    const comma = i > 0 ? ',' : '';
    if (pin.type === 'digital_in' || pin.type === 'digital_out') {
      lines.push(`  ${serial}.print("${comma}\\"${pin.id}\\":");`);
      lines.push(`  ${serial}.print(val_${pin.id} ? "true" : "false");`);
    } else {
      lines.push(`  ${serial}.print("${comma}\\"${pin.id}\\":");`);
      lines.push(`  ${serial}.print(val_${pin.id});`);
    }
  }

  lines.push(`  ${serial}.println("}}");`);
  lines.push('}');

  return lines;
}

function generateManifestFunction(
  config: FirmwareConfig,
  board: { label: string; serialBegin: string },
): string[] {
  const lines: string[] = [];
  const serial = board.serialBegin;

  lines.push('void sendManifest() {');
  lines.push(`  ${serial}.print("{\\"type\\":\\"manifest\\",\\"board\\":\\"${board.label}\\",");`);
  lines.push(`  ${serial}.print("\\"firmware\\":\\"1.0.0\\",\\"channels\\":[");`);

  for (let i = 0; i < config.pins.length; i++) {
    const pin = config.pins[i];
    const comma = i > 0 ? ',' : '';
    const dataType = pinTypeToDataType(pin.type);
    const unit = pinTypeToUnit(pin.type);
    const range = pinTypeToRange(pin.type);

    let channelJson = `${comma}{\\"id\\":\\"${pin.id}\\",\\"name\\":\\"${pin.name}\\",\\"dataType\\":\\"${dataType}\\"`;
    if (unit) {
      channelJson += `,\\"unit\\":\\"${unit}\\"`;
    }
    if (range) {
      channelJson += `,\\"min\\":${range.min},\\"max\\":${range.max}`;
    }
    channelJson += `,\\"pin\\":${pin.pin}}`;

    lines.push(`  ${serial}.print("${channelJson}");`);
  }

  lines.push(`  ${serial}.println("]}");`);
  lines.push('}');

  return lines;
}

function generateDesiredHandler(config: FirmwareConfig, serial: string): string[] {
  const lines: string[] = [];

  lines.push('String serialBuffer = "";');
  lines.push('');
  lines.push('void handleSerial() {');
  lines.push(`  while (${serial}.available()) {`);
  lines.push(`    char c = ${serial}.read();`);
  lines.push('    if (c == \'\\n\') {');
  lines.push('      processCommand(serialBuffer);');
  lines.push('      serialBuffer = "";');
  lines.push('    } else {');
  lines.push('      serialBuffer += c;');
  lines.push('    }');
  lines.push('  }');
  lines.push('}');
  lines.push('');
  lines.push('void processCommand(String json) {');
  lines.push('  // Parse command: {"type":"command","channel":"D13","value":true}');
  lines.push('  if (json.indexOf("\\"type\\":\\"command\\"") < 0) {');
  lines.push('    return;');
  lines.push('  }');
  lines.push('');

  // Handle writable pins
  const writablePins = config.pins.filter((p) => p.type === 'digital_out' || p.type === 'pwm_out');

  if (writablePins.length > 0) {
    for (const pin of writablePins) {
      lines.push(`  if (json.indexOf("\\"channel\\":\\"${pin.id}\\"") >= 0) {`);

      if (pin.type === 'digital_out') {
        lines.push(`    bool val = json.indexOf("\\"value\\":true") >= 0;`);
        lines.push(`    digitalWrite(PIN_${pin.id.toUpperCase()}, val ? HIGH : LOW);`);
        lines.push(`    ${serial}.print("{\\"type\\":\\"response\\",\\"cmd\\":\\"set_${pin.id}\\",\\"ok\\":true}");`);
        lines.push(`    ${serial}.println();`);
      } else {
        // PWM
        lines.push('    // Extract numeric value');
        lines.push('    int valStart = json.indexOf("\\"value\\":") + 8;');
        lines.push('    int valEnd = json.indexOf("}", valStart);');
        lines.push('    int val = json.substring(valStart, valEnd).toInt();');
        lines.push(`    analogWrite(PIN_${pin.id.toUpperCase()}, constrain(val, 0, 255));`);
        lines.push(`    ${serial}.print("{\\"type\\":\\"response\\",\\"cmd\\":\\"set_${pin.id}\\",\\"ok\\":true}");`);
        lines.push(`    ${serial}.println();`);
      }

      lines.push('    return;');
      lines.push('  }');
      lines.push('');
    }
  }

  // Handshake handling (re-send manifest)
  lines.push('  if (json.indexOf("\\"type\\":\\"handshake\\"") >= 0) {');
  lines.push('    sendManifest();');
  lines.push('    return;');
  lines.push('  }');

  // Unknown command
  lines.push('');
  lines.push(`  ${serial}.println("{\\"type\\":\\"response\\",\\"cmd\\":\\"unknown\\",\\"ok\\":false,\\"msg\\":\\"Unknown command\\"}");`);

  lines.push('}');

  return lines;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pinTypeToDataType(type: PinConfig['type']): string {
  switch (type) {
    case 'digital_in':
    case 'digital_out':
      return 'digital';
    case 'analog_in':
      return 'analog';
    case 'pwm_out':
      return 'pwm';
  }
}

function pinTypeToUnit(type: PinConfig['type']): string | null {
  switch (type) {
    case 'analog_in':
      return 'V';
    default:
      return null;
  }
}

function pinTypeToRange(type: PinConfig['type']): { min: number; max: number } | null {
  switch (type) {
    case 'digital_in':
    case 'digital_out':
      return { min: 0, max: 1 };
    case 'analog_in':
      return { min: 0, max: 1023 };
    case 'pwm_out':
      return { min: 0, max: 255 };
  }
}
