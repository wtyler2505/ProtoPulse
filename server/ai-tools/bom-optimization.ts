/**
 * BOM Optimization tools — cost analysis, alternate part suggestions, package consolidation.
 *
 * Provides AI tools for analyzing the Bill of Materials to find optimization
 * opportunities: cheaper alternates, package consolidation, over-spec'd
 * components, and reducing unique part count. All tools execute server-side
 * by fetching BOM data via `ctx.storage` and returning structured analysis.
 *
 * @module ai-tools/bom-optimization
 */

import { z } from 'zod';
import type { ToolRegistry } from './registry';
import type { ToolResult } from './types';

// ---------------------------------------------------------------------------
// Built-in component knowledge for alternate suggestions
// ---------------------------------------------------------------------------

/** Standard resistor package sizes with typical specs. */
const RESISTOR_PACKAGES: Record<string, { powerRating: string; size: string; costTier: number }> = {
  '0201': { powerRating: '0.05W', size: '0.6mm x 0.3mm', costTier: 3 },
  '0402': { powerRating: '0.0625W', size: '1.0mm x 0.5mm', costTier: 2 },
  '0603': { powerRating: '0.1W', size: '1.6mm x 0.8mm', costTier: 1 },
  '0805': { powerRating: '0.125W', size: '2.0mm x 1.25mm', costTier: 1 },
  '1206': { powerRating: '0.25W', size: '3.2mm x 1.6mm', costTier: 1 },
  '1210': { powerRating: '0.5W', size: '3.2mm x 2.5mm', costTier: 2 },
  '2010': { powerRating: '0.75W', size: '5.0mm x 2.5mm', costTier: 3 },
  '2512': { powerRating: '1W', size: '6.3mm x 3.2mm', costTier: 3 },
};

/** Standard capacitor package sizes. */
const CAPACITOR_PACKAGES: Record<string, { maxVoltage: string; costTier: number }> = {
  '0201': { maxVoltage: '6.3V', costTier: 3 },
  '0402': { maxVoltage: '16V', costTier: 2 },
  '0603': { maxVoltage: '25V', costTier: 1 },
  '0805': { maxVoltage: '50V', costTier: 1 },
  '1206': { maxVoltage: '100V', costTier: 1 },
  '1210': { maxVoltage: '100V', costTier: 2 },
};

/** Common IC alternate families. */
const IC_ALTERNATES: Record<string, string[]> = {
  'LM7805': ['L7805', 'MC7805', 'uA7805', 'NCV7805'],
  'LM317': ['LM317T', 'AMS1117', 'LM1117'],
  'NE555': ['LM555', 'TLC555', 'ICM7555', 'LMC555'],
  'LM358': ['MCP6002', 'LM324', 'TLV2372'],
  'ATmega328P': ['ATmega328PB', 'ATmega168P'],
  'ESP32': ['ESP32-S3', 'ESP32-C3', 'ESP32-S2'],
  'STM32F103': ['STM32F303', 'STM32G431', 'GD32F103'],
};

/**
 * Detect the component type from a BOM item's description and part number.
 */
function detectComponentType(
  description: string,
  partNumber: string,
): 'resistor' | 'capacitor' | 'inductor' | 'ic' | 'connector' | 'other' {
  const desc = description.toLowerCase();
  const pn = partNumber.toLowerCase();

  if (desc.includes('resistor') || desc.includes('ohm') || /^\d+[kmr]\d*$/.test(pn)) {
    return 'resistor';
  }
  if (desc.includes('capacitor') || desc.includes('cap') || desc.includes('farad') || /^\d+[pnu]f/.test(pn)) {
    return 'capacitor';
  }
  if (desc.includes('inductor') || desc.includes('henry') || desc.includes('choke')) {
    return 'inductor';
  }
  if (desc.includes('connector') || desc.includes('header') || desc.includes('socket') || desc.includes('plug')) {
    return 'connector';
  }
  if (
    desc.includes('ic') ||
    desc.includes('mcu') ||
    desc.includes('regulator') ||
    desc.includes('op-amp') ||
    desc.includes('opamp') ||
    desc.includes('timer') ||
    desc.includes('driver') ||
    desc.includes('microcontroller')
  ) {
    return 'ic';
  }
  return 'other';
}

/**
 * Extract package size from description (e.g., "100nF 0805 X7R" → "0805").
 */
function extractPackage(description: string): string | null {
  const match = /\b(0201|0402|0603|0805|1206|1210|2010|2512|SOT-23|SOT-223|SOP-8|SOIC-8|QFP-\d+|QFN-\d+|DIP-\d+|TO-92|TO-220|TO-252)\b/i.exec(
    description,
  );
  return match ? match[1].toUpperCase() : null;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * Register all BOM optimization tools with the given registry.
 *
 * Tools registered (3 total):
 *
 * - `analyze_bom_optimization` — Analyze full BOM for cost/complexity optimization.
 * - `suggest_alternate_part`   — Suggest alternate parts for a specific BOM item.
 * - `consolidate_packages`     — Find package consolidation opportunities.
 *
 * @param registry - The {@link ToolRegistry} instance to register tools into.
 */
export function registerBomOptimizationTools(registry: ToolRegistry): void {
  /**
   * analyze_bom_optimization — Full BOM optimization analysis.
   *
   * Fetches all BOM items, analyzes for:
   * - Cheaper alternate components
   * - Package consolidation opportunities
   * - Over-spec'd components
   * - Unique part count reduction
   * Returns ranked suggestions with estimated savings.
   */
  registry.register({
    name: 'analyze_bom_optimization',
    description:
      'Analyze the full Bill of Materials for optimization opportunities. ' +
      'Fetches all BOM items and returns structured analysis including: ' +
      '1) Cheaper alternate components with estimated savings ' +
      '2) Package consolidation opportunities (e.g., standardize on 0805) ' +
      '3) Over-spec\'d components that could use smaller/cheaper parts ' +
      '4) Unique part count reduction to simplify procurement. ' +
      'Returns ranked suggestions with estimated savings percentage.',
    category: 'bom',
    parameters: z.object({
      focus: z
        .enum(['all', 'cost', 'consolidation', 'overspec', 'unique_parts'])
        .optional()
        .default('all')
        .describe('Focus area for optimization analysis (default: all)'),
    }),
    requiresConfirmation: false,
    execute: async (_params, ctx): Promise<ToolResult> => {
      const items = await ctx.storage.getBomItems(ctx.projectId);

      if (items.length === 0) {
        return {
          success: true,
          message: 'No BOM items found to optimize.',
          data: { suggestions: [], totalItems: 0 },
        };
      }

      // --- Analyze unique part count ---
      const partNumbers = new Set(items.map((i) => i.partNumber.toLowerCase()));
      const manufacturers = new Set(items.map((i) => (i.manufacturer || '').toLowerCase()).filter(Boolean));

      // --- Detect packages per component type ---
      interface PackageGroup {
        items: Array<{ id: number; partNumber: string; description: string; packageSize: string }>;
      }
      const packagesByType: Record<string, PackageGroup> = {};
      for (const item of items) {
        const compType = detectComponentType(item.description, item.partNumber);
        const pkg = extractPackage(item.description);
        if (pkg && (compType === 'resistor' || compType === 'capacitor')) {
          if (!packagesByType[compType]) {
            packagesByType[compType] = { items: [] };
          }
          packagesByType[compType].items.push({
            id: item.id,
            partNumber: item.partNumber,
            description: item.description,
            packageSize: pkg,
          });
        }
      }

      // --- Find consolidation opportunities ---
      interface ConsolidationOpportunity {
        componentType: string;
        currentPackages: string[];
        recommendedPackage: string;
        affectedItems: number;
        reason: string;
      }
      const consolidationOpps: ConsolidationOpportunity[] = [];
      for (const [compType, group] of Object.entries(packagesByType)) {
        const packages = new Set(group.items.map((i) => i.packageSize));
        if (packages.size > 1) {
          // Recommend consolidating to the most common package
          const pkgCounts: Record<string, number> = {};
          for (const item of group.items) {
            pkgCounts[item.packageSize] = (pkgCounts[item.packageSize] || 0) + 1;
          }
          const sorted = Object.entries(pkgCounts).sort((a, b) => b[1] - a[1]);
          const recommended = sorted[0][0];
          consolidationOpps.push({
            componentType: compType,
            currentPackages: Array.from(packages),
            recommendedPackage: recommended,
            affectedItems: group.items.length,
            reason: `${String(packages.size)} different ${compType} packages used — standardizing on ${recommended} reduces assembly complexity`,
          });
        }
      }

      // --- Find potential cost savings ---
      interface CostSuggestion {
        bomItemId: number;
        partNumber: string;
        currentPrice: string;
        suggestion: string;
        category: string;
      }
      const costSuggestions: CostSuggestion[] = [];

      for (const item of items) {
        const price = parseFloat(item.unitPrice || '0');
        const compType = detectComponentType(item.description, item.partNumber);

        // Flag high-priced passives
        if (compType === 'resistor' && price > 0.10) {
          costSuggestions.push({
            bomItemId: item.id,
            partNumber: item.partNumber,
            currentPrice: item.unitPrice,
            suggestion: 'Standard resistor priced above $0.10 — consider generic equivalent',
            category: 'overpriced_passive',
          });
        }
        if (compType === 'capacitor' && price > 0.50) {
          costSuggestions.push({
            bomItemId: item.id,
            partNumber: item.partNumber,
            currentPrice: item.unitPrice,
            suggestion: 'Capacitor priced above $0.50 — verify specs are not over-spec\'d',
            category: 'overpriced_passive',
          });
        }

        // Flag items with quantity=1 that might benefit from quantity pricing
        if (item.quantity === 1 && price > 5.0) {
          costSuggestions.push({
            bomItemId: item.id,
            partNumber: item.partNumber,
            currentPrice: item.unitPrice,
            suggestion: 'Single quantity high-value part — ordering spares (qty 2-3) may qualify for price breaks',
            category: 'quantity_pricing',
          });
        }
      }

      // --- Find over-spec'd components ---
      interface OverspecItem {
        bomItemId: number;
        partNumber: string;
        description: string;
        reason: string;
      }
      const overspecItems: OverspecItem[] = [];
      for (const item of items) {
        const pkg = extractPackage(item.description);
        const compType = detectComponentType(item.description, item.partNumber);
        if (compType === 'resistor' && pkg) {
          const pkgInfo = RESISTOR_PACKAGES[pkg];
          if (pkgInfo && (pkg === '2512' || pkg === '2010' || pkg === '1210')) {
            overspecItems.push({
              bomItemId: item.id,
              partNumber: item.partNumber,
              description: item.description,
              reason: `Large ${pkg} package (${pkgInfo.powerRating}) — verify power requirement; ${pkgInfo.size} may be unnecessarily large`,
            });
          }
        }
      }

      // --- Supplier consolidation ---
      const suppliers = new Map<string, number>();
      for (const item of items) {
        const supplier = (item.supplier || 'Unknown').trim();
        suppliers.set(supplier, (suppliers.get(supplier) || 0) + 1);
      }
      const supplierCount = suppliers.size;
      const supplierBreakdown = Array.from(suppliers.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, itemCount: count }));

      // --- Total cost ---
      let totalCost = 0;
      for (const item of items) {
        totalCost += parseFloat(item.unitPrice || '0') * item.quantity;
      }

      return {
        success: true,
        message:
          `BOM optimization analysis: ${String(items.length)} items, ${String(partNumbers.size)} unique parts, ` +
          `${String(supplierCount)} suppliers, $${totalCost.toFixed(2)} total cost. ` +
          `Found ${String(costSuggestions.length)} cost suggestions, ${String(consolidationOpps.length)} consolidation opportunities, ` +
          `${String(overspecItems.length)} potentially over-spec'd items.`,
        data: {
          summary: {
            totalItems: items.length,
            uniquePartNumbers: partNumbers.size,
            uniqueManufacturers: manufacturers.size,
            totalCost: totalCost.toFixed(2),
            supplierCount,
            supplierBreakdown,
          },
          costSuggestions,
          consolidationOpportunities: consolidationOpps,
          overspecItems,
          packageDistribution: Object.fromEntries(
            Object.entries(packagesByType).map(([type, group]) => {
              const dist: Record<string, number> = {};
              for (const item of group.items) {
                dist[item.packageSize] = (dist[item.packageSize] || 0) + 1;
              }
              return [type, dist];
            }),
          ),
        },
        sources: items.map((item) => ({
          type: 'bom_item' as const,
          label: `${item.partNumber} (${item.manufacturer})`,
          id: item.id,
        })),
      };
    },
  });

  /**
   * suggest_alternate_part — Suggest alternatives for a specific BOM item.
   *
   * Given a bomItemId, looks up the item, identifies its type, and suggests
   * alternatives matching specs (voltage, current, package compatibility).
   * Uses built-in component knowledge for common parts.
   */
  registry.register({
    name: 'suggest_alternate_part',
    description:
      'Suggest alternative parts for a specific BOM item. ' +
      'Given a BOM item ID, analyzes the component type and suggests compatible alternates ' +
      'using built-in knowledge of common resistor packages (0402-2512), standard capacitor ranges, ' +
      'and popular IC alternates (voltage regulators, timers, op-amps, MCUs). ' +
      'Returns suggestions with compatibility notes and cost impact.',
    category: 'bom',
    parameters: z.object({
      bomItemId: z.number().int().positive().describe('ID of the BOM item to find alternates for'),
      reason: z
        .enum(['cost', 'availability', 'package_size', 'performance'])
        .optional()
        .default('cost')
        .describe('Reason for seeking alternates (default: cost)'),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx): Promise<ToolResult> => {
      const items = await ctx.storage.getBomItems(ctx.projectId);
      const item = items.find((b) => b.id === params.bomItemId);

      if (!item) {
        return {
          success: false,
          message: `BOM item with ID ${String(params.bomItemId)} not found in this project.`,
        };
      }

      const compType = detectComponentType(item.description, item.partNumber);
      const currentPackage = extractPackage(item.description);

      interface AlternateSuggestion {
        type: string;
        suggestion: string;
        compatibilityNote: string;
        costImpact: 'lower' | 'similar' | 'higher';
        packageCompatible: boolean;
      }
      const alternates: AlternateSuggestion[] = [];

      if (compType === 'resistor' && currentPackage) {
        // Suggest package alternatives
        const pkgKeys = Object.keys(RESISTOR_PACKAGES);
        const currentIdx = pkgKeys.indexOf(currentPackage);
        if (currentIdx > 0 && params.reason === 'package_size') {
          const smallerPkg = pkgKeys[currentIdx - 1];
          alternates.push({
            type: 'smaller_package',
            suggestion: `Switch from ${currentPackage} to ${smallerPkg}`,
            compatibilityNote: `Smaller footprint (${RESISTOR_PACKAGES[smallerPkg].size}), lower power rating (${RESISTOR_PACKAGES[smallerPkg].powerRating}) — verify thermal requirements`,
            costImpact: RESISTOR_PACKAGES[smallerPkg].costTier <= RESISTOR_PACKAGES[currentPackage].costTier ? 'lower' : 'higher',
            packageCompatible: false,
          });
        }
        if (params.reason === 'cost') {
          // 0603 and 0805 are typically cheapest
          if (currentPackage !== '0603' && currentPackage !== '0805') {
            alternates.push({
              type: 'cost_optimized_package',
              suggestion: `Consider 0603 or 0805 package — highest volume, lowest cost`,
              compatibilityNote: 'Most common packages with best pricing; verify power/size constraints',
              costImpact: 'lower',
              packageCompatible: false,
            });
          }
        }
      }

      if (compType === 'capacitor' && currentPackage) {
        if (params.reason === 'cost' && currentPackage !== '0603' && currentPackage !== '0805') {
          alternates.push({
            type: 'cost_optimized_package',
            suggestion: `Consider 0603 or 0805 capacitor — highest volume, lowest cost`,
            compatibilityNote: 'Verify voltage rating and capacitance available in smaller package',
            costImpact: 'lower',
            packageCompatible: false,
          });
        }
      }

      if (compType === 'ic') {
        // Check built-in IC alternate database
        const pnUpper = item.partNumber.toUpperCase();
        for (const [base, alts] of Object.entries(IC_ALTERNATES)) {
          if (pnUpper.includes(base.toUpperCase())) {
            for (const alt of alts) {
              alternates.push({
                type: 'ic_alternate',
                suggestion: `${alt} — potential drop-in replacement for ${base}`,
                compatibilityNote: 'Verify pinout, voltage range, and operating temp range match your requirements',
                costImpact: 'similar',
                packageCompatible: true,
              });
            }
            break;
          }
          // Also check if current part IS one of the alternates
          if (alts.some((a) => pnUpper.includes(a.toUpperCase()))) {
            alternates.push({
              type: 'ic_alternate',
              suggestion: `${base} — original/common part in this family`,
              compatibilityNote: 'May have better availability or pricing as the reference design part',
              costImpact: 'similar',
              packageCompatible: true,
            });
            break;
          }
        }
      }

      // Generic suggestion for any component type
      if (params.reason === 'availability') {
        alternates.push({
          type: 'multi_source',
          suggestion: `Search for second-source ${compType} from alternate manufacturer`,
          compatibilityNote: `Look for pin-compatible parts from ${item.manufacturer === 'TI' ? 'Analog Devices, ON Semi, STMicro' : 'TI, Microchip, NXP'}`,
          costImpact: 'similar',
          packageCompatible: true,
        });
      }

      return {
        success: true,
        message: `Found ${String(alternates.length)} alternate suggestions for ${item.partNumber} (${compType})`,
        data: {
          originalItem: {
            id: item.id,
            partNumber: item.partNumber,
            manufacturer: item.manufacturer,
            description: item.description,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            currentPackage,
            componentType: compType,
          },
          alternates,
          reason: params.reason,
        },
        sources: [
          {
            type: 'bom_item' as const,
            label: `${item.partNumber} (${item.manufacturer})`,
            id: item.id,
          },
        ],
      };
    },
  });

  /**
   * consolidate_packages — Identify package consolidation opportunities.
   *
   * Scans the BOM for items using multiple package types within the same
   * component category (e.g., resistors in 0402, 0603, and 0805) and
   * suggests standardizing on a single package to reduce assembly complexity
   * and potentially lower costs.
   */
  registry.register({
    name: 'consolidate_packages',
    description:
      'Identify BOM items that could use a shared package type to simplify assembly. ' +
      'Scans resistors, capacitors, and other passive components to find cases where ' +
      'multiple package sizes are used. Example: 3 different resistor packages → all 0805. ' +
      'Returns groupings with assembly cost impact and migration difficulty.',
    category: 'bom',
    parameters: z.object({
      targetPackage: z
        .string()
        .optional()
        .describe('Optional target package to consolidate to (e.g., "0805"). If omitted, the most common is recommended.'),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx): Promise<ToolResult> => {
      const items = await ctx.storage.getBomItems(ctx.projectId);

      if (items.length === 0) {
        return {
          success: true,
          message: 'No BOM items found to analyze for consolidation.',
          data: { groups: [], totalItems: 0 },
        };
      }

      // Group items by component type
      interface AnalyzedItem {
        id: number;
        partNumber: string;
        manufacturer: string;
        description: string;
        packageSize: string;
        unitPrice: string;
        quantity: number;
      }
      const typeGroups: Record<string, AnalyzedItem[]> = {};

      for (const item of items) {
        const compType = detectComponentType(item.description, item.partNumber);
        const pkg = extractPackage(item.description);
        if (pkg && (compType === 'resistor' || compType === 'capacitor' || compType === 'inductor')) {
          if (!typeGroups[compType]) {
            typeGroups[compType] = [];
          }
          typeGroups[compType].push({
            id: item.id,
            partNumber: item.partNumber,
            manufacturer: item.manufacturer,
            description: item.description,
            packageSize: pkg,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
          });
        }
      }

      // Analyze each component type group
      interface ConsolidationGroup {
        componentType: string;
        currentPackages: Record<string, number>;
        recommendedPackage: string;
        itemsToMigrate: Array<{
          id: number;
          partNumber: string;
          currentPackage: string;
          migrationDifficulty: 'easy' | 'moderate' | 'hard';
        }>;
        assemblyCostImpact: string;
        totalItemsInGroup: number;
      }
      const groups: ConsolidationGroup[] = [];

      for (const [compType, groupItems] of Object.entries(typeGroups)) {
        // Count packages
        const pkgCounts: Record<string, number> = {};
        for (const item of groupItems) {
          pkgCounts[item.packageSize] = (pkgCounts[item.packageSize] || 0) + 1;
        }

        const uniquePackages = Object.keys(pkgCounts);
        if (uniquePackages.length <= 1) {
          continue; // Already consolidated
        }

        // Determine target package
        let target: string;
        if (params.targetPackage && uniquePackages.includes(params.targetPackage.toUpperCase())) {
          target = params.targetPackage.toUpperCase();
        } else {
          // Use the most common package
          target = Object.entries(pkgCounts).sort((a, b) => b[1] - a[1])[0][0];
        }

        // Identify items that need migration
        const itemsToMigrate = groupItems
          .filter((item) => item.packageSize !== target)
          .map((item) => {
            // Determine migration difficulty based on package size difference
            const sizeOrder = ['0201', '0402', '0603', '0805', '1206', '1210', '2010', '2512'];
            const currentIdx = sizeOrder.indexOf(item.packageSize);
            const targetIdx = sizeOrder.indexOf(target);
            const sizeDiff = Math.abs(currentIdx - targetIdx);

            let difficulty: 'easy' | 'moderate' | 'hard';
            if (sizeDiff <= 1) {
              difficulty = 'easy';
            } else if (sizeDiff <= 2) {
              difficulty = 'moderate';
            } else {
              difficulty = 'hard';
            }

            return {
              id: item.id,
              partNumber: item.partNumber,
              currentPackage: item.packageSize,
              migrationDifficulty: difficulty,
            };
          });

        // Estimate assembly cost impact
        const reductionPct = ((uniquePackages.length - 1) / uniquePackages.length) * 100;
        const assemblyCostImpact =
          `Reducing from ${String(uniquePackages.length)} ${compType} packages to 1 (${target}) — ` +
          `~${reductionPct.toFixed(0)}% fewer feeder slots, faster pick-and-place setup`;

        groups.push({
          componentType: compType,
          currentPackages: pkgCounts,
          recommendedPackage: target,
          itemsToMigrate,
          assemblyCostImpact,
          totalItemsInGroup: groupItems.length,
        });
      }

      const totalMigrations = groups.reduce((sum, g) => sum + g.itemsToMigrate.length, 0);

      return {
        success: true,
        message:
          `Package consolidation analysis: ${String(groups.length)} component types with consolidation opportunities, ` +
          `${String(totalMigrations)} items could be migrated.`,
        data: {
          groups,
          summary: {
            totalAnalyzed: items.length,
            componentTypesWithOpportunities: groups.length,
            totalItemsToMigrate: totalMigrations,
          },
        },
        sources: items
          .filter((item) => {
            const pkg = extractPackage(item.description);
            return pkg !== null;
          })
          .map((item) => ({
            type: 'bom_item' as const,
            label: `${item.partNumber} (${item.manufacturer})`,
            id: item.id,
          })),
      };
    },
  });
}
