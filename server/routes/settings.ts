import type { Express } from 'express';
import { GoogleGenAI } from '@google/genai';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error/v3';
import { storeApiKey, getApiKey, deleteApiKey, listApiKeyProviders } from '../auth';
import { storage } from '../storage';
import { payloadLimit } from './utils';
import { setCacheHeaders } from '../lib/cache-headers';

const validateKeyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { valid: false, error: 'Too many validation requests. Please wait a minute.' },
});

export function registerSettingsRoutes(app: Express): void {
  // --- API Key Management ---

  app.get(
    '/api/settings/api-keys',
    setCacheHeaders('project_data'),
    async (req, res) => {
      if (!req.userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      const providers = await listApiKeyProviders(req.userId);
      res.json({ providers });
    },
  );

  app.post(
    '/api/settings/api-keys',
    payloadLimit(4 * 1024),
    async (req, res) => {
      if (!req.userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      const schema = z.object({
        provider: z.enum(['gemini', 'jlcpcb', 'pcbway', 'oshpark', 'google_workspace']),
        apiKey: z.string().min(1).max(4096),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }

      await storeApiKey(req.userId, parsed.data.provider, parsed.data.apiKey);
      res.json({ message: 'API key stored' });
    },
  );

  app.delete(
    '/api/settings/api-keys/:provider',
    async (req, res) => {
      if (!req.userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      const provider = req.params.provider;
      if (provider !== 'gemini' && provider !== 'jlcpcb' && provider !== 'pcbway' && provider !== 'oshpark' && provider !== 'google_workspace') {
        return res.status(400).json({ message: 'Invalid provider' });
      }
      const deleted = await deleteApiKey(req.userId, provider);
      if (!deleted) {
        return res.status(404).json({ message: 'No API key found for this provider' });
      }
      res.status(204).end();
    },
  );

  // --- API Key Validation ---

  app.post(
    '/api/settings/api-keys/validate',
    validateKeyLimiter,
    payloadLimit(4 * 1024),
    async (req, res) => {
      const schema = z.object({
        provider: z.enum(['gemini', 'jlcpcb', 'pcbway', 'oshpark', 'google_workspace']),
        apiKey: z.string().max(4096).optional(),
        useStored: z.boolean().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ valid: false, error: fromZodError(parsed.error).toString() });
      }

      let apiKey: string;

      if (parsed.data.useStored || !parsed.data.apiKey) {
        // Use the server-stored key for the authenticated user
        if (!req.userId) {
          return res.status(401).json({ valid: false, error: 'Authentication required to validate stored key' });
        }
        const storedKey = await getApiKey(req.userId, parsed.data.provider);
        if (!storedKey) {
          return res.json({ valid: false, error: 'No stored API key found for this provider' });
        }
        apiKey = storedKey;
      } else {
        apiKey = parsed.data.apiKey;
      }

      const { provider } = parsed.data;

      try {
        if (provider === 'jlcpcb' || provider === 'pcbway' || provider === 'oshpark' || provider === 'google_workspace') {
          // Skip deep validation for fab providers for now, just acknowledge it's saved.
          // (In a real scenario, we would ping their respective API /me endpoints)
          res.json({ valid: true });
          return;
        }

        const genAI = new GoogleGenAI({ apiKey });
        await genAI.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: 'Hi',
        });
        res.json({ valid: true });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Validation failed';
        res.json({ valid: false, error: message });
      }
    },
  );

  // --- Chat Settings ---

  app.get(
    '/api/settings/chat',
    setCacheHeaders('api_list'),
    async (req, res) => {
      const defaults = {
        aiProvider: 'gemini',
        aiModel: 'gemini-3.1-pro-preview-customtools',
        aiTemperature: 0.7,
        customSystemPrompt: '',
        routingStrategy: 'auto',
        previewAiChanges: true,
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
        previewAiChanges: settings.previewAiChanges,
      });
    },
  );

  app.patch(
    '/api/settings/chat',
    payloadLimit(16 * 1024),
    async (req, res) => {
      if (!req.userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      const chatSettingsSchema = z.object({
        aiProvider: z.enum(['gemini']).optional(),
        aiModel: z.string().min(1).max(200).optional(),
        aiTemperature: z.number().min(0).max(2).optional(),
        customSystemPrompt: z.string().max(10000).optional(),
        routingStrategy: z.enum(['user', 'auto', 'quality', 'speed', 'cost']).optional(),
        previewAiChanges: z.boolean().optional(),
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
        previewAiChanges: updated.previewAiChanges,
      });
    },
  );
}
