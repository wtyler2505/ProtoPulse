/**
 * Circuit Instances Routes Tests — server/circuit-routes/instances.ts
 *
 * Tests circuit component instance CRUD endpoints.
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import { registerCircuitInstanceRoutes } from '../circuit-routes/instances';
import type { IStorage } from '../storage';

// ---------------------------------------------------------------------------
// Mock storage
// ---------------------------------------------------------------------------

const NOW = new Date('2026-03-08T12:00:00Z');

function makeInstance(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    circuitId: 1,
    partId: 1,
    referenceDesignator: 'U1',
    schematicX: 100,
    schematicY: 200,
    schematicRotation: 0,
    breadboardX: null,
    breadboardY: null,
    breadboardRotation: null,
    pcbX: null,
    pcbY: null,
    pcbRotation: null,
    pcbSide: 'front',
    properties: {},
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const mockStorage: Record<string, ReturnType<typeof vi.fn>> = {
  getCircuitDesign: vi.fn(),
  getComponentPart: vi.fn(),
  getCircuitInstances: vi.fn(),
  getCircuitInstance: vi.fn(),
  createCircuitInstance: vi.fn(),
  updateCircuitInstance: vi.fn(),
  deleteCircuitInstance: vi.fn(),
};

vi.mock('../auth', () => ({
  validateSession: vi.fn().mockResolvedValue({ userId: 1, sessionId: 'test-session' }),
}));

vi.mock('../routes/auth-middleware', () => ({
  requireProjectOwnership: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireCircuitOwnership: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../db', () => ({ db: {}, pool: {}, checkConnection: vi.fn() }));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

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

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: '150kb' }));
  registerCircuitInstanceRoutes(app, mockStorage as unknown as IStorage);

  app.use((err: { status?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err.status ?? 500;
    res.status(status).json({ message: err.message ?? 'Internal error' });
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
  delete (globalThis as { __PROTO_TEST_OPENAI_AGENTS_JUDGE__?: unknown }).__PROTO_TEST_OPENAI_AGENTS_JUDGE__;
  mockStorage.getCircuitDesign.mockResolvedValue({ id: 1, projectId: 1, name: 'Main', description: null, settings: {}, parentDesignId: null, metadata: {}, createdAt: NOW, updatedAt: NOW });
  mockStorage.getComponentPart.mockResolvedValue({ id: 1, connectors: [] });
});

// ===========================================================================
// GET /api/circuits/:circuitId/instances
// ===========================================================================

describe('GET /api/circuits/:circuitId/instances', () => {
  it('returns instances for a circuit', async () => {
    mockStorage.getCircuitInstances.mockResolvedValue([makeInstance(), makeInstance({ id: 2, referenceDesignator: 'R1' })]);

    const res = await authFetch(`${baseUrl}/api/circuits/1/instances`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number };
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(2);
  });

  it('respects pagination parameters', async () => {
    mockStorage.getCircuitInstances.mockResolvedValue([
      makeInstance({ id: 1 }),
      makeInstance({ id: 2 }),
      makeInstance({ id: 3 }),
    ]);

    const res = await authFetch(`${baseUrl}/api/circuits/1/instances?limit=2&offset=0`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number };
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(3);
  });
});

// ===========================================================================
// GET /api/circuits/:circuitId/instances/:id
// ===========================================================================

describe('GET /api/circuits/:circuitId/instances/:id', () => {
  it('returns a specific instance', async () => {
    mockStorage.getCircuitInstance.mockResolvedValue(makeInstance());

    const res = await authFetch(`${baseUrl}/api/circuits/1/instances/1`);
    expect(res.status).toBe(200);
    const body = await res.json() as { referenceDesignator: string };
    expect(body.referenceDesignator).toBe('U1');
  });

  it('returns 404 for non-existent instance', async () => {
    mockStorage.getCircuitInstance.mockResolvedValue(null);

    const res = await authFetch(`${baseUrl}/api/circuits/1/instances/999`);
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// POST /api/circuits/:circuitId/instances
// ===========================================================================

describe('POST /api/circuits/:circuitId/instances', () => {
  it('creates a circuit instance', async () => {
    mockStorage.createCircuitInstance.mockResolvedValue(makeInstance({ id: 10 }));

    const res = await authFetch(`${baseUrl}/api/circuits/1/instances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partId: 1,
        referenceDesignator: 'C1',
        schematicX: 50,
        schematicY: 50,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { id: number };
    expect(body.id).toBe(10);
  });

  it('auto-generates referenceDesignator when omitted (BL-0497)', async () => {
    const res = await authFetch(`${baseUrl}/api/circuits/1/instances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partId: 1 }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { referenceDesignator: string };
    // Auto-generated refdes should be non-empty
    expect(body.referenceDesignator).toBeTruthy();
  });
});

// ===========================================================================
// PATCH /api/circuits/:circuitId/instances/:id
// ===========================================================================

describe('PATCH /api/circuits/:circuitId/instances/:id', () => {
  it('updates an instance', async () => {
    mockStorage.getCircuitInstance.mockResolvedValue(makeInstance());
    mockStorage.updateCircuitInstance.mockResolvedValue(makeInstance({ schematicX: 300 }));

    const res = await authFetch(`${baseUrl}/api/circuits/1/instances/1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schematicX: 300 }),
    });
    expect(res.status).toBe(200);
  });

  it('returns 404 for non-existent instance', async () => {
    mockStorage.updateCircuitInstance.mockResolvedValue(null);

    const res = await authFetch(`${baseUrl}/api/circuits/1/instances/999`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schematicX: 0 }),
    });
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// POST /api/circuits/:circuitId/pin-verification/run
// ===========================================================================

describe('POST /api/circuits/:circuitId/pin-verification/run', () => {
  it('returns detected unverified/conflict entries and persists them to instance properties', async () => {
    mockStorage.getComponentPart.mockResolvedValue({
      id: 1,
      connectors: [{ name: 'GPIO0' }, { name: 'EN' }],
    });
    mockStorage.getCircuitInstances.mockResolvedValue([
      makeInstance({
        id: 1,
        partId: 1,
        referenceDesignator: 'U1',
        properties: {
          aiPinMappings: [
            { pinLabel: 'GPIO0', source: 'ai_drafter', aiGuess: true },
            { pinLabel: 'EN', verification: 'conflict', source: 'judge_crosscheck' },
            { pinLabel: '3V3', verification: 'verified', source: 'auditor_datasheet' },
          ],
        },
      }),
    ]);
    mockStorage.updateCircuitInstance.mockResolvedValue(makeInstance());

    const res = await authFetch(`${baseUrl}/api/circuits/1/pin-verification/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun: false }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as {
      flaggedInstances: number;
      unverifiedGuessCount: number;
      conflictCount: number;
      results: Array<{ entries: Array<{ status: string; trust: { verified: boolean; source: string; value: string; isMock?: boolean } }> }>;
      orchestration: {
        mode: string;
        engine: {
          coordinator: string;
          transport: string;
          openaiAgentsCompatible: boolean;
        };
        stages: Array<{ role: string; source: string; action: string }>;
      };
    };
    expect(body.flaggedInstances).toBe(1);
    expect(body.unverifiedGuessCount).toBe(0);
    expect(body.conflictCount).toBe(2);
    expect(body.results[0]?.entries.map((entry) => entry.status)).toEqual([
      'verified',
      'conflict',
      'conflict',
    ]);
    expect(body.results[0]?.entries[0]?.trust).toMatchObject({
      verified: true,
      source: 'manual_entry',
      value: 'verified',
    });
    expect(body.results[0]?.entries[1]?.trust).toMatchObject({
      verified: false,
      source: 'fallback_unknown',
      value: 'conflict',
      isMock: true,
    });
    expect(body.orchestration.mode).toBe('local_mcp_swarm');
    expect(body.orchestration.engine).toMatchObject({
      coordinator: 'genkit',
      transport: 'mcp',
    });
    expect(typeof body.orchestration.engine.openaiAgentsCompatible).toBe('boolean');
    expect(body.orchestration.stages.map((stage) => stage.role)).toEqual(['drafter', 'auditor', 'judge']);
    expect(mockStorage.updateCircuitInstance).toHaveBeenCalledTimes(1);
  });

  it('supports dryRun mode without updating instances', async () => {
    mockStorage.getCircuitInstances.mockResolvedValue([
      makeInstance({
        id: 2,
        referenceDesignator: 'U2',
        properties: {
          aiPinMappings: [{ pinLabel: 'IO0', source: 'ai_drafter', aiGuess: true }],
        },
      }),
    ]);

    const res = await authFetch(`${baseUrl}/api/circuits/1/pin-verification/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun: true }),
    });
    expect(res.status).toBe(200);
    expect(mockStorage.updateCircuitInstance).not.toHaveBeenCalled();
  });

  it('falls back to datasheetPinMap when component connectors are unavailable', async () => {
    mockStorage.getComponentPart.mockResolvedValue({
      id: 1,
      connectors: [],
    });
    mockStorage.getCircuitInstances.mockResolvedValue([
      makeInstance({
        id: 3,
        partId: 1,
        referenceDesignator: 'U3',
        properties: {
          datasheetPinMap: [
            { pinLabel: 'GPIO22' },
            { pinLabel: '3V3' },
          ],
          aiPinMappings: [
            { pinLabel: 'GPIO22', source: 'ai_drafter', aiGuess: true },
            { pinLabel: 'BOOT0', source: 'ai_drafter', aiGuess: true },
          ],
        },
      }),
    ]);
    mockStorage.updateCircuitInstance.mockResolvedValue(makeInstance());

    const res = await authFetch(`${baseUrl}/api/circuits/1/pin-verification/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun: false }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as {
      results: Array<{
        authoritativeSource: string;
        entries: Array<{ status: string; source: string; trust: { verified: boolean; value: string } }>;
      }>;
    };
    expect(body.results[0]?.authoritativeSource).toBe('datasheet_pin_map');
    expect(body.results[0]?.entries.map((entry) => entry.status)).toEqual(['verified', 'conflict']);
    expect(body.results[0]?.entries[0]?.source).toBe('auditor_datasheet_pin_map');
    expect(body.results[0]?.entries[0]?.trust).toMatchObject({ verified: true, value: 'verified' });
    expect(body.results[0]?.entries[1]?.trust).toMatchObject({ verified: false, value: 'conflict' });
  });

  it('accepts auditorReports and uses them as authoritative Judge input', async () => {
    mockStorage.getComponentPart.mockResolvedValue({
      id: 1,
      connectors: [],
    });
    mockStorage.getCircuitInstances.mockResolvedValue([
      makeInstance({
        id: 4,
        partId: 1,
        referenceDesignator: 'U4',
        properties: {
          aiPinMappings: [
            { pinLabel: 'SDA', source: 'ai_drafter', aiGuess: true },
            { pinLabel: 'GPIO99', source: 'ai_drafter', aiGuess: true },
          ],
        },
      }),
    ]);
    mockStorage.updateCircuitInstance.mockResolvedValue(makeInstance());

    const res = await authFetch(`${baseUrl}/api/circuits/1/pin-verification/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dryRun: false,
        auditorReports: [
          {
            instanceId: 4,
            source: 'auditor_mcp_datasheet',
            pins: [{ pinLabel: 'SDA' }, { pinLabel: 'SCL' }],
          },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as {
      results: Array<{
        authoritativeSource: string;
        authoritativeSourceLabel: string;
        entries: Array<{ status: string; source: string; trust: { verified: boolean; value: string } }>;
      }>;
    };
    expect(body.results[0]?.authoritativeSource).toBe('datasheet_pin_map');
    expect(body.results[0]?.authoritativeSourceLabel).toBe('auditor_mcp_datasheet');
    expect(body.results[0]?.entries.map((entry) => entry.status)).toEqual(['verified', 'conflict']);
    expect(body.results[0]?.entries[0]?.trust).toMatchObject({ verified: true, value: 'verified' });
    expect(body.results[0]?.entries[1]?.trust).toMatchObject({ verified: false, value: 'conflict' });
  });

  it('auto-generates auditor reports from catalog when autoAuditor is enabled', async () => {
    mockStorage.getComponentPart.mockResolvedValue({
      id: 1,
      connectors: [],
      meta: { mpn: 'ESP32-WROOM-32', title: 'ESP32 DevKit' },
    });
    mockStorage.getCircuitInstances.mockResolvedValue([
      makeInstance({
        id: 5,
        partId: 1,
        referenceDesignator: 'U5',
        properties: {
          aiPinMappings: [
            { pinLabel: 'GPIO22', source: 'ai_drafter', aiGuess: true },
            { pinLabel: 'GPIO99', source: 'ai_drafter', aiGuess: true },
          ],
        },
      }),
    ]);
    mockStorage.updateCircuitInstance.mockResolvedValue(makeInstance());

    const res = await authFetch(`${baseUrl}/api/circuits/1/pin-verification/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun: false, autoAuditor: true }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as {
      results: Array<{
        authoritativeSourceLabel: string;
        entries: Array<{ status: string; trust: { verified: boolean; value: string } }>;
      }>;
    };
    expect(body.results[0]?.authoritativeSourceLabel).toBe('auditor_mcp_catalog');
    expect(body.results[0]?.entries.map((entry) => entry.status)).toEqual(['verified', 'conflict']);
    expect(body.results[0]?.entries[0]?.trust).toMatchObject({ verified: true, value: 'verified' });
    expect(body.results[0]?.entries[1]?.trust).toMatchObject({ verified: false, value: 'conflict' });
  });

  it('marks openaiAgentsExecution and appends judge rationale stage when guarded execution path runs', async () => {
    (globalThis as {
      __PROTO_TEST_OPENAI_AGENTS_JUDGE__?: (payload: {
        circuitId: number;
        flaggedInstances: number;
        unverifiedGuessCount: number;
        conflictCount: number;
      }) => Promise<{ executed: boolean; rationale?: string }>;
    }).__PROTO_TEST_OPENAI_AGENTS_JUDGE__ = async () => ({
      executed: true,
      rationale: 'Escalate conflicts before trusting any AI guesses.',
    });

    mockStorage.getComponentPart.mockResolvedValue({
      id: 1,
      connectors: [{ name: 'GPIO0' }],
    });
    mockStorage.getCircuitInstances.mockResolvedValue([
      makeInstance({
        id: 6,
        partId: 1,
        referenceDesignator: 'U6',
        properties: {
          aiPinMappings: [
            { pinLabel: 'GPIO0', source: 'ai_drafter', aiGuess: true },
            { pinLabel: 'GPIO99', source: 'ai_drafter', aiGuess: true },
          ],
        },
      }),
    ]);
    mockStorage.updateCircuitInstance.mockResolvedValue(makeInstance());

    const res = await authFetch(`${baseUrl}/api/circuits/1/pin-verification/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun: false }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as {
      orchestration: {
        engine: { openaiAgentsExecution: boolean };
        stages: Array<{ role: string; source: string; action: string }>;
      };
    };
    expect(body.orchestration.engine.openaiAgentsExecution).toBe(true);
    expect(body.orchestration.stages.some((stage) => stage.source === '@openai/agents')).toBe(true);
  });
});

// ===========================================================================
// GET /api/circuits/:circuitId/pin-verification/history
// ===========================================================================

describe('GET /api/circuits/:circuitId/pin-verification/history', () => {
  it('returns run history entries after a pin-verification execution', async () => {
    mockStorage.getComponentPart.mockResolvedValue({
      id: 1,
      connectors: [{ name: 'GPIO0' }],
    });
    mockStorage.getCircuitInstances.mockResolvedValue([
      makeInstance({
        id: 10,
        partId: 1,
        referenceDesignator: 'U10',
        properties: {
          aiPinMappings: [
            { pinLabel: 'GPIO0', source: 'ai_drafter', aiGuess: true },
            { pinLabel: 'GPIO99', source: 'ai_drafter', aiGuess: true },
          ],
        },
      }),
    ]);
    mockStorage.updateCircuitInstance.mockResolvedValue(makeInstance());

    const runRes = await authFetch(`${baseUrl}/api/circuits/1/pin-verification/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun: false }),
    });
    expect(runRes.status).toBe(200);

    const historyRes = await authFetch(`${baseUrl}/api/circuits/1/pin-verification/history`);
    expect(historyRes.status).toBe(200);
    const historyBody = await historyRes.json() as {
      ok: boolean;
      total: number;
      data: Array<{ runId: string; conflictCount: number }>;
    };
    expect(historyBody.ok).toBe(true);
    expect(historyBody.total).toBeGreaterThanOrEqual(1);
    expect(historyBody.data[0]?.runId).toMatch(/^pv-/);
    expect(historyBody.data[0]?.conflictCount).toBeGreaterThanOrEqual(1);
  });
});

// ===========================================================================
// DELETE /api/circuits/:circuitId/instances/:id
// ===========================================================================

describe('DELETE /api/circuits/:circuitId/instances/:id', () => {
  it('deletes an instance', async () => {
    mockStorage.getCircuitInstance.mockResolvedValue(makeInstance());
    mockStorage.deleteCircuitInstance.mockResolvedValue(true);

    const res = await authFetch(`${baseUrl}/api/circuits/1/instances/1`, { method: 'DELETE' });
    expect(res.status).toBe(204);
  });

  it('returns 404 for non-existent instance', async () => {
    mockStorage.deleteCircuitInstance.mockResolvedValue(false);

    const res = await authFetch(`${baseUrl}/api/circuits/1/instances/999`, { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});
