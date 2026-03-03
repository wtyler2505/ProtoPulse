import { describe, it, expect } from 'vitest';
import { generateIpc2581, type Ipc2581Input } from '../export/ipc2581-generator';

// =============================================================================
// Fixtures
// =============================================================================

function makeIpc2581Input(overrides: Partial<Ipc2581Input> = {}): Ipc2581Input {
  return {
    projectName: 'Test Project',
    instances: [],
    nets: [],
    wires: [],
    parts: new Map(),
    bom: [],
    boardWidth: 50,
    boardHeight: 40,
    ...overrides,
  };
}

function makePopulatedInput(): Ipc2581Input {
  const parts = new Map<number, {
    meta: Record<string, unknown>;
    connectors: Array<{ id: string; name: string; padType?: string }>;
  }>();

  parts.set(100, {
    meta: { title: 'ATmega328P', package: 'DIP-28', packageType: 'DIP-28' },
    connectors: [
      { id: 'c1', name: 'VCC' },
      { id: 'c2', name: 'GND' },
      { id: 'c3', name: 'PB0' },
      { id: 'c4', name: 'PB1' },
    ],
  });

  parts.set(200, {
    meta: { title: 'Resistor', package: '0805', value: '10K' },
    connectors: [
      { id: 'c1', name: 'PIN1', padType: 'smd' },
      { id: 'c2', name: 'PIN2', padType: 'smd' },
    ],
  });

  return makeIpc2581Input({
    instances: [
      {
        id: 1,
        partId: 100,
        referenceDesignator: 'U1',
        schematicX: 100,
        schematicY: 200,
        schematicRotation: 0,
        pcbX: 25,
        pcbY: 30,
        pcbRotation: 0,
        pcbSide: 'front',
        properties: {},
      },
      {
        id: 2,
        partId: 200,
        referenceDesignator: 'R1',
        schematicX: 300,
        schematicY: 200,
        schematicRotation: 90,
        pcbX: 35,
        pcbY: 25,
        pcbRotation: 90,
        pcbSide: 'front',
        properties: {},
      },
    ],
    nets: [
      {
        id: 1,
        name: 'VCC',
        netType: 'power',
        voltage: '5V',
        busWidth: null,
        segments: [
          { fromInstanceId: 1, fromPin: 'VCC', toInstanceId: 2, toPin: 'PIN1' },
        ],
        labels: [],
      },
      {
        id: 2,
        name: 'GND',
        netType: 'power',
        voltage: '0V',
        busWidth: null,
        segments: [
          { fromInstanceId: 1, fromPin: 'GND', toInstanceId: 2, toPin: 'PIN2' },
        ],
        labels: [],
      },
    ],
    wires: [
      {
        id: 1,
        netId: 1,
        view: 'pcb',
        points: [{ x: 25, y: 30 }, { x: 35, y: 25 }],
        layer: 'front',
        width: 0.25,
      },
      {
        id: 2,
        netId: 2,
        view: 'pcb',
        points: [{ x: 25, y: 32 }, { x: 35, y: 27 }],
        layer: 'front',
        width: 0.25,
      },
    ],
    parts,
    bom: [
      {
        partNumber: 'ATMEGA328P-PU',
        manufacturer: 'Microchip',
        description: '8-bit AVR Microcontroller',
        quantity: 1,
        unitPrice: '3.50',
        totalPrice: '3.50',
        supplier: 'Digi-Key',
        stock: 100,
        status: 'active',
        leadTime: '1 week',
      },
      {
        partNumber: 'RC0805JR-0710KL',
        manufacturer: 'Yageo',
        description: '10K Ohm 0805 Resistor',
        quantity: 5,
        unitPrice: '0.10',
        totalPrice: '0.50',
        supplier: 'Mouser',
        stock: 500,
        status: 'active',
        leadTime: null,
      },
    ],
  });
}

// =============================================================================
// XML structure
// =============================================================================

describe('generateIpc2581', () => {
  it('returns valid XML with header', () => {
    const input = makeIpc2581Input();
    const result = generateIpc2581(input);

    expect(result.xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(result.xml).toContain('<IPC-2581');
    expect(result.xml).toContain('</IPC-2581>');
  });

  it('includes the IPC-2581 namespace', () => {
    const input = makeIpc2581Input();
    const result = generateIpc2581(input);

    expect(result.xml).toContain('xmlns="http://webstds.ipc.org/2581"');
  });

  it('reports correct net and component counts', () => {
    const input = makePopulatedInput();
    const result = generateIpc2581(input);

    expect(result.netCount).toBe(2);
    expect(result.componentCount).toBe(2);
  });

  it('handles empty project gracefully', () => {
    const input = makeIpc2581Input();
    const result = generateIpc2581(input);

    expect(result.xml).toContain('<IPC-2581');
    expect(result.xml).toContain('</IPC-2581>');
    expect(result.netCount).toBe(0);
    expect(result.componentCount).toBe(0);
  });
});

// =============================================================================
// Ecad section
// =============================================================================

describe('IPC-2581 Ecad section', () => {
  it('contains Ecad element with project name', () => {
    const input = makeIpc2581Input({ projectName: 'Rover Controller' });
    const result = generateIpc2581(input);

    expect(result.xml).toContain('<Ecad name="Rover Controller">');
    expect(result.xml).toContain('<CadHeader units="MILLIMETER"/>');
  });

  it('includes step reference', () => {
    const input = makeIpc2581Input();
    const result = generateIpc2581(input);

    expect(result.xml).toContain('<Step name="pcb"/>');
  });
});

// =============================================================================
// Content section
// =============================================================================

describe('IPC-2581 Content section', () => {
  it('defines standard layer references', () => {
    const input = makeIpc2581Input();
    const result = generateIpc2581(input);

    expect(result.xml).toContain('<LayerRef name="TOP"/>');
    expect(result.xml).toContain('<LayerRef name="BOTTOM"/>');
    expect(result.xml).toContain('<LayerRef name="SOLDER_MASK_TOP"/>');
    expect(result.xml).toContain('<LayerRef name="SOLDER_MASK_BOTTOM"/>');
    expect(result.xml).toContain('<LayerRef name="SILK_SCREEN_TOP"/>');
    expect(result.xml).toContain('<LayerRef name="SILK_SCREEN_BOTTOM"/>');
    expect(result.xml).toContain('<LayerRef name="DRILL"/>');
  });

  it('includes padstack definitions for THT and SMD', () => {
    const input = makeIpc2581Input();
    const result = generateIpc2581(input);

    expect(result.xml).toContain('<PadstackDef name="PAD_THT">');
    expect(result.xml).toContain('<PadstackDef name="PAD_SMD">');
    expect(result.xml).toContain('platingStatus="PLATED"');
  });

  it('defines board profile as polygon', () => {
    const input = makeIpc2581Input({ boardWidth: 100, boardHeight: 80 });
    const result = generateIpc2581(input);

    expect(result.xml).toContain('<Profile>');
    expect(result.xml).toContain('<Polygon>');
    expect(result.xml).toContain('<PolyBegin x="0.0000" y="0.0000"/>');
    expect(result.xml).toContain('x="100.0000" y="0.0000"');
    expect(result.xml).toContain('x="100.0000" y="80.0000"');
  });

  it('includes line description for traces', () => {
    const input = makeIpc2581Input();
    const result = generateIpc2581(input);

    expect(result.xml).toContain('<LineDesc lineWidth="0.2500" lineEnd="ROUND"/>');
  });

  it('uses default board dimensions when not specified', () => {
    const input = makeIpc2581Input({ boardWidth: undefined, boardHeight: undefined });
    const result = generateIpc2581(input);

    expect(result.xml).toContain('x="50.0000" y="0.0000"');
    expect(result.xml).toContain('x="50.0000" y="40.0000"');
  });
});

// =============================================================================
// LogicalNet section
// =============================================================================

describe('IPC-2581 LogicalNet section', () => {
  it('contains Net elements for each net', () => {
    const input = makePopulatedInput();
    const result = generateIpc2581(input);

    expect(result.xml).toContain('<LogicalNet>');
    expect(result.xml).toContain('<Net name="VCC" type="power">');
    expect(result.xml).toContain('<Net name="GND" type="power">');
    expect(result.xml).toContain('</LogicalNet>');
  });

  it('includes pin references in each net', () => {
    const input = makePopulatedInput();
    const result = generateIpc2581(input);

    expect(result.xml).toContain('componentRef="U1" pin="VCC"');
    expect(result.xml).toContain('componentRef="R1" pin="PIN1"');
    expect(result.xml).toContain('componentRef="U1" pin="GND"');
    expect(result.xml).toContain('componentRef="R1" pin="PIN2"');
  });

  it('deduplicates pin references within a net', () => {
    const input = makeIpc2581Input({
      instances: [
        { id: 1, partId: null, referenceDesignator: 'U1', schematicX: 0, schematicY: 0, schematicRotation: 0, pcbX: 0, pcbY: 0, pcbRotation: 0, pcbSide: 'front', properties: {} },
        { id: 2, partId: null, referenceDesignator: 'U2', schematicX: 0, schematicY: 0, schematicRotation: 0, pcbX: 10, pcbY: 0, pcbRotation: 0, pcbSide: 'front', properties: {} },
      ],
      nets: [{
        id: 1,
        name: 'NET1',
        netType: 'signal',
        voltage: null,
        busWidth: null,
        segments: [
          { fromInstanceId: 1, fromPin: 'A', toInstanceId: 2, toPin: 'B' },
          { fromInstanceId: 1, fromPin: 'A', toInstanceId: 2, toPin: 'B' },  // duplicate
        ],
        labels: [],
      }],
    });

    const result = generateIpc2581(input);
    const pinRefMatches = result.xml.match(/componentRef="U1" pin="A"/g);
    expect(pinRefMatches).toHaveLength(1);
  });

  it('handles empty nets gracefully', () => {
    const input = makeIpc2581Input({
      nets: [{
        id: 1,
        name: 'EMPTY_NET',
        netType: 'signal',
        voltage: null,
        busWidth: null,
        segments: [],
        labels: [],
      }],
    });

    const result = generateIpc2581(input);
    expect(result.xml).toContain('<Net name="EMPTY_NET"');
    expect(result.xml).toContain('</Net>');
  });
});

// =============================================================================
// PhysicalNet section
// =============================================================================

describe('IPC-2581 PhysicalNet section', () => {
  it('places components with coordinates and rotation', () => {
    const input = makePopulatedInput();
    const result = generateIpc2581(input);

    expect(result.xml).toContain('<PhysicalNet>');
    expect(result.xml).toContain('refDes="U1"');
    expect(result.xml).toContain('refDes="R1"');
    expect(result.xml).toContain('<Location x="25.0000" y="30.0000" rotation="0.0"/>');
    expect(result.xml).toContain('<Location x="35.0000" y="25.0000" rotation="90.0"/>');
  });

  it('assigns correct layer for component side', () => {
    const parts = new Map<number, {
      meta: Record<string, unknown>;
      connectors: Array<{ id: string; name: string; padType?: string }>;
    }>();
    parts.set(1, { meta: { title: 'Cap' }, connectors: [{ id: 'c1', name: 'P1' }] });

    const input = makeIpc2581Input({
      instances: [
        { id: 1, partId: 1, referenceDesignator: 'C1', schematicX: 0, schematicY: 0, schematicRotation: 0, pcbX: 10, pcbY: 10, pcbRotation: 0, pcbSide: 'back', properties: {} },
      ],
      parts,
    });

    const result = generateIpc2581(input);
    expect(result.xml).toContain('layerRef="BOTTOM"');
  });

  it('includes pin locations with padstack references', () => {
    const input = makePopulatedInput();
    const result = generateIpc2581(input);

    // U1 has THT connectors
    expect(result.xml).toContain('padstackRef="PAD_THT"');
    // R1 has SMD connectors
    expect(result.xml).toContain('padstackRef="PAD_SMD"');
  });

  it('includes trace data from PCB wires', () => {
    const input = makePopulatedInput();
    const result = generateIpc2581(input);

    expect(result.xml).toContain('<Traces>');
    expect(result.xml).toContain('<Trace layerRef="TOP"');
    expect(result.xml).toContain('lineDescRef="LINE_DEFAULT"');
    expect(result.xml).toContain('<PolyBegin');
    expect(result.xml).toContain('<PolyStepSegment');
    expect(result.xml).toContain('</Trace>');
    expect(result.xml).toContain('</Traces>');
  });

  it('handles back-layer wires', () => {
    const input = makeIpc2581Input({
      wires: [{
        id: 1,
        netId: 1,
        view: 'pcb',
        points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
        layer: 'back',
        width: 0.25,
      }],
    });

    const result = generateIpc2581(input);
    expect(result.xml).toContain('layerRef="BOTTOM"');
  });

  it('excludes schematic wires from physical net', () => {
    const input = makeIpc2581Input({
      wires: [
        { id: 1, netId: 1, view: 'schematic', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], layer: 'front', width: 0.1 },
        { id: 2, netId: 1, view: 'pcb', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], layer: 'front', width: 0.25 },
      ],
    });

    const result = generateIpc2581(input);
    // Should only have one trace (the pcb wire)
    const traceMatches = result.xml.match(/<Trace /g);
    expect(traceMatches).toHaveLength(1);
  });
});

// =============================================================================
// Bom section
// =============================================================================

describe('IPC-2581 Bom section', () => {
  it('includes all BOM items', () => {
    const input = makePopulatedInput();
    const result = generateIpc2581(input);

    expect(result.xml).toContain('<Bom>');
    expect(result.xml).toContain('<BomItem>');
    expect(result.xml).toContain('<PartNumber>ATMEGA328P-PU</PartNumber>');
    expect(result.xml).toContain('<Manufacturer>Microchip</Manufacturer>');
    expect(result.xml).toContain('<Quantity>1</Quantity>');
    expect(result.xml).toContain('<PartNumber>RC0805JR-0710KL</PartNumber>');
    expect(result.xml).toContain('<Quantity>5</Quantity>');
    expect(result.xml).toContain('</Bom>');
  });

  it('includes supplier and status information', () => {
    const input = makePopulatedInput();
    const result = generateIpc2581(input);

    expect(result.xml).toContain('<Supplier>Digi-Key</Supplier>');
    expect(result.xml).toContain('<Status>active</Status>');
  });

  it('handles empty BOM with comment', () => {
    const input = makeIpc2581Input();
    const result = generateIpc2581(input);

    expect(result.xml).toContain('<Bom>');
    expect(result.xml).toContain('<!-- No BOM items -->');
    expect(result.xml).toContain('</Bom>');
  });

  it('escapes XML special characters in BOM data', () => {
    const input = makeIpc2581Input({
      bom: [{
        partNumber: 'R&D-001',
        manufacturer: '<MFG> Corp',
        description: 'Special "part" with & chars',
        quantity: 1,
        unitPrice: '1.00',
        totalPrice: '1.00',
        supplier: 'Test\'s Supply',
        stock: 10,
        status: 'active',
        leadTime: null,
      }],
    });

    const result = generateIpc2581(input);
    expect(result.xml).toContain('R&amp;D-001');
    expect(result.xml).toContain('&lt;MFG&gt; Corp');
    expect(result.xml).toContain('Special &quot;part&quot; with &amp; chars');
    expect(result.xml).toContain('Test&apos;s Supply');
  });
});

// =============================================================================
// Edge cases
// =============================================================================

describe('IPC-2581 edge cases', () => {
  it('handles instance with null partId', () => {
    const input = makeIpc2581Input({
      instances: [
        { id: 1, partId: null, referenceDesignator: 'X1', schematicX: 0, schematicY: 0, schematicRotation: 0, pcbX: 10, pcbY: 10, pcbRotation: 0, pcbSide: 'front', properties: {} },
      ],
    });

    const result = generateIpc2581(input);
    expect(result.xml).toContain('refDes="X1"');
    expect(result.componentCount).toBe(1);
  });

  it('handles instance with null PCB coordinates', () => {
    const parts = new Map<number, {
      meta: Record<string, unknown>;
      connectors: Array<{ id: string; name: string; padType?: string }>;
    }>();
    parts.set(1, { meta: { title: 'IC' }, connectors: [{ id: 'c1', name: 'P1' }] });

    const input = makeIpc2581Input({
      instances: [
        { id: 1, partId: 1, referenceDesignator: 'U1', schematicX: 50, schematicY: 50, schematicRotation: 0, pcbX: null, pcbY: null, pcbRotation: null, pcbSide: null, properties: {} },
      ],
      parts,
    });

    const result = generateIpc2581(input);
    // Should default to 0,0
    expect(result.xml).toContain('x="0.0000" y="0.0000"');
  });

  it('escapes XML special characters in net names', () => {
    const input = makeIpc2581Input({
      nets: [{
        id: 1,
        name: 'V&CC <3.3>',
        netType: 'power',
        voltage: null,
        busWidth: null,
        segments: [],
        labels: [],
      }],
    });

    const result = generateIpc2581(input);
    expect(result.xml).toContain('V&amp;CC &lt;3.3&gt;');
  });

  it('sanitizes project name with special characters', () => {
    const input = makeIpc2581Input({ projectName: 'My <Board> "Design" & Layout' });
    const result = generateIpc2581(input);

    // sanitizeFilename removes special chars
    expect(result.xml).not.toContain('<Board>');
    expect(result.xml).toContain('<Ecad name=');
  });

  it('skips wires with fewer than 2 points', () => {
    const input = makeIpc2581Input({
      wires: [
        { id: 1, netId: 1, view: 'pcb', points: [{ x: 5, y: 5 }], layer: 'front', width: 0.25 },
        { id: 2, netId: 1, view: 'pcb', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], layer: 'front', width: 0.25 },
      ],
    });

    const result = generateIpc2581(input);
    const traceMatches = result.xml.match(/<Trace /g);
    // Only the second wire with 2 points should generate a trace
    expect(traceMatches).toHaveLength(1);
  });
});
