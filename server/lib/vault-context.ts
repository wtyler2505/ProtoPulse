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

/**
 * Extract a search query from the user message plus a view-specific hint.
 * Very short messages (< 6 chars after trimming) return empty.
 */
function buildQuery(message: string, activeView: string): string {
  const trimmed = message.trim();
  if (trimmed.length < 6) return '';

  // Drop common AI-directive phrases that dilute search signal
  const cleaned = trimmed
    .replace(/^(please |can you |could you |how do i |how should i |what is |what are |tell me )/i, '')
    .replace(/[?!.]+$/g, '')
    .slice(0, 240);

  // View hints help cases like "add this component" benefit from view context
  const viewHint = viewToQueryHint(activeView);
  return viewHint ? `${cleaned} ${viewHint}` : cleaned;
}

function viewToQueryHint(view: string): string {
  // Cheap heuristic: add domain keywords for certain views
  switch (view) {
    case 'schematic': return 'schematic wiring pinout';
    case 'pcb': return 'pcb layout trace';
    case 'breadboard': return 'breadboard rail';
    case 'simulation': return 'simulation spice';
    case 'validation': return 'drc erc validation';
    case 'arduino': case 'circuit_code': return 'arduino code firmware';
    case 'serial_monitor': return 'uart serial debug';
    case 'procurement': case 'ordering': return 'bom sourcing';
    case 'knowledge': return 'electronics fundamentals';
    default: return '';
  }
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

    // Require at least one decent match (Fuse inverted-score ≥ 0.3) to avoid
    // injecting noise from weak matches.
    const good = results.filter(r => r.score >= 0.3);
    if (good.length === 0) return '';

    return index.formatForPrompt(good);
  } catch {
    // Never let vault failures break AI requests — return no grounding instead.
    return '';
  }
}
