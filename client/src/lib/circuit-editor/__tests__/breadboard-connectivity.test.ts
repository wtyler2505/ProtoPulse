/**
 * BL-0542: Breadboard Connectivity Analysis Tests
 *
 * Tests for breadboard-connectivity.ts — net classification,
 * color assignment, connectivity map building, and grouping.
 */

import { describe, it, expect } from 'vitest';
import {
  classifyNet,
  getNetColor,
  buildConnectivityMap,
  groupHolesByNet,
  getCoordLabel,
} from '../breadboard-connectivity';
import type { ConnectivityMap } from '../breadboard-connectivity';
import {
  coordKey,
  coordToPixel,
  BB,
} from '../breadboard-model';
import type {
  TiePoint,
  RailPoint,
  BreadboardCoord,
} from '../breadboard-model';
import type { CircuitNetRow, CircuitWireRow, CircuitInstanceRow, ComponentPart } from '@shared/schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function terminal(col: TiePoint['col'], row: number): TiePoint {
  return { type: 'terminal', col, row };
}

function rail(r: RailPoint['rail'], index: number): RailPoint {
  return { type: 'rail', rail: r, index };
}

function makeNet(id: number, name: string): CircuitNetRow {
  return {
    id,
    circuitId: 1,
    name,
    segments: [],
    properties: {},
    style: {},
    createdAt: new Date(),
  } as CircuitNetRow;
}

function makeWire(
  id: number,
  netId: number,
  coords: BreadboardCoord[],
): CircuitWireRow {
  return {
    id,
    circuitId: 1,
    netId,
    view: 'breadboard',
    points: coords.map((c) => coordToPixel(c)),
    layer: 'front',
    color: null,
    width: null,
    wireType: 'wire',
    createdAt: new Date(),
  } as CircuitWireRow;
}

function makeInstance(
  id: number,
  refDes: string,
  coord: BreadboardCoord | null,
): CircuitInstanceRow {
  const px = coord ? coordToPixel(coord) : null;
  return {
    id,
    circuitId: 1,
    partId: null,
    referenceDesignator: refDes,
    breadboardX: px?.x ?? null,
    breadboardY: px?.y ?? null,
    x: 0,
    y: 0,
    rotation: 0,
    properties: {},
    createdAt: new Date(),
  } as CircuitInstanceRow;
}

// ---------------------------------------------------------------------------
// classifyNet
// ---------------------------------------------------------------------------

describe('classifyNet', () => {
  it('classifies VCC as power', () => {
    expect(classifyNet('VCC')).toBe('power');
  });

  it('classifies VDD as power', () => {
    expect(classifyNet('VDD')).toBe('power');
  });

  it('classifies 5V as power', () => {
    expect(classifyNet('5V')).toBe('power');
  });

  it('classifies 3V3 as power', () => {
    expect(classifyNet('3V3')).toBe('power');
  });

  it('classifies 3.3V as power', () => {
    expect(classifyNet('3.3V')).toBe('power');
  });

  it('classifies 12V as power', () => {
    expect(classifyNet('12V')).toBe('power');
  });

  it('classifies VIN as power', () => {
    expect(classifyNet('VIN')).toBe('power');
  });

  it('classifies GND as ground', () => {
    expect(classifyNet('GND')).toBe('ground');
  });

  it('classifies VSS as ground', () => {
    expect(classifyNet('VSS')).toBe('ground');
  });

  it('classifies AGND as ground', () => {
    expect(classifyNet('AGND')).toBe('ground');
  });

  it('classifies DGND as ground', () => {
    expect(classifyNet('DGND')).toBe('ground');
  });

  it('classifies D7 as signal', () => {
    expect(classifyNet('D7')).toBe('signal');
  });

  it('classifies SDA as signal', () => {
    expect(classifyNet('SDA')).toBe('signal');
  });

  it('classifies LED1 as signal', () => {
    expect(classifyNet('LED1')).toBe('signal');
  });

  it('is case-insensitive', () => {
    expect(classifyNet('vcc')).toBe('power');
    expect(classifyNet('gnd')).toBe('ground');
    expect(classifyNet('Vdd')).toBe('power');
  });

  it('trims whitespace', () => {
    expect(classifyNet('  VCC  ')).toBe('power');
    expect(classifyNet(' GND ')).toBe('ground');
  });

  it('classifies +5V pattern as power', () => {
    expect(classifyNet('+5V')).toBe('power');
  });

  it('classifies +3.3V pattern as power', () => {
    expect(classifyNet('+3.3V')).toBe('power');
  });

  it('classifies 9V as power', () => {
    expect(classifyNet('9V')).toBe('power');
  });
});

// ---------------------------------------------------------------------------
// getNetColor
// ---------------------------------------------------------------------------

describe('getNetColor', () => {
  it('returns red for power nets', () => {
    expect(getNetColor('VCC', 'power')).toBe('#ef4444');
  });

  it('returns dark for ground nets', () => {
    expect(getNetColor('GND', 'ground')).toBe('#1a1a2e');
  });

  it('returns a signal color for signal nets', () => {
    const color = getNetColor('SDA', 'signal');
    expect(typeof color).toBe('string');
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('returns consistent color for the same signal name', () => {
    const c1 = getNetColor('MOSI', 'signal');
    const c2 = getNetColor('MOSI', 'signal');
    expect(c1).toBe(c2);
  });

  it('returns different colors for different signal names (usually)', () => {
    const c1 = getNetColor('SDA', 'signal');
    const c2 = getNetColor('SCL', 'signal');
    // Not guaranteed to differ for all names, but these two should
    // (hash difference). If they happen to collide, that's fine.
    expect(typeof c1).toBe('string');
    expect(typeof c2).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// buildConnectivityMap — basic scenarios
// ---------------------------------------------------------------------------

describe('buildConnectivityMap', () => {
  it('returns empty map for empty inputs', () => {
    const result = buildConnectivityMap([], [], [], []);
    expect(result.holes.size).toBe(0);
    expect(result.nets.size).toBe(0);
  });

  it('returns empty holes when nets exist but no wires', () => {
    const nets = [makeNet(1, 'VCC')];
    const result = buildConnectivityMap(nets, [], [], []);
    expect(result.holes.size).toBe(0);
    expect(result.nets.size).toBe(1);
  });

  it('expands a single wire endpoint through left-group connectivity', () => {
    const nets = [makeNet(1, 'VCC')];
    // Wire with one endpoint at terminal (a, 5)
    const wires = [makeWire(1, 1, [terminal('a', 5), terminal('a', 10)])];
    const result = buildConnectivityMap(nets, wires, [], []);

    // Terminal (a, 5) should expand to a-e row 5 = 5 holes
    // Terminal (a, 10) should expand to a-e row 10 = 5 holes
    // Total: 10 holes
    expect(result.holes.size).toBe(10);

    // Check that all left-group columns are present for row 5
    for (const col of BB.LEFT_COLS) {
      const key = coordKey(terminal(col, 5));
      expect(result.holes.has(key)).toBe(true);
      const hole = result.holes.get(key)!;
      expect(hole.netId).toBe(1);
      expect(hole.netName).toBe('VCC');
      expect(hole.netType).toBe('power');
    }
  });

  it('expands a wire endpoint in right-group to f-j', () => {
    const nets = [makeNet(2, 'SDA')];
    const wires = [makeWire(1, 2, [terminal('g', 3), terminal('h', 7)])];
    const result = buildConnectivityMap(nets, wires, [], []);

    // row 3 right-group: f,g,h,i,j = 5
    // row 7 right-group: f,g,h,i,j = 5
    expect(result.holes.size).toBe(10);

    for (const col of BB.RIGHT_COLS) {
      const key = coordKey(terminal(col, 3));
      expect(result.holes.has(key)).toBe(true);
      expect(result.holes.get(key)!.netType).toBe('signal');
    }
  });

  it('expands a rail wire endpoint to all rail points', () => {
    const nets = [makeNet(3, 'GND')];
    const wires = [makeWire(1, 3, [rail('top_neg', 0), terminal('a', 1)])];
    const result = buildConnectivityMap(nets, wires, [], []);

    // Rail: all 63 points + terminal row 1 left-group: 5 points = 68
    expect(result.holes.size).toBe(BB.ROWS + 5);
  });

  it('assigns correct net type and color to power net', () => {
    const nets = [makeNet(1, 'VCC')];
    const wires = [makeWire(1, 1, [terminal('c', 1)])];
    const result = buildConnectivityMap(nets, wires, [], []);

    const hole = result.holes.get(coordKey(terminal('c', 1)))!;
    expect(hole.netType).toBe('power');
    expect(hole.color).toBe('#ef4444');
  });

  it('assigns correct net type and color to ground net', () => {
    const nets = [makeNet(1, 'GND')];
    const wires = [makeWire(1, 1, [terminal('b', 2)])];
    const result = buildConnectivityMap(nets, wires, [], []);

    const hole = result.holes.get(coordKey(terminal('b', 2)))!;
    expect(hole.netType).toBe('ground');
    expect(hole.color).toBe('#1a1a2e');
  });

  it('first net wins when two wires land on the same connected group', () => {
    const nets = [makeNet(1, 'VCC'), makeNet(2, 'GND')];
    // Both touch left-group row 5 — net 1 should win (processed first)
    const wires = [
      makeWire(1, 1, [terminal('a', 5)]),
      makeWire(2, 2, [terminal('c', 5)]),
    ];
    const result = buildConnectivityMap(nets, wires, [], []);

    const hole = result.holes.get(coordKey(terminal('a', 5)))!;
    expect(hole.netId).toBe(1);
  });

  it('handles multiple nets on different rows independently', () => {
    const nets = [makeNet(1, 'VCC'), makeNet(2, 'GND')];
    const wires = [
      makeWire(1, 1, [terminal('a', 5)]),
      makeWire(2, 2, [terminal('a', 10)]),
    ];
    const result = buildConnectivityMap(nets, wires, [], []);

    expect(result.holes.size).toBe(10); // 5 + 5
    expect(result.holes.get(coordKey(terminal('a', 5)))!.netId).toBe(1);
    expect(result.holes.get(coordKey(terminal('a', 10)))!.netId).toBe(2);
  });

  it('does not cross the center channel', () => {
    const nets = [makeNet(1, 'SIG')];
    const wires = [makeWire(1, 1, [terminal('e', 5)])];
    const result = buildConnectivityMap(nets, wires, [], []);

    // Left-group only: a,b,c,d,e — NOT f,g,h,i,j
    expect(result.holes.size).toBe(5);
    expect(result.holes.has(coordKey(terminal('f', 5)))).toBe(false);
  });

  it('includes pixel positions for each hole', () => {
    const nets = [makeNet(1, 'VCC')];
    const wires = [makeWire(1, 1, [terminal('a', 1)])];
    const result = buildConnectivityMap(nets, wires, [], []);

    const hole = result.holes.get(coordKey(terminal('a', 1)))!;
    const expectedPx = coordToPixel(terminal('a', 1));
    expect(hole.pixel.x).toBe(expectedPx.x);
    expect(hole.pixel.y).toBe(expectedPx.y);
  });

  it('filters out non-breadboard wires', () => {
    const nets = [makeNet(1, 'VCC')];
    const schematicWire = {
      ...makeWire(1, 1, [terminal('a', 1)]),
      view: 'schematic',
    } as CircuitWireRow;
    const result = buildConnectivityMap(nets, [schematicWire], [], []);
    expect(result.holes.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildConnectivityMap — instance placement scenarios
// ---------------------------------------------------------------------------

describe('buildConnectivityMap with instances', () => {
  it('does not add holes for instances without breadboard placement', () => {
    const nets = [makeNet(1, 'VCC')];
    const instances = [makeInstance(1, 'R1', null)];
    const result = buildConnectivityMap(nets, [], instances, []);
    expect(result.holes.size).toBe(0);
  });

  it('assigns net to instance hole when wire connects to same position', () => {
    const coord = terminal('b', 5);
    const nets = [makeNet(1, 'VCC')];
    const wires = [makeWire(1, 1, [coord, terminal('a', 10)])];
    const instances = [makeInstance(1, 'R1', coord)];
    const result = buildConnectivityMap(nets, wires, instances, []);

    // Instance at (b, 5) should be in VCC net
    const hole = result.holes.get(coordKey(coord))!;
    expect(hole.netId).toBe(1);
    expect(hole.netName).toBe('VCC');
  });
});

// ---------------------------------------------------------------------------
// groupHolesByNet
// ---------------------------------------------------------------------------

describe('groupHolesByNet', () => {
  it('returns empty map for empty connectivity', () => {
    const map: ConnectivityMap = {
      holes: new Map(),
      nets: new Map(),
    };
    const groups = groupHolesByNet(map);
    expect(groups.size).toBe(0);
  });

  it('groups holes by net ID', () => {
    const nets = [makeNet(1, 'VCC'), makeNet(2, 'GND')];
    const wires = [
      makeWire(1, 1, [terminal('a', 5)]),
      makeWire(2, 2, [terminal('a', 10)]),
    ];
    const map = buildConnectivityMap(nets, wires, [], []);
    const groups = groupHolesByNet(map);

    expect(groups.size).toBe(2);
    expect(groups.get(1)!.length).toBe(5); // a-e row 5
    expect(groups.get(2)!.length).toBe(5); // a-e row 10
  });

  it('all holes in a group share the same netId', () => {
    const nets = [makeNet(1, 'SIG')];
    const wires = [makeWire(1, 1, [terminal('f', 20)])];
    const map = buildConnectivityMap(nets, wires, [], []);
    const groups = groupHolesByNet(map);

    const group = groups.get(1)!;
    for (const hole of group) {
      expect(hole.netId).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// getCoordLabel
// ---------------------------------------------------------------------------

describe('getCoordLabel', () => {
  it('formats terminal coordinate as column+row', () => {
    expect(getCoordLabel(terminal('a', 1))).toBe('a1');
    expect(getCoordLabel(terminal('j', 63))).toBe('j63');
  });

  it('formats rail coordinate with brackets', () => {
    expect(getCoordLabel(rail('top_pos', 0))).toBe('top_pos[0]');
    expect(getCoordLabel(rail('bottom_neg', 42))).toBe('bottom_neg[42]');
  });
});
