/**
 * AI Tool Registry — barrel module.
 *
 * Re-exports all public types and creates the singleton registry instance
 * by composing category-specific registration functions.
 */

export type {
  ToolCategory,
  ToolResult,
  ToolContext,
  ModelTier,
  ToolDefinition,
} from './types';

export { ToolRegistry } from './registry';

import { ToolRegistry } from './registry';
import { registerNavigationTools } from './navigation';
import { registerArchitectureTools } from './architecture';
import { registerBomTools } from './bom';
import { registerValidationTools } from './validation';
import { registerProjectTools } from './project';
import { registerCircuitTools, registerPcbTools, registerCircuitCodeTools } from './circuit';
import { registerComponentTools } from './component';
import { registerExportTools } from './export';
import { registerVisionTools } from './vision';
import { registerGenerativeTools } from './generative';
import { registerArduinoTools } from './arduino';
import { registerSimulationTools } from './simulation';
import { registerManufacturingTools } from './manufacturing';
import { registerTestbenchTools } from './testbench';
import { registerBomOptimizationTools } from './bom-optimization';
import { registerRiskAnalysisTools } from './risk-analysis';

function createRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registerNavigationTools(registry);
  registerArchitectureTools(registry);
  registerBomTools(registry);
  registerValidationTools(registry);
  registerProjectTools(registry);
  registerCircuitTools(registry);
  registerComponentTools(registry);
  registerPcbTools(registry);
  registerCircuitCodeTools(registry);
  registerExportTools(registry);
  registerVisionTools(registry);
  registerGenerativeTools(registry);
  registerArduinoTools(registry);
  registerSimulationTools(registry);
  registerManufacturingTools(registry);
  registerTestbenchTools(registry);
  registerBomOptimizationTools(registry);
  registerRiskAnalysisTools(registry);
  return registry;
}

/** Singleton tool registry instance. */
export const toolRegistry = createRegistry();

/** List of tool names that require user confirmation before execution. */
export const DESTRUCTIVE_TOOLS = toolRegistry.getDestructiveTools();
