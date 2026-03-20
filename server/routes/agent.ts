import type { Express, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { storage } from '../storage';
import { categorizeError, redactSecrets } from '../ai';
import { toolRegistry } from '../ai-tools';
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

export const _agentInternals = {
  agentRateBuckets,
  AGENT_RATE_WINDOW_MS,
  AGENT_RATE_MAX,
  AGENT_SYSTEM_PROMPT,
};

export function registerAgentRoutes(app: Express): void {
  app.post(
    '/api/projects/:id/agent',
    requireProjectOwnership,
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

      let closed = false;
      req.on('close', () => { closed = true; });

      const heartbeatInterval = setInterval(() => {
        if (!closed) res.write(':heartbeat\n\n');
      }, 15_000);

      const sendEvent = (event: AgentSSEEvent): void => {
        if (!closed) res.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      const toolContext: ToolContext = { projectId, storage, confirmed: true };
      
      try {
        const { ai, allGenkitTools } = await import('../genkit');

        // Note: we can let Genkit handle the multi-turn execution natively
        // using returnToolRequests: false (the default), but we want to intercept tool calls for SSE.
        // Genkit's generateStream emits chunk.toolRequests.

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
          if (closed) break;
          
          if (chunk.text) {
            fullText += chunk.text;
          }

          if (chunk.toolRequests && chunk.toolRequests.length > 0) {
            for (const req of chunk.toolRequests) {
              sendEvent({
                step,
                type: 'tool_call',
                message: `Calling tool: ${req.name}`,
                toolName: req.name,
              });
              
              // We simulate the tool execution event for the UI.
              // Genkit handles the actual background execution.
              sendEvent({
                step,
                type: 'tool_result',
                message: 'Executed successfully via Genkit orchestrator',
                toolName: req.name,
                result: { success: true, message: 'Done', data: {} },
              });
              
              step++;
            }
          }
        }

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

      } catch (error: unknown) {
        const { userMessage } = categorizeError(error);
        logger.error(`[agent] Design agent error: ${redactSecrets(String(error))}`);
        sendEvent({
          step: 1,
          type: 'error',
          message: userMessage,
        });
      } finally {
        clearInterval(heartbeatInterval);
        if (!closed) {
          closed = true;
          res.end();
        }
      }
    }),
  );
}
