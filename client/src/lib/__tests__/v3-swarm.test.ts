import { describe, expect, it } from 'vitest';
import {
  createV3CodexCommandTemplates,
  dispatchV3OpenAIAgents,
  planV3OpenAIDispatch,
  planV3SwarmDispatch,
} from '@/lib/v3-swarm';

const readyTasks = [
  {
    id: 'firmware',
    role: 'firmware-writer',
    claimedFiles: ['client/src/lib/generated/firmware.ts'],
    prompt: 'Generate firmware contract.',
    requiresHardwareFacts: ['pinout'],
    verifiedHardwareFacts: ['pinout'],
  },
  {
    id: 'compiler',
    role: 'compiler',
    claimedFiles: ['client/src/lib/generated/compiler.ts'],
    prompt: 'Generate compiler adapter.',
  },
];

describe('v3 swarm planning', () => {
  it('blocks unsafe file paths, duplicate claims, missing facts, and more than six workers', () => {
    const plan = planV3SwarmDispatch([
      ...Array.from({ length: 7 }, (_, index) => ({
        id: `worker-${String(index)}`,
        role: 'compiler',
        claimedFiles: [`client/src/lib/generated/${String(index)}.ts`],
        prompt: 'work',
      })),
      {
        id: 'unsafe-root',
        role: 'compiler',
        claimedFiles: ['/tmp/owned.ts'],
        prompt: 'bad',
      },
      {
        id: 'unsafe-parent',
        role: 'compiler',
        claimedFiles: ['../server/genkit.ts'],
        prompt: 'bad',
      },
      {
        id: 'duplicate-a',
        role: 'compiler',
        claimedFiles: ['client/src/lib/generated/same.ts'],
        prompt: 'first',
      },
      {
        id: 'duplicate-b',
        role: 'compiler',
        claimedFiles: ['client/src/lib/generated/same.ts'],
        prompt: 'second',
      },
      {
        id: 'missing-fact',
        role: 'firmware-writer',
        claimedFiles: ['client/src/lib/generated/firmware.ts'],
        prompt: 'firmware',
        requiresHardwareFacts: ['pinout'],
        verifiedHardwareFacts: [],
      },
    ]);

    expect(plan.status).toBe('blocked');
    expect(plan.workerCap).toBe(6);
    expect(plan.blockedReasons).toEqual(expect.arrayContaining([
      'Too many workers: 12/6',
      'unsafe-root claims unsafe file path: /tmp/owned.ts',
      'unsafe-parent claims unsafe file path: ../server/genkit.ts',
      'duplicate-b conflicts with duplicate-a on client/src/lib/generated/same.ts',
      'missing-fact missing verified hardware fact: pinout',
    ]));
  });

  it('creates OpenAI dry-run dispatches only after the swarm plan is ready', async () => {
    const blockedDispatch = planV3OpenAIDispatch(planV3SwarmDispatch([
      { id: 'bad', role: 'compiler', claimedFiles: ['/tmp/bad.ts'], prompt: 'bad' },
    ]));
    expect(blockedDispatch.status).toBe('blocked');
    expect(blockedDispatch.dispatches).toEqual([]);

    const readyPlan = planV3SwarmDispatch(readyTasks);
    const dryRun = await dispatchV3OpenAIAgents(readyPlan);
    expect(dryRun.status).toBe('ready');
    expect(dryRun.mode).toBe('dry-run');
    expect(dryRun.dispatches).toHaveLength(2);
    expect(dryRun.dispatches[0].agentName).toMatch(/^protopulse-v3-/);
  });

  it('creates Codex exec command templates with sandbox and output schema', () => {
    const result = createV3CodexCommandTemplates(planV3SwarmDispatch(readyTasks));

    expect(result.status).toBe('ready');
    expect(result.templates).toHaveLength(2);
    expect(result.templates[0].argv).toEqual(expect.arrayContaining([
      'codex',
      'exec',
      '--sandbox',
      'workspace-write',
      '--output-schema',
      'schemas/codex-swarm-output.schema.json',
    ]));
    expect(result.templates[0].command).toContain('codex exec --sandbox workspace-write');
  });
});
