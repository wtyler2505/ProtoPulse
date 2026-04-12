/**
 * Tests for supply chain monitoring routes (Phase 7.5).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';

// ---------------------------------------------------------------------------
// Mock storage & dependencies
// ---------------------------------------------------------------------------

const {
  mockGetAlerts,
  mockGetUnacknowledgedCount,
  mockAcknowledgeAlert,
  mockAcknowledgeAll,
  mockSubmit,
} = vi.hoisted(() => ({
  mockGetAlerts: vi.fn(),
  mockGetUnacknowledgedCount: vi.fn(),
  mockAcknowledgeAlert: vi.fn(),
  mockAcknowledgeAll: vi.fn(),
  mockSubmit: vi.fn().mockResolvedValue('job-123'),
}));

vi.mock('../storage', () => ({
  supplyChainStorage: {
    getAlerts: mockGetAlerts,
    getUnacknowledgedCount: mockGetUnacknowledgedCount,
    acknowledgeAlert: mockAcknowledgeAlert,
    acknowledgeAll: mockAcknowledgeAll,
  },
  StorageError: class StorageError extends Error {},
}));

vi.mock('../auth', () => ({
  validateSession: vi.fn().mockImplementation((req: Record<string, unknown>, _res: Record<string, unknown>, next: () => void) => {
    req.session = { userId: 1, sessionId: 'test-session' };
    next();
  }),
}));

const mockSubmit = vi.fn().mockResolvedValue('job-123');
vi.mock('../job-queue', () => ({
  jobQueue: { submit: mockSubmit },
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { registerSupplyChainRoutes } from '../routes/supply-chain';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeApp() {
  const app = express();
  app.use(express.json());
  registerSupplyChainRoutes(app);
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

const SAMPLE_ALERT = {
  id: 'alert-1',
  partId: 'part-1',
  projectId: 1,
  alertType: 'obsolete',
  severity: 'critical',
  message: 'ATmega328P is OBSOLETE',
  previousValue: null,
  currentValue: 'obsolete',
  supplier: 'Digi-Key',
  acknowledged: false,
  acknowledgedAt: null,
  createdAt: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Supply Chain Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAlerts.mockResolvedValue({ data: [SAMPLE_ALERT], total: 1 });
    mockGetUnacknowledgedCount.mockResolvedValue(1);
    mockAcknowledgeAlert.mockResolvedValue(true);
    mockAcknowledgeAll.mockResolvedValue(3);
  });

  it('GET /api/supply-chain/alerts returns alerts', async () => {
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/supply-chain/alerts`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.total).toBe(1);
    } finally {
      close();
    }
  });

  it('GET /api/supply-chain/alerts/count returns count', async () => {
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/supply-chain/alerts/count`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.count).toBe(1);
    } finally {
      close();
    }
  });

  it('POST /api/supply-chain/alerts/:id/ack acknowledges alert', async () => {
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/supply-chain/alerts/alert-1/ack`, { method: 'POST' });
      expect(res.status).toBe(200);
      expect(mockAcknowledgeAlert).toHaveBeenCalledWith('alert-1');
    } finally {
      close();
    }
  });

  it('POST /api/supply-chain/alerts/:id/ack returns 404 for unknown alert', async () => {
    mockAcknowledgeAlert.mockResolvedValue(false);
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/supply-chain/alerts/unknown/ack`, { method: 'POST' });
      expect(res.status).toBe(404);
    } finally {
      close();
    }
  });

  it('POST /api/supply-chain/alerts/ack-all acknowledges all alerts', async () => {
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/supply-chain/alerts/ack-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 1 }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.acknowledged).toBe(3);
    } finally {
      close();
    }
  });

  it('POST /api/supply-chain/check triggers a job', async () => {
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/supply-chain/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 1 }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.jobId).toBe('job-123');
      expect(mockSubmit).toHaveBeenCalledWith(
        'supply_chain_check',
        expect.objectContaining({ projectId: 1 }),
        expect.any(Object),
      );
    } finally {
      close();
    }
  });

  it('POST /api/supply-chain/check returns 400 without projectId', async () => {
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/supply-chain/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    } finally {
      close();
    }
  });
});
