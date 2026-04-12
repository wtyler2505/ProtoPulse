/**
 * BOM diff/comparison engine (EN-21).
 *
 * Compares two BOM item sets (baseline vs current) by matching on `partNumber`.
 * Produces a structured diff showing added, removed, and modified items with
 * field-level change detail and cost delta summary.
 */

import type { BomItem } from './types/bom-compat';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single field-level change within a modified BOM item. */
export interface BomFieldChange {
  field: string;
  oldValue: string | number | null;
  newValue: string | number | null;
}

/** A BOM item that exists only in the current set. */
export interface BomDiffAdded {
  type: 'added';
  partNumber: string;
  current: BomItem;
}

/** A BOM item that exists only in the baseline set. */
export interface BomDiffRemoved {
  type: 'removed';
  partNumber: string;
  baseline: BomItem;
}

/** A BOM item present in both sets with at least one field changed. */
export interface BomDiffModified {
  type: 'modified';
  partNumber: string;
  baseline: BomItem;
  current: BomItem;
  changes: BomFieldChange[];
}

export type BomDiffEntry = BomDiffAdded | BomDiffRemoved | BomDiffModified;

export interface BomDiffSummary {
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
  totalChanges: number;
  /** Cost delta = (sum of current totalPrices) - (sum of baseline totalPrices). */
  costDelta: number;
  baselineTotalCost: number;
  currentTotalCost: number;
}

export interface BomDiffResult {
  entries: BomDiffEntry[];
  summary: BomDiffSummary;
}

// ---------------------------------------------------------------------------
// Tracked fields — these are the BOM fields we compare for modifications.
// ---------------------------------------------------------------------------

/** Keys of BomItem that hold comparable string/number/null values. */
type ComparableBomKey = 'manufacturer' | 'description' | 'quantity' | 'unitPrice' | 'totalPrice' | 'supplier' | 'stock' | 'status' | 'leadTime';

interface TrackedField {
  key: ComparableBomKey;
  label: string;
}

const TRACKED_FIELDS: TrackedField[] = [
  { key: 'manufacturer', label: 'Manufacturer' },
  { key: 'description', label: 'Description' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'unitPrice', label: 'Unit Price' },
  { key: 'totalPrice', label: 'Total Price' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'stock', label: 'Stock' },
  { key: 'status', label: 'Status' },
  { key: 'leadTime', label: 'Lead Time' },
];

// ---------------------------------------------------------------------------
// Core diff function
// ---------------------------------------------------------------------------

/**
 * Compute a structured diff between a baseline BOM and a current BOM.
 * Items are matched by `partNumber` (case-sensitive).
 */
export function computeBomDiff(baseline: BomItem[], current: BomItem[]): BomDiffResult {
  const baselineMap = new Map<string, BomItem>();
  for (const item of baseline) {
    baselineMap.set(item.partNumber, item);
  }

  const currentMap = new Map<string, BomItem>();
  for (const item of current) {
    currentMap.set(item.partNumber, item);
  }

  const entries: BomDiffEntry[] = [];

  // Find added and modified items
  for (const [partNumber, currentItem] of Array.from(currentMap)) {
    const baselineItem = baselineMap.get(partNumber);

    if (!baselineItem) {
      entries.push({ type: 'added', partNumber, current: currentItem });
      continue;
    }

    // Check for field-level changes
    const changes: BomFieldChange[] = [];
    for (const { key, label } of TRACKED_FIELDS) {
      const oldVal: string | number | null = baselineItem[key] ?? null;
      const newVal: string | number | null = currentItem[key] ?? null;
      if (String(oldVal) !== String(newVal)) {
        changes.push({ field: label, oldValue: oldVal, newValue: newVal });
      }
    }

    if (changes.length > 0) {
      entries.push({ type: 'modified', partNumber, baseline: baselineItem, current: currentItem, changes });
    }
  }

  // Find removed items
  for (const [partNumber, baselineItem] of Array.from(baselineMap)) {
    if (!currentMap.has(partNumber)) {
      entries.push({ type: 'removed', partNumber, baseline: baselineItem });
    }
  }

  // Sort: removed first, then modified, then added — each group sorted by partNumber
  const ORDER: Record<BomDiffEntry['type'], number> = { removed: 0, modified: 1, added: 2 };
  entries.sort((a, b) => {
    const typeOrder = ORDER[a.type] - ORDER[b.type];
    if (typeOrder !== 0) { return typeOrder; }
    return a.partNumber.localeCompare(b.partNumber);
  });

  // Compute summary
  const addedCount = entries.filter((e) => e.type === 'added').length;
  const removedCount = entries.filter((e) => e.type === 'removed').length;
  const modifiedCount = entries.filter((e) => e.type === 'modified').length;

  const baselineTotalCost = baseline.reduce((sum, item) => sum + parseFloat(String(item.totalPrice ?? '0')), 0);
  const currentTotalCost = current.reduce((sum, item) => sum + parseFloat(String(item.totalPrice ?? '0')), 0);

  return {
    entries,
    summary: {
      addedCount,
      removedCount,
      modifiedCount,
      totalChanges: addedCount + removedCount + modifiedCount,
      costDelta: currentTotalCost - baselineTotalCost,
      baselineTotalCost,
      currentTotalCost,
    },
  };
}
