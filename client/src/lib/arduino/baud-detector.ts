// ---------------------------------------------------------------------------
// Baud Rate Mismatch Detector
// ---------------------------------------------------------------------------
// Heuristic analysis of serial data to detect when the monitor baud rate
// doesn't match the device's Serial.begin() rate.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BaudMismatchResult {
  /** Whether a mismatch was detected */
  detected: boolean;
  /** Most probable correct baud rate */
  likelyBaud: number;
  /** The baud rate currently configured */
  currentBaud: number;
  /** Confidence score 0.0 – 1.0 */
  confidence: number;
  /** Human-readable explanation of the evidence */
  evidence: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Standard baud rates in ascending order */
export const STANDARD_BAUD_RATES = [
  300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800,
  921600,
] as const;

/** Minimum bytes needed for reliable detection */
export const MIN_SAMPLE_BYTES = 32;

// ASCII printable range (0x20–0x7E) plus common control chars (\r \n \t)
const PRINTABLE_MIN = 0x20;
const PRINTABLE_MAX = 0x7e;
const TAB = 0x09;
const LF = 0x0a;
const CR = 0x0d;

function isPrintableOrControl(code: number): boolean {
  return (
    (code >= PRINTABLE_MIN && code <= PRINTABLE_MAX) ||
    code === TAB ||
    code === LF ||
    code === CR
  );
}

// ---------------------------------------------------------------------------
// Heuristic helpers
// ---------------------------------------------------------------------------

/**
 * Ratio of non-printable characters in the data (0.0 – 1.0).
 */
export function nonPrintableRatio(data: string): number {
  if (data.length === 0) {
    return 0;
  }
  let nonPrintable = 0;
  for (let i = 0; i < data.length; i++) {
    if (!isPrintableOrControl(data.charCodeAt(i))) {
      nonPrintable++;
    }
  }
  return nonPrintable / data.length;
}

/**
 * Shannon entropy of the byte distribution (0.0 – 8.0).
 * High entropy + no readable strings = garbled data.
 */
export function shannonEntropy(data: string): number {
  if (data.length === 0) {
    return 0;
  }
  const freq = new Map<number, number>();
  for (let i = 0; i < data.length; i++) {
    const c = data.charCodeAt(i);
    freq.set(c, (freq.get(c) ?? 0) + 1);
  }
  let entropy = 0;
  const len = data.length;
  for (const count of freq.values()) {
    const p = count / len;
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }
  return entropy;
}

/**
 * Check if bytes cluster in a narrow range (e.g. 0xC0-0xFF) —
 * a signature of specific baud ratio mismatches.
 */
function narrowByteRange(data: string): boolean {
  if (data.length < MIN_SAMPLE_BYTES) {
    return false;
  }
  const codes = Array.from(data, (_, i) => data.charCodeAt(i));
  const min = Math.min(...codes);
  const max = Math.max(...codes);
  // If 80%+ of data sits in a range spanning less than 64 code points
  const rangeSize = max - min + 1;
  if (rangeSize > 64) {
    return false;
  }
  const inRange = codes.filter((c) => c >= min && c <= max).length;
  return inRange / codes.length >= 0.8;
}

/**
 * Check for repeating byte patterns that indicate a specific baud ratio.
 * For example, 9600 data read at 115200 produces repeated 0x00/0xFF bursts.
 */
function hasRepeatingGarble(data: string): boolean {
  if (data.length < 16) {
    return false;
  }
  // Count how many consecutive identical bytes we see
  let maxRun = 1;
  let currentRun = 1;
  for (let i = 1; i < data.length; i++) {
    if (data.charCodeAt(i) === data.charCodeAt(i - 1)) {
      currentRun++;
      if (currentRun > maxRun) {
        maxRun = currentRun;
      }
    } else {
      currentRun = 1;
    }
  }
  // Long runs of the same byte are suspicious
  return maxRun >= 4;
}

// ---------------------------------------------------------------------------
// Baud suggestion logic
// ---------------------------------------------------------------------------

/**
 * Given garbage data and the current baud rate, return likely correct baud
 * rates sorted by probability (most likely first).
 *
 * The key insight: most Arduino projects use 9600 or 115200. If the user is
 * at one, the other is the most likely answer. Beyond that, we rank by
 * popularity.
 */
export function suggestBaudRate(
  _garbageData: string,
  currentBaud: number,
): number[] {
  // Popularity-weighted ordering (most common Arduino bauds first)
  const popularityOrder = [
    115200, 9600, 57600, 38400, 19200, 230400, 460800, 921600, 4800, 2400,
    1200, 300,
  ];

  // Remove current baud from suggestions
  const filtered = popularityOrder.filter((b) => b !== currentBaud);

  // If current baud is very different from the most popular ones, prioritize
  // the two most common (9600, 115200)
  const top = currentBaud <= 9600
    ? filtered.filter((b) => b >= 57600)
    : filtered.filter((b) => b <= 19200);

  const rest = filtered.filter((b) => !top.includes(b));
  return [...top, ...rest];
}

// ---------------------------------------------------------------------------
// Main detector
// ---------------------------------------------------------------------------

/**
 * Analyze received serial data for baud rate mismatch indicators.
 */
export function detectBaudMismatch(
  data: string,
  currentBaud: number,
): BaudMismatchResult {
  const noMismatch: BaudMismatchResult = {
    detected: false,
    likelyBaud: currentBaud,
    currentBaud,
    confidence: 0,
    evidence: '',
  };

  // Need enough data to make a judgment
  if (data.length < MIN_SAMPLE_BYTES) {
    return noMismatch;
  }

  const npRatio = nonPrintableRatio(data);
  const entropy = shannonEntropy(data);
  const narrow = narrowByteRange(data);
  const repeating = hasRepeatingGarble(data);

  // --- Heuristic scoring ---
  let score = 0;
  const evidenceParts: string[] = [];

  // 1. Non-printable ratio is the strongest signal
  if (npRatio > 0.7) {
    score += 0.5;
    evidenceParts.push(`${Math.round(npRatio * 100)}% non-printable characters`);
  } else if (npRatio > 0.3) {
    score += 0.3;
    evidenceParts.push(`${Math.round(npRatio * 100)}% non-printable characters`);
  }

  // 2. High entropy with lots of garbage
  if (entropy > 5.5 && npRatio > 0.3) {
    score += 0.2;
    evidenceParts.push(`high entropy (${entropy.toFixed(1)} bits)`);
  }

  // 3. Narrow byte range clustering
  if (narrow) {
    score += 0.15;
    evidenceParts.push('byte values clustered in narrow range');
  }

  // 4. Repeating garble patterns
  if (repeating && npRatio > 0.3) {
    score += 0.15;
    evidenceParts.push('repeating garbled byte patterns');
  }

  // Clamp confidence to [0, 1]
  const confidence = Math.min(1, score);

  // Threshold: we need at least 0.3 confidence to flag a mismatch
  if (confidence < 0.3) {
    return noMismatch;
  }

  const suggestions = suggestBaudRate(data, currentBaud);
  const likelyBaud = suggestions[0] ?? 115200;

  return {
    detected: true,
    likelyBaud,
    currentBaud,
    confidence,
    evidence: evidenceParts.join('; '),
  };
}
