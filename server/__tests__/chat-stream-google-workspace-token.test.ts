/**
 * Chat streaming — Google Workspace token sourcing (audit finding #60).
 *
 * Proves the security contract introduced for audit finding #60:
 *   1. The streaming endpoint NEVER reads `googleWorkspaceToken` from the request body.
 *   2. The token is resolved server-side via `getApiKey(userId, 'google_workspace')`.
 *   3. If the user has no stored token, `ctx.googleWorkspaceToken` is `undefined` —
 *      client-supplied body values are silently ignored.
 *
 * A malicious client that tries to inject an attacker-controlled token via the
 * request body must not be able to drive the Google Workspace tool execution.
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import { registerChatRoutes } from '../routes/chat';

const {
  mockGetProject,
  mockStreamAIMessage,
  mockGetApiKey,
  mockValidateSession,
} = vi.hoisted(() => ({
  mockGetProject: vi.fn(),
  mockStreamAIMessage: vi.fn(),
  mockGetApiKey: vi.fn(),
  mockValidateSession: vi.fn(),
}));

vi.mock('../storage', () => ({
  storage: {
    getProject: mockGetProject,
    getChatMessages: vi.fn(),
    createChatMessage: vi.fn(),
    deleteChatMessages: vi.fn(),
    deleteChatMessage: vi.fn(),
    getAiActions: vi.fn(),
    getAiActionsByMessage: vi.fn(),
  },
}));

vi.mock('../auth', () => ({
  validateSession: mockValidateSession,
  getApiKey: mockGetApiKey,
}));

vi.mock('../db', () => ({ db: {}, pool: {}, checkConnection: vi.fn() }));
vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../ai', () => ({
  processAIMessage: vi.fn(),
  streamAIMessage: mockStreamAIMessage,
  categorizeError: vi.fn().mockReturnValue({ userMessage: 'Error' }),
  routeToModel: vi.fn().mockReturnValue({ model: 'test-model' }),
}));

vi.mock('../lib/simulation-context', () => ({
  buildSimulationContext: vi.fn().mockResolvedValue({}),
}));

vi.mock('express-rate-limit', () => ({
  default: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => { next(); },
}));

vi.mock('./auth-middleware', () => ({
  requireProjectOwnership: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: '150kb' }));
  // Attach userId to request (mimicking the real auth middleware upstream).
  app.use((req, _res, next) => {
    (req as unknown as { userId?: number }).userId = 1;
    next();
  });
  registerChatRoutes(app);
  app.use((err: { status?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.status ?? 500).json({ message: err.message ?? 'Internal error' });
  });

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      if (typeof addr === 'object' && addr !== null) {
        baseUrl = `http://127.0.0.1:${String(addr.port)}`;
      }
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetProject.mockResolvedValue({ id: 1, name: 'Test', ownerId: 1 });
  mockValidateSession.mockResolvedValue({ userId: 1, sessionId: 'test-session' });
  // Default: streamAIMessage resolves immediately without writing any data,
  // so the request completes quickly.
  mockStreamAIMessage.mockImplementation(async () => {
    /* no-op */
  });
});

async function postStream(body: Record<string, unknown>) {
  return fetch(`${baseUrl}/api/chat/ai/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Id': 'test-session',
      Origin: baseUrl,
    },
    body: JSON.stringify(body),
  });
}

describe('chat stream — googleWorkspaceToken sourcing (audit #60)', () => {
  it('resolves googleWorkspaceToken server-side from encrypted api_keys, ignoring body', async () => {
    // Arrange: server has an encrypted token stored for this user.
    mockGetApiKey.mockImplementation(async (userId: number, provider: string) => {
      if (provider === 'google_workspace' && userId === 1) return 'server-stored-legit-token';
      if (provider === 'gemini' && userId === 1) return 'server-gemini-key';
      return null;
    });

    // Act: malicious client attempts to inject an attacker-controlled token via the body.
    const res = await postStream({
      message: 'hi',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      projectId: 1,
      googleWorkspaceToken: 'attacker-controlled-evil-token',
    });

    expect(res.status).toBe(200);
    expect(mockStreamAIMessage).toHaveBeenCalledTimes(1);

    const [callArgs] = mockStreamAIMessage.mock.calls[0] as [
      { toolContext: { googleWorkspaceToken?: string } },
      ...unknown[],
    ];
    expect(callArgs.toolContext.googleWorkspaceToken).toBe('server-stored-legit-token');
    expect(callArgs.toolContext.googleWorkspaceToken).not.toBe('attacker-controlled-evil-token');

    // Assert we actually queried the encrypted store for the right provider.
    expect(mockGetApiKey).toHaveBeenCalledWith(1, 'google_workspace');
  });

  it('leaves googleWorkspaceToken undefined when user has no stored token, even if body supplies one', async () => {
    mockGetApiKey.mockImplementation(async (_userId: number, provider: string) => {
      if (provider === 'gemini') return 'server-gemini-key';
      return null;
    });

    const res = await postStream({
      message: 'hi',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      projectId: 1,
      googleWorkspaceToken: 'attacker-controlled-evil-token',
    });

    expect(res.status).toBe(200);
    const [callArgs] = mockStreamAIMessage.mock.calls[0] as [
      { toolContext: { googleWorkspaceToken?: string } },
      ...unknown[],
    ];
    expect(callArgs.toolContext.googleWorkspaceToken).toBeUndefined();
  });
});
