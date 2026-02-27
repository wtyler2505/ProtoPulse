import { describe, it, expect } from 'vitest';
import {
  generateDrillFile,
  type DrillInput,
  type DrillInstance,
  type DrillConnector,
  type DrillVia,
} from '../export/drill-generator';

// =============================================================================
// Fixtures
// =============================================================================

function makeThtConnector(overrides: Partial<DrillConnector> = {}): DrillConnector {
  return {
    id: 'p1',
    padType: 'tht',
    drillDiameter: 0.8,
    offsetX: 0,
    offsetY: 0,
    ...overrides,
  };
}

function makeSmdConnector(overrides: Partial<DrillConnector> = {}): DrillConnector {
  return {
    id: 'p1',
    padType: 'smd',
    offsetX: 0,
    offsetY: 0,
    ...overrides,
  };
}

function makeInstance(
  x: number,
  y: number,
  connectors: DrillConnector[],
  rotation = 0,
): DrillInstance {
  return { pcbX: x, pcbY: y, pcbRotation: rotation, connectors };
}

function makeEmptyInput(): DrillInput {
  return { instances: [], boardWidth: 100, boardHeight: 80 };
}

// =============================================================================
// SMD connectors
// =============================================================================

describe('generateDrillFile — SMD connectors', () => {
  it('SMD connectors produce no drill hits', () => {
    const input: DrillInput = {
      instances: [makeInstance(10, 10, [makeSmdConnector()])],
      boardWidth: 100,
      boardHeight: 80,
    };
    const { holeCount } = generateDrillFile(input);
    expect(holeCount).toBe(0);
  });

  it('connector with padType smd is fully excluded', () => {
    const input: DrillInput = {
      instances: [
        makeInstance(10, 10, [
          makeSmdConnector({ id: 'p1' }),
          makeSmdConnector({ id: 'p2' }),
        ]),
      ],
      boardWidth: 100,
      boardHeight: 80,
    };
    const { toolCount } = generateDrillFile(input);
    expect(toolCount).toBe(0);
  });
});

// =============================================================================
// THT pads — single tool
// =============================================================================

describe('generateDrillFile — THT pads same diameter', () => {
  it('two THT pads with same diameter produce one tool entry', () => {
    const input: DrillInput = {
      instances: [
        makeInstance(10, 10, [
          makeThtConnector({ id: 'p1', drillDiameter: 0.8, offsetX: -2.54, offsetY: 0 }),
          makeThtConnector({ id: 'p2', drillDiameter: 0.8, offsetX: 2.54, offsetY: 0 }),
        ]),
      ],
      boardWidth: 100,
      boardHeight: 80,
    };
    const { toolCount, holeCount } = generateDrillFile(input);
    expect(toolCount).toBe(1);
    expect(holeCount).toBe(2);
  });

  it('tool definition appears in content with correct diameter', () => {
    const input: DrillInput = {
      instances: [makeInstance(10, 10, [makeThtConnector({ drillDiameter: 1.0 })])],
      boardWidth: 100,
      boardHeight: 80,
    };
    const { content } = generateDrillFile(input);
    expect(content).toContain('T1C1.000');
  });
});

// =============================================================================
// Tool ordering — smallest diameter first
// =============================================================================

describe('generateDrillFile — tool ordering', () => {
  it('tools are ordered by ascending diameter', () => {
    const input: DrillInput = {
      instances: [
        makeInstance(10, 10, [
          makeThtConnector({ id: 'p1', drillDiameter: 1.2 }),
          makeThtConnector({ id: 'p2', drillDiameter: 0.8 }),
          makeThtConnector({ id: 'p3', drillDiameter: 1.0 }),
        ]),
      ],
      boardWidth: 100,
      boardHeight: 80,
    };
    const { content, toolCount } = generateDrillFile(input);
    expect(toolCount).toBe(3);
    // Find T1, T2, T3 definitions and verify diameter order
    const t1Match = content.match(/T1C([\d.]+)/);
    const t2Match = content.match(/T2C([\d.]+)/);
    const t3Match = content.match(/T3C([\d.]+)/);
    expect(t1Match).not.toBeNull();
    expect(t2Match).not.toBeNull();
    expect(t3Match).not.toBeNull();
    const d1 = parseFloat(t1Match![1]);
    const d2 = parseFloat(t2Match![1]);
    const d3 = parseFloat(t3Match![1]);
    expect(d1).toBeLessThan(d2);
    expect(d2).toBeLessThan(d3);
  });
});

// =============================================================================
// Hole sorting — Y ascending then X ascending
// =============================================================================

describe('generateDrillFile — hole sorting', () => {
  it('holes are sorted Y ascending then X ascending within a tool', () => {
    const input: DrillInput = {
      instances: [
        makeInstance(0, 0, [
          makeThtConnector({ id: 'p1', drillDiameter: 0.8, offsetX: 20, offsetY: 30 }),
          makeThtConnector({ id: 'p2', drillDiameter: 0.8, offsetX: 5,  offsetY: 10 }),
          makeThtConnector({ id: 'p3', drillDiameter: 0.8, offsetX: 15, offsetY: 10 }),
        ]),
      ],
      boardWidth: 100,
      boardHeight: 80,
    };
    const { content } = generateDrillFile(input);

    // Extract drill coordinate lines (X...Y... format)
    const drillLines = content
      .split('\n')
      .filter((l) => l.startsWith('X'))
      .map((l) => {
        const m = l.match(/X(-?\d+)Y(-?\d+)/);
        return m ? { x: parseInt(m[1]), y: parseInt(m[2]) } : null;
      })
      .filter((v): v is { x: number; y: number } => v !== null);

    // Y values should be non-decreasing
    for (let i = 1; i < drillLines.length; i++) {
      expect(drillLines[i].y).toBeGreaterThanOrEqual(drillLines[i - 1].y);
    }
    // For same Y, X values should be non-decreasing
    for (let i = 1; i < drillLines.length; i++) {
      if (drillLines[i].y === drillLines[i - 1].y) {
        expect(drillLines[i].x).toBeGreaterThanOrEqual(drillLines[i - 1].x);
      }
    }
  });
});

// =============================================================================
// Empty input — valid file
// =============================================================================

describe('generateDrillFile — empty output', () => {
  it('empty input produces valid M48/M30 file', () => {
    const { content } = generateDrillFile(makeEmptyInput());
    expect(content).toContain('M48');
    expect(content.trimEnd().endsWith('M30')).toBe(true);
  });

  it('output starts with M48 header', () => {
    const { content } = generateDrillFile(makeEmptyInput());
    expect(content.startsWith('M48')).toBe(true);
  });

  it('output ends with M30', () => {
    const { content } = generateDrillFile(makeEmptyInput());
    expect(content.trimEnd().endsWith('M30')).toBe(true);
  });

  it('empty input has zero tools and zero holes', () => {
    const { toolCount, holeCount } = generateDrillFile(makeEmptyInput());
    expect(toolCount).toBe(0);
    expect(holeCount).toBe(0);
  });

  it('FMAT,2 and METRIC,TZ appear in header', () => {
    const { content } = generateDrillFile(makeEmptyInput());
    expect(content).toContain('FMAT,2');
    expect(content).toContain('METRIC,TZ');
  });
});

// =============================================================================
// Vias
// =============================================================================

describe('generateDrillFile — vias', () => {
  it('vias generate drill hits', () => {
    const input: DrillInput = {
      instances: [],
      vias: [
        { x: 10, y: 20, diameter: 0.3 },
        { x: 30, y: 40, diameter: 0.3 },
      ],
      boardWidth: 100,
      boardHeight: 80,
    };
    const { holeCount, toolCount } = generateDrillFile(input);
    expect(holeCount).toBe(2);
    expect(toolCount).toBe(1);
  });
});

// =============================================================================
// Rotation math for pad offsets
// =============================================================================

describe('generateDrillFile — rotation math', () => {
  it('90-degree rotation swaps X/Y offsets correctly', () => {
    // With rotation=90: rx = ox*cos90 - oy*sin90 = -oy, ry = ox*sin90 + oy*cos90 = ox
    // offsetX=2, offsetY=0, rotation=90 → rx=0, ry=2 → absolute=(pcbX+0, pcbY+2)
    const input: DrillInput = {
      instances: [
        makeInstance(10, 10, [
          makeThtConnector({ drillDiameter: 0.8, offsetX: 2, offsetY: 0 }),
        ], 90),
      ],
      boardWidth: 100,
      boardHeight: 80,
    };
    const { content } = generateDrillFile(input);
    // Expected: x=10+0=10 → 10000 µm, y=10+2=12 → 12000 µm
    expect(content).toContain('X10000Y12000');
  });

  it('zero rotation leaves offsets unchanged', () => {
    const input: DrillInput = {
      instances: [
        makeInstance(5, 5, [
          makeThtConnector({ drillDiameter: 0.8, offsetX: 2.54, offsetY: 0 }),
        ], 0),
      ],
      boardWidth: 100,
      boardHeight: 80,
    };
    const { content } = generateDrillFile(input);
    // x=5+2.54=7.54 → 7540, y=5+0=5 → 5000
    expect(content).toContain('X7540Y5000');
  });
});
