export type ReadinessCategory = 'drc' | 'bom' | 'lifecycle' | 'simulation' | 'documentation';

export interface CategoryScore {
  category: ReadinessCategory;
  score: number;
  weight: number;
  issues: string[];
  suggestions: string[];
}

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface ReadinessResult {
  overall: number;
  grade: Grade;
  categories: CategoryScore[];
  blockers: string[];
}

export interface DrcViolation {
  severity: 'error' | 'warning' | 'info';
}

export interface BomItem {
  partNumber?: string;
  manufacturer?: string;
  unitPrice?: number;
  supplier?: string;
}

export interface LifecycleItem {
  status: 'active' | 'nrnd' | 'eol' | 'obsolete' | 'unknown';
}

export interface ReadinessInput {
  drcViolations: DrcViolation[];
  bomItems: BomItem[];
  lifecycleItems: LifecycleItem[];
  hasSimulationResults: boolean;
  simulationPassing: boolean;
  hasDesignReport: boolean;
  hasComments: boolean;
  unresolvedComments: number;
}

const SEVERITY_PENALTY: Record<DrcViolation['severity'], number> = {
  error: 15,
  warning: 5,
  info: 1,
};

const LIFECYCLE_SCORE: Record<LifecycleItem['status'], number> = {
  active: 100,
  nrnd: 50,
  eol: 20,
  obsolete: 0,
  unknown: 60,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function calculateDrcScore(violations: DrcViolation[]): CategoryScore {
  const issues: string[] = [];
  const suggestions: string[] = [];

  const errorCount = violations.filter((v) => v.severity === 'error').length;
  const warningCount = violations.filter((v) => v.severity === 'warning').length;
  const infoCount = violations.filter((v) => v.severity === 'info').length;

  let score = 100;
  for (const v of violations) {
    score -= SEVERITY_PENALTY[v.severity];
  }
  score = clamp(score, 0, 100);

  if (errorCount > 0) {
    issues.push(`${errorCount} DRC error${errorCount > 1 ? 's' : ''} found`);
    suggestions.push('Resolve all DRC errors before manufacturing');
  }
  if (warningCount > 0) {
    issues.push(`${warningCount} DRC warning${warningCount > 1 ? 's' : ''} found`);
    suggestions.push('Review DRC warnings for potential issues');
  }
  if (infoCount > 0) {
    issues.push(`${infoCount} DRC info item${infoCount > 1 ? 's' : ''}`);
  }

  return { category: 'drc', score, weight: 0.30, issues, suggestions };
}

export function calculateBomScore(items: BomItem[]): CategoryScore {
  const issues: string[] = [];
  const suggestions: string[] = [];

  if (items.length === 0) {
    suggestions.push('Add components to the BOM');
    return { category: 'bom', score: 0, weight: 0.25, issues, suggestions };
  }

  let total = 0;
  let missingPartNumbers = 0;
  let missingManufacturers = 0;
  let missingPrices = 0;
  let missingSuppliers = 0;

  for (const item of items) {
    let itemScore = 0;
    if (item.partNumber) {
      itemScore += 25;
    } else {
      missingPartNumbers++;
    }
    if (item.manufacturer) {
      itemScore += 25;
    } else {
      missingManufacturers++;
    }
    if (item.unitPrice !== undefined && item.unitPrice !== null) {
      itemScore += 25;
    } else {
      missingPrices++;
    }
    if (item.supplier) {
      itemScore += 25;
    } else {
      missingSuppliers++;
    }
    total += itemScore;
  }

  const score = Math.round(total / items.length);

  if (missingPartNumbers > 0) {
    issues.push(`${missingPartNumbers} item${missingPartNumbers > 1 ? 's' : ''} missing part numbers`);
  }
  if (missingManufacturers > 0) {
    issues.push(`${missingManufacturers} item${missingManufacturers > 1 ? 's' : ''} missing manufacturers`);
  }
  if (missingPrices > 0) {
    issues.push(`${missingPrices} item${missingPrices > 1 ? 's' : ''} missing prices`);
  }
  if (missingSuppliers > 0) {
    issues.push(`${missingSuppliers} item${missingSuppliers > 1 ? 's' : ''} missing suppliers`);
    suggestions.push('Add supplier information for procurement');
  }

  return { category: 'bom', score, weight: 0.25, issues, suggestions };
}

export function calculateLifecycleScore(items: LifecycleItem[]): CategoryScore {
  const issues: string[] = [];
  const suggestions: string[] = [];

  if (items.length === 0) {
    return { category: 'lifecycle', score: 100, weight: 0.15, issues, suggestions };
  }

  let total = 0;
  let obsoleteCount = 0;
  let eolCount = 0;
  let nrndCount = 0;

  for (const item of items) {
    total += LIFECYCLE_SCORE[item.status];
    if (item.status === 'obsolete') {
      obsoleteCount++;
    }
    if (item.status === 'eol') {
      eolCount++;
    }
    if (item.status === 'nrnd') {
      nrndCount++;
    }
  }

  const score = Math.round(total / items.length);

  if (obsoleteCount > 0) {
    issues.push(`${obsoleteCount} obsolete component${obsoleteCount > 1 ? 's' : ''}`);
    suggestions.push('Replace obsolete components with active alternatives');
  }
  if (eolCount > 0) {
    issues.push(`${eolCount} end-of-life component${eolCount > 1 ? 's' : ''}`);
    suggestions.push('Plan replacements for end-of-life components');
  }
  if (nrndCount > 0) {
    issues.push(`${nrndCount} not-recommended component${nrndCount > 1 ? 's' : ''}`);
  }

  return { category: 'lifecycle', score, weight: 0.15, issues, suggestions };
}

export function calculateSimulationScore(hasResults: boolean, resultsPassing: boolean): CategoryScore {
  const issues: string[] = [];
  const suggestions: string[] = [];

  let score: number;
  if (!hasResults) {
    score = 30;
    suggestions.push('Run simulations to validate your design');
  } else if (resultsPassing) {
    score = 100;
  } else {
    score = 10;
    issues.push('Simulation results indicate failures');
    suggestions.push('Review and fix simulation failures before manufacturing');
  }

  return { category: 'simulation', score, weight: 0.15, issues, suggestions };
}

export function calculateDocumentationScore(
  hasReport: boolean,
  hasComments: boolean,
  unresolvedComments: number,
): CategoryScore {
  const issues: string[] = [];
  const suggestions: string[] = [];

  let score = 40;
  if (hasReport) {
    score += 30;
  } else {
    suggestions.push('Generate a design report for documentation');
  }
  if (hasComments) {
    score += 30;
  } else {
    suggestions.push('Add design review comments');
  }

  score -= unresolvedComments * 10;
  score = clamp(score, 0, 100);

  if (unresolvedComments > 0) {
    issues.push(`${unresolvedComments} unresolved comment${unresolvedComments > 1 ? 's' : ''}`);
    suggestions.push('Resolve open review comments');
  }

  return { category: 'documentation', score, weight: 0.15, issues, suggestions };
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

export function calculateReadiness(input: ReadinessInput): ReadinessResult {
  const categories: CategoryScore[] = [
    calculateDrcScore(input.drcViolations),
    calculateBomScore(input.bomItems),
    calculateLifecycleScore(input.lifecycleItems),
    calculateSimulationScore(input.hasSimulationResults, input.simulationPassing),
    calculateDocumentationScore(input.hasDesignReport, input.hasComments, input.unresolvedComments),
  ];

  const overall = Math.round(
    categories.reduce((sum, c) => sum + c.score * c.weight, 0),
  );

  const grade = scoreToGrade(overall);

  const blockers: string[] = [];
  for (const cat of categories) {
    if (cat.score < 30) {
      blockers.push(`${cat.category.toUpperCase()} score critically low (${cat.score}/100)`);
    }
  }

  return { overall, grade, categories, blockers };
}

export function getReadinessColor(score: number): 'emerald' | 'yellow' | 'amber' | 'red' {
  if (score >= 80) {
    return 'emerald';
  }
  if (score >= 60) {
    return 'yellow';
  }
  if (score >= 40) {
    return 'amber';
  }
  return 'red';
}
