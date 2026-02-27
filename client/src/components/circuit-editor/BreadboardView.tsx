/**
 * BreadboardView — interactive breadboard editor with component placement,
 * wire drawing, and ratsnest overlay.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { useProjectId } from '@/lib/contexts/project-id-context';
import {
  useCircuitDesigns,
  useCircuitInstances,
  useCircuitNets,
  useCircuitWires,
  useCreateCircuitWire,
  useDeleteCircuitWire,
  useUpdateCircuitInstance,
} from '@/lib/circuit-editor/hooks';
import BreadboardGrid from './BreadboardGrid';
import RatsnestOverlay, { type RatsnestNet, type RatsnestPin } from './RatsnestOverlay';
import ToolButton from './ToolButton';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  Loader2,
  CircuitBoard,
  MousePointer2,
  Pencil,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BB,
  type BreadboardCoord,
  type PixelPos,
  coordKey,
  pixelToCoord,
} from '@/lib/circuit-editor/breadboard-model';
import type { CircuitDesignRow, CircuitWireRow } from '@shared/schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tool = 'select' | 'wire' | 'delete';

interface WireInProgress {
  netId: number;
  points: PixelPos[];
  coordPath: BreadboardCoord[];
  color: string;
}

// ---------------------------------------------------------------------------
// Wire color palette
// ---------------------------------------------------------------------------

const WIRE_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#34495e', '#e91e63', '#00bcd4',
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BreadboardView() {
  const projectId = useProjectId();
  const { data: circuits, isLoading: loadingCircuits } = useCircuitDesigns(projectId);
  const [activeCircuitId, setActiveCircuitId] = useState<number | null>(null);

  const activeCircuit = circuits?.find(c => c.id === activeCircuitId) ?? circuits?.[0] ?? null;
  const circuitId = activeCircuit?.id ?? 0;

  if (loadingCircuits) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="breadboard-loading">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!circuits || circuits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center" data-testid="breadboard-empty">
        <CircuitBoard className="w-16 h-16 text-muted-foreground/30" />
        <div>
          <h3 className="text-lg font-medium text-foreground">No Circuit Designs</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Create a circuit in the Schematic view first, then switch to Breadboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="breadboard-view">
      {/* Toolbar */}
      <BreadboardToolbar
        circuits={circuits}
        activeCircuit={activeCircuit}
        onSelectCircuit={setActiveCircuitId}
      />
      {/* Canvas */}
      {activeCircuit && (
        <BreadboardCanvas circuitId={circuitId} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

function BreadboardToolbar({
  circuits,
  activeCircuit,
  onSelectCircuit,
}: {
  circuits: CircuitDesignRow[];
  activeCircuit: CircuitDesignRow | null;
  onSelectCircuit: (id: number) => void;
}) {
  return (
    <div className="h-10 border-b border-border bg-card/60 backdrop-blur-xl flex items-center px-3 gap-2 shrink-0" data-testid="breadboard-toolbar">
      <Select
        value={String(activeCircuit?.id ?? '')}
        onValueChange={v => onSelectCircuit(Number(v))}
      >
        <SelectTrigger className="h-7 w-48 text-xs" data-testid="select-breadboard-circuit">
          <SelectValue placeholder="Select circuit" />
        </SelectTrigger>
        <SelectContent>
          {circuits.map((c: CircuitDesignRow) => (
            <SelectItem key={c.id} value={String(c.id)}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex-1" />
      <span className="text-xs text-muted-foreground">
        {activeCircuit ? activeCircuit.name : 'No circuit selected'} — Breadboard
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Canvas (main interactive area)
// ---------------------------------------------------------------------------

function BreadboardCanvas({ circuitId }: { circuitId: number }) {
  const { data: instances } = useCircuitInstances(circuitId);
  const { data: nets } = useCircuitNets(circuitId);
  const { data: wires } = useCircuitWires(circuitId);
  const createWireMutation = useCreateCircuitWire();
  const deleteWireMutation = useDeleteCircuitWire();
  const updateInstanceMutation = useUpdateCircuitInstance();

  const [tool, setTool] = useState<Tool>('select');
  const [zoom, setZoom] = useState(3);
  const [panOffset, setPanOffset] = useState<PixelPos>({ x: 20, y: 20 });
  const [hoveredCoord, setHoveredCoord] = useState<BreadboardCoord | null>(null);
  const [highlightedPoints, setHighlightedPoints] = useState<Set<string>>(new Set());
  const [wireInProgress, setWireInProgress] = useState<WireInProgress | null>(null);
  const [selectedWireId, setSelectedWireId] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const isPanning = useRef(false);
  const lastMouse = useRef<PixelPos>({ x: 0, y: 0 });

  // Filter wires to breadboard view only
  const breadboardWires = useMemo(
    () => (wires ?? []).filter((w: CircuitWireRow) => w.view === 'breadboard'),
    [wires],
  );

  // Occupied points from placed instances — maps instance breadboard
  // positions to the nearest tie-points they cover.
  const occupiedPoints = useMemo(() => {
    const set = new Set<string>();
    if (!instances) return set;
    for (const inst of instances) {
      if (inst.breadboardX == null || inst.breadboardY == null) continue;
      // Snap the instance origin to a tie-point and mark it + surrounding
      // rows based on a default 4-row span (DIP-8). A more accurate
      // implementation would read the part's pin count from component_parts.
      const snapped = pixelToCoord({ x: inst.breadboardX, y: inst.breadboardY });
      if (snapped && snapped.type === 'terminal') {
        const rowSpan = 4;
        for (let r = snapped.row; r < snapped.row + rowSpan && r <= BB.ROWS; r++) {
          set.add(coordKey({ type: 'terminal', col: snapped.col, row: r }));
        }
      }
    }
    return set;
  }, [instances]);

  // Build ratsnest nets
  const ratsnestNets = useMemo((): RatsnestNet[] => {
    if (!nets || !instances) return [];
    const routedNetIds = new Set<number>();
    for (const w of breadboardWires) {
      routedNetIds.add(w.netId);
    }

    return nets.map((net, idx) => {
      const pins: RatsnestPin[] = [];
      const segments = (net.segments ?? []) as Array<{
        fromInstanceId: number;
        fromPin: string;
        toInstanceId: number;
        toPin: string;
      }>;

      for (const seg of segments) {
        const fromInst = instances.find(i => i.id === seg.fromInstanceId);
        const toInst = instances.find(i => i.id === seg.toInstanceId);

        if (fromInst?.breadboardX != null && fromInst?.breadboardY != null) {
          pins.push({
            instanceId: fromInst.id,
            pinId: seg.fromPin,
            x: fromInst.breadboardX,
            y: fromInst.breadboardY,
          });
        }
        if (toInst?.breadboardX != null && toInst?.breadboardY != null) {
          pins.push({
            instanceId: toInst.id,
            pinId: seg.toPin,
            x: toInst.breadboardX,
            y: toInst.breadboardY,
          });
        }
      }

      return {
        netId: net.id,
        name: net.name,
        color: WIRE_COLORS[idx % WIRE_COLORS.length],
        pins,
        routedPairs: new Set<string>(),
      };
    });
  }, [nets, instances, breadboardWires]);

  // --- Event handlers ---

  const handleTiePointClick = useCallback((coord: BreadboardCoord, pixel: PixelPos) => {
    if (tool === 'wire') {
      if (!wireInProgress) {
        // Start a new wire — user needs to pick a net first, default to first net
        const firstNet = nets?.[0];
        if (!firstNet) return;
        setWireInProgress({
          netId: firstNet.id,
          points: [pixel],
          coordPath: [coord],
          color: WIRE_COLORS[0],
        });
      } else {
        // Add waypoint or complete wire
        const updated: WireInProgress = {
          ...wireInProgress,
          points: [...wireInProgress.points, pixel],
          coordPath: [...wireInProgress.coordPath, coord],
        };
        setWireInProgress(updated);
      }
    }
  }, [tool, wireInProgress, nets]);

  const handleTiePointHover = useCallback((coord: BreadboardCoord | null) => {
    setHoveredCoord(coord);
    if (coord) {
      // Highlight connected points
      const key = coordKey(coord);
      setHighlightedPoints(new Set([key]));
    } else {
      setHighlightedPoints(new Set());
    }
  }, []);

  const handleDoubleClick = useCallback(() => {
    // Complete wire on double-click
    if (wireInProgress && wireInProgress.points.length >= 2) {
      createWireMutation.mutate({
        circuitId,
        netId: wireInProgress.netId,
        view: 'breadboard',
        points: wireInProgress.points,
        color: wireInProgress.color,
        wireType: 'wire',
      });
      setWireInProgress(null);
    }
  }, [wireInProgress, createWireMutation, circuitId]);

  const handleEscape = useCallback(() => {
    setWireInProgress(null);
    setSelectedWireId(null);
  }, []);

  const handleDeleteWire = useCallback(() => {
    if (selectedWireId != null) {
      deleteWireMutation.mutate({ circuitId, id: selectedWireId });
      setSelectedWireId(null);
    }
  }, [selectedWireId, deleteWireMutation, circuitId]);

  // Pan handling
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && tool === 'select' && !hoveredCoord)) {
      isPanning.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
    }
  }, [tool, hoveredCoord]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning.current) {
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(prev => Math.max(1, Math.min(8, prev + (e.deltaY > 0 ? -0.3 : 0.3))));
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') handleEscape();
    if (e.key === 'Delete' || e.key === 'Backspace') handleDeleteWire();
    if (e.key === '1') setTool('select');
    if (e.key === '2') setTool('wire');
    if (e.key === '3') setTool('delete');
  }, [handleEscape, handleDeleteWire]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden" data-testid="breadboard-canvas-container">
      {/* Tool bar */}
      <div className="h-8 border-b border-border bg-card/40 flex items-center px-2 gap-1 shrink-0">
        <ToolButton icon={MousePointer2} label="Select (1)" active={tool === 'select'} onClick={() => setTool('select')} testId="tool-select" />
        <ToolButton icon={Pencil} label="Wire (2)" active={tool === 'wire'} onClick={() => setTool('wire')} testId="tool-wire" />
        <ToolButton icon={Trash2} label="Delete (3)" active={tool === 'delete'} onClick={() => setTool('delete')} testId="tool-delete" />
        <div className="w-px h-4 bg-border mx-1" />
        <ToolButton icon={ZoomIn} label="Zoom in" onClick={() => setZoom(z => Math.min(8, z + 0.5))} testId="tool-zoom-in" />
        <ToolButton icon={ZoomOut} label="Zoom out" onClick={() => setZoom(z => Math.max(1, z - 0.5))} testId="tool-zoom-out" />
        <ToolButton icon={RotateCcw} label="Reset view" onClick={() => { setZoom(3); setPanOffset({ x: 20, y: 20 }); }} testId="tool-reset-view" />
        <div className="flex-1" />
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {zoom.toFixed(1)}x
          {hoveredCoord && (
            <> | {hoveredCoord.type === 'terminal'
              ? `${hoveredCoord.col}${hoveredCoord.row}`
              : `${hoveredCoord.rail}[${hoveredCoord.index}]`
            }</>
          )}
        </span>
        {wireInProgress && (
          <span className="text-[10px] text-primary ml-2">
            Drawing wire ({wireInProgress.points.length} pts) — dbl-click to finish, Esc to cancel
          </span>
        )}
      </div>

      {/* SVG canvas */}
      <div
        className="flex-1 overflow-hidden bg-background cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        data-testid="breadboard-canvas"
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          data-testid="breadboard-svg"
        >
          <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoom})`}>
            {/* Breadboard grid */}
            <BreadboardGrid
              onTiePointClick={handleTiePointClick}
              onTiePointHover={handleTiePointHover}
              highlightedPoints={highlightedPoints}
              occupiedPoints={occupiedPoints}
              hoveredCoord={hoveredCoord}
            />

            {/* Existing wires */}
            {breadboardWires.map((wire: CircuitWireRow) => {
              const pts = (wire.points as Array<{ x: number; y: number }>) ?? [];
              if (pts.length < 2) return null;
              const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
              return (
                <path
                  key={wire.id}
                  d={pathD}
                  stroke={wire.color ?? '#3498db'}
                  strokeWidth={wire.width ?? 1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  className={cn(
                    'transition-opacity cursor-pointer',
                    selectedWireId === wire.id ? 'opacity-100' : 'opacity-80 hover:opacity-100',
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedWireId(wire.id);
                  }}
                  data-testid={`wire-${wire.id}`}
                />
              );
            })}

            {/* Wire selection highlight */}
            {selectedWireId != null && (() => {
              const wire = breadboardWires.find(w => w.id === selectedWireId);
              if (!wire) return null;
              const pts = (wire.points as Array<{ x: number; y: number }>) ?? [];
              if (pts.length < 2) return null;
              const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
              return (
                <path
                  d={pathD}
                  stroke="#facc15"
                  strokeWidth={(wire.width ?? 1.5) + 1}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  opacity={0.5}
                  pointerEvents="none"
                />
              );
            })()}

            {/* Wire in progress */}
            {wireInProgress && wireInProgress.points.length >= 1 && (
              <g data-testid="wire-in-progress">
                <polyline
                  points={wireInProgress.points.map(p => `${p.x},${p.y}`).join(' ')}
                  stroke={wireInProgress.color}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  strokeDasharray="2,1"
                  opacity={0.8}
                />
                {wireInProgress.points.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={1.5}
                    fill={wireInProgress.color}
                    opacity={0.6}
                  />
                ))}
              </g>
            )}

            {/* Ratsnest overlay */}
            <RatsnestOverlay
              nets={ratsnestNets}
              opacity={0.5}
              showLabels
            />
          </g>
        </svg>
      </div>
    </div>
  );
}

// ToolButton imported from ./ToolButton
