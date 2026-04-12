/**
 * Tests for POST /api/parts/:id/substitute — one-click part replacement.
 *
 * Covers: validation, authorization, not-found, success, merge info.
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
  mockSubstitutePart,
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
  mockSubstitutePart: vi.fn(),
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
    substitutePart: mockSubstitutePart,
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
  validateSession: vi.fn().mockImplementation((req: Record<string, unknown>, _res: Record<string, unknown>, next: () => void) => {
    req.session = { userId: 1, sessionId: 'test-session' };
    next();
  }),
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

const OLD_PART_ID = '11111111-1111-1111-1111-111111111111';
const NEW_PART_ID = '22222222-2222-2222-2222-222222222222';

function makePart(id: string, title: string) {
  return {
    id,
    slug: title.toLowerCase().replace(/\s+/g, '-'),
    title,
    manufacturer: 'TestCo',
    mpn: `MPN-${title}`,
    canonicalCategory: 'resistor',
    meta: {},
    connectors: [],
    origin: 'library',
    trustLevel: 'verified',
    version: 1,
    updatedAt: new Date(),
    deletedAt: null,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/parts/:id/substitute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsProjectOwner.mockResolvedValue(true);
    mockGetById.mockImplementation((id: string) => {
      if (id === OLD_PART_ID) { return Promise.resolve(makePart(OLD_PART_ID, '10K Resistor')); }
      if (id === NEW_PART_ID) { return Promise.resolve(makePart(NEW_PART_ID, '10K Yageo')); }
      return Promise.resolve(null);
    });
    mockSubstitutePart.mockResolvedValue({ stockMerged: false, placementsUpdated: 3 });
  });

  it('returns 200 on successful substitution', async () => {
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/parts/${OLD_PART_ID}/substitute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ substituteId: NEW_PART_ID, projectId: 1 }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toMatch(/Replaced/);
      expect(body.stockMerged).toBe(false);
      expect(body.placementsUpdated).toBe(3);
      expect(mockSubstitutePart).toHaveBeenCalledWith(1, OLD_PART_ID, NEW_PART_ID);
    } finally {
      close();
    }
  });

  it('returns merged info when stock rows were combined', async () => {
    mockSubstitutePart.mockResolvedValue({ stockMerged: true, placementsUpdated: 0 });
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/parts/${OLD_PART_ID}/substitute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ substituteId: NEW_PART_ID, projectId: 1 }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.stockMerged).toBe(true);
    } finally {
      close();
    }
  });

  it('returns 400 for missing substituteId', async () => {
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/parts/${OLD_PART_ID}/substitute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 1 }),
      });
      expect(res.status).toBe(400);
    } finally {
      close();
    }
  });

  it('returns 400 for invalid UUID substituteId', async () => {
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/parts/${OLD_PART_ID}/substitute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ substituteId: 'not-a-uuid', projectId: 1 }),
      });
      expect(res.status).toBe(400);
    } finally {
      close();
    }
  });

  it('returns 403 when user is not project owner', async () => {
    mockIsProjectOwner.mockResolvedValue(false);
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/parts/${OLD_PART_ID}/substitute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ substituteId: NEW_PART_ID, projectId: 1 }),
      });
      expect(res.status).toBe(403);
    } finally {
      close();
    }
  });

  it('returns 404 when original part not found', async () => {
    mockGetById.mockResolvedValue(null);
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/parts/${OLD_PART_ID}/substitute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ substituteId: NEW_PART_ID, projectId: 1 }),
      });
      expect(res.status).toBe(404);
    } finally {
      close();
    }
  });

  it('returns 404 when substitute part not found', async () => {
    mockGetById.mockImplementation((id: string) => {
      if (id === OLD_PART_ID) { return Promise.resolve(makePart(OLD_PART_ID, '10K Resistor')); }
      return Promise.resolve(null);
    });
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/parts/${OLD_PART_ID}/substitute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ substituteId: NEW_PART_ID, projectId: 1 }),
      });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.message).toMatch(/Substitute/);
    } finally {
      close();
    }
  });
});
