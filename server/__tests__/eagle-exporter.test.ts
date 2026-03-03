import { describe, it, expect } from 'vitest';
import {
  generateEagleSchematic,
  generateEagleBoard,
  generateEagleProject,
  type EagleInput,
  type EagleOutput,
} from '../export/eagle-exporter';

// =============================================================================
// Fixtures
// =============================================================================

function makeEagleInput(overrides: Partial<EagleInput> = {}): EagleInput {
  return {
    circuit: { id: 1, name: 'Test Circuit' },
    instances: [],
    nets: [],
    wires: [],
    parts: new Map(),
    boardWidth: 50,
    boardHeight: 40,
    ...overrides,
  };
}

function makePopulatedInput(): EagleInput {
  const parts = new Map<number, {
    meta: Record<string, unknown>;
    connectors: Array<{ id: string; name: string; padType?: string }>;
  }>();

  parts.set(100, {
    meta: { title: 'ATmega328P', value: 'ATmega328P', packageType: 'DIP-28' },
    connectors: [
      { id: 'c1', name: 'VCC' },
      { id: 'c2', name: 'GND' },
      { id: 'c3', name: 'PB0' },
      { id: 'c4', name: 'PB1' },
    ],
  });

  parts.set(200, {
    meta: { title: 'Resistor', value: '10K', packageType: '0805' },
    connectors: [
      { id: 'c1', name: 'PIN1', padType: 'smd' },
      { id: 'c2', name: 'PIN2', padType: 'smd' },
    ],
  });

  return makeEagleInput({
    instances: [
      {
        id: 1,
        referenceDesignator: 'U1',
        partId: 100,
        schematicX: 100,
        schematicY: 200,
        schematicRotation: 0,
        pcbX: 25,
        pcbY: 30,
        pcbRotation: 0,
        pcbSide: 'front',
      },
      {
        id: 2,
        referenceDesignator: 'R1',
        partId: 200,
        schematicX: 300,
        schematicY: 200,
        schematicRotation: 90,
        pcbX: 35,
        pcbY: 25,
        pcbRotation: 90,
        pcbSide: 'front',
      },
    ],
    nets: [
      {
        name: 'VCC',
        netType: 'power',
        segments: [
          { fromInstanceId: 1, fromPin: 'VCC', toInstanceId: 2, toPin: 'PIN1' },
        ],
      },
    ],
    wires: [
      {
        netId: 0,
        view: 'schematic',
        points: [{ x: 100, y: 200 }, { x: 300, y: 200 }],
        layer: 'front',
        width: 0.1524,
      },
      {
        netId: 0,
        view: 'pcb',
        points: [{ x: 25, y: 30 }, { x: 35, y: 25 }],
        layer: 'front',
        width: 0.25,
      },
    ],
    parts,
  });
}

// =============================================================================
// generateEagleProject — unified entry point
// =============================================================================

describe('generateEagleProject', () => {
  it('returns both schematic and board XML strings', () => {
    const input = makeEagleInput();
    const output = generateEagleProject(input);

    expect(output).toHaveProperty('schematic');
    expect(output).toHaveProperty('board');
    expect(typeof output.schematic).toBe('string');
    expect(typeof output.board).toBe('string');
  });

  it('generates valid XML headers for both outputs', () => {
    const input = makePopulatedInput();
    const output = generateEagleProject(input);

    expect(output.schematic).toContain('<?xml version="1.0" encoding="utf-8"?>');
    expect(output.board).toContain('<?xml version="1.0" encoding="utf-8"?>');
    expect(output.schematic).toContain('<!DOCTYPE eagle SYSTEM "eagle.dtd">');
    expect(output.board).toContain('<!DOCTYPE eagle SYSTEM "eagle.dtd">');
  });

  it('includes eagle version attribute', () => {
    const input = makePopulatedInput();
    const output = generateEagleProject(input);

    expect(output.schematic).toContain('version="9.6.2"');
    expect(output.board).toContain('version="9.6.2"');
  });
});

// =============================================================================
// generateEagleSchematic — .sch XML
// =============================================================================

describe('generateEagleSchematic', () => {
  it('includes schematic layer definitions', () => {
    const input = makePopulatedInput();
    const sch = generateEagleSchematic(input);

    expect(sch).toContain('<layers>');
    expect(sch).toContain('name="Nets"');
    expect(sch).toContain('name="Symbols"');
    expect(sch).toContain('name="Names"');
  });

  it('contains a protopulse library with symbols and devicesets', () => {
    const input = makePopulatedInput();
    const sch = generateEagleSchematic(input);

    expect(sch).toContain('<library name="protopulse">');
    expect(sch).toContain('<symbols>');
    expect(sch).toContain('<devicesets>');
    expect(sch).toContain('<packages>');
  });

  it('generates part entries for each instance', () => {
    const input = makePopulatedInput();
    const sch = generateEagleSchematic(input);

    expect(sch).toContain('name="U1"');
    expect(sch).toContain('name="R1"');
    expect(sch).toContain('library="protopulse"');
  });

  it('places instances on the sheet with scaled coordinates', () => {
    const input = makePopulatedInput();
    const sch = generateEagleSchematic(input);

    // U1 at schematicX=100, scale=0.1 -> 10.00
    expect(sch).toContain('<instance part="U1"');
    expect(sch).toContain('x="10.00"');
    expect(sch).toContain('y="20.00"');
  });

  it('applies rotation attribute for non-zero rotations', () => {
    const input = makePopulatedInput();
    const sch = generateEagleSchematic(input);

    // R1 has schematicRotation=90
    expect(sch).toContain('rot="R90"');
  });

  it('generates net definitions with pinrefs', () => {
    const input = makePopulatedInput();
    const sch = generateEagleSchematic(input);

    expect(sch).toContain('<net name="VCC"');
    expect(sch).toContain('<pinref');
    expect(sch).toContain('part="U1"');
    expect(sch).toContain('part="R1"');
  });

  it('includes schematic wire geometry between net pins', () => {
    const input = makePopulatedInput();
    const sch = generateEagleSchematic(input);

    // Schematic wires are scaled by 0.1
    expect(sch).toContain('<wire x1=');
    expect(sch).toContain('layer="91"'); // Nets layer
  });

  it('escapes XML special characters in part names', () => {
    const parts = new Map<number, {
      meta: Record<string, unknown>;
      connectors: Array<{ id: string; name: string; padType?: string }>;
    }>();
    parts.set(1, {
      meta: { title: 'R&D <Special> "Part"', value: '1K' },
      connectors: [{ id: 'c1', name: 'P1' }],
    });

    const input = makeEagleInput({
      instances: [{
        id: 1,
        referenceDesignator: 'U1',
        partId: 1,
        schematicX: 0,
        schematicY: 0,
        schematicRotation: 0,
        pcbX: 0,
        pcbY: 0,
        pcbRotation: 0,
        pcbSide: 'front',
      }],
      parts,
    });

    const sch = generateEagleSchematic(input);
    // Must not have raw < > & in attribute values — sanitizeId replaces
    // special characters with underscores, so the raw title never appears
    expect(sch).not.toContain('R&D <Special>');
    // The sanitized identifier should be present (& < > " replaced with _)
    expect(sch).toContain('R_D__SPECIAL___PART_');
  });
});

// =============================================================================
// generateEagleBoard — .brd XML
// =============================================================================

describe('generateEagleBoard', () => {
  it('includes board layer definitions', () => {
    const input = makePopulatedInput();
    const brd = generateEagleBoard(input);

    expect(brd).toContain('<layers>');
    expect(brd).toContain('name="Top"');
    expect(brd).toContain('name="Bottom"');
    expect(brd).toContain('name="Dimension"');
  });

  it('generates board outline on the Dimension layer', () => {
    const input = makePopulatedInput();
    const brd = generateEagleBoard(input);

    expect(brd).toContain('<plain>');
    expect(brd).toContain(`layer="20"`); // LAYER_DIMENSION = 20
  });

  it('uses default board dimensions when not specified', () => {
    const input = makeEagleInput({
      boardWidth: undefined,
      boardHeight: undefined,
    });
    const brd = generateEagleBoard(input);

    // Default: 50mm x 40mm
    expect(brd).toContain('x2="50"');
    expect(brd).toContain('y2="40"');
  });

  it('places elements with PCB coordinates', () => {
    const input = makePopulatedInput();
    const brd = generateEagleBoard(input);

    expect(brd).toContain('<element name="U1"');
    expect(brd).toContain('x="25.000"');
    expect(brd).toContain('y="30.000"');
  });

  it('mirrors bottom-side components', () => {
    const parts = new Map<number, {
      meta: Record<string, unknown>;
      connectors: Array<{ id: string; name: string; padType?: string }>;
    }>();
    parts.set(1, {
      meta: { title: 'Cap', value: '100nF' },
      connectors: [{ id: 'c1', name: 'P1' }, { id: 'c2', name: 'P2' }],
    });

    const input = makeEagleInput({
      instances: [{
        id: 1,
        referenceDesignator: 'C1',
        partId: 1,
        schematicX: 0,
        schematicY: 0,
        schematicRotation: 0,
        pcbX: 10,
        pcbY: 10,
        pcbRotation: 0,
        pcbSide: 'back',
      }],
      parts,
    });

    const brd = generateEagleBoard(input);
    expect(brd).toContain('mirror="yes"');
  });

  it('warns when an instance has no PCB coordinates', () => {
    const parts = new Map<number, {
      meta: Record<string, unknown>;
      connectors: Array<{ id: string; name: string; padType?: string }>;
    }>();
    parts.set(1, {
      meta: { title: 'IC' },
      connectors: [{ id: 'c1', name: 'P1' }],
    });

    const input = makeEagleInput({
      instances: [{
        id: 1,
        referenceDesignator: 'U1',
        partId: 1,
        schematicX: 50,
        schematicY: 50,
        schematicRotation: 0,
        pcbX: null,
        pcbY: null,
        pcbRotation: null,
        pcbSide: null,
      }],
      parts,
    });

    const brd = generateEagleBoard(input);
    expect(brd).toContain('WARNING');
    expect(brd).toContain('no PCB coordinates');
  });

  it('generates signal definitions for nets', () => {
    const input = makePopulatedInput();
    const brd = generateEagleBoard(input);

    expect(brd).toContain('<signals>');
    expect(brd).toContain('<signal name="VCC">');
  });

  it('includes PCB wire geometry in signals', () => {
    const input = makePopulatedInput();
    const brd = generateEagleBoard(input);

    // PCB wires should appear as <wire> elements within <signal>
    expect(brd).toContain('x1="25.000"');
    expect(brd).toContain('x2="35.000"');
  });

  it('includes packages-only library (no symbols)', () => {
    const input = makePopulatedInput();
    const brd = generateEagleBoard(input);

    expect(brd).toContain('<library name="protopulse">');
    expect(brd).toContain('<packages>');
    // Board files should not include symbols or devicesets
    expect(brd).not.toContain('<symbols>');
    expect(brd).not.toContain('<devicesets>');
  });
});

// =============================================================================
// Edge cases
// =============================================================================

describe('Eagle exporter edge cases', () => {
  it('handles empty input gracefully', () => {
    const input = makeEagleInput();
    const output = generateEagleProject(input);

    expect(output.schematic).toContain('<eagle');
    expect(output.schematic).toContain('</eagle>');
    expect(output.board).toContain('<eagle');
    expect(output.board).toContain('</eagle>');
  });

  it('handles instance with missing part in parts map', () => {
    const input = makeEagleInput({
      instances: [{
        id: 1,
        referenceDesignator: 'U1',
        partId: 999, // not in parts map
        schematicX: 0,
        schematicY: 0,
        schematicRotation: 0,
        pcbX: 0,
        pcbY: 0,
        pcbRotation: 0,
        pcbSide: 'front',
      }],
    });

    // Should not throw
    const output = generateEagleProject(input);
    expect(output.schematic).toContain('WARNING');
    expect(output.board).toContain('WARNING');
  });

  it('deduplicates parts sharing the same partId', () => {
    const parts = new Map<number, {
      meta: Record<string, unknown>;
      connectors: Array<{ id: string; name: string; padType?: string }>;
    }>();
    parts.set(100, {
      meta: { title: 'Resistor', value: '1K' },
      connectors: [{ id: 'c1', name: 'P1' }, { id: 'c2', name: 'P2' }],
    });

    const input = makeEagleInput({
      instances: [
        { id: 1, referenceDesignator: 'R1', partId: 100, schematicX: 0, schematicY: 0, schematicRotation: 0, pcbX: 10, pcbY: 10, pcbRotation: 0, pcbSide: 'front' },
        { id: 2, referenceDesignator: 'R2', partId: 100, schematicX: 50, schematicY: 0, schematicRotation: 0, pcbX: 20, pcbY: 10, pcbRotation: 0, pcbSide: 'front' },
        { id: 3, referenceDesignator: 'R3', partId: 100, schematicX: 100, schematicY: 0, schematicRotation: 0, pcbX: 30, pcbY: 10, pcbRotation: 0, pcbSide: 'front' },
      ],
      parts,
    });

    const sch = generateEagleSchematic(input);
    // Library should have only one symbol for the shared part
    const symbolMatches = sch.match(/<symbol name="SYM_RESISTOR">/g);
    expect(symbolMatches).toHaveLength(1);

    // But all three instances should be placed
    expect(sch).toContain('name="R1"');
    expect(sch).toContain('name="R2"');
    expect(sch).toContain('name="R3"');
  });
});
