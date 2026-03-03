/**
 * Firmware board template registry — barrel + utility functions.
 *
 * Provides lookup, detection, and filtering utilities for board templates.
 * Used by the firmware scaffold generator to produce board-specific code.
 */

import type { BoardTemplate, BusDefinition, PinCapability, PinDefinition } from './types';
import { arduinoMegaTemplate } from './arduino-mega';
import { arduinoUnoTemplate } from './arduino-uno';
import { esp32DevkitTemplate } from './esp32';
import { stm32BluepillTemplate } from './stm32-bluepill';

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** All registered board templates, ordered by popularity. */
const ALL_BOARDS: readonly BoardTemplate[] = [
  esp32DevkitTemplate,
  arduinoUnoTemplate,
  arduinoMegaTemplate,
  stm32BluepillTemplate,
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Return every registered board template. */
export function getAllBoards(): BoardTemplate[] {
  return [...ALL_BOARDS];
}

/** Find a board by exact `boardId`. */
export function getBoardById(id: string): BoardTemplate | undefined {
  return ALL_BOARDS.find((b) => b.boardId === id);
}

/**
 * Fuzzy-detect a board from a free-form name string.
 *
 * Matches case-insensitively against `boardId`, `displayName`, and `mcu`.
 * Also handles common shorthand like "esp32", "mega", "uno", "bluepill",
 * "stm32", "328p", etc.
 */
export function detectBoard(name: string): BoardTemplate | undefined {
  const lower = name.toLowerCase().trim();
  if (lower === '') {
    return undefined;
  }

  // 1. Exact boardId match
  const byId = ALL_BOARDS.find((b) => b.boardId === lower);
  if (byId) {
    return byId;
  }

  // 2. Shorthand / keyword matching (checked before substring matching to avoid
  //    false positives like "mega" matching "atmega328p" in the Uno's MCU)
  if (/\besp32\b/.test(lower) || /\besp-32\b/.test(lower) || /\bwroom\b/.test(lower)) {
    return esp32DevkitTemplate;
  }
  if (/\bmega\b/.test(lower) || /\b2560\b/.test(lower) || /\batmega2560\b/.test(lower)) {
    return arduinoMegaTemplate;
  }
  if (/\buno\b/.test(lower) || /\b328p?\b/.test(lower) || /\batmega328\b/.test(lower)) {
    return arduinoUnoTemplate;
  }
  if (/\bbluepill\b/.test(lower) || /\bblue.pill\b/.test(lower) || /\bf103\b/.test(lower) || /\bstm32\b/.test(lower)) {
    return stm32BluepillTemplate;
  }

  // 3. Substring matching against boardId, displayName, and mcu (case-insensitive)
  for (const board of ALL_BOARDS) {
    const targets = [board.boardId, board.displayName.toLowerCase(), board.mcu.toLowerCase()];
    if (targets.some((t) => t.includes(lower) || lower.includes(t))) {
      return board;
    }
  }

  return undefined;
}

/** Return all pins on a board that have the given capability. */
export function getPinsByCapability(board: BoardTemplate, capability: PinCapability): PinDefinition[] {
  return board.pins.filter((p) => p.capabilities.includes(capability));
}

/** Return all buses on a board matching the given protocol type. */
export function getBusesByType(board: BoardTemplate, type: 'i2c' | 'spi' | 'uart'): BusDefinition[] {
  return board.buses.filter((b) => b.type === type);
}

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export type { BoardTemplate, BusDefinition, PinCapability, PinDefinition } from './types';
