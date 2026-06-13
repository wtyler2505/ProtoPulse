import { MM } from '@protopulse/graph';
import { describe, expect, it } from 'vitest';

import { makeObstacle, makeObstacleSet } from './obstacles.js';
import { DEFAULT_DEPTH_CAP, firstHit, pathIsClear, routeHead } from './walkaround.js';

import type { Obstacle, ObstacleSet } from './obstacles.js';
import type { Uuid, Vec } from '@protopulse/graph';

/**
 * Walkaround unit tests on hand-built obstacle sets — all geometry in
 * integer nm, hulls pre-inflated by INFLATE like a real deck would
 * (127000 clearance + 100000 half-width).
 */

const INFLATE = 227_000;

function rect(cx: number, cy: number, w: number, h: number, netId: Uuid | null = null, label = 'rect'): Obstacle {
  return makeObstacle(label, netId, { kind: 'rect', rect: { at: { x: cx, y: cy }, wNm: w, hNm: h } }, INFLATE);
}

function capsule(a: Vec, b: Vec, r: number, netId: Uuid | null = null, label = 'cap'): Obstacle {
  return makeObstacle(label, netId, { kind: 'capsule', a, b, r }, INFLATE);
}

function setOf(...obstacles: Obstacle[]): ObstacleSet {
  return makeObstacleSet(obstacles, 'F.Cu', INFLATE);
}

const FROM: Vec = { x: -5 * MM, y: 0 };
const TO: Vec = { x: 5 * MM, y: 0 };

function allInteger(path: Vec[]): boolean {
  return path.every((p) => Number.isInteger(p.x) && Number.isInteger(p.y));
}

describe('routeHead — clear shots', () => {
  it('an empty board routes straight', () => {
    expect(routeHead(FROM, TO, setOf())).toEqual({ path: [FROM, TO], blocked: false });
  });

  it('copper far off the line does not deflect the head', () => {
    const set = setOf(rect(0, 5 * MM, MM, MM));
    expect(routeHead(FROM, TO, set)).toEqual({ path: [FROM, TO], blocked: false });
  });

  it('from === to collapses to a point', () => {
    expect(routeHead(FROM, FROM, setOf(rect(0, 0, MM, MM)))).toEqual({
      path: [FROM],
      blocked: false,
    });
  });

  it('running EXACTLY inflateNm from copper is legal (gap == clearance passes)', () => {
    // Copper top edge at y = 500000; centerline allowed at 500000 + INFLATE.
    const set = setOf(rect(0, 0, MM, MM));
    const y = 500_000 + INFLATE;
    const res = routeHead({ x: -5 * MM, y }, { x: 5 * MM, y }, set);
    expect(res.blocked).toBe(false);
    expect(res.path).toHaveLength(2);
  });
});

describe('routeHead — single obstacle', () => {
  it('walks around a rect obstacle dead on the line, staying legal', () => {
    const set = setOf(rect(0, 0, MM, MM));
    const res = routeHead(FROM, TO, set);
    expect(res.blocked).toBe(false);
    expect(res.path.length).toBeGreaterThan(2); // detoured via hull corners
    expect(res.path[0]).toEqual(FROM);
    expect(res.path[res.path.length - 1]).toEqual(TO);
    expect(pathIsClear(res.path, set)).toBe(true);
    expect(allInteger(res.path)).toBe(true);
  });

  it('an obstacle shifted up sends the path under (the shorter walk)', () => {
    // Copper y ∈ [0, 400000] → hull y ∈ [-INFLATE, 400000+INFLATE].
    const set = setOf(rect(0, 200_000, MM, 400_000));
    const res = routeHead(FROM, TO, set);
    expect(res.blocked).toBe(false);
    const detour = res.path.slice(1, -1);
    expect(detour.length).toBeGreaterThan(0);
    expect(detour.every((p) => p.y < 0)).toBe(true); // under, not over
    expect(pathIsClear(res.path, set)).toBe(true);
  });

  it('the mirrored obstacle sends the path over instead', () => {
    const set = setOf(rect(0, -200_000, MM, 400_000));
    const detour = routeHead(FROM, TO, set).path.slice(1, -1);
    expect(detour.length).toBeGreaterThan(0);
    expect(detour.every((p) => p.y > 0)).toBe(true);
  });

  it('a dead-symmetric obstacle resolves deterministically (CCW tie-break)', () => {
    const set = setOf(rect(0, 0, MM, MM));
    const first = routeHead(FROM, TO, set);
    const second = routeHead(FROM, TO, set);
    expect(first).toEqual(second);
    // CCW around the hull from a left-side entry walks the bottom.
    expect(first.path.slice(1, -1).every((p) => p.y < 0)).toBe(true);
  });

  it('walks around a trace-segment capsule', () => {
    // Vertical foreign trace crossing the route line.
    const set = setOf(capsule({ x: 0, y: -3 * MM }, { x: 0, y: 3 * MM }, 125_000));
    const res = routeHead(FROM, TO, set);
    expect(res.blocked).toBe(false);
    expect(pathIsClear(res.path, set)).toBe(true);
  });

  it('walks around a via (zero-length capsule)', () => {
    const set = setOf(capsule({ x: 0, y: 0 }, { x: 0, y: 0 }, 300_000));
    const res = routeHead(FROM, TO, set);
    expect(res.blocked).toBe(false);
    expect(res.path.length).toBeGreaterThan(2);
    expect(pathIsClear(res.path, set)).toBe(true);
  });
});

describe('routeHead — same-net copper', () => {
  it('passes straight through obstacles on the routing net', () => {
    const set = setOf(rect(0, 0, MM, MM, 'n1'));
    expect(routeHead(FROM, TO, set, { excludeNetId: 'n1' })).toEqual({
      path: [FROM, TO],
      blocked: false,
    });
  });

  it('a floating (null-net) pad still blocks even with an exclude net', () => {
    const set = setOf(rect(0, 0, MM, MM, null));
    const res = routeHead(FROM, TO, set, { excludeNetId: 'n1' });
    expect(res.path.length).toBeGreaterThan(2);
  });

  it('foreign nets still block when an exclude net is set', () => {
    const set = setOf(rect(0, 0, MM, MM, 'n2'));
    const res = routeHead(FROM, TO, set, { excludeNetId: 'n1' });
    expect(res.path.length).toBeGreaterThan(2);
    expect(pathIsClear(res.path, set, { excludeNetId: 'n1' })).toBe(true);
  });
});

describe('routeHead — nested obstacles', () => {
  it('detours around a second obstacle the first detour runs into', () => {
    // First block on the line; second block sits under the first, right
    // where the short (bottom) walk would go.
    const set = setOf(rect(0, 0, MM, MM, null, 'a'), rect(0, -1_500_000, MM, MM, null, 'b'));
    const res = routeHead(FROM, TO, set);
    expect(res.blocked).toBe(false);
    expect(pathIsClear(res.path, set)).toBe(true);
    expect(res.path.length).toBeGreaterThan(3);
  });

  it('threads a staggered field of obstacles', () => {
    const set = setOf(
      rect(-2 * MM, 0, 800_000, 2 * MM, null, 'a'),
      rect(0, 1_200_000, 800_000, 2 * MM, null, 'b'),
      rect(2 * MM, 0, 800_000, 2 * MM, null, 'c'),
    );
    const res = routeHead(FROM, TO, set);
    expect(res.blocked).toBe(false);
    expect(pathIsClear(res.path, set)).toBe(true);
    expect(allInteger(res.path)).toBe(true);
  });
});

describe('routeHead — blocked', () => {
  it('a target walled in on all sides is blocked with a best-effort partial', () => {
    // A box of copper around TO with gaps too small to pass.
    const set = setOf(
      rect(TO.x, 1 * MM, 4 * MM, 400_000, null, 'top'),
      rect(TO.x, -1 * MM, 4 * MM, 400_000, null, 'bottom'),
      rect(TO.x - 2 * MM, 0, 400_000, 2.4 * MM, null, 'left'),
      rect(TO.x + 2 * MM, 0, 400_000, 2.4 * MM, null, 'right'),
    );
    const res = routeHead(FROM, TO, set);
    expect(res.blocked).toBe(true);
    expect(res.path[0]).toEqual(FROM);
    expect(res.path[res.path.length - 1]).toEqual(TO); // best-effort still lands
    expect(res.path.length).toBeGreaterThanOrEqual(2);
  });

  it('a corridor narrower than the clearance demands is blocked', () => {
    // Two long walls; the copper gap is 300000nm but the centerline
    // needs INFLATE=227000 from EACH wall (454000 total). Both endpoints
    // sit INSIDE the corridor, so there is no legal way out either.
    const set = setOf(
      rect(0, 350_000, 8 * MM, 400_000, null, 'north'),
      rect(0, -350_000, 8 * MM, 400_000, null, 'south'),
    );
    const res = routeHead({ x: -3 * MM, y: 0 }, { x: 3 * MM, y: 0 }, set);
    expect(res.blocked).toBe(true);
  });

  it('maxDepth 0 refuses immediately with the straight best-effort', () => {
    const set = setOf(rect(0, 0, MM, MM));
    expect(routeHead(FROM, TO, set, { maxDepth: 0 })).toEqual({
      path: [FROM, TO],
      blocked: true,
    });
  });

  it('the depth cap defaults to 16 and terminates on absurd fields', () => {
    expect(DEFAULT_DEPTH_CAP).toBe(16);
    // Eight staggered overlapping blocks — way past any sane walk; must terminate
    // without leaning on Vitest's default 5s timeout.
    const blocks: Obstacle[] = [];
    for (let i = 0; i < 8; i++) {
      blocks.push(rect((i - 4) * 300_000, (i % 2 === 0 ? 1 : -1) * 200_000, MM, MM, null, `w${String(i)}`));
    }
    const res = routeHead(FROM, TO, setOf(...blocks));
    expect(typeof res.blocked).toBe('boolean');
    expect(res.path.length).toBeGreaterThanOrEqual(2);
    expect(allInteger(res.path)).toBe(true);
  });
});

describe('firstHit', () => {
  it('returns null on a clear segment and the violator otherwise', () => {
    const a = rect(0, 0, MM, MM, null, 'a');
    const set = setOf(a);
    expect(firstHit(FROM, { x: -4 * MM, y: 0 }, set, null)).toBeNull();
    expect(firstHit(FROM, TO, set, null)?.obstacle.label).toBe('a');
  });

  it('picks the obstacle the segment reaches FIRST', () => {
    const near = rect(-2 * MM, 0, MM, MM, null, 'near');
    const far = rect(2 * MM, 0, MM, MM, null, 'far');
    const set = setOf(far, near); // insertion order ≠ spatial order
    expect(firstHit(FROM, TO, set, null)?.obstacle.label).toBe('near');
  });

  it('skips the excluded net', () => {
    const mine = rect(-2 * MM, 0, MM, MM, 'n1', 'mine');
    const foreign = rect(2 * MM, 0, MM, MM, 'n2', 'foreign');
    const set = setOf(mine, foreign);
    expect(firstHit(FROM, TO, set, 'n1')?.obstacle.label).toBe('foreign');
  });
});

describe('pathIsClear', () => {
  it('accepts legal polylines and rejects violating ones', () => {
    const set = setOf(rect(0, 0, MM, MM));
    expect(pathIsClear([FROM, TO], set)).toBe(false); // dives straight through
    expect(pathIsClear([FROM, { x: -5 * MM, y: 2 * MM }, { x: 5 * MM, y: 2 * MM }, TO], set)).toBe(
      true, // hops well over the copper
    );
    const detour = routeHead(FROM, TO, set).path;
    expect(pathIsClear(detour, set)).toBe(true);
  });
});
