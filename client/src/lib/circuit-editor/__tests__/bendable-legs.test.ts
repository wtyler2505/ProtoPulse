/**
 * Tests for bendable component legs engine (BL-0593).
 *
 * Validates leg path computation, pin position resolution, SVG path
 * generation, color selection, and hole position mapping for all
 * supported component types.
 */

import { describe, it, expect } from 'vitest';
import {
  getLegColor,
  getComponentPinPositions,
  calculateLegPath,
  resolveHolePositions,
  computeComponentLegs,
  legPathToSvgD,
  approximateLegLength,
} from '../bendable-legs';
import type { LegPath, Point2D, LegComponentType } from '../bendable-legs';
import { BB } from '../breadboard-model';

// ---------------------------------------------------------------------------
// getLegColor
// ---------------------------------------------------------------------------

describe('getLegColor', () => {
  it('returns tinned copper for resistor', () => {
    expect(getLegColor('resistor')).toBe('#c0a080');
  });

  it('returns tinned copper for diode', () => {
    expect(getLegColor('diode')).toBe('#c0a080');
  });

  it('returns gold tint for capacitor', () => {
    expect(getLegColor('capacitor')).toBe('#c8b060');
  });

  it('returns silver for IC', () => {
    expect(getLegColor('ic')).toBe('#b0b0b0');
  });

  it('returns silver for transistor', () => {
    expect(getLegColor('transistor')).toBe('#b0b0b0');
  });

  it('returns silver for generic', () => {
    expect(getLegColor('generic')).toBe('#b0b0b0');
  });

  it('returns darker silver for LED cathode (pin 0)', () => {
    expect(getLegColor('led', 0)).toBe('#909090');
  });

  it('returns lighter silver for LED anode (pin 1)', () => {
    expect(getLegColor('led', 1)).toBe('#b8b8b8');
  });

  it('handles unknown type as generic silver', () => {
    expect(getLegColor('generic' as LegComponentType)).toBe('#b0b0b0');
  });
});

// ---------------------------------------------------------------------------
// getComponentPinPositions
// ---------------------------------------------------------------------------

describe('getComponentPinPositions', () => {
  it('returns 2 horizontal pins for resistor', () => {
    const pins = getComponentPinPositions(100, 50, 'resistor', 2);
    expect(pins).toHaveLength(2);
    // Both pins on the same Y axis
    expect(pins[0].y).toBe(50);
    expect(pins[1].y).toBe(50);
    // Left pin is to the left, right pin to the right
    expect(pins[0].x).toBeLessThan(100);
    expect(pins[1].x).toBeGreaterThan(100);
  });

  it('returns 2 horizontal pins for diode', () => {
    const pins = getComponentPinPositions(80, 40, 'diode', 2);
    expect(pins).toHaveLength(2);
    expect(pins[0].y).toBe(40);
    expect(pins[1].y).toBe(40);
    expect(pins[0].x).toBeLessThan(80);
    expect(pins[1].x).toBeGreaterThan(80);
  });

  it('returns 2 vertical pins for LED (cathode + anode)', () => {
    const pins = getComponentPinPositions(60, 30, 'led', 2);
    expect(pins).toHaveLength(2);
    // Both below the component center
    expect(pins[0].y).toBeGreaterThan(30);
    expect(pins[1].y).toBeGreaterThan(30);
    // Anode lead is slightly longer
    expect(pins[1].y).toBeGreaterThan(pins[0].y);
  });

  it('returns 2 vertical pins for capacitor', () => {
    const pins = getComponentPinPositions(70, 35, 'capacitor', 2);
    expect(pins).toHaveLength(2);
    expect(pins[0].y).toBeGreaterThan(35);
    expect(pins[1].y).toBeGreaterThan(35);
  });

  it('returns 3 vertical pins for transistor', () => {
    const pins = getComponentPinPositions(50, 25, 'transistor', 3);
    expect(pins).toHaveLength(3);
    // All below center
    for (const pin of pins) {
      expect(pin.y).toBeGreaterThan(25);
    }
    // Spaced horizontally: E < B < C
    expect(pins[0].x).toBeLessThan(pins[1].x);
    expect(pins[1].x).toBeLessThan(pins[2].x);
  });

  it('returns correct pin count for DIP IC (8-pin)', () => {
    const pins = getComponentPinPositions(100, 50, 'ic', 8);
    expect(pins).toHaveLength(8);
    // First 4 are left side, next 4 are right side
    for (let i = 0; i < 4; i++) {
      expect(pins[i].x).toBeLessThan(100);
    }
    for (let i = 4; i < 8; i++) {
      expect(pins[i].x).toBeGreaterThan(100);
    }
  });

  it('returns correct pin count for DIP IC (16-pin)', () => {
    const pins = getComponentPinPositions(100, 50, 'ic', 16);
    expect(pins).toHaveLength(16);
  });

  it('returns 2 pins for generic type', () => {
    const pins = getComponentPinPositions(50, 50, 'generic', 2);
    expect(pins).toHaveLength(2);
    expect(pins[0].x).toBeLessThan(50);
    expect(pins[1].x).toBeGreaterThan(50);
  });

  it('IC left-side pins are evenly spaced vertically', () => {
    const pins = getComponentPinPositions(100, 50, 'ic', 8);
    const leftPins = pins.slice(0, 4);
    for (let i = 1; i < leftPins.length; i++) {
      const spacing = leftPins[i].y - leftPins[i - 1].y;
      expect(spacing).toBe(BB.PITCH);
    }
  });
});

// ---------------------------------------------------------------------------
// calculateLegPath
// ---------------------------------------------------------------------------

describe('calculateLegPath', () => {
  it('returns a LegPath with valid structure', () => {
    const start: Point2D = { x: 50, y: 30 };
    const end: Point2D = { x: 50, y: 80 };
    const leg = calculateLegPath(start, end, 'led', 0, 1);

    expect(leg.startPin).toEqual(start);
    expect(leg.endHole).toEqual(end);
    expect(leg.bendPoints).toHaveLength(1);
    expect(leg.legColor).toBe('#909090'); // LED cathode
    expect(leg.legId).toBe('leg-1-0');
  });

  it('creates vertical L-bend for mostly vertical displacement', () => {
    const start: Point2D = { x: 50, y: 10 };
    const end: Point2D = { x: 55, y: 100 };
    const leg = calculateLegPath(start, end, 'resistor', 0, 2);

    // Control point should be at (startX, endY) for vertical L-bend
    const cp = leg.bendPoints[0];
    expect(cp.x).toBe(start.x);
    expect(cp.y).toBe(end.y);
  });

  it('creates horizontal L-bend for mostly horizontal displacement', () => {
    const start: Point2D = { x: 10, y: 50 };
    const end: Point2D = { x: 100, y: 55 };
    const leg = calculateLegPath(start, end, 'resistor', 0, 3);

    // Control point should be at (endX, startY) for horizontal L-bend
    const cp = leg.bendPoints[0];
    expect(cp.x).toBe(end.x);
    expect(cp.y).toBe(start.y);
  });

  it('creates diagonal bend for vertical-exit components', () => {
    const start: Point2D = { x: 50, y: 50 };
    const end: Point2D = { x: 80, y: 80 };
    const leg = calculateLegPath(start, end, 'led', 0, 4);

    const cp = leg.bendPoints[0];
    // Vertical-exit: control favors vertical travel (closer to endY)
    expect(cp.y).toBeGreaterThan((start.y + end.y) / 2);
  });

  it('creates diagonal bend for horizontal-exit components', () => {
    const start: Point2D = { x: 50, y: 50 };
    const end: Point2D = { x: 80, y: 80 };
    const leg = calculateLegPath(start, end, 'resistor', 0, 5);

    const cp = leg.bendPoints[0];
    // Horizontal-exit: control favors horizontal travel (closer to endX)
    expect(cp.x).toBeGreaterThan((start.x + end.x) / 2);
  });

  it('uses correct leg color per component type and pin index', () => {
    const s: Point2D = { x: 0, y: 0 };
    const e: Point2D = { x: 10, y: 10 };

    expect(calculateLegPath(s, e, 'resistor', 0, 1).legColor).toBe('#c0a080');
    expect(calculateLegPath(s, e, 'ic', 0, 1).legColor).toBe('#b0b0b0');
    expect(calculateLegPath(s, e, 'led', 0, 1).legColor).toBe('#909090');
    expect(calculateLegPath(s, e, 'led', 1, 1).legColor).toBe('#b8b8b8');
  });

  it('generates unique legId from instanceId and pinIndex', () => {
    const s: Point2D = { x: 0, y: 0 };
    const e: Point2D = { x: 10, y: 10 };
    const leg1 = calculateLegPath(s, e, 'generic', 0, 42);
    const leg2 = calculateLegPath(s, e, 'generic', 1, 42);
    const leg3 = calculateLegPath(s, e, 'generic', 0, 43);

    expect(leg1.legId).toBe('leg-42-0');
    expect(leg2.legId).toBe('leg-42-1');
    expect(leg3.legId).toBe('leg-43-0');
    expect(leg1.legId).not.toBe(leg2.legId);
    expect(leg1.legId).not.toBe(leg3.legId);
  });
});

// ---------------------------------------------------------------------------
// resolveHolePositions
// ---------------------------------------------------------------------------

describe('resolveHolePositions', () => {
  it('returns 2 positions for resistor', () => {
    const holes = resolveHolePositions('a', 5, 'resistor', 2);
    expect(holes).toHaveLength(2);
    // Both at the same Y (same row)
    expect(holes[0].y).toBe(holes[1].y);
    // Different X (different columns)
    expect(holes[0].x).not.toBe(holes[1].x);
  });

  it('returns 2 positions for diode with shorter span', () => {
    const holes = resolveHolePositions('b', 10, 'diode', 2);
    expect(holes).toHaveLength(2);
    expect(holes[0].y).toBe(holes[1].y);
  });

  it('returns 2 adjacent-row positions for LED', () => {
    const holes = resolveHolePositions('c', 8, 'led', 2);
    expect(holes).toHaveLength(2);
    // Same column (same X), adjacent rows (different Y)
    expect(holes[0].x).toBe(holes[1].x);
    expect(holes[1].y).toBe(holes[0].y + BB.PITCH);
  });

  it('returns 2 adjacent-row positions for capacitor', () => {
    const holes = resolveHolePositions('d', 3, 'capacitor', 2);
    expect(holes).toHaveLength(2);
    expect(holes[0].x).toBe(holes[1].x);
  });

  it('returns 3 positions for transistor', () => {
    const holes = resolveHolePositions('b', 5, 'transistor', 3);
    expect(holes).toHaveLength(3);
    // All same column
    expect(holes[0].x).toBe(holes[1].x);
    expect(holes[1].x).toBe(holes[2].x);
    // Evenly spaced rows
    expect(holes[1].y - holes[0].y).toBe(BB.PITCH);
    expect(holes[2].y - holes[1].y).toBe(BB.PITCH);
  });

  it('returns correct count for IC (8-pin)', () => {
    const holes = resolveHolePositions('e', 5, 'ic', 8);
    expect(holes).toHaveLength(8);
    // First 4 in column e, next 4 in column f
    const leftX = holes[0].x;
    const rightX = holes[4].x;
    expect(rightX).toBeGreaterThan(leftX);
    for (let i = 0; i < 4; i++) {
      expect(holes[i].x).toBe(leftX);
    }
    for (let i = 4; i < 8; i++) {
      expect(holes[i].x).toBe(rightX);
    }
  });

  it('clamps column index to valid range for resistor spanning past j', () => {
    const holes = resolveHolePositions('h', 1, 'resistor', 2);
    expect(holes).toHaveLength(2);
    // Should not throw, end column clamped to j (index 9)
    expect(holes[1].x).toBeGreaterThanOrEqual(holes[0].x);
  });

  it('returns 2 positions for generic type', () => {
    const holes = resolveHolePositions('c', 10, 'generic', 2);
    expect(holes).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// computeComponentLegs
// ---------------------------------------------------------------------------

describe('computeComponentLegs', () => {
  it('returns 2 legs for a resistor', () => {
    const legs = computeComponentLegs(100, 50, 'a', 5, 'resistor', 2, 1);
    expect(legs).toHaveLength(2);
    legs.forEach(leg => {
      expect(leg.startPin).toBeDefined();
      expect(leg.endHole).toBeDefined();
      expect(leg.bendPoints.length).toBeGreaterThanOrEqual(1);
      expect(leg.legColor).toBeTruthy();
      expect(leg.legId).toBeTruthy();
    });
  });

  it('returns 2 legs for an LED', () => {
    const legs = computeComponentLegs(60, 30, 'c', 8, 'led', 2, 2);
    expect(legs).toHaveLength(2);
    // Cathode and anode have different colors
    expect(legs[0].legColor).not.toBe(legs[1].legColor);
  });

  it('returns 3 legs for a transistor', () => {
    const legs = computeComponentLegs(50, 25, 'b', 5, 'transistor', 3, 3);
    expect(legs).toHaveLength(3);
  });

  it('returns correct pin count for DIP IC', () => {
    const legs = computeComponentLegs(100, 50, 'e', 5, 'ic', 8, 4);
    expect(legs).toHaveLength(8);
  });

  it('each leg has unique legId', () => {
    const legs = computeComponentLegs(100, 50, 'a', 5, 'resistor', 2, 99);
    const ids = legs.map(l => l.legId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('handles generic type with 2 pins', () => {
    const legs = computeComponentLegs(50, 50, 'c', 10, 'generic', 2, 5);
    expect(legs).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// legPathToSvgD
// ---------------------------------------------------------------------------

describe('legPathToSvgD', () => {
  it('generates a straight line when no bend points', () => {
    const leg: LegPath = {
      startPin: { x: 10, y: 20 },
      endHole: { x: 50, y: 80 },
      bendPoints: [],
      legColor: '#b0b0b0',
      legId: 'test-0',
    };
    const d = legPathToSvgD(leg);
    expect(d).toBe('M 10 20 L 50 80');
  });

  it('generates a quadratic bezier with one bend point', () => {
    const leg: LegPath = {
      startPin: { x: 10, y: 20 },
      endHole: { x: 50, y: 80 },
      bendPoints: [{ x: 30, y: 40 }],
      legColor: '#b0b0b0',
      legId: 'test-1',
    };
    const d = legPathToSvgD(leg);
    expect(d).toBe('M 10 20 Q 30 40 50 80');
  });

  it('generates chained quadratic beziers with multiple bend points', () => {
    const leg: LegPath = {
      startPin: { x: 0, y: 0 },
      endHole: { x: 100, y: 100 },
      bendPoints: [{ x: 20, y: 40 }, { x: 80, y: 60 }],
      legColor: '#b0b0b0',
      legId: 'test-2',
    };
    const d = legPathToSvgD(leg);
    expect(d).toContain('M 0 0');
    expect(d).toContain('Q');
    // Should have 2 Q commands
    const qCount = (d.match(/Q/g) ?? []).length;
    expect(qCount).toBe(2);
  });

  it('path string starts with M and contains coordinates', () => {
    const leg: LegPath = {
      startPin: { x: 5, y: 10 },
      endHole: { x: 95, y: 90 },
      bendPoints: [{ x: 50, y: 50 }],
      legColor: '#aaa',
      legId: 'test-3',
    };
    const d = legPathToSvgD(leg);
    expect(d.startsWith('M')).toBe(true);
    expect(d).toContain('5');
    expect(d).toContain('10');
    expect(d).toContain('95');
    expect(d).toContain('90');
  });
});

// ---------------------------------------------------------------------------
// approximateLegLength
// ---------------------------------------------------------------------------

describe('approximateLegLength', () => {
  it('returns exact distance for straight line (no bend points)', () => {
    const leg: LegPath = {
      startPin: { x: 0, y: 0 },
      endHole: { x: 30, y: 40 },
      bendPoints: [],
      legColor: '#aaa',
      legId: 'len-0',
    };
    expect(approximateLegLength(leg)).toBe(50); // 3-4-5 triangle
  });

  it('returns value between chord and polygon for curved leg', () => {
    const leg: LegPath = {
      startPin: { x: 0, y: 0 },
      endHole: { x: 100, y: 0 },
      bendPoints: [{ x: 50, y: 50 }],
      legColor: '#aaa',
      legId: 'len-1',
    };
    const length = approximateLegLength(leg);
    const chord = 100; // straight line
    const polygon = Math.hypot(50, 50) + Math.hypot(50, 50); // ~141.42
    expect(length).toBeGreaterThan(chord);
    expect(length).toBeLessThan(polygon);
  });

  it('returns 0 for zero-length leg', () => {
    const leg: LegPath = {
      startPin: { x: 50, y: 50 },
      endHole: { x: 50, y: 50 },
      bendPoints: [],
      legColor: '#aaa',
      legId: 'len-2',
    };
    expect(approximateLegLength(leg)).toBe(0);
  });

  it('increases with more curvature', () => {
    const straight: LegPath = {
      startPin: { x: 0, y: 0 },
      endHole: { x: 100, y: 0 },
      bendPoints: [],
      legColor: '#aaa',
      legId: 'len-3a',
    };
    const curved: LegPath = {
      startPin: { x: 0, y: 0 },
      endHole: { x: 100, y: 0 },
      bendPoints: [{ x: 50, y: 80 }],
      legColor: '#aaa',
      legId: 'len-3b',
    };
    expect(approximateLegLength(curved)).toBeGreaterThan(approximateLegLength(straight));
  });
});

// ---------------------------------------------------------------------------
// Integration: full pipeline
// ---------------------------------------------------------------------------

describe('full pipeline integration', () => {
  it('resistor: pin positions → hole positions → legs → SVG paths', () => {
    const legs = computeComponentLegs(100, 90, 'b', 10, 'resistor', 2, 10);
    expect(legs).toHaveLength(2);

    for (const leg of legs) {
      const d = legPathToSvgD(leg);
      expect(d.startsWith('M')).toBe(true);
      const length = approximateLegLength(leg);
      expect(length).toBeGreaterThan(0);
    }
  });

  it('LED: generates 2 legs with different colors', () => {
    const legs = computeComponentLegs(60, 50, 'c', 8, 'led', 2, 11);
    expect(legs).toHaveLength(2);
    expect(legs[0].legColor).not.toBe(legs[1].legColor);

    const d0 = legPathToSvgD(legs[0]);
    const d1 = legPathToSvgD(legs[1]);
    expect(d0).not.toBe(d1);
  });

  it('IC 8-pin: generates 8 legs, all convertible to SVG paths', () => {
    const legs = computeComponentLegs(120, 60, 'e', 5, 'ic', 8, 12);
    expect(legs).toHaveLength(8);

    for (const leg of legs) {
      const d = legPathToSvgD(leg);
      expect(d).toBeTruthy();
      expect(d.startsWith('M')).toBe(true);
    }
  });

  it('transistor: generates 3 legs at 3 different holes', () => {
    const legs = computeComponentLegs(50, 25, 'b', 5, 'transistor', 3, 13);
    expect(legs).toHaveLength(3);

    // All end holes should be at different Y positions
    const endYs = legs.map(l => l.endHole.y);
    expect(new Set(endYs).size).toBe(3);
  });
});
