import { v7 as uuidv7 } from 'uuid';
import type { Uuid } from './types.js';

/**
 * Entity IDs are UUIDv7 — time-sortable, mergeable, no coordination needed.
 * Injectable so tests and golden fixtures can be deterministic.
 */
export interface IdSource {
  next(): Uuid;
}

export const randomIds: IdSource = {
  next: () => uuidv7(),
};

/**
 * Deterministic ID source for tests and golden fixtures: stable,
 * readable, monotonically increasing valid-UUID-shaped strings.
 */
export function sequentialIds(prefix = 0): IdSource {
  let n = 0;
  return {
    next: () => {
      n += 1;
      const hi = prefix.toString(16).padStart(8, '0');
      const lo = n.toString(16).padStart(12, '0');
      return `${hi}-0000-7000-8000-${lo}`;
    },
  };
}

export function newUuid(): Uuid {
  return randomIds.next();
}
