import Flatbush from 'flatbush';

import type { SceneGraph, SceneNode } from './scene.js';
import type { Bounds } from './tessellate.js';
import type { Vec } from '@protopulse/graph';

/**
 * CPU picking over scene-node AABBs via flatbush (no GPU pick buffer at
 * M1). Symbols pick by bounding box; wires additionally require the
 * point to be within tolerance of an actual segment, so the empty corner
 * of an L-shaped wire's AABB doesn't pick.
 */

export interface PickHit {
  id: string;
  kind: SceneNode['kind'];
  bounds: Bounds;
  area: number;
}

/** Pick priority: bodies before line-ish geometry; vias in between. */
const KIND_RANK: Record<SceneNode['kind'], number> = {
  symbol: 0,
  footprint: 0,
  via: 1,
  wire: 2,
  trace: 2,
  zone: 3, // everything else wins — zones are huge and easy to hit
  outline: 4, // the board edge is context, not a selection target
};

/** Kinds whose AABB is mostly empty — require proximity to a segment. */
const LINEAR_KINDS = new Set<SceneNode['kind']>(['wire', 'trace', 'outline']);

function area(b: Bounds): number {
  return Math.max(0, b.maxX - b.minX) * Math.max(0, b.maxY - b.minY);
}

/** Squared distance from a point to a segment. */
function distSqToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = 0;
  if (lenSq > 0) {
    t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
  }
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return (px - cx) * (px - cx) + (py - cy) * (py - cy);
}

function nearAnyLine(node: SceneNode, pt: Vec, toleranceNm: number): boolean {
  const tolSq = toleranceNm * toleranceNm;
  const lines = node.lines;
  for (let i = 0; i + 3 < lines.length; i += 4) {
    const x1 = lines[i];
    const y1 = lines[i + 1];
    const x2 = lines[i + 2];
    const y2 = lines[i + 3];
    if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) continue;
    if (distSqToSegment(pt.x, pt.y, x1, y1, x2, y2) <= tolSq) return true;
  }
  return false;
}

export class PickIndex {
  private index: Flatbush | null = null;
  private entries: SceneNode[] = [];

  /** Rebuild from the current scene. Flatbush throws on 0 items — guarded. */
  rebuild(scene: SceneGraph): void {
    this.entries = [...scene.nodes.values()];
    if (this.entries.length === 0) {
      this.index = null;
      return;
    }
    const fb = new Flatbush(this.entries.length);
    for (const node of this.entries) {
      fb.add(node.bounds.minX, node.bounds.minY, node.bounds.maxX, node.bounds.maxY);
    }
    fb.finish();
    this.index = fb;
  }

  /**
   * Hits at a point (expanded by toleranceNm), sorted symbol-before-wire
   * then smaller-area-first, so the most specific target wins.
   */
  pick(pt: Vec, toleranceNm: number): PickHit[] {
    if (!this.index) return [];
    const found = this.index.search(
      pt.x - toleranceNm,
      pt.y - toleranceNm,
      pt.x + toleranceNm,
      pt.y + toleranceNm,
    );
    const hits: PickHit[] = [];
    for (const i of found) {
      const node = this.entries[i];
      if (!node) continue;
      if (LINEAR_KINDS.has(node.kind) && !nearAnyLine(node, pt, toleranceNm)) continue;
      hits.push({ id: node.id, kind: node.kind, bounds: node.bounds, area: area(node.bounds) });
    }
    hits.sort((a, b) => {
      if (KIND_RANK[a.kind] !== KIND_RANK[b.kind]) return KIND_RANK[a.kind] - KIND_RANK[b.kind];
      if (a.area !== b.area) return a.area - b.area;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    return hits;
  }

  /** IDs of nodes whose AABB intersects the rect (marquee select). */
  queryRect(min: Vec, max: Vec): string[] {
    if (!this.index) return [];
    const found = this.index.search(
      Math.min(min.x, max.x),
      Math.min(min.y, max.y),
      Math.max(min.x, max.x),
      Math.max(min.y, max.y),
    );
    const ids: string[] = [];
    for (const i of found) {
      const node = this.entries[i];
      if (node) ids.push(node.id);
    }
    return ids.sort();
  }
}
