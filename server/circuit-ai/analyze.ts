/**
 * POST /api/circuits/:id/ai/analyze
 */

import type { Express } from 'express';
import type { IStorage } from '../storage';
import type { ComponentPart, CircuitInstanceRow, CircuitNetRow } from '@shared/schema';
import type { PartMeta } from '@shared/component-types';
import { parseIdParam, payloadLimit, asyncHandler } from '../routes/utils';
import { categorizeError, redactSecrets } from '../ai';
import { fromZodError } from 'zod-validation-error';
import { logger } from '../logger';
import { analyzeSchema } from './schemas';
import { ai } from '../genkit';
import { googleAI } from '@genkit-ai/google-genai';

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

      const { question, apiKey } = parsed.data;

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

      const prompt = buildAnalyzePrompt(question, instances, nets, parts);

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

        res.json({ success: true, message: 'Analysis completed', data: resultData });
      } catch (error: unknown) {
        const { userMessage } = categorizeError(error);
        logger.error(`[circuit-ai] Generation error: ${redactSecrets(String(error))}`);
        res.status(500).json({ message: userMessage });
      }
    }),
  );
}
