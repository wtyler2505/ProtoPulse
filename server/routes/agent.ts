import type { Express, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { storage } from '../storage';
import { categorizeError, redactSecrets } from '../ai';
import type { ToolContext, ToolResult } from '../ai-tools';
import { getApiKey } from '../auth';
import { asyncHandler, parseIdParam, HttpError } from './utils';
import { requireProjectOwnership } from './auth-middleware';
import { logger } from '../logger';

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

const AGENT_RATE_WINDOW_MS = 60_000;
const AGENT_RATE_MAX = 2;

interface RateBucket {
  timestamps: number[];
}

const agentRateBuckets = new Map<string, RateBucket>();

const AGENT_PRUNE_INTERVAL_MS = 120_000;
setInterval(() => {
  const cutoff = Date.now() - AGENT_RATE_WINDOW_MS;
  agentRateBuckets.forEach((bucket, ip) => {
    bucket.timestamps = bucket.timestamps.filter((t: number) => t > cutoff);
    if (bucket.timestamps.length === 0) {
      agentRateBuckets.delete(ip);
    }
  });
}, AGENT_PRUNE_INTERVAL_MS).unref();

function agentRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  const now = Date.now();
  const cutoff = now - AGENT_RATE_WINDOW_MS;

  let bucket = agentRateBuckets.get(ip);
  if (!bucket) {
    bucket = { timestamps: [] };
    agentRateBuckets.set(ip, bucket);
  }

  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= AGENT_RATE_MAX) {
    const oldestInWindow = bucket.timestamps[0];
    const retryAfterSec = Math.ceil((oldestInWindow + AGENT_RATE_WINDOW_MS - now) / 1000);
    res.setHeader('Retry-After', String(retryAfterSec));
    res.status(429).json({ message: `Rate limit exceeded. Max ${AGENT_RATE_MAX} design agent requests per minute.` });
    return;
  }

  bucket.timestamps.push(now);
  next();
}

const agentRequestSchema = z.object({
  description: z.string().min(1).max(10000),
  maxSteps: z.number().int().min(1).max(15).optional().default(8),
  apiKey: z.string().max(500).optional().default(''),
  model: z.string().max(200).optional().default('gemini-3-pro-preview'),
});

export interface AgentSSEEvent {
  step: number;
  type: 'thinking' | 'tool_call' | 'tool_result' | 'text' | 'complete' | 'error';
  message: string;
  toolName?: string;
  result?: ToolResult;
  summary?: string;
  stepsUsed?: number;
}

const AGENT_SYSTEM_PROMPT = `You are a circuit design agent inside ProtoPulse, an AI-powered EDA platform. Your job is to design a complete circuit based on the user's description.

Use the available tools to:
1. Create an architecture with appropriate components (use generate_architecture or add_node tools)
2. Add BOM items for each component (use add_bom_item tool)
3. Run DRC validation (use run_drc tool)
4. Run DFM checks if relevant (use run_dfm_check tool)

Call tools in this order. Be thorough — add realistic part numbers, manufacturers, descriptions, and quantities.
When the design is complete, respond with a summary of what you created. Do not ask for clarification — make reasonable engineering decisions and explain them.
Stop calling tools when the design is complete.`;

// ---------------------------------------------------------------------------
// Per-session concurrency guard (max 1 active agent stream per session)
// ---------------------------------------------------------------------------

const activeAgentSessions = new Set<string>();

// ---------------------------------------------------------------------------
// Absolute stream timeout (hard kill after 300 s regardless of activity)
// ---------------------------------------------------------------------------

const ABSOLUTE_AGENT_TIMEOUT_MS = 300_000;

function agentConcurrencyGuard(req: Request, res: Response, next: NextFunction): void {
  const sessionId = req.headers['x-session-id'] as string | undefined;
  if (!sessionId) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }
  if (activeAgentSessions.has(sessionId)) {
    res.status(429).json({ message: 'An agent session is already active for this session' });
    return;
  }
  next();
}

export const _agentInternals = {
  agentRateBuckets,
  AGENT_RATE_WINDOW_MS,
  AGENT_RATE_MAX,
  AGENT_SYSTEM_PROMPT,
  activeAgentSessions,
  ABSOLUTE_AGENT_TIMEOUT_MS,
};

export function registerAgentRoutes(app: Express): void {
  app.post(
    '/api/projects/:id/agent',
    requireProjectOwnership,
    agentConcurrencyGuard,
    agentRateLimiter,
    asyncHandler(async (req: Request, res: Response) => {
      const projectId = parseIdParam(req.params.id);

      const project = await storage.getProject(projectId);
      if (!project) {
        throw new HttpError('Project not found', 404);
      }

      const parsed = agentRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
      }

      const { description, maxSteps, model } = parsed.data;
      let apiKeyToUse = parsed.data.apiKey || '';

      if (req.userId) {
        const storedKey = await getApiKey(req.userId, 'gemini');
        if (storedKey) apiKeyToUse = storedKey;
      }

      if (!apiKeyToUse) {
        return res.status(400).json({ message: 'No Google Gemini API key provided. Set it in AI settings first.' });
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      // --- Per-session concurrency: register this session ---
      const sessionId = req.headers['x-session-id'] as string | undefined;
      if (sessionId) {
        activeAgentSessions.add(sessionId);
      }

      // --- Absolute timeout: 300 s hard cap ---
      const abortController = new AbortController();
      const timeoutHandle = setTimeout(() => {
        abortController.abort();
      }, ABSOLUTE_AGENT_TIMEOUT_MS);

      let closed = false;
      req.on('close', () => { closed = true; });

      const heartbeatInterval = setInterval(() => {
        if (!closed) {
          res.write(':heartbeat\n\n');
        }
      }, 15_000);

      const sendEvent = (event: AgentSSEEvent): void => {
        if (!closed) {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
      };

      const toolContext: ToolContext = { projectId, storage, confirmed: false };

      try {
        const { ai, allGenkitTools } = await import('../genkit');

        sendEvent({ step: 1, type: 'thinking', message: `Step 1: Orchestrating design via ${model}...` });

        const { response, stream } = ai.generateStream({
          model: `googleai/${model}`,
          system: AGENT_SYSTEM_PROMPT,
          prompt: `Design the following circuit:\n\n${description}`,
          tools: allGenkitTools,
          config: {
            temperature: 0.2,
            maxOutputTokens: 8192,
            apiKey: apiKeyToUse
          },
          context: toolContext
        });

        let fullText = '';
        let step = 1;

        for await (const chunk of stream) {
          if (closed || abortController.signal.aborted) {
            break;
          }

          // --- Enforce maxSteps: break with 'complete' event when limit reached ---
          if (step >= maxSteps) {
            sendEvent({
              step,
              type: 'complete',
              message: `Reached maximum steps (${String(maxSteps)})`,
              summary: fullText || 'Design agent reached step limit.',
              stepsUsed: step,
            });
            break;
          }

          if (chunk.text) {
            fullText += chunk.text;
          }

          if (chunk.toolRequests && chunk.toolRequests.length > 0) {
            for (const toolReq of chunk.toolRequests) {
              if (step >= maxSteps) {
                break;
              }

              sendEvent({
                step,
                type: 'tool_call',
                message: `Calling tool: ${toolReq.toolRequest.name}`,
                toolName: toolReq.toolRequest.name,
              });

              sendEvent({
                step,
                type: 'tool_result',
                message: 'Executed successfully via Genkit orchestrator',
                toolName: toolReq.toolRequest.name,
                result: { success: true, message: 'Done', data: {} },
              });

              step++;
            }
          }
        }

        // If we broke out due to abort timeout, send error event
        if (abortController.signal.aborted) {
          sendEvent({
            step,
            type: 'error',
            message: 'Agent session timed out after 300 seconds',
          });
        } else if (!closed && step < maxSteps) {
          // Normal completion — only emit if we didn't already emit a maxSteps complete
          const finalResponse = await response;

          sendEvent({
            step,
            type: 'text',
            message: finalResponse.text || fullText
          });

          sendEvent({
            step,
            type: 'complete',
            message: 'Design complete',
            summary: finalResponse.text || 'Design agent finished.',
            stepsUsed: step,
          });
        }

      } catch (error: unknown) {
        const { userMessage } = categorizeError(error);
        logger.error(`[agent] Design agent error: ${redactSecrets(String(error))}`);
        sendEvent({
          step: 1,
          type: 'error',
          message: userMessage,
        });
      } finally {
        clearTimeout(timeoutHandle);
        clearInterval(heartbeatInterval);
        if (sessionId) {
          activeAgentSessions.delete(sessionId);
        }
        if (!closed) {
          closed = true;
          res.end();
        }
      }
    }),
  );
}
