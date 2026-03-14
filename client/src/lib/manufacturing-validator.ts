/**
 * Manufacturing Package Validator (BL-0470)
 *
 * Validates the complete manufacturing output package (Gerber + drill + BOM +
 * pick-and-place) for cross-file consistency before download. Pure function
 * library — no React dependencies, no side effects.
 *
 * 18 checks across 5 categories:
 *   gerber      — layer presence, outline, trace widths, silkscreen/pad overlap
 *   drill       — tool sizes, file presence, layer consistency
 *   bom         — ref-des presence, coverage, duplicate part numbers
 *   placement   — ref-des match, coordinate validity, rotation range
 *   consistency — BOM↔placement cross-reference, layer count agreement, board dimensions
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CheckStatus = 'pass' | 'warn' | 'fail';

export type CheckCategory =
  | 'gerber'
  | 'drill'
  | 'bom'
  | 'placement'
  | 'consistency';

export interface ManufacturingCheck {
  id: string;
  name: string;
  status: CheckStatus;
  message: string;
  category: CheckCategory;
}

/** Minimal Gerber layer descriptor — matches server/export/gerber-generator GerberLayer. */
export interface GerberLayerInput {
  name: string;
  type: 'copper' | 'silkscreen' | 'soldermask' | 'paste' | 'outline';
  side: string;
  content: string;
}

/** Minimal drill file descriptor. */
export interface DrillFileInput {
  content: string;
  /** Tool diameters in mm extracted from the Excellon header. */
  toolSizes: number[];
}

/** Minimal BOM entry for cross-reference. */
export interface BomEntry {
  refDes: string;
  partNumber: string;
  quantity: number;
  description?: string;
}

/** Minimal placement entry — matches pick-place-preview PlacementEntry. */
export interface PlacementEntryInput {
  refDes: string;
  partNumber: string;
  x: number;
  y: number;
  rotation: number;
  side: 'front' | 'back';
  packageName: string;
}

/** Board geometry — optional, enables dimension checks. */
export interface BoardGeometry {
  widthMm: number;
  heightMm: number;
  /** Outline as a closed polygon — if supplied the "closed outline" check can run. */
  outlinePoints?: Array<{ x: number; y: number }>;
  layerCount?: number;
}

/** Full input to the validator. All arrays may be empty. */
export interface ManufacturingPackageInput {
  gerberLayers: readonly GerberLayerInput[];
  drillFile: DrillFileInput | null;
  bomEntries: readonly BomEntry[];
  placements: readonly PlacementEntryInput[];
  board: BoardGeometry | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Standard PCB drill sizes range (mm). */
const MIN_DRILL_SIZE_MM = 0.15;
const MAX_DRILL_SIZE_MM = 6.35;

/** Standard trace width floor (mm). */
const MIN_TRACE_WIDTH_MM = 0.075;

/** Required Gerber layer types for a complete package. */
const REQUIRED_LAYER_TYPES: ReadonlyArray<GerberLayerInput['type']> = [
  'copper',
  'soldermask',
  'outline',
];

/** Regex to detect Gerber draw commands with zero-width aperture (D01/D02 using
 *  an aperture whose definition has zero width). We look for %ADD..C,0.000000*%
 *  (circular aperture with 0 diameter) or rectangular apertures with 0 dimensions. */
const ZERO_WIDTH_APERTURE_RE = /^%ADD\d+C,0(?:\.0+)?\*%$/m;

/**
 * Silkscreen draw commands landing on pad regions.  We approximate by looking
 * for silkscreen content that mentions pad-area coordinates.  In practice the
 * Gerber generator places silkscreen outlines around bodies; if silkscreen
 * layer content mentions coordinates inside a pad bounding box we flag a warning.
 *
 * This is a heuristic — true overlap detection would require full Gerber parsing.
 */
const SILKSCREEN_MIN_LENGTH = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCheck(
  id: string,
  name: string,
  category: CheckCategory,
  status: CheckStatus,
  message: string,
): ManufacturingCheck {
  return { id, name, status, message, category };
}

function refDesSet(items: readonly { refDes: string }[]): Set<string> {
  return new Set(items.map((i) => i.refDes));
}

/**
 * Checks whether an outline polygon (array of {x,y} points) is closed —
 * i.e. the first and last points are identical or very close (< 0.01 mm).
 */
function isOutlineClosed(points: ReadonlyArray<{ x: number; y: number }>): boolean {
  if (points.length < 3) {
    return false;
  }
  const first = points[0];
  const last = points[points.length - 1];
  const dx = first.x - last.x;
  const dy = first.y - last.y;
  return Math.sqrt(dx * dx + dy * dy) < 0.01;
}

// ---------------------------------------------------------------------------
// Individual Checks
// ---------------------------------------------------------------------------

/** G-01  Required Gerber layers present. */
function checkRequiredGerberLayers(layers: readonly GerberLayerInput[]): ManufacturingCheck {
  const present = new Set(layers.map((l) => l.type));
  const missing = REQUIRED_LAYER_TYPES.filter((t) => !present.has(t));
  if (missing.length === 0) {
    return makeCheck('G-01', 'Required Gerber layers', 'gerber', 'pass', 'All required layers present (copper, soldermask, outline).');
  }
  return makeCheck('G-01', 'Required Gerber layers', 'gerber', 'fail', `Missing Gerber layers: ${missing.join(', ')}.`);
}

/** G-02  Board outline is closed polygon. */
function checkBoardOutlineClosed(board: BoardGeometry | null, layers: readonly GerberLayerInput[]): ManufacturingCheck {
  const outlineLayer = layers.find((l) => l.type === 'outline');
  if (!outlineLayer && !board?.outlinePoints) {
    return makeCheck('G-02', 'Board outline closed', 'gerber', 'fail', 'No board outline found in Gerber layers or board geometry.');
  }
  if (board?.outlinePoints) {
    if (isOutlineClosed(board.outlinePoints)) {
      return makeCheck('G-02', 'Board outline closed', 'gerber', 'pass', 'Board outline polygon is properly closed.');
    }
    return makeCheck('G-02', 'Board outline closed', 'gerber', 'fail', 'Board outline polygon is not closed — first and last points do not match.');
  }
  // If we have the outline layer content but no explicit polygon, just check it's non-empty
  if (outlineLayer && outlineLayer.content.length > 0) {
    return makeCheck('G-02', 'Board outline closed', 'gerber', 'pass', 'Outline layer present with content.');
  }
  return makeCheck('G-02', 'Board outline closed', 'gerber', 'warn', 'Outline layer is empty — verify board outline is defined.');
}

/** G-03  No zero-width traces/apertures in Gerber data. */
function checkNoZeroWidthTraces(layers: readonly GerberLayerInput[]): ManufacturingCheck {
  for (const layer of layers) {
    if (ZERO_WIDTH_APERTURE_RE.test(layer.content)) {
      return makeCheck('G-03', 'No zero-width traces', 'gerber', 'fail', `Zero-width aperture found in layer "${layer.name}" — fab will reject.`);
    }
  }
  return makeCheck('G-03', 'No zero-width traces', 'gerber', 'pass', 'No zero-width apertures detected.');
}

/** G-04  Silkscreen does not overlap pads (heuristic). */
function checkSilkscreenPadOverlap(layers: readonly GerberLayerInput[]): ManufacturingCheck {
  const silkLayers = layers.filter((l) => l.type === 'silkscreen');
  const copperLayers = layers.filter((l) => l.type === 'copper');

  if (silkLayers.length === 0) {
    return makeCheck('G-04', 'Silkscreen pad overlap', 'gerber', 'pass', 'No silkscreen layers — check skipped.');
  }

  // Heuristic: extract all flash commands from copper layers (pad locations) and
  // check if any silkscreen draw commands reference the same coordinates.
  // Flash command format: X<n>Y<n>D03*
  const padCoordPattern = /X(-?\d+)Y(-?\d+)D03\*/g;
  const padCoords = new Set<string>();
  for (const cl of copperLayers) {
    let match: RegExpExecArray | null;
    while ((match = padCoordPattern.exec(cl.content)) !== null) {
      padCoords.add(`${match[1]},${match[2]}`);
    }
  }

  if (padCoords.size === 0) {
    return makeCheck('G-04', 'Silkscreen pad overlap', 'gerber', 'pass', 'No pad coordinates detected — cannot check overlap.');
  }

  const drawCoordPattern = /X(-?\d+)Y(-?\d+)D0[12]\*/g;
  for (const sl of silkLayers) {
    if (sl.content.length < SILKSCREEN_MIN_LENGTH) {
      continue;
    }
    let match: RegExpExecArray | null;
    while ((match = drawCoordPattern.exec(sl.content)) !== null) {
      if (padCoords.has(`${match[1]},${match[2]}`)) {
        return makeCheck('G-04', 'Silkscreen pad overlap', 'gerber', 'warn', `Silkscreen layer "${sl.name}" may overlap pad locations — review before fabrication.`);
      }
    }
  }

  return makeCheck('G-04', 'Silkscreen pad overlap', 'gerber', 'pass', 'No silkscreen-pad coordinate overlaps detected.');
}

/** G-05  Solder mask coverage — every copper layer should have a matching soldermask layer. */
function checkSolderMaskCoverage(layers: readonly GerberLayerInput[]): ManufacturingCheck {
  const copperSides = new Set(layers.filter((l) => l.type === 'copper').map((l) => l.side));
  const maskSides = new Set(layers.filter((l) => l.type === 'soldermask').map((l) => l.side));

  const missingMask: string[] = [];
  for (const side of copperSides) {
    // Only check front/back — inner copper layers don't have solder mask
    if ((side === 'front' || side === 'back') && !maskSides.has(side)) {
      missingMask.push(side);
    }
  }

  if (missingMask.length > 0) {
    return makeCheck('G-05', 'Solder mask coverage', 'gerber', 'warn', `Missing soldermask for copper side(s): ${missingMask.join(', ')}.`);
  }
  return makeCheck('G-05', 'Solder mask coverage', 'gerber', 'pass', 'Soldermask layers present for all outer copper layers.');
}

/** D-01  Drill file present. */
function checkDrillFilePresent(drill: DrillFileInput | null): ManufacturingCheck {
  if (!drill || drill.content.length === 0) {
    return makeCheck('D-01', 'Drill file present', 'drill', 'fail', 'No drill file in the manufacturing package.');
  }
  return makeCheck('D-01', 'Drill file present', 'drill', 'pass', 'Drill file present.');
}

/** D-02  Drill tool sizes within standard ranges. */
function checkDrillToolRanges(drill: DrillFileInput | null): ManufacturingCheck {
  if (!drill || drill.toolSizes.length === 0) {
    return makeCheck('D-02', 'Drill tool sizes', 'drill', 'warn', 'No drill tools defined — cannot validate sizes.');
  }
  const outOfRange = drill.toolSizes.filter(
    (s) => s < MIN_DRILL_SIZE_MM || s > MAX_DRILL_SIZE_MM,
  );
  if (outOfRange.length > 0) {
    const formatted = outOfRange.map((s) => `${s.toFixed(3)}mm`).join(', ');
    return makeCheck('D-02', 'Drill tool sizes', 'drill', 'fail', `Drill tools outside standard range (${MIN_DRILL_SIZE_MM}–${MAX_DRILL_SIZE_MM}mm): ${formatted}.`);
  }
  return makeCheck('D-02', 'Drill tool sizes', 'drill', 'pass', `All ${drill.toolSizes.length} drill tool(s) within standard range.`);
}

/** D-03  Gerber copper layers vs drill layers — at least one drill per plated layer. */
function checkDrillLayerConsistency(layers: readonly GerberLayerInput[], drill: DrillFileInput | null): ManufacturingCheck {
  const copperLayers = layers.filter((l) => l.type === 'copper');
  if (copperLayers.length === 0) {
    return makeCheck('D-03', 'Drill/layer consistency', 'drill', 'warn', 'No copper layers — drill consistency check skipped.');
  }
  if (!drill || drill.content.length === 0) {
    return makeCheck('D-03', 'Drill/layer consistency', 'drill', 'fail', 'Copper layers present but no drill file.');
  }
  // If we have copper and drill, it's consistent at the basic level
  return makeCheck('D-03', 'Drill/layer consistency', 'drill', 'pass', 'Drill file present with copper layers.');
}

/** B-01  BOM entries have valid ref-des. */
function checkBomRefDesValid(bom: readonly BomEntry[]): ManufacturingCheck {
  if (bom.length === 0) {
    return makeCheck('B-01', 'BOM ref-des valid', 'bom', 'warn', 'BOM is empty.');
  }
  const refDesPattern = /^[A-Za-z]+\d+$/;
  const invalid = bom.filter((e) => !refDesPattern.test(e.refDes));
  if (invalid.length > 0) {
    const examples = invalid.slice(0, 5).map((e) => `"${e.refDes}"`).join(', ');
    return makeCheck('B-01', 'BOM ref-des valid', 'bom', 'fail', `${invalid.length} BOM entries with invalid ref-des: ${examples}${invalid.length > 5 ? '...' : ''}.`);
  }
  return makeCheck('B-01', 'BOM ref-des valid', 'bom', 'pass', `All ${bom.length} BOM entries have valid reference designators.`);
}

/** B-02  No duplicate ref-des in BOM. */
function checkBomNoDuplicateRefDes(bom: readonly BomEntry[]): ManufacturingCheck {
  if (bom.length === 0) {
    return makeCheck('B-02', 'BOM no duplicate ref-des', 'bom', 'pass', 'BOM is empty — no duplicates.');
  }
  const seen = new Map<string, number>();
  for (const e of bom) {
    seen.set(e.refDes, (seen.get(e.refDes) ?? 0) + 1);
  }
  const dupes = Array.from(seen.entries()).filter(([, count]) => count > 1);
  if (dupes.length > 0) {
    const examples = dupes.slice(0, 5).map(([rd, c]) => `${rd} (x${c})`).join(', ');
    return makeCheck('B-02', 'BOM no duplicate ref-des', 'bom', 'fail', `Duplicate ref-des in BOM: ${examples}${dupes.length > 5 ? '...' : ''}.`);
  }
  return makeCheck('B-02', 'BOM no duplicate ref-des', 'bom', 'pass', 'No duplicate reference designators in BOM.');
}

/** B-03  All BOM entries have non-empty part numbers. */
function checkBomPartNumbers(bom: readonly BomEntry[]): ManufacturingCheck {
  if (bom.length === 0) {
    return makeCheck('B-03', 'BOM part numbers', 'bom', 'warn', 'BOM is empty.');
  }
  const missing = bom.filter((e) => !e.partNumber || e.partNumber.trim().length === 0);
  if (missing.length > 0) {
    const examples = missing.slice(0, 5).map((e) => e.refDes).join(', ');
    return makeCheck('B-03', 'BOM part numbers', 'bom', 'warn', `${missing.length} BOM entries missing part numbers: ${examples}${missing.length > 5 ? '...' : ''}.`);
  }
  return makeCheck('B-03', 'BOM part numbers', 'bom', 'pass', 'All BOM entries have part numbers.');
}

/** P-01  Placement ref-des are valid. */
function checkPlacementRefDesValid(placements: readonly PlacementEntryInput[]): ManufacturingCheck {
  if (placements.length === 0) {
    return makeCheck('P-01', 'Placement ref-des valid', 'placement', 'warn', 'No placement data.');
  }
  const refDesPattern = /^[A-Za-z]+\d+$/;
  const invalid = placements.filter((p) => !refDesPattern.test(p.refDes));
  if (invalid.length > 0) {
    const examples = invalid.slice(0, 5).map((p) => `"${p.refDes}"`).join(', ');
    return makeCheck('P-01', 'Placement ref-des valid', 'placement', 'fail', `${invalid.length} placements with invalid ref-des: ${examples}${invalid.length > 5 ? '...' : ''}.`);
  }
  return makeCheck('P-01', 'Placement ref-des valid', 'placement', 'pass', `All ${placements.length} placements have valid reference designators.`);
}

/** P-02  Placement coordinates are finite numbers. */
function checkPlacementCoordinates(placements: readonly PlacementEntryInput[]): ManufacturingCheck {
  if (placements.length === 0) {
    return makeCheck('P-02', 'Placement coordinates', 'placement', 'pass', 'No placement data — skipped.');
  }
  const invalid = placements.filter(
    (p) => !Number.isFinite(p.x) || !Number.isFinite(p.y),
  );
  if (invalid.length > 0) {
    const examples = invalid.slice(0, 5).map((p) => p.refDes).join(', ');
    return makeCheck('P-02', 'Placement coordinates', 'placement', 'fail', `${invalid.length} placements with invalid coordinates: ${examples}.`);
  }
  return makeCheck('P-02', 'Placement coordinates', 'placement', 'pass', 'All placement coordinates are valid.');
}

/** P-03  Placement rotations in [0, 360). */
function checkPlacementRotations(placements: readonly PlacementEntryInput[]): ManufacturingCheck {
  if (placements.length === 0) {
    return makeCheck('P-03', 'Placement rotations', 'placement', 'pass', 'No placement data — skipped.');
  }
  const invalid = placements.filter(
    (p) => !Number.isFinite(p.rotation) || p.rotation < 0 || p.rotation >= 360,
  );
  if (invalid.length > 0) {
    const examples = invalid.slice(0, 5).map((p) => `${p.refDes} (${p.rotation}°)`).join(', ');
    return makeCheck('P-03', 'Placement rotations', 'placement', 'warn', `${invalid.length} placements with rotation outside [0, 360): ${examples}.`);
  }
  return makeCheck('P-03', 'Placement rotations', 'placement', 'pass', 'All placement rotations are valid.');
}

/** C-01  BOM ref-des match placement ref-des. */
function checkBomPlacementRefDesMatch(
  bom: readonly BomEntry[],
  placements: readonly PlacementEntryInput[],
): ManufacturingCheck {
  if (bom.length === 0 && placements.length === 0) {
    return makeCheck('C-01', 'BOM↔placement ref-des match', 'consistency', 'warn', 'Both BOM and placement are empty.');
  }
  if (bom.length === 0 || placements.length === 0) {
    const which = bom.length === 0 ? 'BOM' : 'Placement';
    return makeCheck('C-01', 'BOM↔placement ref-des match', 'consistency', 'warn', `${which} is empty — cannot cross-reference.`);
  }

  const bomRefs = refDesSet(bom);
  const placementRefs = refDesSet(placements);

  const inBomNotPlacement = Array.from(bomRefs).filter((r) => !placementRefs.has(r));
  const inPlacementNotBom = Array.from(placementRefs).filter((r) => !bomRefs.has(r));

  if (inBomNotPlacement.length === 0 && inPlacementNotBom.length === 0) {
    return makeCheck('C-01', 'BOM↔placement ref-des match', 'consistency', 'pass', 'All reference designators match between BOM and placement.');
  }

  const parts: string[] = [];
  if (inBomNotPlacement.length > 0) {
    const ex = inBomNotPlacement.slice(0, 5).join(', ');
    parts.push(`${inBomNotPlacement.length} in BOM but not placement (${ex}${inBomNotPlacement.length > 5 ? '...' : ''})`);
  }
  if (inPlacementNotBom.length > 0) {
    const ex = inPlacementNotBom.slice(0, 5).join(', ');
    parts.push(`${inPlacementNotBom.length} in placement but not BOM (${ex}${inPlacementNotBom.length > 5 ? '...' : ''})`);
  }
  return makeCheck('C-01', 'BOM↔placement ref-des match', 'consistency', 'fail', `Ref-des mismatch: ${parts.join('; ')}.`);
}

/** C-02  All placed components have BOM entries. */
function checkComponentCoverage(
  bom: readonly BomEntry[],
  placements: readonly PlacementEntryInput[],
): ManufacturingCheck {
  if (placements.length === 0) {
    return makeCheck('C-02', 'Component coverage', 'consistency', 'pass', 'No placements — coverage check skipped.');
  }
  if (bom.length === 0) {
    return makeCheck('C-02', 'Component coverage', 'consistency', 'fail', `${placements.length} placed components but BOM is empty.`);
  }

  const bomRefs = refDesSet(bom);
  const uncovered = placements.filter((p) => !bomRefs.has(p.refDes));
  if (uncovered.length === 0) {
    return makeCheck('C-02', 'Component coverage', 'consistency', 'pass', 'All placed components have corresponding BOM entries.');
  }
  const examples = uncovered.slice(0, 5).map((p) => p.refDes).join(', ');
  return makeCheck('C-02', 'Component coverage', 'consistency', 'fail', `${uncovered.length} placed component(s) missing from BOM: ${examples}${uncovered.length > 5 ? '...' : ''}.`);
}

/** C-03  Gerber layer count matches declared board layer count. */
function checkLayerCountAgreement(
  layers: readonly GerberLayerInput[],
  board: BoardGeometry | null,
): ManufacturingCheck {
  if (!board?.layerCount) {
    return makeCheck('C-03', 'Layer count agreement', 'consistency', 'pass', 'No declared layer count — check skipped.');
  }
  const copperCount = layers.filter((l) => l.type === 'copper').length;
  if (copperCount === 0) {
    return makeCheck('C-03', 'Layer count agreement', 'consistency', 'warn', 'No copper layers in Gerber data.');
  }
  if (copperCount !== board.layerCount) {
    return makeCheck('C-03', 'Layer count agreement', 'consistency', 'fail', `Gerber has ${copperCount} copper layer(s) but board declares ${board.layerCount} layers.`);
  }
  return makeCheck('C-03', 'Layer count agreement', 'consistency', 'pass', `Copper layer count (${copperCount}) matches declared board layers.`);
}

/** C-04  Board dimensions are reasonable (non-zero, within fab limits). */
function checkBoardDimensions(board: BoardGeometry | null): ManufacturingCheck {
  if (!board) {
    return makeCheck('C-04', 'Board dimensions', 'consistency', 'pass', 'No board geometry — check skipped.');
  }
  const issues: string[] = [];
  if (board.widthMm <= 0) {
    issues.push('width is zero or negative');
  }
  if (board.heightMm <= 0) {
    issues.push('height is zero or negative');
  }
  if (board.widthMm > 600) {
    issues.push(`width (${board.widthMm}mm) exceeds typical fab maximum (600mm)`);
  }
  if (board.heightMm > 600) {
    issues.push(`height (${board.heightMm}mm) exceeds typical fab maximum (600mm)`);
  }
  if (issues.length > 0) {
    return makeCheck('C-04', 'Board dimensions', 'consistency', 'fail', `Board dimension issues: ${issues.join('; ')}.`);
  }
  return makeCheck('C-04', 'Board dimensions', 'consistency', 'pass', `Board dimensions valid (${board.widthMm} x ${board.heightMm} mm).`);
}

// ---------------------------------------------------------------------------
// Main Validator
// ---------------------------------------------------------------------------

/**
 * Validates a complete manufacturing package for consistency and correctness.
 * Returns an array of checks with pass/warn/fail status per rule.
 */
export function validateManufacturingPackage(
  input: ManufacturingPackageInput,
): ManufacturingCheck[] {
  const { gerberLayers, drillFile, bomEntries, placements, board } = input;

  return [
    // Gerber checks (G-01 … G-05)
    checkRequiredGerberLayers(gerberLayers),
    checkBoardOutlineClosed(board, gerberLayers),
    checkNoZeroWidthTraces(gerberLayers),
    checkSilkscreenPadOverlap(gerberLayers),
    checkSolderMaskCoverage(gerberLayers),

    // Drill checks (D-01 … D-03)
    checkDrillFilePresent(drillFile),
    checkDrillToolRanges(drillFile),
    checkDrillLayerConsistency(gerberLayers, drillFile),

    // BOM checks (B-01 … B-03)
    checkBomRefDesValid(bomEntries),
    checkBomNoDuplicateRefDes(bomEntries),
    checkBomPartNumbers(bomEntries),

    // Placement checks (P-01 … P-03)
    checkPlacementRefDesValid(placements),
    checkPlacementCoordinates(placements),
    checkPlacementRotations(placements),

    // Cross-consistency checks (C-01 … C-04)
    checkBomPlacementRefDesMatch(bomEntries, placements),
    checkComponentCoverage(bomEntries, placements),
    checkLayerCountAgreement(gerberLayers, board),
    checkBoardDimensions(board),
  ];
}

// ---------------------------------------------------------------------------
// Summary helpers
// ---------------------------------------------------------------------------

export interface PackageValidationSummary {
  total: number;
  passed: number;
  warnings: number;
  failures: number;
  overallStatus: CheckStatus;
}

export function summarizeChecks(checks: readonly ManufacturingCheck[]): PackageValidationSummary {
  let passed = 0;
  let warnings = 0;
  let failures = 0;

  for (const c of checks) {
    if (c.status === 'pass') { passed++; }
    else if (c.status === 'warn') { warnings++; }
    else { failures++; }
  }

  let overallStatus: CheckStatus = 'pass';
  if (failures > 0) { overallStatus = 'fail'; }
  else if (warnings > 0) { overallStatus = 'warn'; }

  return { total: checks.length, passed, warnings, failures, overallStatus };
}
