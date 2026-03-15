import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Node, Edge } from '@xyflow/react';
import type { PlacementResult } from '@/lib/design-reuse';
import type { SnippetPlacementCallbacks, SnippetPlacementAction } from '@/lib/snippet-undo';
import {
  placeSnippetAtomic,
  removeSnippetPlacement,
  previewSnippetPlacement,
} from '@/lib/snippet-undo';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockCallbacks extends SnippetPlacementCallbacks {
  nodeState: Node[];
  edgeState: Edge[];
}

function makeCallbacks(): MockCallbacks {
  const obj: MockCallbacks = {
    nodeState: [],
    edgeState: [],
    pushUndoState: vi.fn(),
    setNodes: vi.fn(),
    setEdges: vi.fn(),
    markNodeInteracted: vi.fn(),
    markEdgeInteracted: vi.fn(),
  };

  // Wire up setNodes/setEdges to actually mutate the state arrays so tests
  // can assert on `callbacks.nodeState` / `callbacks.edgeState`.
  (obj.setNodes as ReturnType<typeof vi.fn>).mockImplementation(
    (updater: (nodes: Node[]) => Node[]) => {
      obj.nodeState = updater(obj.nodeState);
    },
  );
  (obj.setEdges as ReturnType<typeof vi.fn>).mockImplementation(
    (updater: (edges: Edge[]) => Edge[]) => {
      obj.edgeState = updater(obj.edgeState);
    },
  );

  return obj;
}

function makePlacement(opts?: {
  nodeCount?: number;
  edgeCount?: number;
}): PlacementResult {
  const nodeCount = opts?.nodeCount ?? 2;
  const edgeCount = opts?.edgeCount ?? 1;

  const nodeIdMap = new Map<string, string>();
  const nodes = Array.from({ length: nodeCount }, (_, i) => {
    const oldId = `old-${i}`;
    const newId = `new-${i}`;
    nodeIdMap.set(oldId, newId);
    return {
      id: newId,
      type: 'resistor',
      label: `R${i + 1}`,
      properties: { value: '10k' },
      position: { x: i * 100, y: i * 50 },
    };
  });

  const edges = Array.from({ length: Math.min(edgeCount, nodeCount - 1) }, (_, i) => ({
    id: `edge-${i}`,
    source: `new-${i}`,
    target: `new-${i + 1}`,
    label: `conn-${i}`,
  }));

  const wires = [{ id: 'w-1', startPin: 'new-0:1', endPin: 'new-1:2', netName: 'Vout' }];

  return { nodeIdMap, nodes, edges, wires };
}

// ---------------------------------------------------------------------------
// placeSnippetAtomic
// ---------------------------------------------------------------------------

describe('placeSnippetAtomic', () => {
  let callbacks: ReturnType<typeof makeCallbacks>;

  beforeEach(() => {
    callbacks = makeCallbacks();
  });

  it('returns null when placement is null', () => {
    const result = placeSnippetAtomic('s1', 'Test Snippet', null, callbacks);
    expect(result).toBeNull();
  });

  it('does not call any callbacks when placement is null', () => {
    placeSnippetAtomic('s1', 'Test', null, callbacks);
    expect(callbacks.pushUndoState).not.toHaveBeenCalled();
    expect(callbacks.setNodes).not.toHaveBeenCalled();
    expect(callbacks.setEdges).not.toHaveBeenCalled();
    expect(callbacks.markNodeInteracted).not.toHaveBeenCalled();
    expect(callbacks.markEdgeInteracted).not.toHaveBeenCalled();
  });

  it('pushes exactly one undo state', () => {
    const placement = makePlacement({ nodeCount: 4, edgeCount: 3 });
    placeSnippetAtomic('s1', 'Big Snippet', placement, callbacks);
    expect(callbacks.pushUndoState).toHaveBeenCalledTimes(1);
  });

  it('pushUndoState is called before setNodes', () => {
    const callOrder: string[] = [];
    const cb = makeCallbacks();
    (cb.pushUndoState as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callOrder.push('pushUndoState');
    });
    (cb.setNodes as ReturnType<typeof vi.fn>).mockImplementation((updater: (n: Node[]) => Node[]) => {
      callOrder.push('setNodes');
      cb.nodeState = updater(cb.nodeState);
    });
    placeSnippetAtomic('s1', 'Test', makePlacement(), cb);
    expect(callOrder.indexOf('pushUndoState')).toBeLessThan(callOrder.indexOf('setNodes'));
  });

  it('adds all nodes from the snippet', () => {
    const placement = makePlacement({ nodeCount: 3, edgeCount: 0 });
    placeSnippetAtomic('s1', 'Three Nodes', placement, callbacks);
    expect(callbacks.nodeState).toHaveLength(3);
  });

  it('converts snippet nodes to ReactFlow format', () => {
    const placement = makePlacement({ nodeCount: 1, edgeCount: 0 });
    placeSnippetAtomic('s1', 'Single Node', placement, callbacks);
    const node = callbacks.nodeState[0];
    expect(node.id).toBe('new-0');
    expect(node.type).toBe('custom');
    expect(node.position).toEqual({ x: 0, y: 0 });
    expect((node.data as Record<string, unknown>).label).toBe('R1');
    expect((node.data as Record<string, unknown>).type).toBe('resistor');
    expect((node.data as Record<string, unknown>).value).toBe('10k');
  });

  it('adds all edges from the snippet', () => {
    const placement = makePlacement({ nodeCount: 3, edgeCount: 2 });
    placeSnippetAtomic('s1', 'With Edges', placement, callbacks);
    expect(callbacks.edgeState).toHaveLength(2);
  });

  it('converts snippet edges to ReactFlow format', () => {
    const placement = makePlacement({ nodeCount: 2, edgeCount: 1 });
    placeSnippetAtomic('s1', 'Edge Test', placement, callbacks);
    const edge = callbacks.edgeState[0];
    expect(edge.id).toBe('edge-0');
    expect(edge.source).toBe('new-0');
    expect(edge.target).toBe('new-1');
    expect(edge.label).toBe('conn-0');
  });

  it('marks node interaction', () => {
    placeSnippetAtomic('s1', 'Test', makePlacement(), callbacks);
    expect(callbacks.markNodeInteracted).toHaveBeenCalledTimes(1);
  });

  it('marks edge interaction when edges exist', () => {
    placeSnippetAtomic('s1', 'Test', makePlacement({ nodeCount: 2, edgeCount: 1 }), callbacks);
    expect(callbacks.markEdgeInteracted).toHaveBeenCalledTimes(1);
  });

  it('does not mark edge interaction when no edges', () => {
    placeSnippetAtomic('s1', 'No Edges', makePlacement({ nodeCount: 2, edgeCount: 0 }), callbacks);
    expect(callbacks.markEdgeInteracted).not.toHaveBeenCalled();
  });

  it('does not call setEdges when no edges', () => {
    placeSnippetAtomic('s1', 'No Edges', makePlacement({ nodeCount: 2, edgeCount: 0 }), callbacks);
    expect(callbacks.setEdges).not.toHaveBeenCalled();
  });

  it('returns action with correct snippetId and snippetName', () => {
    const result = placeSnippetAtomic('snip-42', 'Voltage Divider', makePlacement(), callbacks);
    expect(result).not.toBeNull();
    expect(result!.snippetId).toBe('snip-42');
    expect(result!.snippetName).toBe('Voltage Divider');
  });

  it('returns action with all added node IDs', () => {
    const placement = makePlacement({ nodeCount: 3, edgeCount: 0 });
    const result = placeSnippetAtomic('s1', 'Test', placement, callbacks);
    expect(result!.addedNodeIds).toEqual(['new-0', 'new-1', 'new-2']);
  });

  it('returns action with all added edge IDs', () => {
    const placement = makePlacement({ nodeCount: 3, edgeCount: 2 });
    const result = placeSnippetAtomic('s1', 'Test', placement, callbacks);
    expect(result!.addedEdgeIds).toEqual(['edge-0', 'edge-1']);
  });

  it('appends to existing nodes without removing them', () => {
    callbacks.nodeState = [
      { id: 'existing-1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'Existing' } },
    ];
    placeSnippetAtomic('s1', 'Test', makePlacement({ nodeCount: 2, edgeCount: 0 }), callbacks);
    expect(callbacks.nodeState).toHaveLength(3);
    expect(callbacks.nodeState[0].id).toBe('existing-1');
  });

  it('appends to existing edges without removing them', () => {
    callbacks.edgeState = [{ id: 'existing-edge', source: 'a', target: 'b' }];
    placeSnippetAtomic('s1', 'Test', makePlacement({ nodeCount: 2, edgeCount: 1 }), callbacks);
    expect(callbacks.edgeState).toHaveLength(2);
    expect(callbacks.edgeState[0].id).toBe('existing-edge');
  });

  it('handles snippet with many nodes (10+)', () => {
    const placement = makePlacement({ nodeCount: 12, edgeCount: 5 });
    const result = placeSnippetAtomic('s1', 'Large', placement, callbacks);
    expect(result!.addedNodeIds).toHaveLength(12);
    expect(callbacks.nodeState).toHaveLength(12);
    expect(callbacks.pushUndoState).toHaveBeenCalledTimes(1);
  });

  it('preserves node properties from snippet', () => {
    const placement = makePlacement({ nodeCount: 1, edgeCount: 0 });
    placement.nodes[0].properties = { value: '4.7k', tolerance: '5%' };
    placeSnippetAtomic('s1', 'Test', placement, callbacks);
    const data = callbacks.nodeState[0].data as Record<string, unknown>;
    expect(data.value).toBe('4.7k');
    expect(data.tolerance).toBe('5%');
  });

  it('preserves node positions from placement result', () => {
    const placement = makePlacement({ nodeCount: 2, edgeCount: 0 });
    placement.nodes[0].position = { x: 150, y: 200 };
    placement.nodes[1].position = { x: 300, y: 400 };
    placeSnippetAtomic('s1', 'Test', placement, callbacks);
    expect(callbacks.nodeState[0].position).toEqual({ x: 150, y: 200 });
    expect(callbacks.nodeState[1].position).toEqual({ x: 300, y: 400 });
  });
});

// ---------------------------------------------------------------------------
// removeSnippetPlacement
// ---------------------------------------------------------------------------

describe('removeSnippetPlacement', () => {
  let callbacks: ReturnType<typeof makeCallbacks>;

  beforeEach(() => {
    callbacks = makeCallbacks();
  });

  it('pushes exactly one undo state', () => {
    const action: SnippetPlacementAction = {
      snippetId: 's1',
      snippetName: 'Test',
      addedNodeIds: ['n1'],
      addedEdgeIds: [],
    };
    removeSnippetPlacement(action, callbacks);
    expect(callbacks.pushUndoState).toHaveBeenCalledTimes(1);
  });

  it('removes all nodes from the action', () => {
    callbacks.nodeState = [
      { id: 'n1', type: 'custom', position: { x: 0, y: 0 }, data: {} },
      { id: 'n2', type: 'custom', position: { x: 50, y: 50 }, data: {} },
      { id: 'keep', type: 'custom', position: { x: 100, y: 100 }, data: {} },
    ];
    const action: SnippetPlacementAction = {
      snippetId: 's1',
      snippetName: 'Test',
      addedNodeIds: ['n1', 'n2'],
      addedEdgeIds: [],
    };
    removeSnippetPlacement(action, callbacks);
    expect(callbacks.nodeState).toHaveLength(1);
    expect(callbacks.nodeState[0].id).toBe('keep');
  });

  it('removes all edges from the action', () => {
    callbacks.edgeState = [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'keep-edge', source: 'a', target: 'b' },
    ];
    const action: SnippetPlacementAction = {
      snippetId: 's1',
      snippetName: 'Test',
      addedNodeIds: [],
      addedEdgeIds: ['e1'],
    };
    removeSnippetPlacement(action, callbacks);
    expect(callbacks.edgeState).toHaveLength(1);
    expect(callbacks.edgeState[0].id).toBe('keep-edge');
  });

  it('does not call setEdges when no edges to remove', () => {
    const action: SnippetPlacementAction = {
      snippetId: 's1',
      snippetName: 'Test',
      addedNodeIds: ['n1'],
      addedEdgeIds: [],
    };
    removeSnippetPlacement(action, callbacks);
    expect(callbacks.setEdges).not.toHaveBeenCalled();
    expect(callbacks.markEdgeInteracted).not.toHaveBeenCalled();
  });

  it('marks node interaction', () => {
    const action: SnippetPlacementAction = {
      snippetId: 's1',
      snippetName: 'Test',
      addedNodeIds: ['n1'],
      addedEdgeIds: [],
    };
    removeSnippetPlacement(action, callbacks);
    expect(callbacks.markNodeInteracted).toHaveBeenCalledTimes(1);
  });

  it('marks edge interaction when edges are removed', () => {
    callbacks.edgeState = [{ id: 'e1', source: 'n1', target: 'n2' }];
    const action: SnippetPlacementAction = {
      snippetId: 's1',
      snippetName: 'Test',
      addedNodeIds: [],
      addedEdgeIds: ['e1'],
    };
    removeSnippetPlacement(action, callbacks);
    expect(callbacks.markEdgeInteracted).toHaveBeenCalledTimes(1);
  });

  it('handles action with no IDs gracefully', () => {
    callbacks.nodeState = [{ id: 'keep', type: 'custom', position: { x: 0, y: 0 }, data: {} }];
    const action: SnippetPlacementAction = {
      snippetId: 's1',
      snippetName: 'Test',
      addedNodeIds: [],
      addedEdgeIds: [],
    };
    removeSnippetPlacement(action, callbacks);
    expect(callbacks.nodeState).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// previewSnippetPlacement
// ---------------------------------------------------------------------------

describe('previewSnippetPlacement', () => {
  it('converts snippet nodes to ReactFlow nodes', () => {
    const placement = makePlacement({ nodeCount: 2, edgeCount: 0 });
    const preview = previewSnippetPlacement(placement);
    expect(preview.nodes).toHaveLength(2);
    expect(preview.nodes[0].type).toBe('custom');
    expect(preview.nodes[0].id).toBe('new-0');
  });

  it('converts snippet edges to ReactFlow edges', () => {
    const placement = makePlacement({ nodeCount: 2, edgeCount: 1 });
    const preview = previewSnippetPlacement(placement);
    expect(preview.edges).toHaveLength(1);
    expect(preview.edges[0].source).toBe('new-0');
    expect(preview.edges[0].target).toBe('new-1');
  });

  it('does not mutate the original placement', () => {
    const placement = makePlacement({ nodeCount: 2, edgeCount: 1 });
    const origNodes = [...placement.nodes];
    previewSnippetPlacement(placement);
    expect(placement.nodes).toEqual(origNodes);
  });

  it('includes node properties in data', () => {
    const placement = makePlacement({ nodeCount: 1, edgeCount: 0 });
    placement.nodes[0].properties = { value: '100nF', voltage: '50V' };
    const preview = previewSnippetPlacement(placement);
    const data = preview.nodes[0].data as Record<string, unknown>;
    expect(data.value).toBe('100nF');
    expect(data.voltage).toBe('50V');
  });

  it('handles empty placement', () => {
    const placement: PlacementResult = {
      nodeIdMap: new Map(),
      nodes: [],
      edges: [],
      wires: [],
    };
    const preview = previewSnippetPlacement(placement);
    expect(preview.nodes).toEqual([]);
    expect(preview.edges).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Integration: place then undo via remove
// ---------------------------------------------------------------------------

describe('place + remove roundtrip', () => {
  it('place then remove restores original state', () => {
    const callbacks = makeCallbacks();
    callbacks.nodeState = [
      { id: 'original', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'Original' } },
    ];
    callbacks.edgeState = [];

    const placement = makePlacement({ nodeCount: 2, edgeCount: 1 });
    const action = placeSnippetAtomic('s1', 'Test', placement, callbacks);
    expect(callbacks.nodeState).toHaveLength(3);
    expect(callbacks.edgeState).toHaveLength(1);

    removeSnippetPlacement(action!, callbacks);
    expect(callbacks.nodeState).toHaveLength(1);
    expect(callbacks.nodeState[0].id).toBe('original');
    expect(callbacks.edgeState).toHaveLength(0);
  });

  it('total pushUndoState calls = 2 (one place + one remove)', () => {
    const callbacks = makeCallbacks();
    const placement = makePlacement();
    const action = placeSnippetAtomic('s1', 'Test', placement, callbacks);
    removeSnippetPlacement(action!, callbacks);
    expect(callbacks.pushUndoState).toHaveBeenCalledTimes(2);
  });
});
