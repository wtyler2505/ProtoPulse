import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = 'http://localhost:5000';

async function api(method: string, path: string, body?: unknown, headers?: Record<string, string>) {
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const text = await res.text();
  let json: unknown = undefined;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text, headers: res.headers };
}

let sessionId: string;
let testProjectId: number;

describe('Auth API', () => {
  it('should register a new user', async () => {
    const res = await api('POST', '/api/auth/register', { username: 'test_api_' + Date.now(), password: 'testpass123' });
    assert.equal(res.status, 201);
    assert.ok((res.json as any).sessionId);
    sessionId = (res.json as any).sessionId;
  });

  it('should reject duplicate registration', async () => {
    const username = 'dupe_' + Date.now();
    await api('POST', '/api/auth/register', { username, password: 'testpass123' });
    const res = await api('POST', '/api/auth/register', { username, password: 'testpass123' });
    assert.equal(res.status, 409);
  });

  it('should login', async () => {
    const username = 'login_' + Date.now();
    await api('POST', '/api/auth/register', { username, password: 'testpass123' });
    const res = await api('POST', '/api/auth/login', { username, password: 'testpass123' });
    assert.equal(res.status, 200);
    assert.ok((res.json as any).sessionId);
  });

  it('should reject wrong password', async () => {
    const username = 'wrongpw_' + Date.now();
    await api('POST', '/api/auth/register', { username, password: 'testpass123' });
    const res = await api('POST', '/api/auth/login', { username, password: 'wrongpass' });
    assert.equal(res.status, 401);
  });

  it('should get current user with valid session', async () => {
    const res = await api('GET', '/api/auth/me', undefined, { 'X-Session-Id': sessionId });
    assert.equal(res.status, 200);
    assert.ok((res.json as any).username);
  });

  it('should reject invalid session', async () => {
    const res = await api('GET', '/api/auth/me', undefined, { 'X-Session-Id': 'invalid' });
    assert.equal(res.status, 401);
  });
});

describe('Protected routes require auth', () => {
  it('should return 401 for projects without auth', async () => {
    const res = await api('GET', '/api/projects');
    assert.equal(res.status, 401);
  });

  it('should return projects with auth', async () => {
    const res = await api('GET', '/api/projects', undefined, { 'X-Session-Id': sessionId });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.json));
  });
});

describe('Projects CRUD', () => {
  it('should create a project', async () => {
    const res = await api('POST', '/api/projects', { name: 'Test Project ' + Date.now() }, { 'X-Session-Id': sessionId });
    assert.equal(res.status, 201);
    testProjectId = (res.json as any).id;
    assert.ok(testProjectId);
  });

  it('should get project by id', async () => {
    const res = await api('GET', `/api/projects/${testProjectId}`, undefined, { 'X-Session-Id': sessionId });
    assert.equal(res.status, 200);
    assert.equal((res.json as any).id, testProjectId);
  });

  it('should update project', async () => {
    const res = await api('PATCH', `/api/projects/${testProjectId}`, { name: 'Updated Project' }, { 'X-Session-Id': sessionId });
    assert.equal(res.status, 200);
    assert.equal((res.json as any).name, 'Updated Project');
  });

  it('should return 404 for non-existent project', async () => {
    const res = await api('GET', '/api/projects/99999', undefined, { 'X-Session-Id': sessionId });
    assert.equal(res.status, 404);
  });
});

describe('Nodes CRUD', () => {
  it('should create a node', async () => {
    const res = await api('POST', `/api/projects/${testProjectId}/nodes`, {
      nodeId: 'test_node_' + Date.now(),
      nodeType: 'mcu',
      label: 'Test MCU',
      positionX: 100,
      positionY: 200,
    }, { 'X-Session-Id': sessionId });
    assert.equal(res.status, 201);
    assert.ok((res.json as any).id);
  });

  it('should list nodes', async () => {
    const res = await api('GET', `/api/projects/${testProjectId}/nodes`, undefined, { 'X-Session-Id': sessionId });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.json));
    assert.ok((res.json as any[]).length >= 1);
  });
});

describe('BOM CRUD', () => {
  let bomId: number;

  it('should create a BOM item', async () => {
    const res = await api('POST', `/api/projects/${testProjectId}/bom`, {
      partNumber: 'RES-10K-' + Date.now(),
      manufacturer: 'TestCorp',
      description: 'Test Resistor 10K Ohm',
      quantity: 10,
      unitPrice: '0.0500',
      supplier: 'DigiKey',
      stock: 100,
      status: 'In Stock',
    }, { 'X-Session-Id': sessionId });
    assert.equal(res.status, 201);
    bomId = (res.json as any).id;
    assert.ok(bomId);
  });

  it('should list BOM items', async () => {
    const res = await api('GET', `/api/projects/${testProjectId}/bom`, undefined, { 'X-Session-Id': sessionId });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.json));
  });

  it('should update BOM item', async () => {
    const res = await api('PATCH', `/api/projects/${testProjectId}/bom/${bomId}`, { quantity: 20 }, { 'X-Session-Id': sessionId });
    assert.equal(res.status, 200);
    assert.equal((res.json as any).quantity, 20);
  });

  it('should delete BOM item', async () => {
    const res = await api('DELETE', `/api/projects/${testProjectId}/bom/${bomId}`, undefined, { 'X-Session-Id': sessionId });
    assert.equal(res.status, 204);
  });
});

describe('Validation CRUD', () => {
  it('should create validation issue', async () => {
    const res = await api('POST', `/api/projects/${testProjectId}/validation`, {
      severity: 'error',
      message: 'Test validation error',
    }, { 'X-Session-Id': sessionId });
    assert.equal(res.status, 201);
  });

  it('should list validation issues', async () => {
    const res = await api('GET', `/api/projects/${testProjectId}/validation`, undefined, { 'X-Session-Id': sessionId });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.json));
  });
});

describe('Health & utility endpoints', () => {
  it('should return healthy status', async () => {
    const res = await api('GET', '/api/health');
    assert.equal(res.status, 200);
    assert.equal((res.json as any).status, 'ok');
  });

  it('should return metrics', async () => {
    const res = await api('GET', '/api/metrics');
    assert.equal(res.status, 200);
    assert.ok((res.json as any).uptimeSeconds >= 0);
  });

  it('should return API docs', async () => {
    const res = await api('GET', '/api/docs');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray((res.json as any).routes));
  });

  it('should include API version header', async () => {
    const res = await api('GET', '/api/health');
    assert.equal(res.headers.get('x-api-version'), '1');
  });
});

describe('Soft delete', () => {
  it('should soft-delete a project', async () => {
    const create = await api('POST', '/api/projects', { name: 'Deletable ' + Date.now() }, { 'X-Session-Id': sessionId });
    const pid = (create.json as any).id;
    const del = await api('DELETE', `/api/projects/${pid}`, undefined, { 'X-Session-Id': sessionId });
    assert.equal(del.status, 204);
    const list = await api('GET', '/api/projects', undefined, { 'X-Session-Id': sessionId });
    const found = (list.json as any[]).find((p: any) => p.id === pid);
    assert.equal(found, undefined);
  });
});

describe('Pagination', () => {
  it('should support limit and offset', async () => {
    const res = await api('GET', `/api/projects?limit=1&offset=0`, undefined, { 'X-Session-Id': sessionId });
    assert.equal(res.status, 200);
    assert.ok((res.json as any[]).length <= 1);
  });
});

describe('Input validation', () => {
  it('should reject missing project name', async () => {
    const res = await api('POST', '/api/projects', {}, { 'X-Session-Id': sessionId });
    assert.ok(res.status >= 400);
  });

  it('should reject invalid auth registration', async () => {
    const res = await api('POST', '/api/auth/register', { username: 'ab', password: '12' });
    assert.equal(res.status, 400);
  });
});
