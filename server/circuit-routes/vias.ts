import type { Express } from 'express';
import type { IStorage } from '../storage';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { insertCircuitViaSchema } from '@shared/schema';
import { asyncHandler, parseIdParam, payloadLimit, circuitPaginationSchema } from './utils';
import { requireCircuitOwnership } from '../routes/auth-middleware';

const updateViaSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  outerDiameter: z.number().positive().optional(),
  drillDiameter: z.number().positive().optional(),
  viaType: z.enum(['through', 'blind', 'buried', 'micro']).optional(),
  layerStart: z.string().optional(),
  layerEnd: z.string().optional(),
  tented: z.boolean().optional(),
});

export function registerCircuitViaRoutes(app: Express, storage: IStorage): void {
  // BL-0638: All via routes now require circuit ownership
  app.get('/api/circuits/:circuitId/vias', requireCircuitOwnership, asyncHandler(async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const pagination = circuitPaginationSchema.safeParse(req.query);
    if (!pagination.success) {
      return res.status(400).json({ message: 'Invalid pagination: ' + fromZodError(pagination.error).toString() });
    }
    const { limit, offset, sort } = pagination.data;
    const all = await storage.getCircuitVias(circuitId);
    const sorted = sort === 'asc' ? all : [...all].reverse();
    const data = sorted.slice(offset, offset + limit);
    res.json({ data, total: all.length });
  }));

  app.post('/api/circuits/:circuitId/vias', requireCircuitOwnership, payloadLimit(16 * 1024), asyncHandler(async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const parsed = insertCircuitViaSchema.safeParse({ ...req.body, circuitId });
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
    }
    const via = await storage.createCircuitVia(parsed.data);
    res.status(201).json(via);
  }));

  app.post('/api/circuits/:circuitId/vias/bulk', requireCircuitOwnership, payloadLimit(512 * 1024), asyncHandler(async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const parsed = z.array(insertCircuitViaSchema.omit({ circuitId: true })).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
    }
    const viasToInsert = parsed.data.map(v => ({ ...v, circuitId }));
    const vias = await storage.createCircuitVias(viasToInsert);
    res.status(201).json({ count: vias.length, data: vias });
  }));

  // BL-0638: Via PATCH/DELETE now scoped under circuit with ownership guard
  app.patch('/api/circuits/:circuitId/vias/:id', requireCircuitOwnership, payloadLimit(16 * 1024), asyncHandler(async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const id = parseIdParam(req.params.id);
    const parsed = updateViaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
    }
    // Verify via belongs to this circuit
    const existing = await storage.getCircuitVia(id);
    if (!existing || existing.circuitId !== circuitId) {
      return res.status(404).json({ message: 'Via not found' });
    }
    const updated = await storage.updateCircuitVia(id, parsed.data);
    res.json(updated);
  }));

  // BL-0638: Via DELETE now scoped under circuit with ownership guard
  app.delete('/api/circuits/:circuitId/vias/:id', requireCircuitOwnership, asyncHandler(async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const id = parseIdParam(req.params.id);
    // Verify via belongs to this circuit
    const existing = await storage.getCircuitVia(id);
    if (!existing || existing.circuitId !== circuitId) {
      return res.status(404).json({ message: 'Via not found' });
    }
    const deleted = await storage.deleteCircuitVia(id);
    if (!deleted) { return res.status(404).json({ message: 'Via not found' }); }
    res.status(204).end();
  }));
}
