/**
 * PCBBoardRenderer — Pure SVG rendering for the PCB board:
 * grid pattern, board outline, component footprints, and static overlays
 * (layer legend, coordinate readout, empty-state guidance).
 *
 * React.memo wrapped for render performance. No interaction logic.
 */

import { memo } from 'react';
import { CircuitBoard } from 'lucide-react';
import { GRID_STEP } from './PCBCoordinateSystem';
import { footprintFill, footprintStroke, footprintStrokeWidth } from './ComponentPlacer';
import { PadRenderer } from './PadRenderer';
import { FootprintLibrary } from '@/lib/pcb/footprint-library';
import type { CircuitInstanceRow } from '@shared/schema';
import type { ActiveLayer } from './LayerManager';

// ---------------------------------------------------------------------------
// Board grid + outline
// ---------------------------------------------------------------------------

interface BoardGridProps {
  boardWidth: number;
  boardHeight: number;
}

const BoardGrid = memo(function BoardGrid({ boardWidth, boardHeight }: BoardGridProps) {
  return (
    <>
      <defs>
        <pattern id="pcb-grid" width={GRID_STEP} height={GRID_STEP} patternUnits="userSpaceOnUse">
          <circle cx={GRID_STEP / 2} cy={GRID_STEP / 2} r={0.3} fill="#333" />
        </pattern>
      </defs>
      <rect
        x={0}
        y={0}
        width={boardWidth}
        height={boardHeight}
        fill="url(#pcb-grid)"
        data-testid="pcb-grid-bg"
      />
      <rect
        x={0}
        y={0}
        width={boardWidth}
        height={boardHeight}
        fill="none"
        stroke="#facc15"
        strokeWidth={0.8}
        strokeDasharray="4,2"
        data-testid="board-outline"
      />
    </>
  );
});

// ---------------------------------------------------------------------------
// Component footprints
// ---------------------------------------------------------------------------

interface FootprintsProps {
  instances: CircuitInstanceRow[];
  selectedInstanceId: number | null;
  activeLayer: ActiveLayer;
  onInstanceClick: (instanceId: number, e: React.MouseEvent) => void;
}

/**
 * Resolve the package type from an instance's properties JSONB.
 * Falls back to guessing from the reference designator prefix.
 */
function resolvePackageType(inst: CircuitInstanceRow): string | null {
  const props = (inst.properties ?? {}) as Record<string, unknown>;
  const explicit = props.packageType as string | undefined;
  if (explicit && FootprintLibrary.getFootprint(explicit)) {
    return explicit;
  }
  return null;
}

const ComponentFootprints = memo(function ComponentFootprints({
  instances,
  selectedInstanceId,
  activeLayer,
  onInstanceClick,
}: FootprintsProps) {
  return (
    <>
      {instances.map((inst: CircuitInstanceRow) => {
        if (inst.pcbX == null || inst.pcbY == null) {
          return null;
        }

        const isSelected = selectedInstanceId === inst.id;
        const rotation = inst.pcbRotation ?? 0;
        const packageType = resolvePackageType(inst);
        const footprint = packageType ? FootprintLibrary.getFootprint(packageType) : null;

        return (
          <g
            key={inst.id}
            transform={`translate(${inst.pcbX}, ${inst.pcbY})`}
            className="cursor-move"
            onClick={(e) => {
              e.stopPropagation();
              onInstanceClick(inst.id, e);
            }}
            data-testid={`pcb-instance-${inst.id}`}
          >
            {footprint ? (
              <>
                {/* Real footprint pads */}
                {footprint.pads.map((pad) => (
                  <PadRenderer
                    key={pad.number}
                    pad={pad}
                    componentX={0}
                    componentY={0}
                    rotation={rotation}
                    scale={1}
                    selected={isSelected}
                    activeLayer={activeLayer}
                  />
                ))}
                {/* Silkscreen outline */}
                {footprint.silkscreen.map((silk, i) => {
                  if (silk.type === 'rect') {
                    const p = silk.params;
                    return (
                      <rect
                        key={`silk-${i}`}
                        x={Number(p.x)}
                        y={Number(p.y)}
                        width={Number(p.width)}
                        height={Number(p.height)}
                        fill="none"
                        stroke="#f5f5dc80"
                        strokeWidth={silk.lineWidth}
                        transform={rotation ? `rotate(${rotation})` : undefined}
                      />
                    );
                  }
                  if (silk.type === 'line') {
                    return (
                      <line
                        key={`silk-${i}`}
                        x1={Number(silk.params.x1)}
                        y1={Number(silk.params.y1)}
                        x2={Number(silk.params.x2)}
                        y2={Number(silk.params.y2)}
                        stroke="#f5f5dc80"
                        strokeWidth={silk.lineWidth}
                        transform={rotation ? `rotate(${rotation})` : undefined}
                      />
                    );
                  }
                  if (silk.type === 'circle') {
                    return (
                      <circle
                        key={`silk-${i}`}
                        cx={Number(silk.params.cx)}
                        cy={Number(silk.params.cy)}
                        r={Number(silk.params.radius)}
                        fill="none"
                        stroke="#f5f5dc80"
                        strokeWidth={silk.lineWidth}
                        transform={rotation ? `rotate(${rotation})` : undefined}
                      />
                    );
                  }
                  return null;
                })}
                {/* Reference designator */}
                <text
                  x={0}
                  y={footprint.boundingBox.y + footprint.boundingBox.height + 2}
                  fontSize={2}
                  fill="#aaa"
                  textAnchor="middle"
                  dominantBaseline="hanging"
                  pointerEvents="none"
                  transform={rotation ? `rotate(${rotation})` : undefined}
                >
                  {inst.referenceDesignator}
                </text>
              </>
            ) : (
              <>
                {/* Fallback: simplified footprint placeholder — 8x12 rect */}
                <rect
                  x={-4}
                  y={-6}
                  width={8}
                  height={12}
                  fill={footprintFill(inst.pcbSide)}
                  stroke={footprintStroke(inst.pcbSide, isSelected)}
                  strokeWidth={footprintStrokeWidth(isSelected)}
                  rx={0.5}
                  transform={rotation ? `rotate(${rotation})` : undefined}
                />
                <text
                  x={0}
                  y={1}
                  fontSize={3}
                  fill="#aaa"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  pointerEvents="none"
                >
                  {inst.referenceDesignator}
                </text>
              </>
            )}
          </g>
        );
      })}
    </>
  );
});

// ---------------------------------------------------------------------------
// Layer legend overlay
// ---------------------------------------------------------------------------

interface LayerLegendProps {
  boardWidth: number;
  boardHeight: number;
}

const LayerLegend = memo(function LayerLegend({ boardWidth, boardHeight }: LayerLegendProps) {
  return (
    <div
      className="absolute bottom-3 left-3 z-10 bg-card/80 backdrop-blur-xl border border-border p-2 shadow-lg"
      data-testid="pcb-layer-legend"
    >
      <p className="text-[9px] font-medium text-muted-foreground mb-1">Layers</p>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-red-400 inline-block" />
          <span className="text-[9px] text-muted-foreground">F.Cu (Front Copper)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-blue-400 inline-block" />
          <span className="text-[9px] text-muted-foreground">B.Cu (Back Copper)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-yellow-400 inline-block border-dashed" />
          <span className="text-[9px] text-muted-foreground">Board Outline</span>
        </div>
      </div>
      <p className="text-[8px] text-muted-foreground/60 mt-1">
        {boardWidth / 10} x {boardHeight / 10} mm
      </p>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Coordinate readout overlay
// ---------------------------------------------------------------------------

interface CoordinateReadoutProps {
  mouseBoardPos: { x: number; y: number } | null;
}

const CoordinateReadout = memo(function CoordinateReadout({ mouseBoardPos }: CoordinateReadoutProps) {
  if (!mouseBoardPos) {
    return null;
  }

  return (
    <div
      className="absolute bottom-3 right-3 z-10 bg-card/70 backdrop-blur-sm border border-border px-2 py-1 pointer-events-none select-none"
      data-testid="coordinate-readout"
    >
      <span className="text-[11px] font-mono tabular-nums text-[var(--color-editor-accent)]">
        X: {mouseBoardPos.x} &nbsp; Y: {mouseBoardPos.y}
      </span>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Empty state guidance overlay
// ---------------------------------------------------------------------------

interface EmptyGuidanceProps {
  hasPlacedComponents: boolean;
}

const EmptyGuidance = memo(function EmptyGuidance({ hasPlacedComponents }: EmptyGuidanceProps) {
  if (hasPlacedComponents) {
    return null;
  }

  return (
    <div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 bg-card/80 backdrop-blur-xl border border-border px-6 py-4 shadow-lg max-w-xs text-center pointer-events-none"
      data-testid="pcb-empty-guidance"
    >
      <CircuitBoard className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
      <h3 className="text-sm font-medium text-foreground mb-1">Empty PCB Board</h3>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Component footprints will appear here once placed in the <strong>Schematic</strong> view. Use
        the <strong>Trace tool (2)</strong> to route copper connections, and press <strong>F</strong>{' '}
        to toggle layers.
      </p>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Selection marquee rectangle overlay (rendered inside SVG board group)
// ---------------------------------------------------------------------------

interface SelectionMarqueeProps {
  rect: { x: number; y: number; width: number; height: number } | null;
}

const SelectionMarquee = memo(function SelectionMarquee({ rect }: SelectionMarqueeProps) {
  if (!rect || rect.width === 0 || rect.height === 0) {
    return null;
  }

  return (
    <rect
      x={rect.x}
      y={rect.y}
      width={rect.width}
      height={rect.height}
      fill="rgba(0, 240, 255, 0.08)"
      stroke="#00F0FF"
      strokeWidth={0.5}
      strokeDasharray="3,2"
      pointerEvents="none"
      data-testid="pcb-selection-rect"
    />
  );
});

export { BoardGrid, ComponentFootprints, LayerLegend, CoordinateReadout, EmptyGuidance, SelectionMarquee };
export { DrcConstraintOverlay } from './DrcConstraintOverlay';
export type { DrcConstraintOverlayProps, ClearanceRule } from './DrcConstraintOverlay';
export { DrcConstraintToggle } from './DrcConstraintToggle';
