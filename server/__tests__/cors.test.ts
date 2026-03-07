import { describe, it, expect } from 'vitest';

/**
 * CORS allowlist hardening tests.
 *
 * These test the CORS middleware logic in isolation by verifying the rules:
 * 1. Dev mode: localhost origins are always allowed
 * 2. Production: only CORS_ALLOWED_ORIGINS env var origins are allowed
 * 3. No env var in production = no CORS headers (same-origin only)
 * 4. Vary: Origin is set when origin matches
 * 5. OPTIONS preflight returns 204
 */

// ---------------------------------------------------------------------------
// Test the CORS origin matching logic extracted from server/index.ts
// We replicate the exact same logic here so we test the algorithm, not Express.
// ---------------------------------------------------------------------------

const DEV_ORIGINS = [
  'http://localhost:5000',
  'http://localhost:3000',
  'http://127.0.0.1:5000',
];

function buildAllowedOrigins(isDev: boolean, envVar?: string): Set<string> {
  const envOrigins = (envVar ?? '').split(',').map(s => s.trim()).filter(Boolean);
  return new Set(isDev ? DEV_ORIGINS.concat(envOrigins) : envOrigins);
}

interface MockHeaders {
  'access-control-allow-origin'?: string;
  'access-control-allow-credentials'?: string;
  'access-control-allow-methods'?: string;
  'access-control-allow-headers'?: string;
  'access-control-expose-headers'?: string;
  'vary'?: string;
}

function simulateCorsMiddleware(
  allowedOrigins: Set<string>,
  requestOrigin: string | undefined,
  method: string,
): { status: number | null; headers: MockHeaders } {
  const headers: MockHeaders = {};
  let status: number | null = null;

  const origin = typeof requestOrigin === 'string' ? requestOrigin : undefined;
  if (origin && allowedOrigins.has(origin)) {
    headers['access-control-allow-origin'] = origin;
    headers['access-control-allow-credentials'] = 'true';
    headers['vary'] = 'Origin';
  }
  if (allowedOrigins.size > 0) {
    headers['access-control-allow-methods'] = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
    headers['access-control-allow-headers'] = 'Content-Type,Authorization,X-Session-Id,If-Match';
    headers['access-control-expose-headers'] = 'X-Request-Id,ETag';
  }
  if (method === 'OPTIONS') {
    status = 204;
  }

  return { status, headers };
}

// =============================================================================
// Dev mode CORS
// =============================================================================

describe('CORS allowlist — dev mode', () => {
  const origins = buildAllowedOrigins(true);

  it('includes default localhost:5000', () => {
    expect(origins.has('http://localhost:5000')).toBe(true);
  });

  it('includes default localhost:3000', () => {
    expect(origins.has('http://localhost:3000')).toBe(true);
  });

  it('includes default 127.0.0.1:5000', () => {
    expect(origins.has('http://127.0.0.1:5000')).toBe(true);
  });

  it('merges env var origins in dev mode', () => {
    const merged = buildAllowedOrigins(true, 'https://staging.example.com');
    expect(merged.has('http://localhost:5000')).toBe(true);
    expect(merged.has('https://staging.example.com')).toBe(true);
  });

  it('sets Access-Control-Allow-Origin for allowed origin', () => {
    const { headers } = simulateCorsMiddleware(origins, 'http://localhost:5000', 'GET');
    expect(headers['access-control-allow-origin']).toBe('http://localhost:5000');
    expect(headers['access-control-allow-credentials']).toBe('true');
    expect(headers['vary']).toBe('Origin');
  });

  it('does NOT set Access-Control-Allow-Origin for disallowed origin', () => {
    const { headers } = simulateCorsMiddleware(origins, 'https://evil.com', 'GET');
    expect(headers['access-control-allow-origin']).toBeUndefined();
    expect(headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('still sets method/header/expose headers when allowlist is non-empty', () => {
    const { headers } = simulateCorsMiddleware(origins, 'https://evil.com', 'GET');
    expect(headers['access-control-allow-methods']).toBe('GET,POST,PUT,PATCH,DELETE,OPTIONS');
    expect(headers['access-control-allow-headers']).toContain('X-Session-Id');
    expect(headers['access-control-expose-headers']).toContain('X-Request-Id');
  });

  it('returns 204 for OPTIONS preflight', () => {
    const { status } = simulateCorsMiddleware(origins, 'http://localhost:5000', 'OPTIONS');
    expect(status).toBe(204);
  });
});

// =============================================================================
// Production mode CORS — with env var
// =============================================================================

describe('CORS allowlist — production with env var', () => {
  const origins = buildAllowedOrigins(false, 'https://app.protopulse.io, https://staging.protopulse.io');

  it('does NOT include localhost origins', () => {
    expect(origins.has('http://localhost:5000')).toBe(false);
    expect(origins.has('http://localhost:3000')).toBe(false);
    expect(origins.has('http://127.0.0.1:5000')).toBe(false);
  });

  it('includes env-specified origins', () => {
    expect(origins.has('https://app.protopulse.io')).toBe(true);
    expect(origins.has('https://staging.protopulse.io')).toBe(true);
  });

  it('sets CORS headers for allowed origin', () => {
    const { headers } = simulateCorsMiddleware(origins, 'https://app.protopulse.io', 'GET');
    expect(headers['access-control-allow-origin']).toBe('https://app.protopulse.io');
  });

  it('rejects origins not in the env var', () => {
    const { headers } = simulateCorsMiddleware(origins, 'https://evil.com', 'POST');
    expect(headers['access-control-allow-origin']).toBeUndefined();
  });
});

// =============================================================================
// Production mode CORS — no env var (same-origin only)
// =============================================================================

describe('CORS allowlist — production without env var (same-origin)', () => {
  const origins = buildAllowedOrigins(false, undefined);

  it('has an empty allowlist', () => {
    expect(origins.size).toBe(0);
  });

  it('does NOT set any CORS headers', () => {
    const { headers } = simulateCorsMiddleware(origins, 'https://anything.com', 'GET');
    expect(headers['access-control-allow-origin']).toBeUndefined();
    expect(headers['access-control-allow-methods']).toBeUndefined();
    expect(headers['access-control-allow-headers']).toBeUndefined();
  });

  it('still returns 204 for OPTIONS (preflight always terminates)', () => {
    const { status } = simulateCorsMiddleware(origins, 'https://anything.com', 'OPTIONS');
    expect(status).toBe(204);
  });
});

// =============================================================================
// Edge cases
// =============================================================================

describe('CORS allowlist — edge cases', () => {
  it('handles empty CORS_ALLOWED_ORIGINS gracefully', () => {
    const origins = buildAllowedOrigins(false, '');
    expect(origins.size).toBe(0);
  });

  it('handles whitespace-only CORS_ALLOWED_ORIGINS', () => {
    const origins = buildAllowedOrigins(false, '  ,  , ');
    expect(origins.size).toBe(0);
  });

  it('trims whitespace around origins', () => {
    const origins = buildAllowedOrigins(false, ' https://a.com , https://b.com ');
    expect(origins.has('https://a.com')).toBe(true);
    expect(origins.has('https://b.com')).toBe(true);
  });

  it('deduplicates origins', () => {
    const origins = buildAllowedOrigins(true, 'http://localhost:5000');
    // localhost:5000 is in both DEV_ORIGINS and env var — Set deduplicates
    expect(origins.size).toBe(3); // 3 dev origins, env duplicate merged
  });

  it('handles no origin header gracefully (non-browser request)', () => {
    const origins = buildAllowedOrigins(true);
    const { headers } = simulateCorsMiddleware(origins, undefined, 'GET');
    expect(headers['access-control-allow-origin']).toBeUndefined();
  });
});
