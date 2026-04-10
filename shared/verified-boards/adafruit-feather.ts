/**
 * Adafruit Feather M0 Basic Proto — Verified Board Definition
 *
 * ATSAMD21G18 Cortex-M0+ at 48MHz, 256KB flash, 32KB SRAM.
 * Feather form factor with LiPo charging, 20 GPIO, USB native.
 *
 * Sources:
 * - https://learn.adafruit.com/adafruit-feather-m0-basic-proto/pinouts
 * - https://www.adafruit.com/product/2772
 * - https://cdn-learn.adafruit.com/assets/assets/000/046/203/original/feather_M0_Express_Pinout_v1.2.pdf
 */

import type { VerifiedBoardDefinition, VerifiedPin, VerifiedBus, HeaderGroup } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gpioPin(
  id: string,
  name: string,
  headerGroup: string,
  headerPosition: number,
  extras?: Partial<VerifiedPin>,
): VerifiedPin {
  return {
    id,
    name,
    headerGroup,
    headerPosition,
    role: 'digital',
    direction: 'bidirectional',
    voltage: 3.3,
    maxCurrent: 7,
    functions: [],
    ...extras,
  };
}

// ---------------------------------------------------------------------------
// Pin definitions — 28 pins total (16 left + 12 right)
// ---------------------------------------------------------------------------

const LEFT_HEADER: VerifiedPin[] = [
  { id: 'RST', name: 'RST', headerGroup: 'left', headerPosition: 0, role: 'control', direction: 'input', voltage: 3.3, functions: [] },
  { id: '3V3', name: '3V', headerGroup: 'left', headerPosition: 1, role: 'power', direction: 'power', voltage: 3.3, functions: [], warnings: ['Max 500mA from regulator when USB powered'] },
  { id: 'AREF', name: 'AREF', headerGroup: 'left', headerPosition: 2, role: 'control', direction: 'input', voltage: 3.3, functions: [] },
  { id: 'GND1', name: 'GND', headerGroup: 'left', headerPosition: 3, role: 'ground', direction: 'power', voltage: 0, functions: [] },
  gpioPin('A0', 'A0', 'left', 4, { role: 'analog', functions: [
    { type: 'adc', channel: 'ADC0', notes: '12-bit resolution' },
    { type: 'dac', channel: 'DAC0', notes: '10-bit true analog output' },
  ] }),
  gpioPin('A1', 'A1', 'left', 5, { role: 'analog', functions: [{ type: 'adc', channel: 'ADC1', notes: '12-bit resolution' }] }),
  gpioPin('A2', 'A2', 'left', 6, { role: 'analog', functions: [{ type: 'adc', channel: 'ADC2', notes: '12-bit resolution' }] }),
  gpioPin('A3', 'A3', 'left', 7, { role: 'analog', functions: [{ type: 'adc', channel: 'ADC3', notes: '12-bit resolution' }] }),
  gpioPin('A4', 'A4', 'left', 8, { role: 'analog', functions: [{ type: 'adc', channel: 'ADC4', notes: '12-bit resolution' }] }),
  gpioPin('A5', 'A5', 'left', 9, { role: 'analog', functions: [{ type: 'adc', channel: 'ADC5', notes: '12-bit resolution' }] }),
  gpioPin('SCK', 'SCK', 'left', 10, {
    role: 'communication',
    functions: [{ type: 'spi', signal: 'SCK', bus: 'spi0' }],
  }),
  gpioPin('MOSI', 'MOSI', 'left', 11, {
    role: 'communication',
    functions: [{ type: 'spi', signal: 'MOSI', bus: 'spi0' }],
  }),
  gpioPin('MISO', 'MISO', 'left', 12, {
    role: 'communication',
    functions: [{ type: 'spi', signal: 'MISO', bus: 'spi0' }],
  }),
  gpioPin('D0', 'RX', 'left', 13, {
    role: 'communication',
    functions: [{ type: 'uart', signal: 'RX', channel: 'SERCOM0', bus: 'serial1' }],
  }),
  gpioPin('D1', 'TX', 'left', 14, {
    role: 'communication',
    functions: [{ type: 'uart', signal: 'TX', channel: 'SERCOM0', bus: 'serial1' }],
  }),
  { id: 'GND2', name: 'GND', headerGroup: 'left', headerPosition: 15, role: 'ground', direction: 'power', voltage: 0, functions: [] },
];

const RIGHT_HEADER: VerifiedPin[] = [
  { id: 'BAT', name: 'BAT', headerGroup: 'right', headerPosition: 0, role: 'power', direction: 'power', voltage: 4.2, functions: [], warnings: ['LiPo battery voltage — do not exceed 6V'] },
  { id: 'EN', name: 'EN', headerGroup: 'right', headerPosition: 1, role: 'control', direction: 'input', voltage: 3.3, functions: [], warnings: ['Pull LOW to disable 3.3V regulator'] },
  { id: 'USB', name: 'USB', headerGroup: 'right', headerPosition: 2, role: 'power', direction: 'power', voltage: 5, functions: [], warnings: ['USB 5V — only available when USB connected'] },
  gpioPin('D13', '13', 'right', 3, {
    functions: [{ type: 'pwm' }],
    warnings: ['Connected to red on-board LED'],
  }),
  gpioPin('D12', '12', 'right', 4, {
    functions: [{ type: 'pwm' }],
  }),
  gpioPin('D11', '11', 'right', 5, {
    functions: [{ type: 'pwm' }],
  }),
  gpioPin('D10', '10', 'right', 6, {
    functions: [{ type: 'pwm' }],
  }),
  gpioPin('D9', '9', 'right', 7, {
    functions: [
      { type: 'pwm' },
      { type: 'adc', channel: 'ADC7', notes: '12-bit' },
    ],
  }),
  gpioPin('D6', '6', 'right', 8, {
    functions: [{ type: 'pwm' }],
  }),
  gpioPin('D5', '5', 'right', 9, {
    functions: [{ type: 'pwm' }],
  }),
  gpioPin('SDA', 'SDA', 'right', 10, {
    role: 'communication',
    functions: [{ type: 'i2c', signal: 'SDA', bus: 'i2c0' }],
  }),
  gpioPin('SCL', 'SCL', 'right', 11, {
    role: 'communication',
    functions: [{ type: 'i2c', signal: 'SCL', bus: 'i2c0' }],
  }),
];

const ALL_PINS = [...LEFT_HEADER, ...RIGHT_HEADER];

// ---------------------------------------------------------------------------
// Bus definitions
// ---------------------------------------------------------------------------

const BUSES: VerifiedBus[] = [
  { id: 'serial1', name: 'Serial1 (Hardware UART)', type: 'uart', pinIds: ['D0', 'D1'], protocol: 'UART 3.3V', notes: 'RX/TX pins, separate from USB Serial' },
  { id: 'spi0', name: 'SPI', type: 'spi', pinIds: ['SCK', 'MOSI', 'MISO'], protocol: 'SPI up to 12MHz', notes: 'Hardware SPI via SERCOM' },
  { id: 'i2c0', name: 'I2C (Wire)', type: 'i2c', pinIds: ['SDA', 'SCL'], protocol: 'I2C up to 400kHz', notes: 'SERCOM-based I2C, 3.3V logic' },
];

// ---------------------------------------------------------------------------
// Header layout
// ---------------------------------------------------------------------------

const HEADER_LAYOUT: HeaderGroup[] = [
  { id: 'left', name: 'Left Header (RST→GND)', side: 'left', pinCount: 16, pinIds: LEFT_HEADER.map((p) => p.id) },
  { id: 'right', name: 'Right Header (BAT→SCL)', side: 'right', pinCount: 12, pinIds: RIGHT_HEADER.map((p) => p.id) },
];

// ---------------------------------------------------------------------------
// Board definition
// ---------------------------------------------------------------------------

export const ADAFRUIT_FEATHER_M0: VerifiedBoardDefinition = {
  id: 'adafruit-feather-m0',
  title: 'Adafruit Feather M0 Basic Proto',
  manufacturer: 'Adafruit',
  mpn: '2772',
  aliases: ['Feather M0', 'Feather SAMD21', 'Adafruit Feather', 'ATSAMD21 Feather'],
  family: 'board-module',
  description: 'ATSAMD21G18 Cortex-M0+ at 48MHz with Feather form factor: 20 GPIO, 8 PWM, 10 ADC (12-bit), 1 DAC, native USB, LiPo charging. 51×23mm.',

  dimensions: { width: 23, height: 51, thickness: 8 },
  breadboardFit: 'native',
  breadboardNotes: 'Feather form factor (23mm wide) fits across the center channel of a standard breadboard. 16 pins left, 12 pins right at 0.1" pitch.',
  pinSpacing: 2.54,
  headerLayout: HEADER_LAYOUT,

  operatingVoltage: 3.3,
  inputVoltageRange: [3.4, 6],
  maxCurrentPerPin: 7,
  maxTotalCurrent: 50,

  pins: ALL_PINS,
  buses: BUSES,

  evidence: [
    { type: 'pinout', label: 'Adafruit Feather M0 Pinouts Guide', href: 'https://learn.adafruit.com/adafruit-feather-m0-basic-proto/pinouts', supports: ['pins', 'labels'], confidence: 'high', reviewStatus: 'accepted' },
    { type: 'marketplace-listing', label: 'Adafruit Feather M0 Product Page', href: 'https://www.adafruit.com/product/2772', supports: ['dimensions', 'pins'], confidence: 'high', reviewStatus: 'accepted' },
  ],
  verificationNotes: [
    'Pin data from Adafruit Learn guide pinouts page',
    'A0 has true 10-bit DAC output (not just PWM)',
    'Native USB support — no separate USB-to-serial chip',
    'SAMD21 SERCOM system allows flexible peripheral remapping',
    'All digital pins support PWM output',
  ],
  warnings: [
    '3.3V logic ONLY — not 5V tolerant on any pin',
    'Max 7mA per GPIO pin (much lower than Arduino AVR boards)',
    'LiPo connector is JST-PH 2-pin — check polarity before connecting',
    'A0 is the ONLY true analog output pin (DAC)',
  ],
};
