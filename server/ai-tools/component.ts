/**
 * Component tools — create, modify, delete, fork, validate, suggest component parts.
 *
 * Provides AI tools for managing the project's component library: creating
 * custom parts with metadata, modifying existing part properties, deleting
 * parts, forking components from the public library, running DRC
 * validation on individual components, and intelligently suggesting missing
 * components based on the current design state.
 *
 * Tools that mutate component data server-side (e.g., `create_component_part`,
 * `modify_component`, `delete_component_part`) execute via `ctx.storage`.
 * Tools that require client-side UI interaction (e.g., `fork_library_component`,
 * `validate_component`) are dispatched via {@link clientAction}.
 * The `suggest_components` tool gathers project state server-side and returns
 * structured data for the AI to generate component recommendations.
 *
 * @module ai-tools/component
 */

import { z } from 'zod';
import { inferPartFamily, markPartMetaAsCandidate } from '@shared/component-trust';
import type { ToolRegistry } from './registry';
import { clientAction } from './registry';
import type { ToolResult } from './types';
import { mirrorIngressBestEffort, type IngressRequest } from '../parts-ingress';
import { featureFlags } from '../env';
import { db } from '../db';

/**
 * Register all component-category tools with the given registry.
 *
 * Tools registered (6 total):
 *
 * **Part CRUD:**
 * - `create_component_part`   — Create a new component part (server-side, writes to DB).
 * - `modify_component`        — Update an existing part's metadata (server-side, reads then writes).
 * - `delete_component_part`   — Delete a part from the library (destructive, requires confirmation).
 *
 * **Library operations:**
 * - `fork_library_component`  — Fork (copy) a component from the public library.
 *
 * **Validation:**
 * - `validate_component`      — Run DRC on a specific component part.
 *
 * **Analysis:**
 * - `suggest_components`      — Gather project state and return structured data for component suggestions.
 *
 * @param registry - The {@link ToolRegistry} instance to register tools into.
 */
export function registerComponentTools(registry: ToolRegistry): void {
  /**
   * create_component_part — Create a new component part in the project library.
   *
   * Executes server-side: builds a metadata JSON blob from the provided fields
   * (title, family, manufacturer, mpn, category, description) and writes a new
   * component part via `storage.createComponentPart()`. Optionally links the
   * part to an architecture node.
   *
   * @side-effect Writes a new row to the `component_parts` table.
   */
  registry.register({
    name: 'create_component_part',
    description:
      'Create a new component part in the project library from scratch. Defines a custom part with metadata stored in the meta JSON blob.',
    category: 'component',
    parameters: z.object({
      title: z.string().min(1).describe("Part title (e.g., 'ESP32-S3-WROOM-1')"),
      family: z.string().optional().describe("Part family (e.g., 'MCU', 'Resistor', 'Capacitor')"),
      manufacturer: z.string().optional().describe('Manufacturer name'),
      mpn: z.string().optional().describe('Manufacturer part number'),
      category: z.string().optional().describe("Category (e.g., 'IC', 'Passive', 'Connector')"),
      description: z.string().optional().describe('Part description'),
      nodeId: z.string().optional().describe('Architecture node ID to link this part to'),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      const meta: Record<string, unknown> = {
        title: params.title,
        ...(params.family && { family: params.family }),
        ...(params.manufacturer && { manufacturer: params.manufacturer }),
        ...(params.mpn && { mpn: params.mpn }),
        ...(params.category && { category: params.category }),
        ...(params.description && { description: params.description }),
      };
      const part = await ctx.storage.createComponentPart({
        projectId: ctx.projectId,
        nodeId: params.nodeId ?? null,
        meta: markPartMetaAsCandidate(
          {
            ...meta,
            partFamily: inferPartFamily(meta),
          },
          {
            note: 'Created from an AI tool action. Review the exact-part details before relying on authoritative wiring guidance.',
          },
        ),
        connectors: [],
        buses: [],
        views: {},
        constraints: [],
      });

      // Phase 2 dual-write mirror — AI create_component_part path.
      if (featureFlags.partsCatalogV2) {
        const ingressReq: IngressRequest = {
          source: 'ai',
          origin: 'ai_generated',
          projectId: ctx.projectId,
          fields: {
            title: params.title,
            description: params.description ?? null,
            manufacturer: params.manufacturer ?? null,
            mpn: params.mpn ?? null,
            canonicalCategory: params.family ?? params.category ?? 'other',
            meta: (part.meta ?? {}) as Record<string, unknown>,
            connectors: [],
          },
        };
        void mirrorIngressBestEffort(
          ingressReq,
          {
            source: 'ai',
            projectId: ctx.projectId,
            legacyTable: 'component_parts',
            legacyId: part.id,
          },
          db,
        );
      }

      return { success: true, message: `Created component part "${params.title}" (id: ${part.id})` };
    },
  });

  /**
   * modify_component — Update an existing component part's metadata.
   *
   * Executes server-side: fetches the current part via `storage.getComponentPart()`,
   * merges the provided fields into the existing `meta` JSON blob, and writes
   * the update via `storage.updateComponentPart()`. Only specified fields are
   * changed; omitted fields retain their current values.
   *
   * @side-effect Reads then writes to the `component_parts` table.
   */
  registry.register({
    name: 'modify_component',
    description:
      "Update an existing component part's metadata (title, family, manufacturer, mpn, etc.). Updates are merged into the existing meta JSON.",
    category: 'component',
    parameters: z.object({
      partId: z.number().int().positive().describe('Component part ID to modify'),
      title: z.string().optional().describe('New title'),
      family: z.string().optional().describe('New family'),
      manufacturer: z.string().optional().describe('New manufacturer'),
      mpn: z.string().optional().describe('New manufacturer part number'),
      category: z.string().optional().describe('New category'),
      description: z.string().optional().describe('New description'),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      // Fetch existing part to merge meta
      const existing = await ctx.storage.getComponentPart(params.partId, ctx.projectId);
      if (!existing) {
        return { success: false, message: `Component part ${params.partId} not found` };
      }
      const existingMeta =
        existing.meta && typeof existing.meta === 'object' ? (existing.meta as Record<string, unknown>) : {};
      const newMeta = { ...existingMeta };
      if (params.title !== undefined) {
        newMeta.title = params.title;
      }
      if (params.family !== undefined) {
        newMeta.family = params.family;
      }
      if (params.manufacturer !== undefined) {
        newMeta.manufacturer = params.manufacturer;
      }
      if (params.mpn !== undefined) {
        newMeta.mpn = params.mpn;
      }
      if (params.category !== undefined) {
        newMeta.category = params.category;
      }
      if (params.description !== undefined) {
        newMeta.description = params.description;
      }
      const updated = await ctx.storage.updateComponentPart(params.partId, ctx.projectId, { meta: newMeta });
      if (!updated) {
        return { success: false, message: `Failed to update component part ${params.partId}` };
      }
      return { success: true, message: `Updated component part ${params.partId}` };
    },
  });

  /**
   * delete_component_part — Delete a component part from the project library.
   *
   * Executes server-side: deletes the part via `storage.deleteComponentPart()`.
   * Requires user confirmation (`requiresConfirmation: true`) because the
   * operation is destructive and may affect circuit instances referencing this part.
   *
   * @side-effect Deletes a row from the `component_parts` table.
   */
  registry.register({
    name: 'delete_component_part',
    description: 'Delete a component part from the project library.',
    category: 'component',
    parameters: z.object({
      partId: z.number().int().positive().describe('Component part ID to delete'),
    }),
    requiresConfirmation: true,
    execute: async (params, ctx) => {
      const deleted = await ctx.storage.deleteComponentPart(params.partId, ctx.projectId);
      if (!deleted) {
        return { success: false, message: `Component part ${params.partId} not found` };
      }
      return { success: true, message: `Deleted component part ${params.partId}` };
    },
  });

  /**
   * fork_library_component — Fork a component from the public library into the project.
   *
   * Dispatched client-side. Copies the full component definition (metadata,
   * connectors, buses, views, constraints) from the shared public library
   * into the current project's component library.
   */
  registry.register({
    name: 'fork_library_component',
    description: 'Fork (copy) a component from the public library into the current project.',
    category: 'component',
    parameters: z.object({
      libraryEntryId: z.number().int().positive().describe('Public library entry ID to fork'),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('fork_library_component', params),
  });

  /**
   * validate_component — Run DRC on a specific component part.
   *
   * Dispatched client-side. Executes the design rule checking engine against
   * the specified part to verify footprint, pin definitions, and constraint
   * compliance.
   */
  registry.register({
    name: 'validate_component',
    description:
      'Run Design Rule Check (DRC) on a specific component part to verify footprint, pins, and constraints.',
    category: 'component',
    parameters: z.object({
      partId: z.number().int().positive().describe('Component part ID to validate'),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('validate_component', params),
  });

  /**
   * suggest_components — Gather project state for intelligent component suggestions.
   *
   * Executes server-side: fetches the full design state in parallel (architecture
   * nodes/edges, BOM items, component parts, circuit designs with instances and
   * nets) and returns structured data organized by component category. The AI model
   * uses this data to recommend missing components such as:
   *
   * - Decoupling capacitors (100nF per IC)
   * - Pull-up/pull-down resistors (I2C buses, reset pins)
   * - ESD/TVS protection on external interfaces
   * - Voltage regulators per voltage domain
   * - Bulk/bypass capacitors on power rails
   * - Crystals/oscillators for MCUs
   * - Programming/debug headers (JTAG/SWD)
   * - LED indicators (power, status)
   * - Test points on critical signals
   *
   * @returns A {@link ToolResult} with `data` containing the full design context
   *          organized for component gap analysis.
   *
   * @side-effect Reads from multiple tables but does not write any data.
   */
  registry.register({
    name: 'suggest_components',
    description:
      'Analyze the current design and return structured data for intelligent component suggestions. ' +
      'Gathers architecture nodes, edges, BOM items, component parts, circuit instances, and nets, ' +
      'then organizes them by category so you can identify missing components. ' +
      'Use this data to suggest additions such as: ' +
      '1) Decoupling capacitors (100nF per IC, bulk caps on power rails) ' +
      '2) Pull-up/pull-down resistors (I2C buses, SPI chip selects, reset pins) ' +
      '3) ESD/TVS protection on external interfaces (USB, Ethernet, GPIO headers) ' +
      '4) Voltage regulators for each voltage domain ' +
      '5) Crystal/oscillator for MCUs and communication ICs ' +
      '6) Programming/debug headers (JTAG, SWD, UART console) ' +
      '7) LED indicators (power, status, activity) ' +
      '8) Test points on critical signals and power rails ' +
      '9) Ferrite beads and filters on power inputs ' +
      'For each suggestion, provide: component type, rationale, priority (critical/recommended/nice-to-have), ' +
      'and which existing component or net it relates to.',
    category: 'component',
    parameters: z.object({
      focus: z
        .enum(['all', 'power', 'protection', 'passives', 'connectors', 'debug', 'indicators'])
        .optional()
        .default('all')
        .describe('Focus area for suggestions (default: all categories)'),
    }),
    requiresConfirmation: false,
    modelPreference: 'premium',
    execute: async (_params, ctx): Promise<ToolResult> => {
      const [project, nodes, edges, bomItems, componentPartsList, circuits] = await Promise.all([
        ctx.storage.getProject(ctx.projectId),
        ctx.storage.getNodes(ctx.projectId),
        ctx.storage.getEdges(ctx.projectId),
        ctx.storage.getBomItems(ctx.projectId),
        ctx.storage.getComponentParts(ctx.projectId),
        ctx.storage.getCircuitDesigns(ctx.projectId),
      ]);

      // Gather circuit-level detail: instances and nets per design
      const circuitDetails = await Promise.all(
        circuits.map(async (cd) => {
          const [instances, nets] = await Promise.all([
            ctx.storage.getCircuitInstances(cd.id),
            ctx.storage.getCircuitNets(cd.id),
          ]);
          return {
            designName: cd.name,
            designId: cd.id,
            instances: instances.map((inst) => ({
              id: inst.id,
              refDes: inst.referenceDesignator,
              partId: inst.partId,
              schematicX: inst.schematicX,
              schematicY: inst.schematicY,
            })),
            nets: nets.map((net) => ({
              id: net.id,
              name: net.name,
              type: net.netType,
              voltage: net.voltage,
            })),
          };
        }),
      );

      // Categorize architecture nodes by type for gap analysis
      const nodesByType: Record<string, Array<{ id: string; label: string; nodeType: string }>> = {};
      for (const node of nodes) {
        const t = node.nodeType || 'unknown';
        if (!nodesByType[t]) {
          nodesByType[t] = [];
        }
        nodesByType[t].push({ id: node.nodeId, label: node.label, nodeType: t });
      }

      // Categorize BOM items by description keywords for existing-component analysis
      const bomSummary = bomItems.map((b) => ({
        id: b.id,
        partNumber: b.partNumber,
        manufacturer: b.manufacturer,
        description: b.description,
        quantity: b.quantity,
      }));

      // Summarize component parts with their metadata
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

      // Summarize connections for interface analysis
      const connectionSummary = edges.map((e) => ({
        source: e.source,
        target: e.target,
        label: e.label,
        signalType: e.signalType,
        voltage: e.voltage,
        busWidth: e.busWidth,
      }));

      // Collect unique voltage domains from edges and nets
      const voltageDomains = new Set<string>();
      for (const edge of edges) {
        if (edge.voltage) {
          voltageDomains.add(edge.voltage);
        }
      }
      for (const cd of circuitDetails) {
        for (const net of cd.nets) {
          if (net.voltage) {
            voltageDomains.add(net.voltage);
          }
        }
      }

      // Collect unique signal types / bus protocols
      const signalTypes = new Set<string>();
      for (const edge of edges) {
        if (edge.signalType) {
          signalTypes.add(edge.signalType);
        }
      }

      return {
        success: true,
        message: `Gathered component suggestion data for "${project?.name || 'Untitled'}" ` +
          `(${nodes.length} nodes, ${bomItems.length} BOM items, ${componentPartsList.length} parts, ` +
          `${circuits.length} circuits)`,
        data: {
          projectName: project?.name || 'Untitled',
          projectDescription: project?.description || '',
          summary: {
            nodeCount: nodes.length,
            edgeCount: edges.length,
            bomItemCount: bomItems.length,
            componentPartCount: componentPartsList.length,
            circuitDesignCount: circuits.length,
            voltageDomains: Array.from(voltageDomains),
            signalTypes: Array.from(signalTypes),
          },
          nodesByType,
          connections: connectionSummary,
          bomItems: bomSummary,
          componentParts: partsSummary,
          circuits: circuitDetails,
        },
      };
    },
  });
}
