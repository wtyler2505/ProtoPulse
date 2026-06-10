import { describe, expect, it } from 'vitest';

import { describeOp, REPLAY_SPEEDS } from './replay.js';

import type { OpBody } from '@protopulse/graph';

describe('describeOp', () => {
  it('describes the common schematic story ops', () => {
    expect(
      describeOp({ kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1, value: '330' }),
    ).toBe('add R1 (core:resistor, 330)');
    expect(describeOp({ kind: 'connect', port: 'r1:1', newNetId: 'net-a' })).toBe(
      'connect r1:1 → new net net-a',
    );
    expect(describeOp({ kind: 'connect', port: 'r1:2', netId: 'net-b' })).toBe(
      'connect r1:2 → net-b',
    );
    expect(describeOp({ kind: 'rename_net', netId: 'net-a', name: 'VCC' })).toBe(
      'rename net net-a → "VCC"',
    );
    expect(
      describeOp({ kind: 'place_symbol', componentId: 'r1', at: { x: 0, y: 0 }, rot: 0, mirror: false }),
    ).toBe('place symbol r1');
    expect(
      describeOp({
        kind: 'set_wire_geometry',
        netId: 'net-a',
        segments: [{ a: { x: 0, y: 0 }, b: { x: 1270000, y: 0 } }],
      }),
    ).toBe('draw wires for net-a (1 segment)');
  });

  it('labels batches with their op count', () => {
    const batch: OpBody = {
      kind: 'batch',
      label: 'add R1',
      ops: [
        { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1 },
        { kind: 'place_symbol', componentId: 'r1', at: { x: 0, y: 0 }, rot: 0, mirror: false },
      ],
    };
    expect(describeOp(batch)).toBe('add R1 (2 ops)');
  });

  it('falls back to the kind for ops without a special case', () => {
    expect(describeOp({ kind: 'checkpoint', label: 'v1' })).toBe('checkpoint');
  });

  it('speeds are sorted and positive', () => {
    const rates = REPLAY_SPEEDS.map((s) => s.opsPerSec);
    expect([...rates].sort((a, b) => a - b)).toEqual(rates);
    expect(rates.every((r) => r > 0)).toBe(true);
  });
});
