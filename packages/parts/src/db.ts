import type { Part, PinElectricalType } from './types.js';
import { SEED_PARTS } from './seed/index.js';

/**
 * In-memory part registry. Designs pin (partId, rev); lookups that miss
 * return undefined rather than guessing — a missing part is a finding,
 * not a fallback.
 */
export class PartDb {
  private byId = new Map<string, Map<number, Part>>();

  constructor(parts: readonly Part[] = []) {
    for (const part of parts) this.add(part);
  }

  add(part: Part): void {
    let revs = this.byId.get(part.id);
    if (!revs) {
      revs = new Map();
      this.byId.set(part.id, revs);
    }
    if (revs.has(part.rev)) {
      throw new Error(`part ${part.id} rev ${String(part.rev)} already registered`);
    }
    revs.set(part.rev, part);
  }

  get(partId: string, rev: number): Part | undefined {
    return this.byId.get(partId)?.get(rev);
  }

  /** Latest revision of a part. */
  latest(partId: string): Part | undefined {
    const revs = this.byId.get(partId);
    if (!revs) return undefined;
    let best: Part | undefined;
    for (const part of revs.values()) {
      if (!best || part.rev > best.rev) best = part;
    }
    return best;
  }

  all(): Part[] {
    const out: Part[] = [];
    for (const revs of this.byId.values()) out.push(...revs.values());
    return out;
  }

  pinExists(partId: string, rev: number, pinKey: string): boolean {
    const part = this.get(partId, rev);
    return part !== undefined && part.pins.some((p) => p.key === pinKey);
  }

  pinType(partId: string, rev: number, pinKey: string): PinElectricalType | undefined {
    return this.get(partId, rev)?.pins.find((p) => p.key === pinKey)?.electricalType;
  }
}

export function seedPartDb(): PartDb {
  return new PartDb(SEED_PARTS);
}
