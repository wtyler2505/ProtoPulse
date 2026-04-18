// =============================================================================
// KiCad Exporter — S-expression + formatting helpers
// =============================================================================

import crypto from 'crypto';

/**
 * Generates a unique UUID for KiCad file references.
 *
 * Uses `crypto.randomUUID()` for guaranteed uniqueness — the previous
 * FNV-1a-inspired hash was prone to collisions in large projects where
 * different input ID combinations could produce the same 128-bit output.
 *
 * The variadic number parameters are kept for source-compatibility with
 * call sites that previously derived UUIDs from ID tuples.
 */
export function deterministicUuid(..._ids: number[]): string {
  return crypto.randomUUID();
}

/**
 * Escape a string for use inside an S-expression quoted value.
 * Backslashes and double quotes must be escaped.
 */
export function esc(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** Alias used by the legacy generateKicadSch / generateKicadNetlist emitters. */
export function escapeKicad(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Returns an indentation string for the given nesting depth.
 */
export function ind(level: number): string {
  return '  '.repeat(level);
}

/**
 * Formats a number to at most 4 decimal places, stripping trailing zeros.
 * Keeps output compact while maintaining sub-micron precision.
 */
export function num(value: number): string {
  const rounded = Math.round(value * 10000) / 10000;
  const fixed = rounded.toFixed(4);
  return fixed.replace(/\.?0+$/, '') || '0';
}

/**
 * Normalizes an angle to the [0, 360) range.
 */
export function normalizeAngle(deg: number): number {
  let n = deg % 360;
  if (n < 0) n += 360;
  return n;
}

/**
 * Sanitizes a string for use as a KiCad symbol name.
 * Replaces any character that is not alphanumeric or underscore with '_'.
 */
export function sanitizeSymbolName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}
