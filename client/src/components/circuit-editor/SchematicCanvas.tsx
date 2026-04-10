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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
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
import NetBrowserPanel from './NetBrowserPanel';
import ComponentReplacementDialog from './ComponentReplacementDialog';
import AlternatePartsPopover from './AlternatePartsPopover';
import type { AngleConstraint } from './SchematicToolbar';
import type { SchematicTool, CircuitSettings, SchematicAnnotation, ERCViolation } from '@shared/circuit-types';
import { DEFAULT_CIRCUIT_SETTINGS } from '@shared/circuit-types';
import type { HierarchicalPortRow } from '@shared/schema';
import type { Connector } from '@shared/component-types';
import { CircuitBoard, Plus, Cable, Zap, ClipboardPaste, CheckSquare, ShieldAlert, ArrowRightLeft, Network } from 'lucide-react';
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
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';

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

// ---------------------------------------------------------------------------
// Inner canvas (requires ReactFlowProvider ancestor)
// ---------------------------------------------------------------------------

interface SchematicCanvasInnerProps {
  circuitId: number;
  ercViolations?: ERCViolation[];
  highlightedViolationId?: string | null;
  onEnterSheet?: (id: number) => void;
  /** Optional collaboration client for presence cursors (BL-0525). */
  collaborationClient?: CollaborationClient | null;
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
          nodeColor={(node) => node.selected ? '#00F0FF' : '#555'}
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
          className="absolute top-3 right-3 z-10 flex items-center gap-2 bg-primary/20 border border-primary/40 px-3 py-1.5 rounded-full backdrop-blur-sm"
        >
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
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
              className="flex items-center gap-1.5 bg-destructive/15 border border-destructive/30 px-2 py-1 rounded text-[10px] text-destructive backdrop-blur-sm"
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
          <span className="text-[11px] font-mono tabular-nums text-[#00F0FF]">
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
      <ContextMenuContent className="bg-card/90 backdrop-blur-xl border-border min-w-[180px]">
        <ContextMenuItem data-testid="ctx-add-component" onSelect={handleCtxAddComponent}>
          <Plus className="w-4 h-4 mr-2" />
          Add Component
        </ContextMenuItem>
        <ContextMenuItem data-testid="ctx-add-wire" onSelect={handleCtxAddWire}>
          <Cable className="w-4 h-4 mr-2" />
          Add Wire
          <span className="ml-auto text-muted-foreground text-[10px]">W</span>
        </ContextMenuItem>
        <ContextMenuItem data-testid="ctx-add-power" onSelect={handleCtxAddPower}>
          <Zap className="w-4 h-4 mr-2" />
          Add Power Symbol
        </ContextMenuItem>
        <ContextMenuItem
          data-testid="ctx-replace-component"
          onSelect={handleCtxReplaceComponent}
          disabled={reactFlowInstance.getNodes().filter(n => n.selected && n.type === 'schematic-instance').length !== 1}
        >
          <ArrowRightLeft className="w-4 h-4 mr-2" />
          Replace Component
        </ContextMenuItem>
        <ContextMenuItem
          data-testid="ctx-add-decoupling"
          onSelect={handleCtxAddDecoupling}
          disabled={reactFlowInstance.getNodes().filter(n => n.selected && n.type === 'schematic-instance').length !== 1}
        >
          <Zap className="w-4 h-4 mr-2" />
          Add Decoupling Caps
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem data-testid="ctx-paste" onSelect={triggerPaste}>
          <ClipboardPaste className="w-4 h-4 mr-2" />
          Paste
          <span className="ml-auto text-muted-foreground text-[10px]">Ctrl+V</span>
        </ContextMenuItem>
        <ContextMenuItem data-testid="ctx-select-all" onSelect={handleCtxSelectAll}>
          <CheckSquare className="w-4 h-4 mr-2" />
          Select All
          <span className="ml-auto text-muted-foreground text-[10px]">Ctrl+A</span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem data-testid="ctx-run-erc" onSelect={handleCtxRunErc}>
          <ShieldAlert className="w-4 h-4 mr-2" />
          Run ERC
        </ContextMenuItem>
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
