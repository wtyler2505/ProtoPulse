import type { Express } from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { storeApiKey, getApiKey, deleteApiKey, listApiKeyProviders } from '../auth';
import { storage } from '../storage';
import { asyncHandler, payloadLimit } from './utils';

export function registerSettingsRoutes(app: Express): void {
  // --- API Key Management ---

  app.get(
    '/api/settings/api-keys',
    asyncHandler(async (req, res) => {
      if (!req.userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      const providers = await listApiKeyProviders(req.userId);
      res.json({ providers });
    }),
  );

  app.post(
    '/api/settings/api-keys',
    payloadLimit(4 * 1024),
    asyncHandler(async (req, res) => {
      if (!req.userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      const schema = z.object({
        provider: z.enum(['anthropic', 'gemini']),
        apiKey: z.string().min(1).max(500),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }

      await storeApiKey(req.userId, parsed.data.provider, parsed.data.apiKey);
      res.json({ message: 'API key stored' });
    }),
  );

  app.delete(
    '/api/settings/api-keys/:provider',
    asyncHandler(async (req, res) => {
      if (!req.userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      const provider = req.params.provider;
      if (provider !== 'anthropic' && provider !== 'gemini') {
        return res.status(400).json({ message: 'Invalid provider' });
      }
      const deleted = await deleteApiKey(req.userId, provider);
      if (!deleted) {
        return res.status(404).json({ message: 'No API key found for this provider' });
      }
      res.status(204).end();
    }),
  );

  // --- Chat Settings ---

  app.get(
    '/api/settings/chat',
    asyncHandler(async (req, res) => {
      const defaults = {
        aiProvider: 'anthropic',
        aiModel: 'claude-sonnet-4-5-20250514',
        aiTemperature: 0.7,
        customSystemPrompt: '',
        routingStrategy: 'user',
      };

      if (!req.userId) {
        return res.json(defaults);
      }

      const settings = await storage.getChatSettings(req.userId);
      if (!settings) {
        return res.json(defaults);
      }

      res.json({
        aiProvider: settings.aiProvider,
        aiModel: settings.aiModel,
        aiTemperature: settings.aiTemperature,
        customSystemPrompt: settings.customSystemPrompt,
        routingStrategy: settings.routingStrategy,
      });
    }),
  );

  app.patch(
    '/api/settings/chat',
    payloadLimit(16 * 1024),
    asyncHandler(async (req, res) => {
      if (!req.userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      const chatSettingsSchema = z.object({
        aiProvider: z.enum(['anthropic', 'gemini']).optional(),
        aiModel: z.string().min(1).max(200).optional(),
        aiTemperature: z.number().min(0).max(2).optional(),
        customSystemPrompt: z.string().max(10000).optional(),
        routingStrategy: z.enum(['user', 'auto', 'quality', 'speed', 'cost']).optional(),
      });
      const parsed = chatSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }

      const updated = await storage.upsertChatSettings(req.userId, parsed.data);
      res.json({
        aiProvider: updated.aiProvider,
        aiModel: updated.aiModel,
        aiTemperature: updated.aiTemperature,
        customSystemPrompt: updated.customSystemPrompt,
        routingStrategy: updated.routingStrategy,
      });
    }),
  );
}
