import { spiceNum } from '@protopulse/sim';

import type { DigitalLevel, PinEvent } from '@protopulse/emu';

/**
 * Pin edges → PWL voltage source (Vol II §D.3, MCU→SPICE direction).
 *
 * Pure math, no I/O: a cycle-stamped digital edge list becomes a SPICE
 * piece-wise-linear waveform — hold the level, ramp over `riseS` at
 * each edge, clamp ramps that would overlap, hold to the window end.
 * The companion card builder emits the source PLUS its series Rout;
 * that resistor IS the behavioral GPIO output boundary.
 */

/** One PWL waveform point. */
export interface PwlPoint {
  /** Time, seconds. */
  tS: number;
  /** Voltage at that time. */
  v: number;
}

/** How to translate one pin's digital edges into volts over a window. */
export interface PwlSpec {
  /** MCU core clock, Hz — converts event cycle stamps to seconds. */
  clockHz: number;
  /** Window length, seconds; the waveform always ends here. */
  windowS: number;
  /** Logic-high level, volts. */
  voltsHigh: number;
  /** Logic-low level, volts. */
  voltsLow: number;
  /** Slew ramp per edge, seconds. */
  riseS: number;
  /** Pin level at t=0, before the first edge. */
  initialLevel: DigitalLevel;
}

/**
 * Build the PWL point list for one pin from a (possibly mixed-pin)
 * event stream. Times are strictly increasing; the first point is
 * always t=0 at the initial level and the last is t=windowS.
 */
export function pinEventsToPwl(
  events: readonly PinEvent[],
  pin: string,
  spec: PwlSpec,
): PwlPoint[] {
  const { clockHz, windowS, voltsHigh, voltsLow, riseS, initialLevel } = spec;
  if (!(clockHz > 0) || !(windowS > 0) || !(riseS > 0)) {
    throw new Error('pinEventsToPwl: clockHz, windowS and riseS must all be positive');
  }
  const levelV = (level: DigitalLevel): number => (level === 1 ? voltsHigh : voltsLow);
  // Normalize float-sum artifacts (10e-6 + 1e-6 → 1.1000000000000001e-5)
  // the same way spiceNum does, so point times are clean and stable.
  const clean = (t: number): number => Number(t.toPrecision(12));

  const edges = events.filter((e) => e.pin === pin).sort((a, b) => a.cycle - b.cycle);

  const points: PwlPoint[] = [{ tS: 0, v: levelV(initialLevel) }];
  let level = initialLevel;
  let lastT = 0; // time of the last emitted point (= end of the last ramp)

  for (const edge of edges) {
    if (edge.level === level) continue; // not a level change — ignore
    const tEdge = clean(edge.cycle / clockHz);
    if (tEdge >= windowS) break; // beyond the window (edges are sorted)

    // Clamp: a ramp may not start before the previous one finished.
    const rampStart = Math.max(tEdge, lastT);
    if (rampStart >= windowS) break; // window already fully described
    if (rampStart > lastT) {
      points.push({ tS: rampStart, v: levelV(level) }); // hold until the edge
    }
    level = edge.level;
    const rampEnd = clean(Math.min(rampStart + riseS, windowS));
    points.push({ tS: rampEnd, v: levelV(level) });
    lastT = rampEnd;
  }

  if (lastT < windowS) {
    points.push({ tS: windowS, v: levelV(level) }); // final hold
  }
  return points;
}

/**
 * Emit the SPICE card pair for one bound pin: a PWL voltage source on
 * a private drive node, plus the series Rout into the target net node.
 * The series resistor is the behavioral GPIO output boundary — the net
 * keeps its normal netlist presence and is driven through it.
 *
 * Returns two lines joined by '\n', ready for NetlistOpts.extraCards.
 */
export function pwlCard(
  name: string,
  node: string,
  routOhms: number,
  points: readonly PwlPoint[],
): string {
  if (points.length < 2) {
    throw new Error(`pwlCard: PWL needs at least 2 points (got ${String(points.length)})`);
  }
  if (!(routOhms > 0)) {
    throw new Error('pwlCard: routOhms must be positive');
  }
  const pairs = points.map((p) => `${spiceNum(p.tS)} ${spiceNum(p.v)}`).join(' ');
  return [
    `V${name} ${name}_drv 0 PWL(${pairs})`,
    `R${name} ${name}_drv ${node} ${spiceNum(routOhms)}`,
  ].join('\n');
}
