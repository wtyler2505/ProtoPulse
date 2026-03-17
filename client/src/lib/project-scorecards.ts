import type { Grade } from './release-readiness';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScorecardDimension = 'cost' | 'risk' | 'readiness' | 'complexity' | 'quality';

export interface DimensionScore {
  dimension: ScorecardDimension;
  score: number;
  grade: Grade;
  details: string[];
  suggestions: string[];
}

export interface ProjectScorecard {
  projectId: number;
  dimensions: DimensionScore[];
  overall: number;
  overallGrade: Grade;
  generatedAt: Date;
}

// ─── Input types ──────────────────────────────────────────────────────────────

export interface ScorecardBomItem {
  unitPrice?: number;
  quantity?: number;
  supplier?: string;
  partNumber?: string;
  manufacturer?: string;
}

export interface ProjectData {
  projectId: number;
  bomItems: ScorecardBomItem[];
  drcErrors: number;
  lifecycleWarnings: number;
  simulationPassing: boolean;
  nodeCount: number;
  netCount: number;
  layerCount: number;
  testCoverage: number;
  docCoverage: number;
  drcClean: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function scoreToGrade(score: number): Grade {
  if (score >= 90) {
    return 'A';
  }
  if (score >= 75) {
    return 'B';
  }
  if (score >= 60) {
    return 'C';
  }
  if (score >= 40) {
    return 'D';
  }
  return 'F';
}

// ─── Dimension Calculators ────────────────────────────────────────────────────

/**
 * Cost score evaluates BOM cost health:
 * - Starts at 100
 * - Penalizes items missing prices (-10 each)
 * - Penalizes high total cost (>$500 threshold)
 * - Penalizes single-source items (no alternate suppliers implied by missing supplier)
 * - Rewards complete pricing data
 */
export function calculateCostScore(bomItems: ScorecardBomItem[]): DimensionScore {
  const details: string[] = [];
  const suggestions: string[] = [];

  if (bomItems.length === 0) {
    details.push('No BOM items to evaluate');
    suggestions.push('Add components to the BOM for cost analysis');
    return { dimension: 'cost', score: 0, grade: 'F', details, suggestions };
  }

  let score = 100;

  // Count items with pricing info
  const itemsWithPrice = bomItems.filter(
    (item) => item.unitPrice !== undefined && item.unitPrice !== null,
  );
  const missingPriceCount = bomItems.length - itemsWithPrice.length;

  if (missingPriceCount > 0) {
    const penalty = missingPriceCount * 10;
    score -= penalty;
    details.push(
      `${missingPriceCount} item${missingPriceCount > 1 ? 's' : ''} missing price data`,
    );
    suggestions.push('Add unit prices to all BOM items for accurate cost tracking');
  }

  // Calculate total cost from priced items
  let totalCost = 0;
  for (const item of itemsWithPrice) {
    const qty = item.quantity ?? 1;
    totalCost += (item.unitPrice ?? 0) * qty;
  }
  totalCost = Math.round(totalCost * 100) / 100;

  if (totalCost > 0) {
    details.push(`Total estimated cost: $${totalCost.toFixed(2)}`);
  }

  // High cost penalty (graduated thresholds)
  if (totalCost > 1000) {
    score -= 20;
    suggestions.push('Consider cost optimization: total exceeds $1000');
  } else if (totalCost > 500) {
    score -= 10;
    suggestions.push('Review high-cost components for cheaper alternatives');
  }

  // Supplier coverage
  const missingSupplierCount = bomItems.filter((item) => !item.supplier).length;
  if (missingSupplierCount > 0) {
    const supplierPenalty = Math.min(missingSupplierCount * 5, 20);
    score -= supplierPenalty;
    details.push(
      `${missingSupplierCount} item${missingSupplierCount > 1 ? 's' : ''} missing supplier info`,
    );
    suggestions.push('Add supplier information for procurement planning');
  }

  // Part number completeness
  const missingPartCount = bomItems.filter((item) => !item.partNumber).length;
  if (missingPartCount > 0) {
    score -= missingPartCount * 5;
    details.push(
      `${missingPartCount} item${missingPartCount > 1 ? 's' : ''} missing part numbers`,
    );
  }

  score = clamp(score, 0, 100);
  return { dimension: 'cost', score, grade: scoreToGrade(score), details, suggestions };
}

/**
 * Risk score evaluates design risk factors:
 * - DRC errors are the primary risk driver (-8 per error)
 * - Lifecycle warnings indicate supply chain risk (-6 per warning)
 * - Simulation failure is a major risk flag (-30)
 * - Clean DRC + passing sim + no lifecycle warnings = 100
 */
export function calculateRiskScore(
  drcErrors: number,
  lifecycleWarnings: number,
  simulationPassing: boolean,
): DimensionScore {
  const details: string[] = [];
  const suggestions: string[] = [];

  let score = 100;

  // DRC errors
  if (drcErrors > 0) {
    const drcPenalty = drcErrors * 8;
    score -= drcPenalty;
    details.push(`${drcErrors} DRC error${drcErrors > 1 ? 's' : ''} detected`);
    suggestions.push('Fix all DRC errors to reduce manufacturing risk');
  } else {
    details.push('DRC clean: no errors');
  }

  // Lifecycle warnings
  if (lifecycleWarnings > 0) {
    const lifePenalty = lifecycleWarnings * 6;
    score -= lifePenalty;
    details.push(
      `${lifecycleWarnings} lifecycle warning${lifecycleWarnings > 1 ? 's' : ''}`,
    );
    suggestions.push('Address component lifecycle warnings to reduce supply chain risk');
  }

  // Simulation
  if (!simulationPassing) {
    score -= 30;
    details.push('Simulation not passing');
    suggestions.push('Fix simulation failures before proceeding to manufacturing');
  } else {
    details.push('Simulation passing');
  }

  score = clamp(score, 0, 100);
  return { dimension: 'risk', score, grade: scoreToGrade(score), details, suggestions };
}

/**
 * Complexity score evaluates design complexity:
 * - Starts at 100 for trivial designs
 * - nodeCount: graduated thresholds (>50: -10, >100: -20, >200: -30)
 * - netCount: graduated thresholds (>30: -10, >100: -20, >200: -30)
 * - layerCount: graduated thresholds (>4: -10, >8: -20, >16: -30)
 * - Higher complexity = lower score (harder to manage)
 */
export function calculateComplexityScore(
  nodeCount: number,
  netCount: number,
  layerCount: number,
): DimensionScore {
  const details: string[] = [];
  const suggestions: string[] = [];

  let score = 100;

  // Node complexity
  details.push(`${nodeCount} component${nodeCount !== 1 ? 's' : ''}`);
  if (nodeCount > 200) {
    score -= 30;
    suggestions.push('Consider breaking design into hierarchical sub-sheets');
  } else if (nodeCount > 100) {
    score -= 20;
    suggestions.push('Design is moderately complex; consider modular organization');
  } else if (nodeCount > 50) {
    score -= 10;
  }

  // Net complexity
  details.push(`${netCount} net${netCount !== 1 ? 's' : ''}`);
  if (netCount > 200) {
    score -= 30;
    suggestions.push('High net count: use bus notation and net classes for clarity');
  } else if (netCount > 100) {
    score -= 20;
  } else if (netCount > 30) {
    score -= 10;
  }

  // Layer complexity
  details.push(`${layerCount} layer${layerCount !== 1 ? 's' : ''}`);
  if (layerCount > 16) {
    score -= 30;
    suggestions.push('Very high layer count: review stackup for optimization');
  } else if (layerCount > 8) {
    score -= 20;
    suggestions.push('Consider if all layers are necessary');
  } else if (layerCount > 4) {
    score -= 10;
  }

  score = clamp(score, 0, 100);
  return { dimension: 'complexity', score, grade: scoreToGrade(score), details, suggestions };
}

/**
 * Quality score evaluates design quality:
 * - testCoverage (0-100): percentage of the score, weighted 40%
 * - docCoverage (0-100): percentage of the score, weighted 30%
 * - drcClean: 30% of score (0 or 30)
 */
export function calculateQualityScore(
  testCoverage: number,
  docCoverage: number,
  drcClean: boolean,
): DimensionScore {
  const details: string[] = [];
  const suggestions: string[] = [];

  const clampedTestCov = clamp(testCoverage, 0, 100);
  const clampedDocCov = clamp(docCoverage, 0, 100);

  const testComponent = clampedTestCov * 0.4;
  const docComponent = clampedDocCov * 0.3;
  const drcComponent = drcClean ? 30 : 0;

  const score = clamp(Math.round(testComponent + docComponent + drcComponent), 0, 100);

  details.push(`Test coverage: ${clampedTestCov}%`);
  details.push(`Documentation coverage: ${clampedDocCov}%`);
  details.push(`DRC: ${drcClean ? 'clean' : 'has violations'}`);

  if (clampedTestCov < 50) {
    suggestions.push('Increase test coverage to at least 50%');
  } else if (clampedTestCov < 80) {
    suggestions.push('Improve test coverage above 80% for high confidence');
  }

  if (clampedDocCov < 50) {
    suggestions.push('Add documentation for key design decisions');
  }

  if (!drcClean) {
    suggestions.push('Resolve all DRC violations for a clean quality score');
  }

  return { dimension: 'quality', score, grade: scoreToGrade(score), details, suggestions };
}

// ─── Readiness dimension (delegates to release-readiness concepts) ────────────

/**
 * Readiness score is a composite indicator of how close the design is to
 * manufacturing readiness. Combines aspects from the release-readiness module
 * into a single 0-100 dimension:
 * - DRC clean: 30 points
 * - Simulation passing: 25 points
 * - BOM completeness (has items with part numbers): 25 points
 * - Low lifecycle risk: 20 points
 */
export function calculateReadinessScore(
  drcClean: boolean,
  simulationPassing: boolean,
  bomItems: ScorecardBomItem[],
  lifecycleWarnings: number,
): DimensionScore {
  const details: string[] = [];
  const suggestions: string[] = [];

  let score = 0;

  // DRC component
  if (drcClean) {
    score += 30;
    details.push('DRC clean (+30)');
  } else {
    details.push('DRC has violations (+0)');
    suggestions.push('Clear all DRC violations before manufacturing');
  }

  // Simulation component
  if (simulationPassing) {
    score += 25;
    details.push('Simulation passing (+25)');
  } else {
    details.push('Simulation not passing (+0)');
    suggestions.push('Run and pass simulations to validate the design');
  }

  // BOM completeness component
  if (bomItems.length > 0) {
    const completeBom = bomItems.filter(
      (item) => item.partNumber && item.manufacturer && item.unitPrice !== undefined,
    );
    const completionRatio = completeBom.length / bomItems.length;
    const bomPoints = Math.round(25 * completionRatio);
    score += bomPoints;
    details.push(
      `BOM ${Math.round(completionRatio * 100)}% complete (+${bomPoints})`,
    );
    if (completionRatio < 1) {
      suggestions.push('Complete part numbers, manufacturers, and prices for all BOM items');
    }
  } else {
    details.push('No BOM items (+0)');
    suggestions.push('Add components to the BOM');
  }

  // Lifecycle risk component
  if (lifecycleWarnings === 0) {
    score += 20;
    details.push('No lifecycle warnings (+20)');
  } else if (lifecycleWarnings <= 2) {
    score += 10;
    details.push(`${lifecycleWarnings} lifecycle warning${lifecycleWarnings > 1 ? 's' : ''} (+10)`);
    suggestions.push('Address lifecycle warnings for full readiness');
  } else {
    details.push(`${lifecycleWarnings} lifecycle warnings (+0)`);
    suggestions.push('Too many lifecycle warnings: replace affected components');
  }

  score = clamp(score, 0, 100);
  return { dimension: 'readiness', score, grade: scoreToGrade(score), details, suggestions };
}

// ─── Scorecard Generator ──────────────────────────────────────────────────────

const DIMENSION_WEIGHTS: Record<ScorecardDimension, number> = {
  cost: 0.20,
  risk: 0.25,
  readiness: 0.25,
  complexity: 0.15,
  quality: 0.15,
};

export function generateScorecard(data: ProjectData): ProjectScorecard {
  const cost = calculateCostScore(data.bomItems);
  const risk = calculateRiskScore(data.drcErrors, data.lifecycleWarnings, data.simulationPassing);
  const complexity = calculateComplexityScore(data.nodeCount, data.netCount, data.layerCount);
  const quality = calculateQualityScore(data.testCoverage, data.docCoverage, data.drcClean);
  const readiness = calculateReadinessScore(
    data.drcClean,
    data.simulationPassing,
    data.bomItems,
    data.lifecycleWarnings,
  );

  const dimensions: DimensionScore[] = [cost, risk, complexity, quality, readiness];

  const overall = Math.round(
    dimensions.reduce(
      (sum, dim) => sum + dim.score * DIMENSION_WEIGHTS[dim.dimension],
      0,
    ),
  );

  return {
    projectId: data.projectId,
    dimensions,
    overall,
    overallGrade: scoreToGrade(overall),
    generatedAt: new Date(),
  };
}

// ─── Text Formatter ───────────────────────────────────────────────────────────

export function formatScorecardText(card: ProjectScorecard): string {
  const lines: string[] = [];

  lines.push(`Project Scorecard (ID: ${card.projectId})`);
  lines.push(`Generated: ${card.generatedAt.toISOString()}`);
  lines.push(`Overall: ${card.overall}/100 (${card.overallGrade})`);
  lines.push('');

  for (const dim of card.dimensions) {
    lines.push(`[${dim.dimension.toUpperCase()}] ${dim.score}/100 (${dim.grade})`);
    for (const detail of dim.details) {
      lines.push(`  - ${detail}`);
    }
    if (dim.suggestions.length > 0) {
      lines.push('  Suggestions:');
      for (const suggestion of dim.suggestions) {
        lines.push(`    * ${suggestion}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}
