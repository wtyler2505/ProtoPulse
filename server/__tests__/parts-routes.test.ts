/**
 * Route tests for the canonical parts endpoints (Phase 3).
 *
 * Tests GET /api/parts (search), GET /api/parts/:id, GET /api/parts/:id/alternates,
 * GET /api/parts/:id/placements, GET /api/parts/:id/lifecycle, GET /api/parts/:id/spice,
 * GET /api/projects/:pid/stock, PATCH /api/projects/:pid/stock/:id.
 *
 * Uses mocked `partsStorage` — the real Drizzle queries are tested via storage integration tests.
 * This file validates HTTP-layer behavior: status codes, response envelopes, error handling.
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

const NOW = new Date('2026-04-11T12:00:00Z');

const SAMPLE_PART = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  slug: 'res-10k-0402-1pct',
  title: '10kΩ Resistor 0402 1%',
  description: 'Standard 10kΩ 0402',
  manufacturer: 'Yageo',
  mpn: 'RC0402FR-0710KL',
  canonicalCategory: 'resistor',
  packageType: '0402',
  tolerance: '1%',
  esdSensitive: false,
  assemblyCategory: 'smt',
  meta: {},
  connectors: [],
  datasheetUrl: null,
  manufacturerUrl: null,
  origin: 'library',
  originRef: null,
  forkedFromId: null,
  authorUserId: null,
  isPublic: true,
  trustLevel: 'library',
  version: 1,
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
};

const SAMPLE_PLACEMENT = {
  id: '550e8400-e29b-41d4-a716-446655440020',
  partId: SAMPLE_PART.id,
  surface: 'schematic',
  containerType: 'circuit',
  containerId: 1,
  referenceDesignator: 'R1',
  x: 10,
  y: 20,
  rotation: 0,
  layer: null,
  properties: {},
  createdAt: NOW,
  deletedAt: null,
};

const SAMPLE_LIFECYCLE = {
  id: '550e8400-e29b-41d4-a716-446655440030',
  partId: SAMPLE_PART.id,
  obsoleteDate: null,
  replacementPartId: null,
  notes: 'Active',
  createdAt: NOW,
};

const SAMPLE_SPICE = {
  id: '550e8400-e29b-41d4-a716-446655440040',
  partId: SAMPLE_PART.id,
  filename: '10k_resistor.mod',
  modelText: '.MODEL R10K RES(R=10000)',
  category: 'passive',
  createdAt: NOW,
};

const SAMPLE_STOCK = {
  id: '550e8400-e29b-41d4-a716-446655440050',
  projectId: 10,
  partId: SAMPLE_PART.id,
  quantityNeeded: 5,
  quantityOnHand: 20,
  minimumStock: 5,
  storageLocation: 'Bin A3',
  unitPrice: '0.0023',
  supplier: 'LCSC',
  leadTime: '1 week',
  status: 'In Stock',
  notes: null,
  version: 1,
  updatedAt: NOW,
  deletedAt: null,
};

// ===========================================================================
// GET /api/parts (search)
// ===========================================================================

describe('GET /api/parts', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns { data, total } envelope', async () => {
    mockSearch.mockResolvedValue([SAMPLE_PART]);
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/parts`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('total');
    } finally { close(); }
  });

  it('passes text filter to search', async () => {
    mockSearch.mockResolvedValue([]);
    const { url, close } = await listen(makeApp());
    try {
      await fetch(`${url}/api/parts?text=10k`);
      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({ text: '10k' }),
        expect.anything(),
      );
    } finally { close(); }
  });

  it('passes category filter to search', async () => {
    mockSearch.mockResolvedValue([]);
    const { url, close } = await listen(makeApp());
    try {
      await fetch(`${url}/api/parts?category=resistor`);
      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'resistor' }),
        expect.anything(),
      );
    } finally { close(); }
  });

  it('passes pagination params to search', async () => {
    mockSearch.mockResolvedValue([]);
    const { url, close } = await listen(makeApp());
    try {
      await fetch(`${url}/api/parts?limit=10&offset=20&sortBy=title&sortDir=asc`);
      expect(mockSearch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ limit: 10, offset: 20, sortBy: 'title', sortDir: 'asc' }),
      );
    } finally { close(); }
  });

  it('splits comma-separated tags into array', async () => {
    mockSearch.mockResolvedValue([]);
    const { url, close } = await listen(makeApp());
    try {
      await fetch(`${url}/api/parts?tags=smd,passive`);
      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({ tags: ['smd', 'passive'] }),
        expect.anything(),
      );
    } finally { close(); }
  });

  it('passes minTrustLevel to search', async () => {
    mockSearch.mockResolvedValue([]);
    const { url, close } = await listen(makeApp());
    try {
      await fetch(`${url}/api/parts?minTrustLevel=verified`);
      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({ minTrustLevel: 'verified' }),
        expect.anything(),
      );
    } finally { close(); }
  });

  it('returns empty data for no matches', async () => {
    mockSearch.mockResolvedValue([]);
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/parts?text=nonexistent`);
      const body = await res.json();
      expect(body.data).toEqual([]);
      expect(body.total).toBe(0);
    } finally { close(); }
  });
});

// ===========================================================================
// GET /api/parts/:id
// ===========================================================================

describe('GET /api/parts/:id', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns a part with ETag', async () => {
    mockGetById.mockResolvedValue(SAMPLE_PART);
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/parts/${SAMPLE_PART.id}`);
      expect(res.status).toBe(200);
      expect(res.headers.get('etag')).toBe('"1"');
      const body = await res.json();
      expect(body.id).toBe(SAMPLE_PART.id);
    } finally { close(); }
  });

  it('returns 404 for unknown id', async () => {
    mockGetById.mockResolvedValue(undefined);
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/parts/nonexistent`);
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toHaveProperty('message');
    } finally { close(); }
  });
});

// ===========================================================================
// GET /api/parts/:id/alternates
// ===========================================================================

describe('GET /api/parts/:id/alternates', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns { data, total } envelope with alternate parts', async () => {
    const alt = { ...SAMPLE_PART, id: 'alt-uuid', slug: 'res-10k-0603-5pct' };
    mockGetAlternates.mockResolvedValue([alt]);
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/parts/${SAMPLE_PART.id}/alternates`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.total).toBe(1);
    } finally { close(); }
  });

  it('returns empty for part with no alternates', async () => {
    mockGetAlternates.mockResolvedValue([]);
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/parts/${SAMPLE_PART.id}/alternates`);
      const body = await res.json();
      expect(body.data).toEqual([]);
      expect(body.total).toBe(0);
    } finally { close(); }
  });
});

// ===========================================================================
// GET /api/parts/:id/placements
// ===========================================================================

describe('GET /api/parts/:id/placements', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns { data, total } with placement rows', async () => {
    mockGetPlacements.mockResolvedValue([SAMPLE_PLACEMENT]);
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/parts/${SAMPLE_PART.id}/placements`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].referenceDesignator).toBe('R1');
    } finally { close(); }
  });

  it('returns empty for part with no placements', async () => {
    mockGetPlacements.mockResolvedValue([]);
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/parts/${SAMPLE_PART.id}/placements`);
      const body = await res.json();
      expect(body.data).toEqual([]);
    } finally { close(); }
  });
});

// ===========================================================================
// GET /api/parts/:id/lifecycle
// ===========================================================================

describe('GET /api/parts/:id/lifecycle', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns lifecycle record', async () => {
    mockGetLifecycle.mockResolvedValue(SAMPLE_LIFECYCLE);
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/parts/${SAMPLE_PART.id}/lifecycle`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.notes).toBe('Active');
    } finally { close(); }
  });

  it('returns 404 when no lifecycle exists', async () => {
    mockGetLifecycle.mockResolvedValue(undefined);
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/parts/${SAMPLE_PART.id}/lifecycle`);
      expect(res.status).toBe(404);
    } finally { close(); }
  });
});

// ===========================================================================
// GET /api/parts/:id/spice
// ===========================================================================

describe('GET /api/parts/:id/spice', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns SPICE model', async () => {
    mockGetSpiceModel.mockResolvedValue(SAMPLE_SPICE);
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/parts/${SAMPLE_PART.id}/spice`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.filename).toBe('10k_resistor.mod');
    } finally { close(); }
  });

  it('returns 404 when no SPICE model exists', async () => {
    mockGetSpiceModel.mockResolvedValue(undefined);
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/parts/${SAMPLE_PART.id}/spice`);
      expect(res.status).toBe(404);
    } finally { close(); }
  });
});

// ===========================================================================
// GET /api/projects/:pid/stock
// ===========================================================================

describe('GET /api/projects/:pid/stock', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns { data, total } with stock rows (authenticated)', async () => {
    mockListStockForProject.mockResolvedValue([SAMPLE_STOCK]);
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/projects/10/stock`, {
        headers: { 'X-Session-Id': 'test-session' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
    } finally { close(); }
  });

  it('returns 401 without session', async () => {
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/projects/10/stock`);
      expect(res.status).toBe(401);
    } finally { close(); }
  });

  it('accepts pagination query params', async () => {
    mockListStockForProject.mockResolvedValue([]);
    const { url, close } = await listen(makeApp());
    try {
      await fetch(`${url}/api/projects/10/stock?limit=10&offset=5&sort=asc`, {
        headers: { 'X-Session-Id': 'test-session' },
      });
      expect(mockListStockForProject).toHaveBeenCalledWith(
        10,
        expect.objectContaining({ limit: 10, offset: 5, sort: 'asc' }),
      );
    } finally { close(); }
  });

  it('returns 400 for invalid project ID', async () => {
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/projects/abc/stock`, {
        headers: { 'X-Session-Id': 'test-session' },
      });
      expect(res.status).toBe(400);
    } finally { close(); }
  });
});

// ===========================================================================
// PATCH /api/projects/:pid/stock/:id
// ===========================================================================

describe('PATCH /api/projects/:pid/stock/:id', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates stock row and returns it with ETag', async () => {
    const updated = { ...SAMPLE_STOCK, quantityNeeded: 10, version: 2 };
    mockUpdateStock.mockResolvedValue(updated);
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/projects/10/stock/${SAMPLE_STOCK.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Session-Id': 'test-session' },
        body: JSON.stringify({ quantityNeeded: 10 }),
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('etag')).toBe('"2"');
      const body = await res.json();
      expect(body.quantityNeeded).toBe(10);
    } finally { close(); }
  });

  it('returns 404 when stock row not found', async () => {
    mockUpdateStock.mockResolvedValue(undefined);
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/projects/10/stock/nonexistent`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Session-Id': 'test-session' },
        body: JSON.stringify({ quantityNeeded: 5 }),
      });
      expect(res.status).toBe(404);
    } finally { close(); }
  });

  it('returns 401 without session', async () => {
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/projects/10/stock/${SAMPLE_STOCK.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantityNeeded: 5 }),
      });
      expect(res.status).toBe(401);
    } finally { close(); }
  });

  it('validates status enum', async () => {
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/projects/10/stock/${SAMPLE_STOCK.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Session-Id': 'test-session' },
        body: JSON.stringify({ status: 'INVALID' }),
      });
      expect(res.status).toBe(400);
    } finally { close(); }
  });

  it('accepts all valid status values', async () => {
    for (const status of ['In Stock', 'Low Stock', 'Out of Stock', 'On Order']) {
      mockUpdateStock.mockResolvedValue({ ...SAMPLE_STOCK, status, version: 2 });
      const { url, close } = await listen(makeApp());
      try {
        const res = await fetch(`${url}/api/projects/10/stock/${SAMPLE_STOCK.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-Session-Id': 'test-session' },
          body: JSON.stringify({ status }),
        });
        expect(res.status).toBe(200);
      } finally { close(); }
    }
  });

  it('rejects negative quantityOnHand', async () => {
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/projects/10/stock/${SAMPLE_STOCK.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Session-Id': 'test-session' },
        body: JSON.stringify({ quantityOnHand: -5 }),
      });
      expect(res.status).toBe(400);
    } finally { close(); }
  });
});

// ===========================================================================
// Response shape consistency
// ===========================================================================

describe('Response shape consistency', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('search returns canonical PartRow fields', async () => {
    mockSearch.mockResolvedValue([SAMPLE_PART]);
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/parts`);
      const body = await res.json();
      const row = body.data[0];
      expect(row).toHaveProperty('id');
      expect(row).toHaveProperty('slug');
      expect(row).toHaveProperty('title');
      expect(row).toHaveProperty('canonicalCategory');
      expect(row).toHaveProperty('trustLevel');
      expect(row).toHaveProperty('origin');
      expect(row).toHaveProperty('version');
    } finally { close(); }
  });

  it('single part returns all fields from canonical shape', async () => {
    mockGetById.mockResolvedValue(SAMPLE_PART);
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/parts/${SAMPLE_PART.id}`);
      const body = await res.json();
      const requiredFields = [
        'id', 'slug', 'title', 'manufacturer', 'mpn', 'canonicalCategory',
        'trustLevel', 'origin', 'version', 'meta', 'connectors',
      ];
      for (const field of requiredFields) {
        expect(body).toHaveProperty(field);
      }
    } finally { close(); }
  });

  it('stock rows contain expected fields', async () => {
    mockListStockForProject.mockResolvedValue([SAMPLE_STOCK]);
    const { url, close } = await listen(makeApp());
    try {
      const res = await fetch(`${url}/api/projects/10/stock`, {
        headers: { 'X-Session-Id': 'test-session' },
      });
      const body = await res.json();
      const row = body.data[0];
      const requiredFields = ['id', 'projectId', 'partId', 'quantityNeeded', 'status', 'version'];
      for (const field of requiredFields) {
        expect(row).toHaveProperty(field);
      }
    } finally { close(); }
  });
});
