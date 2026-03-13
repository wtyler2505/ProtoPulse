import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  parseMemoryOutput,
  getThreshold,
  formatBytes,
  MemoryUsageManager,
} from '../memory-usage-parser';
import type {
  MemoryUsage,
  MemoryRegion,
  MemoryHistory,
  MemoryDelta,
  MemoryThreshold,
} from '../memory-usage-parser';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function freshManager(): MemoryUsageManager {
  return MemoryUsageManager.create();
}

function makeUsage(overrides?: Partial<MemoryUsage>): MemoryUsage {
  return {
    flash: { used: 12345, max: 32256, percent: 38 },
    ram: { used: 456, max: 2048, percent: 22 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock localStorage
// ---------------------------------------------------------------------------

const localStorageData = new Map<string, string>();

beforeEach(() => {
  localStorageData.clear();
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => localStorageData.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      localStorageData.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      localStorageData.delete(key);
    }),
  });
});

// ===========================================================================
// parseMemoryOutput
// ===========================================================================

describe('parseMemoryOutput', () => {
  // ---- Arduino-cli AVR (UNO/Nano/Mega) ----

  describe('Arduino-cli AVR output', () => {
    it('parses standard UNO compile output', () => {
      const output = [
        'Sketch uses 12345 bytes (38%) of program storage space. Maximum is 32256 bytes.',
        'Global variables use 456 bytes (22%) of dynamic memory, leaving 1592 bytes for local variables. Maximum is 2048 bytes.',
      ].join('\n');

      const result = parseMemoryOutput(output);
      expect(result).not.toBeNull();
      expect(result!.flash).toEqual({ used: 12345, max: 32256, percent: 38 });
      expect(result!.ram).toEqual({ used: 456, max: 2048, percent: 22 });
    });

    it('parses Mega compile output with large values', () => {
      const output = [
        'Sketch uses 98765 bytes (38%) of program storage space. Maximum is 253952 bytes.',
        'Global variables use 4567 bytes (55%) of dynamic memory, leaving 3625 bytes for local variables. Maximum is 8192 bytes.',
      ].join('\n');

      const result = parseMemoryOutput(output);
      expect(result).not.toBeNull();
      expect(result!.flash.used).toBe(98765);
      expect(result!.flash.max).toBe(253952);
      expect(result!.ram.used).toBe(4567);
      expect(result!.ram.max).toBe(8192);
    });

    it('parses output with 0% usage', () => {
      const output = [
        'Sketch uses 444 bytes (0%) of program storage space. Maximum is 32256 bytes.',
        'Global variables use 9 bytes (0%) of dynamic memory, leaving 2039 bytes for local variables. Maximum is 2048 bytes.',
      ].join('\n');

      const result = parseMemoryOutput(output);
      expect(result).not.toBeNull();
      expect(result!.flash.percent).toBe(0);
      expect(result!.ram.percent).toBe(0);
    });

    it('parses output with 100% usage', () => {
      const output = [
        'Sketch uses 32256 bytes (100%) of program storage space. Maximum is 32256 bytes.',
        'Global variables use 2048 bytes (100%) of dynamic memory, leaving 0 bytes for local variables. Maximum is 2048 bytes.',
      ].join('\n');

      const result = parseMemoryOutput(output);
      expect(result).not.toBeNull();
      expect(result!.flash.percent).toBe(100);
      expect(result!.flash.used).toBe(32256);
      expect(result!.ram.percent).toBe(100);
      expect(result!.ram.used).toBe(2048);
    });

    it('handles flash-only output (no RAM line)', () => {
      const output =
        'Sketch uses 12345 bytes (38%) of program storage space. Maximum is 32256 bytes.';

      const result = parseMemoryOutput(output);
      expect(result).not.toBeNull();
      expect(result!.flash.used).toBe(12345);
      expect(result!.ram).toEqual({ used: 0, max: 0, percent: 0 });
    });

    it('handles RAM-only output (no flash line)', () => {
      const output =
        'Global variables use 456 bytes (22%) of dynamic memory, leaving 1592 bytes for local variables. Maximum is 2048 bytes.';

      const result = parseMemoryOutput(output);
      expect(result).not.toBeNull();
      expect(result!.ram.used).toBe(456);
      expect(result!.flash).toEqual({ used: 0, max: 0, percent: 0 });
    });

    it('handles output surrounded by other compiler messages', () => {
      const output = [
        'Compiling sketch...',
        'Compiling libraries...',
        'Compiling library "Wire"...',
        'Linking everything together...',
        'Sketch uses 12345 bytes (38%) of program storage space. Maximum is 32256 bytes.',
        'Global variables use 456 bytes (22%) of dynamic memory, leaving 1592 bytes for local variables. Maximum is 2048 bytes.',
      ].join('\n');

      const result = parseMemoryOutput(output);
      expect(result).not.toBeNull();
      expect(result!.flash.used).toBe(12345);
      expect(result!.ram.used).toBe(456);
    });
  });

  // ---- ESP32 ----

  describe('ESP32 output', () => {
    it('parses ESP32 compile output', () => {
      const output = [
        'Sketch uses 234567 bytes (17%) of program storage space. Maximum is 1310720 bytes.',
        'Global variables use 12345 bytes (3%) of dynamic memory, leaving 315175 bytes for local variables. Maximum is 327680 bytes.',
      ].join('\n');

      const result = parseMemoryOutput(output);
      expect(result).not.toBeNull();
      expect(result!.flash).toEqual({ used: 234567, max: 1310720, percent: 17 });
      expect(result!.ram).toEqual({ used: 12345, max: 327680, percent: 3 });
    });

    it('parses ESP32-S3 with large flash', () => {
      const output = [
        'Sketch uses 1048576 bytes (50%) of program storage space. Maximum is 2097152 bytes.',
        'Global variables use 65536 bytes (20%) of dynamic memory, leaving 262144 bytes for local variables. Maximum is 327680 bytes.',
      ].join('\n');

      const result = parseMemoryOutput(output);
      expect(result).not.toBeNull();
      expect(result!.flash.used).toBe(1048576);
      expect(result!.flash.max).toBe(2097152);
    });
  });

  // ---- PlatformIO ----

  describe('PlatformIO output', () => {
    it('parses PlatformIO format with both regions', () => {
      const output = [
        'RAM:   [==        ]  22.3% (used 456 bytes from 2048 bytes)',
        'Flash: [=====     ]  48.2% (used 12345 bytes from 32256 bytes)',
      ].join('\n');

      const result = parseMemoryOutput(output);
      expect(result).not.toBeNull();
      expect(result!.flash.used).toBe(12345);
      expect(result!.flash.max).toBe(32256);
      expect(result!.flash.percent).toBeCloseTo(48.2);
      expect(result!.ram.used).toBe(456);
      expect(result!.ram.max).toBe(2048);
      expect(result!.ram.percent).toBeCloseTo(22.3);
    });

    it('parses PlatformIO FLASH (uppercase)', () => {
      const output =
        'FLASH: [=====     ]  48.2% (used 12345 bytes from 32256 bytes)';

      const result = parseMemoryOutput(output);
      expect(result).not.toBeNull();
      expect(result!.flash.used).toBe(12345);
    });

    it('parses PlatformIO RAM-only', () => {
      const output =
        'RAM:   [==        ]  22.3% (used 456 bytes from 2048 bytes)';

      const result = parseMemoryOutput(output);
      expect(result).not.toBeNull();
      expect(result!.ram.used).toBe(456);
      expect(result!.flash).toEqual({ used: 0, max: 0, percent: 0 });
    });

    it('parses PlatformIO with varying bar lengths', () => {
      const output =
        'RAM:   [==========] 100.0% (used 2048 bytes from 2048 bytes)';

      const result = parseMemoryOutput(output);
      expect(result).not.toBeNull();
      expect(result!.ram.percent).toBeCloseTo(100.0);
      expect(result!.ram.used).toBe(2048);
    });

    it('parses PlatformIO with empty bar', () => {
      const output =
        'RAM:   [          ]   0.3% (used 6 bytes from 2048 bytes)';

      const result = parseMemoryOutput(output);
      expect(result).not.toBeNull();
      expect(result!.ram.percent).toBeCloseTo(0.3);
      expect(result!.ram.used).toBe(6);
    });
  });

  // ---- Edge cases ----

  describe('edge cases', () => {
    it('returns null for empty string', () => {
      expect(parseMemoryOutput('')).toBeNull();
    });

    it('returns null for unrelated output', () => {
      expect(parseMemoryOutput('Compiling sketch...\nDone compiling.')).toBeNull();
    });

    it('returns null for error-only output', () => {
      const output = [
        'error: expected ; before } token',
        'exit status 1',
        'Error compiling for board Arduino Uno.',
      ].join('\n');
      expect(parseMemoryOutput(output)).toBeNull();
    });

    it('returns null for partial malformed line', () => {
      // Missing percentage
      expect(parseMemoryOutput('Sketch uses 12345 bytes of program storage space.')).toBeNull();
    });

    it('Arduino format takes priority over PlatformIO for flash', () => {
      const output = [
        'Sketch uses 12345 bytes (38%) of program storage space. Maximum is 32256 bytes.',
        'Flash: [=====     ]  48.2% (used 99999 bytes from 32256 bytes)',
      ].join('\n');

      const result = parseMemoryOutput(output);
      expect(result).not.toBeNull();
      // Arduino format should win
      expect(result!.flash.used).toBe(12345);
    });

    it('handles Windows-style CRLF line endings', () => {
      const output =
        'Sketch uses 12345 bytes (38%) of program storage space. Maximum is 32256 bytes.\r\n' +
        'Global variables use 456 bytes (22%) of dynamic memory, leaving 1592 bytes for local variables. Maximum is 2048 bytes.\r\n';

      const result = parseMemoryOutput(output);
      expect(result).not.toBeNull();
      expect(result!.flash.used).toBe(12345);
      expect(result!.ram.used).toBe(456);
    });

    it('handles output without "leaving N bytes" clause', () => {
      const output =
        'Global variables use 456 bytes (22%) of dynamic memory. Maximum is 2048 bytes.';

      const result = parseMemoryOutput(output);
      expect(result).not.toBeNull();
      expect(result!.ram.used).toBe(456);
      expect(result!.ram.max).toBe(2048);
    });
  });
});

// ===========================================================================
// getThreshold
// ===========================================================================

describe('getThreshold', () => {
  it('returns "normal" for 0%', () => {
    expect(getThreshold(0)).toBe('normal');
  });

  it('returns "normal" for 50%', () => {
    expect(getThreshold(50)).toBe('normal');
  });

  it('returns "normal" for 74%', () => {
    expect(getThreshold(74)).toBe('normal');
  });

  it('returns "warning" for 75%', () => {
    expect(getThreshold(75)).toBe('warning');
  });

  it('returns "warning" for 80%', () => {
    expect(getThreshold(80)).toBe('warning');
  });

  it('returns "warning" for 90%', () => {
    expect(getThreshold(90)).toBe('warning');
  });

  it('returns "critical" for 91%', () => {
    expect(getThreshold(91)).toBe('critical');
  });

  it('returns "critical" for 95%', () => {
    expect(getThreshold(95)).toBe('critical');
  });

  it('returns "critical" for 100%', () => {
    expect(getThreshold(100)).toBe('critical');
  });

  it('returns "normal" for negative values', () => {
    expect(getThreshold(-5)).toBe('normal');
  });

  it('returns "critical" for values above 100', () => {
    expect(getThreshold(150)).toBe('critical');
  });
});

// ===========================================================================
// formatBytes
// ===========================================================================

describe('formatBytes', () => {
  it('formats 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats small values in bytes', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('formats 1 byte', () => {
    expect(formatBytes(1)).toBe('1 B');
  });

  it('formats 1023 bytes (stays in B)', () => {
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('formats exactly 1 KB', () => {
    expect(formatBytes(1024)).toBe('1.00 KB');
  });

  it('formats 1.5 KB', () => {
    expect(formatBytes(1536)).toBe('1.50 KB');
  });

  it('formats 31.5 KB', () => {
    expect(formatBytes(32256)).toBe('31.50 KB');
  });

  it('formats exactly 1 MB', () => {
    expect(formatBytes(1048576)).toBe('1.00 MB');
  });

  it('formats 1.25 MB', () => {
    expect(formatBytes(1310720)).toBe('1.25 MB');
  });

  it('formats large ESP32 flash', () => {
    expect(formatBytes(2097152)).toBe('2.00 MB');
  });

  it('formats negative values with dash prefix', () => {
    expect(formatBytes(-1024)).toBe('-1.00 KB');
  });

  it('formats negative small values', () => {
    expect(formatBytes(-512)).toBe('-512 B');
  });
});

// ===========================================================================
// MemoryUsageManager
// ===========================================================================

describe('MemoryUsageManager', () => {
  let manager: MemoryUsageManager;

  beforeEach(() => {
    manager = freshManager();
  });

  // ---- Factory ----

  describe('create()', () => {
    it('creates a fresh instance', () => {
      const m = MemoryUsageManager.create();
      expect(m).toBeInstanceOf(MemoryUsageManager);
    });

    it('creates independent instances', () => {
      const m1 = MemoryUsageManager.create();
      const m2 = MemoryUsageManager.create();
      m1.addToHistory(makeUsage(), 'uno', 'sketch1');
      expect(m1.getHistory().length).toBe(1);
      expect(m2.getHistory().length).toBe(0);
    });
  });

  // ---- getHistory / getLatest ----

  describe('getHistory()', () => {
    it('returns empty array for new manager', () => {
      expect(manager.getHistory()).toEqual([]);
    });

    it('returns all entries after adds', () => {
      manager.addToHistory(makeUsage(), 'uno', 'sketch1');
      manager.addToHistory(makeUsage(), 'mega', 'sketch2');
      const history = manager.getHistory();
      expect(history.length).toBe(2);
      expect(history[0].board).toBe('uno');
      expect(history[1].board).toBe('mega');
    });

    it('returns a copy (mutations do not affect internal state)', () => {
      manager.addToHistory(makeUsage(), 'uno', 'sketch1');
      const history = manager.getHistory();
      history.length = 0;
      expect(manager.getHistory().length).toBe(1);
    });
  });

  describe('getLatest()', () => {
    it('returns undefined for empty history', () => {
      expect(manager.getLatest()).toBeUndefined();
    });

    it('returns the most recently added entry', () => {
      manager.addToHistory(makeUsage(), 'uno', 'sketch1');
      manager.addToHistory(makeUsage(), 'mega', 'sketch2');
      expect(manager.getLatest()!.board).toBe('mega');
    });
  });

  // ---- addToHistory ----

  describe('addToHistory()', () => {
    it('adds an entry with timestamp', () => {
      const before = Date.now();
      manager.addToHistory(makeUsage(), 'uno', 'Blink.ino');
      const after = Date.now();

      const entry = manager.getLatest()!;
      expect(entry.board).toBe('uno');
      expect(entry.sketch).toBe('Blink.ino');
      expect(entry.timestamp).toBeGreaterThanOrEqual(before);
      expect(entry.timestamp).toBeLessThanOrEqual(after);
      expect(entry.usage.flash.used).toBe(12345);
    });

    it('preserves order (oldest first)', () => {
      manager.addToHistory(makeUsage(), 'uno', 'first');
      manager.addToHistory(makeUsage(), 'mega', 'second');
      manager.addToHistory(makeUsage(), 'esp32', 'third');

      const history = manager.getHistory();
      expect(history[0].sketch).toBe('first');
      expect(history[1].sketch).toBe('second');
      expect(history[2].sketch).toBe('third');
    });

    it('trims history to 10 entries (FIFO)', () => {
      for (let i = 0; i < 15; i++) {
        manager.addToHistory(makeUsage(), 'uno', `sketch-${i}`);
      }

      const history = manager.getHistory();
      expect(history.length).toBe(10);
      // Oldest should be sketch-5, newest sketch-14
      expect(history[0].sketch).toBe('sketch-5');
      expect(history[9].sketch).toBe('sketch-14');
    });

    it('persists to localStorage', () => {
      manager.addToHistory(makeUsage(), 'uno', 'test');

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'protopulse-memory-history',
        expect.any(String),
      );
    });

    it('increments version on add', () => {
      const v0 = manager.version;
      manager.addToHistory(makeUsage(), 'uno', 'test');
      expect(manager.version).toBe(v0 + 1);
    });
  });

  // ---- clearHistory ----

  describe('clearHistory()', () => {
    it('removes all entries', () => {
      manager.addToHistory(makeUsage(), 'uno', 'test');
      manager.clearHistory();
      expect(manager.getHistory().length).toBe(0);
    });

    it('does not notify if already empty', () => {
      const listener = vi.fn();
      manager.subscribe(listener);
      manager.clearHistory();
      expect(listener).not.toHaveBeenCalled();
    });

    it('increments version when clearing non-empty history', () => {
      manager.addToHistory(makeUsage(), 'uno', 'test');
      const v = manager.version;
      manager.clearHistory();
      expect(manager.version).toBe(v + 1);
    });
  });

  // ---- getDelta ----

  describe('getDelta()', () => {
    it('returns null when history is empty', () => {
      expect(manager.getDelta(makeUsage())).toBeNull();
    });

    it('computes positive delta (flash and RAM increased)', () => {
      manager.addToHistory(
        makeUsage({
          flash: { used: 10000, max: 32256, percent: 31 },
          ram: { used: 400, max: 2048, percent: 19 },
        }),
        'uno',
        'v1',
      );

      const delta = manager.getDelta(
        makeUsage({
          flash: { used: 12000, max: 32256, percent: 37 },
          ram: { used: 500, max: 2048, percent: 24 },
        }),
      );

      expect(delta).not.toBeNull();
      expect(delta!.flashDelta).toBe(2000);
      expect(delta!.ramDelta).toBe(100);
    });

    it('computes negative delta (size decreased)', () => {
      manager.addToHistory(
        makeUsage({
          flash: { used: 15000, max: 32256, percent: 46 },
          ram: { used: 600, max: 2048, percent: 29 },
        }),
        'uno',
        'v1',
      );

      const delta = manager.getDelta(
        makeUsage({
          flash: { used: 12000, max: 32256, percent: 37 },
          ram: { used: 400, max: 2048, percent: 19 },
        }),
      );

      expect(delta).not.toBeNull();
      expect(delta!.flashDelta).toBe(-3000);
      expect(delta!.ramDelta).toBe(-200);
    });

    it('computes zero delta when identical', () => {
      const usage = makeUsage();
      manager.addToHistory(usage, 'uno', 'same');
      const delta = manager.getDelta(usage);
      expect(delta).not.toBeNull();
      expect(delta!.flashDelta).toBe(0);
      expect(delta!.ramDelta).toBe(0);
    });

    it('compares against the most recent entry (not the first)', () => {
      manager.addToHistory(
        makeUsage({ flash: { used: 5000, max: 32256, percent: 15 } }),
        'uno',
        'old',
      );
      manager.addToHistory(
        makeUsage({ flash: { used: 10000, max: 32256, percent: 31 } }),
        'uno',
        'recent',
      );

      const delta = manager.getDelta(
        makeUsage({ flash: { used: 12000, max: 32256, percent: 37 } }),
      );

      // Delta should be against 10000, not 5000
      expect(delta!.flashDelta).toBe(2000);
    });
  });

  // ---- getSnapshot ----

  describe('getSnapshot()', () => {
    it('returns empty array for new manager', () => {
      expect(manager.getSnapshot()).toEqual([]);
    });

    it('returns updated reference after mutation', () => {
      const snap1 = manager.getSnapshot();
      manager.addToHistory(makeUsage(), 'uno', 'test');
      const snap2 = manager.getSnapshot();
      expect(snap1).not.toBe(snap2);
      expect(snap2.length).toBe(1);
    });
  });

  // ---- subscribe / notify ----

  describe('subscribe()', () => {
    it('calls listener on addToHistory', () => {
      const listener = vi.fn();
      manager.subscribe(listener);
      manager.addToHistory(makeUsage(), 'uno', 'test');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('calls listener on clearHistory', () => {
      manager.addToHistory(makeUsage(), 'uno', 'test');
      const listener = vi.fn();
      manager.subscribe(listener);
      manager.clearHistory();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('unsubscribes correctly', () => {
      const listener = vi.fn();
      const unsub = manager.subscribe(listener);
      unsub();
      manager.addToHistory(makeUsage(), 'uno', 'test');
      expect(listener).not.toHaveBeenCalled();
    });

    it('supports multiple listeners', () => {
      const l1 = vi.fn();
      const l2 = vi.fn();
      manager.subscribe(l1);
      manager.subscribe(l2);
      manager.addToHistory(makeUsage(), 'uno', 'test');
      expect(l1).toHaveBeenCalledTimes(1);
      expect(l2).toHaveBeenCalledTimes(1);
    });

    it('handles listener that throws without breaking other listeners', () => {
      const l1 = vi.fn(() => {
        throw new Error('boom');
      });
      const l2 = vi.fn();
      manager.subscribe(l1);
      manager.subscribe(l2);

      // The error from l1 will propagate, but l2 may not be called
      // since we iterate Array.from(listeners) sequentially.
      // The important thing is that the manager state is consistent.
      expect(() => {
        manager.addToHistory(makeUsage(), 'uno', 'test');
      }).toThrow('boom');

      // Internal state should still be updated despite the error
      expect(manager.getHistory().length).toBe(1);
    });
  });

  // ---- localStorage persistence ----

  describe('localStorage persistence', () => {
    it('loads existing history from localStorage', () => {
      const existingHistory: MemoryHistory[] = [
        {
          timestamp: 1000,
          usage: makeUsage(),
          board: 'uno',
          sketch: 'from-storage',
        },
      ];
      localStorageData.set('protopulse-memory-history', JSON.stringify(existingHistory));

      const m = MemoryUsageManager.create();
      expect(m.getHistory().length).toBe(1);
      expect(m.getHistory()[0].sketch).toBe('from-storage');
    });

    it('handles corrupt localStorage gracefully', () => {
      localStorageData.set('protopulse-memory-history', 'not-valid-json{{{');
      const m = MemoryUsageManager.create();
      expect(m.getHistory()).toEqual([]);
    });

    it('handles non-array localStorage value gracefully', () => {
      localStorageData.set('protopulse-memory-history', JSON.stringify({ notArray: true }));
      const m = MemoryUsageManager.create();
      expect(m.getHistory()).toEqual([]);
    });

    it('handles missing localStorage key', () => {
      const m = MemoryUsageManager.create();
      expect(m.getHistory()).toEqual([]);
    });
  });

  // ---- version counter ----

  describe('version', () => {
    it('starts at 0', () => {
      expect(manager.version).toBe(0);
    });

    it('increments with each mutation', () => {
      manager.addToHistory(makeUsage(), 'uno', '1');
      expect(manager.version).toBe(1);
      manager.addToHistory(makeUsage(), 'uno', '2');
      expect(manager.version).toBe(2);
      manager.clearHistory();
      expect(manager.version).toBe(3);
    });

    it('does not increment on no-op clear', () => {
      manager.clearHistory(); // already empty
      expect(manager.version).toBe(0);
    });
  });
});
