/**
 * Predictive Yield Estimator (BL-0438)
 *
 * Estimates manufacturing yield from component count, placement types
 * (SMT/THT/BGA), PCB complexity, DFM violations, and test coverage.
 * Uses independent factor multiplication for overall yield, Cpk calculation
 * for process capability, and generates actionable yield improvement suggestions.
 *
 * Pure functions — no React, no side effects, no singletons.
 *
 * Usage:
 *   const input = buildYieldInput(bomItems, boardParams, dfmViolations, testCoverage);
 *   const estimate = estimateYield(input);
 *   const suggestions = generateYieldImprovements(estimate);
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PlacementType = 'smt' | 'tht' | 'bga' | 'mixed';
export type BoardComplexity = 'simple' | 'moderate' | 'complex' | 'extreme';
export type DfmSeverityLevel = 'error' | 'warning' | 'info';
export type YieldFactorId =
  | 'smt_placement'
  | 'tht_placement'
  | 'bga_placement'
  | 'solder_joint'
  | 'pcb_fabrication'
  | 'component_quality'
  | 'dfm_compliance'
  | 'test_coverage'
  | 'board_complexity'
  | 'fine_pitch';

export type ImprovementPriority = 'critical' | 'high' | 'medium' | 'low';
export type ImprovementCategory =
  | 'design'
  | 'process'
  | 'testing'
  | 'component'
  | 'fabrication';

export interface YieldComponent {
  refDes: string;
  partNumber: string;
  placementType: PlacementType;
  pinCount: number;
  pitch: number; // mm, 0 if N/A
  isCritical: boolean;
}

export interface YieldBoardParams {
  layers: number;
  widthMm: number;
  heightMm: number;
  minTraceWidth: number; // mm
  minDrillSize: number; // mm
  hasImpedanceControl: boolean;
  hasBlindVias: boolean;
  hasViaInPad: boolean;
}

export interface YieldDfmViolation {
  severity: DfmSeverityLevel;
  category: string;
  ruleId: string;
}

export interface YieldTestCoverage {
  functionalTestPercent: number; // 0-100
  ictPercent: number; // 0-100 (in-circuit test)
  aoi: boolean; // automated optical inspection
  xray: boolean; // X-ray inspection (for BGA)
  flyingProbe: boolean;
}

export interface YieldInput {
  components: YieldComponent[];
  board: YieldBoardParams;
  dfmViolations: YieldDfmViolation[];
  testCoverage: YieldTestCoverage;
  productionVolume: number;
}

export interface YieldFactor {
  id: YieldFactorId;
  name: string;
  yield: number; // 0-1
  description: string;
  weight: number; // relative importance 0-1
}

export interface CpkResult {
  cpk: number;
  cp: number;
  rating: 'excellent' | 'good' | 'marginal' | 'poor';
  description: string;
}

export interface YieldImprovement {
  priority: ImprovementPriority;
  category: ImprovementCategory;
  title: string;
  description: string;
  currentYield: number;
  projectedYield: number;
  effort: 'low' | 'medium' | 'high';
}

export interface YieldEstimate {
  overallYield: number; // 0-1
  overallYieldPercent: number; // 0-100
  factors: YieldFactor[];
  cpk: CpkResult;
  dpmo: number; // defects per million opportunities
  boardComplexity: BoardComplexity;
  estimatedScrapRate: number; // 0-1
  estimatedReworkRate: number; // 0-1
  costImpact: {
    scrapCostMultiplier: number;
    reworkCostMultiplier: number;
    effectiveCostMultiplier: number;
  };
  breakdownByType: {
    smtYield: number;
    thtYield: number;
    bgaYield: number;
    fabricationYield: number;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Base yields per placement type (per-joint probability of success) */
const BASE_YIELDS: Record<string, number> = {
  smt: 0.9998, // 99.98% per joint
  tht: 0.9995, // 99.95% per joint
  bga: 0.9992, // 99.92% per joint (hidden joints, harder to inspect)
};

/** Fine pitch threshold in mm — below this, yield degrades */
const FINE_PITCH_THRESHOLD = 0.5;

/** Volume discount — higher volumes have better process stability */
const VOLUME_YIELD_BONUS: Array<{ minVolume: number; bonus: number }> = [
  { minVolume: 10000, bonus: 0.005 },
  { minVolume: 5000, bonus: 0.003 },
  { minVolume: 1000, bonus: 0.002 },
  { minVolume: 100, bonus: 0.001 },
  { minVolume: 0, bonus: 0 },
];

/** DFM violation severity weights */
const DFM_SEVERITY_WEIGHTS: Record<DfmSeverityLevel, number> = {
  error: 0.02, // each error reduces DFM yield by 2%
  warning: 0.005, // each warning reduces by 0.5%
  info: 0.0005, // each info reduces by 0.05%
};

/** Board complexity thresholds */
const COMPLEXITY_THRESHOLDS = {
  simple: { maxLayers: 2, maxComponents: 30, maxBga: 0 },
  moderate: { maxLayers: 4, maxComponents: 100, maxBga: 2 },
  complex: { maxLayers: 8, maxComponents: 200, maxBga: 4 },
  // extreme: everything above complex
};

/** Fabrication yield by layer count */
const FAB_YIELD_BY_LAYERS: Array<{ maxLayers: number; yield: number }> = [
  { maxLayers: 1, yield: 0.995 },
  { maxLayers: 2, yield: 0.990 },
  { maxLayers: 4, yield: 0.980 },
  { maxLayers: 6, yield: 0.970 },
  { maxLayers: 8, yield: 0.955 },
  { maxLayers: 12, yield: 0.940 },
  { maxLayers: 16, yield: 0.920 },
  { maxLayers: Infinity, yield: 0.900 },
];

// ---------------------------------------------------------------------------
// Board complexity classification
// ---------------------------------------------------------------------------

export function classifyBoardComplexity(
  input: YieldInput,
): BoardComplexity {
  const { components, board } = input;
  const bgaCount = components.filter((c) => c.placementType === 'bga').length;
  const componentCount = components.length;
  const layers = board.layers;

  const hasAdvancedFeatures =
    board.hasImpedanceControl || board.hasBlindVias || board.hasViaInPad;

  if (
    layers <= COMPLEXITY_THRESHOLDS.simple.maxLayers &&
    componentCount <= COMPLEXITY_THRESHOLDS.simple.maxComponents &&
    bgaCount <= COMPLEXITY_THRESHOLDS.simple.maxBga &&
    !hasAdvancedFeatures
  ) {
    return 'simple';
  }

  if (
    layers <= COMPLEXITY_THRESHOLDS.moderate.maxLayers &&
    componentCount <= COMPLEXITY_THRESHOLDS.moderate.maxComponents &&
    bgaCount <= COMPLEXITY_THRESHOLDS.moderate.maxBga
  ) {
    return 'moderate';
  }

  if (
    layers <= COMPLEXITY_THRESHOLDS.complex.maxLayers &&
    componentCount <= COMPLEXITY_THRESHOLDS.complex.maxComponents &&
    bgaCount <= COMPLEXITY_THRESHOLDS.complex.maxBga
  ) {
    return 'complex';
  }

  return 'extreme';
}

// ---------------------------------------------------------------------------
// Yield factor calculations
// ---------------------------------------------------------------------------

function calculateSmtYield(components: YieldComponent[]): YieldFactor {
  const smtComponents = components.filter((c) => c.placementType === 'smt');
  if (smtComponents.length === 0) {
    return {
      id: 'smt_placement',
      name: 'SMT Placement',
      yield: 1.0,
      description: 'No SMT components',
      weight: 0,
    };
  }

  const totalJoints = smtComponents.reduce((sum, c) => sum + c.pinCount, 0);
  const perJointYield = BASE_YIELDS.smt;
  const placementYield = Math.pow(perJointYield, totalJoints);

  return {
    id: 'smt_placement',
    name: 'SMT Placement',
    yield: placementYield,
    description: `${smtComponents.length} SMT components, ${totalJoints} solder joints`,
    weight: 0.9,
  };
}

function calculateThtYield(components: YieldComponent[]): YieldFactor {
  const thtComponents = components.filter((c) => c.placementType === 'tht');
  if (thtComponents.length === 0) {
    return {
      id: 'tht_placement',
      name: 'THT Placement',
      yield: 1.0,
      description: 'No THT components',
      weight: 0,
    };
  }

  const totalJoints = thtComponents.reduce((sum, c) => sum + c.pinCount, 0);
  const perJointYield = BASE_YIELDS.tht;
  const placementYield = Math.pow(perJointYield, totalJoints);

  return {
    id: 'tht_placement',
    name: 'THT Placement',
    yield: placementYield,
    description: `${thtComponents.length} THT components, ${totalJoints} solder joints`,
    weight: 0.7,
  };
}

function calculateBgaYield(components: YieldComponent[]): YieldFactor {
  const bgaComponents = components.filter((c) => c.placementType === 'bga');
  if (bgaComponents.length === 0) {
    return {
      id: 'bga_placement',
      name: 'BGA Placement',
      yield: 1.0,
      description: 'No BGA components',
      weight: 0,
    };
  }

  const totalJoints = bgaComponents.reduce((sum, c) => sum + c.pinCount, 0);
  const perJointYield = BASE_YIELDS.bga;
  const placementYield = Math.pow(perJointYield, totalJoints);

  return {
    id: 'bga_placement',
    name: 'BGA Placement',
    yield: placementYield,
    description: `${bgaComponents.length} BGA components, ${totalJoints} solder joints`,
    weight: 1.0,
  };
}

function calculateFinePitchYield(components: YieldComponent[]): YieldFactor {
  const finePitchComponents = components.filter(
    (c) => c.pitch > 0 && c.pitch < FINE_PITCH_THRESHOLD,
  );
  if (finePitchComponents.length === 0) {
    return {
      id: 'fine_pitch',
      name: 'Fine Pitch',
      yield: 1.0,
      description: 'No fine-pitch components',
      weight: 0,
    };
  }

  // Each fine-pitch component reduces yield based on how fine the pitch is
  let yieldProduct = 1.0;
  finePitchComponents.forEach((c) => {
    const pitchFactor = c.pitch / FINE_PITCH_THRESHOLD; // 0 to 1
    const componentYield = 0.95 + 0.05 * pitchFactor; // 0.95 to 1.0
    yieldProduct *= componentYield;
  });

  return {
    id: 'fine_pitch',
    name: 'Fine Pitch',
    yield: yieldProduct,
    description: `${finePitchComponents.length} fine-pitch components (< ${FINE_PITCH_THRESHOLD}mm)`,
    weight: 0.8,
  };
}

function calculateSolderJointYield(components: YieldComponent[]): YieldFactor {
  const totalJoints = components.reduce((sum, c) => sum + c.pinCount, 0);
  if (totalJoints === 0) {
    return {
      id: 'solder_joint',
      name: 'Solder Joint Quality',
      yield: 1.0,
      description: 'No solder joints',
      weight: 0,
    };
  }

  // Overall solder joint reliability — considers total joint count
  // More joints = more opportunities for defects
  const defectRate = 0.0001; // 100 DPMO base defect rate
  const jointYield = Math.pow(1 - defectRate, totalJoints);

  return {
    id: 'solder_joint',
    name: 'Solder Joint Quality',
    yield: jointYield,
    description: `${totalJoints} total solder joints, ${Math.round(defectRate * 1e6)} DPMO base rate`,
    weight: 0.85,
  };
}

function calculateFabricationYield(board: YieldBoardParams): YieldFactor {
  let baseYield = 0.99;
  for (const tier of FAB_YIELD_BY_LAYERS) {
    if (board.layers <= tier.maxLayers) {
      baseYield = tier.yield;
      break;
    }
  }

  // Penalties for advanced features
  if (board.hasImpedanceControl) {
    baseYield *= 0.995;
  }
  if (board.hasBlindVias) {
    baseYield *= 0.990;
  }
  if (board.hasViaInPad) {
    baseYield *= 0.995;
  }

  // Penalty for very fine trace widths
  if (board.minTraceWidth < 0.1) {
    baseYield *= 0.98;
  } else if (board.minTraceWidth < 0.15) {
    baseYield *= 0.99;
  }

  // Penalty for very small drill sizes
  if (board.minDrillSize < 0.2) {
    baseYield *= 0.98;
  } else if (board.minDrillSize < 0.3) {
    baseYield *= 0.99;
  }

  return {
    id: 'pcb_fabrication',
    name: 'PCB Fabrication',
    yield: baseYield,
    description: `${board.layers}-layer board, ${board.minTraceWidth}mm min trace`,
    weight: 0.95,
  };
}

function calculateComponentQualityYield(
  components: YieldComponent[],
): YieldFactor {
  if (components.length === 0) {
    return {
      id: 'component_quality',
      name: 'Component Quality',
      yield: 1.0,
      description: 'No components',
      weight: 0,
    };
  }

  // Assume base component quality yield
  const criticalCount = components.filter((c) => c.isCritical).length;
  const criticalRatio = criticalCount / components.length;

  // More critical components = slightly lower quality yield (tighter screening needed)
  const baseYield = 0.999;
  const qualityYield = baseYield - criticalRatio * 0.002;

  return {
    id: 'component_quality',
    name: 'Component Quality',
    yield: Math.max(qualityYield, 0.99),
    description: `${criticalCount}/${components.length} critical components`,
    weight: 0.6,
  };
}

function calculateDfmComplianceYield(
  violations: YieldDfmViolation[],
): YieldFactor {
  if (violations.length === 0) {
    return {
      id: 'dfm_compliance',
      name: 'DFM Compliance',
      yield: 1.0,
      description: 'No DFM violations — excellent compliance',
      weight: 0.9,
    };
  }

  let totalPenalty = 0;
  violations.forEach((v) => {
    totalPenalty += DFM_SEVERITY_WEIGHTS[v.severity];
  });

  const dfmYield = Math.max(1.0 - totalPenalty, 0.5); // floor at 50%

  const errorCount = violations.filter((v) => v.severity === 'error').length;
  const warningCount = violations.filter((v) => v.severity === 'warning').length;

  return {
    id: 'dfm_compliance',
    name: 'DFM Compliance',
    yield: dfmYield,
    description: `${violations.length} violations (${errorCount} errors, ${warningCount} warnings)`,
    weight: 0.9,
  };
}

function calculateTestCoverageYield(
  testCoverage: YieldTestCoverage,
): YieldFactor {
  // Test coverage improves effective yield by catching defects early
  // Higher coverage = defects caught = lower escape rate
  const functionalWeight = 0.4;
  const ictWeight = 0.3;
  const aoiWeight = 0.15;
  const xrayWeight = 0.1;
  const flyingProbeWeight = 0.05;

  const coverageScore =
    (testCoverage.functionalTestPercent / 100) * functionalWeight +
    (testCoverage.ictPercent / 100) * ictWeight +
    (testCoverage.aoi ? 1.0 : 0) * aoiWeight +
    (testCoverage.xray ? 1.0 : 0) * xrayWeight +
    (testCoverage.flyingProbe ? 1.0 : 0) * flyingProbeWeight;

  // Coverage acts as a defect escape reduction factor
  // With 100% coverage score, yield is maintained; with 0%, defects escape
  const escapeReduction = 0.98 + 0.02 * coverageScore;

  return {
    id: 'test_coverage',
    name: 'Test Coverage',
    yield: escapeReduction,
    description: `${Math.round(coverageScore * 100)}% weighted coverage score`,
    weight: 0.7,
  };
}

function calculateBoardComplexityYield(
  complexity: BoardComplexity,
): YieldFactor {
  const complexityYields: Record<BoardComplexity, number> = {
    simple: 0.998,
    moderate: 0.995,
    complex: 0.985,
    extreme: 0.970,
  };

  return {
    id: 'board_complexity',
    name: 'Board Complexity',
    yield: complexityYields[complexity],
    description: `${complexity} board complexity`,
    weight: 0.75,
  };
}

// ---------------------------------------------------------------------------
// Cpk calculation
// ---------------------------------------------------------------------------

/**
 * Calculates process capability index (Cpk).
 * Uses overall yield to derive a sigma level, then converts to Cpk.
 *
 * Cpk = sigma / 3 (standard relationship)
 */
export function calculateCpk(overallYield: number): CpkResult {
  // Clamp yield to avoid math errors
  const clamped = Math.max(0.001, Math.min(0.999999, overallYield));

  // Convert yield to Z-score (sigma level) using inverse normal CDF
  const sigma = approximateInverseNormal(clamped);

  // Apply the standard 1.5σ shift convention used in Six Sigma:
  // A process with long-term yield Y has short-term sigma = Z + 1.5
  const shortTermSigma = sigma + 1.5;

  // Cpk = short-term sigma / 3
  const cpk = Math.max(shortTermSigma / 3, 0);
  const cp = cpk * 1.1;

  let rating: CpkResult['rating'];
  let description: string;

  if (cpk >= 2.0) {
    rating = 'excellent';
    description = 'World-class process capability — Six Sigma or better';
  } else if (cpk >= 1.33) {
    rating = 'good';
    description = 'Capable process — meets industry standards';
  } else if (cpk >= 1.0) {
    rating = 'marginal';
    description = 'Barely capable — process improvements recommended';
  } else {
    rating = 'poor';
    description = 'Incapable process — significant improvements required';
  }

  return { cpk: round4(cpk), cp: round4(cp), rating, description };
}

/**
 * Rational approximation of the inverse normal CDF.
 * Abramowitz & Stegun formula 26.2.23 — accurate to ~4.5e-4.
 */
function approximateInverseNormal(p: number): number {
  if (p <= 0) {
    return -4;
  }
  if (p >= 1) {
    return 4;
  }

  // Use symmetry: for p > 0.5, compute for (1-p) and negate
  const sign = p < 0.5 ? -1 : 1;
  const pAdj = p < 0.5 ? p : 1 - p;

  const t = Math.sqrt(-2 * Math.log(pAdj));

  // Rational approximation constants
  const c0 = 2.515517;
  const c1 = 0.802853;
  const c2 = 0.010328;
  const d1 = 1.432788;
  const d2 = 0.189269;
  const d3 = 0.001308;

  const numerator = c0 + c1 * t + c2 * t * t;
  const denominator = 1 + d1 * t + d2 * t * t + d3 * t * t * t;

  return sign * (t - numerator / denominator);
}

// ---------------------------------------------------------------------------
// Volume adjustment
// ---------------------------------------------------------------------------

function getVolumeBonus(volume: number): number {
  for (const tier of VOLUME_YIELD_BONUS) {
    if (volume >= tier.minVolume) {
      return tier.bonus;
    }
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Core estimator
// ---------------------------------------------------------------------------

/**
 * Estimates manufacturing yield from all input factors.
 * Uses independent factor multiplication: overall yield = product of all factors.
 */
export function estimateYield(input: YieldInput): YieldEstimate {
  const complexity = classifyBoardComplexity(input);

  // Calculate all yield factors
  const factors: YieldFactor[] = [
    calculateSmtYield(input.components),
    calculateThtYield(input.components),
    calculateBgaYield(input.components),
    calculateFinePitchYield(input.components),
    calculateSolderJointYield(input.components),
    calculateFabricationYield(input.board),
    calculateComponentQualityYield(input.components),
    calculateDfmComplianceYield(input.dfmViolations),
    calculateTestCoverageYield(input.testCoverage),
    calculateBoardComplexityYield(complexity),
  ];

  // Overall yield = product of all active factors (weight > 0)
  const activeFactors = factors.filter((f) => f.weight > 0);
  let overallYield = 1.0;
  activeFactors.forEach((f) => {
    overallYield *= f.yield;
  });

  // Apply volume bonus
  const volumeBonus = getVolumeBonus(input.productionVolume);
  overallYield = Math.min(overallYield + volumeBonus, 0.9999);

  // Round yield first, then derive all dependent values from rounded yield
  const roundedYield = round4(overallYield);

  // Calculate DPMO from rounded yield for consistency
  const dpmo = Math.round((1 - roundedYield) * 1_000_000);

  // Cpk
  const cpk = calculateCpk(roundedYield);

  // Scrap and rework rates from rounded yield
  const defectRate = 1 - roundedYield;
  const estimatedScrapRate = round4(defectRate * 0.4); // 40% of defects are scrap
  const estimatedReworkRate = round4(defectRate * 0.6); // 60% of defects are reworkable

  // Cost impact
  const scrapCostMultiplier = 1 + estimatedScrapRate;
  const reworkCostMultiplier = 1 + estimatedReworkRate * 0.3; // rework costs ~30% of unit cost
  const effectiveCostMultiplier = scrapCostMultiplier * reworkCostMultiplier;

  // Breakdown by type
  const smtFactor = factors.find((f) => f.id === 'smt_placement');
  const thtFactor = factors.find((f) => f.id === 'tht_placement');
  const bgaFactor = factors.find((f) => f.id === 'bga_placement');
  const fabFactor = factors.find((f) => f.id === 'pcb_fabrication');

  return {
    overallYield: roundedYield,
    overallYieldPercent: round2(roundedYield * 100),
    factors,
    cpk,
    dpmo,
    boardComplexity: complexity,
    estimatedScrapRate,
    estimatedReworkRate,
    costImpact: {
      scrapCostMultiplier: round4(scrapCostMultiplier),
      reworkCostMultiplier: round4(reworkCostMultiplier),
      effectiveCostMultiplier: round4(effectiveCostMultiplier),
    },
    breakdownByType: {
      smtYield: round4(smtFactor?.yield ?? 1.0),
      thtYield: round4(thtFactor?.yield ?? 1.0),
      bgaYield: round4(bgaFactor?.yield ?? 1.0),
      fabricationYield: round4(fabFactor?.yield ?? 1.0),
    },
  };
}

// ---------------------------------------------------------------------------
// Yield improvement suggestions
// ---------------------------------------------------------------------------

/**
 * Generates actionable suggestions to improve yield based on the estimate.
 * Sorted by priority (critical first) then by projected improvement.
 */
export function generateYieldImprovements(
  estimate: YieldEstimate,
): YieldImprovement[] {
  const improvements: YieldImprovement[] = [];

  estimate.factors.forEach((factor) => {
    if (factor.weight === 0) {
      return;
    }

    if (factor.id === 'dfm_compliance' && factor.yield < 0.98) {
      improvements.push({
        priority: factor.yield < 0.90 ? 'critical' : 'high',
        category: 'design',
        title: 'Resolve DFM violations',
        description:
          'Fix design-for-manufacturability violations. Each DFM error reduces yield by ~2%. Address errors first, then warnings.',
        currentYield: factor.yield,
        projectedYield: Math.min(factor.yield + 0.05, 1.0),
        effort: 'medium',
      });
    }

    if (factor.id === 'bga_placement' && factor.yield < 0.98) {
      improvements.push({
        priority: 'high',
        category: 'process',
        title: 'Add X-ray inspection for BGA',
        description:
          'BGA solder joints are hidden and cannot be visually inspected. X-ray inspection catches voids, bridges, and opens early.',
        currentYield: factor.yield,
        projectedYield: Math.min(factor.yield * 1.01, 1.0),
        effort: 'medium',
      });
    }

    if (factor.id === 'fine_pitch' && factor.yield < 0.99) {
      improvements.push({
        priority: 'high',
        category: 'process',
        title: 'Optimize stencil for fine-pitch components',
        description:
          'Fine-pitch components (< 0.5mm) need stepped or nano-coated stencils with tighter aperture ratios to prevent bridging.',
        currentYield: factor.yield,
        projectedYield: Math.min(factor.yield + 0.02, 1.0),
        effort: 'medium',
      });
    }

    if (factor.id === 'test_coverage' && factor.yield < 0.995) {
      improvements.push({
        priority: 'medium',
        category: 'testing',
        title: 'Increase test coverage',
        description:
          'Higher test coverage catches defects before shipping. Add AOI for surface defects, ICT for electrical verification, or functional testing.',
        currentYield: factor.yield,
        projectedYield: Math.min(factor.yield + 0.005, 1.0),
        effort: 'low',
      });
    }

    if (factor.id === 'pcb_fabrication' && factor.yield < 0.97) {
      improvements.push({
        priority: 'medium',
        category: 'fabrication',
        title: 'Relax PCB fabrication constraints',
        description:
          'Consider widening minimum trace widths, increasing drill sizes, or reducing layer count to improve fabrication yield.',
        currentYield: factor.yield,
        projectedYield: Math.min(factor.yield + 0.02, 1.0),
        effort: 'high',
      });
    }

    if (factor.id === 'component_quality' && factor.yield < 0.995) {
      improvements.push({
        priority: 'low',
        category: 'component',
        title: 'Use automotive/industrial grade components',
        description:
          'Upgrade critical components to higher reliability grades (AEC-Q100/Q200) for improved incoming quality.',
        currentYield: factor.yield,
        projectedYield: Math.min(factor.yield + 0.003, 1.0),
        effort: 'medium',
      });
    }

    if (factor.id === 'tht_placement' && factor.yield < 0.99) {
      improvements.push({
        priority: 'medium',
        category: 'design',
        title: 'Convert THT to SMT where possible',
        description:
          'Through-hole components have lower placement yield than SMT. Convert connectors, power components to SMT equivalents where feasible.',
        currentYield: factor.yield,
        projectedYield: Math.min(factor.yield + 0.005, 1.0),
        effort: 'high',
      });
    }
  });

  // Sort: critical > high > medium > low, then by improvement delta descending
  const priorityOrder: Record<ImprovementPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  improvements.sort((a, b) => {
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pDiff !== 0) {
      return pDiff;
    }
    return (b.projectedYield - b.currentYield) - (a.projectedYield - a.currentYield);
  });

  return improvements;
}

// ---------------------------------------------------------------------------
// Helper: build YieldInput from common ProtoPulse data structures
// ---------------------------------------------------------------------------

/**
 * Detects placement type from part description or package string.
 */
export function detectPlacementType(description: string): PlacementType {
  const d = description.toLowerCase();
  if (/\bbga\b|\bfbga\b|\bwlcsp\b|ball\s*grid/i.test(d)) {
    return 'bga';
  }
  if (/\btht\b|\bthrough[- ]?hole\b|\bdip\b|\bto-\d+\b|\bpdip\b/i.test(d)) {
    return 'tht';
  }
  if (
    /\bsmt\b|\bsmd\b|\bsurface\s*mount\b|\bsoic\b|\bsot\b|\bqfp\b|\bqfn\b|\btssop\b|\bmsop\b|\b0402\b|\b0603\b|\b0805\b|\b1206\b/i.test(
      d,
    )
  ) {
    return 'smt';
  }
  // Default to SMT for unrecognized
  return 'smt';
}

/**
 * Estimates pin count from part description.
 */
export function estimatePinCount(description: string): number {
  // Try to extract pin count from description
  const pinMatch = /\b(\d+)\s*-?\s*pin/i.exec(description);
  if (pinMatch) {
    return parseInt(pinMatch[1], 10);
  }

  // Estimate from package type
  const d = description.toLowerCase();
  if (/\b0402\b|\b0603\b|\b0805\b|\b1206\b/.test(d)) {
    return 2; // passives
  }
  if (/\bsot-23\b/.test(d)) {
    return 3;
  }
  if (/\bsoic-8\b/.test(d)) {
    return 8;
  }
  if (/\bsoic-16\b/.test(d)) {
    return 16;
  }
  if (/\btqfp\b|\bqfp\b/.test(d)) {
    return 44;
  }
  if (/\bbga\b/.test(d)) {
    return 256;
  }
  if (/\bdip\b/.test(d)) {
    return 14;
  }

  return 4; // conservative default
}

/**
 * Estimates pitch from part description (mm).
 */
export function estimatePitch(description: string): number {
  const pitchMatch = /(\d+\.?\d*)\s*mm\s*pitch/i.exec(description);
  if (pitchMatch) {
    return parseFloat(pitchMatch[1]);
  }

  const d = description.toLowerCase();
  if (/\bqfn\b/.test(d)) {
    return 0.5;
  }
  if (/\btqfp-?\d*\b/.test(d)) {
    return 0.5;
  }
  if (/\bsoic\b/.test(d)) {
    return 1.27;
  }
  if (/\bbga\b/.test(d)) {
    return 0.8;
  }
  if (/\b0402\b/.test(d)) {
    return 0.5;
  }
  if (/\b0603\b/.test(d)) {
    return 0.8;
  }

  return 0; // unknown / N/A
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
