import type { SymbolPlacement, Vec, WireSegment } from '@protopulse/graph';
import type { Part, SymbolPrimitive } from '@protopulse/parts';

/**
 * Pure symbol/wire tessellation — DOM-free, unit-tested in node.
 *
 * Transform convention (THE convention — tests pin it down):
 *   world = rotate_ccw(rot) ∘ mirrorX ∘ local  +  placement.at
 * Mirror is an X-flip (x → -x) applied BEFORE rotation. Rotation is
 * counter-clockwise in the world frame (Y-up): rot 90 maps (x,y)→(-y,x),
 * so a pin at (2G, 0) with rot 90 lands at (0, 2G).
 *
 * All coordinates are integer nanometers; circle approximations are
 * rounded back to integers so diffing world geometry stays exact.
 */

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface TessText {
  at: Vec;
  text: string;
  sizeNm: number;
}

export interface Tessellation {
  /** Line segments as x1,y1,x2,y2 quads, world nm. */
  lines: number[];
  /** Text runs anchored in world space (glyphs stay upright). */
  texts: TessText[];
  /** World positions of the symbol's pin endpoints. */
  pinDots: Vec[];
}

/** Segments used to approximate a circle as a line loop. */
export const CIRCLE_SEGMENTS = 16;

/** Apply mirror (X-flip, first) then CCW rotation then translation. */
export function applyPlacement(p: Vec, placement: SymbolPlacement): Vec {
  const x = placement.mirror ? -p.x : p.x;
  const y = p.y;
  let rx: number;
  let ry: number;
  switch (placement.rot) {
    case 0:
      rx = x;
      ry = y;
      break;
    case 90:
      rx = -y;
      ry = x;
      break;
    case 180:
      rx = -x;
      ry = -y;
      break;
    case 270:
      rx = y;
      ry = -x;
      break;
  }
  return { x: rx + placement.at.x, y: ry + placement.at.y };
}

function pushLine(lines: number[], a: Vec, b: Vec): void {
  lines.push(a.x, a.y, b.x, b.y);
}

/** World position of one pin endpoint — the wire tool and ratsnest rely on this being exact. */
export function pinWorldPosition(part: Part, placement: SymbolPlacement, pinKey: string): Vec {
  const pin = part.symbol.pins.find((p) => p.key === pinKey);
  if (!pin) {
    throw new Error(`part ${part.id} has no symbol pin "${pinKey}"`);
  }
  return applyPlacement(pin.at, placement);
}

function tessellatePrimitive(
  prim: SymbolPrimitive,
  placement: SymbolPlacement,
  out: Tessellation,
): void {
  switch (prim.kind) {
    case 'rect': {
      const c0 = { x: prim.x, y: prim.y };
      const c1 = { x: prim.x + prim.w, y: prim.y };
      const c2 = { x: prim.x + prim.w, y: prim.y + prim.h };
      const c3 = { x: prim.x, y: prim.y + prim.h };
      const w0 = applyPlacement(c0, placement);
      const w1 = applyPlacement(c1, placement);
      const w2 = applyPlacement(c2, placement);
      const w3 = applyPlacement(c3, placement);
      pushLine(out.lines, w0, w1);
      pushLine(out.lines, w1, w2);
      pushLine(out.lines, w2, w3);
      pushLine(out.lines, w3, w0);
      break;
    }
    case 'circle': {
      let prev: Vec | null = null;
      let first: Vec | null = null;
      for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
        const theta = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
        const local = {
          x: Math.round(prim.cx + prim.r * Math.cos(theta)),
          y: Math.round(prim.cy + prim.r * Math.sin(theta)),
        };
        const world = applyPlacement(local, placement);
        if (prev) pushLine(out.lines, prev, world);
        else first = world;
        prev = world;
      }
      if (prev && first) pushLine(out.lines, prev, first);
      break;
    }
    case 'line': {
      pushLine(out.lines, applyPlacement(prim.a, placement), applyPlacement(prim.b, placement));
      break;
    }
    case 'polyline': {
      for (let i = 0; i + 1 < prim.points.length; i++) {
        const a = prim.points[i];
        const b = prim.points[i + 1];
        if (a && b) pushLine(out.lines, applyPlacement(a, placement), applyPlacement(b, placement));
      }
      if (prim.closed && prim.points.length > 2) {
        const last = prim.points[prim.points.length - 1];
        const first = prim.points[0];
        if (last && first) {
          pushLine(out.lines, applyPlacement(last, placement), applyPlacement(first, placement));
        }
      }
      break;
    }
    case 'text': {
      out.texts.push({
        at: applyPlacement(prim.at, placement),
        text: prim.text,
        sizeNm: prim.sizeNm,
      });
      break;
    }
  }
}

/** Tessellate a placed symbol into world-space line segments + text runs. */
export function tessellateSymbol(part: Part, placement: SymbolPlacement): Tessellation {
  const out: Tessellation = { lines: [], texts: [], pinDots: [] };
  for (const prim of part.symbol.primitives) {
    tessellatePrimitive(prim, placement, out);
  }
  for (const pin of part.symbol.pins) {
    out.pinDots.push(applyPlacement(pin.at, placement));
  }
  return out;
}

/** Flatten wire segments into the x1,y1,x2,y2 line array. */
export function tessellateWire(segments: readonly WireSegment[]): number[] {
  const lines: number[] = [];
  for (const seg of segments) {
    pushLine(lines, seg.a, seg.b);
  }
  return lines;
}

/** AABB of an x1,y1,x2,y2 line array; null when empty. */
export function boundsOfLines(lines: ArrayLike<number>): Bounds | null {
  if (lines.length < 4) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const x = lines[i];
    const y = lines[i + 1];
    if (x === undefined || y === undefined) continue;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

function extendBounds(b: Bounds, p: Vec): void {
  if (p.x < b.minX) b.minX = p.x;
  if (p.x > b.maxX) b.maxX = p.x;
  if (p.y < b.minY) b.minY = p.y;
  if (p.y > b.maxY) b.maxY = p.y;
}

/** AABB of a tessellation: lines ∪ pin endpoints ∪ text anchors. */
export function tessellationBounds(t: Tessellation): Bounds {
  const b = boundsOfLines(t.lines) ?? {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  };
  for (const dot of t.pinDots) extendBounds(b, dot);
  for (const text of t.texts) extendBounds(b, text.at);
  if (b.minX === Infinity) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return b;
}

/** AABB of a placed symbol. */
export function symbolBounds(part: Part, placement: SymbolPlacement): Bounds {
  return tessellationBounds(tessellateSymbol(part, placement));
}

/** AABB of a wire's segments; null when the wire has no geometry. */
export function wireBounds(segments: readonly WireSegment[]): Bounds | null {
  return boundsOfLines(tessellateWire(segments));
}

/** Union of two bounds. */
export function unionBounds(a: Bounds | null, b: Bounds | null): Bounds | null {
  if (!a) return b;
  if (!b) return a;
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}
