/**
 * Breadboard Model Tests
 *
 * Tests for the breadboard grid coordinate system and connectivity model
 * in client/src/lib/circuit-editor/breadboard-model.ts.
 * Runs in client project config (happy-dom environment).
 */

import { describe, it, expect, vi } from 'vitest';
import {
  BB,
  areConnected,
  coordKey,
  coordToPixel,
  pixelToCoord,
  getConnectedPoints,
  getOccupiedPoints,
  checkCollision,
  checkBodyCollision,
  getAvailableZones,
  getBoardDimensions,
  getDefaultColorForNet,
  getConnectedHoles,
  WireColorManager,
  WIRE_COLOR_PRESETS,
  placementToBodyBounds,
} from '../breadboard-model';
import { getBodyBounds } from '../body-bounds';
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
    expect(areConnected(rail('left_pos', 0), rail('left_pos', 30))).toBe(true);
  });

  it('different power rails are NOT connected', () => {
    expect(areConnected(rail('left_pos', 5), rail('left_neg', 5))).toBe(false);
  });

  it('top and bottom power rails with same polarity are NOT connected', () => {
    expect(areConnected(rail('left_pos', 0), rail('right_pos', 0))).toBe(false);
  });

  it('a terminal and a rail point are NOT connected (different types)', () => {
    expect(areConnected(terminal('a', 1), rail('left_pos', 0))).toBe(false);
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
    const coord: BreadboardCoord = rail('right_neg', 10);
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
    expect(coordKey(rail('left_pos', 5))).toBe(coordKey(rail('left_pos', 5)));
  });

  it('different rail ids produce different keys', () => {
    expect(coordKey(rail('left_pos', 5))).not.toBe(coordKey(rail('left_neg', 5)));
  });

  it('terminal and rail with superficially similar data produce different keys', () => {
    // Format is "t:a1" vs "r:left_pos:0"
    expect(coordKey(terminal('a', 1))).not.toBe(coordKey(rail('left_pos', 0)));
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
    const points = getConnectedPoints(rail('left_pos', 0));
    expect(points).toHaveLength(BB.ROWS);
    points.forEach((p) => {
      expect(p.type).toBe('rail');
      expect((p as RailPoint).rail).toBe('left_pos');
    });
  });

  it('all rail indices 0..BB.ROWS-1 are present in rail connected points', () => {
    const points = getConnectedPoints(rail('right_neg', 5));
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
// getOccupiedPoints multi-column placements (regression for audit #351)
// ---------------------------------------------------------------------------

describe('getOccupiedPoints multi-column placements (regression for audit #351)', () => {
  it('3-column horizontal resistor spans cols a, b, c (primary regression)', () => {
    const placement: ComponentPlacement = {
      refDes: 'R1',
      startCol: 'a',
      startRow: 10,
      rowSpan: 1,
      crossesChannel: false,
      colSpan: 3,
    };
    const points = getOccupiedPoints(placement);
    expect(points).toHaveLength(3);
    expect(points).toContainEqual({ type: 'terminal', col: 'a', row: 10 });
    expect(points).toContainEqual({ type: 'terminal', col: 'b', row: 10 });
    expect(points).toContainEqual({ type: 'terminal', col: 'c', row: 10 });
  });

  it('placement without colSpan (undefined) returns exactly 1 point (default behavior preserved)', () => {
    const placement: ComponentPlacement = {
      refDes: 'R2',
      startCol: 'a',
      startRow: 10,
      rowSpan: 1,
      crossesChannel: false,
    };
    const points = getOccupiedPoints(placement);
    expect(points).toHaveLength(1);
    expect(points).toContainEqual({ type: 'terminal', col: 'a', row: 10 });
  });

  it('explicit colSpan=1 returns exactly 1 point (matches undefined behavior)', () => {
    const placement: ComponentPlacement = {
      refDes: 'R3',
      startCol: 'a',
      startRow: 10,
      rowSpan: 1,
      crossesChannel: false,
      colSpan: 1,
    };
    const points = getOccupiedPoints(placement);
    expect(points).toHaveLength(1);
    expect(points).toContainEqual({ type: 'terminal', col: 'a', row: 10 });
  });

  it('right-group span: startCol=h, colSpan=2 returns cols h and i', () => {
    const placement: ComponentPlacement = {
      refDes: 'R4',
      startCol: 'h',
      startRow: 5,
      rowSpan: 1,
      crossesChannel: false,
      colSpan: 2,
    };
    const points = getOccupiedPoints(placement);
    expect(points).toHaveLength(2);
    expect(points).toContainEqual({ type: 'terminal', col: 'h', row: 5 });
    expect(points).toContainEqual({ type: 'terminal', col: 'i', row: 5 });
  });

  it('group boundary: startCol=d, colSpan=3 clamps to d and e only (not f — right group)', () => {
    // colIndex: a=0,b=1,c=2,d=3,e=4,f=5,g=6,h=7,i=8,j=9
    // d is in left group (index 3 < 5). startCi=3, span=3 → ci in [3,6)
    // left group is a-e (indices 0-4). Only d(3) and e(4) satisfy 3<=ci<6 within left group.
    const placement: ComponentPlacement = {
      refDes: 'R5',
      startCol: 'd',
      startRow: 15,
      rowSpan: 1,
      crossesChannel: false,
      colSpan: 3,
    };
    const points = getOccupiedPoints(placement);
    expect(points).toHaveLength(2);
    expect(points).toContainEqual({ type: 'terminal', col: 'd', row: 15 });
    expect(points).toContainEqual({ type: 'terminal', col: 'e', row: 15 });
    expect(points.some(p => p.col === 'f')).toBe(false);
  });

  it('DIP IC (crossesChannel=true) is unaffected by colSpan field — still returns 8 points', () => {
    const placement: ComponentPlacement = {
      refDes: 'U1',
      startCol: 'e',
      startRow: 1,
      rowSpan: 4,
      crossesChannel: true,
    };
    const points = getOccupiedPoints(placement);
    // DIP branch: 4 rows × cols e+f = 8 points (colSpan is ignored)
    expect(points).toHaveLength(8);
    expect(points.filter(p => p.col === 'e')).toHaveLength(4);
    expect(points.filter(p => p.col === 'f')).toHaveLength(4);
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
// Multi-pin IC collision (BL-0477)
// ---------------------------------------------------------------------------

describe('multi-pin IC collision detection (BL-0477)', () => {
  it('16-pin DIP IC (8 rows) occupies 16 points, not 8', () => {
    const placement: ComponentPlacement = {
      refDes: 'U1',
      startCol: 'e',
      startRow: 1,
      rowSpan: 8, // 16 pins / 2 sides = 8 rows
      crossesChannel: true,
    };
    const points = getOccupiedPoints(placement);
    expect(points).toHaveLength(16); // 8 rows × 2 cols (e, f)
  });

  it('28-pin DIP IC (14 rows) occupies 28 points', () => {
    const placement: ComponentPlacement = {
      refDes: 'U2',
      startCol: 'e',
      startRow: 10,
      rowSpan: 14,
      crossesChannel: true,
    };
    const points = getOccupiedPoints(placement);
    expect(points).toHaveLength(28);
    // Rows 10..23
    const rows = Array.from(new Set(points.map(p => p.row))).sort((a, b) => a - b);
    expect(rows).toEqual(Array.from({ length: 14 }, (_, i) => 10 + i));
  });

  it('two 8-pin DIP ICs in adjacent rows collide', () => {
    const ic1: ComponentPlacement = {
      refDes: 'U1',
      startCol: 'e',
      startRow: 1,
      rowSpan: 4,
      crossesChannel: true,
    };
    const ic2: ComponentPlacement = {
      refDes: 'U2',
      startCol: 'e',
      startRow: 3, // overlaps rows 3-4 of ic1
      rowSpan: 4,
      crossesChannel: true,
    };
    expect(checkCollision(ic2, [ic1])).toBe(true);
  });

  it('two 8-pin DIP ICs placed with proper spacing do not collide', () => {
    const ic1: ComponentPlacement = {
      refDes: 'U1',
      startCol: 'e',
      startRow: 1,
      rowSpan: 4,
      crossesChannel: true,
    };
    const ic2: ComponentPlacement = {
      refDes: 'U2',
      startCol: 'e',
      startRow: 5, // starts right after ic1 ends
      rowSpan: 4,
      crossesChannel: true,
    };
    expect(checkCollision(ic2, [ic1])).toBe(false);
  });

  it('40-pin DIP IC at row boundary does not exceed board', () => {
    const placement: ComponentPlacement = {
      refDes: 'U1',
      startCol: 'e',
      startRow: 44, // 20 rows → rows 44..63, exactly at limit
      rowSpan: 20,
      crossesChannel: true,
    };
    const points = getOccupiedPoints(placement);
    expect(points).toHaveLength(40);
    const maxRow = Math.max(...points.map(p => p.row));
    expect(maxRow).toBe(63);
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

// ---------------------------------------------------------------------------
// getDefaultColorForNet (BL-0591)
// ---------------------------------------------------------------------------

describe('getDefaultColorForNet', () => {
  it('returns red for VCC', () => {
    expect(getDefaultColorForNet('VCC')).toBe('#e74c3c');
  });

  it('returns red for VDD', () => {
    expect(getDefaultColorForNet('VDD')).toBe('#e74c3c');
  });

  it('returns red for 5V', () => {
    expect(getDefaultColorForNet('5V')).toBe('#e74c3c');
  });

  it('returns red for 3V3', () => {
    expect(getDefaultColorForNet('3V3')).toBe('#e74c3c');
  });

  it('returns red for 3.3V', () => {
    expect(getDefaultColorForNet('3.3V')).toBe('#e74c3c');
  });

  it('returns black for GND', () => {
    expect(getDefaultColorForNet('GND')).toBe('#1a1a2e');
  });

  it('returns black for VSS', () => {
    expect(getDefaultColorForNet('VSS')).toBe('#1a1a2e');
  });

  it('returns blue for SDA (I2C)', () => {
    expect(getDefaultColorForNet('SDA')).toBe('#3498db');
  });

  it('returns blue for SCL (I2C)', () => {
    expect(getDefaultColorForNet('SCL')).toBe('#3498db');
  });

  it('returns blue for MOSI (SPI)', () => {
    expect(getDefaultColorForNet('MOSI')).toBe('#3498db');
  });

  it('returns blue for MISO (SPI)', () => {
    expect(getDefaultColorForNet('MISO')).toBe('#3498db');
  });

  it('returns blue for SCK (SPI clock)', () => {
    expect(getDefaultColorForNet('SCK')).toBe('#3498db');
  });

  it('returns blue for SS (SPI select)', () => {
    expect(getDefaultColorForNet('SS')).toBe('#3498db');
  });

  it('returns green (default) for generic signal names', () => {
    expect(getDefaultColorForNet('D7')).toBe('#2ecc71');
    expect(getDefaultColorForNet('LED1')).toBe('#2ecc71');
    expect(getDefaultColorForNet('PWM_OUT')).toBe('#2ecc71');
  });

  it('returns green for null', () => {
    expect(getDefaultColorForNet(null)).toBe('#2ecc71');
  });

  it('returns green for undefined', () => {
    expect(getDefaultColorForNet(undefined)).toBe('#2ecc71');
  });

  it('is case-insensitive', () => {
    expect(getDefaultColorForNet('vcc')).toBe('#e74c3c');
    expect(getDefaultColorForNet('gnd')).toBe('#1a1a2e');
    expect(getDefaultColorForNet('sda')).toBe('#3498db');
  });
});

// ---------------------------------------------------------------------------
// WireColorManager (BL-0591)
// ---------------------------------------------------------------------------

describe('WireColorManager', () => {
  it('returns default color for unknown wire IDs', () => {
    const mgr = new WireColorManager();
    expect(mgr.getWireColor('wire-999')).toBe('#2ecc71');
  });

  it('sets and retrieves a wire color', () => {
    const mgr = new WireColorManager();
    mgr.setWireColor('w1', '#e74c3c');
    expect(mgr.getWireColor('w1')).toBe('#e74c3c');
  });

  it('overrides a previously set color', () => {
    const mgr = new WireColorManager();
    mgr.setWireColor('w1', '#e74c3c');
    mgr.setWireColor('w1', '#3498db');
    expect(mgr.getWireColor('w1')).toBe('#3498db');
  });

  it('removes a wire color', () => {
    const mgr = new WireColorManager();
    mgr.setWireColor('w1', '#e74c3c');
    mgr.removeWireColor('w1');
    expect(mgr.getWireColor('w1')).toBe('#2ecc71'); // reverts to default
  });

  it('serializes to a plain object', () => {
    const mgr = new WireColorManager();
    mgr.setWireColor('w1', '#e74c3c');
    mgr.setWireColor('w2', '#3498db');
    const data = mgr.serialize();
    expect(data.wireColors).toEqual({ w1: '#e74c3c', w2: '#3498db' });
  });

  it('deserializes from a plain object', () => {
    const mgr = new WireColorManager();
    mgr.deserialize({ wireColors: { w1: '#f1c40f', w2: '#9b59b6' } });
    expect(mgr.getWireColor('w1')).toBe('#f1c40f');
    expect(mgr.getWireColor('w2')).toBe('#9b59b6');
  });

  it('deserialize clears previous state', () => {
    const mgr = new WireColorManager();
    mgr.setWireColor('old', '#111111');
    mgr.deserialize({ wireColors: { new: '#222222' } });
    expect(mgr.getWireColor('old')).toBe('#2ecc71'); // cleared
    expect(mgr.getWireColor('new')).toBe('#222222');
  });

  it('round-trips through serialize/deserialize', () => {
    const mgr1 = new WireColorManager();
    mgr1.setWireColor('a', '#aaa');
    mgr1.setWireColor('b', '#bbb');
    const data = mgr1.serialize();

    const mgr2 = new WireColorManager();
    mgr2.deserialize(data);
    expect(mgr2.getWireColor('a')).toBe('#aaa');
    expect(mgr2.getWireColor('b')).toBe('#bbb');
  });

  it('notifies listeners on setWireColor', () => {
    const mgr = new WireColorManager();
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.setWireColor('w1', '#e74c3c');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies listeners on removeWireColor', () => {
    const mgr = new WireColorManager();
    mgr.setWireColor('w1', '#e74c3c');
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.removeWireColor('w1');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies listeners on deserialize', () => {
    const mgr = new WireColorManager();
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.deserialize({ wireColors: { w1: '#e74c3c' } });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe stops notifications', () => {
    const mgr = new WireColorManager();
    const listener = vi.fn();
    const unsub = mgr.subscribe(listener);
    unsub();
    mgr.setWireColor('w1', '#e74c3c');
    expect(listener).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// WIRE_COLOR_PRESETS (BL-0591)
// ---------------------------------------------------------------------------

describe('WIRE_COLOR_PRESETS', () => {
  it('has at least 8 presets', () => {
    expect(WIRE_COLOR_PRESETS.length).toBeGreaterThanOrEqual(8);
  });

  it('each preset has a name and hex string', () => {
    for (const preset of WIRE_COLOR_PRESETS) {
      expect(typeof preset.name).toBe('string');
      expect(preset.name.length).toBeGreaterThan(0);
      expect(typeof preset.hex).toBe('string');
      expect(preset.hex).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('has no duplicate hex values', () => {
    const hexes = WIRE_COLOR_PRESETS.map(p => p.hex);
    expect(new Set(hexes).size).toBe(hexes.length);
  });
});

// ---------------------------------------------------------------------------
// getConnectedHoles (BL-0592)
// ---------------------------------------------------------------------------

describe('getConnectedHoles', () => {
  it('returns 5 left-group holes for col a, row 10', () => {
    const holes = getConnectedHoles(10, 'a');
    expect(holes).toHaveLength(5);
    const cols = holes.map(h => h.col).sort();
    expect(cols).toEqual(['a', 'b', 'c', 'd', 'e']);
    holes.forEach(h => {
      expect(h.row).toBe(10);
      expect(h.type).toBe('terminal');
    });
  });

  it('returns 5 right-group holes for col g, row 5', () => {
    const holes = getConnectedHoles(5, 'g');
    expect(holes).toHaveLength(5);
    const cols = holes.map(h => h.col).sort();
    expect(cols).toEqual(['f', 'g', 'h', 'i', 'j']);
    holes.forEach(h => {
      expect(h.row).toBe(5);
      expect(h.type).toBe('terminal');
    });
  });

  it('returns 5 left-group holes for col e (boundary of left group)', () => {
    const holes = getConnectedHoles(1, 'e');
    expect(holes).toHaveLength(5);
    const cols = holes.map(h => h.col).sort();
    expect(cols).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('returns 5 right-group holes for col f (boundary of right group)', () => {
    const holes = getConnectedHoles(1, 'f');
    expect(holes).toHaveLength(5);
    const cols = holes.map(h => h.col).sort();
    expect(cols).toEqual(['f', 'g', 'h', 'i', 'j']);
  });

  it('returns entire rail for top positive rail', () => {
    const holes = getConnectedHoles(1, '+t');
    expect(holes).toHaveLength(BB.ROWS);
    holes.forEach(h => {
      expect(h.type).toBe('rail');
      expect(h.rail).toBe('left_pos');
    });
  });

  it('returns entire rail for top negative rail', () => {
    const holes = getConnectedHoles(1, '-t');
    expect(holes).toHaveLength(BB.ROWS);
    holes.forEach(h => {
      expect(h.rail).toBe('left_neg');
    });
  });

  it('returns entire rail for bottom positive rail', () => {
    const holes = getConnectedHoles(1, '+b');
    expect(holes).toHaveLength(BB.ROWS);
    holes.forEach(h => {
      expect(h.rail).toBe('right_pos');
    });
  });

  it('returns entire rail for bottom negative rail', () => {
    const holes = getConnectedHoles(1, '-b');
    expect(holes).toHaveLength(BB.ROWS);
    holes.forEach(h => {
      expect(h.rail).toBe('right_neg');
    });
  });

  it('returns empty array for invalid column letter', () => {
    const holes = getConnectedHoles(1, 'z');
    expect(holes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// checkBodyCollision
// ---------------------------------------------------------------------------

describe('checkBodyCollision', () => {
  it('detects body collision between adjacent tall components', () => {
    // Two electrolytic caps in adjacent rows on the same column
    const existing: ComponentPlacement = {
      refDes: 'C1',
      startCol: 'a',
      startRow: 10,
      rowSpan: 2,
      crossesChannel: false,
    };
    const newPlacement: ComponentPlacement = {
      refDes: 'C2',
      startCol: 'a',
      startRow: 11,
      rowSpan: 2,
      crossesChannel: false,
    };
    // Overlapping rows with tall component type → body collision
    expect(checkBodyCollision(newPlacement, [existing], 'capacitor', 2, { subType: 'electrolytic' })).toBe(true);
  });

  it('allows flat components in adjacent rows', () => {
    const existing: ComponentPlacement = {
      refDes: 'R1',
      startCol: 'a',
      startRow: 10,
      rowSpan: 2,
      crossesChannel: false,
    };
    const newPlacement: ComponentPlacement = {
      refDes: 'R2',
      startCol: 'a',
      startRow: 11,
      rowSpan: 2,
      crossesChannel: false,
    };
    // Both resistors are flat — no body collision even though rows overlap
    expect(checkBodyCollision(newPlacement, [existing], 'resistor', 2)).toBe(false);
  });

  it('returns false when placements are far apart', () => {
    const existing: ComponentPlacement = {
      refDes: 'U1',
      startCol: 'a',
      startRow: 1,
      rowSpan: 4,
      crossesChannel: true,
    };
    const newPlacement: ComponentPlacement = {
      refDes: 'U2',
      startCol: 'a',
      startRow: 30,
      rowSpan: 4,
      crossesChannel: true,
    };
    expect(checkBodyCollision(newPlacement, [existing], 'ic', 8)).toBe(false);
  });

  it('returns false when no existing placements', () => {
    const newPlacement: ComponentPlacement = {
      refDes: 'C1',
      startCol: 'a',
      startRow: 10,
      rowSpan: 2,
      crossesChannel: false,
    };
    expect(checkBodyCollision(newPlacement, [], 'capacitor', 2, { subType: 'electrolytic' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getAvailableZones
// ---------------------------------------------------------------------------

describe('getAvailableZones', () => {
  it('returns full board range when no placements exist', () => {
    const zones = getAvailableZones(4, true, []);
    expect(zones.length).toBeGreaterThan(0);
    // First zone should start at row 1
    expect(zones[0].startRow).toBe(1);
  });

  it('returns zones for DIP IC that cross the channel', () => {
    const zones = getAvailableZones(4, true, []);
    for (const zone of zones) {
      expect(zone.crossesChannel).toBe(true);
      expect(zone.rowSpan).toBe(4);
    }
  });

  it('returns zones for single-side components', () => {
    const zones = getAvailableZones(2, false, []);
    for (const zone of zones) {
      expect(zone.crossesChannel).toBe(false);
      expect(zone.rowSpan).toBe(2);
    }
  });

  it('excludes rows occupied by existing placements', () => {
    const existing: ComponentPlacement[] = [
      { refDes: 'U1', startCol: 'e', startRow: 10, rowSpan: 4, crossesChannel: true },
    ];
    const zones = getAvailableZones(4, true, existing);
    // No zone should overlap rows 10-13
    for (const zone of zones) {
      const zoneEnd = zone.startRow + zone.rowSpan - 1;
      const occupied = zone.startRow <= 13 && zoneEnd >= 10;
      expect(occupied).toBe(false);
    }
  });

  it('returns empty array when board is fully occupied', () => {
    // Place components on every row across the channel
    const existing: ComponentPlacement[] = [];
    for (let row = 1; row <= BB.ROWS; row += 4) {
      existing.push({ refDes: `U${row}`, startCol: 'e', startRow: row, rowSpan: 4, crossesChannel: true });
    }
    const zones = getAvailableZones(4, true, existing);
    expect(zones).toEqual([]);
  });

  it('finds gaps between occupied regions', () => {
    const existing: ComponentPlacement[] = [
      { refDes: 'U1', startCol: 'e', startRow: 1, rowSpan: 4, crossesChannel: true },
      { refDes: 'U2', startCol: 'e', startRow: 10, rowSpan: 4, crossesChannel: true },
    ];
    // There should be a gap in rows 5-9 for a 4-row DIP
    const zones = getAvailableZones(4, true, existing);
    const gapZone = zones.find((z) => z.startRow >= 5 && z.startRow + z.rowSpan - 1 <= 9);
    expect(gapZone).toBeDefined();
  });

  it('respects board row limit — no zone exceeds BB.ROWS', () => {
    const zones = getAvailableZones(4, true, []);
    for (const zone of zones) {
      expect(zone.startRow + zone.rowSpan - 1).toBeLessThanOrEqual(BB.ROWS);
    }
  });
});

// ---------------------------------------------------------------------------
// placementToBodyBounds height vs width (regression for audit #352)
// ---------------------------------------------------------------------------

describe('placementToBodyBounds height vs width (regression for audit #352)', () => {
  it('DIP-8 IC: body Y is centered on footprintCenterY using baseBounds.height, not width', () => {
    // DIP-8: 8 pins, 4 per side → rowSpan = 4, crossesChannel = true
    const placement: ComponentPlacement = {
      refDes: 'U1',
      startCol: 'e',
      startRow: 10,
      rowSpan: 4,
      crossesChannel: true,
    };

    // Compute footprintCenterY the same way placementToBodyBounds does internally
    const firstPoint = { type: 'terminal' as const, col: 'e' as const, row: 10 };
    const lastPoint = { type: 'terminal' as const, col: 'e' as const, row: 13 }; // startRow + rowSpan - 1
    const origin = coordToPixel(firstPoint);
    const end = coordToPixel(lastPoint);
    const footprintCenterY = (origin.y + end.y) / 2;

    // Get the real body bounds so we don't hardcode dimensions
    const baseBounds = getBodyBounds('ic', 8);

    // For a non-square IC body (width != height), the bug produces y = footprintCenterY - width/2
    // The fix produces y = footprintCenterY - height/2
    // These diverge whenever baseBounds.width !== baseBounds.height
    expect(baseBounds.width).not.toBeCloseTo(baseBounds.height, 1); // confirm non-square fixture

    const bounds = placementToBodyBounds(placement, 'ic', 8);

    // The body must be centered on footprintCenterY using height (not width)
    expect(bounds.y).toBeCloseTo(footprintCenterY - baseBounds.height / 2, 5);

    // Equivalently: the vertical center of the returned bounds equals footprintCenterY
    expect(bounds.y + bounds.height / 2).toBeCloseTo(footprintCenterY, 5);
  });
});
