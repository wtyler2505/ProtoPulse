import type { Express } from 'express';
import type { IStorage } from '../storage';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error/v3';
import { insertCircuitWireSchema } from '@shared/schema';
import { parseIdParam, payloadLimit, circuitPaginationSchema } from './utils';
import { requireCircuitOwnership } from '../routes/auth-middleware';

const updateWireSchema = z.object({
  points: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
  layer: z.string().optional(),
  width: z.number().positive().optional(),
  color: z.string().nullable().optional(),
  wireType: z.enum(['wire', 'jump']).optional(),
  endpointMeta: z.record(z.unknown()).nullable().optional(),
  provenance: z.enum(['manual', 'synced', 'coach', 'jumper']).optional(),
});

export function registerCircuitWireRoutes(app: Express, storage: IStorage): void {
  app.get('/api/circuits/:circuitId/wires', requireCircuitOwnership, async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const pagination = circuitPaginationSchema.safeParse(req.query);
    if (!pagination.success) {
      return res.status(400).json({ message: 'Invalid pagination: ' + fromZodError(pagination.error).toString() });
    }
    const { limit, offset, sort } = pagination.data;
    const all = await storage.getCircuitWires(circuitId);
    const sorted = sort === 'asc' ? all : [...all].reverse();
    const data = sorted.slice(offset, offset + limit);
    res.json({ data, total: all.length });
  });

  app.post('/api/circuits/:circuitId/wires', requireCircuitOwnership, payloadLimit(16 * 1024), async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const parsed = insertCircuitWireSchema.safeParse({ ...req.body, circuitId });
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
    }
    const wire = await storage.createCircuitWire(parsed.data);
    res.status(201).json(wire);
  });

  // BL-0638: Wire PATCH/DELETE now scoped under circuit with ownership guard
  app.patch('/api/circuits/:circuitId/wires/:id', requireCircuitOwnership, payloadLimit(16 * 1024), async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const id = parseIdParam(req.params.id);
    const parsed = updateWireSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
    }
    // Verify wire belongs to this circuit
    const existing = await storage.getCircuitWire(id);
    if (!existing || existing.circuitId !== circuitId) {
      return res.status(404).json({ message: 'Wire not found' });
    }
    const updated = await storage.updateCircuitWire(id, parsed.data);
    if (!updated) { return res.status(404).json({ message: 'Wire not found' }); }
    res.json(updated);
  });

  // BL-0638: Wire DELETE now scoped under circuit with ownership guard
  app.delete('/api/circuits/:circuitId/wires/:id', requireCircuitOwnership, async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const id = parseIdParam(req.params.id);
    // Verify wire belongs to this circuit
    const existing = await storage.getCircuitWire(id);
    if (!existing || existing.circuitId !== circuitId) {
      return res.status(404).json({ message: 'Wire not found' });
    }
    const deleted = await storage.deleteCircuitWire(id);
    if (!deleted) { return res.status(404).json({ message: 'Wire not found' }); }
    res.status(204).end();
  });
}
