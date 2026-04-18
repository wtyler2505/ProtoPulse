// Module-level tests for the split KiCad exporter. These cover helpers that
// previously had no direct unit coverage — they were only exercised indirectly
// through the full schematic/PCB snapshot paths.

import { describe, expect, it } from 'vitest';

import {
  esc,
  ind,
  num,
  normalizeAngle,
  sanitizeSymbolName,
} from '../export/kicad/sexpr';
import {
  extractDatasheet,
  extractFootprint,
  extractManufacturer,
  extractMountingType,
  extractMpn,
  extractPartValue,
  extractTitle,
  guessPinType,
  mapCopperLayer,
  mapSilkLayer,
  mapWireLayer,
} from '../export/kicad/meta';
import { buildNetIndex, makePinKey } from '../export/kicad/netlist';
import { layoutPins } from '../export/kicad/symbols';
import { generateBoardOutline, generatePcbLayers, generatePcbNets } from '../export/kicad/board';
import type { KicadInput } from '../export/kicad/types';

describe('kicad/sexpr', () => {
  it('esc escapes backslashes and double quotes', () => {
    expect(esc('a\\b"c')).toBe('a\\\\b\\"c');
  });

  it('ind produces 2-space indentation per level', () => {
    expect(ind(0)).toBe('');
    expect(ind(3)).toBe('      ');
  });

  it('num strips trailing zeros and rounds to 4 decimals', () => {
    expect(num(1.23456789)).toBe('1.2346');
    expect(num(2.5)).toBe('2.5');
    expect(num(0)).toBe('0');
    expect(num(5)).toBe('5');
  });

  it('normalizeAngle maps into [0, 360)', () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(360)).toBe(0);
    expect(normalizeAngle(-90)).toBe(270);
    expect(normalizeAngle(540)).toBe(180);
  });

  it('sanitizeSymbolName replaces unsafe chars with underscore', () => {
    expect(sanitizeSymbolName('Hello World!')).toBe('Hello_World_');
    expect(sanitizeSymbolName('ATmega328P-AU')).toBe('ATmega328P_AU');
  });
});

describe('kicad/meta', () => {
  it('extractPartValue prefers meta.value then walks properties', () => {
    expect(extractPartValue({ value: '10k' })).toBe('10k');
    expect(
      extractPartValue({
        properties: [{ key: 'resistance', value: '4.7k' }],
      }),
    ).toBe('4.7k');
    expect(extractPartValue({})).toBe('');
  });

  it('extractFootprint checks packageType, package, footprint in order', () => {
    expect(extractFootprint({ packageType: 'SOIC-8' })).toBe('SOIC-8');
    expect(extractFootprint({ package: 'DIP-14' })).toBe('DIP-14');
    expect(extractFootprint({ footprint: 'R_0805' })).toBe('R_0805');
    expect(extractFootprint({})).toBe('');
  });

  it('extractTitle falls back through title -> family -> Unknown', () => {
    expect(extractTitle({ title: 'LM358' })).toBe('LM358');
    expect(extractTitle({ family: 'resistor' })).toBe('resistor');
    expect(extractTitle({})).toBe('Unknown');
  });

  it('extractManufacturer / MPN / datasheet / mounting type are trivial string pulls', () => {
    expect(extractManufacturer({ manufacturer: 'TI' })).toBe('TI');
    expect(extractMpn({ mpn: 'LM358N' })).toBe('LM358N');
    expect(extractDatasheet({ datasheetUrl: 'https://ti.com/ds' })).toBe('https://ti.com/ds');
    expect(extractMountingType({ mountingType: 'smd' })).toBe('smd');
  });

  it('guessPinType classifies common pin names', () => {
    const meta = {};
    expect(guessPinType({ id: '1', name: 'VCC' }, meta)).toBe('power_in');
    expect(guessPinType({ id: '2', name: 'GND' }, meta)).toBe('power_in');
    expect(guessPinType({ id: '3', name: 'VOUT' }, meta)).toBe('power_out');
    expect(guessPinType({ id: '4', name: 'OUT' }, { family: 'resistor' })).toBe('passive');
    expect(guessPinType({ id: '5', name: 'IO' }, meta)).toBe('unspecified');
  });

  it('layer mapping picks F.* / B.* based on side', () => {
    expect(mapCopperLayer(null)).toBe('F.Cu');
    expect(mapCopperLayer('front')).toBe('F.Cu');
    expect(mapCopperLayer('back')).toBe('B.Cu');
    expect(mapCopperLayer('bottom')).toBe('B.Cu');

    expect(mapSilkLayer(null)).toBe('F.SilkS');
    expect(mapSilkLayer('bottom')).toBe('B.SilkS');

    expect(mapWireLayer('b.cu')).toBe('B.Cu');
    expect(mapWireLayer('top')).toBe('F.Cu');
    expect(mapWireLayer('unknown-layer')).toBe('F.Cu');
  });
});

describe('kicad/symbols — layoutPins', () => {
  it('returns a default body when there are no pins', () => {
    const { placements, bodyWidth, bodyHeight } = layoutPins(0);
    expect(placements).toEqual([]);
    expect(bodyWidth).toBeGreaterThan(0);
    expect(bodyHeight).toBeGreaterThan(0);
  });

  it('splits pins roughly evenly onto left/right edges', () => {
    const { placements } = layoutPins(4);
    expect(placements).toHaveLength(4);
    // First two are left-side (negative x), last two are right-side (positive x)
    expect(placements[0].x).toBeLessThan(0);
    expect(placements[1].x).toBeLessThan(0);
    expect(placements[2].x).toBeGreaterThan(0);
    expect(placements[3].x).toBeGreaterThan(0);
    // Left-side rotation=0, right-side rotation=180
    expect(placements[0].rotation).toBe(0);
    expect(placements[3].rotation).toBe(180);
  });

  it('favors left side when the pin count is odd', () => {
    const { placements } = layoutPins(5);
    const leftCount = placements.filter((p) => p.x < 0).length;
    const rightCount = placements.filter((p) => p.x > 0).length;
    expect(leftCount).toBe(3);
    expect(rightCount).toBe(2);
  });
});

describe('kicad/netlist — buildNetIndex', () => {
  function makeInput(): KicadInput {
    return {
      circuit: { id: 1, name: 'T' },
      instances: [
        {
          id: 10,
          referenceDesignator: 'R1',
          partId: 100,
          schematicX: 0,
          schematicY: 0,
          schematicRotation: 0,
          pcbX: 0,
          pcbY: 0,
          pcbRotation: 0,
          pcbSide: 'front',
        },
        {
          id: 11,
          referenceDesignator: 'R2',
          partId: 100,
          schematicX: 0,
          schematicY: 0,
          schematicRotation: 0,
          pcbX: 0,
          pcbY: 0,
          pcbRotation: 0,
          pcbSide: 'front',
        },
      ],
      nets: [
        {
          name: 'VCC',
          netType: 'power',
          segments: [
            { fromInstanceId: 10, fromPin: '1', toInstanceId: 11, toPin: '1' },
          ],
        },
        // Duplicate net name — should not get a new code
        {
          name: 'VCC',
          netType: 'power',
          segments: [],
        },
        {
          name: 'GND',
          netType: 'power',
          segments: [
            { fromInstanceId: 10, fromPin: '2', toInstanceId: 11, toPin: '2' },
          ],
        },
      ],
      wires: [],
      parts: new Map([
        [
          100,
          {
            meta: { family: 'resistor' },
            connectors: [
              { id: '1', name: 'A' },
              { id: '2', name: 'B' },
            ],
          },
        ],
      ]),
    };
  }

  it('deduplicates net names and assigns 1-based codes', () => {
    const { netList } = buildNetIndex(makeInput());
    expect(netList).toEqual([
      { name: 'VCC', code: 1 },
      { name: 'GND', code: 2 },
    ]);
  });

  it('maps both pin id and pin alias (name) to the same NetInfo', () => {
    const { pinToNet } = buildNetIndex(makeInput());
    const byId = pinToNet.get(makePinKey(10, '1'));
    const byName = pinToNet.get(makePinKey(10, 'A'));
    expect(byId?.code).toBe(1);
    expect(byName?.code).toBe(1);
    expect(byId?.name).toBe('VCC');
  });
});

describe('kicad/board — emitters', () => {
  it('generatePcbLayers includes all KiCad 7 fixed layer ids', () => {
    const out = generatePcbLayers();
    expect(out).toContain('(0 "F.Cu" signal)');
    expect(out).toContain('(31 "B.Cu" signal)');
    expect(out).toContain('(44 "Edge.Cuts" user)');
  });

  it('generatePcbNets emits net 0 plus each net in order', () => {
    const out = generatePcbNets([
      { name: 'VCC', code: 1 },
      { name: 'GND', code: 2 },
    ]);
    expect(out).toContain('(net 0 "")');
    expect(out).toContain('(net 1 "VCC")');
    expect(out).toContain('(net 2 "GND")');
  });

  it('generateBoardOutline emits four closed gr_line segments', () => {
    const out = generateBoardOutline(50, 30);
    const segmentCount = (out.match(/gr_line/g) ?? []).length;
    expect(segmentCount).toBe(4);
    expect(out).toContain('(layer "Edge.Cuts")');
    expect(out).toContain('(start 0 0)');
    expect(out).toContain('(end 50 0)');
  });
});
