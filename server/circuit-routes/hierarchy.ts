import type { Express } from 'express';
import type { IStorage } from '../storage';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { insertHierarchicalPortSchema } from '@shared/schema';
import { asyncHandler, parseIdParam, payloadLimit } from './utils';

const updateHierarchicalPortSchema = z.object({
  portName: z.string().min(1).optional(),
  direction: z.enum(['input', 'output', 'bidirectional']).optional(),
  netName: z.string().nullable().optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
});

export function registerCircuitHierarchyRoutes(app: Express, storage: IStorage): void {
  // Get child designs of a given design
  app.get('/api/projects/:projectId/circuits/:designId/children', asyncHandler(async (req, res) => {
    const designId = parseIdParam(req.params.designId);
    const children = await storage.getChildDesigns(designId);
    res.json({ data: children, total: children.length });
  }));

  // Get root designs (no parent) for a project
  app.get('/api/projects/:projectId/circuits/roots', asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const roots = await storage.getRootDesigns(projectId);
    res.json({ data: roots, total: roots.length });
  }));

  // Get ports for a design
  app.get('/api/projects/:projectId/circuits/:designId/ports', asyncHandler(async (req, res) => {
    const designId = parseIdParam(req.params.designId);
    const ports = await storage.getHierarchicalPorts(designId);
    res.json({ data: ports, total: ports.length });
  }));

  // Create a port on a design
  app.post('/api/projects/:projectId/circuits/:designId/ports', payloadLimit(8 * 1024), asyncHandler(async (req, res) => {
    const designId = parseIdParam(req.params.designId);
    const parsed = insertHierarchicalPortSchema.safeParse({ ...req.body, designId });
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
    }
    const port = await storage.createHierarchicalPort(parsed.data);
    res.status(201).json(port);
  }));

  // Update a port
  app.patch('/api/projects/:projectId/circuits/:designId/ports/:portId', payloadLimit(8 * 1024), asyncHandler(async (req, res) => {
    const portId = parseIdParam(req.params.portId);
    const parsed = updateHierarchicalPortSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
    }
    const updated = await storage.updateHierarchicalPort(portId, parsed.data);
    if (!updated) { return res.status(404).json({ message: 'Hierarchical port not found' }); }
    res.json(updated);
  }));

  // Delete a port
  app.delete('/api/projects/:projectId/circuits/:designId/ports/:portId', asyncHandler(async (req, res) => {
    const portId = parseIdParam(req.params.portId);
    const deleted = await storage.deleteHierarchicalPort(portId);
    if (!deleted) { return res.status(404).json({ message: 'Hierarchical port not found' }); }
    res.status(204).end();
  }));
}
