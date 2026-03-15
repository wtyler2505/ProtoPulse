/**
 * Atomic undo wrapper for design snippet placement.
 *
 * When a snippet is placed on the Architecture canvas, multiple nodes and edges
 * are added at once. Without batching, each addition would push a separate undo
 * entry, requiring N Ctrl+Z presses to undo a single snippet. This module
 * ensures the entire placement is captured as a single undo snapshot so that one
 * Ctrl+Z reverses the whole operation.
 *
 * Works with the snapshot-based undo system in architecture-context.tsx:
 *   1. Push one undo snapshot (capturing the "before" state).
 *   2. Apply all nodes + edges from the snippet in one batch.
 *   3. Result: a single undo entry that restores the pre-snippet state.
 */

import type { Node, Edge } from '@xyflow/react';
import type { PlacementResult, SnippetNode, SnippetEdge } from '@/lib/design-reuse';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Record of what was placed — useful for logging, selection, or targeted removal. */
export interface SnippetPlacementAction {
  /** ID of the snippet that was placed. */
  snippetId: string;
  /** Human-readable name of the snippet. */
  snippetName: string;
  /** IDs of the nodes that were added. */
  addedNodeIds: string[];
  /** IDs of the edges that were added. */
  addedEdgeIds: string[];
}

/** Callbacks needed from the architecture canvas to mutate state. */
export interface SnippetPlacementCallbacks {
  /** Push one undo snapshot before any mutations. */
  pushUndoState: () => void;
  /** Batch-update the node list. */
  setNodes: (updater: (nodes: Node[]) => Node[]) => void;
  /** Batch-update the edge list. */
  setEdges: (updater: (edges: Edge[]) => Edge[]) => void;
  /** Mark that nodes were locally modified (for sync). */
  markNodeInteracted: () => void;
  /** Mark that edges were locally modified (for sync). */
  markEdgeInteracted: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a SnippetNode to a ReactFlow Node. */
function snippetNodeToFlowNode(sn: SnippetNode): Node {
  return {
    id: sn.id,
    type: 'custom',
    position: { x: sn.position.x, y: sn.position.y },
    data: {
      label: sn.label,
      type: sn.type,
      ...sn.properties,
    },
  };
}

/** Convert a SnippetEdge to a ReactFlow Edge. */
function snippetEdgeToFlowEdge(se: SnippetEdge): Edge {
  return {
    id: se.id,
    source: se.source,
    target: se.target,
    label: se.label,
  };
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Place a snippet onto the architecture canvas as a single atomic undo unit.
 *
 * 1. Pushes exactly one undo snapshot (the "before" state).
 * 2. Converts snippet nodes/edges to ReactFlow format and appends them.
 * 3. Returns a `SnippetPlacementAction` describing what was added.
 *
 * Returns `null` if `placement` is null (snippet not found).
 */
export function placeSnippetAtomic(
  snippetId: string,
  snippetName: string,
  placement: PlacementResult | null,
  callbacks: SnippetPlacementCallbacks,
): SnippetPlacementAction | null {
  if (!placement) {
    return null;
  }

  const { nodes: snippetNodes, edges: snippetEdges } = placement;

  // Convert to ReactFlow types
  const flowNodes = snippetNodes.map(snippetNodeToFlowNode);
  const flowEdges = snippetEdges.map(snippetEdgeToFlowEdge);

  // 1. Push ONE undo snapshot — captures the entire pre-placement state
  callbacks.pushUndoState();

  // 2. Apply all nodes and edges in a single batch
  callbacks.setNodes((existing) => [...existing, ...flowNodes]);
  if (flowEdges.length > 0) {
    callbacks.setEdges((existing) => [...existing, ...flowEdges]);
    callbacks.markEdgeInteracted();
  }
  callbacks.markNodeInteracted();

  // 3. Return the placement action for logging / further use
  return {
    snippetId,
    snippetName,
    addedNodeIds: flowNodes.map((n) => n.id),
    addedEdgeIds: flowEdges.map((e) => e.id),
  };
}

/**
 * Remove all nodes and edges that were added by a snippet placement.
 *
 * Useful for programmatic removal (e.g., from a "remove snippet" action)
 * without going through undo. Pushes one undo snapshot before removing.
 */
export function removeSnippetPlacement(
  action: SnippetPlacementAction,
  callbacks: SnippetPlacementCallbacks,
): void {
  const nodeIdSet = new Set(action.addedNodeIds);
  const edgeIdSet = new Set(action.addedEdgeIds);

  callbacks.pushUndoState();

  callbacks.setNodes((existing) => existing.filter((n) => !nodeIdSet.has(n.id)));
  callbacks.markNodeInteracted();

  if (edgeIdSet.size > 0) {
    callbacks.setEdges((existing) => existing.filter((e) => !edgeIdSet.has(e.id)));
    callbacks.markEdgeInteracted();
  }
}

/**
 * Convert a PlacementResult to ReactFlow-compatible arrays without applying them.
 * Useful when you need to inspect what would be placed before committing.
 */
export function previewSnippetPlacement(placement: PlacementResult): {
  nodes: Node[];
  edges: Edge[];
} {
  return {
    nodes: placement.nodes.map(snippetNodeToFlowNode),
    edges: placement.edges.map(snippetEdgeToFlowEdge),
  };
}
