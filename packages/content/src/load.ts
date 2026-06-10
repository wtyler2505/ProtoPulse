import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { load as parseYaml } from 'js-yaml';

import {
  ConceptFrontmatterSchema,
  DeckSchema,
  TrackStepSchema
  
  
  
} from './schemas.js';

import type {ConceptArticle, Deck, TrackStep} from './schemas.js';

/**
 * Loaders. The parse* functions are pure (string in, validated value
 * out); the load* helpers are Node-only fs conveniences over them.
 */

export function parseDeck(json: string): Deck {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (err) {
    throw new Error(`deck is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  return DeckSchema.parse(raw);
}

/** Hand-rolled frontmatter split: leading `---` block, YAML inside. */
export function parseConceptFrontmatter(md: string): ConceptArticle {
  const normalized = md.replace(/^\uFEFF/, '');
  if (!normalized.startsWith('---\n') && !normalized.startsWith('---\r\n')) {
    throw new Error('concept article must start with a --- frontmatter block');
  }
  const afterOpen = normalized.replace(/^---\r?\n/, '');
  const close = /\r?\n---[ \t]*(\r?\n|$)/.exec(afterOpen);
  if (close?.index === undefined) {
    throw new Error('concept article frontmatter block is not closed with ---');
  }
  const yamlText = afterOpen.slice(0, close.index);
  const body = afterOpen.slice(close.index + close[0].length);
  const frontmatter = ConceptFrontmatterSchema.parse(parseYaml(yamlText));
  return { frontmatter, body };
}

export function parseTrackStep(yaml: string): TrackStep {
  return TrackStepSchema.parse(parseYaml(yaml));
}

// ── Node-only fs helpers ─────────────────────────────────────────────

export function loadDeckFile(path: string): Deck {
  return parseDeck(readFileSync(path, 'utf8'));
}

export function loadConceptDir(dir: string): ConceptArticle[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => {
      try {
        return parseConceptFrontmatter(readFileSync(join(dir, name), 'utf8'));
      } catch (err) {
        throw new Error(`${name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
}

export function loadTrackDir(dir: string): TrackStep[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.yaml') || name.endsWith('.yml'))
    .sort()
    .map((name) => {
      try {
        return parseTrackStep(readFileSync(join(dir, name), 'utf8'));
      } catch (err) {
        throw new Error(`${name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
}
