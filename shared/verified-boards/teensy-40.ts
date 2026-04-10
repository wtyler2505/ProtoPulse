/**
 * Teensy 4.0 — Verified Board Definition
 *
 * NXP iMXRT1062 ARM Cortex-M7 at 600MHz, 1MB RAM, 2MB flash.
 * DIP form factor (35.6×17.8mm), same size as Teensy 3.2.
 * 40 I/O pins (24 on edges + 10 on bottom pads + 6 via program header).
 *
 * Sources:
 * - https://www.pjrc.com/store/teensy40.html
 * - https://www.pjrc.com/teensy/pinout.html
 * - https://www.pjrc.com/teensy/techspecs.html
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
    voltage: 3.3,
    maxCurrent: 10,
    functions: [],
    ...extras,
  };
}

// ---------------------------------------------------------------------------
// Pin definitions — 40 total pins (header pins only, not bottom pads)
// Left header: GND, 0-12 (14 pins)
// Right header: VIN, GND, 3.3V, 23-13 (14 pins)
// ---------------------------------------------------------------------------

const LEFT_HEADER: VerifiedPin[] = [
  { id: 'GND1', name: 'GND', headerGroup: 'left', headerPosition: 0, role: 'ground', direction: 'power', voltage: 0, functions: [] },
  digitalPin(0, 'left', 1, {
    role: 'communication',
    functions: [
      { type: 'pwm', channel: 'FlexPWM1.1A' },
      { type: 'uart', signal: 'RX', channel: 'Serial1', bus: 'serial1' },
    ],
  }),
  digitalPin(1, 'left', 2, {
    role: 'communication',
    functions: [
      { type: 'pwm', channel: 'FlexPWM1.1B' },
      { type: 'uart', signal: 'TX', channel: 'Serial1', bus: 'serial1' },
    ],
  }),
  digitalPin(2, 'left', 3, {
    functions: [{ type: 'pwm', channel: 'FlexPWM4.2A' }],
  }),
  digitalPin(3, 'left', 4, {
    functions: [{ type: 'pwm', channel: 'FlexPWM4.2B' }],
  }),
  digitalPin(4, 'left', 5, {
    functions: [{ type: 'pwm', channel: 'FlexPWM2.0A' }],
  }),
  digitalPin(5, 'left', 6, {
    functions: [{ type: 'pwm', channel: 'FlexPWM2.1A' }],
  }),
  digitalPin(6, 'left', 7, {
    functions: [{ type: 'pwm', channel: 'FlexPWM2.2A' }],
  }),
  digitalPin(7, 'left', 8, {
    role: 'communication',
    functions: [
      { type: 'pwm', channel: 'FlexPWM1.3B' },
      { type: 'uart', signal: 'RX', channel: 'Serial2', bus: 'serial2' },
    ],
  }),
  digitalPin(8, 'left', 9, {
    role: 'communication',
    functions: [
      { type: 'pwm', channel: 'FlexPWM1.3A' },
      { type: 'uart', signal: 'TX', channel: 'Serial2', bus: 'serial2' },
    ],
  }),
  digitalPin(9, 'left', 10, {
    functions: [{ type: 'pwm', channel: 'FlexPWM2.2B' }],
  }),
  digitalPin(10, 'left', 11, {
    functions: [
      { type: 'pwm', channel: 'QuadTimer1.0' },
      { type: 'spi', signal: 'CS', bus: 'spi0' },
    ],
  }),
  digitalPin(11, 'left', 12, {
    functions: [
      { type: 'pwm', channel: 'QuadTimer1.2' },
      { type: 'spi', signal: 'MOSI', bus: 'spi0' },
    ],
  }),
  digitalPin(12, 'left', 13, {
    functions: [
      { type: 'pwm', channel: 'QuadTimer1.1' },
      { type: 'spi', signal: 'MISO', bus: 'spi0' },
    ],
  }),
];

const RIGHT_HEADER: VerifiedPin[] = [
  { id: 'VIN', name: 'VIN', headerGroup: 'right', headerPosition: 0, role: 'power', direction: 'power', voltage: 5, functions: [], warnings: ['3.6V to 5.5V input'] },
  { id: 'GND2', name: 'GND', headerGroup: 'right', headerPosition: 1, role: 'ground', direction: 'power', voltage: 0, functions: [] },
  { id: '3V3', name: '3.3V', headerGroup: 'right', headerPosition: 2, role: 'power', direction: 'power', voltage: 3.3, functions: [], warnings: ['250mA max from on-board regulator'] },
  digitalPin(23, 'right', 3, {
    role: 'analog',
    functions: [
      { type: 'pwm', channel: 'FlexPWM1.1B' },
      { type: 'adc', channel: 'A9', notes: '12-bit resolution' },
    ],
  }),
  digitalPin(22, 'right', 4, {
    role: 'analog',
    functions: [
      { type: 'pwm', channel: 'FlexPWM4.0A' },
      { type: 'adc', channel: 'A8', notes: '12-bit resolution' },
    ],
  }),
  digitalPin(21, 'right', 5, {
    role: 'analog',
    functions: [
      { type: 'pwm', channel: 'FlexPWM3.3B' },
      { type: 'adc', channel: 'A7', notes: '12-bit resolution' },
    ],
  }),
  digitalPin(20, 'right', 6, {
    role: 'analog',
    functions: [
      { type: 'pwm', channel: 'FlexPWM3.3A' },
      { type: 'adc', channel: 'A6', notes: '12-bit resolution' },
    ],
  }),
  digitalPin(19, 'right', 7, {
    role: 'communication',
    functions: [
      { type: 'pwm', channel: 'FlexPWM3.2B' },
      { type: 'i2c', signal: 'SCL', bus: 'i2c0' },
    ],
  }),
  digitalPin(18, 'right', 8, {
    role: 'communication',
    functions: [
      { type: 'pwm', channel: 'FlexPWM3.2A' },
      { type: 'i2c', signal: 'SDA', bus: 'i2c0' },
    ],
  }),
  digitalPin(17, 'right', 9, {
    role: 'analog',
    functions: [
      { type: 'pwm', channel: 'FlexPWM3.1B' },
      { type: 'adc', channel: 'A3', notes: '12-bit resolution' },
    ],
  }),
  digitalPin(16, 'right', 10, {
    role: 'analog',
    functions: [
      { type: 'pwm', channel: 'FlexPWM3.1A' },
      { type: 'adc', channel: 'A2', notes: '12-bit resolution' },
    ],
  }),
  digitalPin(15, 'right', 11, {
    role: 'analog',
    functions: [
      { type: 'pwm', channel: 'FlexPWM3.0B' },
      { type: 'adc', channel: 'A1', notes: '12-bit resolution' },
    ],
  }),
  digitalPin(14, 'right', 12, {
    role: 'analog',
    functions: [
      { type: 'pwm', channel: 'FlexPWM3.0A' },
      { type: 'adc', channel: 'A0', notes: '12-bit resolution' },
    ],
  }),
  digitalPin(13, 'right', 13, {
    functions: [
      { type: 'pwm', channel: 'FlexPWM2.0B' },
      { type: 'spi', signal: 'SCK', bus: 'spi0' },
    ],
    warnings: ['Connected to on-board LED'],
  }),
];

const ALL_PINS = [...LEFT_HEADER, ...RIGHT_HEADER];

// ---------------------------------------------------------------------------
// Bus definitions
// ---------------------------------------------------------------------------

const BUSES: VerifiedBus[] = [
  { id: 'serial1', name: 'Serial1', type: 'uart', pinIds: ['D0', 'D1'], protocol: 'UART 3.3V', notes: 'Hardware UART, not shared with USB' },
  { id: 'serial2', name: 'Serial2', type: 'uart', pinIds: ['D7', 'D8'], protocol: 'UART 3.3V' },
  { id: 'spi0', name: 'SPI', type: 'spi', pinIds: ['D10', 'D11', 'D12', 'D13'], protocol: 'SPI up to 22MHz (LPSPI4)' },
  { id: 'i2c0', name: 'I2C (Wire)', type: 'i2c', pinIds: ['D18', 'D19'], protocol: 'I2C up to 1MHz', notes: 'D18=SDA, D19=SCL (LPI2C1)' },
];

// ---------------------------------------------------------------------------
// Header layout
// ---------------------------------------------------------------------------

const HEADER_LAYOUT: HeaderGroup[] = [
  { id: 'left', name: 'Left Header (GND→12)', side: 'left', pinCount: 14, pinIds: LEFT_HEADER.map((p) => p.id) },
  { id: 'right', name: 'Right Header (VIN→13)', side: 'right', pinCount: 14, pinIds: RIGHT_HEADER.map((p) => p.id) },
];

// ---------------------------------------------------------------------------
// Board definition
// ---------------------------------------------------------------------------

export const TEENSY_40: VerifiedBoardDefinition = {
  id: 'teensy-40',
  title: 'Teensy 4.0',
  manufacturer: 'PJRC',
  mpn: 'DEV-15583',
  aliases: ['Teensy 4', 'Teensy4.0', 'PJRC Teensy 4.0', 'iMXRT1062'],
  family: 'board-module',
  description: 'NXP iMXRT1062 ARM Cortex-M7 at 600MHz with 1MB RAM, 2MB flash. DIP form factor (35.6×17.8mm), same size as Teensy 3.2. USB native, 40 digital I/O, 14 analog, multiple serial/SPI/I2C.',

  dimensions: { width: 17.8, height: 35.6, thickness: 5 },
  breadboardFit: 'native',
  breadboardNotes: 'DIP form factor (17.8mm wide) fits across the center channel of a standard breadboard. 14 pins per side at 0.1" pitch. Castellated pads on bottom for additional I/O.',
  pinSpacing: 2.54,
  headerLayout: HEADER_LAYOUT,

  operatingVoltage: 3.3,
  inputVoltageRange: [3.6, 5.5],
  maxCurrentPerPin: 10,
  maxTotalCurrent: 100,

  pins: ALL_PINS,
  buses: BUSES,

  evidence: [
    { type: 'datasheet', label: 'PJRC Teensy 4.0 Product Page', href: 'https://www.pjrc.com/store/teensy40.html', supports: ['pins', 'dimensions', 'labels'], confidence: 'high', reviewStatus: 'accepted' },
    { type: 'pinout', label: 'PJRC Teensy Pinout Reference', href: 'https://www.pjrc.com/teensy/pinout.html', supports: ['pins', 'labels'], confidence: 'high', reviewStatus: 'accepted' },
    { type: 'datasheet', label: 'PJRC Teensy Technical Specs', href: 'https://www.pjrc.com/teensy/techspecs.html', supports: ['pins', 'dimensions'], confidence: 'high', reviewStatus: 'accepted' },
  ],
  verificationNotes: [
    'Pin data from PJRC official pinout page and tech specs',
    'Header pins only (28 edge pins) — bottom pads (10 additional) and program header (6) not included',
    '600MHz ARM Cortex-M7 — fastest Arduino-compatible board',
    'All digital pins capable of PWM via FlexPWM or QuadTimer',
    'USB is native (not FTDI/CH340) — appears as HID/Serial/MIDI natively',
  ],
  warnings: [
    '3.3V logic ONLY — NOT 5V tolerant on ANY pin',
    'Max 10mA per GPIO pin (lower than most Arduino boards)',
    'VIN accepts 3.6-5.5V — do not exceed 5.5V',
    'No on-board voltage regulator for barrel jack — must use regulated supply',
    'Bottom pads require soldering for access — not available via breadboard',
  ],
};
