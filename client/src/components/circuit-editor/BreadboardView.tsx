/**
 * BreadboardView — interactive breadboard editor with component placement,
 * wire drawing, and ratsnest overlay.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useProjectId } from '@/lib/contexts/project-id-context';
import {
  useCircuitDesigns,
  useCircuitInstances,
  useCircuitNets,
  useCircuitWires,
  useCreateCircuitWire,
  useCreateCircuitInstance,
  useDeleteCircuitWire,
  useUpdateCircuitInstance,
  useUpdateCircuitWire,
} from '@/lib/circuit-editor/hooks';
import { useComponentParts } from '@/lib/component-editor/hooks';
import { useSimulation } from '@/lib/contexts/simulation-context';
import BreadboardGrid from './BreadboardGrid';
import { BreadboardComponentOverlay, detectFamily, getFamilyValues, getCurrentValueLabel } from './BreadboardComponentRenderer';
import RatsnestOverlay, { type RatsnestNet, type RatsnestPin } from './RatsnestOverlay';
import ToolButton from './ToolButton';
import { Button } from '@/components/ui/button';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
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
  Info,
  Activity,
  Square,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BB,
  type BreadboardCoord,
  type PixelPos,
  coordKey,
  coordToPixel,
  pixelToCoord,
  getBoardDimensions,
  getOccupiedPoints,
  getConnectedPoints,
  checkCollision,
  type ComponentPlacement,
} from '@/lib/circuit-editor/breadboard-model';
import type { CircuitDesignRow, CircuitWireRow, ComponentPart } from '@shared/schema';
import { formatSIValue } from '@/lib/simulation/visual-state';
import type { WireVisualState } from '@/lib/simulation/visual-state';
import './simulation-overlays.css';

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
// Wire color palette (general purpose)
// ---------------------------------------------------------------------------

const WIRE_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#34495e', '#e91e63', '#00bcd4',
];

// ---------------------------------------------------------------------------
// Wire color presets for context menu (BL-0591)
// ---------------------------------------------------------------------------

const WIRE_COLOR_PRESETS: Array<{ name: string; hex: string }> = [
  { name: 'Red', hex: '#e74c3c' },
  { name: 'Black', hex: '#1a1a2e' },
  { name: 'Yellow', hex: '#f1c40f' },
  { name: 'Orange', hex: '#e67e22' },
  { name: 'Green', hex: '#2ecc71' },
  { name: 'Blue', hex: '#3498db' },
  { name: 'White', hex: '#ecf0f1' },
  { name: 'Gray', hex: '#95a5a6' },
];

/** Default wire color based on net name convention */
function defaultWireColor(netName: string | null | undefined): string {
  if (!netName) return '#2ecc71';
  const upper = netName.toUpperCase();
  if (upper === 'VCC' || upper === 'VDD' || upper === '5V' || upper === '3V3' || upper === '3.3V') {
    return '#e74c3c'; // red
  }
  if (upper === 'GND' || upper === 'VSS') {
    return '#1a1a2e'; // black
  }
  return '#2ecc71'; // green
}

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
  const { isLive, setIsLive, clearStates } = useSimulation();

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
      
      <div className="w-px h-4 bg-border mx-1" />
      
      <Button
        variant="outline"
        size="sm"
        className={cn(
          "h-7 gap-1.5 px-2.5 text-[10px] font-bold uppercase tracking-wider transition-all",
          isLive 
            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20" 
            : "text-muted-foreground hover:text-foreground"
        )}
        onClick={() => {
          if (isLive) clearStates();
          setIsLive(!isLive);
        }}
      >
        {isLive ? <Square className="w-3 h-3 fill-current" /> : <Activity className="w-3 h-3" />}
        {isLive ? 'Stop Simulation' : 'Live Simulation'}
      </Button>

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
  const projectId = useProjectId();
  const { data: instances } = useCircuitInstances(circuitId);
  const { data: nets } = useCircuitNets(circuitId);
  const { data: wires } = useCircuitWires(circuitId);
  const { data: parts } = useComponentParts(projectId);
  const { isLive, wireVisualStates, componentVisualStates } = useSimulation();
  
  const createWireMutation = useCreateCircuitWire();
  const createInstanceMutation = useCreateCircuitInstance();
  const deleteWireMutation = useDeleteCircuitWire();
  const updateInstanceMutation = useUpdateCircuitInstance();
  const updateWireMutation = useUpdateCircuitWire();

  const [tool, setTool] = useState<Tool>('select');
  const [zoom, setZoom] = useState(3);
  const [panOffset, setPanOffset] = useState<PixelPos>({ x: 20, y: 20 });
  const [hoveredCoord, setHoveredCoord] = useState<BreadboardCoord | null>(null);
  const [highlightedPoints, setHighlightedPoints] = useState<Set<string>>(new Set());
  const [wireInProgress, setWireInProgress] = useState<WireInProgress | null>(null);
  const [selectedWireId, setSelectedWireId] = useState<number | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<number | null>(null);
  const [mouseBoardPos, setMouseBoardPos] = useState<{ x: number; y: number } | null>(null);
  const [contextMenuWireId, setContextMenuWireId] = useState<number | null>(null);
  const [wireColorMenuPos, setWireColorMenuPos] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const lastMouse = useRef<PixelPos>({ x: 0, y: 0 });

  // BB-01: Center the breadboard on mount
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const { width: containerW, height: containerH } = container.getBoundingClientRect();
    const board = getBoardDimensions();
    const boardPixelW = board.width * zoom;
    const boardPixelH = board.height * zoom;
    setPanOffset({
      x: Math.max(20, (containerW - boardPixelW) / 2),
      y: Math.max(20, (containerH - boardPixelH) / 2),
    });
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter wires to breadboard view only
  const breadboardWires = useMemo(
    () => (wires ?? []).filter((w: CircuitWireRow) => w.view === 'breadboard'),
    [wires],
  );

  // Build ComponentPlacement for each placed instance (used by collision + drag-to-place)
  const instancePlacements = useMemo(() => {
    if (!instances) return [];
    const partsMap = new Map((parts ?? []).map((p: ComponentPart) => [p.id, p]));
    const placements: Array<{ instanceId: number; placement: ComponentPlacement }> = [];
    for (const inst of instances) {
      if (inst.breadboardX == null || inst.breadboardY == null) continue;
      const snapped = pixelToCoord({ x: inst.breadboardX, y: inst.breadboardY });
      if (!snapped || snapped.type !== 'terminal') continue;

      const part = inst.partId ? partsMap.get(inst.partId) : undefined;
      const pinCount = (part?.connectors as unknown[])?.length ?? 2;
      const compType = ((part?.meta as Record<string, unknown>)?.type as string)?.toLowerCase() ?? 'generic';

      // DIP ICs straddle the center channel (e-f columns)
      const isDIP = compType === 'ic' || compType === 'mcu';
      const rowSpan = isDIP ? Math.ceil(pinCount / 2) : Math.max(1, Math.ceil(pinCount / 2));

      placements.push({
        instanceId: inst.id,
        placement: {
          refDes: inst.referenceDesignator,
          startCol: snapped.col,
          startRow: snapped.row,
          rowSpan,
          crossesChannel: isDIP,
        },
      });
    }
    return placements;
  }, [instances, parts]);

  // Occupied points from placed instances
  const occupiedPoints = useMemo(() => {
    const set = new Set<string>();
    for (const { placement } of instancePlacements) {
      for (const pt of getOccupiedPoints(placement)) {
        set.add(coordKey(pt));
      }
    }
    return set;
  }, [instancePlacements]);

  // BL-0594: Selected instance family detection for value swapping
  const selectedInstanceInfo = useMemo(() => {
    if (selectedInstanceId == null || !instances) return null;
    const inst = instances.find(i => i.id === selectedInstanceId);
    if (!inst) return null;
    const partsMap = new Map((parts ?? []).map((p: ComponentPart) => [p.id, p]));
    const part = inst.partId ? partsMap.get(inst.partId) : undefined;
    const type = (part?.meta as Record<string, unknown>)?.type as string | undefined
      ?? (inst.properties as Record<string, unknown>)?.type as string | undefined;
    const family = detectFamily(type);
    if (!family) return null;
    const values = getFamilyValues(family);
    const currentLabel = getCurrentValueLabel(inst, family);
    return { instance: inst, family, values, currentLabel };
  }, [selectedInstanceId, instances, parts]);

  // BL-0594: Value change handler
  const handleValueChange = useCallback((value: number | string) => {
    if (!selectedInstanceInfo) return;
    const inst = selectedInstanceInfo.instance;
    const family = selectedInstanceInfo.family;
    const existingProps = (inst.properties as Record<string, unknown>) ?? {};
    const newProps: Record<string, string> = {};
    for (const [k, v] of Object.entries(existingProps)) {
      newProps[k] = String(v);
    }
    if (family === 'led') {
      newProps.color = String(value);
    } else {
      newProps.value = String(value);
    }
    updateInstanceMutation.mutate({
      circuitId,
      id: inst.id,
      properties: newProps,
    });
  }, [selectedInstanceInfo, updateInstanceMutation, circuitId]);

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
          color: defaultWireColor(firstNet.name),
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
      // BL-0592: Highlight all electrically connected holes in the same row/rail
      const connected = getConnectedPoints(coord);
      const keys = new Set(connected.map(coordKey));
      setHighlightedPoints(keys);
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

  // BL-0591: Wire right-click opens color picker
  const handleWireContextMenu = useCallback((e: React.MouseEvent, wireId: number) => {
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    setContextMenuWireId(wireId);
    setWireColorMenuPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const handleWireColorChange = useCallback((wireId: number, color: string) => {
    updateWireMutation.mutate({ circuitId, id: wireId, color });
    setContextMenuWireId(null);
    setWireColorMenuPos(null);
  }, [updateWireMutation, circuitId]);

  const closeWireColorMenu = useCallback(() => {
    setContextMenuWireId(null);
    setWireColorMenuPos(null);
  }, []);

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
    // Track board coordinates for the readout overlay
    const svg = svgRef.current;
    if (svg) {
      const rect = svg.getBoundingClientRect();
      const bx = (e.clientX - rect.left - panOffset.x) / zoom;
      const by = (e.clientY - rect.top - panOffset.y) / zoom;
      setMouseBoardPos({ x: Math.round(bx * 10) / 10, y: Math.round(by * 10) / 10 });
    }
  }, [panOffset, zoom]);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(prev => Math.max(1, Math.min(8, prev + (e.deltaY > 0 ? -0.3 : 0.3))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') handleEscape();
    if (e.key === 'Delete' || e.key === 'Backspace') handleDeleteWire();
    if (e.key === '1') setTool('select');
    if (e.key === '2') setTool('wire');
    if (e.key === '3') setTool('delete');
  }, [handleEscape, handleDeleteWire]);

  // --- Drag-to-place from component palette ---

  /** Convert a client-space mouse position to board-space pixel coords. */
  const clientToBoardPixel = useCallback((clientX: number, clientY: number): PixelPos | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return {
      x: (clientX - rect.left - panOffset.x) / zoom,
      y: (clientY - rect.top - panOffset.y) / zoom,
    };
  }, [panOffset, zoom]);

  const [dropPreviewCoord, setDropPreviewCoord] = useState<BreadboardCoord | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    const hasType = e.dataTransfer.types.includes('application/reactflow/type');
    if (!hasType) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';

    // Show a snap preview
    const boardPx = clientToBoardPixel(e.clientX, e.clientY);
    if (boardPx) {
      const coord = pixelToCoord(boardPx);
      setDropPreviewCoord(coord);
    }
  }, [clientToBoardPixel]);

  const handleDragLeave = useCallback(() => {
    setDropPreviewCoord(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDropPreviewCoord(null);

    const nodeType = e.dataTransfer.getData('application/reactflow/type');
    const label = e.dataTransfer.getData('application/reactflow/label');
    if (!nodeType) return;

    const boardPx = clientToBoardPixel(e.clientX, e.clientY);
    if (!boardPx) return;
    const coord = pixelToCoord(boardPx);
    if (!coord || coord.type !== 'terminal') return;

    // Build a temporary placement for collision check
    const isDIP = nodeType === 'ic' || nodeType === 'mcu';
    const rowSpan = isDIP ? 4 : 1; // Default for palette drops; will be refined once part is resolved
    const newPlacement: ComponentPlacement = {
      refDes: label || nodeType,
      startCol: coord.col,
      startRow: coord.row,
      rowSpan,
      crossesChannel: isDIP,
    };

    // Check collision against existing placements
    const existingPlacements = instancePlacements.map(ip => ip.placement);
    if (checkCollision(newPlacement, existingPlacements)) {
      return; // Silently reject — occupied
    }

    // Snap to pixel position of the coord for storage
    const snapPx = coordToPixel(coord);

    // Generate a unique reference designator
    const prefix = nodeType === 'mcu' ? 'U' : nodeType === 'ic' ? 'U' : nodeType.charAt(0).toUpperCase();
    const existingRefs = (instances ?? []).map(i => i.referenceDesignator);
    let idx = 1;
    while (existingRefs.includes(`${prefix}${idx}`)) {
      idx++;
    }

    createInstanceMutation.mutate({
      circuitId,
      partId: null,
      referenceDesignator: `${prefix}${idx}`,
      breadboardX: snapPx.x,
      breadboardY: snapPx.y,
      properties: { type: nodeType, label: label || nodeType },
    });
  }, [clientToBoardPixel, instancePlacements, instances, createInstanceMutation, circuitId]);

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
        ref={containerRef}
        className="flex-1 overflow-hidden bg-background cursor-crosshair relative"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setMouseBoardPos(null)}
        onKeyDown={handleKeyDown}
        onDoubleClick={handleDoubleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
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

            {/* Components Overlay (BL-0151) */}
            <BreadboardComponentOverlay
              instances={instances ?? []}
              parts={parts ?? []}
              selectedId={selectedInstanceId}
              onInstanceClick={(id) => setSelectedInstanceId(id)}
            />

            {/* Existing wires */}
            {breadboardWires.map((wire: CircuitWireRow) => {
              const pts = (wire.points as Array<{ x: number; y: number }>) ?? [];
              if (pts.length < 2) return null;
              const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

              // Look up simulation wire visual state
              const wireState: WireVisualState | undefined = isLive
                ? wireVisualStates.get(String(wire.netId))
                : undefined;
              const isAnimated = wireState != null && wireState.animationSpeed > 0;
              const animDuration = isAnimated ? Math.max(0.05, 16 / wireState.animationSpeed) : 0;
              const animDirection = wireState?.currentDirection === -1 ? 'reverse' : 'forward';

              return (
                <g key={wire.id}>
                  {/* Simulation current flow glow */}
                  {isAnimated && (
                    <path
                      d={pathD}
                      stroke="#00F0FF"
                      strokeWidth={(wire.width ?? 1.5) + 1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                      opacity={0.2}
                      style={{ filter: 'blur(1.5px)' }}
                      pointerEvents="none"
                    />
                  )}
                  <path
                    d={pathD}
                    stroke={isAnimated ? '#00F0FF' : (wire.color ?? '#3498db')}
                    strokeWidth={wire.width ?? 1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    className={cn(
                      isAnimated ? 'sim-wire-animated' : 'transition-opacity cursor-pointer',
                      !isAnimated && (selectedWireId === wire.id ? 'opacity-100' : 'opacity-80 hover:opacity-100'),
                    )}
                    style={isAnimated ? { animationDuration: `${animDuration}s` } : undefined}
                    data-direction={isAnimated ? animDirection : undefined}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedWireId(wire.id);
                    }}
                    onContextMenu={(e) => handleWireContextMenu(e, wire.id)}
                    data-testid={isAnimated ? `wire-animated-${wire.id}` : `wire-${wire.id}`}
                  />
                  {/* Simulation current label at wire midpoint */}
                  {isAnimated && pts.length >= 2 && (() => {
                    const midIdx = Math.floor(pts.length / 2);
                    const midPt = pts[midIdx];
                    return (
                      <g pointerEvents="none">
                        <rect
                          x={midPt.x + 2}
                          y={midPt.y - 6}
                          width={30}
                          height={10}
                          rx={2}
                          fill="rgba(0,0,0,0.7)"
                          stroke="rgba(0,240,255,0.2)"
                          strokeWidth={0.5}
                        />
                        <text
                          x={midPt.x + 4}
                          y={midPt.y + 1}
                          fill="#00F0FF"
                          fontSize={6}
                          fontFamily="monospace"
                          data-testid={`wire-sim-label-${wire.id}`}
                        >
                          {formatSIValue(wireState.currentMagnitude, 'A')}
                        </text>
                      </g>
                    );
                  })()}
                </g>
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

            {/* Drop preview indicator */}
            {dropPreviewCoord && dropPreviewCoord.type === 'terminal' && (() => {
              const px = coordToPixel(dropPreviewCoord);
              const isCollision = occupiedPoints.has(coordKey(dropPreviewCoord));
              return (
                <g data-testid="drop-preview" pointerEvents="none">
                  <rect
                    x={px.x - 6}
                    y={px.y - 6}
                    width={12}
                    height={12}
                    rx={2}
                    fill={isCollision ? 'rgba(239,68,68,0.3)' : 'rgba(0,240,255,0.3)'}
                    stroke={isCollision ? '#ef4444' : '#00F0FF'}
                    strokeWidth={1}
                    strokeDasharray="2,1"
                  />
                </g>
              );
            })()}

            {/* Ratsnest overlay */}
            <RatsnestOverlay
              nets={ratsnestNets}
              opacity={0.5}
              showLabels
            />

            {/* BL-0619 / BL-0128: Simulation component visual overlays */}
            {isLive && componentVisualStates.size > 0 && (instances ?? []).map((inst) => {
              if (inst.breadboardX == null || inst.breadboardY == null) { return null; }
              const state = componentVisualStates.get(inst.referenceDesignator);
              if (!state) { return null; }

              const x = inst.breadboardX;
              const y = inst.breadboardY;

              if (state.type === 'led' && state.glowing) {
                const color = state.color === 'red' ? '#ef4444'
                  : state.color === 'green' ? '#22c55e'
                  : state.color === 'blue' ? '#3b82f6'
                  : state.color === 'yellow' ? '#facc15'
                  : state.color === 'white' ? '#f5f5f5'
                  : '#22c55e';
                return (
                  <g key={`sim-led-${inst.id}`} pointerEvents="none" data-testid={`sim-bb-led-${inst.referenceDesignator}`}>
                    <circle cx={x} cy={y} r={8} fill={color} opacity={state.brightness * 0.3} style={{ filter: 'blur(4px)' }} />
                    <circle cx={x} cy={y} r={4} fill={color} opacity={state.brightness * 0.6} />
                  </g>
                );
              }

              if (state.type === 'resistor' || (state.type === 'generic' && Math.abs(state.current) > 0.0001)) {
                return (
                  <g key={`sim-val-${inst.id}`} pointerEvents="none" data-testid={`sim-bb-value-${inst.referenceDesignator}`}>
                    <rect x={x + 8} y={y - 8} width={32} height={14} rx={2} fill="rgba(0,0,0,0.7)" stroke="rgba(0,240,255,0.2)" strokeWidth={0.5} />
                    <text x={x + 10} y={y - 1} fill="#00F0FF" fontSize={5} fontFamily="monospace">
                      {formatSIValue(state.voltageDrop, 'V')}
                    </text>
                    <text x={x + 10} y={y + 4} fill="#00F0FF" fontSize={5} fontFamily="monospace" opacity={0.7}>
                      {formatSIValue(state.current, 'A')}
                    </text>
                  </g>
                );
              }

              if (state.type === 'switch') {
                return (
                  <g key={`sim-sw-${inst.id}`} pointerEvents="none" data-testid={`sim-bb-switch-${inst.referenceDesignator}`}>
                    <text
                      x={x + 8}
                      y={y + 2}
                      fill={state.closed ? '#22c55e' : '#ef4444'}
                      fontSize={6}
                      fontFamily="sans-serif"
                      fontWeight="bold"
                    >
                      {state.closed ? 'ON' : 'OFF'}
                    </text>
                  </g>
                );
              }

              return null;
            })}
          </g>
        </svg>

        {/* Coordinate readout */}
        {mouseBoardPos && (
          <div
            className="absolute bottom-3 right-3 z-10 bg-card/70 backdrop-blur-sm border border-border px-2 py-1 pointer-events-none select-none"
            data-testid="coordinate-readout"
          >
            <span className="text-[11px] font-mono tabular-nums text-[#00F0FF]">
              X: {mouseBoardPos.x} &nbsp; Y: {mouseBoardPos.y}
            </span>
          </div>
        )}

        {/* BL-0591: Wire color picker context menu */}
        {contextMenuWireId != null && wireColorMenuPos && (
          <div
            className="absolute z-20 bg-card border border-border rounded-md shadow-lg p-1.5"
            style={{ left: wireColorMenuPos.x, top: wireColorMenuPos.y }}
            data-testid="wire-color-menu"
            onMouseLeave={closeWireColorMenu}
          >
            <div className="text-[10px] text-muted-foreground px-1.5 py-0.5 mb-1 font-medium">Wire Color</div>
            <div className="grid grid-cols-4 gap-1">
              {WIRE_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.hex}
                  className="w-6 h-6 rounded-sm border border-border hover:border-primary transition-colors cursor-pointer"
                  style={{ backgroundColor: preset.hex }}
                  title={preset.name}
                  onClick={() => handleWireColorChange(contextMenuWireId, preset.hex)}
                  data-testid={`wire-color-${preset.name.toLowerCase()}`}
                />
              ))}
            </div>
          </div>
        )}

        {/* BL-0594: Part family value selector */}
        {selectedInstanceInfo && (
          <div
            className="absolute top-2 right-2 z-20 bg-card/90 backdrop-blur-sm border border-border rounded-md shadow-lg p-2 w-44"
            data-testid="value-selector-panel"
          >
            <div className="text-[10px] text-muted-foreground mb-1 font-medium">
              {selectedInstanceInfo.instance.referenceDesignator} — {selectedInstanceInfo.family}
            </div>
            <div className="text-[11px] text-[#00F0FF] font-mono mb-1.5" data-testid="value-selector-current">
              {selectedInstanceInfo.currentLabel}
            </div>
            <div className="max-h-36 overflow-y-auto space-y-0.5 scrollbar-thin">
              {selectedInstanceInfo.family === 'led' ? (
                <div className="grid grid-cols-3 gap-1">
                  {selectedInstanceInfo.values.map((v) => (
                    <button
                      key={String(v.value)}
                      className={cn(
                        'h-6 rounded-sm border text-[9px] font-medium cursor-pointer transition-colors',
                        selectedInstanceInfo.currentLabel === v.value
                          ? 'border-primary bg-primary/20'
                          : 'border-border hover:border-primary/50',
                      )}
                      style={{ backgroundColor: (v as { hex?: string }).hex ?? '#888' }}
                      title={v.label}
                      onClick={() => handleValueChange(v.value)}
                      data-testid={`value-option-${v.value}`}
                    />
                  ))}
                </div>
              ) : (
                selectedInstanceInfo.values.map((v) => (
                  <button
                    key={String(v.value)}
                    className={cn(
                      'w-full text-left px-1.5 py-0.5 text-[10px] font-mono rounded-sm cursor-pointer transition-colors',
                      selectedInstanceInfo.currentLabel === v.label
                        ? 'bg-primary/20 text-[#00F0FF]'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                    onClick={() => handleValueChange(v.value)}
                    data-testid={`value-option-${v.label}`}
                  >
                    {v.label}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* BB-02 / BB-03: Empty state guidance when no components are placed */}
        {(!instances || instances.filter(i => i.breadboardX != null).length === 0) && (
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-card/80 backdrop-blur-xl border border-border px-4 py-2.5 shadow-lg max-w-sm text-center"
            data-testid="breadboard-empty-guidance"
          >
            <div className="flex items-center gap-2 justify-center mb-1">
              <Info className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs font-medium text-foreground">Getting Started</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Components from the Schematic view will appear here. Use the <strong>Wire tool (2)</strong> to route connections between pins, or <strong>double-click</strong> to finish a wire.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
