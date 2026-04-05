/**
 * Arduino Routes Tests — server/routes/arduino.ts
 *
 * Covers the browser-style cold-start fanout for the Arduino workspace so
 * stale workspace rows and concurrent startup requests do not regress into
 * 500s or split bootstrap state.
 */

import { EventEmitter } from 'node:events';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ArduinoBuildProfile,
  ArduinoJob,
  ArduinoSketchFile,
  ArduinoWorkspace,
} from '@shared/schema';
import { registerArduinoRoutes } from '../routes/arduino';

const {
  mockCreateArduinoWorkspace,
  mockGetArduinoBuildProfiles,
  mockGetArduinoJobs,
  mockGetArduinoSketchFiles,
  mockGetArduinoWorkspace,
  mockGetArduinoWorkspaces,
  mockMkdir,
  mockReaddir,
  mockUpsertArduinoSketchFile,
  mockLoggerWarn,
} = vi.hoisted(() => ({
  mockCreateArduinoWorkspace: vi.fn(),
  mockGetArduinoBuildProfiles: vi.fn(),
  mockGetArduinoJobs: vi.fn(),
  mockGetArduinoSketchFiles: vi.fn(),
  mockGetArduinoWorkspace: vi.fn(),
  mockGetArduinoWorkspaces: vi.fn(),
  mockMkdir: vi.fn(),
  mockReaddir: vi.fn(),
  mockUpsertArduinoSketchFile: vi.fn(),
  mockLoggerWarn: vi.fn(),
}));

vi.mock('../routes/auth-middleware', () => ({
  requireProjectOwnership: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('child_process', () => ({
  spawn: vi.fn(),
  execSync: vi.fn(() => Buffer.from('{"VersionString":"1.3.1"}')),
  execFileSync: vi.fn((_cliPath: string, args: string[]) => {
    if (args[0] === 'core' && args[1] === 'list') {
      return Buffer.from('{"platforms":[]}');
    }
    return Buffer.from('[]');
  }),
}));

vi.mock('fs/promises', () => ({
  default: {
    mkdir: mockMkdir,
    readdir: mockReaddir,
    readFile: vi.fn().mockResolvedValue(''),
    writeFile: vi.fn(),
    stat: vi.fn().mockResolvedValue({ size: 0 }),
    unlink: vi.fn(),
  },
}));

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

type StorageStub = {
  createArduinoWorkspace: typeof mockCreateArduinoWorkspace;
  getArduinoBuildProfiles: typeof mockGetArduinoBuildProfiles;
  getArduinoJobs: typeof mockGetArduinoJobs;
  getArduinoSketchFiles: typeof mockGetArduinoSketchFiles;
  getArduinoWorkspace: typeof mockGetArduinoWorkspace;
  getArduinoWorkspaces: typeof mockGetArduinoWorkspaces;
  upsertArduinoSketchFile: typeof mockUpsertArduinoSketchFile;
};

type ExpressWithHandle = express.Express & {
  handle: (req: express.Request, res: express.Response, next: express.NextFunction) => void;
};

let app: ExpressWithHandle;

async function invokeRoute(
  method: string,
  url: string,
): Promise<{ status: number; json: unknown; headers: Record<string, unknown> }> {
  const req = new EventEmitter();
  Object.setPrototypeOf(req, app.request);
  Object.assign(req, {
    app,
    method,
    url,
    originalUrl: url,
    headers: { 'x-session-id': 'test-session' },
    connection: {},
    socket: {},
  });

  const res = new EventEmitter();
  Object.setPrototypeOf(res, app.response);

  const responseHeaders: Record<string, unknown> = {};
  const chunks: Buffer[] = [];

  return await new Promise((resolve, reject) => {
    Object.assign(res, {
      app,
      req,
      locals: {},
      statusCode: 200,
      setHeader: (key: string, value: unknown) => {
        responseHeaders[String(key).toLowerCase()] = value;
      },
      getHeader: (key: string) => responseHeaders[String(key).toLowerCase()],
      removeHeader: (key: string) => {
        delete responseHeaders[String(key).toLowerCase()];
      },
      writeHead: (status: number, headers?: Record<string, unknown>) => {
        (res as express.Response).statusCode = status;
        if (headers) {
          Object.assign(responseHeaders, headers);
        }
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
        headers: responseHeaders,
      });
    });

    app.handle(req as express.Request, res as express.Response, (err?: unknown) => {
      reject(err instanceof Error ? err : new Error(String(err ?? 'Route fell through')));
    });
  });
}

const ROOT_PATH = `${process.cwd()}/data/sketches/project_21`;

function makeWorkspace(overrides: Partial<ArduinoWorkspace> = {}): ArduinoWorkspace {
  return {
    id: 11,
    projectId: 21,
    rootPath: ROOT_PATH,
    activeSketchPath: null,
    createdAt: new Date('2026-04-01T10:00:00.000Z'),
    updatedAt: new Date('2026-04-01T10:00:00.000Z'),
    ...overrides,
  };
}

let workspaceRecord: ArduinoWorkspace | undefined;

const storage: StorageStub = {
  createArduinoWorkspace: mockCreateArduinoWorkspace,
  getArduinoBuildProfiles: mockGetArduinoBuildProfiles,
  getArduinoJobs: mockGetArduinoJobs,
  getArduinoSketchFiles: mockGetArduinoSketchFiles,
  getArduinoWorkspace: mockGetArduinoWorkspace,
  getArduinoWorkspaces: mockGetArduinoWorkspaces,
  upsertArduinoSketchFile: mockUpsertArduinoSketchFile,
};

beforeAll(async () => {
  app = express() as ExpressWithHandle;
  app.use(express.json({ limit: '1mb' }));
  registerArduinoRoutes(app, storage as never);

  app.use((err: { status?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.status ?? 500).json({ message: err.message ?? 'Internal error' });
  });
});

afterAll(() => undefined);

beforeEach(() => {
  vi.clearAllMocks();
  workspaceRecord = undefined;

  mockMkdir.mockResolvedValue(undefined);
  mockReaddir.mockResolvedValue([]);
  mockGetArduinoWorkspace.mockImplementation(async () => workspaceRecord);
  mockGetArduinoWorkspaces.mockImplementation(async () => (workspaceRecord ? [workspaceRecord] : []));
  mockCreateArduinoWorkspace.mockImplementation(async ({ projectId, rootPath }: { projectId: number; rootPath: string }) => {
    workspaceRecord = makeWorkspace({ projectId, rootPath });
    return workspaceRecord;
  });
  mockGetArduinoSketchFiles.mockResolvedValue([] as ArduinoSketchFile[]);
  mockGetArduinoBuildProfiles.mockResolvedValue([] as ArduinoBuildProfile[]);
  mockGetArduinoJobs.mockResolvedValue([] as ArduinoJob[]);
  mockUpsertArduinoSketchFile.mockResolvedValue(undefined);
});

describe('Arduino cold-start route fanout', () => {
  it('serves the parallel startup endpoints without duplicate workspace bootstrap', async () => {
    const responses = await Promise.all([
      invokeRoute('GET', '/api/projects/21/arduino/workspace'),
      invokeRoute('GET', '/api/projects/21/arduino/workspace'),
      invokeRoute('GET', '/api/projects/21/arduino/files'),
      invokeRoute('GET', '/api/projects/21/arduino/profiles'),
      invokeRoute('GET', '/api/projects/21/arduino/jobs'),
      invokeRoute('GET', '/api/projects/21/arduino/libraries/installed'),
      invokeRoute('GET', '/api/projects/21/arduino/cores/list'),
    ]);

    expect(responses.map((res) => res.status)).toEqual([200, 200, 200, 200, 200, 200, 200]);
    expect(mockCreateArduinoWorkspace).toHaveBeenCalledTimes(1);
    expect(mockMkdir).toHaveBeenCalledWith(ROOT_PATH, { recursive: true });
    expect(mockMkdir.mock.calls.every(([rootPath]) => rootPath === ROOT_PATH)).toBe(true);

    const [workspaceRes, duplicateWorkspaceRes, filesRes, profilesRes, jobsRes, librariesRes, coresRes] = responses;
    expect(workspaceRes.json).toMatchObject({ projectId: 21, rootPath: ROOT_PATH });
    expect(duplicateWorkspaceRes.json).toMatchObject({ projectId: 21, rootPath: ROOT_PATH });
    expect(filesRes.json).toEqual({ data: [], total: 0 });
    expect(profilesRes.json).toEqual({ data: [], total: 0 });
    expect(jobsRes.json).toEqual({ data: [], total: 0 });
    expect(librariesRes.json).toEqual({ data: [] });
    expect(coresRes.json).toEqual({ data: { platforms: [] } });
  });

  it('heals a stale workspace row during route access instead of warning about missing directories', async () => {
    workspaceRecord = makeWorkspace();

    const [workspaceRes, filesRes] = await Promise.all([
      invokeRoute('GET', '/api/projects/21/arduino/workspace'),
      invokeRoute('GET', '/api/projects/21/arduino/files'),
    ]);

    expect(workspaceRes.status).toBe(200);
    expect(filesRes.status).toBe(200);
    expect(mockCreateArduinoWorkspace).not.toHaveBeenCalled();
    expect(mockMkdir).toHaveBeenCalledWith(ROOT_PATH, { recursive: true });
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });
});
