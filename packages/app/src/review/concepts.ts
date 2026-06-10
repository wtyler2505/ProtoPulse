import { conceptFor } from '@protopulse/erc';

import type { CodeInfo } from '@protopulse/erc';

/**
 * Review-code → concepts-wiki mapping. ERC-* codes resolve through the
 * erc package's own conceptFor; REV-* codes get the panel's own map,
 * pinned against the @protopulse/review deck (parallel track) and the
 * articles that exist in content/concepts today. Codes the deck grows
 * later simply render without a concept chip until mapped here.
 */

export const REV_CODES: Record<string, CodeInfo> = {
  'REV-NO-DECOUPLING': { title: 'Missing decoupling', conceptSlug: 'power-and-heat' },
  'REV-POWER-BUDGET': { title: 'Power budget exceeded', conceptSlug: 'power-and-heat' },
  'REV-LED-NO-RESISTOR': { title: 'LED without series resistor', conceptSlug: 'ohms-law-in-practice' },
  'REV-PULLUP-VALUE': { title: 'Questionable pull-up value', conceptSlug: 'pull-up-pull-down' },
  'REV-FLOATING-NODE': { title: 'Floating node', conceptSlug: 'floating-inputs' },
  'REV-TOLERANCE-STACK': { title: 'Tolerance stack-up', conceptSlug: 'tolerance-stacking' },
  'REV-GROUND-TOPOLOGY': { title: 'Ground topology', conceptSlug: 'ground-three-meanings' },
  'REV-VALUE-NOTATION': { title: 'Ambiguous value notation', conceptSlug: 'si-prefixes-4k7' },
  'REV-DATASHEET-DEVIATION': { title: 'Deviates from the datasheet', conceptSlug: 'reading-a-datasheet' },
};

/** Concept info for any finding code the panel may see (ERC-* or REV-*). */
export function reviewConceptFor(code: string): CodeInfo | undefined {
  return conceptFor(code) ?? REV_CODES[code];
}

/** Finding code → concept slug; the shape the Professor's tools inject. */
export function codeToConceptSlug(code: string): string | undefined {
  return reviewConceptFor(code)?.conceptSlug;
}
