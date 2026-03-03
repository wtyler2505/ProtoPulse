/**
 * POST /api/circuits/:id/ai/review — analyze schematic for issues
 */

import type { Express } from 'express';
import type { IStorage } from '../storage';
import type { CircuitInstanceRow, CircuitNetRow, ComponentPart } from '@shared/schema';
import type { PartMeta } from '@shared/component-types';
import type { TextBlock } from '@anthropic-ai/sdk/resources/messages';
import { parseIdParam, payloadLimit, asyncHandler } from '../routes';
import { categorizeError, redactSecrets, getAnthropicClient } from '../ai';
import { fromZodError } from 'zod-validation-error';
import { anthropicBreaker } from '../circuit-breaker';
import { reviewSchema } from './schemas';

function buildReviewPrompt(
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
      return `  - ${inst.referenceDesignator}: "${meta.title || 'Unknown'}" (family: ${meta.family || '?'}, partId: ${inst.partId})`;
    })
    .join('\n');

  // Build connector name lookup: "pinId" -> "pinName" per part
  const connNameMap = new Map<string, string>();
  for (const part of parts) {
    const conns = (part.connectors ?? []) as Array<{ id: string; name: string }>;
    for (const c of conns) {
      connNameMap.set(`${part.id}:${c.id}`, c.name);
    }
  }
  const resolvePinName = (partId: number, pin: string): string => connNameMap.get(`${partId}:${pin}`) ?? pin;

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
          const fromName = fromInst?.partId != null ? resolvePinName(fromInst.partId, s.fromPin) : s.fromPin;
          const toName = toInst?.partId != null ? resolvePinName(toInst.partId, s.toPin) : s.toPin;
          return `${fromInst?.referenceDesignator || s.fromInstanceId}:${fromName} -> ${toInst?.referenceDesignator || s.toInstanceId}:${toName}`;
        })
        .join(', ');
      return `  - ${net.name} (${net.netType}): ${segDesc}`;
    })
    .join('\n');

  return `You are an electronics design reviewer. Analyze this schematic for issues and suggest improvements.

COMPONENT INSTANCES:
${instanceList || '  (none)'}

NETS:
${netList || '  (none)'}

Check for:
1. Missing bypass/decoupling capacitors on IC power pins
2. Unconnected pins that should be connected
3. Missing pull-up/pull-down resistors
4. Incorrect power connections
5. Signal integrity issues (missing termination resistors)
6. Best practices (ferrite beads on power input, ESD protection)

Respond with a JSON array of suggestions:
[
  {
    "severity": "error" | "warning" | "info",
    "message": "<description of the issue>",
    "suggestion": "<how to fix it>",
    "affectedComponents": ["<refdes>"]
  }
]

Respond ONLY with valid JSON, no markdown fences or extra text`;
}

export function registerCircuitAiReviewRoute(app: Express, storage: IStorage): void {
  app.post(
    '/api/circuits/:circuitId/ai/review',
    payloadLimit(16 * 1024),
    asyncHandler(async (req, res) => {
      const circuitId = parseIdParam(req.params.circuitId);
      const parsed = reviewSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
      }

      const { apiKey, model } = parsed.data;

      const circuit = await storage.getCircuitDesign(circuitId);
      if (!circuit) {
        return res.status(404).json({ message: 'Circuit not found' });
      }

      const instances = await storage.getCircuitInstances(circuitId);
      const nets = await storage.getCircuitNets(circuitId);
      const parts = await storage.getComponentParts(circuit.projectId);

      if (instances.length === 0) {
        return res.status(400).json({ message: 'No instances to review. Add components first.' });
      }

      const prompt = buildReviewPrompt(instances, nets, parts);

      try {
        const client = getAnthropicClient(apiKey);
        // Review is a simple task -- no extended thinking, but use circuit breaker
        const response = await anthropicBreaker.execute(() =>
          client.messages.create({
            model,
            max_tokens: 4096,
            messages: [{ role: 'user', content: prompt }],
          }),
        );

        const text = response.content
          .filter((b): b is TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('');

        let suggestions: Array<{
          severity: string;
          message: string;
          suggestion: string;
          affectedComponents?: string[];
        }>;

        try {
          suggestions = JSON.parse(text);
        } catch {
          return res.status(422).json({ message: 'AI returned invalid JSON', raw: redactSecrets(text) });
        }

        if (!Array.isArray(suggestions)) {
          suggestions = [];
        }

        res.json({
          suggestions,
          reviewedInstances: instances.length,
          reviewedNets: nets.length,
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
