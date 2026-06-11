import { loadPackInto, parsePartPack } from '@protopulse/parts';
import { create } from 'zustand';

import type { PartDb, PartPack } from '@protopulse/parts';

/**
 * Loaded part packs (community library, first slice): pack JSON lives
 * in localStorage and re-loads into the app part db on startup, so a
 * pack you load once is simply there next session. The db can only
 * grow at runtime — forgetting a pack takes effect on the next reload
 * (stated in the UI).
 */

const STORAGE_KEY = 'pp-part-packs';

interface PacksState {
  /** Successfully loaded packs (this session). */
  packs: { pack: string; rev: string; parts: number; author?: string }[];
  /** Bumped whenever the part db gains parts — palette re-derives. */
  version: number;
  /** Packs in storage that failed to load on startup (collision/parse). */
  startupErrors: string[];
}

export const usePacks = create<PacksState>(() => ({
  packs: [],
  version: 0,
  startupErrors: [],
}));

function storedTexts(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const arr: unknown = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function persist(texts: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(texts));
  } catch {
    // Storage full/blocked: the pack still works this session.
  }
}

function note(pack: PartPack): PacksState['packs'][number] {
  return {
    pack: pack.pack,
    rev: pack.rev,
    parts: pack.parts.length,
    ...(pack.author !== undefined ? { author: pack.author } : {}),
  };
}

/** Re-load every stored pack into a fresh db (startup). */
export function loadStoredPacks(db: PartDb): void {
  const loaded: PacksState['packs'] = [];
  const errors: string[] = [];
  for (const text of storedTexts()) {
    try {
      const pack = parsePartPack(text);
      loadPackInto(db, pack);
      loaded.push(note(pack));
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  if (loaded.length > 0 || errors.length > 0) {
    usePacks.setState((s) => ({
      packs: loaded,
      version: s.version + 1,
      startupErrors: errors,
    }));
  }
}

/** Parse + load + persist one pack. Throws with the reason on refusal. */
export function addPack(db: PartDb, text: string): PartPack {
  const pack = parsePartPack(text);
  for (const existing of usePacks.getState().packs) {
    if (existing.pack === pack.pack) {
      throw new Error(`pack ${pack.pack} is already loaded (rev ${existing.rev}) — forget it first, then reload`);
    }
  }
  loadPackInto(db, pack); // all-or-nothing; throws on collision
  persist([...storedTexts(), text]);
  usePacks.setState((s) => ({ packs: [...s.packs, note(pack)], version: s.version + 1 }));
  return pack;
}

/** Drop a pack from storage. The db keeps its parts until reload. */
export function forgetPack(packId: string): void {
  const remaining = storedTexts().filter((text) => {
    try {
      return parsePartPack(text).pack !== packId;
    } catch {
      return false; // unparseable leftovers go too
    }
  });
  persist(remaining);
  usePacks.setState((s) => ({ packs: s.packs.filter((p) => p.pack !== packId) }));
}
