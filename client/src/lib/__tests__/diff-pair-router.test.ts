import { describe, it, expect } from 'vitest';

import {
  offsetPath,
  generateDiffPair,
  diffPairVias,
  pathLength,
} from '@/lib/pcb/diff-pair-router';
import type {
  Point2D,
  DiffPairConfig,
} from '@/lib/pcb/diff-pair-router';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EPSILON = 1e-6;

function expectClose(a: number, b: number, msg?: string): void {
  expect(Math.abs(a - b)).toBeLessThan(EPSILON);
}

function expectPointClose(actual: Point2D, expected: Point2D): void {
  expect(actual.x).toBeCloseTo(expected.x, 5);
  expect(actual.y).toBeCloseTo(expected.y, 5);
}

function makeConfig(overrides?: Partial<DiffPairConfig>): DiffPairConfig {
  return {
    traceWidth: 0.15,
    gap: 0.15,
    layer: 'F.Cu',
    netIdP: 'USB_D+',
    netIdN: 'USB_D-',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// pathLength
// ---------------------------------------------------------------------------

describe('pathLength', () => {
  it('returns 0 for empty array', () => {
    expect(pathLength([])).toBe(0);
  });

  it('returns 0 for single point', () => {
    expect(pathLength([{ x: 5, y: 3 }])).toBe(0);
  });

  it('computes simple 3-4-5 right triangle hypotenuse', () => {
    const pts: Point2D[] = [
      { x: 0, y: 0 },
      { x: 3, y: 4 },
    ];
    expectClose(pathLength(pts), 5);
  });

  it('computes multi-segment L-shape path', () => {
    // horizontal 10mm + vertical 5mm = 15mm
    const pts: Point2D[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
    ];
    expectClose(pathLength(pts), 15);
  });

  it('computes diagonal segments correctly', () => {
    // Two segments of length sqrt(2) each
    const pts: Point2D[] = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 0 },
    ];
    expectClose(pathLength(pts), 2 * Math.SQRT2);
  });
});

// ---------------------------------------------------------------------------
// offsetPath
// ---------------------------------------------------------------------------

describe('offsetPath', () => {
  it('returns empty array for empty input', () => {
    expect(offsetPath([], 1)).toEqual([]);
  });

  it('passes through single point unchanged', () => {
    const result = offsetPath([{ x: 5, y: 3 }], 2.0);
    expect(result).toHaveLength(1);
    expectPointClose(result[0], { x: 5, y: 3 });
  });

  it('offsets horizontal segment to the left (positive offset)', () => {
    // Horizontal segment from (0,0) to (10,0).
    // Direction = (1,0), perpendicular = (0,1) (left of travel).
    // Positive offset → shift up by 0.5mm.
    const pts: Point2D[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
    const result = offsetPath(pts, 0.5);
    expect(result).toHaveLength(2);
    expectPointClose(result[0], { x: 0, y: 0.5 });
    expectPointClose(result[1], { x: 10, y: 0.5 });
  });

  it('offsets horizontal segment to the right (negative offset)', () => {
    const pts: Point2D[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
    const result = offsetPath(pts, -0.5);
    expect(result).toHaveLength(2);
    expectPointClose(result[0], { x: 0, y: -0.5 });
    expectPointClose(result[1], { x: 10, y: -0.5 });
  });

  it('offsets vertical segment correctly', () => {
    // Vertical segment from (0,0) to (0,10).
    // Direction = (0,1), perpendicular = (-1,0).
    // Positive offset → shift left by 1mm.
    const pts: Point2D[] = [{ x: 0, y: 0 }, { x: 0, y: 10 }];
    const result = offsetPath(pts, 1.0);
    expect(result).toHaveLength(2);
    expectPointClose(result[0], { x: -1, y: 0 });
    expectPointClose(result[1], { x: -1, y: 10 });
  });

  it('offsets 45-degree segment correctly', () => {
    // Segment from (0,0) to (10,10). Direction = normalize(1,1) = (0.707,0.707).
    // Perpendicular = (-0.707,0.707). Offset = 1 → shift by (-0.707, 0.707).
    const pts: Point2D[] = [{ x: 0, y: 0 }, { x: 10, y: 10 }];
    const result = offsetPath(pts, 1.0);
    const d = 1.0 / Math.SQRT2;
    expect(result).toHaveLength(2);
    expectPointClose(result[0], { x: -d, y: d });
    expectPointClose(result[1], { x: 10 - d, y: 10 + d });
  });

  it('handles multi-segment L-shape with miter join', () => {
    // L-shape: (0,0) → (10,0) → (10,10).
    // First segment: horizontal right → perp = (0,1) for positive offset.
    // Second segment: vertical up → perp = (-1,0) for positive offset.
    // Miter join at corner should produce correct intersection point.
    const pts: Point2D[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ];
    const offset = 1.0;
    const result = offsetPath(pts, offset);
    expect(result).toHaveLength(3);
    // Start: (0, 1)
    expectPointClose(result[0], { x: 0, y: 1 });
    // Corner miter: bisector of (0,1) and (-1,0) = normalize(-1,1).
    // offset / dot(bisector, n1) = 1 / dot((-0.707,0.707),(0,1)) = 1/0.707 ≈ 1.414
    // Corner point = (10,0) + 1.414 * (-0.707, 0.707) = (10-1, 0+1) = (9, 1)
    expectPointClose(result[1], { x: 9, y: 1 });
    // End: (10-1, 10) = (9, 10)
    expectPointClose(result[2], { x: 9, y: 10 });
  });

  it('handles U-turn (180 degree) by capping miter', () => {
    // A sharp U-turn where the miter would spike.
    // (0,0) → (10,0) → (0,0.01)  — near 180-degree turn.
    // The miter cap should limit the offset distance to 3x.
    const pts: Point2D[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 0.01 },
    ];
    const offset = 1.0;
    const result = offsetPath(pts, offset);
    expect(result).toHaveLength(3);
    // The middle point should not spike — its distance from (10,0) should be <= 3 * offset
    const dx = result[1].x - 10;
    const dy = result[1].y - 0;
    const dist = Math.sqrt(dx * dx + dy * dy);
    expect(dist).toBeLessThanOrEqual(3.0 * Math.abs(offset) + EPSILON);
  });

  it('preserves zero-length segment endpoints', () => {
    // Two identical points
    const pts: Point2D[] = [{ x: 5, y: 5 }, { x: 5, y: 5 }];
    const result = offsetPath(pts, 1.0);
    expect(result).toHaveLength(2);
    // With zero-length segment, no perpendicular can be computed — fall back to no offset
    expectPointClose(result[0], { x: 5, y: 5 });
    expectPointClose(result[1], { x: 5, y: 5 });
  });
});

// ---------------------------------------------------------------------------
// generateDiffPair
// ---------------------------------------------------------------------------

describe('generateDiffPair', () => {
  const config = makeConfig();

  it('generates P and N paths for straight horizontal centerline', () => {
    const centerline: Point2D[] = [{ x: 0, y: 0 }, { x: 20, y: 0 }];
    const result = generateDiffPair(centerline, config);

    const halfPitch = (config.traceWidth + config.gap) / 2; // 0.15

    // P path should be offset up, N path offset down
    expect(result.pathP).toHaveLength(2);
    expect(result.pathN).toHaveLength(2);

    expectPointClose(result.pathP[0], { x: 0, y: halfPitch });
    expectPointClose(result.pathP[1], { x: 20, y: halfPitch });

    expectPointClose(result.pathN[0], { x: 0, y: -halfPitch });
    expectPointClose(result.pathN[1], { x: 20, y: -halfPitch });

    // Straight paths should have zero skew
    expectClose(result.skewMm, 0);
    expectClose(result.lengthP, 20);
    expectClose(result.lengthN, 20);
  });

  it('preserves config properties in result', () => {
    const centerline: Point2D[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
    const result = generateDiffPair(centerline, config);

    expect(result.traceWidth).toBe(config.traceWidth);
    expect(result.gap).toBe(config.gap);
    expect(result.layer).toBe(config.layer);
    expect(result.netIdP).toBe(config.netIdP);
    expect(result.netIdN).toBe(config.netIdN);
  });

  it('generates non-zero skew for 90-degree bend', () => {
    // L-shape: the outer path is longer than the inner path
    const centerline: Point2D[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ];
    const result = generateDiffPair(centerline, config);

    // Both paths should have 3 points
    expect(result.pathP).toHaveLength(3);
    expect(result.pathN).toHaveLength(3);

    // Skew should be non-zero for a bend
    expect(Math.abs(result.skewMm)).toBeGreaterThan(0);
  });

  it('generates equal lengths for straight diagonal', () => {
    const centerline: Point2D[] = [{ x: 0, y: 0 }, { x: 10, y: 10 }];
    const result = generateDiffPair(centerline, config);

    // Straight line → equal P and N lengths → zero skew
    expectClose(result.lengthP, result.lengthN);
    expectClose(result.skewMm, 0);
  });

  it('throws on fewer than 2 points', () => {
    expect(() => generateDiffPair([], config)).toThrow();
    expect(() => generateDiffPair([{ x: 0, y: 0 }], config)).toThrow();
  });

  it('throws on zero or negative gap', () => {
    const centerline: Point2D[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
    expect(() => generateDiffPair(centerline, makeConfig({ gap: 0 }))).toThrow();
    expect(() => generateDiffPair(centerline, makeConfig({ gap: -0.1 }))).toThrow();
  });

  it('throws on zero or negative traceWidth', () => {
    const centerline: Point2D[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
    expect(() => generateDiffPair(centerline, makeConfig({ traceWidth: 0 }))).toThrow();
    expect(() => generateDiffPair(centerline, makeConfig({ traceWidth: -0.5 }))).toThrow();
  });
});

// ---------------------------------------------------------------------------
// diffPairVias
// ---------------------------------------------------------------------------

describe('diffPairVias', () => {
  const config = makeConfig();
  const halfPitch = (config.traceWidth + config.gap) / 2;

  it('generates vias offset perpendicular to horizontal direction', () => {
    const center: Point2D = { x: 5, y: 5 };
    const direction: Point2D = { x: 1, y: 0 }; // horizontal
    const result = diffPairVias(center, direction, config, 'F.Cu', 'B.Cu');

    // Perpendicular to (1,0) is (0,1) and (0,-1)
    expectPointClose(result.viaP.position, { x: 5, y: 5 + halfPitch });
    expectPointClose(result.viaN.position, { x: 5, y: 5 - halfPitch });
  });

  it('generates vias offset perpendicular to diagonal direction', () => {
    const center: Point2D = { x: 0, y: 0 };
    const direction: Point2D = { x: 1, y: 1 }; // 45-degree
    const result = diffPairVias(center, direction, config, 'F.Cu', 'In1.Cu');

    // Perpendicular to (1,1) normalized is (-0.707, 0.707)
    const d = halfPitch / Math.SQRT2;
    expectPointClose(result.viaP.position, { x: -d, y: d });
    expectPointClose(result.viaN.position, { x: d, y: -d });
  });

  it('preserves layer properties on both vias', () => {
    const center: Point2D = { x: 0, y: 0 };
    const direction: Point2D = { x: 1, y: 0 };
    const result = diffPairVias(center, direction, config, 'F.Cu', 'B.Cu');

    expect(result.viaP.fromLayer).toBe('F.Cu');
    expect(result.viaP.toLayer).toBe('B.Cu');
    expect(result.viaN.fromLayer).toBe('F.Cu');
    expect(result.viaN.toLayer).toBe('B.Cu');
  });

  it('handles vertical direction', () => {
    const center: Point2D = { x: 10, y: 10 };
    const direction: Point2D = { x: 0, y: 1 }; // vertical up
    const result = diffPairVias(center, direction, config, 'F.Cu', 'B.Cu');

    // Perpendicular to (0,1) is (-1,0)
    expectPointClose(result.viaP.position, { x: 10 - halfPitch, y: 10 });
    expectPointClose(result.viaN.position, { x: 10 + halfPitch, y: 10 });
  });

  it('handles zero-length direction gracefully', () => {
    const center: Point2D = { x: 0, y: 0 };
    const direction: Point2D = { x: 0, y: 0 };
    // Should not throw — falls back to (0,0) offset or identity
    const result = diffPairVias(center, direction, config, 'F.Cu', 'B.Cu');
    expect(result.viaP.position).toBeDefined();
    expect(result.viaN.position).toBeDefined();
  });
});
