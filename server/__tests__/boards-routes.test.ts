/**
 * Board Routes Tests — server/routes/boards.ts (Plan 02 Phase 4 / E2E-228)
 *
 * Covers:
 * - GET /api/projects/:id/board returns a default shape when no row exists
 * - GET returns the stored row when present
 * - PUT merges partial updates (omitted fields preserved)
 * - PUT auto-creates the row on first write
 * - PUT rejects invalid shapes (400)
 * - Auth required (401 / 404 on non-owner)
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import { registerBoardRoutes } from '../routes/boards';

const {
  mockValidateSession,
  mockGetProject,
  mockGetBoard,
  mockUpsertBoard,
} = vi.hoisted(() => ({
  mockValidateSession: vi.fn(),
  mockGetProject: vi.fn(),
  mockGetBoard: vi.fn(),
  mockUpsertBoard: vi.fn(),
}));

vi.mock('../auth', () => ({
  validateSession: mockValidateSession,
}));

vi.mock('../storage', () => ({
  storage: {
    getProject: mockGetProject,
    getBoard: mockGetBoard,
    upsertBoard: mockUpsertBoard,
  },
}));

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
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

let server: Server;
let baseUrl: string;

const SAMPLE_BOARD = {
  id: 42,
  projectId: 1,
  widthMm: 60,
  heightMm: 50,
  thicknessMm: 1.6,
  cornerRadiusMm: 2,
  layers: 2,
  copperWeightOz: 1,
  finish: 'HASL',
  solderMaskColor: 'green',
  silkscreenColor: 'white',
  minTraceWidthMm: 0.2,
  minDrillSizeMm: 0.3,
  castellatedHoles: false,
  impedanceControl: false,
  viaInPad: false,
  goldFingers: false,
  createdAt: new Date('2026-04-01T00:00:00Z'),
  updatedAt: new Date('2026-04-01T00:00:00Z'),
};

beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  registerBoardRoutes(app);
  app.use((err: { status?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.status ?? 500).json({ message: err.message ?? 'Internal error' });
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') { throw new Error('no port'); }
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
  // Default: authenticated, owned project.
  mockValidateSession.mockResolvedValue({ userId: 7 });
  mockGetProject.mockResolvedValue({ id: 1, ownerId: 7 });
});

describe('GET /api/projects/:id/board', () => {
  it('401 without session header', async () => {
    const res = await fetch(`${baseUrl}/api/projects/1/board`);
    expect(res.status).toBe(401);
  });

  it('returns the stored board row when present', async () => {
    mockGetBoard.mockResolvedValue(SAMPLE_BOARD);
    const res = await authFetch(`${baseUrl}/api/projects/1/board`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.widthMm).toBe(60);
    expect(body.heightMm).toBe(50);
    expect(mockGetBoard).toHaveBeenCalledWith(1);
  });

  it('returns a default board (id=0) when no row exists', async () => {
    mockGetBoard.mockResolvedValue({
      ...SAMPLE_BOARD,
      id: 0,
      widthMm: 100,
      heightMm: 80,
    });
    const res = await authFetch(`${baseUrl}/api/projects/1/board`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(0);
    expect(body.widthMm).toBe(100);
    expect(body.heightMm).toBe(80);
  });

  it('404 when project does not exist', async () => {
    mockGetProject.mockResolvedValue(undefined);
    const res = await authFetch(`${baseUrl}/api/projects/999/board`);
    expect(res.status).toBe(404);
  });

  it('404 when caller is not the owner', async () => {
    mockGetProject.mockResolvedValue({ id: 1, ownerId: 999 });
    const res = await authFetch(`${baseUrl}/api/projects/1/board`);
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/projects/:id/board', () => {
  it('merges partial updates and returns the full row', async () => {
    const updated = { ...SAMPLE_BOARD, widthMm: 120, heightMm: 90 };
    mockUpsertBoard.mockResolvedValue(updated);
    const res = await authFetch(`${baseUrl}/api/projects/1/board`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ widthMm: 120, heightMm: 90 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.widthMm).toBe(120);
    expect(body.heightMm).toBe(90);
    expect(mockUpsertBoard).toHaveBeenCalledWith(1, { widthMm: 120, heightMm: 90 });
  });

  it('accepts boolean flags (false is preserved, not dropped)', async () => {
    mockUpsertBoard.mockResolvedValue({ ...SAMPLE_BOARD, castellatedHoles: true });
    const res = await authFetch(`${baseUrl}/api/projects/1/board`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ castellatedHoles: true, viaInPad: false }),
    });
    expect(res.status).toBe(200);
    expect(mockUpsertBoard).toHaveBeenCalledWith(1, {
      castellatedHoles: true,
      viaInPad: false,
    });
  });

  it('400 on invalid shape (negative width)', async () => {
    const res = await authFetch(`${baseUrl}/api/projects/1/board`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ widthMm: -10 }),
    });
    expect(res.status).toBe(400);
    expect(mockUpsertBoard).not.toHaveBeenCalled();
  });

  it('400 on unknown fields (strict schema)', async () => {
    const res = await authFetch(`${baseUrl}/api/projects/1/board`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bogusField: 123 }),
    });
    expect(res.status).toBe(400);
    expect(mockUpsertBoard).not.toHaveBeenCalled();
  });

  it('400 on invalid enum value', async () => {
    const res = await authFetch(`${baseUrl}/api/projects/1/board`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ finish: 'DEFINITELY_NOT_REAL' }),
    });
    expect(res.status).toBe(400);
  });

  it('401 without session', async () => {
    const res = await fetch(`${baseUrl}/api/projects/1/board`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ widthMm: 60 }),
    });
    expect(res.status).toBe(401);
  });
});
