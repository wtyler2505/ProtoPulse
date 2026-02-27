/**
 * Breadboard grid coordinate system.
 *
 * Models a standard 830-point solderless breadboard:
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

  /** Power-rail vertical offsets from board top/bottom */
  RAIL_OFFSET_TOP: 10,
  RAIL_OFFSET_BOTTOM: 10,

  /** Power rail position relative to terminal-strip rows */
  RAIL_TOP_Y: 20,
  RAIL_BOTTOM_Y_OFFSET: 30,

  /** Total tie-points: 2 groups × 5 cols × 63 rows + 4 rails × 63 points */
  TOTAL_TIE_POINTS: 2 * 5 * 63 + 4 * 63,  // 630 + 252 = 882 (real-world ≈ 830)
} as const;

export type ColumnLetter = (typeof BB.ALL_COLS)[number];
export type LeftColumn = (typeof BB.LEFT_COLS)[number];
export type RightColumn = (typeof BB.RIGHT_COLS)[number];

/** Power-rail identifiers */
export type RailId = 'top_pos' | 'top_neg' | 'bottom_pos' | 'bottom_neg';

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

  // Rail points
  const rowY = (coord.index) * BB.PITCH;
  const isTop = coord.rail.startsWith('top');
  const isPos = coord.rail.endsWith('pos');

  const baseY = isTop
    ? BB.RAIL_TOP_Y
    : BB.ORIGIN_Y + (BB.ROWS - 1) * BB.PITCH + BB.RAIL_BOTTOM_Y_OFFSET;

  return {
    x: BB.ORIGIN_X + coord.index * BB.PITCH,
    y: baseY + (isPos ? 0 : BB.PITCH),
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
  const rails: RailId[] = ['top_pos', 'top_neg', 'bottom_pos', 'bottom_neg'];
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
// Board dimensions (for SVG sizing)
// ---------------------------------------------------------------------------

export function getBoardDimensions(): { width: number; height: number } {
  const lastCol = coordToPixel({ type: 'terminal', col: 'j', row: BB.ROWS });
  const railBottom = coordToPixel({ type: 'rail', rail: 'bottom_neg', index: BB.ROWS - 1 });
  return {
    width: lastCol.x + BB.ORIGIN_X,
    height: Math.max(lastCol.y, railBottom.y) + BB.ORIGIN_Y,
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
    const ci = colIndex[placement.startCol];
    const group = ci < 5 ? BB.LEFT_COLS : BB.RIGHT_COLS;
    // Component occupies one side, spanning rows
    for (let r = placement.startRow; r < placement.startRow + placement.rowSpan; r++) {
      for (const col of group) {
        if (colIndex[col] >= colIndex[placement.startCol]
          && colIndex[col] < colIndex[placement.startCol] + 1) {
          points.push({ type: 'terminal', col, row: r });
        }
      }
    }
  }
  return points;
}

/**
 * Check if a placement collides with existing placements.
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
