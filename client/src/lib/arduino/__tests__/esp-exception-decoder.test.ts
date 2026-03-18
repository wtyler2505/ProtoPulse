import { describe, it, expect } from 'vitest';
import {
  detectEspException,
  parseEspException,
} from '../esp-exception-decoder';
import type { EspExceptionResult } from '../esp-exception-decoder';

// ---------------------------------------------------------------------------
// Sample crash outputs
// ---------------------------------------------------------------------------

const GURU_LOAD_PROHIBITED = `
Guru Meditation Error: Core  0 panic'ed (LoadProhibited). Exception was unhandled.

Core  0 register dump:
PC      : 0x400d1234  PS      : 0x00060030  A0      : 0x800d5678  A1      : 0x3ffb1234
A2      : 0x00000000  A3      : 0x3ffb5678  A4      : 0x00000001  A5      : 0x00000000

Backtrace: 0x400d1234:0x3ffb1234 0x400d5678:0x3ffb5678 0x400d9abc:0x3ffbdef0
`;

const GURU_STORE_PROHIBITED = `
Guru Meditation Error: Core  1 panic'ed (StoreProhibited). Exception was unhandled.
Backtrace: 0x400d1111:0x3ffb2222
`;

const GURU_INT_DIVIDE_ZERO = `
Guru Meditation Error: Core  0 panic'ed (IntegerDivideByZero). Exception was unhandled.
Backtrace: 0x400dAAAA:0x3ffbBBBB 0x400dCCCC:0x3ffbDDDD
`;

const GURU_INSTR_FETCH = `
Guru Meditation Error: Core  0 panic'ed (InstrFetchProhibited). Exception was unhandled.
Backtrace: 0x400d0000:0x3ffb0000
`;

const STACK_OVERFLOW = `
***ERROR*** A stack overflow in task "loopTask" has been detected.
Backtrace: 0x40081234:0x3ffb5678 0x40082222:0x3ffb3333
`;

const WDT_RESET = `
rst:0x01 (POWERON_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)
ets Jun  8 2016 00:22:57
Guru Meditation Error: Core  0 panic'ed (LoadProhibited). Exception was unhandled.
Backtrace: 0x400d1234:0x3ffb1234
`;

const ABORT_CALLED = `
abort() was called at PC 0x400d1234 on core 0
Backtrace: 0x40081111:0x3ffb2222 0x40082222:0x3ffb3333
`;

const STACK_SMASHING = `
Stack smashing protect failure!
Backtrace: 0x400d5555:0x3ffb6666
`;

const RST_CODE_ONLY = `rst:0x0f (SPI_FAST_FLASH_BOOT)`;

const NO_CRASH = `
Hello from ESP32!
Temperature: 25.3C
Humidity: 45%
`;

const BACKTRACE_NO_SP = `
Guru Meditation Error: Core  0 panic'ed (LoadProhibited). Exception was unhandled.
Backtrace: 0x400d1234 0x400d5678
`;

const DEBUG_EXCEPTION = `
Guru Meditation Error: Core  0 panic'ed (Unhandled debug exception). Exception was unhandled.
Backtrace: 0x400dAAAA:0x3ffbBBBB
`;

const WDT_STANDALONE = `
E (12345) task_wdt: Task watchdog got triggered. The following tasks did not reset the watchdog in time:
wdt reset
`;

// ---------------------------------------------------------------------------
// detectEspException
// ---------------------------------------------------------------------------

describe('detectEspException', () => {
  it('detects Guru Meditation Error', () => {
    expect(detectEspException(GURU_LOAD_PROHIBITED)).toBe(true);
  });

  it('detects Backtrace line', () => {
    expect(detectEspException('Backtrace: 0x400d1234:0x3ffb5678')).toBe(true);
  });

  it('detects rst:0x reset code', () => {
    expect(detectEspException(RST_CODE_ONLY)).toBe(true);
  });

  it('detects panic keyword', () => {
    expect(detectEspException("Core 0 panic'ed (test)")).toBe(true);
  });

  it('detects Stack smashing', () => {
    expect(detectEspException(STACK_SMASHING)).toBe(true);
  });

  it('detects abort()', () => {
    expect(detectEspException(ABORT_CALLED)).toBe(true);
  });

  it('detects stack overflow', () => {
    expect(detectEspException(STACK_OVERFLOW)).toBe(true);
  });

  it('returns false for normal output', () => {
    expect(detectEspException(NO_CRASH)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(detectEspException('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseEspException — crash type detection
// ---------------------------------------------------------------------------

describe('parseEspException — crash types', () => {
  it('parses LoadProhibited', () => {
    const result = parseEspException(GURU_LOAD_PROHIBITED);
    expect(result.decoded).toBe(true);
    expect(result.crashType).toBe('LoadProhibited');
    expect(result.description).toContain('Null pointer');
  });

  it('parses StoreProhibited', () => {
    const result = parseEspException(GURU_STORE_PROHIBITED);
    expect(result.decoded).toBe(true);
    expect(result.crashType).toBe('StoreProhibited');
    expect(result.description).toContain('invalid memory');
  });

  it('parses IntegerDivideByZero', () => {
    const result = parseEspException(GURU_INT_DIVIDE_ZERO);
    expect(result.decoded).toBe(true);
    expect(result.crashType).toBe('IntegerDivideByZero');
    expect(result.description).toContain('Division by zero');
  });

  it('parses InstrFetchProhibited', () => {
    const result = parseEspException(GURU_INSTR_FETCH);
    expect(result.decoded).toBe(true);
    expect(result.crashType).toBe('InstrFetchProhibited');
    expect(result.description).toContain('invalid memory');
  });

  it('parses Unhandled debug exception', () => {
    const result = parseEspException(DEBUG_EXCEPTION);
    expect(result.decoded).toBe(true);
    expect(result.crashType).toBe('Unhandled debug exception');
    expect(result.description).toContain('Breakpoint');
  });

  it('parses Stack overflow', () => {
    const result = parseEspException(STACK_OVERFLOW);
    expect(result.decoded).toBe(true);
    expect(result.crashType).toBe('Stack overflow');
    expect(result.description).toContain('call depth too deep');
  });

  it('parses abort()', () => {
    const result = parseEspException(ABORT_CALLED);
    expect(result.decoded).toBe(true);
    expect(result.crashType).toBe('abort()');
    expect(result.description).toContain('assertion');
  });

  it('parses Stack smashing', () => {
    const result = parseEspException(STACK_SMASHING);
    expect(result.decoded).toBe(true);
    expect(result.crashType).toBe('Stack smashing');
    expect(result.description).toContain('Buffer overflow');
  });

  it('parses WDT reset from standalone message', () => {
    const result = parseEspException(WDT_STANDALONE);
    expect(result.decoded).toBe(true);
    expect(result.crashType).toBe('WDT reset');
    expect(result.description).toContain('watchdog');
  });

  it('parses Brownout detect', () => {
    const result = parseEspException('Brownout detector was triggered');
    expect(result.decoded).toBe(true);
    expect(result.crashType).toBe('Brownout detect');
    expect(result.description).toContain('Power supply voltage dropped');
  });

  it('parses rst:0x code when no other crash info', () => {
    const result = parseEspException(RST_CODE_ONLY);
    expect(result.decoded).toBe(true);
    expect(result.crashType).toContain('Reset');
    expect(result.description).toContain('0x0f');
  });

  it('returns decoded=false for normal output', () => {
    const result = parseEspException(NO_CRASH);
    expect(result.decoded).toBe(false);
    expect(result.crashType).toBe('');
    expect(result.stackFrames).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// parseEspException — backtrace parsing
// ---------------------------------------------------------------------------

describe('parseEspException — backtrace', () => {
  it('parses multiple backtrace frames with PC:SP format', () => {
    const result = parseEspException(GURU_LOAD_PROHIBITED);
    expect(result.stackFrames).toHaveLength(3);
    expect(result.stackFrames[0].address).toBe('0x400d1234');
    expect(result.stackFrames[0].raw).toBe('0x400d1234:0x3ffb1234');
    expect(result.stackFrames[1].address).toBe('0x400d5678');
    expect(result.stackFrames[2].address).toBe('0x400d9abc');
  });

  it('parses single backtrace frame', () => {
    const result = parseEspException(GURU_STORE_PROHIBITED);
    expect(result.stackFrames).toHaveLength(1);
    expect(result.stackFrames[0].address).toBe('0x400d1111');
  });

  it('parses backtrace frames without SP (address only)', () => {
    const result = parseEspException(BACKTRACE_NO_SP);
    expect(result.stackFrames).toHaveLength(2);
    expect(result.stackFrames[0].address).toBe('0x400d1234');
    expect(result.stackFrames[1].address).toBe('0x400d5678');
  });

  it('returns empty frames when no backtrace', () => {
    const result = parseEspException(RST_CODE_ONLY);
    expect(result.stackFrames).toHaveLength(0);
  });

  it('stack frames do not have file/line/function (future addr2line)', () => {
    const result = parseEspException(GURU_LOAD_PROHIBITED);
    for (const frame of result.stackFrames) {
      expect(frame.function).toBeUndefined();
      expect(frame.file).toBeUndefined();
      expect(frame.line).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// parseEspException — register dump parsing
// ---------------------------------------------------------------------------

describe('parseEspException — registers', () => {
  it('extracts register values from dump', () => {
    const result = parseEspException(GURU_LOAD_PROHIBITED);
    expect(result.registers).toBeDefined();
    expect(result.registers?.PC).toBe('0x400d1234');
    expect(result.registers?.PS).toBe('0x00060030');
    expect(result.registers?.A0).toBe('0x800d5678');
    expect(result.registers?.A1).toBe('0x3ffb1234');
    expect(result.registers?.A2).toBe('0x00000000');
  });

  it('returns undefined registers when no dump present', () => {
    const result = parseEspException(STACK_SMASHING);
    expect(result.registers).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// parseEspException — edge cases
// ---------------------------------------------------------------------------

describe('parseEspException — edge cases', () => {
  it('handles empty string', () => {
    const result = parseEspException('');
    expect(result.decoded).toBe(false);
  });

  it('handles crash with both rst code and Guru Meditation', () => {
    const result = parseEspException(WDT_RESET);
    // Guru Meditation should take priority over rst code
    expect(result.decoded).toBe(true);
    expect(result.crashType).toBe('LoadProhibited');
  });

  it('result shape matches EspExceptionResult interface', () => {
    const result: EspExceptionResult = parseEspException(GURU_LOAD_PROHIBITED);
    expect(typeof result.decoded).toBe('boolean');
    expect(typeof result.crashType).toBe('string');
    expect(typeof result.description).toBe('string');
    expect(Array.isArray(result.stackFrames)).toBe(true);
  });
});
