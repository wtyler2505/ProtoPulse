import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { generateOdbPlusPlus, type OdbInput } from '../export/odb-plus-plus-generator';

// =============================================================================
// Fixtures
// =============================================================================

function makeOdbInput(overrides: Partial<OdbInput> = {}): OdbInput {
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

function makePopulatedInput(): OdbInput {
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

  return makeOdbInput({
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
// ZIP archive structure
// =============================================================================

describe('generateOdbPlusPlus', () => {
  it('returns a valid ZIP buffer', async () => {
    const input = makeOdbInput();
    const result = await generateOdbPlusPlus(input);

    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.buffer.length).toBeGreaterThan(0);

    // Verify it can be parsed as a ZIP
    const zip = await JSZip.loadAsync(result.buffer);
    expect(Object.keys(zip.files).length).toBeGreaterThan(0);
  });

  it('contains matrix/matrix file', async () => {
    const input = makeOdbInput();
    const result = await generateOdbPlusPlus(input);
    const zip = await JSZip.loadAsync(result.buffer);

    const matrixFile = zip.file('matrix/matrix');
    expect(matrixFile).not.toBeNull();

    const content = await matrixFile!.async('string');
    expect(content).toContain('UNITS=MM');
  });

  it('contains misc/info file with metadata', async () => {
    const input = makeOdbInput({ projectName: 'My Rover Board' });
    const result = await generateOdbPlusPlus(input);
    const zip = await JSZip.loadAsync(result.buffer);

    const infoFile = zip.file('misc/info');
    expect(infoFile).not.toBeNull();

    const content = await infoFile!.async('string');
    expect(content).toContain('ODB_VERSION_NUM=7.0');
    expect(content).toContain('My Rover Board');
    expect(content).toContain('ProtoPulse');
  });

  it('contains EDA data file', async () => {
    const input = makePopulatedInput();
    const result = await generateOdbPlusPlus(input);
    const zip = await JSZip.loadAsync(result.buffer);

    const edaFile = zip.file('steps/pcb/eda/data');
    expect(edaFile).not.toBeNull();

    const content = await edaFile!.async('string');
    expect(content).toContain('UNITS=MM');
    expect(content).toContain('CMP U1');
    expect(content).toContain('CMP R1');
  });

  it('reports correct layer and component counts', async () => {
    const input = makePopulatedInput();
    const result = await generateOdbPlusPlus(input);

    expect(result.layerCount).toBe(9);
    expect(result.componentCount).toBe(2);
  });

  it('handles empty project gracefully', async () => {
    const input = makeOdbInput();
    const result = await generateOdbPlusPlus(input);

    expect(result.layerCount).toBe(9);
    expect(result.componentCount).toBe(0);

    const zip = await JSZip.loadAsync(result.buffer);
    expect(zip.file('matrix/matrix')).not.toBeNull();
    expect(zip.file('misc/info')).not.toBeNull();
    expect(zip.file('steps/pcb/eda/data')).not.toBeNull();
  });
});

// =============================================================================
// Matrix file
// =============================================================================

describe('ODB++ matrix file', () => {
  it('defines all standard layers', async () => {
    const input = makeOdbInput();
    const result = await generateOdbPlusPlus(input);
    const zip = await JSZip.loadAsync(result.buffer);

    const content = await zip.file('matrix/matrix')!.async('string');
    expect(content).toContain('NAME=comp_+_top');
    expect(content).toContain('NAME=comp_+_bot');
    expect(content).toContain('NAME=solder_mask_top');
    expect(content).toContain('NAME=solder_mask_bot');
    expect(content).toContain('NAME=silk_screen_top');
    expect(content).toContain('NAME=silk_screen_bot');
    expect(content).toContain('NAME=drill');
  });

  it('includes layer type information', async () => {
    const input = makeOdbInput();
    const result = await generateOdbPlusPlus(input);
    const zip = await JSZip.loadAsync(result.buffer);

    const content = await zip.file('matrix/matrix')!.async('string');
    expect(content).toContain('TYPE=SIGNAL');
    expect(content).toContain('TYPE=SOLDER_MASK');
    expect(content).toContain('TYPE=SILK_SCREEN');
    expect(content).toContain('TYPE=DRILL');
  });

  it('sets polarity to POSITIVE for all layers', async () => {
    const input = makeOdbInput();
    const result = await generateOdbPlusPlus(input);
    const zip = await JSZip.loadAsync(result.buffer);

    const content = await zip.file('matrix/matrix')!.async('string');
    const polarityMatches = content.match(/POLARITY=POSITIVE/g);
    expect(polarityMatches).not.toBeNull();
    expect(polarityMatches!.length).toBe(9);
  });
});

// =============================================================================
// Signal layer features
// =============================================================================

describe('ODB++ signal layers', () => {
  it('generates top copper layer with pad features', async () => {
    const input = makePopulatedInput();
    const result = await generateOdbPlusPlus(input);
    const zip = await JSZip.loadAsync(result.buffer);

    const topCopper = await zip.file('steps/pcb/layers/comp_+_top/features')!.async('string');
    expect(topCopper).toContain('UNITS=MM');
    expect(topCopper).toContain('U1');
    expect(topCopper).toContain('R1');
  });

  it('includes board outline in signal layer', async () => {
    const input = makeOdbInput({ boardWidth: 100, boardHeight: 80 });
    const result = await generateOdbPlusPlus(input);
    const zip = await JSZip.loadAsync(result.buffer);

    const topCopper = await zip.file('steps/pcb/layers/comp_+_top/features')!.async('string');
    expect(topCopper).toContain('OB');
    expect(topCopper).toContain('100.000000');
    expect(topCopper).toContain('80.000000');
    expect(topCopper).toContain('OE');
  });

  it('includes trace data from PCB wires', async () => {
    const input = makePopulatedInput();
    const result = await generateOdbPlusPlus(input);
    const zip = await JSZip.loadAsync(result.buffer);

    const topCopper = await zip.file('steps/pcb/layers/comp_+_top/features')!.async('string');
    expect(topCopper).toContain('# Traces');
    expect(topCopper).toContain('L ');
  });

  it('separates top and bottom side components', async () => {
    const parts = new Map<number, {
      meta: Record<string, unknown>;
      connectors: Array<{ id: string; name: string; padType?: string }>;
    }>();
    parts.set(1, {
      meta: { title: 'IC_Top' },
      connectors: [{ id: 'c1', name: 'P1' }],
    });
    parts.set(2, {
      meta: { title: 'IC_Bot' },
      connectors: [{ id: 'c1', name: 'P1' }],
    });

    const input = makeOdbInput({
      instances: [
        { id: 1, partId: 1, referenceDesignator: 'U1', schematicX: 0, schematicY: 0, schematicRotation: 0, pcbX: 10, pcbY: 10, pcbRotation: 0, pcbSide: 'front', properties: {} },
        { id: 2, partId: 2, referenceDesignator: 'U2', schematicX: 0, schematicY: 0, schematicRotation: 0, pcbX: 30, pcbY: 10, pcbRotation: 0, pcbSide: 'back', properties: {} },
      ],
      parts,
    });

    const result = await generateOdbPlusPlus(input);
    const zip = await JSZip.loadAsync(result.buffer);

    const topCopper = await zip.file('steps/pcb/layers/comp_+_top/features')!.async('string');
    const botCopper = await zip.file('steps/pcb/layers/comp_+_bot/features')!.async('string');

    expect(topCopper).toContain('U1');
    expect(topCopper).not.toContain('U2');
    expect(botCopper).toContain('U2');
    expect(botCopper).not.toContain('U1');
  });
});

// =============================================================================
// Solder mask layers
// =============================================================================

describe('ODB++ solder mask layers', () => {
  it('generates solder mask openings for pads', async () => {
    const input = makePopulatedInput();
    const result = await generateOdbPlusPlus(input);
    const zip = await JSZip.loadAsync(result.buffer);

    const maskTop = await zip.file('steps/pcb/layers/solder_mask_top/features')!.async('string');
    expect(maskTop).toContain('UNITS=MM');
    expect(maskTop).toContain('P '); // pad features
  });
});

// =============================================================================
// Silkscreen layers
// =============================================================================

describe('ODB++ silkscreen layers', () => {
  it('generates component outlines and reference designators', async () => {
    const input = makePopulatedInput();
    const result = await generateOdbPlusPlus(input);
    const zip = await JSZip.loadAsync(result.buffer);

    const silkTop = await zip.file('steps/pcb/layers/silk_screen_top/features')!.async('string');
    expect(silkTop).toContain('U1');
    expect(silkTop).toContain('R1');
    expect(silkTop).toContain('T '); // text features
    expect(silkTop).toContain('L '); // line features for outlines
  });
});

// =============================================================================
// Drill layer
// =============================================================================

describe('ODB++ drill layer', () => {
  it('generates drill holes for THT pads only', async () => {
    const input = makePopulatedInput();
    const result = await generateOdbPlusPlus(input);
    const zip = await JSZip.loadAsync(result.buffer);

    const drill = await zip.file('steps/pcb/layers/drill/features')!.async('string');
    expect(drill).toContain('UNITS=MM');
    // U1 has 4 THT pads
    expect(drill).toContain('U1-VCC');
    expect(drill).toContain('U1-GND');
    // R1 has SMD pads - should not appear
    expect(drill).not.toContain('R1-PIN1');
  });
});

// =============================================================================
// EDA data
// =============================================================================

describe('ODB++ EDA data', () => {
  it('contains component placement records', async () => {
    const input = makePopulatedInput();
    const result = await generateOdbPlusPlus(input);
    const zip = await JSZip.loadAsync(result.buffer);

    const eda = await zip.file('steps/pcb/eda/data')!.async('string');
    expect(eda).toContain('CMP U1 DIP-28');
    expect(eda).toContain('CMP R1 0805');
    expect(eda).toContain(';ATmega328P');
  });

  it('contains net records with pin references', async () => {
    const input = makePopulatedInput();
    const result = await generateOdbPlusPlus(input);
    const zip = await JSZip.loadAsync(result.buffer);

    const eda = await zip.file('steps/pcb/eda/data')!.async('string');
    expect(eda).toContain('NET VCC');
    expect(eda).toContain('SNT U1 VCC');
    expect(eda).toContain('SNT R1 PIN1');
  });

  it('contains BOM records', async () => {
    const input = makePopulatedInput();
    const result = await generateOdbPlusPlus(input);
    const zip = await JSZip.loadAsync(result.buffer);

    const eda = await zip.file('steps/pcb/eda/data')!.async('string');
    expect(eda).toContain('BOM ATMEGA328P-PU Microchip QTY=1');
    expect(eda).toContain('BOM RC0805JR-0710KL Yageo QTY=5');
  });

  it('indicates component side (T/B)', async () => {
    const parts = new Map<number, {
      meta: Record<string, unknown>;
      connectors: Array<{ id: string; name: string; padType?: string }>;
    }>();
    parts.set(1, { meta: { title: 'Cap' }, connectors: [{ id: 'c1', name: 'P1' }] });

    const input = makeOdbInput({
      instances: [
        { id: 1, partId: 1, referenceDesignator: 'C1', schematicX: 0, schematicY: 0, schematicRotation: 0, pcbX: 10, pcbY: 10, pcbRotation: 0, pcbSide: 'back', properties: {} },
      ],
      parts,
    });

    const result = await generateOdbPlusPlus(input);
    const zip = await JSZip.loadAsync(result.buffer);

    const eda = await zip.file('steps/pcb/eda/data')!.async('string');
    expect(eda).toContain('C1');
    expect(eda).toContain(' B ;'); // Bottom side indicator
  });
});

// =============================================================================
// Edge cases
// =============================================================================

describe('ODB++ edge cases', () => {
  it('handles instance with null partId', async () => {
    const input = makeOdbInput({
      instances: [
        { id: 1, partId: null, referenceDesignator: 'X1', schematicX: 0, schematicY: 0, schematicRotation: 0, pcbX: 10, pcbY: 10, pcbRotation: 0, pcbSide: 'front', properties: {} },
      ],
    });

    const result = await generateOdbPlusPlus(input);
    expect(result.componentCount).toBe(1);

    const zip = await JSZip.loadAsync(result.buffer);
    const eda = await zip.file('steps/pcb/eda/data')!.async('string');
    expect(eda).toContain('X1');
  });

  it('handles instance with null PCB coordinates', async () => {
    const parts = new Map<number, {
      meta: Record<string, unknown>;
      connectors: Array<{ id: string; name: string; padType?: string }>;
    }>();
    parts.set(1, { meta: { title: 'IC' }, connectors: [{ id: 'c1', name: 'P1' }] });

    const input = makeOdbInput({
      instances: [
        { id: 1, partId: 1, referenceDesignator: 'U1', schematicX: 50, schematicY: 50, schematicRotation: 0, pcbX: null, pcbY: null, pcbRotation: null, pcbSide: null, properties: {} },
      ],
      parts,
    });

    // Should not throw
    const result = await generateOdbPlusPlus(input);
    expect(result.buffer.length).toBeGreaterThan(0);
  });

  it('uses default board dimensions when not specified', async () => {
    const input = makeOdbInput({ boardWidth: undefined, boardHeight: undefined });
    const result = await generateOdbPlusPlus(input);
    const zip = await JSZip.loadAsync(result.buffer);

    const topCopper = await zip.file('steps/pcb/layers/comp_+_top/features')!.async('string');
    expect(topCopper).toContain('50.000000');
    expect(topCopper).toContain('40.000000');
  });

  it('sanitizes project name in info file', async () => {
    const input = makeOdbInput({ projectName: 'My <Special> "Board" & Design' });
    const result = await generateOdbPlusPlus(input);
    const zip = await JSZip.loadAsync(result.buffer);

    const info = await zip.file('misc/info')!.async('string');
    // sanitizeFilename replaces special chars with underscores
    expect(info).not.toContain('<Special>');
    expect(info).toContain('PRODUCT_MODEL_NAME=');
  });
});
