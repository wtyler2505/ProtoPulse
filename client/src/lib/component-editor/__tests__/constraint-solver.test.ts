import { describe, it, expect } from 'vitest';
import {
  getShapeCenter,
  applyConstraints,
  detectConflicts,
  createConstraint,
} from '../constraint-solver';
import type { Shape, RectShape, CircleShape, Constraint } from '@shared/component-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRect(id: string, x: number, y: number, w = 50, h = 50): RectShape {
  return { id, type: 'rect', x, y, width: w, height: h, rotation: 0 };
}

function makeCircle(id: string, cx: number, cy: number, w = 50, h = 50): CircleShape {
  return { id, type: 'circle', x: cx - w / 2, y: cy - h / 2, width: w, height: h, rotation: 0, cx, cy };
}

// ---------------------------------------------------------------------------
// getShapeCenter
// ---------------------------------------------------------------------------

describe('getShapeCenter', () => {
  it('returns center of a rect shape', () => {
    const rect = makeRect('r1', 10, 20, 100, 60);
    const center = getShapeCenter(rect);
    expect(center.x).toBe(60); // 10 + 100/2
    expect(center.y).toBe(50); // 20 + 60/2
  });

  it('returns center of a circle shape (uses cx/cy)', () => {
    const circle = makeCircle('c1', 80, 90);
    const center = getShapeCenter(circle);
    expect(center.x).toBe(80);
    expect(center.y).toBe(90);
  });

  it('returns center of a text shape (uses x + width/2)', () => {
    const text: Shape = {
      id: 't1', type: 'text', x: 0, y: 0, width: 100, height: 20, rotation: 0, text: 'hello',
    };
    const center = getShapeCenter(text);
    expect(center.x).toBe(50);
    expect(center.y).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// createConstraint
// ---------------------------------------------------------------------------

describe('createConstraint', () => {
  it('creates a distance constraint with defaults', () => {
    const c = createConstraint('distance', ['s1', 's2']);
    expect(c.type).toBe('distance');
    expect(c.shapeIds).toEqual(['s1', 's2']);
    expect(c.params.distance).toBe(100);
    expect(c.params.axis).toBe('any');
    expect(c.enabled).toBe(true);
    expect(c.id).toBeDefined();
  });

  it('creates an alignment constraint with defaults', () => {
    const c = createConstraint('alignment', ['s1', 's2']);
    expect(c.params.axis).toBe('x');
  });

  it('creates a pitch constraint with defaults', () => {
    const c = createConstraint('pitch', ['s1', 's2', 's3']);
    expect(c.params.pitch).toBe(50);
    expect(c.params.axis).toBe('x');
  });

  it('creates a fixed constraint with defaults', () => {
    const c = createConstraint('fixed', ['s1']);
    expect(c.params.x).toBe(0);
    expect(c.params.y).toBe(0);
  });

  it('overrides defaults with user-supplied params', () => {
    const c = createConstraint('distance', ['s1', 's2'], { distance: 200, axis: 'x' });
    expect(c.params.distance).toBe(200);
    expect(c.params.axis).toBe('x');
  });

  it('generates unique ids for each constraint', () => {
    const c1 = createConstraint('alignment', ['s1']);
    const c2 = createConstraint('alignment', ['s1']);
    expect(c1.id).not.toBe(c2.id);
  });
});

// ---------------------------------------------------------------------------
// applyConstraints — alignment
// ---------------------------------------------------------------------------

describe('applyConstraints — alignment', () => {
  it('aligns shapes on the X axis when anchor moves', () => {
    const s1 = makeRect('s1', 0, 0, 50, 50);  // center: 25, 25
    const s2 = makeRect('s2', 100, 50, 50, 50); // center: 125, 75
    const constraint = createConstraint('alignment', ['s1', 's2'], { axis: 'x' });
    const result = applyConstraints([s1, s2], [constraint], 's1');
    const s2Result = result.find(s => s.id === 's2')!;
    const center = getShapeCenter(s2Result);
    // s2 center X should match s1 center X (25)
    expect(center.x).toBeCloseTo(25, 1);
    // Y should be unchanged
    expect(center.y).toBeCloseTo(75, 1);
  });

  it('aligns shapes on the Y axis', () => {
    const s1 = makeRect('s1', 0, 0, 50, 50); // center: 25, 25
    const s2 = makeRect('s2', 100, 50, 50, 50); // center: 125, 75
    const constraint = createConstraint('alignment', ['s1', 's2'], { axis: 'y' });
    const result = applyConstraints([s1, s2], [constraint], 's1');
    const s2Result = result.find(s => s.id === 's2')!;
    const center = getShapeCenter(s2Result);
    expect(center.y).toBeCloseTo(25, 1);
    expect(center.x).toBeCloseTo(125, 1);
  });

  it('does not modify the anchor shape', () => {
    const s1 = makeRect('s1', 0, 0);
    const s2 = makeRect('s2', 100, 50);
    const constraint = createConstraint('alignment', ['s1', 's2'], { axis: 'x' });
    const result = applyConstraints([s1, s2], [constraint], 's1');
    const s1Result = result.find(s => s.id === 's1')!;
    expect(s1Result.x).toBe(0);
    expect(s1Result.y).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// applyConstraints — distance
// ---------------------------------------------------------------------------

describe('applyConstraints — distance', () => {
  it('adjusts target to maintain distance on X axis', () => {
    const s1 = makeRect('s1', 0, 0, 50, 50);   // center: 25, 25
    const s2 = makeRect('s2', 200, 0, 50, 50);  // center: 225, 25
    const constraint = createConstraint('distance', ['s1', 's2'], { distance: 100, axis: 'x' });
    const result = applyConstraints([s1, s2], [constraint], 's1');
    const s2Result = result.find(s => s.id === 's2')!;
    const center = getShapeCenter(s2Result);
    // s2 was to the right, so it should be at anchorCenter.x + 100 = 125
    expect(center.x).toBeCloseTo(125, 1);
  });

  it('adjusts target to maintain distance on Y axis', () => {
    const s1 = makeRect('s1', 0, 0, 50, 50);   // center: 25, 25
    const s2 = makeRect('s2', 0, 200, 50, 50);  // center: 25, 225
    const constraint = createConstraint('distance', ['s1', 's2'], { distance: 80, axis: 'y' });
    const result = applyConstraints([s1, s2], [constraint], 's1');
    const s2Result = result.find(s => s.id === 's2')!;
    const center = getShapeCenter(s2Result);
    expect(center.y).toBeCloseTo(105, 1); // 25 + 80
  });

  it('adjusts target to maintain distance on any axis (diagonal)', () => {
    const s1 = makeRect('s1', 0, 0, 50, 50);     // center: 25, 25
    const s2 = makeRect('s2', 100, 100, 50, 50);  // center: 125, 125
    const constraint = createConstraint('distance', ['s1', 's2'], { distance: 50, axis: 'any' });
    const result = applyConstraints([s1, s2], [constraint], 's1');
    const s2Result = result.find(s => s.id === 's2')!;
    const center = getShapeCenter(s2Result);
    const dx = center.x - 25;
    const dy = center.y - 25;
    const dist = Math.sqrt(dx * dx + dy * dy);
    expect(dist).toBeCloseTo(50, 0);
  });
});

// ---------------------------------------------------------------------------
// applyConstraints — pitch
// ---------------------------------------------------------------------------

describe('applyConstraints — pitch', () => {
  it('spaces shapes evenly along X axis', () => {
    const shapes = [
      makeRect('s1', 0, 0, 20, 20),     // center: 10, 10
      makeRect('s2', 10, 0, 20, 20),     // center: 20, 10
      makeRect('s3', 20, 0, 20, 20),     // center: 30, 10
    ];
    const constraint = createConstraint('pitch', ['s1', 's2', 's3'], { pitch: 100, axis: 'x' });
    const result = applyConstraints(shapes, [constraint], 's1');
    const c1 = getShapeCenter(result.find(s => s.id === 's1')!);
    const c2 = getShapeCenter(result.find(s => s.id === 's2')!);
    const c3 = getShapeCenter(result.find(s => s.id === 's3')!);
    expect(c2.x - c1.x).toBeCloseTo(100, 1);
    expect(c3.x - c1.x).toBeCloseTo(200, 1);
  });
});

// ---------------------------------------------------------------------------
// applyConstraints — fixed
// ---------------------------------------------------------------------------

describe('applyConstraints — fixed', () => {
  it('moves shape center to fixed position', () => {
    const s1 = makeRect('s1', 50, 50, 40, 40); // center: 70, 70
    const constraint = createConstraint('fixed', ['s1'], { x: 100, y: 200 });
    const result = applyConstraints([s1], [constraint], 's1');
    const center = getShapeCenter(result.find(s => s.id === 's1')!);
    expect(center.x).toBeCloseTo(100, 1);
    expect(center.y).toBeCloseTo(200, 1);
  });
});

// ---------------------------------------------------------------------------
// applyConstraints — equal
// ---------------------------------------------------------------------------

describe('applyConstraints — equal', () => {
  it('equalizes width of target to match anchor', () => {
    const s1 = makeRect('s1', 0, 0, 100, 50);
    const s2 = makeRect('s2', 200, 0, 60, 80);
    const constraint = createConstraint('equal', ['s1', 's2'], { property: 'width' });
    const result = applyConstraints([s1, s2], [constraint], 's1');
    const s2Result = result.find(s => s.id === 's2')!;
    expect(s2Result.width).toBe(100);
    // Height should be unchanged
    expect(s2Result.height).toBe(80);
  });

  it('equalizes both width and height', () => {
    const s1 = makeRect('s1', 0, 0, 100, 80);
    const s2 = makeRect('s2', 200, 0, 60, 40);
    const constraint = createConstraint('equal', ['s1', 's2'], { property: 'both' });
    const result = applyConstraints([s1, s2], [constraint], 's1');
    const s2Result = result.find(s => s.id === 's2')!;
    expect(s2Result.width).toBe(100);
    expect(s2Result.height).toBe(80);
  });
});

// ---------------------------------------------------------------------------
// applyConstraints — symmetric
// ---------------------------------------------------------------------------

describe('applyConstraints — symmetric', () => {
  it('reflects target across anchor on X axis', () => {
    const s1 = makeRect('s1', 75, 0, 50, 50); // center: 100, 25
    const s2 = makeRect('s2', 25, 0, 50, 50); // center: 50, 25
    const constraint = createConstraint('symmetric', ['s1', 's2'], { axis: 'x' });
    const result = applyConstraints([s1, s2], [constraint], 's1');
    const s2Result = result.find(s => s.id === 's2')!;
    const center = getShapeCenter(s2Result);
    // Reflected: 2 * 100 - 50 = 150
    expect(center.x).toBeCloseTo(150, 1);
    expect(center.y).toBeCloseTo(25, 1);
  });
});

// ---------------------------------------------------------------------------
// applyConstraints — disabled constraints
// ---------------------------------------------------------------------------

describe('applyConstraints — disabled constraints', () => {
  it('ignores disabled constraints', () => {
    const s1 = makeRect('s1', 0, 0, 50, 50);
    const s2 = makeRect('s2', 100, 50, 50, 50);
    const constraint: Constraint = {
      ...createConstraint('alignment', ['s1', 's2'], { axis: 'x' }),
      enabled: false,
    };
    const result = applyConstraints([s1, s2], [constraint], 's1');
    const s2Result = result.find(s => s.id === 's2')!;
    // s2 should not have moved
    expect(s2Result.x).toBe(100);
    expect(s2Result.y).toBe(50);
  });

  it('returns a deep copy (does not mutate input)', () => {
    const s1 = makeRect('s1', 0, 0);
    const shapes = [s1];
    const result = applyConstraints(shapes, [], 's1');
    result[0].x = 999;
    expect(s1.x).toBe(0); // Original unchanged
  });
});

// ---------------------------------------------------------------------------
// detectConflicts
// ---------------------------------------------------------------------------

describe('detectConflicts', () => {
  it('returns empty for no constraints', () => {
    expect(detectConflicts([], [])).toEqual([]);
  });

  it('returns empty for a satisfiable alignment constraint', () => {
    const s1 = makeRect('s1', 0, 0, 50, 50);
    const s2 = makeRect('s2', 100, 50, 50, 50);
    const constraint = createConstraint('alignment', ['s1', 's2'], { axis: 'x' });
    const conflicts = detectConflicts([constraint], [s1, s2]);
    expect(conflicts).toEqual([]);
  });

  it('returns empty for disabled constraints even if they would conflict', () => {
    const s1 = makeRect('s1', 0, 0);
    const disabled: Constraint = {
      ...createConstraint('fixed', ['s1'], { x: 100, y: 100 }),
      enabled: false,
    };
    const conflicts = detectConflicts([disabled], [s1]);
    expect(conflicts).toEqual([]);
  });

  it('handles constraints referencing nonexistent shapes gracefully', () => {
    const constraint = createConstraint('alignment', ['nonexistent1', 'nonexistent2']);
    const conflicts = detectConflicts([constraint], []);
    // No valid shapes -> should not crash, no conflict reported
    expect(conflicts).toEqual([]);
  });
});
