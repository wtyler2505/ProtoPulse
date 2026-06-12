import { describe, expect, it } from 'vitest';

import { createConceptLookup } from './concepts.js';

/**
 * The adapter is tested over a MOCKED glob map (path → raw markdown),
 * exactly the shape import.meta.glob({eager:true, query:'?raw'})
 * produces — no bundler involved.
 */

const GLOB_MAP: Record<string, string> = {
  '../../../../content/concepts/fundamentals/pull-up-pull-down.md': [
    '---',
    'slug: pull-up-pull-down',
    'title: Pull-up and pull-down resistors',
    'ercCodes:',
    '  - ERC-OC-NO-PULLUP',
    '---',
    '',
    '## What it is',
    'A resistor that defines the idle logic level.',
  ].join('\n'),
  '../../../../content/concepts/advanced/impedance.md': [
    '---',
    'slug: impedance',
    'title: Impedance, properly',
    'ercCodes: []',
    '---',
    'Body text.',
  ].join('\n'),
  '../../../../content/concepts/fundamentals/broken.md': '# no frontmatter here\njust text',
};

describe('createConceptLookup (glob-map adapter for the Professor)', () => {
  const lookup = createConceptLookup(GLOB_MAP);

  it('resolves a slug to its frontmatter title and body', () => {
    const hit = lookup('pull-up-pull-down');
    expect(hit?.title).toBe('Pull-up and pull-down resistors');
    expect(hit?.body).toContain('idle logic level');
    // Frontmatter is stripped from the body the model reads.
    expect(hit?.body).not.toContain('ercCodes');
  });

  it('finds articles in any subdirectory of the wiki', () => {
    expect(lookup('impedance')?.title).toBe('Impedance, properly');
  });

  it('returns undefined for unknown slugs', () => {
    expect(lookup('warp-drives')).toBeUndefined();
  });

  it('does not match partial slugs (suffix-anchored on the filename)', () => {
    expect(lookup('pull-down')).toBeUndefined();
  });

  it('degrades gracefully when frontmatter is missing: slug as title, raw text as body', () => {
    const hit = lookup('broken');
    expect(hit?.title).toBe('broken');
    expect(hit?.body).toContain('no frontmatter here');
  });

  it('the REAL bundled wiki resolves the ERC-mapped slugs', () => {
    // Exercises the default (import.meta.glob) map under vitest's vite
    // transform — the articles shipped in content/concepts are found.
    const real = createConceptLookup();
    const hit = real('floating-inputs');
    expect(hit?.title).toBe('Floating inputs');
    expect(hit?.body.length ?? 0).toBeGreaterThan(0);
  });
});
