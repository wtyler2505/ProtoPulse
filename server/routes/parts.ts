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
import { storage, StorageError } from '../storage';
import { db } from '../db';
import { HttpError, payloadLimit } from './utils';
import { ingressPart, type IngressRequest, type IngressSource } from '../parts-ingress';
import { PART_ORIGINS, ASSEMBLY_CATEGORIES, TRUST_LEVELS, PLACEMENT_SURFACES, PLACEMENT_CONTAINER_TYPES } from '@shared/parts/part-row';
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
}
