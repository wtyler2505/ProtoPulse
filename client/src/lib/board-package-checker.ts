/**
 * Board Package Checker
 *
 * Manages awareness of Arduino / ESP / STM / RP2040 board packages — whether
 * they are installed, their version, and whether updates are available.
 * Designed for native-desktop integration: the actual installation state is
 * resolved via the Arduino CLI (or equivalent), but this module provides the
 * data model, lookup logic, and React hook for the UI layer.
 *
 * Singleton + subscribe pattern for React integration.
 *
 * Usage:
 *   const checker = BoardPackageChecker.getInstance();
 *   checker.getInstalledPackages();
 *   checker.isPackageInstalled('arduino:avr');
 *
 * React hook:
 *   const { packages, installed, checking, checkForUpdates, isInstalled, getPackageForBoard } = usePackageChecker();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BoardPackage {
  /** Unique identifier — typically vendor:architecture (e.g. "arduino:avr"). */
  readonly name: string;
  /** Currently installed version string, or empty if not installed. */
  readonly version: string;
  /** Whether this package is currently installed locally. */
  readonly installed: boolean;
  /** Latest available version from the package index, if known. */
  readonly latestVersion?: string;
  /** True when latestVersion is known AND is newer than version. */
  readonly updateAvailable?: boolean;
}

// ---------------------------------------------------------------------------
// Known Packages Registry
// ---------------------------------------------------------------------------

/**
 * Well-known board packages that ProtoPulse knows about out of the box.
 * Each entry maps a package identifier to a human-readable label and
 * common FQBN prefixes that belong to it.
 */
export interface KnownPackageEntry {
  /** Package identifier (vendor:arch). */
  readonly id: string;
  /** Human-readable label. */
  readonly label: string;
  /** Common board names / FQBN prefixes that ship in this package. */
  readonly boards: readonly string[];
}

export const KNOWN_PACKAGES: readonly KnownPackageEntry[] = [
  {
    id: 'arduino:avr',
    label: 'Arduino AVR Boards',
    boards: ['Arduino Uno', 'Arduino Mega 2560', 'Arduino Nano', 'Arduino Leonardo', 'Arduino Micro'],
  },
  {
    id: 'arduino:sam',
    label: 'Arduino SAM Boards (32-bit ARM)',
    boards: ['Arduino Due'],
  },
  {
    id: 'arduino:samd',
    label: 'Arduino SAMD Boards (32-bit ARM)',
    boards: ['Arduino Zero', 'Arduino MKR WiFi 1010', 'Arduino MKR1000'],
  },
  {
    id: 'arduino:megaavr',
    label: 'Arduino megaAVR Boards',
    boards: ['Arduino Nano Every', 'Arduino Uno WiFi Rev2'],
  },
  {
    id: 'arduino:mbed_nano',
    label: 'Arduino Mbed OS Nano Boards',
    boards: ['Arduino Nano 33 BLE', 'Arduino Nano 33 BLE Sense', 'Arduino Nano RP2040 Connect'],
  },
  {
    id: 'arduino:mbed_rp2040',
    label: 'Arduino Mbed OS RP2040 Boards',
    boards: ['Raspberry Pi Pico (Arduino)'],
  },
  {
    id: 'esp32:esp32',
    label: 'ESP32 Boards',
    boards: ['ESP32 Dev Module', 'ESP32-S3 Dev Module', 'ESP32-S2', 'ESP32-C3'],
  },
  {
    id: 'esp8266:esp8266',
    label: 'ESP8266 Boards',
    boards: ['NodeMCU ESP8266', 'Wemos D1 Mini', 'Generic ESP8266'],
  },
  {
    id: 'STMicroelectronics:stm32',
    label: 'STM32 Boards (STMicroelectronics)',
    boards: ['STM32 Blue Pill', 'Nucleo-64', 'STM32F4 Discovery'],
  },
  {
    id: 'stm32duino:stm32',
    label: 'STM32 Boards (stm32duino)',
    boards: ['STM32 Blue Pill (stm32duino)', 'STM32F103C8'],
  },
  {
    id: 'rp2040:rp2040',
    label: 'Raspberry Pi RP2040 Boards',
    boards: ['Raspberry Pi Pico', 'Raspberry Pi Pico W', 'Adafruit Feather RP2040'],
  },
  {
    id: 'adafruit:samd',
    label: 'Adafruit SAMD Boards',
    boards: ['Adafruit Feather M0', 'Adafruit Metro M0', 'Adafruit Circuit Playground Express'],
  },
  {
    id: 'adafruit:nrf52',
    label: 'Adafruit nRF52 Boards',
    boards: ['Adafruit Feather nRF52840', 'Adafruit CLUE'],
  },
  {
    id: 'teensy:avr',
    label: 'Teensy Boards',
    boards: ['Teensy 4.0', 'Teensy 4.1', 'Teensy 3.6', 'Teensy LC'],
  },
  {
    id: 'SparkFun:avr',
    label: 'SparkFun AVR Boards',
    boards: ['SparkFun Pro Micro', 'SparkFun RedBoard'],
  },
  {
    id: 'SparkFun:apollo3',
    label: 'SparkFun Apollo3 Boards',
    boards: ['SparkFun Artemis', 'SparkFun RedBoard Artemis'],
  },
] as const;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-board-packages';

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

function safeGetLS(key: string): string | null {
  try {
    if (typeof window === 'undefined') {
      return null;
    }
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetLS(key: string, value: string): void {
  try {
    if (typeof window === 'undefined') {
      return;
    }
    localStorage.setItem(key, value);
  } catch {
    // localStorage may be unavailable
  }
}

// ---------------------------------------------------------------------------
// Version comparison
// ---------------------------------------------------------------------------

/**
 * Compare two semver-ish version strings. Returns:
 * -1 if a < b, 0 if equal, 1 if a > b.
 * Handles numeric segments only (e.g. "1.8.19" vs "1.8.20").
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const partsA = a.split('.').map((s) => parseInt(s, 10));
  const partsB = b.split('.').map((s) => parseInt(s, 10));
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const numA = partsA[i] ?? 0;
    const numB = partsB[i] ?? 0;
    if (Number.isNaN(numA) || Number.isNaN(numB)) {
      continue;
    }
    if (numA < numB) {
      return -1;
    }
    if (numA > numB) {
      return 1;
    }
  }
  return 0;
}

// ---------------------------------------------------------------------------
// BoardPackageChecker
// ---------------------------------------------------------------------------

/**
 * Tracks which board packages are installed, their versions, and whether
 * updates are available. Singleton + subscribe for React integration.
 */
export class BoardPackageChecker {
  private static instance: BoardPackageChecker | null = null;

  private packages: Map<string, BoardPackage>;
  private subscribers: Set<() => void>;
  private _checking: boolean;

  constructor() {
    this.packages = new Map();
    this.subscribers = new Set();
    this._checking = false;
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): BoardPackageChecker {
    if (!BoardPackageChecker.instance) {
      BoardPackageChecker.instance = new BoardPackageChecker();
    }
    return BoardPackageChecker.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetInstance(): void {
    BoardPackageChecker.instance = null;
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /** Whether an update check is currently in progress. */
  get checking(): boolean {
    return this._checking;
  }

  /** Get all tracked packages (installed + known uninstalled). Returns a copy. */
  getInstalledPackages(): BoardPackage[] {
    return Array.from(this.packages.values()).filter((p) => p.installed);
  }

  /** Get all packages (installed and uninstalled). Returns a copy. */
  getAllPackages(): BoardPackage[] {
    return Array.from(this.packages.values());
  }

  /** Get a single package by name, or undefined. */
  getPackage(name: string): BoardPackage | undefined {
    return this.packages.get(name);
  }

  /**
   * Check whether a board package is installed, identified by an FQBN prefix.
   * An FQBN like "arduino:avr:uno" maps to the "arduino:avr" package.
   */
  isPackageInstalled(fqbn: string): boolean {
    const pkgId = this.fqbnToPackageId(fqbn);
    if (!pkgId) {
      return false;
    }
    const pkg = this.packages.get(pkgId);
    return pkg?.installed === true;
  }

  /**
   * Find the known package entry that covers a given board name.
   * Performs a case-insensitive substring match against each known package's
   * board list.
   */
  getPackageForBoard(boardName: string): KnownPackageEntry | undefined {
    const lower = boardName.toLowerCase();
    for (const entry of KNOWN_PACKAGES) {
      for (const board of entry.boards) {
        if (board.toLowerCase().includes(lower) || lower.includes(board.toLowerCase())) {
          return entry;
        }
      }
    }
    return undefined;
  }

  /**
   * Get packages that have updates available.
   */
  getUpdatablePackages(): BoardPackage[] {
    return Array.from(this.packages.values()).filter((p) => p.updateAvailable === true);
  }

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------

  /**
   * Set a package's state (typically called after querying the Arduino CLI).
   * Creates the entry if it does not exist, merges if it does.
   */
  setPackage(pkg: BoardPackage): void {
    const existing = this.packages.get(pkg.name);
    const updated: BoardPackage = {
      name: pkg.name,
      version: pkg.version,
      installed: pkg.installed,
      latestVersion: pkg.latestVersion ?? existing?.latestVersion,
      updateAvailable: pkg.updateAvailable ?? existing?.updateAvailable,
    };
    this.packages.set(pkg.name, updated);
    this.save();
    this.notify();
  }

  /**
   * Bulk-set packages (e.g. after a full `arduino-cli core list`).
   * Replaces the entire known set.
   */
  setPackages(pkgs: BoardPackage[]): void {
    this.packages.clear();
    for (const pkg of pkgs) {
      this.packages.set(pkg.name, { ...pkg });
    }
    this.save();
    this.notify();
  }

  /**
   * Simulate checking for updates. In a real native desktop scenario this
   * would shell out to `arduino-cli core list --updatable`. Here we accept
   * an array of { name, latestVersion } and reconcile against current state.
   *
   * Sets `_checking` to true during the async operation and notifies
   * subscribers when done.
   */
  async checkForUpdates(
    updates: ReadonlyArray<{ name: string; latestVersion: string }>,
  ): Promise<BoardPackage[]> {
    this._checking = true;
    this.notify();

    try {
      const updatable: BoardPackage[] = [];

      for (const { name, latestVersion } of updates) {
        const existing = this.packages.get(name);
        if (!existing) {
          // Unknown package — record it as not installed but with known latest
          const pkg: BoardPackage = {
            name,
            version: '',
            installed: false,
            latestVersion,
            updateAvailable: false,
          };
          this.packages.set(name, pkg);
          continue;
        }

        const hasUpdate = existing.installed && compareVersions(existing.version, latestVersion) < 0;
        const updated: BoardPackage = {
          ...existing,
          latestVersion,
          updateAvailable: hasUpdate,
        };
        this.packages.set(name, updated);

        if (hasUpdate) {
          updatable.push(updated);
        }
      }

      this.save();
      return updatable;
    } finally {
      this._checking = false;
      this.notify();
    }
  }

  /** Remove a package entry entirely. */
  removePackage(name: string): boolean {
    const existed = this.packages.delete(name);
    if (existed) {
      this.save();
      this.notify();
    }
    return existed;
  }

  /** Clear all tracked packages. */
  clearAll(): void {
    if (this.packages.size === 0) {
      return;
    }
    this.packages.clear();
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   */
  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  private save(): void {
    const data = Array.from(this.packages.values());
    safeSetLS(STORAGE_KEY, JSON.stringify(data));
  }

  private load(): void {
    const raw = safeGetLS(STORAGE_KEY);
    if (!raw) {
      return;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return;
      }
      for (const item of parsed) {
        if (typeof item !== 'object' || item === null) {
          continue;
        }
        const obj = item as Record<string, unknown>;
        if (typeof obj.name !== 'string' || obj.name.trim().length === 0) {
          continue;
        }
        if (typeof obj.version !== 'string') {
          continue;
        }
        if (typeof obj.installed !== 'boolean') {
          continue;
        }
        const pkg: BoardPackage = {
          name: obj.name,
          version: obj.version,
          installed: obj.installed,
          latestVersion: typeof obj.latestVersion === 'string' ? obj.latestVersion : undefined,
          updateAvailable: typeof obj.updateAvailable === 'boolean' ? obj.updateAvailable : undefined,
        };
        this.packages.set(pkg.name, pkg);
      }
    } catch {
      // Corrupt data — start fresh
      this.packages.clear();
    }
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private notify(): void {
    this.subscribers.forEach((cb) => {
      cb();
    });
  }

  /**
   * Extract the package ID (vendor:arch) from a full FQBN like "vendor:arch:board".
   */
  private fqbnToPackageId(fqbn: string): string | undefined {
    const parts = fqbn.split(':');
    if (parts.length < 2) {
      return undefined;
    }
    return `${parts[0]}:${parts[1]}`;
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook for accessing board package state in React components.
 * Subscribes to the BoardPackageChecker singleton and triggers re-renders
 * on state changes.
 */
export function usePackageChecker(): {
  packages: BoardPackage[];
  installed: BoardPackage[];
  updatable: BoardPackage[];
  checking: boolean;
  checkForUpdates: (updates: ReadonlyArray<{ name: string; latestVersion: string }>) => Promise<BoardPackage[]>;
  setPackage: (pkg: BoardPackage) => void;
  setPackages: (pkgs: BoardPackage[]) => void;
  isInstalled: (fqbn: string) => boolean;
  getPackageForBoard: (boardName: string) => KnownPackageEntry | undefined;
  clearAll: () => void;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const checker = BoardPackageChecker.getInstance();
    const unsubscribe = checker.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const checkForUpdates = useCallback(
    async (updates: ReadonlyArray<{ name: string; latestVersion: string }>) => {
      return BoardPackageChecker.getInstance().checkForUpdates(updates);
    },
    [],
  );

  const setPackage = useCallback((pkg: BoardPackage) => {
    BoardPackageChecker.getInstance().setPackage(pkg);
  }, []);

  const setPackages = useCallback((pkgs: BoardPackage[]) => {
    BoardPackageChecker.getInstance().setPackages(pkgs);
  }, []);

  const isInstalled = useCallback((fqbn: string) => {
    return BoardPackageChecker.getInstance().isPackageInstalled(fqbn);
  }, []);

  const getPackageForBoard = useCallback((boardName: string) => {
    return BoardPackageChecker.getInstance().getPackageForBoard(boardName);
  }, []);

  const clearAll = useCallback(() => {
    BoardPackageChecker.getInstance().clearAll();
  }, []);

  const checker = BoardPackageChecker.getInstance();

  return {
    packages: typeof window !== 'undefined' ? checker.getAllPackages() : [],
    installed: typeof window !== 'undefined' ? checker.getInstalledPackages() : [],
    updatable: typeof window !== 'undefined' ? checker.getUpdatablePackages() : [],
    checking: typeof window !== 'undefined' ? checker.checking : false,
    checkForUpdates,
    setPackage,
    setPackages,
    isInstalled,
    getPackageForBoard,
    clearAll,
  };
}
