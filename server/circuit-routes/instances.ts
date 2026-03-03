import type { Express } from 'express';
import type { IStorage } from '../storage';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { asyncHandler, parseIdParam, payloadLimit, circuitPaginationSchema } from './utils';

const createInstanceSchema = z.object({
  partId: z.number().int().positive(),
  referenceDesignator: z.string().min(1),
  schematicX: z.number().optional(),
  schematicY: z.number().optional(),
  schematicRotation: z.number().optional(),
  breadboardX: z.number().nullable().optional(),
  breadboardY: z.number().nullable().optional(),
  breadboardRotation: z.number().nullable().optional(),
  pcbX: z.number().nullable().optional(),
  pcbY: z.number().nullable().optional(),
  pcbRotation: z.number().nullable().optional(),
  pcbSide: z.enum(['front', 'back']).optional(),
  properties: z.record(z.string()).optional(),
});

const updateInstanceSchema = z.object({
  referenceDesignator: z.string().min(1).optional(),
  schematicX: z.number().optional(),
  schematicY: z.number().optional(),
  schematicRotation: z.number().optional(),
  breadboardX: z.number().nullable().optional(),
  breadboardY: z.number().nullable().optional(),
  breadboardRotation: z.number().nullable().optional(),
  pcbX: z.number().nullable().optional(),
  pcbY: z.number().nullable().optional(),
  pcbRotation: z.number().nullable().optional(),
  pcbSide: z.enum(['front', 'back']).optional(),
  properties: z.record(z.string()).optional(),
});

export function registerCircuitInstanceRoutes(app: Express, storage: IStorage): void {
  app.get('/api/circuits/:circuitId/instances', asyncHandler(async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const pagination = circuitPaginationSchema.safeParse(req.query);
    if (!pagination.success) {
      return res.status(400).json({ message: 'Invalid pagination: ' + fromZodError(pagination.error).toString() });
    }
    const { limit, offset, sort } = pagination.data;
    const all = await storage.getCircuitInstances(circuitId);
    const sorted = sort === 'asc' ? all : [...all].reverse();
    const data = sorted.slice(offset, offset + limit);
    res.json({ data, total: all.length });
  }));

  app.get('/api/circuits/:circuitId/instances/:id', asyncHandler(async (req, res) => {
    const id = parseIdParam(req.params.id);
    const instance = await storage.getCircuitInstance(id);
    if (!instance) { return res.status(404).json({ message: 'Circuit instance not found' }); }
    res.json(instance);
  }));

  app.post('/api/circuits/:circuitId/instances', payloadLimit(16 * 1024), asyncHandler(async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const parsed = createInstanceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
    }
    const data = { ...parsed.data, circuitId, properties: parsed.data.properties ?? {} };
    const instance = await storage.createCircuitInstance(data);
    res.status(201).json(instance);
  }));

  app.patch('/api/circuits/:circuitId/instances/:id', payloadLimit(16 * 1024), asyncHandler(async (req, res) => {
    const id = parseIdParam(req.params.id);
    const parsed = updateInstanceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
    }
    const updated = await storage.updateCircuitInstance(id, parsed.data);
    if (!updated) { return res.status(404).json({ message: 'Circuit instance not found' }); }
    res.json(updated);
  }));

  app.delete('/api/circuits/:circuitId/instances/:id', asyncHandler(async (req, res) => {
    const id = parseIdParam(req.params.id);
    const deleted = await storage.deleteCircuitInstance(id);
    if (!deleted) { return res.status(404).json({ message: 'Circuit instance not found' }); }
    res.status(204).end();
  }));
}
