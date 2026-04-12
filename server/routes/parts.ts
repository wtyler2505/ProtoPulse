/**
 * Unified parts catalog routes — Phase 2.
 *
 * `POST /api/parts/ingress` is the single public ingress endpoint. Every importer path
 * (HTTP client, CLI, AI tool) can call it directly to mirror data into the canonical
 * `parts` / `part_stock` / `part_placements` catalog.
 *
 * In Phase 2, this endpoint exists as a shadow ingress path alongside the legacy importers.
 * Legacy remains the source of truth until Phase 5 cutover. Phase 3 adds the read routes
 * (`GET /api/parts`, `GET /api/parts/:id`, etc.).
 *
 * Auth model: requires an authenticated session (via `validateSession`). For project-scoped
 * writes (stock/placement), requires ownership of the target project.
 */

import type { Express, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { validateSession } from '../auth';
import { storage, partsStorage, StorageError, VersionConflictError } from '../storage';
import { db } from '../db';
import { HttpError, parseIdParam, payloadLimit } from './utils';
import { ingressPart, type IngressRequest, type IngressSource } from '../parts-ingress';
import { PART_ORIGINS, ASSEMBLY_CATEGORIES, TRUST_LEVELS, PLACEMENT_SURFACES, PLACEMENT_CONTAINER_TYPES } from '@shared/parts/part-row';
import type { PartFilter, PartPagination } from '@shared/parts/part-filter';
import { PART_SORT_FIELDS } from '@shared/parts/part-filter';
import { logger } from '../logger';

// ---------------------------------------------------------------------------
// Zod validation for the ingress payload
// ---------------------------------------------------------------------------

const commonFieldsSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().nullable().optional(),
  manufacturer: z.string().nullable().optional(),
  mpn: z.string().nullable().optional(),
  canonicalCategory: z.string().min(1).max(100),
  packageType: z.string().nullable().optional(),
  tolerance: z.string().nullable().optional(),
  esdSensitive: z.boolean().nullable().optional(),
  assemblyCategory: z.enum(ASSEMBLY_CATEGORIES).nullable().optional(),
  datasheetUrl: z.string().url().nullable().optional(),
  manufacturerUrl: z.string().url().nullable().optional(),
  meta: z.record(z.unknown()).optional(),
  connectors: z.array(z.unknown()).optional(),
  trustLevel: z.enum(TRUST_LEVELS).optional(),
  originRef: z.string().nullable().optional(),
  authorUserId: z.number().int().positive().nullable().optional(),
  isPublic: z.boolean().optional(),
});

const stockFieldsSchema = z.object({
  quantityNeeded: z.number().int().nonnegative().optional(),
  quantityOnHand: z.number().int().nonnegative().nullable().optional(),
  minimumStock: z.number().int().nonnegative().nullable().optional(),
  storageLocation: z.string().nullable().optional(),
  unitPrice: z.union([z.number().nonnegative(), z.string(), z.null()]).optional(),
  supplier: z.string().nullable().optional(),
  leadTime: z.string().nullable().optional(),
  status: z.string().optional(),
  notes: z.string().nullable().optional(),
});

const placementFieldsSchema = z.object({
  surface: z.enum(PLACEMENT_SURFACES),
  containerType: z.enum(PLACEMENT_CONTAINER_TYPES),
  containerId: z.number().int().positive(),
  referenceDesignator: z.string().min(1).max(50),
  x: z.number().nullable().optional(),
  y: z.number().nullable().optional(),
  rotation: z.number().optional(),
  layer: z.string().nullable().optional(),
  properties: z.record(z.unknown()).optional(),
});

const ingressRequestSchema = z.object({
  source: z.enum([
    'library_copy',
    'fzpz',
    'svg',
    'csv_bom',
    'camera_scan',
    'barcode',
    'manual',
    'bom_create',
    'component_create',
    'circuit_instance',
    'ai',
  ] as const),
  origin: z.enum(PART_ORIGINS),
  projectId: z.number().int().positive().optional(),
  fields: commonFieldsSchema,
  stock: stockFieldsSchema.optional(),
  placement: placementFieldsSchema.optional(),
});

// ---------------------------------------------------------------------------
// Read/search query schema
// ---------------------------------------------------------------------------

function parseInt32(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && Number.isInteger(n) ? n : fallback;
}

const searchQuerySchema = z.object({
  text: z.string().optional(),
  category: z.string().optional(),
  minTrustLevel: z.enum(TRUST_LEVELS).optional(),
  origin: z.enum(PART_ORIGINS).optional(),
  isPublic: z.coerce.boolean().optional(),
  hasMpn: z.coerce.boolean().optional(),
  projectId: z.coerce.number().int().positive().optional(),
  hasStock: z.coerce.boolean().optional(),
  tags: z.string().optional(), // comma-separated
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
  sortBy: z.enum(PART_SORT_FIELDS).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
});

const updateStockSchema = z.object({
  quantityNeeded: z.number().int().nonnegative().optional(),
  quantityOnHand: z.number().int().nonnegative().nullable().optional(),
  minimumStock: z.number().int().nonnegative().nullable().optional(),
  storageLocation: z.string().nullable().optional(),
  unitPrice: z.union([z.number().nonnegative(), z.string(), z.null()]).optional(),
  supplier: z.string().nullable().optional(),
  leadTime: z.string().nullable().optional(),
  status: z.enum(['In Stock', 'Low Stock', 'Out of Stock', 'On Order']).optional(),
  notes: z.string().nullable().optional(),
});

// ---------------------------------------------------------------------------
// Middleware: require auth
// ---------------------------------------------------------------------------

async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const sessionId = req.headers['x-session-id'];
  if (typeof sessionId !== 'string' || !sessionId) {
    res.status(401).json({ message: 'Unauthorized: missing X-Session-Id header' });
    return;
  }
  const session = await validateSession(sessionId);
  if (!session) {
    res.status(401).json({ message: 'Unauthorized: invalid session' });
    return;
  }
  (req as Request & { userId?: number }).userId = session.userId;
  next();
}

async function requireProjectOwnershipIfScoped(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as { projectId?: number } | undefined;
    const projectId = body?.projectId;
    if (projectId === undefined) {
      next();
      return;
    }
    const userId = (req as Request & { userId?: number }).userId;
    if (userId === undefined) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const owns = await storage.isProjectOwner(projectId, userId);
    if (!owns) {
      res.status(403).json({ message: 'Forbidden: not project owner' });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export function registerPartsRoutes(app: Express): void {

  // =========================================================================
  // Canonical read endpoints — Phase 3
  // =========================================================================

  // GET /api/parts — paginated search with filters
  app.get('/api/parts', async (req, res) => {
    const parsed = searchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ message: fromZodError(parsed.error).toString() });
      return;
    }
    const { text, category, minTrustLevel, origin, isPublic, hasMpn, projectId, hasStock, tags, limit, offset, sortBy, sortDir } = parsed.data;
    const filter: PartFilter = {
      text,
      category,
      minTrustLevel,
      origin,
      isPublic,
      hasMpn,
      projectId,
      hasStock,
      tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
    };
    const pagination: PartPagination = { limit, offset, sortBy, sortDir };
    try {
      if (projectId !== undefined) {
        const results = await partsStorage.searchWithStock(
          filter as PartFilter & { projectId: number },
          pagination,
        );
        res.json({ data: results, total: results.length });
      } else {
        const results = await partsStorage.search(filter, pagination);
        res.json({ data: results, total: results.length });
      }
    } catch (err) {
      if (err instanceof StorageError) {
        logger.error('GET /api/parts failed', { message: err.message });
        res.status(500).json({ message: 'Failed to search parts' });
        return;
      }
      throw err;
    }
  });

  // GET /api/parts/:id — single canonical part
  app.get('/api/parts/:id', async (req, res) => {
    const id = String(req.params.id);
    try {
      const part = await partsStorage.getById(id);
      if (!part) {
        res.status(404).json({ message: 'Part not found' });
        return;
      }
      res.setHeader('ETag', `"${part.version}"`);
      res.json(part);
    } catch (err) {
      if (err instanceof StorageError) {
        logger.error('GET /api/parts/:id failed', { message: err.message });
        res.status(500).json({ message: 'Failed to get part' });
        return;
      }
      throw err;
    }
  });

  // PATCH /api/parts/:id — update part-level fields (title, manufacturer, mpn, etc.)
  app.patch('/api/parts/:id', requireAuth, payloadLimit(32 * 1024), async (req, res) => {
    const id = String(req.params.id);
    const parsed = z.object({
      title: z.string().min(1).max(500).optional(),
      description: z.string().nullable().optional(),
      manufacturer: z.string().nullable().optional(),
      mpn: z.string().nullable().optional(),
      canonicalCategory: z.string().min(1).max(100).optional(),
      packageType: z.string().nullable().optional(),
      tolerance: z.string().nullable().optional(),
      esdSensitive: z.boolean().nullable().optional(),
      assemblyCategory: z.enum(ASSEMBLY_CATEGORIES).nullable().optional(),
    }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: fromZodError(parsed.error).toString() });
      return;
    }
    if (Object.keys(parsed.data).length === 0) {
      res.status(400).json({ message: 'No fields to update' });
      return;
    }
    const expectedVersion = (() => {
      const header = req.headers['if-match'];
      if (!header || typeof header !== 'string') { return undefined; }
      const match = /^"?(\d+)"?$/.exec(header.trim());
      return match ? Number(match[1]) : undefined;
    })();
    try {
      const updated = await partsStorage.updatePart(id, parsed.data, expectedVersion);
      if (!updated) {
        res.status(404).json({ message: 'Part not found' });
        return;
      }
      res.setHeader('ETag', `"${updated.version}"`);
      res.json(updated);
    } catch (err) {
      if (err instanceof VersionConflictError) {
        res.status(409).json({ error: 'Conflict', message: 'Part was modified by another request. Re-fetch and retry.', currentVersion: err.currentVersion });
        return;
      }
      if (err instanceof StorageError) {
        logger.error('PATCH /api/parts/:id failed', { message: err.message });
        res.status(500).json({ message: 'Failed to update part' });
        return;
      }
      throw err;
    }
  });

  // GET /api/parts/:id/alternates — equivalent parts via part_alternates table
  app.get('/api/parts/:id/alternates', async (req, res) => {
    const id = String(req.params.id);
    try {
      const alternates = await partsStorage.getAlternates(id);
      res.json({ data: alternates, total: alternates.length });
    } catch (err) {
      if (err instanceof StorageError) {
        logger.error('GET /api/parts/:id/alternates failed', { message: err.message });
        res.status(500).json({ message: 'Failed to get alternates' });
        return;
      }
      throw err;
    }
  });

  // POST /api/parts/:id/substitute — one-click part replacement within a project
  app.post('/api/parts/:id/substitute', validateSession, async (req: Request, res: Response) => {
    const oldPartId = String(req.params.id);
    const parsed = z.object({
      substituteId: z.string().uuid(),
      projectId: z.number().int().positive(),
    }).safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ message: fromZodError(parsed.error).toString() });
      return;
    }

    const { substituteId, projectId } = parsed.data;

    try {
      // Verify project ownership
      const session = (req as Record<string, unknown>).session as { userId: number };
      const isOwner = await storage.isProjectOwner(projectId, session.userId);
      if (!isOwner) {
        res.status(403).json({ message: 'Not authorized to modify this project' });
        return;
      }

      // Verify both parts exist
      const [oldPart, newPart] = await Promise.all([
        partsStorage.getById(oldPartId),
        partsStorage.getById(substituteId),
      ]);
      if (!oldPart) {
        res.status(404).json({ message: `Original part ${oldPartId} not found` });
        return;
      }
      if (!newPart) {
        res.status(404).json({ message: `Substitute part ${substituteId} not found` });
        return;
      }

      const result = await partsStorage.substitutePart(projectId, oldPartId, substituteId);
      res.json({
        message: `Replaced "${oldPart.title}" with "${newPart.title}"`,
        ...result,
      });
    } catch (err) {
      if (err instanceof StorageError) {
        logger.error('POST /api/parts/:id/substitute failed', { message: err.message });
        res.status(500).json({ message: 'Failed to substitute part' });
        return;
      }
      throw err;
    }
  });

  // GET /api/parts/:id/placements — where this part is used
  app.get('/api/parts/:id/placements', async (req, res) => {
    const id = String(req.params.id);
    try {
      const placements = await partsStorage.getPlacements(id);
      res.json({ data: placements, total: placements.length });
    } catch (err) {
      if (err instanceof StorageError) {
        logger.error('GET /api/parts/:id/placements failed', { message: err.message });
        res.status(500).json({ message: 'Failed to get placements' });
        return;
      }
      throw err;
    }
  });

  // GET /api/parts/:id/usage — cross-project usage report
  app.get('/api/parts/:id/usage', async (req, res) => {
    const id = String(req.params.id);
    try {
      const usage = await partsStorage.getUsageAcrossProjects(id);
      res.json({ data: usage, total: usage.length });
    } catch (err) {
      if (err instanceof StorageError) {
        logger.error('GET /api/parts/:id/usage failed', { message: err.message });
        res.status(500).json({ message: 'Failed to get part usage' });
        return;
      }
      throw err;
    }
  });

  // GET /api/parts/:id/lifecycle — obsolescence record
  app.get('/api/parts/:id/lifecycle', async (req, res) => {
    const id = String(req.params.id);
    try {
      const lifecycle = await partsStorage.getLifecycle(id);
      if (!lifecycle) {
        res.status(404).json({ message: 'No lifecycle record for this part' });
        return;
      }
      res.json(lifecycle);
    } catch (err) {
      if (err instanceof StorageError) {
        logger.error('GET /api/parts/:id/lifecycle failed', { message: err.message });
        res.status(500).json({ message: 'Failed to get lifecycle' });
        return;
      }
      throw err;
    }
  });

  // GET /api/parts/:id/spice — SPICE model
  app.get('/api/parts/:id/spice', async (req, res) => {
    const id = String(req.params.id);
    try {
      const model = await partsStorage.getSpiceModel(id);
      if (!model) {
        res.status(404).json({ message: 'No SPICE model for this part' });
        return;
      }
      res.json(model);
    } catch (err) {
      if (err instanceof StorageError) {
        logger.error('GET /api/parts/:id/spice failed', { message: err.message });
        res.status(500).json({ message: 'Failed to get SPICE model' });
        return;
      }
      throw err;
    }
  });

  // GET /api/projects/:pid/stock — per-project stock overlay
  app.get('/api/projects/:pid/stock', requireAuth, async (req, res) => {
    const projectId = parseInt32(req.params.pid, -1);
    if (projectId < 1) {
      res.status(400).json({ message: 'Invalid project ID' });
      return;
    }
    try {
      const limit = parseInt32(req.query.limit, 50);
      const offset = parseInt32(req.query.offset, 0);
      const sort = req.query.sort === 'asc' ? 'asc' : ('desc' as const);
      const stock = await partsStorage.listStockForProject(projectId, { limit, offset, sort });
      res.json({ data: stock, total: stock.length });
    } catch (err) {
      if (err instanceof StorageError) {
        logger.error('GET /api/projects/:pid/stock failed', { message: err.message });
        res.status(500).json({ message: 'Failed to list stock' });
        return;
      }
      throw err;
    }
  });

  // PATCH /api/projects/:pid/stock/:id — update stock row (quantities, price, location)
  app.patch('/api/projects/:pid/stock/:id', requireAuth, payloadLimit(32 * 1024), async (req, res) => {
    const stockId = String(req.params.id);
    const parsed = updateStockSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: fromZodError(parsed.error).toString() });
      return;
    }
    const expectedVersion = (() => {
      const header = req.headers['if-match'];
      if (!header || typeof header !== 'string') { return undefined; }
      const match = /^"?(\d+)"?$/.exec(header.trim());
      return match ? Number(match[1]) : undefined;
    })();
    try {
      const coerced = {
        ...parsed.data,
        unitPrice: parsed.data.unitPrice !== undefined
          ? (typeof parsed.data.unitPrice === 'number' ? parsed.data.unitPrice.toFixed(4) : parsed.data.unitPrice)
          : undefined,
      };
      const updated = await partsStorage.updateStock(stockId, coerced, expectedVersion);
      if (!updated) {
        res.status(404).json({ message: 'Stock row not found' });
        return;
      }
      res.setHeader('ETag', `"${updated.version}"`);
      res.json(updated);
    } catch (err) {
      if (err instanceof VersionConflictError) {
        res.status(409).json({
          error: 'Conflict',
          message: 'Stock row was modified by another request. Re-fetch and retry.',
          currentVersion: err.currentVersion,
        });
        return;
      }
      if (err instanceof StorageError) {
        logger.error('PATCH /api/projects/:pid/stock/:id failed', { message: err.message });
        res.status(500).json({ message: 'Failed to update stock' });
        return;
      }
      throw err;
    }
  });

  // DELETE /api/projects/:pid/stock/:id — soft-delete stock row
  app.delete('/api/projects/:pid/stock/:id', requireAuth, async (req, res) => {
    const stockId = String(req.params.id);
    try {
      const deleted = await partsStorage.deleteStock(stockId);
      if (!deleted) {
        res.status(404).json({ message: 'Stock row not found' });
        return;
      }
      res.status(204).end();
    } catch (err) {
      if (err instanceof StorageError) {
        logger.error('DELETE /api/projects/:pid/stock/:id failed', { message: err.message });
        res.status(500).json({ message: 'Failed to delete stock' });
        return;
      }
      throw err;
    }
  });

  // =========================================================================
  // Ingress endpoint — Phase 2
  // =========================================================================

  app.post(
    '/api/parts/ingress',
    requireAuth,
    payloadLimit(256 * 1024),
    requireProjectOwnershipIfScoped,
    async (req, res) => {
      const parsed = ingressRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: fromZodError(parsed.error).toString() });
        return;
      }

      try {
        const ingressReq: IngressRequest = {
          source: parsed.data.source as IngressSource,
          origin: parsed.data.origin,
          projectId: parsed.data.projectId,
          fields: {
            ...parsed.data.fields,
            meta: parsed.data.fields.meta ?? {},
            connectors: parsed.data.fields.connectors ?? [],
          },
          stock: parsed.data.stock,
          placement: parsed.data.placement,
        };
        const result = await ingressPart(ingressReq, db);
        res.status(201).json({
          partId: result.partId,
          slug: result.slug,
          created: result.created,
          reused: result.reused,
          stockId: result.stockId,
          placementId: result.placementId,
        });
      } catch (err) {
        if (err instanceof StorageError) {
          logger.error('parts-ingress: StorageError', { message: err.message });
          res.status(500).json({ message: 'Storage error during ingress' });
          return;
        }
        if (err instanceof HttpError) {
          res.status(err.status).json({ message: err.message });
          return;
        }
        logger.error('parts-ingress: unexpected error', {
          message: err instanceof Error ? err.message : String(err),
        });
        res.status(500).json({ message: 'Ingress failed' });
      }
    },
  );

  // -------------------------------------------------------------------------
  // Personal inventory (Phase 7.7) — part_stock with projectId = null
  // -------------------------------------------------------------------------

  // GET /api/parts/inventory/personal — list personal stock (no project)
  app.get('/api/parts/inventory/personal', validateSession, async (req, res) => {
    try {
      const stock = await partsStorage.listPersonalStock();
      res.json({ data: stock, total: stock.length });
    } catch (err) {
      if (err instanceof StorageError) {
        logger.error('GET /api/parts/inventory/personal failed', { message: err.message });
        res.status(500).json({ message: 'Failed to get personal inventory' });
        return;
      }
      throw err;
    }
  });

  // POST /api/parts/inventory/personal — add a part to personal stock
  app.post('/api/parts/inventory/personal', validateSession, async (req, res) => {
    const parsed = z.object({
      partId: z.string().uuid(),
      quantityOnHand: z.number().int().nonnegative().default(0),
      storageLocation: z.string().nullable().optional(),
      unitPrice: z.number().nonnegative().nullable().optional(),
      supplier: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    }).safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ message: fromZodError(parsed.error).toString() });
      return;
    }

    try {
      const stock = await partsStorage.upsertStock({
        projectId: null,
        partId: parsed.data.partId,
        quantityNeeded: 0,
        quantityOnHand: parsed.data.quantityOnHand,
        storageLocation: parsed.data.storageLocation ?? null,
        unitPrice: parsed.data.unitPrice != null ? String(parsed.data.unitPrice) : null,
        supplier: parsed.data.supplier ?? null,
        notes: parsed.data.notes ?? null,
        status: 'In Stock',
      });
      res.status(201).json(stock);
    } catch (err) {
      if (err instanceof StorageError) {
        logger.error('POST /api/parts/inventory/personal failed', { message: err.message });
        res.status(500).json({ message: 'Failed to add personal stock' });
        return;
      }
      throw err;
    }
  });
}
