import { narrationFor, stripConceptPause, wantsConceptPause } from '@protopulse/ai';

import { useUi } from './ui.js';

import type { TeachingDepth } from '@protopulse/ai';

/**
 * The Draftsman explain/narration contract, app side: wherever the app
 * applies AI or fix ops, the one-line summary routes through the depth
 * dial (narrationFor). do-it stays silent; show-me flashes the line on
 * the status bar; teach-me flashes AND pauses on the relevant concept
 * article when one is known.
 */

export interface NarrationPlan {
  /** Line for the status-bar flash, or null for silence (do-it). */
  flash: string | null;
  /** Concept slug to open as the teach-me pause, or null. */
  openConcept: string | null;
}

/** Pure core — node-testable without a store. */
export function narrationPlan(
  depth: TeachingDepth,
  explain: string,
  conceptSlug?: string,
): NarrationPlan {
  const line = narrationFor(depth, explain);
  if (line === null) return { flash: null, openConcept: null };
  return {
    flash: stripConceptPause(line),
    openConcept: wantsConceptPause(line) && conceptSlug !== undefined ? conceptSlug : null,
  };
}

/** Route an applied-ops summary through the CURRENT depth dial. */
export function narrateApply(explain: string, conceptSlug?: string): void {
  const ui = useUi.getState();
  const plan = narrationPlan(ui.teachingDepth, explain, conceptSlug);
  if (plan.flash !== null) ui.flashStatus(plan.flash);
  if (plan.openConcept !== null) ui.openConcept(plan.openConcept);
}
