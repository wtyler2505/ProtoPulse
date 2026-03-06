/**
 * MazeRouter — Rip-up and reroute tests.
 *
 * Tests the iterative rip-up strategy: when a net fails to route, the router
 * identifies conflicting nets, removes their traces, routes the failed net,
 * then reroutes the ripped-up nets. This continues for a configurable number
 * of iterations, improving overall routing completion.
 */

import { describe, expect, it } from 'vitest';

import type { RouteRequest, RouteResult } from '@/lib/pcb/maze-router';
import { MazeRouter } from '@/lib/pcb/maze-router';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(
  netId: string,
  sx: number, sy: number,
  tx: number, ty: number,
  layer = 'front',
  priority?: number,
): RouteRequest {
  return {
    netId,
    sourcePad: { x: sx, y: sy, layer },
    targetPad: { x: tx, y: ty, layer },
    traceWidth: 0.25,
    clearance: 0.2,
    priority,
  };
}

// ---------------------------------------------------------------------------
// ripUpNet
// ---------------------------------------------------------------------------

describe('MazeRouter — ripUpNet', () => {
  it('should unblock cells occupied by a ripped-up net', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(20, 10);

    // Route a net so it occupies cells
    const req = makeRequest('net1', 2, 5, 15, 5);
    const result = router.routeNet(req);
    expect(result).not.toBeNull();

    // Block the path (simulating progressive blocking)
    // routeAll does this automatically, but routeNet alone doesn't
    // We'll use routeAll to ensure blocking happens
    const router2 = new MazeRouter({ gridSizeMm: 1 });
    router2.initGrid(20, 10);
    const allResult = router2.routeAll([req]);
    expect(allResult.routed).toHaveLength(1);

    // Now rip up the net
    router2.ripUpNet('net1');

    // The cells should be unblocked — route another net through the same path
    const req2 = makeRequest('net2', 2, 5, 15, 5);
    const result2 = router2.routeNet(req2);
    expect(result2).not.toBeNull();
  });

  it('should not affect other nets when ripping up', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(30, 10);

    const reqs: RouteRequest[] = [
      makeRequest('net1', 2, 3, 25, 3),
      makeRequest('net2', 2, 7, 25, 7),
    ];

    const result = router.routeAll(reqs);
    expect(result.routed).toHaveLength(2);

    // Rip up net1
    router.ripUpNet('net1');

    // net2's cells should still be blocked
    // Try routing net3 through net2's path — should go around
    const req3 = makeRequest('net3', 2, 7, 25, 7);
    const result3 = router.routeNet(req3);
    // net3 should either fail or route around net2 (not through it)
    if (result3) {
      // Path should not be a straight line at y=7 if net2 is still blocking
      const hasDetour = result3.points.some((p) => Math.abs(p.y - 7) > 0.5);
      expect(hasDetour).toBe(true);
    }
  });

  it('should handle ripping up a net that was not routed', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(10, 10);

    // Should not throw
    expect(() => router.ripUpNet('nonexistent')).not.toThrow();
  });

  it('should allow rerouting after rip-up', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(20, 10);

    const result = router.routeAll([makeRequest('net1', 2, 5, 15, 5)]);
    expect(result.routed).toHaveLength(1);

    router.ripUpNet('net1');

    // Should be able to reroute net1
    const rerouted = router.routeNet(makeRequest('net1', 2, 5, 15, 5));
    expect(rerouted).not.toBeNull();
    expect(rerouted!.netId).toBe('net1');
  });
});

// ---------------------------------------------------------------------------
// sortNetsByCriticality
// ---------------------------------------------------------------------------

describe('MazeRouter — sortNetsByCriticality', () => {
  it('should sort by priority first', () => {
    const router = new MazeRouter();

    const reqs: RouteRequest[] = [
      makeRequest('low-pri', 0, 0, 1, 0, 'front', 10),
      makeRequest('high-pri', 0, 0, 50, 50, 'front', 1),
      makeRequest('mid-pri', 0, 0, 5, 5, 'front', 5),
    ];

    const sorted = router.sortNetsByCriticality(reqs);
    expect(sorted[0].netId).toBe('high-pri');
    expect(sorted[1].netId).toBe('mid-pri');
    expect(sorted[2].netId).toBe('low-pri');
  });

  it('should sort by shortest distance when no priority', () => {
    const router = new MazeRouter();

    const reqs: RouteRequest[] = [
      makeRequest('long', 0, 0, 50, 50),
      makeRequest('short', 0, 0, 1, 1),
      makeRequest('medium', 0, 0, 10, 10),
    ];

    const sorted = router.sortNetsByCriticality(reqs);
    expect(sorted[0].netId).toBe('short');
    expect(sorted[1].netId).toBe('medium');
    expect(sorted[2].netId).toBe('long');
  });

  it('should handle mixed priority and non-priority', () => {
    const router = new MazeRouter();

    const reqs: RouteRequest[] = [
      makeRequest('no-pri-short', 0, 0, 1, 1),
      makeRequest('has-pri', 0, 0, 50, 50, 'front', 5),
      makeRequest('no-pri-long', 0, 0, 100, 100),
    ];

    const sorted = router.sortNetsByCriticality(reqs);
    // Priority nets come first
    expect(sorted[0].netId).toBe('has-pri');
  });

  it('should return empty array for empty input', () => {
    const router = new MazeRouter();
    const sorted = router.sortNetsByCriticality([]);
    expect(sorted).toHaveLength(0);
  });

  it('should not mutate original array', () => {
    const router = new MazeRouter();
    const reqs: RouteRequest[] = [
      makeRequest('b', 0, 0, 50, 50),
      makeRequest('a', 0, 0, 1, 1),
    ];
    const original = [...reqs];
    router.sortNetsByCriticality(reqs);
    expect(reqs[0].netId).toBe(original[0].netId);
    expect(reqs[1].netId).toBe(original[1].netId);
  });
});

// ---------------------------------------------------------------------------
// routeWithRipUp
// ---------------------------------------------------------------------------

describe('MazeRouter — routeWithRipUp', () => {
  it('should route simple nets without needing rip-up', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(30, 20);

    const reqs: RouteRequest[] = [
      makeRequest('net1', 2, 5, 25, 5),
      makeRequest('net2', 2, 15, 25, 15),
    ];

    const result = router.routeWithRipUp(reqs);
    expect(result.routed).toHaveLength(2);
    expect(result.unrouted).toHaveLength(0);
  });

  it('should improve routing via rip-up when order matters', () => {
    // Create a constrained scenario where net ordering matters
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(15, 8);

    // Place obstacles creating a narrow corridor
    for (let x = 0; x < 15; x++) {
      router.addObstacle({ x, y: 0, width: 1, height: 1, layer: 'front' });
      router.addObstacle({ x, y: 7, width: 1, height: 1, layer: 'front' });
    }

    const reqs: RouteRequest[] = [
      makeRequest('net1', 2, 3, 12, 3),
      makeRequest('net2', 2, 5, 12, 5),
      makeRequest('net3', 2, 4, 12, 4),
    ];

    const result = router.routeWithRipUp(reqs);

    // Should route all or most nets
    expect(result.stats.routedCount).toBeGreaterThanOrEqual(2);
  });

  it('should respect maxIterations parameter', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(20, 10);

    const reqs: RouteRequest[] = [
      makeRequest('net1', 2, 5, 15, 5),
    ];

    // maxIterations=0 means no rip-up, just initial routing
    const result = router.routeWithRipUp(reqs, 0);
    expect(result.routed).toHaveLength(1);
  });

  it('should default maxIterations to 3', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(20, 10);

    const reqs: RouteRequest[] = [
      makeRequest('net1', 2, 5, 15, 5),
    ];

    // Should work with default maxIterations
    const result = router.routeWithRipUp(reqs);
    expect(result.routed).toHaveLength(1);
  });

  it('should return stats with correct counts', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(30, 20);

    const reqs: RouteRequest[] = [
      makeRequest('net1', 2, 5, 25, 5),
      makeRequest('net2', 2, 15, 25, 15),
    ];

    const result = router.routeWithRipUp(reqs);
    expect(result.stats.routedCount).toBe(2);
    expect(result.stats.unroutedCount).toBe(0);
    expect(result.stats.totalLengthMm).toBeGreaterThan(0);
    expect(result.stats.timeMs).toBeGreaterThanOrEqual(0);
  });

  it('should handle empty request list', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(10, 10);

    const result = router.routeWithRipUp([]);
    expect(result.routed).toHaveLength(0);
    expect(result.unrouted).toHaveLength(0);
    expect(result.stats.routedCount).toBe(0);
  });

  it('should handle all unroutable nets', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(10, 5);

    // Block everything on both layers
    for (let x = 4; x <= 6; x++) {
      for (let y = 0; y < 5; y++) {
        router.addObstacle({ x, y, width: 1, height: 1, layer: 'front' });
        router.addObstacle({ x, y, width: 1, height: 1, layer: 'back' });
      }
    }

    const reqs: RouteRequest[] = [
      makeRequest('net1', 1, 2, 8, 2),
      makeRequest('net2', 1, 3, 8, 3),
    ];

    const result = router.routeWithRipUp(reqs);
    expect(result.unrouted).toHaveLength(2);
    expect(result.stats.unroutedCount).toBe(2);
  });

  it('should not duplicate routed nets in results', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(30, 20);

    const reqs: RouteRequest[] = [
      makeRequest('net1', 2, 5, 25, 5),
      makeRequest('net2', 2, 10, 25, 10),
      makeRequest('net3', 2, 15, 25, 15),
    ];

    const result = router.routeWithRipUp(reqs);

    // Check no duplicate netIds in routed
    const routedIds = result.routed.map((r) => r.netId);
    const uniqueIds = new Set(routedIds);
    expect(routedIds.length).toBe(uniqueIds.size);
  });

  it('should handle single net that routes successfully', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(20, 10);

    const result = router.routeWithRipUp([makeRequest('net1', 2, 5, 15, 5)]);
    expect(result.routed).toHaveLength(1);
    expect(result.routed[0].netId).toBe('net1');
    expect(result.unrouted).toHaveLength(0);
  });

  it('should handle cross-layer rip-up scenario', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(20, 10);

    const reqs: RouteRequest[] = [
      makeRequest('net1', 2, 5, 15, 5, 'front'),
      {
        netId: 'net2',
        sourcePad: { x: 2, y: 5, layer: 'front' },
        targetPad: { x: 15, y: 5, layer: 'back' },
        traceWidth: 0.25,
        clearance: 0.2,
      },
    ];

    const result = router.routeWithRipUp(reqs);
    expect(result.routed.length).toBeGreaterThanOrEqual(1);
  });

  it('should terminate even with impossible routing scenarios', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(5, 5);

    // Block all of row 2 on both layers
    for (let x = 0; x < 5; x++) {
      router.addObstacle({ x, y: 2, width: 1, height: 1, layer: 'front' });
      router.addObstacle({ x, y: 2, width: 1, height: 1, layer: 'back' });
    }

    const reqs: RouteRequest[] = [
      makeRequest('net1', 1, 1, 3, 3),
    ];

    // Should terminate quickly, not hang
    const start = performance.now();
    const result = router.routeWithRipUp(reqs, 3);
    const elapsed = performance.now() - start;

    expect(result.unrouted).toContain('net1');
    expect(elapsed).toBeLessThan(5000); // Should be fast
  });

  it('should preserve via count accuracy across rip-up iterations', () => {
    const router = new MazeRouter({ gridSizeMm: 1 });
    router.initGrid(20, 10);

    const reqs: RouteRequest[] = [
      {
        netId: 'net1',
        sourcePad: { x: 2, y: 5, layer: 'front' },
        targetPad: { x: 15, y: 5, layer: 'back' },
        traceWidth: 0.25,
        clearance: 0.2,
      },
    ];

    const result = router.routeWithRipUp(reqs);

    // Via count in stats should match sum of vias in routed nets
    const actualVias = result.routed.reduce((sum, r) => sum + r.vias.length, 0);
    expect(result.stats.viaCount).toBe(actualVias);
  });
});
