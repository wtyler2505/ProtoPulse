/**
 * PCBLayoutView — Orchestrator for the PCB layout canvas.
 *
 * Thin wrapper that manages top-level state and wires together
 * extracted modules from `views/pcb-layout/`:
 *   - PCBCoordinateSystem  (transforms, snapping, zoom math)
 *   - LayerManager         (layer types, colors, visibility)
 *   - ComponentPlacer      (ratsnest construction, placement validation)
 *   - PCBInteractionManager (mouse/keyboard event handlers)
 *   - PCBBoardRenderer     (grid, footprints, overlays)
 *   - TraceRenderer        (trace SVG rendering)
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
import RatsnestOverlay from './RatsnestOverlay';
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
import {
  DEFAULT_BOARD,
  DEFAULT_ZOOM,
  DEFAULT_PAN,
  clampZoom,
  ZOOM_BUTTON_STEP,
  TRACE_WIDTH_PRESETS,
  DEFAULT_TRACE_WIDTH,
  layerLabel,
  toggleLayer,
  layerToggleClasses,
  buildRatsnestNets,
  countPlacedInstances,
  handleCanvasClick as onCanvasClick,
  handleDoubleClick as onDoubleClick,
  handleKeyDown as onKeyDown,
  handleMouseDown as onMouseDown,
  handleMouseMove as onMouseMove,
  handleMouseUp as onMouseUp,
  handleWheel as onWheel,
  BoardGrid,
  ComponentFootprints,
  LayerLegend,
  CoordinateReadout,
  EmptyGuidance,
  BackLayerTraces,
  FrontLayerTraces,
  TraceInProgress,
} from '@/components/views/pcb-layout';
import type { ActiveLayer, PcbTool, PanState } from '@/components/views/pcb-layout';
import type { CircuitDesignRow, CircuitWireRow } from '@shared/schema';

// ---------------------------------------------------------------------------
// Top-level view (circuit selector + canvas)
// ---------------------------------------------------------------------------

export default function PCBLayoutView() {
  const projectId = useProjectId();
  const { data: circuits, isLoading } = useCircuitDesigns(projectId);
  const [activeCircuitId, setActiveCircuitId] = useState<number | null>(null);
  const activeCircuit = circuits?.find((c) => c.id === activeCircuitId) ?? circuits?.[0] ?? null;

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
        <Select value={String(activeCircuit?.id ?? '')} onValueChange={(v) => setActiveCircuitId(Number(v))}>
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
// PCB Canvas — wires together all extracted modules
// ---------------------------------------------------------------------------

function PCBCanvas({ circuitId }: { circuitId: number }) {
  // --- Data hooks ---
  const { data: instances } = useCircuitInstances(circuitId);
  const { data: nets } = useCircuitNets(circuitId);
  const { data: wires } = useCircuitWires(circuitId);
  const createWireMutation = useCreateCircuitWire();
  const deleteWireMutation = useDeleteCircuitWire();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _updateInstanceMutation = useUpdateCircuitInstance();

  // --- State ---
  const [tool, setTool] = useState<PcbTool>('select');
  const [activeLayer, setActiveLayer] = useState<ActiveLayer>('front');
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [panOffset, setPanOffset] = useState(DEFAULT_PAN);
  const [selectedInstanceId, setSelectedInstanceId] = useState<number | null>(null);
  const [selectedWireId, setSelectedWireId] = useState<number | null>(null);
  const [traceWidth, setTraceWidth] = useState(DEFAULT_TRACE_WIDTH);
  const [tracePoints, setTracePoints] = useState<Array<{ x: number; y: number }>>([]);
  const [boardWidth, setBoardWidth] = useState(DEFAULT_BOARD.width);
  const [boardHeight, setBoardHeight] = useState(DEFAULT_BOARD.height);
  const [mouseBoardPos, setMouseBoardPos] = useState<{ x: number; y: number } | null>(null);

  // --- Refs ---
  const svgRef = useRef<SVGSVGElement>(null);
  const panStateRef = useRef<PanState>({ isPanning: false, lastMouse: { x: 0, y: 0 } });

  // --- Derived data ---
  const pcbWires = useMemo(() => (wires ?? []).filter((w: CircuitWireRow) => w.view === 'pcb'), [wires]);

  const ratsnestNets = useMemo(() => {
    if (!nets || !instances) {
      return [];
    }
    return buildRatsnestNets(nets, instances);
  }, [nets, instances]);

  const hasPlacedComponents = useMemo(
    () => instances != null && countPlacedInstances(instances) > 0,
    [instances],
  );

  // --- Callbacks (delegate to PCBInteractionManager) ---
  const callbacks = useMemo(
    () => ({
      setTool,
      setActiveLayer: setActiveLayer as (updater: (prev: ActiveLayer) => ActiveLayer) => void,
      setZoom,
      setPanOffset,
      setSelectedInstanceId,
      setSelectedWireId,
      setTracePoints,
      setMouseBoardPos,
    }),
    [],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => onCanvasClick(tool, svgRef.current, panOffset, zoom, callbacks, e),
    [tool, panOffset, zoom, callbacks],
  );

  const handleDblClick = useCallback(() => {
    onDoubleClick(tool, tracePoints, {
      circuitId,
      activeLayer,
      traceWidth,
      firstNetId: nets?.[0]?.id,
      createWire: (params) => createWireMutation.mutate(params),
    }, () => setTracePoints([]));
  }, [tool, tracePoints, circuitId, activeLayer, traceWidth, nets, createWireMutation]);

  const handleKey = useCallback(
    (e: React.KeyboardEvent) =>
      onKeyDown(e, selectedWireId, {
        circuitId,
        deleteWire: (params) => deleteWireMutation.mutate(params),
      }, callbacks),
    [selectedWireId, circuitId, deleteWireMutation, callbacks],
  );

  const handleMDown = useCallback(
    (e: React.MouseEvent) => onMouseDown(e, tool, selectedInstanceId, panStateRef.current),
    [tool, selectedInstanceId],
  );

  const handleMMove = useCallback(
    (e: React.MouseEvent) => onMouseMove(e, panStateRef.current, svgRef.current, panOffset, zoom, callbacks),
    [panOffset, zoom, callbacks],
  );

  const handleMUp = useCallback(() => onMouseUp(panStateRef.current), []);

  const handleWhl = useCallback((e: React.WheelEvent) => onWheel(e, callbacks), [callbacks]);

  const handleWireClick = useCallback(
    (wireId: number, _e: React.MouseEvent) => setSelectedWireId(wireId),
    [],
  );

  const handleInstanceClick = useCallback(
    (instanceId: number, _e: React.MouseEvent) => setSelectedInstanceId(instanceId),
    [],
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="h-8 border-b border-border bg-card/40 flex items-center px-2 gap-1 shrink-0">
        <ToolButton icon={MousePointer2} label="Select (1)" active={tool === 'select'} onClick={() => setTool('select')} testId="pcb-tool-select" />
        <ToolButton icon={Pencil} label="Trace (2)" active={tool === 'trace'} onClick={() => setTool('trace')} testId="pcb-tool-trace" />
        <ToolButton icon={Trash2} label="Delete (3)" active={tool === 'delete'} onClick={() => setTool('delete')} testId="pcb-tool-delete" />
        <div className="w-px h-4 bg-border mx-1" />
        <button
          data-testid="pcb-layer-toggle"
          onClick={() => setActiveLayer(toggleLayer)}
          title="Toggle copper layer (F) — Click to switch between Front and Back"
          aria-label={`Active layer: ${activeLayer === 'front' ? 'Front Copper' : 'Back Copper'}. Click to toggle.`}
          className={cn(
            'h-7 px-2.5 flex items-center gap-1.5 rounded text-[11px] font-medium transition-colors cursor-pointer border hover:brightness-125',
            layerToggleClasses(activeLayer),
          )}
        >
          <FlipHorizontal className="w-3.5 h-3.5" />
          {layerLabel(activeLayer)}
          <svg className="w-2.5 h-2.5 opacity-60" viewBox="0 0 10 10" fill="currentColor"><path d="M2 4l3 3 3-3" /></svg>
        </button>
        <div className="w-px h-4 bg-border mx-1" />
        <span className="text-[10px] text-muted-foreground">Trace:</span>
        <input
          type="range"
          min={0.5}
          max={8}
          step={0.5}
          value={traceWidth}
          onChange={(e) => setTraceWidth(Number(e.target.value))}
          className="w-16 h-1 accent-primary"
          data-testid="pcb-trace-width"
          aria-label="Trace width"
        />
        <span className="text-[10px] text-muted-foreground tabular-nums w-9">{traceWidth.toFixed(1)}mm</span>
        <div className="flex items-center gap-0.5 ml-0.5">
          {TRACE_WIDTH_PRESETS.map((w) => (
            <button
              key={w}
              data-testid={`pcb-trace-preset-${w}`}
              onClick={() => setTraceWidth(w)}
              title={`${w}mm trace width`}
              className={cn(
                'h-5 px-1 text-[9px] rounded transition-colors tabular-nums',
                traceWidth === w
                  ? 'bg-primary/20 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
            >
              {w}
            </button>
          ))}
        </div>
        <div className="w-px h-4 bg-border mx-1" />
        <ToolButton icon={ZoomIn} label="Zoom in" onClick={() => setZoom((z) => clampZoom(z + ZOOM_BUTTON_STEP))} testId="pcb-tool-zoom-in" />
        <ToolButton icon={ZoomOut} label="Zoom out" onClick={() => setZoom((z) => clampZoom(z - ZOOM_BUTTON_STEP))} testId="pcb-tool-zoom-out" />
        <ToolButton icon={RotateCcw} label="Reset view" onClick={() => { setZoom(DEFAULT_ZOOM); setPanOffset(DEFAULT_PAN); }} testId="pcb-tool-reset" />
        <div className="w-px h-4 bg-border mx-1" />
        <span className="text-[10px] text-muted-foreground">Board:</span>
        <input
          type="number"
          min={10}
          max={500}
          step={5}
          value={boardWidth / 10}
          onChange={(e) => setBoardWidth(Math.max(10, Number(e.target.value)) * 10)}
          className="w-12 h-5 px-1 text-[10px] text-foreground bg-muted/50 border border-border rounded text-center tabular-nums"
          data-testid="pcb-board-width"
          aria-label="Board width (mm)"
          title="Board width (mm)"
        />
        <span className="text-[9px] text-muted-foreground">x</span>
        <input
          type="number"
          min={10}
          max={500}
          step={5}
          value={boardHeight / 10}
          onChange={(e) => setBoardHeight(Math.max(10, Number(e.target.value)) * 10)}
          className="w-12 h-5 px-1 text-[10px] text-foreground bg-muted/50 border border-border rounded text-center tabular-nums"
          data-testid="pcb-board-height"
          aria-label="Board height (mm)"
          title="Board height (mm)"
        />
        <span className="text-[9px] text-muted-foreground">mm</span>
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
        className="flex-1 overflow-hidden bg-[#1a1a1a] relative"
        onMouseDown={handleMDown}
        onMouseMove={handleMMove}
        onMouseUp={handleMUp}
        onMouseLeave={() => setMouseBoardPos(null)}
        onWheel={handleWhl}
        onKeyDown={handleKey}
        onClick={handleClick}
        onDoubleClick={handleDblClick}
        tabIndex={0}
        data-testid="pcb-canvas"
      >
        <svg ref={svgRef} width="100%" height="100%" data-testid="pcb-svg">
          <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoom})`}>
            <BoardGrid boardWidth={boardWidth} boardHeight={boardHeight} />
            <BackLayerTraces wires={pcbWires} activeLayer={activeLayer} fallbackWidth={traceWidth} onWireClick={handleWireClick} />
            <ComponentFootprints instances={instances ?? []} selectedInstanceId={selectedInstanceId} onInstanceClick={handleInstanceClick} />
            <FrontLayerTraces wires={pcbWires} activeLayer={activeLayer} fallbackWidth={traceWidth} onWireClick={handleWireClick} />
            <TraceInProgress points={tracePoints} activeLayer={activeLayer} traceWidth={traceWidth} />
            <RatsnestOverlay nets={ratsnestNets} opacity={0.4} showLabels />
          </g>
        </svg>
        <LayerLegend boardWidth={boardWidth} boardHeight={boardHeight} />
        <CoordinateReadout mouseBoardPos={mouseBoardPos} />
        <EmptyGuidance hasPlacedComponents={hasPlacedComponents} />
      </div>
    </div>
  );
}
