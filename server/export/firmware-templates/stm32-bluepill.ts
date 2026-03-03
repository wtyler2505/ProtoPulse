/**
 * STM32 Blue Pill (STM32F103C8T6) board template.
 *
 * STM32F103C8T6 — 72 MHz Cortex-M3, 64 KB flash, 20 KB SRAM.
 * 37 GPIO pins, 2x I2C, 2x SPI, 3x UART, 10 ADC channels, 7 timers.
 */

import type { BoardTemplate } from './types';

export const stm32BluepillTemplate: BoardTemplate = {
  boardId: 'stm32-bluepill',
  displayName: 'STM32 Blue Pill (F103C8T6)',
  platform: 'platformio',
  mcu: 'STM32F103C8T6',
  platformioBoard: 'bluepill_f103c8',
  platformioPlatform: 'ststm32',
  platformioFramework: 'arduino',
  defaultLibraries: ['Wire', 'SPI'],
  notes: [
    'STM32F103C8T6 runs at 72 MHz (Cortex-M3) with 20 KB SRAM, 64 KB flash.',
    'PC13 has the onboard LED (active LOW on most Blue Pill clones).',
    'USB D+ needs a 1.5k pull-up resistor — many clones have wrong value (10k).',
    '3.3V logic — NOT 5V tolerant on most pins (some are, check datasheet).',
    'PA11/PA12 are USB D-/D+ — do not use for GPIO if USB is needed.',
    'Boot0 pin selects boot mode — must be LOW for normal flash boot.',
  ],
  pins: [
    // Port A
    { pin: 'PA0', name: 'PA0', capabilities: ['digital', 'adc', 'pwm', 'uart_tx'], adcChannel: 0, pwmChannel: 0, notes: 'TIM2_CH1, USART2_CTS, ADC_IN0.' },
    { pin: 'PA1', name: 'PA1', capabilities: ['digital', 'adc', 'pwm'], adcChannel: 1, pwmChannel: 1, notes: 'TIM2_CH2, ADC_IN1.' },
    { pin: 'PA2', name: 'PA2', capabilities: ['digital', 'adc', 'pwm', 'uart_tx'], adcChannel: 2, pwmChannel: 2, notes: 'TIM2_CH3, USART2_TX, ADC_IN2.' },
    { pin: 'PA3', name: 'PA3', capabilities: ['digital', 'adc', 'pwm', 'uart_rx'], adcChannel: 3, pwmChannel: 3, notes: 'TIM2_CH4, USART2_RX, ADC_IN3.' },
    { pin: 'PA4', name: 'PA4', capabilities: ['digital', 'adc', 'spi_cs', 'dac'], adcChannel: 4, notes: 'SPI1_NSS, ADC_IN4.' },
    { pin: 'PA5', name: 'PA5', capabilities: ['digital', 'adc', 'spi_sck', 'dac'], adcChannel: 5, notes: 'SPI1_SCK, ADC_IN5.' },
    { pin: 'PA6', name: 'PA6', capabilities: ['digital', 'adc', 'spi_miso', 'pwm'], adcChannel: 6, pwmChannel: 4, notes: 'SPI1_MISO, TIM3_CH1, ADC_IN6.' },
    { pin: 'PA7', name: 'PA7', capabilities: ['digital', 'adc', 'spi_mosi', 'pwm'], adcChannel: 7, pwmChannel: 5, notes: 'SPI1_MOSI, TIM3_CH2, ADC_IN7.' },
    { pin: 'PA8', name: 'PA8', capabilities: ['digital', 'pwm'], pwmChannel: 6, notes: 'TIM1_CH1.' },
    { pin: 'PA9', name: 'PA9', capabilities: ['digital', 'pwm', 'uart_tx'], pwmChannel: 7, notes: 'TIM1_CH2, USART1_TX.' },
    { pin: 'PA10', name: 'PA10', capabilities: ['digital', 'pwm', 'uart_rx'], pwmChannel: 8, notes: 'TIM1_CH3, USART1_RX.' },
    { pin: 'PA11', name: 'PA11', capabilities: ['digital', 'pwm'], pwmChannel: 9, notes: 'USB D-, TIM1_CH4. Avoid if USB needed.' },
    { pin: 'PA12', name: 'PA12', capabilities: ['digital'], notes: 'USB D+. Avoid if USB needed.' },
    { pin: 'PA15', name: 'PA15', capabilities: ['digital'], notes: 'JTDI. Available after JTAG disable.' },
    // Port B
    { pin: 'PB0', name: 'PB0', capabilities: ['digital', 'adc', 'pwm'], adcChannel: 8, pwmChannel: 10, notes: 'TIM3_CH3, ADC_IN8.' },
    { pin: 'PB1', name: 'PB1', capabilities: ['digital', 'adc', 'pwm'], adcChannel: 9, pwmChannel: 11, notes: 'TIM3_CH4, ADC_IN9.' },
    { pin: 'PB3', name: 'PB3', capabilities: ['digital'], notes: 'JTDO/TRACESWO. Available after JTAG disable.' },
    { pin: 'PB4', name: 'PB4', capabilities: ['digital'], notes: 'NJTRST. Available after JTAG disable.' },
    { pin: 'PB5', name: 'PB5', capabilities: ['digital', 'spi_mosi'], notes: 'I2C1_SMBA, SPI1_MOSI (remap).' },
    { pin: 'PB6', name: 'PB6', capabilities: ['digital', 'pwm', 'i2c_scl', 'uart_tx'], pwmChannel: 12, notes: 'TIM4_CH1, I2C1_SCL, USART1_TX (remap).' },
    { pin: 'PB7', name: 'PB7', capabilities: ['digital', 'pwm', 'i2c_sda', 'uart_rx'], pwmChannel: 13, notes: 'TIM4_CH2, I2C1_SDA, USART1_RX (remap).' },
    { pin: 'PB8', name: 'PB8', capabilities: ['digital', 'pwm', 'i2c_scl'], pwmChannel: 14, notes: 'TIM4_CH3, I2C1_SCL (remap).' },
    { pin: 'PB9', name: 'PB9', capabilities: ['digital', 'pwm', 'i2c_sda'], pwmChannel: 15, notes: 'TIM4_CH4, I2C1_SDA (remap).' },
    { pin: 'PB10', name: 'PB10', capabilities: ['digital', 'i2c_scl', 'uart_tx'], notes: 'I2C2_SCL, USART3_TX.' },
    { pin: 'PB11', name: 'PB11', capabilities: ['digital', 'i2c_sda', 'uart_rx'], notes: 'I2C2_SDA, USART3_RX.' },
    { pin: 'PB12', name: 'PB12', capabilities: ['digital', 'spi_cs'], notes: 'SPI2_NSS.' },
    { pin: 'PB13', name: 'PB13', capabilities: ['digital', 'spi_sck'], notes: 'SPI2_SCK.' },
    { pin: 'PB14', name: 'PB14', capabilities: ['digital', 'spi_miso'], notes: 'SPI2_MISO.' },
    { pin: 'PB15', name: 'PB15', capabilities: ['digital', 'spi_mosi'], notes: 'SPI2_MOSI.' },
    // Port C
    { pin: 'PC13', name: 'PC13', capabilities: ['digital'], notes: 'Onboard LED (active LOW). Limited current sink (3 mA).' },
    { pin: 'PC14', name: 'PC14', capabilities: ['digital'], notes: 'OSC32_IN. Use only if no external 32 kHz crystal.' },
    { pin: 'PC15', name: 'PC15', capabilities: ['digital'], notes: 'OSC32_OUT. Use only if no external 32 kHz crystal.' },
  ],
  buses: [
    {
      type: 'i2c',
      name: 'Wire',
      pins: [
        { role: 'SDA', pin: 'PB9' },
        { role: 'SCL', pin: 'PB8' },
      ],
    },
    {
      type: 'i2c',
      name: 'Wire1',
      pins: [
        { role: 'SDA', pin: 'PB11' },
        { role: 'SCL', pin: 'PB10' },
      ],
    },
    {
      type: 'spi',
      name: 'SPI',
      pins: [
        { role: 'MOSI', pin: 'PA7' },
        { role: 'MISO', pin: 'PA6' },
        { role: 'SCK', pin: 'PA5' },
        { role: 'NSS', pin: 'PA4' },
      ],
    },
    {
      type: 'spi',
      name: 'SPI2',
      pins: [
        { role: 'MOSI', pin: 'PB15' },
        { role: 'MISO', pin: 'PB14' },
        { role: 'SCK', pin: 'PB13' },
        { role: 'NSS', pin: 'PB12' },
      ],
    },
    {
      type: 'uart',
      name: 'Serial',
      pins: [
        { role: 'TX', pin: 'PA9' },
        { role: 'RX', pin: 'PA10' },
      ],
    },
    {
      type: 'uart',
      name: 'Serial2',
      pins: [
        { role: 'TX', pin: 'PA2' },
        { role: 'RX', pin: 'PA3' },
      ],
    },
    {
      type: 'uart',
      name: 'Serial3',
      pins: [
        { role: 'TX', pin: 'PB10' },
        { role: 'RX', pin: 'PB11' },
      ],
    },
  ],
};
