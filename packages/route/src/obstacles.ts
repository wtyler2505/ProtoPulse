import { netOfPort } from '@protopulse/graph';
import Flatbush from 'flatbush';
import { z } from 'zod';

import { aabbsOverlap, inflateAabb, rectAabb, segAabb, segRectDistance, segSegDistance } from './geom.js';

import type { Aabb, Rect } from './geom.js';
import type { DesignGraph, Uuid, Vec } from '@protopulse/graph';

/**
 * Obstacle sets for interactive routing (Vol II §E.1). One set describes
 * everything the head of a new trace on (layer, width) must stay clear
 * of: a flatbush index over inflated hulls plus the exact copper shapes
 * for narrow-phase checks.
 *
 * Copper model and transforms deliberately mirror the app/renderer side
 * (NOT drc's run.ts, which skips the bottom-side mirror as a documented
 * approximation): pads transform mirror-then-rotate-then-move exactly
 * like @protopulse/renderer's applyPcbPlacement, so obstacles line up
 * with the pads the user sees and clicks. Shapes match drc/run.ts:
 * traces are capsules (segments with radius widthNm/2), vias and circle
 * pads are zero-length capsules, rect pads are axis-aligned rectangles.
 * Only quarter-turn rotations are exact; anything else snaps to the
 * nearest quarter turn (same honest cut as the renderer).
 *
 * Same-net copper is legal to touch: when `netId` is given, every
 * trace/pad/via on that net is EXCLUDED from the set. Pads on no net
 * still demand clearance and are always included.
 */

// ── Types ────────────────────────────────────────────────────────────

/** Anything with footprint geometry per (partId, rev) — PartDb fits,
 *  and so does the app's structural PadSource bridge. */
export interface FootprintPadLike {
  pinKey: string;
  at: Vec;
  wNm: number;
  hNm: number;
  shape: 'rect' | 'circle';
  drillNm?: number;
}

export interface FootprintLike {
  pads: FootprintPadLike[];
}

export interface FootprintSource {
  get(partId: string, rev: number): { footprint?: FootprintLike } | undefined;
}

export type ObstacleShape =
  | { kind: 'capsule'; a: Vec; b: Vec; r: number }
  | { kind: 'rect'; rect: Rect };

export interface Obstacle {
  /** Provenance label ("trace t1", "R1:1", "via v1") for messages/tests. */
  label: string;
  /** Net the copper belongs to; null = floating pad (still an obstacle). */
  netId: Uuid | null;
  /** Exact copper shape — the narrow-phase clearance check. */
  shape: ObstacleShape;
  /** Copper AABB inflated by inflateNm, integer corners (outward-rounded).
   *  This rectangle is the hull the walkaround walks. */
  hull: Aabb;
}

export interface ObstacleSet {
  layerId: string;
  /** clearanceNm + widthNm/2 — the new trace's CENTERLINE must stay at
   *  least this far from obstacle copper. */
  inflateNm: number;
  obstacles: Obstacle[];
  /** Flatbush over the hulls; null when the set is empty. */
  index: Flatbush | null;
}

const buildOptsSchema = z.object({
  layerId: z.string().min(1),
  /** Deck min_clearance, integer nm. */
  clearanceNm: z.number().int().positive(),
  /** Width of the trace being routed, integer nm. */
  widthNm: z.number().int().positive(),
  /** Routing net — same-net copper is excluded (legal to touch). */
  netId: z.string().min(1).optional(),
});

export type BuildObstaclesOpts = z.infer<typeof buildOptsSchema>;

// ── Transforms ───────────────────────────────────────────────────────

// PROVENANCE: copied from packages/renderer/src/scene-pcb.ts
// (applyPcbPlacement / quarterTurnsOf) — the renderer keeps the pcb
// placement transform; the router must place pad obstacles where the
// renderer draws the pads. Mirror-then-rotate-then-move; non-quarter
// angles snap to the nearest quarter turn.
function quarterTurnsOf(rotMilli: number): 0 | 1 | 2 | 3 {
  const turns = Math.round(rotMilli / 90_000) % 4;
  return ((turns + 4) % 4) as 0 | 1 | 2 | 3;
}

function applyPlacement(
  p: Vec,
  placement: { at: Vec; rotMilli: number; side: 'top' | 'bottom' },
): Vec {
  const x = placement.side === 'bottom' ? -p.x : p.x;
  const y = p.y;
  let rx: number;
  let ry: number;
  switch (quarterTurnsOf(placement.rotMilli)) {
    case 1:
      rx = -y;
      ry = x;
      break;
    case 2:
      rx = -x;
      ry = -y;
      break;
    case 3:
      rx = y;
      ry = -x;
      break;
    default:
      rx = x;
      ry = y;
      break;
  }
  return { x: rx + placement.at.x, y: ry + placement.at.y };
}

// ── Shape helpers ────────────────────────────────────────────────────

function shapeAabb(shape: ObstacleShape): Aabb {
  if (shape.kind === 'rect') return rectAabb(shape.rect);
  return inflateAabb(segAabb(shape.a, shape.b), shape.r);
}

/** Copper AABB → integer hull, inflated outward by inflateNm. */
function hullOf(shape: ObstacleShape, inflateNm: number): Aabb {
  const box = shapeAabb(shape);
  return {
    minX: Math.floor(box.minX - inflateNm),
    minY: Math.floor(box.minY - inflateNm),
    maxX: Math.ceil(box.maxX + inflateNm),
    maxY: Math.ceil(box.maxY + inflateNm),
  };
}

/** Min distance from the centerline segment ab to the obstacle's copper. */
export function segObstacleDistance(a: Vec, b: Vec, obstacle: Obstacle): number {
  const shape = obstacle.shape;
  if (shape.kind === 'capsule') {
    return Math.max(0, segSegDistance(a, b, shape.a, shape.b) - shape.r);
  }
  return segRectDistance(a, b, shape.rect);
}

/**
 * Narrow phase: does centerline ab come closer than inflateNm to the
 * obstacle's copper? Exactly inflateNm away is LEGAL (gap == clearance
 * passes DRC: `gap >= required`), so the comparison is strict.
 */
export function segmentViolates(a: Vec, b: Vec, obstacle: Obstacle, inflateNm: number): boolean {
  return segObstacleDistance(a, b, obstacle) < inflateNm;
}

// ── Set construction ─────────────────────────────────────────────────

/** Build one obstacle — hull derived from the copper shape + inflateNm. */
export function makeObstacle(
  label: string,
  netId: Uuid | null,
  shape: ObstacleShape,
  inflateNm: number,
): Obstacle {
  return { label, netId, shape, hull: hullOf(shape, inflateNm) };
}

/** Build an ObstacleSet from explicit obstacles (tests build sets by hand). */
export function makeObstacleSet(
  obstacles: Obstacle[],
  layerId: string,
  inflateNm: number,
): ObstacleSet {
  let index: Flatbush | null = null;
  if (obstacles.length > 0) {
    index = new Flatbush(obstacles.length);
    for (const ob of obstacles) index.add(ob.hull.minX, ob.hull.minY, ob.hull.maxX, ob.hull.maxY);
    index.finish();
  }
  return { layerId, inflateNm, obstacles, index };
}

export const TOP_LAYER = 'F.Cu';
export const BOTTOM_LAYER = 'B.Cu';

/**
 * Build the obstacle set for routing a trace of `widthNm` on `layerId`
 * with `clearanceNm` of air, from the materialized graph + part db.
 *
 * Included (deterministic order — traces, vias, then pads by sorted id):
 * - trace segments on the same layer (capsules, r = trace width/2),
 * - vias (they span the full 2-layer stack in v0.4; capsule r = pad/2),
 * - SMD pads on the placement side's layer + ALL through-hole pads
 *   (drilled pads exist on both copper layers).
 * Excluded: anything on `opts.netId` — same-net copper is legal to touch.
 */
export function buildObstacleSet(
  graph: DesignGraph,
  parts: FootprintSource,
  opts: BuildObstaclesOpts,
): ObstacleSet {
  const { layerId, clearanceNm, widthNm, netId } = buildOptsSchema.parse(opts);
  const inflateNm = clearanceNm + Math.ceil(widthNm / 2);
  const obstacles: Obstacle[] = [];

  const push = (label: string, obstacleNet: Uuid | null, shape: ObstacleShape): void => {
    if (netId !== undefined && obstacleNet === netId) return; // same-net copper
    obstacles.push(makeObstacle(label, obstacleNet, shape, inflateNm));
  };

  for (const trace of [...graph.pcb.traces.values()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (trace.layerId !== layerId) continue;
    for (let i = 0; i + 1 < trace.path.length; i++) {
      const a = trace.path[i];
      const b = trace.path[i + 1];
      if (!a || !b) continue;
      push(`trace ${trace.id}`, trace.netId, {
        kind: 'capsule',
        a: { ...a },
        b: { ...b },
        r: trace.widthNm / 2,
      });
    }
  }

  for (const via of [...graph.pcb.vias.values()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (!via.span.includes(layerId)) continue;
    push(`via ${via.id}`, via.netId, {
      kind: 'capsule',
      a: { ...via.at },
      b: { ...via.at },
      r: via.padNm / 2,
    });
  }

  for (const componentId of [...graph.pcb.placements.keys()].sort()) {
    const placement = graph.pcb.placements.get(componentId);
    const comp = graph.components.get(componentId);
    if (!placement || !comp) continue;
    const footprint = parts.get(comp.partId, comp.partRev)?.footprint;
    if (!footprint) continue; // no land pattern yet — nothing on the board
    const sideLayer = placement.side === 'top' ? TOP_LAYER : BOTTOM_LAYER;
    for (const pad of footprint.pads) {
      const throughHole = pad.drillNm !== undefined;
      if (!throughHole && sideLayer !== layerId) continue; // SMD on the other side
      const at = applyPlacement(pad.at, placement);
      const quarter = quarterTurnsOf(placement.rotMilli) % 2 === 1;
      const wNm = quarter ? pad.hNm : pad.wNm;
      const hNm = quarter ? pad.wNm : pad.hNm;
      const shape: ObstacleShape =
        pad.shape === 'circle'
          ? { kind: 'capsule', a: at, b: at, r: pad.wNm / 2 }
          : { kind: 'rect', rect: { at, wNm, hNm } };
      push(`${comp.ref}:${pad.pinKey}`, netOfPort(graph, `${componentId}:${pad.pinKey}`)?.id ?? null, shape);
    }
  }

  return makeObstacleSet(obstacles, layerId, inflateNm);
}

// ── Queries ──────────────────────────────────────────────────────────

/**
 * Broad phase: obstacles whose hull the segment ab could touch, in
 * deterministic (insertion-index) order. Hulls are pre-inflated, so the
 * raw segment AABB is the right query box.
 */
export function queryObstacles(set: ObstacleSet, a: Vec, b: Vec): Obstacle[] {
  if (!set.index) return [];
  const box = segAabb(a, b);
  const ids = set.index.search(box.minX, box.minY, box.maxX, box.maxY).sort((x, y) => x - y);
  const out: Obstacle[] = [];
  for (const i of ids) {
    const ob = set.obstacles[i];
    if (ob && aabbsOverlap(box, ob.hull)) out.push(ob);
  }
  return out;
}
