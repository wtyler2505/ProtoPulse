/**
 * Architecture Routes Tests — server/routes/architecture.ts
 *
 * Tests architecture nodes and edges CRUD endpoints.
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import { registerArchitectureRoutes } from '../routes/architecture';

// ---------------------------------------------------------------------------
// Mock storage
// ---------------------------------------------------------------------------

const {
  mockGetNodes,
  mockCreateNode,
  mockUpdateNode,
  mockReplaceNodes,
  mockGetEdges,
  mockCreateEdge,
  mockUpdateEdge,
  mockReplaceEdges,
  mockGetProject,
} = vi.hoisted(() => ({
  mockGetNodes: vi.fn(),
  mockCreateNode: vi.fn(),
  mockUpdateNode: vi.fn(),
  mockReplaceNodes: vi.fn(),
  mockGetEdges: vi.fn(),
  mockCreateEdge: vi.fn(),
  mockUpdateEdge: vi.fn(),
  mockReplaceEdges: vi.fn(),
  mockGetProject: vi.fn(),
}));

vi.mock('../storage', () => ({
  storage: {
    getProject: mockGetProject,
    getNodes: mockGetNodes,
    createNode: mockCreateNode,
    updateNode: mockUpdateNode,
    replaceNodes: mockReplaceNodes,
    getEdges: mockGetEdges,
    createEdge: mockCreateEdge,
    updateEdge: mockUpdateEdge,
    replaceEdges: mockReplaceEdges,
  },
  VersionConflictError: class VersionConflictError extends Error {
    currentVersion: number;
    constructor(entity: string, id: number, currentVersion: number) {
      super('Version conflict');
      this.name = 'VersionConflictError';
      this.currentVersion = currentVersion;
    }
  },
}));

vi.mock('../auth', () => ({
  validateSession: vi.fn().mockResolvedValue({ userId: 1, sessionId: 'test-session' }),
}));

vi.mock('../db', () => ({
  db: {},
  pool: {},
  checkConnection: vi.fn(),
}));

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

const NOW = new Date('2026-03-08T12:00:00Z');

function makeNode(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    projectId: 1,
    nodeId: 'node-1',
    nodeType: 'microcontroller',
    label: 'Arduino Mega',
    positionX: 100,
    positionY: 200,
    data: null,
    version: 1,
    deletedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeEdge(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    projectId: 1,
    edgeId: 'edge-1',
    source: 'node-1',
    target: 'node-2',
    label: 'SPI',
    animated: false,
    style: null,
    signalType: 'digital',
    voltage: '3.3V',
    busWidth: null,
    netName: null,
    version: 1,
    deletedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  registerArchitectureRoutes(app);

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
  mockGetProject.mockResolvedValue({ id: 1, name: 'Test', ownerId: null });
});

// ===========================================================================
// Nodes
// ===========================================================================

describe('GET /api/projects/:id/nodes', () => {
  it('returns nodes for a project', async () => {
    const nodes = [makeNode(), makeNode({ id: 2, nodeId: 'node-2', label: 'ESP32' })];
    mockGetNodes.mockResolvedValue(nodes);

    const res = await authFetch(`${baseUrl}/api/projects/1/nodes`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number };
    expect(body.data).toHaveLength(2);
  });

  it('returns 401 without session', async () => {
    const res = await fetch(`${baseUrl}/api/projects/1/nodes`);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/projects/:id/nodes', () => {
  it('creates a node', async () => {
    const node = makeNode({ id: 10 });
    mockCreateNode.mockResolvedValue(node);

    const res = await authFetch(`${baseUrl}/api/projects/1/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodeId: 'node-10',
        nodeType: 'sensor',
        label: 'Temp Sensor',
        positionX: 50,
        positionY: 50,
      }),
    });
    expect(res.status).toBe(201);
    expect(res.headers.get('etag')).toBe('"1"');
  });

  it('returns 400 for missing required fields', async () => {
    const res = await authFetch(`${baseUrl}/api/projects/1/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeId: 'n1' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/projects/:id/nodes/:nodeId', () => {
  it('updates a node', async () => {
    const updated = makeNode({ label: 'Updated Label', version: 2 });
    mockUpdateNode.mockResolvedValue(updated);

    const res = await authFetch(`${baseUrl}/api/projects/1/nodes/1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'Updated Label' }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('etag')).toBe('"2"');
  });

  it('returns 404 for non-existent node', async () => {
    mockUpdateNode.mockResolvedValue(null);

    const res = await authFetch(`${baseUrl}/api/projects/1/nodes/999`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'X' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 409 on version conflict', async () => {
    const { VersionConflictError } = await import('../storage');
    mockUpdateNode.mockRejectedValue(new VersionConflictError('node', 1, 5));

    const res = await authFetch(`${baseUrl}/api/projects/1/nodes/1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'If-Match': '"3"' },
      body: JSON.stringify({ label: 'Conflict' }),
    });
    expect(res.status).toBe(409);
    const body = await res.json() as { error: string; currentVersion: number };
    expect(body.error).toBe('Conflict');
    expect(body.currentVersion).toBe(5);
  });
});

describe('PUT /api/projects/:id/nodes', () => {
  it('replaces all nodes', async () => {
    const nodes = [makeNode()];
    mockReplaceNodes.mockResolvedValue(nodes);

    const res = await authFetch(`${baseUrl}/api/projects/1/nodes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{
        nodeId: 'node-1',
        nodeType: 'microcontroller',
        label: 'Arduino',
        positionX: 0,
        positionY: 0,
      }]),
    });
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid array body', async () => {
    const res = await authFetch(`${baseUrl}/api/projects/1/nodes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bad: true }),
    });
    expect(res.status).toBe(400);
  });
});

// ===========================================================================
// Edges
// ===========================================================================

describe('GET /api/projects/:id/edges', () => {
  it('returns edges for a project', async () => {
    mockGetEdges.mockResolvedValue([makeEdge()]);

    const res = await authFetch(`${baseUrl}/api/projects/1/edges`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number };
    expect(body.data).toHaveLength(1);
  });
});

describe('POST /api/projects/:id/edges', () => {
  it('creates an edge', async () => {
    mockCreateEdge.mockResolvedValue(makeEdge({ id: 10, version: 1 }));

    const res = await authFetch(`${baseUrl}/api/projects/1/edges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        edgeId: 'edge-10',
        source: 'node-1',
        target: 'node-2',
      }),
    });
    expect(res.status).toBe(201);
    expect(res.headers.get('etag')).toBe('"1"');
  });

  it('returns 400 for missing required fields', async () => {
    const res = await authFetch(`${baseUrl}/api/projects/1/edges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ edgeId: 'e1' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/projects/:id/edges/:edgeId', () => {
  it('updates an edge', async () => {
    const updated = makeEdge({ label: 'I2C', version: 2 });
    mockUpdateEdge.mockResolvedValue(updated);

    const res = await authFetch(`${baseUrl}/api/projects/1/edges/1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'I2C' }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('etag')).toBe('"2"');
  });

  it('returns 404 for non-existent edge', async () => {
    mockUpdateEdge.mockResolvedValue(null);

    const res = await authFetch(`${baseUrl}/api/projects/1/edges/999`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'X' }),
    });
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/projects/:id/edges', () => {
  it('replaces all edges', async () => {
    mockReplaceEdges.mockResolvedValue([makeEdge()]);

    const res = await authFetch(`${baseUrl}/api/projects/1/edges`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{
        edgeId: 'edge-1',
        source: 'node-1',
        target: 'node-2',
      }]),
    });
    expect(res.status).toBe(200);
  });
});
