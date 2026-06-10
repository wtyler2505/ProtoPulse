import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SpiceEngine, vectorByName } from './engine.js';

import type { SimVector } from './engine.js';

/**
 * Integration tests against the real ngspice WASM engine. One shared
 * engine — boot takes seconds; setNetList + runSim are cheap per run.
 */

const engine = new SpiceEngine();

beforeAll(async () => {
  await engine.start();
}, 60_000);

afterAll(async () => {
  await engine.stop();
});

function last(v: SimVector | undefined): number {
  expect(v).toBeDefined();
  const value = v?.values[v.values.length - 1];
  expect(value).toBeDefined();
  return value ?? Number.NaN;
}

/** Hand-written led-resistor deck body (no analysis card, no .end). */
const LED_RESISTOR_BODY = [
  '* led resistor',
  'V1 vbat 0 DC 9',
  'R1 vbat led_a 330',
  'D1 led_a 0 DLED',
  '.model DLED D(IS=1e-20 N=2.0)',
  '',
].join('\n');

describe('SpiceEngine — transient', () => {
  it('settles the LED node near its forward drop with ~20mA loop current', async () => {
    const result = await engine.run(LED_RESISTOR_BODY, {
      kind: 'tran',
      stepS: 1e-5,
      stopS: 1e-3,
    });
    expect(result.analysis.kind).toBe('tran');
    expect(result.variables).toContain('time');
    expect(result.points).toBeGreaterThan(10);

    const vLed = last(vectorByName(result, 'v(led_a)'));
    expect(vLed).toBeGreaterThanOrEqual(1.8);
    expect(vLed).toBeLessThanOrEqual(2.6);

    const iV1 = Math.abs(last(vectorByName(result, 'i(v1)')));
    expect(iV1).toBeGreaterThanOrEqual(0.015);
    expect(iV1).toBeLessThanOrEqual(0.025);

    // Transient results are real-valued: no imaginary part.
    expect(result.vectors.every((v) => v.imag === undefined)).toBe(true);
  });

  it('reuses one engine across runs with consistent results', async () => {
    const a = await engine.run(LED_RESISTOR_BODY, { kind: 'tran', stepS: 1e-5, stopS: 1e-4 });
    const b = await engine.run(LED_RESISTOR_BODY, { kind: 'tran', stepS: 1e-5, stopS: 1e-4 });
    expect(last(vectorByName(b, 'v(led_a)'))).toBeCloseTo(last(vectorByName(a, 'v(led_a)')), 6);
  });
});

describe('SpiceEngine — operating point', () => {
  it('returns a single point with the same physics', async () => {
    const result = await engine.run(LED_RESISTOR_BODY, { kind: 'op' });
    expect(result.points).toBe(1);
    const vLed = last(vectorByName(result, 'v(led_a)'));
    expect(vLed).toBeGreaterThanOrEqual(1.8);
    expect(vLed).toBeLessThanOrEqual(2.6);
    for (const v of result.vectors) {
      expect(v.values).toHaveLength(1);
    }
  });
});

describe('SpiceEngine — AC', () => {
  it('rolls off an RC low-pass and reports complex vectors', async () => {
    const body = [
      '* rc low-pass',
      'V1 in 0 DC 0 AC 1',
      'R1 in out 1k',
      'C1 out 0 100n',
      '',
    ].join('\n');
    // f_c = 1/(2π·1k·100n) ≈ 1.59 kHz.
    const result = await engine.run(body, {
      kind: 'ac',
      variation: 'dec',
      points: 10,
      fStart: 10,
      fStop: 1e6,
    });
    const out = vectorByName(result, 'v(out)');
    expect(out).toBeDefined();
    expect(out?.imag).toBeDefined();
    expect(out?.imag).toHaveLength(out?.values.length ?? -1);

    const mag = (i: number): number => {
      const re = out?.values[i] ?? Number.NaN;
      const im = out?.imag?.[i] ?? Number.NaN;
      return Math.hypot(re, im);
    };
    const first = mag(0);
    const lastIdx = (out?.values.length ?? 1) - 1;
    expect(first).toBeGreaterThan(0.99); // flat in the passband
    expect(mag(lastIdx)).toBeLessThan(first / 100); // well past the corner
  });
});

describe('SpiceEngine — DC sweep', () => {
  it('returns a monotonic sweep variable across the commanded range', async () => {
    const body = [
      '* divider sweep',
      'V1 vin 0 DC 0',
      'R1 vin out 1k',
      'R2 out 0 1k',
      '',
    ].join('\n');
    const result = await engine.run(body, { kind: 'dc', source: 'V1', start: 0, stop: 9, step: 1 });
    expect(result.points).toBe(10);

    const sweep = result.vectors.find((v) => v.name.includes('sweep')) ?? result.vectors[0];
    expect(sweep).toBeDefined();
    const values = sweep?.values ?? [];
    expect(values[0]).toBeCloseTo(0, 9);
    expect(values[values.length - 1]).toBeCloseTo(9, 9);
    for (let i = 1; i < values.length; i++) {
      expect(values[i] ?? Number.NaN).toBeGreaterThan(values[i - 1] ?? Number.NaN);
    }

    // Divider sanity: out tracks vin/2.
    const out = vectorByName(result, 'v(out)');
    expect(last(out)).toBeCloseTo(4.5, 3);
  });
});
