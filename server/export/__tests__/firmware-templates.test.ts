import { describe, expect, it } from 'vitest';

import {
  detectBoard,
  getAllBoards,
  getBoardById,
  getBusesByType,
  getPinsByCapability,
} from '../firmware-templates';
import type { BoardTemplate } from '../firmware-templates';

// ---------------------------------------------------------------------------
// getAllBoards
// ---------------------------------------------------------------------------

describe('getAllBoards', () => {
  it('returns all 4 board templates', () => {
    const boards = getAllBoards();
    expect(boards).toHaveLength(4);
  });

  it('returns a new array each call (not a reference to internal state)', () => {
    const a = getAllBoards();
    const b = getAllBoards();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// getBoardById
// ---------------------------------------------------------------------------

describe('getBoardById', () => {
  it('finds esp32-devkit by exact boardId', () => {
    const board = getBoardById('esp32-devkit');
    expect(board).toBeDefined();
    expect(board!.mcu).toBe('ESP32');
  });

  it('finds arduino-mega by exact boardId', () => {
    const board = getBoardById('arduino-mega');
    expect(board).toBeDefined();
    expect(board!.mcu).toBe('ATmega2560');
  });

  it('finds arduino-uno by exact boardId', () => {
    const board = getBoardById('arduino-uno');
    expect(board).toBeDefined();
    expect(board!.mcu).toBe('ATmega328P');
  });

  it('finds stm32-bluepill by exact boardId', () => {
    const board = getBoardById('stm32-bluepill');
    expect(board).toBeDefined();
    expect(board!.mcu).toBe('STM32F103C8T6');
  });

  it('returns undefined for unknown boardId', () => {
    expect(getBoardById('nonexistent-board')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// detectBoard — fuzzy matching
// ---------------------------------------------------------------------------

describe('detectBoard', () => {
  it('detects ESP32 from "ESP32"', () => {
    const board = detectBoard('ESP32');
    expect(board).toBeDefined();
    expect(board!.boardId).toBe('esp32-devkit');
  });

  it('detects ESP32 from "esp32 devkit"', () => {
    const board = detectBoard('esp32 devkit');
    expect(board).toBeDefined();
    expect(board!.boardId).toBe('esp32-devkit');
  });

  it('detects Arduino Mega from "Arduino Mega"', () => {
    const board = detectBoard('Arduino Mega');
    expect(board).toBeDefined();
    expect(board!.boardId).toBe('arduino-mega');
  });

  it('detects Arduino Mega from "mega" shorthand', () => {
    const board = detectBoard('mega');
    expect(board).toBeDefined();
    expect(board!.boardId).toBe('arduino-mega');
  });

  it('detects Arduino Uno from "Arduino Uno"', () => {
    const board = detectBoard('Arduino Uno');
    expect(board).toBeDefined();
    expect(board!.boardId).toBe('arduino-uno');
  });

  it('detects Arduino Uno from "uno" shorthand', () => {
    const board = detectBoard('uno');
    expect(board).toBeDefined();
    expect(board!.boardId).toBe('arduino-uno');
  });

  it('detects STM32 Blue Pill from "STM32 Blue Pill"', () => {
    const board = detectBoard('STM32 Blue Pill');
    expect(board).toBeDefined();
    expect(board!.boardId).toBe('stm32-bluepill');
  });

  it('detects STM32 from "stm32" shorthand', () => {
    const board = detectBoard('stm32');
    expect(board).toBeDefined();
    expect(board!.boardId).toBe('stm32-bluepill');
  });

  it('detects STM32 from "F103" shorthand', () => {
    const board = detectBoard('F103');
    expect(board).toBeDefined();
    expect(board!.boardId).toBe('stm32-bluepill');
  });

  it('detects ESP32 from MCU name "ESP32"', () => {
    const board = detectBoard('ESP32');
    expect(board).toBeDefined();
    expect(board!.boardId).toBe('esp32-devkit');
  });

  it('detects Arduino Mega from MCU name "ATmega2560"', () => {
    const board = detectBoard('ATmega2560');
    expect(board).toBeDefined();
    expect(board!.boardId).toBe('arduino-mega');
  });

  it('returns undefined for unknown board name', () => {
    expect(detectBoard('unknown-board')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(detectBoard('')).toBeUndefined();
  });

  it('is case-insensitive', () => {
    expect(detectBoard('ESP32')?.boardId).toBe(detectBoard('esp32')?.boardId);
    expect(detectBoard('ARDUINO MEGA')?.boardId).toBe(detectBoard('arduino mega')?.boardId);
  });
});

// ---------------------------------------------------------------------------
// getPinsByCapability
// ---------------------------------------------------------------------------

describe('getPinsByCapability', () => {
  it('returns PWM pins for ESP32', () => {
    const board = getBoardById('esp32-devkit')!;
    const pwmPins = getPinsByCapability(board, 'pwm');
    expect(pwmPins.length).toBeGreaterThan(0);
    // Every returned pin must actually have the pwm capability
    for (const pin of pwmPins) {
      expect(pin.capabilities).toContain('pwm');
    }
  });

  it('returns ADC pins for Arduino Mega', () => {
    const board = getBoardById('arduino-mega')!;
    const adcPins = getPinsByCapability(board, 'adc');
    expect(adcPins.length).toBeGreaterThan(0);
    for (const pin of adcPins) {
      expect(pin.capabilities).toContain('adc');
    }
  });

  it('returns I2C SDA pins for Arduino Uno', () => {
    const board = getBoardById('arduino-uno')!;
    const sdaPins = getPinsByCapability(board, 'i2c_sda');
    expect(sdaPins.length).toBeGreaterThan(0);
    for (const pin of sdaPins) {
      expect(pin.capabilities).toContain('i2c_sda');
    }
  });

  it('returns DAC pins for ESP32', () => {
    const board = getBoardById('esp32-devkit')!;
    const dacPins = getPinsByCapability(board, 'dac');
    expect(dacPins.length).toBe(2); // GPIO25, GPIO26
  });

  it('returns touch-capable pins for ESP32', () => {
    const board = getBoardById('esp32-devkit')!;
    const touchPins = getPinsByCapability(board, 'touch');
    expect(touchPins.length).toBeGreaterThan(0);
    for (const pin of touchPins) {
      expect(pin.capabilities).toContain('touch');
    }
  });

  it('returns empty array for capability not present on board', () => {
    const board = getBoardById('arduino-uno')!;
    const touchPins = getPinsByCapability(board, 'touch');
    expect(touchPins).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getBusesByType
// ---------------------------------------------------------------------------

describe('getBusesByType', () => {
  it('returns SPI bus definitions for Arduino Mega', () => {
    const board = getBoardById('arduino-mega')!;
    const spiBuses = getBusesByType(board, 'spi');
    expect(spiBuses.length).toBeGreaterThan(0);
    for (const bus of spiBuses) {
      expect(bus.type).toBe('spi');
    }
  });

  it('returns I2C bus definitions for ESP32', () => {
    const board = getBoardById('esp32-devkit')!;
    const i2cBuses = getBusesByType(board, 'i2c');
    expect(i2cBuses.length).toBe(2); // Wire and Wire1
  });

  it('returns UART bus definitions for STM32 Blue Pill', () => {
    const board = getBoardById('stm32-bluepill')!;
    const uartBuses = getBusesByType(board, 'uart');
    expect(uartBuses.length).toBe(3); // Serial, Serial2, Serial3
    for (const bus of uartBuses) {
      expect(bus.type).toBe('uart');
    }
  });

  it('returns single I2C bus for Arduino Uno', () => {
    const board = getBoardById('arduino-uno')!;
    const i2cBuses = getBusesByType(board, 'i2c');
    expect(i2cBuses).toHaveLength(1);
    expect(i2cBuses[0].name).toBe('Wire');
  });
});

// ---------------------------------------------------------------------------
// Board template structure validation
// ---------------------------------------------------------------------------

describe('board template structure', () => {
  const boards = getAllBoards();

  it.each(boards.map((b) => [b.displayName, b] as const))('%s has valid structure', (_name, board: BoardTemplate) => {
    // Required string fields
    expect(board.boardId).toBeTruthy();
    expect(board.displayName).toBeTruthy();
    expect(board.mcu).toBeTruthy();
    expect(board.platformioBoard).toBeTruthy();
    expect(board.platformioPlatform).toBeTruthy();
    expect(board.platformioFramework).toBeTruthy();

    // Must have pins and buses
    expect(board.pins.length).toBeGreaterThan(0);
    expect(board.buses.length).toBeGreaterThan(0);

    // Platform must be valid
    expect(['arduino', 'platformio']).toContain(board.platform);

    // Default libraries array exists
    expect(Array.isArray(board.defaultLibraries)).toBe(true);

    // Notes array exists
    expect(Array.isArray(board.notes)).toBe(true);
    expect(board.notes.length).toBeGreaterThan(0);
  });

  it.each(boards.map((b) => [b.displayName, b] as const))('%s has valid pin definitions', (_name, board: BoardTemplate) => {
    for (const pin of board.pins) {
      // Every pin must have a name and at least one capability
      expect(pin.name).toBeTruthy();
      expect(pin.capabilities.length).toBeGreaterThan(0);

      // Pin number/name must be defined
      expect(pin.pin).toBeDefined();

      // ADC channel should only be present if pin has adc capability
      if (pin.adcChannel !== undefined) {
        expect(pin.capabilities).toContain('adc');
      }

      // PWM channel should only be present if pin has pwm capability
      if (pin.pwmChannel !== undefined) {
        expect(pin.capabilities).toContain('pwm');
      }
    }
  });

  it.each(boards.map((b) => [b.displayName, b] as const))('%s has valid bus definitions', (_name, board: BoardTemplate) => {
    for (const bus of board.buses) {
      expect(['i2c', 'spi', 'uart']).toContain(bus.type);
      expect(bus.name).toBeTruthy();
      expect(bus.pins.length).toBeGreaterThan(0);

      // Each bus pin assignment must have role and pin
      for (const busPin of bus.pins) {
        expect(busPin.role).toBeTruthy();
        expect(busPin.pin).toBeTruthy();
      }
    }
  });
});
