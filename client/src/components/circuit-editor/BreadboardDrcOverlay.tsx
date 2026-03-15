/**
 * BL-0544: BreadboardDrcOverlay
 *
 * SVG overlay that renders DRC violation markers on the breadboard canvas.
 * Errors show as red X markers, warnings as yellow ! markers.
 * Hover tooltips display the violation message.
 */

import { memo, useMemo, useState, useCallback } from 'react';
import { runBreadboardDrc, type BreadboardDrcViolation, type BreadboardDrcResult } from '@/lib/circuit-editor/breadboard-drc';
import type { CircuitNetRow, CircuitWireRow, CircuitInstanceRow, ComponentPart } from '@shared/schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BreadboardDrcOverlayProps {
  nets: CircuitNetRow[];
  wires: CircuitWireRow[];
  instances: CircuitInstanceRow[];
  parts: ComponentPart[];
  /** Whether the DRC overlay is visible */
  visible: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ERROR_COLOR = '#ef4444';
const WARNING_COLOR = '#facc15';
const MARKER_SIZE = 5;

// ---------------------------------------------------------------------------
// Marker renderers
// ---------------------------------------------------------------------------

/** Red X marker for errors */
function ErrorMarker({ x, y, size }: { x: number; y: number; size: number }) {
  const half = size / 2;
  return (
    <g>
      <circle cx={x} cy={y} r={size} fill="rgba(239,68,68,0.15)" />
      <line
        x1={x - half} y1={y - half}
        x2={x + half} y2={y + half}
        stroke={ERROR_COLOR} strokeWidth={1.2} strokeLinecap="round"
      />
      <line
        x1={x + half} y1={y - half}
        x2={x - half} y2={y + half}
        stroke={ERROR_COLOR} strokeWidth={1.2} strokeLinecap="round"
      />
    </g>
  );
}

/** Yellow ! marker for warnings */
function WarningMarker({ x, y, size }: { x: number; y: number; size: number }) {
  // Triangle with exclamation mark
  const half = size;
  const topY = y - half;
  const botY = y + half * 0.6;
  const leftX = x - half * 0.8;
  const rightX = x + half * 0.8;
  return (
    <g>
      <polygon
        points={`${x},${topY} ${leftX},${botY} ${rightX},${botY}`}
        fill="rgba(250,204,21,0.15)"
        stroke={WARNING_COLOR}
        strokeWidth={0.8}
        strokeLinejoin="round"
      />
      <line
        x1={x} y1={topY + half * 0.4}
        x2={x} y2={botY - half * 0.4}
        stroke={WARNING_COLOR} strokeWidth={0.8} strokeLinecap="round"
      />
      <circle cx={x} cy={botY - half * 0.15} r={0.5} fill={WARNING_COLOR} />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

interface TooltipState {
  x: number;
  y: number;
  message: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const BreadboardDrcOverlay = memo(function BreadboardDrcOverlay({
  nets,
  wires,
  instances,
  parts,
  visible,
}: BreadboardDrcOverlayProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  // Run DRC analysis
  const drcResult: BreadboardDrcResult = useMemo(
    () => runBreadboardDrc(nets, wires, instances, parts),
    [nets, wires, instances, parts],
  );

  const handleMouseEnter = useCallback((v: BreadboardDrcViolation) => {
    setTooltip({ x: v.pixel.x, y: v.pixel.y, message: v.message });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  if (!visible || drcResult.violations.length === 0) {
    return null;
  }

  return (
    <g data-testid="breadboard-drc-overlay" pointerEvents="all">
      {drcResult.violations.map((v, idx) => {
        const key = `drc-${v.type}-${v.pixel.x}-${v.pixel.y}-${idx}`;
        return (
          <g
            key={key}
            data-testid={`drc-marker-${v.type}`}
            onMouseEnter={() => handleMouseEnter(v)}
            onMouseLeave={handleMouseLeave}
            cursor="pointer"
          >
            {/* Invisible hit area for hover */}
            <circle
              cx={v.pixel.x}
              cy={v.pixel.y}
              r={MARKER_SIZE + 2}
              fill="transparent"
            />
            {v.severity === 'error'
              ? <ErrorMarker x={v.pixel.x} y={v.pixel.y} size={MARKER_SIZE} />
              : <WarningMarker x={v.pixel.x} y={v.pixel.y} size={MARKER_SIZE} />
            }
          </g>
        );
      })}

      {/* Tooltip */}
      {tooltip && (
        <g pointerEvents="none" data-testid="drc-tooltip">
          <rect
            x={tooltip.x + 8}
            y={tooltip.y - 12}
            width={Math.min(tooltip.message.length * 3.5 + 8, 180)}
            height={16}
            rx={3}
            fill="rgba(0,0,0,0.85)"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={0.5}
          />
          <text
            x={tooltip.x + 12}
            y={tooltip.y}
            fill="#e5e5e5"
            fontSize={5}
            fontFamily="sans-serif"
            data-testid="drc-tooltip-text"
          >
            {tooltip.message.length > 50 ? tooltip.message.slice(0, 50) + '...' : tooltip.message}
          </text>
        </g>
      )}

      {/* Summary badge — top-left of overlay area */}
      <g data-testid="drc-summary-badge" pointerEvents="none">
        <rect
          x={2} y={2}
          width={52} height={14}
          rx={3}
          fill="rgba(0,0,0,0.75)"
          stroke={drcResult.errorCount > 0 ? ERROR_COLOR : WARNING_COLOR}
          strokeWidth={0.5}
        />
        <text x={6} y={11} fill="#e5e5e5" fontSize={5} fontFamily="monospace">
          DRC: {drcResult.errorCount}E {drcResult.warningCount}W
        </text>
      </g>
    </g>
  );
});

export default BreadboardDrcOverlay;
