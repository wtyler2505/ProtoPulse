/**
 * Rotation utilities for arbitrary-angle component rotation.
 *
 * Provides normalization, snapping, point rotation, and transform helpers
 * used by the schematic/PCB canvas and RotationInputPanel.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Common rotation angles available as presets (every 30/45 degrees). */
export const COMMON_ANGLES: readonly number[] = [
  0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330,
] as const;

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

/** Convert degrees to radians. */
export function degreesToRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Convert radians to degrees. */
export function radiansToDegrees(rad: number): number {
  return (rad * 180) / Math.PI;
}

// ---------------------------------------------------------------------------
// Normalization & snapping
// ---------------------------------------------------------------------------

/** Normalize an angle to the [0, 360) range. */
export function normalizeAngle(deg: number): number {
  const mod = deg % 360;
  // Avoid returning -0 (e.g. -720 % 360 === -0)
  return mod < 0 ? mod + 360 : mod || 0;
}

/**
 * Snap an angle to the nearest increment.
 *
 * @param deg - The angle in degrees.
 * @param snapIncrement - The snap grid size (e.g. 15, 45, 90).
 * @returns The nearest snapped angle, normalized to [0, 360).
 */
export function snapToAngle(deg: number, snapIncrement: number): number {
  if (snapIncrement <= 0) {
    return normalizeAngle(deg);
  }
  const normalized = normalizeAngle(deg);
  const snapped = Math.round(normalized / snapIncrement) * snapIncrement;
  return normalizeAngle(snapped);
}

// ---------------------------------------------------------------------------
// Geometric helpers
// ---------------------------------------------------------------------------

/**
 * Rotate a point (x, y) around a center (cx, cy) by `angleDeg` degrees
 * (counter-clockwise in standard math convention, clockwise in SVG/screen
 * where Y points down).
 */
export function rotatePoint(
  x: number,
  y: number,
  cx: number,
  cy: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = degreesToRadians(angleDeg);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = x - cx;
  const dy = y - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

// ---------------------------------------------------------------------------
// Transform helpers
// ---------------------------------------------------------------------------

/** Return a CSS/SVG `rotate(Xdeg)` transform string. */
export function getRotationTransform(angleDeg: number): string {
  return `rotate(${angleDeg}deg)`;
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/** Check whether `deg` is a right angle (multiple of 90). */
export function isRightAngle(deg: number): boolean {
  return normalizeAngle(deg) % 90 === 0;
}
