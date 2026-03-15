/**
 * Schematic Alternates — BL-0540
 *
 * Bridges the AlternatePartsEngine with schematic circuit instances.
 * Given circuit instances and their associated component parts, this module
 * resolves how many alternate parts exist for each instance and provides
 * lookup helpers consumed by the AlternatePartsPopover UI.
 */

import { useMemo } from 'react';
import {
  AlternatePartsEngine,
  type AlternatePart,
  type CrossReferenceResult,
  type PartReference,
} from '@/lib/alternate-parts';
import type { CircuitInstanceRow, ComponentPart } from '@shared/schema';
import type { PartMeta } from '@shared/component-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InstanceAlternateInfo {
  instanceId: number;
  referenceDesignator: string;
  partNumber: string;
  manufacturer: string;
  alternateCount: number;
  result: CrossReferenceResult | null;
}

// ---------------------------------------------------------------------------
// Core lookup
// ---------------------------------------------------------------------------

/**
 * For a single circuit instance, look up its part number from the associated
 * ComponentPart's meta, then query the AlternatePartsEngine.
 */
export function findAlternatesForInstance(
  instance: CircuitInstanceRow,
  part: ComponentPart | undefined,
): InstanceAlternateInfo {
  const meta = (part?.meta ?? {}) as Partial<PartMeta>;
  const partNumber = meta.mpn ?? '';
  const manufacturer = meta.manufacturer ?? '';

  if (!partNumber) {
    return {
      instanceId: instance.id,
      referenceDesignator: instance.referenceDesignator,
      partNumber: '',
      manufacturer: '',
      alternateCount: 0,
      result: null,
    };
  }

  const engine = AlternatePartsEngine.getInstance();
  const result = engine.findAlternates(partNumber, { maxResults: 10 });

  return {
    instanceId: instance.id,
    referenceDesignator: instance.referenceDesignator,
    partNumber,
    manufacturer,
    alternateCount: result.alternates.length,
    result,
  };
}

/**
 * Batch-lookup alternates for all instances in a schematic.
 * Returns a Map keyed by instance ID for O(1) lookup from the canvas.
 */
export function findAlternatesForAllInstances(
  instances: CircuitInstanceRow[],
  partsMap: Map<number, ComponentPart>,
): Map<number, InstanceAlternateInfo> {
  const map = new Map<number, InstanceAlternateInfo>();

  for (const inst of instances) {
    const part = inst.partId != null ? partsMap.get(inst.partId) : undefined;
    const info = findAlternatesForInstance(inst, part);
    if (info.alternateCount > 0) {
      map.set(inst.id, info);
    }
  }

  return map;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Format a price value for display. Returns '--' when undefined. */
export function formatPrice(price: number | undefined): string {
  if (price === undefined) {
    return '--';
  }
  return `$${price.toFixed(3)}`;
}

/** Equivalence level → human-readable label */
export function equivalenceLevelLabel(level: AlternatePart['equivalenceLevel']): string {
  switch (level) {
    case 'exact':
      return 'Exact';
    case 'functional':
      return 'Functional';
    case 'pin-compatible':
      return 'Pin-compatible';
    case 'similar':
      return 'Similar';
    case 'upgrade':
      return 'Upgrade';
  }
}

/** Equivalence level → Tailwind CSS color class */
export function equivalenceLevelColor(level: AlternatePart['equivalenceLevel']): string {
  switch (level) {
    case 'exact':
      return 'text-green-400';
    case 'functional':
      return 'text-blue-400';
    case 'pin-compatible':
      return 'text-cyan-400';
    case 'similar':
      return 'text-yellow-400';
    case 'upgrade':
      return 'text-purple-400';
  }
}

/** Confidence → badge variant color */
export function confidenceColor(confidence: AlternatePart['confidence']): string {
  switch (confidence) {
    case 'high':
      return 'text-green-400';
    case 'medium':
      return 'text-yellow-400';
    case 'low':
      return 'text-red-400';
  }
}

/** Part status → badge color */
export function statusColor(status: PartReference['status']): string {
  switch (status) {
    case 'active':
      return 'text-green-400';
    case 'nrnd':
      return 'text-yellow-400';
    case 'eol':
      return 'text-orange-400';
    case 'obsolete':
      return 'text-red-400';
    case 'unknown':
      return 'text-muted-foreground';
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook that computes alternate part info for all instances in a schematic.
 * Memoized — recalculates only when instances or parts change.
 */
export function useSchematicAlternates(
  instances: CircuitInstanceRow[] | undefined,
  partsMap: Map<number, ComponentPart>,
): Map<number, InstanceAlternateInfo> {
  return useMemo(() => {
    if (!instances || instances.length === 0) {
      return new Map<number, InstanceAlternateInfo>();
    }
    return findAlternatesForAllInstances(instances, partsMap);
  }, [instances, partsMap]);
}
