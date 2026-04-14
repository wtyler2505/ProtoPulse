/**
 * React Query hooks for the Ars Contexta knowledge vault.
 *
 * Connects to the server-side vault search (server/routes/knowledge-vault.ts)
 * so UI components can:
 * - Search the vault by free-text query (for vault browser / autocomplete)
 * - Fetch a full note by slug (for detail view / AI-response citation expansion)
 * - List all MOCs (for topic-map navigation)
 */

import { useQuery } from '@tanstack/react-query';

export interface VaultSearchHit {
  slug: string;
  title: string;
  description: string;
  type: string;
  topics: string[];
  score: number;
  snippets: string[];
}

export interface VaultSearchResponse {
  query: string;
  count: number;
  results: VaultSearchHit[];
}

export interface VaultNoteDetail {
  slug: string;
  title: string;
  description: string;
  type: string;
  topics: string[];
  links: string[];
  body: string;
}

export interface VaultMocListing {
  slug: string;
  title: string;
  description: string;
  linkCount: number;
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, credentials: 'include' });
  if (!res.ok) {
    throw new Error(`${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Search the vault by free-text query. Disabled for empty/short queries to
 * avoid server churn during typing.
 */
export function useVaultSearch(query: string, limit: number = 10) {
  const trimmed = query.trim();
  return useQuery<VaultSearchResponse>({
    queryKey: ['vault', 'search', trimmed, limit],
    queryFn: ({ signal }) => {
      const url = `/api/vault/search?q=${encodeURIComponent(trimmed)}&limit=${limit}`;
      return fetchJson<VaultSearchResponse>(url, signal);
    },
    enabled: trimmed.length >= 3,
    staleTime: 60_000,
  });
}

/**
 * Fetch a single vault note by slug. Useful for expanding AI-response
 * citations or rendering a vault browser detail panel.
 */
export function useVaultNote(slug: string | null | undefined) {
  return useQuery<VaultNoteDetail>({
    queryKey: ['vault', 'note', slug],
    queryFn: ({ signal }) => {
      const url = `/api/vault/note/${encodeURIComponent(slug!)}`;
      return fetchJson<VaultNoteDetail>(url, signal);
    },
    enabled: Boolean(slug && slug.length > 0),
    staleTime: 5 * 60_000,
  });
}

/**
 * List all topic maps (MOCs) in the vault. Stable enough to cache aggressively.
 */
export function useVaultMocs() {
  return useQuery<{ count: number; mocs: VaultMocListing[] }>({
    queryKey: ['vault', 'mocs'],
    queryFn: ({ signal }) => fetchJson('/api/vault/mocs', signal),
    staleTime: 10 * 60_000,
  });
}
