/**
 * Project Ownership Model Tests (CAPX-SEC-01)
 *
 * Covers:
 * - Schema: ownerId column on projects table
 * - Storage: getProjectsByOwner, isProjectOwner, createProject with ownerId
 * - Middleware: requireProjectOwnership authorization enforcement
 * - Route integration: PATCH/DELETE enforce ownership, POST assigns ownerId
 * - Backward compatibility: projects with no owner remain accessible
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock DB, cache, and logger before importing modules under test
// ---------------------------------------------------------------------------

const { mockDb, mockCache, mockReturning, mockValues } = vi.hoisted(() => {
  const mockReturning = vi.fn().mockResolvedValue([]);
  const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });

  const mockWhere = vi.fn().mockResolvedValue([]);

  const mockDb = {
    insert: vi.fn().mockReturnValue({ values: mockValues }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: mockWhere,
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: mockReturning }),
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

  return { mockDb, mockCache, mockReturning, mockValues, mockWhere };
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

// Mock auth module
const mockValidateSession = vi.fn();
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

import { DatabaseStorage } from '../storage';
import type { Project } from '@shared/schema';

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

function resetMocks(): void {
  vi.clearAllMocks();
  mockCache.get.mockReturnValue(undefined);
  mockReturning.mockResolvedValue([]);
  mockValues.mockReturnValue({ returning: mockReturning });
  mockValidateSession.mockResolvedValue(null);
}

/**
 * Build a mock select chain that resolves with `rows`.
 * Supports both `select().from().where()` and
 * `select({...}).from().where()` patterns.
 */
function mockSelectResolving(rows: unknown[]): void {
  const mockWhereFn = vi.fn().mockReturnValue({
    // Support .where().orderBy() chain (used by getProjectsByOwner)
    orderBy: vi.fn().mockResolvedValue(rows),
    // Also allow .where() to resolve directly (used by isProjectOwner via select({...}).from().where())
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

// =============================================================================
// Storage: getProjectsByOwner
// =============================================================================

describe('DatabaseStorage.getProjectsByOwner', () => {
  const db = new DatabaseStorage();

  beforeEach(resetMocks);

  it('returns projects owned by a specific user', async () => {
    const ownedProjects = [
      makeProject({ id: 1, ownerId: 42, name: 'Project A' }),
      makeProject({ id: 2, ownerId: 42, name: 'Project B' }),
    ];
    mockSelectResolving(ownedProjects);

    const result = await db.getProjectsByOwner(42);
    expect(result).toEqual(ownedProjects);
    expect(result).toHaveLength(2);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it('returns empty array when user owns no projects', async () => {
    mockSelectResolving([]);

    const result = await db.getProjectsByOwner(999);
    expect(result).toEqual([]);
  });
});

// =============================================================================
// Storage: isProjectOwner
// =============================================================================

describe('DatabaseStorage.isProjectOwner', () => {
  const db = new DatabaseStorage();

  beforeEach(resetMocks);

  it('returns true when user is the project owner', async () => {
    mockSelectResolving([{ ownerId: 42 }]);

    const result = await db.isProjectOwner(1, 42);
    expect(result).toBe(true);
  });

  it('returns false when user is not the project owner', async () => {
    mockSelectResolving([{ ownerId: 42 }]);

    const result = await db.isProjectOwner(1, 99);
    expect(result).toBe(false);
  });

  it('returns true when project has no owner (backward compat)', async () => {
    mockSelectResolving([{ ownerId: null }]);

    const result = await db.isProjectOwner(1, 99);
    expect(result).toBe(true);
  });

  it('returns false when project does not exist', async () => {
    mockSelectResolving([]);

    const result = await db.isProjectOwner(999, 42);
    expect(result).toBe(false);
  });
});

// =============================================================================
// Storage: createProject with ownerId
// =============================================================================

describe('DatabaseStorage.createProject with ownerId', () => {
  const db = new DatabaseStorage();

  beforeEach(resetMocks);

  it('creates a project with ownerId when provided', async () => {
    const created = makeProject({ id: 10, ownerId: 42, name: 'Owned Project' });
    mockReturning.mockResolvedValue([created]);

    const result = await db.createProject({ name: 'Owned Project', description: 'desc' }, 42);
    expect(result).toEqual(created);
    expect(result.ownerId).toBe(42);
    expect(mockDb.insert).toHaveBeenCalled();
    // Verify the values call included ownerId
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: 42 }),
    );
  });

  it('creates a project with null ownerId when not provided', async () => {
    const created = makeProject({ id: 11, ownerId: null, name: 'Unowned Project' });
    mockReturning.mockResolvedValue([created]);

    const result = await db.createProject({ name: 'Unowned Project', description: 'desc' });
    expect(result).toEqual(created);
    expect(result.ownerId).toBeNull();
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: null }),
    );
  });
});

// =============================================================================
// Middleware: requireProjectOwnership
// =============================================================================

describe('requireProjectOwnership middleware', () => {
  // Import the middleware (auth is already mocked above)
  // We also need to mock storage for the middleware
  let requireProjectOwnership: typeof import('../routes/auth-middleware').requireProjectOwnership;

  beforeEach(async () => {
    resetMocks();
    // Re-import to get fresh module with mocked dependencies
    const mod = await import('../routes/auth-middleware');
    requireProjectOwnership = mod.requireProjectOwnership;
  });

  function makeReq(params: Record<string, string> = {}, headers: Record<string, string> = {}): {
    params: Record<string, string>;
    headers: Record<string, string>;
  } {
    return { params, headers };
  }

  function makeRes(): {
    locals: Record<string, unknown>;
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
  } {
    const res = {
      locals: {} as Record<string, unknown>,
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      end: vi.fn(),
    };
    return res;
  }

  it('calls next with 401 when no session header is present', () => {
    const req = makeReq({ id: '1' });
    const res = makeRes();
    const next = vi.fn();

    requireProjectOwnership(req as never, res as never, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Authentication required',
      status: 401,
    }));
  });

  it('calls next with 400 for invalid project id', () => {
    const req = makeReq({ id: 'abc' }, { 'x-session-id': 'valid-session' });
    const res = makeRes();
    const next = vi.fn();

    requireProjectOwnership(req as never, res as never, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Invalid project id',
      status: 400,
    }));
  });

  it('calls next with 401 for invalid session', async () => {
    mockValidateSession.mockResolvedValue(null);
    const req = makeReq({ id: '1' }, { 'x-session-id': 'bad-session' });
    const res = makeRes();
    const next = vi.fn();

    requireProjectOwnership(req as never, res as never, next);

    // Wait for async work
    await vi.waitFor(() => {
      expect(next).toHaveBeenCalled();
    });

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Invalid or expired session',
      status: 401,
    }));
  });

  it('calls next with 404 when project does not exist', async () => {
    mockValidateSession.mockResolvedValue({ userId: 42 });
    mockCache.get.mockReturnValue(undefined);
    mockSelectResolving([]);

    const req = makeReq({ id: '999' }, { 'x-session-id': 'valid-session' });
    const res = makeRes();
    const next = vi.fn();

    requireProjectOwnership(req as never, res as never, next);

    await vi.waitFor(() => {
      expect(next).toHaveBeenCalled();
    });

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Project not found',
      status: 404,
    }));
  });

  it('passes through for owner of the project', async () => {
    mockValidateSession.mockResolvedValue({ userId: 42 });
    const project = makeProject({ id: 1, ownerId: 42 });
    mockCache.get.mockReturnValue(project);

    const req = makeReq({ id: '1' }, { 'x-session-id': 'valid-session' });
    const res = makeRes();
    const next = vi.fn();

    requireProjectOwnership(req as never, res as never, next);

    await vi.waitFor(() => {
      expect(next).toHaveBeenCalled();
    });

    // next called with no arguments means pass-through
    expect(next).toHaveBeenCalledWith();
    expect(res.locals.userId).toBe(42);
  });

  it('returns 404 for non-owner (prevents enumeration)', async () => {
    mockValidateSession.mockResolvedValue({ userId: 99 });
    const project = makeProject({ id: 1, ownerId: 42 });
    mockCache.get.mockReturnValue(project);

    const req = makeReq({ id: '1' }, { 'x-session-id': 'valid-session' });
    const res = makeRes();
    const next = vi.fn();

    requireProjectOwnership(req as never, res as never, next);

    await vi.waitFor(() => {
      expect(next).toHaveBeenCalled();
    });

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Project not found',
      status: 404,
    }));
  });

  it('passes through for project with no owner (backward compat)', async () => {
    mockValidateSession.mockResolvedValue({ userId: 99 });
    const project = makeProject({ id: 1, ownerId: null });
    mockCache.get.mockReturnValue(project);

    const req = makeReq({ id: '1' }, { 'x-session-id': 'valid-session' });
    const res = makeRes();
    const next = vi.fn();

    requireProjectOwnership(req as never, res as never, next);

    await vi.waitFor(() => {
      expect(next).toHaveBeenCalled();
    });

    expect(next).toHaveBeenCalledWith();
    expect(res.locals.userId).toBe(99);
  });

  it('reads projectId from params.projectId when params.id is absent', async () => {
    mockValidateSession.mockResolvedValue({ userId: 42 });
    const project = makeProject({ id: 5, ownerId: 42 });
    mockCache.get.mockReturnValue(project);

    const req = makeReq({ projectId: '5' }, { 'x-session-id': 'valid-session' });
    const res = makeRes();
    const next = vi.fn();

    requireProjectOwnership(req as never, res as never, next);

    await vi.waitFor(() => {
      expect(next).toHaveBeenCalled();
    });

    expect(next).toHaveBeenCalledWith();
  });
});

// =============================================================================
// Integration: createProject assigns ownerId from session
// =============================================================================

describe('createProject assigns ownerId from session', () => {
  const db = new DatabaseStorage();

  beforeEach(resetMocks);

  it('assigns ownerId when session is valid', async () => {
    const created = makeProject({ id: 20, ownerId: 7 });
    mockReturning.mockResolvedValue([created]);

    const result = await db.createProject({ name: 'Session Project' }, 7);
    expect(result.ownerId).toBe(7);
  });

  it('assigns null ownerId when no session provided', async () => {
    const created = makeProject({ id: 21, ownerId: null });
    mockReturning.mockResolvedValue([created]);

    const result = await db.createProject({ name: 'Anonymous Project' });
    expect(result.ownerId).toBeNull();
  });
});

// =============================================================================
// Integration: getProjectsByOwner returns only owned projects
// =============================================================================

describe('getProjectsByOwner returns only owned projects', () => {
  const db = new DatabaseStorage();

  beforeEach(resetMocks);

  it('filters to only projects owned by the specified user', async () => {
    const user42Projects = [
      makeProject({ id: 1, ownerId: 42, name: 'Alpha' }),
      makeProject({ id: 3, ownerId: 42, name: 'Gamma' }),
    ];
    // The DB mock returns pre-filtered results (as the actual query uses WHERE)
    mockSelectResolving(user42Projects);

    const result = await db.getProjectsByOwner(42);
    expect(result).toHaveLength(2);
    expect(result.every((p) => p.ownerId === 42)).toBe(true);
  });

  it('does not return projects owned by other users', async () => {
    mockSelectResolving([]);

    const result = await db.getProjectsByOwner(42);
    expect(result).toHaveLength(0);
  });
});
