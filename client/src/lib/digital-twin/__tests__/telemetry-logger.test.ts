/**
 * TelemetryLogger tests
 *
 * Uses a minimal in-memory IndexedDB mock for the happy-dom test environment.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TelemetryLogger } from '../telemetry-logger';
import type { TelemetryFrame } from '../telemetry-protocol';

// ---------------------------------------------------------------------------
// IndexedDB mock (in-memory, synchronous-style via microtask scheduling)
// ---------------------------------------------------------------------------

function createMockIndexedDB() {
  const stores = new Map<string, Map<number, Record<string, unknown>>>();
  let autoId = 0;

  interface MockIndex {
    name: string;
    keyPath: string | string[];
    openCursor: (range?: IDBKeyRange | null, direction?: string) => IDBRequest;
    openKeyCursor: (range?: IDBKeyRange | null, direction?: string) => IDBRequest;
  }

  interface MockStore {
    name: string;
    indexes: Map<string, MockIndex>;
    add: (value: Record<string, unknown>) => IDBRequest;
    count: () => IDBRequest;
    clear: () => IDBRequest;
    createIndex: (name: string, keyPath: string | string[], options?: { unique?: boolean }) => MockIndex;
    index: (name: string) => MockIndex;
  }

  interface MockTx {
    objectStore: (name?: string) => MockStore;
    oncomplete: (() => void) | null;
    onerror: (() => void) | null;
    error: null;
  }

  function getEntryKey(entry: Record<string, unknown>, keyPath: string | string[]): unknown {
    if (Array.isArray(keyPath)) {
      return keyPath.map((k) => entry[k]);
    }
    return entry[keyPath];
  }

  function inRange(key: unknown, range: IDBKeyRange | null | undefined): boolean {
    if (!range) {
      return true;
    }
    const r = range as { lower?: unknown; upper?: unknown; lowerOpen?: boolean; upperOpen?: boolean };
    if (Array.isArray(key) && Array.isArray(r.lower)) {
      for (let i = 0; i < Math.max(key.length, (r.lower as unknown[]).length); i++) {
        const k = (key as unknown[])[i] as number;
        const lo = r.lower ? (r.lower as unknown[])[i] as number : -Infinity;
        const hi = r.upper ? (r.upper as unknown[])[i] as number : Infinity;
        if (i === 0) {
          if (k !== lo) {
            return false;
          }
          continue;
        }
        if (r.lowerOpen ? k <= lo : k < lo) {
          return false;
        }
        if (r.upperOpen ? k >= hi : k > hi) {
          return false;
        }
      }
      return true;
    }
    const numKey = key as number;
    if (r.lower !== undefined) {
      if (r.lowerOpen ? numKey <= (r.lower as number) : numKey < (r.lower as number)) {
        return false;
      }
    }
    if (r.upper !== undefined) {
      if (r.upperOpen ? numKey >= (r.upper as number) : numKey > (r.upper as number)) {
        return false;
      }
    }
    return true;
  }

  function createMockStore(storeName: string): MockStore {
    if (!stores.has(storeName)) {
      stores.set(storeName, new Map());
    }
    const data = stores.get(storeName)!;
    const indexes = new Map<string, MockIndex>();

    function makeOpenCursor(
      keyPath: string | string[],
      range: IDBKeyRange | null | undefined,
      direction: string,
    ): IDBRequest {
      const entries: Array<{ key: unknown; value: Record<string, unknown>; primaryKey: number }> = [];
      for (const [id, entry] of Array.from(data.entries())) {
        const key = getEntryKey(entry, keyPath);
        if (inRange(key, range)) {
          entries.push({ key, value: entry, primaryKey: id });
        }
      }

      entries.sort((a, b) => {
        const aKey = Array.isArray(a.key) ? (a.key as number[]).join(',') : String(a.key);
        const bKey = Array.isArray(b.key) ? (b.key as number[]).join(',') : String(b.key);
        return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
      });

      if (direction === 'prev') {
        entries.reverse();
      }

      let idx = 0;
      const request = {
        result: null as unknown,
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        error: null,
      };

      function advance() {
        if (idx >= entries.length) {
          request.result = null;
        } else {
          const entry = entries[idx];
          request.result = {
            key: entry.key,
            value: entry.value,
            primaryKey: entry.primaryKey,
            continue: () => {
              idx++;
              Promise.resolve().then(() => {
                advance();
                if (request.onsuccess) {
                  request.onsuccess();
                }
              });
            },
            delete: () => {
              data.delete(entry.primaryKey);
            },
          };
        }
      }

      Promise.resolve().then(() => {
        advance();
        if (request.onsuccess) {
          request.onsuccess();
        }
      });

      return request as unknown as IDBRequest;
    }

    function makeKeyCursor(
      keyPath: string | string[],
      _range: IDBKeyRange | null | undefined,
      direction: string,
    ): IDBRequest {
      const seen = new Set<string>();
      const entries: Array<{ key: unknown }> = [];
      for (const entry of Array.from(data.values())) {
        const key = getEntryKey(entry, keyPath);
        const keyStr = String(key);
        if (!seen.has(keyStr)) {
          seen.add(keyStr);
          entries.push({ key });
        }
      }

      if (direction === 'prev') {
        entries.reverse();
      }

      let idx = 0;
      const request = {
        result: null as unknown,
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        error: null,
      };

      function advance() {
        if (idx >= entries.length) {
          request.result = null;
        } else {
          request.result = {
            key: entries[idx].key,
            continue: () => {
              idx++;
              Promise.resolve().then(() => {
                advance();
                if (request.onsuccess) {
                  request.onsuccess();
                }
              });
            },
          };
        }
      }

      Promise.resolve().then(() => {
        advance();
        if (request.onsuccess) {
          request.onsuccess();
        }
      });

      return request as unknown as IDBRequest;
    }

    const store: MockStore = {
      name: storeName,
      indexes,
      add: (value: Record<string, unknown>) => {
        const id = ++autoId;
        const entry = { ...value, id };
        data.set(id, entry);
        const request = { result: id, onsuccess: null as (() => void) | null, onerror: null, error: null };
        Promise.resolve().then(() => {
          if (request.onsuccess) {
            request.onsuccess();
          }
        });
        return request as unknown as IDBRequest;
      },
      count: () => {
        const request = {
          result: data.size,
          onsuccess: null as (() => void) | null,
          onerror: null,
          error: null,
        };
        Promise.resolve().then(() => {
          if (request.onsuccess) {
            request.onsuccess();
          }
        });
        return request as unknown as IDBRequest;
      },
      clear: () => {
        data.clear();
        const request = { result: undefined, onsuccess: null as (() => void) | null, onerror: null, error: null };
        Promise.resolve().then(() => {
          if (request.onsuccess) {
            request.onsuccess();
          }
        });
        return request as unknown as IDBRequest;
      },
      createIndex: (name: string, keyPath: string | string[]) => {
        const idx: MockIndex = {
          name,
          keyPath,
          openCursor: (range?: IDBKeyRange | null, direction?: string) =>
            makeOpenCursor(keyPath, range, direction ?? 'next'),
          openKeyCursor: (range?: IDBKeyRange | null, direction?: string) =>
            makeKeyCursor(keyPath, range, direction ?? 'next'),
        };
        indexes.set(name, idx);
        return idx;
      },
      index: (name: string) => {
        const idx = indexes.get(name);
        if (!idx) {
          throw new Error(`Index '${name}' not found`);
        }
        return idx;
      },
    };

    return store;
  }

  const mockStores = new Map<string, MockStore>();

  function createTransaction(storeName: string): MockTx {
    const store = mockStores.get(storeName) ?? createMockStore(storeName);
    const tx: MockTx = {
      objectStore: () => store,
      oncomplete: null,
      onerror: null,
      error: null,
    };

    // Schedule oncomplete after a microtask so it fires after all store.add() calls
    Promise.resolve().then(() => {
      Promise.resolve().then(() => {
        if (tx.oncomplete) {
          tx.oncomplete();
        }
      });
    });

    return tx;
  }

  const mockIDB = {
    open: (_name: string, _version?: number) => {
      const request = {
        result: null as unknown,
        onupgradeneeded: null as (() => void) | null,
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        error: null,
      };

      Promise.resolve().then(() => {
        const db = {
          objectStoreNames: {
            contains: (sName: string) => mockStores.has(sName),
          },
          createObjectStore: (sName: string, _options?: { keyPath?: string; autoIncrement?: boolean }) => {
            const store = createMockStore(sName);
            mockStores.set(sName, store);
            return store;
          },
          transaction: (sName: string, _mode?: string) => createTransaction(sName),
          close: vi.fn(),
        };

        request.result = db;

        if (request.onupgradeneeded) {
          request.onupgradeneeded();
        }

        Promise.resolve().then(() => {
          if (request.onsuccess) {
            request.onsuccess();
          }
        });
      });

      return request;
    },
  };

  Object.defineProperty(globalThis, 'indexedDB', {
    value: mockIDB,
    configurable: true,
    writable: true,
  });

  return {
    mockIDB,
    stores,
    mockStores,
    reset: () => {
      stores.clear();
      mockStores.clear();
      autoId = 0;
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TelemetryLogger', () => {
  let mock: ReturnType<typeof createMockIndexedDB>;

  beforeEach(() => {
    TelemetryLogger.resetInstance();
    mock = createMockIndexedDB();
  });

  afterEach(() => {
    TelemetryLogger.resetInstance();
    mock.reset();
  });

  function makeFrame(ts: number, channels: Record<string, number | boolean | string>): TelemetryFrame {
    return { type: 'telemetry', ts, ch: channels };
  }

  it('initializes successfully with IndexedDB available', async () => {
    const logger = TelemetryLogger.getInstance();
    const result = await logger.initialize();
    expect(result).toBe(true);
  });

  it('returns false when IndexedDB is unavailable', async () => {
    Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true, writable: true });
    const logger = TelemetryLogger.getInstance();
    const result = await logger.initialize();
    expect(result).toBe(false);
  });

  it('is a singleton', () => {
    const a = TelemetryLogger.getInstance();
    const b = TelemetryLogger.getInstance();
    expect(a).toBe(b);
  });

  it('resets singleton on resetInstance', () => {
    const a = TelemetryLogger.getInstance();
    TelemetryLogger.resetInstance();
    const b = TelemetryLogger.getInstance();
    expect(a).not.toBe(b);
  });

  it('buffers log entries before flush', async () => {
    const logger = TelemetryLogger.getInstance();
    await logger.initialize();
    logger.log(makeFrame(100, { A0: 3.3 }));
    // Before flush, the entry is in the buffer, not in DB
    const count = await logger.getEntryCount();
    expect(count).toBe(0);
  });

  it('flushes buffered entries to DB', async () => {
    const logger = TelemetryLogger.getInstance();
    await logger.initialize();
    logger.log(makeFrame(100, { A0: 3.3 }));
    await logger.flush();
    const count = await logger.getEntryCount();
    expect(count).toBe(1);
  });

  it('logs multiple channels from single frame', async () => {
    const logger = TelemetryLogger.getInstance();
    await logger.initialize();
    logger.log(makeFrame(100, { A0: 3.3, A1: 2.5, D13: true }));
    await logger.flush();
    const count = await logger.getEntryCount();
    expect(count).toBe(3);
  });

  it('clears all entries', async () => {
    const logger = TelemetryLogger.getInstance();
    await logger.initialize();
    logger.log(makeFrame(100, { A0: 3.3 }));
    await logger.flush();
    await logger.clear();
    const count = await logger.getEntryCount();
    expect(count).toBe(0);
  });

  it('destroy stops flush timer and closes DB', async () => {
    const logger = TelemetryLogger.getInstance();
    await logger.initialize();
    logger.destroy();
    // Should not throw after destroy
    logger.log(makeFrame(100, { A0: 3.3 }));
    await logger.flush(); // no-op since db is null
  });

  it('returns empty arrays from queries when not initialized', async () => {
    const logger = TelemetryLogger.getInstance();
    const ts = await logger.getTimeSeries('A0', 0, Date.now());
    const latest = await logger.getLatest('A0', 10);
    const channels = await logger.getChannelIds();
    const count = await logger.getEntryCount();
    expect(ts).toEqual([]);
    expect(latest).toEqual([]);
    expect(channels).toEqual([]);
    expect(count).toBe(0);
  });

  it('prune returns 0 when not initialized', async () => {
    const logger = TelemetryLogger.getInstance();
    const deleted = await logger.prune();
    expect(deleted).toBe(0);
  });

  it('clear is no-op when not initialized', async () => {
    const logger = TelemetryLogger.getInstance();
    await logger.clear();
  });

  it('double initialize returns true', async () => {
    const logger = TelemetryLogger.getInstance();
    await logger.initialize();
    const result = await logger.initialize();
    expect(result).toBe(true);
  });

  it('flush is no-op when buffer is empty', async () => {
    const logger = TelemetryLogger.getInstance();
    await logger.initialize();
    await logger.flush(); // should not throw
    const count = await logger.getEntryCount();
    expect(count).toBe(0);
  });

  it('flush is no-op when not initialized', async () => {
    const logger = TelemetryLogger.getInstance();
    logger.log(makeFrame(100, { A0: 3.3 }));
    await logger.flush(); // no db, should not throw
  });

  it('logs frames with boolean values', async () => {
    const logger = TelemetryLogger.getInstance();
    await logger.initialize();
    logger.log(makeFrame(100, { D13: true, D2: false }));
    await logger.flush();
    const count = await logger.getEntryCount();
    expect(count).toBe(2);
  });

  it('logs frames with string values', async () => {
    const logger = TelemetryLogger.getInstance();
    await logger.initialize();
    logger.log(makeFrame(100, { status: 'running' }));
    await logger.flush();
    const count = await logger.getEntryCount();
    expect(count).toBe(1);
  });

  it('logs multiple frames sequentially', async () => {
    const logger = TelemetryLogger.getInstance();
    await logger.initialize();
    logger.log(makeFrame(100, { A0: 1.0 }));
    logger.log(makeFrame(200, { A0: 2.0 }));
    logger.log(makeFrame(300, { A0: 3.0 }));
    await logger.flush();
    const count = await logger.getEntryCount();
    expect(count).toBe(3);
  });
});
