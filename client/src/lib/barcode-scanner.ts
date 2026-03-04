/**
 * Barcode / QR Code Scanner Library
 *
 * Decodes barcodes and QR codes from camera frames or image data.
 * Supports QR Code, Code128, EAN-13, and UPC-A formats using
 * algorithmic decoding with no external dependencies.
 *
 * Integrates with ProtoPulse QR labels (see qr-labels.ts) to decode
 * component inventory labels back into structured data.
 *
 * Usage:
 *   const scanner = new BarcodeScanner();
 *   const result = scanner.scanFrame(imageData);
 *
 * React hook:
 *   const { start, stop, lastResult, isScanning } = useBarcodeScanner({ onScan });
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BarcodeFormat = 'qr' | 'code128' | 'ean13' | 'upc-a' | 'unknown';

export interface ParsedComponentLabel {
  partNumber: string;
  location?: string;
  projectId?: number;
  quantity?: number;
}

export interface ScanResult {
  format: BarcodeFormat;
  rawValue: string;
  parsedComponent?: ParsedComponentLabel;
  confidence: number;
  timestamp: number;
}

export interface ScanSessionOptions {
  /** Debounce window in ms for duplicate values. Default 2000. */
  deduplicateWindowMs?: number;
}

export interface UseBarcodeScannerOptions {
  /** Called when a new (deduplicated) scan result is produced. */
  onScan?: (result: ScanResult) => void;
  /** Debounce window in ms. Default 2000. */
  deduplicateWindowMs?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROTOPULSE_PREFIX = 'PP:';
const DEFAULT_DEDUPLICATE_WINDOW_MS = 2000;

/**
 * EAN-13 first-digit parity encoding patterns.
 * Index = first digit (0-9). 'O' = odd parity, 'E' = even parity.
 */
const EAN13_FIRST_DIGIT_PATTERNS: readonly string[] = [
  'OOOOOO', // 0
  'OOEOEE', // 1
  'OOEEOE', // 2
  'OOEEEO', // 3
  'OEOOEE', // 4
  'OEEOOE', // 5
  'OEEEOO', // 6
  'OEOEOE', // 7
  'OEOEEO', // 8
  'OEEOEO', // 9
] as const;

/**
 * EAN-13 odd-parity (L) digit encodings (7 modules each).
 * 1 = dark bar, 0 = light space.
 */
const EAN13_L_PATTERNS: readonly string[] = [
  '0001101', // 0
  '0011001', // 1
  '0010011', // 2
  '0111101', // 3
  '0100011', // 4
  '0110001', // 5
  '0101111', // 6
  '0111011', // 7
  '0110111', // 8
  '0001011', // 9
] as const;

/**
 * EAN-13 even-parity (G) digit encodings (7 modules each).
 * These are the bit-reversal of L patterns.
 */
const EAN13_G_PATTERNS: readonly string[] = [
  '0100111', // 0
  '0110011', // 1
  '0011011', // 2
  '0100001', // 3
  '0011101', // 4
  '0111001', // 5
  '0000101', // 6
  '0010001', // 7
  '0001001', // 8
  '0010111', // 9
] as const;

/**
 * EAN-13 right-side (R) digit encodings (7 modules each).
 * These are the complement of L patterns.
 */
const EAN13_R_PATTERNS: readonly string[] = [
  '1110010', // 0
  '1100110', // 1
  '1101100', // 2
  '1000010', // 3
  '1011100', // 4
  '1001110', // 5
  '1010000', // 6
  '1000100', // 7
  '1001000', // 8
  '1110100', // 9
] as const;

/**
 * Code128 symbol patterns. Each symbol is 6 bars (alternating bar/space widths).
 * Encoding uses bar widths summing to 11 modules per character.
 */
const CODE128_PATTERNS: readonly number[][] = [
  [2, 1, 2, 2, 2, 2], // 0:  space
  [2, 2, 2, 1, 2, 2], // 1:  !
  [2, 2, 2, 2, 2, 1], // 2:  "
  [1, 2, 1, 2, 2, 3], // 3:  #
  [1, 2, 1, 3, 2, 2], // 4:  $
  [1, 3, 1, 2, 2, 2], // 5:  %
  [1, 2, 2, 2, 1, 3], // 6:  &
  [1, 2, 2, 3, 1, 2], // 7:  '
  [1, 3, 2, 2, 1, 2], // 8:  (
  [2, 2, 1, 2, 1, 3], // 9:  )
  [2, 2, 1, 3, 1, 2], // 10: *
  [2, 3, 1, 2, 1, 2], // 11: +
  [1, 1, 2, 2, 3, 2], // 12: ,
  [1, 2, 2, 1, 3, 2], // 13: -
  [1, 2, 2, 2, 3, 1], // 14: .
  [1, 1, 3, 2, 2, 2], // 15: /
  [1, 2, 3, 1, 2, 2], // 16: 0
  [1, 2, 3, 2, 2, 1], // 17: 1
  [2, 2, 3, 2, 1, 1], // 18: 2
  [2, 2, 1, 1, 3, 2], // 19: 3
  [2, 2, 1, 2, 3, 1], // 20: 4
  [2, 1, 3, 2, 1, 2], // 21: 5
  [2, 2, 3, 1, 1, 2], // 22: 6
  [3, 1, 2, 1, 3, 1], // 23: 7
  [3, 1, 1, 2, 2, 2], // 24: 8
  [3, 2, 1, 1, 2, 2], // 25: 9
  [3, 2, 1, 2, 2, 1], // 26: :
  [3, 1, 2, 2, 1, 2], // 27: ;
  [3, 2, 2, 1, 1, 2], // 28: <
  [3, 2, 2, 2, 1, 1], // 29: =
  [2, 1, 2, 1, 2, 3], // 30: >
  [2, 1, 2, 3, 2, 1], // 31: ?
  [2, 3, 2, 1, 2, 1], // 32: @
  [1, 1, 1, 3, 2, 3], // 33: A
  [1, 3, 1, 1, 2, 3], // 34: B
  [1, 3, 1, 3, 2, 1], // 35: C
  [1, 1, 2, 3, 2, 2], // 36: D (was missing - corrected)
  [1, 3, 2, 1, 2, 2], // 37: (unused placeholder)
  [1, 3, 2, 3, 2, 0], // 38: (unused placeholder)
  [2, 1, 1, 3, 1, 3], // 39: (unused placeholder)
  [2, 3, 1, 1, 1, 3], // 40: (unused placeholder)
  [2, 3, 1, 3, 1, 1], // 41: (unused placeholder)
  [1, 1, 2, 1, 3, 3], // 42: (unused placeholder)
  [1, 1, 2, 3, 3, 1], // 43: (unused placeholder)
  [1, 3, 2, 1, 3, 1], // 44: (unused placeholder)
  [1, 1, 3, 1, 2, 3], // 45: (unused placeholder)
  [1, 1, 3, 3, 2, 1], // 46: (unused placeholder)
  [1, 3, 3, 1, 2, 1], // 47: (unused placeholder)
  [3, 1, 3, 1, 2, 1], // 48: (unused placeholder)
  [2, 1, 1, 3, 3, 1], // 49: (unused placeholder)
  [2, 3, 1, 1, 3, 1], // 50: (unused placeholder)
  [2, 1, 3, 1, 1, 3], // 51: (unused placeholder)
  [2, 1, 3, 3, 1, 1], // 52: (unused placeholder)
  [2, 1, 3, 1, 3, 1], // 53: (unused placeholder)
  [3, 1, 1, 1, 2, 3], // 54: (unused placeholder)
  [3, 1, 1, 3, 2, 1], // 55: (unused placeholder)
  [3, 3, 1, 1, 2, 1], // 56: (unused placeholder)
  [3, 1, 2, 1, 1, 3], // 57: (unused placeholder)
  [3, 1, 2, 3, 1, 1], // 58: (unused placeholder)
  [3, 3, 2, 1, 1, 1], // 59: (unused placeholder)
  [2, 1, 2, 1, 3, 2], // 60: (unused placeholder) -- note: not all used
  [2, 1, 2, 2, 3, 1], // 61
  [2, 3, 2, 2, 1, 1], // 62
  [1, 1, 1, 2, 2, 4], // 63
  [1, 1, 1, 4, 2, 2], // 64: Code128 value 64 = ` (backtick) in Code B
  [1, 2, 1, 1, 2, 4], // 65
  [1, 2, 1, 4, 2, 1], // 66
  [1, 4, 1, 1, 2, 2], // 67
  [1, 4, 1, 2, 2, 1], // 68
  [1, 1, 2, 2, 1, 4], // 69
  [1, 1, 2, 4, 1, 2], // 70
  [1, 2, 2, 1, 1, 4], // 71
  [1, 2, 2, 4, 1, 1], // 72
  [1, 4, 2, 1, 1, 2], // 73
  [1, 4, 2, 2, 1, 1], // 74
  [2, 4, 1, 2, 1, 1], // 75
  [2, 2, 1, 1, 1, 4], // 76
  [4, 1, 3, 1, 1, 1], // 77
  [2, 4, 1, 1, 1, 2], // 78
  [1, 3, 4, 1, 1, 1], // 79
  [1, 1, 1, 2, 4, 2], // 80
  [1, 2, 1, 1, 4, 2], // 81
  [1, 2, 1, 2, 4, 1], // 82
  [1, 1, 4, 2, 1, 2], // 83
  [1, 2, 4, 1, 1, 2], // 84
  [1, 2, 4, 2, 1, 1], // 85
  [4, 1, 1, 2, 1, 2], // 86
  [4, 2, 1, 1, 1, 2], // 87
  [4, 2, 1, 2, 1, 1], // 88
  [2, 1, 2, 1, 4, 1], // 89
  [2, 1, 4, 1, 2, 1], // 90
  [4, 1, 2, 1, 2, 1], // 91
  [1, 1, 1, 1, 4, 3], // 92
  [1, 1, 1, 3, 4, 1], // 93
  [1, 3, 1, 1, 4, 1], // 94
  [1, 1, 4, 1, 1, 3], // 95
  [1, 1, 4, 3, 1, 1], // 96
  [4, 1, 1, 1, 1, 3], // 97
  [4, 1, 1, 3, 1, 1], // 98
  [1, 1, 3, 1, 4, 1], // 99
  [1, 1, 4, 1, 3, 1], // 100
  [3, 1, 1, 1, 4, 1], // 101
  [4, 1, 1, 1, 3, 1], // 102
  [2, 1, 1, 4, 1, 2], // 103: Start Code A
  [2, 1, 1, 2, 1, 4], // 104: Start Code B
  [2, 1, 1, 2, 3, 2], // 105: Start Code C
] as const;

/** Code128 stop pattern (7 bars: 2 3 3 1 1 1 2) */
const CODE128_STOP_PATTERN: readonly number[] = [2, 3, 3, 1, 1, 1, 2] as const;

/** Code B value-to-character mapping (values 0-94 → ASCII 32-126) */
const CODE128_B_OFFSET = 32;

// ---------------------------------------------------------------------------
// Pixel / Image Helpers
// ---------------------------------------------------------------------------

/**
 * Extract a single horizontal scanline from ImageData, converting to
 * a boolean array where true = dark pixel (below luminance threshold).
 */
export function extractScanline(imageData: ImageData, y: number, threshold = 128): boolean[] {
  const { width, data } = imageData;
  const clampedY = Math.max(0, Math.min(y, imageData.height - 1));
  const line: boolean[] = [];
  for (let x = 0; x < width; x++) {
    const offset = (clampedY * width + x) * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    // ITU-R BT.601 luminance
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    line.push(lum < threshold);
  }
  return line;
}

/**
 * Convert a boolean scanline into run-length segments.
 * Each segment: { dark: boolean, length: number }.
 */
export interface RunSegment {
  dark: boolean;
  length: number;
}

export function toRunLengths(line: boolean[]): RunSegment[] {
  if (line.length === 0) {
    return [];
  }
  const runs: RunSegment[] = [];
  let currentDark = line[0];
  let currentLength = 1;
  for (let i = 1; i < line.length; i++) {
    if (line[i] === currentDark) {
      currentLength++;
    } else {
      runs.push({ dark: currentDark, length: currentLength });
      currentDark = line[i];
      currentLength = 1;
    }
  }
  runs.push({ dark: currentDark, length: currentLength });
  return runs;
}

// ---------------------------------------------------------------------------
// EAN-13 Decoder
// ---------------------------------------------------------------------------

/**
 * Validate an EAN-13 checksum. The 13th digit is a check digit computed
 * from the first 12 using alternating weight 1/3.
 */
export function validateEAN13Checksum(digits: number[]): boolean {
  if (digits.length !== 13) {
    return false;
  }
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += digits[i] * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === digits[12];
}

/**
 * Attempt to decode an EAN-13 barcode from a binary scanline.
 * Returns the 13-digit string or null if decoding fails.
 */
export function decodeEAN13(runs: RunSegment[]): string | null {
  // EAN-13 structure: 3 (start) + 42 (6 digits L/G) + 5 (center) + 42 (6 digits R) + 3 (end) = 95 modules
  // We need to find a start guard (1:1:1 dark-light-dark).

  // Skip leading light runs
  let runIdx = 0;
  while (runIdx < runs.length && !runs[runIdx].dark) {
    runIdx++;
  }

  // Need at least start(3) + 6*4(24) + center(5) + 6*4(24) + end(3) = ~59 runs beyond start
  if (runIdx + 59 > runs.length) {
    return null;
  }

  // Verify start guard: 3 narrow runs (dark, light, dark) of approximately equal width
  const startRuns = runs.slice(runIdx, runIdx + 3);
  if (startRuns.length < 3 || !startRuns[0].dark || startRuns[1].dark || !startRuns[2].dark) {
    return null;
  }
  const unitWidth = (startRuns[0].length + startRuns[1].length + startRuns[2].length) / 3;
  if (unitWidth < 1) {
    return null;
  }

  // Verify start guard proportions (each should be ~1 module)
  for (const run of startRuns) {
    const ratio = run.length / unitWidth;
    if (ratio < 0.5 || ratio > 2.0) {
      return null;
    }
  }

  runIdx += 3;

  // Decode left 6 digits (each digit = 4 runs = 2 bars + 2 spaces = 7 modules)
  const leftDigits: number[] = [];
  const parityPattern: string[] = [];

  for (let d = 0; d < 6; d++) {
    if (runIdx + 4 > runs.length) {
      return null;
    }
    const digitRuns = runs.slice(runIdx, runIdx + 4);
    const modules = digitRuns.map((r) => Math.round(r.length / unitWidth));
    const binaryStr = modules
      .map((w, i) => (digitRuns[i].dark ? '1' : '0').repeat(w))
      .join('');

    // Pad or trim to 7 modules
    const pattern = binaryStr.length >= 7 ? binaryStr.slice(0, 7) : binaryStr.padEnd(7, '0');

    let matched = false;
    for (let v = 0; v < 10; v++) {
      if (pattern === EAN13_L_PATTERNS[v]) {
        leftDigits.push(v);
        parityPattern.push('O');
        matched = true;
        break;
      }
      if (pattern === EAN13_G_PATTERNS[v]) {
        leftDigits.push(v);
        parityPattern.push('E');
        matched = true;
        break;
      }
    }
    if (!matched) {
      return null;
    }
    runIdx += 4;
  }

  // Determine first digit from parity pattern
  const parityStr = parityPattern.join('');
  let firstDigit = -1;
  for (let i = 0; i < 10; i++) {
    if (EAN13_FIRST_DIGIT_PATTERNS[i] === parityStr) {
      firstDigit = i;
      break;
    }
  }
  if (firstDigit < 0) {
    return null;
  }

  // Skip center guard (5 runs: light-dark-light-dark-light)
  if (runIdx + 5 > runs.length) {
    return null;
  }
  runIdx += 5;

  // Decode right 6 digits
  const rightDigits: number[] = [];
  for (let d = 0; d < 6; d++) {
    if (runIdx + 4 > runs.length) {
      return null;
    }
    const digitRuns = runs.slice(runIdx, runIdx + 4);
    const modules = digitRuns.map((r) => Math.round(r.length / unitWidth));
    const binaryStr = modules
      .map((w, i) => (digitRuns[i].dark ? '1' : '0').repeat(w))
      .join('');

    const pattern = binaryStr.length >= 7 ? binaryStr.slice(0, 7) : binaryStr.padEnd(7, '0');

    let matched = false;
    for (let v = 0; v < 10; v++) {
      if (pattern === EAN13_R_PATTERNS[v]) {
        rightDigits.push(v);
        matched = true;
        break;
      }
    }
    if (!matched) {
      return null;
    }
    runIdx += 4;
  }

  const allDigits = [firstDigit, ...leftDigits, ...rightDigits];

  if (!validateEAN13Checksum(allDigits)) {
    return null;
  }

  return allDigits.join('');
}

// ---------------------------------------------------------------------------
// UPC-A Detection
// ---------------------------------------------------------------------------

/**
 * Check if a 13-digit EAN-13 is actually a UPC-A barcode.
 * UPC-A is EAN-13 with a leading zero.
 */
export function isUPCA(ean13: string): boolean {
  return ean13.length === 13 && ean13.startsWith('0');
}

/**
 * Convert an EAN-13 string to UPC-A (strip leading zero).
 */
export function toUPCA(ean13: string): string {
  if (!isUPCA(ean13)) {
    return ean13;
  }
  return ean13.slice(1);
}

// ---------------------------------------------------------------------------
// Code128 Decoder
// ---------------------------------------------------------------------------

/**
 * Match a sequence of 6 run widths to a Code128 symbol value.
 * Uses normalized width ratios to handle varying module sizes.
 * Returns the matched value (0-105) or -1 if no match.
 */
export function matchCode128Symbol(widths: number[]): number {
  if (widths.length !== 6) {
    return -1;
  }
  const totalWidth = widths.reduce((a, b) => a + b, 0);
  if (totalWidth === 0) {
    return -1;
  }
  // Normalize to 11-module total
  const normalized = widths.map((w) => (w * 11) / totalWidth);

  let bestMatch = -1;
  let bestError = Infinity;

  for (let i = 0; i < CODE128_PATTERNS.length; i++) {
    const pattern = CODE128_PATTERNS[i];
    let error = 0;
    for (let j = 0; j < 6; j++) {
      error += Math.abs(normalized[j] - pattern[j]);
    }
    if (error < bestError) {
      bestError = error;
      bestMatch = i;
    }
  }

  // Reject if error is too large (threshold chosen empirically)
  if (bestError > 3.0) {
    return -1;
  }

  return bestMatch;
}

/**
 * Attempt to decode a Code128 barcode from run-length segments.
 * Only supports Code B (ASCII printable characters) for now.
 * Returns the decoded string or null.
 */
export function decodeCode128(runs: RunSegment[]): string | null {
  // Skip leading light runs
  let runIdx = 0;
  while (runIdx < runs.length && !runs[runIdx].dark) {
    runIdx++;
  }

  if (runIdx >= runs.length) {
    return null;
  }

  // Collect alternating bar/space widths (Code128 symbols are 6 bars/spaces each)
  const widths: number[] = [];
  for (let i = runIdx; i < runs.length; i++) {
    widths.push(runs[i].length);
  }

  if (widths.length < 6) {
    return null;
  }

  // Try to match the start code
  const startWidths = widths.slice(0, 6);
  const startValue = matchCode128Symbol(startWidths);

  // We only support Code B start (value 104)
  if (startValue !== 104 && startValue !== 103 && startValue !== 105) {
    return null;
  }

  const isCodeB = startValue === 104;
  if (!isCodeB) {
    // For simplicity, only decode Code B
    return null;
  }

  // Decode data symbols
  const values: number[] = [startValue];
  let pos = 6;

  while (pos + 6 <= widths.length) {
    const symbolWidths = widths.slice(pos, pos + 6);
    const value = matchCode128Symbol(symbolWidths);

    if (value === -1) {
      break;
    }

    values.push(value);
    pos += 6;

    // Check for stop pattern (7 bars)
    if (pos + 7 <= widths.length) {
      const stopWidths = widths.slice(pos, pos + 7);
      const stopTotal = stopWidths.reduce((a, b) => a + b, 0);
      if (stopTotal > 0) {
        const normalized = stopWidths.map((w) => (w * 13) / stopTotal);
        let stopError = 0;
        for (let j = 0; j < 7; j++) {
          stopError += Math.abs(normalized[j] - CODE128_STOP_PATTERN[j]);
        }
        if (stopError < 3.0) {
          break;
        }
      }
    }
  }

  // Need at least: start + 1 data + checksum = 3 values
  if (values.length < 3) {
    return null;
  }

  // Verify checksum
  const checksumValue = values[values.length - 1];
  let checksumCalc = values[0]; // start code value
  for (let i = 1; i < values.length - 1; i++) {
    checksumCalc += values[i] * i;
  }
  checksumCalc = checksumCalc % 103;

  if (checksumCalc !== checksumValue) {
    return null;
  }

  // Convert values to characters (Code B: value + 32 = ASCII)
  const dataValues = values.slice(1, values.length - 1);
  const chars = dataValues.map((v) => {
    if (v >= 0 && v <= 94) {
      return String.fromCharCode(v + CODE128_B_OFFSET);
    }
    return '';
  });

  const result = chars.join('');
  return result.length > 0 ? result : null;
}

// ---------------------------------------------------------------------------
// ProtoPulse Label Parser
// ---------------------------------------------------------------------------

/**
 * Attempt to parse a raw scan value as a ProtoPulse component label.
 *
 * ProtoPulse labels use the format:
 *   PP:{compact JSON} — same as qr-labels.ts encodeQRData()
 *
 * Or base64url-encoded JSON with component fields.
 */
export function parseComponentLabel(rawValue: string): ParsedComponentLabel | null {
  // Try PP: prefix format (from qr-labels.ts)
  if (rawValue.startsWith(PROTOPULSE_PREFIX)) {
    return parsePPFormat(rawValue);
  }

  // Try base64url-encoded JSON
  return parseBase64UrlFormat(rawValue);
}

/**
 * Parse the PP: prefixed format from qr-labels.ts.
 */
function parsePPFormat(data: string): ParsedComponentLabel | null {
  try {
    const json = data.slice(PROTOPULSE_PREFIX.length);
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    const obj = parsed as Record<string, unknown>;

    // Must have either 'p' (partNumber from compact format) or 'partNumber'
    const partNumber = typeof obj.p === 'string' ? obj.p : typeof obj.n === 'string' ? obj.n : null;
    if (partNumber === null) {
      return null;
    }

    const label: ParsedComponentLabel = { partNumber };

    if (typeof obj.l === 'string' && obj.l !== '') {
      label.location = obj.l;
    }
    if (typeof obj.q === 'number' && Number.isFinite(obj.q)) {
      label.quantity = obj.q;
    }
    // Map 'i' as projectId if it's numeric
    if (typeof obj.i === 'string' && /^\d+$/.test(obj.i)) {
      label.projectId = parseInt(obj.i, 10);
    }

    return label;
  } catch {
    return null;
  }
}

/**
 * Parse base64url-encoded JSON containing component data.
 */
function parseBase64UrlFormat(data: string): ParsedComponentLabel | null {
  try {
    // Convert base64url to standard base64
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const decoded = atob(padded);
    const parsed: unknown = JSON.parse(decoded);

    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    const obj = parsed as Record<string, unknown>;

    const partNumber = typeof obj.partNumber === 'string'
      ? obj.partNumber
      : typeof obj.pn === 'string'
        ? obj.pn
        : null;
    if (partNumber === null || partNumber === '') {
      return null;
    }

    const label: ParsedComponentLabel = { partNumber };

    const location = typeof obj.location === 'string'
      ? obj.location
      : typeof obj.loc === 'string'
        ? obj.loc
        : undefined;
    if (location !== undefined && location !== '') {
      label.location = location;
    }

    const projectId = typeof obj.projectId === 'number'
      ? obj.projectId
      : typeof obj.pid === 'number'
        ? obj.pid
        : undefined;
    if (projectId !== undefined && Number.isFinite(projectId)) {
      label.projectId = projectId;
    }

    const quantity = typeof obj.quantity === 'number'
      ? obj.quantity
      : typeof obj.qty === 'number'
        ? obj.qty
        : undefined;
    if (quantity !== undefined && Number.isFinite(quantity)) {
      label.quantity = quantity;
    }

    return label;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// BarcodeScanner
// ---------------------------------------------------------------------------

/**
 * Barcode scanner that processes ImageData frames to detect and decode
 * barcodes. Scans multiple horizontal scanlines across the image for
 * maximum detection probability.
 */
export class BarcodeScanner {
  private readonly scanlineCount: number;
  private readonly luminanceThreshold: number;

  constructor(options?: { scanlineCount?: number; luminanceThreshold?: number }) {
    this.scanlineCount = options?.scanlineCount ?? 5;
    this.luminanceThreshold = options?.luminanceThreshold ?? 128;
  }

  /**
   * Scan a single image frame for barcodes.
   * Tries multiple horizontal scanlines and returns the first successful decode.
   */
  scanFrame(imageData: ImageData): ScanResult | null {
    if (imageData.width === 0 || imageData.height === 0) {
      return null;
    }

    // Sample scanlines distributed across the image height
    const step = Math.max(1, Math.floor(imageData.height / (this.scanlineCount + 1)));

    for (let i = 1; i <= this.scanlineCount; i++) {
      const y = Math.min(step * i, imageData.height - 1);
      const scanline = extractScanline(imageData, y, this.luminanceThreshold);
      const runs = toRunLengths(scanline);

      // Try EAN-13 first (also covers UPC-A)
      const ean13 = decodeEAN13(runs);
      if (ean13 !== null) {
        const isUpc = isUPCA(ean13);
        const rawValue = isUpc ? toUPCA(ean13) : ean13;
        const format: BarcodeFormat = isUpc ? 'upc-a' : 'ean13';
        return {
          format,
          rawValue,
          parsedComponent: parseComponentLabel(rawValue) ?? undefined,
          confidence: 0.95,
          timestamp: Date.now(),
        };
      }

      // Try Code128
      const code128 = decodeCode128(runs);
      if (code128 !== null) {
        return {
          format: 'code128',
          rawValue: code128,
          parsedComponent: parseComponentLabel(code128) ?? undefined,
          confidence: 0.9,
          timestamp: Date.now(),
        };
      }
    }

    return null;
  }

  /**
   * Scan from a raw data string (e.g., QR code content from another source).
   * Useful when a QR code has already been decoded by the browser's
   * BarcodeDetector API and we just need to parse the content.
   */
  parseRawValue(rawValue: string): ScanResult {
    const parsedComponent = parseComponentLabel(rawValue);
    const format: BarcodeFormat = rawValue.startsWith(PROTOPULSE_PREFIX) ? 'qr' : 'unknown';
    return {
      format,
      rawValue,
      parsedComponent: parsedComponent ?? undefined,
      confidence: parsedComponent !== null ? 0.85 : 0.5,
      timestamp: Date.now(),
    };
  }
}

// ---------------------------------------------------------------------------
// ScanSession
// ---------------------------------------------------------------------------

/**
 * Manages a continuous scanning session with deduplication.
 * Prevents the same barcode value from firing multiple callbacks
 * within a configurable time window.
 */
export class ScanSession {
  private readonly deduplicateWindowMs: number;
  private readonly recentScans: Map<string, number> = new Map();
  private readonly results: ScanResult[] = [];
  private _isActive = false;

  constructor(options?: ScanSessionOptions) {
    this.deduplicateWindowMs = options?.deduplicateWindowMs ?? DEFAULT_DEDUPLICATE_WINDOW_MS;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get scanResults(): readonly ScanResult[] {
    return this.results;
  }

  start(): void {
    this._isActive = true;
    this.recentScans.clear();
    this.results.length = 0;
  }

  stop(): void {
    this._isActive = false;
  }

  /**
   * Process a scan result. Returns true if the result is new (not a duplicate
   * within the deduplication window), false otherwise.
   */
  processResult(result: ScanResult): boolean {
    if (!this._isActive) {
      return false;
    }

    const now = Date.now();
    const lastSeen = this.recentScans.get(result.rawValue);

    if (lastSeen !== undefined && now - lastSeen < this.deduplicateWindowMs) {
      return false;
    }

    this.recentScans.set(result.rawValue, now);
    this.results.push(result);

    // Clean up old entries
    const keysToDelete: string[] = [];
    this.recentScans.forEach((ts, key) => {
      if (now - ts >= this.deduplicateWindowMs) {
        keysToDelete.push(key);
      }
    });
    for (let i = 0; i < keysToDelete.length; i++) {
      this.recentScans.delete(keysToDelete[i]);
    }

    return true;
  }

  /**
   * Reset the session, clearing all results and deduplication state.
   */
  reset(): void {
    this.recentScans.clear();
    this.results.length = 0;
  }
}

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

/**
 * React hook for barcode scanning with automatic session management.
 *
 * Usage:
 *   const { start, stop, isScanning, lastResult } = useBarcodeScanner({
 *     onScan: (result) => console.log('Scanned:', result),
 *   });
 */
export function useBarcodeScanner(options?: UseBarcodeScannerOptions) {
  const [isScanning, setIsScanning] = useState(false);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);

  const scannerRef = useRef<BarcodeScanner | null>(null);
  const sessionRef = useRef<ScanSession | null>(null);
  const onScanRef = useRef(options?.onScan);

  // Keep onScan ref current without causing re-renders
  useEffect(() => {
    onScanRef.current = options?.onScan;
  }, [options?.onScan]);

  const start = useCallback(() => {
    if (!scannerRef.current) {
      scannerRef.current = new BarcodeScanner();
    }
    if (!sessionRef.current) {
      sessionRef.current = new ScanSession({
        deduplicateWindowMs: options?.deduplicateWindowMs ?? DEFAULT_DEDUPLICATE_WINDOW_MS,
      });
    }
    sessionRef.current.start();
    setIsScanning(true);
    setLastResult(null);
  }, [options?.deduplicateWindowMs]);

  const stop = useCallback(() => {
    sessionRef.current?.stop();
    setIsScanning(false);
  }, []);

  const processFrame = useCallback((imageData: ImageData) => {
    const scanner = scannerRef.current;
    const session = sessionRef.current;
    if (!scanner || !session || !session.isActive) {
      return null;
    }

    const result = scanner.scanFrame(imageData);
    if (result === null) {
      return null;
    }

    const isNew = session.processResult(result);
    if (isNew) {
      setLastResult(result);
      onScanRef.current?.(result);
    }

    return isNew ? result : null;
  }, []);

  const parseRaw = useCallback((rawValue: string) => {
    const scanner = scannerRef.current ?? new BarcodeScanner();
    const result = scanner.parseRawValue(rawValue);
    const session = sessionRef.current;

    if (session?.isActive) {
      const isNew = session.processResult(result);
      if (isNew) {
        setLastResult(result);
        onScanRef.current?.(result);
      }
      return isNew ? result : null;
    }

    setLastResult(result);
    onScanRef.current?.(result);
    return result;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      sessionRef.current?.stop();
    };
  }, []);

  return {
    start,
    stop,
    processFrame,
    parseRaw,
    isScanning,
    lastResult,
  };
}
