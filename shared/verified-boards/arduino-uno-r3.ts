/**
 * Arduino Uno R3 — Verified Board Definition
 *
 * ATmega328P-based board: 14 digital I/O (6 PWM), 6 analog inputs,
 * 16 MHz ceramic resonator, USB-B, power jack, ICSP header.
 *
 * Sources:
 * - https://docs.arduino.cc/hardware/uno-rev3
 * - https://docs.arduino.cc/resources/datasheets/A000066-datasheet.pdf
 * - https://content.arduino.cc/assets/Pinout-UNOrev3_latest.pdf
 */

import type { VerifiedBoardDefinition, VerifiedPin, VerifiedBus, HeaderGroup } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function digitalPin(
  num: number,
  headerGroup: string,
  headerPosition: number,
  extras?: Partial<VerifiedPin>,
): VerifiedPin {
  return {
    id: `D${num}`,
    name: String(num),
    headerGroup,
    headerPosition,
    role: 'digital',
    direction: 'bidirectional',
    voltage: 5,
    maxCurrent: 40,
    functions: [],
    ...extras,
  };
}

function analogPin(num: number, headerPosition: number): VerifiedPin {
  return {
    id: `A${num}`,
    name: `A${num}`,
    headerGroup: 'analog',
    headerPosition,
    role: 'analog',
    direction: 'bidirectional',
    voltage: 5,
    maxCurrent: 40,
    functions: [
      { type: 'adc', channel: `ADC${num}`, notes: '10-bit resolution (0-1023)' },
    ],
  };
}

// ---------------------------------------------------------------------------
// Pin definitions
// ---------------------------------------------------------------------------

const POWER_PINS: VerifiedPin[] = [
  { id: 'IOREF', name: 'IOREF', headerGroup: 'power', headerPosition: 0, role: 'power', direction: 'output', voltage: 5, functions: [], warnings: ['Reference voltage for shields'] },
  { id: 'RESET_PWR', name: 'RESET', headerGroup: 'power', headerPosition: 1, role: 'control', direction: 'input', voltage: 5, functions: [] },
  { id: '3V3', name: '3.3V', headerGroup: 'power', headerPosition: 2, role: 'power', direction: 'power', voltage: 3.3, functions: [], warnings: ['Max 50mA from on-board regulator'] },
  { id: '5V', name: '5V', headerGroup: 'power', headerPosition: 3, role: 'power', direction: 'power', voltage: 5, functions: [] },
  { id: 'GND1', name: 'GND', headerGroup: 'power', headerPosition: 4, role: 'ground', direction: 'power', voltage: 0, functions: [] },
  { id: 'GND2', name: 'GND', headerGroup: 'power', headerPosition: 5, role: 'ground', direction: 'power', voltage: 0, functions: [] },
  { id: 'VIN', name: 'VIN', headerGroup: 'power', headerPosition: 6, role: 'power', direction: 'power', voltage: 7, functions: [], warnings: ['Input voltage 7-12V recommended, 6-20V absolute max'] },
];

const DIGITAL_PINS: VerifiedPin[] = [
  digitalPin(0, 'digital', 0, {
    role: 'communication',
    functions: [{ type: 'uart', signal: 'RX', channel: 'UART0', bus: 'serial0' }],
    warnings: ['Shared with USB-to-serial — avoid for general I/O when using Serial Monitor'],
  }),
  digitalPin(1, 'digital', 1, {
    role: 'communication',
    functions: [{ type: 'uart', signal: 'TX', channel: 'UART0', bus: 'serial0' }],
    warnings: ['Shared with USB-to-serial — avoid for general I/O when using Serial Monitor'],
  }),
  digitalPin(2, 'digital', 2, {
    functions: [{ type: 'interrupt', channel: 'INT0' }],
  }),
  digitalPin(3, 'digital', 3, {
    functions: [
      { type: 'pwm', channel: 'OC2B', notes: 'Timer2, 490Hz' },
      { type: 'interrupt', channel: 'INT1' },
    ],
  }),
  digitalPin(4, 'digital', 4),
  digitalPin(5, 'digital', 5, {
    functions: [{ type: 'pwm', channel: 'OC0B', notes: 'Timer0, 980Hz' }],
  }),
  digitalPin(6, 'digital', 6, {
    functions: [{ type: 'pwm', channel: 'OC0A', notes: 'Timer0, 980Hz' }],
  }),
  digitalPin(7, 'digital', 7),
  digitalPin(8, 'digital-high', 0),
  digitalPin(9, 'digital-high', 1, {
    functions: [{ type: 'pwm', channel: 'OC1A', notes: 'Timer1, 490Hz' }],
  }),
  digitalPin(10, 'digital-high', 2, {
    functions: [
      { type: 'pwm', channel: 'OC1B', notes: 'Timer1, 490Hz' },
      { type: 'spi', signal: 'SS', bus: 'spi0' },
    ],
  }),
  digitalPin(11, 'digital-high', 3, {
    functions: [
      { type: 'pwm', channel: 'OC2A', notes: 'Timer2, 490Hz' },
      { type: 'spi', signal: 'MOSI', bus: 'spi0' },
    ],
  }),
  digitalPin(12, 'digital-high', 4, {
    functions: [{ type: 'spi', signal: 'MISO', bus: 'spi0' }],
  }),
  digitalPin(13, 'digital-high', 5, {
    functions: [{ type: 'spi', signal: 'SCK', bus: 'spi0' }],
    warnings: ['Connected to on-board LED — may affect external circuits'],
  }),
  { id: 'GND3', name: 'GND', headerGroup: 'digital-high', headerPosition: 6, role: 'ground', direction: 'power', voltage: 0, functions: [] },
  { id: 'AREF', name: 'AREF', headerGroup: 'digital-high', headerPosition: 7, role: 'control', direction: 'input', voltage: 5, functions: [], warnings: ['External ADC reference voltage — do not exceed VCC'] },
  { id: 'SDA', name: 'SDA', headerGroup: 'digital-high', headerPosition: 8, role: 'communication', direction: 'bidirectional', voltage: 5, maxCurrent: 40, functions: [{ type: 'i2c', signal: 'SDA', bus: 'i2c0' }] },
  { id: 'SCL', name: 'SCL', headerGroup: 'digital-high', headerPosition: 9, role: 'communication', direction: 'bidirectional', voltage: 5, maxCurrent: 40, functions: [{ type: 'i2c', signal: 'SCL', bus: 'i2c0' }] },
];

const ANALOG_PINS: VerifiedPin[] = [
  analogPin(0, 0),
  analogPin(1, 1),
  analogPin(2, 2),
  analogPin(3, 3),
  analogPin(4, 4),
  analogPin(5, 5),
];

// A4/A5 also serve as I2C
ANALOG_PINS[4].functions.push({ type: 'i2c', signal: 'SDA', bus: 'i2c0' });
ANALOG_PINS[5].functions.push({ type: 'i2c', signal: 'SCL', bus: 'i2c0' });

const ALL_PINS = [...POWER_PINS, ...DIGITAL_PINS, ...ANALOG_PINS];

// ---------------------------------------------------------------------------
// Bus definitions
// ---------------------------------------------------------------------------

const BUSES: VerifiedBus[] = [
  { id: 'serial0', name: 'Serial (USB)', type: 'uart', pinIds: ['D0', 'D1'], protocol: 'UART TTL 5V', notes: 'Shared with USB-to-serial converter' },
  { id: 'spi0', name: 'SPI', type: 'spi', pinIds: ['D10', 'D11', 'D12', 'D13'], protocol: 'SPI Mode 0/1/2/3' },
  { id: 'i2c0', name: 'I2C (Wire)', type: 'i2c', pinIds: ['SDA', 'SCL', 'A4', 'A5'], protocol: 'I2C up to 400kHz', notes: 'A4=SDA, A5=SCL; dedicated SDA/SCL pins added in R3' },
];

// ---------------------------------------------------------------------------
// Header layout
// ---------------------------------------------------------------------------

const HEADER_LAYOUT: HeaderGroup[] = [
  { id: 'power', name: 'Power Header', side: 'left', pinCount: 7, pinIds: ['IOREF', 'RESET_PWR', '3V3', '5V', 'GND1', 'GND2', 'VIN'] },
  { id: 'analog', name: 'Analog Inputs', side: 'left', pinCount: 6, pinIds: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'] },
  { id: 'digital', name: 'Digital 0-7', side: 'right', pinCount: 8, pinIds: ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'] },
  { id: 'digital-high', name: 'Digital 8-13 + AREF + SDA/SCL', side: 'right', pinCount: 10, pinIds: ['D8', 'D9', 'D10', 'D11', 'D12', 'D13', 'GND3', 'AREF', 'SDA', 'SCL'] },
];

// ---------------------------------------------------------------------------
// Board definition
// ---------------------------------------------------------------------------

export const ARDUINO_UNO_R3: VerifiedBoardDefinition = {
  id: 'arduino-uno-r3',
  title: 'Arduino Uno R3',
  manufacturer: 'Arduino',
  mpn: 'A000066',
  aliases: ['Arduino Uno', 'Uno R3', 'Uno Rev3', 'ATmega328P board'],
  family: 'board-module',
  description: 'ATmega328P-based board with 14 digital I/O (6 PWM), 6 analog inputs, 16 MHz resonator, USB-B, and power jack. The most popular Arduino board for beginners.',

  dimensions: { width: 68.6, height: 53.4, thickness: 15 },
  breadboardFit: 'not_breadboard_friendly',
  breadboardNotes: 'At 68.6mm wide, the Uno is too wide for a standard breadboard. Use jumper wires from the female headers to the breadboard.',
  pinSpacing: 2.54,
  headerLayout: HEADER_LAYOUT,

  operatingVoltage: 5,
  inputVoltageRange: [7, 12],
  maxCurrentPerPin: 40,
  maxTotalCurrent: 200,

  pins: ALL_PINS,
  buses: BUSES,

  evidence: [
    { type: 'datasheet', label: 'Arduino UNO R3 Datasheet (A000066)', href: 'https://docs.arduino.cc/resources/datasheets/A000066-datasheet.pdf', supports: ['pins', 'dimensions', 'labels'], confidence: 'high', reviewStatus: 'accepted' },
    { type: 'pinout', label: 'Arduino UNO R3 Official Pinout PDF', href: 'https://content.arduino.cc/assets/Pinout-UNOrev3_latest.pdf', supports: ['pins', 'labels'], confidence: 'high', reviewStatus: 'accepted' },
    { type: 'datasheet', label: 'Arduino UNO R3 Hardware Docs', href: 'https://docs.arduino.cc/hardware/uno-rev3', supports: ['pins', 'dimensions', 'breadboard-fit'], confidence: 'high', reviewStatus: 'accepted' },
  ],
  verificationNotes: [
    'Pin data cross-referenced with official Arduino UNO R3 datasheet and pinout PDF',
    'PWM frequencies verified against ATmega328P Timer assignments',
    'I2C pins verified: A4/A5 share I2C with dedicated SDA/SCL pins added in R3 revision',
  ],
  warnings: [
    'Total current across all I/O pins must not exceed 200mA',
    '5V logic — level shifting required for 3.3V devices',
    'D0/D1 shared with USB serial — avoid using with Serial Monitor active',
    'D13 has on-board LED that may interfere with external circuits',
  ],
};
