import polygonClipping from 'polygon-clipping';

import { buildObstacleSet } from './obstacles.js';

import type { FootprintSource, Obstacle } from './obstacles.js';
import type { DesignGraph, Vec, Zone } from '@protopulse/graph';
import type { MultiPolygon, Polygon, Ring } from 'polygon-clipping';

/**
 * Zone pours (Vol II §E) — the derived artifact behind a zone's intent:
 * the outline polygon minus every piece of FOREIGN copper on the layer,
 * inflated by the pour clearance. Same-net copper is deliberately left
 * in the fill — that's how the zone connects (v1 ships solid connects;
 * thermal reliefs are a later slice, stated plainly).
 *
 * Geometry discipline: the boolean work runs in floats (martinez via
 * polygon-clipping — deterministic for identical inputs), and results
 * round back to INTEGER nm at the boundary. Keep-out expansions use
 * square corners, which keep MORE than the required clearance at
 * corners — conservative, never too tight.
 */

export interface PourPolygon {
  /** Outer ring, integer nm, implicitly closed, no duplicate tail. */
  outer: Vec[];
  /** Holes (islands of keep-out fully inside the fill). */
  holes: Vec[][];
}

export interface PourResult {
  polygons: PourPolygon[];
  /** How many foreign-copper keep-outs were carved. */
  keepouts: number;
}

function toRing(points: readonly Vec[]): Ring {
  return points.map((p) => [p.x, p.y]);
}

/** Oriented box covering a capsule (segment a-b with radius r),
 *  extended r past both ends — square caps, conservative at corners. */
function capsuleBox(a: Vec, b: Vec, r: number): Ring {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const ux = len === 0 ? 1 : dx / len;
  const uy = len === 0 ? 0 : dy / len;
  const nx = -uy;
  const ny = ux;
  const ax = a.x - ux * r;
  const ay = a.y - uy * r;
  const bx = b.x + ux * r;
  const by = b.y + uy * r;
  return [
    [ax + nx * r, ay + ny * r],
    [bx + nx * r, by + ny * r],
    [bx - nx * r, by - ny * r],
    [ax - nx * r, ay - ny * r],
  ];
}

function obstacleKeepout(ob: Obstacle, clearanceNm: number): Ring {
  if (ob.shape.kind === 'capsule') {
    return capsuleBox(ob.shape.a, ob.shape.b, ob.shape.r + clearanceNm);
  }
  const { at, wNm, hNm } = ob.shape.rect;
  const hw = wNm / 2 + clearanceNm;
  const hh = hNm / 2 + clearanceNm;
  return [
    [at.x - hw, at.y - hh],
    [at.x + hw, at.y - hh],
    [at.x + hw, at.y + hh],
    [at.x - hw, at.y + hh],
  ];
}

/** Round a clipped ring back to integer nm, dropping the duplicate
 *  closing point and any ring that degenerates below a triangle. */
function roundRing(ring: Ring): Vec[] | null {
  const out: Vec[] = [];
  for (const [x, y] of ring) {
    const p = { x: Math.round(x), y: Math.round(y) };
    const last = out[out.length - 1];
    if (last?.x === p.x && last.y === p.y) continue;
    out.push(p);
  }
  const first = out[0];
  const tail = out[out.length - 1];
  if (out.length > 1 && first && first.x === tail?.x && first.y === tail.y) out.pop();
  return out.length >= 3 ? out : null;
}

/**
 * Compute the pour for one zone against the live graph. `deckClearanceNm`
 * is the rule deck's min_clearance; the zone's own override wins.
 */
export function computePour(
  zone: Zone,
  graph: DesignGraph,
  parts: FootprintSource,
  deckClearanceNm: number,
): PourResult {
  const clearanceNm = zone.clearanceNm ?? deckClearanceNm;
  // buildObstacleSet handles layer filtering, side-aware pads, and the
  // same-net exclusion (a pour CONNECTS to its own net's copper). The
  // set's own inflate is irrelevant here — we expand shapes ourselves.
  const set = buildObstacleSet(graph, parts, {
    layerId: zone.layerId,
    clearanceNm: 1,
    widthNm: 2,
    netId: zone.netId,
  });
  // Only copper whose expanded keep-out can touch the outline matters —
  // both for the polygon math and for an honest keepout count.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const v of zone.outline) {
    if (v.x < minX) minX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.x > maxX) maxX = v.x;
    if (v.y > maxY) maxY = v.y;
  }
  const keepouts: Polygon[] = [];
  for (const ob of set.obstacles) {
    const ring = obstacleKeepout(ob, clearanceNm);
    const xs = ring.map((p) => p[0]);
    const ys = ring.map((p) => p[1]);
    const overlaps =
      Math.min(...xs) <= maxX &&
      Math.max(...xs) >= minX &&
      Math.min(...ys) <= maxY &&
      Math.max(...ys) >= minY;
    if (overlaps) keepouts.push([ring]);
  }

  const outline: Polygon = [toRing(zone.outline)];
  const clipped: MultiPolygon =
    keepouts.length === 0
      ? [outline]
      : polygonClipping.difference([outline], ...keepouts.map((k) => [k]));

  const polygons: PourPolygon[] = [];
  for (const poly of clipped) {
    const [outerRaw, ...holesRaw] = poly;
    if (!outerRaw) continue;
    const outer = roundRing(outerRaw);
    if (!outer) continue;
    const holes: Vec[][] = [];
    for (const h of holesRaw) {
      const hole = roundRing(h);
      if (hole) holes.push(hole);
    }
    polygons.push({ outer, holes });
  }
  return { polygons, keepouts: keepouts.length };
}

/** Shoelace area of one pour polygon (holes subtracted), nm². */
export function pourArea(p: PourPolygon): number {
  const ringArea = (ring: readonly Vec[]): number => {
    let sum = 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      if (a && b) sum += a.x * b.y - b.x * a.y;
    }
    return Math.abs(sum) / 2;
  };
  return p.holes.reduce((acc, h) => acc - ringArea(h), ringArea(p.outer));
}
