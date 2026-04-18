/**
 * Board profiles and simulator constants.
 *
 * Extracted from code-simulator.ts during the oversized-file split (T2).
 * Four supported boards: Arduino Uno, Mega, Nano, ESP32.
 */

import type { BoardProfile } from './types';

export const BOARD_PROFILES: Record<string, BoardProfile> = {
  'arduino:avr:uno': {
    name: 'Arduino Uno',
    fqbn: 'arduino:avr:uno',
    digitalPins: 14,
    analogPins: 6,
    pwmPins: [3, 5, 6, 9, 10, 11],
    interruptPins: [2, 3],
    flashKB: 32,
    sramKB: 2,
    clockMHz: 16,
    hasSerial1: false,
    analogReadMax: 1023,
    analogWriteMax: 255,
  },
  'arduino:avr:mega': {
    name: 'Arduino Mega',
    fqbn: 'arduino:avr:mega',
    digitalPins: 54,
    analogPins: 16,
    pwmPins: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    interruptPins: [2, 3, 18, 19, 20, 21],
    flashKB: 256,
    sramKB: 8,
    clockMHz: 16,
    hasSerial1: true,
    analogReadMax: 1023,
    analogWriteMax: 255,
  },
  'arduino:avr:nano': {
    name: 'Arduino Nano',
    fqbn: 'arduino:avr:nano',
    digitalPins: 14,
    analogPins: 8,
    pwmPins: [3, 5, 6, 9, 10, 11],
    interruptPins: [2, 3],
    flashKB: 32,
    sramKB: 2,
    clockMHz: 16,
    hasSerial1: false,
    analogReadMax: 1023,
    analogWriteMax: 255,
  },
  'esp32:esp32:esp32': {
    name: 'ESP32',
    fqbn: 'esp32:esp32:esp32',
    digitalPins: 40,
    analogPins: 18,
    pwmPins: [0, 1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27],
    interruptPins: [0, 1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27],
    flashKB: 4096,
    sramKB: 520,
    clockMHz: 240,
    hasSerial1: true,
    analogReadMax: 4095,
    analogWriteMax: 255,
  },
} as const;

export const DEFAULT_BOARD = 'arduino:avr:uno';
export const MAX_SERIAL_LINES = 500;
export const MAX_EXECUTION_STEPS = 100_000;
export const DEFAULT_BAUD = 9600;

// Arduino constants
export const HIGH = 1;
export const LOW = 0;
export const LED_BUILTIN = 13;
