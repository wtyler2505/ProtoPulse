import { describe, it, expect } from 'vitest';
import type { CircuitIR } from '../circuit-ir';
import { irToSchematicLayout } from '../ir-to-schematic';
import type { SchematicLayout, ComponentLayout, NetPath } from '../ir-to-schematic';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeVoltageDividerIR(): CircuitIR {
  return {
    meta: { name: 'Voltage Divider', version: '1.0.0' },
    components: [
      {
        id: 'r1-uuid',
        refdes: 'R1',
        partId: 'resistor-10k',
        value: '10k',
        footprint: '0805',
        pins: { '1': 'VCC', '2': 'VOUT' },
      },
      {
        id: 'r2-uuid',
        refdes: 'R2',
        partId: 'resistor-10k',
        value: '10k',
        footprint: '0805',
        pins: { '1': 'VOUT', '2': 'GND' },
      },
    ],
    nets: [
      { id: 'net-vcc', name: 'VCC', type: 'power' },
      { id: 'net-gnd', name: 'GND', type: 'ground' },
      { id: 'net-vout', name: 'VOUT', type: 'signal' },
    ],
    wires: [
      { id: 'w1', netId: 'net-vcc', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
      { id: 'w2', netId: 'net-gnd', points: [{ x: 0, y: 100 }, { x: 100, y: 100 }] },
      { id: 'w3', netId: 'net-vout', points: [{ x: 50, y: 0 }, { x: 50, y: 100 }] },
    ],
  };
}

function makeEmptyIR(): CircuitIR {
  return {
    meta: { name: 'Empty', version: '1.0.0' },
    components: [],
    nets: [],
    wires: [],
  };
}

function makeSingleComponentIR(): CircuitIR {
  return {
    meta: { name: 'Single', version: '1.0.0' },
    components: [
      {
        id: 'led-uuid',
        refdes: 'D1',
        partId: 'led-red',
        value: 'RED',
        pins: { anode: 'VCC', cathode: 'GND' },
      },
    ],
    nets: [
      { id: 'net-vcc', name: 'VCC', type: 'power' },
      { id: 'net-gnd', name: 'GND', type: 'ground' },
    ],
    wires: [],
  };
}

function makeManyComponentsIR(count: number): CircuitIR {
  const nets = [
    { id: 'net-vcc', name: 'VCC', type: 'power' as const },
    { id: 'net-gnd', name: 'GND', type: 'ground' as const },
  ];
  const components = Array.from({ length: count }, (_, i) => ({
    id: `comp-${String(i)}`,
    refdes: `R${String(i + 1)}`,
    partId: 'resistor-1k',
    value: '1k',
    pins: { '1': 'VCC', '2': 'GND' },
  }));
  return {
    meta: { name: 'Many', version: '1.0.0' },
    components,
    nets,
    wires: [],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('irToSchematicLayout', () => {
  describe('voltage divider (2 components, 3 nets)', () => {
    it('produces layout with 2 component positions', () => {
      const ir = makeVoltageDividerIR();
      const layout = irToSchematicLayout(ir);

      expect(layout.components).toHaveLength(2);
      expect(layout.components[0].refdes).toBe('R1');
      expect(layout.components[1].refdes).toBe('R2');
    });

    it('produces layout with 3 net paths', () => {
      const ir = makeVoltageDividerIR();
      const layout = irToSchematicLayout(ir);

      expect(layout.nets).toHaveLength(3);
      const netNames = layout.nets.map((n: NetPath) => n.name);
      expect(netNames).toContain('VCC');
      expect(netNames).toContain('GND');
      expect(netNames).toContain('VOUT');
    });

    it('includes value labels on component layouts', () => {
      const ir = makeVoltageDividerIR();
      const layout = irToSchematicLayout(ir);

      expect(layout.components[0].value).toBe('10k');
      expect(layout.components[1].value).toBe('10k');
    });

    it('assigns refdes labels on component layouts', () => {
      const ir = makeVoltageDividerIR();
      const layout = irToSchematicLayout(ir);

      expect(layout.components[0].refdes).toBe('R1');
      expect(layout.components[1].refdes).toBe('R2');
    });

    it('places pins on components with net references', () => {
      const ir = makeVoltageDividerIR();
      const layout = irToSchematicLayout(ir);

      const r1 = layout.components[0];
      expect(r1.pins).toHaveLength(2);
      // Each pin should have a netId referencing the correct net
      const r1NetIds = r1.pins.map((p) => p.netId);
      expect(r1NetIds).toContain('net-vcc');
      expect(r1NetIds).toContain('net-vout');
    });

    it('generates net segments connecting pins', () => {
      const ir = makeVoltageDividerIR();
      const layout = irToSchematicLayout(ir);

      // VOUT net connects R1 pin 2 to R2 pin 1 — should have at least one segment
      const voutNet = layout.nets.find((n) => n.name === 'VOUT');
      expect(voutNet).toBeDefined();
      expect(voutNet!.segments.length).toBeGreaterThan(0);
    });
  });

  describe('net type classification', () => {
    it('marks VCC net as power type', () => {
      const ir = makeVoltageDividerIR();
      const layout = irToSchematicLayout(ir);

      const vccNet = layout.nets.find((n) => n.name === 'VCC');
      expect(vccNet).toBeDefined();
      expect(vccNet!.type).toBe('power');
    });

    it('marks GND net as ground type', () => {
      const ir = makeVoltageDividerIR();
      const layout = irToSchematicLayout(ir);

      const gndNet = layout.nets.find((n) => n.name === 'GND');
      expect(gndNet).toBeDefined();
      expect(gndNet!.type).toBe('ground');
    });

    it('marks signal nets as signal type', () => {
      const ir = makeVoltageDividerIR();
      const layout = irToSchematicLayout(ir);

      const voutNet = layout.nets.find((n) => n.name === 'VOUT');
      expect(voutNet).toBeDefined();
      expect(voutNet!.type).toBe('signal');
    });
  });

  describe('empty IR', () => {
    it('produces empty layout with zero components and nets', () => {
      const ir = makeEmptyIR();
      const layout = irToSchematicLayout(ir);

      expect(layout.components).toHaveLength(0);
      expect(layout.nets).toHaveLength(0);
      expect(layout.width).toBeGreaterThanOrEqual(0);
      expect(layout.height).toBeGreaterThanOrEqual(0);
    });
  });

  describe('single component IR', () => {
    it('produces layout with 1 component', () => {
      const ir = makeSingleComponentIR();
      const layout = irToSchematicLayout(ir);

      expect(layout.components).toHaveLength(1);
      expect(layout.components[0].refdes).toBe('D1');
      expect(layout.components[0].value).toBe('RED');
    });

    it('places component at valid coordinates', () => {
      const ir = makeSingleComponentIR();
      const layout = irToSchematicLayout(ir);

      const comp = layout.components[0];
      expect(comp.x).toBeGreaterThanOrEqual(0);
      expect(comp.y).toBeGreaterThanOrEqual(0);
      expect(comp.width).toBeGreaterThan(0);
      expect(comp.height).toBeGreaterThan(0);
    });
  });

  describe('many components (grid layout)', () => {
    it('lays out 10 components in a grid without overlapping', () => {
      const ir = makeManyComponentsIR(10);
      const layout = irToSchematicLayout(ir);

      expect(layout.components).toHaveLength(10);

      // Check no two component bounding boxes overlap
      for (let i = 0; i < layout.components.length; i++) {
        for (let j = i + 1; j < layout.components.length; j++) {
          const a = layout.components[i];
          const b = layout.components[j];
          const overlaps =
            a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y;
          expect(overlaps, `Components ${a.refdes} and ${b.refdes} overlap`).toBe(false);
        }
      }
    });

    it('lays out 12 components across multiple rows', () => {
      const ir = makeManyComponentsIR(12);
      const layout = irToSchematicLayout(ir);

      expect(layout.components).toHaveLength(12);

      // With 4 per row, 12 components should span at least 3 distinct y-values
      const uniqueYValues = new Set(layout.components.map((c) => c.y));
      expect(uniqueYValues.size).toBeGreaterThanOrEqual(3);
    });

    it('sets layout dimensions to encompass all components', () => {
      const ir = makeManyComponentsIR(10);
      const layout = irToSchematicLayout(ir);

      for (const comp of layout.components) {
        expect(comp.x + comp.width).toBeLessThanOrEqual(layout.width);
        expect(comp.y + comp.height).toBeLessThanOrEqual(layout.height);
      }
    });
  });

  describe('component dimensions', () => {
    it('uses minimum height for components with few pins', () => {
      const ir = makeSingleComponentIR();
      const layout = irToSchematicLayout(ir);

      // 2 pins = 1 pin pair, min height = 60
      expect(layout.components[0].height).toBeGreaterThanOrEqual(60);
    });

    it('increases height for components with many pins', () => {
      const ir: CircuitIR = {
        meta: { name: 'Many Pins', version: '1.0.0' },
        components: [
          {
            id: 'mcu-uuid',
            refdes: 'U1',
            partId: 'atmega328',
            pins: {
              D0: 'net1', D1: 'net2', D2: 'net3', D3: 'net4',
              D4: 'net5', D5: 'net6', D6: 'net7', D7: 'net8',
              VCC: 'VCC', GND: 'GND',
            },
          },
        ],
        nets: [
          { id: 'n1', name: 'net1', type: 'signal' },
          { id: 'n2', name: 'net2', type: 'signal' },
          { id: 'n3', name: 'net3', type: 'signal' },
          { id: 'n4', name: 'net4', type: 'signal' },
          { id: 'n5', name: 'net5', type: 'signal' },
          { id: 'n6', name: 'net6', type: 'signal' },
          { id: 'n7', name: 'net7', type: 'signal' },
          { id: 'n8', name: 'net8', type: 'signal' },
          { id: 'net-vcc', name: 'VCC', type: 'power' },
          { id: 'net-gnd', name: 'GND', type: 'ground' },
        ],
        wires: [],
      };
      const layout = irToSchematicLayout(ir);
      const u1 = layout.components[0];

      // 10 pins = 5 pin pairs, height should be > min 60
      expect(u1.height).toBeGreaterThan(60);
    });
  });

  describe('pin placement', () => {
    it('places pins on component edges', () => {
      const ir = makeVoltageDividerIR();
      const layout = irToSchematicLayout(ir);

      for (const comp of layout.components) {
        for (const pin of comp.pins) {
          // Pin should be on left edge (x = comp.x) or right edge (x = comp.x + comp.width)
          const onLeftEdge = pin.x === comp.x;
          const onRightEdge = pin.x === comp.x + comp.width;
          expect(
            onLeftEdge || onRightEdge,
            `Pin ${pin.name} of ${comp.refdes} at x=${String(pin.x)} not on edge (left=${String(comp.x)}, right=${String(comp.x + comp.width)})`,
          ).toBe(true);

          // Pin y should be within component bounds
          expect(pin.y).toBeGreaterThanOrEqual(comp.y);
          expect(pin.y).toBeLessThanOrEqual(comp.y + comp.height);
        }
      }
    });
  });
});
