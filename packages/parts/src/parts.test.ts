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
    expect(verified.map((p) => p.id).sort()).toEqual([
      'core:bat54s',
      'core:bme280',
      'core:ds1302',
      'core:ds3231',
      'core:esp32-s3-wroom-1',
      'core:l298n',
      'core:mpu6050',
      'core:ne555',
      'core:tmp36',
      'core:uln2003-stepper',
    ]);
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

  it('TMP36 pin map matches the Analog Devices datasheet (TO-92)', () => {
    const tmp36 = SEED_PARTS.find((p) => p.id === 'core:tmp36');
    expect(tmp36).toBeDefined();
    expect(tmp36?.pins).toHaveLength(3);
    const byNumber = new Map(tmp36?.pins.map((p) => [p.number, p.name]));
    expect(byNumber.get('1')).toBe('+VS');
    expect(byNumber.get('2')).toBe('VOUT');
    expect(byNumber.get('3')).toBe('GND');
    // VOUT drives the analog reading; supply pins are power_in for ERC.
    const byKey = new Map(tmp36?.pins.map((p) => [p.key, p.electricalType]));
    expect(byKey.get('2')).toBe('output');
    expect(byKey.get('1')).toBe('power_in');
    expect(byKey.get('3')).toBe('power_in');
  });

  it('BME280 pin map matches the Bosch datasheet (LGA-8)', () => {
    const bme = SEED_PARTS.find((p) => p.id === 'core:bme280');
    expect(bme).toBeDefined();
    expect(bme?.pins).toHaveLength(8);
    const byNumber = new Map(bme?.pins.map((p) => [p.number, p.name]));
    expect(byNumber.get('1')).toBe('GND');
    expect(byNumber.get('2')).toBe('CSB');
    expect(byNumber.get('3')).toBe('SDI'); // SDA in I²C
    expect(byNumber.get('4')).toBe('SCK'); // SCL in I²C
    expect(byNumber.get('5')).toBe('SDO');
    expect(byNumber.get('6')).toBe('VDDIO');
    expect(byNumber.get('7')).toBe('GND');
    expect(byNumber.get('8')).toBe('VDD');
  });

  it('MPU-6050 (GY-521) pin map matches the verified module header order', () => {
    const mpu = SEED_PARTS.find((p) => p.id === 'core:mpu6050');
    expect(mpu).toBeDefined();
    expect(mpu?.pins).toHaveLength(8);
    const byNumber = new Map(mpu?.pins.map((p) => [p.number, p.name]));
    expect(byNumber.get('1')).toBe('VCC');
    expect(byNumber.get('2')).toBe('GND');
    expect(byNumber.get('3')).toBe('SCL');
    expect(byNumber.get('4')).toBe('SDA');
    expect(byNumber.get('5')).toBe('XDA');
    expect(byNumber.get('6')).toBe('XCL');
    expect(byNumber.get('7')).toBe('AD0');
    expect(byNumber.get('8')).toBe('INT');
  });

  it('DS1302 RTC module pin map matches the verified 5-pin header (3-wire, not I²C)', () => {
    const ds = SEED_PARTS.find((p) => p.id === 'core:ds1302');
    expect(ds).toBeDefined();
    expect(ds?.pins).toHaveLength(5);
    const byNumber = new Map(ds?.pins.map((p) => [p.number, p.name]));
    expect(byNumber.get('1')).toBe('VCC');
    expect(byNumber.get('2')).toBe('GND');
    expect(byNumber.get('3')).toBe('CLK');
    expect(byNumber.get('4')).toBe('DAT');
    expect(byNumber.get('5')).toBe('RST');
    // 3-wire serial: CLK/RST are MCU-driven inputs, DAT is bidirectional, power pins are power_in.
    const byKey = new Map(ds?.pins.map((p) => [p.key, p.electricalType]));
    expect(byKey.get('1')).toBe('power_in');
    expect(byKey.get('2')).toBe('power_in');
    expect(byKey.get('3')).toBe('input');
    expect(byKey.get('4')).toBe('bidi');
    expect(byKey.get('5')).toBe('input');
  });

  it('DS3231 RTC module pin map matches the verified ZS-042 header (I²C, addr 0x68)', () => {
    const ds = SEED_PARTS.find((p) => p.id === 'core:ds3231');
    expect(ds).toBeDefined();
    expect(ds?.pins).toHaveLength(6);
    const byNumber = new Map(ds?.pins.map((p) => [p.number, p.name]));
    expect(byNumber.get('1')).toBe('32K');
    expect(byNumber.get('2')).toBe('SQW');
    expect(byNumber.get('3')).toBe('SCL');
    expect(byNumber.get('4')).toBe('SDA');
    expect(byNumber.get('5')).toBe('VCC');
    expect(byNumber.get('6')).toBe('GND');
    // I²C: SCL is a clock input, SDA bidirectional; SQW/32K are outputs; power pins power_in.
    const byKey = new Map(ds?.pins.map((p) => [p.key, p.electricalType]));
    expect(byKey.get('3')).toBe('input');
    expect(byKey.get('4')).toBe('bidi');
    expect(byKey.get('1')).toBe('output');
    expect(byKey.get('2')).toBe('output');
    expect(byKey.get('5')).toBe('power_in');
    expect(byKey.get('6')).toBe('power_in');
  });

  it('ULN2003 stepper driver board pin map matches the verified control header', () => {
    const u = SEED_PARTS.find((p) => p.id === 'core:uln2003-stepper');
    expect(u).toBeDefined();
    expect(u?.pins).toHaveLength(6);
    const byNumber = new Map(u?.pins.map((p) => [p.number, p.name]));
    expect(byNumber.get('1')).toBe('IN1');
    expect(byNumber.get('2')).toBe('IN2');
    expect(byNumber.get('3')).toBe('IN3');
    expect(byNumber.get('4')).toBe('IN4');
    expect(byNumber.get('5')).toBe('VCC');
    expect(byNumber.get('6')).toBe('GND');
    // IN1–IN4 are MCU-driven control inputs; power pins are power_in.
    const byKey = new Map(u?.pins.map((p) => [p.key, p.electricalType]));
    expect(byKey.get('1')).toBe('input');
    expect(byKey.get('4')).toBe('input');
    expect(byKey.get('5')).toBe('power_in');
    expect(byKey.get('6')).toBe('power_in');
  });

  it('L298N dual H-bridge pin map matches the verified module (power, 6 control, 4 outputs)', () => {
    const l = SEED_PARTS.find((p) => p.id === 'core:l298n');
    expect(l).toBeDefined();
    expect(l?.pins).toHaveLength(13);
    const byNumber = new Map(l?.pins.map((p) => [p.number, p.name]));
    expect(byNumber.get('1')).toBe('+12V');
    expect(byNumber.get('2')).toBe('GND');
    expect(byNumber.get('3')).toBe('+5V');
    expect(byNumber.get('4')).toBe('ENA');
    expect(byNumber.get('5')).toBe('IN1');
    expect(byNumber.get('8')).toBe('IN4');
    expect(byNumber.get('9')).toBe('ENB');
    expect(byNumber.get('10')).toBe('OUT1');
    expect(byNumber.get('13')).toBe('OUT4');
    // Control pins are inputs, motor pins are outputs, power pins power_in.
    const byKey = new Map(l?.pins.map((p) => [p.key, p.electricalType]));
    expect(byKey.get('4')).toBe('input'); // ENA
    expect(byKey.get('5')).toBe('input'); // IN1
    expect(byKey.get('10')).toBe('output'); // OUT1
    expect(byKey.get('13')).toBe('output'); // OUT4
    expect(byKey.get('1')).toBe('power_in'); // +12V
    expect(byKey.get('3')).toBe('power_in'); // +5V
  });

  it('power pseudo-parts expose power_out pins for the ERC source rule', () => {
    const db = seedPartDb();
    expect(db.pinType('core:pwr-vcc', 1, '1')).toBe('power_out');
    expect(db.pinType('core:pwr-gnd', 1, '1')).toBe('power_out');
    expect(db.pinType('core:battery', 1, '+')).toBe('power_out');
  });
});

describe('esp32-s3-wroom-1', () => {
  it('carries all 41 datasheet pins with unique keys and a stated footprint cut', () => {
    const esp = SEED_PARTS.find((p) => p.id === 'core:esp32-s3-wroom-1');
    expect(esp).toBeDefined();
    expect(esp?.pins).toHaveLength(41);
    expect(new Set(esp?.pins.map((pin) => pin.key)).size).toBe(41);
    expect(new Set(esp?.symbol.pins.map((pin) => pin.key)).size).toBe(41);
    // The datasheet corners: 1 GND, 2 3V3, 3 EN, 27 IO0, 36 RXD0, 37 TXD0, 41 EPAD.
    const byKey = new Map(esp?.pins.map((pin) => [pin.key, pin.name]));
    expect(byKey.get('1')).toBe('GND');
    expect(byKey.get('2')).toBe('3V3');
    expect(byKey.get('3')).toBe('EN');
    expect(byKey.get('27')).toBe('IO0');
    expect(byKey.get('36')).toBe('RXD0');
    expect(byKey.get('37')).toBe('TXD0');
    expect(byKey.get('41')).toBe('EPAD');
    expect(esp?.footprint).toBeUndefined(); // stated cut: schematic-only for now
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
