// =============================================================================
// Gerber Coordinate Helpers
// =============================================================================

import { MM_TO_EXCELLON, MM_TO_GERBER } from './types';

/**
 * Convert millimeters to Gerber 3.6 format integer.
 * 1mm = 1,000,000 in 3.6 format (effectively micrometers in the integer representation).
 */
export function mmToGerber(mm: number): number {
  return Math.round(mm * MM_TO_GERBER);
}

/**
 * Convert millimeters to Excellon drill format integer (micrometers).
 */
export function mmToExcellon(mm: number): number {
  return Math.round(mm * MM_TO_EXCELLON);
}

/**
 * Format a Gerber coordinate as the integer string (no decimal point).
 * Gerber readers interpret this based on the %FSLAX36Y36*% header.
 */
export function fmtCoord(mm: number): string {
  const val = mmToGerber(mm);
  // Gerber spec with "leading zeros omitted" (LA) means we just output the integer
  return String(val);
}

/**
 * Rotate a point (px, py) around an origin (cx, cy) by the given angle in degrees.
 * Returns the new (x, y) position.
 */
export function rotatePoint(
  px: number,
  py: number,
  cx: number,
  cy: number,
  angleDeg: number,
): { x: number; y: number } {
  if (angleDeg === 0) return { x: px, y: py };
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = px - cx;
  const dy = py - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

/**
 * Format a dimension in mm with enough decimal places for Gerber aperture definitions.
 * Gerber apertures use decimal mm notation (e.g. "1.600").
 */
export function formatMm(mm: number): string {
  return mm.toFixed(3);
}
