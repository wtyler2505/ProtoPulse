/**
 * ESP32 DevKit V1 board template.
 *
 * Based on the Espressif ESP32-WROOM-32 module with 38-pin devkit layout.
 * Covers the most common ESP32 development board variant.
 */

import type { BoardTemplate } from './types';

export const esp32DevkitTemplate: BoardTemplate = {
  boardId: 'esp32-devkit',
  displayName: 'ESP32 DevKit V1',
  platform: 'platformio',
  mcu: 'ESP32',
  platformioBoard: 'esp32dev',
  platformioPlatform: 'espressif32',
  platformioFramework: 'arduino',
  defaultLibraries: ['WiFi', 'Wire', 'SPI', 'BluetoothSerial'],
  notes: [
    'ESP32 has two cores — use xTaskCreatePinnedToCore() for parallel tasks.',
    'GPIO6-11 are connected to internal flash — do NOT use them.',
    'GPIO34-39 are input-only (no internal pullup).',
    'ADC2 channels cannot be used while WiFi is active.',
    'Strapping pins (GPIO0, GPIO2, GPIO5, GPIO12, GPIO15) affect boot mode.',
  ],
  pins: [
    // GPIO0 — strapping pin
    { pin: 0, name: 'GPIO0', capabilities: ['digital', 'adc', 'pwm', 'touch'], adcChannel: 11, pwmChannel: 0, notes: 'Strapping pin — must be HIGH during boot. Onboard BOOT button.' },
    // GPIO1 — UART0 TX (USB serial)
    { pin: 1, name: 'GPIO1', capabilities: ['digital', 'uart_tx'], notes: 'UART0 TX — used by USB serial. Avoid for general GPIO.' },
    // GPIO2 — strapping pin, onboard LED on many boards
    { pin: 2, name: 'GPIO2', capabilities: ['digital', 'adc', 'pwm', 'touch'], adcChannel: 12, pwmChannel: 1, notes: 'Strapping pin. Onboard LED on many devkits.' },
    // GPIO3 — UART0 RX (USB serial)
    { pin: 3, name: 'GPIO3', capabilities: ['digital', 'uart_rx'], notes: 'UART0 RX — used by USB serial. Avoid for general GPIO.' },
    // GPIO4
    { pin: 4, name: 'GPIO4', capabilities: ['digital', 'adc', 'pwm', 'touch'], adcChannel: 10, pwmChannel: 2 },
    // GPIO5 — strapping pin, default VSPI CS
    { pin: 5, name: 'GPIO5', capabilities: ['digital', 'pwm', 'spi_cs'], pwmChannel: 3, notes: 'Strapping pin. Default VSPI SS/CS.' },
    // GPIO12 — strapping pin (MTDI)
    { pin: 12, name: 'GPIO12', capabilities: ['digital', 'adc', 'pwm', 'touch', 'spi_miso'], adcChannel: 15, pwmChannel: 4, notes: 'Strapping pin (MTDI). Must be LOW during boot for 3.3V flash.' },
    // GPIO13
    { pin: 13, name: 'GPIO13', capabilities: ['digital', 'adc', 'pwm', 'touch'], adcChannel: 14, pwmChannel: 5 },
    // GPIO14
    { pin: 14, name: 'GPIO14', capabilities: ['digital', 'adc', 'pwm', 'touch'], adcChannel: 16, pwmChannel: 6 },
    // GPIO15 — strapping pin (MTDO)
    { pin: 15, name: 'GPIO15', capabilities: ['digital', 'adc', 'pwm', 'touch', 'spi_cs'], adcChannel: 13, pwmChannel: 7, notes: 'Strapping pin (MTDO). Controls debug log output at boot.' },
    // GPIO16
    { pin: 16, name: 'GPIO16', capabilities: ['digital', 'pwm', 'uart_rx'], pwmChannel: 8, notes: 'UART2 RX default.' },
    // GPIO17
    { pin: 17, name: 'GPIO17', capabilities: ['digital', 'pwm', 'uart_tx'], pwmChannel: 9, notes: 'UART2 TX default.' },
    // GPIO18 — default VSPI SCK
    { pin: 18, name: 'GPIO18', capabilities: ['digital', 'pwm', 'spi_sck'], pwmChannel: 10 },
    // GPIO19 — default VSPI MISO
    { pin: 19, name: 'GPIO19', capabilities: ['digital', 'pwm', 'spi_miso'], pwmChannel: 11 },
    // GPIO21 — default I2C SDA
    { pin: 21, name: 'GPIO21', capabilities: ['digital', 'pwm', 'i2c_sda'], pwmChannel: 12 },
    // GPIO22 — default I2C SCL
    { pin: 22, name: 'GPIO22', capabilities: ['digital', 'pwm', 'i2c_scl'], pwmChannel: 13 },
    // GPIO23 — default VSPI MOSI
    { pin: 23, name: 'GPIO23', capabilities: ['digital', 'pwm', 'spi_mosi'], pwmChannel: 14 },
    // GPIO25 — DAC1
    { pin: 25, name: 'GPIO25', capabilities: ['digital', 'adc', 'pwm', 'dac'], adcChannel: 18 },
    // GPIO26 — DAC2
    { pin: 26, name: 'GPIO26', capabilities: ['digital', 'adc', 'pwm', 'dac'], adcChannel: 19 },
    // GPIO27
    { pin: 27, name: 'GPIO27', capabilities: ['digital', 'adc', 'pwm', 'touch'], adcChannel: 17 },
    // GPIO32
    { pin: 32, name: 'GPIO32', capabilities: ['digital', 'adc', 'pwm', 'touch'], adcChannel: 4 },
    // GPIO33
    { pin: 33, name: 'GPIO33', capabilities: ['digital', 'adc', 'pwm', 'touch'], adcChannel: 5 },
    // GPIO34 — input only
    { pin: 34, name: 'GPIO34', capabilities: ['digital', 'adc'], adcChannel: 6, notes: 'Input only — no internal pullup/pulldown.' },
    // GPIO35 — input only
    { pin: 35, name: 'GPIO35', capabilities: ['digital', 'adc'], adcChannel: 7, notes: 'Input only — no internal pullup/pulldown.' },
    // GPIO36 (VP) — input only
    { pin: 36, name: 'GPIO36', capabilities: ['digital', 'adc'], adcChannel: 0, notes: 'Input only (VP/SENSOR_VP) — no internal pullup/pulldown.' },
    // GPIO39 (VN) — input only
    { pin: 39, name: 'GPIO39', capabilities: ['digital', 'adc'], adcChannel: 3, notes: 'Input only (VN/SENSOR_VN) — no internal pullup/pulldown.' },
  ],
  buses: [
    {
      type: 'i2c',
      name: 'Wire',
      pins: [
        { role: 'SDA', pin: '21' },
        { role: 'SCL', pin: '22' },
      ],
    },
    {
      type: 'i2c',
      name: 'Wire1',
      pins: [
        { role: 'SDA', pin: '25' },
        { role: 'SCL', pin: '26' },
      ],
    },
    {
      type: 'spi',
      name: 'SPI (VSPI)',
      pins: [
        { role: 'MOSI', pin: '23' },
        { role: 'MISO', pin: '19' },
        { role: 'SCK', pin: '18' },
        { role: 'CS', pin: '5' },
      ],
    },
    {
      type: 'spi',
      name: 'SPI1 (HSPI)',
      pins: [
        { role: 'MOSI', pin: '13' },
        { role: 'MISO', pin: '12' },
        { role: 'SCK', pin: '14' },
        { role: 'CS', pin: '15' },
      ],
    },
    {
      type: 'uart',
      name: 'Serial',
      pins: [
        { role: 'TX', pin: '1' },
        { role: 'RX', pin: '3' },
      ],
    },
    {
      type: 'uart',
      name: 'Serial1',
      pins: [
        { role: 'TX', pin: '17' },
        { role: 'RX', pin: '16' },
      ],
    },
    {
      type: 'uart',
      name: 'Serial2',
      pins: [
        { role: 'TX', pin: '17' },
        { role: 'RX', pin: '16' },
      ],
    },
  ],
};
