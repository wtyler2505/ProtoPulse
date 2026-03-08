import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { validateEnv } from "./env";
import crypto from "crypto";
import { logger } from "./logger";
import { recordRequest, getMetrics, startMetricsCollection } from "./metrics";
import { apiDocs } from "./api-docs";
import { validateSession } from "./auth";
import { auditLogMiddleware } from "./audit-log";
import { attachCollaborationServer } from "./collaboration";
import { registerCollaborationServer } from "./shutdown";

declare global {
  namespace Express {
    interface Request {
      id: string;
      userId?: number;
    }
    interface Locals {
      cspNonce: string;
    }
  }
}

validateEnv();

const app = express();

// Replit runs behind one reverse proxy, so trust exactly 1 hop.
// Adjust this value if deploying behind additional proxies (e.g., Cloudflare + load balancer = 2).
app.set("trust proxy", 1);

const isDev = process.env.NODE_ENV !== "production";

if (isDev && process.env.UNSAFE_DEV_BYPASS_AUTH === '1') {
  logger.warn('Auth bypass ENABLED — requests without X-Session-Id will pass through. Do NOT use in production.');
}

// Generate a unique CSP nonce per request for inline style/script control.
// Stored on res.locals so helmet's CSP directive functions can reference it.
app.use((_req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});

app.use(helmet({
  contentSecurityPolicy: {
    // BL-0266: CSP enabled in all environments for dev/prod parity.
    // In dev mode, reportOnly logs violations to console without blocking resources.
    reportOnly: isDev,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
      // CSP Level 3 granular style directives:
      // - style-src-elem: nonce-based for <style> elements (blocks injected <style> without nonce)
      // - style-src-attr: 'unsafe-inline' for inline style="" attributes (required by Radix UI
      //   for positioning popovers, tooltips, and other floating elements)
      // - style-src: 'unsafe-inline' fallback for browsers that don't support Level 3 granular
      //   directives — they fall back to style-src which permits inline styles.
      //   Browsers that DO support style-src-elem/style-src-attr ignore style-src for those cases.
      'style-src': ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      'style-src-elem': [
        "'self'",
        "https://fonts.googleapis.com",
        // Helmet types res as http.ServerResponse but Express passes its Response with locals.
        // Cast through Express.Locals so a cspNonce rename triggers a compile error here too.
        (_req: IncomingMessage, res: ServerResponse) => {
          const locals = (res as unknown as { locals: Express.Locals }).locals;
          return `'nonce-${locals.cspNonce}'`;
        },
      ],
      'style-src-attr': ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: isDev
        ? ["'self'", "ws://localhost:*", "ws://127.0.0.1:*", "http://localhost:*"]
        : ["'self'"],
      frameSrc: ["'none'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  strictTransportSecurity: {
    maxAge: 63072000,
    includeSubDomains: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

app.use(compression());

// CORS allowlist — unified for dev and production.
// In dev: always allow common localhost origins.
// In production: only origins explicitly listed in CORS_ALLOWED_ORIGINS env var (comma-separated).
// If no env var is set in production, no Access-Control-Allow-Origin header is sent (same-origin only).
const DEV_ORIGINS = [
  'http://localhost:5000',
  'http://localhost:3000',
  'http://127.0.0.1:5000',
];

const CORS_ALLOWED_ORIGINS: Set<string> = new Set(
  isDev
    ? DEV_ORIGINS.concat(
        (process.env.CORS_ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean),
      )
    : (process.env.CORS_ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean),
);

app.use((req, res, next) => {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
  if (origin && CORS_ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  if (CORS_ALLOWED_ORIGINS.size > 0) {
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Session-Id,If-Match');
    res.setHeader('Access-Control-Expose-Headers', 'X-Request-Id,ETag');
  }
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

app.use((req, _res, next) => {
  req.id = crypto.randomUUID();
  next();
});

app.use((_req, res, next) => {
  const reqId = (_req as Request).id;
  if (reqId) {
    res.setHeader("X-Request-Id", reqId);
  }
  next();
});

// Rate limit API requests to prevent brute-force attacks and abuse【697222849486831†L78-L93】.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/chat/ai/stream',
});
app.use("/api", apiLimiter);

app.use('/api', (req, res, next) => {
  res.setHeader('X-API-Version', '1');
  next();
});
const httpServer = createServer(app);

app.use(express.json({ limit: "1mb" }));

app.use(express.urlencoded({ extended: false, limit: "1mb" }));

app.use(express.raw({ limit: "5mb", type: ['application/octet-stream', 'application/zip', 'application/x-zip-compressed'] }));
app.use(express.text({ limit: "2mb", type: ['text/xml', 'application/xml', 'image/svg+xml', 'text/plain'] }));

app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/api/chat/ai/stream') return next();

  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return next();

  const host = req.get("x-forwarded-host") || req.get("host");
  const origin = req.get("origin");
  const referer = req.get("referer");

  const originHost = origin
    ? (() => { try { return new URL(origin).host; } catch { return null; } })()
    : referer
      ? (() => { try { return new URL(referer).host; } catch { return null; } })()
      : null;

  if (!originHost) {
    if (isDev) return next();
    return res.status(403).json({ message: "Forbidden: missing Origin header" });
  }

  if (originHost !== host) {
    return res.status(403).json({ message: "Forbidden: origin mismatch" });
  }

  next();
});

app.use((req, res, next) => {
  if (req.path === '/api/chat/ai/stream') return next();
  req.setTimeout(30000, () => {
    if (!res.headersSent) {
      res.status(408).json({ message: "Request timeout" });
    }
  });
  next();
});

const PUBLIC_PATHS = ['/api/auth/', '/api/health', '/api/ready', '/api/docs', '/api/metrics', '/api/settings/chat'];

app.use('/api', (req, res, next) => {
  if (PUBLIC_PATHS.some(p => req.path.startsWith(p.replace('/api', '')))) {
    return next();
  }

  const sessionId = req.headers['x-session-id'] as string;
  const devAuthBypass = isDev && process.env.UNSAFE_DEV_BYPASS_AUTH === '1';
  if (!sessionId) {
    if (devAuthBypass) {
      return next();
    }
    return res.status(401).json({ message: 'Authentication required' });
  }

  validateSession(sessionId).then(session => {
    if (!session) {
      if (devAuthBypass) {
        return next();
      }
      return res.status(401).json({ message: 'Invalid or expired session' });
    }
    req.userId = session.userId;
    next();
  }).catch(next);
});

// Structured audit logging — captures full request context for audit trail
app.use(auditLogMiddleware);

export function log(message: string, source = "express") {
  logger.info(message, { source });
}

const SENSITIVE_KEY_PATTERN = /^(sessionid|token|encryptedkey|apikey|passwordhash|password|secret|key)$/i;

function redactSensitive(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(redactSensitive);
  }
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(k)) {
        result[k] = '[REDACTED]';
      } else {
        result[k] = redactSensitive(v);
      }
    }
    return result;
  }
  return obj;
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  const requestId = req.id;
  let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson as Record<string, unknown>;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (requestId) {
        logLine += ` [${requestId}]`;
      }
      if (capturedJsonResponse) {
        const redacted = redactSensitive(capturedJsonResponse);
        const body = JSON.stringify(redacted);
        logLine += ` :: ${body.length > 500 ? body.slice(0, 500) + '...[truncated]' : body}`;
      }

      log(logLine);
      recordRequest(req.method, path, res.statusCode, duration);
    }
  });

  next();
});

(async () => {
  const { checkConnection } = await import("./db");
  await checkConnection();

  await registerRoutes(app);

  // Auto-seed standard component library on first run
  try {
    const { componentLibrary } = await import('@shared/schema');
    const { eq, count: countFn } = await import('drizzle-orm');
    const { db: database } = await import('./db');
    const [result] = await database.select({ cnt: countFn() }).from(componentLibrary).where(eq(componentLibrary.isPublic, true));
    if (result.cnt === 0) {
      const { seedStandardLibrary } = await import('./routes/seed');
      const seeded = await seedStandardLibrary();
      logger.info(`Standard component library seeded: ${seeded.inserted} inserted, ${seeded.updated} updated, ${seeded.unchanged} unchanged`);
    }
  } catch (err) {
    logger.warn('Failed to auto-seed standard library', { error: err instanceof Error ? err.message : String(err) });
  }

  app.get("/api/health", async (_req, res) => {
    try {
      const { pool } = await import("./db");
      const client = await pool.connect();
      client.release();
      res.json({ status: "ok", timestamp: new Date().toISOString() });
    } catch (err) {
      res.status(503).json({ status: "unhealthy", timestamp: new Date().toISOString() });
    }
  });

  app.get("/api/ready", async (_req, res) => {
    const dependencies: Record<string, { status: "up" | "down"; latencyMs?: number }> = {};
    let overallStatus: "ready" | "degraded" | "unavailable" = "ready";

    // Check database connectivity
    const dbStart = Date.now();
    try {
      const { pool } = await import("./db");
      const client = await pool.connect();
      client.release();
      dependencies.database = { status: "up", latencyMs: Date.now() - dbStart };
    } catch {
      dependencies.database = { status: "down", latencyMs: Date.now() - dbStart };
      overallStatus = "unavailable";
    }

    // Check cache health (always up — in-memory)
    dependencies.cache = { status: "up" };

    // Check AI provider availability (key configured, not whether API is reachable)
    const anthropicConfigured = Boolean(process.env.ANTHROPIC_API_KEY);
    const geminiConfigured = Boolean(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);
    dependencies.ai_anthropic = { status: anthropicConfigured ? "up" : "down" };
    dependencies.ai_gemini = { status: geminiConfigured ? "up" : "down" };

    if (!anthropicConfigured && !geminiConfigured) {
      if (overallStatus === "ready") {
        overallStatus = "degraded";
      }
    }

    const statusCode = overallStatus === "unavailable" ? 503 : overallStatus === "degraded" ? 200 : 200;
    res.status(statusCode).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      dependencies,
    });
  });

  app.get("/api/metrics", (_req, res) => {
    if (process.env.NODE_ENV === 'production' && process.env.EXPOSE_DEBUG_ENDPOINTS !== '1') {
      return res.status(404).json({ message: 'Not found' });
    }
    res.json(getMetrics());
  });

  app.get("/api/docs", (_req, res) => {
    if (process.env.NODE_ENV === 'production' && process.env.EXPOSE_DEBUG_ENDPOINTS !== '1') {
      return res.status(404).json({ message: 'Not found' });
    }
    res.json({ version: 1, routes: apiDocs });
  });

  // BL-0010: Catch-all for unmatched /api/* routes — return JSON 404 instead of
  // falling through to the SPA catch-all which would return HTML (index.html)
  app.all('/api/{*path}', (_req: Request, res: Response) => {
    res.status(404).json({ message: 'API endpoint not found' });
  });

  app.use((err: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      return next(err);
    }

    const status = err.status ?? err.statusCode ?? 500;
    logger.error("Server error", { stack: err.stack, status });

    let clientMessage: string;
    if (status < 500) {
      clientMessage = err.message || "Bad request";
    } else {
      clientMessage = "Internal server error";
    }

    return res.status(status).json({ message: clientMessage });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      startMetricsCollection();

      // BL-0039: Wire WebSocket collaboration to the HTTP server
      if (process.env.DISABLE_COLLABORATION !== '1') {
        const collabServer = attachCollaborationServer(httpServer);
        registerCollaborationServer(collabServer);
      }
    },
  );

  const { performGracefulShutdown } = await import('./shutdown');

  process.on("SIGTERM", () => performGracefulShutdown(httpServer, "SIGTERM"));
  process.on("SIGINT", () => performGracefulShutdown(httpServer, "SIGINT"));

  process.on('uncaughtException', (err: Error) => {
    logger.error('Uncaught exception', { message: err.message, stack: err.stack });
    performGracefulShutdown(httpServer, 'uncaughtException');
  });

  process.on('unhandledRejection', (reason: unknown) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    logger.error('Unhandled rejection', { message, stack });
    performGracefulShutdown(httpServer, 'unhandledRejection');
  });
})();
