import { cloneGraph } from '@protopulse/graph';
import { z } from 'zod';

import type { DesignGraph, Vec } from '@protopulse/graph';

/**
 * Panelization (Vol I §6) — honest v1.
 *
 * The panel is a TRANSFORMED GRAPH: every component, net, and piece of
 * copper is replicated per copy with suffixed ids/refs and offset
 * geometry, and the outline becomes the panel rectangle. That means
 * every existing exporter (gerber, excellon, pick-and-place, even DRC)
 * works on the panel unchanged — panelization adds geometry, not a
 * second export pipeline. V-cut lines come back alongside the graph
 * for the Edge.Cuts emitter.
 *
 * Honest cuts, stated plainly:
 * - RECTANGULAR axis-aligned outlines only (the V-cut constraint is
 *   real: a V-cut is a straight full-panel score). Anything else
 *   refuses with a reason.
 * - V-cut separation only — mouse-bites (tab routing + drill runs)
 *   are a later slice.
 * - No panel fiducials yet: the graph can't represent bare copper
 *   (pads come from parts), and fabs like JLC add their own panel
 *   fiducials on request. Later slice.
 * - Copies butt against each other (V-cuts need zero gap).
 */

export const PanelSpecSchema = z.object({
  rows: z.number().int().min(1).max(20),
  cols: z.number().int().min(1).max(20),
  /** Sacrificial rail height added above and below (0 = no rails).
   *  Rails join the boards through the same V-cuts. */
  railNm: z.number().int().nonnegative().default(0),
});

export type PanelSpec = z.infer<typeof PanelSpecSchema>;

export interface VCut {
  a: Vec;
  b: Vec;
}

export type PanelResult =
  | { ok: true; graph: DesignGraph; vCuts: VCut[]; copies: number }
  | { ok: false; reason: string };

/** Axis-aligned rectangle check: 4 corners, each edge purely horizontal
 *  or vertical, non-degenerate. Returns its bounds or null. */
function rectBounds(outline: readonly Vec[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (outline.length !== 4) return null;
  for (let i = 0; i < 4; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % 4];
    if (!a || !b) return null;
    const horizontal = a.y === b.y && a.x !== b.x;
    const vertical = a.x === b.x && a.y !== b.y;
    if (!horizontal && !vertical) return null;
  }
  const xs = outline.map((p) => p.x);
  const ys = outline.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  if (minX === maxX || minY === maxY) return null;
  return { minX, minY, maxX, maxY };
}

const shift = (p: Vec, dx: number, dy: number): Vec => ({ x: p.x + dx, y: p.y + dy });

/**
 * Replicate the design rows×cols. Copy 1 is the original (ids/refs
 * unchanged — blame still points home); copies 2..N suffix every id
 * and ref with `~P<n>` (the `~` keeps suffixed ids out of the op-id
 * grammar's way and reads as "machine-made").
 */
export function panelizeGraph(source: DesignGraph, specIn: PanelSpec): PanelResult {
  const spec = PanelSpecSchema.parse(specIn);
  const outline = source.pcb.outline;
  if (!outline) return { ok: false, reason: 'the design has no board outline — draw one first (Outline tool)' };
  const bounds = rectBounds(outline);
  if (!bounds) {
    return { ok: false, reason: 'panelization v1 needs a RECTANGULAR axis-aligned outline (V-cuts are straight full-panel scores)' };
  }
  if (spec.rows * spec.cols === 1 && spec.railNm === 0) {
    return { ok: false, reason: '1×1 with no rails is just the board — nothing to panelize' };
  }

  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;
  const panel = cloneGraph(source);

  // Copies 2..N: replicate components/nets/copper with offsets.
  for (let row = 0; row < spec.rows; row++) {
    for (let col = 0; col < spec.cols; col++) {
      if (row === 0 && col === 0) continue;
      const n = row * spec.cols + col + 1;
      const sfx = `~P${String(n)}`;
      const dx = col * w;
      const dy = row * h;

      for (const net of source.nets.values()) {
        // Copies leave any bus behind — bus membership is bidirectional
        // and the original bus doesn't list machine-made nets.
        const { busId: _bus, ...rest } = net;
        void _bus;
        panel.nets.set(net.id + sfx, {
          ...rest,
          id: net.id + sfx,
          name: net.name + sfx,
          ports: net.ports.map((p) => {
            const i = p.indexOf(':');
            return `${p.slice(0, i)}${sfx}:${p.slice(i + 1)}`;
          }),
        });
      }
      for (const comp of source.components.values()) {
        panel.components.set(comp.id + sfx, {
          ...comp,
          id: comp.id + sfx,
          ref: comp.ref + sfx,
          fields: { ...comp.fields },
        });
        const place = source.pcb.placements.get(comp.id);
        if (place) {
          panel.pcb.placements.set(comp.id + sfx, { ...place, at: shift(place.at, dx, dy) });
        }
      }
      for (const trace of source.pcb.traces.values()) {
        panel.pcb.traces.set(trace.id + sfx, {
          ...trace,
          id: trace.id + sfx,
          netId: trace.netId + sfx,
          path: trace.path.map((p) => shift(p, dx, dy)),
        });
      }
      for (const via of source.pcb.vias.values()) {
        panel.pcb.vias.set(via.id + sfx, {
          ...via,
          id: via.id + sfx,
          netId: via.netId + sfx,
          at: shift(via.at, dx, dy),
        });
      }
      for (const zone of source.pcb.zones.values()) {
        panel.pcb.zones.set(zone.id + sfx, {
          ...zone,
          id: zone.id + sfx,
          netId: zone.netId + sfx,
          outline: zone.outline.map((p) => shift(p, dx, dy)),
        });
      }
    }
  }

  // Panel outline: the copy array plus rails above and below.
  const panelMinY = bounds.minY - spec.railNm;
  const panelMaxY = bounds.minY + spec.rows * h + spec.railNm;
  const panelMaxX = bounds.minX + spec.cols * w;
  panel.pcb.outline = [
    { x: bounds.minX, y: panelMinY },
    { x: panelMaxX, y: panelMinY },
    { x: panelMaxX, y: panelMaxY },
    { x: bounds.minX, y: panelMaxY },
  ];

  // V-cuts: every internal copy boundary, plus the rail joints.
  const vCuts: VCut[] = [];
  for (let col = 1; col < spec.cols; col++) {
    const x = bounds.minX + col * w;
    vCuts.push({ a: { x, y: panelMinY }, b: { x, y: panelMaxY } });
  }
  const railRows = spec.railNm > 0 ? [0, spec.rows] : [];
  for (let row = 1; row < spec.rows; row++) {
    const y = bounds.minY + row * h;
    vCuts.push({ a: { x: bounds.minX, y }, b: { x: panelMaxX, y } });
  }
  for (const row of railRows) {
    const y = bounds.minY + row * h;
    vCuts.push({ a: { x: bounds.minX, y }, b: { x: panelMaxX, y } });
  }

  return { ok: true, graph: panel, vCuts, copies: spec.rows * spec.cols };
}
