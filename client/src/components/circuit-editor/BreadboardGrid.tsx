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

/** Drop preview state passed from the drag handler to render collision feedback. */
export interface DropPreviewState {
  /** The breadboard coordinate the dragged component would snap to, or null. */
  coord: BreadboardCoord | null;
  /** True when the snap target would cause a collision (tie-point or body). */
  collision: boolean;
}

/** Fit zone — a contiguous row range where a large component can be placed. */
export interface FitZone {
  startRow: number;
  rowSpan: number;
  crossesChannel: boolean;
  startCol: string;
}

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
  /** When true, shows an empty-state guidance overlay on the board */
  showEmptyGuidance?: boolean;
  /** Real-time drag drop preview — shows valid/collision indicator at snap target. */
  dropPreview?: DropPreviewState;
  /** Available fit zones to highlight during drag of large components. */
  fitZones?: FitZone[];
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
  holeHighlight: 'var(--color-editor-accent)',
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
  const rails: RailId[] = ['left_pos', 'left_neg', 'right_pos', 'right_neg'];
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
  showEmptyGuidance,
  dropPreview,
  fitZones,
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

  /** Power rail lane backgrounds and labels — vertical stripes along left/right edges */
  const railLanes = useMemo(() => {
    const elements: React.ReactElement[] = [];
    const rails: RailId[] = ['left_pos', 'left_neg', 'right_pos', 'right_neg'];
    const firstY = coordToPixel({ type: 'rail', rail: 'left_pos', index: 0 }).y;
    const lastY = coordToPixel({ type: 'rail', rail: 'left_pos', index: BB.ROWS - 1 }).y;
    const laneHeight = lastY - firstY + BB.PITCH;

    for (const rail of rails) {
      const isPos = rail.endsWith('pos');
      const px = coordToPixel({ type: 'rail', rail, index: 0 });
      const laneFill = isPos ? C.railPosLane : C.railNegLane;
      const laneStroke = isPos ? C.railPos : C.railNeg;

      // Vertical lane background stripe
      elements.push(
        <rect
          key={`lane-${rail}`}
          x={px.x - RAIL_LANE_HEIGHT - 1}
          y={firstY - HOLE_RADIUS_RAIL - 2}
          width={2 * RAIL_LANE_HEIGHT + 2}
          height={laneHeight + 2 * (HOLE_RADIUS_RAIL + 2) - BB.PITCH}
          fill={laneFill}
          stroke={laneStroke}
          strokeWidth={0.4}
          rx={2}
          opacity={0.6}
          data-testid={`rail-lane-${rail}`}
        />,
      );

      // Label at the top end
      const labelSymbol = isPos ? '+' : '\u2212';
      const labelColor = isPos ? C.railLabelPos : C.railLabelNeg;
      elements.push(
        <text
          key={`rail-label-top-${rail}`}
          x={px.x}
          y={firstY - HOLE_RADIUS_RAIL - 10}
          textAnchor="middle"
          dominantBaseline="auto"
          fontSize={LABEL_FONT_SIZE + 1}
          fontWeight="bold"
          fill={labelColor}
          fontFamily="monospace"
          data-testid={`rail-label-${rail}-top`}
        >
          {labelSymbol}
        </text>,
      );

      // Label at the bottom end
      elements.push(
        <text
          key={`rail-label-bottom-${rail}`}
          x={px.x}
          y={lastY + HOLE_RADIUS_RAIL + 12}
          textAnchor="middle"
          dominantBaseline="auto"
          fontSize={LABEL_FONT_SIZE + 1}
          fontWeight="bold"
          fill={labelColor}
          fontFamily="monospace"
          data-testid={`rail-label-${rail}-bottom`}
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

      {/* BL-0592: Connected-row highlight overlay */}
      {highlightedPoints && highlightedPoints.size > 0 && (
        <g data-testid="breadboard-highlight-overlay" pointerEvents="none">
          {[...TERMINAL_POINTS, ...RAIL_POINTS]
            .filter((pt) => highlightedPoints.has(coordKey(pt)))
            .map((pt) => {
              const key = coordKey(pt);
              const px = coordToPixel(pt);
              const r = pt.type === 'terminal' ? HOLE_RADIUS + 2 : HOLE_RADIUS_RAIL + 2;
              return (
                <rect
                  key={`hl-${key}`}
                  x={px.x - r}
                  y={px.y - r}
                  width={r * 2}
                  height={r * 2}
                  rx={2}
                  fill="rgba(0, 240, 255, 0.15)"
                  stroke="rgba(0, 240, 255, 0.4)"
                  strokeWidth={0.5}
                />
              );
            })}
        </g>
      )}

      {/* Fit-zone overlay — highlights where large components can be placed */}
      {fitZones && fitZones.length > 0 && (
        <g data-testid="fit-zone-overlay" pointerEvents="none">
          {fitZones.map((zone) => {
            const topPx = coordToPixel({
              type: 'terminal',
              col: zone.crossesChannel ? 'e' : (zone.startCol as ColumnLetter),
              row: zone.startRow,
            });
            const bottomPx = coordToPixel({
              type: 'terminal',
              col: zone.crossesChannel ? 'f' : (zone.startCol as ColumnLetter),
              row: zone.startRow + zone.rowSpan - 1,
            });
            const x = zone.crossesChannel ? topPx.x - 4 : topPx.x - 4;
            const w = zone.crossesChannel ? (bottomPx.x - topPx.x) + 8 : 8;
            const y = topPx.y - 4;
            const h = (bottomPx.y - topPx.y) + 8;
            return (
              <rect
                key={`fz-${zone.startRow}-${zone.crossesChannel ? 'ch' : zone.startCol}`}
                x={x}
                y={y}
                width={w}
                height={h}
                rx={3}
                fill="rgba(163, 230, 53, 0.08)"
                stroke="rgba(163, 230, 53, 0.3)"
                strokeWidth={0.8}
                strokeDasharray="3,2"
                data-testid={`fit-zone-${zone.startRow}`}
              />
            );
          })}
        </g>
      )}

      {/* Drop preview indicator — shows valid (cyan) or collision (red) during drag */}
      {dropPreview?.coord && (
        (() => {
          const px = coordToPixel(dropPreview.coord);
          const r = dropPreview.coord.type === 'terminal' ? HOLE_RADIUS + 4 : HOLE_RADIUS_RAIL + 4;
          const color = dropPreview.collision
            ? 'rgba(239, 68, 68, 0.7)'
            : 'rgba(0, 240, 255, 0.7)';
          const fillColor = dropPreview.collision
            ? 'rgba(239, 68, 68, 0.15)'
            : 'rgba(0, 240, 255, 0.15)';
          return (
            <circle
              cx={px.x}
              cy={px.y}
              r={r}
              fill={fillColor}
              stroke={color}
              strokeWidth={1.5}
              pointerEvents="none"
              data-testid="drop-preview-indicator"
            />
          );
        })()
      )}

      {/* Empty state guidance */}
      {showEmptyGuidance && (
        <g data-testid="breadboard-empty-overlay">
          <rect
            x={width / 2 - 130}
            y={height / 2 - 30}
            width={260}
            height={60}
            rx={6}
            fill="rgba(0,0,0,0.7)"
            stroke="#333"
            strokeWidth={1}
          />
          <text
            x={width / 2}
            y={height / 2 - 5}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={11}
            fill="#a1a1aa"
            fontFamily="system-ui, sans-serif"
          >
            Drag a starter or project part onto the board
          </text>
          <text
            x={width / 2}
            y={height / 2 + 15}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={10}
            fill="#71717a"
            fontFamily="system-ui, sans-serif"
          >
            then route interactive wires between real pin rows.
          </text>
        </g>
      )}
    </svg>
  );
}

const BreadboardGrid = React.memo(BreadboardGridInner);

export default BreadboardGrid;
export type { BreadboardGridProps };
