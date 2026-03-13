/**
 * MemoryUsageParser — Parses Arduino/PlatformIO compile output to extract
 * flash and RAM usage, tracks build history, and provides threshold classification.
 *
 * Singleton + subscribe pattern for useSyncExternalStore integration.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MemoryRegion {
  used: number;
  max: number;
  percent: number;
}

export interface MemoryUsage {
  flash: MemoryRegion;
  ram: MemoryRegion;
}

export interface MemoryHistory {
  timestamp: number;
  usage: MemoryUsage;
  board: string;
  sketch: string;
}

export interface MemoryDelta {
  flashDelta: number;
  ramDelta: number;
}

export type MemoryThreshold = 'normal' | 'warning' | 'critical';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-memory-history';
const MAX_HISTORY = 10;

// ---------------------------------------------------------------------------
// Regex patterns for compile output
// ---------------------------------------------------------------------------

/**
 * Arduino-cli flash line:
 *   "Sketch uses 12345 bytes (48%) of program storage space. Maximum is 32256 bytes."
 */
const ARDUINO_FLASH_RE =
  /Sketch uses (\d+) bytes \((\d+)%\) of program storage space\.\s*Maximum is (\d+) bytes\./;

/**
 * Arduino-cli RAM line:
 *   "Global variables use 456 bytes (22%) of dynamic memory, leaving 1592 bytes for local variables. Maximum is 2048 bytes."
 * Some boards omit the "leaving ... bytes" part, so that portion is optional.
 */
const ARDUINO_RAM_RE =
  /Global variables use (\d+) bytes \((\d+)%\) of dynamic memory(?:,\s*leaving \d+ bytes for local variables)?\.\s*Maximum is (\d+) bytes\./;

/**
 * PlatformIO flash line:
 *   "Flash: [====      ]  48.2% (used 12345 bytes from 32256 bytes)"
 *   "FLASH: [====      ]  48.2% (used 12345 bytes from 32256 bytes)"
 */
const PIO_FLASH_RE =
  /FLASH:\s*\[[\s=]*\]\s*([\d.]+)%\s*\(used (\d+) bytes from (\d+) bytes\)/i;

/**
 * PlatformIO RAM line:
 *   "RAM:   [==        ]  22.3% (used 456 bytes from 2048 bytes)"
 */
const PIO_RAM_RE =
  /RAM:\s*\[[\s=]*\]\s*([\d.]+)%\s*\(used (\d+) bytes from (\d+) bytes\)/i;

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Parse Arduino/PlatformIO compile stdout to extract memory usage.
 *
 * Returns null if neither flash nor RAM information could be found.
 * Returns partial data (flash only, RAM only) gracefully — missing
 * regions get zeroed out.
 */
export function parseMemoryOutput(stdout: string): MemoryUsage | null {
  let flash: MemoryRegion | null = null;
  let ram: MemoryRegion | null = null;

  // Try Arduino-cli format first
  const arduinoFlash = ARDUINO_FLASH_RE.exec(stdout);
  if (arduinoFlash) {
    const used = parseInt(arduinoFlash[1], 10);
    const max = parseInt(arduinoFlash[3], 10);
    const percent = parseInt(arduinoFlash[2], 10);
    flash = { used, max, percent };
  }

  const arduinoRam = ARDUINO_RAM_RE.exec(stdout);
  if (arduinoRam) {
    const used = parseInt(arduinoRam[1], 10);
    const max = parseInt(arduinoRam[3], 10);
    const percent = parseInt(arduinoRam[2], 10);
    ram = { used, max, percent };
  }

  // If Arduino format didn't match, try PlatformIO format
  if (!flash) {
    const pioFlash = PIO_FLASH_RE.exec(stdout);
    if (pioFlash) {
      const used = parseInt(pioFlash[2], 10);
      const max = parseInt(pioFlash[3], 10);
      const percent = parseFloat(pioFlash[1]);
      flash = { used, max, percent };
    }
  }

  if (!ram) {
    const pioRam = PIO_RAM_RE.exec(stdout);
    if (pioRam) {
      const used = parseInt(pioRam[2], 10);
      const max = parseInt(pioRam[3], 10);
      const percent = parseFloat(pioRam[1]);
      ram = { used, max, percent };
    }
  }

  // Nothing found at all
  if (!flash && !ram) {
    return null;
  }

  return {
    flash: flash ?? { used: 0, max: 0, percent: 0 },
    ram: ram ?? { used: 0, max: 0, percent: 0 },
  };
}

/**
 * Classify a percentage into threshold levels for visual indication.
 *   - normal:   < 75%
 *   - warning:  75% – 90% (inclusive)
 *   - critical: > 90%
 */
export function getThreshold(percent: number): MemoryThreshold {
  if (percent > 90) {
    return 'critical';
  }
  if (percent >= 75) {
    return 'warning';
  }
  return 'normal';
}

/**
 * Format a byte count into a human-readable string with SI units.
 *
 * Examples:
 *   0       → "0 B"
 *   512     → "512 B"
 *   1024    → "1.00 KB"
 *   1536    → "1.50 KB"
 *   1048576 → "1.00 MB"
 */
export function formatBytes(bytes: number): string {
  if (bytes < 0) {
    return `-${formatBytes(-bytes)}`;
  }
  if (bytes === 0) {
    return '0 B';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// MemoryUsageManager
// ---------------------------------------------------------------------------

/**
 * Manages memory usage history from compile builds.
 *
 * Stores the last MAX_HISTORY builds in localStorage, computes deltas
 * between builds, and supports the singleton+subscribe pattern for
 * reactive React integration via useSyncExternalStore.
 *
 * Use `MemoryUsageManager.create()` for testing-friendly instances.
 */
export class MemoryUsageManager {
  private history: MemoryHistory[] = [];
  private listeners = new Set<Listener>();
  private _version = 0;

  private constructor() {
    this.load();
  }

  /** Factory — creates a fresh instance (testing-friendly, no global singleton). */
  static create(): MemoryUsageManager {
    return new MemoryUsageManager();
  }

  // -----------------------------------------------------------------------
  // Subscription (useSyncExternalStore compatible)
  // -----------------------------------------------------------------------

  /** Subscribe to change notifications. Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Monotonic version counter for useSyncExternalStore. */
  get version(): number {
    return this._version;
  }

  /**
   * Immutable snapshot — returns a frozen copy of the current history array.
   * A new array reference is returned on every mutation so React detects changes.
   */
  getSnapshot(): readonly MemoryHistory[] {
    return this.history;
  }

  // -----------------------------------------------------------------------
  // Query API
  // -----------------------------------------------------------------------

  /** Get the full build history (most recent last). */
  getHistory(): MemoryHistory[] {
    return [...this.history];
  }

  /** Get the most recent build entry, or undefined if history is empty. */
  getLatest(): MemoryHistory | undefined {
    return this.history.length > 0
      ? this.history[this.history.length - 1]
      : undefined;
  }

  /**
   * Compute the delta between the given usage and the most recent build
   * in history. Returns null if there is no prior build to compare against.
   */
  getDelta(current: MemoryUsage): MemoryDelta | null {
    const latest = this.getLatest();
    if (!latest) {
      return null;
    }
    return {
      flashDelta: current.flash.used - latest.usage.flash.used,
      ramDelta: current.ram.used - latest.usage.ram.used,
    };
  }

  // -----------------------------------------------------------------------
  // Mutation API
  // -----------------------------------------------------------------------

  /**
   * Record a new build's memory usage. Trims history to MAX_HISTORY entries
   * (FIFO) and persists to localStorage.
   */
  addToHistory(usage: MemoryUsage, board: string, sketch: string): void {
    const entry: MemoryHistory = {
      timestamp: Date.now(),
      usage,
      board,
      sketch,
    };

    this.history = [...this.history, entry];

    // Trim oldest entries beyond limit
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(this.history.length - MAX_HISTORY);
    }

    this._version++;
    this.persist();
    this.notify();
  }

  /** Clear all history entries. */
  clearHistory(): void {
    if (this.history.length === 0) {
      return;
    }
    this.history = [];
    this._version++;
    this.persist();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private notify(): void {
    for (const listener of Array.from(this.listeners)) {
      listener();
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history));
    } catch {
      // localStorage may be unavailable or full
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.history = parsed as MemoryHistory[];
        }
      }
    } catch {
      // Corrupt data — start fresh
      this.history = [];
    }
  }
}

// ---------------------------------------------------------------------------
// Default singleton instance
// ---------------------------------------------------------------------------

let _defaultInstance: MemoryUsageManager | null = null;

/** Get or create the default singleton MemoryUsageManager. */
export function getMemoryUsageManager(): MemoryUsageManager {
  if (!_defaultInstance) {
    _defaultInstance = MemoryUsageManager.create();
  }
  return _defaultInstance;
}

/** Reset the singleton (for testing only). */
export function _resetMemoryUsageManager(): void {
  _defaultInstance = null;
}
