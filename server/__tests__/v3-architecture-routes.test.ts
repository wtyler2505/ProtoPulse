import { EventEmitter } from 'node:events';
import express from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerV3ArchitectureRoutes } from '../routes/v3-architecture';

const {
  mockCreateV3CompileRun,
  mockCreateV3InspectionReport,
  mockCreateV3SwarmTask,
  mockCreateV3VerifiedFact,
  mockListV3CompileRuns,
  mockListV3InspectionReports,
  mockListV3SwarmTasks,
  mockListV3VerifiedFacts,
} = vi.hoisted(() => ({
  mockCreateV3CompileRun: vi.fn(),
  mockCreateV3InspectionReport: vi.fn(),
  mockCreateV3SwarmTask: vi.fn(),
  mockCreateV3VerifiedFact: vi.fn(),
  mockListV3CompileRuns: vi.fn(),
  mockListV3InspectionReports: vi.fn(),
  mockListV3SwarmTasks: vi.fn(),
  mockListV3VerifiedFacts: vi.fn(),
}));

vi.mock('../routes/auth-middleware', () => ({
  requireProjectOwnership: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../lib/v3-architecture-storage', () => ({
  createV3CompileRun: mockCreateV3CompileRun,
  createV3InspectionReport: mockCreateV3InspectionReport,
  createV3SwarmTask: mockCreateV3SwarmTask,
  createV3VerifiedFact: mockCreateV3VerifiedFact,
  listV3CompileRuns: mockListV3CompileRuns,
  listV3InspectionReports: mockListV3InspectionReports,
  listV3SwarmTasks: mockListV3SwarmTasks,
  listV3VerifiedFacts: mockListV3VerifiedFacts,
}));

type ExpressWithHandle = express.Express & {
  handle: (req: express.Request, res: express.Response, next: express.NextFunction) => void;
};

let app: ExpressWithHandle;

async function invokeRoute(
  method: string,
  url: string,
  body?: unknown,
): Promise<{ status: number; json: unknown }> {
  const encodedBody = body ? JSON.stringify(body) : '';
  const req = new EventEmitter();
  Object.setPrototypeOf(req, app.request);
  Object.assign(req, {
    app,
    method,
    url,
    originalUrl: url,
    headers: {
      'content-length': Buffer.byteLength(encodedBody).toString(),
      'content-type': 'application/json',
      'x-session-id': 'test-session',
    },
    body,
    connection: {},
    socket: {},
  });

  const res = new EventEmitter();
  Object.setPrototypeOf(res, app.response);
  const chunks: Buffer[] = [];

  return await new Promise((resolve, reject) => {
    Object.assign(res, {
      app,
      req,
      locals: {},
      statusCode: 200,
      setHeader: vi.fn(),
      getHeader: vi.fn(),
      removeHeader: vi.fn(),
      writeHead: (status: number) => {
        (res as express.Response).statusCode = status;
        return res;
      },
      write: (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        return true;
      },
      end: (chunk?: Buffer | string) => {
        if (chunk) {
          (res as express.Response).write(chunk);
        }
        res.emit('finish');
        return res;
      },
    });

    res.once('finish', () => {
      const bodyText = Buffer.concat(chunks).toString('utf8');
      resolve({
        status: (res as express.Response).statusCode,
        json: bodyText.length > 0 ? JSON.parse(bodyText) : null,
      });
    });

    app.handle(req as express.Request, res as express.Response, (err?: unknown) => {
      reject(err instanceof Error ? err : new Error(String(err ?? 'Route fell through')));
    });
  });
}

describe('v3 architecture routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    app = express() as ExpressWithHandle;
    registerV3ArchitectureRoutes(app);
    app.use((err: { status?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(err.status ?? 500).json({ message: err.message ?? 'Internal error' });
    });
  });

  it('stores compile runs with project context', async () => {
    mockCreateV3CompileRun.mockResolvedValue({ id: 1, projectId: 42, status: 'blocked' });

    const res = await invokeRoute('POST', '/api/projects/42/v3-architecture/compile-runs', {
      status: 'blocked',
      acceptedFacts: ['board: 60mm x 40mm'],
      missingFacts: ['Arduino Mega: verified hardware fact'],
      blockedTasks: ['mark metadata verified'],
      emittedTsx: null,
      compileInput: {},
      compileSummary: { traces: 0 },
    });

    expect(res.status).toBe(201);
    expect(mockCreateV3CompileRun).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 42,
      status: 'blocked',
      missingFacts: ['Arduino Mega: verified hardware fact'],
    }));
  });

  it('rejects compile runs with invalid status', async () => {
    const res = await invokeRoute('POST', '/api/projects/42/v3-architecture/compile-runs', {
      status: 'maybe',
    });

    expect(res.status).toBe(400);
    expect(mockCreateV3CompileRun).not.toHaveBeenCalled();
  });

  it('stores visual inspection reports as markdown', async () => {
    mockCreateV3InspectionReport.mockResolvedValue({ id: 7, projectId: 42, mode: 'visual' });

    const res = await invokeRoute('POST', '/api/projects/42/v3-architecture/inspection-reports', {
      mode: 'visual',
      query: 'Check jumper order',
      imageDigest: 'sha256:abc',
      markdown: '## Report\nLooks good.',
      provenance: ['visualHardwareInspectionFlow'],
    });

    expect(res.status).toBe(201);
    expect(mockCreateV3InspectionReport).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 42,
      mode: 'visual',
      markdown: '## Report\nLooks good.',
    }));
  });

  it('lists verified facts for a project', async () => {
    mockListV3VerifiedFacts.mockResolvedValue([{ id: 3, projectId: 42, subject: 'Arduino Mega 2560' }]);

    const res = await invokeRoute('GET', '/api/projects/42/v3-architecture/verified-facts');

    expect(res.status).toBe(200);
    expect(res.json).toEqual({ data: [{ id: 3, projectId: 42, subject: 'Arduino Mega 2560' }], total: 1 });
    expect(mockListV3VerifiedFacts).toHaveBeenCalledWith(42);
  });

  it('stores verified hardware facts', async () => {
    mockCreateV3VerifiedFact.mockResolvedValue({ id: 8, projectId: 42, subject: 'Arduino Mega 2560' });

    const res = await invokeRoute('POST', '/api/projects/42/v3-architecture/verified-facts', {
      sourceType: 'knowledge',
      sourceRef: 'knowledge/hardware-board-arduino-mega-2560-r3.md',
      factType: 'pinout',
      subject: 'Arduino Mega 2560',
      value: { pins: 54 },
      provenance: ['vault:hardware-board-arduino-mega-2560-r3'],
      confidence: 'verified',
    });

    expect(res.status).toBe(201);
    expect(mockCreateV3VerifiedFact).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 42,
      factType: 'pinout',
      subject: 'Arduino Mega 2560',
    }));
  });

  it('stores v3 swarm tasks with command templates', async () => {
    mockCreateV3SwarmTask.mockResolvedValue({ id: 11, projectId: 42, taskId: 'v3-ui-integrator' });

    const res = await invokeRoute('POST', '/api/projects/42/v3-architecture/swarm-tasks', {
      taskId: 'v3-ui-integrator',
      status: 'blocked',
      agentType: 'ui-integrator',
      claimedFiles: ['client/src/components/views/architecture/V3ArchitectureReadinessPanel.tsx'],
      forbiddenFiles: [],
      commandTemplate: 'codex exec --sandbox workspace-write ...',
      result: { blockedReasons: ['compile report must be ready before swarm dispatch'] },
    });

    expect(res.status).toBe(201);
    expect(mockCreateV3SwarmTask).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 42,
      taskId: 'v3-ui-integrator',
      status: 'blocked',
      agentType: 'ui-integrator',
    }));
  });

  it('lists v3 swarm tasks for a project', async () => {
    mockListV3SwarmTasks.mockResolvedValue([{ id: 12, projectId: 42, taskId: 'v3-firmware-writer' }]);

    const res = await invokeRoute('GET', '/api/projects/42/v3-architecture/swarm-tasks');

    expect(res.status).toBe(200);
    expect(res.json).toEqual({ data: [{ id: 12, projectId: 42, taskId: 'v3-firmware-writer' }], total: 1 });
    expect(mockListV3SwarmTasks).toHaveBeenCalledWith(42);
  });
});
