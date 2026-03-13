/**
 * BoardSettingsManager — Manages Arduino board selection, programmer, upload speed,
 * extra compiler flags, and custom board presets.
 *
 * Singleton + subscribe pattern for useSyncExternalStore integration.
 * Pure module — no React/DOM dependencies.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = () => void;

export interface BoardPreset {
  readonly fqbn: string;
  readonly name: string;
  readonly programmer?: string;
  readonly uploadSpeed?: number;
  readonly platform: string;
  readonly arch: string;
}

export interface BoardSettings {
  selectedFqbn: string;
  programmer: string;
  uploadSpeed: number;
  extraFlags: string;
  customBoards: BoardPreset[];
}

export interface BoardSettingsExport {
  version: 1;
  settings: BoardSettings;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-board-settings';

/** FQBN format: vendor:arch:board (optionally with :options). */
const FQBN_REGEX = /^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+(?::[a-zA-Z0-9_=,.-]+)?$/;

/** Common programmer identifiers. */
export const PROGRAMMERS: readonly string[] = [
  'default',
  'usbasp',
  'avrisp',
  'avrispmkii',
  'stk500',
  'stk500v2',
  'jtag3isp',
  'atmel_ice',
  'buspirate',
  'arduino',
  'arduinoasisp',
] as const;

/** Common upload speed values. */
export const UPLOAD_SPEEDS: readonly number[] = [
  9600, 19200, 57600, 115200, 230400, 460800, 921600,
] as const;

const DEFAULT_FQBN = 'arduino:avr:uno';
const DEFAULT_PROGRAMMER = 'default';
const DEFAULT_UPLOAD_SPEED = 115200;

// ---------------------------------------------------------------------------
// Built-in presets
// ---------------------------------------------------------------------------

export const BUILT_IN_PRESETS: readonly BoardPreset[] = [
  // Arduino AVR
  { fqbn: 'arduino:avr:uno', name: 'Arduino Uno', platform: 'Arduino AVR', arch: 'avr', uploadSpeed: 115200 },
  { fqbn: 'arduino:avr:mega', name: 'Arduino Mega 2560', platform: 'Arduino AVR', arch: 'avr', uploadSpeed: 115200 },
  { fqbn: 'arduino:avr:nano', name: 'Arduino Nano', platform: 'Arduino AVR', arch: 'avr', uploadSpeed: 57600 },
  { fqbn: 'arduino:avr:leonardo', name: 'Arduino Leonardo', platform: 'Arduino AVR', arch: 'avr', uploadSpeed: 57600 },
  { fqbn: 'arduino:avr:micro', name: 'Arduino Micro', platform: 'Arduino AVR', arch: 'avr', uploadSpeed: 57600 },

  // Arduino SAM / SAMD
  { fqbn: 'arduino:sam:arduino_due_x', name: 'Arduino Due', platform: 'Arduino SAM', arch: 'sam', uploadSpeed: 115200, programmer: 'arduino' },
  { fqbn: 'arduino:samd:arduino_zero_edbg', name: 'Arduino Zero', platform: 'Arduino SAMD', arch: 'samd', uploadSpeed: 115200 },
  { fqbn: 'arduino:samd:mkrwifi1010', name: 'Arduino MKR WiFi 1010', platform: 'Arduino SAMD', arch: 'samd', uploadSpeed: 115200 },

  // ESP32
  { fqbn: 'esp32:esp32:esp32', name: 'ESP32 Dev Module', platform: 'ESP32', arch: 'esp32', uploadSpeed: 921600 },
  { fqbn: 'esp32:esp32:esp32s3', name: 'ESP32-S3 Dev Module', platform: 'ESP32', arch: 'esp32', uploadSpeed: 921600 },

  // ESP8266
  { fqbn: 'esp8266:esp8266:nodemcuv2', name: 'NodeMCU ESP8266', platform: 'ESP8266', arch: 'esp8266', uploadSpeed: 921600 },

  // Adafruit
  { fqbn: 'adafruit:samd:adafruit_feather_m0', name: 'Adafruit Feather M0', platform: 'Adafruit SAMD', arch: 'samd', uploadSpeed: 115200 },

  // Teensy
  { fqbn: 'teensy:avr:teensy40', name: 'Teensy 4.0', platform: 'Teensy', arch: 'avr', uploadSpeed: 115200 },

  // STM32
  { fqbn: 'stm32duino:stm32:bluepill_f103c8', name: 'STM32 Blue Pill', platform: 'STM32', arch: 'stm32', uploadSpeed: 115200, programmer: 'stk500' },

  // Raspberry Pi
  { fqbn: 'rp2040:rp2040:rpipico', name: 'Raspberry Pi Pico', platform: 'Raspberry Pi RP2040', arch: 'rp2040', uploadSpeed: 115200 },
] as const;

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
    // localStorage may be unavailable (private browsing, quota exceeded, etc.)
  }
}

function loadSettings(): BoardSettings {
  const raw = safeGetLS(STORAGE_KEY);
  if (raw === null) {
    return {
      selectedFqbn: DEFAULT_FQBN,
      programmer: DEFAULT_PROGRAMMER,
      uploadSpeed: DEFAULT_UPLOAD_SPEED,
      extraFlags: '',
      customBoards: [],
    };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return {
        selectedFqbn: DEFAULT_FQBN,
        programmer: DEFAULT_PROGRAMMER,
        uploadSpeed: DEFAULT_UPLOAD_SPEED,
        extraFlags: '',
        customBoards: [],
      };
    }

    const obj = parsed as Record<string, unknown>;

    const selectedFqbn = typeof obj.selectedFqbn === 'string' && FQBN_REGEX.test(obj.selectedFqbn)
      ? obj.selectedFqbn
      : DEFAULT_FQBN;
    const programmer = typeof obj.programmer === 'string' ? obj.programmer : DEFAULT_PROGRAMMER;
    const uploadSpeed = typeof obj.uploadSpeed === 'number' && Number.isFinite(obj.uploadSpeed) && obj.uploadSpeed > 0
      ? obj.uploadSpeed
      : DEFAULT_UPLOAD_SPEED;
    const extraFlags = typeof obj.extraFlags === 'string' ? obj.extraFlags : '';
    const customBoards = Array.isArray(obj.customBoards) ? parseCustomBoards(obj.customBoards) : [];

    return { selectedFqbn, programmer, uploadSpeed, extraFlags, customBoards };
  } catch {
    return {
      selectedFqbn: DEFAULT_FQBN,
      programmer: DEFAULT_PROGRAMMER,
      uploadSpeed: DEFAULT_UPLOAD_SPEED,
      extraFlags: '',
      customBoards: [],
    };
  }
}

function parseCustomBoards(arr: unknown[]): BoardPreset[] {
  const result: BoardPreset[] = [];
  for (const item of arr) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const obj = item as Record<string, unknown>;
    if (typeof obj.fqbn !== 'string' || !FQBN_REGEX.test(obj.fqbn)) {
      continue;
    }
    if (typeof obj.name !== 'string' || obj.name.trim().length === 0) {
      continue;
    }
    if (typeof obj.platform !== 'string' || typeof obj.arch !== 'string') {
      continue;
    }
    result.push({
      fqbn: obj.fqbn,
      name: obj.name,
      platform: obj.platform,
      arch: obj.arch,
      programmer: typeof obj.programmer === 'string' ? obj.programmer : undefined,
      uploadSpeed: typeof obj.uploadSpeed === 'number' && Number.isFinite(obj.uploadSpeed) ? obj.uploadSpeed : undefined,
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// BoardSettingsManager
// ---------------------------------------------------------------------------

export class BoardSettingsManager {
  private _settings: BoardSettings;
  private _listeners = new Set<Listener>();

  private constructor() {
    this._settings = loadSettings();
  }

  /** Factory — creates a fresh instance (testing-friendly, no global singleton). */
  static create(): BoardSettingsManager {
    return new BoardSettingsManager();
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

  getSnapshot = (): BoardSettings => {
    return this._settings;
  };

  private notify(): void {
    const listeners = Array.from(this._listeners);
    for (let i = 0; i < listeners.length; i++) {
      listeners[i]();
    }
  }

  private setSettings(partial: Partial<BoardSettings>): void {
    this._settings = { ...this._settings, ...partial };
    this.persist();
    this.notify();
  }

  private persist(): void {
    safeSetLS(STORAGE_KEY, JSON.stringify(this._settings));
  }

  // -----------------------------------------------------------------------
  // Board selection
  // -----------------------------------------------------------------------

  /** Select a board by FQBN. Also applies preset upload speed if available. */
  selectBoard(fqbn: string): void {
    if (!validateFqbn(fqbn)) {
      return;
    }

    const preset = this.findPreset(fqbn);
    const updates: Partial<BoardSettings> = { selectedFqbn: fqbn };

    if (preset?.uploadSpeed) {
      updates.uploadSpeed = preset.uploadSpeed;
    }
    if (preset?.programmer) {
      updates.programmer = preset.programmer;
    }

    this.setSettings(updates);
  }

  /** Set the programmer identifier. */
  setProgrammer(programmer: string): void {
    this.setSettings({ programmer });
  }

  /** Set the upload baud rate. */
  setUploadSpeed(speed: number): void {
    if (!Number.isFinite(speed) || speed <= 0) {
      return;
    }
    this.setSettings({ uploadSpeed: Math.round(speed) });
  }

  /** Set extra compiler/linker flags. */
  setExtraFlags(flags: string): void {
    this.setSettings({ extraFlags: flags });
  }

  // -----------------------------------------------------------------------
  // Custom boards
  // -----------------------------------------------------------------------

  /** Add a custom board preset. Returns false if FQBN is invalid or already exists. */
  addCustomBoard(preset: BoardPreset): boolean {
    if (!validateFqbn(preset.fqbn)) {
      return false;
    }
    if (preset.name.trim().length === 0) {
      return false;
    }

    // Check for duplicate FQBN across built-in + custom
    if (this.findPreset(preset.fqbn)) {
      return false;
    }

    this.setSettings({
      customBoards: [...this._settings.customBoards, { ...preset }],
    });
    return true;
  }

  /** Remove a custom board by FQBN. Returns false if not found. */
  removeCustomBoard(fqbn: string): boolean {
    const idx = this._settings.customBoards.findIndex((b) => b.fqbn === fqbn);
    if (idx === -1) {
      return false;
    }

    const updated = [...this._settings.customBoards];
    updated.splice(idx, 1);

    const updates: Partial<BoardSettings> = { customBoards: updated };

    // If the removed board was selected, revert to default
    if (this._settings.selectedFqbn === fqbn) {
      updates.selectedFqbn = DEFAULT_FQBN;
    }

    this.setSettings(updates);
    return true;
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /** Get all presets: built-in + custom. */
  getPresets(): BoardPreset[] {
    return [...BUILT_IN_PRESETS, ...this._settings.customBoards];
  }

  /** Get all presets grouped by platform. */
  getPresetsByPlatform(): Map<string, BoardPreset[]> {
    const map = new Map<string, BoardPreset[]>();
    for (const preset of this.getPresets()) {
      const existing = map.get(preset.platform);
      if (existing) {
        existing.push(preset);
      } else {
        map.set(preset.platform, [preset]);
      }
    }
    return map;
  }

  /** Get the current settings snapshot. */
  getCurrentSettings(): BoardSettings {
    return { ...this._settings };
  }

  /** Find a preset by FQBN (built-in or custom). */
  findPreset(fqbn: string): BoardPreset | undefined {
    const builtIn = BUILT_IN_PRESETS.find((p) => p.fqbn === fqbn);
    if (builtIn) {
      return builtIn;
    }
    return this._settings.customBoards.find((p) => p.fqbn === fqbn);
  }

  /** Get the currently selected preset, or undefined if it's an unknown FQBN. */
  getSelectedPreset(): BoardPreset | undefined {
    return this.findPreset(this._settings.selectedFqbn);
  }

  // -----------------------------------------------------------------------
  // Import / Export
  // -----------------------------------------------------------------------

  /** Export current settings as a JSON string. */
  exportSettings(): string {
    const data: BoardSettingsExport = {
      version: 1,
      settings: { ...this._settings },
    };
    return JSON.stringify(data, null, 2);
  }

  /** Import settings from a JSON string. Returns false if invalid. */
  importSettings(json: string): boolean {
    try {
      const parsed: unknown = JSON.parse(json);
      if (typeof parsed !== 'object' || parsed === null) {
        return false;
      }

      const obj = parsed as Record<string, unknown>;
      if (obj.version !== 1) {
        return false;
      }

      if (typeof obj.settings !== 'object' || obj.settings === null) {
        return false;
      }

      const settings = obj.settings as Record<string, unknown>;
      const fqbn = typeof settings.selectedFqbn === 'string' ? settings.selectedFqbn : DEFAULT_FQBN;
      if (!validateFqbn(fqbn)) {
        return false;
      }

      const programmer = typeof settings.programmer === 'string' ? settings.programmer : DEFAULT_PROGRAMMER;
      const uploadSpeed = typeof settings.uploadSpeed === 'number' && Number.isFinite(settings.uploadSpeed) && settings.uploadSpeed > 0
        ? settings.uploadSpeed
        : DEFAULT_UPLOAD_SPEED;
      const extraFlags = typeof settings.extraFlags === 'string' ? settings.extraFlags : '';
      const customBoards = Array.isArray(settings.customBoards) ? parseCustomBoards(settings.customBoards) : [];

      this.setSettings({ selectedFqbn: fqbn, programmer, uploadSpeed, extraFlags, customBoards });
      return true;
    } catch {
      return false;
    }
  }

  // -----------------------------------------------------------------------
  // Reset
  // -----------------------------------------------------------------------

  /** Reset all settings to defaults (also for testing). */
  reset(): void {
    this._settings = {
      selectedFqbn: DEFAULT_FQBN,
      programmer: DEFAULT_PROGRAMMER,
      uploadSpeed: DEFAULT_UPLOAD_SPEED,
      extraFlags: '',
      customBoards: [],
    };
    this.persist();
    this.notify();
  }
}

// ---------------------------------------------------------------------------
// Validation (exported for external use)
// ---------------------------------------------------------------------------

/** Validate an FQBN string matches vendor:arch:board format. */
export function validateFqbn(fqbn: string): boolean {
  return FQBN_REGEX.test(fqbn);
}

// ---------------------------------------------------------------------------
// App-wide singleton
// ---------------------------------------------------------------------------

let singleton: BoardSettingsManager | null = null;

/** Get (or create) the app-wide BoardSettingsManager singleton. */
export function getBoardSettingsManager(): BoardSettingsManager {
  if (!singleton) {
    singleton = BoardSettingsManager.create();
  }
  return singleton;
}

/** Reset the singleton (for testing only). */
export function resetBoardSettingsManager(): void {
  singleton = null;
}
