import type { Express, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { storage } from '../storage';
import { getAnthropicClient, categorizeError, redactSecrets } from '../ai';
import { toolRegistry } from '../ai-tools';
import type { ToolContext, ToolResult } from '../ai-tools';
import { getApiKey } from '../auth';
import { asyncHandler, parseIdParam, HttpError } from './utils';
import { requireProjectOwnership } from './auth-middleware';
import { logger } from '../logger';

// ---------------------------------------------------------------------------
// Rate limiting — 2 requests/min/IP for the design agent (expensive)
// ---------------------------------------------------------------------------

const AGENT_RATE_WINDOW_MS = 60_000;
const AGENT_RATE_MAX = 2;

interface RateBucket {
  timestamps: number[];
}

const agentRateBuckets = new Map<string, RateBucket>();

/** Prune stale agent rate-limit buckets every 2 minutes. */
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

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

const agentRequestSchema = z.object({
  description: z.string().min(1).max(10000),
  maxSteps: z.number().int().min(1).max(15).optional().default(8),
  apiKey: z.string().max(500).optional().default(''),
  model: z.string().max(200).optional().default('claude-sonnet-4-5-20250514'),
});

// ---------------------------------------------------------------------------
// SSE event types
// ---------------------------------------------------------------------------

export interface AgentSSEEvent {
  step: number;
  type: 'thinking' | 'tool_call' | 'tool_result' | 'text' | 'complete' | 'error';
  message: string;
  toolName?: string;
  result?: ToolResult;
  summary?: string;
  stepsUsed?: number;
}

// ---------------------------------------------------------------------------
// Agent system prompt
// ---------------------------------------------------------------------------

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
// Export internals for testing
// ---------------------------------------------------------------------------

export const _agentInternals = {
  agentRateBuckets,
  AGENT_RATE_WINDOW_MS,
  AGENT_RATE_MAX,
  AGENT_SYSTEM_PROMPT,
};

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export function registerAgentRoutes(app: Express): void {
  app.post(
    '/api/projects/:id/agent',
    requireProjectOwnership,
    agentRateLimiter,
    asyncHandler(async (req: Request, res: Response) => {
      const projectId = parseIdParam(req.params.id);

      // Validate project exists
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

      // Try stored API key
      if (req.userId) {
        const storedKey = await getApiKey(req.userId, 'anthropic');
        if (storedKey) {
          apiKeyToUse = storedKey;
        }
      }

      if (!apiKeyToUse) {
        return res.status(400).json({ message: 'No Anthropic API key provided. Set it in AI settings first.' });
      }

      // SSE setup
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

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

      const toolContext: ToolContext = { projectId, storage };
      const anthropicTools = toolRegistry.toAnthropicTools();
      const client = getAnthropicClient(apiKeyToUse);

      // Build conversation with agentic loop
      type MessageParam = { role: 'user' | 'assistant'; content: string | Array<Record<string, unknown>> };
      const messages: MessageParam[] = [
        { role: 'user', content: `Design the following circuit:\n\n${description}` },
      ];

      let stepsUsed = 0;

      try {
        for (let step = 1; step <= maxSteps; step++) {
          if (closed) { break; }

          sendEvent({ step, type: 'thinking', message: `Step ${step}: Sending request to AI...` });

          const response = await client.messages.create({
            model,
            max_tokens: 4096,
            system: AGENT_SYSTEM_PROMPT,
            tools: anthropicTools as Parameters<typeof client.messages.create>[0]['tools'],
            messages: messages as Parameters<typeof client.messages.create>[0]['messages'],
          });

          stepsUsed = step;

          // Check for tool use blocks
          const toolUseBlocks = response.content.filter(
            (block): block is { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } =>
              block.type === 'tool_use',
          );
          const extractText = (): string =>
            response.content
              .filter((block) => block.type === 'text')
              .map((block) => ('text' in block ? (block as { text: string }).text : ''))
              .join('\n');

          // If no tool calls, the AI is done
          if (toolUseBlocks.length === 0) {
            const finalText = extractText();
            sendEvent({ step, type: 'text', message: finalText });
            sendEvent({
              step,
              type: 'complete',
              message: 'Design complete',
              summary: finalText,
              stepsUsed,
            });
            break;
          }

          // Execute each tool call
          const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = [];

          for (const toolBlock of toolUseBlocks) {
            if (closed) { break; }

            sendEvent({
              step,
              type: 'tool_call',
              message: `Calling tool: ${toolBlock.name}`,
              toolName: toolBlock.name,
            });

            const result = await toolRegistry.execute(toolBlock.name, toolBlock.input, toolContext);

            sendEvent({
              step,
              type: 'tool_result',
              message: result.message,
              toolName: toolBlock.name,
              result,
            });

            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolBlock.id,
              content: JSON.stringify(result),
            });
          }

          // Add assistant message + tool results to conversation
          messages.push({
            role: 'assistant',
            content: response.content as unknown as Array<Record<string, unknown>>,
          });
          messages.push({
            role: 'user',
            content: toolResults as unknown as Array<Record<string, unknown>>,
          });

          // If stop_reason is end_turn (not tool_use), we're done
          if (response.stop_reason === 'end_turn') {
            const finalText = extractText();
            sendEvent({
              step,
              type: 'complete',
              message: 'Design complete',
              summary: finalText || 'Design agent finished.',
              stepsUsed,
            });
            break;
          }

          // If we reached maxSteps, send complete
          if (step === maxSteps) {
            sendEvent({
              step,
              type: 'complete',
              message: `Design agent reached maximum steps (${maxSteps})`,
              summary: `Completed ${stepsUsed} steps. The design may be incomplete — increase maxSteps to continue.`,
              stepsUsed,
            });
          }
        }
      } catch (error: unknown) {
        const { userMessage } = categorizeError(error);
        logger.error(`[agent] Design agent error: ${redactSecrets(String(error))}`);
        sendEvent({
          step: stepsUsed + 1,
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
