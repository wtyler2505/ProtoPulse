import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { ElectronicsKnowledgeBase, useKnowledgeBase } from '../electronics-knowledge';
import type { ArticleCategory, DifficultyLevel, KnowledgeArticle } from '../electronics-knowledge';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let kb: ElectronicsKnowledgeBase;

beforeEach(() => {
  ElectronicsKnowledgeBase.resetForTesting();
  kb = ElectronicsKnowledgeBase.getInstance();
});

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

describe('ElectronicsKnowledgeBase - Singleton', () => {
  it('returns the same instance on repeated calls', () => {
    const a = ElectronicsKnowledgeBase.getInstance();
    const b = ElectronicsKnowledgeBase.getInstance();
    expect(a).toBe(b);
  });

  it('creates a fresh instance after resetForTesting', () => {
    const first = ElectronicsKnowledgeBase.getInstance();
    ElectronicsKnowledgeBase.resetForTesting();
    const second = ElectronicsKnowledgeBase.getInstance();
    expect(first).not.toBe(second);
  });
});

// ---------------------------------------------------------------------------
// Article Content Validation
// ---------------------------------------------------------------------------

describe('ElectronicsKnowledgeBase - Article Content', () => {
  it('has at least 20 built-in articles', () => {
    expect(kb.getArticleCount()).toBeGreaterThanOrEqual(20);
  });

  it('every article has a non-empty id', () => {
    for (const article of kb.getAllArticles()) {
      expect(article.id).toBeTruthy();
      expect(article.id.length).toBeGreaterThan(0);
    }
  });

  it('every article has a non-empty title', () => {
    for (const article of kb.getAllArticles()) {
      expect(article.title).toBeTruthy();
      expect(article.title.length).toBeGreaterThan(0);
    }
  });

  it('every article has non-empty content', () => {
    for (const article of kb.getAllArticles()) {
      expect(article.content).toBeTruthy();
      expect(article.content.length).toBeGreaterThan(50);
    }
  });

  it('every article has a valid category', () => {
    const validCategories: ArticleCategory[] = [
      'passive-components',
      'active-components',
      'power',
      'communication',
      'pcb',
      'techniques',
    ];
    for (const article of kb.getAllArticles()) {
      expect(validCategories).toContain(article.category);
    }
  });

  it('every article has a valid difficulty', () => {
    const validDifficulties: DifficultyLevel[] = ['beginner', 'intermediate', 'advanced'];
    for (const article of kb.getAllArticles()) {
      expect(validDifficulties).toContain(article.difficulty);
    }
  });

  it('every article has at least one tag', () => {
    for (const article of kb.getAllArticles()) {
      expect(article.tags.length).toBeGreaterThan(0);
    }
  });

  it('every article has at least one related topic', () => {
    for (const article of kb.getAllArticles()) {
      expect(article.relatedTopics.length).toBeGreaterThan(0);
    }
  });

  it('all article IDs are unique', () => {
    const ids = kb.getAllArticles().map((a) => a.id);
    const unique = ids.filter((v, i, a) => a.indexOf(v) === i);
    expect(unique.length).toBe(ids.length);
  });

  it('related topics reference valid article IDs', () => {
    const allIds = kb.getAllArticles().map((a) => a.id);
    for (const article of kb.getAllArticles()) {
      for (const related of article.relatedTopics) {
        expect(allIds).toContain(related);
      }
    }
  });

  it('contains articles about core passive components', () => {
    expect(kb.getArticle('resistors')).not.toBeNull();
    expect(kb.getArticle('capacitors')).not.toBeNull();
    expect(kb.getArticle('inductors')).not.toBeNull();
  });

  it('contains articles about core active components', () => {
    expect(kb.getArticle('diodes')).not.toBeNull();
    expect(kb.getArticle('transistors')).not.toBeNull();
    expect(kb.getArticle('mosfets')).not.toBeNull();
    expect(kb.getArticle('op-amps')).not.toBeNull();
  });

  it('contains articles about communication protocols', () => {
    expect(kb.getArticle('i2c')).not.toBeNull();
    expect(kb.getArticle('spi')).not.toBeNull();
    expect(kb.getArticle('uart')).not.toBeNull();
  });

  it('contains articles about power', () => {
    expect(kb.getArticle('voltage-regulators')).not.toBeNull();
    expect(kb.getArticle('voltage-dividers')).not.toBeNull();
    expect(kb.getArticle('decoupling-capacitors')).not.toBeNull();
  });

  it('contains articles about PCB and techniques', () => {
    expect(kb.getArticle('pcb-basics')).not.toBeNull();
    expect(kb.getArticle('soldering-tips')).not.toBeNull();
    expect(kb.getArticle('pwm')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getArticle
// ---------------------------------------------------------------------------

describe('ElectronicsKnowledgeBase - getArticle', () => {
  it('returns article by ID', () => {
    const article = kb.getArticle('resistors');
    expect(article).not.toBeNull();
    expect(article!.id).toBe('resistors');
    expect(article!.title).toBe('Resistors');
  });

  it('returns null for unknown ID', () => {
    expect(kb.getArticle('nonexistent-article')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(kb.getArticle('')).toBeNull();
  });

  it('article content contains relevant information', () => {
    const resistors = kb.getArticle('resistors');
    expect(resistors!.content).toContain('Ohm');
    expect(resistors!.content).toContain('V = I');
  });

  it('article has correct category', () => {
    const resistors = kb.getArticle('resistors');
    expect(resistors!.category).toBe('passive-components');

    const mosfets = kb.getArticle('mosfets');
    expect(mosfets!.category).toBe('active-components');

    const uart = kb.getArticle('uart');
    expect(uart!.category).toBe('communication');
  });
});

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

describe('ElectronicsKnowledgeBase - Search', () => {
  it('finds articles by title keyword', () => {
    const results = kb.search('resistor');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title.toLowerCase()).toContain('resistor');
  });

  it('finds articles by tag', () => {
    const results = kb.search('MOSFET');
    expect(results.length).toBeGreaterThan(0);
    const ids = results.map((a) => a.id);
    expect(ids).toContain('mosfets');
  });

  it('finds articles by content keyword', () => {
    const results = kb.search('Arduino');
    expect(results.length).toBeGreaterThan(0);
  });

  it('is case-insensitive', () => {
    const lower = kb.search('capacitor');
    const upper = kb.search('CAPACITOR');
    const mixed = kb.search('Capacitor');
    expect(lower.map((a) => a.id)).toEqual(upper.map((a) => a.id));
    expect(lower.map((a) => a.id)).toEqual(mixed.map((a) => a.id));
  });

  it('returns empty array for empty query', () => {
    expect(kb.search('')).toEqual([]);
  });

  it('returns empty array for whitespace-only query', () => {
    expect(kb.search('   ')).toEqual([]);
  });

  it('returns empty array for no matches', () => {
    expect(kb.search('xyznonexistentkeyword123')).toEqual([]);
  });

  it('ranks title matches higher than content matches', () => {
    const results = kb.search('resistor');
    // The 'Resistors' article should be first since 'resistor' appears in its title
    expect(results[0].id).toBe('resistors');
  });

  it('handles multi-word queries', () => {
    const results = kb.search('voltage divider');
    expect(results.length).toBeGreaterThan(0);
    const ids = results.map((a) => a.id);
    expect(ids).toContain('voltage-dividers');
  });

  it('matches articles by category keyword', () => {
    const results = kb.search('communication');
    expect(results.length).toBeGreaterThan(0);
    const categories = results.map((a) => a.category);
    expect(categories).toContain('communication');
  });
});

// ---------------------------------------------------------------------------
// getByCategory
// ---------------------------------------------------------------------------

describe('ElectronicsKnowledgeBase - getByCategory', () => {
  it('returns passive component articles', () => {
    const results = kb.getByCategory('passive-components');
    expect(results.length).toBeGreaterThan(0);
    for (const article of results) {
      expect(article.category).toBe('passive-components');
    }
  });

  it('returns active component articles', () => {
    const results = kb.getByCategory('active-components');
    expect(results.length).toBeGreaterThan(0);
    for (const article of results) {
      expect(article.category).toBe('active-components');
    }
  });

  it('returns communication articles', () => {
    const results = kb.getByCategory('communication');
    expect(results.length).toBeGreaterThan(0);
    for (const article of results) {
      expect(article.category).toBe('communication');
    }
  });

  it('returns power articles', () => {
    const results = kb.getByCategory('power');
    expect(results.length).toBeGreaterThan(0);
  });

  it('returns pcb articles', () => {
    const results = kb.getByCategory('pcb');
    expect(results.length).toBeGreaterThan(0);
  });

  it('returns techniques articles', () => {
    const results = kb.getByCategory('techniques');
    expect(results.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// getByDifficulty
// ---------------------------------------------------------------------------

describe('ElectronicsKnowledgeBase - getByDifficulty', () => {
  it('returns beginner articles', () => {
    const results = kb.getByDifficulty('beginner');
    expect(results.length).toBeGreaterThan(0);
    for (const article of results) {
      expect(article.difficulty).toBe('beginner');
    }
  });

  it('returns intermediate articles', () => {
    const results = kb.getByDifficulty('intermediate');
    expect(results.length).toBeGreaterThan(0);
    for (const article of results) {
      expect(article.difficulty).toBe('intermediate');
    }
  });

  it('returns empty for advanced if no advanced articles exist', () => {
    const results = kb.getByDifficulty('advanced');
    // May or may not have advanced articles
    for (const article of results) {
      expect(article.difficulty).toBe('advanced');
    }
  });

  it('all difficulty levels combined equal total articles', () => {
    const beginner = kb.getByDifficulty('beginner').length;
    const intermediate = kb.getByDifficulty('intermediate').length;
    const advanced = kb.getByDifficulty('advanced').length;
    expect(beginner + intermediate + advanced).toBe(kb.getArticleCount());
  });
});

// ---------------------------------------------------------------------------
// getRelated
// ---------------------------------------------------------------------------

describe('ElectronicsKnowledgeBase - getRelated', () => {
  it('returns related articles for a valid article', () => {
    const related = kb.getRelated('resistors');
    expect(related.length).toBeGreaterThan(0);
  });

  it('related articles are actual KnowledgeArticle objects', () => {
    const related = kb.getRelated('resistors');
    for (const article of related) {
      expect(article.id).toBeTruthy();
      expect(article.title).toBeTruthy();
      expect(article.content).toBeTruthy();
    }
  });

  it('returns empty array for unknown article ID', () => {
    expect(kb.getRelated('nonexistent')).toEqual([]);
  });

  it('related articles for capacitors include expected topics', () => {
    const related = kb.getRelated('capacitors');
    const relatedIds = related.map((a) => a.id);
    expect(relatedIds).toContain('decoupling-capacitors');
  });

  it('related articles for I2C include expected topics', () => {
    const related = kb.getRelated('i2c');
    const relatedIds = related.map((a) => a.id);
    expect(relatedIds).toContain('spi');
    expect(relatedIds).toContain('pull-up-pull-down');
  });
});

// ---------------------------------------------------------------------------
// suggestForComponent (contextual lookup)
// ---------------------------------------------------------------------------

describe('ElectronicsKnowledgeBase - suggestForComponent', () => {
  it('suggests articles for "resistor"', () => {
    const results = kb.suggestForComponent('resistor');
    expect(results.length).toBeGreaterThan(0);
    const ids = results.map((a) => a.id);
    expect(ids).toContain('resistors');
  });

  it('suggests articles for "capacitor"', () => {
    const results = kb.suggestForComponent('capacitor');
    expect(results.length).toBeGreaterThan(0);
    const ids = results.map((a) => a.id);
    expect(ids).toContain('capacitors');
  });

  it('suggests articles for "mosfet"', () => {
    const results = kb.suggestForComponent('mosfet');
    expect(results.length).toBeGreaterThan(0);
    const ids = results.map((a) => a.id);
    expect(ids).toContain('mosfets');
  });

  it('suggests articles for "arduino"', () => {
    const results = kb.suggestForComponent('arduino');
    expect(results.length).toBeGreaterThan(0);
    const ids = results.map((a) => a.id);
    expect(ids).toContain('uart');
    expect(ids).toContain('pwm');
  });

  it('suggests articles for "motor"', () => {
    const results = kb.suggestForComponent('motor');
    expect(results.length).toBeGreaterThan(0);
    const ids = results.map((a) => a.id);
    expect(ids).toContain('h-bridges');
  });

  it('is case-insensitive', () => {
    const lower = kb.suggestForComponent('resistor');
    const upper = kb.suggestForComponent('RESISTOR');
    expect(lower.map((a) => a.id)).toEqual(upper.map((a) => a.id));
  });

  it('returns empty for empty string', () => {
    expect(kb.suggestForComponent('')).toEqual([]);
  });

  it('returns empty for whitespace-only', () => {
    expect(kb.suggestForComponent('   ')).toEqual([]);
  });

  it('falls back to search for unknown component types', () => {
    // 'soldering' isn't a component type but exists as content
    const results = kb.suggestForComponent('soldering');
    expect(results.length).toBeGreaterThan(0);
  });

  it('handles partial matches like "pcb"', () => {
    const results = kb.suggestForComponent('pcb');
    expect(results.length).toBeGreaterThan(0);
    const ids = results.map((a) => a.id);
    expect(ids).toContain('pcb-basics');
  });

  it('suggests relevant articles for "button"', () => {
    const results = kb.suggestForComponent('button');
    expect(results.length).toBeGreaterThan(0);
    const ids = results.map((a) => a.id);
    expect(ids).toContain('pull-up-pull-down');
  });

  it('suggests relevant articles for "sensor"', () => {
    const results = kb.suggestForComponent('sensor');
    expect(results.length).toBeGreaterThan(0);
    const ids = results.map((a) => a.id);
    expect(ids).toContain('adc-dac');
  });
});

// ---------------------------------------------------------------------------
// getCategories
// ---------------------------------------------------------------------------

describe('ElectronicsKnowledgeBase - getCategories', () => {
  it('returns all categories with counts', () => {
    const categories = kb.getCategories();
    expect(categories.length).toBeGreaterThan(0);
    for (const cat of categories) {
      expect(cat.count).toBeGreaterThan(0);
      expect(cat.category).toBeTruthy();
    }
  });

  it('category counts sum to total article count', () => {
    const categories = kb.getCategories();
    const totalFromCategories = categories.reduce((sum, c) => sum + c.count, 0);
    expect(totalFromCategories).toBe(kb.getArticleCount());
  });
});

// ---------------------------------------------------------------------------
// Edge Cases
// ---------------------------------------------------------------------------

describe('ElectronicsKnowledgeBase - Edge Cases', () => {
  it('getAllArticles returns a copy, not a reference', () => {
    const articles1 = kb.getAllArticles();
    const articles2 = kb.getAllArticles();
    expect(articles1).not.toBe(articles2);
    expect(articles1).toEqual(articles2);
  });

  it('search with special characters does not crash', () => {
    expect(() => kb.search('()')).not.toThrow();
    expect(() => kb.search('[test]')).not.toThrow();
    expect(() => kb.search('*')).not.toThrow();
  });

  it('search with single character returns results', () => {
    // Many articles contain 'R' or 'C'
    const results = kb.search('R');
    expect(results.length).toBeGreaterThan(0);
  });

  it('getArticleCount matches getAllArticles length', () => {
    expect(kb.getArticleCount()).toBe(kb.getAllArticles().length);
  });
});

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

describe('useKnowledgeBase', () => {
  beforeEach(() => {
    ElectronicsKnowledgeBase.resetForTesting();
  });

  it('provides search function', () => {
    const { result } = renderHook(() => useKnowledgeBase());
    const articles = result.current.search('resistor');
    expect(articles.length).toBeGreaterThan(0);
  });

  it('provides getArticle function', () => {
    const { result } = renderHook(() => useKnowledgeBase());
    const article = result.current.getArticle('resistors');
    expect(article).not.toBeNull();
    expect(article!.id).toBe('resistors');
  });

  it('provides getByCategory function', () => {
    const { result } = renderHook(() => useKnowledgeBase());
    const articles = result.current.getByCategory('passive-components');
    expect(articles.length).toBeGreaterThan(0);
  });

  it('provides getByDifficulty function', () => {
    const { result } = renderHook(() => useKnowledgeBase());
    const articles = result.current.getByDifficulty('beginner');
    expect(articles.length).toBeGreaterThan(0);
  });

  it('provides getRelated function', () => {
    const { result } = renderHook(() => useKnowledgeBase());
    const related = result.current.getRelated('resistors');
    expect(related.length).toBeGreaterThan(0);
  });

  it('provides suggestForComponent function', () => {
    const { result } = renderHook(() => useKnowledgeBase());
    const suggestions = result.current.suggestForComponent('mosfet');
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it('provides getAllArticles function', () => {
    const { result } = renderHook(() => useKnowledgeBase());
    const articles = result.current.getAllArticles();
    expect(articles.length).toBeGreaterThanOrEqual(20);
  });

  it('provides getCategories function', () => {
    const { result } = renderHook(() => useKnowledgeBase());
    const categories = result.current.getCategories();
    expect(categories.length).toBeGreaterThan(0);
  });

  it('provides articleCount', () => {
    const { result } = renderHook(() => useKnowledgeBase());
    expect(result.current.articleCount).toBeGreaterThanOrEqual(20);
  });
});
