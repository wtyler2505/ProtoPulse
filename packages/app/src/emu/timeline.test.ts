import { describe, expect, it } from 'vitest';

import { buildPinTraces, traceToPlotXY } from './timeline.js';

import type { PinEvent } from './types.js';

const HZ = 1000; // 1 cycle = 1ms — keeps the expected tSec values readable

function ev(pin: string, level: 0 | 1, cycle: number): PinEvent {
  return { pin, level, cycle };
}

describe('buildPinTraces', () => {
  it('turns transitions into duplicate-x step points (square edges)', () => {
    const events = [ev('PB5', 1, 100), ev('PB5', 0, 300)];
    const [trace] = buildPinTraces(events, {
      clockHz: HZ,
      pins: ['PB5'],
      windowStartCycle: 0,
      windowEndCycle: 400,
    });
    expect(trace?.points).toEqual([
      { tSec: 0, level: 0 }, // window start at the initial level
      { tSec: 0.1, level: 0 }, // rising edge: duplicate-x pair
      { tSec: 0.1, level: 1 },
      { tSec: 0.3, level: 1 }, // falling edge
      { tSec: 0.3, level: 0 },
      { tSec: 0.4, level: 0 }, // held to the window end
    ]);
  });

  it('carries the level of the last pre-window event into the window start', () => {
    const events = [ev('PB5', 1, 50), ev('PB5', 0, 80), ev('PB5', 1, 90)];
    const [trace] = buildPinTraces(events, {
      clockHz: HZ,
      pins: ['PB5'],
      windowStartCycle: 100,
      windowEndCycle: 200,
    });
    // No in-window transitions: a flat line at the carried-in level 1.
    expect(trace?.points).toEqual([
      { tSec: 0.1, level: 1 },
      { tSec: 0.2, level: 1 },
    ]);
  });

  it('defaults to level 0 for a pin with no events at all', () => {
    const [trace] = buildPinTraces([], {
      clockHz: HZ,
      pins: ['PD3'],
      windowStartCycle: 0,
      windowEndCycle: 100,
    });
    expect(trace?.points).toEqual([
      { tSec: 0, level: 0 },
      { tSec: 0.1, level: 0 },
    ]);
  });

  it('excludes events after the window end', () => {
    const events = [ev('PB5', 1, 100), ev('PB5', 0, 900)];
    const [trace] = buildPinTraces(events, {
      clockHz: HZ,
      pins: ['PB5'],
      windowStartCycle: 0,
      windowEndCycle: 500,
    });
    expect(trace?.points.at(-1)).toEqual({ tSec: 0.5, level: 1 }); // 0@900 ignored
    expect(trace?.points.filter((p) => p.tSec > 0.5)).toHaveLength(0);
  });

  it('skips events that do not change the level (no redundant points)', () => {
    const events = [ev('PB5', 1, 100), ev('PB5', 1, 200), ev('PB5', 0, 300)];
    const [trace] = buildPinTraces(events, {
      clockHz: HZ,
      pins: ['PB5'],
      windowStartCycle: 0,
      windowEndCycle: 400,
    });
    expect(trace?.points.filter((p) => p.tSec === 0.2)).toHaveLength(0);
    expect(trace?.points).toHaveLength(6); // start + 2 edges (2 pts each) + end
  });

  it('builds one trace per requested pin, in display order, ignoring others', () => {
    const events = [ev('PB5', 1, 10), ev('PD3', 1, 20), ev('PD7', 1, 30)];
    const traces = buildPinTraces(events, {
      clockHz: HZ,
      pins: ['PD3', 'PB5'],
      windowStartCycle: 0,
      windowEndCycle: 100,
    });
    expect(traces.map((t) => t.pin)).toEqual(['PD3', 'PB5']);
    expect(traces[0]?.points.some((p) => p.tSec === 0.02)).toBe(true);
    expect(traces[1]?.points.some((p) => p.tSec === 0.01)).toBe(true);
  });

  it('converts cycles to seconds via the core clock', () => {
    const events = [ev('PB5', 1, 16_000)];
    const [trace] = buildPinTraces(events, {
      clockHz: 16_000_000,
      pins: ['PB5'],
      windowStartCycle: 0,
      windowEndCycle: 32_000,
    });
    expect(trace?.points[1]?.tSec).toBeCloseTo(0.001, 9); // 16k cycles @ 16MHz = 1ms
    expect(trace?.points.at(-1)?.tSec).toBeCloseTo(0.002, 9);
  });

  it('yields empty traces for an empty or inverted window', () => {
    const events = [ev('PB5', 1, 10)];
    for (const windowEndCycle of [0, 5]) {
      const [trace] = buildPinTraces(events, {
        clockHz: HZ,
        pins: ['PB5'],
        windowStartCycle: 5,
        windowEndCycle,
      });
      expect(trace?.points).toEqual([]);
    }
  });

  it('treats an event exactly at the window start as the carried-in level', () => {
    const events = [ev('PB5', 1, 100)];
    const [trace] = buildPinTraces(events, {
      clockHz: HZ,
      pins: ['PB5'],
      windowStartCycle: 100,
      windowEndCycle: 200,
    });
    expect(trace?.points).toEqual([
      { tSec: 0.1, level: 1 },
      { tSec: 0.2, level: 1 },
    ]);
  });
});

describe('traceToPlotXY', () => {
  it('flattens points to xs/ys for the shared Plot', () => {
    const xy = traceToPlotXY({
      pin: 'PB5',
      points: [
        { tSec: 0, level: 0 },
        { tSec: 0.1, level: 0 },
        { tSec: 0.1, level: 1 },
      ],
    });
    expect(xy.xs).toEqual([0, 0.1, 0.1]);
    expect(xy.ys).toEqual([0, 0, 1]);
  });

  it('stacks traces apart with yOffset and scales logic 1 by amplitude', () => {
    const xy = traceToPlotXY(
      {
        pin: 'PD3',
        points: [
          { tSec: 0, level: 1 },
          { tSec: 1, level: 0 },
        ],
      },
      { yOffset: 3, amplitude: 0.8 },
    );
    expect(xy.ys).toEqual([3.8, 3]);
  });

  it('handles an empty trace', () => {
    expect(traceToPlotXY({ pin: 'PB5', points: [] })).toEqual({ xs: [], ys: [] });
  });
});
