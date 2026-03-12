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

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useProjectId } from '@/lib/contexts/project-id-context';
import {
  useCircuitDesigns,
  useCircuitInstances,
  useCircuitNets,
  useCircuitWires,
  useCircuitVias,
  useCreateCircuitWire,
  useDeleteCircuitWire,
  useUpdateCircuitInstance,
  useCreateCircuitInstance,
  usePcbZones,
  useCreatePcbZone,
  useUpdatePcbZone,
  useDeletePcbZone,
  useComments,
  useCreateComment,
  useResolveComment,
  useDeleteComment,
} from '@/lib/circuit-editor/hooks';
import { generateRefDes } from '@/lib/circuit-editor/ref-des';
import RatsnestOverlay from './RatsnestOverlay';
import ToolButton from './ToolButton';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
  Circle,
  RefreshCw,
  CheckSquare,
  Maximize,
  ShieldCheck,
  ShieldAlert,
  ClipboardPaste,
  Pentagon,
  MessageSquarePlus,
  Scissors,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
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
  ViaOverlay,
  LayerStackPanel,
  TRACE_COLORS,
} from '@/components/views/pcb-layout';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import type { ActiveLayer, PcbTool, PanState, SelectionRect, SelectionDragState } from '@/components/views/pcb-layout';
import type { Via, ViaType } from '@/lib/pcb/via-model';
import type { CircuitDesignRow, CircuitInstanceRow, CircuitWireRow, CircuitViaRow } from '@shared/schema';

// ---------------------------------------------------------------------------
// Top-level view (circuit selector + canvas)
// ---------------------------------------------------------------------------

export default function PCBLayoutView() {
  const projectId = useProjectId();
  const { data: circuits, isLoading, isError, error, refetch } = useCircuitDesigns(projectId);
  const [activeCircuitId, setActiveCircuitId] = useState<number | null>(null);
  const activeCircuit = circuits?.find((c) => c.id === activeCircuitId) ?? circuits?.[0] ?? null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="pcb-loading">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3" data-testid="pcb-error">
        <CircuitBoard className="w-10 h-10 text-destructive/60" />
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : 'Failed to load circuit designs'}
        </p>
        <button
          data-testid="retry-pcb"
          onClick={() => void refetch()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border bg-muted hover:bg-muted/80 hover:text-foreground text-muted-foreground transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Retry
        </button>
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
            Create a schematic first, then switch here to lay out your PCB.
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
      {activeCircuit && <PCBCanvas circuitId={activeCircuit.id} projectId={projectId} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PCB Mini-map — small overview of board + viewport indicator
// ---------------------------------------------------------------------------

interface PCBMiniMapProps {
  boardWidth: number;
  boardHeight: number;
  instances: CircuitInstanceRow[];
  panOffset: { x: number; y: number };
  zoom: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onPan: (offset: { x: number; y: number }) => void;
}

const MINIMAP_W = 150;
const MINIMAP_H = 100;

function PCBMiniMap({ boardWidth, boardHeight, instances, panOffset, zoom, containerRef, onPan }: PCBMiniMapProps) {
  // Scale board to fit inside the minimap with some padding
  const padding = 8;
  const innerW = MINIMAP_W - padding * 2;
  const innerH = MINIMAP_H - padding * 2;
  const scaleX = innerW / boardWidth;
  const scaleY = innerH / boardHeight;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = padding + (innerW - boardWidth * scale) / 2;
  const offsetY = padding + (innerH - boardHeight * scale) / 2;

  // Compute viewport rect in minimap coordinates
  const container = containerRef.current;
  const containerW = container?.clientWidth ?? 800;
  const containerH = container?.clientHeight ?? 600;

  // The visible area in board coordinates:
  // board coords = (screenCoord - panOffset) / zoom
  const vpLeft = -panOffset.x / zoom;
  const vpTop = -panOffset.y / zoom;
  const vpW = containerW / zoom;
  const vpH = containerH / zoom;

  // Map to minimap coordinates
  const vpMiniX = offsetX + vpLeft * scale;
  const vpMiniY = offsetY + vpTop * scale;
  const vpMiniW = vpW * scale;
  const vpMiniH = vpH * scale;

  const handleMinimapClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Convert minimap click to board coordinates
      const boardX = (clickX - offsetX) / scale;
      const boardY = (clickY - offsetY) / scale;

      // Center the viewport on the clicked board position
      const newPanX = -(boardX * zoom - containerW / 2);
      const newPanY = -(boardY * zoom - containerH / 2);
      onPan({ x: newPanX, y: newPanY });
    },
    [offsetX, offsetY, scale, zoom, containerW, containerH, onPan],
  );

  return (
    <div
      className="absolute bottom-2 right-2 z-10 bg-card/80 border border-border rounded-sm overflow-hidden"
      data-testid="pcb-minimap"
    >
      <svg
        width={MINIMAP_W}
        height={MINIMAP_H}
        className="cursor-pointer"
        onClick={handleMinimapClick}
      >
        {/* Board outline */}
        <rect
          x={offsetX}
          y={offsetY}
          width={boardWidth * scale}
          height={boardHeight * scale}
          fill="#1a1a1a"
          stroke="#444"
          strokeWidth={1}
        />
        {/* Instance dots */}
        {instances.map((inst) => {
          const ix = inst.pcbX ?? inst.schematicX;
          const iy = inst.pcbY ?? inst.schematicY;
          return (
            <circle
              key={inst.id}
              cx={offsetX + ix * scale}
              cy={offsetY + iy * scale}
              r={2}
              fill="#06b6d4"
            />
          );
        })}
        {/* Viewport indicator */}
        <rect
          x={vpMiniX}
          y={vpMiniY}
          width={vpMiniW}
          height={vpMiniH}
          fill="rgba(0, 240, 255, 0.12)"
          stroke="#00F0FF"
          strokeWidth={1}
          rx={1}
        />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PCB Canvas — wires together all extracted modules
// ---------------------------------------------------------------------------

function PCBCanvas({ circuitId, projectId }: { circuitId: number; projectId: number }) {
  // --- Data hooks ---
  const { data: instances } = useCircuitInstances(circuitId);
  const { data: nets } = useCircuitNets(circuitId);
  const { data: wires } = useCircuitWires(circuitId);
  const { data: circuitVias } = useCircuitVias(circuitId);
  const { data: zones } = usePcbZones(projectId);
  const { data: commentResult } = useComments(projectId, { targetType: 'spatial', resolved: false });
  const comments = commentResult?.data ?? [];

  const createWireMutation = useCreateCircuitWire();
  const deleteWireMutation = useDeleteCircuitWire();
  const createInstanceMutation = useCreateCircuitInstance();
  const createZoneMutation = useCreatePcbZone();
  const deleteZoneMutation = useDeletePcbZone();
  const createCommentMutation = useCreateComment();
  const resolveCommentMutation = useResolveComment();
  const deleteCommentMutation = useDeleteComment();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _updateInstanceMutation = useUpdateCircuitInstance();

  const { toast } = useToast();

  // --- State ---
  const [tool, setTool] = useState<PcbTool>('select');
  const [activeLayer, setActiveLayer] = useState<ActiveLayer>('front');
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [panOffset, setPanOffset] = useState(DEFAULT_PAN);
  const [selectedInstanceId, setSelectedInstanceId] = useState<number | null>(null);
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<number[]>([]);
  const [selectedWireId, setSelectedWireId] = useState<number | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [selectedCommentId, setSelectedCommentId] = useState<number | null>(null);

  // New comment dialog state
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [newCommentPos, setNewCommentPos] = useState<{ x: number; y: number } | null>(null);
  const [newCommentText, setNewCommentNewText] = useState('');
  const [traceWidth, setTraceWidth] = useState(DEFAULT_TRACE_WIDTH);
  const [tracePoints, setTracePoints] = useState<Array<{ x: number; y: number }>>([]);
  const [zonePoints, setZonePoints] = useState<Array<{ x: number; y: number }>>([]);
  const [boardWidth, setBoardWidth] = useState(DEFAULT_BOARD.width);
  const [boardHeight, setBoardHeight] = useState(DEFAULT_BOARD.height);
  const [mouseBoardPos, setMouseBoardPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedViaId, setSelectedViaId] = useState<string | null>(null);

  // Marquee selection state
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const selectionStateRef = useRef<SelectionDragState>({ isDragging: false, origin: { x: 0, y: 0 } });

  // Clipboard state
  const clipboardRef = useRef<any>(null);

  // --- Refs ---
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panStateRef = useRef<PanState>({ isPanning: false, lastMouse: { x: 0, y: 0 } });

  // --- Derived data ---
  const pcbWires = useMemo(() => (wires ?? []).filter((w: CircuitWireRow) => w.view === 'pcb'), [wires]);

  const vias: Via[] = useMemo(() => {
    return (circuitVias ?? []).map((v) => ({
      id: String(v.id),
      position: { x: v.x, y: v.y },
      drillDiameter: v.drillDiameter,
      outerDiameter: v.outerDiameter,
      type: (v.viaType as ViaType) || 'through',
      fromLayer: v.layerStart,
      toLayer: v.layerEnd,
      netId: v.netId ?? undefined,
      tented: v.tented,
    }));
  }, [circuitVias]);

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
      setSelectedInstanceIds,
      setSelectedWireId,
      setSelectedZoneId,
      setSelectedCommentId,
      setTracePoints,
      setZonePoints,
      setMouseBoardPos,
      setNewCommentPos,
      setIsCommentDialogOpen,
      setInstanceRotation: (_instanceId: number, _rotation: number) => {
        // TODO: Wire to updateInstanceMutation
      },
      setSelectionRect,
    }),
    [],
  );

  const handleCopy = useCallback(async () => {
    const selectedIds = selectedInstanceIds.length > 0 ? selectedInstanceIds : (selectedInstanceId ? [selectedInstanceId] : []);
    if (selectedIds.length === 0) return;

    const bundle = {
      type: 'protopulse-pcb-bundle',
      instances: (instances ?? [])
        .filter(inst => selectedIds.includes(inst.id))
        .map(inst => ({
          partId: inst.partId,
          referenceDesignator: inst.referenceDesignator,
          pcbX: inst.pcbX,
          pcbY: inst.pcbY,
          pcbRotation: inst.pcbRotation,
          pcbSide: inst.pcbSide,
          properties: inst.properties,
          oldId: inst.id
        })),
    };

    clipboardRef.current = bundle;
    try {
      await navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
      toast({ title: 'Copied', description: `Copied ${bundle.instances.length} components.` });
    } catch (err) {
      console.error('Copy failed', err);
    }
  }, [selectedInstanceIds, selectedInstanceId, instances, toast]);

  const handlePaste = useCallback(async (bundle: any) => {
    if (!bundle || bundle.type !== 'protopulse-pcb-bundle') return;

    // Center of viewport in board coordinates
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const center = {
      x: (rect.width / 2 - panOffset.x) / zoom,
      y: (rect.height / 2 - panOffset.y) / zoom,
    };

    const insts = bundle.instances || [];
    if (insts.length === 0) return;

    const allX = insts.map((i: any) => i.pcbX ?? 0);
    const allY = insts.map((i: any) => i.pcbY ?? 0);
    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);
    const minY = Math.min(...allY);
    const maxY = Math.max(...allY);
    const bboxCenterX = (minX + maxX) / 2;
    const bboxCenterY = (minY + maxY) / 2;

    const offsetX = center.x - bboxCenterX;
    const offsetY = center.y - bboxCenterY;

    const usedRefDes = new Set((instances ?? []).map(i => i.referenceDesignator));

    try {
      for (const inst of insts) {
        // Find part info for refDes generation
        // Note: partsMap not available in PCBCanvas currently? 
        // SchematicCanvas had it. Let's see if we need it.
        // generateRefDes in pcb-layout doesn't seem to need partsMap if we provide prefix.
        
        // Actually, let's just use the copied refDes and find next available
        let uniqueRefDes = inst.referenceDesignator;
        let suffix = 1;
        while (usedRefDes.has(uniqueRefDes)) {
          const prefix = inst.referenceDesignator.replace(/\d+$/, '');
          const match = inst.referenceDesignator.match(/\d+$/);
          const num = match ? parseInt(match[0], 10) : 0;
          uniqueRefDes = `${prefix}${num + suffix}`;
          suffix++;
        }
        usedRefDes.add(uniqueRefDes);

        await createInstanceMutation.mutateAsync({
          circuitId,
          partId: inst.partId,
          referenceDesignator: uniqueRefDes,
          pcbX: (inst.pcbX ?? 0) + offsetX,
          pcbY: (inst.pcbY ?? 0) + offsetY,
          pcbRotation: inst.pcbRotation,
          pcbSide: inst.pcbSide,
          properties: inst.properties,
        });
      }
      toast({ title: 'Pasted successfully', description: `Added ${insts.length} components.` });
    } catch (err) {
      console.error('Paste failed', err);
      toast({ variant: 'destructive', title: 'Paste failed', description: 'Error duplicating components.' });
    }
  }, [circuitId, instances, panOffset, zoom, createInstanceMutation, toast]);

  const triggerPaste = useCallback(async () => {
    let bundle = clipboardRef.current;
    if (!bundle) {
      try {
        const text = await navigator.clipboard.readText();
        const parsed = JSON.parse(text);
        if (parsed.type === 'protopulse-pcb-bundle') {
          bundle = parsed;
        }
      } catch {}
    }
    if (bundle) void handlePaste(bundle);
  }, [handlePaste]);

  const handleSaveComment = useCallback(async () => {
    if (!newCommentPos || !newCommentText.trim()) return;
    try {
      await createCommentMutation.mutateAsync({
        projectId,
        content: newCommentText,
        targetType: 'spatial',
        spatialX: newCommentPos.x,
        spatialY: newCommentPos.y,
        spatialView: 'pcb',
      });
      setIsCommentDialogOpen(false);
      setNewCommentNewText('');
      setNewCommentPos(null);
      toast({ title: 'Comment pinned' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save comment.' });
    }
  }, [projectId, newCommentPos, newCommentText, createCommentMutation, toast]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => onCanvasClick(tool, svgRef.current, panOffset, zoom, callbacks, e),
    [tool, panOffset, zoom, callbacks],
  );

  const handleDblClick = useCallback(async () => {
    if (['pour', 'keepout', 'keepin', 'cutout'].includes(tool)) {
      if (zonePoints.length >= 3) {
        try {
          await createZoneMutation.mutateAsync({
            projectId,
            zoneType: tool as 'pour' | 'keepout' | 'keepin' | 'cutout',
            layer: tool === 'cutout' ? 'Edge.Cuts' : activeLayer,
            points: zonePoints,
            name: `${tool.toUpperCase()} Zone`,
          });
          setZonePoints([]);
          toast({ title: 'Zone created', description: `New ${tool} zone added.` });
        } catch (err) {
          toast({ variant: 'destructive', title: 'Error', description: 'Failed to create zone.' });
        }
      } else {
        setZonePoints([]);
      }
      return;
    }

    if (tool === 'trace') {
      onDoubleClick(tool, tracePoints, {
        circuitId,
        activeLayer,
        traceWidth,
        firstNetId: nets?.[0]?.id,
        createWire: (params) => createWireMutation.mutate(params),
      }, () => setTracePoints([]));
      return;
    }
  }, [tool, zonePoints, projectId, activeLayer, createZoneMutation, toast, tracePoints, circuitId, traceWidth, nets, createWireMutation]);

  const selectedInstanceRotation = useMemo(() => {
    if (selectedInstanceId == null || !instances) {
      return 0;
    }
    const inst = instances.find((i) => i.id === selectedInstanceId);
    return inst?.pcbRotation ?? 0;
  }, [selectedInstanceId, instances]);

  const handleKey = useCallback(
    (e: React.KeyboardEvent) => {
      const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey && e.key.toLowerCase() === 'c' && !e.shiftKey) {
        e.preventDefault();
        void handleCopy();
        return;
      }
      if (modKey && e.key.toLowerCase() === 'v' && !e.shiftKey) {
        e.preventDefault();
        void triggerPaste();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedZoneId) {
          void deleteZoneMutation.mutateAsync({ projectId, zoneId: selectedZoneId });
          setSelectedZoneId(null);
          return;
        }
        if (selectedCommentId) {
          void deleteCommentMutation.mutateAsync({ projectId, commentId: selectedCommentId });
          setSelectedCommentId(null);
          return;
        }
      }

      onKeyDown(e, selectedWireId, {
        circuitId,
        deleteWire: (params) => deleteWireMutation.mutate(params),
      }, callbacks, selectedInstanceId, tool, selectedInstanceRotation);
    },
    [selectedWireId, circuitId, deleteWireMutation, callbacks, selectedInstanceId, tool, selectedInstanceRotation, handleCopy, triggerPaste, selectedZoneId, deleteZoneMutation, projectId],
  );

  const handleMDown = useCallback(
    (e: React.MouseEvent) => onMouseDown(
      e, tool, selectedInstanceId, panStateRef.current,
      selectionStateRef.current, svgRef.current, panOffset, zoom
    ),
    [tool, selectedInstanceId, panOffset, zoom],
  );

  const handleMMove = useCallback(
    (e: React.MouseEvent) => onMouseMove(
      e, panStateRef.current, svgRef.current, panOffset, zoom, callbacks,
      selectionStateRef.current
    ),
    [panOffset, zoom, callbacks],
  );

  const handleMUp = useCallback(
    () => onMouseUp(
      panStateRef.current, selectionStateRef.current, selectionRect, instances, callbacks
    ),
    [selectionRect, instances, callbacks],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const wheelHandler = (e: WheelEvent) => onWheel(e, callbacks);
    el.addEventListener('wheel', wheelHandler, { passive: false });
    return () => el.removeEventListener('wheel', wheelHandler);
  }, [callbacks]);

  const handleWireClick = useCallback(
    (wireId: number, _e: React.MouseEvent) => setSelectedWireId(wireId),
    [],
  );

  const handleInstanceClick = useCallback(
    (instanceId: number, _e: React.MouseEvent) => setSelectedInstanceId(instanceId),
    [],
  );

  // Context menu handlers
  const handleCtxAddVia = useCallback(() => {
    setTool('via');
  }, []);

  const handleCtxAddTrace = useCallback(() => {
    setTool('trace');
  }, []);

  const handleCtxRunDrc = useCallback(() => {
    window.dispatchEvent(new CustomEvent('protopulse:run-drc'));
  }, []);

  const handleCtxZoomToFit = useCallback(() => {
    setZoom(DEFAULT_ZOOM);
    setPanOffset(DEFAULT_PAN);
  }, []);

  const handleCtxSelectAll = useCallback(() => {
    setSelectedInstanceId(null);
    setSelectedWireId(null);
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="h-8 border-b border-border bg-card/40 flex items-center px-2 gap-1 shrink-0">
        <ToolButton icon={MousePointer2} label="Select (1)" active={tool === 'select'} onClick={() => setTool('select')} testId="pcb-tool-select" />
        <ToolButton icon={Pencil} label="Trace (2)" active={tool === 'trace'} onClick={() => setTool('trace')} testId="pcb-tool-trace" />
        <ToolButton icon={Trash2} label="Delete (3)" active={tool === 'delete'} onClick={() => setTool('delete')} testId="pcb-tool-delete" />
        <ToolButton icon={Circle} label="Via (4)" active={tool === 'via'} onClick={() => setTool('via')} testId="pcb-tool-via" />
        <div className="w-px h-4 bg-border mx-1" />
        <ToolButton icon={Pentagon} label="Pour (P)" active={tool === 'pour'} onClick={() => setTool('pour')} testId="pcb-tool-pour" />
        <ToolButton icon={ShieldAlert} label="Keepout (K)" active={tool === 'keepout'} onClick={() => setTool('keepout')} testId="pcb-tool-keepout" />
        <ToolButton icon={ShieldCheck} label="Keepin" active={tool === 'keepin'} onClick={() => setTool('keepin')} testId="pcb-tool-keepin" />
        <ToolButton icon={Scissors} label="Cutout (X)" active={tool === 'cutout'} onClick={() => setTool('cutout')} testId="pcb-tool-cutout" />
        <ToolButton icon={MessageSquarePlus} label="Comment (C)" active={tool === 'comment'} onClick={() => setTool('comment')} testId="pcb-tool-comment" />
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
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={containerRef}
            className="flex-1 overflow-hidden bg-[#1a1a1a] relative"
            onMouseDown={handleMDown}
            onMouseMove={handleMMove}
            onMouseUp={handleMUp}
            onMouseLeave={() => setMouseBoardPos(null)}
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
                <ComponentFootprints instances={instances ?? []} selectedInstanceId={selectedInstanceId} activeLayer={activeLayer} onInstanceClick={handleInstanceClick} />
                <FrontLayerTraces wires={pcbWires} activeLayer={activeLayer} fallbackWidth={traceWidth} onWireClick={handleWireClick} />

                {/* Render Zones (BL-0100) and Teardrops (BL-0103) */}
                {(zones ?? []).map((zone) => {
                  const isTeardrop = zone.zoneType === 'teardrop';
                  const layerColor = TRACE_COLORS[zone.layer] || TRACE_COLORS.front;

                  return (
                    <polygon
                      key={zone.id}
                      points={(zone.points as any[]).map((p: any) => `${p.x},${p.y}`).join(' ')}
                      fill={
                        isTeardrop ? layerColor :
                        zone.zoneType === 'pour' ? 'rgba(0, 255, 0, 0.2)' :
                        zone.zoneType === 'keepout' ? 'rgba(255, 0, 0, 0.2)' :
                        zone.zoneType === 'cutout' ? 'rgba(0, 0, 0, 0.6)' :
                        'rgba(0, 0, 255, 0.2)'
                      }
                      stroke={
                        selectedZoneId === zone.id ? '#00F0FF' :
                        isTeardrop ? layerColor :
                        zone.zoneType === 'pour' ? '#00FF00' :
                        zone.zoneType === 'keepout' ? '#FF0000' :
                        zone.zoneType === 'cutout' ? '#FFFFFF' :
                        '#0000FF'
                      }
                      strokeWidth={selectedZoneId === zone.id ? 2 / zoom : isTeardrop ? 0 : 1 / zoom}
                      strokeDasharray={(zone.zoneType === 'keepout' || zone.zoneType === 'cutout') ? `${2/zoom},${2/zoom}` : undefined}
                      className={cn(
                        "cursor-pointer transition-opacity duration-200",
                        (activeLayer !== zone.layer && zone.zoneType !== 'cutout') && "opacity-20 pointer-events-none"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (tool === 'delete') {
                          void deleteZoneMutation.mutateAsync({ projectId, zoneId: zone.id });
                        } else {
                          setSelectedZoneId(zone.id);
                          setSelectedInstanceId(null);
                          setSelectedWireId(null);
                          setSelectedCommentId(null);
                        }
                      }}
                    />
                  );
                })}

                {/* Render Spatial Comments (BL-0180) */}
                {comments.map((comment) => {
                  if (comment.spatialX == null || comment.spatialY == null) return null;
                  const x = typeof comment.spatialX === 'string' ? parseFloat(comment.spatialX) : (comment.spatialX as number);
                  const y = typeof comment.spatialY === 'string' ? parseFloat(comment.spatialY) : (comment.spatialY as number);
                  const isSelected = selectedCommentId === comment.id;

                  return (
                    <StyledTooltip
                      key={comment.id}
                      content={
                        <div className="max-w-xs">
                          <div className="font-bold text-[10px] mb-1 opacity-70">Review Comment</div>
                          <div className="text-xs">{comment.content}</div>
                        </div>
                      }
                    >
                      <g
                        transform={`translate(${x}, ${y})`}
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (tool === 'delete') {
                            void deleteCommentMutation.mutateAsync({ projectId, commentId: comment.id });
                          } else {
                            setSelectedCommentId(comment.id);
                            setSelectedInstanceId(null);
                            setSelectedZoneId(null);
                          }
                        }}
                      >
                        <circle
                          r={6 / zoom}
                          fill={comment.resolved ? "rgba(34, 197, 94, 0.2)" : "rgba(234, 179, 8, 0.2)"}
                          stroke={isSelected ? "#00F0FF" : (comment.resolved ? "#22c55e" : "#eab308")}
                          strokeWidth={2 / zoom}
                        />
                        <text
                          y={1 / zoom}
                          textAnchor="middle"
                          fontSize={8 / zoom}
                          className="select-none pointer-events-none font-bold"
                          fill={comment.resolved ? "#22c55e" : "#eab308"}
                        >
                          ?
                        </text>
                      </g>
                    </StyledTooltip>
                  );
                })}

                {/* Render active polygon drawing */}
                {zonePoints.length > 0 && (
                  <g>
                    <polyline
                      points={zonePoints.map(p => `${p.x},${p.y}`).join(' ')}
                      fill="none"
                      stroke="#00F0FF"
                      strokeWidth={2 / zoom}
                    />
                    {/* Preview line to mouse */}
                    {mouseBoardPos && (
                      <line
                        x1={zonePoints[zonePoints.length - 1].x}
                        y1={zonePoints[zonePoints.length - 1].y}
                        x2={mouseBoardPos.x}
                        y2={mouseBoardPos.y}
                        stroke="#00F0FF"
                        strokeWidth={1 / zoom}
                        strokeDasharray={`${2/zoom},${2/zoom}`}
                        opacity={0.6}
                      />
                    )}
                    {zonePoints.length >= 3 && (
                      <line
                        x1={zonePoints[zonePoints.length - 1].x}
                        y1={zonePoints[zonePoints.length - 1].y}
                        x2={zonePoints[0].x}
                        y2={zonePoints[0].y}
                        stroke="#00F0FF"
                        strokeWidth={1 / zoom}
                        strokeDasharray={`${4/zoom},${4/zoom}`}
                      />
                    )}
                    {zonePoints.map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r={3 / zoom} fill="#00F0FF" />
                    ))}
                  </g>
                )}

                <TraceInProgress points={tracePoints} activeLayer={activeLayer} traceWidth={traceWidth} />
                <ViaOverlay vias={vias} selectedViaId={selectedViaId} onViaClick={(id) => setSelectedViaId(id)} />
                <RatsnestOverlay nets={ratsnestNets} opacity={0.4} showLabels />
                {selectionRect && (
                  <rect
                    x={selectionRect.x}
                    y={selectionRect.y}
                    width={selectionRect.width}
                    height={selectionRect.height}
                    fill="rgba(0, 240, 255, 0.1)"
                    stroke="#00F0FF"
                    strokeWidth={1 / zoom}
                    strokeDasharray={`${4 / zoom},${2 / zoom}`}
                  />
                )}
              </g>
            </svg>
            <div className="absolute top-3 left-3 z-10">
              <LayerStackPanel activeLayer={activeLayer} onLayerSelect={setActiveLayer} />
            </div>
            <LayerLegend boardWidth={boardWidth} boardHeight={boardHeight} />
            <CoordinateReadout mouseBoardPos={mouseBoardPos} />
            <EmptyGuidance hasPlacedComponents={hasPlacedComponents} />
            <PCBMiniMap
              boardWidth={boardWidth}
              boardHeight={boardHeight}
              instances={instances ?? []}
              panOffset={panOffset}
              zoom={zoom}
              containerRef={containerRef}
              onPan={setPanOffset}
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="bg-card/90 backdrop-blur-xl border-border min-w-[180px]">
          <ContextMenuItem data-testid="ctx-add-via" onSelect={handleCtxAddVia}>
            <Circle className="w-4 h-4 mr-2" />
            Add Via
            <span className="ml-auto text-muted-foreground text-[10px]">4</span>
          </ContextMenuItem>
          <ContextMenuItem data-testid="ctx-add-trace" onSelect={handleCtxAddTrace}>
            <Pencil className="w-4 h-4 mr-2" />
            Add Trace
            <span className="ml-auto text-muted-foreground text-[10px]">2</span>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem data-testid="ctx-run-drc" onSelect={handleCtxRunDrc}>
            <ShieldCheck className="w-4 h-4 mr-2" />
            Run DRC
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem data-testid="ctx-zoom-to-fit" onSelect={handleCtxZoomToFit}>
            <Maximize className="w-4 h-4 mr-2" />
            Zoom to Fit
          </ContextMenuItem>
          <ContextMenuItem data-testid="ctx-select-all" onSelect={handleCtxSelectAll}>
            <CheckSquare className="w-4 h-4 mr-2" />
            Select All
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem data-testid="ctx-copy" onSelect={handleCopy}>
            <Circle className="w-4 h-4 mr-2" />
            Copy
            <span className="ml-auto text-muted-foreground text-[10px]">Ctrl+C</span>
          </ContextMenuItem>
          <ContextMenuItem data-testid="ctx-paste" onSelect={triggerPaste}>
            <ClipboardPaste className="w-4 h-4 mr-2" />
            Paste
            <span className="ml-auto text-muted-foreground text-[10px]">Ctrl+V</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <Dialog open={isCommentDialogOpen} onOpenChange={setIsCommentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Review Comment</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              autoFocus
              placeholder="What needs to be fixed here?"
              value={newCommentText}
              onChange={(e) => setNewCommentNewText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSaveComment();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCommentDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveComment}>Pin Comment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
