import { describe, it, expect } from 'vitest';
import {
  generateGerber,
  generateCopperLayer,
  generateBoardOutline,
  type GerberInput,
  type GerberInstance,
  type GerberConnector,
  type GerberWire,
} from '../export/gerber-generator';
import {
  generateNetlist,
  generateSpiceNetlist,
  generateKicadNetlist,
  generateCsvNetlist,
  type NetlistInput,
} from '../export/netlist-generator';
import {
  generateKicadSchematic,
  generateKicadPcb,
  generateKicadProjectFile,
  type KicadInput,
} from '../export/kicad-exporter';
import {
  generateEagleSchematic,
  generateEagleBoard,
  type EagleInput,
} from '../export/eagle-exporter';
import {
  exportSpiceNetlist,
  type SpiceExportInput,
  type SpiceExportConfig,
} from '../export/spice-exporter';
import type { CircuitInstanceRow, CircuitNetRow, ComponentPart } from '@shared/schema';

// =============================================================================
// Shared Fixtures
// =============================================================================

// -- Gerber fixtures --

function makeThtConnector(overrides: Partial<GerberConnector> = {}): GerberConnector {
  return {
    id: 'pin1',
    name: 'PIN1',
    padType: 'tht',
    padWidth: 1.6,
    padHeight: 1.6,
    drill: 0.8,
    offsetX: -3,
    offsetY: 0,
    ...overrides,
  };
}

function makeSmdConnector(overrides: Partial<GerberConnector> = {}): GerberConnector {
  return {
    id: 'pad1',
    name: 'PAD1',
    padType: 'smd',
    padWidth: 1.0,
    padHeight: 0.6,
    offsetX: -2,
    offsetY: 0,
    ...overrides,
  };
}

function makeGerberInstance(overrides: Partial<GerberInstance> = {}): GerberInstance {
  return {
    id: 1,
    referenceDesignator: 'U1',
    pcbX: 25,
    pcbY: 25,
    pcbRotation: 0,
    pcbSide: 'front',
    connectors: [
      makeThtConnector({ id: 'p1', name: 'P1', offsetX: -3, offsetY: 0 }),
      makeThtConnector({ id: 'p2', name: 'P2', offsetX: 3, offsetY: 0 }),
    ],
    footprint: 'DIP-8',
    bodyWidth: 6,
    bodyHeight: 4,
    ...overrides,
  };
}

function makeGerberWire(overrides: Partial<GerberWire> = {}): GerberWire {
  return {
    layer: 'front',
    points: [{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 20 }],
    width: 0.25,
    ...overrides,
  };
}

function makeGerberInput(overrides: Partial<GerberInput> = {}): GerberInput {
  return {
    boardWidth: 50,
    boardHeight: 40,
    instances: [makeGerberInstance()],
    wires: [makeGerberWire()],
    ...overrides,
  };
}

// -- Netlist fixtures --

function makeNetlistInput(overrides: Partial<NetlistInput> = {}): NetlistInput {
  const parts = new Map<number, {
    id: number;
    meta: Record<string, unknown>;
    connectors: Array<{ id: string; name: string }>;
  }>();
  parts.set(1, {
    id: 1,
    meta: { title: '10K Resistor', value: '10K', family: 'resistor' },
    connectors: [
      { id: 'pin1', name: 'PIN1' },
      { id: 'pin2', name: 'PIN2' },
    ],
  });
  parts.set(2, {
    id: 2,
    meta: { title: '100nF Capacitor', value: '100nF', family: 'capacitor' },
    connectors: [
      { id: 'pin1', name: 'PIN1' },
      { id: 'pin2', name: 'PIN2' },
    ],
  });

  return {
    circuit: { id: 1, name: 'Snapshot Test Circuit' },
    instances: [
      { id: 1, partId: 1, referenceDesignator: 'R1' },
      { id: 2, partId: 2, referenceDesignator: 'C1' },
    ],
    nets: [
      {
        id: 1,
        name: 'VCC',
        netType: 'power',
        voltage: '3.3',
        busWidth: null,
        segments: [
          { fromInstanceId: 1, fromPin: 'pin1', toInstanceId: 2, toPin: 'pin1' },
        ],
      },
      {
        id: 2,
        name: 'GND',
        netType: 'ground',
        voltage: '0',
        busWidth: null,
        segments: [
          { fromInstanceId: 1, fromPin: 'pin2', toInstanceId: 2, toPin: 'pin2' },
        ],
      },
    ],
    parts,
    ...overrides,
  };
}

// -- KiCad fixtures --

function makeKicadInput(overrides: Partial<KicadInput> = {}): KicadInput {
  const parts = new Map<number, {
    meta: Record<string, unknown>;
    connectors: Array<{ id: string; name: string; padType?: string }>;
  }>();
  parts.set(1, {
    meta: { title: 'ATmega328P', value: 'ATmega328P', packageType: 'DIP-28' },
    connectors: [
      { id: 'pin1', name: 'RESET', padType: 'tht' },
      { id: 'pin2', name: 'VCC', padType: 'tht' },
      { id: 'pin3', name: 'GND', padType: 'tht' },
    ],
  });

  return {
    circuit: { id: 1, name: 'KiCad Snapshot Circuit' },
    instances: [
      {
        id: 1,
        referenceDesignator: 'U1',
        partId: 1,
        schematicX: 100,
        schematicY: 200,
        schematicRotation: 0,
        pcbX: 25,
        pcbY: 30,
        pcbRotation: 0,
        pcbSide: 'front',
      },
    ],
    nets: [
      {
        name: 'VCC',
        netType: 'power',
        segments: [
          { fromInstanceId: 1, fromPin: 'pin2', toInstanceId: 1, toPin: 'pin2' },
        ],
      },
    ],
    wires: [
      {
        netId: 0,
        view: 'pcb',
        points: [{ x: 10, y: 10 }, { x: 25, y: 30 }],
        layer: 'front',
        width: 0.25,
      },
    ],
    parts,
    boardWidth: 60,
    boardHeight: 50,
    ...overrides,
  };
}

// -- Eagle fixtures --

function makeEagleInput(overrides: Partial<EagleInput> = {}): EagleInput {
  const parts = new Map<number, {
    meta: Record<string, unknown>;
    connectors: Array<{ id: string; name: string; padType?: string }>;
  }>();
  parts.set(1, {
    meta: { title: 'LM7805', value: '5V', packageType: 'TO-220' },
    connectors: [
      { id: 'pin1', name: 'IN', padType: 'tht' },
      { id: 'pin2', name: 'GND', padType: 'tht' },
      { id: 'pin3', name: 'OUT', padType: 'tht' },
    ],
  });

  return {
    circuit: { id: 1, name: 'Eagle Snapshot Circuit' },
    instances: [
      {
        id: 1,
        referenceDesignator: 'U1',
        partId: 1,
        schematicX: 150,
        schematicY: 100,
        schematicRotation: 0,
        pcbX: 20,
        pcbY: 15,
        pcbRotation: 90,
        pcbSide: 'front',
      },
    ],
    nets: [
      {
        name: 'VIN',
        netType: 'power',
        segments: [
          { fromInstanceId: 1, fromPin: 'pin1', toInstanceId: 1, toPin: 'pin1' },
        ],
      },
    ],
    wires: [
      {
        netId: 0,
        view: 'pcb',
        points: [{ x: 5, y: 5 }, { x: 20, y: 15 }],
        layer: 'front',
        width: 0.3,
      },
    ],
    parts,
    boardWidth: 50,
    boardHeight: 40,
    ...overrides,
  };
}

// -- SPICE exporter fixtures --

function makeSpiceInstance(overrides: Partial<CircuitInstanceRow> = {}): CircuitInstanceRow {
  return {
    id: 1,
    circuitId: 1,
    partId: 100,
    referenceDesignator: 'R1',
    schematicX: 0,
    schematicY: 0,
    schematicRotation: 0,
    breadboardX: null,
    breadboardY: null,
    breadboardRotation: 0,
    pcbX: null,
    pcbY: null,
    pcbRotation: 0,
    pcbSide: 'front',
    properties: { value: '10K' },
    createdAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeSpiceNet(overrides: Partial<CircuitNetRow> = {}): CircuitNetRow {
  return {
    id: 1,
    circuitId: 1,
    name: 'NET1',
    netType: 'signal',
    voltage: null,
    busWidth: null,
    segments: [],
    labels: [],
    style: {},
    createdAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeSpicePart(overrides: Partial<ComponentPart> = {}): ComponentPart {
  return {
    id: 100,
    projectId: 1,
    nodeId: null,
    meta: { family: 'resistor', title: 'Resistor' },
    connectors: [
      { id: 'pin1', name: 'PIN1', connectorType: 'pad', shapeIds: {} },
      { id: 'pin2', name: 'PIN2', connectorType: 'pad', shapeIds: {} },
    ],
    buses: [],
    views: {},
    constraints: [],
    version: 1,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeSpiceConfig(overrides: Partial<SpiceExportConfig> = {}): SpiceExportConfig {
  return {
    analysis: 'op',
    ...overrides,
  };
}

function makeSpiceInput(overrides: Partial<SpiceExportInput> = {}): SpiceExportInput {
  return {
    circuitName: 'Snapshot SPICE Circuit',
    instances: [
      makeSpiceInstance({ id: 1, partId: 100, referenceDesignator: 'R1', properties: { value: '10K' } }),
      makeSpiceInstance({ id: 2, partId: 200, referenceDesignator: 'C1', properties: { value: '100n' } }),
    ],
    nets: [
      makeSpiceNet({
        id: 1,
        name: 'VCC',
        netType: 'power',
        segments: [
          { fromInstanceId: 1, fromPin: 'pin1', toInstanceId: 2, toPin: 'pin1' },
        ],
      }),
      makeSpiceNet({
        id: 2,
        name: 'GND',
        netType: 'ground',
        segments: [
          { fromInstanceId: 1, fromPin: 'pin2', toInstanceId: 2, toPin: 'pin2' },
        ],
      }),
    ],
    parts: [
      makeSpicePart({ id: 100, meta: { family: 'resistor', title: 'Resistor' } }),
      makeSpicePart({
        id: 200,
        meta: { family: 'capacitor', title: 'Capacitor' },
        connectors: [
          { id: 'pin1', name: 'PIN1', connectorType: 'pad', shapeIds: {} },
          { id: 'pin2', name: 'PIN2', connectorType: 'pad', shapeIds: {} },
        ],
      }),
    ],
    config: makeSpiceConfig(),
    ...overrides,
  };
}

// =============================================================================
// Gerber Snapshot Tests
// =============================================================================

describe('Gerber snapshot tests', () => {
  it('generateGerber — full output structure matches snapshot', () => {
    const input = makeGerberInput();
    const output = generateGerber(input);

    // Snapshot layer names and types (structural)
    const structure = output.layers.map(function extractLayerMeta(l) {
      return { name: l.name, type: l.type, side: l.side };
    });
    expect(structure).toMatchSnapshot();
  });

  it('generateCopperLayer — front copper matches snapshot', () => {
    const input = makeGerberInput();
    const content = generateCopperLayer(input, 'front');
    expect(content).toMatchSnapshot();
  });

  it('generateCopperLayer — back copper matches snapshot', () => {
    const input = makeGerberInput();
    const content = generateCopperLayer(input, 'back');
    expect(content).toMatchSnapshot();
  });

  it('generateBoardOutline — rectangular outline matches snapshot', () => {
    const input = makeGerberInput({ instances: [], wires: [] });
    const content = generateBoardOutline(input);
    expect(content).toMatchSnapshot();
  });

  it('generateBoardOutline — custom polygon matches snapshot', () => {
    const input = makeGerberInput({
      instances: [],
      wires: [],
      boardOutline: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 30 },
        { x: 25, y: 40 },
        { x: 0, y: 30 },
      ],
    });
    const content = generateBoardOutline(input);
    expect(content).toMatchSnapshot();
  });

  it('generateGerber — drill file for THT components matches snapshot', () => {
    const input = makeGerberInput();
    const output = generateGerber(input);
    expect(output.drillFile).toMatchSnapshot();
  });

  it('generateGerber — drill file for SMD-only board matches snapshot', () => {
    const input = makeGerberInput({
      instances: [makeGerberInstance({
        footprint: 'SOIC-8',
        connectors: [
          makeSmdConnector({ id: 'p1', name: 'P1', offsetX: -1, offsetY: 0 }),
          makeSmdConnector({ id: 'p2', name: 'P2', offsetX: 1, offsetY: 0 }),
        ],
      })],
    });
    const output = generateGerber(input);
    expect(output.drillFile).toMatchSnapshot();
  });
});

// =============================================================================
// Netlist Generator Snapshot Tests
// =============================================================================

describe('Netlist generator snapshot tests', () => {
  it('generateSpiceNetlist matches snapshot', () => {
    const input = makeNetlistInput();
    const output = generateSpiceNetlist(input);
    expect(output).toMatchSnapshot();
  });

  it('generateKicadNetlist matches snapshot', () => {
    const input = makeNetlistInput();
    const output = generateKicadNetlist(input);
    expect(output).toMatchSnapshot();
  });

  it('generateCsvNetlist matches snapshot', () => {
    const input = makeNetlistInput();
    const output = generateCsvNetlist(input);
    expect(output).toMatchSnapshot();
  });

  it('generateNetlist — spice format matches snapshot', () => {
    const input = makeNetlistInput();
    const output = generateNetlist(input, 'spice');
    expect(output).toMatchSnapshot();
  });

  it('generateNetlist — kicad format matches snapshot', () => {
    const input = makeNetlistInput();
    const output = generateNetlist(input, 'kicad');
    expect(output).toMatchSnapshot();
  });

  it('generateNetlist — csv format matches snapshot', () => {
    const input = makeNetlistInput();
    const output = generateNetlist(input, 'csv');
    expect(output).toMatchSnapshot();
  });
});

// =============================================================================
// KiCad Exporter Snapshot Tests
// =============================================================================

describe('KiCad exporter snapshot tests', () => {
  it('generateKicadSchematic matches snapshot', () => {
    const input = makeKicadInput();
    const output = generateKicadSchematic(input);
    expect(output).toMatchSnapshot();
  });

  it('generateKicadPcb matches snapshot', () => {
    const input = makeKicadInput();
    const output = generateKicadPcb(input);
    expect(output).toMatchSnapshot();
  });

  it('generateKicadProjectFile matches snapshot', () => {
    const input = makeKicadInput();
    const output = generateKicadProjectFile(input);
    expect(output).toMatchSnapshot();
  });
});

// =============================================================================
// Eagle Exporter Snapshot Tests
// =============================================================================

describe('Eagle exporter snapshot tests', () => {
  it('generateEagleSchematic matches snapshot', () => {
    const input = makeEagleInput();
    const output = generateEagleSchematic(input);
    expect(output).toMatchSnapshot();
  });

  it('generateEagleBoard matches snapshot', () => {
    const input = makeEagleInput();
    const output = generateEagleBoard(input);
    expect(output).toMatchSnapshot();
  });
});

// =============================================================================
// SPICE Exporter Snapshot Tests
// =============================================================================

describe('SPICE exporter snapshot tests', () => {
  it('exportSpiceNetlist — RC circuit with operating point matches snapshot', () => {
    const output = exportSpiceNetlist(makeSpiceInput());
    // Exclude the timestamp line which changes on every run
    const stableNetlist = output.netlist.replace(/\* Generated by ProtoPulse — .+/, '* Generated by ProtoPulse — [TIMESTAMP]');
    expect(stableNetlist).toMatchSnapshot();
    expect(output.filename).toMatchSnapshot();
  });

  it('exportSpiceNetlist — transient analysis matches snapshot', () => {
    const output = exportSpiceNetlist(makeSpiceInput({
      config: makeSpiceConfig({
        analysis: 'tran',
        transient: { startTime: 0, stopTime: 0.001, timeStep: 0.000001 },
      }),
    }));
    const stableNetlist = output.netlist.replace(/\* Generated by ProtoPulse — .+/, '* Generated by ProtoPulse — [TIMESTAMP]');
    expect(stableNetlist).toMatchSnapshot();
  });

  it('exportSpiceNetlist — AC analysis matches snapshot', () => {
    const output = exportSpiceNetlist(makeSpiceInput({
      config: makeSpiceConfig({
        analysis: 'ac',
        ac: { startFreq: 1, stopFreq: 1000000, numPoints: 100, sweepType: 'dec' },
      }),
    }));
    const stableNetlist = output.netlist.replace(/\* Generated by ProtoPulse — .+/, '* Generated by ProtoPulse — [TIMESTAMP]');
    expect(stableNetlist).toMatchSnapshot();
  });
});
