/**
 * Pick-and-Place Validation & Preview Engine (BL-0469)
 *
 * Validates placement data before export and provides
 * grouped data for visual SVG board preview.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlacementEntry {
  refDes: string;
  partNumber: string;
  x: number;
  y: number;
  rotation: number;
  side: 'front' | 'back';
  packageName: string;
  value: string;
}

export type PlacementIssueType =
  | 'overlapping'
  | 'missing-coordinates'
  | 'invalid-rotation'
  | 'unresolved-ref-des'
  | 'off-board';

export type PlacementIssueSeverity = 'error' | 'warning';

export interface PlacementIssue {
  type: PlacementIssueType;
  severity: PlacementIssueSeverity;
  message: string;
  refDes: string;
  /** Second refDes involved (for overlapping). */
  relatedRefDes?: string;
}

export interface PlacementSides {
  front: PlacementEntry[];
  back: PlacementEntry[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum distance (mm) before two placements are considered overlapping. */
const OVERLAP_THRESHOLD_MM = 0.5;

/** Reference designator pattern: 1+ alpha prefix followed by 1+ digits. */
const REF_DES_PATTERN = /^[A-Za-z]+\d+$/;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validates an array of placement entries and returns all issues found.
 *
 * Checks performed:
 * 1. Missing coordinates (NaN / null-ish)
 * 2. Invalid rotation (outside [0, 360) or NaN)
 * 3. Unresolved reference designators (empty or non-standard pattern)
 * 4. Overlapping parts (Euclidean distance < threshold, same side)
 * 5. Off-board placements (negative coords — optional warning)
 */
export function validatePlacements(
  entries: readonly PlacementEntry[],
  boardWidth?: number,
  boardHeight?: number,
): PlacementIssue[] {
  const issues: PlacementIssue[] = [];

  for (const entry of entries) {
    // --- Missing coordinates ---
    if (!Number.isFinite(entry.x) || !Number.isFinite(entry.y)) {
      issues.push({
        type: 'missing-coordinates',
        severity: 'error',
        message: `${entry.refDes || '(unnamed)'} has missing or invalid coordinates`,
        refDes: entry.refDes,
      });
    }

    // --- Invalid rotation ---
    if (!Number.isFinite(entry.rotation) || entry.rotation < 0 || entry.rotation >= 360) {
      issues.push({
        type: 'invalid-rotation',
        severity: 'warning',
        message: `${entry.refDes || '(unnamed)'} has rotation ${String(entry.rotation)}° (expected 0–359.9)`,
        refDes: entry.refDes,
      });
    }

    // --- Unresolved reference designator ---
    if (!entry.refDes || entry.refDes.trim().length === 0) {
      issues.push({
        type: 'unresolved-ref-des',
        severity: 'error',
        message: 'A placement entry has no reference designator',
        refDes: '',
      });
    } else if (!REF_DES_PATTERN.test(entry.refDes.trim())) {
      issues.push({
        type: 'unresolved-ref-des',
        severity: 'warning',
        message: `${entry.refDes} does not match standard RefDes pattern (e.g. R1, C2, U3)`,
        refDes: entry.refDes,
      });
    }

    // --- Off-board ---
    if (Number.isFinite(entry.x) && Number.isFinite(entry.y)) {
      if (entry.x < 0 || entry.y < 0) {
        issues.push({
          type: 'off-board',
          severity: 'warning',
          message: `${entry.refDes || '(unnamed)'} has negative coordinates (${entry.x.toFixed(2)}, ${entry.y.toFixed(2)})`,
          refDes: entry.refDes,
        });
      }
      if (boardWidth !== undefined && boardHeight !== undefined) {
        if (entry.x > boardWidth || entry.y > boardHeight) {
          issues.push({
            type: 'off-board',
            severity: 'warning',
            message: `${entry.refDes || '(unnamed)'} is outside the board boundary`,
            refDes: entry.refDes,
          });
        }
      }
    }
  }

  // --- Overlapping parts (same side, within threshold) ---
  for (let i = 0; i < entries.length; i++) {
    const a = entries[i];
    if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) {
      continue;
    }
    for (let j = i + 1; j < entries.length; j++) {
      const b = entries[j];
      if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) {
        continue;
      }
      if (a.side !== b.side) {
        continue;
      }
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < OVERLAP_THRESHOLD_MM) {
        issues.push({
          type: 'overlapping',
          severity: 'error',
          message: `${a.refDes} and ${b.refDes} overlap (${dist.toFixed(2)}mm apart on ${a.side} side)`,
          refDes: a.refDes,
          relatedRefDes: b.refDes,
        });
      }
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

/**
 * Splits placement entries by board side.
 */
export function groupBySide(entries: readonly PlacementEntry[]): PlacementSides {
  const front: PlacementEntry[] = [];
  const back: PlacementEntry[] = [];

  for (const entry of entries) {
    if (entry.side === 'back') {
      back.push(entry);
    } else {
      front.push(entry);
    }
  }

  return { front, back };
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export interface PlacementStats {
  total: number;
  frontCount: number;
  backCount: number;
  errorCount: number;
  warningCount: number;
  uniquePackages: number;
}

/**
 * Computes summary statistics for a set of placements and their issues.
 */
export function computePlacementStats(
  entries: readonly PlacementEntry[],
  issues: readonly PlacementIssue[],
): PlacementStats {
  const sides = groupBySide(entries);
  const packages = new Set(entries.map((e) => e.packageName).filter(Boolean));

  return {
    total: entries.length,
    frontCount: sides.front.length,
    backCount: sides.back.length,
    errorCount: issues.filter((i) => i.severity === 'error').length,
    warningCount: issues.filter((i) => i.severity === 'warning').length,
    uniquePackages: packages.size,
  };
}

// ---------------------------------------------------------------------------
// CSV parsing (for preview from exported pick-place CSV)
// ---------------------------------------------------------------------------

/**
 * Parses a pick-and-place CSV (as generated by the server export) into
 * PlacementEntry objects. Skips comment lines (starting with #) and
 * the header row.
 *
 * Expected CSV columns: Designator, Val, Package, PosX, PosY, Rot, Side
 */
export function parsePlacementCsv(csv: string): PlacementEntry[] {
  const entries: PlacementEntry[] = [];
  const lines = csv.split('\n');

  let headerSeen = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) {
      continue;
    }
    if (line.startsWith('#')) {
      continue;
    }
    // Skip the header row
    if (!headerSeen && line.toLowerCase().startsWith('designator')) {
      headerSeen = true;
      continue;
    }

    const cols = line.split(',');
    if (cols.length < 7) {
      continue;
    }

    const sideRaw = cols[6].trim().toLowerCase();
    const side: 'front' | 'back' = sideRaw === 'bottom' || sideRaw === 'back' ? 'back' : 'front';

    entries.push({
      refDes: cols[0].trim(),
      value: cols[1].trim(),
      packageName: cols[2].trim(),
      x: parseFloat(cols[3]),
      y: parseFloat(cols[4]),
      rotation: parseFloat(cols[5]),
      side,
      partNumber: '',
    });
  }

  return entries;
}
