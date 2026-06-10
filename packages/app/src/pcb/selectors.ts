import type { DesignGraph, Uuid } from '@protopulse/graph';
import type { PcbFootprintSpec, PcbViewLike } from '@protopulse/renderer';

/**
 * Pure selectors for the PCB view's side surfaces (unplaced tray).
 */

export interface NamedPadSource {
  get(partId: string, rev: number): { name: string; footprint?: PcbFootprintSpec } | undefined;
}

export interface TrayEntry {
  componentId: Uuid;
  ref: string;
  partName: string;
  /** Without footprint geometry the part can't be placed (tray flags it). */
  hasFootprint: boolean;
}

/**
 * Components that are on the schematic but not on the board yet —
 * sorted by ref so the tray reads like a BOM.
 */
export function unplacedPcbComponents(
  graph: DesignGraph,
  view: PcbViewLike,
  parts: NamedPadSource,
): TrayEntry[] {
  const entries: TrayEntry[] = [];
  for (const [componentId] of graph.schematic.placements) {
    if (view.placements.has(componentId)) continue;
    const comp = graph.components.get(componentId);
    if (!comp) continue;
    const part = parts.get(comp.partId, comp.partRev);
    entries.push({
      componentId,
      ref: comp.ref,
      partName: part?.name ?? comp.partId,
      hasFootprint: Boolean(part?.footprint),
    });
  }
  entries.sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0));
  return entries;
}
