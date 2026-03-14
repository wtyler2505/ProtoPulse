// ---------------------------------------------------------------------------
// Assembly Risk Analysis Engine
// ---------------------------------------------------------------------------
// Evaluates BOM items for assembly difficulty based on package type, pitch,
// component size, thermal sensitivity, and other manufacturing factors.
// Returns scored risk assessments with color coding for heatmap visualization.
// ---------------------------------------------------------------------------

import type { BomItem } from '@/lib/project-context';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RiskFactor {
  name: string;
  weight: number;
  score: number;
  description: string;
}

export interface AssemblyRisk {
  refDes: string;
  partNumber: string;
  description: string;
  riskScore: number;
  factors: RiskFactor[];
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ComponentPlacement {
  refDes: string;
  partNumber: string;
  x: number;
  y: number;
  rotation: number;
}

// ---------------------------------------------------------------------------
// Risk factor detectors
// ---------------------------------------------------------------------------

interface FactorDetector {
  name: string;
  weight: number;
  detect: (description: string, partNumber: string) => { score: number; description: string } | null;
}

const FINE_PITCH_PATTERNS: { pattern: RegExp; score: number; desc: string }[] = [
  { pattern: /\b0\.3\s*mm\b/i, score: 1.0, desc: '0.3mm pitch — requires precision stencil and placement' },
  { pattern: /\b0\.4\s*mm\b/i, score: 0.9, desc: '0.4mm pitch — very fine, high bridging risk' },
  { pattern: /\b0\.5\s*mm\b/i, score: 0.7, desc: '0.5mm pitch — fine pitch, careful inspection needed' },
  { pattern: /\b0\.65\s*mm\b/i, score: 0.5, desc: '0.65mm pitch — moderately fine' },
  { pattern: /\bfine[- ]?pitch\b/i, score: 0.8, desc: 'Fine pitch package — high solder bridge risk' },
];

const BGA_PATTERNS: { pattern: RegExp; score: number; desc: string }[] = [
  { pattern: /\bwlcsp\b/i, score: 1.0, desc: 'WLCSP — wafer-level CSP, extremely difficult rework' },
  { pattern: /\bfbga\b/i, score: 0.95, desc: 'Fine-pitch BGA — requires X-ray inspection' },
  { pattern: /\bbga\b/i, score: 0.9, desc: 'BGA package — hidden solder joints, X-ray recommended' },
  { pattern: /\bcsp\b/i, score: 0.85, desc: 'CSP — chip-scale package, no visual solder inspection' },
];

const SMALL_PASSIVE_PATTERNS: { pattern: RegExp; score: number; desc: string }[] = [
  { pattern: /\b01005\b/, score: 1.0, desc: '01005 (0.4x0.2mm) — near-impossible to hand place' },
  { pattern: /\b0201\b/, score: 0.9, desc: '0201 (0.6x0.3mm) — microscope and tweezers required' },
  { pattern: /\b0402\b/, score: 0.7, desc: '0402 (1.0x0.5mm) — very small, easy to lose or tombstone' },
  { pattern: /\b0603\b/, score: 0.4, desc: '0603 (1.6x0.8mm) — small but manageable with practice' },
];

const HAND_SOLDER_DIFFICULTY_PATTERNS: { pattern: RegExp; score: number; desc: string }[] = [
  { pattern: /\bqfn\b/i, score: 0.85, desc: 'QFN — exposed pad underneath, difficult hand reflow' },
  { pattern: /\bdfn\b/i, score: 0.85, desc: 'DFN — no-lead package, requires hot air or reflow' },
  { pattern: /\bson\b/i, score: 0.8, desc: 'SON — small outline no-lead, reflow recommended' },
  { pattern: /\blga\b/i, score: 0.8, desc: 'LGA — land grid array, no visual solder inspection' },
  { pattern: /\bmsop\b/i, score: 0.5, desc: 'MSOP — miniature SOP, needs steady hand' },
  { pattern: /\btssop\b/i, score: 0.45, desc: 'TSSOP — thin shrink SOP, moderate difficulty' },
  { pattern: /\bssop\b/i, score: 0.4, desc: 'SSOP — shrink SOP, manageable with flux' },
];

const HEIGHT_PATTERNS: { pattern: RegExp; score: number; desc: string }[] = [
  { pattern: /\btall\b/i, score: 0.6, desc: 'Tall component — may interfere with reflow profile' },
  { pattern: /\belectrolytic\b/i, score: 0.5, desc: 'Electrolytic capacitor — height-sensitive, check clearance' },
  { pattern: /\btransformer\b/i, score: 0.7, desc: 'Transformer — heavy, may need adhesive during reflow' },
  { pattern: /\binductor\b.*\bshielded\b/i, score: 0.4, desc: 'Shielded inductor — moderate height concern' },
  { pattern: /\bheatsink\b/i, score: 0.5, desc: 'Heatsink — assembly sequence matters' },
  { pattern: /\bheat sink\b/i, score: 0.5, desc: 'Heat sink — assembly sequence matters' },
];

const THERMAL_SENSITIVITY_PATTERNS: { pattern: RegExp; score: number; desc: string }[] = [
  { pattern: /\bled\b/i, score: 0.5, desc: 'LED — heat-sensitive, short reflow exposure needed' },
  { pattern: /\bcrystal\b/i, score: 0.6, desc: 'Crystal — temperature-sensitive, careful reflow profile' },
  { pattern: /\boscillator\b/i, score: 0.55, desc: 'Oscillator — thermal stress can shift frequency' },
  { pattern: /\bbattery\b/i, score: 0.8, desc: 'Battery — heat damage risk, hand-solder only' },
  { pattern: /\bplastic\b/i, score: 0.4, desc: 'Plastic housing — may warp during reflow' },
  { pattern: /\bmems\b/i, score: 0.7, desc: 'MEMS sensor — mechanically fragile, thermal stress risk' },
  { pattern: /\bsensor\b/i, score: 0.45, desc: 'Sensor — may be temperature-sensitive' },
];

function detectBestMatch(
  combined: string,
  patterns: { pattern: RegExp; score: number; desc: string }[],
): { score: number; description: string } | null {
  let best: { score: number; description: string } | null = null;
  for (const p of patterns) {
    if (p.pattern.test(combined)) {
      if (!best || p.score > best.score) {
        best = { score: p.score, description: p.desc };
      }
    }
  }
  return best;
}

const FACTOR_DETECTORS: FactorDetector[] = [
  {
    name: 'Fine Pitch',
    weight: 0.25,
    detect: (desc, pn) => detectBestMatch(`${desc} ${pn}`, FINE_PITCH_PATTERNS),
  },
  {
    name: 'BGA Package',
    weight: 0.25,
    detect: (desc, pn) => detectBestMatch(`${desc} ${pn}`, BGA_PATTERNS),
  },
  {
    name: 'Small Passives',
    weight: 0.15,
    detect: (desc, pn) => detectBestMatch(`${desc} ${pn}`, SMALL_PASSIVE_PATTERNS),
  },
  {
    name: 'Hand-Solder Difficulty',
    weight: 0.15,
    detect: (desc, pn) => detectBestMatch(`${desc} ${pn}`, HAND_SOLDER_DIFFICULTY_PATTERNS),
  },
  {
    name: 'Component Height',
    weight: 0.1,
    detect: (desc, pn) => detectBestMatch(`${desc} ${pn}`, HEIGHT_PATTERNS),
  },
  {
    name: 'Thermal Sensitivity',
    weight: 0.1,
    detect: (desc, pn) => detectBestMatch(`${desc} ${pn}`, THERMAL_SENSITIVITY_PATTERNS),
  },
];

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Calculate assembly risk for each BOM item.
 * Each item gets a weighted score 0–100 based on detected risk factors.
 */
export function calculateAssemblyRisks(
  bomItems: BomItem[],
  placements?: ComponentPlacement[],
): AssemblyRisk[] {
  const placementMap = new Map<string, ComponentPlacement>();
  if (placements) {
    for (const p of placements) {
      placementMap.set(p.partNumber, p);
    }
  }

  return bomItems.map((item, index) => {
    const factors: RiskFactor[] = [];
    let weightedSum = 0;
    let totalWeight = 0;

    for (const detector of FACTOR_DETECTORS) {
      const result = detector.detect(item.description, item.partNumber);
      if (result) {
        factors.push({
          name: detector.name,
          weight: detector.weight,
          score: result.score,
          description: result.description,
        });
        weightedSum += detector.weight * result.score;
        totalWeight += detector.weight;
      }
    }

    // Normalize score to 0–100 scale
    const riskScore = totalWeight > 0
      ? Math.round((weightedSum / totalWeight) * 100)
      : 0;

    const placement = placementMap.get(item.partNumber);
    const refDes = placement?.refDes ?? `U${String(index + 1)}`;

    return {
      refDes,
      partNumber: item.partNumber,
      description: item.description,
      riskScore,
      factors,
    };
  });
}

/**
 * Map a numeric risk score (0–100) to an SVG-friendly hex color.
 * Green → Yellow → Orange → Red gradient.
 */
export function getRiskColor(score: number): string {
  const clamped = Math.max(0, Math.min(100, score));
  if (clamped <= 25) { return '#22c55e'; } // green-500
  if (clamped <= 50) { return '#eab308'; } // yellow-500
  if (clamped <= 75) { return '#f97316'; } // orange-500
  return '#ef4444'; // red-500
}

/**
 * Classify a risk score into a named level.
 */
export function getRiskLevel(score: number): RiskLevel {
  if (score <= 25) { return 'low'; }
  if (score <= 50) { return 'medium'; }
  if (score <= 75) { return 'high'; }
  return 'critical';
}

/**
 * Determine the overall risk level for a set of assessed items.
 * Uses the maximum individual score to set the board-level classification.
 */
export function getOverallRiskLevel(risks: AssemblyRisk[]): RiskLevel {
  if (risks.length === 0) { return 'low'; }
  const maxScore = Math.max(...risks.map((r) => r.riskScore));
  return getRiskLevel(maxScore);
}

/**
 * Get a human-readable label for a risk level.
 */
export function getRiskLevelLabel(level: RiskLevel): string {
  switch (level) {
    case 'low': return 'Low Risk';
    case 'medium': return 'Medium Risk';
    case 'high': return 'High Risk';
    case 'critical': return 'Critical Risk';
  }
}

/**
 * Get Tailwind text color class for a risk level.
 */
export function getRiskLevelColor(level: RiskLevel): string {
  switch (level) {
    case 'low': return 'text-emerald-400';
    case 'medium': return 'text-yellow-400';
    case 'high': return 'text-orange-400';
    case 'critical': return 'text-red-400';
  }
}

/**
 * Get Tailwind background classes for a risk level badge.
 */
export function getRiskLevelBadgeClasses(level: RiskLevel): string {
  switch (level) {
    case 'low': return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
    case 'medium': return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
    case 'high': return 'bg-orange-500/10 border-orange-500/30 text-orange-400';
    case 'critical': return 'bg-red-500/10 border-red-500/30 text-red-400';
  }
}

/**
 * Sort key for risk table — highest risk first by default.
 */
export type RiskSortField = 'riskScore' | 'refDes' | 'partNumber' | 'factors';
export type SortDirection = 'asc' | 'desc';

export function sortRisks(
  risks: AssemblyRisk[],
  field: RiskSortField,
  direction: SortDirection,
): AssemblyRisk[] {
  const sorted = [...risks];
  const dir = direction === 'asc' ? 1 : -1;

  sorted.sort((a, b) => {
    switch (field) {
      case 'riskScore':
        return (a.riskScore - b.riskScore) * dir;
      case 'refDes':
        return a.refDes.localeCompare(b.refDes) * dir;
      case 'partNumber':
        return a.partNumber.localeCompare(b.partNumber) * dir;
      case 'factors':
        return (a.factors.length - b.factors.length) * dir;
      default:
        return 0;
    }
  });

  return sorted;
}
