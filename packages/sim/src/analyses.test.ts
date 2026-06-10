import { describe, expect, it } from 'vitest';

import { analysisCard, analysisSchema, spiceNum } from './analyses.js';

import type { Analysis } from './analyses.js';

describe('spiceNum', () => {
  it('prefers exponential form when shorter', () => {
    expect(spiceNum(1e-6)).toBe('1e-6');
    expect(spiceNum(1e-4)).toBe('1e-4');
    expect(spiceNum(1e6)).toBe('1e6');
  });
  it('keeps short plain decimals', () => {
    expect(spiceNum(330)).toBe('330');
    expect(spiceNum(0.1)).toBe('0.1');
    expect(spiceNum(9)).toBe('9');
    expect(spiceNum(1000)).toBe('1000');
    expect(spiceNum(10000)).toBe('1e4');
  });
});

describe('analysisCard', () => {
  const cases: [Analysis, string][] = [
    [{ kind: 'op' }, '.op'],
    [{ kind: 'tran', stepS: 1e-6, stopS: 1e-4 }, '.tran 1e-6 1e-4'],
    [{ kind: 'tran', stepS: 1e-6, stopS: 1e-4, startS: 5e-5 }, '.tran 1e-6 1e-4 5e-5'],
    [{ kind: 'dc', source: 'V1', start: 0, stop: 9, step: 0.1 }, '.dc V1 0 9 0.1'],
    [{ kind: 'ac', variation: 'dec', points: 20, fStart: 1, fStop: 1e6 }, '.ac dec 20 1 1e6'],
    [{ kind: 'ac', variation: 'lin', points: 100, fStart: 50, fStop: 5000 }, '.ac lin 100 50 5000'],
    [
      { kind: 'noise', output: 'out', source: 'V1', variation: 'dec', points: 10, fStart: 10, fStop: 1e5 },
      '.noise v(out) V1 dec 10 10 1e5',
    ],
    [
      { kind: 'noise', output: 'led_a', source: 'VBT1', variation: 'lin', points: 50, fStart: 1, fStop: 1000 },
      '.noise v(led_a) VBT1 lin 50 1 1000',
    ],
  ];
  it.each(cases)('emits %j as %s', (analysis, card) => {
    expect(analysisCard(analysis)).toBe(card);
  });
});

describe('analysisSchema', () => {
  it('accepts every card-emission case', () => {
    const ok: unknown[] = [
      { kind: 'op' },
      { kind: 'tran', stepS: 1e-6, stopS: 1e-4 },
      { kind: 'tran', stepS: 1e-6, stopS: 1e-3, startS: 0 },
      { kind: 'dc', source: 'V1', start: -5, stop: 5, step: 0.5 },
      { kind: 'ac', variation: 'oct', points: 5, fStart: 10, fStop: 10 },
      { kind: 'noise', output: 'out', source: 'V1', variation: 'dec', points: 10, fStart: 10, fStop: 1e5 },
    ];
    for (const a of ok) expect(analysisSchema.safeParse(a).success).toBe(true);
  });

  it('rejects unknown kinds', () => {
    expect(analysisSchema.safeParse({ kind: 'fft' }).success).toBe(false);
  });

  it('rejects non-positive tran steps', () => {
    expect(analysisSchema.safeParse({ kind: 'tran', stepS: 0, stopS: 1e-3 }).success).toBe(false);
    expect(analysisSchema.safeParse({ kind: 'tran', stepS: -1e-6, stopS: 1e-3 }).success).toBe(false);
  });

  it('rejects tran windows that end before they start', () => {
    expect(
      analysisSchema.safeParse({ kind: 'tran', stepS: 1e-6, stopS: 1e-4, startS: 1e-3 }).success,
    ).toBe(false);
  });

  it('rejects a zero dc step and an empty source', () => {
    expect(
      analysisSchema.safeParse({ kind: 'dc', source: 'V1', start: 0, stop: 9, step: 0 }).success,
    ).toBe(false);
    expect(
      analysisSchema.safeParse({ kind: 'dc', source: '', start: 0, stop: 9, step: 1 }).success,
    ).toBe(false);
  });

  it('rejects ac with non-integer points or inverted frequency range', () => {
    expect(
      analysisSchema.safeParse({ kind: 'ac', variation: 'dec', points: 2.5, fStart: 1, fStop: 10 })
        .success,
    ).toBe(false);
    expect(
      analysisSchema.safeParse({ kind: 'ac', variation: 'dec', points: 10, fStart: 1e6, fStop: 1 })
        .success,
    ).toBe(false);
  });

  it('rejects noise with missing fields, empty names, or fStart >= fStop', () => {
    expect(analysisSchema.safeParse({ kind: 'noise' }).success).toBe(false);
    expect(
      analysisSchema.safeParse({
        kind: 'noise',
        output: '',
        source: 'V1',
        variation: 'dec',
        points: 10,
        fStart: 10,
        fStop: 1e5,
      }).success,
    ).toBe(false);
    expect(
      analysisSchema.safeParse({
        kind: 'noise',
        output: 'out',
        source: '',
        variation: 'dec',
        points: 10,
        fStart: 10,
        fStop: 1e5,
      }).success,
    ).toBe(false);
    // Strictly increasing range: equal endpoints are rejected too.
    for (const [fStart, fStop] of [
      [1e5, 10],
      [100, 100],
    ]) {
      expect(
        analysisSchema.safeParse({
          kind: 'noise',
          output: 'out',
          source: 'V1',
          variation: 'dec',
          points: 10,
          fStart,
          fStop,
        }).success,
      ).toBe(false);
    }
  });

  it('rejects extra keys (strict objects)', () => {
    expect(analysisSchema.safeParse({ kind: 'op', extra: true }).success).toBe(false);
  });

  it('rejects non-finite numbers', () => {
    expect(
      analysisSchema.safeParse({ kind: 'tran', stepS: Number.POSITIVE_INFINITY, stopS: 1 }).success,
    ).toBe(false);
  });
});
