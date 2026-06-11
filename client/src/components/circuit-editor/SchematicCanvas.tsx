import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  SelectionMode,
  type Node,
  type Edge,
  type Connection,
} from '@/lib/xyflow-compat';
import '@/lib/xyflow-style';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { useArchitecture } from '@/lib/contexts/architecture-context';
import {
  useCircuitDesign,
  useCircuitInstances,
  useCircuitNets,
  useChildDesigns,
  useUpdateCircuitDesign,
  useUpdateCircuitInstance,
  useCreateCircuitInstance,
  useCreateCircuitNet,
  useUpdateCircuitNet,
  useDeleteCircuitInstance,
  useDeleteCircuitNet,
} from '@/lib/circuit-editor/hooks';
import { useComponentParts } from '@/lib/component-editor/hooks';
import type { InstanceNodeData } from './SchematicInstanceNode';
import type { PowerNodeData } from './SchematicPowerNode';
import type { NetLabelNodeData } from './SchematicNetLabelNode';
import type { NoConnectNodeData } from './SchematicNoConnectNode';
import type { AnnotationNodeData } from './SchematicAnnotationNode';
import NetDrawingTool from './NetDrawingTool';
import type { NetDrawingResult } from './NetDrawingTool';
import SchematicToolbar from './SchematicToolbar';
import HardwareInspectionPanel from './HardwareInspectionPanel';
import NetBrowserPanel from './NetBrowserPanel';
import ComponentReplacementDialog from './ComponentReplacementDialog';
import AlternatePartsPopover from './AlternatePartsPopover';
import type { AngleConstraint } from './SchematicToolbar';
import type { SchematicTool, CircuitSettings, SchematicAnnotation, ERCViolation } from '@shared/circuit-types';
import { DEFAULT_CIRCUIT_SETTINGS } from '@shared/circuit-types';
import type { HierarchicalPortRow } from '@shared/schema';
import type { Connector } from '@shared/component-types';
import { CircuitBoard, Network } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import ERCOverlay from './ERCOverlay';
import SimulationVisualOverlay from './SimulationVisualOverlay';
import CollaborationCursors, { useCursorEmitter } from './CollaborationCursors';
import type { CollaborationClient } from '@/lib/collaboration-client';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/hooks/use-toast';
import { useBom } from '@/lib/contexts/bom-context';
import { useSchematicAlternates } from '@/lib/schematic-alternates';
import { useCanvasAnnouncer } from '@/lib/use-canvas-announcer';
import { getCanvasAriaLabel } from '@/lib/canvas-accessibility';
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

// Extracted sub-modules
import {
  nodeTypes,
  edgeTypes,
  instanceToNode,
  netToEdges,
  powerSymbolToNode,
  netLabelToNode,
  noConnectToNode,
  annotationToNode,
} from './schematic/converters';
import { useSchematicClipboard } from './schematic/use-clipboard';
import { useSchematicDragDrop } from './schematic/use-drag-drop';
import { useSchematicKeyboardShortcuts } from './schematic/use-keyboard-shortcuts';
import { useSchematicContextMenu } from './schematic/use-context-menu';
import type { SchematicCanvasProps } from './schematic/canvas-contract';

// ---------------------------------------------------------------------------
// Inner canvas (requires ReactFlowProvider ancestor)
// ---------------------------------------------------------------------------

interface SchematicCanvasInnerProps extends SchematicCanvasProps {
  /** Optional collaboration client for presence cursors (BL-0525). */
  collaborationClient?: CollaborationClient | null;
}

interface SchematicRadialAdapterPreview {
  commandId: string;
  flow: { x: number; y: number };
  screen: { x: number; y: number };
  targetLabel: string;
  targetBounds?: SchematicRadialPreviewBounds;
}

interface SchematicRadialPreviewBounds {
  kind: 'node';
  targetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const SCHEMATIC_PREVIEW_NODE_PADDING = { x: 12, y: 14 };

function positiveFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function getSchematicNodePreviewSize(node: Node): { width: number; height: number } {
  const sizedNode = node as Node & {
    width?: number;
    height?: number;
    measured?: { width?: number; height?: number };
  };
  const measuredWidth = positiveFiniteNumber(sizedNode.width) ?? positiveFiniteNumber(sizedNode.measured?.width);
  const measuredHeight = positiveFiniteNumber(sizedNode.height) ?? positiveFiniteNumber(sizedNode.measured?.height);
  if (measuredWidth != null && measuredHeight != null) {
    return { width: measuredWidth, height: measuredHeight };
  }

  if (node.type === 'schematic-instance') {
    const data = node.data as Partial<InstanceNodeData> | undefined;
    const pinRows = Math.max(1, Math.ceil((data?.connectors?.length ?? 2) / 2));
    return { width: 132, height: Math.max(58, pinRows * 20 + 18) };
  }
  if (node.type === 'schematic-sheet') {
    return { width: 190, height: 104 };
  }
  if (node.type === 'schematic-annotation') {
    return { width: 176, height: 82 };
  }
  if (node.type === 'schematic-net-label') {
    return { width: 92, height: 34 };
  }
  return { width: 52, height: 52 };
}

function getSchematicTargetNodeCandidates(context: MenuContext): string[] {
  const candidates = new Set<string>();
  const addCandidate = (value: unknown) => {
    if (value == null) { return; }
    const text = String(value).trim();
    if (!text) { return; }
    candidates.add(text);
    const numericId = Number(text);
    if (Number.isFinite(numericId)) {
      candidates.add(`instance-${String(numericId)}`);
    }
  };

  addCandidate(context.targetId);
  if (context.target === 'node') {
    addCandidate(context.targetId);
  }
  return [...candidates];
}

function buildSchematicRadialPreviewBounds(
  context: MenuContext,
  pointerFlow: { x: number; y: number },
  pointerScreen: { x: number; y: number },
  nodes: Node[],
): SchematicRadialPreviewBounds | undefined {
  const candidates = getSchematicTargetNodeCandidates(context);
  if (candidates.length === 0) {
    return undefined;
  }

  const targetNode = nodes.find((node) => !node.hidden && candidates.includes(node.id));
  if (!targetNode) {
    return undefined;
  }

  const size = getSchematicNodePreviewSize(targetNode);
  const left = pointerScreen.x + (targetNode.position.x - pointerFlow.x) - SCHEMATIC_PREVIEW_NODE_PADDING.x;
  const top = pointerScreen.y + (targetNode.position.y - pointerFlow.y) - SCHEMATIC_PREVIEW_NODE_PADDING.y;
  return {
    kind: 'node',
    targetId: targetNode.id,
    x: Math.round(left),
    y: Math.round(top),
    width: Math.round(size.width + SCHEMATIC_PREVIEW_NODE_PADDING.x * 2),
    height: Math.round(size.height + SCHEMATIC_PREVIEW_NODE_PADDING.y * 2),
  };
}

/**
 * Lightweight fingerprint for a ReactFlow data/style object.
 * Instead of deep-normalizing and JSON.stringify-ing the entire object tree,
 * we hash only the sorted top-level keys and their primitive (or array-length)
 * values.  Nested object changes are caught by stringifying only their key set
 * and value count — enough to detect additions/removals/type changes without
 * the O(depth × keys) cost of full recursive serialization.
 */
function shallowFingerprint(obj: unknown): string {
  if (obj == null || typeof obj !== 'object') {
    return String(obj ?? '');
  }
  if (typeof obj === 'function') {
    return '';
  }
  if (Array.isArray(obj)) {
    return `[${String(obj.length)}]`;
  }
  const rec = obj as Record<string, unknown>;
  const keys = Object.keys(rec).sort();
  const parts: string[] = [];
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === 'function' || v === undefined) {
      continue;
    }
    if (v == null) {
      parts.push(`${k}:null`);
    } else if (typeof v === 'object') {
      // One level deep: capture key count + array length to detect structural changes
      parts.push(Array.isArray(v) ? `${k}:[${String(v.length)}]` : `${k}:{${String(Object.keys(v).length)}}`);
    } else {
      parts.push(`${k}:${String(v)}`);
    }
  }
  return parts.join('|');
}

function flowNodeSyncSignature(nodes: Node[]): string {
  const parts: string[] = [];
  for (const node of nodes) {
    parts.push(
      `${node.id};${node.type ?? ''};${String(node.position.x)},${String(node.position.y)};${shallowFingerprint(node.data)};${node.hidden ? '1' : '0'};${node.parentId ?? ''};${String(node.zIndex ?? '')}`,
    );
  }
  return parts.join('\n');
}

function flowEdgeSyncSignature(edges: Edge[]): string {
  const parts: string[] = [];
  for (const edge of edges) {
    parts.push(
      `${edge.id};${edge.type ?? ''};${edge.source};${edge.sourceHandle ?? ''};${edge.target};${edge.targetHandle ?? ''};${shallowFingerprint(edge.data)};${edge.hidden ? '1' : '0'};${shallowFingerprint(edge.style)}`,
    );
  }
  return parts.join('\n');
}

function SchematicCanvasInner({ circuitId, ercViolations, highlightedViolationId, onEnterSheet, collaborationClient = null }: SchematicCanvasInnerProps) {
  const projectId = useProjectId();

  // Data queries
  const { data: circuitDesign } = useCircuitDesign(projectId, circuitId);
  const { data: instances } = useCircuitInstances(circuitId);
  const { data: nets } = useCircuitNets(circuitId);
  const { data: subDesigns } = useChildDesigns(projectId, circuitId);

  const subDesignIds = useMemo(() => (subDesigns ?? []).map(d => d.id), [subDesigns]);
  const portsByDesign = new Map<number, HierarchicalPortRow[]>();

  const { data: parts } = useComponentParts(projectId);
  const { pushUndoState } = useArchitecture();

  // Mutations
  const createInstance = useCreateCircuitInstance();
  const updateDesign = useUpdateCircuitDesign();
  const updateInstance = useUpdateCircuitInstance();
  const deleteInstance = useDeleteCircuitInstance();
  const createNet = useCreateCircuitNet();
  const updateNet = useUpdateCircuitNet();
  const deleteNet = useDeleteCircuitNet();

  // Stable refs for mutation objects — TanStack Query mutation hooks return a new
  // object every render. Using these in useCallback deps causes infinite re-render loops.
  const createInstanceRef = useRef(createInstance);
  createInstanceRef.current = createInstance;
  const updateDesignRef = useRef(updateDesign);
  updateDesignRef.current = updateDesign;
  const updateInstanceRef = useRef(updateInstance);
  updateInstanceRef.current = updateInstance;
  const deleteInstanceRef = useRef(deleteInstance);
  deleteInstanceRef.current = deleteInstance;
  const createNetRef = useRef(createNet);
  createNetRef.current = createNet;
  const updateNetRef = useRef(updateNet);
  updateNetRef.current = updateNet;
  const deleteNetRef = useRef(deleteNet);
  deleteNetRef.current = deleteNet;

  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const { bom, addBomItem, updateBomItem } = useBom();

  // BL-0326: Screen-reader announcer for canvas actions
  const announce = useCanvasAnnouncer();

  // Local UI state
  const [activeTool, setActiveTool] = useState<SchematicTool>('select');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [gridVisible, setGridVisible] = useState(true);
  const [angleConstraint, setAngleConstraint] = useState<AngleConstraint>('free');
  const [selectedNetName, setSelectedNetName] = useState<string | null>(null);
  const [mouseFlowPos, setMouseFlowPos] = useState<{ x: number; y: number } | null>(null);

  // BL-0525: Collaboration cursor emitter
  const emitCursor = useCursorEmitter(collaborationClient, 'schematic');

  // BL-0105: Replacement dialog state
  const [isReplacementOpen, setIsReplacementOpen] = useState(false);
  const [showNetBrowser, setShowNetBrowser] = useState(false);
  const [hardwareInspectionOpen, setHardwareInspectionOpen] = useState(false);
  const [replacementInstance, setReplacementInstance] = useState<import('@shared/schema').CircuitInstanceRow | null>(null);
  const [replacementPart, setReplacementPart] = useState<import('@shared/schema').ComponentPart | null>(null);

  const handleReplaceComponent = useCallback((newPartId: number) => {
    if (!replacementInstance) { return; }
    void updateInstanceRef.current.mutateAsync({
      circuitId,
      id: replacementInstance.id,
      partId: newPartId,
    }).then(() => {
      toastRef.current({
        title: 'Component replaced',
        description: `Replaced ${replacementInstance.referenceDesignator} with new part.`,
      });
    });
  }, [replacementInstance, circuitId]);

  // Drag guard — prevents server refetch from resetting node mid-drag
  const isDragging = useRef(false);

  const reactFlowInstance = useReactFlow();
  const [radialAdapterPreview, setRadialAdapterPreview] = useState<SchematicRadialAdapterPreview | null>(null);

  // Read circuit design settings
  const settings = useMemo<CircuitSettings>(() => ({
    ...DEFAULT_CIRCUIT_SETTINGS,
    ...(circuitDesign?.settings as Partial<CircuitSettings> | null),
  }), [circuitDesign?.settings]);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const gridSize = settings.gridSize;

  // BL-0489: Net label inline editing — rename a label and persist to design settings
  const handleNetNameChange = useCallback(
    (labelId: string, newName: string) => {
      const currentSettings = settingsRef.current;
      const updated = (currentSettings.netLabels ?? []).map((nl) =>
        nl.id === labelId ? { ...nl, netName: newName } : nl,
      );
      updateDesignRef.current.mutate({ projectId, id: circuitId, settings: { ...currentSettings, netLabels: updated } });
    },
    [circuitId, projectId],
  );

  // BL-0492: Annotation inline editing callbacks
  const handleAnnotationTextChange = useCallback(
    (annotationId: string, text: string) => {
      const currentSettings = settingsRef.current;
      const updated = (currentSettings.annotations ?? []).map((a) =>
        a.id === annotationId ? { ...a, text } : a,
      );
      updateDesignRef.current.mutate({ projectId, id: circuitId, settings: { ...currentSettings, annotations: updated } });
    },
    [circuitId, projectId],
  );

  const handleAnnotationFontSizeChange = useCallback(
    (annotationId: string, fontSize: number) => {
      const currentSettings = settingsRef.current;
      const updated = (currentSettings.annotations ?? []).map((a) =>
        a.id === annotationId ? { ...a, fontSize } : a,
      );
      updateDesignRef.current.mutate({ projectId, id: circuitId, settings: { ...currentSettings, annotations: updated } });
    },
    [circuitId, projectId],
  );

  const handleAnnotationColorChange = useCallback(
    (annotationId: string, color: string) => {
      const currentSettings = settingsRef.current;
      const updated = (currentSettings.annotations ?? []).map((a) =>
        a.id === annotationId ? { ...a, color } : a,
      );
      updateDesignRef.current.mutate({ projectId, id: circuitId, settings: { ...currentSettings, annotations: updated } });
    },
    [circuitId, projectId],
  );

  // BL-0489: Instance refdes inline editing — persist rename to server
  const handleRefdesChange = useCallback(
    (instanceId: number, newRefdes: string) => {
      updateInstanceRef.current.mutate({ circuitId, id: instanceId, referenceDesignator: newRefdes });
    },
    [circuitId],
  );

  // BL-0489: Net edge label inline editing — rename the net via updateNet mutation
  const handleEdgeNetNameChange = useCallback(
    (netId: number, newName: string) => {
      updateNetRef.current.mutate({ circuitId, id: netId, name: newName });
    },
    [circuitId],
  );

  // Build parts lookup map
  const partsMap = useMemo(() => {
    const map = new Map<number, import('@shared/schema').ComponentPart>();
    parts?.forEach((p) => map.set(p.id, p));
    return map;
  }, [parts]);

  // BL-0540: Compute alternate parts info for all instances
  const alternatesMap = useSchematicAlternates(instances, partsMap);

  // Convert DB data → React Flow nodes
  const rfNodes = useMemo(() => {
    const instanceNodes = (instances ?? []).map((inst) =>
      instanceToNode(
        inst,
        inst.partId != null ? partsMap.get(inst.partId) : undefined,
        undefined,
        undefined,
        undefined,
        (newRefdes: string) => handleRefdesChange(inst.id, newRefdes),
      ),
    );
    const powerNodes = (settings.powerSymbols ?? []).map(powerSymbolToNode);
    const labelNodes = (settings.netLabels ?? []).map((label) => netLabelToNode(label, handleNetNameChange));
    const ncNodes = (settings.noConnectMarkers ?? []).map(noConnectToNode);
    const annotationNodes = (settings.annotations ?? []).map((ann) =>
      annotationToNode(ann, handleAnnotationTextChange, handleAnnotationFontSizeChange, handleAnnotationColorChange),
    );
    return [...instanceNodes, ...powerNodes, ...labelNodes, ...ncNodes, ...annotationNodes] as Node[];
  }, [instances, partsMap, settings.powerSymbols, settings.netLabels, settings.noConnectMarkers, settings.annotations, handleRefdesChange, handleNetNameChange, handleAnnotationTextChange, handleAnnotationFontSizeChange, handleAnnotationColorChange]);

  // Build connector lookup by instance ID for pin resolution (BL-0014)
  const connectorsByInstance = useMemo(() => {
    const map = new Map<number, Connector[]>();
    for (const inst of instances ?? []) {
      const part = inst.partId != null ? partsMap.get(inst.partId) : undefined;
      if (part) {
        map.set(inst.id, (part.connectors ?? []) as Connector[]);
      }
    }
    return map;
  }, [instances, partsMap]);

  // Convert DB data → React Flow edges, marking selected net
  const rfEdges = useMemo(() => {
    const edges = (nets ?? []).flatMap((net) => netToEdges(net, connectorsByInstance, handleEdgeNetNameChange));
    if (selectedNetName) {
      return edges.map((e) => ({
        ...e,
        selected: e.data?.netName === selectedNetName,
        data: {
          ...e.data,
          highlighted: e.data?.netName === selectedNetName,
        },
      }));
    }
    return edges;
  }, [nets, selectedNetName, connectorsByInstance, handleEdgeNetNameChange]);

  // Local React Flow state
  const [localNodes, setLocalNodes, onNodesChange] = useNodesState(rfNodes);
  const [localEdges, setLocalEdges, onEdgesChange] = useEdgesState(rfEdges);
  const rfNodeSignature = useMemo(() => flowNodeSyncSignature(rfNodes), [rfNodes]);
  const localNodeSignature = useMemo(() => flowNodeSyncSignature(localNodes), [localNodes]);
  const rfEdgeSignature = useMemo(() => flowEdgeSyncSignature(rfEdges), [rfEdges]);
  const localEdgeSignature = useMemo(() => flowEdgeSyncSignature(localEdges), [localEdges]);

  // Sync server data → local state (guarded against in-flight drag)
  useEffect(() => {
    if (!isDragging.current && rfNodeSignature !== localNodeSignature) {
      setLocalNodes(rfNodes);
    }
  }, [localNodeSignature, rfNodeSignature, rfNodes, setLocalNodes]);

  useEffect(() => {
    if (rfEdgeSignature !== localEdgeSignature) {
      setLocalEdges(rfEdges);
    }
  }, [localEdgeSignature, rfEdgeSignature, rfEdges, setLocalEdges]);

  // Track drag start
  const onNodeDragStart = useCallback(() => {
    isDragging.current = true;
  }, []);

  // Persist position on drag stop — routes to correct storage per node type
  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      isDragging.current = false;
      const { x, y } = node.position;
      const currentSettings = settingsRef.current;

      if (node.id.startsWith('power-')) {
        const symbolId = (node.data as PowerNodeData)?.symbolId;
        if (!symbolId) { return; }
        const updated = (currentSettings.powerSymbols ?? []).map((ps) =>
          ps.id === symbolId ? { ...ps, x, y } : ps,
        );
        updateDesignRef.current.mutate({ projectId, id: circuitId, settings: { ...currentSettings, powerSymbols: updated } });
      } else if (node.id.startsWith('netlabel-')) {
        const labelId = (node.data as NetLabelNodeData)?.labelId;
        if (!labelId) { return; }
        const updated = (currentSettings.netLabels ?? []).map((nl) =>
          nl.id === labelId ? { ...nl, x, y } : nl,
        );
        updateDesignRef.current.mutate({ projectId, id: circuitId, settings: { ...currentSettings, netLabels: updated } });
      } else if (node.id.startsWith('noconnect-')) {
        const markerId = (node.data as NoConnectNodeData)?.markerId;
        if (!markerId) { return; }
        const updated = (currentSettings.noConnectMarkers ?? []).map((nc) =>
          nc.id === markerId ? { ...nc, x, y } : nc,
        );
        updateDesignRef.current.mutate({ projectId, id: circuitId, settings: { ...currentSettings, noConnectMarkers: updated } });
      } else if (node.id.startsWith('annotation-')) {
        const annotationId = (node.data as AnnotationNodeData)?.annotationId;
        if (!annotationId) { return; }
        const updated = (currentSettings.annotations ?? []).map((a) =>
          a.id === annotationId ? { ...a, x, y } : a,
        );
        updateDesignRef.current.mutate({ projectId, id: circuitId, settings: { ...currentSettings, annotations: updated } });
      } else {
        const instanceId = (node.data as InstanceNodeData)?.instanceId;
        if (typeof instanceId !== 'number') { return; }
        updateInstanceRef.current.mutate({ circuitId, id: instanceId, schematicX: x, schematicY: y });
      }
    },
    [circuitId, projectId],
  );

  // Delete selected nodes — routes to correct storage per node type
  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      const deletedPowerIds: string[] = [];
      const deletedLabelIds: string[] = [];
      const deletedNcIds: string[] = [];
      const deletedAnnotationIds: string[] = [];

      for (const node of deleted) {
        if (node.id.startsWith('power-')) {
          const symbolId = (node.data as PowerNodeData)?.symbolId;
          if (symbolId) { deletedPowerIds.push(symbolId); }
        } else if (node.id.startsWith('netlabel-')) {
          const labelId = (node.data as NetLabelNodeData)?.labelId;
          if (labelId) { deletedLabelIds.push(labelId); }
        } else if (node.id.startsWith('noconnect-')) {
          const markerId = (node.data as NoConnectNodeData)?.markerId;
          if (markerId) { deletedNcIds.push(markerId); }
        } else if (node.id.startsWith('annotation-')) {
          const annotationId = (node.data as AnnotationNodeData)?.annotationId;
          if (annotationId) { deletedAnnotationIds.push(annotationId); }
        } else {
          const instanceId = (node.data as InstanceNodeData)?.instanceId;
          if (typeof instanceId === 'number') {
            deleteInstanceRef.current.mutate({ circuitId, id: instanceId });
          }
        }
      }

      const needsUpdate =
        deletedPowerIds.length > 0 || deletedLabelIds.length > 0 || deletedNcIds.length > 0 || deletedAnnotationIds.length > 0;

      if (needsUpdate) {
        const currentSettings = settingsRef.current;
        const powerSet = new Set(deletedPowerIds);
        const labelSet = new Set(deletedLabelIds);
        const ncSet = new Set(deletedNcIds);
        const annotationSet = new Set(deletedAnnotationIds);
        updateDesignRef.current.mutate({
          projectId,
          id: circuitId,
          settings: {
            ...currentSettings,
            powerSymbols: (currentSettings.powerSymbols ?? []).filter((ps) => !powerSet.has(ps.id)),
            netLabels: (currentSettings.netLabels ?? []).filter((nl) => !labelSet.has(nl.id)),
            noConnectMarkers: (currentSettings.noConnectMarkers ?? []).filter((nc) => !ncSet.has(nc.id)),
            annotations: (currentSettings.annotations ?? []).filter((a) => !annotationSet.has(a.id)),
          },
        });
      }
    },
    [circuitId, projectId],
  );

  // Delete selected edges — removes individual segments, not entire nets
  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      const segmentRemovals = new Map<number, Set<string>>();

      for (const edge of deleted) {
        const match = edge.id.match(/^net-(\d+)-/);
        if (!match) { continue; }
        const netId = parseInt(match[1], 10);
        if (!segmentRemovals.has(netId)) { segmentRemovals.set(netId, new Set()); }
        segmentRemovals.get(netId)!.add(edge.id);
      }

      interface NetSegmentJSON { fromInstanceId: number; fromPin: string; toInstanceId: number; toPin: string }
      Array.from(segmentRemovals.entries()).forEach(([netId, removedEdgeIds]) => {
        const net = nets?.find((n) => n.id === netId);
        if (!net) { return; }

        const allSegments = (net.segments ?? []) as NetSegmentJSON[];
        const remaining = allSegments.filter((seg) => {
          const edgeId = `net-${netId}-${seg.fromInstanceId}:${seg.fromPin}-${seg.toInstanceId}:${seg.toPin}`;
          return !removedEdgeIds.has(edgeId);
        });

        if (remaining.length === 0) {
          deleteNetRef.current.mutate({ circuitId, id: netId });
        } else {
          updateNetRef.current.mutate({ circuitId, id: netId, segments: remaining });
        }
      });
    },
    [circuitId, nets],
  );

  // Prevent self-connections
  const isValidConnection = useCallback(
    (connection: Edge | Connection) => connection.source !== connection.target,
    [],
  );

  // Create net on pin-to-pin connection
  const onConnect = useCallback(
    (connection: Connection) => {
      const sourceInstanceId = parseInt(
        connection.source?.replace('instance-', '') ?? '0',
        10,
      );
      const targetInstanceId = parseInt(
        connection.target?.replace('instance-', '') ?? '0',
        10,
      );
      const sourcePinId = connection.sourceHandle?.replace('pin-', '') ?? '';
      const targetPinId = connection.targetHandle?.replace('pin-', '') ?? '';

      if (!sourceInstanceId || !targetInstanceId || !sourcePinId || !targetPinId) {
        return;
      }

      const sourceNode = localNodes.find((n) => n.id === connection.source);
      const targetNode = localNodes.find((n) => n.id === connection.target);
      const sourceData = sourceNode?.data as InstanceNodeData | undefined;
      const targetData = targetNode?.data as InstanceNodeData | undefined;
      const sourcePinName =
        sourceData?.connectors.find((c) => c.id === sourcePinId)?.name ?? sourcePinId;
      const targetPinName =
        targetData?.connectors.find((c) => c.id === targetPinId)?.name ?? targetPinId;
      const sourceRef = sourceData?.referenceDesignator ?? '';
      const targetRef = targetData?.referenceDesignator ?? '';

      createNetRef.current.mutate({
        circuitId,
        name: `${sourceRef}.${sourcePinName}_${targetRef}.${targetPinName}`,
        netType: 'signal',
        segments: [
          {
            fromInstanceId: sourceInstanceId,
            fromPin: sourcePinId,
            toInstanceId: targetInstanceId,
            toPin: targetPinId,
            waypoints: [],
          },
        ],
      });
    },
    [circuitId, localNodes],
  );

  // Coordinate readout — track mouse in flow coordinates
  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const pos = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const rx = Math.round(pos.x);
      const ry = Math.round(pos.y);
      setMouseFlowPos({ x: rx, y: ry });
      emitCursor(rx, ry);
    },
    [reactFlowInstance, emitCursor],
  );

  const handleCanvasMouseLeave = useCallback(() => {
    setMouseFlowPos(null);
  }, []);

  // Toolbar actions
  const handleFitView = useCallback(() => {
    reactFlowInstance.fitView({ padding: 0.2 });
  }, [reactFlowInstance]);

  const handleOpenShortcuts = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
  }, []);

  // --- Extracted hooks ---

  // Clipboard (copy/paste)
  const { handlePaste, handleCopy, triggerPaste } = useSchematicClipboard({
    circuitId,
    projectId,
    instances,
    nets,
    partsMap,
    settings,
    localNodes,
    reactFlowInstance,
    mutationRefs: {
      createInstance: createInstanceRef,
      updateDesign: updateDesignRef,
      createNet: createNetRef,
      toast: toastRef,
    },
  });

  // Drag and drop
  const { onDragOver, onDrop } = useSchematicDragDrop({
    circuitId,
    projectId,
    instances,
    partsMap,
    settings,
    reactFlowInstance,
    snapEnabled,
    gridSize,
    bom,
    addBomItem,
    updateBomItem,
    mutationRefs: {
      createInstance: createInstanceRef,
      updateDesign: updateDesignRef,
      createNet: createNetRef,
      toast: toastRef,
    },
  });

  // Keyboard shortcuts
  useSchematicKeyboardShortcuts({
    circuitId,
    projectId,
    instances,
    nets,
    partsMap,
    settings,
    localNodes,
    setLocalNodes,
    activeTool,
    setActiveTool,
    setSnapEnabled,
    snapEnabled,
    gridSize,
    reactFlowInstance,
    handleFitView,
    handleCopy,
    handlePaste,
    announce,
    mutationRefs: {
      updateDesign: updateDesignRef,
      updateInstance: updateInstanceRef,
      createInstance: createInstanceRef,
    },
  });

  // Context menu
  const {
    handleCtxAddComponent,
    handleCtxAddWire,
    handleCtxAddPower,
    handleCtxSelectAll,
    handleCtxReplaceComponent,
    handleCtxAddDecoupling,
    handleCtxRunErc,
  } = useSchematicContextMenu({
    circuitId,
    projectId,
    instances,
    partsMap,
    settings,
    reactFlowInstance,
    snapEnabled,
    gridSize,
    setActiveTool,
    setLocalNodes,
    setReplacementInstance,
    setReplacementPart,
    setIsReplacementOpen,
    pushUndoState,
    mutationRefs: {
      createInstance: createInstanceRef,
      updateDesign: updateDesignRef,
      createNet: createNetRef,
      toast: toastRef,
    },
  });

  // Net drawing tool callback — creates a net with waypoints
  const onNetDrawn = useCallback(
    (result: NetDrawingResult) => {
      const sourceNode = localNodes.find((n) => n.id === `instance-${result.sourceInstanceId}`);
      const targetNode = localNodes.find((n) => n.id === `instance-${result.targetInstanceId}`);
      const sourceData = sourceNode?.data as InstanceNodeData | undefined;
      const targetData = targetNode?.data as InstanceNodeData | undefined;
      const sourcePinName =
        sourceData?.connectors.find((c) => c.id === result.sourcePin)?.name ?? result.sourcePin;
      const targetPinName =
        targetData?.connectors.find((c) => c.id === result.targetPin)?.name ?? result.targetPin;
      const sourceRef = sourceData?.referenceDesignator ?? '';
      const targetRef = targetData?.referenceDesignator ?? '';

      createNetRef.current.mutate({
        circuitId,
        name: `${sourceRef}.${sourcePinName}_${targetRef}.${targetPinName}`,
        netType: 'signal',
        segments: [
          {
            fromInstanceId: result.sourceInstanceId,
            fromPin: result.sourcePin,
            toInstanceId: result.targetInstanceId,
            toPin: result.targetPin,
            waypoints: result.waypoints,
          },
        ],
      });
    },
    [circuitId, localNodes],
  );

  // BL-0492: Handle pane click — place annotation when annotation tool active, else clear net selection
  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (activeTool === 'place-annotation') {
        const pos = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
        if (snapEnabled) {
          pos.x = Math.round(pos.x / gridSize) * gridSize;
          pos.y = Math.round(pos.y / gridSize) * gridSize;
        }
        const newAnnotation: SchematicAnnotation = {
          id: crypto.randomUUID(),
          text: 'Note',
          x: pos.x,
          y: pos.y,
          fontSize: 14,
          color: '#ffffff',
        };
        const currentAnnotations = settings.annotations ?? [];
        updateDesignRef.current.mutate({
          projectId,
          id: circuitId,
          settings: { ...settings, annotations: [...currentAnnotations, newAnnotation] },
        });
        setActiveTool('select');
        return;
      }
      setSelectedNetName(null);
    },
    [activeTool, reactFlowInstance, snapEnabled, gridSize, settings, projectId, circuitId],
  );

  // Stable toolbar callbacks
  const handleToggleSnap = useCallback(() => setSnapEnabled((s) => !s), []);
  const handleToggleGridVisible = useCallback(() => setGridVisible((v) => !v), []);
  const selectedSchematicInstanceCount = useMemo(
    () => localNodes.filter((node) => node.selected && node.type === 'schematic-instance').length,
    [localNodes],
  );
  const schematicLinearContext = useMemo<MenuContext>(() => {
    const selectedInstance = localNodes.find((node) => node.selected && node.type === 'schematic-instance');
    const data = selectedInstance?.data as Partial<InstanceNodeData> | undefined;
    return {
      view: 'schematic',
      target: selectedInstance ? 'node' : 'canvas',
      targetId: selectedInstance?.id,
      targetLabel: data?.referenceDesignator ?? selectedInstance?.id,
    };
  }, [localNodes]);
  const schematicLinearActions = useMemo(
    () => getLinearActionsForContext(schematicLinearContext),
    [schematicLinearContext],
  );
  const disabledLinearCommands = useMemo(
    () => new Set(selectedSchematicInstanceCount === 1 ? [] : ['replace_component', 'add_decoupling']),
    [selectedSchematicInstanceCount],
  );
  const disabledLinearReasons = useMemo(
    () => ({
      replace_component: 'Select one schematic component first.',
      add_decoupling: 'Select one schematic component first.',
    }),
    [],
  );

  const handleAiSchematicReview = useCallback((
    context: MenuContext,
    delivery: RadialAiPromptDelivery = 'draft',
  ): void => {
    const targetNode = context.targetId
      ? localNodes.find((node) => node.id === context.targetId || node.id === `instance-${context.targetId}`)
      : localNodes.find((node) => node.selected);
    const targetData = targetNode?.data as Record<string, unknown> | undefined;
    const targetLabel =
      context.targetLabel ??
      (typeof targetData?.referenceDesignator === 'string' ? targetData.referenceDesignator : undefined) ??
      targetNode?.id;
    const deliveryVerb = getRadialAiDeliveryVerb(delivery);
    const formatNode = (node: Node): string => {
      const data = node.data as Record<string, unknown> | undefined;
      const ref = typeof data?.referenceDesignator === 'string' ? data.referenceDesignator : node.id;
      const label = typeof data?.label === 'string' ? data.label : undefined;
      return `${ref}${label ? ` (${label})` : ''} [${node.type ?? 'node'}] at x=${String(Math.round(node.position.x))}, y=${String(Math.round(node.position.y))}`;
    };
    const sections = [
      {
        title: 'Visible schematic nodes',
        lines: localNodes.slice(0, 10).map(formatNode),
      },
      {
        title: 'Known nets',
        lines: (nets ?? []).slice(0, 10).map((net) => `${net.name ?? `net-${String(net.id)}`} id=${String(net.id)}`),
      },
      {
        title: 'Visible schematic connections',
        lines: localEdges
          .slice(0, 8)
          .map((edge) => `${edge.source}${edge.sourceHandle ? `.${edge.sourceHandle}` : ''} -> ${edge.target}${edge.targetHandle ? `.${edge.targetHandle}` : ''}`),
      },
      {
        title: 'ERC context',
        lines: (ercViolations ?? [])
          .slice(0, 6)
          .map((violation) => `${violation.severity}: ${violation.ruleType} - ${violation.message}`),
      },
    ].filter((section) => section.lines.length > 0);

    runRadialAiCommand({
      intent: 'review_schematic',
      intro:
        'Review this schematic context like a practical electronics design reviewer. Focus on ERC risks, missing nets, confusing symbols, power integrity, bypassing, and the next safest fix.',
      summary: `Schematic review: ${String(instances?.length ?? 0)} symbol(s), ${String(nets?.length ?? 0)} net(s), ${String(localEdges.length)} visible connection(s), ${String(ercViolations?.length ?? 0)} ERC issue(s).`,
      historyLabel: targetLabel ? `Schematic review: ${targetLabel}` : 'Schematic review',
      context,
      delivery,
      targetDetails: [
        `Circuit: ${circuitDesign?.name ?? `Circuit ${String(circuitId)}`}`,
        targetNode ? `Target: ${formatNode(targetNode)}` : 'Target: schematic canvas',
      ],
      sections,
      finalInstruction:
        'Give Tyler a concise schematic review with exact next actions. Call out what to inspect manually before trusting the result.',
    });
    toastRef.current({
      title: `AI Schematic Review ${deliveryVerb}`,
      description: targetLabel
        ? `${deliveryVerb} ${targetLabel} schematic prompt ${delivery === 'send-now' ? 'to' : 'in'} AI chat.`
        : `${deliveryVerb} schematic prompt ${delivery === 'send-now' ? 'to' : 'in'} AI chat.`,
    });
  }, [circuitDesign?.name, circuitId, ercViolations, instances?.length, localEdges, localNodes, nets]);

  const handleSchematicCommand = useCallback((
    commandId: string,
    context: MenuContext = schematicLinearContext,
    delivery: RadialAiPromptDelivery = 'draft',
  ): boolean => {
    switch (commandId) {
      case 'ai_schematic_review':
        handleAiSchematicReview(context, delivery);
        return true;
      case 'add_component':
        handleCtxAddComponent();
        return true;
      case 'add_wire':
        handleCtxAddWire();
        return true;
      case 'add_power':
        handleCtxAddPower();
        return true;
      case 'run_erc':
        handleCtxRunErc();
        return true;
      case 'select_all':
        handleCtxSelectAll();
        return true;
      case 'paste':
        void triggerPaste();
        return true;
      case 'fit_view':
        handleFitView();
        return true;
      case 'toggle_grid':
        handleToggleGridVisible();
        return true;
      case 'replace_component':
        if (selectedSchematicInstanceCount !== 1) { return false; }
        handleCtxReplaceComponent();
        return true;
      case 'add_decoupling':
        if (selectedSchematicInstanceCount !== 1) { return false; }
        handleCtxAddDecoupling();
        return true;
      default:
        return false;
    }
  }, [
    handleCtxAddComponent,
    handleCtxAddDecoupling,
    handleCtxAddPower,
    handleCtxAddWire,
    handleCtxReplaceComponent,
    handleCtxRunErc,
    handleCtxSelectAll,
    handleAiSchematicReview,
    handleFitView,
    schematicLinearContext,
    handleToggleGridVisible,
    selectedSchematicInstanceCount,
    triggerPaste,
  ]);

  useEffect(() => {
    const handleRadialCommand = (event: Event) => {
      if (!(event instanceof CustomEvent)) { return; }
      const detail = event.detail as RadialCommandEventDetail | undefined;
      if (!detail || detail.context.view !== 'schematic') { return; }

      if (handleSchematicCommand(detail.commandId, detail.context, getRadialAiPromptDelivery(detail))) {
        detail.handled = true;
      }
    };

    window.addEventListener(RADIAL_COMMAND_EVENT, handleRadialCommand);
    return () => window.removeEventListener(RADIAL_COMMAND_EVENT, handleRadialCommand);
  }, [handleSchematicCommand]);

  useEffect(() => {
    const handleRadialPreview = (event: Event) => {
      if (!(event instanceof CustomEvent)) { return; }
      const detail = event.detail as RadialCommandPreviewEventDetail | undefined;
      if (!detail || detail.phase === 'clear' || detail.context?.view !== 'schematic') {
        setRadialAdapterPreview(null);
        return;
      }
      if (!detail.commandId || !detail.context.pointer) {
        setRadialAdapterPreview(null);
        return;
      }

      const flow = reactFlowInstance.screenToFlowPosition(detail.context.pointer);
      setRadialAdapterPreview({
        commandId: detail.commandId,
        flow,
        screen: detail.context.pointer,
        targetLabel: detail.context.targetLabel ?? detail.context.target,
        targetBounds: buildSchematicRadialPreviewBounds(detail.context, flow, detail.context.pointer, localNodes),
      });
    };

    window.addEventListener(RADIAL_COMMAND_PREVIEW_EVENT, handleRadialPreview);
    return () => window.removeEventListener(RADIAL_COMMAND_PREVIEW_EVENT, handleRadialPreview);
  }, [localNodes, reactFlowInstance]);

  // Stable ReactFlow props
  const handleEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    const netName = (edge.data as Record<string, unknown> | undefined)?.netName;
    if (typeof netName === 'string') {
      setSelectedNetName((prev) => (prev === netName ? null : netName));
    }
  }, []);
  const snapGridTuple = useMemo<[number, number]>(() => [gridSize, gridSize], [gridSize]);

  return (
    <div className="w-full h-full relative">
      <SchematicToolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        snapEnabled={snapEnabled}
        onToggleSnap={handleToggleSnap}
        gridVisible={gridVisible}
        onToggleGridVisible={handleToggleGridVisible}
        angleConstraint={angleConstraint}
        onAngleConstraintChange={setAngleConstraint}
        onFitView={handleFitView}
        onOpenShortcuts={handleOpenShortcuts}
        onOpenHardwareInspection={() => setHardwareInspectionOpen(true)}
      />
      <HardwareInspectionPanel
        open={hardwareInspectionOpen}
        onOpenChange={setHardwareInspectionOpen}
        projectId={projectId}
      />
      <StyledTooltip content="Net Browser (N)" side="bottom">
        <button
          data-testid="schematic-toggle-net-browser"
          aria-label="Toggle net browser panel"
          className={cn(
            'absolute top-3 right-3 z-10 p-1.5 bg-card/80 backdrop-blur-xl border border-border shadow-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors',
            showNetBrowser && 'bg-primary/20 text-primary border-primary/40',
          )}
          onClick={() => setShowNetBrowser(prev => !prev)}
        >
          <Network className="w-5 h-5" />
        </button>
      </StyledTooltip>
      {showNetBrowser && (
        <div className="absolute top-12 right-3 z-10 w-72">
          <NetBrowserPanel
            nets={nets ?? []}
            instances={instances ?? []}
            selectedNetName={selectedNetName}
            onSelectNet={setSelectedNetName}
          />
        </div>
      )}
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className="w-full h-full relative"
          data-testid="schematic-canvas"
          role="application"
          aria-label={getCanvasAriaLabel('schematic', circuitDesign?.name)}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={handleCanvasMouseLeave}
        >

      <ReactFlow
        nodes={localNodes}
        edges={localEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onConnect={onConnect}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        isValidConnection={isValidConnection}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        className="bg-transparent"
        colorMode="dark"
        // Keep workspace scrolling available while cursor is over the canvas.
        // React Flow defaults this to true, which can make the surrounding
        // workspace feel "stuck" when users try to wheel-scroll the page.
        preventScrolling={false}
        snapToGrid={snapEnabled}
        snapGrid={snapGridTuple}
        panOnDrag={activeTool === 'pan'}
        selectionOnDrag={activeTool !== 'pan' && activeTool !== 'place-annotation'}
        selectionMode={SelectionMode.Partial}
        connectionMode={ConnectionMode.Loose}
        deleteKeyCode={['Backspace', 'Delete']}
      >
        {gridVisible && <Background color="#333" gap={gridSize} size={1} />}
        <Controls className="!bg-card !border-border !fill-foreground" />
        <MiniMap
          className="!bg-card/80 !border-border overflow-hidden"
          nodeColor={(node) => node.selected ? 'var(--color-editor-accent)' : '#555'}
          maskColor="rgba(0, 0, 0, 0.6)"
          pannable
          zoomable
          data-testid="schematic-minimap"
        />
      </ReactFlow>

      <NetDrawingTool
        active={activeTool === 'draw-net'}
        snapEnabled={snapEnabled}
        gridSize={gridSize}
        onNetCreated={onNetDrawn}
      />

      {radialAdapterPreview && (() => {
        const targetBounds = radialAdapterPreview.targetBounds;
        const targetPreview = targetBounds != null
          && (radialAdapterPreview.commandId === 'delete' || radialAdapterPreview.commandId === 'replace_component');
        const previewWidth = targetBounds?.width ?? 224;
        const previewHeight = targetBounds?.height ?? 112;
        const targetStroke = radialAdapterPreview.commandId === 'delete' ? 'rgb(252 165 165)' : 'rgb(251 191 36)';
        const targetFill = radialAdapterPreview.commandId === 'delete'
          ? 'rgba(248,113,113,0.14)'
          : 'rgba(251,191,36,0.14)';

        return (
          <div
            data-testid="schematic-radial-adapter-preview"
            data-command-id={radialAdapterPreview.commandId}
            data-flow-x={Math.round(radialAdapterPreview.flow.x)}
            data-flow-y={Math.round(radialAdapterPreview.flow.y)}
            data-target-kind={targetBounds?.kind ?? 'pointer'}
            data-target-id={targetBounds?.targetId}
            data-target-width={targetBounds ? Math.round(targetBounds.width) : undefined}
            data-target-height={targetBounds ? Math.round(targetBounds.height) : undefined}
            className={cn(
              'pointer-events-none fixed z-[9996]',
              targetPreview ? '' : 'h-28 w-56 -translate-x-1/2 -translate-y-1/2',
            )}
            style={targetPreview && targetBounds
              ? { left: targetBounds.x, top: targetBounds.y, width: targetBounds.width, height: targetBounds.height }
              : { left: radialAdapterPreview.screen.x, top: radialAdapterPreview.screen.y }}
          >
            <svg className="h-full w-full overflow-visible" aria-hidden="true">
              {targetPreview ? (
                <g data-testid="schematic-radial-target-outline">
                  <rect
                    x={2}
                    y={2}
                    width={Math.max(24, previewWidth - 4)}
                    height={Math.max(24, previewHeight - 4)}
                    rx={8}
                    fill={targetFill}
                    stroke={targetStroke}
                    strokeWidth={2.5}
                    strokeDasharray="8 6"
                  />
                  {radialAdapterPreview.commandId === 'delete' ? (
                    <path
                      d={`M${String(Math.max(14, previewWidth * 0.25))} ${String(Math.max(14, previewHeight * 0.28))} L${String(Math.max(24, previewWidth * 0.75))} ${String(Math.max(24, previewHeight * 0.72))} M${String(Math.max(24, previewWidth * 0.75))} ${String(Math.max(14, previewHeight * 0.28))} L${String(Math.max(14, previewWidth * 0.25))} ${String(Math.max(24, previewHeight * 0.72))}`}
                      stroke={targetStroke}
                      strokeWidth={3}
                      strokeLinecap="round"
                    />
                  ) : (
                    <path
                      d={`M${String(Math.max(16, previewWidth * 0.24))} ${String(previewHeight * 0.52)} H${String(Math.max(34, previewWidth * 0.68))} m-14 -12 14 12 -14 12`}
                      stroke={targetStroke}
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  )}
                </g>
              ) : radialAdapterPreview.commandId === 'add_wire' ? (
                <g>
                  <line x1={28} y1={76} x2={198} y2={32} stroke="rgb(103 232 249)" strokeWidth={3} strokeLinecap="round" strokeDasharray="8 7" />
                  <circle cx={28} cy={76} r={8} fill="rgba(34,211,238,0.16)" stroke="rgb(103 232 249)" strokeWidth={2} />
                  <circle cx={198} cy={32} r={11} fill="rgba(34,211,238,0.12)" stroke="rgb(103 232 249)" strokeWidth={2} />
                </g>
              ) : radialAdapterPreview.commandId === 'delete' ? (
                <g>
                  <rect x={58} y={24} width={92} height={62} rx={8} fill="rgba(248,113,113,0.14)" stroke="rgb(252 165 165)" strokeWidth={2.5} strokeDasharray="8 6" />
                  <path d="M76 38 L132 72 M132 38 L76 72" stroke="rgb(252 165 165)" strokeWidth={3} strokeLinecap="round" />
                </g>
              ) : (
                <g>
                  <rect x={62} y={24} width={84} height={58} rx={8} fill="rgba(52,211,153,0.14)" stroke="rgb(110 231 183)" strokeWidth={2.5} strokeDasharray="8 6" />
                  <path d="M104 38 V68 M89 53 H119" stroke="rgb(110 231 183)" strokeWidth={4} strokeLinecap="round" />
                </g>
              )}
            </svg>
            <div
              className={cn(
                'absolute rounded border bg-background/85 px-2 py-1 text-[10px] font-semibold text-cyan-50 shadow-lg backdrop-blur',
                targetPreview ? 'left-0 top-full mt-1 border-amber-300/35' : 'left-10 top-20 border-cyan-300/35',
              )}
            >
              {radialAdapterPreview.commandId === 'add_wire'
                ? 'Wire anchor'
                : radialAdapterPreview.commandId === 'replace_component'
                  ? `Replace ${radialAdapterPreview.targetLabel}`
                  : radialAdapterPreview.targetLabel}
            </div>
          </div>
        );
      })()}

      {ercViolations && ercViolations.length > 0 && (
        <ERCOverlay
          violations={ercViolations}
          highlightedId={highlightedViolationId}
        />
      )}

      <SimulationVisualOverlay />

      <CollaborationCursors client={collaborationClient} view="schematic" />

      {alternatesMap.size > 0 && (
        <div className="absolute inset-0 pointer-events-none z-[5]" data-testid="alt-parts-overlay">
          {localNodes
            .filter((n) => n.type === 'schematic-instance')
            .map((node) => {
              const instData = node.data as InstanceNodeData;
              const info = alternatesMap.get(instData.instanceId);
              if (!info) {
                return null;
              }
              return (
                <div
                  key={`alt-${String(instData.instanceId)}`}
                  className="pointer-events-auto"
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    transform: `translate(${String(node.position.x)}px, ${String(node.position.y)}px)`,
                  }}
                >
                  <AlternatePartsPopover info={info} />
                </div>
              );
            })}
        </div>
      )}

      {(!instances || instances.length === 0) && (
        <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none">
          <div className="pointer-events-auto">
            <EmptyState
              icon={CircuitBoard}
              title="Empty Schematic"
              description="Your schematic is empty. Add components from the library or import an existing design."
              actionLabel="Add Component"
              actionTestId="button-add-schematic-component"
              onAction={handleCtxAddComponent}
            />
          </div>
        </div>
      )}

      {selectedNetName && (
        <div
          data-testid="selected-net-pill"
          className="absolute top-3 right-3 z-10 flex items-center gap-2 bg-primary/20 border border-primary/40 px-2.5 py-1 rounded-md backdrop-blur-sm"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-medium text-primary">
            Net: {selectedNetName}
          </span>
          <button
            data-testid="deselect-net"
            className="ml-1 text-primary/60 hover:text-primary transition-colors"
            onClick={() => setSelectedNetName(null)}
            aria-label="Deselect net"
          >
            &times;
          </button>
        </div>
      )}

      {ercViolations && ercViolations.length > 0 && mouseFlowPos && (
        <div
          data-testid="inline-erc-errors"
          className="absolute bottom-12 left-3 z-10 max-w-xs space-y-1 pointer-events-none"
        >
          {ercViolations.slice(0, 3).map((v) => (
            <div
              key={v.id}
              className="flex items-center gap-1.5 bg-destructive/15 border border-destructive/30 px-2 py-1 rounded-md text-[10px] text-destructive backdrop-blur-sm"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
              <span className="truncate">{v.message}</span>
            </div>
          ))}
          {ercViolations.length > 3 && (
            <div className="text-[10px] text-destructive/70 px-2">
              +{ercViolations.length - 3} more
            </div>
          )}
        </div>
      )}

      {mouseFlowPos && (
        <div
          className="absolute bottom-3 right-3 z-10 bg-card/70 backdrop-blur-sm border border-border px-2 py-1 pointer-events-none select-none"
          data-testid="coordinate-readout"
        >
          <span className="text-[11px] font-mono tabular-nums text-[var(--color-editor-accent)]">
            X: {mouseFlowPos.x} &nbsp; Y: {mouseFlowPos.y}
          </span>
        </div>
      )}

      {replacementInstance && (
        <ComponentReplacementDialog
          open={isReplacementOpen}
          onOpenChange={setIsReplacementOpen}
          instance={replacementInstance}
          originalPart={replacementPart}
          onReplace={handleReplaceComponent}
        />
      )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-[15rem] border-border bg-card/90 backdrop-blur-xl">
        <RadialCommandLinearMenu
          items={schematicLinearActions}
          disabledCommandIds={disabledLinearCommands}
          disabledReasons={disabledLinearReasons}
          onSelect={handleSchematicCommand}
        />
      </ContextMenuContent>
    </ContextMenu>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

/** Standalone SchematicCanvas that provides its own ReactFlowProvider. */
export default function SchematicCanvas({
  circuitId,
}: {
  circuitId: number;
}) {
  return (
    <ReactFlowProvider>
      <SchematicCanvasInner circuitId={circuitId} />
    </ReactFlowProvider>
  );
}

/**
 * Inner canvas component — requires a ReactFlowProvider ancestor.
 * Use this when you need sibling components (e.g., ERCPanel) to share
 * the same ReactFlow context.
 */
export { SchematicCanvasInner };
