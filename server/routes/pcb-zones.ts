import type { Express } from 'express';
import { fromZodError } from 'zod-validation-error';
import { storage } from '../storage';
import { insertPcbZoneSchema } from '@shared/schema';
import { asyncHandler, payloadLimit, parseIdParam } from './utils';
import { requireProjectOwnership } from './auth-middleware';

export function registerPcbZoneRoutes(app: Express): void {
  app.get(
    '/api/projects/:id/pcb-zones',
    requireProjectOwnership,
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const zones = await storage.getPcbZones(projectId);
      res.json(zones);
    }),
  );

  app.get(
    '/api/projects/:id/pcb-zones/:zoneId',
    requireProjectOwnership,
    asyncHandler(async (req, res) => {
      const zoneId = parseIdParam(req.params.zoneId);
      const zone = await storage.getPcbZone(zoneId);
      if (!zone) {
        return res.status(404).json({ message: 'PCB zone not found' });
      }
      res.json(zone);
    }),
  );

  app.post(
    '/api/projects/:id/pcb-zones',
    requireProjectOwnership,
    payloadLimit(128 * 1024), // Polygons can be large
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const parsed = insertPcbZoneSchema.omit({ projectId: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }
      const zone = await storage.createPcbZone({ ...parsed.data, projectId });
      res.status(201).json(zone);
    }),
  );

  app.patch(
    '/api/projects/:id/pcb-zones/:zoneId',
    requireProjectOwnership,
    payloadLimit(128 * 1024),
    asyncHandler(async (req, res) => {
      const zoneId = parseIdParam(req.params.zoneId);
      const parsed = insertPcbZoneSchema.partial().omit({ projectId: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }
      const updated = await storage.updatePcbZone(zoneId, parsed.data);
      if (!updated) {
        return res.status(404).json({ message: 'PCB zone not found' });
      }
      res.json(updated);
    }),
  );

  app.delete(
    '/api/projects/:id/pcb-zones/:zoneId',
    requireProjectOwnership,
    asyncHandler(async (req, res) => {
      const zoneId = parseIdParam(req.params.zoneId);
      const deleted = await storage.deletePcbZone(zoneId);
      if (!deleted) {
        return res.status(404).json({ message: 'PCB zone not found' });
      }
      res.status(204).end();
    }),
  );
}
