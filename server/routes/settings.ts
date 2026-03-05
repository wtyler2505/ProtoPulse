import type { Express } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { storeApiKey, getApiKey, deleteApiKey, listApiKeyProviders } from '../auth';
import { storage } from '../storage';
import { asyncHandler, payloadLimit } from './utils';

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

  // --- API Key Validation ---

  app.post(
    '/api/settings/api-keys/validate',
    validateKeyLimiter,
    payloadLimit(4 * 1024),
    asyncHandler(async (req, res) => {
      const schema = z.object({
        provider: z.enum(['anthropic', 'gemini']),
        apiKey: z.string().min(1).max(500),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ valid: false, error: fromZodError(parsed.error).toString() });
      }

      const { provider, apiKey } = parsed.data;

      try {
        if (provider === 'anthropic') {
          const client = new Anthropic({ apiKey });
          await client.messages.create({
            model: 'claude-haiku-4-5-20250514',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'Hi' }],
          });
        } else {
          const genAI = new GoogleGenAI({ apiKey });
          await genAI.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: 'Hi',
          });
        }
        res.json({ valid: true });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Validation failed';
        res.json({ valid: false, error: message });
      }
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
