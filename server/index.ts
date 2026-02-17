import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { validateEnv } from "./env";
import crypto from "crypto";

declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

validateEnv();

const app = express();

// Replit runs behind one reverse proxy, so trust exactly 1 hop.
// Adjust this value if deploying behind additional proxies (e.g., Cloudflare + load balancer = 2).
app.set("trust proxy", 1);

const isDev = process.env.NODE_ENV !== "production";
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: isDev ? ["'self'", "ws:", "wss:"] : ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(compression());

if (isDev) {
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });
}

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

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  const requestId = req.id;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
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
        const body = JSON.stringify(capturedJsonResponse);
        logLine += ` :: ${body.length > 500 ? body.slice(0, 500) + '...[truncated]' : body}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const { checkConnection } = await import("./db");
  await checkConnection();

  await registerRoutes(app);

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

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      return next(err);
    }

    const status = err.status || err.statusCode || 500;
    console.error("Server error:", err.stack || err);

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
    },
  );

  function gracefulShutdown(signal: string) {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    httpServer.close(async () => {
      try {
        const { pool } = await import("./db");
        await pool.end();
        console.log("Database pool closed.");
      } catch (err) {
        console.error("Error closing database pool:", err);
      }
      process.exit(0);
    });
    setTimeout(() => {
      console.error("Forced shutdown after timeout.");
      process.exit(1);
    }, 10000);
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
})();
