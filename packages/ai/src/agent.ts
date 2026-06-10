import { runErc } from '@protopulse/erc';
import { applyOp, cloneGraph } from '@protopulse/graph';

import { assembleContext } from './context.js';

import type { AgentEvent, ProviderContentBlock, ProviderMessage, LlmProvider } from './provider.js';
import type { ToolCtx, ToolRegistry, ToolResult } from './registry.js';
import type { DesignGraph, OpBody, OpEnvelope } from '@protopulse/graph';
import type { PartDb } from '@protopulse/parts';
import type { z } from 'zod';

/**
 * The agent loop machinery — Vol III §6. One loop, many personas: the
 * provider proposes tool calls; the registry validates and executes;
 * persona-specific hooks build the system prompt and commit results.
 * runDraftsman and runAnalyst are both thin wrappers over runAgentLoop.
 */

// ── Shared loop ──────────────────────────────────────────────────────

export interface RunAgentLoopOptions {
  prompt: string;
  provider: LlmProvider;
  registry: ToolRegistry;
  /** Recomputed every turn — closures over mutable state are expected. */
  buildSystem: () => string;
  /** ToolCtx handed to dispatch — also recomputed every call. */
  getCtx: () => ToolCtx;
  /** Called after a successful dispatch with the tool's result and its
   *  explain() line. Return an error string to fail the tool call (its
   *  tool_result becomes is_error), undefined to accept it. */
  commit?: (result: ToolResult, rationale: string) => string | undefined;
  onEvent?: (ev: AgentEvent) => void;
  /** Gate for destructive tool calls; receives the tool's explain() line. */
  confirmDestructive?: (explain: string) => Promise<boolean> | boolean;
  maxTurns?: number;
}

export interface AgentLoopResult {
  transcript: ProviderMessage[];
  finalText: string;
}

export async function runAgentLoop(opts: RunAgentLoopOptions): Promise<AgentLoopResult> {
  const {
    prompt,
    provider,
    registry,
    buildSystem,
    getCtx,
    commit,
    onEvent,
    confirmDestructive,
    maxTurns = 8,
  } = opts;

  const messages: ProviderMessage[] = [{ role: 'user', content: prompt }];
  let finalText = '';

  for (let turn = 0; turn < maxTurns; turn++) {
    const events = await provider.turn({
      system: buildSystem(),
      // Snapshot: providers must not observe later mutations of the log.
      messages: [...messages],
      tools: registry.toAnthropicTools(),
    });

    const assistantBlocks: ProviderContentBlock[] = [];
    const toolUses: { id: string; name: string; input: unknown }[] = [];
    for (const ev of events) {
      onEvent?.(ev);
      if (ev.kind === 'text') {
        finalText = ev.text;
        assistantBlocks.push({ type: 'text', text: ev.text });
      } else if (ev.kind === 'tool_use') {
        toolUses.push(ev);
        assistantBlocks.push({ type: 'tool_use', id: ev.id, name: ev.name, input: ev.input });
      }
    }
    if (assistantBlocks.length > 0) {
      messages.push({ role: 'assistant', content: assistantBlocks });
    }

    if (toolUses.length === 0) break; // done / no-tool-use turn

    const results: ProviderContentBlock[] = [];
    for (const use of toolUses) {
      const fail = (error: string): void => {
        results.push({ type: 'tool_result', tool_use_id: use.id, content: error, is_error: true });
      };

      const tool = registry.get(use.name);
      if (!tool) {
        fail(`unknown or out-of-scope tool: ${use.name}`);
        continue;
      }
      const parsed = (tool.schema as z.ZodTypeAny).safeParse(use.input);
      if (!parsed.success) {
        const issues = parsed.error.issues
          .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
          .join('; ');
        fail(`invalid input for ${use.name}: ${issues}`);
        continue;
      }
      const rationale = tool.explain(parsed.data);
      const destructive = tool.destructiveFor?.(parsed.data) ?? tool.destructive;
      if (destructive && confirmDestructive) {
        const allowed = await confirmDestructive(rationale);
        if (!allowed) {
          fail('user declined');
          continue;
        }
      }

      const dispatched = await registry.dispatchAsync(use.name, use.input, getCtx());
      if (!dispatched.ok) {
        fail(dispatched.error);
        continue;
      }

      const commitError = commit?.(dispatched.result, rationale);
      if (commitError !== undefined) {
        fail(commitError);
        continue;
      }

      results.push({
        type: 'tool_result',
        tool_use_id: use.id,
        content: JSON.stringify({
          summary: dispatched.result.summary,
          data: dispatched.result.data ?? null,
        }),
      });
    }
    messages.push({ role: 'user', content: results });
  }

  return { transcript: messages, finalText };
}

// ── The Draftsman ────────────────────────────────────────────────────
// The provider proposes tool calls; the registry validates and derives
// ops; the loop applies them to a WORKING COPY and returns all applied
// ops so the host (app) can dispatch them into its session for real.

export interface RunDraftsmanOptions {
  prompt: string;
  graph: DesignGraph;
  parts: PartDb;
  provider: LlmProvider;
  /** The draftsman SCOPED registry slice. */
  registry: ToolRegistry;
  recentOps?: OpEnvelope[];
  onEvent?: (ev: AgentEvent) => void;
  /** Gate for destructive tool calls; receives the tool's explain() line. */
  confirmDestructive?: (explain: string) => Promise<boolean> | boolean;
  maxTurns?: number;
  /** Actor id used on emitted envelopes. */
  actor?: string;
}

export interface DraftsmanResult {
  /** All APPLIED ops, in order. */
  ops: OpBody[];
  /** Applied ops wrapped in envelopes with meta {agent, rationale}. */
  envelopes: OpEnvelope[];
  transcript: ProviderMessage[];
  finalText: string;
}

const DRAFTSMAN_PERSONA =
  'You are the Draftsman: fast hands, tidy wires, opinionated about decoupling. ' +
  'You edit the schematic through tools — never by describing edits in prose.';

function buildSystemPrompt(parts: PartDb, context: string): string {
  const partIds = [...new Set(parts.all().map((p) => p.id))].sort();
  return [
    DRAFTSMAN_PERSONA,
    '',
    'STRICT RULES:',
    '- ALWAYS run run_erc after any mutating tool call, and fix what it finds.',
    '- Prefer the batch tool for any multi-step edit so it lands as one undo unit.',
    '- All coordinates are millimeters; they snap to the 1.27mm schematic grid.',
    '- NEVER invent part ids. The only valid part ids are:',
    partIds.map((id) => `  - ${id}`).join('\n'),
    '- Ports are written REF:pinKey, e.g. "R1:1" or "U1:8".',
    '',
    context,
  ].join('\n');
}

export async function runDraftsman(opts: RunDraftsmanOptions): Promise<DraftsmanResult> {
  const {
    prompt,
    parts,
    provider,
    registry,
    recentOps = [],
    onEvent,
    confirmDestructive,
    maxTurns = 8,
    actor = 'agent:draftsman',
  } = opts;

  const working = cloneGraph(opts.graph);
  const appliedOps: OpBody[] = [];
  const envelopes: OpEnvelope[] = [];
  let lamport = recentOps.reduce((max, env) => Math.max(max, env.lamport), 0);
  const opLog: OpEnvelope[] = [...recentOps];

  const loop = await runAgentLoop({
    prompt,
    provider,
    registry,
    onEvent,
    confirmDestructive,
    maxTurns,
    buildSystem: () => {
      const findings = runErc(working, parts);
      return buildSystemPrompt(parts, assembleContext(working, parts, findings, opLog));
    },
    getCtx: () => ({ graph: working, parts }),
    commit: (result, rationale) => {
      // Apply transactionally: all of this call's ops or none.
      const draft = cloneGraph(working);
      for (const op of result.ops) {
        const res = applyOp(draft, op);
        if (!res.ok) return `op apply failed: ${res.error}`;
      }
      // Commit the draft.
      Object.assign(working, draft);
      for (const op of result.ops) {
        appliedOps.push(op);
        lamport += 1;
        const env: OpEnvelope = {
          actor,
          lamport,
          ts: Date.now(),
          op,
          meta: { agent: 'draftsman', rationale },
        };
        envelopes.push(env);
        opLog.push(env);
      }
      return undefined;
    },
  });

  return {
    ops: appliedOps,
    envelopes,
    transcript: loop.transcript,
    finalText: loop.finalText,
  };
}
