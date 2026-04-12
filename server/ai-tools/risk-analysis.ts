import { z } from 'zod';
import type { ToolRegistry } from './registry';
import type { BomItem } from '@shared/types/bom-compat';

export function calculateBuildRiskScore(bomItems: BomItem[]) {
  let costRiskScore = 0;
  let supplyRiskScore = 0;
  let assemblyRiskScore = 0;
  let totalCost = 0;
  
  const supplyWarnings: string[] = [];
  const assemblyWarnings: string[] = [];
  const costWarnings: string[] = [];

  for (const item of bomItems) {
    totalCost += Number(item.totalPrice);
    
    // 1. Supply Risk
    if (item.status === 'Out of Stock') {
      supplyRiskScore += 40;
      supplyWarnings.push(`${item.partNumber} is Out of Stock.`);
    } else if (item.status === 'Low Stock') {
      supplyRiskScore += 15;
      supplyWarnings.push(`${item.partNumber} has Low Stock.`);
    }

    if (item.supplier.toLowerCase() === 'unknown' || item.supplier.trim() === '') {
      supplyRiskScore += 10;
      supplyWarnings.push(`${item.partNumber} has no known supplier.`);
    }

    // 2. Assembly Risk
    if (item.assemblyCategory === 'THT') {
      assemblyRiskScore += 20; // Requires manual soldering or wave soldering
      assemblyWarnings.push(`${item.partNumber} is Through-Hole (THT), requiring manual assembly.`);
    }
    
    if (item.esdSensitive) {
      assemblyRiskScore += 5;
      assemblyWarnings.push(`${item.partNumber} is ESD sensitive.`);
    }
  }

  // 3. Cost Risk
  if (bomItems.length > 0) {
    for (const item of bomItems) {
      const itemCostRatio = Number(item.totalPrice) / totalCost;
      if (itemCostRatio > 0.4) { // One item is more than 40% of the total cost
        costRiskScore += 30;
        costWarnings.push(`${item.partNumber} dominates the BOM cost (${(itemCostRatio * 100).toFixed(1)}%).`);
      }
    }
  }
  
  if (totalCost > 100) {
    costRiskScore += 10;
    costWarnings.push(`Total BOM cost exceeds $100 ($${totalCost.toFixed(2)}).`);
  }

  // Cap scores at 100
  const normalizedCostRisk = Math.min(100, costRiskScore);
  const normalizedSupplyRisk = Math.min(100, supplyRiskScore);
  const normalizedAssemblyRisk = Math.min(100, assemblyRiskScore);
  
  const overallRisk = Math.round((normalizedCostRisk + normalizedSupplyRisk + normalizedAssemblyRisk) / 3);
  
  let grade = 'Low Risk';
  if (overallRisk > 66) grade = 'High Risk';
  else if (overallRisk > 33) grade = 'Medium Risk';

  return {
    overallRisk,
    grade,
    categories: {
      cost: { score: normalizedCostRisk, warnings: costWarnings },
      supply: { score: normalizedSupplyRisk, warnings: supplyWarnings },
      assembly: { score: normalizedAssemblyRisk, warnings: assemblyWarnings }
    },
    totalCost
  };
}

export function registerRiskAnalysisTools(registry: ToolRegistry) {
  registry.register({
    name: 'analyze_build_risk',
    description: 'Calculates the build-time risk score (Cost, Supply, Assembly) based on the current Bill of Materials.',
    category: 'bom',
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (_params, ctx) => {
      const bomItems = await ctx.storage.getBomItems(ctx.projectId);
      
      if (!bomItems || bomItems.length === 0) {
        return {
          success: false,
          message: 'BOM is empty. Add components before running risk analysis.'
        };
      }
      
      const analysis = calculateBuildRiskScore(bomItems);
      
      return {
        success: true,
        message: `### Build-Time Risk Analysis: **${analysis.grade}** (Score: ${analysis.overallRisk}/100)\n\n` +
                 `**Supply Risk: ${analysis.categories.supply.score}/100**\n` +
                 analysis.categories.supply.warnings.map(w => `- ${w}`).join('\n') + '\n\n' +
                 `**Assembly Risk: ${analysis.categories.assembly.score}/100**\n` +
                 analysis.categories.assembly.warnings.map(w => `- ${w}`).join('\n') + '\n\n' +
                 `**Cost Risk: ${analysis.categories.cost.score}/100**\n` +
                 analysis.categories.cost.warnings.map(w => `- ${w}`).join('\n') + '\n\n' +
                 `Total Estimated BOM Cost: $${analysis.totalCost.toFixed(2)}`,
        data: analysis
      };
    }
  });
}