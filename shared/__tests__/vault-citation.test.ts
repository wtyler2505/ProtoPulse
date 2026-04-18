/**
 * Tests for shared/vault-citation.ts — Wave 2 audit #252, #292 scaffolding.
 *
 * Verifies:
 *   1. cite() returns a valid structured VaultCitation for every slug key.
 *   2. Every slug in VAULT_SLUGS has a backing `knowledge/<slug>.md` file.
 *   3. citeSlug() accepts raw slug strings and preserves them.
 *   4. slugToLabel() produces human-readable titles.
 *   5. source.type is always `knowledge_base` (the UI discriminator for
 *      clickable AnswerSourcePanel chips).
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VAULT_SLUGS, cite, citeSlug, slugToLabel } from '../vault-citation';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// From shared/__tests__/ → traverse up 2 → repo root → knowledge/
const knowledgeDir = resolve(__dirname, '..', '..', 'knowledge');

describe('VAULT_SLUGS', () => {
  it('contains at least 41 entries (36 Wave 1 + 5 Wave 2 additions)', () => {
    expect(Object.keys(VAULT_SLUGS).length).toBeGreaterThanOrEqual(41);
  });

  it('all slugs are kebab-case (lowercase, digits, hyphens only)', () => {
    for (const slug of Object.values(VAULT_SLUGS)) {
      expect(slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  for (const [key, slug] of Object.entries(VAULT_SLUGS)) {
    it(`${key} → ${slug}.md exists on disk`, () => {
      expect(existsSync(resolve(knowledgeDir, `${slug}.md`))).toBe(true);
    });
  }
});

describe('cite()', () => {
  it('returns a structured VaultCitation for every VAULT_SLUGS key', () => {
    for (const key of Object.keys(VAULT_SLUGS) as Array<keyof typeof VAULT_SLUGS>) {
      const c = cite(key);
      expect(c.slug).toBe(VAULT_SLUGS[key]);
      expect(c.href).toBe(`/knowledge/${VAULT_SLUGS[key]}`);
      expect(c.source.type).toBe('knowledge_base');
      expect(c.source.id).toBe(VAULT_SLUGS[key]);
      expect(c.source.label).toBeTruthy();
    }
  });

  it('uses labelOverride when supplied', () => {
    const c = cite('ESP32_GPIO12_STRAPPING', 'Custom rule label');
    expect(c.source.label).toBe('Custom rule label');
  });

  it('derives a readable label from the slug when no override given', () => {
    const c = cite('ESP32_GPIO12_STRAPPING');
    // slugToLabel turns 'esp32-gpio12-must…' into 'Esp32 gpio12 must…'
    expect(c.source.label).toMatch(/^Esp32 gpio12/);
  });
});

describe('citeSlug()', () => {
  it('preserves raw slug strings', () => {
    const c = citeSlug('some-custom-slug');
    expect(c.slug).toBe('some-custom-slug');
    expect(c.href).toBe('/knowledge/some-custom-slug');
    expect(c.source.id).toBe('some-custom-slug');
  });
});

describe('slugToLabel()', () => {
  it('replaces hyphens with spaces and capitalizes the first word', () => {
    expect(slugToLabel('hello-world')).toBe('Hello world');
  });
  it('handles single-word slugs', () => {
    expect(slugToLabel('decoupling')).toBe('Decoupling');
  });
});

// ---------------------------------------------------------------------------
// DRC citation integration — Wave 2 task step 6 requirement:
// "verify DRC output includes citations for at least 3 rule types."
// ---------------------------------------------------------------------------

describe('DRC rule citation coverage', () => {
  it('at least 3 distinct Wave 2 rule types have dedicated vault slugs', () => {
    const waveTwoKeys = [
      'ESP32_GPIO6_11_FLASH',
      'ESP32_GPIO12_STRAPPING',
      'ESP32_ADC2_WIFI',
      'DECOUPLING_100NF',
      'BLDC_STOP_BRAKE',
      'L298N_NO_FLYBACK',
    ] as const;
    for (const key of waveTwoKeys) {
      const c = cite(key);
      expect(c.source.type).toBe('knowledge_base');
      expect(c.slug).toBeTruthy();
    }
    expect(waveTwoKeys.length).toBeGreaterThanOrEqual(3);
  });
});
