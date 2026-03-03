import type { Express } from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { storage } from '../storage';
import { asyncHandler, payloadLimit, parseIdParam } from './utils';
import { computeArchDiff } from '@shared/arch-diff';
import type { ArchitectureNode, ArchitectureEdge } from '@shared/schema';

const createSnapshotSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

export function registerDesignHistoryRoutes(app: Express): void {
  // List all design snapshots for a project
  app.get(
    '/api/projects/:id/snapshots',
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const snapshots = await storage.getDesignSnapshots(projectId);
      res.json({ data: snapshots, total: snapshots.length });
    }),
  );

  // Get a single design snapshot
  app.get(
    '/api/projects/:id/snapshots/:snapshotId',
    asyncHandler(async (req, res) => {
      parseIdParam(req.params.id); // validate project id
      const snapshotId = parseIdParam(req.params.snapshotId);
      const snapshot = await storage.getDesignSnapshot(snapshotId);
      if (!snapshot) {
        return res.status(404).json({ message: 'Design snapshot not found' });
      }
      res.json(snapshot);
    }),
  );

  // Create a design snapshot (captures current architecture nodes + edges)
  app.post(
    '/api/projects/:id/snapshots',
    payloadLimit(8 * 1024),
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const parsed = createSnapshotSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }

      // Capture current architecture state explicitly at the route level
      const [currentNodes, currentEdges] = await Promise.all([
        storage.getNodes(projectId, { limit: 10000, offset: 0, sort: 'asc' }),
        storage.getEdges(projectId, { limit: 10000, offset: 0, sort: 'asc' }),
      ]);

      const snapshot = await storage.createDesignSnapshot({
        projectId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        nodesJson: currentNodes,
        edgesJson: currentEdges,
      });
      res.status(201).json(snapshot);
    }),
  );

  // Delete a design snapshot
  app.delete(
    '/api/projects/:id/snapshots/:snapshotId',
    asyncHandler(async (req, res) => {
      parseIdParam(req.params.id); // validate project id
      const snapshotId = parseIdParam(req.params.snapshotId);
      const deleted = await storage.deleteDesignSnapshot(snapshotId);
      if (!deleted) {
        return res.status(404).json({ message: 'Design snapshot not found' });
      }
      res.status(204).end();
    }),
  );

  // Compare a snapshot to the current architecture state
  app.post(
    '/api/projects/:id/snapshots/:snapshotId/diff',
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const snapshotId = parseIdParam(req.params.snapshotId);

      const snapshot = await storage.getDesignSnapshot(snapshotId);
      if (!snapshot) {
        return res.status(404).json({ message: 'Design snapshot not found' });
      }

      // Get current architecture state
      const currentNodes = await storage.getNodes(projectId, { limit: 10000, offset: 0, sort: 'asc' });
      const currentEdges = await storage.getEdges(projectId, { limit: 10000, offset: 0, sort: 'asc' });

      // nodesJson / edgesJson are jsonb columns containing serialized arrays
      const baselineNodes = snapshot.nodesJson as unknown as ArchitectureNode[];
      const baselineEdges = snapshot.edgesJson as unknown as ArchitectureEdge[];

      const diff = computeArchDiff(baselineNodes, baselineEdges, currentNodes, currentEdges);
      res.json({
        snapshot: { id: snapshot.id, name: snapshot.name, createdAt: snapshot.createdAt },
        diff,
      });
    }),
  );
}
