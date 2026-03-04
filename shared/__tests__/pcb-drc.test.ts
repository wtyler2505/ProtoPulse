import { describe, it, expect, vi } from 'vitest';
import type { DRCViolation } from '../component-types';
import type { PcbTrace, PcbVia, PcbPad, PcbBoardOutline, PcbDrcRuleSet, NetClassRules, PcbDrcInput } from '../drc-engine';
import {
  checkTraceClearance,
  checkTraceWidth,
  checkViaDrill,
  checkViaAnnularRing,
  checkPadClearance,
  checkBoardEdgeClearance,
  runPcbDrc,
  pointToSegmentDistance,
  segmentToSegmentDistance,
  pointToPolygonDistance,
  MANUFACTURER_PRESETS,
  DEFAULT_NET_CLASSES,
} from '../drc-engine';

// Mock nanoid for deterministic test IDs
vi.mock('nanoid', () => ({
  nanoid: (() => {
    let counter = 0;
    return () => `pcb-test-id-${counter++}`;
  })(),
}));

// =============================================================================
// Helpers
// =============================================================================

function makeTrace(
  id: string,
  netId: string,
  layer: string,
  width: number,
  points: Array<{ x: number; y: number }>,
): PcbTrace {
  return { id, netId, layer, width, points };
}

function makeVia(
  id: string,
  netId: string,
  x: number,
  y: number,
  drillDiameter: number,
  outerDiameter: number,
): PcbVia {
  return { id, netId, x, y, drillDiameter, outerDiameter };
}

function makePad(
  id: string,
  netId: string,
  instanceId: string,
  x: number,
  y: number,
  width: number,
  height: number,
): PcbPad {
  return { id, netId, instanceId, x, y, width, height };
}

const BASIC_RULES: PcbDrcRuleSet = {
  traceClearance: 8,
  traceWidthMin: 8,
  traceWidthMax: 250,
  viaDrillMin: 12,
  viaAnnularRing: 6,
  padClearance: 8,
  silkClearance: 6,
  boardEdgeClearance: 15,
  copperPourClearance: 10,
};

const STANDARD_RULES: PcbDrcRuleSet = {
  traceClearance: 6,
  traceWidthMin: 6,
  traceWidthMax: 250,
  viaDrillMin: 10,
  viaAnnularRing: 5,
  padClearance: 6,
  silkClearance: 5,
  boardEdgeClearance: 10,
  copperPourClearance: 8,
};

// A rectangular board outline: 1000x1000 mils centered at (500, 500)
const BOARD_OUTLINE: PcbBoardOutline = {
  points: [
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
    { x: 1000, y: 1000 },
    { x: 0, y: 1000 },
  ],
};

// =============================================================================
// Geometry Helpers
// =============================================================================

describe('pointToSegmentDistance', () => {
  it('returns perpendicular distance when projection falls on segment', () => {
    // Point (5, 10) to segment (0,0)-(10,0). Perpendicular distance = 10.
    const dist = pointToSegmentDistance(5, 10, 0, 0, 10, 0);
    expect(dist).toBeCloseTo(10, 5);
  });

  it('returns endpoint distance when projection falls outside segment', () => {
    // Point (15, 0) to segment (0,0)-(10,0). Closest is endpoint (10,0), distance = 5.
    const dist = pointToSegmentDistance(15, 0, 0, 0, 10, 0);
    expect(dist).toBeCloseTo(5, 5);
  });

  it('returns 0 when point is on the segment', () => {
    const dist = pointToSegmentDistance(5, 0, 0, 0, 10, 0);
    expect(dist).toBeCloseTo(0, 5);
  });

  it('handles degenerate segment (zero length)', () => {
    const dist = pointToSegmentDistance(3, 4, 0, 0, 0, 0);
    expect(dist).toBeCloseTo(5, 5); // sqrt(9+16)
  });

  it('handles diagonal segments', () => {
    // Point (0, 5) to segment (0,0)-(10,10). Perpendicular distance = 5/sqrt(2) ≈ 3.535
    const dist = pointToSegmentDistance(0, 5, 0, 0, 10, 10);
    expect(dist).toBeCloseTo(Math.sqrt(12.5), 3);
  });
});

describe('segmentToSegmentDistance', () => {
  it('returns 0 for intersecting segments', () => {
    // Crossing: (0,0)-(10,10) and (0,10)-(10,0)
    const dist = segmentToSegmentDistance(0, 0, 10, 10, 0, 10, 10, 0);
    expect(dist).toBe(0);
  });

  it('returns correct distance for parallel segments', () => {
    // (0,0)-(10,0) and (0,5)-(10,5), parallel 5 apart
    const dist = segmentToSegmentDistance(0, 0, 10, 0, 0, 5, 10, 5);
    expect(dist).toBeCloseTo(5, 5);
  });

  it('returns endpoint-based distance for non-overlapping parallel segments', () => {
    // (0,0)-(5,0) and (10,3)-(20,3), closest is (5,0) to (10,3)
    const dist = segmentToSegmentDistance(0, 0, 5, 0, 10, 3, 20, 3);
    expect(dist).toBeCloseTo(Math.sqrt(25 + 9), 3); // sqrt(34) ≈ 5.831
  });

  it('returns correct distance for perpendicular non-intersecting segments', () => {
    // (0,0)-(10,0) and (5,3)-(5,10)
    const dist = segmentToSegmentDistance(0, 0, 10, 0, 5, 3, 5, 10);
    expect(dist).toBeCloseTo(3, 5);
  });
});

describe('pointToPolygonDistance', () => {
  const square: Array<{ x: number; y: number }> = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];

  it('returns 0 for point on polygon edge', () => {
    const dist = pointToPolygonDistance(50, 0, square);
    expect(dist).toBeCloseTo(0, 5);
  });

  it('returns correct distance for point outside polygon', () => {
    // Point (50, -10) is 10 units below the bottom edge
    const dist = pointToPolygonDistance(50, -10, square);
    expect(dist).toBeCloseTo(10, 5);
  });

  it('returns distance to nearest edge for point inside polygon', () => {
    // Point (5, 50) is 5 units from the left edge
    const dist = pointToPolygonDistance(5, 50, square);
    expect(dist).toBeCloseTo(5, 5);
  });

  it('returns Infinity for empty polygon', () => {
    const dist = pointToPolygonDistance(0, 0, []);
    expect(dist).toBe(Infinity);
  });

  it('returns distance for single-point polygon', () => {
    const dist = pointToPolygonDistance(3, 4, [{ x: 0, y: 0 }]);
    expect(dist).toBeCloseTo(5, 5);
  });
});

// =============================================================================
// Trace Clearance
// =============================================================================

describe('checkTraceClearance', () => {
  it('no violation when parallel traces have sufficient clearance', () => {
    const traces = [
      makeTrace('t1', 'GND', 'F.Cu', 6, [{ x: 0, y: 0 }, { x: 100, y: 0 }]),
      makeTrace('t2', 'VCC', 'F.Cu', 6, [{ x: 0, y: 30 }, { x: 100, y: 30 }]),
    ];
    // Edge distance = 30 - 6/2 - 6/2 = 24, well above 8 mil
    const violations = checkTraceClearance(traces, BASIC_RULES);
    expect(violations).toHaveLength(0);
  });

  it('detects traces too close together', () => {
    const traces = [
      makeTrace('t1', 'GND', 'F.Cu', 6, [{ x: 0, y: 0 }, { x: 100, y: 0 }]),
      makeTrace('t2', 'VCC', 'F.Cu', 6, [{ x: 0, y: 10 }, { x: 100, y: 10 }]),
    ];
    // Edge distance = 10 - 3 - 3 = 4, below 8 mil min
    const violations = checkTraceClearance(traces, BASIC_RULES);
    expect(violations).toHaveLength(1);
    expect(violations[0].ruleType).toBe('trace_clearance');
    expect(violations[0].severity).toBe('error');
    expect(violations[0].actual).toBeLessThan(8);
    expect(violations[0].required).toBe(8);
    expect(violations[0].message).toContain('GND');
    expect(violations[0].message).toContain('VCC');
  });

  it('detects crossing traces on same layer', () => {
    const traces = [
      makeTrace('t1', 'NET1', 'F.Cu', 6, [{ x: 0, y: 50 }, { x: 100, y: 50 }]),
      makeTrace('t2', 'NET2', 'F.Cu', 6, [{ x: 50, y: 0 }, { x: 50, y: 100 }]),
    ];
    // Crossing = 0 distance between centerlines, edge distance is negative
    const violations = checkTraceClearance(traces, BASIC_RULES);
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0].ruleType).toBe('trace_clearance');
  });

  it('no violation for traces on different layers', () => {
    const traces = [
      makeTrace('t1', 'GND', 'F.Cu', 6, [{ x: 0, y: 0 }, { x: 100, y: 0 }]),
      makeTrace('t2', 'VCC', 'B.Cu', 6, [{ x: 0, y: 5 }, { x: 100, y: 5 }]),
    ];
    const violations = checkTraceClearance(traces, BASIC_RULES);
    expect(violations).toHaveLength(0);
  });

  it('no violation for traces on the same net', () => {
    const traces = [
      makeTrace('t1', 'GND', 'F.Cu', 6, [{ x: 0, y: 0 }, { x: 100, y: 0 }]),
      makeTrace('t2', 'GND', 'F.Cu', 6, [{ x: 0, y: 5 }, { x: 100, y: 5 }]),
    ];
    const violations = checkTraceClearance(traces, BASIC_RULES);
    expect(violations).toHaveLength(0);
  });

  it('uses net-class clearance override when larger', () => {
    const traces = [
      makeTrace('t1', 'GND', 'F.Cu', 6, [{ x: 0, y: 0 }, { x: 100, y: 0 }]),
      makeTrace('t2', 'VCC', 'F.Cu', 6, [{ x: 0, y: 16 }, { x: 100, y: 16 }]),
    ];
    // Edge distance = 16 - 3 - 3 = 10, above 8mil base but below 12mil net-class
    const netClasses = new Map<string, NetClassRules>();
    netClasses.set('VCC', { name: 'power', traceWidth: 20, clearance: 12, viaDrill: 16, viaAnnular: 8 });

    const violations = checkTraceClearance(traces, BASIC_RULES, netClasses);
    expect(violations).toHaveLength(1);
    expect(violations[0].required).toBe(12);
  });
});

// =============================================================================
// Trace Width
// =============================================================================

describe('checkTraceWidth', () => {
  it('no violation for trace at minimum width', () => {
    const traces = [makeTrace('t1', 'NET1', 'F.Cu', 8, [{ x: 0, y: 0 }, { x: 100, y: 0 }])];
    const violations = checkTraceWidth(traces, BASIC_RULES);
    expect(violations).toHaveLength(0);
  });

  it('detects trace below minimum width', () => {
    const traces = [makeTrace('t1', 'NET1', 'F.Cu', 5, [{ x: 0, y: 0 }, { x: 100, y: 0 }])];
    const violations = checkTraceWidth(traces, BASIC_RULES);
    expect(violations).toHaveLength(1);
    expect(violations[0].ruleType).toBe('trace_width_min');
    expect(violations[0].actual).toBe(5);
    expect(violations[0].required).toBe(8);
  });

  it('detects trace above maximum width', () => {
    const traces = [makeTrace('t1', 'NET1', 'F.Cu', 300, [{ x: 0, y: 0 }, { x: 100, y: 0 }])];
    const violations = checkTraceWidth(traces, BASIC_RULES);
    expect(violations).toHaveLength(1);
    expect(violations[0].ruleType).toBe('trace_width_max');
    expect(violations[0].severity).toBe('warning');
    expect(violations[0].actual).toBe(300);
    expect(violations[0].required).toBe(250);
  });

  it('uses net-class width override for minimum', () => {
    // Power net requires 20mil trace width
    const traces = [makeTrace('t1', 'VCC', 'F.Cu', 12, [{ x: 0, y: 0 }, { x: 100, y: 0 }])];
    const netClasses = new Map<string, NetClassRules>();
    netClasses.set('VCC', { name: 'power', traceWidth: 20, clearance: 10, viaDrill: 16, viaAnnular: 8 });

    const violations = checkTraceWidth(traces, BASIC_RULES, netClasses);
    expect(violations).toHaveLength(1);
    expect(violations[0].ruleType).toBe('trace_width_min');
    expect(violations[0].required).toBe(20);
  });

  it('no violation for trace above net-class minimum', () => {
    const traces = [makeTrace('t1', 'VCC', 'F.Cu', 24, [{ x: 0, y: 0 }, { x: 100, y: 0 }])];
    const netClasses = new Map<string, NetClassRules>();
    netClasses.set('VCC', { name: 'power', traceWidth: 20, clearance: 10, viaDrill: 16, viaAnnular: 8 });

    const violations = checkTraceWidth(traces, BASIC_RULES, netClasses);
    expect(violations).toHaveLength(0);
  });

  it('detects multiple width violations across traces', () => {
    const traces = [
      makeTrace('t1', 'NET1', 'F.Cu', 3, [{ x: 0, y: 0 }, { x: 50, y: 0 }]),
      makeTrace('t2', 'NET2', 'F.Cu', 5, [{ x: 0, y: 20 }, { x: 50, y: 20 }]),
      makeTrace('t3', 'NET3', 'F.Cu', 10, [{ x: 0, y: 40 }, { x: 50, y: 40 }]), // OK
    ];
    const violations = checkTraceWidth(traces, BASIC_RULES);
    expect(violations).toHaveLength(2);
    expect(violations.every((v) => v.ruleType === 'trace_width_min')).toBe(true);
  });
});

// =============================================================================
// Via Drill
// =============================================================================

describe('checkViaDrill', () => {
  it('no violation for via at minimum drill', () => {
    const vias = [makeVia('v1', 'NET1', 50, 50, 12, 24)];
    const violations = checkViaDrill(vias, BASIC_RULES);
    expect(violations).toHaveLength(0);
  });

  it('detects via drill too small', () => {
    const vias = [makeVia('v1', 'NET1', 50, 50, 8, 20)];
    const violations = checkViaDrill(vias, BASIC_RULES);
    expect(violations).toHaveLength(1);
    expect(violations[0].ruleType).toBe('via_drill_min');
    expect(violations[0].actual).toBe(8);
    expect(violations[0].required).toBe(12);
  });

  it('uses net-class via drill override', () => {
    const vias = [makeVia('v1', 'SIG', 50, 50, 9, 20)];
    const netClasses = new Map<string, NetClassRules>();
    netClasses.set('SIG', { name: 'high_speed', traceWidth: 6, clearance: 8, viaDrill: 8, viaAnnular: 4 });

    // Drill 9 >= net-class min 8, no violation
    const violations = checkViaDrill(vias, BASIC_RULES, netClasses);
    expect(violations).toHaveLength(0);
  });

  it('detects via drill below net-class minimum', () => {
    const vias = [makeVia('v1', 'PWR', 50, 50, 14, 30)];
    const netClasses = new Map<string, NetClassRules>();
    netClasses.set('PWR', { name: 'power', traceWidth: 20, clearance: 10, viaDrill: 16, viaAnnular: 8 });

    const violations = checkViaDrill(vias, BASIC_RULES, netClasses);
    expect(violations).toHaveLength(1);
    expect(violations[0].required).toBe(16);
  });

  it('detects multiple via drill violations', () => {
    const vias = [
      makeVia('v1', 'NET1', 50, 50, 5, 16),
      makeVia('v2', 'NET2', 100, 100, 8, 20),
      makeVia('v3', 'NET3', 150, 150, 14, 28), // OK (12 mil min)
    ];
    const violations = checkViaDrill(vias, BASIC_RULES);
    expect(violations).toHaveLength(2);
  });
});

// =============================================================================
// Via Annular Ring
// =============================================================================

describe('checkViaAnnularRing', () => {
  it('no violation when annular ring meets minimum', () => {
    // (24 - 12) / 2 = 6 mil, meets 6 mil min
    const vias = [makeVia('v1', 'NET1', 50, 50, 12, 24)];
    const violations = checkViaAnnularRing(vias, BASIC_RULES);
    expect(violations).toHaveLength(0);
  });

  it('detects annular ring below minimum', () => {
    // (18 - 12) / 2 = 3 mil, below 6 mil min
    const vias = [makeVia('v1', 'NET1', 50, 50, 12, 18)];
    const violations = checkViaAnnularRing(vias, BASIC_RULES);
    expect(violations).toHaveLength(1);
    expect(violations[0].ruleType).toBe('via_annular_ring');
    expect(violations[0].actual).toBe(3);
    expect(violations[0].required).toBe(6);
  });

  it('calculates annular ring correctly: (outer - drill) / 2', () => {
    // (20 - 10) / 2 = 5 mil, below 6 mil min
    const vias = [makeVia('v1', 'NET1', 50, 50, 10, 20)];
    const violations = checkViaAnnularRing(vias, BASIC_RULES);
    expect(violations).toHaveLength(1);
    expect(violations[0].actual).toBe(5);
  });

  it('uses net-class annular ring override', () => {
    // (20 - 12) / 2 = 4 mil. Base rule 6mil would fail, but high_speed class requires only 4 mil
    const vias = [makeVia('v1', 'HS', 50, 50, 12, 20)];
    const netClasses = new Map<string, NetClassRules>();
    netClasses.set('HS', { name: 'high_speed', traceWidth: 6, clearance: 8, viaDrill: 8, viaAnnular: 4 });

    const violations = checkViaAnnularRing(vias, BASIC_RULES, netClasses);
    expect(violations).toHaveLength(0);
  });

  it('no violation when annular ring exactly equals minimum', () => {
    // (24 - 12) / 2 = 6.0 mil, equals 6 mil min
    const vias = [makeVia('v1', 'NET1', 50, 50, 12, 24)];
    const violations = checkViaAnnularRing(vias, BASIC_RULES);
    expect(violations).toHaveLength(0);
  });
});

// =============================================================================
// Pad Clearance
// =============================================================================

describe('checkPadClearance', () => {
  it('no violation for pads with sufficient spacing', () => {
    const pads = [
      makePad('p1', 'GND', 'U1', 0, 0, 20, 20),
      makePad('p2', 'VCC', 'U1', 50, 0, 20, 20),
    ];
    // Edge-to-edge: 50 - 10 - 10 = 30 mil, above 8 mil
    const violations = checkPadClearance(pads, BASIC_RULES);
    expect(violations).toHaveLength(0);
  });

  it('detects pads too close together', () => {
    const pads = [
      makePad('p1', 'GND', 'U1', 0, 0, 20, 20),
      makePad('p2', 'VCC', 'U1', 22, 0, 20, 20),
    ];
    // Edge-to-edge: 22 - 10 - 10 = 2 mil, below 8 mil
    const violations = checkPadClearance(pads, BASIC_RULES);
    expect(violations).toHaveLength(1);
    expect(violations[0].ruleType).toBe('pad_clearance');
    expect(violations[0].actual).toBe(2);
    expect(violations[0].required).toBe(8);
  });

  it('exempts pads on the same net from clearance check', () => {
    const pads = [
      makePad('p1', 'GND', 'U1', 0, 0, 20, 20),
      makePad('p2', 'GND', 'U2', 22, 0, 20, 20),
    ];
    const violations = checkPadClearance(pads, BASIC_RULES);
    expect(violations).toHaveLength(0);
  });

  it('uses net-class clearance override for pads', () => {
    const pads = [
      makePad('p1', 'GND', 'U1', 0, 0, 20, 20),
      makePad('p2', 'VCC', 'U1', 30, 0, 20, 20),
    ];
    // Edge-to-edge: 30 - 10 - 10 = 10 mil, above 8mil base but below 12mil net-class
    const netClasses = new Map<string, NetClassRules>();
    netClasses.set('VCC', { name: 'power', traceWidth: 20, clearance: 12, viaDrill: 16, viaAnnular: 8 });

    const violations = checkPadClearance(pads, BASIC_RULES, netClasses);
    expect(violations).toHaveLength(1);
    expect(violations[0].required).toBe(12);
  });
});

// =============================================================================
// Board Edge Clearance
// =============================================================================

describe('checkBoardEdgeClearance', () => {
  it('detects trace near board edge within clearance', () => {
    const traces = [
      makeTrace('t1', 'NET1', 'F.Cu', 6, [{ x: 5, y: 500 }, { x: 5, y: 600 }]),
    ];
    // Point (5, 500) to left edge (x=0): distance = 5, minus half width 3 = 2 mil, below 15 mil
    const violations = checkBoardEdgeClearance(traces, [], [], BOARD_OUTLINE, BASIC_RULES);
    expect(violations).toHaveLength(1);
    expect(violations[0].ruleType).toBe('board_edge_clearance');
    expect(violations[0].message).toContain('Trace');
  });

  it('no violation for trace far from board edge', () => {
    const traces = [
      makeTrace('t1', 'NET1', 'F.Cu', 6, [{ x: 500, y: 500 }, { x: 600, y: 500 }]),
    ];
    const violations = checkBoardEdgeClearance(traces, [], [], BOARD_OUTLINE, BASIC_RULES);
    expect(violations).toHaveLength(0);
  });

  it('detects pad near board edge', () => {
    const pads = [makePad('p1', 'NET1', 'U1', 5, 500, 10, 10)];
    // Distance to left edge: 5 - 5 (pad radius) = 0, below 15 mil
    const violations = checkBoardEdgeClearance([], pads, [], BOARD_OUTLINE, BASIC_RULES);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('Pad');
  });

  it('detects via near board edge', () => {
    const vias = [makeVia('v1', 'NET1', 8, 500, 12, 24)];
    // Distance to left edge: 8 - 12 (outer/2) = -4, below 15 mil
    const violations = checkBoardEdgeClearance([], [], vias, BOARD_OUTLINE, BASIC_RULES);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('Via');
  });

  it('returns no violations for outline with fewer than 3 points', () => {
    const traces = [makeTrace('t1', 'NET1', 'F.Cu', 6, [{ x: 1, y: 1 }])];
    const outline: PcbBoardOutline = { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] };
    const violations = checkBoardEdgeClearance(traces, [], [], outline, BASIC_RULES);
    expect(violations).toHaveLength(0);
  });
});

// =============================================================================
// Manufacturer Presets
// =============================================================================

describe('MANUFACTURER_PRESETS', () => {
  it('basic preset has 8 mil trace clearance', () => {
    expect(MANUFACTURER_PRESETS.basic.rules.traceClearance).toBe(8);
    expect(MANUFACTURER_PRESETS.basic.rules.traceWidthMin).toBe(8);
  });

  it('standard preset has 6 mil trace/space', () => {
    expect(MANUFACTURER_PRESETS.standard.rules.traceClearance).toBe(6);
    expect(MANUFACTURER_PRESETS.standard.rules.traceWidthMin).toBe(6);
  });

  it('advanced preset has 4 mil trace/space', () => {
    expect(MANUFACTURER_PRESETS.advanced.rules.traceClearance).toBe(4);
    expect(MANUFACTURER_PRESETS.advanced.rules.traceWidthMin).toBe(4);
  });

  it('basic preset is the most conservative', () => {
    const basic = MANUFACTURER_PRESETS.basic.rules;
    const standard = MANUFACTURER_PRESETS.standard.rules;
    const advanced = MANUFACTURER_PRESETS.advanced.rules;

    expect(basic.traceClearance).toBeGreaterThan(standard.traceClearance);
    expect(standard.traceClearance).toBeGreaterThan(advanced.traceClearance);
    expect(basic.traceWidthMin).toBeGreaterThan(standard.traceWidthMin);
    expect(standard.traceWidthMin).toBeGreaterThan(advanced.traceWidthMin);
  });

  it('all presets have the same max trace width', () => {
    expect(MANUFACTURER_PRESETS.basic.rules.traceWidthMax).toBe(250);
    expect(MANUFACTURER_PRESETS.standard.rules.traceWidthMax).toBe(250);
    expect(MANUFACTURER_PRESETS.advanced.rules.traceWidthMax).toBe(250);
  });

  it('each preset has a name and description', () => {
    for (const key of Object.keys(MANUFACTURER_PRESETS)) {
      const preset = MANUFACTURER_PRESETS[key];
      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset.description.length).toBeGreaterThan(0);
    }
  });
});

// =============================================================================
// Net Classes
// =============================================================================

describe('DEFAULT_NET_CLASSES', () => {
  it('has 4 default net classes', () => {
    expect(DEFAULT_NET_CLASSES).toHaveLength(4);
  });

  it('includes default, power, signal, and high_speed classes', () => {
    const names = DEFAULT_NET_CLASSES.map((nc) => nc.name);
    expect(names).toContain('default');
    expect(names).toContain('power');
    expect(names).toContain('signal');
    expect(names).toContain('high_speed');
  });

  it('power net class has the widest traces', () => {
    const power = DEFAULT_NET_CLASSES.find((nc) => nc.name === 'power');
    const signal = DEFAULT_NET_CLASSES.find((nc) => nc.name === 'signal');
    expect(power).toBeDefined();
    expect(signal).toBeDefined();
    expect(power!.traceWidth).toBeGreaterThan(signal!.traceWidth);
  });

  it('high_speed net class has tighter trace width but wider clearance than signal', () => {
    const highSpeed = DEFAULT_NET_CLASSES.find((nc) => nc.name === 'high_speed');
    const signal = DEFAULT_NET_CLASSES.find((nc) => nc.name === 'signal');
    expect(highSpeed).toBeDefined();
    expect(signal).toBeDefined();
    expect(highSpeed!.traceWidth).toBeLessThan(signal!.traceWidth);
    expect(highSpeed!.clearance).toBeGreaterThan(signal!.clearance);
  });

  it('default net class is applied when no specific class exists', () => {
    // Verify that running DRC without net-class map uses base rules
    const traces = [makeTrace('t1', 'UNKNOWN_NET', 'F.Cu', 5, [{ x: 0, y: 0 }, { x: 100, y: 0 }])];
    const violations = checkTraceWidth(traces, BASIC_RULES);
    expect(violations).toHaveLength(1);
    expect(violations[0].required).toBe(8); // Base rule, not any net-class
  });
});

// =============================================================================
// Full PCB DRC Run
// =============================================================================

describe('runPcbDrc', () => {
  it('returns no violations for a clean board', () => {
    const data: PcbDrcInput = {
      traces: [
        makeTrace('t1', 'NET1', 'F.Cu', 10, [{ x: 100, y: 100 }, { x: 200, y: 100 }]),
        makeTrace('t2', 'NET2', 'F.Cu', 10, [{ x: 100, y: 200 }, { x: 200, y: 200 }]),
      ],
      vias: [makeVia('v1', 'NET1', 300, 300, 12, 24)],
      pads: [
        makePad('p1', 'NET1', 'U1', 500, 500, 20, 20),
        makePad('p2', 'NET2', 'U1', 600, 500, 20, 20),
      ],
      outline: BOARD_OUTLINE,
    };

    const violations = runPcbDrc(data, BASIC_RULES);
    expect(violations).toHaveLength(0);
  });

  it('reports multiple violation types in a single run', () => {
    const data: PcbDrcInput = {
      traces: [
        // Clearance violation: too close
        makeTrace('t1', 'GND', 'F.Cu', 6, [{ x: 100, y: 100 }, { x: 200, y: 100 }]),
        makeTrace('t2', 'VCC', 'F.Cu', 6, [{ x: 100, y: 108 }, { x: 200, y: 108 }]),
        // Width violation: too narrow
        makeTrace('t3', 'NET3', 'F.Cu', 3, [{ x: 300, y: 300 }, { x: 400, y: 300 }]),
      ],
      vias: [
        // Drill too small
        makeVia('v1', 'NET1', 500, 500, 5, 16),
      ],
      pads: [],
    };

    const violations = runPcbDrc(data, BASIC_RULES);
    const ruleTypes = violations.map((v) => v.ruleType);
    expect(ruleTypes).toContain('trace_clearance');
    expect(ruleTypes).toContain('trace_width_min');
    expect(ruleTypes).toContain('via_drill_min');
  });

  it('applies net-class overrides in full DRC run', () => {
    const data: PcbDrcInput = {
      traces: [
        // 12mil wide trace on power net (needs 20mil per net class)
        makeTrace('t1', 'VCC', 'F.Cu', 12, [{ x: 500, y: 500 }, { x: 600, y: 500 }]),
      ],
      vias: [],
      pads: [],
    };

    const netClasses = new Map<string, NetClassRules>();
    netClasses.set('VCC', { name: 'power', traceWidth: 20, clearance: 10, viaDrill: 16, viaAnnular: 8 });

    const violations = runPcbDrc(data, BASIC_RULES, netClasses);
    expect(violations).toHaveLength(1);
    expect(violations[0].ruleType).toBe('trace_width_min');
    expect(violations[0].required).toBe(20);
  });

  it('skips board edge check when no outline is provided', () => {
    const data: PcbDrcInput = {
      traces: [
        // This trace would violate edge clearance if there were an outline
        makeTrace('t1', 'NET1', 'F.Cu', 6, [{ x: 1, y: 1 }, { x: 100, y: 1 }]),
      ],
      vias: [],
      pads: [],
    };

    const violations = runPcbDrc(data, BASIC_RULES);
    expect(violations.filter((v) => v.ruleType === 'board_edge_clearance')).toHaveLength(0);
  });

  it('returns empty array for empty board', () => {
    const data: PcbDrcInput = {
      traces: [],
      vias: [],
      pads: [],
    };
    const violations = runPcbDrc(data, BASIC_RULES);
    expect(violations).toHaveLength(0);
  });

  it('all violations have view set to pcb', () => {
    const data: PcbDrcInput = {
      traces: [
        makeTrace('t1', 'GND', 'F.Cu', 3, [{ x: 100, y: 100 }, { x: 200, y: 100 }]),
      ],
      vias: [makeVia('v1', 'NET1', 500, 500, 5, 10)],
      pads: [],
    };

    const violations = runPcbDrc(data, BASIC_RULES);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.every((v) => v.view === 'pcb')).toBe(true);
  });

  it('all violations have non-empty shapeIds', () => {
    const data: PcbDrcInput = {
      traces: [
        makeTrace('t1', 'NET1', 'F.Cu', 3, [{ x: 100, y: 100 }, { x: 200, y: 100 }]),
      ],
      vias: [],
      pads: [],
    };
    const violations = runPcbDrc(data, BASIC_RULES);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.every((v) => v.shapeIds.length > 0)).toBe(true);
  });
});
