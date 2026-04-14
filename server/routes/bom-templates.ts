/**
 * BOM template routes — Phase 7.6.
 *
 * GET    /api/bom-templates            — list user's templates
 * POST   /api/bom-templates            — create template (with items)
 * GET    /api/bom-templates/:id        — get template with items
 * PATCH  /api/bom-templates/:id        — update name/description/tags
 * DELETE /api/bom-templates/:id        — soft-delete template
 * POST   /api/bom-templates/:id/apply  — apply template to a project (creates part_stock rows)
 */

import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { validateSession } from '../auth';
import { bomTemplateStorage, partsStorage, storage, StorageError } from '../storage';
import { ingressPart, type IngressRequest } from '../parts-ingress';
import { db } from '../db';
import { logger } from '../logger';

const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  tags: z.array(z.string()).max(20).optional(),
  items: z.array(z.object({
    partId: z.string().uuid(),
    quantityNeeded: z.number().int().nonnegative().default(1),
    unitPrice: z.number().nonnegative().nullable().optional(),
    supplier: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  })).min(1).max(500),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  tags: z.array(z.string()).max(20).optional(),
});

const applyTemplateSchema = z.object({
  projectId: z.number().int().positive(),
});

export function registerBomTemplateRoutes(app: Express): void {
  // GET /api/bom-templates
  app.get('/api/bom-templates', validateSession, async (req: Request, res: Response) => {
    try {
      const session = (req as unknown as Record<string, unknown>).session as { userId: number };
      const templates = await bomTemplateStorage.getTemplates(session.userId);
      res.json({ data: templates, total: templates.length });
    } catch (err) {
      if (err instanceof StorageError) {
        logger.error('GET /api/bom-templates failed', { message: err.message });
        res.status(500).json({ message: 'Failed to get templates' });
        return;
      }
      throw err;
    }
  });

  // POST /api/bom-templates
  app.post('/api/bom-templates', validateSession, async (req: Request, res: Response) => {
    const parsed = createTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: fromZodError(parsed.error).toString() });
      return;
    }

    try {
      const session = (req as unknown as Record<string, unknown>).session as { userId: number };
      const { items, ...templateData } = parsed.data;

      const template = await bomTemplateStorage.createTemplate({
        ...templateData,
        userId: session.userId,
      });

      const itemCount = await bomTemplateStorage.addItems(
        template.id,
        items.map((item) => ({
          partId: item.partId,
          quantityNeeded: item.quantityNeeded,
          unitPrice: item.unitPrice != null ? String(item.unitPrice) : null,
          supplier: item.supplier ?? null,
          notes: item.notes ?? null,
        })),
      );

      res.status(201).json({ ...template, itemCount });
    } catch (err) {
      if (err instanceof StorageError) {
        logger.error('POST /api/bom-templates failed', { message: err.message });
        res.status(500).json({ message: 'Failed to create template' });
        return;
      }
      throw err;
    }
  });

  // GET /api/bom-templates/:id
  app.get('/api/bom-templates/:id', validateSession, async (req: Request, res: Response) => {
    const templateId = String(req.params.id);
    try {
      const session = (req as unknown as Record<string, unknown>).session as { userId: number };
      const template = await bomTemplateStorage.getTemplateWithItems(templateId);
      if (!template) {
        res.status(404).json({ message: 'Template not found' });
        return;
      }
      // SECURITY (WS-01): enforce userId-scoped access. The storage method
      // looks up by id only, so we must check ownership at the route layer
      // (use 404 to avoid leaking template existence across users).
      if (template.userId !== session.userId) {
        res.status(404).json({ message: 'Template not found' });
        return;
      }
      res.json(template);
    } catch (err) {
      if (err instanceof StorageError) {
        logger.error('GET /api/bom-templates/:id failed', { message: err.message });
        res.status(500).json({ message: 'Failed to get template' });
        return;
      }
      throw err;
    }
  });

  // PATCH /api/bom-templates/:id
  app.patch('/api/bom-templates/:id', validateSession, async (req: Request, res: Response) => {
    const templateId = String(req.params.id);
    const parsed = updateTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: fromZodError(parsed.error).toString() });
      return;
    }

    try {
      const session = (req as unknown as Record<string, unknown>).session as { userId: number };
      const { description, ...rest } = parsed.data;
      const updates = { ...rest, ...(description !== undefined ? { description: description ?? undefined } : {}) };
      const updated = await bomTemplateStorage.updateTemplate(templateId, session.userId, updates);
      if (!updated) {
        res.status(404).json({ message: 'Template not found' });
        return;
      }
      res.json(updated);
    } catch (err) {
      if (err instanceof StorageError) {
        logger.error('PATCH /api/bom-templates/:id failed', { message: err.message });
        res.status(500).json({ message: 'Failed to update template' });
        return;
      }
      throw err;
    }
  });

  // DELETE /api/bom-templates/:id
  app.delete('/api/bom-templates/:id', validateSession, async (req: Request, res: Response) => {
    const templateId = String(req.params.id);
    try {
      const session = (req as unknown as Record<string, unknown>).session as { userId: number };
      const deleted = await bomTemplateStorage.deleteTemplate(templateId, session.userId);
      if (!deleted) {
        res.status(404).json({ message: 'Template not found' });
        return;
      }
      res.status(204).send();
    } catch (err) {
      if (err instanceof StorageError) {
        logger.error('DELETE /api/bom-templates/:id failed', { message: err.message });
        res.status(500).json({ message: 'Failed to delete template' });
        return;
      }
      throw err;
    }
  });

  // POST /api/bom-templates/:id/apply — load template into a project
  app.post('/api/bom-templates/:id/apply', validateSession, async (req: Request, res: Response) => {
    const templateId = String(req.params.id);
    const parsed = applyTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: fromZodError(parsed.error).toString() });
      return;
    }

    try {
      const session = (req as unknown as Record<string, unknown>).session as { userId: number };
      const isOwner = await storage.isProjectOwner(parsed.data.projectId, session.userId);
      if (!isOwner) {
        res.status(403).json({ message: 'Not authorized to modify this project' });
        return;
      }

      const template = await bomTemplateStorage.getTemplateWithItems(templateId);
      if (!template) {
        res.status(404).json({ message: 'Template not found' });
        return;
      }
      // SECURITY (WS-01): template ownership is user-scoped.
      if (template.userId !== session.userId) {
        res.status(404).json({ message: 'Template not found' });
        return;
      }

      // For each template item, ensure the part has stock in the target project
      let created = 0;
      for (const item of template.items) {
        const existing = await partsStorage.getStock(parsed.data.projectId, item.partId);
        if (!existing) {
          await partsStorage.upsertStock({
            projectId: parsed.data.projectId,
            partId: item.partId,
            quantityNeeded: item.quantityNeeded,
            unitPrice: item.unitPrice,
            supplier: item.supplier,
            status: 'In Stock',
          });
          created++;
        }
      }

      res.json({
        message: `Applied template "${template.name}" — ${created} new stock rows created`,
        created,
        skipped: template.items.length - created,
      });
    } catch (err) {
      if (err instanceof StorageError) {
        logger.error('POST /api/bom-templates/:id/apply failed', { message: err.message });
        res.status(500).json({ message: 'Failed to apply template' });
        return;
      }
      throw err;
    }
  });
}
