import { STANDARD_LIBRARY_COMPONENTS } from '@shared/standard-library';
import type { StandardComponentDef } from '@shared/standard-library';
import { createComponentSearch } from './fuzzy-search';
import type { FuseResult, FuseResultMatch } from 'fuse.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LibrarySuggestion {
  /** The matched standard library component definition. */
  libraryPart: StandardComponentDef;
  /**
   * Match quality score in [0, 1] where 1 is a perfect match.
   * Derived from the Fuse.js score (inverted: Fuse uses 0 = perfect).
   */
  matchScore: number;
  /** Human-readable explanation of why this matched. */
  matchReason: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum match score (after inversion) to include in results. */
const MIN_SCORE = 0.3;

/** Maximum suggestions returned per query. */
const MAX_SUGGESTIONS = 3;

// ---------------------------------------------------------------------------
// Searchable wrapper — includes flattened fields for Fuse
// ---------------------------------------------------------------------------

interface SearchableComponent {
  title: string;
  category: string;
  tags: string;
  description: string;
  /** Original component definition, for lookup after search. */
  _def: StandardComponentDef;
}

function buildSearchableList(): SearchableComponent[] {
  return STANDARD_LIBRARY_COMPONENTS.map((def) => ({
    title: def.title,
    category: def.category,
    tags: def.tags.join(' '),
    description: def.description,
    _def: def,
  }));
}

// ---------------------------------------------------------------------------
// Lazy-initialized Fuse index (shared across calls within the same session)
// ---------------------------------------------------------------------------

let searchableList: SearchableComponent[] | null = null;
let fuseInstance: Fuse<SearchableComponent> | null = null;

function getFuse(): Fuse<SearchableComponent> {
  if (!fuseInstance) {
    searchableList = buildSearchableList();
    fuseInstance = createComponentSearch(searchableList, [
      { name: 'title', weight: 2 },
      { name: 'tags', weight: 1.5 },
      { name: 'category', weight: 1 },
      { name: 'description', weight: 0.5 },
    ]);
  }
  return fuseInstance;
}

// ---------------------------------------------------------------------------
// Match reason builder
// ---------------------------------------------------------------------------

function buildMatchReason(
  result: Fuse.FuseResult<SearchableComponent>,
  query: string,
): string {
  const matchedKeys = result.matches?.map((m) => m.key).filter(Boolean) ?? [];
  const part = result.item.title;

  if (matchedKeys.includes('title')) {
    return `"${query}" matches component name "${part}"`;
  }
  if (matchedKeys.includes('tags')) {
    return `"${query}" matches tags of "${part}"`;
  }
  if (matchedKeys.includes('category')) {
    return `"${query}" matches category of "${part}"`;
  }
  if (matchedKeys.includes('description')) {
    return `"${query}" matches description of "${part}"`;
  }
  return `"${query}" is similar to "${part}"`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fuzzy-match a node label and/or type against the ProtoPulse standard
 * component library and return the top matching suggestions.
 *
 * @param nodeLabel - The label the user gave the architecture node (e.g. "ESP32", "motor driver").
 * @param nodeType  - Optional node type string (e.g. "mcu", "sensor").
 * @returns Up to {@link MAX_SUGGESTIONS} suggestions sorted by descending match score,
 *          each above the {@link MIN_SCORE} threshold.
 */
export function suggestFromLibrary(
  nodeLabel: string,
  nodeType: string = '',
): LibrarySuggestion[] {
  const query = [nodeLabel, nodeType].filter(Boolean).join(' ').trim();
  if (query.length < 2) {
    return [];
  }

  const fuse = getFuse();
  const results = fuse.search(query);

  const suggestions: LibrarySuggestion[] = [];

  for (const result of results) {
    // Fuse score: 0 = perfect, 1 = worst. Invert so 1 = perfect.
    const matchScore = 1 - (result.score ?? 1);
    if (matchScore < MIN_SCORE) {
      continue;
    }

    suggestions.push({
      libraryPart: result.item._def,
      matchScore,
      matchReason: buildMatchReason(result, query),
    });

    if (suggestions.length >= MAX_SUGGESTIONS) {
      break;
    }
  }

  return suggestions;
}

/**
 * Reset the internal Fuse index. Useful if the standard library is
 * modified at runtime (unlikely but testable).
 */
export function resetSuggestIndex(): void {
  searchableList = null;
  fuseInstance = null;
}
