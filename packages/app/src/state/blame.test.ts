import { describe, expect, it } from 'vitest';

import { actorLabel, blameFor } from './blame.js';

import type { OpEnvelope } from '@protopulse/graph';

function env(op: OpEnvelope['op'], lamport: number, extra?: Partial<OpEnvelope>): OpEnvelope {
  return { actor: 'tyler', lamport, ts: 0, op, ...extra };
}

const LOG: OpEnvelope[] = [
  env({ kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1, value: '330' }, 1),
  env({ kind: 'add_component', id: 'd1', ref: 'D1', partId: 'core:led', partRev: 1 }, 2),
  env({ kind: 'connect', port: 'r1:2', newNetId: 'n-led' }, 3),
  env({ kind: 'connect', port: 'd1:A', netId: 'n-led' }, 4),
  env({ kind: 'rename_net', netId: 'n-led', name: 'LED_A' }, 5),
  env(
    {
      kind: 'batch',
      label: 'fix: add pull-up',
      ops: [
        { kind: 'set_component_props', id: 'r1', props: { value: '10k' } },
        { kind: 'move_symbol', componentId: 'r1', at: { x: 0, y: 0 }, rot: 0, mirror: false },
        { kind: 'place_symbol', componentId: 'd1', at: { x: 1270000, y: 0 }, rot: 0, mirror: false },
      ],
    },
    6,
    { ts: 1765432100000, meta: { agent: 'draftsman', rationale: 'value too low for a pull-up' } },
  ),
];

describe('blameFor', () => {
  it('collects every op touching a component, including its ports', () => {
    const entries = blameFor(LOG, 'r1');
    expect(entries.map((e) => e.index)).toEqual([1, 3, 6]);
    expect(entries[0]?.summary).toBe('add R1 (core:resistor, 330)');
    expect(entries[1]?.summary).toBe('connect r1:2 → new net n-led');
  });

  it('collects net history across connect/rename', () => {
    const entries = blameFor(LOG, 'n-led');
    expect(entries.map((e) => e.index)).toEqual([3, 4, 5]);
    expect(entries[2]?.summary).toBe('rename net n-led → "LED_A"');
  });

  it('batches surface the matching inner op, a +N, the label, and the agent meta', () => {
    const entries = blameFor(LOG, 'r1');
    const batchEntry = entries[2];
    expect(batchEntry?.summary).toBe('edit r1: value +1 more — "fix: add pull-up"');
    expect(batchEntry?.agent).toBe('draftsman');
    expect(batchEntry?.rationale).toBe('value too low for a pull-up');
    expect(batchEntry?.ts).toBe(1765432100000);
  });

  it('returns empty for an entity nothing touched', () => {
    expect(blameFor(LOG, 'ghost')).toEqual([]);
  });
});

describe('actorLabel', () => {
  it('shortens UUIDs, leaves names alone', () => {
    expect(actorLabel('0190b7e2-1b2c-7def-8a90-1234567890ab')).toBe('0190b7e2');
    expect(actorLabel('screenshot-rig')).toBe('screenshot-rig');
    expect(actorLabel('tyler')).toBe('tyler');
  });
});
