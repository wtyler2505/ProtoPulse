import { SCHEMATIC_GRID } from '@protopulse/graph';
import { describe, expect, it } from 'vitest';

import { PickIndex } from './pick.js';
import { SceneGraph  } from './scene.js';

import type {SceneNode} from './scene.js';

const G = SCHEMATIC_GRID;

function node(
  id: string,
  kind: SceneNode['kind'],
  lines: number[],
): SceneNode {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < lines.length; i += 2) {
    minX = Math.min(minX, lines[i]!);
    maxX = Math.max(maxX, lines[i]!);
    minY = Math.min(minY, lines[i + 1]!);
    maxY = Math.max(maxY, lines[i + 1]!);
  }
  return {
    id,
    kind,
    lines: Float32Array.from(lines),
    texts: [],
    bounds: { minX, minY, maxX, maxY },
    color: [1, 1, 1, 1],
  };
}

function makeScene(...nodes: SceneNode[]): SceneGraph {
  const scene = new SceneGraph();
  for (const n of nodes) scene.add(n);
  return scene;
}

describe('PickIndex', () => {
  it('empty scene picks nothing (flatbush 0-item guard)', () => {
    const idx = new PickIndex();
    idx.rebuild(new SceneGraph());
    expect(idx.pick({ x: 0, y: 0 }, G)).toEqual([]);
    expect(idx.queryRect({ x: -G, y: -G }, { x: G, y: G })).toEqual([]);
  });

  it('picks a symbol whose bounds contain the point', () => {
    const idx = new PickIndex();
    idx.rebuild(makeScene(node('r1', 'symbol', [-2 * G, -G, 2 * G, G])));
    const hits = idx.pick({ x: 0, y: 0 }, 0);
    expect(hits.map((h) => h.id)).toEqual(['r1']);
    expect(hits[0]!.kind).toBe('symbol');
  });

  it('respects tolerance: a point just outside hits only with tolerance', () => {
    const idx = new PickIndex();
    idx.rebuild(makeScene(node('r1', 'symbol', [0, 0, 2 * G, G])));
    const justOutside = { x: 2 * G + Math.round(G / 4), y: 0 };
    expect(idx.pick(justOutside, 0)).toEqual([]);
    expect(idx.pick(justOutside, Math.round(G / 2)).map((h) => h.id)).toEqual(['r1']);
  });

  it('sorts symbol-before-wire at the same spot', () => {
    const idx = new PickIndex();
    idx.rebuild(
      makeScene(
        node('w1', 'wire', [-4 * G, 0, 4 * G, 0]),
        node('r1', 'symbol', [-G, -G, G, G]),
      ),
    );
    const hits = idx.pick({ x: 0, y: 0 }, Math.round(G / 4));
    expect(hits.map((h) => h.kind)).toEqual(['symbol', 'wire']);
  });

  it('sorts smaller-area-first within a kind', () => {
    const idx = new PickIndex();
    idx.rebuild(
      makeScene(
        node('big', 'symbol', [-4 * G, -4 * G, 4 * G, 4 * G]),
        node('small', 'symbol', [-G, -G, G, G]),
      ),
    );
    const hits = idx.pick({ x: 0, y: 0 }, 0);
    expect(hits.map((h) => h.id)).toEqual(['small', 'big']);
  });

  it('wire pick requires proximity to an actual segment, not just the AABB', () => {
    // L-shaped wire: horizontal then vertical. The far corner of its
    // AABB is empty space and must not pick.
    const idx = new PickIndex();
    idx.rebuild(
      makeScene(node('w1', 'wire', [0, 0, 4 * G, 0, 4 * G, 0, 4 * G, 4 * G])),
    );
    expect(idx.pick({ x: 2 * G, y: 0 }, Math.round(G / 4)).map((h) => h.id)).toEqual(['w1']);
    expect(idx.pick({ x: 4 * G, y: 2 * G }, Math.round(G / 4)).map((h) => h.id)).toEqual(['w1']);
    // empty corner of the AABB (opposite the bend):
    expect(idx.pick({ x: Math.round(G / 2), y: 3 * G }, Math.round(G / 4))).toEqual([]);
  });

  it('queryRect returns ids intersecting the rect (normalized corners)', () => {
    const idx = new PickIndex();
    idx.rebuild(
      makeScene(
        node('a', 'symbol', [0, 0, G, G]),
        node('b', 'symbol', [10 * G, 10 * G, 11 * G, 11 * G]),
        node('w', 'wire', [0, 5 * G, 20 * G, 5 * G]),
      ),
    );
    // Corners given max-first must still work.
    expect(idx.queryRect({ x: 2 * G, y: 2 * G }, { x: -G, y: -G })).toEqual(['a']);
    expect(idx.queryRect({ x: -G, y: -G }, { x: 12 * G, y: 12 * G })).toEqual(['a', 'b', 'w']);
  });

  it('rebuild reflects scene mutations', () => {
    const scene = makeScene(node('a', 'symbol', [0, 0, G, G]));
    const idx = new PickIndex();
    idx.rebuild(scene);
    expect(idx.pick({ x: 0, y: 0 }, G).length).toBe(1);
    scene.remove('a');
    idx.rebuild(scene);
    expect(idx.pick({ x: 0, y: 0 }, G)).toEqual([]);
  });
});
