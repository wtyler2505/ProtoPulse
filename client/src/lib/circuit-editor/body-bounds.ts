/**
 * Body bounds — physical body-volume collision detection for breadboard components.
 *
 * The breadboard hole-level collision check (`checkCollision` in breadboard-model)
 * only looks at tie-point overlap. That misses physical body conflicts: a tall
 * electrolytic capacitor can block adjacent space even though its pin footprint
 * is only 2 holes. This module provides body-volume bounds and overlap detection.
 *
 * Design decisions:
 *   - Flat components (height < FLAT_THRESHOLD) never trigger body overlap with
 *     each other. Axial resistors sitting flush in adjacent rows don't collide.
 *   - At least one component must be "tall" for the 3D body check to apply.
 *   - Bounds are in board-local pixel space (same coordinate system as
 *     `coordToPixel` from breadboard-model).
 */

import { BB } from './breadboard-model';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Axis-aligned bounding box in board-local pixel space. */
export interface BodyBounds {
  /** Left edge X in pixels */
  x: number;
  /** Top edge Y in pixels */
  y: number;
  /** Body width in pixels */
  width: number;
  /** Body height (vertical extent) in pixels — also encodes tallness */
  height: number;
}

/** Physical dimensions of a component body type (in millimeters). */
interface BodyProfile {
  /** Fixed base width in mm (before pin-count scaling). */
  baseWidthMm: number;
  /** Additional width per pin in mm (for ICs, connectors). Zero for 2-pin parts. */
  widthPerPinMm: number;
  /** Body depth in mm — NOT the height/thickness off the board. */
  depthMm: number;
  /** Height above the board surface in mm. Drives the tall/flat distinction. */
  heightMm: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Pixels per millimeter at our board scale (PITCH = 10 px / 2.54 mm). */
const SCALE = BB.PITCH / 2.54;

/**
 * Height threshold in pixels. Components whose scaled height is below this
 * value are considered "flat" — they sit flush with the board and cannot
 * physically collide with adjacent flat components.
 *
 * 3mm * SCALE ≈ 11.8 px. Components at or below ~3mm off the board
 * (axial resistors, ceramic disc caps, small diodes) are flush enough
 * that adjacent placement is safe.
 */
export const FLAT_THRESHOLD = 3 * SCALE; // ~11.8 px

// ---------------------------------------------------------------------------
// Component body profiles (physical dimensions in mm)
// ---------------------------------------------------------------------------

const PROFILES: Record<string, BodyProfile> = {
  // Axial 2-pin passives
  resistor:      { baseWidthMm: 6.5, widthPerPinMm: 0, depthMm: 2.3, heightMm: 2.3 },
  capacitor:     { baseWidthMm: 5.0, widthPerPinMm: 0, depthMm: 2.5, heightMm: 3.0 },
  diode:         { baseWidthMm: 5.0, widthPerPinMm: 0, depthMm: 2.0, heightMm: 2.0 },
  led:           { baseWidthMm: 5.0, widthPerPinMm: 0, depthMm: 5.0, heightMm: 8.5 },

  // Tall variants
  electrolytic:  { baseWidthMm: 8.0, widthPerPinMm: 0, depthMm: 8.0, heightMm: 12.0 },
  relay:         { baseWidthMm: 15.0, widthPerPinMm: 0, depthMm: 10.0, heightMm: 12.0 },
  buzzer:        { baseWidthMm: 12.0, widthPerPinMm: 0, depthMm: 12.0, heightMm: 9.5 },
  crystal:       { baseWidthMm: 11.0, widthPerPinMm: 0, depthMm: 4.7, heightMm: 3.5 },

  // Multi-pin
  ic:            { baseWidthMm: 6.8, widthPerPinMm: 1.27, depthMm: 6.4, heightMm: 3.5 },
  transistor:    { baseWidthMm: 4.6, widthPerPinMm: 0, depthMm: 4.2, heightMm: 4.5 },
  regulator:     { baseWidthMm: 4.6, widthPerPinMm: 0, depthMm: 10.0, heightMm: 4.5 },
  potentiometer: { baseWidthMm: 10.0, widthPerPinMm: 0, depthMm: 10.0, heightMm: 7.0 },
  button:        { baseWidthMm: 6.0, widthPerPinMm: 0, depthMm: 6.0, heightMm: 5.0 },
};

/** Fallback profile for unknown component types. */
const DEFAULT_PROFILE: BodyProfile = {
  baseWidthMm: 6.0,
  widthPerPinMm: 0,
  depthMm: 4.0,
  heightMm: 4.0,
};

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Resolve which body profile to use for a given component type + optional sub-type.
 */
function resolveProfile(componentType: string, subType?: string): BodyProfile {
  const key = componentType.toLowerCase();

  // Sub-type overrides (e.g., electrolytic capacitor is much taller)
  if (key === 'capacitor' && subType?.toLowerCase() === 'electrolytic') {
    return PROFILES.electrolytic;
  }

  return PROFILES[key] ?? DEFAULT_PROFILE;
}

/**
 * Compute the physical body bounding box for a component, centered at origin.
 *
 * The returned bounds have `x=0, y=0` — the caller positions them on the board
 * by adding the component's board-local pixel origin.
 *
 * @param componentType - e.g. 'resistor', 'ic', 'relay'
 * @param pinCount      - Number of pins (drives IC width scaling)
 * @param opts.subType  - Optional sub-type for variant selection ('electrolytic')
 */
export function getBodyBounds(
  componentType: string,
  pinCount: number,
  opts?: { subType?: string },
): BodyBounds {
  const profile = resolveProfile(componentType, opts?.subType);

  // Width: baseWidth + additional per pin (IC row count = pinCount / 2)
  const pinsPerSide = Math.max(1, Math.ceil(pinCount / 2));
  const widthMm = profile.baseWidthMm + profile.widthPerPinMm * pinsPerSide;

  return {
    x: 0,
    y: 0,
    width: widthMm * SCALE,
    height: profile.heightMm * SCALE,
  };
}

/**
 * Check whether two positioned body bounds physically overlap.
 *
 * Returns `true` only when:
 *   1. At least one component is "tall" (height >= FLAT_THRESHOLD), AND
 *   2. Their axis-aligned bounding boxes intersect (strict — touching edges
 *      don't count).
 *
 * Flat-on-flat overlap is allowed: two flush resistors in adjacent rows
 * cannot physically interfere.
 */
export function checkBodyOverlap(a: BodyBounds, b: BodyBounds): boolean {
  // Gate: if both are flat, no 3D collision is possible
  if (a.height < FLAT_THRESHOLD && b.height < FLAT_THRESHOLD) {
    return false;
  }

  // Standard AABB overlap (strict inequality — touching is not overlapping)
  const overlapX = a.x < b.x + b.width && a.x + a.width > b.x;
  const overlapY = a.y < b.y + b.height && a.y + a.height > b.y;

  return overlapX && overlapY;
}
