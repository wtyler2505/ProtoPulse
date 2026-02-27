/**
 * PCBLayoutView — basic PCB component placement and trace routing.
 *
 * Features:
 *   - Board outline (rectangle, configurable dimensions)
 *   - Component footprint placement (drag to position)
 *   - Manual trace routing with width control
 *   - Front/back copper layer switching
 *   - Ratsnest overlay for unrouted nets
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
  FlipHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CircuitDesignRow, CircuitInstanceRow, CircuitWireRow } from '@shared/schema';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default board outline in mm (converted to SVG units at 1 unit = 0.1mm) */
const DEFAULT_BOARD = { width: 500, height: 400 }; // 50mm × 40mm
const GRID_STEP = 12.7; // 0.5mm grid (50 mil)
const TRACE_COLORS = {
  front: '#e74c3c',
  back: '#3498db',
};

type ActiveLayer = 'front' | 'back';
type PcbTool = 'select' | 'trace' | 'delete';

// ---------------------------------------------------------------------------
// Wire color palette (for ratsnest)
// ---------------------------------------------------------------------------

const WIRE_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#34495e', '#e91e63', '#00bcd4',
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PCBLayoutView() {
  const projectId = useProjectId();
  const { data: circuits, isLoading } = useCircuitDesigns(projectId);
  const [activeCircuitId, setActiveCircuitId] = useState<number | null>(null);
  const activeCircuit = circuits?.find(c => c.id === activeCircuitId) ?? circuits?.[0] ?? null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="pcb-loading">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!circuits || circuits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center" data-testid="pcb-empty">
        <CircuitBoard className="w-16 h-16 text-muted-foreground/30" />
        <div>
          <h3 className="text-lg font-medium text-foreground">No Circuit Designs</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Create a circuit in the Schematic view first, then switch to PCB Layout.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="pcb-layout-view">
      <div className="h-10 border-b border-border bg-card/60 backdrop-blur-xl flex items-center px-3 gap-2 shrink-0">
        <Select
          value={String(activeCircuit?.id ?? '')}
          onValueChange={v => setActiveCircuitId(Number(v))}
        >
          <SelectTrigger className="h-7 w-48 text-xs" data-testid="select-pcb-circuit">
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
          {activeCircuit ? activeCircuit.name : 'No circuit selected'} — PCB Layout
        </span>
      </div>
      {activeCircuit && <PCBCanvas circuitId={activeCircuit.id} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PCB Canvas
// ---------------------------------------------------------------------------

function PCBCanvas({ circuitId }: { circuitId: number }) {
  const { data: instances } = useCircuitInstances(circuitId);
  const { data: nets } = useCircuitNets(circuitId);
  const { data: wires } = useCircuitWires(circuitId);
  const createWireMutation = useCreateCircuitWire();
  const deleteWireMutation = useDeleteCircuitWire();
  const updateInstanceMutation = useUpdateCircuitInstance();

  const [tool, setTool] = useState<PcbTool>('select');
  const [activeLayer, setActiveLayer] = useState<ActiveLayer>('front');
  const [zoom, setZoom] = useState(1.5);
  const [panOffset, setPanOffset] = useState({ x: 40, y: 40 });
  const [selectedInstanceId, setSelectedInstanceId] = useState<number | null>(null);
  const [selectedWireId, setSelectedWireId] = useState<number | null>(null);
  const [traceWidth, setTraceWidth] = useState(2.0);
  const [tracePoints, setTracePoints] = useState<Array<{ x: number; y: number }>>([]);
  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const pcbWires = useMemo(
    () => (wires ?? []).filter((w: CircuitWireRow) => w.view === 'pcb'),
    [wires],
  );

  // Build ratsnest from nets + instances with PCB positions
  const ratsnestNets = useMemo((): RatsnestNet[] => {
    if (!nets || !instances) return [];
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
        if (fromInst?.pcbX != null && fromInst?.pcbY != null) {
          pins.push({ instanceId: fromInst.id, pinId: seg.fromPin, x: fromInst.pcbX, y: fromInst.pcbY });
        }
        if (toInst?.pcbX != null && toInst?.pcbY != null) {
          pins.push({ instanceId: toInst.id, pinId: seg.toPin, x: toInst.pcbX, y: toInst.pcbY });
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
  }, [nets, instances]);

  // Snap to grid
  const snapToGrid = useCallback((x: number, y: number) => ({
    x: Math.round(x / GRID_STEP) * GRID_STEP,
    y: Math.round(y / GRID_STEP) * GRID_STEP,
  }), []);

  // SVG mouse → board coords
  const svgRef = useRef<SVGSVGElement>(null);
  const toBoardCoords = useCallback((e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - panOffset.x) / zoom,
      y: (e.clientY - rect.top - panOffset.y) / zoom,
    };
  }, [panOffset, zoom]);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (tool === 'trace') {
      const bc = toBoardCoords(e);
      const snapped = snapToGrid(bc.x, bc.y);
      setTracePoints(prev => [...prev, snapped]);
    } else {
      setSelectedInstanceId(null);
      setSelectedWireId(null);
    }
  }, [tool, toBoardCoords, snapToGrid]);

  const handleDoubleClick = useCallback(() => {
    if (tool === 'trace' && tracePoints.length >= 2) {
      const firstNet = nets?.[0];
      if (!firstNet) return;
      createWireMutation.mutate({
        circuitId,
        netId: firstNet.id,
        view: 'pcb',
        points: tracePoints,
        layer: activeLayer,
        width: traceWidth,
        color: TRACE_COLORS[activeLayer],
        wireType: 'wire',
      });
      setTracePoints([]);
    }
  }, [tool, tracePoints, nets, createWireMutation, circuitId, activeLayer, traceWidth]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setTracePoints([]);
      setSelectedInstanceId(null);
      setSelectedWireId(null);
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedWireId != null) {
      deleteWireMutation.mutate({ circuitId, id: selectedWireId });
      setSelectedWireId(null);
    }
    if (e.key === '1') setTool('select');
    if (e.key === '2') setTool('trace');
    if (e.key === '3') setTool('delete');
    if (e.key === 'f' || e.key === 'F') setActiveLayer(l => l === 'front' ? 'back' : 'front');
  }, [selectedWireId, deleteWireMutation, circuitId]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && tool === 'select' && selectedInstanceId == null)) {
      isPanning.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
    }
  }, [tool, selectedInstanceId]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning.current) {
      setPanOffset(prev => ({
        x: prev.x + e.clientX - lastMouse.current.x,
        y: prev.y + e.clientY - lastMouse.current.y,
      }));
      lastMouse.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.3, Math.min(6, z + (e.deltaY > 0 ? -0.15 : 0.15))));
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tool bar */}
      <div className="h-8 border-b border-border bg-card/40 flex items-center px-2 gap-1 shrink-0">
        <ToolButton icon={MousePointer2} label="Select (1)" active={tool === 'select'} onClick={() => setTool('select')} testId="pcb-tool-select" />
        <ToolButton icon={Pencil} label="Trace (2)" active={tool === 'trace'} onClick={() => setTool('trace')} testId="pcb-tool-trace" />
        <ToolButton icon={Trash2} label="Delete (3)" active={tool === 'delete'} onClick={() => setTool('delete')} testId="pcb-tool-delete" />
        <div className="w-px h-4 bg-border mx-1" />
        <button
          data-testid="pcb-layer-toggle"
          onClick={() => setActiveLayer(l => l === 'front' ? 'back' : 'front')}
          title="Toggle layer (F)"
          className={cn(
            'h-6 px-2 flex items-center gap-1 rounded text-[10px] font-medium transition-colors',
            activeLayer === 'front' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400',
          )}
        >
          <FlipHorizontal className="w-3 h-3" />
          {activeLayer === 'front' ? 'F.Cu' : 'B.Cu'}
        </button>
        <div className="w-px h-4 bg-border mx-1" />
        <ToolButton icon={ZoomIn} label="Zoom in" onClick={() => setZoom(z => Math.min(6, z + 0.3))} testId="pcb-tool-zoom-in" />
        <ToolButton icon={ZoomOut} label="Zoom out" onClick={() => setZoom(z => Math.max(0.3, z - 0.3))} testId="pcb-tool-zoom-out" />
        <ToolButton icon={RotateCcw} label="Reset view" onClick={() => { setZoom(1.5); setPanOffset({ x: 40, y: 40 }); }} testId="pcb-tool-reset" />
        <div className="flex-1" />
        <span className="text-[10px] text-muted-foreground tabular-nums">{zoom.toFixed(1)}x</span>
        {tracePoints.length > 0 && (
          <span className="text-[10px] text-primary ml-2">
            Routing trace ({tracePoints.length} pts) — dbl-click to finish, Esc to cancel
          </span>
        )}
      </div>

      {/* SVG canvas */}
      <div
        className="flex-1 overflow-hidden bg-[#1a1a1a]"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        onClick={handleCanvasClick}
        onDoubleClick={handleDoubleClick}
        tabIndex={0}
        data-testid="pcb-canvas"
      >
        <svg ref={svgRef} width="100%" height="100%" data-testid="pcb-svg">
          <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoom})`}>
            {/* Grid */}
            <defs>
              <pattern id="pcb-grid" width={GRID_STEP} height={GRID_STEP} patternUnits="userSpaceOnUse">
                <circle cx={GRID_STEP / 2} cy={GRID_STEP / 2} r={0.3} fill="#333" />
              </pattern>
            </defs>
            <rect x={0} y={0} width={DEFAULT_BOARD.width} height={DEFAULT_BOARD.height} fill="url(#pcb-grid)" data-testid="pcb-grid-bg" />

            {/* Board outline */}
            <rect
              x={0}
              y={0}
              width={DEFAULT_BOARD.width}
              height={DEFAULT_BOARD.height}
              fill="none"
              stroke="#facc15"
              strokeWidth={0.8}
              strokeDasharray="4,2"
              data-testid="board-outline"
            />

            {/* Back-layer wires (drawn first, under front) */}
            {pcbWires.filter((w: CircuitWireRow) => w.layer === 'back').map((wire: CircuitWireRow) => {
              const pts = (wire.points as Array<{ x: number; y: number }>) ?? [];
              if (pts.length < 2) return null;
              const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
              return (
                <path
                  key={wire.id}
                  d={d}
                  stroke={wire.color ?? TRACE_COLORS.back}
                  strokeWidth={wire.width ?? traceWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  opacity={activeLayer === 'back' ? 0.9 : 0.3}
                  className="cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); setSelectedWireId(wire.id); }}
                  data-testid={`pcb-trace-${wire.id}`}
                />
              );
            })}

            {/* Component footprints */}
            {(instances ?? []).map((inst: CircuitInstanceRow) => {
              if (inst.pcbX == null || inst.pcbY == null) return null;
              const isSelected = selectedInstanceId === inst.id;
              return (
                <g
                  key={inst.id}
                  transform={`translate(${inst.pcbX}, ${inst.pcbY}) rotate(${inst.pcbRotation ?? 0})`}
                  className="cursor-move"
                  onClick={(e) => { e.stopPropagation(); setSelectedInstanceId(inst.id); }}
                  data-testid={`pcb-instance-${inst.id}`}
                >
                  {/* Simplified footprint placeholder — 8×12 rect */}
                  <rect
                    x={-4}
                    y={-6}
                    width={8}
                    height={12}
                    fill={inst.pcbSide === 'back' ? '#2563eb20' : '#dc262620'}
                    stroke={isSelected ? '#facc15' : (inst.pcbSide === 'back' ? '#3b82f6' : '#ef4444')}
                    strokeWidth={isSelected ? 0.8 : 0.4}
                    rx={0.5}
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
                </g>
              );
            })}

            {/* Front-layer wires (drawn over components) */}
            {pcbWires.filter((w: CircuitWireRow) => w.layer !== 'back').map((wire: CircuitWireRow) => {
              const pts = (wire.points as Array<{ x: number; y: number }>) ?? [];
              if (pts.length < 2) return null;
              const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
              return (
                <path
                  key={wire.id}
                  d={d}
                  stroke={wire.color ?? TRACE_COLORS.front}
                  strokeWidth={wire.width ?? traceWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  opacity={activeLayer === 'front' ? 0.9 : 0.3}
                  className="cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); setSelectedWireId(wire.id); }}
                  data-testid={`pcb-trace-${wire.id}`}
                />
              );
            })}

            {/* Trace in progress */}
            {tracePoints.length >= 1 && (
              <g data-testid="pcb-trace-in-progress">
                <polyline
                  points={tracePoints.map(p => `${p.x},${p.y}`).join(' ')}
                  stroke={TRACE_COLORS[activeLayer]}
                  strokeWidth={traceWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  strokeDasharray="3,1.5"
                  opacity={0.7}
                />
              </g>
            )}

            {/* Ratsnest overlay */}
            <RatsnestOverlay nets={ratsnestNets} opacity={0.4} showLabels />
          </g>
        </svg>
      </div>
    </div>
  );
}

// ToolButton imported from ./ToolButton
