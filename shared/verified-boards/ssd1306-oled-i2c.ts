/**
 * SSD1306 0.96" OLED I2C Display Module — Verified Board Definition
 *
 * A very common 128x64 pixel monochrome OLED display module using I2C.
 */

import type { VerifiedBoardDefinition, VerifiedPin } from './types';

const I2C_PINS: VerifiedPin[] = [
  { id: 'GND', name: 'GND', headerGroup: 'main', headerPosition: 0, role: 'ground', direction: 'power', voltage: 0, functions: [], warnings: [] },
  { id: 'VCC', name: 'VCC', headerGroup: 'main', headerPosition: 1, role: 'power', direction: 'power', voltage: 5, functions: [], warnings: ['Usually accepts 3.3V to 5V due to onboard regulator'] },
  { id: 'SCL', name: 'SCL', headerGroup: 'main', headerPosition: 2, role: 'communication', direction: 'input', voltage: 3.3, functions: [{ type: 'i2c', signal: 'SCL' }], warnings: [] },
  { id: 'SDA', name: 'SDA', headerGroup: 'main', headerPosition: 3, role: 'communication', direction: 'bidirectional', voltage: 3.3, functions: [{ type: 'i2c', signal: 'SDA' }], warnings: [] },
];

export const SSD1306_OLED_I2C: VerifiedBoardDefinition = {
  id: 'ssd1306-oled-i2c',
  title: 'SSD1306 0.96" OLED I2C Display',
  manufacturer: 'Generic',
  mpn: 'SSD1306-096-I2C',
  aliases: ['0.96 oled', 'i2c oled', 'ssd1306 display'],
  family: 'board-module',
  description: '0.96-inch monochrome OLED display with 128x64 resolution, driven by the SSD1306 controller over I2C.',
  dimensions: { width: 27.3, height: 27.8, thickness: 4.0 },
  breadboardFit: 'native',
  breadboardNotes: '4-pin header easily fits into a breadboard.',
  pinSpacing: 2.54,
  operatingVoltage: 3.3,
  inputVoltageRange: [3.3, 5.0],
  maxCurrentPerPin: 20,
  maxTotalCurrent: 50,
  visual: {
    pcbColor: '#1e3a8a', // dark blue PCB
    silkscreenColor: '#172554',
  },
  pins: I2C_PINS,
  headerLayout: [
    { id: 'main', name: 'Main Header', side: 'top', pinCount: 4, pinIds: I2C_PINS.map(p => p.id) },
  ],
  buses: [
    { id: 'i2c', name: 'I2C Bus', type: 'i2c', pinIds: ['SCL', 'SDA'] }
  ],
  evidence: [
    { type: 'datasheet', label: 'SSD1306 Datasheet', href: 'https://cdn-shop.adafruit.com/datasheets/SSD1306.pdf', confidence: 'high', supports: ['pins'] }
  ],
  verificationNotes: [
    'Some variants swap GND and VCC pins. Always check silkscreen.'
  ],
  warnings: [
    'Double-check VCC and GND positions before powering.'
  ],
};
