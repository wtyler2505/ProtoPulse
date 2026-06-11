import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { opEnvelopeSchema } from '@protopulse/graph';

import type { OpEnvelope } from '@protopulse/graph';

/**
 * Room persistence — append-only JSON Lines, one file per room. The
 * format mirrors the op-log's own nature: envelopes only ever accrue,
 * so append is the whole write story and a crash mid-write loses at
 * most a trailing partial line (skipped on load, never corrupting).
 * The relay still never OWNS designs — files are a cache that lets a
 * restarted relay re-seed a room before any client rejoins.
 */

export interface RoomStorage {
  /** Envelopes persisted for the room; [] when none. */
  load(room: string): OpEnvelope[];
  /** Append freshly-unioned envelopes. */
  append(room: string, envelopes: readonly OpEnvelope[]): void;
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
      const out: OpEnvelope[] = [];
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (line.trim() === '') continue;
        try {
          out.push(opEnvelopeSchema.parse(JSON.parse(line)));
        } catch {
          // Partial/corrupt trailing line (crash mid-append) — skip.
        }
      }
      return out;
    },
    append(room, envelopes) {
      if (envelopes.length === 0) return;
      // Leading newline: if the previous append was cut short by a
      // crash, the partial line stays ISOLATED instead of swallowing
      // this record. Blank lines are skipped on load.
      const lines = envelopes.map((e) => `\n${JSON.stringify(e)}`).join('');
      appendFileSync(fileFor(dataDir, room), lines);
    },
  };
}
