/**
 * Component tools — create, modify, delete, fork, validate component parts.
 *
 * Provides AI tools for managing the project's component library: creating
 * custom parts with metadata, modifying existing part properties, deleting
 * parts, forking components from the public library, and running DRC
 * validation on individual components.
 *
 * Tools that mutate component data server-side (e.g., `create_component_part`,
 * `modify_component`, `delete_component_part`) execute via `ctx.storage`.
 * Tools that require client-side UI interaction (e.g., `fork_library_component`,
 * `validate_component`) are dispatched via {@link clientAction}.
 *
 * @module ai-tools/component
 */

import { z } from 'zod';
import type { ToolRegistry } from './registry';
import { clientAction } from './registry';

/**
 * Register all component-category tools with the given registry.
 *
 * Tools registered (5 total):
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
        meta,
        connectors: [],
        buses: [],
        views: {},
        constraints: [],
      });
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
}
