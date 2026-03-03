/**
 * POST /api/circuits/:circuitId/ai/analyze — AI circuit analysis (what-if, filter topology, power est.)
 */

import type { Express } from 'express';
import type { IStorage } from '../storage';
import type { CircuitInstanceRow, CircuitNetRow, ComponentPart } from '@shared/schema';
import type { PartMeta } from '@shared/component-types';
import type { TextBlock } from '@anthropic-ai/sdk/resources/messages';
import { parseIdParam, payloadLimit, asyncHandler } from '../routes';
import { categorizeError, getAnthropicClient } from '../ai';
import { fromZodError } from 'zod-validation-error';
import { anthropicBreaker } from '../circuit-breaker';
import { logger } from '../logger';
import { analyzeSchema } from './schemas';
import { getThinkingConfig } from './thinking';

function buildAnalyzePrompt(
  question: string,
  instances: CircuitInstanceRow[],
  nets: CircuitNetRow[],
  parts: ComponentPart[],
): string {
  const partsMap = new Map<number, ComponentPart>();
  parts.forEach((p) => partsMap.set(p.id, p));

  const instanceList = instances
    .map((inst) => {
      const part = inst.partId != null ? partsMap.get(inst.partId) : undefined;
      const meta = (part?.meta ?? {}) as Partial<PartMeta>;
      const props = (inst.properties ?? {}) as Record<string, string>;
      const propsStr = Object.entries(props)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      return `  - ${inst.referenceDesignator}: "${meta.title || 'Unknown'}" (family: ${meta.family || '?'}${propsStr ? `, props: ${propsStr}` : ''})`;
    })
    .join('\n');

  const netList = nets
    .map((net) => {
      const segs = (net.segments ?? []) as Array<{
        fromInstanceId: number;
        fromPin: string;
        toInstanceId: number;
        toPin: string;
      }>;
      const segDesc = segs
        .map((s) => {
          const fromInst = instances.find((i) => i.id === s.fromInstanceId);
          const toInst = instances.find((i) => i.id === s.toInstanceId);
          return `${fromInst?.referenceDesignator || s.fromInstanceId}:${s.fromPin} -> ${toInst?.referenceDesignator || s.toInstanceId}:${s.toPin}`;
        })
        .join(', ');
      return `  - ${net.name} (${net.netType}${net.voltage ? `, ${net.voltage}` : ''}): ${segDesc}`;
    })
    .join('\n');

  return `You are an expert electronics engineer and circuit analyst. Given a circuit schematic, answer the user's question about the circuit.

COMPONENT INSTANCES:
${instanceList || '  (none)'}

NETS:
${netList || '  (none)'}

USER'S QUESTION:
${question}

You can:
- Explain circuit behavior (what happens when X changes)
- Identify circuit topologies (filters, amplifiers, regulators, oscillators)
- Calculate derived values (cutoff frequency, gain, impedance, time constants)
- Estimate power consumption (sum V*I per source)
- Predict the effect of component value changes
- Identify potential issues or improvements

Respond with a JSON object:
{
  "answer": "<detailed explanation answering the question>",
  "calculations": [
    { "label": "<what was calculated>", "value": "<result with units>", "formula": "<formula used>" }
  ],
  "affectedComponents": ["<refdes of relevant components>"],
  "suggestions": ["<optional improvement suggestions>"]
}

Respond ONLY with valid JSON, no markdown fences or extra text`;
}

export function registerCircuitAiAnalyzeRoute(app: Express, storage: IStorage): void {
  app.post(
    '/api/circuits/:circuitId/ai/analyze',
    payloadLimit(64 * 1024),
    asyncHandler(async (req, res) => {
      const circuitId = parseIdParam(req.params.circuitId);
      const parsed = analyzeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
      }

      const { question, apiKey, model } = parsed.data;

      const circuit = await storage.getCircuitDesign(circuitId);
      if (!circuit) {
        return res.status(404).json({ message: 'Circuit not found' });
      }

      const instances = await storage.getCircuitInstances(circuitId);
      const nets = await storage.getCircuitNets(circuitId);
      const parts = await storage.getComponentParts(circuit.projectId);

      const prompt = buildAnalyzePrompt(question, instances, nets, parts);

      try {
        const client = getAnthropicClient(apiKey);
        const thinkingConfig = getThinkingConfig();
        const response = await anthropicBreaker.execute(() =>
          client.messages.create({
            model,
            max_tokens: 4096 + (thinkingConfig.thinking ? thinkingConfig.thinking.budget_tokens : 0),
            messages: [{ role: 'user', content: prompt }],
            ...thinkingConfig,
          }),
        );

        const text = response.content
          .filter((b): b is TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('');

        // Log thinking usage for observability
        const thinkingBlocks = response.content.filter((b) => b.type === 'thinking');
        if (thinkingBlocks.length > 0) {
          logger.info('Extended thinking used for circuit analysis', {
            thinkingBlocks: thinkingBlocks.length,
            model,
          });
        }

        let analysis: {
          answer: string;
          calculations?: Array<{ label: string; value: string; formula?: string }>;
          affectedComponents?: string[];
          suggestions?: string[];
        };

        try {
          analysis = JSON.parse(text);
        } catch {
          // If JSON parsing fails, return the raw text as the answer
          analysis = { answer: text };
        }

        res.json({
          ...analysis,
          analyzedInstances: instances.length,
          analyzedNets: nets.length,
        });
      } catch (error) {
        const { code, userMessage } = categorizeError(error);
        res
          .status(code === 'AUTH_FAILED' ? 401 : code === 'RATE_LIMITED' ? 429 : 500)
          .json({ message: userMessage, code });
      }
    }),
  );
}
