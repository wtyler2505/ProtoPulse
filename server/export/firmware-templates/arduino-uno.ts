/**
 * Arduino Uno R3 board template.
 *
 * Based on the ATmega328P with the standard Uno pinout.
 * 14 digital I/O pins (6 PWM), 6 analog inputs, 1 UART, I2C, SPI.
 */

import type { BoardTemplate } from './types';

export const arduinoUnoTemplate: BoardTemplate = {
  boardId: 'arduino-uno',
  displayName: 'Arduino Uno R3',
  platform: 'platformio',
  mcu: 'ATmega328P',
  platformioBoard: 'uno',
  platformioPlatform: 'atmelavr',
  platformioFramework: 'arduino',
  defaultLibraries: ['Wire', 'SPI', 'Servo', 'EEPROM'],
  notes: [
    'ATmega328P runs at 16 MHz with 2 KB SRAM, 32 KB flash, 1 KB EEPROM.',
    'Only 6 PWM pins (3, 5, 6, 9, 10, 11).',
    'Pins 0-1 are Serial (USB), avoid for general GPIO.',
    'Only 2 external interrupts (pins 2 and 3).',
    'A4/A5 are shared with I2C — cannot use as analog when I2C is active.',
  ],
  pins: [
    // Digital pins 0-13
    { pin: 0, name: 'D0', capabilities: ['digital', 'uart_rx'], notes: 'Serial RX (USB). Avoid for general GPIO.' },
    { pin: 1, name: 'D1', capabilities: ['digital', 'uart_tx'], notes: 'Serial TX (USB). Avoid for general GPIO.' },
    { pin: 2, name: 'D2', capabilities: ['digital'], notes: 'External interrupt INT0.' },
    { pin: 3, name: 'D3', capabilities: ['digital', 'pwm'], pwmChannel: 0, notes: 'External interrupt INT1.' },
    { pin: 4, name: 'D4', capabilities: ['digital'] },
    { pin: 5, name: 'D5', capabilities: ['digital', 'pwm'], pwmChannel: 1 },
    { pin: 6, name: 'D6', capabilities: ['digital', 'pwm'], pwmChannel: 2 },
    { pin: 7, name: 'D7', capabilities: ['digital'] },
    { pin: 8, name: 'D8', capabilities: ['digital'] },
    { pin: 9, name: 'D9', capabilities: ['digital', 'pwm'], pwmChannel: 3 },
    { pin: 10, name: 'D10', capabilities: ['digital', 'pwm', 'spi_cs'], pwmChannel: 4, notes: 'Default SPI SS. Must be OUTPUT for SPI master mode.' },
    { pin: 11, name: 'D11', capabilities: ['digital', 'pwm', 'spi_mosi'], pwmChannel: 5 },
    { pin: 12, name: 'D12', capabilities: ['digital', 'spi_miso'] },
    { pin: 13, name: 'D13', capabilities: ['digital', 'spi_sck'], notes: 'Onboard LED. Also SPI SCK.' },
    // Analog pins A0-A5
    { pin: 'A0', name: 'A0', capabilities: ['digital', 'analog', 'adc'], adcChannel: 0 },
    { pin: 'A1', name: 'A1', capabilities: ['digital', 'analog', 'adc'], adcChannel: 1 },
    { pin: 'A2', name: 'A2', capabilities: ['digital', 'analog', 'adc'], adcChannel: 2 },
    { pin: 'A3', name: 'A3', capabilities: ['digital', 'analog', 'adc'], adcChannel: 3 },
    { pin: 'A4', name: 'A4', capabilities: ['digital', 'analog', 'adc', 'i2c_sda'], adcChannel: 4, notes: 'Shared with I2C SDA. Cannot use as analog when I2C active.' },
    { pin: 'A5', name: 'A5', capabilities: ['digital', 'analog', 'adc', 'i2c_scl'], adcChannel: 5, notes: 'Shared with I2C SCL. Cannot use as analog when I2C active.' },
  ],
  buses: [
    {
      type: 'i2c',
      name: 'Wire',
      pins: [
        { role: 'SDA', pin: 'A4' },
        { role: 'SCL', pin: 'A5' },
      ],
    },
    {
      type: 'spi',
      name: 'SPI',
      pins: [
        { role: 'MOSI', pin: '11' },
        { role: 'MISO', pin: '12' },
        { role: 'SCK', pin: '13' },
        { role: 'SS', pin: '10' },
      ],
    },
    {
      type: 'uart',
      name: 'Serial',
      pins: [
        { role: 'TX', pin: '1' },
        { role: 'RX', pin: '0' },
      ],
    },
  ],
};
