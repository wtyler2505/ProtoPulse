/**
 * Tests for the 8 canonical parts AI tools (Phase 3).
 *
 * Mocks `partsStorage` and validates that each tool:
 *   - Returns the expected ToolResult shape
 *   - Handles empty results gracefully
 *   - Passes filter/pagination params correctly
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockSearch,
  mockGetById,
  mockGetBySlug,
  mockGetAlternates,
  mockListStockForProject,
} = vi.hoisted(() => ({
  mockSearch: vi.fn(),
  mockGetById: vi.fn(),
  mockGetBySlug: vi.fn(),
  mockGetAlternates: vi.fn(),
  mockListStockForProject: vi.fn(),
}));

vi.mock('../storage', () => ({
  partsStorage: {
    search: mockSearch,
    getById: mockGetById,
    getBySlug: mockGetBySlug,
    getAlternates: mockGetAlternates,
    listStockForProject: mockListStockForProject,
    getLifecycle: vi.fn(),
    getSpiceModel: vi.fn(),
    listSpiceModels: vi.fn(),
    getPlacements: vi.fn(),
  },
  storage: {},
  StorageError: class StorageError extends Error {},
  VersionConflictError: class StorageError extends Error {},
}));

vi.mock('../db', () => ({ db: {}, pool: {}, checkConnection: vi.fn() }));
vi.mock('../parts-ingress', () => ({ mirrorIngressBestEffort: vi.fn() }));
vi.mock('../env', () => ({ featureFlags: { partsCatalogV2: false } }));
vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { ToolRegistry } from '../ai-tools/registry';
import { registerPartsTools } from '../ai-tools/parts';
import type { ToolContext } from '../ai-tools/types';
import type { IStorage } from '../storage';

function createRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registerPartsTools(registry);
  return registry;
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
  datasheetUrl: 'https://example.com/datasheet.pdf',
  manufacturerUrl: null,
  origin: 'library' as const,
  originRef: null,
  forkedFromId: null,
  authorUserId: null,
  isPublic: true,
  trustLevel: 'library' as const,
  version: 1,
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
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

function makeCtx(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    projectId: 10,
    storage: {} as IStorage,
    ...overrides,
  };
}

// ===========================================================================
// search_parts
// ===========================================================================

describe('search_parts', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns success with found parts', async () => {
    mockSearch.mockResolvedValue([SAMPLE_PART]);
    const registry = createRegistry();
    const tool = registry.get('search_parts')!;
    const result = await tool.execute({ text: '10k' }, makeCtx());
    expect(result.success).toBe(true);
    expect(result.message).toContain('1 parts');
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('returns success with empty results', async () => {
    mockSearch.mockResolvedValue([]);
    const registry = createRegistry();
    const tool = registry.get('search_parts')!;
    const result = await tool.execute({ text: 'nonexistent' }, makeCtx());
    expect(result.success).toBe(true);
    expect(result.message).toContain('0 parts');
  });

  it('passes filter and pagination to storage', async () => {
    mockSearch.mockResolvedValue([]);
    const registry = createRegistry();
    const tool = registry.get('search_parts')!;
    await tool.execute({
      text: '10k',
      category: 'resistor',
      minTrustLevel: 'verified',
      limit: 10,
      sortBy: 'title',
      sortDir: 'asc',
    }, makeCtx());
    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({ text: '10k', category: 'resistor', minTrustLevel: 'verified' }),
      expect.objectContaining({ limit: 10, sortBy: 'title', sortDir: 'asc' }),
    );
  });

  it('returns condensed data shape (not full part)', async () => {
    mockSearch.mockResolvedValue([SAMPLE_PART]);
    const registry = createRegistry();
    const tool = registry.get('search_parts')!;
    const result = await tool.execute({}, makeCtx());
    const row = (result.data as Record<string, unknown>[])[0];
    expect(row).toHaveProperty('id');
    expect(row).toHaveProperty('slug');
    expect(row).toHaveProperty('title');
    expect(row).not.toHaveProperty('meta');
    expect(row).not.toHaveProperty('connectors');
  });
});

// ===========================================================================
// get_part
// ===========================================================================

describe('get_part', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('finds part by id', async () => {
    mockGetById.mockResolvedValue(SAMPLE_PART);
    const registry = createRegistry();
    const tool = registry.get('get_part')!;
    const result = await tool.execute({ id: SAMPLE_PART.id }, makeCtx());
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('id', SAMPLE_PART.id);
  });

  it('finds part by slug', async () => {
    mockGetBySlug.mockResolvedValue(SAMPLE_PART);
    const registry = createRegistry();
    const tool = registry.get('get_part')!;
    const result = await tool.execute({ slug: 'res-10k-0402-1pct' }, makeCtx());
    expect(result.success).toBe(true);
  });

  it('returns failure when not found', async () => {
    mockGetById.mockResolvedValue(undefined);
    const registry = createRegistry();
    const tool = registry.get('get_part')!;
    const result = await tool.execute({ id: 'nonexistent' }, makeCtx());
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('returns failure when neither id nor slug provided', async () => {
    const registry = createRegistry();
    const tool = registry.get('get_part')!;
    const result = await tool.execute({}, makeCtx());
    expect(result.success).toBe(false);
  });

  it('returns full part data (including meta)', async () => {
    mockGetById.mockResolvedValue(SAMPLE_PART);
    const registry = createRegistry();
    const tool = registry.get('get_part')!;
    const result = await tool.execute({ id: SAMPLE_PART.id }, makeCtx());
    const data = result.data as Record<string, unknown>;
    expect(data).toHaveProperty('meta');
    expect(data).toHaveProperty('connectors');
  });
});

// ===========================================================================
// get_alternates
// ===========================================================================

describe('get_alternates', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns alternates when found', async () => {
    const alt = { ...SAMPLE_PART, id: 'alt-uuid', slug: 'res-10k-0603-5pct' };
    mockGetAlternates.mockResolvedValue([alt]);
    const registry = createRegistry();
    const tool = registry.get('get_alternates')!;
    const result = await tool.execute({ partId: SAMPLE_PART.id }, makeCtx());
    expect(result.success).toBe(true);
    expect(result.message).toContain('1 alternate');
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('returns empty with a message when no alternates', async () => {
    mockGetAlternates.mockResolvedValue([]);
    const registry = createRegistry();
    const tool = registry.get('get_alternates')!;
    const result = await tool.execute({ partId: SAMPLE_PART.id }, makeCtx());
    expect(result.success).toBe(true);
    expect(result.message).toContain('No alternates');
  });
});

// ===========================================================================
// check_stock
// ===========================================================================

describe('check_stock', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns stock for the project', async () => {
    mockListStockForProject.mockResolvedValue([SAMPLE_STOCK]);
    const registry = createRegistry();
    const tool = registry.get('check_stock')!;
    const result = await tool.execute({}, makeCtx({ projectId: 10 }));
    expect(result.success).toBe(true);
    expect(result.message).toContain('1 stock');
  });

  it('defaults to ctx.projectId when not specified', async () => {
    mockListStockForProject.mockResolvedValue([]);
    const registry = createRegistry();
    const tool = registry.get('check_stock')!;
    await tool.execute({}, makeCtx({ projectId: 42 }));
    expect(mockListStockForProject).toHaveBeenCalledWith(42, expect.anything());
  });

  it('uses explicit projectId over ctx.projectId', async () => {
    mockListStockForProject.mockResolvedValue([]);
    const registry = createRegistry();
    const tool = registry.get('check_stock')!;
    await tool.execute({ projectId: 99 }, makeCtx({ projectId: 42 }));
    expect(mockListStockForProject).toHaveBeenCalledWith(99, expect.anything());
  });
});

// ===========================================================================
// suggest_substitute
// ===========================================================================

describe('suggest_substitute', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns best alternate ranked by trust level', async () => {
    mockGetById.mockResolvedValue(SAMPLE_PART);
    const alt1 = { ...SAMPLE_PART, id: 'alt1', trustLevel: 'community' as const };
    const alt2 = { ...SAMPLE_PART, id: 'alt2', trustLevel: 'verified' as const };
    mockGetAlternates.mockResolvedValue([alt1, alt2]);
    const registry = createRegistry();
    const tool = registry.get('suggest_substitute')!;
    const result = await tool.execute({ partId: SAMPLE_PART.id }, makeCtx());
    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect((data.best as Record<string, unknown>).trustLevel).toBe('verified');
  });

  it('returns helpful message when no alternates', async () => {
    mockGetById.mockResolvedValue(SAMPLE_PART);
    mockGetAlternates.mockResolvedValue([]);
    const registry = createRegistry();
    const tool = registry.get('suggest_substitute')!;
    const result = await tool.execute({ partId: SAMPLE_PART.id }, makeCtx());
    expect(result.success).toBe(true);
    expect(result.message).toContain('No known alternates');
  });

  it('returns failure when part not found', async () => {
    mockGetById.mockResolvedValue(undefined);
    const registry = createRegistry();
    const tool = registry.get('suggest_substitute')!;
    const result = await tool.execute({ partId: 'missing' }, makeCtx());
    expect(result.success).toBe(false);
  });
});

// ===========================================================================
// lookup_datasheet_for_part
// ===========================================================================

describe('lookup_datasheet_for_part', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns datasheet URL when available', async () => {
    mockGetById.mockResolvedValue(SAMPLE_PART);
    const registry = createRegistry();
    const tool = registry.get('lookup_datasheet_for_part')!;
    const result = await tool.execute({ partId: SAMPLE_PART.id }, makeCtx());
    expect(result.success).toBe(true);
    expect(result.message).toContain('example.com/datasheet.pdf');
  });

  it('returns helpful message when no datasheet', async () => {
    mockGetById.mockResolvedValue({ ...SAMPLE_PART, datasheetUrl: null });
    const registry = createRegistry();
    const tool = registry.get('lookup_datasheet_for_part')!;
    const result = await tool.execute({ partId: SAMPLE_PART.id }, makeCtx());
    expect(result.success).toBe(true);
    expect(result.message).toContain('No datasheet');
  });

  it('returns failure when part not found', async () => {
    mockGetById.mockResolvedValue(undefined);
    const registry = createRegistry();
    const tool = registry.get('lookup_datasheet_for_part')!;
    const result = await tool.execute({ partId: 'missing' }, makeCtx());
    expect(result.success).toBe(false);
  });
});

// ===========================================================================
// compare_parts
// ===========================================================================

describe('compare_parts', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns comparison table for 2+ parts', async () => {
    const p1 = { ...SAMPLE_PART, id: 'p1' };
    const p2 = { ...SAMPLE_PART, id: 'p2', title: '4.7kΩ Resistor' };
    mockGetById.mockImplementation(async (id: string) => id === 'p1' ? p1 : id === 'p2' ? p2 : undefined);
    const registry = createRegistry();
    const tool = registry.get('compare_parts')!;
    const result = await tool.execute({ partIds: ['p1', 'p2'] }, makeCtx());
    expect(result.success).toBe(true);
    expect((result.data as unknown[]).length).toBe(2);
  });

  it('returns failure when fewer than 2 parts found', async () => {
    mockGetById.mockImplementation(async (id: string) => id === 'p1' ? SAMPLE_PART : undefined);
    const registry = createRegistry();
    const tool = registry.get('compare_parts')!;
    const result = await tool.execute({ partIds: ['p1', 'missing'] }, makeCtx());
    expect(result.success).toBe(false);
    expect(result.message).toContain('Only 1');
  });
});

// ===========================================================================
// recommend_part_for
// ===========================================================================

describe('recommend_part_for', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns best match from search', async () => {
    mockSearch.mockResolvedValue([SAMPLE_PART]);
    const registry = createRegistry();
    const tool = registry.get('recommend_part_for')!;
    const result = await tool.execute({ description: '10k pull-up resistor' }, makeCtx());
    expect(result.success).toBe(true);
    expect(result.message).toContain('Recommended');
    expect(result.message).toContain(SAMPLE_PART.title);
  });

  it('returns no-match message when catalog is empty', async () => {
    mockSearch.mockResolvedValue([]);
    const registry = createRegistry();
    const tool = registry.get('recommend_part_for')!;
    const result = await tool.execute({ description: 'nonexistent widget' }, makeCtx());
    expect(result.success).toBe(true);
    expect(result.message).toContain('No parts');
  });

  it('passes category hint to search', async () => {
    mockSearch.mockResolvedValue([]);
    const registry = createRegistry();
    const tool = registry.get('recommend_part_for')!;
    await tool.execute({ description: 'connector', category: 'connector' }, makeCtx());
    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'connector' }),
      expect.anything(),
    );
  });
});

// ===========================================================================
// Registration
// ===========================================================================

describe('registration', () => {
  it('registers all 8 tools', () => {
    const registry = createRegistry();
    const expected = [
      'search_parts', 'get_part', 'get_alternates', 'check_stock',
      'suggest_substitute', 'lookup_datasheet_for_part', 'compare_parts', 'recommend_part_for',
    ];
    for (const name of expected) {
      expect(registry.get(name)).toBeDefined();
    }
  });

  it('all tools have read permission tier', () => {
    const registry = createRegistry();
    const all = registry.getAll().filter((t) => [
      'search_parts', 'get_part', 'get_alternates', 'check_stock',
      'suggest_substitute', 'lookup_datasheet_for_part', 'compare_parts', 'recommend_part_for',
    ].includes(t.name));
    for (const tool of all) {
      expect(tool.permissionTier).toBe('read');
    }
  });
});
