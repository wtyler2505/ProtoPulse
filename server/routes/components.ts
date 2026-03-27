import type { Express } from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { storage } from '../storage';
import { insertComponentPartSchema, insertComponentLibrarySchema } from '@shared/schema';
import type { PartMeta, Connector, PartViews, Bus, Constraint, PartState } from '@shared/component-types';
import { runDRC, getDefaultDRCRules } from '@shared/drc-engine';
import { exportToFzpz, importFromFzpz } from '../component-export';
import { parseSvgToShapes } from '../svg-parser';
import { getApiKey } from '../auth';
import { asyncHandler, payloadLimit, parseIdParam, HttpError } from './utils';
import { requireProjectOwnership } from './auth-middleware';
import { setCacheHeaders } from '../lib/cache-headers';

async function resolveGeminiApiKey(clientKey: string | undefined, userId: number | undefined): Promise<string> {
  if (clientKey && clientKey.length > 0) {
    return clientKey;
  }
  if (userId) {
    const storedKey = await getApiKey(userId, 'gemini');
    if (storedKey) {
      return storedKey;
    }
  }
  throw new HttpError('No Gemini API key available. Set one in Settings or provide it in the request.', 400);
}

export function registerComponentRoutes(app: Express): void {
  // --- Component Parts CRUD ---

  app.get(
    '/api/projects/:projectId/component-parts',
    requireProjectOwnership,
    setCacheHeaders('project_data'),
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.projectId);
      const parts = await storage.getComponentParts(projectId);
      res.json({ data: parts, total: parts.length });
    }),
  );

  app.get(
    '/api/projects/:projectId/component-parts/by-node/:nodeId',
    requireProjectOwnership,
    setCacheHeaders('project_data'),
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.projectId);
      const nodeId = Array.isArray(req.params.nodeId) ? req.params.nodeId[0] : req.params.nodeId;
      const part = await storage.getComponentPartByNodeId(projectId, nodeId);
      if (!part) {
        return res.status(404).json({ message: 'Component part not found' });
      }
      res.json(part);
    }),
  );

  app.get(
    '/api/projects/:projectId/component-parts/:id',
    requireProjectOwnership,
    setCacheHeaders('project_data'),
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.projectId);
      const id = parseIdParam(req.params.id);
      const part = await storage.getComponentPart(id, projectId);
      if (!part) {
        return res.status(404).json({ message: 'Component part not found' });
      }
      res.json(part);
    }),
  );

  app.post(
    '/api/projects/:projectId/component-parts',
    requireProjectOwnership,
    payloadLimit(32 * 1024),
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.projectId);
      const parsed = insertComponentPartSchema.omit({ projectId: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }
      const part = await storage.createComponentPart({ ...parsed.data, projectId });
      res.status(201).json(part);
    }),
  );

  app.patch(
    '/api/projects/:projectId/component-parts/:id',
    requireProjectOwnership,
    payloadLimit(32 * 1024),
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.projectId);
      const id = parseIdParam(req.params.id);
      const parsed = insertComponentPartSchema.partial().omit({ projectId: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }
      const updated = await storage.updateComponentPart(id, projectId, parsed.data);
      if (!updated) {
        return res.status(404).json({ message: 'Component part not found' });
      }
      res.json(updated);
    }),
  );

  app.delete(
    '/api/projects/:projectId/component-parts/:id',
    requireProjectOwnership,
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.projectId);
      const id = parseIdParam(req.params.id);
      const deleted = await storage.deleteComponentPart(id, projectId);
      if (!deleted) {
        return res.status(404).json({ message: 'Component part not found' });
      }
      res.status(204).end();
    }),
  );

  // --- FZPZ Export ---

  app.get(
    '/api/projects/:projectId/component-parts/:id/export/fzpz',
    requireProjectOwnership,
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.projectId);
      const id = parseIdParam(req.params.id);
      const part = await storage.getComponentPart(id, projectId);
      if (!part) {
        return res.status(404).json({ message: 'Component part not found' });
      }

      const partState = {
        meta: part.meta as PartMeta,
        connectors: part.connectors as Connector[],
        buses: part.buses as Bus[],
        views: part.views as PartViews,
      };

      const zipBuffer = await exportToFzpz(partState);
      const filename = (partState.meta.title || 'component').replace(/[^a-zA-Z0-9_-]/g, '_');
      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}.fzpz"`,
      });
      res.send(zipBuffer);
    }),
  );

  // --- FZPZ Import ---

  app.post(
    '/api/projects/:projectId/component-parts/import/fzpz',
    requireProjectOwnership,
    payloadLimit(5 * 1024 * 1024),
    asyncHandler(async (req, res) => {
      let buffer: Buffer;
      if (Buffer.isBuffer(req.body)) {
        buffer = req.body;
      } else if (typeof req.body === 'string') {
        buffer = Buffer.from(req.body, 'binary');
      } else {
        const chunks: Buffer[] = [];
        let totalSize = 0;
        for await (const chunk of req) {
          totalSize += chunk.length;
          if (totalSize > 5 * 1024 * 1024) {
            return res.status(400).json({ message: 'File too large (max 5MB)' });
          }
          chunks.push(Buffer.from(chunk));
        }
        buffer = Buffer.concat(chunks);
      }

      if (buffer.length === 0) {
        return res.status(400).json({ message: 'No file data provided' });
      }

      const projectId = parseIdParam(req.params.projectId);
      const partState = await importFromFzpz(buffer);

      const part = await storage.createComponentPart({
        projectId,
        meta: partState.meta,
        connectors: partState.connectors,
        buses: partState.buses,
        views: partState.views,
        constraints: [],
      });
      res.status(201).json(part);
    }),
  );

  // --- SVG Import ---

  app.post(
    '/api/projects/:projectId/component-parts/:id/import/svg',
    requireProjectOwnership,
    payloadLimit(2 * 1024 * 1024),
    asyncHandler(async (req, res) => {
      const svgContent = typeof req.body === 'string' ? req.body : '';

      if (!svgContent || svgContent.trim().length === 0) {
        return res.status(400).json({ message: 'No SVG content provided. Send raw SVG with Content-Type: text/xml' });
      }

      try {
        const shapes = parseSvgToShapes(svgContent);
        res.json({ shapes });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Invalid SVG content';
        res.status(400).json({ message });
      }
    }),
  );

  // --- Component Library ---

  app.get(
    '/api/component-library',
    setCacheHeaders('component_library'),
    asyncHandler(async (req, res) => {
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const category = typeof req.query.category === 'string' ? req.query.category : undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const result = await storage.getLibraryEntries({ search, category, page, limit });
      res.json(result);
    }),
  );

  app.get(
    '/api/component-library/:id',
    setCacheHeaders('component_library'),
    asyncHandler(async (req, res) => {
      const id = parseIdParam(req.params.id);
      const entry = await storage.getLibraryEntry(id);
      if (!entry) {
        return res.status(404).json({ message: 'Library entry not found' });
      }
      res.json(entry);
    }),
  );

  app.post(
    '/api/component-library',
    asyncHandler(async (req, res) => {
      const parsed = insertComponentLibrarySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).message });
      }
      const entry = await storage.createLibraryEntry({
        ...parsed.data,
        authorId: req.userId != null ? String(req.userId) : (parsed.data.authorId ?? null),
      });
      res.status(201).json(entry);
    }),
  );

  app.delete(
    '/api/component-library/:id',
    asyncHandler(async (req, res) => {
      const id = parseIdParam(req.params.id);
      const deleted = await storage.deleteLibraryEntry(id);
      if (!deleted) {
        return res.status(404).json({ message: 'Library entry not found' });
      }
      res.status(204).end();
    }),
  );

  app.post(
    '/api/component-library/:id/fork',
    asyncHandler(async (req, res) => {
      const id = parseIdParam(req.params.id);
      const forkSchema = z.object({ projectId: z.number().int().positive() });
      const parsed = forkSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid projectId' });
      }
      const projectId = parsed.data.projectId;
      const entry = await storage.getLibraryEntry(id);
      if (!entry) {
        return res.status(404).json({ message: 'Library entry not found' });
      }
      const part = await storage.createComponentPart({
        projectId,
        meta: entry.meta as PartMeta,
        connectors: entry.connectors as Connector[],
        buses: entry.buses as Bus[],
        views: entry.views as PartViews,
        constraints: entry.constraints as Constraint[],
      });
      await storage.incrementLibraryDownloads(id);
      res.status(201).json(part);
    }),
  );

  // --- DRC Check ---

  const drcRequestSchema = z.object({
    view: z.enum(['breadboard', 'schematic', 'pcb']).default('pcb'),
    rules: z
      .array(
        z.object({
          type: z.enum([
            'min-clearance',
            'min-trace-width',
            'courtyard-overlap',
            'pin-spacing',
            'pad-size',
            'silk-overlap',
          ]),
          params: z.record(z.number()),
          severity: z.enum(['error', 'warning']),
          enabled: z.boolean(),
        }),
      )
      .optional(),
  });

  app.post(
    '/api/projects/:projectId/component-parts/:id/drc',
    requireProjectOwnership,
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.projectId);
      const id = parseIdParam(req.params.id);
      const part = await storage.getComponentPart(id, projectId);
      if (!part) {
        return res.status(404).json({ message: 'Component part not found' });
      }

      const parsed = drcRequestSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid DRC request: ' + fromZodError(parsed.error).toString() });
      }

      const partState: PartState = {
        meta: part.meta as PartMeta,
        connectors: (part.connectors as Connector[]) || [],
        buses: (part.buses as Bus[]) || [],
        views: part.views as PartViews,
        constraints: (part.constraints as Constraint[]) || [],
      };

      const rules = parsed.data.rules ?? getDefaultDRCRules();
      const violations = runDRC(partState, rules, parsed.data.view);

      res.json({ violations, checkedAt: new Date().toISOString() });
    }),
  );

  // --- Component AI Operations ---

  const generateBodySchema = z.object({
    description: z.string().min(1).max(10000),
    apiKey: z.string().max(500).optional(),
    imageBase64: z.string().optional(),
    imageMimeType: z.string().optional(),
  });

  app.post(
    '/api/projects/:projectId/component-parts/ai/generate',
    requireProjectOwnership,
    payloadLimit(5 * 1024 * 1024),
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.projectId);
      const parsed = generateBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
      }
      const { description, apiKey: clientApiKey, imageBase64, imageMimeType } = parsed.data;
      const apiKey = await resolveGeminiApiKey(clientApiKey, req.userId);

      const { generatePartFromDescription } = await import('../component-ai');
      const partState = await generatePartFromDescription(apiKey, description.trim(), imageBase64, imageMimeType);
      const part = await storage.createComponentPart({
        projectId,
        meta: partState.meta,
        connectors: partState.connectors,
        buses: partState.buses,
        views: partState.views,
        constraints: partState.constraints || [],
      });
      res.status(201).json(part);
    }),
  );

  const modifyBodySchema = z.object({
    instruction: z.string().min(1).max(10000),
    apiKey: z.string().max(500).optional(),
    currentPart: z.any().optional(),
  });

  app.post(
    '/api/projects/:projectId/component-parts/:id/ai/modify',
    requireProjectOwnership,
    payloadLimit(64 * 1024),
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.projectId);
      const id = parseIdParam(req.params.id);
      const parsed = modifyBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
      }
      const { instruction, apiKey: clientApiKey, currentPart } = parsed.data;
      const apiKey = await resolveGeminiApiKey(clientApiKey, req.userId);

      let partState: PartState;
      if (currentPart) {
        partState = currentPart as PartState;
      } else {
        const part = await storage.getComponentPart(id, projectId);
        if (!part) {
          return res.status(404).json({ message: 'Component part not found' });
        }
        partState = {
          meta: part.meta as PartMeta,
          connectors: (part.connectors as Connector[]) || [],
          buses: (part.buses as Bus[]) || [],
          views: part.views as PartViews,
          constraints: (part.constraints as Constraint[]) || [],
        };
      }

      const { modifyPartWithAI } = await import('../component-ai');
      const modified = await modifyPartWithAI(apiKey, partState, instruction.trim());
      res.json(modified);
    }),
  );

  const extractBodySchema = z.object({
    apiKey: z.string().max(500).optional(),
    imageBase64: z.string().min(1),
    mimeType: z.string().optional(),
  });

  app.post(
    '/api/projects/:projectId/component-parts/:id/ai/extract',
    requireProjectOwnership,
    payloadLimit(10 * 1024 * 1024),
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.projectId);
      const id = parseIdParam(req.params.id);
      const parsed = extractBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
      }
      const { apiKey: clientApiKey, imageBase64, mimeType } = parsed.data;
      const apiKey = await resolveGeminiApiKey(clientApiKey, req.userId);

      const { extractMetadataFromDatasheet } = await import('../component-ai');
      const metadata = await extractMetadataFromDatasheet(apiKey, imageBase64, mimeType || 'image/png');
      res.json(metadata);
    }),
  );

  const suggestBodySchema = z.object({
    apiKey: z.string().max(500).optional(),
    meta: z.any(),
  });

  app.post(
    '/api/projects/:projectId/component-parts/:id/ai/suggest',
    requireProjectOwnership,
    payloadLimit(16 * 1024),
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.projectId);
      const id = parseIdParam(req.params.id);
      const parsed = suggestBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
      }
      const { apiKey: clientApiKey, meta } = parsed.data;
      const apiKey = await resolveGeminiApiKey(clientApiKey, req.userId);

      const { suggestDescription } = await import('../component-ai');
      const description = await suggestDescription(apiKey, meta);
      res.json({ description });
    }),
  );

  const extractPinsBodySchema = z.object({
    apiKey: z.string().max(500).optional(),
    imageBase64: z.string().min(1),
    mimeType: z.string().optional(),
    existingMeta: z.any().optional(),
  });

  app.post(
    '/api/projects/:projectId/component-parts/:id/ai/extract-pins',
    requireProjectOwnership,
    payloadLimit(10 * 1024 * 1024),
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.projectId);
      const id = parseIdParam(req.params.id);
      const parsed = extractPinsBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
      }
      const { apiKey: clientApiKey, imageBase64, mimeType, existingMeta } = parsed.data;
      const apiKey = await resolveGeminiApiKey(clientApiKey, req.userId);

      const { extractPinsFromPhoto } = await import('../component-ai');
      const connectors = await extractPinsFromPhoto(apiKey, imageBase64, mimeType || 'image/png', existingMeta);
      res.json({ connectors });
    }),
  );
}
