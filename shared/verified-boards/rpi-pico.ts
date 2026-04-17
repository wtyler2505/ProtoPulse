/**
 * Raspberry Pi Pico — Verified Board Definition
 *
 * RP2040-based board: dual-core Cortex-M0+ at 133MHz, 264KB SRAM,
 * 2MB flash, 26 GPIO, 3 ADC, 2 UART, 2 SPI, 2 I2C, 16 PWM.
 * DIP form factor with castellated pads.
 *
 * Sources:
 * - https://datasheets.raspberrypi.com/pico/pico-datasheet.pdf
 * - https://datasheets.raspberrypi.com/pico/Pico-R3-A4-Pinout.pdf
 * - https://www.raspberrypi.com/documentation/microcontrollers/pico-series.html
 */

import type { VerifiedBoardDefinition, VerifiedPin, VerifiedBus, HeaderGroup } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gpioPin(
  num: number,
  headerGroup: string,
  headerPosition: number,
  extras?: Partial<VerifiedPin>,
): VerifiedPin {
  return {
    id: `GP${num}`,
    name: `GP${num}`,
    headerGroup,
    headerPosition,
    role: 'digital',
    direction: 'bidirectional',
    voltage: 3.3,
    maxCurrent: 12,
    functions: [
      { type: 'pwm', channel: `PWM${Math.floor(num / 2)}${num % 2 === 0 ? 'A' : 'B'}` },
    ],
    ...extras,
  };
}

// ---------------------------------------------------------------------------
// Pin definitions — 40 pins total (2x20 DIP layout)
// ---------------------------------------------------------------------------

// Left header (pin 1 at top-left, USB connector at top)
const LEFT_HEADER: VerifiedPin[] = [
  gpioPin(0, 'left', 0, {
    functions: [
      { type: 'pwm', channel: 'PWM0A' },
      { type: 'uart', signal: 'TX', channel: 'UART0', bus: 'uart0' },
      { type: 'spi', signal: 'RX', bus: 'spi0' },
      { type: 'i2c', signal: 'SDA', bus: 'i2c0' },
    ],
  }),
  gpioPin(1, 'left', 1, {
    functions: [
      { type: 'pwm', channel: 'PWM0B' },
      { type: 'uart', signal: 'RX', channel: 'UART0', bus: 'uart0' },
      { type: 'spi', signal: 'CS', bus: 'spi0' },
      { type: 'i2c', signal: 'SCL', bus: 'i2c0' },
    ],
  }),
  { id: 'GND1', name: 'GND', headerGroup: 'left', headerPosition: 2, role: 'ground', direction: 'power', voltage: 0, functions: [] },
  gpioPin(2, 'left', 3, {
    functions: [
      { type: 'pwm', channel: 'PWM1A' },
      { type: 'spi', signal: 'SCK', bus: 'spi0' },
      { type: 'i2c', signal: 'SDA', bus: 'i2c1' },
    ],
  }),
  gpioPin(3, 'left', 4, {
    functions: [
      { type: 'pwm', channel: 'PWM1B' },
      { type: 'spi', signal: 'TX', bus: 'spi0' },
      { type: 'i2c', signal: 'SCL', bus: 'i2c1' },
    ],
  }),
  gpioPin(4, 'left', 5, {
    functions: [
      { type: 'pwm', channel: 'PWM2A' },
      { type: 'uart', signal: 'TX', channel: 'UART1', bus: 'uart1' },
      { type: 'spi', signal: 'RX', bus: 'spi0' },
      { type: 'i2c', signal: 'SDA', bus: 'i2c0' },
    ],
  }),
  gpioPin(5, 'left', 6, {
    functions: [
      { type: 'pwm', channel: 'PWM2B' },
      { type: 'uart', signal: 'RX', channel: 'UART1', bus: 'uart1' },
      { type: 'spi', signal: 'CS', bus: 'spi0' },
      { type: 'i2c', signal: 'SCL', bus: 'i2c0' },
    ],
  }),
  { id: 'GND2', name: 'GND', headerGroup: 'left', headerPosition: 7, role: 'ground', direction: 'power', voltage: 0, functions: [] },
  gpioPin(6, 'left', 8, {
    functions: [
      { type: 'pwm', channel: 'PWM3A' },
      { type: 'spi', signal: 'SCK', bus: 'spi0' },
      { type: 'i2c', signal: 'SDA', bus: 'i2c1' },
    ],
  }),
  gpioPin(7, 'left', 9, {
    functions: [
      { type: 'pwm', channel: 'PWM3B' },
      { type: 'spi', signal: 'TX', bus: 'spi0' },
      { type: 'i2c', signal: 'SCL', bus: 'i2c1' },
    ],
  }),
  gpioPin(8, 'left', 10, {
    functions: [
      { type: 'pwm', channel: 'PWM4A' },
      { type: 'uart', signal: 'TX', channel: 'UART1', bus: 'uart1' },
      { type: 'spi', signal: 'RX', bus: 'spi1' },
      { type: 'i2c', signal: 'SDA', bus: 'i2c0' },
    ],
  }),
  gpioPin(9, 'left', 11, {
    functions: [
      { type: 'pwm', channel: 'PWM4B' },
      { type: 'uart', signal: 'RX', channel: 'UART1', bus: 'uart1' },
      { type: 'spi', signal: 'CS', bus: 'spi1' },
      { type: 'i2c', signal: 'SCL', bus: 'i2c0' },
    ],
  }),
  { id: 'GND3', name: 'GND', headerGroup: 'left', headerPosition: 12, role: 'ground', direction: 'power', voltage: 0, functions: [] },
  gpioPin(10, 'left', 13, {
    functions: [
      { type: 'pwm', channel: 'PWM5A' },
      { type: 'spi', signal: 'SCK', bus: 'spi1' },
      { type: 'i2c', signal: 'SDA', bus: 'i2c1' },
    ],
  }),
  gpioPin(11, 'left', 14, {
    functions: [
      { type: 'pwm', channel: 'PWM5B' },
      { type: 'spi', signal: 'TX', bus: 'spi1' },
      { type: 'i2c', signal: 'SCL', bus: 'i2c1' },
    ],
  }),
  gpioPin(12, 'left', 15, {
    functions: [
      { type: 'pwm', channel: 'PWM6A' },
      { type: 'uart', signal: 'TX', channel: 'UART0', bus: 'uart0' },
      { type: 'spi', signal: 'RX', bus: 'spi1' },
      { type: 'i2c', signal: 'SDA', bus: 'i2c0' },
    ],
  }),
  gpioPin(13, 'left', 16, {
    functions: [
      { type: 'pwm', channel: 'PWM6B' },
      { type: 'uart', signal: 'RX', channel: 'UART0', bus: 'uart0' },
      { type: 'spi', signal: 'CS', bus: 'spi1' },
      { type: 'i2c', signal: 'SCL', bus: 'i2c0' },
    ],
  }),
  { id: 'GND4', name: 'GND', headerGroup: 'left', headerPosition: 17, role: 'ground', direction: 'power', voltage: 0, functions: [] },
  gpioPin(14, 'left', 18, {
    functions: [
      { type: 'pwm', channel: 'PWM7A' },
      { type: 'spi', signal: 'SCK', bus: 'spi1' },
      { type: 'i2c', signal: 'SDA', bus: 'i2c1' },
    ],
  }),
  gpioPin(15, 'left', 19, {
    functions: [
      { type: 'pwm', channel: 'PWM7B' },
      { type: 'spi', signal: 'TX', bus: 'spi1' },
      { type: 'i2c', signal: 'SCL', bus: 'i2c1' },
    ],
  }),
];

// Right header (pin 40 at top-right, counting down)
const RIGHT_HEADER: VerifiedPin[] = [
  { id: 'VBUS', name: 'VBUS', headerGroup: 'right', headerPosition: 0, role: 'power', direction: 'power', voltage: 5, functions: [], warnings: ['USB 5V — only available when USB connected'] },
  { id: 'VSYS', name: 'VSYS', headerGroup: 'right', headerPosition: 1, role: 'power', direction: 'power', voltage: 5, functions: [], warnings: ['Main system power input 1.8-5.5V'] },
  { id: 'GND5', name: 'GND', headerGroup: 'right', headerPosition: 2, role: 'ground', direction: 'power', voltage: 0, functions: [] },
  { id: '3V3_EN', name: '3V3_EN', headerGroup: 'right', headerPosition: 3, role: 'control', direction: 'input', voltage: 3.3, functions: [], warnings: ['Pull LOW to disable 3.3V regulator'] },
  { id: '3V3', name: '3V3(OUT)', headerGroup: 'right', headerPosition: 4, role: 'power', direction: 'power', voltage: 3.3, functions: [], warnings: ['Max 300mA output from on-board regulator'] },
  { id: 'ADC_VREF', name: 'ADC_VREF', headerGroup: 'right', headerPosition: 5, role: 'control', direction: 'input', voltage: 3.3, functions: [] },
  gpioPin(28, 'right', 6, {
    role: 'analog',
    functions: [
      { type: 'pwm', channel: 'PWM6A' },
      { type: 'adc', channel: 'ADC2', notes: '12-bit resolution' },
    ],
  }),
  { id: 'AGND', name: 'AGND', headerGroup: 'right', headerPosition: 7, role: 'ground', direction: 'power', voltage: 0, functions: [] },
  gpioPin(27, 'right', 8, {
    role: 'analog',
    functions: [
      { type: 'pwm', channel: 'PWM5B' },
      { type: 'adc', channel: 'ADC1', notes: '12-bit resolution' },
      { type: 'i2c', signal: 'SCL', bus: 'i2c1' },
    ],
  }),
  gpioPin(26, 'right', 9, {
    role: 'analog',
    functions: [
      { type: 'pwm', channel: 'PWM5A' },
      { type: 'adc', channel: 'ADC0', notes: '12-bit resolution' },
      { type: 'i2c', signal: 'SDA', bus: 'i2c1' },
    ],
  }),
  { id: 'RUN', name: 'RUN', headerGroup: 'right', headerPosition: 10, role: 'control', direction: 'input', voltage: 3.3, functions: [], warnings: ['Reset pin — pull LOW to reset RP2040'] },
  gpioPin(22, 'right', 11, {
    functions: [
      { type: 'pwm', channel: 'PWM3A' },
    ],
  }),
  { id: 'GND6', name: 'GND', headerGroup: 'right', headerPosition: 12, role: 'ground', direction: 'power', voltage: 0, functions: [] },
  gpioPin(21, 'right', 13, {
    functions: [
      { type: 'pwm', channel: 'PWM2B' },
      { type: 'i2c', signal: 'SCL', bus: 'i2c0' },
    ],
  }),
  gpioPin(20, 'right', 14, {
    functions: [
      { type: 'pwm', channel: 'PWM2A' },
      { type: 'i2c', signal: 'SDA', bus: 'i2c0' },
    ],
  }),
  gpioPin(19, 'right', 15, {
    functions: [
      { type: 'pwm', channel: 'PWM1B' },
      { type: 'spi', signal: 'TX', bus: 'spi0' },
      { type: 'i2c', signal: 'SCL', bus: 'i2c1' },
    ],
  }),
  gpioPin(18, 'right', 16, {
    functions: [
      { type: 'pwm', channel: 'PWM1A' },
      { type: 'spi', signal: 'SCK', bus: 'spi0' },
      { type: 'i2c', signal: 'SDA', bus: 'i2c1' },
    ],
  }),
  { id: 'GND7', name: 'GND', headerGroup: 'right', headerPosition: 17, role: 'ground', direction: 'power', voltage: 0, functions: [] },
  gpioPin(17, 'right', 18, {
    functions: [
      { type: 'pwm', channel: 'PWM0B' },
      { type: 'spi', signal: 'CS', bus: 'spi0' },
      { type: 'i2c', signal: 'SCL', bus: 'i2c0' },
    ],
  }),
  gpioPin(16, 'right', 19, {
    functions: [
      { type: 'pwm', channel: 'PWM0A' },
      { type: 'spi', signal: 'RX', bus: 'spi0' },
      { type: 'i2c', signal: 'SDA', bus: 'i2c0' },
    ],
  }),
];

const ALL_PINS = [...LEFT_HEADER, ...RIGHT_HEADER];

// ---------------------------------------------------------------------------
// Bus definitions
// ---------------------------------------------------------------------------

const BUSES: VerifiedBus[] = [
  { id: 'uart0', name: 'UART0', type: 'uart', pinIds: ['GP0', 'GP1'], protocol: 'UART 3.3V', notes: 'Default UART0 on GP0(TX)/GP1(RX), remappable via PIO' },
  { id: 'uart1', name: 'UART1', type: 'uart', pinIds: ['GP4', 'GP5'], protocol: 'UART 3.3V', notes: 'Default UART1 on GP4(TX)/GP5(RX), remappable via PIO' },
  { id: 'spi0', name: 'SPI0', type: 'spi', pinIds: ['GP16', 'GP17', 'GP18', 'GP19'], protocol: 'SPI up to 62.5MHz', notes: 'Default SPI0 pins; all GPIO support SPI via PIO' },
  { id: 'spi1', name: 'SPI1', type: 'spi', pinIds: ['GP8', 'GP9', 'GP10', 'GP11'], protocol: 'SPI up to 62.5MHz' },
  { id: 'i2c0', name: 'I2C0', type: 'i2c', pinIds: ['GP0', 'GP1'], protocol: 'I2C up to 1MHz (Fast-mode Plus)', notes: 'Default I2C0 on GP0(SDA)/GP1(SCL), remappable' },
  { id: 'i2c1', name: 'I2C1', type: 'i2c', pinIds: ['GP2', 'GP3'], protocol: 'I2C up to 1MHz (Fast-mode Plus)' },
];

// ---------------------------------------------------------------------------
// Header layout
// ---------------------------------------------------------------------------

const HEADER_LAYOUT: HeaderGroup[] = [
  { id: 'left', name: 'Left Header (GP0→GP15)', side: 'left', pinCount: 20, pinIds: LEFT_HEADER.map((p) => p.id) },
  { id: 'right', name: 'Right Header (VBUS→GP16)', side: 'right', pinCount: 20, pinIds: RIGHT_HEADER.map((p) => p.id) },
];

// ---------------------------------------------------------------------------
// Board definition
// ---------------------------------------------------------------------------

export const RPI_PICO: VerifiedBoardDefinition = {
  id: 'rpi-pico',
  title: 'Raspberry Pi Pico',
  manufacturer: 'Raspberry Pi',
  mpn: 'SC0915',
  aliases: ['Pico', 'RPi Pico', 'RP2040 Pico', 'Raspberry Pi Pico'],
  family: 'board-module',
  description: 'RP2040-based board with dual-core Cortex-M0+ at 133MHz, 264KB SRAM, 2MB flash, 26 GPIO, 3 ADC, 2 UART, 2 SPI, 2 I2C, 16 PWM channels. DIP form factor with castellated pads.',

  dimensions: { width: 21, height: 51, thickness: 3.8 },
  breadboardFit: 'native',
  breadboardNotes: 'DIP form factor (21mm wide) fits across the center channel of a standard breadboard. 20 pins per side at 0.1" pitch. Castellated pads allow soldering as a module.',
  pinSpacing: 2.54,
  headerLayout: HEADER_LAYOUT,

  operatingVoltage: 3.3,
  inputVoltageRange: [1.8, 5.5],
  maxCurrentPerPin: 12,
  maxTotalCurrent: 50,

  visual: {


    pcbColor: '#1b5e20',


    silkscreenColor: '#14532d',


  },


  pins: ALL_PINS,
  buses: BUSES,

  evidence: [
    { type: 'datasheet', label: 'Raspberry Pi Pico Datasheet', href: 'https://datasheets.raspberrypi.com/pico/pico-datasheet.pdf', supports: ['pins', 'dimensions', 'labels'], confidence: 'high', reviewStatus: 'accepted' },
    { type: 'pinout', label: 'Pico R3 A4 Official Pinout PDF', href: 'https://datasheets.raspberrypi.com/pico/Pico-R3-A4-Pinout.pdf', supports: ['pins', 'labels'], confidence: 'high', reviewStatus: 'accepted' },
    { type: 'datasheet', label: 'Raspberry Pi Pico Series Documentation', href: 'https://www.raspberrypi.com/documentation/microcontrollers/pico-series.html', supports: ['pins', 'dimensions', 'breadboard-fit'], confidence: 'high', reviewStatus: 'accepted' },
  ],
  verificationNotes: [
    'Pin data cross-referenced with official Pico-R3-A4-Pinout.pdf',
    'RP2040 has flexible IO: nearly all GPIO functions are remappable via PIO',
    '3 ADC channels on GP26-GP28 (12-bit), plus internal temperature sensor on ADC4',
    'USB 1.1 with device and host support',
  ],
  warnings: [
    '3.3V logic ONLY — do NOT apply 5V to GPIO pins',
    'Max 12mA per GPIO pin (not 40mA like Arduino)',
    'Total GPIO current should not exceed ~50mA',
    'BOOTSEL button must be held during power-on to enter USB mass storage mode for flashing',
    'No EEPROM — use flash storage for persistent data',
  ],
};
