import type { Express, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { storage } from '../storage';
import { insertChatMessageSchema } from '@shared/schema';
import { processAIMessage, streamAIMessage, categorizeError, routeToModel } from '../ai';
import { getApiKey, validateSession } from '../auth';
import { asyncHandler, payloadLimit, parseIdParam, paginationSchema, HttpError } from './utils';
import { requireProjectOwnership } from './auth-middleware';
import { buildSimulationContext } from '../lib/simulation-context';

const MAX_CHAT_HISTORY = 10;

// ---------------------------------------------------------------------------
// CAPX-REL-02: Stream-specific abuse protections
// ---------------------------------------------------------------------------

/** Tracks active stream sessions to enforce 1-concurrent-stream-per-session */
const activeStreams = new Set<string>();

/** Per-IP sliding window rate limiter for stream requests */
const STREAM_RATE_WINDOW_MS = 60_000;
const STREAM_RATE_MAX = 20;

interface RateBucket {
  timestamps: number[];
}

const streamRateBuckets = new Map<string, RateBucket>();

/** Periodically prune stale rate-limit buckets (every 2 minutes) */
const RATE_PRUNE_INTERVAL_MS = 120_000;
setInterval(() => {
  const cutoff = Date.now() - STREAM_RATE_WINDOW_MS;
  streamRateBuckets.forEach((bucket, ip) => {
    bucket.timestamps = bucket.timestamps.filter((t: number) => t > cutoff);
    if (bucket.timestamps.length === 0) {
      streamRateBuckets.delete(ip);
    }
  });
}, RATE_PRUNE_INTERVAL_MS).unref();

/** Absolute maximum stream duration (5 minutes) — hard kill regardless of activity */
const ABSOLUTE_STREAM_TIMEOUT_MS = 300_000;

/** Maximum message content size for stream requests (32 KB) */
const STREAM_MESSAGE_MAX_BYTES = 32 * 1024;

/**
 * Middleware: enforce per-session concurrency (max 1 active stream per session).
 * Requires the session auth middleware to have already set X-Session-Id.
 */
function streamConcurrencyGuard(req: Request, res: Response, next: NextFunction): void {
  const sessionId = req.headers['x-session-id'] as string | undefined;
  if (!sessionId) {
    // Auth middleware will reject unauthenticated requests — but guard defensively
    res.status(401).json({ message: 'Authentication required' });
    return;
  }
  if (activeStreams.has(sessionId)) {
    res.status(429).json({ message: 'A stream is already active for this session' });
    return;
  }
  next();
}

/**
 * Middleware: per-IP sliding-window rate limiter for stream requests.
 * Max `STREAM_RATE_MAX` requests per `STREAM_RATE_WINDOW_MS` per IP.
 */
function streamRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  const now = Date.now();
  const cutoff = now - STREAM_RATE_WINDOW_MS;

  let bucket = streamRateBuckets.get(ip);
  if (!bucket) {
    bucket = { timestamps: [] };
    streamRateBuckets.set(ip, bucket);
  }

  // Prune expired timestamps from this bucket
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= STREAM_RATE_MAX) {
    const oldestInWindow = bucket.timestamps[0];
    const retryAfterSec = Math.ceil((oldestInWindow + STREAM_RATE_WINDOW_MS - now) / 1000);
    res.setHeader('Retry-After', String(retryAfterSec));
    res.status(429).json({ message: `Rate limit exceeded. Max ${STREAM_RATE_MAX} stream requests per minute.` });
    return;
  }

  bucket.timestamps.push(now);
  next();
}

/**
 * Middleware: validate that the request body message content is within the 32 KB limit.
 * This runs AFTER body parsing but BEFORE the main handler.
 */
function streamBodySizeGuard(req: Request, res: Response, next: NextFunction): void {
  const body = req.body as Record<string, unknown> | undefined;
  if (body && typeof body.message === 'string') {
    const byteLength = Buffer.byteLength(body.message, 'utf8');
    if (byteLength > STREAM_MESSAGE_MAX_BYTES) {
      res.status(413).json({
        message: `Message content too large. Maximum size is ${STREAM_MESSAGE_MAX_BYTES / 1024}KB.`,
      });
      return;
    }
  }
  next();
}

/**
 * Middleware: origin validation for the stream endpoint.
 * In production, requires Origin or Referer to match the Host header.
 * In development, allows requests without origin headers.
 */
function streamOriginGuard(req: Request, res: Response, next: NextFunction): void {
  const isDev = process.env.NODE_ENV !== 'production';
  const host = req.get('x-forwarded-host') ?? req.get('host');
  const origin = req.get('origin');
  const referer = req.get('referer');

  const originHost = origin
    ? (() => {
        try {
          return new URL(origin).host;
        } catch {
          return null;
        }
      })()
    : referer
      ? (() => {
          try {
            return new URL(referer).host;
          } catch {
            return null;
          }
        })()
      : null;

  if (!originHost) {
    // In dev, allow requests without origin (e.g. from curl, Postman)
    if (isDev) {
      next();
      return;
    }
    res.status(403).json({ message: 'Forbidden: missing Origin header' });
    return;
  }

  if (originHost !== host) {
    res.status(403).json({ message: 'Forbidden: origin mismatch' });
    return;
  }

  next();
}

// Export internals for testing
export const _streamInternals = {
  activeStreams,
  streamRateBuckets,
  STREAM_RATE_WINDOW_MS,
  STREAM_RATE_MAX,
  ABSOLUTE_STREAM_TIMEOUT_MS,
  STREAM_MESSAGE_MAX_BYTES,
};

const aiRequestSchema = z.object({
  message: z.string().min(1).max(32000),
  provider: z.enum(['anthropic', 'gemini']),
  model: z.string().min(1).max(200),
  apiKey: z.string().max(500).optional().default(''),
  projectId: z.number(),
  activeView: z.string().optional(),
  schematicSheets: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
  activeSheetId: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(256).max(16384).optional(),
  customSystemPrompt: z.string().max(10000).optional(),
  selectedNodeId: z.string().nullable().optional(),
  changeDiff: z.string().max(50000).optional(),
  routingStrategy: z.enum(['user', 'auto', 'quality', 'speed', 'cost']).optional(),
  confirmed: z.boolean().optional(),
  // Phase 4: Vision/multimodal — optional image attachment
  imageBase64: z.string().max(10_000_000).optional(),
  imageMimeType: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp']).optional(),
});

async function buildAppStateFromProject(
  projectId: number,
  options: {
    activeView?: string;
    schematicSheets?: Array<{ id: string; name: string }>;
    activeSheetId?: string;
    selectedNodeId?: string | null;
    customSystemPrompt?: string;
    changeDiff?: string;
  },
) {
  const [nodes, edges, bomData, validation, chatHistory, project, parts, circuits, history, preferences] = await Promise.all([
    storage.getNodes(projectId),
    storage.getEdges(projectId),
    storage.getBomItems(projectId),
    storage.getValidationIssues(projectId),
    storage.getChatMessages(projectId),
    storage.getProject(projectId),
    storage.getComponentParts(projectId),
    storage.getCircuitDesigns(projectId),
    storage.getHistoryItems(projectId, { limit: 20, offset: 0, sort: 'desc' }),
    storage.getDesignPreferences(projectId),
  ]);

  // Fetch instance/net counts and simulation results for all circuits in parallel (avoids sequential N+1)
  const circuitIds = circuits.map((c) => c.id);
  const [allInstances, allNets, allSimResults] = await Promise.all([
    Promise.all(circuitIds.map((id) => storage.getCircuitInstances(id))),
    Promise.all(circuitIds.map((id) => storage.getCircuitNets(id))),
    Promise.all(circuitIds.map((id) => storage.getSimulationResults(id))),
  ]);
  const circuitDesigns = circuits.map((c, i) => ({
    id: c.id,
    name: c.name,
    description: c.description || undefined,
    instanceCount: allInstances[i].length,
    netCount: allNets[i].length,
  }));

  // BOM metadata aggregation
  const totalCost = bomData.reduce((sum, b) => sum + b.quantity * Number(b.unitPrice), 0);
  const outOfStockCount = bomData.filter((b) => b.status === 'Out of Stock').length;
  const lowStockCount = bomData.filter((b) => b.status === 'Low Stock').length;

  return {
    projectName: project?.name || 'Untitled',
    projectDescription: project?.description || '',
    activeView: options.activeView || 'architecture',
    selectedNodeId: options.selectedNodeId || null,
    nodes: nodes.map((n) => ({
      id: n.nodeId,
      label: n.label,
      type: n.nodeType,
      description: (n.data as Record<string, unknown> | null)?.description as string | undefined,
      positionX: n.positionX,
      positionY: n.positionY,
    })),
    edges: edges.map((e) => ({
      id: e.edgeId,
      source: e.source,
      target: e.target,
      label: e.label || undefined,
      signalType: e.signalType || undefined,
      voltage: e.voltage || undefined,
      busWidth: e.busWidth || undefined,
      netName: e.netName || undefined,
    })),
    bom: bomData.map((b) => ({
      id: String(b.id),
      partNumber: b.partNumber,
      manufacturer: b.manufacturer,
      description: b.description,
      quantity: b.quantity,
      unitPrice: Number(b.unitPrice),
      supplier: b.supplier,
      status: b.status,
    })),
    validationIssues: validation.map((v) => ({
      id: String(v.id),
      severity: v.severity,
      message: v.message,
      componentId: v.componentId || undefined,
      suggestion: v.suggestion || undefined,
    })),
    schematicSheets: options.schematicSheets || [],
    activeSheetId: options.activeSheetId || 'top',
    chatHistory: chatHistory
      .slice(0, MAX_CHAT_HISTORY)
      .reverse()
      .map((m) => ({
        role: m.role,
        content: m.content,
      })),
    customSystemPrompt: options.customSystemPrompt || '',
    changeDiff: options.changeDiff || '',
    // Phase 2: expanded context
    componentParts: parts.map((p) => {
      const meta = (p.meta ?? {}) as Record<string, unknown>;
      const connectors = (p.connectors ?? []) as unknown[];
      return {
        id: p.id,
        nodeId: p.nodeId || undefined,
        title: (meta.title as string) || undefined,
        family: (meta.family as string) || undefined,
        manufacturer: (meta.manufacturer as string) || undefined,
        mpn: (meta.mpn as string) || undefined,
        category: (meta.category as string) || undefined,
        pinCount: connectors.length,
      };
    }),
    circuitDesigns,
    historyItems: history.map((h) => ({
      action: h.action,
      user: h.user,
      timestamp: h.timestamp.toISOString(),
    })),
    bomMetadata: { totalCost, itemCount: bomData.length, outOfStockCount, lowStockCount },
    designPreferences: preferences.map((p) => ({
      category: p.category,
      key: p.key,
      value: p.value,
      source: p.source,
      confidence: p.confidence,
    })),
    // BL-0576: Simulation results context
    simulationSummary: (() => {
      const summaries: string[] = [];
      for (let i = 0; i < circuits.length; i++) {
        const simCtx = buildSimulationContext(allSimResults[i], circuits[i].name);
        if (simCtx) {
          summaries.push(simCtx);
        }
      }
      return summaries.length > 0 ? summaries.join('\n') : undefined;
    })(),
  };
}

export function registerChatRoutes(app: Express): void {
  // --- Chat Messages CRUD ---

  app.get(
    '/api/projects/:id/chat',
    requireProjectOwnership,
    asyncHandler(async (req, res) => {
      const opts = paginationSchema.safeParse(req.query);
      const pagination = opts.success ? opts.data : { limit: 50, offset: 0, sort: 'asc' as const };
      const branchId = typeof req.query.branchId === 'string' ? req.query.branchId : undefined;
      const messages = await storage.getChatMessages(parseIdParam(req.params.id), { ...pagination, branchId });
      res.json({ data: messages, total: messages.length });
    }),
  );

  app.post(
    '/api/projects/:id/chat',
    requireProjectOwnership,
    payloadLimit(32 * 1024),
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const parsed = insertChatMessageSchema.omit({ projectId: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }
      const msg = await storage.createChatMessage({ ...parsed.data, projectId });
      res.status(201).json(msg);
    }),
  );

  app.delete(
    '/api/projects/:id/chat',
    requireProjectOwnership,
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      await storage.deleteChatMessages(projectId);
      res.status(204).end();
    }),
  );

  app.delete(
    '/api/projects/:id/chat/:msgId',
    requireProjectOwnership,
    asyncHandler(async (req, res) => {
      const projectId = parseIdParam(req.params.id);
      const msgId = parseIdParam(req.params.msgId);
      const deleted = await storage.deleteChatMessage(msgId, projectId);
      if (!deleted) {
        return res.status(404).json({ message: 'Chat message not found' });
      }
      res.status(204).end();
    }),
  );

  // --- AI Chat Endpoint ---

  app.post(
    '/api/chat/ai',
    payloadLimit(10 * 1024 * 1024),
    asyncHandler(async (req, res) => {
      const parsed = aiRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
      }

      // BL-0636: Ownership check — verify session owns the project
      const sessionId = req.headers['x-session-id'] as string | undefined;
      if (sessionId) {
        const session = await validateSession(sessionId);
        if (session) {
          const project = await storage.getProject(parsed.data.projectId);
          if (project && project.ownerId !== null && project.ownerId !== session.userId) {
            return res.status(404).json({ message: 'Project not found' });
          }
        }
      }

      const { message, provider, model, apiKey: clientApiKey, temperature, maxTokens } = parsed.data;
      const pid = parsed.data.projectId;

      const routingStrategy = parsed.data.routingStrategy || 'user';
      let resolvedModel = model;
      if (routingStrategy !== 'user') {
        const routed = routeToModel({
          strategy: routingStrategy,
          provider,
          userModel: model,
          messageLength: message.length,
          hasImage: !!parsed.data.imageBase64,
          appState: { activeView: parsed.data.activeView || 'dashboard', nodes: [], bom: [] },
          message,
        });
        resolvedModel = routed.model;
      }

      let apiKeyToUse = clientApiKey || '';
      if (req.userId) {
        const storedKey = await getApiKey(req.userId, provider);
        if (storedKey) {
          apiKeyToUse = storedKey;
        }
      }

      const appState = await buildAppStateFromProject(pid, {
        activeView: parsed.data.activeView,
        schematicSheets: parsed.data.schematicSheets,
        activeSheetId: parsed.data.activeSheetId,
        selectedNodeId: parsed.data.selectedNodeId,
        customSystemPrompt: parsed.data.customSystemPrompt,
        changeDiff: parsed.data.changeDiff,
      });

      const result = await processAIMessage({
        message,
        provider,
        model: resolvedModel,
        apiKey: apiKeyToUse,
        appState,
        temperature: temperature ?? 0.7,
        maxTokens,
        imageContent: parsed.data.imageBase64
          ? {
              base64: parsed.data.imageBase64,
              mediaType: parsed.data.imageMimeType || 'image/png',
            }
          : undefined,
        projectId: pid,
        userId: req.userId,
      });

      res.json(result);
    }),
  );

  app.post(
    '/api/chat/ai/stream',
    streamOriginGuard,
    payloadLimit(10 * 1024 * 1024),
    streamBodySizeGuard,
    streamRateLimiter,
    streamConcurrencyGuard,
    asyncHandler(async (req, res) => {
      const parsed = aiRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
      }

      // BL-0636: Ownership check — verify session owns the project
      const ownerCheckSessionId = req.headers['x-session-id'] as string | undefined;
      if (ownerCheckSessionId) {
        const session = await validateSession(ownerCheckSessionId);
        if (session) {
          const project = await storage.getProject(parsed.data.projectId);
          if (project && project.ownerId !== null && project.ownerId !== session.userId) {
            return res.status(404).json({ message: 'Project not found' });
          }
        }
      }

      const { message, provider, model, apiKey: clientApiKey, temperature, maxTokens } = parsed.data;
      const pid = parsed.data.projectId;

      const routingStrategy = parsed.data.routingStrategy || 'user';
      let resolvedModel = model;
      if (routingStrategy !== 'user') {
        const routed = routeToModel({
          strategy: routingStrategy,
          provider,
          userModel: model,
          messageLength: message.length,
          hasImage: !!parsed.data.imageBase64,
          appState: { activeView: parsed.data.activeView || 'dashboard', nodes: [], bom: [] },
          message,
        });
        resolvedModel = routed.model;
      }

      let apiKeyToUse = clientApiKey || '';
      if (req.userId) {
        const storedKey = await getApiKey(req.userId, provider);
        if (storedKey) {
          apiKeyToUse = storedKey;
        }
      }

      const appState = await buildAppStateFromProject(pid, {
        activeView: parsed.data.activeView,
        schematicSheets: parsed.data.schematicSheets,
        activeSheetId: parsed.data.activeSheetId,
        selectedNodeId: parsed.data.selectedNodeId,
        customSystemPrompt: parsed.data.customSystemPrompt,
        changeDiff: parsed.data.changeDiff,
      });

      // CAPX-REL-02: Track this session as having an active stream
      const sessionId = req.headers['x-session-id'] as string;
      activeStreams.add(sessionId);

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      const abortController = new AbortController();
      let closed = false;

      /** Clean up concurrency tracking + all timers */
      const cleanup = () => {
        activeStreams.delete(sessionId);
        clearTimeout(streamTimeout);
        clearTimeout(absoluteTimeout);
        clearInterval(heartbeatInterval);
      };

      // CAPX-API-08: Configurable, activity-based stream timeout
      const STREAM_TIMEOUT_MS = Number(process.env.STREAM_TIMEOUT_MS) || 120_000;
      let streamTimeout: ReturnType<typeof setTimeout> | undefined;

      const resetStreamTimeout = () => {
        if (streamTimeout !== undefined) {
          clearTimeout(streamTimeout);
        }
        streamTimeout = setTimeout(() => {
          if (!closed) {
            closed = true;
            cleanup();
            res.write(
              `data: ${JSON.stringify({ type: 'error', message: `Stream timed out after ${STREAM_TIMEOUT_MS / 1000} seconds of inactivity` })}\n\n`,
            );
            res.end();
          }
        }, STREAM_TIMEOUT_MS);
      };
      resetStreamTimeout();

      // CAPX-REL-02: Absolute stream timeout (5 min hard cap)
      const absoluteTimeout = setTimeout(() => {
        if (!closed) {
          closed = true;
          abortController.abort();
          cleanup();
          res.write(
            `data: ${JSON.stringify({ type: 'error', message: `Stream exceeded maximum duration of ${ABSOLUTE_STREAM_TIMEOUT_MS / 1000} seconds` })}\n\n`,
          );
          res.end();
        }
      }, ABSOLUTE_STREAM_TIMEOUT_MS);

      // CAPX-API-06: SSE heartbeat to keep proxies alive
      const HEARTBEAT_INTERVAL_MS = 15_000;
      const heartbeatInterval = setInterval(() => {
        if (!closed) {
          res.write(':heartbeat\n\n');
        }
      }, HEARTBEAT_INTERVAL_MS);

      req.on('close', () => {
        closed = true;
        abortController.abort();
        cleanup();
      });

      const DRAIN_TIMEOUT_MS = 30_000;

      const writeWithBackpressure = (data: string): Promise<void> => {
        return new Promise((resolve) => {
          if (closed) {
            resolve();
            return;
          }
          const ok = res.write(data);
          resetStreamTimeout();
          if (ok) {
            resolve();
            return;
          }
          const drainTimeout = setTimeout(() => {
            res.removeListener('drain', onDrain);
            closed = true;
            resolve();
          }, DRAIN_TIMEOUT_MS);
          function onDrain() {
            clearTimeout(drainTimeout);
            resolve();
          }
          res.once('drain', onDrain);
        });
      };

      try {
        await streamAIMessage(
          {
            message,
            provider,
            model: resolvedModel,
            apiKey: apiKeyToUse,
            appState,
            temperature: temperature ?? 0.7,
            maxTokens,
            toolContext: { projectId: pid, storage, confirmed: parsed.data.confirmed },
            imageContent: parsed.data.imageBase64
              ? {
                  base64: parsed.data.imageBase64,
                  mediaType: parsed.data.imageMimeType || 'image/png',
                }
              : undefined,
            userId: req.userId,
          },
          async (event) => {
            if (!closed) {
              await writeWithBackpressure(`data: ${JSON.stringify(event)}\n\n`);
            }
          },
          abortController.signal,
        );
        cleanup();
        if (!closed) {
          closed = true;
          res.end();
        }
      } catch (error: unknown) {
        cleanup();
        if (!closed) {
          closed = true;
          const { userMessage } = categorizeError(error);
          res.write(`data: ${JSON.stringify({ type: 'error', message: userMessage })}\n\n`);
          res.end();
        }
      }
    }),
  );

  // --- AI Action History (Phase 5) ---

  app.get(
    '/api/projects/:id/ai-actions',
    requireProjectOwnership,
    asyncHandler(async (req, res) => {
      const pid = parseIdParam(req.params.id);
      const project = await storage.getProject(pid);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      const actions = await storage.getAiActions(pid);
      res.json({ data: actions, total: actions.length });
    }),
  );

  app.get(
    '/api/ai-actions/by-message/:messageId',
    asyncHandler(async (req, res) => {
      const messageId = String(req.params.messageId ?? '');
      if (!messageId) {
        return res.status(400).json({ message: 'messageId is required' });
      }
      const actions = await storage.getAiActionsByMessage(messageId);
      res.json({ data: actions, total: actions.length });
    }),
  );
}
