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
import { CapacitorSvg, ResistorSvg } from './breadboard-components';
import RatsnestOverlay, { type RatsnestNet, type RatsnestPin } from './RatsnestOverlay';
import BreadboardConnectivityOverlay from './BreadboardConnectivityOverlay';
import { syncSchematicToBreadboard } from '@/lib/circuit-editor/view-sync';
import BreadboardDrcOverlay from './BreadboardDrcOverlay';
import BreadboardInventoryDialog from './BreadboardInventoryDialog';
import BreadboardExactPartRequestDialog from './BreadboardExactPartRequestDialog';
import BreadboardPartInspector, { type BreadboardCoachActionItem } from './BreadboardPartInspector';
import BreadboardWorkbenchSidebar from './BreadboardWorkbenchSidebar';
import BreadboardWireEditor from './BreadboardWireEditor';
import { COMPONENT_DRAG_TYPE } from './ComponentPlacer';
import type { ComponentDragData } from './ComponentPlacer';
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
  buildBreadboardCoachPlan,
  type BreadboardCoachHookup,
  type BreadboardCoachRailBridge,
  type BreadboardCoachSuggestion,
} from '@/lib/breadboard-coach-plan';
import {
  buildBreadboardSelectedPartModel,
  type BreadboardPinRole,
} from '@/lib/breadboard-part-inspector';
import { calculateBreadboardLayoutQuality } from '@/lib/breadboard-layout-quality';
import ToolButton from './ToolButton';
import { Button } from '@/components/ui/button';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import ExactPartDraftModal from '@/components/views/component-editor/ExactPartDraftModal';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BB,
  type BreadboardCoord,
  type ColumnLetter,
  type PixelPos,
  type TiePoint,
  coordKey,
  coordToPixel,
  pixelToCoord,
  areConnected,
  getBoardDimensions,
  getOccupiedPoints,
  getConnectedPoints,
  checkCollision,
  getDefaultColorForNet,
  WIRE_COLOR_PRESETS as MODEL_WIRE_COLOR_PRESETS,
  type ComponentPlacement,
} from '@/lib/circuit-editor/breadboard-model';
import type { CircuitDesignRow, CircuitInstanceRow, CircuitNetRow, CircuitWireRow, ComponentPart } from '@shared/schema';
import type { PartMeta } from '@shared/component-types';
import type { ExactPartDraftSeed } from '@shared/exact-part-resolver';
import { formatSIValue } from '@/lib/simulation/visual-state';
import type { WireVisualState } from '@/lib/simulation/visual-state';
import { useCanvasAnnouncer } from '@/lib/use-canvas-announcer';
import { getCanvasAriaLabel, getActionAnnouncement, getToolChangeAnnouncement, getZoomAnnouncement } from '@/lib/canvas-accessibility';
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

interface AutoPlacementPlan {
  id: number;
  breadboardX: number;
  breadboardY: number;
}

interface ResolvedCoachSuggestion extends BreadboardCoachSuggestion {
  anchor: TiePoint;
  placement: ComponentPlacement;
  pixel: PixelPos;
  targetPixels: PixelPos[];
}

interface StagedCoachSuggestion extends BreadboardCoachSuggestion {
  instanceId: number;
  pixel: PixelPos;
  referenceDesignator: string;
  targetPixels: PixelPos[];
}

interface ResolvedCoachHookup extends BreadboardCoachHookup {
  isRouted: boolean;
  netId: number | null;
  path: PixelPos[];
  railPixel: PixelPos;
  targetPixel: PixelPos;
}

interface ResolvedCoachBridge extends BreadboardCoachRailBridge {
  isRouted: boolean;
  netId: number | null;
  path: PixelPos[];
  fromPixel: PixelPos;
  toPixel: PixelPos;
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

function clampBreadboardRow(row: number, maxRow: number = BB.ROWS): number {
  return Math.max(1, Math.min(maxRow, row));
}

function getCoachToneColor(tone: 'power' | 'communication' | 'control' | 'analog'): string {
  switch (tone) {
    case 'power':
      return '#fb7185';
    case 'communication':
      return '#22d3ee';
    case 'control':
      return '#f59e0b';
    case 'analog':
    default:
      return '#a3e635';
  }
}

function getCoachHookupColor(netType: 'power' | 'ground'): string {
  return netType === 'power' ? '#fb7185' : '#38bdf8';
}

function buildCoachHookupPath(railPixel: PixelPos, targetPixel: PixelPos): PixelPos[] {
  const elbowX = railPixel.x < targetPixel.x ? railPixel.x + 10 : railPixel.x - 10;
  const rawPath = [
    railPixel,
    { x: elbowX, y: railPixel.y },
    targetPixel,
  ];

  if (railPixel.y !== targetPixel.y) {
    rawPath.splice(2, 0, { x: elbowX, y: targetPixel.y });
  }

  return rawPath.filter((point, index) => index === 0 || point.x !== rawPath[index - 1]?.x || point.y !== rawPath[index - 1]?.y);
}

function buildCoachRailBridgePath(fromPixel: PixelPos, toPixel: PixelPos): PixelPos[] {
  return (fromPixel.x <= toPixel.x ? [fromPixel, toPixel] : [toPixel, fromPixel]).filter(
    (point, index, points) => index === 0 || point.x !== points[index - 1]?.x || point.y !== points[index - 1]?.y,
  );
}

function pointsMatch(left: PixelPos[], right: PixelPos[]): boolean {
  return left.length === right.length && left.every((point, index) => point.x === right[index]?.x && point.y === right[index]?.y);
}

function reversePoints(points: PixelPos[]): PixelPos[] {
  return [...points].reverse();
}

function getWireEndpointCoords(points: PixelPos[]): [BreadboardCoord | null, BreadboardCoord | null] {
  if (points.length < 2) {
    return [null, null];
  }

  return [pixelToCoord(points[0]), pixelToCoord(points[points.length - 1])];
}

function wireMatchesCoachConnection(
  wire: CircuitWireRow,
  expectedNetId: number | null,
  endpointA: BreadboardCoord,
  endpointB: BreadboardCoord,
): boolean {
  if (expectedNetId == null || wire.netId !== expectedNetId) {
    return false;
  }

  const points = ((wire.points as Array<{ x: number; y: number }> | null) ?? []).map((point) => ({
    x: point.x,
    y: point.y,
  }));
  const [startCoord, endCoord] = getWireEndpointCoords(points);
  if (!startCoord || !endCoord) {
    return false;
  }

  return (
    (areConnected(startCoord, endpointA) && areConnected(endCoord, endpointB))
    || (areConnected(startCoord, endpointB) && areConnected(endCoord, endpointA))
  );
}

function normalizeCoachNetName(name: string): string {
  return name.trim().toUpperCase();
}

function findCoachNetId(
  nets: CircuitNetRow[] | undefined,
  hookup: Pick<BreadboardCoachHookup, 'netName' | 'netType'>,
): number | null {
  if (!nets || nets.length === 0) {
    return null;
  }

  const exactMatch = nets.find((net) => normalizeCoachNetName(net.name) === normalizeCoachNetName(hookup.netName));
  if (exactMatch) {
    return exactMatch.id;
  }

  const typedMatch = nets.find((net) => net.netType === hookup.netType);
  return typedMatch?.id ?? null;
}

function getStarterRefDesPrefix(type: string): string {
  const lower = type.toLowerCase();
  if (lower === 'mcu' || lower === 'ic' || lower === 'microcontroller') {
    return 'U';
  }
  if (lower === 'resistor') {
    return 'R';
  }
  if (lower === 'capacitor') {
    return 'C';
  }
  if (lower === 'diode') {
    return 'D';
  }
  if (lower === 'transistor') {
    return 'Q';
  }
  if (lower === 'led') {
    return 'LED';
  }
  if (lower === 'switch') {
    return 'SW';
  }
  return lower.charAt(0).toUpperCase() || 'X';
}

function resolveCoachSuggestionPlacement(
  suggestion: BreadboardCoachSuggestion,
  placements: ComponentPlacement[],
  targetPixels: PixelPos[],
): ResolvedCoachSuggestion | null {
  const rowOffsets = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5];

  for (const offset of rowOffsets) {
    for (const col of suggestion.preferredColumns) {
      const anchor: TiePoint = {
        type: 'terminal',
        col,
        row: clampBreadboardRow(
          suggestion.desiredAnchor.row + offset,
          suggestion.type === 'capacitor' ? BB.ROWS - 1 : BB.ROWS,
        ),
      };
      const placement = buildPlacementForDrop(anchor, suggestion.type, 2);
      const candidatePlacement = {
        ...placement,
        refDes: suggestion.id,
      };
      if (checkCollision(candidatePlacement, placements)) {
        continue;
      }

      return {
        ...suggestion,
        anchor,
        placement: candidatePlacement,
        pixel: coordToPixel({
          type: 'terminal',
          col: candidatePlacement.startCol,
          row: candidatePlacement.startRow,
        }),
        targetPixels,
      };
    }
  }

  return null;
}

function getPinRoleColor(role: BreadboardPinRole): string {
  switch (role) {
    case 'power':
      return '#fb7185';
    case 'ground':
      return '#38bdf8';
    case 'clock':
      return '#a78bfa';
    case 'control':
      return '#f59e0b';
    case 'communication':
      return '#22d3ee';
    case 'analog':
      return '#a3e635';
    case 'passive':
      return '#34d399';
    case 'signal':
    default:
      return '#e2e8f0';
  }
}

function CoachSuggestionOverlay({
  suggestion,
  status,
}: {
  suggestion: Pick<BreadboardCoachSuggestion, 'id' | 'label' | 'priority' | 'type' | 'value'> & {
    pixel: PixelPos;
    targetPixels: PixelPos[];
  };
  status: 'pending' | 'staged';
}) {
  const isCapacitor = suggestion.type === 'capacitor';
  const strokeColor = suggestion.priority === 'critical' ? '#fb7185' : '#22d3ee';
  const textColor = suggestion.priority === 'critical' ? '#fecdd3' : '#cffafe';
  const subhead = status === 'pending'
    ? suggestion.priority === 'critical'
      ? 'critical coach move'
      : 'recommended support move'
    : 'staged support';

  return (
    <g data-testid={`breadboard-coach-suggestion-${suggestion.id}`}>
      {suggestion.targetPixels.map((targetPixel, index) => (
        <line
          key={`${suggestion.id}-target-${index}`}
          x1={suggestion.pixel.x}
          y1={suggestion.pixel.y}
          x2={targetPixel.x}
          y2={targetPixel.y}
          stroke={strokeColor}
          strokeWidth={status === 'pending' ? 0.9 : 0.85}
          strokeDasharray={status === 'pending' ? '2 2' : undefined}
          opacity={status === 'pending' ? 0.7 : 0.45}
        />
      ))}

      {status === 'pending' ? (
        <g opacity={0.45}>
          {isCapacitor ? (
            <CapacitorSvg cx={suggestion.pixel.x} cy={suggestion.pixel.y} farads={Number(suggestion.value)} />
          ) : (
            <ResistorSvg cx={suggestion.pixel.x} cy={suggestion.pixel.y} ohms={Number(suggestion.value)} />
          )}
        </g>
      ) : (
        <g opacity={0.74}>
          <circle cx={suggestion.pixel.x} cy={suggestion.pixel.y} r={9} fill={`${strokeColor}16`} />
          <circle cx={suggestion.pixel.x} cy={suggestion.pixel.y} r={11} fill="none" stroke={strokeColor} strokeWidth={0.9} />
        </g>
      )}

      <rect
        x={suggestion.pixel.x + 10}
        y={suggestion.pixel.y - 15}
        width={56}
        height={18}
        rx={4}
        fill={status === 'pending' ? 'rgba(4,8,15,0.88)' : 'rgba(4,8,15,0.76)'}
        stroke={strokeColor}
        strokeWidth={0.75}
      />
      <text
        x={suggestion.pixel.x + 14}
        y={suggestion.pixel.y - 8}
        fill={textColor}
        fontSize={4.4}
        fontFamily="monospace"
      >
        {suggestion.label}
      </text>
      <text
        x={suggestion.pixel.x + 14}
        y={suggestion.pixel.y - 2}
        fill={status === 'pending' ? '#cbd5e1' : textColor}
        fontSize={3.8}
        fontFamily="monospace"
        opacity={status === 'pending' ? 0.9 : 0.82}
      >
        {subhead}
      </text>
    </g>
  );
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
  const { toast } = useToast();
  const { data: circuits, isLoading: loadingCircuits } = useCircuitDesigns(projectId);
  const { data: parts } = useComponentParts(projectId);
  const createCircuitMutation = useCreateCircuitDesign();
  const createInstanceMutation = useCreateCircuitInstance();
  const expandMutation = useExpandArchitecture();
  const [activeCircuitId, setActiveCircuitId] = useState<number | null>(null);
  const [exactDraftModalOpen, setExactDraftModalOpen] = useState(false);
  const [exactDraftSeed, setExactDraftSeed] = useState<ExactPartDraftSeed | null>(null);
  const [exactPartDialogOpen, setExactPartDialogOpen] = useState(false);
  const [inventoryDialogOpen, setInventoryDialogOpen] = useState(false);
  const [workbenchOpen, setWorkbenchOpen] = useState(true);

  const activeCircuit = circuits?.find(c => c.id === activeCircuitId) ?? circuits?.[0] ?? null;
  const circuitId = activeCircuit?.id ?? 0;
  const { data: instances } = useCircuitInstances(circuitId);
  const { data: wires } = useCircuitWires(circuitId);
  const breadboardWireCount = useMemo(
    () => (wires ?? []).filter((wire) => wire.view === 'breadboard').length,
    [wires],
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

  const handleLaunchExactDraft = useCallback((seed: ExactPartDraftSeed) => {
    setExactPartDialogOpen(false);
    setExactDraftSeed(seed);
    setExactDraftModalOpen(true);
  }, []);

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

    setExactPartDialogOpen(false);
    toast({
      title: activeCircuit ? 'Exact part staged for the bench' : 'Canvas created and exact part staged',
      description: `${partMeta.title ?? 'The selected part'} will auto-place onto the breadboard workspace.`,
    });
  }, [activeCircuit, createInstanceMutation, handleCreateCircuit, toast]);

  const handleExactDraftCreated = useCallback((part: ComponentPart) => {
    void handleStageExactPartOnBench(part);
  }, [handleStageExactPartOnBench]);

  const handleExactDraftOpenChange = useCallback((open: boolean) => {
    setExactDraftModalOpen(open);
    if (!open) {
      setExactDraftSeed(null);
    }
  }, []);

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
          createPending={createCircuitMutation.isPending}
          expandPending={expandMutation.isPending}
          hasCircuits={Boolean(circuits && circuits.length > 0)}
          placedInstanceCount={placedInstanceCount}
          projectPartCount={parts?.length ?? 0}
          wireCount={breadboardWireCount}
          onCreateCircuit={() => void handleCreateCircuit()}
          onOpenInventory={() => setInventoryDialogOpen(true)}
          onOpenBenchChat={handleOpenBenchChat}
          onOpenBenchPlanner={handleOpenBenchPlanner}
          onOpenExactPartRequest={() => setExactPartDialogOpen(true)}
          onExpandArchitecture={() => void handleExpandArchitecture()}
          onOpenComponentEditor={() => setActiveView('component_editor')}
          onOpenCommunity={() => setActiveView('community')}
          onOpenSchematic={() => setActiveView('schematic')}
        />
      )}

      <BreadboardExactPartRequestDialog
        activeCircuitReady={Boolean(activeCircuit)}
        open={exactPartDialogOpen}
        parts={parts ?? []}
        onCreateExactDraft={handleLaunchExactDraft}
        onOpenChange={setExactPartDialogOpen}
        onOpenComponentEditor={() => {
          setExactPartDialogOpen(false);
          setActiveView('component_editor');
        }}
        onPlaceResolvedPart={(part) => void handleStageExactPartOnBench(part)}
      />

      <ExactPartDraftModal
        open={exactDraftModalOpen}
        projectId={projectId}
        initialSeed={exactDraftSeed ?? undefined}
        onCreated={handleExactDraftCreated}
        onOpenChange={handleExactDraftOpenChange}
      />

      <BreadboardInventoryDialog
        insights={benchSummary.insights}
        open={inventoryDialogOpen}
        onOpenAiReconcile={() => handleOpenBenchPlanner('reconcile_inventory')}
        onOpenChange={setInventoryDialogOpen}
        onOpenStorageView={() => {
          setInventoryDialogOpen(false);
          setActiveView('storage');
        }}
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
                circuitId={circuitId}
                benchInsights={benchInsights}
                projectName={projectName}
              />
            ) : null}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6" data-testid="breadboard-empty">
            <div className="max-w-2xl rounded-[28px] border border-primary/15 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),rgba(15,23,42,0.78)_55%,rgba(15,23,42,0.96))] p-8 text-center shadow-[0_40px_120px_rgba(0,0,0,0.34)]">
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-[22px] border border-primary/20 bg-background/50 text-primary">
                <CircuitBoard className="h-8 w-8" />
              </span>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/85">Breadboard Lab</p>
              <h3 className="mt-2 text-2xl font-semibold text-foreground">Build the wiring canvas first, then start placing parts immediately</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                ProtoPulse can already render interactive breadboard parts and wires here. This screen now lets you create the canvas directly, drag starter parts, and then graduate into project-linked components with real pin-aware metadata.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Button
                  type="button"
                  data-testid="button-create-first-breadboard-circuit"
                  onClick={() => void handleCreateCircuit()}
                  disabled={createCircuitMutation.isPending}
                  className="gap-2"
                >
                  <CircuitBoard className="h-4 w-4" />
                  {createCircuitMutation.isPending ? 'Creating…' : 'Create wiring canvas'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  data-testid="button-expand-architecture-to-breadboard"
                  onClick={() => void handleExpandArchitecture()}
                  disabled={expandMutation.isPending}
                  className="gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  {expandMutation.isPending ? 'Expanding…' : 'Expand from architecture'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  data-testid="button-open-schematic-from-empty-breadboard"
                  onClick={() => setActiveView('schematic')}
                  className="gap-2"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                  Open schematic
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
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
  workbenchOpen,
  onToggleWorkbench,
}: {
  circuits: CircuitDesignRow[];
  activeCircuit: CircuitDesignRow | null;
  onSelectCircuit: (id: number) => void;
  workbenchOpen: boolean;
  onToggleWorkbench: () => void;
}) {
  const { isLive, setIsLive, clearStates } = useSimulation();

  return (
    <div className="h-10 border-b border-border bg-card/60 backdrop-blur-xl flex items-center px-3 gap-2 shrink-0" data-testid="breadboard-toolbar">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        data-testid="button-toggle-breadboard-bench"
        onClick={onToggleWorkbench}
        className="h-7 px-1.5 text-muted-foreground hover:text-foreground"
      >
        {workbenchOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
      </Button>
      <div className="w-px h-4 bg-border" />
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
        {activeCircuit ? activeCircuit.name : 'No circuit selected'} — Wiring Bench
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Canvas (main interactive area)
// ---------------------------------------------------------------------------

function BreadboardCanvas({
  circuitId,
  benchInsights,
  projectName,
}: {
  circuitId: number;
  benchInsights: Record<number, BreadboardBenchInsight>;
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

  const partsMap = useMemo(
    () => new Map((parts ?? []).map((part: ComponentPart) => [part.id, part])),
    [parts],
  );

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

  const coachPlan = useMemo(
    () => (selectedInstanceModel ? buildBreadboardCoachPlan(selectedInstanceModel) : null),
    [selectedInstanceModel],
  );

  const existingCoachPlanKeys = useMemo(() => {
    if (!instances || !selectedInstanceModel) {
      return new Set<string>();
    }

    return new Set(
      instances
        .map((instance) => instance.properties as Record<string, unknown> | null)
        .filter((properties) => properties?.coachPlanFor === selectedInstanceModel.refDes)
        .map((properties) => String(properties?.coachPlanKey ?? ''))
        .filter((value) => value.length > 0),
    );
  }, [instances, selectedInstanceModel]);

  const resolvedCoachSuggestions = useMemo(() => {
    if (!coachPlan || !selectedInstanceModel) {
      return [];
    }

    const placements = [...instancePlacements.map((entry) => entry.placement)];
    const targetPixelMap = new Map(selectedInstanceModel.pins.map((pin) => [pin.id, pin.pixel]));
    const resolved: ResolvedCoachSuggestion[] = [];

    for (const suggestion of coachPlan.suggestions) {
      if (existingCoachPlanKeys.has(suggestion.id)) {
        continue;
      }
      const targetPixels = suggestion.targetPinIds
        .map((pinId) => targetPixelMap.get(pinId))
        .filter((pixel): pixel is PixelPos => Boolean(pixel));
      const candidate = resolveCoachSuggestionPlacement(suggestion, placements, targetPixels);
      if (!candidate) {
        continue;
      }
      placements.push(candidate.placement);
      resolved.push(candidate);
    }

    return resolved;
  }, [coachPlan, existingCoachPlanKeys, instancePlacements, selectedInstanceModel]);

  const stagedCoachSuggestions = useMemo((): StagedCoachSuggestion[] => {
    if (!coachPlan || !instances || !selectedInstanceModel) {
      return [];
    }

    const targetPixelMap = new Map(selectedInstanceModel.pins.map((pin) => [pin.id, pin.pixel]));

    return coachPlan.suggestions.flatMap((suggestion) => {
      if (!existingCoachPlanKeys.has(suggestion.id)) {
        return [];
      }

      const stagedInstance = instances.find((instance) => {
        const properties = instance.properties as Record<string, unknown> | null;
        return (
          properties?.coachPlanFor === selectedInstanceModel.refDes
          && properties?.coachPlanKey === suggestion.id
          && instance.breadboardX != null
          && instance.breadboardY != null
        );
      });

      if (!stagedInstance || stagedInstance.breadboardX == null || stagedInstance.breadboardY == null) {
        return [];
      }

      const targetPixels = suggestion.targetPinIds
        .map((pinId) => targetPixelMap.get(pinId))
        .filter((pixel): pixel is PixelPos => Boolean(pixel));

      return [{
        ...suggestion,
        instanceId: stagedInstance.id,
        pixel: {
          x: stagedInstance.breadboardX,
          y: stagedInstance.breadboardY,
        },
        referenceDesignator: stagedInstance.referenceDesignator,
        targetPixels,
      }];
    });
  }, [coachPlan, existingCoachPlanKeys, instances, selectedInstanceModel]);

  const preparedCoachHookups = useMemo((): ResolvedCoachHookup[] => {
    if (!coachPlan || !selectedInstanceModel) {
      return [];
    }

    const pinPixelMap = new Map(selectedInstanceModel.pins.map((pin) => [pin.id, pin.pixel]));

    return coachPlan.hookups
      .map((hookup) => {
        const targetPixel = pinPixelMap.get(hookup.targetPinId);
        if (!targetPixel) {
          return null;
        }

        const railPixel = coordToPixel(hookup.railPoint);
        const path = buildCoachHookupPath(railPixel, targetPixel);
        const targetCoord = selectedInstanceModel.pins.find((pin) => pin.id === hookup.targetPinId)?.coord;
        const resolvedNetId = findCoachNetId(nets, hookup);
        const alreadyRouted = breadboardWires.some((wire) => {
          const points = ((wire.points as Array<{ x: number; y: number }> | null) ?? []).map((point) => ({
            x: point.x,
            y: point.y,
          }));
          return (
            pointsMatch(points, path)
            || pointsMatch(points, reversePoints(path))
            || (
              targetCoord != null
              && wireMatchesCoachConnection(wire, resolvedNetId, hookup.railPoint, targetCoord)
            )
          );
        });

        return {
          ...hookup,
          isRouted: alreadyRouted,
          netId: resolvedNetId,
          path,
          railPixel,
          targetPixel,
        };
      })
      .filter((hookup): hookup is ResolvedCoachHookup => Boolean(hookup));
  }, [breadboardWires, coachPlan, nets, selectedInstanceModel]);

  const resolvedCoachHookups = useMemo(
    () => preparedCoachHookups.filter((hookup) => !hookup.isRouted),
    [preparedCoachHookups],
  );

  const preparedCoachBridges = useMemo((): ResolvedCoachBridge[] => {
    if (!coachPlan) {
      return [];
    }

    return coachPlan.bridges
      .map((bridge) => {
        const fromPixel = coordToPixel(bridge.fromRail);
        const toPixel = coordToPixel(bridge.toRail);
        const path = buildCoachRailBridgePath(fromPixel, toPixel);
        const resolvedNetId = findCoachNetId(nets, bridge);
        const alreadyRouted = breadboardWires.some((wire) => {
          const points = ((wire.points as Array<{ x: number; y: number }> | null) ?? []).map((point) => ({
            x: point.x,
            y: point.y,
          }));
          return (
            pointsMatch(points, path)
            || pointsMatch(points, reversePoints(path))
            || wireMatchesCoachConnection(wire, resolvedNetId, bridge.fromRail, bridge.toRail)
          );
        });

        return {
          ...bridge,
          isRouted: alreadyRouted,
          netId: resolvedNetId,
          path,
          fromPixel,
          toPixel,
        };
      })
      .filter((bridge): bridge is ResolvedCoachBridge => Boolean(bridge));
  }, [breadboardWires, coachPlan, nets]);

  const resolvedCoachBridges = useMemo(
    () => preparedCoachBridges.filter((bridge) => !bridge.isRouted),
    [preparedCoachBridges],
  );

  const nearbyBenchContext = useMemo(() => {
    if (!instances || !selectedInstanceModel || !selectedPlacedInstance) {
      return { nearbyForeignPartCount: 0, nearbyWireCount: 0 };
    }

    const anchorX = selectedPlacedInstance.breadboardX ?? selectedInstanceModel.pins[0]?.pixel.x ?? 0;
    const anchorY = selectedPlacedInstance.breadboardY ?? selectedInstanceModel.pins[0]?.pixel.y ?? 0;
    const partRadiusX = 42;
    const partRadiusY = 24;
    const wireRadiusX = 48;
    const wireRadiusY = 28;

    const nearbyForeignPartCount = instances.filter((instance) => {
      if (instance.id === selectedPlacedInstance.id || instance.breadboardX == null || instance.breadboardY == null) {
        return false;
      }

      const properties = (instance.properties as Record<string, unknown> | null) ?? null;
      const isCoachSupport =
        properties?.coachPlanFor === selectedInstanceModel.refDes
        && typeof properties.coachPlanKey === 'string'
        && properties.coachPlanKey.startsWith('support-');
      if (isCoachSupport) {
        return false;
      }

      return (
        Math.abs(instance.breadboardX - anchorX) <= partRadiusX
        && Math.abs(instance.breadboardY - anchorY) <= partRadiusY
      );
    }).length;

    const nearbyWireCount = breadboardWires.filter((wire) => {
      const points = ((wire.points as Array<{ x: number; y: number }> | null) ?? []);
      return points.some((point) => (
        Math.abs(point.x - anchorX) <= wireRadiusX
        && Math.abs(point.y - anchorY) <= wireRadiusY
      ));
    }).length;

    return {
      nearbyForeignPartCount,
      nearbyWireCount,
    };
  }, [breadboardWires, instances, selectedInstanceModel, selectedPlacedInstance]);

  const benchLayoutQuality = useMemo(
    () => (
      selectedInstanceModel
        ? calculateBreadboardLayoutQuality({
            expectedBridgeCount: preparedCoachBridges.length,
            expectedHookupCount: preparedCoachHookups.length,
            expectedSupportCount: coachPlan?.suggestions.length ?? 0,
            model: selectedInstanceModel,
            nearbyForeignPartCount: nearbyBenchContext.nearbyForeignPartCount,
            nearbyWireCount: nearbyBenchContext.nearbyWireCount,
            stagedBridgeCount: preparedCoachBridges.filter((bridge) => bridge.isRouted).length,
            stagedHookupCount: preparedCoachHookups.filter((hookup) => hookup.isRouted).length,
            stagedSupportCount: stagedCoachSuggestions.length,
          })
        : null
    ),
    [coachPlan, nearbyBenchContext, preparedCoachBridges, preparedCoachHookups, selectedInstanceModel, stagedCoachSuggestions],
  );

  const coachActionCount = resolvedCoachSuggestions.length + resolvedCoachHookups.length + resolvedCoachBridges.length;

  const coachActionItems = useMemo((): BreadboardCoachActionItem[] => {
    if (!coachPlan || !selectedInstanceModel) {
      return [];
    }

    const pinLabelMap = new Map(selectedInstanceModel.pins.map((pin) => [pin.id, pin.label]));
    const pendingSupportIds = new Set(resolvedCoachSuggestions.map((suggestion) => suggestion.id));

    const supportActions = coachPlan.suggestions.flatMap((suggestion): BreadboardCoachActionItem[] => {
      const targetLabels = suggestion.targetPinIds
        .map((pinId) => pinLabelMap.get(pinId))
        .filter((label): label is string => Boolean(label));
      const detail = targetLabels.length > 0
        ? `${suggestion.reason} Targets: ${targetLabels.join(' + ')}.`
        : suggestion.reason;

      if (existingCoachPlanKeys.has(suggestion.id)) {
        return [{
          id: suggestion.id,
          detail,
          label: suggestion.label,
          status: 'staged',
          tone: suggestion.id === 'support-control-pull' ? 'control' : 'support',
        }];
      }

      if (!pendingSupportIds.has(suggestion.id)) {
        return [];
      }

      return [{
        id: suggestion.id,
        detail,
        label: suggestion.label,
        status: 'pending',
        tone: suggestion.id === 'support-control-pull' ? 'control' : 'support',
      }];
    });

    const hookupActions = preparedCoachHookups.map((hookup) => ({
      id: hookup.id,
      detail: `${hookup.reason} Target pin: ${pinLabelMap.get(hookup.targetPinId) ?? hookup.targetPinId}.`,
      label: `${hookup.netName} rail jumper`,
      status: hookup.isRouted ? 'staged' as const : 'pending' as const,
      tone: hookup.netType === 'power' ? 'power' as const : 'ground' as const,
    }));

    const bridgeActions = preparedCoachBridges.map((bridge) => ({
      id: bridge.id,
      detail: `${bridge.reason} Bridge row: ${String(bridge.fromRail.index + 1)}.`,
      label: `${bridge.netName} rail bridge`,
      status: bridge.isRouted ? 'staged' as const : 'pending' as const,
      tone: bridge.netType === 'power' ? 'power' as const : 'ground' as const,
    }));

    const corridorActions = coachPlan.corridorHints.map((hint) => ({
      id: hint.id,
      detail: `${hint.label} across rows ${String(hint.rows[0])}–${String(hint.rows[1])} on the ${hint.side} bench lane.`,
      label: hint.label,
      status: 'advisory' as const,
      tone: hint.tone,
    }));

    const statusRank = { pending: 0, staged: 1, advisory: 2 } as const;
    return [...hookupActions, ...bridgeActions, ...supportActions, ...corridorActions].sort((left, right) => {
      const statusDelta = statusRank[left.status] - statusRank[right.status];
      if (statusDelta !== 0) {
        return statusDelta;
      }
      return left.label.localeCompare(right.label);
    });
  }, [
    coachPlan,
    existingCoachPlanKeys,
    preparedCoachBridges,
    preparedCoachHookups,
    resolvedCoachSuggestions,
    selectedInstanceModel,
  ]);

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
          color: getDefaultColorForNet(firstNet.name),
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
    if (endpoint === 'start') {
      pts[0] = { x: newPos.x, y: newPos.y };
    } else {
      pts[pts.length - 1] = { x: newPos.x, y: newPos.y };
    }
    updateWireMutation.mutate({ circuitId, id: wireId, points: pts });
  }, [breadboardWires, updateWireMutation, circuitId]);

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
    if (e.key === '1') { setTool('select'); announce(getToolChangeAnnouncement('select', 'breadboard')); }
    if (e.key === '2') { setTool('wire'); announce(getToolChangeAnnouncement('wire', 'breadboard')); }
    if (e.key === '3') { setTool('delete'); announce(getToolChangeAnnouncement('delete', 'breadboard')); }
  }, [handleEscape, handleDeleteWire, announce]);

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
    const hasType =
      e.dataTransfer.types.includes(COMPONENT_DRAG_TYPE) ||
      e.dataTransfer.types.includes('application/reactflow/type');
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

    const boardPx = clientToBoardPixel(e.clientX, e.clientY);
    if (!boardPx) return;
    const coord = pixelToCoord(boardPx);
    if (!coord || coord.type !== 'terminal') return;

    const existingPlacements = instancePlacements.map((placement) => placement.placement);

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

    const nodeType = e.dataTransfer.getData('application/reactflow/type');
    const label = e.dataTransfer.getData('application/reactflow/label');
    if (!nodeType) return;

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

            {selectedInstanceModel && selectedInstanceModel.pins.length > 0 && (
              <g data-testid="breadboard-pin-anchor-overlay" pointerEvents="none">
                {selectedInstanceModel.pins.map((pin) => {
                  const roleColor = getPinRoleColor(pin.role);
                  const isHovered = hoveredInspectorPinId === pin.id;
                  const isCoachTarget = coachPlanVisible && Boolean(coachPlan?.highlightedPinIds.includes(pin.id));
                  return (
                    <g key={pin.id} data-testid={`breadboard-pin-anchor-${pin.id}`}>
                      <circle
                        cx={pin.pixel.x}
                        cy={pin.pixel.y}
                        r={isHovered ? 6.2 : isCoachTarget ? 5.2 : pin.isCritical ? 4.6 : 4}
                        fill={`${roleColor}20`}
                        stroke={roleColor}
                        strokeWidth={isCoachTarget ? 1.45 : pin.isCritical ? 1.25 : 0.9}
                        strokeDasharray={pin.confidence === 'heuristic' ? '1.2 1.2' : undefined}
                        opacity={isHovered ? 1 : 0.9}
                      />
                      <circle
                        cx={pin.pixel.x}
                        cy={pin.pixel.y}
                        r={pin.confidence === 'exact' ? 2.1 : 1.7}
                        fill={roleColor}
                        opacity={pin.confidence === 'exact' ? 0.95 : 0.72}
                      />
                      {pin.isCritical && (
                        <circle
                          cx={pin.pixel.x}
                          cy={pin.pixel.y}
                          r={0.8}
                          fill="#f8fafc"
                          opacity={0.95}
                        />
                      )}
                    </g>
                  );
                })}
              </g>
            )}

            {coachPlanVisible && coachPlan && (
              <g data-testid="breadboard-coach-plan-overlay" pointerEvents="none">
                {coachPlan.corridorHints.map((hint) => {
                  const startCol: ColumnLetter = hint.side === 'left' ? 'a' : 'h';
                  const endCol: ColumnLetter = hint.side === 'left' ? 'd' : 'j';
                  const startPx = coordToPixel({ type: 'terminal', col: startCol, row: hint.rows[0] });
                  const endPx = coordToPixel({ type: 'terminal', col: endCol, row: hint.rows[1] });
                  const toneColor = getCoachToneColor(hint.tone);
                  return (
                    <g key={hint.id} data-testid={`breadboard-coach-corridor-${hint.id}`}>
                      <rect
                        x={Math.min(startPx.x, endPx.x) - 8}
                        y={Math.min(startPx.y, endPx.y) - 6}
                        width={Math.abs(endPx.x - startPx.x) + 16}
                        height={Math.abs(endPx.y - startPx.y) + 12}
                        rx={8}
                        fill={`${toneColor}12`}
                        stroke={toneColor}
                        strokeWidth={0.8}
                        strokeDasharray="3 2"
                        opacity={0.72}
                      />
                      <text
                        x={Math.min(startPx.x, endPx.x)}
                        y={Math.min(startPx.y, endPx.y) - 10}
                        fill={toneColor}
                        fontSize={5}
                        fontFamily="monospace"
                      >
                        {hint.label}
                      </text>
                    </g>
                  );
                })}

                {preparedCoachHookups.map((hookup) => {
                  const color = getCoachHookupColor(hookup.netType);
                  const polylinePoints = hookup.path.map((point) => `${point.x},${point.y}`).join(' ');
                  const labelX = Math.min(hookup.railPixel.x, hookup.targetPixel.x) + 8;
                  const labelY = hookup.targetPixel.y - 11;
                  const isPending = !hookup.isRouted;

                  return (
                    <g key={hookup.id} data-testid={`breadboard-coach-hookup-${hookup.id}`}>
                      <polyline
                        points={polylinePoints}
                        fill="none"
                        stroke={color}
                        strokeWidth={isPending ? 1.15 : 1}
                        strokeDasharray={isPending ? '3 2' : undefined}
                        opacity={isPending ? 0.82 : 0.52}
                      />
                      <circle cx={hookup.railPixel.x} cy={hookup.railPixel.y} r={2.2} fill={color} opacity={isPending ? 0.9 : 0.58} />
                      <rect
                        x={labelX}
                        y={labelY - 6}
                        width={38}
                        height={14}
                        rx={4}
                        fill={isPending ? 'rgba(4,8,15,0.9)' : 'rgba(4,8,15,0.72)'}
                        stroke={color}
                        strokeWidth={0.75}
                      />
                      <text x={labelX + 4} y={labelY} fill={color} fontSize={4.2} fontFamily="monospace">
                        {hookup.netName} rail
                      </text>
                    </g>
                  );
                })}

                {preparedCoachBridges.map((bridge) => {
                  const color = getCoachHookupColor(bridge.netType);
                  const polylinePoints = bridge.path.map((point) => `${point.x},${point.y}`).join(' ');
                  const labelX = Math.min(bridge.fromPixel.x, bridge.toPixel.x) + 28;
                  const labelY = bridge.fromPixel.y - 11;
                  const isPending = !bridge.isRouted;

                  return (
                    <g key={bridge.id} data-testid={`breadboard-coach-bridge-${bridge.id}`}>
                      <polyline
                        points={polylinePoints}
                        fill="none"
                        stroke={color}
                        strokeWidth={isPending ? 1.1 : 1}
                        strokeDasharray={isPending ? '4 2' : undefined}
                        opacity={isPending ? 0.78 : 0.5}
                      />
                      <circle cx={bridge.fromPixel.x} cy={bridge.fromPixel.y} r={2.1} fill={color} opacity={isPending ? 0.88 : 0.56} />
                      <circle cx={bridge.toPixel.x} cy={bridge.toPixel.y} r={2.1} fill={color} opacity={isPending ? 0.88 : 0.56} />
                      <rect
                        x={labelX}
                        y={labelY - 6}
                        width={46}
                        height={14}
                        rx={4}
                        fill={isPending ? 'rgba(4,8,15,0.9)' : 'rgba(4,8,15,0.72)'}
                        stroke={color}
                        strokeWidth={0.75}
                      />
                      <text x={labelX + 4} y={labelY} fill={color} fontSize={4.1} fontFamily="monospace">
                        {bridge.netName} bridge
                      </text>
                    </g>
                  );
                })}

                {stagedCoachSuggestions.map((suggestion) => (
                  <CoachSuggestionOverlay
                    key={`staged-${suggestion.id}-${suggestion.instanceId}`}
                    suggestion={suggestion}
                    status="staged"
                  />
                ))}

                {resolvedCoachSuggestions.map((suggestion) => (
                  <CoachSuggestionOverlay key={`pending-${suggestion.id}`} suggestion={suggestion} status="pending" />
                ))}
              </g>
            )}

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
                    stroke="#00F0FF"
                    strokeWidth={1.2}
                  />
                  <circle
                    cx={pin.pixel.x}
                    cy={pin.pixel.y}
                    r={2}
                    fill="#00F0FF"
                    opacity={0.95}
                  />
                  <text
                    x={pin.pixel.x + 6}
                    y={pin.pixel.y - 6}
                    fill="#00F0FF"
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
