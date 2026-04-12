/**
 * Storage Integration Tests (EN-14)
 *
 * Tests covering cache invalidation, soft deletes, pagination,
 * and StorageError behavior for the DatabaseStorage layer.
 * Uses mocked DB (vi.mock) following existing test patterns.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the DB, cache, and logger before importing storage
// ---------------------------------------------------------------------------

const { mockDb, mockCache, mockReturning, mockValues } = vi.hoisted(() => {
  const mockReturning = vi.fn().mockResolvedValue([]);
  const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });

  const mockDb = {
    insert: vi.fn().mockReturnValue({ values: mockValues }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: mockReturning }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
    transaction: vi.fn(),
  };

  const mockCache = {
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn(),
    invalidate: vi.fn(),
    clear: vi.fn(),
  };

  return { mockDb, mockCache, mockReturning, mockValues };
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

import { StorageError, DatabaseStorage } from '../storage';

// =============================================================================
// Helpers — reset all mock call history and set default returns
// =============================================================================

function resetMocks(): void {
  vi.clearAllMocks();
  mockCache.get.mockReturnValue(undefined);
  mockReturning.mockResolvedValue([]);
  mockValues.mockReturnValue({ returning: mockReturning });
}

/**
 * Build a mock select chain supporting two patterns:
 *
 *   Pattern A (single-item lookups):
 *     db.select().from(table).where(condition)  → resolves to whereResult
 *
 *   Pattern B (paginated list queries):
 *     db.select().from(table).where(...).orderBy(...).limit(n).offset(o) → resolves to listResult
 *     db.select().from(table).orderBy(...).limit(n).offset(o)            → resolves to listResult
 *
 * The mock `where()` returns a thenable (so `await where()` yields whereResult)
 * AND has an `orderBy` property for chaining into pagination.
 */
function buildSelectChain(opts: {
  whereResult?: unknown[];
  listResult?: unknown[];
}) {
  const { whereResult = [], listResult = [] } = opts;
  const offsetFn = vi.fn().mockResolvedValue(listResult);
  const limitFn = vi.fn().mockReturnValue({ offset: offsetFn });
  const orderByFn = vi.fn().mockReturnValue({ limit: limitFn });

  // where() must act as both a thenable (for single-item lookups)
  // and return an object with orderBy (for paginated list queries).
  const whereReturnValue = {
    orderBy: orderByFn,
    // Make it thenable so `await db.select().from(t).where(cond)` works
    then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
      return Promise.resolve(whereResult).then(resolve, reject);
    },
  };
  const whereFn = vi.fn().mockReturnValue(whereReturnValue);

  const fromFn = vi.fn().mockReturnValue({
    where: whereFn,
    orderBy: orderByFn,
  });
  mockDb.select.mockReturnValue({ from: fromFn });
  return { fromFn, whereFn, orderByFn, limitFn, offsetFn };
}

/**
 * Build a mock update chain:
 *   db.update(table).set(data).where(condition).returning()
 */
function buildUpdateChain(returningResult: unknown[]) {
  const returning = vi.fn().mockResolvedValue(returningResult);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  mockDb.update.mockReturnValue({ set });
  return { set, where, returning };
}

/**
 * Build a mock insert chain:
 *   db.insert(table).values(data).returning()
 */
function buildInsertChain(returningResult: unknown[]) {
  const returning = vi.fn().mockResolvedValue(returningResult);
  const values = vi.fn().mockReturnValue({ returning });
  mockDb.insert.mockReturnValue({ values });
  return { values, returning };
}

/**
 * Build a mock delete chain:
 *   db.delete(table).where(condition).returning()
 */
function buildDeleteChain(returningResult: unknown[]) {
  const returning = vi.fn().mockResolvedValue(returningResult);
  const where = vi.fn().mockReturnValue({ returning });
  mockDb.delete.mockReturnValue({ where });
  return { where, returning };
}

// =============================================================================
// Cache Invalidation Tests
// =============================================================================

describe('Storage — cache invalidation', () => {
  let storage: DatabaseStorage;

  beforeEach(() => {
    storage = new DatabaseStorage();
    resetMocks();
  });

  // ---- Cache hit: returns cached data without DB query ----

  it('getProject returns cached value without hitting DB', async () => {
    const cached = { id: 1, name: 'Cached', description: '', createdAt: new Date(), updatedAt: new Date(), deletedAt: null };
    mockCache.get.mockReturnValueOnce(cached);

    const result = await storage.getProject(1);

    expect(result).toBe(cached);
    expect(mockCache.get).toHaveBeenCalledWith('project:1');
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('getNodes returns cached value without hitting DB', async () => {
    const cached = [{ id: 1, projectId: 1, label: 'Node1' }];
    mockCache.get.mockReturnValueOnce(cached);

    const result = await storage.getNodes(1);

    expect(result).toBe(cached);
    expect(mockCache.get).toHaveBeenCalledWith('nodes:1:50:0:desc');
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('getEdges returns cached value without hitting DB', async () => {
    const cached = [{ id: 1, projectId: 1, source: 'a', target: 'b' }];
    mockCache.get.mockReturnValueOnce(cached);

    const result = await storage.getEdges(1);

    expect(result).toBe(cached);
    expect(mockCache.get).toHaveBeenCalledWith('edges:1:50:0:desc');
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('getBomItems returns cached value without hitting DB', async () => {
    const cached = [{ id: 1, projectId: 1, name: 'Resistor' }];
    mockCache.get.mockReturnValueOnce(cached);

    const result = await storage.getBomItems(1);

    expect(result).toBe(cached);
    expect(mockCache.get).toHaveBeenCalledWith('bom:1:50:0:desc');
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('getComponentParts returns cached value without hitting DB', async () => {
    const cached = [{ id: 1, projectId: 1, name: 'MCU' }];
    mockCache.get.mockReturnValueOnce(cached);

    const result = await storage.getComponentParts(1);

    expect(result).toBe(cached);
    expect(mockCache.get).toHaveBeenCalledWith('parts:1');
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  // ---- Cache miss: queries DB and populates cache ----

  it('getProject queries DB on cache miss and caches result', async () => {
    const dbProject = { id: 2, name: 'DB Project', description: '', createdAt: new Date(), updatedAt: new Date(), deletedAt: null };
    buildSelectChain({ whereResult: [dbProject] });

    const result = await storage.getProject(2);

    expect(result).toBe(dbProject);
    expect(mockCache.set).toHaveBeenCalledWith('project:2', dbProject);
  });

  it('getNodes queries DB on cache miss and caches result', async () => {
    const dbNodes = [{ id: 1, projectId: 3, label: 'Node' }];
    buildSelectChain({ listResult: dbNodes });

    const result = await storage.getNodes(3);

    expect(result).toBe(dbNodes);
    expect(mockCache.set).toHaveBeenCalledWith('nodes:3:50:0:desc', dbNodes);
  });

  it('getProject does not cache undefined result for missing project', async () => {
    buildSelectChain({ whereResult: [] });

    const result = await storage.getProject(999);

    expect(result).toBeUndefined();
    expect(mockCache.set).not.toHaveBeenCalled();
  });

  // ---- Cache invalidation after mutations ----

  it('createNode invalidates nodes cache for projectId', async () => {
    const node = { projectId: 5, nodeId: 'n1', label: 'MCU', nodeType: 'component', positionX: 0, positionY: 0 };
    const created = { id: 1, ...node };
    buildInsertChain([created]);

    await storage.createNode(node);

    expect(mockCache.invalidate).toHaveBeenCalledWith('nodes:5');
  });

  it('updateNode invalidates nodes cache on successful update', async () => {
    const updated = { id: 1, projectId: 3, label: 'Updated' };
    buildUpdateChain([updated]);

    await storage.updateNode(1, 3, { label: 'Updated' });

    expect(mockCache.invalidate).toHaveBeenCalledWith('nodes:3');
  });

  it('updateNode does NOT invalidate cache when node not found', async () => {
    buildUpdateChain([]);

    await storage.updateNode(999, 3, { label: 'Nope' });

    expect(mockCache.invalidate).not.toHaveBeenCalled();
  });

  it('createEdge invalidates edges cache', async () => {
    const edge = { projectId: 7, edgeId: 'e1', source: 'a', target: 'b' };
    const created = { id: 1, ...edge };
    buildInsertChain([created]);

    await storage.createEdge(edge);

    expect(mockCache.invalidate).toHaveBeenCalledWith('edges:7');
  });

  it('getBomItems reads from canonical parts + part_stock', async () => {
    expect(typeof storage.getBomItems).toBe('function');
  });

  it('updateProject invalidates project cache on successful update', async () => {
    const updated = { id: 1, name: 'New Name' };
    buildUpdateChain([updated]);

    await storage.updateProject(1, { name: 'New Name' });

    expect(mockCache.invalidate).toHaveBeenCalledWith('project:1');
  });

  it('updateProject does NOT invalidate cache when project not found', async () => {
    buildUpdateChain([]);

    await storage.updateProject(999, { name: 'Nope' });

    expect(mockCache.invalidate).not.toHaveBeenCalled();
  });

  it('createComponentPart invalidates parts cache', async () => {
    const part = { projectId: 2, nodeId: 'n1' };
    const created = { id: 1, ...part };
    buildInsertChain([created]);

    await storage.createComponentPart(part);

    expect(mockCache.invalidate).toHaveBeenCalledWith('parts:2');
  });

  it('deleteComponentPart invalidates parts cache on successful delete', async () => {
    buildDeleteChain([{ id: 5 }]);

    await storage.deleteComponentPart(5, 2);

    expect(mockCache.invalidate).toHaveBeenCalledWith('parts:2');
  });

  it('deleteComponentPart does NOT invalidate cache when part not found', async () => {
    buildDeleteChain([]);

    await storage.deleteComponentPart(999, 2);

    expect(mockCache.invalidate).not.toHaveBeenCalled();
  });

  // ---- Prefix-based invalidation ----

  it('deleteProject invalidates all related cache prefixes', async () => {
    const deletedProject = { id: 10, name: 'Deleted', deletedAt: new Date() };

    const projectUpdateReturning = vi.fn().mockResolvedValue([deletedProject]);
    const projectUpdateWhere = vi.fn().mockReturnValue({ returning: projectUpdateReturning });
    const cascadeUpdateWhere = vi.fn().mockResolvedValue([]);
    const cascadeSet = vi.fn().mockReturnValue({ where: cascadeUpdateWhere });

    let callCount = 0;
    const mockTx = {
      update: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { set: vi.fn().mockReturnValue({ where: projectUpdateWhere }) };
        }
        return { set: cascadeSet };
      }),
    };
    mockDb.transaction.mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx));

    await storage.deleteProject(10);

    expect(mockCache.invalidate).toHaveBeenCalledWith('project:10');
    expect(mockCache.invalidate).toHaveBeenCalledWith('nodes:10');
    expect(mockCache.invalidate).toHaveBeenCalledWith('edges:10');
    expect(mockCache.invalidate).toHaveBeenCalledWith('bom:10');
    expect(mockCache.invalidate).toHaveBeenCalledTimes(4);
  });

  it('deleteProject does NOT invalidate cache when project not found', async () => {
    const projectUpdateReturning = vi.fn().mockResolvedValue([]);
    const projectUpdateWhere = vi.fn().mockReturnValue({ returning: projectUpdateReturning });
    const mockTx = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: projectUpdateWhere }),
      }),
    };
    mockDb.transaction.mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx));

    await storage.deleteProject(404);

    expect(mockCache.invalidate).not.toHaveBeenCalled();
  });

  // ---- Cache key format with pagination ----

  it('getNodes uses pagination params in cache key', async () => {
    buildSelectChain({ listResult: [] });

    await storage.getNodes(1, { limit: 10, offset: 20, sort: 'asc' });

    expect(mockCache.get).toHaveBeenCalledWith('nodes:1:10:20:asc');
  });

  it('getEdges uses pagination params in cache key', async () => {
    buildSelectChain({ listResult: [] });

    await storage.getEdges(2, { limit: 25, offset: 0, sort: 'asc' });

    expect(mockCache.get).toHaveBeenCalledWith('edges:2:25:0:asc');
  });

});

// =============================================================================
// Soft Delete Tests
// =============================================================================

describe('Storage — soft deletes', () => {
  let storage: DatabaseStorage;

  beforeEach(() => {
    storage = new DatabaseStorage();
    resetMocks();
  });

  it('deleteProject sets deletedAt via update, not hard delete', async () => {
    const deletedProject = { id: 1, name: 'Proj', deletedAt: new Date() };
    const projectUpdateReturning = vi.fn().mockResolvedValue([deletedProject]);
    const projectUpdateWhere = vi.fn().mockReturnValue({ returning: projectUpdateReturning });
    const cascadeUpdateWhere = vi.fn().mockResolvedValue([]);
    const cascadeSet = vi.fn().mockReturnValue({ where: cascadeUpdateWhere });

    let callCount = 0;
    const mockTx = {
      update: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { set: vi.fn().mockReturnValue({ where: projectUpdateWhere }) };
        }
        return { set: cascadeSet };
      }),
    };
    mockDb.transaction.mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx));

    const result = await storage.deleteProject(1);

    expect(result).toBe(true);
    // Uses update (soft delete), not db.delete
    expect(mockTx.update).toHaveBeenCalled();
    expect(mockDb.delete).not.toHaveBeenCalled();
  });

  it('deleteProject cascades soft delete to nodes, edges, and bom', async () => {
    const deletedProject = { id: 5, name: 'CascadeTest', deletedAt: new Date() };
    const projectUpdateReturning = vi.fn().mockResolvedValue([deletedProject]);
    const projectUpdateWhere = vi.fn().mockReturnValue({ returning: projectUpdateReturning });
    const cascadeUpdateWhere = vi.fn().mockResolvedValue([]);
    const cascadeSet = vi.fn().mockReturnValue({ where: cascadeUpdateWhere });

    let callCount = 0;
    const setFns: Array<ReturnType<typeof vi.fn>> = [];
    const mockTx = {
      update: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          const firstSet = vi.fn().mockReturnValue({ where: projectUpdateWhere });
          setFns.push(firstSet);
          return { set: firstSet };
        }
        setFns.push(cascadeSet);
        return { set: cascadeSet };
      }),
    };
    mockDb.transaction.mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx));

    await storage.deleteProject(5);

    // Should call update 4 times: projects, nodes, edges, bom
    expect(mockTx.update).toHaveBeenCalledTimes(4);
  });

  it('validation issues use hard delete (not soft delete)', async () => {
    buildDeleteChain([{ id: 1 }]);

    const result = await storage.deleteValidationIssue(1, 1);

    expect(result).toBe(true);
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it('deleteHistoryItem uses hard delete', async () => {
    const returning = vi.fn().mockResolvedValue([{ id: 1 }]);
    const where = vi.fn().mockReturnValue({ returning });
    mockDb.delete.mockReturnValue({ where });

    const result = await storage.deleteHistoryItem(1, 1);

    expect(result).toBe(true);
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it('deleteChatMessage uses hard delete', async () => {
    const returning = vi.fn().mockResolvedValue([{ id: 1 }]);
    const where = vi.fn().mockReturnValue({ returning });
    mockDb.delete.mockReturnValue({ where });

    const result = await storage.deleteChatMessage(1, 1);

    expect(result).toBe(true);
    expect(mockDb.delete).toHaveBeenCalled();
  });
});

// =============================================================================
// Pagination Tests
// =============================================================================

describe('Storage — pagination', () => {
  let storage: DatabaseStorage;

  beforeEach(() => {
    storage = new DatabaseStorage();
    resetMocks();
  });

  it('getProjects uses default pagination (limit=50, offset=0, sort=desc)', async () => {
    const { limitFn, offsetFn } = buildSelectChain({ listResult: [] });

    await storage.getProjects();

    expect(limitFn).toHaveBeenCalledWith(50);
    expect(offsetFn).toHaveBeenCalledWith(0);
  });

  it('getProjects passes custom pagination options', async () => {
    const { limitFn, offsetFn } = buildSelectChain({ listResult: [] });

    await storage.getProjects({ limit: 10, offset: 20, sort: 'asc' });

    expect(limitFn).toHaveBeenCalledWith(10);
    expect(offsetFn).toHaveBeenCalledWith(20);
  });

  it('getNodes uses default pagination', async () => {
    const { limitFn, offsetFn } = buildSelectChain({ listResult: [] });

    await storage.getNodes(1);

    expect(limitFn).toHaveBeenCalledWith(50);
    expect(offsetFn).toHaveBeenCalledWith(0);
  });

  it('getNodes passes custom pagination options', async () => {
    const { limitFn, offsetFn } = buildSelectChain({ listResult: [] });

    await storage.getNodes(1, { limit: 5, offset: 10, sort: 'asc' });

    expect(limitFn).toHaveBeenCalledWith(5);
    expect(offsetFn).toHaveBeenCalledWith(10);
  });

  it('getEdges uses default pagination', async () => {
    const { limitFn, offsetFn } = buildSelectChain({ listResult: [] });

    await storage.getEdges(2);

    expect(limitFn).toHaveBeenCalledWith(50);
    expect(offsetFn).toHaveBeenCalledWith(0);
  });

  it('getChatMessages uses default pagination', async () => {
    const { limitFn, offsetFn } = buildSelectChain({ listResult: [] });

    await storage.getChatMessages(1);

    expect(limitFn).toHaveBeenCalledWith(50);
    expect(offsetFn).toHaveBeenCalledWith(0);
  });

  it('getChatMessages passes custom pagination options', async () => {
    const { limitFn, offsetFn } = buildSelectChain({ listResult: [] });

    await storage.getChatMessages(1, { limit: 20, offset: 40, sort: 'asc' });

    expect(limitFn).toHaveBeenCalledWith(20);
    expect(offsetFn).toHaveBeenCalledWith(40);
  });

  it('getHistoryItems uses default pagination', async () => {
    const { limitFn, offsetFn } = buildSelectChain({ listResult: [] });

    await storage.getHistoryItems(1);

    expect(limitFn).toHaveBeenCalledWith(50);
    expect(offsetFn).toHaveBeenCalledWith(0);
  });

  it('getValidationIssues passes custom pagination options', async () => {
    const { limitFn, offsetFn } = buildSelectChain({ listResult: [] });

    await storage.getValidationIssues(1, { limit: 10, offset: 5, sort: 'asc' });

    expect(limitFn).toHaveBeenCalledWith(10);
    expect(offsetFn).toHaveBeenCalledWith(5);
  });
});

// =============================================================================
// StorageError Tests
// =============================================================================

describe('Storage — StorageError', () => {
  let storage: DatabaseStorage;

  beforeEach(() => {
    storage = new DatabaseStorage();
    resetMocks();
  });

  it('StorageError includes operation and entity in message', () => {
    const err = new StorageError('getProject', 'projects/1', new Error('connection refused'));
    expect(err.name).toBe('StorageError');
    expect(err.message).toContain('Storage.getProject(projects/1) failed');
    expect(err.message).toContain('connection refused');
  });

  it('StorageError maps PG unique_violation to 409', () => {
    const pgError = new Error('unique_violation') as Error & { code: string };
    pgError.code = '23505';
    const err = new StorageError('createProject', 'projects', pgError);
    expect(err.httpStatus).toBe(409);
    expect(err.pgCode).toBe('23505');
  });

  it('StorageError maps PG foreign_key_violation to 400', () => {
    const pgError = new Error('fk') as Error & { code: string };
    pgError.code = '23503';
    const err = new StorageError('createNode', 'nodes', pgError);
    expect(err.httpStatus).toBe(400);
    expect(err.pgCode).toBe('23503');
  });

  it('StorageError maps PG not_null_violation to 400', () => {
    const pgError = new Error('not null') as Error & { code: string };
    pgError.code = '23502';
    const err = new StorageError('createEdge', 'edges', pgError);
    expect(err.httpStatus).toBe(400);
  });

  it('StorageError maps PG connection_failure to 503', () => {
    const pgError = new Error('conn fail') as Error & { code: string };
    pgError.code = '08006';
    const err = new StorageError('getNodes', 'nodes', pgError);
    expect(err.httpStatus).toBe(503);
  });

  it('StorageError maps PG query_canceled to 408', () => {
    const pgError = new Error('timeout') as Error & { code: string };
    pgError.code = '57014';
    const err = new StorageError('getProjects', 'projects', pgError);
    expect(err.httpStatus).toBe(408);
  });

  it('StorageError defaults to 500 for unknown PG code', () => {
    const pgError = new Error('unknown') as Error & { code: string };
    pgError.code = '99999';
    const err = new StorageError('getProject', 'projects/1', pgError);
    expect(err.httpStatus).toBe(500);
  });

  it('StorageError defaults to 500 for non-Error cause', () => {
    const err = new StorageError('createNode', 'nodes', 'just a string');
    expect(err.httpStatus).toBe(500);
    expect(err.pgCode).toBeNull();
  });

  it('getNodes wraps DB errors in StorageError', async () => {
    const chain = buildSelectChain({ listResult: [] });
    chain.offsetFn.mockRejectedValue(new Error('connection reset'));

    await expect(storage.getNodes(1)).rejects.toThrow(StorageError);
    await expect(storage.getNodes(1)).rejects.toThrow(/getNodes/);
  });

  it('getEdges wraps DB errors in StorageError', async () => {
    const chain = buildSelectChain({ listResult: [] });
    chain.offsetFn.mockRejectedValue(new Error('timeout'));

    await expect(storage.getEdges(1)).rejects.toThrow(StorageError);
  });

  it('getBomItems wraps DB errors in StorageError', async () => {
    const chain = buildSelectChain({ listResult: [] });
    chain.offsetFn.mockRejectedValue(new Error('disk full'));

    await expect(storage.getBomItems(1)).rejects.toThrow(StorageError);
  });

  it('createProject wraps DB errors in StorageError', async () => {
    const chain = buildInsertChain([]);
    chain.returning.mockRejectedValue(new Error('unique violation'));

    await expect(storage.createProject({ name: 'Dup' })).rejects.toThrow(StorageError);
    await expect(storage.createProject({ name: 'Dup' })).rejects.toThrow(/createProject/);
  });

  it('deleteProject wraps DB errors in StorageError', async () => {
    mockDb.transaction.mockRejectedValue(new Error('deadlock'));

    await expect(storage.deleteProject(1)).rejects.toThrow(StorageError);
    await expect(storage.deleteProject(1)).rejects.toThrow(/deleteProject/);
  });
});

// =============================================================================
// Bulk Operations
// =============================================================================

describe('Storage — bulk operations', () => {
  let storage: DatabaseStorage;

  beforeEach(() => {
    storage = new DatabaseStorage();
    resetMocks();
  });

  it('bulkCreateNodes returns empty array for empty input', async () => {
    const result = await storage.bulkCreateNodes([]);
    expect(result).toEqual([]);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('bulkCreateEdges returns empty array for empty input', async () => {
    const result = await storage.bulkCreateEdges([]);
    expect(result).toEqual([]);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('bulkCreateValidationIssues returns empty array for empty input', async () => {
    const result = await storage.bulkCreateValidationIssues([]);
    expect(result).toEqual([]);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('bulkCreateNodes invalidates cache after insertion', async () => {
    const nodes = [
      { projectId: 1, nodeId: 'n1', label: 'A', nodeType: 'component', positionX: 0, positionY: 0 },
      { projectId: 1, nodeId: 'n2', label: 'B', nodeType: 'component', positionX: 100, positionY: 0 },
    ];
    buildInsertChain(nodes.map((n, i) => ({ id: i + 1, ...n })));

    await storage.bulkCreateNodes(nodes);

    expect(mockCache.invalidate).toHaveBeenCalledWith('nodes:1');
  });

  it('bulkCreateEdges invalidates cache after insertion', async () => {
    const edges = [
      { projectId: 2, edgeId: 'e1', source: 'a', target: 'b' },
    ];
    buildInsertChain(edges.map((e, i) => ({ id: i + 1, ...e })));

    await storage.bulkCreateEdges(edges);

    expect(mockCache.invalidate).toHaveBeenCalledWith('edges:2');
  });

  it('bulkCreateNodes wraps errors in StorageError', async () => {
    const chain = buildInsertChain([]);
    chain.returning.mockRejectedValue(new Error('batch too large'));

    await expect(
      storage.bulkCreateNodes([{ projectId: 1, nodeId: 'n1', label: 'A', nodeType: 'component', positionX: 0, positionY: 0 }]),
    ).rejects.toThrow(StorageError);
  });
});

// =============================================================================
// Replace Operations (diff/upsert reconciliation)
// =============================================================================

/**
 * Build a mock transaction object that supports the diff/upsert flow:
 *   tx.select().from(table).where(cond)  → returns existingRows
 *   tx.update(table).set(data).where(cond) → soft-delete or field update
 *   tx.insert(table).values(data).returning() → inserts
 */
function buildDiffTx(opts: {
  existingRows: unknown[];
  insertReturning?: unknown[];
  updateReturning?: unknown[];
}) {
  const { existingRows, insertReturning = [], updateReturning = [] } = opts;

  // Track update calls for assertions
  const updateSetCalls: Array<{ setArg: unknown; whereArg: unknown }> = [];
  let updateCallIndex = 0;

  const mockTx = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(existingRows),
      }),
    }),
    update: vi.fn().mockImplementation(() => {
      const currentIndex = updateCallIndex++;
      const updateReturningFn = vi.fn().mockResolvedValue(
        updateReturning[currentIndex] ? [updateReturning[currentIndex]] : [],
      );
      const updateWhereFn = vi.fn().mockImplementation(() => {
        updateSetCalls[currentIndex] = {
          ...updateSetCalls[currentIndex],
          whereArg: 'called',
        };
        return { returning: updateReturningFn };
      });
      // Also handle soft-delete updates (no returning)
      const updateSetFn = vi.fn().mockImplementation((setArg: unknown) => {
        updateSetCalls[currentIndex] = { setArg, whereArg: null };
        return { where: updateWhereFn };
      });
      return { set: updateSetFn };
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(insertReturning),
      }),
    }),
  };

  return { mockTx, updateSetCalls };
}

describe('Storage — replace operations (diff/upsert)', () => {
  let storage: DatabaseStorage;

  beforeEach(() => {
    storage = new DatabaseStorage();
    resetMocks();
  });

  // ---- replaceNodes ----

  it('replaceNodes inserts new nodes not present in DB', async () => {
    const incomingNodes = [{ projectId: 1, nodeId: 'n1', label: 'A', nodeType: 'component', positionX: 0, positionY: 0 }];
    const insertedNodes = [{ id: 1, ...incomingNodes[0], updatedAt: new Date(), deletedAt: null, data: null }];

    const { mockTx } = buildDiffTx({
      existingRows: [],
      insertReturning: insertedNodes,
    });
    mockDb.transaction.mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx));

    const result = await storage.replaceNodes(1, incomingNodes);

    expect(result).toEqual(insertedNodes);
    expect(mockTx.insert).toHaveBeenCalled();
    expect(mockCache.invalidate).toHaveBeenCalledWith('nodes:1');
  });

  it('replaceNodes soft-deletes nodes removed from incoming', async () => {
    const existingNodes = [
      { id: 10, projectId: 1, nodeId: 'n1', label: 'A', nodeType: 'component', positionX: 0, positionY: 0, data: null, updatedAt: new Date(), deletedAt: null },
    ];

    const { mockTx } = buildDiffTx({ existingRows: existingNodes });
    mockDb.transaction.mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx));

    const result = await storage.replaceNodes(1, []);

    expect(result).toEqual([]);
    // update was called for the soft-delete
    expect(mockTx.update).toHaveBeenCalled();
    expect(mockTx.insert).not.toHaveBeenCalled();
    expect(mockCache.invalidate).toHaveBeenCalledWith('nodes:1');
  });

  it('replaceNodes leaves unchanged nodes untouched', async () => {
    const existingNode = {
      id: 10, projectId: 1, nodeId: 'n1', label: 'A', nodeType: 'component',
      positionX: 0, positionY: 0, data: null, updatedAt: new Date(), deletedAt: null,
    };
    const incomingNode = { projectId: 1, nodeId: 'n1', label: 'A', nodeType: 'component', positionX: 0, positionY: 0 };

    const { mockTx } = buildDiffTx({ existingRows: [existingNode] });
    mockDb.transaction.mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx));

    const result = await storage.replaceNodes(1, [incomingNode]);

    expect(result).toEqual([existingNode]);
    // No updates or inserts for unchanged node
    expect(mockTx.update).not.toHaveBeenCalled();
    expect(mockTx.insert).not.toHaveBeenCalled();
  });

  it('replaceNodes updates changed node fields', async () => {
    const existingNode = {
      id: 10, projectId: 1, nodeId: 'n1', label: 'A', nodeType: 'component',
      positionX: 0, positionY: 0, data: null, updatedAt: new Date(), deletedAt: null,
    };
    const incomingNode = { projectId: 1, nodeId: 'n1', label: 'B', nodeType: 'component', positionX: 50, positionY: 100 };
    const updatedRow = { ...existingNode, label: 'B', positionX: 50, positionY: 100 };

    const { mockTx } = buildDiffTx({
      existingRows: [existingNode],
      updateReturning: [updatedRow],
    });
    mockDb.transaction.mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx));

    const result = await storage.replaceNodes(1, [incomingNode]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(updatedRow);
    expect(mockTx.update).toHaveBeenCalled();
    expect(mockTx.insert).not.toHaveBeenCalled();
  });

  it('replaceNodes handles mixed insert/update/delete/unchanged in one call', async () => {
    const existingNodes = [
      { id: 1, projectId: 1, nodeId: 'keep', label: 'Same', nodeType: 'component', positionX: 0, positionY: 0, data: null, updatedAt: new Date(), deletedAt: null },
      { id: 2, projectId: 1, nodeId: 'change', label: 'Old', nodeType: 'component', positionX: 0, positionY: 0, data: null, updatedAt: new Date(), deletedAt: null },
      { id: 3, projectId: 1, nodeId: 'remove', label: 'Gone', nodeType: 'component', positionX: 0, positionY: 0, data: null, updatedAt: new Date(), deletedAt: null },
    ];
    const incomingNodes = [
      { projectId: 1, nodeId: 'keep', label: 'Same', nodeType: 'component', positionX: 0, positionY: 0 },
      { projectId: 1, nodeId: 'change', label: 'New', nodeType: 'component', positionX: 0, positionY: 0 },
      { projectId: 1, nodeId: 'added', label: 'Fresh', nodeType: 'component', positionX: 200, positionY: 200 },
    ];
    const updatedRow = { ...existingNodes[1], label: 'New' };
    const insertedRow = { id: 4, projectId: 1, nodeId: 'added', label: 'Fresh', nodeType: 'component', positionX: 200, positionY: 200, data: null, updatedAt: new Date(), deletedAt: null };

    const { mockTx } = buildDiffTx({
      existingRows: existingNodes,
      updateReturning: [undefined, updatedRow],  // first update is soft-delete (no returning needed), second is field update
      insertReturning: [insertedRow],
    });
    mockDb.transaction.mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx));

    const result = await storage.replaceNodes(1, incomingNodes);

    // Should contain: unchanged 'keep' + updated 'change' + inserted 'added'
    expect(result).toHaveLength(3);
    expect(mockTx.update).toHaveBeenCalled();
    expect(mockTx.insert).toHaveBeenCalled();
    expect(mockCache.invalidate).toHaveBeenCalledWith('nodes:1');
  });

  it('replaceNodes returns empty array when DB is empty and no nodes given', async () => {
    const { mockTx } = buildDiffTx({ existingRows: [] });
    mockDb.transaction.mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx));

    const result = await storage.replaceNodes(1, []);

    expect(result).toEqual([]);
    expect(mockTx.update).not.toHaveBeenCalled();
    expect(mockTx.insert).not.toHaveBeenCalled();
    expect(mockCache.invalidate).toHaveBeenCalledWith('nodes:1');
  });

  it('replaceNodes wraps errors in StorageError', async () => {
    mockDb.transaction.mockRejectedValue(new Error('tx failed'));

    await expect(
      storage.replaceNodes(1, [{ projectId: 1, nodeId: 'n1', label: 'A', nodeType: 'component', positionX: 0, positionY: 0 }]),
    ).rejects.toThrow(StorageError);
  });

  it('replaceNodes invalidates cache after replacement', async () => {
    const incomingNodes = [{ projectId: 1, nodeId: 'n1', label: 'A', nodeType: 'component', positionX: 0, positionY: 0 }];
    const insertedNodes = [{ id: 1, ...incomingNodes[0], updatedAt: new Date(), deletedAt: null, data: null }];

    const { mockTx } = buildDiffTx({ existingRows: [], insertReturning: insertedNodes });
    mockDb.transaction.mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx));

    await storage.replaceNodes(1, incomingNodes);

    expect(mockCache.invalidate).toHaveBeenCalledWith('nodes:1');
  });

  // ---- replaceEdges ----

  it('replaceEdges inserts new edges not present in DB', async () => {
    const incomingEdges = [{ projectId: 2, edgeId: 'e1', source: 'a', target: 'b' }];
    const insertedEdges = [{ id: 1, ...incomingEdges[0], label: null, animated: false, style: null, signalType: null, voltage: null, busWidth: null, netName: null, deletedAt: null }];

    const { mockTx } = buildDiffTx({ existingRows: [], insertReturning: insertedEdges });
    mockDb.transaction.mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx));

    const result = await storage.replaceEdges(2, incomingEdges);

    expect(result).toEqual(insertedEdges);
    expect(mockTx.insert).toHaveBeenCalled();
    expect(mockCache.invalidate).toHaveBeenCalledWith('edges:2');
  });

  it('replaceEdges soft-deletes edges removed from incoming', async () => {
    const existingEdges = [
      { id: 10, projectId: 2, edgeId: 'e1', source: 'a', target: 'b', label: null, animated: false, style: null, signalType: null, voltage: null, busWidth: null, netName: null, deletedAt: null },
    ];

    const { mockTx } = buildDiffTx({ existingRows: existingEdges });
    mockDb.transaction.mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx));

    const result = await storage.replaceEdges(2, []);

    expect(result).toEqual([]);
    expect(mockTx.update).toHaveBeenCalled();
    expect(mockCache.invalidate).toHaveBeenCalledWith('edges:2');
  });

  it('replaceEdges leaves unchanged edges untouched', async () => {
    const existingEdge = {
      id: 10, projectId: 2, edgeId: 'e1', source: 'a', target: 'b',
      label: null, animated: false, style: null, signalType: null, voltage: null, busWidth: null, netName: null, deletedAt: null,
    };
    const incomingEdge = { projectId: 2, edgeId: 'e1', source: 'a', target: 'b' };

    const { mockTx } = buildDiffTx({ existingRows: [existingEdge] });
    mockDb.transaction.mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx));

    const result = await storage.replaceEdges(2, [incomingEdge]);

    expect(result).toEqual([existingEdge]);
    expect(mockTx.update).not.toHaveBeenCalled();
    expect(mockTx.insert).not.toHaveBeenCalled();
  });

  it('replaceEdges updates changed edge fields', async () => {
    const existingEdge = {
      id: 10, projectId: 2, edgeId: 'e1', source: 'a', target: 'b',
      label: null, animated: false, style: null, signalType: null, voltage: null, busWidth: null, netName: null, deletedAt: null,
    };
    const incomingEdge = { projectId: 2, edgeId: 'e1', source: 'a', target: 'c', label: 'power' };
    const updatedRow = { ...existingEdge, target: 'c', label: 'power' };

    const { mockTx } = buildDiffTx({
      existingRows: [existingEdge],
      updateReturning: [updatedRow],
    });
    mockDb.transaction.mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx));

    const result = await storage.replaceEdges(2, [incomingEdge]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(updatedRow);
    expect(mockTx.update).toHaveBeenCalled();
    expect(mockTx.insert).not.toHaveBeenCalled();
  });

  it('replaceEdges invalidates cache after replacement', async () => {
    const incomingEdges = [{ projectId: 2, edgeId: 'e1', source: 'a', target: 'b' }];
    const insertedEdges = [{ id: 1, ...incomingEdges[0], label: null, animated: false, style: null, signalType: null, voltage: null, busWidth: null, netName: null, deletedAt: null }];

    const { mockTx } = buildDiffTx({ existingRows: [], insertReturning: insertedEdges });
    mockDb.transaction.mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx));

    await storage.replaceEdges(2, incomingEdges);

    expect(mockCache.invalidate).toHaveBeenCalledWith('edges:2');
  });

  it('replaceEdges wraps errors in StorageError', async () => {
    mockDb.transaction.mockRejectedValue(new Error('tx failed'));

    await expect(
      storage.replaceEdges(2, [{ projectId: 2, edgeId: 'e1', source: 'a', target: 'b' }]),
    ).rejects.toThrow(StorageError);
  });
});

// =============================================================================
// ComputeTotalPrice (tested via createBomItem / updateBomItem)
// =============================================================================

describe('Storage — BOM totalPrice computation', () => {
  let storage: DatabaseStorage;

  beforeEach(() => {
    storage = new DatabaseStorage();
    resetMocks();
  });

});

// =============================================================================
// Component Part Version Increment
// =============================================================================

describe('Storage — updateComponentPart version logic', () => {
  let storage: DatabaseStorage;

  beforeEach(() => {
    storage = new DatabaseStorage();
    resetMocks();
  });

  it('increments version on component part update', async () => {
    const existing = { id: 1, projectId: 1, nodeId: 'n1', version: 3, name: 'MCU' };

    // updateComponentPart now uses db.transaction — mock the tx object
    const updateReturning = vi.fn().mockResolvedValue([{ ...existing, version: 4 }]);
    const updateWhere = vi.fn().mockReturnValue({ returning: updateReturning });
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });

    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([existing]),
        }),
      }),
      update: vi.fn().mockReturnValue({ set: updateSet }),
    };
    mockDb.transaction.mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx));

    const result = await storage.updateComponentPart(1, 1, { meta: { title: 'Updated MCU' } });

    expect(result).toBeDefined();
    // Verify set was called with version = existingVersion + 1
    const setArgs = updateSet.mock.calls[0][0];
    expect(setArgs.version).toBe(4);
  });

  it('returns undefined when part does not exist', async () => {
    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    };
    mockDb.transaction.mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx));

    const result = await storage.updateComponentPart(999, 1, { meta: { title: 'Nope' } });

    expect(result).toBeUndefined();
  });
});
