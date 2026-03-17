/**
 * Board-Aware Suggestions
 *
 * Provides hardware-aware pin usage analysis, optimal pin suggestions,
 * timer conflict detection, and board capability lookups for common
 * microcontroller development boards.
 *
 * Supported boards: Arduino Uno, Arduino Mega, ESP32, STM32 (Blue Pill),
 * Raspberry Pi Pico.
 *
 * Usage:
 *   const suggestions = analyzePinUsage('Arduino Uno', [3, 5, 9, 10, 11]);
 *   const optimal = suggestOptimalPins('ESP32', { analog: 2, pwm: 1 });
 *   const conflicts = checkTimerConflicts('Arduino Uno', ['servo', 'tone']);
 *
 * React hook:
 *   const { suggestions, suggest, conflicts } = useBoardSuggestions('Arduino Uno');
 */

import { useCallback, useMemo, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BoardCapability {
  /** Number of independent hardware timers. */
  timers: number;
  /** GPIO pin numbers that support hardware PWM output. */
  pwmPins: number[];
  /** GPIO pin numbers that support analog-to-digital conversion. */
  analogPins: number[];
  /** GPIO pin numbers that support external hardware interrupts. */
  interruptPins: number[];
  /** I2C bus pin pairs (may have multiple buses). */
  i2cPins: Array<{ sda: number; scl: number }>;
  /** SPI bus pin groups (may have multiple buses). */
  spiPins: Array<{ mosi: number; miso: number; sck: number; ss: number }>;
}

export type SuggestionType = 'warning' | 'info' | 'optimization';

export interface BoardSuggestion {
  /** Severity / category of the suggestion. */
  type: SuggestionType;
  /** Human-readable description of the suggestion. */
  message: string;
  /** The pin number this suggestion relates to, if applicable. */
  pin?: number;
  /** An alternative pin number that resolves the issue, if applicable. */
  alternative?: number;
}

export interface PinRequirement {
  /** Number of analog input pins needed. */
  analog?: number;
  /** Number of PWM output pins needed. */
  pwm?: number;
  /** Number of interrupt-capable pins needed. */
  interrupt?: number;
  /** Number of generic digital I/O pins needed. */
  digital?: number;
}

export interface TimerConflict {
  /** The timer resource that is contested. */
  timer: number;
  /** The features that share this timer. */
  features: string[];
  /** Human-readable explanation. */
  message: string;
}

// ---------------------------------------------------------------------------
// Timer-to-pin mapping per board (which timer drives which PWM pins)
// ---------------------------------------------------------------------------

interface TimerPinMapping {
  [timer: number]: number[];
}

const UNO_TIMER_PINS: TimerPinMapping = {
  0: [5, 6],   // Timer0 — millis()/delay(), pins 5 & 6
  1: [9, 10],  // Timer1 — Servo library default
  2: [3, 11],  // Timer2 — tone() default
};

const MEGA_TIMER_PINS: TimerPinMapping = {
  0: [4, 13],        // Timer0 — millis()/delay()
  1: [11, 12],       // Timer1
  2: [9, 10],        // Timer2
  3: [2, 3, 5],      // Timer3
  4: [6, 7, 8],      // Timer4
  5: [44, 45, 46],   // Timer5
};

const ESP32_TIMER_PINS: TimerPinMapping = {
  // ESP32 LEDC — each channel has its own timer; grouping by timer group
  0: [2, 4, 12, 13, 14, 15],   // Timer group 0
  1: [16, 17, 18, 19, 21, 22], // Timer group 1
  2: [23, 25, 26, 27, 32, 33], // Timer group 2 (high-speed channels)
  3: [5],                       // Timer group 3
};

const STM32_TIMER_PINS: TimerPinMapping = {
  1: [8, 9, 10, 11],  // TIM1 (advanced)
  2: [0, 1, 2, 3],    // TIM2 (general purpose) — PA0-PA3
  3: [4, 5, 6, 7],    // TIM3 (general purpose) — PA6, PA7, PB0, PB1
  4: [12, 13, 14, 15], // TIM4 (general purpose) — PB6-PB9
};

const PICO_TIMER_PINS: TimerPinMapping = {
  // RP2040 has 8 PWM slices (0-7), each with A and B channels
  0: [0, 1],
  1: [2, 3],
  2: [4, 5],
  3: [6, 7],
  4: [8, 9],
  5: [10, 11],
  6: [12, 13],
  7: [14, 15],
};

const BOARD_TIMER_PINS: Record<string, TimerPinMapping> = {
  'Arduino Uno': UNO_TIMER_PINS,
  'Arduino Mega': MEGA_TIMER_PINS,
  ESP32: ESP32_TIMER_PINS,
  STM32: STM32_TIMER_PINS,
  'Raspberry Pi Pico': PICO_TIMER_PINS,
};

// ---------------------------------------------------------------------------
// Feature-to-timer mappings (which Arduino library/feature uses which timer)
// ---------------------------------------------------------------------------

interface FeatureTimerMap {
  [feature: string]: number[];
}

const UNO_FEATURE_TIMERS: FeatureTimerMap = {
  servo: [1],
  tone: [2],
  millis: [0],
  delay: [0],
  pwm: [0, 1, 2],
  analogWrite: [0, 1, 2],
};

const MEGA_FEATURE_TIMERS: FeatureTimerMap = {
  servo: [1, 3, 4, 5],
  tone: [2],
  millis: [0],
  delay: [0],
  pwm: [0, 1, 2, 3, 4, 5],
  analogWrite: [0, 1, 2, 3, 4, 5],
};

const ESP32_FEATURE_TIMERS: FeatureTimerMap = {
  servo: [0, 1],
  tone: [2],
  millis: [0],
  delay: [0],
  pwm: [0, 1, 2, 3],
  ledcWrite: [0, 1, 2, 3],
};

const STM32_FEATURE_TIMERS: FeatureTimerMap = {
  servo: [1],
  tone: [3],
  millis: [2],
  delay: [2],
  pwm: [1, 2, 3, 4],
  analogWrite: [1, 2, 3, 4],
};

const PICO_FEATURE_TIMERS: FeatureTimerMap = {
  servo: [0, 1],
  tone: [2],
  millis: [3],
  delay: [3],
  pwm: [0, 1, 2, 3, 4, 5, 6, 7],
  analogWrite: [0, 1, 2, 3, 4, 5, 6, 7],
};

const BOARD_FEATURE_TIMERS: Record<string, FeatureTimerMap> = {
  'Arduino Uno': UNO_FEATURE_TIMERS,
  'Arduino Mega': MEGA_FEATURE_TIMERS,
  ESP32: ESP32_FEATURE_TIMERS,
  STM32: STM32_FEATURE_TIMERS,
  'Raspberry Pi Pico': PICO_FEATURE_TIMERS,
};

// ---------------------------------------------------------------------------
// Board capability database
// ---------------------------------------------------------------------------

export const BOARD_CAPABILITIES: Record<string, BoardCapability> = {
  'Arduino Uno': {
    timers: 3,
    pwmPins: [3, 5, 6, 9, 10, 11],
    analogPins: [14, 15, 16, 17, 18, 19], // A0-A5 (mapped to digital 14-19)
    interruptPins: [2, 3],
    i2cPins: [{ sda: 18, scl: 19 }], // A4/A5
    spiPins: [{ mosi: 11, miso: 12, sck: 13, ss: 10 }],
  },
  'Arduino Mega': {
    timers: 6,
    pwmPins: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 44, 45, 46],
    analogPins: [54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69], // A0-A15
    interruptPins: [2, 3, 18, 19, 20, 21],
    i2cPins: [{ sda: 20, scl: 21 }],
    spiPins: [{ mosi: 51, miso: 50, sck: 52, ss: 53 }],
  },
  ESP32: {
    timers: 4,
    pwmPins: [2, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33],
    analogPins: [32, 33, 34, 35, 36, 39, 25, 26, 27, 14, 12, 13, 15, 2, 4, 0], // ADC1 + ADC2
    interruptPins: [2, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33, 34, 35, 36, 39],
    i2cPins: [
      { sda: 21, scl: 22 },  // Default I2C
      { sda: 33, scl: 32 },  // Secondary I2C (software-configurable)
    ],
    spiPins: [
      { mosi: 23, miso: 19, sck: 18, ss: 5 },   // VSPI (default)
      { mosi: 13, miso: 12, sck: 14, ss: 15 },   // HSPI
    ],
  },
  STM32: {
    // STM32F103C8T6 "Blue Pill"
    timers: 4,
    pwmPins: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    analogPins: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], // PA0-PA7, PB0-PB1
    interruptPins: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    i2cPins: [
      { sda: 7, scl: 6 },  // I2C1 (PB7/PB6)
      { sda: 11, scl: 10 }, // I2C2 (PB11/PB10)
    ],
    spiPins: [
      { mosi: 7, miso: 6, sck: 5, ss: 4 },  // SPI1 (PA5-PA7, PA4)
      { mosi: 15, miso: 14, sck: 13, ss: 12 }, // SPI2 (PB13-PB15, PB12)
    ],
  },
  'Raspberry Pi Pico': {
    // RP2040
    timers: 8,
    pwmPins: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 25, 26, 27, 28],
    analogPins: [26, 27, 28], // ADC0-ADC2 (GP26-GP28)
    interruptPins: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 25, 26, 27, 28],
    i2cPins: [
      { sda: 4, scl: 5 },  // I2C0 default
      { sda: 6, scl: 7 },  // I2C1 default
    ],
    spiPins: [
      { mosi: 19, miso: 16, sck: 18, ss: 17 }, // SPI0 default
      { mosi: 15, miso: 12, sck: 14, ss: 13 }, // SPI1 default
    ],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Retrieve the capability record for the given board name.
 * Returns null if the board is not in our database.
 */
export function getBoardCapability(board: string): BoardCapability | null {
  return BOARD_CAPABILITIES[board] ?? null;
}

/**
 * Return the list of all supported board names.
 */
export function getSupportedBoards(): string[] {
  return Object.keys(BOARD_CAPABILITIES);
}

// ---------------------------------------------------------------------------
// Pin usage analysis
// ---------------------------------------------------------------------------

/**
 * Analyze a set of used pins against a board's capabilities and return
 * actionable suggestions (warnings, info, optimization hints).
 *
 * @param board - The board name (must exist in BOARD_CAPABILITIES).
 * @param usedPins - Array of GPIO pin numbers currently in use.
 * @returns Array of suggestions sorted by severity (warnings first).
 */
export function analyzePinUsage(board: string, usedPins: number[]): BoardSuggestion[] {
  const cap = BOARD_CAPABILITIES[board];
  if (!cap) {
    return [{ type: 'warning', message: `Unknown board "${board}". Cannot analyze pin usage.` }];
  }

  const suggestions: BoardSuggestion[] = [];
  const usedSet = new Set(usedPins);

  // 1. Check for pins used as digital that are also I2C bus pins
  for (const bus of cap.i2cPins) {
    if (usedSet.has(bus.sda)) {
      suggestions.push({
        type: 'warning',
        message: `Pin ${bus.sda} is an I2C SDA line. Using it for general I/O will disable I2C on this bus.`,
        pin: bus.sda,
      });
    }
    if (usedSet.has(bus.scl)) {
      suggestions.push({
        type: 'warning',
        message: `Pin ${bus.scl} is an I2C SCL line. Using it for general I/O will disable I2C on this bus.`,
        pin: bus.scl,
      });
    }
  }

  // 2. Check for pins used that are SPI bus pins
  for (const bus of cap.spiPins) {
    const spiPinList = [
      { pin: bus.mosi, label: 'SPI MOSI' },
      { pin: bus.miso, label: 'SPI MISO' },
      { pin: bus.sck, label: 'SPI SCK' },
      { pin: bus.ss, label: 'SPI SS' },
    ];
    for (const { pin, label } of spiPinList) {
      if (usedSet.has(pin)) {
        suggestions.push({
          type: 'info',
          message: `Pin ${pin} is the default ${label} line. Using it for other purposes will require SPI remapping.`,
          pin,
        });
      }
    }
  }

  // 3. Suggest PWM-capable alternatives for non-PWM pins
  for (const pin of usedPins) {
    if (!cap.pwmPins.includes(pin)) {
      const available = cap.pwmPins.find((p) => !usedSet.has(p));
      if (available !== undefined) {
        suggestions.push({
          type: 'optimization',
          message: `Pin ${pin} does not support hardware PWM. Consider using pin ${available} instead for PWM output.`,
          pin,
          alternative: available,
        });
      }
    }
  }

  // 4. High pin utilization warning
  const totalIoPins = new Set([
    ...cap.pwmPins,
    ...cap.analogPins,
    ...cap.interruptPins,
  ]).size;
  const usedCount = usedPins.length;
  if (totalIoPins > 0 && usedCount / totalIoPins > 0.8) {
    suggestions.push({
      type: 'warning',
      message: `High pin utilization: ${usedCount} of ~${totalIoPins} I/O pins in use (${Math.round((usedCount / totalIoPins) * 100)}%). Consider a board with more pins.`,
    });
  }

  // 5. Info about remaining analog pins
  const usedAnalog = cap.analogPins.filter((p) => usedSet.has(p)).length;
  const totalAnalog = cap.analogPins.length;
  if (usedAnalog > 0 && usedAnalog < totalAnalog) {
    suggestions.push({
      type: 'info',
      message: `${totalAnalog - usedAnalog} of ${totalAnalog} analog pins still available.`,
    });
  } else if (usedAnalog >= totalAnalog && totalAnalog > 0) {
    suggestions.push({
      type: 'warning',
      message: `All ${totalAnalog} analog pins are in use. No analog inputs remaining.`,
    });
  }

  // 6. Remaining interrupt pins
  const usedInterrupt = cap.interruptPins.filter((p) => usedSet.has(p)).length;
  const totalInterrupt = cap.interruptPins.length;
  if (usedInterrupt >= totalInterrupt && totalInterrupt > 0) {
    suggestions.push({
      type: 'warning',
      message: `All ${totalInterrupt} interrupt-capable pins are in use. No hardware interrupts remaining.`,
    });
  }

  // Sort: warnings first, then info, then optimization
  const order: Record<SuggestionType, number> = { warning: 0, info: 1, optimization: 2 };
  suggestions.sort((a, b) => order[a.type] - order[b.type]);

  return suggestions;
}

// ---------------------------------------------------------------------------
// Optimal pin suggestion
// ---------------------------------------------------------------------------

/**
 * Suggest optimal pin numbers for a given set of requirements.
 * Attempts to avoid conflicts by preferring dedicated-function pins first.
 *
 * @param board - The board name.
 * @param requirement - How many of each pin type are needed.
 * @returns Array of suggested pin numbers, or empty array if unsatisfiable.
 */
export function suggestOptimalPins(board: string, requirement: PinRequirement): number[] {
  const cap = BOARD_CAPABILITIES[board];
  if (!cap) {
    return [];
  }

  const allocated = new Set<number>();
  const result: number[] = [];

  // Helper: pick `count` pins from `candidates`, avoiding already-allocated
  const pick = (candidates: number[], count: number): number[] => {
    const picked: number[] = [];
    for (const pin of candidates) {
      if (picked.length >= count) {
        break;
      }
      if (!allocated.has(pin)) {
        picked.push(pin);
        allocated.add(pin);
      }
    }
    return picked;
  };

  // Allocate interrupt pins first (most constrained on most boards)
  if (requirement.interrupt && requirement.interrupt > 0) {
    const intPins = pick(cap.interruptPins, requirement.interrupt);
    result.push(...intPins);
  }

  // Allocate analog pins
  if (requirement.analog && requirement.analog > 0) {
    const anPins = pick(cap.analogPins, requirement.analog);
    result.push(...anPins);
  }

  // Allocate PWM pins
  if (requirement.pwm && requirement.pwm > 0) {
    const pwPins = pick(cap.pwmPins, requirement.pwm);
    result.push(...pwPins);
  }

  // Allocate generic digital pins — use PWM-capable pins last (preserve them)
  if (requirement.digital && requirement.digital > 0) {
    // Gather all known pins, prioritizing non-PWM pins
    const allPins = new Set([
      ...cap.pwmPins,
      ...cap.analogPins,
      ...cap.interruptPins,
    ]);
    const nonPwm = Array.from(allPins).filter((p) => !cap.pwmPins.includes(p));
    const pwmOnly = cap.pwmPins.filter((p) => !nonPwm.includes(p));
    const digitalCandidates = [...nonPwm, ...pwmOnly];
    const digPins = pick(digitalCandidates, requirement.digital);
    result.push(...digPins);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Timer conflict detection
// ---------------------------------------------------------------------------

/**
 * Check for timer conflicts between features on a given board.
 * Many Arduino libraries share hardware timers — e.g., Servo uses Timer1
 * on the Uno, which also drives PWM on pins 9 & 10.
 *
 * @param board - The board name.
 * @param features - Array of feature/library names (e.g., ['servo', 'tone', 'pwm']).
 * @returns Array of detected conflicts.
 */
export function checkTimerConflicts(board: string, features: string[]): TimerConflict[] {
  const featureTimers = BOARD_FEATURE_TIMERS[board];
  if (!featureTimers) {
    return [];
  }

  // Build a map: timer -> list of features that use it
  const timerUsers = new Map<number, string[]>();

  for (const feature of features) {
    const normalized = feature.toLowerCase();
    const timers = featureTimers[normalized];
    if (!timers) {
      continue;
    }
    for (const timer of timers) {
      const existing = timerUsers.get(timer) ?? [];
      existing.push(feature);
      timerUsers.set(timer, existing);
    }
  }

  // Find timers used by 2+ features
  const conflicts: TimerConflict[] = [];
  const entries = Array.from(timerUsers.entries());
  for (const [timer, users] of entries) {
    if (users.length >= 2) {
      // Deduplicate feature names (e.g., if 'pwm' appears twice)
      const unique = Array.from(new Set(users));
      if (unique.length >= 2) {
        const timerPins = BOARD_TIMER_PINS[board]?.[timer];
        const pinNote = timerPins ? ` (affects pins ${timerPins.join(', ')})` : '';
        conflicts.push({
          timer,
          features: unique,
          message: `Timer ${timer} is shared by ${unique.join(' and ')}${pinNote}. This may cause unexpected behavior.`,
        });
      }
    }
  }

  // Sort by timer number for deterministic output
  conflicts.sort((a, b) => a.timer - b.timer);

  return conflicts;
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export interface UseBoardSuggestionsReturn {
  /** Current board name. */
  board: string;
  /** Current suggestions based on the last analysis. */
  suggestions: BoardSuggestion[];
  /** Board capabilities (null if board is unknown). */
  capabilities: BoardCapability | null;
  /** Run pin usage analysis for the given pins. */
  analyze: (usedPins: number[]) => BoardSuggestion[];
  /** Suggest optimal pins for the given requirements. */
  suggest: (requirement: PinRequirement) => number[];
  /** Check timer conflicts for the given features. */
  conflicts: (features: string[]) => TimerConflict[];
}

/**
 * React hook that provides board-aware suggestion utilities.
 *
 * Memoizes the board capability lookup and provides stable callbacks
 * for analysis, suggestion, and conflict detection.
 *
 * @param board - The board name to analyze against.
 */
export function useBoardSuggestions(board: string): UseBoardSuggestionsReturn {
  const [suggestions, setSuggestions] = useState<BoardSuggestion[]>([]);
  const boardRef = useRef(board);
  boardRef.current = board;

  const capabilities = useMemo(() => getBoardCapability(board), [board]);

  const analyze = useCallback((usedPins: number[]): BoardSuggestion[] => {
    const result = analyzePinUsage(boardRef.current, usedPins);
    setSuggestions(result);
    return result;
  }, []);

  const suggest = useCallback((requirement: PinRequirement): number[] => {
    return suggestOptimalPins(boardRef.current, requirement);
  }, []);

  const conflictsFn = useCallback((features: string[]): TimerConflict[] => {
    return checkTimerConflicts(boardRef.current, features);
  }, []);

  return {
    board,
    suggestions,
    capabilities,
    analyze,
    suggest,
    conflicts: conflictsFn,
  };
}
