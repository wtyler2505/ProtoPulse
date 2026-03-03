import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { logger } from './logger';
import { normalizePath } from './metrics';
import { validateSession } from './auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditEntry {
  timestamp: string;
  requestId: string;
  method: string;
  path: string;
  normalizedPath: string;
  statusCode: number;
  durationMs: number;
  userId: number | null;
  ip: string;
  userAgent: string;
  contentLength: number | null;
  responseSize: number | null;
}

// ---------------------------------------------------------------------------
// Exclusion rules
// ---------------------------------------------------------------------------

/**
 * Paths that should not generate audit log entries.
 * Health checks and readiness probes are high-frequency and low-value for audit.
 */
const EXCLUDED_PATHS = new Set(['/api/health', '/api/ready']);

/**
 * Prefixes for static asset paths that should not be audited.
 */
const STATIC_PREFIXES = ['/assets/', '/favicon', '/_vite/', '/node_modules/', '/src/'];

function shouldSkip(path: string): boolean {
  if (EXCLUDED_PATHS.has(path)) {
    return true;
  }
  for (const prefix of STATIC_PREFIXES) {
    if (path.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// User ID resolution
// ---------------------------------------------------------------------------

/**
 * Attempt to resolve the userId from the request.
 * Uses req.userId if the auth middleware has already run, otherwise
 * falls back to a non-blocking session validation.
 * Never throws — returns null on any failure.
 */
async function resolveUserId(req: Request): Promise<number | null> {
  // Auth middleware may have already set this
  if (req.userId != null) {
    return req.userId;
  }

  const sessionId = req.headers['x-session-id'];
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    return null;
  }

  try {
    const session = await validateSession(sessionId);
    return session?.userId ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Log level selection
// ---------------------------------------------------------------------------

function logAuditEntry(entry: AuditEntry): void {
  const msg = `${entry.method} ${entry.normalizedPath} ${entry.statusCode} ${entry.durationMs}ms`;
  const data: Record<string, unknown> = { audit: entry };

  if (entry.statusCode >= 500) {
    logger.error(msg, data);
  } else if (entry.statusCode >= 400) {
    logger.warn(msg, data);
  } else {
    logger.info(msg, data);
  }
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Express middleware that produces structured audit log entries for every
 * API request. Must be registered after body parsing so that content-length
 * is available, but before route handlers.
 *
 * - Generates a unique request ID (set as X-Request-Id response header)
 *   if one has not already been set by earlier middleware.
 * - Extracts userId from X-Session-Id header (non-blocking).
 * - Logs at info/warn/error depending on status code.
 * - Skips health checks and static asset requests.
 */
export function auditLogMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (shouldSkip(req.path)) {
    next();
    return;
  }

  const start = Date.now();

  // Use existing request ID if present (set by earlier middleware), otherwise generate one
  const requestId = req.id || crypto.randomUUID();
  if (!req.id) {
    req.id = requestId;
  }
  res.setHeader('X-Request-Id', requestId);

  // Capture the content-length from the request
  const contentLengthHeader = req.headers['content-length'];
  const contentLength = contentLengthHeader != null ? parseInt(contentLengthHeader, 10) : null;

  // Capture response size by intercepting the write/end methods
  let responseBytes = 0;
  const originalWrite = res.write.bind(res) as typeof res.write;
  const originalEnd = res.end.bind(res) as typeof res.end;

  res.write = function (this: Response, chunk: Parameters<typeof originalWrite>[0], ...args: unknown[]) {
    if (chunk) {
      responseBytes += typeof chunk === 'string' ? Buffer.byteLength(chunk) : (chunk as Buffer).length;
    }
    return (originalWrite as (...a: unknown[]) => boolean)(chunk, ...args);
  } as typeof res.write;

  res.end = function (this: Response, chunk?: Parameters<typeof originalEnd>[0], ...args: unknown[]) {
    if (chunk && typeof chunk !== 'function') {
      responseBytes += typeof chunk === 'string' ? Buffer.byteLength(chunk) : (chunk as Buffer).length;
    }
    return (originalEnd as (...a: unknown[]) => Response)(chunk, ...args);
  } as typeof res.end;

  res.on('finish', () => {
    const durationMs = Date.now() - start;

    // Resolve userId asynchronously — do not block the response
    void resolveUserId(req).then((userId) => {
      const entry: AuditEntry = {
        timestamp: new Date().toISOString(),
        requestId,
        method: req.method,
        path: req.path,
        normalizedPath: normalizePath(req.path),
        statusCode: res.statusCode,
        durationMs,
        userId,
        ip: req.ip ?? req.socket.remoteAddress ?? 'unknown',
        userAgent: req.headers['user-agent'] ?? '',
        contentLength: contentLength != null && !Number.isNaN(contentLength) ? contentLength : null,
        responseSize: responseBytes > 0 ? responseBytes : null,
      };

      logAuditEntry(entry);
    });
  });

  next();
}
