/**
 * RAM Usage Monitor
 *
 * Parses Arduino/embedded compiler output to extract SRAM and flash
 * usage, calculates utilization percentages, and classifies the result
 * as ok / warning / critical.  Includes a database of known board RAM
 * specs and a React hook for real-time monitoring during compilation.
 *
 * Usage:
 *   const usage = parseCompilerOutput(compilerStdout);
 *   console.log(formatRamUsage(usage)); // "1,024 / 2,048 bytes (50.0%) — OK"
 *
 * React hook:
 *   const { usage, update, reset } = useRamMonitor('Arduino Uno');
 */

import { useCallback, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RamLevel = 'ok' | 'warning' | 'critical';

export interface RamUsage {
  used: number;
  total: number;
  percentage: number;
  level: RamLevel;
}

export interface BoardRamSpec {
  board: string;
  sramBytes: number;
  flashBytes: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Warning when RAM usage exceeds this percentage. */
const WARNING_THRESHOLD = 75;

/** Critical when RAM usage exceeds this percentage. */
const CRITICAL_THRESHOLD = 90;

/**
 * Known board SRAM/flash specifications.
 *
 * Sources: official datasheets and Arduino/ESP-IDF documentation.
 * sramBytes = total SRAM available at runtime.
 * flashBytes = total program flash.
 */
export const KNOWN_BOARD_RAM: Record<string, BoardRamSpec> = {
  'Arduino Uno': { board: 'Arduino Uno', sramBytes: 2048, flashBytes: 32768 },
  'Arduino Nano': { board: 'Arduino Nano', sramBytes: 2048, flashBytes: 32768 },
  'Arduino Mega': { board: 'Arduino Mega', sramBytes: 8192, flashBytes: 262144 },
  'Arduino Leonardo': { board: 'Arduino Leonardo', sramBytes: 2560, flashBytes: 32768 },
  'Arduino Due': { board: 'Arduino Due', sramBytes: 98304, flashBytes: 524288 },
  'Arduino Micro': { board: 'Arduino Micro', sramBytes: 2560, flashBytes: 32768 },
  ESP32: { board: 'ESP32', sramBytes: 520192, flashBytes: 4194304 },
  'ESP32-S2': { board: 'ESP32-S2', sramBytes: 327680, flashBytes: 4194304 },
  'ESP32-S3': { board: 'ESP32-S3', sramBytes: 524288, flashBytes: 8388608 },
  'ESP32-C3': { board: 'ESP32-C3', sramBytes: 409600, flashBytes: 4194304 },
  ESP8266: { board: 'ESP8266', sramBytes: 81920, flashBytes: 4194304 },
  STM32: { board: 'STM32', sramBytes: 20480, flashBytes: 131072 },
  'STM32F4': { board: 'STM32F4', sramBytes: 196608, flashBytes: 1048576 },
  'Raspberry Pi Pico': { board: 'Raspberry Pi Pico', sramBytes: 264000, flashBytes: 2097152 },
  'Teensy 4.0': { board: 'Teensy 4.0', sramBytes: 1048576, flashBytes: 2097152 },
  'Teensy 4.1': { board: 'Teensy 4.1', sramBytes: 1048576, flashBytes: 8388608 },
  'Adafruit Feather M0': { board: 'Adafruit Feather M0', sramBytes: 32768, flashBytes: 262144 },
  'Arduino Nano 33 BLE': { board: 'Arduino Nano 33 BLE', sramBytes: 262144, flashBytes: 1048576 },
  'Arduino Nano Every': { board: 'Arduino Nano Every', sramBytes: 6144, flashBytes: 49152 },
  'ATtiny85': { board: 'ATtiny85', sramBytes: 512, flashBytes: 8192 },
};

// ---------------------------------------------------------------------------
// Regex patterns for compiler output
// ---------------------------------------------------------------------------

/**
 * Matches Arduino-style SRAM usage line:
 *   "Global variables use 1024 bytes (50%) of dynamic memory, leaving 1024 bytes for local variables."
 *
 * Captures: [used, percentage, total (via leaving)]
 */
const SRAM_LINE_REGEX =
  /Global variables use (\d[\d,]*)\s*bytes?\s*\((\d+)%\)\s*of dynamic memory,?\s*leaving (\d[\d,]*)\s*bytes?/i;

/**
 * Matches a simpler "X bytes of Y bytes" format:
 *   "Global variables use 512 bytes of 2048 bytes of dynamic memory"
 */
const SRAM_SIMPLE_REGEX =
  /Global variables use (\d[\d,]*)\s*bytes?\s*(?:of|out of)\s*(\d[\d,]*)\s*bytes?/i;

/**
 * Matches flash/program storage line:
 *   "Sketch uses 14848 bytes (46%) of program storage space."
 */
const FLASH_LINE_REGEX =
  /Sketch uses (\d[\d,]*)\s*bytes?\s*\((\d+)%\)\s*of program storage/i;

/**
 * Matches "Maximum is X bytes" — gives total.
 */
const MAX_BYTES_REGEX = /Maximum is (\d[\d,]*)\s*bytes?/i;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip commas from numeric strings and parse to integer. */
function parseIntStripped(raw: string): number {
  return parseInt(raw.replace(/,/g, ''), 10);
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Classify a utilization percentage into a RAM level.
 *
 * - `ok`:       0 -- 74 %
 * - `warning`:  75 -- 89 %
 * - `critical`: 90 -- 100 %
 */
export function getRamLevel(percentage: number): RamLevel {
  if (percentage >= CRITICAL_THRESHOLD) {
    return 'critical';
  }
  if (percentage >= WARNING_THRESHOLD) {
    return 'warning';
  }
  return 'ok';
}

/**
 * Parse the SRAM section of a compiler output string.
 *
 * Supports two common Arduino IDE output formats:
 *   1. "Global variables use X bytes (P%) of dynamic memory, leaving Y bytes…"
 *   2. "Global variables use X bytes of Y bytes…"
 *
 * An optional `boardTotal` overrides the parsed total (useful when the
 * compiler output omits percentage info).
 *
 * Returns `null` when no matching line is found.
 */
export function parseCompilerOutput(
  output: string,
  boardTotal?: number,
): RamUsage | null {
  if (!output || typeof output !== 'string') {
    return null;
  }

  // Try detailed format first
  const detailedMatch = SRAM_LINE_REGEX.exec(output);
  if (detailedMatch) {
    const used = parseIntStripped(detailedMatch[1]);
    const leaving = parseIntStripped(detailedMatch[3]);
    const total = boardTotal ?? used + leaving;
    const percentage = total > 0 ? Math.round((used / total) * 100) : 0;
    return { used, total, percentage, level: getRamLevel(percentage) };
  }

  // Try simple "X of Y" format
  const simpleMatch = SRAM_SIMPLE_REGEX.exec(output);
  if (simpleMatch) {
    const used = parseIntStripped(simpleMatch[1]);
    const total = boardTotal ?? parseIntStripped(simpleMatch[2]);
    const percentage = total > 0 ? Math.round((used / total) * 100) : 0;
    return { used, total, percentage, level: getRamLevel(percentage) };
  }

  return null;
}

/**
 * Parse the flash/program storage section of a compiler output string.
 *
 * Matches: "Sketch uses X bytes (P%) of program storage space. Maximum is Y bytes."
 *
 * Returns `null` when no matching line is found.
 */
export function parseFlashOutput(
  output: string,
  boardFlash?: number,
): RamUsage | null {
  if (!output || typeof output !== 'string') {
    return null;
  }

  const flashMatch = FLASH_LINE_REGEX.exec(output);
  if (!flashMatch) {
    return null;
  }

  const used = parseIntStripped(flashMatch[1]);
  let total = boardFlash ?? 0;

  // Try to find "Maximum is X bytes" for total
  if (!total) {
    const maxMatch = MAX_BYTES_REGEX.exec(output);
    if (maxMatch) {
      total = parseIntStripped(maxMatch[1]);
    }
  }

  // Fallback: derive from percentage if available
  if (!total) {
    const pct = parseInt(flashMatch[2], 10);
    if (pct > 0) {
      total = Math.round((used * 100) / pct);
    }
  }

  const percentage = total > 0 ? Math.round((used / total) * 100) : 0;
  return { used, total, percentage, level: getRamLevel(percentage) };
}

/**
 * Format a RamUsage struct into a human-readable string.
 *
 * Examples:
 *   "1,024 / 2,048 bytes (50%) — OK"
 *   "7,500 / 8,192 bytes (92%) — CRITICAL"
 */
export function formatRamUsage(usage: RamUsage): string {
  const usedStr = usage.used.toLocaleString('en-US');
  const totalStr = usage.total.toLocaleString('en-US');
  const label = usage.level.toUpperCase();
  return `${usedStr} / ${totalStr} bytes (${String(usage.percentage)}%) — ${label}`;
}

/**
 * Build a RamUsage from raw used/total values.
 * Convenience helper for programmatic (non-compiler-output) scenarios.
 */
export function buildRamUsage(used: number, total: number): RamUsage {
  const clamped = total > 0 ? Math.min(used, total) : 0;
  const percentage = total > 0 ? Math.round((clamped / total) * 100) : 0;
  return { used: clamped, total, percentage, level: getRamLevel(percentage) };
}

/**
 * Look up a board spec by name.
 * Case-insensitive partial match — "uno" matches "Arduino Uno".
 */
export function lookupBoard(query: string): BoardRamSpec | null {
  if (!query) {
    return null;
  }
  const lower = query.toLowerCase();

  // Exact match first
  for (const [key, spec] of Object.entries(KNOWN_BOARD_RAM)) {
    if (key.toLowerCase() === lower) {
      return spec;
    }
  }

  // Partial match
  for (const [key, spec] of Object.entries(KNOWN_BOARD_RAM)) {
    if (key.toLowerCase().includes(lower) || lower.includes(key.toLowerCase())) {
      return spec;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export interface UseRamMonitorResult {
  /** Current SRAM usage (null if no data yet). */
  usage: RamUsage | null;
  /** Current flash usage (null if no data yet). */
  flashUsage: RamUsage | null;
  /** Board spec being monitored (null if unknown board). */
  boardSpec: BoardRamSpec | null;
  /** Feed new compiler output to update both SRAM and flash usage. */
  update: (compilerOutput: string) => void;
  /** Clear all usage data. */
  reset: () => void;
}

/**
 * React hook for monitoring RAM usage during compilation.
 *
 * @param boardName - Optional board name to look up specs.
 *                    Enables total-byte override when the compiler output
 *                    doesn't include enough information.
 */
export function useRamMonitor(boardName?: string): UseRamMonitorResult {
  const boardSpec = boardName ? lookupBoard(boardName) : null;
  const [usage, setUsage] = useState<RamUsage | null>(null);
  const [flashUsage, setFlashUsage] = useState<RamUsage | null>(null);

  const update = useCallback(
    (compilerOutput: string) => {
      const sram = parseCompilerOutput(compilerOutput, boardSpec?.sramBytes);
      if (sram) {
        setUsage(sram);
      }
      const flash = parseFlashOutput(compilerOutput, boardSpec?.flashBytes);
      if (flash) {
        setFlashUsage(flash);
      }
    },
    [boardSpec],
  );

  const reset = useCallback(() => {
    setUsage(null);
    setFlashUsage(null);
  }, []);

  return { usage, flashUsage, boardSpec, update, reset };
}
