import { describe, expect, it } from 'vitest';
import {
  applyOp,
  emptyGraph,
  SCHEMATIC_GRID,
  type DesignGraph,
  type OpBody,
} from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { buildScene, buildWireNode, SceneGraph, SYMBOL_COLOR, WIRE_COLOR } from './scene.js';

const G = SCHEMATIC_GRID;
const parts = seedPartDb();

function buildGraph(ops: OpBody[]): DesignGraph {
  const g = emptyGraph();
  for (const op of ops) {
    const res = applyOp(g, op);
    if (!res.ok) throw new Error(res.error);
  }
  return g;
}

function demoGraph(): DesignGraph {
  return buildGraph([
    { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1 },
    { kind: 'add_component', id: 'r2', ref: 'R2', partId: 'core:resistor', partRev: 1 },
    { kind: 'place_symbol', componentId: 'r1', at: { x: 0, y: 0 }, rot: 0, mirror: false },
    { kind: 'place_symbol', componentId: 'r2', at: { x: 10 * G, y: 0 }, rot: 90, mirror: false },
    { kind: 'connect', port: 'r1:2', newNetId: 'net1' },
    { kind: 'connect', port: 'r2:1', netId: 'net1' },
    {
      kind: 'set_wire_geometry',
      netId: 'net1',
      segments: [{ a: { x: 2 * G, y: 0 }, b: { x: 10 * G, y: -2 * G } }],
    },
  ]);
}

describe('SceneGraph store', () => {
  it('add/update/remove bump the version', () => {
    const scene = new SceneGraph();
    expect(scene.version).toBe(0);
    scene.add(buildWireNode('w1', [{ a: { x: 0, y: 0 }, b: { x: G, y: 0 } }]));
    expect(scene.version).toBe(1);
    scene.update(buildWireNode('w1', [{ a: { x: 0, y: 0 }, b: { x: 2 * G, y: 0 } }]));
    expect(scene.version).toBe(2);
    expect(scene.remove('w1')).toBe(true);
    expect(scene.version).toBe(3);
    expect(scene.remove('w1')).toBe(false);
    expect(scene.version).toBe(3); // no-op remove does not dirty
  });
});

describe('buildScene', () => {
  it('creates one node per placed symbol and one per wired net', () => {
    const scene = buildScene(demoGraph(), parts);
    expect(scene.nodes.size).toBe(3);
    expect(scene.get('r1')?.kind).toBe('symbol');
    expect(scene.get('r2')?.kind).toBe('symbol');
    expect(scene.get('net1')?.kind).toBe('wire');
  });

  it('skips unplaced components', () => {
    const graph = buildGraph([
      { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1 },
    ]);
    const scene = buildScene(graph, parts);
    expect(scene.nodes.size).toBe(0);
  });

  it('skips components with unknown parts', () => {
    const graph = buildGraph([
      { kind: 'add_component', id: 'x1', ref: 'X1', partId: 'core:nonexistent', partRev: 1 },
      { kind: 'place_symbol', componentId: 'x1', at: { x: 0, y: 0 }, rot: 0, mirror: false },
    ]);
    const scene = buildScene(graph, parts);
    expect(scene.nodes.size).toBe(0);
  });

  it('symbol nodes carry colors, bounds, and a ref label', () => {
    const scene = buildScene(demoGraph(), parts);
    const node = scene.get('r1')!;
    expect(node.color).toEqual(SYMBOL_COLOR);
    expect(node.bounds.minX).toBeLessThan(node.bounds.maxX);
    expect(node.texts.some((t) => t.text.includes('R1'))).toBe(true);
  });

  it('wire nodes carry the segment geometry', () => {
    const scene = buildScene(demoGraph(), parts);
    const node = scene.get('net1')!;
    expect(node.color).toEqual(WIRE_COLOR);
    expect([...node.lines]).toEqual([2 * G, 0, 10 * G, -2 * G]);
  });

  it('scene bounds union all nodes', () => {
    const scene = buildScene(demoGraph(), parts);
    const b = scene.bounds()!;
    expect(b.minX).toBeLessThanOrEqual(-2 * G); // r1's left pin
    expect(b.maxX).toBeGreaterThanOrEqual(10 * G); // r2 (rotated) at x=10G
    expect(b.maxY).toBeGreaterThanOrEqual(2 * G); // r2's top pin after rot 90
  });
});
