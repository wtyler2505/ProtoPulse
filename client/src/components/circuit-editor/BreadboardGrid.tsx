import React, { useCallback, useMemo } from 'react';
import {
  BB,
  coordToPixel,
  coordKey,
  getBoardDimensions,
  type BreadboardCoord,
  type TiePoint,
  type RailPoint,
  type RailId,
  type ColumnLetter,
  type PixelPos,
} from '@/lib/circuit-editor/breadboard-model';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BreadboardGridProps {
  /** Callback when a tie-point is clicked */
  onTiePointClick?: (coord: BreadboardCoord, pixel: PixelPos) => void;
  /** Callback when mouse hovers a tie-point */
  onTiePointHover?: (coord: BreadboardCoord | null) => void;
  /** Set of coord keys that are highlighted (e.g., connected net) */
  highlightedPoints?: Set<string>;
  /** Set of coord keys that are occupied by placed components */
  occupiedPoints?: Set<string>;
  /** Currently hovered coordinate (for visual feedback) */
  hoveredCoord?: BreadboardCoord | null;
}

// ---------------------------------------------------------------------------
// Visual constants
// ---------------------------------------------------------------------------

const HOLE_RADIUS = 2.8;
const HOLE_RADIUS_RAIL = 2.4;
const LABEL_FONT_SIZE = 7;
const RAIL_LANE_HEIGHT = 3;

/** Colors — dark-theme breadboard palette */
const C = {
  boardFill: '#2a2a1e',
  boardStroke: '#3d3d2e',
  channelFill: '#1f1f15',
  holeFill: '#454535',
  holeStroke: '#333328',
  holeHighlight: '#facc15',
  holeOccupied: '#2a2a22',
  holeOccupiedStroke: '#3a3a2e',
  holeHover: '#a3e635',
  labelFill: '#6b6b56',
  railPos: '#ef4444',
  railNeg: '#3b82f6',
  railPosLane: 'rgba(239, 68, 68, 0.15)',
  railNegLane: 'rgba(59, 130, 246, 0.15)',
  railLabelPos: '#f87171',
  railLabelNeg: '#60a5fa',
} as const;

// ---------------------------------------------------------------------------
// Precomputed data for terminal tie-points and rail points
// ---------------------------------------------------------------------------

function buildTerminalPoints(): TiePoint[] {
  const pts: TiePoint[] = [];
  for (const col of BB.ALL_COLS) {
    for (let row = 1; row <= BB.ROWS; row++) {
      pts.push({ type: 'terminal', col, row });
    }
  }
  return pts;
}

function buildRailPoints(): RailPoint[] {
  const rails: RailId[] = ['top_pos', 'top_neg', 'bottom_pos', 'bottom_neg'];
  const pts: RailPoint[] = [];
  for (const rail of rails) {
    for (let i = 0; i < BB.ROWS; i++) {
      pts.push({ type: 'rail', rail, index: i });
    }
  }
  return pts;
}

const TERMINAL_POINTS = buildTerminalPoints();
const RAIL_POINTS = buildRailPoints();

/** Row numbers to label on the left axis */
const ROW_LABELS = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 63];

// ---------------------------------------------------------------------------
// Sub-components (memoized for stable rendering)
// ---------------------------------------------------------------------------

/** Single hole circle with interaction handlers */
const Hole = React.memo(function Hole({
  coord,
  cx,
  cy,
  r,
  fill,
  stroke,
  isHovered,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: {
  coord: BreadboardCoord;
  cx: number;
  cy: number;
  r: number;
  fill: string;
  stroke: string;
  isHovered: boolean;
  onClick?: (coord: BreadboardCoord, pixel: PixelPos) => void;
  onMouseEnter?: (coord: BreadboardCoord) => void;
  onMouseLeave?: () => void;
}) {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick?.(coord, { x: cx, y: cy });
    },
    [onClick, coord, cx, cy],
  );

  const handleMouseEnter = useCallback(() => {
    onMouseEnter?.(coord);
  }, [onMouseEnter, coord]);

  return (
    <circle
      cx={cx}
      cy={cy}
      r={isHovered ? r + 1 : r}
      fill={isHovered ? C.holeHover : fill}
      stroke={isHovered ? C.holeHover : stroke}
      strokeWidth={0.5}
      style={{ cursor: 'pointer', transition: 'fill 80ms, r 80ms' }}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={onMouseLeave}
      data-testid={`hole-${coordKey(coord)}`}
    />
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function BreadboardGridInner({
  onTiePointClick,
  onTiePointHover,
  highlightedPoints,
  occupiedPoints,
  hoveredCoord,
}: BreadboardGridProps) {
  const { width, height } = useMemo(() => getBoardDimensions(), []);
  const hoveredKey = hoveredCoord ? coordKey(hoveredCoord) : null;

  // Stable callbacks for hole interactions
  const handleHoleClick = useCallback(
    (coord: BreadboardCoord, pixel: PixelPos) => {
      onTiePointClick?.(coord, pixel);
    },
    [onTiePointClick],
  );

  const handleHoleEnter = useCallback(
    (coord: BreadboardCoord) => {
      onTiePointHover?.(coord);
    },
    [onTiePointHover],
  );

  const handleHoleLeave = useCallback(() => {
    onTiePointHover?.(null);
  }, [onTiePointHover]);

  // Determine fill & stroke for a given coord
  const holeFillStroke = useCallback(
    (key: string): { fill: string; stroke: string } => {
      if (highlightedPoints?.has(key)) {
        return { fill: C.holeHighlight, stroke: C.holeHighlight };
      }
      if (occupiedPoints?.has(key)) {
        return { fill: C.holeOccupied, stroke: C.holeOccupiedStroke };
      }
      return { fill: C.holeFill, stroke: C.holeStroke };
    },
    [highlightedPoints, occupiedPoints],
  );

  // ---- Memoized layers ----

  /** Column labels (a-j) */
  const columnLabels = useMemo(() => {
    return BB.ALL_COLS.map((col) => {
      const px = coordToPixel({ type: 'terminal', col, row: 1 });
      return (
        <text
          key={`col-${col}`}
          x={px.x}
          y={BB.ORIGIN_Y - 12}
          textAnchor="middle"
          dominantBaseline="auto"
          fontSize={LABEL_FONT_SIZE}
          fill={C.labelFill}
          fontFamily="monospace"
          data-testid={`col-label-${col}`}
        >
          {col}
        </text>
      );
    });
  }, []);

  /** Row labels (selected rows) on the left side */
  const rowLabels = useMemo(() => {
    return ROW_LABELS.map((row) => {
      const px = coordToPixel({ type: 'terminal', col: 'a', row });
      return (
        <text
          key={`row-${row}`}
          x={BB.ORIGIN_X - 10}
          y={px.y}
          textAnchor="end"
          dominantBaseline="central"
          fontSize={LABEL_FONT_SIZE}
          fill={C.labelFill}
          fontFamily="monospace"
          data-testid={`row-label-${row}`}
        >
          {row}
        </text>
      );
    });
  }, []);

  /** Center channel rectangle */
  const centerChannel = useMemo(() => {
    const ePos = coordToPixel({ type: 'terminal', col: 'e', row: 1 });
    const fPos = coordToPixel({ type: 'terminal', col: 'f', row: 1 });
    const lastRowY = coordToPixel({ type: 'terminal', col: 'e', row: BB.ROWS });
    const channelX = ePos.x + HOLE_RADIUS + 1;
    const channelW = fPos.x - ePos.x - 2 * (HOLE_RADIUS + 1);
    return (
      <rect
        x={channelX}
        y={ePos.y - 4}
        width={channelW}
        height={lastRowY.y - ePos.y + 8}
        fill={C.channelFill}
        rx={2}
        data-testid="center-channel"
      />
    );
  }, []);

  /** Power rail lane backgrounds and labels */
  const railLanes = useMemo(() => {
    const elements: React.ReactElement[] = [];
    const rails: RailId[] = ['top_pos', 'top_neg', 'bottom_pos', 'bottom_neg'];
    const firstX = coordToPixel({ type: 'rail', rail: 'top_pos', index: 0 }).x;
    const lastX = coordToPixel({ type: 'rail', rail: 'top_pos', index: BB.ROWS - 1 }).x;
    const laneWidth = lastX - firstX + BB.PITCH;

    for (const rail of rails) {
      const isPos = rail.endsWith('pos');
      const px = coordToPixel({ type: 'rail', rail, index: 0 });
      const laneFill = isPos ? C.railPosLane : C.railNegLane;
      const laneStroke = isPos ? C.railPos : C.railNeg;

      // Lane background stripe
      elements.push(
        <rect
          key={`lane-${rail}`}
          x={firstX - HOLE_RADIUS_RAIL - 2}
          y={px.y - RAIL_LANE_HEIGHT - 1}
          width={laneWidth + 2 * (HOLE_RADIUS_RAIL + 2) - BB.PITCH}
          height={2 * RAIL_LANE_HEIGHT + 2}
          fill={laneFill}
          stroke={laneStroke}
          strokeWidth={0.4}
          rx={2}
          opacity={0.6}
          data-testid={`rail-lane-${rail}`}
        />,
      );

      // Label at the left end
      const labelSymbol = isPos ? '+' : '\u2212';
      const labelColor = isPos ? C.railLabelPos : C.railLabelNeg;
      elements.push(
        <text
          key={`rail-label-left-${rail}`}
          x={firstX - HOLE_RADIUS_RAIL - 10}
          y={px.y}
          textAnchor="end"
          dominantBaseline="central"
          fontSize={LABEL_FONT_SIZE + 1}
          fontWeight="bold"
          fill={labelColor}
          fontFamily="monospace"
          data-testid={`rail-label-${rail}-left`}
        >
          {labelSymbol}
        </text>,
      );

      // Label at the right end
      elements.push(
        <text
          key={`rail-label-right-${rail}`}
          x={lastX + HOLE_RADIUS_RAIL + 10}
          y={px.y}
          textAnchor="start"
          dominantBaseline="central"
          fontSize={LABEL_FONT_SIZE + 1}
          fontWeight="bold"
          fill={labelColor}
          fontFamily="monospace"
          data-testid={`rail-label-${rail}-right`}
        >
          {labelSymbol}
        </text>,
      );
    }

    return elements;
  }, []);

  /** Terminal strip holes */
  const terminalHoles = useMemo(() => {
    return TERMINAL_POINTS.map((tp) => {
      const key = coordKey(tp);
      const px = coordToPixel(tp);
      const { fill, stroke } = holeFillStroke(key);
      return (
        <Hole
          key={key}
          coord={tp}
          cx={px.x}
          cy={px.y}
          r={HOLE_RADIUS}
          fill={fill}
          stroke={stroke}
          isHovered={hoveredKey === key}
          onClick={handleHoleClick}
          onMouseEnter={handleHoleEnter}
          onMouseLeave={handleHoleLeave}
        />
      );
    });
  }, [holeFillStroke, hoveredKey, handleHoleClick, handleHoleEnter, handleHoleLeave]);

  /** Rail holes */
  const railHoles = useMemo(() => {
    return RAIL_POINTS.map((rp) => {
      const key = coordKey(rp);
      const px = coordToPixel(rp);
      const { fill, stroke } = holeFillStroke(key);
      return (
        <Hole
          key={key}
          coord={rp}
          cx={px.x}
          cy={px.y}
          r={HOLE_RADIUS_RAIL}
          fill={fill}
          stroke={stroke}
          isHovered={hoveredKey === key}
          onClick={handleHoleClick}
          onMouseEnter={handleHoleEnter}
          onMouseLeave={handleHoleLeave}
        />
      );
    });
  }, [holeFillStroke, hoveredKey, handleHoleClick, handleHoleEnter, handleHoleLeave]);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
      data-testid="breadboard-grid"
    >
      {/* Board background */}
      <rect
        x={1}
        y={1}
        width={width - 2}
        height={height - 2}
        rx={6}
        ry={6}
        fill={C.boardFill}
        stroke={C.boardStroke}
        strokeWidth={1.5}
        data-testid="board-background"
      />

      {/* Center channel */}
      {centerChannel}

      {/* Rail lane backgrounds & labels */}
      {railLanes}

      {/* Labels: columns and rows */}
      {columnLabels}
      {rowLabels}

      {/* Rail holes (behind terminal holes in stacking) */}
      {railHoles}

      {/* Terminal strip holes */}
      {terminalHoles}
    </svg>
  );
}

const BreadboardGrid = React.memo(BreadboardGridInner);

export default BreadboardGrid;
export type { BreadboardGridProps };
