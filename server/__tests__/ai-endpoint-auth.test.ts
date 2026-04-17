/**
 * AI Endpoint Auth Regression Tests (AI Audit CRITICAL AI-RT-01 / AI-RT-02)
 *
 * Locks in the security fixes from commit e199faad (2026-03-27):
 *
 * AI-RT-01 — Circuit-AI endpoints must require `requireCircuitOwnership`
 *   - POST /api/circuits/:circuitId/ai/generate
 *   - POST /api/circuits/:circuitId/ai/review
 *   - POST /api/circuits/:circuitId/ai/analyze
 *
 * AI-RT-02 — `/api/genkit-test` must be gated behind NODE_ENV === 'development'
 *   and must NOT be registered in non-dev environments.
 *
 * Coverage:
 *   1. Static source verification — each route file imports + wires the
 *      middleware. Catches accidental removal of the auth gate.
 *   2. Middleware behavior — unauthenticated → 401, invalid session → 401,
 *      wrong owner → 404 (enumeration-safe), valid owner → pass-through.
 *      Only the AUTH gate is in scope here; ownership correctness is covered
 *      by the broader ownership-integration.test.ts suite — we re-assert the
 *      happy path on circuits to catch regressions in the circuit→project
 *      resolution path specifically.
 *   3. Dev-gate — `/api/genkit-test` only registers when NODE_ENV=development.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import type { Request, Response } from 'express';
import type { Project, CircuitDesignRow } from '@shared/schema';

// ---------------------------------------------------------------------------
// Mocks (must be declared before imports of the module under test)
// ---------------------------------------------------------------------------

const { mockValidateSession, mockGetCircuitDesign, mockGetProject } = vi.hoisted(() => ({
  mockValidateSession: vi.fn(),
  mockGetCircuitDesign: vi.fn(),
  mockGetProject: vi.fn(),
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

vi.mock('../storage', () => ({
  storage: {
    getCircuitDesign: mockGetCircuitDesign,
    getProject: mockGetProject,
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

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------

import { requireCircuitOwnership } from '../routes/auth-middleware';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const now = new Date();

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    name: 'Test Project',
    description: null,
    ownerId: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  } as Project;
}

function makeCircuit(overrides: Partial<CircuitDesignRow> = {}): CircuitDesignRow {
  return {
    id: 10,
    projectId: 1,
    name: 'Main Circuit',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as CircuitDesignRow;
}

function makeReq(
  params: Record<string, string> = {},
  headers: Record<string, string | undefined> = {},
): Request {
  return { params, headers } as unknown as Request;
}

function makeRes(): Response {
  return {
    locals: {} as Record<string, unknown>,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    end: vi.fn(),
  } as unknown as Response;
}

function resetMocks(): void {
  vi.clearAllMocks();
  mockValidateSession.mockReset();
  mockGetCircuitDesign.mockReset();
  mockGetProject.mockReset();
}

// ---------------------------------------------------------------------------
// AI-RT-01: Static source verification — circuit-ai routes wire the middleware
// ---------------------------------------------------------------------------

describe('AI-RT-01 static guard: circuit-ai routes wire requireCircuitOwnership', () => {
  const CIRCUIT_AI_FILES = ['generate.ts', 'review.ts', 'analyze.ts'] as const;
  const ROOT = path.resolve(import.meta.dirname, '..', 'circuit-ai');

  for (const file of CIRCUIT_AI_FILES) {
    it(`${file} imports requireCircuitOwnership`, () => {
      const source = readFileSync(path.join(ROOT, file), 'utf8');
      expect(source).toMatch(/import\s+\{[^}]*requireCircuitOwnership[^}]*\}\s+from\s+['"][^'"]+auth-middleware['"]/);
    });

    it(`${file} wires requireCircuitOwnership on app.post`, () => {
      const source = readFileSync(path.join(ROOT, file), 'utf8');
      // The middleware must appear as one of the args to app.post(...)
      // on the /api/circuits/:circuitId/ai/... route.
      expect(source).toMatch(/app\.post\(\s*['"`]\/api\/circuits\/:circuitId\/ai\/[a-z]+['"`][\s\S]*?requireCircuitOwnership/);
    });
  }
});

// ---------------------------------------------------------------------------
// AI-RT-01: Middleware behavior on circuit-ai routes
// ---------------------------------------------------------------------------

describe('AI-RT-01 circuit-AI auth gate (requireCircuitOwnership)', () => {
  const circuitId = '10';
  const validSession = 'valid-session-token';
  const ownerId = 42;
  const wrongUserId = 99;

  beforeEach(resetMocks);

  // --- Unauthenticated (no X-Session-Id) → 401 ---
  it('rejects unauthenticated request with 401', () => {
    const req = makeReq({ circuitId }, {});
    const res = makeRes();
    const next = vi.fn();

    requireCircuitOwnership(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Authentication required',
        status: 401,
      }),
    );
    // Critical: must not touch storage when unauth'd.
    expect(mockGetCircuitDesign).not.toHaveBeenCalled();
    expect(mockGetProject).not.toHaveBeenCalled();
  });

  // --- Invalid session → 401 ---
  it('rejects invalid session with 401', async () => {
    mockValidateSession.mockResolvedValue(null);

    const req = makeReq({ circuitId }, { 'x-session-id': 'bad-session' });
    const res = makeRes();
    const next = vi.fn();

    requireCircuitOwnership(req, res, next);

    await vi.waitFor(() => {
      expect(next).toHaveBeenCalled();
    });

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Invalid or expired session',
        status: 401,
      }),
    );
    expect(mockGetCircuitDesign).not.toHaveBeenCalled();
  });

  // --- Circuit not found → 404 ---
  it('returns 404 when circuit design does not exist', async () => {
    mockValidateSession.mockResolvedValue({ userId: ownerId });
    mockGetCircuitDesign.mockResolvedValue(undefined);

    const req = makeReq({ circuitId: '999' }, { 'x-session-id': validSession });
    const res = makeRes();
    const next = vi.fn();

    requireCircuitOwnership(req, res, next);

    await vi.waitFor(() => {
      expect(next).toHaveBeenCalled();
    });

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Circuit design not found',
        status: 404,
      }),
    );
  });

  // --- Project for circuit not found → 404 ---
  it("returns 404 when the circuit's project is missing", async () => {
    mockValidateSession.mockResolvedValue({ userId: ownerId });
    mockGetCircuitDesign.mockResolvedValue(makeCircuit({ projectId: 1 }));
    mockGetProject.mockResolvedValue(undefined);

    const req = makeReq({ circuitId }, { 'x-session-id': validSession });
    const res = makeRes();
    const next = vi.fn();

    requireCircuitOwnership(req, res, next);

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

  // --- Wrong owner → 404 (enumeration protection) ---
  it('returns 404 for non-owner (prevents enumeration)', async () => {
    mockValidateSession.mockResolvedValue({ userId: wrongUserId });
    mockGetCircuitDesign.mockResolvedValue(makeCircuit({ projectId: 1 }));
    mockGetProject.mockResolvedValue(makeProject({ id: 1, ownerId }));

    const req = makeReq({ circuitId }, { 'x-session-id': validSession });
    const res = makeRes();
    const next = vi.fn();

    requireCircuitOwnership(req, res, next);

    await vi.waitFor(() => {
      expect(next).toHaveBeenCalled();
    });

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Circuit design not found',
        status: 404,
      }),
    );
  });

  // --- Valid owner → pass-through ---
  it('passes through for a valid owner (happy path)', async () => {
    mockValidateSession.mockResolvedValue({ userId: ownerId });
    mockGetCircuitDesign.mockResolvedValue(makeCircuit({ projectId: 1 }));
    mockGetProject.mockResolvedValue(makeProject({ id: 1, ownerId }));

    const req = makeReq({ circuitId }, { 'x-session-id': validSession });
    const res = makeRes();
    const next = vi.fn();

    requireCircuitOwnership(req, res, next);

    await vi.waitFor(() => {
      expect(next).toHaveBeenCalled();
    });

    // next() called with no args = pass-through
    expect(next).toHaveBeenCalledWith();
    expect(res.locals.userId).toBe(ownerId);
  });

  // --- Owner-less project (ownerId=null) → pass-through (backward compat) ---
  it('passes through for a circuit whose project has no owner (backward compat)', async () => {
    mockValidateSession.mockResolvedValue({ userId: wrongUserId });
    mockGetCircuitDesign.mockResolvedValue(makeCircuit({ projectId: 1 }));
    mockGetProject.mockResolvedValue(makeProject({ id: 1, ownerId: null }));

    const req = makeReq({ circuitId }, { 'x-session-id': validSession });
    const res = makeRes();
    const next = vi.fn();

    requireCircuitOwnership(req, res, next);

    await vi.waitFor(() => {
      expect(next).toHaveBeenCalled();
    });

    expect(next).toHaveBeenCalledWith();
    expect(res.locals.userId).toBe(wrongUserId);
  });
});

// ---------------------------------------------------------------------------
// AI-RT-02: /api/genkit-test must be dev-gated
// ---------------------------------------------------------------------------

describe('AI-RT-02 static guard: /api/genkit-test is dev-gated', () => {
  const ROUTES_FILE = path.resolve(import.meta.dirname, '..', 'routes.ts');
  const source = readFileSync(ROUTES_FILE, 'utf8');

  it('declares the /api/genkit-test route', () => {
    expect(source).toMatch(/['"`]\/api\/genkit-test['"`]/);
  });

  it('wraps the /api/genkit-test registration in a NODE_ENV === development gate', () => {
    // Find the position of the route string, then confirm the nearest preceding
    // control-flow guard is a NODE_ENV === 'development' check.
    const routeIdx = source.search(/['"`]\/api\/genkit-test['"`]/);
    expect(routeIdx).toBeGreaterThan(-1);

    const preceding = source.slice(0, routeIdx);
    const guardMatch = preceding.match(/if\s*\(\s*process\.env\.NODE_ENV\s*===\s*['"]development['"]\s*\)\s*\{[^}]*$/s);

    expect(guardMatch, '/api/genkit-test must be registered inside an `if (process.env.NODE_ENV === "development")` block (AI-RT-02)').not.toBeNull();
  });

  it('does not register /api/genkit-test at top level outside a dev gate', () => {
    // Make sure there is no sibling `app.post('/api/genkit-test', ...)` call that
    // lives outside a NODE_ENV guard. We do this by counting total occurrences of
    // the route literal and asserting there is exactly ONE, inside the gate.
    const matches = source.match(/['"`]\/api\/genkit-test['"`]/g) ?? [];
    expect(matches.length, 'exactly one declaration of /api/genkit-test expected').toBe(1);
  });
});
