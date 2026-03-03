/**
 * Architecture diff/comparison engine (IN-07).
 *
 * Compares two architecture snapshots (baseline vs current) by matching nodes
 * on `nodeId` and edges on `edgeId`. Produces a structured diff showing added,
 * removed, and modified elements with field-level change detail and summary.
 */

import type { ArchitectureNode, ArchitectureEdge } from './schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single field-level change within a modified element. */
export interface ArchFieldChange {
  field: string;
  oldValue: string | number | null;
  newValue: string | number | null;
}

// --- Node diff entries ---

export interface ArchNodeDiffAdded {
  type: 'added';
  kind: 'node';
  nodeId: string;
  current: ArchitectureNode;
}

export interface ArchNodeDiffRemoved {
  type: 'removed';
  kind: 'node';
  nodeId: string;
  baseline: ArchitectureNode;
}

export interface ArchNodeDiffModified {
  type: 'modified';
  kind: 'node';
  nodeId: string;
  baseline: ArchitectureNode;
  current: ArchitectureNode;
  changes: ArchFieldChange[];
}

export type ArchNodeDiffEntry = ArchNodeDiffAdded | ArchNodeDiffRemoved | ArchNodeDiffModified;

// --- Edge diff entries ---

export interface ArchEdgeDiffAdded {
  type: 'added';
  kind: 'edge';
  edgeId: string;
  current: ArchitectureEdge;
}

export interface ArchEdgeDiffRemoved {
  type: 'removed';
  kind: 'edge';
  edgeId: string;
  baseline: ArchitectureEdge;
}

export interface ArchEdgeDiffModified {
  type: 'modified';
  kind: 'edge';
  edgeId: string;
  baseline: ArchitectureEdge;
  current: ArchitectureEdge;
  changes: ArchFieldChange[];
}

export type ArchEdgeDiffEntry = ArchEdgeDiffAdded | ArchEdgeDiffRemoved | ArchEdgeDiffModified;

// --- Combined result ---

export interface ArchDiffSummary {
  nodesAdded: number;
  nodesRemoved: number;
  nodesModified: number;
  edgesAdded: number;
  edgesRemoved: number;
  edgesModified: number;
  totalChanges: number;
}

export interface ArchDiffResult {
  nodes: ArchNodeDiffEntry[];
  edges: ArchEdgeDiffEntry[];
  summary: ArchDiffSummary;
}

// ---------------------------------------------------------------------------
// Tracked fields — these are the node/edge fields we compare for modifications.
// ---------------------------------------------------------------------------

type ComparableNodeKey = 'label' | 'nodeType' | 'positionX' | 'positionY';

interface TrackedNodeField {
  key: ComparableNodeKey;
  label: string;
}

const TRACKED_NODE_FIELDS: TrackedNodeField[] = [
  { key: 'label', label: 'Label' },
  { key: 'nodeType', label: 'Type' },
  { key: 'positionX', label: 'Position X' },
  { key: 'positionY', label: 'Position Y' },
];

type ComparableEdgeKey = 'source' | 'target' | 'label' | 'signalType' | 'voltage' | 'busWidth' | 'netName';

interface TrackedEdgeField {
  key: ComparableEdgeKey;
  label: string;
}

const TRACKED_EDGE_FIELDS: TrackedEdgeField[] = [
  { key: 'source', label: 'Source' },
  { key: 'target', label: 'Target' },
  { key: 'label', label: 'Label' },
  { key: 'signalType', label: 'Signal Type' },
  { key: 'voltage', label: 'Voltage' },
  { key: 'busWidth', label: 'Bus Width' },
  { key: 'netName', label: 'Net Name' },
];

// ---------------------------------------------------------------------------
// Core diff function
// ---------------------------------------------------------------------------

/**
 * Compute a structured diff between a baseline architecture and the current state.
 * Nodes are matched by `nodeId`, edges by `edgeId` (both case-sensitive).
 */
export function computeArchDiff(
  baselineNodes: ArchitectureNode[],
  baselineEdges: ArchitectureEdge[],
  currentNodes: ArchitectureNode[],
  currentEdges: ArchitectureEdge[],
): ArchDiffResult {
  const nodeDiffs = diffElements<ArchitectureNode, ArchNodeDiffEntry, ComparableNodeKey>(
    baselineNodes,
    currentNodes,
    (n) => n.nodeId,
    'node',
    TRACKED_NODE_FIELDS,
  );

  const edgeDiffs = diffElements<ArchitectureEdge, ArchEdgeDiffEntry, ComparableEdgeKey>(
    baselineEdges,
    currentEdges,
    (e) => e.edgeId,
    'edge',
    TRACKED_EDGE_FIELDS,
  );

  const nodesAdded = nodeDiffs.filter((e) => e.type === 'added').length;
  const nodesRemoved = nodeDiffs.filter((e) => e.type === 'removed').length;
  const nodesModified = nodeDiffs.filter((e) => e.type === 'modified').length;
  const edgesAdded = edgeDiffs.filter((e) => e.type === 'added').length;
  const edgesRemoved = edgeDiffs.filter((e) => e.type === 'removed').length;
  const edgesModified = edgeDiffs.filter((e) => e.type === 'modified').length;

  return {
    nodes: nodeDiffs,
    edges: edgeDiffs,
    summary: {
      nodesAdded,
      nodesRemoved,
      nodesModified,
      edgesAdded,
      edgesRemoved,
      edgesModified,
      totalChanges: nodesAdded + nodesRemoved + nodesModified + edgesAdded + edgesRemoved + edgesModified,
    },
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function diffElements<
  T extends Record<string, unknown>,
  D,
  K extends string,
>(
  baseline: T[],
  current: T[],
  getKey: (item: T) => string,
  kind: 'node' | 'edge',
  trackedFields: Array<{ key: K; label: string }>,
): D[] {
  const baselineMap = new Map<string, T>();
  for (const item of baseline) {
    baselineMap.set(getKey(item), item);
  }

  const currentMap = new Map<string, T>();
  for (const item of current) {
    currentMap.set(getKey(item), item);
  }

  const entries: D[] = [];
  const idField = kind === 'node' ? 'nodeId' : 'edgeId';

  // Find added and modified items
  for (const [key, currentItem] of Array.from(currentMap)) {
    const baselineItem = baselineMap.get(key);

    if (!baselineItem) {
      entries.push({
        type: 'added',
        kind,
        [idField]: key,
        current: currentItem,
      } as unknown as D);
      continue;
    }

    // Check for field-level changes
    const changes: ArchFieldChange[] = [];
    for (const { key: fieldKey, label } of trackedFields) {
      const oldVal: string | number | null = (baselineItem[fieldKey] as string | number | null) ?? null;
      const newVal: string | number | null = (currentItem[fieldKey] as string | number | null) ?? null;
      if (String(oldVal) !== String(newVal)) {
        changes.push({ field: label, oldValue: oldVal, newValue: newVal });
      }
    }

    if (changes.length > 0) {
      entries.push({
        type: 'modified',
        kind,
        [idField]: key,
        baseline: baselineItem,
        current: currentItem,
        changes,
      } as unknown as D);
    }
  }

  // Find removed items
  for (const [key, baselineItem] of Array.from(baselineMap)) {
    if (!currentMap.has(key)) {
      entries.push({
        type: 'removed',
        kind,
        [idField]: key,
        baseline: baselineItem,
      } as unknown as D);
    }
  }

  // Sort: removed first, then modified, then added — each group sorted by key
  const ORDER: Record<string, number> = { removed: 0, modified: 1, added: 2 };
  entries.sort((a, b) => {
    const aType = (a as unknown as { type: string }).type;
    const bType = (b as unknown as { type: string }).type;
    const typeOrder = (ORDER[aType] ?? 3) - (ORDER[bType] ?? 3);
    if (typeOrder !== 0) { return typeOrder; }
    const aKey = (a as unknown as Record<string, string>)[idField] ?? '';
    const bKey = (b as unknown as Record<string, string>)[idField] ?? '';
    return aKey.localeCompare(bKey);
  });

  return entries;
}
