/**
 * SchematicBomBridge — singleton+subscribe manager that bridges circuit
 * schematic instances to BOM entries.
 *
 * Extracts component metadata from CircuitInstance rows (via their associated
 * ComponentPart + inline properties), maps them to BOM entry drafts, aggregates
 * quantities by part identity, detects duplicates against existing BOM items,
 * and produces a sync plan describing what needs to be added/updated.
 */

import type { CircuitInstanceRow, BomItem, ComponentPart } from '@shared/schema';
import type { PartMeta } from '@shared/component-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UnmappedComponent {
  instanceId: number;
  referenceDesignator: string;
  /** Best-effort part description from instance properties or part meta. */
  description: string;
  /** Reason the component is considered unmapped. */
  reason: 'no_part' | 'no_bom_match' | 'missing_metadata';
}

export interface BomEntryDraft {
  /** Stable identity key used for aggregation — lowercase `${manufacturer}::${partNumber}`. */
  identityKey: string;
  partNumber: string;
  manufacturer: string;
  description: string;
  quantity: number;
  unitPrice: string;
  supplier: string;
  /** Reference designators contributing to this aggregated entry. */
  referenceDesignators: string[];
  /** Part family from meta (e.g. 'resistor', 'capacitor'). */
  family: string;
  /** Mounting type from meta (e.g. 'smd', 'tht'). */
  mountingType: string;
  /** Package type from meta or instance properties. */
  packageType: string;
}

export interface DuplicateMatch {
  draft: BomEntryDraft;
  existingBomItem: BomItem;
  /** How the match was determined. */
  matchType: 'exact_part_number' | 'fuzzy_description' | 'same_manufacturer_family';
  /** Suggested action. */
  suggestion: 'skip' | 'update_quantity' | 'review';
  /** If update_quantity, the new total. */
  suggestedQuantity?: number;
}

export type SyncAction =
  | { type: 'add'; draft: BomEntryDraft }
  | { type: 'update_quantity'; draft: BomEntryDraft; existingBomItem: BomItem; newQuantity: number }
  | { type: 'skip'; draft: BomEntryDraft; existingBomItem: BomItem; reason: string };

export interface SyncPlan {
  actions: SyncAction[];
  unmapped: UnmappedComponent[];
  /** Total new BOM entries to create. */
  addCount: number;
  /** Total existing BOM entries to update. */
  updateCount: number;
  /** Total entries skipped (already up to date). */
  skipCount: number;
}

type Listener = () => void;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractMeta(part: ComponentPart): Partial<PartMeta> {
  return (part.meta ?? {}) as Partial<PartMeta>;
}

function extractProps(instance: CircuitInstanceRow): Record<string, string> {
  if (!instance.properties || typeof instance.properties !== 'object') {
    return {};
  }
  const raw = instance.properties as Record<string, unknown>;
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v !== null && v !== undefined) {
      result[k] = String(v);
    }
  }
  return result;
}

function buildIdentityKey(manufacturer: string, partNumber: string): string {
  return `${manufacturer.toLowerCase().trim()}::${partNumber.toLowerCase().trim()}`;
}

/**
 * Normalize a string for fuzzy comparison: lowercase, collapse whitespace, strip punctuation.
 */
function normalizeForComparison(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// SchematicBomBridge
// ---------------------------------------------------------------------------

class SchematicBomBridge {
  private listeners = new Set<Listener>();
  private _version = 0;
  private _lastPlan: SyncPlan | null = null;

  /** Monotonic version counter for useSyncExternalStore integration. */
  get version(): number {
    return this._version;
  }

  /** Most recently computed sync plan (if any). */
  get lastPlan(): SyncPlan | null {
    return this._lastPlan;
  }

  // ---- Analysis ----

  /**
   * Identify instances that cannot be cleanly mapped to BOM entries.
   * An instance is "unmapped" if it has no associated part, or if its part
   * lacks enough metadata (partNumber or description) to form a BOM entry.
   */
  analyzeInstances(
    instances: CircuitInstanceRow[],
    partsById: Map<number, ComponentPart>,
  ): UnmappedComponent[] {
    const unmapped: UnmappedComponent[] = [];

    for (const inst of instances) {
      if (inst.partId === null || inst.partId === undefined) {
        unmapped.push({
          instanceId: inst.id,
          referenceDesignator: inst.referenceDesignator,
          description: this.descriptionFromProps(inst),
          reason: 'no_part',
        });
        continue;
      }

      const part = partsById.get(inst.partId);
      if (!part) {
        unmapped.push({
          instanceId: inst.id,
          referenceDesignator: inst.referenceDesignator,
          description: this.descriptionFromProps(inst),
          reason: 'no_part',
        });
        continue;
      }

      const meta = extractMeta(part);
      const props = extractProps(inst);
      const partNumber = props.partNumber ?? props.mpn ?? meta.mpn ?? '';
      const description = props.description ?? meta.description ?? meta.title ?? '';

      if (!partNumber && !description) {
        unmapped.push({
          instanceId: inst.id,
          referenceDesignator: inst.referenceDesignator,
          description: inst.referenceDesignator,
          reason: 'missing_metadata',
        });
      }
    }

    return unmapped;
  }

  // ---- Mapping ----

  /**
   * Map a single circuit instance (+its part) to a BomEntryDraft.
   * Returns null if the instance has no part or is unmappable.
   */
  mapToBomEntry(
    instance: CircuitInstanceRow,
    part: ComponentPart | undefined,
  ): BomEntryDraft | null {
    if (!part) {
      return null;
    }

    const meta = extractMeta(part);
    const props = extractProps(instance);

    const partNumber = props.partNumber ?? props.mpn ?? meta.mpn ?? '';
    const manufacturer = props.manufacturer ?? meta.manufacturer ?? '';
    const description = props.description ?? meta.description ?? meta.title ?? '';
    const family = meta.family ?? '';
    const mountingType = meta.mountingType ?? '';
    const packageType = props.packageType ?? meta.packageType ?? '';
    const unitPrice = props.unitPrice ?? '0';
    const supplier = props.supplier ?? '';

    // Need at least a part number or description to be useful
    if (!partNumber && !description) {
      return null;
    }

    const identityKey = partNumber
      ? buildIdentityKey(manufacturer, partNumber)
      : buildIdentityKey(manufacturer, description);

    return {
      identityKey,
      partNumber,
      manufacturer,
      description,
      quantity: 1,
      unitPrice,
      supplier,
      referenceDesignators: [instance.referenceDesignator],
      family,
      mountingType,
      packageType,
    };
  }

  // ---- Aggregation ----

  /**
   * Aggregate drafts by identity key, summing quantities and collecting
   * reference designators.
   */
  aggregateQuantities(drafts: BomEntryDraft[]): BomEntryDraft[] {
    const grouped = new Map<string, BomEntryDraft>();

    for (const draft of drafts) {
      const existing = grouped.get(draft.identityKey);
      if (existing) {
        existing.quantity += draft.quantity;
        for (const rd of draft.referenceDesignators) {
          if (!existing.referenceDesignators.includes(rd)) {
            existing.referenceDesignators.push(rd);
          }
        }
        // Prefer non-empty values
        if (!existing.unitPrice && draft.unitPrice) {
          existing.unitPrice = draft.unitPrice;
        }
        if (!existing.supplier && draft.supplier) {
          existing.supplier = draft.supplier;
        }
      } else {
        grouped.set(draft.identityKey, {
          ...draft,
          referenceDesignators: [...draft.referenceDesignators],
        });
      }
    }

    return Array.from(grouped.values());
  }

  // ---- Duplicate Detection ----

  /**
   * Compare drafts against existing BOM items and identify potential duplicates.
   */
  detectDuplicates(drafts: BomEntryDraft[], existingBom: BomItem[]): DuplicateMatch[] {
    const matches: DuplicateMatch[] = [];

    for (const draft of drafts) {
      // 1. Exact part number match
      if (draft.partNumber) {
        const exactMatch = existingBom.find(
          (bom) => bom.partNumber.toLowerCase().trim() === draft.partNumber.toLowerCase().trim(),
        );
        if (exactMatch) {
          const currentQty = exactMatch.quantity;
          const newQty = currentQty + draft.quantity;
          matches.push({
            draft,
            existingBomItem: exactMatch,
            matchType: 'exact_part_number',
            suggestion: currentQty >= draft.quantity ? 'skip' : 'update_quantity',
            suggestedQuantity: newQty,
          });
          continue;
        }
      }

      // 2. Same manufacturer + family match
      if (draft.manufacturer && draft.family) {
        const famMatch = existingBom.find(
          (bom) =>
            bom.manufacturer.toLowerCase().trim() === draft.manufacturer.toLowerCase().trim() &&
            normalizeForComparison(bom.description).includes(normalizeForComparison(draft.family)),
        );
        if (famMatch) {
          matches.push({
            draft,
            existingBomItem: famMatch,
            matchType: 'same_manufacturer_family',
            suggestion: 'review',
          });
          continue;
        }
      }

      // 3. Fuzzy description match
      if (draft.description) {
        const normDraftDesc = normalizeForComparison(draft.description);
        if (normDraftDesc.length >= 3) {
          const fuzzyMatch = existingBom.find((bom) => {
            const normBomDesc = normalizeForComparison(bom.description);
            return normBomDesc === normDraftDesc || normBomDesc.includes(normDraftDesc) || normDraftDesc.includes(normBomDesc);
          });
          if (fuzzyMatch) {
            matches.push({
              draft,
              existingBomItem: fuzzyMatch,
              matchType: 'fuzzy_description',
              suggestion: 'review',
            });
            continue;
          }
        }
      }
    }

    return matches;
  }

  // ---- Sync Plan ----

  /**
   * Generate a full sync plan: analyze instances, map to drafts, aggregate,
   * detect duplicates, and produce a set of actions.
   */
  generateSyncPlan(
    instances: CircuitInstanceRow[],
    partsById: Map<number, ComponentPart>,
    existingBom: BomItem[],
  ): SyncPlan {
    // Step 1: Identify unmapped components
    const unmapped = this.analyzeInstances(instances, partsById);
    const unmappedIds = new Set(unmapped.map((u) => u.instanceId));

    // Step 2: Map mappable instances to drafts
    const rawDrafts: BomEntryDraft[] = [];
    for (const inst of instances) {
      if (unmappedIds.has(inst.id)) {
        continue;
      }
      const part = inst.partId !== null && inst.partId !== undefined
        ? partsById.get(inst.partId)
        : undefined;
      const draft = this.mapToBomEntry(inst, part);
      if (draft) {
        rawDrafts.push(draft);
      }
    }

    // Step 3: Aggregate by identity
    const aggregated = this.aggregateQuantities(rawDrafts);

    // Step 4: Detect duplicates
    const duplicates = this.detectDuplicates(aggregated, existingBom);
    const duplicateKeys = new Set(duplicates.map((d) => d.draft.identityKey));

    // Step 5: Build actions
    const actions: SyncAction[] = [];

    // New entries (no duplicate)
    for (const draft of aggregated) {
      if (!duplicateKeys.has(draft.identityKey)) {
        actions.push({ type: 'add', draft });
      }
    }

    // Duplicate-based actions
    for (const dup of duplicates) {
      if (dup.suggestion === 'update_quantity' && dup.suggestedQuantity !== undefined) {
        actions.push({
          type: 'update_quantity',
          draft: dup.draft,
          existingBomItem: dup.existingBomItem,
          newQuantity: dup.suggestedQuantity,
        });
      } else if (dup.suggestion === 'skip') {
        actions.push({
          type: 'skip',
          draft: dup.draft,
          existingBomItem: dup.existingBomItem,
          reason: 'Already exists in BOM with sufficient quantity',
        });
      } else {
        // 'review' → treat as add (user will decide in UI)
        actions.push({ type: 'add', draft: dup.draft });
      }
    }

    const plan: SyncPlan = {
      actions,
      unmapped,
      addCount: actions.filter((a) => a.type === 'add').length,
      updateCount: actions.filter((a) => a.type === 'update_quantity').length,
      skipCount: actions.filter((a) => a.type === 'skip').length,
    };

    this._lastPlan = plan;
    this._version++;
    this.notify();

    return plan;
  }

  // ---- Subscribe pattern ----

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Get a snapshot value for useSyncExternalStore. */
  getSnapshot(): number {
    return this._version;
  }

  /** Reset internal state. */
  reset(): void {
    this._lastPlan = null;
    this._version++;
    this.notify();
  }

  // ---- Internal ----

  private notify(): void {
    for (const listener of Array.from(this.listeners)) {
      listener();
    }
  }

  private descriptionFromProps(inst: CircuitInstanceRow): string {
    const props = extractProps(inst);
    return props.description ?? props.componentType ?? inst.referenceDesignator;
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const schematicBomBridge = new SchematicBomBridge();
