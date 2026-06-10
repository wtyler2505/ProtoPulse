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
