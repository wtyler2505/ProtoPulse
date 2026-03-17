import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  BoardPackageChecker,
  KNOWN_PACKAGES,
  compareVersions,
  usePackageChecker,
} from '../board-package-checker';
import type { BoardPackage, KnownPackageEntry } from '../board-package-checker';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

function createMockLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
    get length() {
      return store.size;
    },
    key: vi.fn((_index: number) => null),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BoardPackageChecker', () => {
  let checker: BoardPackageChecker;
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    BoardPackageChecker.resetInstance();
    checker = BoardPackageChecker.getInstance();
  });

  afterEach(() => {
    BoardPackageChecker.resetInstance();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance on repeated calls', () => {
      const a = BoardPackageChecker.getInstance();
      const b = BoardPackageChecker.getInstance();
      expect(a).toBe(b);
    });

    it('creates a fresh instance after resetInstance', () => {
      checker.setPackage({ name: 'arduino:avr', version: '1.8.6', installed: true });
      BoardPackageChecker.resetInstance();
      const fresh = BoardPackageChecker.getInstance();
      // Fresh instance loads from localStorage, so data persists
      expect(fresh.getPackage('arduino:avr')).toBeDefined();
    });

    it('resetInstance clears the singleton reference', () => {
      const first = BoardPackageChecker.getInstance();
      BoardPackageChecker.resetInstance();
      const second = BoardPackageChecker.getInstance();
      expect(first).not.toBe(second);
    });
  });

  // -----------------------------------------------------------------------
  // setPackage / getPackage / getAllPackages
  // -----------------------------------------------------------------------

  describe('setPackage', () => {
    it('adds a new package', () => {
      checker.setPackage({ name: 'arduino:avr', version: '1.8.6', installed: true });
      const pkg = checker.getPackage('arduino:avr');
      expect(pkg).toBeDefined();
      expect(pkg?.name).toBe('arduino:avr');
      expect(pkg?.version).toBe('1.8.6');
      expect(pkg?.installed).toBe(true);
    });

    it('updates an existing package', () => {
      checker.setPackage({ name: 'arduino:avr', version: '1.8.6', installed: true });
      checker.setPackage({ name: 'arduino:avr', version: '1.8.7', installed: true });
      expect(checker.getPackage('arduino:avr')?.version).toBe('1.8.7');
    });

    it('preserves latestVersion from existing entry when not provided', () => {
      checker.setPackage({ name: 'esp32:esp32', version: '2.0.0', installed: true, latestVersion: '2.1.0' });
      checker.setPackage({ name: 'esp32:esp32', version: '2.0.0', installed: true });
      expect(checker.getPackage('esp32:esp32')?.latestVersion).toBe('2.1.0');
    });

    it('overrides latestVersion when provided', () => {
      checker.setPackage({ name: 'esp32:esp32', version: '2.0.0', installed: true, latestVersion: '2.1.0' });
      checker.setPackage({ name: 'esp32:esp32', version: '2.0.0', installed: true, latestVersion: '2.2.0' });
      expect(checker.getPackage('esp32:esp32')?.latestVersion).toBe('2.2.0');
    });

    it('persists to localStorage', () => {
      checker.setPackage({ name: 'arduino:avr', version: '1.8.6', installed: true });
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'protopulse-board-packages',
        expect.any(String),
      );
    });

    it('notifies subscribers', () => {
      const cb = vi.fn();
      checker.subscribe(cb);
      checker.setPackage({ name: 'arduino:avr', version: '1.8.6', installed: true });
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAllPackages', () => {
    it('returns empty array initially', () => {
      expect(checker.getAllPackages()).toEqual([]);
    });

    it('returns all tracked packages', () => {
      checker.setPackage({ name: 'arduino:avr', version: '1.8.6', installed: true });
      checker.setPackage({ name: 'esp32:esp32', version: '2.0.0', installed: false });
      expect(checker.getAllPackages()).toHaveLength(2);
    });
  });

  // -----------------------------------------------------------------------
  // setPackages (bulk)
  // -----------------------------------------------------------------------

  describe('setPackages', () => {
    it('replaces all packages', () => {
      checker.setPackage({ name: 'old:pkg', version: '1.0.0', installed: true });
      checker.setPackages([
        { name: 'arduino:avr', version: '1.8.6', installed: true },
        { name: 'esp32:esp32', version: '2.0.0', installed: true },
      ]);
      expect(checker.getPackage('old:pkg')).toBeUndefined();
      expect(checker.getAllPackages()).toHaveLength(2);
    });

    it('notifies subscribers once', () => {
      const cb = vi.fn();
      checker.subscribe(cb);
      cb.mockClear();
      checker.setPackages([
        { name: 'arduino:avr', version: '1.8.6', installed: true },
      ]);
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // getInstalledPackages
  // -----------------------------------------------------------------------

  describe('getInstalledPackages', () => {
    it('returns only installed packages', () => {
      checker.setPackage({ name: 'arduino:avr', version: '1.8.6', installed: true });
      checker.setPackage({ name: 'esp32:esp32', version: '', installed: false });
      checker.setPackage({ name: 'rp2040:rp2040', version: '3.0.0', installed: true });
      const installed = checker.getInstalledPackages();
      expect(installed).toHaveLength(2);
      expect(installed.map((p) => p.name).sort()).toEqual(['arduino:avr', 'rp2040:rp2040']);
    });

    it('returns empty array when nothing is installed', () => {
      checker.setPackage({ name: 'arduino:avr', version: '', installed: false });
      expect(checker.getInstalledPackages()).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // isPackageInstalled (by FQBN)
  // -----------------------------------------------------------------------

  describe('isPackageInstalled', () => {
    it('returns true for installed package matching FQBN prefix', () => {
      checker.setPackage({ name: 'arduino:avr', version: '1.8.6', installed: true });
      expect(checker.isPackageInstalled('arduino:avr:uno')).toBe(true);
    });

    it('returns false for uninstalled package', () => {
      checker.setPackage({ name: 'arduino:avr', version: '', installed: false });
      expect(checker.isPackageInstalled('arduino:avr:uno')).toBe(false);
    });

    it('returns false for unknown FQBN', () => {
      expect(checker.isPackageInstalled('unknown:arch:board')).toBe(false);
    });

    it('returns false for FQBN with fewer than 2 segments', () => {
      expect(checker.isPackageInstalled('nocolon')).toBe(false);
    });

    it('handles FQBN with options segment', () => {
      checker.setPackage({ name: 'esp32:esp32', version: '2.0.0', installed: true });
      expect(checker.isPackageInstalled('esp32:esp32:esp32:DebugLevel=none')).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // getPackageForBoard
  // -----------------------------------------------------------------------

  describe('getPackageForBoard', () => {
    it('finds package for exact board name', () => {
      const result = checker.getPackageForBoard('Arduino Uno');
      expect(result).toBeDefined();
      expect(result?.id).toBe('arduino:avr');
    });

    it('matches case-insensitively', () => {
      const result = checker.getPackageForBoard('arduino uno');
      expect(result).toBeDefined();
      expect(result?.id).toBe('arduino:avr');
    });

    it('matches partial board name', () => {
      const result = checker.getPackageForBoard('ESP32 Dev');
      expect(result).toBeDefined();
      expect(result?.id).toBe('esp32:esp32');
    });

    it('returns undefined for unknown board', () => {
      expect(checker.getPackageForBoard('Totally Unknown Board XYZ')).toBeUndefined();
    });

    it('finds Teensy package', () => {
      const result = checker.getPackageForBoard('Teensy 4.0');
      expect(result).toBeDefined();
      expect(result?.id).toBe('teensy:avr');
    });

    it('finds Raspberry Pi Pico', () => {
      const result = checker.getPackageForBoard('Raspberry Pi Pico');
      expect(result).toBeDefined();
      // Could match rp2040:rp2040 or arduino:mbed_rp2040 depending on order
      expect(result?.boards.some((b) => b.toLowerCase().includes('pico'))).toBe(true);
    });

    it('finds STM32 boards', () => {
      const result = checker.getPackageForBoard('Blue Pill');
      expect(result).toBeDefined();
      expect(result?.id).toContain('stm32');
    });
  });

  // -----------------------------------------------------------------------
  // checkForUpdates
  // -----------------------------------------------------------------------

  describe('checkForUpdates', () => {
    it('identifies packages with available updates', async () => {
      checker.setPackage({ name: 'arduino:avr', version: '1.8.6', installed: true });
      const updatable = await checker.checkForUpdates([
        { name: 'arduino:avr', latestVersion: '1.8.7' },
      ]);
      expect(updatable).toHaveLength(1);
      expect(updatable[0].updateAvailable).toBe(true);
      expect(updatable[0].latestVersion).toBe('1.8.7');
    });

    it('does not flag up-to-date packages', async () => {
      checker.setPackage({ name: 'arduino:avr', version: '1.8.6', installed: true });
      const updatable = await checker.checkForUpdates([
        { name: 'arduino:avr', latestVersion: '1.8.6' },
      ]);
      expect(updatable).toHaveLength(0);
      expect(checker.getPackage('arduino:avr')?.updateAvailable).toBe(false);
    });

    it('does not flag uninstalled packages as updatable', async () => {
      checker.setPackage({ name: 'esp32:esp32', version: '', installed: false });
      const updatable = await checker.checkForUpdates([
        { name: 'esp32:esp32', latestVersion: '3.0.0' },
      ]);
      expect(updatable).toHaveLength(0);
    });

    it('records unknown packages as not installed', async () => {
      await checker.checkForUpdates([
        { name: 'new:pkg', latestVersion: '1.0.0' },
      ]);
      const pkg = checker.getPackage('new:pkg');
      expect(pkg).toBeDefined();
      expect(pkg?.installed).toBe(false);
      expect(pkg?.latestVersion).toBe('1.0.0');
    });

    it('sets checking flag during operation', async () => {
      checker.setPackage({ name: 'arduino:avr', version: '1.8.6', installed: true });
      const states: boolean[] = [];
      checker.subscribe(() => {
        states.push(checker.checking);
      });
      await checker.checkForUpdates([
        { name: 'arduino:avr', latestVersion: '1.8.7' },
      ]);
      // First notification: checking = true, last notification: checking = false
      expect(states[0]).toBe(true);
      expect(states[states.length - 1]).toBe(false);
    });

    it('persists updated state', async () => {
      checker.setPackage({ name: 'arduino:avr', version: '1.8.6', installed: true });
      await checker.checkForUpdates([
        { name: 'arduino:avr', latestVersion: '1.8.7' },
      ]);
      // Verify it was persisted by loading a fresh instance
      BoardPackageChecker.resetInstance();
      const fresh = BoardPackageChecker.getInstance();
      expect(fresh.getPackage('arduino:avr')?.updateAvailable).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // getUpdatablePackages
  // -----------------------------------------------------------------------

  describe('getUpdatablePackages', () => {
    it('returns only packages with updateAvailable', async () => {
      checker.setPackage({ name: 'arduino:avr', version: '1.8.6', installed: true });
      checker.setPackage({ name: 'esp32:esp32', version: '2.0.0', installed: true });
      await checker.checkForUpdates([
        { name: 'arduino:avr', latestVersion: '1.8.7' },
        { name: 'esp32:esp32', latestVersion: '2.0.0' },
      ]);
      const updatable = checker.getUpdatablePackages();
      expect(updatable).toHaveLength(1);
      expect(updatable[0].name).toBe('arduino:avr');
    });
  });

  // -----------------------------------------------------------------------
  // removePackage
  // -----------------------------------------------------------------------

  describe('removePackage', () => {
    it('removes an existing package and returns true', () => {
      checker.setPackage({ name: 'arduino:avr', version: '1.8.6', installed: true });
      expect(checker.removePackage('arduino:avr')).toBe(true);
      expect(checker.getPackage('arduino:avr')).toBeUndefined();
    });

    it('returns false for non-existent package', () => {
      expect(checker.removePackage('nonexistent:pkg')).toBe(false);
    });

    it('notifies subscribers on removal', () => {
      checker.setPackage({ name: 'arduino:avr', version: '1.8.6', installed: true });
      const cb = vi.fn();
      checker.subscribe(cb);
      cb.mockClear();
      checker.removePackage('arduino:avr');
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('does not notify when nothing was removed', () => {
      const cb = vi.fn();
      checker.subscribe(cb);
      cb.mockClear();
      checker.removePackage('nonexistent:pkg');
      expect(cb).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // clearAll
  // -----------------------------------------------------------------------

  describe('clearAll', () => {
    it('removes all packages', () => {
      checker.setPackage({ name: 'arduino:avr', version: '1.8.6', installed: true });
      checker.setPackage({ name: 'esp32:esp32', version: '2.0.0', installed: true });
      checker.clearAll();
      expect(checker.getAllPackages()).toHaveLength(0);
    });

    it('is a no-op when already empty', () => {
      const cb = vi.fn();
      checker.subscribe(cb);
      cb.mockClear();
      checker.clearAll();
      expect(cb).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  describe('subscribe', () => {
    it('returns an unsubscribe function', () => {
      const cb = vi.fn();
      const unsub = checker.subscribe(cb);
      checker.setPackage({ name: 'arduino:avr', version: '1.0.0', installed: true });
      expect(cb).toHaveBeenCalledTimes(1);

      unsub();
      checker.setPackage({ name: 'esp32:esp32', version: '2.0.0', installed: true });
      expect(cb).toHaveBeenCalledTimes(1); // Not called again
    });

    it('supports multiple subscribers', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      checker.subscribe(cb1);
      checker.subscribe(cb2);
      checker.setPackage({ name: 'arduino:avr', version: '1.0.0', installed: true });
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  describe('persistence', () => {
    it('loads persisted data on construction', () => {
      checker.setPackage({ name: 'arduino:avr', version: '1.8.6', installed: true });
      BoardPackageChecker.resetInstance();
      const fresh = BoardPackageChecker.getInstance();
      expect(fresh.getPackage('arduino:avr')?.version).toBe('1.8.6');
    });

    it('handles corrupt localStorage gracefully', () => {
      (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('not-json{{{');
      BoardPackageChecker.resetInstance();
      const fresh = BoardPackageChecker.getInstance();
      expect(fresh.getAllPackages()).toHaveLength(0);
    });

    it('handles non-array localStorage data gracefully', () => {
      (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('"string"');
      BoardPackageChecker.resetInstance();
      const fresh = BoardPackageChecker.getInstance();
      expect(fresh.getAllPackages()).toHaveLength(0);
    });

    it('skips entries with missing required fields', () => {
      const data = [
        { name: 'valid:pkg', version: '1.0.0', installed: true },
        { name: '', version: '1.0.0', installed: true },  // empty name
        { name: 'no-version', installed: true },            // missing version
        { name: 'no-installed', version: '1.0.0' },        // missing installed
        null,                                               // null entry
        42,                                                 // wrong type
      ];
      (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(data));
      BoardPackageChecker.resetInstance();
      const fresh = BoardPackageChecker.getInstance();
      expect(fresh.getAllPackages()).toHaveLength(1);
      expect(fresh.getPackage('valid:pkg')).toBeDefined();
    });

    it('preserves optional fields in persistence', () => {
      checker.setPackage({
        name: 'arduino:avr',
        version: '1.8.6',
        installed: true,
        latestVersion: '1.8.7',
        updateAvailable: true,
      });
      BoardPackageChecker.resetInstance();
      const fresh = BoardPackageChecker.getInstance();
      const pkg = fresh.getPackage('arduino:avr');
      expect(pkg?.latestVersion).toBe('1.8.7');
      expect(pkg?.updateAvailable).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// compareVersions
// ---------------------------------------------------------------------------

describe('compareVersions', () => {
  it('returns 0 for equal versions', () => {
    expect(compareVersions('1.8.6', '1.8.6')).toBe(0);
  });

  it('returns -1 when a < b', () => {
    expect(compareVersions('1.8.6', '1.8.7')).toBe(-1);
  });

  it('returns 1 when a > b', () => {
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
  });

  it('handles different segment counts', () => {
    expect(compareVersions('1.8', '1.8.0')).toBe(0);
    expect(compareVersions('1.8', '1.8.1')).toBe(-1);
  });

  it('handles single-segment versions', () => {
    expect(compareVersions('2', '1')).toBe(1);
  });

  it('handles major version differences', () => {
    expect(compareVersions('2.0.0', '1.99.99')).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// KNOWN_PACKAGES registry
// ---------------------------------------------------------------------------

describe('KNOWN_PACKAGES', () => {
  it('contains at least 10 entries', () => {
    expect(KNOWN_PACKAGES.length).toBeGreaterThanOrEqual(10);
  });

  it('has unique IDs', () => {
    const ids = KNOWN_PACKAGES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry has non-empty label and boards', () => {
    for (const entry of KNOWN_PACKAGES) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.boards.length).toBeGreaterThan(0);
    }
  });

  it('includes arduino:avr', () => {
    expect(KNOWN_PACKAGES.find((p) => p.id === 'arduino:avr')).toBeDefined();
  });

  it('includes esp32:esp32', () => {
    expect(KNOWN_PACKAGES.find((p) => p.id === 'esp32:esp32')).toBeDefined();
  });

  it('includes rp2040:rp2040', () => {
    expect(KNOWN_PACKAGES.find((p) => p.id === 'rp2040:rp2040')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// usePackageChecker hook
// ---------------------------------------------------------------------------

describe('usePackageChecker', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    BoardPackageChecker.resetInstance();
  });

  afterEach(() => {
    BoardPackageChecker.resetInstance();
  });

  it('returns empty arrays initially', () => {
    const { result } = renderHook(() => usePackageChecker());
    expect(result.current.packages).toEqual([]);
    expect(result.current.installed).toEqual([]);
    expect(result.current.updatable).toEqual([]);
    expect(result.current.checking).toBe(false);
  });

  it('reflects setPackage mutations', () => {
    const { result } = renderHook(() => usePackageChecker());
    act(() => {
      result.current.setPackage({ name: 'arduino:avr', version: '1.8.6', installed: true });
    });
    expect(result.current.packages).toHaveLength(1);
    expect(result.current.installed).toHaveLength(1);
  });

  it('reflects setPackages bulk mutation', () => {
    const { result } = renderHook(() => usePackageChecker());
    act(() => {
      result.current.setPackages([
        { name: 'arduino:avr', version: '1.8.6', installed: true },
        { name: 'esp32:esp32', version: '2.0.0', installed: false },
      ]);
    });
    expect(result.current.packages).toHaveLength(2);
    expect(result.current.installed).toHaveLength(1);
  });

  it('isInstalled delegates to checker', () => {
    const { result } = renderHook(() => usePackageChecker());
    act(() => {
      result.current.setPackage({ name: 'arduino:avr', version: '1.8.6', installed: true });
    });
    expect(result.current.isInstalled('arduino:avr:uno')).toBe(true);
    expect(result.current.isInstalled('esp32:esp32:esp32')).toBe(false);
  });

  it('getPackageForBoard delegates to checker', () => {
    const { result } = renderHook(() => usePackageChecker());
    const entry = result.current.getPackageForBoard('Arduino Uno');
    expect(entry).toBeDefined();
    expect(entry?.id).toBe('arduino:avr');
  });

  it('clearAll empties all packages', () => {
    const { result } = renderHook(() => usePackageChecker());
    act(() => {
      result.current.setPackage({ name: 'arduino:avr', version: '1.8.6', installed: true });
    });
    expect(result.current.packages).toHaveLength(1);
    act(() => {
      result.current.clearAll();
    });
    expect(result.current.packages).toHaveLength(0);
  });
});
