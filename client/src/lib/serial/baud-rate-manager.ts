/**
 * BaudRateManager — Manages baud rate selection, auto-detection, and mismatch warnings.
 *
 * Provides standard baud rate constants, heuristic auto-detection from sample bytes
 * (scoring by printable ASCII ratio, valid UTF-8 sequences, line-ending frequency),
 * last-used rate persistence to localStorage, and mismatch detection for garbled data.
 *
 * Singleton + subscribe pattern for useSyncExternalStore integration.
 * Pure module — no React/DOM dependencies.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = () => void;

export interface BaudRateState {
  selectedRate: number;
  isAutoDetecting: boolean;
  detectedRate: number | null;
  confidence: number;
  lastUsedRate: number;
  mismatchWarning: boolean;
}

export interface AutoDetectResult {
  rate: number;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** All standard baud rates in ascending order. */
export const STANDARD_BAUD_RATES: readonly number[] = [
  300, 1200, 2400, 4800, 9600, 19200, 38400, 57600,
  115200, 230400, 250000, 500000, 1000000, 2000000,
] as const;

/** Top 5 most commonly used rates for quick-pick UI. */
const COMMON_RATES: readonly number[] = [9600, 115200, 57600, 38400, 19200] as const;

const DEFAULT_RATE = 9600;

const STORAGE_KEY_SELECTED = 'protopulse:baud:selected';
const STORAGE_KEY_LAST_USED = 'protopulse:baud:lastUsed';

/** Minimum sample size for meaningful auto-detection scoring. */
const MIN_SAMPLE_SIZE = 8;

/** Threshold ratio of non-printable bytes to flag mismatch. */
const MISMATCH_THRESHOLD = 0.5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeParseLSNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return fallback;
    }
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  } catch {
    return fallback;
  }
}

function safeSetLS(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage may be unavailable (private browsing, quota exceeded, etc.)
  }
}

/**
 * Score a byte array for "readability" — how likely the data was received at
 * the correct baud rate. Higher = better.
 *
 * Criteria:
 *   1. Printable ASCII ratio (bytes 0x20-0x7E, tab, CR, LF)
 *   2. Valid UTF-8 multi-byte sequence count (bonus)
 *   3. Line-ending frequency (more \n or \r\n = more likely correct)
 */
function scoreSample(bytes: Uint8Array): number {
  if (bytes.length === 0) {
    return 0;
  }

  let printable = 0;
  let lineEndings = 0;
  let utf8Sequences = 0;

  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];

    // Printable ASCII (space through tilde) + common control chars
    if ((b >= 0x20 && b <= 0x7e) || b === 0x09 || b === 0x0a || b === 0x0d) {
      printable++;
    }

    // Count line endings
    if (b === 0x0a) {
      lineEndings++;
    }

    // Detect valid UTF-8 multi-byte sequences (2-byte: 110xxxxx 10xxxxxx)
    if (b >= 0xc0 && b <= 0xdf && i + 1 < bytes.length) {
      const next = bytes[i + 1];
      if (next >= 0x80 && next <= 0xbf) {
        utf8Sequences++;
      }
    }
  }

  const printableRatio = printable / bytes.length;
  const lineEndingBonus = Math.min(lineEndings / Math.max(bytes.length / 40, 1), 1) * 0.15;
  const utf8Bonus = Math.min(utf8Sequences / Math.max(bytes.length / 20, 1), 1) * 0.05;

  return Math.min(printableRatio + lineEndingBonus + utf8Bonus, 1);
}

/**
 * Check if a byte is non-printable (i.e., not valid ASCII text).
 * Allows tab (0x09), LF (0x0A), CR (0x0D), and printable range (0x20-0x7E).
 */
function isNonPrintable(b: number): boolean {
  return !((b >= 0x20 && b <= 0x7e) || b === 0x09 || b === 0x0a || b === 0x0d);
}

// ---------------------------------------------------------------------------
// BaudRateManager
// ---------------------------------------------------------------------------

export class BaudRateManager {
  private _state: BaudRateState;
  private _listeners = new Set<Listener>();

  private constructor() {
    const selected = safeParseLSNumber(STORAGE_KEY_SELECTED, DEFAULT_RATE);
    const lastUsed = safeParseLSNumber(STORAGE_KEY_LAST_USED, DEFAULT_RATE);

    this._state = {
      selectedRate: selected,
      isAutoDetecting: false,
      detectedRate: null,
      confidence: 0,
      lastUsedRate: lastUsed,
      mismatchWarning: false,
    };
  }

  /** Factory — creates a fresh instance (testing-friendly, no global singleton). */
  static create(): BaudRateManager {
    return new BaudRateManager();
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

  getSnapshot = (): BaudRateState => {
    return this._state;
  };

  private notify(): void {
    const listeners = Array.from(this._listeners);
    for (let i = 0; i < listeners.length; i++) {
      listeners[i]();
    }
  }

  private setState(partial: Partial<BaudRateState>): void {
    this._state = { ...this._state, ...partial };
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Rate management
  // -----------------------------------------------------------------------

  /** Set the selected baud rate, persist to localStorage, and update lastUsedRate. */
  setRate(rate: number): void {
    if (!Number.isFinite(rate) || rate <= 0) {
      return;
    }

    const rounded = Math.round(rate);
    safeSetLS(STORAGE_KEY_SELECTED, String(rounded));
    safeSetLS(STORAGE_KEY_LAST_USED, String(rounded));
    this.setState({
      selectedRate: rounded,
      lastUsedRate: rounded,
      mismatchWarning: false,
    });
  }

  /** Return the currently selected baud rate. */
  getRate(): number {
    return this._state.selectedRate;
  }

  /** Return the last successfully used baud rate from localStorage. */
  getLastUsedRate(): number {
    return this._state.lastUsedRate;
  }

  // -----------------------------------------------------------------------
  // Auto-detection
  // -----------------------------------------------------------------------

  /**
   * Heuristic auto-detection: score a sample byte buffer at each standard
   * baud rate's expected data pattern. Since we cannot re-sample at different
   * baud rates in software (the physical baud rate is set at the port level),
   * this scores the *current* sample for readability. The idea is that the
   * caller can capture short samples at each candidate rate and call autoDetect
   * for each, or use the score from the current rate to decide if a switch is
   * needed.
   *
   * For a single-sample heuristic (the common case), we score the provided
   * bytes and recommend the current rate if the score is high enough, or
   * the most common rate (9600/115200) as a suggestion if the data is garbled.
   *
   * Returns the best-scoring rate and a confidence value (0-1).
   *   - confidence > 0.7 = high (data looks like clean ASCII/UTF-8 text)
   *   - confidence 0.4-0.7 = medium (some readable data but noisy)
   *   - confidence < 0.4 = low (mostly garbled)
   */
  autoDetect(sampleBytes: Uint8Array): AutoDetectResult {
    this.setState({ isAutoDetecting: true });

    if (sampleBytes.length < MIN_SAMPLE_SIZE) {
      const result: AutoDetectResult = { rate: this._state.selectedRate, confidence: 0 };
      this.setState({
        isAutoDetecting: false,
        detectedRate: result.rate,
        confidence: result.confidence,
      });
      return result;
    }

    const score = scoreSample(sampleBytes);

    // If the current data scores well, keep the current rate
    if (score >= 0.7) {
      const result: AutoDetectResult = { rate: this._state.selectedRate, confidence: score };
      this.setState({
        isAutoDetecting: false,
        detectedRate: result.rate,
        confidence: result.confidence,
        mismatchWarning: false,
      });
      return result;
    }

    // Data is garbled — suggest the most common alternative rate.
    // Pick the first common rate that differs from the current one.
    let suggestedRate = DEFAULT_RATE;
    for (const rate of COMMON_RATES) {
      if (rate !== this._state.selectedRate) {
        suggestedRate = rate;
        break;
      }
    }

    const result: AutoDetectResult = { rate: suggestedRate, confidence: score };
    this.setState({
      isAutoDetecting: false,
      detectedRate: result.rate,
      confidence: result.confidence,
      mismatchWarning: score < MISMATCH_THRESHOLD,
    });
    return result;
  }

  // -----------------------------------------------------------------------
  // Mismatch detection
  // -----------------------------------------------------------------------

  /**
   * Quick check if received data looks garbled (high ratio of non-printable
   * bytes), indicating likely wrong baud rate. Sets mismatchWarning flag.
   */
  checkMismatch(receivedBytes: Uint8Array): boolean {
    if (receivedBytes.length === 0) {
      this.setState({ mismatchWarning: false });
      return false;
    }

    let nonPrintable = 0;
    for (let i = 0; i < receivedBytes.length; i++) {
      if (isNonPrintable(receivedBytes[i])) {
        nonPrintable++;
      }
    }

    const ratio = nonPrintable / receivedBytes.length;
    const isMismatch = ratio >= MISMATCH_THRESHOLD;
    this.setState({ mismatchWarning: isMismatch });
    return isMismatch;
  }

  /** Manually dismiss the mismatch warning. */
  dismissMismatchWarning(): void {
    this.setState({ mismatchWarning: false });
  }

  // -----------------------------------------------------------------------
  // Utility
  // -----------------------------------------------------------------------

  /** Return the top 5 most commonly used baud rates for quick-pick UI. */
  getCommonRates(): readonly number[] {
    return COMMON_RATES;
  }

  /** Returns true if the given rate is not in STANDARD_BAUD_RATES. */
  isCustomRate(rate: number): boolean {
    return !STANDARD_BAUD_RATES.includes(rate);
  }

  /**
   * Format a baud rate for human display.
   *
   * Examples:
   *   300    → "300 baud"
   *   9600   → "9600 baud"
   *   115200 → "115.2k baud"
   *   1000000 → "1M baud"
   *   2000000 → "2M baud"
   *   250000 → "250k baud"
   */
  formatRate(rate: number): string {
    if (!Number.isFinite(rate) || rate <= 0) {
      return '0 baud';
    }

    if (rate >= 1000000 && rate % 1000000 === 0) {
      return `${String(rate / 1000000)}M baud`;
    }

    if (rate >= 1000) {
      const k = rate / 1000;
      // Use integer form if exact, otherwise one decimal place
      if (Number.isInteger(k)) {
        return `${String(k)}k baud`;
      }
      // Check if one decimal is sufficient (e.g., 115.2)
      const oneDecimal = Math.round(k * 10) / 10;
      if (Math.abs(oneDecimal * 1000 - rate) < 0.5) {
        return `${String(oneDecimal)}k baud`;
      }
      return `${String(k)}k baud`;
    }

    return `${String(rate)} baud`;
  }

  /** Reset all state to defaults (for testing). */
  reset(): void {
    this._state = {
      selectedRate: DEFAULT_RATE,
      isAutoDetecting: false,
      detectedRate: null,
      confidence: 0,
      lastUsedRate: DEFAULT_RATE,
      mismatchWarning: false,
    };
    this.notify();
  }
}

// ---------------------------------------------------------------------------
// App-wide singleton
// ---------------------------------------------------------------------------

let singleton: BaudRateManager | null = null;

/** Get (or create) the app-wide BaudRateManager singleton. */
export function getBaudRateManager(): BaudRateManager {
  if (!singleton) {
    singleton = BaudRateManager.create();
  }
  return singleton;
}

/** Reset the singleton (for testing only). */
export function resetBaudRateManager(): void {
  singleton = null;
}
