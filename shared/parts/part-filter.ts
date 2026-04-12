/**
 * `PartFilter` — the filter/sort/search shape consumed by `useCatalog(filter)` on the client
 * and by `PartsStorage.search(filter, pagination)` on the server.
 *
 * Every list view in the parts domain calls `useCatalog(filter)` with a different filter and
 * renders the resulting `PartRow[]` as a lens. Adding a new filter field here means every lens
 * can use it without further plumbing.
 */

import type { PartOrigin, TrustLevel } from './part-row';

export interface PartFilter {
  /** Free-text search over title/description/manufacturer/mpn. */
  text?: string;

  /** Exact match on `canonical_category`. */
  category?: string;

  /** Minimum trust level (rows with equal-or-higher rank are returned). */
  minTrustLevel?: TrustLevel;

  /** Exact match on origin. */
  origin?: PartOrigin;

  /** If set, join `part_stock` and only return parts with a stock row in this project. */
  projectId?: number;

  /** Exact match on `is_public`. */
  isPublic?: boolean;

  /** `true` → only rows with non-null `mpn`; `false` → only rows with null `mpn`. */
  hasMpn?: boolean;

  /** If set, only return parts that have a matching `part_stock` row (requires `projectId`). */
  hasStock?: boolean;

  /** Tag filter applied via `meta.tags` JSONB contains. */
  tags?: string[];

  /** Include soft-deleted rows. Default: false. */
  includeDeleted?: boolean;
}

export const PART_SORT_FIELDS = [
  'title',
  'createdAt',
  'updatedAt',
  'canonicalCategory',
  'trustLevel',
] as const;
export type PartSortField = (typeof PART_SORT_FIELDS)[number];

export type SortDir = 'asc' | 'desc';

export interface PartPagination {
  limit?: number;
  offset?: number;
  sortBy?: PartSortField;
  sortDir?: SortDir;
}

export const DEFAULT_PART_PAGINATION: Required<PartPagination> = {
  limit: 50,
  offset: 0,
  sortBy: 'updatedAt',
  sortDir: 'desc',
};

/**
 * Compose two filters, where later-specified fields override earlier ones.
 * Array fields (`tags`) are intersected when both sides set them.
 */
export function composeFilter(base: PartFilter, override: PartFilter): PartFilter {
  const merged: PartFilter = { ...base, ...override };
  if (base.tags && override.tags) {
    merged.tags = base.tags.filter((t) => override.tags!.includes(t));
  }
  return merged;
}
