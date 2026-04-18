/**
 * BreadboardView — interactive breadboard editor with component placement,
 * wire drawing, and ratsnest overlay.
 */

import './breadboard-animations.css';
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { BreadboardCanvas } from './breadboard-canvas';
import { BreadboardToolbar } from './breadboard-view/BreadboardToolbar';
import { BreadboardEmptyState } from './breadboard-view/BreadboardEmptyState';
import { BreadboardDialogs } from './breadboard-view/BreadboardDialogs';
import { useBreadboardDialogState } from './breadboard-view/useBreadboardDialogState';
import { useProjectId } from '@/lib/contexts/project-id-context';
import {
  useCircuitDesigns,
  useCircuitInstances,
  useCircuitNets,
  useCircuitWires,
  useCreateCircuitDesign,
  useCreateCircuitNet,
  useCreateCircuitWire,
  useCreateCircuitInstance,
  useDeleteCircuitWire,
  useExpandArchitecture,
  useUpdateCircuitInstance,
  useUpdateCircuitWire,
} from '@/lib/circuit-editor/hooks';
import { useComponentParts } from '@/lib/component-editor/hooks';
import { useSimulation } from '@/lib/contexts/simulation-context';
import { useBom, useProjectMeta } from '@/lib/project-context';
import BreadboardGrid from './BreadboardGrid';
import { BreadboardComponentOverlay, detectFamily, getFamilyValues, getCurrentValueLabel } from './BreadboardComponentRenderer';
import BendableLegRenderer from './BendableLegRenderer';
import RatsnestOverlay, { type RatsnestNet, type RatsnestPin } from './RatsnestOverlay';
import BreadboardConnectivityOverlay from './BreadboardConnectivityOverlay';
import BreadboardConnectivityExplainer from './BreadboardConnectivityExplainer';
import { useBreadboardCursor } from '@/lib/circuit-editor/useBreadboardCursor';
import { computeMoveResult } from '@/lib/circuit-editor/breadboard-drag-move';
import { syncSchematicToBreadboard } from '@/lib/circuit-editor/view-sync';
import BreadboardDrcOverlay from './BreadboardDrcOverlay';
import { type ShoppingListItem } from './BreadboardShoppingList';
import BreadboardPartInspector from './BreadboardPartInspector';
import BreadboardWorkbenchSidebar from './BreadboardWorkbenchSidebar';
import BreadboardWireEditor from './BreadboardWireEditor';
import BreadboardBenchPartRenderer from './BreadboardBenchPartRenderer';
import { COMPONENT_DRAG_TYPE } from './ComponentPlacer';
import type { ComponentDragData } from './ComponentPlacer';
import { getBenchConnectorAnchorPositions, type BenchConnectorAnchorPosition } from '@/lib/circuit-editor/breadboard-bench-connectors';
import {
  buildBreadboardBenchSummary,
  indexBreadboardBenchInsights,
  type BreadboardBenchInsight,
} from '@/lib/breadboard-bench';
import {
  buildBreadboardChatPrompt,
  buildBreadboardPlannerPrompt,
  type BreadboardChatActionId,
  type BreadboardPlannerActionId,
  type BreadboardSelectionActionId,
  buildBreadboardSelectionPrompt,
} from '@/lib/breadboard-ai-prompts';
import {
  buildBreadboardSelectedPartModel,
} from '@/lib/breadboard-part-inspector';
import { auditBreadboard, type BoardAuditIssue, type BoardAuditSummary } from '@/lib/breadboard-board-audit';
import { runPreflight, type PreflightResult } from '@/lib/breadboard-preflight';
import {
  useBreadboardCoachPlan,
  normalizeCoachNetName,
  getStarterRefDesPrefix,
  getCoachHookupColor,
} from './useBreadboardCoachPlan';
import { BreadboardCoachPlanOverlay, BreadboardPinAnchorOverlay } from './BreadboardCoachOverlay';
import ToolButton from './ToolButton';
import { Button } from '@/components/ui/button';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { generateRefDes, nextRefdes } from '@/lib/circuit-editor/ref-des';
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
  ShieldAlert,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BB,
  type ColumnLetter,
  type BreadboardCoord,
  type PixelPos,
  type TiePoint,
  coordKey,
  coordToPixel,
  pixelToCoord,
  getBoardDimensions,
  getOccupiedPoints,
  getConnectedPoints,
  checkCollision,
  checkBodyCollision,
  getDefaultColorForNet,
  WIRE_COLOR_PRESETS as MODEL_WIRE_COLOR_PRESETS,
  type ComponentPlacement,
} from '@/lib/circuit-editor/breadboard-model';
import type { CircuitDesignRow, CircuitInstanceRow, CircuitWireRow, ComponentPart } from '@shared/schema';
import type { PartMeta } from '@shared/component-types';
import {
  determinePlacementMode,
  pixelToBench,
  type WireEndpoint as SurfaceWireEndpoint,
  type WireEndpointMeta,
} from '@/lib/circuit-editor/bench-surface-model';
import { UndoRedoStack } from '@/lib/undo-redo';
import type { ExactPartDraftSeed } from '@shared/exact-part-resolver';
import { formatSIValue } from '@/lib/simulation/visual-state';
import type { WireVisualState } from '@/lib/simulation/visual-state';
import { useCanvasAnnouncer } from '@/lib/use-canvas-announcer';
import { getCanvasAriaLabel, getActionAnnouncement, getToolChangeAnnouncement, getZoomAnnouncement } from '@/lib/canvas-accessibility';
import { useSupplierApi } from '@/lib/supplier-api';
import './simulation-overlays.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tool = 'select' | 'wire' | 'delete';

interface WireInProgress {
  netId: number;
  points: PixelPos[];
  coordPath: BreadboardCoord[];
  endpointPath: Array<SurfaceWireEndpoint | null>;
  color: string;
}

interface AutoPlacementPlan {
  id: number;
  breadboardX: number;
  breadboardY: number;
}

function buildAutoPlacementTemplate(inst: CircuitInstanceRow, part?: ComponentPart): ComponentPlacement {
  const meta = (part?.meta as Record<string, unknown> | null) ?? null;
  const properties = (inst.properties as Record<string, unknown> | null) ?? null;
  const rawType = String(meta?.type ?? properties?.type ?? '').toLowerCase();
  const pinCount = (part?.connectors as unknown[])?.length ?? 2;
  const isDipLike = rawType === 'ic' || rawType === 'mcu' || inst.referenceDesignator.startsWith('U');
  const rowSpan = isDipLike ? Math.max(2, Math.ceil(pinCount / 2)) : Math.max(1, Math.ceil(pinCount / 2));

  return {
    refDes: inst.referenceDesignator,
    startCol: isDipLike ? 'e' : 'a',
    startRow: 1,
    rowSpan,
    crossesChannel: isDipLike,
  };
}

function findAutoPlacement(
  template: ComponentPlacement,
  existingPlacements: ComponentPlacement[],
): ComponentPlacement | null {
  const maxStartRow = BB.ROWS - template.rowSpan + 1;

  for (let startRow = 1; startRow <= maxStartRow; startRow += 1) {
    const candidate: ComponentPlacement = { ...template, startRow };
    if (!checkCollision(candidate, existingPlacements)) {
      return candidate;
    }
  }

  return null;
}

// Re-export for backward-compat (canonical home is breadboard-canvas/canvas-helpers)
export { getDropTypeFromPart } from './breadboard-canvas/canvas-helpers';

function isDipLikeType(type: string): boolean {
  const lower = type.toLowerCase();
  return lower === 'ic' || lower === 'mcu' || lower === 'microcontroller';
}

function buildPlacementForDrop(
  coord: TiePoint,
  type: string,
  pinCount: number,
): ComponentPlacement {
  const dipLike = isDipLikeType(type);
  const rowSpan = dipLike ? Math.max(2, Math.ceil(Math.max(pinCount, 4) / 2)) : Math.max(1, Math.ceil(Math.max(pinCount, 2) / 2));
  const maxStartRow = Math.max(1, BB.ROWS - rowSpan + 1);

  return {
    refDes: `${type}-${coord.row}`,
    startCol: dipLike ? 'e' : coord.col,
    startRow: Math.min(coord.row, maxStartRow),
    rowSpan,
    crossesChannel: dipLike,
  };
}

// ---------------------------------------------------------------------------
// Wire color palette (general purpose)
// ---------------------------------------------------------------------------

const WIRE_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#34495e', '#e91e63', '#00bcd4',
];

// Wire color presets — sourced from breadboard-model (BL-0591)
const WIRE_COLOR_PRESETS = MODEL_WIRE_COLOR_PRESETS;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BreadboardView() {
  const projectId = useProjectId();
  const { projectName, setActiveView } = useProjectMeta();
  const { addBomItem, bom, updateBomItem } = useBom();
  const { quoteBom, searchPart } = useSupplierApi();
  const { toast } = useToast();
  const { data: circuits, isLoading: loadingCircuits } = useCircuitDesigns(projectId);
  const { data: parts } = useComponentParts(projectId);
  const createCircuitMutation = useCreateCircuitDesign();
  const createInstanceMutation = useCreateCircuitInstance();
  const expandMutation = useExpandArchitecture();
  const [activeCircuitId, setActiveCircuitId] = useState<number | null>(null);
  const dialogState = useBreadboardDialogState();
  const [exactDraftSeed, setExactDraftSeed] = useState<ExactPartDraftSeed | null>(null);
  const [workbenchOpen, setWorkbenchOpen] = useState(true);

  const activeCircuit = circuits?.find(c => c.id === activeCircuitId) ?? circuits?.[0] ?? null;
  const circuitId = activeCircuit?.id ?? 0;
  const { data: instances } = useCircuitInstances(circuitId);
  const { data: nets } = useCircuitNets(circuitId);
  const { data: wires } = useCircuitWires(circuitId);
  const [boardAuditEnabled, setBoardAuditEnabled] = useState(false);
  const [focusAuditIssue, setFocusAuditIssue] = useState<BoardAuditIssue | null>(null);
  const breadboardWires = useMemo(
    () => (wires ?? []).filter((wire) => wire.view === 'breadboard'),
    [wires],
  );
  const breadboardWireCount = useMemo(
    () => breadboardWires.length,
    [breadboardWires],
  );
  const placedInstanceCount = useMemo(
    () => (instances ?? []).filter((instance) => instance.breadboardX != null && instance.breadboardY != null).length,
    [instances],
  );
  const benchSummary = useMemo(
    () => buildBreadboardBenchSummary(parts, bom),
    [bom, parts],
  );
  const benchInsights = useMemo(
    () => indexBreadboardBenchInsights(benchSummary.insights),
    [benchSummary.insights],
  );
  const computedBoardAudit = useMemo(() => {
    if (!activeCircuit) {
      return null;
    }

    return auditBreadboard({
      instances: instances ?? [],
      wires: breadboardWires,
      nets: nets ?? [],
      parts: parts ?? [],
    });
  }, [activeCircuit, breadboardWires, instances, nets, parts]);
  const boardAudit = boardAuditEnabled ? computedBoardAudit : null;
  const [preflightResult, setPreflightResult] = useState<PreflightResult | null>(null);
  const shoppingListItems = useMemo(() => {
    const missingInsights = benchSummary.insights.filter((insight) => insight.missingQuantity > 0);
    if (missingInsights.length === 0) {
      return [] as ShoppingListItem[];
    }

    const quotedItems = missingInsights
      .filter((insight) => insight.mpn && insight.mpn.trim().length > 0)
      .map((insight) => ({
        mpn: insight.mpn!,
        quantity: insight.missingQuantity,
      }));
    const quote = quotedItems.length > 0 ? quoteBom(quotedItems) : null;
    const quoteMap = new Map((quote?.items ?? []).map((item) => [item.mpn.toLowerCase(), item.bestPrice]));

    return missingInsights.map<ShoppingListItem>((insight) => {
      const exactMpn = insight.mpn?.trim() ?? '';
      const fallbackSearch = exactMpn.length === 0 ? searchPart(insight.title, { maxResults: 1 })[0] : null;
      const bestPrice = exactMpn.length > 0
        ? quoteMap.get(exactMpn.toLowerCase()) ?? null
        : fallbackSearch?.offers?.[0]
          ? {
              distributor: fallbackSearch.offers[0].distributorId,
              unitPrice: fallbackSearch.offers[0].pricing[0]?.unitPrice ?? 0,
              totalPrice: (fallbackSearch.offers[0].pricing[0]?.unitPrice ?? 0) * insight.missingQuantity,
              sku: fallbackSearch.offers[0].sku,
            }
          : null;

      return {
        partName: insight.title,
        mpn: exactMpn || fallbackSearch?.mpn || '',
        quantityNeeded: insight.missingQuantity,
        bestPrice,
      };
    });
  }, [benchSummary.insights, quoteBom, searchPart]);

  useEffect(() => {
    setFocusAuditIssue(null);
  }, [circuitId]);

  const openChatPanel = useCallback((detail: { designAgent?: boolean; prompt?: string }) => {
    window.dispatchEvent(new CustomEvent('protopulse:open-chat-panel', { detail }));
  }, []);

  const handleOpenBenchChat = useCallback(
    (actionId: BreadboardChatActionId) => {
      const message = buildBreadboardChatPrompt(actionId, {
        projectName,
        insights: benchSummary.insights,
      });
      openChatPanel({ designAgent: false });
      window.dispatchEvent(new CustomEvent('protopulse:chat-send', { detail: { message } }));
    },
    [benchSummary.insights, openChatPanel, projectName],
  );

  const handleOpenBenchPlanner = useCallback(
    (actionId: BreadboardPlannerActionId) => {
      const prompt = buildBreadboardPlannerPrompt(actionId, {
        projectName,
        insights: benchSummary.insights,
      });
      openChatPanel({ designAgent: true, prompt });
      toast({
        title: 'Gemini ER planner primed',
        description: 'The Design Agent is ready with a breadboard-specific planning brief.',
      });
    },
    [benchSummary.insights, openChatPanel, projectName, toast],
  );

  const handleTrackBenchPart = useCallback(
    (
      partId: number,
      values: { minimumStock: number; quantityOnHand: number; storageLocation: string | null },
    ) => {
      const part = parts?.find((candidate) => candidate.id === partId);
      const insight = benchInsights[partId];
      const meta = (part?.meta as Partial<PartMeta> | null) ?? null;

      if (!part || !insight) {
        toast({
          title: 'Could not track stash item',
          description: 'That bench part is no longer available in the project library.',
          variant: 'destructive',
        });
        return;
      }

      addBomItem({
        partNumber: meta?.mpn ?? meta?.title ?? `PART-${String(partId)}`,
        manufacturer: meta?.manufacturer ?? 'Unknown',
        description: meta?.title ?? insight.title,
        quantity: insight.requiredQuantity,
        unitPrice: 0,
        totalPrice: 0,
        supplier: 'Unknown',
        stock: values.quantityOnHand,
        status:
          values.quantityOnHand === 0
            ? 'Out of Stock'
            : values.quantityOnHand <= values.minimumStock
              ? 'Low Stock'
              : 'In Stock',
        storageLocation: values.storageLocation,
        quantityOnHand: values.quantityOnHand,
        minimumStock: values.minimumStock,
      });

      toast({
        title: 'Part added to bench stash',
        description: `${insight.title} is now tracked for this project.`,
      });
    },
    [addBomItem, benchInsights, parts, toast],
  );

  const handleQuickIntake = useCallback(
    (item: { partName: string; quantity: number; storageLocation: string | null }) => {
      addBomItem({
        partNumber: item.partName,
        manufacturer: 'Unknown',
        description: item.partName,
        quantity: item.quantity,
        unitPrice: 0,
        totalPrice: 0,
        supplier: 'Unknown',
        stock: item.quantity,
        status: item.quantity > 0 ? 'In Stock' : 'Out of Stock',
        storageLocation: item.storageLocation,
        quantityOnHand: item.quantity,
        minimumStock: 1,
      });
      toast({
        title: 'Part added to stash',
        description: `${item.partName} × ${String(item.quantity)} tracked${item.storageLocation ? ` @ ${item.storageLocation}` : ''}.`,
      });
    },
    [addBomItem, toast],
  );

  const handleQuickIntakeScan = useCallback(() => {
    setActiveView('storage');
    toast({
      title: 'Opened storage tools',
      description: 'Use the barcode scanner in Storage to capture part labels, then return here to finish intake.',
    });
  }, [setActiveView, toast]);

  const handleUpdateTrackedBenchPart = useCallback(
    (
      bomItemId: string,
      values: { minimumStock: number; quantityOnHand: number; storageLocation: string | null },
    ) => {
      updateBomItem(bomItemId, {
        stock: values.quantityOnHand,
        status:
          values.quantityOnHand === 0
            ? 'Out of Stock'
            : values.quantityOnHand <= values.minimumStock
              ? 'Low Stock'
              : 'In Stock',
        storageLocation: values.storageLocation,
        quantityOnHand: values.quantityOnHand,
        minimumStock: values.minimumStock,
      });

      toast({
        title: 'Bench stash updated',
        description: 'Inventory details were refreshed for this build.',
      });
    },
    [toast, updateBomItem],
  );

  const handleCreateCircuit = useCallback(async (): Promise<CircuitDesignRow | null> => {
    try {
      const result = await createCircuitMutation.mutateAsync({
        projectId,
        name: 'Breadboard Wiring Canvas',
      });
      setActiveCircuitId(result.id);
      toast({
        title: 'Wiring canvas ready',
        description: 'You can start dropping parts directly onto the breadboard now.',
      });
      return result;
    } catch (error) {
      toast({
        title: 'Could not create wiring canvas',
        description: error instanceof Error ? error.message : 'Try again in a moment.',
        variant: 'destructive',
      });
      return null;
    }
  }, [createCircuitMutation, projectId, toast]);

  const handleExpandArchitecture = useCallback(async () => {
    try {
      const result = await expandMutation.mutateAsync({ projectId });
      setActiveCircuitId(result.circuit.id);
      toast({
        title: 'Architecture expanded',
        description: `Created ${String(result.instanceCount)} instances and ${String(result.netCount)} nets for breadboard work.`,
      });
    } catch (error) {
      toast({
        title: 'Could not expand architecture',
        description: error instanceof Error ? error.message : 'Try again in a moment.',
        variant: 'destructive',
      });
    }
  }, [expandMutation, projectId, toast]);

  const handleRunBoardAudit = useCallback(() => {
    if (!computedBoardAudit) {
      return;
    }

    setBoardAuditEnabled(true);
    setWorkbenchOpen(true);

    const criticalCount = computedBoardAudit.issues.filter((issue) => issue.severity === 'critical').length;
    const warningCount = computedBoardAudit.issues.filter((issue) => issue.severity === 'warning').length;

    toast({
      title:
        criticalCount > 0
          ? 'Board health found critical issues'
          : warningCount > 0
            ? 'Board health found follow-up items'
            : 'Board health looks clean',
      description:
        criticalCount > 0 || warningCount > 0
          ? `${String(criticalCount)} critical, ${String(warningCount)} warning issues across ${String(computedBoardAudit.stats.totalInstances)} placed parts.`
          : `No board-health issues detected across ${String(computedBoardAudit.stats.totalInstances)} placed parts.`,
    });
  }, [computedBoardAudit, toast]);

  const handleFocusBoardIssue = useCallback((issue: BoardAuditIssue) => {
    setBoardAuditEnabled(true);
    setWorkbenchOpen(true);
    setFocusAuditIssue(issue);
  }, []);

  const handleRunPreflight = useCallback(() => {
    const result = runPreflight({
      instances: instances ?? [],
      wires: breadboardWires,
      nets: nets ?? [],
      parts: parts ?? [],
    });
    setPreflightResult(result);
    setWorkbenchOpen(true);
    const failed = result.checks.filter((c) => c.status === 'fail').length;
    const warned = result.checks.filter((c) => c.status === 'warn').length;
    toast({
      title:
        failed > 0
          ? 'Pre-flight found blocking issues'
          : warned > 0
            ? 'Pre-flight found warnings to review'
            : 'Pre-flight clean — ready to build',
      description: `${String(failed)} failed, ${String(warned)} warning${warned === 1 ? '' : 's'} across ${String(result.checks.length)} checks.`,
    });
  }, [instances, breadboardWires, nets, parts, toast]);

  const handleShopMissing = useCallback(() => {
    dialogState.open('shopping-list');
  }, [dialogState]);

  const handleLaunchExactDraft = useCallback((seed: ExactPartDraftSeed) => {
    setExactDraftSeed(seed);
    dialogState.open('exact-draft');
  }, [dialogState]);

  const handleStageExactPartOnBench = useCallback(async (part: ComponentPart) => {
    const nextCircuit = activeCircuit ?? await handleCreateCircuit();
    if (!nextCircuit) {
      return;
    }

    const partMeta = (part.meta ?? {}) as Partial<PartMeta>;
    const partType = getDropTypeFromPart(part, 'component');
    createInstanceMutation.mutate({
      circuitId: nextCircuit.id,
      partId: part.id,
      breadboardX: null,
      breadboardY: null,
      properties: {
        componentTitle: partMeta.title ?? '',
        label: partMeta.title ?? 'Exact part',
        type: partType,
      },
    });

    dialogState.close();
    toast({
      title: activeCircuit ? 'Exact part staged for the bench' : 'Canvas created and exact part staged',
      description: `${partMeta.title ?? 'The selected part'} will auto-place onto the breadboard workspace.`,
    });
  }, [activeCircuit, createInstanceMutation, handleCreateCircuit, toast]);

  const handleExactDraftCreated = useCallback((part: ComponentPart) => {
    void handleStageExactPartOnBench(part);
  }, [handleStageExactPartOnBench]);

  const handleExactDraftOpenChange = useCallback((open: boolean) => {
    if (open) {
      dialogState.open('exact-draft');
    } else {
      dialogState.close();
      setExactDraftSeed(null);
    }
  }, [dialogState]);

  if (loadingCircuits) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="breadboard-loading">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-[linear-gradient(180deg,rgba(2,6,12,0.96),rgba(7,9,16,0.96))]" data-testid="breadboard-view">
      {workbenchOpen && (
        <BreadboardWorkbenchSidebar
          benchInsights={benchInsights}
          benchSummary={benchSummary}
          boardAudit={boardAudit}
          createPending={createCircuitMutation.isPending}
          expandPending={expandMutation.isPending}
          hasCircuits={Boolean(circuits && circuits.length > 0)}
          onFocusBoardIssue={handleFocusBoardIssue}
          placedInstanceCount={placedInstanceCount}
          projectPartCount={parts?.length ?? 0}
          wireCount={breadboardWireCount}
          onCreateCircuit={() => void handleCreateCircuit()}
          onOpenInventory={() => dialogState.open('inventory')}
          onOpenBenchChat={handleOpenBenchChat}
          onOpenBenchPlanner={handleOpenBenchPlanner}
          onOpenExactPartRequest={() => dialogState.open('exact-part')}
          onExpandArchitecture={() => void handleExpandArchitecture()}
          onOpenComponentEditor={() => setActiveView('component_editor')}
          onOpenCommunity={() => setActiveView('community')}
          onOpenSchematic={() => setActiveView('schematic')}
          onRunBoardAudit={handleRunBoardAudit}
          onRunPreflight={handleRunPreflight}
          preflightResult={preflightResult}
          onShopMissing={handleShopMissing}
          onQuickAdd={handleQuickIntake}
          onQuickScan={handleQuickIntakeScan}
        />
      )}

      <BreadboardDialogs
        dialogState={dialogState}
        projectId={projectId}
        parts={parts ?? []}
        activeCircuitReady={Boolean(activeCircuit)}
        shoppingListItems={shoppingListItems}
        insights={benchSummary.insights}
        exactDraftSeed={exactDraftSeed}
        onCreateExactDraft={handleLaunchExactDraft}
        onOpenComponentEditor={() => setActiveView('component_editor')}
        onPlaceResolvedPart={(part) => void handleStageExactPartOnBench(part)}
        onExactDraftCreated={handleExactDraftCreated}
        onExactDraftOpenChange={handleExactDraftOpenChange}
        onOpenAiReconcile={() => handleOpenBenchPlanner('reconcile_inventory')}
        onOpenStorageView={() => setActiveView('storage')}
        onTrackPart={handleTrackBenchPart}
        onUpdateTrackedPart={handleUpdateTrackedBenchPart}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {circuits && circuits.length > 0 ? (
          <>
            <BreadboardToolbar
              circuits={circuits}
              activeCircuit={activeCircuit}
              onSelectCircuit={setActiveCircuitId}
              workbenchOpen={workbenchOpen}
              onToggleWorkbench={() => setWorkbenchOpen((open) => !open)}
            />
            {activeCircuit ? (
              <BreadboardCanvas
                boardAudit={boardAudit}
                circuitId={circuitId}
                benchInsights={benchInsights}
                focusAuditIssue={focusAuditIssue}
                onConsumeFocusAuditIssue={() => setFocusAuditIssue(null)}
                onRunBoardAudit={handleRunBoardAudit}
                projectName={projectName}
              />
            ) : null}
          </>
        ) : (
          <BreadboardEmptyState
            onCreateCircuit={() => void handleCreateCircuit()}
            isCreating={createCircuitMutation.isPending}
            onExpandArchitecture={() => void handleExpandArchitecture()}
            isExpanding={expandMutation.isPending}
            onOpenSchematic={() => setActiveView('schematic')}
          />
        )}
      </div>
    </div>
  );
}
