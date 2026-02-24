import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { Node, Edge } from '@xyflow/react';

interface UseSyncedFlowStateParams {
  nodes: Node[];
  edges: Edge[];
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  localNodes: Node[];
  localEdges: Edge[];
  setLocalNodes: Dispatch<SetStateAction<Node[]>>;
  setLocalEdges: Dispatch<SetStateAction<Edge[]>>;
}

interface UseSyncedFlowStateReturn {
  nodeInteracted: React.MutableRefObject<boolean>;
  edgeInteracted: React.MutableRefObject<boolean>;
}

/**
 * Keeps local ReactFlow state in sync with external context state.
 *
 * Two-way sync:
 * - Context→Local: When context nodes/edges change and the user hasn't
 *   interacted locally, push the new values into local state.
 * - Local→Context: When the user interacts (drag, connect, delete), debounce
 *   the local changes and flush them back to context after 1.5 s.
 *
 * Returns interaction refs so the consuming component can flag user-initiated
 * changes from event handlers (onNodeDragStop, onConnect, etc.).
 */
export function useSyncedFlowState({
  nodes,
  edges,
  setNodes,
  setEdges,
  localNodes,
  localEdges,
  setLocalNodes,
  setLocalEdges,
}: UseSyncedFlowStateParams): UseSyncedFlowStateReturn {
  const nodesMountSkip = useRef(true);
  const edgesMountSkip = useRef(true);
  const nodeSaveTimer = useRef<NodeJS.Timeout>(undefined);
  const edgeSaveTimer = useRef<NodeJS.Timeout>(undefined);
  const nodeInteracted = useRef(false);
  const edgeInteracted = useRef(false);
  const prevContextNodes = useRef(nodes);
  const prevContextEdges = useRef(edges);

  // Context → Local node sync
  useEffect(() => {
    if (prevContextNodes.current !== nodes) {
      if (!nodeInteracted.current) {
        setLocalNodes(nodes);
      }
      nodeInteracted.current = false;
    }
    prevContextNodes.current = nodes;
  }, [nodes, setLocalNodes]);

  // Context → Local edge sync
  useEffect(() => {
    if (prevContextEdges.current !== edges) {
      if (!edgeInteracted.current) {
        setLocalEdges(edges);
      }
      edgeInteracted.current = false;
    }
    prevContextEdges.current = edges;
  }, [edges, setLocalEdges]);

  // Local → Context node save (debounced, skip mount)
  useEffect(() => {
    if (nodesMountSkip.current) {
      nodesMountSkip.current = false;
      return;
    }
    if (!nodeInteracted.current) return;
    clearTimeout(nodeSaveTimer.current);
    nodeSaveTimer.current = setTimeout(() => {
      setNodes(localNodes);
    }, 1500);
    return () => clearTimeout(nodeSaveTimer.current);
  }, [localNodes, setNodes]);

  // Local → Context edge save (debounced, skip mount)
  useEffect(() => {
    if (edgesMountSkip.current) {
      edgesMountSkip.current = false;
      return;
    }
    if (!edgeInteracted.current) return;
    clearTimeout(edgeSaveTimer.current);
    edgeSaveTimer.current = setTimeout(() => {
      setEdges(localEdges);
    }, 1500);
    return () => clearTimeout(edgeSaveTimer.current);
  }, [localEdges, setEdges]);

  // Flush pending saves on beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (nodeSaveTimer.current) {
        clearTimeout(nodeSaveTimer.current);
        setNodes(localNodes);
      }
      if (edgeSaveTimer.current) {
        clearTimeout(edgeSaveTimer.current);
        setEdges(localEdges);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [localNodes, localEdges, setNodes, setEdges]);

  return { nodeInteracted, edgeInteracted };
}
