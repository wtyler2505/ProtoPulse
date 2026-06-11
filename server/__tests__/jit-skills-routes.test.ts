import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import { registerJitSkillRoutes } from '../routes/jit-skills';

vi.mock('../routes/auth-middleware', () => ({
  requireProjectOwnership: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.userId = 1;
    next();
  },
}));

function makeApp() {
  const app = express();
  app.use(express.json());
  registerJitSkillRoutes(app);
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = typeof err === 'object' && err && 'status' in err ? Number((err as { status?: number }).status) : 500;
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    res.status(Number.isFinite(status) ? status : 500).json({ message });
  });
  return app;
}

async function listen(app: ReturnType<typeof express>) {
  return new Promise<{ url: string; close: () => void }>((resolve) => {
    const server = app.listen(0, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({ url: `http://127.0.0.1:${port}`, close: () => server.close() });
    });
  });
}

describe('POST /api/projects/:id/jit-skills/run', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts allowlisted command and returns completed status with run id', async () => {
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/projects/7/jit-skills/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: '/resolve-net-driver-conflict' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json() as {
        ok: boolean;
        runId: string;
        command: string;
        status: string;
        executed: boolean;
        projectId: number;
      };
      expect(body.ok).toBe(true);
      expect(body.runId).toMatch(/^jit-/);
      expect(body.projectId).toBe(7);
      expect(body.command).toBe('/resolve-net-driver-conflict');
      expect(body.status).toBe('completed');
      expect(body.executed).toBe(true);
    } finally {
      close();
    }
  });

  it('rejects unsupported command with 400', async () => {
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/projects/7/jit-skills/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: '/format-disk-now' }),
      });

      expect(res.status).toBe(400);
      const body = await res.json() as { message: string };
      expect(body.message).toContain('Unsupported JIT skill command');
    } finally {
      close();
    }
  });

  it('rejects missing command payload with 400', async () => {
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/projects/7/jit-skills/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const body = await res.json() as { message: string };
      expect(body.message).toContain('Invalid JIT skill command payload');
    } finally {
      close();
    }
  });

  it('records history per project and exposes it from history endpoint', async () => {
    const { url, close } = await listen(makeApp());
    try {
      await fetch(`${url}/api/projects/7/jit-skills/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: '/apply-input-bias-network' }),
      });

      const res = await fetch(`${url}/api/projects/7/jit-skills/history`);
      expect(res.status).toBe(200);
      const body = await res.json() as {
        ok: boolean;
        total: number;
        data: Array<{ runId: string; command: string; status: string; executed: boolean }>;
      };
      expect(body.ok).toBe(true);
      expect(body.total).toBeGreaterThan(0);
      expect(body.data[0]?.runId).toMatch(/^jit-/);
      expect(body.data[0]?.command).toBe('/apply-input-bias-network');
      expect(body.data[0]?.status).toBe('completed');
      expect(body.data[0]?.executed).toBe(true);
    } finally {
      close();
    }
  });

  it('returns failed status for commands requiring interactive context', async () => {
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/projects/7/jit-skills/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: '/trace-power-rail-isolation' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json() as {
        status: string;
        executed: boolean;
        message: string;
      };
      expect(body.status).toBe('failed');
      expect(body.executed).toBe(false);
      expect(body.message).toContain('requires interactive canvas context');
    } finally {
      close();
    }
  });
});
