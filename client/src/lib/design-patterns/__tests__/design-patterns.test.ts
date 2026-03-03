import { describe, expect, it } from 'vitest';
import {
  getAllPatterns,
  getPatternsByCategory,
  getPatternsByDifficulty,
  searchPatterns,
} from '../index';

import type { DesignPattern } from '../types';

describe('Design Pattern Library', () => {
  const patterns = getAllPatterns();

  it('getAllPatterns() returns exactly 10 patterns', () => {
    expect(patterns).toHaveLength(10);
  });

  it('every pattern has all required fields', () => {
    for (const p of patterns) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.category).toBeTruthy();
      expect(p.difficulty).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(p.whyItWorks).toBeTruthy();
      expect(p.components.length).toBeGreaterThan(0);
      expect(p.connections.length).toBeGreaterThan(0);
      expect(p.tips.length).toBeGreaterThanOrEqual(3);
      expect(p.commonMistakes.length).toBeGreaterThanOrEqual(2);
      expect(p.relatedPatterns.length).toBeGreaterThan(0);
      expect(p.tags.length).toBeGreaterThan(0);
    }
  });

  it('every pattern has a unique id', () => {
    const ids = patterns.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('all pattern IDs are kebab-case', () => {
    for (const p of patterns) {
      expect(p.id).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
    }
  });

  it('all relatedPatterns reference valid pattern ids', () => {
    const validIds = new Set(patterns.map((p) => p.id));
    for (const p of patterns) {
      for (const ref of p.relatedPatterns) {
        expect(validIds.has(ref)).toBe(true);
      }
    }
  });

  it('whyItWorks is 2-4 sentences for every pattern', () => {
    for (const p of patterns) {
      // Count sentences by splitting on period followed by space or end of string
      const sentences = p.whyItWorks
        .split(/\.\s/)
        .filter((s) => s.trim().length > 0);
      expect(sentences.length).toBeGreaterThanOrEqual(2);
    }
  });

  describe('getPatternsByCategory', () => {
    it('returns correct patterns for "power" category', () => {
      const powerPatterns = getPatternsByCategory('power');
      expect(powerPatterns.length).toBeGreaterThanOrEqual(3);
      for (const p of powerPatterns) {
        expect(p.category).toBe('power');
      }
    });

    it('returns correct patterns for "signal" category', () => {
      const signalPatterns = getPatternsByCategory('signal');
      expect(signalPatterns.length).toBeGreaterThanOrEqual(3);
      for (const p of signalPatterns) {
        expect(p.category).toBe('signal');
      }
    });

    it('returns correct patterns for "motor" category', () => {
      const motorPatterns = getPatternsByCategory('motor');
      expect(motorPatterns).toHaveLength(1);
      expect(motorPatterns[0].id).toBe('h-bridge');
    });

    it('returns correct patterns for "communication" category', () => {
      const commsPatterns = getPatternsByCategory('communication');
      expect(commsPatterns).toHaveLength(1);
      expect(commsPatterns[0].id).toBe('level-shifter');
    });

    it('returns correct patterns for "digital" category', () => {
      const digitalPatterns = getPatternsByCategory('digital');
      expect(digitalPatterns).toHaveLength(1);
      expect(digitalPatterns[0].id).toBe('crystal-oscillator');
    });

    it('returns empty array for categories with no patterns', () => {
      const sensorPatterns = getPatternsByCategory('sensor');
      expect(sensorPatterns).toHaveLength(0);
    });
  });

  describe('getPatternsByDifficulty', () => {
    it('returns beginner patterns', () => {
      const beginnerPatterns = getPatternsByDifficulty('beginner');
      expect(beginnerPatterns.length).toBeGreaterThanOrEqual(4);
      for (const p of beginnerPatterns) {
        expect(p.difficulty).toBe('beginner');
      }
    });

    it('returns intermediate patterns', () => {
      const intermediatePatterns = getPatternsByDifficulty('intermediate');
      expect(intermediatePatterns.length).toBeGreaterThanOrEqual(3);
      for (const p of intermediatePatterns) {
        expect(p.difficulty).toBe('intermediate');
      }
    });

    it('returns advanced patterns', () => {
      const advancedPatterns = getPatternsByDifficulty('advanced');
      expect(advancedPatterns.length).toBeGreaterThanOrEqual(2);
      for (const p of advancedPatterns) {
        expect(p.difficulty).toBe('advanced');
      }
    });
  });

  describe('searchPatterns', () => {
    it('finds patterns by name', () => {
      const results = searchPatterns('voltage divider');
      expect(results.some((p) => p.id === 'voltage-divider')).toBe(true);
    });

    it('finds patterns by description', () => {
      const results = searchPatterns('motor');
      expect(results.some((p) => p.id === 'h-bridge')).toBe(true);
    });

    it('finds patterns by tags', () => {
      const results = searchPatterns('I2C');
      expect(results.some((p) => p.id === 'pull-up-resistor')).toBe(true);
    });

    it('search is case-insensitive', () => {
      const lower = searchPatterns('usb-c');
      const upper = searchPatterns('USB-C');
      expect(lower.length).toBe(upper.length);
      expect(lower.length).toBeGreaterThan(0);
    });

    it('returns empty array for no matches', () => {
      const results = searchPatterns('xyzzy_nonexistent_12345');
      expect(results).toHaveLength(0);
    });

    it('finds crystal oscillator by tag "XTAL"', () => {
      const results = searchPatterns('XTAL');
      expect(results.some((p) => p.id === 'crystal-oscillator')).toBe(true);
    });

    it('finds LED driver by tag "NeoPixel"', () => {
      const results = searchPatterns('NeoPixel');
      expect(results.some((p) => p.id === 'led-driver')).toBe(true);
    });

    it('finds decoupling network by description keyword "bypass"', () => {
      const results = searchPatterns('bypass');
      expect(results.some((p) => p.id === 'decoupling-network')).toBe(true);
    });
  });

  describe('pattern content quality', () => {
    it('every component has a name and type', () => {
      for (const p of patterns) {
        for (const c of p.components) {
          expect(c.name).toBeTruthy();
          expect(c.type).toBeTruthy();
        }
      }
    });

    it('every connection has from, to, and description', () => {
      for (const p of patterns) {
        for (const c of p.connections) {
          expect(c.from).toBeTruthy();
          expect(c.to).toBeTruthy();
          expect(c.description).toBeTruthy();
        }
      }
    });

    it('tips have at least 3 entries per pattern', () => {
      for (const p of patterns) {
        expect(p.tips.length).toBeGreaterThanOrEqual(3);
      }
    });

    it('commonMistakes have at least 2 entries per pattern', () => {
      for (const p of patterns) {
        expect(p.commonMistakes.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('no pattern references itself in relatedPatterns', () => {
      for (const p of patterns) {
        expect(p.relatedPatterns).not.toContain(p.id);
      }
    });

    it('pattern names are unique', () => {
      const names = patterns.map((p: DesignPattern) => p.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });
  });
});
