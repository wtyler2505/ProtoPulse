import { z } from 'zod';

const MAX_SWARM_WORKERS = 6;
const SAFE_FILE_ROOTS = [
  'src/components/',
  'src/ai/',
  'src/db/',
  'src/hardware/',
  'scripts/',
  'examples/',
];

export const SwarmTaskSchema = z.object({
  id: z.string(),
  role: z.enum(['firmware-writer', 'component-generator', 'constraint-checker']),
  claimedFiles: z.array(z.string().min(1)).min(1),
  prompt: z.string().min(1),
  requiresHardwareFacts: z.array(z.string()).default([]),
  verifiedHardwareFacts: z.array(z.string()).default([]),
});

export type SwarmTask = z.infer<typeof SwarmTaskSchema>;

export const SwarmDispatchPlanSchema = z.object({
  status: z.enum(['ready', 'blocked']),
  workerCap: z.number(),
  tasks: z.array(SwarmTaskSchema),
  blockedReasons: z.array(z.string()),
});

export type SwarmDispatchPlan = z.infer<typeof SwarmDispatchPlanSchema>;

export function planSwarmDispatch(tasks: unknown[]): SwarmDispatchPlan {
  const parsedTasks = tasks.map((task) => SwarmTaskSchema.parse(task));
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

  return SwarmDispatchPlanSchema.parse({
    status: blockedReasons.length > 0 ? 'blocked' : 'ready',
    workerCap: MAX_SWARM_WORKERS,
    tasks: parsedTasks,
    blockedReasons,
  });
}

function isSafeClaimedFile(filePath: string): boolean {
  if (filePath.startsWith('/') || filePath.includes('..')) {
    return false;
  }
  return SAFE_FILE_ROOTS.some((root) => filePath.startsWith(root));
}
