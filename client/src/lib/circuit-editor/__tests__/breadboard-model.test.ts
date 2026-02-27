/**
 * Breadboard Model Tests
 *
 * Tests for the breadboard grid coordinate system and connectivity model
 * in client/src/lib/circuit-editor/breadboard-model.ts.
 * Runs in client project config (happy-dom environment).
 */

import { describe, it, expect } from 'vitest';
import {
  BB,
  areConnected,
  coordKey,
  coordToPixel,
  pixelToCoord,
  getConnectedPoints,
  getOccupiedPoints,
  checkCollision,
  getBoardDimensions,
} from '../breadboard-model';
import type {
  BreadboardCoord,
  TiePoint,
  RailPoint,
  ComponentPlacement,
} from '../breadboard-model';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function terminal(col: TiePoint['col'], row: number): TiePoint {
  return { type: 'terminal', col, row };
}

function rail(r: RailPoint['rail'], index: number): RailPoint {
  return { type: 'rail', rail: r, index };
}

// ---------------------------------------------------------------------------
// areConnected
// ---------------------------------------------------------------------------

describe('areConnected', () => {
  it('same left-group terminals in same row (cols a-e) are connected', () => {
    expect(areConnected(terminal('a', 5), terminal('e', 5))).toBe(true);
  });

  it('two adjacent left-group terminals in same row are connected', () => {
    expect(areConnected(terminal('b', 10), terminal('c', 10))).toBe(true);
  });

  it('same right-group terminals in same row (cols f-j) are connected', () => {
    expect(areConnected(terminal('f', 3), terminal('j', 3))).toBe(true);
  });

  it('two adjacent right-group terminals in same row are connected', () => {
    expect(areConnected(terminal('g', 7), terminal('h', 7))).toBe(true);
  });

  it('terminals across center channel (col e → col f, same row) are NOT connected', () => {
    expect(areConnected(terminal('e', 5), terminal('f', 5))).toBe(false);
  });

  it('terminals in the same column but different rows are NOT connected', () => {
    expect(areConnected(terminal('a', 1), terminal('a', 2))).toBe(false);
  });

  it('same exact terminal point is connected to itself', () => {
    expect(areConnected(terminal('c', 15), terminal('c', 15))).toBe(true);
  });

  it('left-group terminal and right-group terminal in same row are NOT connected', () => {
    // a is left (index 0), j is right (index 9)
    expect(areConnected(terminal('a', 5), terminal('j', 5))).toBe(false);
  });

  it('same power rail points are connected', () => {
    expect(areConnected(rail('top_pos', 0), rail('top_pos', 30))).toBe(true);
  });

  it('different power rails are NOT connected', () => {
    expect(areConnected(rail('top_pos', 5), rail('top_neg', 5))).toBe(false);
  });

  it('top and bottom power rails with same polarity are NOT connected', () => {
    expect(areConnected(rail('top_pos', 0), rail('bottom_pos', 0))).toBe(false);
  });

  it('a terminal and a rail point are NOT connected (different types)', () => {
    expect(areConnected(terminal('a', 1), rail('top_pos', 0))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// coordToPixel and pixelToCoord
// ---------------------------------------------------------------------------

describe('coordToPixel', () => {
  it('terminal (a, 1) maps to the board origin offset', () => {
    const px = coordToPixel(terminal('a', 1));
    // col a is index 0, row 1 → y = ORIGIN_Y + (1-1)*PITCH = ORIGIN_Y
    expect(px.x).toBe(BB.ORIGIN_X + 0 * BB.PITCH);
    expect(px.y).toBe(BB.ORIGIN_Y + 0 * BB.PITCH);
  });

  it('terminal (f, 1) has a channel gap added to its x coordinate', () => {
    const pxE = coordToPixel(terminal('e', 1));
    const pxF = coordToPixel(terminal('f', 1));
    // col e is index 4 (no gap), col f is index 5 (gap applied)
    expect(pxF.x - pxE.x).toBe(BB.PITCH + BB.CHANNEL_GAP);
  });

  it('terminal row increases y by PITCH per row', () => {
    const px1 = coordToPixel(terminal('a', 1));
    const px2 = coordToPixel(terminal('a', 2));
    expect(px2.y - px1.y).toBe(BB.PITCH);
  });

  it('returns a PixelPos with x and y numbers', () => {
    const px = coordToPixel(terminal('b', 3));
    expect(typeof px.x).toBe('number');
    expect(typeof px.y).toBe('number');
  });
});

describe('pixelToCoord round-trip', () => {
  it('round-trips terminal (a, 1) exactly', () => {
    const coord: BreadboardCoord = terminal('a', 1);
    const px = coordToPixel(coord);
    const back = pixelToCoord(px);
    expect(back).not.toBeNull();
    expect(back?.type).toBe('terminal');
    if (back?.type === 'terminal') {
      expect(back.col).toBe('a');
      expect(back.row).toBe(1);
    }
  });

  it('round-trips terminal (j, 63) exactly', () => {
    const coord: BreadboardCoord = terminal('j', 63);
    const px = coordToPixel(coord);
    const back = pixelToCoord(px);
    expect(back).not.toBeNull();
    expect(back?.type).toBe('terminal');
    if (back?.type === 'terminal') {
      expect(back.col).toBe('j');
      expect(back.row).toBe(63);
    }
  });

  it('round-trips a rail point exactly', () => {
    const coord: BreadboardCoord = rail('bottom_neg', 10);
    const px = coordToPixel(coord);
    const back = pixelToCoord(px);
    expect(back).not.toBeNull();
    expect(back?.type).toBe('rail');
  });

  it('returns null for a pixel far from any tie-point', () => {
    // A pixel at 0,0 is far from any grid point (ORIGIN_X=30, ORIGIN_Y=50)
    const result = pixelToCoord({ x: 0, y: 0 }, 1);
    expect(result).toBeNull();
  });

  it('returns null when pixel exceeds snapRadius from nearest point', () => {
    // Terminal (a,1) is at (ORIGIN_X, ORIGIN_Y) = (30, 50)
    // Place at PITCH+1 away from it with a tiny snap radius
    const farPx = { x: BB.ORIGIN_X + BB.PITCH + 1, y: BB.ORIGIN_Y + BB.PITCH + 1 };
    const result = pixelToCoord(farPx, 1);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// coordKey
// ---------------------------------------------------------------------------

describe('coordKey', () => {
  it('same terminal coord produces the same key', () => {
    expect(coordKey(terminal('c', 7))).toBe(coordKey(terminal('c', 7)));
  });

  it('different terminal coords produce different keys', () => {
    expect(coordKey(terminal('a', 1))).not.toBe(coordKey(terminal('b', 1)));
  });

  it('different rows produce different keys', () => {
    expect(coordKey(terminal('a', 1))).not.toBe(coordKey(terminal('a', 2)));
  });

  it('same rail coord produces the same key', () => {
    expect(coordKey(rail('top_pos', 5))).toBe(coordKey(rail('top_pos', 5)));
  });

  it('different rail ids produce different keys', () => {
    expect(coordKey(rail('top_pos', 5))).not.toBe(coordKey(rail('top_neg', 5)));
  });

  it('terminal and rail with superficially similar data produce different keys', () => {
    // Format is "t:a1" vs "r:top_pos:0"
    expect(coordKey(terminal('a', 1))).not.toBe(coordKey(rail('top_pos', 0)));
  });
});

// ---------------------------------------------------------------------------
// getConnectedPoints
// ---------------------------------------------------------------------------

describe('getConnectedPoints', () => {
  it('terminal in left group (col a-e) returns exactly 5 points for that row', () => {
    const points = getConnectedPoints(terminal('b', 10));
    expect(points).toHaveLength(5);
    const cols = points.map((p) => (p as TiePoint).col).sort();
    expect(cols).toEqual(['a', 'b', 'c', 'd', 'e']);
    points.forEach((p) => expect((p as TiePoint).row).toBe(10));
  });

  it('terminal in right group (col f-j) returns exactly 5 points for that row', () => {
    const points = getConnectedPoints(terminal('h', 20));
    expect(points).toHaveLength(5);
    const cols = points.map((p) => (p as TiePoint).col).sort();
    expect(cols).toEqual(['f', 'g', 'h', 'i', 'j']);
    points.forEach((p) => expect((p as TiePoint).row).toBe(20));
  });

  it('power rail point returns all BB.ROWS points for that rail', () => {
    const points = getConnectedPoints(rail('top_pos', 0));
    expect(points).toHaveLength(BB.ROWS);
    points.forEach((p) => {
      expect(p.type).toBe('rail');
      expect((p as RailPoint).rail).toBe('top_pos');
    });
  });

  it('all rail indices 0..BB.ROWS-1 are present in rail connected points', () => {
    const points = getConnectedPoints(rail('bottom_neg', 5));
    const indices = (points as RailPoint[]).map((p) => p.index).sort((a, b) => a - b);
    expect(indices[0]).toBe(0);
    expect(indices[BB.ROWS - 1]).toBe(BB.ROWS - 1);
  });

  it('returned left-group points all have the same row as input', () => {
    const points = getConnectedPoints(terminal('e', 33));
    (points as TiePoint[]).forEach((p) => expect(p.row).toBe(33));
  });
});

// ---------------------------------------------------------------------------
// getOccupiedPoints
// ---------------------------------------------------------------------------

describe('getOccupiedPoints', () => {
  it('DIP placement (crossesChannel=true) occupies col e and col f for each spanned row', () => {
    const placement: ComponentPlacement = {
      refDes: 'U1',
      startCol: 'e',
      startRow: 5,
      rowSpan: 4,
      crossesChannel: true,
    };
    const points = getOccupiedPoints(placement);
    // 4 rows × 2 cols (e and f) = 8 points
    expect(points).toHaveLength(8);
    const eCols = points.filter((p) => p.col === 'e');
    const fCols = points.filter((p) => p.col === 'f');
    expect(eCols).toHaveLength(4);
    expect(fCols).toHaveLength(4);
    // Rows 5, 6, 7, 8
    const rows = Array.from(new Set(points.map((p) => p.row))).sort((a, b) => a - b);
    expect(rows).toEqual([5, 6, 7, 8]);
  });

  it('non-DIP placement with 1 rowSpan occupies exactly 1 point', () => {
    const placement: ComponentPlacement = {
      refDes: 'R1',
      startCol: 'c',
      startRow: 10,
      rowSpan: 1,
      crossesChannel: false,
    };
    const points = getOccupiedPoints(placement);
    // Non-crossing: only the start column in the group that matches
    // The loop filters: colIndex[col] >= colIndex[startCol] && < colIndex[startCol]+1
    // So only col 'c' (index 2) is included for startCol 'c' (index 2)
    expect(points).toHaveLength(1);
    expect(points[0].col).toBe('c');
    expect(points[0].row).toBe(10);
  });

  it('DIP placement with rowSpan=2 occupies 4 points (2 rows × 2 cols)', () => {
    const placement: ComponentPlacement = {
      refDes: 'IC1',
      startCol: 'e',
      startRow: 1,
      rowSpan: 2,
      crossesChannel: true,
    };
    const points = getOccupiedPoints(placement);
    expect(points).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// checkCollision
// ---------------------------------------------------------------------------

describe('checkCollision', () => {
  it('returns true for overlapping DIP placements', () => {
    const p1: ComponentPlacement = {
      refDes: 'U1',
      startCol: 'e',
      startRow: 1,
      rowSpan: 4,
      crossesChannel: true,
    };
    const p2: ComponentPlacement = {
      refDes: 'U2',
      startCol: 'e',
      startRow: 3, // overlaps rows 3 and 4 with p1
      rowSpan: 4,
      crossesChannel: true,
    };
    expect(checkCollision(p2, [p1])).toBe(true);
  });

  it('returns false for non-overlapping placements', () => {
    const p1: ComponentPlacement = {
      refDes: 'U1',
      startCol: 'e',
      startRow: 1,
      rowSpan: 4,
      crossesChannel: true,
    };
    const p2: ComponentPlacement = {
      refDes: 'U2',
      startCol: 'e',
      startRow: 10, // far away, no overlap
      rowSpan: 4,
      crossesChannel: true,
    };
    expect(checkCollision(p2, [p1])).toBe(false);
  });

  it('returns false when existing placements list is empty', () => {
    const p: ComponentPlacement = {
      refDes: 'R1',
      startCol: 'a',
      startRow: 5,
      rowSpan: 1,
      crossesChannel: false,
    };
    expect(checkCollision(p, [])).toBe(false);
  });

  it('returns true when new placement exactly matches an existing one', () => {
    const p: ComponentPlacement = {
      refDes: 'U1',
      startCol: 'e',
      startRow: 5,
      rowSpan: 3,
      crossesChannel: true,
    };
    // Same placement — perfect overlap
    const duplicate: ComponentPlacement = { ...p, refDes: 'U2' };
    expect(checkCollision(duplicate, [p])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getBoardDimensions
// ---------------------------------------------------------------------------

describe('getBoardDimensions', () => {
  it('returns an object with numeric width and height properties', () => {
    const dims = getBoardDimensions();
    expect(typeof dims.width).toBe('number');
    expect(typeof dims.height).toBe('number');
  });

  it('width is greater than zero', () => {
    const dims = getBoardDimensions();
    expect(dims.width).toBeGreaterThan(0);
  });

  it('height is greater than zero', () => {
    const dims = getBoardDimensions();
    expect(dims.height).toBeGreaterThan(0);
  });

  it('width is at least as large as the rightmost terminal column pixel x', () => {
    const rightmostX = coordToPixel(terminal('j', 1)).x;
    const dims = getBoardDimensions();
    expect(dims.width).toBeGreaterThanOrEqual(rightmostX);
  });

  it('height is at least as large as the bottommost terminal row pixel y', () => {
    const bottomY = coordToPixel(terminal('a', BB.ROWS)).y;
    const dims = getBoardDimensions();
    expect(dims.height).toBeGreaterThanOrEqual(bottomY);
  });
});
