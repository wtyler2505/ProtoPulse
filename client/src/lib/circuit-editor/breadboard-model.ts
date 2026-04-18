/**
 * Breadboard grid coordinate system.
 *
 * Models a standard 830-point solderless breadboard (internally 882 tie-points — see MODEL_TIE_POINTS vs PHYSICAL_TIE_POINTS):
 *   - Terminal strips: columns a-e (left) and f-j (right), rows 1-63
 *   - Power rails: two pairs running along the top and bottom edges
 *   - Center channel (DIP gap) between columns e and f
 *
 * Tie-point connectivity:
 *   - Within a terminal strip row (same row, columns a-e OR f-j) all
 *     5 tie-points are electrically connected.
 *   - Power rail segments: each rail runs continuously.
 *   - No connection crosses the center channel or between terminal
 *     strips and power rails by default.
 */

import { getBodyBounds, checkBodyOverlap, type BodyBounds } from './body-bounds';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Standard breadboard dimensions */
export const BB = {
  /** Number of terminal-strip rows (1-based: 1..63) */
  ROWS: 63,

  /** Left-group column letters */
  LEFT_COLS: ['a', 'b', 'c', 'd', 'e'] as const,
  /** Right-group column letters */
  RIGHT_COLS: ['f', 'g', 'h', 'i', 'j'] as const,

  /** All terminal-strip column letters in order */
  ALL_COLS: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'] as const,

  /** Standard 0.1″ pitch in pixels (100 mil at 1px/mil) */
  PITCH: 10,

  /** Pixel offsets — distances from board top-left origin */
  ORIGIN_X: 30,
  ORIGIN_Y: 50,

  /** Gap height (in px) for the center channel between e and f columns */
  CHANNEL_GAP: 20,

  /** Power-rail horizontal offsets from terminal strips (for vertical rails) */
  RAIL_MARGIN_LEFT: 20,
  RAIL_MARGIN_RIGHT: 20,

  /**
   * Model tie-point count: terminals + rail-model points.
   *
   * 2 groups × 5 cols × 63 rows = 630 terminal tie-points.
   * 4 rails × 63 points per rail (model alignment with terminal rows) = 252.
   * Total = 882.
   *
   * Note: this differs from PHYSICAL_TIE_POINTS. ProtoPulse models each power
   * rail as 63 contiguous points for alignment with terminal rows. Real BB830
   * breadboards break each rail into two 50-point halves separated by a
   * mid-rail gap (4 × 50 = 200 rail points + 630 terminals = 830 total).
   */
  MODEL_TIE_POINTS: 2 * 5 * 63 + 4 * 63,  // 882

  /**
   * Physical tie-point count for a standard BB830 solderless breadboard.
   *
   * 2 groups × 5 cols × 63 rows = 630 terminal tie-points + 200 rail tie-points
   * (4 rails × 50 points each, split by mid-rail gap) = 830 total.
   *
   * Sources:
   * - BusBoard BB830 datasheet: https://www.busboard.com/BB830
   * - Adafruit product 239: https://www.adafruit.com/product/239
   * - Jameco datasheet: https://www.jameco.com/Jameco/Products/ProdDS/2125026.pdf
   */
  PHYSICAL_TIE_POINTS: 2 * 5 * 63 + 4 * 50,  // 830
} as const;

export type ColumnLetter = (typeof BB.ALL_COLS)[number];
export type LeftColumn = (typeof BB.LEFT_COLS)[number];
export type RightColumn = (typeof BB.RIGHT_COLS)[number];

/** Power-rail identifiers */
export type RailId = 'left_pos' | 'left_neg' | 'right_pos' | 'right_neg';

// ---------------------------------------------------------------------------
// Coordinate types
// ---------------------------------------------------------------------------

/** A terminal-strip tie-point coordinate */
export interface TiePoint {
  type: 'terminal';
  col: ColumnLetter;
  row: number; // 1..63
}

/** A power-rail tie-point coordinate */
export interface RailPoint {
  type: 'rail';
  rail: RailId;
  index: number; // 0..62  (maps to row 1..63)
}

/** Any breadboard grid coordinate */
export type BreadboardCoord = TiePoint | RailPoint;

/** Pixel position on canvas */
export interface PixelPos {
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Coordinate → Pixel mapping
// ---------------------------------------------------------------------------

const colIndex: Record<ColumnLetter, number> = {
  a: 0, b: 1, c: 2, d: 3, e: 4,
  f: 5, g: 6, h: 7, i: 8, j: 9,
};

/**
 * Convert a breadboard coordinate to a pixel position.
 * Origin (0,0) is the top-left of the breadboard SVG.
 */
export function coordToPixel(coord: BreadboardCoord): PixelPos {
  if (coord.type === 'terminal') {
    const ci = colIndex[coord.col];
    const gap = ci >= 5 ? BB.CHANNEL_GAP : 0;
    return {
      x: BB.ORIGIN_X + ci * BB.PITCH + gap,
      y: BB.ORIGIN_Y + (coord.row - 1) * BB.PITCH,
    };
  }

  // Rail points — rails run vertically along the left/right edges of the board.
  const isLeft = coord.rail.startsWith('left');
  const isPos = coord.rail.endsWith('pos');

  // Right-side terminal strip edge (column 'j')
  const rightEdgeX = BB.ORIGIN_X + 9 * BB.PITCH + BB.CHANNEL_GAP;

  let railX: number;
  if (isLeft) {
    // Left rails: pos is outer (leftmost), neg is inner (closer to terminals)
    railX = isPos
      ? BB.ORIGIN_X - BB.RAIL_MARGIN_LEFT
      : BB.ORIGIN_X - BB.RAIL_MARGIN_LEFT + BB.PITCH;
  } else {
    // Right rails: neg is inner (closer to terminals), pos is outer (rightmost)
    railX = isPos
      ? rightEdgeX + BB.RAIL_MARGIN_RIGHT + BB.PITCH
      : rightEdgeX + BB.RAIL_MARGIN_RIGHT;
  }

  return {
    x: railX,
    y: BB.ORIGIN_Y + coord.index * BB.PITCH,
  };
}

/**
 * Snap a pixel position to the nearest breadboard coordinate.
 * Returns null if the position is too far from any tie-point.
 */
export function pixelToCoord(px: PixelPos, snapRadius = BB.PITCH * 0.6): BreadboardCoord | null {
  let bestDist = Infinity;
  let bestCoord: BreadboardCoord | null = null;

  // Check terminal strips
  for (const col of BB.ALL_COLS) {
    for (let row = 1; row <= BB.ROWS; row++) {
      const tp: TiePoint = { type: 'terminal', col, row };
      const tpPx = coordToPixel(tp);
      const d = Math.hypot(px.x - tpPx.x, px.y - tpPx.y);
      if (d < bestDist) {
        bestDist = d;
        bestCoord = tp;
      }
    }
  }

  // Check power rails
  const rails: RailId[] = ['left_pos', 'left_neg', 'right_pos', 'right_neg'];
  for (const rail of rails) {
    for (let i = 0; i < BB.ROWS; i++) {
      const rp: RailPoint = { type: 'rail', rail, index: i };
      const rpPx = coordToPixel(rp);
      const d = Math.hypot(px.x - rpPx.x, px.y - rpPx.y);
      if (d < bestDist) {
        bestDist = d;
        bestCoord = rp;
      }
    }
  }

  return bestDist <= snapRadius ? bestCoord : null;
}

// ---------------------------------------------------------------------------
// Connectivity
// ---------------------------------------------------------------------------

/**
 * Canonical key for a tie-point (used for equality checks and set membership).
 */
export function coordKey(coord: BreadboardCoord): string {
  if (coord.type === 'terminal') return `t:${coord.col}${coord.row}`;
  return `r:${coord.rail}:${coord.index}`;
}

/**
 * Return all coordinates electrically connected to the given point
 * (including itself).
 */
export function getConnectedPoints(coord: BreadboardCoord): BreadboardCoord[] {
  if (coord.type === 'rail') {
    // Entire rail strip is one net
    return Array.from({ length: BB.ROWS }, (_, i): RailPoint => ({
      type: 'rail',
      rail: coord.rail,
      index: i,
    }));
  }

  // Terminal strip: same row, same side (a-e or f-j)
  const ci = colIndex[coord.col];
  const group = ci < 5 ? BB.LEFT_COLS : BB.RIGHT_COLS;
  return group.map((col): TiePoint => ({
    type: 'terminal',
    col,
    row: coord.row,
  }));
}

/**
 * Check whether two coordinates are electrically connected
 * through the internal breadboard wiring (no external wires).
 */
export function areConnected(a: BreadboardCoord, b: BreadboardCoord): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'rail' && b.type === 'rail') {
    return a.rail === b.rail;
  }
  if (a.type === 'terminal' && b.type === 'terminal') {
    if (a.row !== b.row) return false;
    const ai = colIndex[a.col];
    const bi = colIndex[b.col];
    return (ai < 5 && bi < 5) || (ai >= 5 && bi >= 5);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Wire color coding (BL-0591)
// ---------------------------------------------------------------------------

/** Standard wire color presets for breadboard wiring */
export const WIRE_COLOR_PRESETS: ReadonlyArray<{ name: string; hex: string }> = [
  { name: 'Red', hex: '#e74c3c' },
  { name: 'Black', hex: '#1a1a2e' },
  { name: 'Yellow', hex: '#f1c40f' },
  { name: 'Orange', hex: '#e67e22' },
  { name: 'Green', hex: '#2ecc71' },
  { name: 'Blue', hex: '#3498db' },
  { name: 'White', hex: '#ecf0f1' },
  { name: 'Purple', hex: '#9b59b6' },
] as const;

const DEFAULT_WIRE_COLOR = '#2ecc71'; // green

/**
 * Return a sensible default wire color based on a net name convention.
 * Red for power, black for ground, blue for I2C/SPI, green for everything else.
 */
export function getDefaultColorForNet(netName: string | null | undefined): string {
  if (!netName) return DEFAULT_WIRE_COLOR;
  const upper = netName.toUpperCase();
  if (upper === 'VCC' || upper === 'VDD' || upper === '5V' || upper === '3V3' || upper === '3.3V') {
    return '#e74c3c'; // red
  }
  if (upper === 'GND' || upper === 'VSS') {
    return '#1a1a2e'; // black
  }
  if (upper === 'SDA' || upper === 'SCL' || upper === 'MOSI' || upper === 'MISO' || upper === 'SCK' || upper === 'SS') {
    return '#3498db'; // blue
  }
  return DEFAULT_WIRE_COLOR;
}

/** Serialized form of wire color data for persistence */
export interface WireColorData {
  wireColors: Record<string, string>;
}

/**
 * Wire color storage: maps wire IDs → hex color strings.
 * Provides get/set/serialize/deserialize for breadboard wire colors.
 */
export class WireColorManager {
  private colors = new Map<string, string>();
  private listeners: Array<() => void> = [];

  /** Set the color for a specific wire. Notifies listeners. */
  setWireColor(wireId: string, color: string): void {
    this.colors.set(wireId, color);
    this.notify();
  }

  /** Get the color for a wire, or the default green if not set. */
  getWireColor(wireId: string): string {
    return this.colors.get(wireId) ?? DEFAULT_WIRE_COLOR;
  }

  /** Remove the color entry for a wire. */
  removeWireColor(wireId: string): void {
    this.colors.delete(wireId);
    this.notify();
  }

  /** Return all stored wire colors as a plain object. */
  serialize(): WireColorData {
    const wireColors: Record<string, string> = {};
    for (const [k, v] of Array.from(this.colors.entries())) {
      wireColors[k] = v;
    }
    return { wireColors };
  }

  /** Restore wire colors from a serialized object. */
  deserialize(data: WireColorData): void {
    this.colors.clear();
    if (data.wireColors) {
      for (const [k, v] of Object.entries(data.wireColors)) {
        this.colors.set(k, v);
      }
    }
    this.notify();
  }

  /** Subscribe to changes. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    for (const l of this.listeners) {
      l();
    }
  }
}

// ---------------------------------------------------------------------------
// Connected holes helper (BL-0592)
// ---------------------------------------------------------------------------

/** Simple row/column pair for breadboard hole positions */
export interface HolePosition {
  row: number;
  col: string;
  type: 'terminal' | 'rail';
  /** For rail holes, identifies which rail */
  rail?: RailId;
}

/**
 * Return all holes electrically connected to the given position.
 *
 * For terminal strips: same row, same half (a-e or f-j) — 5 holes.
 * For power rails: entire rail strip — all BB.ROWS holes.
 *
 * This is a convenience wrapper around `getConnectedPoints` that returns
 * a simpler `HolePosition` format suitable for UI highlight rendering.
 */
export function getConnectedHoles(row: number, col: string): HolePosition[] {
  // Determine if this is a rail or terminal position
  const railMapping: Record<string, RailId> = {
    '+t': 'left_pos',
    '-t': 'left_neg',
    '+b': 'right_pos',
    '-b': 'right_neg',
  };

  // Check if col is a rail identifier
  const railId = railMapping[col];
  if (railId) {
    // Power rail: return entire rail
    return Array.from({ length: BB.ROWS }, (_, i): HolePosition => ({
      row: i + 1,
      col,
      type: 'rail',
      rail: railId,
    }));
  }

  // Terminal strip: determine which side (left a-e, right f-j)
  const colLetter = col as ColumnLetter;
  const ci = colIndex[colLetter];
  if (ci == null) return [];

  const group = ci < 5 ? BB.LEFT_COLS : BB.RIGHT_COLS;
  return group.map((c): HolePosition => ({
    row,
    col: c,
    type: 'terminal',
  }));
}

// ---------------------------------------------------------------------------
// Board dimensions (for SVG sizing)
// ---------------------------------------------------------------------------

export function getBoardDimensions(): { width: number; height: number } {
  // Right-side outer rail is the widest element
  const rightOuterRail = coordToPixel({ type: 'rail', rail: 'right_pos', index: 0 });
  const lastTerminalY = coordToPixel({ type: 'terminal', col: 'a', row: BB.ROWS });
  return {
    width: rightOuterRail.x + BB.RAIL_MARGIN_RIGHT,
    height: lastTerminalY.y + BB.ORIGIN_Y,
  };
}

// ---------------------------------------------------------------------------
// Component placement helpers
// ---------------------------------------------------------------------------

/** A DIP IC spans the center channel from column e to column f */
export interface ComponentPlacement {
  /** Reference designator */
  refDes: string;
  /** Top-left position: column and starting row */
  startCol: ColumnLetter;
  startRow: number;
  /** Number of rows the component spans */
  rowSpan: number;
  /**
   * Number of columns the component spans (within its left or right group).
   * Defaults to 1 at the use-site. Ignored for DIP ICs that cross the channel.
   */
  colSpan?: number;
  /** Whether it crosses the center channel (DIP ICs) */
  crossesChannel: boolean;
}

/**
 * Get the tie-points occupied by a component placement.
 * For a DIP IC crossing the channel, it occupies columns e and f
 * for the specified row span.
 */
export function getOccupiedPoints(placement: ComponentPlacement): TiePoint[] {
  const points: TiePoint[] = [];
  if (placement.crossesChannel) {
    // DIP: straddles e-f across the channel
    for (let r = placement.startRow; r < placement.startRow + placement.rowSpan; r++) {
      points.push({ type: 'terminal', col: 'e', row: r });
      points.push({ type: 'terminal', col: 'f', row: r });
    }
  } else {
    const startCi = colIndex[placement.startCol];
    const group = startCi < 5 ? BB.LEFT_COLS : BB.RIGHT_COLS;
    const colSpan = placement.colSpan ?? 1;
    // Component occupies one side, spanning rows and columns
    for (let r = placement.startRow; r < placement.startRow + placement.rowSpan; r++) {
      // Iterating `group` (not all 10 cols) naturally clamps the span to the
      // starting left/right half — colSpan that extends past e or j is truncated.
      for (const col of group) {
        const currentCi = colIndex[col];
        if (currentCi >= startCi && currentCi < startCi + colSpan) {
          points.push({ type: 'terminal', col, row: r });
        }
      }
    }
  }
  return points;
}

/**
 * Check if a placement collides with existing placements (tie-point overlap).
 */
export function checkCollision(
  newPlacement: ComponentPlacement,
  existing: ComponentPlacement[],
): boolean {
  const newKeys = new Set(getOccupiedPoints(newPlacement).map(coordKey));
  for (const p of existing) {
    for (const pt of getOccupiedPoints(p)) {
      if (newKeys.has(coordKey(pt))) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Body-volume collision
// ---------------------------------------------------------------------------

/**
 * Convert a ComponentPlacement to a positioned BodyBounds in board-local pixels.
 * The body is centered on the component's occupied footprint.
 */
export function placementToBodyBounds(
  placement: ComponentPlacement,
  componentType: string,
  pinCount: number,
  opts?: { subType?: string },
): BodyBounds {
  const baseBounds = getBodyBounds(componentType, pinCount, opts);

  // Get the pixel position of the first occupied point to anchor the body
  const firstPoint = getOccupiedPoints(placement)[0];
  if (!firstPoint) {
    return baseBounds; // degenerate — no occupied points
  }
  const origin = coordToPixel(firstPoint);

  // Center the body bounds on the footprint span
  const lastRow = placement.startRow + placement.rowSpan - 1;
  const lastPoint: TiePoint = { type: 'terminal', col: placement.startCol, row: lastRow };
  const end = coordToPixel(lastPoint);

  const footprintCenterX = (origin.x + end.x) / 2;
  const footprintCenterY = (origin.y + end.y) / 2;

  return {
    x: footprintCenterX - baseBounds.width / 2,
    y: footprintCenterY - baseBounds.height / 2,
    width: baseBounds.width,
    height: baseBounds.height,
  };
}

/**
 * Check if a new placement's physical body volume collides with any existing
 * placement. This complements `checkCollision` (tie-point overlap) by detecting
 * cases where tall components block space even though pins don't conflict.
 *
 * Flat components (resistors, small caps) never trigger body collisions with
 * each other — only when at least one component is tall.
 *
 * @param newPlacement   - The proposed new placement
 * @param existing       - Already-placed components (with their types stored externally)
 * @param componentType  - Type of the new component ('resistor', 'ic', etc.)
 * @param pinCount       - Pin count of the new component
 * @param opts           - Optional sub-type for variant selection
 * @param existingTypes  - Optional parallel array of {type, pinCount, subType} for existing
 *                         placements. If omitted, existing placements are assumed to be
 *                         generic 2-pin components (conservative — flat profile).
 */
export function checkBodyCollision(
  newPlacement: ComponentPlacement,
  existing: ComponentPlacement[],
  componentType: string,
  pinCount: number,
  opts?: { subType?: string },
  existingTypes?: Array<{ type: string; pinCount: number; subType?: string }>,
): boolean {
  if (existing.length === 0) {
    return false;
  }

  const newBounds = placementToBodyBounds(newPlacement, componentType, pinCount, opts);

  for (let i = 0; i < existing.length; i++) {
    const ext = existingTypes?.[i];
    const extType = ext?.type ?? 'resistor';
    const extPins = ext?.pinCount ?? 2;
    const extOpts = ext?.subType ? { subType: ext.subType } : undefined;

    const extBounds = placementToBodyBounds(existing[i], extType, extPins, extOpts);

    if (checkBodyOverlap(newBounds, extBounds)) {
      return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Fit-zone detection
// ---------------------------------------------------------------------------

/** A zone where a component of a given row span can be placed. */
export interface AvailableZone {
  /** First row of the zone. */
  startRow: number;
  /** Number of contiguous rows available. */
  rowSpan: number;
  /** Whether this zone crosses the center channel (DIP placement). */
  crossesChannel: boolean;
  /** Starting column — 'e' for channel-crossing, varies for single-side. */
  startCol: ColumnLetter;
}

/**
 * Find all contiguous row ranges on the board where a component of the given
 * row span can fit without overlapping any existing placement.
 *
 * For channel-crossing placements (DIP ICs), rows are checked against columns
 * e and f. For single-side placements, rows are checked against the left group
 * (column a).
 *
 * @param rowSpan         - How many rows the component needs
 * @param crossesChannel  - Whether the component straddles the center channel
 * @param existing        - Already-placed components
 * @returns Array of AvailableZone describing valid starting positions
 */
export function getAvailableZones(
  rowSpan: number,
  crossesChannel: boolean,
  existing: ComponentPlacement[],
): AvailableZone[] {
  // Build a set of occupied rows for the relevant columns
  const occupiedRows = new Set<number>();
  for (const p of existing) {
    // Only consider placements that share column space
    if (crossesChannel && p.crossesChannel) {
      // Both use the channel — rows conflict
      for (let r = p.startRow; r < p.startRow + p.rowSpan; r++) {
        occupiedRows.add(r);
      }
    } else if (crossesChannel) {
      // New is channel-crossing, existing is single-side.
      // Channel-crossing uses e and f; single-side might use e or f group
      const ci = colIndex[p.startCol];
      if (ci === colIndex['e'] || ci === colIndex['f']) {
        for (let r = p.startRow; r < p.startRow + p.rowSpan; r++) {
          occupiedRows.add(r);
        }
      }
    } else if (p.crossesChannel) {
      // New is single-side, existing crosses channel — conflicts on e/f rows
      for (let r = p.startRow; r < p.startRow + p.rowSpan; r++) {
        occupiedRows.add(r);
      }
    } else {
      // Both single-side — conflict only if same column group
      for (let r = p.startRow; r < p.startRow + p.rowSpan; r++) {
        occupiedRows.add(r);
      }
    }
  }

  const zones: AvailableZone[] = [];
  const maxStartRow = BB.ROWS - rowSpan + 1;
  const startCol: ColumnLetter = crossesChannel ? 'e' : 'a';

  for (let row = 1; row <= maxStartRow; row++) {
    let fits = true;
    for (let r = row; r < row + rowSpan; r++) {
      if (occupiedRows.has(r)) {
        fits = false;
        break;
      }
    }
    if (fits) {
      zones.push({ startRow: row, rowSpan, crossesChannel, startCol });
    }
  }

  return zones;
}
