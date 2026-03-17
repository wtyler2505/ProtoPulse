import { describe, it, expect } from 'vitest';
import {
  generateApiDocs,
  groupEndpointsByDomain,
  searchEndpoints,
  getEndpointsByMethod,
  formatAsMarkdown,
  inferDomain,
} from '../api-docs-generator';
import type {
  ApiEndpoint,
  ApiParam,
  ApiBody,
  ApiResponse,
  ApiVersion,
  RouteDefinition,
  HttpMethod,
} from '../api-docs-generator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRoute(overrides: Partial<RouteDefinition> = {}): RouteDefinition {
  return {
    method: 'GET',
    path: '/api/projects',
    description: 'List all projects',
    ...overrides,
  };
}

function makeEndpoint(overrides: Partial<ApiEndpoint> = {}): ApiEndpoint {
  return {
    method: 'GET',
    path: '/api/projects',
    description: 'List all projects',
    auth: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Type-level assertions
// ---------------------------------------------------------------------------

describe('type contracts', () => {
  it('ApiEndpoint has the required shape', () => {
    const ep: ApiEndpoint = {
      method: 'POST',
      path: '/api/projects',
      description: 'Create project',
      auth: true,
    };
    expect(ep.method).toBe('POST');
    expect(ep.auth).toBe(true);
  });

  it('ApiEndpoint supports optional params, body, and response', () => {
    const params: ApiParam[] = [{ name: 'id', type: 'integer', required: true }];
    const body: ApiBody = {
      contentType: 'application/json',
      fields: [{ name: 'name', type: 'string', required: true }],
    };
    const response: ApiResponse[] = [
      { statusCode: 200, description: 'OK' },
    ];
    const ep: ApiEndpoint = {
      method: 'POST',
      path: '/api/projects',
      description: 'Create',
      auth: true,
      params,
      body,
      response,
    };
    expect(ep.params).toHaveLength(1);
    expect(ep.body?.fields).toHaveLength(1);
    expect(ep.response).toHaveLength(1);
  });

  it('ApiVersion holds a version string and endpoint array', () => {
    const v: ApiVersion = {
      version: '1.0.0',
      endpoints: [makeEndpoint()],
    };
    expect(v.version).toBe('1.0.0');
    expect(v.endpoints).toHaveLength(1);
  });

  it('HttpMethod covers all five verbs', () => {
    const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    expect(methods).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// generateApiDocs
// ---------------------------------------------------------------------------

describe('generateApiDocs', () => {
  it('parses a minimal route definition into an ApiEndpoint', () => {
    const routes: RouteDefinition[] = [
      makeRoute({ method: 'GET', path: '/api/projects', description: 'List projects' }),
    ];
    const result = generateApiDocs(routes);
    expect(result).toHaveLength(1);
    expect(result[0].method).toBe('GET');
    expect(result[0].path).toBe('/api/projects');
    expect(result[0].description).toBe('List projects');
    expect(result[0].auth).toBe(false);
  });

  it('normalises method to uppercase', () => {
    const routes: RouteDefinition[] = [
      makeRoute({ method: 'post' }),
      makeRoute({ method: '  Delete  ', path: '/api/projects/:id' }),
    ];
    const result = generateApiDocs(routes);
    expect(result[0].method).toBe('POST');
    expect(result[1].method).toBe('DELETE');
  });

  it('skips entries with invalid or missing methods', () => {
    const routes: RouteDefinition[] = [
      makeRoute({ method: 'CONNECT' }),
      makeRoute({ method: '' }),
    ];
    const result = generateApiDocs(routes);
    expect(result).toHaveLength(0);
  });

  it('skips entries with missing or empty path', () => {
    const routes: RouteDefinition[] = [
      makeRoute({ path: '' }),
      makeRoute({ path: undefined as unknown as string }),
    ];
    const result = generateApiDocs(routes);
    expect(result).toHaveLength(0);
  });

  it('defaults description to empty string when omitted', () => {
    const result = generateApiDocs([makeRoute({ description: undefined })]);
    expect(result[0].description).toBe('');
  });

  it('preserves params when provided', () => {
    const params: ApiParam[] = [
      { name: 'id', type: 'integer', required: true, description: 'Project ID' },
    ];
    const result = generateApiDocs([makeRoute({ params })]);
    expect(result[0].params).toEqual(params);
  });

  it('omits params key when array is empty', () => {
    const result = generateApiDocs([makeRoute({ params: [] })]);
    expect(result[0].params).toBeUndefined();
  });

  it('preserves body when provided', () => {
    const body: ApiBody = {
      contentType: 'application/json',
      fields: [{ name: 'name', type: 'string', required: true }],
    };
    const result = generateApiDocs([makeRoute({ body })]);
    expect(result[0].body).toEqual(body);
  });

  it('preserves response when provided', () => {
    const response: ApiResponse[] = [
      { statusCode: 201, description: 'Created', contentType: 'application/json' },
    ];
    const result = generateApiDocs([makeRoute({ response })]);
    expect(result[0].response).toEqual(response);
  });

  it('omits response key when array is empty', () => {
    const result = generateApiDocs([makeRoute({ response: [] })]);
    expect(result[0].response).toBeUndefined();
  });

  it('infers auth=true from ownership middleware', () => {
    const result = generateApiDocs([
      makeRoute({ middleware: ['requireProjectOwnership'] }),
    ]);
    expect(result[0].auth).toBe(true);
  });

  it('infers auth=true from circuit ownership middleware', () => {
    const result = generateApiDocs([
      makeRoute({ middleware: ['requireCircuitOwnership'] }),
    ]);
    expect(result[0].auth).toBe(true);
  });

  it('infers auth=true from admin rate limiter middleware', () => {
    const result = generateApiDocs([
      makeRoute({ middleware: ['adminRateLimiter'] }),
    ]);
    expect(result[0].auth).toBe(true);
  });

  it('infers auth=false when middleware is non-auth', () => {
    const result = generateApiDocs([
      makeRoute({ middleware: ['setCacheHeaders'] }),
    ]);
    expect(result[0].auth).toBe(false);
  });

  it('explicit auth flag overrides middleware inference', () => {
    const result = generateApiDocs([
      makeRoute({ auth: false, middleware: ['requireProjectOwnership'] }),
    ]);
    expect(result[0].auth).toBe(false);
  });

  it('handles multiple routes', () => {
    const routes: RouteDefinition[] = [
      makeRoute({ method: 'GET', path: '/api/projects' }),
      makeRoute({ method: 'POST', path: '/api/projects' }),
      makeRoute({ method: 'GET', path: '/api/projects/:id' }),
      makeRoute({ method: 'PATCH', path: '/api/projects/:id' }),
      makeRoute({ method: 'DELETE', path: '/api/projects/:id' }),
    ];
    const result = generateApiDocs(routes);
    expect(result).toHaveLength(5);
  });

  it('returns empty array for empty input', () => {
    expect(generateApiDocs([])).toEqual([]);
  });

  it('handles all five HTTP methods', () => {
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    const routes = methods.map((m) => makeRoute({ method: m, path: `/api/test-${m.toLowerCase()}` }));
    const result = generateApiDocs(routes);
    expect(result).toHaveLength(5);
    expect(result.map((r) => r.method)).toEqual(methods);
  });
});

// ---------------------------------------------------------------------------
// inferDomain
// ---------------------------------------------------------------------------

describe('inferDomain', () => {
  it('extracts "projects" for /api/projects', () => {
    expect(inferDomain('/api/projects')).toBe('projects');
  });

  it('extracts "projects" for /api/projects/:id', () => {
    expect(inferDomain('/api/projects/:id')).toBe('projects');
  });

  it('extracts sub-domain for /api/projects/:id/nodes', () => {
    expect(inferDomain('/api/projects/:id/nodes')).toBe('nodes');
  });

  it('extracts "bom" for /api/projects/:id/bom', () => {
    expect(inferDomain('/api/projects/:id/bom')).toBe('bom');
  });

  it('extracts "bom" for nested bom routes', () => {
    expect(inferDomain('/api/projects/:id/bom/:bomId')).toBe('bom');
  });

  it('extracts "circuits" for /api/projects/:id/circuits', () => {
    expect(inferDomain('/api/projects/:id/circuits')).toBe('circuits');
  });

  it('extracts "circuits" for /api/circuits/:circuitId/wires', () => {
    expect(inferDomain('/api/circuits/:circuitId/wires')).toBe('circuits');
  });

  it('extracts top-level "auth"', () => {
    expect(inferDomain('/api/auth/login')).toBe('auth');
  });

  it('extracts top-level "admin"', () => {
    expect(inferDomain('/api/admin/metrics')).toBe('admin');
  });

  it('extracts top-level "settings"', () => {
    expect(inferDomain('/api/settings/api-keys')).toBe('settings');
  });

  it('extracts top-level "batch"', () => {
    expect(inferDomain('/api/batch/submit')).toBe('batch');
  });

  it('extracts top-level "spice-models"', () => {
    expect(inferDomain('/api/spice-models')).toBe('spice-models');
  });

  it('extracts top-level "embed"', () => {
    expect(inferDomain('/api/embed/create')).toBe('embed');
  });

  it('extracts top-level "rag"', () => {
    expect(inferDomain('/api/rag/documents')).toBe('rag');
  });

  it('returns "other" for non-api paths', () => {
    expect(inferDomain('/health')).toBe('other');
  });

  it('returns "other" for bare /api', () => {
    expect(inferDomain('/api')).toBe('other');
  });

  it('handles leading slash removal', () => {
    expect(inferDomain('/api/projects/:id/validation')).toBe('validation');
  });

  it('extracts "history" domain', () => {
    expect(inferDomain('/api/projects/:id/history')).toBe('history');
  });

  it('extracts "chat" domain', () => {
    expect(inferDomain('/api/projects/:id/chat')).toBe('chat');
  });

  it('extracts "export" from /api/projects/:id/export', () => {
    expect(inferDomain('/api/projects/:id/export')).toBe('export');
  });

  it('extracts "comments" domain', () => {
    expect(inferDomain('/api/projects/:id/comments')).toBe('comments');
  });

  it('extracts "arduino" domain', () => {
    expect(inferDomain('/api/projects/:id/arduino/workspaces')).toBe('arduino');
  });
});

// ---------------------------------------------------------------------------
// groupEndpointsByDomain
// ---------------------------------------------------------------------------

describe('groupEndpointsByDomain', () => {
  it('groups endpoints by domain', () => {
    const endpoints: ApiEndpoint[] = [
      makeEndpoint({ path: '/api/projects' }),
      makeEndpoint({ path: '/api/projects/:id' }),
      makeEndpoint({ path: '/api/projects/:id/bom' }),
      makeEndpoint({ path: '/api/auth/login' }),
    ];
    const groups = groupEndpointsByDomain(endpoints);

    expect(Object.keys(groups).sort()).toEqual(['auth', 'bom', 'projects']);
    expect(groups['projects']).toHaveLength(2);
    expect(groups['bom']).toHaveLength(1);
    expect(groups['auth']).toHaveLength(1);
  });

  it('returns empty object for no endpoints', () => {
    expect(groupEndpointsByDomain([])).toEqual({});
  });

  it('handles single domain', () => {
    const endpoints = [
      makeEndpoint({ path: '/api/auth/login' }),
      makeEndpoint({ path: '/api/auth/register' }),
      makeEndpoint({ path: '/api/auth/logout' }),
    ];
    const groups = groupEndpointsByDomain(endpoints);
    expect(Object.keys(groups)).toEqual(['auth']);
    expect(groups['auth']).toHaveLength(3);
  });

  it('separates circuit routes from project routes', () => {
    const endpoints = [
      makeEndpoint({ path: '/api/projects/:id/circuits' }),
      makeEndpoint({ path: '/api/circuits/:circuitId/wires' }),
      makeEndpoint({ path: '/api/projects/:id' }),
    ];
    const groups = groupEndpointsByDomain(endpoints);
    expect(groups['circuits']).toHaveLength(2);
    expect(groups['projects']).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// searchEndpoints
// ---------------------------------------------------------------------------

describe('searchEndpoints', () => {
  const sampleEndpoints: ApiEndpoint[] = [
    makeEndpoint({
      method: 'GET',
      path: '/api/projects',
      description: 'List all projects',
    }),
    makeEndpoint({
      method: 'POST',
      path: '/api/projects',
      description: 'Create a new project',
    }),
    makeEndpoint({
      method: 'GET',
      path: '/api/projects/:id/bom',
      description: 'Get BOM items for project',
      params: [{ name: 'id', type: 'integer', required: true, description: 'Project identifier' }],
    }),
    makeEndpoint({
      method: 'POST',
      path: '/api/auth/login',
      description: 'Authenticate user',
      body: {
        contentType: 'application/json',
        fields: [{ name: 'username', type: 'string', required: true }],
      },
    }),
    makeEndpoint({
      method: 'DELETE',
      path: '/api/projects/:id/validation/:issueId',
      description: 'Remove a validation issue',
      response: [{ statusCode: 204, description: 'No Content' }],
    }),
  ];

  it('returns all endpoints for empty query', () => {
    expect(searchEndpoints(sampleEndpoints, '')).toHaveLength(5);
  });

  it('returns all endpoints for whitespace-only query', () => {
    expect(searchEndpoints(sampleEndpoints, '   ')).toHaveLength(5);
  });

  it('matches by path substring', () => {
    const results = searchEndpoints(sampleEndpoints, 'bom');
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe('/api/projects/:id/bom');
  });

  it('matches by description substring', () => {
    const results = searchEndpoints(sampleEndpoints, 'Authenticate');
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe('/api/auth/login');
  });

  it('matches case-insensitively', () => {
    const results = searchEndpoints(sampleEndpoints, 'PROJECT');
    expect(results.length).toBeGreaterThanOrEqual(3);
  });

  it('matches by method', () => {
    const results = searchEndpoints(sampleEndpoints, 'delete');
    expect(results).toHaveLength(1);
    expect(results[0].method).toBe('DELETE');
  });

  it('matches by param name', () => {
    const results = searchEndpoints(sampleEndpoints, 'identifier');
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe('/api/projects/:id/bom');
  });

  it('matches by body field name', () => {
    const results = searchEndpoints(sampleEndpoints, 'username');
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe('/api/auth/login');
  });

  it('matches by response description', () => {
    const results = searchEndpoints(sampleEndpoints, 'No Content');
    expect(results).toHaveLength(1);
    expect(results[0].path).toContain('validation');
  });

  it('returns empty array when no matches', () => {
    const results = searchEndpoints(sampleEndpoints, 'zzz_nonexistent_zzz');
    expect(results).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getEndpointsByMethod
// ---------------------------------------------------------------------------

describe('getEndpointsByMethod', () => {
  const sampleEndpoints: ApiEndpoint[] = [
    makeEndpoint({ method: 'GET', path: '/api/projects' }),
    makeEndpoint({ method: 'POST', path: '/api/projects' }),
    makeEndpoint({ method: 'GET', path: '/api/projects/:id' }),
    makeEndpoint({ method: 'PATCH', path: '/api/projects/:id' }),
    makeEndpoint({ method: 'DELETE', path: '/api/projects/:id' }),
    makeEndpoint({ method: 'PUT', path: '/api/projects/:id/validation' }),
  ];

  it('filters by GET', () => {
    const results = getEndpointsByMethod(sampleEndpoints, 'GET');
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.method === 'GET')).toBe(true);
  });

  it('filters by POST', () => {
    const results = getEndpointsByMethod(sampleEndpoints, 'POST');
    expect(results).toHaveLength(1);
    expect(results[0].method).toBe('POST');
  });

  it('filters by PUT', () => {
    const results = getEndpointsByMethod(sampleEndpoints, 'PUT');
    expect(results).toHaveLength(1);
  });

  it('filters by PATCH', () => {
    const results = getEndpointsByMethod(sampleEndpoints, 'PATCH');
    expect(results).toHaveLength(1);
  });

  it('filters by DELETE', () => {
    const results = getEndpointsByMethod(sampleEndpoints, 'DELETE');
    expect(results).toHaveLength(1);
  });

  it('is case-insensitive', () => {
    const results = getEndpointsByMethod(sampleEndpoints, 'get');
    expect(results).toHaveLength(2);
  });

  it('returns empty for invalid method', () => {
    expect(getEndpointsByMethod(sampleEndpoints, 'OPTIONS')).toEqual([]);
    expect(getEndpointsByMethod(sampleEndpoints, '')).toEqual([]);
  });

  it('returns empty for empty endpoint list', () => {
    expect(getEndpointsByMethod([], 'GET')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// formatAsMarkdown
// ---------------------------------------------------------------------------

describe('formatAsMarkdown', () => {
  it('returns empty-state message for no endpoints', () => {
    const md = formatAsMarkdown([]);
    expect(md).toContain('# API Documentation');
    expect(md).toContain('No endpoints documented.');
  });

  it('includes title and endpoint count', () => {
    const endpoints = [makeEndpoint()];
    const md = formatAsMarkdown(endpoints);
    expect(md).toContain('# API Documentation');
    expect(md).toContain('1 endpoint');
  });

  it('pluralises endpoint count correctly', () => {
    const endpoints = [
      makeEndpoint({ path: '/api/projects' }),
      makeEndpoint({ path: '/api/projects/:id' }),
    ];
    const md = formatAsMarkdown(endpoints);
    expect(md).toContain('2 endpoints');
  });

  it('includes table of contents with domain names', () => {
    const endpoints = [
      makeEndpoint({ path: '/api/projects' }),
      makeEndpoint({ path: '/api/auth/login' }),
    ];
    const md = formatAsMarkdown(endpoints);
    expect(md).toContain('## Table of Contents');
    expect(md).toContain('- [auth]');
    expect(md).toContain('- [projects]');
  });

  it('renders method and path as heading', () => {
    const endpoints = [makeEndpoint({ method: 'POST', path: '/api/projects' })];
    const md = formatAsMarkdown(endpoints);
    expect(md).toContain('### `POST` /api/projects');
  });

  it('appends AUTH badge for authenticated endpoints', () => {
    const endpoints = [makeEndpoint({ auth: true })];
    const md = formatAsMarkdown(endpoints);
    expect(md).toContain('`AUTH`');
  });

  it('does not include AUTH badge for public endpoints', () => {
    const endpoints = [makeEndpoint({ auth: false })];
    const md = formatAsMarkdown(endpoints);
    expect(md).not.toContain('`AUTH`');
  });

  it('includes description text', () => {
    const endpoints = [makeEndpoint({ description: 'Retrieve all projects' })];
    const md = formatAsMarkdown(endpoints);
    expect(md).toContain('Retrieve all projects');
  });

  it('renders parameters table when params exist', () => {
    const endpoints = [
      makeEndpoint({
        params: [{ name: 'id', type: 'integer', required: true, description: 'Project ID' }],
      }),
    ];
    const md = formatAsMarkdown(endpoints);
    expect(md).toContain('**Parameters:**');
    expect(md).toContain('| id | integer | Yes | Project ID |');
  });

  it('renders body schema when body exists', () => {
    const endpoints = [
      makeEndpoint({
        body: {
          contentType: 'application/json',
          fields: [{ name: 'name', type: 'string', required: true, description: 'Project name' }],
        },
      }),
    ];
    const md = formatAsMarkdown(endpoints);
    expect(md).toContain('**Body** (`application/json`):');
    expect(md).toContain('| name | string | Yes | Project name |');
  });

  it('renders response table when responses exist', () => {
    const endpoints = [
      makeEndpoint({
        response: [
          { statusCode: 200, description: 'OK', contentType: 'application/json' },
          { statusCode: 404, description: 'Not Found' },
        ],
      }),
    ];
    const md = formatAsMarkdown(endpoints);
    expect(md).toContain('**Responses:**');
    expect(md).toContain('| 200 | OK | application/json |');
    expect(md).toContain('| 404 | Not Found | application/json |');
  });

  it('separators between endpoints', () => {
    const endpoints = [makeEndpoint()];
    const md = formatAsMarkdown(endpoints);
    expect(md).toContain('---');
  });

  it('groups multiple domains in sorted order', () => {
    const endpoints = [
      makeEndpoint({ path: '/api/projects/:id/bom' }),
      makeEndpoint({ path: '/api/auth/login' }),
      makeEndpoint({ path: '/api/projects' }),
    ];
    const md = formatAsMarkdown(endpoints);
    const authIdx = md.indexOf('## auth');
    const bomIdx = md.indexOf('## bom');
    const projectsIdx = md.indexOf('## projects');
    expect(authIdx).toBeLessThan(bomIdx);
    expect(bomIdx).toBeLessThan(projectsIdx);
  });

  it('handles param without description gracefully', () => {
    const endpoints = [
      makeEndpoint({
        params: [{ name: 'id', type: 'integer', required: true }],
      }),
    ];
    const md = formatAsMarkdown(endpoints);
    expect(md).toContain('| id | integer | Yes | - |');
  });
});

// ---------------------------------------------------------------------------
// Integration — realistic ProtoPulse routes
// ---------------------------------------------------------------------------

describe('integration: realistic ProtoPulse routes', () => {
  const protoPulseRoutes: RouteDefinition[] = [
    { method: 'GET', path: '/api/projects', description: 'List all projects' },
    { method: 'GET', path: '/api/projects/:id', description: 'Get project by ID' },
    { method: 'POST', path: '/api/projects', description: 'Create project' },
    { method: 'PATCH', path: '/api/projects/:id', description: 'Update project', middleware: ['requireProjectOwnership'] },
    { method: 'DELETE', path: '/api/projects/:id', description: 'Soft-delete project', middleware: ['requireProjectOwnership'] },
    { method: 'GET', path: '/api/projects/:id/nodes', description: 'List architecture nodes', middleware: ['requireProjectOwnership'] },
    { method: 'POST', path: '/api/projects/:id/nodes', description: 'Create architecture node', middleware: ['requireProjectOwnership'] },
    { method: 'GET', path: '/api/projects/:id/bom', description: 'List BOM items', middleware: ['requireProjectOwnership'] },
    { method: 'POST', path: '/api/projects/:id/bom', description: 'Create BOM item', middleware: ['requireProjectOwnership'] },
    { method: 'POST', path: '/api/auth/register', description: 'Register new user' },
    { method: 'POST', path: '/api/auth/login', description: 'Login' },
    { method: 'POST', path: '/api/auth/logout', description: 'Logout' },
    { method: 'GET', path: '/api/auth/me', description: 'Get current user' },
    { method: 'GET', path: '/api/settings/api-keys', description: 'List API key providers' },
    { method: 'POST', path: '/api/settings/api-keys', description: 'Store API key' },
    { method: 'GET', path: '/api/projects/:id/validation', description: 'List validation issues', middleware: ['requireProjectOwnership'] },
    { method: 'GET', path: '/api/projects/:id/chat', description: 'List chat messages', middleware: ['requireProjectOwnership'] },
    { method: 'POST', path: '/api/projects/:id/chat/stream', description: 'Stream AI response', middleware: ['requireProjectOwnership'] },
    { method: 'GET', path: '/api/circuits/:circuitId/wires', description: 'List circuit wires', middleware: ['requireCircuitOwnership'] },
    { method: 'POST', path: '/api/projects/:projectId/circuits', description: 'Create circuit design', middleware: ['requireProjectOwnership'] },
    { method: 'GET', path: '/api/admin/metrics', description: 'Admin metrics', middleware: ['adminRateLimiter'] },
    { method: 'GET', path: '/api/spice-models', description: 'List SPICE models' },
  ];

  const endpoints = generateApiDocs(protoPulseRoutes);

  it('parses all 22 routes', () => {
    expect(endpoints).toHaveLength(22);
  });

  it('correctly infers auth on ownership-protected routes', () => {
    const patchProject = endpoints.find((e) => e.method === 'PATCH' && e.path === '/api/projects/:id');
    expect(patchProject?.auth).toBe(true);
  });

  it('correctly infers no auth on public routes', () => {
    const listProjects = endpoints.find((e) => e.method === 'GET' && e.path === '/api/projects');
    expect(listProjects?.auth).toBe(false);
  });

  it('groups into expected domains', () => {
    const groups = groupEndpointsByDomain(endpoints);
    const domains = Object.keys(groups).sort();
    expect(domains).toContain('projects');
    expect(domains).toContain('auth');
    expect(domains).toContain('bom');
    expect(domains).toContain('nodes');
    expect(domains).toContain('circuits');
    expect(domains).toContain('admin');
    expect(domains).toContain('settings');
    expect(domains).toContain('spice-models');
  });

  it('search finds BOM-related endpoints', () => {
    const results = searchEndpoints(endpoints, 'bom');
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.every((r) => r.path.includes('bom') || r.description.toLowerCase().includes('bom'))).toBe(true);
  });

  it('search finds auth endpoints', () => {
    const results = searchEndpoints(endpoints, 'auth');
    expect(results.length).toBeGreaterThanOrEqual(4);
  });

  it('getEndpointsByMethod returns all GETs', () => {
    const gets = getEndpointsByMethod(endpoints, 'GET');
    expect(gets.length).toBeGreaterThanOrEqual(9);
    expect(gets.every((e) => e.method === 'GET')).toBe(true);
  });

  it('generates valid Markdown for all endpoints', () => {
    const md = formatAsMarkdown(endpoints);
    expect(md).toContain('# API Documentation');
    expect(md).toContain('22 endpoints');
    // Verify domain sections
    expect(md).toContain('## projects');
    expect(md).toContain('## auth');
    expect(md).toContain('## bom');
  });
});
