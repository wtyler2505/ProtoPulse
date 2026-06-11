import { z } from 'zod';
import type { SwarmDispatchPlan, SwarmTask } from './orchestrator';

export const CodexCommandTemplateSchema = z.object({
  taskId: z.string(),
  command: z.string(),
  argv: z.array(z.string()),
  claimedFiles: z.array(z.string()),
});

export const CodexCommandTemplateResultSchema = z.object({
  status: z.enum(['ready', 'blocked']),
  blockedReasons: z.array(z.string()),
  templates: z.array(CodexCommandTemplateSchema),
});

export type CodexCommandTemplate = z.infer<typeof CodexCommandTemplateSchema>;
export type CodexCommandTemplateResult = z.infer<typeof CodexCommandTemplateResultSchema>;

const OUTPUT_SCHEMA_PATH = 'schemas/codex-swarm-output.schema.json';

export function createCodexCommandTemplates(plan: SwarmDispatchPlan): CodexCommandTemplateResult {
  if (plan.status !== 'ready') {
    return CodexCommandTemplateResultSchema.parse({
      status: 'blocked',
      blockedReasons: plan.blockedReasons,
      templates: [],
    });
  }

  return CodexCommandTemplateResultSchema.parse({
    status: 'ready',
    blockedReasons: [],
    templates: plan.tasks.map(templateForTask),
  });
}

function templateForTask(task: SwarmTask): CodexCommandTemplate {
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
