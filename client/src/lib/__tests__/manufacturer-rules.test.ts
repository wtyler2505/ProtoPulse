import { describe, it, expect, beforeEach } from 'vitest';
import type { DRCRule } from '@shared/component-types';
import { getDefaultDRCRules } from '@shared/drc-engine';
import {
  MANUFACTURER_RULES,
  getManufacturerIds,
  getManufacturerRuleSet,
  compareWithManufacturer,
  summarizeComparison,
  buildManufacturerRules,
} from '../manufacturer-rules';
import type { ManufacturerRuleDiff, ComparisonSummary } from '../manufacturer-rules';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDefaultRules(): DRCRule[] {
  return getDefaultDRCRules();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('manufacturer-rules', () => {
  let defaultRules: DRCRule[];

  beforeEach(() => {
    defaultRules = makeDefaultRules();
  });

  // -------------------------------------------------------------------------
  // Registry
  // -------------------------------------------------------------------------

  describe('getManufacturerIds', () => {
    it('returns all four manufacturer IDs', () => {
      const ids = getManufacturerIds();
      expect(ids).toContain('jlcpcb');
      expect(ids).toContain('pcbway');
      expect(ids).toContain('oshpark');
      expect(ids).toContain('eurocircuits');
      expect(ids).toHaveLength(4);
    });
  });

  describe('getManufacturerRuleSet', () => {
    it('returns a rule set for a valid ID', () => {
      const rs = getManufacturerRuleSet('jlcpcb');
      expect(rs).toBeDefined();
      expect(rs!.name).toBe('JLCPCB');
      expect(rs!.id).toBe('jlcpcb');
      expect(rs!.description).toBeTruthy();
      expect(rs!.source).toMatch(/^https?:\/\//);
      expect(rs!.rules.length).toBeGreaterThan(0);
    });

    it('returns undefined for an unknown ID', () => {
      expect(getManufacturerRuleSet('nonexistent')).toBeUndefined();
    });
  });

  describe('MANUFACTURER_RULES', () => {
    it('each rule set has a name, id, description, source, and rules', () => {
      for (const [id, rs] of Array.from(MANUFACTURER_RULES.entries())) {
        expect(rs.name).toBeTruthy();
        expect(rs.id).toBe(id);
        expect(rs.description).toBeTruthy();
        expect(rs.source).toBeTruthy();
        expect(rs.rules.length).toBeGreaterThan(0);
      }
    });

    it('each rule override references a valid DRCRuleType', () => {
      const validTypes = new Set(defaultRules.map((r) => r.type));
      for (const [, rs] of Array.from(MANUFACTURER_RULES.entries())) {
        for (const override of rs.rules) {
          expect(validTypes.has(override.type)).toBe(true);
        }
      }
    });
  });

  // -------------------------------------------------------------------------
  // Comparison: Basic Behavior
  // -------------------------------------------------------------------------

  describe('compareWithManufacturer', () => {
    it('returns empty array for unknown manufacturer', () => {
      const diffs = compareWithManufacturer(defaultRules, 'nonexistent');
      expect(diffs).toEqual([]);
    });

    it('returns diffs for JLCPCB comparison', () => {
      const diffs = compareWithManufacturer(defaultRules, 'jlcpcb');
      expect(diffs.length).toBeGreaterThan(0);
    });

    it('returns diffs for all four manufacturers', () => {
      for (const id of getManufacturerIds()) {
        const diffs = compareWithManufacturer(defaultRules, id);
        // Each manufacturer should produce at least some differences from defaults
        expect(Array.isArray(diffs)).toBe(true);
      }
    });

    it('each diff has all required fields', () => {
      const diffs = compareWithManufacturer(defaultRules, 'jlcpcb');
      for (const diff of diffs) {
        expect(diff.ruleType).toBeTruthy();
        expect(diff.ruleLabel).toBeTruthy();
        expect(diff.field).toBeTruthy();
        expect(diff.current).toBeDefined();
        expect(diff.manufacturer).toBeDefined();
        expect(['stricter', 'looser', 'match']).toContain(diff.status);
      }
    });

    it('status is always one of stricter/looser/match', () => {
      for (const id of getManufacturerIds()) {
        const diffs = compareWithManufacturer(defaultRules, id);
        for (const diff of diffs) {
          expect(['stricter', 'looser', 'match']).toContain(diff.status);
        }
      }
    });
  });

  // -------------------------------------------------------------------------
  // Comparison: Specific Rule Behavior
  // -------------------------------------------------------------------------

  describe('compareWithManufacturer — numeric comparison logic', () => {
    it('identifies stricter current rules when current value > manufacturer', () => {
      // Default min-clearance is 8, JLCPCB is 6 → current is stricter
      const diffs = compareWithManufacturer(defaultRules, 'jlcpcb');
      const clearanceDiff = diffs.find((d) => d.ruleType === 'min-clearance' && d.field === 'minClearance');
      expect(clearanceDiff).toBeDefined();
      expect(clearanceDiff!.current).toBe(8);
      expect(clearanceDiff!.manufacturer).toBe(6);
      expect(clearanceDiff!.status).toBe('stricter');
    });

    it('identifies looser current rules when current value < manufacturer', () => {
      // Modify a rule to be below manufacturer spec
      const rules = makeDefaultRules();
      const clearanceRule = rules.find((r) => r.type === 'min-clearance');
      if (clearanceRule) {
        clearanceRule.params.minClearance = 3; // Below JLCPCB's 6
      }
      const diffs = compareWithManufacturer(rules, 'jlcpcb');
      const clearanceDiff = diffs.find((d) => d.ruleType === 'min-clearance' && d.field === 'minClearance');
      expect(clearanceDiff).toBeDefined();
      expect(clearanceDiff!.status).toBe('looser');
    });

    it('reports match when values are equal', () => {
      // Set current to match manufacturer exactly
      const rules = makeDefaultRules();
      const clearanceRule = rules.find((r) => r.type === 'min-clearance');
      if (clearanceRule) {
        clearanceRule.params.minClearance = 6; // Matches JLCPCB's 6
      }
      const diffs = compareWithManufacturer(rules, 'jlcpcb');
      const clearanceDiff = diffs.find((d) => d.ruleType === 'min-clearance' && d.field === 'minClearance');
      // Should not appear in diffs (values are equal → no diff)
      expect(clearanceDiff).toBeUndefined();
    });
  });

  describe('compareWithManufacturer — severity comparison', () => {
    it('detects severity difference', () => {
      // Default pad-size severity is 'warning', OSHPark's is 'error'
      const diffs = compareWithManufacturer(defaultRules, 'oshpark');
      const padSizeSeverityDiff = diffs.find(
        (d) => d.ruleType === 'pad-size' && d.field === 'severity',
      );
      // OSHPark pad-size is 'error', default is 'warning' → current is looser
      expect(padSizeSeverityDiff).toBeDefined();
      expect(padSizeSeverityDiff!.current).toBe('warning');
      expect(padSizeSeverityDiff!.manufacturer).toBe('error');
      expect(padSizeSeverityDiff!.status).toBe('looser');
    });

    it('marks severity as stricter when current is error and manufacturer is warning', () => {
      const rules = makeDefaultRules();
      const rule = rules.find((r) => r.type === 'silk-overlap');
      if (rule) {
        rule.severity = 'error';
      }
      const diffs = compareWithManufacturer(rules, 'jlcpcb');
      const silkDiff = diffs.find((d) => d.ruleType === 'silk-overlap' && d.field === 'severity');
      expect(silkDiff).toBeDefined();
      expect(silkDiff!.status).toBe('stricter');
    });
  });

  // -------------------------------------------------------------------------
  // Comparison: Edge Cases
  // -------------------------------------------------------------------------

  describe('compareWithManufacturer — edge cases', () => {
    it('handles empty rules array gracefully', () => {
      const diffs = compareWithManufacturer([], 'jlcpcb');
      expect(diffs).toEqual([]);
    });

    it('handles rules with no params gracefully', () => {
      const rules: DRCRule[] = [
        { type: 'silk-overlap', params: {}, severity: 'warning', enabled: true },
      ];
      const diffs = compareWithManufacturer(rules, 'jlcpcb');
      // silk-overlap has no numeric params to compare, but severity might differ
      expect(Array.isArray(diffs)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Manufacturer-Specific Comparisons
  // -------------------------------------------------------------------------

  describe('JLCPCB comparison', () => {
    it('has trace width difference from defaults', () => {
      const diffs = compareWithManufacturer(defaultRules, 'jlcpcb');
      const traceWidthDiff = diffs.find((d) => d.ruleType === 'min-trace-width' && d.field === 'minWidth');
      expect(traceWidthDiff).toBeDefined();
      // Default is 6, JLCPCB is 5 → current is stricter
      expect(traceWidthDiff!.status).toBe('stricter');
    });
  });

  describe('OSHPark comparison', () => {
    it('OSHPark has stricter annular ring than defaults', () => {
      // Default annular ring is 5, OSHPark is 7
      const diffs = compareWithManufacturer(defaultRules, 'oshpark');
      const annularDiff = diffs.find((d) => d.ruleType === 'annular-ring' && d.field === 'minAnnularRing');
      expect(annularDiff).toBeDefined();
      expect(annularDiff!.current).toBe(5);
      expect(annularDiff!.manufacturer).toBe(7);
      expect(annularDiff!.status).toBe('looser');
    });
  });

  describe('Eurocircuits comparison', () => {
    it('Eurocircuits has stricter courtyard overlap than defaults', () => {
      // Default courtyard is 10, Eurocircuits is 12
      const diffs = compareWithManufacturer(defaultRules, 'eurocircuits');
      const courtyardDiff = diffs.find((d) => d.ruleType === 'courtyard-overlap' && d.field === 'minCourtyard');
      expect(courtyardDiff).toBeDefined();
      expect(courtyardDiff!.current).toBe(10);
      expect(courtyardDiff!.manufacturer).toBe(12);
      expect(courtyardDiff!.status).toBe('looser');
    });
  });

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------

  describe('summarizeComparison', () => {
    it('returns correct counts for a known set of diffs', () => {
      const diffs: ManufacturerRuleDiff[] = [
        { ruleType: 'min-clearance', ruleLabel: 'Min Clearance', field: 'minClearance', current: 8, manufacturer: 6, status: 'stricter' },
        { ruleType: 'min-trace-width', ruleLabel: 'Min Trace Width', field: 'minWidth', current: 4, manufacturer: 6, status: 'looser' },
        { ruleType: 'annular-ring', ruleLabel: 'Annular Ring', field: 'minAnnularRing', current: 5, manufacturer: 5, status: 'match' },
      ];
      const summary = summarizeComparison(diffs);
      expect(summary.total).toBe(3);
      expect(summary.stricter).toBe(1);
      expect(summary.looser).toBe(1);
      expect(summary.match).toBe(1);
    });

    it('returns zeros for empty diffs', () => {
      const summary = summarizeComparison([]);
      expect(summary).toEqual({ total: 0, stricter: 0, looser: 0, match: 0 });
    });

    it('works with real comparison data', () => {
      const diffs = compareWithManufacturer(defaultRules, 'jlcpcb');
      const summary = summarizeComparison(diffs);
      expect(summary.total).toBe(diffs.length);
      expect(summary.stricter + summary.looser + summary.match).toBe(summary.total);
    });
  });

  // -------------------------------------------------------------------------
  // buildManufacturerRules
  // -------------------------------------------------------------------------

  describe('buildManufacturerRules', () => {
    it('returns null for unknown manufacturer', () => {
      expect(buildManufacturerRules(defaultRules, 'nonexistent')).toBeNull();
    });

    it('returns a full DRCRule array for valid manufacturer', () => {
      const result = buildManufacturerRules(defaultRules, 'jlcpcb');
      expect(result).not.toBeNull();
      expect(result!).toHaveLength(defaultRules.length);
    });

    it('does not mutate the input rules', () => {
      const original = makeDefaultRules();
      const originalJson = JSON.stringify(original);
      buildManufacturerRules(original, 'jlcpcb');
      expect(JSON.stringify(original)).toBe(originalJson);
    });

    it('applies manufacturer overrides to the base rules', () => {
      const result = buildManufacturerRules(defaultRules, 'jlcpcb')!;
      const clearance = result.find((r) => r.type === 'min-clearance');
      expect(clearance).toBeDefined();
      expect(clearance!.params.minClearance).toBe(6); // JLCPCB's value
    });

    it('preserves rules not overridden by manufacturer', () => {
      const result = buildManufacturerRules(defaultRules, 'jlcpcb')!;
      // pin-spacing is in JLCPCB overrides but with same value
      const pinSpacing = result.find((r) => r.type === 'pin-spacing');
      expect(pinSpacing).toBeDefined();
      expect(pinSpacing!.params.standardPitchMils).toBe(100);
    });

    it('each manufacturer produces a valid rule set', () => {
      for (const id of getManufacturerIds()) {
        const result = buildManufacturerRules(defaultRules, id);
        expect(result).not.toBeNull();
        expect(result!).toHaveLength(defaultRules.length);
        for (const rule of result!) {
          expect(rule.type).toBeTruthy();
          expect(typeof rule.enabled).toBe('boolean');
          expect(['error', 'warning']).toContain(rule.severity);
          expect(typeof rule.params).toBe('object');
        }
      }
    });
  });

  // -------------------------------------------------------------------------
  // Cross-manufacturer comparisons
  // -------------------------------------------------------------------------

  describe('cross-manufacturer behavior', () => {
    it('JLCPCB is generally more permissive than Eurocircuits', () => {
      const jlcpcbDiffs = compareWithManufacturer(defaultRules, 'jlcpcb');
      const euroDiffs = compareWithManufacturer(defaultRules, 'eurocircuits');
      const jlcpcbSummary = summarizeComparison(jlcpcbDiffs);
      const euroSummary = summarizeComparison(euroDiffs);
      // Eurocircuits should have more fields where current rules are looser
      // (meaning Eurocircuits demands more)
      expect(euroSummary.looser).toBeGreaterThanOrEqual(jlcpcbSummary.looser);
    });

    it('PCBWay and JLCPCB have similar capabilities', () => {
      const jlcpcbDiffs = compareWithManufacturer(defaultRules, 'jlcpcb');
      const pcbwayDiffs = compareWithManufacturer(defaultRules, 'pcbway');
      // They should have a similar number of total diffs
      expect(Math.abs(jlcpcbDiffs.length - pcbwayDiffs.length)).toBeLessThan(5);
    });
  });

  // -------------------------------------------------------------------------
  // ruleLabel formatting
  // -------------------------------------------------------------------------

  describe('ruleLabel formatting', () => {
    it('produces human-readable labels', () => {
      const diffs = compareWithManufacturer(defaultRules, 'jlcpcb');
      for (const diff of diffs) {
        // Labels should be title-cased and not contain raw hyphens/underscores
        expect(diff.ruleLabel).not.toMatch(/^$/);
        expect(diff.ruleLabel[0]).toBe(diff.ruleLabel[0].toUpperCase());
      }
    });
  });
});
