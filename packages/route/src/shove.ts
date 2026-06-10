import { buildObstacleSet, makeObstacle, makeObstacleSet } from './obstacles.js';
import { pathIsClear, routeHead } from './walkaround.js';

import type { Obstacle, ObstacleSet, FootprintSource } from './obstacles.js';
import type { DesignGraph, Uuid, Vec } from '@protopulse/graph';

/**
 * Shove routing — Vol II §E.1 step 2, the honest first cut.
 *
 * Semantics: the NEW trace goes where the user drew it; existing
 * different-net traces that would violate clearance (the "victims") are
 * re-routed end-to-end by the walkaround engine with the new trace (and
 * every previously planned reroute) inserted as an obstacle. Victims
 * are planned sequentially in id order with cumulative obstacle
 * insertion, so the final configuration is mutually consistent by
 * construction.
 *
 * Honest cuts, stated plainly:
 * - Pads and vias never move. A new path that violates one is
 *   `blocked`, not shoved — components are placement decisions.
 * - Victims re-route END-TO-END (their intermediate waypoints are not
 *   preserved as intent). Spring-back restores the original path when
 *   the shover later disappears — that lives with the op-log (app side).
 * - Single-level shove: a victim's detour treats every OTHER trace as a
 *   hard obstacle. Cascading shove (the victim pushing a third trace)
 *   is a later slice; corridors that would need it come back `blocked`.
 *
 * Pure, deterministic, integer-nm in and out.
 */

export interface ShoveOpts {
  layerId: string;
  /** Deck min_clearance, integer nm. */
  clearanceNm: number;
  /** Width of the trace being routed, integer nm. */
  widthNm: number;
  /** The new trace's net — same-net copper is legal to touch. */
  netId: Uuid;
}

export interface ShoveReroute {
  traceId: Uuid;
  /** The victim's replacement polyline (integer nm). */
  path: Vec[];
}

export type ShoveResult =
  | { kind: 'clear' }
  | { kind: 'shove'; reroutes: ShoveReroute[] }
  | { kind: 'blocked'; reason: string };

/** Graph copy with the given traces removed — obstacle building treats
 *  them as gone (they are being re-routed). Shallow except pcb.traces. */
function graphWithoutTraces(graph: DesignGraph, ids: ReadonlySet<Uuid>): DesignGraph {
  const traces = new Map(graph.pcb.traces);
  for (const id of ids) traces.delete(id);
  return { ...graph, pcb: { ...graph.pcb, traces } };
}

/** Obstacles for one trace's copper at the given inflate. */
function traceObstacles(
  trace: { id: Uuid; netId: Uuid; path: readonly Vec[]; widthNm: number },
  inflateNm: number,
): Obstacle[] {
  const out: Obstacle[] = [];
  for (let i = 0; i + 1 < trace.path.length; i++) {
    const a = trace.path[i];
    const b = trace.path[i + 1];
    if (!a || !b) continue;
    out.push(
      makeObstacle(
        `trace ${trace.id}`,
        trace.netId,
        {
          kind: 'capsule',
          a: { ...a },
          b: { ...b },
          r: trace.widthNm / 2,
        },
        inflateNm,
      ),
    );
  }
  return out;
}

/** Extend a built set with extra obstacles (rebuilds the index). */
function withExtraObstacles(set: ObstacleSet, extra: Obstacle[]): ObstacleSet {
  if (extra.length === 0) return set;
  return makeObstacleSet([...set.obstacles, ...extra], set.layerId, set.inflateNm);
}

function hullsOverlap(a: Obstacle['hull'], b: Obstacle['hull']): boolean {
  return a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;
}

/**
 * Expand each extra obstacle's hull to the union of every hull it
 * (transitively) overlaps — its own cluster. A shover whose endpoints
 * land on foreign pads forms one contiguous keep-out with them; without
 * merging, hull-corner walks aim for corners buried INSIDE the
 * neighbouring pad's hull and dead-end. Conservative (detours go around
 * the whole cluster) and honest — never too tight.
 */
function withMergedHulls(extra: Obstacle[], context: readonly Obstacle[]): Obstacle[] {
  return extra.map((ob) => {
    let hull = { ...ob.hull };
    const pool = [...extra.filter((o) => o !== ob), ...context];
    let changed = true;
    while (changed) {
      changed = false;
      for (const other of pool) {
        if (!hullsOverlap(hull, other.hull)) continue;
        const next = {
          minX: Math.min(hull.minX, other.hull.minX),
          minY: Math.min(hull.minY, other.hull.minY),
          maxX: Math.max(hull.maxX, other.hull.maxX),
          maxY: Math.max(hull.maxY, other.hull.maxY),
        };
        if (
          next.minX !== hull.minX ||
          next.minY !== hull.minY ||
          next.maxX !== hull.maxX ||
          next.maxY !== hull.maxY
        ) {
          hull = next;
          changed = true;
        }
      }
    }
    return { ...ob, hull };
  });
}

export function planShove(
  newPath: readonly Vec[],
  graph: DesignGraph,
  parts: FootprintSource,
  opts: ShoveOpts,
): ShoveResult {
  if (newPath.length < 2) return { kind: 'clear' };

  // 1. What does the new path hit? Build the full set (same-net copper
  //    excluded) and split violations into shovable traces vs hard stops.
  const fullSet = buildObstacleSet(graph, parts, {
    layerId: opts.layerId,
    clearanceNm: opts.clearanceNm,
    widthNm: opts.widthNm,
    netId: opts.netId,
  });
  const victims = new Set<Uuid>();
  for (let i = 0; i + 1 < newPath.length; i++) {
    const a = newPath[i];
    const b = newPath[i + 1];
    if (!a || !b) continue;
    for (const ob of fullSet.obstacles) {
      if (ob.netId === opts.netId) continue;
      if (!pathIsClear([a, b], makeObstacleSet([ob], opts.layerId, fullSet.inflateNm))) {
        const m = /^trace (.+)$/.exec(ob.label);
        if (m?.[1] !== undefined && graph.pcb.traces.has(m[1])) {
          victims.add(m[1]);
        } else {
          return { kind: 'blocked', reason: `new path violates ${ob.label} — pads and vias don't move` };
        }
      }
    }
  }
  if (victims.size === 0) return { kind: 'clear' };

  // 2. Re-route each victim end-to-end. Obstacles: the graph minus ALL
  //    victims' old copper, plus the new trace, plus reroutes planned so
  //    far — cumulative, so the result is mutually consistent.
  const base = graphWithoutTraces(graph, victims);
  const newTrace = { id: 'NEW', netId: opts.netId, path: [...newPath], widthNm: opts.widthNm };
  const reroutes: ShoveReroute[] = [];
  const planned: { id: Uuid; netId: Uuid; path: Vec[]; widthNm: number }[] = [];

  for (const victimId of [...victims].sort()) {
    const victim = graph.pcb.traces.get(victimId);
    if (!victim) continue; // unreachable — victims came from the graph
    const from = victim.path[0];
    const to = victim.path[victim.path.length - 1];
    if (!from || !to) return { kind: 'blocked', reason: `trace ${victimId} has a degenerate path` };

    const baseSet = buildObstacleSet(base, parts, {
      layerId: opts.layerId,
      clearanceNm: opts.clearanceNm,
      widthNm: victim.widthNm,
      netId: victim.netId,
    });
    const extra = [newTrace, ...planned]
      .filter((t) => t.netId !== victim.netId)
      .flatMap((t) => traceObstacles(t, opts.clearanceNm + Math.ceil(victim.widthNm / 2)));
    const victimSet = withExtraObstacles(baseSet, withMergedHulls(extra, baseSet.obstacles));
    const detour = routeHead({ ...from }, { ...to }, victimSet);
    if (detour.blocked) {
      return {
        kind: 'blocked',
        reason: `trace ${victimId} has nowhere to go — cascading shove is a later slice`,
      };
    }
    reroutes.push({ traceId: victimId, path: detour.path });
    planned.push({ id: victimId, netId: victim.netId, path: detour.path, widthNm: victim.widthNm });
  }

  return { kind: 'shove', reroutes };
}

/**
 * Is `path` (a trace of widthNm on netId/layerId) clearance-legal in
 * the graph as it stands? Used by spring-back to decide whether a
 * shoved trace can return to its original path.
 */
export function pathIsLegal(
  path: readonly Vec[],
  graph: DesignGraph,
  parts: FootprintSource,
  opts: ShoveOpts & { /** Trace to ignore (its replacement is the path). */ ignoreTraceId?: Uuid },
): boolean {
  const base =
    opts.ignoreTraceId !== undefined
      ? graphWithoutTraces(graph, new Set([opts.ignoreTraceId]))
      : graph;
  const set = buildObstacleSet(base, parts, {
    layerId: opts.layerId,
    clearanceNm: opts.clearanceNm,
    widthNm: opts.widthNm,
    netId: opts.netId,
  });
  return pathIsClear(path, set);
}
