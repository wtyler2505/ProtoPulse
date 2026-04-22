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
  useDeleteCircuitWire,
  useUpdateCircuitInstance,
  useUpdateCircuitWire,
} from '@/lib/circuit-editor/hooks';
import { useComponentParts } from '@/lib/component-editor/hooks';
import { useSimulation } from '@/lib/contexts/simulation-context';
import BreadboardGrid from '../BreadboardGrid';
import { BreadboardComponentOverlay, detectFamily, getFamilyValues, getCurrentValueLabel } from '../BreadboardComponentRenderer';
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
import type { ComponentDragData } from '../ComponentPlacer';
import { getBenchConnectorAnchorPositions, type BenchConnectorAnchorPosition } from '@/lib/circuit-editor/breadboard-bench-connectors';
import {
  buildBreadboardBenchSummary,
  indexBreadboardBenchInsights,
  type BreadboardBenchInsight,
} from '@/lib/breadboard-bench';
import {
  buildBreadboardSelectionPrompt,
  type BreadboardSelectionActionId,
} from '@/lib/breadboard-ai-prompts';
import {
  buildBreadboardSelectedPartModel,
} from '@/lib/breadboard-part-inspector';
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
import { generateRefDes, nextRefdes } from '@/lib/circuit-editor/ref-des';
import { cn } from '@/lib/utils';
import {
  BB,
  type ColumnLetter,
  type BreadboardCoord,
  type PixelPos,
  coordKey,
  coordToPixel,
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
import { getCanvasAriaLabel, getActionAnnouncement, getToolChangeAnnouncement, getZoomAnnouncement } from '@/lib/canvas-accessibility';
import {
  buildAutoPlacementTemplate,
  buildPlacementForDrop,
  findAutoPlacement,
  getDropTypeFromPart,
  WIRE_COLORS,
  type AutoPlacementPlan,
  type Tool,
  type WireInProgress,
} from './canvas-helpers';
import { CanvasToolbar } from './CanvasToolbar';
import { CanvasCoordinateReadout } from './CanvasCoordinateReadout';
import { WireColorMenu } from './WireColorMenu';
import { CanvasEmptyGuidance } from './CanvasEmptyGuidance';
import { useCanvasViewport } from './useCanvasViewport';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface BreadboardCanvasProps {
  boardAudit: BoardAuditSummary | null;
  circuitId: number;
  benchInsights: Record<number, BreadboardBenchInsight>;
  focusAuditIssue: BoardAuditIssue | null;
  onConsumeFocusAuditIssue: () => void;
  onRunBoardAudit: () => void;
  projectName: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BreadboardCanvas({
  boardAudit,
  circuitId,
  benchInsights,
  focusAuditIssue,
  onConsumeFocusAuditIssue,
  onRunBoardAudit,
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
  const isPanning = useRef(false);
  const lastMouse = useRef<PixelPos>({ x: 0, y: 0 });
  const autoPlacementRequests = useRef<Set<number>>(new Set());
  const undoStack = useRef(new UndoRedoStack());

  const partsMap = useMemo(
    () => new Map((parts ?? []).map((part: ComponentPart) => [part.id, part])),
    [parts],
  );

  // Filter wires to breadboard view only
  const breadboardWires = useMemo(
    () => (wires ?? []).filter((w: CircuitWireRow) => w.view === 'breadboard'),
    [wires],
  );

  // Bench-placed instances (benchX/benchY set, breadboardX null)
  const benchInstances = useMemo(
    () => (instances ?? []).filter((inst) => inst.benchX != null && inst.benchY != null && inst.breadboardX == null),
    [instances],
  );

  const benchConnectorAnchors = useMemo(
    () => benchInstances.flatMap((inst) => getBenchConnectorAnchorPositions(inst, inst.partId ? partsMap.get(inst.partId) : undefined)),
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

  const resolveInteractiveWireTarget = useCallback((point: PixelPos): {
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
  }, [benchConnectorAnchors, getHoleEndpoint]);

  const buildEndpointMeta = useCallback((points: PixelPos[], endpointMeta: Array<SurfaceWireEndpoint | null>): WireEndpointMeta | null => {
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
  }, [getHoleEndpoint]);

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

    const placedInstances = instances.filter(i => i.breadboardX != null && i.breadboardY != null);
    if (placedInstances.length === 0) return;

    // Build a version key to avoid re-syncing the same state
    const version = `${placedInstances.map(i => i.id).sort().join(',')}-${nets.length}-${breadboardWires.length}`;
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
    const inst = instances.find(i => i.id === selectedInstanceId);
    if (!inst) return null;
    const part = inst.partId ? partsMap.get(inst.partId) : undefined;
    const type = (part?.meta as Record<string, unknown>)?.type as string | undefined
      ?? (inst.properties as Record<string, unknown>)?.type as string | undefined;
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
  const handleValueChange = useCallback((value: number | string) => {
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
  }, [selectedValueEditor, updateInstanceMutation, circuitId]);

  const handleSelectionAiAction = useCallback((actionId: BreadboardSelectionActionId) => {
    if (!selectedInstanceModel) {
      return;
    }

    const coachPlanSteps = coachActionItems.map((action) => {
      const status = action.status === 'advisory'
        ? 'Lane'
        : action.status === 'staged'
          ? 'Staged'
          : 'Pending';
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
  }, [benchLayoutQuality, coachActionItems, projectName, selectedInstanceModel]);

  const handleApplyCoachRemediation = useCallback((suggestionId: string) => {
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
  }, [circuitId, createInstanceMutation, instances, resolvedCoachSuggestions, selectedInstanceModel, toast]);

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
          endpointPath: [coord.type === 'terminal' ? {
            type: 'hole',
            col: coord.col,
            row: coord.row,
          } : null],
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
            coord.type === 'terminal' ? {
              type: 'hole',
              col: coord.col,
              row: coord.row,
            } : null,
          ],
        };
        setWireInProgress(updated);
      }
    }
  }, [tool, wireInProgress, nets]);

  const handleBenchConnectorClick = useCallback((anchor: BenchConnectorAnchorPosition) => {
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
        endpointPath: [{
          type: 'bench-pin',
          instanceId: anchor.instanceId,
          pinId: anchor.pinId,
        }],
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
  }, [nets, tool, wireInProgress]);

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
  const handleDeleteWireById = useCallback((wireId: number) => {
    deleteWireMutation.mutate({ circuitId, id: wireId });
    setSelectedWireId(null);
  }, [deleteWireMutation, circuitId]);

  // BL-0543: Move wire endpoint (for the wire editor overlay)
  const handleMoveEndpoint = useCallback((wireId: number, endpoint: 'start' | 'end', newPos: PixelPos) => {
    const wire = breadboardWires.find(w => w.id === wireId);
    if (!wire) { return; }
    const pts = (wire.points as Array<{ x: number; y: number }>).map(p => ({ ...p }));
    if (pts.length === 0) { return; }
    const resolvedTarget = resolveInteractiveWireTarget(newPos);
    if (endpoint === 'start') {
      pts[0] = resolvedTarget.pixel;
    } else {
      pts[pts.length - 1] = resolvedTarget.pixel;
    }
    const existingMeta = (wire.endpointMeta as WireEndpointMeta | null | undefined) ?? null;
    const nextEndpointMeta = endpoint === 'start'
      ? buildEndpointMeta(pts, [resolvedTarget.meta, existingMeta?.end ?? null])
      : buildEndpointMeta(pts, [existingMeta?.start ?? null, resolvedTarget.meta]);
    const isBenchLinked = nextEndpointMeta?.start.type === 'bench-pin' || nextEndpointMeta?.end.type === 'bench-pin';
    const provenance = isBenchLinked
      ? 'jumper'
      : (wire.provenance === 'jumper' ? 'manual' : (wire.provenance ?? 'manual'));
    updateWireMutation.mutate({
      circuitId,
      id: wireId,
      points: pts,
      endpointMeta: nextEndpointMeta as Record<string, unknown> | null,
      provenance: provenance as 'manual' | 'synced' | 'coach' | 'jumper',
      wireType: isBenchLinked ? 'jump' : 'wire',
    });
  }, [breadboardWires, buildEndpointMeta, resolveInteractiveWireTarget, updateWireMutation, circuitId]);

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
        const result = computeMoveResult(coord, compType, pinCount, existingPlacements, draggingInstanceId, instanceIds);
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

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') handleEscape();
    if (e.key === 'Delete' || e.key === 'Backspace') handleDeleteWire();
    if (e.key === '1') { setTool('select'); announce(getToolChangeAnnouncement('select', 'breadboard')); }
    if (e.key === '2') { setTool('wire'); announce(getToolChangeAnnouncement('wire', 'breadboard')); }
    if (e.key === '3') { setTool('delete'); announce(getToolChangeAnnouncement('delete', 'breadboard')); }
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
  }, [handleEscape, handleDeleteWire, announce, handleCursorKeyDown]);

  // --- Drag-to-place from component palette ---

  const [dropPreview, setDropPreview] = useState<{
    coord: BreadboardCoord | null;
    collision: boolean;
  } | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    const hasType =
      e.dataTransfer.types.includes(COMPONENT_DRAG_TYPE) ||
      e.dataTransfer.types.includes('application/reactflow/type');
    if (!hasType) return;
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
        const hasCollision = checkCollision(previewPlacement, existingPlacements)
          || checkBodyCollision(previewPlacement, existingPlacements, 'resistor', 2);
        setDropPreview({ coord, collision: hasCollision });
      } else {
        setDropPreview({ coord, collision: false });
      }
    }
  }, [clientToBoardPixel, instancePlacements]);

  const handleDragLeave = useCallback(() => {
    setDropPreview(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDropPreview(null);

    const boardPx = clientToBoardPixel(e.clientX, e.clientY);
    if (!boardPx) return;

    const existingPlacements = instancePlacements.map((placement) => placement.placement);

    // ----- Project-part drops (from sidebar / stash) -----
    const projectPartPayload = e.dataTransfer.getData(COMPONENT_DRAG_TYPE);
    if (projectPartPayload) {
      let dragData: ComponentDragData;
      try {
        dragData = JSON.parse(projectPartPayload) as ComponentDragData;
      } catch {
        return;
      }

      const part = partsMap.get(dragData.partId);
      if (!part) {
        return;
      }

      const partMeta = (part.meta ?? {}) as Partial<PartMeta>;
      const partType = getDropTypeFromPart(part, 'component');
      const refDes = generateRefDes(instances, part);
      const fit = partMeta.breadboardFit ?? 'native';

      // Convert board-local pixel to bench-surface coords for placement decision
      const benchPos = pixelToBench(boardPx);
      const placementResult = determinePlacementMode(benchPos, fit);

      if (placementResult.mode === 'bench') {
        // Free-form bench placement — no grid snapping
        createInstanceMutation.mutate({
          circuitId,
          partId: dragData.partId,
          referenceDesignator: refDes,
          benchX: boardPx.x,
          benchY: boardPx.y,
          properties: {
            label: partMeta.title ?? refDes,
            type: partType,
          },
        });
        const partLabel = (partMeta.title as string) ?? refDes;
        if (fit === 'not_breadboard_friendly') {
          toast({
            title: `${partLabel} placed on the bench`,
            description: "This board is too wide for the breadboard. Draw jumper wires to connect its pins.",
          });
        } else {
          toast({
            title: `${partLabel} placed on the bench`,
            description: 'Draw jumper wires to connect to the breadboard.',
          });
        }
        return;
      }

      // Board placement — snap to grid hole
      const coord = placementResult.coord;
      if (!coord || coord.type !== 'terminal') return;

      const placement = buildPlacementForDrop(coord, partType, (part.connectors as unknown[])?.length ?? 2);
      if (checkCollision(placement, existingPlacements)) {
        return;
      }

      const snapPx = coordToPixel({
        type: 'terminal',
        col: placement.startCol,
        row: placement.startRow,
      });

      createInstanceMutation.mutate({
        circuitId,
        partId: dragData.partId,
        referenceDesignator: refDes,
        breadboardX: snapPx.x,
        breadboardY: snapPx.y,
        properties: {
          label: partMeta.title ?? refDes,
          type: partType,
        },
      });
      return;
    }

    // ----- Starter shelf / generic drops -----
    const nodeType = e.dataTransfer.getData('application/reactflow/type');
    const label = e.dataTransfer.getData('application/reactflow/label');
    if (!nodeType) return;

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
    const placement = buildPlacementForDrop(coord, nodeType, nodeType === 'ic' || nodeType === 'mcu' ? 8 : 2);
    if (checkCollision(placement, existingPlacements)) {
      return;
    }

    const snapPx = coordToPixel({
      type: 'terminal',
      col: placement.startCol,
      row: placement.startRow,
    });

    createInstanceMutation.mutate({
      circuitId,
      partId: null,
      referenceDesignator: refDes,
      breadboardX: snapPx.x,
      breadboardY: snapPx.y,
      properties: { type: nodeType, label: label || nodeType },
    });
  }, [clientToBoardPixel, createInstanceMutation, circuitId, instancePlacements, instances, partsMap]);

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
              dropPreview={dropPreview ?? undefined}
            />

            {/* Connectivity explainer overlay — S6-07 */}
            <BreadboardConnectivityExplainer visible={showConnectivityExplainer} />

            {/* Keyboard cursor indicator — S6-01 */}
            {cursor.active && (() => {
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
                  <circle
                    cx={cursorPx.x}
                    cy={cursorPx.y}
                    r={2}
                    fill="#facc15"
                    opacity={0.9}
                  />
                </g>
              );
            })()}

            {/* Bendable component legs (BL-0593) — rendered behind component bodies */}
            <BendableLegRenderer
              instances={instances ?? []}
              parts={parts ?? []}
            />

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
                    stroke={isAnimated ? 'var(--color-editor-accent)' : isJumper ? '#f59e0b' : (wire.color ?? '#3498db')}
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
                    data-testid={isAnimated ? `wire-animated-${wire.id}` : `wire-${wire.id}`}
                  />
                  {/* Jumper wire endpoint connectors */}
                  {isJumper && pts.length >= 2 && (
                    <>
                      <circle cx={pts[0].x} cy={pts[0].y} r={3} fill="#f59e0b" stroke="#92400e" strokeWidth={0.5} />
                      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={3} fill="#f59e0b" stroke="#92400e" strokeWidth={0.5} />
                    </>
                  )}
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

            {/* Drop preview indicator is now rendered inside BreadboardGrid via the dropPreview prop */}

            {/* Ratsnest overlay */}
            <RatsnestOverlay
              nets={ratsnestNets}
              opacity={0.5}
              showLabels
            />

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
                    <text x={x + 10} y={y - 1} fill="var(--color-editor-accent)" fontSize={5} fontFamily="monospace">
                      {formatSIValue(state.voltageDrop, 'V')}
                    </text>
                    <text x={x + 10} y={y + 4} fill="var(--color-editor-accent)" fontSize={5} fontFamily="monospace" opacity={0.7}>
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

            {selectedInstanceModel && hoveredInspectorPinId && (() => {
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
                  <circle
                    cx={pin.pixel.x}
                    cy={pin.pixel.y}
                    r={2}
                    fill="var(--color-editor-accent)"
                    opacity={0.95}
                  />
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
          />
        )}

        <CanvasEmptyGuidance instances={instances} />
      </div>
    </div>
  );
}
