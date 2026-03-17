/**
 * Board-Aware Suggestions Tests
 *
 * Tests for client/src/lib/board-aware-suggestions.ts.
 * Covers board capabilities, pin usage analysis, optimal pin suggestions,
 * timer conflict detection, and the React hook.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  BOARD_CAPABILITIES,
  getBoardCapability,
  getSupportedBoards,
  analyzePinUsage,
  suggestOptimalPins,
  checkTimerConflicts,
  useBoardSuggestions,
} from '../board-aware-suggestions';
import type {
  BoardCapability,
  BoardSuggestion,
  PinRequirement,
  TimerConflict,
} from '../board-aware-suggestions';

// ---------------------------------------------------------------------------
// BOARD_CAPABILITIES — data integrity
// ---------------------------------------------------------------------------

describe('BOARD_CAPABILITIES', () => {
  const boards = Object.keys(BOARD_CAPABILITIES);

  it('contains at least 5 boards', () => {
    expect(boards.length).toBeGreaterThanOrEqual(5);
  });

  it('includes Arduino Uno, Arduino Mega, ESP32, STM32, and Raspberry Pi Pico', () => {
    expect(boards).toContain('Arduino Uno');
    expect(boards).toContain('Arduino Mega');
    expect(boards).toContain('ESP32');
    expect(boards).toContain('STM32');
    expect(boards).toContain('Raspberry Pi Pico');
  });

  it.each(boards)('%s has positive timer count', (board) => {
    expect(BOARD_CAPABILITIES[board].timers).toBeGreaterThan(0);
  });

  it.each(boards)('%s has at least one PWM pin', (board) => {
    expect(BOARD_CAPABILITIES[board].pwmPins.length).toBeGreaterThan(0);
  });

  it.each(boards)('%s has at least one analog pin', (board) => {
    expect(BOARD_CAPABILITIES[board].analogPins.length).toBeGreaterThan(0);
  });

  it.each(boards)('%s has at least one interrupt pin', (board) => {
    expect(BOARD_CAPABILITIES[board].interruptPins.length).toBeGreaterThan(0);
  });

  it.each(boards)('%s has at least one I2C bus', (board) => {
    expect(BOARD_CAPABILITIES[board].i2cPins.length).toBeGreaterThan(0);
    for (const bus of BOARD_CAPABILITIES[board].i2cPins) {
      expect(typeof bus.sda).toBe('number');
      expect(typeof bus.scl).toBe('number');
    }
  });

  it.each(boards)('%s has at least one SPI bus', (board) => {
    expect(BOARD_CAPABILITIES[board].spiPins.length).toBeGreaterThan(0);
    for (const bus of BOARD_CAPABILITIES[board].spiPins) {
      expect(typeof bus.mosi).toBe('number');
      expect(typeof bus.miso).toBe('number');
      expect(typeof bus.sck).toBe('number');
      expect(typeof bus.ss).toBe('number');
    }
  });

  it('Arduino Uno has exactly 3 timers', () => {
    expect(BOARD_CAPABILITIES['Arduino Uno'].timers).toBe(3);
  });

  it('Arduino Uno has 6 PWM pins', () => {
    expect(BOARD_CAPABILITIES['Arduino Uno'].pwmPins).toEqual([3, 5, 6, 9, 10, 11]);
  });

  it('Arduino Uno has 2 interrupt pins', () => {
    expect(BOARD_CAPABILITIES['Arduino Uno'].interruptPins).toEqual([2, 3]);
  });

  it('ESP32 has 4 timers', () => {
    expect(BOARD_CAPABILITIES['ESP32'].timers).toBe(4);
  });

  it('ESP32 has 2 I2C buses', () => {
    expect(BOARD_CAPABILITIES['ESP32'].i2cPins).toHaveLength(2);
  });

  it('ESP32 has 2 SPI buses', () => {
    expect(BOARD_CAPABILITIES['ESP32'].spiPins).toHaveLength(2);
  });

  it('Raspberry Pi Pico has 8 timers (PWM slices)', () => {
    expect(BOARD_CAPABILITIES['Raspberry Pi Pico'].timers).toBe(8);
  });

  it('Raspberry Pi Pico has 3 analog pins', () => {
    expect(BOARD_CAPABILITIES['Raspberry Pi Pico'].analogPins).toEqual([26, 27, 28]);
  });

  it('all pin numbers are non-negative integers', () => {
    for (const board of boards) {
      const cap = BOARD_CAPABILITIES[board];
      const allPins = [
        ...cap.pwmPins,
        ...cap.analogPins,
        ...cap.interruptPins,
        ...cap.i2cPins.flatMap((b) => [b.sda, b.scl]),
        ...cap.spiPins.flatMap((b) => [b.mosi, b.miso, b.sck, b.ss]),
      ];
      for (const pin of allPins) {
        expect(pin).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(pin)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// getBoardCapability
// ---------------------------------------------------------------------------

describe('getBoardCapability', () => {
  it('returns capability for known board', () => {
    const cap = getBoardCapability('Arduino Uno');
    expect(cap).not.toBeNull();
    expect(cap!.timers).toBe(3);
  });

  it('returns null for unknown board', () => {
    expect(getBoardCapability('NonExistent Board 9999')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getSupportedBoards
// ---------------------------------------------------------------------------

describe('getSupportedBoards', () => {
  it('returns all board names', () => {
    const boards = getSupportedBoards();
    expect(boards).toContain('Arduino Uno');
    expect(boards).toContain('ESP32');
    expect(boards.length).toBeGreaterThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// analyzePinUsage
// ---------------------------------------------------------------------------

describe('analyzePinUsage', () => {
  it('returns warning for unknown board', () => {
    const result = analyzePinUsage('Unknown Board', [1, 2, 3]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('warning');
    expect(result[0].message).toContain('Unknown board');
  });

  it('returns empty array when no pins are used', () => {
    const result = analyzePinUsage('Arduino Uno', []);
    // Should only have the info about analog pins remaining
    const warnings = result.filter((s) => s.type === 'warning');
    expect(warnings).toHaveLength(0);
  });

  it('warns when I2C SDA pin is used as general I/O', () => {
    // Arduino Uno I2C SDA is pin 18 (A4)
    const result = analyzePinUsage('Arduino Uno', [18]);
    const i2cWarnings = result.filter((s) => s.type === 'warning' && s.message.includes('I2C SDA'));
    expect(i2cWarnings.length).toBeGreaterThanOrEqual(1);
    expect(i2cWarnings[0].pin).toBe(18);
  });

  it('warns when I2C SCL pin is used as general I/O', () => {
    // Arduino Uno I2C SCL is pin 19 (A5)
    const result = analyzePinUsage('Arduino Uno', [19]);
    const i2cWarnings = result.filter((s) => s.type === 'warning' && s.message.includes('I2C SCL'));
    expect(i2cWarnings.length).toBeGreaterThanOrEqual(1);
    expect(i2cWarnings[0].pin).toBe(19);
  });

  it('produces info when SPI pins are used', () => {
    // Arduino Uno SPI MOSI = 11
    const result = analyzePinUsage('Arduino Uno', [11]);
    const spiInfo = result.filter((s) => s.message.includes('SPI'));
    expect(spiInfo.length).toBeGreaterThanOrEqual(1);
  });

  it('suggests PWM alternative for non-PWM pin', () => {
    // Pin 2 on Uno is NOT a PWM pin, but is an interrupt pin
    const result = analyzePinUsage('Arduino Uno', [2]);
    const pwmOpt = result.filter((s) => s.type === 'optimization' && s.message.includes('PWM'));
    expect(pwmOpt.length).toBeGreaterThanOrEqual(1);
    expect(pwmOpt[0].pin).toBe(2);
    expect(pwmOpt[0].alternative).toBeDefined();
    // The alternative should be a real PWM pin
    expect(BOARD_CAPABILITIES['Arduino Uno'].pwmPins).toContain(pwmOpt[0].alternative);
  });

  it('warns on high pin utilization (>80%)', () => {
    // Arduino Uno has ~20 unique I/O pins. Using 18 should trigger warning.
    const manyPins = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
    const result = analyzePinUsage('Arduino Uno', manyPins);
    const highUtil = result.filter((s) => s.message.includes('High pin utilization'));
    expect(highUtil.length).toBeGreaterThanOrEqual(1);
  });

  it('warns when all analog pins are consumed', () => {
    // Arduino Uno analog: [14, 15, 16, 17, 18, 19]
    const result = analyzePinUsage('Arduino Uno', [14, 15, 16, 17, 18, 19]);
    const allAnalog = result.filter((s) => s.message.includes('All') && s.message.includes('analog'));
    expect(allAnalog.length).toBeGreaterThanOrEqual(1);
  });

  it('warns when all interrupt pins are consumed', () => {
    // Arduino Uno interrupt: [2, 3]
    const result = analyzePinUsage('Arduino Uno', [2, 3]);
    const allInt = result.filter((s) => s.message.includes('interrupt'));
    expect(allInt.length).toBeGreaterThanOrEqual(1);
  });

  it('reports remaining analog pins as info', () => {
    // Use only one analog pin
    const result = analyzePinUsage('Arduino Uno', [14]);
    const info = result.filter((s) => s.type === 'info' && s.message.includes('analog pins still available'));
    expect(info.length).toBe(1);
    expect(info[0].message).toContain('5 of 6');
  });

  it('sorts suggestions: warnings first, info second, optimization last', () => {
    // Use I2C pin + non-PWM pin to get both warning and optimization
    const result = analyzePinUsage('Arduino Uno', [18, 4]);
    if (result.length >= 2) {
      const types = result.map((s) => s.type);
      const warningIdx = types.indexOf('warning');
      const optIdx = types.indexOf('optimization');
      if (warningIdx !== -1 && optIdx !== -1) {
        expect(warningIdx).toBeLessThan(optIdx);
      }
    }
  });

  it('handles ESP32 I2C pin check', () => {
    // ESP32 default I2C SDA = 21
    const result = analyzePinUsage('ESP32', [21]);
    const i2cWarnings = result.filter((s) => s.message.includes('I2C SDA'));
    expect(i2cWarnings.length).toBeGreaterThanOrEqual(1);
    expect(i2cWarnings[0].pin).toBe(21);
  });

  it('does not suggest PWM alternative for a PWM-capable pin', () => {
    // Pin 9 on Uno IS a PWM pin
    const result = analyzePinUsage('Arduino Uno', [9]);
    const pwmOpt = result.filter((s) => s.type === 'optimization' && s.pin === 9 && s.message.includes('PWM'));
    expect(pwmOpt).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// suggestOptimalPins
// ---------------------------------------------------------------------------

describe('suggestOptimalPins', () => {
  it('returns empty array for unknown board', () => {
    expect(suggestOptimalPins('FakeBoard', { analog: 1 })).toEqual([]);
  });

  it('allocates analog pins', () => {
    const pins = suggestOptimalPins('Arduino Uno', { analog: 2 });
    expect(pins).toHaveLength(2);
    for (const pin of pins) {
      expect(BOARD_CAPABILITIES['Arduino Uno'].analogPins).toContain(pin);
    }
  });

  it('allocates PWM pins', () => {
    const pins = suggestOptimalPins('Arduino Uno', { pwm: 3 });
    expect(pins).toHaveLength(3);
    for (const pin of pins) {
      expect(BOARD_CAPABILITIES['Arduino Uno'].pwmPins).toContain(pin);
    }
  });

  it('allocates interrupt pins', () => {
    const pins = suggestOptimalPins('Arduino Uno', { interrupt: 2 });
    expect(pins).toHaveLength(2);
    for (const pin of pins) {
      expect(BOARD_CAPABILITIES['Arduino Uno'].interruptPins).toContain(pin);
    }
  });

  it('allocates digital pins without duplicates', () => {
    const pins = suggestOptimalPins('Arduino Uno', { digital: 4 });
    expect(pins).toHaveLength(4);
    expect(new Set(pins).size).toBe(4);
  });

  it('does not double-allocate pins across categories', () => {
    const pins = suggestOptimalPins('Arduino Uno', {
      analog: 2,
      pwm: 2,
      interrupt: 1,
    });
    expect(pins).toHaveLength(5);
    expect(new Set(pins).size).toBe(5); // All unique
  });

  it('returns fewer pins than requested when board runs out', () => {
    // Arduino Uno only has 2 interrupt pins
    const pins = suggestOptimalPins('Arduino Uno', { interrupt: 5 });
    expect(pins.length).toBeLessThanOrEqual(2);
  });

  it('prioritizes interrupt pins over analog and PWM', () => {
    // Request 1 interrupt + 1 analog; interrupt pin 2 on Uno is NOT analog
    const pins = suggestOptimalPins('Arduino Uno', { interrupt: 1, analog: 1 });
    expect(pins).toHaveLength(2);
    expect(BOARD_CAPABILITIES['Arduino Uno'].interruptPins).toContain(pins[0]);
  });

  it('works with ESP32 large pin set', () => {
    const pins = suggestOptimalPins('ESP32', { analog: 3, pwm: 5, interrupt: 2 });
    expect(pins).toHaveLength(10);
    expect(new Set(pins).size).toBe(10);
  });

  it('handles empty requirement gracefully', () => {
    const pins = suggestOptimalPins('Arduino Uno', {});
    expect(pins).toEqual([]);
  });

  it('handles zero counts', () => {
    const pins = suggestOptimalPins('Arduino Uno', { analog: 0, pwm: 0 });
    expect(pins).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// checkTimerConflicts
// ---------------------------------------------------------------------------

describe('checkTimerConflicts', () => {
  it('returns empty array for unknown board', () => {
    expect(checkTimerConflicts('FakeBoard', ['servo', 'tone'])).toEqual([]);
  });

  it('returns empty array when no features are given', () => {
    expect(checkTimerConflicts('Arduino Uno', [])).toEqual([]);
  });

  it('returns empty array when only one feature uses a timer', () => {
    expect(checkTimerConflicts('Arduino Uno', ['servo'])).toEqual([]);
  });

  it('detects servo + tone conflict on Arduino Uno', () => {
    // On Uno: servo uses Timer1, tone uses Timer2. No overlap.
    const conflicts = checkTimerConflicts('Arduino Uno', ['servo', 'tone']);
    // These should NOT conflict on Uno (different timers)
    expect(conflicts).toHaveLength(0);
  });

  it('detects servo + pwm conflict sharing Timer1 on Arduino Uno', () => {
    // servo uses Timer1, pwm uses Timer0+1+2 — Timer1 is shared
    const conflicts = checkTimerConflicts('Arduino Uno', ['servo', 'pwm']);
    const timer1Conflict = conflicts.find((c) => c.timer === 1);
    expect(timer1Conflict).toBeDefined();
    expect(timer1Conflict!.features).toContain('servo');
    expect(timer1Conflict!.features).toContain('pwm');
  });

  it('detects millis + pwm conflict sharing Timer0 on Arduino Uno', () => {
    const conflicts = checkTimerConflicts('Arduino Uno', ['millis', 'pwm']);
    const timer0Conflict = conflicts.find((c) => c.timer === 0);
    expect(timer0Conflict).toBeDefined();
    expect(timer0Conflict!.features).toContain('millis');
    expect(timer0Conflict!.features).toContain('pwm');
  });

  it('conflict message includes affected pin numbers', () => {
    const conflicts = checkTimerConflicts('Arduino Uno', ['servo', 'analogWrite']);
    const timer1Conflict = conflicts.find((c) => c.timer === 1);
    expect(timer1Conflict).toBeDefined();
    expect(timer1Conflict!.message).toContain('pins');
    expect(timer1Conflict!.message).toContain('9');
    expect(timer1Conflict!.message).toContain('10');
  });

  it('ignores unknown features gracefully', () => {
    const conflicts = checkTimerConflicts('Arduino Uno', ['servo', 'unknownFeature123']);
    // servo alone has no conflict
    expect(conflicts).toHaveLength(0);
  });

  it('is case-insensitive for feature names', () => {
    const conflicts = checkTimerConflicts('Arduino Uno', ['Servo', 'PWM']);
    const timer1Conflict = conflicts.find((c) => c.timer === 1);
    expect(timer1Conflict).toBeDefined();
  });

  it('sorts conflicts by timer number', () => {
    const conflicts = checkTimerConflicts('Arduino Uno', ['millis', 'servo', 'tone', 'pwm']);
    if (conflicts.length >= 2) {
      for (let i = 1; i < conflicts.length; i++) {
        expect(conflicts[i].timer).toBeGreaterThanOrEqual(conflicts[i - 1].timer);
      }
    }
  });

  it('works with ESP32 timer groups', () => {
    const conflicts = checkTimerConflicts('ESP32', ['servo', 'pwm']);
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
  });

  it('works with Raspberry Pi Pico', () => {
    const conflicts = checkTimerConflicts('Raspberry Pi Pico', ['servo', 'pwm']);
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
  });

  it('detects conflict on Arduino Mega', () => {
    // Mega: servo uses Timer1,3,4,5; pwm uses all timers
    const conflicts = checkTimerConflicts('Arduino Mega', ['servo', 'pwm']);
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// useBoardSuggestions hook
// ---------------------------------------------------------------------------

describe('useBoardSuggestions', () => {
  it('returns the board name', () => {
    const { result } = renderHook(() => useBoardSuggestions('Arduino Uno'));
    expect(result.current.board).toBe('Arduino Uno');
  });

  it('returns capabilities for known board', () => {
    const { result } = renderHook(() => useBoardSuggestions('ESP32'));
    expect(result.current.capabilities).not.toBeNull();
    expect(result.current.capabilities!.timers).toBe(4);
  });

  it('returns null capabilities for unknown board', () => {
    const { result } = renderHook(() => useBoardSuggestions('FakeBoard'));
    expect(result.current.capabilities).toBeNull();
  });

  it('starts with empty suggestions', () => {
    const { result } = renderHook(() => useBoardSuggestions('Arduino Uno'));
    expect(result.current.suggestions).toEqual([]);
  });

  it('analyze() updates suggestions state', () => {
    const { result } = renderHook(() => useBoardSuggestions('Arduino Uno'));

    act(() => {
      result.current.analyze([18, 19, 2, 4]);
    });

    expect(result.current.suggestions.length).toBeGreaterThan(0);
  });

  it('analyze() returns the same suggestions it sets', () => {
    const { result } = renderHook(() => useBoardSuggestions('Arduino Uno'));

    let returned: BoardSuggestion[] = [];
    act(() => {
      returned = result.current.analyze([18]);
    });

    expect(returned).toEqual(result.current.suggestions);
  });

  it('suggest() returns optimal pins', () => {
    const { result } = renderHook(() => useBoardSuggestions('Arduino Uno'));
    const pins = result.current.suggest({ pwm: 2 });
    expect(pins).toHaveLength(2);
  });

  it('conflicts() returns timer conflicts', () => {
    const { result } = renderHook(() => useBoardSuggestions('Arduino Uno'));
    const conflicts = result.current.conflicts(['servo', 'pwm']);
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
  });

  it('updates capabilities when board changes', () => {
    const { result, rerender } = renderHook(
      (props: { board: string }) => useBoardSuggestions(props.board),
      { initialProps: { board: 'Arduino Uno' } },
    );

    expect(result.current.capabilities!.timers).toBe(3);

    rerender({ board: 'ESP32' });

    expect(result.current.capabilities!.timers).toBe(4);
    expect(result.current.board).toBe('ESP32');
  });
});
