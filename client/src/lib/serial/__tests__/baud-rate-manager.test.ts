import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  BaudRateManager,
  STANDARD_BAUD_RATES,
  getBaudRateManager,
  resetBaudRateManager,
} from '../baud-rate-manager';
import type { BaudRateState, AutoDetectResult } from '../baud-rate-manager';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

const localStorageStore: Record<string, string> = {};

beforeEach(() => {
  Object.keys(localStorageStore).forEach((k) => {
    delete localStorageStore[k];
  });

  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      localStorageStore[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete localStorageStore[key];
    }),
    clear: vi.fn(() => {
      Object.keys(localStorageStore).forEach((k) => {
        delete localStorageStore[k];
      });
    }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  resetBaudRateManager();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a Uint8Array from an ASCII string. */
function asciiBytes(s: string): Uint8Array {
  const arr = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    arr[i] = s.charCodeAt(i);
  }
  return arr;
}

/** Create a Uint8Array of garbled (non-printable) bytes. */
function garbledBytes(length: number): Uint8Array {
  const arr = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    arr[i] = 0x80 + (i % 64); // 0x80-0xBF range, non-printable
  }
  return arr;
}

// ===========================================================================
// STANDARD_BAUD_RATES
// ===========================================================================

describe('STANDARD_BAUD_RATES', () => {
  it('contains exactly 14 standard rates', () => {
    expect(STANDARD_BAUD_RATES).toHaveLength(14);
  });

  it('is sorted in ascending order', () => {
    for (let i = 1; i < STANDARD_BAUD_RATES.length; i++) {
      expect(STANDARD_BAUD_RATES[i]).toBeGreaterThan(STANDARD_BAUD_RATES[i - 1]);
    }
  });

  it('includes all expected standard rates', () => {
    const expected = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 230400, 250000, 500000, 1000000, 2000000];
    expect([...STANDARD_BAUD_RATES]).toEqual(expected);
  });
});

// ===========================================================================
// BaudRateManager — creation and singleton
// ===========================================================================

describe('BaudRateManager', () => {
  let manager: BaudRateManager;

  beforeEach(() => {
    manager = BaudRateManager.create();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance from getBaudRateManager', () => {
      resetBaudRateManager();
      const a = getBaudRateManager();
      const b = getBaudRateManager();
      expect(a).toBe(b);
    });

    it('returns a new instance after resetBaudRateManager', () => {
      resetBaudRateManager();
      const a = getBaudRateManager();
      resetBaudRateManager();
      const b = getBaudRateManager();
      expect(a).not.toBe(b);
    });

    it('create() returns independent instances', () => {
      const a = BaudRateManager.create();
      const b = BaudRateManager.create();
      expect(a).not.toBe(b);
    });
  });

  // -----------------------------------------------------------------------
  // Subscribe / notify
  // -----------------------------------------------------------------------

  describe('subscribe', () => {
    it('notifies listeners on state change', () => {
      const listener = vi.fn();
      manager.subscribe(listener);
      manager.setRate(115200);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('stops notifying after unsubscribe', () => {
      const listener = vi.fn();
      const unsub = manager.subscribe(listener);
      unsub();
      manager.setRate(115200);
      expect(listener).not.toHaveBeenCalled();
    });

    it('supports multiple listeners', () => {
      const l1 = vi.fn();
      const l2 = vi.fn();
      manager.subscribe(l1);
      manager.subscribe(l2);
      manager.setRate(9600);
      expect(l1).toHaveBeenCalledTimes(1);
      expect(l2).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // getSnapshot
  // -----------------------------------------------------------------------

  describe('getSnapshot', () => {
    it('returns the current state object', () => {
      const snap = manager.getSnapshot();
      expect(snap).toHaveProperty('selectedRate');
      expect(snap).toHaveProperty('isAutoDetecting');
      expect(snap).toHaveProperty('detectedRate');
      expect(snap).toHaveProperty('confidence');
      expect(snap).toHaveProperty('lastUsedRate');
      expect(snap).toHaveProperty('mismatchWarning');
    });

    it('returns a new reference after state change', () => {
      const snap1 = manager.getSnapshot();
      manager.setRate(57600);
      const snap2 = manager.getSnapshot();
      expect(snap1).not.toBe(snap2);
    });
  });

  // -----------------------------------------------------------------------
  // setRate / getRate
  // -----------------------------------------------------------------------

  describe('setRate / getRate', () => {
    it('defaults to 9600', () => {
      expect(manager.getRate()).toBe(9600);
    });

    it('sets and gets a standard rate', () => {
      manager.setRate(115200);
      expect(manager.getRate()).toBe(115200);
    });

    it('sets and gets a custom rate', () => {
      manager.setRate(74880);
      expect(manager.getRate()).toBe(74880);
    });

    it('persists the rate to localStorage', () => {
      manager.setRate(57600);
      expect(localStorageStore['protopulse:baud:selected']).toBe('57600');
      expect(localStorageStore['protopulse:baud:lastUsed']).toBe('57600');
    });

    it('ignores invalid rates (0)', () => {
      manager.setRate(9600);
      manager.setRate(0);
      expect(manager.getRate()).toBe(9600);
    });

    it('ignores negative rates', () => {
      manager.setRate(9600);
      manager.setRate(-1200);
      expect(manager.getRate()).toBe(9600);
    });

    it('ignores NaN', () => {
      manager.setRate(9600);
      manager.setRate(NaN);
      expect(manager.getRate()).toBe(9600);
    });

    it('ignores Infinity', () => {
      manager.setRate(9600);
      manager.setRate(Infinity);
      expect(manager.getRate()).toBe(9600);
    });

    it('rounds fractional rates', () => {
      manager.setRate(9600.7);
      expect(manager.getRate()).toBe(9601);
    });

    it('clears mismatch warning on setRate', () => {
      // Force mismatch warning
      manager.checkMismatch(garbledBytes(20));
      expect(manager.getSnapshot().mismatchWarning).toBe(true);
      manager.setRate(115200);
      expect(manager.getSnapshot().mismatchWarning).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // getLastUsedRate
  // -----------------------------------------------------------------------

  describe('getLastUsedRate', () => {
    it('defaults to 9600', () => {
      expect(manager.getLastUsedRate()).toBe(9600);
    });

    it('updates after setRate', () => {
      manager.setRate(115200);
      expect(manager.getLastUsedRate()).toBe(115200);
    });

    it('reads from localStorage on create', () => {
      localStorageStore['protopulse:baud:lastUsed'] = '57600';
      const m = BaudRateManager.create();
      expect(m.getLastUsedRate()).toBe(57600);
    });
  });

  // -----------------------------------------------------------------------
  // localStorage persistence
  // -----------------------------------------------------------------------

  describe('localStorage persistence', () => {
    it('restores selectedRate from localStorage on create', () => {
      localStorageStore['protopulse:baud:selected'] = '38400';
      const m = BaudRateManager.create();
      expect(m.getRate()).toBe(38400);
    });

    it('restores lastUsedRate from localStorage on create', () => {
      localStorageStore['protopulse:baud:lastUsed'] = '230400';
      const m = BaudRateManager.create();
      expect(m.getLastUsedRate()).toBe(230400);
    });

    it('falls back to default when localStorage key is missing', () => {
      const m = BaudRateManager.create();
      expect(m.getRate()).toBe(9600);
      expect(m.getLastUsedRate()).toBe(9600);
    });

    it('falls back to default when localStorage value is invalid', () => {
      localStorageStore['protopulse:baud:selected'] = 'garbage';
      localStorageStore['protopulse:baud:lastUsed'] = 'NaN';
      const m = BaudRateManager.create();
      expect(m.getRate()).toBe(9600);
      expect(m.getLastUsedRate()).toBe(9600);
    });

    it('handles localStorage.getItem throwing', () => {
      vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });
      // Should not throw, falls back to defaults
      const m = BaudRateManager.create();
      expect(m.getRate()).toBe(9600);
    });

    it('handles localStorage.setItem throwing', () => {
      vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      // Should not throw
      expect(() => {
        manager.setRate(115200);
      }).not.toThrow();
      // Rate still updates in memory
      expect(manager.getRate()).toBe(115200);
    });
  });

  // -----------------------------------------------------------------------
  // autoDetect
  // -----------------------------------------------------------------------

  describe('autoDetect', () => {
    it('returns low confidence for empty/small sample', () => {
      const result = manager.autoDetect(new Uint8Array(0));
      expect(result.confidence).toBe(0);
    });

    it('returns low confidence for sample smaller than MIN_SAMPLE_SIZE', () => {
      const result = manager.autoDetect(new Uint8Array([0x41, 0x42, 0x43]));
      expect(result.confidence).toBe(0);
      expect(result.rate).toBe(9600); // defaults to current rate
    });

    it('returns high confidence for clean ASCII text', () => {
      const sample = asciiBytes('Hello World!\nSensor reading: 42.5\nTemperature: 23.1\n');
      const result = manager.autoDetect(sample);
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('keeps current rate when data looks clean', () => {
      manager.setRate(57600);
      const sample = asciiBytes('OK\nReady\nValue=100\n');
      const result = manager.autoDetect(sample);
      expect(result.rate).toBe(57600);
    });

    it('returns low confidence for garbled data', () => {
      const sample = garbledBytes(50);
      const result = manager.autoDetect(sample);
      expect(result.confidence).toBeLessThan(0.7);
    });

    it('suggests an alternative rate for garbled data', () => {
      manager.setRate(9600);
      const sample = garbledBytes(50);
      const result = manager.autoDetect(sample);
      // Should suggest a different rate than current
      expect(result.rate).not.toBe(9600);
    });

    it('sets mismatchWarning for very garbled data', () => {
      const sample = garbledBytes(50);
      manager.autoDetect(sample);
      expect(manager.getSnapshot().mismatchWarning).toBe(true);
    });

    it('clears mismatchWarning when data is clean', () => {
      // First garble
      manager.autoDetect(garbledBytes(50));
      expect(manager.getSnapshot().mismatchWarning).toBe(true);

      // Then clean data
      manager.autoDetect(asciiBytes('Hello World! Normal serial output here.\n'));
      expect(manager.getSnapshot().mismatchWarning).toBe(false);
    });

    it('sets isAutoDetecting during detection then clears it', () => {
      // autoDetect is synchronous, so we check before/after
      const snap = manager.getSnapshot();
      expect(snap.isAutoDetecting).toBe(false);

      manager.autoDetect(asciiBytes('test data is here\n'));
      expect(manager.getSnapshot().isAutoDetecting).toBe(false);
    });

    it('stores detected rate in state', () => {
      const sample = asciiBytes('Sensor: 42.5\nOK\nReady\n');
      const result = manager.autoDetect(sample);
      const snap = manager.getSnapshot();
      expect(snap.detectedRate).toBe(result.rate);
      expect(snap.confidence).toBe(result.confidence);
    });

    it('gives higher score to text with line endings', () => {
      const withEndings = asciiBytes('line1\nline2\nline3\nline4\nline5\n');
      const withoutEndings = asciiBytes('abcdefghijklmnopqrstuvwxyz12345');
      const scoreWith = manager.autoDetect(withEndings).confidence;
      manager.reset();
      const scoreWithout = manager.autoDetect(withoutEndings).confidence;
      expect(scoreWith).toBeGreaterThanOrEqual(scoreWithout);
    });
  });

  // -----------------------------------------------------------------------
  // checkMismatch
  // -----------------------------------------------------------------------

  describe('checkMismatch', () => {
    it('returns false for empty data', () => {
      expect(manager.checkMismatch(new Uint8Array(0))).toBe(false);
      expect(manager.getSnapshot().mismatchWarning).toBe(false);
    });

    it('returns false for clean ASCII data', () => {
      const sample = asciiBytes('Hello World!\n');
      expect(manager.checkMismatch(sample)).toBe(false);
      expect(manager.getSnapshot().mismatchWarning).toBe(false);
    });

    it('returns true for mostly garbled data', () => {
      const sample = garbledBytes(20);
      expect(manager.checkMismatch(sample)).toBe(true);
      expect(manager.getSnapshot().mismatchWarning).toBe(true);
    });

    it('threshold is at 50% non-printable', () => {
      // 10 printable + 10 non-printable = 50% → mismatch
      const mixed = new Uint8Array(20);
      for (let i = 0; i < 10; i++) {
        mixed[i] = 0x41 + i; // A-J (printable)
      }
      for (let i = 10; i < 20; i++) {
        mixed[i] = 0x80 + i; // non-printable
      }
      expect(manager.checkMismatch(mixed)).toBe(true);
    });

    it('returns false just below threshold', () => {
      // 11 printable + 9 non-printable = 45% → no mismatch
      const mixed = new Uint8Array(20);
      for (let i = 0; i < 11; i++) {
        mixed[i] = 0x41 + i; // printable
      }
      for (let i = 11; i < 20; i++) {
        mixed[i] = 0x80 + i; // non-printable
      }
      expect(manager.checkMismatch(mixed)).toBe(false);
    });

    it('treats tab/CR/LF as printable', () => {
      const sample = new Uint8Array([0x09, 0x0a, 0x0d, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47]);
      expect(manager.checkMismatch(sample)).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // dismissMismatchWarning
  // -----------------------------------------------------------------------

  describe('dismissMismatchWarning', () => {
    it('clears the mismatch warning', () => {
      manager.checkMismatch(garbledBytes(20));
      expect(manager.getSnapshot().mismatchWarning).toBe(true);
      manager.dismissMismatchWarning();
      expect(manager.getSnapshot().mismatchWarning).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // getCommonRates
  // -----------------------------------------------------------------------

  describe('getCommonRates', () => {
    it('returns exactly 5 rates', () => {
      expect(manager.getCommonRates()).toHaveLength(5);
    });

    it('returns the expected top-5 rates', () => {
      expect([...manager.getCommonRates()]).toEqual([9600, 115200, 57600, 38400, 19200]);
    });

    it('first entry is the default rate (9600)', () => {
      expect(manager.getCommonRates()[0]).toBe(9600);
    });
  });

  // -----------------------------------------------------------------------
  // isCustomRate
  // -----------------------------------------------------------------------

  describe('isCustomRate', () => {
    it('returns false for all standard rates', () => {
      for (const rate of STANDARD_BAUD_RATES) {
        expect(manager.isCustomRate(rate)).toBe(false);
      }
    });

    it('returns true for non-standard rates', () => {
      expect(manager.isCustomRate(74880)).toBe(true);
      expect(manager.isCustomRate(31250)).toBe(true);
      expect(manager.isCustomRate(460800)).toBe(true);
    });

    it('returns true for 0', () => {
      expect(manager.isCustomRate(0)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // formatRate
  // -----------------------------------------------------------------------

  describe('formatRate', () => {
    it('formats small rates as plain number', () => {
      expect(manager.formatRate(300)).toBe('300 baud');
    });

    it('formats 9600', () => {
      expect(manager.formatRate(9600)).toBe('9.6k baud');
    });

    it('formats 115200 as 115.2k', () => {
      expect(manager.formatRate(115200)).toBe('115.2k baud');
    });

    it('formats 57600 as 57.6k', () => {
      expect(manager.formatRate(57600)).toBe('57.6k baud');
    });

    it('formats 250000 as 250k', () => {
      expect(manager.formatRate(250000)).toBe('250k baud');
    });

    it('formats 500000 as 500k', () => {
      expect(manager.formatRate(500000)).toBe('500k baud');
    });

    it('formats 1000000 as 1M', () => {
      expect(manager.formatRate(1000000)).toBe('1M baud');
    });

    it('formats 2000000 as 2M', () => {
      expect(manager.formatRate(2000000)).toBe('2M baud');
    });

    it('returns "0 baud" for 0', () => {
      expect(manager.formatRate(0)).toBe('0 baud');
    });

    it('returns "0 baud" for negative', () => {
      expect(manager.formatRate(-100)).toBe('0 baud');
    });

    it('returns "0 baud" for NaN', () => {
      expect(manager.formatRate(NaN)).toBe('0 baud');
    });

    it('returns "0 baud" for Infinity', () => {
      expect(manager.formatRate(Infinity)).toBe('0 baud');
    });

    it('formats exact kilo rates as integer', () => {
      expect(manager.formatRate(19000)).toBe('19k baud');
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles very large custom rate', () => {
      manager.setRate(4000000);
      expect(manager.getRate()).toBe(4000000);
    });

    it('autoDetect with exactly MIN_SAMPLE_SIZE bytes works', () => {
      const sample = asciiBytes('12345678');
      const result = manager.autoDetect(sample);
      expect(result).toHaveProperty('rate');
      expect(result).toHaveProperty('confidence');
    });

    it('autoDetect with all null bytes', () => {
      const sample = new Uint8Array(20); // all zeros
      const result = manager.autoDetect(sample);
      // Null bytes are non-printable except we'd need to check
      expect(result.confidence).toBeLessThan(0.7);
    });

    it('checkMismatch with single printable byte', () => {
      expect(manager.checkMismatch(new Uint8Array([0x41]))).toBe(false);
    });

    it('checkMismatch with single non-printable byte', () => {
      expect(manager.checkMismatch(new Uint8Array([0xff]))).toBe(true);
    });

    it('reset clears all state', () => {
      manager.setRate(115200);
      manager.autoDetect(garbledBytes(20));
      manager.reset();
      const snap = manager.getSnapshot();
      expect(snap.selectedRate).toBe(9600);
      expect(snap.detectedRate).toBeNull();
      expect(snap.confidence).toBe(0);
      expect(snap.mismatchWarning).toBe(false);
      expect(snap.isAutoDetecting).toBe(false);
    });
  });
});
