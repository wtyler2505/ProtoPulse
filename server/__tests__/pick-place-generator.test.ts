import { describe, it, expect } from 'vitest';
import {
  generatePickPlace,
  type PickPlaceInput,
  type PickPlaceInstance,
} from '../export/pick-place-generator';

// =============================================================================
// Fixtures
// =============================================================================

function makeSmdInstance(overrides: Partial<PickPlaceInstance> = {}): PickPlaceInstance {
  return {
    referenceDesignator: 'R1',
    pcbX: 10.0,
    pcbY: 20.0,
    pcbRotation: 0,
    pcbSide: 'front',
    value: '10k',
    footprint: '0402',
    isSmd: true,
    ...overrides,
  };
}

function makeThtInstance(overrides: Partial<PickPlaceInstance> = {}): PickPlaceInstance {
  return {
    referenceDesignator: 'J1',
    pcbX: 5.0,
    pcbY: 5.0,
    pcbRotation: 0,
    pcbSide: 'front',
    value: 'USB',
    footprint: 'USB-A-THT',
    isSmd: false,
    ...overrides,
  };
}

function makeDefaultInput(instances: PickPlaceInstance[] = []): PickPlaceInput {
  return {
    instances,
    boardWidth: 100.0,
    boardHeight: 80.0,
  };
}

// =============================================================================
// THT exclusion
// =============================================================================

describe('generatePickPlace — THT exclusion', () => {
  it('THT components are not included in output', () => {
    const input = makeDefaultInput([makeThtInstance()]);
    const { content, componentCount } = generatePickPlace(input);
    expect(componentCount).toBe(0);
    // No data rows after the CSV header line
    const lines = content.split('\n');
    const headerIdx = lines.findIndex((l) => l.startsWith('Designator'));
    expect(lines.slice(headerIdx + 1).filter((l) => l.trim() !== '')).toHaveLength(0);
  });

  it('mixed THT + SMD: only SMD components appear', () => {
    const input = makeDefaultInput([
      makeThtInstance({ referenceDesignator: 'J1' }),
      makeSmdInstance({ referenceDesignator: 'R1' }),
      makeThtInstance({ referenceDesignator: 'J2' }),
      makeSmdInstance({ referenceDesignator: 'C1' }),
    ]);
    const { content, componentCount } = generatePickPlace(input);
    expect(componentCount).toBe(2);
    expect(content).toContain('R1');
    expect(content).toContain('C1');
    expect(content).not.toContain('J1');
    expect(content).not.toContain('J2');
  });
});

// =============================================================================
// SMD inclusion
// =============================================================================

describe('generatePickPlace — SMD inclusion', () => {
  it('SMD components are included in output', () => {
    const input = makeDefaultInput([makeSmdInstance()]);
    const { componentCount } = generatePickPlace(input);
    expect(componentCount).toBe(1);
  });

  it('componentCount matches actual number of SMD instances', () => {
    const instances = [
      makeSmdInstance({ referenceDesignator: 'R1' }),
      makeSmdInstance({ referenceDesignator: 'R2' }),
      makeSmdInstance({ referenceDesignator: 'C1' }),
      makeThtInstance({ referenceDesignator: 'J1' }),
    ];
    const { componentCount } = generatePickPlace(makeDefaultInput(instances));
    expect(componentCount).toBe(3);
  });
});

// =============================================================================
// board-center origin
// =============================================================================

describe('generatePickPlace — origin: board-center', () => {
  it('shifts coordinates by half board width and height', () => {
    const input: PickPlaceInput = {
      instances: [
        makeSmdInstance({ referenceDesignator: 'R1', pcbX: 50.0, pcbY: 40.0 }),
      ],
      boardWidth: 100.0,
      boardHeight: 80.0,
      origin: 'board-center',
    };
    const { content } = generatePickPlace(input);
    // X: 50 - 50 = 0.000, Y: 40 - 40 = 0.000
    expect(content).toContain('0.000,0.000');
  });

  it('bottom-left corner component shifts to (-halfW, -halfH)', () => {
    const input: PickPlaceInput = {
      instances: [
        makeSmdInstance({ referenceDesignator: 'R1', pcbX: 0.0, pcbY: 0.0 }),
      ],
      boardWidth: 100.0,
      boardHeight: 80.0,
      origin: 'board-center',
    };
    const { content } = generatePickPlace(input);
    // X: 0 - 50 = -50.000, Y: 0 - 40 = -40.000
    expect(content).toContain('-50.000,-40.000');
  });

  it('bottom-left origin leaves coordinates unchanged', () => {
    const input: PickPlaceInput = {
      instances: [
        makeSmdInstance({ referenceDesignator: 'R1', pcbX: 10.5, pcbY: 20.25 }),
      ],
      boardWidth: 100.0,
      boardHeight: 80.0,
      origin: 'bottom-left',
    };
    const { content } = generatePickPlace(input);
    expect(content).toContain('10.500,20.250');
  });
});

// =============================================================================
// Natural sort
// =============================================================================

describe('generatePickPlace — natural sort', () => {
  it('sorts C1, C2, C10 numerically (not lexicographically)', () => {
    const input = makeDefaultInput([
      makeSmdInstance({ referenceDesignator: 'C10' }),
      makeSmdInstance({ referenceDesignator: 'C1' }),
      makeSmdInstance({ referenceDesignator: 'C2' }),
    ]);
    const { content } = generatePickPlace(input);
    const lines = content.split('\n');
    const dataLines = lines.filter((l) => /^C\d/.test(l));
    expect(dataLines[0]).toMatch(/^C1,/);
    expect(dataLines[1]).toMatch(/^C2,/);
    expect(dataLines[2]).toMatch(/^C10,/);
  });

  it('sorts alphabetically by prefix first, then numerically', () => {
    const input = makeDefaultInput([
      makeSmdInstance({ referenceDesignator: 'R2' }),
      makeSmdInstance({ referenceDesignator: 'C1' }),
      makeSmdInstance({ referenceDesignator: 'R1' }),
    ]);
    const { content } = generatePickPlace(input);
    const lines = content.split('\n');
    const dataLines = lines.filter((l) => /^[CR]\d/.test(l));
    expect(dataLines[0]).toMatch(/^C1,/);
    expect(dataLines[1]).toMatch(/^R1,/);
    expect(dataLines[2]).toMatch(/^R2,/);
  });
});

// =============================================================================
// Comment header lines
// =============================================================================

describe('generatePickPlace — output structure', () => {
  it('output starts with comment header lines (# prefix)', () => {
    const { content } = generatePickPlace(makeDefaultInput([makeSmdInstance()]));
    const lines = content.split('\n');
    expect(lines[0]).toMatch(/^#/);
    expect(lines[1]).toMatch(/^#/);
    expect(lines[2]).toMatch(/^#/);
    expect(lines[3]).toMatch(/^#/);
  });

  it('CSV header row Designator,Val,Package,PosX,PosY,Rot,Side is present', () => {
    const { content } = generatePickPlace(makeDefaultInput([makeSmdInstance()]));
    expect(content).toContain('Designator,Val,Package,PosX,PosY,Rot,Side');
  });

  it('component count in header comment matches componentCount return value', () => {
    const instances = [
      makeSmdInstance({ referenceDesignator: 'R1' }),
      makeSmdInstance({ referenceDesignator: 'C1' }),
    ];
    const { content, componentCount } = generatePickPlace(makeDefaultInput(instances));
    expect(content).toContain(`# Components: ${componentCount}`);
  });

  it('board dimensions appear in header comment', () => {
    const { content } = generatePickPlace(makeDefaultInput([makeSmdInstance()]));
    expect(content).toContain('100.0mm x 80.0mm');
  });

  it('origin type appears in header comment', () => {
    const { content } = generatePickPlace({
      instances: [makeSmdInstance()],
      boardWidth: 100,
      boardHeight: 80,
      origin: 'board-center',
    });
    expect(content).toContain('# Origin: board-center');
  });
});

// =============================================================================
// Rotation normalization
// =============================================================================

describe('generatePickPlace — rotation normalization', () => {
  it('-90 degrees normalizes to 270.0', () => {
    const { content } = generatePickPlace(
      makeDefaultInput([makeSmdInstance({ pcbRotation: -90 })]),
    );
    expect(content).toContain('270.0');
  });

  it('360 degrees normalizes to 0.0', () => {
    const { content } = generatePickPlace(
      makeDefaultInput([makeSmdInstance({ pcbRotation: 360 })]),
    );
    expect(content).toContain('0.0');
  });

  it('720 degrees normalizes to 0.0', () => {
    const { content } = generatePickPlace(
      makeDefaultInput([makeSmdInstance({ pcbRotation: 720 })]),
    );
    expect(content).toContain('0.0');
  });

  it('45 degrees stays 45.0', () => {
    const { content } = generatePickPlace(
      makeDefaultInput([makeSmdInstance({ pcbRotation: 45 })]),
    );
    expect(content).toContain('45.0');
  });

  it('-180 degrees normalizes to 180.0', () => {
    const { content } = generatePickPlace(
      makeDefaultInput([makeSmdInstance({ pcbRotation: -180 })]),
    );
    expect(content).toContain('180.0');
  });
});

// =============================================================================
// Side mapping
// =============================================================================

describe('generatePickPlace — side mapping', () => {
  it('front maps to top', () => {
    const { content } = generatePickPlace(
      makeDefaultInput([makeSmdInstance({ pcbSide: 'front' })]),
    );
    expect(content).toContain(',top');
  });

  it('back maps to bottom', () => {
    const { content } = generatePickPlace(
      makeDefaultInput([makeSmdInstance({ pcbSide: 'back' })]),
    );
    expect(content).toContain(',bottom');
  });
});
