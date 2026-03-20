import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  Project,
  ArchitectureNode,
  ArchitectureEdge,
  BomItem,
  CircuitDesignRow,
} from '@shared/schema';

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted() ensures these are available when vi.mock runs
// ---------------------------------------------------------------------------

const { mockDb, mockCache } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  };

  const mockCache = {
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn(),
    invalidate: vi.fn(),
    clear: vi.fn(),
  };

  return { mockDb, mockCache };
});

vi.mock('../db', () => ({ db: mockDb }));
vi.mock('../cache', () => ({ cache: mockCache }));

vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { DatabaseStorage, StorageError, VersionConflictError } from '../storage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function chainBuilder(terminalValue: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const proxy = new Proxy(chain, {
    get(_target, prop: string) {
      if (!chain[prop]) {
        chain[prop] = vi.fn().mockReturnValue(proxy);
      }
      return chain[prop];
    },
  });
  chain.returning = vi.fn().mockResolvedValue(terminalValue);
  chain.where = vi.fn().mockReturnValue(proxy);
  chain.from = vi.fn().mockReturnValue(proxy);
  chain.set = vi.fn().mockReturnValue(proxy);
  chain.values = vi.fn().mockReturnValue(proxy);
  return proxy;
}

let selectResult: unknown[] = [];
let updateResult: unknown[] = [];

function createTxMock() {
  const mock: Record<string, ReturnType<typeof vi.fn>> = {};
  mock.select = vi.fn().mockImplementation(() => {
    const selectChain: Record<string, ReturnType<typeof vi.fn>> = {};
    selectChain.from = vi.fn().mockReturnValue(selectChain);
    selectChain.where = vi.fn().mockResolvedValue(selectResult);
    return selectChain;
  });
  mock.update = vi.fn().mockImplementation(() => {
    const updateChain: Record<string, ReturnType<typeof vi.fn>> = {};
    updateChain.set = vi.fn().mockReturnValue(updateChain);
    updateChain.where = vi.fn().mockReturnValue(updateChain);
    updateChain.returning = vi.fn().mockResolvedValue(updateResult);
    return updateChain;
  });
  mock.insert = vi.fn().mockImplementation(() => {
    const insertChain: Record<string, ReturnType<typeof vi.fn>> = {};
    insertChain.values = vi.fn().mockReturnValue(insertChain);
    insertChain.returning = vi.fn().mockResolvedValue([]);
    return insertChain;
  });
  return mock;
}

const now = new Date();

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    name: 'Test Project',
    description: 'A test project',
    ownerId: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    approvedAt: null,
    approvedBy: null,
    ...overrides,
  };
}

function makeNode(overrides: Partial<ArchitectureNode> = {}): ArchitectureNode {
  return {
    id: 1,
    projectId: 1,
    nodeId: 'uuid-1',
    nodeType: 'mcu',
    label: 'ESP32',
    positionX: 300,
    positionY: 200,
    data: null,
    version: 1,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function makeEdge(overrides: Partial<ArchitectureEdge> = {}): ArchitectureEdge {
  return {
    id: 1,
    projectId: 1,
    edgeId: 'edge-1',
    source: 'uuid-1',
    target: 'uuid-2',
    label: 'I2C',
    animated: false,
    style: null,
    signalType: 'I2C',
    voltage: '3.3V',
    busWidth: null,
    netName: null,
    version: 1,
    deletedAt: null,
    ...overrides,
  };
}

function makeBomItem(overrides: Partial<BomItem> = {}): BomItem {
  return {
    id: 1,
    projectId: 1,
    partNumber: 'ESP32-S3',
    manufacturer: 'Espressif',
    description: 'WiFi SoC',
    quantity: 1,
    unitPrice: '3.50',
    totalPrice: '3.50',
    supplier: 'Digi-Key',
    stock: 100,
    status: 'In Stock',
    leadTime: null,
    datasheetUrl: null,
    manufacturerUrl: null,
    storageLocation: null,
    quantityOnHand: null,
    minimumStock: null,
    esdSensitive: null,
    assemblyCategory: null,
    version: 1,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function makeCircuitDesign(overrides: Partial<CircuitDesignRow> = {}): CircuitDesignRow {
  return {
    id: 1,
    projectId: 1,
    name: 'Main Circuit',
    description: null,
    parentDesignId: null,
    settings: {},
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function setupUpdateChain(result: unknown[]) {
  const chain = chainBuilder(result);
  mockDb.update.mockReturnValueOnce(chain);
  return chain;
}

function setupSelectChain(result: unknown[]) {
  // Select chains resolve at .where() — NOT .returning() like update chains.
  // Using chainBuilder's Proxy here would make .then interceptable, causing
  // `await db.select({...}).from().where()` to hang forever.
  const selectChain = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(result),
    }),
  };
  mockDb.select.mockReturnValueOnce(selectChain);
  return selectChain;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Optimistic concurrency — VersionConflictError', () => {
  it('is an instance of StorageError', () => {
    const err = new VersionConflictError('projects', 1, 3);
    expect(err).toBeInstanceOf(StorageError);
    expect(err).toBeInstanceOf(VersionConflictError);
  });

  it('has httpStatus 409', () => {
    const err = new VersionConflictError('nodes', 5, 7);
    expect(err.httpStatus).toBe(409);
  });

  it('contains currentVersion', () => {
    const err = new VersionConflictError('edges', 2, 4);
    expect(err.currentVersion).toBe(4);
  });

  it('has descriptive message', () => {
    const err = new VersionConflictError('bom', 3, 5);
    expect(err.message).toContain('bom/3');
    expect(err.message).toContain('Version conflict');
  });

  it('has name VersionConflictError', () => {
    const err = new VersionConflictError('projects', 1, 1);
    expect(err.name).toBe('VersionConflictError');
  });
});

describe('Optimistic concurrency — Project version', () => {
  const storage = new DatabaseStorage();

  beforeEach(() => {
    vi.clearAllMocks();
    selectResult = [];
    updateResult = [];
  });

  it('version defaults to 1 in schema type', () => {
    const project = makeProject();
    expect(project.version).toBe(1);
  });

  it('updateProject increments version on success (no expectedVersion)', async () => {
    const updated = makeProject({ version: 2 });
    setupUpdateChain([updated]);

    const result = await storage.updateProject(1, { name: 'New Name' });
    expect(result).toEqual(updated);
    expect(result?.version).toBe(2);
  });

  it('updateProject succeeds when expectedVersion matches', async () => {
    const updated = makeProject({ version: 2 });
    setupUpdateChain([updated]);

    const result = await storage.updateProject(1, { name: 'Renamed' }, 1);
    expect(result).toEqual(updated);
    expect(result?.version).toBe(2);
  });

  it('updateProject throws VersionConflictError on stale version', async () => {
    setupUpdateChain([]);
    setupSelectChain([{ id: 1, version: 3 }]);

    await expect(storage.updateProject(1, { name: 'Stale' }, 1))
      .rejects.toThrow(VersionConflictError);
  });

  it('updateProject VersionConflictError carries currentVersion', async () => {
    setupUpdateChain([]);
    setupSelectChain([{ id: 1, version: 3 }]);

    try {
      await storage.updateProject(1, { name: 'Stale' }, 1);
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(VersionConflictError);
      expect((e as VersionConflictError).currentVersion).toBe(3);
      expect((e as VersionConflictError).httpStatus).toBe(409);
    }
  });

  it('updateProject returns undefined for non-existent resource (not 409)', async () => {
    setupUpdateChain([]);
    setupSelectChain([]);

    const result = await storage.updateProject(999, { name: 'Ghost' }, 1);
    expect(result).toBeUndefined();
  });

  it('updateProject backward compat — no expectedVersion skips version check', async () => {
    const updated = makeProject({ version: 2 });
    setupUpdateChain([updated]);

    const result = await storage.updateProject(1, { name: 'No ETag' });
    expect(result).toEqual(updated);
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('updateProject invalidates cache on success', async () => {
    const updated = makeProject({ version: 2 });
    setupUpdateChain([updated]);

    await storage.updateProject(1, { name: 'Cache test' });
    expect(mockCache.invalidate).toHaveBeenCalledWith('project:1');
  });
});

describe('Optimistic concurrency — Node version', () => {
  const storage = new DatabaseStorage();

  beforeEach(() => {
    vi.clearAllMocks();
    selectResult = [];
    updateResult = [];
  });

  it('updateNode increments version', async () => {
    const updated = makeNode({ version: 2 });
    setupUpdateChain([updated]);

    const result = await storage.updateNode(1, 1, { label: 'New Label' });
    expect(result).toEqual(updated);
    expect(result?.version).toBe(2);
  });

  it('updateNode succeeds with correct expectedVersion', async () => {
    const updated = makeNode({ version: 2 });
    setupUpdateChain([updated]);

    const result = await storage.updateNode(1, 1, { label: 'Updated' }, 1);
    expect(result).toEqual(updated);
  });

  it('updateNode throws VersionConflictError on stale version', async () => {
    setupUpdateChain([]);
    setupSelectChain([{ id: 1, version: 5 }]);

    await expect(storage.updateNode(1, 1, { label: 'Stale' }, 2))
      .rejects.toThrow(VersionConflictError);
  });

  it('updateNode returns undefined for non-existent node', async () => {
    setupUpdateChain([]);
    setupSelectChain([]);

    const result = await storage.updateNode(999, 1, { label: 'Ghost' }, 1);
    expect(result).toBeUndefined();
  });

  it('updateNode backward compat — omitting expectedVersion skips check', async () => {
    const updated = makeNode({ version: 3 });
    setupUpdateChain([updated]);

    const result = await storage.updateNode(1, 1, { label: 'No ETag' });
    expect(result?.version).toBe(3);
    expect(mockDb.select).not.toHaveBeenCalled();
  });
});

describe('Optimistic concurrency — Edge version', () => {
  const storage = new DatabaseStorage();

  beforeEach(() => {
    vi.clearAllMocks();
    selectResult = [];
    updateResult = [];
  });

  it('updateEdge increments version', async () => {
    const updated = makeEdge({ version: 2 });
    setupUpdateChain([updated]);

    const result = await storage.updateEdge(1, 1, { label: 'SPI' });
    expect(result).toEqual(updated);
    expect(result?.version).toBe(2);
  });

  it('updateEdge succeeds with correct expectedVersion', async () => {
    const updated = makeEdge({ version: 2 });
    setupUpdateChain([updated]);

    const result = await storage.updateEdge(1, 1, { label: 'SPI' }, 1);
    expect(result).toEqual(updated);
  });

  it('updateEdge throws VersionConflictError on stale version', async () => {
    setupUpdateChain([]);
    setupSelectChain([{ id: 1, version: 4 }]);

    await expect(storage.updateEdge(1, 1, { label: 'Stale' }, 2))
      .rejects.toThrow(VersionConflictError);
  });

  it('updateEdge returns undefined for non-existent edge', async () => {
    setupUpdateChain([]);
    setupSelectChain([]);

    const result = await storage.updateEdge(999, 1, { label: 'Ghost' }, 1);
    expect(result).toBeUndefined();
  });
});

describe('Optimistic concurrency — BOM item version', () => {
  const storage = new DatabaseStorage();

  beforeEach(() => {
    vi.clearAllMocks();
    selectResult = [];
    updateResult = [];
  });

  it('updateBomItem increments version (non-quantity path)', async () => {
    const updated = makeBomItem({ version: 2, description: 'Updated desc' });
    setupUpdateChain([updated]);

    const result = await storage.updateBomItem(1, 1, { description: 'Updated desc' });
    expect(result?.version).toBe(2);
  });

  it('updateBomItem with quantity change uses transaction and version check', async () => {
    const existing = makeBomItem({ version: 1, quantity: 1, unitPrice: '3.50' });
    const updated = makeBomItem({ version: 2, quantity: 10, totalPrice: '35.0000' });

    const txMock = createTxMock();
    selectResult = [existing];
    updateResult = [updated];

    mockDb.transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(txMock));

    const result = await storage.updateBomItem(1, 1, { quantity: 10 }, 1);
    expect(result?.version).toBe(2);
  });

  it('updateBomItem throws VersionConflictError in transaction on stale version', async () => {
    const existing = makeBomItem({ version: 5 });

    const txMock = createTxMock();
    selectResult = [existing];

    mockDb.transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(txMock));

    await expect(storage.updateBomItem(1, 1, { quantity: 10 }, 2))
      .rejects.toThrow(VersionConflictError);
  });

  it('updateBomItem throws VersionConflictError on non-quantity path', async () => {
    setupUpdateChain([]);
    setupSelectChain([{ id: 1, version: 3 }]);

    await expect(storage.updateBomItem(1, 1, { description: 'Stale' }, 1))
      .rejects.toThrow(VersionConflictError);
  });

  it('updateBomItem backward compat — no expectedVersion works normally', async () => {
    const updated = makeBomItem({ version: 2, description: 'OK' });
    setupUpdateChain([updated]);

    const result = await storage.updateBomItem(1, 1, { description: 'OK' });
    expect(result?.version).toBe(2);
  });

  it('updateBomItem returns undefined for non-existent item (not 409)', async () => {
    setupUpdateChain([]);
    setupSelectChain([]);

    const result = await storage.updateBomItem(999, 1, { description: 'Ghost' }, 1);
    expect(result).toBeUndefined();
  });

  it('updateBomItem returns undefined in transaction for non-existent item', async () => {
    const txMock = createTxMock();
    selectResult = [];

    mockDb.transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(txMock));

    const result = await storage.updateBomItem(999, 1, { quantity: 10 });
    expect(result).toBeUndefined();
  });
});

describe('Optimistic concurrency — Circuit design version', () => {
  const storage = new DatabaseStorage();

  beforeEach(() => {
    vi.clearAllMocks();
    selectResult = [];
    updateResult = [];
  });

  it('updateCircuitDesign increments version', async () => {
    const updated = makeCircuitDesign({ version: 2 });
    setupUpdateChain([updated]);

    const result = await storage.updateCircuitDesign(1, { name: 'Renamed' });
    expect(result?.version).toBe(2);
  });

  it('updateCircuitDesign succeeds with correct expectedVersion', async () => {
    const updated = makeCircuitDesign({ version: 2 });
    setupUpdateChain([updated]);

    const result = await storage.updateCircuitDesign(1, { name: 'Renamed' }, 1);
    expect(result).toEqual(updated);
  });

  it('updateCircuitDesign throws VersionConflictError on stale version', async () => {
    setupUpdateChain([]);
    setupSelectChain([{ id: 1, version: 6 }]);

    await expect(storage.updateCircuitDesign(1, { name: 'Stale' }, 3))
      .rejects.toThrow(VersionConflictError);
  });

  it('updateCircuitDesign returns undefined for non-existent design', async () => {
    setupUpdateChain([]);
    setupSelectChain([]);

    const result = await storage.updateCircuitDesign(999, { name: 'Ghost' }, 1);
    expect(result).toBeUndefined();
  });
});

describe('Optimistic concurrency — concurrent update simulation', () => {
  const storage = new DatabaseStorage();

  beforeEach(() => {
    vi.clearAllMocks();
    selectResult = [];
    updateResult = [];
  });

  it('first update with v1 succeeds, second update with v1 gets 409', async () => {
    const updated = makeProject({ version: 2 });
    setupUpdateChain([updated]);

    const result1 = await storage.updateProject(1, { name: 'Update A' }, 1);
    expect(result1?.version).toBe(2);

    setupUpdateChain([]);
    setupSelectChain([{ id: 1, version: 2 }]);

    await expect(storage.updateProject(1, { name: 'Update B' }, 1))
      .rejects.toThrow(VersionConflictError);
  });

  it('second update succeeds after re-fetching with correct version', async () => {
    const updated1 = makeProject({ version: 2 });
    setupUpdateChain([updated1]);
    await storage.updateProject(1, { name: 'Update A' }, 1);

    const updated2 = makeProject({ version: 3, name: 'Update B' });
    setupUpdateChain([updated2]);
    const result = await storage.updateProject(1, { name: 'Update B' }, 2);
    expect(result?.version).toBe(3);
  });

  it('concurrent node updates — first wins, second gets 409', async () => {
    const updated = makeNode({ version: 2 });
    setupUpdateChain([updated]);
    await storage.updateNode(1, 1, { label: 'A' }, 1);

    setupUpdateChain([]);
    setupSelectChain([{ id: 1, version: 2 }]);
    await expect(storage.updateNode(1, 1, { label: 'B' }, 1))
      .rejects.toThrow(VersionConflictError);
  });

  it('concurrent BOM updates — first wins, second gets 409', async () => {
    const updated = makeBomItem({ version: 2, description: 'A' });
    setupUpdateChain([updated]);
    await storage.updateBomItem(1, 1, { description: 'A' }, 1);

    setupUpdateChain([]);
    setupSelectChain([{ id: 1, version: 2 }]);
    await expect(storage.updateBomItem(1, 1, { description: 'B' }, 1))
      .rejects.toThrow(VersionConflictError);
  });
});

describe('Optimistic concurrency — type shape validation', () => {
  it('Project type includes version field', () => {
    const project = makeProject();
    expect('version' in project).toBe(true);
    expect(typeof project.version).toBe('number');
  });

  it('ArchitectureNode type includes version field', () => {
    const node = makeNode();
    expect('version' in node).toBe(true);
    expect(typeof node.version).toBe('number');
  });

  it('ArchitectureEdge type includes version field', () => {
    const edge = makeEdge();
    expect('version' in edge).toBe(true);
    expect(typeof edge.version).toBe('number');
  });

  it('BomItem type includes version field', () => {
    const item = makeBomItem();
    expect('version' in item).toBe(true);
    expect(typeof item.version).toBe('number');
  });

  it('CircuitDesignRow type includes version field', () => {
    const design = makeCircuitDesign();
    expect('version' in design).toBe(true);
    expect(typeof design.version).toBe('number');
  });
});
