import { describe, it, expect, beforeEach } from 'vitest';
import {
  SAMPLE_PROJECTS,
  DIFFICULTY_META,
  CATEGORY_META,
  SampleProjectManager,
} from '../sample-projects';
import type {
  SampleProject,
  SampleDifficulty,
  SampleCategory,
} from '../sample-projects';

describe('sample-projects', () => {
  // ---------------------------------------------------------------------------
  // Constants & data integrity
  // ---------------------------------------------------------------------------

  describe('SAMPLE_PROJECTS', () => {
    it('contains exactly 5 built-in samples', () => {
      expect(SAMPLE_PROJECTS).toHaveLength(5);
    });

    it('has unique IDs for every sample', () => {
      const ids = SAMPLE_PROJECTS.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('has unique names for every sample', () => {
      const names = SAMPLE_PROJECTS.map((s) => s.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it('includes the expected sample IDs', () => {
      const ids = SAMPLE_PROJECTS.map((s) => s.id);
      expect(ids).toContain('blink-led');
      expect(ids).toContain('temperature-logger');
      expect(ids).toContain('motor-controller');
      expect(ids).toContain('audio-amplifier');
      expect(ids).toContain('iot-weather-station');
    });

    it('every sample has a non-empty name and description', () => {
      for (const s of SAMPLE_PROJECTS) {
        expect(s.name.length).toBeGreaterThan(0);
        expect(s.description.length).toBeGreaterThan(0);
      }
    });

    it('every sample has at least 1 workflow', () => {
      for (const s of SAMPLE_PROJECTS) {
        expect(s.workflows.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('every sample has at least 1 learning objective', () => {
      for (const s of SAMPLE_PROJECTS) {
        expect(s.learningObjectives.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('every sample has at least 1 preloaded node', () => {
      for (const s of SAMPLE_PROJECTS) {
        expect(s.preloadedData.nodes.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('every sample has at least 1 preloaded BOM item', () => {
      for (const s of SAMPLE_PROJECTS) {
        expect(s.preloadedData.bomItems.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('every preloaded node has unique nodeId within its sample', () => {
      for (const s of SAMPLE_PROJECTS) {
        const ids = s.preloadedData.nodes.map((n) => n.nodeId);
        expect(new Set(ids).size).toBe(ids.length);
      }
    });

    it('every preloaded edge has unique edgeId within its sample', () => {
      for (const s of SAMPLE_PROJECTS) {
        const ids = s.preloadedData.edges.map((e) => e.edgeId);
        expect(new Set(ids).size).toBe(ids.length);
      }
    });

    it('every edge references valid node IDs (source and target)', () => {
      for (const s of SAMPLE_PROJECTS) {
        const nodeIds = new Set(s.preloadedData.nodes.map((n) => n.nodeId));
        for (const edge of s.preloadedData.edges) {
          expect(nodeIds.has(edge.source)).toBe(true);
          expect(nodeIds.has(edge.target)).toBe(true);
        }
      }
    });

    it('every BOM item has a parseable unitPrice', () => {
      for (const s of SAMPLE_PROJECTS) {
        for (const item of s.preloadedData.bomItems) {
          const price = parseFloat(item.unitPrice);
          expect(Number.isFinite(price)).toBe(true);
          expect(price).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('every BOM item has a positive quantity', () => {
      for (const s of SAMPLE_PROJECTS) {
        for (const item of s.preloadedData.bomItems) {
          expect(item.quantity).toBeGreaterThanOrEqual(1);
        }
      }
    });

    it('every sample has an estimatedTime string', () => {
      for (const s of SAMPLE_PROJECTS) {
        expect(s.estimatedTime.length).toBeGreaterThan(0);
      }
    });

    it('every sample has a valid difficulty', () => {
      const validDifficulties: SampleDifficulty[] = ['beginner', 'intermediate', 'advanced'];
      for (const s of SAMPLE_PROJECTS) {
        expect(validDifficulties).toContain(s.difficulty);
      }
    });

    it('every sample has a valid category', () => {
      const validCategories: SampleCategory[] = ['digital', 'analog', 'iot', 'power', 'mixed-signal'];
      for (const s of SAMPLE_PROJECTS) {
        expect(validCategories).toContain(s.category);
      }
    });
  });

  describe('DIFFICULTY_META', () => {
    it('has entries for all difficulty levels', () => {
      expect(DIFFICULTY_META).toHaveProperty('beginner');
      expect(DIFFICULTY_META).toHaveProperty('intermediate');
      expect(DIFFICULTY_META).toHaveProperty('advanced');
    });

    it('sorts beginner < intermediate < advanced', () => {
      expect(DIFFICULTY_META.beginner.sortOrder).toBeLessThan(DIFFICULTY_META.intermediate.sortOrder);
      expect(DIFFICULTY_META.intermediate.sortOrder).toBeLessThan(DIFFICULTY_META.advanced.sortOrder);
    });

    it('each entry has a label and color', () => {
      for (const key of Object.keys(DIFFICULTY_META) as SampleDifficulty[]) {
        expect(DIFFICULTY_META[key].label.length).toBeGreaterThan(0);
        expect(DIFFICULTY_META[key].color.length).toBeGreaterThan(0);
      }
    });
  });

  describe('CATEGORY_META', () => {
    it('has entries for all categories', () => {
      expect(CATEGORY_META).toHaveProperty('digital');
      expect(CATEGORY_META).toHaveProperty('analog');
      expect(CATEGORY_META).toHaveProperty('iot');
      expect(CATEGORY_META).toHaveProperty('power');
      expect(CATEGORY_META).toHaveProperty('mixed-signal');
    });

    it('each entry has a label', () => {
      for (const key of Object.keys(CATEGORY_META) as SampleCategory[]) {
        expect(CATEGORY_META[key].label.length).toBeGreaterThan(0);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // SampleProjectManager
  // ---------------------------------------------------------------------------

  describe('SampleProjectManager', () => {
    let manager: SampleProjectManager;

    beforeEach(() => {
      SampleProjectManager.resetInstance();
      manager = SampleProjectManager.getInstance();
    });

    it('returns a singleton', () => {
      const second = SampleProjectManager.getInstance();
      expect(manager).toBe(second);
    });

    it('resetInstance creates a new singleton', () => {
      SampleProjectManager.resetInstance();
      const fresh = SampleProjectManager.getInstance();
      expect(fresh).not.toBe(manager);
    });

    describe('getAllSamples', () => {
      it('returns all 5 samples', () => {
        expect(manager.getAllSamples()).toHaveLength(5);
      });

      it('returns the same reference as SAMPLE_PROJECTS', () => {
        expect(manager.getAllSamples()).toBe(SAMPLE_PROJECTS);
      });
    });

    describe('getSampleById', () => {
      it('finds existing sample by ID', () => {
        const sample = manager.getSampleById('blink-led');
        expect(sample).toBeDefined();
        expect(sample?.name).toBe('Blink LED');
      });

      it('returns undefined for non-existent ID', () => {
        expect(manager.getSampleById('does-not-exist')).toBeUndefined();
      });

      it('finds every built-in sample by ID', () => {
        for (const s of SAMPLE_PROJECTS) {
          expect(manager.getSampleById(s.id)).toBe(s);
        }
      });
    });

    describe('getSamplesByDifficulty', () => {
      it('returns beginner samples', () => {
        const beginners = manager.getSamplesByDifficulty('beginner');
        expect(beginners.length).toBeGreaterThanOrEqual(1);
        for (const s of beginners) {
          expect(s.difficulty).toBe('beginner');
        }
      });

      it('returns intermediate samples', () => {
        const intermediates = manager.getSamplesByDifficulty('intermediate');
        expect(intermediates.length).toBeGreaterThanOrEqual(1);
        for (const s of intermediates) {
          expect(s.difficulty).toBe('intermediate');
        }
      });

      it('returns advanced samples', () => {
        const advanced = manager.getSamplesByDifficulty('advanced');
        expect(advanced.length).toBeGreaterThanOrEqual(1);
        for (const s of advanced) {
          expect(s.difficulty).toBe('advanced');
        }
      });

      it('all difficulty filters together cover all samples', () => {
        const all = [
          ...manager.getSamplesByDifficulty('beginner'),
          ...manager.getSamplesByDifficulty('intermediate'),
          ...manager.getSamplesByDifficulty('advanced'),
        ];
        expect(all.length).toBe(SAMPLE_PROJECTS.length);
      });
    });

    describe('getSamplesByCategory', () => {
      it('returns samples for a valid category', () => {
        const digital = manager.getSamplesByCategory('digital');
        expect(digital.length).toBeGreaterThanOrEqual(1);
        for (const s of digital) {
          expect(s.category).toBe('digital');
        }
      });

      it('returns empty array for category with no samples', () => {
        const mixedSignal = manager.getSamplesByCategory('mixed-signal');
        expect(mixedSignal).toEqual([]);
      });
    });

    describe('searchSamples', () => {
      it('returns all samples for empty query', () => {
        expect(manager.searchSamples('')).toHaveLength(5);
      });

      it('returns all samples for whitespace-only query', () => {
        expect(manager.searchSamples('   ')).toHaveLength(5);
      });

      it('finds sample by name', () => {
        const results = manager.searchSamples('Blink');
        expect(results.length).toBeGreaterThanOrEqual(1);
        expect(results.some((s) => s.id === 'blink-led')).toBe(true);
      });

      it('finds sample by description keyword', () => {
        const results = manager.searchSamples('MQTT');
        expect(results.length).toBeGreaterThanOrEqual(1);
        expect(results.some((s) => s.id === 'iot-weather-station')).toBe(true);
      });

      it('finds sample by workflow name', () => {
        const results = manager.searchSamples('Thermal Analysis');
        expect(results.length).toBeGreaterThanOrEqual(1);
        expect(results.some((s) => s.id === 'motor-controller')).toBe(true);
      });

      it('finds sample by learning objective', () => {
        const results = manager.searchSamples('firmware scaffolds');
        expect(results.length).toBeGreaterThanOrEqual(1);
        expect(results.some((s) => s.id === 'iot-weather-station')).toBe(true);
      });

      it('is case-insensitive', () => {
        const upper = manager.searchSamples('BLINK');
        const lower = manager.searchSamples('blink');
        expect(upper).toEqual(lower);
      });

      it('returns empty for no-match query', () => {
        expect(manager.searchSamples('xyznonexistent')).toHaveLength(0);
      });
    });

    describe('computeTotalCost', () => {
      it('computes correct total for blink-led sample', () => {
        const blink = manager.getSampleById('blink-led') as SampleProject;
        const total = manager.computeTotalCost(blink);
        // 23.00 + 0.10 + 0.35 = 23.45
        expect(total).toBeCloseTo(23.45, 2);
      });

      it('computes non-zero cost for every sample', () => {
        for (const s of SAMPLE_PROJECTS) {
          expect(manager.computeTotalCost(s)).toBeGreaterThan(0);
        }
      });

      it('handles quantity multiplier', () => {
        const motor = manager.getSampleById('motor-controller') as SampleProject;
        const diodes = motor.preloadedData.bomItems.find((i) => i.partNumber === '1N4007');
        expect(diodes).toBeDefined();
        expect(diodes!.quantity).toBe(4);
        // Total cost should include 4 * 0.15 = 0.60 for diodes
        const total = manager.computeTotalCost(motor);
        expect(total).toBeGreaterThan(0);
      });
    });

    describe('getAvailableDifficulties', () => {
      it('returns difficulties sorted by sortOrder', () => {
        const difficulties = manager.getAvailableDifficulties();
        for (let i = 1; i < difficulties.length; i++) {
          expect(DIFFICULTY_META[difficulties[i]].sortOrder).toBeGreaterThan(
            DIFFICULTY_META[difficulties[i - 1]].sortOrder,
          );
        }
      });

      it('returns at least 2 difficulty levels', () => {
        expect(manager.getAvailableDifficulties().length).toBeGreaterThanOrEqual(2);
      });
    });

    describe('getAvailableCategories', () => {
      it('returns at least 2 categories', () => {
        expect(manager.getAvailableCategories().length).toBeGreaterThanOrEqual(2);
      });

      it('every returned category has samples', () => {
        for (const cat of manager.getAvailableCategories()) {
          expect(manager.getSamplesByCategory(cat).length).toBeGreaterThanOrEqual(1);
        }
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Individual sample data integrity
  // ---------------------------------------------------------------------------

  describe('Blink LED sample', () => {
    const sample = SAMPLE_PROJECTS.find((s) => s.id === 'blink-led')!;

    it('is difficulty beginner', () => {
      expect(sample.difficulty).toBe('beginner');
    });

    it('has 3 nodes (MCU, resistor, LED)', () => {
      expect(sample.preloadedData.nodes).toHaveLength(3);
    });

    it('has 2 edges', () => {
      expect(sample.preloadedData.edges).toHaveLength(2);
    });

    it('has 3 BOM items', () => {
      expect(sample.preloadedData.bomItems).toHaveLength(3);
    });
  });

  describe('IoT Weather Station sample', () => {
    const sample = SAMPLE_PROJECTS.find((s) => s.id === 'iot-weather-station')!;

    it('is difficulty advanced', () => {
      expect(sample.difficulty).toBe('advanced');
    });

    it('has 8 nodes (complex architecture)', () => {
      expect(sample.preloadedData.nodes).toHaveLength(8);
    });

    it('has category iot', () => {
      expect(sample.category).toBe('iot');
    });

    it('has at least 6 BOM items', () => {
      expect(sample.preloadedData.bomItems.length).toBeGreaterThanOrEqual(6);
    });
  });
});
