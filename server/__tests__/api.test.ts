/**
 * API route smoke tests
 *
 * These tests boot a trimmed in-process HTTP server so route contracts stay
 * exercised in CI instead of silently skipping when no external dev server is
 * running.
 */

import crypto from 'node:crypto';
import type { Server } from 'node:http';

import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiDocs } from '../api-docs';
import { getMetrics, recordRequest, startMetricsCollection, stopMetricsCollection, _resetForTesting } from '../metrics';
import { getRequestPath, isPublicApiPath } from '../request-routing';

const authState = vi.hoisted(() => {
  interface UserRecord {
    id: number;
    username: string;
    passwordHash: string;
  }

  interface SessionRecord {
    userId: number;
  }

  const usersById = new Map<number, UserRecord>();
  const usersByUsername = new Map<string, UserRecord>();
  const sessions = new Map<string, SessionRecord>();
  let userIdCounter = 1;
  let sessionCounter = 1;

  const reset = () => {
    usersById.clear();
    usersByUsername.clear();
    sessions.clear();
    userIdCounter = 1;
    sessionCounter = 1;
  };

  const createUser = vi.fn(async (username: string, password: string) => {
    const user = {
      id: userIdCounter++,
      username,
      passwordHash: password,
    };
    usersById.set(user.id, user);
    usersByUsername.set(username, user);
    return user;
  });

  const getUserByUsername = vi.fn(async (username: string) => usersByUsername.get(username) ?? null);
  const verifyPassword = vi.fn(async (password: string, passwordHash: string) => password === passwordHash);
  const createSession = vi.fn(async (userId: number) => {
    const sessionId = `session-${sessionCounter++}`;
    sessions.set(sessionId, { userId });
    return sessionId;
  });
  const deleteSession = vi.fn(async (sessionId: string) => {
    sessions.delete(sessionId);
  });
  const getUserById = vi.fn(async (userId: number) => usersById.get(userId) ?? null);
  const validateSession = vi.fn(async (sessionId: string) => {
    const session = sessions.get(sessionId);
    return session ? { userId: session.userId } : null;
  });

  return {
    reset,
    createUser,
    getUserByUsername,
    verifyPassword,
    createSession,
    deleteSession,
    getUserById,
    validateSession,
  };
});

const storageState = vi.hoisted(() => {
  type ProjectRecord = {
    id: number;
    name: string;
    description: string | null;
    ownerId: number | null;
    version: number;
  };

  type NodeRecord = {
    id: number;
    projectId: number;
    nodeId: string;
    nodeType: string;
    label: string;
    positionX: number;
    positionY: number;
    version: number;
  };

  type BomRecord = {
    id: number;
    projectId: number;
    partNumber?: string;
    manufacturer?: string;
    description?: string;
    quantity: number;
    unitPrice?: string;
    supplier?: string;
    stock?: number;
    status?: string;
    version: number;
  };

  type ValidationRecord = {
    id: number;
    projectId: number;
    severity: string;
    message: string;
  };

  class VersionConflictError extends Error {
    currentVersion: number;

    constructor(currentVersion: number) {
      super('Version conflict');
      this.currentVersion = currentVersion;
    }
  }

  const projects = new Map<number, ProjectRecord>();
  const nodes = new Map<number, NodeRecord[]>();
  const bomItems = new Map<number, BomRecord[]>();
  const validationIssues = new Map<number, ValidationRecord[]>();
  let projectIdCounter = 1;
  let nodeIdCounter = 1;
  let bomIdCounter = 1;
  let validationIdCounter = 1;

  const reset = () => {
    projects.clear();
    nodes.clear();
    bomItems.clear();
    validationIssues.clear();
    projectIdCounter = 1;
    nodeIdCounter = 1;
    bomIdCounter = 1;
    validationIdCounter = 1;
  };

  const getProjects = vi.fn(async () => Array.from(projects.values()));
  const getProject = vi.fn(async (id: number) => projects.get(id) ?? null);
  const createProject = vi.fn(async (data: { name: string; description?: string | null }, ownerId?: number) => {
    const project: ProjectRecord = {
      id: projectIdCounter++,
      name: data.name,
      description: data.description ?? null,
      ownerId: ownerId ?? null,
      version: 1,
    };
    projects.set(project.id, project);
    return project;
  });
  const updateProject = vi.fn(async (id: number, patch: Partial<ProjectRecord>) => {
    const existing = projects.get(id);
    if (!existing) {
      return null;
    }
    const updated: ProjectRecord = {
      ...existing,
      ...patch,
      version: existing.version + 1,
    };
    projects.set(id, updated);
    return updated;
  });
  const deleteProject = vi.fn(async (id: number) => projects.delete(id));

  const getNodes = vi.fn(async (projectId: number) => nodes.get(projectId) ?? []);
  const createNode = vi.fn(async (data: Omit<NodeRecord, 'id' | 'version'>) => {
    const node: NodeRecord = {
      ...data,
      id: nodeIdCounter++,
      version: 1,
    };
    const current = nodes.get(data.projectId) ?? [];
    current.push(node);
    nodes.set(data.projectId, current);
    return node;
  });

  const getBomItems = vi.fn(async (projectId: number) => bomItems.get(projectId) ?? []);
  const getLowStockItems = vi.fn(async () => []);
  const getStorageLocations = vi.fn(async () => []);
  const getBomItem = vi.fn(async (bomId: number, projectId: number) => {
    return (bomItems.get(projectId) ?? []).find((item) => item.id === bomId) ?? null;
  });
  const createBomItem = vi.fn(async (data: Omit<BomRecord, 'id' | 'version'>) => {
    const item: BomRecord = {
      ...data,
      id: bomIdCounter++,
      version: 1,
    };
    const current = bomItems.get(data.projectId) ?? [];
    current.push(item);
    bomItems.set(data.projectId, current);
    return item;
  });
  const updateBomItem = vi.fn(async (bomId: number, projectId: number, patch: Partial<BomRecord>) => {
    const current = bomItems.get(projectId) ?? [];
    const index = current.findIndex((item) => item.id === bomId);
    if (index === -1) {
      return null;
    }
    const updated: BomRecord = {
      ...current[index]!,
      ...patch,
      version: current[index]!.version + 1,
    };
    current[index] = updated;
    bomItems.set(projectId, current);
    return updated;
  });
  const deleteBomItem = vi.fn(async (bomId: number, projectId: number) => {
    const current = bomItems.get(projectId) ?? [];
    const next = current.filter((item) => item.id !== bomId);
    const deleted = next.length !== current.length;
    bomItems.set(projectId, next);
    return deleted;
  });

  const getValidationIssues = vi.fn(async (projectId: number) => validationIssues.get(projectId) ?? []);
  const createValidationIssue = vi.fn(async (data: Omit<ValidationRecord, 'id'>) => {
    const issue: ValidationRecord = {
      ...data,
      id: validationIdCounter++,
    };
    const current = validationIssues.get(data.projectId) ?? [];
    current.push(issue);
    validationIssues.set(data.projectId, current);
    return issue;
  });
  const deleteValidationIssue = vi.fn(async (issueId: number, projectId: number) => {
    const current = validationIssues.get(projectId) ?? [];
    const next = current.filter((issue) => issue.id !== issueId);
    const deleted = next.length !== current.length;
    validationIssues.set(projectId, next);
    return deleted;
  });
  const replaceValidationIssues = vi.fn(async (projectId: number, issues: ValidationRecord[]) => {
    validationIssues.set(projectId, issues);
    return issues;
  });

  return {
    reset,
    VersionConflictError,
    storage: {
      getProjects,
      getProject,
      createProject,
      updateProject,
      deleteProject,
      getNodes,
      createNode,
      getEdges: vi.fn(async () => []),
      createEdge: vi.fn(),
      replaceNodes: vi.fn(async (_projectId: number, items: NodeRecord[]) => items),
      replaceEdges: vi.fn(async () => []),
      getBomItems,
      getLowStockItems,
      getStorageLocations,
      getBomItem,
      createBomItem,
      updateBomItem,
      deleteBomItem,
      getValidationIssues,
      createValidationIssue,
      deleteValidationIssue,
      replaceValidationIssues,
      getProjectMembers: vi.fn(async () => []),
      addProjectMember: vi.fn(),
      updateProjectMember: vi.fn(),
      removeProjectMember: vi.fn(),
    },
  };
});

vi.mock('../auth', () => ({
  createUser: authState.createUser,
  getUserByUsername: authState.getUserByUsername,
  verifyPassword: authState.verifyPassword,
  createSession: authState.createSession,
  deleteSession: authState.deleteSession,
  getUserById: authState.getUserById,
  validateSession: authState.validateSession,
}));

vi.mock('../storage', () => ({
  storage: storageState.storage,
  VersionConflictError: storageState.VersionConflictError,
}));

// Phase 2 introduced a `parts-ingress` dependency in routes/bom.ts + routes/components.ts
// that transitively pulls in server/db.ts, which throws at module load when DATABASE_URL
// is unset. Mock it and parts-ingress before the route imports fire.
vi.mock('../db', () => ({ db: {}, pool: {}, checkConnection: vi.fn() }));
vi.mock('../parts-ingress', () => ({
  mirrorIngressBestEffort: vi.fn().mockResolvedValue(null),
}));
vi.mock('../env', () => ({ featureFlags: { partsCatalogV2: false } }));

import { registerArchitectureRoutes } from '../routes/architecture';
import { registerAuthRoutes } from '../routes/auth';
import { registerProjectRoutes } from '../routes/projects';
import { registerValidationRoutes } from '../routes/validation';
import { validateSession } from '../auth';

interface ApiResponse<T = unknown> {
  status: number;
  json: T | undefined;
  text: string;
  headers: Headers;
}

interface AuthResponse {
  sessionId: string;
  user: {
    id: number;
    username: string;
  };
}

interface ProjectResponse {
  id: number;
  name: string;
  ownerId: number | null;
  version: number;
}

interface ProjectListResponse {
  data: ProjectResponse[];
  total: number;
}

interface NodeResponse {
  id: number;
}

interface CollectionResponse<T> {
  data: T[];
  total: number;
}

interface BomItemResponse {
  id: number;
  quantity: number;
}

interface HealthResponse {
  status: string;
  timestamp: string;
}

interface MetricsResponse {
  uptimeSeconds: number;
  routes: Record<string, unknown>;
}

interface DocsResponse {
  version: number;
  routes: unknown[];
}

interface UserResponse {
  username: string;
}

function makeRequestId(): string {
  return crypto.randomUUID();
}

async function api<T = unknown>(
  baseUrl: string,
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<ApiResponse<T>> {
  const requestHeaders = new Headers(headers);
  if (body !== undefined && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: T | undefined;
  try {
    json = JSON.parse(text) as T;
  } catch {
    json = undefined;
  }
  return { status: res.status, json, text, headers: res.headers };
}

let server: Server;
let baseUrl: string;
let sessionId = '';
let testProjectId = 0;

beforeAll(async () => {
  authState.reset();
  storageState.reset();
  _resetForTesting();
  startMetricsCollection();

  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use((req, _res, next) => {
    req.id = makeRequestId();
    next();
  });
  app.use((req, res, next) => {
    const start = Date.now();
    const path = getRequestPath(req);
    res.on('finish', () => {
      if (path.startsWith('/api')) {
        recordRequest(req.method, path, res.statusCode, Date.now() - start);
      }
    });
    next();
  });
  app.use('/api', (req, res, next) => {
    if (isPublicApiPath(getRequestPath(req))) {
      return next();
    }

    const sessionHeader = req.headers['x-session-id'];
    const currentSessionId = typeof sessionHeader === 'string' ? sessionHeader : undefined;
    if (!currentSessionId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    validateSession(currentSessionId)
      .then((session) => {
        if (!session) {
          return res.status(401).json({ message: 'Invalid or expired session' });
        }
        req.userId = session.userId;
        next();
      })
      .catch(next);
  });

  registerAuthRoutes(app);
  registerProjectRoutes(app);
  registerArchitectureRoutes(app);
  registerValidationRoutes(app);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/metrics', (_req, res) => {
    res.json(getMetrics());
  });

  app.get('/api/docs', (_req, res) => {
    res.json({ version: 1, routes: apiDocs });
  });

  app.all('/api/{*path}', (_req, res) => {
    res.status(404).json({ message: 'API endpoint not found' });
  });

  app.use((err: { status?: number; statusCode?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.status ?? err.statusCode ?? 500).json({ message: err.message ?? 'Internal server error' });
  });

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Test server did not expose a TCP port');
      }
      baseUrl = `http://127.0.0.1:${String(address.port)}`;
      resolve();
    });
  });
});

afterAll(async () => {
  stopMetricsCollection();
  await new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Auth API', () => {
  it('registers a new user', async () => {
    const res = await api<AuthResponse>(baseUrl, 'POST', '/api/auth/register', {
      username: `test_api_${Date.now()}`,
      password: 'testpass123',
    });

    expect(res.status).toBe(201);
    expect(res.json?.sessionId).toBeTruthy();
    sessionId = res.json!.sessionId;
  });

  it('rejects duplicate registration', async () => {
    const username = `dupe_${Date.now()}`;
    await api(baseUrl, 'POST', '/api/auth/register', { username, password: 'testpass123' });
    const res = await api(baseUrl, 'POST', '/api/auth/register', { username, password: 'testpass123' });

    expect(res.status).toBe(409);
  });

  it('logs in with valid credentials', async () => {
    const username = `login_${Date.now()}`;
    await api(baseUrl, 'POST', '/api/auth/register', { username, password: 'testpass123' });
    const res = await api<AuthResponse>(baseUrl, 'POST', '/api/auth/login', { username, password: 'testpass123' });

    expect(res.status).toBe(200);
    expect(res.json?.sessionId).toBeTruthy();
  });

  it('rejects the wrong password', async () => {
    const username = `wrongpw_${Date.now()}`;
    await api(baseUrl, 'POST', '/api/auth/register', { username, password: 'testpass123' });
    const res = await api(baseUrl, 'POST', '/api/auth/login', { username, password: 'wrongpass' });

    expect(res.status).toBe(401);
  });

  it('returns the current user for a valid session', async () => {
    const res = await api<UserResponse>(baseUrl, 'GET', '/api/auth/me', undefined, { 'X-Session-Id': sessionId });

    expect(res.status).toBe(200);
    expect(res.json?.username).toBeTruthy();
  });

  it('rejects an invalid session', async () => {
    const res = await api(baseUrl, 'GET', '/api/auth/me', undefined, { 'X-Session-Id': 'invalid' });
    expect(res.status).toBe(401);
  });
});

describe('Protected routes require auth', () => {
  it('returns 401 for projects without auth', async () => {
    const res = await api(baseUrl, 'GET', '/api/projects');
    expect(res.status).toBe(401);
  });

  it('returns paginated projects with auth', async () => {
    const res = await api<ProjectListResponse>(baseUrl, 'GET', '/api/projects', undefined, { 'X-Session-Id': sessionId });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json?.data)).toBe(true);
    expect(typeof res.json?.total).toBe('number');
  });
});

describe('Projects CRUD', () => {
  it('creates a project', async () => {
    const res = await api<ProjectResponse>(baseUrl, 'POST', '/api/projects', { name: `Test Project ${Date.now()}` }, { 'X-Session-Id': sessionId });
    expect(res.status).toBe(201);
    testProjectId = res.json!.id;
    expect(testProjectId).toBeTruthy();
    expect(res.json?.ownerId).toBeTruthy();
  });

  it('gets project by id', async () => {
    const res = await api<ProjectResponse>(baseUrl, 'GET', `/api/projects/${testProjectId}`, undefined, { 'X-Session-Id': sessionId });
    expect(res.status).toBe(200);
    expect(res.json?.id).toBe(testProjectId);
  });

  it('updates project', async () => {
    const res = await api<ProjectResponse>(baseUrl, 'PATCH', `/api/projects/${testProjectId}`, { name: 'Updated Project' }, { 'X-Session-Id': sessionId });
    expect(res.status).toBe(200);
    expect(res.json?.name).toBe('Updated Project');
    expect(res.json?.version).toBeGreaterThanOrEqual(2);
  });

  it('returns 404 for a non-existent project', async () => {
    const res = await api(baseUrl, 'GET', '/api/projects/99999', undefined, { 'X-Session-Id': sessionId });
    expect(res.status).toBe(404);
  });
});

describe('Architecture nodes CRUD', () => {
  it('creates a node', async () => {
    const res = await api<NodeResponse>(baseUrl, 'POST', `/api/projects/${testProjectId}/nodes`, {
      nodeId: `test_node_${Date.now()}`,
      nodeType: 'mcu',
      label: 'Test MCU',
      positionX: 100,
      positionY: 200,
    }, { 'X-Session-Id': sessionId });

    expect(res.status).toBe(201);
    expect(res.json?.id).toBeTruthy();
  });

  it('lists nodes with pagination metadata', async () => {
    const res = await api<CollectionResponse<NodeResponse>>(baseUrl, 'GET', `/api/projects/${testProjectId}/nodes`, undefined, { 'X-Session-Id': sessionId });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json?.data)).toBe(true);
    expect(res.json!.total).toBeGreaterThanOrEqual(1);
  });
});

describe('Validation CRUD', () => {
  it('creates a validation issue', async () => {
    const res = await api(baseUrl, 'POST', `/api/projects/${testProjectId}/validation`, {
      severity: 'error',
      message: 'Test validation error',
    }, { 'X-Session-Id': sessionId });

    expect(res.status).toBe(201);
  });

  it('lists validation issues with pagination metadata', async () => {
    const res = await api<CollectionResponse<unknown>>(baseUrl, 'GET', `/api/projects/${testProjectId}/validation`, undefined, { 'X-Session-Id': sessionId });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json?.data)).toBe(true);
  });
});

describe('Health and utility endpoints', () => {
  it('returns healthy status', async () => {
    const res = await api<HealthResponse>(baseUrl, 'GET', '/api/health');
    expect(res.status).toBe(200);
    expect(res.json?.status).toBe('ok');
    expect(res.json?.timestamp).toBeTruthy();
  });

  it('returns metrics without requiring an external server', async () => {
    const res = await api<MetricsResponse>(baseUrl, 'GET', '/api/metrics');
    expect(res.status).toBe(200);
    expect(res.json?.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(res.json?.routes).toBeTruthy();
  });

  it('returns API docs', async () => {
    const res = await api<DocsResponse>(baseUrl, 'GET', '/api/docs');
    expect(res.status).toBe(200);
    expect(res.json?.version).toBe(1);
    expect(Array.isArray(res.json?.routes)).toBe(true);
  });

  it('returns JSON 404 for unknown API routes', async () => {
    const res = await api(baseUrl, 'GET', '/api/does-not-exist', undefined, { 'X-Session-Id': sessionId });
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ message: 'API endpoint not found' });
  });
});
