import { SceneGraph } from './scene.js';
import { boundsOfLines, CIRCLE_SEGMENTS } from './tessellate.js';

import type { RGBA, SceneNode } from './scene.js';
import type { Bounds, TessText } from './tessellate.js';
import type { Component, DesignGraph, Uuid, Vec } from '@protopulse/graph';
import type { Part, PartDb } from '@protopulse/parts';

/**
 * PCB scene support (v0.4) — buildPcbScene/syncPcbScene turn the graph's
 * pcb view into SceneGraph nodes the existing GL layer can draw:
 *
 *   footprint — courtyard outline + each pad as a line-loop outline with
 *               an X through it (the GL layer only draws lines today;
 *               filled pads are an honest cut),
 *   trace     — one polyline per trace (stroke width is NOT drawn; the
 *               app surfaces widthNm in the readout — honest cut),
 *   via       — two concentric circle loops (pad ring + drill).
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

/**
 * One pad: outline (rect loop or circle loop) + an X through it. Filled
 * shapes need a triangle pipeline the GL layer doesn't have yet — the
 * X marks the pad as "solid" until then (honest cut).
 */
export function tessellatePad(pad: PcbPadSpec, placement: PcbPlacementLike): number[] {
  const lines: number[] = [];
  const hw = Math.round(pad.wNm / 2);
  const hh = Math.round(pad.hNm / 2);
  if (pad.shape === 'rect') {
    const corners = [
      { x: pad.at.x - hw, y: pad.at.y - hh },
      { x: pad.at.x + hw, y: pad.at.y - hh },
      { x: pad.at.x + hw, y: pad.at.y + hh },
      { x: pad.at.x - hw, y: pad.at.y + hh },
    ].map((c) => applyPcbPlacement(c, placement));
    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      if (a && b) pushLine(lines, a, b);
    }
    const c0 = corners[0];
    const c1 = corners[1];
    const c2 = corners[2];
    const c3 = corners[3];
    if (c0 && c2) pushLine(lines, c0, c2);
    if (c1 && c3) pushLine(lines, c1, c3);
  } else {
    const r = hw; // wNm is the circle pad's diameter
    const center = applyPcbPlacement(pad.at, placement);
    circleLoop(lines, center, r);
    const k = Math.round(r * Math.SQRT1_2);
    pushLine(
      lines,
      { x: center.x - k, y: center.y - k },
      { x: center.x + k, y: center.y + k },
    );
    pushLine(
      lines,
      { x: center.x - k, y: center.y + k },
      { x: center.x + k, y: center.y - k },
    );
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

/** Build the retained node for one placed footprint. */
export function buildFootprintNode(
  component: Component,
  footprint: PcbFootprintSpec,
  placement: PcbPlacementLike,
): SceneNode {
  const lines = tessellateFootprint(footprint, placement);
  const body: Bounds = boundsOfLines(lines) ?? {
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
    texts,
    bounds: { ...body, maxY: body.maxY + LABEL_GAP_NM + LABEL_SIZE_NM * 2 },
    color: PCB_LAYER_COLORS[placement.side === 'bottom' ? 'B.Cu' : 'F.Cu'],
  };
}

/**
 * Build the retained node for one trace: a single polyline along the
 * path centerline. Stroke width is not rendered (honest cut) — the app
 * shows widthNm in the status readout instead.
 */
export function buildTraceNode(traceId: Uuid, trace: PcbTraceLike): SceneNode {
  const lines: number[] = [];
  for (let i = 0; i + 1 < trace.path.length; i++) {
    const a = trace.path[i];
    const b = trace.path[i + 1];
    if (a && b) pushLine(lines, a, b);
  }
  return {
    id: traceId,
    kind: 'trace',
    lines: Float32Array.from(lines),
    texts: [],
    bounds: boundsOfLines(lines) ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 },
    color: layerColor(trace.layerId),
  };
}

/** Build the retained node for one via: pad ring + drill loops. */
export function buildViaNode(viaId: Uuid, via: PcbViaLike): SceneNode {
  const lines: number[] = [];
  circleLoop(lines, via.at, Math.round(via.padNm / 2));
  circleLoop(lines, via.at, Math.round(via.drillNm / 2));
  return {
    id: viaId,
    kind: 'via',
    lines: Float32Array.from(lines),
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
 * Re-sync a PCB scene in place after a graph change. Full rebuild —
 * no incremental pcb delta yet (honest cut; pcb designs at this scale
 * re-tessellate in microseconds). Object identity is NOT preserved.
 */
export function syncPcbScene(scene: SceneGraph, graph: DesignGraph, parts: PartDb): void {
  const fresh = buildPcbNodes(graph, parts);
  const keep = new Set(fresh.map((n) => n.id));
  for (const id of [...scene.nodes.keys()]) {
    if (!keep.has(id)) scene.remove(id);
  }
  for (const node of fresh) scene.update(node);
}
