import { describe, expect, it } from 'vitest';

import {
  analogExtent,
  assembleCosimTraces,
  digitalLayout,
  slowdownFactor,
} from './traces.js';

import type { PinEvent } from '../emu/types.js';

const rcCurve = { name: 'v(out)', xs: [0, 1e-6, 2e-6, 3e-6], ys: [0, 2, 4, 5] };

describe('analogExtent', () => {
  it('spans every finite sample across vectors', () => {
    expect(analogExtent([rcCurve, { name: 'v(in)', xs: [0], ys: [-1] }])).toEqual({
      min: -1,
      max: 5,
    });
  });

  it('ignores non-finite samples and returns null with none left', () => {
    expect(analogExtent([{ name: 'v', xs: [0, 1], ys: [NaN, Infinity] }])).toBeNull();
    expect(analogExtent([])).toBeNull();
  });
});

describe('digitalLayout', () => {
  it('falls back to unit rows just above zero with no analog signal', () => {
    expect(digitalLayout(null)).toEqual({ amplitude: 1, spacing: 1.5, base: 0.5 });
  });

  it('scales rows to a quarter of the analog span, clear of its max', () => {
    const layout = digitalLayout({ min: 0, max: 5 });
    expect(layout.amplitude).toBeCloseTo(1.25);
    expect(layout.spacing).toBeCloseTo(1.875);
    expect(layout.base).toBeCloseTo(5.625); // 5 + amplitude/2 — never overlaps
  });

  it('treats a flat analog signal like no signal for row height', () => {
    const layout = digitalLayout({ min: 3.3, max: 3.3 });
    expect(layout.amplitude).toBe(1);
    expect(layout.base).toBeCloseTo(3.8);
  });
});

describe('assembleCosimTraces', () => {
  // 1 MHz clock: cycle 100 = 100 µs. One PB5 rising edge mid-window.
  const events: PinEvent[] = [{ pin: 'PB5', level: 1, cycle: 100 }];

  it('stacks the digital square wave ABOVE the analog vectors', () => {
    const traces = assembleCosimTraces({
      pinEvents: events,
      pins: ['PB5'],
      clockHz: 1e6,
      windowS: 500e-6,
      analog: [rcCurve],
    });
    expect(traces.map((t) => `${t.kind}:${t.name}`)).toEqual(['digital:PB5', 'analog:v(out)']);

    const pb5 = traces[0];
    const analogMax = Math.max(...rcCurve.ys);
    expect(pb5).toBeDefined();
    if (!pb5) return;
    // Every digital sample sits strictly above the analog maximum.
    expect(Math.min(...pb5.ys)).toBeGreaterThan(analogMax);
    // Square edge: duplicate x at the transition, low → high by one amplitude.
    expect(pb5.xs[0]).toBe(0); // window start
    expect(pb5.xs).toContain(100e-6);
    expect(pb5.xs.filter((x) => x === 100e-6)).toHaveLength(2);
    expect(Math.max(...pb5.ys) - Math.min(...pb5.ys)).toBeCloseTo(1.25); // span/4
    expect(pb5.xs.at(-1)).toBeCloseTo(500e-6); // spans the full window
  });

  it('passes analog vectors through untouched (volts stay volts)', () => {
    const traces = assembleCosimTraces({
      pinEvents: [],
      pins: [],
      clockHz: 1e6,
      windowS: 500e-6,
      analog: [rcCurve],
    });
    expect(traces).toHaveLength(1);
    expect(traces[0]?.xs).toEqual(rcCurve.xs);
    expect(traces[0]?.ys).toEqual(rcCurve.ys);
  });

  it('renders the FIRST pin topmost, one spacing apart', () => {
    const traces = assembleCosimTraces({
      pinEvents: [],
      pins: ['PB5', 'PD3'],
      clockHz: 1e6,
      windowS: 500e-6,
      analog: [],
    });
    const [top, bottom] = traces;
    expect(top?.name).toBe('PB5');
    expect(bottom?.name).toBe('PD3');
    // Both flat at logic 0; the first pin's row sits one spacing higher.
    expect((top?.ys[0] ?? 0) - (bottom?.ys[0] ?? 0)).toBeCloseTo(1.5);
  });
});

describe('slowdownFactor', () => {
  it('is wall time over virtual time', () => {
    // 10 ms of wall clock for a 500 µs window → ×20.
    expect(slowdownFactor(10, 500e-6)).toBeCloseTo(20);
  });

  it('never divides by a halted core', () => {
    expect(slowdownFactor(10, 0)).toBeNull();
    expect(slowdownFactor(NaN, 1e-3)).toBeNull();
    expect(slowdownFactor(-1, 1e-3)).toBeNull();
  });
});
