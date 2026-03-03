import Fuse from 'fuse.js';
import type { IFuseOptions, FuseOptionKey, FuseResultMatch } from 'fuse.js';

/**
 * Default Fuse.js options tuned for EDA component search.
 *
 * - threshold 0.4: allows reasonable typos ("arduno" → "Arduino")
 * - distance 100: matches can be spread across the string
 * - includeScore + includeMatches: needed for ranking and highlight rendering
 * - minMatchCharLength 2: avoids noisy single-char matches
 */
export const COMPONENT_SEARCH_OPTIONS: IFuseOptions<unknown> = {
  threshold: 0.4,
  distance: 100,
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 2,
  shouldSort: true,
  findAllMatches: true,
  ignoreLocation: false,
};

/**
 * Creates a configured Fuse instance for fuzzy-searching items by the given keys.
 *
 * @example
 * ```ts
 * const fuse = createComponentSearch(nodes, ['data.label', 'data.type']);
 * const results = fuse.search('arduno');
 * ```
 */
export function createComponentSearch<T>(
  items: readonly T[],
  keys: FuseOptionKey<T>[],
): Fuse<T> {
  return new Fuse([...items], {
    ...COMPONENT_SEARCH_OPTIONS,
    keys,
  } as IFuseOptions<T>);
}

/** A segment of text with a flag indicating whether it matched the search query. */
export interface HighlightSegment {
  text: string;
  isMatch: boolean;
}

/**
 * Converts Fuse.js match indices into an array of text segments suitable
 * for rendering highlighted search results.
 *
 * @param text    - The original full string.
 * @param matches - Fuse.js match metadata for the specific field.
 * @returns An array of segments. Segments with `isMatch: true` should be
 *          rendered with visual emphasis (e.g. neon cyan highlight).
 */
export function highlightMatches(
  text: string,
  matches: readonly FuseResultMatch[] | undefined,
): HighlightSegment[] {
  if (!matches || matches.length === 0) {
    return [{ text, isMatch: false }];
  }

  // Collect all match index ranges across all match entries for this text
  const ranges: Array<[number, number]> = [];
  for (const match of matches) {
    if (match.indices) {
      for (const [start, end] of match.indices) {
        ranges.push([start, end]);
      }
    }
  }

  if (ranges.length === 0) {
    return [{ text, isMatch: false }];
  }

  // Sort by start position and merge overlapping ranges
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [ranges[0]];
  for (let i = 1; i < ranges.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = ranges[i];
    if (curr[0] <= prev[1] + 1) {
      prev[1] = Math.max(prev[1], curr[1]);
    } else {
      merged.push(curr);
    }
  }

  // Build segments
  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (cursor < start) {
      segments.push({ text: text.slice(cursor, start), isMatch: false });
    }
    segments.push({ text: text.slice(start, end + 1), isMatch: true });
    cursor = end + 1;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), isMatch: false });
  }

  return segments;
}
