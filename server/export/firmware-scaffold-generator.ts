/**
 * Firmware Scaffold Generator
 *
 * Generates Arduino/PlatformIO-style C++ firmware scaffolding based on the
 * project's architecture graph.  Analyses architecture nodes to identify the
 * main MCU, peripherals, and communication buses (from edge signalType) and
 * produces three files:
 *
 *   1. main.cpp   – setup() with pin/bus initialisation, loop() with stubs
 *   2. config.h   – pin definitions, I2C addresses, SPI settings
 *   3. platformio.ini – board configuration based on detected MCU
 *
 * Pure function library — no Express routes, no side effects.
 */

import type { ArchNodeData, ArchEdgeData } from './types';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** Recognised MCU family with PlatformIO board/framework defaults. */
interface McuProfile {
  family: string;
  board: string;
  platform: string;
  framework: string;
  defaultClock: number;
  i2cSda: string;
  i2cScl: string;
  spiMosi: string;
  spiMiso: string;
  spiSck: string;
  spiCs: string;
  uartTx: string;
  uartRx: string;
}

interface PeripheralInfo {
  label: string;
  nodeType: string;
  nodeId: string;
  bus: string | null;
  /** Description from node data, if available. */
  description: string;
  /** I2C address hint from node data, if available. */
  i2cAddress: string | null;
}

interface BusConnection {
  signalType: string;
  sourceLabel: string;
  targetLabel: string;
  sourceId: string;
  targetId: string;
  voltage: string | null;
  label: string | null;
}

interface FirmwareScaffoldOutput {
  files: Array<{ filename: string; content: string }>;
}

// ---------------------------------------------------------------------------
// MCU detection heuristics
// ---------------------------------------------------------------------------

const MCU_PROFILES: Record<string, McuProfile> = {
  esp32: {
    family: 'ESP32',
    board: 'esp32dev',
    platform: 'espressif32',
    framework: 'arduino',
    defaultClock: 240,
    i2cSda: '21',
    i2cScl: '22',
    spiMosi: '23',
    spiMiso: '19',
    spiSck: '18',
    spiCs: '5',
    uartTx: '17',
    uartRx: '16',
  },
  esp8266: {
    family: 'ESP8266',
    board: 'esp12e',
    platform: 'espressif8266',
    framework: 'arduino',
    defaultClock: 80,
    i2cSda: '4',
    i2cScl: '5',
    spiMosi: '13',
    spiMiso: '12',
    spiSck: '14',
    spiCs: '15',
    uartTx: '1',
    uartRx: '3',
  },
  arduino_uno: {
    family: 'Arduino Uno',
    board: 'uno',
    platform: 'atmelavr',
    framework: 'arduino',
    defaultClock: 16,
    i2cSda: 'A4',
    i2cScl: 'A5',
    spiMosi: '11',
    spiMiso: '12',
    spiSck: '13',
    spiCs: '10',
    uartTx: '1',
    uartRx: '0',
  },
  arduino_mega: {
    family: 'Arduino Mega',
    board: 'megaatmega2560',
    platform: 'atmelavr',
    framework: 'arduino',
    defaultClock: 16,
    i2cSda: '20',
    i2cScl: '21',
    spiMosi: '51',
    spiMiso: '50',
    spiSck: '52',
    spiCs: '53',
    uartTx: '1',
    uartRx: '0',
  },
  arduino_nano: {
    family: 'Arduino Nano',
    board: 'nanoatmega328',
    platform: 'atmelavr',
    framework: 'arduino',
    defaultClock: 16,
    i2cSda: 'A4',
    i2cScl: 'A5',
    spiMosi: '11',
    spiMiso: '12',
    spiSck: '13',
    spiCs: '10',
    uartTx: '1',
    uartRx: '0',
  },
  stm32: {
    family: 'STM32',
    board: 'nucleo_f401re',
    platform: 'ststm32',
    framework: 'arduino',
    defaultClock: 84,
    i2cSda: 'PB9',
    i2cScl: 'PB8',
    spiMosi: 'PA7',
    spiMiso: 'PA6',
    spiSck: 'PA5',
    spiCs: 'PA4',
    uartTx: 'PA2',
    uartRx: 'PA3',
  },
  teensy: {
    family: 'Teensy',
    board: 'teensy40',
    platform: 'teensy',
    framework: 'arduino',
    defaultClock: 600,
    i2cSda: '18',
    i2cScl: '19',
    spiMosi: '11',
    spiMiso: '12',
    spiSck: '13',
    spiCs: '10',
    uartTx: '1',
    uartRx: '0',
  },
  rpi_pico: {
    family: 'Raspberry Pi Pico',
    board: 'pico',
    platform: 'raspberrypi',
    framework: 'arduino',
    defaultClock: 133,
    i2cSda: '4',
    i2cScl: '5',
    spiMosi: '19',
    spiMiso: '16',
    spiSck: '18',
    spiCs: '17',
    uartTx: '0',
    uartRx: '1',
  },
};

/** Keywords (lowered) that indicate a node is an MCU. */
const MCU_KEYWORDS = [
  'esp32', 'esp8266', 'arduino', 'stm32', 'teensy',
  'microcontroller', 'mcu', 'processor', 'fpga', 'pico',
  'atmega', 'attiny', 'samd', 'nrf52', 'rp2040',
];

/** Signal types that map to known buses. */
const BUS_SIGNAL_TYPES = new Set([
  'i2c', 'spi', 'uart', 'serial', 'gpio', 'pwm', 'analog',
  'onewire', 'can', 'i2s',
]);

/**
 * Peripheral type keywords — used to generate appropriate read/write stubs
 * in the loop().
 */
const PERIPHERAL_TYPE_KEYWORDS: Record<string, string[]> = {
  sensor: ['sensor', 'temperature', 'humidity', 'pressure', 'accelerometer', 'gyroscope', 'imu', 'adc', 'light', 'proximity', 'gas', 'current'],
  display: ['display', 'lcd', 'oled', 'tft', 'screen', 'led_matrix', 'epaper', 'eink'],
  actuator: ['motor', 'servo', 'relay', 'solenoid', 'pump', 'valve', 'heater', 'fan', 'buzzer', 'speaker'],
  communication: ['wifi', 'bluetooth', 'ble', 'lora', 'zigbee', 'radio', 'ethernet', 'gsm', 'gps', 'nfc', 'rfid'],
  storage: ['sd', 'eeprom', 'flash', 'sram', 'memory'],
  input: ['button', 'switch', 'keypad', 'encoder', 'joystick', 'potentiometer', 'touch'],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectMcuProfile(node: ArchNodeData): McuProfile | null {
  const haystack = [
    node.label,
    node.nodeType,
    (node.data?.type as string) ?? '',
    (node.data?.description as string) ?? '',
  ].join(' ').toLowerCase();

  // Try exact family matches first, then fallback to keyword search
  for (const [key, profile] of Object.entries(MCU_PROFILES)) {
    if (haystack.includes(key.replace(/_/g, ' ')) || haystack.includes(key.replace(/_/g, ''))) {
      return profile;
    }
  }

  // Special patterns
  if (/\besp32/.test(haystack)) { return MCU_PROFILES.esp32; }
  if (/\besp8266/.test(haystack)) { return MCU_PROFILES.esp8266; }
  if (/\bstm32/.test(haystack)) { return MCU_PROFILES.stm32; }
  if (/\bteensy/.test(haystack)) { return MCU_PROFILES.teensy; }
  if (/\bpico\b/.test(haystack) || /\brp2040/.test(haystack)) { return MCU_PROFILES.rpi_pico; }
  if (/\bmega\b/.test(haystack)) { return MCU_PROFILES.arduino_mega; }
  if (/\bnano\b/.test(haystack)) { return MCU_PROFILES.arduino_nano; }
  if (/\barduino/.test(haystack) || /\buno\b/.test(haystack)) { return MCU_PROFILES.arduino_uno; }

  return null;
}

function isMcuNode(node: ArchNodeData): boolean {
  const haystack = [
    node.label,
    node.nodeType,
    (node.data?.type as string) ?? '',
  ].join(' ').toLowerCase();
  return MCU_KEYWORDS.some((kw) => haystack.includes(kw));
}

function classifyPeripheral(node: ArchNodeData): string {
  const haystack = [
    node.label,
    node.nodeType,
    (node.data?.type as string) ?? '',
    (node.data?.description as string) ?? '',
  ].join(' ').toLowerCase();

  for (const [category, keywords] of Object.entries(PERIPHERAL_TYPE_KEYWORDS)) {
    if (keywords.some((kw) => haystack.includes(kw))) {
      return category;
    }
  }
  return 'generic';
}

function toIdentifier(label: string): string {
  return label
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '')
    .toUpperCase();
}

function toCamelCase(label: string): string {
  return label
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

// ---------------------------------------------------------------------------
// File generators
// ---------------------------------------------------------------------------

function generateConfigH(
  mcu: McuProfile,
  peripherals: PeripheralInfo[],
  buses: BusConnection[],
): string {
  const lines: string[] = [];
  const now = new Date().toISOString().split('T')[0];

  lines.push('/**');
  lines.push(' * config.h — Pin definitions and peripheral configuration');
  lines.push(` * Generated by ProtoPulse EDA on ${now}`);
  lines.push(` * Target MCU: ${mcu.family}`);
  lines.push(' *');
  lines.push(' * TODO: Review and adjust pin assignments for your specific board/wiring.');
  lines.push(' */');
  lines.push('');
  lines.push('#ifndef CONFIG_H');
  lines.push('#define CONFIG_H');
  lines.push('');

  // Determine which buses are used
  const busTypes = new Set(buses.map((b) => b.signalType.toLowerCase()));

  // I2C configuration
  if (busTypes.has('i2c')) {
    lines.push('// ---------------------------------------------------------------------------');
    lines.push('// I2C Configuration');
    lines.push('// ---------------------------------------------------------------------------');
    lines.push(`#define I2C_SDA_PIN ${mcu.i2cSda}`);
    lines.push(`#define I2C_SCL_PIN ${mcu.i2cScl}`);
    lines.push('#define I2C_CLOCK_HZ 100000  // TODO: Adjust I2C clock speed if needed');
    lines.push('');

    // Per-peripheral I2C addresses
    const i2cPeripherals = peripherals.filter((p) => p.bus === 'i2c');
    if (i2cPeripherals.length > 0) {
      lines.push('// I2C device addresses (verify against datasheets)');
      let addrCounter = 0x20;
      for (const p of i2cPeripherals) {
        const id = toIdentifier(p.label);
        const addr = p.i2cAddress ?? `0x${addrCounter.toString(16).toUpperCase()}`;
        lines.push(`#define ${id}_I2C_ADDR ${addr}  // TODO: Verify address for ${p.label}`);
        addrCounter++;
      }
      lines.push('');
    }
  }

  // SPI configuration
  if (busTypes.has('spi')) {
    lines.push('// ---------------------------------------------------------------------------');
    lines.push('// SPI Configuration');
    lines.push('// ---------------------------------------------------------------------------');
    lines.push(`#define SPI_MOSI_PIN ${mcu.spiMosi}`);
    lines.push(`#define SPI_MISO_PIN ${mcu.spiMiso}`);
    lines.push(`#define SPI_SCK_PIN  ${mcu.spiSck}`);
    lines.push('');

    // Per-peripheral CS pins
    const spiPeripherals = peripherals.filter((p) => p.bus === 'spi');
    let csCounter = 0;
    const csDefaults = [mcu.spiCs, '4', '15', '2', '27', '26'];
    for (const p of spiPeripherals) {
      const id = toIdentifier(p.label);
      const csPin = csDefaults[csCounter] ?? String(csCounter + 10);
      lines.push(`#define ${id}_CS_PIN ${csPin}  // TODO: Assign correct CS pin for ${p.label}`);
      csCounter++;
    }
    lines.push('');
  }

  // UART/Serial configuration
  if (busTypes.has('uart') || busTypes.has('serial')) {
    lines.push('// ---------------------------------------------------------------------------');
    lines.push('// UART Configuration');
    lines.push('// ---------------------------------------------------------------------------');
    lines.push(`#define UART_TX_PIN ${mcu.uartTx}`);
    lines.push(`#define UART_RX_PIN ${mcu.uartRx}`);
    lines.push('#define UART_BAUD_RATE 9600  // TODO: Set appropriate baud rate');
    lines.push('');
  }

  // GPIO pin assignments for other peripherals
  const gpioPeripherals = peripherals.filter(
    (p) => p.bus === 'gpio' || p.bus === 'pwm' || p.bus === 'analog' || p.bus === null,
  );
  if (gpioPeripherals.length > 0) {
    lines.push('// ---------------------------------------------------------------------------');
    lines.push('// GPIO / Analog / PWM Pin Assignments');
    lines.push('// ---------------------------------------------------------------------------');
    let gpioCounter = 2;
    for (const p of gpioPeripherals) {
      const id = toIdentifier(p.label);
      const category = classifyPeripheral({
        nodeId: p.nodeId,
        label: p.label,
        nodeType: p.nodeType,
        positionX: 0,
        positionY: 0,
        data: null,
      });
      const pinComment = p.bus === 'analog' ? '(analog)' :
        p.bus === 'pwm' ? '(PWM)' :
        category === 'input' ? '(digital input)' :
        category === 'actuator' ? '(digital output)' :
        '';
      lines.push(`#define ${id}_PIN ${gpioCounter}  // TODO: Assign correct pin for ${p.label} ${pinComment}`);
      gpioCounter++;
    }
    lines.push('');
  }

  // Timing constants
  lines.push('// ---------------------------------------------------------------------------');
  lines.push('// Timing');
  lines.push('// ---------------------------------------------------------------------------');
  lines.push('#define LOOP_DELAY_MS 100  // TODO: Adjust main loop interval');
  lines.push('#define SENSOR_READ_INTERVAL_MS 1000  // TODO: Adjust sensor polling interval');
  lines.push('');

  lines.push('#endif // CONFIG_H');
  lines.push('');

  return lines.join('\n');
}

function generateMainCpp(
  mcu: McuProfile,
  peripherals: PeripheralInfo[],
  buses: BusConnection[],
): string {
  const lines: string[] = [];
  const now = new Date().toISOString().split('T')[0];
  const busTypes = new Set(buses.map((b) => b.signalType.toLowerCase()));

  lines.push('/**');
  lines.push(` * main.cpp — Firmware scaffold for ${mcu.family}`);
  lines.push(` * Generated by ProtoPulse EDA on ${now}`);
  lines.push(' *');
  lines.push(' * This is a starting point — fill in the TODO sections with your');
  lines.push(' * specific peripheral drivers, libraries, and application logic.');
  lines.push(' */');
  lines.push('');

  // Includes
  lines.push('#include <Arduino.h>');
  lines.push('#include "config.h"');
  if (busTypes.has('i2c')) {
    lines.push('#include <Wire.h>');
  }
  if (busTypes.has('spi')) {
    lines.push('#include <SPI.h>');
  }
  lines.push('');

  // Library include hints
  const libraryHints: string[] = [];
  for (const p of peripherals) {
    const category = classifyPeripheral({
      nodeId: p.nodeId,
      label: p.label,
      nodeType: p.nodeType,
      positionX: 0,
      positionY: 0,
      data: null,
    });
    if (category === 'display') {
      libraryHints.push(`// TODO: #include the display library for ${p.label} (e.g. Adafruit_SSD1306, TFT_eSPI, U8g2)`);
    } else if (category === 'sensor') {
      libraryHints.push(`// TODO: #include the sensor library for ${p.label} (e.g. Adafruit_BME280, MPU6050)`);
    } else if (category === 'communication') {
      libraryHints.push(`// TODO: #include the communication library for ${p.label} (e.g. WiFi.h, BLEDevice.h)`);
    } else if (category === 'storage') {
      libraryHints.push(`// TODO: #include the storage library for ${p.label} (e.g. SD.h, EEPROM.h)`);
    }
  }
  if (libraryHints.length > 0) {
    lines.push('// Peripheral library includes');
    // Deduplicate
    const uniqueHints = Array.from(new Set(libraryHints));
    lines.push(...uniqueHints);
    lines.push('');
  }

  // Global state variables
  lines.push('// ---------------------------------------------------------------------------');
  lines.push('// Global State');
  lines.push('// ---------------------------------------------------------------------------');
  lines.push('');
  lines.push('unsigned long lastSensorReadMs = 0;');
  lines.push('');

  // Per-peripheral state variables
  for (const p of peripherals) {
    const category = classifyPeripheral({
      nodeId: p.nodeId,
      label: p.label,
      nodeType: p.nodeType,
      positionX: 0,
      positionY: 0,
      data: null,
    });
    const varName = toCamelCase(p.label);
    if (category === 'sensor') {
      lines.push(`float ${varName}Value = 0.0;  // Last reading from ${p.label}`);
    } else if (category === 'actuator') {
      lines.push(`bool ${varName}Active = false;  // State of ${p.label}`);
    } else if (category === 'input') {
      lines.push(`bool ${varName}State = false;  // State of ${p.label}`);
    }
  }
  lines.push('');

  // ---------------------------------------------------------------------------
  // setup()
  // ---------------------------------------------------------------------------
  lines.push('// ---------------------------------------------------------------------------');
  lines.push('// setup()');
  lines.push('// ---------------------------------------------------------------------------');
  lines.push('');
  lines.push('void setup() {');
  lines.push('  // Serial monitor');
  lines.push('  Serial.begin(115200);');
  lines.push('  while (!Serial) { delay(10); }');
  lines.push(`  Serial.println("[${mcu.family}] Firmware starting...");`);
  lines.push('');

  // Bus initialisation
  if (busTypes.has('i2c')) {
    lines.push('  // I2C bus');
    lines.push('  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);');
    lines.push('  Wire.setClock(I2C_CLOCK_HZ);');
    lines.push('  Serial.println("[I2C] Bus initialised");');
    lines.push('');
  }

  if (busTypes.has('spi')) {
    lines.push('  // SPI bus');
    lines.push('  SPI.begin(SPI_SCK_PIN, SPI_MISO_PIN, SPI_MOSI_PIN);');
    // Set CS pins high
    const spiPeripherals = peripherals.filter((p) => p.bus === 'spi');
    for (const p of spiPeripherals) {
      const id = toIdentifier(p.label);
      lines.push(`  pinMode(${id}_CS_PIN, OUTPUT);`);
      lines.push(`  digitalWrite(${id}_CS_PIN, HIGH);  // Deselect ${p.label}`);
    }
    lines.push('  Serial.println("[SPI] Bus initialised");');
    lines.push('');
  }

  if (busTypes.has('uart') || busTypes.has('serial')) {
    lines.push('  // UART (secondary serial)');
    lines.push('  // TODO: Initialise hardware serial for UART peripheral');
    lines.push('  // Serial1.begin(UART_BAUD_RATE, SERIAL_8N1, UART_RX_PIN, UART_TX_PIN);');
    lines.push('  Serial.println("[UART] Ready");');
    lines.push('');
  }

  // GPIO pin modes
  const gpioPeripherals = peripherals.filter(
    (p) => p.bus === 'gpio' || p.bus === 'pwm' || p.bus === 'analog' || p.bus === null,
  );
  if (gpioPeripherals.length > 0) {
    lines.push('  // GPIO pin modes');
    for (const p of gpioPeripherals) {
      const id = toIdentifier(p.label);
      const category = classifyPeripheral({
        nodeId: p.nodeId,
        label: p.label,
        nodeType: p.nodeType,
        positionX: 0,
        positionY: 0,
        data: null,
      });
      if (category === 'input') {
        lines.push(`  pinMode(${id}_PIN, INPUT_PULLUP);  // ${p.label}`);
      } else if (category === 'actuator') {
        lines.push(`  pinMode(${id}_PIN, OUTPUT);  // ${p.label}`);
      } else if (p.bus === 'analog') {
        lines.push(`  // ${p.label}: analog pin — no pinMode needed for analogRead`);
      } else {
        lines.push(`  // TODO: Set pin mode for ${p.label}`);
        lines.push(`  // pinMode(${id}_PIN, INPUT);  // or OUTPUT`);
      }
    }
    lines.push('');
  }

  // Per-peripheral init stubs
  for (const p of peripherals) {
    const category = classifyPeripheral({
      nodeId: p.nodeId,
      label: p.label,
      nodeType: p.nodeType,
      positionX: 0,
      positionY: 0,
      data: null,
    });
    if (category === 'display') {
      lines.push(`  // TODO: Initialise ${p.label} display`);
      lines.push(`  // e.g. display.begin(SSD1306_SWITCHCAPVCC, ${toIdentifier(p.label)}_I2C_ADDR);`);
      lines.push('');
    } else if (category === 'sensor') {
      lines.push(`  // TODO: Initialise ${p.label} sensor`);
      lines.push(`  // e.g. if (!sensor.begin()) { Serial.println("${p.label} not found!"); }`);
      lines.push('');
    } else if (category === 'communication') {
      lines.push(`  // TODO: Initialise ${p.label} communication module`);
      lines.push('');
    } else if (category === 'storage') {
      lines.push(`  // TODO: Initialise ${p.label} storage`);
      lines.push(`  // e.g. if (!SD.begin(${toIdentifier(p.label)}_CS_PIN)) { Serial.println("${p.label} init failed"); }`);
      lines.push('');
    }
  }

  lines.push(`  Serial.println("[${mcu.family}] Setup complete");`);
  lines.push('}');
  lines.push('');

  // ---------------------------------------------------------------------------
  // loop()
  // ---------------------------------------------------------------------------
  lines.push('// ---------------------------------------------------------------------------');
  lines.push('// loop()');
  lines.push('// ---------------------------------------------------------------------------');
  lines.push('');
  lines.push('void loop() {');
  lines.push('  unsigned long now = millis();');
  lines.push('');

  // Input reading
  const inputPeripherals = peripherals.filter((p) => {
    const cat = classifyPeripheral({
      nodeId: p.nodeId,
      label: p.label,
      nodeType: p.nodeType,
      positionX: 0,
      positionY: 0,
      data: null,
    });
    return cat === 'input';
  });
  if (inputPeripherals.length > 0) {
    lines.push('  // --- Read inputs ---');
    for (const p of inputPeripherals) {
      const varName = toCamelCase(p.label);
      const id = toIdentifier(p.label);
      lines.push(`  ${varName}State = digitalRead(${id}_PIN) == LOW;  // Active-low for ${p.label}`);
    }
    lines.push('');
  }

  // Sensor reading (on interval)
  const sensorPeripherals = peripherals.filter((p) => {
    const cat = classifyPeripheral({
      nodeId: p.nodeId,
      label: p.label,
      nodeType: p.nodeType,
      positionX: 0,
      positionY: 0,
      data: null,
    });
    return cat === 'sensor';
  });
  if (sensorPeripherals.length > 0) {
    lines.push('  // --- Read sensors (periodic) ---');
    lines.push('  if (now - lastSensorReadMs >= SENSOR_READ_INTERVAL_MS) {');
    lines.push('    lastSensorReadMs = now;');
    lines.push('');
    for (const p of sensorPeripherals) {
      const varName = toCamelCase(p.label);
      lines.push(`    // TODO: Read ${p.label}`);
      if (p.bus === 'analog') {
        const id = toIdentifier(p.label);
        lines.push(`    ${varName}Value = analogRead(${id}_PIN);`);
      } else if (p.bus === 'i2c') {
        lines.push(`    // ${varName}Value = sensor.readValue();`);
      } else {
        lines.push(`    // ${varName}Value = readSensor();`);
      }
      lines.push(`    Serial.print("[${p.label}] Value: ");`);
      lines.push(`    Serial.println(${varName}Value);`);
      lines.push('');
    }
    lines.push('  }');
    lines.push('');
  }

  // Actuator control stubs
  const actuatorPeripherals = peripherals.filter((p) => {
    const cat = classifyPeripheral({
      nodeId: p.nodeId,
      label: p.label,
      nodeType: p.nodeType,
      positionX: 0,
      positionY: 0,
      data: null,
    });
    return cat === 'actuator';
  });
  if (actuatorPeripherals.length > 0) {
    lines.push('  // --- Control actuators ---');
    for (const p of actuatorPeripherals) {
      const varName = toCamelCase(p.label);
      const id = toIdentifier(p.label);
      lines.push(`  // TODO: Implement control logic for ${p.label}`);
      lines.push(`  // digitalWrite(${id}_PIN, ${varName}Active ? HIGH : LOW);`);
    }
    lines.push('');
  }

  // Display update stubs
  const displayPeripherals = peripherals.filter((p) => {
    const cat = classifyPeripheral({
      nodeId: p.nodeId,
      label: p.label,
      nodeType: p.nodeType,
      positionX: 0,
      positionY: 0,
      data: null,
    });
    return cat === 'display';
  });
  if (displayPeripherals.length > 0) {
    lines.push('  // --- Update displays ---');
    for (const p of displayPeripherals) {
      lines.push(`  // TODO: Update ${p.label} with current readings`);
      lines.push('  // display.clearDisplay();');
      lines.push('  // display.display();');
    }
    lines.push('');
  }

  // Communication stubs
  const commPeripherals = peripherals.filter((p) => {
    const cat = classifyPeripheral({
      nodeId: p.nodeId,
      label: p.label,
      nodeType: p.nodeType,
      positionX: 0,
      positionY: 0,
      data: null,
    });
    return cat === 'communication';
  });
  if (commPeripherals.length > 0) {
    lines.push('  // --- Communication ---');
    for (const p of commPeripherals) {
      lines.push(`  // TODO: Transmit/receive data via ${p.label}`);
    }
    lines.push('');
  }

  lines.push('  delay(LOOP_DELAY_MS);');
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

function generatePlatformioIni(
  mcu: McuProfile,
  buses: BusConnection[],
  peripherals: PeripheralInfo[],
): string {
  const lines: string[] = [];
  const now = new Date().toISOString().split('T')[0];
  const busTypes = new Set(buses.map((b) => b.signalType.toLowerCase()));

  lines.push('; platformio.ini');
  lines.push(`; Generated by ProtoPulse EDA on ${now}`);
  lines.push(`; Target: ${mcu.family} (${mcu.board})`);
  lines.push(';');
  lines.push('; Documentation: https://docs.platformio.org/page/projectconf.html');
  lines.push('');
  lines.push('[env:default]');
  lines.push(`platform = ${mcu.platform}`);
  lines.push(`board = ${mcu.board}`);
  lines.push(`framework = ${mcu.framework}`);
  lines.push('');
  lines.push('monitor_speed = 115200');
  lines.push('');

  // Library dependencies hints
  const libs: string[] = [];
  if (busTypes.has('i2c')) {
    // Wire is built-in, but some peripherals need explicit libs
    const i2cPeripherals = peripherals.filter((p) => p.bus === 'i2c');
    for (const p of i2cPeripherals) {
      const category = classifyPeripheral({
        nodeId: p.nodeId,
        label: p.label,
        nodeType: p.nodeType,
        positionX: 0,
        positionY: 0,
        data: null,
      });
      if (category === 'display') {
        libs.push(`; ${p.label}: adafruit/Adafruit SSD1306  ; TODO: Pick correct display library`);
      } else if (category === 'sensor') {
        libs.push(`; ${p.label}: adafruit/Adafruit Unified Sensor  ; TODO: Pick correct sensor library`);
      }
    }
  }

  if (libs.length > 0) {
    lines.push('; TODO: Uncomment and adjust library dependencies');
    lines.push('; lib_deps =');
    for (const lib of libs) {
      lines.push(`  ${lib}`);
    }
    lines.push('');
  } else {
    lines.push('; lib_deps =');
    lines.push(';   ; TODO: Add library dependencies here');
    lines.push('');
  }

  // Build flags
  lines.push('; build_flags =');
  lines.push(';   -DCORE_DEBUG_LEVEL=5  ; TODO: Set debug level (ESP32)');
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a firmware scaffold from architecture nodes and edges.
 *
 * Returns a `files` array containing main.cpp, config.h, and platformio.ini.
 * Gracefully handles cases where no MCU is found by producing a generic
 * Arduino scaffold.
 */
export function generateFirmwareScaffold(data: {
  nodes: ArchNodeData[];
  edges: ArchEdgeData[];
}): FirmwareScaffoldOutput {
  const { nodes, edges } = data;

  // 1. Identify the MCU node and its profile
  let mcuNode: ArchNodeData | null = null;
  let mcuProfile: McuProfile | null = null;

  for (const node of nodes) {
    if (isMcuNode(node)) {
      const profile = detectMcuProfile(node);
      if (profile) {
        mcuNode = node;
        mcuProfile = profile;
        break;
      }
      // First MCU node found but no specific profile — keep looking
      if (!mcuNode) {
        mcuNode = node;
      }
    }
  }

  // Fallback to generic Arduino Uno if no MCU detected
  if (!mcuProfile) {
    mcuProfile = MCU_PROFILES.arduino_uno;
  }

  // 2. Collect bus connections from edges
  const busConnections: BusConnection[] = [];
  const nodeById = new Map(nodes.map((n) => [n.nodeId, n]));

  for (const edge of edges) {
    const signalType = edge.signalType?.toLowerCase() ?? '';
    if (BUS_SIGNAL_TYPES.has(signalType) || signalType !== '') {
      const srcNode = nodeById.get(edge.source);
      const tgtNode = nodeById.get(edge.target);
      busConnections.push({
        signalType: signalType || 'gpio',
        sourceLabel: srcNode?.label ?? edge.source,
        targetLabel: tgtNode?.label ?? edge.target,
        sourceId: edge.source,
        targetId: edge.target,
        voltage: edge.voltage ?? null,
        label: edge.label ?? null,
      });
    }
  }

  // 3. Identify peripherals (all non-MCU nodes connected to the MCU)
  const mcuNodeId = mcuNode?.nodeId;
  const peripherals: PeripheralInfo[] = [];
  const processedNodeIds = new Set<string>();

  for (const node of nodes) {
    if (node.nodeId === mcuNodeId || processedNodeIds.has(node.nodeId)) {
      continue;
    }

    // Check if this node is connected to the MCU (directly)
    const connectionToMcu = mcuNodeId
      ? busConnections.find(
        (b) =>
          (b.sourceId === mcuNodeId && b.targetId === node.nodeId) ||
          (b.targetId === mcuNodeId && b.sourceId === node.nodeId),
      )
      : undefined;

    // Also include nodes connected by any edge (even if no MCU detected)
    const anyConnection = busConnections.find(
      (b) => b.sourceId === node.nodeId || b.targetId === node.nodeId,
    );

    const bus = connectionToMcu?.signalType ?? anyConnection?.signalType ?? null;
    const nodeData = node.data ?? {};

    // Skip power-only nodes
    if (bus === 'power' && !classifyPeripheral(node).match(/sensor|actuator|display|communication|storage|input/)) {
      continue;
    }

    peripherals.push({
      label: node.label,
      nodeType: node.nodeType,
      nodeId: node.nodeId,
      bus,
      description: (nodeData.description as string) ?? '',
      i2cAddress: (nodeData.i2cAddress as string) ?? (nodeData.address as string) ?? null,
    });
    processedNodeIds.add(node.nodeId);
  }

  // 4. Generate files
  const configH = generateConfigH(mcuProfile, peripherals, busConnections);
  const mainCpp = generateMainCpp(mcuProfile, peripherals, busConnections);
  const platformioIni = generatePlatformioIni(mcuProfile, busConnections, peripherals);

  return {
    files: [
      { filename: 'src/main.cpp', content: mainCpp },
      { filename: 'include/config.h', content: configH },
      { filename: 'platformio.ini', content: platformioIni },
    ],
  };
}
