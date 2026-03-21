/**
 * BL-0190 — Time-travel restore at view/object granularity.
 *
 * Extends the existing snapshot-restore system with object-level selectivity.
 * Instead of a full domain restore, users can inspect individual changed objects,
 * preview per-field diffs, and cherry-pick which objects to restore.
 *
 * Singleton+subscribe pattern. Pure client-side diffing engine — does not
 * interact with the server or localStorage. Operates on snapshot data and
 * current design state passed in by the caller.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported restore domains (mirrors snapshot-restore-cascade). */
export type RestoreDomain = 'architecture' | 'schematic' | 'bom' | 'simulation';

/** Generic object with an identity key. */
export interface IdentifiableObject {
  id: string;
  [key: string]: unknown;
}

/** A single field-level diff between snapshot and current state. */
export interface FieldDiff {
  field: string;
  snapshotValue: unknown;
  currentValue: unknown;
}

/** Change types for individual objects. */
export type ObjectChangeType = 'added' | 'removed' | 'modified' | 'unchanged';

/** An individual object's change record. */
export interface ObjectChange {
  id: string;
  domain: RestoreDomain;
  /** Sub-category within a domain (e.g., 'nodes', 'edges', 'instances'). */
  subType: string;
  changeType: ObjectChangeType;
  /** Present only for 'modified' changes. */
  fieldDiffs: FieldDiff[];
  /** The snapshot version of this object (null for 'added' — only in current). */
  snapshotObject: IdentifiableObject | null;
  /** The current version of this object (null for 'removed' — only in snapshot). */
  currentObject: IdentifiableObject | null;
}

/** A warning about potential side-effects of restoring an object. */
export interface RestoreWarning {
  objectId: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
}

/** Preview of what restoring a set of objects would do. */
export interface RestorePreview {
  objectsToRestore: ObjectChange[];
  objectsToDelete: ObjectChange[];
  objectsToAdd: ObjectChange[];
  totalFieldChanges: number;
  warnings: RestoreWarning[];
}

/** Full analysis result of snapshot vs current state. */
export interface TimeTravelAnalysis {
  domain: RestoreDomain;
  changes: ObjectChange[];
  summary: DomainChangeSummary;
}

/** Summary counts for a domain. */
export interface DomainChangeSummary {
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
  totalFieldDiffs: number;
}

/** Design state snapshot in the same shape as SnapshotData. */
export interface DesignSnapshot {
  nodes?: IdentifiableObject[];
  edges?: IdentifiableObject[];
  instances?: IdentifiableObject[];
  nets?: IdentifiableObject[];
  wires?: IdentifiableObject[];
  bomItems?: IdentifiableObject[];
  simulationResults?: IdentifiableObject[];
}

// ---------------------------------------------------------------------------
// Domain → sub-type key mapping
// ---------------------------------------------------------------------------

const DOMAIN_SUB_TYPES: Record<RestoreDomain, { key: keyof DesignSnapshot; subType: string }[]> = {
  architecture: [
    { key: 'nodes', subType: 'node' },
    { key: 'edges', subType: 'edge' },
  ],
  schematic: [
    { key: 'instances', subType: 'instance' },
    { key: 'nets', subType: 'net' },
    { key: 'wires', subType: 'wire' },
  ],
  bom: [
    { key: 'bomItems', subType: 'bomItem' },
  ],
  simulation: [
    { key: 'simulationResults', subType: 'simulationResult' },
  ],
};

// ---------------------------------------------------------------------------
// Diffing helpers
// ---------------------------------------------------------------------------

/** Compare two values for shallow equality (handles primitives, null/undefined, simple objects). */
function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (a == null || b == null) {
    return false;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  if (typeof a === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

/** Compute per-field diffs between two objects. */
function computeFieldDiffs(
  snapshotObj: IdentifiableObject,
  currentObj: IdentifiableObject,
): FieldDiff[] {
  const allKeys = new Set<string>();
  Object.keys(snapshotObj).forEach((k) => allKeys.add(k));
  Object.keys(currentObj).forEach((k) => allKeys.add(k));

  const diffs: FieldDiff[] = [];
  allKeys.forEach((field) => {
    if (field === 'id') {
      return; // Skip the identity field
    }
    const snapshotValue = snapshotObj[field];
    const currentValue = currentObj[field];
    if (!valuesEqual(snapshotValue, currentValue)) {
      diffs.push({ field, snapshotValue, currentValue });
    }
  });
  return diffs;
}

/** Safely extract an array from snapshot data. */
function safeArray(data: DesignSnapshot | null | undefined, key: keyof DesignSnapshot): IdentifiableObject[] {
  if (!data) {
    return [];
  }
  const value = data[key];
  return Array.isArray(value) ? value : [];
}

// ---------------------------------------------------------------------------
// Warning generators
// ---------------------------------------------------------------------------

function generateWarnings(
  objectsToRestore: ObjectChange[],
  objectsToDelete: ObjectChange[],
  objectsToAdd: ObjectChange[],
): RestoreWarning[] {
  const warnings: RestoreWarning[] = [];

  // Warn about deleting objects (they exist in current but not snapshot)
  objectsToDelete.forEach((change) => {
    warnings.push({
      objectId: change.id,
      severity: 'warning',
      message: `Object "${change.id}" (${change.subType}) will be deleted — it does not exist in the snapshot`,
    });
  });

  // Warn about adding objects (they exist in snapshot but not current)
  objectsToAdd.forEach((change) => {
    warnings.push({
      objectId: change.id,
      severity: 'info',
      message: `Object "${change.id}" (${change.subType}) will be added from the snapshot`,
    });
  });

  // Warn about multi-field modifications
  objectsToRestore.forEach((change) => {
    if (change.fieldDiffs.length > 5) {
      warnings.push({
        objectId: change.id,
        severity: 'info',
        message: `Object "${change.id}" has ${change.fieldDiffs.length} field changes — review carefully`,
      });
    }
  });

  // Cross-domain dependency warnings
  const restoredDomains = new Set<RestoreDomain>();
  [...objectsToRestore, ...objectsToDelete, ...objectsToAdd].forEach((c) => {
    restoredDomains.add(c.domain);
  });

  if (restoredDomains.has('schematic') && !restoredDomains.has('bom')) {
    warnings.push({
      objectId: '__cross-domain__',
      severity: 'warning',
      message: 'Restoring schematic without BOM may create component mismatches',
    });
  }

  if (restoredDomains.has('architecture') && !restoredDomains.has('schematic')) {
    warnings.push({
      objectId: '__cross-domain__',
      severity: 'info',
      message: 'Restoring architecture without schematic — schematic will remain at current state',
    });
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// TimeTravelRestoreManager — singleton + subscribe
// ---------------------------------------------------------------------------

export class TimeTravelRestoreManager {
  private static instance: TimeTravelRestoreManager | null = null;

  private analysisCache: Map<RestoreDomain, TimeTravelAnalysis> = new Map();
  private selectedObjectIds: Set<string> = new Set();
  private subscribers = new Set<() => void>();

  private constructor() {}

  static getInstance(): TimeTravelRestoreManager {
    if (!TimeTravelRestoreManager.instance) {
      TimeTravelRestoreManager.instance = new TimeTravelRestoreManager();
    }
    return TimeTravelRestoreManager.instance;
  }

  /** Reset singleton for testing purposes. */
  static resetInstance(): void {
    if (TimeTravelRestoreManager.instance) {
      TimeTravelRestoreManager.instance.subscribers.clear();
    }
    TimeTravelRestoreManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscribe
  // -----------------------------------------------------------------------

  subscribe(listener: () => void): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  private notify(): void {
    this.subscribers.forEach((fn) => fn());
  }

  // -----------------------------------------------------------------------
  // Analysis — compare snapshot vs current state
  // -----------------------------------------------------------------------

  /**
   * Analyze differences between a snapshot and the current design state for a
   * specific domain. Results are cached until `clearAnalysis()` is called.
   */
  analyzeDomain(
    domain: RestoreDomain,
    snapshotData: DesignSnapshot,
    currentData: DesignSnapshot,
  ): TimeTravelAnalysis {
    const cached = this.analysisCache.get(domain);
    if (cached) {
      return cached;
    }

    const subTypes = DOMAIN_SUB_TYPES[domain];
    const changes: ObjectChange[] = [];

    for (const { key, subType } of subTypes) {
      const snapshotItems = safeArray(snapshotData, key);
      const currentItems = safeArray(currentData, key);

      const snapshotMap = new Map<string, IdentifiableObject>();
      snapshotItems.forEach((item) => snapshotMap.set(item.id, item));

      const currentMap = new Map<string, IdentifiableObject>();
      currentItems.forEach((item) => currentMap.set(item.id, item));

      // Items in current but not snapshot → added (since snapshot)
      currentMap.forEach((currentObj, id) => {
        if (!snapshotMap.has(id)) {
          changes.push({
            id,
            domain,
            subType,
            changeType: 'added',
            fieldDiffs: [],
            snapshotObject: null,
            currentObject: currentObj,
          });
        }
      });

      // Items in snapshot but not current → removed (since snapshot)
      snapshotMap.forEach((snapshotObj, id) => {
        if (!currentMap.has(id)) {
          changes.push({
            id,
            domain,
            subType,
            changeType: 'removed',
            fieldDiffs: [],
            snapshotObject: snapshotObj,
            currentObject: null,
          });
        }
      });

      // Items in both → check for modifications
      snapshotMap.forEach((snapshotObj, id) => {
        const currentObj = currentMap.get(id);
        if (!currentObj) {
          return;
        }
        const fieldDiffs = computeFieldDiffs(snapshotObj, currentObj);
        changes.push({
          id,
          domain,
          subType,
          changeType: fieldDiffs.length > 0 ? 'modified' : 'unchanged',
          fieldDiffs,
          snapshotObject: snapshotObj,
          currentObject: currentObj,
        });
      });
    }

    const summary = this.summarizeChanges(changes);
    const analysis: TimeTravelAnalysis = { domain, changes, summary };
    this.analysisCache.set(domain, analysis);
    this.notify();
    return analysis;
  }

  /**
   * Analyze all domains at once. Returns analyses keyed by domain.
   */
  analyzeAll(
    snapshotData: DesignSnapshot,
    currentData: DesignSnapshot,
  ): Map<RestoreDomain, TimeTravelAnalysis> {
    const domains: RestoreDomain[] = ['architecture', 'schematic', 'bom', 'simulation'];
    const results = new Map<RestoreDomain, TimeTravelAnalysis>();
    for (const domain of domains) {
      results.set(domain, this.analyzeDomain(domain, snapshotData, currentData));
    }
    return results;
  }

  /** Get cached analysis for a domain (or null if not yet analyzed). */
  getCachedAnalysis(domain: RestoreDomain): TimeTravelAnalysis | null {
    return this.analysisCache.get(domain) ?? null;
  }

  /** Clear all cached analyses. */
  clearAnalysis(): void {
    this.analysisCache.clear();
    this.selectedObjectIds.clear();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Object selection for selective restore
  // -----------------------------------------------------------------------

  /** Select specific object IDs for restore. */
  selectObjects(ids: string[]): void {
    ids.forEach((id) => this.selectedObjectIds.add(id));
    this.notify();
  }

  /** Deselect specific object IDs. */
  deselectObjects(ids: string[]): void {
    ids.forEach((id) => this.selectedObjectIds.delete(id));
    this.notify();
  }

  /** Toggle selection for an object. */
  toggleObject(id: string): void {
    if (this.selectedObjectIds.has(id)) {
      this.selectedObjectIds.delete(id);
    } else {
      this.selectedObjectIds.add(id);
    }
    this.notify();
  }

  /** Select all changed (non-unchanged) objects in a domain. */
  selectAllChanged(domain: RestoreDomain): void {
    const analysis = this.analysisCache.get(domain);
    if (!analysis) {
      return;
    }
    analysis.changes
      .filter((c) => c.changeType !== 'unchanged')
      .forEach((c) => this.selectedObjectIds.add(c.id));
    this.notify();
  }

  /** Deselect all objects. */
  deselectAll(): void {
    this.selectedObjectIds.clear();
    this.notify();
  }

  /** Get current set of selected object IDs. */
  getSelectedIds(): Set<string> {
    return new Set(this.selectedObjectIds);
  }

  /** Check if a specific object is selected. */
  isSelected(id: string): boolean {
    return this.selectedObjectIds.has(id);
  }

  // -----------------------------------------------------------------------
  // Restore preview
  // -----------------------------------------------------------------------

  /**
   * Generate a preview of what restoring the currently selected objects would do.
   * Groups changes into: objects to modify (restore field values), objects to
   * delete (added since snapshot — reverting means removing them), and objects
   * to add (removed since snapshot — reverting means re-adding them).
   */
  generateRestorePreview(): RestorePreview {
    const objectsToRestore: ObjectChange[] = [];
    const objectsToDelete: ObjectChange[] = [];
    const objectsToAdd: ObjectChange[] = [];
    let totalFieldChanges = 0;

    this.analysisCache.forEach((analysis) => {
      for (const change of analysis.changes) {
        if (!this.selectedObjectIds.has(change.id)) {
          continue;
        }
        switch (change.changeType) {
          case 'modified':
            objectsToRestore.push(change);
            totalFieldChanges += change.fieldDiffs.length;
            break;
          case 'added':
            // Object was added since snapshot → restoring means deleting it
            objectsToDelete.push(change);
            break;
          case 'removed':
            // Object was removed since snapshot → restoring means re-adding it
            objectsToAdd.push(change);
            break;
          case 'unchanged':
            // Nothing to do
            break;
        }
      }
    });

    const warnings = generateWarnings(objectsToRestore, objectsToDelete, objectsToAdd);

    return {
      objectsToRestore,
      objectsToDelete,
      objectsToAdd,
      totalFieldChanges,
      warnings,
    };
  }

  // -----------------------------------------------------------------------
  // Filtering / querying changes
  // -----------------------------------------------------------------------

  /** Get all changes across all analyzed domains. */
  getAllChanges(): ObjectChange[] {
    const result: ObjectChange[] = [];
    this.analysisCache.forEach((analysis) => {
      result.push(...analysis.changes);
    });
    return result;
  }

  /** Get changes filtered by change type. */
  getChangesByType(changeType: ObjectChangeType): ObjectChange[] {
    return this.getAllChanges().filter((c) => c.changeType === changeType);
  }

  /** Get changes for a specific domain. */
  getChangesForDomain(domain: RestoreDomain): ObjectChange[] {
    const analysis = this.analysisCache.get(domain);
    return analysis ? [...analysis.changes] : [];
  }

  /** Get only the changed (non-unchanged) objects for a domain. */
  getModifiedForDomain(domain: RestoreDomain): ObjectChange[] {
    return this.getChangesForDomain(domain).filter((c) => c.changeType !== 'unchanged');
  }

  /** Search changes by object ID substring. */
  searchChanges(query: string): ObjectChange[] {
    const lower = query.toLowerCase();
    return this.getAllChanges().filter((c) => {
      if (c.id.toLowerCase().includes(lower)) {
        return true;
      }
      // Also search field names in diffs
      return c.fieldDiffs.some((d) => d.field.toLowerCase().includes(lower));
    });
  }

  // -----------------------------------------------------------------------
  // Summary helpers
  // -----------------------------------------------------------------------

  private summarizeChanges(changes: ObjectChange[]): DomainChangeSummary {
    let added = 0;
    let removed = 0;
    let modified = 0;
    let unchanged = 0;
    let totalFieldDiffs = 0;

    for (const change of changes) {
      switch (change.changeType) {
        case 'added':
          added++;
          break;
        case 'removed':
          removed++;
          break;
        case 'modified':
          modified++;
          totalFieldDiffs += change.fieldDiffs.length;
          break;
        case 'unchanged':
          unchanged++;
          break;
      }
    }

    return { added, removed, modified, unchanged, totalFieldDiffs };
  }

  /** Get a combined summary across all analyzed domains. */
  getOverallSummary(): DomainChangeSummary {
    return this.summarizeChanges(this.getAllChanges());
  }

  /** Get the number of analyzed domains. */
  getAnalyzedDomainCount(): number {
    return this.analysisCache.size;
  }

  /** Check if any changes exist across all analyzed domains. */
  hasChanges(): boolean {
    let found = false;
    this.analysisCache.forEach((analysis) => {
      if (!found && analysis.changes.some((c) => c.changeType !== 'unchanged')) {
        found = true;
      }
    });
    return found;
  }
}
