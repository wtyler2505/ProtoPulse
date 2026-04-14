/**
 * Vault Context — lazy-loaded singleton wrapper around VaultSearchIndex
 * and per-message grounding used by server/ai.ts.
 *
 * The singleton loads knowledge/*.md once per process and caches the Fuse
 * index. `buildVaultContext(message, activeView)` is called per AI request
 * to produce a small authoritative-claims section appended to the cached
 * system prompt. Keeps prompt-cache invalidation behavior intact because
 * only the final concat changes per-message.
 */

import path from 'node:path';
import { VaultSearchIndex } from './vault-search';
import { logger } from '../logger';

// Allow env override (future: support reloading on vault-changed events)
const DEFAULT_VAULT_ROOT = path.resolve(process.cwd(), 'knowledge');

let singletonPromise: Promise<VaultSearchIndex> | null = null;

export function resetVaultIndexForTests(): void {
  singletonPromise = null;
}

export async function getVaultIndex(root: string = DEFAULT_VAULT_ROOT): Promise<VaultSearchIndex> {
  if (!singletonPromise) {
    singletonPromise = VaultSearchIndex.load(root).catch((err) => {
      // Reset so a later call can retry; but don't spam logs on every request.
      singletonPromise = null;
      logger.warn(`[vault-context] Failed to load vault index from ${root}: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    });
  }
  return singletonPromise;
}

// English stopwords that add noise to vault search without contributing signal.
const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'by', 'from',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'do', 'does', 'did', 'done',
  'have', 'has', 'had', 'having', 'can', 'could', 'should', 'would', 'will',
  'may', 'might', 'must', 'shall', 'i', 'me', 'my', 'you', 'your', 'we', 'our',
  'it', 'its', 'this', 'that', 'these', 'those', 'and', 'or', 'but', 'if',
  'not', 'no', 'so', 'as', 'how', 'what', 'when', 'where', 'why', 'which',
  'who', 'tell', 'please', 'help', 'show', 'give', 'add', 'use', 'using',
  'need', 'want', 'safely', 'properly',
]);

/**
 * Extract a search query from the user message plus a view-specific hint.
 * Very short messages (< 6 chars after trimming) return empty.
 * Strips stopwords and caps to 6 meaningful terms for clean Fuse scoring.
 */
function buildQuery(message: string, activeView: string): string {
  const trimmed = message.trim();
  if (trimmed.length < 6) return '';

  const terms = trimmed
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !STOPWORDS.has(w))
    .slice(0, 6);

  if (terms.length === 0) return '';

  // View hint intentionally NOT appended to the query string. Multi-term Fuse
  // scoring degrades when extra tokens don't individually match many notes, so
  // adding generic view keywords ("schematic wiring pinout") hurts recall on
  // specific queries. View context is preserved via `activeView` parameter for
  // future scoring-weight strategies if needed.
  void activeView;
  return terms.join(' ');
}

/**
 * Produce a system-prompt section with top-K relevant vault claims.
 * Returns empty string when nothing meaningful matches.
 */
export async function buildVaultContext(
  message: string,
  activeView: string,
  topK: number = 5,
): Promise<string> {
  try {
    const query = buildQuery(message, activeView);
    if (!query) return '';

    const index = await getVaultIndex();
    const results = index.search(query, topK);
    if (results.length === 0) return '';

    // Fuse's own `threshold: 0.4` config already filters weak matches at
    // search time. Any result that makes it through is worth surfacing.
    return index.formatForPrompt(results);
  } catch {
    // Never let vault failures break AI requests — return no grounding instead.
    return '';
  }
}
