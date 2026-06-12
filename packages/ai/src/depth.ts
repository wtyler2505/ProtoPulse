/**
 * The teaching-depth dial — Vol III's "depth-adjustable" contract shared
 * by every persona that narrates its actions. Three positions:
 *
 *   do-it    — silent hands: no narration at all.
 *   show-me  — narrate what happened (the tool's explain() line).
 *   teach-me — narrate AND signal that a concept pause is wanted; the
 *              host decides what a pause looks like (open the article,
 *              hold the loop, …).
 */

export type TeachingDepth = 'do-it' | 'show-me' | 'teach-me';

export const TEACHING_DEPTHS: readonly TeachingDepth[] = ['do-it', 'show-me', 'teach-me'];

/**
 * Marker appended to teach-me narration: the surface that renders the
 * line strips it and treats its presence as "open the relevant concept".
 */
export const CONCEPT_PAUSE_MARKER = '[concept-pause]';

export function isTeachingDepth(value: unknown): value is TeachingDepth {
  return typeof value === 'string' && (TEACHING_DEPTHS as readonly string[]).includes(value);
}

/**
 * Route a one-line explanation through the depth dial.
 * do-it → null (say nothing); show-me → the explain line as-is;
 * teach-me → the explain line plus the concept-pause marker.
 */
export function narrationFor(depth: TeachingDepth, explain: string): string | null {
  switch (depth) {
    case 'do-it':
      return null;
    case 'show-me':
      return explain;
    case 'teach-me':
      return `${explain} ${CONCEPT_PAUSE_MARKER}`;
  }
}

/** True when a narration line carries the teach-me concept-pause marker. */
export function wantsConceptPause(narration: string): boolean {
  return narration.includes(CONCEPT_PAUSE_MARKER);
}

/** Strip the concept-pause marker for surfaces that render the line. */
export function stripConceptPause(narration: string): string {
  return narration.replaceAll(CONCEPT_PAUSE_MARKER, '').replace(/\s+$/, '');
}
