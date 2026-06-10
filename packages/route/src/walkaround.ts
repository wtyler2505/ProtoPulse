import { lerpVec, segBoxEntryT, segBoxExitT } from './geom.js';
import { queryObstacles, segmentViolates } from './obstacles.js';

import type { Aabb } from './geom.js';
import type { Obstacle, ObstacleSet } from './obstacles.js';
import type { Uuid, Vec } from '@protopulse/graph';

/**
 * Walkaround head routing — the honest first slice of Vol II §E.1.
 *
 * `routeHead` advances a straight segment from→to; on the first obstacle
 * hit it walks BOTH ways (CW and CCW) around the obstacle's inflated
 * hull rectangle (rectangular hulls — we walk the corners), recurses
 * past it toward `to`, and keeps the shorter legal result. When both
 * directions stay illegal the result is `blocked: true` with the
 * best-effort partial path.
 *
 * Honest cuts, stated plainly:
 * - Hulls are axis-aligned rectangles (copper AABB + inflate), so
 *   detours around round copper are slightly conservative — never
 *   too tight, sometimes a little wide.
 * - No octilinear postprocess: hull-walk corners produce arbitrary-angle
 *   segments and we keep them as-is. Snapping the result to 45° is a
 *   later slice, not silently approximated here.
 * - No push-and-shove, no via hopping, single layer per call.
 *
 * Everything is integer-nm in and out, pure, and deterministic (ties
 * between equal-length CW/CCW walks resolve to CCW).
 */

export const DEFAULT_DEPTH_CAP = 16;

export interface RouteHeadOpts {
  /** Routing net — obstacles on this net are ignored (same-net copper
   *  is legal to touch). Sets built with `netId` already exclude them;
   *  this filter serves callers that cache one set per layer. */
  excludeNetId?: Uuid | null;
  /** Recursion cap; default 16. At the cap the head gives up and
   *  reports the straight shot as blocked. */
  maxDepth?: number;
}

export interface RouteHeadResult {
  /** Polyline from `from` toward `to` (integer nm). When blocked, the
   *  best-effort partial — it still ends at `to` but violates clearance
   *  somewhere along the way. */
  path: Vec[];
  blocked: boolean;
}

// ── Small path helpers ───────────────────────────────────────────────

/** Drop consecutive duplicate points (same contract as the app's
 *  dedupePath in packages/app/src/pcb/tools.ts — copied, not imported:
 *  route must not depend on the app). */
function dedupe(points: readonly Vec[]): Vec[] {
  const out: Vec[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last?.x === p.x && last.y === p.y) continue;
    out.push({ ...p });
  }
  return out;
}

function pathLength(points: readonly Vec[]): number {
  let len = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (a && b) len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return len;
}

/** Is every leg of `path` clear of the set (minus the excluded net)? */
export function pathIsClear(
  path: readonly Vec[],
  set: ObstacleSet,
  opts: RouteHeadOpts = {},
): boolean {
  const excludeNetId = opts.excludeNetId ?? null;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i];
    const b = path[i + 1];
    if (!a || !b) continue;
    if (firstHit(a, b, set, excludeNetId) !== null) return false;
  }
  return true;
}

// ── Hit detection ────────────────────────────────────────────────────

interface Hit {
  obstacle: Obstacle;
  /** Entry parameter into the obstacle's hull along the segment. */
  t: number;
}

/**
 * First obstacle the segment ab violates: broad phase over hulls
 * (flatbush), narrow phase against exact copper shapes, ordered by hull
 * entry parameter (ties keep set order — deterministic).
 */
export function firstHit(
  a: Vec,
  b: Vec,
  set: ObstacleSet,
  excludeNetId: Uuid | null,
): Hit | null {
  let best: Hit | null = null;
  for (const obstacle of queryObstacles(set, a, b)) {
    if (excludeNetId !== null && obstacle.netId === excludeNetId) continue;
    if (!segmentViolates(a, b, obstacle, set.inflateNm)) continue;
    const t = segBoxEntryT(a, b, obstacle.hull) ?? 0;
    if (best === null || t < best.t) best = { obstacle, t };
  }
  return best;
}

// ── Hull walking ─────────────────────────────────────────────────────

type WalkDir = 'ccw' | 'cw';

/** Hull corners in CCW order: c0 bottom-left, c1 bottom-right, c2
 *  top-right, c3 top-left. Side i runs c[i] → c[(i+1)%4]:
 *  0 bottom, 1 right, 2 top, 3 left. */
function hullCorners(h: Aabb): [Vec, Vec, Vec, Vec] {
  return [
    { x: h.minX, y: h.minY },
    { x: h.maxX, y: h.minY },
    { x: h.maxX, y: h.maxY },
    { x: h.minX, y: h.maxY },
  ];
}

/** Side of the hull a (boundary-ish) point belongs to — nearest side,
 *  first index wins ties, so corner points resolve deterministically. */
function sideOf(p: Vec, h: Aabb): 0 | 1 | 2 | 3 {
  const dists = [
    Math.abs(p.y - h.minY), // 0 bottom
    Math.abs(p.x - h.maxX), // 1 right
    Math.abs(p.y - h.maxY), // 2 top
    Math.abs(p.x - h.minX), // 3 left
  ];
  let side: 0 | 1 | 2 | 3 = 0;
  for (const i of [1, 2, 3] as const) {
    if ((dists[i] ?? Infinity) < (dists[side] ?? Infinity)) side = i;
  }
  return side;
}

/** Progress of p along side s in the CCW walking direction. */
function posCcw(p: Vec, s: 0 | 1 | 2 | 3): number {
  switch (s) {
    case 0:
      return p.x;
    case 1:
      return p.y;
    case 2:
      return -p.x;
    case 3:
      return -p.y;
  }
}

/**
 * Corner waypoints that carry the head around the hull in `dir`, from
 * where the segment from→to enters the hull to where it exits.
 */
function walkCorners(from: Vec, to: Vec, hull: Aabb, dir: WalkDir): Vec[] {
  const corners = hullCorners(hull);
  const tIn = Math.max(0, segBoxEntryT(from, to, hull) ?? 0);
  const tOut = Math.min(1, segBoxExitT(from, to, hull) ?? 1);
  const entry = lerpVec(from, to, tIn);
  const exit = lerpVec(from, to, tOut);
  const sE = sideOf(entry, hull);
  const sX = sideOf(exit, hull);

  const out: Vec[] = [];
  if (dir === 'ccw') {
    if (sE === sX && posCcw(exit, sX) >= posCcw(entry, sE)) return out;
    let s = sE;
    do {
      out.push(corners[(s + 1) % 4] ?? entry);
      s = ((s + 1) % 4) as 0 | 1 | 2 | 3;
    } while (s !== sX && out.length < 4);
  } else {
    if (sE === sX && posCcw(exit, sX) <= posCcw(entry, sE)) return out;
    let s = sE;
    do {
      out.push(corners[s]);
      s = ((s + 3) % 4) as 0 | 1 | 2 | 3;
    } while (s !== sX && out.length < 4);
  }
  return out;
}

// ── The router ───────────────────────────────────────────────────────

interface Ctx {
  set: ObstacleSet;
  excludeNetId: Uuid | null;
  maxDepth: number;
  /** Total route() invocations left — a hard safety budget so dense
   *  obstacle fields degrade to `blocked` instead of exponential work. */
  budget: number;
}

interface Candidate {
  path: Vec[];
  blocked: boolean;
  lenNm: number;
}

function route(from: Vec, to: Vec, ctx: Ctx, depth: number): RouteHeadResult {
  if (from.x === to.x && from.y === to.y) {
    return { path: [{ ...from }], blocked: false };
  }
  const hit = firstHit(from, to, ctx.set, ctx.excludeNetId);
  if (hit === null) {
    return { path: [{ ...from }, { ...to }], blocked: false };
  }
  ctx.budget -= 1;
  if (depth >= ctx.maxDepth || ctx.budget <= 0) {
    // Cap reached — give up honestly with the straight best-effort.
    return { path: [{ ...from }, { ...to }], blocked: true };
  }

  const candidates: Candidate[] = [];
  for (const dir of ['ccw', 'cw'] as const) {
    const corners = walkCorners(from, to, hit.obstacle.hull, dir);
    let pts: Vec[] = [{ ...from }];
    let cur = from;
    let blocked = false;
    for (const target of [...corners, to]) {
      if (target.x === cur.x && target.y === cur.y) continue;
      const sub = route(cur, target, ctx, depth + 1);
      pts = pts.concat(sub.path.slice(1));
      cur = target;
      if (sub.blocked) {
        blocked = true;
        break;
      }
    }
    // A walk that never reached `to` (sub blocked mid-way) still ends
    // somewhere useful — keep it as the best-effort partial.
    const last = pts[pts.length - 1];
    if (blocked && last && (last.x !== to.x || last.y !== to.y)) {
      pts.push({ ...to });
    }
    const path = dedupe(pts);
    candidates.push({ path, blocked, lenNm: pathLength(path) });
  }

  let best: Candidate | null = null;
  for (const c of candidates) {
    if (best === null) {
      best = c;
      continue;
    }
    if (best.blocked && !c.blocked) best = c;
    else if (best.blocked === c.blocked && c.lenNm < best.lenNm) best = c;
  }
  /* istanbul ignore next -- candidates always has 2 entries */
  if (best === null) return { path: [{ ...from }, { ...to }], blocked: true };
  return { path: best.path, blocked: best.blocked };
}

/**
 * Route the head of a new trace from→to around the obstacle set.
 * Pure, deterministic, integer-nm in and out.
 */
export function routeHead(
  from: Vec,
  to: Vec,
  obstacles: ObstacleSet,
  opts: RouteHeadOpts = {},
): RouteHeadResult {
  const ctx: Ctx = {
    set: obstacles,
    excludeNetId: opts.excludeNetId ?? null,
    maxDepth: opts.maxDepth ?? DEFAULT_DEPTH_CAP,
    budget: 10_000,
  };
  return route(from, to, ctx, 0);
}
