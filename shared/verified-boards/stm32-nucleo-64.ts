/**
 * STM32 Nucleo-64 (F401RE) — Verified Board Definition
 *
 * STM32F401RET6 Cortex-M4 at 84MHz, 512KB flash, 96KB SRAM.
 * Arduino-compatible headers + ST Morpho connectors (76 GPIO).
 *
 * Sources:
 * - https://www.st.com/en/evaluation-tools/nucleo-f401re.html
 * - STM32 Nucleo-64 boards User Manual (UM1724)
 * - https://docs.cirkitdesigner.com/component/4a1d82a1-8187-4a51-85a6-9ed4333090e7/stm-32-nucleo-f401re
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
    maxCurrent: 25,
    functions: [],
    ...extras,
  };
}

// ---------------------------------------------------------------------------
// Pin definitions — Arduino-compatible headers (CN5, CN6, CN8, CN9)
// Only the Arduino-compatible headers are defined here for breadboard use.
// The full Morpho connector (CN7, CN10) has 76 pins total.
// ---------------------------------------------------------------------------

const POWER_HEADER: VerifiedPin[] = [
  { id: 'NC', name: 'NC', headerGroup: 'power', headerPosition: 0, role: 'nc', direction: 'input', voltage: 0, functions: [] },
  { id: 'IOREF', name: 'IOREF', headerGroup: 'power', headerPosition: 1, role: 'power', direction: 'output', voltage: 3.3, functions: [] },
  { id: 'RST', name: 'RESET', headerGroup: 'power', headerPosition: 2, role: 'control', direction: 'input', voltage: 3.3, functions: [] },
  { id: '3V3', name: '3.3V', headerGroup: 'power', headerPosition: 3, role: 'power', direction: 'power', voltage: 3.3, functions: [], warnings: ['Max 100mA from on-board regulator'] },
  { id: '5V', name: '5V', headerGroup: 'power', headerPosition: 4, role: 'power', direction: 'power', voltage: 5, functions: [], warnings: ['Available when powered via USB (500mA max)'] },
  { id: 'GND1', name: 'GND', headerGroup: 'power', headerPosition: 5, role: 'ground', direction: 'power', voltage: 0, functions: [] },
  { id: 'GND2', name: 'GND', headerGroup: 'power', headerPosition: 6, role: 'ground', direction: 'power', voltage: 0, functions: [] },
  { id: 'VIN', name: 'VIN', headerGroup: 'power', headerPosition: 7, role: 'power', direction: 'power', voltage: 7, functions: [], warnings: ['Input voltage 7-12V'] },
];

const ANALOG_HEADER: VerifiedPin[] = [
  gpioPin('A0', 'A0', 'analog', 0, { role: 'analog', functions: [{ type: 'adc', channel: 'ADC1_CH0', notes: '12-bit resolution' }] }),
  gpioPin('A1', 'A1', 'analog', 1, { role: 'analog', functions: [{ type: 'adc', channel: 'ADC1_CH1', notes: '12-bit resolution' }] }),
  gpioPin('A2', 'A2', 'analog', 2, { role: 'analog', functions: [{ type: 'adc', channel: 'ADC1_CH4', notes: '12-bit resolution' }] }),
  gpioPin('A3', 'A3', 'analog', 3, { role: 'analog', functions: [{ type: 'adc', channel: 'ADC1_CH8', notes: '12-bit resolution' }] }),
  gpioPin('A4', 'A4', 'analog', 4, { role: 'analog', functions: [
    { type: 'adc', channel: 'ADC1_CH11', notes: '12-bit resolution' },
    { type: 'i2c', signal: 'SDA', bus: 'i2c1' },
  ] }),
  gpioPin('A5', 'A5', 'analog', 5, { role: 'analog', functions: [
    { type: 'adc', channel: 'ADC1_CH12', notes: '12-bit resolution' },
    { type: 'i2c', signal: 'SCL', bus: 'i2c1' },
  ] }),
];

const DIGITAL_LOW: VerifiedPin[] = [
  gpioPin('D0', 'D0', 'digital-low', 0, {
    role: 'communication',
    functions: [{ type: 'uart', signal: 'RX', channel: 'USART2', bus: 'usart2' }],
    warnings: ['Connected to ST-LINK virtual COM port'],
  }),
  gpioPin('D1', 'D1', 'digital-low', 1, {
    role: 'communication',
    functions: [{ type: 'uart', signal: 'TX', channel: 'USART2', bus: 'usart2' }],
    warnings: ['Connected to ST-LINK virtual COM port'],
  }),
  gpioPin('D2', 'D2', 'digital-low', 2),
  gpioPin('D3', 'D3', 'digital-low', 3, {
    functions: [{ type: 'pwm', channel: 'TIM2_CH3' }],
  }),
  gpioPin('D4', 'D4', 'digital-low', 4),
  gpioPin('D5', 'D5', 'digital-low', 5, {
    functions: [{ type: 'pwm', channel: 'TIM2_CH1' }],
  }),
  gpioPin('D6', 'D6', 'digital-low', 6, {
    functions: [{ type: 'pwm', channel: 'TIM2_CH2' }],
  }),
  gpioPin('D7', 'D7', 'digital-low', 7),
];

const DIGITAL_HIGH: VerifiedPin[] = [
  gpioPin('D8', 'D8', 'digital-high', 0),
  gpioPin('D9', 'D9', 'digital-high', 1, {
    functions: [{ type: 'pwm', channel: 'TIM1_CH1' }],
  }),
  gpioPin('D10', 'D10', 'digital-high', 2, {
    functions: [
      { type: 'pwm', channel: 'TIM1_CH3' },
      { type: 'spi', signal: 'CS', bus: 'spi1' },
    ],
  }),
  gpioPin('D11', 'D11', 'digital-high', 3, {
    functions: [
      { type: 'pwm', channel: 'TIM1_CH4' },
      { type: 'spi', signal: 'MOSI', bus: 'spi1' },
    ],
  }),
  gpioPin('D12', 'D12', 'digital-high', 4, {
    functions: [{ type: 'spi', signal: 'MISO', bus: 'spi1' }],
  }),
  gpioPin('D13', 'D13', 'digital-high', 5, {
    functions: [{ type: 'spi', signal: 'SCK', bus: 'spi1' }],
    warnings: ['Connected to on-board LED (LD2)'],
  }),
  { id: 'GND3', name: 'GND', headerGroup: 'digital-high', headerPosition: 6, role: 'ground', direction: 'power', voltage: 0, functions: [] },
  { id: 'AREF', name: 'AREF', headerGroup: 'digital-high', headerPosition: 7, role: 'control', direction: 'input', voltage: 3.3, functions: [] },
  gpioPin('SDA', 'SDA', 'digital-high', 8, {
    role: 'communication',
    functions: [{ type: 'i2c', signal: 'SDA', bus: 'i2c1' }],
  }),
  gpioPin('SCL', 'SCL', 'digital-high', 9, {
    role: 'communication',
    functions: [{ type: 'i2c', signal: 'SCL', bus: 'i2c1' }],
  }),
];

const ALL_PINS = [...POWER_HEADER, ...ANALOG_HEADER, ...DIGITAL_LOW, ...DIGITAL_HIGH];

// ---------------------------------------------------------------------------
// Bus definitions
// ---------------------------------------------------------------------------

const BUSES: VerifiedBus[] = [
  { id: 'usart2', name: 'USART2 (Virtual COM)', type: 'uart', pinIds: ['D0', 'D1'], protocol: 'UART 3.3V', notes: 'Connected to ST-LINK for virtual COM port' },
  { id: 'spi1', name: 'SPI1', type: 'spi', pinIds: ['D10', 'D11', 'D12', 'D13'], protocol: 'SPI up to 42MHz' },
  { id: 'i2c1', name: 'I2C1', type: 'i2c', pinIds: ['SDA', 'SCL', 'A4', 'A5'], protocol: 'I2C up to 400kHz (Fast-mode)', notes: 'A4=SDA, A5=SCL on Arduino header' },
];

// ---------------------------------------------------------------------------
// Header layout
// ---------------------------------------------------------------------------

const HEADER_LAYOUT: HeaderGroup[] = [
  { id: 'power', name: 'Power Header (CN6)', side: 'left', pinCount: 8, pinIds: POWER_HEADER.map((p) => p.id) },
  { id: 'analog', name: 'Analog Header (CN8)', side: 'left', pinCount: 6, pinIds: ANALOG_HEADER.map((p) => p.id) },
  { id: 'digital-low', name: 'Digital 0-7 (CN9)', side: 'right', pinCount: 8, pinIds: DIGITAL_LOW.map((p) => p.id) },
  { id: 'digital-high', name: 'Digital 8-13 + SDA/SCL (CN5)', side: 'right', pinCount: 10, pinIds: DIGITAL_HIGH.map((p) => p.id) },
];

// ---------------------------------------------------------------------------
// Board definition
// ---------------------------------------------------------------------------

export const STM32_NUCLEO_64: VerifiedBoardDefinition = {
  id: 'stm32-nucleo-64',
  title: 'STM32 Nucleo-64 (F401RE)',
  manufacturer: 'STMicroelectronics',
  mpn: 'NUCLEO-F401RE',
  aliases: ['Nucleo-64', 'Nucleo F401RE', 'NUCLEO-F401RE', 'STM32F401'],
  family: 'board-module',
  description: 'STM32F401RET6 Cortex-M4 at 84MHz with Arduino-compatible headers and ST Morpho connectors. On-board ST-LINK/V2-1 debugger. 512KB flash, 96KB SRAM.',

  dimensions: { width: 70, height: 82.5, thickness: 15 },
  breadboardFit: 'not_breadboard_friendly',
  breadboardNotes: 'At 70mm wide, the Nucleo-64 is too wide for a breadboard. Use jumper wires from the female Arduino or Morpho headers to a breadboard.',
  pinSpacing: 2.54,
  headerLayout: HEADER_LAYOUT,

  operatingVoltage: 3.3,
  inputVoltageRange: [7, 12],
  maxCurrentPerPin: 25,
  maxTotalCurrent: 120,

  pins: ALL_PINS,
  buses: BUSES,

  evidence: [
    { type: 'manufacturer', url: 'https://www.st.com/en/evaluation-tools/nucleo-f401re.html', retrievedAt: '2026-04-10' },
    { type: 'datasheet', url: 'https://www.st.com/resource/en/user_manual/um1724-stm32-nucleo64-boards-mb1136-stmicroelectronics.pdf', retrievedAt: '2026-04-10' },
  ],
  verificationNotes: [
    'Arduino-compatible headers only — Morpho connector pins not included in this definition',
    'Full Morpho connector adds 76 GPIO pins (38 per side)',
    '12-bit ADC (vs 10-bit on AVR Arduino boards)',
    'On-board ST-LINK debugger supports SWD and virtual COM port',
  ],
  warnings: [
    '3.3V logic ONLY — do NOT apply 5V to GPIO pins (not 5V tolerant on all pins)',
    'D0/D1 connected to ST-LINK virtual COM — may conflict with external serial devices',
    'D13 connected to on-board LED LD2',
    'Some Arduino shields may not be compatible due to 3.3V logic',
  ],
};
