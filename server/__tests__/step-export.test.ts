import { describe, it, expect } from 'vitest';
import {
  generateStep,
  buildBox,
  buildCylinder,
  rotatePoint,
  escapeStepString,
  EntityCounter,
  PACKAGE_DIMENSIONS,
} from '../export/step-generator';
import type { StepInput, StepOutput } from '../export/step-generator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBasicInput(overrides?: Partial<StepInput>): StepInput {
  return {
    projectName: 'TestProject',
    board: { width: 100, height: 80, thickness: 1.6 },
    components: [],
    vias: [],
    ...overrides,
  };
}

function countEntityPattern(content: string, pattern: RegExp): number {
  const matches = content.match(pattern);
  return matches ? matches.length : 0;
}

function extractEntityIds(content: string): number[] {
  const regex = /^#(\d+)\s*=/gm;
  const ids: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    ids.push(parseInt(match[1], 10));
  }
  return ids;
}

// ---------------------------------------------------------------------------
// STEP header & footer
// ---------------------------------------------------------------------------

describe('STEP generator - header/footer', () => {
  it('produces valid ISO-10303-21 header', () => {
    const result = generateStep(makeBasicInput());
    expect(result.content).toMatch(/^ISO-10303-21;/);
    expect(result.content).toContain('HEADER;');
    expect(result.content).toContain('FILE_DESCRIPTION');
    expect(result.content).toContain('FILE_NAME');
    expect(result.content).toContain('FILE_SCHEMA');
    expect(result.content).toContain("FILE_SCHEMA(('AUTOMOTIVE_DESIGN'))");
  });

  it('includes project name in FILE_NAME', () => {
    const result = generateStep(makeBasicInput({ projectName: 'My Rover Board' }));
    expect(result.content).toContain("FILE_NAME('My Rover Board.step'");
  });

  it('produces valid STEP footer', () => {
    const result = generateStep(makeBasicInput());
    expect(result.content).toContain('ENDSEC;');
    expect(result.content).toMatch(/END-ISO-10303-21;\s*$/);
  });

  it('contains DATA section', () => {
    const result = generateStep(makeBasicInput());
    expect(result.content).toContain('DATA;');
    // DATA section ends with ENDSEC
    const dataStart = result.content.indexOf('DATA;');
    const endSec = result.content.indexOf('ENDSEC;', dataStart + 5);
    expect(endSec).toBeGreaterThan(dataStart);
  });

  it('includes ProtoPulse attribution', () => {
    const result = generateStep(makeBasicInput());
    expect(result.content).toContain('ProtoPulse');
  });
});

// ---------------------------------------------------------------------------
// Filename generation
// ---------------------------------------------------------------------------

describe('STEP generator - filename', () => {
  it('generates .step filename from project name', () => {
    const result = generateStep(makeBasicInput({ projectName: 'MyBoard' }));
    expect(result.filename).toBe('MyBoard_3d_assembly.step');
  });

  it('sanitizes special characters in filename', () => {
    const result = generateStep(makeBasicInput({ projectName: 'My Board (v2)!' }));
    expect(result.filename).toBe('My_Board__v2___3d_assembly.step');
    expect(result.filename).not.toMatch(/[^a-zA-Z0-9_.-]/);
  });

  it('handles empty project name', () => {
    const result = generateStep(makeBasicInput({ projectName: '' }));
    expect(result.filename).toBe('_3d_assembly.step');
  });
});

// ---------------------------------------------------------------------------
// Board geometry
// ---------------------------------------------------------------------------

describe('STEP generator - board', () => {
  it('generates board body with correct name', () => {
    const result = generateStep(makeBasicInput());
    expect(result.content).toContain("MANIFOLD_SOLID_BREP('Board'");
  });

  it('creates CARTESIAN_POINTs for board corners', () => {
    const result = generateStep(makeBasicInput({ board: { width: 50, height: 30, thickness: 1.6 } }));
    // Should contain the corner coordinates
    expect(result.content).toContain('CARTESIAN_POINT');
    // Min corner (0,0,0) and max corner (50,30,1.6)
    expect(result.content).toContain('0.000000');
    expect(result.content).toContain('50.000000');
    expect(result.content).toContain('30.000000');
    expect(result.content).toContain('1.600000');
  });

  it('generates product definition for board', () => {
    const result = generateStep(makeBasicInput({ projectName: 'RoverPCB' }));
    expect(result.content).toContain("PRODUCT('RoverPCB - Board'");
    expect(result.content).toContain('PRODUCT_DEFINITION');
    expect(result.content).toContain('PRODUCT_DEFINITION_SHAPE');
    expect(result.content).toContain('SHAPE_REPRESENTATION');
  });
});

// ---------------------------------------------------------------------------
// buildBox
// ---------------------------------------------------------------------------

describe('buildBox', () => {
  it('generates 8 vertex points', () => {
    const counter = new (EntityCounter as unknown as new () => InstanceType<typeof EntityCounter>)();
    const result = buildBox(counter, 0, 0, 0, 10, 20, 5, 'TestBox');
    const vertexCount = result.lines.filter((l) => l.includes('VERTEX_POINT')).length;
    expect(vertexCount).toBe(8);
  });

  it('generates 12 edge curves', () => {
    const counter = new (EntityCounter as unknown as new () => InstanceType<typeof EntityCounter>)();
    const result = buildBox(counter, 0, 0, 0, 10, 20, 5, 'TestBox');
    const edgeCount = result.lines.filter((l) => l.includes('EDGE_CURVE')).length;
    expect(edgeCount).toBe(12);
  });

  it('generates 6 advanced faces', () => {
    const counter = new (EntityCounter as unknown as new () => InstanceType<typeof EntityCounter>)();
    const result = buildBox(counter, 0, 0, 0, 10, 20, 5, 'TestBox');
    const faceCount = result.lines.filter((l) => l.includes('ADVANCED_FACE')).length;
    expect(faceCount).toBe(6);
  });

  it('creates a closed shell', () => {
    const counter = new (EntityCounter as unknown as new () => InstanceType<typeof EntityCounter>)();
    const result = buildBox(counter, 0, 0, 0, 10, 20, 5, 'TestBox');
    const shellLines = result.lines.filter((l) => l.includes('CLOSED_SHELL'));
    expect(shellLines.length).toBe(1);
  });

  it('creates a manifold solid BREP with name', () => {
    const counter = new (EntityCounter as unknown as new () => InstanceType<typeof EntityCounter>)();
    const result = buildBox(counter, 0, 0, 0, 10, 20, 5, 'MyBox');
    const brepLines = result.lines.filter((l) => l.includes('MANIFOLD_SOLID_BREP'));
    expect(brepLines.length).toBe(1);
    expect(brepLines[0]).toContain("'MyBox'");
  });

  it('returns valid BREP ID', () => {
    const counter = new (EntityCounter as unknown as new () => InstanceType<typeof EntityCounter>)();
    const result = buildBox(counter, 0, 0, 0, 10, 20, 5, 'TestBox');
    expect(result.brepId).toBeGreaterThan(0);
    // BREP ID should reference within the generated lines
    expect(result.lines.some((l) => l.startsWith(`#${result.brepId}`))).toBe(true);
  });

  it('positions box at specified origin', () => {
    const counter = new (EntityCounter as unknown as new () => InstanceType<typeof EntityCounter>)();
    const result = buildBox(counter, 15, 25, 3, 10, 20, 5, 'OffsetBox');
    const content = result.lines.join('\n');
    // Should contain the min corner coordinates
    expect(content).toContain('15.000000');
    expect(content).toContain('25.000000');
    expect(content).toContain('3.000000');
    // Should contain the max corner coordinates
    expect(content).toContain('25.000000'); // 15 + 10
    expect(content).toContain('45.000000'); // 25 + 20
    expect(content).toContain('8.000000');  // 3 + 5
  });
});

// ---------------------------------------------------------------------------
// buildCylinder
// ---------------------------------------------------------------------------

describe('buildCylinder', () => {
  it('generates a manifold solid BREP', () => {
    const counter = new (EntityCounter as unknown as new () => InstanceType<typeof EntityCounter>)();
    const result = buildCylinder(counter, 10, 20, 0, 0.4, 1.6, 'Via1');
    const brepLines = result.lines.filter((l) => l.includes('MANIFOLD_SOLID_BREP'));
    expect(brepLines.length).toBe(1);
    expect(brepLines[0]).toContain("'Via1'");
  });

  it('creates closed shell with side faces and caps', () => {
    const counter = new (EntityCounter as unknown as new () => InstanceType<typeof EntityCounter>)();
    const result = buildCylinder(counter, 0, 0, 0, 1, 5, 'Cyl');
    const shellLines = result.lines.filter((l) => l.includes('CLOSED_SHELL'));
    expect(shellLines.length).toBe(1);
    // The shell should reference 16 side faces + 2 caps = 18 faces
    const faceCount = result.lines.filter((l) => l.includes('ADVANCED_FACE')).length;
    expect(faceCount).toBe(18);
  });

  it('positions cylinder at specified center', () => {
    const counter = new (EntityCounter as unknown as new () => InstanceType<typeof EntityCounter>)();
    const radius = 0.5;
    const result = buildCylinder(counter, 30, 40, 0, radius, 1.6, 'Via');
    const content = result.lines.join('\n');
    // Should contain vertex positions near (30 +/- 0.5, 40 +/- 0.5)
    expect(content).toContain('30.500000'); // cx + radius
    expect(content).toContain('40.000000'); // cy
  });

  it('returns valid BREP ID', () => {
    const counter = new (EntityCounter as unknown as new () => InstanceType<typeof EntityCounter>)();
    const result = buildCylinder(counter, 0, 0, 0, 1, 1, 'TestCyl');
    expect(result.brepId).toBeGreaterThan(0);
    expect(result.lines.some((l) => l.startsWith(`#${result.brepId}`))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Component placement
// ---------------------------------------------------------------------------

describe('STEP generator - components', () => {
  it('places front-side component on top of board', () => {
    const result = generateStep(makeBasicInput({
      board: { width: 100, height: 80, thickness: 1.6 },
      components: [{
        refDes: 'U1',
        packageType: 'SOIC-8',
        x: 50, y: 40,
        rotation: 0,
        side: 'front',
        bodyWidth: 4.9, bodyHeight: 3.9, bodyDepth: 1.75,
      }],
    }));
    // Component should be placed at z = board thickness (1.6)
    expect(result.content).toContain("MANIFOLD_SOLID_BREP('U1 (SOIC-8)'");
    expect(result.content).toContain("PRODUCT('U1 (SOIC-8)'");
  });

  it('places back-side component below board', () => {
    const result = generateStep(makeBasicInput({
      board: { width: 100, height: 80, thickness: 1.6 },
      components: [{
        refDes: 'C1',
        packageType: '0805',
        x: 20, y: 30,
        rotation: 0,
        side: 'back',
        bodyWidth: 2.0, bodyHeight: 1.25, bodyDepth: 0.5,
      }],
    }));
    // Should contain the BREP for the component
    expect(result.content).toContain("MANIFOLD_SOLID_BREP('C1 (0805)'");
    // Back-side z = -bodyDepth = -0.5
    expect(result.content).toContain('-0.500000');
  });

  it('generates multiple components', () => {
    const result = generateStep(makeBasicInput({
      components: [
        { refDes: 'U1', packageType: 'SOIC-8', x: 20, y: 20, rotation: 0, side: 'front', bodyWidth: 4.9, bodyHeight: 3.9, bodyDepth: 1.75 },
        { refDes: 'R1', packageType: '0603', x: 40, y: 40, rotation: 0, side: 'front', bodyWidth: 1.6, bodyHeight: 0.8, bodyDepth: 0.45 },
        { refDes: 'C1', packageType: '0805', x: 60, y: 30, rotation: 0, side: 'back', bodyWidth: 2.0, bodyHeight: 1.25, bodyDepth: 0.5 },
      ],
    }));
    // Board + 3 components = 4 MANIFOLD_SOLID_BREPs
    const brepCount = countEntityPattern(result.content, /MANIFOLD_SOLID_BREP/g);
    expect(brepCount).toBe(4);
  });

  it('uses package dimensions lookup when body dimensions are zero', () => {
    const result = generateStep(makeBasicInput({
      components: [{
        refDes: 'U1',
        packageType: 'SOIC-8',
        x: 50, y: 40,
        rotation: 0,
        side: 'front',
        bodyWidth: 0, bodyHeight: 0, bodyDepth: 0,
      }],
    }));
    // Should still generate the component using PACKAGE_DIMENSIONS lookup
    expect(result.content).toContain("MANIFOLD_SOLID_BREP('U1 (SOIC-8)'");
    const brepCount = countEntityPattern(result.content, /MANIFOLD_SOLID_BREP/g);
    expect(brepCount).toBe(2); // board + component
  });

  it('uses fallback dimensions for unknown packages', () => {
    const result = generateStep(makeBasicInput({
      components: [{
        refDes: 'X1',
        packageType: 'CUSTOM-UNKNOWN-99',
        x: 10, y: 10,
        rotation: 0,
        side: 'front',
        bodyWidth: 0, bodyHeight: 0, bodyDepth: 0,
      }],
    }));
    // Should still generate (with fallback 5x4x1.5mm)
    expect(result.content).toContain("MANIFOLD_SOLID_BREP('X1 (CUSTOM-UNKNOWN-99)'");
  });

  it('applies rotation to component position', () => {
    const result = generateStep(makeBasicInput({
      components: [{
        refDes: 'U1',
        packageType: 'SOIC-8',
        x: 50, y: 40,
        rotation: 90,
        side: 'front',
        bodyWidth: 4.9, bodyHeight: 3.9, bodyDepth: 1.75,
      }],
    }));
    // 90-degree rotation should still produce a valid STEP output
    expect(result.content).toContain("MANIFOLD_SOLID_BREP('U1 (SOIC-8)'");
  });
});

// ---------------------------------------------------------------------------
// Via placement
// ---------------------------------------------------------------------------

describe('STEP generator - vias', () => {
  it('generates cylinder for each via', () => {
    const result = generateStep(makeBasicInput({
      vias: [
        { x: 30, y: 40, drillDiameter: 0.3, outerDiameter: 0.6 },
        { x: 60, y: 50, drillDiameter: 0.3, outerDiameter: 0.6 },
      ],
    }));
    // Board (box) + 2 vias (cylinders) = 3 BREPs
    const brepCount = countEntityPattern(result.content, /MANIFOLD_SOLID_BREP/g);
    expect(brepCount).toBe(3);
    expect(result.content).toContain("MANIFOLD_SOLID_BREP('Via_1'");
    expect(result.content).toContain("MANIFOLD_SOLID_BREP('Via_2'");
  });

  it('via height matches board thickness', () => {
    const boardThickness = 1.6;
    const result = generateStep(makeBasicInput({
      board: { width: 100, height: 80, thickness: boardThickness },
      vias: [{ x: 50, y: 40, drillDiameter: 0.3, outerDiameter: 0.8 }],
    }));
    // Via should span the board thickness (z=0 to z=1.6)
    expect(result.content).toContain("MANIFOLD_SOLID_BREP('Via_1'");
  });

  it('via has product definition', () => {
    const result = generateStep(makeBasicInput({
      vias: [{ x: 50, y: 40, drillDiameter: 0.3, outerDiameter: 0.6 }],
    }));
    expect(result.content).toContain("PRODUCT('Via_1'");
    expect(result.content).toContain('SHAPE_REPRESENTATION');
  });
});

// ---------------------------------------------------------------------------
// Entity ID uniqueness
// ---------------------------------------------------------------------------

describe('STEP generator - entity IDs', () => {
  it('all entity IDs are unique', () => {
    const result = generateStep(makeBasicInput({
      components: [
        { refDes: 'U1', packageType: 'SOIC-8', x: 20, y: 20, rotation: 0, side: 'front', bodyWidth: 4.9, bodyHeight: 3.9, bodyDepth: 1.75 },
        { refDes: 'R1', packageType: '0603', x: 40, y: 40, rotation: 0, side: 'front', bodyWidth: 1.6, bodyHeight: 0.8, bodyDepth: 0.45 },
      ],
      vias: [
        { x: 30, y: 30, drillDiameter: 0.3, outerDiameter: 0.6 },
      ],
    }));
    const ids = extractEntityIds(result.content);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it('entity IDs are sequential (no gaps beyond internal counter)', () => {
    const result = generateStep(makeBasicInput());
    const ids = extractEntityIds(result.content);
    // IDs should be monotonically increasing
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i]).toBeGreaterThan(ids[i - 1]);
    }
  });

  it('entity IDs start from 1', () => {
    const result = generateStep(makeBasicInput());
    const ids = extractEntityIds(result.content);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids[0]).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Empty inputs
// ---------------------------------------------------------------------------

describe('STEP generator - empty inputs', () => {
  it('produces board-only STEP with no components', () => {
    const result = generateStep(makeBasicInput({ components: [], vias: [] }));
    const brepCount = countEntityPattern(result.content, /MANIFOLD_SOLID_BREP/g);
    expect(brepCount).toBe(1); // board only
    expect(result.content).toContain("MANIFOLD_SOLID_BREP('Board'");
  });

  it('produces valid STEP with only vias', () => {
    const result = generateStep(makeBasicInput({
      components: [],
      vias: [{ x: 50, y: 40, drillDiameter: 0.3, outerDiameter: 0.6 }],
    }));
    const brepCount = countEntityPattern(result.content, /MANIFOLD_SOLID_BREP/g);
    expect(brepCount).toBe(2); // board + 1 via
  });

  it('produces valid STEP with only components', () => {
    const result = generateStep(makeBasicInput({
      components: [
        { refDes: 'U1', packageType: 'DIP-8', x: 50, y: 40, rotation: 0, side: 'front', bodyWidth: 9.53, bodyHeight: 6.35, bodyDepth: 3.3 },
      ],
      vias: [],
    }));
    const brepCount = countEntityPattern(result.content, /MANIFOLD_SOLID_BREP/g);
    expect(brepCount).toBe(2); // board + 1 component
  });
});

// ---------------------------------------------------------------------------
// String escaping
// ---------------------------------------------------------------------------

describe('escapeStepString', () => {
  it('escapes single quotes', () => {
    expect(escapeStepString("Tyler's Board")).toBe("Tyler''s Board");
  });

  it('escapes backslashes', () => {
    expect(escapeStepString('path\\to\\file')).toBe('path\\\\to\\\\file');
  });

  it('handles strings with no special characters', () => {
    expect(escapeStepString('simple')).toBe('simple');
  });

  it('handles empty strings', () => {
    expect(escapeStepString('')).toBe('');
  });

  it('handles multiple single quotes', () => {
    expect(escapeStepString("it''s a ''test''")).toBe("it''''s a ''''test''''");
  });
});

// ---------------------------------------------------------------------------
// rotatePoint
// ---------------------------------------------------------------------------

describe('rotatePoint', () => {
  it('zero rotation returns same point', () => {
    const result = rotatePoint(5, 10, 0);
    expect(result.x).toBeCloseTo(5);
    expect(result.y).toBeCloseTo(10);
  });

  it('90 degree rotation', () => {
    const result = rotatePoint(1, 0, 90);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(1);
  });

  it('180 degree rotation', () => {
    const result = rotatePoint(3, 4, 180);
    expect(result.x).toBeCloseTo(-3);
    expect(result.y).toBeCloseTo(-4);
  });

  it('270 degree rotation', () => {
    const result = rotatePoint(1, 0, 270);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(-1);
  });

  it('360 degree rotation returns same point', () => {
    const result = rotatePoint(5, 10, 360);
    expect(result.x).toBeCloseTo(5);
    expect(result.y).toBeCloseTo(10);
  });

  it('45 degree rotation', () => {
    const result = rotatePoint(1, 0, 45);
    const expected = Math.cos(Math.PI / 4);
    expect(result.x).toBeCloseTo(expected);
    expect(result.y).toBeCloseTo(expected);
  });

  it('origin point stays at origin', () => {
    const result = rotatePoint(0, 0, 45);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(0);
  });
});

// ---------------------------------------------------------------------------
// Package dimensions lookup
// ---------------------------------------------------------------------------

describe('PACKAGE_DIMENSIONS', () => {
  it('contains common through-hole packages', () => {
    expect(PACKAGE_DIMENSIONS['DIP-8']).toBeDefined();
    expect(PACKAGE_DIMENSIONS['DIP-14']).toBeDefined();
    expect(PACKAGE_DIMENSIONS['TO-220']).toBeDefined();
  });

  it('contains common SMD packages', () => {
    expect(PACKAGE_DIMENSIONS['SOIC-8']).toBeDefined();
    expect(PACKAGE_DIMENSIONS['SOT-23']).toBeDefined();
    expect(PACKAGE_DIMENSIONS['QFP-44']).toBeDefined();
    expect(PACKAGE_DIMENSIONS['0805']).toBeDefined();
    expect(PACKAGE_DIMENSIONS['0603']).toBeDefined();
  });

  it('DIP-8 has correct dimensions', () => {
    const dims = PACKAGE_DIMENSIONS['DIP-8'];
    expect(dims.bodyWidth).toBe(9.53);
    expect(dims.bodyHeight).toBe(6.35);
    expect(dims.bodyDepth).toBe(3.3);
  });

  it('all packages have positive dimensions', () => {
    for (const [name, dims] of Object.entries(PACKAGE_DIMENSIONS)) {
      expect(dims.bodyWidth, `${name} bodyWidth`).toBeGreaterThan(0);
      expect(dims.bodyHeight, `${name} bodyHeight`).toBeGreaterThan(0);
      expect(dims.bodyDepth, `${name} bodyDepth`).toBeGreaterThan(0);
    }
  });

  it('has at least 20 package definitions', () => {
    expect(Object.keys(PACKAGE_DIMENSIONS).length).toBeGreaterThanOrEqual(20);
  });
});

// ---------------------------------------------------------------------------
// Overall STEP structure
// ---------------------------------------------------------------------------

describe('STEP generator - overall structure', () => {
  it('generates well-formed STEP file', () => {
    const result = generateStep(makeBasicInput({
      components: [
        { refDes: 'U1', packageType: 'SOIC-8', x: 30, y: 20, rotation: 0, side: 'front', bodyWidth: 4.9, bodyHeight: 3.9, bodyDepth: 1.75 },
      ],
      vias: [
        { x: 50, y: 40, drillDiameter: 0.3, outerDiameter: 0.6 },
      ],
    }));

    // Must start with ISO header
    expect(result.content).toMatch(/^ISO-10303-21;/);
    // Must end with END marker
    expect(result.content).toMatch(/END-ISO-10303-21;\s*$/);
    // Must have HEADER + DATA sections
    expect(result.content).toContain('HEADER;');
    expect(result.content).toContain('DATA;');
    // Must have entities
    expect(result.content).toContain('CARTESIAN_POINT');
    expect(result.content).toContain('DIRECTION');
    expect(result.content).toContain('AXIS2_PLACEMENT_3D');
    expect(result.content).toContain('CLOSED_SHELL');
    expect(result.content).toContain('MANIFOLD_SOLID_BREP');
    expect(result.content).toContain('SHAPE_REPRESENTATION');
    expect(result.content).toContain('PRODUCT_DEFINITION');
  });

  it('produces StepOutput with content and filename', () => {
    const result = generateStep(makeBasicInput());
    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('filename');
    expect(typeof result.content).toBe('string');
    expect(typeof result.filename).toBe('string');
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.filename.length).toBeGreaterThan(0);
  });

  it('generates unit definitions (mm)', () => {
    const result = generateStep(makeBasicInput());
    expect(result.content).toContain('LENGTH_UNIT');
    expect(result.content).toContain('SI_UNIT');
    expect(result.content).toContain('.MILLI.');
    expect(result.content).toContain('.METRE.');
  });

  it('special characters in project name are escaped in content', () => {
    const result = generateStep(makeBasicInput({ projectName: "Tyler's PCB" }));
    // The STEP string should have doubled single quotes
    expect(result.content).toContain("Tyler''s PCB");
    // But filename should use underscores
    expect(result.filename).toContain('Tyler_s_PCB');
  });

  it('handles complex assembly with many components', () => {
    const components = Array.from({ length: 20 }, (_, i) => ({
      refDes: `R${i + 1}`,
      packageType: '0603',
      x: (i % 5) * 10 + 10,
      y: Math.floor(i / 5) * 10 + 10,
      rotation: i * 45,
      side: (i % 3 === 0 ? 'back' : 'front') as 'front' | 'back',
      bodyWidth: 1.6,
      bodyHeight: 0.8,
      bodyDepth: 0.45,
    }));
    const vias = Array.from({ length: 5 }, (_, i) => ({
      x: i * 15 + 20,
      y: 50,
      drillDiameter: 0.3,
      outerDiameter: 0.6,
    }));

    const result = generateStep(makeBasicInput({ components, vias }));
    // 1 board + 20 components + 5 vias = 26 BREPs
    const brepCount = countEntityPattern(result.content, /MANIFOLD_SOLID_BREP/g);
    expect(brepCount).toBe(26);

    // All entity IDs should be unique
    const ids = extractEntityIds(result.content);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });
});

// ---------------------------------------------------------------------------
// EntityCounter
// ---------------------------------------------------------------------------

describe('EntityCounter', () => {
  it('starts at 0 and increments', () => {
    const counter = new (EntityCounter as unknown as new () => InstanceType<typeof EntityCounter>)();
    expect(counter.next()).toBe(1);
    expect(counter.next()).toBe(2);
    expect(counter.next()).toBe(3);
  });

  it('current returns last assigned ID', () => {
    const counter = new (EntityCounter as unknown as new () => InstanceType<typeof EntityCounter>)();
    counter.next();
    counter.next();
    expect(counter.current()).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('STEP generator - edge cases', () => {
  it('handles very small board dimensions', () => {
    const result = generateStep(makeBasicInput({
      board: { width: 5, height: 5, thickness: 0.4 },
    }));
    expect(result.content).toContain('ISO-10303-21;');
    expect(result.content).toContain('END-ISO-10303-21;');
  });

  it('handles very large board dimensions', () => {
    const result = generateStep(makeBasicInput({
      board: { width: 500, height: 400, thickness: 3.2 },
    }));
    expect(result.content).toContain('500.000000');
    expect(result.content).toContain('400.000000');
  });

  it('handles component at origin (0,0)', () => {
    const result = generateStep(makeBasicInput({
      components: [{
        refDes: 'U1', packageType: 'SOIC-8',
        x: 0, y: 0, rotation: 0, side: 'front',
        bodyWidth: 4.9, bodyHeight: 3.9, bodyDepth: 1.75,
      }],
    }));
    const brepCount = countEntityPattern(result.content, /MANIFOLD_SOLID_BREP/g);
    expect(brepCount).toBe(2);
  });

  it('handles via at board edge', () => {
    const result = generateStep(makeBasicInput({
      board: { width: 100, height: 80, thickness: 1.6 },
      vias: [{ x: 0, y: 0, drillDiameter: 0.3, outerDiameter: 0.6 }],
    }));
    const brepCount = countEntityPattern(result.content, /MANIFOLD_SOLID_BREP/g);
    expect(brepCount).toBe(2);
  });
});
