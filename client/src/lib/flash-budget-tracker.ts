/**
 * FlashBudgetTracker — Section-aware flash memory budget analyzer for
 * microcontroller firmware builds.
 *
 * Parses compiler/linker output (avr-gcc, arm-none-eabi-gcc, xtensa-gcc)
 * to break flash usage down into individual memory sections (text, data,
 * bss, bootloader), computes budget levels, and provides human-readable
 * summaries.
 *
 * Complements `arduino/memory-usage-parser.ts` which tracks aggregate
 * flash/RAM usage over time — this module focuses on per-section
 * analysis, budget thresholds, and board-specific known flash sizes.
 *
 * Usage:
 *   const budget = parseFlashUsage(compilerOutput, 'arduino:avr:uno');
 *   const sections = getFlashSections(compilerOutput);
 *   const formatted = formatFlashBudget(budget);
 */

import { useState, useCallback, useMemo } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Budget threshold level indicating how close to capacity. */
export type BudgetLevel = 'ok' | 'warning' | 'critical' | 'exceeded';

/** Section types that a linker may report. */
export type SectionName = 'text' | 'data' | 'bss' | 'bootloader';

/** A single memory section from linker output. */
export interface FlashSection {
  name: SectionName;
  bytes: number;
}

/** Overall flash budget summary. */
export interface FlashBudget {
  used: number;
  total: number;
  percentage: number;
  level: BudgetLevel;
}

// ---------------------------------------------------------------------------
// Known flash sizes (after bootloader reservation, in bytes)
// ---------------------------------------------------------------------------

/**
 * Map of board FQBN / short names to their flash sizes in bytes.
 *
 * For AVR boards, this is the usable flash *after* the bootloader
 * (e.g., Uno: 32 KB total - 512 B bootloader = 32256 B available for sketch).
 * For ESP boards, the full flash partition is listed (since the bootloader
 * lives in a separate partition and the compiler reports sketch space).
 */
export const KNOWN_FLASH_SIZES: Record<string, number> = {
  // AVR boards (post-bootloader)
  'arduino:avr:uno': 32256,
  'arduino:avr:mega': 253952,
  'arduino:avr:nano': 30720,
  'arduino:avr:leonardo': 28672,
  'arduino:avr:micro': 28672,
  'arduino:avr:mini': 30720,
  'arduino:avr:pro': 30720,

  // ESP32 family
  'esp32:esp32:esp32': 1310720,
  'esp32:esp32:esp32s2': 1310720,
  'esp32:esp32:esp32s3': 1310720,
  'esp32:esp32:esp32c3': 1310720,

  // ESP8266
  'esp8266:esp8266:nodemcuv2': 1044464,
  'esp8266:esp8266:generic': 1044464,

  // ARM-based Arduino boards
  'arduino:samd:mkrzero': 262144,
  'arduino:samd:nano_33_iot': 262144,
  'arduino:mbed_nano:nano33ble': 983040,
  'arduino:mbed_nano:nanorp2040connect': 2097152,

  // Raspberry Pi Pico
  'rp2040:rp2040:rpipico': 2097152,

  // STM32 (common Blue Pill)
  'stm32:stm32:bluepill_f103c8': 65536,
  'stm32:stm32:blackpill_f411ce': 524288,

  // Teensy
  'teensy:avr:teensy40': 2031616,
  'teensy:avr:teensy41': 8126464,
  'teensy:avr:teensylc': 63488,

  // Short aliases (for fuzzy matching / convenience)
  uno: 32256,
  mega: 253952,
  nano: 30720,
  leonardo: 28672,
  esp32: 1310720,
  esp8266: 1044464,
  pico: 2097152,
  teensy40: 2031616,
  teensy41: 8126464,
  bluepill: 65536,
};

// ---------------------------------------------------------------------------
// Regex patterns for section-level linker output
// ---------------------------------------------------------------------------

/**
 * avr-size / arm-none-eabi-size "Berkeley" format:
 *   text    data     bss     dec     hex filename
 *  12345     456     789   13590    3516 sketch.ino.elf
 */
const BERKELEY_SIZE_RE =
  /^\s*(\d+)\s+(\d+)\s+(\d+)\s+\d+\s+[\da-fA-F]+\s+\S+/m;

/**
 * GCC .text section from verbose map output:
 *   .text   0x00000000    0x3039
 */
const MAP_TEXT_RE = /\.text\s+0x[\da-fA-F]+\s+0x([\da-fA-F]+)/;

/**
 * GCC .data section from verbose map output:
 *   .data   0x00800100    0x01c8
 */
const MAP_DATA_RE = /\.data\s+0x[\da-fA-F]+\s+0x([\da-fA-F]+)/;

/**
 * GCC .bss section from verbose map output:
 *   .bss    0x008002c8    0x0315
 */
const MAP_BSS_RE = /\.bss\s+0x[\da-fA-F]+\s+0x([\da-fA-F]+)/;

/**
 * Arduino-cli sketch usage line (same pattern as memory-usage-parser):
 *   "Sketch uses 12345 bytes (48%) of program storage space. Maximum is 32256 bytes."
 */
const SKETCH_USAGE_RE =
  /Sketch uses (\d+) bytes \((\d+)%\) of program storage space\.\s*Maximum is (\d+) bytes\./;

/**
 * PlatformIO flash line:
 *   "FLASH: [====      ]  48.2% (used 12345 bytes from 32256 bytes)"
 */
const PIO_FLASH_RE =
  /FLASH:\s*\[[\s=]*\]\s*[\d.]+%\s*\(used (\d+) bytes from (\d+) bytes\)/i;

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Classify a usage percentage into a budget level.
 *
 * Thresholds:
 *   - ok:       < 75%
 *   - warning:  75% -- 90% (inclusive)
 *   - critical: 90% -- 100% (inclusive)
 *   - exceeded: > 100%
 */
export function getBudgetLevel(percentage: number): BudgetLevel {
  if (percentage > 100) {
    return 'exceeded';
  }
  if (percentage > 90) {
    return 'critical';
  }
  if (percentage >= 75) {
    return 'warning';
  }
  return 'ok';
}

/**
 * Extract per-section flash usage from compiler/linker output.
 *
 * Looks for two output formats:
 *   1. Berkeley size output (text / data / bss columns)
 *   2. GCC linker map hex sizes (.text / .data / .bss)
 *
 * Returns an empty array if no section data can be found.
 */
export function getFlashSections(output: string): FlashSection[] {
  const sections: FlashSection[] = [];

  // Try Berkeley format first (most common)
  const berkeley = BERKELEY_SIZE_RE.exec(output);
  if (berkeley) {
    const textBytes = parseInt(berkeley[1], 10);
    const dataBytes = parseInt(berkeley[2], 10);
    const bssBytes = parseInt(berkeley[3], 10);

    if (textBytes > 0) {
      sections.push({ name: 'text', bytes: textBytes });
    }
    if (dataBytes > 0) {
      sections.push({ name: 'data', bytes: dataBytes });
    }
    if (bssBytes > 0) {
      sections.push({ name: 'bss', bytes: bssBytes });
    }
    return sections;
  }

  // Fall back to GCC map output
  const textMatch = MAP_TEXT_RE.exec(output);
  if (textMatch) {
    const bytes = parseInt(textMatch[1], 16);
    if (bytes > 0) {
      sections.push({ name: 'text', bytes });
    }
  }

  const dataMatch = MAP_DATA_RE.exec(output);
  if (dataMatch) {
    const bytes = parseInt(dataMatch[1], 16);
    if (bytes > 0) {
      sections.push({ name: 'data', bytes });
    }
  }

  const bssMatch = MAP_BSS_RE.exec(output);
  if (bssMatch) {
    const bytes = parseInt(bssMatch[1], 16);
    if (bytes > 0) {
      sections.push({ name: 'bss', bytes });
    }
  }

  return sections;
}

/**
 * Resolve the total flash size for a given board identifier.
 *
 * Accepts either a full FQBN (`arduino:avr:uno`) or a short alias
 * (`uno`). Falls back to extracting the total from the compiler
 * output if the board is not in KNOWN_FLASH_SIZES. Returns 0 if
 * flash size cannot be determined.
 */
export function resolveFlashTotal(
  compilerOutput: string,
  board?: string,
): number {
  // Try exact FQBN match
  if (board && KNOWN_FLASH_SIZES[board] !== undefined) {
    return KNOWN_FLASH_SIZES[board];
  }

  // Try short alias match (case-insensitive)
  if (board) {
    const lower = board.toLowerCase();
    for (const [key, size] of Object.entries(KNOWN_FLASH_SIZES)) {
      if (key.toLowerCase() === lower) {
        return size;
      }
      // Match the last segment of an FQBN (e.g., "uno" matches "arduino:avr:uno")
      const segments = key.split(':');
      if (segments.length > 1 && segments[segments.length - 1].toLowerCase() === lower) {
        return size;
      }
    }
  }

  // Fall back to compiler output
  const sketchMatch = SKETCH_USAGE_RE.exec(compilerOutput);
  if (sketchMatch) {
    return parseInt(sketchMatch[3], 10);
  }

  const pioMatch = PIO_FLASH_RE.exec(compilerOutput);
  if (pioMatch) {
    return parseInt(pioMatch[2], 10);
  }

  return 0;
}

/**
 * Parse compiler output into a full FlashBudget.
 *
 * The `board` parameter is optional — when provided, the total flash
 * is looked up from KNOWN_FLASH_SIZES. Otherwise, the total is
 * extracted from the compiler output itself.
 *
 * Returns null if neither used bytes nor total flash can be determined.
 */
export function parseFlashUsage(
  compilerOutput: string,
  board?: string,
): FlashBudget | null {
  const total = resolveFlashTotal(compilerOutput, board);

  // Determine used bytes — try structured output first
  let used = 0;

  // Direct "Sketch uses X bytes" line
  const sketchMatch = SKETCH_USAGE_RE.exec(compilerOutput);
  if (sketchMatch) {
    used = parseInt(sketchMatch[1], 10);
  }

  // PlatformIO flash line
  if (used === 0) {
    const pioMatch = PIO_FLASH_RE.exec(compilerOutput);
    if (pioMatch) {
      used = parseInt(pioMatch[1], 10);
    }
  }

  // Berkeley size — text + data = flash usage (bss is RAM-only)
  if (used === 0) {
    const berkeley = BERKELEY_SIZE_RE.exec(compilerOutput);
    if (berkeley) {
      const textBytes = parseInt(berkeley[1], 10);
      const dataBytes = parseInt(berkeley[2], 10);
      used = textBytes + dataBytes;
    }
  }

  // GCC map sections — text + data for flash
  if (used === 0) {
    const textMatch = MAP_TEXT_RE.exec(compilerOutput);
    const dataMatch = MAP_DATA_RE.exec(compilerOutput);
    if (textMatch) {
      used += parseInt(textMatch[1], 16);
    }
    if (dataMatch) {
      used += parseInt(dataMatch[1], 16);
    }
  }

  // Cannot determine anything meaningful
  if (used === 0 && total === 0) {
    return null;
  }

  // If we have used bytes but no total, we can still report usage
  // with percentage 0 (unknown capacity)
  if (total === 0) {
    return {
      used,
      total: 0,
      percentage: 0,
      level: 'ok',
    };
  }

  const percentage = Math.round((used / total) * 10000) / 100; // 2 decimal places
  const level = getBudgetLevel(percentage);

  return { used, total, percentage, level };
}

/**
 * Format a byte count into a human-readable string.
 *
 * Examples:
 *   0       -> "0 B"
 *   512     -> "512 B"
 *   1024    -> "1.00 KB"
 *   1048576 -> "1.00 MB"
 */
function formatBytes(bytes: number): string {
  if (bytes < 0) {
    return `-${formatBytes(-bytes)}`;
  }
  if (bytes === 0) {
    return '0 B';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Format a FlashBudget into a human-readable summary string.
 *
 * Examples:
 *   "12.50 KB / 31.50 KB (39.68%) [OK]"
 *   "240.00 KB / 248.00 KB (96.77%) [CRITICAL]"
 *   "12.50 KB / unknown [OK]"
 */
export function formatFlashBudget(budget: FlashBudget): string {
  const usedStr = formatBytes(budget.used);
  const levelStr = budget.level.toUpperCase();

  if (budget.total === 0) {
    return `${usedStr} / unknown [${levelStr}]`;
  }

  const totalStr = formatBytes(budget.total);
  const pctStr = budget.percentage.toFixed(2);

  return `${usedStr} / ${totalStr} (${pctStr}%) [${levelStr}]`;
}

/**
 * Format a FlashSection array into a human-readable breakdown.
 *
 * Example:
 *   "text: 12.00 KB, data: 456 B, bss: 789 B"
 */
export function formatFlashSections(sections: FlashSection[]): string {
  if (sections.length === 0) {
    return 'no section data';
  }
  return sections
    .map((s) => `${s.name}: ${formatBytes(s.bytes)}`)
    .join(', ');
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * React hook for tracking flash memory budget from compiler output.
 *
 * Maintains the most recent parse result and provides functions to
 * update from new compiler output.
 */
export function useFlashBudget(): {
  budget: FlashBudget | null;
  sections: FlashSection[];
  formatted: string;
  update: (compilerOutput: string, board?: string) => FlashBudget | null;
  clear: () => void;
} {
  const [budget, setBudget] = useState<FlashBudget | null>(null);
  const [sections, setSections] = useState<FlashSection[]>([]);

  const update = useCallback(
    (compilerOutput: string, board?: string): FlashBudget | null => {
      const newBudget = parseFlashUsage(compilerOutput, board);
      const newSections = getFlashSections(compilerOutput);
      setBudget(newBudget);
      setSections(newSections);
      return newBudget;
    },
    [],
  );

  const clear = useCallback(() => {
    setBudget(null);
    setSections([]);
  }, []);

  const formatted = useMemo(() => {
    if (!budget) {
      return 'No flash data';
    }
    return formatFlashBudget(budget);
  }, [budget]);

  return { budget, sections, formatted, update, clear };
}
