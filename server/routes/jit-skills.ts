import type { Express, Request } from 'express';
import { z } from 'zod';
import { requireProjectOwnership } from './auth-middleware';
import { asyncHandler, HttpError, parseIdParam, payloadLimit } from './utils';

const runJitSkillSchema = z.object({
  command: z.string().trim().min(2).max(120),
});

const ALLOWED_JIT_COMMANDS = new Set<string>([
  '/apply-input-bias-network',
  '/apply-decoupling-pack',
  '/trace-power-rail-isolation',
  '/resolve-net-driver-conflict',
]);

type JitRunStatus = 'queued' | 'completed' | 'failed';

interface JitSkillRunRecord {
  runId: string;
  projectId: number;
  command: string;
  status: JitRunStatus;
  executed: boolean;
  message: string;
  createdAt: number;
  completedAt?: number;
}

const runHistoryByProject = new Map<number, JitSkillRunRecord[]>();
let runCounter = 0;

function nextRunId(): string {
  runCounter += 1;
  return `jit-${String(runCounter)}`;
}

async function executeJitSkillCommand(command: string): Promise<{ status: JitRunStatus; executed: boolean; message: string }> {
  // Phase 1 execution adapter. Real MCP/tool execution can replace this.
  if (command === '/trace-power-rail-isolation') {
    return {
      status: 'failed',
      executed: false,
      message: `JIT skill execution failed: ${command} requires interactive canvas context`,
    };
  }
  return {
    status: 'completed',
    executed: true,
    message: `JIT skill command executed: ${command}`,
  };
}

export function registerJitSkillRoutes(app: Express): void {
  app.get(
    '/api/projects/:id/jit-skills/history',
    requireProjectOwnership,
    asyncHandler(async (req: Request, res) => {
      const projectId = parseIdParam(req.params.id);
      const history = runHistoryByProject.get(projectId) ?? [];
      return res.status(200).json({
        ok: true,
        data: history,
        total: history.length,
      });
    }),
  );

  app.post(
    '/api/projects/:id/jit-skills/run',
    requireProjectOwnership,
    payloadLimit(4 * 1024),
    asyncHandler(async (req: Request, res) => {
      const projectId = parseIdParam(req.params.id);
      const parsed = runJitSkillSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new HttpError('Invalid JIT skill command payload', 400);
      }

      const { command } = parsed.data;
      if (!ALLOWED_JIT_COMMANDS.has(command)) {
        throw new HttpError(`Unsupported JIT skill command: ${command}`, 400);
      }
      const runId = nextRunId();
      const createdAt = Date.now();
      const queuedRecord: JitSkillRunRecord = {
        runId,
        projectId,
        command,
        status: 'queued',
        executed: false,
        message: `JIT skill command accepted: ${command}`,
        createdAt,
      };
      const history = runHistoryByProject.get(projectId) ?? [];
      history.unshift(queuedRecord);
      runHistoryByProject.set(projectId, history.slice(0, 100));

      const execution = await executeJitSkillCommand(command);
      const finalRecord: JitSkillRunRecord = {
        ...queuedRecord,
        status: execution.status,
        executed: execution.executed,
        message: execution.message,
        completedAt: Date.now(),
      };
      const existing = runHistoryByProject.get(projectId) ?? [];
      if (existing.length > 0 && existing[0].runId === runId) {
        existing[0] = finalRecord;
      }
      runHistoryByProject.set(projectId, existing);

      return res.status(200).json({
        ok: true,
        runId,
        projectId,
        command,
        status: execution.status,
        executed: execution.executed,
        message: execution.message,
      });
    }),
  );
}
