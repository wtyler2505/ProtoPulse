import { describe, it, expect } from 'vitest';
import { circuit } from '../circuit-api';
import type { CircuitIR } from '../circuit-ir';

describe('circuit() factory', () => {
  it('creates a builder and .export() returns valid CircuitIR', () => {
    const c = circuit('Voltage Divider');
    const ir = c.export();

    expect(ir.meta.name).toBe('Voltage Divider');
    expect(ir.meta.version).toBe('1.0');
    expect(ir.components).toEqual([]);
    expect(ir.nets).toEqual([]);
    expect(ir.wires).toEqual([]);
  });

  it('returns a fresh builder per call', () => {
    const c1 = circuit('A');
    const c2 = circuit('B');
    c1.resistor({ value: '10k' });
    expect(c1.export().components).toHaveLength(1);
    expect(c2.export().components).toHaveLength(0);
  });
});

describe('component factories — auto-refdes', () => {
  it('resistor auto-generates R1, R2, etc.', () => {
    const c = circuit('Test');
    const r1 = c.resistor({ value: '10k' });
    const r2 = c.resistor({ value: '4.7k' });

    const ir = c.export();
    expect(ir.components).toHaveLength(2);
    expect(ir.components[0].refdes).toBe('R1');
    expect(ir.components[1].refdes).toBe('R2');
    expect(ir.components[0].value).toBe('10k');
    expect(ir.components[1].value).toBe('4.7k');
    // Resistors have 2 pins: '1' and '2'
    expect(Object.keys(ir.components[0].pins)).toEqual(['1', '2']);

    // ComponentHandle identity
    expect(r1).toBeDefined();
    expect(r2).toBeDefined();
  });

  it('capacitor auto-generates C1, C2', () => {
    const c = circuit('Test');
    c.capacitor({ value: '100nF' });
    c.capacitor({ value: '10uF' });

    const ir = c.export();
    expect(ir.components[0].refdes).toBe('C1');
    expect(ir.components[0].value).toBe('100nF');
    expect(ir.components[1].refdes).toBe('C2');
    expect(Object.keys(ir.components[0].pins)).toEqual(['1', '2']);
  });

  it('inductor auto-generates L1', () => {
    const c = circuit('Test');
    c.inductor({ value: '10uH' });
    const ir = c.export();
    expect(ir.components[0].refdes).toBe('L1');
    expect(Object.keys(ir.components[0].pins)).toEqual(['1', '2']);
  });

  it('diode auto-generates D1', () => {
    const c = circuit('Test');
    c.diode({ part: '1N4148' });
    const ir = c.export();
    expect(ir.components[0].refdes).toBe('D1');
    // Diodes: anode (A) and cathode (K)
    expect(Object.keys(ir.components[0].pins)).toEqual(['A', 'K']);
  });

  it('led auto-generates LED1', () => {
    const c = circuit('Test');
    c.led({ part: 'Red LED' });
    const ir = c.export();
    expect(ir.components[0].refdes).toBe('LED1');
    expect(Object.keys(ir.components[0].pins)).toEqual(['A', 'K']);
  });

  it('transistor auto-generates Q1 with 3 pins', () => {
    const c = circuit('Test');
    c.transistor({ part: '2N2222' });
    const ir = c.export();
    expect(ir.components[0].refdes).toBe('Q1');
    expect(Object.keys(ir.components[0].pins)).toEqual(['B', 'C', 'E']);
  });

  it('ic auto-generates U1', () => {
    const c = circuit('Test');
    c.ic({ part: 'ATmega328P' });
    const ir = c.export();
    expect(ir.components[0].refdes).toBe('U1');
    // ICs have named pins — at minimum should have some pins
    expect(Object.keys(ir.components[0].pins).length).toBeGreaterThan(0);
  });

  it('connector auto-generates J1', () => {
    const c = circuit('Test');
    c.connector({ part: 'USB-C', pins: ['VBUS', 'D-', 'D+', 'GND'] });
    const ir = c.export();
    expect(ir.components[0].refdes).toBe('J1');
    expect(Object.keys(ir.components[0].pins)).toEqual(['VBUS', 'D-', 'D+', 'GND']);
  });

  it('generic auto-generates X1', () => {
    const c = circuit('Test');
    c.generic({ part: 'MyPart', refdesPrefix: 'X', pins: ['A', 'B', 'C'] });
    const ir = c.export();
    expect(ir.components[0].refdes).toBe('X1');
    expect(Object.keys(ir.components[0].pins)).toEqual(['A', 'B', 'C']);
  });

  it('mixed components get independent counters', () => {
    const c = circuit('Mixed');
    c.resistor({ value: '10k' });
    c.capacitor({ value: '100nF' });
    c.resistor({ value: '4.7k' });
    c.ic({ part: '7400' });

    const ir = c.export();
    expect(ir.components.map((comp) => comp.refdes)).toEqual(['R1', 'C1', 'R2', 'U1']);
  });
});

describe('footprint option', () => {
  it('sets footprint on component', () => {
    const c = circuit('Test');
    c.resistor({ value: '10k', footprint: '0805' });
    const ir = c.export();
    expect(ir.components[0].footprint).toBe('0805');
  });

  it('footprint is undefined when not specified', () => {
    const c = circuit('Test');
    c.resistor({ value: '10k' });
    const ir = c.export();
    expect(ir.components[0].footprint).toBeUndefined();
  });
});

describe('ComponentHandle.pin()', () => {
  it('returns a PinRef for valid pin number on resistor', () => {
    const c = circuit('Test');
    const r1 = c.resistor({ value: '10k' });
    const pin1 = r1.pin(1);
    const pin2 = r1.pin(2);

    expect(pin1).toBeDefined();
    expect(pin2).toBeDefined();
    // PinRef should carry component and pin identity
    expect(pin1.componentId).toBe(r1.id);
    expect(pin1.pinName).toBe('1');
    expect(pin2.pinName).toBe('2');
  });

  it('returns a PinRef for valid pin name on transistor', () => {
    const c = circuit('Test');
    const q1 = c.transistor({ part: '2N2222' });
    const base = q1.pin('B');
    expect(base.pinName).toBe('B');
  });

  it('throws for invalid pin number on resistor (pin 3 does not exist)', () => {
    const c = circuit('Test');
    const r1 = c.resistor({ value: '10k' });
    expect(() => r1.pin(3)).toThrow(/has 2 pins/i);
  });

  it('throws for invalid pin name on transistor', () => {
    const c = circuit('Test');
    const q1 = c.transistor({ part: '2N2222' });
    expect(() => q1.pin('X')).toThrow(/no pin.*X/i);
  });
});

describe('net()', () => {
  it('creates a power net', () => {
    const c = circuit('Test');
    const vcc = c.net('VCC', { voltage: 5 });
    const ir = c.export();

    expect(ir.nets).toHaveLength(1);
    expect(ir.nets[0].name).toBe('VCC');
    expect(ir.nets[0].type).toBe('power');
    expect(vcc).toBeDefined();
  });

  it('creates a ground net', () => {
    const c = circuit('Test');
    c.net('GND', { ground: true });
    const ir = c.export();
    expect(ir.nets[0].type).toBe('ground');
  });

  it('creates a signal net by default', () => {
    const c = circuit('Test');
    c.net('DATA');
    const ir = c.export();
    expect(ir.nets[0].type).toBe('signal');
  });
});

describe('connect()', () => {
  it('connects pins to an existing net', () => {
    const c = circuit('Test');
    const r1 = c.resistor({ value: '10k' });
    const r2 = c.resistor({ value: '4.7k' });
    const vcc = c.net('VCC', { voltage: 5 });

    c.connect(r1.pin(1), vcc);
    c.connect(r2.pin(1), vcc);

    const ir = c.export();
    const vccNet = ir.nets.find((n) => n.name === 'VCC');
    expect(vccNet).toBeDefined();
    // Both pins should reference the VCC net
    expect(ir.components[0].pins['1']).toBe(vccNet!.id);
    expect(ir.components[1].pins['1']).toBe(vccNet!.id);
  });

  it('connects two pins together — auto-creates net', () => {
    const c = circuit('Test');
    const r1 = c.resistor({ value: '10k' });
    const r2 = c.resistor({ value: '4.7k' });

    c.connect(r1.pin(2), r2.pin(1));

    const ir = c.export();
    // Should have auto-created a net
    expect(ir.nets).toHaveLength(1);
    // Both pins point to the same net
    expect(ir.components[0].pins['2']).toBe(ir.nets[0].id);
    expect(ir.components[1].pins['1']).toBe(ir.nets[0].id);
  });

  it('connects multiple refs in a single call', () => {
    const c = circuit('Test');
    const r1 = c.resistor({ value: '1k' });
    const r2 = c.resistor({ value: '2k' });
    const r3 = c.resistor({ value: '3k' });

    c.connect(r1.pin(2), r2.pin(1), r3.pin(1));

    const ir = c.export();
    expect(ir.nets).toHaveLength(1);
    const netId = ir.nets[0].id;
    expect(ir.components[0].pins['2']).toBe(netId);
    expect(ir.components[1].pins['1']).toBe(netId);
    expect(ir.components[2].pins['1']).toBe(netId);
  });
});

describe('chain()', () => {
  it('connects components in series using pin 2 → pin 1', () => {
    const c = circuit('Voltage Divider');
    const vcc = c.net('VCC', { voltage: 5 });
    const gnd = c.net('GND', { ground: true });
    const r1 = c.resistor({ value: '10k' });
    const r2 = c.resistor({ value: '10k' });

    c.chain(vcc, r1, r2, gnd);

    const ir = c.export();
    // VCC → R1.pin(1), R1.pin(2) → R2.pin(1), R2.pin(2) → GND
    const vccNet = ir.nets.find((n) => n.name === 'VCC')!;
    const gndNet = ir.nets.find((n) => n.name === 'GND')!;

    expect(ir.components[0].pins['1']).toBe(vccNet.id);
    expect(ir.components[0].pins['2']).toBe(ir.components[1].pins['1']);
    expect(ir.components[1].pins['2']).toBe(gndNet.id);
  });

  it('chain with 3 components creates 4 nets total (VCC, mid1, mid2, GND)', () => {
    const c = circuit('Test');
    const vcc = c.net('VCC', { voltage: 5 });
    const gnd = c.net('GND', { ground: true });
    const r1 = c.resistor({ value: '1k' });
    const r2 = c.resistor({ value: '2k' });
    const r3 = c.resistor({ value: '3k' });

    c.chain(vcc, r1, r2, r3, gnd);

    const ir = c.export();
    // VCC + GND + 2 auto-created mid-nets = 4
    expect(ir.nets).toHaveLength(4);
  });
});

describe('error handling', () => {
  it('throws on duplicate manual refdes', () => {
    const c = circuit('Test');
    c.resistor({ value: '10k', refdes: 'R1' });
    expect(() => c.resistor({ value: '4.7k', refdes: 'R1' })).toThrow(/duplicate.*refdes.*R1/i);
  });

  it('manual refdes is respected', () => {
    const c = circuit('Test');
    c.resistor({ value: '10k', refdes: 'R42' });
    const ir = c.export();
    expect(ir.components[0].refdes).toBe('R42');
  });

  it('auto-refdes skips manually-used values', () => {
    const c = circuit('Test');
    c.resistor({ value: '10k', refdes: 'R1' });
    const r2 = c.resistor({ value: '4.7k' });
    const ir = c.export();
    // Should skip R1 and assign R2
    expect(ir.components[1].refdes).toBe('R2');
    expect(r2).toBeDefined();
  });
});

describe('component IDs', () => {
  it('each component gets a unique UUID', () => {
    const c = circuit('Test');
    c.resistor({ value: '10k' });
    c.resistor({ value: '4.7k' });
    const ir = c.export();
    expect(ir.components[0].id).not.toBe(ir.components[1].id);
    // UUID v4 format
    expect(ir.components[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('net IDs are unique UUIDs', () => {
    const c = circuit('Test');
    c.net('VCC', { voltage: 5 });
    c.net('GND', { ground: true });
    const ir = c.export();
    expect(ir.nets[0].id).not.toBe(ir.nets[1].id);
    expect(ir.nets[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});

describe('partId field', () => {
  it('resistor partId uses value', () => {
    const c = circuit('Test');
    c.resistor({ value: '10k' });
    const ir = c.export();
    expect(ir.components[0].partId).toBe('resistor:10k');
  });

  it('ic partId uses part name', () => {
    const c = circuit('Test');
    c.ic({ part: 'ATmega328P' });
    const ir = c.export();
    expect(ir.components[0].partId).toBe('ic:ATmega328P');
  });
});
