/**
 * BOM (Bill of Materials) tools — item management, pricing, search, comparison, datasheet lookup.
 *
 * Provides AI tools for managing the project Bill of Materials: adding/removing
 * items, updating fields, looking up pricing and availability, finding alternative
 * parts, optimizing costs, searching by parametric specs, attaching datasheets,
 * looking up datasheets by part number, and generating component comparison tables.
 *
 * Tools that mutate BOM data server-side (e.g., `add_bom_item`) execute via
 * `ctx.storage`. Tools that require client-side UI interaction (e.g., `remove_bom_item`,
 * `parametric_search`) are dispatched via {@link clientAction}.
 *
 * @module ai-tools/bom
 */

import { z } from 'zod';
import type { ToolRegistry } from './registry';
import { clientAction } from './registry';
import type { ToolResult } from './types';
import { mirrorIngressBestEffort, type IngressRequest } from '../parts-ingress';
import { featureFlags } from '../env';
import { db } from '../db';

/**
 * Register all BOM-category tools with the given registry.
 *
 * Tools registered (11 total):
 *
 * **Item CRUD:**
 * - `add_bom_item`         — Add a component to the BOM (server-side, writes to DB).
 * - `remove_bom_item`      — Remove a BOM item by part number (destructive, requires confirmation).
 * - `update_bom_item`      — Update fields of an existing BOM item.
 *
 * **Pricing & sourcing:**
 * - `pricing_lookup`        — Real-time pricing/availability lookup across distributors.
 * - `suggest_alternatives`  — Find alternative/equivalent parts.
 * - `optimize_bom`          — Analyze the entire BOM for cost optimization opportunities.
 * - `check_lead_times`      — Check estimated lead times for all BOM items.
 *
 * **Search & reference:**
 * - `parametric_search`     — Search for components by parametric specifications.
 * - `add_datasheet_link`    — Attach a datasheet URL to a BOM item.
 * - `lookup_datasheet`      — Look up datasheet/manufacturer info for a BOM item by ID.
 *
 * **Analysis:**
 * - `compare_components`    — Fetch BOM and architecture data for structured comparison.
 *
 * @param registry - The {@link ToolRegistry} instance to register tools into.
 */
export function registerBomTools(registry: ToolRegistry): void {
  /**
   * query_bom_items — Fetch list of items in the Bill of Materials.
   *
   * Executes server-side: returns all BOM items for the project.
   * Provides explicit sources for the AI answer source panel (BL-0160).
   */
  registry.register({
    name: 'query_bom_items',
    description: 'Fetch all items in the Bill of Materials to analyze costs, availability, or specifications.',
    category: 'bom',
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (_params, ctx): Promise<ToolResult> => {
      const items = await ctx.storage.getBomItems(ctx.projectId);
      return {
        success: true,
        message: `Found ${items.length} items in BOM`,
        data: items,
        sources: items.map(item => ({
          type: 'bom_item',
          label: `${item.partNumber} (${item.manufacturer})`,
          id: item.id,
        })),
      };
    },
  });

  /**
   * add_bom_item — Add a component to the Bill of Materials.
   *
   * Executes server-side: creates a new BOM item via `storage.createBomItem()`
   * with part number, manufacturer, description, quantity, pricing, and status.
   *
   * @side-effect Writes a new row to the `bom_items` table.
   */
  registry.register({
    name: 'add_bom_item',
    description:
      'Add a component to the Bill of Materials with part number, manufacturer, description, and optional pricing/sourcing info.',
    category: 'bom',
    parameters: z.object({
      partNumber: z.string().min(1).describe('Manufacturer part number'),
      manufacturer: z.string().min(1).describe('Component manufacturer'),
      description: z.string().min(1).describe('Component description'),
      quantity: z.number().int().positive().optional().default(1).describe('Quantity needed'),
      unitPrice: z.number().nonnegative().optional().default(0).describe('Unit price in USD'),
      supplier: z.string().optional().default('').describe('Supplier name (e.g., Digi-Key, Mouser)'),
      status: z
        .enum(['In Stock', 'Low Stock', 'Out of Stock', 'On Order'])
        .optional()
        .default('In Stock')
        .describe('Availability status'),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      const created = await ctx.storage.createBomItem({
        projectId: ctx.projectId,
        partNumber: params.partNumber,
        manufacturer: params.manufacturer,
        description: params.description,
        quantity: params.quantity,
        unitPrice: String(params.unitPrice),
        supplier: params.supplier,
        status: params.status,
        stock: 0,
      });

      // Phase 2 dual-write mirror.
      if (featureFlags.partsCatalogV2) {
        const ingressReq: IngressRequest = {
          source: 'ai',
          origin: 'ai_generated',
          projectId: ctx.projectId,
          fields: {
            title: params.description,
            description: params.description,
            manufacturer: params.manufacturer,
            mpn: params.partNumber,
            canonicalCategory: 'other',
            meta: {},
            connectors: [],
          },
          stock: {
            quantityNeeded: params.quantity,
            unitPrice: params.unitPrice,
            supplier: params.supplier,
            status: params.status,
          },
        };
        void mirrorIngressBestEffort(
          ingressReq,
          {
            source: 'ai',
            projectId: ctx.projectId,
            legacyTable: 'bom_items',
            legacyId: created.id,
          },
          db,
        );
      }

      return {
        success: true,
        message: `Added "${params.partNumber}" by ${params.manufacturer} to BOM`,
      };
    },
  });

  /**
   * remove_bom_item — Remove a component from the BOM by part number.
   *
   * Dispatched client-side. Requires user confirmation (`requiresConfirmation: true`)
   * because the operation is destructive.
   */
  registry.register({
    name: 'remove_bom_item',
    description: 'Remove a component from the Bill of Materials by part number.',
    category: 'bom',
    parameters: z.object({
      partNumber: z.string().min(1).describe('Part number of the BOM item to remove'),
    }),
    requiresConfirmation: true,
    execute: async (params) => clientAction('remove_bom_item', params),
  });

  /**
   * update_bom_item — Update fields of an existing BOM item.
   *
   * Dispatched client-side. Accepts a part number to identify the item and a
   * generic map of field names to new values.
   */
  registry.register({
    name: 'update_bom_item',
    description: 'Update fields of an existing BOM item. Specify the part number and a map of fields to update.',
    category: 'bom',
    parameters: z.object({
      partNumber: z.string().min(1).describe('Part number of the item to update'),
      updates: z
        .object({
          manufacturer: z.string().optional(),
          description: z.string().optional(),
          quantity: z.number().int().positive().optional(),
          unitPrice: z.union([z.string(), z.number()]).optional(),
          supplier: z.string().optional(),
          status: z.string().optional(),
          notes: z.string().optional(),
        })
        .describe('Map of field names to new values'),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('update_bom_item', params),
  });

  /**
   * pricing_lookup — Look up real-time pricing and availability for a part.
   *
   * Dispatched client-side. Queries distributor APIs (Digi-Key, Mouser, etc.)
   * for current pricing and stock levels.
   */
  registry.register({
    name: 'pricing_lookup',
    description: 'Look up real-time pricing and availability for a specific part across distributors.',
    category: 'bom',
    parameters: z.object({
      partNumber: z.string().min(1).describe('Part number to look up'),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('pricing_lookup', params),
  });

  /**
   * suggest_alternatives — Find alternative/equivalent parts for a BOM item.
   *
   * Dispatched client-side. Searches for drop-in replacements filtered by
   * reason: cost reduction, improved availability, or better performance.
   */
  registry.register({
    name: 'suggest_alternatives',
    description:
      'Find alternative/equivalent parts for a BOM item. Specify reason: cost reduction, availability, or performance.',
    category: 'bom',
    parameters: z.object({
      partNumber: z.string().min(1).describe('Part number to find alternatives for'),
      reason: z
        .enum(['cost', 'availability', 'performance'])
        .optional()
        .describe('Reason for seeking alternatives'),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('suggest_alternatives', params),
  });

  /**
   * optimize_bom — Analyze the entire BOM for cost optimization opportunities.
   *
   * Dispatched client-side. Evaluates supplier consolidation, quantity discount
   * thresholds, and cheaper equivalent components across the full BOM.
   */
  registry.register({
    name: 'optimize_bom',
    description:
      'Analyze the entire BOM for cost optimization opportunities: supplier consolidation, quantity discounts, cheaper equivalents.',
    category: 'bom',
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (params) => clientAction('optimize_bom', params),
  });

  /**
   * check_lead_times — Check estimated lead times for all BOM items.
   *
   * Dispatched client-side. Reviews delivery estimates and flags items
   * with lead times exceeding 8 weeks as potential schedule risks.
   */
  registry.register({
    name: 'check_lead_times',
    description:
      'Check estimated lead times and delivery dates for all BOM items. Flag items with long lead times (>8 weeks).',
    category: 'bom',
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (params) => clientAction('check_lead_times', params),
  });

  /**
   * parametric_search — Search for components by parametric specifications.
   *
   * Dispatched client-side. Accepts a component category and a map of
   * parameter name/value pairs (e.g., voltage: '3.3V', package: 'QFP-48')
   * to filter matching components.
   */
  registry.register({
    name: 'parametric_search',
    description: 'Search for components by parametric specifications (e.g., voltage, package, frequency).',
    category: 'bom',
    parameters: z.object({
      category: z
        .string()
        .min(1)
        .describe(
          'Component category: mcu, sensor, regulator, capacitor, resistor, inductor, connector, transistor, diode, opamp',
        ),
      specs: z
        .object({
          voltage: z.string().optional(),
          package: z.string().optional(),
          frequency: z.string().optional(),
          current: z.string().optional(),
          tolerance: z.string().optional(),
          size: z.string().optional(),
          interface: z.string().optional(),
          temperatureRange: z.string().optional(),
          mountingType: z.string().optional(),
        })
        .passthrough()
        .describe("Map of parameter names to values/ranges (e.g., voltage: '3.3V', package: 'QFP-48')"),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('parametric_search', params),
  });

  /**
   * add_datasheet_link — Attach a datasheet URL to a BOM item.
   *
   * Dispatched client-side. Associates the given URL with the specified
   * part number for quick reference in the procurement view.
   */
  registry.register({
    name: 'add_datasheet_link',
    description: 'Attach a datasheet URL to a BOM item for quick reference.',
    category: 'bom',
    parameters: z.object({
      partNumber: z.string().min(1).describe('Part number to link datasheet to'),
      url: z.string().url().describe('Datasheet URL'),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('add_datasheet_link', params),
  });

  /**
   * lookup_datasheet — Look up datasheet URL and manufacturer info for a BOM item.
   *
   * Executes server-side: reads the BOM item by ID, then returns structured data
   * (part number, manufacturer, description, existing URLs) so the AI can suggest
   * datasheet URLs or manufacturer pages in its response.
   *
   * @returns A {@link ToolResult} with the item's identifying info and current datasheet/manufacturer URLs.
   */
  registry.register({
    name: 'lookup_datasheet',
    description:
      'Look up datasheet URL and manufacturer info for a BOM item by its ID. ' +
      'Returns part number, manufacturer, description, and any existing datasheet/manufacturer URLs ' +
      'so you can suggest relevant datasheet links.',
    category: 'bom',
    parameters: z.object({
      bomItemId: z.number().int().positive().describe('ID of the BOM item to look up'),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx): Promise<ToolResult> => {
      const items = await ctx.storage.getBomItems(ctx.projectId);
      const item = items.find((b) => b.id === params.bomItemId);

      if (!item) {
        return {
          success: false,
          message: `BOM item with ID ${String(params.bomItemId)} not found in this project`,
        };
      }

      const searchQuery = [item.partNumber, item.manufacturer, item.description]
        .filter(Boolean)
        .join(' ');

      return {
        success: true,
        message: `Found BOM item: ${item.partNumber} by ${item.manufacturer}`,
        data: {
          id: item.id,
          partNumber: item.partNumber,
          manufacturer: item.manufacturer,
          description: item.description,
          supplier: item.supplier,
          datasheetUrl: item.datasheetUrl,
          manufacturerUrl: item.manufacturerUrl,
          searchQuery,
        },
        sources: [{
          type: 'bom_item',
          label: `${item.partNumber} (${item.manufacturer})`,
          id: item.id,
        }],
      };
    },
  });

  /**
   * compare_components — Fetch BOM and architecture data for structured comparison.
   *
   * Executes server-side: queries BOM items and architecture nodes in parallel,
   * cross-references BOM items with architecture node types, then returns a
   * filtered list of components with their architecture roles. Supports
   * filtering by architecture node category and/or specific part numbers.
   *
   * @returns A {@link ToolResult} with `data.components` (filtered BOM items enriched
   *          with `architectureRole`), `data.architectureNodes`, and `data.totalBomItems`.
   */
  registry.register({
    name: 'compare_components',
    description:
      'Fetch BOM and architecture data for component comparison. Returns all BOM items with their details ' +
      'and architecture node types so you can generate a structured comparison table. ' +
      'Use this data to produce a markdown table comparing components by: ' +
      'part number, manufacturer, description, unit price, quantity, supplier, status, and architecture role. ' +
      'If a category filter is provided, only components matching that node type are included. ' +
      'Highlight trade-offs: cost vs performance, availability vs lead time, package size vs thermal rating.',
    category: 'bom',
    parameters: z.object({
      category: z
        .string()
        .optional()
        .describe(
          'Filter by architecture node type (mcu, sensor, power, comm, connector). Omit to compare all.',
        ),
      partNumbers: z
        .array(z.string())
        .optional()
        .describe('Specific part numbers to compare. Omit to include all BOM items.'),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx): Promise<ToolResult> => {
      const [bomItems, nodes] = await Promise.all([
        ctx.storage.getBomItems(ctx.projectId),
        ctx.storage.getNodes(ctx.projectId),
      ]);

      // Build a map of node labels → node types for cross-referencing
      const nodeTypeMap = new Map<string, string>();
      for (const n of nodes) {
        nodeTypeMap.set(n.label.toLowerCase(), n.nodeType);
      }

      let filteredBom = bomItems;

      // Filter by specific part numbers if provided
      if (params.partNumbers && params.partNumbers.length > 0) {
        const lowerParts = new Set(params.partNumbers.map((p: string) => p.toLowerCase()));
        filteredBom = filteredBom.filter((b) => lowerParts.has(b.partNumber.toLowerCase()));
      }

      // Filter by category if provided — match BOM items whose description
      // relates to architecture nodes of the given type
      if (params.category) {
        const catLower = params.category.toLowerCase();
        const matchingNodeLabels = new Set(
          nodes.filter((n) => n.nodeType.toLowerCase() === catLower).map((n) => n.label.toLowerCase()),
        );
        if (matchingNodeLabels.size > 0) {
          filteredBom = filteredBom.filter(
            (b) =>
              matchingNodeLabels.has(b.partNumber.toLowerCase()) ||
              matchingNodeLabels.has(b.description.toLowerCase()) ||
              Array.from(matchingNodeLabels).some(
                (label) => b.description.toLowerCase().includes(label) || b.partNumber.toLowerCase().includes(label),
              ),
          );
        }
      }

      return {
        success: true,
        message: `Found ${String(filteredBom.length)} components for comparison`,
        data: {
          components: filteredBom.map((b) => ({
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
            architectureRole: nodeTypeMap.get(b.partNumber.toLowerCase()) ?? nodeTypeMap.get(b.description.toLowerCase()) ?? null,
          })),
          architectureNodes: nodes.map((n) => ({ label: n.label, type: n.nodeType })),
          totalBomItems: bomItems.length,
        },
        sources: [
          ...filteredBom.map(b => ({ type: 'bom_item' as const, label: b.partNumber, id: b.id })),
          ...nodes.map(n => ({ type: 'node' as const, label: n.label, id: n.id })),
        ],
      };
    },
  });
}
