/**
 * Tests for Knowledge Vault AI tool.
 *
 * Validates the search_knowledge_vault tool that exposes Ars Contexta
 * vault search to the AI agent.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry } from '../registry';
import { registerKnowledgeVaultTools } from '../knowledge-vault';
import { resetVaultIndexForTests } from '../../lib/vault-context';
import type { ToolContext } from '../types';

function createCtx(overrides?: Partial<ToolContext>): ToolContext {
  return {
    projectId: 1,
    storage: {} as ToolContext['storage'],
    confirmed: true,
    ...overrides,
  };
}

describe('search_knowledge_vault tool', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    resetVaultIndexForTests();
    registry = new ToolRegistry();
    registerKnowledgeVaultTools(registry);
  });

  it('registers the search_knowledge_vault tool', () => {
    const tool = registry.get('search_knowledge_vault');
    expect(tool).toBeDefined();
    expect(tool?.category).toBe('component');
    expect(tool?.permissionTier).toBe('read');
    expect(tool?.requiresConfirmation).toBe(false);
  });

  it('returns relevant vault notes for technical query', async () => {
    const tool = registry.get('search_knowledge_vault')!;
    const result = await tool.execute({ query: 'esp32 gpio boot', limit: 5 }, createCtx());
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    const data = result.data as { results: Array<{ slug: string; score: number }> };
    expect(data.results.length).toBeGreaterThan(0);
    expect(data.results[0].slug).toMatch(/esp32/i);
    expect(data.results[0].score).toBeGreaterThan(0);
  });

  it('attaches knowledge_base sources for BL-0160 Source Panel', async () => {
    const tool = registry.get('search_knowledge_vault')!;
    const result = await tool.execute({ query: 'motor driver h-bridge', limit: 3 }, createCtx());
    expect(result.success).toBe(true);
    expect(result.sources).toBeDefined();
    expect(result.sources!.length).toBeGreaterThan(0);
    expect(result.sources![0].type).toBe('knowledge_base');
    expect(result.sources![0].label).toBeTruthy();
  });

  it('handles gibberish gracefully with empty results', async () => {
    const tool = registry.get('search_knowledge_vault')!;
    const result = await tool.execute({ query: 'xyzqqqzzz-nonsense', limit: 5 }, createCtx());
    expect(result.success).toBe(true);
    const data = result.data as { results: unknown[] };
    expect(data.results).toEqual([]);
  });

  it('respects the limit parameter', async () => {
    const tool = registry.get('search_knowledge_vault')!;
    const result = await tool.execute({ query: 'sensor', limit: 2 }, createCtx());
    expect(result.success).toBe(true);
    const data = result.data as { results: unknown[] };
    expect(data.results.length).toBeLessThanOrEqual(2);
  });

  it('rejects queries shorter than 3 characters (schema validation)', () => {
    const tool = registry.get('search_knowledge_vault')!;
    // Zod schema should reject via parse — tool.execute would throw otherwise
    const parseResult = tool.parameters.safeParse({ query: 'ab' });
    expect(parseResult.success).toBe(false);
  });
});
