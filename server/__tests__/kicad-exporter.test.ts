import { describe, it, expect } from 'vitest';
import {
  generateKicadSchematic,
  generateKicadPcb,
  generateKicadProjectFile,
  generateKicadProject,
  type KicadInput,
  type KicadOutput,
} from '../export/kicad-exporter';

// =============================================================================
// Fixtures
// =============================================================================

function makeKicadInput(overrides: Partial<KicadInput> = {}): KicadInput {
  return {
    circuit: { id: 1, name: 'Test Circuit' },
    instances: [],
    nets: [],
    wires: [],
    parts: new Map(),
    boardWidth: 100,
    boardHeight: 80,
    ...overrides,
  };
}

function makePopulatedInput(): KicadInput {
  const parts = new Map<number, {
    meta: Record<string, unknown>;
    connectors: Array<{ id: string; name: string; padType?: string }>;
  }>();

  parts.set(10, {
    meta: { title: 'ATmega328P', value: 'ATmega328P', footprint: 'Package_DIP:DIP-28_W7.62mm' },
    connectors: [
      { id: 'c1', name: 'VCC' },
      { id: 'c2', name: 'GND' },
      { id: 'c3', name: 'PB0' },
    ],
  });

  parts.set(20, {
    meta: { title: 'Resistor', value: '10K', footprint: 'Resistor_SMD:R_0805' },
    connectors: [
      { id: 'c1', name: 'PIN1', padType: 'smd' },
      { id: 'c2', name: 'PIN2', padType: 'smd' },
    ],
  });

  return makeKicadInput({
    instances: [
      {
        id: 1,
        referenceDesignator: 'U1',
        partId: 10,
        schematicX: 100,
        schematicY: 200,
        schematicRotation: 0,
        pcbX: 50,
        pcbY: 40,
        pcbRotation: 0,
        pcbSide: 'front',
      },
      {
        id: 2,
        referenceDesignator: 'R1',
        partId: 20,
        schematicX: 300,
        schematicY: 200,
        schematicRotation: 90,
        pcbX: 70,
        pcbY: 40,
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
      {
        name: 'GND',
        netType: 'ground',
        segments: [
          { fromInstanceId: 1, fromPin: 'GND', toInstanceId: 2, toPin: 'PIN2' },
        ],
      },
    ],
    wires: [
      {
        netId: 0,
        view: 'pcb',
        points: [{ x: 50, y: 40 }, { x: 70, y: 40 }],
        layer: 'front',
        width: 0.25,
      },
    ],
    parts,
  });
}

// =============================================================================
// generateKicadProject — unified entry point
// =============================================================================

describe('generateKicadProject', () => {
  it('returns schematic, pcb, and project strings', () => {
    const input = makeKicadInput();
    const output = generateKicadProject(input);

    expect(output).toHaveProperty('schematic');
    expect(output).toHaveProperty('pcb');
    expect(output).toHaveProperty('project');
    expect(typeof output.schematic).toBe('string');
    expect(typeof output.pcb).toBe('string');
    expect(typeof output.project).toBe('string');
  });

  it('generates non-empty content for populated input', () => {
    const input = makePopulatedInput();
    const output = generateKicadProject(input);

    expect(output.schematic.length).toBeGreaterThan(100);
    expect(output.pcb.length).toBeGreaterThan(100);
    expect(output.project.length).toBeGreaterThan(10);
  });
});

// =============================================================================
// generateKicadSchematic — .kicad_sch
// =============================================================================

describe('generateKicadSchematic', () => {
  it('starts with kicad_sch S-expression root', () => {
    const input = makeKicadInput();
    const sch = generateKicadSchematic(input);
    expect(sch).toMatch(/^\(kicad_sch/);
  });

  it('includes correct version and generator', () => {
    const input = makeKicadInput();
    const sch = generateKicadSchematic(input);

    expect(sch).toContain('(version 20230121)');
    expect(sch).toContain('(generator "ProtoPulse")');
  });

  it('includes paper size', () => {
    const input = makeKicadInput();
    const sch = generateKicadSchematic(input);
    expect(sch).toContain('(paper "A3")');
  });

  it('generates lib_symbols for all unique parts', () => {
    const input = makePopulatedInput();
    const sch = generateKicadSchematic(input);

    expect(sch).toContain('(lib_symbols');
    // Should contain symbol entries for both ATmega328P and Resistor
    // Source uses "PP:" prefix, not "protopulse:"
    expect(sch).toContain('(symbol "PP:');
  });

  it('places symbol instances with scaled coordinates', () => {
    const input = makePopulatedInput();
    const sch = generateKicadSchematic(input);

    // U1 schematicX=100, scale=0.1 -> 10
    // Source uses "PP:" prefix, not "protopulse:"
    expect(sch).toContain('(symbol (lib_id "PP:');
    expect(sch).toContain('(at 10');
  });

  it('includes reference designator properties', () => {
    const input = makePopulatedInput();
    const sch = generateKicadSchematic(input);

    expect(sch).toContain('"Reference" "U1"');
    expect(sch).toContain('"Reference" "R1"');
  });

  it('includes UUIDs for schematic elements', () => {
    const input = makePopulatedInput();
    const sch = generateKicadSchematic(input);

    // UUIDs are formatted as 8-4-4-4-12 hex with dashes (standard UUID format)
    const uuidPattern = /\(uuid "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"\)/;
    expect(sch).toMatch(uuidPattern);
  });

  it('generates wires for net connections', () => {
    // Add a schematic-view wire to the input (makePopulatedInput only has PCB wires)
    const input = makePopulatedInput();
    input.wires.push({
      netId: 0,
      view: 'schematic',
      points: [{ x: 100, y: 200 }, { x: 300, y: 200 }],
      layer: 'front',
      width: 0.1,
    });
    const sch = generateKicadSchematic(input);

    expect(sch).toContain('(wire');
    expect(sch).toContain('(pts');
  });

  it('handles empty input without crashing', () => {
    const input = makeKicadInput();
    const sch = generateKicadSchematic(input);
    expect(sch).toContain('(kicad_sch');
    expect(sch).toContain('(lib_symbols');
  });
});

// =============================================================================
// generateKicadPcb — .kicad_pcb
// =============================================================================

describe('generateKicadPcb', () => {
  it('starts with kicad_pcb S-expression root', () => {
    const input = makeKicadInput();
    const pcb = generateKicadPcb(input);
    expect(pcb).toMatch(/^\(kicad_pcb/);
  });

  it('includes correct version and generator', () => {
    const input = makeKicadInput();
    const pcb = generateKicadPcb(input);

    expect(pcb).toContain('(version 20221018)');
    expect(pcb).toContain('(generator "ProtoPulse")');
  });

  it('generates board outline on Edge.Cuts layer', () => {
    const input = makeKicadInput({ boardWidth: 100, boardHeight: 80 });
    const pcb = generateKicadPcb(input);

    expect(pcb).toContain('"Edge.Cuts"');
    // Board outline should use the specified dimensions
    expect(pcb).toContain('100');
    expect(pcb).toContain('80');
  });

  it('places footprints with PCB coordinates', () => {
    const input = makePopulatedInput();
    const pcb = generateKicadPcb(input);

    // Source uses "PP:" prefix, not "protopulse:"
    expect(pcb).toContain('(footprint "PP:');
    // U1 pcbX=50, pcbY=40
    expect(pcb).toContain('(at 50');
  });

  it('generates pads within footprints', () => {
    const input = makePopulatedInput();
    const pcb = generateKicadPcb(input);

    expect(pcb).toContain('(pad');
    expect(pcb).toContain('thru_hole'); // THT pads from ATmega328P
  });

  it('includes SMD pads for SMD parts', () => {
    const input = makePopulatedInput();
    const pcb = generateKicadPcb(input);
    expect(pcb).toContain('smd');
  });

  it('generates net definitions', () => {
    const input = makePopulatedInput();
    const pcb = generateKicadPcb(input);

    expect(pcb).toContain('(net');
    expect(pcb).toContain('"VCC"');
    expect(pcb).toContain('"GND"');
  });

  it('includes PCB traces as segments', () => {
    const input = makePopulatedInput();
    const pcb = generateKicadPcb(input);

    expect(pcb).toContain('(segment');
    expect(pcb).toContain('(start');
    expect(pcb).toContain('(end');
  });

  it('includes layer definitions', () => {
    const input = makeKicadInput();
    const pcb = generateKicadPcb(input);

    expect(pcb).toContain('(layers');
    expect(pcb).toContain('"F.Cu"');
    expect(pcb).toContain('"B.Cu"');
    expect(pcb).toContain('"F.SilkS"');
  });
});

// =============================================================================
// generateKicadProjectFile — .kicad_pro
// =============================================================================

describe('generateKicadProjectFile', () => {
  it('returns valid JSON', () => {
    const input = makeKicadInput();
    const project = generateKicadProjectFile(input);

    expect(() => JSON.parse(project)).not.toThrow();
  });

  it('includes board design settings', () => {
    const input = makeKicadInput();
    const project = generateKicadProjectFile(input);
    const parsed = JSON.parse(project);

    expect(parsed).toHaveProperty('board');
    expect(parsed.board).toHaveProperty('design_settings');
  });

  it('contains the project meta info', () => {
    const input = makeKicadInput();
    const project = generateKicadProjectFile(input);
    const parsed = JSON.parse(project);

    expect(parsed).toHaveProperty('meta');
  });
});

// =============================================================================
// Edge cases
// =============================================================================

describe('KiCad exporter edge cases', () => {
  it('handles instance with missing part in parts map', () => {
    const input = makeKicadInput({
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
    expect(() => generateKicadProject(input)).not.toThrow();
  });

  it('handles instance with null PCB coordinates', () => {
    const parts = new Map<number, {
      meta: Record<string, unknown>;
      connectors: Array<{ id: string; name: string; padType?: string }>;
    }>();
    parts.set(1, {
      meta: { title: 'IC' },
      connectors: [{ id: 'c1', name: 'P1' }],
    });

    const input = makeKicadInput({
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

    // Should not throw — should place at default position
    expect(() => generateKicadProject(input)).not.toThrow();
  });

  it('generates valid UUIDs in output', () => {
    const input = makePopulatedInput();
    const output = generateKicadProject(input);

    // UUIDs should be valid UUIDv4 format (8-4-4-4-12 hex pattern)
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    const pcbUuids = output.pcb.match(uuidRegex) ?? [];
    const schematicUuids = output.schematic.match(uuidRegex) ?? [];

    // Both outputs should contain UUIDs
    expect(pcbUuids.length).toBeGreaterThan(0);
    expect(schematicUuids.length).toBeGreaterThan(0);

    // Every matched UUID should be valid format (not the old FNV-1a hash)
    for (const uuid of [...pcbUuids, ...schematicUuids]) {
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    }
  });

  it('handles parts with no connectors', () => {
    const parts = new Map<number, {
      meta: Record<string, unknown>;
      connectors: Array<{ id: string; name: string; padType?: string }>;
    }>();
    parts.set(1, {
      meta: { title: 'Test Point' },
      connectors: [],
    });

    const input = makeKicadInput({
      instances: [{
        id: 1,
        referenceDesignator: 'TP1',
        partId: 1,
        schematicX: 0,
        schematicY: 0,
        schematicRotation: 0,
        pcbX: 10,
        pcbY: 10,
        pcbRotation: 0,
        pcbSide: 'front',
      }],
      parts,
    });

    expect(() => generateKicadProject(input)).not.toThrow();
  });

  it('escapes backslashes and quotes in part names', () => {
    const parts = new Map<number, {
      meta: Record<string, unknown>;
      connectors: Array<{ id: string; name: string; padType?: string }>;
    }>();
    parts.set(1, {
      meta: { title: 'Test "Part" with \\backslash' },
      connectors: [{ id: 'c1', name: 'P1' }],
    });

    const input = makeKicadInput({
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

    const sch = generateKicadSchematic(input);
    // Quotes should be escaped
    expect(sch).toContain('\\"Part\\"');
    // Backslashes should be escaped
    expect(sch).toContain('\\\\backslash');
  });
});
