import { z } from 'zod';

const MAX_SWARM_WORKERS = 6;
const SAFE_FILE_ROOTS = [
  'client/src/',
  'server/',
  'shared/',
  'scripts/',
  'migrations/',
  'docs/v3-architecture/',
];
const OUTPUT_SCHEMA_PATH = 'schemas/codex-swarm-output.schema.json';

export const V3SwarmTaskSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['firmware-writer', 'component-generator', 'constraint-checker', 'compiler', 'ui-integrator']),
  claimedFiles: z.array(z.string().min(1)).min(1),
  prompt: z.string().min(1),
  requiresHardwareFacts: z.array(z.string()).default([]),
  verifiedHardwareFacts: z.array(z.string()).default([]),
});

export type V3SwarmTask = z.infer<typeof V3SwarmTaskSchema>;

export interface V3SwarmDispatchPlan {
  status: 'ready' | 'blocked';
  workerCap: number;
  tasks: V3SwarmTask[];
  blockedReasons: string[];
}

export interface V3OpenAIDispatchResult {
  status: 'ready' | 'blocked' | 'dispatched';
  mode: 'dry-run' | 'execute';
  blockedReasons: string[];
  dispatches: Array<{
    taskId: string;
    agentName: string;
    prompt: string;
    claimedFiles: string[];
    output?: string;
  }>;
}

export interface V3CodexCommandTemplate {
  taskId: string;
  command: string;
  argv: string[];
  claimedFiles: string[];
}

export interface V3CodexCommandTemplateResult {
  status: 'ready' | 'blocked';
  blockedReasons: string[];
  templates: V3CodexCommandTemplate[];
}

export function planV3SwarmDispatch(tasks: unknown[]): V3SwarmDispatchPlan {
  const parsedTasks = tasks.map((task) => V3SwarmTaskSchema.parse(task));
  const blockedReasons: string[] = [];

  if (parsedTasks.length > MAX_SWARM_WORKERS) {
    blockedReasons.push(`Too many workers: ${parsedTasks.length}/${MAX_SWARM_WORKERS}`);
  }

  const claimedFiles = new Map<string, string>();
  for (const task of parsedTasks) {
    for (const filePath of task.claimedFiles) {
      if (!isSafeClaimedFile(filePath)) {
        blockedReasons.push(`${task.id} claims unsafe file path: ${filePath}`);
      }

      const owner = claimedFiles.get(filePath);
      if (owner) {
        blockedReasons.push(`${task.id} conflicts with ${owner} on ${filePath}`);
      }
      claimedFiles.set(filePath, task.id);
    }

    for (const fact of task.requiresHardwareFacts) {
      if (!task.verifiedHardwareFacts.includes(fact)) {
        blockedReasons.push(`${task.id} missing verified hardware fact: ${fact}`);
      }
    }
  }

  return {
    status: blockedReasons.length > 0 ? 'blocked' : 'ready',
    workerCap: MAX_SWARM_WORKERS,
    tasks: parsedTasks,
    blockedReasons,
  };
}

export function planV3OpenAIDispatch(plan: V3SwarmDispatchPlan): V3OpenAIDispatchResult {
  if (plan.status !== 'ready') {
    return {
      status: 'blocked',
      mode: 'dry-run',
      blockedReasons: plan.blockedReasons,
      dispatches: [],
    };
  }

  return {
    status: 'ready',
    mode: 'dry-run',
    blockedReasons: [],
    dispatches: plan.tasks.map(toDryRunDispatch),
  };
}

export async function dispatchV3OpenAIAgents(
  plan: V3SwarmDispatchPlan,
  options: { execute?: boolean } = {},
): Promise<V3OpenAIDispatchResult> {
  if (plan.status !== 'ready') {
    const blocked = planV3OpenAIDispatch(plan);
    return options.execute ? { ...blocked, mode: 'execute' } : blocked;
  }

  if (!options.execute) {
    return planV3OpenAIDispatch(plan);
  }

  const { Agent, run } = await import('@openai/agents');
  const dispatches: V3OpenAIDispatchResult['dispatches'] = [];
  for (const task of plan.tasks) {
    const agent = new Agent({
      name: agentName(task),
      instructions: taskInstructions(task),
    });
    const result = await run(agent, task.prompt);
    dispatches.push({
      ...toDryRunDispatch(task),
      output: String(result.finalOutput ?? ''),
    });
  }

  return {
    status: 'dispatched',
    mode: 'execute',
    blockedReasons: [],
    dispatches,
  };
}

export function createV3CodexCommandTemplates(plan: V3SwarmDispatchPlan): V3CodexCommandTemplateResult {
  if (plan.status !== 'ready') {
    return {
      status: 'blocked',
      blockedReasons: plan.blockedReasons,
      templates: [],
    };
  }

  return {
    status: 'ready',
    blockedReasons: [],
    templates: plan.tasks.map(templateForTask),
  };
}

function isSafeClaimedFile(filePath: string): boolean {
  if (filePath.startsWith('/') || filePath.includes('..')) {
    return false;
  }
  return SAFE_FILE_ROOTS.some((root) => filePath.startsWith(root));
}

function toDryRunDispatch(task: V3SwarmTask) {
  return {
    taskId: task.id,
    agentName: agentName(task),
    prompt: task.prompt,
    claimedFiles: task.claimedFiles,
  };
}

function agentName(task: V3SwarmTask): string {
  return `protopulse-v3-${task.role}`;
}

function taskInstructions(task: V3SwarmTask): string {
  return [
    'You are a ProtoPulse v3 implementation agent.',
    `Role: ${task.role}.`,
    `Only work on these claimed files: ${task.claimedFiles.join(', ')}.`,
    'Do not edit outside the claimed files.',
    'Return a short implementation summary and any blocked reason.',
  ].join('\n');
}

function templateForTask(task: V3SwarmTask): V3CodexCommandTemplate {
  const prompt = [
    `Task ID: ${task.id}`,
    `Role: ${task.role}`,
    `Claimed files: ${task.claimedFiles.join(', ')}`,
    '',
    task.prompt,
    '',
    'Stay inside the claimed files. Return JSON that matches the output schema.',
  ].join('\n');
  const argv = [
    'codex',
    'exec',
    '--sandbox',
    'workspace-write',
    '--output-schema',
    OUTPUT_SCHEMA_PATH,
    prompt,
  ];

  return {
    taskId: task.id,
    command: argv.map(shellQuote).join(' '),
    argv,
    claimedFiles: task.claimedFiles,
  };
}

function shellQuote(value: string): string {
  if (/^[a-zA-Z0-9_./:-]+$/.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
