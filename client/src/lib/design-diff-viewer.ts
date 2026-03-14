/**
 * Design Diff Viewer engine (BL-0220).
 *
 * Compares two design snapshots section-by-section: architecture nodes, edges,
 * BOM items, and circuit instances. Produces a unified diff result with
 * per-section summaries and color-coded change types (added/removed/modified/unchanged).
 *
 * Used by DesignDiffPanel to render a side-by-side comparison view.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Change type for a single row in the diff. */
export type DiffChangeType = 'added' | 'removed' | 'modified' | 'unchanged';

/** A single field-level change within a modified row. */
export interface FieldChange {
  field: string;
  oldValue: string | number | null;
  newValue: string | number | null;
}

/** A row in the diff table, representing one element in a section. */
export interface DiffRow {
  /** Unique key within the section (nodeId, edgeId, partNumber, refDes). */
  key: string;
  /** Human-readable label for the row. */
  label: string;
  changeType: DiffChangeType;
  /** Left-side (baseline) field values. Null if added. */
  baselineFields: Record<string, string | number | null> | null;
  /** Right-side (current) field values. Null if removed. */
  currentFields: Record<string, string | number | null> | null;
  /** Field-level changes for modified rows. Empty for others. */
  fieldChanges: FieldChange[];
}

/** Summary counts for one section. */
export interface DiffSectionSummary {
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
  total: number;
}

/** A named section of the diff (e.g., "Architecture Nodes"). */
export interface DiffSection {
  id: string;
  label: string;
  /** Column headers for both sides. */
  columns: string[];
  rows: DiffRow[];
  summary: DiffSectionSummary;
}

/** Full diff result across all sections. */
export interface DesignDiffResult {
  sections: DiffSection[];
  totalSummary: DiffSectionSummary;
}

// ---------------------------------------------------------------------------
// Input types — lightweight representations for comparison
// ---------------------------------------------------------------------------

export interface DiffNode {
  nodeId: string;
  label: string;
  nodeType: string;
  positionX: number;
  positionY: number;
}

export interface DiffEdge {
  edgeId: string;
  source: string;
  target: string;
  label?: string | null;
  signalType?: string | null;
}

export interface DiffBomItem {
  partNumber: string;
  manufacturer: string;
  description: string;
  quantity: number;
  unitPrice: string | number;
  supplier: string;
  status: string;
}

export interface DiffCircuitInstance {
  referenceDesignator: string;
  schematicX: number;
  schematicY: number;
  properties?: Record<string, unknown> | null;
}

export interface DesignSnapshot {
  nodes: DiffNode[];
  edges: DiffEdge[];
  bomItems: DiffBomItem[];
  circuitInstances: DiffCircuitInstance[];
}

// ---------------------------------------------------------------------------
// Tracked field definitions per section
// ---------------------------------------------------------------------------

interface TrackedField<T> {
  key: keyof T & string;
  label: string;
}

const NODE_FIELDS: TrackedField<DiffNode>[] = [
  { key: 'label', label: 'Label' },
  { key: 'nodeType', label: 'Type' },
  { key: 'positionX', label: 'X' },
  { key: 'positionY', label: 'Y' },
];

const EDGE_FIELDS: TrackedField<DiffEdge>[] = [
  { key: 'source', label: 'Source' },
  { key: 'target', label: 'Target' },
  { key: 'label', label: 'Label' },
  { key: 'signalType', label: 'Signal Type' },
];

const BOM_FIELDS: TrackedField<DiffBomItem>[] = [
  { key: 'manufacturer', label: 'Manufacturer' },
  { key: 'description', label: 'Description' },
  { key: 'quantity', label: 'Qty' },
  { key: 'unitPrice', label: 'Unit Price' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'status', label: 'Status' },
];

const CIRCUIT_FIELDS: TrackedField<DiffCircuitInstance>[] = [
  { key: 'referenceDesignator', label: 'Ref Des' },
  { key: 'schematicX', label: 'X' },
  { key: 'schematicY', label: 'Y' },
];

// ---------------------------------------------------------------------------
// Generic section differ
// ---------------------------------------------------------------------------

function diffSection<T>(
  id: string,
  label: string,
  baseline: T[],
  current: T[],
  getKey: (item: T) => string,
  getLabel: (item: T) => string,
  trackedFields: TrackedField<T>[],
): DiffSection {
  const columns = trackedFields.map((f) => f.label);

  const baselineMap = new Map<string, T>();
  for (const item of baseline) {
    baselineMap.set(getKey(item), item);
  }

  const currentMap = new Map<string, T>();
  for (const item of current) {
    currentMap.set(getKey(item), item);
  }

  const rows: DiffRow[] = [];

  // Collect all unique keys preserving order (current first, then baseline-only)
  const allKeys: string[] = [];
  const seen = new Set<string>();
  for (const item of current) {
    const key = getKey(item);
    if (!seen.has(key)) {
      allKeys.push(key);
      seen.add(key);
    }
  }
  for (const item of baseline) {
    const key = getKey(item);
    if (!seen.has(key)) {
      allKeys.push(key);
      seen.add(key);
    }
  }

  for (const key of allKeys) {
    const baseItem = baselineMap.get(key);
    const currItem = currentMap.get(key);

    if (currItem && !baseItem) {
      // Added
      rows.push({
        key,
        label: getLabel(currItem),
        changeType: 'added',
        baselineFields: null,
        currentFields: extractFields(currItem, trackedFields),
        fieldChanges: [],
      });
    } else if (baseItem && !currItem) {
      // Removed
      rows.push({
        key,
        label: getLabel(baseItem),
        changeType: 'removed',
        baselineFields: extractFields(baseItem, trackedFields),
        currentFields: null,
        fieldChanges: [],
      });
    } else if (baseItem && currItem) {
      // Compare fields
      const changes = compareFields(baseItem, currItem, trackedFields);
      rows.push({
        key,
        label: getLabel(currItem),
        changeType: changes.length > 0 ? 'modified' : 'unchanged',
        baselineFields: extractFields(baseItem, trackedFields),
        currentFields: extractFields(currItem, trackedFields),
        fieldChanges: changes,
      });
    }
  }

  // Sort: removed first, modified second, added third, unchanged last
  const ORDER: Record<DiffChangeType, number> = { removed: 0, modified: 1, added: 2, unchanged: 3 };
  rows.sort((a, b) => {
    const typeOrder = ORDER[a.changeType] - ORDER[b.changeType];
    if (typeOrder !== 0) {
      return typeOrder;
    }
    return a.key.localeCompare(b.key);
  });

  const added = rows.filter((r) => r.changeType === 'added').length;
  const removed = rows.filter((r) => r.changeType === 'removed').length;
  const modified = rows.filter((r) => r.changeType === 'modified').length;
  const unchanged = rows.filter((r) => r.changeType === 'unchanged').length;

  return {
    id,
    label,
    columns,
    rows,
    summary: { added, removed, modified, unchanged, total: rows.length },
  };
}

// ---------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------

function extractFields<T>(
  item: T,
  trackedFields: TrackedField<T>[],
): Record<string, string | number | null> {
  const result: Record<string, string | number | null> = {};
  for (const { key, label } of trackedFields) {
    const val = item[key];
    result[label] = val === undefined || val === null ? null : (val as string | number);
  }
  return result;
}

function compareFields<T extends Record<string, unknown>>(
  baseline: T,
  current: T,
  trackedFields: TrackedField<T>[],
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const { key, label } of trackedFields) {
    const oldVal = baseline[key] ?? null;
    const newVal = current[key] ?? null;
    if (String(oldVal) !== String(newVal)) {
      changes.push({
        field: label,
        oldValue: oldVal as string | number | null,
        newValue: newVal as string | number | null,
      });
    }
  }
  return changes;
}

// ---------------------------------------------------------------------------
// Core diff function
// ---------------------------------------------------------------------------

/**
 * Compute a full design diff between a baseline and current snapshot.
 * Produces section-by-section comparison across architecture, BOM, and circuits.
 */
export function computeDesignDiff(
  baseline: DesignSnapshot,
  current: DesignSnapshot,
): DesignDiffResult {
  const sections: DiffSection[] = [];

  // 1. Architecture Nodes
  sections.push(
    diffSection(
      'arch-nodes',
      'Architecture Nodes',
      baseline.nodes,
      current.nodes,
      (n) => n.nodeId,
      (n) => n.label,
      NODE_FIELDS,
    ),
  );

  // 2. Architecture Edges
  sections.push(
    diffSection(
      'arch-edges',
      'Architecture Edges',
      baseline.edges,
      current.edges,
      (e) => e.edgeId,
      (e) => e.label ?? `${e.source} → ${e.target}`,
      EDGE_FIELDS,
    ),
  );

  // 3. BOM Items
  sections.push(
    diffSection(
      'bom',
      'BOM Items',
      baseline.bomItems,
      current.bomItems,
      (b) => b.partNumber,
      (b) => `${b.partNumber} — ${b.description}`,
      BOM_FIELDS,
    ),
  );

  // 4. Circuit Instances
  sections.push(
    diffSection(
      'circuit-instances',
      'Circuit Instances',
      baseline.circuitInstances,
      current.circuitInstances,
      (c) => c.referenceDesignator,
      (c) => c.referenceDesignator,
      CIRCUIT_FIELDS,
    ),
  );

  // Total summary
  const totalSummary: DiffSectionSummary = {
    added: sections.reduce((s, sec) => s + sec.summary.added, 0),
    removed: sections.reduce((s, sec) => s + sec.summary.removed, 0),
    modified: sections.reduce((s, sec) => s + sec.summary.modified, 0),
    unchanged: sections.reduce((s, sec) => s + sec.summary.unchanged, 0),
    total: sections.reduce((s, sec) => s + sec.summary.total, 0),
  };

  return { sections, totalSummary };
}

// ---------------------------------------------------------------------------
// Color helpers for UI rendering
// ---------------------------------------------------------------------------

/** CSS class suffix for each change type (used with Tailwind). */
export function changeTypeColor(changeType: DiffChangeType): string {
  switch (changeType) {
    case 'added': return 'text-green-400 bg-green-400/10';
    case 'removed': return 'text-red-400 bg-red-400/10';
    case 'modified': return 'text-amber-400 bg-amber-400/10';
    case 'unchanged': return 'text-muted-foreground bg-transparent';
  }
}

/** Badge label for each change type. */
export function changeTypeLabel(changeType: DiffChangeType): string {
  switch (changeType) {
    case 'added': return 'Added';
    case 'removed': return 'Removed';
    case 'modified': return 'Modified';
    case 'unchanged': return 'Unchanged';
  }
}
