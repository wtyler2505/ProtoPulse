/**
 * Pick-and-Place CSV Generator (Phase 12.6)
 *
 * Generates pick-and-place (centroid) files for SMT assembly machines.
 * Only SMD components are included — THT components are excluded.
 *
 * Output format is a standard CSV compatible with most assembly houses
 * (JLCPCB, PCBWay, etc.) and SMT placement machines.
 *
 * Columns: Designator, Val, Package, PosX, PosY, Rot, Side
 */

import {
  type CircuitInstanceData,
  type ComponentPartData,
  type ExportResult,
  csvRow as sharedCsvRow,
  metaStr,
} from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PickPlaceOrigin = 'board-center' | 'bottom-left';

export interface PickPlaceInstance {
  referenceDesignator: string;
  pcbX: number; // mm from bottom-left
  pcbY: number; // mm from bottom-left
  pcbRotation: number; // degrees
  pcbSide: string; // 'front' or 'back'
  value: string; // component value (e.g., "10k", "100nF")
  footprint: string; // package name (e.g., "0402", "TQFP-32")
  isSmd: boolean; // only include SMD components
}

export interface PickPlaceInput {
  instances: PickPlaceInstance[];
  boardWidth: number; // mm
  boardHeight: number; // mm
  origin?: PickPlaceOrigin; // default 'bottom-left'
}

export interface PickPlaceOutput {
  content: string;
  componentCount: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Maps internal side names ('front'/'back') to the standard pick-and-place
 * convention ('top'/'bottom'). Defaults to 'top' for unrecognized values.
 */
function mapSide(pcbSide: string): string {
  switch (pcbSide.toLowerCase()) {
    case 'back':
    case 'bottom':
      return 'bottom';
    case 'front':
    case 'top':
    default:
      return 'top';
  }
}

/**
 * Normalizes rotation to the [0, 360) range.
 */
function normalizeRotation(degrees: number): number {
  let normalized = degrees % 360;
  if (normalized < 0) {
    normalized += 360;
  }
  return normalized;
}

/**
 * Escapes a CSV field value. If the value contains a comma, double quote,
 * or newline, it is wrapped in double quotes with internal quotes doubled.
 * Otherwise the value is returned as-is.
 */
function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

/**
 * Formats a position value in mm to 3 decimal places.
 */
function formatPosition(mm: number): string {
  return mm.toFixed(3);
}

/**
 * Formats rotation to 1 decimal place.
 */
function formatRotation(degrees: number): string {
  return normalizeRotation(degrees).toFixed(1);
}

/**
 * Natural-order comparison for reference designators.
 * Splits each designator into alphabetic prefix and numeric suffix,
 * sorting alphabetically by prefix then numerically by suffix.
 * Examples: C1, C2, C10, R1, R2, U1, U2
 */
function compareDesignators(a: string, b: string): number {
  const re = /^([A-Za-z]+)(\d+)?$/;
  const matchA = re.exec(a);
  const matchB = re.exec(b);

  // If either doesn't match the expected pattern, fall back to lexicographic
  if (!matchA || !matchB) {
    return a.localeCompare(b);
  }

  const prefixA = matchA[1].toUpperCase();
  const prefixB = matchB[1].toUpperCase();

  if (prefixA !== prefixB) {
    return prefixA.localeCompare(prefixB);
  }

  const numA = matchA[2] !== undefined ? parseInt(matchA[2], 10) : 0;
  const numB = matchB[2] !== undefined ? parseInt(matchB[2], 10) : 0;

  return numA - numB;
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

/**
 * Filters to SMD-only components, applies coordinate transforms,
 * and sorts by reference designator.
 */
function prepareComponents(
  input: PickPlaceInput,
): Array<{
  designator: string;
  value: string;
  footprint: string;
  posX: number;
  posY: number;
  rotation: number;
  side: string;
}> {
  const origin = input.origin ?? 'bottom-left';

  // Compute offset for board-center origin
  const offsetX = origin === 'board-center' ? input.boardWidth / 2 : 0;
  const offsetY = origin === 'board-center' ? input.boardHeight / 2 : 0;

  const components = input.instances
    .filter((inst) => inst.isSmd)
    .map((inst) => ({
      designator: inst.referenceDesignator,
      value: inst.value,
      footprint: inst.footprint,
      posX: inst.pcbX - offsetX,
      posY: inst.pcbY - offsetY,
      rotation: inst.pcbRotation,
      side: mapSide(inst.pcbSide),
    }));

  // Sort by reference designator using natural ordering
  components.sort((a, b) => compareDesignators(a.designator, b.designator));

  return components;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates a pick-and-place CSV file for SMT assembly.
 *
 * Only SMD components (isSmd === true) are included. THT components
 * are excluded since they are not placed by pick-and-place machines.
 *
 * The coordinate origin can be set to 'bottom-left' (default, coordinates
 * as-is) or 'board-center' (coordinates transformed so board center = 0,0).
 *
 * Side mapping: 'front' -> 'top', 'back' -> 'bottom'.
 *
 * Output is a standard CSV with comment header lines (prefixed with #)
 * followed by a header row and data rows.
 *
 * @param input - Component instances, board dimensions, and origin setting
 * @returns CSV content string and total SMD component count
 */
export function generatePickPlace(input: PickPlaceInput): PickPlaceOutput {
  const origin = input.origin ?? 'bottom-left';
  const components = prepareComponents(input);

  const lines: string[] = [];

  // Comment header
  lines.push('# Pick and Place file — Generated by ProtoPulse');
  lines.push(`# Board: ${input.boardWidth.toFixed(1)}mm x ${input.boardHeight.toFixed(1)}mm`);
  lines.push(`# Origin: ${origin}`);
  lines.push(`# Components: ${components.length}`);

  // CSV header
  lines.push('Designator,Val,Package,PosX,PosY,Rot,Side');

  // Data rows
  components.forEach((comp) => {
    const row = [
      escapeCsvField(comp.designator),
      escapeCsvField(comp.value),
      escapeCsvField(comp.footprint),
      formatPosition(comp.posX),
      formatPosition(comp.posY),
      formatRotation(comp.rotation),
      comp.side,
    ].join(',');

    lines.push(row);
  });

  return {
    content: lines.join('\n'),
    componentCount: components.length,
  };
}

// ---------------------------------------------------------------------------
// Legacy API — original export-generators.ts signature used by ai-tools.ts
// ---------------------------------------------------------------------------

export function generateLegacyPickAndPlace(
  instances: CircuitInstanceData[],
  parts: ComponentPartData[],
): ExportResult {
  const partMap = new Map<number, ComponentPartData>();
  for (const part of parts) {
    partMap.set(part.id, part);
  }

  const header = sharedCsvRow([
    'Designator',
    'Value',
    'Package',
    'Mid X (mm)',
    'Mid Y (mm)',
    'Rotation',
    'Layer',
  ]);

  const rows = instances
    .filter((inst) => inst.pcbX !== null && inst.pcbY !== null)
    .map((inst) => {
      const part = inst.partId != null ? partMap.get(inst.partId) : undefined;
      const meta = part?.meta ?? {};
      const value = metaStr(meta, 'value', metaStr(meta, 'title', ''));
      const footprint = metaStr(meta, 'footprint', 'Unknown');
      const layer = inst.pcbSide === 'back' ? 'Bottom' : 'Top';
      const rotation = inst.pcbRotation ?? 0;

      return sharedCsvRow([
        inst.referenceDesignator,
        value,
        footprint,
        inst.pcbX!.toFixed(3),
        inst.pcbY!.toFixed(3),
        rotation,
        layer,
      ]);
    });

  return {
    content: [header, ...rows].join('\n'),
    encoding: 'utf8',
    mimeType: 'text/csv',
    filename: 'pick_and_place.csv',
  };
}
