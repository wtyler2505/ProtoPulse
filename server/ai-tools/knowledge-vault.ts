/**
 * Knowledge Vault AI tools — exposes Ars Contexta vault search to the AI agent.
 *
 * The vault (knowledge/*.md) contains Tyler's authoritative electronics claims
 * extracted from part documentation. Automatic injection via vault-context.ts
 * adds top-5 relevant claims to every AI message. This tool lets the agent
 * explicitly query the vault for deeper lookups when it needs more context.
 *
 * Read-only, no confirmation needed.
 *
 * @module ai-tools/knowledge-vault
 */

import { z } from 'zod';
import type { ToolRegistry } from './registry';
import type { ToolResult } from './types';
import { getVaultIndex } from '../lib/vault-context';

export function registerKnowledgeVaultTools(registry: ToolRegistry): void {
  registry.register({
    name: 'search_knowledge_vault',
    description:
      'Search the Ars Contexta knowledge vault for authoritative claims about electronics components, protocols, wiring, and design rules. ' +
      'The vault contains Tyler\'s verified inventory knowledge (microcontrollers, sensors, motor drivers, shields, passives, wiring guides, and design tensions). ' +
      'Use this when you need deeper or more specific domain claims than what is auto-injected into the system prompt. ' +
      'Returns up to 10 matching notes with slug, title, description, and type (moc / atomic).',
    category: 'component',
    permissionTier: 'read',
    modelPreference: 'fast',
    parameters: z.object({
      query: z
        .string()
        .min(3)
        .max(240)
        .describe(
          'Search query. Use specific technical terms (e.g., "ESP32 GPIO strapping pins", "L293D flyback diodes", "I2C pull-up sizing"). ' +
            'Queries with 2-5 meaningful terms work best.',
        ),
      limit: z
        .number()
        .int()
        .positive()
        .max(10)
        .optional()
        .default(5)
        .describe('Max results to return. Defaults to 5.'),
    }),
    requiresConfirmation: false,
    execute: async (params): Promise<ToolResult> => {
      try {
        const index = await getVaultIndex();
        const results = index.search(params.query, params.limit);
        if (results.length === 0) {
          return {
            success: true,
            message: `No vault notes matched "${params.query}". Try fewer terms or different specific keywords.`,
            data: { query: params.query, results: [] },
          };
        }
        return {
          success: true,
          message: `Found ${results.length} vault note${results.length === 1 ? '' : 's'} for "${params.query}"`,
          data: {
            query: params.query,
            results: results.map((r) => ({
              slug: r.note.slug,
              title: r.note.title,
              description: r.note.description,
              type: r.note.type,
              topics: r.note.topics,
              score: Number(r.score.toFixed(3)),
              snippets: r.matchedSnippets,
            })),
          },
        };
      } catch (err) {
        return {
          success: false,
          message: `Vault search failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  });
}
