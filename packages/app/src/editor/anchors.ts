import { parsePortRef } from '@protopulse/graph';
import { pinWorldPosition } from '@protopulse/renderer';

import { partDb } from '../state/session.js';

import type { Anchor } from '@protopulse/erc';
import type { DesignGraph, Vec } from '@protopulse/graph';

/**
 * Anchor focusing, shared by every findings surface (ERC panel, Review
 * panel): anchors → selectable node ids, and anchors → a world position
 * for the camera to center on.
 */

export function anchorIds(anchor: Anchor): string[] {
  switch (anchor.kind) {
    case 'net':
      return [anchor.netId];
    case 'component':
      return [anchor.componentId];
    case 'port':
      return [parsePortRef(anchor.port).componentId];
  }
}

export function anchorPosition(graph: DesignGraph, anchor: Anchor): Vec | null {
  switch (anchor.kind) {
    case 'component':
      return graph.schematic.placements.get(anchor.componentId)?.at ?? null;
    case 'port': {
      const { componentId, pinKey } = parsePortRef(anchor.port);
      const placement = graph.schematic.placements.get(componentId);
      const comp = graph.components.get(componentId);
      if (!placement || !comp) return null;
      const part = partDb.get(comp.partId, comp.partRev);
      if (!part) return placement.at;
      try {
        return pinWorldPosition(part, placement, pinKey);
      } catch {
        return placement.at;
      }
    }
    case 'net': {
      const net = graph.nets.get(anchor.netId);
      const firstPort = net?.ports[0];
      if (firstPort) return anchorPosition(graph, { kind: 'port', port: firstPort });
      return null;
    }
  }
}
