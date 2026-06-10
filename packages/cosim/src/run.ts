import { generateSpiceNetlist, simulate } from '@protopulse/sim';

import { pinEventsToPwl, pwlCard } from './pwl.js';
import {
  DEFAULT_RISE_S,
  DEFAULT_ROUT_OHMS,
  DEFAULT_VOLTS_HIGH,
  DEFAULT_VOLTS_LOW,
  cosimWindowSpecSchema,
} from './types.js';

import type { CosimResult, CosimWindowSpec, PinBinding } from './types.js';
import type { DigitalLevel, McuCore, PinEvent } from '@protopulse/emu';
import type { DesignGraph } from '@protopulse/graph';
import type { PartDb } from '@protopulse/parts';
import type { SpiceEngine } from '@protopulse/sim';

/**
 * One co-sim window, first slice (Vol II §D.3): one-directional
 * MCU→SPICE. The firmware runs for the whole window FIRST; its pin
 * edges then drive the analog netlist as PWL sources through series
 * Rout resistors. Nothing flows back into the MCU yet — that is the
 * later, lock-stepped slice.
 */

/** Cycles per emulation chunk — keeps each step() call bounded. */
const STEP_CHUNK_CYCLES = 100_000;

export interface RunCosimWindowArgs {
  graph: DesignGraph;
  parts: PartDb;
  /** The MCU core, firmware already loaded. Stepped (not reset) by this call. */
  core: McuCore;
  spec: CosimWindowSpec;
  /** Reuse a booted engine (recommended — WASM boot takes seconds). */
  engine?: SpiceEngine;
}

/**
 * The pin's level at t=0: edges are level *changes*, so the level
 * before the first edge is its opposite. A pin with no edges in the
 * window is taken as idle-low (reset-default GPIO state).
 */
function inferInitialLevel(edges: readonly PinEvent[]): DigitalLevel {
  const first = edges[0];
  if (first === undefined) return 0;
  return first.level === 1 ? 0 : 1;
}

function cardName(pin: string): string {
  return pin.toLowerCase();
}

export async function runCosimWindow(args: RunCosimWindowArgs): Promise<CosimResult> {
  const { graph, parts, core, engine } = args;
  const spec = cosimWindowSpecSchema.parse(args.spec);

  // Validate bindings against the graph before burning any cycles.
  for (const binding of spec.bindings) {
    if (!graph.nets.has(binding.netId)) {
      throw new Error(`cosim binding ${binding.pin}: netId "${binding.netId}" is not in the graph`);
    }
  }

  // 1. Run the firmware across the whole window, collecting pin edges.
  const totalCycles = Math.ceil(core.clockHz * spec.windowS);
  const pinEvents: PinEvent[] = [];
  let mcuCycles = 0;
  while (mcuCycles < totalCycles) {
    const budget = Math.min(STEP_CHUNK_CYCLES, totalCycles - mcuCycles);
    const result = core.step(budget);
    mcuCycles += result.cycles;
    pinEvents.push(...result.events);
  }

  // 2. Per binding: edges → PWL waveform → V+R card pair on the net's node.
  const { nodeOf } = generateSpiceNetlist(graph, parts);
  const pwlSources: Record<string, string> = {};
  const extraCards: string[] = [];
  for (const binding of spec.bindings) {
    const node = nodeOf.get(binding.netId);
    if (node === undefined) {
      throw new Error(`cosim binding ${binding.pin}: net "${binding.netId}" has no SPICE node`);
    }
    const card = bindingCard(binding, pinEvents, core.clockHz, spec.windowS, node);
    pwlSources[binding.pin] = card;
    extraCards.push(card);
  }

  // 3. Transient analysis over the same window, PWL sources injected.
  const sim = await simulate(
    graph,
    parts,
    { kind: 'tran', stepS: spec.stepS, stopS: spec.windowS },
    { engine, extraCards },
  );

  return {
    sim,
    pinEvents,
    mcuCycles,
    virtualTimeS: mcuCycles / core.clockHz,
    pwlSources,
  };
}

function bindingCard(
  binding: PinBinding,
  events: readonly PinEvent[],
  clockHz: number,
  windowS: number,
  node: string,
): string {
  const pinEdges = events.filter((e) => e.pin === binding.pin);
  const points = pinEventsToPwl(pinEdges, binding.pin, {
    clockHz,
    windowS,
    voltsHigh: binding.voltsHigh ?? DEFAULT_VOLTS_HIGH,
    voltsLow: binding.voltsLow ?? DEFAULT_VOLTS_LOW,
    riseS: binding.riseS ?? DEFAULT_RISE_S,
    initialLevel: inferInitialLevel(pinEdges),
  });
  return pwlCard(cardName(binding.pin), node, binding.routOhms ?? DEFAULT_ROUT_OHMS, points);
}
