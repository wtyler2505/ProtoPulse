/**
 * Fitness Scorer — Multi-criteria evaluation for generative circuit design candidates.
 *
 * Scores a CircuitIR on five dimensions:
 * 1. Component count — fewer is better (within bounds)
 * 2. Estimated cost — under budget is better
 * 3. DRC violations — zero violations is perfect
 * 4. Power budget — under limit is better
 * 5. Thermal margin — under max temperature is better
 *
 * Each criterion returns a score in [0, 1] (1 = best). A weighted sum
 * produces the overall fitness in [0, 1].
 *
 * @module generative-design/fitness-scorer
 */

import type { CircuitIR } from '@/lib/circuit-dsl/circuit-ir';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FitnessCriteria {
  componentCount: { weight: number; maxOptimal: number; maxAcceptable: number };
  estimatedCost: { weight: number; budgetUsd: number };
  drcViolations: { weight: number };
  powerBudget: { weight: number; maxWatts: number };
  thermalMargin: { weight: number; maxTempC: number };
}

export interface FitnessBreakdownEntry {
  score: number;
  weight: number;
  detail: string;
}

export interface FitnessResult {
  overall: number;
  breakdown: Record<string, FitnessBreakdownEntry>;
  violations: string[];
  rank: number;
}

// ---------------------------------------------------------------------------
// Cost estimation heuristics
// ---------------------------------------------------------------------------

/** Rough per-component cost estimates in USD for common part types. */
const PART_COST_MAP: Record<string, number> = {
  resistor: 0.02,
  capacitor: 0.05,
  inductor: 0.15,
  diode: 0.08,
  led: 0.1,
  transistor: 0.15,
  mosfet: 0.25,
  opamp: 0.5,
  regulator: 0.6,
  crystal: 0.3,
  fuse: 0.1,
  relay: 1.0,
  switch: 0.2,
  connector: 0.15,
  sensor: 0.8,
  motor: 2.0,
};

/** Default cost for unrecognized parts. */
const DEFAULT_PART_COST = 0.5;

/**
 * Estimate total BOM cost from the CircuitIR. Uses the partId field to look
 * up a rough cost. This is a heuristic — real costs come from suppliers.
 */
function estimateCost(ir: CircuitIR): number {
  let total = 0;
  for (const comp of ir.components) {
    const partKey = comp.partId.toLowerCase();
    const cost = PART_COST_MAP[partKey] ?? DEFAULT_PART_COST;
    total += cost;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Power estimation heuristics
// ---------------------------------------------------------------------------

/** Rough per-component power draw in watts. */
const PART_POWER_MAP: Record<string, number> = {
  resistor: 0.01,
  capacitor: 0.0,
  inductor: 0.0,
  diode: 0.02,
  led: 0.06,
  transistor: 0.05,
  mosfet: 0.1,
  opamp: 0.01,
  regulator: 0.2,
  motor: 1.0,
  relay: 0.2,
  sensor: 0.05,
};

const DEFAULT_PART_POWER = 0.05;

/** Estimate total power draw from the CircuitIR. */
function estimatePower(ir: CircuitIR): number {
  let total = 0;
  for (const comp of ir.components) {
    const partKey = comp.partId.toLowerCase();
    const power = PART_POWER_MAP[partKey] ?? DEFAULT_PART_POWER;
    total += power;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Thermal estimation heuristics
// ---------------------------------------------------------------------------

/** Estimate peak junction temperature. Simple: ambient + power * thermal resistance. */
function estimateTemperature(ir: CircuitIR): number {
  const ambient = 25; // 25C ambient
  const thermalResistance = 40; // C/W rough average
  const power = estimatePower(ir);
  return ambient + power * thermalResistance;
}

// ---------------------------------------------------------------------------
// DRC estimation
// ---------------------------------------------------------------------------

/**
 * Count DRC-like violations from the IR structure itself (lightweight check).
 * Checks for: floating nets, components with single-pin connections, etc.
 */
function countDrcViolations(ir: CircuitIR): { count: number; violations: string[] } {
  const violations: string[] = [];

  // Check for nets with no connected components
  const usedNets = new Set<string>();
  for (const comp of ir.components) {
    for (const netName of Object.values(comp.pins)) {
      usedNets.add(netName);
    }
  }

  for (const net of ir.nets) {
    if (!usedNets.has(net.name)) {
      violations.push(`Floating net: ${net.name} has no connections`);
    }
  }

  // Check for components with only one pin connected
  for (const comp of ir.components) {
    const pinCount = Object.keys(comp.pins).length;
    if (pinCount === 1) {
      violations.push(`${comp.refdes}: single-pin component may be floating`);
    }
  }

  return { count: violations.length, violations };
}

// ---------------------------------------------------------------------------
// Individual scorers (each returns 0-1)
// ---------------------------------------------------------------------------

function scoreComponentCount(count: number, maxOptimal: number, maxAcceptable: number): number {
  if (count <= maxOptimal) {
    return 1.0;
  }
  if (count >= maxAcceptable) {
    // Linear decay beyond maxAcceptable, floored at 0
    const excess = count - maxAcceptable;
    const range = maxAcceptable - maxOptimal;
    // Score drops from ~0.0 linearly; at 2x maxAcceptable it's 0
    return Math.max(0, -excess / (range > 0 ? range : 1));
  }
  // Linear interpolation between maxOptimal (1.0) and maxAcceptable (0.0)
  return 1.0 - (count - maxOptimal) / (maxAcceptable - maxOptimal);
}

function scoreCost(estimatedUsd: number, budgetUsd: number): number {
  if (budgetUsd <= 0) {
    return estimatedUsd <= 0 ? 1.0 : 0.0;
  }
  if (estimatedUsd <= budgetUsd) {
    return 1.0;
  }
  // Linear decay: at 2x budget → 0
  const ratio = estimatedUsd / budgetUsd;
  return Math.max(0, 2.0 - ratio);
}

function scoreDrc(violationCount: number): number {
  if (violationCount === 0) {
    return 1.0;
  }
  // Each violation reduces score by 0.15, minimum 0
  return Math.max(0, 1.0 - violationCount * 0.15);
}

function scorePower(estimatedWatts: number, maxWatts: number): number {
  if (maxWatts <= 0) {
    return estimatedWatts <= 0 ? 1.0 : 0.0;
  }
  if (estimatedWatts <= maxWatts) {
    return 1.0;
  }
  const ratio = estimatedWatts / maxWatts;
  return Math.max(0, 2.0 - ratio);
}

function scoreThermal(estimatedTempC: number, maxTempC: number): number {
  if (maxTempC <= 0) {
    return estimatedTempC <= 0 ? 1.0 : 0.0;
  }
  if (estimatedTempC <= maxTempC) {
    return 1.0;
  }
  // Linear decay: at 2x maxTemp → 0
  const ratio = estimatedTempC / maxTempC;
  return Math.max(0, 2.0 - ratio);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Score a circuit candidate against multi-criteria fitness evaluation.
 *
 * @param ir       - The CircuitIR to evaluate
 * @param criteria - Weighted fitness criteria
 * @returns FitnessResult with overall score [0,1], per-criterion breakdown, and violation list
 */
export function scoreCircuit(ir: CircuitIR, criteria: FitnessCriteria): FitnessResult {
  const componentCount = ir.components.length;
  const cost = estimateCost(ir);
  const power = estimatePower(ir);
  const temperature = estimateTemperature(ir);
  const drc = countDrcViolations(ir);

  const compScore = scoreComponentCount(
    componentCount,
    criteria.componentCount.maxOptimal,
    criteria.componentCount.maxAcceptable,
  );
  const costScore = scoreCost(cost, criteria.estimatedCost.budgetUsd);
  const drcScore = scoreDrc(drc.count);
  const powerScore = scorePower(power, criteria.powerBudget.maxWatts);
  const thermalScore = scoreThermal(temperature, criteria.thermalMargin.maxTempC);

  const breakdown: Record<string, FitnessBreakdownEntry> = {
    componentCount: {
      score: compScore,
      weight: criteria.componentCount.weight,
      detail: `${componentCount} components (optimal: <=${criteria.componentCount.maxOptimal}, acceptable: <=${criteria.componentCount.maxAcceptable})`,
    },
    estimatedCost: {
      score: costScore,
      weight: criteria.estimatedCost.weight,
      detail: `$${cost.toFixed(2)} estimated (budget: $${criteria.estimatedCost.budgetUsd.toFixed(2)})`,
    },
    drcViolations: {
      score: drcScore,
      weight: criteria.drcViolations.weight,
      detail: `${drc.count} violation${drc.count !== 1 ? 's' : ''} found`,
    },
    powerBudget: {
      score: powerScore,
      weight: criteria.powerBudget.weight,
      detail: `${power.toFixed(3)}W estimated (max: ${criteria.powerBudget.maxWatts}W)`,
    },
    thermalMargin: {
      score: thermalScore,
      weight: criteria.thermalMargin.weight,
      detail: `${temperature.toFixed(1)}C estimated (max: ${criteria.thermalMargin.maxTempC}C)`,
    },
  };

  // Weighted sum with normalization
  const totalWeight =
    criteria.componentCount.weight +
    criteria.estimatedCost.weight +
    criteria.drcViolations.weight +
    criteria.powerBudget.weight +
    criteria.thermalMargin.weight;

  let overall = 0;
  if (totalWeight > 0) {
    const weightedSum =
      compScore * criteria.componentCount.weight +
      costScore * criteria.estimatedCost.weight +
      drcScore * criteria.drcViolations.weight +
      powerScore * criteria.powerBudget.weight +
      thermalScore * criteria.thermalMargin.weight;
    overall = weightedSum / totalWeight;
  }

  return {
    overall,
    breakdown,
    violations: drc.violations,
    rank: 0,
  };
}

/**
 * Rank an array of FitnessResults by overall score descending.
 * Returns a new array with rank fields set (1 = best).
 * Does not mutate the input array.
 */
export function rankCandidates(results: FitnessResult[]): FitnessResult[] {
  const sorted = results
    .map((r) => ({ ...r }))
    .sort((a, b) => b.overall - a.overall);

  for (let i = 0; i < sorted.length; i++) {
    sorted[i].rank = i + 1;
  }

  return sorted;
}

/**
 * Return sensible default fitness criteria for maker/hobbyist circuits.
 */
export function defaultCriteria(): FitnessCriteria {
  return {
    componentCount: { weight: 0.2, maxOptimal: 10, maxAcceptable: 30 },
    estimatedCost: { weight: 0.25, budgetUsd: 25 },
    drcViolations: { weight: 0.3 },
    powerBudget: { weight: 0.15, maxWatts: 5 },
    thermalMargin: { weight: 0.1, maxTempC: 85 },
  };
}
