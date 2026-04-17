/**
 * Tests for shared/units.ts — the canonical unit/scale contract shared by
 * simulation, DRC, parametric search, and SPICE bridge engines (BL-0126).
 *
 * Covers:
 *   - Strict SI parsing (case-sensitive: m=milli, M=mega)
 *   - SPICE parsing (case-insensitive: M=milli, MEG=mega)
 *   - Round-trip formatting (fixed + compact styles)
 *   - Cross-engine translation helpers
 *   - Unit conversion (celsius ↔ kelvin)
 *   - Edge cases: zero, negative, scientific notation, malformed input
 */

import { describe, it, expect } from 'vitest';
import {
  SI_PREFIXES,
  SPICE_PREFIXES,
  parseSiValue,
  parseSpiceValue,
  formatSpiceValueFixed,
  formatSpiceValueCompact,
  formatSiValue,
  convertTo,
  spiceToSiNumber,
  siToSpiceString,
  MICRO_SIGN,
  GREEK_MU,
  MM_PER_INCH,
  MIL_PER_INCH,
  MM_PER_MIL,
  METER_PER_MM,
  asMm,
  asMil,
  asMeter,
  asInch,
  milToMm,
  mmToMil,
  mmToMeter,
  meterToMm,
  milToMeter,
  meterToMil,
  inchToMm,
  mmToInch,
  inchToMil,
  milToInch,
} from '../units';

// ---------------------------------------------------------------------------
// Prefix table integrity
// ---------------------------------------------------------------------------

describe('SI_PREFIXES canonical table', () => {
  it('has the expected decade multipliers', () => {
    expect(SI_PREFIXES.p).toBe(1e-12);
    expect(SI_PREFIXES.n).toBe(1e-9);
    expect(SI_PREFIXES.u).toBe(1e-6);
    expect(SI_PREFIXES.m).toBe(1e-3);
    expect(SI_PREFIXES.k).toBe(1e3);
    expect(SI_PREFIXES.M).toBe(1e6);
    expect(SI_PREFIXES.G).toBe(1e9);
    expect(SI_PREFIXES.T).toBe(1e12);
  });

  it('distinguishes m (milli) from M (mega) — THE key SI invariant', () => {
    expect(SI_PREFIXES.m).toBe(1e-3);
    expect(SI_PREFIXES.M).toBe(1e6);
    expect(SI_PREFIXES.m).not.toBe(SI_PREFIXES.M);
  });

  it('maps the micro sign (U+00B5) and Greek mu (U+03BC) to 1e-6', () => {
    expect(SI_PREFIXES[MICRO_SIGN]).toBe(1e-6);
    expect(SI_PREFIXES[GREEK_MU]).toBe(1e-6);
  });
});

describe('SPICE_PREFIXES canonical table', () => {
  it('uses SPICE convention — m = milli, meg = mega', () => {
    expect(SPICE_PREFIXES.m).toBe(1e-3);
    expect(SPICE_PREFIXES.meg).toBe(1e6);
  });

  it('includes MIL (1/1000 inch = 25.4 µm)', () => {
    expect(SPICE_PREFIXES.mil).toBeCloseTo(25.4e-6);
  });
});

// ---------------------------------------------------------------------------
// parseSiValue — strict, case-sensitive
// ---------------------------------------------------------------------------

describe('parseSiValue — plain numbers', () => {
  it('parses integers', () => {
    expect(parseSiValue('100')).toEqual({ value: 100, unit: 'none', scale: 1 });
    expect(parseSiValue('0')).toEqual({ value: 0, unit: 'none', scale: 1 });
  });

  it('parses negatives', () => {
    expect(parseSiValue('-5')?.value).toBe(-5);
  });

  it('parses decimals', () => {
    expect(parseSiValue('3.14')?.value).toBeCloseTo(3.14);
  });

  it('parses scientific notation', () => {
    expect(parseSiValue('1.5e-6')?.value).toBeCloseTo(1.5e-6);
    expect(parseSiValue('2.2E3')?.value).toBeCloseTo(2200);
  });

  it('accepts numeric input (backward-compat)', () => {
    expect(parseSiValue(42)?.value).toBe(42);
    expect(parseSiValue(Number.NaN)).toBeNull();
    expect(parseSiValue(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('parseSiValue — SI prefixes (case-sensitive)', () => {
  it('parses m = milli (1e-3)', () => {
    expect(parseSiValue('10m')?.value).toBeCloseTo(0.01);
    expect(parseSiValue('500mA')?.value).toBeCloseTo(0.5);
    expect(parseSiValue('500mA')?.unit).toBe('amp');
  });

  it('parses M = mega (1e6) — NOT milli', () => {
    expect(parseSiValue('10M')?.value).toBe(1e7);
    expect(parseSiValue('2MΩ')?.value).toBe(2e6);
    expect(parseSiValue('2MΩ')?.unit).toBe('ohm');
  });

  it('parses k = kilo (1e3)', () => {
    expect(parseSiValue('10k')?.value).toBe(1e4);
    expect(parseSiValue('4.7kΩ')?.value).toBeCloseTo(4700);
  });

  it('parses u / µ / μ all = micro (1e-6)', () => {
    expect(parseSiValue('4.7uF')?.value).toBeCloseTo(4.7e-6);
    expect(parseSiValue(`4.7${MICRO_SIGN}F`)?.value).toBeCloseTo(4.7e-6);
    expect(parseSiValue(`4.7${GREEK_MU}F`)?.value).toBeCloseTo(4.7e-6);
  });

  it('parses n = nano (1e-9)', () => {
    const parsed = parseSiValue('100nF');
    expect(parsed?.value).toBeCloseTo(100e-9);
    expect(parsed?.unit).toBe('farad');
  });

  it('parses p = pico (1e-12)', () => {
    expect(parseSiValue('22pF')?.value).toBeCloseTo(22e-12);
  });

  it('parses G = giga (1e9)', () => {
    expect(parseSiValue('2.4GHz')?.value).toBeCloseTo(2.4e9);
    expect(parseSiValue('2.4GHz')?.unit).toBe('hertz');
  });
});

describe('parseSiValue — unit recognition', () => {
  it('recognises Ω, Ohm, R as ohms', () => {
    expect(parseSiValue('10kΩ')?.unit).toBe('ohm');
    expect(parseSiValue('10kOhm')?.unit).toBe('ohm');
  });

  it('recognises F (farad), H (henry), V (volt), A (amp), W (watt), Hz, s', () => {
    expect(parseSiValue('100nF')?.unit).toBe('farad');
    expect(parseSiValue('10uH')?.unit).toBe('henry');
    expect(parseSiValue('3.3V')?.unit).toBe('volt');
    expect(parseSiValue('500mA')?.unit).toBe('amp');
    expect(parseSiValue('5W')?.unit).toBe('watt');
    expect(parseSiValue('60Hz')?.unit).toBe('hertz');
    expect(parseSiValue('10ms')?.unit).toBe('second');
  });

  it('returns unit="none" when no unit letters are present', () => {
    expect(parseSiValue('10k')?.unit).toBe('none');
    expect(parseSiValue('42')?.unit).toBe('none');
  });
});

describe('parseSiValue — rejection', () => {
  it('returns null for empty / whitespace input', () => {
    expect(parseSiValue('')).toBeNull();
    expect(parseSiValue('   ')).toBeNull();
  });

  it('returns null for garbage', () => {
    expect(parseSiValue('nF10')).toBeNull();
    expect(parseSiValue('abc')).toBeNull();
    expect(parseSiValue('10xF')).toBeNull();
  });

  it('returns null for non-string / non-number', () => {
    expect(parseSiValue(null as unknown as string)).toBeNull();
    expect(parseSiValue(undefined as unknown as string)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseSpiceValue — SPICE, case-insensitive
// ---------------------------------------------------------------------------

describe('parseSpiceValue — plain numbers (legacy behaviour)', () => {
  it('parses integers', () => {
    expect(parseSpiceValue('100')).toBe(100);
    expect(parseSpiceValue('0')).toBe(0);
    expect(parseSpiceValue('-5')).toBe(-5);
  });

  it('parses decimals', () => {
    expect(parseSpiceValue('3.14')).toBeCloseTo(3.14);
    expect(parseSpiceValue('0.001')).toBeCloseTo(0.001);
  });

  it('parses scientific notation (e/E/+/-)', () => {
    expect(parseSpiceValue('1e3')).toBe(1000);
    expect(parseSpiceValue('2.2e-6')).toBeCloseTo(2.2e-6);
    expect(parseSpiceValue('1E3')).toBe(1000);
    expect(parseSpiceValue('5.5E+2')).toBeCloseTo(550);
  });
});

describe('parseSpiceValue — SPICE prefixes (case-insensitive)', () => {
  it('parses K/k = kilo', () => {
    expect(parseSpiceValue('1k')).toBe(1e3);
    expect(parseSpiceValue('1K')).toBe(1e3);
    expect(parseSpiceValue('4.7k')).toBeCloseTo(4700);
  });

  it('SPICE CONVENTION: M = milli (not mega!) — locked by legacy tests', () => {
    expect(parseSpiceValue('1m')).toBeCloseTo(1e-3);
    expect(parseSpiceValue('10m')).toBeCloseTo(10e-3);
    expect(parseSpiceValue('100M')).toBeCloseTo(100e-3);
    expect(parseSpiceValue('2.2M')).toBeCloseTo(2.2e-3);
  });

  it('parses MEG/meg = mega (case-insensitive)', () => {
    expect(parseSpiceValue('1meg')).toBeCloseTo(1e6);
    expect(parseSpiceValue('1MEG')).toBeCloseTo(1e6);
    expect(parseSpiceValue('4.7meg')).toBeCloseTo(4.7e6);
  });

  it('MEG is matched before M (longest-first)', () => {
    // If longest-first failed, "MEG" would match "M" first and become 1e-3.
    expect(parseSpiceValue('1MEG')).toBe(1e6);
    expect(parseSpiceValue('2.5meg')).toBeCloseTo(2.5e6);
  });

  it('parses U/u/µ = micro', () => {
    expect(parseSpiceValue('100U')).toBeCloseTo(100e-6);
    expect(parseSpiceValue('4.7u')).toBeCloseTo(4.7e-6);
    expect(parseSpiceValue(`4.7${MICRO_SIGN}`)).toBeCloseTo(4.7e-6);
  });

  it('parses N, P, F, T, G', () => {
    expect(parseSpiceValue('100N')).toBeCloseTo(100e-9);
    expect(parseSpiceValue('22P')).toBeCloseTo(22e-12);
    expect(parseSpiceValue('10T')).toBeCloseTo(10e12);
    expect(parseSpiceValue('2.5G')).toBeCloseTo(2.5e9);
  });

  it('strips trailing unit letters (F, H, V, A, Ohm)', () => {
    expect(parseSpiceValue('10kOhm')).toBeCloseTo(10e3);
    expect(parseSpiceValue('100nF')).toBeCloseTo(100e-9);
    expect(parseSpiceValue('4.7uH')).toBeCloseTo(4.7e-6);
    expect(parseSpiceValue('3.3V')).toBeCloseTo(3.3);
  });
});

describe('parseSpiceValue — rejection', () => {
  it('returns NaN for empty input', () => {
    expect(parseSpiceValue('')).toBeNaN();
    expect(parseSpiceValue('   ')).toBeNaN();
  });

  it('returns NaN for malformed input', () => {
    expect(parseSpiceValue('abc')).toBeNaN();
    expect(parseSpiceValue('10xyz')).toBeNaN();
  });

  it('accepts numeric input (backward-compat)', () => {
    expect(parseSpiceValue(42)).toBe(42);
    expect(parseSpiceValue(Number.NaN)).toBeNaN();
  });
});

// ---------------------------------------------------------------------------
// Formatting — fixed style (precision 4)
// ---------------------------------------------------------------------------

describe('formatSpiceValueFixed — legacy spice-generator style', () => {
  it('returns "0" for zero', () => {
    expect(formatSpiceValueFixed(0)).toBe('0');
  });

  it('uses toPrecision(4) with trailing zeros preserved', () => {
    expect(formatSpiceValueFixed(47)).toBe('47.00');
    expect(formatSpiceValueFixed(10000)).toBe('10.00K');
    expect(formatSpiceValueFixed(0.001)).toBe('1.000M');
    expect(formatSpiceValueFixed(1e-6)).toBe('1.000U');
    expect(formatSpiceValueFixed(1e-9)).toBe('1.000N');
    expect(formatSpiceValueFixed(1e-12)).toBe('1.000P');
    expect(formatSpiceValueFixed(1e6)).toBe('1.000MEG');
    expect(formatSpiceValueFixed(4.7e-6)).toBe('4.700U');
  });

  it('handles negatives', () => {
    expect(formatSpiceValueFixed(-10000)).toBe('-10.00K');
  });
});

describe('formatSpiceValueCompact — legacy design-var-bridge style', () => {
  it('strips trailing zeros', () => {
    expect(formatSpiceValueCompact(0)).toBe('0');
    expect(formatSpiceValueCompact(4.7e-12)).toBe('4.7P');
    expect(formatSpiceValueCompact(100e-9)).toBe('100N');
    expect(formatSpiceValueCompact(4.7e-6)).toBe('4.7U');
    expect(formatSpiceValueCompact(2.2e-3)).toBe('2.2M');
    expect(formatSpiceValueCompact(3.3)).toBe('3.3');
    expect(formatSpiceValueCompact(10e3)).toBe('10K');
    expect(formatSpiceValueCompact(1e6)).toBe('1MEG');
    expect(formatSpiceValueCompact(2.5e9)).toBe('2.5G');
    expect(formatSpiceValueCompact(1e12)).toBe('1T');
  });

  it('handles negatives', () => {
    expect(formatSpiceValueCompact(-5)).toBe('-5');
    expect(formatSpiceValueCompact(-10e3)).toBe('-10K');
  });
});

// ---------------------------------------------------------------------------
// Round-trip invariants
// ---------------------------------------------------------------------------

describe('SPICE round-trip — parseSpiceValue(formatSpiceValueCompact(x)) ≈ x', () => {
  const samples: readonly number[] = [
    1, 3.3, 10, 47, 100, 1000, 4700, 10_000, 1e6, 1e9, 1e12,
    0.01, 0.001, 2.2e-3, 4.7e-6, 100e-9, 22e-12,
    -5, -10e3, -4.7e-6,
  ];
  for (const x of samples) {
    it(`round-trips ${x}`, () => {
      expect(parseSpiceValue(formatSpiceValueCompact(x))).toBeCloseTo(x, 10);
    });
  }
});

describe('SPICE round-trip — parseSpiceValue(formatSpiceValueFixed(x)) ≈ x', () => {
  const samples: readonly number[] = [
    1, 3.3, 47, 10_000, 4.7e-6, 100e-9, 22e-12, 1e6, -10e3,
  ];
  for (const x of samples) {
    it(`round-trips ${x}`, () => {
      expect(parseSpiceValue(formatSpiceValueFixed(x))).toBeCloseTo(x, 3);
    });
  }
});

// ---------------------------------------------------------------------------
// formatSiValue (strict SI)
// ---------------------------------------------------------------------------

describe('formatSiValue', () => {
  it('uses lowercase m for milli, uppercase M for mega', () => {
    expect(formatSiValue(1e-3, 'amp')).toBe('1m A');
    expect(formatSiValue(1e6, 'ohm')).toMatch(/^1M /); // "1M Ω"
  });

  it('formats with a space between value and unit symbol', () => {
    expect(formatSiValue(100e-9, 'farad')).toBe('100n F');
  });

  it('omits unit when unit="none"', () => {
    expect(formatSiValue(10e3, 'none')).toBe('10k');
  });

  it('returns "0" or "0 <unit>" for zero', () => {
    expect(formatSiValue(0)).toBe('0');
    expect(formatSiValue(0, 'volt')).toBe('0 V');
  });
});

// ---------------------------------------------------------------------------
// Unit conversion
// ---------------------------------------------------------------------------

describe('convertTo', () => {
  it('is identity when fromUnit === toUnit', () => {
    expect(convertTo(42, 'volt', 'volt')).toBe(42);
  });

  it('converts celsius to kelvin', () => {
    expect(convertTo(0, 'celsius', 'kelvin')).toBeCloseTo(273.15);
    expect(convertTo(100, 'celsius', 'kelvin')).toBeCloseTo(373.15);
  });

  it('converts kelvin to celsius', () => {
    expect(convertTo(273.15, 'kelvin', 'celsius')).toBeCloseTo(0);
  });

  it('throws for non-convertible pairs', () => {
    expect(() => convertTo(1, 'volt', 'amp')).toThrow(/Cannot convert/);
  });
});

// ---------------------------------------------------------------------------
// Cross-engine translation
// ---------------------------------------------------------------------------

describe('spiceToSiNumber / siToSpiceString', () => {
  it('spiceToSiNumber is parseSpiceValue (produces SI-base number)', () => {
    expect(spiceToSiNumber('10k')).toBe(1e4);
    expect(spiceToSiNumber('100n')).toBeCloseTo(100e-9);
  });

  it('siToSpiceString produces compact SPICE notation', () => {
    expect(siToSpiceString(10e3)).toBe('10K');
    expect(siToSpiceString(100e-9)).toBe('100N');
  });

  it('round-trips SI number through SPICE string', () => {
    const x = 4.7e-6;
    expect(spiceToSiNumber(siToSpiceString(x))).toBeCloseTo(x, 10);
  });

  it('documents the SPICE-vs-SI "M" divergence is contained here', () => {
    // "10M" under SPICE = 10 * 1e-3 = 0.01
    expect(spiceToSiNumber('10M')).toBeCloseTo(0.01);
    // "10M" under strict SI = 10 * 1e6 = 1e7 — different!
    expect(parseSiValue('10M')?.value).toBe(1e7);
  });
});
