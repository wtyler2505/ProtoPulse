import crypto from 'crypto';

import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import { asyncHandler, HttpError, payloadLimit } from './utils';

import type { Express } from 'express';

// ---------------------------------------------------------------------------
// In-memory store with TTL
// ---------------------------------------------------------------------------

interface EmbedEntry {
  data: string;
  createdAt: number;
}

/** 30-day TTL in milliseconds */
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Maximum encoded data size: 500KB */
const MAX_DATA_SIZE = 500 * 1024;

/** Short code length */
const CODE_LENGTH = 8;

const store = new Map<string, EmbedEntry>();

/** Sweep expired entries periodically */
const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

let sweepTimer: ReturnType<typeof setInterval> | null = null;

function startSweep(): void {
  if (sweepTimer) {
    return;
  }
  sweepTimer = setInterval(() => {
    const now = Date.now();
    store.forEach((entry, code) => {
      if (now - entry.createdAt > TTL_MS) {
        store.delete(code);
      }
    });
  }, SWEEP_INTERVAL_MS);
  // Allow the process to exit even if the timer is still running
  if (sweepTimer && typeof sweepTimer === 'object' && 'unref' in sweepTimer) {
    sweepTimer.unref();
  }
}

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const createEmbedSchema = z.object({
  data: z
    .string()
    .min(1, 'data is required')
    .max(MAX_DATA_SIZE, `data must not exceed ${Math.round(MAX_DATA_SIZE / 1024)}KB`),
});

// ---------------------------------------------------------------------------
// Rate limiter: 10 creates per minute per IP
// ---------------------------------------------------------------------------

const createLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many embed links created. Please try again later.' },
});

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export function registerEmbedRoutes(app: Express): void {
  startSweep();

  // POST /api/embeds — Create short URL
  app.post(
    '/api/embeds',
    createLimiter,
    payloadLimit(MAX_DATA_SIZE + 1024), // extra room for JSON envelope
    asyncHandler(async (req, res) => {
      const result = createEmbedSchema.safeParse(req.body);
      if (!result.success) {
        throw new HttpError(result.error.issues[0]?.message ?? 'Invalid request body', 400);
      }

      const { data } = result.data;

      // Generate a unique short code
      let code = generateCode();
      let attempts = 0;
      while (store.has(code) && attempts < 10) {
        code = generateCode();
        attempts++;
      }
      if (store.has(code)) {
        throw new HttpError('Failed to generate unique code. Please try again.', 500);
      }

      store.set(code, { data, createdAt: Date.now() });

      const protocol = req.headers['x-forwarded-proto'] ?? req.protocol;
      const host = req.headers['x-forwarded-host'] ?? req.get('host') ?? 'localhost:5000';
      const origin = `${String(protocol)}://${String(host)}`;

      res.status(201).json({
        code,
        url: `${origin}/embed/s/${code}`,
      });
    }),
  );

  // GET /api/embeds/:code — Retrieve circuit data by short code
  app.get(
    '/api/embeds/:code',
    asyncHandler(async (req, res) => {
      const code = String(req.params.code);

      if (!code || code.length !== CODE_LENGTH) {
        throw new HttpError('Invalid embed code', 400);
      }

      const entry = store.get(code);
      if (!entry) {
        throw new HttpError('Embed not found or expired', 404);
      }

      // Check TTL
      if (Date.now() - entry.createdAt > TTL_MS) {
        store.delete(code);
        throw new HttpError('Embed not found or expired', 404);
      }

      res.json({ data: entry.data });
    }),
  );
}

// Exports for testing
export { store, TTL_MS, MAX_DATA_SIZE, CODE_LENGTH, generateCode, SWEEP_INTERVAL_MS };
