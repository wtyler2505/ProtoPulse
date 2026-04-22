import type { Express } from 'express';
import type { IStorage } from '../storage';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error/v3';
import {
  netSegmentSchema,
  netLabelSchema,
  netStyleSchema,
} from '@shared/circuit-schemas';
import { parseIdParam, payloadLimit, circuitPaginationSchema } from './utils';
import { requireCircuitOwnership } from '../routes/auth-middleware';

/**
 * Net payload schemas. `segments`/`labels`/`style` were previously `z.any()`
 * validation bypasses (task #45). Now typed against concrete shared schemas:
 *
 * - `segments` accepts any of three legitimate shapes via `z.union`:
 *   graph-edge (canonical `NetSegment` from `shared/circuit-types.ts`),
 *   line-segment `{x1,y1,x2,y2}` (apply-code layout path), and
 *   DSL placeholder `{irId}` (circuit-dsl output).
 * - `labels` validates against the `NetLabel` interface.
 * - `style` validates against the `NetStyle` interface.
 *
 * All nested schemas use `.passthrough()` so future optional fields on the
 * client don't break route validation without a coordinated deploy.
 */
const createNetSchema = z.object({
  name: z.string().min(1),
  netType: z.enum(['signal', 'power', 'ground', 'bus']).optional(),
  voltage: z.string().nullable().optional(),
  busWidth: z.number().int().positive().nullable().optional(),
  segments: z.array(netSegmentSchema).optional(),
  labels: z.array(netLabelSchema).optional(),
  style: netStyleSchema.optional(),
});

const updateNetSchema = z.object({
  name: z.string().min(1).optional(),
  netType: z.enum(['signal', 'power', 'ground', 'bus']).optional(),
  voltage: z.string().nullable().optional(),
  busWidth: z.number().int().positive().nullable().optional(),
  segments: z.array(netSegmentSchema).optional(),
  labels: z.array(netLabelSchema).optional(),
  style: netStyleSchema.optional(),
});

export function registerCircuitNetRoutes(app: Express, storage: IStorage): void {
  app.get('/api/circuits/:circuitId/nets', requireCircuitOwnership, async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const pagination = circuitPaginationSchema.safeParse(req.query);
    if (!pagination.success) {
      return res.status(400).json({ message: 'Invalid pagination: ' + fromZodError(pagination.error).toString() });
    }
    const { limit, offset, sort } = pagination.data;
    const all = await storage.getCircuitNets(circuitId);
    const sorted = sort === 'asc' ? all : [...all].reverse();
    const data = sorted.slice(offset, offset + limit);
    res.json({ data, total: all.length });
  });

  app.get('/api/circuits/:circuitId/nets/:id', requireCircuitOwnership, async (req, res) => {
    const id = parseIdParam(req.params.id);
    const net = await storage.getCircuitNet(id);
    if (!net) { return res.status(404).json({ message: 'Circuit net not found' }); }
    res.json(net);
  });

  app.post('/api/circuits/:circuitId/nets', requireCircuitOwnership, payloadLimit(64 * 1024), async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const parsed = createNetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
    }
    const data = {
      ...parsed.data,
      circuitId,
      segments: parsed.data.segments ?? [],
      labels: parsed.data.labels ?? [],
      style: parsed.data.style ?? {},
    };
    const net = await storage.createCircuitNet(data);
    res.status(201).json(net);
  });

  // BL-0638: Verify net belongs to the circuit before mutating
  app.patch('/api/circuits/:circuitId/nets/:id', requireCircuitOwnership, payloadLimit(64 * 1024), async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const id = parseIdParam(req.params.id);
    const existing = await storage.getCircuitNet(id);
    if (!existing || existing.circuitId !== circuitId) {
      return res.status(404).json({ message: 'Circuit net not found' });
    }
    const parsed = updateNetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
    }
    const updated = await storage.updateCircuitNet(id, parsed.data);
    if (!updated) { return res.status(404).json({ message: 'Circuit net not found' }); }
    res.json(updated);
  });

  // BL-0638: Verify net belongs to the circuit before deleting
  app.delete('/api/circuits/:circuitId/nets/:id', requireCircuitOwnership, async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const id = parseIdParam(req.params.id);
    const existing = await storage.getCircuitNet(id);
    if (!existing || existing.circuitId !== circuitId) {
      return res.status(404).json({ message: 'Circuit net not found' });
    }
    const deleted = await storage.deleteCircuitNet(id);
    if (!deleted) { return res.status(404).json({ message: 'Circuit net not found' }); }
    res.status(204).end();
  });
}
