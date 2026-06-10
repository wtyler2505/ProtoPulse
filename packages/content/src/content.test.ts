import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { ERC_CODES } from '@protopulse/erc';
import { loadConceptDir, loadDeckFile, loadTrackDir, parseConceptFrontmatter, parseDeck, parseTrackStep } from './load.js';

// packages/content/src → repo root.
const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const deckPath = resolve(repoRoot, 'content/decks/jlcpcb-2layer-standard.json');
const conceptsDir = resolve(repoRoot, 'content/concepts/fundamentals');
const trackDir = resolve(repoRoot, 'content/tracks/01-first-light');

const concepts = loadConceptDir(conceptsDir);
const steps = loadTrackDir(trackDir);
const slugs = new Set(concepts.map((c) => c.frontmatter.slug));

const SECTION_HEADINGS = ['What it is', 'Why it bites', 'The numbers', 'See it', 'Go deeper'];

describe('deck seed', () => {
  it('parses and matches the JLCPCB 2-layer spec values exactly', () => {
    const deck = loadDeckFile(deckPath);
    expect(deck.deck).toBe('jlcpcb-2layer-standard');
    expect(deck.rev).toBe('2026-05');
    expect(deck.rules).toEqual({
      min_trace_nm: 127000,
      min_clearance_nm: 127000,
      min_drill_nm: 300000,
      min_annular_nm: 130000,
      copper_to_edge_nm: 300000,
      silk_min_width_nm: 153000,
    });
    expect(deck.classOverrides).toEqual({ power: { min_trace_nm: 300000 } });
  });

  it('rejects decks with missing rule keys', () => {
    expect(() => parseDeck('{"deck":"x","rev":"1","rules":{},"classOverrides":{}}')).toThrow();
    expect(() => parseDeck('not json')).toThrow(/not valid JSON/);
  });
});

describe('concept seed articles', () => {
  it('loads the full fundamentals set', () => {
    expect(concepts.length).toBeGreaterThanOrEqual(13);
  });

  it('contains every specced M1 slug', () => {
    const expected = [
      'voltage-vs-current',
      'ohms-law-in-practice',
      'series-vs-parallel',
      'power-and-heat',
      'tolerance-stacking',
      'si-prefixes-4k7',
      'ground-three-meanings',
      'impedance-vs-resistance',
      'rms-vs-peak',
      'duty-cycle',
      'floating-inputs',
      'pull-up-pull-down',
      'push-pull-vs-open-collector',
    ];
    for (const slug of expected) {
      expect(slugs.has(slug), slug).toBe(true);
    }
  });

  it('covers every concept slug referenced by ERC_CODES — the error message IS the curriculum index', () => {
    for (const [code, info] of Object.entries(ERC_CODES)) {
      expect(slugs.has(info.conceptSlug), `${code} → ${info.conceptSlug}`).toBe(true);
    }
  });

  it('every ercCodes entry is a real ERC code', () => {
    for (const concept of concepts) {
      for (const code of concept.frontmatter.ercCodes) {
        expect(ERC_CODES[code], `${concept.frontmatter.slug} references ${code}`).toBeDefined();
      }
    }
  });

  it('slugs are unique and match kebab-case', () => {
    expect(slugs.size).toBe(concepts.length);
  });

  it('every body is ≤600 words and carries the five sections in order', () => {
    for (const concept of concepts) {
      const words = concept.body.split(/\s+/).filter((w) => w.length > 0);
      expect(words.length, `${concept.frontmatter.slug} word count`).toBeLessThanOrEqual(600);
      let lastIdx = -1;
      for (const heading of SECTION_HEADINGS) {
        const idx = concept.body.indexOf(`## ${heading}`);
        expect(idx, `${concept.frontmatter.slug} missing "## ${heading}"`).toBeGreaterThan(lastIdx);
        lastIdx = idx;
      }
    }
  });

  it('parseConceptFrontmatter rejects files without frontmatter', () => {
    expect(() => parseConceptFrontmatter('# no frontmatter')).toThrow(/frontmatter/);
    expect(() => parseConceptFrontmatter('---\nslug: x\n')).toThrow(/not closed/);
    expect(() => parseConceptFrontmatter('---\nslug: Bad Slug\ntitle: t\nercCodes: []\n---\nbody')).toThrow();
  });

  it('round-trips a minimal article', () => {
    const article = parseConceptFrontmatter(
      '---\nslug: test-article\ntitle: Test\nercCodes:\n  - ERC-FLOATING-INPUT\n---\n\n## What it is\n\nBody.\n',
    );
    expect(article.frontmatter).toEqual({
      slug: 'test-article',
      title: 'Test',
      ercCodes: ['ERC-FLOATING-INPUT'],
    });
    expect(article.body).toContain('## What it is');
  });
});

describe('track 01 first-light', () => {
  it('loads exactly 5 steps with sequential ids', () => {
    expect(steps.map((s) => s.id)).toEqual([
      'first-light-01',
      'first-light-02',
      'first-light-03',
      'first-light-04',
      'first-light-05',
    ]);
  });

  it('every unlocks slug exists in the concept set', () => {
    for (const step of steps) {
      for (const slug of step.unlocks) {
        expect(slugs.has(slug), `${step.id} unlocks ${slug}`).toBe(true);
      }
    }
  });

  it('steps 2–5 carry the machine-checkable erc: clean goal', () => {
    for (const step of steps.slice(1)) {
      const hasErcClean = step.goal.some(
        (g) => typeof g === 'object' && g['erc'] === 'clean',
      );
      expect(hasErcClean, `${step.id} must gate on erc: clean`).toBe(true);
    }
  });

  it('every step has depth-adaptive professor text and a deliverable', () => {
    for (const step of steps) {
      expect(Object.keys(step.professor).length, step.id).toBeGreaterThanOrEqual(2);
      expect(step.deliverable.length).toBeGreaterThan(20);
      expect(step.title.length).toBeGreaterThan(3);
      expect(step.mode.length).toBeGreaterThan(0);
    }
  });

  it('the deliverable step builds the 3-LED traffic light around a 555 black box', () => {
    const final = steps[4];
    expect(final?.title).toMatch(/traffic light/i);
    expect(JSON.stringify(final)).toMatch(/555/);
  });

  it('parseTrackStep rejects steps missing required fields', () => {
    expect(() => parseTrackStep('id: x\ntitle: y\n')).toThrow();
    expect(() =>
      parseTrackStep(
        'id: x\ntitle: y\nmode: guided\nunlocks: []\ngiven: null\ngoal: []\nprofessor:\n  beginner: hi\ndeliverable: thing\n',
      ),
    ).toThrow(); // empty goal list
  });
});
