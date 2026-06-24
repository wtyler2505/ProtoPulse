import { materialize } from '@protopulse/graph';
import { describe, expect, it } from 'vitest';

import { spiDevicesFromGraph } from './spi-graph.js';

import type { DesignGraph, OpBody } from '@protopulse/graph';

/**
 * `spiDevicesFromGraph` resolves every modeled SPI part placed in a design to a
 * co-sim device binding (via the @protopulse/emu SPI registry) — the SPI
 * parallel to `i2cDevicesFromGraph`.
 */

function graphWith(placed: Array<{ id: string; partId: string }>): DesignGraph {
  const ops: OpBody[] = placed.map((p, i) => ({
    kind: 'add_component',
    id: p.id,
    ref: `U${String(i + 1)}`,
    partId: p.partId,
    partRev: 1,
  }));
  return materialize(ops.map((op, i) => ({ actor: 't', lamport: i + 1, ts: 0, op }))).graph;
}

describe('spiDevicesFromGraph — auto-resolve placed SPI parts to device bindings', () => {
  it('returns a port-2 binding for each modeled SPI part, answering its identity register', () => {
    const graph = graphWith([
      { id: 'u1', partId: 'core:rc522' },
      { id: 'r1', partId: 'core:resistor' }, // not an SPI device — skipped
    ]);
    const devices = spiDevicesFromGraph(graph);
    expect(devices.length).toBe(1);
    expect(devices[0]?.port).toBe(2);
    // RC522 VersionReg read address 0xEE → 0x92 on the MISO byte.
    expect(devices[0]?.slave([0xee], 0)).toBe(0x92);
  });

  it('returns [] when the design has no modeled SPI parts', () => {
    expect(spiDevicesFromGraph(graphWith([{ id: 'r1', partId: 'core:resistor' }]))).toEqual([]);
  });
});
