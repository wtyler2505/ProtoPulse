/**
 * BOM Tolerance Bridge
 *
 * Bridges BOM item tolerance data into Monte Carlo ToleranceSpec entries.
 * Parses human-readable tolerance strings ("5%", "±1%", "0.01") and maps
 * BOM items to parameter specs for Monte Carlo simulation.
 */

import type { BomItem } from '@shared/types/bom-compat';
import type { ToleranceSpec } from './monte-carlo';

// ---------------------------------------------------------------------------
// Default tolerance by component keyword (case-insensitive match on description)
// ---------------------------------------------------------------------------

/**
 * Maps component description keywords to default tolerance fractions.
 * Used as fallback when a BOM item has no explicit tolerance field.
 */
export const DEFAULT_TOLERANCE_BY_KEYWORD: ReadonlyMap<string, number> = new Map<string, number>([
  ['resistor', 0.05],
  ['capacitor', 0.10],
  ['inductor', 0.10],
  ['diode', 0.05],
  ['transistor', 0.10],
  ['mosfet', 0.10],
  ['crystal', 0.005],
  ['oscillator', 0.005],
  ['voltage regulator', 0.02],
  ['regulator', 0.02],
  ['led', 0.10],
  ['fuse', 0.10],
  ['thermistor', 0.05],
  ['varistor', 0.10],
  ['relay', 0.05],
]);

/** Default tolerance fraction when neither explicit nor keyword-based match is found. */
const FALLBACK_TOLERANCE = 0.05;

// ---------------------------------------------------------------------------
// parseTolerance
// ---------------------------------------------------------------------------

/**
 * Parse a human-readable tolerance string into a fractional number.
 *
 * Supported formats:
 *  - "5%"      → 0.05
 *  - "±1%"     → 0.01
 *  - "+/-2%"   → 0.02
 *  - "0.01"    → 0.01  (already a fraction)
 *  - "20 %"    → 0.20
 *
 * Returns the default tolerance (0.05) for null, empty, or unparseable input.
 */
export function parseTolerance(raw: string | null): number {
  if (raw === null || raw === undefined) {
    return FALLBACK_TOLERANCE;
  }

  const trimmed = raw.trim();
  if (trimmed === '') {
    return FALLBACK_TOLERANCE;
  }

  // Strip common prefixes: ±, +/-, +/-
  const cleaned = trimmed
    .replace(/^[±]/, '')
    .replace(/^\+\/-/, '')
    .replace(/^\+\/−/, '')
    .trim();

  // Check if it ends with % (possibly with space before %)
  const percentMatch = cleaned.match(/^([0-9]*\.?[0-9]+)\s*%$/);
  if (percentMatch) {
    const value = parseFloat(percentMatch[1]);
    if (!isNaN(value)) {
      return value / 100;
    }
  }

  // Try parsing as a plain number (fraction)
  const value = parseFloat(cleaned);
  if (!isNaN(value) && value >= 0 && value <= 1) {
    return value;
  }

  return FALLBACK_TOLERANCE;
}

// ---------------------------------------------------------------------------
// bomItemsToToleranceSpecs
// ---------------------------------------------------------------------------

/**
 * Infer tolerance from BOM item description using keyword matching.
 * Returns the default fallback if no keyword matches.
 */
function inferToleranceFromDescription(description: string): number {
  const lower = description.toLowerCase();
  for (const [keyword, tolerance] of Array.from(DEFAULT_TOLERANCE_BY_KEYWORD.entries())) {
    if (lower.includes(keyword)) {
      return tolerance;
    }
  }
  return FALLBACK_TOLERANCE;
}

/**
 * Convert an array of BOM items into a Map of ToleranceSpec entries
 * keyed by partNumber, suitable for feeding into MonteCarloConfig.parameters.
 *
 * - Uses the explicit `tolerance` field if present.
 * - Falls back to keyword-based inference from `description`.
 * - Nominal is set to 1 (normalized multiplier for the parameter).
 * - Distribution defaults to 'gaussian'.
 */
export function bomItemsToToleranceSpecs(items: BomItem[]): Map<string, ToleranceSpec> {
  const specs = new Map<string, ToleranceSpec>();

  for (const item of items) {
    const tolerance = item.tolerance
      ? parseTolerance(item.tolerance)
      : inferToleranceFromDescription(item.description);

    specs.set(item.partNumber, {
      nominal: 1,
      tolerance,
      distribution: 'gaussian',
    });
  }

  return specs;
}
