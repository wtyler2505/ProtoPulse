/**
 * Component tools — create, modify, delete, fork, validate component parts.
 */

import { z } from 'zod';
import type { ToolRegistry } from './registry';
import { clientAction } from './registry';

export function registerComponentTools(registry: ToolRegistry): void {
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
