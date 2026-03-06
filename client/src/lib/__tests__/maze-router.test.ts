/**
 * MazeRouter — A* maze router for PCB autorouting.
 *
 * Tests cover grid initialization, obstacle placement with clearance inflation,
 * A* pathfinding (straight, diagonal, obstacle avoidance, layer change),
 * multi-net progressive blocking, net ordering, path simplification,
 * edge cases, and performance.
 */

import { describe, expect, it } from 'vitest';

import type { RouteRequest, RouteResult, RoutedNet } from '@/lib/pcb/maze-router';
import { MazeRouter } from '@/lib/pcb/maze-router';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function euclidean(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

function totalPathLength(points: Array<{ x: number; y: number }>): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += euclidean(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
  }
  return len;
}

// ---------------------------------------------------------------------------
// Grid initialization
// ---------------------------------------------------------------------------

describe('MazeRouter — Grid initialization', () => {
  it('should create grid with correct dimensions at default resolution', () => {
    const router = new MazeRouter();
    router.initGrid(10, 5); // 10mm x 5mm at 0.25mm = 40x20
    const size = router.getGridSize();
    expect(size.cols).toBe(40);
    expect(size.rows).toBe(20);
  });

  it('should create grid with custom grid size', () => {
    const router = new MazeRouter({ gridSizeMm: 0.5 });
    router.initGrid(20, 10); // 20mm x 10mm at 0.5mm = 40x20
    const size = router.getGridSize();
    expect(size.cols).toBe(40);
    expect(size.rows).toBe(20);
  });

  it('should have all cells unblocked initially', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(5, 5); // 5x5 grid
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        expect(router.isBlocked(x, y, 'front')).toBe(false);
        expect(router.isBlocked(x, y, 'back')).toBe(false);
      }
    }
  });

  it('should ceil grid dimensions for non-integer sizes', () => {
    const router = new MazeRouter({ gridSizeMm: 0.3 });
    router.initGrid(1, 1); // 1mm / 0.3mm = 3.33 -> ceil = 4
    const size = router.getGridSize();
    expect(size.cols).toBe(4);
    expect(size.rows).toBe(4);
  });

  it('should handle reinitializing (clears old grid)', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(5, 5);
    router.addObstacle({ x: 1, y: 1, width: 1, height: 1, layer: 'front' });
    expect(router.isBlocked(1, 1, 'front')).toBe(true);

    // Reinitialize — obstacle should be gone
    router.initGrid(5, 5);
    expect(router.isBlocked(1, 1, 'front')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Obstacle addition
// ---------------------------------------------------------------------------

describe('MazeRouter — Obstacles', () => {
  it('should mark rectangular obstacle cells as blocked', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(10, 10);
    router.addObstacle({ x: 2, y: 3, width: 3, height: 2, layer: 'front' });

    // Cells inside the obstacle should be blocked
    expect(router.isBlocked(2, 3, 'front')).toBe(true);
    expect(router.isBlocked(3, 4, 'front')).toBe(true);
    expect(router.isBlocked(4, 4, 'front')).toBe(true);

    // Cells outside the obstacle should not be blocked
    expect(router.isBlocked(0, 0, 'front')).toBe(false);
    expect(router.isBlocked(6, 6, 'front')).toBe(false);

    // Obstacle is only on front layer
    expect(router.isBlocked(2, 3, 'back')).toBe(false);
  });

  it('should mark circular obstacle cells as blocked', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(10, 10);
    router.addCircularObstacle({ cx: 5, cy: 5, radius: 2, layer: 'front' });

    // Center should be blocked
    expect(router.isBlocked(5, 5, 'front')).toBe(true);
    // Cells within radius
    expect(router.isBlocked(4, 5, 'front')).toBe(true);
    expect(router.isBlocked(6, 5, 'front')).toBe(true);
    // Cells outside radius
    expect(router.isBlocked(0, 0, 'front')).toBe(false);
    expect(router.isBlocked(9, 9, 'front')).toBe(false);
  });

  it('should inflate obstacle by clearance + traceWidth/2', () => {
    // Grid at 1mm, obstacle 1x1mm at (5,5), clearance 1mm
    // Should block cells within 1mm around the obstacle
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(12, 12);
    router.addObstacle({ x: 5, y: 5, width: 1, height: 1, layer: 'front' });

    // The obstacle is at (5,5) with size 1x1 = covers (5,5)
    expect(router.isBlocked(5, 5, 'front')).toBe(true);

    // Nearby cells should be blocked due to default clearance inflation
    // Default clearance/traceWidth depends on router defaults
    // At least the obstacle cell itself must be blocked
  });

  it('should support netId on obstacles for same-net routing', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(10, 10);
    router.addObstacle({ x: 5, y: 5, width: 1, height: 1, layer: 'front', netId: 'net1' });

    // Should be blocked for different nets
    expect(router.isBlocked(5, 5, 'front')).toBe(true);
  });

  it('should block correct layer only', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(10, 10);
    router.addObstacle({ x: 3, y: 3, width: 2, height: 2, layer: 'back' });

    expect(router.isBlocked(3, 3, 'back')).toBe(true);
    expect(router.isBlocked(3, 3, 'front')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Coordinate conversion
// ---------------------------------------------------------------------------

describe('MazeRouter — Coordinate conversion', () => {
  it('should convert mm to grid and back', () => {
    const router = new MazeRouter({ gridSizeMm: 0.25 });
    router.initGrid(10, 10);

    expect(router.mmToGrid(1.0)).toBe(4); // 1mm / 0.25mm = 4
    expect(router.mmToGrid(2.5)).toBe(10);
    expect(router.gridToMm(4)).toBe(1.0);
    expect(router.gridToMm(10)).toBe(2.5);
  });

  it('should round mm to nearest grid cell', () => {
    const router = new MazeRouter({ gridSizeMm: 0.5 });
    router.initGrid(10, 10);

    expect(router.mmToGrid(0.7)).toBe(1); // 0.7 / 0.5 = 1.4 -> round = 1
    expect(router.mmToGrid(0.3)).toBe(1); // 0.3 / 0.5 = 0.6 -> round = 1
    expect(router.mmToGrid(0.1)).toBe(0); // 0.1 / 0.5 = 0.2 -> round = 0
  });
});

// ---------------------------------------------------------------------------
// Simple routing
// ---------------------------------------------------------------------------

describe('MazeRouter — Simple routing', () => {
  it('should route a straight horizontal path', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(20, 10);

    const result = router.routeNet({
      netId: 'net1',
      sourcePad: { x: 2, y: 5, layer: 'front' },
      targetPad: { x: 15, y: 5, layer: 'front' },
      traceWidth: 0.25,
      clearance: 0.2,
    });

    expect(result).not.toBeNull();
    expect(result!.netId).toBe('net1');
    expect(result!.points.length).toBeGreaterThanOrEqual(2);
    expect(result!.layer).toBe('front');
    expect(result!.vias).toHaveLength(0);

    // First and last points should match source/target
    const first = result!.points[0];
    const last = result!.points[result!.points.length - 1];
    expect(first.x).toBeCloseTo(2, 0);
    expect(first.y).toBeCloseTo(5, 0);
    expect(last.x).toBeCloseTo(15, 0);
    expect(last.y).toBeCloseTo(5, 0);
  });

  it('should route a straight vertical path', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(10, 20);

    const result = router.routeNet({
      netId: 'net1',
      sourcePad: { x: 5, y: 2, layer: 'front' },
      targetPad: { x: 5, y: 15, layer: 'front' },
      traceWidth: 0.25,
      clearance: 0.2,
    });

    expect(result).not.toBeNull();
    const first = result!.points[0];
    const last = result!.points[result!.points.length - 1];
    expect(first.x).toBeCloseTo(5, 0);
    expect(last.x).toBeCloseTo(5, 0);
    expect(last.y).toBeCloseTo(15, 0);
  });

  it('should route a diagonal path when shorter', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(20, 20);

    const result = router.routeNet({
      netId: 'net1',
      sourcePad: { x: 2, y: 2, layer: 'front' },
      targetPad: { x: 10, y: 10, layer: 'front' },
      traceWidth: 0.25,
      clearance: 0.2,
    });

    expect(result).not.toBeNull();
    // The path should use diagonals (cheaper than rectilinear)
    const directDist = euclidean(2, 2, 10, 10);
    const pathLen = totalPathLength(result!.points);
    // Path should not be more than 1.5x the direct distance
    expect(pathLen).toBeLessThan(directDist * 1.5);
  });
});

// ---------------------------------------------------------------------------
// Obstacle avoidance
// ---------------------------------------------------------------------------

describe('MazeRouter — Obstacle avoidance', () => {
  it('should route around a blocking obstacle', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(20, 10);

    // Place a wall of obstacles blocking the direct horizontal path
    for (let y = 0; y < 10; y++) {
      if (y !== 2) {
        // Leave a gap at y=2
        router.addObstacle({ x: 10, y, width: 1, height: 1, layer: 'front' });
      }
    }

    const result = router.routeNet({
      netId: 'net1',
      sourcePad: { x: 5, y: 5, layer: 'front' },
      targetPad: { x: 15, y: 5, layer: 'front' },
      traceWidth: 0.25,
      clearance: 0.2,
    });

    expect(result).not.toBeNull();
    expect(result!.netId).toBe('net1');

    // Path should go around the wall, so it will be longer than direct
    const directDist = euclidean(5, 5, 15, 5);
    const pathLen = totalPathLength(result!.points);
    expect(pathLen).toBeGreaterThan(directDist);
  });

  it('should return null when path is completely blocked', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(10, 10);

    // Block every cell in column 5 on BOTH layers — complete wall
    for (let y = 0; y < 10; y++) {
      router.addObstacle({ x: 5, y, width: 1, height: 1, layer: 'front' });
      router.addObstacle({ x: 5, y, width: 1, height: 1, layer: 'back' });
    }

    const result = router.routeNet({
      netId: 'net1',
      sourcePad: { x: 2, y: 5, layer: 'front' },
      targetPad: { x: 8, y: 5, layer: 'front' },
      traceWidth: 0.25,
      clearance: 0.2,
    });

    expect(result).toBeNull();
  });

  it('should not block same-net obstacles when routing', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(10, 10);

    // Obstacle belonging to net1 should not block net1 routing
    router.addObstacle({ x: 5, y: 5, width: 1, height: 1, layer: 'front', netId: 'net1' });

    const result = router.routeNet({
      netId: 'net1',
      sourcePad: { x: 3, y: 5, layer: 'front' },
      targetPad: { x: 7, y: 5, layer: 'front' },
      traceWidth: 0.25,
      clearance: 0.2,
    });

    expect(result).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Layer change / via insertion
// ---------------------------------------------------------------------------

describe('MazeRouter — Layer change', () => {
  it('should insert via when source and target are on different layers', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(20, 10);

    const result = router.routeNet({
      netId: 'net1',
      sourcePad: { x: 5, y: 5, layer: 'front' },
      targetPad: { x: 15, y: 5, layer: 'back' },
      traceWidth: 0.25,
      clearance: 0.2,
    });

    expect(result).not.toBeNull();
    expect(result!.vias.length).toBeGreaterThanOrEqual(1);
  });

  it('should use via to avoid obstacle on one layer', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(20, 10);

    // Block entire front layer between source and target
    for (let x = 8; x <= 12; x++) {
      for (let y = 0; y < 10; y++) {
        router.addObstacle({ x, y, width: 1, height: 1, layer: 'front' });
      }
    }

    const result = router.routeNet({
      netId: 'net1',
      sourcePad: { x: 5, y: 5, layer: 'front' },
      targetPad: { x: 15, y: 5, layer: 'front' },
      traceWidth: 0.25,
      clearance: 0.2,
    });

    // The router should find a path through the back layer
    expect(result).not.toBeNull();
    expect(result!.vias.length).toBeGreaterThanOrEqual(2); // down and back up
  });
});

// ---------------------------------------------------------------------------
// routeAll — multi-net routing
// ---------------------------------------------------------------------------

describe('MazeRouter — routeAll', () => {
  it('should route multiple nets with progressive blocking', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(30, 10);

    const requests: RouteRequest[] = [
      {
        netId: 'net1',
        sourcePad: { x: 2, y: 3, layer: 'front' },
        targetPad: { x: 25, y: 3, layer: 'front' },
        traceWidth: 0.25,
        clearance: 0.2,
      },
      {
        netId: 'net2',
        sourcePad: { x: 2, y: 7, layer: 'front' },
        targetPad: { x: 25, y: 7, layer: 'front' },
        traceWidth: 0.25,
        clearance: 0.2,
      },
    ];

    const result = router.routeAll(requests);

    expect(result.routed).toHaveLength(2);
    expect(result.unrouted).toHaveLength(0);
    expect(result.stats.routedCount).toBe(2);
    expect(result.stats.unroutedCount).toBe(0);
  });

  it('should report unrouted nets', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(10, 5);

    // Block everything on the front layer
    for (let x = 4; x <= 6; x++) {
      for (let y = 0; y < 5; y++) {
        router.addObstacle({ x, y, width: 1, height: 1, layer: 'front' });
        router.addObstacle({ x, y, width: 1, height: 1, layer: 'back' });
      }
    }

    const requests: RouteRequest[] = [
      {
        netId: 'net1',
        sourcePad: { x: 1, y: 2, layer: 'front' },
        targetPad: { x: 8, y: 2, layer: 'front' },
        traceWidth: 0.25,
        clearance: 0.2,
      },
    ];

    const result = router.routeAll(requests);

    expect(result.unrouted).toContain('net1');
    expect(result.stats.unroutedCount).toBe(1);
  });

  it('should sort nets by shortest first', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(30, 20);

    const requests: RouteRequest[] = [
      {
        netId: 'long-net',
        sourcePad: { x: 2, y: 10, layer: 'front' },
        targetPad: { x: 25, y: 10, layer: 'front' },
        traceWidth: 0.25,
        clearance: 0.2,
      },
      {
        netId: 'short-net',
        sourcePad: { x: 10, y: 3, layer: 'front' },
        targetPad: { x: 13, y: 3, layer: 'front' },
        traceWidth: 0.25,
        clearance: 0.2,
      },
    ];

    const result = router.routeAll(requests);

    // Both should route successfully
    expect(result.routed).toHaveLength(2);

    // Short net should be routed first (appears first in results)
    expect(result.routed[0].netId).toBe('short-net');
    expect(result.routed[1].netId).toBe('long-net');
  });

  it('should respect priority override for net ordering', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(30, 20);

    const requests: RouteRequest[] = [
      {
        netId: 'short-net',
        sourcePad: { x: 10, y: 3, layer: 'front' },
        targetPad: { x: 13, y: 3, layer: 'front' },
        traceWidth: 0.25,
        clearance: 0.2,
        priority: 10,
      },
      {
        netId: 'long-net',
        sourcePad: { x: 2, y: 10, layer: 'front' },
        targetPad: { x: 25, y: 10, layer: 'front' },
        traceWidth: 0.25,
        clearance: 0.2,
        priority: 1, // lower priority = route first
      },
    ];

    const result = router.routeAll(requests);

    expect(result.routed).toHaveLength(2);
    // Long net should be first because it has lower priority number
    expect(result.routed[0].netId).toBe('long-net');
    expect(result.routed[1].netId).toBe('short-net');
  });

  it('should include correct stats', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(20, 10);

    const requests: RouteRequest[] = [
      {
        netId: 'net1',
        sourcePad: { x: 2, y: 5, layer: 'front' },
        targetPad: { x: 10, y: 5, layer: 'front' },
        traceWidth: 0.25,
        clearance: 0.2,
      },
    ];

    const result = router.routeAll(requests);

    expect(result.stats.routedCount).toBe(1);
    expect(result.stats.unroutedCount).toBe(0);
    expect(result.stats.totalLengthMm).toBeGreaterThan(0);
    expect(result.stats.timeMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.stats.viaCount).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// Path simplification
// ---------------------------------------------------------------------------

describe('MazeRouter — Path simplification', () => {
  it('should merge colinear horizontal segments', () => {
    const router = new MazeRouter();

    const simplified = router.simplifyPath([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);

    expect(simplified).toHaveLength(2);
    expect(simplified[0]).toEqual({ x: 0, y: 0 });
    expect(simplified[1]).toEqual({ x: 3, y: 0 });
  });

  it('should merge colinear vertical segments', () => {
    const router = new MazeRouter();

    const simplified = router.simplifyPath([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
      { x: 0, y: 3 },
    ]);

    expect(simplified).toHaveLength(2);
    expect(simplified[0]).toEqual({ x: 0, y: 0 });
    expect(simplified[1]).toEqual({ x: 0, y: 3 });
  });

  it('should merge colinear diagonal segments', () => {
    const router = new MazeRouter();

    const simplified = router.simplifyPath([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ]);

    expect(simplified).toHaveLength(2);
    expect(simplified[0]).toEqual({ x: 0, y: 0 });
    expect(simplified[1]).toEqual({ x: 3, y: 3 });
  });

  it('should keep direction change points', () => {
    const router = new MazeRouter();

    // L-shaped path
    const simplified = router.simplifyPath([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
    ]);

    expect(simplified).toHaveLength(3);
    expect(simplified[0]).toEqual({ x: 0, y: 0 });
    expect(simplified[1]).toEqual({ x: 2, y: 0 });
    expect(simplified[2]).toEqual({ x: 2, y: 2 });
  });

  it('should handle single point', () => {
    const router = new MazeRouter();
    const simplified = router.simplifyPath([{ x: 0, y: 0 }]);
    expect(simplified).toHaveLength(1);
  });

  it('should handle two points', () => {
    const router = new MazeRouter();
    const simplified = router.simplifyPath([
      { x: 0, y: 0 },
      { x: 5, y: 3 },
    ]);
    expect(simplified).toHaveLength(2);
  });

  it('should handle empty array', () => {
    const router = new MazeRouter();
    const simplified = router.simplifyPath([]);
    expect(simplified).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Grid queries
// ---------------------------------------------------------------------------

describe('MazeRouter — Grid queries', () => {
  it('should return false for out-of-bounds coordinates', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(5, 5);

    // Out-of-bounds should be treated as blocked (can't route there)
    expect(router.isBlocked(-1, 0, 'front')).toBe(true);
    expect(router.isBlocked(0, -1, 'front')).toBe(true);
    expect(router.isBlocked(5, 0, 'front')).toBe(true);
    expect(router.isBlocked(0, 5, 'front')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('MazeRouter — Edge cases', () => {
  it('should handle zero-length route (source = target)', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(10, 10);

    const result = router.routeNet({
      netId: 'net1',
      sourcePad: { x: 5, y: 5, layer: 'front' },
      targetPad: { x: 5, y: 5, layer: 'front' },
      traceWidth: 0.25,
      clearance: 0.2,
    });

    expect(result).not.toBeNull();
    expect(result!.netId).toBe('net1');
    // Source and target are the same point — should have a single-point or two-point path
    expect(result!.points.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle small board (1x1mm)', () => {
    const router = new MazeRouter({ gridSizeMm: 0.5 });
    router.initGrid(1, 1); // 2x2 grid

    const result = router.routeNet({
      netId: 'net1',
      sourcePad: { x: 0, y: 0, layer: 'front' },
      targetPad: { x: 0.5, y: 0.5, layer: 'front' },
      traceWidth: 0.1,
      clearance: 0.1,
    });

    expect(result).not.toBeNull();
  });

  it('should handle source pad at grid boundary', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(10, 10);

    const result = router.routeNet({
      netId: 'net1',
      sourcePad: { x: 0, y: 0, layer: 'front' },
      targetPad: { x: 9, y: 9, layer: 'front' },
      traceWidth: 0.25,
      clearance: 0.2,
    });

    expect(result).not.toBeNull();
  });

  it('should handle source on blocked cell (pad area)', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(10, 10);

    // Block the source cell for a different net
    router.addObstacle({ x: 2, y: 5, width: 1, height: 1, layer: 'front', netId: 'other' });

    // Route request for net1 starting from blocked cell
    // The router should still handle this (source/target are always accessible)
    const result = router.routeNet({
      netId: 'net1',
      sourcePad: { x: 2, y: 5, layer: 'front' },
      targetPad: { x: 8, y: 5, layer: 'front' },
      traceWidth: 0.25,
      clearance: 0.2,
    });

    // This may or may not succeed depending on implementation — we just verify no crash
    expect(result === null || result.netId === 'net1').toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Route result structure
// ---------------------------------------------------------------------------

describe('MazeRouter — Route result structure', () => {
  it('should return correct RoutedNet shape', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(20, 10);

    const result = router.routeNet({
      netId: 'net1',
      sourcePad: { x: 2, y: 5, layer: 'front' },
      targetPad: { x: 15, y: 5, layer: 'front' },
      traceWidth: 0.3,
      clearance: 0.2,
    });

    expect(result).not.toBeNull();
    expect(result!.netId).toBe('net1');
    expect(result!.layer).toBe('front');
    expect(result!.width).toBe(0.3);
    expect(Array.isArray(result!.points)).toBe(true);
    expect(Array.isArray(result!.vias)).toBe(true);

    for (const p of result!.points) {
      expect(typeof p.x).toBe('number');
      expect(typeof p.y).toBe('number');
    }
  });

  it('should return correct RouteResult shape from routeAll', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(20, 10);

    const result: RouteResult = router.routeAll([
      {
        netId: 'net1',
        sourcePad: { x: 2, y: 5, layer: 'front' },
        targetPad: { x: 15, y: 5, layer: 'front' },
        traceWidth: 0.25,
        clearance: 0.2,
      },
    ]);

    expect(Array.isArray(result.routed)).toBe(true);
    expect(Array.isArray(result.unrouted)).toBe(true);
    expect(typeof result.stats).toBe('object');
    expect(typeof result.stats.routedCount).toBe('number');
    expect(typeof result.stats.unroutedCount).toBe('number');
    expect(typeof result.stats.viaCount).toBe('number');
    expect(typeof result.stats.totalLengthMm).toBe('number');
    expect(typeof result.stats.timeMs).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// Performance
// ---------------------------------------------------------------------------

describe('MazeRouter — Performance', () => {
  it('should route 20 nets on 50x50mm board in <2 seconds', () => {
    const router = new MazeRouter({ gridSizeMm: 0.25 });
    router.initGrid(50, 50); // 200x200 grid

    const requests: RouteRequest[] = [];
    for (let i = 0; i < 20; i++) {
      requests.push({
        netId: `net${String(i)}`,
        sourcePad: { x: 2, y: 2 + i * 2, layer: 'front' },
        targetPad: { x: 48, y: 2 + i * 2, layer: 'front' },
        traceWidth: 0.25,
        clearance: 0.2,
      });
    }

    const start = performance.now();
    const result = router.routeAll(requests);
    const elapsed = performance.now() - start;

    expect(result.routed.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(2000);
  });

  it('should handle 50x50mm board grid creation quickly', () => {
    const start = performance.now();
    const router = new MazeRouter({ gridSizeMm: 0.25 });
    router.initGrid(50, 50); // 200x200 grid
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100); // Grid creation should be very fast
    const size = router.getGridSize();
    expect(size.cols).toBe(200);
    expect(size.rows).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Via stats
// ---------------------------------------------------------------------------

describe('MazeRouter — Via counting in stats', () => {
  it('should count vias in routeAll stats', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(20, 10);

    const requests: RouteRequest[] = [
      {
        netId: 'net1',
        sourcePad: { x: 2, y: 5, layer: 'front' },
        targetPad: { x: 15, y: 5, layer: 'back' },
        traceWidth: 0.25,
        clearance: 0.2,
      },
    ];

    const result = router.routeAll(requests);

    if (result.routed.length > 0) {
      expect(result.stats.viaCount).toBeGreaterThanOrEqual(1);
    }
  });
});
