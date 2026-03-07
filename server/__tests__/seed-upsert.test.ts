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
// seedStandardLibrary upsert behavior
// ---------------------------------------------------------------------------

describe('seedStandardLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts new components when none exist', async () => {
    // Mock: select returns empty (count = 0 style — but we're selecting fields now)
    const mockFromResult = {
      where: vi.fn().mockResolvedValue([]),
    };
    const mockFromFn = vi.fn().mockReturnValue(mockFromResult);
    mockSelect.mockReturnValue({ from: mockFromFn });

    // Mock: insert().values() returns
    const mockValues = vi.fn().mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: mockValues });

    // Dynamic import to get the function after mocks are set
    const { seedStandardLibrary } = await import('../routes/seed');
    const result = await seedStandardLibrary();

    expect(result.inserted).toBeGreaterThan(0);
    expect(result.updated).toBe(0);
    expect(result.unchanged).toBe(0);
    expect(result.inserted + result.updated + result.unchanged).toBeGreaterThan(0);

    // Verify insert was called for each component
    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalled();
  });

  it('skips unchanged components (content hash matches)', async () => {
    // For this test we need to match the exact hash of the first standard lib component.
    // We'll mock select to return data that produces the same hash as the component def.
    const { STANDARD_LIBRARY_COMPONENTS } = await import('@shared/standard-library');
    const firstComp = STANDARD_LIBRARY_COMPONENTS[0];

    // Return existing data that matches the component exactly
    const existingRow = {
      id: 1,
      description: firstComp.description,
      category: firstComp.category,
      tags: firstComp.tags,
      meta: firstComp.meta,
      connectors: firstComp.connectors,
      buses: firstComp.buses,
      views: firstComp.views,
      constraints: firstComp.constraints,
    };

    let callCount = 0;
    const mockFromResult = {
      where: vi.fn().mockImplementation(() => {
        callCount++;
        // First call returns existing match, rest return empty (so they insert)
        if (callCount === 1) {
          return Promise.resolve([existingRow]);
        }
        return Promise.resolve([]);
      }),
    };
    const mockFromFn = vi.fn().mockReturnValue(mockFromResult);
    mockSelect.mockReturnValue({ from: mockFromFn });

    const mockValues = vi.fn().mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: mockValues });

    const { seedStandardLibrary } = await import('../routes/seed');
    const result = await seedStandardLibrary();

    // The first component should be unchanged, rest inserted
    expect(result.unchanged).toBeGreaterThanOrEqual(1);
    expect(result.inserted).toBe(STANDARD_LIBRARY_COMPONENTS.length - 1);
    expect(result.updated).toBe(0);
  });

  it('updates components when content hash differs', async () => {
    const { STANDARD_LIBRARY_COMPONENTS } = await import('@shared/standard-library');
    const firstComp = STANDARD_LIBRARY_COMPONENTS[0];

    // Return existing data with a DIFFERENT description to trigger update
    const existingRow = {
      id: 42,
      description: 'OLD DESCRIPTION THAT DIFFERS',
      category: firstComp.category,
      tags: firstComp.tags,
      meta: firstComp.meta,
      connectors: firstComp.connectors,
      buses: firstComp.buses,
      views: firstComp.views,
      constraints: firstComp.constraints,
    };

    let callCount = 0;
    const mockFromResult = {
      where: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve([existingRow]);
        }
        return Promise.resolve([]);
      }),
    };
    const mockFromFn = vi.fn().mockReturnValue(mockFromResult);
    mockSelect.mockReturnValue({ from: mockFromFn });

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
    expect(result.updated).toBeGreaterThanOrEqual(1);
    expect(result.inserted).toBe(STANDARD_LIBRARY_COMPONENTS.length - 1);
    expect(result.unchanged).toBe(0);

    // Verify update was called
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalled();
  });

  it('returns correct total across all categories', async () => {
    // All components are new
    const mockFromResult = {
      where: vi.fn().mockResolvedValue([]),
    };
    const mockFromFn = vi.fn().mockReturnValue(mockFromResult);
    mockSelect.mockReturnValue({ from: mockFromFn });

    const mockValues = vi.fn().mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: mockValues });

    const { seedStandardLibrary } = await import('../routes/seed');
    const { STANDARD_LIBRARY_COMPONENTS } = await import('@shared/standard-library');
    const result = await seedStandardLibrary();

    expect(result.inserted + result.updated + result.unchanged).toBe(STANDARD_LIBRARY_COMPONENTS.length);
  });
});
