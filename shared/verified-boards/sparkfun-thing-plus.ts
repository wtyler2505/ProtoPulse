/**
 * SparkFun Thing Plus ESP32 WROOM — Verified Board Definition
 *
 * ESP32-D0WDQ6 dual-core at 240MHz, 520KB SRAM, 16MB flash,
 * WiFi + BLE, Feather-compatible form factor with Qwiic connector.
 *
 * Sources:
 * - https://www.sparkfun.com/sparkfun-thing-plus-esp32-wroom-usb-c.html
 * - https://learn.sparkfun.com/tutorials/esp32-thing-plus-hookup-guide/all
 * - https://docs.sparkfun.com/SparkFun_Thing_Plus_ESP32_WROOM_C/hardware_overview/
 */

import type { VerifiedBoardDefinition, VerifiedPin, VerifiedBus, HeaderGroup, BootPinConfig } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gpioPin(
  num: number,
  name: string,
  headerGroup: string,
  headerPosition: number,
  extras?: Partial<VerifiedPin>,
): VerifiedPin {
  return {
    id: `GPIO${num}`,
    name,
    headerGroup,
    headerPosition,
    role: 'digital',
    direction: 'bidirectional',
    voltage: 3.3,
    maxCurrent: 12,
    functions: [],
    ...extras,
  };
}

// ---------------------------------------------------------------------------
// Pin definitions — Feather-compatible layout (16 left + 12 right)
// ---------------------------------------------------------------------------

const LEFT_HEADER: VerifiedPin[] = [
  { id: 'RST', name: 'RST', headerGroup: 'left', headerPosition: 0, role: 'control', direction: 'input', voltage: 3.3, functions: [] },
  { id: '3V3', name: '3V3', headerGroup: 'left', headerPosition: 1, role: 'power', direction: 'power', voltage: 3.3, functions: [] },
  gpioPin(36, 'A0', 'left', 2, {
    role: 'analog', direction: 'input',
    functions: [{ type: 'adc', channel: 'ADC1_CH0', notes: '12-bit, input-only' }],
  }),
  gpioPin(39, 'A1', 'left', 3, {
    role: 'analog', direction: 'input',
    functions: [{ type: 'adc', channel: 'ADC1_CH3', notes: '12-bit, input-only' }],
  }),
  gpioPin(34, 'A2', 'left', 4, {
    role: 'analog', direction: 'input',
    functions: [{ type: 'adc', channel: 'ADC1_CH6', notes: '12-bit, input-only' }],
  }),
  gpioPin(4, 'A3', 'left', 5, {
    role: 'analog',
    functions: [
      { type: 'adc', channel: 'ADC2_CH0', notes: '12-bit, unavailable when WiFi active' },
      { type: 'touch', channel: 'TOUCH0' },
    ],
  }),
  gpioPin(25, 'A4', 'left', 6, {
    role: 'analog',
    functions: [
      { type: 'adc', channel: 'ADC2_CH8', notes: '12-bit, unavailable when WiFi active' },
      { type: 'dac', channel: 'DAC1' },
    ],
  }),
  gpioPin(26, 'A5', 'left', 7, {
    role: 'analog',
    functions: [
      { type: 'adc', channel: 'ADC2_CH9', notes: '12-bit, unavailable when WiFi active' },
      { type: 'dac', channel: 'DAC2' },
    ],
  }),
  gpioPin(18, 'SCK', 'left', 8, {
    role: 'communication',
    functions: [{ type: 'spi', signal: 'SCK', bus: 'vspi' }],
  }),
  gpioPin(23, 'MOSI', 'left', 9, {
    role: 'communication',
    functions: [{ type: 'spi', signal: 'MOSI', bus: 'vspi' }],
  }),
  gpioPin(19, 'MISO', 'left', 10, {
    role: 'communication',
    functions: [{ type: 'spi', signal: 'MISO', bus: 'vspi' }],
  }),
  gpioPin(16, 'RX', 'left', 11, {
    role: 'communication',
    functions: [{ type: 'uart', signal: 'RX', channel: 'UART2', bus: 'serial2' }],
  }),
  gpioPin(17, 'TX', 'left', 12, {
    role: 'communication',
    functions: [{ type: 'uart', signal: 'TX', channel: 'UART2', bus: 'serial2' }],
  }),
  gpioPin(21, 'SDA', 'left', 13, {
    role: 'communication',
    functions: [{ type: 'i2c', signal: 'SDA', bus: 'i2c0' }],
  }),
  gpioPin(22, 'SCL', 'left', 14, {
    role: 'communication',
    functions: [{ type: 'i2c', signal: 'SCL', bus: 'i2c0' }],
  }),
  { id: 'GND1', name: 'GND', headerGroup: 'left', headerPosition: 15, role: 'ground', direction: 'power', voltage: 0, functions: [] },
];

const RIGHT_HEADER: VerifiedPin[] = [
  { id: 'VBAT', name: 'BAT', headerGroup: 'right', headerPosition: 0, role: 'power', direction: 'power', voltage: 4.2, functions: [], warnings: ['LiPo battery voltage'] },
  { id: 'EN', name: 'EN', headerGroup: 'right', headerPosition: 1, role: 'control', direction: 'input', voltage: 3.3, functions: [], warnings: ['Pull LOW to disable regulator'] },
  { id: 'VUSB', name: 'USB', headerGroup: 'right', headerPosition: 2, role: 'power', direction: 'power', voltage: 5, functions: [], warnings: ['USB 5V only when USB connected'] },
  gpioPin(13, '13', 'right', 3, {
    functions: [
      { type: 'pwm' },
      { type: 'adc', channel: 'ADC2_CH4', notes: 'Unavailable when WiFi active' },
      { type: 'touch', channel: 'TOUCH4' },
    ],
    warnings: ['Connected to on-board LED'],
  }),
  gpioPin(12, '12', 'right', 4, {
    functions: [
      { type: 'pwm' },
      { type: 'adc', channel: 'ADC2_CH5', notes: 'Unavailable when WiFi active' },
      { type: 'touch', channel: 'TOUCH5' },
    ],
    warnings: ['Strapping pin — affects boot mode'],
  }),
  gpioPin(27, '27', 'right', 5, {
    functions: [
      { type: 'pwm' },
      { type: 'adc', channel: 'ADC2_CH7', notes: 'Unavailable when WiFi active' },
      { type: 'touch', channel: 'TOUCH7' },
    ],
  }),
  gpioPin(33, '33', 'right', 6, {
    functions: [
      { type: 'pwm' },
      { type: 'adc', channel: 'ADC1_CH5', notes: '12-bit' },
      { type: 'touch', channel: 'TOUCH8' },
    ],
  }),
  gpioPin(15, '15', 'right', 7, {
    functions: [
      { type: 'pwm' },
      { type: 'adc', channel: 'ADC2_CH3', notes: 'Unavailable when WiFi active' },
      { type: 'touch', channel: 'TOUCH3' },
    ],
    warnings: ['Strapping pin — outputs PWM at boot'],
  }),
  gpioPin(32, '32', 'right', 8, {
    functions: [
      { type: 'pwm' },
      { type: 'adc', channel: 'ADC1_CH4', notes: '12-bit' },
      { type: 'touch', channel: 'TOUCH9' },
    ],
  }),
  gpioPin(14, '14', 'right', 9, {
    functions: [
      { type: 'pwm' },
      { type: 'adc', channel: 'ADC2_CH6', notes: 'Unavailable when WiFi active' },
      { type: 'touch', channel: 'TOUCH6' },
    ],
  }),
  gpioPin(5, 'SS', 'right', 10, {
    functions: [
      { type: 'spi', signal: 'SS', bus: 'vspi' },
    ],
    warnings: ['Strapping pin — must be HIGH at boot for SPI flash'],
  }),
  { id: 'GND2', name: 'GND', headerGroup: 'right', headerPosition: 11, role: 'ground', direction: 'power', voltage: 0, functions: [] },
];

const ALL_PINS = [...LEFT_HEADER, ...RIGHT_HEADER];

// ---------------------------------------------------------------------------
// Bus definitions
// ---------------------------------------------------------------------------

const BUSES: VerifiedBus[] = [
  { id: 'serial2', name: 'Serial2 (UART2)', type: 'uart', pinIds: ['GPIO16', 'GPIO17'], protocol: 'UART 3.3V' },
  { id: 'vspi', name: 'VSPI', type: 'spi', pinIds: ['GPIO18', 'GPIO23', 'GPIO19', 'GPIO5'], protocol: 'SPI up to 80MHz' },
  { id: 'i2c0', name: 'I2C (Wire)', type: 'i2c', pinIds: ['GPIO21', 'GPIO22'], protocol: 'I2C up to 400kHz', notes: 'Also connected to Qwiic connector' },
];

// ---------------------------------------------------------------------------
// Header layout
// ---------------------------------------------------------------------------

const HEADER_LAYOUT: HeaderGroup[] = [
  { id: 'left', name: 'Left Header (RST→GND)', side: 'left', pinCount: 16, pinIds: LEFT_HEADER.map((p) => p.id) },
  { id: 'right', name: 'Right Header (BAT→GND)', side: 'right', pinCount: 12, pinIds: RIGHT_HEADER.map((p) => p.id) },
];

// ---------------------------------------------------------------------------
// Boot pins
// ---------------------------------------------------------------------------

const BOOT_PINS: BootPinConfig[] = [
  { pinId: 'GPIO0', highBehavior: 'Normal boot from SPI flash', lowBehavior: 'Enter download mode (programming)', internalDefault: 'high', designRule: 'Do not pull low unless programming via UART' },
  { pinId: 'GPIO12', highBehavior: 'Sets flash voltage to 1.8V (may brick with 3.3V flash)', lowBehavior: 'Sets flash voltage to 3.3V (standard)', internalDefault: 'low', designRule: 'CRITICAL: Never pull high at boot — risks permanent damage to flash' },
  { pinId: 'GPIO5', highBehavior: 'Required for SPI boot (normal operation)', lowBehavior: 'May prevent boot', internalDefault: 'high', designRule: 'Keep high at boot for normal operation' },
  { pinId: 'GPIO15', highBehavior: 'Normal operation, UART debug output at boot', lowBehavior: 'Silences boot UART output', internalDefault: 'high', designRule: 'Safe to pull low to silence boot messages' },
];

// ---------------------------------------------------------------------------
// Board definition
// ---------------------------------------------------------------------------

export const SPARKFUN_THING_PLUS: VerifiedBoardDefinition = {
  id: 'sparkfun-thing-plus-esp32',
  title: 'SparkFun Thing Plus ESP32 WROOM',
  manufacturer: 'SparkFun',
  mpn: 'WRL-20168',
  aliases: ['Thing Plus', 'SparkFun ESP32', 'Thing Plus ESP32', 'ESP32 Thing Plus'],
  family: 'board-module',
  description: 'ESP32-D0WDQ6 dual-core at 240MHz with Feather-compatible form factor, Qwiic I2C connector, WiFi + BLE, LiPo charging. 21 GPIO, 2 DAC, 16 ADC, touch sensing.',

  dimensions: { width: 23, height: 58, thickness: 8 },
  breadboardFit: 'native',
  breadboardNotes: 'Feather/Thing Plus form factor (23mm wide) fits across the center channel of a standard breadboard. 16 pins left, 12 pins right at 0.1" pitch.',
  pinSpacing: 2.54,
  headerLayout: HEADER_LAYOUT,

  operatingVoltage: 3.3,
  inputVoltageRange: [3.4, 6],
  maxCurrentPerPin: 12,
  maxTotalCurrent: 50,

  pins: ALL_PINS,
  buses: BUSES,

  evidence: [
    { type: 'pinout', label: 'SparkFun Thing Plus ESP32 Hardware Overview', href: 'https://docs.sparkfun.com/SparkFun_Thing_Plus_ESP32_WROOM_C/hardware_overview/', supports: ['pins', 'labels', 'dimensions'], confidence: 'high', reviewStatus: 'accepted' },
    { type: 'datasheet', label: 'SparkFun ESP32 Thing Plus Hookup Guide', href: 'https://learn.sparkfun.com/tutorials/esp32-thing-plus-hookup-guide/all', supports: ['pins', 'labels', 'breadboard-fit'], confidence: 'high', reviewStatus: 'accepted' },
  ],
  verificationNotes: [
    'Feather-compatible pin layout — works with Feather Wings',
    'Qwiic connector shares I2C bus with SDA/SCL header pins',
    'GPIO36/39/34 are input-only (no internal pull-up/down)',
    'ADC2 channels unavailable when WiFi is active',
    'ESP32 strapping pins affect boot mode — see bootPins',
  ],
  warnings: [
    '3.3V logic ONLY — do NOT apply 5V to GPIO pins',
    'GPIO36/39/34 are input-only — cannot be used as outputs',
    'ADC2 pins cannot read analog when WiFi is active',
    'GPIO12 strapping pin — pulling HIGH at boot can brick the board',
    'LiPo connector polarity must match (check before connecting)',
  ],
  bootPins: BOOT_PINS,
};
