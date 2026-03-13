import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  BoardSettingsManager,
  BUILT_IN_PRESETS,
  PROGRAMMERS,
  UPLOAD_SPEEDS,
  validateFqbn,
  getBoardSettingsManager,
  resetBoardSettingsManager,
} from '../board-settings';
import type { BoardPreset, BoardSettings, BoardSettingsExport } from '../board-settings';

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
  resetBoardSettingsManager();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createManager(): BoardSettingsManager {
  return BoardSettingsManager.create();
}

function makeCustomPreset(overrides?: Partial<BoardPreset>): BoardPreset {
  return {
    fqbn: 'custom:avr:myboard',
    name: 'My Custom Board',
    platform: 'Custom',
    arch: 'avr',
    ...overrides,
  };
}

// ===========================================================================
// BUILT_IN_PRESETS
// ===========================================================================

describe('BUILT_IN_PRESETS', () => {
  it('contains at least 15 presets', () => {
    expect(BUILT_IN_PRESETS.length).toBeGreaterThanOrEqual(15);
  });

  it('every preset has a valid FQBN', () => {
    for (const preset of BUILT_IN_PRESETS) {
      expect(validateFqbn(preset.fqbn)).toBe(true);
    }
  });

  it('every preset has a non-empty name', () => {
    for (const preset of BUILT_IN_PRESETS) {
      expect(preset.name.trim().length).toBeGreaterThan(0);
    }
  });

  it('every preset has a platform and arch', () => {
    for (const preset of BUILT_IN_PRESETS) {
      expect(preset.platform.length).toBeGreaterThan(0);
      expect(preset.arch.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate FQBNs', () => {
    const fqbns = BUILT_IN_PRESETS.map((p) => p.fqbn);
    expect(new Set(fqbns).size).toBe(fqbns.length);
  });

  it('includes Arduino Uno', () => {
    expect(BUILT_IN_PRESETS.find((p) => p.fqbn === 'arduino:avr:uno')).toBeDefined();
  });

  it('includes ESP32', () => {
    expect(BUILT_IN_PRESETS.find((p) => p.fqbn === 'esp32:esp32:esp32')).toBeDefined();
  });

  it('includes Raspberry Pi Pico', () => {
    expect(BUILT_IN_PRESETS.find((p) => p.fqbn === 'rp2040:rp2040:rpipico')).toBeDefined();
  });
});

// ===========================================================================
// PROGRAMMERS & UPLOAD_SPEEDS constants
// ===========================================================================

describe('PROGRAMMERS', () => {
  it('contains at least 8 programmer identifiers', () => {
    expect(PROGRAMMERS.length).toBeGreaterThanOrEqual(8);
  });

  it('includes default and usbasp', () => {
    expect(PROGRAMMERS).toContain('default');
    expect(PROGRAMMERS).toContain('usbasp');
  });
});

describe('UPLOAD_SPEEDS', () => {
  it('contains at least 7 speed values', () => {
    expect(UPLOAD_SPEEDS.length).toBeGreaterThanOrEqual(7);
  });

  it('includes 9600, 115200, and 921600', () => {
    expect(UPLOAD_SPEEDS).toContain(9600);
    expect(UPLOAD_SPEEDS).toContain(115200);
    expect(UPLOAD_SPEEDS).toContain(921600);
  });

  it('is sorted in ascending order', () => {
    for (let i = 1; i < UPLOAD_SPEEDS.length; i++) {
      expect(UPLOAD_SPEEDS[i]).toBeGreaterThan(UPLOAD_SPEEDS[i - 1]);
    }
  });
});

// ===========================================================================
// validateFqbn
// ===========================================================================

describe('validateFqbn', () => {
  it('accepts valid 3-part FQBN', () => {
    expect(validateFqbn('arduino:avr:uno')).toBe(true);
  });

  it('accepts 4-part FQBN with options', () => {
    expect(validateFqbn('esp32:esp32:esp32:UploadSpeed=921600')).toBe(true);
  });

  it('accepts FQBNs with hyphens and underscores', () => {
    expect(validateFqbn('my-vendor:my_arch:board-1')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(validateFqbn('')).toBe(false);
  });

  it('rejects single segment', () => {
    expect(validateFqbn('arduino')).toBe(false);
  });

  it('rejects two segments', () => {
    expect(validateFqbn('arduino:avr')).toBe(false);
  });

  it('rejects FQBN with spaces', () => {
    expect(validateFqbn('arduino:avr:uno mega')).toBe(false);
  });

  it('rejects FQBN with special characters', () => {
    expect(validateFqbn('arduino:avr:uno!')).toBe(false);
  });
});

// ===========================================================================
// BoardSettingsManager — Defaults
// ===========================================================================

describe('BoardSettingsManager — defaults', () => {
  it('creates with default settings (Uno, default programmer, 115200)', () => {
    const mgr = createManager();
    const settings = mgr.getCurrentSettings();
    expect(settings.selectedFqbn).toBe('arduino:avr:uno');
    expect(settings.programmer).toBe('default');
    expect(settings.uploadSpeed).toBe(115200);
    expect(settings.extraFlags).toBe('');
    expect(settings.customBoards).toEqual([]);
  });

  it('loads settings from localStorage when available', () => {
    const stored: BoardSettings = {
      selectedFqbn: 'esp32:esp32:esp32',
      programmer: 'usbasp',
      uploadSpeed: 921600,
      extraFlags: '-DDEBUG',
      customBoards: [],
    };
    localStorageStore['protopulse-board-settings'] = JSON.stringify(stored);

    const mgr = createManager();
    const settings = mgr.getCurrentSettings();
    expect(settings.selectedFqbn).toBe('esp32:esp32:esp32');
    expect(settings.programmer).toBe('usbasp');
    expect(settings.uploadSpeed).toBe(921600);
    expect(settings.extraFlags).toBe('-DDEBUG');
  });

  it('falls back to defaults on invalid JSON in localStorage', () => {
    localStorageStore['protopulse-board-settings'] = 'not-json{';
    const mgr = createManager();
    expect(mgr.getCurrentSettings().selectedFqbn).toBe('arduino:avr:uno');
  });

  it('falls back to defaults on invalid FQBN in localStorage', () => {
    localStorageStore['protopulse-board-settings'] = JSON.stringify({ selectedFqbn: 'bad' });
    const mgr = createManager();
    expect(mgr.getCurrentSettings().selectedFqbn).toBe('arduino:avr:uno');
  });

  it('falls back to defaults when localStorage value is non-object', () => {
    localStorageStore['protopulse-board-settings'] = JSON.stringify(42);
    const mgr = createManager();
    expect(mgr.getCurrentSettings().selectedFqbn).toBe('arduino:avr:uno');
  });
});

// ===========================================================================
// selectBoard
// ===========================================================================

describe('BoardSettingsManager — selectBoard', () => {
  it('changes selectedFqbn', () => {
    const mgr = createManager();
    mgr.selectBoard('arduino:avr:mega');
    expect(mgr.getCurrentSettings().selectedFqbn).toBe('arduino:avr:mega');
  });

  it('applies preset upload speed when selecting a known board', () => {
    const mgr = createManager();
    mgr.selectBoard('esp32:esp32:esp32');
    expect(mgr.getCurrentSettings().uploadSpeed).toBe(921600);
  });

  it('applies preset programmer when selecting a board that has one', () => {
    const mgr = createManager();
    mgr.selectBoard('arduino:sam:arduino_due_x');
    expect(mgr.getCurrentSettings().programmer).toBe('arduino');
  });

  it('does not change settings for invalid FQBN', () => {
    const mgr = createManager();
    mgr.selectBoard('invalid');
    expect(mgr.getCurrentSettings().selectedFqbn).toBe('arduino:avr:uno');
  });

  it('persists to localStorage', () => {
    const mgr = createManager();
    mgr.selectBoard('arduino:avr:mega');
    const stored = JSON.parse(localStorageStore['protopulse-board-settings'] ?? '{}') as Record<string, unknown>;
    expect(stored.selectedFqbn).toBe('arduino:avr:mega');
  });
});

// ===========================================================================
// setProgrammer / setUploadSpeed / setExtraFlags
// ===========================================================================

describe('BoardSettingsManager — setProgrammer', () => {
  it('sets the programmer', () => {
    const mgr = createManager();
    mgr.setProgrammer('usbasp');
    expect(mgr.getCurrentSettings().programmer).toBe('usbasp');
  });

  it('allows empty string programmer', () => {
    const mgr = createManager();
    mgr.setProgrammer('');
    expect(mgr.getCurrentSettings().programmer).toBe('');
  });
});

describe('BoardSettingsManager — setUploadSpeed', () => {
  it('sets the upload speed', () => {
    const mgr = createManager();
    mgr.setUploadSpeed(921600);
    expect(mgr.getCurrentSettings().uploadSpeed).toBe(921600);
  });

  it('rounds non-integer speeds', () => {
    const mgr = createManager();
    mgr.setUploadSpeed(115200.7);
    expect(mgr.getCurrentSettings().uploadSpeed).toBe(115201);
  });

  it('ignores zero speed', () => {
    const mgr = createManager();
    mgr.setUploadSpeed(0);
    expect(mgr.getCurrentSettings().uploadSpeed).toBe(115200); // unchanged default
  });

  it('ignores negative speed', () => {
    const mgr = createManager();
    mgr.setUploadSpeed(-9600);
    expect(mgr.getCurrentSettings().uploadSpeed).toBe(115200);
  });

  it('ignores NaN', () => {
    const mgr = createManager();
    mgr.setUploadSpeed(NaN);
    expect(mgr.getCurrentSettings().uploadSpeed).toBe(115200);
  });

  it('ignores Infinity', () => {
    const mgr = createManager();
    mgr.setUploadSpeed(Infinity);
    expect(mgr.getCurrentSettings().uploadSpeed).toBe(115200);
  });
});

describe('BoardSettingsManager — setExtraFlags', () => {
  it('sets extra compiler flags', () => {
    const mgr = createManager();
    mgr.setExtraFlags('-DDEBUG -Os');
    expect(mgr.getCurrentSettings().extraFlags).toBe('-DDEBUG -Os');
  });

  it('allows empty flags', () => {
    const mgr = createManager();
    mgr.setExtraFlags('-DTEST');
    mgr.setExtraFlags('');
    expect(mgr.getCurrentSettings().extraFlags).toBe('');
  });
});

// ===========================================================================
// Custom boards
// ===========================================================================

describe('BoardSettingsManager — addCustomBoard', () => {
  it('adds a custom board', () => {
    const mgr = createManager();
    const result = mgr.addCustomBoard(makeCustomPreset());
    expect(result).toBe(true);
    expect(mgr.getCurrentSettings().customBoards).toHaveLength(1);
    expect(mgr.getCurrentSettings().customBoards[0].fqbn).toBe('custom:avr:myboard');
  });

  it('rejects custom board with invalid FQBN', () => {
    const mgr = createManager();
    const result = mgr.addCustomBoard(makeCustomPreset({ fqbn: 'bad' }));
    expect(result).toBe(false);
    expect(mgr.getCurrentSettings().customBoards).toHaveLength(0);
  });

  it('rejects custom board with empty name', () => {
    const mgr = createManager();
    const result = mgr.addCustomBoard(makeCustomPreset({ name: '  ' }));
    expect(result).toBe(false);
  });

  it('rejects duplicate FQBN (built-in)', () => {
    const mgr = createManager();
    const result = mgr.addCustomBoard(makeCustomPreset({ fqbn: 'arduino:avr:uno' }));
    expect(result).toBe(false);
  });

  it('rejects duplicate FQBN (already custom)', () => {
    const mgr = createManager();
    mgr.addCustomBoard(makeCustomPreset());
    const result = mgr.addCustomBoard(makeCustomPreset({ name: 'Duplicate' }));
    expect(result).toBe(false);
    expect(mgr.getCurrentSettings().customBoards).toHaveLength(1);
  });

  it('persists custom boards to localStorage', () => {
    const mgr = createManager();
    mgr.addCustomBoard(makeCustomPreset());
    const stored = JSON.parse(localStorageStore['protopulse-board-settings'] ?? '{}') as Record<string, unknown>;
    expect(Array.isArray(stored.customBoards)).toBe(true);
    expect((stored.customBoards as BoardPreset[]).length).toBe(1);
  });
});

describe('BoardSettingsManager — removeCustomBoard', () => {
  it('removes a custom board', () => {
    const mgr = createManager();
    mgr.addCustomBoard(makeCustomPreset());
    const result = mgr.removeCustomBoard('custom:avr:myboard');
    expect(result).toBe(true);
    expect(mgr.getCurrentSettings().customBoards).toHaveLength(0);
  });

  it('returns false for non-existent FQBN', () => {
    const mgr = createManager();
    expect(mgr.removeCustomBoard('nope:nope:nope')).toBe(false);
  });

  it('reverts to default FQBN if the removed board was selected', () => {
    const mgr = createManager();
    mgr.addCustomBoard(makeCustomPreset());
    mgr.selectBoard('custom:avr:myboard');
    mgr.removeCustomBoard('custom:avr:myboard');
    expect(mgr.getCurrentSettings().selectedFqbn).toBe('arduino:avr:uno');
  });

  it('does not change selected FQBN if a different board was removed', () => {
    const mgr = createManager();
    mgr.addCustomBoard(makeCustomPreset());
    mgr.addCustomBoard(makeCustomPreset({ fqbn: 'custom:avr:other', name: 'Other' }));
    mgr.selectBoard('custom:avr:myboard');
    mgr.removeCustomBoard('custom:avr:other');
    expect(mgr.getCurrentSettings().selectedFqbn).toBe('custom:avr:myboard');
  });
});

// ===========================================================================
// getPresets / getPresetsByPlatform / findPreset / getSelectedPreset
// ===========================================================================

describe('BoardSettingsManager — getPresets', () => {
  it('returns built-in presets when no custom boards', () => {
    const mgr = createManager();
    expect(mgr.getPresets().length).toBe(BUILT_IN_PRESETS.length);
  });

  it('includes custom boards after built-in', () => {
    const mgr = createManager();
    mgr.addCustomBoard(makeCustomPreset());
    expect(mgr.getPresets().length).toBe(BUILT_IN_PRESETS.length + 1);
  });
});

describe('BoardSettingsManager — getPresetsByPlatform', () => {
  it('groups presets by platform', () => {
    const mgr = createManager();
    const map = mgr.getPresetsByPlatform();
    // Arduino AVR should have at least 5 boards
    const avrBoards = map.get('Arduino AVR');
    expect(avrBoards).toBeDefined();
    expect(avrBoards!.length).toBeGreaterThanOrEqual(5);
  });

  it('includes custom boards in their platform group', () => {
    const mgr = createManager();
    mgr.addCustomBoard(makeCustomPreset({ platform: 'Custom Vendor' }));
    const map = mgr.getPresetsByPlatform();
    expect(map.get('Custom Vendor')).toHaveLength(1);
  });
});

describe('BoardSettingsManager — findPreset', () => {
  it('finds a built-in preset', () => {
    const mgr = createManager();
    const found = mgr.findPreset('arduino:avr:uno');
    expect(found).toBeDefined();
    expect(found!.name).toBe('Arduino Uno');
  });

  it('finds a custom preset', () => {
    const mgr = createManager();
    mgr.addCustomBoard(makeCustomPreset());
    const found = mgr.findPreset('custom:avr:myboard');
    expect(found).toBeDefined();
    expect(found!.name).toBe('My Custom Board');
  });

  it('returns undefined for unknown FQBN', () => {
    const mgr = createManager();
    expect(mgr.findPreset('nope:nope:nope')).toBeUndefined();
  });
});

describe('BoardSettingsManager — getSelectedPreset', () => {
  it('returns Uno preset by default', () => {
    const mgr = createManager();
    const preset = mgr.getSelectedPreset();
    expect(preset).toBeDefined();
    expect(preset!.fqbn).toBe('arduino:avr:uno');
  });

  it('returns the selected preset after selectBoard', () => {
    const mgr = createManager();
    mgr.selectBoard('esp32:esp32:esp32');
    const preset = mgr.getSelectedPreset();
    expect(preset).toBeDefined();
    expect(preset!.name).toBe('ESP32 Dev Module');
  });
});

// ===========================================================================
// Subscribe / getSnapshot
// ===========================================================================

describe('BoardSettingsManager — subscribe / getSnapshot', () => {
  it('notifies listeners on setting changes', () => {
    const mgr = createManager();
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.selectBoard('arduino:avr:mega');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe stops notifications', () => {
    const mgr = createManager();
    const listener = vi.fn();
    const unsub = mgr.subscribe(listener);
    unsub();
    mgr.selectBoard('arduino:avr:mega');
    expect(listener).not.toHaveBeenCalled();
  });

  it('getSnapshot returns current state', () => {
    const mgr = createManager();
    const snap1 = mgr.getSnapshot();
    expect(snap1.selectedFqbn).toBe('arduino:avr:uno');
    mgr.selectBoard('arduino:avr:mega');
    const snap2 = mgr.getSnapshot();
    expect(snap2.selectedFqbn).toBe('arduino:avr:mega');
  });

  it('getSnapshot returns a new object reference after mutation', () => {
    const mgr = createManager();
    const snap1 = mgr.getSnapshot();
    mgr.setProgrammer('usbasp');
    const snap2 = mgr.getSnapshot();
    expect(snap1).not.toBe(snap2);
  });

  it('multiple listeners all get notified', () => {
    const mgr = createManager();
    const l1 = vi.fn();
    const l2 = vi.fn();
    mgr.subscribe(l1);
    mgr.subscribe(l2);
    mgr.setExtraFlags('-DTEST');
    expect(l1).toHaveBeenCalledTimes(1);
    expect(l2).toHaveBeenCalledTimes(1);
  });

  it('notifies on addCustomBoard', () => {
    const mgr = createManager();
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.addCustomBoard(makeCustomPreset());
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies on removeCustomBoard', () => {
    const mgr = createManager();
    mgr.addCustomBoard(makeCustomPreset());
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.removeCustomBoard('custom:avr:myboard');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// Export / Import
// ===========================================================================

describe('BoardSettingsManager — exportSettings', () => {
  it('exports valid JSON with version and settings', () => {
    const mgr = createManager();
    mgr.selectBoard('esp32:esp32:esp32');
    mgr.setExtraFlags('-Os');
    const json = mgr.exportSettings();
    const parsed = JSON.parse(json) as BoardSettingsExport;
    expect(parsed.version).toBe(1);
    expect(parsed.settings.selectedFqbn).toBe('esp32:esp32:esp32');
    expect(parsed.settings.extraFlags).toBe('-Os');
  });

  it('includes custom boards in export', () => {
    const mgr = createManager();
    mgr.addCustomBoard(makeCustomPreset());
    const json = mgr.exportSettings();
    const parsed = JSON.parse(json) as BoardSettingsExport;
    expect(parsed.settings.customBoards).toHaveLength(1);
  });
});

describe('BoardSettingsManager — importSettings', () => {
  it('imports valid settings', () => {
    const mgr = createManager();
    const data: BoardSettingsExport = {
      version: 1,
      settings: {
        selectedFqbn: 'arduino:avr:nano',
        programmer: 'avrisp',
        uploadSpeed: 57600,
        extraFlags: '-Wall',
        customBoards: [makeCustomPreset()],
      },
    };
    const result = mgr.importSettings(JSON.stringify(data));
    expect(result).toBe(true);
    expect(mgr.getCurrentSettings().selectedFqbn).toBe('arduino:avr:nano');
    expect(mgr.getCurrentSettings().programmer).toBe('avrisp');
    expect(mgr.getCurrentSettings().uploadSpeed).toBe(57600);
    expect(mgr.getCurrentSettings().extraFlags).toBe('-Wall');
    expect(mgr.getCurrentSettings().customBoards).toHaveLength(1);
  });

  it('rejects invalid JSON', () => {
    const mgr = createManager();
    expect(mgr.importSettings('not-json')).toBe(false);
  });

  it('rejects wrong version', () => {
    const mgr = createManager();
    expect(mgr.importSettings(JSON.stringify({ version: 99, settings: {} }))).toBe(false);
  });

  it('rejects missing settings object', () => {
    const mgr = createManager();
    expect(mgr.importSettings(JSON.stringify({ version: 1 }))).toBe(false);
  });

  it('rejects non-object root', () => {
    const mgr = createManager();
    expect(mgr.importSettings(JSON.stringify(42))).toBe(false);
  });

  it('rejects invalid FQBN in import', () => {
    const mgr = createManager();
    const data = { version: 1, settings: { selectedFqbn: 'bad fqbn!' } };
    expect(mgr.importSettings(JSON.stringify(data))).toBe(false);
  });

  it('uses defaults for missing fields in import', () => {
    const mgr = createManager();
    const data = { version: 1, settings: { selectedFqbn: 'arduino:avr:mega' } };
    expect(mgr.importSettings(JSON.stringify(data))).toBe(true);
    expect(mgr.getCurrentSettings().programmer).toBe('default');
    expect(mgr.getCurrentSettings().uploadSpeed).toBe(115200);
    expect(mgr.getCurrentSettings().extraFlags).toBe('');
    expect(mgr.getCurrentSettings().customBoards).toEqual([]);
  });

  it('notifies listeners on import', () => {
    const mgr = createManager();
    const listener = vi.fn();
    mgr.subscribe(listener);
    const data: BoardSettingsExport = {
      version: 1,
      settings: {
        selectedFqbn: 'arduino:avr:mega',
        programmer: 'default',
        uploadSpeed: 115200,
        extraFlags: '',
        customBoards: [],
      },
    };
    mgr.importSettings(JSON.stringify(data));
    expect(listener).toHaveBeenCalled();
  });

  it('filters out invalid custom boards during import', () => {
    const mgr = createManager();
    const data = {
      version: 1,
      settings: {
        selectedFqbn: 'arduino:avr:uno',
        customBoards: [
          makeCustomPreset(),
          { fqbn: 'bad', name: 'Bad' }, // invalid FQBN
          { fqbn: 'ok:ok:ok', name: '' }, // empty name
        ],
      },
    };
    mgr.importSettings(JSON.stringify(data));
    expect(mgr.getCurrentSettings().customBoards).toHaveLength(1);
  });
});

// ===========================================================================
// reset
// ===========================================================================

describe('BoardSettingsManager — reset', () => {
  it('resets to defaults', () => {
    const mgr = createManager();
    mgr.selectBoard('esp32:esp32:esp32');
    mgr.setProgrammer('usbasp');
    mgr.setExtraFlags('-DTEST');
    mgr.addCustomBoard(makeCustomPreset());
    mgr.reset();
    const settings = mgr.getCurrentSettings();
    expect(settings.selectedFqbn).toBe('arduino:avr:uno');
    expect(settings.programmer).toBe('default');
    expect(settings.uploadSpeed).toBe(115200);
    expect(settings.extraFlags).toBe('');
    expect(settings.customBoards).toEqual([]);
  });

  it('notifies listeners on reset', () => {
    const mgr = createManager();
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.reset();
    expect(listener).toHaveBeenCalled();
  });

  it('persists reset to localStorage', () => {
    const mgr = createManager();
    mgr.selectBoard('esp32:esp32:esp32');
    mgr.reset();
    const stored = JSON.parse(localStorageStore['protopulse-board-settings'] ?? '{}') as Record<string, unknown>;
    expect(stored.selectedFqbn).toBe('arduino:avr:uno');
  });
});

// ===========================================================================
// Singleton
// ===========================================================================

describe('getBoardSettingsManager / resetBoardSettingsManager', () => {
  it('returns a singleton instance', () => {
    const a = getBoardSettingsManager();
    const b = getBoardSettingsManager();
    expect(a).toBe(b);
  });

  it('resetBoardSettingsManager clears the singleton', () => {
    const a = getBoardSettingsManager();
    resetBoardSettingsManager();
    const b = getBoardSettingsManager();
    expect(a).not.toBe(b);
  });
});

// ===========================================================================
// localStorage edge cases
// ===========================================================================

describe('BoardSettingsManager — localStorage edge cases', () => {
  it('handles localStorage.getItem throwing', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => { throw new Error('quota'); }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
    const mgr = createManager();
    expect(mgr.getCurrentSettings().selectedFqbn).toBe('arduino:avr:uno');
  });

  it('handles localStorage.setItem throwing gracefully', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => { throw new Error('quota exceeded'); }),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
    const mgr = createManager();
    // Should not throw
    expect(() => mgr.selectBoard('arduino:avr:mega')).not.toThrow();
    expect(mgr.getCurrentSettings().selectedFqbn).toBe('arduino:avr:mega');
  });

  it('loads custom boards from localStorage', () => {
    const stored: BoardSettings = {
      selectedFqbn: 'custom:avr:myboard',
      programmer: 'default',
      uploadSpeed: 115200,
      extraFlags: '',
      customBoards: [makeCustomPreset()],
    };
    localStorageStore['protopulse-board-settings'] = JSON.stringify(stored);
    const mgr = createManager();
    expect(mgr.getCurrentSettings().customBoards).toHaveLength(1);
    expect(mgr.getCurrentSettings().customBoards[0].name).toBe('My Custom Board');
  });

  it('skips invalid entries in customBoards array from localStorage', () => {
    const stored = {
      selectedFqbn: 'arduino:avr:uno',
      programmer: 'default',
      uploadSpeed: 115200,
      extraFlags: '',
      customBoards: [
        makeCustomPreset(),
        null,
        { fqbn: 'bad', name: 'Nope' },
        42,
        { fqbn: 'ok:ok:ok', name: '', platform: 'X', arch: 'y' },
      ],
    };
    localStorageStore['protopulse-board-settings'] = JSON.stringify(stored);
    const mgr = createManager();
    expect(mgr.getCurrentSettings().customBoards).toHaveLength(1);
  });
});
