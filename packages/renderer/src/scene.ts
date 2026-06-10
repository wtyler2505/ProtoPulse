import type { Component, DesignGraph, SymbolPlacement, Uuid, WireSegment } from '@protopulse/graph';
import { SCHEMATIC_GRID } from '@protopulse/graph';
import type { Part, PartDb } from '@protopulse/parts';
import {
  boundsOfLines,
  symbolBounds,
  tessellateSymbol,
  tessellateWire,
  unionBounds,
  type Bounds,
  type TessText,
} from './tessellate.js';

/**
 * Retained scene graph — a Map of flat, GPU-ready nodes. The renderer
 * consumes it directly; sync.ts patches it incrementally from GraphDeltas.
 * Everything here is DOM-free.
 */

export type RGBA = [number, number, number, number];

export const SYMBOL_COLOR: RGBA = [0.62, 0.8, 1.0, 1.0];
export const WIRE_COLOR: RGBA = [0.45, 0.92, 0.62, 1.0];

export interface SceneNode {
  id: string;
  kind: 'symbol' | 'wire';
  /** x1,y1,x2,y2 line segments, world nm. */
  lines: Float32Array;
  texts: TessText[];
  bounds: Bounds;
  color: RGBA;
}

export class SceneGraph {
  readonly nodes = new Map<string, SceneNode>();
  /** Bumped on every mutation — renderers/pick indexes key caches on it. */
  version = 0;

  add(node: SceneNode): void {
    this.nodes.set(node.id, node);
    this.version++;
  }

  update(node: SceneNode): void {
    this.nodes.set(node.id, node);
    this.version++;
  }

  remove(id: string): boolean {
    const existed = this.nodes.delete(id);
    if (existed) this.version++;
    return existed;
  }

  get(id: string): SceneNode | undefined {
    return this.nodes.get(id);
  }

  /** AABB of the whole scene; null when empty. */
  bounds(): Bounds | null {
    let b: Bounds | null = null;
    for (const node of this.nodes.values()) b = unionBounds(b, node.bounds);
    return b;
  }
}

/** Half-size of the cross drawn at each pin endpoint. */
const PIN_MARK = Math.round(SCHEMATIC_GRID / 5);

/** Build the retained node for one placed symbol. */
export function buildSymbolNode(
  component: Component,
  part: Part,
  placement: SymbolPlacement,
): SceneNode {
  const tess = tessellateSymbol(part, placement);
  const lines = [...tess.lines];
  // Pin endpoints render as small crosses so unwired pins are visible.
  for (const dot of tess.pinDots) {
    lines.push(dot.x - PIN_MARK, dot.y, dot.x + PIN_MARK, dot.y);
    lines.push(dot.x, dot.y - PIN_MARK, dot.x, dot.y + PIN_MARK);
  }
  const bounds = symbolBounds(part, placement);
  const texts: TessText[] = [...tess.texts];
  // Ref designator (and value, when set) float above the symbol body.
  const labelSize = Math.round(SCHEMATIC_GRID * 0.9);
  texts.push({
    at: { x: bounds.minX, y: bounds.maxY + Math.round(SCHEMATIC_GRID / 2) },
    text: component.value ? `${component.ref} ${component.value}` : component.ref,
    sizeNm: labelSize,
  });
  return {
    id: component.id,
    kind: 'symbol',
    lines: Float32Array.from(lines),
    texts,
    bounds,
    color: SYMBOL_COLOR,
  };
}

/** Build the retained node for one net's wire geometry. */
export function buildWireNode(netId: Uuid, segments: readonly WireSegment[]): SceneNode {
  const lines = tessellateWire(segments);
  const bounds = boundsOfLines(lines) ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return {
    id: netId,
    kind: 'wire',
    lines: Float32Array.from(lines),
    texts: [],
    bounds,
    color: WIRE_COLOR,
  };
}

/**
 * Full scene build from a materialized graph. Unplaced components and
 * unknown parts are skipped (the app surfaces those elsewhere).
 */
export function buildScene(graph: DesignGraph, parts: PartDb): SceneGraph {
  const scene = new SceneGraph();
  for (const [componentId, placement] of graph.schematic.placements) {
    const component = graph.components.get(componentId);
    if (!component) continue;
    const part = parts.get(component.partId, component.partRev);
    if (!part) continue;
    scene.add(buildSymbolNode(component, part, placement));
  }
  for (const [netId, segments] of graph.schematic.wires) {
    if (segments.length === 0) continue;
    scene.add(buildWireNode(netId, segments));
  }
  return scene;
}
