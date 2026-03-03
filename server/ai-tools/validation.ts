/**
 * Validation tools — DRC, ERC, power budget, thermal analysis, test plan generation.
 *
 * Provides AI tools for design verification and validation: running full DRC,
 * clearing validation issues, adding specific findings, analyzing power budgets,
 * checking voltage domain compatibility, auto-fixing common issues, running DFM
 * checks, performing thermal analysis, and generating comprehensive test plans.
 *
 * Tools that mutate validation data server-side (e.g., `add_validation_issue`)
 * execute via `ctx.storage`. Tools that require client-side UI interaction
 * (e.g., `run_validation`, `power_budget_analysis`) are dispatched via
 * {@link clientAction}. The `generate_test_plan` tool gathers full project
 * state server-side and returns structured data for the AI to format.
 *
 * @module ai-tools/validation
 */

import { z } from 'zod';
import type { ToolRegistry } from './registry';
import { clientAction } from './registry';
import type { ToolResult } from './types';

/**
 * Register all validation-category tools with the given registry.
 *
 * Tools registered (8 total):
 *
 * **Core validation:**
 * - `run_validation`        — Trigger a full DRC on the current project.
 * - `clear_validation`      — Clear all validation issues (destructive, requires confirmation).
 * - `add_validation_issue`  — Add a specific validation finding (server-side, writes to DB).
 *
 * **Analysis:**
 * - `power_budget_analysis` — Calculate total power budget across all rails.
 * - `voltage_domain_check`  — Verify voltage compatibility across connections.
 * - `thermal_analysis`      — Estimate power dissipation and flag thermal hot spots.
 *
 * **Automated fixes:**
 * - `auto_fix_validation`   — Auto-fix issues (decoupling caps, pull-ups, ESD protection).
 * - `dfm_check`             — Run Design for Manufacturing checks.
 *
 * **Test planning:**
 * - `generate_test_plan`    — Gather project state and return structured data for test plan generation.
 *
 * @param registry - The {@link ToolRegistry} instance to register tools into.
 */
export function registerValidationTools(registry: ToolRegistry): void {
  /**
   * run_validation — Trigger a full design validation / DRC on the project.
   *
   * Dispatched client-side. Runs the complete design rule checking engine
   * against the current project state and populates the validation panel
   * with any findings.
   */
  registry.register({
    name: 'run_validation',
    description: 'Trigger a full design validation / design rule check (DRC) on the current project.',
    category: 'validation',
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (params) => clientAction('run_validation', params),
  });

  /**
   * clear_validation — Clear all validation issues from the project.
   *
   * Dispatched client-side. Requires user confirmation (`requiresConfirmation: true`)
   * because it removes all existing validation findings.
   */
  registry.register({
    name: 'clear_validation',
    description: 'Clear all validation issues from the project.',
    category: 'validation',
    parameters: z.object({}),
    requiresConfirmation: true,
    execute: async (params) => clientAction('clear_validation', params),
  });

  /**
   * add_validation_issue — Add a specific validation issue to the project.
   *
   * Executes server-side: creates a new validation issue record via
   * `storage.createValidationIssue()` with severity, message, optional
   * component reference, and optional suggestion.
   *
   * @side-effect Writes a new row to the `validation_issues` table.
   */
  registry.register({
    name: 'add_validation_issue',
    description: 'Add a specific validation issue/finding to the project.',
    category: 'validation',
    parameters: z.object({
      severity: z.enum(['error', 'warning', 'info']).describe('Issue severity level'),
      message: z.string().min(1).describe('Description of the issue'),
      componentId: z.string().optional().describe('Label of the affected component'),
      suggestion: z.string().optional().describe('Suggested fix for the issue'),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      await ctx.storage.createValidationIssue({
        projectId: ctx.projectId,
        severity: params.severity,
        message: params.message,
        componentId: params.componentId,
        suggestion: params.suggestion,
      });
      return {
        success: true,
        message: `Added ${params.severity}: ${params.message}`,
      };
    },
  });

  /**
   * power_budget_analysis — Calculate total power budget across all power rails.
   *
   * Dispatched client-side. Tallies current draw from all components on each
   * power rail and generates a power budget summary.
   */
  registry.register({
    name: 'power_budget_analysis',
    description:
      'Calculate total power budget across all power rails, tallying current draw from all components.',
    category: 'validation',
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (params) => clientAction('power_budget_analysis', params),
  });

  /**
   * voltage_domain_check — Verify voltage compatibility across all connections.
   *
   * Dispatched client-side. Scans all connections between components and flags
   * any voltage level mismatches that could cause damage or signal integrity issues.
   */
  registry.register({
    name: 'voltage_domain_check',
    description: 'Verify voltage compatibility across all connections and flag mismatches.',
    category: 'validation',
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (params) => clientAction('voltage_domain_check', params),
  });

  /**
   * auto_fix_validation — Automatically fix common validation issues.
   *
   * Dispatched client-side. Analyzes current validation findings and
   * automatically adds missing decoupling capacitors, pull-up resistors,
   * and ESD protection components.
   */
  registry.register({
    name: 'auto_fix_validation',
    description:
      'Automatically fix validation issues by adding missing decoupling caps, pull-up resistors, ESD protection.',
    category: 'validation',
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (params) => clientAction('auto_fix_validation', params),
  });

  /**
   * dfm_check — Run Design for Manufacturing checks.
   *
   * Dispatched client-side. Evaluates the design for manufacturing concerns:
   * flags hard-to-solder components and suggests assembly-friendly alternatives.
   */
  registry.register({
    name: 'dfm_check',
    description:
      'Run Design for Manufacturing checks — flag hard-to-solder components, suggest assembly-friendly alternatives.',
    category: 'validation',
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (params) => clientAction('dfm_check', params),
  });

  /**
   * thermal_analysis — Estimate power dissipation and flag thermal hot spots.
   *
   * Dispatched client-side. Calculates per-component power dissipation,
   * identifies thermal hot spots, and suggests heatsinks or thermal vias
   * where needed.
   */
  registry.register({
    name: 'thermal_analysis',
    description:
      'Estimate power dissipation per component, flag thermal hot spots, suggest heatsinks or thermal vias.',
    category: 'validation',
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (params) => clientAction('thermal_analysis', params),
  });

  /**
   * generate_test_plan — Gather project state for comprehensive test plan generation.
   *
   * Executes server-side: fetches the full project state in parallel (architecture
   * nodes/edges, BOM items, validation issues, circuit designs with instances and
   * nets) and returns structured data. The AI model uses this data to produce a
   * formatted test plan covering power rail verification, communication bus
   * validation, sensor/peripheral tests, thermal/environmental tests, mechanical
   * fit checks, and end-to-end integration tests.
   *
   * @returns A {@link ToolResult} with `data` containing `projectName`, `projectDescription`,
   *          `nodes`, `edges`, `bomItems`, `openIssues`, and `circuits` (each with
   *          instance and net summaries).
   *
   * @side-effect Reads from multiple tables but does not write any data.
   */
  registry.register({
    name: 'generate_test_plan',
    description:
      'Generate a comprehensive hardware test plan for board validation. Fetches the full project state ' +
      '(architecture, BOM, validation issues, circuit data) and returns it as structured data. ' +
      'Use this data to write a test plan document covering: ' +
      '1) Power rail verification (voltage levels, current limits, sequencing) ' +
      '2) Communication bus validation (I2C, SPI, UART — signal integrity, protocol compliance) ' +
      '3) Sensor/peripheral functional tests (calibration, accuracy, response time) ' +
      '4) Thermal and environmental tests (temperature range, humidity, ESD) ' +
      '5) Mechanical fit checks (connector mating, enclosure clearance) ' +
      '6) End-to-end system integration tests. ' +
      'Format each test with: ID, category, description, equipment needed, procedure steps, pass/fail criteria.',
    category: 'validation',
    parameters: z.object({
      focus: z
        .enum(['all', 'power', 'communication', 'sensors', 'thermal', 'mechanical', 'integration'])
        .optional()
        .default('all')
        .describe('Focus area for the test plan (default: all categories)'),
    }),
    requiresConfirmation: false,
    execute: async (_params, ctx): Promise<ToolResult> => {
      const [project, nodes, edges, bomItems, issues, circuits] = await Promise.all([
        ctx.storage.getProject(ctx.projectId),
        ctx.storage.getNodes(ctx.projectId),
        ctx.storage.getEdges(ctx.projectId),
        ctx.storage.getBomItems(ctx.projectId),
        ctx.storage.getValidationIssues(ctx.projectId),
        ctx.storage.getCircuitDesigns(ctx.projectId),
      ]);

      const circuitSummaries = await Promise.all(
        circuits.map(async (cd) => {
          const instances = await ctx.storage.getCircuitInstances(cd.id);
          const nets = await ctx.storage.getCircuitNets(cd.id);
          return {
            name: cd.name,
            instanceCount: instances.length,
            netCount: nets.length,
            instances: instances.map((i) => ({
              refDes: i.referenceDesignator,
              partId: i.partId,
            })),
            nets: nets.map((n) => ({ name: n.name, type: n.netType, voltage: n.voltage })),
          };
        }),
      );

      return {
        success: true,
        message: `Gathered test plan data for "${project?.name || 'Untitled'}"`,
        data: {
          projectName: project?.name || 'Untitled',
          projectDescription: project?.description || '',
          nodeCount: nodes.length,
          edgeCount: edges.length,
          nodes: nodes.map((n) => ({ label: n.label, type: n.nodeType })),
          edges: edges.map((e) => ({
            source: e.source,
            target: e.target,
            label: e.label,
            signalType: e.signalType,
            voltage: e.voltage,
          })),
          bomItemCount: bomItems.length,
          bomItems: bomItems.map((b) => ({
            partNumber: b.partNumber,
            manufacturer: b.manufacturer,
            description: b.description,
            quantity: b.quantity,
          })),
          openIssues: issues.map((i) => ({
            severity: i.severity,
            message: i.message,
            component: i.componentId,
          })),
          circuits: circuitSummaries,
        },
      };
    },
  });
}
