/**
 * Validation tools — DRC, ERC, power budget, thermal analysis, test plan generation.
 */

import { z } from 'zod';
import type { ToolRegistry } from './registry';
import { clientAction } from './registry';
import type { ToolResult } from './types';

export function registerValidationTools(registry: ToolRegistry): void {
  registry.register({
    name: 'run_validation',
    description: 'Trigger a full design validation / design rule check (DRC) on the current project.',
    category: 'validation',
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (params) => clientAction('run_validation', params),
  });

  registry.register({
    name: 'clear_validation',
    description: 'Clear all validation issues from the project.',
    category: 'validation',
    parameters: z.object({}),
    requiresConfirmation: true,
    execute: async (params) => clientAction('clear_validation', params),
  });

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

  registry.register({
    name: 'power_budget_analysis',
    description:
      'Calculate total power budget across all power rails, tallying current draw from all components.',
    category: 'validation',
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (params) => clientAction('power_budget_analysis', params),
  });

  registry.register({
    name: 'voltage_domain_check',
    description: 'Verify voltage compatibility across all connections and flag mismatches.',
    category: 'validation',
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (params) => clientAction('voltage_domain_check', params),
  });

  registry.register({
    name: 'auto_fix_validation',
    description:
      'Automatically fix validation issues by adding missing decoupling caps, pull-up resistors, ESD protection.',
    category: 'validation',
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (params) => clientAction('auto_fix_validation', params),
  });

  registry.register({
    name: 'dfm_check',
    description:
      'Run Design for Manufacturing checks — flag hard-to-solder components, suggest assembly-friendly alternatives.',
    category: 'validation',
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (params) => clientAction('dfm_check', params),
  });

  registry.register({
    name: 'thermal_analysis',
    description:
      'Estimate power dissipation per component, flag thermal hot spots, suggest heatsinks or thermal vias.',
    category: 'validation',
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (params) => clientAction('thermal_analysis', params),
  });

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
