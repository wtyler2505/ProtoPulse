import type { Express } from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { storage } from '../storage';
import { asyncHandler, payloadLimit, parseIdParam } from './utils';
import { computeBomDiff } from '@shared/bom-diff';
import type { BomItem } from '@shared/schema';

const createSnapshotSchema = z.object({
  label: z.string().min(1).max(200),
});

const diffRequestSchema = z.object({
  snapshotId: z.number().int().positive(),
});

export function registerBomSnapshotRoutes(app: Express): void {
  // Create a BOM snapshot (captures current BOM state)
  app.post(
    '/api/projects/:id/bom-snapshots',
    payloadLimit(8 * 1024),
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const parsed = createSnapshotSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }
      const snapshot = await storage.createBomSnapshot(projectId, parsed.data.label);
      res.status(201).json(snapshot);
    }),
  );

  // List all snapshots for a project
  app.get(
    '/api/projects/:id/bom-snapshots',
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const snapshots = await storage.getBomSnapshots(projectId);
      res.json({ data: snapshots, total: snapshots.length });
    }),
  );

  // Delete a snapshot
  app.delete(
    '/api/projects/:id/bom-snapshots/:snapshotId',
    asyncHandler(async (req, res) => {
      const _projectId = parseIdParam(req.params.id);
      const snapshotId = parseIdParam(req.params.snapshotId);
      const deleted = await storage.deleteBomSnapshot(snapshotId);
      if (!deleted) {
        return res.status(404).json({ message: 'BOM snapshot not found' });
      }
      res.status(204).end();
    }),
  );

  // Compute diff between a snapshot and the current BOM
  app.post(
    '/api/projects/:id/bom-diff',
    payloadLimit(8 * 1024),
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const parsed = diffRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }

      const snapshot = await storage.getBomSnapshot(parsed.data.snapshotId);
      if (!snapshot) {
        return res.status(404).json({ message: 'BOM snapshot not found' });
      }

      // Get current BOM items (all, no pagination)
      const currentItems = await storage.getBomItems(projectId, { limit: 10000, offset: 0, sort: 'asc' });

      // snapshotData is a jsonb column containing serialized BomItem[]
      const baselineItems = snapshot.snapshotData as BomItem[];

      const diff = computeBomDiff(baselineItems, currentItems);
      res.json({ snapshot: { id: snapshot.id, label: snapshot.label, createdAt: snapshot.createdAt }, diff });
    }),
  );
}
