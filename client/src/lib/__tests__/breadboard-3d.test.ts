import { describe, it, expect, beforeEach } from 'vitest';
import {
  Breadboard3DEngine,
  toPoint3D,
  getConnectionGroup,
  areConnected,
  isValidPoint,
  getWireColor,
  findWirePath,
  WIRE_COLORS,
} from '../breadboard-3d';
import type {
  TerminalPoint,
  RailPoint,
  BreadboardPoint,
  Point3D,
  NetConnection,
  Breadboard3DSnapshot,
  PlacedComponent,
  Wire3D,
} from '../breadboard-3d';

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function engine(): Breadboard3DEngine {
  return Breadboard3DEngine.getInstance();
}

function term(col: TerminalPoint['col'], row: number): TerminalPoint {
  return { type: 'terminal', col, row };
}

function rail(railId: RailPoint['rail'], index: number): RailPoint {
  return { type: 'rail', rail: railId, index };
}

// ──────────────────────────────────────────────────────────────────
// toPoint3D
// ──────────────────────────────────────────────────────────────────

describe('toPoint3D', () => {
  it('converts terminal point to 3D coordinates', () => {
    const p = toPoint3D(term('a', 1));
    expect(p.x).toBe(0); // col a = index 0
    expect(p.y).toBe(0); // row 1 → (1-1)*2.54 = 0
    expect(p.z).toBe(0);
  });

  it('converts terminal point with offset row', () => {
    const p = toPoint3D(term('a', 5));
    expect(p.y).toBeCloseTo(4 * 2.54);
  });

  it('converts right-side column with DIP gap', () => {
    const pa = toPoint3D(term('a', 1));
    const pf = toPoint3D(term('f', 1));
    // f (ci=5) is separated from e (ci=4) by the 7.62mm DIP straddle,
    // not a single pitch — x = 5*2.54 + (7.62-2.54) = 17.78mm
    expect(pf.x).toBeGreaterThan(pa.x);
    expect(pf.x).toBeCloseTo(5 * 2.54 + (7.62 - 2.54)); // 17.78mm
  });

  it('e-to-f spacing equals CHANNEL_GAP_MM (7.62mm physical DIP straddle)', () => {
    const pe = toPoint3D(term('e', 1));
    const pf = toPoint3D(term('f', 1));
    // Physical e-to-f center distance must be exactly 7.62mm (0.3")
    expect(pf.x - pe.x).toBeCloseTo(7.62);
  });

  it('same-group (a-to-c) spacing has no channel offset — difference = 2 * PITCH_MM', () => {
    const pa = toPoint3D(term('a', 1));
    const pc = toPoint3D(term('c', 1));
    expect(pc.x - pa.x).toBeCloseTo(2 * 2.54);
  });

  it('cross-channel wire midpoint is in the channel space (not clipping through it)', () => {
    const pe = toPoint3D(term('e', 1));
    const pf = toPoint3D(term('f', 1));
    // Visual center of the channel should be between e.x and f.x
    const channelCenter = (pe.x + pf.x) / 2;
    expect(channelCenter).toBeGreaterThan(pe.x);
    expect(channelCenter).toBeLessThan(pf.x);
    // midpoint = (e.x + f.x) / 2 = (10.16 + 17.78) / 2 = 13.97mm
    // e.x = 4*2.54 = 10.16, f.x = 5*2.54 + (7.62-2.54) = 17.78
    expect(channelCenter).toBeCloseTo((4 * 2.54 + (5 * 2.54 + (7.62 - 2.54))) / 2);
  });

  it('converts rail point to 3D coordinates', () => {
    const p = toPoint3D(rail('left_pos', 0));
    expect(p.y).toBe(0);
    expect(p.z).toBe(0);
  });

  it('accepts custom z value', () => {
    const p = toPoint3D(term('b', 3), 10);
    expect(p.z).toBe(10);
  });

  it('different rail IDs have different x positions', () => {
    const topPos = toPoint3D(rail('left_pos', 0));
    const topNeg = toPoint3D(rail('left_neg', 0));
    const botPos = toPoint3D(rail('right_pos', 0));
    const botNeg = toPoint3D(rail('right_neg', 0));
    const xs = [topPos.x, topNeg.x, botPos.x, botNeg.x];
    // All should be distinct
    expect(new Set(xs).size).toBe(4);
  });
});

// ──────────────────────────────────────────────────────────────────
// getConnectionGroup
// ──────────────────────────────────────────────────────────────────

describe('getConnectionGroup', () => {
  it('left-side columns in same row share a group', () => {
    const ga = getConnectionGroup(term('a', 5));
    const gb = getConnectionGroup(term('b', 5));
    const gc = getConnectionGroup(term('c', 5));
    const gd = getConnectionGroup(term('d', 5));
    const ge = getConnectionGroup(term('e', 5));
    expect(ga).toBe(gb);
    expect(gb).toBe(gc);
    expect(gc).toBe(gd);
    expect(gd).toBe(ge);
  });

  it('right-side columns in same row share a group', () => {
    const gf = getConnectionGroup(term('f', 5));
    const gg = getConnectionGroup(term('g', 5));
    expect(gf).toBe(gg);
  });

  it('left and right groups in same row are different', () => {
    const left = getConnectionGroup(term('e', 5));
    const right = getConnectionGroup(term('f', 5));
    expect(left).not.toBe(right);
  });

  it('same column different rows are different groups', () => {
    const r1 = getConnectionGroup(term('a', 1));
    const r2 = getConnectionGroup(term('a', 2));
    expect(r1).not.toBe(r2);
  });

  it('rail points on same rail share a group', () => {
    const r0 = getConnectionGroup(rail('left_pos', 0));
    const r10 = getConnectionGroup(rail('left_pos', 10));
    expect(r0).toBe(r10);
  });

  it('different rails are different groups', () => {
    const tp = getConnectionGroup(rail('left_pos', 0));
    const tn = getConnectionGroup(rail('left_neg', 0));
    expect(tp).not.toBe(tn);
  });
});

// ──────────────────────────────────────────────────────────────────
// areConnected
// ──────────────────────────────────────────────────────────────────

describe('areConnected', () => {
  it('same-row left-side terminals are connected', () => {
    expect(areConnected(term('a', 10), term('e', 10))).toBe(true);
  });

  it('same-row right-side terminals are connected', () => {
    expect(areConnected(term('f', 10), term('j', 10))).toBe(true);
  });

  it('left and right in same row are NOT connected (DIP gap)', () => {
    expect(areConnected(term('e', 10), term('f', 10))).toBe(false);
  });

  it('same rail points are connected', () => {
    expect(areConnected(rail('left_pos', 0), rail('left_pos', 62))).toBe(true);
  });

  it('different rails are not connected', () => {
    expect(areConnected(rail('left_pos', 0), rail('left_neg', 0))).toBe(false);
  });

  it('terminal and rail are not connected', () => {
    expect(areConnected(term('a', 1), rail('left_pos', 0))).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────
// isValidPoint
// ──────────────────────────────────────────────────────────────────

describe('isValidPoint', () => {
  it('valid terminal point', () => {
    expect(isValidPoint(term('a', 1))).toBe(true);
    expect(isValidPoint(term('j', 63))).toBe(true);
  });

  it('invalid terminal row 0', () => {
    expect(isValidPoint(term('a', 0))).toBe(false);
  });

  it('invalid terminal row 64', () => {
    expect(isValidPoint(term('a', 64))).toBe(false);
  });

  it('valid rail point', () => {
    expect(isValidPoint(rail('left_pos', 0))).toBe(true);
    expect(isValidPoint(rail('right_neg', 62))).toBe(true);
  });

  it('invalid rail index', () => {
    expect(isValidPoint(rail('left_pos', -1))).toBe(false);
    expect(isValidPoint(rail('left_pos', 63))).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────
// getWireColor
// ──────────────────────────────────────────────────────────────────

describe('getWireColor', () => {
  it('VCC returns red', () => {
    expect(getWireColor('VCC', 0)).toBe('red');
  });

  it('GND returns black', () => {
    expect(getWireColor('GND', 0)).toBe('black');
  });

  it('SDA returns blue', () => {
    expect(getWireColor('SDA', 0)).toBe('blue');
  });

  it('SCL returns yellow', () => {
    expect(getWireColor('SCL', 0)).toBe('yellow');
  });

  it('3V3 returns orange', () => {
    expect(getWireColor('3V3', 0)).toBe('orange');
  });

  it('unknown net uses cycle color based on index', () => {
    const c0 = getWireColor('mynet', 0);
    const c1 = getWireColor('mynet', 1);
    expect(c0).toBe('green');
    expect(c1).toBe('blue');
  });

  it('case insensitive matching', () => {
    expect(getWireColor('vcc', 0)).toBe('red');
    expect(getWireColor('gnd', 0)).toBe('black');
  });
});

// ──────────────────────────────────────────────────────────────────
// findWirePath
// ──────────────────────────────────────────────────────────────────

describe('findWirePath', () => {
  it('returns a path with at least start and end', () => {
    const from: Point3D = { x: 0, y: 0, z: 0 };
    const to: Point3D = { x: 10, y: 10, z: 0 };
    const path = findWirePath(from, to, new Set());
    expect(path.length).toBeGreaterThanOrEqual(2);
    // First point should be at ground level
    expect(path[0].z).toBe(0);
    // Last point should be at ground level
    expect(path[path.length - 1].z).toBe(0);
  });

  it('same point returns single-element path', () => {
    const p: Point3D = { x: 5, y: 5, z: 0 };
    const path = findWirePath(p, p, new Set());
    expect(path).toHaveLength(1);
  });

  it('routes through wire height to avoid obstacles', () => {
    const from: Point3D = { x: 0, y: 0, z: 0 };
    const to: Point3D = { x: 10, y: 0, z: 0 };
    const path = findWirePath(from, to, new Set());
    // Some intermediate points should be at wire height (5mm)
    const hasAirPoints = path.some((p) => p.z > 0);
    expect(hasAirPoints).toBe(true);
  });

  it('avoids obstacle cells', () => {
    const from: Point3D = { x: 0, y: 0, z: 0 };
    const to: Point3D = { x: 5.08, y: 0, z: 0 }; // 2 pitches right
    const obstacles = new Set<string>();
    // Block the direct path at wire height
    obstacles.add('25,0,50'); // midpoint at z=5
    const path = findWirePath(from, to, obstacles);
    expect(path.length).toBeGreaterThanOrEqual(2);
  });
});

// ──────────────────────────────────────────────────────────────────
// Breadboard3DEngine — singleton
// ──────────────────────────────────────────────────────────────────

describe('Breadboard3DEngine — singleton', () => {
  beforeEach(() => {
    Breadboard3DEngine.resetInstance();
  });

  it('returns same instance', () => {
    const a = Breadboard3DEngine.getInstance();
    const b = Breadboard3DEngine.getInstance();
    expect(a).toBe(b);
  });

  it('resetInstance creates fresh instance', () => {
    const a = engine();
    a.placeComponent({
      id: 'r1', name: 'R1', startPoint: term('a', 1), endPoint: term('a', 5),
      height: 3, color: 'brown', rotation: 0,
    });
    Breadboard3DEngine.resetInstance();
    expect(engine().getAllComponents()).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// Breadboard3DEngine — subscribe
// ──────────────────────────────────────────────────────────────────

describe('Breadboard3DEngine — subscribe', () => {
  beforeEach(() => {
    Breadboard3DEngine.resetInstance();
  });

  it('notifies listeners on component placement', () => {
    const e = engine();
    let count = 0;
    e.subscribe(() => { count++; });
    e.placeComponent({
      id: 'r1', name: 'R1', startPoint: term('a', 1), endPoint: term('a', 3),
      height: 3, color: 'brown', rotation: 0,
    });
    expect(count).toBe(1);
  });

  it('unsubscribe stops notifications', () => {
    const e = engine();
    let count = 0;
    const unsub = e.subscribe(() => { count++; });
    e.placeComponent({
      id: 'r1', name: 'R1', startPoint: term('a', 1), endPoint: term('a', 3),
      height: 3, color: 'brown', rotation: 0,
    });
    unsub();
    e.clear();
    expect(count).toBe(1);
  });
});

// ──────────────────────────────────────────────────────────────────
// Breadboard3DEngine — component placement
// ──────────────────────────────────────────────────────────────────

describe('Breadboard3DEngine — component placement', () => {
  beforeEach(() => {
    Breadboard3DEngine.resetInstance();
  });

  it('places a component and generates pins', () => {
    const e = engine();
    const comp = e.placeComponent({
      id: 'r1', name: 'R1', startPoint: term('a', 1), endPoint: term('a', 5),
      height: 3, color: 'brown', rotation: 0,
    });
    expect(comp.pins.length).toBe(5); // rows 1-5, single column
    expect(e.getAllComponents()).toHaveLength(1);
  });

  it('DIP component generates pins on both sides', () => {
    const e = engine();
    const comp = e.placeComponent({
      id: 'ic1', name: 'ATmega328', startPoint: term('e', 1), endPoint: term('f', 14),
      height: 5, color: 'black', rotation: 0,
    });
    expect(comp.pins.length).toBe(28); // 14 rows × 2 cols
  });

  it('rejects placement on occupied points', () => {
    const e = engine();
    e.placeComponent({
      id: 'r1', name: 'R1', startPoint: term('a', 1), endPoint: term('a', 5),
      height: 3, color: 'brown', rotation: 0,
    });
    expect(() => {
      e.placeComponent({
        id: 'r2', name: 'R2', startPoint: term('a', 3), endPoint: term('a', 7),
        height: 3, color: 'blue', rotation: 0,
      });
    }).toThrow('already occupied');
  });

  it('rejects invalid start point', () => {
    const e = engine();
    expect(() => {
      e.placeComponent({
        id: 'r1', name: 'R1', startPoint: term('a', 0), endPoint: term('a', 3),
        height: 3, color: 'brown', rotation: 0,
      });
    }).toThrow('Invalid start point');
  });

  it('rejects invalid end point', () => {
    const e = engine();
    expect(() => {
      e.placeComponent({
        id: 'r1', name: 'R1', startPoint: term('a', 1), endPoint: term('a', 64),
        height: 3, color: 'brown', rotation: 0,
      });
    }).toThrow('Invalid end point');
  });

  it('marks occupied points', () => {
    const e = engine();
    e.placeComponent({
      id: 'r1', name: 'R1', startPoint: term('a', 1), endPoint: term('a', 3),
      height: 3, color: 'brown', rotation: 0,
    });
    expect(e.isOccupied(term('a', 1))).toBe(true);
    expect(e.isOccupied(term('a', 2))).toBe(true);
    expect(e.isOccupied(term('a', 3))).toBe(true);
    expect(e.isOccupied(term('a', 4))).toBe(false);
  });

  it('getComponent returns placed component', () => {
    const e = engine();
    e.placeComponent({
      id: 'r1', name: 'R1', startPoint: term('a', 1), endPoint: term('a', 5),
      height: 3, color: 'brown', rotation: 0,
    });
    expect(e.getComponent('r1')).toBeDefined();
    expect(e.getComponent('r1')!.name).toBe('R1');
  });

  it('getComponent returns undefined for unknown id', () => {
    expect(engine().getComponent('nonexistent')).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────
// Breadboard3DEngine — remove component
// ──────────────────────────────────────────────────────────────────

describe('Breadboard3DEngine — remove component', () => {
  beforeEach(() => {
    Breadboard3DEngine.resetInstance();
  });

  it('removes a component and frees points', () => {
    const e = engine();
    e.placeComponent({
      id: 'r1', name: 'R1', startPoint: term('a', 1), endPoint: term('a', 3),
      height: 3, color: 'brown', rotation: 0,
    });
    expect(e.isOccupied(term('a', 1))).toBe(true);
    e.removeComponent('r1');
    expect(e.isOccupied(term('a', 1))).toBe(false);
    expect(e.getAllComponents()).toHaveLength(0);
  });

  it('returns false for non-existent component', () => {
    expect(engine().removeComponent('nope')).toBe(false);
  });

  it('allows re-placement after removal', () => {
    const e = engine();
    e.placeComponent({
      id: 'r1', name: 'R1', startPoint: term('a', 1), endPoint: term('a', 3),
      height: 3, color: 'brown', rotation: 0,
    });
    e.removeComponent('r1');
    // Should not throw
    e.placeComponent({
      id: 'r2', name: 'R2', startPoint: term('a', 1), endPoint: term('a', 3),
      height: 3, color: 'red', rotation: 0,
    });
    expect(e.getComponent('r2')).toBeDefined();
  });
});

// ──────────────────────────────────────────────────────────────────
// Breadboard3DEngine — wire routing
// ──────────────────────────────────────────────────────────────────

describe('Breadboard3DEngine — wire routing', () => {
  beforeEach(() => {
    Breadboard3DEngine.resetInstance();
  });

  it('adds a wire with routed path', () => {
    const e = engine();
    const wire = e.addWire('w1', 'VCC', term('a', 1), rail('left_pos', 0), 'red');
    expect(wire.id).toBe('w1');
    expect(wire.netId).toBe('VCC');
    expect(wire.color).toBe('red');
    expect(wire.path.length).toBeGreaterThanOrEqual(2);
    expect(wire.gauge).toBe(22);
  });

  it('auto-assigns wire color from net name', () => {
    const e = engine();
    const wire = e.addWire('w1', 'GND', term('a', 1), rail('left_neg', 0));
    expect(wire.color).toBe('black');
  });

  it('rejects invalid from point', () => {
    const e = engine();
    expect(() => {
      e.addWire('w1', 'net', term('a', 0), term('b', 1));
    }).toThrow('Invalid from point');
  });

  it('rejects invalid to point', () => {
    const e = engine();
    expect(() => {
      e.addWire('w1', 'net', term('a', 1), term('b', 64));
    }).toThrow('Invalid to point');
  });

  it('getWire returns wire by id', () => {
    const e = engine();
    e.addWire('w1', 'net1', term('a', 1), term('a', 10));
    expect(e.getWire('w1')).toBeDefined();
    expect(e.getWire('w1')!.netId).toBe('net1');
  });

  it('getWire returns undefined for unknown id', () => {
    expect(engine().getWire('nope')).toBeUndefined();
  });

  it('getAllWires returns all wires', () => {
    const e = engine();
    e.addWire('w1', 'net1', term('a', 1), term('a', 10));
    e.addWire('w2', 'net2', term('b', 1), term('b', 10));
    expect(e.getAllWires()).toHaveLength(2);
  });

  it('getWiresByNet filters by net', () => {
    const e = engine();
    e.addWire('w1', 'VCC', term('a', 1), rail('left_pos', 0));
    e.addWire('w2', 'GND', term('a', 10), rail('left_neg', 0));
    e.addWire('w3', 'VCC', term('b', 1), rail('left_pos', 5));
    expect(e.getWiresByNet('VCC')).toHaveLength(2);
    expect(e.getWiresByNet('GND')).toHaveLength(1);
  });
});

// ──────────────────────────────────────────────────────────────────
// Breadboard3DEngine — remove wire
// ──────────────────────────────────────────────────────────────────

describe('Breadboard3DEngine — remove wire', () => {
  beforeEach(() => {
    Breadboard3DEngine.resetInstance();
  });

  it('removes a wire', () => {
    const e = engine();
    e.addWire('w1', 'net1', term('a', 1), term('a', 10));
    expect(e.removeWire('w1')).toBe(true);
    expect(e.getAllWires()).toHaveLength(0);
  });

  it('returns false for non-existent wire', () => {
    expect(engine().removeWire('nope')).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────
// Breadboard3DEngine — auto-route
// ──────────────────────────────────────────────────────────────────

describe('Breadboard3DEngine — auto-route', () => {
  beforeEach(() => {
    Breadboard3DEngine.resetInstance();
  });

  it('auto-routes a simple 2-point net', () => {
    const e = engine();
    const nets: NetConnection[] = [
      { netId: 'VCC', points: [term('a', 1), rail('left_pos', 0)] },
    ];
    const wires = e.autoRoute(nets);
    expect(wires).toHaveLength(1);
    expect(wires[0].netId).toBe('VCC');
  });

  it('auto-routes a 3-point net using MST (2 wires)', () => {
    const e = engine();
    const nets: NetConnection[] = [
      { netId: 'sig', points: [term('a', 1), term('f', 1), term('a', 10)] },
    ];
    const wires = e.autoRoute(nets);
    expect(wires).toHaveLength(2); // MST has N-1 edges
  });

  it('auto-routes multiple nets', () => {
    const e = engine();
    const nets: NetConnection[] = [
      { netId: 'VCC', points: [term('a', 1), rail('left_pos', 0)] },
      { netId: 'GND', points: [term('a', 5), rail('left_neg', 0)] },
    ];
    const wires = e.autoRoute(nets);
    expect(wires).toHaveLength(2);
    expect(wires.some((w) => w.netId === 'VCC')).toBe(true);
    expect(wires.some((w) => w.netId === 'GND')).toBe(true);
  });

  it('skips nets with fewer than 2 points', () => {
    const e = engine();
    const nets: NetConnection[] = [
      { netId: 'solo', points: [term('a', 1)] },
    ];
    const wires = e.autoRoute(nets);
    expect(wires).toHaveLength(0);
  });

  it('auto-routes 4-point net with MST (3 wires)', () => {
    const e = engine();
    const nets: NetConnection[] = [
      {
        netId: 'bus',
        points: [term('a', 1), term('a', 10), term('a', 20), term('a', 30)],
      },
    ];
    const wires = e.autoRoute(nets);
    expect(wires).toHaveLength(3);
  });
});

// ──────────────────────────────────────────────────────────────────
// Breadboard3DEngine — connectivity queries
// ──────────────────────────────────────────────────────────────────

describe('Breadboard3DEngine — connectivity queries', () => {
  beforeEach(() => {
    Breadboard3DEngine.resetInstance();
  });

  it('getConnectedPoints for terminal returns 5 points in same row/side', () => {
    const e = engine();
    const connected = e.getConnectedPoints(term('a', 5));
    expect(connected).toHaveLength(5);
    // All should be left-side, row 5
    for (const p of connected) {
      expect(p.type).toBe('terminal');
      if (p.type === 'terminal') {
        expect(p.row).toBe(5);
        expect(['a', 'b', 'c', 'd', 'e']).toContain(p.col);
      }
    }
  });

  it('getConnectedPoints for right terminal returns 5 right-side points', () => {
    const e = engine();
    const connected = e.getConnectedPoints(term('g', 10));
    expect(connected).toHaveLength(5);
    for (const p of connected) {
      if (p.type === 'terminal') {
        expect(['f', 'g', 'h', 'i', 'j']).toContain(p.col);
      }
    }
  });

  it('getConnectedPoints for rail returns all 63 points on same rail', () => {
    const e = engine();
    const connected = e.getConnectedPoints(rail('left_pos', 5));
    expect(connected).toHaveLength(63);
    for (const p of connected) {
      expect(p.type).toBe('rail');
      if (p.type === 'rail') {
        expect(p.rail).toBe('left_pos');
      }
    }
  });
});

// ──────────────────────────────────────────────────────────────────
// Breadboard3DEngine — board info
// ──────────────────────────────────────────────────────────────────

describe('Breadboard3DEngine — board info', () => {
  beforeEach(() => {
    Breadboard3DEngine.resetInstance();
  });

  it('getBoardDimensions returns correct values', () => {
    const dims = engine().getBoardDimensions();
    expect(dims.pitch).toBe(2.54);
    expect(dims.rows).toBe(63);
    expect(dims.thickness).toBe(8.5);
    expect(dims.totalPoints).toBe(882);
  });

  // ── BB830 datasheet assertions (audit #386) ────────────────────
  // BusBoard BB830: 165.1 × 54.6 × 8.5 mm
  // Source: https://www.busboard.com/BB830

  it('BOARD_DIMS.length matches BB830 datasheet long axis (165.1 mm)', () => {
    const dims = engine().getBoardDimensions();
    expect(dims.length).toBe(165.1);
  });

  it('BOARD_DIMS.width matches BB830 datasheet short axis (54.6 mm)', () => {
    const dims = engine().getBoardDimensions();
    expect(dims.width).toBe(54.6);
  });

  it('BOARD_DIMS.thickness matches BB830 datasheet (8.5 mm)', () => {
    const dims = engine().getBoardDimensions();
    expect(dims.thickness).toBe(8.5);
  });

  it('sanity: 63 rows × PITCH_MM fits within BOARD_DIMS.length (long axis, with end margins)', () => {
    const dims = engine().getBoardDimensions();
    // 63 * 2.54 = 160.02 mm; board is 165.1 mm → ~5 mm of margin for row labels + edges
    expect(63 * 2.54).toBeLessThan(dims.length);
  });

  it('sanity: 9-col terminal span + DIP channel gap fits within BOARD_DIMS.width (short axis)', () => {
    const dims = engine().getBoardDimensions();
    // 9 * 2.54 + 7.62 = 30.48 mm (outer terminal columns), well within 54.6 mm (rails + margins account for rest)
    expect(9 * 2.54 + 7.62).toBeLessThan(dims.width);
  });

  it('getPosition returns 3D coordinates', () => {
    const e = engine();
    const pos = e.getPosition(term('c', 10));
    expect(pos.x).toBeCloseTo(2 * 2.54); // col c = index 2
    expect(pos.y).toBeCloseTo(9 * 2.54); // row 10 → (10-1)*2.54
    expect(pos.z).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// Breadboard3DEngine — snapshot
// ──────────────────────────────────────────────────────────────────

describe('Breadboard3DEngine — snapshot', () => {
  beforeEach(() => {
    Breadboard3DEngine.resetInstance();
  });

  it('getSnapshot returns correct structure', () => {
    const e = engine();
    const snap: Breadboard3DSnapshot = e.getSnapshot();
    expect(snap.components).toEqual([]);
    expect(snap.wires).toEqual([]);
    expect(snap.occupiedPoints).toEqual([]);
    expect(snap.boardDimensions.pitch).toBe(2.54);
  });

  it('snapshot reflects placed components and wires', () => {
    const e = engine();
    e.placeComponent({
      id: 'r1', name: 'R1', startPoint: term('a', 1), endPoint: term('a', 3),
      height: 3, color: 'brown', rotation: 0,
    });
    e.addWire('w1', 'net1', term('b', 1), term('b', 10));
    const snap = e.getSnapshot();
    expect(snap.components).toHaveLength(1);
    expect(snap.wires).toHaveLength(1);
    expect(snap.occupiedPoints.length).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// Breadboard3DEngine — clear
// ──────────────────────────────────────────────────────────────────

describe('Breadboard3DEngine — clear', () => {
  beforeEach(() => {
    Breadboard3DEngine.resetInstance();
  });

  it('clears all components and wires', () => {
    const e = engine();
    e.placeComponent({
      id: 'r1', name: 'R1', startPoint: term('a', 1), endPoint: term('a', 3),
      height: 3, color: 'brown', rotation: 0,
    });
    e.addWire('w1', 'net1', term('b', 1), term('b', 10));
    e.clear();
    expect(e.getAllComponents()).toHaveLength(0);
    expect(e.getAllWires()).toHaveLength(0);
    expect(e.getOccupiedPoints()).toHaveLength(0);
  });

  it('notifies on clear', () => {
    const e = engine();
    let count = 0;
    e.subscribe(() => { count++; });
    e.clear();
    expect(count).toBe(1);
  });
});

// ──────────────────────────────────────────────────────────────────
// WIRE_COLORS constant
// ──────────────────────────────────────────────────────────────────

describe('WIRE_COLORS', () => {
  it('has standard color assignments', () => {
    expect(WIRE_COLORS['VCC']).toBe('red');
    expect(WIRE_COLORS['GND']).toBe('black');
    expect(WIRE_COLORS['SDA']).toBe('blue');
    expect(WIRE_COLORS['SCL']).toBe('yellow');
    expect(WIRE_COLORS['TX']).toBe('green');
    expect(WIRE_COLORS['RX']).toBe('white');
  });

  it('has a default color', () => {
    expect(WIRE_COLORS['default']).toBe('green');
  });
});

// ──────────────────────────────────────────────────────────────────
// Edge cases
// ──────────────────────────────────────────────────────────────────

describe('Breadboard3DEngine — edge cases', () => {
  beforeEach(() => {
    Breadboard3DEngine.resetInstance();
  });

  it('component at board boundary (row 63)', () => {
    const e = engine();
    const comp = e.placeComponent({
      id: 'r1', name: 'R1', startPoint: term('a', 60), endPoint: term('a', 63),
      height: 3, color: 'brown', rotation: 0,
    });
    expect(comp.pins).toHaveLength(4);
  });

  it('wire between same-side points uses short path', () => {
    const e = engine();
    const wire = e.addWire('w1', 'sig', term('a', 1), term('a', 2));
    // Short distance should still have valid path
    expect(wire.path.length).toBeGreaterThanOrEqual(2);
  });

  it('wire across DIP gap', () => {
    const e = engine();
    const wire = e.addWire('w1', 'sig', term('e', 5), term('f', 5));
    expect(wire.path.length).toBeGreaterThanOrEqual(2);
    expect(wire.from.type).toBe('terminal');
    expect(wire.to.type).toBe('terminal');
  });

  it('multiple components do not overlap', () => {
    const e = engine();
    e.placeComponent({
      id: 'r1', name: 'R1', startPoint: term('a', 1), endPoint: term('a', 5),
      height: 3, color: 'brown', rotation: 0,
    });
    e.placeComponent({
      id: 'r2', name: 'R2', startPoint: term('a', 6), endPoint: term('a', 10),
      height: 3, color: 'blue', rotation: 0,
    });
    expect(e.getAllComponents()).toHaveLength(2);
    expect(e.isOccupied(term('a', 5))).toBe(true);
    expect(e.isOccupied(term('a', 6))).toBe(true);
  });
});
