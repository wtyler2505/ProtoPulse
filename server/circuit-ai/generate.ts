/**
 * POST /api/circuits/:id/ai/generate — generate schematic from description
 */

import type { Express } from 'express';
import type { IStorage } from '../storage';
import type { ComponentPart } from '@shared/schema';
import type { Connector, PartMeta } from '@shared/component-types';
import type { TextBlock } from '@anthropic-ai/sdk/resources/messages';
import { parseIdParam, payloadLimit, asyncHandler } from '../routes';
import { categorizeError, redactSecrets, getAnthropicClient } from '../ai';
import { fromZodError } from 'zod-validation-error';
import { anthropicBreaker } from '../circuit-breaker';
import { logger } from '../logger';
import { generateSchema } from './schemas';
import { getThinkingConfig } from './thinking';

function buildGeneratePrompt(description: string, parts: ComponentPart[]): string {
  const partsList = parts
    .map((p) => {
      const meta = (p.meta ?? {}) as Partial<PartMeta>;
      const conns = (p.connectors ?? []) as Connector[];
      return `  - Part #${p.id}: "${meta.title || 'Untitled'}" (family: ${meta.family || 'unknown'}, pins: ${conns.map((c) => `${c.id}(${c.name})`).join(', ')})`;
    })
    .join('\n');

  return `You are an electronics design assistant. Given a circuit description and available component parts, generate a schematic.

AVAILABLE PARTS:
${partsList || '  (no parts available)'}

USER'S CIRCUIT DESCRIPTION:
${description}

Generate a JSON response with this structure:
{
  "instances": [
    { "partId": <number>, "referenceDesignator": "<string>", "x": <number>, "y": <number> }
  ],
  "nets": [
    { "name": "<string>", "netType": "signal"|"power"|"ground"|"bus", "segments": [
      { "fromInstanceRefDes": "<string>", "fromPin": "<string>", "toInstanceRefDes": "<string>", "toPin": "<string>" }
    ]}
  ]
}

Rules:
- Only use parts from the AVAILABLE PARTS list (reference by Part #id)
- Assign IEEE reference designators (U1, R1, C1, J1, etc.)
- Create nets for all electrical connections
- In fromPin/toPin fields, use the pin ID (e.g., "pin1"), not the display name
- Power nets should be named (VCC, GND, 3V3, etc.)
- Position instances on a grid with ~200px spacing
- Respond ONLY with valid JSON, no markdown fences or extra text`;
}

export function registerCircuitAiGenerateRoute(app: Express, storage: IStorage): void {
  app.post(
    '/api/circuits/:circuitId/ai/generate',
    payloadLimit(64 * 1024),
    asyncHandler(async (req, res) => {
      const circuitId = parseIdParam(req.params.circuitId);
      const parsed = generateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
      }

      const { description, apiKey, model } = parsed.data;

      // Get circuit to find projectId
      const circuit = await storage.getCircuitDesign(circuitId);
      if (!circuit) {
        return res.status(404).json({ message: 'Circuit not found' });
      }

      const parts = await storage.getComponentParts(circuit.projectId);
      if (parts.length === 0) {
        return res.status(400).json({ message: 'No component parts available. Create parts first.' });
      }

      const prompt = buildGeneratePrompt(description, parts);

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

        // Log thinking blocks for transparency (if present)
        const thinkingBlocks = response.content.filter((b) => b.type === 'thinking');
        if (thinkingBlocks.length > 0) {
          logger.info('Extended thinking used for circuit generation', {
            thinkingBlocks: thinkingBlocks.length,
            model,
          });
        }

        // Parse the AI response
        let generated: {
          instances: Array<{ partId: number; referenceDesignator: string; x: number; y: number }>;
          nets: Array<{
            name: string;
            netType: string;
            segments: Array<{
              fromInstanceRefDes: string;
              fromPin: string;
              toInstanceRefDes: string;
              toPin: string;
            }>;
          }>;
        };

        try {
          generated = JSON.parse(text);
        } catch {
          return res.status(422).json({ message: 'AI returned invalid JSON', raw: redactSecrets(text) });
        }

        // Create instances
        const refDesToInstanceId = new Map<string, number>();
        for (const inst of generated.instances ?? []) {
          const part = parts.find((p) => p.id === inst.partId);
          if (!part) {
            continue;
          }

          const created = await storage.createCircuitInstance({
            circuitId,
            partId: inst.partId,
            referenceDesignator: inst.referenceDesignator,
            schematicX: inst.x ?? 0,
            schematicY: inst.y ?? 0,
            schematicRotation: 0,
            properties: { aiGenerated: true },
          });
          refDesToInstanceId.set(inst.referenceDesignator, created.id);
        }

        // Create nets
        let netCount = 0;
        for (const net of generated.nets ?? []) {
          const segments = (net.segments ?? [])
            .map((seg) => ({
              fromInstanceId: refDesToInstanceId.get(seg.fromInstanceRefDes) ?? 0,
              fromPin: seg.fromPin,
              toInstanceId: refDesToInstanceId.get(seg.toInstanceRefDes) ?? 0,
              toPin: seg.toPin,
            }))
            .filter((s) => s.fromInstanceId > 0 && s.toInstanceId > 0);

          if (segments.length === 0) {
            continue;
          }

          await storage.createCircuitNet({
            circuitId,
            name: net.name,
            netType: net.netType || 'signal',
            segments,
            labels: [],
            style: {},
          });
          netCount++;
        }

        res.json({
          instanceCount: refDesToInstanceId.size,
          netCount,
          message: `Generated ${refDesToInstanceId.size} instances and ${netCount} nets`,
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
