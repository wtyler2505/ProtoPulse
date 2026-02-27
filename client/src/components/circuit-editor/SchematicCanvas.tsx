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
import type { SchematicTool, CircuitSettings, PowerSymbol, SchematicNetLabel, NoConnectMarker, ERCViolation } from '@shared/circuit-types';
import { DEFAULT_CIRCUIT_SETTINGS } from '@shared/circuit-types';
import type { CircuitInstanceRow, CircuitNetRow, ComponentPart } from '@shared/schema';
import type { Connector, Shape, PartMeta, PartViews } from '@shared/component-types';
import { COMPONENT_DRAG_TYPE, type ComponentDragData } from './ComponentPlacer';
import { POWER_SYMBOL_DRAG_TYPE, type PowerSymbolDragData } from './PowerSymbolPalette';
import { CircuitBoard } from 'lucide-react';
import ERCOverlay from './ERCOverlay';

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

function netToEdges(net: CircuitNetRow): Edge[] {
  const segments = (net.segments ?? []) as NetSegmentJSON[];
  const style = (net.style ?? {}) as { color?: string };

  return segments.map((seg) => ({
    // Stable ID derived from segment endpoints — survives reordering
    id: `net-${net.id}-${seg.fromInstanceId}:${seg.fromPin}-${seg.toInstanceId}:${seg.toPin}`,
    type: 'schematic-net',
    source: `instance-${seg.fromInstanceId}`,
    sourceHandle: `pin-${seg.fromPin}`,
    target: `instance-${seg.toInstanceId}`,
    targetHandle: `pin-${seg.toPin}`,
    data: {
      netName: net.name,
      netType: net.netType,
      color: style.color,
      busWidth: net.busWidth ?? undefined,
    },
  }));
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
      instanceToNode(inst, partsMap.get(inst.partId)),
    );
    const powerNodes = (settings.powerSymbols ?? []).map(powerSymbolToNode);
    const labelNodes = (settings.netLabels ?? []).map(netLabelToNode);
    const ncNodes = (settings.noConnectMarkers ?? []).map(noConnectToNode);
    return [...instanceNodes, ...powerNodes, ...labelNodes, ...ncNodes] as Node[];
  }, [instances, partsMap, settings.powerSymbols, settings.netLabels, settings.noConnectMarkers]);

  // Convert DB data → React Flow edges
  const rfEdges = useMemo(() => (nets ?? []).flatMap(netToEdges), [nets]);

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

      // Resolve human-readable pin names for the net name
      const sourceNode = localNodes.find((n) => n.id === connection.source);
      const targetNode = localNodes.find((n) => n.id === connection.target);
      const sourcePinName =
        (sourceNode?.data as InstanceNodeData)?.connectors.find(
          (c) => c.id === sourcePinId,
        )?.name ?? sourcePinId;
      const targetPinName =
        (targetNode?.data as InstanceNodeData)?.connectors.find(
          (c) => c.id === targetPinId,
        )?.name ?? targetPinId;

      createNet.mutate({
        circuitId,
        name: `Net_${sourcePinName}_${targetPinName}`,
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

  // Toolbar actions
  const handleFitView = useCallback(() => {
    reactFlowInstance.fitView({ padding: 0.2 });
  }, [reactFlowInstance]);

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
      // Resolve human-readable pin names
      const sourceNode = localNodes.find((n) => n.id === `instance-${result.sourceInstanceId}`);
      const targetNode = localNodes.find((n) => n.id === `instance-${result.targetInstanceId}`);
      const sourcePinName =
        (sourceNode?.data as InstanceNodeData)?.connectors.find(
          (c) => c.id === result.sourcePin,
        )?.name ?? result.sourcePin;
      const targetPinName =
        (targetNode?.data as InstanceNodeData)?.connectors.find(
          (c) => c.id === result.targetPin,
        )?.name ?? result.targetPin;

      createNet.mutate({
        circuitId,
        name: `Net_${sourcePinName}_${targetPinName}`,
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

  return (
    <div
      className="w-full h-full relative"
      data-testid="schematic-canvas"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <SchematicToolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        snapEnabled={snapEnabled}
        onToggleSnap={() => setSnapEnabled((s) => !s)}
        onFitView={handleFitView}
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
        isValidConnection={isValidConnection}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        className="bg-transparent"
        colorMode="dark"
        snapToGrid={snapEnabled}
        snapGrid={[gridSize, gridSize]}
        panOnDrag={activeTool === 'pan'}
        connectionMode={ConnectionMode.Loose}
        deleteKeyCode={['Backspace', 'Delete']}
      >
        <Background color="#333" gap={gridSize} size={1} />
        <Controls className="!bg-card !border-border !fill-foreground" />
        <MiniMap
          className="!bg-card !border-border overflow-hidden"
          nodeColor={() => '#06b6d4'}
          maskColor="rgba(0, 0, 0, 0.6)"
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
          <div className="text-center space-y-3 max-w-sm">
            <CircuitBoard className="w-16 h-16 text-muted-foreground/30 mx-auto" />
            <h3 className="text-lg font-medium text-foreground">
              Empty Schematic
            </h3>
            <p className="text-sm text-muted-foreground">
              Place components from the sidebar or drag between pins to create
              net connections.
            </p>
          </div>
        </div>
      )}
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
