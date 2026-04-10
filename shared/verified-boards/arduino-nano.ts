/**
 * Arduino Nano — Verified Board Definition
 *
 * ATmega328P-based board: 14 digital I/O (6 PWM), 8 analog inputs,
 * 16 MHz, Mini-B USB. Breadboard-friendly DIP form factor.
 *
 * Sources:
 * - https://docs.arduino.cc/hardware/nano
 * - https://docs.arduino.cc/resources/datasheets/A000005-datasheet.pdf
 * - https://store.arduino.cc/products/arduino-nano
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
    name: `D${num}`,
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

function analogPin(num: number, headerGroup: string, headerPosition: number): VerifiedPin {
  return {
    id: `A${num}`,
    name: `A${num}`,
    headerGroup,
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
// Pin definitions — 30 pins total (2x15 DIP layout)
// ---------------------------------------------------------------------------

// Left header (top to bottom, USB connector at top): D1, D0, RST, GND, D2...D12
const LEFT_HEADER: VerifiedPin[] = [
  digitalPin(1, 'left', 0, {
    role: 'communication',
    functions: [{ type: 'uart', signal: 'TX', channel: 'UART0', bus: 'serial0' }],
    warnings: ['Shared with USB-to-serial'],
  }),
  digitalPin(0, 'left', 1, {
    role: 'communication',
    functions: [{ type: 'uart', signal: 'RX', channel: 'UART0', bus: 'serial0' }],
    warnings: ['Shared with USB-to-serial'],
  }),
  { id: 'RST', name: 'RST', headerGroup: 'left', headerPosition: 2, role: 'control', direction: 'input', voltage: 5, functions: [] },
  { id: 'GND1', name: 'GND', headerGroup: 'left', headerPosition: 3, role: 'ground', direction: 'power', voltage: 0, functions: [] },
  digitalPin(2, 'left', 4, {
    functions: [{ type: 'interrupt', channel: 'INT0' }],
  }),
  digitalPin(3, 'left', 5, {
    functions: [
      { type: 'pwm', channel: 'OC2B', notes: 'Timer2, 490Hz' },
      { type: 'interrupt', channel: 'INT1' },
    ],
  }),
  digitalPin(4, 'left', 6),
  digitalPin(5, 'left', 7, {
    functions: [{ type: 'pwm', channel: 'OC0B', notes: 'Timer0, 980Hz' }],
  }),
  digitalPin(6, 'left', 8, {
    functions: [{ type: 'pwm', channel: 'OC0A', notes: 'Timer0, 980Hz' }],
  }),
  digitalPin(7, 'left', 9),
  digitalPin(8, 'left', 10),
  digitalPin(9, 'left', 11, {
    functions: [{ type: 'pwm', channel: 'OC1A', notes: 'Timer1, 490Hz' }],
  }),
  digitalPin(10, 'left', 12, {
    functions: [
      { type: 'pwm', channel: 'OC1B', notes: 'Timer1, 490Hz' },
      { type: 'spi', signal: 'SS', bus: 'spi0' },
    ],
  }),
  digitalPin(11, 'left', 13, {
    functions: [
      { type: 'pwm', channel: 'OC2A', notes: 'Timer2, 490Hz' },
      { type: 'spi', signal: 'MOSI', bus: 'spi0' },
    ],
  }),
  digitalPin(12, 'left', 14, {
    functions: [{ type: 'spi', signal: 'MISO', bus: 'spi0' }],
  }),
];

// Right header (top to bottom): VIN, GND, RST, 5V, A7, A6, A5, A4, A3, A2, A1, A0, AREF, 3V3, D13
const RIGHT_HEADER: VerifiedPin[] = [
  { id: 'VIN', name: 'VIN', headerGroup: 'right', headerPosition: 0, role: 'power', direction: 'power', voltage: 7, functions: [], warnings: ['Input voltage 7-12V recommended'] },
  { id: 'GND2', name: 'GND', headerGroup: 'right', headerPosition: 1, role: 'ground', direction: 'power', voltage: 0, functions: [] },
  { id: 'RST2', name: 'RST', headerGroup: 'right', headerPosition: 2, role: 'control', direction: 'input', voltage: 5, functions: [] },
  { id: '5V', name: '5V', headerGroup: 'right', headerPosition: 3, role: 'power', direction: 'power', voltage: 5, functions: [] },
  analogPin(7, 'right', 4),
  analogPin(6, 'right', 5),
  analogPin(5, 'right', 6),
  analogPin(4, 'right', 7),
  analogPin(3, 'right', 8),
  analogPin(2, 'right', 9),
  analogPin(1, 'right', 10),
  analogPin(0, 'right', 11),
  { id: 'AREF', name: 'AREF', headerGroup: 'right', headerPosition: 12, role: 'control', direction: 'input', voltage: 5, functions: [] },
  { id: '3V3', name: '3V3', headerGroup: 'right', headerPosition: 13, role: 'power', direction: 'power', voltage: 3.3, functions: [], warnings: ['Max 50mA from on-board regulator'] },
  digitalPin(13, 'right', 14, {
    functions: [{ type: 'spi', signal: 'SCK', bus: 'spi0' }],
    warnings: ['Connected to on-board LED'],
  }),
];

// A4/A5 also serve as I2C
const a4 = RIGHT_HEADER.find((p) => p.id === 'A4')!;
a4.functions.push({ type: 'i2c', signal: 'SDA', bus: 'i2c0' });
const a5 = RIGHT_HEADER.find((p) => p.id === 'A5')!;
a5.functions.push({ type: 'i2c', signal: 'SCL', bus: 'i2c0' });

const ALL_PINS = [...LEFT_HEADER, ...RIGHT_HEADER];

// ---------------------------------------------------------------------------
// Bus definitions
// ---------------------------------------------------------------------------

const BUSES: VerifiedBus[] = [
  { id: 'serial0', name: 'Serial (USB)', type: 'uart', pinIds: ['D0', 'D1'], protocol: 'UART TTL 5V', notes: 'Shared with USB-to-serial (CH340/FTDI depending on clone)' },
  { id: 'spi0', name: 'SPI', type: 'spi', pinIds: ['D10', 'D11', 'D12', 'D13'], protocol: 'SPI Mode 0/1/2/3' },
  { id: 'i2c0', name: 'I2C (Wire)', type: 'i2c', pinIds: ['A4', 'A5'], protocol: 'I2C up to 400kHz', notes: 'A4=SDA, A5=SCL' },
];

// ---------------------------------------------------------------------------
// Header layout
// ---------------------------------------------------------------------------

const HEADER_LAYOUT: HeaderGroup[] = [
  { id: 'left', name: 'Left Header (TX→D12)', side: 'left', pinCount: 15, pinIds: LEFT_HEADER.map((p) => p.id) },
  { id: 'right', name: 'Right Header (VIN→D13)', side: 'right', pinCount: 15, pinIds: RIGHT_HEADER.map((p) => p.id) },
];

// ---------------------------------------------------------------------------
// Board definition
// ---------------------------------------------------------------------------

export const ARDUINO_NANO: VerifiedBoardDefinition = {
  id: 'arduino-nano',
  title: 'Arduino Nano',
  manufacturer: 'Arduino',
  mpn: 'A000005',
  aliases: ['Nano', 'Nano V3', 'Nano 3.0', 'ATmega328P Nano'],
  family: 'board-module',
  description: 'Compact ATmega328P board (45×18mm) with 14 digital I/O (6 PWM), 8 analog inputs, and Mini-B USB. Breadboard-friendly DIP form factor.',

  dimensions: { width: 18, height: 45, thickness: 8 },
  breadboardFit: 'native',
  breadboardNotes: 'DIP form factor fits directly across the center channel of a standard breadboard. 15 pins per side at 0.1" pitch. One of the most breadboard-friendly Arduino boards.',
  pinSpacing: 2.54,
  headerLayout: HEADER_LAYOUT,

  operatingVoltage: 5,
  inputVoltageRange: [7, 12],
  maxCurrentPerPin: 40,
  maxTotalCurrent: 200,

  pins: ALL_PINS,
  buses: BUSES,

  evidence: [
    { type: 'datasheet', url: 'https://docs.arduino.cc/resources/datasheets/A000005-datasheet.pdf', retrievedAt: '2026-04-10' },
    { type: 'manufacturer', url: 'https://docs.arduino.cc/hardware/nano', retrievedAt: '2026-04-10' },
    { type: 'manufacturer', url: 'https://store.arduino.cc/products/arduino-nano', retrievedAt: '2026-04-10' },
  ],
  verificationNotes: [
    'Pin data cross-referenced with official Arduino Nano datasheet',
    'A6 and A7 are analog-input only (no digital I/O capability)',
    'Same ATmega328P as Uno R3 — identical peripheral set, different form factor',
  ],
  warnings: [
    'Total current across all I/O pins must not exceed 200mA',
    '5V logic — level shifting required for 3.3V devices',
    'D0/D1 shared with USB serial',
    'A6/A7 are analog-input only — cannot be used as digital pins',
    'Many clones use CH340 USB chip — may need separate driver',
  ],
};
