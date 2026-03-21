/**
 * BuildEnvironmentManager — Manages multiple build configurations (environments)
 * per project, similar to PlatformIO's multi-env project model.
 *
 * CRUD for environments, PlatformIO INI generation/parsing, environment diffing,
 * and 8+ board presets. Each environment captures a board FQBN, build flags,
 * library dependencies, upload settings, and monitor configuration.
 *
 * Singleton + subscribe pattern for useSyncExternalStore integration.
 * Pure module — no React/DOM dependencies.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = () => void;

/** Monitor parity options. */
export type Parity = 'none' | 'even' | 'odd';

/** Monitor stop bit options. */
export type StopBits = 1 | 1.5 | 2;

/** Upload protocol. */
export type UploadProtocol = 'serial' | 'ota' | 'jtag' | 'stlink' | 'dfu';

/** A single build environment configuration. */
export interface BuildEnvironment {
  /** Unique identifier (UUID). */
  readonly id: string;
  /** Human-readable name (e.g., "Release ESP32", "Debug Nano"). */
  name: string;
  /** Board FQBN (e.g., "esp32:esp32:esp32"). */
  boardFqbn: string;
  /** PlatformIO platform identifier (e.g., "espressif32"). */
  platform: string;
  /** Framework (e.g., "arduino", "espidf"). */
  framework: string;
  /** Build flags (compiler defines, warnings, etc.). */
  buildFlags: string[];
  /** Library dependencies (name or name@version). */
  libDeps: string[];
  /** Upload protocol. */
  uploadProtocol: UploadProtocol;
  /** Upload speed (baud rate). */
  uploadSpeed: number;
  /** Upload port (e.g., "/dev/ttyUSB0", "COM3"). */
  uploadPort: string;
  /** Monitor speed (baud rate). */
  monitorSpeed: number;
  /** Monitor port (defaults to upload port). */
  monitorPort: string;
  /** Monitor parity. */
  monitorParity: Parity;
  /** Monitor stop bits. */
  monitorStopBits: StopBits;
  /** Extra PlatformIO-specific key-value pairs. */
  extra: Record<string, string>;
  /** Whether this environment is the active/default one. */
  isDefault: boolean;
  /** Creation timestamp (ISO string). */
  createdAt: string;
  /** Last modified timestamp (ISO string). */
  updatedAt: string;
}

/** Diff between two environments. */
export interface EnvironmentDiff {
  /** Field name that differs. */
  readonly field: string;
  /** Value in the "left" environment. */
  readonly left: string;
  /** Value in the "right" environment. */
  readonly right: string;
}

/** Board preset — quick-start template for a known board. */
export interface BoardPresetEnv {
  /** Preset display name. */
  readonly name: string;
  /** Board FQBN. */
  readonly boardFqbn: string;
  /** PlatformIO platform. */
  readonly platform: string;
  /** Default framework. */
  readonly framework: string;
  /** Default upload speed. */
  readonly uploadSpeed: number;
  /** Default monitor speed. */
  readonly monitorSpeed: number;
  /** Default upload protocol. */
  readonly uploadProtocol: UploadProtocol;
  /** Recommended build flags. */
  readonly buildFlags: string[];
  /** Common library dependencies. */
  readonly libDeps: string[];
}

/** Manager state exposed to subscribers. */
export interface BuildEnvironmentState {
  readonly environments: BuildEnvironment[];
  readonly activeId: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-build-envs';

/** Maximum environments per project. */
export const MAX_ENVIRONMENTS = 32;

/** Maximum build flags per environment. */
export const MAX_BUILD_FLAGS = 64;

/** Maximum library deps per environment. */
export const MAX_LIB_DEPS = 128;

// ---------------------------------------------------------------------------
// Board presets
// ---------------------------------------------------------------------------

export const BOARD_PRESETS: readonly BoardPresetEnv[] = [
  {
    name: 'Arduino Uno',
    boardFqbn: 'arduino:avr:uno',
    platform: 'atmelavr',
    framework: 'arduino',
    uploadSpeed: 115200,
    monitorSpeed: 9600,
    uploadProtocol: 'serial',
    buildFlags: ['-DARDUINO_AVR_UNO'],
    libDeps: [],
  },
  {
    name: 'Arduino Mega 2560',
    boardFqbn: 'arduino:avr:mega',
    platform: 'atmelavr',
    framework: 'arduino',
    uploadSpeed: 115200,
    monitorSpeed: 9600,
    uploadProtocol: 'serial',
    buildFlags: ['-DARDUINO_AVR_MEGA2560'],
    libDeps: [],
  },
  {
    name: 'Arduino Nano',
    boardFqbn: 'arduino:avr:nano',
    platform: 'atmelavr',
    framework: 'arduino',
    uploadSpeed: 57600,
    monitorSpeed: 9600,
    uploadProtocol: 'serial',
    buildFlags: ['-DARDUINO_AVR_NANO'],
    libDeps: [],
  },
  {
    name: 'ESP32 Dev Module',
    boardFqbn: 'esp32:esp32:esp32',
    platform: 'espressif32',
    framework: 'arduino',
    uploadSpeed: 921600,
    monitorSpeed: 115200,
    uploadProtocol: 'serial',
    buildFlags: ['-DCORE_DEBUG_LEVEL=1'],
    libDeps: [],
  },
  {
    name: 'ESP32-S3 Dev Module',
    boardFqbn: 'esp32:esp32:esp32s3',
    platform: 'espressif32',
    framework: 'arduino',
    uploadSpeed: 921600,
    monitorSpeed: 115200,
    uploadProtocol: 'serial',
    buildFlags: ['-DCORE_DEBUG_LEVEL=1', '-DARDUINO_USB_CDC_ON_BOOT=1'],
    libDeps: [],
  },
  {
    name: 'NodeMCU ESP8266',
    boardFqbn: 'esp8266:esp8266:nodemcuv2',
    platform: 'espressif8266',
    framework: 'arduino',
    uploadSpeed: 921600,
    monitorSpeed: 115200,
    uploadProtocol: 'serial',
    buildFlags: ['-DNDEBUG'],
    libDeps: [],
  },
  {
    name: 'STM32 Blue Pill',
    boardFqbn: 'stm32duino:stm32:bluepill_f103c8',
    platform: 'ststm32',
    framework: 'arduino',
    uploadSpeed: 115200,
    monitorSpeed: 9600,
    uploadProtocol: 'stlink',
    buildFlags: ['-DSTM32F103xB'],
    libDeps: [],
  },
  {
    name: 'Raspberry Pi Pico',
    boardFqbn: 'rp2040:rp2040:rpipico',
    platform: 'raspberrypi',
    framework: 'arduino',
    uploadSpeed: 115200,
    monitorSpeed: 115200,
    uploadProtocol: 'serial',
    buildFlags: [],
    libDeps: [],
  },
  {
    name: 'Teensy 4.0',
    boardFqbn: 'teensy:avr:teensy40',
    platform: 'teensy',
    framework: 'arduino',
    uploadSpeed: 115200,
    monitorSpeed: 9600,
    uploadProtocol: 'serial',
    buildFlags: ['-DTEENSY40'],
    libDeps: [],
  },
  {
    name: 'Adafruit Feather M0',
    boardFqbn: 'adafruit:samd:adafruit_feather_m0',
    platform: 'atmelsam',
    framework: 'arduino',
    uploadSpeed: 115200,
    monitorSpeed: 9600,
    uploadProtocol: 'serial',
    buildFlags: [],
    libDeps: [],
  },
] as const;

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

function generateId(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeGetLS(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetLS(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage may be unavailable
  }
}

function now(): string {
  return new Date().toISOString();
}

/** Create a default environment from a board preset. */
export function createFromPreset(preset: BoardPresetEnv, nameOverride?: string): BuildEnvironment {
  const timestamp = now();
  return {
    id: generateId(),
    name: nameOverride ?? preset.name,
    boardFqbn: preset.boardFqbn,
    platform: preset.platform,
    framework: preset.framework,
    buildFlags: [...preset.buildFlags],
    libDeps: [...preset.libDeps],
    uploadProtocol: preset.uploadProtocol,
    uploadSpeed: preset.uploadSpeed,
    uploadPort: '',
    monitorSpeed: preset.monitorSpeed,
    monitorPort: '',
    monitorParity: 'none',
    monitorStopBits: 1,
    extra: {},
    isDefault: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/** Create a blank environment with minimal defaults. */
export function createBlankEnvironment(name: string, boardFqbn: string = 'arduino:avr:uno'): BuildEnvironment {
  const timestamp = now();
  return {
    id: generateId(),
    name,
    boardFqbn,
    platform: 'atmelavr',
    framework: 'arduino',
    buildFlags: [],
    libDeps: [],
    uploadProtocol: 'serial',
    uploadSpeed: 115200,
    uploadPort: '',
    monitorSpeed: 9600,
    monitorPort: '',
    monitorParity: 'none',
    monitorStopBits: 1,
    extra: {},
    isDefault: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

// ---------------------------------------------------------------------------
// PlatformIO INI generation
// ---------------------------------------------------------------------------

/** Generate PlatformIO INI content for a set of environments. */
export function generatePlatformioIni(environments: BuildEnvironment[]): string {
  const sections: string[] = [];

  // Global platformio section
  const defaultEnv = environments.find((e) => e.isDefault);
  if (defaultEnv) {
    sections.push(`[platformio]\ndefault_envs = ${sanitizeEnvName(defaultEnv.name)}`);
  }

  for (const env of environments) {
    const lines: string[] = [];
    const envName = sanitizeEnvName(env.name);
    lines.push(`[env:${envName}]`);
    lines.push(`platform = ${env.platform}`);
    lines.push(`board = ${env.boardFqbn}`);
    lines.push(`framework = ${env.framework}`);

    if (env.uploadProtocol !== 'serial') {
      lines.push(`upload_protocol = ${env.uploadProtocol}`);
    }
    lines.push(`upload_speed = ${env.uploadSpeed}`);
    if (env.uploadPort) {
      lines.push(`upload_port = ${env.uploadPort}`);
    }

    lines.push(`monitor_speed = ${env.monitorSpeed}`);
    if (env.monitorPort) {
      lines.push(`monitor_port = ${env.monitorPort}`);
    }
    if (env.monitorParity !== 'none') {
      lines.push(`monitor_parity = ${env.monitorParity}`);
    }
    if (env.monitorStopBits !== 1) {
      lines.push(`monitor_stop_bits = ${env.monitorStopBits}`);
    }

    if (env.buildFlags.length > 0) {
      lines.push(`build_flags =`);
      for (const flag of env.buildFlags) {
        lines.push(`  ${flag}`);
      }
    }

    if (env.libDeps.length > 0) {
      lines.push(`lib_deps =`);
      for (const dep of env.libDeps) {
        lines.push(`  ${dep}`);
      }
    }

    // Extra key-value pairs
    const extraKeys = Object.keys(env.extra).sort();
    for (const key of extraKeys) {
      lines.push(`${key} = ${env.extra[key]}`);
    }

    sections.push(lines.join('\n'));
  }

  return sections.join('\n\n') + '\n';
}

/** Sanitize an environment name for use in INI section headers. */
export function sanitizeEnvName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/^[^a-z]/, 'env_$&')
    .slice(0, 64) || 'env';
}

// ---------------------------------------------------------------------------
// PlatformIO INI parsing
// ---------------------------------------------------------------------------

/** Parse PlatformIO INI content into build environments. */
export function parsePlatformioIni(content: string): BuildEnvironment[] {
  const environments: BuildEnvironment[] = [];
  const lines = content.split('\n');

  let currentEnv: Partial<BuildEnvironment> | null = null;
  let currentMultiline: { key: string; values: string[] } | null = null;
  let defaultEnvName: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip empty lines and comments
    if (line === '' || line.startsWith('#') || line.startsWith(';')) {
      continue;
    }

    // Multiline continuation (indented lines)
    if (currentMultiline && (rawLine.startsWith('  ') || rawLine.startsWith('\t'))) {
      const value = line.trim();
      if (value) {
        currentMultiline.values.push(value);
      }
      continue;
    }

    // Flush any pending multiline
    if (currentMultiline && currentEnv) {
      applyMultiline(currentEnv, currentMultiline);
      currentMultiline = null;
    }

    // [platformio] section
    if (line === '[platformio]') {
      // Flush current env
      if (currentEnv) {
        environments.push(finalizeEnv(currentEnv));
        currentEnv = null;
      }
      continue;
    }

    // [env:name] section
    const envMatch = /^\[env:([^\]]+)\]$/.exec(line);
    if (envMatch) {
      if (currentEnv) {
        environments.push(finalizeEnv(currentEnv));
      }
      currentEnv = {
        id: generateId(),
        name: envMatch[1],
        buildFlags: [],
        libDeps: [],
        extra: {},
        isDefault: false,
        createdAt: now(),
        updatedAt: now(),
      };
      continue;
    }

    // Key = value pairs
    const kvMatch = /^([a-z_][a-z0-9_]*)(\s*=\s*)(.*)?$/.exec(line);
    if (kvMatch) {
      const key = kvMatch[1];
      const value = (kvMatch[3] ?? '').trim();

      // Global platformio keys
      if (!currentEnv) {
        if (key === 'default_envs') {
          defaultEnvName = value;
        }
        continue;
      }

      // Multiline start (value is empty)
      if (value === '' && (key === 'build_flags' || key === 'lib_deps')) {
        currentMultiline = { key, values: [] };
        continue;
      }

      applyKv(currentEnv, key, value);
    }
  }

  // Flush trailing multiline + env
  if (currentMultiline && currentEnv) {
    applyMultiline(currentEnv, currentMultiline);
  }
  if (currentEnv) {
    environments.push(finalizeEnv(currentEnv));
  }

  // Apply default flag
  if (defaultEnvName) {
    for (const env of environments) {
      if (sanitizeEnvName(env.name) === defaultEnvName || env.name === defaultEnvName) {
        (env as { isDefault: boolean }).isDefault = true;
      }
    }
  }

  return environments;
}

function applyKv(env: Partial<BuildEnvironment>, key: string, value: string): void {
  switch (key) {
    case 'platform':
      env.platform = value;
      break;
    case 'board':
      env.boardFqbn = value;
      break;
    case 'framework':
      env.framework = value;
      break;
    case 'upload_protocol':
      env.uploadProtocol = value as UploadProtocol;
      break;
    case 'upload_speed':
      env.uploadSpeed = parseInt(value, 10) || 115200;
      break;
    case 'upload_port':
      env.uploadPort = value;
      break;
    case 'monitor_speed':
      env.monitorSpeed = parseInt(value, 10) || 9600;
      break;
    case 'monitor_port':
      env.monitorPort = value;
      break;
    case 'monitor_parity':
      env.monitorParity = value as Parity;
      break;
    case 'monitor_stop_bits':
      env.monitorStopBits = parseFloat(value) as StopBits;
      break;
    case 'build_flags':
      env.buildFlags = value.split(/\s+/).filter((f) => f.length > 0);
      break;
    case 'lib_deps':
      env.libDeps = value.split(/\s+/).filter((d) => d.length > 0);
      break;
    default:
      if (!env.extra) {
        env.extra = {};
      }
      env.extra[key] = value;
      break;
  }
}

function applyMultiline(env: Partial<BuildEnvironment>, ml: { key: string; values: string[] }): void {
  if (ml.key === 'build_flags') {
    env.buildFlags = ml.values;
  } else if (ml.key === 'lib_deps') {
    env.libDeps = ml.values;
  }
}

function finalizeEnv(partial: Partial<BuildEnvironment>): BuildEnvironment {
  return {
    id: partial.id ?? generateId(),
    name: partial.name ?? 'untitled',
    boardFqbn: partial.boardFqbn ?? 'arduino:avr:uno',
    platform: partial.platform ?? 'atmelavr',
    framework: partial.framework ?? 'arduino',
    buildFlags: partial.buildFlags ?? [],
    libDeps: partial.libDeps ?? [],
    uploadProtocol: partial.uploadProtocol ?? 'serial',
    uploadSpeed: partial.uploadSpeed ?? 115200,
    uploadPort: partial.uploadPort ?? '',
    monitorSpeed: partial.monitorSpeed ?? 9600,
    monitorPort: partial.monitorPort ?? '',
    monitorParity: partial.monitorParity ?? 'none',
    monitorStopBits: partial.monitorStopBits ?? 1,
    extra: partial.extra ?? {},
    isDefault: partial.isDefault ?? false,
    createdAt: partial.createdAt ?? now(),
    updatedAt: partial.updatedAt ?? now(),
  };
}

// ---------------------------------------------------------------------------
// Environment diffing
// ---------------------------------------------------------------------------

/** Compare two environments and return all differences. */
export function diffEnvironments(left: BuildEnvironment, right: BuildEnvironment): EnvironmentDiff[] {
  const diffs: EnvironmentDiff[] = [];

  const compareSimple = (field: string, l: string | number | boolean, r: string | number | boolean): void => {
    if (String(l) !== String(r)) {
      diffs.push({ field, left: String(l), right: String(r) });
    }
  };

  compareSimple('name', left.name, right.name);
  compareSimple('boardFqbn', left.boardFqbn, right.boardFqbn);
  compareSimple('platform', left.platform, right.platform);
  compareSimple('framework', left.framework, right.framework);
  compareSimple('uploadProtocol', left.uploadProtocol, right.uploadProtocol);
  compareSimple('uploadSpeed', left.uploadSpeed, right.uploadSpeed);
  compareSimple('uploadPort', left.uploadPort, right.uploadPort);
  compareSimple('monitorSpeed', left.monitorSpeed, right.monitorSpeed);
  compareSimple('monitorPort', left.monitorPort, right.monitorPort);
  compareSimple('monitorParity', left.monitorParity, right.monitorParity);
  compareSimple('monitorStopBits', left.monitorStopBits, right.monitorStopBits);
  compareSimple('isDefault', left.isDefault, right.isDefault);

  // Array comparisons
  const leftFlags = left.buildFlags.join(', ');
  const rightFlags = right.buildFlags.join(', ');
  if (leftFlags !== rightFlags) {
    diffs.push({ field: 'buildFlags', left: leftFlags, right: rightFlags });
  }

  const leftDeps = left.libDeps.join(', ');
  const rightDeps = right.libDeps.join(', ');
  if (leftDeps !== rightDeps) {
    diffs.push({ field: 'libDeps', left: leftDeps, right: rightDeps });
  }

  // Extra key-value pairs
  const allExtraKeys = new Set([...Object.keys(left.extra), ...Object.keys(right.extra)]);
  Array.from(allExtraKeys).sort().forEach((key) => {
    const lVal = left.extra[key] ?? '';
    const rVal = right.extra[key] ?? '';
    if (lVal !== rVal) {
      diffs.push({ field: `extra.${key}`, left: lVal, right: rVal });
    }
  });

  return diffs;
}

// ---------------------------------------------------------------------------
// State persistence
// ---------------------------------------------------------------------------

function loadState(): BuildEnvironmentState {
  const raw = safeGetLS(STORAGE_KEY);
  if (raw === null) {
    return { environments: [], activeId: null };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return { environments: [], activeId: null };
    }

    const obj = parsed as Record<string, unknown>;
    const environments = parseEnvironments(obj.environments);
    const activeId = typeof obj.activeId === 'string' ? obj.activeId : null;

    return { environments, activeId };
  } catch {
    return { environments: [], activeId: null };
  }
}

function parseEnvironments(value: unknown): BuildEnvironment[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const result: BuildEnvironment[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const obj = item as Record<string, unknown>;
    if (typeof obj.id !== 'string' || typeof obj.name !== 'string') {
      continue;
    }
    result.push(finalizeEnv(obj as Partial<BuildEnvironment>));
  }
  return result;
}

// ---------------------------------------------------------------------------
// BuildEnvironmentManager
// ---------------------------------------------------------------------------

export class BuildEnvironmentManager {
  private _state: BuildEnvironmentState;
  private _listeners = new Set<Listener>();

  private constructor() {
    this._state = loadState();
  }

  /** Factory — creates a fresh instance (testing-friendly, no global singleton). */
  static create(): BuildEnvironmentManager {
    return new BuildEnvironmentManager();
  }

  // -----------------------------------------------------------------------
  // Subscription (useSyncExternalStore compatible)
  // -----------------------------------------------------------------------

  subscribe = (listener: Listener): (() => void) => {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  };

  getSnapshot = (): BuildEnvironmentState => {
    return this._state;
  };

  private notify(): void {
    const listeners = Array.from(this._listeners);
    for (let i = 0; i < listeners.length; i++) {
      listeners[i]();
    }
  }

  private setState(partial: Partial<BuildEnvironmentState>): void {
    this._state = { ...this._state, ...partial };
    this.persist();
    this.notify();
  }

  private persist(): void {
    safeSetLS(STORAGE_KEY, JSON.stringify(this._state));
  }

  // -----------------------------------------------------------------------
  // CRUD
  // -----------------------------------------------------------------------

  /** Add a new environment. Returns the created environment, or null if limit reached. */
  addEnvironment(env: BuildEnvironment): BuildEnvironment | null {
    if (this._state.environments.length >= MAX_ENVIRONMENTS) {
      return null;
    }

    // If it's marked as default, clear existing defaults
    const envs = env.isDefault
      ? this._state.environments.map((e) => ({ ...e, isDefault: false }))
      : [...this._state.environments];

    envs.push({ ...env });

    const activeId = env.isDefault ? env.id : this._state.activeId;
    this.setState({ environments: envs, activeId });
    return env;
  }

  /** Create an environment from a board preset. Returns the created environment. */
  addFromPreset(preset: BoardPresetEnv, nameOverride?: string): BuildEnvironment | null {
    const env = createFromPreset(preset, nameOverride);
    // First environment becomes default
    if (this._state.environments.length === 0) {
      (env as { isDefault: boolean }).isDefault = true;
    }
    return this.addEnvironment(env);
  }

  /** Update an existing environment. Returns true if found and updated. */
  updateEnvironment(id: string, updates: Partial<Omit<BuildEnvironment, 'id' | 'createdAt'>>): boolean {
    const idx = this._state.environments.findIndex((e) => e.id === id);
    if (idx === -1) {
      return false;
    }

    let envs = [...this._state.environments];

    // If setting this as default, clear others
    if (updates.isDefault === true) {
      envs = envs.map((e) => ({ ...e, isDefault: false }));
    }

    envs[idx] = {
      ...envs[idx],
      ...updates,
      id: envs[idx].id,
      createdAt: envs[idx].createdAt,
      updatedAt: now(),
    };

    const activeId = updates.isDefault === true ? id : this._state.activeId;
    this.setState({ environments: envs, activeId });
    return true;
  }

  /** Remove an environment by ID. Returns true if found and removed. */
  removeEnvironment(id: string): boolean {
    const idx = this._state.environments.findIndex((e) => e.id === id);
    if (idx === -1) {
      return false;
    }

    const removed = this._state.environments[idx];
    const envs = [...this._state.environments];
    envs.splice(idx, 1);

    let activeId = this._state.activeId;
    if (activeId === id) {
      // Pick next default or first available
      const nextDefault = envs.find((e) => e.isDefault);
      activeId = nextDefault?.id ?? envs[0]?.id ?? null;
    }

    // If the removed env was default, promote the first remaining
    if (removed.isDefault && envs.length > 0) {
      envs[0] = { ...envs[0], isDefault: true };
      if (!activeId) {
        activeId = envs[0].id;
      }
    }

    this.setState({ environments: envs, activeId });
    return true;
  }

  /** Duplicate an environment with a new name. Returns the clone or null. */
  duplicateEnvironment(id: string, newName?: string): BuildEnvironment | null {
    const original = this._state.environments.find((e) => e.id === id);
    if (!original) {
      return null;
    }

    const clone: BuildEnvironment = {
      ...original,
      id: generateId(),
      name: newName ?? `${original.name} (copy)`,
      isDefault: false,
      createdAt: now(),
      updatedAt: now(),
    };

    return this.addEnvironment(clone);
  }

  // -----------------------------------------------------------------------
  // Active environment
  // -----------------------------------------------------------------------

  /** Set the active environment by ID. Returns false if not found. */
  setActive(id: string): boolean {
    if (!this._state.environments.some((e) => e.id === id)) {
      return false;
    }
    this.setState({ activeId: id });
    return true;
  }

  /** Get the active (currently selected) environment, or null. */
  getActive(): BuildEnvironment | null {
    if (!this._state.activeId) {
      return null;
    }
    return this._state.environments.find((e) => e.id === this._state.activeId) ?? null;
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /** Get an environment by ID. */
  getById(id: string): BuildEnvironment | null {
    return this._state.environments.find((e) => e.id === id) ?? null;
  }

  /** Get the default environment. */
  getDefault(): BuildEnvironment | null {
    return this._state.environments.find((e) => e.isDefault) ?? null;
  }

  /** Get all environments. */
  getAll(): BuildEnvironment[] {
    return [...this._state.environments];
  }

  /** Get environment count. */
  getCount(): number {
    return this._state.environments.length;
  }

  /** Search environments by name (case-insensitive partial match). */
  search(query: string): BuildEnvironment[] {
    const lower = query.toLowerCase();
    return this._state.environments.filter((e) => e.name.toLowerCase().includes(lower));
  }

  /** Diff two environments by ID. Returns null if either not found. */
  diff(leftId: string, rightId: string): EnvironmentDiff[] | null {
    const left = this.getById(leftId);
    const right = this.getById(rightId);
    if (!left || !right) {
      return null;
    }
    return diffEnvironments(left, right);
  }

  // -----------------------------------------------------------------------
  // PlatformIO INI
  // -----------------------------------------------------------------------

  /** Generate PlatformIO INI for all environments. */
  generateIni(): string {
    return generatePlatformioIni(this._state.environments);
  }

  /** Import environments from PlatformIO INI content. Replaces all current environments. */
  importIni(content: string): BuildEnvironment[] {
    const envs = parsePlatformioIni(content);
    const activeId = envs.find((e) => e.isDefault)?.id ?? envs[0]?.id ?? null;
    this.setState({ environments: envs, activeId });
    return envs;
  }

  /** Merge environments from INI into existing ones (adds, does not replace). */
  mergeIni(content: string): BuildEnvironment[] {
    const imported = parsePlatformioIni(content);
    const combined = [...this._state.environments, ...imported];

    if (combined.length > MAX_ENVIRONMENTS) {
      // Truncate to limit
      combined.length = MAX_ENVIRONMENTS;
    }

    this.setState({ environments: combined });
    return imported;
  }

  // -----------------------------------------------------------------------
  // Bulk operations
  // -----------------------------------------------------------------------

  /** Remove all environments. */
  clear(): void {
    this.setState({ environments: [], activeId: null });
  }

  /** Reset to a fresh state with a default environment from the first preset. */
  resetToDefaults(): void {
    const preset = BOARD_PRESETS[0];
    const env = createFromPreset(preset);
    (env as { isDefault: boolean }).isDefault = true;
    this.setState({ environments: [env], activeId: env.id });
  }

  // -----------------------------------------------------------------------
  // Serialization
  // -----------------------------------------------------------------------

  /** Export state for external persistence. */
  exportState(): BuildEnvironmentState {
    return {
      environments: this._state.environments.map((e) => ({ ...e })),
      activeId: this._state.activeId,
    };
  }

  /** Import state (replaces current). */
  importState(state: BuildEnvironmentState): void {
    this.setState({
      environments: state.environments.map((e) => ({ ...e })),
      activeId: state.activeId,
    });
  }
}
