import { SCHEMATIC_GRID  } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { describe, expect, it } from 'vitest';

import {
  applyPlacement,
  boundsOfLines,
  CIRCLE_SEGMENTS,
  pinWorldPosition,
  symbolBounds,
  tessellateSymbol,
  tessellateWire,
  unionBounds,
  wireBounds,
} from './tessellate.js';

import type {SymbolPlacement} from '@protopulse/graph';

const G = SCHEMATIC_GRID;
const parts = seedPartDb();
const resistor = parts.latest('core:resistor')!;

function place(at = { x: 0, y: 0 }, rot: SymbolPlacement['rot'] = 0, mirror = false): SymbolPlacement {
  return { at, rot, mirror };
}

describe('applyPlacement — the transform convention', () => {
  it('identity leaves points unchanged', () => {
    expect(applyPlacement({ x: 2 * G, y: G }, place())).toEqual({ x: 2 * G, y: G });
  });

  it('rot 90 is CCW: (2G, 0) → (0, 2G)', () => {
    expect(applyPlacement({ x: 2 * G, y: 0 }, place({ x: 0, y: 0 }, 90))).toEqual({ x: 0, y: 2 * G });
  });

  it('rot 180: (2G, G) → (-2G, -G)', () => {
    expect(applyPlacement({ x: 2 * G, y: G }, place({ x: 0, y: 0 }, 180))).toEqual({
      x: -2 * G,
      y: -G,
    });
  });

  it('rot 270: (2G, 0) → (0, -2G)', () => {
    expect(applyPlacement({ x: 2 * G, y: 0 }, place({ x: 0, y: 0 }, 270))).toEqual({
      x: 0,
      y: -2 * G,
    });
  });

  it('mirror is an X-flip: (2G, G) → (-2G, G)', () => {
    expect(applyPlacement({ x: 2 * G, y: G }, place({ x: 0, y: 0 }, 0, true))).toEqual({
      x: -2 * G,
      y: G,
    });
  });

  it('mirror applies BEFORE rotation: mirror+rot90 maps (2G,0) → (0,-2G)', () => {
    // mirror first: (2G,0) → (-2G,0); then CCW 90: (-2G,0) → (0,-2G)
    expect(applyPlacement({ x: 2 * G, y: 0 }, place({ x: 0, y: 0 }, 90, true))).toEqual({
      x: 0,
      y: -2 * G,
    });
  });

  it('translation adds after rotate/mirror', () => {
    expect(applyPlacement({ x: G, y: 0 }, place({ x: 10 * G, y: 5 * G }, 90))).toEqual({
      x: 10 * G,
      y: 6 * G,
    });
  });

  it('results stay integers for grid-aligned inputs', () => {
    const p = applyPlacement({ x: 3 * G, y: -2 * G }, place({ x: 7 * G, y: G }, 270, true));
    expect(Number.isInteger(p.x)).toBe(true);
    expect(Number.isInteger(p.y)).toBe(true);
  });
});

describe('pinWorldPosition', () => {
  it('resistor pins land at ±2G from origin', () => {
    expect(pinWorldPosition(resistor, place(), '1')).toEqual({ x: -2 * G, y: 0 });
    expect(pinWorldPosition(resistor, place(), '2')).toEqual({ x: 2 * G, y: 0 });
  });

  it('pin (2G,0) with rot 90 lands at (0, 2G)', () => {
    expect(pinWorldPosition(resistor, place({ x: 0, y: 0 }, 90), '2')).toEqual({ x: 0, y: 2 * G });
  });

  it('translated + rotated placement is exact', () => {
    expect(pinWorldPosition(resistor, place({ x: 4 * G, y: 4 * G }, 90), '1')).toEqual({
      x: 4 * G,
      y: 2 * G,
    });
  });

  it('throws on unknown pin key', () => {
    expect(() => pinWorldPosition(resistor, place(), 'nope')).toThrow(/no symbol pin/);
  });
});

describe('tessellateSymbol', () => {
  it('emits line quads (x1,y1,x2,y2) — length divisible by 4', () => {
    const t = tessellateSymbol(resistor, place());
    expect(t.lines.length % 4).toBe(0);
    expect(t.lines.length).toBeGreaterThan(0);
  });

  it('rect tessellates to 4 segments', () => {
    const part = {
      ...resistor,
      symbol: {
        primitives: [{ kind: 'rect' as const, x: -G, y: -G, w: 2 * G, h: 2 * G }],
        pins: [],
      },
    };
    const t = tessellateSymbol(part, place());
    expect(t.lines.length).toBe(16);
  });

  it('circle approximates as a 16-segment loop', () => {
    const part = {
      ...resistor,
      symbol: {
        primitives: [{ kind: 'circle' as const, cx: 0, cy: 0, r: G }],
        pins: [],
      },
    };
    const t = tessellateSymbol(part, place());
    expect(t.lines.length).toBe(CIRCLE_SEGMENTS * 4);
  });

  it('closed polyline closes the loop', () => {
    const part = {
      ...resistor,
      symbol: {
        primitives: [
          {
            kind: 'polyline' as const,
            points: [
              { x: 0, y: 0 },
              { x: G, y: 0 },
              { x: 0, y: G },
            ],
            closed: true,
          },
        ],
        pins: [],
      },
    };
    const t = tessellateSymbol(part, place());
    expect(t.lines.length).toBe(12); // 3 segments
  });

  it('text primitives transform their anchor and keep size', () => {
    const part = {
      ...resistor,
      symbol: {
        primitives: [{ kind: 'text' as const, at: { x: G, y: 0 }, text: '+', sizeNm: G }],
        pins: [],
      },
    };
    const t = tessellateSymbol(part, place({ x: 0, y: 0 }, 90));
    expect(t.texts).toEqual([{ at: { x: 0, y: G }, text: '+', sizeNm: G }]);
  });

  it('pinDots are the transformed pin endpoints', () => {
    const t = tessellateSymbol(resistor, place({ x: 10 * G, y: 0 }, 0));
    expect(t.pinDots).toContainEqual({ x: 8 * G, y: 0 });
    expect(t.pinDots).toContainEqual({ x: 12 * G, y: 0 });
  });
});

describe('tessellateWire / bounds', () => {
  it('flattens segments to x1,y1,x2,y2', () => {
    const lines = tessellateWire([
      { a: { x: 0, y: 0 }, b: { x: G, y: 0 } },
      { a: { x: G, y: 0 }, b: { x: G, y: G } },
    ]);
    expect(lines).toEqual([0, 0, G, 0, G, 0, G, G]);
  });

  it('boundsOfLines computes the AABB', () => {
    expect(boundsOfLines([0, 0, G, 0, G, 0, G, 2 * G])).toEqual({
      minX: 0,
      minY: 0,
      maxX: G,
      maxY: 2 * G,
    });
  });

  it('boundsOfLines returns null when empty', () => {
    expect(boundsOfLines([])).toBeNull();
  });

  it('wireBounds of empty wire is null', () => {
    expect(wireBounds([])).toBeNull();
  });

  it('symbolBounds covers the pins', () => {
    const b = symbolBounds(resistor, place());
    expect(b.minX).toBeLessThanOrEqual(-2 * G);
    expect(b.maxX).toBeGreaterThanOrEqual(2 * G);
  });

  it('symbolBounds rotates with the placement', () => {
    const b = symbolBounds(resistor, place({ x: 0, y: 0 }, 90));
    expect(b.minY).toBeLessThanOrEqual(-2 * G);
    expect(b.maxY).toBeGreaterThanOrEqual(2 * G);
    expect(b.maxX - b.minX).toBeLessThan(b.maxY - b.minY);
  });

  it('unionBounds merges and handles nulls', () => {
    const a = { minX: 0, minY: 0, maxX: G, maxY: G };
    const b = { minX: -G, minY: G, maxX: 0, maxY: 2 * G };
    expect(unionBounds(a, b)).toEqual({ minX: -G, minY: 0, maxX: G, maxY: 2 * G });
    expect(unionBounds(null, a)).toEqual(a);
    expect(unionBounds(a, null)).toEqual(a);
    expect(unionBounds(null, null)).toBeNull();
  });
});
