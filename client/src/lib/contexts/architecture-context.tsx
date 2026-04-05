import { createContext, useContext, useState, useRef, useCallback, useMemo } from 'react';
import { Node, Edge } from '@xyflow/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import type { ViewMode } from '@/lib/project-context';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { projectMutationKeys, projectQueryKeys } from '@/lib/query-keys';

/** API response shape for architecture nodes from the server. */
interface NodeApiResponse {
  nodeId: string;
  positionX: number;
  positionY: number;
  label: string;
  nodeType: string;
  data?: { description?: string } | null;
}

/** API response shape for architecture edges from the server. */
interface EdgeApiResponse {
  edgeId: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
  style?: Record<string, string | number>;
  signalType?: string;
  voltage?: string;
  busWidth?: number;
  netName?: string;
}

/** Custom data stored on edges for electrical signal metadata. */
interface EdgeData {
  signalType?: string;
  voltage?: string;
  busWidth?: number;
  netName?: string;
}

interface ArchitectureState {
  nodes: Node[];
  edges: Edge[];
  hasResolvedInitialGraph: boolean;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;

  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  focusNodeId: string | null;
  focusNode: (nodeId: string) => void;

  undoStack: Array<{ nodes: Node[]; edges: Edge[] }>;
  redoStack: Array<{ nodes: Node[]; edges: Edge[] }>;
  pushUndoState: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  lastAITurnSnapshot: { nodes: Node[]; edges: Edge[] } | null;
  captureSnapshot: () => void;
  getChangeDiff: () => string;

  pendingComponentPartId: number | null;
  setPendingComponentPartId: (id: number | null) => void;
}

/** Maximum number of entries in the undo/redo stacks. Oldest entries are trimmed when exceeded. */
const MAX_UNDO_STACK_DEPTH = 50;

const ArchitectureContext = createContext<ArchitectureState | undefined>(undefined);

export function ArchitectureProvider({
  seeded,
  setActiveView,
  children,
}: {
  seeded: boolean;
  setActiveView: (view: ViewMode) => void;
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const projectId = useProjectId();
  const nodesQueryKey = projectQueryKeys.nodes(projectId);
  const edgesQueryKey = projectQueryKeys.edges(projectId);

  // --- Queries ---
  const nodesQuery = useQuery({
    queryKey: nodesQueryKey,
    enabled: seeded,
    select: (response: { data: NodeApiResponse[]; total: number }) => response.data.map((n): Node => ({
      id: n.nodeId,
      type: 'custom',
      position: { x: n.positionX, y: n.positionY },
      data: { label: n.label, type: n.nodeType, description: n.data?.description },
    })),
  });

  const edgesQuery = useQuery({
    queryKey: edgesQueryKey,
    enabled: seeded,
    select: (response: { data: EdgeApiResponse[]; total: number }) => response.data.map((e): Edge => ({
      id: e.edgeId,
      source: e.source,
      target: e.target,
      label: e.label,
      animated: e.animated,
      style: e.style,
      data: {
        signalType: e.signalType || undefined,
        voltage: e.voltage || undefined,
        busWidth: e.busWidth || undefined,
        netName: e.netName || undefined,
      },
    })),
  });

  // --- Mutations ---
  const saveNodesMutation = useMutation({
    mutationKey: projectMutationKeys.nodes(projectId),
    mutationFn: async (nodes: Node[]) => {
      const body = nodes.map(node => ({
        nodeId: node.id,
        nodeType: node.data.type,
        label: node.data.label,
        positionX: node.position.x,
        positionY: node.position.y,
        data: { description: node.data.description },
      }));
      await apiRequest('PUT', `/api/projects/${projectId}/nodes`, body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: nodesQueryKey });
    },
    onError: (error: Error) => {
      void queryClient.invalidateQueries({ queryKey: nodesQueryKey });
      const reason = error.message.replace(/^\d{3}:\s*/, '') || 'An unexpected error occurred';
      toast({ variant: 'destructive', title: 'Failed to save nodes', description: `Changes may not have been saved. ${reason}` });
    },
  });

  const saveEdgesMutation = useMutation({
    mutationKey: projectMutationKeys.edges(projectId),
    mutationFn: async (edges: Edge[]) => {
      const body = edges.map(edge => {
        const edgeData = edge.data as EdgeData | undefined;
        return {
          edgeId: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.label,
          animated: edge.animated ?? false,
          style: edge.style,
          signalType: edgeData?.signalType || undefined,
          voltage: edgeData?.voltage || undefined,
          busWidth: edgeData?.busWidth || undefined,
          netName: edgeData?.netName || undefined,
        };
      });
      await apiRequest('PUT', `/api/projects/${projectId}/edges`, body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: edgesQueryKey });
    },
    onError: (error: Error) => {
      void queryClient.invalidateQueries({ queryKey: edgesQueryKey });
      const reason = error.message.replace(/^\d{3}:\s*/, '') || 'An unexpected error occurred';
      toast({ variant: 'destructive', title: 'Failed to save connections', description: `Changes may not have been saved. ${reason}` });
    },
  });

  const setNodes = useCallback((newNodes: Node[]) => {
    // Optimistic cache update so consumers see new data immediately,
    // then persist to server.  On success the invalidation refetches
    // the authoritative data; on error the query reverts.
    const mapped = newNodes.map(node => ({
      nodeId: node.id,
      nodeType: node.data.type,
      label: node.data.label,
      positionX: node.position.x,
      positionY: node.position.y,
      data: { description: node.data.description },
    }));
    queryClient.setQueryData(
      nodesQueryKey,
      { data: mapped, total: mapped.length },
    );
    saveNodesMutation.mutate(newNodes);
  }, [nodesQueryKey, queryClient, saveNodesMutation]);

  const setEdges = useCallback((newEdges: Edge[]) => {
    const mapped = newEdges.map(edge => {
      const ed = edge.data as EdgeData | undefined;
      return {
        edgeId: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        animated: edge.animated ?? false,
        style: edge.style,
        signalType: ed?.signalType || undefined,
        voltage: ed?.voltage || undefined,
        busWidth: ed?.busWidth || undefined,
        netName: ed?.netName || undefined,
      };
    });
    queryClient.setQueryData(
      edgesQueryKey,
      { data: mapped, total: mapped.length },
    );
    saveEdgesMutation.mutate(newEdges);
  }, [edgesQueryKey, queryClient, saveEdgesMutation]);

  // --- Selection & focus ---
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);

  const focusNode = useCallback((nodeId: string) => {
    setFocusNodeId(nodeId);
    setSelectedNodeId(nodeId);
    setActiveView('architecture');
    setTimeout(() => setFocusNodeId(null), 500);
  }, [setActiveView]);

  // --- Undo/Redo ---
  const [undoStack, setUndoStack] = useState<Array<{ nodes: Node[]; edges: Edge[] }>>([]);
  const [redoStack, setRedoStack] = useState<Array<{ nodes: Node[]; edges: Edge[] }>>([]);

  const pushUndoState = useCallback(() => {
    const currentNodes = nodesQuery.data ?? [];
    const currentEdges = edgesQuery.data ?? [];
    setUndoStack(prev => [...prev.slice(-(MAX_UNDO_STACK_DEPTH - 1)), { nodes: currentNodes, edges: currentEdges }]);
    setRedoStack([]);
  }, [nodesQuery.data, edgesQuery.data]);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const currentNodes = nodesQuery.data ?? [];
    const currentEdges = edgesQuery.data ?? [];
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(s => s.slice(0, -1));
    setRedoStack(s => [...s.slice(-(MAX_UNDO_STACK_DEPTH - 1)), { nodes: currentNodes, edges: currentEdges }]);
    setNodes(prev.nodes);
    setEdges(prev.edges);
  }, [undoStack, nodesQuery.data, edgesQuery.data, setNodes, setEdges]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const currentNodes = nodesQuery.data ?? [];
    const currentEdges = edgesQuery.data ?? [];
    const next = redoStack[redoStack.length - 1];
    setRedoStack(s => s.slice(0, -1));
    setUndoStack(s => [...s.slice(-(MAX_UNDO_STACK_DEPTH - 1)), { nodes: currentNodes, edges: currentEdges }]);
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [redoStack, nodesQuery.data, edgesQuery.data, setNodes, setEdges]);

  // --- Snapshot & diff ---
  const snapshotRef = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null);

  const captureSnapshot = useCallback(() => {
    snapshotRef.current = { nodes: nodesQuery.data ?? [], edges: edgesQuery.data ?? [] };
  }, [nodesQuery.data, edgesQuery.data]);

  const getChangeDiff = useCallback((): string => {
    const snap = snapshotRef.current;
    if (!snap) return "";
    const currentNodes = nodesQuery.data ?? [];
    const currentEdges = edgesQuery.data ?? [];
    const diffs: string[] = [];

    const snapNodeIds = new Set(snap.nodes.map(n => n.id));
    const curNodeIds = new Set(currentNodes.map(n => n.id));
    for (const n of currentNodes) {
      if (!snapNodeIds.has(n.id)) {
        diffs.push(`Added node '${n.data?.label || n.id}'`);
      }
    }
    for (const n of snap.nodes) {
      if (!curNodeIds.has(n.id)) {
        diffs.push(`Removed node '${n.data?.label || n.id}'`);
      }
    }
    for (const n of currentNodes) {
      const old = snap.nodes.find(s => s.id === n.id);
      if (old) {
        if (old.position.x !== n.position.x || old.position.y !== n.position.y) {
          diffs.push(`Moved '${n.data?.label || n.id}' from (${Math.round(old.position.x)},${Math.round(old.position.y)}) to (${Math.round(n.position.x)},${Math.round(n.position.y)})`);
        }
        if (old.data?.label !== n.data?.label) {
          diffs.push(`Renamed '${old.data?.label}' to '${n.data?.label}'`);
        }
      }
    }

    const snapEdgeIds = new Set(snap.edges.map(e => e.id));
    const curEdgeIds = new Set(currentEdges.map(e => e.id));
    for (const e of currentEdges) {
      if (!snapEdgeIds.has(e.id)) {
        const src = currentNodes.find(n => n.id === e.source);
        const tgt = currentNodes.find(n => n.id === e.target);
        diffs.push(`Added edge '${e.label || 'connection'}' between ${src?.data?.label || e.source} and ${tgt?.data?.label || e.target}`);
      }
    }
    for (const e of snap.edges) {
      if (!curEdgeIds.has(e.id)) {
        const src = snap.nodes.find(n => n.id === e.source);
        const tgt = snap.nodes.find(n => n.id === e.target);
        diffs.push(`Removed edge '${e.label || 'connection'}' between ${src?.data?.label || e.source} and ${tgt?.data?.label || e.target}`);
      }
    }

    if (diffs.length === 0) return "";
    return "Since your last message: " + diffs.join(", ");
  }, [nodesQuery.data, edgesQuery.data]);

  // --- Component part ID ---
  const [pendingComponentPartId, setPendingComponentPartId] = useState<number | null>(null);

  const nodes = nodesQuery.data ?? [];
  const edges = edgesQuery.data ?? [];
  const hasResolvedInitialGraph = nodesQuery.isFetched || nodesQuery.isError;
  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  const contextValue = useMemo<ArchitectureState>(() => ({
    nodes,
    edges,
    hasResolvedInitialGraph,
    setNodes,
    setEdges,
    selectedNodeId,
    setSelectedNodeId,
    focusNodeId,
    focusNode,
    undoStack,
    redoStack,
    pushUndoState,
    undo,
    redo,
    canUndo,
    canRedo,
    lastAITurnSnapshot: snapshotRef.current,
    captureSnapshot,
    getChangeDiff,
    pendingComponentPartId,
    setPendingComponentPartId,
  }), [
    nodes,
    edges,
    hasResolvedInitialGraph,
    setNodes,
    setEdges,
    selectedNodeId,
    setSelectedNodeId,
    focusNodeId,
    focusNode,
    undoStack,
    redoStack,
    pushUndoState,
    undo,
    redo,
    canUndo,
    canRedo,
    captureSnapshot,
    getChangeDiff,
    pendingComponentPartId,
    setPendingComponentPartId,
  ]);

  return (
    <ArchitectureContext.Provider value={contextValue}>
      {children}
    </ArchitectureContext.Provider>
  );
}

export function useArchitecture() {
  const context = useContext(ArchitectureContext);
  if (!context) throw new Error('useArchitecture must be used within ArchitectureProvider');
  return context;
}
