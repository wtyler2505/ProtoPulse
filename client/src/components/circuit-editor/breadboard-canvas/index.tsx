/* eslint-disable jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-static-element-interactions --
 * Phase 3 <InteractiveCard> primitive migration will replace `role="button"` on
 * `<div>` elements with real `<button>` elements, at which point these disables
 * can be removed. See docs/superpowers/plans/2026-04-18-e2e-walkthrough/03-a11y-systemic.md
 * Phase 3. Tracked as part of E2E-552 / Plan 03 Phase 4.
 */
/**
 * BreadboardCanvas — interactive SVG canvas for the breadboard editor.
 *
 * Extracted from BreadboardView.tsx (audit #32, phase 1).
 * Phase 2 (W1.12b) will split this into sub-files.
 */

import '../breadboard-animations.css';
import '../simulation-overlays.css';
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useProjectId } from '@/lib/contexts/project-id-context';
import {
  useCircuitInstances,
  useCircuitNets,
  useCircuitWires,
  useCreateCircuitNet,
  useCreateCircuitWire,
  useCreateCircuitInstance,
  useDeleteCircuitInstance,
  useDeleteCircuitWire,
  useUpdateCircuitInstance,
  useUpdateCircuitWire,
} from '@/lib/circuit-editor/hooks';
import { useComponentParts } from '@/lib/component-editor/hooks';
import { useSimulation } from '@/lib/contexts/simulation-context';
import BreadboardGrid from '../BreadboardGrid';
import {
  BreadboardComponentOverlay,
  detectFamily,
  getFamilyValues,
  getCurrentValueLabel,
} from '../BreadboardComponentRenderer';
import BendableLegRenderer from '../BendableLegRenderer';
import RatsnestOverlay, { type RatsnestNet, type RatsnestPin } from '../RatsnestOverlay';
import BreadboardConnectivityOverlay from '../BreadboardConnectivityOverlay';
import BreadboardConnectivityExplainer from '../BreadboardConnectivityExplainer';
import { useBreadboardCursor } from '@/lib/circuit-editor/useBreadboardCursor';
import { computeMoveResult } from '@/lib/circuit-editor/breadboard-drag-move';
import { syncSchematicToBreadboard } from '@/lib/circuit-editor/view-sync';
import BreadboardDrcOverlay from '../BreadboardDrcOverlay';
import BreadboardPartInspector from '../BreadboardPartInspector';
import BreadboardWireEditor from '../BreadboardWireEditor';
import BreadboardBenchPartRenderer from '../BreadboardBenchPartRenderer';
import { COMPONENT_DRAG_TYPE } from '../ComponentPlacer';
import {
  getBenchConnectorAnchorPositions,
  type BenchConnectorAnchorPosition,
} from '@/lib/circuit-editor/breadboard-bench-connectors';
import {
  buildBreadboardBenchSummary,
  indexBreadboardBenchInsights,
  type BreadboardBenchInsight,
} from '@/lib/breadboard-bench';
import { buildBreadboardSelectionPrompt, type BreadboardSelectionActionId } from '@/lib/breadboard-ai-prompts';
import {
  buildBreadboardSelectedPartModel,
  type BreadboardSelectedPartModel,
  type BreadboardPinMapEntry,
} from '@/lib/breadboard-part-inspector';
import type { Viewer3DRepairTarget } from '@/lib/viewer-3d-bridge';
import { type BoardAuditIssue, type BoardAuditSummary } from '@/lib/breadboard-board-audit';
import {
  useBreadboardCoachPlan,
  normalizeCoachNetName,
  getStarterRefDesPrefix,
  getCoachHookupColor,
} from '../useBreadboardCoachPlan';
import { BreadboardCoachPlanOverlay, BreadboardPinAnchorOverlay } from '../BreadboardCoachOverlay';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { useToast } from '@/hooks/use-toast';
import {
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
  type RadialAiPromptSection,
} from '@/lib/radial-ai-commands';
import { PROTOPULSE_DRAG_LABEL, PROTOPULSE_DRAG_TYPE } from '@/lib/drag-mime';
import { generateRefDes, nextRefdes } from '@/lib/circuit-editor/ref-des';
import { cn } from '@/lib/utils';
import {
  BB,
  type ColumnLetter,
  type BreadboardCoord,
  type PixelPos,
  coordKey,
  coordToPixel,
  getBoardDimensions,
  pixelToCoord,
  getOccupiedPoints,
  getConnectedPoints,
  checkCollision,
  checkBodyCollision,
  getDefaultColorForNet,
  type ComponentPlacement,
} from '@/lib/circuit-editor/breadboard-model';
import type { CircuitInstanceRow, CircuitWireRow, ComponentPart } from '@shared/schema';
import type { PartMeta } from '@shared/component-types';
import {
  determinePlacementMode,
  pixelToBench,
  type WireEndpoint as SurfaceWireEndpoint,
  type WireEndpointMeta,
} from '@/lib/circuit-editor/bench-surface-model';
import { UndoRedoStack } from '@/lib/undo-redo';
import { formatSIValue } from '@/lib/simulation/visual-state';
import type { WireVisualState } from '@/lib/simulation/visual-state';
import { useCanvasAnnouncer } from '@/lib/use-canvas-announcer';
import {
  getCanvasAriaLabel,
  getActionAnnouncement,
  getToolChangeAnnouncement,
  getZoomAnnouncement,
} from '@/lib/canvas-accessibility';
import {
  buildAutoPlacementTemplate,
  buildPlacementForDrop,
  buildProjectDropInstanceDraft,
  buildStarterDropInstanceDraft,
  findAutoPlacement,
  getCanvasBenchInstances,
  getDropTypeFromPart,
  hasBreadboardDropPayloadType,
  readProjectPartDropData,
  readStarterDropData,
  resolveBoardDropPlacement,
  WIRE_COLORS,
  type AutoPlacementPlan,
  type Tool,
  type WireInProgress,
} from './canvas-helpers';
import { CanvasToolbar } from './CanvasToolbar';
import { CanvasCoordinateReadout } from './CanvasCoordinateReadout';
import { WireColorMenu } from './WireColorMenu';
import { CanvasEmptyGuidance } from './CanvasEmptyGuidance';
import { BreadboardWorkSurfaceStatus } from './BreadboardWorkSurfaceStatus';
import { useCanvasViewport } from './useCanvasViewport';
import { logger } from '@/lib/logger';

const BREADBOARD_DROP_MIME_TYPES = {
  projectPart: COMPONENT_DRAG_TYPE,
  starterType: PROTOPULSE_DRAG_TYPE,
  starterLabel: PROTOPULSE_DRAG_LABEL,
} as const;

function normalizeRepairToken(value: string | number | undefined): string | null {
  if (value == null) {
    return null;
  }
  const normalized = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
  return normalized.length > 0 ? normalized : null;
}

function getRepairPinIndex(value: string | undefined): number | null {
  const normalized = normalizeRepairToken(value);
  if (!normalized) {
    return null;
  }
  const match = normalized.match(/^pin(\d+)$/);
  if (!match) {
    return null;
  }
  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function findDigitalTwinRepairPin(
  selectedModel: BreadboardSelectedPartModel | null,
  target: Viewer3DRepairTarget,
): BreadboardPinMapEntry | null {
  if (!selectedModel) {
    return null;
  }

  const channel = target.channel;
  const tokens = [channel?.pinLabel, channel?.id, channel?.name, channel?.pin]
    .map(normalizeRepairToken)
    .filter((value): value is string => Boolean(value));

  const exactMatch = selectedModel.pins.find((pin) => {
    const pinTokens = [
      normalizeRepairToken(pin.id),
      normalizeRepairToken(pin.label),
      normalizeRepairToken(pin.coordLabel),
    ].filter((value): value is string => Boolean(value));
    return pinTokens.some((pinToken) => tokens.includes(pinToken));
  });

  if (exactMatch) {
    return exactMatch;
  }

  const index = getRepairPinIndex(channel?.pinLabel) ?? getRepairPinIndex(channel?.id);
  return index == null ? null : (selectedModel.pins[index] ?? null);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface BreadboardCanvasProps {
  boardAudit: BoardAuditSummary | null;
  circuitId: number;
  benchInsights: Record<number, BreadboardBenchInsight>;
  digitalTwinRepairTarget?: Viewer3DRepairTarget | null;
  focusAuditIssue: BoardAuditIssue | null;
  onConsumeFocusAuditIssue: () => void;
  onRunBoardAudit: () => void;
  onViewIn3D?: (model: BreadboardSelectedPartModel) => void;
  projectName: string;
}

interface BreadboardRadialAdapterPreview {
  commandId: string;
  point: PixelPos;
  targetId?: string;
  targetLabel?: string;
  geometry?: BreadboardRadialPreviewGeometry;
}

type BreadboardRadialPreviewGeometry =
  | {
      kind: 'part';
      targetId: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | {
      kind: 'wire';
      targetId: string;
      pathD: string;
      strokeWidth: number;
    };

function getNumericMenuTargetId(context?: MenuContext): number | null {
  if (context?.targetId == null) {
    return null;
  }
  const numericId = Number(context.targetId);
  return Number.isFinite(numericId) ? numericId : null;
}

function getWirePreviewPoints(wire: CircuitWireRow): PixelPos[] {
  const points = wire.points as Array<Partial<PixelPos> | null> | null | undefined;
  if (!Array.isArray(points)) {
    return [];
  }
  return points
    .filter(
      (point): point is PixelPos =>
        point != null &&
        typeof point.x === 'number' &&
        Number.isFinite(point.x) &&
        typeof point.y === 'number' &&
        Number.isFinite(point.y),
    )
    .map((point) => ({ x: point.x, y: point.y }));
}

function getWirePreviewPath(points: PixelPos[]): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${String(point.x)} ${String(point.y)}`).join(' ');
}

function getPlacementPreviewBounds(
  placement: ComponentPlacement,
): Pick<Extract<BreadboardRadialPreviewGeometry, { kind: 'part' }>, 'x' | 'y' | 'width' | 'height'> | null {
  const occupiedPixels = getOccupiedPoints(placement).map(coordToPixel);
  if (occupiedPixels.length === 0) {
    return null;
  }

  const minX = Math.min(...occupiedPixels.map((point) => point.x));
  const minY = Math.min(...occupiedPixels.map((point) => point.y));
  const maxX = Math.max(...occupiedPixels.map((point) => point.x));
  const maxY = Math.max(...occupiedPixels.map((point) => point.y));
  const padding = BB.PITCH * 0.62;
  return {
    x: Math.round(minX - padding),
    y: Math.round(minY - padding),
    width: Math.round(maxX - minX + padding * 2),
    height: Math.round(maxY - minY + padding * 2),
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BreadboardCanvas({
  boardAudit,
  circuitId,
  benchInsights,
  digitalTwinRepairTarget,
  focusAuditIssue,
  onConsumeFocusAuditIssue,
  onRunBoardAudit,
  onViewIn3D,
  projectName,
}: BreadboardCanvasProps) {
  const projectId = useProjectId();
  const { data: instances } = useCircuitInstances(circuitId);
  const { data: nets } = useCircuitNets(circuitId);
  const { data: wires } = useCircuitWires(circuitId);
  const { data: parts } = useComponentParts(projectId);
  const { isLive, wireVisualStates, componentVisualStates } = useSimulation();
  const { toast } = useToast();

  const createNetMutation = useCreateCircuitNet();
  const createWireMutation = useCreateCircuitWire();
  const createInstanceMutation = useCreateCircuitInstance();
  const deleteInstanceMutation = useDeleteCircuitInstance();
  const deleteWireMutation = useDeleteCircuitWire();
  const updateInstanceMutation = useUpdateCircuitInstance();
  const updateWireMutation = useUpdateCircuitWire();

  // BL-0326: Screen-reader announcer for canvas actions
  const announce = useCanvasAnnouncer();

  const [tool, setTool] = useState<Tool>('select');
  const [showDrc, setShowDrc] = useState(false);
  const [showConnectivityExplainer, setShowConnectivityExplainer] = useState(false);
  const { cursor, handleKeyDown: handleCursorKeyDown } = useBreadboardCursor();
  const [draggingInstanceId, setDraggingInstanceId] = useState<number | null>(null);
  const {
    zoom,
    panOffset,
    setZoom,
    setPanOffset,
    containerRef,
    svgRef,
    centerOnBoardPixel,
    clientToBoardPixel,
    zoomIn,
    zoomOut,
    resetView,
  } = useCanvasViewport();
  const [hoveredCoord, setHoveredCoord] = useState<BreadboardCoord | null>(null);
  const [highlightedPoints, setHighlightedPoints] = useState<Set<string>>(new Set());
  const [wireInProgress, setWireInProgress] = useState<WireInProgress | null>(null);
  const [selectedWireId, setSelectedWireId] = useState<number | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<number | null>(null);
  const [coachPlanVisible, setCoachPlanVisible] = useState(false);
  const [hoveredInspectorPinId, setHoveredInspectorPinId] = useState<string | null>(null);
  const [mouseBoardPos, setMouseBoardPos] = useState<{ x: number; y: number } | null>(null);
  const [contextMenuWireId, setContextMenuWireId] = useState<number | null>(null);
  const [wireColorMenuPos, setWireColorMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [radialAdapterPreview, setRadialAdapterPreview] = useState<BreadboardRadialAdapterPreview | null>(null);
  const isPanning = useRef(false);
  const lastMouse = useRef<PixelPos>({ x: 0, y: 0 });
  const autoPlacementRequests = useRef<Set<number>>(new Set());
  const undoStack = useRef(new UndoRedoStack());

  const partsMap = useMemo(() => new Map((parts ?? []).map((part: ComponentPart) => [part.id, part])), [parts]);

  // Filter wires to breadboard view only
  const breadboardWires = useMemo(() => (wires ?? []).filter((w: CircuitWireRow) => w.view === 'breadboard'), [wires]);

  // Bench-placed instances (benchX/benchY set, no complete board placement)
  const benchInstances = useMemo(() => getCanvasBenchInstances(instances), [instances]);

  const benchConnectorAnchors = useMemo(
    () =>
      benchInstances.flatMap((inst) =>
        getBenchConnectorAnchorPositions(inst, inst.partId ? partsMap.get(inst.partId) : undefined),
      ),
    [benchInstances, partsMap],
  );

  const getHoleEndpoint = useCallback((point: PixelPos): Extract<SurfaceWireEndpoint, { type: 'hole' }> | null => {
    const coord = pixelToCoord(point);
    if (!coord) {
      return null;
    }

    if (coord.type === 'terminal') {
      return {
        type: 'hole',
        col: coord.col,
        row: coord.row,
      };
    }

    return null;
  }, []);

  const resolveInteractiveWireTarget = useCallback(
    (
      point: PixelPos,
    ): {
      pixel: PixelPos;
      meta: SurfaceWireEndpoint | null;
    } => {
      let closestBenchAnchor: BenchConnectorAnchorPosition | null = null;
      let closestBenchDistance = Number.POSITIVE_INFINITY;

      for (const anchor of benchConnectorAnchors) {
        const distance = Math.hypot(anchor.x - point.x, anchor.y - point.y);
        if (distance <= 12 && distance < closestBenchDistance) {
          closestBenchDistance = distance;
          closestBenchAnchor = anchor;
        }
      }

      if (closestBenchAnchor) {
        return {
          pixel: { x: closestBenchAnchor.x, y: closestBenchAnchor.y },
          meta: {
            type: 'bench-pin',
            instanceId: closestBenchAnchor.instanceId,
            pinId: closestBenchAnchor.pinId,
          },
        };
      }

      const holeEndpoint = getHoleEndpoint(point);
      if (holeEndpoint) {
        return {
          pixel: coordToPixel({ type: 'terminal', col: holeEndpoint.col as ColumnLetter, row: holeEndpoint.row }),
          meta: holeEndpoint,
        };
      }

      return {
        pixel: point,
        meta: null,
      };
    },
    [benchConnectorAnchors, getHoleEndpoint],
  );

  const buildEndpointMeta = useCallback(
    (points: PixelPos[], endpointMeta: Array<SurfaceWireEndpoint | null>): WireEndpointMeta | null => {
      if (points.length < 2 || endpointMeta.length === 0) {
        return null;
      }

      const startMeta = endpointMeta[0] ?? getHoleEndpoint(points[0]);
      const endMeta = endpointMeta[endpointMeta.length - 1] ?? getHoleEndpoint(points[points.length - 1]);
      if (!startMeta || !endMeta) {
        return null;
      }

      return {
        start: startMeta,
        end: endMeta,
      };
    },
    [getHoleEndpoint],
  );

  // Build ComponentPlacement for each placed instance (used by collision + drag-to-place)
  const instancePlacements = useMemo(() => {
    if (!instances) return [];
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
  }, [instances, partsMap]);

  const autoPlacementPlans = useMemo((): AutoPlacementPlan[] => {
    if (!instances || instances.length === 0) return [];

    const plannedPlacements = instancePlacements.map(({ placement }) => placement);
    const plans: AutoPlacementPlan[] = [];

    for (const inst of instances) {
      if (inst.breadboardX != null && inst.breadboardY != null) continue;
      // Skip bench-placed instances — they live outside the breadboard grid
      if (inst.benchX != null && inst.benchY != null) continue;

      const part = inst.partId ? partsMap.get(inst.partId) : undefined;
      const template = buildAutoPlacementTemplate(inst, part);
      const placement = findAutoPlacement(template, plannedPlacements);
      if (!placement) continue;

      plannedPlacements.push(placement);
      const anchor = coordToPixel({ type: 'terminal', col: placement.startCol, row: placement.startRow });
      plans.push({
        id: inst.id,
        breadboardX: anchor.x,
        breadboardY: anchor.y,
      });
    }

    return plans;
  }, [instances, instancePlacements, partsMap]);

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

  useEffect(() => {
    if (!instances) return;

    for (const inst of instances) {
      if (inst.breadboardX != null && inst.breadboardY != null) {
        autoPlacementRequests.current.delete(inst.id);
      }
    }

    autoPlacementRequests.current.forEach((id) => {
      if (!instances.some((inst) => inst.id === id)) {
        autoPlacementRequests.current.delete(id);
      }
    });
  }, [instances]);

  useEffect(() => {
    for (const plan of autoPlacementPlans) {
      if (autoPlacementRequests.current.has(plan.id)) continue;

      autoPlacementRequests.current.add(plan.id);
      updateInstanceMutation.mutate(
        {
          circuitId,
          id: plan.id,
          breadboardX: plan.breadboardX,
          breadboardY: plan.breadboardY,
        },
        {
          onError: () => {
            autoPlacementRequests.current.delete(plan.id);
          },
        },
      );
    }
  }, [autoPlacementPlans, circuitId, updateInstanceMutation]);

  // Wire sync: create breadboard wires for schematic net segments whose
  // endpoints have been placed on the breadboard. Only runs when there are
  // no pending auto-placement requests (all instances have coordinates).
  const wireSyncVersion = useRef('');
  useEffect(() => {
    if (!instances || !nets || !wires) return;
    // Wait for all auto-placements to settle
    if (autoPlacementPlans.length > 0) return;

    const placedInstances = instances.filter((i) => i.breadboardX != null && i.breadboardY != null);
    if (placedInstances.length === 0) return;

    // Build a version key to avoid re-syncing the same state
    const version = `${placedInstances
      .map((i) => i.id)
      .sort()
      .join(',')}-${nets.length}-${breadboardWires.length}`;
    if (wireSyncVersion.current === version) return;
    wireSyncVersion.current = version;

    const result = syncSchematicToBreadboard(nets, wires, instances, partsMap);
    if (result.wiresToCreate.length === 0) return;

    for (const wire of result.wiresToCreate) {
      createWireMutation.mutate({
        circuitId,
        netId: wire.netId,
        view: 'breadboard',
        points: wire.points,
        color: wire.color ?? null,
      });
    }
  }, [instances, nets, wires, breadboardWires, autoPlacementPlans, partsMap, circuitId, createWireMutation]);

  // BL-0594: Selected instance family detection for value swapping
  const selectedValueEditor = useMemo(() => {
    if (selectedInstanceId == null || !instances) return null;
    const inst = instances.find((i) => i.id === selectedInstanceId);
    if (!inst) return null;
    const part = inst.partId ? partsMap.get(inst.partId) : undefined;
    const type =
      ((part?.meta as Record<string, unknown>)?.type as string | undefined) ??
      ((inst.properties as Record<string, unknown>)?.type as string | undefined);
    const family = detectFamily(type);
    if (!family) return null;
    const values = getFamilyValues(family);
    const currentLabel = getCurrentValueLabel(inst, family);
    return { instance: inst, family, values, currentLabel };
  }, [selectedInstanceId, instances, parts]);

  const selectedInstanceModel = useMemo(() => {
    if (selectedInstanceId == null || !instances) {
      return null;
    }

    const instance = instances.find((candidate) => candidate.id === selectedInstanceId);
    if (!instance) {
      return null;
    }

    const part = instance.partId ? partsMap.get(instance.partId) : undefined;
    const insight = part ? benchInsights[part.id] : undefined;
    return buildBreadboardSelectedPartModel(instance, part, insight);
  }, [benchInsights, instances, partsMap, selectedInstanceId]);

  const selectedPlacedInstance = useMemo(() => {
    if (selectedInstanceId == null || !instances) {
      return null;
    }

    return instances.find((candidate) => candidate.id === selectedInstanceId) ?? null;
  }, [instances, selectedInstanceId]);

  const handleWorkSurfaceViewIn3D = useCallback(() => {
    if (!selectedInstanceModel) {
      return;
    }
    onViewIn3D?.(selectedInstanceModel);
  }, [onViewIn3D, selectedInstanceModel]);

  const digitalTwinRepairOverlay = useMemo(() => {
    if (!digitalTwinRepairTarget || digitalTwinRepairTarget.destination !== 'breadboard' || !instances) {
      return null;
    }

    const channel = digitalTwinRepairTarget.channel;
    const targetRefDes = (digitalTwinRepairTarget.refDes ?? channel?.refDes)?.toUpperCase();
    if (!targetRefDes) {
      return null;
    }

    const targetInstance = instances.find((candidate) => candidate.referenceDesignator.toUpperCase() === targetRefDes);
    if (!targetInstance) {
      return null;
    }

    const selectedModelForTarget =
      selectedInstanceModel?.refDes.toUpperCase() === targetRefDes ? selectedInstanceModel : null;
    const repairPin = findDigitalTwinRepairPin(selectedModelForTarget, digitalTwinRepairTarget);
    const fallbackX = targetInstance.breadboardX ?? targetInstance.benchX;
    const fallbackY = targetInstance.breadboardY ?? targetInstance.benchY;
    const anchor = repairPin?.pixel ?? (fallbackX != null && fallbackY != null ? { x: fallbackX, y: fallbackY } : null);
    if (!anchor) {
      return null;
    }

    return {
      refDes: targetInstance.referenceDesignator,
      pinLabel: channel?.pinLabel ?? channel?.id ?? repairPin?.label ?? 'target',
      netName: channel?.netName ?? 'unmapped net',
      state: channel?.state ?? 'waiting',
      value: channel?.value,
      x: anchor.x,
      y: anchor.y,
    };
  }, [digitalTwinRepairTarget, instances, selectedInstanceModel]);

  useEffect(() => {
    if (!focusAuditIssue || !instances) {
      return;
    }

    const targetInstanceId = focusAuditIssue.affectedInstanceIds[0];
    if (targetInstanceId == null) {
      onConsumeFocusAuditIssue();
      return;
    }

    const targetInstance = instances.find((candidate) => candidate.id === targetInstanceId);
    if (!targetInstance) {
      onConsumeFocusAuditIssue();
      return;
    }

    setSelectedInstanceId(targetInstance.id);
    setSelectedWireId(null);
    setTool('select');

    if (targetInstance.breadboardX != null && targetInstance.breadboardY != null) {
      centerOnBoardPixel({ x: targetInstance.breadboardX, y: targetInstance.breadboardY });
    }

    toast({
      title: 'Focused board-health issue',
      description: `${targetInstance.referenceDesignator} is selected for "${focusAuditIssue.title}".`,
    });

    onConsumeFocusAuditIssue();
  }, [centerOnBoardPixel, focusAuditIssue, instances, onConsumeFocusAuditIssue, toast]);

  // Coach plan resolution — extracted to useBreadboardCoachPlan hook
  const {
    coachPlan,
    resolvedCoachSuggestions,
    stagedCoachSuggestions,
    preparedCoachHookups,
    resolvedCoachHookups,
    preparedCoachBridges,
    resolvedCoachBridges,
    benchLayoutQuality,
    coachActionCount,
    coachActionItems,
  } = useBreadboardCoachPlan({
    selectedInstanceModel,
    selectedPlacedInstance,
    instances,
    instancePlacements,
    breadboardWires,
    nets,
    projectName,
  });

  useEffect(() => {
    setCoachPlanVisible(false);
    setHoveredInspectorPinId(null);
  }, [selectedInstanceId]);

  // BL-0594: Value change handler
  const handleValueChange = useCallback(
    (value: number | string) => {
      if (!selectedValueEditor) return;
      const inst = selectedValueEditor.instance;
      const family = selectedValueEditor.family;
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
    },
    [selectedValueEditor, updateInstanceMutation, circuitId],
  );

  const handleSelectionAiAction = useCallback(
    (actionId: BreadboardSelectionActionId) => {
      if (!selectedInstanceModel) {
        return;
      }

      const coachPlanSteps = coachActionItems.map((action) => {
        const status = action.status === 'advisory' ? 'Lane' : action.status === 'staged' ? 'Staged' : 'Pending';
        return `${status} ${action.label}: ${action.detail}`;
      });

      const prompt = buildBreadboardSelectionPrompt(actionId, {
        authoritativeWiringAllowed: selectedInstanceModel.authoritativeWiringAllowed,
        benchLayoutHeadline: benchLayoutQuality?.headline ?? 'Bench layout has not been scored yet.',
        benchLayoutLabel: benchLayoutQuality?.label ?? 'Unscored',
        benchLayoutRisks: benchLayoutQuality?.risks ?? [],
        benchLayoutScore: benchLayoutQuality?.score ?? 0,
        benchLayoutStrengths: benchLayoutQuality?.strengths ?? [],
        benchLayoutSummary: benchLayoutQuality?.summary ?? 'No bench layout quality summary captured yet.',
        coachPlanSteps,
        projectName,
        partTitle: selectedInstanceModel.title,
        refDes: selectedInstanceModel.refDes,
        fit: selectedInstanceModel.fit,
        pinMapConfidence: selectedInstanceModel.pinMapConfidence,
        exactPinCount: selectedInstanceModel.exactPinCount,
        heuristicPinCount: selectedInstanceModel.heuristicPinCount,
        modelQuality: selectedInstanceModel.modelQuality,
        requiresVerification: selectedInstanceModel.requiresVerification,
        orientationSummary: selectedInstanceModel.coach.orientationSummary,
        railStrategy: selectedInstanceModel.coach.railStrategy,
        stashSummary: selectedInstanceModel.inventorySummary,
        trustSummary: selectedInstanceModel.trustSummary,
        verificationLevel: selectedInstanceModel.verificationLevel,
        verificationStatus: selectedInstanceModel.verificationStatus,
        coachNextMoves: selectedInstanceModel.coach.nextMoves,
        coachCautions: selectedInstanceModel.coach.cautions,
        verifiedBoard: selectedInstanceModel.verifiedBoard,
        boardWarnings: selectedInstanceModel.boardWarnings,
        bootPinWarnings: selectedInstanceModel.bootPinWarnings,
        adcWifiConflict: selectedInstanceModel.adcWifiConflict,
        adcWifiConflictPinIds: selectedInstanceModel.adcWifiConflictPinIds,
        pins: selectedInstanceModel.pins.map((pin) => ({
          label: pin.label,
          coordLabel: pin.coordLabel,
          description: pin.description,
          confidence: pin.confidence,
        })),
      });

      window.dispatchEvent(
        new CustomEvent('protopulse:open-chat-panel', {
          detail: { designAgent: true, prompt },
        }),
      );
    },
    [benchLayoutQuality, coachActionItems, projectName, selectedInstanceModel],
  );

  const handleApplyCoachRemediation = useCallback(
    (suggestionId: string) => {
      if (!instances || !selectedInstanceModel) {
        return;
      }

      const suggestion = resolvedCoachSuggestions.find((candidate) => candidate.id === suggestionId);
      if (!suggestion || !suggestion.remediation) {
        toast({
          title: 'Coach action unavailable',
          description: 'That bench coach suggestion is no longer actionable.',
          variant: 'destructive',
        });
        return;
      }

      if (suggestion.remediation.action !== 'place-component') {
        toast({
          title: 'Coach action not implemented yet',
          description: `${suggestion.label} still needs a manual bench pass.`,
        });
        return;
      }

      const reservedRefdes = instances.map((instance) => instance.referenceDesignator);
      const prefix = getStarterRefDesPrefix(suggestion.remediation.componentType ?? suggestion.type);
      const refDes = nextRefdes(prefix, reservedRefdes);
      const anchorCoord = suggestion.remediation.coords
        ? coordToPixel({
            type: 'terminal',
            col: suggestion.remediation.coords.col as ColumnLetter,
            row: suggestion.remediation.coords.row,
          })
        : suggestion.pixel;

      createInstanceMutation.mutate({
        circuitId,
        partId: null,
        referenceDesignator: refDes,
        breadboardX: anchorCoord.x,
        breadboardY: anchorCoord.y,
        properties: {
          breadboardProvenance: 'coach',
          coachPlanFor: selectedInstanceModel.refDes,
          coachPlanKey: suggestion.id,
          label: suggestion.label,
          type: suggestion.remediation.componentType ?? suggestion.type,
          value: suggestion.value,
        },
      });

      toast({
        title: 'Coach support staged',
        description: `${suggestion.label} was placed for ${selectedInstanceModel.refDes}.`,
      });
    },
    [circuitId, createInstanceMutation, instances, resolvedCoachSuggestions, selectedInstanceModel, toast],
  );

  const handleApplyCoachPlan = useCallback(async () => {
    if (!instances || !selectedInstanceModel || coachActionCount === 0) {
      return;
    }

    try {
      const existingRefdes = instances.map((instance) => instance.referenceDesignator);
      const reservedRefdes = [...existingRefdes];
      const coachNetIds = new Map<string, number>();

      for (const net of nets ?? []) {
        coachNetIds.set(normalizeCoachNetName(net.name), net.id);
      }

      for (const suggestion of resolvedCoachSuggestions) {
        const prefix = getStarterRefDesPrefix(suggestion.type);
        const refDes = nextRefdes(prefix, reservedRefdes);
        reservedRefdes.push(refDes);

        createInstanceMutation.mutate({
          circuitId,
          partId: null,
          referenceDesignator: refDes,
          breadboardX: suggestion.pixel.x,
          breadboardY: suggestion.pixel.y,
          properties: {
            breadboardProvenance: 'coach',
            coachPlanFor: selectedInstanceModel.refDes,
            coachPlanKey: suggestion.id,
            label: suggestion.label,
            type: suggestion.type,
            value: suggestion.value,
          },
        });
      }

      for (const hookup of resolvedCoachHookups) {
        const netKey = normalizeCoachNetName(hookup.netName);
        let netId = coachNetIds.get(netKey) ?? hookup.netId;
        if (netId == null) {
          const createdNet = await createNetMutation.mutateAsync({
            circuitId,
            name: hookup.netName,
            netType: hookup.netType,
          });
          netId = createdNet.id;
          coachNetIds.set(netKey, netId);
        }

        createWireMutation.mutate({
          circuitId,
          netId,
          view: 'breadboard',
          points: hookup.path,
          color: getCoachHookupColor(hookup.netType),
          wireType: 'jump',
          provenance: 'coach',
        });
      }

      for (const bridge of resolvedCoachBridges) {
        const netKey = normalizeCoachNetName(bridge.netName);
        let netId = coachNetIds.get(netKey) ?? bridge.netId;
        if (netId == null) {
          const createdNet = await createNetMutation.mutateAsync({
            circuitId,
            name: bridge.netName,
            netType: bridge.netType,
          });
          netId = createdNet.id;
          coachNetIds.set(netKey, netId);
        }

        createWireMutation.mutate({
          circuitId,
          netId,
          view: 'breadboard',
          points: bridge.path,
          color: getCoachHookupColor(bridge.netType),
          wireType: 'jump',
          provenance: 'coach',
        });
      }

      setCoachPlanVisible(false);
      toast({
        title: 'Bench coach support staged',
        description: `Staged ${String(coachActionCount)} bench coach move${coachActionCount === 1 ? '' : 's'} around ${selectedInstanceModel.refDes}.`,
      });
    } catch (error) {
      logger.error('Failed to apply bench coach plan', error);
      toast({
        title: 'Bench coach plan failed',
        description: `ProtoPulse could not stage the coach plan around ${selectedInstanceModel.refDes}.`,
        variant: 'destructive',
      });
    }
  }, [
    circuitId,
    coachActionCount,
    createInstanceMutation,
    createNetMutation,
    createWireMutation,
    instances,
    nets,
    resolvedCoachBridges,
    resolvedCoachHookups,
    resolvedCoachSuggestions,
    selectedInstanceModel,
    toast,
  ]);

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
        const fromInst = instances.find((i) => i.id === seg.fromInstanceId);
        const toInst = instances.find((i) => i.id === seg.toInstanceId);

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

  const handleTiePointClick = useCallback(
    (coord: BreadboardCoord, pixel: PixelPos) => {
      if (tool === 'wire') {
        if (!wireInProgress) {
          // Start a new wire — user needs to pick a net first, default to first net
          const firstNet = nets?.[0];
          if (!firstNet) return;
          setWireInProgress({
            netId: firstNet.id,
            points: [pixel],
            coordPath: [coord],
            endpointPath: [
              coord.type === 'terminal'
                ? {
                    type: 'hole',
                    col: coord.col,
                    row: coord.row,
                  }
                : null,
            ],
            color: getDefaultColorForNet(firstNet.name),
          });
        } else {
          // Add waypoint or complete wire
          const updated: WireInProgress = {
            ...wireInProgress,
            points: [...wireInProgress.points, pixel],
            coordPath: [...wireInProgress.coordPath, coord],
            endpointPath: [
              ...wireInProgress.endpointPath,
              coord.type === 'terminal'
                ? {
                    type: 'hole',
                    col: coord.col,
                    row: coord.row,
                  }
                : null,
            ],
          };
          setWireInProgress(updated);
        }
      }
    },
    [tool, wireInProgress, nets],
  );

  const handleBenchConnectorClick = useCallback(
    (anchor: BenchConnectorAnchorPosition) => {
      setSelectedInstanceId(anchor.instanceId);

      if (tool !== 'wire') {
        return;
      }

      if (!wireInProgress) {
        const firstNet = nets?.[0];
        if (!firstNet) {
          return;
        }

        setWireInProgress({
          netId: firstNet.id,
          points: [{ x: anchor.x, y: anchor.y }],
          coordPath: [],
          endpointPath: [
            {
              type: 'bench-pin',
              instanceId: anchor.instanceId,
              pinId: anchor.pinId,
            },
          ],
          color: getDefaultColorForNet(firstNet.name),
        });
        return;
      }

      setWireInProgress({
        ...wireInProgress,
        points: [...wireInProgress.points, { x: anchor.x, y: anchor.y }],
        endpointPath: [
          ...wireInProgress.endpointPath,
          {
            type: 'bench-pin',
            instanceId: anchor.instanceId,
            pinId: anchor.pinId,
          },
        ],
      });
    },
    [nets, tool, wireInProgress],
  );

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
      const endpointMeta = buildEndpointMeta(wireInProgress.points, wireInProgress.endpointPath);
      const hasBenchPinEndpoint = wireInProgress.endpointPath.some((endpoint) => endpoint?.type === 'bench-pin');
      createWireMutation.mutate({
        circuitId,
        netId: wireInProgress.netId,
        view: 'breadboard',
        points: wireInProgress.points,
        color: wireInProgress.color,
        wireType: hasBenchPinEndpoint ? 'jump' : 'wire',
        endpointMeta: endpointMeta as Record<string, unknown> | null,
        provenance: (hasBenchPinEndpoint ? 'jumper' : 'manual') as 'manual' | 'synced' | 'coach' | 'jumper',
      });
      setWireInProgress(null);
    }
  }, [buildEndpointMeta, wireInProgress, createWireMutation, circuitId]);

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

  // BL-0543: Delete wire by ID (for the wire editor overlay)
  const handleDeleteWireById = useCallback(
    (wireId: number) => {
      deleteWireMutation.mutate({ circuitId, id: wireId });
      setSelectedWireId(null);
    },
    [deleteWireMutation, circuitId],
  );

  // BL-0543: Move wire endpoint (for the wire editor overlay)
  const handleMoveEndpoint = useCallback(
    (wireId: number, endpoint: 'start' | 'end', newPos: PixelPos) => {
      const wire = breadboardWires.find((w) => w.id === wireId);
      if (!wire) {
        return;
      }
      const pts = (wire.points as Array<{ x: number; y: number }>).map((p) => ({ ...p }));
      if (pts.length === 0) {
        return;
      }
      const resolvedTarget = resolveInteractiveWireTarget(newPos);
      if (endpoint === 'start') {
        pts[0] = resolvedTarget.pixel;
      } else {
        pts[pts.length - 1] = resolvedTarget.pixel;
      }
      const existingMeta = (wire.endpointMeta as WireEndpointMeta | null | undefined) ?? null;
      const nextEndpointMeta =
        endpoint === 'start'
          ? buildEndpointMeta(pts, [resolvedTarget.meta, existingMeta?.end ?? null])
          : buildEndpointMeta(pts, [existingMeta?.start ?? null, resolvedTarget.meta]);
      const isBenchLinked = nextEndpointMeta?.start.type === 'bench-pin' || nextEndpointMeta?.end.type === 'bench-pin';
      const provenance = isBenchLinked
        ? 'jumper'
        : wire.provenance === 'jumper'
          ? 'manual'
          : (wire.provenance ?? 'manual');
      updateWireMutation.mutate({
        circuitId,
        id: wireId,
        points: pts,
        endpointMeta: nextEndpointMeta as Record<string, unknown> | null,
        provenance: provenance as 'manual' | 'synced' | 'coach' | 'jumper',
        wireType: isBenchLinked ? 'jump' : 'wire',
      });
    },
    [breadboardWires, buildEndpointMeta, resolveInteractiveWireTarget, updateWireMutation, circuitId],
  );

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

  const handleWireColorChange = useCallback(
    (wireId: number, color: string) => {
      updateWireMutation.mutate({ circuitId, id: wireId, color });
      setContextMenuWireId(null);
      setWireColorMenuPos(null);
    },
    [updateWireMutation, circuitId],
  );

  const closeWireColorMenu = useCallback(() => {
    setContextMenuWireId(null);
    setWireColorMenuPos(null);
  }, []);

  // Pan handling
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && tool === 'select' && !hoveredCoord)) {
        isPanning.current = true;
        lastMouse.current = { x: e.clientX, y: e.clientY };
      }
    },
    [tool, hoveredCoord],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning.current) {
        const dx = e.clientX - lastMouse.current.x;
        const dy = e.clientY - lastMouse.current.y;
        lastMouse.current = { x: e.clientX, y: e.clientY };
        setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      }
      // Track board coordinates for the readout overlay
      const svg = svgRef.current;
      if (svg) {
        const rect = svg.getBoundingClientRect();
        const bx = (e.clientX - rect.left - panOffset.x) / zoom;
        const by = (e.clientY - rect.top - panOffset.y) / zoom;
        setMouseBoardPos({ x: Math.round(bx * 10) / 10, y: Math.round(by * 10) / 10 });
      }
    },
    [panOffset, zoom],
  );

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
    // Commit drag-to-move on mouse up (S6-04)
    if (draggingInstanceId != null && mouseBoardPos != null) {
      const coord = pixelToCoord(mouseBoardPos);
      if (coord && coord.type === 'terminal') {
        const inst = (instances ?? []).find((i) => i.id === draggingInstanceId);
        const part = inst?.partId != null ? partsMap.get(inst.partId) : undefined;
        const partMeta = (part?.meta ?? {}) as Record<string, unknown>;
        const compType = ((partMeta.type as string) ?? 'generic').toLowerCase();
        const pinCount = (part?.connectors as unknown[])?.length ?? 2;
        const existingPlacements = instancePlacements.map((p) => p.placement);
        const instanceIds = instancePlacements.map((p) => p.instanceId);
        const result = computeMoveResult(
          coord,
          compType,
          pinCount,
          existingPlacements,
          draggingInstanceId,
          instanceIds,
        );
        if (result.valid && result.snapPixel) {
          updateInstanceMutation.mutate({
            id: draggingInstanceId,
            circuitId,
            breadboardX: result.snapPixel.x,
            breadboardY: result.snapPixel.y,
          });
        }
      }
      setDraggingInstanceId(null);
    }
  }, [draggingInstanceId, mouseBoardPos, instances, partsMap, instancePlacements, updateInstanceMutation, circuitId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') handleEscape();
      if (e.key === 'Delete' || e.key === 'Backspace') handleDeleteWire();
      if (e.key === '1') {
        setTool('select');
        announce(getToolChangeAnnouncement('select', 'breadboard'));
      }
      if (e.key === '2') {
        setTool('wire');
        announce(getToolChangeAnnouncement('wire', 'breadboard'));
      }
      if (e.key === '3') {
        setTool('delete');
        announce(getToolChangeAnnouncement('delete', 'breadboard'));
      }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        void undoStack.current.undo();
      }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        e.preventDefault();
        void undoStack.current.redo();
      }
      // Keyboard cursor navigation (S6-01)
      if (e.key.startsWith('Arrow')) {
        handleCursorKeyDown(e);
      }
    },
    [handleEscape, handleDeleteWire, announce, handleCursorKeyDown],
  );

  const getCommandInstance = useCallback(
    (context?: MenuContext): CircuitInstanceRow | null => {
      const contextId = context?.targetId != null ? Number(context.targetId) : NaN;
      const targetId = Number.isFinite(contextId) ? contextId : selectedInstanceId;
      return (instances ?? []).find((instance) => instance.id === targetId) ?? null;
    },
    [instances, selectedInstanceId],
  );

  const getCommandWireId = useCallback(
    (context?: MenuContext): number | null => {
      if (context?.target !== 'wire') {
        return selectedWireId;
      }
      const wireId = context.targetId != null ? Number(context.targetId) : NaN;
      return Number.isFinite(wireId) ? wireId : selectedWireId;
    },
    [selectedWireId],
  );

  const handleAiBreadboardWiring = useCallback(
    (context?: MenuContext, delivery: RadialAiPromptDelivery = 'draft'): void => {
      const commandInstance = getCommandInstance(context);
      const commandWireId = getCommandWireId(context);
      const commandWire =
        commandWireId == null ? null : (breadboardWires.find((wire) => wire.id === commandWireId) ?? null);
      const placedInstances = (instances ?? []).filter(
        (instance) => instance.breadboardX != null && instance.breadboardY != null,
      );
      const targetLabel =
        context?.targetLabel ??
        commandInstance?.referenceDesignator ??
        (commandWire ? `Wire ${String(commandWire.id)}` : undefined);
      const deliveryVerb = getRadialAiDeliveryVerb(delivery);

      const formatPartTitle = (instance: CircuitInstanceRow): string => {
        const part = instance.partId ? partsMap.get(instance.partId) : undefined;
        const meta = (part?.meta as Partial<PartMeta> | null) ?? null;
        return meta?.title ?? instance.referenceDesignator;
      };

      const formatInstance = (instance: CircuitInstanceRow): string => {
        const placement = instancePlacements.find((candidate) => candidate.instanceId === instance.id)?.placement;
        const placementText = placement
          ? `${placement.startCol}${String(placement.startRow)} span=${String(placement.rowSpan)}${placement.crossesChannel ? ' across channel' : ''}`
          : `x=${String(instance.breadboardX ?? instance.benchX ?? 'unset')} y=${String(instance.breadboardY ?? instance.benchY ?? 'unset')}`;
        return `${instance.referenceDesignator} ${formatPartTitle(instance)} id=${String(instance.id)} ${placementText} rotation=${String(instance.breadboardRotation ?? 0)}`;
      };

      const formatWire = (wire: CircuitWireRow): string => {
        const points = getWirePreviewPoints(wire);
        const path = points
          .slice(0, 4)
          .map((point) => `${String(Math.round(point.x))},${String(Math.round(point.y))}`)
          .join(' -> ');
        return `wire ${String(wire.id)} net=${String(wire.netId ?? 'unknown')} points=${String(points.length)}${path ? ` path=${path}` : ''}`;
      };

      const boardStatusLines = boardAudit
        ? [
            `Audit: ${boardAudit.label} score=${String(boardAudit.score)}`,
            `Stats: ${String(boardAudit.stats.totalInstances)} part(s), ${String(boardAudit.stats.totalWires)} jumper(s), ${String(boardAudit.stats.instancesWithIssues)} part(s) with issues`,
            ...boardAudit.issues.slice(0, 6).map((issue) => `${issue.severity}: ${issue.title} - ${issue.detail}`),
          ]
        : [
            'Board audit: not open in the workbench yet. Ask Tyler to run Audit before treating this as final wiring advice.',
          ];

      const coachLines = [
        benchLayoutQuality
          ? `Layout: ${benchLayoutQuality.label} score=${String(benchLayoutQuality.score)} - ${benchLayoutQuality.summary}`
          : 'Layout quality: not scored yet.',
        ...coachActionItems.slice(0, 6).map((action) => `${action.status}: ${action.label} - ${action.detail}`),
      ];

      const sections: RadialAiPromptSection[] = [
        {
          title: 'Placed parts',
          lines: placedInstances.slice(0, 10).map(formatInstance),
        },
        {
          title: 'Bench staged parts',
          lines: benchInstances.slice(0, 6).map(formatInstance),
        },
        {
          title: 'Breadboard jumpers',
          lines: breadboardWires.slice(0, 8).map(formatWire),
        },
        {
          title: 'Known nets',
          lines: (nets ?? []).slice(0, 10).map((net) => `${net.name ?? `net-${String(net.id)}`} id=${String(net.id)}`),
        },
        {
          title: 'Board status',
          lines: boardStatusLines,
        },
        {
          title: 'Coach context',
          lines: coachLines,
        },
      ].filter((section) => section.lines.length > 0);

      runRadialAiCommand({
        intent: 'breadboard_wiring',
        intro:
          'Review this breadboard context like a practical bench wiring coach. Focus on rails, jumpers, physical row/column placement, polarity, pinout confidence, and what Tyler should verify before powering anything.',
        summary: `Breadboard wiring review: ${String(placedInstances.length)} placed part(s), ${String(benchInstances.length)} bench-staged part(s), ${String(breadboardWires.length)} jumper(s), ${String(nets?.length ?? 0)} net(s).`,
        historyLabel: targetLabel ? `Breadboard wiring: ${targetLabel}` : 'Breadboard wiring',
        context,
        delivery,
        targetDetails: [
          `Project: ${projectName}`,
          commandInstance
            ? `Target part: ${formatInstance(commandInstance)}`
            : commandWire
              ? `Target jumper: ${formatWire(commandWire)}`
              : 'Target: breadboard canvas',
        ],
        sections,
        finalInstruction:
          'Give Tyler a concise wiring review with the most likely physical mistakes, the safest next jumper or placement move, and the manual checks required before power-up.',
      });
      toast({
        title: `AI Breadboard Wiring ${deliveryVerb}`,
        description: targetLabel
          ? `${deliveryVerb} ${targetLabel} wiring prompt ${delivery === 'send-now' ? 'to' : 'in'} AI chat.`
          : `${deliveryVerb} breadboard prompt ${delivery === 'send-now' ? 'to' : 'in'} AI chat.`,
      });
    },
    [
      benchInstances,
      benchLayoutQuality,
      boardAudit,
      breadboardWires,
      coachActionItems,
      getCommandInstance,
      getCommandWireId,
      instancePlacements,
      instances,
      nets,
      partsMap,
      projectName,
      toast,
    ],
  );

  const handleBreadboardCommand = useCallback(
    (commandId: string, context?: MenuContext, delivery: RadialAiPromptDelivery = 'draft'): boolean => {
      const commandInstance = getCommandInstance(context);
      const commandWireId = getCommandWireId(context);

      switch (commandId) {
        case 'ai_breadboard_wiring':
          handleAiBreadboardWiring(context, delivery);
          return true;
        case 'add_component':
          toast({
            title: 'Parts shelf ready',
            description: 'Use the Breadboard workbench shelf to drag the next part onto the board.',
          });
          return true;
        case 'add_wire':
          setTool('wire');
          announce(getToolChangeAnnouncement('wire', 'breadboard'));
          return true;
        case 'show_rails':
          setShowConnectivityExplainer(true);
          return true;
        case 'validate_wiring':
          setShowDrc(true);
          onRunBoardAudit();
          return true;
        case 'starter_circuit':
          toast({
            title: 'Starter circuits ready',
            description: 'Use the starter shelf in the Breadboard workbench for guided placements.',
          });
          return true;
        case 'move':
          if (!commandInstance) {
            return false;
          }
          setSelectedInstanceId(commandInstance.id);
          setTool('select');
          return true;
        case 'rotate':
          if (!commandInstance) {
            return false;
          }
          setSelectedInstanceId(commandInstance.id);
          updateInstanceMutation.mutate({
            id: commandInstance.id,
            circuitId,
            breadboardRotation: ((commandInstance.breadboardRotation ?? 0) + 90) % 360,
          });
          return true;
        case 'delete':
          if (commandInstance) {
            deleteInstanceMutation.mutate({ circuitId, id: commandInstance.id });
            setSelectedInstanceId(null);
            return true;
          }
          if (commandWireId != null) {
            deleteWireMutation.mutate({ circuitId, id: commandWireId });
            setSelectedWireId(null);
            return true;
          }
          setTool('delete');
          announce(getToolChangeAnnouncement('delete', 'breadboard'));
          return true;
        case 'edit_properties':
          if (!commandInstance) {
            return false;
          }
          setSelectedInstanceId(commandInstance.id);
          return true;
        default:
          return false;
      }
    },
    [
      announce,
      circuitId,
      deleteInstanceMutation,
      deleteWireMutation,
      getCommandInstance,
      getCommandWireId,
      handleAiBreadboardWiring,
      onRunBoardAudit,
      toast,
      updateInstanceMutation,
    ],
  );

  const buildRadialAdapterPreviewGeometry = useCallback(
    (commandId: string, context?: MenuContext): BreadboardRadialPreviewGeometry | undefined => {
      if (commandId !== 'delete') {
        return undefined;
      }

      const targetId = getNumericMenuTargetId(context);
      if (context?.target === 'wire') {
        const wireId = targetId ?? selectedWireId;
        const wire = wireId == null ? null : breadboardWires.find((candidate) => candidate.id === wireId);
        const points = wire ? getWirePreviewPoints(wire) : [];
        if (wire && points.length >= 2) {
          return {
            kind: 'wire',
            targetId: String(wire.id),
            pathD: getWirePreviewPath(points),
            strokeWidth: Math.max(2.5, (wire.width ?? 1.5) + 5),
          };
        }
        return undefined;
      }

      const instanceTargetId = targetId ?? selectedInstanceId;
      const placement =
        instanceTargetId == null
          ? null
          : instancePlacements.find((candidate) => candidate.instanceId === instanceTargetId);
      const bounds = placement ? getPlacementPreviewBounds(placement.placement) : null;
      if (bounds && instanceTargetId != null) {
        return {
          kind: 'part',
          targetId: String(instanceTargetId),
          ...bounds,
        };
      }

      const wire = selectedWireId == null ? null : breadboardWires.find((candidate) => candidate.id === selectedWireId);
      const points = wire ? getWirePreviewPoints(wire) : [];
      if (wire && points.length >= 2) {
        return {
          kind: 'wire',
          targetId: String(wire.id),
          pathD: getWirePreviewPath(points),
          strokeWidth: Math.max(2.5, (wire.width ?? 1.5) + 5),
        };
      }

      return undefined;
    },
    [breadboardWires, instancePlacements, selectedInstanceId, selectedWireId],
  );

  useEffect(() => {
    const handleRadialCommand = (event: Event) => {
      if (!(event instanceof CustomEvent)) {
        return;
      }
      const detail = event.detail as RadialCommandEventDetail | undefined;
      if (!detail || detail.context.view !== 'breadboard') {
        return;
      }

      if (handleBreadboardCommand(detail.commandId, detail.context, getRadialAiPromptDelivery(detail))) {
        detail.handled = true;
      }
    };

    window.addEventListener(RADIAL_COMMAND_EVENT, handleRadialCommand);
    return () => window.removeEventListener(RADIAL_COMMAND_EVENT, handleRadialCommand);
  }, [handleBreadboardCommand]);

  useEffect(() => {
    const handleRadialPreview = (event: Event) => {
      if (!(event instanceof CustomEvent)) {
        return;
      }
      const detail = event.detail as RadialCommandPreviewEventDetail | undefined;
      if (!detail || detail.phase === 'clear' || detail.context?.view !== 'breadboard') {
        setRadialAdapterPreview(null);
        return;
      }
      if (!detail.commandId || !detail.context.pointer) {
        setRadialAdapterPreview(null);
        return;
      }

      setRadialAdapterPreview({
        commandId: detail.commandId,
        point: clientToBoardPixel(detail.context.pointer.x, detail.context.pointer.y) ?? detail.context.pointer,
        targetId: detail.context.targetId,
        targetLabel: detail.context.targetLabel,
        geometry: buildRadialAdapterPreviewGeometry(detail.commandId, detail.context),
      });
    };

    window.addEventListener(RADIAL_COMMAND_PREVIEW_EVENT, handleRadialPreview);
    return () => window.removeEventListener(RADIAL_COMMAND_PREVIEW_EVENT, handleRadialPreview);
  }, [buildRadialAdapterPreviewGeometry, clientToBoardPixel]);

  // --- Drag-to-place from component palette ---

  const [dropPreview, setDropPreview] = useState<{
    coord: BreadboardCoord | null;
    collision: boolean;
  } | null>(null);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!hasBreadboardDropPayloadType(e.dataTransfer.types, BREADBOARD_DROP_MIME_TYPES)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';

      const boardPx = clientToBoardPixel(e.clientX, e.clientY);
      if (boardPx) {
        const coord = pixelToCoord(boardPx);
        if (coord && coord.type === 'terminal') {
          const existingPlacements = instancePlacements.map((p) => p.placement);
          // Conservative collision check with a generic 2-pin placement preview.
          // During dragOver we cannot read the payload (browser security), so we
          // assume a minimal footprint. The real type-aware check runs on drop.
          const previewPlacement = buildPlacementForDrop(coord, 'resistor', 2);
          const hasCollision =
            checkCollision(previewPlacement, existingPlacements) ||
            checkBodyCollision(previewPlacement, existingPlacements, 'resistor', 2);
          setDropPreview({ coord, collision: hasCollision });
        } else {
          setDropPreview({ coord, collision: false });
        }
      }
    },
    [clientToBoardPixel, instancePlacements],
  );

  const handleDragLeave = useCallback(() => {
    setDropPreview(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDropPreview(null);

      const boardPx = clientToBoardPixel(e.clientX, e.clientY);
      if (!boardPx) return;

      const existingPlacements = instancePlacements.map((placement) => placement.placement);

      // ----- Project-part drops (from sidebar / stash) -----
      const dragData = readProjectPartDropData(e.dataTransfer, COMPONENT_DRAG_TYPE);
      if (dragData) {
        const part = partsMap.get(dragData.partId);
        if (!part) {
          return;
        }

        const partMeta = (part.meta ?? {}) as Partial<PartMeta>;
        const partType = getDropTypeFromPart(part, 'component');
        const refDes = generateRefDes(instances, part);
        const fit = partMeta.breadboardFit ?? 'native';
        const partLabel = (partMeta.title as string) ?? refDes;

        // Convert board-local pixel to bench-surface coords for placement decision
        const benchPos = pixelToBench(boardPx);
        const placementResult = determinePlacementMode(benchPos, fit);

        if (placementResult.mode === 'bench') {
          // Free-form bench placement — no grid snapping
          createInstanceMutation.mutate(
            buildProjectDropInstanceDraft({
              circuitId,
              partId: dragData.partId,
              referenceDesignator: refDes,
              placementMode: 'bench',
              pixel: boardPx,
              label: partLabel,
              type: partType,
            }),
          );
          if (fit === 'not_breadboard_friendly') {
            toast({
              title: `${partLabel} placed on the bench`,
              description: 'This board is too wide for the breadboard. Draw jumper wires to connect its pins.',
            });
          } else {
            toast({
              title: `${partLabel} placed on the bench`,
              description: 'Draw jumper wires to connect to the breadboard.',
            });
          }
          return;
        }

        const boardPlacement = resolveBoardDropPlacement({
          coord: placementResult.coord,
          type: partType,
          pinCount: (part.connectors as unknown[])?.length ?? 2,
          existingPlacements,
        });
        if (!boardPlacement) {
          return;
        }

        createInstanceMutation.mutate(
          buildProjectDropInstanceDraft({
            circuitId,
            partId: dragData.partId,
            referenceDesignator: refDes,
            placementMode: 'board',
            pixel: boardPlacement.snapPx,
            label: partLabel,
            type: partType,
          }),
        );
        return;
      }

      // ----- Starter shelf / generic drops -----
      const starterDrop = readStarterDropData(e.dataTransfer, BREADBOARD_DROP_MIME_TYPES);
      if (!starterDrop) return;
      const { nodeType, label } = starterDrop;

      // Starter shelf parts are always breadboard-native; snap to grid
      const coord = pixelToCoord(boardPx);
      if (!coord || coord.type !== 'terminal') return;

      const existingRefs = (instances ?? []).map((instance) => instance.referenceDesignator);
      const prefix = nodeType === 'mcu' || nodeType === 'ic' ? 'U' : nodeType.charAt(0).toUpperCase();
      let idx = 1;
      while (existingRefs.includes(`${prefix}${idx}`)) {
        idx += 1;
      }

      const refDes = `${prefix}${idx}`;
      const boardPlacement = resolveBoardDropPlacement({
        coord,
        type: nodeType,
        pinCount: nodeType === 'ic' || nodeType === 'mcu' ? 8 : 2,
        existingPlacements,
      });
      if (!boardPlacement) {
        return;
      }

      createInstanceMutation.mutate(
        buildStarterDropInstanceDraft({
          circuitId,
          referenceDesignator: refDes,
          pixel: boardPlacement.snapPx,
          type: nodeType,
          label,
        }),
      );
    },
    [clientToBoardPixel, createInstanceMutation, circuitId, instancePlacements, instances, partsMap],
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden" data-testid="breadboard-canvas-container">
      <CanvasToolbar
        tool={tool}
        onToolChange={setTool}
        zoom={zoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onResetView={resetView}
        showDrc={showDrc}
        onToggleDrc={() => setShowDrc((d) => !d)}
        showConnectivityExplainer={showConnectivityExplainer}
        onToggleConnectivityExplainer={() => setShowConnectivityExplainer((v) => !v)}
        boardAudit={boardAudit}
        onRunBoardAudit={onRunBoardAudit}
        hoveredCoord={hoveredCoord}
        wireInProgress={wireInProgress}
      />

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
        <BreadboardWorkSurfaceStatus
          boardAudit={boardAudit}
          selectedRefDes={selectedInstanceModel?.refDes ?? null}
          selectedPartTrust={
            selectedInstanceModel
              ? {
                  pinMapConfidence: selectedInstanceModel.pinMapConfidence,
                  readyNow: selectedInstanceModel.readyNow,
                  trustTier: selectedInstanceModel.trustTier,
                  verificationLevel: selectedInstanceModel.verificationLevel,
                  verificationStatus: selectedInstanceModel.verificationStatus,
                }
              : null
          }
          coachMoveCount={coachActionItems.length}
          coachPlanVisible={coachPlanVisible}
          canToggleCoachPlan={Boolean(selectedInstanceModel && coachPlan)}
          canViewIn3D={Boolean(selectedInstanceModel && onViewIn3D)}
          onRunBoardAudit={onRunBoardAudit}
          onToggleCoachPlan={() => setCoachPlanVisible((visible) => !visible)}
          onViewIn3D={handleWorkSurfaceViewIn3D}
        />

        <svg ref={svgRef} width="100%" height="100%" data-testid="breadboard-svg">
          <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoom})`}>
            {/* Breadboard grid */}
            <BreadboardGrid
              onTiePointClick={handleTiePointClick}
              onTiePointHover={handleTiePointHover}
              highlightedPoints={highlightedPoints}
              occupiedPoints={occupiedPoints}
              hoveredCoord={hoveredCoord}
              dropPreview={dropPreview ?? undefined}
            />

            {radialAdapterPreview && (
              <g
                data-testid="breadboard-radial-adapter-preview"
                data-command-id={radialAdapterPreview.commandId}
                data-board-x={Math.round(radialAdapterPreview.point.x)}
                data-board-y={Math.round(radialAdapterPreview.point.y)}
                data-target-kind={radialAdapterPreview.geometry?.kind ?? 'point'}
                data-target-id={radialAdapterPreview.geometry?.targetId ?? radialAdapterPreview.targetId}
                pointerEvents="none"
              >
                {radialAdapterPreview.commandId === 'show_rails' ? (
                  (() => {
                    const board = getBoardDimensions();
                    const leftPos = coordToPixel({ type: 'rail', rail: 'left_pos', index: 0 });
                    const leftNeg = coordToPixel({ type: 'rail', rail: 'left_neg', index: 0 });
                    const rightNeg = coordToPixel({ type: 'rail', rail: 'right_neg', index: 0 });
                    const rightPos = coordToPixel({ type: 'rail', rail: 'right_pos', index: 0 });
                    const railY1 = leftPos.y;
                    const railY2 = leftPos.y + (BB.ROWS - 1) * BB.PITCH;
                    return (
                      <g>
                        {[leftPos, leftNeg, rightNeg, rightPos].map((rail, index) => (
                          <line
                            key={`${String(rail.x)}-${String(index)}`}
                            x1={rail.x}
                            y1={railY1}
                            x2={rail.x}
                            y2={railY2}
                            stroke={index === 0 || index === 3 ? '#f87171' : '#60a5fa'}
                            strokeWidth={5 / zoom}
                            strokeLinecap="round"
                            strokeDasharray={`${10 / zoom},${7 / zoom}`}
                            opacity={0.85}
                          />
                        ))}
                        <rect
                          x={leftPos.x - 7}
                          y={railY1 - 9}
                          width={rightPos.x - leftPos.x + 14}
                          height={board.height - BB.ORIGIN_Y + 18}
                          rx={8}
                          fill="rgba(139,92,246,0.06)"
                          stroke="rgba(196,181,253,0.55)"
                          strokeWidth={1.4 / zoom}
                          strokeDasharray={`${9 / zoom},${6 / zoom}`}
                        />
                      </g>
                    );
                  })()
                ) : radialAdapterPreview.commandId === 'delete' ? (
                  (() => {
                    const geometry = radialAdapterPreview.geometry;
                    if (geometry?.kind === 'part') {
                      return (
                        <g>
                          <rect
                            data-testid="breadboard-radial-part-outline"
                            x={geometry.x}
                            y={geometry.y}
                            width={geometry.width}
                            height={geometry.height}
                            rx={5}
                            fill="rgba(248,113,113,0.12)"
                            stroke="#fca5a5"
                            strokeWidth={2.2 / zoom}
                            strokeDasharray={`${7 / zoom},${5 / zoom}`}
                          />
                          <path
                            d={`M${String(geometry.x + geometry.width * 0.25)} ${String(geometry.y + geometry.height * 0.25)} L${String(geometry.x + geometry.width * 0.75)} ${String(geometry.y + geometry.height * 0.75)} M${String(geometry.x + geometry.width * 0.75)} ${String(geometry.y + geometry.height * 0.25)} L${String(geometry.x + geometry.width * 0.25)} ${String(geometry.y + geometry.height * 0.75)}`}
                            stroke="#fca5a5"
                            strokeWidth={2 / zoom}
                            strokeLinecap="round"
                          />
                        </g>
                      );
                    }

                    if (geometry?.kind === 'wire') {
                      return (
                        <path
                          data-testid="breadboard-radial-wire-outline"
                          d={geometry.pathD}
                          fill="none"
                          stroke="#fca5a5"
                          strokeWidth={geometry.strokeWidth / zoom}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeDasharray={`${7 / zoom},${5 / zoom}`}
                        />
                      );
                    }

                    return (
                      <g transform={`translate(${radialAdapterPreview.point.x}, ${radialAdapterPreview.point.y})`}>
                        <rect
                          x={-16}
                          y={-11}
                          width={32}
                          height={22}
                          rx={4}
                          fill="rgba(248,113,113,0.14)"
                          stroke="#fca5a5"
                          strokeWidth={2 / zoom}
                          strokeDasharray={`${6 / zoom},${4 / zoom}`}
                        />
                        <path
                          d="M-10 -6 L10 6 M10 -6 L-10 6"
                          stroke="#fca5a5"
                          strokeWidth={1.8 / zoom}
                          strokeLinecap="round"
                        />
                      </g>
                    );
                  })()
                ) : (
                  <g>
                    <polyline
                      points={[
                        `${radialAdapterPreview.point.x},${radialAdapterPreview.point.y}`,
                        `${radialAdapterPreview.point.x + 20},${radialAdapterPreview.point.y - 16}`,
                        `${radialAdapterPreview.point.x + 46},${radialAdapterPreview.point.y - 16}`,
                      ].join(' ')}
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth={2.2 / zoom}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={`${7 / zoom},${5 / zoom}`}
                    />
                    <circle
                      cx={radialAdapterPreview.point.x}
                      cy={radialAdapterPreview.point.y}
                      r={4 / zoom}
                      fill="rgba(251,191,36,0.18)"
                      stroke="#fbbf24"
                      strokeWidth={1.5 / zoom}
                    />
                  </g>
                )}
              </g>
            )}

            {/* Connectivity explainer overlay — S6-07 */}
            <BreadboardConnectivityExplainer visible={showConnectivityExplainer} />

            {/* Keyboard cursor indicator — S6-01 */}
            {cursor.active &&
              (() => {
                const cursorPx = coordToPixel({ type: 'terminal', col: cursor.col, row: cursor.row });
                return (
                  <g data-testid="breadboard-keyboard-cursor" className="bb-cursor-blink">
                    <circle
                      cx={cursorPx.x}
                      cy={cursorPx.y}
                      r={6}
                      fill="none"
                      stroke="#facc15"
                      strokeWidth={1.5}
                      opacity={0.9}
                    />
                    <circle cx={cursorPx.x} cy={cursorPx.y} r={2} fill="#facc15" opacity={0.9} />
                  </g>
                );
              })()}

            {/* Bendable component legs (BL-0593) — rendered behind component bodies */}
            <BendableLegRenderer instances={instances ?? []} parts={parts ?? []} />

            {/* Components Overlay (BL-0151) */}
            <BreadboardComponentOverlay
              instances={instances ?? []}
              parts={parts ?? []}
              selectedId={selectedInstanceId}
              onInstanceClick={(id) => setSelectedInstanceId(id)}
            />

            {/* Bench-placed components — rendered outside the breadboard grid */}
            {benchInstances.map((inst) => {
              const part = inst.partId ? partsMap.get(inst.partId) : undefined;
              return (
                <BreadboardBenchPartRenderer
                  key={`bench-${String(inst.id)}`}
                  instance={inst}
                  part={part}
                  selected={selectedInstanceId === inst.id}
                  onClick={setSelectedInstanceId}
                  showConnectorTargets={tool === 'wire'}
                  onConnectorClick={handleBenchConnectorClick}
                />
              );
            })}

            {selectedInstanceModel && (
              <BreadboardPinAnchorOverlay
                selectedInstanceModel={selectedInstanceModel}
                hoveredInspectorPinId={hoveredInspectorPinId}
                coachPlanVisible={coachPlanVisible}
                coachPlan={coachPlan}
              />
            )}

            {coachPlanVisible && coachPlan && (
              <BreadboardCoachPlanOverlay
                coachPlan={coachPlan}
                preparedCoachHookups={preparedCoachHookups}
                preparedCoachBridges={preparedCoachBridges}
                stagedCoachSuggestions={stagedCoachSuggestions}
                resolvedCoachSuggestions={resolvedCoachSuggestions}
                onApplyRemediation={(suggestionId) => handleApplyCoachRemediation(suggestionId)}
              />
            )}

            {/* Existing wires */}
            {breadboardWires.map((wire: CircuitWireRow) => {
              const pts = (wire.points as Array<{ x: number; y: number }>) ?? [];
              if (pts.length < 2) return null;
              const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
              const isJumper = wire.provenance === 'jumper';
              const isSynced = wire.provenance === 'synced';
              const isCoach = wire.provenance === 'coach';

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
                      stroke="var(--color-editor-accent)"
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
                    stroke={
                      isAnimated ? 'var(--color-editor-accent)' : isJumper ? '#f59e0b' : (wire.color ?? '#3498db')
                    }
                    strokeWidth={isJumper ? 3 : (wire.width ?? 1.5)}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={isSynced ? '6 3' : isCoach ? '3 3' : undefined}
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
                    data-wire-id={String(wire.id)}
                    data-node-label={`Wire ${String(wire.id)}`}
                    data-testid={isAnimated ? `wire-animated-${wire.id}` : `wire-${wire.id}`}
                  />
                  {/* Jumper wire endpoint connectors */}
                  {isJumper && pts.length >= 2 && (
                    <>
                      <circle cx={pts[0].x} cy={pts[0].y} r={3} fill="#f59e0b" stroke="#92400e" strokeWidth={0.5} />
                      <circle
                        cx={pts[pts.length - 1].x}
                        cy={pts[pts.length - 1].y}
                        r={3}
                        fill="#f59e0b"
                        stroke="#92400e"
                        strokeWidth={0.5}
                      />
                    </>
                  )}
                  {/* Simulation current label at wire midpoint */}
                  {isAnimated &&
                    pts.length >= 2 &&
                    (() => {
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
                            fill="var(--color-editor-accent)"
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

            {/* BL-0543: Wire editing overlay (select, delete, drag endpoints) */}
            <BreadboardWireEditor
              wires={breadboardWires.map((w: CircuitWireRow) => ({
                id: w.id,
                points: (w.points as Array<{ x: number; y: number }>) ?? [],
                width: w.width,
                color: w.color,
                view: w.view,
              }))}
              selectedWireId={selectedWireId}
              onSelectWire={setSelectedWireId}
              onDeleteWire={handleDeleteWireById}
              onMoveEndpoint={handleMoveEndpoint}
              resolveEndpointTarget={(point) => resolveInteractiveWireTarget(point).pixel}
              zoom={zoom}
              active={tool === 'select'}
            />

            {/* Wire in progress */}
            {wireInProgress && wireInProgress.points.length >= 1 && (
              <g data-testid="wire-in-progress">
                <polyline
                  points={wireInProgress.points.map((p) => `${p.x},${p.y}`).join(' ')}
                  stroke={wireInProgress.color}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  strokeDasharray="2,1"
                  opacity={0.8}
                />
                {wireInProgress.points.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={1.5} fill={wireInProgress.color} opacity={0.6} />
                ))}
              </g>
            )}

            {/* Drop preview indicator is now rendered inside BreadboardGrid via the dropPreview prop */}

            {/* Ratsnest overlay */}
            <RatsnestOverlay nets={ratsnestNets} opacity={0.5} showLabels />

            {/* BL-0544: DRC overlay — shows violations when DRC toggle is active */}
            <BreadboardDrcOverlay
              nets={nets ?? []}
              wires={breadboardWires}
              instances={instances ?? []}
              parts={parts ?? []}
              visible={showDrc}
            />

            {/* BL-0542: Connectivity overlay — shows net coloring when simulation is active */}
            <BreadboardConnectivityOverlay
              nets={nets ?? []}
              wires={breadboardWires}
              instances={instances ?? []}
              parts={parts ?? []}
              visible={isLive}
            />

            {/* BL-0619 / BL-0128: Simulation component visual overlays */}
            {isLive &&
              componentVisualStates.size > 0 &&
              (instances ?? []).map((inst) => {
                if (inst.breadboardX == null || inst.breadboardY == null) {
                  return null;
                }
                const state = componentVisualStates.get(inst.referenceDesignator);
                if (!state) {
                  return null;
                }

                const x = inst.breadboardX;
                const y = inst.breadboardY;

                if (state.type === 'led' && state.glowing) {
                  const color =
                    state.color === 'red'
                      ? '#ef4444'
                      : state.color === 'green'
                        ? '#22c55e'
                        : state.color === 'blue'
                          ? '#3b82f6'
                          : state.color === 'yellow'
                            ? '#facc15'
                            : state.color === 'white'
                              ? '#f5f5f5'
                              : '#22c55e';
                  return (
                    <g
                      key={`sim-led-${inst.id}`}
                      pointerEvents="none"
                      data-testid={`sim-bb-led-${inst.referenceDesignator}`}
                    >
                      <circle
                        cx={x}
                        cy={y}
                        r={8}
                        fill={color}
                        opacity={state.brightness * 0.3}
                        style={{ filter: 'blur(4px)' }}
                      />
                      <circle cx={x} cy={y} r={4} fill={color} opacity={state.brightness * 0.6} />
                    </g>
                  );
                }

                if (state.type === 'resistor' || (state.type === 'generic' && Math.abs(state.current) > 0.0001)) {
                  return (
                    <g
                      key={`sim-val-${inst.id}`}
                      pointerEvents="none"
                      data-testid={`sim-bb-value-${inst.referenceDesignator}`}
                    >
                      <rect
                        x={x + 8}
                        y={y - 8}
                        width={32}
                        height={14}
                        rx={2}
                        fill="rgba(0,0,0,0.7)"
                        stroke="rgba(0,240,255,0.2)"
                        strokeWidth={0.5}
                      />
                      <text x={x + 10} y={y - 1} fill="var(--color-editor-accent)" fontSize={5} fontFamily="monospace">
                        {formatSIValue(state.voltageDrop, 'V')}
                      </text>
                      <text
                        x={x + 10}
                        y={y + 4}
                        fill="var(--color-editor-accent)"
                        fontSize={5}
                        fontFamily="monospace"
                        opacity={0.7}
                      >
                        {formatSIValue(state.current, 'A')}
                      </text>
                    </g>
                  );
                }

                if (state.type === 'switch') {
                  return (
                    <g
                      key={`sim-sw-${inst.id}`}
                      pointerEvents="none"
                      data-testid={`sim-bb-switch-${inst.referenceDesignator}`}
                    >
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

            {selectedInstanceModel &&
              hoveredInspectorPinId &&
              (() => {
                const pin = selectedInstanceModel.pins.find((candidate) => candidate.id === hoveredInspectorPinId);
                if (!pin) {
                  return null;
                }

                return (
                  <g data-testid="breadboard-pin-highlight" pointerEvents="none">
                    <circle
                      cx={pin.pixel.x}
                      cy={pin.pixel.y}
                      r={5}
                      fill="rgba(0,240,255,0.14)"
                      stroke="var(--color-editor-accent)"
                      strokeWidth={1.2}
                    />
                    <circle cx={pin.pixel.x} cy={pin.pixel.y} r={2} fill="var(--color-editor-accent)" opacity={0.95} />
                    <text
                      x={pin.pixel.x + 6}
                      y={pin.pixel.y - 6}
                      fill="var(--color-editor-accent)"
                      fontSize={5}
                      fontFamily="monospace"
                    >
                      {pin.label} · {pin.coordLabel}
                    </text>
                  </g>
                );
              })()}

            {digitalTwinRepairOverlay &&
              (() => {
                const labelX = Math.max(16, digitalTwinRepairOverlay.x + 14);
                const labelY = Math.max(18, digitalTwinRepairOverlay.y - 48);
                return (
                  <g
                    data-testid="breadboard-digital-twin-pin-net-overlay"
                    data-ref-des={digitalTwinRepairOverlay.refDes}
                    data-pin={digitalTwinRepairOverlay.pinLabel}
                    data-net={digitalTwinRepairOverlay.netName}
                    data-state={digitalTwinRepairOverlay.state}
                    pointerEvents="none"
                  >
                    <line
                      x1={digitalTwinRepairOverlay.x}
                      y1={digitalTwinRepairOverlay.y}
                      x2={labelX}
                      y2={labelY + 30}
                      stroke="#22d3ee"
                      strokeWidth={1}
                      strokeDasharray="3 2"
                      opacity={0.95}
                    />
                    <circle
                      cx={digitalTwinRepairOverlay.x}
                      cy={digitalTwinRepairOverlay.y}
                      r={8}
                      fill="rgba(34, 211, 238, 0.16)"
                      stroke="#22d3ee"
                      strokeWidth={1.5}
                    />
                    <circle
                      cx={digitalTwinRepairOverlay.x}
                      cy={digitalTwinRepairOverlay.y}
                      r={2.8}
                      fill="#22d3ee"
                      opacity={0.95}
                    />
                    <rect
                      x={labelX}
                      y={labelY}
                      width={136}
                      height={42}
                      rx={4}
                      fill="rgba(8, 47, 73, 0.92)"
                      stroke="rgba(34, 211, 238, 0.55)"
                      strokeWidth={0.8}
                    />
                    <text
                      x={labelX + 7}
                      y={labelY + 12}
                      fill="#cffafe"
                      fontSize={6}
                      fontFamily="monospace"
                      fontWeight={700}
                    >
                      {digitalTwinRepairOverlay.refDes} {digitalTwinRepairOverlay.pinLabel}
                    </text>
                    <text x={labelX + 7} y={labelY + 24} fill="#67e8f9" fontSize={5.5} fontFamily="monospace">
                      net {digitalTwinRepairOverlay.netName}
                    </text>
                    <text x={labelX + 7} y={labelY + 35} fill="#a7f3d0" fontSize={5.5} fontFamily="monospace">
                      {digitalTwinRepairOverlay.state}
                      {digitalTwinRepairOverlay.value ? ` ${digitalTwinRepairOverlay.value}` : ''}
                    </text>
                  </g>
                );
              })()}
          </g>
        </svg>

        <CanvasCoordinateReadout mouseBoardPos={mouseBoardPos} />

        <WireColorMenu
          wireId={contextMenuWireId}
          position={wireColorMenuPos}
          onColorChange={handleWireColorChange}
          onClose={closeWireColorMenu}
        />

        {selectedInstanceModel && (
          <BreadboardPartInspector
            canApplyCoachPlan={coachActionCount > 0}
            coachActionCount={coachActionCount}
            coachActions={coachActionItems}
            coachPlanVisible={coachPlanVisible}
            layoutQuality={benchLayoutQuality}
            model={selectedInstanceModel}
            onApplyCoachPlan={handleApplyCoachPlan}
            valueEditor={
              selectedValueEditor
                ? {
                    currentLabel: selectedValueEditor.currentLabel,
                    family: selectedValueEditor.family,
                    values: selectedValueEditor.values,
                  }
                : null
            }
            onHoverPin={setHoveredInspectorPinId}
            onSelectionAiAction={handleSelectionAiAction}
            onToggleCoachPlan={() => setCoachPlanVisible((visible) => !visible)}
            onValueChange={handleValueChange}
            onViewIn3D={onViewIn3D ? () => onViewIn3D(selectedInstanceModel) : undefined}
          />
        )}

        <CanvasEmptyGuidance instances={instances} />
      </div>
    </div>
  );
}
