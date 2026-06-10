import type { ReviewAnchor } from './types.js';
import type { Anchor } from '@protopulse/erc';

/**
 * Review anchors are pinned loosely ({kind: string, ...}); the canvas
 * helpers (editor/anchors) speak ERC anchors. This narrows the review
 * shapes the panel can focus — unknown kinds simply don't focus.
 */
export function asErcAnchor(anchor: ReviewAnchor): Anchor | null {
  switch (anchor.kind) {
    case 'net':
      return typeof anchor.netId === 'string' ? { kind: 'net', netId: anchor.netId } : null;
    case 'component':
      return typeof anchor.componentId === 'string'
        ? { kind: 'component', componentId: anchor.componentId }
        : null;
    case 'port':
      return typeof anchor.port === 'string' ? { kind: 'port', port: anchor.port } : null;
    default:
      return null;
  }
}

export function asErcAnchors(anchors: ReviewAnchor[]): Anchor[] {
  return anchors.map(asErcAnchor).filter((a): a is Anchor => a !== null);
}
