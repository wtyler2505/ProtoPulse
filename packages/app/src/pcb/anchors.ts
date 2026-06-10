import { parsePortRef } from '@protopulse/graph';
import { padWorldPosition } from '@protopulse/renderer';

import { footprintOf } from './tools.js';

import type { PadSource } from './tools.js';
import type { Anchor } from '@protopulse/erc';
import type { DesignGraph, Vec } from '@protopulse/graph';
import type { PcbViewLike } from '@protopulse/renderer';

/**
 * Anchor focusing for the PCB canvas (DRC panel): findings carry the
 * ERC Anchor shape; on the board a net anchor lights up its copper
 * (traces + vias) and a component anchor its footprint.
 */

export function pcbAnchorIds(view: PcbViewLike, anchor: Anchor): string[] {
  switch (anchor.kind) {
    case 'component':
      return [anchor.componentId];
    case 'port':
      return [parsePortRef(anchor.port).componentId];
    case 'net': {
      const ids: string[] = [anchor.netId];
      for (const [traceId, trace] of view.traces) {
        if (trace.netId === anchor.netId) ids.push(traceId);
      }
      for (const [viaId, via] of view.vias) {
        if (via.netId === anchor.netId) ids.push(viaId);
      }
      return ids;
    }
  }
}

export function pcbAnchorPosition(
  graph: DesignGraph,
  view: PcbViewLike,
  parts: PadSource,
  anchor: Anchor,
): Vec | null {
  switch (anchor.kind) {
    case 'component':
      return view.placements.get(anchor.componentId)?.at ?? null;
    case 'port': {
      const { componentId, pinKey } = parsePortRef(anchor.port);
      const placement = view.placements.get(componentId);
      if (!placement) return null;
      const footprint = footprintOf(graph, parts, componentId);
      if (footprint) {
        const at = padWorldPosition(footprint, placement, pinKey);
        if (at) return at;
      }
      return placement.at;
    }
    case 'net': {
      for (const trace of view.traces.values()) {
        if (trace.netId === anchor.netId && trace.path[0]) return trace.path[0];
      }
      for (const via of view.vias.values()) {
        if (via.netId === anchor.netId) return via.at;
      }
      // Fall back to the first placed component carrying a net port.
      const net = graph.nets.get(anchor.netId);
      for (const port of net?.ports ?? []) {
        const { componentId } = parsePortRef(port);
        const placement = view.placements.get(componentId);
        if (placement) return placement.at;
      }
      return null;
    }
  }
}
