import { SceneGraph } from './scene.js';
import { boundsOfLines, CIRCLE_SEGMENTS, unionBounds } from './tessellate.js';

import type { RGBA, SceneNode } from './scene.js';
import type { Bounds, TessText } from './tessellate.js';
import type { Component, DesignGraph, GraphDelta, Uuid, Vec } from '@protopulse/graph';
import type { Part, PartDb } from '@protopulse/parts';

/**
 * PCB scene support (v0.4) — buildPcbScene/syncPcbScene turn the graph's
 * pcb view into SceneGraph nodes the GL layer's line + triangle paths
 * can draw:
 *
 *   footprint — courtyard + pad outlines as lines (selection legibility)
 *               plus filled pad triangles (rect = 2 tris, circle =
 *               16-segment fan); pad drills punch through as holeTris,
 *   trace     — centerline polyline (picking keys on it) plus the
 *               stroked width: one quad per segment expanded
 *               perpendicular by widthNm/2, with circle-fan joints at
 *               every path vertex (round caps + round joins),
 *   via       — filled annulus approximation: outer fan in copper color
 *               (tris) + drill fan in the board background (holeTris),
 *               with the two outline loops kept on top.
 *
 * The Pcb*Like / PcbFootprintSpec types below are PINNED structural
 * contracts (v0.4): @protopulse/graph's pcb view and @protopulse/parts'
 * Part.footprint are landing on a parallel track, so nothing here types
 * against those in-flight definitions. pcbViewOf() normalizes whatever
 * the materialized graph currently holds (legacy arrays or the pinned
 * Maps) into the pinned shape.
 *
 * Transform convention matches the schematic one (tessellate.ts):
 *   world = rotate_ccw(rotMilli) ∘ mirrorX(side=bottom) ∘ local + at
 * Only 90° steps are supported; other angles snap to the nearest quarter
 * turn (honest cut — the pinned op contract only emits 0/90/180/270).
 * Triangles wind CCW for top-side placements; the bottom-side mirror
 * flips winding (harmless — the GL layer never culls).
 */

// ── Pinned structural contracts ──────────────────────────────────────

export interface PcbPadSpec {
  pinKey: string;
  at: Vec;
  wNm: number;
  hNm: number;
  shape: 'rect' | 'circle';
  drillNm?: number;
}

export interface PcbFootprintSpec {
  pads: PcbPadSpec[];
  courtyard: { wNm: number; hNm: number };
}

/** A Part that may carry the (pinned, in-flight) footprint geometry. */
export type PartWithFootprint = Part & { footprint?: PcbFootprintSpec };

export interface PcbPlacementLike {
  at: Vec;
  rotMilli: number;
  side: 'top' | 'bottom';
  locked: boolean;
}

export interface PcbTraceLike {
  netId: Uuid;
  layerId: string;
  widthNm: number;
  path: Vec[];
}

export interface PcbViaLike {
  netId: Uuid;
  at: Vec;
  drillNm: number;
  padNm: number;
  span: readonly [string, string];
}

export interface PcbViewLike {
  placements: ReadonlyMap<Uuid, PcbPlacementLike>;
  traces: ReadonlyMap<Uuid, PcbTraceLike>;
  vias: ReadonlyMap<Uuid, PcbViaLike>;
}

// ── House palette (copper layers) ────────────────────────────────────

/** F.Cu red-ish / B.Cu blue-ish — the house copper palette. */
export const PCB_LAYER_COLORS: Record<'F.Cu' | 'B.Cu', RGBA> = {
  'F.Cu': [0.93, 0.36, 0.32, 1.0],
  'B.Cu': [0.36, 0.56, 0.95, 1.0],
};
export const VIA_COLOR: RGBA = [0.8, 0.78, 0.88, 1.0];
const UNKNOWN_LAYER_COLOR: RGBA = [0.6, 0.6, 0.6, 1.0];

export function layerColor(layerId: string): RGBA {
  return layerId === 'F.Cu' || layerId === 'B.Cu'
    ? PCB_LAYER_COLORS[layerId]
    : UNKNOWN_LAYER_COLOR;
}

// ── Transforms ───────────────────────────────────────────────────────

/** rotMilli → quarter turns (0..3); non-90° angles snap to the nearest. */
export function quarterTurnsOf(rotMilli: number): 0 | 1 | 2 | 3 {
  const turns = Math.round(rotMilli / 90_000) % 4;
  return ((turns + 4) % 4) as 0 | 1 | 2 | 3;
}

/** Apply side mirror (X-flip, first) then CCW rotation then translation. */
export function applyPcbPlacement(p: Vec, placement: PcbPlacementLike): Vec {
  const x = placement.side === 'bottom' ? -p.x : p.x;
  const y = p.y;
  let rx: number;
  let ry: number;
  switch (quarterTurnsOf(placement.rotMilli)) {
    case 0:
      rx = x;
      ry = y;
      break;
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
  }
  return { x: rx + placement.at.x, y: ry + placement.at.y };
}

/** World position of one pad center — pad picking and ratsnest rely on this. */
export function padWorldPosition(
  footprint: PcbFootprintSpec,
  placement: PcbPlacementLike,
  pinKey: string,
): Vec | null {
  const pad = footprint.pads.find((p) => p.pinKey === pinKey);
  if (!pad) return null;
  return applyPcbPlacement(pad.at, placement);
}

// ── Tessellation ─────────────────────────────────────────────────────

function pushLine(lines: number[], a: Vec, b: Vec): void {
  lines.push(a.x, a.y, b.x, b.y);
}

function circleLoop(lines: number[], center: Vec, r: number): void {
  let prev: Vec | null = null;
  let first: Vec | null = null;
  for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
    const theta = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
    const pt = {
      x: Math.round(center.x + r * Math.cos(theta)),
      y: Math.round(center.y + r * Math.sin(theta)),
    };
    if (prev) pushLine(lines, prev, pt);
    else first = pt;
    prev = pt;
  }
  if (prev && first) pushLine(lines, prev, first);
}

function pushTri(tris: number[], a: Vec, b: Vec, c: Vec): void {
  tris.push(a.x, a.y, b.x, b.y, c.x, c.y);
}

/** Local rect corners (center ± half extents) in CCW order. */
function rectCorners(at: Vec, hw: number, hh: number): [Vec, Vec, Vec, Vec] {
  return [
    { x: at.x - hw, y: at.y - hh },
    { x: at.x + hw, y: at.y - hh },
    { x: at.x + hw, y: at.y + hh },
    { x: at.x - hw, y: at.y + hh },
  ];
}

/** A convex quad (CCW corners) as two triangles — 12 floats. */
export function quadTris(c0: Vec, c1: Vec, c2: Vec, c3: Vec): number[] {
  const tris: number[] = [];
  pushTri(tris, c0, c1, c2);
  pushTri(tris, c0, c2, c3);
  return tris;
}

/**
 * Filled circle as a CIRCLE_SEGMENTS-triangle fan (CCW, integer-rounded
 * rim) — 16 tris / 48 vertices / 96 floats at the house segment count.
 */
export function circleFanTris(center: Vec, r: number): number[] {
  const tris: number[] = [];
  const rim = (i: number): Vec => {
    const theta = ((i % CIRCLE_SEGMENTS) / CIRCLE_SEGMENTS) * Math.PI * 2;
    return {
      x: Math.round(center.x + r * Math.cos(theta)),
      y: Math.round(center.y + r * Math.sin(theta)),
    };
  };
  for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
    pushTri(tris, center, rim(i), rim(i + 1));
  }
  return tris;
}

/**
 * One stroked segment: a quad expanded perpendicular by widthNm/2 (two
 * CCW triangles). The normal is rounded once so the quad stays a true
 * parallelogram in integer nm. Zero-length segments emit nothing.
 */
export function strokeSegmentTris(a: Vec, b: Vec, widthNm: number): number[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0 || widthNm <= 0) return [];
  const nx = Math.round((-dy / len) * (widthNm / 2));
  const ny = Math.round((dx / len) * (widthNm / 2));
  return quadTris(
    { x: a.x - nx, y: a.y - ny },
    { x: b.x - nx, y: b.y - ny },
    { x: b.x + nx, y: b.y + ny },
    { x: a.x + nx, y: a.y + ny },
  );
}

/** One pad's filled copper: rect = 2 tris, circle = 16-segment fan. */
export function tessellatePadTris(pad: PcbPadSpec, placement: PcbPlacementLike): number[] {
  const hw = Math.round(pad.wNm / 2);
  if (pad.shape === 'rect') {
    const hh = Math.round(pad.hNm / 2);
    const [l0, l1, l2, l3] = rectCorners(pad.at, hw, hh);
    return quadTris(
      applyPcbPlacement(l0, placement),
      applyPcbPlacement(l1, placement),
      applyPcbPlacement(l2, placement),
      applyPcbPlacement(l3, placement),
    );
  }
  // wNm is the circle pad's diameter; circles are rotation-invariant, so
  // the fan is built around the transformed center directly.
  return circleFanTris(applyPcbPlacement(pad.at, placement), hw);
}

/** One pad's drill hole (board-background fan); [] for SMD pads. */
export function tessellatePadHoleTris(pad: PcbPadSpec, placement: PcbPlacementLike): number[] {
  if (pad.drillNm === undefined || pad.drillNm <= 0) return [];
  return circleFanTris(applyPcbPlacement(pad.at, placement), Math.round(pad.drillNm / 2));
}

/**
 * One trace's stroked copper: a width-expanded quad per path segment
 * plus a circle-fan joint at every path vertex (round caps + joins).
 */
export function tessellateTraceTris(trace: PcbTraceLike): number[] {
  const tris: number[] = [];
  for (let i = 0; i + 1 < trace.path.length; i++) {
    const a = trace.path[i];
    const b = trace.path[i + 1];
    if (a && b) tris.push(...strokeSegmentTris(a, b, trace.widthNm));
  }
  const r = Math.round(trace.widthNm / 2);
  if (r > 0 && trace.path.length > 1) {
    for (const v of trace.path) tris.push(...circleFanTris(v, r));
  }
  return tris;
}

/**
 * One pad's outline: rect loop or circle loop, plus the drill loop when
 * present. Thin outline only — the fill comes from tessellatePadTris.
 */
export function tessellatePad(pad: PcbPadSpec, placement: PcbPlacementLike): number[] {
  const lines: number[] = [];
  const hw = Math.round(pad.wNm / 2);
  if (pad.shape === 'rect') {
    const hh = Math.round(pad.hNm / 2);
    const corners = rectCorners(pad.at, hw, hh).map((c) => applyPcbPlacement(c, placement));
    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      if (a && b) pushLine(lines, a, b);
    }
  } else {
    // wNm is the circle pad's diameter
    circleLoop(lines, applyPcbPlacement(pad.at, placement), hw);
  }
  if (pad.drillNm !== undefined && pad.drillNm > 0) {
    circleLoop(lines, applyPcbPlacement(pad.at, placement), Math.round(pad.drillNm / 2));
  }
  return lines;
}

/** Full footprint outline: courtyard rect (origin-centered) + every pad. */
export function tessellateFootprint(
  footprint: PcbFootprintSpec,
  placement: PcbPlacementLike,
): number[] {
  const lines: number[] = [];
  const hw = Math.round(footprint.courtyard.wNm / 2);
  const hh = Math.round(footprint.courtyard.hNm / 2);
  const corners = [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ].map((c) => applyPcbPlacement(c, placement));
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    if (a && b) pushLine(lines, a, b);
  }
  for (const pad of footprint.pads) {
    lines.push(...tessellatePad(pad, placement));
  }
  return lines;
}

// ── Node builders ────────────────────────────────────────────────────

const LABEL_SIZE_NM = 500_000;
const LABEL_GAP_NM = 250_000;

/**
 * Build the retained node for one placed footprint: courtyard + pad
 * outlines as lines, filled pad copper as tris, pad drills as holeTris.
 * Bottom-side placements mirror (applyPcbPlacement) and take the B.Cu
 * palette color, so flipped parts read as bottom copper at a glance.
 */
export function buildFootprintNode(
  component: Component,
  footprint: PcbFootprintSpec,
  placement: PcbPlacementLike,
): SceneNode {
  const lines = tessellateFootprint(footprint, placement);
  const tris: number[] = [];
  const holeTris: number[] = [];
  for (const pad of footprint.pads) {
    tris.push(...tessellatePadTris(pad, placement));
    holeTris.push(...tessellatePadHoleTris(pad, placement));
  }
  const body: Bounds = unionBounds(boundsOfLines(lines), boundsOfLines(tris)) ?? {
    minX: placement.at.x,
    minY: placement.at.y,
    maxX: placement.at.x,
    maxY: placement.at.y,
  };
  const texts: TessText[] = [
    {
      at: { x: body.minX, y: body.maxY + LABEL_GAP_NM },
      text: component.ref,
      sizeNm: LABEL_SIZE_NM,
    },
  ];
  return {
    id: component.id,
    kind: 'footprint',
    lines: Float32Array.from(lines),
    tris: Float32Array.from(tris),
    holeTris: Float32Array.from(holeTris),
    texts,
    bounds: { ...body, maxY: body.maxY + LABEL_GAP_NM + LABEL_SIZE_NM * 2 },
    color: PCB_LAYER_COLORS[placement.side === 'bottom' ? 'B.Cu' : 'F.Cu'],
  };
}

/**
 * Build the retained node for one trace: the centerline polyline (the
 * pick index keys trace proximity on it) plus the stroked width as
 * filled triangles. The app still surfaces widthNm in the readout.
 */
export function buildTraceNode(traceId: Uuid, trace: PcbTraceLike): SceneNode {
  const lines: number[] = [];
  for (let i = 0; i + 1 < trace.path.length; i++) {
    const a = trace.path[i];
    const b = trace.path[i + 1];
    if (a && b) pushLine(lines, a, b);
  }
  const tris = tessellateTraceTris(trace);
  return {
    id: traceId,
    kind: 'trace',
    lines: Float32Array.from(lines),
    tris: Float32Array.from(tris),
    texts: [],
    bounds:
      unionBounds(boundsOfLines(lines), boundsOfLines(tris)) ??
      { minX: 0, minY: 0, maxX: 0, maxY: 0 },
    color: layerColor(trace.layerId),
  };
}

/**
 * Build the retained node for one via: a filled annulus approximation —
 * outer copper fan (tris) with the drill punched out in the board
 * background color (holeTris) — under the pad-ring + drill loops.
 */
export function buildViaNode(viaId: Uuid, via: PcbViaLike): SceneNode {
  const lines: number[] = [];
  circleLoop(lines, via.at, Math.round(via.padNm / 2));
  circleLoop(lines, via.at, Math.round(via.drillNm / 2));
  return {
    id: viaId,
    kind: 'via',
    lines: Float32Array.from(lines),
    tris: Float32Array.from(circleFanTris(via.at, Math.round(via.padNm / 2))),
    holeTris: Float32Array.from(circleFanTris(via.at, Math.round(via.drillNm / 2))),
    texts: [],
    bounds: boundsOfLines(lines) ?? { minX: via.at.x, minY: via.at.y, maxX: via.at.x, maxY: via.at.y },
    color: VIA_COLOR,
  };
}

// ── Graph → scene ────────────────────────────────────────────────────

function toIdMap<T>(value: unknown, prefix: string): ReadonlyMap<Uuid, T> {
  if (value instanceof Map) return value as ReadonlyMap<Uuid, T>;
  if (Array.isArray(value)) {
    return new Map((value as T[]).map((item, i) => [`${prefix}:${String(i)}`, item] as const));
  }
  return new Map<Uuid, T>();
}

/**
 * Normalize graph.pcb into the pinned view shape. Tolerates the legacy
 * array-backed traces/vias (synthetic `trace:N`/`via:N` ids) so the app
 * keeps working while the graph package's Map-backed pcb view lands.
 */
export function pcbViewOf(graph: DesignGraph): PcbViewLike {
  const raw = (graph as { pcb?: unknown }).pcb;
  if (!raw || typeof raw !== 'object') {
    return { placements: new Map(), traces: new Map(), vias: new Map() };
  }
  const view = raw as { placements?: unknown; traces?: unknown; vias?: unknown };
  return {
    placements:
      view.placements instanceof Map
        ? (view.placements as ReadonlyMap<Uuid, PcbPlacementLike>)
        : new Map<Uuid, PcbPlacementLike>(),
    traces: toIdMap<PcbTraceLike>(view.traces, 'trace'),
    vias: toIdMap<PcbViaLike>(view.vias, 'via'),
  };
}

function buildPcbNodes(graph: DesignGraph, parts: PartDb): SceneNode[] {
  const view = pcbViewOf(graph);
  const nodes: SceneNode[] = [];
  for (const [componentId, placement] of view.placements) {
    const component = graph.components.get(componentId);
    if (!component) continue;
    const part = parts.get(component.partId, component.partRev) as PartWithFootprint | undefined;
    const footprint = part?.footprint;
    if (!footprint) continue; // no footprint yet — the tray flags it
    nodes.push(buildFootprintNode(component, footprint, placement));
  }
  for (const [traceId, trace] of view.traces) {
    if (trace.path.length < 2) continue;
    nodes.push(buildTraceNode(traceId, trace));
  }
  for (const [viaId, via] of view.vias) {
    nodes.push(buildViaNode(viaId, via));
  }
  return nodes;
}

/** Full PCB scene build from a materialized graph. */
export function buildPcbScene(graph: DesignGraph, parts: PartDb): SceneGraph {
  const scene = new SceneGraph();
  for (const node of buildPcbNodes(graph, parts)) scene.add(node);
  return scene;
}

/**
 * Full re-sync of a PCB scene in place — every node is rebuilt (object
 * identity is NOT preserved). The fallback path for branch switches and
 * other cases where no GraphDelta relates the old graph to the new one;
 * ordinary edits go through syncPcbScene below.
 */
export function rebuildPcbScene(scene: SceneGraph, graph: DesignGraph, parts: PartDb): void {
  const fresh = buildPcbNodes(graph, parts);
  const keep = new Set(fresh.map((n) => n.id));
  for (const id of [...scene.nodes.keys()]) {
    if (!keep.has(id)) scene.remove(id);
  }
  for (const node of fresh) scene.update(node);
}

function syncFootprint(
  scene: SceneGraph,
  graph: DesignGraph,
  view: PcbViewLike,
  parts: PartDb,
  id: Uuid,
): void {
  const component = graph.components.get(id);
  const placement = view.placements.get(id);
  if (!component || !placement) {
    scene.remove(id);
    return;
  }
  const part = parts.get(component.partId, component.partRev) as PartWithFootprint | undefined;
  const footprint = part?.footprint;
  if (!footprint) {
    scene.remove(id);
    return;
  }
  scene.update(buildFootprintNode(component, footprint, placement));
}

/**
 * Incremental PCB scene sync: re-tessellate ONLY the entities a
 * GraphDelta's pcbView (plus component prop changes — the ref label)
 * names. The delta is diff(prevGraph, nextGraph); `graph` is nextGraph.
 * Untouched nodes keep their object identity (tested), mirroring the
 * schematic applyDelta contract. A trace/via changed in place arrives
 * as removed + added under the same id — handled as one update.
 *
 * Delta ids are real graph ids, so this path requires the Map-backed
 * pcb view; legacy array-backed graphs go through rebuildPcbScene.
 */
export function syncPcbScene(
  scene: SceneGraph,
  delta: GraphDelta,
  graph: DesignGraph,
  parts: PartDb,
): void {
  const view = pcbViewOf(graph);

  // ── Footprints ──
  for (const id of delta.pcbView.unplaced) scene.remove(id);
  for (const id of delta.components.removed) scene.remove(id);
  const footprintResync = new Set<Uuid>([...delta.pcbView.placed, ...delta.pcbView.moved]);
  for (const id of delta.components.changed.keys()) {
    if (view.placements.has(id)) footprintResync.add(id);
  }
  for (const id of footprintResync) syncFootprint(scene, graph, view, parts, id);

  // ── Traces ──
  const tracesAdded = new Set<Uuid>(delta.pcbView.tracesAdded);
  for (const id of delta.pcbView.tracesRemoved) {
    if (!tracesAdded.has(id)) scene.remove(id);
  }
  for (const id of tracesAdded) {
    const trace = view.traces.get(id);
    if (trace && trace.path.length >= 2) scene.update(buildTraceNode(id, trace));
    else scene.remove(id);
  }

  // ── Vias ──
  const viasAdded = new Set<Uuid>(delta.pcbView.viasAdded);
  for (const id of delta.pcbView.viasRemoved) {
    if (!viasAdded.has(id)) scene.remove(id);
  }
  for (const id of viasAdded) {
    const via = view.vias.get(id);
    if (via) scene.update(buildViaNode(id, via));
    else scene.remove(id);
  }
}
