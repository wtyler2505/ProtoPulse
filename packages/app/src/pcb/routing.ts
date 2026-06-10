import { loadDefaultDeck } from '../drc/runner.js';

/**
 * Routing bridge: the walk/shove trace modes need the rule deck's
 * min_clearance synchronously inside pointer handlers, but the deck
 * ships as lazily-globbed JSON. CanvasHost kicks the load when the PCB
 * canvas mounts; until it lands the modes refuse with a "still
 * loading" flash instead of guessing a clearance.
 */

let clearanceNm: number | null = null;
let pending: Promise<void> | null = null;

/** Deck min_clearance, or null while the deck is still loading. */
export function routingClearanceNm(): number | null {
  return clearanceNm;
}

/** Idempotent kick; a failed load resets so a later kick retries. */
export function ensureRoutingClearance(): void {
  pending ??= loadDefaultDeck()
    .then((deck) => {
      clearanceNm = deck.rules.min_clearance_nm;
    })
    .catch((err: unknown) => {
      console.warn('rule deck failed to load — walk/shove stay disabled', err);
      pending = null;
    });
}

/** Test hook. */
export function resetRoutingClearanceForTests(value: number | null = null): void {
  clearanceNm = value;
  pending = null;
}
