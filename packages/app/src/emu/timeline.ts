import type { DigitalLevel, PinEvent } from './types.js';

/**
 * Pure timeline math for the Firmware panel's "logic analyzer lite":
 * turn the session's pin-event ring into step-function traces over a
 * virtual-time window, ready for the shared Plot (duplicate-x points
 * make the canvas line renderer draw square edges). No DOM, no canvas —
 * this module is what the unit tests exercise.
 */

export interface StepPoint {
  /** Virtual time in seconds (cycle / clockHz). */
  tSec: number;
  level: DigitalLevel;
}

export interface StepTrace {
  pin: string;
  points: StepPoint[];
}

export interface TimelineWindow {
  clockHz: number;
  /** Pins to build traces for, in display order. */
  pins: readonly string[];
  /** Window start, in cycles (inclusive boundary level is carried in). */
  windowStartCycle: number;
  /** Window end, in cycles (usually the session's current cycle count). */
  windowEndCycle: number;
}

/**
 * Build one step trace per requested pin over [windowStartCycle,
 * windowEndCycle]. The level at the window start is the level of the
 * last event at or before it (0 when the pin has never fired); each
 * in-window transition emits a duplicate-x pair so the plot draws a
 * vertical edge; the trace always ends with a point at the window end.
 * Events that don't change the level are skipped. An empty window
 * (end ≤ start) yields traces with no points.
 */
export function buildPinTraces(events: readonly PinEvent[], win: TimelineWindow): StepTrace[] {
  const { clockHz, pins, windowStartCycle, windowEndCycle } = win;
  const toSec = (cycle: number): number => cycle / clockHz;

  return pins.map((pin) => {
    if (!(clockHz > 0) || windowEndCycle <= windowStartCycle) {
      return { pin, points: [] };
    }
    let level: DigitalLevel = 0;
    const points: StepPoint[] = [];
    for (const e of events) {
      if (e.pin !== pin) continue;
      if (e.cycle <= windowStartCycle) {
        // Carry the pre-window level into the window start.
        level = e.level;
        continue;
      }
      if (e.cycle > windowEndCycle) break;
      if (e.level === level) continue;
      if (points.length === 0) points.push({ tSec: toSec(windowStartCycle), level });
      const t = toSec(e.cycle);
      points.push({ tSec: t, level });
      points.push({ tSec: t, level: e.level });
      level = e.level;
    }
    if (points.length === 0) points.push({ tSec: toSec(windowStartCycle), level });
    points.push({ tSec: toSec(windowEndCycle), level });
    return { pin, points };
  });
}

export interface PlotXYOpts {
  /** Added to every y — stacks multiple digital traces apart. */
  yOffset?: number;
  /** Height of a logic 1; defaults to 1. */
  amplitude?: number;
}

/** Flatten a step trace into the xs/ys arrays the shared Plot consumes. */
export function traceToPlotXY(
  trace: StepTrace,
  opts: PlotXYOpts = {},
): { xs: number[]; ys: number[] } {
  const yOffset = opts.yOffset ?? 0;
  const amplitude = opts.amplitude ?? 1;
  const xs: number[] = [];
  const ys: number[] = [];
  for (const p of trace.points) {
    xs.push(p.tSec);
    ys.push(yOffset + p.level * amplitude);
  }
  return { xs, ys };
}
