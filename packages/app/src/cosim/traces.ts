import { buildPinTraces, traceToPlotXY } from '../emu/timeline.js';

import type { PinEvent } from '../emu/types.js';

/**
 * Pure trace-assembly math for the Co-sim panel's money plot: the bound
 * pins' digital square waves stacked ABOVE the analog node voltages on
 * one shared axis — the MCU edge and the RC curve it causes, one
 * picture. No DOM, no canvas — this module is what the unit tests
 * exercise; CosimPanel.tsx only adds colors and paints.
 */

export interface CosimAnalogVector {
  name: string;
  xs: number[];
  ys: number[];
}

export interface CosimTrace {
  name: string;
  xs: number[];
  ys: number[];
  kind: 'digital' | 'analog';
}

/** Geometry for the digital lane above the analog traces. */
export interface DigitalLayout {
  /** Height of a logic 1. */
  amplitude: number;
  /** Vertical distance between pin rows. */
  spacing: number;
  /** y of the BOTTOM row's logic-0 level. */
  base: number;
}

/** Min/max over every finite analog sample, or null with no samples. */
export function analogExtent(
  vectors: readonly CosimAnalogVector[],
): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  for (const v of vectors) {
    for (const y of v.ys) {
      if (!Number.isFinite(y)) continue;
      if (y < min) min = y;
      if (y > max) max = y;
    }
  }
  return Number.isFinite(min) ? { min, max } : null;
}

/**
 * Place the digital lane: rows a quarter of the analog span tall (so the
 * square waves read as annotations, not as volts), half an amplitude of
 * clearance above the analog maximum. Falls back to unit rows above 0
 * when there is no (or a flat) analog signal to scale against.
 */
export function digitalLayout(extent: { min: number; max: number } | null): DigitalLayout {
  const span = extent ? extent.max - extent.min : 0;
  const amplitude = span > 0 ? span / 4 : 1;
  return {
    amplitude,
    spacing: amplitude * 1.5,
    base: (extent?.max ?? 0) + amplitude / 2,
  };
}

export interface AssembleArgs {
  /** Pin transitions from the co-sim window (cycle-stamped from power-on). */
  pinEvents: readonly PinEvent[];
  /** Bound pins in display order — the FIRST renders topmost. */
  pins: readonly string[];
  /** Core clock, to convert windowS into a cycle window. */
  clockHz: number;
  /** Window length in seconds; the digital traces span [0, windowS]. */
  windowS: number;
  /** Analog vectors to plot as-is (already filtered to the visible set). */
  analog: readonly CosimAnalogVector[];
}

/** Digital square waves stacked above the analog vectors, ready for Plot. */
export function assembleCosimTraces(args: AssembleArgs): CosimTrace[] {
  const { pinEvents, pins, clockHz, windowS, analog } = args;
  const layout = digitalLayout(analogExtent(analog));

  const digital: CosimTrace[] = buildPinTraces(pinEvents, {
    clockHz,
    pins,
    windowStartCycle: 0,
    windowEndCycle: Math.round(windowS * clockHz),
  }).map((trace, i, all) => {
    const { xs, ys } = traceToPlotXY(trace, {
      yOffset: layout.base + (all.length - 1 - i) * layout.spacing,
      amplitude: layout.amplitude,
    });
    return { name: trace.pin, xs, ys, kind: 'digital' as const };
  });

  return [
    ...digital,
    ...analog.map((v) => ({ name: v.name, xs: [...v.xs], ys: [...v.ys], kind: 'analog' as const })),
  ];
}

/**
 * Wall-time / virtual-time slowdown factor — the Vol II D.3 performance
 * honesty number ("this 500 µs window cost ×N real time"). Null when no
 * virtual time elapsed (a halted core), so the panel never prints ×∞.
 */
export function slowdownFactor(wallMs: number, virtualTimeS: number): number | null {
  if (!(virtualTimeS > 0) || !Number.isFinite(wallMs) || wallMs < 0) return null;
  return wallMs / 1000 / virtualTimeS;
}
