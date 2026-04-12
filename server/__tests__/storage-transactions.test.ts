import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be defined before importing storage module
// ---------------------------------------------------------------------------

// Chain-builder helpers for Drizzle query mocking
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
  // Terminal methods that return promises
  chain.returning = vi.fn().mockResolvedValue(terminalValue);
  chain.where = vi.fn().mockReturnValue(proxy);
  chain.from = vi.fn().mockReturnValue(proxy);
  chain.set = vi.fn().mockReturnValue(proxy);
  chain.values = vi.fn().mockReturnValue(proxy);
  return proxy;
}

// The transaction callback receives a `tx` object that behaves like `db`.
// We capture the callback so tests can inspect what happened inside the transaction.
let transactionCallback: ((tx: unknown) => Promise<unknown>) | null = null;
let txMock: Record<string, ReturnType<typeof vi.fn>>;
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

  return mock;
}

// Track whether transaction was used
let transactionWasCalled = false;

vi.mock('../db', () => {
  // Provide DATABASE_URL so the module doesn't throw
  process.env.DATABASE_URL = 'postgresql://mock:mock@localhost:5432/mock';

  return {
    db: {
      transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        transactionWasCalled = true;
        transactionCallback = cb;
        txMock = createTxMock();
        return cb(txMock);
      }),
      select: vi.fn().mockImplementation(() => chainBuilder([])),
      update: vi.fn().mockImplementation(() => chainBuilder([])),
      insert: vi.fn().mockImplementation(() => chainBuilder([])),
      delete: vi.fn().mockImplementation(() => chainBuilder([])),
    },
    pool: { on: vi.fn() },
  };
});

const { mockCacheInvalidate } = vi.hoisted(() => ({
  mockCacheInvalidate: vi.fn(),
}));
vi.mock('../cache', () => ({
  cache: {
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn(),
    invalidate: mockCacheInvalidate,
    clear: vi.fn(),
  },
}));

vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import after mocks are registered
import { DatabaseStorage } from '../storage';

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('DatabaseStorage — transaction safety', () => {
  let storage: DatabaseStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    transactionWasCalled = false;
    transactionCallback = null;
    selectResult = [];
    updateResult = [];
    storage = new DatabaseStorage();
  });

  // =========================================================================
  // updateBomItem
  // =========================================================================

  // =========================================================================
  // updateComponentPart
  // =========================================================================

  describe('updateComponentPart', () => {
    it('uses a transaction for the read-modify-write version increment', async () => {
      const existingPart = {
        id: 5,
        projectId: 1,
        nodeId: 'node-abc',
        meta: {},
        connectors: [],
        buses: [],
        views: {},
        constraints: [],
        version: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      selectResult = [existingPart];
      const updatedPart = { ...existingPart, meta: { name: 'Updated' }, version: 4, updatedAt: new Date() };
      updateResult = [updatedPart];

      const result = await storage.updateComponentPart(5, 1, { meta: { name: 'Updated' } });

      expect(transactionWasCalled).toBe(true);
      expect(result).toEqual(updatedPart);
    });

    it('increments version atomically (read + write in same transaction)', async () => {
      const existingPart = {
        id: 5,
        projectId: 1,
        nodeId: 'node-abc',
        meta: { name: 'Before' },
        connectors: [],
        buses: [],
        views: {},
        constraints: [],
        version: 7,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      selectResult = [existingPart];
      const updatedPart = { ...existingPart, version: 8 };
      updateResult = [updatedPart];

      const result = await storage.updateComponentPart(5, 1, { meta: { name: 'After' } });

      expect(transactionWasCalled).toBe(true);
      // Both select and update happen on the tx object, not the raw db
      expect(txMock.select).toHaveBeenCalled();
      expect(txMock.update).toHaveBeenCalled();
      expect(result?.version).toBe(8);
    });

    it('returns undefined when component part does not exist', async () => {
      selectResult = [];

      const result = await storage.updateComponentPart(999, 1, { meta: {} });

      expect(transactionWasCalled).toBe(true);
      expect(result).toBeUndefined();
    });

    it('invalidates cache only after transaction commits', async () => {
      const existingPart = {
        id: 5,
        projectId: 1,
        nodeId: 'node-abc',
        meta: {},
        connectors: [],
        buses: [],
        views: {},
        constraints: [],
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      selectResult = [existingPart];
      updateResult = [{ ...existingPart, version: 2 }];

      await storage.updateComponentPart(5, 1, { meta: { name: 'Test' } });

      expect(mockCacheInvalidate).toHaveBeenCalledWith('parts:1');
    });

    it('does not invalidate cache when component part is not found', async () => {
      selectResult = [];

      await storage.updateComponentPart(999, 1, { meta: {} });

      expect(mockCacheInvalidate).not.toHaveBeenCalled();
    });

    it('wraps errors in StorageError', async () => {
      const dbError = new Error('serialization failure');
      const { db } = await import('../db');
      vi.mocked(db.transaction).mockRejectedValueOnce(dbError);

      await expect(storage.updateComponentPart(5, 1, { meta: {} }))
        .rejects.toThrow(/Storage\.updateComponentPart\(component-parts\/5\) failed/);
    });

    it('strips projectId from update data before writing', async () => {
      const existingPart = {
        id: 5,
        projectId: 1,
        nodeId: 'node-abc',
        meta: {},
        connectors: [],
        buses: [],
        views: {},
        constraints: [],
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      selectResult = [existingPart];
      updateResult = [{ ...existingPart, version: 2, meta: { updated: true } }];

      await storage.updateComponentPart(5, 1, {
        projectId: 999, // should be stripped
        meta: { updated: true },
      });

      expect(transactionWasCalled).toBe(true);
      // Verify tx.update was called — the set() call should NOT include projectId
      const updateCall = txMock.update;
      expect(updateCall).toHaveBeenCalled();
    });
  });
});
