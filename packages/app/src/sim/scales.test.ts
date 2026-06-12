import { describe, expect, it } from 'vitest';

import {
  engNotation,
  linMap,
  logMap,
  logTicks,
  magnitudeDb,
  niceTicks,
  vectorDb,
} from './scales.js';

describe('engNotation', () => {
  it('formats the canonical table', () => {
    const table: [number, string][] = [
      [0, '0'],
      [1, '1'],
      [12, '12'],
      [999, '999'],
      [1000, '1k'],
      [10_000, '10k'],
      [4_700_000, '4.7M'],
      [1e9, '1G'],
      [1e12, '1T'],
      [0.001, '1m'],
      [1e-6, '1µ'],
      [2.2e-9, '2.2n'],
      [1.5e-12, '1.5p'],
      [1e-15, '1f'],
    ];
    for (const [value, expected] of table) {
      expect(engNotation(value), `engNotation(${String(value)})`).toBe(expected);
    }
  });

  it('handles negative values', () => {
    expect(engNotation(-2200)).toBe('-2.2k');
    expect(engNotation(-0.000015)).toBe('-15µ');
    expect(engNotation(-1)).toBe('-1');
  });

  it('handles sub-unit values between prefixes', () => {
    expect(engNotation(0.33)).toBe('330m');
    expect(engNotation(0.0047)).toBe('4.7m');
  });

  it('renormalizes rounding carry-over (999.9 → 1k at 3 sig digits)', () => {
    expect(engNotation(999.9)).toBe('1k');
    expect(engNotation(999.9e-6)).toBe('1m');
  });

  it('respects sigDigits', () => {
    expect(engNotation(1234.5, 4)).toBe('1.234k');
    expect(engNotation(1234.5, 2)).toBe('1.2k');
  });

  it('is finite-safe', () => {
    expect(engNotation(Infinity)).toBe('Infinity');
    expect(engNotation(NaN)).toBe('NaN');
  });
});

describe('niceTicks', () => {
  it('produces round ticks covering the domain', () => {
    expect(niceTicks(0, 10, 5)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(niceTicks(0, 1, 5)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
  });

  it('keeps every tick inside [min, max]', () => {
    const ticks = niceTicks(0.13, 9.87, 5);
    expect(ticks.length).toBeGreaterThan(2);
    for (const t of ticks) {
      expect(t).toBeGreaterThanOrEqual(0.13);
      expect(t).toBeLessThanOrEqual(9.87);
    }
  });

  it('handles negative and crossing-zero domains', () => {
    const ticks = niceTicks(-5, 5, 5);
    expect(ticks).toContain(0);
    expect(ticks[0]).toBeGreaterThanOrEqual(-5);
    expect(ticks[ticks.length - 1]).toBeLessThanOrEqual(5);
  });

  it('handles tiny (sub-unit) spans without float drift', () => {
    const ticks = niceTicks(0, 1e-3, 5);
    expect(ticks).toEqual([0, 0.0002, 0.0004, 0.0006, 0.0008, 0.001]);
  });

  it('degenerate and reversed domains', () => {
    expect(niceTicks(3, 3)).toEqual([3]);
    expect(niceTicks(10, 0, 5)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(niceTicks(NaN, 1)).toEqual([]);
  });
});

describe('logTicks', () => {
  it('returns the decades within the domain', () => {
    expect(logTicks(1, 1e6)).toEqual([1, 10, 100, 1000, 10_000, 100_000, 1_000_000]);
    expect(logTicks(5, 2000)).toEqual([10, 100, 1000]);
  });

  it('rejects non-positive domains', () => {
    expect(logTicks(0, 100)).toEqual([]);
    expect(logTicks(-1, 100)).toEqual([]);
    expect(logTicks(100, 1)).toEqual([]);
  });
});

describe('linMap / logMap', () => {
  it('linMap maps endpoints and midpoints', () => {
    expect(linMap(0, 0, 10, 100, 200)).toBe(100);
    expect(linMap(10, 0, 10, 100, 200)).toBe(200);
    expect(linMap(5, 0, 10, 100, 200)).toBe(150);
    // inverted range (screen y)
    expect(linMap(5, 0, 10, 200, 100)).toBe(150);
  });

  it('logMap maps decades linearly', () => {
    expect(logMap(1, 1, 100, 0, 100)).toBe(0);
    expect(logMap(10, 1, 100, 0, 100)).toBeCloseTo(50);
    expect(logMap(100, 1, 100, 0, 100)).toBe(100);
  });

  it('logMap returns NaN for non-positive values', () => {
    expect(logMap(0, 1, 100, 0, 100)).toBeNaN();
    expect(logMap(-5, 1, 100, 0, 100)).toBeNaN();
  });

  it('degenerate domain maps to range midpoint', () => {
    expect(linMap(7, 7, 7, 0, 100)).toBe(50);
  });
});

describe('dB conversion', () => {
  it('real magnitudes', () => {
    expect(magnitudeDb(1)).toBeCloseTo(0);
    expect(magnitudeDb(10)).toBeCloseTo(20);
    expect(magnitudeDb(0.1)).toBeCloseTo(-20);
  });

  it('complex magnitude uses |re + j·im|', () => {
    // |3 + 4j| = 5 → 20·log10(5)
    expect(magnitudeDb(3, 4)).toBeCloseTo(20 * Math.log10(5));
  });

  it('vectorDb converts element-wise with optional imag', () => {
    expect(vectorDb([1, 10])).toEqual([expect.closeTo(0), expect.closeTo(20)]);
    const db = vectorDb([3, 0], [4, 1]);
    expect(db[0]).toBeCloseTo(20 * Math.log10(5));
    expect(db[1]).toBeCloseTo(0);
  });
});
