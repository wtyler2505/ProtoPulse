import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { opEnvelopeSchema } from '@protopulse/graph';
import { z } from 'zod';

import type { OpEnvelope } from '@protopulse/graph';

/**
 * Room persistence — append-only JSON Lines, one file per room. The
 * format mirrors the op-log's own nature: envelopes only ever accrue,
 * so append is the whole write story and a crash mid-write loses at
 * most a trailing partial line (skipped on load, never corrupting).
 * The relay still never OWNS designs — files are a cache that lets a
 * restarted relay re-seed a room before any client rejoins.
 */

export interface BranchRecord {
  branch: string;
  base: { branch: string | null; opCount: number };
  env: OpEnvelope;
}

const recordSchema = z.object({
  branch: z.string().min(1),
  base: z.object({ branch: z.string().min(1).nullable(), opCount: z.number().int().nonnegative() }),
  env: opEnvelopeSchema,
});

export interface RoomStorage {
  /** Records persisted for the room; [] when none. */
  load(room: string): BranchRecord[];
  /** Append freshly-unioned records. */
  append(room: string, records: readonly BranchRecord[]): void;
}

/** Room name → safe filename (room names are user input). */
function fileFor(dataDir: string, room: string): string {
  return join(dataDir, `${encodeURIComponent(room)}.jsonl`);
}

export function createFileStorage(dataDir: string): RoomStorage {
  mkdirSync(dataDir, { recursive: true });
  return {
    load(room) {
      const file = fileFor(dataDir, room);
      if (!existsSync(file)) return [];
      const out: BranchRecord[] = [];
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (line.trim() === '') continue;
        try {
          const raw: unknown = JSON.parse(line);
          const asRecord = recordSchema.safeParse(raw);
          if (asRecord.success) {
            out.push(asRecord.data);
            continue;
          }
          // Pre-branch-sync files carried bare envelopes: that was main.
          out.push({
            branch: 'main',
            base: { branch: null, opCount: 0 },
            env: opEnvelopeSchema.parse(raw),
          });
        } catch {
          // Partial/corrupt trailing line (crash mid-append) — skip.
        }
      }
      return out;
    },
    append(room, records) {
      if (records.length === 0) return;
      // Leading newline: if the previous append was cut short by a
      // crash, the partial line stays ISOLATED instead of swallowing
      // this record. Blank lines are skipped on load.
      const lines = records.map((r) => `\n${JSON.stringify(r)}`).join('');
      appendFileSync(fileFor(dataDir, room), lines);
    },
  };
}
