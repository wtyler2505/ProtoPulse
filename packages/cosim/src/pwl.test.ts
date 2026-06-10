import { describe, expect, it } from 'vitest';

import { pinEventsToPwl, pwlCard } from './pwl.js';

import type { PwlPoint, PwlSpec } from './pwl.js';
import type { DigitalLevel, PinEvent } from '@protopulse/emu';

/** 1 MHz clock → cycle N is exactly N µs; keeps the expected math legible. */
const BASE: PwlSpec = {
  clockHz: 1e6,
  windowS: 100e-6,
  voltsHigh: 5,
  voltsLow: 0,
  riseS: 1e-6,
  initialLevel: 0,
};

function ev(pin: string, level: DigitalLevel, cycle: number): PinEvent {
  return { pin, level, cycle };
}

function times(points: readonly PwlPoint[]): number[] {
  return points.map((p) => p.tS);
}

describe('pinEventsToPwl — holds and ramps', () => {
  it('emits a flat hold for an empty event list', () => {
    expect(pinEventsToPwl([], 'B5', BASE)).toEqual([
      { tS: 0, v: 0 },
      { tS: 100e-6, v: 0 },
    ]);
  });

  it('honors initialLevel 1 (flat high when no edges arrive)', () => {
    expect(pinEventsToPwl([], 'B5', { ...BASE, initialLevel: 1 })).toEqual([
      { tS: 0, v: 5 },
      { tS: 100e-6, v: 5 },
    ]);
  });

  it('turns a single rising edge into hold + ramp + final hold', () => {
    const points = pinEventsToPwl([ev('B5', 1, 10)], 'B5', BASE);
    expect(points).toEqual([
      { tS: 0, v: 0 },
      { tS: 10e-6, v: 0 },
      { tS: 11e-6, v: 5 },
      { tS: 100e-6, v: 5 },
    ]);
  });

  it('turns a falling edge from an initial-high pin into a down ramp', () => {
    const points = pinEventsToPwl([ev('B5', 0, 20)], 'B5', { ...BASE, initialLevel: 1 });
    expect(points).toEqual([
      { tS: 0, v: 5 },
      { tS: 20e-6, v: 5 },
      { tS: 21e-6, v: 0 },
      { tS: 100e-6, v: 0 },
    ]);
  });

  it('renders a square wave: rise, hold, fall, hold', () => {
    const points = pinEventsToPwl([ev('B5', 1, 10), ev('B5', 0, 50)], 'B5', BASE);
    expect(points).toEqual([
      { tS: 0, v: 0 },
      { tS: 10e-6, v: 0 },
      { tS: 11e-6, v: 5 },
      { tS: 50e-6, v: 5 },
      { tS: 51e-6, v: 0 },
      { tS: 100e-6, v: 0 },
    ]);
  });

  it('uses the configured voltage levels', () => {
    const points = pinEventsToPwl([ev('B5', 1, 10)], 'B5', {
      ...BASE,
      voltsHigh: 3.3,
      voltsLow: 0.2,
    });
    expect(points[0]).toEqual({ tS: 0, v: 0.2 });
    expect(points[2]).toEqual({ tS: 11e-6, v: 3.3 });
  });
});

describe('pinEventsToPwl — filtering and ordering', () => {
  it('ignores events for other pins', () => {
    const points = pinEventsToPwl(
      [ev('D3', 1, 5), ev('B5', 1, 10), ev('D3', 0, 12)],
      'B5',
      BASE,
    );
    expect(points).toHaveLength(4);
    expect(points[1]).toEqual({ tS: 10e-6, v: 0 });
  });

  it('ignores repeated same-level events (not level changes)', () => {
    const points = pinEventsToPwl([ev('B5', 1, 10), ev('B5', 1, 30)], 'B5', BASE);
    expect(points).toEqual(pinEventsToPwl([ev('B5', 1, 10)], 'B5', BASE));
  });

  it('sorts unsorted events by cycle before building the waveform', () => {
    const sorted = pinEventsToPwl([ev('B5', 1, 10), ev('B5', 0, 50)], 'B5', BASE);
    const shuffled = pinEventsToPwl([ev('B5', 0, 50), ev('B5', 1, 10)], 'B5', BASE);
    expect(shuffled).toEqual(sorted);
  });
});

describe('pinEventsToPwl — window edges and overlap clamping', () => {
  it('drops edges at or beyond the window end', () => {
    const points = pinEventsToPwl([ev('B5', 1, 100), ev('B5', 0, 150)], 'B5', BASE);
    expect(points).toEqual([
      { tS: 0, v: 0 },
      { tS: 100e-6, v: 0 },
    ]);
  });

  it('clamps a ramp that would run past the window end', () => {
    const points = pinEventsToPwl([ev('B5', 1, 99)], 'B5', { ...BASE, riseS: 2e-6 });
    expect(points).toEqual([
      { tS: 0, v: 0 },
      { tS: 99e-6, v: 0 },
      { tS: 100e-6, v: 5 }, // ramp end clamped from 101µs to the window
    ]);
  });

  it('clamps a ramp that would start inside the previous ramp', () => {
    // Rise at 10µs takes until 12µs; the fall at 11µs must wait.
    const points = pinEventsToPwl([ev('B5', 1, 10), ev('B5', 0, 11)], 'B5', {
      ...BASE,
      riseS: 2e-6,
    });
    expect(points).toEqual([
      { tS: 0, v: 0 },
      { tS: 10e-6, v: 0 },
      { tS: 12e-6, v: 5 },
      { tS: 14e-6, v: 0 }, // no hold point — back-to-back ramps
      { tS: 100e-6, v: 0 },
    ]);
  });

  it('keeps times strictly increasing through a dense edge train', () => {
    // Toggle every cycle while the ramp itself takes 3µs.
    const dense: PinEvent[] = [];
    for (let i = 1; i <= 40; i++) {
      dense.push(ev('B5', (i % 2) as DigitalLevel, i));
    }
    const points = pinEventsToPwl(dense, 'B5', { ...BASE, riseS: 3e-6 });
    const ts = times(points);
    for (let i = 1; i < ts.length; i++) {
      expect(ts[i] ?? Number.NaN).toBeGreaterThan(ts[i - 1] ?? Number.NaN);
    }
    expect(ts[0]).toBe(0);
    expect(ts[ts.length - 1]).toBe(100e-6);
  });

  it('rejects non-positive clockHz, windowS, or riseS', () => {
    expect(() => pinEventsToPwl([], 'B5', { ...BASE, clockHz: 0 })).toThrow(/positive/);
    expect(() => pinEventsToPwl([], 'B5', { ...BASE, windowS: -1 })).toThrow(/positive/);
    expect(() => pinEventsToPwl([], 'B5', { ...BASE, riseS: 0 })).toThrow(/positive/);
  });
});

describe('pwlCard', () => {
  const points: PwlPoint[] = [
    { tS: 0, v: 0 },
    { tS: 1e-6, v: 5 },
  ];

  it('emits the V…PWL source on a private drive node plus the series Rout', () => {
    expect(pwlCard('b5', 'drive', 30, points)).toBe(
      'Vb5 b5_drv 0 PWL(0 0 1e-6 5)\nRb5 b5_drv drive 30',
    );
  });

  it('formats every number with the deterministic SPICE form', () => {
    const card = pwlCard('b5', 'cap_out', 30, [
      { tS: 0, v: 0 },
      { tS: 0.000075375, v: 3.3 },
      { tS: 0.0001, v: 0 },
    ]);
    expect(card).toContain('PWL(0 0 7.5375e-5 3.3 1e-4 0)');
  });

  it('rejects fewer than two points', () => {
    expect(() => pwlCard('b5', 'drive', 30, [{ tS: 0, v: 0 }])).toThrow(/at least 2 points/);
  });

  it('rejects a non-positive series resistance', () => {
    expect(() => pwlCard('b5', 'drive', 0, points)).toThrow(/routOhms/);
    expect(() => pwlCard('b5', 'drive', -30, points)).toThrow(/routOhms/);
  });
});
