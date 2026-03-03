/**
 * Validation tools — DRC, ERC, power budget, thermal analysis, test plan generation, design review.
 *
 * Provides AI tools for design verification and validation: running full DRC,
 * clearing validation issues, adding specific findings, analyzing power budgets,
 * checking voltage domain compatibility, auto-fixing common issues, running DFM
 * checks, performing thermal analysis, generating comprehensive test plans, and
 * conducting holistic design reviews across all project dimensions.
 *
 * Tools that mutate validation data server-side (e.g., `add_validation_issue`)
 * execute via `ctx.storage`. Tools that require client-side UI interaction
 * (e.g., `run_validation`, `power_budget_analysis`) are dispatched via
 * {@link clientAction}. The `generate_test_plan` and `design_review` tools
 * gather full project state server-side and return structured data for the AI
 * to format.
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
 * Tools registered (10 total):
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
 * **Design review:**
 * - `design_review`         — Gather ALL project data and return structured review across 7 categories.
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

  /**
   * design_review — Comprehensive AI-powered design review across all project dimensions.
   *
   * Executes server-side: fetches ALL project data in parallel (architecture nodes/edges,
   * BOM items, component parts, validation issues, circuit designs with instances, nets,
   * and wires) and returns a structured dataset organized for multi-category review.
   *
   * The AI model uses this data to produce findings across seven review categories:
   *
   * 1. **Architecture completeness** — Missing connections, isolated nodes, dangling edges.
   * 2. **BOM quality** — Missing values, duplicate parts, cost optimization opportunities.
   * 3. **Electrical safety** — Missing protection circuits, power filtering, thermal concerns.
   * 4. **Signal integrity** — Unterminated traces, impedance mismatches, mixed voltage domains.
   * 5. **Manufacturing readiness** — Missing reference designators, incomplete BOM fields.
   * 6. **Best practices** — Naming conventions, organization, documentation gaps.
   * 7. **Validation summary** — Current DRC/ERC status and open issue breakdown.
   *
   * @returns A {@link ToolResult} with `data` containing the full project state organized
   *          by review category, plus pre-computed metrics (connectivity, BOM completeness,
   *          voltage domains, signal types) to accelerate the AI's analysis.
   *
   * @side-effect Reads from multiple tables but does not write any data.
   */
  registry.register({
    name: 'design_review',
    description:
      'Perform a comprehensive design review across all project dimensions. ' +
      'Gathers ALL project data (architecture, BOM, components, circuits, validation issues) ' +
      'and returns structured data organized for multi-category review. ' +
      'Use this data to produce findings in these categories: ' +
      '1) Architecture completeness — missing connections, isolated nodes, dangling edges ' +
      '2) BOM quality — missing values (empty part numbers, zero quantities, missing suppliers), ' +
      'duplicate parts, cost optimization opportunities ' +
      '3) Electrical safety — missing protection (ESD, TVS, fuses), power filtering, thermal concerns ' +
      '4) Signal integrity — unterminated high-speed traces, impedance mismatches, mixed voltage domains ' +
      '5) Manufacturing readiness — missing reference designators, incomplete BOM fields, assembly notes ' +
      '6) Best practices — naming conventions, node organization, documentation gaps ' +
      '7) Validation summary — current DRC/ERC status, open issue breakdown by severity. ' +
      'For each finding, provide: category, severity (critical/warning/info), description, and recommendation.',
    category: 'validation',
    parameters: z.object({
      focus: z
        .enum([
          'all',
          'architecture',
          'bom',
          'electrical',
          'signal_integrity',
          'manufacturing',
          'best_practices',
          'validation',
        ])
        .optional()
        .default('all')
        .describe('Focus area for the review (default: all categories)'),
    }),
    requiresConfirmation: false,
    modelPreference: 'premium',
    execute: async (_params, ctx): Promise<ToolResult> => {
      // Fetch all project data in parallel
      const [project, nodes, edges, bomItemsList, componentPartsList, issues, circuits] = await Promise.all([
        ctx.storage.getProject(ctx.projectId),
        ctx.storage.getNodes(ctx.projectId),
        ctx.storage.getEdges(ctx.projectId),
        ctx.storage.getBomItems(ctx.projectId),
        ctx.storage.getComponentParts(ctx.projectId),
        ctx.storage.getValidationIssues(ctx.projectId),
        ctx.storage.getCircuitDesigns(ctx.projectId),
      ]);

      // Gather circuit-level detail: instances, nets, and wires per design
      const circuitDetails = await Promise.all(
        circuits.map(async (cd) => {
          const [instances, nets, wires] = await Promise.all([
            ctx.storage.getCircuitInstances(cd.id),
            ctx.storage.getCircuitNets(cd.id),
            ctx.storage.getCircuitWires(cd.id),
          ]);
          return {
            designName: cd.name,
            designId: cd.id,
            parentDesignId: cd.parentDesignId,
            instances: instances.map((inst) => ({
              id: inst.id,
              refDes: inst.referenceDesignator,
              partId: inst.partId,
            })),
            nets: nets.map((net) => ({
              id: net.id,
              name: net.name,
              type: net.netType,
              voltage: net.voltage,
            })),
            wires: wires.map((w) => ({
              id: w.id,
              netId: w.netId,
              view: w.view,
              layer: w.layer,
              wireType: w.wireType,
            })),
          };
        }),
      );

      // --- Pre-computed metrics for architecture completeness ---

      // Build adjacency data: which nodes have connections
      const connectedNodeIds = new Set<string>();
      for (const edge of edges) {
        connectedNodeIds.add(edge.source);
        connectedNodeIds.add(edge.target);
      }
      const isolatedNodes = nodes
        .filter((n) => !connectedNodeIds.has(n.nodeId))
        .map((n) => ({ nodeId: n.nodeId, label: n.label, nodeType: n.nodeType }));

      // Detect dangling edges (edges referencing non-existent nodes)
      const allNodeIds = new Set(nodes.map((n) => n.nodeId));
      const danglingEdges = edges
        .filter((e) => !allNodeIds.has(e.source) || !allNodeIds.has(e.target))
        .map((e) => ({
          edgeId: e.edgeId,
          source: e.source,
          target: e.target,
          label: e.label,
          missingSource: !allNodeIds.has(e.source),
          missingTarget: !allNodeIds.has(e.target),
        }));

      // --- Pre-computed metrics for BOM quality ---

      const bomWithIssues = bomItemsList.map((b) => {
        const issues: string[] = [];
        if (!b.partNumber || b.partNumber.trim() === '') {
          issues.push('missing_part_number');
        }
        if (!b.manufacturer || b.manufacturer.trim() === '') {
          issues.push('missing_manufacturer');
        }
        if (!b.supplier || b.supplier.trim() === '') {
          issues.push('missing_supplier');
        }
        if (b.quantity <= 0) {
          issues.push('zero_or_negative_quantity');
        }
        if (b.unitPrice === '0' || b.unitPrice === '0.0000') {
          issues.push('zero_unit_price');
        }
        return {
          id: b.id,
          partNumber: b.partNumber,
          manufacturer: b.manufacturer,
          description: b.description,
          quantity: b.quantity,
          unitPrice: b.unitPrice,
          totalPrice: b.totalPrice,
          supplier: b.supplier,
          stock: b.stock,
          status: b.status,
          leadTime: b.leadTime,
          fieldIssues: issues,
        };
      });

      // Detect potential duplicate BOM entries (same partNumber + manufacturer)
      const bomDuplicateGroups: Record<string, number[]> = {};
      for (const b of bomItemsList) {
        if (b.partNumber && b.partNumber.trim() !== '') {
          const key = `${b.partNumber.trim().toLowerCase()}|${(b.manufacturer || '').trim().toLowerCase()}`;
          if (!bomDuplicateGroups[key]) {
            bomDuplicateGroups[key] = [];
          }
          bomDuplicateGroups[key].push(b.id);
        }
      }
      const duplicateBomEntries = Object.entries(bomDuplicateGroups)
        .filter(([, ids]) => ids.length > 1)
        .map(([key, ids]) => ({ key, bomItemIds: ids, count: ids.length }));

      // --- Pre-computed metrics for electrical/signal analysis ---

      const voltageDomains = new Set<string>();
      const signalTypes = new Set<string>();
      for (const edge of edges) {
        if (edge.voltage) {
          voltageDomains.add(edge.voltage);
        }
        if (edge.signalType) {
          signalTypes.add(edge.signalType);
        }
      }
      for (const cd of circuitDetails) {
        for (const net of cd.nets) {
          if (net.voltage) {
            voltageDomains.add(net.voltage);
          }
        }
      }

      // --- Pre-computed metrics for manufacturing readiness ---

      const instancesMissingRefDes = circuitDetails.flatMap((cd) =>
        cd.instances
          .filter((inst) => !inst.refDes || inst.refDes.trim() === '')
          .map((inst) => ({ designName: cd.designName, instanceId: inst.id, partId: inst.partId })),
      );

      const instancesMissingPart = circuitDetails.flatMap((cd) =>
        cd.instances
          .filter((inst) => inst.partId === null)
          .map((inst) => ({ designName: cd.designName, instanceId: inst.id, refDes: inst.refDes })),
      );

      // --- Pre-computed metrics for validation summary ---

      const issueBySeverity: Record<string, number> = {};
      for (const issue of issues) {
        const sev = issue.severity || 'unknown';
        issueBySeverity[sev] = (issueBySeverity[sev] || 0) + 1;
      }

      // Component parts summary
      const partsSummary = componentPartsList.map((p) => {
        const meta = p.meta && typeof p.meta === 'object' ? (p.meta as Record<string, unknown>) : {};
        return {
          id: p.id,
          nodeId: p.nodeId,
          title: (meta.title as string) || null,
          family: (meta.family as string) || null,
          category: (meta.category as string) || null,
          manufacturer: (meta.manufacturer as string) || null,
          mpn: (meta.mpn as string) || null,
        };
      });

      // Nodes summary
      const nodesSummary = nodes.map((n) => ({
        nodeId: n.nodeId,
        label: n.label,
        nodeType: n.nodeType,
      }));

      // Edges summary
      const edgesSummary = edges.map((e) => ({
        edgeId: e.edgeId,
        source: e.source,
        target: e.target,
        label: e.label,
        signalType: e.signalType,
        voltage: e.voltage,
        busWidth: e.busWidth,
        netName: e.netName,
      }));

      return {
        success: true,
        message:
          `Gathered design review data for "${project?.name || 'Untitled'}" — ` +
          `${nodes.length} nodes, ${edges.length} edges, ${bomItemsList.length} BOM items, ` +
          `${componentPartsList.length} parts, ${circuits.length} circuits, ${issues.length} open issues`,
        data: {
          projectName: project?.name || 'Untitled',
          projectDescription: project?.description || '',

          // Raw project data for detailed analysis
          architecture: {
            nodes: nodesSummary,
            edges: edgesSummary,
            nodeCount: nodes.length,
            edgeCount: edges.length,
          },

          bom: {
            items: bomWithIssues,
            itemCount: bomItemsList.length,
            duplicateGroups: duplicateBomEntries,
          },

          componentParts: {
            parts: partsSummary,
            partCount: componentPartsList.length,
          },

          circuits: {
            designs: circuitDetails,
            designCount: circuits.length,
          },

          validation: {
            issues: issues.map((i) => ({
              id: i.id,
              severity: i.severity,
              message: i.message,
              componentId: i.componentId,
              suggestion: i.suggestion,
            })),
            issueCount: issues.length,
            bySeverity: issueBySeverity,
          },

          // Pre-computed review metrics
          metrics: {
            isolatedNodes,
            danglingEdges,
            instancesMissingRefDes,
            instancesMissingPart,
            voltageDomains: Array.from(voltageDomains),
            signalTypes: Array.from(signalTypes),
            bomItemsWithFieldIssues: bomWithIssues.filter((b) => b.fieldIssues.length > 0).length,
            duplicateBomGroupCount: duplicateBomEntries.length,
          },
        },
      };
    },
  });
}
