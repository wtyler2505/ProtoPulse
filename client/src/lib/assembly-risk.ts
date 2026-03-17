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

// ---------------------------------------------------------------------------
// Structured Assembly Risk Scoring API
// ---------------------------------------------------------------------------
// Complementary to the regex-based API above, this provides precise scoring
// when explicit component metadata (package type, pin count, pitch, etc.)
// is available rather than free-text descriptions.
// ---------------------------------------------------------------------------

export interface AssemblyRiskFactor {
  name: string;
  score: number; // 0–10
  weight: number; // 0–1
  description: string;
}

export type StructuredRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface AssemblyRiskResult {
  overall: number; // 0–100
  level: StructuredRiskLevel;
  factors: AssemblyRiskFactor[];
  suggestions: string[];
}

export interface BomItemRiskInput {
  package?: string;
  pinCount?: number;
  pitch?: number; // in mm
  hasThermalPad?: boolean;
  isDoubleSided?: boolean;
  mountingType?: 'smt' | 'tht' | 'mixed' | 'manual';
  esdSensitive?: boolean;
}

// ---------------------------------------------------------------------------
// Package complexity scoring
// ---------------------------------------------------------------------------

const PACKAGE_SCORES: Record<string, number> = {
  bga: 9,
  wlcsp: 10,
  csp: 9,
  fbga: 9,
  qfn: 7,
  dfn: 7,
  lga: 7,
  qfp: 6,
  tqfp: 6,
  lqfp: 6,
  tssop: 5,
  ssop: 4,
  msop: 5,
  soic: 3,
  sop: 3,
  sot: 3,
  dip: 2,
  pdip: 2,
  sip: 2,
  axial: 1,
  radial: 1,
  '0201': 8,
  '01005': 10,
  '0402': 6,
  '0603': 4,
  '0805': 2,
  '1206': 1,
};

function scorePackageComplexity(pkg: string | undefined): AssemblyRiskFactor | null {
  if (!pkg) { return null; }
  const normalized = pkg.toLowerCase().trim();

  // Try exact match first, then prefix match
  let score = PACKAGE_SCORES[normalized];
  if (score === undefined) {
    for (const [key, val] of Object.entries(PACKAGE_SCORES)) {
      if (normalized.includes(key)) {
        score = val;
        break;
      }
    }
  }

  if (score === undefined) { return null; }

  const descriptions: Record<number, string> = {
    10: 'Extremely difficult package — requires specialized equipment',
    9: 'Very complex package — hidden joints, X-ray inspection recommended',
    8: 'Very small passive — microscope required for placement',
    7: 'No-lead package — reflow oven required, difficult rework',
    6: 'Fine-pitch leaded or small passive — careful soldering needed',
    5: 'Moderately difficult — steady hand and good flux required',
    4: 'Slightly challenging — standard SMD skills sufficient',
    3: 'Standard SMD package — straightforward assembly',
    2: 'Easy package — through-hole or large SMD',
    1: 'Trivial package — simple hand soldering',
  };

  return {
    name: 'Package Complexity',
    score,
    weight: 0.3,
    description: descriptions[score] ?? `Package complexity score: ${String(score)}`,
  };
}

// ---------------------------------------------------------------------------
// Pin count scoring
// ---------------------------------------------------------------------------

function scorePinCount(pinCount: number | undefined): AssemblyRiskFactor | null {
  if (pinCount === undefined || pinCount <= 0) { return null; }

  let score: number;
  if (pinCount > 100) { score = 9; }
  else if (pinCount > 50) { score = 7; }
  else if (pinCount > 20) { score = 5; }
  else if (pinCount > 10) { score = 3; }
  else { score = 1; }

  return {
    name: 'Pin Count',
    score,
    weight: 0.2,
    description: `${String(pinCount)} pins — ${score >= 7 ? 'high alignment precision required' : score >= 5 ? 'moderate alignment precision needed' : 'manageable pin count'}`,
  };
}

// ---------------------------------------------------------------------------
// Fine pitch scoring
// ---------------------------------------------------------------------------

function scoreFinePitch(pitch: number | undefined): AssemblyRiskFactor | null {
  if (pitch === undefined || pitch <= 0) { return null; }

  let score: number;
  if (pitch < 0.4) { score = 9; }
  else if (pitch < 0.5) { score = 7; }
  else if (pitch < 0.65) { score = 5; }
  else if (pitch < 1.0) { score = 3; }
  else { score = 1; }

  return {
    name: 'Fine Pitch',
    score,
    weight: 0.2,
    description: `${String(pitch)}mm pitch — ${score >= 7 ? 'very fine, high solder bridge risk' : score >= 5 ? 'moderately fine pitch' : 'standard pitch'}`,
  };
}

// ---------------------------------------------------------------------------
// Thermal pad scoring
// ---------------------------------------------------------------------------

function scoreThermalPad(hasThermalPad: boolean | undefined): AssemblyRiskFactor | null {
  if (!hasThermalPad) { return null; }

  return {
    name: 'Thermal Pad',
    score: 3,
    weight: 0.1,
    description: 'Exposed thermal pad — requires precise paste stencil and reflow profile',
  };
}

// ---------------------------------------------------------------------------
// Double-sided assembly scoring
// ---------------------------------------------------------------------------

function scoreDoubleSided(isDoubleSided: boolean | undefined): AssemblyRiskFactor | null {
  if (!isDoubleSided) { return null; }

  return {
    name: 'Double-Sided Assembly',
    score: 2,
    weight: 0.1,
    description: 'Double-sided board — requires two reflow passes, heavier components may shift',
  };
}

// ---------------------------------------------------------------------------
// Manual placement scoring
// ---------------------------------------------------------------------------

function scoreMountingType(mountingType: BomItemRiskInput['mountingType']): AssemblyRiskFactor | null {
  if (!mountingType || mountingType === 'smt') { return null; }

  if (mountingType === 'manual') {
    return {
      name: 'Manual Placement',
      score: 4,
      weight: 0.15,
      description: 'Requires manual placement — not suitable for pick-and-place',
    };
  }

  if (mountingType === 'mixed') {
    return {
      name: 'Mixed Technology',
      score: 2,
      weight: 0.1,
      description: 'Mixed SMT + through-hole — requires multiple assembly steps',
    };
  }

  // tht
  return {
    name: 'Through-Hole',
    score: 1,
    weight: 0.05,
    description: 'Through-hole mounting — wave solder or manual, straightforward',
  };
}

// ---------------------------------------------------------------------------
// ESD sensitivity scoring
// ---------------------------------------------------------------------------

function scoreEsdSensitivity(esdSensitive: boolean | undefined): AssemblyRiskFactor | null {
  if (!esdSensitive) { return null; }

  return {
    name: 'ESD Sensitivity',
    score: 2,
    weight: 0.1,
    description: 'ESD-sensitive component — requires grounded workstation and handling precautions',
  };
}

// ---------------------------------------------------------------------------
// Suggestions generator
// ---------------------------------------------------------------------------

function generateSuggestions(factors: AssemblyRiskFactor[]): string[] {
  const suggestions: string[] = [];

  for (const factor of factors) {
    if (factor.name === 'Package Complexity' && factor.score >= 7) {
      suggestions.push('Consider using a reflow oven — hand soldering may be unreliable for this package.');
    }
    if (factor.name === 'Package Complexity' && factor.score >= 9) {
      suggestions.push('X-ray inspection recommended to verify solder joint quality.');
    }
    if (factor.name === 'Pin Count' && factor.score >= 7) {
      suggestions.push('Use solder paste stencil for consistent paste application on high pin-count components.');
    }
    if (factor.name === 'Fine Pitch' && factor.score >= 5) {
      suggestions.push('Apply flux generously and use drag soldering technique to reduce solder bridges.');
    }
    if (factor.name === 'Thermal Pad') {
      suggestions.push('Ensure stencil aperture for thermal pad is reduced to ~60% to prevent excess solder.');
    }
    if (factor.name === 'Double-Sided Assembly') {
      suggestions.push('Place heavier components on the first reflow side to prevent them falling off during second pass.');
    }
    if (factor.name === 'Manual Placement') {
      suggestions.push('Plan manual assembly steps in your build sequence to minimize handling of completed boards.');
    }
    if (factor.name === 'ESD Sensitivity') {
      suggestions.push('Use ESD-safe workstation, wrist strap, and anti-static packaging during assembly.');
    }
  }

  return suggestions;
}

// ---------------------------------------------------------------------------
// Structured risk level thresholds
// ---------------------------------------------------------------------------

/**
 * Get structured risk level with thresholds: critical >= 80, high >= 60, medium >= 40, low < 40.
 * Note: This uses different thresholds than `getRiskLevel` (which uses 25/50/75).
 */
export function getStructuredRiskLevel(score: number): StructuredRiskLevel {
  if (score >= 80) { return 'critical'; }
  if (score >= 60) { return 'high'; }
  if (score >= 40) { return 'medium'; }
  return 'low';
}

// ---------------------------------------------------------------------------
// Main structured scoring function
// ---------------------------------------------------------------------------

/**
 * Calculate assembly risk from structured component metadata.
 *
 * Unlike `calculateAssemblyRisks` which relies on regex matching against
 * description strings, this function accepts explicit component properties
 * for more precise and deterministic risk scoring.
 *
 * Factor scores are 0–10, each with a weight. The overall score is a
 * weighted average normalized to 0–100.
 */
export function calculateAssemblyRisk(item: BomItemRiskInput): AssemblyRiskResult {
  const factors: AssemblyRiskFactor[] = [];

  const packageFactor = scorePackageComplexity(item.package);
  if (packageFactor) { factors.push(packageFactor); }

  const pinFactor = scorePinCount(item.pinCount);
  if (pinFactor) { factors.push(pinFactor); }

  const pitchFactor = scoreFinePitch(item.pitch);
  if (pitchFactor) { factors.push(pitchFactor); }

  const thermalFactor = scoreThermalPad(item.hasThermalPad);
  if (thermalFactor) { factors.push(thermalFactor); }

  const doubleSidedFactor = scoreDoubleSided(item.isDoubleSided);
  if (doubleSidedFactor) { factors.push(doubleSidedFactor); }

  const mountingFactor = scoreMountingType(item.mountingType);
  if (mountingFactor) { factors.push(mountingFactor); }

  const esdFactor = scoreEsdSensitivity(item.esdSensitive);
  if (esdFactor) { factors.push(esdFactor); }

  // Scoring: primary factors (package, pins, pitch) determine base score via
  // weighted average. Modifier factors (thermal pad, double-sided, mounting,
  // ESD) add fixed point bumps. This prevents low-scoring boolean modifiers
  // from diluting the base score of genuinely difficult components.
  const PRIMARY_FACTOR_NAMES = new Set(['Package Complexity', 'Pin Count', 'Fine Pitch']);

  const primaryFactors = factors.filter((f) => PRIMARY_FACTOR_NAMES.has(f.name));
  const modifierFactors = factors.filter((f) => !PRIMARY_FACTOR_NAMES.has(f.name));

  // Base score from primary factors (weighted average → 0–100)
  let primaryWeightedSum = 0;
  let primaryTotalWeight = 0;
  for (const f of primaryFactors) {
    primaryWeightedSum += f.score * f.weight;
    primaryTotalWeight += f.weight;
  }
  const baseScore = primaryTotalWeight > 0
    ? (primaryWeightedSum / primaryTotalWeight) * 10
    : 0;

  // Modifier bumps (each modifier's score is added directly as percentage points)
  let modifierBump = 0;
  for (const f of modifierFactors) {
    modifierBump += f.score;
  }

  const overall = Math.min(100, Math.round(baseScore + modifierBump));

  const level = getStructuredRiskLevel(overall);
  const suggestions = generateSuggestions(factors);

  return { overall, level, factors, suggestions };
}
