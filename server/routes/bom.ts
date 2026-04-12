import type { Express } from 'express';
import { fromZodError } from 'zod-validation-error';
import { storage, VersionConflictError } from '../storage';
import { db } from '../db';
import { insertBomItemSchema } from '@shared/schema';
import { payloadLimit, parseIdParam, paginationSchema } from './utils';
import { requireProjectOwnership } from './auth-middleware';
import { setCacheHeaders } from '../lib/cache-headers';
import { mirrorIngressBestEffort, type IngressRequest } from '../parts-ingress';
import { featureFlags } from '../env';

/** Parse the If-Match header value into a version number, or undefined if absent/invalid. */
function parseIfMatch(header: string | undefined): number | undefined {
  if (!header) { return undefined; }
  const match = /^"?(\d+)"?$/.exec(header.trim());
  return match ? Number(match[1]) : undefined;
}

export function registerBomRoutes(app: Express): void {
  app.get(
    '/api/projects/:id/bom',
    requireProjectOwnership,
    setCacheHeaders('project_data'),
    async (req, res) => {
      const opts = paginationSchema.safeParse(req.query);
      const pagination = opts.success ? opts.data : { limit: 50, offset: 0, sort: 'desc' as const };
      const items = await storage.getBomItems(parseIdParam(req.params.id), pagination);
      res.json({ data: items, total: items.length });
    },
  );

  app.get(
    '/api/projects/:id/bom/low-stock',
    requireProjectOwnership,
    setCacheHeaders('project_data'),
    async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const items = await storage.getLowStockItems(projectId);
      res.json(items);
    },
  );

  app.get(
    '/api/projects/:id/bom/storage-locations',
    requireProjectOwnership,
    setCacheHeaders('project_data'),
    async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const locations = await storage.getStorageLocations(projectId);
      res.json(locations);
    },
  );

  app.get(
    '/api/projects/:id/bom/:bomId',
    requireProjectOwnership,
    setCacheHeaders('project_data'),
    async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const bomId = parseIdParam(req.params.bomId);
      const item = await storage.getBomItem(bomId, projectId);
      if (!item) {
        return res.status(404).json({ message: 'BOM item not found' });
      }
      res.setHeader('ETag', `"${item.version}"`);
      res.json(item);
    },
  );

  app.post(
    '/api/projects/:id/bom',
    requireProjectOwnership,
    payloadLimit(32 * 1024),
    async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const parsed = insertBomItemSchema.omit({ projectId: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }
      const item = await storage.createBomItem({ ...parsed.data, projectId });
      res.setHeader('ETag', `"${item.version}"`);
      res.status(201).json(item);

      // Phase 2 dual-write mirror. Best-effort — legacy is authoritative; mirror failures
      // write to parts_ingress_failures for Phase 4 reconciliation. Flag-gated for safety.
      if (featureFlags.partsCatalogV2) {
        const ingressReq: IngressRequest = {
          source: 'bom_create',
          origin: 'user',
          projectId,
          fields: {
            title: item.description,
            description: item.description,
            manufacturer: item.manufacturer,
            mpn: item.partNumber,
            canonicalCategory: item.assemblyCategory ?? 'other',
            esdSensitive: item.esdSensitive,
            assemblyCategory: null,
            tolerance: item.tolerance,
            datasheetUrl: item.datasheetUrl,
            manufacturerUrl: item.manufacturerUrl,
            meta: {},
            connectors: [],
          },
          stock: {
            quantityNeeded: item.quantity,
            quantityOnHand: item.quantityOnHand,
            minimumStock: item.minimumStock,
            storageLocation: item.storageLocation,
            unitPrice: item.unitPrice,
            supplier: item.supplier,
            leadTime: item.leadTime,
            status: item.status,
          },
        };
        void mirrorIngressBestEffort(
          ingressReq,
          {
            source: 'bom_create',
            projectId,
            legacyTable: 'bom_items',
            legacyId: item.id,
          },
          db,
        );
      }
    },
  );

  app.patch(
    '/api/projects/:id/bom/:bomId',
    requireProjectOwnership,
    payloadLimit(32 * 1024),
    async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const bomId = parseIdParam(req.params.bomId);
      const parsed = insertBomItemSchema.partial().omit({ projectId: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }
      const expectedVersion = parseIfMatch(req.headers['if-match'] as string | undefined);
      try {
        const updated = await storage.updateBomItem(bomId, projectId, parsed.data, expectedVersion);
        if (!updated) {
          return res.status(404).json({ message: 'BOM item not found' });
        }
        res.setHeader('ETag', `"${updated.version}"`);
        res.json(updated);
      } catch (e) {
        if (e instanceof VersionConflictError) {
          return res.status(409).json({
            error: 'Conflict',
            message: 'Resource was modified by another request. Re-fetch and retry.',
            currentVersion: e.currentVersion,
          });
        }
        throw e;
      }
    },
  );

  app.delete(
    '/api/projects/:id/bom/:bomId',
    requireProjectOwnership,
    async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const bomId = parseIdParam(req.params.bomId);
      const deleted = await storage.deleteBomItem(bomId, projectId);
      if (!deleted) {
        return res.status(404).json({ message: 'BOM item not found' });
      }
      res.status(204).end();
    },
  );
}
