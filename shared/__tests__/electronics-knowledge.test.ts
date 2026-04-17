/**
 * Integrity tests for the shared electronics knowledge base.
 *
 * These tests enforce structural invariants that prevent the two consumers
 * (ai-prediction-engine and proactive-healing) from silently drifting or
 * citing non-existent vault notes.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

import {
  ELECTRONICS_KNOWLEDGE,
  getElectronicsKnowledge,
  type ElectronicsRule,
  type ElectronicsTopicId,
} from '../electronics-knowledge';

const VAULT_DIR = join(__dirname, '..', '..', 'knowledge');

describe('ELECTRONICS_KNOWLEDGE', () => {
  it('is non-empty', () => {
    expect(ELECTRONICS_KNOWLEDGE.length).toBeGreaterThan(0);
  });

  it('has no duplicate topic ids', () => {
    const ids = ELECTRONICS_KNOWLEDGE.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has all required fields populated on every entry', () => {
    ELECTRONICS_KNOWLEDGE.forEach((entry) => {
      expect(entry.id, `${entry.id}.id`).toBeTruthy();
      expect(entry.name, `${entry.id}.name`).toBeTruthy();
      expect(entry.category, `${entry.id}.category`).toBeTruthy();
      expect(entry.severity, `${entry.id}.severity`).toBeTruthy();
      expect(entry.explanation, `${entry.id}.explanation`).toBeTruthy();
      expect(entry.fixDescription, `${entry.id}.fixDescription`).toBeTruthy();
      expect(entry.defaultValues, `${entry.id}.defaultValues`).toBeTruthy();
      expect(Array.isArray(entry.triggerTypes)).toBe(true);
      expect(Array.isArray(entry.references)).toBe(true);
    });
  });

  it('has non-empty triggerTypes on every entry', () => {
    ELECTRONICS_KNOWLEDGE.forEach((entry) => {
      expect(entry.triggerTypes.length, `${entry.id}.triggerTypes`).toBeGreaterThan(0);
      entry.triggerTypes.forEach((t) => {
        expect(typeof t).toBe('string');
        expect(t.length).toBeGreaterThan(0);
      });
    });
  });

  it('has at least one reference on every entry', () => {
    ELECTRONICS_KNOWLEDGE.forEach((entry) => {
      expect(entry.references.length, `${entry.id} should cite at least one vault note`)
        .toBeGreaterThan(0);
    });
  });

  it('cites only real vault notes under knowledge/', () => {
    const missing: Array<{ id: string; slug: string }> = [];
    ELECTRONICS_KNOWLEDGE.forEach((entry) => {
      entry.references.forEach((slug) => {
        const filePath = join(VAULT_DIR, `${slug}.md`);
        if (!existsSync(filePath)) {
          missing.push({ id: entry.id, slug });
        }
      });
    });
    expect(missing, `Missing vault notes: ${JSON.stringify(missing, null, 2)}`)
      .toEqual([]);
  });
});

describe('getElectronicsKnowledge', () => {
  it('returns the matching entry for each known topic', () => {
    ELECTRONICS_KNOWLEDGE.forEach((entry) => {
      const got: ElectronicsRule = getElectronicsKnowledge(entry.id);
      expect(got.id).toBe(entry.id);
    });
  });

  it('throws for an unknown topic id', () => {
    expect(() =>
      getElectronicsKnowledge('does-not-exist' as ElectronicsTopicId),
    ).toThrowError(/Unknown electronics knowledge topic/);
  });
});
