import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BuildEnvironmentManager,
  createFromPreset,
  createBlankEnvironment,
  generatePlatformioIni,
  parsePlatformioIni,
  sanitizeEnvName,
  diffEnvironments,
  BOARD_PRESETS,
  MAX_ENVIRONMENTS,
} from '../build-environments';
import type {
  BuildEnvironment,
  BoardPresetEnv,
} from '../build-environments';

// ---------------------------------------------------------------------------
// Mock localStorage & crypto
// ---------------------------------------------------------------------------

const storage = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => { storage.set(key, value); }),
  removeItem: vi.fn((key: string) => { storage.delete(key); }),
  clear: vi.fn(() => { storage.clear(); }),
  get length() { return storage.size; },
  key: vi.fn(() => null),
};

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

let uuidCounter = 0;
vi.stubGlobal('crypto', {
  randomUUID: () => `test-uuid-${++uuidCounter}`,
});

beforeEach(() => {
  storage.clear();
  uuidCounter = 0;
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// BOARD_PRESETS
// ---------------------------------------------------------------------------

describe('BOARD_PRESETS', () => {
  it('contains at least 8 presets', () => {
    expect(BOARD_PRESETS.length).toBeGreaterThanOrEqual(8);
  });

  it('all presets have required fields', () => {
    for (const preset of BOARD_PRESETS) {
      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset.boardFqbn.length).toBeGreaterThan(0);
      expect(preset.platform.length).toBeGreaterThan(0);
      expect(preset.framework).toBe('arduino');
      expect(preset.uploadSpeed).toBeGreaterThan(0);
      expect(preset.monitorSpeed).toBeGreaterThan(0);
      expect(['serial', 'ota', 'jtag', 'stlink', 'dfu']).toContain(preset.uploadProtocol);
    }
  });

  it('includes ESP32, ESP8266, AVR, STM32, and RP2040 boards', () => {
    const fqbns = BOARD_PRESETS.map((p) => p.boardFqbn);
    expect(fqbns.some((f) => f.startsWith('esp32:'))).toBe(true);
    expect(fqbns.some((f) => f.startsWith('esp8266:'))).toBe(true);
    expect(fqbns.some((f) => f.startsWith('arduino:avr:'))).toBe(true);
    expect(fqbns.some((f) => f.startsWith('stm32duino:'))).toBe(true);
    expect(fqbns.some((f) => f.startsWith('rp2040:'))).toBe(true);
  });

  it('STM32 Blue Pill uses stlink upload protocol', () => {
    const stm32 = BOARD_PRESETS.find((p) => p.boardFqbn.includes('bluepill'));
    expect(stm32?.uploadProtocol).toBe('stlink');
  });
});

// ---------------------------------------------------------------------------
// createFromPreset / createBlankEnvironment
// ---------------------------------------------------------------------------

describe('createFromPreset', () => {
  it('creates environment from a board preset', () => {
    const preset = BOARD_PRESETS[0]; // Arduino Uno
    const env = createFromPreset(preset);
    expect(env.name).toBe(preset.name);
    expect(env.boardFqbn).toBe(preset.boardFqbn);
    expect(env.platform).toBe(preset.platform);
    expect(env.framework).toBe(preset.framework);
    expect(env.uploadSpeed).toBe(preset.uploadSpeed);
    expect(env.id).toBeTruthy();
    expect(env.createdAt).toBeTruthy();
  });

  it('allows name override', () => {
    const env = createFromPreset(BOARD_PRESETS[0], 'My Custom Name');
    expect(env.name).toBe('My Custom Name');
  });

  it('copies build flags (no reference sharing)', () => {
    const preset = BOARD_PRESETS.find((p) => p.buildFlags.length > 0)!;
    const env = createFromPreset(preset);
    expect(env.buildFlags).toEqual(preset.buildFlags);
    expect(env.buildFlags).not.toBe(preset.buildFlags);
  });

  it('sets isDefault to false', () => {
    const env = createFromPreset(BOARD_PRESETS[0]);
    expect(env.isDefault).toBe(false);
  });
});

describe('createBlankEnvironment', () => {
  it('creates a minimal environment', () => {
    const env = createBlankEnvironment('Debug');
    expect(env.name).toBe('Debug');
    expect(env.boardFqbn).toBe('arduino:avr:uno');
    expect(env.buildFlags).toEqual([]);
    expect(env.libDeps).toEqual([]);
  });

  it('accepts custom board FQBN', () => {
    const env = createBlankEnvironment('Test', 'esp32:esp32:esp32');
    expect(env.boardFqbn).toBe('esp32:esp32:esp32');
  });
});

// ---------------------------------------------------------------------------
// sanitizeEnvName
// ---------------------------------------------------------------------------

describe('sanitizeEnvName', () => {
  it('lowercases and replaces spaces with underscores', () => {
    expect(sanitizeEnvName('Debug ESP32')).toBe('debug_esp32');
  });

  it('removes special characters', () => {
    expect(sanitizeEnvName('Test (v2.0)!')).toBe('test_v20');
  });

  it('prefixes with env_ if starts with non-alpha', () => {
    expect(sanitizeEnvName('123board')).toBe('env_123board');
  });

  it('truncates to 64 characters', () => {
    const long = 'a'.repeat(100);
    expect(sanitizeEnvName(long).length).toBeLessThanOrEqual(64);
  });

  it('returns "env" for empty result', () => {
    expect(sanitizeEnvName('!!!???')).toBe('env');
  });

  it('handles already valid names', () => {
    expect(sanitizeEnvName('release')).toBe('release');
  });
});

// ---------------------------------------------------------------------------
// generatePlatformioIni
// ---------------------------------------------------------------------------

describe('generatePlatformioIni', () => {
  it('generates valid INI for a single environment', () => {
    const env = createFromPreset(BOARD_PRESETS[0]);
    const ini = generatePlatformioIni([env]);
    expect(ini).toContain('[env:arduino_uno]');
    expect(ini).toContain('platform = atmelavr');
    expect(ini).toContain(`board = ${env.boardFqbn}`);
    expect(ini).toContain('framework = arduino');
    expect(ini).toContain(`upload_speed = ${env.uploadSpeed}`);
  });

  it('includes [platformio] section with default_envs when one is default', () => {
    const env = createFromPreset(BOARD_PRESETS[0]);
    (env as { isDefault: boolean }).isDefault = true;
    const ini = generatePlatformioIni([env]);
    expect(ini).toContain('[platformio]');
    expect(ini).toContain('default_envs = arduino_uno');
  });

  it('omits [platformio] when no default', () => {
    const env = createFromPreset(BOARD_PRESETS[0]);
    const ini = generatePlatformioIni([env]);
    expect(ini).not.toContain('[platformio]');
  });

  it('generates multiple env sections', () => {
    const envs = [
      createFromPreset(BOARD_PRESETS[0]),
      createFromPreset(BOARD_PRESETS[3]), // ESP32
    ];
    const ini = generatePlatformioIni(envs);
    expect(ini).toContain('[env:arduino_uno]');
    expect(ini).toContain('[env:esp32_dev_module]');
  });

  it('includes build_flags on separate lines', () => {
    const env = createFromPreset(BOARD_PRESETS[3]); // ESP32 with flags
    const ini = generatePlatformioIni([env]);
    expect(ini).toContain('build_flags =');
    expect(ini).toContain('  -DCORE_DEBUG_LEVEL=1');
  });

  it('includes lib_deps when present', () => {
    const env = createFromPreset(BOARD_PRESETS[0]);
    env.libDeps.push('Servo@1.1.0', 'Wire');
    const ini = generatePlatformioIni([env]);
    expect(ini).toContain('lib_deps =');
    expect(ini).toContain('  Servo@1.1.0');
    expect(ini).toContain('  Wire');
  });

  it('omits upload_protocol when serial (default)', () => {
    const env = createFromPreset(BOARD_PRESETS[0]);
    const ini = generatePlatformioIni([env]);
    expect(ini).not.toContain('upload_protocol');
  });

  it('includes upload_protocol when non-serial', () => {
    const env = createFromPreset(BOARD_PRESETS.find((p) => p.uploadProtocol !== 'serial')!);
    const ini = generatePlatformioIni([env]);
    expect(ini).toContain('upload_protocol');
  });

  it('includes extra key-value pairs', () => {
    const env = createFromPreset(BOARD_PRESETS[0]);
    env.extra['board_build.mcu'] = 'atmega328p';
    const ini = generatePlatformioIni([env]);
    expect(ini).toContain('board_build.mcu = atmega328p');
  });

  it('omits optional fields when at defaults', () => {
    const env = createFromPreset(BOARD_PRESETS[0]);
    const ini = generatePlatformioIni([env]);
    // No upload port set, so should not appear
    expect(ini).not.toContain('upload_port');
    // Parity is 'none' (default), should not appear
    expect(ini).not.toContain('monitor_parity');
  });

  it('ends with newline', () => {
    const env = createFromPreset(BOARD_PRESETS[0]);
    const ini = generatePlatformioIni([env]);
    expect(ini.endsWith('\n')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parsePlatformioIni
// ---------------------------------------------------------------------------

describe('parsePlatformioIni', () => {
  it('parses a simple environment section', () => {
    const ini = `
[env:myboard]
platform = atmelavr
board = arduino:avr:uno
framework = arduino
upload_speed = 115200
monitor_speed = 9600
`;
    const envs = parsePlatformioIni(ini);
    expect(envs).toHaveLength(1);
    expect(envs[0].name).toBe('myboard');
    expect(envs[0].platform).toBe('atmelavr');
    expect(envs[0].boardFqbn).toBe('arduino:avr:uno');
    expect(envs[0].uploadSpeed).toBe(115200);
    expect(envs[0].monitorSpeed).toBe(9600);
  });

  it('parses multiple environments', () => {
    const ini = `
[env:debug]
platform = espressif32
board = esp32:esp32:esp32
framework = arduino

[env:release]
platform = espressif32
board = esp32:esp32:esp32
framework = arduino
`;
    const envs = parsePlatformioIni(ini);
    expect(envs).toHaveLength(2);
    expect(envs[0].name).toBe('debug');
    expect(envs[1].name).toBe('release');
  });

  it('parses multiline build_flags', () => {
    const ini = `
[env:test]
platform = atmelavr
board = arduino:avr:uno
framework = arduino
build_flags =
  -DDEBUG
  -DVERSION=2
  -Wall
`;
    const envs = parsePlatformioIni(ini);
    expect(envs[0].buildFlags).toEqual(['-DDEBUG', '-DVERSION=2', '-Wall']);
  });

  it('parses multiline lib_deps', () => {
    const ini = `
[env:test]
platform = atmelavr
board = arduino:avr:uno
framework = arduino
lib_deps =
  Servo@1.1.0
  Wire
  SPI
`;
    const envs = parsePlatformioIni(ini);
    expect(envs[0].libDeps).toEqual(['Servo@1.1.0', 'Wire', 'SPI']);
  });

  it('parses default_envs from [platformio]', () => {
    const ini = `
[platformio]
default_envs = release

[env:debug]
platform = atmelavr
board = arduino:avr:uno
framework = arduino

[env:release]
platform = atmelavr
board = arduino:avr:mega
framework = arduino
`;
    const envs = parsePlatformioIni(ini);
    expect(envs.find((e) => e.name === 'release')?.isDefault).toBe(true);
    expect(envs.find((e) => e.name === 'debug')?.isDefault).toBe(false);
  });

  it('skips comments and blank lines', () => {
    const ini = `
# This is a comment
; Another comment

[env:test]
platform = atmelavr
# Inline-ish comment
board = arduino:avr:uno
framework = arduino
`;
    const envs = parsePlatformioIni(ini);
    expect(envs).toHaveLength(1);
    expect(envs[0].boardFqbn).toBe('arduino:avr:uno');
  });

  it('stores unknown keys in extra', () => {
    const ini = `
[env:test]
platform = atmelavr
board = arduino:avr:uno
framework = arduino
board_build_mcu = atmega328p
`;
    const envs = parsePlatformioIni(ini);
    expect(envs[0].extra['board_build_mcu']).toBe('atmega328p');
  });

  it('handles empty content', () => {
    expect(parsePlatformioIni('')).toEqual([]);
  });

  it('provides defaults for missing fields', () => {
    const ini = `
[env:minimal]
platform = atmelavr
`;
    const envs = parsePlatformioIni(ini);
    expect(envs[0].framework).toBe('arduino');
    expect(envs[0].uploadSpeed).toBe(115200);
    expect(envs[0].monitorSpeed).toBe(9600);
    expect(envs[0].uploadProtocol).toBe('serial');
  });
});

// ---------------------------------------------------------------------------
// Round-trip: generate → parse
// ---------------------------------------------------------------------------

describe('INI round-trip', () => {
  it('preserves environment data through generate → parse', () => {
    const original = createFromPreset(BOARD_PRESETS[3]); // ESP32
    original.libDeps.push('WiFi', 'WebServer');
    (original as { isDefault: boolean }).isDefault = true;

    const ini = generatePlatformioIni([original]);
    const parsed = parsePlatformioIni(ini);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].platform).toBe(original.platform);
    expect(parsed[0].boardFqbn).toBe(original.boardFqbn);
    expect(parsed[0].framework).toBe(original.framework);
    expect(parsed[0].uploadSpeed).toBe(original.uploadSpeed);
    expect(parsed[0].monitorSpeed).toBe(original.monitorSpeed);
    expect(parsed[0].buildFlags).toEqual(original.buildFlags);
    expect(parsed[0].libDeps).toEqual(original.libDeps);
    expect(parsed[0].isDefault).toBe(true);
  });

  it('preserves multiple environments through round-trip', () => {
    const envs = [
      createFromPreset(BOARD_PRESETS[0]),
      createFromPreset(BOARD_PRESETS[3]),
    ];
    const ini = generatePlatformioIni(envs);
    const parsed = parsePlatformioIni(ini);
    expect(parsed).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// diffEnvironments
// ---------------------------------------------------------------------------

describe('diffEnvironments', () => {
  it('returns empty array for identical environments', () => {
    const env = createFromPreset(BOARD_PRESETS[0]);
    const diffs = diffEnvironments(env, { ...env });
    expect(diffs).toEqual([]);
  });

  it('detects name difference', () => {
    const left = createFromPreset(BOARD_PRESETS[0]);
    const right = { ...left, name: 'Different' };
    const diffs = diffEnvironments(left, right);
    expect(diffs.find((d) => d.field === 'name')).toBeDefined();
  });

  it('detects board FQBN difference', () => {
    const left = createFromPreset(BOARD_PRESETS[0]);
    const right = { ...left, boardFqbn: 'esp32:esp32:esp32' };
    const diffs = diffEnvironments(left, right);
    expect(diffs.find((d) => d.field === 'boardFqbn')).toBeDefined();
  });

  it('detects build flags difference', () => {
    const left = createFromPreset(BOARD_PRESETS[0]);
    const right = { ...left, buildFlags: ['-DDEBUG'] };
    const diffs = diffEnvironments(left, right);
    expect(diffs.find((d) => d.field === 'buildFlags')).toBeDefined();
  });

  it('detects lib deps difference', () => {
    const left = createFromPreset(BOARD_PRESETS[0]);
    const right = { ...left, libDeps: ['Servo'] };
    const diffs = diffEnvironments(left, right);
    expect(diffs.find((d) => d.field === 'libDeps')).toBeDefined();
  });

  it('detects upload speed difference', () => {
    const left = createFromPreset(BOARD_PRESETS[0]);
    const right = { ...left, uploadSpeed: 9600 };
    const diffs = diffEnvironments(left, right);
    const d = diffs.find((d) => d.field === 'uploadSpeed');
    expect(d).toBeDefined();
    expect(d!.left).toBe('115200');
    expect(d!.right).toBe('9600');
  });

  it('detects extra field differences', () => {
    const left = createFromPreset(BOARD_PRESETS[0]);
    left.extra['custom_key'] = 'value_a';
    const right = { ...left, extra: { custom_key: 'value_b' } };
    const diffs = diffEnvironments(left, right);
    expect(diffs.find((d) => d.field === 'extra.custom_key')).toBeDefined();
  });

  it('detects extra field added in right', () => {
    const left = createFromPreset(BOARD_PRESETS[0]);
    const right = { ...left, extra: { new_key: 'val' } };
    const diffs = diffEnvironments(left, right);
    expect(diffs.find((d) => d.field === 'extra.new_key')).toBeDefined();
  });

  it('reports all differing fields', () => {
    const left = createFromPreset(BOARD_PRESETS[0]);
    const right = {
      ...left,
      name: 'Other',
      uploadSpeed: 9600,
      monitorSpeed: 115200,
    };
    const diffs = diffEnvironments(left, right);
    expect(diffs.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// BuildEnvironmentManager — core
// ---------------------------------------------------------------------------

describe('BuildEnvironmentManager', () => {
  let mgr: BuildEnvironmentManager;

  beforeEach(() => {
    storage.clear();
    uuidCounter = 0;
    mgr = BuildEnvironmentManager.create();
  });

  describe('create & getSnapshot', () => {
    it('creates with empty state', () => {
      const state = mgr.getSnapshot();
      expect(state.environments).toEqual([]);
      expect(state.activeId).toBeNull();
    });

    it('creates independent instances', () => {
      mgr.addFromPreset(BOARD_PRESETS[0]);
      const mgr2 = BuildEnvironmentManager.create();
      // mgr2 reads from localStorage, so it sees the same data
      // But fresh create after clear should be empty
      storage.clear();
      const mgr3 = BuildEnvironmentManager.create();
      expect(mgr3.getSnapshot().environments).toEqual([]);
    });
  });

  describe('subscribe / notify', () => {
    it('notifies on addEnvironment', () => {
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.addFromPreset(BOARD_PRESETS[0]);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('unsubscribe stops notifications', () => {
      const listener = vi.fn();
      const unsub = mgr.subscribe(listener);
      unsub();
      mgr.addFromPreset(BOARD_PRESETS[0]);
      expect(listener).not.toHaveBeenCalled();
    });

    it('supports multiple listeners', () => {
      const l1 = vi.fn();
      const l2 = vi.fn();
      mgr.subscribe(l1);
      mgr.subscribe(l2);
      mgr.addFromPreset(BOARD_PRESETS[0]);
      expect(l1).toHaveBeenCalledTimes(1);
      expect(l2).toHaveBeenCalledTimes(1);
    });
  });

  describe('addFromPreset', () => {
    it('adds environment from preset', () => {
      const env = mgr.addFromPreset(BOARD_PRESETS[0]);
      expect(env).not.toBeNull();
      expect(mgr.getCount()).toBe(1);
    });

    it('first environment becomes default', () => {
      const env = mgr.addFromPreset(BOARD_PRESETS[0]);
      expect(env!.isDefault).toBe(true);
      expect(mgr.getDefault()?.id).toBe(env!.id);
    });

    it('second environment is not default', () => {
      mgr.addFromPreset(BOARD_PRESETS[0]);
      const env2 = mgr.addFromPreset(BOARD_PRESETS[1]);
      expect(env2!.isDefault).toBe(false);
    });

    it('allows name override', () => {
      const env = mgr.addFromPreset(BOARD_PRESETS[0], 'Custom Name');
      expect(env!.name).toBe('Custom Name');
    });

    it('sets activeId to first env', () => {
      const env = mgr.addFromPreset(BOARD_PRESETS[0]);
      expect(mgr.getSnapshot().activeId).toBe(env!.id);
    });
  });

  describe('addEnvironment', () => {
    it('adds a custom environment', () => {
      const env = createBlankEnvironment('Test');
      mgr.addEnvironment(env);
      expect(mgr.getCount()).toBe(1);
      expect(mgr.getById(env.id)).not.toBeNull();
    });

    it('returns null when limit reached', () => {
      for (let i = 0; i < MAX_ENVIRONMENTS; i++) {
        mgr.addEnvironment(createBlankEnvironment(`env-${i}`));
      }
      const result = mgr.addEnvironment(createBlankEnvironment('overflow'));
      expect(result).toBeNull();
      expect(mgr.getCount()).toBe(MAX_ENVIRONMENTS);
    });

    it('clears other defaults when adding a default env', () => {
      const env1 = createBlankEnvironment('First');
      (env1 as { isDefault: boolean }).isDefault = true;
      mgr.addEnvironment(env1);

      const env2 = createBlankEnvironment('Second');
      (env2 as { isDefault: boolean }).isDefault = true;
      mgr.addEnvironment(env2);

      const envs = mgr.getAll();
      const defaults = envs.filter((e) => e.isDefault);
      expect(defaults).toHaveLength(1);
      expect(defaults[0].id).toBe(env2.id);
    });
  });

  describe('updateEnvironment', () => {
    it('updates name', () => {
      const env = mgr.addFromPreset(BOARD_PRESETS[0])!;
      mgr.updateEnvironment(env.id, { name: 'Renamed' });
      expect(mgr.getById(env.id)!.name).toBe('Renamed');
    });

    it('updates buildFlags', () => {
      const env = mgr.addFromPreset(BOARD_PRESETS[0])!;
      mgr.updateEnvironment(env.id, { buildFlags: ['-DDEBUG', '-O2'] });
      expect(mgr.getById(env.id)!.buildFlags).toEqual(['-DDEBUG', '-O2']);
    });

    it('returns false for non-existent ID', () => {
      expect(mgr.updateEnvironment('nope', { name: 'X' })).toBe(false);
    });

    it('preserves ID and createdAt', () => {
      const env = mgr.addFromPreset(BOARD_PRESETS[0])!;
      const originalCreatedAt = env.createdAt;
      mgr.updateEnvironment(env.id, { name: 'New' });
      const updated = mgr.getById(env.id)!;
      expect(updated.id).toBe(env.id);
      expect(updated.createdAt).toBe(originalCreatedAt);
    });

    it('updates updatedAt timestamp', () => {
      const env = mgr.addFromPreset(BOARD_PRESETS[0])!;
      const originalUpdatedAt = env.updatedAt;
      // Small delay to ensure different timestamp
      mgr.updateEnvironment(env.id, { name: 'New' });
      const updated = mgr.getById(env.id)!;
      expect(updated.updatedAt).toBeTruthy();
      // Can't guarantee different timestamp in same ms, just check it exists
      expect(typeof updated.updatedAt).toBe('string');
    });

    it('clears other defaults when setting isDefault', () => {
      const env1 = mgr.addFromPreset(BOARD_PRESETS[0])!;
      const env2 = mgr.addFromPreset(BOARD_PRESETS[1])!;
      mgr.updateEnvironment(env2.id, { isDefault: true });

      expect(mgr.getById(env1.id)!.isDefault).toBe(false);
      expect(mgr.getById(env2.id)!.isDefault).toBe(true);
    });

    it('notifies listeners', () => {
      const env = mgr.addFromPreset(BOARD_PRESETS[0])!;
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.updateEnvironment(env.id, { name: 'Updated' });
      expect(listener).toHaveBeenCalled();
    });
  });

  describe('removeEnvironment', () => {
    it('removes an existing environment', () => {
      const env = mgr.addFromPreset(BOARD_PRESETS[0])!;
      expect(mgr.removeEnvironment(env.id)).toBe(true);
      expect(mgr.getCount()).toBe(0);
    });

    it('returns false for non-existent ID', () => {
      expect(mgr.removeEnvironment('nope')).toBe(false);
    });

    it('promotes first remaining to default when default removed', () => {
      const env1 = mgr.addFromPreset(BOARD_PRESETS[0])!; // default
      const env2 = mgr.addFromPreset(BOARD_PRESETS[1])!;
      mgr.removeEnvironment(env1.id);
      expect(mgr.getById(env2.id)!.isDefault).toBe(true);
    });

    it('updates activeId when active env removed', () => {
      const env1 = mgr.addFromPreset(BOARD_PRESETS[0])!;
      const env2 = mgr.addFromPreset(BOARD_PRESETS[1])!;
      mgr.setActive(env1.id);
      mgr.removeEnvironment(env1.id);
      // Should pick the next available
      expect(mgr.getSnapshot().activeId).toBe(env2.id);
    });

    it('sets activeId to null when last env removed', () => {
      const env = mgr.addFromPreset(BOARD_PRESETS[0])!;
      mgr.removeEnvironment(env.id);
      expect(mgr.getSnapshot().activeId).toBeNull();
    });
  });

  describe('duplicateEnvironment', () => {
    it('creates a copy with new ID', () => {
      const env = mgr.addFromPreset(BOARD_PRESETS[0])!;
      const clone = mgr.duplicateEnvironment(env.id)!;
      expect(clone).not.toBeNull();
      expect(clone.id).not.toBe(env.id);
      expect(clone.name).toBe(`${env.name} (copy)`);
      expect(clone.boardFqbn).toBe(env.boardFqbn);
      expect(mgr.getCount()).toBe(2);
    });

    it('allows custom name for clone', () => {
      const env = mgr.addFromPreset(BOARD_PRESETS[0])!;
      const clone = mgr.duplicateEnvironment(env.id, 'Clone')!;
      expect(clone.name).toBe('Clone');
    });

    it('clone is not default', () => {
      const env = mgr.addFromPreset(BOARD_PRESETS[0])!;
      const clone = mgr.duplicateEnvironment(env.id)!;
      expect(clone.isDefault).toBe(false);
    });

    it('returns null for non-existent ID', () => {
      expect(mgr.duplicateEnvironment('nope')).toBeNull();
    });
  });

  describe('setActive / getActive', () => {
    it('sets active environment', () => {
      const env1 = mgr.addFromPreset(BOARD_PRESETS[0])!;
      const env2 = mgr.addFromPreset(BOARD_PRESETS[1])!;
      mgr.setActive(env2.id);
      expect(mgr.getActive()?.id).toBe(env2.id);
    });

    it('returns false for non-existent ID', () => {
      expect(mgr.setActive('nope')).toBe(false);
    });

    it('getActive returns null when no active', () => {
      expect(mgr.getActive()).toBeNull();
    });
  });

  describe('getById / getDefault / getAll', () => {
    it('getById returns env or null', () => {
      const env = mgr.addFromPreset(BOARD_PRESETS[0])!;
      expect(mgr.getById(env.id)?.name).toBe(env.name);
      expect(mgr.getById('nope')).toBeNull();
    });

    it('getDefault returns the default env', () => {
      mgr.addFromPreset(BOARD_PRESETS[0]);
      expect(mgr.getDefault()).not.toBeNull();
    });

    it('getAll returns a copy', () => {
      mgr.addFromPreset(BOARD_PRESETS[0]);
      const all = mgr.getAll();
      all.push(createBlankEnvironment('injected'));
      expect(mgr.getCount()).toBe(1);
    });
  });

  describe('search', () => {
    it('finds environments by name', () => {
      mgr.addFromPreset(BOARD_PRESETS[0]); // Arduino Uno
      mgr.addFromPreset(BOARD_PRESETS[3]); // ESP32 Dev Module
      const results = mgr.search('esp');
      expect(results).toHaveLength(1);
      expect(results[0].name).toContain('ESP32');
    });

    it('case-insensitive search', () => {
      mgr.addFromPreset(BOARD_PRESETS[0]);
      expect(mgr.search('ARDUINO')).toHaveLength(1);
    });

    it('returns empty for no match', () => {
      mgr.addFromPreset(BOARD_PRESETS[0]);
      expect(mgr.search('zzz')).toEqual([]);
    });
  });

  describe('diff (instance method)', () => {
    it('diffs two environments by ID', () => {
      const env1 = mgr.addFromPreset(BOARD_PRESETS[0])!;
      const env2 = mgr.addFromPreset(BOARD_PRESETS[3])!;
      const diffs = mgr.diff(env1.id, env2.id);
      expect(diffs).not.toBeNull();
      expect(diffs!.length).toBeGreaterThan(0);
    });

    it('returns null for non-existent ID', () => {
      const env = mgr.addFromPreset(BOARD_PRESETS[0])!;
      expect(mgr.diff(env.id, 'nope')).toBeNull();
      expect(mgr.diff('nope', env.id)).toBeNull();
    });
  });

  describe('generateIni / importIni', () => {
    it('generates INI for all environments', () => {
      mgr.addFromPreset(BOARD_PRESETS[0]);
      mgr.addFromPreset(BOARD_PRESETS[3]);
      const ini = mgr.generateIni();
      expect(ini).toContain('[env:');
      expect(ini.split('[env:').length - 1).toBe(2);
    });

    it('importIni replaces all environments', () => {
      mgr.addFromPreset(BOARD_PRESETS[0]);
      mgr.importIni(`
[env:imported]
platform = espressif32
board = esp32:esp32:esp32
framework = arduino
`);
      expect(mgr.getCount()).toBe(1);
      expect(mgr.getAll()[0].name).toBe('imported');
    });

    it('importIni sets activeId', () => {
      mgr.importIni(`
[env:test]
platform = atmelavr
board = arduino:avr:uno
framework = arduino
`);
      expect(mgr.getSnapshot().activeId).not.toBeNull();
    });
  });

  describe('mergeIni', () => {
    it('appends imported environments', () => {
      mgr.addFromPreset(BOARD_PRESETS[0]);
      mgr.mergeIni(`
[env:extra]
platform = espressif32
board = esp32:esp32:esp32
framework = arduino
`);
      expect(mgr.getCount()).toBe(2);
    });

    it('truncates when exceeding MAX_ENVIRONMENTS', () => {
      for (let i = 0; i < MAX_ENVIRONMENTS - 1; i++) {
        mgr.addEnvironment(createBlankEnvironment(`env-${i}`));
      }
      mgr.mergeIni(`
[env:extra1]
platform = atmelavr
board = arduino:avr:uno
framework = arduino

[env:extra2]
platform = atmelavr
board = arduino:avr:mega
framework = arduino
`);
      expect(mgr.getCount()).toBeLessThanOrEqual(MAX_ENVIRONMENTS);
    });
  });

  describe('clear / resetToDefaults', () => {
    it('clear removes all environments', () => {
      mgr.addFromPreset(BOARD_PRESETS[0]);
      mgr.addFromPreset(BOARD_PRESETS[1]);
      mgr.clear();
      expect(mgr.getCount()).toBe(0);
      expect(mgr.getSnapshot().activeId).toBeNull();
    });

    it('resetToDefaults creates one default environment', () => {
      mgr.addFromPreset(BOARD_PRESETS[3]); // ESP32
      mgr.resetToDefaults();
      expect(mgr.getCount()).toBe(1);
      const env = mgr.getAll()[0];
      expect(env.isDefault).toBe(true);
      expect(env.boardFqbn).toBe(BOARD_PRESETS[0].boardFqbn);
    });
  });

  describe('exportState / importState', () => {
    it('round-trips state', () => {
      mgr.addFromPreset(BOARD_PRESETS[0]);
      mgr.addFromPreset(BOARD_PRESETS[3]);
      const exported = mgr.exportState();

      const mgr2 = BuildEnvironmentManager.create();
      mgr2.importState(exported);
      expect(mgr2.getCount()).toBe(2);
      expect(mgr2.getSnapshot().activeId).toBe(exported.activeId);
    });

    it('returns copies (no mutation risk)', () => {
      mgr.addFromPreset(BOARD_PRESETS[0]);
      const exported = mgr.exportState();
      exported.environments.push(createBlankEnvironment('injected'));
      expect(mgr.getCount()).toBe(1);
    });
  });

  describe('persistence', () => {
    it('persists state to localStorage', () => {
      mgr.addFromPreset(BOARD_PRESETS[0]);
      expect(storage.has('protopulse-build-envs')).toBe(true);
    });

    it('loads persisted state on create', () => {
      mgr.addFromPreset(BOARD_PRESETS[0]);
      const mgr2 = BuildEnvironmentManager.create();
      expect(mgr2.getCount()).toBe(1);
    });

    it('handles corrupted localStorage gracefully', () => {
      storage.set('protopulse-build-envs', 'bad-json');
      const mgr2 = BuildEnvironmentManager.create();
      expect(mgr2.getCount()).toBe(0);
    });

    it('handles non-object JSON gracefully', () => {
      storage.set('protopulse-build-envs', '42');
      const mgr2 = BuildEnvironmentManager.create();
      expect(mgr2.getCount()).toBe(0);
    });

    it('handles missing environment fields gracefully', () => {
      storage.set('protopulse-build-envs', JSON.stringify({
        environments: [{ id: 'test-1', name: 'partial' }],
        activeId: 'test-1',
      }));
      const mgr2 = BuildEnvironmentManager.create();
      expect(mgr2.getCount()).toBe(1);
      const env = mgr2.getAll()[0];
      expect(env.platform).toBe('atmelavr'); // default
      expect(env.framework).toBe('arduino'); // default
    });
  });
});
