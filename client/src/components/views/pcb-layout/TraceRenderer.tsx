/**
 * TraceRenderer — Pure SVG rendering for PCB traces (routed wires)
 * and the in-progress trace preview.
 *
 * React.memo wrapped for render performance. No interaction logic.
 */

import { memo } from 'react';
import { TRACE_COLORS, wireOpacity } from './LayerManager';
import type { ActiveLayer } from './LayerManager';
import type { CircuitWireRow } from '@shared/schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TraceLayerProps {
  wires: CircuitWireRow[];
  activeLayer: ActiveLayer;
  fallbackWidth: number;
  onWireClick: (wireId: number, e: React.MouseEvent) => void;
}

interface TraceInProgressProps {
  points: Array<{ x: number; y: number }>;
  activeLayer: ActiveLayer;
  traceWidth: number;
}

// ---------------------------------------------------------------------------
// Single trace path (shared between front/back layer renderers)
// ---------------------------------------------------------------------------

function TracePath({
  wire,
  activeLayer,
  fallbackWidth,
  onWireClick,
}: {
  wire: CircuitWireRow;
  activeLayer: ActiveLayer;
  fallbackWidth: number;
  onWireClick: (wireId: number, e: React.MouseEvent) => void;
}) {
  const pts = (wire.points as Array<{ x: number; y: number }>) ?? [];
  if (pts.length < 2) {
    return null;
  }

  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const isBack = wire.layer === 'back';
  const defaultColor = isBack ? TRACE_COLORS.back : TRACE_COLORS.front;

  return (
    <path
      d={d}
      stroke={wire.color ?? defaultColor}
      strokeWidth={wire.width ?? fallbackWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      opacity={wireOpacity(wire.layer, activeLayer)}
      className="cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        onWireClick(wire.id, e);
      }}
      data-testid={`pcb-trace-${wire.id}`}
    />
  );
}

// ---------------------------------------------------------------------------
// Back copper layer traces (rendered under components)
// ---------------------------------------------------------------------------

const BackLayerTraces = memo(function BackLayerTraces({
  wires,
  activeLayer,
  fallbackWidth,
  onWireClick,
}: TraceLayerProps) {
  const backWires = wires.filter((w: CircuitWireRow) => w.layer === 'back');
  if (backWires.length === 0) {
    return null;
  }

  return (
    <>
      {backWires.map((wire: CircuitWireRow) => (
        <TracePath
          key={wire.id}
          wire={wire}
          activeLayer={activeLayer}
          fallbackWidth={fallbackWidth}
          onWireClick={onWireClick}
        />
      ))}
    </>
  );
});

// ---------------------------------------------------------------------------
// Front copper layer traces (rendered over components)
// ---------------------------------------------------------------------------

const FrontLayerTraces = memo(function FrontLayerTraces({
  wires,
  activeLayer,
  fallbackWidth,
  onWireClick,
}: TraceLayerProps) {
  const frontWires = wires.filter((w: CircuitWireRow) => w.layer !== 'back');
  if (frontWires.length === 0) {
    return null;
  }

  return (
    <>
      {frontWires.map((wire: CircuitWireRow) => (
        <TracePath
          key={wire.id}
          wire={wire}
          activeLayer={activeLayer}
          fallbackWidth={fallbackWidth}
          onWireClick={onWireClick}
        />
      ))}
    </>
  );
});

// ---------------------------------------------------------------------------
// Trace in progress (dashed preview)
// ---------------------------------------------------------------------------

const TraceInProgress = memo(function TraceInProgress({
  points,
  activeLayer,
  traceWidth,
}: TraceInProgressProps) {
  if (points.length < 1) {
    return null;
  }

  return (
    <g data-testid="pcb-trace-in-progress">
      <polyline
        points={points.map((p) => `${p.x},${p.y}`).join(' ')}
        stroke={TRACE_COLORS[activeLayer]}
        strokeWidth={traceWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray="3,1.5"
        opacity={0.7}
      />
    </g>
  );
});

export { BackLayerTraces, FrontLayerTraces, TraceInProgress };
