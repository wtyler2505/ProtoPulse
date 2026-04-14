/**
 * Vault Search Tests
 *
 * Tests for VaultSearchIndex in server/lib/vault-search.ts.
 * Indexes Ars Contexta knowledge vault (knowledge/*.md) for
 * AI prompt grounding.
 *
 * Runs in server project config (node environment).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import { VaultSearchIndex, parseVaultNote } from '../vault-search';

const VAULT_ROOT = path.resolve(__dirname, '../../../knowledge');

describe('parseVaultNote', () => {
  it('extracts frontmatter description field', () => {
    const raw = `---
description: Test note description
type: atomic
---

Body content here.`;
    const note = parseVaultNote('test-note', '/fake/path/test-note.md', raw);
    expect(note.description).toBe('Test note description');
  });

  it('extracts type field', () => {
    const raw = `---
description: Topic map for tests
type: moc
---

Body.`;
    const note = parseVaultNote('test-moc', '/fake/path.md', raw);
    expect(note.type).toBe('moc');
  });

  it('extracts topics array when present', () => {
    const raw = `---
description: Test
type: moc
topics:
  - "[[index]]"
  - "[[other-topic]]"
---

Body.`;
    const note = parseVaultNote('test', '/fake/path.md', raw);
    expect(note.topics).toEqual(['index', 'other-topic']);
  });

  it('handles empty topics gracefully', () => {
    const raw = `---
description: Test
type: atomic
---

Body content only.`;
    const note = parseVaultNote('test', '/fake/path.md', raw);
    expect(note.topics).toEqual([]);
  });

  it('extracts wiki-links from body', () => {
    const raw = `---
description: Test
type: atomic
---

See [[related-note]] and [[another-note]] for context.`;
    const note = parseVaultNote('test', '/fake/path.md', raw);
    expect(note.links).toContain('related-note');
    expect(note.links).toContain('another-note');
  });

  it('derives title from slug when no H1 present', () => {
    const raw = `---
description: Test
type: atomic
---

No heading, just body.`;
    const note = parseVaultNote('esp32-gpio12-quirk', '/fake/path.md', raw);
    expect(note.title).toBe('esp32-gpio12-quirk');
  });

  it('captures body content separate from frontmatter', () => {
    const raw = `---
description: Test
type: atomic
---

The actual claim body.`;
    const note = parseVaultNote('test', '/fake/path.md', raw);
    expect(note.body.trim()).toBe('The actual claim body.');
    expect(note.body).not.toContain('description:');
  });

  it('handles note with no frontmatter', () => {
    const raw = `Just a body with no frontmatter at all.`;
    const note = parseVaultNote('nofm', '/fake/path.md', raw);
    expect(note.description).toBe('');
    expect(note.type).toBe('');
    expect(note.body.trim()).toBe('Just a body with no frontmatter at all.');
  });
});

describe('VaultSearchIndex integration with real vault', () => {
  let index: VaultSearchIndex;

  beforeAll(async () => {
    index = await VaultSearchIndex.load(VAULT_ROOT);
  });

  it('loads all .md files from knowledge/', () => {
    expect(index.size()).toBeGreaterThan(100);
  });

  it('search returns relevant notes for "esp32 gpio"', () => {
    const results = index.search('esp32 gpio boot strapping', 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].score).toBeGreaterThan(0);
    const titles = results.map(r => r.note.slug).join(' ');
    expect(titles).toMatch(/esp32/i);
  });

  it('search returns relevant notes for motor driver', () => {
    const results = index.search('motor driver h-bridge', 5);
    expect(results.length).toBeGreaterThan(0);
    const slugs = results.map(r => r.note.slug).join(' ');
    expect(slugs).toMatch(/l293d|l298|tb6612|motor/i);
  });

  it('search returns empty array for gibberish query', () => {
    const results = index.search('xyzqqqzzzqqq-nonexistent-query', 5);
    expect(results.length).toBe(0);
  });

  it('search respects topK limit', () => {
    const results = index.search('sensor', 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it('getNote returns note by slug', () => {
    const eda = index.getNote('eda-fundamentals');
    expect(eda).toBeDefined();
    expect(eda?.type).toBe('moc');
  });

  it('getNote returns undefined for unknown slug', () => {
    const result = index.getNote('this-note-does-not-exist-xyz');
    expect(result).toBeUndefined();
  });

  it('getMOCNotes returns only topic maps', () => {
    const mocs = index.getMOCNotes();
    expect(mocs.length).toBeGreaterThan(5);
    expect(mocs.every(n => n.type === 'moc')).toBe(true);
  });

  it('formatForPrompt produces AI-ready snippet', () => {
    const results = index.search('i2c pull-up', 3);
    expect(results.length).toBeGreaterThan(0);
    const snippet = index.formatForPrompt(results);
    expect(snippet).toContain('INVENTORY KNOWLEDGE');
    expect(snippet.length).toBeGreaterThan(50);
    // Should not include giant raw bodies — must be trimmed
    expect(snippet.length).toBeLessThan(8000);
  });
});
