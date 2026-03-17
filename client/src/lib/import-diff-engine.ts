/**
 * Import Diff Engine (BL-0220).
 *
 * Compares an imported design snapshot against the current design, producing
 * a flat list of entity-level changes with fuzzy matching (by label/name when
 * IDs differ), field-level change detection, severity classification, and
 * human-readable formatting.
 *
 * Complements the section-based `design-diff-viewer.ts` — this engine is
 * optimised for import workflows where IDs are unlikely to match across tools.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DiffEntityType = 'node' | 'edge' | 'bomItem' | 'net' | 'wire' | 'component';

export interface DiffChange {
  type: 'added' | 'removed' | 'modified';
  entityType: DiffEntityType;
  id: string;
  label: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  changedFields?: string[];
}

export interface DiffSummary {
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
  byEntityType: Record<DiffEntityType, { added: number; removed: number; modified: number }>;
}

export interface ImportDiffResult {
  changes: DiffChange[];
  summary: DiffSummary;
  severity: 'none' | 'minor' | 'major' | 'breaking';
}

// ---------------------------------------------------------------------------
// Snapshot types
// ---------------------------------------------------------------------------

export interface SnapshotNode {
  id: string;
  label: string;
  type: string;
}

export interface SnapshotEdge {
  id: string;
  source: string;
  target: string;
}

export interface SnapshotBomItem {
  id: string;
  partNumber: string;
  quantity: number;
}

export interface SnapshotNet {
  id: string;
  name: string;
}

export interface DesignSnapshot {
  nodes: SnapshotNode[];
  edges: SnapshotEdge[];
  bomItems: SnapshotBomItem[];
  nets: SnapshotNet[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const ALL_ENTITY_TYPES: DiffEntityType[] = ['node', 'edge', 'bomItem', 'net', 'wire', 'component'];

function emptyEntityBreakdown(): Record<DiffEntityType, { added: number; removed: number; modified: number }> {
  const result = {} as Record<DiffEntityType, { added: number; removed: number; modified: number }>;
  for (const t of ALL_ENTITY_TYPES) {
    result[t] = { added: 0, removed: 0, modified: 0 };
  }
  return result;
}

/**
 * Deduplicate an array by key (last occurrence wins).
 */
function dedup<T>(items: T[], getKey: (item: T) => string): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    map.set(getKey(item), item);
  }
  return map;
}

/**
 * Compute changed field names between two plain objects.
 */
function changedFields(a: Record<string, unknown>, b: Record<string, unknown>, keys: string[]): string[] {
  const changed: string[] = [];
  for (const k of keys) {
    if (String(a[k] ?? '') !== String(b[k] ?? '')) {
      changed.push(k);
    }
  }
  return changed;
}

/**
 * Generic entity differ with ID-first matching and fuzzy fallback.
 *
 * @param importedMap  - Entities from the imported design, keyed by ID.
 * @param currentMap   - Entities from the current design, keyed by ID.
 * @param entityType   - The entity type label for changes.
 * @param getLabel     - Extract a human-readable label from an entity.
 * @param getFuzzyKey  - Extract a fuzzy-match key (e.g. label, name, source+target).
 * @param fieldKeys    - Field names to compare for modification detection.
 * @param toRecord     - Convert an entity to a plain record for before/after.
 */
function diffEntities<T>(
  importedMap: Map<string, T>,
  currentMap: Map<string, T>,
  entityType: DiffEntityType,
  getLabel: (item: T) => string,
  getFuzzyKey: (item: T) => string,
  fieldKeys: string[],
  toRecord: (item: T) => Record<string, unknown>,
): { changes: DiffChange[]; unchanged: number } {
  const changes: DiffChange[] = [];
  let unchanged = 0;

  // Track which current entities have been matched (by ID or fuzzy).
  const matchedCurrentIds = new Set<string>();

  // Build a fuzzy index of current entities for fallback matching.
  // Maps fuzzyKey → [id, entity]. Only stores first occurrence per fuzzy key.
  const currentFuzzyIndex = new Map<string, { id: string; entity: T }>();
  for (const [id, entity] of Array.from(currentMap.entries())) {
    const fk = getFuzzyKey(entity);
    if (fk && !currentFuzzyIndex.has(fk)) {
      currentFuzzyIndex.set(fk, { id, entity });
    }
  }

  // Pass 1: Process each imported entity.
  for (const [importedId, importedEntity] of Array.from(importedMap.entries())) {
    // Try exact ID match first.
    let currentEntity = currentMap.get(importedId);
    let matchedCurrentId = importedId;

    if (currentEntity && !matchedCurrentIds.has(matchedCurrentId)) {
      // Exact ID match found.
      matchedCurrentIds.add(matchedCurrentId);
    } else if (!currentEntity || matchedCurrentIds.has(matchedCurrentId)) {
      // No ID match — try fuzzy match.
      currentEntity = undefined;
      matchedCurrentId = '';
      const fuzzyKey = getFuzzyKey(importedEntity);
      if (fuzzyKey) {
        const fuzzyMatch = currentFuzzyIndex.get(fuzzyKey);
        if (fuzzyMatch && !matchedCurrentIds.has(fuzzyMatch.id)) {
          currentEntity = fuzzyMatch.entity;
          matchedCurrentId = fuzzyMatch.id;
          matchedCurrentIds.add(matchedCurrentId);
        }
      }
    }

    if (currentEntity) {
      // Matched — check for modifications.
      const importedRec = toRecord(importedEntity);
      const currentRec = toRecord(currentEntity);
      const changed = changedFields(importedRec, currentRec, fieldKeys);
      if (changed.length > 0) {
        changes.push({
          type: 'modified',
          entityType,
          id: importedId,
          label: getLabel(importedEntity),
          before: currentRec,
          after: importedRec,
          changedFields: changed,
        });
      } else {
        unchanged++;
      }
    } else {
      // No match → added in import.
      changes.push({
        type: 'added',
        entityType,
        id: importedId,
        label: getLabel(importedEntity),
        after: toRecord(importedEntity),
      });
    }
  }

  // Pass 2: Find current entities not matched → removed (present in current, absent in import).
  for (const [currentId, currentEntity] of Array.from(currentMap.entries())) {
    if (!matchedCurrentIds.has(currentId)) {
      changes.push({
        type: 'removed',
        entityType,
        id: currentId,
        label: getLabel(currentEntity),
        before: toRecord(currentEntity),
      });
    }
  }

  return { changes, unchanged };
}

// ---------------------------------------------------------------------------
// Severity classification
// ---------------------------------------------------------------------------

function classifySeverity(
  changes: DiffChange[],
  totalEntities: number,
  currentEdges: SnapshotEdge[],
): 'none' | 'minor' | 'major' | 'breaking' {
  if (changes.length === 0) {
    return 'none';
  }

  // Breaking: any removed node that has edges referencing it in the current design.
  const removedNodeIds = new Set(
    changes
      .filter((c) => c.type === 'removed' && c.entityType === 'node')
      .map((c) => c.id),
  );
  if (removedNodeIds.size > 0) {
    const hasOrphanedEdges = currentEdges.some(
      (e) => removedNodeIds.has(e.source) || removedNodeIds.has(e.target),
    );
    if (hasOrphanedEdges) {
      return 'breaking';
    }
  }

  // Major vs minor: >20% of total entities changed.
  const changeRatio = totalEntities > 0 ? changes.length / totalEntities : 0;
  return changeRatio > 0.2 ? 'major' : 'minor';
}

// ---------------------------------------------------------------------------
// Core: diffDesigns
// ---------------------------------------------------------------------------

/**
 * Compare an imported design snapshot against the current design.
 *
 * Matching strategy:
 * 1. Match by ID first.
 * 2. If no ID match, fall back to fuzzy matching:
 *    - Nodes: match by `label`
 *    - Edges: match by `source`+`target` composite key
 *    - BOM items: match by `partNumber`
 *    - Nets: match by `name`
 * 3. Detect field-level changes on matched entities.
 * 4. Classify severity based on change ratio and structural impact.
 */
export function diffDesigns(imported: DesignSnapshot, current: DesignSnapshot): ImportDiffResult {
  const allChanges: DiffChange[] = [];
  let totalUnchanged = 0;

  // Nodes
  const nodeResult = diffEntities(
    dedup(imported.nodes, (n) => n.id),
    dedup(current.nodes, (n) => n.id),
    'node',
    (n) => n.label,
    (n) => n.label,
    ['label', 'type'],
    (n) => ({ id: n.id, label: n.label, type: n.type }),
  );
  allChanges.push(...nodeResult.changes);
  totalUnchanged += nodeResult.unchanged;

  // Edges
  const edgeResult = diffEntities(
    dedup(imported.edges, (e) => e.id),
    dedup(current.edges, (e) => e.id),
    'edge',
    (e) => `${e.source} → ${e.target}`,
    (e) => `${e.source}::${e.target}`,
    ['source', 'target'],
    (e) => ({ id: e.id, source: e.source, target: e.target }),
  );
  allChanges.push(...edgeResult.changes);
  totalUnchanged += edgeResult.unchanged;

  // BOM items
  const bomResult = diffEntities(
    dedup(imported.bomItems, (b) => b.id),
    dedup(current.bomItems, (b) => b.id),
    'bomItem',
    (b) => b.partNumber,
    (b) => b.partNumber,
    ['partNumber', 'quantity'],
    (b) => ({ id: b.id, partNumber: b.partNumber, quantity: b.quantity }),
  );
  allChanges.push(...bomResult.changes);
  totalUnchanged += bomResult.unchanged;

  // Nets
  const netResult = diffEntities(
    dedup(imported.nets, (n) => n.id),
    dedup(current.nets, (n) => n.id),
    'net',
    (n) => n.name,
    (n) => n.name,
    ['name'],
    (n) => ({ id: n.id, name: n.name }),
  );
  allChanges.push(...netResult.changes);
  totalUnchanged += netResult.unchanged;

  // Summary
  const summary = getDiffSummary(allChanges);
  summary.unchanged = totalUnchanged;

  // Total entities = changed + unchanged
  const totalEntities = allChanges.length + totalUnchanged;

  // Severity
  const severity = classifySeverity(allChanges, totalEntities, current.edges);

  return { changes: allChanges, summary, severity };
}

// ---------------------------------------------------------------------------
// getDiffSummary
// ---------------------------------------------------------------------------

/**
 * Compute aggregate summary from a list of changes.
 * Note: `unchanged` is always 0 in the returned summary since changes don't
 * include unchanged entities. Use the value from `diffDesigns` result instead.
 */
export function getDiffSummary(changes: DiffChange[]): DiffSummary {
  const byEntityType = emptyEntityBreakdown();
  let added = 0;
  let removed = 0;
  let modified = 0;

  for (const c of changes) {
    if (c.type === 'added') {
      added++;
      byEntityType[c.entityType].added++;
    } else if (c.type === 'removed') {
      removed++;
      byEntityType[c.entityType].removed++;
    } else if (c.type === 'modified') {
      modified++;
      byEntityType[c.entityType].modified++;
    }
  }

  return { added, removed, modified, unchanged: 0, byEntityType };
}

// ---------------------------------------------------------------------------
// formatDiffChange
// ---------------------------------------------------------------------------

/**
 * Produce a human-readable one-line description of a change.
 */
export function formatDiffChange(change: DiffChange): string {
  const verb = change.type === 'added' ? 'Added' : change.type === 'removed' ? 'Removed' : 'Modified';
  let description = `${verb} ${change.entityType} "${change.label}"`;

  if (change.type === 'modified' && change.changedFields && change.changedFields.length > 0) {
    description += ` (${change.changedFields.join(', ')})`;
  }

  return description;
}

// ---------------------------------------------------------------------------
// groupChangesByEntity
// ---------------------------------------------------------------------------

/**
 * Group changes by entity type, preserving order within each group.
 */
export function groupChangesByEntity(changes: DiffChange[]): Record<DiffEntityType, DiffChange[]> {
  const groups = {} as Record<DiffEntityType, DiffChange[]>;
  for (const t of ALL_ENTITY_TYPES) {
    groups[t] = [];
  }
  for (const c of changes) {
    groups[c.entityType].push(c);
  }
  return groups;
}
