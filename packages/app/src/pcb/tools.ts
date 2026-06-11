import { makePortRef, netOfPort, newUuid } from '@protopulse/graph';
import { tessellateFootprint } from '@protopulse/renderer';
import { buildObstacleSet, planShove, routeHead } from '@protopulse/route';

import {
  DEFAULT_VIA_DRILL_NM,
  DEFAULT_VIA_PAD_NM,
  PCB_SNAP_NM,
  VIA_SPAN
} from './types.js';

import type { PcbOpBody } from './types.js';
import type { DesignGraph, PortRef, Uuid, Vec } from '@protopulse/graph';
import type {
  PcbFootprintSpec,
  PcbPlacementLike,
  PcbViewLike,
  PickHit,
} from '@protopulse/renderer';
import type { FootprintSource } from '@protopulse/route';

/**
 * PCB editor tool state machines — pure logic, no DOM, unit-tested in
 * node (graph pcb state is mocked; the ops are the pinned v0.4
 * contract). CanvasHost feeds world-space pointer events; tools answer
 * with ops, selection, ghost preview lines, and status flashes.
 */

/** Generic pick tolerance on the board (0.25mm). */
export const PCB_PICK_TOLERANCE_NM = PCB_SNAP_NM;
/** Extra slop around a pad's own extents when pad-snapping. */
export const PAD_PICK_SLOP_NM = 150_000;

/** Anything with footprint geometry per (partId, rev) — PartDb fits. */
export interface PadSource {
  get(partId: string, rev: number): { footprint?: PcbFootprintSpec } | undefined;
}

export interface PcbToolEnv {
  graph: DesignGraph;
  /** Normalized pcb view (renderer's pcbViewOf). */
  view: PcbViewLike;
  parts: PadSource;
  pick: (pt: Vec, toleranceNm: number) => PickHit[];
  /** Where the trace tool routes. */
  activeLayer: 'F.Cu' | 'B.Cu';
  traceWidthNm: number;
  /** Trace tool routing mode (manual / walkaround / shove). */
  traceMode: 'manual' | 'walk' | 'shove';
  /** Deck min_clearance for walk/shove, or null while the deck loads. */
  clearanceNm: number | null;
}

export interface PcbToolResult {
  ops?: PcbOpBody[];
  opsLabel?: string;
  selection?: string[];
  /** Ghost preview lines, world nm. undefined = unchanged, null = clear. */
  ghost?: Float32Array | null;
  /** One-line status-bar flash (refusals, guidance). */
  status?: string;
  /** Host should fall back to the select tool (e.g. after placing). */
  resetTool?: boolean;
}

// ── Shared helpers ───────────────────────────────────────────────────

export function snapPcb(v: Vec, grid: number = PCB_SNAP_NM): Vec {
  // `|| 0` normalizes -0 (Math.round(-0.2) === -0) — keeps op payloads
  // byte-identical for diffing.
  return {
    x: Math.round(v.x / grid) * grid || 0,
    y: Math.round(v.y / grid) * grid || 0,
  };
}

/**
 * Orthogonal-or-45° two-segment route: diagonal leg first (45°), then
 * the axis-aligned remainder. Already-aligned endpoints get one segment.
 */
export function octilinearPath(a: Vec, b: Vec): Vec[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return [{ ...a }];
  if (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)) return [{ ...a }, { ...b }];
  const d = Math.min(Math.abs(dx), Math.abs(dy));
  const corner = { x: a.x + Math.sign(dx) * d, y: a.y + Math.sign(dy) * d };
  return [{ ...a }, corner, { ...b }];
}

/** Drop consecutive duplicate points. */
export function dedupePath(points: readonly Vec[]): Vec[] {
  const out: Vec[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last?.x === p.x && last.y === p.y) continue;
    out.push({ ...p });
  }
  return out;
}

export function footprintOf(
  graph: DesignGraph,
  parts: PadSource,
  componentId: Uuid,
): PcbFootprintSpec | null {
  const comp = graph.components.get(componentId);
  if (!comp) return null;
  return parts.get(comp.partId, comp.partRev)?.footprint ?? null;
}

export interface PadHit {
  componentId: Uuid;
  pinKey: string;
  port: PortRef;
  /** Pad center, world nm. */
  at: Vec;
  /** Net the pad belongs to, or null when unwired. */
  netId: Uuid | null;
}

/** Closest pad under the point, across all placed footprints. */
export function findPadAt(
  graph: DesignGraph,
  view: PcbViewLike,
  parts: PadSource,
  pt: Vec,
  slopNm: number = PAD_PICK_SLOP_NM,
): PadHit | null {
  let best: PadHit | null = null;
  let bestDistSq = Infinity;
  for (const [componentId, placement] of view.placements) {
    const footprint = footprintOf(graph, parts, componentId);
    if (!footprint) continue;
    for (const pad of footprint.pads) {
      const at = padWorld(pad.at, placement);
      const reach = Math.max(pad.wNm, pad.hNm) / 2 + slopNm;
      const dx = at.x - pt.x;
      const dy = at.y - pt.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= reach * reach && distSq < bestDistSq) {
        bestDistSq = distSq;
        const port = makePortRef(componentId, pad.pinKey);
        best = {
          componentId,
          pinKey: pad.pinKey,
          port,
          at,
          netId: netOfPort(graph, port)?.id ?? null,
        };
      }
    }
  }
  return best;
}

/** Local copy of the renderer transform (mirror-then-rotate-then-move). */
function padWorld(p: Vec, placement: PcbPlacementLike): Vec {
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

function ghostFromPoints(points: readonly Vec[]): Float32Array {
  const lines: number[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (a && b) lines.push(a.x, a.y, b.x, b.y);
  }
  return Float32Array.from(lines);
}

function footprintGhost(footprint: PcbFootprintSpec, placement: PcbPlacementLike): Float32Array {
  return Float32Array.from(tessellateFootprint(footprint, placement));
}

export interface PcbFlipResult {
  ops: PcbOpBody[];
  /** One-line status-bar announcement, or null when there is nothing to say. */
  status: string | null;
}

/**
 * Flip ops for a pcb selection: every selected, unlocked footprint
 * placement toggles side top<->bottom (position and rotation are kept).
 * Locked placements are skipped — the lock means "leave me alone" —
 * and traces/vias are side-less, so they are ignored.
 */
export function pcbFlipSelectionOps(
  graph: DesignGraph,
  view: PcbViewLike,
  selection: ReadonlySet<string>,
): PcbFlipResult {
  const ops: PcbOpBody[] = [];
  const flipped: { ref: string; side: 'top' | 'bottom' }[] = [];
  let lockedCount = 0;
  for (const id of [...selection].sort()) {
    const placement = view.placements.get(id);
    if (!placement) continue;
    if (placement.locked) {
      lockedCount++;
      continue;
    }
    const side = placement.side === 'top' ? 'bottom' : 'top';
    ops.push({
      kind: 'move_footprint',
      componentId: id,
      at: { ...placement.at },
      rotMilli: placement.rotMilli,
      side,
      locked: placement.locked,
    });
    flipped.push({ ref: graph.components.get(id)?.ref ?? id, side });
  }
  let status: string | null = null;
  const first = flipped[0];
  if (flipped.length === 1 && first) {
    status = `Flipped ${first.ref} to the ${first.side === 'bottom' ? 'bottom (B.Cu)' : 'top (F.Cu)'}.`;
  } else if (flipped.length > 1) {
    status = `Flipped ${String(flipped.length)} footprints.`;
  } else if (lockedCount > 0) {
    status =
      lockedCount === 1
        ? 'That footprint is locked — unlock it to flip it.'
        : 'Those footprints are locked — unlock them to flip.';
  }
  return { ops, status };
}

/**
 * Delete ops for a pcb selection: placements unplace (locked ones are
 * skipped — the lock means "leave me alone"), traces and vias remove.
 */
export function pcbDeleteSelectionOps(
  view: PcbViewLike,
  selection: ReadonlySet<string>,
): PcbOpBody[] {
  const ops: PcbOpBody[] = [];
  for (const id of selection) {
    const placement = view.placements.get(id);
    if (placement) {
      if (!placement.locked) ops.push({ kind: 'unplace_footprint', componentId: id });
    } else if (view.traces.has(id)) {
      ops.push({ kind: 'remove_trace', id });
    } else if (view.vias.has(id)) {
      ops.push({ kind: 'remove_via', id });
    } else if (view.zones?.has(id)) {
      ops.push({ kind: 'remove_zone', id });
    }
  }
  return ops;
}

// ── Select tool (click select, drag to move footprints) ──────────────

interface PcbDragState {
  id: Uuid;
  placement: PcbPlacementLike;
  start: Vec;
  current: Vec;
}

export class PcbSelectTool {
  readonly kind = 'pcb-select';
  private drag: PcbDragState | null = null;

  pointerDown(pt: Vec, env: PcbToolEnv): PcbToolResult {
    const hit = env.pick(pt, PCB_PICK_TOLERANCE_NM)[0];
    if (!hit) return { selection: [] };
    if (hit.kind === 'footprint') {
      const placement = env.view.placements.get(hit.id);
      if (placement?.locked) {
        return { selection: [hit.id], status: `${hit.id} is locked — unlock it to move it.` };
      }
      if (placement) this.drag = { id: hit.id, placement, start: pt, current: pt };
    }
    return { selection: [hit.id] };
  }

  pointerMove(pt: Vec, env: PcbToolEnv): PcbToolResult {
    if (!this.drag) return {};
    this.drag.current = pt;
    const footprint = footprintOf(env.graph, env.parts, this.drag.id);
    if (!footprint) return {};
    const target = dragTarget(this.drag);
    return { ghost: footprintGhost(footprint, { ...this.drag.placement, at: target }) };
  }

  pointerUp(pt: Vec, _env: PcbToolEnv): PcbToolResult {
    const d = this.drag;
    if (!d) return {};
    this.drag = null;
    d.current = pt;
    const target = dragTarget(d);
    if (target.x === d.placement.at.x && target.y === d.placement.at.y) return { ghost: null };
    return {
      ghost: null,
      ops: [
        {
          kind: 'move_footprint',
          componentId: d.id,
          at: target,
          rotMilli: d.placement.rotMilli,
          side: d.placement.side,
          locked: d.placement.locked,
        },
      ],
      opsLabel: 'move footprint',
    };
  }

  cancel(): PcbToolResult {
    this.drag = null;
    return { ghost: null };
  }
}

function dragTarget(d: PcbDragState): Vec {
  return snapPcb({
    x: d.placement.at.x + (d.current.x - d.start.x),
    y: d.placement.at.y + (d.current.y - d.start.y),
  });
}

// ── Place tool (armed from the unplaced tray; R rotates the ghost) ───

export class PcbPlaceTool {
  readonly kind = 'pcb-place';
  private rotMilli = 0;
  private lastPt: Vec | null = null;

  constructor(
    readonly componentId: Uuid,
    private readonly makeId: () => Uuid = newUuid,
  ) {}

  get rotation(): number {
    return this.rotMilli;
  }

  /** R key: next 90° step CCW; refreshes the ghost in place. */
  rotate(env: PcbToolEnv): PcbToolResult {
    this.rotMilli = (this.rotMilli + 90_000) % 360_000;
    if (!this.lastPt) return {};
    return this.pointerMove(this.lastPt, env);
  }

  pointerDown(pt: Vec, env: PcbToolEnv): PcbToolResult {
    const footprint = footprintOf(env.graph, env.parts, this.componentId);
    if (!footprint) {
      return { status: 'This part has no footprint yet — it cannot go on the board.', resetTool: true };
    }
    return {
      ops: [
        {
          kind: 'place_footprint',
          componentId: this.componentId,
          at: snapPcb(pt),
          rotMilli: this.rotMilli,
          side: 'top',
          locked: false,
        },
      ],
      opsLabel: 'place footprint',
      selection: [this.componentId],
      ghost: null,
      resetTool: true,
    };
  }

  pointerMove(pt: Vec, env: PcbToolEnv): PcbToolResult {
    this.lastPt = pt;
    const footprint = footprintOf(env.graph, env.parts, this.componentId);
    if (!footprint) return {};
    return {
      ghost: footprintGhost(footprint, {
        at: snapPcb(pt),
        rotMilli: this.rotMilli,
        side: 'top',
        locked: false,
      }),
    };
  }

  pointerUp(): PcbToolResult {
    return {};
  }

  cancel(): PcbToolResult {
    return { ghost: null };
  }
}

// ── Trace tool ───────────────────────────────────────────────────────

/** Batch label for shove commits — spring-back keys on it. */
export const SHOVE_LABEL = 'shove';

export type TraceEndpoint =
  | { kind: 'pad'; at: Vec; netId: Uuid | null; port: PortRef }
  | { kind: 'trace'; at: Vec; netId: Uuid; traceId: Uuid };

/** Pad first; else a routed trace segment; else nothing. */
export function resolveTraceEndpoint(pt: Vec, env: PcbToolEnv): TraceEndpoint | null {
  const pad = findPadAt(env.graph, env.view, env.parts, pt);
  if (pad) return { kind: 'pad', at: pad.at, netId: pad.netId, port: pad.port };
  const hit = env.pick(pt, PCB_PICK_TOLERANCE_NM).find((h) => h.kind === 'trace');
  if (hit) {
    const trace = env.view.traces.get(hit.id);
    if (trace) return { kind: 'trace', at: snapPcb(pt), netId: trace.netId, traceId: hit.id };
  }
  return null;
}

export class PcbTraceTool {
  readonly kind = 'pcb-trace';
  private netId: Uuid | null = null;
  private points: Vec[] = [];

  constructor(private readonly makeId: () => Uuid = newUuid) {}

  get routing(): boolean {
    return this.netId !== null;
  }

  /** One leg from `last` to `target` in the active mode. Walk mode
   *  detours via the walkaround engine; manual and shove draw straight
   *  octilinear (shove resolves at commit). String = refusal flash. */
  private planLeg(last: Vec, target: Vec, env: PcbToolEnv, netId: Uuid): Vec[] | string {
    if (env.traceMode !== 'walk') return octilinearPath(last, target);
    if (env.clearanceNm === null) {
      return 'Rule deck still loading — walk mode needs its clearance. Try again in a second.';
    }
    const set = buildObstacleSet(env.graph, env.parts as unknown as FootprintSource, {
      layerId: env.activeLayer,
      clearanceNm: env.clearanceNm,
      widthNm: env.traceWidthNm,
      netId,
    });
    const r = routeHead(last, target, set);
    if (r.blocked) {
      return 'Walkaround found no clear corridor — try another way, or shove mode.';
    }
    return r.path;
  }

  pointerDown(pt: Vec, env: PcbToolEnv): PcbToolResult {
    const end = resolveTraceEndpoint(pt, env);

    if (this.netId === null) {
      // Start: only on a pad (or an existing trace) with a real net.
      if (!end) return { status: 'Traces start on a pad — click one.' };
      if (end.netId === null) {
        return { status: 'That pad has no net — wire it in the schematic first.' };
      }
      this.netId = end.netId;
      this.points = [end.at];
      return { ghost: null };
    }

    // Routing: pad/trace of the SAME net commits; cross-net refuses.
    if (end) {
      if (end.netId !== null && end.netId !== this.netId) {
        const want = env.graph.nets.get(this.netId)?.name ?? this.netId;
        const got = env.graph.nets.get(end.netId)?.name ?? end.netId;
        return { status: `Refused: that ${end.kind} is on net ${got}, this trace is on ${want}.` };
      }
      if (end.netId === null) {
        return { status: 'That pad has no net — traces only join pads of the same net.' };
      }
      const last = this.points[this.points.length - 1] ?? end.at;
      const netId = this.netId;
      const leg = this.planLeg(last, end.at, env, netId);
      if (typeof leg === 'string') return { status: leg };
      const path = dedupePath([...this.points, ...leg]);
      if (path.length < 2) {
        // Clicked the start pad again — nothing to commit.
        this.netId = null;
        this.points = [];
        return { ghost: null };
      }

      const newOp: PcbOpBody = {
        kind: 'route_trace',
        id: this.makeId(),
        netId,
        layerId: env.activeLayer,
        widthNm: env.traceWidthNm,
        path,
      };

      if (env.traceMode === 'shove') {
        if (env.clearanceNm === null) {
          return { status: 'Rule deck still loading — shove needs its clearance. Try again in a second.' };
        }
        const plan = planShove(path, env.graph, env.parts as unknown as FootprintSource, {
          layerId: env.activeLayer,
          clearanceNm: env.clearanceNm,
          widthNm: env.traceWidthNm,
          netId,
        });
        if (plan.kind === 'blocked') {
          // Keep the routing state — the user adjusts and tries again.
          return { status: `Shove refused: ${plan.reason}` };
        }
        if (plan.kind === 'shove') {
          const ops: PcbOpBody[] = [newOp];
          for (const r of plan.reroutes) {
            const victim = env.view.traces.get(r.traceId);
            if (!victim) continue; // unreachable — reroutes come from the graph
            ops.push(
              { kind: 'remove_trace', id: r.traceId },
              {
                kind: 'route_trace',
                id: r.traceId,
                netId: victim.netId,
                layerId: env.activeLayer,
                widthNm: victim.widthNm,
                path: r.path,
              },
            );
          }
          this.netId = null;
          this.points = [];
          return {
            ops,
            opsLabel: SHOVE_LABEL,
            status: `Shoved ${String(plan.reroutes.length)} trace(s) aside.`,
            ghost: null,
          };
        }
        // 'clear' falls through to the plain commit.
      }

      this.netId = null;
      this.points = [];
      return { ops: [newOp], opsLabel: 'route trace', ghost: null };
    }

    // Empty board: drop a waypoint and keep routing.
    const last = this.points[this.points.length - 1];
    if (last) {
      const leg = this.planLeg(last, snapPcb(pt), env, this.netId);
      if (typeof leg === 'string') return { status: leg };
      this.points = dedupePath([...this.points, ...leg]);
    }
    return {};
  }

  pointerMove(pt: Vec, env: PcbToolEnv): PcbToolResult {
    if (this.netId === null) return {};
    const end = resolveTraceEndpoint(pt, env);
    const target = end?.netId === this.netId ? end.at : snapPcb(pt);
    const last = this.points[this.points.length - 1];
    if (!last) return {};
    // Preview in the active mode; a blocked walk previews the straight
    // shot (the refusal flash fires on click, not per-move).
    const leg = this.planLeg(last, target, env, this.netId);
    const legPts = typeof leg === 'string' ? octilinearPath(last, target) : leg;
    return { ghost: ghostFromPoints([...this.points, ...legPts.slice(1)]) };
  }

  pointerUp(): PcbToolResult {
    return {};
  }

  cancel(): PcbToolResult {
    this.netId = null;
    this.points = [];
    return { ghost: null };
  }
}

// ── Via tool ─────────────────────────────────────────────────────────

export class PcbViaTool {
  readonly kind = 'pcb-via';

  constructor(private readonly makeId: () => Uuid = newUuid) {}

  pointerDown(pt: Vec, env: PcbToolEnv): PcbToolResult {
    const hit = env.pick(pt, PCB_PICK_TOLERANCE_NM).find((h) => h.kind === 'trace');
    const trace = hit ? env.view.traces.get(hit.id) : undefined;
    if (!trace) return { status: 'Vias go on a trace — click a routed trace.' };
    return {
      ops: [
        {
          kind: 'place_via',
          id: this.makeId(),
          netId: trace.netId,
          at: snapPcb(pt),
          drillNm: DEFAULT_VIA_DRILL_NM,
          padNm: DEFAULT_VIA_PAD_NM,
          span: [VIA_SPAN[0], VIA_SPAN[1]],
        },
      ],
      opsLabel: 'place via',
    };
  }

  pointerMove(): PcbToolResult {
    return {};
  }

  pointerUp(): PcbToolResult {
    return {};
  }

  cancel(): PcbToolResult {
    return { ghost: null };
  }
}

// ── Zone tool ────────────────────────────────────────────────────────

/**
 * Draw a copper zone: the FIRST click must land on a pad with a net
 * (the zone pours for that net — same seeding rule as the trace tool);
 * later clicks drop snapped corners; clicking the first corner again
 * (with ≥3 corners down) closes the polygon and commits place_zone.
 */
export class PcbZoneTool {
  readonly kind = 'pcb-zone';
  private netId: Uuid | null = null;
  private corners: Vec[] = [];

  constructor(private readonly makeId: () => Uuid = newUuid) {}

  get drawing(): boolean {
    return this.netId !== null;
  }

  pointerDown(pt: Vec, env: PcbToolEnv): PcbToolResult {
    if (this.netId === null) {
      const pad = findPadAt(env.graph, env.view, env.parts, pt);
      if (pad === null || pad.netId === null) {
        return { status: 'Zones pour for a net — start by clicking a pad on that net (GND, usually).' };
      }
      this.netId = pad.netId;
      this.corners = [snapPcb(pt)];
      const name = env.graph.nets.get(pad.netId)?.name ?? pad.netId;
      return { status: `Zone for net ${name} — click corners; click the first corner again to close.` };
    }

    const snapped = snapPcb(pt);
    const first = this.corners[0];
    const closing =
      this.corners.length >= 3 &&
      first !== undefined &&
      Math.abs(snapped.x - first.x) <= PCB_SNAP_NM &&
      Math.abs(snapped.y - first.y) <= PCB_SNAP_NM;
    if (closing) {
      const netId = this.netId;
      const outline = [...this.corners];
      this.netId = null;
      this.corners = [];
      return {
        ops: [{ kind: 'place_zone', id: this.makeId(), netId, layerId: env.activeLayer, outline }],
        opsLabel: 'place zone',
        ghost: null,
        resetTool: true,
      };
    }
    const last = this.corners[this.corners.length - 1];
    if (last?.x === snapped.x && last.y === snapped.y) return {};
    this.corners = [...this.corners, snapped];
    return {};
  }

  pointerMove(pt: Vec, _env: PcbToolEnv): PcbToolResult {
    if (this.netId === null) return {};
    const pts = [...this.corners, snapPcb(pt)];
    const lines: number[] = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      if (a && b) lines.push(a.x, a.y, b.x, b.y);
    }
    // Close-back preview to the first corner once a polygon is possible.
    const first = pts[0];
    const tail = pts[pts.length - 1];
    if (pts.length >= 3 && first && tail) lines.push(tail.x, tail.y, first.x, first.y);
    return { ghost: Float32Array.from(lines) };
  }

  pointerUp(): PcbToolResult {
    return {};
  }

  cancel(): PcbToolResult {
    this.netId = null;
    this.corners = [];
    return { ghost: null };
  }
}

export type PcbTool = PcbSelectTool | PcbPlaceTool | PcbTraceTool | PcbViaTool | PcbZoneTool;
