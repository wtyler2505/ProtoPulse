/**
 * Pick-and-Place Validator (BL-0469)
 *
 * Comprehensive validation rules for pick-and-place placement data
 * before export. Checks for missing fields, duplicates, coordinate
 * bounds, unusual rotations, and missing passive values.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PnPPlacement {
  refdes: string;
  x: number;
  y: number;
  rotation: number;
  side: 'top' | 'bottom';
  package: string;
  value: string;
  manufacturer?: string;
}

export interface PnPValidationIssue {
  refdes: string;
  field: string;
  severity: 'error' | 'warning';
  message: string;
  suggestion?: string;
}

export interface PnPStats {
  total: number;
  topSide: number;
  bottomSide: number;
  uniquePackages: number;
}

export interface PnPValidationResult {
  valid: boolean;
  errors: PnPValidationIssue[];
  warnings: PnPValidationIssue[];
  stats: PnPStats;
}

export interface BoardDimensions {
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Passive refdes prefixes
// ---------------------------------------------------------------------------

const PASSIVE_PREFIXES = ['R', 'C', 'L'];

function isPassiveRefdes(refdes: string): boolean {
  const upper = refdes.trim().toUpperCase();
  return PASSIVE_PREFIXES.some((prefix) => upper.startsWith(prefix));
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/**
 * Computes summary statistics for an array of placements.
 */
export function getPnPStats(placements: readonly PnPPlacement[]): PnPStats {
  let topSide = 0;
  let bottomSide = 0;
  const packages = new Set<string>();

  for (const p of placements) {
    if (p.side === 'top') {
      topSide++;
    } else {
      bottomSide++;
    }
    if (p.package.trim().length > 0) {
      packages.add(p.package);
    }
  }

  return {
    total: placements.length,
    topSide,
    bottomSide,
    uniquePackages: packages.size,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validates an array of PnP placements and returns a structured result
 * with errors, warnings, and statistics.
 *
 * Rules:
 *   ERROR — missing refdes (empty / whitespace)
 *   ERROR — missing or NaN/Infinity coordinates (x, y)
 *   ERROR — duplicate refdes (same refdes appears more than once)
 *   WARNING — rotation not a multiple of 90 degrees
 *   WARNING — coordinates outside board bounds (if dimensions provided)
 *   WARNING — negative coordinates (always checked)
 *   WARNING — missing package type
 *   WARNING — missing value for passive components (R, C, L prefix)
 *
 * @param placements  Array of placement entries to validate.
 * @param boardDimensions  Optional board width/height in mm for bounds checking.
 * @returns Structured validation result.
 */
export function validatePickAndPlace(
  placements: readonly PnPPlacement[],
  boardDimensions?: BoardDimensions,
): PnPValidationResult {
  const errors: PnPValidationIssue[] = [];
  const warnings: PnPValidationIssue[] = [];

  // Track refdes occurrences for duplicate detection
  const refdesCounts = new Map<string, number>();
  for (const p of placements) {
    const key = p.refdes.trim();
    if (key.length > 0) {
      refdesCounts.set(key, (refdesCounts.get(key) ?? 0) + 1);
    }
  }

  for (const p of placements) {
    const label = p.refdes.trim() || '(unnamed)';

    // ----- ERROR: missing refdes -----
    if (p.refdes.trim().length === 0) {
      errors.push({
        refdes: p.refdes,
        field: 'refdes',
        severity: 'error',
        message: `Placement has no reference designator`,
        suggestion: 'Assign a unique refdes such as R1, C1, or U1',
      });
    }

    // ----- ERROR: NaN / non-finite coordinates -----
    if (!Number.isFinite(p.x)) {
      errors.push({
        refdes: p.refdes,
        field: 'x',
        severity: 'error',
        message: `${label} has invalid X coordinate`,
        suggestion: 'Provide a finite numeric X position in mm',
      });
    }
    if (!Number.isFinite(p.y)) {
      errors.push({
        refdes: p.refdes,
        field: 'y',
        severity: 'error',
        message: `${label} has invalid Y coordinate`,
        suggestion: 'Provide a finite numeric Y position in mm',
      });
    }

    // ----- ERROR: duplicate refdes -----
    const trimmedRefdes = p.refdes.trim();
    if (trimmedRefdes.length > 0 && (refdesCounts.get(trimmedRefdes) ?? 0) > 1) {
      errors.push({
        refdes: p.refdes,
        field: 'refdes',
        severity: 'error',
        message: `Duplicate reference designator: ${trimmedRefdes}`,
        suggestion: 'Each component must have a unique refdes',
      });
    }

    // ----- WARNING: rotation not multiple of 90 -----
    if (Number.isFinite(p.rotation) && p.rotation % 90 !== 0) {
      warnings.push({
        refdes: p.refdes,
        field: 'rotation',
        severity: 'warning',
        message: `${label} has unusual rotation ${p.rotation}° (not a multiple of 90°)`,
      });
    }

    // ----- WARNING: negative coordinates -----
    if (Number.isFinite(p.x) && p.x < 0) {
      warnings.push({
        refdes: p.refdes,
        field: 'x',
        severity: 'warning',
        message: `${label} has negative X coordinate (${p.x})`,
        suggestion: 'Verify component is within the board area',
      });
    }
    if (Number.isFinite(p.y) && p.y < 0) {
      warnings.push({
        refdes: p.refdes,
        field: 'y',
        severity: 'warning',
        message: `${label} has negative Y coordinate (${p.y})`,
        suggestion: 'Verify component is within the board area',
      });
    }

    // ----- WARNING: coordinates outside board bounds -----
    if (boardDimensions) {
      if (Number.isFinite(p.x) && p.x > boardDimensions.width) {
        warnings.push({
          refdes: p.refdes,
          field: 'x',
          severity: 'warning',
          message: `${label} X (${p.x}) exceeds board width (${boardDimensions.width})`,
          suggestion: 'Move component within board boundaries',
        });
      }
      if (Number.isFinite(p.y) && p.y > boardDimensions.height) {
        warnings.push({
          refdes: p.refdes,
          field: 'y',
          severity: 'warning',
          message: `${label} Y (${p.y}) exceeds board height (${boardDimensions.height})`,
          suggestion: 'Move component within board boundaries',
        });
      }
    }

    // ----- WARNING: missing package -----
    if (p.package.trim().length === 0) {
      warnings.push({
        refdes: p.refdes,
        field: 'package',
        severity: 'warning',
        message: `${label} has no package type specified`,
        suggestion: 'Assign a footprint such as 0402, 0603, or TQFP-32',
      });
    }

    // ----- WARNING: missing value for passives -----
    if (trimmedRefdes.length > 0 && isPassiveRefdes(trimmedRefdes) && p.value.trim().length === 0) {
      warnings.push({
        refdes: p.refdes,
        field: 'value',
        severity: 'warning',
        message: `${label} is a passive component with no value specified`,
        suggestion: 'Specify component value (e.g., 10k, 100nF, 4.7uH)',
      });
    }
  }

  const stats = getPnPStats(placements);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats,
  };
}
