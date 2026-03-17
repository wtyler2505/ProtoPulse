/**
 * Board Mismatch Guard
 *
 * Pre-upload safety check that detects architecture, voltage, and toolchain
 * incompatibilities between the sketch's intended board and the board actually
 * connected (or selected) for upload.  Prevents bricking, data corruption,
 * and wasted debug time for makers working across multiple boards.
 *
 * The guard is intentionally conservative — it blocks known-dangerous
 * combinations and warns on suspicious ones, but never blocks a perfectly
 * valid upload just because it can't confirm compatibility.
 *
 * Usage:
 *   const result = checkBoardMismatch(target, 'arduino:avr:uno', 'esp32:esp32:esp32');
 *   if (result.blocked) { showError(formatMismatchWarning(result)); }
 *
 * React usage:
 *   // Import and call checkBoardMismatch directly — it's a pure function.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BoardInfo {
  /** Fully Qualified Board Name (vendor:arch:board). */
  fqbn: string;
  /** Human-readable board name. */
  name: string;
  /** MCU identifier (e.g. "ATmega328P", "ESP32-S3"). */
  mcu: string;
  /** Program flash size in bytes. */
  flashSize: number;
  /** SRAM size in bytes. */
  ramSize: number;
}

export interface UploadTarget {
  /** The board the user has selected for upload. */
  board: BoardInfo;
  /** Optional serial port (e.g. "/dev/ttyUSB0", "COM3"). */
  port?: string;
}

export type MismatchSeverity = 'block' | 'warn' | 'info';

export interface BoardMismatchResult {
  /** Whether the upload should be blocked outright. */
  blocked: boolean;
  /** Human-readable explanation when there is a mismatch (undefined when clean). */
  reason?: string;
  /** Severity classification. */
  severity: MismatchSeverity;
  /** Actionable suggestion for the user (undefined when clean). */
  suggestion?: string;
}

// ---------------------------------------------------------------------------
// Architecture extraction
// ---------------------------------------------------------------------------

/**
 * Extract the architecture segment from an FQBN.
 * "arduino:avr:uno" → "avr", "esp32:esp32:esp32" → "esp32".
 */
export function extractArch(fqbn: string): string {
  const parts = fqbn.split(':');
  return parts.length >= 2 ? parts[1] : '';
}

/**
 * Extract the vendor segment from an FQBN.
 * "arduino:avr:uno" → "arduino", "esp32:esp32:esp32" → "esp32".
 */
export function extractVendor(fqbn: string): string {
  const parts = fqbn.split(':');
  return parts.length >= 1 ? parts[0] : '';
}

/**
 * Extract the board identifier segment from an FQBN.
 * "arduino:avr:uno" → "uno", "esp32:esp32:esp32s3" → "esp32s3".
 */
export function extractBoardId(fqbn: string): string {
  const parts = fqbn.split(':');
  return parts.length >= 3 ? parts[2] : '';
}

// ---------------------------------------------------------------------------
// Known voltage levels per architecture
// ---------------------------------------------------------------------------

const ARCH_VOLTAGE: Record<string, number> = {
  avr: 5.0,
  sam: 3.3,
  samd: 3.3,
  esp32: 3.3,
  esp8266: 3.3,
  stm32: 3.3,
  rp2040: 3.3,
  nrf52: 3.3,
};

/**
 * Get the typical I/O voltage for a given architecture.
 * Returns undefined when the architecture is not in our database.
 */
export function getArchVoltage(arch: string): number | undefined {
  return ARCH_VOLTAGE[arch.toLowerCase()];
}

// ---------------------------------------------------------------------------
// Known incompatibilities
// ---------------------------------------------------------------------------

export interface IncompatibilityRule {
  /** Short identifier for the rule. */
  id: string;
  /** Human description of why the combination is dangerous. */
  description: string;
  /** Predicate — returns true when the combination matches this rule. */
  test: (sketchArch: string, boardArch: string) => boolean;
  severity: MismatchSeverity;
  suggestion: string;
}

/**
 * Registry of known dangerous board pairings.
 *
 * Each rule tests the *sketch* architecture against the *target board*
 * architecture.  The sketch arch is the arch of the board the sketch was
 * written / compiled for; the board arch is the arch of the board that
 * is physically connected (or selected) for upload.
 */
export const KNOWN_INCOMPATIBILITIES: readonly IncompatibilityRule[] = [
  // Architecture family mismatches — always block
  {
    id: 'avr-to-esp32',
    description: 'AVR sketch uploaded to ESP32 board — incompatible instruction set and bootloader.',
    test: (s, b) => s === 'avr' && b === 'esp32',
    severity: 'block',
    suggestion: 'Recompile the sketch for the ESP32 toolchain (Xtensa or RISC-V).',
  },
  {
    id: 'esp32-to-avr',
    description: 'ESP32 sketch uploaded to AVR board — incompatible instruction set.',
    test: (s, b) => s === 'esp32' && b === 'avr',
    severity: 'block',
    suggestion: 'Recompile the sketch for the AVR toolchain.',
  },
  {
    id: 'avr-to-esp8266',
    description: 'AVR sketch uploaded to ESP8266 board — incompatible instruction set.',
    test: (s, b) => s === 'avr' && b === 'esp8266',
    severity: 'block',
    suggestion: 'Recompile the sketch for the ESP8266 (Xtensa LX106) toolchain.',
  },
  {
    id: 'esp8266-to-avr',
    description: 'ESP8266 sketch uploaded to AVR board — incompatible instruction set.',
    test: (s, b) => s === 'esp8266' && b === 'avr',
    severity: 'block',
    suggestion: 'Recompile the sketch for the AVR toolchain.',
  },
  {
    id: 'avr-to-stm32',
    description: 'AVR sketch uploaded to STM32 board — incompatible instruction set (8-bit AVR vs ARM Cortex-M).',
    test: (s, b) => s === 'avr' && b === 'stm32',
    severity: 'block',
    suggestion: 'Recompile the sketch for the STM32 (ARM Cortex-M) toolchain.',
  },
  {
    id: 'stm32-to-avr',
    description: 'STM32 sketch uploaded to AVR board — incompatible instruction set.',
    test: (s, b) => s === 'stm32' && b === 'avr',
    severity: 'block',
    suggestion: 'Recompile the sketch for the AVR toolchain.',
  },
  {
    id: 'avr-to-rp2040',
    description: 'AVR sketch uploaded to RP2040 board — incompatible instruction set (8-bit AVR vs ARM Cortex-M0+).',
    test: (s, b) => s === 'avr' && b === 'rp2040',
    severity: 'block',
    suggestion: 'Recompile the sketch for the RP2040 (ARM Cortex-M0+) toolchain.',
  },
  {
    id: 'rp2040-to-avr',
    description: 'RP2040 sketch uploaded to AVR board — incompatible instruction set.',
    test: (s, b) => s === 'rp2040' && b === 'avr',
    severity: 'block',
    suggestion: 'Recompile the sketch for the AVR toolchain.',
  },
  {
    id: 'esp32-to-stm32',
    description: 'ESP32 sketch uploaded to STM32 board — incompatible instruction set (Xtensa vs ARM Cortex-M).',
    test: (s, b) => s === 'esp32' && b === 'stm32',
    severity: 'block',
    suggestion: 'Recompile the sketch for the STM32 (ARM Cortex-M) toolchain.',
  },
  {
    id: 'stm32-to-esp32',
    description: 'STM32 sketch uploaded to ESP32 board — incompatible instruction set.',
    test: (s, b) => s === 'stm32' && b === 'esp32',
    severity: 'block',
    suggestion: 'Recompile the sketch for the ESP32 (Xtensa or RISC-V) toolchain.',
  },
  {
    id: 'esp32-to-rp2040',
    description: 'ESP32 sketch uploaded to RP2040 board — incompatible instruction set.',
    test: (s, b) => s === 'esp32' && b === 'rp2040',
    severity: 'block',
    suggestion: 'Recompile the sketch for the RP2040 (ARM Cortex-M0+) toolchain.',
  },
  {
    id: 'rp2040-to-esp32',
    description: 'RP2040 sketch uploaded to ESP32 board — incompatible instruction set.',
    test: (s, b) => s === 'rp2040' && b === 'esp32',
    severity: 'block',
    suggestion: 'Recompile the sketch for the ESP32 (Xtensa or RISC-V) toolchain.',
  },
  {
    id: 'esp8266-to-esp32',
    description: 'ESP8266 sketch uploaded to ESP32 board — different Xtensa core variant and SDK.',
    test: (s, b) => s === 'esp8266' && b === 'esp32',
    severity: 'block',
    suggestion: 'Recompile the sketch using the ESP32 board package (ESP-IDF / Arduino ESP32).',
  },
  {
    id: 'esp32-to-esp8266',
    description: 'ESP32 sketch uploaded to ESP8266 board — ESP32 binaries require the Xtensa LX7/LX6 core.',
    test: (s, b) => s === 'esp32' && b === 'esp8266',
    severity: 'block',
    suggestion: 'Recompile the sketch for the ESP8266 (Xtensa LX106) toolchain.',
  },

  // Voltage mismatches — warn (won't corrupt firmware, but can fry hardware)
  {
    id: '3v3-sketch-5v-board',
    description: '3.3V sketch design targeting a 5V board — GPIO voltage mismatch risk.',
    test: (s, b) => {
      const sv = getArchVoltage(s);
      const bv = getArchVoltage(b);
      return sv !== undefined && bv !== undefined && sv < bv;
    },
    severity: 'warn',
    suggestion: 'Verify that all connected peripherals and level shifters are rated for 5V I/O.',
  },
  {
    id: '5v-sketch-3v3-board',
    description: '5V sketch design targeting a 3.3V board — applying 5V signals to 3.3V GPIO can damage the MCU.',
    test: (s, b) => {
      const sv = getArchVoltage(s);
      const bv = getArchVoltage(b);
      return sv !== undefined && bv !== undefined && sv > bv;
    },
    severity: 'warn',
    suggestion: 'Add level shifters or ensure all signals are 3.3V-safe before connecting.',
  },

  // Same-arch but different sub-family — info
  {
    id: 'sam-to-samd',
    description: 'SAM sketch targeting SAMD board — similar ARM cores but different peripherals and bootloader.',
    test: (s, b) => (s === 'sam' && b === 'samd') || (s === 'samd' && b === 'sam'),
    severity: 'warn',
    suggestion: 'Recompile for the exact target platform (SAM vs SAMD use different register maps).',
  },
] as const;

// ---------------------------------------------------------------------------
// Known USB vendor IDs → board architecture mapping
// ---------------------------------------------------------------------------

interface UsbBoardMapping {
  vendorId: number;
  productId?: number;
  board: BoardInfo;
}

/**
 * Database of well-known USB vendor/product IDs and their associated boards.
 * Used by detectConnectedBoard() to identify a board from its serial port info.
 */
const USB_BOARD_DATABASE: readonly UsbBoardMapping[] = [
  {
    vendorId: 0x2341,
    productId: 0x0043,
    board: { fqbn: 'arduino:avr:uno', name: 'Arduino Uno', mcu: 'ATmega328P', flashSize: 32768, ramSize: 2048 },
  },
  {
    vendorId: 0x2341,
    productId: 0x0042,
    board: { fqbn: 'arduino:avr:mega', name: 'Arduino Mega 2560', mcu: 'ATmega2560', flashSize: 262144, ramSize: 8192 },
  },
  {
    vendorId: 0x2341,
    productId: 0x0001,
    board: { fqbn: 'arduino:avr:uno', name: 'Arduino Uno R3', mcu: 'ATmega328P', flashSize: 32768, ramSize: 2048 },
  },
  {
    vendorId: 0x2341,
    productId: 0x8036,
    board: {
      fqbn: 'arduino:avr:leonardo',
      name: 'Arduino Leonardo',
      mcu: 'ATmega32U4',
      flashSize: 32768,
      ramSize: 2560,
    },
  },
  {
    vendorId: 0x2341,
    productId: 0x8037,
    board: { fqbn: 'arduino:avr:micro', name: 'Arduino Micro', mcu: 'ATmega32U4', flashSize: 32768, ramSize: 2560 },
  },
  {
    vendorId: 0x2341,
    productId: 0x003d,
    board: {
      fqbn: 'arduino:sam:arduino_due_x',
      name: 'Arduino Due',
      mcu: 'ATSAM3X8E',
      flashSize: 524288,
      ramSize: 98304,
    },
  },
  {
    vendorId: 0x303a,
    board: { fqbn: 'esp32:esp32:esp32', name: 'ESP32 Dev Module', mcu: 'ESP32', flashSize: 4194304, ramSize: 520192 },
  },
  {
    vendorId: 0x10c4,
    productId: 0xea60,
    board: {
      fqbn: 'esp32:esp32:esp32',
      name: 'ESP32 (CP2102)',
      mcu: 'ESP32',
      flashSize: 4194304,
      ramSize: 520192,
    },
  },
  {
    vendorId: 0x2e8a,
    productId: 0x0005,
    board: {
      fqbn: 'rp2040:rp2040:rpipico',
      name: 'Raspberry Pi Pico',
      mcu: 'RP2040',
      flashSize: 2097152,
      ramSize: 264000,
    },
  },
  {
    vendorId: 0x16c0,
    productId: 0x0483,
    board: { fqbn: 'teensy:avr:teensy40', name: 'Teensy 4.0', mcu: 'IMXRT1062', flashSize: 2097152, ramSize: 1048576 },
  },
  {
    vendorId: 0x0483,
    productId: 0x374b,
    board: {
      fqbn: 'stm32duino:stm32:bluepill_f103c8',
      name: 'STM32 Blue Pill',
      mcu: 'STM32F103C8',
      flashSize: 131072,
      ramSize: 20480,
    },
  },
  {
    vendorId: 0x1a86,
    productId: 0x7523,
    board: { fqbn: 'arduino:avr:nano', name: 'Arduino Nano (CH340)', mcu: 'ATmega328P', flashSize: 32768, ramSize: 2048 },
  },
  {
    vendorId: 0x0403,
    productId: 0x6001,
    board: {
      fqbn: 'arduino:avr:uno',
      name: 'Arduino (FTDI)',
      mcu: 'ATmega328P',
      flashSize: 32768,
      ramSize: 2048,
    },
  },
];

// ---------------------------------------------------------------------------
// Port info type (mirrors SerialPortInfo from web-serial.ts without coupling)
// ---------------------------------------------------------------------------

export interface PortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

/**
 * Detect a connected board from its USB serial port info.
 *
 * Tries vendor+product match first, then falls back to vendor-only match.
 * Returns null when the port info doesn't match any known board.
 */
export function detectConnectedBoard(portInfo: PortInfo): BoardInfo | null {
  if (portInfo.usbVendorId === undefined) {
    return null;
  }

  // Exact vendor+product match first
  if (portInfo.usbProductId !== undefined) {
    const exact = USB_BOARD_DATABASE.find(
      (m) => m.vendorId === portInfo.usbVendorId && m.productId === portInfo.usbProductId,
    );
    if (exact) {
      return { ...exact.board };
    }
  }

  // Vendor-only fallback
  const vendorMatch = USB_BOARD_DATABASE.find(
    (m) => m.vendorId === portInfo.usbVendorId && m.productId === undefined,
  );
  if (vendorMatch) {
    return { ...vendorMatch.board };
  }

  return null;
}

/**
 * Check whether uploading to the given target is safe.
 *
 * @param target   The board & port selected for upload.
 * @param sketchBoard  FQBN the sketch was compiled for (optional).
 * @param connectedBoard  FQBN of the physically connected board (optional, e.g. from auto-detect).
 * @returns A result describing whether the upload should proceed.
 */
export function checkBoardMismatch(
  target: UploadTarget,
  sketchBoard?: string,
  connectedBoard?: string,
): BoardMismatchResult {
  const ok: BoardMismatchResult = { blocked: false, severity: 'info' };

  // Nothing to compare — cannot determine mismatch
  if (!sketchBoard && !connectedBoard) {
    return ok;
  }

  const targetArch = extractArch(target.board.fqbn);

  // ---------------------------------------------------------------------------
  // 1. Sketch board vs target board
  // ---------------------------------------------------------------------------
  if (sketchBoard) {
    const sketchArch = extractArch(sketchBoard);

    if (sketchArch && targetArch && sketchArch !== targetArch) {
      // Check against known incompatibility rules
      for (const rule of KNOWN_INCOMPATIBILITIES) {
        if (rule.test(sketchArch, targetArch)) {
          return {
            blocked: rule.severity === 'block',
            reason: rule.description,
            severity: rule.severity,
            suggestion: rule.suggestion,
          };
        }
      }

      // Generic arch mismatch — warn even if no specific rule matched
      return {
        blocked: false,
        reason: `Sketch was compiled for "${sketchArch}" but the target board uses "${targetArch}".`,
        severity: 'warn',
        suggestion: `Recompile the sketch for the ${target.board.name} (${targetArch}) toolchain.`,
      };
    }

    // Same arch but different specific board — info-level heads-up
    if (sketchBoard !== target.board.fqbn && sketchArch === targetArch) {
      const sketchBoardId = extractBoardId(sketchBoard);
      const targetBoardId = extractBoardId(target.board.fqbn);
      if (sketchBoardId !== targetBoardId) {
        return {
          blocked: false,
          reason: `Sketch targets "${sketchBoard}" but uploading to "${target.board.fqbn}" — same architecture but different board variant.`,
          severity: 'info',
          suggestion: 'Verify that pin mappings and peripheral registers are compatible.',
        };
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Connected board vs target board
  // ---------------------------------------------------------------------------
  if (connectedBoard) {
    const connectedArch = extractArch(connectedBoard);

    if (connectedArch && targetArch && connectedArch !== targetArch) {
      for (const rule of KNOWN_INCOMPATIBILITIES) {
        if (rule.test(targetArch, connectedArch)) {
          return {
            blocked: rule.severity === 'block',
            reason: `Target board architecture "${targetArch}" does not match the connected board architecture "${connectedArch}". ${rule.description}`,
            severity: rule.severity,
            suggestion: rule.suggestion,
          };
        }
      }

      return {
        blocked: false,
        reason: `Selected board uses "${targetArch}" but the connected device identifies as "${connectedArch}".`,
        severity: 'warn',
        suggestion: 'Verify the correct board is selected in the board picker.',
      };
    }

    // Same arch but different board FQBN
    if (connectedBoard !== target.board.fqbn && connectedArch === targetArch) {
      const connectedBoardId = extractBoardId(connectedBoard);
      const targetBoardId = extractBoardId(target.board.fqbn);
      if (connectedBoardId !== targetBoardId) {
        return {
          blocked: false,
          reason: `Selected board "${target.board.fqbn}" differs from detected board "${connectedBoard}" — same architecture but different variant.`,
          severity: 'info',
          suggestion: 'Double-check board selection to ensure correct pin mappings and fuse settings.',
        };
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Sketch board vs connected board (cross-check)
  // ---------------------------------------------------------------------------
  if (sketchBoard && connectedBoard) {
    const sketchArch = extractArch(sketchBoard);
    const connectedArch = extractArch(connectedBoard);

    if (sketchArch && connectedArch && sketchArch !== connectedArch) {
      for (const rule of KNOWN_INCOMPATIBILITIES) {
        if (rule.test(sketchArch, connectedArch)) {
          return {
            blocked: rule.severity === 'block',
            reason: `Sketch compiled for "${sketchArch}" but connected board is "${connectedArch}". ${rule.description}`,
            severity: rule.severity,
            suggestion: rule.suggestion,
          };
        }
      }
    }
  }

  return ok;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const SEVERITY_LABELS: Record<MismatchSeverity, string> = {
  block: 'BLOCKED',
  warn: 'WARNING',
  info: 'INFO',
};

/**
 * Format a BoardMismatchResult into a human-readable single-line warning string.
 * Returns an empty string when there is nothing to report.
 */
export function formatMismatchWarning(result: BoardMismatchResult): string {
  if (!result.reason) {
    return '';
  }

  const label = SEVERITY_LABELS[result.severity];
  const parts = [`[${label}] ${result.reason}`];
  if (result.suggestion) {
    parts.push(`Suggestion: ${result.suggestion}`);
  }
  return parts.join(' ');
}
