import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted ensures these are available when vi.mock factories run
// (vi.mock is hoisted above all imports/declarations by Vitest)
// ---------------------------------------------------------------------------

const { mockDelete, mockSelect } = vi.hoisted(() => ({
  mockDelete: vi.fn(),
  mockSelect: vi.fn(),
}));

vi.mock('../db', () => ({
  db: {
    delete: mockDelete,
    select: mockSelect,
  },
}));

vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Make asyncHandler a pass-through so the test can directly await the async handler
vi.mock('../routes/utils', async (importOriginal) => {
  const original = await importOriginal<typeof import('../routes/utils')>();
  return {
    ...original,
    asyncHandler: (fn: (req: Request, res: Response, next: NextFunction) => Promise<void | Response>) => fn,
  };
});

import { registerAdminRoutes } from '../routes/admin';
import { logger } from '../logger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_KEY = 'test-admin-secret-key-12345';

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<void | Response>;

/**
 * Extract the route handler registered by registerAdminRoutes.
 * Because asyncHandler is mocked as a pass-through, we get the raw async function.
 */
function captureHandler(): AsyncRouteHandler {
  let captured: AsyncRouteHandler | undefined;

  const fakeApp = {
    get: vi.fn(),
    delete: (_path: string, handler: AsyncRouteHandler) => {
      captured = handler;
    },
  } as unknown as import('express').Express;

  registerAdminRoutes(fakeApp);

  if (!captured) {
    throw new Error('No DELETE handler was registered');
  }

  return captured;
}

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    query: {},
    ip: '127.0.0.1',
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response & { _status: number; _json: unknown } {
  const res = {
    _status: 200,
    _json: undefined as unknown,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(body: unknown) {
      res._json = body;
      return res;
    },
  };
  return res as unknown as Response & { _status: number; _json: unknown };
}

function setupCountMocks(nodes: number, edges: number, bom: number, proj: number): void {
  const totals = [nodes, edges, bom, proj];
  let callIdx = 0;

  mockSelect.mockImplementation(() => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ total: totals[callIdx++] ?? 0 }]),
    }),
  }));
}

function setupDeleteMocks(): void {
  mockDelete.mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DELETE /api/admin/purge', () => {
  let handler: AsyncRouteHandler;
  const next = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.ADMIN_API_KEY = ADMIN_KEY;
    handler = captureHandler();
  });

  afterEach(() => {
    delete process.env.ADMIN_API_KEY;
  });

  // ---- Authorization ----

  describe('authorization', () => {
    it('returns 403 when no X-Admin-Key header is provided', async () => {
      const req = mockReq();
      const res = mockRes();

      await handler(req, res, next);

      expect(res._status).toBe(403);
      expect(res._json).toEqual({ error: 'Forbidden: valid admin key required' });
    });

    it('returns 403 when X-Admin-Key does not match', async () => {
      const req = mockReq({ headers: { 'x-admin-key': 'wrong-key' } as Record<string, string> });
      const res = mockRes();

      await handler(req, res, next);

      expect(res._status).toBe(403);
      expect(res._json).toEqual({ error: 'Forbidden: valid admin key required' });
    });

    it('returns 403 when ADMIN_API_KEY env var is not set', async () => {
      delete process.env.ADMIN_API_KEY;

      const req = mockReq({ headers: { 'x-admin-key': ADMIN_KEY } as Record<string, string> });
      const res = mockRes();

      await handler(req, res, next);

      expect(res._status).toBe(403);
      expect(res._json).toEqual({ error: 'Forbidden: valid admin key required' });
    });

    it('does not execute any database operations when unauthorized', async () => {
      const req = mockReq();
      const res = mockRes();

      await handler(req, res, next);

      expect(mockSelect).not.toHaveBeenCalled();
      expect(mockDelete).not.toHaveBeenCalled();
    });
  });

  // ---- Dry-run mode ----

  describe('dry-run mode', () => {
    it('returns 200 with dryRun=true and counts when ?dryRun=true', async () => {
      setupCountMocks(5, 3, 10, 2);

      const req = mockReq({
        headers: { 'x-admin-key': ADMIN_KEY } as Record<string, string>,
        query: { dryRun: 'true' },
      });
      const res = mockRes();

      await handler(req, res, next);

      expect(res._status).toBe(200);
      expect(res._json).toEqual({
        dryRun: true,
        counts: {
          architectureNodes: 5,
          architectureEdges: 3,
          bomItems: 10,
          projects: 2,
        },
      });
    });

    it('does not execute delete operations in dry-run mode', async () => {
      setupCountMocks(5, 3, 10, 2);

      const req = mockReq({
        headers: { 'x-admin-key': ADMIN_KEY } as Record<string, string>,
        query: { dryRun: 'true' },
      });
      const res = mockRes();

      await handler(req, res, next);

      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('logs audit trail with dryRun=true', async () => {
      setupCountMocks(1, 0, 0, 0);

      const req = mockReq({
        headers: { 'x-admin-key': ADMIN_KEY } as Record<string, string>,
        query: { dryRun: 'true' },
        ip: '10.0.0.1',
      });
      const res = mockRes();

      await handler(req, res, next);

      expect(logger.info).toHaveBeenCalledWith(
        'admin:purge',
        expect.objectContaining({
          actor: 'test-adm...',
          ip: '10.0.0.1',
          dryRun: true,
          counts: expect.objectContaining({
            architectureNodes: 1,
          }),
        }),
      );
    });
  });

  // ---- Actual purge ----

  describe('actual purge', () => {
    it('returns 200 with counts and executes purge when valid key', async () => {
      setupCountMocks(2, 1, 4, 1);
      setupDeleteMocks();

      const req = mockReq({
        headers: { 'x-admin-key': ADMIN_KEY } as Record<string, string>,
      });
      const res = mockRes();

      await handler(req, res, next);

      expect(res._status).toBe(200);
      expect(res._json).toEqual({
        message: 'Purge complete',
        counts: {
          architectureNodes: 2,
          architectureEdges: 1,
          bomItems: 4,
          projects: 1,
        },
      });

      // 4 tables purged
      expect(mockDelete).toHaveBeenCalledTimes(4);
    });

    it('logs audit trail with dryRun=false', async () => {
      setupCountMocks(0, 0, 0, 0);
      setupDeleteMocks();

      const req = mockReq({
        headers: { 'x-admin-key': ADMIN_KEY } as Record<string, string>,
        ip: '192.168.1.100',
      });
      const res = mockRes();

      await handler(req, res, next);

      expect(logger.info).toHaveBeenCalledWith(
        'admin:purge',
        expect.objectContaining({
          dryRun: false,
          ip: '192.168.1.100',
          cutoff: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        }),
      );
    });
  });

  // ---- Key masking ----

  describe('key masking in audit logs', () => {
    it('masks the admin key to first 8 chars + "..."', async () => {
      setupCountMocks(0, 0, 0, 0);
      setupDeleteMocks();

      const req = mockReq({
        headers: { 'x-admin-key': ADMIN_KEY } as Record<string, string>,
      });
      const res = mockRes();

      await handler(req, res, next);

      expect(logger.info).toHaveBeenCalledWith(
        'admin:purge',
        expect.objectContaining({
          actor: 'test-adm...',
        }),
      );
    });

    it('masks a short key (<=8 chars) as "***"', async () => {
      const shortKey = 'abc';
      process.env.ADMIN_API_KEY = shortKey;
      handler = captureHandler();

      setupCountMocks(0, 0, 0, 0);
      setupDeleteMocks();

      const req = mockReq({
        headers: { 'x-admin-key': shortKey } as Record<string, string>,
      });
      const res = mockRes();

      await handler(req, res, next);

      expect(logger.info).toHaveBeenCalledWith(
        'admin:purge',
        expect.objectContaining({
          actor: '***',
        }),
      );
    });
  });
});
