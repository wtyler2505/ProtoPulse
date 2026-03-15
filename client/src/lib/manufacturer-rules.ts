/**
 * Manufacturer DRC Rule Comparison (BL-0251)
 *
 * Provides manufacturer-specific DRC rule sets based on published design rules
 * from popular PCB fabricators. Enables side-by-side comparison between the
 * user's current DRC rules and a manufacturer's recommended minimums, with
 * stricter/looser/match classification and color-coded output.
 *
 * Supported manufacturers: JLCPCB, PCBWay, OSHPark, Eurocircuits.
 */

import type { DRCRule, DRCRuleType } from '@shared/component-types';
import type { DrcRuleOverride } from '@/lib/drc-presets';
import { formatRuleType } from '@/lib/drc-presets';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Status of a single field comparison between current and manufacturer rules. */
export type ComparisonStatus = 'stricter' | 'looser' | 'match';

/** A single field-level diff between current DRC rules and a manufacturer's rules. */
export interface ManufacturerRuleDiff {
  /** The DRC rule type being compared (e.g. 'min-clearance'). */
  ruleType: DRCRuleType;
  /** Human-readable label for the rule type. */
  ruleLabel: string;
  /** The specific parameter or attribute being compared (e.g. 'minClearance', 'severity'). */
  field: string;
  /** The current project value. */
  current: string | number;
  /** The manufacturer's recommended value. */
  manufacturer: string | number;
  /** Whether the current rule is stricter, looser, or matching the manufacturer. */
  status: ComparisonStatus;
}

/** A complete manufacturer rule set definition. */
export interface ManufacturerRuleSet {
  /** Display name of the manufacturer. */
  name: string;
  /** Short identifier used for programmatic lookup. */
  id: string;
  /** Brief description of the manufacturer's capabilities. */
  description: string;
  /** URL to the manufacturer's published design rules (for reference). */
  source: string;
  /** DRC rule overrides representing the manufacturer's minimum capabilities. */
  rules: DrcRuleOverride[];
}

/** Summary statistics for a manufacturer comparison. */
export interface ComparisonSummary {
  total: number;
  stricter: number;
  looser: number;
  match: number;
}

// ---------------------------------------------------------------------------
// Manufacturer Rule Sets
// ---------------------------------------------------------------------------

/**
 * JLCPCB standard capabilities.
 * Based on JLCPCB published capabilities for standard (non-advanced) PCBs.
 */
const JLCPCB_RULES: ManufacturerRuleSet = {
  name: 'JLCPCB',
  id: 'jlcpcb',
  description: 'Budget-friendly Chinese fab with fast turnaround. Standard 2-layer capabilities.',
  source: 'https://jlcpcb.com/capabilities/pcb-capabilities',
  rules: [
    { type: 'min-clearance', params: { minClearance: 6 }, severity: 'error' },
    { type: 'min-trace-width', params: { minWidth: 5 }, severity: 'error' },
    { type: 'pad-size', params: { minPadDiameter: 35, minDrillDiameter: 15 }, severity: 'error' },
    { type: 'annular-ring', params: { minAnnularRing: 5 }, severity: 'error' },
    { type: 'trace-to-edge', params: { minEdgeClearance: 8 }, severity: 'error' },
    { type: 'solder-mask', params: { minSolderMaskDam: 3, minSolderMaskExpansion: 2 }, severity: 'warning' },
    { type: 'via-in-pad', params: {}, severity: 'warning' },
    { type: 'courtyard-overlap', params: { minCourtyard: 8 }, severity: 'warning' },
    { type: 'thermal-relief', params: { minSpokeWidth: 8, minSpokeCount: 2 }, severity: 'warning' },
    { type: 'silk-overlap', params: {}, severity: 'warning' },
    { type: 'pin-spacing', params: { standardPitchMils: 100 }, severity: 'warning' },
  ],
};

/**
 * PCBWay standard capabilities.
 * Based on PCBWay published standard PCB capabilities.
 */
const PCBWAY_RULES: ManufacturerRuleSet = {
  name: 'PCBWay',
  id: 'pcbway',
  description: 'Popular Chinese fab with wide range of capabilities and assembly services.',
  source: 'https://www.pcbway.com/capabilities.html',
  rules: [
    { type: 'min-clearance', params: { minClearance: 6 }, severity: 'error' },
    { type: 'min-trace-width', params: { minWidth: 5 }, severity: 'error' },
    { type: 'pad-size', params: { minPadDiameter: 35, minDrillDiameter: 15 }, severity: 'error' },
    { type: 'annular-ring', params: { minAnnularRing: 5 }, severity: 'error' },
    { type: 'trace-to-edge', params: { minEdgeClearance: 10 }, severity: 'error' },
    { type: 'solder-mask', params: { minSolderMaskDam: 3, minSolderMaskExpansion: 2 }, severity: 'warning' },
    { type: 'via-in-pad', params: {}, severity: 'warning' },
    { type: 'courtyard-overlap', params: { minCourtyard: 10 }, severity: 'warning' },
    { type: 'thermal-relief', params: { minSpokeWidth: 8, minSpokeCount: 2 }, severity: 'warning' },
    { type: 'silk-overlap', params: {}, severity: 'warning' },
    { type: 'pin-spacing', params: { standardPitchMils: 100 }, severity: 'warning' },
  ],
};

/**
 * OSHPark capabilities.
 * US-based fab with higher quality but more conservative minimums.
 */
const OSHPARK_RULES: ManufacturerRuleSet = {
  name: 'OSHPark',
  id: 'oshpark',
  description: 'US-based community board house. Purple boards, ENIG finish, tighter tolerances.',
  source: 'https://docs.oshpark.com/design-tools/eagle/design-rules/',
  rules: [
    { type: 'min-clearance', params: { minClearance: 6 }, severity: 'error' },
    { type: 'min-trace-width', params: { minWidth: 5 }, severity: 'error' },
    { type: 'pad-size', params: { minPadDiameter: 40, minDrillDiameter: 20 }, severity: 'error' },
    { type: 'annular-ring', params: { minAnnularRing: 7 }, severity: 'error' },
    { type: 'trace-to-edge', params: { minEdgeClearance: 15 }, severity: 'error' },
    { type: 'solder-mask', params: { minSolderMaskDam: 4, minSolderMaskExpansion: 3 }, severity: 'error' },
    { type: 'via-in-pad', params: {}, severity: 'error' },
    { type: 'courtyard-overlap', params: { minCourtyard: 10 }, severity: 'error' },
    { type: 'thermal-relief', params: { minSpokeWidth: 10, minSpokeCount: 4 }, severity: 'error' },
    { type: 'silk-overlap', params: {}, severity: 'warning' },
    { type: 'pin-spacing', params: { standardPitchMils: 100 }, severity: 'warning' },
  ],
};

/**
 * Eurocircuits capabilities.
 * European fab with strict quality standards and broader material selection.
 */
const EUROCIRCUITS_RULES: ManufacturerRuleSet = {
  name: 'Eurocircuits',
  id: 'eurocircuits',
  description: 'European fab with stringent quality standards. IPC Class 2/3 capable.',
  source: 'https://www.eurocircuits.com/pcb-design-guidelines/',
  rules: [
    { type: 'min-clearance', params: { minClearance: 8 }, severity: 'error' },
    { type: 'min-trace-width', params: { minWidth: 6 }, severity: 'error' },
    { type: 'pad-size', params: { minPadDiameter: 45, minDrillDiameter: 20 }, severity: 'error' },
    { type: 'annular-ring', params: { minAnnularRing: 7 }, severity: 'error' },
    { type: 'trace-to-edge', params: { minEdgeClearance: 12 }, severity: 'error' },
    { type: 'solder-mask', params: { minSolderMaskDam: 5, minSolderMaskExpansion: 3 }, severity: 'error' },
    { type: 'via-in-pad', params: {}, severity: 'error' },
    { type: 'courtyard-overlap', params: { minCourtyard: 12 }, severity: 'error' },
    { type: 'thermal-relief', params: { minSpokeWidth: 10, minSpokeCount: 4 }, severity: 'error' },
    { type: 'silk-overlap', params: {}, severity: 'error' },
    { type: 'pin-spacing', params: { standardPitchMils: 100 }, severity: 'warning' },
  ],
};

/** All built-in manufacturer rule sets, indexed by ID. */
export const MANUFACTURER_RULES: ReadonlyMap<string, ManufacturerRuleSet> = new Map([
  [JLCPCB_RULES.id, JLCPCB_RULES],
  [PCBWAY_RULES.id, PCBWAY_RULES],
  [OSHPARK_RULES.id, OSHPARK_RULES],
  [EUROCIRCUITS_RULES.id, EUROCIRCUITS_RULES],
]);

/** List of all available manufacturer IDs, in display order. */
export function getManufacturerIds(): string[] {
  return Array.from(MANUFACTURER_RULES.keys());
}

/** Get a manufacturer rule set by ID. Returns undefined if not found. */
export function getManufacturerRuleSet(id: string): ManufacturerRuleSet | undefined {
  return MANUFACTURER_RULES.get(id);
}

// ---------------------------------------------------------------------------
// Comparison Logic
// ---------------------------------------------------------------------------

/**
 * Determine whether a numeric "current" value is stricter, looser, or matching
 * a manufacturer's value, given whether higher or lower is stricter.
 *
 * For minimum thresholds (clearance, trace width, annular ring), a HIGHER current
 * value means the user is being STRICTER (demanding more margin than the manufacturer).
 * For most DRC params, higher = stricter.
 */
function compareNumeric(current: number, mfg: number): ComparisonStatus {
  if (current === mfg) {
    return 'match';
  }
  // Higher current value = stricter (tighter tolerance / more margin)
  return current > mfg ? 'stricter' : 'looser';
}

/**
 * Compare severity levels. 'error' is stricter than 'warning'.
 */
function compareSeverity(current: string, mfg: string): ComparisonStatus {
  if (current === mfg) {
    return 'match';
  }
  return current === 'error' ? 'stricter' : 'looser';
}

/**
 * Resolve a manufacturer's overrides into a full DRC rule set for comparison.
 * Maps manufacturer overrides onto a base rule set (same logic as applyOverrides).
 */
function resolveManufacturerRules(
  base: DRCRule[],
  overrides: DrcRuleOverride[],
): DRCRule[] {
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

/**
 * Compare current DRC rules against a manufacturer's recommended rule set.
 * Returns an array of field-level diffs showing where the current rules are
 * stricter, looser, or matching the manufacturer.
 *
 * @param currentRules - The user's current DRC rules
 * @param manufacturerId - The manufacturer ID to compare against
 * @returns Array of per-field diffs, or empty array if manufacturer not found
 */
export function compareWithManufacturer(
  currentRules: DRCRule[],
  manufacturerId: string,
): ManufacturerRuleDiff[] {
  const mfgRuleSet = MANUFACTURER_RULES.get(manufacturerId);
  if (!mfgRuleSet) {
    return [];
  }

  const mfgResolved = resolveManufacturerRules(currentRules, mfgRuleSet.rules);
  const diffs: ManufacturerRuleDiff[] = [];

  for (let i = 0; i < currentRules.length; i++) {
    const current = currentRules[i];
    const mfg = mfgResolved[i];
    const ruleLabel = formatRuleType(current.type);

    // Compare severity
    if (current.severity !== mfg.severity) {
      diffs.push({
        ruleType: current.type,
        ruleLabel,
        field: 'severity',
        current: current.severity,
        manufacturer: mfg.severity,
        status: compareSeverity(current.severity, mfg.severity),
      });
    }

    // Compare each numeric param
    const allKeys = new Set([...Object.keys(current.params), ...Object.keys(mfg.params)]);
    for (const key of Array.from(allKeys)) {
      const curVal = current.params[key] ?? 0;
      const mfgVal = mfg.params[key] ?? 0;
      if (curVal !== mfgVal) {
        diffs.push({
          ruleType: current.type,
          ruleLabel,
          field: key,
          current: curVal,
          manufacturer: mfgVal,
          status: compareNumeric(curVal, mfgVal),
        });
      }
    }
  }

  return diffs;
}

/**
 * Compute a summary of the comparison results.
 */
export function summarizeComparison(diffs: ManufacturerRuleDiff[]): ComparisonSummary {
  return {
    total: diffs.length,
    stricter: diffs.filter((d) => d.status === 'stricter').length,
    looser: diffs.filter((d) => d.status === 'looser').length,
    match: diffs.filter((d) => d.status === 'match').length,
  };
}

/**
 * Build a manufacturer-resolved DRC rule array that can be applied directly
 * as the user's current rules. Uses the manufacturer's overrides on top of
 * the user's existing base rules.
 */
export function buildManufacturerRules(
  baseRules: DRCRule[],
  manufacturerId: string,
): DRCRule[] | null {
  const mfgRuleSet = MANUFACTURER_RULES.get(manufacturerId);
  if (!mfgRuleSet) {
    return null;
  }
  return resolveManufacturerRules(baseRules, mfgRuleSet.rules);
}
