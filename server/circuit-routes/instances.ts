import type { Express } from 'express';
import type { IStorage } from '../storage';
import type { CircuitInstanceRow } from '@shared/schema';
import type { PartMeta } from '@shared/component-types';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { parseIdParam, payloadLimit, circuitPaginationSchema } from './utils';
import { requireCircuitOwnership } from '../routes/auth-middleware';
import { getRefDesPrefix, nextRefdes } from '@shared/ref-des';

const createInstanceSchema = z.object({
  partId: z.number().int().positive().nullable().optional(),
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
  app.get('/api/circuits/:circuitId/instances', requireCircuitOwnership, async (req, res) => {
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
  });

  app.get('/api/circuits/:circuitId/instances/:id', requireCircuitOwnership, async (req, res) => {
    const id = parseIdParam(req.params.id);
    const instance = await storage.getCircuitInstance(id);
    if (!instance) { return res.status(404).json({ message: 'Circuit instance not found' }); }
    res.json(instance);
  });

  app.post('/api/circuits/:circuitId/instances', requireCircuitOwnership, payloadLimit(16 * 1024), async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const parsed = createInstanceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
    }

    // Auto-generate reference designator if not provided (or strip trailing '?')
    let refDes = parsed.data.referenceDesignator;
    if (refDes && refDes.endsWith('?')) {
      // Client sent a placeholder like "R?" — strip the '?' and let auto-increment resolve
      refDes = undefined;
    }
    if (!refDes) {
      const existing = await storage.getCircuitInstances(circuitId);
      const existingRefdes = existing.map((inst) => inst.referenceDesignator);
      // Derive prefix from the part's family metadata or properties
      let prefix = 'X';
      try {
        if (parsed.data.partId) {
          const design = await storage.getCircuitDesign(circuitId);
          if (design) {
            const part = await storage.getComponentPart(parsed.data.partId, design.projectId);
            if (part) {
              const meta = (part.meta ?? {}) as Partial<PartMeta>;
              prefix = getRefDesPrefix({ family: meta.family, tags: meta.tags });
            }
          }
        } else {
          // BL-0497: No partId — derive prefix from properties.componentTitle
          const props = parsed.data.properties ?? {};
          const title = (props.componentTitle ?? '').toLowerCase();
          const titlePrefix = getRefDesPrefix({ family: title, tags: title.split(/\s+/) });
          if (titlePrefix !== 'X') { prefix = titlePrefix; }
        }
      } catch {
        // If part lookup fails, fall back to 'X' prefix
      }
      refDes = nextRefdes(prefix, existingRefdes);
    }

    const data = { ...parsed.data, circuitId, referenceDesignator: refDes, properties: parsed.data.properties ?? {} };
    const instance = await storage.createCircuitInstance(data);
    res.status(201).json(instance);
  });

  // BL-0638: Verify instance belongs to the circuit before mutating
  app.patch('/api/circuits/:circuitId/instances/:id', requireCircuitOwnership, payloadLimit(16 * 1024), async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const id = parseIdParam(req.params.id);
    const existing = await storage.getCircuitInstance(id);
    if (!existing || existing.circuitId !== circuitId) {
      return res.status(404).json({ message: 'Circuit instance not found' });
    }
    const parsed = updateInstanceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
    }
    const updated = await storage.updateCircuitInstance(id, parsed.data);
    if (!updated) { return res.status(404).json({ message: 'Circuit instance not found' }); }
    res.json(updated);
  });

  // BL-0638: Verify instance belongs to the circuit before deleting
  app.delete('/api/circuits/:circuitId/instances/:id', requireCircuitOwnership, async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const id = parseIdParam(req.params.id);
    const existing = await storage.getCircuitInstance(id);
    if (!existing || existing.circuitId !== circuitId) {
      return res.status(404).json({ message: 'Circuit instance not found' });
    }
    const deleted = await storage.deleteCircuitInstance(id);
    if (!deleted) { return res.status(404).json({ message: 'Circuit instance not found' }); }
    res.status(204).end();
  });

  // ---------------------------------------------------------------------------
  // Push to PCB — forward annotation from schematic to PCB layout
  // ---------------------------------------------------------------------------

  app.post('/api/circuits/:circuitId/push-to-pcb', requireCircuitOwnership, payloadLimit(16 * 1024), async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const instances = await storage.getCircuitInstances(circuitId);

    if (instances.length === 0) {
      return res.status(400).json({ message: 'No instances in this circuit design' });
    }

    // Separate placed vs unplaced instances
    const unplaced = instances.filter((inst) => inst.pcbX == null || inst.pcbY == null);
    const alreadyPlaced = instances.length - unplaced.length;

    // Assign default positions in an "unplaced parts" area to the left of the board origin
    // Stack vertically with spacing, at negative X so they appear outside the board
    const UNPLACED_X = -30; // mm, left of board origin
    const START_Y = 5;      // mm
    const SPACING_Y = 15;   // mm between components

    const pushedInstances: CircuitInstanceRow[] = [];
    for (let i = 0; i < unplaced.length; i++) {
      const inst = unplaced[i]!;
      const updated = await storage.updateCircuitInstance(inst.id, {
        pcbX: UNPLACED_X,
        pcbY: START_Y + i * SPACING_Y,
        pcbRotation: 0,
        pcbSide: 'front',
      });
      if (updated) {
        pushedInstances.push(updated);
      }
    }

    res.json({
      pushed: pushedInstances.length,
      alreadyPlaced,
      total: instances.length,
      instances: pushedInstances,
    });
  });
}
