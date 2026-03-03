import type { Express } from 'express';
import type { IStorage } from '../storage';
import { VersionConflictError } from '../storage';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { insertCircuitDesignSchema } from '@shared/schema';
import { asyncHandler, parseIdParam, payloadLimit } from './utils';

const updateCircuitDesignSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  settings: z.any().optional(),
});

/** Parse the If-Match header value into a version number, or undefined if absent/invalid. */
function parseIfMatch(header: string | undefined): number | undefined {
  if (!header) { return undefined; }
  const match = /^"?(\d+)"?$/.exec(header.trim());
  return match ? Number(match[1]) : undefined;
}

export function registerCircuitDesignRoutes(app: Express, storage: IStorage): void {
  app.get('/api/projects/:projectId/circuits', asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const circuits = await storage.getCircuitDesigns(projectId);
    res.json({ data: circuits, total: circuits.length });
  }));

  app.get('/api/projects/:projectId/circuits/:id', asyncHandler(async (req, res) => {
    const id = parseIdParam(req.params.id);
    const circuit = await storage.getCircuitDesign(id);
    if (!circuit) { return res.status(404).json({ message: 'Circuit design not found' }); }
    res.setHeader('ETag', `"${circuit.version}"`);
    res.json(circuit);
  }));

  app.post('/api/projects/:projectId/circuits', payloadLimit(16 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const parsed = insertCircuitDesignSchema.safeParse({ ...req.body, projectId });
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
    }
    const circuit = await storage.createCircuitDesign(parsed.data);
    res.setHeader('ETag', `"${circuit.version}"`);
    res.status(201).json(circuit);
  }));

  app.patch('/api/projects/:projectId/circuits/:id', payloadLimit(16 * 1024), asyncHandler(async (req, res) => {
    const id = parseIdParam(req.params.id);
    const parsed = updateCircuitDesignSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
    }
    const expectedVersion = parseIfMatch(req.headers['if-match'] as string | undefined);
    try {
      const updated = await storage.updateCircuitDesign(id, parsed.data, expectedVersion);
      if (!updated) { return res.status(404).json({ message: 'Circuit design not found' }); }
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
  }));

  app.delete('/api/projects/:projectId/circuits/:id', asyncHandler(async (req, res) => {
    const id = parseIdParam(req.params.id);
    const deleted = await storage.deleteCircuitDesign(id);
    if (!deleted) { return res.status(404).json({ message: 'Circuit design not found' }); }
    res.status(204).end();
  }));
}
