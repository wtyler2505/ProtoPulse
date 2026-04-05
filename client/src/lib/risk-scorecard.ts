/**
 * Risk Scorecard — Release Readiness Assessment (BL-0254)
 *
 * Evaluates design readiness across 5 weighted categories:
 *   - DRC (Design Rule Check) — validation issue health
 *   - BOM (Bill of Materials) — completeness, pricing, stock
 *   - Manufacturing — assembly and production readiness
 *   - Documentation — description/metadata coverage
 *   - Testing — validation coverage and issue resolution
 *
 * Produces a 0–100 weighted average score, traffic-light readiness
 * indicator, and per-category drill-down with actionable items.
 *
 * Pure function library — no React dependencies, no side effects.
 */

import type { LifecycleStatus } from './lifecycle-badges';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReadinessLevel = 'green' | 'yellow' | 'red';

export type ScorecardCategoryId =
  | 'drc'
  | 'bom'
  | 'manufacturing'
  | 'documentation'
  | 'testing';

export interface ScorecardItem {
  id: string;
  label: string;
  passed: boolean;
  severity: 'critical' | 'major' | 'minor';
  detail: string;
}

export interface ScorecardCategory {
  id: ScorecardCategoryId;
  label: string;
  weight: number;
  score: number;
  items: ScorecardItem[];
}

export type ConfidenceBand = 'exploratory' | 'guided' | 'review' | 'production';

export type EvidenceStrength = 'thin' | 'partial' | 'strong';

export interface ConfidenceSnapshot {
  band: ConfidenceBand;
  label: string;
  evidenceStrength: EvidenceStrength;
  evidenceLabel: string;
  summary: string;
  blockers: string[];
  nextActions: string[];
  sourceNote: string;
}

export interface ScorecardResult {
  overallScore: number;
  readiness: ReadinessLevel;
  categories: ScorecardCategory[];
  timestamp: number;
  confidence: ConfidenceSnapshot;
}

// ---------------------------------------------------------------------------
// Input types — minimal representations consumed by the scorer
// ---------------------------------------------------------------------------

export interface ScorecardValidationIssue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  componentId?: string;
}

export interface ScorecardBomItem {
  partNumber: string;
  manufacturer: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  stock: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock' | 'On Order';
  esdSensitive?: boolean | null;
  assemblyCategory?: 'smt' | 'through_hole' | 'hand_solder' | 'mechanical' | null;
  lifecycleStatus?: LifecycleStatus | null;
}

export interface ScorecardNode {
  id: string;
  label: string;
  type: string;
  description?: string;
}

export interface ScorecardEdge {
  id: string;
  source: string;
  target: string;
}

export interface ScorecardInput {
  validationIssues: ScorecardValidationIssue[];
  bomItems: ScorecardBomItem[];
  nodes: ScorecardNode[];
  edges: ScorecardEdge[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CATEGORY_WEIGHTS: Record<ScorecardCategoryId, number> = {
  drc: 0.30,
  bom: 0.25,
  manufacturing: 0.20,
  documentation: 0.10,
  testing: 0.15,
};

const READINESS_THRESHOLDS = {
  green: 80,
  yellow: 50,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function itemsToScore(items: ScorecardItem[]): number {
  if (items.length === 0) { return 100; }

  const SEVERITY_WEIGHT: Record<ScorecardItem['severity'], number> = {
    critical: 3,
    major: 2,
    minor: 1,
  };

  let totalWeight = 0;
  let passedWeight = 0;
  for (const item of items) {
    const w = SEVERITY_WEIGHT[item.severity];
    totalWeight += w;
    if (item.passed) { passedWeight += w; }
  }

  return totalWeight === 0 ? 100 : Math.round((passedWeight / totalWeight) * 100);
}

function getReadiness(score: number): ReadinessLevel {
  if (score >= READINESS_THRESHOLDS.green) { return 'green'; }
  if (score >= READINESS_THRESHOLDS.yellow) { return 'yellow'; }
  return 'red';
}

function unique<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values));
}

function failedItems(categories: ScorecardCategory[], severity?: ScorecardItem['severity']): ScorecardItem[] {
  return categories.flatMap((category) =>
    category.items.filter((item) => !item.passed && (severity === undefined || item.severity === severity)),
  );
}

function actionForItem(item: ScorecardItem): string {
  switch (item.id) {
    case 'drc-no-errors':
      return 'Resolve all DRC errors before treating the design as order-ready.';
    case 'drc-no-warnings':
      return 'Review and either fix or consciously accept the remaining warnings.';
    case 'bom-non-empty':
      return 'Populate the BOM so procurement, costing, and ordering checks have something real to evaluate.';
    case 'bom-part-numbers':
      return 'Add exact manufacturer part numbers for every BOM item.';
    case 'bom-pricing':
      return 'Fill in unit pricing so cost and sourcing risk are grounded in real data.';
    case 'bom-stock':
      return 'Replace or resource out-of-stock parts before spending money on fabrication.';
    case 'mfg-assembly-categories':
      return 'Assign assembly categories so manufacturing prep stops guessing what is hand-soldered vs assembly-safe.';
    case 'mfg-lifecycle-critical':
      return 'Replace EOL or obsolete components before committing to procurement or manufacturing.';
    case 'mfg-lifecycle-caution':
      return 'Review NRND or preliminary parts and decide whether they are acceptable for this build.';
    case 'mfg-low-stock':
      return 'Address low-stock items now so they do not become last-minute blockers.';
    case 'doc-architecture':
      return 'Document the architecture so reviewers and future-you can understand what is being built.';
    case 'doc-connections':
      return 'Add or verify component connections so the design is reviewable, not just listed.';
    case 'test-validation-run':
      return 'Run validation and capture results before treating the project as release-ready.';
    case 'test-error-resolution':
      return 'Clear all unresolved validation errors before fabrication or ordering.';
    case 'test-component-coverage':
      return 'Bring the BOM and architecture into closer alignment so procurement reflects the actual design.';
    default:
      return item.detail;
  }
}

function summarizeConfidence(
  overallScore: number,
  band: ConfidenceBand,
  blockers: string[],
  evidenceStrength: EvidenceStrength,
): string {
  switch (band) {
    case 'production':
      return evidenceStrength === 'strong'
        ? 'Procurement and manufacturing signals are strong. You are close to order-ready, but still confirm final export outputs and fab-specific checks before spending money.'
        : 'Core release signals look strong, but a few evidence gaps still deserve a final review before you commit to fabrication.';
    case 'review':
      return blockers.length === 0
        ? 'Most visible release signals look healthy. Run a focused review pass before you treat the design as ready to buy or build.'
        : 'This design is approaching review-ready, but a few important gaps still need attention before procurement or manufacturing.';
    case 'guided':
      return overallScore >= 60
        ? 'The project has enough structure for guided iteration, but it still needs real review before you spend money or lock decisions.'
        : 'Useful progress is visible, but the current evidence is still too thin to trust this as an order-ready design.';
    case 'exploratory':
      return 'Treat this as an exploratory snapshot, not a release decision. The currently loaded signals are too incomplete or risky for confident procurement.';
  }
}

function getConfidenceBand(overallScore: number, criticalFailures: number, majorFailures: number): ConfidenceBand {
  if (criticalFailures > 0 && overallScore < 75) {
    return 'exploratory';
  }
  if (overallScore >= 90 && criticalFailures === 0 && majorFailures === 0) {
    return 'production';
  }
  if (overallScore >= 75 && criticalFailures === 0 && majorFailures <= 1) {
    return 'review';
  }
  if (overallScore >= 50) {
    return 'guided';
  }
  return 'exploratory';
}

function getEvidenceStrength(categories: ScorecardCategory[]): EvidenceStrength {
  const evidenceCategories = categories.filter((category) =>
    category.id === 'drc' || category.id === 'documentation' || category.id === 'testing',
  );
  const evidenceScore = Math.round(
    evidenceCategories.reduce((sum, category) => sum + category.score, 0) / evidenceCategories.length,
  );

  if (evidenceScore >= 80) {
    return 'strong';
  }
  if (evidenceScore >= 55) {
    return 'partial';
  }
  return 'thin';
}

function evidenceLabel(strength: EvidenceStrength): string {
  switch (strength) {
    case 'strong':
      return 'Evidence strong';
    case 'partial':
      return 'Evidence partial';
    case 'thin':
      return 'Evidence thin';
  }
}

function confidenceLabel(band: ConfidenceBand): string {
  switch (band) {
    case 'production':
      return 'Production-ready';
    case 'review':
      return 'Review-ready';
    case 'guided':
      return 'Guided build candidate';
    case 'exploratory':
      return 'Exploratory only';
  }
}

function buildConfidenceSnapshot(categories: ScorecardCategory[], overallScore: number): ConfidenceSnapshot {
  const criticalFailures = failedItems(categories, 'critical');
  const majorFailures = failedItems(categories, 'major');
  const majorOrCritical = [...criticalFailures, ...majorFailures];
  const band = getConfidenceBand(overallScore, criticalFailures.length, majorFailures.length);
  const strength = getEvidenceStrength(categories);
  const blockers = unique(
    majorOrCritical.slice(0, 4).map((item) => `${item.label}: ${item.detail}`),
  );
  const nextActions = unique(
    majorOrCritical.concat(failedItems(categories, 'minor'))
      .slice(0, 4)
      .map(actionForItem),
  );
  const normalizedNextActions = nextActions.length > 0
    ? nextActions
    : ['Run final export and fab-specific preflight checks before spending money on manufacturing.'];

  return {
    band,
    label: confidenceLabel(band),
    evidenceStrength: strength,
    evidenceLabel: evidenceLabel(strength),
    summary: summarizeConfidence(overallScore, band, blockers, strength),
    blockers,
    nextActions: normalizedNextActions,
    sourceNote: 'Based on BOM, validation, architecture, and manufacturing signals visible in this workspace. Final fabrication/export trust still needs separate confirmation.',
  };
}

// ---------------------------------------------------------------------------
// Category scorers
// ---------------------------------------------------------------------------

function scoreDrc(issues: ScorecardValidationIssue[]): ScorecardCategory {
  const items: ScorecardItem[] = [];

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const infos = issues.filter((i) => i.severity === 'info');

  items.push({
    id: 'drc-no-errors',
    label: 'No DRC errors',
    passed: errors.length === 0,
    severity: 'critical',
    detail: errors.length === 0
      ? 'No DRC errors found.'
      : `${String(errors.length)} DRC error${errors.length === 1 ? '' : 's'} found.`,
  });

  items.push({
    id: 'drc-no-warnings',
    label: 'No DRC warnings',
    passed: warnings.length === 0,
    severity: 'major',
    detail: warnings.length === 0
      ? 'No DRC warnings found.'
      : `${String(warnings.length)} DRC warning${warnings.length === 1 ? '' : 's'} found.`,
  });

  items.push({
    id: 'drc-info-review',
    label: 'Info issues reviewed',
    passed: infos.length <= 3,
    severity: 'minor',
    detail: infos.length <= 3
      ? `${String(infos.length)} info-level note${infos.length === 1 ? '' : 's'} — acceptable.`
      : `${String(infos.length)} info notes — consider reviewing.`,
  });

  return {
    id: 'drc',
    label: 'Design Rule Check',
    weight: CATEGORY_WEIGHTS.drc,
    score: itemsToScore(items),
    items,
  };
}

function scoreBom(bomItems: ScorecardBomItem[]): ScorecardCategory {
  const items: ScorecardItem[] = [];

  // 1. BOM is non-empty
  items.push({
    id: 'bom-non-empty',
    label: 'BOM has items',
    passed: bomItems.length > 0,
    severity: 'critical',
    detail: bomItems.length > 0
      ? `${String(bomItems.length)} BOM item${bomItems.length === 1 ? '' : 's'}.`
      : 'BOM is empty — add components.',
  });

  // 2. All items have part numbers
  const missingPn = bomItems.filter((b) => !b.partNumber.trim());
  items.push({
    id: 'bom-part-numbers',
    label: 'All items have part numbers',
    passed: missingPn.length === 0,
    severity: 'major',
    detail: missingPn.length === 0
      ? 'All items have part numbers.'
      : `${String(missingPn.length)} item${missingPn.length === 1 ? '' : 's'} missing part number.`,
  });

  // 3. All items have manufacturers
  const unknownMfg = bomItems.filter((b) => !b.manufacturer.trim() || b.manufacturer === 'Unknown');
  items.push({
    id: 'bom-manufacturers',
    label: 'All items have manufacturers',
    passed: unknownMfg.length === 0,
    severity: 'minor',
    detail: unknownMfg.length === 0
      ? 'All items have manufacturer info.'
      : `${String(unknownMfg.length)} item${unknownMfg.length === 1 ? '' : 's'} missing manufacturer.`,
  });

  // 4. All items have pricing
  const noPricing = bomItems.filter((b) => b.unitPrice <= 0);
  items.push({
    id: 'bom-pricing',
    label: 'All items have pricing',
    passed: noPricing.length === 0,
    severity: 'major',
    detail: noPricing.length === 0
      ? 'All items have pricing info.'
      : `${String(noPricing.length)} item${noPricing.length === 1 ? '' : 's'} missing pricing.`,
  });

  // 5. All items in stock
  const outOfStock = bomItems.filter((b) => b.status === 'Out of Stock');
  items.push({
    id: 'bom-stock',
    label: 'All items in stock',
    passed: outOfStock.length === 0,
    severity: 'critical',
    detail: outOfStock.length === 0
      ? 'All items available.'
      : `${String(outOfStock.length)} item${outOfStock.length === 1 ? '' : 's'} out of stock.`,
  });

  return {
    id: 'bom',
    label: 'Bill of Materials',
    weight: CATEGORY_WEIGHTS.bom,
    score: itemsToScore(items),
    items,
  };
}

function scoreManufacturing(bomItems: ScorecardBomItem[]): ScorecardCategory {
  const items: ScorecardItem[] = [];

  // 1. Assembly categories assigned
  const uncategorized = bomItems.filter((b) => !b.assemblyCategory);
  items.push({
    id: 'mfg-assembly-categories',
    label: 'Assembly categories assigned',
    passed: bomItems.length === 0 || uncategorized.length === 0,
    severity: 'major',
    detail: bomItems.length === 0
      ? 'No BOM items to categorize.'
      : uncategorized.length === 0
        ? 'All items have assembly categories.'
        : `${String(uncategorized.length)} item${uncategorized.length === 1 ? '' : 's'} missing assembly category.`,
  });

  // 2. ESD-sensitive parts flagged
  const esdItems = bomItems.filter((b) => b.esdSensitive === true);
  items.push({
    id: 'mfg-esd-flagged',
    label: 'ESD-sensitive parts identified',
    passed: true,
    severity: 'minor',
    detail: esdItems.length > 0
      ? `${String(esdItems.length)} ESD-sensitive item${esdItems.length === 1 ? '' : 's'} flagged — handling precautions needed.`
      : 'No ESD-sensitive items flagged.',
  });

  // 3. No hand-solder-only concerns
  const handSolderItems = bomItems.filter((b) => b.assemblyCategory === 'hand_solder');
  items.push({
    id: 'mfg-hand-solder',
    label: 'No hand-solder-only components',
    passed: handSolderItems.length === 0,
    severity: 'minor',
    detail: handSolderItems.length === 0
      ? 'No hand-solder-only components.'
      : `${String(handSolderItems.length)} item${handSolderItems.length === 1 ? '' : 's'} require${handSolderItems.length === 1 ? 's' : ''} hand soldering.`,
  });

  // 4. Low-stock items manageable
  const lowStock = bomItems.filter((b) => b.status === 'Low Stock');
  items.push({
    id: 'mfg-low-stock',
    label: 'No low-stock supply risk',
    passed: lowStock.length === 0,
    severity: 'major',
    detail: lowStock.length === 0
      ? 'No items with low stock.'
      : `${String(lowStock.length)} item${lowStock.length === 1 ? '' : 's'} on low stock — order soon.`,
  });

  const lifecycleCritical = bomItems.filter(
    (b) => b.lifecycleStatus === 'eol' || b.lifecycleStatus === 'obsolete',
  );
  items.push({
    id: 'mfg-lifecycle-critical',
    label: 'No EOL or obsolete parts',
    passed: lifecycleCritical.length === 0,
    severity: 'critical',
    detail: lifecycleCritical.length === 0
      ? 'No EOL or obsolete lifecycle risks detected.'
      : `${String(lifecycleCritical.length)} part${lifecycleCritical.length === 1 ? '' : 's'} flagged as EOL or obsolete.`,
  });

  const lifecycleCaution = bomItems.filter(
    (b) => b.lifecycleStatus === 'nrnd' || b.lifecycleStatus === 'preliminary',
  );
  items.push({
    id: 'mfg-lifecycle-caution',
    label: 'No NRND or preliminary parts',
    passed: lifecycleCaution.length === 0,
    severity: 'major',
    detail: lifecycleCaution.length === 0
      ? 'No NRND or preliminary lifecycle cautions detected.'
      : `${String(lifecycleCaution.length)} part${lifecycleCaution.length === 1 ? '' : 's'} flagged as NRND or preliminary.`,
  });

  return {
    id: 'manufacturing',
    label: 'Manufacturing',
    weight: CATEGORY_WEIGHTS.manufacturing,
    score: itemsToScore(items),
    items,
  };
}

function scoreDocumentation(
  nodes: ScorecardNode[],
  edges: ScorecardEdge[],
  bomItems: ScorecardBomItem[],
): ScorecardCategory {
  const items: ScorecardItem[] = [];

  // 1. Architecture nodes exist
  items.push({
    id: 'doc-architecture',
    label: 'Architecture diagram defined',
    passed: nodes.length > 0,
    severity: 'critical',
    detail: nodes.length > 0
      ? `${String(nodes.length)} node${nodes.length === 1 ? '' : 's'} in architecture.`
      : 'No architecture nodes defined.',
  });

  // 2. Connections defined
  items.push({
    id: 'doc-connections',
    label: 'Connections defined',
    passed: edges.length > 0,
    severity: 'major',
    detail: edges.length > 0
      ? `${String(edges.length)} connection${edges.length === 1 ? '' : 's'} defined.`
      : 'No connections defined between components.',
  });

  // 3. Node labels present
  const unlabeled = nodes.filter((n) => !n.label.trim());
  items.push({
    id: 'doc-labels',
    label: 'All nodes labeled',
    passed: nodes.length === 0 || unlabeled.length === 0,
    severity: 'minor',
    detail: nodes.length === 0
      ? 'No nodes to check.'
      : unlabeled.length === 0
        ? 'All nodes have labels.'
        : `${String(unlabeled.length)} node${unlabeled.length === 1 ? '' : 's'} missing label.`,
  });

  // 4. Node descriptions present
  const noDesc = nodes.filter((n) => !n.description || !n.description.trim());
  items.push({
    id: 'doc-descriptions',
    label: 'Node descriptions provided',
    passed: nodes.length === 0 || noDesc.length <= Math.floor(nodes.length * 0.5),
    severity: 'minor',
    detail: nodes.length === 0
      ? 'No nodes to check.'
      : noDesc.length === 0
        ? 'All nodes have descriptions.'
        : `${String(noDesc.length)} of ${String(nodes.length)} node${nodes.length === 1 ? '' : 's'} missing description.`,
  });

  // 5. BOM descriptions present
  const bomNoDesc = bomItems.filter((b) => !b.description.trim());
  items.push({
    id: 'doc-bom-descriptions',
    label: 'BOM item descriptions',
    passed: bomItems.length === 0 || bomNoDesc.length === 0,
    severity: 'minor',
    detail: bomItems.length === 0
      ? 'No BOM items to check.'
      : bomNoDesc.length === 0
        ? 'All BOM items have descriptions.'
        : `${String(bomNoDesc.length)} BOM item${bomNoDesc.length === 1 ? '' : 's'} missing description.`,
  });

  return {
    id: 'documentation',
    label: 'Documentation',
    weight: CATEGORY_WEIGHTS.documentation,
    score: itemsToScore(items),
    items,
  };
}

function scoreTesting(
  issues: ScorecardValidationIssue[],
  nodes: ScorecardNode[],
  bomItems: ScorecardBomItem[],
): ScorecardCategory {
  const items: ScorecardItem[] = [];

  // 1. Validation has been run (issues exist = validation was performed)
  items.push({
    id: 'test-validation-run',
    label: 'Validation performed',
    passed: issues.length > 0 || (nodes.length === 0 && bomItems.length === 0),
    severity: 'critical',
    detail: issues.length > 0
      ? 'Validation has been run.'
      : nodes.length === 0 && bomItems.length === 0
        ? 'Empty design — no validation needed.'
        : 'No validation results — run DRC/ERC first.',
  });

  // 2. Error resolution rate
  const errors = issues.filter((i) => i.severity === 'error');
  items.push({
    id: 'test-error-resolution',
    label: 'DRC errors resolved',
    passed: errors.length === 0,
    severity: 'critical',
    detail: errors.length === 0
      ? 'All critical errors resolved.'
      : `${String(errors.length)} unresolved error${errors.length === 1 ? '' : 's'}.`,
  });

  // 3. Component coverage — all arch nodes should relate to BOM
  const archNodeCount = nodes.length;
  const bomCount = bomItems.length;
  const hasCoverage = archNodeCount === 0 || bomCount >= Math.ceil(archNodeCount * 0.5);
  items.push({
    id: 'test-component-coverage',
    label: 'BOM covers architecture',
    passed: hasCoverage,
    severity: 'major',
    detail: archNodeCount === 0
      ? 'No architecture nodes to cover.'
      : hasCoverage
        ? `${String(bomCount)} BOM item${bomCount === 1 ? '' : 's'} for ${String(archNodeCount)} node${archNodeCount === 1 ? '' : 's'} — adequate coverage.`
        : `Only ${String(bomCount)} BOM item${bomCount === 1 ? '' : 's'} for ${String(archNodeCount)} node${archNodeCount === 1 ? '' : 's'} — low coverage.`,
  });

  // 4. Warning ratio acceptable
  const warnings = issues.filter((i) => i.severity === 'warning');
  const warningThreshold = Math.max(3, Math.ceil(nodes.length * 0.3));
  items.push({
    id: 'test-warning-ratio',
    label: 'Warnings within threshold',
    passed: warnings.length <= warningThreshold,
    severity: 'major',
    detail: warnings.length <= warningThreshold
      ? `${String(warnings.length)} warning${warnings.length === 1 ? '' : 's'} — within threshold (${String(warningThreshold)}).`
      : `${String(warnings.length)} warning${warnings.length === 1 ? '' : 's'} exceeds threshold (${String(warningThreshold)}).`,
  });

  return {
    id: 'testing',
    label: 'Testing',
    weight: CATEGORY_WEIGHTS.testing,
    score: itemsToScore(items),
    items,
  };
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Calculate the complete risk scorecard for release readiness.
 *
 * @param input - Aggregated design state
 * @returns Scored result with overall score, readiness level, and per-category breakdown.
 */
export function calculateScorecard(input: ScorecardInput): ScorecardResult {
  const categories: ScorecardCategory[] = [
    scoreDrc(input.validationIssues),
    scoreBom(input.bomItems),
    scoreManufacturing(input.bomItems),
    scoreDocumentation(input.nodes, input.edges, input.bomItems),
    scoreTesting(input.validationIssues, input.nodes, input.bomItems),
  ];

  const overallScore = Math.round(
    categories.reduce((acc, cat) => acc + cat.score * cat.weight, 0),
  );
  const clampedOverallScore = clamp(overallScore, 0, 100);

  return {
    overallScore: clampedOverallScore,
    readiness: getReadiness(clampedOverallScore),
    categories,
    timestamp: Date.now(),
    confidence: buildConfidenceSnapshot(categories, clampedOverallScore),
  };
}

/**
 * Get the CSS-friendly color for a readiness level.
 */
export function readinessColor(level: ReadinessLevel): string {
  switch (level) {
    case 'green': return '#22c55e';
    case 'yellow': return '#eab308';
    case 'red': return '#ef4444';
  }
}

/**
 * Get a human-readable label for a readiness level.
 */
export function readinessLabel(level: ReadinessLevel): string {
  switch (level) {
    case 'green': return 'Ready for Release';
    case 'yellow': return 'Needs Attention';
    case 'red': return 'Not Ready';
  }
}

export function confidenceBandColor(band: ConfidenceBand): string {
  switch (band) {
    case 'production': return '#22c55e';
    case 'review': return '#38bdf8';
    case 'guided': return '#eab308';
    case 'exploratory': return '#f97316';
  }
}

/**
 * Get severity badge styling classes.
 */
export function severityClasses(severity: ScorecardItem['severity']): string {
  switch (severity) {
    case 'critical': return 'bg-red-500/10 text-red-400 border-red-500/20';
    case 'major': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    case 'minor': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  }
}
