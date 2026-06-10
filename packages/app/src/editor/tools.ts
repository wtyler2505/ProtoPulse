import {
  netOfPort,
  newUuid,
  SCHEMATIC_GRID,
  makePortRef
  
  
  
  
  
  
  
} from '@protopulse/graph';
import { pinWorldPosition, tessellateSymbol  } from '@protopulse/renderer';

import type {DesignGraph, OpBody, PortRef, SymbolPlacement, Uuid, Vec, WireSegment} from '@protopulse/graph';
import type { Part, PartDb } from '@protopulse/parts';
import type {PickHit} from '@protopulse/renderer';

/**
 * Editor tool state machines — pure logic, no DOM, unit-tested in node.
 * CanvasHost feeds pointer events in world coordinates; tools answer
 * with ops to dispatch, selection changes, and ghost preview geometry.
 */

export const PICK_TOLERANCE_NM = Math.round(SCHEMATIC_GRID / 2);
/** Pin endpoints hit within ~half a grid unit. */
export const PIN_TOLERANCE_NM = Math.round(SCHEMATIC_GRID / 2);

export interface ToolEnv {
  graph: DesignGraph;
  parts: PartDb;
  selection: ReadonlySet<string>;
  pick: (pt: Vec, toleranceNm: number) => PickHit[];
  queryRect: (min: Vec, max: Vec) => string[];
}

export interface ToolResult {
  /** Ops to dispatch as one undo unit. */
  ops?: OpBody[];
  opsLabel?: string;
  /** Replacement selection (absent = unchanged). */
  selection?: string[];
  /** Ghost preview lines, world nm. undefined = unchanged, null = clear. */
  ghost?: Float32Array | null;
}

// ── Shared helpers ───────────────────────────────────────────────────

export function snapToGrid(v: Vec, grid: number = SCHEMATIC_GRID): Vec {
  return { x: Math.round(v.x / grid) * grid, y: Math.round(v.y / grid) * grid };
}

/** Next unused "R7"-style designator for a prefix. */
export function nextFreeRef(graph: DesignGraph, prefix: string): string {
  let max = 0;
  for (const comp of graph.components.values()) {
    if (!comp.ref.startsWith(prefix)) continue;
    const rest = comp.ref.slice(prefix.length);
    if (/^\d+$/.test(rest)) max = Math.max(max, Number.parseInt(rest, 10));
  }
  return `${prefix}${String(max + 1)}`;
}

/** Two-segment Manhattan L-path with the corner at (b.x, a.y). */
export function manhattanPath(a: Vec, b: Vec): WireSegment[] {
  if (a.x === b.x && a.y === b.y) return [];
  if (a.x === b.x || a.y === b.y) {
    return [{ a: { ...a }, b: { ...b } }];
  }
  const corner = { x: b.x, y: a.y };
  return [
    { a: { ...a }, b: { ...corner } },
    { a: { ...corner }, b: { ...b } },
  ];
}

export interface PinHit {
  port: PortRef;
  at: Vec;
}

/** Closest pin endpoint within tolerance, across all placed symbols. */
export function findPinAt(
  graph: DesignGraph,
  parts: PartDb,
  pt: Vec,
  toleranceNm: number = PIN_TOLERANCE_NM,
): PinHit | null {
  let best: PinHit | null = null;
  let bestDistSq = Infinity;
  const tolSq = toleranceNm * toleranceNm;
  for (const [componentId, placement] of graph.schematic.placements) {
    const comp = graph.components.get(componentId);
    if (!comp) continue;
    const part = parts.get(comp.partId, comp.partRev);
    if (!part) continue;
    for (const pin of part.symbol.pins) {
      const at = pinWorldPosition(part, placement, pin.key);
      const dx = at.x - pt.x;
      const dy = at.y - pt.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= tolSq && distSq < bestDistSq) {
        bestDistSq = distSq;
        best = { port: makePortRef(componentId, pin.key), at };
      }
    }
  }
  return best;
}

function cloneSegments(segments: readonly WireSegment[]): WireSegment[] {
  return segments.map((s) => ({ a: { ...s.a }, b: { ...s.b } }));
}

/**
 * The connect-op derivation matrix for wiring pin A to pin B:
 *   neither on a net  → connect A into a new net, connect B into it
 *   one on net N      → connect the other into N
 *   different nets    → merge_nets (A's net survives)
 *   same net          → geometry only
 * set_wire_geometry always APPENDS to the existing geometry of the
 * resulting net (merge_nets itself concatenates absorbed wires, so the
 * merge case writes survivor+absorbed+new explicitly).
 */
export function deriveWireOps(
  graph: DesignGraph,
  portA: PortRef,
  portB: PortRef,
  segments: WireSegment[],
  makeId: () => Uuid = newUuid,
): OpBody[] {
  if (portA === portB) return [];
  const netA = netOfPort(graph, portA);
  const netB = netOfPort(graph, portB);
  const added = cloneSegments(segments);

  if (!netA && !netB) {
    const netId = makeId();
    return [
      { kind: 'connect', port: portA, newNetId: netId },
      { kind: 'connect', port: portB, netId },
      { kind: 'set_wire_geometry', netId, segments: added },
    ];
  }

  if (netA && !netB) {
    const existing = cloneSegments(graph.schematic.wires.get(netA.id) ?? []);
    return [
      { kind: 'connect', port: portB, netId: netA.id },
      { kind: 'set_wire_geometry', netId: netA.id, segments: [...existing, ...added] },
    ];
  }

  if (!netA && netB) {
    const existing = cloneSegments(graph.schematic.wires.get(netB.id) ?? []);
    return [
      { kind: 'connect', port: portA, netId: netB.id },
      { kind: 'set_wire_geometry', netId: netB.id, segments: [...existing, ...added] },
    ];
  }

  if (!netA || !netB) return []; // unreachable; narrows types

  if (netA.id === netB.id) {
    if (added.length === 0) return [];
    const existing = cloneSegments(graph.schematic.wires.get(netA.id) ?? []);
    return [
      { kind: 'set_wire_geometry', netId: netA.id, segments: [...existing, ...added] },
    ];
  }

  const wiresA = cloneSegments(graph.schematic.wires.get(netA.id) ?? []);
  const wiresB = cloneSegments(graph.schematic.wires.get(netB.id) ?? []);
  return [
    { kind: 'merge_nets', survivor: netA.id, absorbed: netB.id },
    {
      kind: 'set_wire_geometry',
      netId: netA.id,
      segments: [...wiresA, ...wiresB, ...added],
    },
  ];
}

/** Delete ops for a selection: components removed, wire geometry cleared. */
export function deleteSelectionOps(graph: DesignGraph, selection: ReadonlySet<string>): OpBody[] {
  const ops: OpBody[] = [];
  for (const id of selection) {
    if (graph.components.has(id)) {
      ops.push({ kind: 'remove_component', id });
    } else if (graph.nets.has(id)) {
      ops.push({ kind: 'set_wire_geometry', netId: id, segments: [] });
    }
  }
  return ops;
}

function ghostFromLines(lines: number[]): Float32Array {
  return Float32Array.from(lines);
}

function symbolGhost(part: Part, placement: SymbolPlacement): Float32Array {
  const tess = tessellateSymbol(part, placement);
  return ghostFromLines(tess.lines);
}

// ── Select tool ──────────────────────────────────────────────────────

interface DragState {
  id: string;
  placement: SymbolPlacement;
  start: Vec;
  current: Vec;
}

interface MarqueeState {
  start: Vec;
  current: Vec;
}

export class SelectTool {
  readonly kind = 'select';
  private drag: DragState | null = null;
  private marquee: MarqueeState | null = null;

  pointerDown(pt: Vec, env: ToolEnv): ToolResult {
    const hit = env.pick(pt, PICK_TOLERANCE_NM)[0];
    if (hit) {
      const placement = env.graph.schematic.placements.get(hit.id);
      if (hit.kind === 'symbol' && placement) {
        this.drag = { id: hit.id, placement, start: pt, current: pt };
      }
      return { selection: [hit.id] };
    }
    this.marquee = { start: pt, current: pt };
    return { selection: [] };
  }

  pointerMove(pt: Vec, env: ToolEnv): ToolResult {
    if (this.drag) {
      this.drag.current = pt;
      return { ghost: this.dragGhost(env) };
    }
    if (this.marquee) {
      this.marquee.current = pt;
      const { start } = this.marquee;
      return {
        ghost: ghostFromLines([
          start.x, start.y, pt.x, start.y,
          pt.x, start.y, pt.x, pt.y,
          pt.x, pt.y, start.x, pt.y,
          start.x, pt.y, start.x, start.y,
        ]),
      };
    }
    return {};
  }

  pointerUp(pt: Vec, env: ToolEnv): ToolResult {
    if (this.drag) {
      const d = this.drag;
      this.drag = null;
      d.current = pt;
      const target = dragTarget(d);
      if (target.x !== d.placement.at.x || target.y !== d.placement.at.y) {
        return {
          ghost: null,
          ops: [
            {
              kind: 'move_symbol',
              componentId: d.id,
              at: target,
              rot: d.placement.rot,
              mirror: d.placement.mirror,
            },
          ],
          opsLabel: 'move symbol',
        };
      }
      return { ghost: null };
    }
    if (this.marquee) {
      const m = this.marquee;
      this.marquee = null;
      return { ghost: null, selection: env.queryRect(m.start, pt) };
    }
    return {};
  }

  cancel(): ToolResult {
    this.drag = null;
    this.marquee = null;
    return { ghost: null };
  }

  private dragGhost(env: ToolEnv): Float32Array | null {
    const d = this.drag;
    if (!d) return null;
    const comp = env.graph.components.get(d.id);
    if (!comp) return null;
    const part = env.parts.get(comp.partId, comp.partRev);
    if (!part) return null;
    return symbolGhost(part, { ...d.placement, at: dragTarget(d) });
  }
}

function dragTarget(d: DragState): Vec {
  return snapToGrid({
    x: d.placement.at.x + (d.current.x - d.start.x),
    y: d.placement.at.y + (d.current.y - d.start.y),
  });
}

// ── Place tool ───────────────────────────────────────────────────────

export class PlaceTool {
  readonly kind = 'place';

  constructor(
    readonly partId: string,
    private readonly makeId: () => Uuid = newUuid,
  ) {}

  pointerDown(pt: Vec, env: ToolEnv): ToolResult {
    const part = env.parts.latest(this.partId);
    if (!part) return {};
    const id = this.makeId();
    return {
      ops: [
        {
          kind: 'add_component',
          id,
          ref: nextFreeRef(env.graph, part.refPrefix),
          partId: part.id,
          partRev: part.rev,
        },
        {
          kind: 'place_symbol',
          componentId: id,
          at: snapToGrid(pt),
          rot: 0,
          mirror: false,
        },
      ],
      opsLabel: `place ${part.name}`,
      selection: [id],
    };
  }

  pointerMove(pt: Vec, env: ToolEnv): ToolResult {
    const part = env.parts.latest(this.partId);
    if (!part) return {};
    return {
      ghost: symbolGhost(part, { at: snapToGrid(pt), rot: 0, mirror: false }),
    };
  }

  pointerUp(): ToolResult {
    return {};
  }

  cancel(): ToolResult {
    return { ghost: null };
  }
}

// ── Wire tool ────────────────────────────────────────────────────────

export class WireTool {
  readonly kind = 'wire';
  private start: PinHit | null = null;

  constructor(private readonly makeId: () => Uuid = newUuid) {}

  get pendingFrom(): PinHit | null {
    return this.start;
  }

  pointerDown(pt: Vec, env: ToolEnv): ToolResult {
    const pin = findPinAt(env.graph, env.parts, pt, PIN_TOLERANCE_NM);
    if (!pin) return {};
    if (!this.start) {
      this.start = pin;
      return { ghost: null };
    }
    if (pin.port === this.start.port) return {};
    const segments = manhattanPath(this.start.at, pin.at);
    const ops = deriveWireOps(env.graph, this.start.port, pin.port, segments, this.makeId);
    this.start = null;
    return { ops, opsLabel: 'wire pins', ghost: null };
  }

  pointerMove(pt: Vec, env: ToolEnv): ToolResult {
    if (!this.start) return {};
    const pin = findPinAt(env.graph, env.parts, pt, PIN_TOLERANCE_NM);
    const end = pin ? pin.at : snapToGrid(pt);
    const lines: number[] = [];
    for (const seg of manhattanPath(this.start.at, end)) {
      lines.push(seg.a.x, seg.a.y, seg.b.x, seg.b.y);
    }
    return { ghost: ghostFromLines(lines) };
  }

  pointerUp(): ToolResult {
    return {};
  }

  cancel(): ToolResult {
    this.start = null;
    return { ghost: null };
  }
}

export type Tool = SelectTool | PlaceTool | WireTool;
