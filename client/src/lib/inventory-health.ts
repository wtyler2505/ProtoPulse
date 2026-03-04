/**
 * Inventory Health Score Analyzer
 *
 * Evaluates the health of a component inventory across five weighted
 * factors: stock coverage, location coverage, low-stock ratio, dead
 * stock, and duplicate detection. Produces a 0-100 score, letter grade,
 * and actionable recommendations.
 *
 * Designed for makers managing parts bins — helps identify which
 * components need attention before starting a build.
 *
 * Usage:
 *   const analyzer = new InventoryHealthAnalyzer();
 *   const report = analyzer.analyze(inventory, activeDesignBomIds);
 *   console.log(report.grade, report.overallScore);
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InventoryItem {
  id: string;
  name: string;
  partNumber?: string;
  quantity?: number;
  minimumStock?: number;
  storageLocation?: string;
  category?: string;
  lastUsedInDesign?: string;
}

export interface HealthReport {
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  factors: HealthFactor[];
  issues: HealthIssue[];
  recommendations: HealthRecommendation[];
}

export interface HealthFactor {
  name: string;
  score: number;
  weight: number;
  description: string;
}

export interface HealthIssue {
  severity: 'critical' | 'warning' | 'info';
  message: string;
  affectedItems: string[];
}

export interface HealthRecommendation {
  priority: 'high' | 'medium' | 'low';
  action: string;
  impact: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FACTOR_WEIGHTS = {
  stockCoverage: 0.25,
  locationCoverage: 0.20,
  lowStockRatio: 0.25,
  deadStock: 0.15,
  duplicateDetection: 0.15,
} as const;

const GRADE_THRESHOLDS: Array<{ min: number; grade: HealthReport['grade'] }> = [
  { min: 90, grade: 'A' },
  { min: 80, grade: 'B' },
  { min: 70, grade: 'C' },
  { min: 60, grade: 'D' },
  { min: 0, grade: 'F' },
];

// ---------------------------------------------------------------------------
// InventoryHealthAnalyzer
// ---------------------------------------------------------------------------

export class InventoryHealthAnalyzer {
  /**
   * Analyze inventory health across all five scoring factors.
   *
   * @param inventory - All inventory items to evaluate
   * @param activeDesignBomIds - IDs of items currently used in active designs
   * @returns A complete health report with score, grade, issues, and recommendations
   */
  analyze(inventory: InventoryItem[], activeDesignBomIds?: string[]): HealthReport {
    if (inventory.length === 0) {
      return {
        overallScore: 100,
        grade: 'A',
        factors: this.buildEmptyFactors(),
        issues: [{ severity: 'info', message: 'No inventory items to analyze.', affectedItems: [] }],
        recommendations: [
          {
            priority: 'low',
            action: 'Add components to your inventory to enable health tracking.',
            impact: 'Enables stock monitoring and organization scoring.',
          },
        ],
      };
    }

    const activeIds = new Set(activeDesignBomIds ?? []);

    const stockFactor = this.scoreStockCoverage(inventory);
    const locationFactor = this.scoreLocationCoverage(inventory);
    const lowStockFactor = this.scoreLowStockRatio(inventory);
    const deadStockFactor = this.scoreDeadStock(inventory, activeIds);
    const duplicateFactor = this.scoreDuplicateDetection(inventory);

    const factors: HealthFactor[] = [stockFactor, locationFactor, lowStockFactor, deadStockFactor, duplicateFactor];

    const overallScore = Math.round(
      factors.reduce((sum, f) => sum + f.score * f.weight, 0),
    );

    const grade = this.computeGrade(overallScore);

    const issues = this.collectIssues(inventory, activeIds);
    const recommendations = this.generateRecommendations(factors, inventory, activeIds);

    return { overallScore, grade, factors, issues, recommendations };
  }

  /**
   * Detect items not referenced in any active design.
   */
  detectDeadStock(inventory: InventoryItem[], activeDesignBomIds: string[]): InventoryItem[] {
    const activeIds = new Set(activeDesignBomIds);
    return inventory.filter((item) => !activeIds.has(item.id));
  }

  /**
   * Detect items sharing the same partNumber across different locations.
   * Only considers items that have a non-empty partNumber.
   */
  detectDuplicates(inventory: InventoryItem[]): Array<{ partNumber: string; items: InventoryItem[] }> {
    const byPartNumber = new Map<string, InventoryItem[]>();

    for (let i = 0; i < inventory.length; i++) {
      const item = inventory[i];
      if (item.partNumber == null || item.partNumber === '') {
        continue;
      }
      const existing = byPartNumber.get(item.partNumber);
      if (existing) {
        existing.push(item);
      } else {
        byPartNumber.set(item.partNumber, [item]);
      }
    }

    const duplicates: Array<{ partNumber: string; items: InventoryItem[] }> = [];
    Array.from(byPartNumber.entries()).forEach(([partNumber, items]) => {
      if (items.length > 1) {
        duplicates.push({ partNumber, items });
      }
    });

    return duplicates;
  }

  // -------------------------------------------------------------------------
  // Scoring factors
  // -------------------------------------------------------------------------

  private scoreStockCoverage(inventory: InventoryItem[]): HealthFactor {
    const tracked = inventory.filter((item) => item.quantity != null).length;
    const ratio = tracked / inventory.length;
    const score = Math.round(ratio * 100);

    return {
      name: 'Stock Coverage',
      score,
      weight: FACTOR_WEIGHTS.stockCoverage,
      description: `${tracked}/${inventory.length} items have quantity tracked.`,
    };
  }

  private scoreLocationCoverage(inventory: InventoryItem[]): HealthFactor {
    const assigned = inventory.filter(
      (item) => item.storageLocation != null && item.storageLocation !== '',
    ).length;
    const ratio = assigned / inventory.length;
    const score = Math.round(ratio * 100);

    return {
      name: 'Location Coverage',
      score,
      weight: FACTOR_WEIGHTS.locationCoverage,
      description: `${assigned}/${inventory.length} items have a storage location assigned.`,
    };
  }

  private scoreLowStockRatio(inventory: InventoryItem[]): HealthFactor {
    // Only consider items that have both quantity and minimumStock defined
    const trackable = inventory.filter(
      (item) => item.quantity != null && item.minimumStock != null,
    );

    if (trackable.length === 0) {
      // Can't evaluate — give neutral score since there's nothing to penalize
      return {
        name: 'Low Stock Ratio',
        score: 75,
        weight: FACTOR_WEIGHTS.lowStockRatio,
        description: 'No items have minimum stock thresholds configured.',
      };
    }

    const lowStock = trackable.filter(
      (item) => (item.quantity ?? 0) < (item.minimumStock ?? 0),
    );
    const ratio = lowStock.length / trackable.length;
    // Invert: fewer low-stock items = higher score
    const score = Math.round((1 - ratio) * 100);

    return {
      name: 'Low Stock Ratio',
      score,
      weight: FACTOR_WEIGHTS.lowStockRatio,
      description: `${lowStock.length}/${trackable.length} tracked items are below minimum stock.`,
    };
  }

  private scoreDeadStock(inventory: InventoryItem[], activeIds: Set<string>): HealthFactor {
    if (activeIds.size === 0) {
      // No active designs to compare against — neutral score
      return {
        name: 'Dead Stock',
        score: 75,
        weight: FACTOR_WEIGHTS.deadStock,
        description: 'No active designs to compare inventory against.',
      };
    }

    const dead = inventory.filter((item) => !activeIds.has(item.id));
    const ratio = dead.length / inventory.length;
    // Fewer dead items = higher score
    const score = Math.round((1 - ratio) * 100);

    return {
      name: 'Dead Stock',
      score,
      weight: FACTOR_WEIGHTS.deadStock,
      description: `${dead.length}/${inventory.length} items are not used in any active design.`,
    };
  }

  private scoreDuplicateDetection(inventory: InventoryItem[]): HealthFactor {
    const duplicates = this.detectDuplicates(inventory);

    if (duplicates.length === 0) {
      return {
        name: 'Duplicate Detection',
        score: 100,
        weight: FACTOR_WEIGHTS.duplicateDetection,
        description: 'No duplicate part numbers detected.',
      };
    }

    const totalDuplicatedItems = duplicates.reduce((sum, d) => sum + d.items.length, 0);
    const ratio = totalDuplicatedItems / inventory.length;
    // Clamp penalty: more duplicates = lower score, but floor at 0
    const score = Math.max(0, Math.round((1 - ratio) * 100));

    return {
      name: 'Duplicate Detection',
      score,
      weight: FACTOR_WEIGHTS.duplicateDetection,
      description: `${duplicates.length} part number(s) appear in multiple locations (${totalDuplicatedItems} items total).`,
    };
  }

  // -------------------------------------------------------------------------
  // Grade computation
  // -------------------------------------------------------------------------

  private computeGrade(score: number): HealthReport['grade'] {
    for (let i = 0; i < GRADE_THRESHOLDS.length; i++) {
      if (score >= GRADE_THRESHOLDS[i].min) {
        return GRADE_THRESHOLDS[i].grade;
      }
    }
    return 'F';
  }

  // -------------------------------------------------------------------------
  // Issue collection
  // -------------------------------------------------------------------------

  private collectIssues(inventory: InventoryItem[], activeIds: Set<string>): HealthIssue[] {
    const issues: HealthIssue[] = [];

    // Critical: out-of-stock items (quantity is 0 or below minimum)
    const outOfStock = inventory.filter(
      (item) => item.quantity != null && item.minimumStock != null && item.quantity === 0,
    );
    if (outOfStock.length > 0) {
      issues.push({
        severity: 'critical',
        message: `${outOfStock.length} item(s) are completely out of stock.`,
        affectedItems: outOfStock.map((i) => i.id),
      });
    }

    // Critical: items below minimum stock
    const belowMinimum = inventory.filter(
      (item) =>
        item.quantity != null &&
        item.minimumStock != null &&
        item.quantity > 0 &&
        item.quantity < item.minimumStock,
    );
    if (belowMinimum.length > 0) {
      issues.push({
        severity: 'critical',
        message: `${belowMinimum.length} item(s) are below minimum stock level.`,
        affectedItems: belowMinimum.map((i) => i.id),
      });
    }

    // Warning: no storage location assigned
    const noLocation = inventory.filter(
      (item) => item.storageLocation == null || item.storageLocation === '',
    );
    if (noLocation.length > 0) {
      issues.push({
        severity: 'warning',
        message: `${noLocation.length} item(s) have no storage location assigned.`,
        affectedItems: noLocation.map((i) => i.id),
      });
    }

    // Warning: untracked quantity
    const noQuantity = inventory.filter((item) => item.quantity == null);
    if (noQuantity.length > 0) {
      issues.push({
        severity: 'warning',
        message: `${noQuantity.length} item(s) have no quantity tracked.`,
        affectedItems: noQuantity.map((i) => i.id),
      });
    }

    // Info: dead stock
    if (activeIds.size > 0) {
      const deadStock = inventory.filter((item) => !activeIds.has(item.id));
      if (deadStock.length > 0) {
        issues.push({
          severity: 'info',
          message: `${deadStock.length} item(s) are not used in any active design.`,
          affectedItems: deadStock.map((i) => i.id),
        });
      }
    }

    // Info: duplicates
    const duplicates = this.detectDuplicates(inventory);
    if (duplicates.length > 0) {
      const allDupIds = duplicates.flatMap((d) => d.items.map((i) => i.id));
      issues.push({
        severity: 'info',
        message: `${duplicates.length} part number(s) appear in multiple inventory entries.`,
        affectedItems: allDupIds,
      });
    }

    return issues;
  }

  // -------------------------------------------------------------------------
  // Recommendation generation
  // -------------------------------------------------------------------------

  private generateRecommendations(
    factors: HealthFactor[],
    inventory: InventoryItem[],
    activeIds: Set<string>,
  ): HealthRecommendation[] {
    const recommendations: HealthRecommendation[] = [];

    const stockFactor = factors.find((f) => f.name === 'Stock Coverage');
    const locationFactor = factors.find((f) => f.name === 'Location Coverage');
    const lowStockFactor = factors.find((f) => f.name === 'Low Stock Ratio');
    const deadStockFactor = factors.find((f) => f.name === 'Dead Stock');
    const dupFactor = factors.find((f) => f.name === 'Duplicate Detection');

    // High priority: restock critically low items
    if (lowStockFactor && lowStockFactor.score < 80) {
      const lowItems = inventory.filter(
        (item) =>
          item.quantity != null && item.minimumStock != null && item.quantity < item.minimumStock,
      );
      recommendations.push({
        priority: 'high',
        action: `Restock ${lowItems.length} item(s) that are below minimum stock levels.`,
        impact: 'Prevents build delays from missing components.',
      });
    }

    // High priority: track quantities
    if (stockFactor && stockFactor.score < 70) {
      const untracked = inventory.filter((i) => i.quantity == null).length;
      recommendations.push({
        priority: 'high',
        action: `Add quantity tracking for ${untracked} untracked item(s).`,
        impact: 'Enables low-stock alerts and build readiness checks.',
      });
    }

    // Medium priority: assign locations
    if (locationFactor && locationFactor.score < 70) {
      const noLoc = inventory.filter(
        (i) => i.storageLocation == null || i.storageLocation === '',
      ).length;
      recommendations.push({
        priority: 'medium',
        action: `Assign storage locations to ${noLoc} item(s).`,
        impact: 'Reduces time spent searching for components during builds.',
      });
    }

    // Medium priority: consolidate duplicates
    if (dupFactor && dupFactor.score < 100) {
      const duplicates = this.detectDuplicates(inventory);
      recommendations.push({
        priority: 'medium',
        action: `Consolidate ${duplicates.length} duplicated part number(s) into single inventory entries.`,
        impact: 'Prevents over-ordering and simplifies stock management.',
      });
    }

    // Low priority: review dead stock
    if (deadStockFactor && deadStockFactor.score < 70 && activeIds.size > 0) {
      const dead = inventory.filter((item) => !activeIds.has(item.id));
      recommendations.push({
        priority: 'low',
        action: `Review ${dead.length} dead stock item(s) not used in any active design.`,
        impact: 'Frees up storage space and capital tied up in unused parts.',
      });
    }

    // Low priority: set minimum stock thresholds
    const noMinStock = inventory.filter(
      (item) => item.quantity != null && item.minimumStock == null,
    );
    if (noMinStock.length > 0) {
      recommendations.push({
        priority: 'low',
        action: `Set minimum stock thresholds for ${noMinStock.length} item(s) with tracked quantity.`,
        impact: 'Enables automatic low-stock detection and reorder alerts.',
      });
    }

    return recommendations;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private buildEmptyFactors(): HealthFactor[] {
    return [
      { name: 'Stock Coverage', score: 100, weight: FACTOR_WEIGHTS.stockCoverage, description: 'No items to evaluate.' },
      { name: 'Location Coverage', score: 100, weight: FACTOR_WEIGHTS.locationCoverage, description: 'No items to evaluate.' },
      { name: 'Low Stock Ratio', score: 100, weight: FACTOR_WEIGHTS.lowStockRatio, description: 'No items to evaluate.' },
      { name: 'Dead Stock', score: 100, weight: FACTOR_WEIGHTS.deadStock, description: 'No items to evaluate.' },
      { name: 'Duplicate Detection', score: 100, weight: FACTOR_WEIGHTS.duplicateDetection, description: 'No items to evaluate.' },
    ];
  }
}
