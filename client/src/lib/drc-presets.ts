import type { DRCRule, DRCRuleType } from '@shared/component-types';
import { getDefaultDRCRules } from '@shared/drc-engine';

// ---------------------------------------------------------------------------
// DRC Rule Preset System (BL-0250)
//
// Project-type-aware DRC presets that tune rule parameters and severity for
// common maker/hobbyist project categories. Each preset adjusts the baseline
// getDefaultDRCRules() values to match the physical reality of that project
// type (e.g. Arduino shields need relaxed clearances for THT, RF boards need
// strict impedance-adjacent rules).
// ---------------------------------------------------------------------------

/** Identifies a built-in preset. */
export type DrcPresetId = 'general' | 'arduino' | 'power_supply' | 'sensor' | 'rf';

/** A single rule override within a preset. Only specified fields are changed. */
export interface DrcRuleOverride {
  type: DRCRuleType;
  params?: Record<string, number>;
  severity?: 'error' | 'warning';
  enabled?: boolean;
}

/** Full preset definition. */
export interface DrcPreset {
  id: DrcPresetId;
  name: string;
  description: string;
  /** Which kinds of projects this is best for — shown as helper text. */
  examples: string[];
  /** Only rules that differ from getDefaultDRCRules() need to be listed. */
  overrides: DrcRuleOverride[];
}

// ---------------------------------------------------------------------------
// Built-in Presets
// ---------------------------------------------------------------------------

export const DRC_PRESETS: DrcPreset[] = [
  {
    id: 'general',
    name: 'General (Balanced)',
    description: 'Well-rounded defaults suitable for most hobby and prototyping projects.',
    examples: ['Breakout boards', 'LED drivers', 'Prototyping'],
    overrides: [],
  },
  {
    id: 'arduino',
    name: 'Arduino / Maker',
    description: 'Relaxed clearances for through-hole heavy designs with standard 0.1" pitch headers.',
    examples: ['Arduino shields', 'Breadboard-friendly modules', 'Servo/motor controllers'],
    overrides: [
      { type: 'min-clearance', params: { minClearance: 12 }, severity: 'warning' },
      { type: 'min-trace-width', params: { minWidth: 10 }, severity: 'warning' },
      { type: 'pad-size', params: { minPadDiameter: 60, minDrillDiameter: 28 }, severity: 'warning' },
      { type: 'pin-spacing', params: { standardPitchMils: 100 }, severity: 'warning' },
      { type: 'courtyard-overlap', params: { minCourtyard: 15 }, severity: 'warning' },
      { type: 'trace-to-edge', params: { minEdgeClearance: 15 }, severity: 'warning' },
    ],
  },
  {
    id: 'power_supply',
    name: 'Power Supply',
    description: 'Strict thermal and clearance rules for high-current or high-voltage designs.',
    examples: ['Buck/boost converters', 'Battery chargers', 'Motor drivers', 'PSU boards'],
    overrides: [
      { type: 'min-clearance', params: { minClearance: 12 }, severity: 'error' },
      { type: 'min-trace-width', params: { minWidth: 15 }, severity: 'error' },
      { type: 'thermal-relief', params: { minSpokeWidth: 12, minSpokeCount: 4 }, severity: 'error' },
      { type: 'pad-size', params: { minPadDiameter: 50, minDrillDiameter: 24 }, severity: 'error' },
      { type: 'trace-to-edge', params: { minEdgeClearance: 15 }, severity: 'error' },
      { type: 'courtyard-overlap', params: { minCourtyard: 15 }, severity: 'error' },
      { type: 'annular-ring', params: { minAnnularRing: 8 }, severity: 'error' },
      { type: 'solder-mask', params: { minSolderMaskDam: 6, minSolderMaskExpansion: 3 }, severity: 'error' },
    ],
  },
  {
    id: 'sensor',
    name: 'Sensor / Low-Noise',
    description: 'Prioritizes noise isolation, guard traces, and clean analog routing.',
    examples: ['IMU breakouts', 'ADC boards', 'Thermocouple amplifiers', 'Load cell amplifiers'],
    overrides: [
      { type: 'min-clearance', params: { minClearance: 10 }, severity: 'error' },
      { type: 'min-trace-width', params: { minWidth: 6 }, severity: 'error' },
      { type: 'silk-overlap', params: {}, severity: 'error' },
      { type: 'courtyard-overlap', params: { minCourtyard: 12 }, severity: 'error' },
      { type: 'via-in-pad', params: {}, severity: 'error' },
      { type: 'solder-mask', params: { minSolderMaskDam: 5, minSolderMaskExpansion: 3 }, severity: 'error' },
    ],
  },
  {
    id: 'rf',
    name: 'RF / Impedance-Controlled',
    description: 'Tight impedance and clearance rules for radio, antenna, and high-speed designs.',
    examples: ['ESP32/nRF modules', 'LoRa boards', 'GPS receivers', 'USB 3.x layouts'],
    overrides: [
      { type: 'min-clearance', params: { minClearance: 6 }, severity: 'error' },
      { type: 'min-trace-width', params: { minWidth: 4 }, severity: 'error' },
      { type: 'courtyard-overlap', params: { minCourtyard: 8 }, severity: 'error' },
      { type: 'annular-ring', params: { minAnnularRing: 4 }, severity: 'error' },
      { type: 'via-in-pad', params: {}, severity: 'error' },
      { type: 'pad-size', params: { minPadDiameter: 35, minDrillDiameter: 18 }, severity: 'error' },
      { type: 'silk-overlap', params: {}, severity: 'error' },
      { type: 'solder-mask', params: { minSolderMaskDam: 3, minSolderMaskExpansion: 2 }, severity: 'error' },
      { type: 'thermal-relief', params: { minSpokeWidth: 10, minSpokeCount: 4 }, severity: 'warning' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Look up a preset by ID. Returns undefined for unknown IDs. */
export function getPresetById(id: DrcPresetId): DrcPreset | undefined {
  return DRC_PRESETS.find((p) => p.id === id);
}

/**
 * Apply a preset's overrides on top of the default DRC rules.
 * Returns a new array — the original defaults are never mutated.
 */
export function applyPreset(presetId: DrcPresetId): DRCRule[] {
  const preset = getPresetById(presetId);
  if (!preset) {
    return getDefaultDRCRules();
  }
  return applyOverrides(getDefaultDRCRules(), preset.overrides);
}

/**
 * Apply a list of overrides to a base rule set.
 * Each override is matched by `type`; unmatched overrides are ignored.
 */
export function applyOverrides(base: DRCRule[], overrides: DrcRuleOverride[]): DRCRule[] {
  const overrideMap = new Map<DRCRuleType, DrcRuleOverride>();
  for (const o of overrides) {
    overrideMap.set(o.type, o);
  }

  return base.map((rule) => {
    const override = overrideMap.get(rule.type);
    if (!override) {
      return { ...rule };
    }
    return {
      ...rule,
      params: override.params !== undefined ? { ...rule.params, ...override.params } : { ...rule.params },
      severity: override.severity ?? rule.severity,
      enabled: override.enabled ?? rule.enabled,
    };
  });
}

/** Diff description: what a preset changes relative to the defaults. */
export interface RuleDiff {
  ruleType: DRCRuleType;
  field: string;
  defaultValue: string | number;
  presetValue: string | number;
}

/**
 * Compute a human-readable diff between default rules and a preset's rules.
 * Returns an array of per-field changes for display in a preview panel.
 */
export function diffPreset(presetId: DrcPresetId): RuleDiff[] {
  const preset = getPresetById(presetId);
  if (!preset) {
    return [];
  }

  const defaults = getDefaultDRCRules();
  const applied = applyPreset(presetId);
  const diffs: RuleDiff[] = [];

  for (let i = 0; i < defaults.length; i++) {
    const def = defaults[i];
    const app = applied[i];

    if (def.severity !== app.severity) {
      diffs.push({
        ruleType: def.type,
        field: 'severity',
        defaultValue: def.severity,
        presetValue: app.severity,
      });
    }

    if (def.enabled !== app.enabled) {
      diffs.push({
        ruleType: def.type,
        field: 'enabled',
        defaultValue: def.enabled ? 'true' : 'false',
        presetValue: app.enabled ? 'true' : 'false',
      });
    }

    // Compare each param
    const allParamKeys = new Set([...Object.keys(def.params), ...Object.keys(app.params)]);
    for (const key of allParamKeys) {
      const defVal = def.params[key];
      const appVal = app.params[key];
      if (defVal !== appVal) {
        diffs.push({
          ruleType: def.type,
          field: key,
          defaultValue: defVal ?? 0,
          presetValue: appVal ?? 0,
        });
      }
    }
  }

  return diffs;
}

/** Format a DRC rule type into a readable label. */
export function formatRuleType(ruleType: DRCRuleType): string {
  return ruleType
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
