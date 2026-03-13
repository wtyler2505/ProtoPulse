/**
 * Client-side reference designator helpers.
 * Core logic lives in shared/ref-des.ts — this module provides a
 * component-part-aware wrapper that extracts meta from ComponentPart.
 */
import type { CircuitInstanceRow, ComponentPart } from '@shared/schema';
import type { PartMeta } from '@shared/component-types';
import { FAMILY_PREFIX, getRefDesPrefix as _getRefDesPrefix, nextRefdes } from '@shared/ref-des';

export { FAMILY_PREFIX, nextRefdes };

/** Derives the refdes prefix from a ComponentPart (extracts meta internally). */
export function getRefDesPrefix(part: ComponentPart | undefined): string {
  if (!part) { return 'X'; }
  const meta = (part.meta ?? {}) as Partial<PartMeta>;
  return _getRefDesPrefix({ family: meta.family, tags: meta.tags });
}

/**
 * Generate the next available reference designator for a given part,
 * scanning existing instances in the circuit.
 */
export function generateRefDes(
  existingInstances: CircuitInstanceRow[] | undefined,
  part: ComponentPart | undefined,
): string {
  const prefix = getRefDesPrefix(part);
  const existingRefdes = (existingInstances ?? []).map((inst) => inst.referenceDesignator);
  return nextRefdes(prefix, existingRefdes);
}
