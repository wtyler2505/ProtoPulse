import { compareFindings } from '@protopulse/erc';
import { netOfPort } from '@protopulse/graph';
import Flatbush from 'flatbush';
import polygonClipping from 'polygon-clipping';

import {
  inflateAabb,
  rectAabb,
  rectRectDistance,
  segAabb,
  segRectDistance,
  segSegDistance,
} from './geom.js';

import type { Aabb, Rect } from './geom.js';
import type { Deck, DeckRules } from '@protopulse/content';
import type { Anchor, Finding } from '@protopulse/erc';
import type { DesignGraph, Trace, Uuid, Vec, Via } from '@protopulse/graph';
import type { PartDb } from '@protopulse/parts';

/**
 * The DRC engine: pure function (graph, parts, deck) → findings, in the
 * deterministic (severity, code, anchors) order ERC established.
 *
 * Copper model and its documented approximations:
 * - Traces are capsules (segments with radius widthNm/2); vias and
 *   circle pads are zero-length capsules; rect pads are axis-aligned
 *   rectangles. No pours, no polygons, no net ties.
 * - Footprint pads come from `Part.footprint` transformed by the
 *   placement's at/rotMilli. Only quarter-turn rotations (0/90/180/270
 *   degrees) are supported — anything else is DRC-UNSUPPORTED-ROTATION
 *   and that footprint's pads are skipped. Bottom-side placements are
 *   not mirrored.
 * - SMD pads sit on the layer of their placement side (top → "F.Cu",
 *   bottom → "B.Cu" — the layer ids the route_trace/place_via ops use);
 *   through-hole pads (drillNm) and vias span both copper layers.
 * - Connectivity (DRC-UNROUTED) is copper-overlap: two same-net items
 *   connect iff they share a layer and their shapes touch (gap ≤ 0,
 *   i.e. within trace-width/2 + pad half-size of each other). Pads from
 *   unplaced components or parts without footprints don't exist yet and
 *   are therefore not demanded.
 */

export const TOP_LAYER = 'F.Cu';
export const BOTTOM_LAYER = 'B.Cu';

const QUARTER_TURNS_MILLI = new Set([0, 90_000, 180_000, 270_000]);

type Shape =
  | { kind: 'capsule'; a: Vec; b: Vec; r: number }
  | { kind: 'rect'; rect: Rect };

interface CopperItem {
  kind: 'trace' | 'pad' | 'via';
  /** Pads on no net carry null — they still demand clearance. */
  netId: Uuid | null;
  layers: string[];
  shape: Shape;
  /** Human label for messages ("trace t1", "R1:1", "via v1"). */
  label: string;
  /** Same-group items are pre-connected (all segments of one trace). */
  groupKey: string;
}

interface DrcCtx {
  graph: DesignGraph;
  deck: Deck;
  items: CopperItem[];
}

function netAnchor(netId: Uuid): Anchor {
  return { kind: 'net', netId };
}

function ruleFor(ctx: DrcCtx, netId: Uuid | null, rule: keyof DeckRules): number {
  const netClass = netId === null ? undefined : ctx.graph.nets.get(netId)?.netClass;
  const override = netClass === undefined ? undefined : ctx.deck.classOverrides[netClass]?.[rule];
  return override ?? ctx.deck.rules[rule];
}

function rotateQuarter(v: Vec, rotMilli: number): Vec {
  switch (rotMilli) {
    case 90_000:
      return { x: -v.y, y: v.x };
    case 180_000:
      return { x: -v.x, y: -v.y };
    case 270_000:
      return { x: v.y, y: -v.x };
    default:
      return { ...v };
  }
}

function shapeAabb(shape: Shape): Aabb {
  if (shape.kind === 'rect') return rectAabb(shape.rect);
  const box = segAabb(shape.a, shape.b);
  return inflateAabb(box, shape.r);
}

/** Copper-to-copper gap; ≤ 0 means the shapes touch or overlap. */
function copperGap(a: Shape, b: Shape): number {
  if (a.kind === 'capsule' && b.kind === 'capsule') {
    return segSegDistance(a.a, a.b, b.a, b.b) - a.r - b.r;
  }
  if (a.kind === 'capsule' && b.kind === 'rect') {
    return segRectDistance(a.a, a.b, b.rect) - a.r;
  }
  if (a.kind === 'rect' && b.kind === 'capsule') {
    return segRectDistance(b.a, b.b, a.rect) - b.r;
  }
  if (a.kind === 'rect' && b.kind === 'rect') {
    return rectRectDistance(a.rect, b.rect);
  }
  /* istanbul ignore next -- exhaustive */
  throw new Error('unreachable shape pair');
}

function sharedLayers(a: CopperItem, b: CopperItem): boolean {
  return a.layers.some((layer) => b.layers.includes(layer));
}

// ── Copper item construction ─────────────────────────────────────────

function traceItems(trace: Trace): CopperItem[] {
  const out: CopperItem[] = [];
  for (let i = 0; i + 1 < trace.path.length; i++) {
    const a = trace.path[i];
    const b = trace.path[i + 1];
    if (!a || !b) continue;
    out.push({
      kind: 'trace',
      netId: trace.netId,
      layers: [trace.layerId],
      shape: { kind: 'capsule', a: { ...a }, b: { ...b }, r: trace.widthNm / 2 },
      label: `trace ${trace.id}`,
      groupKey: `trace:${trace.id}`,
    });
  }
  return out;
}

function viaItem(via: Via): CopperItem {
  return {
    kind: 'via',
    netId: via.netId,
    layers: [via.span[0], via.span[1]],
    shape: { kind: 'capsule', a: { ...via.at }, b: { ...via.at }, r: via.padNm / 2 },
    label: `via ${via.id}`,
    groupKey: `via:${via.id}`,
  };
}

function buildItems(graph: DesignGraph, parts: PartDb): { items: CopperItem[]; findings: Finding[] } {
  const findings: Finding[] = [];
  const items: CopperItem[] = [];

  for (const trace of [...graph.pcb.traces.values()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    items.push(...traceItems(trace));
  }
  for (const via of [...graph.pcb.vias.values()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    items.push(viaItem(via));
  }

  const placedIds = [...graph.pcb.placements.keys()].sort();
  for (const componentId of placedIds) {
    const placement = graph.pcb.placements.get(componentId);
    const comp = graph.components.get(componentId);
    if (!placement || !comp) continue;
    const footprint = parts.get(comp.partId, comp.partRev)?.footprint;
    if (!footprint) continue; // no land pattern yet — nothing to check
    if (!QUARTER_TURNS_MILLI.has(placement.rotMilli)) {
      findings.push({
        severity: 'warn',
        code: 'DRC-UNSUPPORTED-ROTATION',
        message: `${comp.ref}: footprint rotation ${String(placement.rotMilli)} millidegrees is not a quarter turn — pads skipped by DRC`,
        anchors: [{ kind: 'component', componentId }],
      });
      continue;
    }
    const sideLayer = placement.side === 'top' ? TOP_LAYER : BOTTOM_LAYER;
    for (const pad of footprint.pads) {
      const rotated = rotateQuarter(pad.at, placement.rotMilli);
      const at: Vec = { x: placement.at.x + rotated.x, y: placement.at.y + rotated.y };
      const quarter = placement.rotMilli === 90_000 || placement.rotMilli === 270_000;
      const wNm = quarter ? pad.hNm : pad.wNm;
      const hNm = quarter ? pad.wNm : pad.hNm;
      const shape: Shape =
        pad.shape === 'circle'
          ? { kind: 'capsule', a: at, b: at, r: wNm / 2 }
          : { kind: 'rect', rect: { at, wNm, hNm } };
      const port = `${componentId}:${pad.pinKey}`;
      items.push({
        kind: 'pad',
        netId: netOfPort(graph, port)?.id ?? null,
        layers: pad.drillNm !== undefined ? [TOP_LAYER, BOTTOM_LAYER] : [sideLayer],
        shape,
        label: `${comp.ref}:${pad.pinKey}`,
        groupKey: `pad:${port}`,
      });
    }
  }
  return { items, findings };
}

// ── Rules ────────────────────────────────────────────────────────────

function ruleTraceWidth(ctx: DrcCtx): Finding[] {
  const out: Finding[] = [];
  for (const trace of [...ctx.graph.pcb.traces.values()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const min = ruleFor(ctx, trace.netId, 'min_trace_nm');
    if (trace.widthNm < min) {
      const net = ctx.graph.nets.get(trace.netId);
      out.push({
        severity: 'error',
        code: 'DRC-TRACE-WIDTH',
        message: `Trace ${trace.id} on net ${net?.name ?? trace.netId} is ${String(trace.widthNm)}nm wide — the deck minimum is ${String(min)}nm`,
        anchors: [netAnchor(trace.netId)],
      });
    }
  }
  return out;
}

function ruleViaGeometry(ctx: DrcCtx): Finding[] {
  const out: Finding[] = [];
  for (const via of [...ctx.graph.pcb.vias.values()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const minDrill = ruleFor(ctx, via.netId, 'min_drill_nm');
    if (via.drillNm < minDrill) {
      out.push({
        severity: 'error',
        code: 'DRC-DRILL',
        message: `Via ${via.id} drill ${String(via.drillNm)}nm is under the deck minimum ${String(minDrill)}nm`,
        anchors: [netAnchor(via.netId)],
      });
    }
    const ring = (via.padNm - via.drillNm) / 2;
    const minAnnular = ruleFor(ctx, via.netId, 'min_annular_nm');
    if (ring < minAnnular) {
      out.push({
        severity: 'error',
        code: 'DRC-ANNULAR',
        message: `Via ${via.id} annular ring ${String(ring)}nm is under the deck minimum ${String(minAnnular)}nm`,
        anchors: [netAnchor(via.netId)],
      });
    }
  }
  return out;
}

function ruleClearance(ctx: DrcCtx): Finding[] {
  const out: Finding[] = [];
  if (ctx.items.length === 0) return out;
  const boxes = ctx.items.map((item) => shapeAabb(item.shape));
  const index = new Flatbush(ctx.items.length);
  for (const box of boxes) index.add(box.minX, box.minY, box.maxX, box.maxY);
  index.finish();

  // The broad phase inflates by the largest clearance any class demands.
  const maxClearance = Math.max(
    ctx.deck.rules.min_clearance_nm,
    ...Object.values(ctx.deck.classOverrides).map((o) => o.min_clearance_nm ?? 0),
  );

  for (let i = 0; i < ctx.items.length; i++) {
    const a = ctx.items[i];
    const box = boxes[i];
    if (!a || !box) continue;
    const query = inflateAabb(box, maxClearance);
    for (const j of index.search(query.minX, query.minY, query.maxX, query.maxY)) {
      if (j <= i) continue;
      const b = ctx.items[j];
      if (!b) continue;
      if (a.netId !== null && a.netId === b.netId) continue; // same copper
      if (a.netId === null && b.netId === null) continue; // two floating pads — no claim
      if (!sharedLayers(a, b)) continue;
      const required = Math.max(
        ruleFor(ctx, a.netId, 'min_clearance_nm'),
        ruleFor(ctx, b.netId, 'min_clearance_nm'),
      );
      const gap = copperGap(a.shape, b.shape);
      if (gap >= required) continue;
      const anchors: Anchor[] = [];
      if (a.netId !== null) anchors.push(netAnchor(a.netId));
      if (b.netId !== null) anchors.push(netAnchor(b.netId));
      out.push({
        severity: 'error',
        code: 'DRC-CLEARANCE',
        message: `Copper gap ${String(Math.max(0, Math.round(gap)))}nm between ${a.label} and ${b.label} is under the required ${String(required)}nm`,
        anchors,
      });
    }
  }
  return out;
}

/**
 * Union-find connectivity over same-net copper. A net with ≥2 pads must
 * have every pad in one connected copper component.
 */
function ruleUnrouted(ctx: DrcCtx): Finding[] {
  const out: Finding[] = [];
  const byNet = new Map<Uuid, CopperItem[]>();
  for (const item of ctx.items) {
    if (item.netId === null) continue;
    const list = byNet.get(item.netId) ?? [];
    list.push(item);
    byNet.set(item.netId, list);
  }
  for (const netId of [...byNet.keys()].sort()) {
    const items = byNet.get(netId) ?? [];
    const pads = items.filter((it) => it.kind === 'pad');
    if (pads.length < 2) continue;

    const parent = items.map((_, i) => i);
    const find = (i: number): number => {
      let root = i;
      while (parent[root] !== undefined && parent[root] !== root) root = parent[root] ?? root;
      parent[i] = root;
      return root;
    };
    const union = (i: number, j: number): void => {
      parent[find(i)] = find(j);
    };
    // Segments of one trace (and items sharing a group) are pre-joined.
    const groupFirst = new Map<string, number>();
    items.forEach((item, i) => {
      const first = groupFirst.get(item.groupKey);
      if (first === undefined) groupFirst.set(item.groupKey, i);
      else union(i, first);
    });
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        if (!a || !b || !sharedLayers(a, b)) continue;
        if (copperGap(a.shape, b.shape) <= 0) union(i, j);
      }
    }
    const padRoots = new Set(pads.map((pad) => find(items.indexOf(pad))));
    if (padRoots.size > 1) {
      const net = ctx.graph.nets.get(netId);
      out.push({
        severity: 'error',
        code: 'DRC-UNROUTED',
        message: `Net ${net?.name ?? netId}: ${String(pads.length)} pads sit in ${String(padRoots.size)} disconnected copper islands (${pads.map((p) => p.label).join(', ')})`,
        anchors: [netAnchor(netId)],
      });
    }
  }
  return out;
}

// ── Entry point ──────────────────────────────────────────────────────

function orient(a: Vec, b: Vec, c: Vec): number {
  return Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
}

/** Proper segment intersection (touching counts). */
function segsIntersect(a: Vec, b: Vec, c: Vec, d: Vec): boolean {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  return o1 !== o2 && o3 !== o4;
}

/** Ray-cast point-in-polygon (outline implicitly closed). */
function pointInPolygon(p: Vec, ring: readonly Vec[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (!a || !b) continue;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Zones: (1) two zones of DIFFERENT nets overlapping on one layer is an
 * ERROR — zones do not carve each other (pours treat only traces/vias/
 * pads as keep-outs), so overlapping outlines pour overlapping copper:
 * a short at fab. (2) A zone with no same-net pad, via, or trace vertex
 * inside its outline pours isolated copper — WARN.
 */
function ruleZones(ctx: DrcCtx): Finding[] {
  const out: Finding[] = [];
  const zones = [...ctx.graph.pcb.zones.values()].sort((a, b) => (a.id < b.id ? -1 : 1));

  for (let i = 0; i < zones.length; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      const a = zones[i];
      const b = zones[j];
      if (!a || a.layerId !== b?.layerId || a.netId === b.netId) continue;
      const overlap = polygonClipping.intersection(
        [[a.outline.map((v) => [v.x, v.y] as [number, number])]],
        [[b.outline.map((v) => [v.x, v.y] as [number, number])]],
      );
      if (overlap.length === 0) continue;
      out.push({
        severity: 'error',
        code: 'DRC-ZONE-OVERLAP',
        message: `Zones ${a.id} (${ctx.graph.nets.get(a.netId)?.name ?? a.netId}) and ${b.id} (${ctx.graph.nets.get(b.netId)?.name ?? b.netId}) overlap on ${a.layerId} — their pours would short`,
        anchors: [netAnchor(a.netId), netAnchor(b.netId)],
      });
    }
  }

  for (const zone of zones) {
    let connected = false;
    for (const item of ctx.items) {
      if (item.netId !== zone.netId || !item.layers.includes(zone.layerId)) continue;
      // Inside by any endpoint/center, or a capsule crossing the outline.
      const pts =
        item.shape.kind === 'rect' ? [item.shape.rect.at] : [item.shape.a, item.shape.b];
      let touches = pts.some((pt) => pointInPolygon(pt, zone.outline));
      if (!touches && item.shape.kind === 'capsule') {
        const ring = zone.outline;
        for (let k = 0; k < ring.length && !touches; k++) {
          const e0 = ring[k];
          const e1 = ring[(k + 1) % ring.length];
          if (e0 && e1 && segsIntersect(item.shape.a, item.shape.b, e0, e1)) touches = true;
        }
      }
      if (touches) {
        connected = true;
        break;
      }
    }
    if (!connected) {
      out.push({
        severity: 'warn',
        code: 'DRC-ZONE-ISOLATED',
        message: `Zone ${zone.id} (${ctx.graph.nets.get(zone.netId)?.name ?? zone.netId}) contains no copper of its own net — it pours an island`,
        anchors: [netAnchor(zone.netId)],
      });
    }
  }
  return out;
}

/** Copper must stay copper_to_edge_nm away from the board outline.
 *  Runs only when an outline exists — a design without one is still at
 *  the schematic stage, not in violation. Two tests per copper item: a
 *  representative point must be INSIDE the outline at all, and the
 *  shape must keep the deck's distance from every outline edge. */
function ruleEdgeClearance(ctx: DrcCtx): Finding[] {
  const outline = ctx.graph.pcb.outline;
  if (!outline || outline.length < 3) return [];
  const out: Finding[] = [];
  const edges: { a: Vec; b: Vec }[] = outline.map((a, i) => ({
    a,
    b: outline[(i + 1) % outline.length] ?? a,
  }));
  for (const item of ctx.items) {
    const min = ruleFor(ctx, item.netId, 'copper_to_edge_nm');
    const center =
      item.shape.kind === 'rect'
        ? item.shape.rect.at
        : {
            x: (item.shape.a.x + item.shape.b.x) / 2,
            y: (item.shape.a.y + item.shape.b.y) / 2,
          };
    if (!pointInPolygon(center, outline)) {
      out.push({
        severity: 'error',
        code: 'DRC-EDGE-CLEARANCE',
        message: `${item.label} sits OUTSIDE the board outline`,
        anchors: item.netId === null ? [] : [netAnchor(item.netId)],
      });
      continue;
    }
    for (const edge of edges) {
      const gap = copperGap(item.shape, { kind: 'capsule', a: edge.a, b: edge.b, r: 0 });
      if (gap < min) {
        // One finding per item — the nearest-edge detail isn't worth N dupes.
        out.push({
          severity: 'error',
          code: 'DRC-EDGE-CLEARANCE',
          message: `${item.label} is ${String(Math.max(0, Math.round(gap)))}nm from the board edge — the deck requires ${String(min)}nm`,
          anchors: item.netId === null ? [] : [netAnchor(item.netId)],
        });
        break;
      }
    }
  }
  return out;
}

const RULES: ((ctx: DrcCtx) => Finding[])[] = [
  ruleTraceWidth,
  ruleViaGeometry,
  ruleClearance,
  ruleUnrouted,
  ruleZones,
  ruleEdgeClearance,
];

export function runDrc(graph: DesignGraph, parts: PartDb, deck: Deck): Finding[] {
  const { items, findings } = buildItems(graph, parts);
  const ctx: DrcCtx = { graph, deck, items };
  for (const rule of RULES) findings.push(...rule(ctx));
  return findings.sort(compareFindings);
}
