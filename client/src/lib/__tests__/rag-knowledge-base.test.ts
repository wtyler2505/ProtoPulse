import { describe, it, expect, beforeEach } from 'vitest';
import {
  KNOWLEDGE_BASE,
  KNOWLEDGE_CATEGORIES,
  getKnowledgeDocuments,
} from '../rag-knowledge-base';
import type { KnowledgeEntry } from '../rag-knowledge-base';
import { RAGEngine } from '../rag-engine';

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  RAGEngine.resetInstance();
  localStorage.clear();
});

// ===========================================================================
// Structure validation
// ===========================================================================

describe('KNOWLEDGE_BASE structure', () => {
  it('has at least 20 entries', () => {
    expect(KNOWLEDGE_BASE.length).toBeGreaterThanOrEqual(20);
  });

  it('every entry has all required fields', () => {
    for (const entry of KNOWLEDGE_BASE) {
      expect(entry.id).toBeTruthy();
      expect(typeof entry.id).toBe('string');
      expect(entry.title).toBeTruthy();
      expect(typeof entry.title).toBe('string');
      expect(entry.category).toBeTruthy();
      expect(typeof entry.category).toBe('string');
      expect(entry.content).toBeTruthy();
      expect(typeof entry.content).toBe('string');
      expect(Array.isArray(entry.tags)).toBe(true);
      expect(entry.tags.length).toBeGreaterThan(0);
    }
  });

  it('all IDs are unique', () => {
    const ids = KNOWLEDGE_BASE.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all titles are unique', () => {
    const titles = KNOWLEDGE_BASE.map((e) => e.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('content length is within bounds (50-2000 chars)', () => {
    for (const entry of KNOWLEDGE_BASE) {
      expect(entry.content.length).toBeGreaterThanOrEqual(50);
      expect(entry.content.length).toBeLessThanOrEqual(2000);
    }
  });

  it('all tags are lowercase', () => {
    for (const entry of KNOWLEDGE_BASE) {
      for (const tag of entry.tags) {
        expect(tag).toBe(tag.toLowerCase());
      }
    }
  });

  it('all categories are valid', () => {
    const validCategories = new Set<string>(KNOWLEDGE_CATEGORIES);
    for (const entry of KNOWLEDGE_BASE) {
      expect(validCategories.has(entry.category)).toBe(true);
    }
  });

  it('IDs follow kb- prefix convention', () => {
    for (const entry of KNOWLEDGE_BASE) {
      expect(entry.id).toMatch(/^kb-/);
    }
  });

  it('tags contain no empty strings', () => {
    for (const entry of KNOWLEDGE_BASE) {
      for (const tag of entry.tags) {
        expect(tag.length).toBeGreaterThan(0);
      }
    }
  });
});

// ===========================================================================
// Content coverage
// ===========================================================================

describe('KNOWLEDGE_BASE content coverage', () => {
  const byCategory = (cat: string): KnowledgeEntry[] =>
    KNOWLEDGE_BASE.filter((e) => e.category === cat);

  it('has microcontroller entries', () => {
    expect(byCategory('microcontroller').length).toBeGreaterThanOrEqual(2);
  });

  it('has passive component entries', () => {
    expect(byCategory('passive').length).toBeGreaterThanOrEqual(2);
  });

  it('has power entries', () => {
    expect(byCategory('power').length).toBeGreaterThanOrEqual(1);
  });

  it('has communication protocol entries', () => {
    expect(byCategory('communication').length).toBeGreaterThanOrEqual(2);
  });

  it('has design practice entries', () => {
    expect(byCategory('design-practice').length).toBeGreaterThanOrEqual(1);
  });

  it('includes ATmega328P', () => {
    expect(KNOWLEDGE_BASE.find((e) => e.id === 'kb-atmega328p')).toBeDefined();
  });

  it('includes ESP32', () => {
    expect(KNOWLEDGE_BASE.find((e) => e.id === 'kb-esp32')).toBeDefined();
  });

  it('includes NE555', () => {
    expect(KNOWLEDGE_BASE.find((e) => e.id === 'kb-ne555')).toBeDefined();
  });

  it('includes LM7805', () => {
    expect(KNOWLEDGE_BASE.find((e) => e.id === 'kb-lm7805')).toBeDefined();
  });

  it('includes Arduino Uno', () => {
    expect(KNOWLEDGE_BASE.find((e) => e.id === 'kb-arduino-uno')).toBeDefined();
  });
});

// ===========================================================================
// getKnowledgeDocuments()
// ===========================================================================

describe('getKnowledgeDocuments', () => {
  it('returns same count as KNOWLEDGE_BASE', () => {
    const docs = getKnowledgeDocuments();
    expect(docs.length).toBe(KNOWLEDGE_BASE.length);
  });

  it('maps entries to document format correctly', () => {
    const docs = getKnowledgeDocuments();
    for (const doc of docs) {
      expect(doc.id).toBeTruthy();
      expect(doc.title).toBeTruthy();
      expect(doc.source).toBe('built-in-knowledge');
      expect(doc.content).toBeTruthy();
      expect(doc.metadata).toBeDefined();
      expect(doc.metadata.category).toBeTruthy();
      expect(doc.metadata.tags).toBeTruthy();
    }
  });

  it('preserves IDs from knowledge base', () => {
    const docs = getKnowledgeDocuments();
    const docIds = new Set(docs.map((d) => d.id));
    for (const entry of KNOWLEDGE_BASE) {
      expect(docIds.has(entry.id)).toBe(true);
    }
  });

  it('metadata tags are comma-separated', () => {
    const docs = getKnowledgeDocuments();
    for (const doc of docs) {
      // Tags should be comma-separated string
      expect(doc.metadata.tags).toMatch(/^[a-z0-9\-_]+(,[a-z0-9\-_]+)*$/);
    }
  });
});

// ===========================================================================
// Integration with RAGEngine
// ===========================================================================

describe('knowledge base + RAGEngine integration', () => {
  it('loads all entries into engine without errors', () => {
    const engine = new RAGEngine();
    const docs = getKnowledgeDocuments();
    for (const doc of docs) {
      engine.addDocument(doc);
    }
    expect(engine.documentCount).toBe(docs.length);
  });

  it('search for ATmega328P returns relevant result', () => {
    const engine = new RAGEngine();
    const docs = getKnowledgeDocuments();
    for (const doc of docs) {
      engine.addDocument(doc);
    }
    const results = engine.search('ATmega328P 16MHz flash memory');
    expect(results.length).toBeGreaterThan(0);
    // The top result should be the ATmega328P entry or closely related
    const topIds = results.slice(0, 3).map((r) => r.document.id);
    expect(topIds).toContain('kb-atmega328p');
  });

  it('search for ESP32 WiFi returns relevant result', () => {
    const engine = new RAGEngine();
    const docs = getKnowledgeDocuments();
    for (const doc of docs) {
      engine.addDocument(doc);
    }
    const results = engine.search('ESP32 WiFi Bluetooth wireless');
    expect(results.length).toBeGreaterThan(0);
    const topIds = results.slice(0, 3).map((r) => r.document.id);
    expect(topIds).toContain('kb-esp32');
  });

  it('search for voltage regulator returns power entries', () => {
    const engine = new RAGEngine();
    const docs = getKnowledgeDocuments();
    for (const doc of docs) {
      engine.addDocument(doc);
    }
    const results = engine.search('voltage regulator 5V output dropout');
    expect(results.length).toBeGreaterThan(0);
    const topDocIds = results.slice(0, 5).map((r) => r.document.id);
    // Should include one of the voltage regulator entries
    const hasRegulator = topDocIds.some((id) => id === 'kb-lm7805' || id === 'kb-lm317');
    expect(hasRegulator).toBe(true);
  });
});
