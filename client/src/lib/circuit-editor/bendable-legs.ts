/**
 * Bendable component legs engine (BL-0593).
 *
 * Models the flexible metal leads that connect through-hole component body
 * pins to their inserted breadboard tie-point holes.  Each leg is a curved
 * SVG path (quadratic bezier) from the pin exit point on the component body
 * to the destination breadboard hole.
 *
 * Supports per-component-type coloring:
 *   - Silver/grey metallic for IC, transistor, generic leads
 *   - Tinned copper for resistor, diode leads
 *   - Gold-tinted for capacitor leads
 *   - Darker silver for LED cathode vs. lighter for anode
 */

import { BB, coordToPixel } from './breadboard-model';
import type { ColumnLetter } from './breadboard-model';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 2D point */
export interface Point2D {
  x: number;
  y: number;
}

/** A rectangular bounding box for a component body */
export interface BodyRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Describes a single leg path from component pin to breadboard hole */
export interface LegPath {
  /** Pin exit point on the component body edge */
  startPin: Point2D;
  /** Destination breadboard hole center */
  endHole: Point2D;
  /** Quadratic bezier control point(s) for the curve */
  bendPoints: Point2D[];
  /** CSS color for the leg wire */
  legColor: string;
  /** Unique key for React rendering */
  legId: string;
}

/** Component orientation for leg routing */
export type LegOrientation = 'horizontal' | 'vertical';

/** Supported component types for leg color selection */
export type LegComponentType =
  | 'resistor'
  | 'capacitor'
  | 'led'
  | 'ic'
  | 'diode'
  | 'transistor'
  | 'generic';

// ---------------------------------------------------------------------------
// Leg color palette
// ---------------------------------------------------------------------------

/** Metallic silver (IC/transistor/generic leads) */
const SILVER = '#b0b0b0';
/** Tinned copper (resistor/diode axial leads) */
const TINNED_COPPER = '#c0a080';
/** Gold-tinted (capacitor leads) */
const GOLD_TINT = '#c8b060';
/** LED anode (longer lead) */
const LED_ANODE = '#b8b8b8';
/** LED cathode (shorter lead — slightly darker) */
const LED_CATHODE = '#909090';

/**
 * Return the leg wire color for a given component type.
 * For LEDs, `pinIndex` 0 = cathode (darker), 1 = anode (lighter).
 */
export function getLegColor(componentType: LegComponentType, pinIndex = 0): string {
  switch (componentType) {
    case 'resistor':
    case 'diode':
      return TINNED_COPPER;
    case 'capacitor':
      return GOLD_TINT;
    case 'led':
      return pinIndex === 0 ? LED_CATHODE : LED_ANODE;
    case 'ic':
    case 'transistor':
    case 'generic':
    default:
      return SILVER;
  }
}

// ---------------------------------------------------------------------------
// Pin position helpers
// ---------------------------------------------------------------------------

/**
 * Compute pin exit points for a component body.
 *
 * Components are placed at a breadboard coordinate (their anchor point).
 * Pin positions are derived from the SVG component geometry:
 *
 * - **Axial** (resistor, diode): horizontal body, pins exit left/right.
 * - **Radial** (LED, capacitor, transistor): vertical body, pins exit bottom.
 * - **DIP IC**: pins exit left/right, evenly spaced along the body height.
 */
export function getComponentPinPositions(
  anchorX: number,
  anchorY: number,
  componentType: LegComponentType,
  pinCount: number,
): Point2D[] {
  switch (componentType) {
    case 'resistor': {
      // Axial: body 30px wide, leads 8px each side
      const bodyHalfW = 15;
      const leadLen = 8;
      return [
        { x: anchorX - bodyHalfW - leadLen, y: anchorY },
        { x: anchorX + bodyHalfW + leadLen, y: anchorY },
      ];
    }
    case 'diode': {
      // Axial: body 20px wide, leads 8px each side
      const bodyHalfW = 10;
      const leadLen = 8;
      return [
        { x: anchorX - bodyHalfW - leadLen, y: anchorY },
        { x: anchorX + bodyHalfW + leadLen, y: anchorY },
      ];
    }
    case 'led': {
      // Radial: dome radius 5, leads exit bottom, spaced 4px apart
      const domeR = 5;
      const leadLen = 8;
      return [
        { x: anchorX - 2, y: anchorY + domeR + leadLen },     // cathode
        { x: anchorX + 2, y: anchorY + domeR + leadLen + 2 }, // anode (longer)
      ];
    }
    case 'capacitor': {
      // Radial: leads exit bottom, spaced 6px apart
      const bodyR = 6;
      const leadLen = 6;
      return [
        { x: anchorX - 3, y: anchorY + bodyR + leadLen },
        { x: anchorX + 3, y: anchorY + bodyR + leadLen },
      ];
    }
    case 'transistor': {
      // TO-92: 3 leads exit bottom, spaced 5px apart
      const bodyR = 6;
      const leadLen = 8;
      const spacing = 5;
      return [
        { x: anchorX - spacing, y: anchorY + bodyR + leadLen }, // E
        { x: anchorX, y: anchorY + bodyR + leadLen },           // B
        { x: anchorX + spacing, y: anchorY + bodyR + leadLen }, // C
      ];
    }
    case 'ic': {
      // DIP: pins along left and right sides
      const pinsPerSide = Math.max(2, Math.ceil(pinCount / 2));
      const bodyW = 24;
      const pinW = 4;
      const bx = anchorX - bodyW / 2;
      const by = anchorY - 5;
      const pins: Point2D[] = [];
      // Left pins (1, 3, 5...)
      for (let i = 0; i < pinsPerSide; i++) {
        pins.push({
          x: bx - pinW,
          y: by + i * BB.PITCH + BB.PITCH / 2,
        });
      }
      // Right pins (2, 4, 6...)
      for (let i = 0; i < pinsPerSide; i++) {
        pins.push({
          x: bx + bodyW + pinW,
          y: by + i * BB.PITCH + BB.PITCH / 2,
        });
      }
      return pins;
    }
    default: {
      // Generic: 2 pins, horizontal
      return [
        { x: anchorX - 10, y: anchorY },
        { x: anchorX + 10, y: anchorY },
      ];
    }
  }
}

// ---------------------------------------------------------------------------
// Leg path calculation
// ---------------------------------------------------------------------------

/**
 * Calculate a single leg path from a component pin to a breadboard hole.
 *
 * The bezier control point is placed to create a natural-looking bend:
 * - For vertical drops: control point at (pinX, holeY) — straight drop then horizontal
 * - For horizontal runs: control point at (holeX, pinY) — straight run then vertical
 * - For diagonal: weighted midpoint biased toward the pin's exit direction
 */
export function calculateLegPath(
  startPin: Point2D,
  endHole: Point2D,
  componentType: LegComponentType,
  pinIndex: number,
  instanceId: number,
): LegPath {
  const dx = endHole.x - startPin.x;
  const dy = endHole.y - startPin.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  let controlPoint: Point2D;

  if (absDy > absDx * 2) {
    // Mostly vertical: control point creates an L-bend — drop down then shift horizontally
    controlPoint = { x: startPin.x, y: endHole.y };
  } else if (absDx > absDy * 2) {
    // Mostly horizontal: control point creates an L-bend — run horizontal then drop
    controlPoint = { x: endHole.x, y: startPin.y };
  } else {
    // Diagonal: use a weighted midpoint closer to the pin exit direction
    // Bias toward the pin's exit axis for a more natural bend
    const isVerticalExit = componentType === 'led' || componentType === 'capacitor' || componentType === 'transistor';
    if (isVerticalExit) {
      // Vertical exit components: control point favors vertical travel first
      controlPoint = {
        x: startPin.x + dx * 0.2,
        y: startPin.y + dy * 0.8,
      };
    } else {
      // Horizontal exit components: control point favors horizontal travel first
      controlPoint = {
        x: startPin.x + dx * 0.8,
        y: startPin.y + dy * 0.2,
      };
    }
  }

  return {
    startPin,
    endHole,
    bendPoints: [controlPoint],
    legColor: getLegColor(componentType, pinIndex),
    legId: `leg-${instanceId}-${pinIndex}`,
  };
}

// ---------------------------------------------------------------------------
// Breadboard hole position resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the breadboard hole positions for a component's pins based on
 * its placement anchor coordinate and component type.
 *
 * Returns pixel positions of the breadboard holes where each pin inserts.
 * The mapping depends on component orientation and pin count:
 *
 * - Axial 2-pin (resistor/diode): pins go into same row, spaced columns apart
 * - Radial 2-pin (LED/cap): pins go into adjacent rows, same column side
 * - 3-pin (transistor): pins go into 3 adjacent rows
 * - DIP IC: left pins go into column e rows, right pins into column f rows
 */
export function resolveHolePositions(
  anchorCol: ColumnLetter,
  anchorRow: number,
  componentType: LegComponentType,
  pinCount: number,
): Point2D[] {
  const colIdx: Record<string, number> = {
    a: 0, b: 1, c: 2, d: 3, e: 4,
    f: 5, g: 6, h: 7, i: 8, j: 9,
  };
  const allCols: ColumnLetter[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
  const ci = colIdx[anchorCol] ?? 0;

  switch (componentType) {
    case 'resistor':
    case 'diode': {
      // Axial: pin 1 at anchor, pin 2 several columns to the right
      // Typically spans 3-4 columns
      const span = componentType === 'resistor' ? 4 : 3;
      const endColIdx = Math.min(ci + span, 9);
      const endCol = allCols[endColIdx];
      return [
        coordToPixel({ type: 'terminal', col: anchorCol, row: anchorRow }),
        coordToPixel({ type: 'terminal', col: endCol, row: anchorRow }),
      ];
    }
    case 'led':
    case 'capacitor': {
      // Radial 2-pin: both pins in the same column, adjacent rows
      return [
        coordToPixel({ type: 'terminal', col: anchorCol, row: anchorRow }),
        coordToPixel({ type: 'terminal', col: anchorCol, row: anchorRow + 1 }),
      ];
    }
    case 'transistor': {
      // 3-pin: three adjacent rows, same column
      return [
        coordToPixel({ type: 'terminal', col: anchorCol, row: anchorRow }),
        coordToPixel({ type: 'terminal', col: anchorCol, row: anchorRow + 1 }),
        coordToPixel({ type: 'terminal', col: anchorCol, row: anchorRow + 2 }),
      ];
    }
    case 'ic': {
      // DIP: left pins in column e, right pins in column f, spanning rows
      const pinsPerSide = Math.max(2, Math.ceil(pinCount / 2));
      const holes: Point2D[] = [];
      // Left side pins
      for (let i = 0; i < pinsPerSide; i++) {
        holes.push(coordToPixel({ type: 'terminal', col: 'e', row: anchorRow + i }));
      }
      // Right side pins
      for (let i = 0; i < pinsPerSide; i++) {
        holes.push(coordToPixel({ type: 'terminal', col: 'f', row: anchorRow + i }));
      }
      return holes;
    }
    default: {
      // Generic 2-pin
      const endColIdx = Math.min(ci + 2, 9);
      const endCol = allCols[endColIdx];
      return [
        coordToPixel({ type: 'terminal', col: anchorCol, row: anchorRow }),
        coordToPixel({ type: 'terminal', col: endCol, row: anchorRow }),
      ];
    }
  }
}

// ---------------------------------------------------------------------------
// Full leg set computation
// ---------------------------------------------------------------------------

/**
 * Compute all leg paths for a component instance placed on the breadboard.
 *
 * This is the main entry point: given a component's anchor position, type,
 * and pin count, it resolves pin positions, hole positions, and calculates
 * the bezier leg path for each pin-to-hole pair.
 */
export function computeComponentLegs(
  anchorX: number,
  anchorY: number,
  anchorCol: ColumnLetter,
  anchorRow: number,
  componentType: LegComponentType,
  pinCount: number,
  instanceId: number,
): LegPath[] {
  const pinPositions = getComponentPinPositions(anchorX, anchorY, componentType, pinCount);
  const holePositions = resolveHolePositions(anchorCol, anchorRow, componentType, pinCount);

  // Match pins to holes (1:1 by index, capped to the shorter array)
  const count = Math.min(pinPositions.length, holePositions.length);
  const legs: LegPath[] = [];

  for (let i = 0; i < count; i++) {
    legs.push(calculateLegPath(pinPositions[i], holePositions[i], componentType, i, instanceId));
  }

  return legs;
}

// ---------------------------------------------------------------------------
// SVG path generation
// ---------------------------------------------------------------------------

/**
 * Convert a LegPath into an SVG path `d` attribute string.
 *
 * Uses a quadratic bezier curve (Q command) through the bend point(s).
 * If no bend points, falls back to a straight line.
 */
export function legPathToSvgD(leg: LegPath): string {
  const { startPin, endHole, bendPoints } = leg;

  if (bendPoints.length === 0) {
    // Straight line
    return `M ${startPin.x} ${startPin.y} L ${endHole.x} ${endHole.y}`;
  }

  if (bendPoints.length === 1) {
    // Single quadratic bezier
    const cp = bendPoints[0];
    return `M ${startPin.x} ${startPin.y} Q ${cp.x} ${cp.y} ${endHole.x} ${endHole.y}`;
  }

  // Multiple control points: chain of quadratic segments through midpoints
  let d = `M ${startPin.x} ${startPin.y}`;
  for (let i = 0; i < bendPoints.length; i++) {
    const cp = bendPoints[i];
    const endPt = i === bendPoints.length - 1
      ? endHole
      : {
        x: (bendPoints[i].x + bendPoints[i + 1].x) / 2,
        y: (bendPoints[i].y + bendPoints[i + 1].y) / 2,
      };
    d += ` Q ${cp.x} ${cp.y} ${endPt.x} ${endPt.y}`;
  }

  return d;
}

/**
 * Calculate the approximate length of a leg path for animation or
 * stroke-dasharray purposes. Uses the bezier arc length approximation.
 */
export function approximateLegLength(leg: LegPath): number {
  const { startPin, endHole, bendPoints } = leg;

  if (bendPoints.length === 0) {
    return Math.hypot(endHole.x - startPin.x, endHole.y - startPin.y);
  }

  // Approximate quadratic bezier length using chord + control polygon average
  const cp = bendPoints[0];
  const chordLen = Math.hypot(endHole.x - startPin.x, endHole.y - startPin.y);
  const polyLen = Math.hypot(cp.x - startPin.x, cp.y - startPin.y)
    + Math.hypot(endHole.x - cp.x, endHole.y - cp.y);

  return (chordLen + polyLen) / 2;
}
