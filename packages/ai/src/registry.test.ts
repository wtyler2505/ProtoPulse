import { emptyGraph } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ToolRegistry, zodToJsonSchema   } from './registry.js';

import type {AiTool, ToolCtx} from './registry.js';

function ctx(): ToolCtx {
  return { graph: emptyGraph(), parts: seedPartDb() };
}

const echoSchema = z.object({ msg: z.string(), times: z.number().int().optional() });

const echoTool: AiTool<typeof echoSchema> = {
  name: 'echo',
  description: 'Echo a message',
  schema: echoSchema,
  destructive: false,
  costClass: 'cheap',
  execute(input) {
    return { ops: [], data: { msg: input.msg }, summary: `echoed ${input.msg}` };
  },
  explain(input) {
    return `Echo "${input.msg}"`;
  },
};

/** A Buyer-ish tool that must not leak into the Draftsman's slice. */
const buyPartsTool: AiTool = {
  name: 'buy_parts',
  description: 'Order parts from a distributor',
  schema: z.object({ mpn: z.string() }),
  destructive: true,
  costClass: 'heavy',
  execute() {
    return { ops: [], summary: 'ordered' };
  },
  explain() {
    return 'Order parts';
  },
};

describe('ToolRegistry', () => {
  it('registers and retrieves tools by name', () => {
    const reg = new ToolRegistry();
    reg.register(echoTool as AiTool);
    expect(reg.get('echo')).toBe(echoTool);
    expect(reg.get('nope')).toBeUndefined();
  });

  it('rejects duplicate registration', () => {
    const reg = new ToolRegistry();
    reg.register(echoTool as AiTool);
    expect(() => { reg.register(echoTool as AiTool); }).toThrow(/already registered/);
  });

  it('scoped() returns a slice that cannot dispatch out-of-scope tools', () => {
    const reg = new ToolRegistry();
    reg.register(echoTool as AiTool);
    reg.register(buyPartsTool);
    const draftsmanish = reg.scoped(['echo']);

    expect(draftsmanish.get('buy_parts')).toBeUndefined();
    const res = draftsmanish.dispatch('buy_parts', { mpn: 'NE555P' }, ctx());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/unknown or out-of-scope/);
    // Still present on the parent registry.
    expect(reg.dispatch('buy_parts', { mpn: 'NE555P' }, ctx()).ok).toBe(true);
  });

  it('scoped() throws on unknown names instead of silently shrinking', () => {
    const reg = new ToolRegistry();
    reg.register(echoTool as AiTool);
    expect(() => reg.scoped(['echo', 'ghost'])).toThrow(/unknown tool ghost/);
  });

  it('dispatch surfaces zod validation errors', () => {
    const reg = new ToolRegistry();
    reg.register(echoTool as AiTool);
    const res = reg.dispatch('echo', { msg: 42 }, ctx());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/invalid input for echo.*msg/);
  });

  it('dispatch validates then executes', () => {
    const reg = new ToolRegistry();
    reg.register(echoTool as AiTool);
    const res = reg.dispatch('echo', { msg: 'hi' }, ctx());
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.result.summary).toBe('echoed hi');
      expect(res.result.data).toEqual({ msg: 'hi' });
    }
  });

  it('dispatch converts execute() throws into errors', () => {
    const reg = new ToolRegistry();
    const bomb: AiTool = {
      ...echoTool,
      name: 'bomb',
      execute() {
        throw new Error('kaboom');
      },
    } as AiTool;
    reg.register(bomb);
    const res = reg.dispatch('bomb', { msg: 'x' }, ctx());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('kaboom');
  });

  it('toAnthropicTools emits JSON schema with properties and required', () => {
    const reg = new ToolRegistry();
    reg.register(echoTool as AiTool);
    const tools = reg.toAnthropicTools();
    expect(tools).toHaveLength(1);
    const tool = tools[0];
    expect(tool?.name).toBe('echo');
    expect(tool?.description).toBe('Echo a message');
    expect(tool?.input_schema).toMatchObject({
      type: 'object',
      properties: { msg: { type: 'string' }, times: { type: 'integer' } },
      required: ['msg'],
    });
  });
});

describe('zodToJsonSchema', () => {
  it('handles nested objects, arrays, enums, and literal unions', () => {
    const schema = z.object({
      at: z.object({ x_mm: z.number(), y_mm: z.number() }),
      rot: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).optional(),
      kind: z.literal('current_max'),
      tags: z.array(z.string()),
      flag: z.boolean().optional(),
      anything: z.unknown(),
    });
    const json = zodToJsonSchema(schema);
    expect(json).toMatchObject({
      type: 'object',
      properties: {
        at: {
          type: 'object',
          properties: { x_mm: { type: 'number' }, y_mm: { type: 'number' } },
          required: ['x_mm', 'y_mm'],
        },
        rot: { enum: [0, 90, 180, 270] },
        kind: { const: 'current_max' },
        tags: { type: 'array', items: { type: 'string' } },
        flag: { type: 'boolean' },
      },
    });
    expect((json.required as string[])).toContain('at');
    expect((json.required as string[])).not.toContain('rot');
  });
});
