import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import type { Request, Response, NextFunction } from 'express';
import { auditLogMiddleware } from '../audit-log';
import type { AuditEntry } from '../audit-log';
import { logger } from '../logger';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../auth', () => ({
  validateSession: vi.fn().mockResolvedValue(null),
}));

// ---------------------------------------------------------------------------
// Mock Request / Response factories
// ---------------------------------------------------------------------------

interface MockReqOptions {
  method?: string;
  path?: string;
  id?: string;
  userId?: number;
  headers?: Record<string, string>;
  ip?: string;
}

function createMockReq(opts: MockReqOptions = {}): Request {
  return {
    method: opts.method ?? 'GET',
    path: opts.path ?? '/api/test',
    id: opts.id ?? 'test-req-id-123',
    userId: opts.userId,
    headers: {
      'user-agent': 'test-agent/1.0',
      ...opts.headers,
    },
    ip: opts.ip ?? '127.0.0.1',
    socket: { remoteAddress: opts.ip ?? '127.0.0.1' },
  } as unknown as Request;
}

interface MockRes extends EventEmitter {
  statusCode: number;
  setHeader: ReturnType<typeof vi.fn>;
  write: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
  getHeader: ReturnType<typeof vi.fn>;
}

function createMockRes(statusCode = 200): MockRes {
  const res = new EventEmitter() as MockRes;
  res.statusCode = statusCode;
  res.setHeader = vi.fn();
  res.write = vi.fn().mockReturnValue(true);
  res.end = vi.fn();
  res.getHeader = vi.fn();
  return res;
}

/**
 * Simulate a request lifecycle: call the middleware, then emit 'finish' on the response,
 * and flush the microtask queue so the async audit logging completes.
 */
async function simulateRequest(
  req: Request,
  res: MockRes,
  statusCode?: number,
): Promise<void> {
  const next: NextFunction = vi.fn();

  auditLogMiddleware(req, res as unknown as Response, next);
  expect(next).toHaveBeenCalled();

  if (statusCode != null) {
    res.statusCode = statusCode;
  }

  // Emit 'finish' to trigger the audit log callback
  res.emit('finish');

  // Flush microtask queue (resolveUserId is async)
  await new Promise<void>((resolve) => setTimeout(resolve, 50));
}

function getLastAuditEntry(): AuditEntry | undefined {
  for (const method of [logger.error, logger.warn, logger.info] as Array<ReturnType<typeof vi.fn>>) {
    const calls = method.mock.calls;
    for (let i = calls.length - 1; i >= 0; i--) {
      const data = calls[i][1] as Record<string, unknown> | undefined;
      if (data?.audit) {
        return data.audit as AuditEntry;
      }
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('auditLogMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('audit entry fields', () => {
    it('should include all required AuditEntry fields', async () => {
      const req = createMockReq({ path: '/api/projects/42/nodes' });
      const res = createMockRes(200);

      await simulateRequest(req, res);
      const entry = getLastAuditEntry();

      expect(entry).toBeDefined();
      expect(entry).toHaveProperty('timestamp');
      expect(entry).toHaveProperty('requestId');
      expect(entry).toHaveProperty('method');
      expect(entry).toHaveProperty('path');
      expect(entry).toHaveProperty('normalizedPath');
      expect(entry).toHaveProperty('statusCode');
      expect(entry).toHaveProperty('durationMs');
      expect(entry).toHaveProperty('userId');
      expect(entry).toHaveProperty('ip');
      expect(entry).toHaveProperty('userAgent');
      expect(entry).toHaveProperty('contentLength');
      expect(entry).toHaveProperty('responseSize');
    });

    it('should record the correct HTTP method and path', async () => {
      const req = createMockReq({ method: 'POST', path: '/api/projects/1/bom' });
      const res = createMockRes(201);

      await simulateRequest(req, res);
      const entry = getLastAuditEntry();

      expect(entry).toBeDefined();
      expect(entry!.method).toBe('POST');
      expect(entry!.path).toBe('/api/projects/1/bom');
    });

    it('should capture the user agent', async () => {
      const req = createMockReq({
        path: '/api/projects/42/nodes',
        headers: { 'user-agent': 'TestBrowser/2.0' },
      });
      const res = createMockRes(200);

      await simulateRequest(req, res);
      const entry = getLastAuditEntry();

      expect(entry).toBeDefined();
      expect(entry!.userAgent).toBe('TestBrowser/2.0');
    });

    it('should capture content-length when present', async () => {
      const req = createMockReq({
        method: 'POST',
        path: '/api/projects/1/bom',
        headers: { 'user-agent': 'test/1.0', 'content-length': '256' },
      });
      const res = createMockRes(201);

      await simulateRequest(req, res);
      const entry = getLastAuditEntry();

      expect(entry).toBeDefined();
      expect(entry!.contentLength).toBe(256);
    });

    it('should have null contentLength when header is absent', async () => {
      const req = createMockReq({ path: '/api/projects/42/nodes' });
      const res = createMockRes(200);

      await simulateRequest(req, res);
      const entry = getLastAuditEntry();

      expect(entry).toBeDefined();
      expect(entry!.contentLength).toBeNull();
    });

    it('should record durationMs as a non-negative number', async () => {
      const req = createMockReq({ path: '/api/projects/42/nodes' });
      const res = createMockRes(200);

      await simulateRequest(req, res);
      const entry = getLastAuditEntry();

      expect(entry).toBeDefined();
      expect(entry!.durationMs).toBeTypeOf('number');
      expect(entry!.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should have a valid ISO timestamp', async () => {
      const req = createMockReq({ path: '/api/projects/42/nodes' });
      const res = createMockRes(200);

      await simulateRequest(req, res);
      const entry = getLastAuditEntry();

      expect(entry).toBeDefined();
      const parsed = new Date(entry!.timestamp);
      expect(parsed.toISOString()).toBe(entry!.timestamp);
    });

    it('should set userId to null when no session header is provided', async () => {
      const req = createMockReq({ path: '/api/projects/42/nodes' });
      const res = createMockRes(200);

      await simulateRequest(req, res);
      const entry = getLastAuditEntry();

      expect(entry).toBeDefined();
      expect(entry!.userId).toBeNull();
    });

    it('should use req.userId when already set by auth middleware', async () => {
      const req = createMockReq({ path: '/api/projects/42/nodes', userId: 7 });
      const res = createMockRes(200);

      await simulateRequest(req, res);
      const entry = getLastAuditEntry();

      expect(entry).toBeDefined();
      expect(entry!.userId).toBe(7);
    });

    it('should capture the client IP address', async () => {
      const req = createMockReq({ path: '/api/projects/1/nodes', ip: '192.168.1.100' });
      const res = createMockRes(200);

      await simulateRequest(req, res);
      const entry = getLastAuditEntry();

      expect(entry).toBeDefined();
      expect(entry!.ip).toBe('192.168.1.100');
    });

    it('should record the status code from the response', async () => {
      const req = createMockReq({ path: '/api/projects/1/nodes' });
      const res = createMockRes(200);

      await simulateRequest(req, res, 204);
      const entry = getLastAuditEntry();

      expect(entry).toBeDefined();
      expect(entry!.statusCode).toBe(204);
    });
  });

  describe('path normalization', () => {
    it('should normalize numeric project IDs in paths', async () => {
      const req = createMockReq({ path: '/api/projects/42/nodes' });
      const res = createMockRes(200);

      await simulateRequest(req, res);
      const entry = getLastAuditEntry();

      expect(entry).toBeDefined();
      expect(entry!.normalizedPath).toBe('/api/projects/:id/nodes');
    });

    it('should preserve the original path alongside the normalized path', async () => {
      const req = createMockReq({ path: '/api/projects/42/nodes' });
      const res = createMockRes(200);

      await simulateRequest(req, res);
      const entry = getLastAuditEntry();

      expect(entry).toBeDefined();
      expect(entry!.path).toBe('/api/projects/42/nodes');
      expect(entry!.normalizedPath).toBe('/api/projects/:id/nodes');
    });

    it('should normalize nested resource paths', async () => {
      const req = createMockReq({ path: '/api/projects/5/bom/99' });
      const res = createMockRes(200);

      await simulateRequest(req, res);
      const entry = getLastAuditEntry();

      expect(entry).toBeDefined();
      expect(entry!.normalizedPath).toBe('/api/projects/:id/bom/:bomId');
    });

    it('should normalize circuit paths', async () => {
      const req = createMockReq({ path: '/api/circuits/3/instances/7' });
      const res = createMockRes(200);

      await simulateRequest(req, res);
      const entry = getLastAuditEntry();

      expect(entry).toBeDefined();
      expect(entry!.normalizedPath).toBe('/api/circuits/:circuitId/instances/:id');
    });
  });

  describe('request ID', () => {
    it('should set X-Request-Id response header', async () => {
      const req = createMockReq({ path: '/api/projects/42/nodes', id: 'my-req-123' });
      const res = createMockRes(200);

      const next: NextFunction = vi.fn();
      auditLogMiddleware(req, res as unknown as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', 'my-req-123');
    });

    it('should use the existing request ID if already set on req.id', async () => {
      const req = createMockReq({ path: '/api/projects/42/nodes', id: 'pre-existing-id' });
      const res = createMockRes(200);

      await simulateRequest(req, res);
      const entry = getLastAuditEntry();

      expect(entry).toBeDefined();
      expect(entry!.requestId).toBe('pre-existing-id');
    });

    it('should generate a request ID when req.id is not set', async () => {
      const req = createMockReq({ path: '/api/projects/42/nodes' });
      // Clear the pre-set id
      (req as unknown as Record<string, unknown>).id = '';
      const res = createMockRes(200);

      await simulateRequest(req, res);
      const entry = getLastAuditEntry();

      expect(entry).toBeDefined();
      expect(entry!.requestId).toBeTruthy();
      expect(entry!.requestId.length).toBeGreaterThan(0);
    });

    it('should include the request ID in the audit entry', async () => {
      const req = createMockReq({ path: '/api/projects/42/nodes', id: 'audit-id-456' });
      const res = createMockRes(200);

      await simulateRequest(req, res);
      const entry = getLastAuditEntry();

      expect(entry).toBeDefined();
      expect(entry!.requestId).toBe('audit-id-456');
    });
  });

  describe('exclusion rules', () => {
    it('should not log health check requests', async () => {
      const req = createMockReq({ path: '/api/health' });
      const res = createMockRes(200);
      const next: NextFunction = vi.fn();

      auditLogMiddleware(req, res as unknown as Response, next);
      expect(next).toHaveBeenCalled();

      res.emit('finish');
      await new Promise<void>((resolve) => setTimeout(resolve, 50));

      const entry = getLastAuditEntry();
      expect(entry).toBeUndefined();
    });

    it('should not log readiness probe requests', async () => {
      const req = createMockReq({ path: '/api/ready' });
      const res = createMockRes(200);
      const next: NextFunction = vi.fn();

      auditLogMiddleware(req, res as unknown as Response, next);
      expect(next).toHaveBeenCalled();

      res.emit('finish');
      await new Promise<void>((resolve) => setTimeout(resolve, 50));

      const entry = getLastAuditEntry();
      expect(entry).toBeUndefined();
    });

    it('should not log static asset requests', async () => {
      const req = createMockReq({ path: '/assets/logo.svg' });
      const res = createMockRes(200);
      const next: NextFunction = vi.fn();

      auditLogMiddleware(req, res as unknown as Response, next);
      expect(next).toHaveBeenCalled();

      res.emit('finish');
      await new Promise<void>((resolve) => setTimeout(resolve, 50));

      const entry = getLastAuditEntry();
      expect(entry).toBeUndefined();
    });

    it('should not log favicon requests', async () => {
      const req = createMockReq({ path: '/favicon.ico' });
      const res = createMockRes(200);
      const next: NextFunction = vi.fn();

      auditLogMiddleware(req, res as unknown as Response, next);
      expect(next).toHaveBeenCalled();

      res.emit('finish');
      await new Promise<void>((resolve) => setTimeout(resolve, 50));

      const entry = getLastAuditEntry();
      expect(entry).toBeUndefined();
    });

    it('should not log Vite HMR requests', async () => {
      const req = createMockReq({ path: '/_vite/client.js' });
      const res = createMockRes(200);
      const next: NextFunction = vi.fn();

      auditLogMiddleware(req, res as unknown as Response, next);
      expect(next).toHaveBeenCalled();

      res.emit('finish');
      await new Promise<void>((resolve) => setTimeout(resolve, 50));

      const entry = getLastAuditEntry();
      expect(entry).toBeUndefined();
    });

    it('should log normal API requests', async () => {
      const req = createMockReq({ path: '/api/projects/42/nodes' });
      const res = createMockRes(200);

      await simulateRequest(req, res);
      const entry = getLastAuditEntry();

      expect(entry).toBeDefined();
    });

    it('should always call next() even for excluded paths', async () => {
      const req = createMockReq({ path: '/api/health' });
      const res = createMockRes(200);
      const next: NextFunction = vi.fn();

      auditLogMiddleware(req, res as unknown as Response, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('log levels', () => {
    it('should log 2xx responses at info level', async () => {
      const req = createMockReq({ path: '/api/projects/42/nodes' });
      const res = createMockRes(200);

      await simulateRequest(req, res);

      const infoCalls = (logger.info as ReturnType<typeof vi.fn>).mock.calls;
      const hasAudit = infoCalls.some(
        (call) => (call[1] as Record<string, unknown> | undefined)?.audit != null,
      );
      expect(hasAudit).toBe(true);
    });

    it('should log 3xx responses at info level', async () => {
      const req = createMockReq({ path: '/api/projects/42/nodes' });
      const res = createMockRes(200);

      await simulateRequest(req, res, 301);

      const infoCalls = (logger.info as ReturnType<typeof vi.fn>).mock.calls;
      const hasAudit = infoCalls.some((call) => {
        const data = call[1] as Record<string, unknown> | undefined;
        const audit = data?.audit as AuditEntry | undefined;
        return audit?.statusCode === 301;
      });
      expect(hasAudit).toBe(true);
    });

    it('should log 4xx responses at warn level', async () => {
      const req = createMockReq({ path: '/api/projects/42/nodes' });
      const res = createMockRes(200);

      await simulateRequest(req, res, 404);

      const warnCalls = (logger.warn as ReturnType<typeof vi.fn>).mock.calls;
      const hasAudit = warnCalls.some(
        (call) => (call[1] as Record<string, unknown> | undefined)?.audit != null,
      );
      expect(hasAudit).toBe(true);
    });

    it('should log 5xx responses at error level', async () => {
      const req = createMockReq({ path: '/api/projects/42/nodes' });
      const res = createMockRes(200);

      await simulateRequest(req, res, 500);

      const errorCalls = (logger.error as ReturnType<typeof vi.fn>).mock.calls;
      const hasAudit = errorCalls.some(
        (call) => (call[1] as Record<string, unknown> | undefined)?.audit != null,
      );
      expect(hasAudit).toBe(true);
    });

    it('should log 400 at warn level, not info or error', async () => {
      const req = createMockReq({ path: '/api/projects/42/nodes' });
      const res = createMockRes(200);

      await simulateRequest(req, res, 400);

      // Should be in warn
      const warnCalls = (logger.warn as ReturnType<typeof vi.fn>).mock.calls;
      const inWarn = warnCalls.some((call) => {
        const audit = (call[1] as Record<string, unknown> | undefined)?.audit as AuditEntry | undefined;
        return audit?.statusCode === 400;
      });
      expect(inWarn).toBe(true);

      // Should NOT be in info
      const infoCalls = (logger.info as ReturnType<typeof vi.fn>).mock.calls;
      const inInfo = infoCalls.some((call) => {
        const audit = (call[1] as Record<string, unknown> | undefined)?.audit as AuditEntry | undefined;
        return audit?.statusCode === 400;
      });
      expect(inInfo).toBe(false);

      // Should NOT be in error
      const errorCalls = (logger.error as ReturnType<typeof vi.fn>).mock.calls;
      const inError = errorCalls.some((call) => {
        const audit = (call[1] as Record<string, unknown> | undefined)?.audit as AuditEntry | undefined;
        return audit?.statusCode === 400;
      });
      expect(inError).toBe(false);
    });

    it('should log 503 at error level', async () => {
      const req = createMockReq({ path: '/api/projects/42/nodes' });
      const res = createMockRes(200);

      await simulateRequest(req, res, 503);

      const errorCalls = (logger.error as ReturnType<typeof vi.fn>).mock.calls;
      const hasAudit = errorCalls.some((call) => {
        const audit = (call[1] as Record<string, unknown> | undefined)?.audit as AuditEntry | undefined;
        return audit?.statusCode === 503;
      });
      expect(hasAudit).toBe(true);
    });
  });

  describe('log message format', () => {
    it('should format the log message as METHOD normalizedPath statusCode durationMs', async () => {
      const req = createMockReq({ path: '/api/projects/42/nodes' });
      const res = createMockRes(200);

      await simulateRequest(req, res);

      const infoCalls = (logger.info as ReturnType<typeof vi.fn>).mock.calls;
      const auditCall = infoCalls.find(
        (call) => (call[1] as Record<string, unknown> | undefined)?.audit != null,
      );

      expect(auditCall).toBeDefined();
      const msg = auditCall![0] as string;
      expect(msg).toMatch(/^GET \/api\/projects\/:id\/nodes 200 \d+ms$/);
    });
  });
});
