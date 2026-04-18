/**
 * BreadboardView — interactive breadboard editor with component placement,
 * wire drawing, and ratsnest overlay.
 */

import './breadboard-animations.css';
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
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

function getDropTypeFromPart(part: ComponentPart | undefined, fallbackType: string): string {
  const meta = (part?.meta ?? {}) as Partial<PartMeta> & Record<string, unknown>;
  const candidate = meta.type ?? meta.family ?? fallbackType;
  return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate : fallbackType;
}

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

// ---------------------------------------------------------------------------
// Canvas (main interactive area)
// ---------------------------------------------------------------------------

function BreadboardCanvas({
  boardAudit,
  circuitId,
  benchInsights,
  focusAuditIssue,
  onConsumeFocusAuditIssue,
  onRunBoardAudit,
  projectName,
}: {
  boardAudit: BoardAuditSummary | null;
  circuitId: number;
  benchInsights: Record<number, BreadboardBenchInsight>;
  focusAuditIssue: BoardAuditIssue | null;
  onConsumeFocusAuditIssue: () => void;
  onRunBoardAudit: () => void;
  projectName: string;
}) {
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
  const [zoom, setZoom] = useState(3);
  const [panOffset, setPanOffset] = useState<PixelPos>({ x: 20, y: 20 });
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
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const lastMouse = useRef<PixelPos>({ x: 0, y: 0 });
  const autoPlacementRequests = useRef<Set<number>>(new Set());
  const undoStack = useRef(new UndoRedoStack());

  const partsMap = useMemo(
    () => new Map((parts ?? []).map((part: ComponentPart) => [part.id, part])),
    [parts],
  );

  const centerOnBoardPixel = useCallback((pixel: PixelPos) => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const rect = container.getBoundingClientRect();
    setPanOffset({
      x: rect.width / 2 - pixel.x * zoom,
      y: rect.height / 2 - pixel.y * zoom,
    });
  }, [zoom]);

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
      console.error('Failed to apply bench coach plan', error);
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

  const auditCriticalCount = boardAudit?.issues.filter((issue) => issue.severity === 'critical').length ?? 0;
  const auditWarningCount = boardAudit?.issues.filter((issue) => issue.severity === 'warning').length ?? 0;
  const auditToolbarLabel = boardAudit == null
    ? 'Run audit'
    : auditCriticalCount > 0
      ? `${String(auditCriticalCount)} critical`
      : auditWarningCount > 0
        ? `${String(auditWarningCount)} warning${auditWarningCount === 1 ? '' : 's'}`
        : 'Healthy';
  const auditToolbarTone = boardAudit == null
    ? 'border-border text-muted-foreground'
    : auditCriticalCount > 0
      ? 'border-red-500/40 bg-red-500/10 text-red-300'
      : auditWarningCount > 0
        ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300'
        : 'border-green-500/40 bg-green-500/10 text-green-300';

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
        <div className="w-px h-4 bg-border mx-1" />
        <ToolButton icon={ShieldAlert} label="DRC Check" active={showDrc} onClick={() => setShowDrc(d => !d)} testId="tool-drc-toggle" />
        <ToolButton icon={HelpCircle} label="How a breadboard works" active={showConnectivityExplainer} onClick={() => setShowConnectivityExplainer(v => !v)} testId="tool-connectivity-explainer-toggle" />
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-testid="button-run-audit-inline"
          onClick={onRunBoardAudit}
          className={cn('ml-1 h-6 gap-1.5 px-2 text-[10px] uppercase tracking-[0.14em]', auditToolbarTone)}
        >
          <ShieldAlert className="h-3 w-3" />
          <span>{auditToolbarLabel}</span>
          {boardAudit && (
            <span className="tabular-nums opacity-90">{String(boardAudit.score)}</span>
          )}
        </Button>
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

        {/* Coordinate readout */}
        {mouseBoardPos && (
          <div
            className="absolute bottom-3 right-3 z-10 bg-card/70 backdrop-blur-sm border border-border px-2 py-1 pointer-events-none select-none"
            data-testid="coordinate-readout"
          >
            <span className="text-[11px] font-mono tabular-nums text-[var(--color-editor-accent)]">
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

        {/* BB-02 / BB-03: Empty state guidance when no components are placed */}
        {(!instances || instances.filter(i => i.breadboardX != null).length === 0) && (
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-card/80 backdrop-blur-xl border border-border px-4 py-2.5 shadow-lg max-w-sm text-center"
            data-testid="breadboard-empty-guidance"
          >
            <div className="flex items-center gap-2 justify-center mb-1">
              <Info className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs font-medium text-foreground">Start Wiring</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Drag a starter part or a project library component onto the board, then use the <strong>Wire tool (2)</strong> to connect real pin rows. <strong>Double-click</strong> finishes a wire run.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
