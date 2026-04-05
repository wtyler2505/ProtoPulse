/**
 * Project IO Routes Tests — server/routes/project-io.ts
 *
 * Focuses on import authentication and ownership assignment.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import { registerProjectIORoutes } from '../routes/project-io';

const {
  mockTransaction,
  mockValidateSession,
  mockLoggerInfo,
} = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockValidateSession: vi.fn(),
  mockLoggerInfo: vi.fn(),
}));

vi.mock('../db', () => ({
  db: {
    transaction: mockTransaction,
  },
}));

vi.mock('../auth', () => ({
  validateSession: mockValidateSession,
}));

vi.mock('../storage', () => ({
  storage: {
    getProject: vi.fn(),
  },
}));

vi.mock('../logger', () => ({
  logger: {
    info: mockLoggerInfo,
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has('X-Session-Id')) {
    headers.set('X-Session-Id', 'test-session');
  }
  return fetch(url, { ...init, headers });
}

const minimalImportPayload = {
  _exportVersion: 1 as const,
  _exportedAt: '2026-03-31T12:00:00.000Z',
  project: {
    name: 'Imported Project',
    description: 'Imported from fixture',
  },
};

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  registerProjectIORoutes(app);

  app.use((err: { status?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.status ?? 500).json({ message: err.message ?? 'Internal error' });
  });

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        throw new Error('Test server did not expose a TCP port');
      }
      baseUrl = `http://127.0.0.1:${String(addr.port)}`;
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
});

describe('POST /api/projects/import', () => {
  it('returns 401 without a session header', async () => {
    const res = await fetch(`${baseUrl}/api/projects/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(minimalImportPayload),
    });

    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid session', async () => {
    mockValidateSession.mockResolvedValue(null);

    const res = await authFetch(`${baseUrl}/api/projects/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(minimalImportPayload),
    });

    expect(res.status).toBe(401);
  });

  it('assigns ownerId from the authenticated session on import', async () => {
    mockValidateSession.mockResolvedValue({ userId: 77 });

    const mockReturning = vi.fn().mockResolvedValue([
      {
        id: 123,
        name: 'Imported Project',
        description: 'Imported from fixture',
        ownerId: 77,
      },
    ]);
    const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

    mockTransaction.mockImplementation(async (callback: (tx: { insert: typeof mockInsert }) => Promise<unknown>) => {
      return callback({ insert: mockInsert });
    });

    const res = await authFetch(`${baseUrl}/api/projects/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(minimalImportPayload),
    });

    expect(res.status).toBe(201);
    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 77 }));
    await expect(res.json()).resolves.toEqual({ projectId: 123, name: 'Imported Project' });
  });
});
