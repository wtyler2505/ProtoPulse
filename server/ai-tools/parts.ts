/**
 * Parts catalog AI tools — Phase 3 of the unified parts catalog consolidation.
 *
 * Eight tools that read from the canonical `parts` / `part_stock` / `part_placements` tables
 * via the `partsStorage` singleton. These run alongside the existing 45+ legacy AI tools and
 * will eventually replace the legacy ones in Phase 6.
 *
 * All tools are read-only (`permissionTier: 'read'`). Write operations go through the ingress
 * pipeline (Phase 2) or direct storage calls from the HTTP routes.
 *
 * @module ai-tools/parts
 */

import { z } from 'zod';
import type { ToolRegistry } from './registry';
import type { ToolResult } from './types';
import { partsStorage } from '../storage';
import { TRUST_LEVELS, PART_ORIGINS, trustRank } from '@shared/parts/part-row';
import { PART_SORT_FIELDS } from '@shared/parts/part-filter';
import type { PartFilter, PartPagination } from '@shared/parts/part-filter';

export function registerPartsTools(registry: ToolRegistry): void {

  registry.register({
    name: 'search_parts',
    description: 'Search the unified parts catalog by text, category, trust level, origin, or tags. Returns a filtered and paginated list of canonical parts.',
    category: 'bom',
    permissionTier: 'read',
    modelPreference: 'fast',
    parameters: z.object({
      text: z.string().optional().describe('Free-text search across title, description, manufacturer, MPN'),
      category: z.string().optional().describe('Filter by canonical category (resistor, capacitor, mcu, etc.)'),
      minTrustLevel: z.enum(TRUST_LEVELS).optional().describe('Minimum trust tier (manufacturer_verified is highest)'),
      origin: z.enum(PART_ORIGINS).optional().describe('Filter by origin type'),
      isPublic: z.boolean().optional().describe('Filter public/private parts'),
      limit: z.number().int().positive().max(100).optional().default(20).describe('Max results'),
      sortBy: z.enum(PART_SORT_FIELDS).optional().default('updatedAt'),
      sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
    }),
    requiresConfirmation: false,
    execute: async (params) => {
      const filter: PartFilter = {
        text: params.text,
        category: params.category,
        minTrustLevel: params.minTrustLevel,
        origin: params.origin,
        isPublic: params.isPublic,
      };
      const pagination: PartPagination = {
        limit: params.limit,
        sortBy: params.sortBy,
        sortDir: params.sortDir,
      };
      const results = await partsStorage.search(filter, pagination);
      return {
        success: true,
        message: `Found ${results.length} parts matching the search criteria`,
        data: results.map((p) => ({
          id: p.id,
          slug: p.slug,
          title: p.title,
          manufacturer: p.manufacturer,
          mpn: p.mpn,
          category: p.canonicalCategory,
          packageType: p.packageType,
          trustLevel: p.trustLevel,
          origin: p.origin,
        })),
      };
    },
  });

  registry.register({
    name: 'get_part',
    description: 'Get the full canonical details of a specific part by ID or slug. Returns all fields including meta, connectors, datasheet URL.',
    category: 'bom',
    permissionTier: 'read',
    modelPreference: 'fast',
    parameters: z.object({
      id: z.string().optional().describe('Part UUID'),
      slug: z.string().optional().describe('Part slug (e.g., "res-10k-0402-1pct")'),
    }),
    requiresConfirmation: false,
    execute: async (params) => {
      let part;
      if (params.id) {
        part = await partsStorage.getById(params.id);
      } else if (params.slug) {
        part = await partsStorage.getBySlug(params.slug);
      } else {
        return { success: false, message: 'Provide either id or slug' };
      }
      if (!part) {
        return { success: false, message: 'Part not found' };
      }
      return { success: true, message: `Found part: "${part.title}" (${part.slug})`, data: part };
    },
  });

  registry.register({
    name: 'get_alternates',
    description: 'Get equivalent/substitute parts for a given part. Uses the part_alternates equivalence graph populated from the alternate-parts database.',
    category: 'bom',
    permissionTier: 'read',
    modelPreference: 'fast',
    parameters: z.object({
      partId: z.string().describe('Part UUID to find alternates for'),
    }),
    requiresConfirmation: false,
    execute: async (params) => {
      const alternates = await partsStorage.getAlternates(params.partId);
      if (alternates.length === 0) {
        return { success: true, message: 'No alternates found for this part', data: [] };
      }
      return {
        success: true,
        message: `Found ${alternates.length} alternate(s)`,
        data: alternates.map((p) => ({
          id: p.id,
          slug: p.slug,
          title: p.title,
          manufacturer: p.manufacturer,
          mpn: p.mpn,
          packageType: p.packageType,
          trustLevel: p.trustLevel,
        })),
      };
    },
  });

  registry.register({
    name: 'check_stock',
    description: 'Check the per-project stock/inventory for parts. Shows quantity on hand, quantity needed, storage location, supplier, and price.',
    category: 'bom',
    permissionTier: 'read',
    modelPreference: 'fast',
    parameters: z.object({
      projectId: z.number().int().positive().optional().describe('Project ID (defaults to current project)'),
      limit: z.number().int().positive().max(100).optional().default(50),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      const projectId = params.projectId ?? ctx.projectId;
      const stock = await partsStorage.listStockForProject(projectId, { limit: params.limit, offset: 0, sort: 'desc' });
      return {
        success: true,
        message: `Found ${stock.length} stock row(s) for project ${projectId}`,
        data: stock,
      };
    },
  });

  registry.register({
    name: 'suggest_substitute',
    description: 'Suggest a substitute part when the original is out of stock, obsolete, or over budget. Checks alternates and ranks by trust level.',
    category: 'bom',
    permissionTier: 'read',
    modelPreference: 'standard',
    parameters: z.object({
      partId: z.string().describe('Part UUID of the part to substitute'),
      reason: z.enum(['out_of_stock', 'obsolete', 'cost', 'general']).optional().default('general'),
    }),
    requiresConfirmation: false,
    execute: async (params) => {
      const original = await partsStorage.getById(params.partId);
      if (!original) {
        return { success: false, message: 'Original part not found' };
      }
      const alternates = await partsStorage.getAlternates(params.partId);
      if (alternates.length === 0) {
        return {
          success: true,
          message: `No known alternates for "${original.title}". Consider searching the catalog by category "${original.canonicalCategory}" for compatible parts.`,
          data: { original, alternates: [] },
        };
      }
      const ranked = [...alternates].sort((a, b) => trustRank(a.trustLevel) - trustRank(b.trustLevel));
      const best = ranked[0];
      return {
        success: true,
        message: `Best substitute for "${original.title}": "${best.title}" (${best.trustLevel} trust, slug: ${best.slug}). ${alternates.length} total alternate(s) available.`,
        data: { original, best, alternates: ranked },
      };
    },
  });

  registry.register({
    name: 'lookup_datasheet_for_part',
    description: 'Look up the datasheet URL for a part by ID. Returns the stored datasheet link if available.',
    category: 'bom',
    permissionTier: 'read',
    modelPreference: 'fast',
    parameters: z.object({
      partId: z.string().describe('Part UUID'),
    }),
    requiresConfirmation: false,
    execute: async (params) => {
      const part = await partsStorage.getById(params.partId);
      if (!part) {
        return { success: false, message: 'Part not found' };
      }
      if (!part.datasheetUrl) {
        return {
          success: true,
          message: `No datasheet URL stored for "${part.title}" (${part.mpn ?? 'no MPN'}). Consider adding one via the parts editor.`,
        };
      }
      return {
        success: true,
        message: `Datasheet for "${part.title}": ${part.datasheetUrl}`,
        data: { partId: part.id, title: part.title, datasheetUrl: part.datasheetUrl },
      };
    },
  });

  registry.register({
    name: 'compare_parts',
    description: 'Compare multiple parts side-by-side. Returns a comparison table of key specifications.',
    category: 'bom',
    permissionTier: 'read',
    modelPreference: 'standard',
    parameters: z.object({
      partIds: z.array(z.string()).min(2).max(10).describe('Array of part UUIDs to compare'),
    }),
    requiresConfirmation: false,
    execute: async (params) => {
      const resolved = await Promise.all(
        params.partIds.map(async (id: string) => partsStorage.getById(id)),
      );
      const found = resolved.filter((p): p is NonNullable<typeof p> => p !== undefined);
      if (found.length < 2) {
        return { success: false, message: `Only ${found.length} of ${params.partIds.length} parts found — need at least 2 for comparison` };
      }
      const table = found.map((p) => ({
        id: p.id,
        title: p.title,
        manufacturer: p.manufacturer,
        mpn: p.mpn,
        category: p.canonicalCategory,
        package: p.packageType,
        tolerance: p.tolerance,
        trustLevel: p.trustLevel,
        isPublic: p.isPublic,
        datasheetUrl: p.datasheetUrl,
      }));
      return {
        success: true,
        message: `Comparing ${found.length} parts: ${found.map((p) => `"${p.title}"`).join(', ')}`,
        data: table,
      };
    },
  });

  registry.register({
    name: 'recommend_part_for',
    description: 'Recommend a part from the catalog that matches a natural language description of what is needed. Searches by text and returns the best match.',
    category: 'bom',
    permissionTier: 'read',
    modelPreference: 'standard',
    parameters: z.object({
      description: z.string().describe('Natural language description of the needed part, e.g. "10k pull-up resistor" or "USB-C connector for ESP32"'),
      category: z.string().optional().describe('Optional category hint'),
      minTrustLevel: z.enum(TRUST_LEVELS).optional().default('user'),
    }),
    requiresConfirmation: false,
    execute: async (params) => {
      const filter: PartFilter = {
        text: params.description,
        category: params.category,
        minTrustLevel: params.minTrustLevel,
      };
      const results = await partsStorage.search(filter, { limit: 5, sortBy: 'trustLevel', sortDir: 'asc' });
      if (results.length === 0) {
        return {
          success: true,
          message: `No parts in the catalog match "${params.description}". The part may need to be added via the ingress pipeline or library.`,
          data: [],
        };
      }
      const best = results[0];
      return {
        success: true,
        message: `Recommended: "${best.title}" by ${best.manufacturer ?? 'unknown'} (${best.trustLevel} trust, slug: ${best.slug}). ${results.length} candidate(s) total.`,
        data: results.map((p) => ({
          id: p.id,
          slug: p.slug,
          title: p.title,
          manufacturer: p.manufacturer,
          mpn: p.mpn,
          category: p.canonicalCategory,
          packageType: p.packageType,
          trustLevel: p.trustLevel,
        })),
      };
    },
  });
}
