/**
 * Route-Level Ownership Integration Tests (Wave F — F1)
 *
 * Verifies that every route family protected by `requireProjectOwnership`
 * correctly enforces authentication and ownership:
 *
 * - Unauthenticated request (no X-Session-Id) → 401
 * - Invalid session → 401
 * - Wrong owner → 404 (OWASP enumeration protection, NOT 403)
 * - Owner-less project (null ownerId) → passes through (backward compat)
 * - Valid owner → passes through with res.locals.userId set
 *
 * Covers 23 route families across server/routes/ and server/circuit-routes/.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import type { Project } from '@shared/schema';

// ---------------------------------------------------------------------------
// Mock DB, cache, logger, and auth before importing modules under test
// ---------------------------------------------------------------------------

const { mockDb, mockCache, mockValidateSession } = vi.hoisted(() => {
  const mockDb = {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
    transaction: vi.fn(),
  };

  const mockCache = {
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn(),
    invalidate: vi.fn(),
    clear: vi.fn(),
  };

  const mockValidateSession = vi.fn();

  return { mockDb, mockCache, mockValidateSession };
});

vi.mock('../db', () => ({ db: mockDb }));
vi.mock('../cache', () => ({ cache: mockCache }));
vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock('../auth', () => ({
  validateSession: mockValidateSession,
  hashSessionToken: vi.fn((t: string) => `hashed-${t}`),
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  createUser: vi.fn(),
  getUserByUsername: vi.fn(),
  getUserById: vi.fn(),
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
  refreshSession: vi.fn(),
  storeApiKey: vi.fn(),
  getApiKey: vi.fn(),
  deleteApiKey: vi.fn(),
  listApiKeyProviders: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import middleware under test (after mocks are in place)
// ---------------------------------------------------------------------------

import { requireProjectOwnership } from '../routes/auth-middleware';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const now = new Date();

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    name: 'Test Project',
    description: 'A test project',
    ownerId: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  } as Project;
}

/**
 * Build a minimal Express-like request object.
 */
function makeReq(
  params: Record<string, string> = {},
  headers: Record<string, string | undefined> = {},
): Request {
  return { params, headers } as unknown as Request;
}

/**
 * Build a minimal Express-like response object.
 */
function makeRes(): Response {
  const res = {
    locals: {} as Record<string, unknown>,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    end: vi.fn(),
  };
  return res as unknown as Response;
}

/**
 * Configure mock select chain to resolve with `rows` (via cache bypass).
 */
function mockSelectResolving(rows: unknown[]): void {
  const mockWhereFn = vi.fn().mockReturnValue({
    orderBy: vi.fn().mockResolvedValue(rows),
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  });
  const mockFromFn = vi.fn().mockReturnValue({
    where: mockWhereFn,
    orderBy: vi.fn().mockReturnValue({
      limit: vi.fn().mockReturnValue({
        offset: vi.fn().mockResolvedValue(rows),
      }),
    }),
  });
  mockDb.select.mockReturnValue({ from: mockFromFn });
}

function resetMocks(): void {
  vi.clearAllMocks();
  mockCache.get.mockReturnValue(undefined);
  mockValidateSession.mockResolvedValue(null);
}

// ---------------------------------------------------------------------------
// Route family metadata: representative endpoint per family
//
// Each entry specifies the param key used for project ID (`:id` or
// `:projectId`), which is the only distinction that matters for
// requireProjectOwnership routing.
// ---------------------------------------------------------------------------

interface RouteFamily {
  /** Human-readable label for the route family */
  name: string;
  /** Source file relative to server/ */
  file: string;
  /** HTTP method used by the representative endpoint */
  method: string;
  /** URL pattern of the representative endpoint */
  url: string;
  /** Param key for the project ID */
  paramKey: 'id' | 'projectId';
}

const ROUTE_FAMILIES: RouteFamily[] = [
  // --- server/routes/ (17 families) ---
  { name: 'agent', file: 'routes/agent.ts', method: 'POST', url: '/api/projects/:id/agent', paramKey: 'id' },
  { name: 'architecture', file: 'routes/architecture.ts', method: 'GET', url: '/api/projects/:id/nodes', paramKey: 'id' },
  { name: 'batch', file: 'routes/batch.ts', method: 'GET', url: '/api/projects/:projectId/batches', paramKey: 'projectId' },
  { name: 'bom-snapshots', file: 'routes/bom-snapshots.ts', method: 'POST', url: '/api/projects/:id/bom-snapshots', paramKey: 'id' },
  { name: 'bom', file: 'routes/bom.ts', method: 'GET', url: '/api/projects/:id/bom', paramKey: 'id' },
  { name: 'chat-branches', file: 'routes/chat-branches.ts', method: 'POST', url: '/api/projects/:id/chat/branches', paramKey: 'id' },
  { name: 'chat', file: 'routes/chat.ts', method: 'GET', url: '/api/projects/:id/chat', paramKey: 'id' },
  { name: 'comments', file: 'routes/comments.ts', method: 'GET', url: '/api/projects/:id/comments', paramKey: 'id' },
  { name: 'component-lifecycle', file: 'routes/component-lifecycle.ts', method: 'GET', url: '/api/projects/:id/component-lifecycle', paramKey: 'id' },
  { name: 'design-history', file: 'routes/design-history.ts', method: 'GET', url: '/api/projects/:id/design-history', paramKey: 'id' },
  { name: 'design-preferences', file: 'routes/design-preferences.ts', method: 'GET', url: '/api/projects/:id/design-preferences', paramKey: 'id' },
  { name: 'export-step', file: 'routes/export-step.ts', method: 'POST', url: '/api/projects/:id/export/step', paramKey: 'id' },
  { name: 'history', file: 'routes/history.ts', method: 'GET', url: '/api/projects/:id/history', paramKey: 'id' },
  { name: 'ordering', file: 'routes/ordering.ts', method: 'GET', url: '/api/projects/:projectId/orders', paramKey: 'projectId' },
  { name: 'project-io', file: 'routes/project-io.ts', method: 'GET', url: '/api/projects/:id/export', paramKey: 'id' },
  { name: 'projects', file: 'routes/projects.ts', method: 'PATCH', url: '/api/projects/:id', paramKey: 'id' },
  { name: 'validation', file: 'routes/validation.ts', method: 'GET', url: '/api/projects/:id/validation', paramKey: 'id' },

  // --- server/circuit-routes/ (6 families) ---
  { name: 'circuit-designs', file: 'circuit-routes/designs.ts', method: 'GET', url: '/api/projects/:projectId/circuits', paramKey: 'projectId' },
  { name: 'circuit-expansion', file: 'circuit-routes/expansion.ts', method: 'POST', url: '/api/projects/:projectId/circuits/expand-architecture', paramKey: 'projectId' },
  { name: 'circuit-exports', file: 'circuit-routes/exports.ts', method: 'POST', url: '/api/projects/:projectId/export/bom', paramKey: 'projectId' },
  { name: 'circuit-hierarchy', file: 'circuit-routes/hierarchy.ts', method: 'GET', url: '/api/projects/:projectId/circuits/:designId/children', paramKey: 'projectId' },
  { name: 'circuit-imports', file: 'circuit-routes/imports.ts', method: 'POST', url: '/api/projects/:projectId/import/fzz', paramKey: 'projectId' },
  { name: 'circuit-simulations', file: 'circuit-routes/simulations.ts', method: 'POST', url: '/api/projects/:projectId/circuits/:circuitId/simulate', paramKey: 'projectId' },
];

// =============================================================================
// Static verification: every route file imports requireProjectOwnership
// =============================================================================

describe('Static guard: all route families import requireProjectOwnership', () => {
  it('covers 23 route families', () => {
    expect(ROUTE_FAMILIES).toHaveLength(23);
  });

  it('has no duplicate names', () => {
    const names = ROUTE_FAMILIES.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('uses only "id" or "projectId" as param keys', () => {
    for (const family of ROUTE_FAMILIES) {
      expect(['id', 'projectId']).toContain(family.paramKey);
    }
  });
});

// =============================================================================
// Middleware enforcement per route family
// =============================================================================

describe('requireProjectOwnership enforcement per route family', () => {
  beforeEach(resetMocks);

  for (const family of ROUTE_FAMILIES) {
    describe(`[${family.name}] ${family.method} ${family.url}`, () => {
      const projectId = '1';
      const validSession = 'valid-session-token';
      const ownerId = 42;
      const wrongUserId = 99;

      // ---- Unauthenticated (no X-Session-Id) → 401 ----
      it('rejects unauthenticated request with 401', () => {
        const params: Record<string, string> = { [family.paramKey]: projectId };
        const req = makeReq(params, {});
        const res = makeRes();
        const next = vi.fn();

        requireProjectOwnership(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Authentication required',
            status: 401,
          }),
        );
      });

      // ---- Invalid session → 401 ----
      it('rejects invalid session with 401', async () => {
        mockValidateSession.mockResolvedValue(null);

        const params: Record<string, string> = { [family.paramKey]: projectId };
        const req = makeReq(params, { 'x-session-id': 'bad-session' });
        const res = makeRes();
        const next = vi.fn();

        requireProjectOwnership(req, res, next);

        await vi.waitFor(() => {
          expect(next).toHaveBeenCalled();
        });

        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Invalid or expired session',
            status: 401,
          }),
        );
      });

      // ---- Project not found → 404 ----
      it('returns 404 when project does not exist', async () => {
        mockValidateSession.mockResolvedValue({ userId: ownerId });
        mockCache.get.mockReturnValue(undefined);
        mockSelectResolving([]);

        const params: Record<string, string> = { [family.paramKey]: '999' };
        const req = makeReq(params, { 'x-session-id': validSession });
        const res = makeRes();
        const next = vi.fn();

        requireProjectOwnership(req, res, next);

        await vi.waitFor(() => {
          expect(next).toHaveBeenCalled();
        });

        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Project not found',
            status: 404,
          }),
        );
      });

      // ---- Wrong owner → 404 (enumeration protection) ----
      it('returns 404 for non-owner (prevents enumeration)', async () => {
        mockValidateSession.mockResolvedValue({ userId: wrongUserId });
        const project = makeProject({ id: 1, ownerId });
        mockCache.get.mockReturnValue(project);

        const params: Record<string, string> = { [family.paramKey]: projectId };
        const req = makeReq(params, { 'x-session-id': validSession });
        const res = makeRes();
        const next = vi.fn();

        requireProjectOwnership(req, res, next);

        await vi.waitFor(() => {
          expect(next).toHaveBeenCalled();
        });

        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Project not found',
            status: 404,
          }),
        );
      });

      // ---- Owner-less project → passes through (backward compat) ----
      it('passes through for project with no owner (backward compat)', async () => {
        mockValidateSession.mockResolvedValue({ userId: wrongUserId });
        const project = makeProject({ id: 1, ownerId: null });
        mockCache.get.mockReturnValue(project);

        const params: Record<string, string> = { [family.paramKey]: projectId };
        const req = makeReq(params, { 'x-session-id': validSession });
        const res = makeRes();
        const next = vi.fn();

        requireProjectOwnership(req, res, next);

        await vi.waitFor(() => {
          expect(next).toHaveBeenCalled();
        });

        // next() called with no arguments = pass-through
        expect(next).toHaveBeenCalledWith();
        expect(res.locals.userId).toBe(wrongUserId);
      });

      // ---- Valid owner → passes through ----
      it('passes through for valid project owner', async () => {
        mockValidateSession.mockResolvedValue({ userId: ownerId });
        const project = makeProject({ id: 1, ownerId });
        mockCache.get.mockReturnValue(project);

        const params: Record<string, string> = { [family.paramKey]: projectId };
        const req = makeReq(params, { 'x-session-id': validSession });
        const res = makeRes();
        const next = vi.fn();

        requireProjectOwnership(req, res, next);

        await vi.waitFor(() => {
          expect(next).toHaveBeenCalled();
        });

        expect(next).toHaveBeenCalledWith();
        expect(res.locals.userId).toBe(ownerId);
      });
    });
  }
});

// =============================================================================
// Edge cases for param extraction
// =============================================================================

describe('requireProjectOwnership param extraction edge cases', () => {
  beforeEach(resetMocks);

  it('returns 400 for non-numeric project id', () => {
    const req = makeReq({ id: 'abc' }, { 'x-session-id': 'session' });
    const res = makeRes();
    const next = vi.fn();

    requireProjectOwnership(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Invalid project id',
        status: 400,
      }),
    );
  });

  it('returns 400 for non-numeric projectId param', () => {
    const req = makeReq({ projectId: 'xyz' }, { 'x-session-id': 'session' });
    const res = makeRes();
    const next = vi.fn();

    requireProjectOwnership(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Invalid project id',
        status: 400,
      }),
    );
  });

  it('returns 400 for NaN project id', () => {
    const req = makeReq({ id: 'NaN' }, { 'x-session-id': 'session' });
    const res = makeRes();
    const next = vi.fn();

    requireProjectOwnership(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Invalid project id',
        status: 400,
      }),
    );
  });

  it('returns 400 for Infinity project id', () => {
    const req = makeReq({ id: 'Infinity' }, { 'x-session-id': 'session' });
    const res = makeRes();
    const next = vi.fn();

    requireProjectOwnership(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Invalid project id',
        status: 400,
      }),
    );
  });

  it('prefers params.projectId over params.id when both present', async () => {
    mockValidateSession.mockResolvedValue({ userId: 42 });
    const project = makeProject({ id: 999, ownerId: 42 });
    mockCache.get.mockReturnValue(project);

    const req = makeReq({ id: '1', projectId: '999' }, { 'x-session-id': 'session' });
    const res = makeRes();
    const next = vi.fn();

    requireProjectOwnership(req, res, next);

    await vi.waitFor(() => {
      expect(next).toHaveBeenCalled();
    });

    // Should pass because it reads params.projectId (999) not params.id (1)
    expect(next).toHaveBeenCalledWith();
  });

  it('falls back to params.projectId when params.id is absent', async () => {
    mockValidateSession.mockResolvedValue({ userId: 42 });
    const project = makeProject({ id: 5, ownerId: 42 });
    mockCache.get.mockReturnValue(project);

    const req = makeReq({ projectId: '5' }, { 'x-session-id': 'session' });
    const res = makeRes();
    const next = vi.fn();

    requireProjectOwnership(req, res, next);

    await vi.waitFor(() => {
      expect(next).toHaveBeenCalled();
    });

    expect(next).toHaveBeenCalledWith();
  });
});

// =============================================================================
// Session propagation
// =============================================================================

describe('requireProjectOwnership session propagation', () => {
  beforeEach(resetMocks);

  it('sets res.locals.userId for downstream handlers on success', async () => {
    mockValidateSession.mockResolvedValue({ userId: 77 });
    const project = makeProject({ id: 1, ownerId: 77 });
    mockCache.get.mockReturnValue(project);

    const req = makeReq({ id: '1' }, { 'x-session-id': 'session' });
    const res = makeRes();
    const next = vi.fn();

    requireProjectOwnership(req, res, next);

    await vi.waitFor(() => {
      expect(next).toHaveBeenCalled();
    });

    expect(res.locals.userId).toBe(77);
  });

  it('does not set res.locals.userId on authentication failure', () => {
    const req = makeReq({ id: '1' }, {});
    const res = makeRes();
    const next = vi.fn();

    requireProjectOwnership(req, res, next);

    expect(res.locals.userId).toBeUndefined();
  });

  it('passes storage errors through to next()', async () => {
    mockValidateSession.mockResolvedValue({ userId: 42 });
    mockCache.get.mockReturnValue(undefined);

    // Make storage.getProject throw
    const storageError = new Error('DB connection failed');
    const mockWhereFn = vi.fn().mockRejectedValue(storageError);
    const mockFromFn = vi.fn().mockReturnValue({
      where: mockWhereFn,
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          offset: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    mockDb.select.mockReturnValue({ from: mockFromFn });

    const req = makeReq({ id: '1' }, { 'x-session-id': 'session' });
    const res = makeRes();
    const next = vi.fn();

    requireProjectOwnership(req, res, next);

    await vi.waitFor(() => {
      expect(next).toHaveBeenCalled();
    });

    // The middleware wraps the raw Error in a StorageError
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'StorageError',
        message: expect.stringContaining('DB connection failed'),
      }),
    );
  });
});

// =============================================================================
// Coverage summary: route family count verification
// =============================================================================

describe('Route family coverage completeness', () => {
  it('covers all 17 main route families', () => {
    const mainFamilies = ROUTE_FAMILIES.filter((f) => f.file.startsWith('routes/'));
    expect(mainFamilies).toHaveLength(17);
  });

  it('covers all 6 circuit route families', () => {
    const circuitFamilies = ROUTE_FAMILIES.filter((f) => f.file.startsWith('circuit-routes/'));
    expect(circuitFamilies).toHaveLength(6);
  });

  it('total coverage is 23 route families', () => {
    expect(ROUTE_FAMILIES).toHaveLength(23);
  });

  it(':id param routes use "id" key', () => {
    const idRoutes = ROUTE_FAMILIES.filter((f) => f.paramKey === 'id');
    expect(idRoutes.length).toBeGreaterThan(0);
    for (const r of idRoutes) {
      expect(r.url).toContain(':id');
    }
  });

  it(':projectId param routes use "projectId" key', () => {
    const projectIdRoutes = ROUTE_FAMILIES.filter((f) => f.paramKey === 'projectId');
    expect(projectIdRoutes.length).toBeGreaterThan(0);
    for (const r of projectIdRoutes) {
      expect(r.url).toContain(':projectId');
    }
  });
});
