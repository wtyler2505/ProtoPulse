import { SCHEMATIC_GRID } from '@protopulse/graph';
import { describe, expect, it } from 'vitest';

import { PartDb, seedPartDb } from './db.js';
import { SEED_PARTS } from './seed/index.js';
import { partSchema } from './types.js';

describe('seed library', () => {
  it('every seed part passes the schema (pin keys unique, symbol pins on grid)', () => {
    for (const part of SEED_PARTS) {
      const result = partSchema.safeParse(part);
      if (!result.success) {
        throw new Error(`${part.id}: ${result.error.issues.map((i) => i.message).join('; ')}`);
      }
    }
  });

  it('symbol pins all sit on the 1.27mm grid', () => {
    for (const part of SEED_PARTS) {
      for (const sp of part.symbol.pins) {
        expect(Math.abs(sp.at.x % SCHEMATIC_GRID), `${part.id}:${sp.key} x`).toBe(0);
        expect(Math.abs(sp.at.y % SCHEMATIC_GRID), `${part.id}:${sp.key} y`).toBe(0);
      }
    }
  });

  it('verified parts carry datasheet-backed pin numbers and a provenance note', () => {
    const verified = SEED_PARTS.filter((p) => p.provenance === 'verified');
    expect(verified.map((p) => p.id).sort()).toEqual(['core:bat54s', 'core:ne555']);
    for (const part of verified) {
      expect(part.provenanceNote).toBeTruthy();
      expect(part.pins.every((pin) => pin.number !== undefined)).toBe(true);
    }
  });

  it('NE555 pin map matches the TI datasheet', () => {
    const ne555 = SEED_PARTS.find((p) => p.id === 'core:ne555');
    const byNumber = new Map(ne555?.pins.map((p) => [p.number, p.name]));
    expect(byNumber.get('1')).toBe('GND');
    expect(byNumber.get('2')).toBe('TRIG');
    expect(byNumber.get('3')).toBe('OUT');
    expect(byNumber.get('4')).toBe('RESET');
    expect(byNumber.get('5')).toBe('CONT');
    expect(byNumber.get('6')).toBe('THRES');
    expect(byNumber.get('7')).toBe('DISCH');
    expect(byNumber.get('8')).toBe('VCC');
  });

  it('power pseudo-parts expose power_out pins for the ERC source rule', () => {
    const db = seedPartDb();
    expect(db.pinType('core:pwr-vcc', 1, '1')).toBe('power_out');
    expect(db.pinType('core:pwr-gnd', 1, '1')).toBe('power_out');
    expect(db.pinType('core:battery', 1, '+')).toBe('power_out');
  });
});

describe('seed footprints', () => {
  const FOOTPRINT_PART_IDS = [
    'core:resistor',
    'core:capacitor',
    'core:capacitor-electrolytic',
    'core:led',
    'core:1n4148',
    'core:1n5819',
    'core:tvs-unidirectional',
    'core:bat54s',
    'core:2n3904',
    'core:nmos-ao3400',
    'core:ne555',
  ];

  it('exactly the board-ready parts carry footprints', () => {
    const withFootprint = SEED_PARTS.filter((p) => p.footprint !== undefined).map((p) => p.id);
    expect(withFootprint.sort()).toEqual([...FOOTPRINT_PART_IDS].sort());
  });

  it('every footprint pad lands on an existing pin key, each pin exactly once', () => {
    for (const part of SEED_PARTS) {
      if (!part.footprint) continue;
      const pinKeys = part.pins.map((p) => p.key).sort();
      const padKeys = part.footprint.pads.map((p) => p.pinKey).sort();
      expect(padKeys, part.id).toEqual(pinKeys);
    }
  });

  it('chip parts get 0805-class pads at ±0.95mm; SOT-23 parts get 3 pads', () => {
    const r = SEED_PARTS.find((p) => p.id === 'core:resistor');
    expect(r?.footprint?.pads.map((p) => p.at.x).sort((a, b) => a - b)).toEqual([-950_000, 950_000]);
    expect(r?.footprint?.pads.every((p) => p.shape === 'rect' && p.wNm === 1_000_000 && p.hNm === 1_250_000)).toBe(true);
    const q = SEED_PARTS.find((p) => p.id === 'core:2n3904');
    expect(q?.footprint?.pads).toHaveLength(3);
    expect(q?.footprint?.pads.every((p) => p.drillNm === undefined)).toBe(true);
  });

  it('the NE555 DIP-8 footprint has 8 drilled circle pads on a 2.54mm pitch, rows 7.62mm apart', () => {
    const fp = SEED_PARTS.find((p) => p.id === 'core:ne555')?.footprint;
    expect(fp?.pads).toHaveLength(8);
    expect(fp?.pads.every((p) => p.shape === 'circle' && p.drillNm === 800_000)).toBe(true);
    const byKey = new Map(fp?.pads.map((p) => [p.pinKey, p.at]));
    // Pins 1–4 down the left column, 5–8 back up the right.
    expect(byKey.get('1')).toEqual({ x: -3_810_000, y: 3_810_000 });
    expect(byKey.get('2')).toEqual({ x: -3_810_000, y: 1_270_000 });
    expect(byKey.get('4')).toEqual({ x: -3_810_000, y: -3_810_000 });
    expect(byKey.get('5')).toEqual({ x: 3_810_000, y: -3_810_000 });
    expect(byKey.get('8')).toEqual({ x: 3_810_000, y: 3_810_000 });
  });

  it('rejects a footprint pad that references a missing pin key', () => {
    const base = SEED_PARTS.find((p) => p.id === 'core:resistor');
    if (!base) throw new Error('no resistor seed');
    const broken = {
      ...base,
      footprint: {
        pads: [{ pinKey: 'ghost', at: { x: 0, y: 0 }, wNm: 1, hNm: 1, shape: 'rect' as const }],
        courtyard: { wNm: 1, hNm: 1 },
      },
    };
    const result = partSchema.safeParse(broken);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('no electrical pin'))).toBe(true);
    }
  });

  it('rejects non-integer and non-positive footprint dimensions', () => {
    const base = SEED_PARTS.find((p) => p.id === 'core:resistor');
    if (!base) throw new Error('no resistor seed');
    const withPads = (pad: Record<string, unknown>) =>
      partSchema.safeParse({
        ...base,
        footprint: { pads: [{ pinKey: '1', at: { x: 0, y: 0 }, wNm: 1, hNm: 1, shape: 'rect', ...pad }], courtyard: { wNm: 1, hNm: 1 } },
      }).success;
    expect(withPads({ wNm: 0.5 })).toBe(false);
    expect(withPads({ hNm: 0 })).toBe(false);
    expect(withPads({ drillNm: -1 })).toBe(false);
    expect(withPads({ at: { x: 0.5, y: 0 } })).toBe(false);
    expect(withPads({})).toBe(true);
  });
});

describe('PartDb', () => {
  it('lookups by id+rev, latest, pinExists, pinType', () => {
    const db = seedPartDb();
    expect(db.get('core:resistor', 1)?.refPrefix).toBe('R');
    expect(db.get('core:resistor', 99)).toBeUndefined();
    expect(db.get('ghost', 1)).toBeUndefined();
    expect(db.latest('core:resistor')?.rev).toBe(1);
    expect(db.latest('ghost')).toBeUndefined();
    expect(db.pinExists('core:ne555', 1, '7')).toBe(true);
    expect(db.pinExists('core:ne555', 1, '9')).toBe(false);
    expect(db.pinType('core:ne555', 1, '7')).toBe('open_collector');
    expect(db.all().length).toBe(SEED_PARTS.length);
  });

  it('latest picks the highest revision', () => {
    const base = SEED_PARTS[0];
    if (!base) throw new Error('no seeds');
    const db = new PartDb([base, { ...base, rev: 3 }]);
    expect(db.latest(base.id)?.rev).toBe(3);
  });

  it('rejects duplicate (id, rev) registration', () => {
    const base = SEED_PARTS[0];
    if (!base) throw new Error('no seeds');
    expect(() => new PartDb([base, base])).toThrow('already registered');
  });
});
