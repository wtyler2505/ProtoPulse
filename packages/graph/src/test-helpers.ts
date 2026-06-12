import { materialize } from './materialize.js';

import type { OpBody, OpEnvelope } from './ops.js';
import type { DesignGraph } from './types.js';

/**
 * Order-insensitive canonical JSON: sorts Map entries and object keys so
 * semantically equal graphs compare equal regardless of insertion order.
 */
export function stableStringify(value: unknown): string {
  if (value instanceof Map) {
    return stableStringify([...value.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys
      .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Canonical form of the *visible* design (ignores auto-name counters). */
export function canonicalGraph(g: DesignGraph): string {
  return stableStringify({
    components: g.components,
    nets: g.nets,
    buses: g.buses,
    constraints: g.constraints,
    schematic: g.schematic,
    pcb: g.pcb,
    annotations: g.annotations,
    meta: g.meta,
  });
}

/** Wrap bare op bodies in envelopes with sequential lamports. */
export function envelopes(ops: OpBody[], actor = 'test-actor'): OpEnvelope[] {
  return ops.map((op, i) => ({ actor, lamport: i + 1, ts: 0, op }));
}

/** Build a graph from bare ops; throws if anything fails or violates. */
export function buildGraph(ops: OpBody[]): DesignGraph {
  const result = materialize(envelopes(ops));
  const failed = result.warnings.filter((w) => w.kind === 'apply_failed');
  if (failed.length > 0) {
    throw new Error(`buildGraph: ops failed: ${failed.map((w) => w.message).join('; ')}`);
  }
  if (result.violations.length > 0) {
    throw new Error(`buildGraph: invariants violated: ${result.violations[0]?.message ?? ''}`);
  }
  return result.graph;
}

/** A small canonical fixture: battery + resistor + LED in series. */
export const FIX = {
  bat: 'c-bat',
  r1: 'c-r1',
  led: 'c-led',
  netA: 'n-a',
  netB: 'n-b',
  netGnd: 'n-gnd',
  partBattery: 'p-battery',
  partResistor: 'p-resistor',
  partLed: 'p-led',
};

/** PCB view ops over the LED fixture: two footprints, a trace, a via. */
export function pcbViewOps(): OpBody[] {
  return [
    { kind: 'place_footprint', componentId: FIX.r1, at: { x: 0, y: 0 }, rotMilli: 0, side: 'top', locked: false },
    { kind: 'place_footprint', componentId: FIX.led, at: { x: 5_000_000, y: 0 }, rotMilli: 90_000, side: 'top', locked: false },
    {
      kind: 'route_trace',
      id: 't1',
      netId: FIX.netB,
      layerId: 'F.Cu',
      widthNm: 250_000,
      path: [{ x: 0, y: 0 }, { x: 5_000_000, y: 0 }],
    },
    {
      kind: 'place_via',
      id: 'v1',
      netId: FIX.netB,
      at: { x: 2_500_000, y: 0 },
      drillNm: 300_000,
      padNm: 600_000,
      span: ['F.Cu', 'B.Cu'],
    },
  ];
}

export function ledCircuitOps(): OpBody[] {
  return [
    { kind: 'add_component', id: FIX.bat, ref: 'BT1', partId: FIX.partBattery, partRev: 1 },
    { kind: 'add_component', id: FIX.r1, ref: 'R1', partId: FIX.partResistor, partRev: 1, value: '330' },
    { kind: 'add_component', id: FIX.led, ref: 'D1', partId: FIX.partLed, partRev: 1 },
    { kind: 'connect', port: `${FIX.bat}:+`, newNetId: FIX.netA },
    { kind: 'connect', port: `${FIX.r1}:1`, netId: FIX.netA },
    { kind: 'connect', port: `${FIX.r1}:2`, newNetId: FIX.netB },
    { kind: 'connect', port: `${FIX.led}:A`, netId: FIX.netB },
    { kind: 'connect', port: `${FIX.led}:K`, newNetId: FIX.netGnd },
    { kind: 'connect', port: `${FIX.bat}:-`, netId: FIX.netGnd },
    { kind: 'rename_net', netId: FIX.netGnd, name: 'GND' },
    { kind: 'place_symbol', componentId: FIX.bat, at: { x: 0, y: 0 }, rot: 0, mirror: false },
    { kind: 'place_symbol', componentId: FIX.r1, at: { x: 12_700_000, y: 0 }, rot: 90, mirror: false },
    { kind: 'place_symbol', componentId: FIX.led, at: { x: 25_400_000, y: 0 }, rot: 0, mirror: false },
  ];
}
