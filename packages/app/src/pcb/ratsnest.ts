import { parsePortRef } from '@protopulse/graph';

import { footprintOf } from './tools.js';

import type { PadSource } from './tools.js';
import type { DesignGraph, Vec } from '@protopulse/graph';
import type { PcbViewLike } from '@protopulse/renderer';

/**
 * Ratsnest — straight airwires between not-yet-connected placed pads,
 * recomputed on every graph change (pure helper, unit-tested).
 *
 * "Connected" is deliberately simple (v0.4 honest cut): a pad counts as
 * connected when ANY trace of its net has a path vertex on the pad
 * center, and all traced pads of a net are treated as one conductor
 * (no trace-to-trace continuity check, no via awareness). Every
 * still-unconnected pad gets one airwire to the nearest already-counted
 * pad — a deterministic chain, not a true MST.
 */

/** A trace vertex within this distance of a pad center "lands" on it. */
export const TRACE_TOUCH_NM = 1_000;

export interface RatsnestSegment {
  netId: string;
  a: Vec;
  b: Vec;
}

interface PadPos {
  key: string; // componentId:pinKey — deterministic ordering
  at: Vec;
  traced: boolean;
}

function applyPlacementLocal(p: Vec, placement: { at: Vec; rotMilli: number; side: string }): Vec {
  const x = placement.side === 'bottom' ? -p.x : p.x;
  const y = p.y;
  const turns = ((Math.round(placement.rotMilli / 90_000) % 4) + 4) % 4;
  let rx: number;
  let ry: number;
  switch (turns) {
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

function distSq(a: Vec, b: Vec): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/** Airwires for every net with ≥2 placed pads that traces don't join. */
export function ratsnestSegments(
  graph: DesignGraph,
  view: PcbViewLike,
  parts: PadSource,
): RatsnestSegment[] {
  const segments: RatsnestSegment[] = [];
  const netIds = [...graph.nets.keys()].sort();

  for (const netId of netIds) {
    const net = graph.nets.get(netId);
    if (!net) continue;

    // Trace vertices of this net — the "already copper" set.
    const vertices: Vec[] = [];
    for (const trace of view.traces.values()) {
      if (trace.netId !== netId) continue;
      vertices.push(...trace.path);
    }

    // World positions of the net's pads on PLACED footprints.
    const pads: PadPos[] = [];
    for (const port of net.ports) {
      const { componentId, pinKey } = parsePortRef(port);
      const placement = view.placements.get(componentId);
      if (!placement) continue;
      const footprint = footprintOf(graph, parts, componentId);
      const pad = footprint?.pads.find((p) => p.pinKey === pinKey);
      if (!pad) continue;
      const at = applyPlacementLocal(pad.at, placement);
      const traced = vertices.some((v) => distSq(v, at) <= TRACE_TOUCH_NM * TRACE_TOUCH_NM);
      pads.push({ key: port, at, traced });
    }
    if (pads.length < 2) continue;
    pads.sort((a, b) => (a.key < b.key ? -1 : 1));

    const connected: PadPos[] = pads.filter((p) => p.traced);
    const pending: PadPos[] = pads.filter((p) => !p.traced);
    if (connected.length === 0) {
      const seed = pending.shift();
      if (seed) connected.push(seed);
    }

    for (const pad of pending) {
      let nearest: PadPos | null = null;
      let nearestDistSq = Infinity;
      for (const c of connected) {
        const d = distSq(c.at, pad.at);
        if (d < nearestDistSq) {
          nearestDistSq = d;
          nearest = c;
        }
      }
      if (nearest) segments.push({ netId, a: { ...nearest.at }, b: { ...pad.at } });
      connected.push(pad);
    }
  }
  return segments;
}

/** Split segments into dashes (the GL layer draws plain lines only). */
export function dashedLines(
  segments: readonly RatsnestSegment[],
  dashNm = 600_000,
  gapNm = 400_000,
): Float32Array {
  const out: number[] = [];
  const period = dashNm + gapNm;
  for (const seg of segments) {
    const dx = seg.b.x - seg.a.x;
    const dy = seg.b.y - seg.a.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) continue;
    const ux = dx / len;
    const uy = dy / len;
    for (let start = 0; start < len; start += period) {
      const end = Math.min(start + dashNm, len);
      out.push(
        Math.round(seg.a.x + ux * start),
        Math.round(seg.a.y + uy * start),
        Math.round(seg.a.x + ux * end),
        Math.round(seg.a.y + uy * end),
      );
    }
  }
  return Float32Array.from(out);
}
