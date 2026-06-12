import { describe, expect, it } from 'vitest';

import { combineRuns, OVERLAY_DASH } from './overlay.js';

import type { SimResult } from './types.js';

const TRAN: SimResult = {
  analysis: { kind: 'tran', stepS: 1e-6, stopS: 2e-6 },
  variables: ['time', 'v(led_a)', 'i(vbt1)'],
  points: 3,
  vectors: [
    { name: 'time', values: [0, 1e-6, 2e-6] },
    { name: 'v(led_a)', values: [0, 2.5, 5] },
    { name: 'i(vbt1)', values: [0, 0.01, 0.02] },
  ],
};

const TRAN_OTHER: SimResult = {
  analysis: { kind: 'tran', stepS: 1e-6, stopS: 2e-6 },
  variables: ['time', 'v(led_a)'],
  points: 2,
  vectors: [
    { name: 'time', values: [0, 1e-6] },
    { name: 'v(led_a)', values: [0, 3.3] },
  ],
};

describe('combineRuns', () => {
  it('primary only: one solid trace per non-sweep vector, sweep as xs', () => {
    const out = combineRuns(TRAN, null, '');
    expect(out.map((t) => t.name)).toEqual(['v(led_a)', 'i(vbt1)']);
    expect(out.map((t) => t.key)).toEqual(['v(led_a)', 'i(vbt1)']);
    expect(out[0]?.xs).toEqual([0, 1e-6, 2e-6]);
    expect(out[0]?.ys).toEqual([0, 2.5, 5]);
    expect(out.every((t) => t.dash === undefined)).toBe(true);
  });

  it('secondary traces get the " @branch" suffix and a dash pattern', () => {
    const out = combineRuns(TRAN, TRAN_OTHER, 'try-bigger-r');
    const second = out.find((t) => t.name === 'v(led_a) @try-bigger-r');
    expect(second).toBeDefined();
    expect(second?.dash).toEqual([...OVERLAY_DASH]);
    expect(second?.key).toBe('v(led_a)');
    // The secondary trace plots against ITS OWN sweep values.
    expect(second?.xs).toEqual([0, 1e-6]);
    expect(second?.ys).toEqual([0, 3.3]);
  });

  it('a node keeps one colorIndex across both branches', () => {
    const out = combineRuns(TRAN, TRAN_OTHER, 'b');
    const solid = out.find((t) => t.name === 'v(led_a)');
    const dashed = out.find((t) => t.name === 'v(led_a) @b');
    expect(solid?.colorIndex).toBe(dashed?.colorIndex);
  });

  it('secondary-only vectors still appear, color-cycled after the primary', () => {
    const extra: SimResult = {
      ...TRAN_OTHER,
      vectors: [
        { name: 'time', values: [0, 1e-6] },
        { name: 'v(new_node)', values: [1, 2] },
      ],
    };
    const out = combineRuns(TRAN, extra, 'b');
    const novel = out.find((t) => t.name === 'v(new_node) @b');
    expect(novel).toBeDefined();
    expect(novel?.colorIndex).toBe(2); // after v(led_a)=0, i(vbt1)=1
    expect(novel?.dash).toEqual([...OVERLAY_DASH]);
  });

  it('excludes the sweep vector from both runs', () => {
    const out = combineRuns(TRAN, TRAN_OTHER, 'b');
    expect(out.some((t) => t.key === 'time')).toBe(false);
  });

  it('op results (no sweep) fall back to sample-index xs', () => {
    const op: SimResult = {
      analysis: { kind: 'op' },
      variables: ['v(out)'],
      points: 1,
      vectors: [{ name: 'v(out)', values: [3.3] }],
    };
    const out = combineRuns(op, null, '');
    expect(out[0]?.xs).toEqual([0]);
  });

  it('preserves imag arrays so the caller can apply dB', () => {
    const ac: SimResult = {
      analysis: { kind: 'ac', variation: 'dec', points: 2, fStart: 1, fStop: 10 },
      variables: ['frequency', 'v(out)'],
      points: 2,
      vectors: [
        { name: 'frequency', values: [1, 10] },
        { name: 'v(out)', values: [1, 0.5], imag: [0, 0.5] },
      ],
    };
    const out = combineRuns(ac, null, '');
    expect(out[0]?.imag).toEqual([0, 0.5]);
  });
});
