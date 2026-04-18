import { describe, it, expect } from 'vitest';
import {
  autoroute,
  extractObstaclesFromCircuit,
  type AutorouteOptions,
  type RectObstacle,
} from '../autorouter';

function baseOpts(overrides: Partial<AutorouteOptions> = {}): AutorouteOptions {
  return {
    bounds: { minX: 0, minY: 0, maxX: 50, maxY: 50 },
    resolutionMm: 1,
    traceWidthMm: 0.25,
    clearanceMm: 0.2,
    start: { x: 0, y: 0, layer: 'top' },
    end: { x: 10, y: 0, layer: 'top' },
    obstacles: [],
    layers: ['top', 'bottom'],
    viaCost: 10,
    ...overrides,
  };
}

describe('autoroute — core pathfinding', () => {
  it('routes a straight horizontal path on an empty grid', () => {
    const result = autoroute(baseOpts());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.path.length).toBeGreaterThanOrEqual(2);
    expect(result.path[0]).toEqual({ x: 0, y: 0, layer: 'top' });
    const last = result.path[result.path.length - 1]!;
    expect(last.x).toBe(10);
    expect(last.y).toBe(0);
    expect(result.viaCount).toBe(0);
  });

  it('routes a 90-degree L-path when start and end differ in x and y', () => {
    const result = autoroute(
      baseOpts({
        start: { x: 0, y: 0, layer: 'top' },
        end: { x: 5, y: 5, layer: 'top' },
      }),
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    // A* on an empty grid will produce a path of 10 cells + corners compressed.
    const last = result.path[result.path.length - 1]!;
    expect(last).toEqual({ x: 5, y: 5, layer: 'top' });
  });

  it('detours around a single rectangular obstacle', () => {
    const wall: RectObstacle = { x: 4, y: -2, width: 2, height: 6 }; // blocks y=0 between x=4..6
    const result = autoroute(
      baseOpts({
        bounds: { minX: -5, minY: -10, maxX: 20, maxY: 10 },
        obstacles: [wall],
      }),
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    // Path should not cross the obstacle interior. Verify every waypoint is
    // outside the inflated wall.
    const inflation = 0.25 / 2 + 0.2;
    for (const wp of result.path) {
      const insideX = wp.x > wall.x - inflation && wp.x < wall.x + wall.width + inflation;
      const insideY = wp.y > wall.y - inflation && wp.y < wall.y + wall.height + inflation;
      expect(insideX && insideY).toBe(false);
    }
  });

  it('fails cleanly with no-path when fully walled off', () => {
    // Wall spans the entire grid between start and end on the top layer
    // AND on the bottom layer (so no via escape).
    const wall: RectObstacle = { x: 4, y: -5, width: 2, height: 60 };
    const result = autoroute(
      baseOpts({
        obstacles: [wall],
      }),
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.reason).toBe('no-path');
  });

  it('uses a via to escape a single-layer blockade', () => {
    // Block top layer only. Router must descend to bottom to get past.
    const wall: RectObstacle = {
      x: 4,
      y: -5,
      width: 2,
      height: 60,
      layers: ['top'],
    };
    const result = autoroute(
      baseOpts({
        obstacles: [wall],
      }),
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.viaCount).toBeGreaterThanOrEqual(2); // down to bottom and back up
  });

  it('reports start-blocked when start cell is inside an obstacle', () => {
    const result = autoroute(
      baseOpts({
        obstacles: [{ x: -1, y: -1, width: 3, height: 3 }],
      }),
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.reason).toBe('start-blocked');
  });

  it('reports end-blocked when end cell is inside an obstacle', () => {
    const result = autoroute(
      baseOpts({
        obstacles: [{ x: 9, y: -1, width: 3, height: 3 }],
      }),
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.reason).toBe('end-blocked');
  });

  it('rejects invalid bounds', () => {
    const result = autoroute(
      baseOpts({ bounds: { minX: 10, minY: 0, maxX: 0, maxY: 10 } }),
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.reason).toBe('invalid-bounds');
  });

  it('routes between layers when start and end are on different layers', () => {
    const result = autoroute(
      baseOpts({
        start: { x: 0, y: 0, layer: 'top' },
        end: { x: 10, y: 0, layer: 'bottom' },
      }),
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.viaCount).toBeGreaterThanOrEqual(1);
    const last = result.path[result.path.length - 1]!;
    expect(last.layer).toBe('bottom');
  });

  it('prefers planar routing over vias when both are possible', () => {
    // Open grid, same layer — viaCount should be 0.
    const result = autoroute(
      baseOpts({
        start: { x: 0, y: 0, layer: 'top' },
        end: { x: 20, y: 20, layer: 'top' },
        bounds: { minX: -5, minY: -5, maxX: 30, maxY: 30 },
      }),
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.viaCount).toBe(0);
  });
});

describe('extractObstaclesFromCircuit', () => {
  it('maps component instances to rectangles on the correct layer', () => {
    const obstacles = extractObstaclesFromCircuit({
      instances: [
        {
          id: 1,
          pcbPosition: { x: 10, y: 10, rotation: 0, side: 'front' },
          footprintWidthMm: 4,
          footprintHeightMm: 2,
        },
        {
          id: 2,
          pcbPosition: { x: 20, y: 20, rotation: 0, side: 'back' },
        },
      ],
      otherNets: [],
      defaultFootprintMm: { width: 5, height: 5 },
    });
    expect(obstacles).toHaveLength(2);
    expect(obstacles[0]).toMatchObject({ x: 8, y: 9, width: 4, height: 2, layers: ['top'] });
    expect(obstacles[1]).toMatchObject({
      x: 17.5,
      y: 17.5,
      width: 5,
      height: 5,
      layers: ['bottom'],
    });
  });

  it('skips instances without a PCB position', () => {
    const obstacles = extractObstaclesFromCircuit({
      instances: [{ id: 1 }],
      otherNets: [],
    });
    expect(obstacles).toHaveLength(0);
  });

  it('emits small obstacles for each waypoint of other nets', () => {
    const obstacles = extractObstaclesFromCircuit({
      instances: [],
      otherNets: [
        {
          id: 99,
          segments: [
            {
              waypoints: [
                { x: 1, y: 1 },
                { x: 2, y: 1 },
              ],
            },
          ],
        },
      ],
      traceCellMm: 0.5,
    });
    expect(obstacles).toHaveLength(2);
    expect(obstacles[0]!.width).toBe(0.5);
  });
});
