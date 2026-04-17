/**
 * Arduino Mega 2560 R3 — Verified Board Definition
 *
 * ATmega2560-based board: 54 digital I/O (15 PWM), 16 analog inputs,
 * 4 hardware UARTs, SPI, I2C, 6 external interrupts, 16 MHz.
 *
 * Sources:
 * - https://store.arduino.cc/products/arduino-mega-2560-rev3
 * - https://docs.arduino.cc/resources/datasheets/A000067-datasheet.pdf
 * - https://docs.arduino.cc/hardware/mega-2560/
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
  { id: 'VIN', name: 'VIN', headerGroup: 'power', headerPosition: 0, role: 'power', direction: 'power', voltage: 7, functions: [], warnings: ['Input voltage 7-12V recommended, 6-20V absolute max'] },
  { id: 'GND1', name: 'GND', headerGroup: 'power', headerPosition: 1, role: 'ground', direction: 'power', voltage: 0, functions: [] },
  { id: 'GND2', name: 'GND', headerGroup: 'power', headerPosition: 2, role: 'ground', direction: 'power', voltage: 0, functions: [] },
  { id: '5V', name: '5V', headerGroup: 'power', headerPosition: 3, role: 'power', direction: 'power', voltage: 5, functions: [] },
  { id: '3V3', name: '3.3V', headerGroup: 'power', headerPosition: 4, role: 'power', direction: 'power', voltage: 3.3, functions: [], warnings: ['Max 50mA from on-board regulator'] },
  { id: 'RESET_PWR', name: 'RESET', headerGroup: 'power', headerPosition: 5, role: 'control', direction: 'input', voltage: 5, functions: [] },
  { id: 'IOREF', name: 'IOREF', headerGroup: 'power', headerPosition: 6, role: 'power', direction: 'output', voltage: 5, functions: [], warnings: ['Reference voltage for shields'] },
  { id: 'NC', name: 'NC', headerGroup: 'power', headerPosition: 7, role: 'nc', direction: 'input', voltage: 0, functions: [] },
];

// Pins 0-1 (Serial0 / USB — part of comm header)
const SERIAL0_PINS: VerifiedPin[] = [
  digitalPin(0, 'comm', 0, {
    role: 'communication',
    functions: [{ type: 'uart', signal: 'RX', channel: 'UART0', bus: 'serial0' }],
    warnings: ['Shared with USB-to-serial — avoid for general I/O when using Serial Monitor'],
  }),
  digitalPin(1, 'comm', 1, {
    role: 'communication',
    functions: [{ type: 'uart', signal: 'TX', channel: 'UART0', bus: 'serial0' }],
    warnings: ['Shared with USB-to-serial — avoid for general I/O when using Serial Monitor'],
  }),
];

// Digital pins 2-13 + GND + AREF (digital low header)
const DIGITAL_LOW_PINS: VerifiedPin[] = [
  digitalPin(2, 'digital-low', 0, {
    functions: [
      { type: 'pwm', channel: 'PWM2' },
      { type: 'interrupt', channel: 'INT0' },
      { type: 'timer', channel: 'Timer3B' },
    ],
  }),
  digitalPin(3, 'digital-low', 1, {
    functions: [
      { type: 'pwm', channel: 'PWM3' },
      { type: 'interrupt', channel: 'INT1' },
      { type: 'timer', channel: 'Timer3C' },
    ],
  }),
  digitalPin(4, 'digital-low', 2, {
    functions: [
      { type: 'pwm', channel: 'PWM4', notes: '980 Hz default (Timer0)' },
      { type: 'timer', channel: 'Timer0B' },
    ],
  }),
  digitalPin(5, 'digital-low', 3, {
    functions: [
      { type: 'pwm', channel: 'PWM5' },
      { type: 'timer', channel: 'Timer3A' },
    ],
  }),
  digitalPin(6, 'digital-low', 4, {
    functions: [
      { type: 'pwm', channel: 'PWM6' },
      { type: 'timer', channel: 'Timer4A' },
    ],
  }),
  digitalPin(7, 'digital-low', 5, {
    functions: [
      { type: 'pwm', channel: 'PWM7' },
      { type: 'timer', channel: 'Timer4B' },
    ],
  }),
  // NOTE: Gap between pin 7 and 8 is 160mil (not 100mil) — Uno shield compatibility
  digitalPin(8, 'digital-low', 6, {
    functions: [
      { type: 'pwm', channel: 'PWM8' },
      { type: 'timer', channel: 'Timer4C' },
    ],
  }),
  digitalPin(9, 'digital-low', 7, {
    functions: [
      { type: 'pwm', channel: 'PWM9' },
      { type: 'timer', channel: 'Timer2B' },
    ],
  }),
  digitalPin(10, 'digital-low', 8, {
    functions: [
      { type: 'pwm', channel: 'PWM10' },
      { type: 'timer', channel: 'Timer2A' },
    ],
  }),
  digitalPin(11, 'digital-low', 9, {
    functions: [
      { type: 'pwm', channel: 'PWM11' },
      { type: 'timer', channel: 'Timer1A' },
    ],
  }),
  digitalPin(12, 'digital-low', 10, {
    functions: [
      { type: 'pwm', channel: 'PWM12' },
      { type: 'timer', channel: 'Timer1B' },
    ],
  }),
  digitalPin(13, 'digital-low', 11, {
    functions: [
      { type: 'pwm', channel: 'PWM13', notes: '980 Hz default (Timer0)' },
      { type: 'timer', channel: 'Timer0A' },
    ],
    warnings: ['Connected to on-board LED'],
  }),
  // GND and AREF near digital low header
  { id: 'GND3', name: 'GND', headerGroup: 'digital-low', headerPosition: 12, role: 'ground', direction: 'power', voltage: 0, functions: [] },
  { id: 'AREF', name: 'AREF', headerGroup: 'digital-low', headerPosition: 13, role: 'control', direction: 'input', voltage: 5, functions: [], warnings: ['External analog reference voltage — do not exceed operating voltage'] },
];

// Serial communication pins (14-21)
const SERIAL_PINS: VerifiedPin[] = [
  digitalPin(14, 'comm', 2, {
    role: 'communication',
    functions: [{ type: 'uart', signal: 'TX', channel: 'UART3', bus: 'serial3' }],
  }),
  digitalPin(15, 'comm', 3, {
    role: 'communication',
    functions: [{ type: 'uart', signal: 'RX', channel: 'UART3', bus: 'serial3' }],
  }),
  digitalPin(16, 'comm', 4, {
    role: 'communication',
    functions: [{ type: 'uart', signal: 'TX', channel: 'UART2', bus: 'serial2' }],
  }),
  digitalPin(17, 'comm', 5, {
    role: 'communication',
    functions: [{ type: 'uart', signal: 'RX', channel: 'UART2', bus: 'serial2' }],
  }),
  digitalPin(18, 'comm', 6, {
    role: 'communication',
    functions: [
      { type: 'uart', signal: 'TX', channel: 'UART1', bus: 'serial1' },
      { type: 'interrupt', channel: 'INT5' },
    ],
  }),
  digitalPin(19, 'comm', 7, {
    role: 'communication',
    functions: [
      { type: 'uart', signal: 'RX', channel: 'UART1', bus: 'serial1' },
      { type: 'interrupt', channel: 'INT4' },
    ],
  }),
  digitalPin(20, 'comm', 8, {
    role: 'communication',
    functions: [
      { type: 'i2c', signal: 'SDA', bus: 'i2c0' },
      { type: 'interrupt', channel: 'INT3' },
    ],
    warnings: ['Has external 10K pull-up — not available for interrupts while using I2C'],
  }),
  digitalPin(21, 'comm', 9, {
    role: 'communication',
    functions: [
      { type: 'i2c', signal: 'SCL', bus: 'i2c0' },
      { type: 'interrupt', channel: 'INT2' },
    ],
    warnings: ['Has external 10K pull-up — not available for interrupts while using I2C'],
  }),
];

// Digital pins 22-49 (extended digital header — 50-53 are in the SPI section)
const DIGITAL_HIGH_PINS: VerifiedPin[] = Array.from({ length: 28 }, (_, i) => {
  const num = 22 + i;
  const extras: Partial<VerifiedPin> = {};

  if (num === 44) {
    extras.functions = [{ type: 'pwm', channel: 'PWM44' }, { type: 'timer', channel: 'Timer5C' }];
  } else if (num === 45) {
    extras.functions = [{ type: 'pwm', channel: 'PWM45' }, { type: 'timer', channel: 'Timer5B' }];
  } else if (num === 46) {
    extras.functions = [{ type: 'pwm', channel: 'PWM46' }, { type: 'timer', channel: 'Timer5A' }];
  }

  return digitalPin(num, 'digital-high', i, extras);
});

// Analog pins A0-A15
const ANALOG_PINS: VerifiedPin[] = Array.from({ length: 16 }, (_, i) => analogPin(i, i));

// SPI header pins (50-53)
const SPI_PINS: VerifiedPin[] = [
  digitalPin(50, 'spi', 0, {
    role: 'communication',
    functions: [{ type: 'spi', signal: 'MISO', bus: 'spi0' }],
  }),
  digitalPin(51, 'spi', 1, {
    role: 'communication',
    functions: [{ type: 'spi', signal: 'MOSI', bus: 'spi0' }],
  }),
  digitalPin(52, 'spi', 2, {
    role: 'communication',
    functions: [{ type: 'spi', signal: 'SCK', bus: 'spi0' }],
  }),
  digitalPin(53, 'spi', 3, {
    role: 'communication',
    functions: [{ type: 'spi', signal: 'SS', bus: 'spi0' }],
    warnings: ['Must be kept as OUTPUT to stay in SPI master mode'],
  }),
];

// ICSP header
const ICSP_PINS: VerifiedPin[] = [
  { id: 'ICSP_MOSI', name: 'MOSI', headerGroup: 'icsp', headerPosition: 0, role: 'communication', direction: 'bidirectional', voltage: 5, functions: [{ type: 'spi', signal: 'MOSI', bus: 'spi0' }] },
  { id: 'ICSP_VCC', name: '5V', headerGroup: 'icsp', headerPosition: 1, role: 'power', direction: 'power', voltage: 5, functions: [] },
  { id: 'ICSP_MISO', name: 'MISO', headerGroup: 'icsp', headerPosition: 2, role: 'communication', direction: 'bidirectional', voltage: 5, functions: [{ type: 'spi', signal: 'MISO', bus: 'spi0' }] },
  { id: 'ICSP_SCK', name: 'SCK', headerGroup: 'icsp', headerPosition: 3, role: 'communication', direction: 'bidirectional', voltage: 5, functions: [{ type: 'spi', signal: 'SCK', bus: 'spi0' }] },
  { id: 'ICSP_RESET', name: 'RESET', headerGroup: 'icsp', headerPosition: 4, role: 'control', direction: 'input', voltage: 5, functions: [] },
  { id: 'ICSP_GND', name: 'GND', headerGroup: 'icsp', headerPosition: 5, role: 'ground', direction: 'power', voltage: 0, functions: [] },
];

const ALL_PINS: VerifiedPin[] = [
  ...POWER_PINS,
  ...SERIAL0_PINS,
  ...DIGITAL_LOW_PINS,
  ...SERIAL_PINS,
  ...DIGITAL_HIGH_PINS,
  ...ANALOG_PINS,
  ...SPI_PINS,
  ...ICSP_PINS,
];

// ---------------------------------------------------------------------------
// Bus definitions
// ---------------------------------------------------------------------------

const BUSES: VerifiedBus[] = [
  {
    id: 'serial0',
    name: 'Serial (USB)',
    type: 'uart',
    pinIds: ['D0', 'D1'],
    notes: 'Shared with USB-to-serial converter (ATmega16U2). Pins 0 (RX) and 1 (TX).',
  },
  {
    id: 'serial1',
    name: 'Serial1',
    type: 'uart',
    pinIds: ['D18', 'D19'],
    notes: 'Pins 18 (TX1) and 19 (RX1). Also interrupt-capable (INT5/INT4).',
  },
  {
    id: 'serial2',
    name: 'Serial2',
    type: 'uart',
    pinIds: ['D16', 'D17'],
    notes: 'Pins 16 (TX2) and 17 (RX2).',
  },
  {
    id: 'serial3',
    name: 'Serial3',
    type: 'uart',
    pinIds: ['D14', 'D15'],
    notes: 'Pins 14 (TX3) and 15 (RX3).',
  },
  {
    id: 'spi0',
    name: 'SPI',
    type: 'spi',
    pinIds: ['D50', 'D51', 'D52', 'D53'],
    protocol: 'SPI Mode 0/1/2/3',
    notes: 'Pins 50 (MISO), 51 (MOSI), 52 (SCK), 53 (SS). Also mirrored on ICSP header.',
  },
  {
    id: 'i2c0',
    name: 'I2C (Wire)',
    type: 'i2c',
    pinIds: ['D20', 'D21'],
    protocol: 'I2C up to 400kHz',
    notes: 'Pins 20 (SDA) and 21 (SCL). Built-in 10K pull-up resistors.',
  },
];

// ---------------------------------------------------------------------------
// Header layout
// ---------------------------------------------------------------------------

const HEADER_LAYOUT: HeaderGroup[] = [
  { id: 'power', name: 'Power Header', side: 'left', pinCount: 8, pinIds: POWER_PINS.map((p) => p.id) },
  { id: 'comm', name: 'Communication (0-1, 14-21)', side: 'right', pinCount: 10, pinIds: [...SERIAL0_PINS.map((p) => p.id), ...SERIAL_PINS.map((p) => p.id)] },
  { id: 'digital-low', name: 'Digital Pins 2-13 + GND/AREF', side: 'right', pinCount: 14, pinIds: DIGITAL_LOW_PINS.map((p) => p.id) },
  { id: 'digital-high', name: 'Digital Pins 22-49', side: 'right', pinCount: 28, pinIds: DIGITAL_HIGH_PINS.map((p) => p.id) },
  { id: 'analog', name: 'Analog Pins A0-A15', side: 'left', pinCount: 16, pinIds: ANALOG_PINS.map((p) => p.id) },
  { id: 'spi', name: 'SPI Header (50-53)', side: 'right', pinCount: 4, pinIds: SPI_PINS.map((p) => p.id) },
  { id: 'icsp', name: 'ICSP Header', side: 'top', pinCount: 6, pinIds: ICSP_PINS.map((p) => p.id) },
];

// ---------------------------------------------------------------------------
// Board definition
// ---------------------------------------------------------------------------

export const MEGA_2560_R3: VerifiedBoardDefinition = {
  id: 'arduino-mega-2560-r3',
  title: 'Arduino Mega 2560 R3',
  manufacturer: 'Arduino',
  mpn: 'A000067',
  aliases: [
    'Arduino Mega 2560',
    'Arduino Mega',
    'Mega 2560',
    'Mega 2560 R3',
    'Mega2560',
    'ATmega2560',
  ],
  family: 'board-module',
  description: 'Arduino Mega 2560 R3 — ATmega2560-based microcontroller board with 54 digital I/O pins (15 PWM), 16 analog inputs, 4 hardware UARTs, SPI, I2C, and 256 KB flash. The most pin-rich board in the classic Arduino line.',

  dimensions: { width: 101.6, height: 53.34, thickness: 15.3 },
  breadboardFit: 'not_breadboard_friendly',
  breadboardNotes: 'At 101.6mm x 53.34mm, the Mega is far too wide for any standard breadboard. Use jumper wires from the female headers to a breadboard, or mount on a dedicated prototyping baseplate.',
  pinSpacing: 2.54,
  headerLayout: HEADER_LAYOUT,

  operatingVoltage: 5,
  inputVoltageRange: [7, 12],
  maxCurrentPerPin: 40,
  maxTotalCurrent: 200,

  visual: {


    pcbColor: '#00979C',


    silkscreenColor: '#006468',


  },


  pins: ALL_PINS,
  buses: BUSES,

  evidence: [
    {
      type: 'datasheet',
      label: 'Arduino Mega 2560 Rev3 Datasheet (A000067)',
      href: 'https://docs.arduino.cc/resources/datasheets/A000067-datasheet.pdf',
      supports: ['pins', 'dimensions', 'labels'],
      confidence: 'high',
      reviewStatus: 'accepted',
    },
    {
      type: 'pinout',
      label: 'Arduino Mega 2560 Official Documentation',
      href: 'https://docs.arduino.cc/hardware/mega-2560/',
      supports: ['pins', 'labels'],
      confidence: 'high',
      reviewStatus: 'accepted',
    },
    {
      type: 'official-image',
      label: 'Arduino Store — Mega 2560 Rev3 Product Page',
      href: 'https://store.arduino.cc/products/arduino-mega-2560-rev3',
      supports: ['outline', 'dimensions', 'labels'],
      confidence: 'high',
      reviewStatus: 'accepted',
    },
  ],

  verificationNotes: [
    'Pin 7-to-8 gap is 160 mil (not standard 100 mil) for Uno shield compatibility.',
    'Pins 4 and 13 run PWM at 980 Hz (Timer0); all other PWM pins default to 490 Hz.',
    'Pin 13 has an on-board LED that may affect circuits expecting a clean digital output.',
    'SPI pins 50-53 are duplicated on the ICSP header.',
    'I2C pins 20/21 have 10K pull-up resistors that cannot be disabled.',
    'Total I/O current across all pins must not exceed 200 mA.',
  ],

  warnings: [
    'Do not exceed 20V on VIN — 7-12V recommended for safe regulator operation.',
    'Pin 53 (SS) must remain OUTPUT for SPI master mode to work correctly.',
    'Avoid using pins 0/1 for general I/O when USB Serial is in use.',
  ],
};
