import {
  applyOp,
  cloneGraph,
  diff,
  emptyGraph,
  SCHEMATIC_GRID
  
  
} from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { describe, expect, it } from 'vitest';

import { buildScene } from './scene.js';
import { applyDelta } from './sync.js';

import type {DesignGraph, OpBody} from '@protopulse/graph';

const G = SCHEMATIC_GRID;
const parts = seedPartDb();

function apply(graph: DesignGraph, ops: OpBody[]): DesignGraph {
  const next = cloneGraph(graph);
  for (const op of ops) {
    const res = applyOp(next, op);
    if (!res.ok) throw new Error(res.error);
  }
  return next;
}

function baseGraph(): DesignGraph {
  return apply(emptyGraph(), [
    { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1 },
    { kind: 'add_component', id: 'r2', ref: 'R2', partId: 'core:resistor', partRev: 1 },
    { kind: 'place_symbol', componentId: 'r1', at: { x: 0, y: 0 }, rot: 0, mirror: false },
    { kind: 'place_symbol', componentId: 'r2', at: { x: 10 * G, y: 0 }, rot: 0, mirror: false },
    { kind: 'connect', port: 'r1:2', newNetId: 'net1' },
    { kind: 'connect', port: 'r2:1', netId: 'net1' },
    {
      kind: 'set_wire_geometry',
      netId: 'net1',
      segments: [{ a: { x: 2 * G, y: 0 }, b: { x: 8 * G, y: 0 } }],
    },
  ]);
}

describe('applyDelta — incremental sync', () => {
  it('a move re-tessellates ONLY the moved node; others keep identity', () => {
    const a = baseGraph();
    const scene = buildScene(a, parts);
    const r1Before = scene.get('r1')!;
    const r2Before = scene.get('r2')!;
    const wireBefore = scene.get('net1')!;

    const b = apply(a, [
      { kind: 'move_symbol', componentId: 'r2', at: { x: 14 * G, y: 2 * G }, rot: 90, mirror: false },
    ]);
    applyDelta(scene, diff(a, b), b, parts);

    expect(scene.get('r1')).toBe(r1Before); // untouched — same object
    expect(scene.get('net1')).toBe(wireBefore); // untouched — same object
    expect(scene.get('r2')).not.toBe(r2Before); // rebuilt
    expect(scene.get('r2')!.bounds.minY).toBeLessThanOrEqual(0);
  });

  it('component removal drops its node and the GC\'d wire', () => {
    const a = baseGraph();
    const scene = buildScene(a, parts);
    // Removing r1 leaves net1 with one port; wire geometry survives,
    // so only the symbol node disappears.
    const b = apply(a, [{ kind: 'remove_component', id: 'r1' }]);
    applyDelta(scene, diff(a, b), b, parts);
    expect(scene.get('r1')).toBeUndefined();
    expect(scene.get('r2')).toBeDefined();
  });

  it('removing the whole net removes the wire node', () => {
    const a = baseGraph();
    const scene = buildScene(a, parts);
    const b = apply(a, [
      { kind: 'remove_component', id: 'r1' },
      { kind: 'remove_component', id: 'r2' },
    ]);
    applyDelta(scene, diff(a, b), b, parts);
    expect(scene.nodes.size).toBe(0);
  });

  it('wire geometry change rebuilds the wire node only', () => {
    const a = baseGraph();
    const scene = buildScene(a, parts);
    const r1Before = scene.get('r1')!;
    const b = apply(a, [
      {
        kind: 'set_wire_geometry',
        netId: 'net1',
        segments: [
          { a: { x: 2 * G, y: 0 }, b: { x: 5 * G, y: 0 } },
          { a: { x: 5 * G, y: 0 }, b: { x: 5 * G, y: 4 * G } },
        ],
      },
    ]);
    applyDelta(scene, diff(a, b), b, parts);
    expect(scene.get('r1')).toBe(r1Before);
    expect(scene.get('net1')!.lines.length).toBe(8);
  });

  it('clearing wire geometry removes the wire node', () => {
    const a = baseGraph();
    const scene = buildScene(a, parts);
    const b = apply(a, [{ kind: 'set_wire_geometry', netId: 'net1', segments: [] }]);
    applyDelta(scene, diff(a, b), b, parts);
    expect(scene.get('net1')).toBeUndefined();
  });

  it('newly placed component gains a node', () => {
    const a = baseGraph();
    const scene = buildScene(a, parts);
    const b = apply(a, [
      { kind: 'add_component', id: 'c1', ref: 'C1', partId: 'core:capacitor', partRev: 1 },
      { kind: 'place_symbol', componentId: 'c1', at: { x: 0, y: 6 * G }, rot: 0, mirror: false },
    ]);
    applyDelta(scene, diff(a, b), b, parts);
    expect(scene.get('c1')?.kind).toBe('symbol');
    expect(scene.nodes.size).toBe(4);
  });

  it('prop change (value) refreshes the node label', () => {
    const a = baseGraph();
    const scene = buildScene(a, parts);
    const b = apply(a, [
      { kind: 'set_component_props', id: 'r1', props: { value: '10k' } },
    ]);
    applyDelta(scene, diff(a, b), b, parts);
    expect(scene.get('r1')!.texts.some((t) => t.text.includes('10k'))).toBe(true);
  });
});
