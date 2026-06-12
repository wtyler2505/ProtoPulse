import { SCHEMATIC_GRID } from '@protopulse/graph';
import { describe, expect, it } from 'vitest';

import { seedPartDb } from './db.js';
import { loadPackInto, parsePartPack } from './pack.js';

import type { PartPack } from './pack.js';
import type { Part } from './types.js';

const G = SCHEMATIC_GRID;

function packPart(id: string, rev = 1): Part {
  return {
    id,
    rev,
    name: 'Pack Resistor',
    refPrefix: 'R',
    class: 'resistor',
    pins: [
      { key: '1', name: '1', electricalType: 'passive' },
      { key: '2', name: '2', electricalType: 'passive' },
    ],
    symbol: {
      primitives: [{ kind: 'rect', x: -2 * G, y: -G, w: 4 * G, h: 2 * G }],
      pins: [
        { key: '1', at: { x: -3 * G, y: 0 }, dir: 'W' },
        { key: '2', at: { x: 3 * G, y: 0 }, dir: 'E' },
      ],
    },
    provenance: 'community-tested',
    provenanceNote: 'bench-tested by the pack author',
  };
}

function pack(parts: Part[], overrides: Partial<PartPack> = {}): string {
  return JSON.stringify({
    format: 'pp-part-pack',
    version: 1,
    pack: 'tylers-bench',
    rev: '2026-06',
    author: 'tyler',
    parts,
    ...overrides,
  });
}

describe('part packs', () => {
  it('parses a valid pack and loads it into a db, all or nothing', () => {
    const db = seedPartDb();
    const before = db.all().length;
    const p = parsePartPack(pack([packPart('tylers-bench:r-special')]));
    expect(loadPackInto(db, p)).toBe(1);
    expect(db.all().length).toBe(before + 1);
    expect(db.get('tylers-bench:r-special', 1)?.provenance).toBe('community-tested');
  });

  it("refuses parts outside the pack's namespace — core: cannot be shadowed", () => {
    expect(() => parsePartPack(pack([packPart('core:resistor', 2)]))).toThrow('namespace');
    expect(() => parsePartPack(pack([packPart('other:thing')]))).toThrow('namespace');
    expect(() =>
      parsePartPack(pack([packPart('tylers-bench:x')], { pack: 'core' })),
    ).toThrow("'core' namespace");
  });

  it('refuses duplicate (id, rev) inside a pack, and collisions with the db', () => {
    expect(() =>
      parsePartPack(pack([packPart('tylers-bench:x'), packPart('tylers-bench:x')])),
    ).toThrow('duplicate');

    const db = seedPartDb();
    const p = parsePartPack(pack([packPart('tylers-bench:x')]));
    loadPackInto(db, p);
    const before = db.all().length;
    // Re-loading the same pack refuses and loads NOTHING.
    expect(() => loadPackInto(db, p)).toThrow('already registered');
    expect(db.all().length).toBe(before);
  });

  it('part contents go through the full part schema (grid, pin closure)', () => {
    const bad = packPart('tylers-bench:off-grid');
    bad.symbol.pins[0] = { key: '1', at: { x: 7, y: 0 }, dir: 'W' };
    expect(() => parsePartPack(pack([bad]))).toThrow('grid');
  });
});
