/**
 * POST /api/circuits/:id/ai/generate — generate schematic from description
 */

import type { Express } from 'express';
import type { IStorage } from '../storage';
import type { ComponentPart } from '@shared/schema';
import type { Connector, PartMeta } from '@shared/component-types';
import { parseIdParam, payloadLimit, asyncHandler } from '../routes/utils';
import { requireCircuitOwnership } from '../routes/auth-middleware';
import { circuitAiRateLimiter } from './rate-limiter';
import { categorizeError, redactSecrets } from '../ai';
import { fromZodError } from 'zod-validation-error';
import { logger } from '../logger';
import { generateSchema } from './schemas';
import { ai } from '../genkit';
import { googleAI } from '@genkit-ai/google-genai';

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
    requireCircuitOwnership,
    circuitAiRateLimiter,
    payloadLimit(64 * 1024),
    asyncHandler(async (req, res) => {
      const circuitId = parseIdParam(req.params.circuitId);
      const parsed = generateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
      }

      const { description, apiKey, model } = parsed.data;

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
        const response = await ai.generate({
          model: googleAI.model('gemini-3-pro-preview'), // Ignore requested anthropic model, use gemini
          prompt,
          config: {
            temperature: 0.1,
            maxOutputTokens: 8192,
            apiKey: apiKey || undefined
          }
        });

        let text = response.text || '';
        // Clean up markdown fences if model returned them
        if (text.startsWith('```json')) {
          text = text.replace(/^```json\n/, '').replace(/\n```$/, '');
        } else if (text.startsWith('```')) {
          text = text.replace(/^```\n/, '').replace(/\n```$/, '');
        }

        let generated: {
          instances?: Array<{ partId: number; referenceDesignator: string; x?: number; y?: number }>;
          nets?: Array<{ name: string; netType?: string; segments?: Array<{ fromInstanceRefDes: string; fromPin: string; toInstanceRefDes: string; toPin: string }> }>;
        };
        try {
          generated = JSON.parse(text);
        } catch {
          return res.status(422).json({ message: 'AI returned invalid JSON', raw: redactSecrets(text) });
        }

        // Compensating transaction: track created IDs so we can clean up on failure
        const createdInstanceIds: number[] = [];
        const createdNetIds: number[] = [];
        const createdWireIds: number[] = [];

        try {
          const refDesToInstanceId = new Map<string, number>();
          for (const inst of generated.instances ?? []) {
            const part = parts.find((p) => p.id === inst.partId);
            if (!part) { continue; }

            const created = await storage.createCircuitInstance({
              circuitId,
              partId: inst.partId,
              referenceDesignator: inst.referenceDesignator,
              schematicX: inst.x ?? 0,
              schematicY: inst.y ?? 0,
              schematicRotation: 0,
              properties: { aiGenerated: true },
            });
            createdInstanceIds.push(created.id);
            refDesToInstanceId.set(inst.referenceDesignator, created.id);
          }

          for (const net of generated.nets ?? []) {
            const createdNet = await storage.createCircuitNet({
              circuitId,
              name: net.name,
              netType: net.netType ?? 'signal',
              segments: (net.segments ?? []).map((seg: { fromInstanceRefDes: string; fromPin: string; toInstanceRefDes: string; toPin: string }) => ({
                fromInstanceId: refDesToInstanceId.get(seg.fromInstanceRefDes) ?? 0,
                fromPin: seg.fromPin,
                toInstanceId: refDesToInstanceId.get(seg.toInstanceRefDes) ?? 0,
                toPin: seg.toPin,
              })),
            });
            createdNetIds.push(createdNet.id);

            for (const seg of net.segments ?? []) {
              const fromInstId = refDesToInstanceId.get(seg.fromInstanceRefDes);
              const toInstId = refDesToInstanceId.get(seg.toInstanceRefDes);

              if (fromInstId && toInstId) {
                const wire = await storage.createCircuitWire({
                  circuitId,
                  netId: createdNet.id,
                  view: 'schematic',
                  points: [],
                });
                createdWireIds.push(wire.id);
              }
            }
          }
        } catch (createError: unknown) {
          // Compensating cleanup: delete all created records in reverse order
          logger.warn(`[circuit-ai] Generation partially failed, cleaning up ${createdWireIds.length} wires, ${createdNetIds.length} nets, ${createdInstanceIds.length} instances`);
          for (const wireId of createdWireIds) {
            try { await storage.deleteCircuitWire(wireId); } catch { /* best-effort cleanup */ }
          }
          for (const netId of createdNetIds) {
            try { await storage.deleteCircuitNet(netId); } catch { /* best-effort cleanup */ }
          }
          for (const instId of createdInstanceIds) {
            try { await storage.deleteCircuitInstance(instId); } catch { /* best-effort cleanup */ }
          }
          throw createError;
        }

        res.json({ success: true, message: 'Circuit generated successfully' });
      } catch (error: unknown) {
        const { userMessage } = categorizeError(error);
        logger.error(`[circuit-ai] Generation error: ${redactSecrets(String(error))}`);
        res.status(500).json({ message: userMessage });
      }
    }),
  );
}
