import { describe, it, expect } from 'vitest';
import { routeWire, routeAllNets, assignWireColors } from '../wire-router';
import { coordKey, type BreadboardCoord, type TiePoint } from '../breadboard-model';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a terminal tie-point shorthand. */
function tp(col: string, row: number): TiePoint {
  return { type: 'terminal', col: col as TiePoint['col'], row };
}

// ---------------------------------------------------------------------------
// routeWire
// ---------------------------------------------------------------------------

describe('routeWire', () => {
  it('returns a single-element path when from === to', () => {
    const from = tp('a', 1);
    const result = routeWire(from, from, new Set());
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: 'terminal', col: 'a', row: 1 });
  });

  it('routes a simple straight horizontal path on the same row (left side)', () => {
    const from = tp('a', 5);
    const to = tp('d', 5);
    const path = routeWire(from, to, new Set());
    expect(path.length).toBeGreaterThanOrEqual(2);
    // Start and end should match
    expect(path[0]).toMatchObject({ col: 'a', row: 5 });
    expect(path[path.length - 1]).toMatchObject({ col: 'd', row: 5 });
    // All points should be on row 5 for a straight path (no obstacles)
    for (const p of path) {
      expect(p.type).toBe('terminal');
    }
  });

  it('routes a simple straight vertical path in the same column', () => {
    const from = tp('b', 1);
    const to = tp('b', 5);
    const path = routeWire(from, to, new Set());
    expect(path.length).toBeGreaterThanOrEqual(2);
    expect(path[0]).toMatchObject({ col: 'b', row: 1 });
    expect(path[path.length - 1]).toMatchObject({ col: 'b', row: 5 });
    // All on column b
    for (const p of path) {
      if (p.type === 'terminal') {
        expect(p.col).toBe('b');
      }
    }
  });

  it('returns empty array when trying to cross the center channel (e to f)', () => {
    // The center channel blocks direct traversal between columns e and f.
    // Since the only way between col 4 (e) and col 5 (f) is blocked in the
    // adjacency graph, the path should be empty.
    const from = tp('e', 10);
    const to = tp('f', 10);
    const path = routeWire(from, to, new Set());
    expect(path).toEqual([]);
  });

  it('returns empty array for non-terminal coordinates', () => {
    const railCoord: BreadboardCoord = { type: 'rail', rail: 'top_pos', index: 5 };
    const terminal = tp('a', 1);
    expect(routeWire(railCoord, terminal, new Set())).toEqual([]);
    expect(routeWire(terminal, railCoord, new Set())).toEqual([]);
  });

  it('returns empty array when the goal is blocked by an obstacle', () => {
    const from = tp('a', 1);
    const to = tp('a', 3);
    const obstacles = new Set([coordKey(to)]);
    expect(routeWire(from, to, obstacles)).toEqual([]);
  });

  it('routes around obstacles', () => {
    const from = tp('a', 1);
    const to = tp('a', 3);
    // Block the direct path at a,2
    const blocked = tp('a', 2);
    const obstacles = new Set([coordKey(blocked)]);
    const path = routeWire(from, to, obstacles);
    expect(path.length).toBeGreaterThan(0);
    expect(path[0]).toMatchObject({ col: 'a', row: 1 });
    expect(path[path.length - 1]).toMatchObject({ col: 'a', row: 3 });
    // The blocked point should NOT be in the path
    const pathKeys = path.map(p => coordKey(p));
    expect(pathKeys).not.toContain(coordKey(blocked));
  });

  it('produces a contiguous path (each step is adjacent)', () => {
    const from = tp('c', 2);
    const to = tp('a', 10);
    const path = routeWire(from, to, new Set());
    expect(path.length).toBeGreaterThan(1);
    for (let i = 1; i < path.length; i++) {
      const prev = path[i - 1] as TiePoint;
      const curr = path[i] as TiePoint;
      const colIdx = (c: string) => 'abcdefghij'.indexOf(c);
      const colDiff = Math.abs(colIdx(prev.col) - colIdx(curr.col));
      const rowDiff = Math.abs(prev.row - curr.row);
      // Each step is exactly one cell in either column or row, not both
      expect(colDiff + rowDiff).toBe(1);
    }
  });

  it('prefers fewer turns (turn penalty)', () => {
    // From a,1 to a,5 should be a straight vertical path
    const from = tp('a', 1);
    const to = tp('a', 5);
    const path = routeWire(from, to, new Set());
    // Without obstacles, this should be 5 points straight down
    expect(path).toHaveLength(5);
    for (const p of path) {
      if (p.type === 'terminal') {
        expect(p.col).toBe('a');
      }
    }
  });

  it('returns empty array when completely boxed in', () => {
    const from = tp('a', 1);
    const to = tp('d', 1);
    // Block all neighbors of from: a,2 and b,1
    const obstacles = new Set([coordKey(tp('a', 2)), coordKey(tp('b', 1))]);
    // from has no neighbors left (a is col 0, so no left neighbor; row 1 has no up)
    const path = routeWire(from, to, obstacles);
    expect(path).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// routeAllNets
// ---------------------------------------------------------------------------

describe('routeAllNets', () => {
  it('returns empty segments for a net with fewer than 2 pins', () => {
    const result = routeAllNets(
      [{ netId: 1, pins: [tp('a', 1)] }],
      new Set(),
    );
    expect(result.get(1)).toEqual([]);
  });

  it('routes a 2-pin net and returns one segment', () => {
    const result = routeAllNets(
      [{ netId: 1, pins: [tp('a', 1), tp('a', 5)] }],
      new Set(),
    );
    const segments = result.get(1)!;
    expect(segments).toHaveLength(1);
    expect(segments[0].length).toBeGreaterThan(0);
    expect(segments[0][0]).toMatchObject({ col: 'a', row: 1 });
    expect(segments[0][segments[0].length - 1]).toMatchObject({ col: 'a', row: 5 });
  });

  it('routes a 3-pin net with 2 segments', () => {
    const result = routeAllNets(
      [{ netId: 1, pins: [tp('b', 1), tp('b', 5), tp('b', 10)] }],
      new Set(),
    );
    const segments = result.get(1)!;
    // First segment: pin[0] -> pin[1], second: pin[2] -> nearest routed
    expect(segments).toHaveLength(2);
    expect(segments[0].length).toBeGreaterThan(0);
    expect(segments[1].length).toBeGreaterThan(0);
  });

  it('does not mutate the input obstacles set', () => {
    const obstacles = new Set<string>();
    const originalSize = obstacles.size;
    routeAllNets(
      [{ netId: 1, pins: [tp('a', 1), tp('a', 5)] }],
      obstacles,
    );
    expect(obstacles.size).toBe(originalSize);
  });

  it('adds routed net points as obstacles for subsequent nets', () => {
    // Route net 1 on column a, then net 2 on column a should go around
    const result = routeAllNets(
      [
        { netId: 1, pins: [tp('a', 1), tp('a', 5)] },
        { netId: 2, pins: [tp('a', 3), tp('a', 7)] },
      ],
      new Set(),
    );
    const seg1 = result.get(1)!;
    const seg2 = result.get(2)!;
    expect(seg1.length).toBeGreaterThan(0);
    // Net 2 should still have a result (even if it needs to go around)
    expect(seg2.length).toBeGreaterThan(0);
  });

  it('handles multiple independent nets', () => {
    const result = routeAllNets(
      [
        { netId: 1, pins: [tp('a', 1), tp('c', 1)] },
        { netId: 2, pins: [tp('g', 10), tp('j', 10)] },
      ],
      new Set(),
    );
    expect(result.has(1)).toBe(true);
    expect(result.has(2)).toBe(true);
    expect(result.get(1)![0].length).toBeGreaterThan(0);
    expect(result.get(2)![0].length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// assignWireColors
// ---------------------------------------------------------------------------

describe('assignWireColors', () => {
  it('returns empty array for 0 nets', () => {
    expect(assignWireColors(0)).toEqual([]);
  });

  it('returns correct number of colors', () => {
    expect(assignWireColors(5)).toHaveLength(5);
    expect(assignWireColors(12)).toHaveLength(12);
    expect(assignWireColors(15)).toHaveLength(15);
  });

  it('returns valid hex color strings', () => {
    const colors = assignWireColors(12);
    for (const color of colors) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('cycles the palette when more nets than palette size', () => {
    const colors = assignWireColors(13);
    // 13th color should be the same as 1st
    expect(colors[12]).toBe(colors[0]);
  });

  it('returns distinct colors within the palette size', () => {
    const colors = assignWireColors(12);
    const unique = new Set(colors);
    expect(unique.size).toBe(12);
  });
});
