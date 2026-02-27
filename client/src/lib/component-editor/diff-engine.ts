import type { PartState, Shape, Connector } from '@shared/component-types';
import type { PartDiff, ShapeDiff, ConnectorDiff, MetaDiff } from './types';

const VIEW_NAMES = ['breadboard', 'schematic', 'pcb'] as const;

/** Key-order-stable deep-equal comparison for plain data objects. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(k => Object.hasOwn(bObj, k) && deepEqual(aObj[k], bObj[k]));
}

/**
 * Compute a structural diff between two PartState objects.
 * Compares shapes (per view), connectors, and top-level metadata fields.
 */
export function computePartDiff(before: PartState, after: PartState): PartDiff {
  const shapes = diffShapes(before, after);
  const connectors = diffConnectors(before.connectors, after.connectors);
  const metaChanges = diffMeta(before, after);

  const summary = {
    shapesAdded: shapes.filter(s => s.type === 'added').length,
    shapesRemoved: shapes.filter(s => s.type === 'removed').length,
    shapesModified: shapes.filter(s => s.type === 'modified').length,
    connectorsAdded: connectors.filter(c => c.type === 'added').length,
    connectorsRemoved: connectors.filter(c => c.type === 'removed').length,
    connectorsModified: connectors.filter(c => c.type === 'modified').length,
    metaFieldsChanged: metaChanges.length,
  };

  const hasChanges = shapes.length > 0 || connectors.length > 0 || metaChanges.length > 0;

  return { shapes, connectors, metaChanges, hasChanges, summary };
}

function diffShapes(before: PartState, after: PartState): ShapeDiff[] {
  const diffs: ShapeDiff[] = [];

  for (const view of VIEW_NAMES) {
    const beforeShapes = before.views[view].shapes;
    const afterShapes = after.views[view].shapes;

    const beforeMap = new Map<string, Shape>();
    for (const s of beforeShapes) beforeMap.set(s.id, s);

    const afterMap = new Map<string, Shape>();
    for (const s of afterShapes) afterMap.set(s.id, s);

    // Added or modified
    afterMap.forEach((afterShape, id) => {
      const beforeShape = beforeMap.get(id);
      if (!beforeShape) {
        diffs.push({ type: 'added', shapeId: id, view, after: afterShape });
      } else if (!deepEqual(beforeShape, afterShape)) {
        diffs.push({ type: 'modified', shapeId: id, view, before: beforeShape, after: afterShape });
      }
    });

    // Removed
    beforeMap.forEach((beforeShape, id) => {
      if (!afterMap.has(id)) {
        diffs.push({ type: 'removed', shapeId: id, view, before: beforeShape });
      }
    });
  }

  return diffs;
}

function diffConnectors(before: Connector[], after: Connector[]): ConnectorDiff[] {
  const diffs: ConnectorDiff[] = [];

  const beforeMap = new Map<string, Connector>();
  for (const c of before) beforeMap.set(c.id, c);

  const afterMap = new Map<string, Connector>();
  for (const c of after) afterMap.set(c.id, c);

  afterMap.forEach((afterConn, id) => {
    const beforeConn = beforeMap.get(id);
    if (!beforeConn) {
      diffs.push({ type: 'added', connectorId: id, after: afterConn });
    } else if (!deepEqual(beforeConn, afterConn)) {
      diffs.push({ type: 'modified', connectorId: id, before: beforeConn, after: afterConn });
    }
  });

  beforeMap.forEach((beforeConn, id) => {
    if (!afterMap.has(id)) {
      diffs.push({ type: 'removed', connectorId: id, before: beforeConn });
    }
  });

  return diffs;
}

const META_FIELDS: (keyof PartState['meta'])[] = [
  'title', 'family', 'manufacturer', 'mpn', 'description',
  'tags', 'mountingType', 'packageType', 'properties', 'datasheetUrl', 'version',
];

function diffMeta(before: PartState, after: PartState): MetaDiff[] {
  const diffs: MetaDiff[] = [];

  for (const field of META_FIELDS) {
    const beforeVal = before.meta[field];
    const afterVal = after.meta[field];
    if (!deepEqual(beforeVal, afterVal)) {
      diffs.push({ field, before: beforeVal, after: afterVal });
    }
  }

  return diffs;
}

/**
 * Apply a subset of a diff to produce a new PartState.
 *
 * Starts from `original` and selectively applies changes from `modified`
 * based on which IDs/fields are in the accepted sets.
 *
 * - Accepted "added" shapes/connectors: taken from `modified`
 * - Accepted "removed" shapes/connectors: excluded from result
 * - Accepted "modified" shapes/connectors: use the `modified` version
 * - Rejected changes: keep the `original` version
 *
 * NOTE: Buses and constraints are not currently diffed or selectively merged.
 * They are preserved from `original` as-is. A future iteration may add
 * bus/constraint diffing when the AI modify endpoint supports them.
 */
export function applyPartialDiff(
  original: PartState,
  modified: PartState,
  diff: PartDiff,
  acceptedShapeIds: Set<string>,
  acceptedConnectorIds: Set<string>,
  acceptedMetaFields: Set<string>,
): PartState {
  const result: PartState = structuredClone(original);

  // Apply shape changes per view
  for (const view of VIEW_NAMES) {
    const viewDiffs = diff.shapes.filter(s => s.view === view);
    if (viewDiffs.length === 0) continue;

    const modifiedMap = new Map<string, Shape>();
    for (const s of modified.views[view].shapes) modifiedMap.set(s.id, s);

    // Build the accepted set of removals for quick lookup
    const acceptedRemovals = new Set<string>();
    for (const d of viewDiffs) {
      if (d.type === 'removed' && acceptedShapeIds.has(d.shapeId)) {
        acceptedRemovals.add(d.shapeId);
      }
    }

    // Start from original shapes, filtering out accepted removals
    const resultShapes: Shape[] = [];
    for (const s of original.views[view].shapes) {
      if (acceptedRemovals.has(s.id)) continue;

      // Check if this shape was modified and accepted
      const shapeDiff = viewDiffs.find(d => d.shapeId === s.id && d.type === 'modified');
      if (shapeDiff && acceptedShapeIds.has(s.id)) {
        const modifiedShape = modifiedMap.get(s.id);
        if (modifiedShape) {
          resultShapes.push(modifiedShape);
          continue;
        }
      }
      resultShapes.push(s);
    }

    // Add accepted additions
    for (const d of viewDiffs) {
      if (d.type === 'added' && acceptedShapeIds.has(d.shapeId)) {
        const addedShape = modifiedMap.get(d.shapeId);
        if (addedShape) resultShapes.push(addedShape);
      }
    }

    result.views[view] = { ...result.views[view], shapes: resultShapes };
  }

  // Apply connector changes
  const connDiffs = diff.connectors;
  if (connDiffs.length > 0) {
    const modifiedConnMap = new Map<string, Connector>();
    for (const c of modified.connectors) modifiedConnMap.set(c.id, c);

    const acceptedConnRemovals = new Set<string>();
    for (const d of connDiffs) {
      if (d.type === 'removed' && acceptedConnectorIds.has(d.connectorId)) {
        acceptedConnRemovals.add(d.connectorId);
      }
    }

    const resultConnectors: Connector[] = [];
    for (const c of original.connectors) {
      if (acceptedConnRemovals.has(c.id)) continue;

      const connDiff = connDiffs.find(d => d.connectorId === c.id && d.type === 'modified');
      if (connDiff && acceptedConnectorIds.has(c.id)) {
        const modifiedConn = modifiedConnMap.get(c.id);
        if (modifiedConn) {
          resultConnectors.push(modifiedConn);
          continue;
        }
      }
      resultConnectors.push(c);
    }

    for (const d of connDiffs) {
      if (d.type === 'added' && acceptedConnectorIds.has(d.connectorId)) {
        const addedConn = modifiedConnMap.get(d.connectorId);
        if (addedConn) resultConnectors.push(addedConn);
      }
    }

    result.connectors = resultConnectors;
  }

  // Apply meta changes
  for (const metaDiff of diff.metaChanges) {
    if (acceptedMetaFields.has(metaDiff.field)) {
      const field = metaDiff.field as keyof PartState['meta'];
      // Use type assertion for the dynamic field assignment -- the field names
      // are validated against META_FIELDS in computePartDiff
      (result.meta as unknown as Record<string, unknown>)[field] = structuredClone(modified.meta[field]);
    }
  }

  return result;
}
