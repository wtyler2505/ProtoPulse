import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeComponentHash } from '../routes/seed';

import type { StandardComponentDef } from '@shared/standard-library';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();

vi.mock('../db', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

vi.mock('../storage', () => ({
  storage: {},
}));

vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// computeComponentHash tests
// ---------------------------------------------------------------------------

describe('computeComponentHash', () => {
  const baseComponent: StandardComponentDef = {
    title: 'Test Resistor',
    description: '10k resistor',
    category: 'Resistors',
    tags: ['resistor', '10k'],
    meta: { value: '10k', tolerance: '5%' },
    connectors: [],
    buses: [],
    views: { schematic: { shapes: [] } },
    constraints: [],
  };

  it('produces a consistent SHA-256 hex hash', () => {
    const hash1 = computeComponentHash(baseComponent);
    const hash2 = computeComponentHash(baseComponent);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('does NOT include title in the hash (title is the lookup key)', () => {
    const modified = { ...baseComponent, title: 'Different Title' };
    const hash1 = computeComponentHash(baseComponent);
    const hash2 = computeComponentHash(modified);

    expect(hash1).toBe(hash2);
  });

  it('changes when description changes', () => {
    const modified = { ...baseComponent, description: 'Updated description' };
    expect(computeComponentHash(baseComponent)).not.toBe(computeComponentHash(modified));
  });

  it('changes when category changes', () => {
    const modified = { ...baseComponent, category: 'Capacitors' };
    expect(computeComponentHash(baseComponent)).not.toBe(computeComponentHash(modified));
  });

  it('changes when tags change', () => {
    const modified = { ...baseComponent, tags: ['resistor', '10k', 'smd'] };
    expect(computeComponentHash(baseComponent)).not.toBe(computeComponentHash(modified));
  });

  it('changes when meta changes', () => {
    const modified = { ...baseComponent, meta: { value: '10k', tolerance: '1%' } };
    expect(computeComponentHash(baseComponent)).not.toBe(computeComponentHash(modified));
  });

  it('changes when connectors change', () => {
    const modified = {
      ...baseComponent,
      connectors: [{
        id: 'pin1',
        name: 'A',
        description: '',
        connectorType: 'pad' as const,
        shapeIds: { schematic: ['pin1-sch'] },
        terminalPositions: { schematic: { x: 0, y: 0 } },
        padSpec: { type: 'tht' as const, shape: 'circle' as const, diameter: 1.6, drill: 0.8 },
      }],
    };
    expect(computeComponentHash(baseComponent)).not.toBe(computeComponentHash(modified));
  });

  it('changes when views change', () => {
    const modified = {
      ...baseComponent,
      views: { schematic: { shapes: [{ id: 'body', type: 'rect' as const, x: 0, y: 0, width: 100, height: 50, rotation: 0, style: {} }] } },
    };
    expect(computeComponentHash(baseComponent)).not.toBe(computeComponentHash(modified));
  });

  it('changes when constraints change', () => {
    const modified = { ...baseComponent, constraints: [{ type: 'spacing', min: 10 }] };
    expect(computeComponentHash(baseComponent)).not.toBe(computeComponentHash(modified));
  });
});

// ---------------------------------------------------------------------------
// seedStandardLibrary upsert behavior (batch operations)
// ---------------------------------------------------------------------------

/**
 * Helper to set up mocks for the batch select pattern.
 * The new implementation calls select().from().where() ONCE to fetch all
 * existing public components, then does batch insert + individual updates.
 */
function setupSelectMock(existingRows: Array<Record<string, unknown>>) {
  const mockFromResult = {
    where: vi.fn().mockResolvedValue(existingRows),
  };
  const mockFromFn = vi.fn().mockReturnValue(mockFromResult);
  mockSelect.mockReturnValue({ from: mockFromFn });
  return { mockFromFn, mockFromResult };
}

describe('seedStandardLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts new components when none exist', async () => {
    // Mock: single select returns empty array (no existing components)
    setupSelectMock([]);

    // Mock: single batch insert().values([...]) call
    const mockValues = vi.fn().mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: mockValues });

    const { seedStandardLibrary } = await import('../routes/seed');
    const result = await seedStandardLibrary();

    expect(result.inserted).toBeGreaterThan(0);
    expect(result.updated).toBe(0);
    expect(result.unchanged).toBe(0);
    expect(result.inserted + result.updated + result.unchanged).toBeGreaterThan(0);

    // Verify batch insert was called exactly ONCE (not per component)
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockValues).toHaveBeenCalledTimes(1);

    // Verify the values call received an array of all components
    const insertedValues = mockValues.mock.calls[0][0] as unknown[];
    expect(Array.isArray(insertedValues)).toBe(true);
    expect(insertedValues.length).toBe(result.inserted);
  });

  it('skips unchanged components (content hash matches)', async () => {
    const { STANDARD_LIBRARY_COMPONENTS } = await import('@shared/standard-library');
    const firstComp = STANDARD_LIBRARY_COMPONENTS[0];

    // Return one existing row that matches the first component exactly
    const existingRow = {
      id: 1,
      title: firstComp.title,
      description: firstComp.description,
      category: firstComp.category,
      tags: firstComp.tags,
      meta: firstComp.meta,
      connectors: firstComp.connectors,
      buses: firstComp.buses,
      views: firstComp.views,
      constraints: firstComp.constraints,
    };

    setupSelectMock([existingRow]);

    const mockValues = vi.fn().mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: mockValues });

    const { seedStandardLibrary } = await import('../routes/seed');
    const result = await seedStandardLibrary();

    // The first component should be unchanged, rest inserted
    expect(result.unchanged).toBe(1);
    expect(result.inserted).toBe(STANDARD_LIBRARY_COMPONENTS.length - 1);
    expect(result.updated).toBe(0);

    // Select called exactly once (batch fetch)
    expect(mockSelect).toHaveBeenCalledTimes(1);
  });

  it('updates components when content hash differs', async () => {
    const { STANDARD_LIBRARY_COMPONENTS } = await import('@shared/standard-library');
    const firstComp = STANDARD_LIBRARY_COMPONENTS[0];

    // Return existing row with a DIFFERENT description to trigger update
    const existingRow = {
      id: 42,
      title: firstComp.title,
      description: 'OLD DESCRIPTION THAT DIFFERS',
      category: firstComp.category,
      tags: firstComp.tags,
      meta: firstComp.meta,
      connectors: firstComp.connectors,
      buses: firstComp.buses,
      views: firstComp.views,
      constraints: firstComp.constraints,
    };

    setupSelectMock([existingRow]);

    // Mock insert for new components
    const mockValues = vi.fn().mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: mockValues });

    // Mock update for changed components
    const mockSetWhere = vi.fn().mockResolvedValue(undefined);
    const mockSet = vi.fn().mockReturnValue({ where: mockSetWhere });
    mockUpdate.mockReturnValue({ set: mockSet });

    const { seedStandardLibrary } = await import('../routes/seed');
    const result = await seedStandardLibrary();

    // First component should be updated (different description)
    expect(result.updated).toBe(1);
    expect(result.inserted).toBe(STANDARD_LIBRARY_COMPONENTS.length - 1);
    expect(result.unchanged).toBe(0);

    // Verify update was called exactly once (for the one changed component)
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledTimes(1);
  });

  it('returns correct total across all categories', async () => {
    // All components are new
    setupSelectMock([]);

    const mockValues = vi.fn().mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: mockValues });

    const { seedStandardLibrary } = await import('../routes/seed');
    const { STANDARD_LIBRARY_COMPONENTS } = await import('@shared/standard-library');
    const result = await seedStandardLibrary();

    expect(result.inserted + result.updated + result.unchanged).toBe(STANDARD_LIBRARY_COMPONENTS.length);
  });

  it('performs batch insert instead of per-component queries', async () => {
    // Verifies the key optimization: one SELECT + one INSERT instead of N each
    setupSelectMock([]);

    const mockValues = vi.fn().mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: mockValues });

    const { seedStandardLibrary } = await import('../routes/seed');
    const { STANDARD_LIBRARY_COMPONENTS } = await import('@shared/standard-library');
    await seedStandardLibrary();

    // SELECT called exactly once (batch fetch all existing)
    expect(mockSelect).toHaveBeenCalledTimes(1);

    // INSERT called exactly once (batch insert all new)
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockValues).toHaveBeenCalledTimes(1);

    // The single insert received all components as an array
    const insertedValues = mockValues.mock.calls[0][0] as unknown[];
    expect(insertedValues.length).toBe(STANDARD_LIBRARY_COMPONENTS.length);
  });

  it('handles mix of insert, update, and unchanged correctly', async () => {
    const { STANDARD_LIBRARY_COMPONENTS } = await import('@shared/standard-library');

    // Use first 3 components: one unchanged, one updated, rest inserted
    const unchanged = STANDARD_LIBRARY_COMPONENTS[0];
    const changed = STANDARD_LIBRARY_COMPONENTS[1];

    const existingRows = [
      {
        id: 1,
        title: unchanged.title,
        description: unchanged.description,
        category: unchanged.category,
        tags: unchanged.tags,
        meta: unchanged.meta,
        connectors: unchanged.connectors,
        buses: unchanged.buses,
        views: unchanged.views,
        constraints: unchanged.constraints,
      },
      {
        id: 2,
        title: changed.title,
        description: 'STALE DESCRIPTION',
        category: changed.category,
        tags: changed.tags,
        meta: changed.meta,
        connectors: changed.connectors,
        buses: changed.buses,
        views: changed.views,
        constraints: changed.constraints,
      },
    ];

    setupSelectMock(existingRows);

    const mockValues = vi.fn().mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: mockValues });

    const mockSetWhere = vi.fn().mockResolvedValue(undefined);
    const mockSet = vi.fn().mockReturnValue({ where: mockSetWhere });
    mockUpdate.mockReturnValue({ set: mockSet });

    const { seedStandardLibrary } = await import('../routes/seed');
    const result = await seedStandardLibrary();

    expect(result.unchanged).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.inserted).toBe(STANDARD_LIBRARY_COMPONENTS.length - 2);
    expect(result.inserted + result.updated + result.unchanged).toBe(STANDARD_LIBRARY_COMPONENTS.length);

    // 1 SELECT + 1 batch INSERT + 1 UPDATE = 3 queries total
    expect(mockSelect).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });
});
