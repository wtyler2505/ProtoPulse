/* eslint-disable jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-static-element-interactions --
 * Phase 3 <InteractiveCard> primitive migration will replace `role="button"` on
 * `<div>` elements with real `<button>` elements, at which point these disables
 * can be removed. See docs/superpowers/plans/2026-04-18-e2e-walkthrough/03-a11y-systemic.md
 * Phase 3. Tracked as part of E2E-552 / Plan 03 Phase 4.
 */
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

import { useState, useCallback, useMemo, useRef, useEffect, useSyncExternalStore } from 'react';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { useProjectBoard } from '@/hooks/useProjectBoard';
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
  useDeleteCircuitInstance,
  useUpdateCircuitDesign,
  usePcbZones,
  useCreatePcbZone,
  useUpdatePcbZone,
  useDeletePcbZone,
  useComments,
  useCreateComment,
  useUpdateCommentStatus,
  useDeleteComment,
} from '@/lib/circuit-editor/hooks';
import { useUndoRedo } from '@/lib/undo-redo-context';
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
import { NumberInput } from '@/components/ui/number-input';
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
  ShieldCheck,
  ShieldAlert,
  Pentagon,
  MessageSquarePlus,
  Scissors,
  Box,
  Cable,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
} from '@/components/ui/context-menu';
import RadialCommandLinearMenu from '@/components/ui/RadialCommandLinearMenu';
import {
  getLinearActionsForContext,
  RADIAL_COMMAND_EVENT,
  RADIAL_COMMAND_PREVIEW_EVENT,
  type MenuContext,
  type RadialCommandEventDetail,
  type RadialCommandPreviewEventDetail,
} from '@/lib/radial-menu-actions';
import {
  getRadialAiDeliveryVerb,
  getRadialAiPromptDelivery,
  runRadialAiCommand,
  type RadialAiPromptDelivery,
} from '@/lib/radial-ai-commands';
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
import { useProjectMeta } from '@/lib/project-context';
import { useBoardStackup } from '@/lib/board-stackup';
import { calculateRoutingStatus } from '@/lib/pcb/routing-status';
import {
  PCB_RUN_DRC_EVENT,
  getPcbSurfaceSafetyGate,
  getPcbSurfaceStatus,
  type PcbRunDrcEventDetail,
  type PcbSurfaceSafetyGate,
  type PcbSurfaceStatus,
} from '@/lib/pcb/pcb-surface-status';
import type { Via, ViaType } from '@/lib/pcb/via-model';
import type { CircuitDesignRow, CircuitInstanceRow, CircuitNetRow, CircuitWireRow, CircuitViaRow } from '@shared/schema';
import CollaborationCursors, { useCursorEmitter } from './CollaborationCursors';
import type { CollaborationClient } from '@/lib/collaboration-client';
import { useDfmHighlights } from '@/lib/dfm-pcb-bridge';
import { logger } from '@/lib/logger';
import { SurfaceStatusDock } from '@/components/ui/SurfaceStatusDock';

// ---------------------------------------------------------------------------
// View3DButton — jumps to viewer_3d ViewMode
// ---------------------------------------------------------------------------

function View3DButton() {
  const { setActiveView } = useProjectMeta();
  return (
    <button
      data-testid="pcb-view-3d"
      onClick={() => { setActiveView('viewer_3d'); }}
      title="View in 3D"
      aria-label="View in 3D"
      className={cn(
        'h-6 px-2 flex items-center gap-1 rounded text-[10px] font-medium transition-colors cursor-pointer',
        'border border-border text-muted-foreground hover:text-foreground hover:bg-muted/60',
      )}
    >
      <Box className="w-3.5 h-3.5" />
      3D
    </button>
  );
}

// ---------------------------------------------------------------------------
// RoutingStatusBadge — shows routed/total nets
// ---------------------------------------------------------------------------

function RoutingStatusBadge({ nets, wires }: { nets: CircuitNetRow[]; wires: CircuitWireRow[] }) {
  const status = useMemo(() => calculateRoutingStatus(nets, wires), [nets, wires]);

  if (status.total === 0) {
    return null;
  }

  const isComplete = status.routed === status.total;

  return (
    <StyledTooltip
      content={
        <div className="text-xs">
          <div className="font-medium mb-1">Routing Progress</div>
          <div>{status.routed}/{status.total} nets routed ({status.percentComplete}%)</div>
          {status.unrouted > 0 && (
            <div className="text-yellow-400 mt-0.5">{status.unrouted} unrouted</div>
          )}
        </div>
      }
    >
      <span
        data-testid="pcb-routing-status"
        className={cn(
          'inline-flex items-center gap-1 h-5 px-1.5 rounded text-[10px] font-medium tabular-nums',
          isComplete
            ? 'bg-green-500/15 text-green-400 border border-green-500/30'
            : 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
        )}
      >
        {status.routed}/{status.total}
      </span>
    </StyledTooltip>
  );
}

export function PcbSurfaceStatusDock({
  status,
  safetyGate,
  collapsed,
  onToggle,
  onRunDrc,
}: {
  status: PcbSurfaceStatus;
  safetyGate: PcbSurfaceSafetyGate;
  collapsed: boolean;
  onToggle: () => void;
  onRunDrc: () => void;
}) {
  const routingLabel = status.totalNets === 0
    ? 'No nets'
    : `${String(status.routedCount)}/${String(status.totalNets)}`;
  const routingIsComplete = status.totalNets > 0 && status.routedCount === status.totalNets;
  const gateClassName = safetyGate.severity === 'clear'
    ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100'
    : safetyGate.severity === 'warning'
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
      : 'border-destructive/45 bg-destructive/10 text-destructive-foreground';
  const gateIconClassName = safetyGate.severity === 'clear'
    ? 'text-emerald-300'
    : safetyGate.severity === 'warning'
      ? 'text-amber-200'
      : 'text-destructive';

  return (
    <div className="pointer-events-none absolute left-36 right-2 top-2 z-20 flex justify-end max-[420px]:left-2 max-[420px]:top-40">
      <SurfaceStatusDock
        ariaLabel="PCB surface provenance status"
        title="PCB fabrication surface"
        origin={status.originLabel}
        trustKind={status.trustKind}
        trustLabel={status.trustLabel}
        collapsed={collapsed}
        onToggle={onToggle}
        bodyTestId="pcb-surface-detail"
        testId="pcb-surface-status"
        titleTestId="pcb-surface-title"
        originTestId="pcb-surface-origin"
        toggleTestId="button-toggle-pcb-surface-status"
      >
        <div
          className={cn('rounded border px-2 py-1.5', gateClassName)}
          data-testid="pcb-surface-drc-gate"
          data-severity={safetyGate.severity}
          data-blocks-fabrication={String(safetyGate.blocksFabrication)}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <ShieldAlert className={cn('h-3.5 w-3.5 shrink-0', gateIconClassName)} />
              <p className="truncate font-medium" data-testid="pcb-surface-drc-gate-label">
                {safetyGate.label}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 min-h-0 shrink-0 gap-1 rounded-sm px-2 text-[10px]"
              data-testid="button-pcb-surface-run-drc"
              aria-label={safetyGate.actionLabel}
              onClick={onRunDrc}
            >
              <ShieldCheck className="mr-1 h-3 w-3" />
              DRC
            </Button>
          </div>
          <p className="mt-1 leading-snug" data-testid="pcb-surface-drc-gate-summary">
            {safetyGate.summary}
          </p>
          <p className="mt-1 leading-snug opacity-85" data-testid="pcb-surface-drc-gate-reasons">
            {safetyGate.reasons.join('; ')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <div className="rounded border border-border/70 bg-muted/25 px-2 py-1">
            <p className="text-muted-foreground">Placed</p>
            <p className="font-medium text-foreground" data-testid="pcb-surface-placed-count">
              {String(status.placedCount)}/{String(status.instanceCount)}
            </p>
          </div>
          <div className="rounded border border-border/70 bg-muted/25 px-2 py-1">
            <p className="text-muted-foreground">Routing</p>
            <p
              className={cn('font-medium', routingIsComplete ? 'text-emerald-300' : 'text-amber-200')}
              data-testid="pcb-surface-routing-state"
            >
              {routingLabel}
            </p>
          </div>
          <div className="rounded border border-border/70 bg-muted/25 px-2 py-1">
            <p className="text-muted-foreground">Board</p>
            <p className="font-medium text-foreground" data-testid="pcb-surface-board-size">
              {status.boardSizeLabel}
            </p>
          </div>
          <div className="rounded border border-border/70 bg-muted/25 px-2 py-1">
            <p className="text-muted-foreground">Flags</p>
            <p className="font-medium text-foreground" data-testid="pcb-surface-provenance-flags">
              {status.provenanceFlagLabel}
            </p>
          </div>
        </div>
        <p className="leading-snug text-muted-foreground" data-testid="pcb-surface-trust-summary">
          {status.trustSummary}
        </p>
      </SurfaceStatusDock>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Clipboard bundle type for PCB copy/paste
// ---------------------------------------------------------------------------

interface PcbClipboardInstance {
  partId: number | null;
  referenceDesignator: string;
  pcbX: number | null;
  pcbY: number | null;
  pcbRotation: number | null;
  pcbSide: string | null;
  properties: unknown;
  oldId: number;
}

interface PcbClipboardBundle {
  type: 'protopulse-pcb-bundle';
  instances: PcbClipboardInstance[];
}

// ---------------------------------------------------------------------------
// Top-level view (circuit selector + canvas)
// ---------------------------------------------------------------------------

export default function PCBLayoutView({ collaborationClient = null }: { collaborationClient?: CollaborationClient | null }) {
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
      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-border bg-card/60 px-2.5 backdrop-blur-xl">
        <Select value={String(activeCircuit?.id ?? '')} onValueChange={(v) => setActiveCircuitId(Number(v))}>
          <SelectTrigger className="h-6.5 w-44 text-[11px]" data-testid="select-pcb-circuit">
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
        <span className="text-[11px] text-muted-foreground">
          {activeCircuit ? activeCircuit.name : 'No circuit selected'} — PCB Layout
        </span>
      </div>
      {activeCircuit && <PCBCanvas circuitId={activeCircuit.id} projectId={projectId} circuitSettings={activeCircuit.settings} collaborationClient={collaborationClient} />}
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
          stroke="var(--color-editor-accent)"
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

interface PcbRadialAdapterPreview {
  commandId: string;
  board: { x: number; y: number };
  targetId?: string;
  targetLabel?: string;
}

function PCBCanvas({ circuitId, projectId, circuitSettings, collaborationClient = null }: { circuitId: number; projectId: number; circuitSettings: unknown; collaborationClient?: CollaborationClient | null }) {
  // --- Data hooks ---
  const { data: instances } = useCircuitInstances(circuitId);
  const { data: nets } = useCircuitNets(circuitId);
  const { data: wires } = useCircuitWires(circuitId);
  const { data: circuitVias } = useCircuitVias(circuitId);
  const { data: zones } = usePcbZones(projectId);
  const { data: commentResult } = useComments(projectId, { targetType: 'spatial', status: 'open' });
  // Plan 02 Phase 4 / E2E-228: shared per-project board source of truth. Width
  // and height flow from here so PcbOrderingView + BoardViewer3DView see the
  // same numbers. Legacy per-circuit settings keys are preserved for now to
  // reduce blast radius — a follow-up will delete the circuit-settings write.
  const { board: projectBoard, updateBoard } = useProjectBoard(projectId);
  const comments = commentResult?.data ?? [];

  // Plan 02 Phase 6 / E2E-233: the layer-visibility panel (LayerStackPanel)
  // reads from the BoardStackup singleton. When the shared project board's
  // `layers` field (Plan 02 Phase 4) changes — or when the stackup is empty
  // on first mount — sync the stackup so the panel renders one toggle row
  // per copper layer instead of just top/bottom. Guarded by a length check
  // so user-initiated stackup edits (add/remove via the panel itself) don't
  // fight the board value.
  const { layers: stackupLayers, applyLayerCount: syncStackupLayerCount } = useBoardStackup();
  useEffect(() => {
    if (projectBoard.id <= 0) { return; }
    const targetCount = projectBoard.layers;
    if (targetCount > 0 && stackupLayers.length !== targetCount) {
      syncStackupLayerCount(targetCount);
    }
    // Only react to server board changes and current stackup length — not
    // syncStackupLayerCount identity (it's a stable useCallback).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectBoard.id, projectBoard.layers, stackupLayers.length]);

  const createWireMutation = useCreateCircuitWire();
  const deleteWireMutation = useDeleteCircuitWire();
  const createInstanceMutation = useCreateCircuitInstance();
  const deleteInstanceMutation = useDeleteCircuitInstance();
  const updateDesignMutation = useUpdateCircuitDesign();
  const createZoneMutation = useCreatePcbZone();
  const deleteZoneMutation = useDeletePcbZone();
  const createCommentMutation = useCreateComment();
  const updateCommentStatusMutation = useUpdateCommentStatus();
  const deleteCommentMutation = useDeleteComment();
  const updateInstanceMutation = useUpdateCircuitInstance();

  const { toast } = useToast();

  // --- DFM highlight overlay (BL-0572) ---
  const { highlight: dfmHighlight } = useDfmHighlights();

  // --- Undo/Redo ---
  const { push: pushUndo } = useUndoRedo();

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
  const [surfaceStatusCollapsed, setSurfaceStatusCollapsed] = useState(false);
  const [radialAdapterPreview, setRadialAdapterPreview] = useState<PcbRadialAdapterPreview | null>(null);

  // New comment dialog state
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [newCommentPos, setNewCommentPos] = useState<{ x: number; y: number } | null>(null);
  const [newCommentText, setNewCommentNewText] = useState('');
  const [traceWidth, setTraceWidth] = useState(DEFAULT_TRACE_WIDTH);
  const [tracePoints, setTracePoints] = useState<Array<{ x: number; y: number }>>([]);
  const [zonePoints, setZonePoints] = useState<Array<{ x: number; y: number }>>([]);
  // Board dimensions — prefer the shared per-project board (Plan 02 Phase 4).
  // Fall back to legacy per-circuit settings if the shared row hasn't loaded
  // yet (e.g. first paint) or a legacy project still has only circuit-scoped
  // dims.
  const savedSettings = circuitSettings as Record<string, unknown> | null;
  const [boardWidth, setBoardWidth] = useState(() => {
    if (projectBoard.id > 0 && projectBoard.widthMm > 0) { return projectBoard.widthMm; }
    const saved = savedSettings?.pcbBoardWidth;
    return typeof saved === 'number' && saved > 0 ? saved : DEFAULT_BOARD.width;
  });
  const [boardHeight, setBoardHeight] = useState(() => {
    if (projectBoard.id > 0 && projectBoard.heightMm > 0) { return projectBoard.heightMm; }
    const saved = savedSettings?.pcbBoardHeight;
    return typeof saved === 'number' && saved > 0 ? saved : DEFAULT_BOARD.height;
  });

  // Sync: when the shared board updates from elsewhere (3D viewer, order form),
  // reflect that here.
  useEffect(() => {
    if (projectBoard.id > 0) {
      if (projectBoard.widthMm !== boardWidth) { setBoardWidth(projectBoard.widthMm); }
      if (projectBoard.heightMm !== boardHeight) { setBoardHeight(projectBoard.heightMm); }
    }
    // boardWidth/boardHeight intentionally omitted — we only want this to fire
    // when the server row changes, not on every local edit (which would fight
    // itself during typing).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectBoard.id, projectBoard.widthMm, projectBoard.heightMm]);
  const [mouseBoardPos, setMouseBoardPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedViaId, setSelectedViaId] = useState<string | null>(null);

  // BL-0525: Collaboration cursor emitter
  const emitCursor = useCursorEmitter(collaborationClient, 'pcb');

  // BL-0525: Emit cursor position when mouse moves on PCB canvas
  useEffect(() => {
    if (mouseBoardPos) {
      emitCursor(mouseBoardPos.x, mouseBoardPos.y);
    }
  }, [mouseBoardPos, emitCursor]);

  // Marquee selection state
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const selectionStateRef = useRef<SelectionDragState>({ isDragging: false, origin: { x: 0, y: 0 } });

  // Clipboard state
  const clipboardRef = useRef<PcbClipboardBundle | null>(null);

  // --- Persist board dimensions to circuit settings (debounced) ---
  const boardDimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    // Skip if dimensions match what was loaded from settings
    const currentSaved = circuitSettings as Record<string, unknown> | null;
    const savedW = typeof currentSaved?.pcbBoardWidth === 'number' ? currentSaved.pcbBoardWidth : DEFAULT_BOARD.width;
    const savedH = typeof currentSaved?.pcbBoardHeight === 'number' ? currentSaved.pcbBoardHeight : DEFAULT_BOARD.height;
    if (boardWidth === savedW && boardHeight === savedH) {
      return;
    }
    if (boardDimTimerRef.current) {
      clearTimeout(boardDimTimerRef.current);
    }
    boardDimTimerRef.current = setTimeout(() => {
      const mergedSettings = { ...(currentSaved ?? {}), pcbBoardWidth: boardWidth, pcbBoardHeight: boardHeight };
      updateDesignMutation.mutate({ projectId, id: circuitId, settings: mergedSettings });
      // Plan 02 Phase 4: mirror to the shared per-project board so the 3D
      // viewer and order form see the same dimensions. Fire-and-forget; the
      // optimistic UX path lives inside useProjectBoard.
      if (projectId > 0) {
        void updateBoard({ widthMm: boardWidth, heightMm: boardHeight }).catch(() => undefined);
      }
    }, 500);
    return () => {
      if (boardDimTimerRef.current) {
        clearTimeout(boardDimTimerRef.current);
      }
    };
  }, [boardWidth, boardHeight, circuitId, projectId, circuitSettings, updateDesignMutation, updateBoard]);

  // --- Refs ---
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panStateRef = useRef<PanState>({ isPanning: false, lastMouse: { x: 0, y: 0 } });

  const clientToBoardPoint = useCallback((point: { x: number; y: number }) => {
    const el = containerRef.current;
    const rect = el?.getBoundingClientRect();
    return {
      x: (point.x - (rect?.left ?? 0) - panOffset.x) / zoom,
      y: (point.y - (rect?.top ?? 0) - panOffset.y) / zoom,
    };
  }, [panOffset.x, panOffset.y, zoom]);

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
  const pcbSurfaceStatus = useMemo(
    () => getPcbSurfaceStatus({
      instances: instances ?? [],
      nets: nets ?? [],
      wires: pcbWires,
      boardWidth,
      boardHeight,
    }),
    [instances, nets, pcbWires, boardWidth, boardHeight],
  );
  const pcbSurfaceSafetyGate = useMemo(
    () => getPcbSurfaceSafetyGate(pcbSurfaceStatus),
    [pcbSurfaceStatus],
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
      setInstanceRotation: (instanceId: number, rotation: number) => {
        updateInstanceMutation.mutate({ circuitId, id: instanceId, pcbRotation: rotation });
      },
      setSelectionRect,
    }),
    [],
  );

  const handleCopy = useCallback(async () => {
    const selectedIds = selectedInstanceIds.length > 0 ? selectedInstanceIds : (selectedInstanceId ? [selectedInstanceId] : []);
    if (selectedIds.length === 0) return;

    const bundle: PcbClipboardBundle = {
      type: 'protopulse-pcb-bundle' as const,
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
      logger.error('Copy failed', err);
    }
  }, [selectedInstanceIds, selectedInstanceId, instances, toast]);

  const handlePaste = useCallback(async (bundle: PcbClipboardBundle | null) => {
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

    const allX = insts.map((i: PcbClipboardInstance) => i.pcbX ?? 0);
    const allY = insts.map((i: PcbClipboardInstance) => i.pcbY ?? 0);
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
          pcbSide: (inst.pcbSide as 'front' | 'back') ?? undefined,
          properties: (inst.properties as Record<string, string>) ?? undefined,
        });
      }
      toast({ title: 'Pasted successfully', description: `Added ${insts.length} components.` });
    } catch (err) {
      logger.error('Paste failed', err);
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
        createWire: (params) => {
          createWireMutation.mutate(params, {
            onSuccess: (createdWire: CircuitWireRow) => {
              pushUndo({
                type: 'create-wire',
                description: `Add trace (${tracePoints.length} points)`,
                async execute() {
                  await createWireMutation.mutateAsync(params);
                },
                async undo() {
                  await deleteWireMutation.mutateAsync({ circuitId, id: createdWire.id });
                },
              });
            },
          });
        },
      }, () => setTracePoints([]));
      return;
    }
  }, [tool, zonePoints, projectId, activeLayer, createZoneMutation, toast, tracePoints, circuitId, traceWidth, nets, createWireMutation, deleteWireMutation, pushUndo]);

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
        deleteWire: (params) => {
          // Capture wire data before deletion for undo
          const deletedWire = pcbWires.find((w) => w.id === params.id);
          deleteWireMutation.mutate(params, {
            onSuccess: () => {
              if (deletedWire) {
                pushUndo({
                  type: 'delete-wire',
                  description: 'Delete trace',
                  async execute() {
                    await deleteWireMutation.mutateAsync(params);
                  },
                  async undo() {
                    await createWireMutation.mutateAsync({
                      circuitId: deletedWire.circuitId,
                      netId: deletedWire.netId ?? undefined,
                      view: deletedWire.view,
                      layer: deletedWire.layer ?? undefined,
                      points: deletedWire.points as Array<{ x: number; y: number }>,
                      width: deletedWire.width,
                    });
                  },
                });
              }
            },
          });
        },
      }, callbacks, selectedInstanceId, tool, selectedInstanceRotation);
    },
    [selectedWireId, circuitId, deleteWireMutation, createWireMutation, pushUndo, pcbWires, callbacks, selectedInstanceId, tool, selectedInstanceRotation, handleCopy, triggerPaste, selectedZoneId, deleteZoneMutation, projectId],
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

  const handleCtxRunDrc = useCallback(() => {
    const detail: PcbRunDrcEventDetail = {
      source: 'pcb-layout',
      surfaceStatus: pcbSurfaceStatus,
      safetyGate: pcbSurfaceSafetyGate,
    };
    window.dispatchEvent(new CustomEvent(PCB_RUN_DRC_EVENT, { detail }));
  }, [pcbSurfaceSafetyGate, pcbSurfaceStatus]);

  const handleCtxZoomToFit = useCallback(() => {
    setZoom(DEFAULT_ZOOM);
    setPanOffset(DEFAULT_PAN);
  }, []);

  const handleCtxSelectAll = useCallback(() => {
    const placedIds = (instances ?? [])
      .filter((instance) => instance.pcbX != null && instance.pcbY != null)
      .map((instance) => instance.id);
    setSelectedInstanceId(null);
    setSelectedInstanceIds(placedIds);
    setSelectedWireId(null);
    setSelectedZoneId(null);
    setSelectedCommentId(null);
  }, [instances]);

  const getCommandInstance = useCallback((context?: MenuContext): CircuitInstanceRow | null => {
    const contextId = context?.targetId != null ? Number(context.targetId) : NaN;
    const targetId = Number.isFinite(contextId) ? contextId : selectedInstanceId;
    return (instances ?? []).find((instance) => instance.id === targetId) ?? null;
  }, [instances, selectedInstanceId]);

  const pcbLinearContext = useMemo<MenuContext>(() => {
    const selectedInstance = selectedInstanceId != null
      ? (instances ?? []).find((instance) => instance.id === selectedInstanceId)
      : null;
    return {
      view: 'pcb',
      target: selectedInstance ? 'node' : 'canvas',
      targetId: selectedInstance ? String(selectedInstance.id) : undefined,
      targetLabel: selectedInstance?.referenceDesignator,
    };
  }, [instances, selectedInstanceId]);

  const pcbLinearActions = useMemo(
    () => getLinearActionsForContext(pcbLinearContext),
    [pcbLinearContext],
  );

  const handleAiPcbReview = useCallback((
    context: MenuContext,
    delivery: RadialAiPromptDelivery = 'draft',
  ): void => {
    const commandInstance = getCommandInstance(context);
    const placedInstances = (instances ?? []).filter((instance) => instance.pcbX != null && instance.pcbY != null);
    const targetLabel = context.targetLabel ?? commandInstance?.referenceDesignator;
    const deliveryVerb = getRadialAiDeliveryVerb(delivery);
    const sections = [
      {
        title: 'Placed footprints',
        lines: placedInstances
          .slice(0, 10)
          .map((instance) =>
            `${instance.referenceDesignator} id=${String(instance.id)} side=${instance.pcbSide ?? 'front'} x=${String(instance.pcbX ?? 'unset')} y=${String(instance.pcbY ?? 'unset')} rotation=${String(instance.pcbRotation ?? 0)}`,
          ),
      },
      {
        title: 'Known nets',
        lines: (nets ?? []).slice(0, 10).map((net) => `${net.name ?? `net-${String(net.id)}`} id=${String(net.id)}`),
      },
      {
        title: 'Routed traces',
        lines: pcbWires
          .slice(0, 8)
          .map((wire) => `wire ${String(wire.id)} net=${String(wire.netId ?? 'unknown')} layer=${wire.layer ?? activeLayer} width=${String(wire.width ?? traceWidth)}`),
      },
      {
        title: 'Board status',
        lines: [
          `Trust: ${pcbSurfaceStatus.trustLabel}`,
          `Summary: ${pcbSurfaceStatus.trustSummary}`,
          `Safety gate: ${pcbSurfaceSafetyGate.label} (${pcbSurfaceSafetyGate.severity})`,
          `Gate summary: ${pcbSurfaceSafetyGate.summary}`,
          ...pcbSurfaceSafetyGate.reasons.slice(0, 5),
        ],
      },
    ].filter((section) => section.lines.length > 0);

    runRadialAiCommand({
      intent: 'review_pcb',
      intro:
        'Review this PCB context like a practical board-layout and DFM reviewer. Focus on placement, routing, clearance, layer usage, manufacturability, and what Tyler should fix next.',
      summary: `PCB review: ${String(placedInstances.length)} placed footprint(s), ${String(nets?.length ?? 0)} net(s), ${String(pcbWires.length)} routed trace(s), ${String(zones?.length ?? 0)} zone(s), ${String(projectBoard.layers)} layer(s).`,
      historyLabel: targetLabel ? `PCB review: ${targetLabel}` : 'PCB review',
      context,
      delivery,
      targetDetails: [
        `Board: ${String(boardWidth)}mm x ${String(boardHeight)}mm, ${String(projectBoard.layers)} layer(s), active layer ${activeLayer}.`,
        commandInstance
          ? `Target footprint: ${commandInstance.referenceDesignator} id=${String(commandInstance.id)} side=${commandInstance.pcbSide ?? 'front'} x=${String(commandInstance.pcbX ?? 'unset')} y=${String(commandInstance.pcbY ?? 'unset')}.`
          : 'Target: PCB canvas',
      ],
      sections,
      finalInstruction:
        'Give Tyler a concise board review with exact DRC/DFM risks, what to inspect manually, and the next layout move.',
    });
    toast({
      title: `AI PCB Review ${deliveryVerb}`,
      description: targetLabel
        ? `${deliveryVerb} ${targetLabel} PCB prompt ${delivery === 'send-now' ? 'to' : 'in'} AI chat.`
        : `${deliveryVerb} PCB prompt ${delivery === 'send-now' ? 'to' : 'in'} AI chat.`,
    });
  }, [
    activeLayer,
    boardHeight,
    boardWidth,
    getCommandInstance,
    instances,
    nets,
    pcbSurfaceSafetyGate.reasons,
    pcbSurfaceSafetyGate.label,
    pcbSurfaceSafetyGate.severity,
    pcbSurfaceSafetyGate.summary,
    pcbSurfaceStatus.trustLabel,
    pcbSurfaceStatus.trustSummary,
    pcbWires,
    projectBoard.layers,
    toast,
    traceWidth,
    zones?.length,
  ]);

  const handlePcbCommand = useCallback((
    commandId: string,
    context: MenuContext = pcbLinearContext,
    delivery: RadialAiPromptDelivery = 'draft',
  ): boolean => {
    const commandInstance = getCommandInstance(context);

    switch (commandId) {
      case 'ai_pcb_review':
        handleAiPcbReview(context, delivery);
        return true;
      case 'add_via':
        setTool('via');
        return true;
      case 'route_trace':
        if (commandInstance) {
          setSelectedInstanceId(commandInstance.id);
          setSelectedInstanceIds([]);
        }
        setTool('trace');
        return true;
      case 'add_pour':
        setTool('pour');
        return true;
      case 'add_keepout':
        setTool('keepout');
        return true;
      case 'add_comment':
        setTool('comment');
        return true;
      case 'measure':
        setTool('select');
        toast({
          title: 'Measure ready',
          description: 'Move over the PCB canvas and use the coordinate readout while measuring geometry.',
        });
        return true;
      case 'run_drc':
        handleCtxRunDrc();
        return true;
      case 'fit_view':
        handleCtxZoomToFit();
        return true;
      case 'select_all':
        handleCtxSelectAll();
        return true;
      case 'copy':
        void handleCopy();
        return true;
      case 'paste':
        void triggerPaste();
        return true;
      case 'rotate':
        if (!commandInstance) { return false; }
        setSelectedInstanceId(commandInstance.id);
        setSelectedInstanceIds([]);
        updateInstanceMutation.mutate({
          circuitId,
          id: commandInstance.id,
          pcbRotation: ((commandInstance.pcbRotation ?? 0) + 90) % 360,
        });
        return true;
      case 'flip_side':
        if (!commandInstance) { return false; }
        setSelectedInstanceId(commandInstance.id);
        setSelectedInstanceIds([]);
        updateInstanceMutation.mutate({
          circuitId,
          id: commandInstance.id,
          pcbSide: commandInstance.pcbSide === 'back' ? 'front' : 'back',
        });
        return true;
      case 'delete':
        if (!commandInstance) { return false; }
        deleteInstanceMutation.mutate({ circuitId, id: commandInstance.id });
        setSelectedInstanceId(null);
        setSelectedInstanceIds((ids) => ids.filter((id) => id !== commandInstance.id));
        return true;
      default:
        return false;
    }
  }, [
    circuitId,
    deleteInstanceMutation,
    getCommandInstance,
    handleCopy,
    handleAiPcbReview,
    handleCtxRunDrc,
    handleCtxSelectAll,
    handleCtxZoomToFit,
    pcbLinearContext,
    toast,
    triggerPaste,
    updateInstanceMutation,
  ]);

  useEffect(() => {
    const handleRadialCommand = (event: Event) => {
      if (!(event instanceof CustomEvent)) { return; }
      const detail = event.detail as RadialCommandEventDetail | undefined;
      if (!detail || detail.context.view !== 'pcb') { return; }

      if (handlePcbCommand(detail.commandId, detail.context, getRadialAiPromptDelivery(detail))) {
        detail.handled = true;
      }
    };

    window.addEventListener(RADIAL_COMMAND_EVENT, handleRadialCommand);
    return () => window.removeEventListener(RADIAL_COMMAND_EVENT, handleRadialCommand);
  }, [handlePcbCommand]);

  useEffect(() => {
    const handleRadialPreview = (event: Event) => {
      if (!(event instanceof CustomEvent)) { return; }
      const detail = event.detail as RadialCommandPreviewEventDetail | undefined;
      if (!detail || detail.phase === 'clear' || detail.context?.view !== 'pcb') {
        setRadialAdapterPreview(null);
        return;
      }
      if (!detail.commandId || !detail.context.pointer) {
        setRadialAdapterPreview(null);
        return;
      }

      setRadialAdapterPreview({
        commandId: detail.commandId,
        board: clientToBoardPoint(detail.context.pointer),
        targetId: detail.context.targetId,
        targetLabel: detail.context.targetLabel,
      });
    };

    window.addEventListener(RADIAL_COMMAND_PREVIEW_EVENT, handleRadialPreview);
    return () => window.removeEventListener(RADIAL_COMMAND_PREVIEW_EVENT, handleRadialPreview);
  }, [clientToBoardPoint]);

  const radialPreviewInstance = useMemo(() => {
    if (!radialAdapterPreview?.targetId) {
      return null;
    }
    const targetId = Number(radialAdapterPreview.targetId);
    if (!Number.isFinite(targetId)) {
      return null;
    }
    return (instances ?? []).find((instance) => instance.id === targetId) ?? null;
  }, [instances, radialAdapterPreview?.targetId]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex h-7.5 shrink-0 items-center gap-0.5 border-b border-border bg-card/40 px-1.5">
        <ToolButton icon={MousePointer2} label="Select (1)" active={tool === 'select'} onClick={() => setTool('select')} testId="pcb-tool-select" />
        <ToolButton icon={Pencil} label="Trace (2)" active={tool === 'trace'} onClick={() => setTool('trace')} testId="pcb-tool-trace" />
        <ToolButton icon={Trash2} label="Delete (3)" active={tool === 'delete'} onClick={() => setTool('delete')} testId="pcb-tool-delete" />
        <ToolButton icon={Circle} label="Via (4)" active={tool === 'via'} onClick={() => setTool('via')} testId="pcb-tool-via" />
        <div className="mx-0.5 h-4 w-px bg-border" />
        <ToolButton icon={Pentagon} label="Pour (P)" active={tool === 'pour'} onClick={() => setTool('pour')} testId="pcb-tool-pour" />
        <ToolButton icon={ShieldAlert} label="Keepout (K)" active={tool === 'keepout'} onClick={() => setTool('keepout')} testId="pcb-tool-keepout" />
        <ToolButton icon={ShieldCheck} label="Keepin" active={tool === 'keepin'} onClick={() => setTool('keepin')} testId="pcb-tool-keepin" />
        <ToolButton icon={Scissors} label="Cutout (X)" active={tool === 'cutout'} onClick={() => setTool('cutout')} testId="pcb-tool-cutout" />
        <ToolButton icon={Cable} label="Diff Pair (D)" active={tool === 'diff-pair'} onClick={() => setTool('diff-pair')} testId="pcb-tool-diff-pair" />
        <ToolButton icon={MessageSquarePlus} label="Comment (C)" active={tool === 'comment'} onClick={() => setTool('comment')} testId="pcb-tool-comment" />
        <div className="mx-0.5 h-4 w-px bg-border" />
        <button
          data-testid="pcb-layer-toggle"
          onClick={() => setActiveLayer(toggleLayer)}
          title="Toggle copper layer (F) — Click to switch between Front and Back"
          aria-label={`Active layer: ${activeLayer === 'front' ? 'Front Copper' : 'Back Copper'}. Click to toggle.`}
          className={cn(
            'flex h-6.5 cursor-pointer items-center gap-1 rounded border px-2 text-[10px] font-medium transition-colors hover:brightness-125',
            layerToggleClasses(activeLayer),
          )}
        >
          <FlipHorizontal className="w-3 h-3" />
          {layerLabel(activeLayer)}
          <svg className="w-2.5 h-2.5 opacity-60" viewBox="0 0 10 10" fill="currentColor"><path d="M2 4l3 3 3-3" /></svg>
        </button>
        <div className="mx-0.5 h-4 w-px bg-border" />
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
        <span className="w-9 text-[10px] tabular-nums text-muted-foreground">{traceWidth.toFixed(1)}mm</span>
        <div className="flex items-center gap-0.5 ml-0.5">
          {TRACE_WIDTH_PRESETS.map((w) => (
            <button
              key={w}
              data-testid={`pcb-trace-preset-${w}`}
              onClick={() => setTraceWidth(w)}
              title={`${w}mm trace width`}
              className={cn(
                'h-5 rounded px-1 text-[9px] tabular-nums transition-colors',
                traceWidth === w
                  ? 'bg-primary/20 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
            >
              {w}
            </button>
          ))}
        </div>
        <div className="mx-0.5 h-4 w-px bg-border" />
        <ToolButton icon={ZoomIn} label="Zoom in" onClick={() => setZoom((z) => clampZoom(z + ZOOM_BUTTON_STEP))} testId="pcb-tool-zoom-in" />
        <ToolButton icon={ZoomOut} label="Zoom out" onClick={() => setZoom((z) => clampZoom(z - ZOOM_BUTTON_STEP))} testId="pcb-tool-zoom-out" />
        <ToolButton icon={RotateCcw} label="Reset view" onClick={() => { setZoom(DEFAULT_ZOOM); setPanOffset(DEFAULT_PAN); }} testId="pcb-tool-reset" />
        <div className="mx-0.5 h-4 w-px bg-border" />
        <span className="text-[10px] text-muted-foreground">Board:</span>
        <NumberInput
          min={10}
          max={500}
          step={5}
          value={boardWidth / 10}
          onChange={(e) => setBoardWidth(Math.max(10, Number(e.target.value)) * 10)}
          className="!w-12 !h-5 !px-1 text-[10px] text-foreground bg-muted/50 border border-border rounded text-center tabular-nums"
          data-testid="pcb-board-width"
          aria-label="Board width (mm)"
          title="Board width (mm)"
        />
        <span className="text-[9px] text-muted-foreground">x</span>
        <NumberInput
          min={10}
          max={500}
          step={5}
          value={boardHeight / 10}
          onChange={(e) => setBoardHeight(Math.max(10, Number(e.target.value)) * 10)}
          className="!w-12 !h-5 !px-1 text-[10px] text-foreground bg-muted/50 border border-border rounded text-center tabular-nums"
          data-testid="pcb-board-height"
          aria-label="Board height (mm)"
          title="Board height (mm)"
        />
        <span className="text-[9px] text-muted-foreground">mm</span>
        <div className="mx-0.5 h-4 w-px bg-border" />
        <RoutingStatusBadge nets={nets ?? []} wires={wires ?? []} />
        <div className="w-px h-4 bg-border mx-1" />
        <View3DButton />
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
                      points={(zone.points as Array<{ x: number; y: number }>).map((p) => `${p.x},${p.y}`).join(' ')}
                      fill={
                        isTeardrop ? layerColor :
                        zone.zoneType === 'pour' ? 'rgba(0, 255, 0, 0.2)' :
                        zone.zoneType === 'keepout' ? 'rgba(255, 0, 0, 0.2)' :
                        zone.zoneType === 'cutout' ? 'rgba(0, 0, 0, 0.6)' :
                        'rgba(0, 0, 255, 0.2)'
                      }
                      stroke={
                        selectedZoneId === zone.id ? 'var(--color-editor-accent)' :
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
                          fill={comment.status === 'resolved' ? "rgba(34, 197, 94, 0.2)" : "rgba(234, 179, 8, 0.2)"}
                          stroke={isSelected ? "var(--color-editor-accent)" : (comment.status === 'resolved' ? "#22c55e" : "#eab308")}
                          strokeWidth={2 / zoom}
                        />
                        <text
                          y={1 / zoom}
                          textAnchor="middle"
                          fontSize={8 / zoom}
                          className="select-none pointer-events-none font-bold"
                          fill={comment.status === 'resolved' ? "#22c55e" : "#eab308"}
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
                      stroke="var(--color-editor-accent)"
                      strokeWidth={2 / zoom}
                    />
                    {/* Preview line to mouse */}
                    {mouseBoardPos && (
                      <line
                        x1={zonePoints[zonePoints.length - 1].x}
                        y1={zonePoints[zonePoints.length - 1].y}
                        x2={mouseBoardPos.x}
                        y2={mouseBoardPos.y}
                        stroke="var(--color-editor-accent)"
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
                        stroke="var(--color-editor-accent)"
                        strokeWidth={1 / zoom}
                        strokeDasharray={`${4/zoom},${4/zoom}`}
                      />
                    )}
                    {zonePoints.map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r={3 / zoom} fill="var(--color-editor-accent)" />
                    ))}
                  </g>
                )}

                <TraceInProgress points={tracePoints} activeLayer={activeLayer} traceWidth={traceWidth} />
                {radialAdapterPreview && (
                  <g
                    data-testid="pcb-radial-adapter-preview"
                    data-command-id={radialAdapterPreview.commandId}
                    data-board-x={Math.round(radialAdapterPreview.board.x)}
                    data-board-y={Math.round(radialAdapterPreview.board.y)}
                    pointerEvents="none"
                  >
                    {radialAdapterPreview.commandId === 'delete' && radialPreviewInstance ? (
                      <g transform={`translate(${radialPreviewInstance.pcbX ?? radialPreviewInstance.schematicX}, ${radialPreviewInstance.pcbY ?? radialPreviewInstance.schematicY})`}>
                        <rect
                          x={-10}
                          y={-8}
                          width={20}
                          height={16}
                          rx={2}
                          fill="rgba(248,113,113,0.14)"
                          stroke="#fca5a5"
                          strokeWidth={2 / zoom}
                          strokeDasharray={`${5 / zoom},${4 / zoom}`}
                        />
                        <line x1={-8} y1={-6} x2={8} y2={6} stroke="#fca5a5" strokeWidth={1.8 / zoom} strokeLinecap="round" />
                        <line x1={8} y1={-6} x2={-8} y2={6} stroke="#fca5a5" strokeWidth={1.8 / zoom} strokeLinecap="round" />
                      </g>
                    ) : radialAdapterPreview.commandId === 'add_via' ? (
                      <g>
                        <circle
                          cx={radialAdapterPreview.board.x}
                          cy={radialAdapterPreview.board.y}
                          r={5 / zoom}
                          fill="rgba(250,204,21,0.16)"
                          stroke="#fde68a"
                          strokeWidth={1.8 / zoom}
                        />
                        <circle
                          cx={radialAdapterPreview.board.x}
                          cy={radialAdapterPreview.board.y}
                          r={2.2 / zoom}
                          fill="rgba(250,204,21,0.3)"
                          stroke="#fde68a"
                          strokeWidth={1 / zoom}
                        />
                      </g>
                    ) : (
                      <g>
                        <polyline
                          points={[
                            `${radialAdapterPreview.board.x},${radialAdapterPreview.board.y}`,
                            `${radialAdapterPreview.board.x + 18},${radialAdapterPreview.board.y}`,
                            `${radialAdapterPreview.board.x + 18},${radialAdapterPreview.board.y - 18}`,
                            `${radialAdapterPreview.board.x + 44},${radialAdapterPreview.board.y - 18}`,
                          ].join(' ')}
                          fill="none"
                          stroke="#67e8f9"
                          strokeWidth={Math.max(traceWidth, 1.5) / zoom}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeDasharray={`${7 / zoom},${5 / zoom}`}
                        />
                        <circle
                          cx={radialAdapterPreview.board.x}
                          cy={radialAdapterPreview.board.y}
                          r={4 / zoom}
                          fill="rgba(34,211,238,0.16)"
                          stroke="#67e8f9"
                          strokeWidth={1.5 / zoom}
                        />
                      </g>
                    )}
                  </g>
                )}
                <ViaOverlay vias={vias} selectedViaId={selectedViaId} onViaClick={(id) => setSelectedViaId(id)} />
                <RatsnestOverlay nets={ratsnestNets} opacity={0.4} showLabels />
                {selectionRect && (
                  <rect
                    x={selectionRect.x}
                    y={selectionRect.y}
                    width={selectionRect.width}
                    height={selectionRect.height}
                    fill="rgba(0, 240, 255, 0.1)"
                    stroke="var(--color-editor-accent)"
                    strokeWidth={1 / zoom}
                    strokeDasharray={`${4 / zoom},${2 / zoom}`}
                  />
                )}

                {/* BL-0572: DFM violation highlight overlay */}
                {dfmHighlight && (
                  <g data-testid="dfm-highlight-overlay">
                    {/* Pulsing ring */}
                    <circle
                      cx={dfmHighlight.x}
                      cy={dfmHighlight.y}
                      r={dfmHighlight.radius}
                      fill="none"
                      stroke={dfmHighlight.severity === 'error' ? '#ef4444' : '#eab308'}
                      strokeWidth={2.5 / zoom}
                      opacity={0.9}
                    >
                      <animate attributeName="r" values={`${dfmHighlight.radius};${dfmHighlight.radius * 1.4};${dfmHighlight.radius}`} dur="1.2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.9;0.3;0.9" dur="1.2s" repeatCount="indefinite" />
                    </circle>
                    {/* Inner fill */}
                    <circle
                      cx={dfmHighlight.x}
                      cy={dfmHighlight.y}
                      r={dfmHighlight.radius * 0.6}
                      fill={dfmHighlight.severity === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(234, 179, 8, 0.15)'}
                      stroke="none"
                    />
                    {/* Label */}
                    <text
                      x={dfmHighlight.x}
                      y={dfmHighlight.y - dfmHighlight.radius - 6 / zoom}
                      textAnchor="middle"
                      fontSize={10 / zoom}
                      fill={dfmHighlight.severity === 'error' ? '#ef4444' : '#eab308'}
                      className="select-none pointer-events-none font-semibold"
                    >
                      DFM: {dfmHighlight.ruleName}
                    </text>
                  </g>
                )}
              </g>
            </svg>
            <PcbSurfaceStatusDock
              status={pcbSurfaceStatus}
              safetyGate={pcbSurfaceSafetyGate}
              collapsed={surfaceStatusCollapsed}
              onToggle={() => setSurfaceStatusCollapsed((value) => !value)}
              onRunDrc={handleCtxRunDrc}
            />
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
            {/* BL-0525: Collaboration presence cursors */}
            <CollaborationCursors client={collaborationClient} view="pcb" zoom={zoom} />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="min-w-[15rem] border-border bg-card/90 backdrop-blur-xl">
          <RadialCommandLinearMenu
            items={pcbLinearActions}
            onSelect={handlePcbCommand}
          />
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
