import type { Express } from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { storage } from '../storage';
import { insertDesignPreferenceSchema } from '@shared/schema';
import { asyncHandler, parseIdParam } from './utils';
import { requireProjectOwnership } from './auth-middleware';

export function registerDesignPreferenceRoutes(app: Express): void {
  // List all preferences for a project
  app.get(
    '/api/projects/:id/preferences',
    requireProjectOwnership,
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const prefs = await storage.getDesignPreferences(projectId);
      res.json({ data: prefs, total: prefs.length });
    }),
  );

  // Upsert a design preference (insert or update on conflict)
  app.post(
    '/api/projects/:id/preferences',
    requireProjectOwnership,
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const parsed = insertDesignPreferenceSchema.safeParse({ ...req.body, projectId });
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }
      const pref = await storage.upsertDesignPreference(parsed.data);
      res.status(201).json(pref);
    }),
  );

  // Bulk upsert preferences
  app.put(
    '/api/projects/:id/preferences',
    requireProjectOwnership,
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const bodySchema = z.array(insertDesignPreferenceSchema.omit({ projectId: true }));
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }
      const results = await Promise.all(
        parsed.data.map((pref) => storage.upsertDesignPreference({ ...pref, projectId })),
      );
      res.json({ data: results, total: results.length });
    }),
  );

  // Delete a specific preference
  app.delete(
    '/api/projects/:id/preferences/:prefId',
    requireProjectOwnership,
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const prefId = parseIdParam(req.params.prefId);
      const allPrefs = await storage.getDesignPreferences(projectId);
      const existing = allPrefs.find(p => p.id === prefId);
      if (!existing) {
        return res.status(404).json({ message: 'Preference not found' });
      }
      const deleted = await storage.deleteDesignPreference(projectId, prefId);
      if (!deleted) {
        return res.status(404).json({ message: 'Preference not found' });
      }
      res.status(204).end();
    }),
  );
}
