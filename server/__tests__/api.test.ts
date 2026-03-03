/**
 * API Integration Tests
 *
 * These tests exercise actual HTTP endpoints against a running server.
 * They are skipped when the server is not reachable (e.g., in CI without a running instance).
 * To run: start the dev server (`npm run dev`) then `npx vitest run server/__tests__/api.test.ts`.
 */

import { describe, it, expect, beforeAll } from 'vitest';

const BASE_URL = 'http://localhost:5000';

interface ApiResponse<T = unknown> {
  status: number;
  json: T | undefined;
  text: string;
  headers: Headers;
}

interface AuthResponse {
  sessionId: string;
}

interface ProjectResponse {
  id: number;
  name: string;
}

interface NodeResponse {
  id: number;
}

interface BomItemResponse {
  id: number;
  quantity: number;
}

interface HealthResponse {
  status: string;
}

interface MetricsResponse {
  uptimeSeconds: number;
}

interface DocsResponse {
  routes: unknown[];
}

interface UserResponse {
  username: string;
}

async function isServerRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function api<T = unknown>(method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<ApiResponse<T>> {
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  };
  if (body) { opts.body = JSON.stringify(body); }
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const text = await res.text();
  let json: T | undefined = undefined;
  try { json = JSON.parse(text) as T; } catch { /* non-JSON response */ }
  return { status: res.status, json, text, headers: res.headers };
}

let serverAvailable = false;
let sessionId: string;
let testProjectId: number;

beforeAll(async () => {
  serverAvailable = await isServerRunning();
});

describe.skipIf(!serverAvailable)('Auth API', () => {
  beforeAll(async () => {
    serverAvailable = await isServerRunning();
  });

  it('should register a new user', async () => {
    const res = await api<AuthResponse>('POST', '/api/auth/register', { username: 'test_api_' + Date.now(), password: 'testpass123' });
    expect(res.status).toBe(201);
    expect(res.json?.sessionId).toBeTruthy();
    sessionId = res.json!.sessionId;
  });

  it('should reject duplicate registration', async () => {
    const username = 'dupe_' + Date.now();
    await api('POST', '/api/auth/register', { username, password: 'testpass123' });
    const res = await api('POST', '/api/auth/register', { username, password: 'testpass123' });
    expect(res.status).toBe(409);
  });

  it('should login', async () => {
    const username = 'login_' + Date.now();
    await api('POST', '/api/auth/register', { username, password: 'testpass123' });
    const res = await api<AuthResponse>('POST', '/api/auth/login', { username, password: 'testpass123' });
    expect(res.status).toBe(200);
    expect(res.json?.sessionId).toBeTruthy();
  });

  it('should reject wrong password', async () => {
    const username = 'wrongpw_' + Date.now();
    await api('POST', '/api/auth/register', { username, password: 'testpass123' });
    const res = await api('POST', '/api/auth/login', { username, password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('should get current user with valid session', async () => {
    const res = await api<UserResponse>('GET', '/api/auth/me', undefined, { 'X-Session-Id': sessionId });
    expect(res.status).toBe(200);
    expect(res.json?.username).toBeTruthy();
  });

  it('should reject invalid session', async () => {
    const res = await api('GET', '/api/auth/me', undefined, { 'X-Session-Id': 'invalid' });
    expect(res.status).toBe(401);
  });
});

describe.skipIf(!serverAvailable)('Protected routes require auth', () => {
  it('should return 401 for projects without auth', async () => {
    const res = await api('GET', '/api/projects');
    expect(res.status).toBe(401);
  });

  it('should return projects with auth', async () => {
    const res = await api<ProjectResponse[]>('GET', '/api/projects', undefined, { 'X-Session-Id': sessionId });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json)).toBe(true);
  });
});

describe.skipIf(!serverAvailable)('Projects CRUD', () => {
  it('should create a project', async () => {
    const res = await api<ProjectResponse>('POST', '/api/projects', { name: 'Test Project ' + Date.now() }, { 'X-Session-Id': sessionId });
    expect(res.status).toBe(201);
    testProjectId = res.json!.id;
    expect(testProjectId).toBeTruthy();
  });

  it('should get project by id', async () => {
    const res = await api<ProjectResponse>('GET', `/api/projects/${testProjectId}`, undefined, { 'X-Session-Id': sessionId });
    expect(res.status).toBe(200);
    expect(res.json?.id).toBe(testProjectId);
  });

  it('should update project', async () => {
    const res = await api<ProjectResponse>('PATCH', `/api/projects/${testProjectId}`, { name: 'Updated Project' }, { 'X-Session-Id': sessionId });
    expect(res.status).toBe(200);
    expect(res.json?.name).toBe('Updated Project');
  });

  it('should return 404 for non-existent project', async () => {
    const res = await api('GET', '/api/projects/99999', undefined, { 'X-Session-Id': sessionId });
    expect(res.status).toBe(404);
  });
});

describe.skipIf(!serverAvailable)('Nodes CRUD', () => {
  it('should create a node', async () => {
    const res = await api<NodeResponse>('POST', `/api/projects/${testProjectId}/nodes`, {
      nodeId: 'test_node_' + Date.now(),
      nodeType: 'mcu',
      label: 'Test MCU',
      positionX: 100,
      positionY: 200,
    }, { 'X-Session-Id': sessionId });
    expect(res.status).toBe(201);
    expect(res.json?.id).toBeTruthy();
  });

  it('should list nodes', async () => {
    const res = await api<NodeResponse[]>('GET', `/api/projects/${testProjectId}/nodes`, undefined, { 'X-Session-Id': sessionId });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json)).toBe(true);
    expect(res.json!.length).toBeGreaterThanOrEqual(1);
  });
});

describe.skipIf(!serverAvailable)('BOM CRUD', () => {
  let bomId: number;

  it('should create a BOM item', async () => {
    const res = await api<BomItemResponse>('POST', `/api/projects/${testProjectId}/bom`, {
      partNumber: 'RES-10K-' + Date.now(),
      manufacturer: 'TestCorp',
      description: 'Test Resistor 10K Ohm',
      quantity: 10,
      unitPrice: '0.0500',
      supplier: 'DigiKey',
      stock: 100,
      status: 'In Stock',
    }, { 'X-Session-Id': sessionId });
    expect(res.status).toBe(201);
    bomId = res.json!.id;
    expect(bomId).toBeTruthy();
  });

  it('should list BOM items', async () => {
    const res = await api<BomItemResponse[]>('GET', `/api/projects/${testProjectId}/bom`, undefined, { 'X-Session-Id': sessionId });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json)).toBe(true);
  });

  it('should update BOM item', async () => {
    const res = await api<BomItemResponse>('PATCH', `/api/projects/${testProjectId}/bom/${bomId}`, { quantity: 20 }, { 'X-Session-Id': sessionId });
    expect(res.status).toBe(200);
    expect(res.json?.quantity).toBe(20);
  });

  it('should delete BOM item', async () => {
    const res = await api('DELETE', `/api/projects/${testProjectId}/bom/${bomId}`, undefined, { 'X-Session-Id': sessionId });
    expect(res.status).toBe(204);
  });
});

describe.skipIf(!serverAvailable)('Validation CRUD', () => {
  it('should create validation issue', async () => {
    const res = await api('POST', `/api/projects/${testProjectId}/validation`, {
      severity: 'error',
      message: 'Test validation error',
    }, { 'X-Session-Id': sessionId });
    expect(res.status).toBe(201);
  });

  it('should list validation issues', async () => {
    const res = await api<unknown[]>('GET', `/api/projects/${testProjectId}/validation`, undefined, { 'X-Session-Id': sessionId });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json)).toBe(true);
  });
});

describe.skipIf(!serverAvailable)('Health & utility endpoints', () => {
  it('should return healthy status', async () => {
    const res = await api<HealthResponse>('GET', '/api/health');
    expect(res.status).toBe(200);
    expect(res.json?.status).toBe('ok');
  });

  it('should return metrics', async () => {
    const res = await api<MetricsResponse>('GET', '/api/metrics');
    expect(res.status).toBe(200);
    expect(res.json?.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('should return API docs', async () => {
    const res = await api<DocsResponse>('GET', '/api/docs');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json?.routes)).toBe(true);
  });

  it('should include API version header', async () => {
    const res = await api('GET', '/api/health');
    expect(res.headers.get('x-api-version')).toBe('1');
  });
});

describe.skipIf(!serverAvailable)('Soft delete', () => {
  it('should soft-delete a project', async () => {
    const create = await api<ProjectResponse>('POST', '/api/projects', { name: 'Deletable ' + Date.now() }, { 'X-Session-Id': sessionId });
    const pid = create.json!.id;
    const del = await api('DELETE', `/api/projects/${pid}`, undefined, { 'X-Session-Id': sessionId });
    expect(del.status).toBe(204);
    const list = await api<ProjectResponse[]>('GET', '/api/projects', undefined, { 'X-Session-Id': sessionId });
    const found = list.json?.find((p) => p.id === pid);
    expect(found).toBeUndefined();
  });
});

describe.skipIf(!serverAvailable)('Pagination', () => {
  it('should support limit and offset', async () => {
    const res = await api<ProjectResponse[]>('GET', '/api/projects?limit=1&offset=0', undefined, { 'X-Session-Id': sessionId });
    expect(res.status).toBe(200);
    expect(res.json!.length).toBeLessThanOrEqual(1);
  });
});

describe.skipIf(!serverAvailable)('Input validation', () => {
  it('should reject missing project name', async () => {
    const res = await api('POST', '/api/projects', {}, { 'X-Session-Id': sessionId });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('should reject invalid auth registration', async () => {
    const res = await api('POST', '/api/auth/register', { username: 'ab', password: '12' });
    expect(res.status).toBe(400);
  });
});
