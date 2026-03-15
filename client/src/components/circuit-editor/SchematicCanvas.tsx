import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  useHierarchicalPorts,
  useUpdateCircuitDesign,
  useUpdateCircuitInstance,
  useCreateCircuitInstance,
  useCreateCircuitNet,
  useUpdateCircuitNet,
  useDeleteCircuitInstance,
  useDeleteCircuitNet,
} from '@/lib/circuit-editor/hooks';
import { useComponentParts } from '@/lib/component-editor/hooks';
import { generateRefDes } from '@/lib/circuit-editor/ref-des';
import SchematicInstanceNode, { type InstanceNodeData } from './SchematicInstanceNode';
import SchematicPowerNode, { type PowerNodeData } from './SchematicPowerNode';
import SchematicNetLabelNode, { type NetLabelNodeData } from './SchematicNetLabelNode';
import SchematicNoConnectNode, { type NoConnectNodeData } from './SchematicNoConnectNode';
import SchematicSheetNode, { type SheetNodeData } from './SchematicSheetNode';
import SchematicAnnotationNode, { type AnnotationNodeData } from './SchematicAnnotationNode';
import SchematicNetEdge from './SchematicNetEdge';
import NetDrawingTool, { type NetDrawingResult } from './NetDrawingTool';
import SchematicToolbar from './SchematicToolbar';
import NetBrowserPanel from './NetBrowserPanel';
import ComponentReplacementDialog from './ComponentReplacementDialog';
import AlternatePartsPopover from './AlternatePartsPopover';
import type { AngleConstraint } from './SchematicToolbar';
import type { SchematicTool, CircuitSettings, PowerSymbol, SchematicNetLabel, SchematicAnnotation, NoConnectMarker, ERCViolation } from '@shared/circuit-types';
import { DEFAULT_CIRCUIT_SETTINGS } from '@shared/circuit-types';
import type { CircuitDesignRow, CircuitInstanceRow, CircuitNetRow, ComponentPart, HierarchicalPortRow } from '@shared/schema';
import type { Connector, Shape, PartMeta, PartViews } from '@shared/component-types';
import { COMPONENT_DRAG_TYPE, type ComponentDragData } from './ComponentPlacer';
import { POWER_SYMBOL_DRAG_TYPE, type PowerSymbolDragData } from './PowerSymbolPalette';
import { CircuitBoard, Plus, Cable, Zap, ClipboardPaste, CheckSquare, ShieldAlert, ArrowRightLeft, Network } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import ERCOverlay from './ERCOverlay';
import SimulationVisualOverlay from './SimulationVisualOverlay';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { useBom } from '@/lib/contexts/bom-context';
import { useSchematicAlternates } from '@/lib/schematic-alternates';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';

// ---------------------------------------------------------------------------
// Clipboard bundle types (used by copy/paste)
// ---------------------------------------------------------------------------

interface ClipboardInstance {
  partId: number | null;
  referenceDesignator: string;
  schematicX: number;
  schematicY: number;
  schematicRotation: number;
  properties: unknown;
  oldId: number;
}

interface ClipboardNetSegment {
  fromInstanceId: number;
  fromPin: string;
  toInstanceId: number;
  toPin: string;
  waypoints?: Array<{ x: number; y: number }>;
}

interface ClipboardNet {
  name: string;
  netType: string;
  style: unknown;
  segments: ClipboardNetSegment[];
}

interface SchematicClipboardBundle {
  type: 'protopulse-schematic-bundle';
  instances: ClipboardInstance[];
  powerSymbols: PowerSymbol[];
  netLabels: SchematicNetLabel[];
  noConnectMarkers: NoConnectMarker[];
  nets: ClipboardNet[];
}

// ---------------------------------------------------------------------------
// React Flow type registrations
// ---------------------------------------------------------------------------

const nodeTypes = {
  'schematic-instance': SchematicInstanceNode,
  'schematic-power': SchematicPowerNode,
  'schematic-net-label': SchematicNetLabelNode,
  'schematic-no-connect': SchematicNoConnectNode,
  'schematic-sheet': SchematicSheetNode,
  'schematic-annotation': SchematicAnnotationNode,
};
const edgeTypes = { 'schematic-net': SchematicNetEdge };

// ---------------------------------------------------------------------------
// Converters: DB rows → React Flow elements
// ---------------------------------------------------------------------------

function instanceToNode(
  row: CircuitInstanceRow,
  part: ComponentPart | undefined,
  subDesigns?: CircuitDesignRow[],
  portsByDesign?: Map<number, HierarchicalPortRow[]>,
  onEnterSheet?: (id: number) => void,
  onRefdesChange?: (newRefdes: string) => void,
): Node<InstanceNodeData | SheetNodeData> {
  // 1. Check if this is a hierarchical sub-sheet
  if (row.subDesignId) {
    const subDesign = subDesigns?.find(d => d.id === row.subDesignId);
    const ports = portsByDesign?.get(row.subDesignId) || [];
    
    return {
      id: `instance-${row.id}`,
      type: 'schematic-sheet',
      position: { x: row.schematicX, y: row.schematicY },
      data: {
        instanceId: row.id,
        subDesignId: row.subDesignId,
        referenceDesignator: row.referenceDesignator,
        sheetName: subDesign?.name || 'Sub-sheet',
        ports,
        onEnterSheet,
      },
    };
  }

  // 2. Otherwise it's a standard component instance
  const meta = (part?.meta ?? {}) as Partial<PartMeta>;
  const connectors = (part?.connectors ?? []) as Connector[];
  const views = (part?.views ?? {}) as Partial<PartViews>;
  const schematicShapes = (views.schematic?.shapes ?? []) as Shape[];

  return {
    id: `instance-${row.id}`,
    type: 'schematic-instance',
    position: { x: row.schematicX, y: row.schematicY },
    data: {
      instanceId: row.id,
      referenceDesignator: row.referenceDesignator,
      rotation: row.schematicRotation,
      partTitle: meta.title || 'Untitled',
      connectors,
      schematicShapes,
      onRefdesChange,
    },
  } as Node<InstanceNodeData>;
}

interface NetSegmentJSON {
  fromInstanceId: number;
  fromPin: string;
  toInstanceId: number;
  toPin: string;
  waypoints?: Array<{ x: number; y: number }>;
}

/**
 * Resolve a pin reference to a connector ID. If the pin reference is already
 * a valid connector ID, return it. Otherwise, try matching by connector name
 * (case-insensitive) — this handles AI/import-generated nets that use pin
 * names (e.g. "PB0") instead of connector IDs (e.g. "pin1"). (BL-0014)
 */
function resolvePinId(
  pin: string,
  instanceId: number,
  connectorsByInstance: Map<number, Connector[]>,
): string {
  const connectors = connectorsByInstance.get(instanceId);
  if (!connectors) { return pin; }
  // Direct match by ID — already correct
  if (connectors.some((c) => c.id === pin)) { return pin; }
  // Fallback: match by name (case-insensitive)
  const byName = connectors.find((c) => c.name.toLowerCase() === pin.toLowerCase());
  if (byName) { return byName.id; }
  // No match found — return as-is (will cause React Flow warning)
  return pin;
}

function netToEdges(
  net: CircuitNetRow,
  connectorsByInstance: Map<number, Connector[]>,
  onNetNameChange?: (netId: number, newName: string) => void,
): Edge[] {
  const segments = (net.segments ?? []) as NetSegmentJSON[];
  const style = (net.style ?? {}) as { color?: string };

  return segments.map((seg) => {
    const fromPin = resolvePinId(seg.fromPin, seg.fromInstanceId, connectorsByInstance);
    const toPin = resolvePinId(seg.toPin, seg.toInstanceId, connectorsByInstance);
    return {
      // Stable ID derived from segment endpoints — survives reordering
      id: `net-${net.id}-${seg.fromInstanceId}:${seg.fromPin}-${seg.toInstanceId}:${seg.toPin}`,
      type: 'schematic-net',
      source: `instance-${seg.fromInstanceId}`,
      sourceHandle: `pin-${fromPin}`,
      target: `instance-${seg.toInstanceId}`,
      targetHandle: `pin-${toPin}`,
      data: {
        netName: net.name,
        netType: net.netType,
        color: style.color,
        busWidth: net.busWidth ?? undefined,
        netId: net.id,
        onNetNameChange,
      },
    };
  });
}

function powerSymbolToNode(ps: PowerSymbol): Node<PowerNodeData> {
  return {
    id: `power-${ps.id}`,
    type: 'schematic-power',
    position: { x: ps.x, y: ps.y },
    data: {
      symbolId: ps.id,
      symbolType: ps.type,
      netName: ps.netName,
      rotation: ps.rotation,
      customLabel: ps.customLabel,
    },
  };
}

function netLabelToNode(
  label: SchematicNetLabel,
  onNetNameChange?: (labelId: string, newName: string) => void,
): Node<NetLabelNodeData> {
  return {
    id: `netlabel-${label.id}`,
    type: 'schematic-net-label',
    position: { x: label.x, y: label.y },
    data: {
      labelId: label.id,
      netName: label.netName,
      rotation: label.rotation,
      onNetNameChange,
    },
  };
}

function noConnectToNode(nc: NoConnectMarker): Node<NoConnectNodeData> {
  return {
    id: `noconnect-${nc.id}`,
    type: 'schematic-no-connect',
    position: { x: nc.x, y: nc.y },
    data: {
      markerId: nc.id,
      instanceId: nc.instanceId,
      pin: nc.pin,
    },
  };
}

function annotationToNode(
  ann: SchematicAnnotation,
  onTextChange?: (id: string, text: string) => void,
  onFontSizeChange?: (id: string, fontSize: number) => void,
  onColorChange?: (id: string, color: string) => void,
): Node<AnnotationNodeData> {
  return {
    id: `annotation-${ann.id}`,
    type: 'schematic-annotation',
    position: { x: ann.x, y: ann.y },
    data: {
      annotationId: ann.id,
      text: ann.text,
      fontSize: ann.fontSize,
      color: ann.color,
      onTextChange,
      onFontSizeChange,
      onColorChange,
    },
  };
}

// ---------------------------------------------------------------------------
// Inner canvas (requires ReactFlowProvider ancestor)
// ---------------------------------------------------------------------------

interface SchematicCanvasInnerProps {
  circuitId: number;
  ercViolations?: ERCViolation[];
  highlightedViolationId?: string | null;
  onEnterSheet?: (id: number) => void;
}

function SchematicCanvasInner({ circuitId, ercViolations, highlightedViolationId, onEnterSheet }: SchematicCanvasInnerProps) {
  const projectId = useProjectId();

  // Data queries
  const { data: circuitDesign } = useCircuitDesign(projectId, circuitId);
  const { data: instances } = useCircuitInstances(circuitId);
  const { data: nets } = useCircuitNets(circuitId);
  const { data: subDesigns } = useChildDesigns(projectId, circuitId);
  
  // Fetch ports for ALL sub-designs to render Sheet Symbols accurately
  // In a real large app we'd batch this, but for now we'll handle sub-sheets
  // by assuming the model can handle several queries or we might need a batch port API.
  // Actually, let's just fetch for the subDesigns we found.
  const subDesignIds = useMemo(() => (subDesigns ?? []).map(d => d.id), [subDesigns]);
  
  // This is a bit tricky with hooks in a loop, so we'll just support 
  // one level of ports for now if we can or use a combined query if available.
  // Given current architecture, we'll assume ports for Sheet Symbols are 
  // fetched when we have sub-designs.
  const portsByDesign = new Map<number, HierarchicalPortRow[]>();
  // TODO: Implement batch ports API or sequential fetch if sub-sheet count is low
  
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
  // object every render (with updated loading/error state). Using these in useCallback
  // deps causes the callbacks to recreate every render, which cascades into rfNodes
  // useMemo → useEffect setLocalNodes → ReactFlow StoreUpdater → infinite re-render loop.
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

  // Local UI state
  const [activeTool, setActiveTool] = useState<SchematicTool>('select');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [gridVisible, setGridVisible] = useState(true);
  const [angleConstraint, setAngleConstraint] = useState<AngleConstraint>('free');
  const [selectedNetName, setSelectedNetName] = useState<string | null>(null);
  const [mouseFlowPos, setMouseFlowPos] = useState<{ x: number; y: number } | null>(null);

  // BL-0105: Replacement dialog state
  const [isReplacementOpen, setIsReplacementOpen] = useState(false);
  const [showNetBrowser, setShowNetBrowser] = useState(false);
  const [replacementInstance, setReplacementInstance] = useState<CircuitInstanceRow | null>(null);
  const [replacementPart, setReplacementPart] = useState<ComponentPart | null>(null);

  const handleReplaceComponent = useCallback((newPartId: number) => {
    if (!replacementInstance) return;
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
  const clipboardRef = useRef<SchematicClipboardBundle | null>(null);

  const reactFlowInstance = useReactFlow();

  // Read circuit design settings
  const settings = useMemo<CircuitSettings>(() => ({
    ...DEFAULT_CIRCUIT_SETTINGS,
    ...(circuitDesign?.settings as Partial<CircuitSettings> | null),
  }), [circuitDesign?.settings]);

  const gridSize = settings.gridSize;

  // BL-0489: Net label inline editing — rename a label and persist to design settings
  const handleNetNameChange = useCallback(
    (labelId: string, newName: string) => {
      const updated = (settings.netLabels ?? []).map((nl) =>
        nl.id === labelId ? { ...nl, netName: newName } : nl,
      );
      updateDesignRef.current.mutate({ projectId, id: circuitId, settings: { ...settings, netLabels: updated } });
    },
    [circuitId, projectId, settings],
  );

  // BL-0492: Annotation inline editing callbacks
  const handleAnnotationTextChange = useCallback(
    (annotationId: string, text: string) => {
      const updated = (settings.annotations ?? []).map((a) =>
        a.id === annotationId ? { ...a, text } : a,
      );
      updateDesignRef.current.mutate({ projectId, id: circuitId, settings: { ...settings, annotations: updated } });
    },
    [circuitId, projectId, settings],
  );

  const handleAnnotationFontSizeChange = useCallback(
    (annotationId: string, fontSize: number) => {
      const updated = (settings.annotations ?? []).map((a) =>
        a.id === annotationId ? { ...a, fontSize } : a,
      );
      updateDesignRef.current.mutate({ projectId, id: circuitId, settings: { ...settings, annotations: updated } });
    },
    [circuitId, projectId, settings],
  );

  const handleAnnotationColorChange = useCallback(
    (annotationId: string, color: string) => {
      const updated = (settings.annotations ?? []).map((a) =>
        a.id === annotationId ? { ...a, color } : a,
      );
      updateDesignRef.current.mutate({ projectId, id: circuitId, settings: { ...settings, annotations: updated } });
    },
    [circuitId, projectId, settings],
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
    const map = new Map<number, ComponentPart>();
    parts?.forEach((p) => map.set(p.id, p));
    return map;
  }, [parts]);

  // BL-0540: Compute alternate parts info for all instances
  const alternatesMap = useSchematicAlternates(instances, partsMap);

  // Convert DB data → React Flow nodes (instances + power symbols + net labels + no-connects)
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

  // Sync server data → local state (guarded against in-flight drag)
  useEffect(() => {
    if (!isDragging.current) {
      setLocalNodes(rfNodes);
    }
  }, [rfNodes, setLocalNodes]);

  useEffect(() => {
    setLocalEdges(rfEdges);
  }, [rfEdges, setLocalEdges]);

  // Track drag start
  const onNodeDragStart = useCallback(() => {
    isDragging.current = true;
  }, []);

  // Persist position on drag stop — routes to correct storage per node type
  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      isDragging.current = false;
      const { x, y } = node.position;

      if (node.id.startsWith('power-')) {
        const symbolId = (node.data as PowerNodeData)?.symbolId;
        if (!symbolId) return;
        const updated = (settings.powerSymbols ?? []).map((ps) =>
          ps.id === symbolId ? { ...ps, x, y } : ps,
        );
        updateDesignRef.current.mutate({ projectId, id: circuitId, settings: { ...settings, powerSymbols: updated } });
      } else if (node.id.startsWith('netlabel-')) {
        const labelId = (node.data as NetLabelNodeData)?.labelId;
        if (!labelId) return;
        const updated = (settings.netLabels ?? []).map((nl) =>
          nl.id === labelId ? { ...nl, x, y } : nl,
        );
        updateDesignRef.current.mutate({ projectId, id: circuitId, settings: { ...settings, netLabels: updated } });
      } else if (node.id.startsWith('noconnect-')) {
        const markerId = (node.data as NoConnectNodeData)?.markerId;
        if (!markerId) return;
        const updated = (settings.noConnectMarkers ?? []).map((nc) =>
          nc.id === markerId ? { ...nc, x, y } : nc,
        );
        updateDesignRef.current.mutate({ projectId, id: circuitId, settings: { ...settings, noConnectMarkers: updated } });
      } else if (node.id.startsWith('annotation-')) {
        const annotationId = (node.data as AnnotationNodeData)?.annotationId;
        if (!annotationId) return;
        const updated = (settings.annotations ?? []).map((a) =>
          a.id === annotationId ? { ...a, x, y } : a,
        );
        updateDesignRef.current.mutate({ projectId, id: circuitId, settings: { ...settings, annotations: updated } });
      } else {
        const instanceId = (node.data as InstanceNodeData)?.instanceId;
        if (typeof instanceId !== 'number') return;
        updateInstanceRef.current.mutate({ circuitId, id: instanceId, schematicX: x, schematicY: y });
      }
    },
    [circuitId, projectId, settings],
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

      // Batch-update settings if any settings-stored nodes were deleted
      const needsUpdate =
        deletedPowerIds.length > 0 || deletedLabelIds.length > 0 || deletedNcIds.length > 0 || deletedAnnotationIds.length > 0;

      if (needsUpdate) {
        const powerSet = new Set(deletedPowerIds);
        const labelSet = new Set(deletedLabelIds);
        const ncSet = new Set(deletedNcIds);
        const annotationSet = new Set(deletedAnnotationIds);
        updateDesignRef.current.mutate({
          projectId,
          id: circuitId,
          settings: {
            ...settings,
            powerSymbols: (settings.powerSymbols ?? []).filter((ps) => !powerSet.has(ps.id)),
            netLabels: (settings.netLabels ?? []).filter((nl) => !labelSet.has(nl.id)),
            noConnectMarkers: (settings.noConnectMarkers ?? []).filter((nc) => !ncSet.has(nc.id)),
            annotations: (settings.annotations ?? []).filter((a) => !annotationSet.has(a.id)),
          },
        });
      }
    },
    [circuitId, projectId, settings],
  );

  // Delete selected edges — removes individual segments, not entire nets
  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      // Group deletions by net ID
      const segmentRemovals = new Map<number, Set<string>>();

      for (const edge of deleted) {
        const match = edge.id.match(/^net-(\d+)-/);
        if (!match) continue;
        const netId = parseInt(match[1], 10);
        if (!segmentRemovals.has(netId)) segmentRemovals.set(netId, new Set());
        segmentRemovals.get(netId)!.add(edge.id);
      }

      Array.from(segmentRemovals.entries()).forEach(([netId, removedEdgeIds]) => {
        const net = nets?.find((n) => n.id === netId);
        if (!net) return;

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

      if (!sourceInstanceId || !targetInstanceId || !sourcePinId || !targetPinId)
        return;

      // Resolve human-readable pin names and ref designators for the net name
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
      setMouseFlowPos({ x: Math.round(pos.x), y: Math.round(pos.y) });
    },
    [reactFlowInstance],
  );

  const handleCanvasMouseLeave = useCallback(() => {
    setMouseFlowPos(null);
  }, []);

  // Toolbar actions
  const handleFitView = useCallback(() => {
    reactFlowInstance.fitView({ padding: 0.2 });
  }, [reactFlowInstance]);

  const handlePaste = useCallback(async (bundle: SchematicClipboardBundle) => {
    if (!bundle || bundle.type !== 'protopulse-schematic-bundle') return;

    const center = reactFlowInstance.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });

    const insts = bundle.instances || [];
    const pwr = bundle.powerSymbols || [];
    const lbl = bundle.netLabels || [];
    const ncm = bundle.noConnectMarkers || [];

    if (insts.length === 0 && pwr.length === 0 && lbl.length === 0 && ncm.length === 0) return;

    const allX = [...insts.map((i) => i.schematicX), ...pwr.map((p) => p.x)];
    const allY = [...insts.map((i) => i.schematicY), ...pwr.map((p) => p.y)];
    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);
    const minY = Math.min(...allY);
    const maxY = Math.max(...allY);
    const bboxCenterX = (minX + maxX) / 2;
    const bboxCenterY = (minY + maxY) / 2;

    const offsetX = center.x - bboxCenterX;
    const offsetY = center.y - bboxCenterY;

    const idMap = new Map<number, number>();
    const usedRefDes = new Set((instances ?? []).map(i => i.referenceDesignator));

    try {
      // 1. Create instances
      for (const inst of insts) {
        const part = inst.partId != null ? partsMap.get(inst.partId) : undefined;
        const refDes = generateRefDes(instances, part);
        // Ensure unique refDes in the batch
        let uniqueRefDes = refDes;
        let suffix = 1;
        while (usedRefDes.has(uniqueRefDes)) {
          const prefix = uniqueRefDes.replace(/\d+$/, '');
          const match = uniqueRefDes.match(/\d+$/);
          const num = match ? parseInt(match[0], 10) : 0;
          uniqueRefDes = `${prefix}${num + suffix}`;
          suffix++;
        }
        usedRefDes.add(uniqueRefDes);

        const newInst = await createInstanceRef.current.mutateAsync({
          circuitId,
          partId: inst.partId,
          referenceDesignator: uniqueRefDes,
          schematicX: inst.schematicX + offsetX,
          schematicY: inst.schematicY + offsetY,
          schematicRotation: inst.schematicRotation,
          properties: inst.properties as Record<string, string> | undefined,
        });
        idMap.set(inst.oldId, newInst.id);
      }

      // 2. Create nets
      for (const net of (bundle.nets || [])) {
        const newSegments = net.segments.map((seg: ClipboardNetSegment) => ({
          ...seg,
          fromInstanceId: idMap.get(seg.fromInstanceId),
          toInstanceId: idMap.get(seg.toInstanceId),
        })).filter((s) => s.fromInstanceId && s.toInstanceId);

        if (newSegments.length > 0) {
          await createNetRef.current.mutateAsync({
            circuitId,
            name: `${net.name}_copy`,
            netType: net.netType as 'signal' | 'power' | 'ground' | 'bus' | undefined,
            segments: newSegments,
            style: net.style,
          });
        }
      }

      // 3. Annotations
      const newPowerSymbols = pwr.map((ps) => ({
        ...ps,
        id: crypto.randomUUID(),
        x: ps.x + offsetX,
        y: ps.y + offsetY,
      }));

      const newNetLabels = lbl.map((nl) => ({
        ...nl,
        id: crypto.randomUUID(),
        x: nl.x + offsetX,
        y: nl.y + offsetY,
      }));

      const newNoConnectMarkers = ncm.map((nc) => ({
        ...nc,
        id: crypto.randomUUID(),
        x: nc.x + offsetX,
        y: nc.y + offsetY,
      }));

      if (newPowerSymbols.length > 0 || newNetLabels.length > 0 || newNoConnectMarkers.length > 0) {
        await updateDesignRef.current.mutateAsync({
          projectId,
          id: circuitId,
          settings: {
            ...settings,
            powerSymbols: [...(settings.powerSymbols ?? []), ...newPowerSymbols],
            netLabels: [...(settings.netLabels ?? []), ...newNetLabels],
            noConnectMarkers: [...(settings.noConnectMarkers ?? []), ...newNoConnectMarkers],
          }
        });
      }

      toastRef.current({
        title: 'Pasted successfully',
        description: `Added ${insts.length} components and ${bundle.nets?.length || 0} nets.`,
      });
    } catch (err) {
      console.error('Paste failed', err);
      toastRef.current({
        variant: 'destructive',
        title: 'Paste failed',
        description: 'An error occurred while pasting schematic elements.',
      });
    }
  }, [circuitId, projectId, instances, partsMap, settings, reactFlowInstance]);

  const handleOpenShortcuts = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
  }, []);

  const triggerPaste = useCallback(async () => {
    let bundle = clipboardRef.current;
    if (!bundle) {
      try {
        const text = await navigator.clipboard.readText();
        const parsed = JSON.parse(text);
        if (parsed.type === 'protopulse-schematic-bundle') {
          bundle = parsed;
        }
      } catch (err) {
        // Not a valid bundle in clipboard
      }
    }

    if (bundle) {
      void handlePaste(bundle);
    }
  }, [handlePaste]);

  // Drag-over handler — accept component and power symbol drops
  const onDragOver = useCallback((e: React.DragEvent) => {
    if (
      e.dataTransfer.types.includes(COMPONENT_DRAG_TYPE) ||
      e.dataTransfer.types.includes(POWER_SYMBOL_DRAG_TYPE)
    ) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  // Drop handler — component instances and power symbols
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      // Helper: snap drop position to grid
      const getDropPosition = () => {
        const pos = reactFlowInstance.screenToFlowPosition({
          x: e.clientX,
          y: e.clientY,
        });
        if (snapEnabled) {
          pos.x = Math.round(pos.x / gridSize) * gridSize;
          pos.y = Math.round(pos.y / gridSize) * gridSize;
        }
        return pos;
      };

      // Component instance drop
      const componentRaw = e.dataTransfer.getData(COMPONENT_DRAG_TYPE);
      if (componentRaw) {
        e.preventDefault();
        let dragData: ComponentDragData;
        try {
          dragData = JSON.parse(componentRaw) as ComponentDragData;
        } catch {
          return;
        }

        const part = partsMap.get(dragData.partId);
        const position = getDropPosition();
        const refDes = generateRefDes(instances, part);
        const partMeta = (part?.meta ?? {}) as Partial<PartMeta>;
        const partTitle = partMeta.title || 'Component';
        const partValueProp = partMeta.properties?.find((p) => p.key === 'value');
        const partValue = partValueProp?.value ?? '';
        const partMpn = partMeta.mpn ?? '';

        createInstanceRef.current.mutate({
          circuitId,
          partId: dragData.partId,
          referenceDesignator: refDes,
          schematicX: position.x,
          schematicY: position.y,
        });

        // BL-0498: Offer to add to BOM after placement
        const bomLabel = partValue ? `${refDes} (${partValue})` : refDes;
        const existingBomItem = bom.find(
          (item) => item.description === partTitle && item.partNumber === partMpn,
        );
        if (existingBomItem) {
          toastRef.current({
            title: `Add ${bomLabel} to BOM?`,
            description: `"${partTitle}" already in BOM (qty ${String(existingBomItem.quantity)}). Increment?`,
            action: (
              <ToastAction
                altText="Increment quantity"
                data-testid="bom-increment-action"
                onClick={() => {
                  updateBomItem(existingBomItem.id, { quantity: existingBomItem.quantity + 1 });
                }}
              >
                Increment
              </ToastAction>
            ),
          });
        } else {
          toastRef.current({
            title: `Add ${bomLabel} to BOM?`,
            description: `Place "${partTitle}" in your bill of materials.`,
            action: (
              <ToastAction
                altText="Add to BOM"
                data-testid="bom-add-action"
                onClick={() => {
                  addBomItem({
                    partNumber: partMpn,
                    manufacturer: partMeta.manufacturer || '',
                    description: partTitle,
                    quantity: 1,
                    unitPrice: 0,
                    totalPrice: 0,
                    supplier: 'Unknown',
                    stock: 0,
                    status: 'In Stock',
                  });
                }}
              >
                Add to BOM
              </ToastAction>
            ),
          });
        }
        return;
      }

      // Power symbol drop
      const powerRaw = e.dataTransfer.getData(POWER_SYMBOL_DRAG_TYPE);
      if (powerRaw) {
        e.preventDefault();
        let dragData: PowerSymbolDragData;
        try {
          dragData = JSON.parse(powerRaw) as PowerSymbolDragData;
        } catch {
          return;
        }

        const position = getDropPosition();
        const newSymbol: PowerSymbol = {
          id: crypto.randomUUID(),
          type: dragData.symbolType,
          netName: dragData.netName,
          x: position.x,
          y: position.y,
          rotation: 0,
          customLabel: dragData.customLabel,
        };

        const currentSymbols = settings.powerSymbols ?? [];
        updateDesignRef.current.mutate({
          projectId,
          id: circuitId,
          settings: { ...settings, powerSymbols: [...currentSymbols, newSymbol] },
        });

        // BL-0493: Auto-connect — find compatible pins within snap distance
        const SNAP_DISTANCE = gridSize * 3;
        const isGround = /gnd|ground|vss|v\-/i.test(dragData.netName);
        const isPower = /vcc|vdd|vpp|v\+|power/i.test(dragData.netName);

        if ((isGround || isPower) && instances) {
          const compatiblePins: Array<{ instanceId: number; pinId: string; refDes: string }> = [];

          for (const inst of instances) {
            const part = inst.partId != null ? partsMap.get(inst.partId) : undefined;
            if (!part) { continue; }
            const connectors = (part.connectors ?? []) as Connector[];
            const instX = inst.schematicX;
            const instY = inst.schematicY;

            for (const conn of connectors) {
              const pinNameMatch = isGround
                ? /gnd|ground|vss|v\-/i.test(conn.name)
                : /vcc|vdd|vpp|v\+|power/i.test(conn.name);
              if (!pinNameMatch) { continue; }

              // Compute actual pin world position using terminal offset from instance origin
              const terminal = conn.terminalPositions?.schematic;
              const pinX = instX + (terminal?.x ?? 0);
              const pinY = instY + (terminal?.y ?? 0);
              const dx = Math.abs(position.x - pinX);
              const dy = Math.abs(position.y - pinY);
              const dist = Math.sqrt(dx * dx + dy * dy);

              if (dist <= SNAP_DISTANCE) {
                compatiblePins.push({ instanceId: inst.id, pinId: conn.id, refDes: inst.referenceDesignator });
              }
            }
          }

          // Create nets connecting pairs of compatible pins to the power net
          if (compatiblePins.length >= 2) {
            for (let i = 1; i < compatiblePins.length; i++) {
              const from = compatiblePins[i - 1];
              const to = compatiblePins[i];
              createNetRef.current.mutate({
                circuitId,
                name: dragData.netName,
                netType: isGround ? 'ground' : 'power',
                segments: [{
                  fromInstanceId: from.instanceId,
                  fromPin: from.pinId,
                  toInstanceId: to.instanceId,
                  toPin: to.pinId,
                }],
              });
            }
            toastRef.current({
              title: 'Auto-connected power pins',
              description: `Connected ${String(compatiblePins.length)} pins to ${dragData.netName}.`,
            });
          } else if (compatiblePins.length === 1) {
            toastRef.current({
              title: 'Power pin detected',
              description: `${compatiblePins[0].refDes} has a compatible ${dragData.netName} pin nearby.`,
            });
          }
        }
      }
    },
    [circuitId, projectId, instances, partsMap, settings, reactFlowInstance, snapEnabled, gridSize],
  );

  // Net drawing tool callback — creates a net with waypoints
  const onNetDrawn = useCallback(
    (result: NetDrawingResult) => {
      // Resolve human-readable pin names and ref designators
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

  // Keyboard shortcuts (only for implemented tools)
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      )
        return;

      const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl+C — copy selected instances, nets, and annotations
      if (modKey && e.key.toLowerCase() === 'c' && !e.shiftKey) {
        const selectedNodes = localNodes.filter(n => n.selected);
        if (selectedNodes.length === 0) return;

        e.preventDefault();

        const selectedInstanceIds = new Set(
          selectedNodes
            .filter(n => n.type === 'schematic-instance')
            .map(n => (n.data as InstanceNodeData).instanceId)
        );

        const bundle: SchematicClipboardBundle = {
          type: 'protopulse-schematic-bundle',
          instances: (instances ?? [])
            .filter(inst => selectedInstanceIds.has(inst.id))
            .map(inst => ({
              partId: inst.partId,
              referenceDesignator: inst.referenceDesignator,
              schematicX: inst.schematicX,
              schematicY: inst.schematicY,
              schematicRotation: inst.schematicRotation,
              properties: inst.properties,
              oldId: inst.id
            })),
          powerSymbols: selectedNodes
            .filter(n => n.type === 'schematic-power')
            .map(n => {
              const d = n.data as PowerNodeData;
              return (settings.powerSymbols ?? []).find(ps => ps.id === d.symbolId);
            })
            .filter((ps): ps is PowerSymbol => ps != null),
          netLabels: selectedNodes
            .filter(n => n.type === 'schematic-net-label')
            .map(n => {
              const d = n.data as NetLabelNodeData;
              return (settings.netLabels ?? []).find(nl => nl.id === d.labelId);
            })
            .filter((nl): nl is SchematicNetLabel => nl != null),
          noConnectMarkers: selectedNodes
            .filter(n => n.type === 'schematic-no-connect')
            .map(n => {
              const d = n.data as NoConnectNodeData;
              return (settings.noConnectMarkers ?? []).find(nc => nc.id === d.markerId);
            })
            .filter((nc): nc is NoConnectMarker => nc != null),
          nets: (nets ?? [])
            .filter(net => {
              const segments = (net.segments ?? []) as NetSegmentJSON[];
              return segments.some(seg =>
                selectedInstanceIds.has(seg.fromInstanceId) &&
                selectedInstanceIds.has(seg.toInstanceId)
              );
            })
            .map(net => ({
              name: net.name,
              netType: net.netType,
              style: net.style,
              segments: ((net.segments ?? []) as NetSegmentJSON[]).filter((seg) =>
                selectedInstanceIds.has(seg.fromInstanceId) &&
                selectedInstanceIds.has(seg.toInstanceId)
              )
            }))
        };

        clipboardRef.current = bundle;
        try {
          await navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
          toastRef.current({
            title: 'Copied to clipboard',
            description: `Copied ${bundle.instances.length} components and ${bundle.nets.length} nets.`,
          });
        } catch (err) {
          console.error('Copy failed', err);
        }
        return;
      }

      // Ctrl+V — paste from internal or system clipboard
      if (modKey && e.key.toLowerCase() === 'v' && !e.shiftKey) {
        let bundle = clipboardRef.current;
        if (!bundle) {
          try {
            const text = await navigator.clipboard.readText();
            const parsed = JSON.parse(text);
            if (parsed.type === 'protopulse-schematic-bundle') {
              bundle = parsed;
            }
          } catch (err) {
            // Not a valid bundle in clipboard
          }
        }

        if (bundle) {
          e.preventDefault();
          void handlePaste(bundle);
        }
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'v':
          setActiveTool('select');
          break;
        case 'h':
          setActiveTool('pan');
          break;
        case 'w':
          setActiveTool('draw-net');
          break;
        case 't':
          setActiveTool('place-annotation');
          break;
        case 'g':
          setSnapEnabled((s) => !s);
          break;
        case 'f':
          handleFitView();
          break;
        case 'escape':
          setActiveTool('select');
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFitView, localNodes, instances, nets, settings, handlePaste]);

  // Context menu handlers
  const handleCtxAddComponent = useCallback(() => {
    // Focus the sidebar component search so the user can pick a component to place
    window.dispatchEvent(new CustomEvent('protopulse:focus-component-search'));
  }, []);

  const handleCtxAddWire = useCallback(() => {
    setActiveTool('draw-net');
  }, []);

  const handleCtxAddPower = useCallback(() => {
    const pos = reactFlowInstance.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    const snapped = snapEnabled
      ? { x: Math.round(pos.x / gridSize) * gridSize, y: Math.round(pos.y / gridSize) * gridSize }
      : pos;
    const newSymbol: PowerSymbol = {
      id: crypto.randomUUID(),
      type: 'VCC',
      netName: 'VCC',
      x: snapped.x,
      y: snapped.y,
      rotation: 0,
    };
    const currentSymbols = settings.powerSymbols ?? [];
    updateDesignRef.current.mutate({
      projectId,
      id: circuitId,
      settings: { ...settings, powerSymbols: [...currentSymbols, newSymbol] },
    });
  }, [reactFlowInstance, snapEnabled, gridSize, settings, projectId, circuitId]);

  const handleCtxSelectAll = useCallback(() => {
    setLocalNodes((nds) => nds.map((n) => ({ ...n, selected: true })));
  }, [setLocalNodes]);

  const handleCtxReplaceComponent = useCallback(() => {
    const selected = reactFlowInstance.getNodes().filter(n => n.selected);
    if (selected.length === 1 && selected[0].type === 'schematic-instance') {
      const instId = Number(selected[0].id.replace('instance-', ''));
      const inst = instances?.find(i => i.id === instId);
      if (inst) {
        setReplacementInstance(inst);
        setReplacementPart(partsMap.get(inst.partId!) || null);
        setIsReplacementOpen(true);
      }
    }
  }, [reactFlowInstance, instances, partsMap]);

  const handleCtxAddDecoupling = useCallback(() => {
    const selected = reactFlowInstance.getNodes().filter(n => n.selected);
    if (selected.length !== 1 || selected[0].type !== 'schematic-instance') return;

    const instId = Number(selected[0].id.replace('instance-', ''));
    const inst = instances?.find(i => i.id === instId);
    if (!inst) return;

    const part = partsMap.get(inst.partId!);
    if (!part) return;

    const connectors = (part.connectors ?? []) as Connector[];
    const vccPins = connectors.filter(c => /vcc|vdd|vpp|v\+|power/i.test(c.name));
    const gndPins = connectors.filter(c => /gnd|ground|vss|v\-/i.test(c.name));

    if (vccPins.length === 0 || gndPins.length === 0) {
      toastRef.current({
        title: 'No power pins found',
        description: `Could not identify power/ground pins for ${inst.referenceDesignator}.`,
        variant: 'destructive',
      });
      return;
    }

    pushUndoState();

    // 1. Create two capacitors (100nF and 10uF)
    const caps = [
      { value: '100nF', dx: 150, dy: -100 },
      { value: '10uF', dx: 150, dy: 100 }
    ];

    const createPromises = caps.map(async (cap, i) => {
      const cInstance = await createInstanceRef.current.mutateAsync({
        circuitId,
        partId: null, // Generic capacitor
        referenceDesignator: `C_DEC${i + 1}`,
        schematicX: (inst.schematicX || 0) + cap.dx,
        schematicY: (inst.schematicY || 0) + cap.dy,
        properties: { type: 'capacitor', value: cap.value },
      });

      // 2. Connect to first VCC and first GND pin
      const vccPin = vccPins[0].id;
      const gndPin = gndPins[0].id;

      // Pin 1 to VCC
      await createNetRef.current.mutateAsync({
        circuitId,
        name: `VCC_DEC_${inst.referenceDesignator}`,
        netType: 'power',
        segments: [{
          fromInstanceId: cInstance.id,
          fromPin: '1',
          toInstanceId: inst.id,
          toPin: vccPin
        }]
      });

      // Pin 2 to GND
      await createNetRef.current.mutateAsync({
        circuitId,
        name: `GND_DEC_${inst.referenceDesignator}`,
        netType: 'ground',
        segments: [{
          fromInstanceId: cInstance.id,
          fromPin: '2',
          toInstanceId: inst.id,
          toPin: gndPin
        }]
      });
    });

    Promise.all(createPromises).then(() => {
      toastRef.current({
        title: 'Decoupling added',
        description: `Added 100nF and 10uF capacitors to ${inst.referenceDesignator}.`,
      });
    }).catch(err => {
      console.error('Failed to add decoupling:', err);
      toastRef.current({ title: 'Error', description: 'Failed to add decoupling capacitors.', variant: 'destructive' });
    });

  }, [reactFlowInstance, instances, partsMap, circuitId, pushUndoState]);

  const handleCtxRunErc = useCallback(() => {
    window.dispatchEvent(new CustomEvent('protopulse:run-erc'));
  }, []);

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
        // Switch back to select tool after placing
        setActiveTool('select');
        return;
      }
      setSelectedNetName(null);
    },
    [activeTool, reactFlowInstance, snapEnabled, gridSize, settings, projectId, circuitId],
  );

  // Stable toolbar callbacks — prevent SchematicToolbar from re-rendering on every ReactFlow store update
  const handleToggleSnap = useCallback(() => setSnapEnabled((s) => !s), []);
  const handleToggleGridVisible = useCallback(() => setGridVisible((v) => !v), []);

  // Stable ReactFlow props — inline lambdas and array literals cause StoreUpdater to
  // detect prop changes every render, contributing to the infinite update loop.
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

      {/* BL-0619: Simulation visual state overlay (LED glow, resistor labels, switch states) */}
      <SimulationVisualOverlay />

      {/* BL-0540: Alternate parts badges on instance nodes */}
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
                    // Use ReactFlow's CSS transform to position relative to node
                    // The react-flow__nodes container already handles viewport transform,
                    // but this overlay is outside it. We use the node position directly
                    // and let the popover float from there.
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

      {/* UX-031: Selected net pill label */}
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

      {/* UX-032: Inline ERC violations near cursor */}
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
