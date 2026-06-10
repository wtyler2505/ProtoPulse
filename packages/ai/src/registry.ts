import { z } from 'zod';

import type Anthropic from '@anthropic-ai/sdk';
import type { DesignGraph, OpBody } from '@protopulse/graph';
import type { PartDb } from '@protopulse/parts';

/**
 * The Vol II §G.1 tool registry. Tools are pure: execute() PROPOSES ops —
 * the host applies them and updates the graph. Scope slices are enforced
 * at dispatch, not prompt politeness: an agent given a scoped registry
 * physically cannot invoke an out-of-scope tool.
 */

export interface ToolCtx {
  graph: DesignGraph;
  parts: PartDb;
}

export interface ToolResult {
  /** Proposed ops; the HOST applies them and updates graph. */
  ops: OpBody[];
  data?: unknown;
  summary: string;
}

export type CostClass = 'cheap' | 'standard' | 'heavy';

export interface AiTool<S extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  schema: S;
  destructive: boolean;
  costClass: CostClass;
  /** Pure: returns proposed ops, MUST NOT mutate ctx.graph. May throw on
   *  domain errors (unknown ref, missing net) — dispatch catches. */
  execute(input: z.infer<S>, ctx: ToolCtx): ToolResult;
  /** One-line narration for the depth dial / destructive-gate prompt. */
  explain(input: z.infer<S>): string;
  /** Per-invocation destructiveness (batch is destructive iff a member is).
   *  Falls back to the static `destructive` flag. */
  destructiveFor?(input: z.infer<S>): boolean;
}

export type DispatchResult =
  | { ok: true; result: ToolResult }
  | { ok: false; error: string };

// ── zod → JSON schema ────────────────────────────────────────────────
// Hand-rolled for exactly the shapes our tool inputs use: objects,
// strings, numbers, booleans, literals, enums, unions of literals,
// arrays, optionals, and unknown. Honest by construction: an
// unsupported zod node throws at registration time, not silently.

export function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const def = schema._def as { typeName?: string; description?: string };
  const describe = (out: Record<string, unknown>): Record<string, unknown> => {
    if (def.description !== undefined) out.description = def.description;
    return out;
  };

  if (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault) {
    return zodToJsonSchema(schema._def.innerType as z.ZodTypeAny);
  }
  if (schema instanceof z.ZodNullable) {
    const inner = zodToJsonSchema(schema._def.innerType as z.ZodTypeAny);
    return describe({ anyOf: [inner, { type: 'null' }] });
  }
  if (schema instanceof z.ZodString) return describe({ type: 'string' });
  if (schema instanceof z.ZodNumber) {
    return describe(schema.isInt ? { type: 'integer' } : { type: 'number' });
  }
  if (schema instanceof z.ZodBoolean) return describe({ type: 'boolean' });
  if (schema instanceof z.ZodLiteral) {
    const value: unknown = schema._def.value;
    return describe({ const: value });
  }
  if (schema instanceof z.ZodEnum) {
    return describe({ type: 'string', enum: [...(schema._def.values as string[])] });
  }
  if (schema instanceof z.ZodUnion) {
    const options = schema._def.options as z.ZodTypeAny[];
    if (options.every((o) => o instanceof z.ZodLiteral)) {
      return describe({ enum: options.map((o) => (o as z.ZodLiteral<unknown>)._def.value) });
    }
    return describe({ anyOf: options.map(zodToJsonSchema) });
  }
  if (schema instanceof z.ZodArray) {
    return describe({ type: 'array', items: zodToJsonSchema(schema._def.type as z.ZodTypeAny) });
  }
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value);
      if (!value.isOptional()) required.push(key);
    }
    const out: Record<string, unknown> = { type: 'object', properties, additionalProperties: false };
    if (required.length > 0) out.required = required;
    return describe(out);
  }
  if (schema instanceof z.ZodUnknown || schema instanceof z.ZodAny) {
    return describe({});
  }
  throw new Error(`zodToJsonSchema: unsupported zod node ${def.typeName ?? 'unknown'}`);
}

// ── Registry ─────────────────────────────────────────────────────────

export class ToolRegistry {
  private tools = new Map<string, AiTool>();

  register(tool: AiTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`tool ${tool.name} already registered`);
    }
    // Fail loudly at registration if the schema can't be converted.
    zodToJsonSchema(tool.schema as z.ZodTypeAny);
    this.tools.set(tool.name, tool);
  }

  get(name: string): AiTool | undefined {
    return this.tools.get(name);
  }

  names(): string[] {
    return [...this.tools.keys()];
  }

  /** Scope slices enforced at dispatch, not prompt politeness. */
  scoped(names: string[]): ToolRegistry {
    const out = new ToolRegistry();
    for (const name of names) {
      const tool = this.tools.get(name);
      if (!tool) throw new Error(`cannot scope to unknown tool ${name}`);
      out.tools.set(name, tool);
    }
    return out;
  }

  toAnthropicTools(): Anthropic.Tool[] {
    return [...this.tools.values()].map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: zodToJsonSchema(tool.schema as z.ZodTypeAny) as Anthropic.Tool.InputSchema,
    }));
  }

  dispatch(name: string, rawInput: unknown, ctx: ToolCtx): DispatchResult {
    const tool = this.tools.get(name);
    if (!tool) {
      return { ok: false, error: `unknown or out-of-scope tool: ${name}` };
    }
    const parsed = (tool.schema as z.ZodTypeAny).safeParse(rawInput);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ');
      return { ok: false, error: `invalid input for ${name}: ${issues}` };
    }
    try {
      return { ok: true, result: tool.execute(parsed.data, ctx) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
