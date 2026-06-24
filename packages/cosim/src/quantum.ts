import { SpiceEngine, generateSpiceNetlist, simulate, vectorByName } from '@protopulse/sim';

import { STEP_CHUNK_CYCLES, bindingCard } from './run.js';
import {
  COMPARATOR_HYST_V,
  DEFAULT_QUANTUM_S,
  DEFAULT_VIH_V,
  DEFAULT_VIL_V,
  closedLoopSpecSchema,
  hasAdcSupport,
  hasI2cSupport,
  hasSpiSupport,
} from './types.js';

import type {
  AdcReadRequest,
  ClosedLoopResult,
  ClosedLoopSpec,
} from './types.js';
import type { DigitalLevel, McuCore, PinEvent } from '@protopulse/emu';
import type { DesignGraph, Uuid } from '@protopulse/graph';
import type { PartDb } from '@protopulse/parts';
import type { SimulateResult } from '@protopulse/sim';

/**
 * The co-sim bus, second slice (Vol II §D.3): the CLOSED LOOP —
 * MCU↔SPICE, lock-stepped on a conservative quantum.
 *
 * Per quantum k:
 *   (a) digital input pins are driven through a Schmitt comparator over
 *       the PREVIOUS solve's voltage at the quantum start (quantum 0
 *       sees 0 V — nothing has been solved yet);
 *   (b) the ADC sampler is installed, answering each firmware-initiated
 *       conversion with the previous solve's voltage at the conversion's
 *       virtual time (linear interpolation between solver points,
 *       zero-order hold past the solve's end);
 *   (c) the core steps one quantum of cycles, accumulating output pin
 *       edges;
 *   (d) the FULL PWL history (all edges so far) is rebuilt and the
 *       transient is re-solved from t=0 out to the quantum's end.
 *
 * ── The honesty section ──────────────────────────────────────────────
 * The batch SPICE engine (ngspice-WASM behind eecircuit-engine) cannot
 * pause/resume — there is NO solver state continuity. So every quantum
 * re-runs the whole transient FROM ZERO over an ever longer span: the
 * loop is O(quanta²)-ish in solver work. `rerunSolves` counts every one
 * of those full re-solves so the cost is never hidden. The feedback the
 * MCU sees is also one quantum STALE by construction (Vol II D.3's
 * conservative scheme adapted to a batch engine): the loop never
 * rolls back, it just keeps the quantum small enough that staleness is
 * an error term, not a lie.
 */

/** What the comparator uses when the caller does not override it. */
export interface ComparatorThresholds {
  /** Falling threshold, volts (≤ vilV → low). */
  vilV: number;
  /** Rising threshold, volts (≥ vihV → high). */
  vihV: number;
  /** Minimum band between effective thresholds, volts. */
  hystV: number;
}

export const DEFAULT_COMPARATOR: ComparatorThresholds = {
  vilV: DEFAULT_VIL_V,
  vihV: DEFAULT_VIH_V,
  hystV: COMPARATOR_HYST_V,
};

/**
 * One Schmitt-comparator step, state retained by the caller per pin:
 * rise when v ≥ VIH, fall when v ≤ VIL, hold in between. The 100 mV
 * hysteresis is enforced as a FLOOR on the band — if a caller ever
 * narrows VIH toward VIL, the rising threshold is lifted to VIL + hyst
 * so a node sitting on one threshold can never chatter. The 1.5 V/3.0 V
 * defaults already dwarf the floor.
 */
export function comparatorStep(
  state: DigitalLevel,
  volts: number,
  thresholds: ComparatorThresholds = DEFAULT_COMPARATOR,
): DigitalLevel {
  const riseAt = Math.max(thresholds.vihV, thresholds.vilV + thresholds.hystV);
  if (state === 0) return volts >= riseAt ? 1 : 0;
  return volts <= thresholds.vilV ? 0 : 1;
}

/**
 * Linear interpolation over one solved vector. Outside the solved span
 * the nearest endpoint holds (zero-order hold past the end — that IS
 * the one-quantum feedback latency). No points at all → 0 V, which is
 * exactly quantum 0's "nothing solved yet" answer.
 */
export function interpolateAt(
  ts: readonly number[],
  vs: readonly number[],
  t: number,
): number {
  const n = Math.min(ts.length, vs.length);
  if (n === 0) return 0;
  const first = ts[0] ?? 0;
  if (t <= first) return vs[0] ?? 0;
  const last = ts[n - 1] ?? 0;
  if (t >= last) return vs[n - 1] ?? 0;
  // Binary search for the bracketing pair.
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((ts[mid] ?? 0) <= t) lo = mid;
    else hi = mid;
  }
  const t0 = ts[lo] ?? 0;
  const t1 = ts[hi] ?? 0;
  const v0 = vs[lo] ?? 0;
  const v1 = vs[hi] ?? 0;
  if (t1 <= t0) return v0;
  return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
}

export interface RunCosimClosedLoopArgs {
  graph: DesignGraph;
  parts: PartDb;
  /** The MCU core, firmware already loaded. Stepped (not reset) by this call. */
  core: McuCore;
  spec: ClosedLoopSpec;
  /** Reuse a booted engine (STRONGLY recommended here — the loop solves
   *  once per quantum; a cold boot per call costs seconds). */
  engine?: SpiceEngine;
}

/** Normalize float-sum dust the same way pwl.ts/spiceNum do. */
function clean(t: number): number {
  return Number(t.toPrecision(12));
}

/** Voltage reader over one previous solve, by SPICE node name. */
function makeVoltsAt(
  prev: SimulateResult | null,
): (node: string, tS: number) => number {
  if (prev === null) return () => 0; // quantum 0: nothing solved yet
  const time = vectorByName(prev, 'time')?.values ?? [];
  return (node: string, tS: number): number => {
    if (node === '0') return 0; // ground is ground
    const vec = vectorByName(prev, `v(${node})`);
    if (vec === undefined) return 0;
    return interpolateAt(time, vec.values, tS);
  };
}

export async function runCosimClosedLoop(
  args: RunCosimClosedLoopArgs,
): Promise<ClosedLoopResult> {
  const { graph, parts, core } = args;
  const spec = closedLoopSpecSchema.parse(args.spec);
  const quantumS = spec.quantumS ?? DEFAULT_QUANTUM_S;
  const inputs = spec.inputs ?? [];
  const adcBindings = spec.adc ?? [];

  // Validate net references against the graph before burning any cycles.
  for (const binding of spec.bindings) {
    if (!graph.nets.has(binding.netId)) {
      throw new Error(`cosim binding ${binding.pin}: netId "${binding.netId}" is not in the graph`);
    }
  }
  for (const input of inputs) {
    if (!graph.nets.has(input.netId)) {
      throw new Error(`cosim input ${input.pin}: netId "${input.netId}" is not in the graph`);
    }
  }
  for (const adc of adcBindings) {
    if (!graph.nets.has(adc.netId)) {
      throw new Error(
        `cosim ADC channel ${String(adc.channel)}: netId "${adc.netId}" is not in the graph`,
      );
    }
  }

  // The ADC surface is a PINNED emu addition — probe, never assume.
  const adcCore = hasAdcSupport(core) ? core : null;
  if (adcBindings.length > 0 && adcCore === null) {
    throw new Error(
      'closed-loop ADC bindings need a core with the pinned ADC surface ' +
        '(setAdcSampler/drainAdcReads) — this @protopulse/emu build lacks it',
    );
  }

  // I2C slave devices: installed once for the whole run (the master reads them
  // mid-step, like the ADC sampler). Probe the pinned surface, never assume.
  const i2cDevices = spec.i2cDevices ?? [];
  if (i2cDevices.length > 0) {
    if (!hasI2cSupport(core)) {
      throw new Error(
        'closed-loop I2C device bindings need a core with the pinned I2C surface ' +
          '(setI2cSlave) — this @protopulse/emu build lacks it',
      );
    }
    for (const device of i2cDevices) {
      core.setI2cSlave(device.port, device.slave);
    }
  }

  // SPI slave devices: same install-once model as I2C, probing the pinned
  // SPI surface (setSpiSlave) before use.
  const spiDevices = spec.spiDevices ?? [];
  if (spiDevices.length > 0) {
    if (!hasSpiSupport(core)) {
      throw new Error(
        'closed-loop SPI device bindings need a core with the pinned SPI surface ' +
          '(setSpiSlave) — this @protopulse/emu build lacks it',
      );
    }
    for (const device of spiDevices) {
      core.setSpiSlave(device.port, device.slave);
    }
  }

  // Node names are a function of the graph alone (extraCards never move
  // them), so one netlist pass up front maps every bound net.
  const { nodeOf } = generateSpiceNetlist(graph, parts);
  const nodeFor = (netId: Uuid, what: string): string => {
    const node = nodeOf.get(netId);
    if (node === undefined) {
      throw new Error(`cosim ${what}: net "${netId}" has no SPICE node`);
    }
    return node;
  };
  const outputNodes = spec.bindings.map((b) => nodeFor(b.netId, `binding ${b.pin}`));
  const inputNodes = inputs.map((i) => nodeFor(i.netId, `input ${i.pin}`));
  const adcNodeByChannel = new Map<number, string>(
    adcBindings.map((a) => [a.channel, nodeFor(a.netId, `ADC channel ${String(a.channel)}`)]),
  );

  const quanta = Math.max(1, Math.ceil(clean(spec.windowS / quantumS)));
  const engine = args.engine ?? new SpiceEngine();

  const pinEvents: PinEvent[] = [];
  const adcReads: (AdcReadRequest & { volts: number })[] = [];
  const inputEdges: PinEvent[] = [];
  const inputState = new Map<string, DigitalLevel>(inputs.map((i) => [i.pin, 0]));
  const pwlSources: Record<string, string> = {};
  let rerunSolves = 0;
  let mcuCycles = 0;
  let lastSim: SimulateResult | null = null;

  try {
    for (let k = 0; k < quanta; k++) {
      const quantumStartS = clean(k * quantumS);
      const solveEndS = clean(Math.min((k + 1) * quantumS, spec.windowS));
      const voltsAt = makeVoltsAt(lastSim); // quantum 0 → all-zero reader

      // (a) Digital inputs: comparator over the previous solve at the
      // quantum start. Pins are (re)driven every quantum — cheap, and it
      // makes quantum 0's all-low starting state explicit on the core.
      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        const node = inputNodes[i];
        if (input === undefined || node === undefined) continue;
        const prev = inputState.get(input.pin) ?? 0;
        const next = comparatorStep(prev, voltsAt(node, quantumStartS));
        core.setPin(input.pin, next);
        if (next !== prev) {
          inputState.set(input.pin, next);
          inputEdges.push({ pin: input.pin, level: next, cycle: mcuCycles });
        }
      }

      // (b) ADC sampler: previous solve's voltage at the conversion's
      // virtual time. Unbound channels read 0 V — recorded all the same,
      // so a firmware reading the wrong mux channel is visible.
      if (adcCore !== null) {
        adcCore.setAdcSampler((channel: number, cycle: number): number => {
          const node = adcNodeByChannel.get(channel);
          const volts = node === undefined ? 0 : voltsAt(node, cycle / core.clockHz);
          adcReads.push({ channel, cycle, volts });
          return volts;
        });
      }

      // (c) One quantum of firmware, chunked like the open-loop window.
      const targetCycles = Math.ceil(core.clockHz * solveEndS);
      while (mcuCycles < targetCycles) {
        const budget = Math.min(STEP_CHUNK_CYCLES, targetCycles - mcuCycles);
        const result = core.step(budget);
        mcuCycles += result.cycles;
        pinEvents.push(...result.events);
        if (result.cycles === 0) break; // a halted core makes no progress
      }
      // Keep the core's request queue bounded; the sampler closure above
      // already recorded every conversion WITH its volts.
      adcCore?.drainAdcReads();

      // (d) Full PWL rebuild from ALL events so far, then the re-solve
      // from zero — the no-pause/resume workaround, counted honestly.
      const extraCards: string[] = [];
      for (let i = 0; i < spec.bindings.length; i++) {
        const binding = spec.bindings[i];
        const node = outputNodes[i];
        if (binding === undefined || node === undefined) continue;
        const card = bindingCard(binding, pinEvents, core.clockHz, solveEndS, node);
        pwlSources[binding.pin] = card;
        extraCards.push(card);
      }
      lastSim = await simulate(
        graph,
        parts,
        { kind: 'tran', stepS: spec.stepS, stopS: solveEndS },
        { engine, extraCards },
      );
      rerunSolves += 1;
    }
  } finally {
    if (args.engine === undefined) await engine.stop();
  }

  if (lastSim === null) {
    throw new Error('closed-loop window solved nothing — zero quanta'); // unreachable: quanta ≥ 1
  }
  return {
    sim: lastSim,
    pinEvents,
    mcuCycles,
    virtualTimeS: mcuCycles / core.clockHz,
    pwlSources,
    quanta,
    adcReads,
    inputEdges,
    rerunSolves,
  };
}
