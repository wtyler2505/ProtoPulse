/**
 * Circuit AI — AI-assisted schematic generation and review
 *
 * Endpoints:
 *   POST /api/circuits/:id/ai/generate — generate schematic from description
 *   POST /api/circuits/:id/ai/review   — analyze schematic for issues
 *   POST /api/circuits/:id/ai/analyze  — AI circuit analysis (what-if, filter topology, power est.)
 */

import type { Express } from "express";
import type { IStorage } from "./storage";
import { parseIdParam, payloadLimit, asyncHandler } from "./routes";
import { categorizeError, redactSecrets, getAnthropicClient } from "./ai";
import { fromZodError } from "zod-validation-error";
import type { CircuitInstanceRow, CircuitNetRow, ComponentPart } from "@shared/schema";
import type { Connector, PartMeta } from "@shared/component-types";
import type { TextBlock } from "@anthropic-ai/sdk/resources/messages";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const generateSchema = z.object({
  description: z.string().min(1).max(2000),
  apiKey: z.string().min(1),
  model: z.string().default("claude-sonnet-4-20250514"),
});

const reviewSchema = z.object({
  apiKey: z.string().min(1),
  model: z.string().default("claude-sonnet-4-20250514"),
});

const analyzeSchema = z.object({
  question: z.string().min(1).max(2000),
  apiKey: z.string().min(1),
  model: z.string().default("claude-sonnet-4-20250514"),
});

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function buildGeneratePrompt(
  description: string,
  parts: ComponentPart[],
): string {
  const partsList = parts.map((p) => {
    const meta = (p.meta ?? {}) as Partial<PartMeta>;
    const conns = (p.connectors ?? []) as Connector[];
    return `  - Part #${p.id}: "${meta.title || 'Untitled'}" (family: ${meta.family || 'unknown'}, pins: ${conns.map((c) => `${c.id}(${c.name})`).join(', ')})`;
  }).join('\n');

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

function buildReviewPrompt(
  instances: CircuitInstanceRow[],
  nets: CircuitNetRow[],
  parts: ComponentPart[],
): string {
  const partsMap = new Map<number, ComponentPart>();
  parts.forEach((p) => partsMap.set(p.id, p));

  const instanceList = instances.map((inst) => {
    const part = partsMap.get(inst.partId);
    const meta = (part?.meta ?? {}) as Partial<PartMeta>;
    return `  - ${inst.referenceDesignator}: "${meta.title || 'Unknown'}" (family: ${meta.family || '?'}, partId: ${inst.partId})`;
  }).join('\n');

  // Build connector name lookup: "pinId" → "pinName" per part
  const connNameMap = new Map<string, string>();
  for (const part of parts) {
    const conns = (part.connectors ?? []) as Array<{ id: string; name: string }>;
    for (const c of conns) {
      connNameMap.set(`${part.id}:${c.id}`, c.name);
    }
  }
  const resolvePinName = (partId: number, pin: string): string =>
    connNameMap.get(`${partId}:${pin}`) ?? pin;

  const netList = nets.map((net) => {
    const segs = (net.segments ?? []) as Array<{ fromInstanceId: number; fromPin: string; toInstanceId: number; toPin: string }>;
    const segDesc = segs.map((s) => {
      const fromInst = instances.find((i) => i.id === s.fromInstanceId);
      const toInst = instances.find((i) => i.id === s.toInstanceId);
      const fromName = fromInst ? resolvePinName(fromInst.partId, s.fromPin) : s.fromPin;
      const toName = toInst ? resolvePinName(toInst.partId, s.toPin) : s.toPin;
      return `${fromInst?.referenceDesignator || s.fromInstanceId}:${fromName} → ${toInst?.referenceDesignator || s.toInstanceId}:${toName}`;
    }).join(', ');
    return `  - ${net.name} (${net.netType}): ${segDesc}`;
  }).join('\n');

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

function buildAnalyzePrompt(
  question: string,
  instances: CircuitInstanceRow[],
  nets: CircuitNetRow[],
  parts: ComponentPart[],
): string {
  const partsMap = new Map<number, ComponentPart>();
  parts.forEach((p) => partsMap.set(p.id, p));

  const instanceList = instances.map((inst) => {
    const part = partsMap.get(inst.partId);
    const meta = (part?.meta ?? {}) as Partial<PartMeta>;
    const props = (inst.properties ?? {}) as Record<string, string>;
    const propsStr = Object.entries(props).map(([k, v]) => `${k}=${v}`).join(', ');
    return `  - ${inst.referenceDesignator}: "${meta.title || 'Unknown'}" (family: ${meta.family || '?'}${propsStr ? `, props: ${propsStr}` : ''})`;
  }).join('\n');

  const netList = nets.map((net) => {
    const segs = (net.segments ?? []) as Array<{ fromInstanceId: number; fromPin: string; toInstanceId: number; toPin: string }>;
    const segDesc = segs.map((s) => {
      const fromInst = instances.find((i) => i.id === s.fromInstanceId);
      const toInst = instances.find((i) => i.id === s.toInstanceId);
      return `${fromInst?.referenceDesignator || s.fromInstanceId}:${s.fromPin} → ${toInst?.referenceDesignator || s.toInstanceId}:${s.toPin}`;
    }).join(', ');
    return `  - ${net.name} (${net.netType}${net.voltage ? `, ${net.voltage}` : ''}): ${segDesc}`;
  }).join('\n');

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

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export function registerCircuitAIRoutes(app: Express, storage: IStorage) {

  // POST /api/circuits/:id/ai/generate
  app.post("/api/circuits/:circuitId/ai/generate", payloadLimit(64 * 1024), asyncHandler(async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const parsed = generateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request: " + fromZodError(parsed.error).toString() });
    }

    const { description, apiKey, model } = parsed.data;

    // Get circuit to find projectId
    const circuit = await storage.getCircuitDesign(circuitId);
    if (!circuit) return res.status(404).json({ message: "Circuit not found" });

    const parts = await storage.getComponentParts(circuit.projectId);
    if (parts.length === 0) {
      return res.status(400).json({ message: "No component parts available. Create parts first." });
    }

    const prompt = buildGeneratePrompt(description, parts);

    try {
      const client = getAnthropicClient(apiKey);
      const response = await client.messages.create({
        model,
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content
        .filter((b): b is TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");

      // Parse the AI response
      let generated: {
        instances: Array<{ partId: number; referenceDesignator: string; x: number; y: number }>;
        nets: Array<{ name: string; netType: string; segments: Array<{ fromInstanceRefDes: string; fromPin: string; toInstanceRefDes: string; toPin: string }> }>;
      };

      try {
        generated = JSON.parse(text);
      } catch {
        return res.status(422).json({ message: "AI returned invalid JSON", raw: redactSecrets(text) });
      }

      // Create instances
      const refDesToInstanceId = new Map<string, number>();
      for (const inst of generated.instances ?? []) {
        const part = parts.find((p) => p.id === inst.partId);
        if (!part) continue;

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
        const segments = (net.segments ?? []).map((seg) => ({
          fromInstanceId: refDesToInstanceId.get(seg.fromInstanceRefDes) ?? 0,
          fromPin: seg.fromPin,
          toInstanceId: refDesToInstanceId.get(seg.toInstanceRefDes) ?? 0,
          toPin: seg.toPin,
        })).filter((s) => s.fromInstanceId > 0 && s.toInstanceId > 0);

        if (segments.length === 0) continue;

        await storage.createCircuitNet({
          circuitId,
          name: net.name,
          netType: net.netType || "signal",
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
      res.status(code === "AUTH_FAILED" ? 401 : code === "RATE_LIMITED" ? 429 : 500)
        .json({ message: userMessage, code });
    }
  }));

  // POST /api/circuits/:id/ai/review
  app.post("/api/circuits/:circuitId/ai/review", payloadLimit(16 * 1024), asyncHandler(async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request: " + fromZodError(parsed.error).toString() });
    }

    const { apiKey, model } = parsed.data;

    const circuit = await storage.getCircuitDesign(circuitId);
    if (!circuit) return res.status(404).json({ message: "Circuit not found" });

    const instances = await storage.getCircuitInstances(circuitId);
    const nets = await storage.getCircuitNets(circuitId);
    const parts = await storage.getComponentParts(circuit.projectId);

    if (instances.length === 0) {
      return res.status(400).json({ message: "No instances to review. Add components first." });
    }

    const prompt = buildReviewPrompt(instances, nets, parts);

    try {
      const client = getAnthropicClient(apiKey);
      const response = await client.messages.create({
        model,
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content
        .filter((b): b is TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");

      let suggestions: Array<{
        severity: string;
        message: string;
        suggestion: string;
        affectedComponents?: string[];
      }>;

      try {
        suggestions = JSON.parse(text);
      } catch {
        return res.status(422).json({ message: "AI returned invalid JSON", raw: redactSecrets(text) });
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
      res.status(code === "AUTH_FAILED" ? 401 : code === "RATE_LIMITED" ? 429 : 500)
        .json({ message: userMessage, code });
    }
  }));

  // POST /api/circuits/:circuitId/ai/analyze — AI circuit analysis (Phase 13.9)
  app.post("/api/circuits/:circuitId/ai/analyze", payloadLimit(64 * 1024), asyncHandler(async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const parsed = analyzeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request: " + fromZodError(parsed.error).toString() });
    }

    const { question, apiKey, model } = parsed.data;

    const circuit = await storage.getCircuitDesign(circuitId);
    if (!circuit) return res.status(404).json({ message: "Circuit not found" });

    const instances = await storage.getCircuitInstances(circuitId);
    const nets = await storage.getCircuitNets(circuitId);
    const parts = await storage.getComponentParts(circuit.projectId);

    const prompt = buildAnalyzePrompt(question, instances, nets, parts);

    try {
      const client = getAnthropicClient(apiKey);
      const response = await client.messages.create({
        model,
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content
        .filter((b): b is TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");

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
      res.status(code === "AUTH_FAILED" ? 401 : code === "RATE_LIMITED" ? 429 : 500)
        .json({ message: userMessage, code });
    }
  }));
}
