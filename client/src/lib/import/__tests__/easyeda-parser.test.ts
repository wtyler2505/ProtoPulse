import { describe, it, expect } from 'vitest';

import {
  parseEasyEdaDocument,
  easyEdaToMm,
  mmToEasyEda,
  convertCoordinates,
  normalizePackageName,
  detectDocType,
  isValidEasyEdaDocument,
  getSupportedExtensions,
  isLikelyEasyEdaFile,
  getDesignSummary,
} from '../easyeda-parser';
import type { EasyEdaDocument, EasyEdaParseResult } from '../easyeda-parser';

// ---------------------------------------------------------------------------
// Helpers — build minimal EasyEDA documents
// ---------------------------------------------------------------------------

function makeSchematicDoc(overrides: Partial<EasyEdaDocument> = {}): EasyEdaDocument {
  return {
    docType: '1',
    title: 'Test Schematic',
    editorVersion: '6.5.0',
    shape: [],
    ...overrides,
  };
}

function makePcbDoc(overrides: Partial<EasyEdaDocument> = {}): EasyEdaDocument {
  return {
    docType: '3',
    title: 'Test PCB',
    editorVersion: '6.5.0',
    shape: [],
    ...overrides,
  };
}

function makeSymbolDoc(overrides: Partial<EasyEdaDocument> = {}): EasyEdaDocument {
  return {
    docType: '2',
    title: 'Test Symbol',
    editorVersion: '6.5.0',
    shape: [],
    ...overrides,
  };
}

/** Build a LIB shape string for a schematic component */
function makeLIBShape(opts: {
  x?: number;
  y?: number;
  rotation?: number;
  id?: string;
  packageName?: string;
  refDes?: string;
  name?: string;
  value?: string;
  pins?: Array<{ number: string; name: string; x?: number; y?: number; electricalType?: string }>;
  properties?: Record<string, string>;
} = {}): string {
  const {
    x = 100,
    y = 200,
    rotation = 0,
    id = 'comp1',
    packageName = '0805',
    refDes = 'R1',
    name = 'Resistor',
    value = '10k',
    pins = [],
    properties = {},
  } = opts;

  const subShapes: string[] = [];

  // Add text attributes
  subShapes.push(`T~refDes~${refDes}`);
  subShapes.push(`T~name~${name}`);
  subShapes.push(`T~value~${value}`);

  // Add properties
  const propEntries = Object.entries(properties);
  propEntries.forEach(([k, v]) => {
    subShapes.push(`A~${k}~${v}`);
  });

  // Add pins
  pins.forEach((pin) => {
    const px = pin.x ?? 0;
    const py = pin.y ?? 0;
    const elec = pin.electricalType ?? '0';
    subShapes.push(`P~1~${px}~${py}~0~0~#000~${pin.number}~${pin.name}~0~0~${elec}`);
  });

  const subContent = subShapes.join('#@$');
  return `LIB~${x}~${y}~${rotation}~0~${id}~${packageName}~${subContent}`;
}

/** Build a wire shape string */
function makeWireShape(x1: number, y1: number, x2: number, y2: number, netId = 'net1'): string {
  return `W~${x1}~${y1}~${x2}~${y2}~#000~${netId}`;
}

/** Build a net label shape string */
function makeNetLabelShape(x: number, y: number, name: string, netId = 'net1'): string {
  return `N~${x}~${y}~0~${name}~${netId}`;
}

/** Build a PCB TRACK shape string */
function makeTrackShape(
  points: Array<{ x: number; y: number }>,
  width = 10,
  layer = 1,
  net = 'GND',
): string {
  const pointsStr = points.map((p) => `${p.x},${p.y}`).join(' ');
  return `TRACK~${width}~${layer}~${net}~${pointsStr}~track1`;
}

/** Build a PCB LIB (footprint) shape string */
function makePcbLIBShape(opts: {
  x?: number;
  y?: number;
  rotation?: number;
  layer?: number;
  id?: string;
  packageName?: string;
  pads?: Array<{ number: string; x?: number; y?: number; net?: string }>;
  properties?: Record<string, string>;
} = {}): string {
  const {
    x = 500,
    y = 300,
    rotation = 0,
    layer = 1,
    id = 'fp1',
    packageName = 'DIP8',
    pads = [],
    properties = {},
  } = opts;

  const subShapes: string[] = [];

  const propEntries = Object.entries(properties);
  propEntries.forEach(([k, v]) => {
    subShapes.push(`A~${k}~${v}`);
  });

  pads.forEach((pad) => {
    const px = pad.x ?? 0;
    const py = pad.y ?? 0;
    const net = pad.net ?? '';
    subShapes.push(`PAD~RECT~${px}~${py}~10~10~${layer}~${net}~${pad.number}~0`);
  });

  const subContent = subShapes.join('#@$');
  return `LIB~${x}~${y}~${rotation}~${layer}~${id}~${packageName}~${subContent}`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('easyeda-parser', () => {
  // -----------------------------------------------------------------------
  // Coordinate conversion
  // -----------------------------------------------------------------------

  describe('easyEdaToMm', () => {
    it('converts 0 to 0', () => {
      expect(easyEdaToMm(0)).toBe(0);
    });

    it('converts 1 unit to 0.254mm', () => {
      expect(easyEdaToMm(1)).toBe(0.254);
    });

    it('converts 100 units to 25.4mm (1 inch)', () => {
      expect(easyEdaToMm(100)).toBe(25.4);
    });

    it('converts negative values', () => {
      expect(easyEdaToMm(-50)).toBe(-12.7);
    });

    it('rounds to 3 decimal places', () => {
      const result = easyEdaToMm(7);
      expect(result).toBe(1.778);
    });
  });

  describe('mmToEasyEda', () => {
    it('converts 0mm to 0 units', () => {
      expect(mmToEasyEda(0)).toBe(0);
    });

    it('converts 25.4mm (1 inch) to 100 units', () => {
      expect(mmToEasyEda(25.4)).toBe(100);
    });

    it('is inverse of easyEdaToMm', () => {
      expect(mmToEasyEda(easyEdaToMm(42))).toBe(42);
    });
  });

  describe('convertCoordinates', () => {
    it('converts x and inverts y', () => {
      const result = convertCoordinates(100, 200);
      expect(result.x).toBe(25.4);
      expect(result.y).toBe(-50.8);
    });

    it('converts origin to origin', () => {
      const result = convertCoordinates(0, 0);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it('handles negative EasyEDA coordinates', () => {
      const result = convertCoordinates(-10, -20);
      expect(result.x).toBe(-2.54);
      expect(result.y).toBe(5.08); // Double negation
    });
  });

  // -----------------------------------------------------------------------
  // Package name normalization
  // -----------------------------------------------------------------------

  describe('normalizePackageName', () => {
    it('maps standard SMD sizes', () => {
      expect(normalizePackageName('0402')).toBe('0402');
      expect(normalizePackageName('0805')).toBe('0805');
      expect(normalizePackageName('1206')).toBe('1206');
    });

    it('maps SOT variants', () => {
      expect(normalizePackageName('SOT23')).toBe('SOT-23');
      expect(normalizePackageName('SOT-23')).toBe('SOT-23');
      expect(normalizePackageName('SOT223')).toBe('SOT-223');
    });

    it('maps SOP to SOIC', () => {
      expect(normalizePackageName('SOP8')).toBe('SOIC-8');
      expect(normalizePackageName('SOP-8')).toBe('SOIC-8');
    });

    it('maps DIP packages', () => {
      expect(normalizePackageName('DIP8')).toBe('DIP-8');
      expect(normalizePackageName('DIP-16')).toBe('DIP-16');
      expect(normalizePackageName('DIP40')).toBe('DIP-40');
    });

    it('maps TO packages', () => {
      expect(normalizePackageName('TO92')).toBe('TO-92');
      expect(normalizePackageName('TO-220')).toBe('TO-220');
    });

    it('maps QFP variants', () => {
      expect(normalizePackageName('LQFP48')).toBe('LQFP-48');
      expect(normalizePackageName('QFN32')).toBe('QFN-32');
    });

    it('handles case-insensitive matching', () => {
      expect(normalizePackageName('sot23')).toBe('SOT-23');
      expect(normalizePackageName('dip8')).toBe('DIP-8');
    });

    it('extracts standard size from compound names', () => {
      expect(normalizePackageName('C0402_0402')).toBe('0402');
      expect(normalizePackageName('R0805_0805')).toBe('0805');
    });

    it('returns original name when no mapping exists', () => {
      expect(normalizePackageName('CUSTOM_PKG')).toBe('CUSTOM_PKG');
    });

    it('returns empty string for empty input', () => {
      expect(normalizePackageName('')).toBe('');
    });

    it('maps DPAK and D2PAK', () => {
      expect(normalizePackageName('TO-252')).toBe('DPAK');
      expect(normalizePackageName('DPAK')).toBe('DPAK');
      expect(normalizePackageName('TO-263')).toBe('D2PAK');
    });

    it('maps TSSOP variants', () => {
      expect(normalizePackageName('TSSOP8')).toBe('TSSOP-8');
      expect(normalizePackageName('TSSOP-14')).toBe('TSSOP-14');
      expect(normalizePackageName('TSSOP-20')).toBe('TSSOP-20');
    });
  });

  // -----------------------------------------------------------------------
  // Document validation
  // -----------------------------------------------------------------------

  describe('isValidEasyEdaDocument', () => {
    it('accepts document with docType', () => {
      expect(isValidEasyEdaDocument({ docType: '1' })).toBe(true);
    });

    it('accepts document with shape array', () => {
      expect(isValidEasyEdaDocument({ shape: [] })).toBe(true);
    });

    it('accepts document with head', () => {
      expect(isValidEasyEdaDocument({ head: {} })).toBe(true);
    });

    it('accepts document with schematic', () => {
      expect(isValidEasyEdaDocument({ schematic: { sheets: [] } })).toBe(true);
    });

    it('accepts document with pcb', () => {
      expect(isValidEasyEdaDocument({ pcb: { tracks: [] } })).toBe(true);
    });

    it('rejects null', () => {
      expect(isValidEasyEdaDocument(null)).toBe(false);
    });

    it('rejects non-objects', () => {
      expect(isValidEasyEdaDocument('string')).toBe(false);
      expect(isValidEasyEdaDocument(42)).toBe(false);
    });

    it('rejects empty object', () => {
      expect(isValidEasyEdaDocument({})).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Document type detection
  // -----------------------------------------------------------------------

  describe('detectDocType', () => {
    it('detects schematic from docType string "1"', () => {
      expect(detectDocType(makeSchematicDoc())).toBe('schematic');
    });

    it('detects schematic from docType number 1', () => {
      expect(detectDocType(makeSchematicDoc({ docType: 1 }))).toBe('schematic');
    });

    it('detects pcb from docType "3"', () => {
      expect(detectDocType(makePcbDoc())).toBe('pcb');
    });

    it('detects symbol from docType "2"', () => {
      expect(detectDocType(makeSymbolDoc())).toBe('symbol');
    });

    it('detects schematic from content heuristic (LIB shapes)', () => {
      expect(detectDocType({ shape: ['LIB~100~200~0~0~id~pkg~sub'] })).toBe('schematic');
    });

    it('detects pcb from content heuristic (TRACK shapes)', () => {
      expect(detectDocType({ shape: ['TRACK~10~1~net~100,200 300,400~id'] })).toBe('pcb');
    });

    it('detects schematic from Pro format', () => {
      expect(detectDocType({ schematic: { sheets: [] } })).toBe('schematic');
    });

    it('detects pcb from Pro format', () => {
      expect(detectDocType({ pcb: { tracks: [] } })).toBe('pcb');
    });

    it('returns unknown for empty doc', () => {
      expect(detectDocType({ docType: 99 })).toBe('unknown');
    });
  });

  // -----------------------------------------------------------------------
  // Schematic parsing
  // -----------------------------------------------------------------------

  describe('parseEasyEdaDocument — schematic', () => {
    it('parses a minimal schematic with no components', () => {
      const result = parseEasyEdaDocument(makeSchematicDoc());
      expect(result.sourceDocType).toBe('schematic');
      expect(result.design.components).toHaveLength(0);
      expect(result.design.warnings).toContain('No components found in schematic');
    });

    it('parses a single component', () => {
      const doc = makeSchematicDoc({
        shape: [
          makeLIBShape({
            refDes: 'R1',
            name: 'Resistor',
            value: '10k',
            packageName: '0805',
            x: 100,
            y: 200,
          }),
        ],
      });

      const result = parseEasyEdaDocument(doc);
      expect(result.design.components).toHaveLength(1);

      const comp = result.design.components[0];
      expect(comp.refDes).toBe('R1');
      expect(comp.name).toBe('Resistor');
      expect(comp.value).toBe('10k');
      expect(comp.package).toBe('0805');
      expect(comp.library).toBe('EasyEDA');
    });

    it('converts component coordinates from 10mil to mm', () => {
      const doc = makeSchematicDoc({
        shape: [makeLIBShape({ x: 100, y: 200 })],
      });

      const result = parseEasyEdaDocument(doc);
      const pos = result.design.components[0].position!;
      expect(pos.x).toBe(25.4);
      expect(pos.y).toBe(-50.8); // Y inverted
    });

    it('parses component rotation', () => {
      const doc = makeSchematicDoc({
        shape: [makeLIBShape({ rotation: 90 })],
      });

      const result = parseEasyEdaDocument(doc);
      expect(result.design.components[0].rotation).toBe(90);
    });

    it('parses component pins', () => {
      const doc = makeSchematicDoc({
        shape: [
          makeLIBShape({
            pins: [
              { number: '1', name: 'A', x: 10, y: 0, electricalType: 'passive' },
              { number: '2', name: 'B', x: 30, y: 0, electricalType: 'passive' },
            ],
          }),
        ],
      });

      const result = parseEasyEdaDocument(doc);
      const pins = result.design.components[0].pins;
      expect(pins).toHaveLength(2);
      expect(pins[0].number).toBe('1');
      expect(pins[0].name).toBe('A');
      expect(pins[0].type).toBe('passive');
      expect(pins[1].number).toBe('2');
      expect(pins[1].name).toBe('B');
    });

    it('maps pin electrical types correctly', () => {
      const doc = makeSchematicDoc({
        shape: [
          makeLIBShape({
            pins: [
              { number: '1', name: 'IN', electricalType: 'input' },
              { number: '2', name: 'OUT', electricalType: 'output' },
              { number: '3', name: 'IO', electricalType: 'bidirectional' },
              { number: '4', name: 'VCC', electricalType: 'power' },
              { number: '5', name: 'NC', electricalType: 'unspecified' },
            ],
          }),
        ],
      });

      const result = parseEasyEdaDocument(doc);
      const pins = result.design.components[0].pins;
      expect(pins[0].type).toBe('input');
      expect(pins[1].type).toBe('output');
      expect(pins[2].type).toBe('bidirectional');
      expect(pins[3].type).toBe('power');
      expect(pins[4].type).toBe('unspecified');
    });

    it('parses multiple components', () => {
      const doc = makeSchematicDoc({
        shape: [
          makeLIBShape({ id: 'c1', refDes: 'R1', name: 'Resistor', x: 100, y: 100 }),
          makeLIBShape({ id: 'c2', refDes: 'C1', name: 'Capacitor', x: 200, y: 100, packageName: '0603' }),
          makeLIBShape({ id: 'c3', refDes: 'U1', name: 'ATmega328', x: 300, y: 200, packageName: 'DIP28' }),
        ],
      });

      const result = parseEasyEdaDocument(doc);
      expect(result.design.components).toHaveLength(3);
      expect(result.design.components[0].refDes).toBe('R1');
      expect(result.design.components[1].refDes).toBe('C1');
      expect(result.design.components[1].package).toBe('0603');
      expect(result.design.components[2].refDes).toBe('U1');
      expect(result.design.components[2].package).toBe('DIP-28');
    });

    it('warns on duplicate reference designators', () => {
      const doc = makeSchematicDoc({
        shape: [
          makeLIBShape({ id: 'c1', refDes: 'R1' }),
          makeLIBShape({ id: 'c2', refDes: 'R1' }),
        ],
      });

      const result = parseEasyEdaDocument(doc);
      expect(result.design.warnings.some((w) => w.includes('Duplicate reference designator: R1'))).toBe(true);
    });

    it('parses wire segments', () => {
      const doc = makeSchematicDoc({
        shape: [makeWireShape(100, 200, 300, 200, 'net1')],
      });

      const result = parseEasyEdaDocument(doc);
      expect(result.design.wires).toHaveLength(1);
      expect(result.design.wires[0].start.x).toBe(easyEdaToMm(100));
      expect(result.design.wires[0].end.x).toBe(easyEdaToMm(300));
    });

    it('parses net labels', () => {
      const doc = makeSchematicDoc({
        shape: [
          makeLIBShape({
            refDes: 'R1',
            pins: [{ number: '1', name: 'A', x: 0, y: 0 }],
            x: 100,
            y: 200,
          }),
          makeNetLabelShape(100, 200, 'VCC', 'net1'),
          makeWireShape(100, 200, 100, 200, 'net1'),
        ],
      });

      const result = parseEasyEdaDocument(doc);
      // Net label should produce a named net
      const vccNet = result.design.nets.find((n) => n.name === 'VCC');
      expect(vccNet).toBeDefined();
    });

    it('includes metadata', () => {
      const doc = makeSchematicDoc({ editorVersion: '6.5.22' });
      const result = parseEasyEdaDocument(doc);

      expect(result.design.metadata.sourceFormat).toBe('easyeda-schematic');
      expect(result.design.metadata.editorVersion).toBe('6.5.22');
    });

    it('preserves component properties', () => {
      const doc = makeSchematicDoc({
        shape: [
          makeLIBShape({
            properties: { MPN: 'RC0805FR-0710KL', Manufacturer: 'YAGEO' },
          }),
        ],
      });

      const result = parseEasyEdaDocument(doc);
      expect(result.design.components[0].properties.MPN).toBe('RC0805FR-0710KL');
      expect(result.design.components[0].properties.Manufacturer).toBe('YAGEO');
    });

    it('normalizes package names on components', () => {
      const doc = makeSchematicDoc({
        shape: [makeLIBShape({ packageName: 'SOP8' })],
      });

      const result = parseEasyEdaDocument(doc);
      expect(result.design.components[0].package).toBe('SOIC-8');
    });

    it('has null boardOutline for schematics', () => {
      const result = parseEasyEdaDocument(makeSchematicDoc());
      expect(result.boardOutline).toBeNull();
    });

    it('sets file name in design', () => {
      const result = parseEasyEdaDocument(makeSchematicDoc(), 'my-circuit.json');
      expect(result.design.fileName).toBe('my-circuit.json');
    });

    it('uses version from editorVersion field', () => {
      const result = parseEasyEdaDocument(makeSchematicDoc({ editorVersion: '6.5.40' }));
      expect(result.design.version).toBe('6.5.40');
    });

    it('sets design title from doc title', () => {
      const result = parseEasyEdaDocument(makeSchematicDoc({ title: 'My LED Driver' }));
      expect(result.design.title).toBe('My LED Driver');
    });
  });

  // -----------------------------------------------------------------------
  // PCB parsing
  // -----------------------------------------------------------------------

  describe('parseEasyEdaDocument — pcb', () => {
    it('parses a minimal PCB with no footprints', () => {
      const result = parseEasyEdaDocument(makePcbDoc());
      expect(result.sourceDocType).toBe('pcb');
      expect(result.design.components).toHaveLength(0);
      expect(result.design.warnings).toContain('No footprints found in PCB document');
    });

    it('parses PCB footprints', () => {
      const doc = makePcbDoc({
        shape: [
          makePcbLIBShape({
            id: 'fp1',
            packageName: 'DIP8',
            pads: [
              { number: '1', x: 0, y: 0, net: 'VCC' },
              { number: '2', x: 10, y: 0, net: 'GND' },
            ],
            properties: { Designator: 'U1', Name: 'NE555' },
          }),
        ],
      });

      const result = parseEasyEdaDocument(doc);
      expect(result.design.components).toHaveLength(1);
      expect(result.design.components[0].refDes).toBe('U1');
      expect(result.design.components[0].name).toBe('NE555');
      expect(result.design.components[0].package).toBe('DIP-8');
      expect(result.design.components[0].pins).toHaveLength(2);
    });

    it('builds nets from pad connectivity', () => {
      const doc = makePcbDoc({
        shape: [
          makePcbLIBShape({
            id: 'fp1',
            properties: { Designator: 'U1' },
            pads: [
              { number: '1', net: 'VCC' },
              { number: '2', net: 'GND' },
            ],
          }),
          makePcbLIBShape({
            id: 'fp2',
            properties: { Designator: 'C1' },
            pads: [
              { number: '1', net: 'VCC' },
              { number: '2', net: 'GND' },
            ],
          }),
        ],
      });

      const result = parseEasyEdaDocument(doc);
      expect(result.design.nets.length).toBeGreaterThanOrEqual(2);

      const vccNet = result.design.nets.find((n) => n.name === 'VCC');
      expect(vccNet).toBeDefined();
      expect(vccNet!.pins).toHaveLength(2);
      expect(vccNet!.pins.some((p) => p.componentRef === 'U1')).toBe(true);
      expect(vccNet!.pins.some((p) => p.componentRef === 'C1')).toBe(true);
    });

    it('parses PCB tracks as wires', () => {
      const doc = makePcbDoc({
        shape: [
          makeTrackShape(
            [{ x: 100, y: 200 }, { x: 300, y: 200 }],
            10,
            1,
            'VCC',
          ),
        ],
      });

      const result = parseEasyEdaDocument(doc);
      expect(result.design.wires).toHaveLength(1);
      expect(result.design.wires[0].net).toBe('VCC');
      expect(result.design.wires[0].layer).toBe('F.Cu');
      expect(result.design.wires[0].width).toBe(easyEdaToMm(10));
    });

    it('maps PCB layers correctly', () => {
      const doc = makePcbDoc({
        shape: [
          makeTrackShape([{ x: 0, y: 0 }, { x: 10, y: 0 }], 5, 2, 'GND'),
        ],
      });

      const result = parseEasyEdaDocument(doc);
      expect(result.design.wires[0].layer).toBe('B.Cu');
    });

    it('handles multi-segment tracks', () => {
      const doc = makePcbDoc({
        shape: [
          makeTrackShape(
            [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
            8,
            1,
            'SIG',
          ),
        ],
      });

      const result = parseEasyEdaDocument(doc);
      expect(result.design.wires).toHaveLength(2);
    });

    it('extracts board outline from SOLIDREGION', () => {
      const doc = makePcbDoc({
        shape: [
          'SOLIDREGION~board~M 0 0 L 1000 0 L 1000 500 L 0 500 Z',
        ],
      });

      const result = parseEasyEdaDocument(doc);
      expect(result.boardOutline).not.toBeNull();
      expect(result.boardOutline!.length).toBeGreaterThanOrEqual(4);
    });

    it('warns when no board outline found', () => {
      const result = parseEasyEdaDocument(makePcbDoc());
      expect(result.design.warnings).toContain('No board outline found');
    });

    it('includes PCB-specific metadata', () => {
      const doc = makePcbDoc({
        shape: [
          makeTrackShape([{ x: 0, y: 0 }, { x: 10, y: 0 }]),
        ],
      });

      const result = parseEasyEdaDocument(doc);
      expect(result.design.metadata.sourceFormat).toBe('easyeda-pcb');
      expect(result.design.metadata.trackCount).toBe('1');
    });

    it('assigns component layers from footprint data', () => {
      const doc = makePcbDoc({
        shape: [
          makePcbLIBShape({ layer: 2, properties: { Designator: 'R1' } }),
        ],
      });

      const result = parseEasyEdaDocument(doc);
      expect(result.design.components[0].layer).toBe('B.Cu');
    });
  });

  // -----------------------------------------------------------------------
  // Symbol parsing
  // -----------------------------------------------------------------------

  describe('parseEasyEdaDocument — symbol', () => {
    it('parses a symbol document', () => {
      const doc = makeSymbolDoc({
        shape: [
          makeLIBShape({
            refDes: 'U?',
            name: 'Op-Amp',
            pins: [
              { number: '1', name: 'IN+', electricalType: 'input' },
              { number: '2', name: 'IN-', electricalType: 'input' },
              { number: '3', name: 'OUT', electricalType: 'output' },
            ],
          }),
        ],
      });

      const result = parseEasyEdaDocument(doc);
      expect(result.sourceDocType).toBe('symbol');
      expect(result.design.components).toHaveLength(1);
      expect(result.design.components[0].pins).toHaveLength(3);
      expect(result.design.nets).toHaveLength(0);
    });

    it('warns on empty symbol', () => {
      const result = parseEasyEdaDocument(makeSymbolDoc());
      expect(result.design.warnings).toContain('No symbol data found');
    });
  });

  // -----------------------------------------------------------------------
  // JSON string parsing
  // -----------------------------------------------------------------------

  describe('parseEasyEdaDocument — JSON string input', () => {
    it('accepts valid JSON string', () => {
      const json = JSON.stringify(makeSchematicDoc());
      const result = parseEasyEdaDocument(json);
      expect(result.sourceDocType).toBe('schematic');
    });

    it('throws on invalid JSON', () => {
      expect(() => parseEasyEdaDocument('not valid json')).toThrow('Invalid JSON');
    });

    it('throws on valid JSON that is not an EasyEDA document', () => {
      expect(() => parseEasyEdaDocument('{"foo": "bar"}')).toThrow('Not a valid EasyEDA document');
    });
  });

  // -----------------------------------------------------------------------
  // Unknown document type
  // -----------------------------------------------------------------------

  describe('parseEasyEdaDocument — unknown docType', () => {
    it('falls back to schematic parsing with warning', () => {
      const doc: EasyEdaDocument = { docType: 99, shape: [] };
      const result = parseEasyEdaDocument(doc);
      expect(result.sourceDocType).toBe('unknown');
      expect(result.design.warnings.some((w) => w.includes('Could not determine document type'))).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // File detection helpers
  // -----------------------------------------------------------------------

  describe('getSupportedExtensions', () => {
    it('returns array of supported extensions', () => {
      const exts = getSupportedExtensions();
      expect(exts).toContain('.json');
      expect(exts).toContain('.easyeda');
    });
  });

  describe('isLikelyEasyEdaFile', () => {
    it('returns true for .json files', () => {
      expect(isLikelyEasyEdaFile('circuit.json')).toBe(true);
    });

    it('returns true for .easyeda files', () => {
      expect(isLikelyEasyEdaFile('project.easyeda')).toBe(true);
    });

    it('returns false for non-matching extensions', () => {
      expect(isLikelyEasyEdaFile('schematic.kicad_sch')).toBe(false);
      expect(isLikelyEasyEdaFile('board.brd')).toBe(false);
    });

    it('is case insensitive', () => {
      expect(isLikelyEasyEdaFile('CIRCUIT.JSON')).toBe(true);
      expect(isLikelyEasyEdaFile('Project.EasyEDA')).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Design summary
  // -----------------------------------------------------------------------

  describe('getDesignSummary', () => {
    it('returns correct summary for schematic', () => {
      const doc = makeSchematicDoc({
        shape: [
          makeLIBShape({ id: 'c1', refDes: 'R1' }),
          makeLIBShape({ id: 'c2', refDes: 'C1' }),
        ],
      });

      const result = parseEasyEdaDocument(doc);
      const summary = getDesignSummary(result);

      expect(summary.docType).toBe('schematic');
      expect(summary.componentCount).toBe(2);
      expect(summary.hasBoardOutline).toBe(false);
    });

    it('returns correct summary for PCB with outline', () => {
      const doc = makePcbDoc({
        shape: [
          makePcbLIBShape({ properties: { Designator: 'U1' } }),
          'SOLIDREGION~board~M 0 0 L 100 0 L 100 100 L 0 100 Z',
        ],
      });

      const result = parseEasyEdaDocument(doc);
      const summary = getDesignSummary(result);

      expect(summary.docType).toBe('pcb');
      expect(summary.componentCount).toBe(1);
      expect(summary.hasBoardOutline).toBe(true);
    });

    it('includes warning and error counts', () => {
      const result = parseEasyEdaDocument(makeSchematicDoc());
      const summary = getDesignSummary(result);
      expect(typeof summary.warningCount).toBe('number');
      expect(typeof summary.errorCount).toBe('number');
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles shapes with too few parts gracefully', () => {
      const doc = makeSchematicDoc({ shape: ['LIB~100~200'] });
      const result = parseEasyEdaDocument(doc);
      expect(result.design.components).toHaveLength(0);
    });

    it('handles wire shapes with too few parts', () => {
      const doc = makeSchematicDoc({ shape: ['W~100'] });
      const result = parseEasyEdaDocument(doc);
      expect(result.design.wires).toHaveLength(0);
    });

    it('handles net label shapes with too few parts', () => {
      const doc = makeSchematicDoc({ shape: ['N~100~200'] });
      // Should not throw
      const result = parseEasyEdaDocument(doc);
      expect(result.design).toBeDefined();
    });

    it('handles non-numeric coordinates', () => {
      const doc = makeSchematicDoc({
        shape: ['LIB~abc~def~0~0~id~pkg~subdata'],
      });
      const result = parseEasyEdaDocument(doc);
      // Should parse with 0,0 fallback
      expect(result.design).toBeDefined();
    });

    it('handles empty shape array', () => {
      const doc = makeSchematicDoc({ shape: [] });
      const result = parseEasyEdaDocument(doc);
      expect(result.design.components).toHaveLength(0);
      expect(result.design.warnings.length).toBeGreaterThanOrEqual(1);
    });

    it('ignores non-LIB/W/N shape types in schematic', () => {
      const doc = makeSchematicDoc({
        shape: [
          'R~100~200~300~400~#000~1', // Rectangle (ignored)
          'E~150~250~50~50~#F00~1',   // Ellipse (ignored)
          makeLIBShape({ refDes: 'R1' }),
        ],
      });

      const result = parseEasyEdaDocument(doc);
      expect(result.design.components).toHaveLength(1);
    });

    it('handles component with no sub-shapes', () => {
      const doc = makeSchematicDoc({
        shape: ['LIB~100~200~0~0~id1~PKG~'],
      });

      const result = parseEasyEdaDocument(doc);
      expect(result.design.components).toHaveLength(1);
      expect(result.design.components[0].refDes).toBe('id1'); // Fallback to id
    });

    it('handles PCB track with invalid coordinates', () => {
      const doc = makePcbDoc({
        shape: ['TRACK~10~1~net~abc,def 100,200~id'],
      });

      const result = parseEasyEdaDocument(doc);
      // Should gracefully skip invalid coords
      expect(result.design).toBeDefined();
    });

    it('handles large component count', () => {
      const shapes = Array.from({ length: 50 }, (_, i) =>
        makeLIBShape({ id: `c${i}`, refDes: `R${i + 1}`, x: i * 100, y: 0 }),
      );

      const doc = makeSchematicDoc({ shape: shapes });
      const result = parseEasyEdaDocument(doc);
      expect(result.design.components).toHaveLength(50);
    });
  });

  // -----------------------------------------------------------------------
  // Attribute extraction fallbacks
  // -----------------------------------------------------------------------

  describe('attribute extraction fallbacks', () => {
    it('falls back to Designator property for refDes', () => {
      const shape = makeLIBShape({ refDes: '', properties: { Designator: 'Q1' } });
      const doc = makeSchematicDoc({ shape: [shape] });
      const result = parseEasyEdaDocument(doc);
      expect(result.design.components[0].refDes).toBe('Q1');
    });

    it('falls back to Name property for name', () => {
      const shape = makeLIBShape({ name: '', properties: { Name: 'MOSFET' } });
      const doc = makeSchematicDoc({ shape: [shape] });
      const result = parseEasyEdaDocument(doc);
      expect(result.design.components[0].name).toBe('MOSFET');
    });

    it('falls back to Value property for value', () => {
      const shape = makeLIBShape({ value: '', properties: { Value: '4.7uF' } });
      const doc = makeSchematicDoc({ shape: [shape] });
      const result = parseEasyEdaDocument(doc);
      expect(result.design.components[0].value).toBe('4.7uF');
    });

    it('falls back to package name for component name when none set', () => {
      const doc = makeSchematicDoc({
        shape: ['LIB~100~200~0~0~id1~SOT23~'],
      });

      const result = parseEasyEdaDocument(doc);
      expect(result.design.components[0].name).toBe('SOT23');
    });

    it('uses id as fallback when no refDes is available', () => {
      const doc = makeSchematicDoc({
        shape: ['LIB~100~200~0~0~myId~PKG~'],
      });

      const result = parseEasyEdaDocument(doc);
      expect(result.design.components[0].refDes).toBe('myId');
    });
  });

  // -----------------------------------------------------------------------
  // Net building specifics
  // -----------------------------------------------------------------------

  describe('net building', () => {
    it('connects component pins via wire proximity', () => {
      const doc = makeSchematicDoc({
        shape: [
          makeLIBShape({
            id: 'c1',
            refDes: 'R1',
            x: 100,
            y: 100,
            pins: [{ number: '1', name: 'A', x: 0, y: 0 }],
          }),
          makeLIBShape({
            id: 'c2',
            refDes: 'R2',
            x: 200,
            y: 100,
            pins: [{ number: '1', name: 'A', x: 0, y: 0 }],
          }),
          // Wire connecting R1 pin 1 to R2 pin 1
          makeWireShape(100, 100, 200, 100, 'net1'),
          makeNetLabelShape(150, 100, 'SIG', 'net1'),
        ],
      });

      const result = parseEasyEdaDocument(doc);
      const sigNet = result.design.nets.find((n) => n.name === 'SIG');
      expect(sigNet).toBeDefined();
      expect(sigNet!.pins).toHaveLength(2);
    });

    it('avoids duplicate pin entries in a net', () => {
      const doc = makeSchematicDoc({
        shape: [
          makeLIBShape({
            id: 'c1',
            refDes: 'R1',
            x: 100,
            y: 100,
            pins: [{ number: '1', name: 'A', x: 0, y: 0 }],
          }),
          // Two wires touching the same pin
          makeWireShape(100, 100, 150, 100, 'net1'),
          makeWireShape(100, 100, 100, 150, 'net1'),
          makeNetLabelShape(125, 100, 'DUPL', 'net1'),
        ],
      });

      const result = parseEasyEdaDocument(doc);
      const net = result.design.nets.find((n) => n.name === 'DUPL');
      expect(net).toBeDefined();
      // Pin should appear only once despite two wires touching it
      const r1Pins = net!.pins.filter((p) => p.componentRef === 'R1' && p.pinNumber === '1');
      expect(r1Pins).toHaveLength(1);
    });

    it('creates separate nets for unconnected wires', () => {
      const doc = makeSchematicDoc({
        shape: [
          makeWireShape(0, 0, 10, 0, 'net1'),
          makeWireShape(50, 50, 60, 50, 'net2'),
          makeNetLabelShape(5, 0, 'NET_A', 'net1'),
          makeNetLabelShape(55, 50, 'NET_B', 'net2'),
        ],
      });

      const result = parseEasyEdaDocument(doc);
      // Nets exist even if no pins match (they just have 0 pins)
      expect(result.design.wires).toHaveLength(2);
    });
  });
});
