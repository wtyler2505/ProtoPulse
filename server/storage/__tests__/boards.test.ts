/**
 * BoardStorage Tests — server/storage/boards.ts (Plan 02 Phase 4 / E2E-228)
 *
 * Covers:
 * - getBoard() returns a default (id=0) when no row exists
 * - getBoard() returns the stored row when present
 * - upsertBoard() inserts on first write (merges defaults + patch)
 * - upsertBoard() updates only the fields supplied in the patch
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BoardStorage, DEFAULT_BOARD_VALUES } from '../boards';

type MockResult<T> = { resolved: T };

function makeDb(selectRows: unknown[], insertRows: unknown[], updateRows: unknown[]) {
  const insertValuesCapture = vi.fn();
  const updateSetCapture = vi.fn();

  const select = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(selectRows),
    }),
  });

  const insert = vi.fn().mockReturnValue({
    values: (vals: unknown) => {
      insertValuesCapture(vals);
      return { returning: vi.fn().mockResolvedValue(insertRows) };
    },
  });

  const update = vi.fn().mockReturnValue({
    set: (vals: unknown) => {
      updateSetCapture(vals);
      return {
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue(updateRows),
        }),
      };
    },
  });

  return {
    db: { select, insert, update } as unknown as Parameters<typeof BoardStorage.prototype['upsertBoard']>[0] extends never ? never : any,
    captures: { insertValuesCapture, updateSetCapture },
  };
}

function makeStorage(selectRows: unknown[], insertRows: unknown[] = [], updateRows: unknown[] = []) {
  const { db, captures } = makeDb(selectRows, insertRows, updateRows);
  const cache = { get: vi.fn(), set: vi.fn(), invalidate: vi.fn(), clear: vi.fn() };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const storage = new BoardStorage({ db, cache } as any);
  return { storage, captures };
}

describe('BoardStorage.getBoard', () => {
  it('returns a default board (id=0) when no row exists', async () => {
    const { storage } = makeStorage([]);
    const board = await storage.getBoard(1);
    expect(board.id).toBe(0);
    expect(board.projectId).toBe(1);
    expect(board.widthMm).toBe(DEFAULT_BOARD_VALUES.widthMm);
    expect(board.heightMm).toBe(DEFAULT_BOARD_VALUES.heightMm);
    expect(board.finish).toBe(DEFAULT_BOARD_VALUES.finish);
  });

  it('returns the stored row when present', async () => {
    const row = {
      id: 42,
      projectId: 1,
      ...DEFAULT_BOARD_VALUES,
      widthMm: 60,
      heightMm: 50,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { storage } = makeStorage([row]);
    const board = await storage.getBoard(1);
    expect(board.id).toBe(42);
    expect(board.widthMm).toBe(60);
    expect(board.heightMm).toBe(50);
  });
});

describe('BoardStorage.upsertBoard', () => {
  it('inserts on first write — seeds defaults + applies patch', async () => {
    const insertedRow = {
      id: 1,
      projectId: 5,
      ...DEFAULT_BOARD_VALUES,
      widthMm: 120,
      heightMm: 90,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { storage, captures } = makeStorage([], [insertedRow]);
    const board = await storage.upsertBoard(5, { widthMm: 120, heightMm: 90 });
    expect(board.id).toBe(1);
    expect(board.widthMm).toBe(120);
    expect(captures.insertValuesCapture).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 5,
      widthMm: 120,
      heightMm: 90,
      thicknessMm: DEFAULT_BOARD_VALUES.thicknessMm,
      finish: DEFAULT_BOARD_VALUES.finish,
    }));
  });

  it('updates only supplied fields (omitted fields preserved)', async () => {
    const existing = {
      id: 42,
      projectId: 1,
      ...DEFAULT_BOARD_VALUES,
      finish: 'ENIG',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const updated = { ...existing, widthMm: 150 };
    const { storage, captures } = makeStorage([existing], [], [updated]);
    const board = await storage.upsertBoard(1, { widthMm: 150 });
    expect(board.widthMm).toBe(150);
    expect(board.finish).toBe('ENIG');
    // Only widthMm + updatedAt should be in the set clause
    expect(captures.updateSetCapture).toHaveBeenCalledWith(expect.objectContaining({
      widthMm: 150,
    }));
    const call = captures.updateSetCapture.mock.calls[0][0] as Record<string, unknown>;
    expect('finish' in call).toBe(false);
    expect('heightMm' in call).toBe(false);
  });

  it('preserves false boolean values (does not drop them as undefined)', async () => {
    const existing = {
      id: 42,
      projectId: 1,
      ...DEFAULT_BOARD_VALUES,
      viaInPad: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const updated = { ...existing, viaInPad: false };
    const { storage, captures } = makeStorage([existing], [], [updated]);
    await storage.upsertBoard(1, { viaInPad: false });
    const call = captures.updateSetCapture.mock.calls[0][0] as Record<string, unknown>;
    expect(call.viaInPad).toBe(false);
  });
});
