/**
 * Ownership Guard Integration Tests (WS-01)
 *
 * Codex audit Workstream WS-01: "Lock down project/circuit ownership once,
 * apply everywhere." Covers the shared ownership helpers that back routes +
 * AI tool executors that accept caller-supplied project/circuit IDs:
 *
 * - `assertProjectOwnership(projectId, userId)` — used by routes that receive
 *   projectId as a query/body param (not URL path), so the middleware form
 *   does not fire.
 * - `assertCircuitBelongsToProject(circuitId, projectId)` — used by routes
 *   that already know the active project but need to verify a caller-supplied
 *   circuitId belongs to it.
 * - `guardCircuitInProject` in `server/ai-tools/circuit.ts` — wrapped inside
 *   tool executors so AI tool calls cannot mutate circuits in other projects
 *   by passing an ID.
 * - `resolveCircuitId` in `server/ai-tools/export.ts` — previously returned
 *   a caller-supplied ID without checking project. Now verifies the design
 *   belongs to the active `ctx.projectId`.
 *
 * Audit references:
 * - 17_BE-03 (main REST), 18_BE-04 (circuit routes), 19_BE-05 (AI), 20_BE-06
 *   (AI tool executors), 21_BE-07 (storage), 25_BE-11 (queue — already done),
 *   26_BE-12 (collab — outside WS-01).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Project } from '@shared/schema';

/**
 * Local structural alias for a circuit design row. We avoid importing the
 * drizzle `circuitDesigns` table type because @shared/schema does not
 * re-export a `CircuitDesign` row type by name.
 */
interface CircuitDesign {
  id: number;
  projectId: number;
  name: string;
  description: string | null;
  version: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

// ---------------------------------------------------------------------------
// Mock db, cache, logger, auth
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
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
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
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../auth', () => ({
  validateSession: mockValidateSession,
  hashSessionToken: vi.fn(),
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
// Imports after mocks are registered
// ---------------------------------------------------------------------------

import {
  assertProjectOwnership,
  assertCircuitBelongsToProject,
} from '../routes/auth-middleware';
import { HttpError } from '../routes/utils';
import type { IStorage } from '../storage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const now = new Date();

function makeProject(o: Partial<Project> = {}): Project {
  return {
    id: 1,
    name: 'Project A',
    description: null,
    ownerId: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...o,
  } as Project;
}

function makeCircuit(o: Partial<CircuitDesign> = {}): CircuitDesign {
  return {
    id: 10,
    projectId: 1,
    name: 'Circuit 1',
    description: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...o,
  } as CircuitDesign;
}

/** Minimal IStorage stub — only the two methods the helpers call. */
function mockStorage(
  projects: Record<number, Project | null> = {},
  designs: Record<number, CircuitDesign | null> = {},
): Partial<IStorage> {
  return {
    getProject: vi.fn(async (id: number) => projects[id] ?? null),
    getCircuitDesign: vi.fn(async (id: number) => designs[id] ?? null),
  };
}

// ---------------------------------------------------------------------------
// assertProjectOwnership
// ---------------------------------------------------------------------------

describe('assertProjectOwnership', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects invalid projectId (0)', async () => {
    const s = mockStorage() as IStorage;
    await expect(assertProjectOwnership(0, 42, s)).rejects.toBeInstanceOf(HttpError);
    await expect(assertProjectOwnership(0, 42, s)).rejects.toMatchObject({ status: 400 });
  });

  it('rejects invalid projectId (NaN)', async () => {
    const s = mockStorage() as IStorage;
    await expect(assertProjectOwnership(Number.NaN, 42, s)).rejects.toMatchObject({ status: 400 });
  });

  it('returns 404 when project does not exist', async () => {
    const s = mockStorage({ 1: null }) as IStorage;
    await expect(assertProjectOwnership(1, 42, s)).rejects.toMatchObject({ status: 404 });
  });

  it('returns 404 when userB tries to access userA project', async () => {
    const s = mockStorage({ 1: makeProject({ ownerId: 42 }) }) as IStorage;
    // User 99 is NOT owner; must get 404, NOT 403 (enumeration protection).
    await expect(assertProjectOwnership(1, 99, s)).rejects.toMatchObject({
      status: 404,
      message: 'Project not found',
    });
  });

  it('passes for the true owner', async () => {
    const s = mockStorage({ 1: makeProject({ ownerId: 42 }) }) as IStorage;
    await expect(assertProjectOwnership(1, 42, s)).resolves.toBeUndefined();
  });

  it('passes for any user on owner-less project (backward compat)', async () => {
    const s = mockStorage({ 1: makeProject({ ownerId: null }) }) as IStorage;
    await expect(assertProjectOwnership(1, 1234, s)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// assertCircuitBelongsToProject
// ---------------------------------------------------------------------------

describe('assertCircuitBelongsToProject', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects invalid circuitId', async () => {
    const s = mockStorage() as IStorage;
    await expect(assertCircuitBelongsToProject(0, 1, s)).rejects.toMatchObject({ status: 400 });
    await expect(assertCircuitBelongsToProject(-5, 1, s)).rejects.toMatchObject({ status: 400 });
  });

  it('returns 404 when circuit does not exist', async () => {
    const s = mockStorage({}, { 10: null }) as IStorage;
    await expect(assertCircuitBelongsToProject(10, 1, s)).rejects.toMatchObject({ status: 404 });
  });

  it('returns 404 when circuit belongs to a different project (cross-project IDOR)', async () => {
    // Circuit 10 is owned by project 2, but caller claims project 1 context.
    const s = mockStorage({}, { 10: makeCircuit({ projectId: 2 }) }) as IStorage;
    await expect(assertCircuitBelongsToProject(10, 1, s)).rejects.toMatchObject({
      status: 404,
      message: 'Circuit design not found',
    });
  });

  it('passes when circuit matches project', async () => {
    const s = mockStorage({}, { 10: makeCircuit({ projectId: 1 }) }) as IStorage;
    await expect(assertCircuitBelongsToProject(10, 1, s)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AI export tool: resolveCircuitId hardening
//
// Regression test for BE-06 audit finding #2: caller/model-supplied circuitId
// was returned verbatim, allowing cross-project reads through export tools.
// ---------------------------------------------------------------------------

describe('AI export tool: circuit resolution refuses cross-project IDs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('source contains ownership-check block in resolveCircuitId', () => {
    // Structural assertion: the resolveCircuitId helper must verify the
    // caller-supplied circuitId belongs to the active project. We avoid
    // importing ai-tools/export.ts (which pulls in heavy transitive
    // dependencies) and assert the source contains the hardened code path.
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const src: string = fs.readFileSync(
      path.join(__dirname, '..', 'ai-tools', 'export.ts'),
      'utf8',
    );
    expect(src).toMatch(/design\.projectId !== projectId/);
    expect(src).toMatch(/getCircuitDesign\(circuitId\)/);
  });
});

// ---------------------------------------------------------------------------
// AI circuit tool: guardCircuitInProject enforcement
//
// Regression test for BE-06 audit finding #1: mutation tools accepted
// caller/model-supplied circuitId without verifying project ownership.
// ---------------------------------------------------------------------------

describe('AI circuit tools: mutation guards reject cross-project circuitId', () => {
  it('source contains guardCircuitInProject guards on mutation executors', () => {
    // Structural assertion: every server-side execute that touches
    // ctx.storage with params.circuitId must call the guard first.
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const src: string = fs.readFileSync(
      path.join(__dirname, '..', 'ai-tools', 'circuit.ts'),
      'utf8',
    );
    // Guard function exists
    expect(src).toMatch(/async function guardCircuitInProject/);
    // At minimum 8 guard invocations — one per executor we audited
    const guardMatches = src.match(/guardCircuitInProject\(params\.circuitId, ctx\)/g) ?? [];
    expect(guardMatches.length).toBeGreaterThanOrEqual(8);
  });
});

// ---------------------------------------------------------------------------
// BOM template route: cross-user read protection
// ---------------------------------------------------------------------------

describe('BOM templates: GET /api/bom-templates/:id enforces userId scope', () => {
  it('GET :id route checks template.userId against session.userId', () => {
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const src: string = fs.readFileSync(
      path.join(__dirname, '..', 'routes', 'bom-templates.ts'),
      'utf8',
    );
    // The GET handler must compare template.userId against session.userId.
    // We assert the hardening is present and not regressed.
    expect(src).toMatch(/template\.userId !== session\.userId/);
  });
});

// ---------------------------------------------------------------------------
// Supply chain route: projectId-in-query ownership enforcement
// ---------------------------------------------------------------------------

describe('Supply-chain routes: projectId query/body filter enforces ownership', () => {
  it('routes that accept projectId call assertProjectOwnership', () => {
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const src: string = fs.readFileSync(
      path.join(__dirname, '..', 'routes', 'supply-chain.ts'),
      'utf8',
    );
    // Four places read projectId off the request (alerts GET, count GET,
    // ack-all POST, check POST) — all four must gate with the helper.
    const matches = src.match(/assertProjectOwnership\(/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(4);
  });
});
