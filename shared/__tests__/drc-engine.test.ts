import { describe, it, expect, vi } from 'vitest';
import type { PartState, DRCRule, DRCViolation, Shape, Connector, RectShape, PathShape, CircleShape } from '../component-types';
import { runDRC, getDefaultDRCRules } from '../drc-engine';

// Mock nanoid to return deterministic IDs for test stability
vi.mock('nanoid', () => ({
  nanoid: (() => {
    let counter = 0;
    return () => `test-id-${counter++}`;
  })(),
}));

// =============================================================================
// Helpers
// =============================================================================

function makeRect(id: string, x: number, y: number, w: number, h: number, layer?: string): RectShape {
  return { id, type: 'rect', x, y, width: w, height: h, rotation: 0, layer };
}

function makePath(id: string, x: number, y: number, d: string, strokeWidth: number, layer?: string): PathShape {
  return { id, type: 'path', x, y, width: 10, height: 10, rotation: 0, d, style: { strokeWidth }, layer };
}

function makeCircle(id: string, cx: number, cy: number, r: number, layer?: string): CircleShape {
  return { id, type: 'circle', x: cx - r, y: cy - r, width: r * 2, height: r * 2, cx, cy, rotation: 0, layer };
}

function makeConnector(
  id: string,
  name: string,
  view: 'breadboard' | 'schematic' | 'pcb',
  x: number,
  y: number,
  padSpec?: Connector['padSpec'],
): Connector {
  return {
    id,
    name,
    connectorType: 'pad',
    shapeIds: {},
    terminalPositions: { [view]: { x, y } },
    padSpec,
  };
}

function makePartState(shapes: Shape[], connectors: Connector[], view: 'breadboard' | 'schematic' | 'pcb' = 'pcb'): PartState {
  const emptyView = { shapes: [] };
  return {
    meta: { title: 'Test', tags: [], mountingType: 'tht', properties: [] },
    connectors,
    buses: [],
    views: {
      breadboard: view === 'breadboard' ? { shapes } : emptyView,
      schematic: view === 'schematic' ? { shapes } : emptyView,
      pcb: view === 'pcb' ? { shapes } : emptyView,
    },
  };
}

// =============================================================================
// getDefaultDRCRules
// =============================================================================

describe('getDefaultDRCRules', () => {
  it('returns 11 default rules', () => {
    const rules = getDefaultDRCRules();
    expect(rules).toHaveLength(11);
  });

  it('includes all expected rule types', () => {
    const rules = getDefaultDRCRules();
    const types = rules.map(r => r.type);
    expect(types).toContain('min-clearance');
    expect(types).toContain('min-trace-width');
    expect(types).toContain('pad-size');
    expect(types).toContain('pin-spacing');
    expect(types).toContain('silk-overlap');
    expect(types).toContain('courtyard-overlap');
    expect(types).toContain('annular-ring');
    expect(types).toContain('thermal-relief');
    expect(types).toContain('trace-to-edge');
    expect(types).toContain('via-in-pad');
    expect(types).toContain('solder-mask');
  });

  it('all default rules are enabled', () => {
    const rules = getDefaultDRCRules();
    expect(rules.every(r => r.enabled)).toBe(true);
  });

  it('returns independent copies (not shared references)', () => {
    const a = getDefaultDRCRules();
    const b = getDefaultDRCRules();
    a[0].enabled = false;
    expect(b[0].enabled).toBe(true);
  });
});

// =============================================================================
// runDRC — min-clearance
// =============================================================================

describe('runDRC — min-clearance', () => {
  const clearanceRule: DRCRule = { type: 'min-clearance', params: { minClearance: 10 }, severity: 'error', enabled: true };

  it('detects two rectangles that are too close', () => {
    const shapes: Shape[] = [
      makeRect('a', 0, 0, 20, 20),
      makeRect('b', 25, 0, 20, 20), // gap = 5px, below 10px min
    ];
    const part = makePartState(shapes, []);
    const violations = runDRC(part, [clearanceRule], 'pcb');

    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0].ruleType).toBe('min-clearance');
    expect(violations[0].severity).toBe('error');
    expect(violations[0].actual).toBeLessThan(10);
  });

  it('no violations when shapes are far apart', () => {
    const shapes: Shape[] = [
      makeRect('a', 0, 0, 20, 20),
      makeRect('b', 50, 0, 20, 20), // gap = 30px, above 10px min
    ];
    const part = makePartState(shapes, []);
    const violations = runDRC(part, [clearanceRule], 'pcb');

    expect(violations).toHaveLength(0);
  });

  it('no violations for non-copper shapes on different layers', () => {
    const shapes: Shape[] = [
      makeRect('a', 0, 0, 20, 20, 'silk-front'),
      makeRect('b', 5, 0, 20, 20, 'silk-back'),
    ];
    const part = makePartState(shapes, []);
    const violations = runDRC(part, [clearanceRule], 'pcb');

    expect(violations).toHaveLength(0);
  });

  it('detects clearance violations on copper layers', () => {
    const shapes: Shape[] = [
      makeRect('a', 0, 0, 20, 20, 'copper-front'),
      makeRect('b', 25, 0, 20, 20, 'copper-front'), // gap = 5px
    ];
    const part = makePartState(shapes, []);
    const violations = runDRC(part, [clearanceRule], 'pcb');

    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0].ruleType).toBe('min-clearance');
  });

  it('no violation between shapes on different copper layers', () => {
    const shapes: Shape[] = [
      makeRect('a', 0, 0, 20, 20, 'copper-front'),
      makeRect('b', 5, 0, 20, 20, 'copper-back'), // close but different layers
    ];
    const part = makePartState(shapes, []);
    const violations = runDRC(part, [clearanceRule], 'pcb');

    expect(violations).toHaveLength(0);
  });
});

// =============================================================================
// runDRC — min-trace-width
// =============================================================================

describe('runDRC — min-trace-width', () => {
  const traceRule: DRCRule = { type: 'min-trace-width', params: { minWidth: 6 }, severity: 'error', enabled: true };

  it('detects thin trace below minimum', () => {
    const shapes: Shape[] = [makePath('p1', 0, 0, 'M0,0 L100,0', 3)];
    const part = makePartState(shapes, []);
    const violations = runDRC(part, [traceRule], 'pcb');

    expect(violations).toHaveLength(1);
    expect(violations[0].ruleType).toBe('min-trace-width');
    expect(violations[0].actual).toBe(3);
    expect(violations[0].required).toBe(6);
  });

  it('no violation for trace at minimum width', () => {
    const shapes: Shape[] = [makePath('p1', 0, 0, 'M0,0 L100,0', 6)];
    const part = makePartState(shapes, []);
    const violations = runDRC(part, [traceRule], 'pcb');

    expect(violations).toHaveLength(0);
  });

  it('no violation for trace above minimum width', () => {
    const shapes: Shape[] = [makePath('p1', 0, 0, 'M0,0 L100,0', 10)];
    const part = makePartState(shapes, []);
    const violations = runDRC(part, [traceRule], 'pcb');

    expect(violations).toHaveLength(0);
  });

  it('ignores non-path shapes', () => {
    const shapes: Shape[] = [makeRect('r1', 0, 0, 2, 2)]; // width 2 but not a path
    const part = makePartState(shapes, []);
    const violations = runDRC(part, [traceRule], 'pcb');

    expect(violations).toHaveLength(0);
  });

  it('detects multiple thin traces', () => {
    const shapes: Shape[] = [
      makePath('p1', 0, 0, 'M0,0 L50,0', 2),
      makePath('p2', 0, 20, 'M0,20 L50,20', 4),
      makePath('p3', 0, 40, 'M0,40 L50,40', 8), // OK
    ];
    const part = makePartState(shapes, []);
    const violations = runDRC(part, [traceRule], 'pcb');

    expect(violations).toHaveLength(2);
  });
});

// =============================================================================
// runDRC — pad-size
// =============================================================================

describe('runDRC — pad-size', () => {
  const padRule: DRCRule = { type: 'pad-size', params: { minPadDiameter: 40, minDrillDiameter: 20 }, severity: 'warning', enabled: true };

  it('detects pad below minimum diameter', () => {
    const connectors = [
      makeConnector('c1', 'pin1', 'pcb', 0, 0, { type: 'tht', shape: 'circle', diameter: 30, drill: 25 }),
    ];
    const part = makePartState([], connectors);
    const violations = runDRC(part, [padRule], 'pcb');

    expect(violations.some(v => v.ruleType === 'pad-size' && v.actual === 30)).toBe(true);
  });

  it('detects drill below minimum diameter', () => {
    const connectors = [
      makeConnector('c1', 'pin1', 'pcb', 0, 0, { type: 'tht', shape: 'circle', diameter: 50, drill: 15 }),
    ];
    const part = makePartState([], connectors);
    const violations = runDRC(part, [padRule], 'pcb');

    expect(violations.some(v => v.ruleType === 'pad-size' && v.actual === 15)).toBe(true);
  });

  it('no violations for properly sized pads', () => {
    const connectors = [
      makeConnector('c1', 'pin1', 'pcb', 0, 0, { type: 'tht', shape: 'circle', diameter: 50, drill: 25 }),
    ];
    const part = makePartState([], connectors);
    const violations = runDRC(part, [padRule], 'pcb');

    expect(violations).toHaveLength(0);
  });

  it('ignores connectors without padSpec', () => {
    const connectors = [makeConnector('c1', 'pin1', 'pcb', 0, 0)];
    const part = makePartState([], connectors);
    const violations = runDRC(part, [padRule], 'pcb');

    expect(violations).toHaveLength(0);
  });

  it('only checks drill size for tht pads, not smd', () => {
    const connectors = [
      makeConnector('c1', 'pin1', 'pcb', 0, 0, { type: 'smd', shape: 'rect', diameter: 50, drill: 10 }),
    ];
    const part = makePartState([], connectors);
    const violations = runDRC(part, [padRule], 'pcb');

    // SMD pads should not have drill violations
    expect(violations.filter(v => v.message.includes('drill'))).toHaveLength(0);
  });
});

// =============================================================================
// runDRC — pin-spacing
// =============================================================================

describe('runDRC — pin-spacing', () => {
  const pinRule: DRCRule = { type: 'pin-spacing', params: { standardPitchMils: 100 }, severity: 'warning', enabled: true };

  it('no violation for pins at standard pitch', () => {
    const connectors = [
      makeConnector('c1', 'pin1', 'pcb', 0, 0),
      makeConnector('c2', 'pin2', 'pcb', 100, 0),
      makeConnector('c3', 'pin3', 'pcb', 200, 0),
    ];
    const part = makePartState([], connectors);
    const violations = runDRC(part, [pinRule], 'pcb');

    expect(violations).toHaveLength(0);
  });

  it('detects non-standard horizontal pin spacing', () => {
    const connectors = [
      makeConnector('c1', 'pin1', 'pcb', 0, 0),
      makeConnector('c2', 'pin2', 'pcb', 73, 0), // 73 is not multiple of 100
    ];
    const part = makePartState([], connectors);
    const violations = runDRC(part, [pinRule], 'pcb');

    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0].ruleType).toBe('pin-spacing');
  });

  it('detects non-standard vertical pin spacing', () => {
    const connectors = [
      makeConnector('c1', 'pin1', 'pcb', 0, 0),
      makeConnector('c2', 'pin2', 'pcb', 0, 57), // 57 is not multiple of 100
    ];
    const part = makePartState([], connectors);
    const violations = runDRC(part, [pinRule], 'pcb');

    expect(violations.length).toBeGreaterThanOrEqual(1);
  });

  it('ignores diagonal pin positions (not purely horizontal or vertical)', () => {
    const connectors = [
      makeConnector('c1', 'pin1', 'pcb', 0, 0),
      makeConnector('c2', 'pin2', 'pcb', 37, 42), // diagonal
    ];
    const part = makePartState([], connectors);
    const violations = runDRC(part, [pinRule], 'pcb');

    expect(violations).toHaveLength(0);
  });
});

// =============================================================================
// runDRC — silk-overlap
// =============================================================================

describe('runDRC — silk-overlap', () => {
  const silkRule: DRCRule = { type: 'silk-overlap', params: {}, severity: 'warning', enabled: true };

  it('detects silk overlapping copper', () => {
    const shapes: Shape[] = [
      makeRect('silk1', 0, 0, 50, 20, 'silk-front'),
      makeRect('cu1', 10, 5, 30, 10, 'copper-front'),
    ];
    const part = makePartState(shapes, []);
    const violations = runDRC(part, [silkRule], 'pcb');

    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0].ruleType).toBe('silk-overlap');
  });

  it('detects silk overlapping default layer', () => {
    const shapes: Shape[] = [
      makeRect('silk1', 0, 0, 50, 20, 'silk-front'),
      makeRect('def1', 10, 5, 30, 10), // default layer
    ];
    const part = makePartState(shapes, []);
    const violations = runDRC(part, [silkRule], 'pcb');

    expect(violations.length).toBeGreaterThanOrEqual(1);
  });

  it('no violation when silk does not overlap copper', () => {
    const shapes: Shape[] = [
      makeRect('silk1', 0, 0, 20, 20, 'silk-front'),
      makeRect('cu1', 100, 100, 20, 20, 'copper-front'),
    ];
    const part = makePartState(shapes, []);
    const violations = runDRC(part, [silkRule], 'pcb');

    expect(violations).toHaveLength(0);
  });
});

// =============================================================================
// runDRC — courtyard-overlap
// =============================================================================

describe('runDRC — courtyard-overlap', () => {
  const courtyardRule: DRCRule = { type: 'courtyard-overlap', params: { minCourtyard: 10 }, severity: 'error', enabled: true };

  it('detects courtyard shapes that are too close', () => {
    const shapes: Shape[] = [
      makeRect('cy1', 0, 0, 40, 40, 'courtyard-front'),
      makeRect('cy2', 45, 0, 40, 40, 'courtyard-front'), // gap = 5, below minCourtyard 10
    ];
    const part = makePartState(shapes, []);
    const violations = runDRC(part, [courtyardRule], 'pcb');

    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0].ruleType).toBe('courtyard-overlap');
  });

  it('no violation when courtyard shapes are far apart', () => {
    const shapes: Shape[] = [
      makeRect('cy1', 0, 0, 40, 40, 'courtyard-front'),
      makeRect('cy2', 100, 0, 40, 40, 'courtyard-front'), // gap = 60
    ];
    const part = makePartState(shapes, []);
    const violations = runDRC(part, [courtyardRule], 'pcb');

    expect(violations).toHaveLength(0);
  });

  it('ignores non-courtyard shapes', () => {
    const shapes: Shape[] = [
      makeRect('r1', 0, 0, 20, 20, 'copper-front'),
      makeRect('r2', 5, 0, 20, 20, 'copper-front'),
    ];
    const part = makePartState(shapes, []);
    const violations = runDRC(part, [courtyardRule], 'pcb');

    expect(violations).toHaveLength(0);
  });
});

// =============================================================================
// runDRC — disabled rules
// =============================================================================

describe('runDRC — disabled rules', () => {
  it('skips disabled rules', () => {
    const shapes: Shape[] = [makePath('p1', 0, 0, 'M0,0 L50,0', 1)];
    const disabledRule: DRCRule = { type: 'min-trace-width', params: { minWidth: 6 }, severity: 'error', enabled: false };
    const part = makePartState(shapes, []);
    const violations = runDRC(part, [disabledRule], 'pcb');

    expect(violations).toHaveLength(0);
  });
});

// =============================================================================
// runDRC — multiple rules
// =============================================================================

describe('runDRC — multiple rules simultaneously', () => {
  it('collects violations from multiple rule types', () => {
    const shapes: Shape[] = [
      makeRect('r1', 0, 0, 20, 20),
      makeRect('r2', 22, 0, 20, 20), // clearance violation (gap = 2)
      makePath('p1', 0, 50, 'M0,50 L100,50', 2), // trace width violation
    ];
    const rules: DRCRule[] = [
      { type: 'min-clearance', params: { minClearance: 10 }, severity: 'error', enabled: true },
      { type: 'min-trace-width', params: { minWidth: 6 }, severity: 'error', enabled: true },
    ];
    const part = makePartState(shapes, []);
    const violations = runDRC(part, rules, 'pcb');

    const ruleTypes = violations.map(v => v.ruleType);
    expect(ruleTypes).toContain('min-clearance');
    expect(ruleTypes).toContain('min-trace-width');
  });

  it('returns empty array for empty shapes and connectors', () => {
    const part = makePartState([], []);
    const rules = getDefaultDRCRules();
    const violations = runDRC(part, rules, 'pcb');

    expect(violations).toHaveLength(0);
  });
});

// =============================================================================
// runDRC — view parameter
// =============================================================================

describe('runDRC — different views', () => {
  it('checks the correct view data', () => {
    const shapes: Shape[] = [makePath('p1', 0, 0, 'M0,0 L50,0', 2)];
    const traceRule: DRCRule = { type: 'min-trace-width', params: { minWidth: 6 }, severity: 'error', enabled: true };

    // Put the thin trace in breadboard view only
    const part: PartState = {
      meta: { title: 'Test', tags: [], mountingType: 'tht', properties: [] },
      connectors: [],
      buses: [],
      views: {
        breadboard: { shapes },
        schematic: { shapes: [] },
        pcb: { shapes: [] },
      },
    };

    // Check PCB view — should have no violations
    const pcbViolations = runDRC(part, [traceRule], 'pcb');
    expect(pcbViolations).toHaveLength(0);

    // Check breadboard view — should find the violation
    const bbViolations = runDRC(part, [traceRule], 'breadboard');
    expect(bbViolations).toHaveLength(1);
  });

  it('violation view field matches the requested view', () => {
    const shapes: Shape[] = [makePath('p1', 0, 0, 'M0,0 L50,0', 2)];
    const part = makePartState(shapes, [], 'schematic');
    const traceRule: DRCRule = { type: 'min-trace-width', params: { minWidth: 6 }, severity: 'error', enabled: true };
    const violations = runDRC(part, [traceRule], 'schematic');

    expect(violations[0].view).toBe('schematic');
  });
});

// =============================================================================
// runDRC — circle shape handling
// =============================================================================

describe('runDRC — circle shape AABB', () => {
  it('detects clearance violations for close circles', () => {
    const shapes: Shape[] = [
      makeCircle('c1', 20, 20, 10),
      makeCircle('c2', 35, 20, 10), // gap between circles: 35-20=15, minus radii: 15-10-10=-5 (overlap)
    ];
    const clearanceRule: DRCRule = { type: 'min-clearance', params: { minClearance: 8 }, severity: 'error', enabled: true };
    const part = makePartState(shapes, []);
    const violations = runDRC(part, [clearanceRule], 'pcb');

    // The circles overlap so there should be a clearance violation
    expect(violations.length).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// runDRC — annular-ring
// =============================================================================

describe('runDRC — annular-ring', () => {
  const annularRule: DRCRule = { type: 'annular-ring', params: { minAnnularRing: 5 }, severity: 'error', enabled: true };

  it('detects annular ring below minimum', () => {
    // pad diameter 30, drill 24 => annular ring = (30-24)/2 = 3px, below min 5
    const connectors = [
      makeConnector('c1', 'pin1', 'pcb', 50, 50, { type: 'tht', shape: 'circle', diameter: 30, drill: 24 }),
    ];
    const part = makePartState([], connectors);
    const violations = runDRC(part, [annularRule], 'pcb');

    expect(violations).toHaveLength(1);
    expect(violations[0].ruleType).toBe('annular-ring');
    expect(violations[0].actual).toBe(3);
    expect(violations[0].required).toBe(5);
  });

  it('no violation when annular ring meets minimum', () => {
    // pad diameter 40, drill 20 => annular ring = (40-20)/2 = 10px, above min 5
    const connectors = [
      makeConnector('c1', 'pin1', 'pcb', 50, 50, { type: 'tht', shape: 'circle', diameter: 40, drill: 20 }),
    ];
    const part = makePartState([], connectors);
    const violations = runDRC(part, [annularRule], 'pcb');

    expect(violations).toHaveLength(0);
  });

  it('no violation when annular ring exactly equals minimum', () => {
    // pad diameter 30, drill 20 => annular ring = (30-20)/2 = 5px, equals min 5
    const connectors = [
      makeConnector('c1', 'pin1', 'pcb', 50, 50, { type: 'tht', shape: 'circle', diameter: 30, drill: 20 }),
    ];
    const part = makePartState([], connectors);
    const violations = runDRC(part, [annularRule], 'pcb');

    expect(violations).toHaveLength(0);
  });

  it('ignores SMD pads (no drill hole)', () => {
    const connectors = [
      makeConnector('c1', 'pin1', 'pcb', 50, 50, { type: 'smd', shape: 'rect', diameter: 30, drill: 24 }),
    ];
    const part = makePartState([], connectors);
    const violations = runDRC(part, [annularRule], 'pcb');

    expect(violations).toHaveLength(0);
  });

  it('ignores connectors without padSpec', () => {
    const connectors = [makeConnector('c1', 'pin1', 'pcb', 50, 50)];
    const part = makePartState([], connectors);
    const violations = runDRC(part, [annularRule], 'pcb');

    expect(violations).toHaveLength(0);
  });

  it('detects multiple annular ring violations', () => {
    const connectors = [
      makeConnector('c1', 'pin1', 'pcb', 0, 0, { type: 'tht', shape: 'circle', diameter: 22, drill: 20 }),  // ring = 1
      makeConnector('c2', 'pin2', 'pcb', 100, 0, { type: 'tht', shape: 'circle', diameter: 24, drill: 20 }), // ring = 2
      makeConnector('c3', 'pin3', 'pcb', 200, 0, { type: 'tht', shape: 'circle', diameter: 40, drill: 20 }), // ring = 10, OK
    ];
    const part = makePartState([], connectors);
    const violations = runDRC(part, [annularRule], 'pcb');

    expect(violations).toHaveLength(2);
  });
});

// =============================================================================
// runDRC — thermal-relief
// =============================================================================

describe('runDRC — thermal-relief', () => {
  const thermalRule: DRCRule = { type: 'thermal-relief', params: { minSpokeWidth: 8, minSpokeCount: 2 }, severity: 'warning', enabled: true };

  it('detects thin thermal relief spokes', () => {
    // Large copper pour + THT pad inside it + thin path (spoke)
    const shapes: Shape[] = [
      makeRect('pour1', 0, 0, 200, 200, 'copper-front'),  // copper pour (area 40000 > 10000 threshold)
      makePath('spoke1', 50, 50, 'M50,50 L80,50', 3),     // thin spoke (3px < 8px min)
      makePath('spoke2', 50, 50, 'M50,50 L50,80', 4),     // another thin spoke
    ];
    const connectors = [
      makeConnector('c1', 'pad1', 'pcb', 50, 50, { type: 'tht', shape: 'circle', diameter: 40, drill: 20 }),
    ];
    const part = makePartState(shapes, connectors);
    const violations = runDRC(part, [thermalRule], 'pcb');

    const thinSpokeViolations = violations.filter(v => v.message.includes('thinner'));
    expect(thinSpokeViolations.length).toBeGreaterThanOrEqual(1);
  });

  it('no violations when no copper pours exist', () => {
    const shapes: Shape[] = [
      makeRect('r1', 0, 0, 20, 20, 'copper-front'), // too small to be a pour (area 400)
    ];
    const connectors = [
      makeConnector('c1', 'pad1', 'pcb', 10, 10, { type: 'tht', shape: 'circle', diameter: 40, drill: 20 }),
    ];
    const part = makePartState(shapes, connectors);
    const violations = runDRC(part, [thermalRule], 'pcb');

    expect(violations).toHaveLength(0);
  });

  it('no violations for SMD pads in copper pours', () => {
    const shapes: Shape[] = [
      makeRect('pour1', 0, 0, 200, 200, 'copper-front'),
    ];
    const connectors = [
      makeConnector('c1', 'pad1', 'pcb', 50, 50, { type: 'smd', shape: 'rect', diameter: 40 }),
    ];
    const part = makePartState(shapes, connectors);
    const violations = runDRC(part, [thermalRule], 'pcb');

    expect(violations).toHaveLength(0);
  });

  it('detects insufficient spoke count', () => {
    const shapes: Shape[] = [
      makeRect('pour1', 0, 0, 200, 200, 'copper-front'),
      makePath('spoke1', 50, 50, 'M50,50 L80,50', 10), // 1 spoke that is wide enough, but count=1 < min=2
    ];
    const connectors = [
      makeConnector('c1', 'pad1', 'pcb', 50, 50, { type: 'tht', shape: 'circle', diameter: 40, drill: 20 }),
    ];
    const part = makePartState(shapes, connectors);
    const violations = runDRC(part, [thermalRule], 'pcb');

    const countViolations = violations.filter(v => v.message.includes('spoke(s) in copper pour'));
    expect(countViolations.length).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// runDRC — trace-to-edge
// =============================================================================

describe('runDRC — trace-to-edge', () => {
  const edgeRule: DRCRule = { type: 'trace-to-edge', params: { minEdgeClearance: 10 }, severity: 'error', enabled: true };

  it('detects copper too close to board edge', () => {
    const shapes: Shape[] = [
      makeRect('edge1', 0, 0, 200, 5, 'edge'),         // board edge
      makeRect('cu1', 0, 8, 30, 10, 'copper-front'),    // copper 3px from edge (8 - 5 = 3, below min 10)
    ];
    const part = makePartState(shapes, []);
    const violations = runDRC(part, [edgeRule], 'pcb');

    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0].ruleType).toBe('trace-to-edge');
    expect(violations[0].actual).toBeLessThan(10);
  });

  it('no violation when copper is far from edge', () => {
    const shapes: Shape[] = [
      makeRect('edge1', 0, 0, 200, 5, 'edge'),
      makeRect('cu1', 0, 30, 30, 10, 'copper-front'), // copper 25px from edge
    ];
    const part = makePartState(shapes, []);
    const violations = runDRC(part, [edgeRule], 'pcb');

    expect(violations).toHaveLength(0);
  });

  it('no violations when no edge shapes exist', () => {
    const shapes: Shape[] = [
      makeRect('cu1', 0, 0, 30, 10, 'copper-front'),
    ];
    const part = makePartState(shapes, []);
    const violations = runDRC(part, [edgeRule], 'pcb');

    expect(violations).toHaveLength(0);
  });

  it('detects default-layer shapes close to edge', () => {
    const shapes: Shape[] = [
      makeRect('edge1', 0, 0, 200, 5, 'board-outline'),
      makeRect('def1', 0, 8, 30, 10),  // default layer, 3px from edge
    ];
    const part = makePartState(shapes, []);
    const violations = runDRC(part, [edgeRule], 'pcb');

    expect(violations.length).toBeGreaterThanOrEqual(1);
  });

  it('recognizes edge-cuts layer as board edge', () => {
    const shapes: Shape[] = [
      makeRect('edge1', 0, 0, 200, 5, 'edge-cuts'),
      makeRect('cu1', 0, 8, 30, 10, 'copper-front'),
    ];
    const part = makePartState(shapes, []);
    const violations = runDRC(part, [edgeRule], 'pcb');

    expect(violations.length).toBeGreaterThanOrEqual(1);
  });

  it('ignores silk shapes near edge (only checks copper)', () => {
    const shapes: Shape[] = [
      makeRect('edge1', 0, 0, 200, 5, 'edge'),
      makeRect('silk1', 0, 6, 30, 10, 'silk-front'), // silk near edge, should not trigger
    ];
    const part = makePartState(shapes, []);
    const violations = runDRC(part, [edgeRule], 'pcb');

    expect(violations).toHaveLength(0);
  });
});

// =============================================================================
// runDRC — via-in-pad
// =============================================================================

describe('runDRC — via-in-pad', () => {
  const viaRule: DRCRule = { type: 'via-in-pad', params: {}, severity: 'warning', enabled: true };

  it('detects via overlapping SMD pad', () => {
    const shapes: Shape[] = [
      makeCircle('via1', 50, 50, 5, 'copper-front'), // small via (diameter 10)
    ];
    const connectors = [
      makeConnector('c1', 'pad1', 'pcb', 50, 50, { type: 'smd', shape: 'rect', width: 30, height: 20, diameter: 30 }),
    ];
    const part = makePartState(shapes, connectors);
    const violations = runDRC(part, [viaRule], 'pcb');

    expect(violations).toHaveLength(1);
    expect(violations[0].ruleType).toBe('via-in-pad');
    expect(violations[0].message).toContain('Via detected in SMD pad');
  });

  it('no violation when via is far from SMD pad', () => {
    const shapes: Shape[] = [
      makeCircle('via1', 200, 200, 5, 'copper-front'),
    ];
    const connectors = [
      makeConnector('c1', 'pad1', 'pcb', 50, 50, { type: 'smd', shape: 'rect', width: 30, height: 20, diameter: 30 }),
    ];
    const part = makePartState(shapes, connectors);
    const violations = runDRC(part, [viaRule], 'pcb');

    expect(violations).toHaveLength(0);
  });

  it('ignores vias near THT pads (only checks SMD)', () => {
    const shapes: Shape[] = [
      makeCircle('via1', 50, 50, 5, 'copper-front'),
    ];
    const connectors = [
      makeConnector('c1', 'pad1', 'pcb', 50, 50, { type: 'tht', shape: 'circle', diameter: 40, drill: 20 }),
    ];
    const part = makePartState(shapes, connectors);
    const violations = runDRC(part, [viaRule], 'pcb');

    expect(violations).toHaveLength(0);
  });

  it('ignores large circles (not vias)', () => {
    // Circle with diameter > 30 is not considered a via
    const shapes: Shape[] = [
      makeCircle('big1', 50, 50, 20, 'copper-front'), // diameter 40, too large to be a via
    ];
    const connectors = [
      makeConnector('c1', 'pad1', 'pcb', 50, 50, { type: 'smd', shape: 'rect', width: 30, height: 20, diameter: 30 }),
    ];
    const part = makePartState(shapes, connectors);
    const violations = runDRC(part, [viaRule], 'pcb');

    expect(violations).toHaveLength(0);
  });

  it('no violations when no SMD connectors exist', () => {
    const shapes: Shape[] = [
      makeCircle('via1', 50, 50, 5, 'copper-front'),
    ];
    const part = makePartState(shapes, []);
    const violations = runDRC(part, [viaRule], 'pcb');

    expect(violations).toHaveLength(0);
  });
});

// =============================================================================
// runDRC — solder-mask
// =============================================================================

describe('runDRC — solder-mask', () => {
  const maskRule: DRCRule = { type: 'solder-mask', params: { minSolderMaskDam: 4, minSolderMaskExpansion: 2 }, severity: 'warning', enabled: true };

  it('detects insufficient solder mask expansion', () => {
    // Mask opening is same size as copper pad — expansion is 0 on all sides
    const shapes: Shape[] = [
      makeRect('mask1', 10, 10, 30, 20, 'mask-front'),
      makeRect('cu1', 10, 10, 30, 20, 'copper-front'),
    ];
    const part = makePartState(shapes, []);
    const violations = runDRC(part, [maskRule], 'pcb');

    const expansionViolations = violations.filter(v => v.message.includes('expansion'));
    expect(expansionViolations.length).toBeGreaterThanOrEqual(1);
    expect(expansionViolations[0].actual).toBe(0);
  });

  it('no violation when mask expansion is sufficient', () => {
    // Mask opening extends 5px on all sides beyond copper
    const shapes: Shape[] = [
      makeRect('mask1', 5, 5, 40, 30, 'mask-front'),   // mask from (5,5) to (45,35)
      makeRect('cu1', 10, 10, 30, 20, 'copper-front'),  // copper from (10,10) to (40,30)
      // left expansion: 10-5=5, right: 45-40=5, top: 10-5=5, bottom: 35-30=5 => min=5 >= 2
    ];
    const part = makePartState(shapes, []);
    const violations = runDRC(part, [maskRule], 'pcb');

    const expansionViolations = violations.filter(v => v.message.includes('expansion'));
    expect(expansionViolations).toHaveLength(0);
  });

  it('detects solder mask dam too narrow between pads', () => {
    // Two pads very close together — dam between their mask openings is too thin
    const connectors = [
      makeConnector('c1', 'pad1', 'pcb', 0, 0, { type: 'smd', shape: 'rect', width: 20, height: 10, diameter: 20 }),
      makeConnector('c2', 'pad2', 'pcb', 22, 0, { type: 'smd', shape: 'rect', width: 20, height: 10, diameter: 20 }),
      // pad1 opening: (-12, -7) to (12, 7) with expansion 2
      // pad2 opening: (10, -7) to (34, 7) with expansion 2
      // gap between openings: 10 - 12 = -2 (overlap), dam = 0
    ];
    const part = makePartState([], connectors);
    const violations = runDRC(part, [maskRule], 'pcb');

    const damViolations = violations.filter(v => v.message.includes('dam'));
    expect(damViolations.length).toBeGreaterThanOrEqual(1);
  });

  it('no dam violation when pads are far apart', () => {
    const connectors = [
      makeConnector('c1', 'pad1', 'pcb', 0, 0, { type: 'smd', shape: 'rect', width: 20, height: 10, diameter: 20 }),
      makeConnector('c2', 'pad2', 'pcb', 100, 0, { type: 'smd', shape: 'rect', width: 20, height: 10, diameter: 20 }),
    ];
    const part = makePartState([], connectors);
    const violations = runDRC(part, [maskRule], 'pcb');

    const damViolations = violations.filter(v => v.message.includes('dam'));
    expect(damViolations).toHaveLength(0);
  });

  it('ignores non-mask shapes', () => {
    // Silk shape overlapping copper should not trigger solder mask violations
    const shapes: Shape[] = [
      makeRect('silk1', 10, 10, 30, 20, 'silk-front'),
      makeRect('cu1', 10, 10, 30, 20, 'copper-front'),
    ];
    const part = makePartState(shapes, []);
    const violations = runDRC(part, [maskRule], 'pcb');

    const maskViolations = violations.filter(v => v.ruleType === 'solder-mask');
    expect(maskViolations).toHaveLength(0);
  });
});
