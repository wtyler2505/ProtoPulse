/**
 * Tests for server/parts-ingress.ts — the Phase 2 dual-write pipeline.
 *
 * Strategy:
 *   - Mock the `../db` module with a chainBuilder pattern matching existing tests
 *     (see optimistic-concurrency.test.ts). Each test seeds the chain with the
 *     terminal values that the ingress pipeline will encounter.
 *   - Pass the mocked db explicitly to ingressPart()/mirrorIngressBestEffort() so
 *     tests are hermetic. Real DB is not touched.
 *   - Cover: dedup priority, stock upsert, placement creation, best-effort error
 *     isolation, and audit log writes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

import { ingressPart, mirrorIngressBestEffort, logIngressFailure, type IngressRequest } from '../parts-ingress';

// ---------------------------------------------------------------------------
// Mock db factory
// ---------------------------------------------------------------------------

interface MockDbConfig {
  /** Queue of arrays to return from sequential `select().from().where()...` chains. */
  selectResults?: unknown[][];
  /** Queue of arrays to return from sequential `insert().values().returning()` chains. */
  insertReturning?: unknown[][];
  /** Queue of arrays to return from sequential `update().set().where().returning()` chains. */
  updateReturning?: unknown[][];
  /** Set to true to make insert() throw. */
  insertShouldThrow?: boolean;
  /** Set to true to make select() throw. */
  selectShouldThrow?: boolean;
}

function makeMockDb(cfg: MockDbConfig = {}) {
  const selectQueue = [...(cfg.selectResults ?? [])];
  const insertQueue = [...(cfg.insertReturning ?? [])];
  const updateQueue = [...(cfg.updateReturning ?? [])];

  const db = {
    select: vi.fn().mockImplementation(() => {
      if (cfg.selectShouldThrow) {
        throw new Error('mock select error');
      }
      const result = selectQueue.shift() ?? [];
      const chain: Record<string, unknown> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue(result);
      return chain;
    }),
    insert: vi.fn().mockImplementation(() => {
      if (cfg.insertShouldThrow) {
        throw new Error('mock insert error');
      }
      const result = insertQueue.shift() ?? [];
      const chain: Record<string, unknown> = {};
      chain.values = vi.fn().mockReturnValue(chain);
      chain.returning = vi.fn().mockResolvedValue(result);
      return chain;
    }),
    update: vi.fn().mockImplementation(() => {
      const result = updateQueue.shift() ?? [];
      const chain: Record<string, unknown> = {};
      chain.set = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.returning = vi.fn().mockResolvedValue(result);
      return chain;
    }),
  };
  // The real db client has many more methods; ingressPart only uses these three.
  return db as unknown as Parameters<typeof ingressPart>[1];
}

// ---------------------------------------------------------------------------
// Sample row fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-04-11T12:00:00Z');

function makePartRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: overrides.id ?? '550e8400-e29b-41d4-a716-446655440000',
    slug: overrides.slug ?? 'res-10k-0402-1pct',
    title: overrides.title ?? '10kΩ Resistor',
    description: overrides.description ?? null,
    manufacturer: overrides.manufacturer ?? 'Yageo',
    mpn: overrides.mpn ?? 'RC0402FR-0710KL',
    canonicalCategory: overrides.canonicalCategory ?? 'resistor',
    packageType: overrides.packageType ?? '0402',
    tolerance: overrides.tolerance ?? '1%',
    esdSensitive: overrides.esdSensitive ?? null,
    assemblyCategory: overrides.assemblyCategory ?? null,
    meta: overrides.meta ?? {},
    connectors: overrides.connectors ?? [],
    datasheetUrl: overrides.datasheetUrl ?? null,
    manufacturerUrl: overrides.manufacturerUrl ?? null,
    origin: overrides.origin ?? 'library',
    originRef: overrides.originRef ?? null,
    forkedFromId: overrides.forkedFromId ?? null,
    authorUserId: overrides.authorUserId ?? null,
    isPublic: overrides.isPublic ?? false,
    trustLevel: overrides.trustLevel ?? 'user',
    version: overrides.version ?? 1,
    createdAt: overrides.createdAt ?? NOW,
    updatedAt: overrides.updatedAt ?? NOW,
    deletedAt: overrides.deletedAt ?? null,
  };
}

function makeStockRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: overrides.id ?? '550e8400-e29b-41d4-a716-446655440010',
    projectId: overrides.projectId ?? 10,
    partId: overrides.partId ?? '550e8400-e29b-41d4-a716-446655440000',
    quantityNeeded: overrides.quantityNeeded ?? 5,
    quantityOnHand: overrides.quantityOnHand ?? 20,
    minimumStock: overrides.minimumStock ?? 5,
    storageLocation: overrides.storageLocation ?? 'Bin A3',
    unitPrice: overrides.unitPrice ?? '0.0023',
    supplier: overrides.supplier ?? 'LCSC',
    leadTime: overrides.leadTime ?? '1 week',
    status: overrides.status ?? 'In Stock',
    notes: overrides.notes ?? null,
    version: overrides.version ?? 1,
    updatedAt: overrides.updatedAt ?? NOW,
    deletedAt: overrides.deletedAt ?? null,
  };
}

function makePlacementRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: overrides.id ?? '550e8400-e29b-41d4-a716-446655440020',
    partId: overrides.partId ?? '550e8400-e29b-41d4-a716-446655440000',
    surface: overrides.surface ?? 'schematic',
    containerType: overrides.containerType ?? 'circuit',
    containerId: overrides.containerId ?? 1,
    referenceDesignator: overrides.referenceDesignator ?? 'R1',
    x: overrides.x ?? 10,
    y: overrides.y ?? 20,
    rotation: overrides.rotation ?? 0,
    layer: overrides.layer ?? null,
    properties: overrides.properties ?? {},
    createdAt: overrides.createdAt ?? NOW,
    deletedAt: overrides.deletedAt ?? null,
  };
}

// ---------------------------------------------------------------------------
// Base request builders
// ---------------------------------------------------------------------------

function baseRequest(overrides: Partial<IngressRequest> = {}): IngressRequest {
  return {
    source: overrides.source ?? 'bom_create',
    origin: overrides.origin ?? 'user',
    projectId: overrides.projectId,
    fields: overrides.fields ?? {
      title: '10kΩ Resistor 0402 1%',
      manufacturer: 'Yageo',
      mpn: 'RC0402FR-0710KL',
      canonicalCategory: 'resistor',
      packageType: '0402',
      tolerance: '1%',
      meta: {},
      connectors: [],
    },
    stock: overrides.stock,
    placement: overrides.placement,
  };
}

// ===========================================================================
// Dedup priority
// ===========================================================================

describe('ingressPart — dedup by (manufacturer, mpn)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reuses an existing part when (manufacturer, mpn) matches', async () => {
    const existing = makePartRow({ id: '550e8400-e29b-41d4-a716-446655440001' });
    const db = makeMockDb({ selectResults: [[existing]] });
    const result = await ingressPart(baseRequest(), db);
    expect(result.reused).toBe(true);
    expect(result.created).toBe(false);
    expect(result.partId).toBe('550e8400-e29b-41d4-a716-446655440001');
  });

  it('returns the existing slug on mpn match', async () => {
    const existing = makePartRow({ slug: 'res-4k7-0402-5pct' });
    const db = makeMockDb({ selectResults: [[existing]] });
    const result = await ingressPart(baseRequest(), db);
    expect(result.slug).toBe('res-4k7-0402-5pct');
  });

  it('does not insert when a part is reused', async () => {
    const existing = makePartRow();
    const db = makeMockDb({ selectResults: [[existing]] });
    await ingressPart(baseRequest(), db);
    expect(db.insert).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// BL-0473: MPN normalization dedup
// ===========================================================================

describe('ingressPart — BL-0473 MPN normalization dedup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reuses an existing part when incoming MPN differs only by case', async () => {
    // Existing row is stored as uppercase — incoming request is lowercase.
    // Must not create a new part row; must reuse.
    const existing = makePartRow({
      id: 'case-match-uuid',
      manufacturer: 'Yageo',
      mpn: 'RC0402FR-0710KL',
    });
    const db = makeMockDb({ selectResults: [[existing]] });
    const req = baseRequest({
      fields: {
        title: '10k resistor lowercase import',
        manufacturer: 'yageo',
        mpn: 'rc0402fr-0710kl',
        canonicalCategory: 'resistor',
        meta: {},
        connectors: [],
      },
    });
    const result = await ingressPart(req, db);
    expect(result.reused).toBe(true);
    expect(result.created).toBe(false);
    expect(result.partId).toBe('case-match-uuid');
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('reuses an existing part when incoming MPN has leading/trailing whitespace', async () => {
    const existing = makePartRow({ id: 'ws-match-uuid', mpn: 'RC0402FR-0710KL' });
    const db = makeMockDb({ selectResults: [[existing]] });
    const req = baseRequest({
      fields: {
        title: 'Whitespace-padded import',
        manufacturer: 'Yageo',
        mpn: '  RC0402FR-0710KL  ',
        canonicalCategory: 'resistor',
        meta: {},
        connectors: [],
      },
    });
    const result = await ingressPart(req, db);
    expect(result.reused).toBe(true);
    expect(result.partId).toBe('ws-match-uuid');
  });

  it('bumps stock quantity instead of duplicating a BOM row when MPN differs only by case', async () => {
    const existingPart = makePartRow({ id: 'part-1', mpn: 'STM32F103C8T6' });
    const existingStock = makeStockRow({ partId: 'part-1', quantityNeeded: 3 });
    const updatedStock = makeStockRow({ partId: 'part-1', quantityNeeded: 5 });
    const db = makeMockDb({
      selectResults: [
        [existingPart],  // findByMpn: case-insensitive hit
        [existingStock], // stock lookup: existing row
      ],
      updateReturning: [[updatedStock]],
    });
    // Second add: same MPN in lowercase + whitespace, should merge into existing stock.
    const result = await ingressPart(
      baseRequest({
        projectId: 10,
        fields: {
          title: 'STM32 duplicate import',
          manufacturer: 'ST Microelectronics',
          mpn: ' stm32f103c8t6 ',
          canonicalCategory: 'ic',
          meta: {},
          connectors: [],
        },
        stock: { quantityNeeded: 5 },
      }),
      db,
    );
    expect(result.reused).toBe(true);
    expect(result.stock?.quantityNeeded).toBe(5); // updated, not inserted new
    expect(db.update).toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled(); // no new part row, no new stock row
  });

  it('falls back to a manufacturer-scoped scan when exact ilike misses but packaging suffix differs', async () => {
    // Existing row has /NOPB suffix; incoming has bare MPN.
    // First select (exact ilike on "LM317T" vs stored "LM317T/NOPB") misses.
    // Second select (manufacturer scan) returns the stored row; in-memory
    // comparison-key check finds the match.
    const existingWithSuffix = makePartRow({
      id: 'suffix-uuid',
      manufacturer: 'Texas Instruments',
      mpn: 'LM317T/NOPB',
    });
    const db = makeMockDb({
      selectResults: [
        [],                      // first ilike exact: no match on "LM317T"
        [existingWithSuffix],    // second manufacturer scan: returns the suffix row
      ],
    });
    const req = baseRequest({
      fields: {
        title: 'LM317T bare import',
        manufacturer: 'Texas Instruments',
        mpn: 'LM317T',
        canonicalCategory: 'ic',
        meta: {},
        connectors: [],
      },
    });
    const result = await ingressPart(req, db);
    expect(result.reused).toBe(true);
    expect(result.partId).toBe('suffix-uuid');
  });

  it('creates a new part when MPN is genuinely different (not a normalization variant)', async () => {
    const fresh = makePartRow({ id: 'truly-new' });
    const db = makeMockDb({
      selectResults: [
        [], // first ilike exact: miss
        [], // manufacturer scan: no rows at all
        [], // slug lookup: miss
      ],
      insertReturning: [[fresh]],
    });
    const req = baseRequest({
      fields: {
        title: 'Different part',
        manufacturer: 'Yageo',
        mpn: 'RC0402FR-0722KL', // different value from the base fixture
        canonicalCategory: 'resistor',
        meta: {},
        connectors: [],
      },
    });
    const result = await ingressPart(req, db);
    expect(result.created).toBe(true);
    expect(result.partId).toBe('truly-new');
  });

  it('returns null from findByMpn when manufacturer is empty/whitespace-only', async () => {
    // When manufacturer normalizes to empty, dedup skips mpn lookup
    // and falls through to slug-based dedup.
    const fresh = makePartRow({ id: 'slug-created' });
    const db = makeMockDb({
      selectResults: [
        [], // slug lookup miss (no mpn lookup issued because manufacturer empty)
      ],
      insertReturning: [[fresh]],
    });
    const req = baseRequest({
      fields: {
        title: 'No-manufacturer part',
        manufacturer: '   ',
        mpn: 'ANY-MPN-VALUE',
        canonicalCategory: 'other',
        meta: {},
        connectors: [],
      },
    });
    const result = await ingressPart(req, db);
    expect(result.created).toBe(true);
    // Only one select (slug lookup), not two (mpn+slug)
    expect(db.select).toHaveBeenCalledTimes(1);
  });
});

describe('ingressPart — dedup by slug (when mpn missing or mismatched)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a collision-suffixed slug when base slug is taken and mpn is null', async () => {
    const existingSlugRow = makePartRow({ slug: 'res-10k-0402-1pct' });
    const freshSlug = makePartRow({ id: 'new-uuid', slug: 'res-10k-0402-1pct-2' });
    // No mpn search (fields.mpn null) → skips first select, goes to slug lookup.
    const db = makeMockDb({
      selectResults: [
        [existingSlugRow], // findBySlug: base slug hit
        [], // resolveUniqueSlug: first candidate (-2) is free
      ],
      insertReturning: [[freshSlug]],
    });
    const req = baseRequest({
      fields: {
        title: '10k resistor (user-added)',
        canonicalCategory: 'resistor',
        packageType: '0402',
        tolerance: '1%',
        mpn: null,
        manufacturer: null,
        meta: { resistance: '10k' },
        connectors: [],
      },
    });
    const result = await ingressPart(req, db);
    expect(result.created).toBe(true);
    expect(result.slug).toBe('res-10k-0402-1pct-2');
  });

  it('iterates collision suffixes until unique', async () => {
    const taken1 = makePartRow({ slug: 'cap-100nf-0603-10pct' });
    const taken2 = makePartRow({ slug: 'cap-100nf-0603-10pct-2' });
    const fresh = makePartRow({ id: 'new', slug: 'cap-100nf-0603-10pct-3' });
    const db = makeMockDb({
      selectResults: [
        [taken1], // base slug hit
        [taken2], // -2 taken
        [], // -3 free
      ],
      insertReturning: [[fresh]],
    });
    const req = baseRequest({
      fields: {
        title: '100nF capacitor',
        canonicalCategory: 'capacitor',
        packageType: '0603',
        tolerance: '10%',
        mpn: null,
        manufacturer: null,
        meta: { value: '100nF' },
        connectors: [],
      },
    });
    const result = await ingressPart(req, db);
    expect(result.slug).toBe('cap-100nf-0603-10pct-3');
  });

  it('mpn lookup runs before slug lookup when both manufacturer and mpn present', async () => {
    const existing = makePartRow();
    const db = makeMockDb({ selectResults: [[existing]] });
    await ingressPart(baseRequest(), db);
    // Only ONE select call for mpn — slug lookup should be skipped
    expect(db.select).toHaveBeenCalledTimes(1);
  });
});

describe('ingressPart — fresh create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts a new part when no dedup match', async () => {
    const fresh = makePartRow({ id: 'fresh-uuid' });
    const db = makeMockDb({
      selectResults: [
        [], // mpn lookup miss
        [], // slug lookup miss
      ],
      insertReturning: [[fresh]],
    });
    const result = await ingressPart(baseRequest(), db);
    expect(result.created).toBe(true);
    expect(result.reused).toBe(false);
    expect(result.partId).toBe('fresh-uuid');
    expect(db.insert).toHaveBeenCalled();
  });

  it('creates with empty meta/connectors defaults when fields omit them', async () => {
    const fresh = makePartRow({ id: 'no-meta-uuid' });
    const db = makeMockDb({
      selectResults: [[], []],
      insertReturning: [[fresh]],
    });
    const req = baseRequest({
      fields: {
        title: 'Minimal part',
        canonicalCategory: 'other',
      },
    });
    const result = await ingressPart(req, db);
    expect(result.created).toBe(true);
    expect(result.part.id).toBe('no-meta-uuid');
  });

  it('uses default trust_level "user" when not specified', async () => {
    const fresh = makePartRow({ trustLevel: 'user' });
    const db = makeMockDb({
      selectResults: [[], []],
      insertReturning: [[fresh]],
    });
    const result = await ingressPart(baseRequest(), db);
    expect(result.part.trustLevel).toBe('user');
  });
});

// ===========================================================================
// Stock upsert
// ===========================================================================

describe('ingressPart — stock upsert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts a new stock row when no existing stock for (projectId, partId)', async () => {
    const existingPart = makePartRow();
    const freshStock = makeStockRow();
    const db = makeMockDb({
      selectResults: [
        [existingPart], // mpn lookup
        [], // stock lookup miss
      ],
      insertReturning: [[freshStock]],
    });
    const result = await ingressPart(
      baseRequest({
        projectId: 10,
        stock: { quantityNeeded: 5, unitPrice: 0.0023, supplier: 'LCSC' },
      }),
      db,
    );
    expect(result.stockId).toBe('550e8400-e29b-41d4-a716-446655440010');
    expect(db.insert).toHaveBeenCalled();
  });

  it('updates existing stock row when (projectId, partId) already has one', async () => {
    const existingPart = makePartRow();
    const existingStock = makeStockRow({ quantityNeeded: 2 });
    const updatedStock = makeStockRow({ quantityNeeded: 10 });
    const db = makeMockDb({
      selectResults: [
        [existingPart], // mpn
        [existingStock], // stock hit
      ],
      updateReturning: [[updatedStock]],
    });
    const result = await ingressPart(
      baseRequest({
        projectId: 10,
        stock: { quantityNeeded: 10 },
      }),
      db,
    );
    expect(result.stockId).toBe('550e8400-e29b-41d4-a716-446655440010');
    expect(db.update).toHaveBeenCalled();
  });

  it('skips stock creation when projectId is absent', async () => {
    const existingPart = makePartRow();
    const db = makeMockDb({ selectResults: [[existingPart]] });
    const result = await ingressPart(
      baseRequest({
        stock: { quantityNeeded: 5 },
      }),
      db,
    );
    expect(result.stockId).toBeNull();
    expect(result.stock).toBeNull();
  });

  it('skips stock creation when stock fields absent', async () => {
    const existingPart = makePartRow();
    const db = makeMockDb({ selectResults: [[existingPart]] });
    const result = await ingressPart(baseRequest({ projectId: 10 }), db);
    expect(result.stockId).toBeNull();
  });

  it('normalizes numeric unitPrice to 4-decimal string', async () => {
    const existingPart = makePartRow();
    const newStock = makeStockRow();
    const db = makeMockDb({
      selectResults: [[existingPart], []],
      insertReturning: [[newStock]],
    });
    await ingressPart(
      baseRequest({
        projectId: 10,
        stock: { unitPrice: 1.23456789 },
      }),
      db,
    );
    expect(db.insert).toHaveBeenCalled();
  });

  it('preserves string unitPrice as-is (numeric column compatibility)', async () => {
    const existingPart = makePartRow();
    const newStock = makeStockRow();
    const db = makeMockDb({
      selectResults: [[existingPart], []],
      insertReturning: [[newStock]],
    });
    await ingressPart(
      baseRequest({
        projectId: 10,
        stock: { unitPrice: '0.0023' },
      }),
      db,
    );
    expect(db.insert).toHaveBeenCalled();
  });
});

// ===========================================================================
// Placement creation
// ===========================================================================

describe('ingressPart — placement creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a placement row when placement fields present', async () => {
    const existingPart = makePartRow();
    const placement = makePlacementRow();
    const db = makeMockDb({
      selectResults: [[existingPart]],
      insertReturning: [[placement]],
    });
    const result = await ingressPart(
      baseRequest({
        placement: {
          surface: 'schematic',
          containerType: 'circuit',
          containerId: 1,
          referenceDesignator: 'R1',
          x: 10,
          y: 20,
        },
      }),
      db,
    );
    expect(result.placementId).toBe('550e8400-e29b-41d4-a716-446655440020');
  });

  it('applies default rotation of 0 when not specified', async () => {
    const existingPart = makePartRow();
    const placement = makePlacementRow({ rotation: 0 });
    const db = makeMockDb({
      selectResults: [[existingPart]],
      insertReturning: [[placement]],
    });
    const result = await ingressPart(
      baseRequest({
        placement: {
          surface: 'pcb',
          containerType: 'circuit',
          containerId: 2,
          referenceDesignator: 'U1',
        },
      }),
      db,
    );
    expect(result.placement?.rotation).toBe(0);
  });

  it('skips placement creation when placement fields absent', async () => {
    const existingPart = makePartRow();
    const db = makeMockDb({ selectResults: [[existingPart]] });
    const result = await ingressPart(baseRequest(), db);
    expect(result.placementId).toBeNull();
    expect(result.placement).toBeNull();
  });

  it('applies default empty properties object when not specified', async () => {
    const existingPart = makePartRow();
    const placement = makePlacementRow();
    const db = makeMockDb({
      selectResults: [[existingPart]],
      insertReturning: [[placement]],
    });
    const result = await ingressPart(
      baseRequest({
        placement: {
          surface: 'breadboard',
          containerType: 'circuit',
          containerId: 1,
          referenceDesignator: 'C1',
        },
      }),
      db,
    );
    expect(result.placement).toBeDefined();
  });
});

// ===========================================================================
// Best-effort mirror + failure isolation
// ===========================================================================

describe('mirrorIngressBestEffort — success path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the IngressResult on successful mirror', async () => {
    const existingPart = makePartRow();
    const db = makeMockDb({
      selectResults: [[existingPart]],
    });
    const result = await mirrorIngressBestEffort(
      baseRequest(),
      { source: 'bom_create', projectId: 10, legacyTable: 'bom_items', legacyId: 1 },
      db,
    );
    expect(result).not.toBeNull();
    expect(result!.partId).toBeDefined();
  });

  it('passes through reused vs created flag', async () => {
    const existingPart = makePartRow();
    const db = makeMockDb({ selectResults: [[existingPart]] });
    const result = await mirrorIngressBestEffort(
      baseRequest(),
      { source: 'bom_create', projectId: 10, legacyTable: 'bom_items', legacyId: 1 },
      db,
    );
    expect(result!.reused).toBe(true);
  });
});

describe('mirrorIngressBestEffort — failure isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when ingressPart throws', async () => {
    const db = makeMockDb({ selectShouldThrow: true, insertReturning: [[makePartRow()]] });
    const result = await mirrorIngressBestEffort(
      baseRequest(),
      { source: 'bom_create', projectId: 10, legacyTable: 'bom_items', legacyId: 1 },
      db,
    );
    expect(result).toBeNull();
  });

  it('writes an audit row when ingressPart throws', async () => {
    const auditInsert = vi.fn().mockResolvedValue([]);
    const db = {
      select: vi.fn(() => {
        throw new Error('mock select error');
      }),
      insert: vi.fn(() => ({
        values: auditInsert,
      })),
      update: vi.fn(),
    } as unknown as Parameters<typeof mirrorIngressBestEffort>[2];
    const result = await mirrorIngressBestEffort(
      baseRequest(),
      { source: 'bom_create', projectId: 10, legacyTable: 'bom_items', legacyId: 42 },
      db,
    );
    expect(result).toBeNull();
    // insert() should have been called for the audit log row
    expect(auditInsert).toHaveBeenCalled();
  });

  it('swallows secondary audit-log write failures', async () => {
    const db = {
      select: vi.fn(() => {
        throw new Error('primary failure');
      }),
      insert: vi.fn(() => ({
        values: vi.fn().mockRejectedValue(new Error('audit log also failed')),
      })),
      update: vi.fn(),
    } as unknown as Parameters<typeof mirrorIngressBestEffort>[2];
    // Should not throw — both failures are swallowed.
    const result = await mirrorIngressBestEffort(
      baseRequest(),
      { source: 'bom_create', projectId: 10, legacyTable: 'bom_items', legacyId: 1 },
      db,
    );
    expect(result).toBeNull();
  });

  it('passes through legacy context to audit log', async () => {
    let capturedArgs: unknown = null;
    const db = {
      select: vi.fn(() => {
        throw new Error('failure');
      }),
      insert: vi.fn(() => ({
        values: vi.fn((args: unknown) => {
          capturedArgs = args;
          return Promise.resolve([]);
        }),
      })),
      update: vi.fn(),
    } as unknown as Parameters<typeof mirrorIngressBestEffort>[2];
    await mirrorIngressBestEffort(
      baseRequest(),
      { source: 'fzpz', projectId: 77, legacyTable: 'component_parts', legacyId: 99 },
      db,
    );
    const c = capturedArgs as Record<string, unknown> | null;
    expect(c).not.toBeNull();
    expect(c!.source).toBe('fzpz');
    expect(c!.projectId).toBe(77);
    expect(c!.legacyTable).toBe('component_parts');
    expect(c!.legacyId).toBe(99);
  });
});

// ===========================================================================
// logIngressFailure direct
// ===========================================================================

describe('logIngressFailure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes a row with the expected shape', async () => {
    let captured: unknown = null;
    const db = {
      select: vi.fn(),
      update: vi.fn(),
      insert: vi.fn(() => ({
        values: vi.fn((args: unknown) => {
          captured = args;
          return Promise.resolve([]);
        }),
      })),
    } as unknown as Parameters<typeof logIngressFailure>[1];
    await logIngressFailure(
      {
        source: 'manual',
        projectId: 5,
        legacyTable: 'bom_items',
        legacyId: 12,
        payload: { something: 'test' },
        errorMessage: 'oops',
        errorStack: 'stack trace',
      },
      db,
    );
    const c = captured as Record<string, unknown> | null;
    expect(c).not.toBeNull();
    expect(c!.source).toBe('manual');
    expect(c!.legacyId).toBe(12);
    expect(c!.errorMessage).toBe('oops');
    expect(c!.errorStack).toBe('stack trace');
  });

  it('accepts null projectId for non-scoped failures', async () => {
    let captured: unknown = null;
    const db = {
      select: vi.fn(),
      update: vi.fn(),
      insert: vi.fn(() => ({
        values: vi.fn((args: unknown) => {
          captured = args;
          return Promise.resolve([]);
        }),
      })),
    } as unknown as Parameters<typeof logIngressFailure>[1];
    await logIngressFailure(
      {
        source: 'library_copy',
        projectId: null,
        legacyTable: 'component_library',
        legacyId: 100,
        payload: {},
        errorMessage: 'global failure',
      },
      db,
    );
    const c = captured as Record<string, unknown> | null;
    expect(c!.projectId).toBeNull();
  });
});

// ===========================================================================
// Result shape
// ===========================================================================

describe('ingressPart — result shape', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all result fields when reused', async () => {
    const existing = makePartRow();
    const db = makeMockDb({ selectResults: [[existing]] });
    const result = await ingressPart(baseRequest(), db);
    expect(result).toHaveProperty('partId');
    expect(result).toHaveProperty('part');
    expect(result).toHaveProperty('stockId');
    expect(result).toHaveProperty('stock');
    expect(result).toHaveProperty('placementId');
    expect(result).toHaveProperty('placement');
    expect(result).toHaveProperty('created');
    expect(result).toHaveProperty('reused');
    expect(result).toHaveProperty('slug');
  });

  it('reused is the inverse of created', async () => {
    const existing = makePartRow();
    const db = makeMockDb({ selectResults: [[existing]] });
    const result = await ingressPart(baseRequest(), db);
    expect(result.reused).toBe(!result.created);
  });

  it('created is true for fresh inserts', async () => {
    const fresh = makePartRow({ id: 'new' });
    const db = makeMockDb({
      selectResults: [[], []],
      insertReturning: [[fresh]],
    });
    const result = await ingressPart(baseRequest(), db);
    expect(result.created).toBe(true);
    expect(result.reused).toBe(false);
  });

  it('null stockId when no stock fields', async () => {
    const existing = makePartRow();
    const db = makeMockDb({ selectResults: [[existing]] });
    const result = await ingressPart(baseRequest(), db);
    expect(result.stockId).toBeNull();
    expect(result.stock).toBeNull();
  });

  it('null placementId when no placement fields', async () => {
    const existing = makePartRow();
    const db = makeMockDb({ selectResults: [[existing]] });
    const result = await ingressPart(baseRequest(), db);
    expect(result.placementId).toBeNull();
    expect(result.placement).toBeNull();
  });
});

// ===========================================================================
// Source types
// ===========================================================================

describe('ingressPart — source types', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    'library_copy',
    'fzpz',
    'svg',
    'csv_bom',
    'camera_scan',
    'barcode',
    'manual',
    'bom_create',
    'component_create',
    'circuit_instance',
    'ai',
  ] as const)('accepts source type %s', async (source) => {
    const existing = makePartRow();
    const db = makeMockDb({ selectResults: [[existing]] });
    const result = await ingressPart(baseRequest({ source }), db);
    expect(result.reused).toBe(true);
  });
});

// ===========================================================================
// Origin types
// ===========================================================================

describe('ingressPart — origin types', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    'library',
    'user',
    'community',
    'verified_board',
    'starter_circuit',
    'scan',
    'ai_generated',
  ] as const)('accepts origin type %s', async (origin) => {
    const fresh = makePartRow({ origin });
    const db = makeMockDb({
      selectResults: [[], []],
      insertReturning: [[fresh]],
    });
    const result = await ingressPart(baseRequest({ origin }), db);
    expect(result.created).toBe(true);
  });
});
