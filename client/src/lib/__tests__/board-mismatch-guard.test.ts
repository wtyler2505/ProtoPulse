import { describe, it, expect } from 'vitest';
import {
  checkBoardMismatch,
  detectConnectedBoard,
  extractArch,
  extractBoardId,
  extractVendor,
  formatMismatchWarning,
  getArchVoltage,
  KNOWN_INCOMPATIBILITIES,
} from '../board-mismatch-guard';
import type {
  BoardInfo,
  BoardMismatchResult,
  MismatchSeverity,
  PortInfo,
  UploadTarget,
} from '../board-mismatch-guard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBoardInfo(overrides: Partial<BoardInfo> = {}): BoardInfo {
  return {
    fqbn: overrides.fqbn ?? 'arduino:avr:uno',
    name: overrides.name ?? 'Arduino Uno',
    mcu: overrides.mcu ?? 'ATmega328P',
    flashSize: overrides.flashSize ?? 32768,
    ramSize: overrides.ramSize ?? 2048,
  };
}

function makeTarget(overrides: Partial<UploadTarget> = {}): UploadTarget {
  return {
    board: overrides.board ?? makeBoardInfo(),
    port: overrides.port,
  };
}

// ---------------------------------------------------------------------------
// extractArch
// ---------------------------------------------------------------------------

describe('extractArch', () => {
  it('extracts arch from a standard 3-part FQBN', () => {
    expect(extractArch('arduino:avr:uno')).toBe('avr');
  });

  it('extracts arch from ESP32 FQBN', () => {
    expect(extractArch('esp32:esp32:esp32')).toBe('esp32');
  });

  it('extracts arch from FQBN with options segment', () => {
    expect(extractArch('arduino:avr:mega:cpu=atmega2560')).toBe('avr');
  });

  it('returns empty string for single-segment string', () => {
    expect(extractArch('arduino')).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(extractArch('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// extractVendor
// ---------------------------------------------------------------------------

describe('extractVendor', () => {
  it('extracts vendor from standard FQBN', () => {
    expect(extractVendor('arduino:avr:uno')).toBe('arduino');
  });

  it('extracts vendor from ESP32 FQBN', () => {
    expect(extractVendor('esp32:esp32:esp32')).toBe('esp32');
  });

  it('returns the whole string when no colon present', () => {
    expect(extractVendor('arduino')).toBe('arduino');
  });

  it('returns empty string for empty input', () => {
    expect(extractVendor('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// extractBoardId
// ---------------------------------------------------------------------------

describe('extractBoardId', () => {
  it('extracts board identifier from standard FQBN', () => {
    expect(extractBoardId('arduino:avr:uno')).toBe('uno');
  });

  it('extracts board identifier from 4-part FQBN with options', () => {
    expect(extractBoardId('arduino:avr:mega:cpu=atmega2560')).toBe('mega');
  });

  it('returns empty string when FQBN has fewer than 3 segments', () => {
    expect(extractBoardId('arduino:avr')).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(extractBoardId('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// getArchVoltage
// ---------------------------------------------------------------------------

describe('getArchVoltage', () => {
  it('returns 5.0 for avr', () => {
    expect(getArchVoltage('avr')).toBe(5.0);
  });

  it('returns 3.3 for esp32', () => {
    expect(getArchVoltage('esp32')).toBe(3.3);
  });

  it('returns 3.3 for stm32', () => {
    expect(getArchVoltage('stm32')).toBe(3.3);
  });

  it('returns 3.3 for rp2040', () => {
    expect(getArchVoltage('rp2040')).toBe(3.3);
  });

  it('is case-insensitive', () => {
    expect(getArchVoltage('AVR')).toBe(5.0);
    expect(getArchVoltage('ESP32')).toBe(3.3);
  });

  it('returns undefined for unknown architecture', () => {
    expect(getArchVoltage('xtensa')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(getArchVoltage('')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// KNOWN_INCOMPATIBILITIES
// ---------------------------------------------------------------------------

describe('KNOWN_INCOMPATIBILITIES', () => {
  it('has at least 10 rules', () => {
    expect(KNOWN_INCOMPATIBILITIES.length).toBeGreaterThanOrEqual(10);
  });

  it('every rule has a non-empty id', () => {
    for (const rule of KNOWN_INCOMPATIBILITIES) {
      expect(rule.id).toBeTruthy();
    }
  });

  it('every rule has a non-empty description', () => {
    for (const rule of KNOWN_INCOMPATIBILITIES) {
      expect(rule.description.length).toBeGreaterThan(0);
    }
  });

  it('every rule has a non-empty suggestion', () => {
    for (const rule of KNOWN_INCOMPATIBILITIES) {
      expect(rule.suggestion.length).toBeGreaterThan(0);
    }
  });

  it('every rule has a valid severity', () => {
    const validSeverities: MismatchSeverity[] = ['block', 'warn', 'info'];
    for (const rule of KNOWN_INCOMPATIBILITIES) {
      expect(validSeverities).toContain(rule.severity);
    }
  });

  it('has unique rule IDs', () => {
    const ids = KNOWN_INCOMPATIBILITIES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('AVR→ESP32 rule matches and blocks', () => {
    const rule = KNOWN_INCOMPATIBILITIES.find((r) => r.id === 'avr-to-esp32');
    expect(rule).toBeDefined();
    expect(rule!.test('avr', 'esp32')).toBe(true);
    expect(rule!.severity).toBe('block');
  });

  it('AVR→ESP32 rule does not match reversed architectures', () => {
    const rule = KNOWN_INCOMPATIBILITIES.find((r) => r.id === 'avr-to-esp32');
    expect(rule!.test('esp32', 'avr')).toBe(false);
  });

  it('voltage mismatch rules are warn severity', () => {
    const voltageRules = KNOWN_INCOMPATIBILITIES.filter(
      (r) => r.id === '3v3-sketch-5v-board' || r.id === '5v-sketch-3v3-board',
    );
    expect(voltageRules.length).toBe(2);
    for (const rule of voltageRules) {
      expect(rule.severity).toBe('warn');
    }
  });

  it('3.3V→5V voltage rule triggers for esp32→avr', () => {
    const rule = KNOWN_INCOMPATIBILITIES.find((r) => r.id === '3v3-sketch-5v-board');
    expect(rule).toBeDefined();
    expect(rule!.test('esp32', 'avr')).toBe(true);
  });

  it('5V→3.3V voltage rule triggers for avr→esp32', () => {
    const rule = KNOWN_INCOMPATIBILITIES.find((r) => r.id === '5v-sketch-3v3-board');
    expect(rule).toBeDefined();
    expect(rule!.test('avr', 'esp32')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// detectConnectedBoard
// ---------------------------------------------------------------------------

describe('detectConnectedBoard', () => {
  it('detects Arduino Uno by vendor+product ID', () => {
    const result = detectConnectedBoard({ usbVendorId: 0x2341, usbProductId: 0x0043 });
    expect(result).not.toBeNull();
    expect(result!.fqbn).toBe('arduino:avr:uno');
    expect(result!.name).toContain('Uno');
  });

  it('detects Arduino Mega by vendor+product ID', () => {
    const result = detectConnectedBoard({ usbVendorId: 0x2341, usbProductId: 0x0042 });
    expect(result).not.toBeNull();
    expect(result!.fqbn).toBe('arduino:avr:mega');
  });

  it('detects ESP32 by vendor ID only', () => {
    const result = detectConnectedBoard({ usbVendorId: 0x303a });
    expect(result).not.toBeNull();
    expect(result!.fqbn).toContain('esp32');
  });

  it('detects Raspberry Pi Pico by vendor+product ID', () => {
    const result = detectConnectedBoard({ usbVendorId: 0x2e8a, usbProductId: 0x0005 });
    expect(result).not.toBeNull();
    expect(result!.fqbn).toContain('rp2040');
  });

  it('detects STM32 Blue Pill by vendor+product ID', () => {
    const result = detectConnectedBoard({ usbVendorId: 0x0483, usbProductId: 0x374b });
    expect(result).not.toBeNull();
    expect(result!.fqbn).toContain('stm32');
  });

  it('detects CH340-based Arduino Nano', () => {
    const result = detectConnectedBoard({ usbVendorId: 0x1a86, usbProductId: 0x7523 });
    expect(result).not.toBeNull();
    expect(result!.name).toContain('CH340');
  });

  it('detects Teensy 4.0', () => {
    const result = detectConnectedBoard({ usbVendorId: 0x16c0, usbProductId: 0x0483 });
    expect(result).not.toBeNull();
    expect(result!.name).toContain('Teensy');
  });

  it('returns null for unknown vendor ID', () => {
    const result = detectConnectedBoard({ usbVendorId: 0xffff, usbProductId: 0xffff });
    expect(result).toBeNull();
  });

  it('returns null when usbVendorId is undefined', () => {
    const result = detectConnectedBoard({});
    expect(result).toBeNull();
  });

  it('returns null when usbVendorId is undefined but productId is set', () => {
    const result = detectConnectedBoard({ usbProductId: 0x0043 } as PortInfo);
    expect(result).toBeNull();
  });

  it('returns a copy, not a reference to internal data', () => {
    const a = detectConnectedBoard({ usbVendorId: 0x2341, usbProductId: 0x0043 });
    const b = detectConnectedBoard({ usbVendorId: 0x2341, usbProductId: 0x0043 });
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('prefers exact vendor+product match over vendor-only match', () => {
    // 0x303a with no product → vendor-only ESP32
    // 0x303a with a specific product that's not in the DB → should still fall back to vendor-only
    const vendorOnly = detectConnectedBoard({ usbVendorId: 0x303a });
    const withUnknownProduct = detectConnectedBoard({ usbVendorId: 0x303a, usbProductId: 0x9999 });
    // Both should return ESP32 via vendor-only fallback
    expect(vendorOnly).not.toBeNull();
    expect(withUnknownProduct).not.toBeNull();
    expect(vendorOnly!.fqbn).toBe(withUnknownProduct!.fqbn);
  });
});

// ---------------------------------------------------------------------------
// checkBoardMismatch — no mismatch cases
// ---------------------------------------------------------------------------

describe('checkBoardMismatch — no mismatch', () => {
  it('returns clean result when no sketch or connected board provided', () => {
    const result = checkBoardMismatch(makeTarget());
    expect(result.blocked).toBe(false);
    expect(result.severity).toBe('info');
    expect(result.reason).toBeUndefined();
  });

  it('returns clean result when sketch matches target exactly', () => {
    const target = makeTarget({ board: makeBoardInfo({ fqbn: 'arduino:avr:uno' }) });
    const result = checkBoardMismatch(target, 'arduino:avr:uno');
    expect(result.blocked).toBe(false);
    expect(result.reason).toBeUndefined();
  });

  it('returns clean result when connected board matches target exactly', () => {
    const target = makeTarget({ board: makeBoardInfo({ fqbn: 'esp32:esp32:esp32' }) });
    const result = checkBoardMismatch(target, undefined, 'esp32:esp32:esp32');
    expect(result.blocked).toBe(false);
    expect(result.reason).toBeUndefined();
  });

  it('returns clean result when all three FQBNs match', () => {
    const fqbn = 'arduino:avr:mega';
    const target = makeTarget({ board: makeBoardInfo({ fqbn }) });
    const result = checkBoardMismatch(target, fqbn, fqbn);
    expect(result.blocked).toBe(false);
    expect(result.reason).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// checkBoardMismatch — blocked cases
// ---------------------------------------------------------------------------

describe('checkBoardMismatch — blocked', () => {
  it('blocks AVR sketch → ESP32 board', () => {
    const target = makeTarget({
      board: makeBoardInfo({ fqbn: 'esp32:esp32:esp32', name: 'ESP32 Dev Module' }),
    });
    const result = checkBoardMismatch(target, 'arduino:avr:uno');
    expect(result.blocked).toBe(true);
    expect(result.severity).toBe('block');
    expect(result.reason).toBeDefined();
    expect(result.suggestion).toBeDefined();
  });

  it('blocks ESP32 sketch → AVR board', () => {
    const target = makeTarget({ board: makeBoardInfo({ fqbn: 'arduino:avr:uno' }) });
    const result = checkBoardMismatch(target, 'esp32:esp32:esp32');
    expect(result.blocked).toBe(true);
    expect(result.severity).toBe('block');
  });

  it('blocks AVR sketch → STM32 board', () => {
    const target = makeTarget({
      board: makeBoardInfo({ fqbn: 'stm32duino:stm32:bluepill_f103c8' }),
    });
    const result = checkBoardMismatch(target, 'arduino:avr:uno');
    expect(result.blocked).toBe(true);
    expect(result.severity).toBe('block');
  });

  it('blocks AVR sketch → RP2040 board', () => {
    const target = makeTarget({
      board: makeBoardInfo({ fqbn: 'rp2040:rp2040:rpipico' }),
    });
    const result = checkBoardMismatch(target, 'arduino:avr:mega');
    expect(result.blocked).toBe(true);
    expect(result.severity).toBe('block');
  });

  it('blocks ESP8266 sketch → ESP32 board', () => {
    const target = makeTarget({
      board: makeBoardInfo({ fqbn: 'esp32:esp32:esp32' }),
    });
    const result = checkBoardMismatch(target, 'esp8266:esp8266:nodemcuv2');
    expect(result.blocked).toBe(true);
    expect(result.severity).toBe('block');
  });

  it('blocks ESP32 sketch → ESP8266 board', () => {
    const target = makeTarget({
      board: makeBoardInfo({ fqbn: 'esp8266:esp8266:nodemcuv2' }),
    });
    const result = checkBoardMismatch(target, 'esp32:esp32:esp32');
    expect(result.blocked).toBe(true);
    expect(result.severity).toBe('block');
  });

  it('blocks via connected board mismatch when target arch differs', () => {
    const target = makeTarget({
      board: makeBoardInfo({ fqbn: 'arduino:avr:uno' }),
    });
    const result = checkBoardMismatch(target, undefined, 'esp32:esp32:esp32');
    expect(result.blocked).toBe(true);
    expect(result.severity).toBe('block');
  });
});

// ---------------------------------------------------------------------------
// checkBoardMismatch — warn cases
// ---------------------------------------------------------------------------

describe('checkBoardMismatch — warn', () => {
  it('warns on SAM ↔ SAMD mismatch', () => {
    const target = makeTarget({
      board: makeBoardInfo({ fqbn: 'arduino:samd:arduino_zero_edbg' }),
    });
    const result = checkBoardMismatch(target, 'arduino:sam:arduino_due_x');
    expect(result.blocked).toBe(false);
    expect(result.severity).toBe('warn');
    expect(result.reason).toBeDefined();
  });

  it('warns on generic arch mismatch with no specific rule', () => {
    const target = makeTarget({
      board: makeBoardInfo({ fqbn: 'exotic:xyz:board1' }),
    });
    const result = checkBoardMismatch(target, 'other:abc:board2');
    expect(result.blocked).toBe(false);
    expect(result.severity).toBe('warn');
    expect(result.reason).toContain('abc');
    expect(result.reason).toContain('xyz');
  });
});

// ---------------------------------------------------------------------------
// checkBoardMismatch — info cases
// ---------------------------------------------------------------------------

describe('checkBoardMismatch — info', () => {
  it('returns info when sketch and target are same arch but different board variant', () => {
    const target = makeTarget({
      board: makeBoardInfo({ fqbn: 'arduino:avr:mega' }),
    });
    const result = checkBoardMismatch(target, 'arduino:avr:uno');
    expect(result.blocked).toBe(false);
    expect(result.severity).toBe('info');
    expect(result.reason).toBeDefined();
    expect(result.suggestion).toBeDefined();
  });

  it('returns info when connected board is same arch but different variant', () => {
    const target = makeTarget({
      board: makeBoardInfo({ fqbn: 'arduino:avr:mega' }),
    });
    const result = checkBoardMismatch(target, undefined, 'arduino:avr:nano');
    expect(result.blocked).toBe(false);
    expect(result.severity).toBe('info');
  });
});

// ---------------------------------------------------------------------------
// formatMismatchWarning
// ---------------------------------------------------------------------------

describe('formatMismatchWarning', () => {
  it('returns empty string when no reason is present', () => {
    const result: BoardMismatchResult = { blocked: false, severity: 'info' };
    expect(formatMismatchWarning(result)).toBe('');
  });

  it('formats a blocked result with BLOCKED label', () => {
    const result: BoardMismatchResult = {
      blocked: true,
      severity: 'block',
      reason: 'Incompatible arch.',
      suggestion: 'Recompile.',
    };
    const output = formatMismatchWarning(result);
    expect(output).toContain('[BLOCKED]');
    expect(output).toContain('Incompatible arch.');
    expect(output).toContain('Suggestion: Recompile.');
  });

  it('formats a warn result with WARNING label', () => {
    const result: BoardMismatchResult = {
      blocked: false,
      severity: 'warn',
      reason: 'Voltage mismatch.',
      suggestion: 'Add level shifters.',
    };
    const output = formatMismatchWarning(result);
    expect(output).toContain('[WARNING]');
    expect(output).toContain('Voltage mismatch.');
  });

  it('formats an info result with INFO label', () => {
    const result: BoardMismatchResult = {
      blocked: false,
      severity: 'info',
      reason: 'Different variant.',
    };
    const output = formatMismatchWarning(result);
    expect(output).toContain('[INFO]');
    expect(output).toContain('Different variant.');
  });

  it('omits suggestion line when suggestion is undefined', () => {
    const result: BoardMismatchResult = {
      blocked: false,
      severity: 'warn',
      reason: 'Something off.',
    };
    const output = formatMismatchWarning(result);
    expect(output).not.toContain('Suggestion:');
  });
});

// ---------------------------------------------------------------------------
// Integration-style: end-to-end scenario tests
// ---------------------------------------------------------------------------

describe('end-to-end scenarios', () => {
  it('OmniTrek Nexus: AVR sketch to ESP32 NodeMCU is blocked', () => {
    const esp32 = makeBoardInfo({ fqbn: 'esp32:esp32:esp32', name: 'ESP32 Dev Module', mcu: 'ESP32' });
    const target = makeTarget({ board: esp32, port: '/dev/ttyUSB0' });
    const result = checkBoardMismatch(target, 'arduino:avr:mega');
    expect(result.blocked).toBe(true);
    const warning = formatMismatchWarning(result);
    expect(warning.length).toBeGreaterThan(0);
  });

  it('same Uno sketch and Uno board passes clean', () => {
    const uno = makeBoardInfo({ fqbn: 'arduino:avr:uno', name: 'Arduino Uno' });
    const target = makeTarget({ board: uno });
    const result = checkBoardMismatch(target, 'arduino:avr:uno', 'arduino:avr:uno');
    expect(result.blocked).toBe(false);
    expect(formatMismatchWarning(result)).toBe('');
  });

  it('detect board from USB then check mismatch', () => {
    const detected = detectConnectedBoard({ usbVendorId: 0x2341, usbProductId: 0x0043 });
    expect(detected).not.toBeNull();

    const esp32 = makeBoardInfo({ fqbn: 'esp32:esp32:esp32', name: 'ESP32' });
    const target = makeTarget({ board: esp32 });
    const result = checkBoardMismatch(target, undefined, detected!.fqbn);
    expect(result.blocked).toBe(true);
  });

  it('Pico sketch to Pico board with matching USB detection passes', () => {
    const detected = detectConnectedBoard({ usbVendorId: 0x2e8a, usbProductId: 0x0005 });
    expect(detected).not.toBeNull();

    const pico = makeBoardInfo({ fqbn: 'rp2040:rp2040:rpipico', name: 'Raspberry Pi Pico' });
    const target = makeTarget({ board: pico });
    const result = checkBoardMismatch(target, 'rp2040:rp2040:rpipico', detected!.fqbn);
    expect(result.blocked).toBe(false);
    expect(result.reason).toBeUndefined();
  });
});
