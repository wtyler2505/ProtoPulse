import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  getRamLevel,
  parseCompilerOutput,
  parseFlashOutput,
  formatRamUsage,
  buildRamUsage,
  lookupBoard,
  useRamMonitor,
  KNOWN_BOARD_RAM,
} from '../ram-usage-monitor';
import type { RamUsage } from '../ram-usage-monitor';

// ---------------------------------------------------------------------------
// getRamLevel
// ---------------------------------------------------------------------------

describe('getRamLevel', () => {
  it('returns ok for 0%', () => {
    expect(getRamLevel(0)).toBe('ok');
  });

  it('returns ok for 50%', () => {
    expect(getRamLevel(50)).toBe('ok');
  });

  it('returns ok for 74%', () => {
    expect(getRamLevel(74)).toBe('ok');
  });

  it('returns warning at exactly 75%', () => {
    expect(getRamLevel(75)).toBe('warning');
  });

  it('returns warning for 85%', () => {
    expect(getRamLevel(85)).toBe('warning');
  });

  it('returns warning for 89%', () => {
    expect(getRamLevel(89)).toBe('warning');
  });

  it('returns critical at exactly 90%', () => {
    expect(getRamLevel(90)).toBe('critical');
  });

  it('returns critical for 95%', () => {
    expect(getRamLevel(95)).toBe('critical');
  });

  it('returns critical for 100%', () => {
    expect(getRamLevel(100)).toBe('critical');
  });
});

// ---------------------------------------------------------------------------
// parseCompilerOutput
// ---------------------------------------------------------------------------

describe('parseCompilerOutput', () => {
  it('parses standard Arduino IDE SRAM output', () => {
    const output =
      'Global variables use 1024 bytes (50%) of dynamic memory, leaving 1024 bytes for local variables.';
    const result = parseCompilerOutput(output);
    expect(result).not.toBeNull();
    expect(result!.used).toBe(1024);
    expect(result!.total).toBe(2048);
    expect(result!.percentage).toBe(50);
    expect(result!.level).toBe('ok');
  });

  it('parses output with comma-separated numbers', () => {
    const output =
      'Global variables use 1,536 bytes (75%) of dynamic memory, leaving 512 bytes for local variables.';
    const result = parseCompilerOutput(output);
    expect(result).not.toBeNull();
    expect(result!.used).toBe(1536);
    expect(result!.total).toBe(2048);
    expect(result!.percentage).toBe(75);
    expect(result!.level).toBe('warning');
  });

  it('uses boardTotal override when provided', () => {
    const output =
      'Global variables use 1024 bytes (50%) of dynamic memory, leaving 1024 bytes for local variables.';
    const result = parseCompilerOutput(output, 8192);
    expect(result).not.toBeNull();
    expect(result!.total).toBe(8192);
    // 1024/8192 = 12.5% → rounds to 13%
    expect(result!.percentage).toBe(13);
    expect(result!.level).toBe('ok');
  });

  it('parses simple "X bytes of Y bytes" format', () => {
    const output = 'Global variables use 512 bytes of 2048 bytes of dynamic memory';
    const result = parseCompilerOutput(output);
    expect(result).not.toBeNull();
    expect(result!.used).toBe(512);
    expect(result!.total).toBe(2048);
    expect(result!.percentage).toBe(25);
  });

  it('parses "out of" variant', () => {
    const output = 'Global variables use 4096 bytes out of 8192 bytes';
    const result = parseCompilerOutput(output);
    expect(result).not.toBeNull();
    expect(result!.used).toBe(4096);
    expect(result!.total).toBe(8192);
    expect(result!.percentage).toBe(50);
  });

  it('returns null for empty string', () => {
    expect(parseCompilerOutput('')).toBeNull();
  });

  it('returns null for unrelated output', () => {
    expect(parseCompilerOutput('Compiling sketch...\nDone.')).toBeNull();
  });

  it('returns null for null-ish input', () => {
    expect(parseCompilerOutput(null as unknown as string)).toBeNull();
    expect(parseCompilerOutput(undefined as unknown as string)).toBeNull();
  });

  it('handles zero used bytes', () => {
    const output =
      'Global variables use 0 bytes (0%) of dynamic memory, leaving 2048 bytes for local variables.';
    const result = parseCompilerOutput(output);
    expect(result).not.toBeNull();
    expect(result!.used).toBe(0);
    expect(result!.total).toBe(2048);
    expect(result!.percentage).toBe(0);
    expect(result!.level).toBe('ok');
  });

  it('detects critical usage from compiler output', () => {
    const output =
      'Global variables use 7500 bytes (92%) of dynamic memory, leaving 692 bytes for local variables.';
    const result = parseCompilerOutput(output);
    expect(result).not.toBeNull();
    expect(result!.level).toBe('critical');
  });

  it('handles multiline compiler output extracting SRAM line', () => {
    const output = [
      'Compiling sketch...',
      'Linking everything together...',
      'Sketch uses 14848 bytes (46%) of program storage space. Maximum is 32256 bytes.',
      'Global variables use 512 bytes (25%) of dynamic memory, leaving 1536 bytes for local variables.',
      '',
    ].join('\n');
    const result = parseCompilerOutput(output);
    expect(result).not.toBeNull();
    expect(result!.used).toBe(512);
    expect(result!.total).toBe(2048);
    expect(result!.percentage).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// parseFlashOutput
// ---------------------------------------------------------------------------

describe('parseFlashOutput', () => {
  it('parses standard flash output with Maximum line', () => {
    const output = [
      'Sketch uses 14848 bytes (46%) of program storage space. Maximum is 32256 bytes.',
      'Global variables use 512 bytes (25%) of dynamic memory, leaving 1536 bytes for local variables.',
    ].join('\n');
    const result = parseFlashOutput(output);
    expect(result).not.toBeNull();
    expect(result!.used).toBe(14848);
    expect(result!.total).toBe(32256);
    expect(result!.percentage).toBe(46);
    expect(result!.level).toBe('ok');
  });

  it('uses boardFlash override when provided', () => {
    const output = 'Sketch uses 14848 bytes (46%) of program storage space.';
    const result = parseFlashOutput(output, 262144);
    expect(result).not.toBeNull();
    expect(result!.total).toBe(262144);
    // 14848/262144 ≈ 5.66% → rounds to 6%
    expect(result!.percentage).toBe(6);
  });

  it('derives total from percentage when no Maximum line and no boardFlash', () => {
    const output = 'Sketch uses 15000 bytes (50%) of program storage space.';
    const result = parseFlashOutput(output);
    expect(result).not.toBeNull();
    expect(result!.total).toBe(30000);
    expect(result!.percentage).toBe(50);
  });

  it('returns null for empty string', () => {
    expect(parseFlashOutput('')).toBeNull();
  });

  it('returns null for non-flash output', () => {
    expect(parseFlashOutput('Global variables use 512 bytes of 2048 bytes')).toBeNull();
  });

  it('returns null for null-ish input', () => {
    expect(parseFlashOutput(null as unknown as string)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// formatRamUsage
// ---------------------------------------------------------------------------

describe('formatRamUsage', () => {
  it('formats ok-level usage', () => {
    const usage: RamUsage = { used: 1024, total: 2048, percentage: 50, level: 'ok' };
    expect(formatRamUsage(usage)).toBe('1,024 / 2,048 bytes (50%) — OK');
  });

  it('formats warning-level usage', () => {
    const usage: RamUsage = { used: 6144, total: 8192, percentage: 75, level: 'warning' };
    expect(formatRamUsage(usage)).toBe('6,144 / 8,192 bytes (75%) — WARNING');
  });

  it('formats critical-level usage', () => {
    const usage: RamUsage = { used: 7500, total: 8192, percentage: 92, level: 'critical' };
    expect(formatRamUsage(usage)).toBe('7,500 / 8,192 bytes (92%) — CRITICAL');
  });

  it('formats zero usage', () => {
    const usage: RamUsage = { used: 0, total: 2048, percentage: 0, level: 'ok' };
    expect(formatRamUsage(usage)).toBe('0 / 2,048 bytes (0%) — OK');
  });

  it('formats large numbers with commas', () => {
    const usage: RamUsage = { used: 520192, total: 524288, percentage: 99, level: 'critical' };
    expect(formatRamUsage(usage)).toBe('520,192 / 524,288 bytes (99%) — CRITICAL');
  });
});

// ---------------------------------------------------------------------------
// buildRamUsage
// ---------------------------------------------------------------------------

describe('buildRamUsage', () => {
  it('builds usage with correct percentage', () => {
    const result = buildRamUsage(1024, 2048);
    expect(result.used).toBe(1024);
    expect(result.total).toBe(2048);
    expect(result.percentage).toBe(50);
    expect(result.level).toBe('ok');
  });

  it('clamps used to total when used exceeds total', () => {
    const result = buildRamUsage(3000, 2048);
    expect(result.used).toBe(2048);
    expect(result.percentage).toBe(100);
    expect(result.level).toBe('critical');
  });

  it('handles zero total gracefully', () => {
    const result = buildRamUsage(0, 0);
    expect(result.used).toBe(0);
    expect(result.total).toBe(0);
    expect(result.percentage).toBe(0);
    expect(result.level).toBe('ok');
  });

  it('returns ok for low usage', () => {
    const result = buildRamUsage(100, 2048);
    expect(result.percentage).toBe(5);
    expect(result.level).toBe('ok');
  });

  it('returns warning at 75% threshold', () => {
    const result = buildRamUsage(1536, 2048);
    expect(result.percentage).toBe(75);
    expect(result.level).toBe('warning');
  });

  it('returns critical at 90% threshold', () => {
    const result = buildRamUsage(1844, 2048);
    expect(result.percentage).toBe(90);
    expect(result.level).toBe('critical');
  });
});

// ---------------------------------------------------------------------------
// KNOWN_BOARD_RAM
// ---------------------------------------------------------------------------

describe('KNOWN_BOARD_RAM', () => {
  it('contains Arduino Uno with correct specs', () => {
    const uno = KNOWN_BOARD_RAM['Arduino Uno'];
    expect(uno).toBeDefined();
    expect(uno.sramBytes).toBe(2048);
    expect(uno.flashBytes).toBe(32768);
  });

  it('contains Arduino Mega with 8K SRAM', () => {
    const mega = KNOWN_BOARD_RAM['Arduino Mega'];
    expect(mega).toBeDefined();
    expect(mega.sramBytes).toBe(8192);
  });

  it('contains ESP32 with 520KB SRAM', () => {
    const esp = KNOWN_BOARD_RAM['ESP32'];
    expect(esp).toBeDefined();
    expect(esp.sramBytes).toBe(520192);
  });

  it('contains STM32 with 20KB SRAM', () => {
    const stm = KNOWN_BOARD_RAM['STM32'];
    expect(stm).toBeDefined();
    expect(stm.sramBytes).toBe(20480);
  });

  it('contains at least 15 boards', () => {
    expect(Object.keys(KNOWN_BOARD_RAM).length).toBeGreaterThanOrEqual(15);
  });

  it('every entry has board name matching its key', () => {
    for (const [key, spec] of Object.entries(KNOWN_BOARD_RAM)) {
      expect(spec.board).toBe(key);
    }
  });

  it('every entry has positive sramBytes and flashBytes', () => {
    for (const [, spec] of Object.entries(KNOWN_BOARD_RAM)) {
      expect(spec.sramBytes).toBeGreaterThan(0);
      expect(spec.flashBytes).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// lookupBoard
// ---------------------------------------------------------------------------

describe('lookupBoard', () => {
  it('finds exact match', () => {
    const result = lookupBoard('Arduino Uno');
    expect(result).not.toBeNull();
    expect(result!.board).toBe('Arduino Uno');
  });

  it('is case-insensitive for exact match', () => {
    const result = lookupBoard('arduino uno');
    expect(result).not.toBeNull();
    expect(result!.board).toBe('Arduino Uno');
  });

  it('finds partial match "uno"', () => {
    const result = lookupBoard('uno');
    expect(result).not.toBeNull();
    expect(result!.board).toBe('Arduino Uno');
  });

  it('finds partial match "mega"', () => {
    const result = lookupBoard('mega');
    expect(result).not.toBeNull();
    expect(result!.board).toBe('Arduino Mega');
  });

  it('finds ESP32', () => {
    const result = lookupBoard('ESP32');
    expect(result).not.toBeNull();
    expect(result!.sramBytes).toBe(520192);
  });

  it('returns null for unknown board', () => {
    expect(lookupBoard('NonExistentBoard9999')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(lookupBoard('')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// useRamMonitor hook
// ---------------------------------------------------------------------------

describe('useRamMonitor', () => {
  it('initializes with null usage', () => {
    const { result } = renderHook(() => useRamMonitor());
    expect(result.current.usage).toBeNull();
    expect(result.current.flashUsage).toBeNull();
    expect(result.current.boardSpec).toBeNull();
  });

  it('resolves board spec when boardName is provided', () => {
    const { result } = renderHook(() => useRamMonitor('Arduino Uno'));
    expect(result.current.boardSpec).not.toBeNull();
    expect(result.current.boardSpec!.sramBytes).toBe(2048);
  });

  it('returns null boardSpec for unknown board', () => {
    const { result } = renderHook(() => useRamMonitor('UnknownBoard'));
    expect(result.current.boardSpec).toBeNull();
  });

  it('updates SRAM usage from compiler output', () => {
    const { result } = renderHook(() => useRamMonitor('Arduino Uno'));
    act(() => {
      result.current.update(
        'Global variables use 512 bytes (25%) of dynamic memory, leaving 1536 bytes for local variables.',
      );
    });
    expect(result.current.usage).not.toBeNull();
    expect(result.current.usage!.used).toBe(512);
    expect(result.current.usage!.total).toBe(2048);
    expect(result.current.usage!.level).toBe('ok');
  });

  it('updates flash usage from compiler output', () => {
    const output = [
      'Sketch uses 14848 bytes (46%) of program storage space. Maximum is 32256 bytes.',
      'Global variables use 512 bytes (25%) of dynamic memory, leaving 1536 bytes for local variables.',
    ].join('\n');
    const { result } = renderHook(() => useRamMonitor('Arduino Uno'));
    act(() => {
      result.current.update(output);
    });
    expect(result.current.flashUsage).not.toBeNull();
    expect(result.current.flashUsage!.used).toBe(14848);
  });

  it('resets usage on reset()', () => {
    const { result } = renderHook(() => useRamMonitor('Arduino Uno'));
    act(() => {
      result.current.update(
        'Global variables use 512 bytes (25%) of dynamic memory, leaving 1536 bytes for local variables.',
      );
    });
    expect(result.current.usage).not.toBeNull();
    act(() => {
      result.current.reset();
    });
    expect(result.current.usage).toBeNull();
    expect(result.current.flashUsage).toBeNull();
  });

  it('does not update usage when output has no matching line', () => {
    const { result } = renderHook(() => useRamMonitor());
    act(() => {
      result.current.update('Compiling sketch...\nDone.');
    });
    expect(result.current.usage).toBeNull();
  });

  it('tracks successive updates (latest wins)', () => {
    const { result } = renderHook(() => useRamMonitor());
    act(() => {
      result.current.update(
        'Global variables use 256 bytes (13%) of dynamic memory, leaving 1792 bytes for local variables.',
      );
    });
    expect(result.current.usage!.used).toBe(256);
    act(() => {
      result.current.update(
        'Global variables use 1024 bytes (50%) of dynamic memory, leaving 1024 bytes for local variables.',
      );
    });
    expect(result.current.usage!.used).toBe(1024);
    expect(result.current.usage!.percentage).toBe(50);
  });
});
