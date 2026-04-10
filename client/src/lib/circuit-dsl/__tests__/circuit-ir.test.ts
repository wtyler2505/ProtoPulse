import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  CircuitIRSchema,
  irToInsertSchemas,
  circuitToIR,
} from '../circuit-ir';
import type { CircuitIR } from '../circuit-ir';
import type { CircuitInstanceRow, CircuitNetRow, CircuitWireRow, ComponentPart } from '@shared/schema';

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
    meta: { name: 'Empty Circuit', version: '1.0.0' },
    components: [],
    nets: [],
    wires: [],
  };
}

function makeSingleComponentIR(): CircuitIR {
  return {
    meta: { name: 'Single LED', version: '1.0.0' },
    components: [
      {
        id: 'led1-uuid',
        refdes: 'D1',
        partId: 'led-red',
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

// ---------------------------------------------------------------------------
// CircuitIRSchema — Zod validation
// ---------------------------------------------------------------------------

describe('CircuitIRSchema', () => {
  it('validates a voltage divider circuit', () => {
    const ir = makeVoltageDividerIR();
    const result = CircuitIRSchema.safeParse(ir);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.components).toHaveLength(2);
      expect(result.data.nets).toHaveLength(3);
      expect(result.data.wires).toHaveLength(3);
    }
  });

  it('validates an empty circuit', () => {
    const result = CircuitIRSchema.safeParse(makeEmptyIR());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.components).toHaveLength(0);
      expect(result.data.nets).toHaveLength(0);
      expect(result.data.wires).toHaveLength(0);
    }
  });

  it('validates a single-component circuit', () => {
    const result = CircuitIRSchema.safeParse(makeSingleComponentIR());
    expect(result.success).toBe(true);
  });

  it('rejects missing meta.name', () => {
    const ir = makeVoltageDividerIR();
    (ir.meta as Record<string, unknown>).name = undefined;
    const result = CircuitIRSchema.safeParse(ir);
    expect(result.success).toBe(false);
  });

  it('rejects missing meta.version', () => {
    const ir = makeVoltageDividerIR();
    (ir.meta as Record<string, unknown>).version = undefined;
    const result = CircuitIRSchema.safeParse(ir);
    expect(result.success).toBe(false);
  });

  it('rejects component with missing refdes', () => {
    const ir = makeVoltageDividerIR();
    (ir.components[0] as Record<string, unknown>).refdes = undefined;
    const result = CircuitIRSchema.safeParse(ir);
    expect(result.success).toBe(false);
  });

  it('rejects component with missing partId', () => {
    const ir = makeVoltageDividerIR();
    (ir.components[0] as Record<string, unknown>).partId = undefined;
    const result = CircuitIRSchema.safeParse(ir);
    expect(result.success).toBe(false);
  });

  it('rejects component with empty pins record', () => {
    const ir = makeVoltageDividerIR();
    ir.components[0].pins = {};
    const result = CircuitIRSchema.safeParse(ir);
    expect(result.success).toBe(false);
  });

  it('rejects invalid pin references (pin value not matching any net name)', () => {
    const ir = makeVoltageDividerIR();
    ir.components[0].pins['1'] = 'NONEXISTENT_NET';
    // Schema-level validation checks structure, not cross-references.
    // The refine check on the schema ensures pin net references are valid.
    const result = CircuitIRSchema.safeParse(ir);
    expect(result.success).toBe(false);
  });

  it('rejects duplicate refdes', () => {
    const ir = makeVoltageDividerIR();
    ir.components[1].refdes = 'R1'; // duplicate
    const result = CircuitIRSchema.safeParse(ir);
    expect(result.success).toBe(false);
  });

  it('rejects duplicate component ids', () => {
    const ir = makeVoltageDividerIR();
    ir.components[1].id = ir.components[0].id;
    const result = CircuitIRSchema.safeParse(ir);
    expect(result.success).toBe(false);
  });

  it('rejects duplicate net ids', () => {
    const ir = makeVoltageDividerIR();
    ir.nets[1].id = ir.nets[0].id;
    const result = CircuitIRSchema.safeParse(ir);
    expect(result.success).toBe(false);
  });

  it('rejects duplicate net names', () => {
    const ir = makeVoltageDividerIR();
    ir.nets[1].name = ir.nets[0].name;
    const result = CircuitIRSchema.safeParse(ir);
    expect(result.success).toBe(false);
  });

  it('rejects wire referencing nonexistent net', () => {
    const ir = makeVoltageDividerIR();
    ir.wires[0].netId = 'nonexistent-net-id';
    const result = CircuitIRSchema.safeParse(ir);
    expect(result.success).toBe(false);
  });

  it('rejects wire with fewer than 2 points', () => {
    const ir = makeVoltageDividerIR();
    ir.wires[0].points = [{ x: 0, y: 0 }];
    const result = CircuitIRSchema.safeParse(ir);
    expect(result.success).toBe(false);
  });

  it('rejects invalid net type', () => {
    const ir = makeVoltageDividerIR();
    (ir.nets[0] as Record<string, unknown>).type = 'invalid';
    const result = CircuitIRSchema.safeParse(ir);
    expect(result.success).toBe(false);
  });

  it('accepts many nets', () => {
    const ir = makeEmptyIR();
    for (let i = 0; i < 100; i++) {
      ir.nets.push({ id: `net-${i}`, name: `NET_${i}`, type: 'signal' });
    }
    const result = CircuitIRSchema.safeParse(ir);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nets).toHaveLength(100);
    }
  });

  it('optional value and footprint fields are accepted when absent', () => {
    const ir = makeSingleComponentIR();
    // value and footprint are optional — already absent in fixture
    const result = CircuitIRSchema.safeParse(ir);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// irToInsertSchemas — IR → database insert shapes
// ---------------------------------------------------------------------------

describe('irToInsertSchemas', () => {
  const CIRCUIT_ID = 42;

  it('converts a voltage divider to insert schemas', () => {
    const ir = makeVoltageDividerIR();
    const { instances, nets, wires } = irToInsertSchemas(ir, CIRCUIT_ID);

    expect(instances).toHaveLength(2);
    expect(nets).toHaveLength(3);
    expect(wires).toHaveLength(3);
  });

  it('maps component fields to InsertCircuitInstance shape', () => {
    const ir = makeVoltageDividerIR();
    const { instances } = irToInsertSchemas(ir, CIRCUIT_ID);
    const inst = instances[0];

    expect(inst.circuitId).toBe(CIRCUIT_ID);
    expect(inst.referenceDesignator).toBe('R1');
    expect(inst.properties).toEqual(
      expect.objectContaining({
        irId: 'r1-uuid',
        irPartId: 'resistor-10k',
        value: '10k',
        footprint: '0805',
        pins: { '1': 'VCC', '2': 'VOUT' },
      }),
    );
  });

  it('maps net fields to InsertCircuitNet shape', () => {
    const ir = makeVoltageDividerIR();
    const { nets } = irToInsertSchemas(ir, CIRCUIT_ID);
    const vcc = nets.find((n) => n.name === 'VCC');

    expect(vcc).toBeDefined();
    expect(vcc!.circuitId).toBe(CIRCUIT_ID);
    expect(vcc!.netType).toBe('power');
    expect(vcc!.segments).toEqual(
      expect.arrayContaining([expect.objectContaining({ irId: 'net-vcc' })]),
    );
  });

  it('maps wire fields to InsertCircuitWire shape', () => {
    const ir = makeVoltageDividerIR();
    const { wires, nets } = irToInsertSchemas(ir, CIRCUIT_ID);
    const wire = wires[0];

    expect(wire.circuitId).toBe(CIRCUIT_ID);
    expect(wire.view).toBe('schematic');
    expect(wire.points).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    // Wire netId should be an index corresponding to the net's position (for later resolution)
    expect(wire.netId).toBeDefined();
  });

  it('converts an empty circuit', () => {
    const { instances, nets, wires } = irToInsertSchemas(makeEmptyIR(), CIRCUIT_ID);
    expect(instances).toHaveLength(0);
    expect(nets).toHaveLength(0);
    expect(wires).toHaveLength(0);
  });

  it('converts a single component circuit', () => {
    const { instances, nets, wires } = irToInsertSchemas(makeSingleComponentIR(), CIRCUIT_ID);
    expect(instances).toHaveLength(1);
    expect(nets).toHaveLength(2);
    expect(wires).toHaveLength(0);
  });

  it('preserves wire point data', () => {
    const ir = makeVoltageDividerIR();
    ir.wires[0].points = [{ x: 10, y: 20 }, { x: 30, y: 40 }, { x: 50, y: 60 }];
    const { wires } = irToInsertSchemas(ir, CIRCUIT_ID);
    expect(wires[0].points).toEqual([{ x: 10, y: 20 }, { x: 30, y: 40 }, { x: 50, y: 60 }]);
  });

  it('uses 0-based wire netId indices for deferred resolution', () => {
    const ir = makeVoltageDividerIR();
    const { wires } = irToInsertSchemas(ir, CIRCUIT_ID);
    // Each wire's netId should be the index of its net in the nets array
    // w1 -> net-vcc (index 0), w2 -> net-gnd (index 1), w3 -> net-vout (index 2)
    expect(wires[0].netId).toBe(0);
    expect(wires[1].netId).toBe(1);
    expect(wires[2].netId).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// circuitToIR — database rows → IR
// ---------------------------------------------------------------------------

describe('circuitToIR', () => {
  function makeInstanceRow(overrides: Partial<CircuitInstanceRow> = {}): CircuitInstanceRow {
    return {
      id: 1,
      circuitId: 42,
      partId: 10,
      referenceDesignator: 'R1',
      schematicX: 0,
      schematicY: 0,
      schematicRotation: 0,
      breadboardX: null,
      breadboardY: null,
      breadboardRotation: null,
      pcbX: null,
      pcbY: null,
      pcbRotation: null,
      pcbSide: null,
      benchX: null,
      benchY: null,
      properties: { irId: 'r1-uuid', irPartId: 'res-10k', value: '10k', pins: { '1': 'VCC', '2': 'GND' } },
      createdAt: new Date(),
      ...overrides,
    } as CircuitInstanceRow;
  }

  function makeNetRow(overrides: Partial<CircuitNetRow> = {}): CircuitNetRow {
    return {
      id: 1,
      circuitId: 42,
      name: 'VCC',
      netType: 'power',
      voltage: null,
      busWidth: null,
      segments: [{ irId: 'net-vcc' }],
      labels: [],
      style: {},
      createdAt: new Date(),
      ...overrides,
    } as CircuitNetRow;
  }

  function makeWireRow(overrides: Partial<CircuitWireRow> = {}): CircuitWireRow {
    return {
      id: 1,
      circuitId: 42,
      netId: 1,
      view: 'schematic',
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      layer: 'front',
      width: 1.0,
      color: null,
      wireType: 'wire',
      createdAt: new Date(),
      ...overrides,
    } as CircuitWireRow;
  }

  function makePartRow(overrides: Partial<ComponentPart> = {}): ComponentPart {
    return {
      id: 10,
      projectId: 1,
      nodeId: null,
      meta: { title: 'Resistor 10k', footprint: '0805' },
      connectors: [],
      buses: [],
      views: {},
      constraints: [],
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as ComponentPart;
  }

  it('converts database rows to IR', () => {
    const instances = [makeInstanceRow()];
    const nets = [
      makeNetRow({ id: 1, name: 'VCC', netType: 'power', segments: [{ irId: 'net-vcc' }] }),
      makeNetRow({ id: 2, name: 'GND', netType: 'ground', segments: [{ irId: 'net-gnd' }] }),
    ];
    const wires = [makeWireRow({ netId: 1 })];
    const parts = [makePartRow()];

    const ir = circuitToIR(instances, nets, wires, parts);

    expect(ir.meta.name).toBe('Circuit');
    expect(ir.meta.version).toBe('1.0.0');
    expect(ir.components).toHaveLength(1);
    expect(ir.nets).toHaveLength(2);
    expect(ir.wires).toHaveLength(1);
  });

  it('maps instance properties to component fields', () => {
    const instances = [makeInstanceRow()];
    const nets = [
      makeNetRow({ id: 1, name: 'VCC', netType: 'power' }),
      makeNetRow({ id: 2, name: 'GND', netType: 'ground' }),
    ];

    const ir = circuitToIR(instances, nets, []);
    const comp = ir.components[0];

    expect(comp.refdes).toBe('R1');
    expect(comp.partId).toBe('res-10k');
    expect(comp.value).toBe('10k');
    expect(comp.pins).toEqual({ '1': 'VCC', '2': 'GND' });
  });

  it('maps net rows to IR nets', () => {
    const nets = [
      makeNetRow({ id: 1, name: 'VCC', netType: 'power', segments: [{ irId: 'net-vcc' }] }),
    ];

    const ir = circuitToIR([], nets, []);
    const net = ir.nets[0];

    expect(net.name).toBe('VCC');
    expect(net.type).toBe('power');
    expect(net.id).toBeDefined();
  });

  it('maps wire rows to IR wires, resolving netId to net IR id', () => {
    const nets = [
      makeNetRow({ id: 5, name: 'VCC', netType: 'power', segments: [{ irId: 'net-vcc' }] }),
    ];
    const wires = [makeWireRow({ netId: 5, points: [{ x: 0, y: 0 }, { x: 50, y: 50 }] })];

    const ir = circuitToIR([], nets, wires);
    const wire = ir.wires[0];

    expect(wire.netId).toBe(ir.nets[0].id);
    expect(wire.points).toEqual([{ x: 0, y: 0 }, { x: 50, y: 50 }]);
  });

  it('handles empty inputs', () => {
    const ir = circuitToIR([], [], []);

    expect(ir.components).toHaveLength(0);
    expect(ir.nets).toHaveLength(0);
    expect(ir.wires).toHaveLength(0);
  });

  it('uses partId string from instance properties when parts array omitted', () => {
    const instances = [makeInstanceRow({ properties: { irPartId: 'my-part', pins: { '1': 'VCC' } } })];
    const nets = [makeNetRow({ id: 1, name: 'VCC', netType: 'power' })];

    const ir = circuitToIR(instances, nets, []);
    expect(ir.components[0].partId).toBe('my-part');
  });

  it('generates stable IDs from database row IDs', () => {
    const nets = [
      makeNetRow({ id: 7, name: 'SIG1', netType: 'signal', segments: [{ irId: 'net-sig1' }] }),
      makeNetRow({ id: 8, name: 'SIG2', netType: 'signal', segments: [{ irId: 'net-sig2' }] }),
    ];

    const ir1 = circuitToIR([], nets, []);
    const ir2 = circuitToIR([], nets, []);

    expect(ir1.nets[0].id).toBe(ir2.nets[0].id);
    expect(ir1.nets[1].id).toBe(ir2.nets[1].id);
    expect(ir1.nets[0].id).not.toBe(ir1.nets[1].id);
  });

  it('handles wire with net not found in nets array gracefully', () => {
    const nets = [makeNetRow({ id: 1, name: 'VCC', netType: 'power' })];
    const wires = [makeWireRow({ netId: 999 })]; // net 999 doesn't exist

    const ir = circuitToIR([], nets, wires);
    // Wire should still be included with an empty netId
    expect(ir.wires).toHaveLength(1);
    expect(ir.wires[0].netId).toBe('');
  });

  it('extracts footprint from part meta', () => {
    const parts = [makePartRow({ meta: { title: 'Resistor', footprint: '0402' } })];
    const instances = [makeInstanceRow({ partId: 10 })];
    const nets = [
      makeNetRow({ id: 1, name: 'VCC', netType: 'power' }),
      makeNetRow({ id: 2, name: 'GND', netType: 'ground' }),
    ];

    const ir = circuitToIR(instances, nets, [], parts);
    expect(ir.components[0].footprint).toBe('0402');
  });
});

// ---------------------------------------------------------------------------
// Round-trip: IR -> insert schemas -> (simulate DB) -> back to IR
// ---------------------------------------------------------------------------

describe('round-trip IR conversion', () => {
  it('preserves core data through IR -> insert -> row -> IR', () => {
    const original = makeVoltageDividerIR();
    const { instances: insertInstances, nets: insertNets, wires: insertWires } = irToInsertSchemas(original, 42);

    // Simulate database by adding auto-generated fields
    const dbInstances: CircuitInstanceRow[] = insertInstances.map((inst, i) => ({
      ...inst,
      id: i + 1,
      createdAt: new Date(),
      breadboardX: null,
      breadboardY: null,
      breadboardRotation: null,
      pcbX: null,
      pcbY: null,
      pcbRotation: null,
      pcbSide: null,
      benchX: null,
      benchY: null,
    })) as CircuitInstanceRow[];

    const dbNets: CircuitNetRow[] = insertNets.map((net, i) => ({
      ...net,
      id: i + 1,
      createdAt: new Date(),
      voltage: null,
      busWidth: null,
    })) as CircuitNetRow[];

    // Resolve wire netIds (0-based index -> 1-based DB id)
    const dbWires: CircuitWireRow[] = insertWires.map((wire, i) => ({
      ...wire,
      id: i + 1,
      netId: (wire.netId as number) + 1, // 0-based index -> 1-based DB id
      createdAt: new Date(),
    })) as CircuitWireRow[];

    const roundTripped = circuitToIR(dbInstances, dbNets, dbWires);

    // Component data preserved
    expect(roundTripped.components).toHaveLength(original.components.length);
    expect(roundTripped.components[0].refdes).toBe('R1');
    expect(roundTripped.components[0].partId).toBe('resistor-10k');
    expect(roundTripped.components[0].value).toBe('10k');
    expect(roundTripped.components[0].pins).toEqual(original.components[0].pins);

    // Net data preserved
    expect(roundTripped.nets).toHaveLength(original.nets.length);
    const netNames = roundTripped.nets.map((n) => n.name).sort();
    expect(netNames).toEqual(['GND', 'VCC', 'VOUT']);

    // Wire data preserved
    expect(roundTripped.wires).toHaveLength(original.wires.length);
    expect(roundTripped.wires[0].points).toEqual(original.wires[0].points);
  });
});
