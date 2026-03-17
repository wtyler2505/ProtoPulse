/**
 * API Documentation Generator
 *
 * Parses ProtoPulse route definitions into structured ApiEndpoint objects and
 * provides utilities for grouping, searching, filtering, versioning, and
 * Markdown export.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** HTTP methods supported by the Express router. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Description of a single query/path parameter. */
export interface ApiParam {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

/** Description of a request body schema. */
export interface ApiBody {
  contentType: string;
  fields: ApiParam[];
}

/** Description of a response schema. */
export interface ApiResponse {
  statusCode: number;
  description: string;
  contentType?: string;
}

/** Fully-specified API endpoint. */
export interface ApiEndpoint {
  method: HttpMethod;
  path: string;
  description: string;
  params?: ApiParam[];
  body?: ApiBody;
  response?: ApiResponse[];
  auth: boolean;
}

/** A versioned collection of endpoints. */
export interface ApiVersion {
  version: string;
  endpoints: ApiEndpoint[];
}

// ---------------------------------------------------------------------------
// Route definition — the shape consumed by generateApiDocs
// ---------------------------------------------------------------------------

/** Minimal route definition that generateApiDocs can parse. */
export interface RouteDefinition {
  method: string;
  path: string;
  description?: string;
  params?: ApiParam[];
  body?: ApiBody;
  response?: ApiResponse[];
  auth?: boolean;
  /** Middleware names attached to this route (e.g. 'requireProjectOwnership'). */
  middleware?: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_METHODS: ReadonlySet<string> = new Set<string>([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
]);

/** Middleware names that imply authentication is required. */
const AUTH_MIDDLEWARE: ReadonlySet<string> = new Set<string>([
  'requireProjectOwnership',
  'requireCircuitOwnership',
  'adminRateLimiter',
  'validateSession',
  'authLimiter',
]);

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Normalise a raw HTTP method string into the canonical `HttpMethod` union.
 * Returns `undefined` for unrecognised values.
 */
function normaliseMethod(raw: string): HttpMethod | undefined {
  const upper = raw.toUpperCase().trim();
  return VALID_METHODS.has(upper) ? (upper as HttpMethod) : undefined;
}

/**
 * Infer the domain from a route path.
 *
 * Rules:
 *  - `/api/auth/*`         → "auth"
 *  - `/api/admin/*`        → "admin"
 *  - `/api/batch/*`        → "batch"
 *  - `/api/settings/*`     → "settings"
 *  - `/api/spice-models/*` → "spice-models"
 *  - `/api/projects/:id/circuits/*` or `/api/circuits/*` → "circuits"
 *  - `/api/projects/:id/<domain>/*` → "<domain>"
 *  - `/api/projects`       → "projects"
 *  - Fallback              → "other"
 */
export function inferDomain(path: string): string {
  const segments = path.replace(/^\//, '').split('/').filter(Boolean);

  // Must start with "api"
  if (segments[0] !== 'api') {
    return 'other';
  }

  // Top-level domain routes: /api/auth, /api/admin, /api/batch, etc.
  const topLevel = segments[1];
  if (!topLevel) {
    return 'other';
  }

  // Literal top-level domains (not nested under /projects/:id)
  const TOP_LEVEL_DOMAINS: ReadonlySet<string> = new Set([
    'auth',
    'admin',
    'batch',
    'settings',
    'spice-models',
    'seed',
    'embed',
    'rag',
    'health',
  ]);

  if (TOP_LEVEL_DOMAINS.has(topLevel)) {
    return topLevel;
  }

  // /api/circuits/:circuitId/...
  if (topLevel === 'circuits') {
    return 'circuits';
  }

  // /api/projects...
  if (topLevel === 'projects') {
    // /api/projects  or  /api/projects/:id
    if (segments.length <= 3) {
      return 'projects';
    }

    // /api/projects/:id/<subDomain>/...
    const subDomain = segments[3];
    if (!subDomain) {
      return 'projects';
    }

    // Circuit sub-routes under projects
    if (subDomain === 'circuits') {
      return 'circuits';
    }

    return subDomain;
  }

  return topLevel;
}

/**
 * Determine whether a route requires authentication based on explicit flag
 * and/or attached middleware names.
 */
function inferAuth(def: RouteDefinition): boolean {
  if (typeof def.auth === 'boolean') {
    return def.auth;
  }

  if (def.middleware && def.middleware.length > 0) {
    return def.middleware.some((mw) => AUTH_MIDDLEWARE.has(mw));
  }

  // Public by default when no information is provided.
  return false;
}

/**
 * Parse an array of route definitions into structured `ApiEndpoint` objects.
 *
 * Invalid entries (missing path, unrecognised method) are silently skipped.
 */
export function generateApiDocs(routes: RouteDefinition[]): ApiEndpoint[] {
  const endpoints: ApiEndpoint[] = [];

  for (const route of routes) {
    if (!route.path || typeof route.path !== 'string') {
      continue;
    }

    const method = normaliseMethod(route.method ?? 'GET');
    if (!method) {
      continue;
    }

    const endpoint: ApiEndpoint = {
      method,
      path: route.path,
      description: route.description ?? '',
      auth: inferAuth(route),
    };

    if (route.params && route.params.length > 0) {
      endpoint.params = route.params;
    }

    if (route.body) {
      endpoint.body = route.body;
    }

    if (route.response && route.response.length > 0) {
      endpoint.response = route.response;
    }

    endpoints.push(endpoint);
  }

  return endpoints;
}

// ---------------------------------------------------------------------------
// Grouping, searching & filtering
// ---------------------------------------------------------------------------

/**
 * Group endpoints by inferred domain.
 */
export function groupEndpointsByDomain(
  endpoints: ApiEndpoint[],
): Record<string, ApiEndpoint[]> {
  const groups: Record<string, ApiEndpoint[]> = {};

  for (const ep of endpoints) {
    const domain = inferDomain(ep.path);
    if (!groups[domain]) {
      groups[domain] = [];
    }
    groups[domain].push(ep);
  }

  return groups;
}

/**
 * Full-text search across endpoint path, description, param names, and body
 * field names.  Case-insensitive.  Returns all endpoints whose any searchable
 * field contains the query string.
 */
export function searchEndpoints(
  endpoints: ApiEndpoint[],
  query: string,
): ApiEndpoint[] {
  if (!query || query.trim().length === 0) {
    return [...endpoints];
  }

  const q = query.toLowerCase().trim();

  return endpoints.filter((ep) => {
    // Path
    if (ep.path.toLowerCase().includes(q)) {
      return true;
    }

    // Description
    if (ep.description.toLowerCase().includes(q)) {
      return true;
    }

    // Method
    if (ep.method.toLowerCase().includes(q)) {
      return true;
    }

    // Params
    if (ep.params) {
      for (const p of ep.params) {
        if (p.name.toLowerCase().includes(q)) {
          return true;
        }
        if (p.description && p.description.toLowerCase().includes(q)) {
          return true;
        }
      }
    }

    // Body fields
    if (ep.body?.fields) {
      for (const f of ep.body.fields) {
        if (f.name.toLowerCase().includes(q)) {
          return true;
        }
        if (f.description && f.description.toLowerCase().includes(q)) {
          return true;
        }
      }
    }

    // Response descriptions
    if (ep.response) {
      for (const r of ep.response) {
        if (r.description.toLowerCase().includes(q)) {
          return true;
        }
      }
    }

    return false;
  });
}

/**
 * Filter endpoints by HTTP method.  Case-insensitive.
 */
export function getEndpointsByMethod(
  endpoints: ApiEndpoint[],
  method: string,
): ApiEndpoint[] {
  const m = normaliseMethod(method);
  if (!m) {
    return [];
  }
  return endpoints.filter((ep) => ep.method === m);
}

// ---------------------------------------------------------------------------
// Markdown export
// ---------------------------------------------------------------------------

/**
 * Render the list of endpoints as a Markdown document.
 *
 * Endpoints are grouped by domain and listed with method badges, auth
 * indicators, descriptions, parameter tables, body schemas, and response
 * tables.
 */
export function formatAsMarkdown(endpoints: ApiEndpoint[]): string {
  if (endpoints.length === 0) {
    return '# API Documentation\n\nNo endpoints documented.\n';
  }

  const groups = groupEndpointsByDomain(endpoints);
  const domainKeys = Object.keys(groups).sort();

  const lines: string[] = [];
  lines.push('# API Documentation');
  lines.push('');
  lines.push(`> ${endpoints.length} endpoint${endpoints.length === 1 ? '' : 's'} across ${domainKeys.length} domain${domainKeys.length === 1 ? '' : 's'}.`);
  lines.push('');

  // Table of contents
  lines.push('## Table of Contents');
  lines.push('');
  for (const domain of domainKeys) {
    const count = groups[domain].length;
    const anchor = domain.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    lines.push(`- [${domain}](#${anchor}) (${count})`);
  }
  lines.push('');

  // Domain sections
  for (const domain of domainKeys) {
    const domainEndpoints = groups[domain];
    lines.push(`## ${domain}`);
    lines.push('');

    for (const ep of domainEndpoints) {
      const authBadge = ep.auth ? ' `AUTH`' : '';
      lines.push(`### \`${ep.method}\` ${ep.path}${authBadge}`);
      lines.push('');

      if (ep.description) {
        lines.push(ep.description);
        lines.push('');
      }

      // Parameters
      if (ep.params && ep.params.length > 0) {
        lines.push('**Parameters:**');
        lines.push('');
        lines.push('| Name | Type | Required | Description |');
        lines.push('| ---- | ---- | -------- | ----------- |');
        for (const p of ep.params) {
          lines.push(
            `| ${p.name} | ${p.type} | ${p.required ? 'Yes' : 'No'} | ${p.description ?? '-'} |`,
          );
        }
        lines.push('');
      }

      // Body
      if (ep.body) {
        lines.push(`**Body** (\`${ep.body.contentType}\`):`);
        lines.push('');
        if (ep.body.fields.length > 0) {
          lines.push('| Field | Type | Required | Description |');
          lines.push('| ----- | ---- | -------- | ----------- |');
          for (const f of ep.body.fields) {
            lines.push(
              `| ${f.name} | ${f.type} | ${f.required ? 'Yes' : 'No'} | ${f.description ?? '-'} |`,
            );
          }
          lines.push('');
        }
      }

      // Response
      if (ep.response && ep.response.length > 0) {
        lines.push('**Responses:**');
        lines.push('');
        lines.push('| Status | Description | Content-Type |');
        lines.push('| ------ | ----------- | ------------ |');
        for (const r of ep.response) {
          lines.push(
            `| ${r.statusCode} | ${r.description} | ${r.contentType ?? 'application/json'} |`,
          );
        }
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }
  }

  return lines.join('\n');
}
