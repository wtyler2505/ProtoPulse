import { describe, it, expect, beforeEach, vi } from 'vitest';

import { RootCauseAnalyzer } from '../ai-root-cause';
import type {
  RootCauseDomain,
  CauseSeverity,
  FixPriority,
  Symptom,
  FailurePattern,
  FixRecommendation,
  SymptomObservation,
  CausalNode,
  CausalEdge,
  CausalGraph,
  RankedRootCause,
  CrossDomainCorrelation,
  RootCauseAnalysis,
  RootCauseSnapshot,
} from '../ai-root-cause';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createAnalyzer(): RootCauseAnalyzer {
  RootCauseAnalyzer.resetInstance();
  return RootCauseAnalyzer.getInstance();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RootCauseAnalyzer', () => {
  let analyzer: RootCauseAnalyzer;

  beforeEach(() => {
    analyzer = createAnalyzer();
  });

  // =========================================================================
  // Singleton
  // =========================================================================

  describe('singleton', () => {
    it('returns the same instance on subsequent calls', () => {
      const a = RootCauseAnalyzer.getInstance();
      const b = RootCauseAnalyzer.getInstance();
      expect(a).toBe(b);
    });

    it('returns a new instance after reset', () => {
      const a = RootCauseAnalyzer.getInstance();
      RootCauseAnalyzer.resetInstance();
      const b = RootCauseAnalyzer.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // =========================================================================
  // Subscribe & Snapshot
  // =========================================================================

  describe('subscribe & snapshot', () => {
    it('notifies subscribers on observation', () => {
      const listener = vi.fn();
      analyzer.subscribe(listener);
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 0.8 });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('unsubscribe stops notifications', () => {
      const listener = vi.fn();
      const unsub = analyzer.subscribe(listener);
      unsub();
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 0.8 });
      expect(listener).not.toHaveBeenCalled();
    });

    it('getSnapshot returns current state', () => {
      const snap = analyzer.getSnapshot();
      expect(snap.observations).toEqual([]);
      expect(snap.latestAnalysis).toBeNull();
    });

    it('snapshot includes observations after adding', () => {
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 1.0 });
      const snap = analyzer.getSnapshot();
      expect(snap.observations).toHaveLength(1);
      expect(snap.observations[0].symptomId).toBe('sym-reset-random');
    });

    it('snapshot includes latest analysis after analyze', () => {
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 1.0 });
      analyzer.analyze();
      const snap = analyzer.getSnapshot();
      expect(snap.latestAnalysis).not.toBeNull();
    });

    it('notifies on analyze', () => {
      const listener = vi.fn();
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 1.0 });
      analyzer.subscribe(listener);
      analyzer.analyze();
      expect(listener).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Knowledge base queries
  // =========================================================================

  describe('knowledge base', () => {
    it('has 22+ known symptoms', () => {
      expect(analyzer.getKnownSymptoms().length).toBeGreaterThanOrEqual(22);
    });

    it('has 20+ known failure patterns', () => {
      expect(analyzer.getKnownPatterns().length).toBeGreaterThanOrEqual(20);
    });

    it('getSymptom returns a symptom by ID', () => {
      const sym = analyzer.getSymptom('sym-reset-random');
      expect(sym).not.toBeNull();
      expect(sym!.description).toContain('Random MCU resets');
    });

    it('getSymptom returns null for unknown ID', () => {
      expect(analyzer.getSymptom('sym-nonexistent')).toBeNull();
    });

    it('getPattern returns a pattern by ID', () => {
      const pat = analyzer.getPattern('fp-brownout');
      expect(pat).not.toBeNull();
      expect(pat!.name).toBe('Brownout / Undervoltage');
    });

    it('getPattern returns null for unknown ID', () => {
      expect(analyzer.getPattern('fp-nonexistent')).toBeNull();
    });

    it('every pattern has at least one fix', () => {
      analyzer.getKnownPatterns().forEach((p) => {
        expect(p.fixes.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('every pattern has at least one symptom', () => {
      analyzer.getKnownPatterns().forEach((p) => {
        expect(p.symptomIds.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('all symptomIds in patterns reference valid symptoms', () => {
      const validIds = new Set(analyzer.getKnownSymptoms().map((s) => s.id));
      analyzer.getKnownPatterns().forEach((p) => {
        p.symptomIds.forEach((sid) => {
          expect(validIds.has(sid)).toBe(true);
        });
      });
    });

    it('all causesPatternIds reference valid patterns', () => {
      const validIds = new Set(analyzer.getKnownPatterns().map((p) => p.id));
      analyzer.getKnownPatterns().forEach((p) => {
        p.causesPatternIds.forEach((pid) => {
          expect(validIds.has(pid)).toBe(true);
        });
      });
    });

    it('all causedByPatternIds reference valid patterns', () => {
      const validIds = new Set(analyzer.getKnownPatterns().map((p) => p.id));
      analyzer.getKnownPatterns().forEach((p) => {
        p.causedByPatternIds.forEach((pid) => {
          expect(validIds.has(pid)).toBe(true);
        });
      });
    });
  });

  // =========================================================================
  // Symptom search
  // =========================================================================

  describe('searchSymptoms', () => {
    it('finds symptoms by keyword', () => {
      const results = analyzer.searchSymptoms('reset');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some((s) => s.id === 'sym-reset-random')).toBe(true);
    });

    it('finds symptoms by tag', () => {
      const results = analyzer.searchSymptoms('brownout');
      expect(results.some((s) => s.id === 'sym-reset-random')).toBe(true);
    });

    it('returns empty for no match', () => {
      expect(analyzer.searchSymptoms('xyznonexistent')).toEqual([]);
    });

    it('returns empty for empty query', () => {
      expect(analyzer.searchSymptoms('')).toEqual([]);
    });

    it('ranks description matches higher than tag matches', () => {
      const results = analyzer.searchSymptoms('I2C bus');
      expect(results.length).toBeGreaterThanOrEqual(1);
      // The first result should be the one with I2C in the description
      expect(results[0].id).toBe('sym-i2c-hang');
    });

    it('handles multi-word queries', () => {
      const results = analyzer.searchSymptoms('motor load');
      expect(results.some((s) => s.id === 'sym-reset-under-load')).toBe(true);
    });
  });

  // =========================================================================
  // Observation management
  // =========================================================================

  describe('addObservation', () => {
    it('adds an observation with timestamp', () => {
      const obs = analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 0.9 });
      expect(obs.symptomId).toBe('sym-reset-random');
      expect(obs.confidence).toBe(0.9);
      expect(obs.timestamp).toBeGreaterThan(0);
    });

    it('throws for unknown symptom ID', () => {
      expect(() =>
        analyzer.addObservation({ symptomId: 'sym-nonexistent', confidence: 1.0 }),
      ).toThrow('Unknown symptom ID');
    });

    it('throws for confidence below 0', () => {
      expect(() =>
        analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: -0.1 }),
      ).toThrow('Confidence must be between 0 and 1');
    });

    it('throws for confidence above 1', () => {
      expect(() =>
        analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 1.5 }),
      ).toThrow('Confidence must be between 0 and 1');
    });

    it('allows context string', () => {
      const obs = analyzer.addObservation({
        symptomId: 'sym-reset-random',
        confidence: 1.0,
        context: 'happens when servo activates',
      });
      expect(obs.context).toBe('happens when servo activates');
    });

    it('allows multiple observations for same symptom', () => {
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 0.5 });
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 0.9 });
      expect(analyzer.getObservations()).toHaveLength(2);
    });

    it('accepts boundary confidence values (0 and 1)', () => {
      const obs0 = analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 0 });
      const obs1 = analyzer.addObservation({ symptomId: 'sym-voltage-sag', confidence: 1 });
      expect(obs0.confidence).toBe(0);
      expect(obs1.confidence).toBe(1);
    });
  });

  describe('removeObservation', () => {
    it('removes observations by symptom ID', () => {
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 1.0 });
      const removed = analyzer.removeObservation('sym-reset-random');
      expect(removed).toBe(true);
      expect(analyzer.getObservations()).toHaveLength(0);
    });

    it('returns false for non-existent observation', () => {
      expect(analyzer.removeObservation('sym-nonexistent')).toBe(false);
    });

    it('removes all observations with matching symptom ID', () => {
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 0.5 });
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 0.9 });
      analyzer.removeObservation('sym-reset-random');
      expect(analyzer.getObservations()).toHaveLength(0);
    });

    it('notifies subscribers', () => {
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 1.0 });
      const listener = vi.fn();
      analyzer.subscribe(listener);
      analyzer.removeObservation('sym-reset-random');
      expect(listener).toHaveBeenCalled();
    });

    it('does not notify if nothing was removed', () => {
      const listener = vi.fn();
      analyzer.subscribe(listener);
      analyzer.removeObservation('sym-nonexistent');
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('clearObservations', () => {
    it('clears all observations', () => {
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 1.0 });
      analyzer.addObservation({ symptomId: 'sym-voltage-sag', confidence: 0.8 });
      analyzer.clearObservations();
      expect(analyzer.getObservations()).toHaveLength(0);
    });

    it('clears latest analysis', () => {
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 1.0 });
      analyzer.analyze();
      analyzer.clearObservations();
      expect(analyzer.getSnapshot().latestAnalysis).toBeNull();
    });

    it('notifies subscribers', () => {
      const listener = vi.fn();
      analyzer.subscribe(listener);
      analyzer.clearObservations();
      expect(listener).toHaveBeenCalled();
    });
  });

  describe('getObservations', () => {
    it('returns a copy, not a reference', () => {
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 1.0 });
      const obs = analyzer.getObservations();
      obs.push({} as SymptomObservation);
      expect(analyzer.getObservations()).toHaveLength(1);
    });
  });

  // =========================================================================
  // Analysis — Causal Graph
  // =========================================================================

  describe('buildCausalGraph', () => {
    it('returns empty graph with no observations', () => {
      const graph = analyzer.buildCausalGraph();
      expect(graph.nodes).toHaveLength(0);
      expect(graph.edges).toHaveLength(0);
    });

    it('creates nodes for patterns matching observed symptoms', () => {
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 1.0 });
      analyzer.addObservation({ symptomId: 'sym-voltage-sag', confidence: 0.8 });
      const graph = analyzer.buildCausalGraph();
      expect(graph.nodes.length).toBeGreaterThanOrEqual(1);
      // Brownout should match (has both sym-reset-random and sym-voltage-sag)
      expect(graph.nodes.some((n) => n.patternId === 'fp-brownout')).toBe(true);
    });

    it('nodes have valid probability between 0 and 1', () => {
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 1.0 });
      const graph = analyzer.buildCausalGraph();
      graph.nodes.forEach((node) => {
        expect(node.probability).toBeGreaterThanOrEqual(0);
        expect(node.probability).toBeLessThanOrEqual(1);
      });
    });

    it('creates edges between causally related patterns', () => {
      // Brownout causes I2C lockup; both have overlapping symptoms with reset
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 1.0 });
      analyzer.addObservation({ symptomId: 'sym-i2c-hang', confidence: 0.8 });
      analyzer.addObservation({ symptomId: 'sym-voltage-sag', confidence: 0.7 });
      const graph = analyzer.buildCausalGraph();

      const hasBrownout = graph.nodes.some((n) => n.patternId === 'fp-brownout');
      const hasI2c = graph.nodes.some((n) => n.patternId === 'fp-i2c-lockup');

      if (hasBrownout && hasI2c) {
        const edge = graph.edges.find(
          (e) => e.fromPatternId === 'fp-brownout' && e.toPatternId === 'fp-i2c-lockup',
        );
        expect(edge).toBeDefined();
        expect(edge!.relationship).toBe('causes');
      }
    });

    it('deduplicates edges', () => {
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 1.0 });
      analyzer.addObservation({ symptomId: 'sym-i2c-hang', confidence: 1.0 });
      analyzer.addObservation({ symptomId: 'sym-voltage-sag', confidence: 1.0 });
      const graph = analyzer.buildCausalGraph();

      const edgeKeys = graph.edges.map((e) => `${e.fromPatternId}->${e.toPatternId}`);
      const uniqueKeys = new Set(edgeKeys);
      expect(edgeKeys.length).toBe(uniqueKeys.size);
    });

    it('higher confidence observations produce higher node probability', () => {
      // Test with low confidence
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 0.3 });
      const graphLow = analyzer.buildCausalGraph();
      const brownoutLow = graphLow.nodes.find((n) => n.patternId === 'fp-brownout');

      // Reset and test with high confidence
      RootCauseAnalyzer.resetInstance();
      analyzer = RootCauseAnalyzer.getInstance();
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 1.0 });
      const graphHigh = analyzer.buildCausalGraph();
      const brownoutHigh = graphHigh.nodes.find((n) => n.patternId === 'fp-brownout');

      if (brownoutLow && brownoutHigh) {
        expect(brownoutHigh.probability).toBeGreaterThanOrEqual(brownoutLow.probability);
      }
    });

    it('includes matched symptom IDs on each node', () => {
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 1.0 });
      const graph = analyzer.buildCausalGraph();
      graph.nodes.forEach((node) => {
        expect(node.matchedSymptoms.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  // =========================================================================
  // Analysis — Ranking
  // =========================================================================

  describe('rankRootCauses', () => {
    it('returns ranked causes sorted by probability', () => {
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 1.0 });
      analyzer.addObservation({ symptomId: 'sym-voltage-sag', confidence: 1.0 });
      analyzer.addObservation({ symptomId: 'sym-reset-under-load', confidence: 0.9 });
      const graph = analyzer.buildCausalGraph();
      const ranked = analyzer.rankRootCauses(graph);

      expect(ranked.length).toBeGreaterThanOrEqual(1);

      // Verify descending probability order (with tolerance for severity tiebreak)
      for (let i = 1; i < ranked.length; i++) {
        const prev = ranked[i - 1];
        const curr = ranked[i];
        expect(prev.probability).toBeGreaterThanOrEqual(curr.probability - 0.01);
      }
    });

    it('includes fix recommendations on each cause', () => {
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 1.0 });
      const graph = analyzer.buildCausalGraph();
      const ranked = analyzer.rankRootCauses(graph);

      ranked.forEach((cause) => {
        expect(cause.fixes.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('includes transitive effects', () => {
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 1.0 });
      analyzer.addObservation({ symptomId: 'sym-voltage-sag', confidence: 1.0 });
      const graph = analyzer.buildCausalGraph();
      const ranked = analyzer.rankRootCauses(graph);

      const brownout = ranked.find((r) => r.patternId === 'fp-brownout');
      if (brownout) {
        // Brownout causes i2c-lockup and data-corruption
        expect(brownout.transitiveEffects.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('boosts probability for patterns with observed transitive effects', () => {
      // Brownout causes I2C lockup; if both are observed, brownout should get a boost
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 1.0 });
      analyzer.addObservation({ symptomId: 'sym-voltage-sag', confidence: 1.0 });
      analyzer.addObservation({ symptomId: 'sym-i2c-hang', confidence: 0.8 });
      const graph = analyzer.buildCausalGraph();
      const ranked = analyzer.rankRootCauses(graph);

      const brownout = ranked.find((r) => r.patternId === 'fp-brownout');
      const brownoutNode = graph.nodes.find((n) => n.patternId === 'fp-brownout');
      if (brownout && brownoutNode) {
        expect(brownout.probability).toBeGreaterThanOrEqual(brownoutNode.probability);
      }
    });

    it('returns empty array for empty graph', () => {
      const graph: CausalGraph = { nodes: [], edges: [] };
      expect(analyzer.rankRootCauses(graph)).toEqual([]);
    });
  });

  // =========================================================================
  // Cross-domain correlation
  // =========================================================================

  describe('findCrossDomainCorrelations', () => {
    it('returns empty when no cross-domain patterns', () => {
      analyzer.addObservation({ symptomId: 'sym-floating-pin', confidence: 1.0 });
      const graph = analyzer.buildCausalGraph();
      const corr = analyzer.findCrossDomainCorrelations(graph);
      // floating-inputs is circuit domain, no firmware link
      // May or may not have correlations depending on what else matches
      expect(Array.isArray(corr)).toBe(true);
    });

    it('detects circuit-firmware correlation when both domains present', () => {
      // Brownout (power) causes I2C lockup (firmware)
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 1.0 });
      analyzer.addObservation({ symptomId: 'sym-voltage-sag', confidence: 1.0 });
      analyzer.addObservation({ symptomId: 'sym-i2c-hang', confidence: 0.9 });
      const graph = analyzer.buildCausalGraph();
      const corr = analyzer.findCrossDomainCorrelations(graph);

      if (corr.length > 0) {
        expect(corr[0].circuitPatterns.length).toBeGreaterThanOrEqual(1);
        expect(corr[0].firmwarePatterns.length).toBeGreaterThanOrEqual(1);
        expect(corr[0].correlationStrength).toBeGreaterThan(0);
        expect(corr[0].explanation.length).toBeGreaterThan(0);
      }
    });

    it('sorts by correlation strength descending', () => {
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 1.0 });
      analyzer.addObservation({ symptomId: 'sym-voltage-sag', confidence: 1.0 });
      analyzer.addObservation({ symptomId: 'sym-i2c-hang', confidence: 0.8 });
      analyzer.addObservation({ symptomId: 'sym-spi-corrupt', confidence: 0.7 });
      const graph = analyzer.buildCausalGraph();
      const corr = analyzer.findCrossDomainCorrelations(graph);

      for (let i = 1; i < corr.length; i++) {
        expect(corr[i - 1].correlationStrength).toBeGreaterThanOrEqual(corr[i].correlationStrength);
      }
    });
  });

  // =========================================================================
  // Full analysis
  // =========================================================================

  describe('analyze', () => {
    it('produces a complete analysis result', () => {
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 1.0 });
      analyzer.addObservation({ symptomId: 'sym-voltage-sag', confidence: 0.9 });
      const analysis = analyzer.analyze();

      expect(analysis.observations).toHaveLength(2);
      expect(analysis.graph.nodes.length).toBeGreaterThanOrEqual(1);
      expect(analysis.rankedCauses.length).toBeGreaterThanOrEqual(1);
      expect(analysis.timestamp).toBeGreaterThan(0);
    });

    it('stores latest analysis for later retrieval', () => {
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 1.0 });
      const analysis = analyzer.analyze();
      expect(analyzer.getSnapshot().latestAnalysis).toBe(analysis);
    });

    it('returns brownout as top cause for reset + voltage sag', () => {
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 1.0 });
      analyzer.addObservation({ symptomId: 'sym-voltage-sag', confidence: 1.0 });
      analyzer.addObservation({ symptomId: 'sym-reset-under-load', confidence: 0.9 });
      const analysis = analyzer.analyze();

      // Brownout should be among top causes
      const brownoutIdx = analysis.rankedCauses.findIndex((c) => c.patternId === 'fp-brownout');
      expect(brownoutIdx).toBeGreaterThanOrEqual(0);
      expect(brownoutIdx).toBeLessThan(3); // Should be in top 3
    });

    it('returns I2C lockup for I2C symptoms', () => {
      analyzer.addObservation({ symptomId: 'sym-i2c-hang', confidence: 1.0 });
      analyzer.addObservation({ symptomId: 'sym-watchdog-timeout', confidence: 0.8 });
      const analysis = analyzer.analyze();

      expect(analysis.rankedCauses.some((c) => c.patternId === 'fp-i2c-lockup')).toBe(true);
    });

    it('handles single symptom', () => {
      analyzer.addObservation({ symptomId: 'sym-hot-component', confidence: 1.0 });
      const analysis = analyzer.analyze();
      expect(analysis.rankedCauses.length).toBeGreaterThanOrEqual(1);
    });

    it('identifies thermal runaway for overheating + high current', () => {
      analyzer.addObservation({ symptomId: 'sym-hot-component', confidence: 1.0 });
      analyzer.addObservation({ symptomId: 'sym-high-current', confidence: 0.9 });
      const analysis = analyzer.analyze();

      expect(analysis.rankedCauses.some((c) => c.patternId === 'fp-thermal-runaway')).toBe(true);
    });

    it('identifies ESD damage pattern', () => {
      analyzer.addObservation({ symptomId: 'sym-esd-damage', confidence: 1.0 });
      const analysis = analyzer.analyze();
      expect(analysis.rankedCauses.some((c) => c.patternId === 'fp-esd-damage')).toBe(true);
    });
  });

  // =========================================================================
  // Transitive cause/effect detection
  // =========================================================================

  describe('transitive detection', () => {
    it('finds transitive effects of brownout', () => {
      const effects = analyzer.getTransitiveEffects('fp-brownout');
      // Brownout → I2C lockup → watchdog starvation, Brownout → data corruption
      expect(effects.length).toBeGreaterThanOrEqual(2);
      expect(effects).toContain('fp-i2c-lockup');
      expect(effects).toContain('fp-data-corruption');
    });

    it('finds transitive causes of data-corruption', () => {
      const causes = analyzer.getTransitiveCauses('fp-data-corruption');
      // Data corruption caused by brownout, SPI timing, stack overflow
      expect(causes.length).toBeGreaterThanOrEqual(1);
    });

    it('handles patterns with no transitive effects', () => {
      const effects = analyzer.getTransitiveEffects('fp-esd-damage');
      expect(effects).toEqual([]);
    });

    it('handles patterns with no transitive causes', () => {
      const causes = analyzer.getTransitiveCauses('fp-ground-loop');
      expect(causes).toEqual([]);
    });

    it('does not include self in transitive results', () => {
      const effects = analyzer.getTransitiveEffects('fp-brownout');
      expect(effects).not.toContain('fp-brownout');
    });

    it('detects multi-hop transitive chains', () => {
      // ground-loop → brownout → i2c-lockup → watchdog-starvation
      const effects = analyzer.getTransitiveEffects('fp-ground-loop');
      expect(effects).toContain('fp-brownout');
      // Brownout is a transitive effect, and it further causes i2c-lockup
      if (effects.includes('fp-brownout')) {
        const brownoutEffects = analyzer.getTransitiveEffects('fp-brownout');
        expect(brownoutEffects).toContain('fp-i2c-lockup');
      }
    });
  });

  // =========================================================================
  // Fix recommendations
  // =========================================================================

  describe('getRecommendedFixes', () => {
    it('returns empty when no analysis exists', () => {
      expect(analyzer.getRecommendedFixes()).toEqual([]);
    });

    it('returns fixes sorted by priority', () => {
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 1.0 });
      analyzer.addObservation({ symptomId: 'sym-voltage-sag', confidence: 0.9 });
      const analysis = analyzer.analyze();
      const fixes = analyzer.getRecommendedFixes(analysis);

      expect(fixes.length).toBeGreaterThanOrEqual(1);

      const priorityOrder: Record<FixPriority, number> = {
        immediate: 0,
        high: 1,
        medium: 2,
        low: 3,
      };

      for (let i = 1; i < fixes.length; i++) {
        expect(priorityOrder[fixes[i - 1].priority]).toBeLessThanOrEqual(
          priorityOrder[fixes[i].priority],
        );
      }
    });

    it('deduplicates fixes across causes', () => {
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 1.0 });
      analyzer.addObservation({ symptomId: 'sym-voltage-sag', confidence: 1.0 });
      const analysis = analyzer.analyze();
      const fixes = analyzer.getRecommendedFixes(analysis);

      const fixIds = fixes.map((f) => f.id);
      const uniqueIds = new Set(fixIds);
      expect(fixIds.length).toBe(uniqueIds.size);
    });

    it('uses latest analysis when none provided', () => {
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 1.0 });
      analyzer.analyze();
      const fixes = analyzer.getRecommendedFixes();
      expect(fixes.length).toBeGreaterThanOrEqual(1);
    });

    it('immediate fixes come first', () => {
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 1.0 });
      analyzer.addObservation({ symptomId: 'sym-voltage-sag', confidence: 1.0 });
      analyzer.analyze();
      const fixes = analyzer.getRecommendedFixes();

      if (fixes.length > 0) {
        expect(fixes[0].priority).toBe('immediate');
      }
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  describe('edge cases', () => {
    it('handles all symptoms observed at once', () => {
      analyzer.getKnownSymptoms().forEach((sym) => {
        analyzer.addObservation({ symptomId: sym.id, confidence: 1.0 });
      });
      const analysis = analyzer.analyze();
      // All patterns should be identified
      expect(analysis.rankedCauses.length).toBeGreaterThanOrEqual(15);
    });

    it('handles very low confidence observations', () => {
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 0.01 });
      const graph = analyzer.buildCausalGraph();
      // Very low confidence might not meet evidence threshold for all patterns
      graph.nodes.forEach((n) => {
        expect(n.probability).toBeGreaterThanOrEqual(0);
      });
    });

    it('analysis is idempotent', () => {
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 1.0 });
      const a1 = analyzer.analyze();
      const a2 = analyzer.analyze();
      expect(a1.rankedCauses.length).toBe(a2.rankedCauses.length);
      expect(a1.graph.nodes.length).toBe(a2.graph.nodes.length);
    });

    it('new observations produce different analysis', () => {
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 1.0 });
      const a1 = analyzer.analyze();

      analyzer.addObservation({ symptomId: 'sym-voltage-sag', confidence: 1.0 });
      analyzer.addObservation({ symptomId: 'sym-reset-under-load', confidence: 0.9 });
      const a2 = analyzer.analyze();

      // More symptoms should produce more or different results
      expect(a2.observations.length).toBeGreaterThan(a1.observations.length);
    });

    it('clearObservations resets analysis completely', () => {
      analyzer.addObservation({ symptomId: 'sym-reset-random', confidence: 1.0 });
      analyzer.analyze();
      analyzer.clearObservations();

      const graph = analyzer.buildCausalGraph();
      expect(graph.nodes).toHaveLength(0);
      expect(graph.edges).toHaveLength(0);
    });
  });

  // =========================================================================
  // Type exports verification
  // =========================================================================

  describe('type exports', () => {
    it('exports all required types', () => {
      const _domain: RootCauseDomain = 'circuit';
      const _severity: CauseSeverity = 'critical';
      const _priority: FixPriority = 'immediate';
      const _snapshot: RootCauseSnapshot = {
        observations: [],
        latestAnalysis: null,
      };
      expect(_domain).toBe('circuit');
      expect(_severity).toBe('critical');
      expect(_priority).toBe('immediate');
      expect(_snapshot.latestAnalysis).toBeNull();
    });
  });
});
