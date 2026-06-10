import { describe, expect, it } from 'vitest';

import { evaluate } from './math-channels.js';

import type { SimVector } from './types.js';

const VECTORS: SimVector[] = [
  { name: 'time', values: [0, 1, 2, 3] },
  { name: 'v(led_a)', values: [1, 2, 3, 4] },
  { name: 'v(out)', values: [10, 20, 30, 40] },
  { name: 'i(vbt1)', values: [0.5, 1, 1.5, 2] },
  { name: 'short', values: [7, 8] },
  { name: 'v(ac)', values: [3, 0, -3], imag: [4, 1, 4] },
];

describe('evaluate — literals and arithmetic', () => {
  it('evaluates a bare number to a single broadcast point', () => {
    expect(evaluate('42', VECTORS)).toEqual({ values: [42] });
  });

  it('parses scientific notation and decimals', () => {
    expect(evaluate('1e-3 + 0.5', VECTORS).values[0]).toBeCloseTo(0.501, 12);
    expect(evaluate('.5 * 4', VECTORS)).toEqual({ values: [2] });
  });

  it('honors * over + precedence', () => {
    expect(evaluate('1 + 2 * 3', VECTORS)).toEqual({ values: [7] });
  });

  it('honors / over - precedence and left-assoc chains', () => {
    expect(evaluate('10 - 8 / 4 / 2', VECTORS)).toEqual({ values: [9] });
  });

  it('parentheses override precedence', () => {
    expect(evaluate('(1 + 2) * 3', VECTORS)).toEqual({ values: [9] });
  });

  it('unary minus binds tighter than * operand position requires', () => {
    expect(evaluate('-2 * 3', VECTORS)).toEqual({ values: [-6] });
    expect(evaluate('2 * -3', VECTORS)).toEqual({ values: [-6] });
  });

  it('double unary minus cancels', () => {
    expect(evaluate('--2', VECTORS)).toEqual({ values: [2] });
  });
});

describe('evaluate — vector refs', () => {
  it('resolves v(name) refs elementwise', () => {
    expect(evaluate('v(led_a) + v(out)', VECTORS).values).toEqual([11, 22, 33, 44]);
  });

  it('resolves i(name) refs', () => {
    expect(evaluate('i(vbt1) * 2', VECTORS).values).toEqual([1, 2, 3, 4]);
  });

  it('resolves bare names', () => {
    expect(evaluate('time * 10', VECTORS).values).toEqual([0, 10, 20, 30]);
  });

  it('broadcasts scalar literals across the vector', () => {
    expect(evaluate('v(led_a) - 1', VECTORS).values).toEqual([0, 1, 2, 3]);
  });

  it('truncates to the min length of the referenced vectors', () => {
    expect(evaluate('v(led_a) + short', VECTORS).values).toEqual([8, 10]);
  });

  it('reports unknown vectors as an error, not a throw', () => {
    const out = evaluate('v(nope) + 1', VECTORS);
    expect(out.values).toEqual([]);
    expect(out.error).toMatch(/unknown vector "v\(nope\)"/);
  });

  it('division by zero yields Infinity (plot clips it)', () => {
    const out = evaluate('v(out) / time', VECTORS);
    expect(out.error).toBeUndefined();
    expect(out.values[0]).toBe(Infinity);
    expect(out.values[1]).toBe(20);
  });
});

describe('evaluate — functions', () => {
  it('abs() of a real vector', () => {
    expect(evaluate('abs(0 - v(led_a))', VECTORS).values).toEqual([1, 2, 3, 4]);
  });

  it('mag() of a complex vector is sqrt(re² + im²)', () => {
    expect(evaluate('mag(v(ac))', VECTORS).values).toEqual([5, 1, 5]);
  });

  it('db() of a real vector is 20·log10|x|', () => {
    expect(evaluate('db(v(out))', VECTORS).values.map((v) => Math.round(v))).toEqual([
      20, 26, 30, 32,
    ]);
  });

  it('db() of a complex vector uses the magnitude', () => {
    const out = evaluate('db(v(ac))', VECTORS);
    expect(out.values[0]).toBeCloseTo(20 * Math.log10(5), 10);
  });

  it('functions nest: db(mag(v(ac)))', () => {
    const out = evaluate('db(mag(v(ac)))', VECTORS);
    expect(out.values[0]).toBeCloseTo(20 * Math.log10(5), 10);
  });

  it('complex multiply feeds mag correctly: mag(v(ac) * v(ac))', () => {
    // (3+4i)² = -7+24i, |·| = 25
    expect(evaluate('mag(v(ac) * v(ac))', VECTORS).values[0]).toBeCloseTo(25, 10);
  });
});

describe('evaluate — parse errors', () => {
  it('rejects the empty expression', () => {
    expect(evaluate('   ', VECTORS).error).toBe('empty expression');
  });

  it('rejects trailing garbage after a valid expression', () => {
    expect(evaluate('1 + 2 )', VECTORS).error).toMatch(/unexpected "\)"/);
  });

  it('rejects an unterminated vector reference', () => {
    expect(evaluate('v(led_a', VECTORS).error).toMatch(/unterminated vector reference/);
  });

  it('rejects an unclosed grouping paren', () => {
    expect(evaluate('(1 + 2', VECTORS).error).toMatch(/expected "\)"/);
  });

  it('rejects a dangling operator', () => {
    expect(evaluate('1 +', VECTORS).error).toMatch(/unexpected end of expression/);
  });

  it('rejects unexpected characters', () => {
    expect(evaluate('1 ; 2', VECTORS).error).toMatch(/unexpected character ";"/);
  });

  it('tolerates arbitrary whitespace', () => {
    expect(evaluate('  v(led_a)\t*  2 ', VECTORS).values).toEqual([2, 4, 6, 8]);
  });
});
