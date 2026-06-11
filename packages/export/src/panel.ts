import { cloneGraph } from '@protopulse/graph';
import { z } from 'zod';

import type { DesignGraph, Vec } from '@protopulse/graph';

/**
 * Panelization (Vol I §6) — honest v2.
 *
 * The panel is a TRANSFORMED GRAPH: every component, net, and piece of
 * copper is replicated per copy with suffixed ids/refs and offset
 * geometry, and the outline becomes the panel rectangle. That means
 * every existing exporter (gerber, excellon, pick-and-place, even DRC)
 * works on the panel unchanged — panelization adds geometry, not a
 * second export pipeline.
 *
 * Two separation styles:
 * - 'v-cut' (v1): copies butt against each other; straight full-panel
 *   scores come back for the Edge.Cuts emitter.
 * - 'mouse-bites' (v2): copies separate by a routed channel (`gapNm`)
 *   bridged by tabs (`tabWidthNm`, two per copy edge at 25%/75%), with
 *   perforation drill runs (0.5 mm at 0.75 mm pitch) along BOTH edges
 *   of every channel so each piece snaps clean. Per-piece outlines come
 *   back as `edgeSegments` for Edge.Cuts; bite centers as `bites` for
 *   the drill file (they join the one Excellon file — KiCad would split
 *   PTH/NPTH into two files, we don't yet).
 *
 * Honest cuts, stated plainly:
 * - RECTANGULAR axis-aligned outlines only (the V-cut constraint is
 *   real: a V-cut is a straight full-panel score). Anything else
 *   refuses with a reason.
 * - Mouse-bite Edge.Cuts are outline-overlay style (outer rect +
 *   per-piece rects + bite drills), not a single routed contour
 *   polygon — fab CAM reads it, kikit-style contour tracing is later.
 * - No panel fiducials yet: the graph can't represent bare copper
 *   (pads come from parts), and fabs like JLC add their own panel
 *   fiducials on request. Later slice.
 */

/** Mouse-bite perforation: 0.5 mm holes at 0.75 mm pitch (fab norm). */
export const BITE_DRILL_NM = 500_000;
export const BITE_PITCH_NM = 750_000;

export const PanelSpecSchema = z.object({
  rows: z.number().int().min(1).max(20),
  cols: z.number().int().min(1).max(20),
  /** Sacrificial rail height added above and below (0 = no rails).
   *  Rails join the boards the same way the copies join each other. */
  railNm: z.number().int().nonnegative().default(0),
  separation: z.enum(['v-cut', 'mouse-bites']).default('v-cut'),
  /** Routed channel width between pieces (mouse-bites only; v-cuts
   *  need zero gap and ignore it). */
  gapNm: z.number().int().positive().default(2_000_000),
  /** Tab width along each bridged edge (mouse-bites only). */
  tabWidthNm: z.number().int().positive().default(5_000_000),
});

export type PanelSpec = z.input<typeof PanelSpecSchema>;

export interface VCut {
  a: Vec;
  b: Vec;
}

export type PanelResult =
  | {
      ok: true;
      graph: DesignGraph;
      vCuts: VCut[];
      copies: number;
      /** Mouse-bite hole centers (Ø BITE_DRILL_NM), [] for v-cut. */
      bites: Vec[];
      /** Per-piece outline edges for Edge.Cuts, [] for v-cut (the
       *  panel outline alone covers the butted layout). */
      edgeSegments: VCut[];
    }
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

/** The four edges of an axis-aligned rect, as segments. */
function rectEdges(minX: number, minY: number, maxX: number, maxY: number): VCut[] {
  return [
    { a: { x: minX, y: minY }, b: { x: maxX, y: minY } },
    { a: { x: maxX, y: minY }, b: { x: maxX, y: maxY } },
    { a: { x: maxX, y: maxY }, b: { x: minX, y: maxY } },
    { a: { x: minX, y: maxY }, b: { x: minX, y: minY } },
  ];
}

/** Bite-hole centers for one tab: a run along the tab span (axis
 *  'x' = horizontal edge, holes vary in x) centered on `center`. */
function biteRun(center: Vec, axis: 'x' | 'y', tabWidthNm: number): Vec[] {
  const count = Math.floor(tabWidthNm / BITE_PITCH_NM) + 1;
  const out: Vec[] = [];
  for (let i = 0; i < count; i++) {
    const offset = Math.round((i - (count - 1) / 2) * BITE_PITCH_NM);
    out.push(axis === 'x' ? { x: center.x + offset, y: center.y } : { x: center.x, y: center.y + offset });
  }
  return out;
}

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
    return { ok: false, reason: 'panelization needs a RECTANGULAR axis-aligned outline (separation channels and V-cuts are straight)' };
  }
  if (spec.rows * spec.cols === 1 && spec.railNm === 0) {
    return { ok: false, reason: '1×1 with no rails is just the board — nothing to panelize' };
  }

  const bites = spec.separation === 'mouse-bites';
  // V-cuts require butted copies; mouse-bites route a channel between pieces.
  const gap = bites ? spec.gapNm : 0;
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;
  const pitchX = w + gap;
  const pitchY = h + gap;
  const panel = cloneGraph(source);

  // Copies 2..N: replicate components/nets/copper with offsets.
  for (let row = 0; row < spec.rows; row++) {
    for (let col = 0; col < spec.cols; col++) {
      if (row === 0 && col === 0) continue;
      const n = row * spec.cols + col + 1;
      const sfx = `~P${String(n)}`;
      const dx = col * pitchX;
      const dy = row * pitchY;

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

  // Piece geometry helpers (copy col/row → its rect).
  const copyMinX = (col: number): number => bounds.minX + col * pitchX;
  const copyMinY = (row: number): number => bounds.minY + row * pitchY;
  const arrayMaxX = copyMinX(spec.cols - 1) + w;
  const arrayMaxY = copyMinY(spec.rows - 1) + h;

  // Panel outline: the copy array plus rails above and below (rails
  // separated by the same channel in mouse-bite mode).
  const railGap = spec.railNm > 0 ? gap : 0;
  const panelMinY = bounds.minY - (spec.railNm > 0 ? spec.railNm + railGap : 0);
  const panelMaxY = arrayMaxY + (spec.railNm > 0 ? spec.railNm + railGap : 0);
  panel.pcb.outline = [
    { x: bounds.minX, y: panelMinY },
    { x: arrayMaxX, y: panelMinY },
    { x: arrayMaxX, y: panelMaxY },
    { x: bounds.minX, y: panelMaxY },
  ];

  if (!bites) {
    // V-cuts: every internal copy boundary, plus the rail joints.
    const vCuts: VCut[] = [];
    for (let col = 1; col < spec.cols; col++) {
      const x = bounds.minX + col * w;
      vCuts.push({ a: { x, y: panelMinY }, b: { x, y: panelMaxY } });
    }
    const railRows = spec.railNm > 0 ? [0, spec.rows] : [];
    for (let row = 1; row < spec.rows; row++) {
      const y = bounds.minY + row * h;
      vCuts.push({ a: { x: bounds.minX, y }, b: { x: arrayMaxX, y } });
    }
    for (const row of railRows) {
      const y = bounds.minY + row * h;
      vCuts.push({ a: { x: bounds.minX, y }, b: { x: arrayMaxX, y } });
    }
    return { ok: true, graph: panel, vCuts, copies: spec.rows * spec.cols, bites: [], edgeSegments: [] };
  }

  // ── Mouse-bites ──
  const biteCenters: Vec[] = [];
  const edgeSegments: VCut[] = [];

  // Per-piece outlines: every copy rect, plus the rail strips.
  for (let row = 0; row < spec.rows; row++) {
    for (let col = 0; col < spec.cols; col++) {
      edgeSegments.push(...rectEdges(copyMinX(col), copyMinY(row), copyMinX(col) + w, copyMinY(row) + h));
    }
  }
  if (spec.railNm > 0) {
    edgeSegments.push(...rectEdges(bounds.minX, panelMinY, arrayMaxX, panelMinY + spec.railNm));
    edgeSegments.push(...rectEdges(bounds.minX, panelMaxY - spec.railNm, arrayMaxX, panelMaxY));
  }

  // Tabs: two per bridged copy edge, at 25% and 75% of the edge. Bites
  // run along BOTH edges of each channel so both pieces snap clean.
  const tabFracs = [0.25, 0.75];

  // Vertical channels (between column col-1 and col), one bridge per row.
  for (let col = 1; col < spec.cols; col++) {
    const leftEdgeX = copyMinX(col) - gap;
    const rightEdgeX = copyMinX(col);
    for (let row = 0; row < spec.rows; row++) {
      for (const f of tabFracs) {
        const y = Math.round(copyMinY(row) + f * h);
        biteCenters.push(...biteRun({ x: leftEdgeX, y }, 'y', spec.tabWidthNm));
        biteCenters.push(...biteRun({ x: rightEdgeX, y }, 'y', spec.tabWidthNm));
      }
    }
  }
  // Horizontal channels (between row row-1 and row), one bridge per column.
  for (let row = 1; row < spec.rows; row++) {
    const bottomEdgeY = copyMinY(row) - gap;
    const topEdgeY = copyMinY(row);
    for (let col = 0; col < spec.cols; col++) {
      for (const f of tabFracs) {
        const x = Math.round(copyMinX(col) + f * w);
        biteCenters.push(...biteRun({ x, y: bottomEdgeY }, 'x', spec.tabWidthNm));
        biteCenters.push(...biteRun({ x, y: topEdgeY }, 'x', spec.tabWidthNm));
      }
    }
  }
  // Rail channels: below row 0 and above the last row.
  if (spec.railNm > 0) {
    const channels = [
      { railEdgeY: panelMinY + spec.railNm, boardEdgeY: bounds.minY },
      { railEdgeY: panelMaxY - spec.railNm, boardEdgeY: arrayMaxY },
    ];
    for (const ch of channels) {
      for (let col = 0; col < spec.cols; col++) {
        for (const f of tabFracs) {
          const x = Math.round(copyMinX(col) + f * w);
          biteCenters.push(...biteRun({ x, y: ch.railEdgeY }, 'x', spec.tabWidthNm));
          biteCenters.push(...biteRun({ x, y: ch.boardEdgeY }, 'x', spec.tabWidthNm));
        }
      }
    }
  }

  return {
    ok: true,
    graph: panel,
    vCuts: [],
    copies: spec.rows * spec.cols,
    bites: biteCenters,
    edgeSegments,
  };
}
