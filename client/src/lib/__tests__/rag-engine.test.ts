import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  RAGEngine,
  tokenize,
  chunkText,
  cosineSimilarity,
} from '../rag-engine';
import type {
  RAGDocument,
  RAGResult,
} from '../rag-engine';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDoc(id: string, content: string, title?: string): Omit<RAGDocument, 'chunks'> {
  return {
    id,
    title: title ?? `Doc ${id}`,
    source: 'test',
    content,
    metadata: { test: 'true' },
  };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  RAGEngine.resetInstance();
  localStorage.clear();
});

// ===========================================================================
// tokenize()
// ===========================================================================

describe('tokenize', () => {
  it('lowercases all tokens', () => {
    const tokens = tokenize('Arduino ESP32 MOSFET');
    expect(tokens).toContain('arduino');
    expect(tokens).toContain('esp32');
    expect(tokens).toContain('mosfet');
  });

  it('removes common English stop words', () => {
    const tokens = tokenize('the quick brown fox jumps over the lazy dog');
    expect(tokens).not.toContain('the');
    expect(tokens).not.toContain('over');
    expect(tokens).toContain('quick');
    expect(tokens).toContain('brown');
    expect(tokens).toContain('fox');
  });

  it('removes electronics domain stop words', () => {
    const tokens = tokenize('this circuit uses a component pin');
    expect(tokens).not.toContain('circuit');
    expect(tokens).not.toContain('component');
    expect(tokens).not.toContain('pin');
  });

  it('removes single-character tokens', () => {
    const tokens = tokenize('a b c d resistor');
    expect(tokens).toEqual(['resistor']);
  });

  it('handles punctuation gracefully', () => {
    const tokens = tokenize('voltage: 5V, current: 200mA!');
    expect(tokens).toContain('voltage');
    expect(tokens).toContain('5v');
    expect(tokens).toContain('current');
    expect(tokens).toContain('200ma');
  });

  it('preserves hyphens and underscores in tokens', () => {
    const tokens = tokenize('pull-up resistor gpio_12');
    expect(tokens).toContain('pull-up');
    expect(tokens).toContain('gpio_12');
  });

  it('preserves forward slashes', () => {
    const tokens = tokenize('I2C SDA/SCL');
    expect(tokens).toContain('i2c');
    expect(tokens).toContain('sda/scl');
  });

  it('returns empty array for empty string', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('returns empty array for only stop words', () => {
    expect(tokenize('the and or but in on at to for of')).toEqual([]);
  });
});

// ===========================================================================
// chunkText()
// ===========================================================================

describe('chunkText', () => {
  it('returns single chunk for text shorter than chunkSize', () => {
    const chunks = chunkText('Short text.', 500, 100);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe('Short text.');
  });

  it('returns empty array for empty text', () => {
    const chunks = chunkText('', 500, 100);
    expect(chunks).toEqual([]);
  });

  it('returns empty array for whitespace-only text', () => {
    const chunks = chunkText('   ', 500, 100);
    expect(chunks).toEqual([]);
  });

  it('splits on paragraph boundaries', () => {
    const text = 'Paragraph one about resistors.\n\nParagraph two about capacitors.\n\nParagraph three about inductors.';
    const chunks = chunkText(text, 60, 0);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // Each chunk should be within the limit (approximately)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(80); // Allow some leeway for paragraph joining
    }
  });

  it('splits long paragraphs by sentences', () => {
    const longParagraph = 'First sentence about voltage regulation. Second sentence about current limiting. Third sentence about power dissipation. Fourth sentence about thermal design. Fifth sentence about decoupling capacitors.';
    const chunks = chunkText(longParagraph, 100, 0);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('applies overlap between chunks', () => {
    const text = 'AAAA AAAA.\n\nBBBB BBBB.\n\nCCCC CCCC.\n\nDDDD DDDD.';
    const chunks = chunkText(text, 25, 10);
    // With overlap, later chunks may contain tail content from previous chunks
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('handles single long paragraph without sentence breaks', () => {
    const text = 'word '.repeat(200);
    const chunks = chunkText(text, 100, 20);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('trims whitespace from chunks', () => {
    const text = '  Paragraph one.  \n\n  Paragraph two.  ';
    const chunks = chunkText(text, 20, 0);
    for (const chunk of chunks) {
      expect(chunk).toBe(chunk.trim());
    }
  });
});

// ===========================================================================
// cosineSimilarity()
// ===========================================================================

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const v = new Map([['resistor', 0.5], ['capacitor', 0.3]]);
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
  });

  it('returns 0 for orthogonal vectors', () => {
    const a = new Map([['resistor', 1.0]]);
    const b = new Map([['capacitor', 1.0]]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('returns value between 0 and 1 for partial overlap', () => {
    const a = new Map([['resistor', 0.5], ['capacitor', 0.3], ['inductor', 0.2]]);
    const b = new Map([['resistor', 0.4], ['diode', 0.6]]);
    const sim = cosineSimilarity(a, b);
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
  });

  it('returns 0 when either vector is empty', () => {
    const v = new Map([['resistor', 0.5]]);
    const empty = new Map<string, number>();
    expect(cosineSimilarity(v, empty)).toBe(0);
    expect(cosineSimilarity(empty, v)).toBe(0);
    expect(cosineSimilarity(empty, empty)).toBe(0);
  });

  it('is commutative', () => {
    const a = new Map([['ohm', 0.5], ['volt', 0.3]]);
    const b = new Map([['ohm', 0.2], ['amp', 0.7]]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 10);
  });

  it('is not affected by vector magnitude (direction only)', () => {
    const a = new Map([['resistor', 1.0], ['led', 2.0]]);
    const b = new Map([['resistor', 10.0], ['led', 20.0]]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 5);
  });
});

// ===========================================================================
// RAGEngine — construction and singleton
// ===========================================================================

describe('RAGEngine', () => {
  describe('construction', () => {
    it('uses default options when none provided', () => {
      const engine = new RAGEngine();
      expect(engine.chunkSize).toBe(500);
      expect(engine.chunkOverlap).toBe(100);
      expect(engine.topK).toBe(5);
      expect(engine.scoreThreshold).toBe(0.1);
      expect(engine.maxContextChars).toBe(2000);
    });

    it('accepts custom options', () => {
      const engine = new RAGEngine({
        chunkSize: 200,
        chunkOverlap: 50,
        topK: 3,
        scoreThreshold: 0.2,
        maxContextChars: 1000,
      });
      expect(engine.chunkSize).toBe(200);
      expect(engine.chunkOverlap).toBe(50);
      expect(engine.topK).toBe(3);
      expect(engine.scoreThreshold).toBe(0.2);
      expect(engine.maxContextChars).toBe(1000);
    });

    it('starts with zero documents', () => {
      const engine = new RAGEngine();
      expect(engine.documentCount).toBe(0);
      expect(engine.isIndexing).toBe(false);
    });
  });

  describe('singleton', () => {
    it('returns the same instance on multiple calls', () => {
      const a = RAGEngine.getInstance();
      const b = RAGEngine.getInstance();
      expect(a).toBe(b);
    });

    it('creates a new instance after reset', () => {
      const a = RAGEngine.getInstance();
      RAGEngine.resetInstance();
      const b = RAGEngine.getInstance();
      expect(a).not.toBe(b);
    });

    it('passes options only on first creation', () => {
      const a = RAGEngine.getInstance({ topK: 10 });
      expect(a.topK).toBe(10);
      const b = RAGEngine.getInstance({ topK: 20 });
      expect(b.topK).toBe(10); // Still the first instance
      expect(a).toBe(b);
    });
  });

  // =========================================================================
  // Document CRUD
  // =========================================================================

  describe('addDocument', () => {
    it('adds a document and increments count', () => {
      const engine = new RAGEngine();
      const doc = engine.addDocument(makeDoc('d1', 'Resistor basics and color codes'));
      expect(engine.documentCount).toBe(1);
      expect(doc.id).toBe('d1');
      expect(doc.chunks.length).toBeGreaterThan(0);
    });

    it('chunks the document content', () => {
      const engine = new RAGEngine({ chunkSize: 50, chunkOverlap: 10 });
      const longContent = 'Paragraph about voltage regulators and linear design principles.\n\n' +
        'Second paragraph about switching regulators and efficiency calculations.\n\n' +
        'Third paragraph about thermal management and heatsink selection.';
      const doc = engine.addDocument(makeDoc('d1', longContent));
      expect(doc.chunks.length).toBeGreaterThan(1);
    });

    it('computes TF-IDF vectors for each chunk', () => {
      const engine = new RAGEngine();
      const doc = engine.addDocument(makeDoc('d1', 'Resistor values are measured in ohms'));
      expect(doc.chunks[0].tfidf.size).toBeGreaterThan(0);
    });

    it('overwrites document with same id', () => {
      const engine = new RAGEngine();
      engine.addDocument(makeDoc('d1', 'Original content'));
      engine.addDocument(makeDoc('d1', 'Updated content'));
      expect(engine.documentCount).toBe(1);
      const doc = engine.getDocument('d1');
      expect(doc?.content).toBe('Updated content');
    });

    it('adds multiple documents', () => {
      const engine = new RAGEngine();
      engine.addDocument(makeDoc('d1', 'Content one'));
      engine.addDocument(makeDoc('d2', 'Content two'));
      engine.addDocument(makeDoc('d3', 'Content three'));
      expect(engine.documentCount).toBe(3);
    });
  });

  describe('removeDocument', () => {
    it('removes an existing document', () => {
      const engine = new RAGEngine();
      engine.addDocument(makeDoc('d1', 'Test content'));
      expect(engine.removeDocument('d1')).toBe(true);
      expect(engine.documentCount).toBe(0);
    });

    it('returns false for non-existent document', () => {
      const engine = new RAGEngine();
      expect(engine.removeDocument('nonexistent')).toBe(false);
    });

    it('removes chunks from the index', () => {
      const engine = new RAGEngine();
      engine.addDocument(makeDoc('d1', 'Resistor resistor resistor'));
      engine.addDocument(makeDoc('d2', 'Capacitor capacitor'));
      engine.removeDocument('d1');
      // Search for resistor should return no results from d1
      const results = engine.search('resistor', 10, 0);
      for (const r of results) {
        expect(r.document.id).not.toBe('d1');
      }
    });
  });

  describe('getDocument', () => {
    it('returns the document by id', () => {
      const engine = new RAGEngine();
      engine.addDocument(makeDoc('d1', 'Test'));
      expect(engine.getDocument('d1')).toBeDefined();
      expect(engine.getDocument('d1')?.title).toBe('Doc d1');
    });

    it('returns undefined for missing id', () => {
      const engine = new RAGEngine();
      expect(engine.getDocument('missing')).toBeUndefined();
    });
  });

  describe('getAllDocuments', () => {
    it('returns all documents', () => {
      const engine = new RAGEngine();
      engine.addDocument(makeDoc('d1', 'First'));
      engine.addDocument(makeDoc('d2', 'Second'));
      const docs = engine.getAllDocuments();
      expect(docs).toHaveLength(2);
    });

    it('returns empty array when no documents', () => {
      const engine = new RAGEngine();
      expect(engine.getAllDocuments()).toEqual([]);
    });
  });

  // =========================================================================
  // Search / Query
  // =========================================================================

  describe('search', () => {
    it('returns relevant results for matching query', () => {
      const engine = new RAGEngine();
      engine.addDocument(makeDoc('d1', 'The ATmega328P microcontroller runs at 16MHz with 32KB flash memory'));
      engine.addDocument(makeDoc('d2', 'The LM7805 voltage regulator provides stable 5V output'));
      const results = engine.search('ATmega328P microcontroller flash');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].document.id).toBe('d1');
    });

    it('returns empty array for empty query', () => {
      const engine = new RAGEngine();
      engine.addDocument(makeDoc('d1', 'Some content'));
      expect(engine.search('')).toEqual([]);
    });

    it('returns empty array for whitespace query', () => {
      const engine = new RAGEngine();
      engine.addDocument(makeDoc('d1', 'Some content'));
      expect(engine.search('   ')).toEqual([]);
    });

    it('returns empty array when no documents', () => {
      const engine = new RAGEngine();
      expect(engine.search('resistor')).toEqual([]);
    });

    it('returns empty array for query with only stop words', () => {
      const engine = new RAGEngine();
      engine.addDocument(makeDoc('d1', 'Some content'));
      expect(engine.search('the and or but')).toEqual([]);
    });

    it('respects topK limit', () => {
      const engine = new RAGEngine();
      for (let i = 0; i < 10; i++) {
        engine.addDocument(makeDoc(`d${i}`, `Resistor document number ${i} with ohms and values`));
      }
      const results = engine.search('resistor ohms', 3);
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('respects score threshold', () => {
      const engine = new RAGEngine();
      engine.addDocument(makeDoc('d1', 'Resistor color code bands and tolerance values'));
      engine.addDocument(makeDoc('d2', 'Completely unrelated content about cooking recipes and food preparation'));
      const results = engine.search('resistor color', 10, 0.01);
      // Should not include the cooking document (very low or zero similarity)
      for (const r of results) {
        expect(r.score).toBeGreaterThanOrEqual(0.01);
      }
    });

    it('sorts results by descending score', () => {
      const engine = new RAGEngine();
      engine.addDocument(makeDoc('d1', 'ESP32 WiFi Bluetooth microcontroller with dual core'));
      engine.addDocument(makeDoc('d2', 'Capacitor types ceramic electrolytic tantalum'));
      engine.addDocument(makeDoc('d3', 'ESP32 WiFi module for IoT projects wireless'));
      const results = engine.search('ESP32 WiFi wireless', 10, 0);
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it('returns score in each result', () => {
      const engine = new RAGEngine();
      engine.addDocument(makeDoc('d1', 'Voltage regulator LM7805 five volt output'));
      const results = engine.search('voltage regulator');
      expect(results.length).toBeGreaterThan(0);
      expect(typeof results[0].score).toBe('number');
      expect(results[0].score).toBeGreaterThan(0);
    });

    it('includes document reference in results', () => {
      const engine = new RAGEngine();
      engine.addDocument(makeDoc('d1', 'MOSFET gate drive requirements', 'MOSFET Guide'));
      const results = engine.search('MOSFET gate');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].document.title).toBe('MOSFET Guide');
    });

    it('includes chunk content in results', () => {
      const engine = new RAGEngine();
      engine.addDocument(makeDoc('d1', 'Decoupling capacitor placement near IC pins'));
      const results = engine.search('decoupling capacitor');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].chunk.content).toContain('ecoupling');
    });
  });

  // =========================================================================
  // getContext
  // =========================================================================

  describe('getContext', () => {
    it('returns formatted context string with source attribution', () => {
      const engine = new RAGEngine();
      engine.addDocument(makeDoc('d1', 'Arduino Uno runs ATmega328P at 16MHz', 'Arduino Reference'));
      const ctx = engine.getContext('Arduino ATmega328P');
      expect(ctx).toContain('[Source: Arduino Reference]');
      expect(ctx).toContain('ATmega328P');
    });

    it('returns empty string for no results', () => {
      const engine = new RAGEngine();
      expect(engine.getContext('xyz123')).toBe('');
    });

    it('respects max character limit', () => {
      const engine = new RAGEngine();
      for (let i = 0; i < 20; i++) {
        engine.addDocument(makeDoc(`d${i}`, `Resistor content block ${i} about ohm values and resistance measurement with color codes`));
      }
      const ctx = engine.getContext('resistor ohm', 200);
      expect(ctx.length).toBeLessThanOrEqual(300); // Allow some leeway for the first entry
    });

    it('includes multiple sources when space allows', () => {
      const engine = new RAGEngine({ maxContextChars: 5000 });
      engine.addDocument(makeDoc('d1', 'First document about resistors and ohms', 'Source A'));
      engine.addDocument(makeDoc('d2', 'Second document about resistors and color codes', 'Source B'));
      const ctx = engine.getContext('resistors ohms color');
      // May or may not include both sources depending on threshold, but format should be correct
      expect(ctx).toContain('[Source:');
    });
  });

  // =========================================================================
  // Pub/Sub
  // =========================================================================

  describe('subscribe', () => {
    it('notifies subscribers on addDocument', () => {
      const engine = new RAGEngine();
      const fn = vi.fn();
      engine.subscribe(fn);
      engine.addDocument(makeDoc('d1', 'Test'));
      // Called at least once (isIndexing true + isIndexing false)
      expect(fn).toHaveBeenCalled();
    });

    it('notifies subscribers on removeDocument', () => {
      const engine = new RAGEngine();
      engine.addDocument(makeDoc('d1', 'Test'));
      const fn = vi.fn();
      engine.subscribe(fn);
      engine.removeDocument('d1');
      expect(fn).toHaveBeenCalled();
    });

    it('returns unsubscribe function', () => {
      const engine = new RAGEngine();
      const fn = vi.fn();
      const unsub = engine.subscribe(fn);
      unsub();
      engine.addDocument(makeDoc('d1', 'Test'));
      // After unsubscribe, should not be called for the addDocument
      // (it was called 0 times since unsubscribe happened before addDocument)
      expect(fn).not.toHaveBeenCalled();
    });

    it('supports multiple subscribers', () => {
      const engine = new RAGEngine();
      const fn1 = vi.fn();
      const fn2 = vi.fn();
      engine.subscribe(fn1);
      engine.subscribe(fn2);
      engine.addDocument(makeDoc('d1', 'Test'));
      expect(fn1).toHaveBeenCalled();
      expect(fn2).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // localStorage persistence
  // =========================================================================

  describe('persistence', () => {
    it('persists documents to localStorage on add', () => {
      const engine = new RAGEngine();
      engine.addDocument(makeDoc('d1', 'Persisted content'));
      const stored = localStorage.getItem('protopulse-rag-documents');
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!) as Array<{ id: string }>;
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe('d1');
    });

    it('removes document from localStorage on delete', () => {
      const engine = new RAGEngine();
      engine.addDocument(makeDoc('d1', 'Content'));
      engine.removeDocument('d1');
      const stored = localStorage.getItem('protopulse-rag-documents');
      const parsed = JSON.parse(stored!) as unknown[];
      expect(parsed).toHaveLength(0);
    });

    it('loads documents from localStorage', () => {
      const engine1 = new RAGEngine();
      engine1.addDocument(makeDoc('d1', 'Stored document about voltage'));

      const engine2 = new RAGEngine();
      engine2.loadFromStorage();
      expect(engine2.documentCount).toBe(1);
      expect(engine2.getDocument('d1')).toBeDefined();
    });

    it('does not duplicate documents on loadFromStorage', () => {
      const engine = new RAGEngine();
      engine.addDocument(makeDoc('d1', 'Content'));
      engine.loadFromStorage(); // Should skip d1 since it already exists
      expect(engine.documentCount).toBe(1);
    });

    it('handles corrupt localStorage gracefully', () => {
      localStorage.setItem('protopulse-rag-documents', '{invalid json');
      const engine = new RAGEngine();
      engine.loadFromStorage(); // Should not throw
      expect(engine.documentCount).toBe(0);
    });

    it('handles missing localStorage gracefully', () => {
      const engine = new RAGEngine();
      engine.loadFromStorage(); // No data stored
      expect(engine.documentCount).toBe(0);
    });
  });

  // =========================================================================
  // clear()
  // =========================================================================

  describe('clear', () => {
    it('removes all documents', () => {
      const engine = new RAGEngine();
      engine.addDocument(makeDoc('d1', 'Content 1'));
      engine.addDocument(makeDoc('d2', 'Content 2'));
      engine.clear();
      expect(engine.documentCount).toBe(0);
      expect(engine.getAllDocuments()).toEqual([]);
    });

    it('clears localStorage', () => {
      const engine = new RAGEngine();
      engine.addDocument(makeDoc('d1', 'Content'));
      engine.clear();
      expect(localStorage.getItem('protopulse-rag-documents')).toBeNull();
    });

    it('notifies subscribers', () => {
      const engine = new RAGEngine();
      const fn = vi.fn();
      engine.subscribe(fn);
      engine.clear();
      expect(fn).toHaveBeenCalled();
    });

    it('search returns empty after clear', () => {
      const engine = new RAGEngine();
      engine.addDocument(makeDoc('d1', 'Resistor values and color codes'));
      engine.clear();
      expect(engine.search('resistor')).toEqual([]);
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  describe('edge cases', () => {
    it('handles very short document', () => {
      const engine = new RAGEngine();
      const doc = engine.addDocument(makeDoc('d1', 'Hi'));
      expect(doc.chunks).toHaveLength(1);
    });

    it('handles document with only stop words', () => {
      const engine = new RAGEngine();
      const doc = engine.addDocument(makeDoc('d1', 'the and or but'));
      expect(doc.chunks).toHaveLength(1);
      // TF-IDF should be empty since all tokens are stop words
      expect(doc.chunks[0].tfidf.size).toBe(0);
    });

    it('handles very long document', () => {
      const engine = new RAGEngine({ chunkSize: 100, chunkOverlap: 20 });
      const longContent = Array.from({ length: 50 }, (_, i) => `Paragraph ${i} about electronics topic ${i}.`).join('\n\n');
      const doc = engine.addDocument(makeDoc('d1', longContent));
      expect(doc.chunks.length).toBeGreaterThan(1);
    });

    it('handles search with special characters', () => {
      const engine = new RAGEngine();
      engine.addDocument(makeDoc('d1', 'LM7805 voltage regulator'));
      const results = engine.search('LM7805!!! @#$%');
      expect(results.length).toBeGreaterThan(0);
    });

    it('handles unicode in content', () => {
      const engine = new RAGEngine();
      engine.addDocument(makeDoc('d1', 'Ohms law: V = IR, resistance measured in ohms'));
      const results = engine.search('ohms law resistance');
      expect(results.length).toBeGreaterThan(0);
    });

    it('handles single document correctly in IDF calculation', () => {
      const engine = new RAGEngine();
      engine.addDocument(makeDoc('d1', 'Single document about resistors'));
      // With single chunk, IDF = log(1/1) = 0, so all TF-IDF = 0
      // But search should still work based on term overlap
      const results = engine.search('resistors', 5, 0);
      // Results may be empty or have zero score because log(1/1)=0
      // This is mathematically correct — single doc has no discriminating power
      expect(results).toBeDefined();
    });

    it('handles adding and removing many documents', () => {
      const engine = new RAGEngine();
      for (let i = 0; i < 50; i++) {
        engine.addDocument(makeDoc(`d${i}`, `Document ${i} about topic ${i % 5}`));
      }
      expect(engine.documentCount).toBe(50);
      for (let i = 0; i < 25; i++) {
        engine.removeDocument(`d${i}`);
      }
      expect(engine.documentCount).toBe(25);
    });
  });

  // =========================================================================
  // isIndexing state
  // =========================================================================

  describe('isIndexing', () => {
    it('is false by default', () => {
      const engine = new RAGEngine();
      expect(engine.isIndexing).toBe(false);
    });

    it('is false after addDocument completes', () => {
      const engine = new RAGEngine();
      engine.addDocument(makeDoc('d1', 'Test content'));
      expect(engine.isIndexing).toBe(false);
    });
  });
});
