import { compareFindings } from '@protopulse/erc';

import type { Finding } from '@protopulse/erc';

/**
 * Review report shapes — Vol II §G.4. A review is the ERC findings plus
 * design-level checks, rolled into a versioned, diffable document. The
 * deck is versioned content: bump DECK_REV when a check changes meaning.
 */

/** The versioned review deck. */
export const DECK_REV = '1';

/** An ERC-shaped finding tagged with the review check that produced it. */
export interface ReviewFinding extends Finding {
  /** Check id: 'erc', 'decoupling', 'power-tree', … */
  check: string;
}

export interface ReviewReport {
  tool: 'protopulse-review';
  /** Deck name; 'builtin' when no deck was supplied. */
  deck: string;
  deckRev: string;
  /** Injected by the caller — the report itself stays deterministic. */
  date: string;
  designId?: string;
  branch?: string;
  counts: { error: number; warn: number; info: number };
  findings: ReviewFinding[];
}

/** ERC's deterministic order (severity, code, anchors), then check id. */
export function compareReviewFindings(a: ReviewFinding, b: ReviewFinding): number {
  const base = compareFindings(a, b);
  if (base !== 0) return base;
  return a.check < b.check ? -1 : a.check > b.check ? 1 : 0;
}
