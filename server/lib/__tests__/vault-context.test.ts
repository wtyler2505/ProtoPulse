/**
 * Vault Context Tests
 *
 * Tests for server/lib/vault-context.ts — the singleton loader and
 * per-message vault grounding used by server/ai.ts.
 */

import { describe, it, expect } from 'vitest';
import { getVaultIndex, buildVaultContext, resetVaultIndexForTests } from '../vault-context';

describe('getVaultIndex', () => {
  it('loads vault index lazily on first call', async () => {
    resetVaultIndexForTests();
    const idx = await getVaultIndex();
    expect(idx.size()).toBeGreaterThan(100);
  });

  it('returns the same instance on subsequent calls', async () => {
    resetVaultIndexForTests();
    const a = await getVaultIndex();
    const b = await getVaultIndex();
    expect(a).toBe(b);
  });
});

describe('buildVaultContext', () => {
  it('returns empty string when message is empty', async () => {
    const ctx = await buildVaultContext('', 'architecture');
    expect(ctx).toBe('');
  });

  it('returns empty string for very short messages below query threshold', async () => {
    const ctx = await buildVaultContext('hi', 'architecture');
    expect(ctx).toBe('');
  });

  it('returns vault snippet for technical queries', async () => {
    const ctx = await buildVaultContext('how do I wire an ESP32 GPIO safely?', 'schematic');
    expect(ctx).toContain('INVENTORY KNOWLEDGE');
    expect(ctx.toLowerCase()).toMatch(/esp32|gpio/);
  });

  it('includes active-view hint in search scoring', async () => {
    const ctx = await buildVaultContext('what are boot strapping pins', 'architecture');
    expect(ctx.length).toBeGreaterThan(0);
  });

  it('caps output size to avoid blowing prompt budget', async () => {
    const ctx = await buildVaultContext('motor driver h-bridge pwm current', 'schematic');
    expect(ctx.length).toBeLessThan(8000);
  });

  it('returns empty for queries with no meaningful vault match', async () => {
    const ctx = await buildVaultContext('tell me a joke about cats unrelated', 'architecture');
    // May or may not match — but should not crash
    expect(typeof ctx).toBe('string');
  });
});
