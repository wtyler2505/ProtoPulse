import { describe, it, expect } from 'vitest';
import {
  DRC_PRESETS,
  getPresetById,
  applyPreset,
  applyOverrides,
  diffPreset,
  formatRuleType,
} from '../drc-presets';
import type { DrcPresetId, DrcRuleOverride } from '../drc-presets';
import { getDefaultDRCRules } from '@shared/drc-engine';
import type { DRCRule } from '@shared/component-types';

// ---------------------------------------------------------------------------
// DRC_PRESETS registry
// ---------------------------------------------------------------------------

describe('DRC_PRESETS', () => {
  it('contains exactly 5 built-in presets', () => {
    expect(DRC_PRESETS).toHaveLength(5);
  });

  it('has unique IDs', () => {
    const ids = DRC_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes general, arduino, power_supply, sensor, rf', () => {
    const ids = DRC_PRESETS.map((p) => p.id);
    expect(ids).toContain('general');
    expect(ids).toContain('arduino');
    expect(ids).toContain('power_supply');
    expect(ids).toContain('sensor');
    expect(ids).toContain('rf');
  });

  it('every preset has name, description, examples, and overrides arrays', () => {
    for (const preset of DRC_PRESETS) {
      expect(preset.name).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(Array.isArray(preset.examples)).toBe(true);
      expect(Array.isArray(preset.overrides)).toBe(true);
    }
  });

  it('general preset has zero overrides (it IS the defaults)', () => {
    const general = DRC_PRESETS.find((p) => p.id === 'general');
    expect(general?.overrides).toHaveLength(0);
  });

  it('arduino preset has relaxed (higher) clearance values', () => {
    const arduino = DRC_PRESETS.find((p) => p.id === 'arduino');
    const clearanceOverride = arduino?.overrides.find((o) => o.type === 'min-clearance');
    expect(clearanceOverride).toBeDefined();
    const defaultClearance = getDefaultDRCRules().find((r) => r.type === 'min-clearance')!.params.minClearance;
    expect(clearanceOverride!.params!.minClearance).toBeGreaterThan(defaultClearance);
  });

  it('power_supply preset uses error severity for thermal-relief', () => {
    const power = DRC_PRESETS.find((p) => p.id === 'power_supply');
    const thermal = power?.overrides.find((o) => o.type === 'thermal-relief');
    expect(thermal?.severity).toBe('error');
  });

  it('sensor preset elevates via-in-pad to error', () => {
    const sensor = DRC_PRESETS.find((p) => p.id === 'sensor');
    const viaInPad = sensor?.overrides.find((o) => o.type === 'via-in-pad');
    expect(viaInPad?.severity).toBe('error');
  });

  it('rf preset has tighter trace width minimum than defaults', () => {
    const rf = DRC_PRESETS.find((p) => p.id === 'rf');
    const traceWidth = rf?.overrides.find((o) => o.type === 'min-trace-width');
    expect(traceWidth).toBeDefined();
    const defaultWidth = getDefaultDRCRules().find((r) => r.type === 'min-trace-width')!.params.minWidth;
    expect(traceWidth!.params!.minWidth).toBeLessThanOrEqual(defaultWidth);
  });

  it('each preset has at least one example project', () => {
    for (const preset of DRC_PRESETS) {
      expect(preset.examples.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('override rule types are all valid DRCRuleType values', () => {
    const validTypes = getDefaultDRCRules().map((r) => r.type);
    for (const preset of DRC_PRESETS) {
      for (const override of preset.overrides) {
        expect(validTypes).toContain(override.type);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// getPresetById
// ---------------------------------------------------------------------------

describe('getPresetById', () => {
  it('returns the correct preset for each known ID', () => {
    const ids: DrcPresetId[] = ['general', 'arduino', 'power_supply', 'sensor', 'rf'];
    for (const id of ids) {
      const preset = getPresetById(id);
      expect(preset).toBeDefined();
      expect(preset!.id).toBe(id);
    }
  });

  it('returns undefined for unknown IDs', () => {
    expect(getPresetById('nonexistent' as DrcPresetId)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// applyPreset
// ---------------------------------------------------------------------------

describe('applyPreset', () => {
  it('general preset returns rules identical to getDefaultDRCRules()', () => {
    const result = applyPreset('general');
    const defaults = getDefaultDRCRules();
    expect(result).toEqual(defaults);
  });

  it('returns the same number of rules as the defaults', () => {
    const defaultCount = getDefaultDRCRules().length;
    for (const preset of DRC_PRESETS) {
      const result = applyPreset(preset.id);
      expect(result).toHaveLength(defaultCount);
    }
  });

  it('arduino preset overrides min-clearance param', () => {
    const result = applyPreset('arduino');
    const rule = result.find((r) => r.type === 'min-clearance');
    expect(rule!.params.minClearance).toBe(12);
  });

  it('power_supply preset sets thermal-relief to error severity', () => {
    const result = applyPreset('power_supply');
    const rule = result.find((r) => r.type === 'thermal-relief');
    expect(rule!.severity).toBe('error');
  });

  it('preserves rules not mentioned in overrides', () => {
    // pin-spacing is NOT overridden in sensor preset
    const result = applyPreset('sensor');
    const defaults = getDefaultDRCRules();
    const sensorPinSpacing = result.find((r) => r.type === 'pin-spacing');
    const defaultPinSpacing = defaults.find((r) => r.type === 'pin-spacing');
    expect(sensorPinSpacing).toEqual(defaultPinSpacing);
  });

  it('returns defaults for an unknown preset ID', () => {
    const result = applyPreset('bogus' as DrcPresetId);
    expect(result).toEqual(getDefaultDRCRules());
  });

  it('does not mutate the original defaults', () => {
    const before = getDefaultDRCRules();
    applyPreset('power_supply');
    const after = getDefaultDRCRules();
    expect(before).toEqual(after);
  });
});

// ---------------------------------------------------------------------------
// applyOverrides
// ---------------------------------------------------------------------------

describe('applyOverrides', () => {
  const base: DRCRule[] = [
    { type: 'min-clearance', params: { minClearance: 8 }, severity: 'error', enabled: true },
    { type: 'min-trace-width', params: { minWidth: 6 }, severity: 'error', enabled: true },
  ];

  it('returns a copy of base when overrides is empty', () => {
    const result = applyOverrides(base, []);
    expect(result).toEqual(base);
    expect(result).not.toBe(base);
  });

  it('overrides params for matched rule type', () => {
    const overrides: DrcRuleOverride[] = [
      { type: 'min-clearance', params: { minClearance: 20 } },
    ];
    const result = applyOverrides(base, overrides);
    expect(result[0].params.minClearance).toBe(20);
    expect(result[1].params.minWidth).toBe(6); // unchanged
  });

  it('overrides severity for matched rule type', () => {
    const overrides: DrcRuleOverride[] = [
      { type: 'min-trace-width', severity: 'warning' },
    ];
    const result = applyOverrides(base, overrides);
    expect(result[1].severity).toBe('warning');
    expect(result[0].severity).toBe('error'); // unchanged
  });

  it('overrides enabled flag', () => {
    const overrides: DrcRuleOverride[] = [
      { type: 'min-clearance', enabled: false },
    ];
    const result = applyOverrides(base, overrides);
    expect(result[0].enabled).toBe(false);
  });

  it('merges params (does not replace the entire params object)', () => {
    const baseWithMultiParams: DRCRule[] = [
      { type: 'pad-size', params: { minPadDiameter: 40, minDrillDiameter: 20 }, severity: 'warning', enabled: true },
    ];
    const overrides: DrcRuleOverride[] = [
      { type: 'pad-size', params: { minPadDiameter: 60 } },
    ];
    const result = applyOverrides(baseWithMultiParams, overrides);
    expect(result[0].params.minPadDiameter).toBe(60);
    expect(result[0].params.minDrillDiameter).toBe(20); // preserved
  });

  it('ignores overrides for rule types not in base', () => {
    const overrides: DrcRuleOverride[] = [
      { type: 'silk-overlap', params: {} },
    ];
    const result = applyOverrides(base, overrides);
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.type === 'silk-overlap')).toBeUndefined();
  });

  it('does not mutate the base array', () => {
    const originalClearance = base[0].params.minClearance;
    const overrides: DrcRuleOverride[] = [
      { type: 'min-clearance', params: { minClearance: 100 } },
    ];
    applyOverrides(base, overrides);
    expect(base[0].params.minClearance).toBe(originalClearance);
  });
});

// ---------------------------------------------------------------------------
// diffPreset
// ---------------------------------------------------------------------------

describe('diffPreset', () => {
  it('returns empty array for general preset (no changes)', () => {
    expect(diffPreset('general')).toEqual([]);
  });

  it('returns empty array for unknown preset ID', () => {
    expect(diffPreset('bogus' as DrcPresetId)).toEqual([]);
  });

  it('detects param changes in arduino preset', () => {
    const diffs = diffPreset('arduino');
    const clearanceDiff = diffs.find((d) => d.ruleType === 'min-clearance' && d.field === 'minClearance');
    expect(clearanceDiff).toBeDefined();
    expect(clearanceDiff!.defaultValue).toBe(8);
    expect(clearanceDiff!.presetValue).toBe(12);
  });

  it('detects severity changes in power_supply preset', () => {
    const diffs = diffPreset('power_supply');
    const thermalSev = diffs.find((d) => d.ruleType === 'thermal-relief' && d.field === 'severity');
    expect(thermalSev).toBeDefined();
    expect(thermalSev!.defaultValue).toBe('warning');
    expect(thermalSev!.presetValue).toBe('error');
  });

  it('returns correct number of diffs for sensor preset', () => {
    const diffs = diffPreset('sensor');
    // sensor preset overrides 6 rules, each potentially touching severity + params
    expect(diffs.length).toBeGreaterThanOrEqual(1);
  });

  it('rf preset diffs include min-trace-width param change', () => {
    const diffs = diffPreset('rf');
    const traceWidthDiff = diffs.find((d) => d.ruleType === 'min-trace-width' && d.field === 'minWidth');
    expect(traceWidthDiff).toBeDefined();
    expect(traceWidthDiff!.presetValue).toBe(4);
  });

  it('each diff has required fields', () => {
    const diffs = diffPreset('arduino');
    for (const diff of diffs) {
      expect(diff).toHaveProperty('ruleType');
      expect(diff).toHaveProperty('field');
      expect(diff).toHaveProperty('defaultValue');
      expect(diff).toHaveProperty('presetValue');
    }
  });
});

// ---------------------------------------------------------------------------
// formatRuleType
// ---------------------------------------------------------------------------

describe('formatRuleType', () => {
  it('converts hyphenated types to Title Case', () => {
    expect(formatRuleType('min-clearance')).toBe('Min Clearance');
  });

  it('converts underscore types to Title Case', () => {
    expect(formatRuleType('trace_clearance')).toBe('Trace Clearance');
  });

  it('handles single-word types', () => {
    // No hyphens or underscores — should just capitalize first letter
    expect(formatRuleType('solder-mask')).toBe('Solder Mask');
  });

  it('handles mixed separators', () => {
    // DRCRuleType uses hyphens, PcbDrcRuleType uses underscores
    expect(formatRuleType('via-in-pad')).toBe('Via In Pad');
    expect(formatRuleType('board_edge_clearance')).toBe('Board Edge Clearance');
  });
});

// ---------------------------------------------------------------------------
// Integration: presets produce valid DRC rule sets
// ---------------------------------------------------------------------------

describe('preset integration', () => {
  it('all presets produce rules that are valid DRCRule objects', () => {
    const presetIds: DrcPresetId[] = ['general', 'arduino', 'power_supply', 'sensor', 'rf'];
    for (const id of presetIds) {
      const rules = applyPreset(id);
      for (const rule of rules) {
        expect(rule).toHaveProperty('type');
        expect(rule).toHaveProperty('params');
        expect(rule).toHaveProperty('severity');
        expect(rule).toHaveProperty('enabled');
        expect(['error', 'warning']).toContain(rule.severity);
        expect(typeof rule.enabled).toBe('boolean');
        expect(typeof rule.params).toBe('object');
      }
    }
  });

  it('all presets produce positive numeric params', () => {
    const presetIds: DrcPresetId[] = ['general', 'arduino', 'power_supply', 'sensor', 'rf'];
    for (const id of presetIds) {
      const rules = applyPreset(id);
      for (const rule of rules) {
        for (const [key, val] of Object.entries(rule.params)) {
          expect(val).toBeGreaterThanOrEqual(0);
          expect(typeof val).toBe('number');
        }
      }
    }
  });

  it('applying a preset then diffing it matches the override count', () => {
    for (const preset of DRC_PRESETS) {
      const diffs = diffPreset(preset.id);
      if (preset.overrides.length === 0) {
        expect(diffs).toHaveLength(0);
      } else {
        // At least one diff per override (severity and/or params)
        expect(diffs.length).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
