import { describe, it, expect } from 'vitest';
import {
  detectBaudMismatch,
  suggestBaudRate,
  nonPrintableRatio,
  shannonEntropy,
  STANDARD_BAUD_RATES,
  MIN_SAMPLE_BYTES,
} from '../baud-detector';
import type { BaudMismatchResult } from '../baud-detector';

// ---------------------------------------------------------------------------
// Helpers to generate test data
// ---------------------------------------------------------------------------

/** Generate a string of random non-printable bytes */
function makeGarbage(length: number, seed = 42): string {
  let s = seed;
  const chars: string[] = [];
  for (let i = 0; i < length; i++) {
    // Simple PRNG (mulberry32-ish)
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const byte = ((t ^ (t >>> 14)) >>> 0) % 256;
    chars.push(String.fromCharCode(byte));
  }
  return chars.join('');
}

/** Generate clean printable text */
function makeCleanText(length: number): string {
  const base = 'Hello World! Temperature: 25.3C\n';
  let result = '';
  while (result.length < length) {
    result += base;
  }
  return result.slice(0, length);
}

/** Generate data in a narrow byte range (simulating specific baud mismatch) */
function makeNarrowRange(length: number, low = 0xc0, high = 0xff): string {
  const chars: string[] = [];
  for (let i = 0; i < length; i++) {
    const byte = low + (i % (high - low + 1));
    chars.push(String.fromCharCode(byte));
  }
  return chars.join('');
}

/** Generate repeating garble pattern */
function makeRepeatingGarble(length: number): string {
  const pattern = '\xff\xff\xff\xff\x00\x00\x00\x00\xaa\xaa';
  let result = '';
  while (result.length < length) {
    result += pattern;
  }
  return result.slice(0, length);
}

// ---------------------------------------------------------------------------
// nonPrintableRatio
// ---------------------------------------------------------------------------

describe('nonPrintableRatio', () => {
  it('returns 0 for empty string', () => {
    expect(nonPrintableRatio('')).toBe(0);
  });

  it('returns 0 for fully printable text', () => {
    expect(nonPrintableRatio('Hello, world!\n')).toBe(0);
  });

  it('returns 1 for fully non-printable data', () => {
    const data = String.fromCharCode(0x01, 0x02, 0x03, 0x04);
    expect(nonPrintableRatio(data)).toBe(1);
  });

  it('returns correct ratio for mixed data', () => {
    // 2 printable + 2 non-printable = 0.5
    const data = 'AB' + String.fromCharCode(0x01, 0x02);
    expect(nonPrintableRatio(data)).toBe(0.5);
  });

  it('treats \\r, \\n, \\t as printable', () => {
    expect(nonPrintableRatio('\r\n\t')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// shannonEntropy
// ---------------------------------------------------------------------------

describe('shannonEntropy', () => {
  it('returns 0 for empty string', () => {
    expect(shannonEntropy('')).toBe(0);
  });

  it('returns 0 for single repeated character', () => {
    expect(shannonEntropy('AAAAAAAAAA')).toBe(0);
  });

  it('returns 1.0 for two equally distributed characters', () => {
    // "ABABABAB" — 50/50 distribution
    const e = shannonEntropy('ABABABAB');
    expect(e).toBeCloseTo(1.0, 1);
  });

  it('returns higher entropy for more diverse data', () => {
    const lowEntropy = shannonEntropy('AAABBB');
    const highEntropy = shannonEntropy('ABCDEF');
    expect(highEntropy).toBeGreaterThan(lowEntropy);
  });

  it('returns high entropy for random garbage', () => {
    const garbage = makeGarbage(200);
    const e = shannonEntropy(garbage);
    expect(e).toBeGreaterThan(5);
  });
});

// ---------------------------------------------------------------------------
// detectBaudMismatch
// ---------------------------------------------------------------------------

describe('detectBaudMismatch', () => {
  it('returns not detected for clean serial data', () => {
    const cleanData = makeCleanText(200);
    const result = detectBaudMismatch(cleanData, 115200);
    expect(result.detected).toBe(false);
  });

  it('returns not detected for too-short data', () => {
    const result = detectBaudMismatch('abc', 9600);
    expect(result.detected).toBe(false);
  });

  it('detects mismatch in pure garbage data', () => {
    const garbage = makeGarbage(200);
    const result = detectBaudMismatch(garbage, 9600);
    expect(result.detected).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.3);
    expect(result.likelyBaud).not.toBe(9600);
    expect(result.evidence).toBeTruthy();
  });

  it('detects mismatch in narrow-range byte data', () => {
    const narrow = makeNarrowRange(100);
    const result = detectBaudMismatch(narrow, 115200);
    expect(result.detected).toBe(true);
    expect(result.evidence).toContain('non-printable');
  });

  it('detects mismatch in repeating garble patterns', () => {
    const repeating = makeRepeatingGarble(100);
    const result = detectBaudMismatch(repeating, 9600);
    expect(result.detected).toBe(true);
  });

  it('returns currentBaud in result', () => {
    const garbage = makeGarbage(200);
    const result = detectBaudMismatch(garbage, 57600);
    expect(result.currentBaud).toBe(57600);
  });

  it('confidence is clamped to [0, 1]', () => {
    const garbage = makeGarbage(500);
    const result = detectBaudMismatch(garbage, 9600);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('result shape matches BaudMismatchResult interface', () => {
    const result: BaudMismatchResult = detectBaudMismatch(makeGarbage(200), 9600);
    expect(typeof result.detected).toBe('boolean');
    expect(typeof result.likelyBaud).toBe('number');
    expect(typeof result.currentBaud).toBe('number');
    expect(typeof result.confidence).toBe('number');
    expect(typeof result.evidence).toBe('string');
  });

  it('does not flag data with some control characters but mostly printable', () => {
    // 90% printable, 10% control — should not flag
    const mostly = makeCleanText(90) + String.fromCharCode(0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x0b, 0x0c);
    const result = detectBaudMismatch(mostly, 115200);
    expect(result.detected).toBe(false);
  });

  it('evidence includes percentage for non-printable ratio', () => {
    const garbage = makeGarbage(200);
    const result = detectBaudMismatch(garbage, 9600);
    if (result.detected) {
      expect(result.evidence).toMatch(/\d+%\s*non-printable/);
    }
  });
});

// ---------------------------------------------------------------------------
// suggestBaudRate
// ---------------------------------------------------------------------------

describe('suggestBaudRate', () => {
  it('never includes the current baud rate in suggestions', () => {
    const suggestions = suggestBaudRate('garbage', 9600);
    expect(suggestions).not.toContain(9600);
  });

  it('returns common baud rates', () => {
    const suggestions = suggestBaudRate('garbage', 9600);
    expect(suggestions.length).toBeGreaterThan(0);
    for (const baud of suggestions) {
      expect(STANDARD_BAUD_RATES).toContain(baud);
    }
  });

  it('suggests higher baud rates first when current is low (9600)', () => {
    const suggestions = suggestBaudRate('garbage', 9600);
    // 115200 should be suggested early (most common Arduino baud)
    expect(suggestions.indexOf(115200)).toBeLessThan(3);
  });

  it('suggests lower baud rates first when current is high (115200)', () => {
    const suggestions = suggestBaudRate('garbage', 115200);
    // 9600 should be suggested early
    expect(suggestions.indexOf(9600)).toBeLessThan(3);
  });

  it('handles uncommon baud rates', () => {
    const suggestions = suggestBaudRate('garbage', 300);
    expect(suggestions.length).toBeGreaterThan(5);
    expect(suggestions).not.toContain(300);
  });

  it('returns all standard rates minus current', () => {
    const suggestions = suggestBaudRate('garbage', 57600);
    expect(suggestions.length).toBe(STANDARD_BAUD_RATES.length - 1);
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('constants', () => {
  it('STANDARD_BAUD_RATES is sorted ascending', () => {
    for (let i = 1; i < STANDARD_BAUD_RATES.length; i++) {
      expect(STANDARD_BAUD_RATES[i]).toBeGreaterThan(STANDARD_BAUD_RATES[i - 1]);
    }
  });

  it('MIN_SAMPLE_BYTES is reasonable', () => {
    expect(MIN_SAMPLE_BYTES).toBeGreaterThanOrEqual(16);
    expect(MIN_SAMPLE_BYTES).toBeLessThanOrEqual(128);
  });
});
