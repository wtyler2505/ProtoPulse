/**
 * Cost Optimization Engine
 *
 * Analyzes a BOM against a target budget and produces ranked cost reduction
 * suggestions. Breaks total project cost into component / PCB / assembly
 * buckets, flags over-budget conditions, and proposes actionable optimizations
 * such as substituting cheaper parts, reducing quantities, changing packages,
 * or eliminating non-essential items.
 *
 * Pure-function engine — no singletons or side-effects. React hook provided
 * for convenient consumption.
 *
 * Usage:
 *   const analysis = analyzeBomCost(bomItems, { budget: 150 });
 *   console.log(analysis.suggestions);
 *
 * React hook:
 *   const { analyze, lastAnalysis } = useCostOptimizer();
 */

import { useCallback, useState } from 'react';

import type { BomItem } from '@/lib/project-context';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CostBucket = 'component' | 'pcb' | 'assembly';

export type SuggestionType =
  | 'substitute'
  | 'reduce_qty'
  | 'change_package'
  | 'eliminate';

export type SuggestionPriority = 'high' | 'medium' | 'low';

export interface CostBucketBreakdown {
  bucket: CostBucket;
  label: string;
  amount: number;
  percentage: number;
}

export interface CostSuggestion {
  id: string;
  type: SuggestionType;
  priority: SuggestionPriority;
  targetItemId: string;
  targetPartNumber: string;
  description: string;
  estimatedSavings: number;
  rationale: string;
}

export interface CostOptimizerOptions {
  /** Target budget in the same currency as BOM unit prices. */
  budget: number;
  /**
   * Estimated PCB fabrication cost.
   * Default: $5 for simple 2-layer boards. Users can override.
   */
  pcbCost?: number;
  /**
   * Estimated assembly / labor cost.
   * Default: $0 (DIY / hand-assembly assumed).
   */
  assemblyCost?: number;
}

export interface CostAnalysis {
  /** Sum of all BOM item totalPrice values. */
  componentCost: number;
  /** PCB fabrication cost. */
  pcbCost: number;
  /** Assembly cost. */
  assemblyCost: number;
  /** componentCost + pcbCost + assemblyCost */
  totalCost: number;
  /** User-specified budget. */
  budget: number;
  /** totalCost > budget */
  overBudget: boolean;
  /** totalCost - budget (positive = over, negative = under). */
  delta: number;
  /** Breakdown by bucket. */
  buckets: CostBucketBreakdown[];
  /** Ranked cost reduction suggestions — highest savings first. */
  suggestions: CostSuggestion[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PCB_COST = 5;
const DEFAULT_ASSEMBLY_COST = 0;

/**
 * Thresholds used when classifying items as high-cost outliers.
 * An item whose totalPrice exceeds this fraction of total component cost
 * is flagged for substitution.
 */
const HIGH_COST_OUTLIER_FRACTION = 0.25;

/**
 * Items with quantity above this threshold get a "reduce quantity" suggestion.
 */
const REDUCE_QTY_THRESHOLD = 3;

/**
 * Fraction of unit price expected as savings when switching to a cheaper
 * package (e.g., SOT-23 instead of TO-220).
 */
const PACKAGE_SAVINGS_FRACTION = 0.15;

/**
 * Items with a unit price below this threshold are unlikely to yield
 * meaningful savings.
 */
const LOW_VALUE_THRESHOLD = 0.5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _suggestionCounter = 0;

function nextSuggestionId(): string {
  _suggestionCounter += 1;
  return `sug-${_suggestionCounter}`;
}

/** Reset the counter (useful in tests). */
export function _resetSuggestionCounter(): void {
  _suggestionCounter = 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Heuristic: detect items that are likely mechanical / connectors / enclosures
 * and therefore candidates for elimination in a budget-constrained scenario.
 */
function isNonEssential(description: string, partNumber: string): boolean {
  const d = `${description} ${partNumber}`.toLowerCase();
  return /\b(standoff|spacer|enclosure|label|sticker|led indicator|decorat|bracket|mount(?:ing)? (?:plate|kit))\b/.test(d);
}

/**
 * Heuristic: detect items that are likely available in a cheaper package.
 * E.g., TO-220 → D-PAK, DIP → SOIC, through-hole → SMD.
 */
function hasPackageAlternative(description: string, partNumber: string): boolean {
  const d = `${description} ${partNumber}`.toLowerCase();
  return /\b(to-220|to-92|dip|through[- ]?hole|axial|radial)\b/.test(d);
}

// ---------------------------------------------------------------------------
// Core analysis
// ---------------------------------------------------------------------------

/**
 * Analyze a BOM against a budget and produce ranked cost reduction suggestions.
 *
 * The function is deterministic for the same inputs (except for monotonically
 * increasing suggestion IDs).
 */
export function analyzeBomCost(
  bom: BomItem[],
  options: CostOptimizerOptions,
): CostAnalysis {
  const { budget } = options;
  const pcbCost = options.pcbCost ?? DEFAULT_PCB_COST;
  const assemblyCost = options.assemblyCost ?? DEFAULT_ASSEMBLY_COST;

  const componentCost = round2(
    bom.reduce((sum, item) => sum + Number(item.totalPrice), 0),
  );

  const totalCost = round2(componentCost + pcbCost + assemblyCost);
  const delta = round2(totalCost - budget);
  const overBudget = delta > 0;

  // Buckets
  const buckets: CostBucketBreakdown[] = [
    {
      bucket: 'component',
      label: 'Components',
      amount: componentCost,
      percentage: totalCost > 0 ? round2((componentCost / totalCost) * 100) : 0,
    },
    {
      bucket: 'pcb',
      label: 'PCB Fabrication',
      amount: pcbCost,
      percentage: totalCost > 0 ? round2((pcbCost / totalCost) * 100) : 0,
    },
    {
      bucket: 'assembly',
      label: 'Assembly',
      amount: assemblyCost,
      percentage: totalCost > 0 ? round2((assemblyCost / totalCost) * 100) : 0,
    },
  ];

  // Suggestions
  const suggestions: CostSuggestion[] = [];

  // Sort items by totalPrice descending to prioritise high-cost items
  const sorted = [...bom].sort(
    (a, b) => Number(b.totalPrice) - Number(a.totalPrice),
  );

  for (const item of sorted) {
    const itemTotal = Number(item.totalPrice);
    const unitPrice = Number(item.unitPrice);

    // ── Substitute: high-cost outlier ──
    if (componentCost > 0 && itemTotal / componentCost > HIGH_COST_OUTLIER_FRACTION) {
      const estimatedSavings = round2(itemTotal * 0.3);
      suggestions.push({
        id: nextSuggestionId(),
        type: 'substitute',
        priority: 'high',
        targetItemId: String(item.id),
        targetPartNumber: item.partNumber,
        description: `Substitute ${item.partNumber} with a lower-cost equivalent`,
        estimatedSavings,
        rationale: `This item accounts for ${round2((itemTotal / componentCost) * 100)}% of total component cost ($${itemTotal.toFixed(2)}). A 30% cheaper alternative would save ~$${estimatedSavings.toFixed(2)}.`,
      });
    }

    // ── Reduce quantity ──
    if (item.quantity > REDUCE_QTY_THRESHOLD && unitPrice >= LOW_VALUE_THRESHOLD) {
      const reduceBy = Math.max(1, Math.floor(item.quantity * 0.25));
      const estimatedSavings = round2(reduceBy * unitPrice);
      suggestions.push({
        id: nextSuggestionId(),
        type: 'reduce_qty',
        priority: estimatedSavings > delta && overBudget ? 'high' : 'medium',
        targetItemId: String(item.id),
        targetPartNumber: item.partNumber,
        description: `Reduce quantity of ${item.partNumber} from ${item.quantity} to ${item.quantity - reduceBy}`,
        estimatedSavings,
        rationale: `Reducing by ${reduceBy} units saves ~$${estimatedSavings.toFixed(2)}. Verify that ${item.quantity - reduceBy} units still meet design requirements.`,
      });
    }

    // ── Change package ──
    if (hasPackageAlternative(item.description, item.partNumber) && unitPrice >= LOW_VALUE_THRESHOLD) {
      const estimatedSavings = round2(itemTotal * PACKAGE_SAVINGS_FRACTION);
      suggestions.push({
        id: nextSuggestionId(),
        type: 'change_package',
        priority: 'medium',
        targetItemId: String(item.id),
        targetPartNumber: item.partNumber,
        description: `Switch ${item.partNumber} to a smaller/SMD package`,
        estimatedSavings,
        rationale: `Through-hole / large packages are typically 15% more expensive than SMD equivalents. Estimated savings: ~$${estimatedSavings.toFixed(2)}.`,
      });
    }

    // ── Eliminate non-essential ──
    if (isNonEssential(item.description, item.partNumber)) {
      suggestions.push({
        id: nextSuggestionId(),
        type: 'eliminate',
        priority: itemTotal > 2 ? 'medium' : 'low',
        targetItemId: String(item.id),
        targetPartNumber: item.partNumber,
        description: `Consider removing ${item.partNumber} (non-essential)`,
        estimatedSavings: round2(itemTotal),
        rationale: `This item appears to be cosmetic, structural, or optional. Removing it saves $${itemTotal.toFixed(2)}.`,
      });
    }
  }

  // Sort suggestions by estimatedSavings descending
  suggestions.sort((a, b) => b.estimatedSavings - a.estimatedSavings);

  return {
    componentCost,
    pcbCost,
    assemblyCost,
    totalCost,
    budget,
    overBudget,
    delta,
    buckets,
    suggestions,
  };
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export interface UseCostOptimizerReturn {
  /** Run cost analysis against the given BOM and options. */
  analyze: (bom: BomItem[], options: CostOptimizerOptions) => CostAnalysis;
  /** Last analysis result (null until `analyze` is called). */
  lastAnalysis: CostAnalysis | null;
}

export function useCostOptimizer(): UseCostOptimizerReturn {
  const [lastAnalysis, setLastAnalysis] = useState<CostAnalysis | null>(null);

  const analyze = useCallback(
    (bom: BomItem[], options: CostOptimizerOptions): CostAnalysis => {
      const result = analyzeBomCost(bom, options);
      setLastAnalysis(result);
      return result;
    },
    [],
  );

  return { analyze, lastAnalysis };
}
