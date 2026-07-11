import { fabDeckFile, loadDefaultDeck } from '../drc/runner.js';

/**
 * Routing bridge: the walk/shove trace modes need the rule deck's
 * min_clearance synchronously inside pointer handlers, but the deck
 * ships as lazily-globbed JSON. CanvasHost kicks the load when the PCB
 * canvas mounts; until it lands the modes refuse with a "still
 * loading" flash instead of guessing a clearance.
 *
 * The clearance is pinned to the SELECTED fab deck: switching fabs in
 * the DRC panel invalidates it, the next frame re-kicks the load, and
 * the canvas re-pours zones at the new clearance — routing and DRC can
 * never answer to different fabs.
 */

let clearanceNm: number | null = null;
let maskExpansionNm: number | null = null;
let loadedFor: string | null = null;
let pending: Promise<void> | null = null;

/** SELECTED deck's min_clearance, or null while it is (re)loading. */
export function routingClearanceNm(): number | null {
  return loadedFor === fabDeckFile() ? clearanceNm : null;
}

/** SELECTED deck's mask_expansion_nm (soldermask radial clearance per
 *  side around pads/vias), or null while it is (re)loading — same
 *  pinned-to-selected-deck contract as routingClearanceNm. */
export function routingMaskExpansionNm(): number | null {
  return loadedFor === fabDeckFile() ? maskExpansionNm : null;
}

/** Idempotent kick; a failed load (or a fab switch) retries. */
export function ensureRoutingClearance(): void {
  const file = fabDeckFile();
  if (loadedFor === file && clearanceNm !== null) return;
  if (pending !== null) return;
  pending = loadDefaultDeck()
    .then((deck) => {
      clearanceNm = deck.rules.min_clearance_nm;
      maskExpansionNm = deck.rules.mask_expansion_nm;
      loadedFor = file;
      pending = null;
    })
    .catch((err: unknown) => {
      console.warn('rule deck failed to load — walk/shove stay disabled', err);
      pending = null;
    });
}

/** Test hook. */
export function resetRoutingClearanceForTests(value: number | null = null, maskValue: number | null = null): void {
  clearanceNm = value;
  maskExpansionNm = maskValue;
  loadedFor = value === null ? null : fabDeckFile();
  pending = null;
}
