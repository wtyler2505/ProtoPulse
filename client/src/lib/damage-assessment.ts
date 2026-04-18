/**
 * Component Damage Assessment Library
 *
 * Evaluates the physical condition of salvaged/recycled electronic components
 * using heuristic-based assessment from user-provided observations. Critical
 * for the maker audience who reuses components from old boards, salvage bins,
 * or second-hand purchases.
 *
 * Usage:
 *   const assessor = new DamageAssessor();
 *   const report = assessor.assess('capacitor-electrolytic', observations);
 *   logger.debug(report.overallGrade, report.usable);
 *
 * React hook:
 *   const { assess, getHistory, clearHistory, lastReport } = useDamageAssessment();
 */

import { useCallback, useState } from 'react';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DamageCategory =
  | 'corrosion'
  | 'heat-damage'
  | 'pin-health'
  | 'marking-legibility'
  | 'physical-damage'
  | 'moisture';

export type ComponentType =
  | 'ic'
  | 'resistor'
  | 'capacitor-electrolytic'
  | 'capacitor-ceramic'
  | 'capacitor-tantalum'
  | 'connector'
  | 'led'
  | 'transformer'
  | 'diode'
  | 'transistor'
  | 'relay'
  | 'generic';

export interface DamageObservation {
  category: DamageCategory;
  indicator: string;
  present: boolean;
  severity?: 'minor' | 'moderate' | 'severe';
}

export interface DamageCategoryResult {
  category: DamageCategory;
  score: number;
  severity: 'none' | 'minor' | 'moderate' | 'severe';
  description: string;
  indicators: string[];
}

export interface DamageReport {
  id: string;
  componentType: ComponentType;
  overallScore: number;
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  categories: DamageCategoryResult[];
  recommendations: string[];
  usable: boolean;
  assessedAt: number;
}

// ---------------------------------------------------------------------------
// Component-specific indicator checklists
// ---------------------------------------------------------------------------

interface IndicatorDefinition {
  indicator: string;
  category: DamageCategory;
  defaultSeverity: 'minor' | 'moderate' | 'severe';
}

const COMPONENT_INDICATORS: Record<ComponentType, IndicatorDefinition[]> = {
  'capacitor-electrolytic': [
    { indicator: 'bulging top', category: 'heat-damage', defaultSeverity: 'severe' },
    { indicator: 'leaking electrolyte', category: 'moisture', defaultSeverity: 'severe' },
    { indicator: 'brown discoloration', category: 'heat-damage', defaultSeverity: 'moderate' },
    { indicator: 'vent marks', category: 'heat-damage', defaultSeverity: 'severe' },
    { indicator: 'swollen casing', category: 'physical-damage', defaultSeverity: 'severe' },
    { indicator: 'corroded leads', category: 'corrosion', defaultSeverity: 'moderate' },
    { indicator: 'faded markings', category: 'marking-legibility', defaultSeverity: 'minor' },
    { indicator: 'bent leads', category: 'pin-health', defaultSeverity: 'minor' },
  ],
  ic: [
    { indicator: 'charred markings', category: 'heat-damage', defaultSeverity: 'severe' },
    { indicator: 'bent pins', category: 'pin-health', defaultSeverity: 'moderate' },
    { indicator: 'broken pins', category: 'pin-health', defaultSeverity: 'severe' },
    { indicator: 'corrosion on leads', category: 'corrosion', defaultSeverity: 'moderate' },
    { indicator: 'cracked package', category: 'physical-damage', defaultSeverity: 'severe' },
    { indicator: 'faded part number', category: 'marking-legibility', defaultSeverity: 'minor' },
    { indicator: 'moisture ingress signs', category: 'moisture', defaultSeverity: 'moderate' },
    { indicator: 'heat discoloration on body', category: 'heat-damage', defaultSeverity: 'moderate' },
  ],
  resistor: [
    { indicator: 'discoloration', category: 'heat-damage', defaultSeverity: 'moderate' },
    { indicator: 'cracked body', category: 'physical-damage', defaultSeverity: 'severe' },
    { indicator: 'burnt smell', category: 'heat-damage', defaultSeverity: 'severe' },
    { indicator: 'color band fading', category: 'marking-legibility', defaultSeverity: 'moderate' },
    { indicator: 'corroded leads', category: 'corrosion', defaultSeverity: 'minor' },
    { indicator: 'bent leads', category: 'pin-health', defaultSeverity: 'minor' },
  ],
  connector: [
    { indicator: 'bent pins', category: 'pin-health', defaultSeverity: 'moderate' },
    { indicator: 'oxidized contacts', category: 'corrosion', defaultSeverity: 'moderate' },
    { indicator: 'cracked housing', category: 'physical-damage', defaultSeverity: 'severe' },
    { indicator: 'loose fit', category: 'physical-damage', defaultSeverity: 'moderate' },
    { indicator: 'corroded pins', category: 'corrosion', defaultSeverity: 'severe' },
    { indicator: 'missing pins', category: 'pin-health', defaultSeverity: 'severe' },
    { indicator: 'moisture residue', category: 'moisture', defaultSeverity: 'minor' },
  ],
  led: [
    { indicator: 'cloudy lens', category: 'physical-damage', defaultSeverity: 'moderate' },
    { indicator: 'cracked dome', category: 'physical-damage', defaultSeverity: 'severe' },
    { indicator: 'blackened lead', category: 'heat-damage', defaultSeverity: 'severe' },
    { indicator: 'discolored lens', category: 'heat-damage', defaultSeverity: 'moderate' },
    { indicator: 'bent leads', category: 'pin-health', defaultSeverity: 'minor' },
    { indicator: 'corroded leads', category: 'corrosion', defaultSeverity: 'minor' },
  ],
  'capacitor-ceramic': [
    { indicator: 'cracked body', category: 'physical-damage', defaultSeverity: 'severe' },
    { indicator: 'chipped edges', category: 'physical-damage', defaultSeverity: 'moderate' },
    { indicator: 'discoloration', category: 'heat-damage', defaultSeverity: 'moderate' },
    { indicator: 'corroded leads', category: 'corrosion', defaultSeverity: 'minor' },
    { indicator: 'bent leads', category: 'pin-health', defaultSeverity: 'minor' },
    { indicator: 'faded markings', category: 'marking-legibility', defaultSeverity: 'minor' },
  ],
  'capacitor-tantalum': [
    { indicator: 'cracked body', category: 'physical-damage', defaultSeverity: 'severe' },
    { indicator: 'burn marks', category: 'heat-damage', defaultSeverity: 'severe' },
    { indicator: 'discoloration', category: 'heat-damage', defaultSeverity: 'moderate' },
    { indicator: 'corroded leads', category: 'corrosion', defaultSeverity: 'moderate' },
    { indicator: 'faded polarity marking', category: 'marking-legibility', defaultSeverity: 'moderate' },
    { indicator: 'bent leads', category: 'pin-health', defaultSeverity: 'minor' },
  ],
  transformer: [
    { indicator: 'burnt windings smell', category: 'heat-damage', defaultSeverity: 'severe' },
    { indicator: 'cracked core', category: 'physical-damage', defaultSeverity: 'severe' },
    { indicator: 'loose leads', category: 'pin-health', defaultSeverity: 'moderate' },
    { indicator: 'discoloration', category: 'heat-damage', defaultSeverity: 'moderate' },
    { indicator: 'corroded terminals', category: 'corrosion', defaultSeverity: 'moderate' },
    { indicator: 'moisture damage', category: 'moisture', defaultSeverity: 'moderate' },
    { indicator: 'faded markings', category: 'marking-legibility', defaultSeverity: 'minor' },
  ],
  diode: [
    { indicator: 'cracked body', category: 'physical-damage', defaultSeverity: 'severe' },
    { indicator: 'burnt smell', category: 'heat-damage', defaultSeverity: 'severe' },
    { indicator: 'faded band marking', category: 'marking-legibility', defaultSeverity: 'moderate' },
    { indicator: 'corroded leads', category: 'corrosion', defaultSeverity: 'minor' },
    { indicator: 'bent leads', category: 'pin-health', defaultSeverity: 'minor' },
    { indicator: 'discoloration', category: 'heat-damage', defaultSeverity: 'moderate' },
  ],
  transistor: [
    { indicator: 'cracked package', category: 'physical-damage', defaultSeverity: 'severe' },
    { indicator: 'burnt markings', category: 'heat-damage', defaultSeverity: 'severe' },
    { indicator: 'bent leads', category: 'pin-health', defaultSeverity: 'moderate' },
    { indicator: 'corroded leads', category: 'corrosion', defaultSeverity: 'moderate' },
    { indicator: 'faded part number', category: 'marking-legibility', defaultSeverity: 'minor' },
    { indicator: 'discoloration', category: 'heat-damage', defaultSeverity: 'moderate' },
  ],
  relay: [
    { indicator: 'cracked housing', category: 'physical-damage', defaultSeverity: 'severe' },
    { indicator: 'corroded contacts', category: 'corrosion', defaultSeverity: 'severe' },
    { indicator: 'burnt coil smell', category: 'heat-damage', defaultSeverity: 'severe' },
    { indicator: 'loose terminals', category: 'pin-health', defaultSeverity: 'moderate' },
    { indicator: 'moisture ingress', category: 'moisture', defaultSeverity: 'moderate' },
    { indicator: 'faded markings', category: 'marking-legibility', defaultSeverity: 'minor' },
    { indicator: 'bent pins', category: 'pin-health', defaultSeverity: 'minor' },
  ],
  generic: [
    { indicator: 'visible corrosion', category: 'corrosion', defaultSeverity: 'moderate' },
    { indicator: 'heat damage signs', category: 'heat-damage', defaultSeverity: 'moderate' },
    { indicator: 'bent or damaged pins', category: 'pin-health', defaultSeverity: 'moderate' },
    { indicator: 'illegible markings', category: 'marking-legibility', defaultSeverity: 'moderate' },
    { indicator: 'cracked or chipped body', category: 'physical-damage', defaultSeverity: 'severe' },
    { indicator: 'moisture or residue', category: 'moisture', defaultSeverity: 'minor' },
  ],
};

// ---------------------------------------------------------------------------
// Category weights per component type
// ---------------------------------------------------------------------------

/**
 * Weights define how important each damage category is for a given component
 * type. Higher weight means that category has more impact on the overall score.
 * Weights within a component type should sum to 1.0.
 */
const CATEGORY_WEIGHTS: Record<ComponentType, Record<DamageCategory, number>> = {
  ic: {
    'pin-health': 0.30,
    'heat-damage': 0.25,
    'physical-damage': 0.20,
    corrosion: 0.10,
    'marking-legibility': 0.05,
    moisture: 0.10,
  },
  resistor: {
    'heat-damage': 0.30,
    'physical-damage': 0.25,
    'marking-legibility': 0.20,
    corrosion: 0.10,
    'pin-health': 0.10,
    moisture: 0.05,
  },
  'capacitor-electrolytic': {
    'heat-damage': 0.30,
    moisture: 0.25,
    'physical-damage': 0.20,
    corrosion: 0.10,
    'pin-health': 0.10,
    'marking-legibility': 0.05,
  },
  'capacitor-ceramic': {
    'physical-damage': 0.35,
    'heat-damage': 0.25,
    corrosion: 0.15,
    'pin-health': 0.10,
    'marking-legibility': 0.10,
    moisture: 0.05,
  },
  'capacitor-tantalum': {
    'heat-damage': 0.30,
    'physical-damage': 0.25,
    'marking-legibility': 0.15,
    corrosion: 0.15,
    'pin-health': 0.10,
    moisture: 0.05,
  },
  connector: {
    'pin-health': 0.35,
    corrosion: 0.25,
    'physical-damage': 0.20,
    moisture: 0.10,
    'heat-damage': 0.05,
    'marking-legibility': 0.05,
  },
  led: {
    'physical-damage': 0.30,
    'heat-damage': 0.25,
    'pin-health': 0.20,
    corrosion: 0.10,
    'marking-legibility': 0.05,
    moisture: 0.10,
  },
  transformer: {
    'heat-damage': 0.30,
    'physical-damage': 0.25,
    moisture: 0.20,
    corrosion: 0.10,
    'pin-health': 0.10,
    'marking-legibility': 0.05,
  },
  diode: {
    'heat-damage': 0.30,
    'physical-damage': 0.25,
    'marking-legibility': 0.20,
    corrosion: 0.10,
    'pin-health': 0.10,
    moisture: 0.05,
  },
  transistor: {
    'heat-damage': 0.30,
    'pin-health': 0.25,
    'physical-damage': 0.20,
    corrosion: 0.10,
    'marking-legibility': 0.10,
    moisture: 0.05,
  },
  relay: {
    corrosion: 0.25,
    'heat-damage': 0.25,
    'physical-damage': 0.20,
    'pin-health': 0.15,
    moisture: 0.10,
    'marking-legibility': 0.05,
  },
  generic: {
    'physical-damage': 0.25,
    'heat-damage': 0.20,
    corrosion: 0.20,
    'pin-health': 0.15,
    moisture: 0.10,
    'marking-legibility': 0.10,
  },
};

// ---------------------------------------------------------------------------
// Severity score penalties
// ---------------------------------------------------------------------------

const SEVERITY_PENALTY: Record<'minor' | 'moderate' | 'severe', number> = {
  minor: 15,
  moderate: 35,
  severe: 70,
};

// ---------------------------------------------------------------------------
// Grade thresholds
// ---------------------------------------------------------------------------

const GRADE_THRESHOLDS: Array<{ min: number; grade: DamageReport['overallGrade'] }> = [
  { min: 90, grade: 'A' },
  { min: 75, grade: 'B' },
  { min: 60, grade: 'C' },
  { min: 40, grade: 'D' },
  { min: 0, grade: 'F' },
];

const USABILITY_THRESHOLD = 40;

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-damage-assessment-history';
const MAX_HISTORY = 100;

// ---------------------------------------------------------------------------
// All damage categories
// ---------------------------------------------------------------------------

const ALL_CATEGORIES: DamageCategory[] = [
  'corrosion',
  'heat-damage',
  'pin-health',
  'marking-legibility',
  'physical-damage',
  'moisture',
];

// ---------------------------------------------------------------------------
// DamageAssessor
// ---------------------------------------------------------------------------

/**
 * Heuristic-based component damage assessor.
 *
 * Evaluates user-provided observations (checklist-style input) against
 * component-type-specific profiles. Produces a scored report with per-category
 * breakdowns, recommendations, and a usability determination.
 *
 * No AI API required — all scoring is done locally via weighted heuristics.
 */
export class DamageAssessor {
  // -------------------------------------------------------------------------
  // Assessment
  // -------------------------------------------------------------------------

  /**
   * Assess a component's condition based on observations.
   *
   * @param componentType - Type of component being assessed
   * @param observations - Array of damage observations from user inspection
   * @returns Complete damage report with scores, grade, and recommendations
   */
  assess(componentType: ComponentType, observations: DamageObservation[]): DamageReport {
    const weights = CATEGORY_WEIGHTS[componentType];
    const categoryResults = this.scoreCategoriesFromObservations(componentType, observations);

    const overallScore = Math.round(
      categoryResults.reduce((sum, cat) => sum + cat.score * (weights[cat.category] ?? 0), 0),
    );

    const clampedScore = Math.max(0, Math.min(100, overallScore));
    const overallGrade = this.computeGrade(clampedScore);
    const usable = clampedScore >= USABILITY_THRESHOLD;
    const recommendations = this.generateRecommendations(componentType, categoryResults, clampedScore);

    return {
      id: crypto.randomUUID(),
      componentType,
      overallScore: clampedScore,
      overallGrade,
      categories: categoryResults,
      recommendations,
      usable,
      assessedAt: Date.now(),
    };
  }

  /**
   * Get the checklist of indicators for a component type.
   */
  getIndicators(componentType: ComponentType): IndicatorDefinition[] {
    return COMPONENT_INDICATORS[componentType] ?? COMPONENT_INDICATORS.generic;
  }

  // -------------------------------------------------------------------------
  // History (localStorage persistence)
  // -------------------------------------------------------------------------

  /**
   * Save a damage report to assessment history.
   */
  saveToHistory(report: DamageReport): void {
    const history = this.loadHistory();
    history.unshift(report);

    // Enforce max history
    while (history.length > MAX_HISTORY) {
      history.pop();
    }

    this.persistHistory(history);
  }

  /**
   * Get all saved damage reports from history.
   */
  getHistory(): DamageReport[] {
    return this.loadHistory();
  }

  /**
   * Clear all assessment history.
   */
  clearHistory(): void {
    this.persistHistory([]);
  }

  // -------------------------------------------------------------------------
  // Private scoring
  // -------------------------------------------------------------------------

  private scoreCategoriesFromObservations(
    componentType: ComponentType,
    observations: DamageObservation[],
  ): DamageCategoryResult[] {
    return ALL_CATEGORIES.map((category) => {
      const categoryObs = observations.filter((o) => o.category === category && o.present);

      if (categoryObs.length === 0) {
        return {
          category,
          score: 100,
          severity: 'none' as const,
          description: this.getCategoryDescription(category, 'none'),
          indicators: [],
        };
      }

      // Accumulate penalty from all present observations in this category
      let totalPenalty = 0;
      const indicators: string[] = [];

      for (const obs of categoryObs) {
        const severity = obs.severity ?? this.getDefaultSeverity(componentType, obs.indicator, category);
        totalPenalty += SEVERITY_PENALTY[severity];
        indicators.push(obs.indicator);
      }

      // Cap penalty at 100 (score floors at 0)
      const score = Math.max(0, 100 - totalPenalty);
      const overallSeverity = this.determineSeverityFromScore(score);

      return {
        category,
        score,
        severity: overallSeverity,
        description: this.getCategoryDescription(category, overallSeverity),
        indicators: indicators.filter((v, i, a) => a.indexOf(v) === i),
      };
    });
  }

  private getDefaultSeverity(
    componentType: ComponentType,
    indicator: string,
    _category: DamageCategory,
  ): 'minor' | 'moderate' | 'severe' {
    const definitions = COMPONENT_INDICATORS[componentType] ?? COMPONENT_INDICATORS.generic;
    const match = definitions.find(
      (d) => d.indicator.toLowerCase() === indicator.toLowerCase(),
    );
    return match?.defaultSeverity ?? 'moderate';
  }

  private determineSeverityFromScore(score: number): 'none' | 'minor' | 'moderate' | 'severe' {
    if (score >= 85) {
      return 'minor';
    }
    if (score >= 50) {
      return 'moderate';
    }
    return 'severe';
  }

  private getCategoryDescription(category: DamageCategory, severity: 'none' | 'minor' | 'moderate' | 'severe'): string {
    const categoryNames: Record<DamageCategory, string> = {
      corrosion: 'Corrosion',
      'heat-damage': 'Heat damage',
      'pin-health': 'Pin/lead health',
      'marking-legibility': 'Marking legibility',
      'physical-damage': 'Physical damage',
      moisture: 'Moisture damage',
    };

    const name = categoryNames[category];
    const descriptions: Record<string, string> = {
      none: `No ${name.toLowerCase()} issues detected.`,
      minor: `Minor ${name.toLowerCase()} — component likely functional.`,
      moderate: `Moderate ${name.toLowerCase()} — test before use.`,
      severe: `Severe ${name.toLowerCase()} — replacement recommended.`,
    };

    return descriptions[severity];
  }

  // -------------------------------------------------------------------------
  // Grade computation
  // -------------------------------------------------------------------------

  private computeGrade(score: number): DamageReport['overallGrade'] {
    for (const threshold of GRADE_THRESHOLDS) {
      if (score >= threshold.min) {
        return threshold.grade;
      }
    }
    return 'F';
  }

  // -------------------------------------------------------------------------
  // Recommendations
  // -------------------------------------------------------------------------

  private generateRecommendations(
    componentType: ComponentType,
    categories: DamageCategoryResult[],
    overallScore: number,
  ): string[] {
    const recommendations: string[] = [];

    // Grade-based overall recommendation
    if (overallScore >= 90) {
      recommendations.push('Component appears to be in excellent condition and is safe to use.');
    } else if (overallScore >= 75) {
      recommendations.push('Component is in good condition. Minor issues detected — visual inspection sufficient.');
    } else if (overallScore >= 60) {
      recommendations.push('Component has moderate damage. Test with a multimeter before use in a circuit.');
    } else if (overallScore >= 40) {
      recommendations.push('Component has significant damage. Use only in non-critical prototyping, not final designs.');
    } else {
      recommendations.push('Component is likely unusable. Consider recycling and replacing.');
    }

    // Category-specific recommendations
    for (const cat of categories) {
      if (cat.severity === 'none') {
        continue;
      }

      if (cat.category === 'corrosion' && (cat.severity === 'moderate' || cat.severity === 'severe')) {
        recommendations.push('Clean corroded leads with isopropyl alcohol and a fiberglass pen before soldering.');
      }

      if (cat.category === 'heat-damage' && cat.severity === 'severe') {
        recommendations.push('Severe heat damage detected — internal component failure is likely. Replace this part.');
      }

      if (cat.category === 'pin-health' && cat.severity === 'moderate') {
        recommendations.push('Carefully straighten bent pins with fine tweezers before insertion.');
      }

      if (cat.category === 'pin-health' && cat.severity === 'severe') {
        recommendations.push('Pins are broken or severely damaged — component cannot be reliably soldered.');
      }

      if (cat.category === 'marking-legibility' && (cat.severity === 'moderate' || cat.severity === 'severe')) {
        recommendations.push('Markings are unreadable — verify component value with a multimeter or LCR meter.');
      }

      if (cat.category === 'physical-damage' && cat.severity === 'severe') {
        recommendations.push('Structural integrity is compromised. Do not use in circuits carrying significant current.');
      }

      if (cat.category === 'moisture' && (cat.severity === 'moderate' || cat.severity === 'severe')) {
        recommendations.push('Allow component to fully dry. Bake moisture-sensitive parts at 85\u00B0C for 24 hours if possible.');
      }
    }

    // Component-type-specific recommendations
    if (componentType === 'capacitor-electrolytic') {
      const heatResult = categories.find((c) => c.category === 'heat-damage');
      if (heatResult && heatResult.severity === 'severe') {
        recommendations.push('Electrolytic capacitor with bulging/venting — risk of leaking or exploding. Dispose safely.');
      }
    }

    if (componentType === 'capacitor-tantalum') {
      const heatResult = categories.find((c) => c.category === 'heat-damage');
      if (heatResult && heatResult.severity !== 'none') {
        recommendations.push('Tantalum capacitors can fail short-circuit under heat stress — test carefully before use.');
      }
    }

    // Deduplicate recommendations
    return recommendations.filter((v, i, a) => a.indexOf(v) === i);
  }

  // -------------------------------------------------------------------------
  // Persistence helpers
  // -------------------------------------------------------------------------

  private loadHistory(): DamageReport[] {
    try {
      if (typeof window === 'undefined') {
        return [];
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return (parsed as unknown[]).filter(
        (item: unknown): item is DamageReport =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as DamageReport).id === 'string' &&
          typeof (item as DamageReport).componentType === 'string' &&
          typeof (item as DamageReport).overallScore === 'number' &&
          typeof (item as DamageReport).overallGrade === 'string' &&
          typeof (item as DamageReport).usable === 'boolean' &&
          typeof (item as DamageReport).assessedAt === 'number',
      );
    } catch {
      return [];
    }
  }

  private persistHistory(history: DamageReport[]): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook for using component damage assessment in React components.
 * Manages assessment state and history persistence.
 */
export function useDamageAssessment(): {
  assess: (componentType: ComponentType, observations: DamageObservation[]) => DamageReport;
  getHistory: () => DamageReport[];
  clearHistory: () => void;
  lastReport: DamageReport | null;
} {
  const [lastReport, setLastReport] = useState<DamageReport | null>(null);
  const [assessor] = useState(() => new DamageAssessor());

  const assess = useCallback(
    (componentType: ComponentType, observations: DamageObservation[]) => {
      const report = assessor.assess(componentType, observations);
      assessor.saveToHistory(report);
      setLastReport(report);
      return report;
    },
    [assessor],
  );

  const getHistory = useCallback(() => {
    return assessor.getHistory();
  }, [assessor]);

  const clearHistory = useCallback(() => {
    assessor.clearHistory();
  }, [assessor]);

  return { assess, getHistory, clearHistory, lastReport };
}
