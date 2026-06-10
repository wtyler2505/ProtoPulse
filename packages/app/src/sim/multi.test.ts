import { describe, expect, it } from 'vitest';

import { flattenMcTrials, flattenStepRuns, MC_TRIAL_ALPHA, stepLabel, traceKeys } from './multi.js';

import type { Analysis, McTrial, StepRun } from './types.js';

const TRAN: Analysis = { kind: 'tran', stepS: 1e-6, stopS: 2e-6 };

function trial(n: number, scale: number): McTrial {
  return {
    analysis: TRAN,
    variables: ['time', 'v(out)', 'v(led_a)'],
    points: 3,
    vectors: [
      { name: 'time', values: [0, 1e-6, 2e-6] },
      { name: 'v(out)', values: [0, 1 * scale, 2 * scale] },
      { name: 'v(led_a)', values: [0, 3 * scale, 4 * scale] },
    ],
    trial: n,
    jitter: { R1: scale },
  };
}

function stepRun(value: string, scale: number): StepRun {
  return {
    analysis: TRAN,
    variables: ['time', 'v(out)'],
    points: 2,
    vectors: [
      { name: 'time', values: [0, 1e-6] },
      { name: 'v(out)', values: [0, scale] },
    ],
    value,
  };
}

describe('stepLabel', () => {
  it('formats as "v(x) [330]"', () => {
    expect(stepLabel('v(x)', '330')).toBe('v(x) [330]');
  });
});

describe('traceKeys', () => {
  it('lists the first result’s non-sweep vector names', () => {
    expect(traceKeys([trial(0, 1)])).toEqual(['v(out)', 'v(led_a)']);
  });

  it('returns [] for an empty result set', () => {
    expect(traceKeys([])).toEqual([]);
  });
});

describe('flattenMcTrials', () => {
  const trials = [trial(0, 1), trial(1, 1.05), trial(2, 0.95)];

  it('emits one trace per (trial, vector) with the trial sweep as xs', () => {
    const out = flattenMcTrials(trials);
    expect(out).toHaveLength(6);
    expect(out[0]?.xs).toEqual([0, 1e-6, 2e-6]);
  });

  it('the nominal (first) trial is full-opacity and carries the legend', () => {
    const out = flattenMcTrials(trials);
    const nominal = out.filter((t) => t.alpha === 1);
    expect(nominal.map((t) => t.name)).toEqual(['v(out)', 'v(led_a)']);
    expect(nominal.every((t) => t.legend === true)).toBe(true);
  });

  it('non-nominal trials render translucent and legend-less', () => {
    const out = flattenMcTrials(trials);
    const spaghetti = out.filter((t) => t.legend === false);
    expect(spaghetti).toHaveLength(4);
    expect(spaghetti.every((t) => t.alpha === MC_TRIAL_ALPHA)).toBe(true);
    expect(spaghetti.map((t) => t.name)).toContain('v(out) #1');
  });

  it('a vector keeps one colorIndex across all trials', () => {
    const out = flattenMcTrials(trials);
    const vOut = out.filter((t) => t.key === 'v(out)');
    expect(new Set(vOut.map((t) => t.colorIndex)).size).toBe(1);
    const vLed = out.filter((t) => t.key === 'v(led_a)');
    expect(vLed[0]?.colorIndex).not.toBe(vOut[0]?.colorIndex);
  });

  it('excludes the sweep vector', () => {
    expect(flattenMcTrials(trials).some((t) => t.key === 'time')).toBe(false);
  });

  it('handles zero trials', () => {
    expect(flattenMcTrials([])).toEqual([]);
  });
});

describe('flattenStepRuns', () => {
  const runs = [stepRun('220', 1), stepRun('330', 2), stepRun('1k', 3)];

  it('labels each run "v(x) [value]" at normal opacity', () => {
    const out = flattenStepRuns(runs);
    expect(out.map((t) => t.name)).toEqual(['v(out) [220]', 'v(out) [330]', 'v(out) [1k]']);
    expect(out.every((t) => t.alpha === undefined)).toBe(true);
    expect(out.every((t) => t.legend === true)).toBe(true);
  });

  it('color-cycles across runs', () => {
    const out = flattenStepRuns(runs);
    expect(out.map((t) => t.colorIndex)).toEqual([0, 1, 2]);
  });

  it('keeps the shared vector name as the checkbox key', () => {
    const out = flattenStepRuns(runs);
    expect(new Set(out.map((t) => t.key))).toEqual(new Set(['v(out)']));
  });

  it('excludes the sweep vector and uses it for xs', () => {
    const out = flattenStepRuns(runs);
    expect(out.some((t) => t.key === 'time')).toBe(false);
    expect(out[1]?.xs).toEqual([0, 1e-6]);
    expect(out[1]?.ys).toEqual([0, 2]);
  });
});
