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
import {
  useCircuitDesign,
  useCircuitInstances,
  useCircuitNets,
  useUpdateCircuitDesign,
  useUpdateCircuitInstance,
  useCreateCircuitInstance,
  useCreateCircuitNet,
  useUpdateCircuitNet,
  useDeleteCircuitInstance,
  useDeleteCircuitNet,
} from '@/lib/circuit-editor/hooks';
import { useComponentParts } from '@/lib/component-editor/hooks';
import SchematicInstanceNode, { type InstanceNodeData } from './SchematicInstanceNode';
import SchematicPowerNode, { type PowerNodeData } from './SchematicPowerNode';
import SchematicNetLabelNode, { type NetLabelNodeData } from './SchematicNetLabelNode';
import SchematicNoConnectNode, { type NoConnectNodeData } from './SchematicNoConnectNode';
import SchematicNetEdge from './SchematicNetEdge';
import NetDrawingTool, { type NetDrawingResult } from './NetDrawingTool';
import SchematicToolbar from './SchematicToolbar';
import type { AngleConstraint } from './SchematicToolbar';
import type { SchematicTool, CircuitSettings, PowerSymbol, SchematicNetLabel, NoConnectMarker, ERCViolation } from '@shared/circuit-types';
import { DEFAULT_CIRCUIT_SETTINGS } from '@shared/circuit-types';
import type { CircuitInstanceRow, CircuitNetRow, ComponentPart } from '@shared/schema';
import type { Connector, Shape, PartMeta, PartViews } from '@shared/component-types';
import { COMPONENT_DRAG_TYPE, type ComponentDragData } from './ComponentPlacer';
import { POWER_SYMBOL_DRAG_TYPE, type PowerSymbolDragData } from './PowerSymbolPalette';
import { CircuitBoard, Plus, Cable, Zap, ClipboardPaste, CheckSquare, ShieldAlert } from 'lucide-react';
import ERCOverlay from './ERCOverlay';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';

// ---------------------------------------------------------------------------
// React Flow type registrations
// ---------------------------------------------------------------------------

const nodeTypes = {
  'schematic-instance': SchematicInstanceNode,
  'schematic-power': SchematicPowerNode,
  'schematic-net-label': SchematicNetLabelNode,
  'schematic-no-connect': SchematicNoConnectNode,
};
const edgeTypes = { 'schematic-net': SchematicNetEdge };

// ---------------------------------------------------------------------------
// Converters: DB rows → React Flow elements
// ---------------------------------------------------------------------------

function instanceToNode(
  row: CircuitInstanceRow,
  part: ComponentPart | undefined,
): Node<InstanceNodeData> {
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
    },
  };
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

function netLabelToNode(label: SchematicNetLabel): Node<NetLabelNodeData> {
  return {
    id: `netlabel-${label.id}`,
    type: 'schematic-net-label',
    position: { x: label.x, y: label.y },
    data: {
      labelId: label.id,
      netName: label.netName,
      rotation: label.rotation,
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

// ---------------------------------------------------------------------------
// Reference designator generation
// ---------------------------------------------------------------------------

/** Maps part family to standard IEEE/IEC reference designator prefix. */
const FAMILY_PREFIX: Record<string, string> = {
  resistor: 'R',
  capacitor: 'C',
  inductor: 'L',
  diode: 'D',
  led: 'D',
  transistor: 'Q',
  mosfet: 'Q',
  bjt: 'Q',
  jfet: 'Q',
  microcontroller: 'U',
  ic: 'U',
  opamp: 'U',
  regulator: 'U',
  sensor: 'U',
  module: 'U',
  connector: 'J',
  header: 'J',
  switch: 'SW',
  relay: 'K',
  crystal: 'Y',
  oscillator: 'Y',
  fuse: 'F',
  transformer: 'T',
  speaker: 'LS',
  buzzer: 'BZ',
  battery: 'BT',
  motor: 'M',
  potentiometer: 'RV',
  thermistor: 'RT',
  varistor: 'RV',
  ferrite: 'FB',
};

function getRefDesPrefix(part: ComponentPart | undefined): string {
  if (!part) return 'X';
  const meta = (part.meta ?? {}) as Partial<PartMeta>;
  const family = (meta.family || '').toLowerCase().trim();
  if (family && FAMILY_PREFIX[family]) return FAMILY_PREFIX[family];

  // Fallback: check tags for a matching family keyword
  const tags = meta.tags ?? [];
  for (const tag of tags) {
    const prefix = FAMILY_PREFIX[tag.toLowerCase().trim()];
    if (prefix) return prefix;
  }

  return 'X';
}

function generateRefDes(
  existingInstances: CircuitInstanceRow[] | undefined,
  part: ComponentPart | undefined,
): string {
  const prefix = getRefDesPrefix(part);
  const existing = (existingInstances ?? [])
    .map((inst) => inst.referenceDesignator)
    .filter((rd) => rd.startsWith(prefix));

  // Extract numeric suffixes and find the max
  let maxNum = 0;
  for (const rd of existing) {
    const numStr = rd.slice(prefix.length);
    const num = parseInt(numStr, 10);
    if (!isNaN(num) && num > maxNum) maxNum = num;
  }

  return `${prefix}${maxNum + 1}`;
}

// ---------------------------------------------------------------------------
// Inner canvas (requires ReactFlowProvider ancestor)
// ---------------------------------------------------------------------------

interface SchematicCanvasInnerProps {
  circuitId: number;
  ercViolations?: ERCViolation[];
  highlightedViolationId?: string | null;
}

function SchematicCanvasInner({ circuitId, ercViolations, highlightedViolationId }: SchematicCanvasInnerProps) {
  const projectId = useProjectId();

  // Data queries
  const { data: circuitDesign } = useCircuitDesign(projectId, circuitId);
  const { data: instances } = useCircuitInstances(circuitId);
  const { data: nets } = useCircuitNets(circuitId);
  const { data: parts } = useComponentParts(projectId);

  // Mutations
  const createInstance = useCreateCircuitInstance();
  const updateDesign = useUpdateCircuitDesign();
  const updateInstance = useUpdateCircuitInstance();
  const deleteInstance = useDeleteCircuitInstance();
  const createNet = useCreateCircuitNet();
  const updateNet = useUpdateCircuitNet();
  const deleteNet = useDeleteCircuitNet();

  // Local UI state
  const [activeTool, setActiveTool] = useState<SchematicTool>('select');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [gridVisible, setGridVisible] = useState(true);
  const [angleConstraint, setAngleConstraint] = useState<AngleConstraint>('free');
  const [selectedNetName, setSelectedNetName] = useState<string | null>(null);
  const [mouseFlowPos, setMouseFlowPos] = useState<{ x: number; y: number } | null>(null);

  // Drag guard — prevents server refetch from resetting node mid-drag
  const isDragging = useRef(false);

  const reactFlowInstance = useReactFlow();

  // Read circuit design settings
  const settings = useMemo<CircuitSettings>(() => ({
    ...DEFAULT_CIRCUIT_SETTINGS,
    ...(circuitDesign?.settings as Partial<CircuitSettings> | null),
  }), [circuitDesign?.settings]);

  const gridSize = settings.gridSize;

  // Build parts lookup map
  const partsMap = useMemo(() => {
    const map = new Map<number, ComponentPart>();
    parts?.forEach((p) => map.set(p.id, p));
    return map;
  }, [parts]);

  // Convert DB data → React Flow nodes (instances + power symbols + net labels + no-connects)
  const rfNodes = useMemo(() => {
    const instanceNodes = (instances ?? []).map((inst) =>
      instanceToNode(inst, inst.partId != null ? partsMap.get(inst.partId) : undefined),
    );
    const powerNodes = (settings.powerSymbols ?? []).map(powerSymbolToNode);
    const labelNodes = (settings.netLabels ?? []).map(netLabelToNode);
    const ncNodes = (settings.noConnectMarkers ?? []).map(noConnectToNode);
    return [...instanceNodes, ...powerNodes, ...labelNodes, ...ncNodes] as Node[];
  }, [instances, partsMap, settings.powerSymbols, settings.netLabels, settings.noConnectMarkers]);

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
    const edges = (nets ?? []).flatMap((net) => netToEdges(net, connectorsByInstance));
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
  }, [nets, selectedNetName, connectorsByInstance]);

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
        updateDesign.mutate({ projectId, id: circuitId, settings: { ...settings, powerSymbols: updated } });
      } else if (node.id.startsWith('netlabel-')) {
        const labelId = (node.data as NetLabelNodeData)?.labelId;
        if (!labelId) return;
        const updated = (settings.netLabels ?? []).map((nl) =>
          nl.id === labelId ? { ...nl, x, y } : nl,
        );
        updateDesign.mutate({ projectId, id: circuitId, settings: { ...settings, netLabels: updated } });
      } else if (node.id.startsWith('noconnect-')) {
        const markerId = (node.data as NoConnectNodeData)?.markerId;
        if (!markerId) return;
        const updated = (settings.noConnectMarkers ?? []).map((nc) =>
          nc.id === markerId ? { ...nc, x, y } : nc,
        );
        updateDesign.mutate({ projectId, id: circuitId, settings: { ...settings, noConnectMarkers: updated } });
      } else {
        const instanceId = (node.data as InstanceNodeData)?.instanceId;
        if (typeof instanceId !== 'number') return;
        updateInstance.mutate({ circuitId, id: instanceId, schematicX: x, schematicY: y });
      }
    },
    [circuitId, projectId, updateInstance, updateDesign, settings],
  );

  // Delete selected nodes — routes to correct storage per node type
  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      const deletedPowerIds: string[] = [];
      const deletedLabelIds: string[] = [];
      const deletedNcIds: string[] = [];

      for (const node of deleted) {
        if (node.id.startsWith('power-')) {
          const symbolId = (node.data as PowerNodeData)?.symbolId;
          if (symbolId) deletedPowerIds.push(symbolId);
        } else if (node.id.startsWith('netlabel-')) {
          const labelId = (node.data as NetLabelNodeData)?.labelId;
          if (labelId) deletedLabelIds.push(labelId);
        } else if (node.id.startsWith('noconnect-')) {
          const markerId = (node.data as NoConnectNodeData)?.markerId;
          if (markerId) deletedNcIds.push(markerId);
        } else {
          const instanceId = (node.data as InstanceNodeData)?.instanceId;
          if (typeof instanceId === 'number') {
            deleteInstance.mutate({ circuitId, id: instanceId });
          }
        }
      }

      // Batch-update settings if any annotation nodes were deleted
      const needsUpdate =
        deletedPowerIds.length > 0 || deletedLabelIds.length > 0 || deletedNcIds.length > 0;

      if (needsUpdate) {
        const powerSet = new Set(deletedPowerIds);
        const labelSet = new Set(deletedLabelIds);
        const ncSet = new Set(deletedNcIds);
        updateDesign.mutate({
          projectId,
          id: circuitId,
          settings: {
            ...settings,
            powerSymbols: (settings.powerSymbols ?? []).filter((ps) => !powerSet.has(ps.id)),
            netLabels: (settings.netLabels ?? []).filter((nl) => !labelSet.has(nl.id)),
            noConnectMarkers: (settings.noConnectMarkers ?? []).filter((nc) => !ncSet.has(nc.id)),
          },
        });
      }
    },
    [circuitId, projectId, deleteInstance, updateDesign, settings],
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
          deleteNet.mutate({ circuitId, id: netId });
        } else {
          updateNet.mutate({ circuitId, id: netId, segments: remaining });
        }
      });
    },
    [circuitId, nets, deleteNet, updateNet],
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

      createNet.mutate({
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
    [circuitId, createNet, localNodes],
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

  const handleOpenShortcuts = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
  }, []);

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

        createInstance.mutate({
          circuitId,
          partId: dragData.partId,
          referenceDesignator: refDes,
          schematicX: position.x,
          schematicY: position.y,
        });
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
        updateDesign.mutate({
          projectId,
          id: circuitId,
          settings: { ...settings, powerSymbols: [...currentSymbols, newSymbol] },
        });
      }
    },
    [circuitId, projectId, createInstance, updateDesign, instances, partsMap, settings, reactFlowInstance, snapEnabled, gridSize],
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

      createNet.mutate({
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
    [circuitId, createNet, localNodes],
  );

  // Keyboard shortcuts (only for implemented tools)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      )
        return;

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
  }, [handleFitView]);

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
    updateDesign.mutate({
      projectId,
      id: circuitId,
      settings: { ...settings, powerSymbols: [...currentSymbols, newSymbol] },
    });
  }, [reactFlowInstance, snapEnabled, gridSize, settings, updateDesign, projectId, circuitId]);

  const handleCtxSelectAll = useCallback(() => {
    setLocalNodes((nds) => nds.map((n) => ({ ...n, selected: true })));
  }, [setLocalNodes]);

  const handleCtxRunErc = useCallback(() => {
    window.dispatchEvent(new CustomEvent('protopulse:run-erc'));
  }, []);

  return (
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
      <SchematicToolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        snapEnabled={snapEnabled}
        onToggleSnap={() => setSnapEnabled((s) => !s)}
        gridVisible={gridVisible}
        onToggleGridVisible={() => setGridVisible((v) => !v)}
        angleConstraint={angleConstraint}
        onAngleConstraintChange={setAngleConstraint}
        onFitView={handleFitView}
        onOpenShortcuts={handleOpenShortcuts}
      />

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
        onEdgeClick={(_event, edge) => {
          const netName = (edge.data as Record<string, unknown> | undefined)?.netName;
          if (typeof netName === 'string') {
            setSelectedNetName((prev) => (prev === netName ? null : netName));
          }
        }}
        onPaneClick={() => setSelectedNetName(null)}
        isValidConnection={isValidConnection}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        className="bg-transparent"
        colorMode="dark"
        snapToGrid={snapEnabled}
        snapGrid={[gridSize, gridSize]}
        panOnDrag={activeTool === 'pan'}
        selectionOnDrag={activeTool !== 'pan'}
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
        <ContextMenuSeparator />
        <ContextMenuItem data-testid="ctx-paste" onSelect={() => { /* paste handled by keyboard */ }}>
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
