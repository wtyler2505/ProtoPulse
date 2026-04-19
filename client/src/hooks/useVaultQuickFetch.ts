/**
 * useVaultQuickFetch — tooltip-grade vault note reader.
 *
 * Thin wrapper over `useVaultNote` that exposes exactly what `<VaultHoverCard>`
 * and `<VaultExplainer>` need, nothing more:
 *   - `title`  — note title (falls back to slug)
 *   - `summary` — first 140 chars of the body, stripped of markdown chrome
 *   - `body` — full markdown (for the explainer variant)
 *   - `topics` — topic slugs for the breadcrumb row
 *   - `loading` / `error`
 *
 * Every consumer is routed through this hook so the primitive components
 * never touch `/api/vault/...` directly. The CI guard in
 * `scripts/ci/check-vault-primitive.sh` enforces this.
 *
 * See: docs/superpowers/plans/2026-04-18-e2e-walkthrough/16-design-system.md
 *      Phase 8 Task 8.1.
 */
import { useMemo } from 'react';
import { useVaultNote, type VaultNoteDetail } from './useVaultSearch';

export interface VaultQuickFetchResult {
  title: string;
  summary: string;
  body: string;
  topics: string[];
  loading: boolean;
  error: unknown;
  /** True when the slug returned a 404 (note does not exist yet — caller may render a gap CTA). */
  notFound: boolean;
  /** Raw detail (for callers that need topics / links beyond the quick fields). */
  data: VaultNoteDetail | undefined;
}

const SUMMARY_CAP = 140;

/** Collapse whitespace + drop markdown emphasis marks + drop wiki-link brackets. */
function stripMarkdown(src: string): string {
  return src
    .replace(/^#{1,6}\s+/gm, '') // heading markers
    .replace(/```[\s\S]*?```/g, '') // fenced code blocks
    .replace(/`([^`]*)`/g, '$1') // inline code
    .replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, '$1') // wiki-links → plain
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // md links → plain
    .replace(/[*_~]+/g, '') // emphasis marks
    .replace(/\s+/g, ' ')
    .trim();
}

function makeSummary(description: string | undefined, body: string | undefined): string {
  // Prefer the frontmatter description (it's already tooltip-grade by v2 schema),
  // fall back to the first content-bearing sentences of the body.
  if (description && description.trim().length > 0) {
    const d = description.trim();
    return d.length <= SUMMARY_CAP ? d : d.slice(0, SUMMARY_CAP - 1).trimEnd() + '…';
  }
  if (!body) return '';
  const flat = stripMarkdown(body);
  return flat.length <= SUMMARY_CAP ? flat : flat.slice(0, SUMMARY_CAP - 1).trimEnd() + '…';
}

function isNotFound(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  return msg.startsWith('404');
}

/**
 * Fetch a vault note by slug and return tooltip-grade fields.
 *
 * Memoized per-slug via React Query (`staleTime: 5min` inherited from `useVaultNote`).
 *
 * @param slug Bare slug (no `.md`, no `knowledge/` prefix, no `[[]]` brackets).
 *             Pass `undefined` / `null` to disable the query (e.g., popover closed).
 */
export function useVaultQuickFetch(slug: string | null | undefined): VaultQuickFetchResult {
  const { data, isLoading, error } = useVaultNote(slug);

  return useMemo<VaultQuickFetchResult>(() => {
    const notFound = isNotFound(error);
    return {
      title: data?.title ?? slug ?? '',
      summary: makeSummary(data?.description, data?.body),
      body: data?.body ?? '',
      topics: data?.topics ?? [],
      loading: isLoading,
      error: notFound ? null : error,
      notFound,
      data,
    };
  }, [slug, data, isLoading, error]);
}
