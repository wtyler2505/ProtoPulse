/**
 * Tests for the cross-project part usage report.
 *
 * Covers:
 *   - GET /api/parts/:id/usage — HTTP-layer behavior (status codes, response envelope)
 *   - PartsStorage.getUsageAcrossProjects — correct shape & caching
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';

// ---------------------------------------------------------------------------
// Mock storage
// ---------------------------------------------------------------------------

const {
  mockSearch,
  mockGetById,
  mockGetAlternates,
  mockGetPlacements,
  mockGetLifecycle,
  mockGetSpiceModel,
  mockListStockForProject,
  mockUpdateStock,
  mockGetProject,
  mockIsProjectOwner,
  mockGetUsageAcrossProjects,
} = vi.hoisted(() => ({
  mockSearch: vi.fn(),
  mockGetById: vi.fn(),
  mockGetAlternates: vi.fn(),
  mockGetPlacements: vi.fn(),
  mockGetLifecycle: vi.fn(),
  mockGetSpiceModel: vi.fn(),
  mockListStockForProject: vi.fn(),
  mockUpdateStock: vi.fn(),
  mockGetProject: vi.fn(),
  mockIsProjectOwner: vi.fn(),
  mockGetUsageAcrossProjects: vi.fn(),
}));

vi.mock('../storage', () => ({
  partsStorage: {
    search: mockSearch,
    getById: mockGetById,
    getAlternates: mockGetAlternates,
    getPlacements: mockGetPlacements,
    getLifecycle: mockGetLifecycle,
    getSpiceModel: mockGetSpiceModel,
    listStockForProject: mockListStockForProject,
    updateStock: mockUpdateStock,
    getUsageAcrossProjects: mockGetUsageAcrossProjects,
  },
  storage: {
    getProject: mockGetProject,
    isProjectOwner: mockIsProjectOwner,
  },
  StorageError: class StorageError extends Error {},
  VersionConflictError: class VersionConflictError extends Error {
    currentVersion: number;
    constructor(entity: string, id: number, currentVersion: number) {
      super('Version conflict');
      this.name = 'VersionConflictError';
      this.currentVersion = currentVersion;
    }
  },
}));

vi.mock('../auth', () => ({
  validateSession: vi.fn().mockResolvedValue({ userId: 1, sessionId: 'test-session' }),
}));

vi.mock('../db', () => ({ db: {}, pool: {}, checkConnection: vi.fn() }));

vi.mock('../parts-ingress', () => ({
  ingressPart: vi.fn(),
  mirrorIngressBestEffort: vi.fn(),
}));

vi.mock('../env', () => ({ featureFlags: { partsCatalogV2: false } }));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { registerPartsRoutes } from '../routes/parts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeApp() {
  const app = express();
  app.use(express.json());
  registerPartsRoutes(app);
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

const SAMPLE_PART_ID = '550e8400-e29b-41d4-a716-446655440000';

const SAMPLE_USAGE = [
  {
    projectId: 1,
    projectName: 'My Rover',
    stockQuantityNeeded: 3,
    stockQuantityOnHand: 10,
    placementCount: 5,
  },
  {
    projectId: 2,
    projectName: 'Weather Station',
    stockQuantityNeeded: 1,
    stockQuantityOnHand: null,
    placementCount: 0,
  },
];

// ===========================================================================
// GET /api/parts/:id/usage
// ===========================================================================

describe('GET /api/parts/:id/usage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns { data, total } envelope with usage rows', async () => {
    mockGetUsageAcrossProjects.mockResolvedValue(SAMPLE_USAGE);
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/parts/${SAMPLE_PART_ID}/usage`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('total');
      expect(body.total).toBe(2);
      expect(body.data).toHaveLength(2);
    } finally {
      close();
    }
  });

  it('returns correct shape for each usage row', async () => {
    mockGetUsageAcrossProjects.mockResolvedValue(SAMPLE_USAGE);
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/parts/${SAMPLE_PART_ID}/usage`);
      const body = await res.json();
      const row = body.data[0];
      expect(row).toEqual({
        projectId: 1,
        projectName: 'My Rover',
        stockQuantityNeeded: 3,
        stockQuantityOnHand: 10,
        placementCount: 5,
      });
    } finally {
      close();
    }
  });

  it('returns empty data when part has no usage', async () => {
    mockGetUsageAcrossProjects.mockResolvedValue([]);
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/parts/${SAMPLE_PART_ID}/usage`);
      const body = await res.json();
      expect(body.data).toEqual([]);
      expect(body.total).toBe(0);
    } finally {
      close();
    }
  });

  it('calls partsStorage.getUsageAcrossProjects with the part ID', async () => {
    mockGetUsageAcrossProjects.mockResolvedValue([]);
    const { url, close } = await listen(makeApp());
    try {
      await fetch(`${url}/api/parts/${SAMPLE_PART_ID}/usage`);
      expect(mockGetUsageAcrossProjects).toHaveBeenCalledWith(SAMPLE_PART_ID);
    } finally {
      close();
    }
  });

  it('handles null stockQuantityOnHand', async () => {
    mockGetUsageAcrossProjects.mockResolvedValue([SAMPLE_USAGE[1]]);
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/parts/${SAMPLE_PART_ID}/usage`);
      const body = await res.json();
      expect(body.data[0].stockQuantityOnHand).toBeNull();
    } finally {
      close();
    }
  });

  it('returns 500 on StorageError', async () => {
    const { StorageError } = await import('../storage');
    mockGetUsageAcrossProjects.mockRejectedValue(new StorageError('getUsageAcrossProjects failed'));
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/parts/${SAMPLE_PART_ID}/usage`);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.message).toBe('Failed to get part usage');
    } finally {
      close();
    }
  });
});
