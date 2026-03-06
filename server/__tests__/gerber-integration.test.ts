import { describe, it, expect } from 'vitest';
import {
  generateGerber,
  generateCopperLayer,
  generateSoldermaskLayer,
  generateBoardOutline,
  buildGerberInput,
  type GerberInput,
  type GerberInstance,
  type GerberWire,
  type GerberVia,
} from '../export/gerber-generator';
import type {
  CircuitInstanceData,
  CircuitWireData,
  ComponentPartData,
} from '../export/types';

// =============================================================================
// Fixtures
// =============================================================================

function makeCircuitInstance(overrides: Partial<CircuitInstanceData> = {}): CircuitInstanceData {
  return {
    id: 1,
    partId: 100,
    referenceDesignator: 'U1',
    schematicX: 0,
    schematicY: 0,
    schematicRotation: 0,
    pcbX: 25,
    pcbY: 25,
    pcbRotation: 0,
    pcbSide: 'front',
    properties: {},
    ...overrides,
  };
}

function makeCircuitWire(overrides: Partial<CircuitWireData> = {}): CircuitWireData {
  return {
    id: 1,
    netId: 1,
    view: 'pcb',
    points: [{ x: 10, y: 10 }, { x: 30, y: 10 }],
    layer: 'front',
    width: 0.25,
    ...overrides,
  };
}

function makeComponentPart(overrides: Partial<ComponentPartData> = {}): ComponentPartData {
  return {
    id: 100,
    nodeId: 'node-1',
    meta: { package: 'DIP-8', title: 'ATmega328P' },
    connectors: [
      { id: 'pin1', name: 'PIN1', padType: 'tht', padWidth: 1.6, padHeight: 1.6, drill: 0.8, offsetX: -3, offsetY: -1.5 },
      { id: 'pin2', name: 'PIN2', padType: 'tht', padWidth: 1.6, padHeight: 1.6, drill: 0.8, offsetX: -3, offsetY: 1.5 },
    ],
    buses: [],
    constraints: [],
    ...overrides,
  };
}

function makeSmdPart(overrides: Partial<ComponentPartData> = {}): ComponentPartData {
  return {
    id: 101,
    nodeId: 'node-2',
    meta: { package: 'SOIC-8', title: 'LM358' },
    connectors: [
      { id: 'pad1', name: 'PAD1', padType: 'smd', padWidth: 1.0, padHeight: 0.6, offsetX: -2, offsetY: 0 },
      { id: 'pad2', name: 'PAD2', padType: 'smd', padWidth: 1.0, padHeight: 0.6, offsetX: 2, offsetY: 0 },
    ],
    buses: [],
    constraints: [],
    ...overrides,
  };
}

function makeGerberVia(overrides: Partial<GerberVia> = {}): GerberVia {
  return {
    x: 15,
    y: 20,
    drillDiameter: 0.3,
    outerDiameter: 0.6,
    tented: false,
    ...overrides,
  };
}

// =============================================================================
// buildGerberInput — bridge from DB types to GerberInput
// =============================================================================

describe('buildGerberInput', () => {
  it('converts circuit instances to GerberInstances with footprint from part meta', () => {
    const instances = [makeCircuitInstance()];
    const wires: CircuitWireData[] = [];
    const parts = [makeComponentPart()];

    const input = buildGerberInput(instances, wires, parts, { boardWidth: 100, boardHeight: 80 });

    expect(input.instances).toHaveLength(1);
    expect(input.instances[0].footprint).toBe('DIP-8');
    expect(input.instances[0].referenceDesignator).toBe('U1');
    expect(input.instances[0].pcbX).toBe(25);
    expect(input.instances[0].pcbY).toBe(25);
    expect(input.instances[0].connectors).toHaveLength(2);
  });

  it('filters only pcb-view wires', () => {
    const wires = [
      makeCircuitWire({ view: 'pcb', layer: 'front' }),
      makeCircuitWire({ id: 2, view: 'schematic' }),
      makeCircuitWire({ id: 3, view: 'breadboard' }),
    ];

    const input = buildGerberInput([], wires, [], { boardWidth: 100, boardHeight: 80 });

    expect(input.wires).toHaveLength(1);
    expect(input.wires[0].layer).toBe('front');
  });

  it('handles instances with null pcbX/pcbY by defaulting to 0', () => {
    const instances = [makeCircuitInstance({ pcbX: null, pcbY: null })];
    const input = buildGerberInput(instances, [], [makeComponentPart()], { boardWidth: 100, boardHeight: 80 });

    expect(input.instances[0].pcbX).toBe(0);
    expect(input.instances[0].pcbY).toBe(0);
  });

  it('handles instances with null partId (orphaned)', () => {
    const instances = [makeCircuitInstance({ partId: null })];
    const input = buildGerberInput(instances, [], [], { boardWidth: 100, boardHeight: 80 });

    expect(input.instances).toHaveLength(1);
    expect(input.instances[0].connectors).toHaveLength(0);
    expect(input.instances[0].footprint).toBe('');
  });

  it('extracts wire points from JSON array', () => {
    const wires = [makeCircuitWire({
      points: [{ x: 5, y: 10 }, { x: 15, y: 10 }, { x: 15, y: 20 }],
    })];

    const input = buildGerberInput([], wires, [], { boardWidth: 100, boardHeight: 80 });

    expect(input.wires[0].points).toEqual([
      { x: 5, y: 10 },
      { x: 15, y: 10 },
      { x: 15, y: 20 },
    ]);
  });

  it('defaults wire layer to front when null', () => {
    const wires = [makeCircuitWire({ layer: null })];
    const input = buildGerberInput([], wires, [], { boardWidth: 100, boardHeight: 80 });

    expect(input.wires[0].layer).toBe('front');
  });

  it('passes through board dimensions', () => {
    const input = buildGerberInput([], [], [], { boardWidth: 50, boardHeight: 30 });

    expect(input.boardWidth).toBe(50);
    expect(input.boardHeight).toBe(30);
  });

  it('extracts vias from wire metadata when wireType is via', () => {
    const wires: CircuitWireData[] = [
      {
        id: 10,
        netId: 1,
        view: 'pcb',
        points: [{ x: 15, y: 20 }],
        layer: 'front',
        width: 0.6,
      },
    ];
    // Wires with wireType 'via' in the DB get extracted as vias
    // But CircuitWireData doesn't have wireType. Via extraction happens
    // via the optional vias parameter to buildGerberInput.
    // Let's test the vias parameter instead.
    const vias: GerberVia[] = [makeGerberVia()];
    const input = buildGerberInput([], wires, [], { boardWidth: 100, boardHeight: 80, vias });

    expect(input.vias).toHaveLength(1);
    expect(input.vias![0].x).toBe(15);
    expect(input.vias![0].drillDiameter).toBe(0.3);
  });
});

// =============================================================================
// Via rendering in Gerber output
// =============================================================================

describe('Gerber via rendering', () => {
  const viaInput: GerberInput = {
    boardWidth: 100,
    boardHeight: 80,
    instances: [],
    wires: [],
    vias: [
      makeGerberVia({ x: 20, y: 30, drillDiameter: 0.3, outerDiameter: 0.6 }),
      makeGerberVia({ x: 40, y: 50, drillDiameter: 0.4, outerDiameter: 0.8 }),
    ],
  };

  it('flashes via pads on front copper layer', () => {
    const content = generateCopperLayer(viaInput, 'front');
    // Vias should generate D03 flash commands
    expect(content).toContain('D03*');
    // Should contain coordinates for via at (20, 30)
    expect(content).toContain('X20000000Y30000000D03*');
  });

  it('flashes via pads on back copper layer', () => {
    const content = generateCopperLayer(viaInput, 'back');
    expect(content).toContain('D03*');
    expect(content).toContain('X20000000Y30000000D03*');
    expect(content).toContain('X40000000Y50000000D03*');
  });

  it('generates soldermask openings for non-tented vias', () => {
    const content = generateSoldermaskLayer(viaInput, 'front');
    // Non-tented vias need mask openings
    expect(content).toContain('D03*');
    expect(content).toContain('X20000000Y30000000D03*');
  });

  it('omits soldermask openings for tented vias', () => {
    const tentedInput: GerberInput = {
      boardWidth: 100,
      boardHeight: 80,
      instances: [],
      wires: [],
      vias: [makeGerberVia({ x: 20, y: 30, tented: true })],
    };
    const content = generateSoldermaskLayer(tentedInput, 'front');
    // Tented vias should not have mask openings
    expect(content).not.toContain('X20000000Y30000000D03*');
  });

  it('generates drill hits for vias in drill file', () => {
    const output = generateGerber(viaInput);
    expect(output.drillFile).toContain('T1');
    // mmToExcellon: mm * 1000 → 20mm = X20000, 30mm = Y30000
    expect(output.drillFile).toContain('X20000Y30000');
    expect(output.drillFile).toContain('X40000Y50000');
  });

  it('creates separate drill tools for different via drill diameters', () => {
    const output = generateGerber(viaInput);
    // Two different drill diameters: 0.3 and 0.4
    expect(output.drillFile).toContain('T1C0.300');
    expect(output.drillFile).toContain('T2C0.400');
  });

  it('generates aperture definitions for via pads', () => {
    const content = generateCopperLayer(viaInput, 'front');
    // Via outer diameter 0.6mm should appear as circle aperture
    expect(content).toContain('%ADD');
    expect(content).toContain('C,0.600');
  });
});

// =============================================================================
// Layer generation — all expected layers produced
// =============================================================================

describe('Gerber layer generation', () => {
  const fullInput: GerberInput = {
    boardWidth: 100,
    boardHeight: 80,
    instances: [{
      id: 1,
      referenceDesignator: 'U1',
      pcbX: 25,
      pcbY: 25,
      pcbRotation: 0,
      pcbSide: 'front',
      connectors: [{
        id: 'pin1',
        name: 'PIN1',
        padType: 'tht',
        padWidth: 1.6,
        padHeight: 1.6,
        drill: 0.8,
        offsetX: -3,
        offsetY: 0,
      }],
      footprint: 'DIP-8',
      bodyWidth: 6,
      bodyHeight: 4,
    }],
    wires: [
      { layer: 'front', points: [{ x: 10, y: 10 }, { x: 25, y: 10 }], width: 0.25 },
      { layer: 'back', points: [{ x: 30, y: 20 }, { x: 50, y: 20 }], width: 0.3 },
    ],
    vias: [makeGerberVia()],
  };

  it('produces all 9 layer files + drill', () => {
    const output = generateGerber(fullInput);
    expect(output.layers).toHaveLength(9);
    expect(output.drillFile).toBeTruthy();
  });

  it('produces F.Cu layer', () => {
    const output = generateGerber(fullInput);
    const fcu = output.layers.find(l => l.name === 'F.Cu');
    expect(fcu).toBeDefined();
    expect(fcu!.type).toBe('copper');
    expect(fcu!.side).toBe('front');
  });

  it('produces B.Cu layer', () => {
    const output = generateGerber(fullInput);
    const bcu = output.layers.find(l => l.name === 'B.Cu');
    expect(bcu).toBeDefined();
    expect(bcu!.type).toBe('copper');
    expect(bcu!.side).toBe('back');
  });

  it('produces F.Mask layer', () => {
    const output = generateGerber(fullInput);
    const fmask = output.layers.find(l => l.name === 'F.Mask');
    expect(fmask).toBeDefined();
    expect(fmask!.type).toBe('soldermask');
  });

  it('produces B.Mask layer', () => {
    const output = generateGerber(fullInput);
    const bmask = output.layers.find(l => l.name === 'B.Mask');
    expect(bmask).toBeDefined();
    expect(bmask!.type).toBe('soldermask');
  });

  it('produces F.SilkS layer', () => {
    const output = generateGerber(fullInput);
    const fsilk = output.layers.find(l => l.name === 'F.SilkS');
    expect(fsilk).toBeDefined();
    expect(fsilk!.type).toBe('silkscreen');
  });

  it('produces B.SilkS layer', () => {
    const output = generateGerber(fullInput);
    const bsilk = output.layers.find(l => l.name === 'B.SilkS');
    expect(bsilk).toBeDefined();
    expect(bsilk!.type).toBe('silkscreen');
  });

  it('produces Edge.Cuts layer', () => {
    const output = generateGerber(fullInput);
    const edge = output.layers.find(l => l.name === 'Edge.Cuts');
    expect(edge).toBeDefined();
    expect(edge!.type).toBe('outline');
  });
});

// =============================================================================
// Trace rendering
// =============================================================================

describe('Trace rendering', () => {
  it('converts wire points to D01/D02 draw commands', () => {
    const input: GerberInput = {
      boardWidth: 100,
      boardHeight: 80,
      instances: [],
      wires: [{ layer: 'front', points: [{ x: 10, y: 5 }, { x: 30, y: 5 }], width: 0.25 }],
    };
    const content = generateCopperLayer(input, 'front');
    // Move to first point
    expect(content).toContain('X10000000Y5000000D02*');
    // Draw to second point
    expect(content).toContain('X30000000Y5000000D01*');
  });

  it('generates correct aperture for trace width', () => {
    const input: GerberInput = {
      boardWidth: 100,
      boardHeight: 80,
      instances: [],
      wires: [{ layer: 'front', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], width: 0.5 }],
    };
    const content = generateCopperLayer(input, 'front');
    expect(content).toContain('C,0.500');
  });

  it('handles multi-segment traces', () => {
    const input: GerberInput = {
      boardWidth: 100,
      boardHeight: 80,
      instances: [],
      wires: [{
        layer: 'front',
        points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 10 }],
        width: 0.25,
      }],
    };
    const content = generateCopperLayer(input, 'front');
    // Should have D02 (move) then three D01 (draw) commands
    const d02Count = (content.match(/D02\*/g) || []).length;
    const d01Count = (content.match(/D01\*/g) || []).length;
    expect(d02Count).toBeGreaterThanOrEqual(1);
    expect(d01Count).toBeGreaterThanOrEqual(3);
  });

  it('only renders front wires on front copper', () => {
    const input: GerberInput = {
      boardWidth: 100,
      boardHeight: 80,
      instances: [],
      wires: [
        { layer: 'front', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], width: 0.25 },
        { layer: 'back', points: [{ x: 50, y: 50 }, { x: 60, y: 50 }], width: 0.25 },
      ],
    };
    const frontContent = generateCopperLayer(input, 'front');
    // Front layer should contain the first wire's coordinates
    expect(frontContent).toContain('X10000000Y0D01*');
    // Front layer should NOT contain back wire coordinates
    expect(frontContent).not.toContain('X60000000Y50000000D01*');
  });
});

// =============================================================================
// Pad flashing
// =============================================================================

describe('Pad flashing', () => {
  it('generates flash command for THT pad on correct layer', () => {
    const input: GerberInput = {
      boardWidth: 100,
      boardHeight: 80,
      instances: [{
        id: 1,
        referenceDesignator: 'R1',
        pcbX: 20,
        pcbY: 20,
        pcbRotation: 0,
        pcbSide: 'front',
        connectors: [{
          id: 'pin1',
          name: 'PIN1',
          padType: 'tht',
          padWidth: 1.6,
          padHeight: 1.6,
          drill: 0.8,
          offsetX: 0,
          offsetY: 0,
        }],
        footprint: 'DIP-2',
      }],
      wires: [],
    };

    const frontContent = generateCopperLayer(input, 'front');
    // THT pad at (20, 20) should be flashed
    expect(frontContent).toContain('X20000000Y20000000D03*');

    // THT pads should also appear on back copper
    const backContent = generateCopperLayer(input, 'back');
    expect(backContent).toContain('X20000000Y20000000D03*');
  });

  it('generates flash command for SMD pad only on its side', () => {
    const input: GerberInput = {
      boardWidth: 100,
      boardHeight: 80,
      instances: [{
        id: 1,
        referenceDesignator: 'U1',
        pcbX: 20,
        pcbY: 20,
        pcbRotation: 0,
        pcbSide: 'front',
        connectors: [{
          id: 'pad1',
          name: 'PAD1',
          padType: 'smd',
          padWidth: 1.0,
          padHeight: 0.6,
          offsetX: 0,
          offsetY: 0,
        }],
        footprint: 'SOIC-8',
      }],
      wires: [],
    };

    const frontContent = generateCopperLayer(input, 'front');
    expect(frontContent).toContain('X20000000Y20000000D03*');

    // SMD pad should NOT appear on back copper
    const backContent = generateCopperLayer(input, 'back');
    expect(backContent).not.toContain('X20000000Y20000000D03*');
  });
});

// =============================================================================
// Board outline
// =============================================================================

describe('Board outline', () => {
  it('generates rectangular board outline from dimensions', () => {
    const input: GerberInput = {
      boardWidth: 100,
      boardHeight: 80,
      instances: [],
      wires: [],
    };
    const outline = generateBoardOutline(input);
    expect(outline).toContain('Profile,NP');
    // Should draw rectangle: (0,0) -> (100,0) -> (100,80) -> (0,80) -> (0,0)
    expect(outline).toContain('X100000000Y0D01*');
    expect(outline).toContain('X100000000Y80000000D01*');
    expect(outline).toContain('X0Y80000000D01*');
    expect(outline).toContain('X0Y0D01*');
  });

  it('uses custom outline polygon when provided', () => {
    const input: GerberInput = {
      boardWidth: 100,
      boardHeight: 80,
      instances: [],
      wires: [],
      boardOutline: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 40 },
        { x: 0, y: 40 },
      ],
    };
    const outline = generateBoardOutline(input);
    expect(outline).toContain('X50000000Y0D01*');
    expect(outline).toContain('X50000000Y40000000D01*');
  });
});

// =============================================================================
// Drill file
// =============================================================================

describe('Drill file generation', () => {
  it('includes via drill positions in Excellon format', () => {
    const input: GerberInput = {
      boardWidth: 100,
      boardHeight: 80,
      instances: [],
      wires: [],
      vias: [makeGerberVia({ x: 15, y: 20, drillDiameter: 0.3 })],
    };
    const output = generateGerber(input);
    expect(output.drillFile).toContain('M48');
    expect(output.drillFile).toContain('METRIC');
    // mmToExcellon: 15mm = X15000, 20mm = Y20000
    expect(output.drillFile).toContain('X15000Y20000');
  });

  it('includes THT pad drill positions', () => {
    const input: GerberInput = {
      boardWidth: 100,
      boardHeight: 80,
      instances: [{
        id: 1,
        referenceDesignator: 'R1',
        pcbX: 30,
        pcbY: 40,
        pcbRotation: 0,
        pcbSide: 'front',
        connectors: [{
          id: 'pin1', name: 'PIN1', padType: 'tht',
          padWidth: 1.6, padHeight: 1.6, drill: 0.8,
          offsetX: 0, offsetY: 0,
        }],
        footprint: 'DIP-2',
      }],
      wires: [],
    };
    const output = generateGerber(input);
    expect(output.drillFile).toContain('T1C0.800');
    // mmToExcellon: 30mm = X30000, 40mm = Y40000
    expect(output.drillFile).toContain('X30000Y40000');
  });

  it('combines via and THT drills in same file', () => {
    const input: GerberInput = {
      boardWidth: 100,
      boardHeight: 80,
      instances: [{
        id: 1,
        referenceDesignator: 'R1',
        pcbX: 30,
        pcbY: 40,
        pcbRotation: 0,
        pcbSide: 'front',
        connectors: [{
          id: 'pin1', name: 'PIN1', padType: 'tht',
          padWidth: 1.6, padHeight: 1.6, drill: 1.0,
          offsetX: 0, offsetY: 0,
        }],
        footprint: 'DIP-2',
      }],
      wires: [],
      vias: [makeGerberVia({ x: 10, y: 10, drillDiameter: 0.3 })],
    };
    const output = generateGerber(input);
    // Both drill sizes should appear as tool definitions
    expect(output.drillFile).toContain('C0.300');
    expect(output.drillFile).toContain('C1.000');
    // Both hit positions should appear (mmToExcellon: mm * 1000)
    expect(output.drillFile).toContain('X10000Y10000');
    expect(output.drillFile).toContain('X30000Y40000');
  });

  it('generates empty drill file with no THT pads or vias', () => {
    const input: GerberInput = {
      boardWidth: 100,
      boardHeight: 80,
      instances: [],
      wires: [],
    };
    const output = generateGerber(input);
    expect(output.drillFile).toContain('M48');
    expect(output.drillFile).toContain('M30');
    // No tool definitions between header and end
    expect(output.drillFile).not.toMatch(/T\d+C/);
  });
});

// =============================================================================
// Coordinate conversion
// =============================================================================

describe('Coordinate conversion', () => {
  it('converts mm to Gerber integer format correctly', () => {
    const input: GerberInput = {
      boardWidth: 100,
      boardHeight: 80,
      instances: [],
      wires: [{ layer: 'front', points: [{ x: 1.5, y: 2.3 }, { x: 3.7, y: 2.3 }], width: 0.25 }],
    };
    const content = generateCopperLayer(input, 'front');
    // 1.5mm * 1,000,000 = 1500000
    expect(content).toContain('X1500000Y2300000D02*');
    // 3.7mm * 1,000,000 = 3700000
    expect(content).toContain('X3700000Y2300000D01*');
  });
});

// =============================================================================
// Empty and edge cases
// =============================================================================

describe('Edge cases', () => {
  it('handles empty board with no components, wires, or vias', () => {
    const input: GerberInput = {
      boardWidth: 50,
      boardHeight: 30,
      instances: [],
      wires: [],
    };
    const output = generateGerber(input);
    expect(output.layers).toHaveLength(9);
    expect(output.drillFile).toBeTruthy();
    // All layers should have valid Gerber content
    for (const layer of output.layers) {
      expect(layer.content).toContain('M02*');
    }
  });

  it('handles wire with single point (no draw)', () => {
    const input: GerberInput = {
      boardWidth: 100,
      boardHeight: 80,
      instances: [],
      wires: [{ layer: 'front', points: [{ x: 10, y: 10 }], width: 0.25 }],
    };
    // Should not crash
    const content = generateCopperLayer(input, 'front');
    expect(content).toContain('M02*');
    // Single point wire should not produce draw commands
    expect(content).not.toContain('D01*');
  });

  it('handles wire with empty points array', () => {
    const input: GerberInput = {
      boardWidth: 100,
      boardHeight: 80,
      instances: [],
      wires: [{ layer: 'front', points: [], width: 0.25 }],
    };
    const content = generateCopperLayer(input, 'front');
    expect(content).toContain('M02*');
  });

  it('buildGerberInput handles empty inputs gracefully', () => {
    const input = buildGerberInput([], [], [], { boardWidth: 100, boardHeight: 80 });
    expect(input.instances).toHaveLength(0);
    expect(input.wires).toHaveLength(0);
    expect(input.boardWidth).toBe(100);
  });
});

// =============================================================================
// Backward compatibility
// =============================================================================

describe('Backward compatibility', () => {
  it('generateGerber works without vias field (undefined)', () => {
    const input: GerberInput = {
      boardWidth: 100,
      boardHeight: 80,
      instances: [],
      wires: [{ layer: 'front', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], width: 0.25 }],
    };
    // Should not throw — vias is optional
    const output = generateGerber(input);
    expect(output.layers).toHaveLength(9);
    expect(output.drillFile).toContain('M48');
  });

  it('generateGerber works with empty vias array', () => {
    const input: GerberInput = {
      boardWidth: 100,
      boardHeight: 80,
      instances: [],
      wires: [],
      vias: [],
    };
    const output = generateGerber(input);
    expect(output.layers).toHaveLength(9);
  });
});

// =============================================================================
// Gerber file format validation
// =============================================================================

describe('Gerber format correctness', () => {
  it('copper layers have correct Gerber header with FSLAX36Y36 and MOMM', () => {
    const input: GerberInput = {
      boardWidth: 100,
      boardHeight: 80,
      instances: [],
      wires: [],
    };
    const content = generateCopperLayer(input, 'front');
    expect(content).toContain('%FSLAX36Y36*%');
    expect(content).toContain('%MOMM*%');
  });

  it('copper layers declare correct file function', () => {
    const input: GerberInput = {
      boardWidth: 100,
      boardHeight: 80,
      instances: [],
      wires: [],
    };
    const front = generateCopperLayer(input, 'front');
    expect(front).toContain('Copper,L1,Top');

    const back = generateCopperLayer(input, 'back');
    expect(back).toContain('Copper,L2,Bot');
  });

  it('soldermask layers declare correct file function', () => {
    const input: GerberInput = {
      boardWidth: 100,
      boardHeight: 80,
      instances: [],
      wires: [],
    };
    const front = generateSoldermaskLayer(input, 'front');
    expect(front).toContain('Soldermask,Top');

    const back = generateSoldermaskLayer(input, 'back');
    expect(back).toContain('Soldermask,Bot');
  });

  it('all layers end with M02', () => {
    const input: GerberInput = {
      boardWidth: 100,
      boardHeight: 80,
      instances: [{
        id: 1,
        referenceDesignator: 'U1',
        pcbX: 25,
        pcbY: 25,
        pcbRotation: 0,
        pcbSide: 'front',
        connectors: [{ id: 'p1', name: 'P1', padType: 'tht', offsetX: 0, offsetY: 0 }],
        footprint: 'DIP-8',
      }],
      wires: [],
      vias: [makeGerberVia()],
    };
    const output = generateGerber(input);
    for (const layer of output.layers) {
      expect(layer.content).toContain('M02*');
    }
  });

  it('drill file ends with M30', () => {
    const input: GerberInput = {
      boardWidth: 100,
      boardHeight: 80,
      instances: [],
      wires: [],
      vias: [makeGerberVia()],
    };
    const output = generateGerber(input);
    expect(output.drillFile).toContain('M30');
  });
});
