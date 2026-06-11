import { EventEmitter } from 'node:events';
import express from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerHardwareInspectionRoutes } from '../routes/hardware-inspection';

const { mockVisualFlow, mockLayoutFlow } = vi.hoisted(() => ({
  mockVisualFlow: vi.fn(),
  mockLayoutFlow: vi.fn(),
}));

vi.mock('../routes/auth-middleware', () => ({
  requireProjectOwnership: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../genkit', () => ({
  visualHardwareInspectionFlow: mockVisualFlow,
  embodiedLayoutAnalysisFlow: mockLayoutFlow,
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

const imageUrl = 'data:image/png;base64,aGVsbG8=';

describe('hardware inspection routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    app = express() as ExpressWithHandle;
    registerHardwareInspectionRoutes(app);
    app.use((err: { status?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(err.status ?? 500).json({ message: err.message ?? 'Internal error' });
    });
  });

  it('runs visual hardware inspection with project context', async () => {
    mockVisualFlow.mockResolvedValue('## Inspection\nAll clear.');

    const res = await invokeRoute('POST', '/api/projects/42/hardware-inspection/visual', {
      imageUrl,
      query: 'Check wiring',
    });

    expect(res.status).toBe(200);
    expect(res.json).toEqual({ result: '## Inspection\nAll clear.' });
    expect(mockVisualFlow).toHaveBeenCalledWith({
      projectId: 42,
      imageUrl,
      query: 'Check wiring',
    });
  });

  it('rejects visual inspection without an image', async () => {
    const res = await invokeRoute('POST', '/api/projects/42/hardware-inspection/visual', {
      query: 'Check wiring',
    });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.json)).toContain('Image is required');
    expect(mockVisualFlow).not.toHaveBeenCalled();
  });

  it('runs embodied layout analysis with optional image', async () => {
    mockLayoutFlow.mockResolvedValue('Route wires away from the motor.');

    const res = await invokeRoute('POST', '/api/projects/42/hardware-inspection/layout', {
      imageUrl,
      chassisDescription: 'Small acrylic rover chassis',
      query: 'Where should the motor driver go?',
    });

    expect(res.status).toBe(200);
    expect(res.json).toEqual({ result: 'Route wires away from the motor.' });
    expect(mockLayoutFlow).toHaveBeenCalledWith({
      projectId: 42,
      imageUrl,
      chassisDescription: 'Small acrylic rover chassis',
      query: 'Where should the motor driver go?',
    });
  });
});
