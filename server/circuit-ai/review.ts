/**
 * POST /api/circuits/:id/ai/review
 */

import type { Express } from 'express';
import type { IStorage } from '../storage';
import type { ComponentPart, CircuitInstanceRow, CircuitNetRow } from '@shared/schema';
import type { PartMeta } from '@shared/component-types';
import { parseIdParam, payloadLimit } from '../routes/utils';
import { requireCircuitOwnership } from '../routes/auth-middleware';
import { circuitAiRateLimiter } from './rate-limiter';
import { categorizeError, redactSecrets } from '../ai';
import { fromZodError } from 'zod-validation-error/v3';
import { logger } from '../logger';
import { reviewSchema } from './schemas';
import { ai } from '../genkit';
import { googleAI } from '@genkit-ai/google-genai';

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
    requireCircuitOwnership,
    circuitAiRateLimiter,
    payloadLimit(64 * 1024),
    async (req, res) => {
      const circuitId = parseIdParam(req.params.circuitId);
      const parsed = reviewSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
      }

      const { apiKey } = parsed.data;

      const circuit = await storage.getCircuitDesign(circuitId);
      if (!circuit) {
        return res.status(404).json({ message: 'Circuit not found' });
      }

      const [parts, instances, nets] = await Promise.all([
        storage.getComponentParts(circuit.projectId),
        storage.getCircuitInstances(circuitId),
        storage.getCircuitNets(circuitId),
      ]);
      if (parts.length === 0) {
        return res.status(400).json({ message: 'No component parts available.' });
      }

      const prompt = buildReviewPrompt(instances, nets, parts);

      try {
        const response = await ai.generate({
          model: googleAI.model('gemini-3-pro-preview'), // Force gemini
          prompt,
          config: {
            temperature: 0.1,
            maxOutputTokens: 8192,
            apiKey: apiKey || undefined
          }
        });

        let text = response.text || '';
        if (text.startsWith('```json')) {
          text = text.replace(/^```json\n/, '').replace(/\n```$/, '');
        } else if (text.startsWith('```')) {
          text = text.replace(/^```\n/, '').replace(/\n```$/, '');
        }

        let resultData: unknown;
        try {
          resultData = JSON.parse(text);
        } catch {
          return res.status(422).json({ message: 'AI returned invalid JSON', raw: redactSecrets(text) });
        }

        res.json({ success: true, message: 'Review completed', data: resultData });
      } catch (error: unknown) {
        const { userMessage } = categorizeError(error);
        logger.error(`[circuit-ai] Review error: ${redactSecrets(String(error))}`);
        res.status(500).json({ message: userMessage });
      }
    },
  );
}
