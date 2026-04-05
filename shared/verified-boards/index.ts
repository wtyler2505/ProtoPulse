/**
 * Verified Board Pack — barrel export and lookup helpers.
 */

export { MEGA_2560_R3 } from './mega-2560-r3';
export { NODEMCU_ESP32S } from './nodemcu-esp32s';
export { RIORAND_KJL01 } from './riorand-kjl01';

export type {
  BootPinConfig,
  BreadboardFit,
  BusType,
  HeaderGroup,
  PinDirection,
  PinFunction,
  PinFunctionType,
  PinRole,
  VerifiedBoardDefinition,
  VerifiedBus,
  VerifiedPin,
} from './types';

import { MEGA_2560_R3 } from './mega-2560-r3';
import { NODEMCU_ESP32S } from './nodemcu-esp32s';
import { RIORAND_KJL01 } from './riorand-kjl01';
import type { VerifiedBoardDefinition } from './types';

const ALL_BOARDS: VerifiedBoardDefinition[] = [
  MEGA_2560_R3,
  NODEMCU_ESP32S,
  RIORAND_KJL01,
];

/** Get a verified board by its stable ID. */
export function getVerifiedBoard(id: string): VerifiedBoardDefinition | undefined {
  return ALL_BOARDS.find((board) => board.id === id);
}

/** Get all verified board definitions. */
export function getAllVerifiedBoards(): VerifiedBoardDefinition[] {
  return ALL_BOARDS;
}

/** Find a verified board matching a natural-language alias query. */
export function findVerifiedBoardByAlias(query: string): VerifiedBoardDefinition | undefined {
  const normalized = query.toLowerCase().trim();
  if (normalized.length === 0) {
    return undefined;
  }

  // Exact ID match first
  const byId = ALL_BOARDS.find((board) => board.id === normalized);
  if (byId) {
    return byId;
  }

  // Title match
  const byTitle = ALL_BOARDS.find((board) => board.title.toLowerCase() === normalized);
  if (byTitle) {
    return byTitle;
  }

  // Alias match
  const byAlias = ALL_BOARDS.find((board) =>
    board.aliases.some((alias) => alias.toLowerCase() === normalized),
  );
  if (byAlias) {
    return byAlias;
  }

  // Substring match on title or aliases
  return ALL_BOARDS.find((board) =>
    board.title.toLowerCase().includes(normalized)
    || board.aliases.some((alias) => alias.toLowerCase().includes(normalized)),
  );
}
