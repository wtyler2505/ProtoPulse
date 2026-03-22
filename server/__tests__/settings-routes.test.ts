/**
 * Settings Routes Tests — server/routes/settings.ts
 *
 * Tests API key management and chat settings endpoints.
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';

// ---------------------------------------------------------------------------
// Mock storage & auth
// ---------------------------------------------------------------------------

const {
  mockGetChatSettings,
  mockUpsertChatSettings,
  mockListApiKeyProviders,
  mockStoreApiKey,
  mockDeleteApiKey,
  mockGetApiKey,
} = vi.hoisted(() => ({
  mockGetChatSettings: vi.fn(),
  mockUpsertChatSettings: vi.fn(),
  mockListApiKeyProviders: vi.fn(),
  mockStoreApiKey: vi.fn(),
  mockDeleteApiKey: vi.fn(),
  mockGetApiKey: vi.fn(),
}));

vi.mock('../storage', () => ({
  storage: {
    getChatSettings: mockGetChatSettings,
    upsertChatSettings: mockUpsertChatSettings,
  },
}));

vi.mock('../auth', () => ({
  listApiKeyProviders: mockListApiKeyProviders,
  storeApiKey: mockStoreApiKey,
  deleteApiKey: mockDeleteApiKey,
  getApiKey: mockGetApiKey,
}));

vi.mock('../db', () => ({ db: {}, pool: {}, checkConnection: vi.fn() }));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Mock Anthropic and Google GenAI SDKs to prevent real API calls
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn().mockRejectedValue(new Error('Mock: invalid key')) },
  })),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateContent: vi.fn().mockRejectedValue(new Error('Mock: invalid key')) },
  })),
}));

vi.mock('express-rate-limit', () => ({
  default: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => { next(); },
}));

// Import after mocks
import { registerSettingsRoutes } from '../routes/settings';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has('X-Session-Id')) {
    headers.set('X-Session-Id', 'test-session');
  }
  return fetch(url, { ...init, headers });
}

// Middleware to inject userId
function fakeUserMiddleware(req: express.Request, _res: express.Response, next: express.NextFunction): void {
  req.userId = 1;
  next();
}

function fakeNoUserMiddleware(req: express.Request, _res: express.Response, next: express.NextFunction): void {
  req.userId = undefined;
  next();
}

// ---------------------------------------------------------------------------
// Server setup — two apps: one with auth, one without
// ---------------------------------------------------------------------------

let serverAuth: Server;
let baseUrlAuth: string;
let serverNoAuth: Server;
let baseUrlNoAuth: string;

beforeAll(async () => {
  // App with authenticated user
  const appAuth = express();
  appAuth.use(express.json({ limit: '150kb' }));
  appAuth.use(fakeUserMiddleware);
  registerSettingsRoutes(appAuth);
  appAuth.use((err: { status?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.status ?? 500).json({ message: err.message ?? 'Internal error' });
  });

  await new Promise<void>((resolve) => {
    serverAuth = appAuth.listen(0, () => {
      const addr = serverAuth.address();
      if (typeof addr === 'object' && addr !== null) {
        baseUrlAuth = `http://127.0.0.1:${String(addr.port)}`;
      }
      resolve();
    });
  });

  // App without authenticated user
  const appNoAuth = express();
  appNoAuth.use(express.json({ limit: '150kb' }));
  appNoAuth.use(fakeNoUserMiddleware);
  registerSettingsRoutes(appNoAuth);
  appNoAuth.use((err: { status?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.status ?? 500).json({ message: err.message ?? 'Internal error' });
  });

  await new Promise<void>((resolve) => {
    serverNoAuth = appNoAuth.listen(0, () => {
      const addr = serverNoAuth.address();
      if (typeof addr === 'object' && addr !== null) {
        baseUrlNoAuth = `http://127.0.0.1:${String(addr.port)}`;
      }
      resolve();
    });
  });
});

afterAll(async () => {
  await Promise.all([
    new Promise<void>((resolve, reject) => { serverAuth.close((err) => (err ? reject(err) : resolve())); }),
    new Promise<void>((resolve, reject) => { serverNoAuth.close((err) => (err ? reject(err) : resolve())); }),
  ]);
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// GET /api/settings/api-keys
// ===========================================================================

describe('GET /api/settings/api-keys', () => {
  it('returns providers for authenticated user', async () => {
    mockListApiKeyProviders.mockResolvedValue(['anthropic', 'gemini']);

    const res = await fetch(`${baseUrlAuth}/api/settings/api-keys`);
    expect(res.status).toBe(200);
    const body = await res.json() as { providers: string[] };
    expect(body.providers).toEqual(['anthropic', 'gemini']);
  });

  it('returns 401 without user', async () => {
    const res = await fetch(`${baseUrlNoAuth}/api/settings/api-keys`);
    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// POST /api/settings/api-keys
// ===========================================================================

describe('POST /api/settings/api-keys', () => {
  it('stores an API key', async () => {
    mockStoreApiKey.mockResolvedValue(undefined);

    const res = await fetch(`${baseUrlAuth}/api/settings/api-keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'anthropic', apiKey: 'sk-test-key' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { message: string };
    expect(body.message).toBe('API key stored');
  });

  it('returns 400 for invalid provider', async () => {
    const res = await fetch(`${baseUrlAuth}/api/settings/api-keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'openai', apiKey: 'test' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 401 without user', async () => {
    const res = await fetch(`${baseUrlNoAuth}/api/settings/api-keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'anthropic', apiKey: 'test' }),
    });
    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// DELETE /api/settings/api-keys/:provider
// ===========================================================================

describe('DELETE /api/settings/api-keys/:provider', () => {
  it('deletes an API key', async () => {
    mockDeleteApiKey.mockResolvedValue(true);

    const res = await fetch(`${baseUrlAuth}/api/settings/api-keys/anthropic`, { method: 'DELETE' });
    expect(res.status).toBe(204);
  });

  it('returns 404 if no key for provider', async () => {
    mockDeleteApiKey.mockResolvedValue(false);

    const res = await fetch(`${baseUrlAuth}/api/settings/api-keys/gemini`, { method: 'DELETE' });
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid provider', async () => {
    const res = await fetch(`${baseUrlAuth}/api/settings/api-keys/openai`, { method: 'DELETE' });
    expect(res.status).toBe(400);
  });
});

// ===========================================================================
// GET /api/settings/chat
// ===========================================================================

describe('GET /api/settings/chat', () => {
  it('returns defaults when no user', async () => {
    const res = await fetch(`${baseUrlNoAuth}/api/settings/chat`);
    expect(res.status).toBe(200);
    const body = await res.json() as { aiProvider: string; aiModel: string };
    expect(body.aiProvider).toBe('gemini');
  });

  it('returns defaults when user has no saved settings', async () => {
    mockGetChatSettings.mockResolvedValue(null);

    const res = await fetch(`${baseUrlAuth}/api/settings/chat`);
    expect(res.status).toBe(200);
    const body = await res.json() as { aiProvider: string };
    expect(body.aiProvider).toBe('gemini');
  });

  it('returns saved settings for authenticated user', async () => {
    mockGetChatSettings.mockResolvedValue({
      aiProvider: 'gemini',
      aiModel: 'gemini-2.5-flash',
      aiTemperature: 0.5,
      customSystemPrompt: 'Be helpful',
      routingStrategy: 'auto',
    });

    const res = await fetch(`${baseUrlAuth}/api/settings/chat`);
    expect(res.status).toBe(200);
    const body = await res.json() as { aiProvider: string; aiModel: string };
    expect(body.aiProvider).toBe('gemini');
    expect(body.aiModel).toBe('gemini-2.5-flash');
  });
});

// ===========================================================================
// PATCH /api/settings/chat
// ===========================================================================

describe('PATCH /api/settings/chat', () => {
  it('updates chat settings', async () => {
    const updated = {
      aiProvider: 'gemini',
      aiModel: 'gemini-2.5-flash',
      aiTemperature: 0.3,
      customSystemPrompt: '',
      routingStrategy: 'user',
    };
    mockUpsertChatSettings.mockResolvedValue(updated);

    const res = await fetch(`${baseUrlAuth}/api/settings/chat`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aiProvider: 'gemini' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { aiProvider: string };
    expect(body.aiProvider).toBe('gemini');
  });

  it('returns 401 without user', async () => {
    const res = await fetch(`${baseUrlNoAuth}/api/settings/chat`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aiProvider: 'gemini' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid provider value', async () => {
    const res = await fetch(`${baseUrlAuth}/api/settings/chat`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aiProvider: 'openai' }),
    });
    expect(res.status).toBe(400);
  });
});
