import { z } from 'zod';
import type { SwarmDispatchPlan, SwarmTask } from './orchestrator';

export const OpenAIAgentDispatchResultSchema = z.object({
  status: z.enum(['ready', 'blocked', 'dispatched']),
  mode: z.enum(['dry-run', 'execute']),
  blockedReasons: z.array(z.string()),
  dispatches: z.array(z.object({
    taskId: z.string(),
    agentName: z.string(),
    prompt: z.string(),
    claimedFiles: z.array(z.string()),
    output: z.string().optional(),
  })),
});

export type OpenAIAgentDispatchResult = z.infer<typeof OpenAIAgentDispatchResultSchema>;

export function planOpenAIAgentDispatch(plan: SwarmDispatchPlan): OpenAIAgentDispatchResult {
  if (plan.status !== 'ready') {
    return OpenAIAgentDispatchResultSchema.parse({
      status: 'blocked',
      mode: 'dry-run',
      blockedReasons: plan.blockedReasons,
      dispatches: [],
    });
  }

  return OpenAIAgentDispatchResultSchema.parse({
    status: 'ready',
    mode: 'dry-run',
    blockedReasons: [],
    dispatches: plan.tasks.map(toDryRunDispatch),
  });
}

export async function dispatchOpenAIAgents(
  plan: SwarmDispatchPlan,
  options: { execute?: boolean } = {},
): Promise<OpenAIAgentDispatchResult> {
  if (plan.status !== 'ready') {
    const blockedPlan = planOpenAIAgentDispatch(plan);
    return options.execute ? { ...blockedPlan, mode: 'execute' } : blockedPlan;
  }

  if (!options.execute) {
    return planOpenAIAgentDispatch(plan);
  }

  const { Agent, run } = await import('@openai/agents');
  const dispatches = [];

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

  return OpenAIAgentDispatchResultSchema.parse({
    status: 'dispatched',
    mode: 'execute',
    blockedReasons: [],
    dispatches,
  });
}

function toDryRunDispatch(task: SwarmTask) {
  return {
    taskId: task.id,
    agentName: agentName(task),
    prompt: task.prompt,
    claimedFiles: task.claimedFiles,
  };
}

function agentName(task: SwarmTask): string {
  return `protopulse-v3-${task.role}`;
}

function taskInstructions(task: SwarmTask): string {
  return [
    'You are a ProtoPulse v3 implementation agent.',
    `Role: ${task.role}.`,
    `Only work on these claimed files: ${task.claimedFiles.join(', ')}.`,
    'Do not edit outside the claimed files.',
    'Return a short implementation summary and any blocked reason.',
  ].join('\n');
}
