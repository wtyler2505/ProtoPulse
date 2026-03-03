import { describe, it, expect } from 'vitest';
import {
  generateGerber,
  generateCopperLayer,
  generateSilkscreenLayer,
  generateSoldermaskLayer,
  generatePasteLayer,
  generateBoardOutline,
  type GerberInput,
  type GerberInstance,
  type GerberConnector,
  type GerberWire,
  type GerberOutput,
} from '../export/gerber-generator';

// =============================================================================
// Fixtures
// =============================================================================

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

function makeInstance(overrides: Partial<GerberInstance> = {}): GerberInstance {
  return {
    id: 1,
    referenceDesignator: 'U1',
    pcbX: 25,
    pcbY: 25,
    pcbRotation: 0,
    pcbSide: 'front',
    connectors: [makeThtConnector()],
    footprint: 'DIP-8',
    bodyWidth: 6,
    bodyHeight: 4,
    ...overrides,
  };
}

function makeWire(overrides: Partial<GerberWire> = {}): GerberWire {
  return {
    layer: 'front',
    points: [{ x: 10, y: 10 }, { x: 20, y: 10 }],
    width: 0.25,
    ...overrides,
  };
}

function makeMinimalInput(overrides: Partial<GerberInput> = {}): GerberInput {
  return {
    boardWidth: 100,
    boardHeight: 80,
    instances: [],
    wires: [],
    ...overrides,
  };
}

// =============================================================================
// generateGerber — main entry point
// =============================================================================

describe('generateGerber', () => {
  it('returns 9 layers and a drill file for an empty board', () => {
    const input = makeMinimalInput();
    const output = generateGerber(input);

    expect(output.layers).toHaveLength(9);
    expect(output.drillFile).toBeDefined();
    expect(typeof output.drillFile).toBe('string');
  });

  it('generates correct layer names and types', () => {
    const input = makeMinimalInput();
    const output = generateGerber(input);

    const names = output.layers.map(l => l.name);
    expect(names).toEqual([
      'F.Cu', 'B.Cu',
      'F.SilkS', 'B.SilkS',
      'F.Mask', 'B.Mask',
      'F.Paste', 'B.Paste',
      'Edge.Cuts',
    ]);

    const types = output.layers.map(l => l.type);
    expect(types).toEqual([
      'copper', 'copper',
      'silkscreen', 'silkscreen',
      'soldermask', 'soldermask',
      'paste', 'paste',
      'outline',
    ]);
  });

  it('generates layers with non-empty content for a populated board', () => {
    const input = makeMinimalInput({
      instances: [
        makeInstance({
          connectors: [
            makeThtConnector({ id: 'p1', name: 'P1', offsetX: -3, offsetY: 0 }),
            makeThtConnector({ id: 'p2', name: 'P2', offsetX: 3, offsetY: 0 }),
          ],
        }),
      ],
      wires: [makeWire()],
    });

    const output = generateGerber(input);

    for (const layer of output.layers) {
      expect(layer.content.length).toBeGreaterThan(0);
    }
    expect(output.drillFile.length).toBeGreaterThan(0);
  });

  it('generates a valid Excellon drill file with THT pads', () => {
    const input = makeMinimalInput({
      instances: [
        makeInstance({
          connectors: [
            makeThtConnector({ id: 'p1', name: 'P1', drill: 0.8, offsetX: -2.54, offsetY: 0 }),
            makeThtConnector({ id: 'p2', name: 'P2', drill: 0.8, offsetX: 2.54, offsetY: 0 }),
          ],
        }),
      ],
    });

    const output = generateGerber(input);
    const drill = output.drillFile;

    expect(drill).toContain('M48');
    expect(drill).toContain('FMAT,2');
    expect(drill).toContain('METRIC,TZ');
    expect(drill).toContain('T1C0.800');
    expect(drill).toContain('%');
    expect(drill).toContain('M30');
  });

  it('generates an empty drill file when only SMD pads are present', () => {
    const input = makeMinimalInput({
      instances: [
        makeInstance({
          footprint: 'SOIC-8',
          connectors: [
            makeSmdConnector({ id: 'p1', name: 'P1', offsetX: -1, offsetY: 0 }),
            makeSmdConnector({ id: 'p2', name: 'P2', offsetX: 1, offsetY: 0 }),
          ],
        }),
      ],
    });

    const output = generateGerber(input);
    const drill = output.drillFile;

    // Should still be valid but contain no drill hits
    expect(drill).toContain('M48');
    expect(drill).toContain('M30');
    expect(drill).not.toContain('T1C');
  });
});

// =============================================================================
// generateCopperLayer
// =============================================================================

describe('generateCopperLayer', () => {
  it('includes RS-274X header with FSLAX36Y36 and MOMM', () => {
    const input = makeMinimalInput();
    const content = generateCopperLayer(input, 'front');

    expect(content).toContain('%FSLAX36Y36*%');
    expect(content).toContain('%MOMM*%');
    expect(content).toContain('Copper');
  });

  it('flashes pads for front-side THT instances on front layer', () => {
    const input = makeMinimalInput({
      instances: [makeInstance({ pcbSide: 'front' })],
    });

    const content = generateCopperLayer(input, 'front');
    // D03 is the flash command
    expect(content).toContain('D03*');
  });

  it('includes THT pads on both front and back copper layers', () => {
    const input = makeMinimalInput({
      instances: [makeInstance({
        pcbSide: 'front',
        connectors: [makeThtConnector()],
      })],
    });

    const frontContent = generateCopperLayer(input, 'front');
    const backContent = generateCopperLayer(input, 'back');

    // THT pads appear on both sides
    expect(frontContent).toContain('D03*');
    expect(backContent).toContain('D03*');
  });

  it('draws traces using D01 (pen down) and D02 (pen up)', () => {
    const input = makeMinimalInput({
      wires: [makeWire({ layer: 'front' })],
    });

    const content = generateCopperLayer(input, 'front');
    expect(content).toContain('D02*');
    expect(content).toContain('D01*');
  });

  it('skips wires on the opposite layer', () => {
    const input = makeMinimalInput({
      wires: [makeWire({ layer: 'back' })],
    });

    const content = generateCopperLayer(input, 'front');
    // Only header/footer, no trace commands
    expect(content).not.toMatch(/D01\*/);
  });

  it('ends with M02 footer', () => {
    const input = makeMinimalInput();
    const content = generateCopperLayer(input, 'front');
    expect(content).toMatch(/M02\*$/);
  });
});

// =============================================================================
// generateSilkscreenLayer
// =============================================================================

describe('generateSilkscreenLayer', () => {
  it('includes Legend file function in the header', () => {
    const input = makeMinimalInput({
      instances: [makeInstance({ pcbSide: 'front' })],
    });

    const content = generateSilkscreenLayer(input, 'front');
    expect(content).toContain('Legend,Top');
  });

  it('draws component body outline for front-side instances', () => {
    const input = makeMinimalInput({
      instances: [makeInstance({ pcbSide: 'front', referenceDesignator: 'U1' })],
    });

    const content = generateSilkscreenLayer(input, 'front');
    // Body outline is drawn as D01 lines forming a rectangle
    const d01Count = (content.match(/D01\*/g) || []).length;
    // At least 4 lines for rectangle + 1 close + pin marker + text strokes
    expect(d01Count).toBeGreaterThanOrEqual(5);
  });

  it('does not include back-side instances on front silkscreen', () => {
    const input = makeMinimalInput({
      instances: [makeInstance({ pcbSide: 'back', referenceDesignator: 'U1' })],
    });

    const content = generateSilkscreenLayer(input, 'front');
    // No drawing commands besides header/footer
    const d01Count = (content.match(/D01\*/g) || []).length;
    expect(d01Count).toBe(0);
  });

  it('renders reference designator text as stroke segments', () => {
    const input = makeMinimalInput({
      instances: [makeInstance({ pcbSide: 'front', referenceDesignator: 'R1' })],
    });

    const content = generateSilkscreenLayer(input, 'front');
    // 'R' and '1' both have strokes in the STROKE_FONT, so we should see many D01/D02 pairs
    const d02Count = (content.match(/D02\*/g) || []).length;
    expect(d02Count).toBeGreaterThanOrEqual(3);
  });

  it('uses silkscreen aperture D10', () => {
    const input = makeMinimalInput({
      instances: [makeInstance()],
    });
    const content = generateSilkscreenLayer(input, 'front');
    expect(content).toContain('D10*');
    expect(content).toContain('%ADD10C,');
  });
});

// =============================================================================
// generateSoldermaskLayer
// =============================================================================

describe('generateSoldermaskLayer', () => {
  it('includes Soldermask file function in the header', () => {
    const input = makeMinimalInput();
    const content = generateSoldermaskLayer(input, 'front');
    expect(content).toContain('Soldermask,Top');
  });

  it('flashes pad openings for THT components', () => {
    const input = makeMinimalInput({
      instances: [makeInstance({
        connectors: [makeThtConnector()],
      })],
    });

    const content = generateSoldermaskLayer(input, 'front');
    expect(content).toContain('D03*');
  });

  it('uses expanded apertures (pad + soldermask clearance)', () => {
    // The soldermask layer adds SOLDERMASK_CLEARANCE (0.1mm) to each side
    // So a 1.6mm pad becomes 1.8mm
    const input = makeMinimalInput({
      instances: [makeInstance({
        connectors: [makeThtConnector({ padWidth: 1.6, padHeight: 1.6, padShape: 'circle' })],
      })],
    });

    const content = generateSoldermaskLayer(input, 'front');
    // 1.6 + 0.1*2 = 1.8, formatted as 1.800
    expect(content).toContain('1.800');
  });

  it('includes LPD polarity directive', () => {
    const input = makeMinimalInput({
      instances: [makeInstance()],
    });
    const content = generateSoldermaskLayer(input, 'front');
    expect(content).toContain('%LPD*%');
  });

  it('generates back soldermask with Bot designation', () => {
    const input = makeMinimalInput();
    const content = generateSoldermaskLayer(input, 'back');
    expect(content).toContain('Soldermask,Bot');
  });
});

// =============================================================================
// generatePasteLayer
// =============================================================================

describe('generatePasteLayer', () => {
  it('includes Paste file function in the header', () => {
    const input = makeMinimalInput();
    const content = generatePasteLayer(input, 'front');
    expect(content).toContain('Paste,Top');
  });

  it('only includes SMD pads (no THT pads)', () => {
    const input = makeMinimalInput({
      instances: [
        makeInstance({
          connectors: [
            makeThtConnector({ id: 'tht1', name: 'THT1', offsetX: -3, offsetY: 0 }),
          ],
        }),
      ],
    });

    const content = generatePasteLayer(input, 'front');
    // No pad flashes should be present for THT-only
    expect(content).not.toContain('D03*');
  });

  it('flashes paste openings for SMD pads', () => {
    const input = makeMinimalInput({
      instances: [
        makeInstance({
          pcbSide: 'front',
          footprint: 'SOIC-8',
          connectors: [
            makeSmdConnector({ id: 'p1', name: 'P1', offsetX: -1, offsetY: 0 }),
          ],
        }),
      ],
    });

    const content = generatePasteLayer(input, 'front');
    expect(content).toContain('D03*');
  });

  it('does not include opposite-side SMD pads', () => {
    const input = makeMinimalInput({
      instances: [
        makeInstance({
          pcbSide: 'back',
          footprint: 'SOIC-8',
          connectors: [
            makeSmdConnector({ id: 'p1', name: 'P1', offsetX: 0, offsetY: 0 }),
          ],
        }),
      ],
    });

    const content = generatePasteLayer(input, 'front');
    expect(content).not.toContain('D03*');
  });

  it('ends with M02 footer', () => {
    const input = makeMinimalInput();
    const content = generatePasteLayer(input, 'front');
    expect(content).toMatch(/M02\*$/);
  });
});

// =============================================================================
// generateBoardOutline
// =============================================================================

describe('generateBoardOutline', () => {
  it('includes Profile file function in the header', () => {
    const input = makeMinimalInput();
    const content = generateBoardOutline(input);
    expect(content).toContain('Profile,NP');
  });

  it('generates a rectangular outline from boardWidth x boardHeight', () => {
    const input = makeMinimalInput({ boardWidth: 50, boardHeight: 30 });
    const content = generateBoardOutline(input);

    // Should have 4 D01 lines (the rectangle edges) + start D02
    const d01Count = (content.match(/D01\*/g) || []).length;
    expect(d01Count).toBe(4);
    expect(content).toContain('D02*');
  });

  it('uses custom outline polygon when provided', () => {
    const input = makeMinimalInput({
      boardOutline: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 30 },
        { x: 25, y: 40 },
        { x: 0, y: 30 },
      ],
    });

    const content = generateBoardOutline(input);
    // 5 points = 4 line draws + 1 close = 5 D01 lines
    const d01Count = (content.match(/D01\*/g) || []).length;
    expect(d01Count).toBe(5);
  });

  it('falls back to rectangle when outline has fewer than 3 points', () => {
    const input = makeMinimalInput({
      boardWidth: 100,
      boardHeight: 80,
      boardOutline: [{ x: 0, y: 0 }, { x: 50, y: 50 }],
    });

    const content = generateBoardOutline(input);
    // Should draw 4-sided rectangle
    const d01Count = (content.match(/D01\*/g) || []).length;
    expect(d01Count).toBe(4);
  });

  it('uses thin outline aperture (0.100mm)', () => {
    const input = makeMinimalInput();
    const content = generateBoardOutline(input);
    expect(content).toContain('%ADD10C,0.100*%');
  });
});
