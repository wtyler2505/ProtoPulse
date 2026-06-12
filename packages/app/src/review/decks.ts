import { z } from 'zod';

import type { ReviewDeckLike } from './types.js';

/**
 * Review decks for the panel's deck picker: rev-stamped JSON files in
 * content/review-decks, bundled by glob like the rule decks and the
 * sourcing catalog. Validated here (mirror of @protopulse/content's
 * ReviewDeckSchema — that package is a node loader; the browser bundle
 * validates its own copy).
 */

const deckSchema = z.object({
  deck: z.string().min(1),
  rev: z.string().min(1),
  checks: z.record(
    z.string().min(1),
    z.object({
      enabled: z.boolean().optional(),
      severity: z.enum(['error', 'warn', 'info']).optional(),
    }),
  ),
});

const deckFiles = import.meta.glob('../../../../content/review-decks/*.json', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>;

/** All bundled decks, sorted by name. A malformed deck file is a build
 *  problem, not a user problem — it throws rather than being skipped. */
export async function loadReviewDecks(): Promise<ReviewDeckLike[]> {
  const decks: ReviewDeckLike[] = [];
  for (const load of Object.values(deckFiles)) {
    decks.push(deckSchema.parse(JSON.parse(await load())));
  }
  return decks.sort((a, b) => a.deck.localeCompare(b.deck));
}
