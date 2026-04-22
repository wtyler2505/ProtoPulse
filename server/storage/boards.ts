/**
 * BoardStorage — per-project physical PCB source of truth (Plan 02 Phase 4).
 *
 * One-to-one with projects (unique project_id). Callers read with getBoard()
 * which returns a row or a populated default object (never throws on missing),
 * and write with upsertBoard() which merges partial updates onto the row.
 */

import { eq } from 'drizzle-orm';

import { boards } from '@shared/schema';
import type { Board, UpdateBoard } from '@shared/schema';

import { StorageError } from './errors';
import type { StorageDeps } from './types';

// Single source of defaults — mirrors schema.ts column defaults. When the
// table is empty for a project, GET returns this shape with id=0 so callers
// can render without branching on "row exists yet".
export const DEFAULT_BOARD_VALUES = {
  widthMm: 100,
  heightMm: 80,
  thicknessMm: 1.6,
  cornerRadiusMm: 2,
  layers: 2,
  copperWeightOz: 1,
  finish: 'HASL',
  solderMaskColor: 'green',
  silkscreenColor: 'white',
  minTraceWidthMm: 0.2,
  minDrillSizeMm: 0.3,
  castellatedHoles: false,
  impedanceControl: false,
  viaInPad: false,
  goldFingers: false,
} as const;

export class BoardStorage {
  constructor(private deps: StorageDeps) {}

  private get db() { return this.deps.db; }

  /**
   * Fetch the board row for a project, or return a synthesized default board
   * (id=0) if none exists yet. Callers should not treat id=0 specially — PUT
   * will transparently insert on first write.
   */
  async getBoard(projectId: number): Promise<Board> {
    try {
      const rows = await this.db.select().from(boards).where(eq(boards.projectId, projectId));
      if (rows.length > 0) { return rows[0]; }
      const now = new Date();
      return {
        id: 0,
        projectId,
        ...DEFAULT_BOARD_VALUES,
        createdAt: now,
        updatedAt: now,
      } as Board;
    } catch (e) {
      throw new StorageError('getBoard', `projects/${projectId}/board`, e);
    }
  }

  /**
   * Merge a partial update onto the project's board row, creating it on first
   * write. Fields omitted in `patch` are preserved (or default-seeded on first
   * write). Returns the full row after the merge.
   */
  async upsertBoard(projectId: number, patch: UpdateBoard): Promise<Board> {
    try {
      const existingRows = await this.db.select().from(boards).where(eq(boards.projectId, projectId));

      if (existingRows.length === 0) {
        const insertValues = {
          projectId,
          ...DEFAULT_BOARD_VALUES,
          ...patch,
        };
        const [created] = await this.db.insert(boards).values(insertValues).returning();
        return created;
      }

      // `UpdateBoard` is a strict zod schema — Object.entries only emits keys
      // the caller actually set, so we can merge directly without filtering
      // undefined. `false` and `0` are preserved.
      const setValues: Record<string, unknown> = {
        ...patch,
        updatedAt: new Date(),
      };

      const [updated] = await this.db.update(boards)
        .set(setValues)
        .where(eq(boards.projectId, projectId))
        .returning();
      return updated;
    } catch (e) {
      throw new StorageError('upsertBoard', `projects/${projectId}/board`, e);
    }
  }
}
