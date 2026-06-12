import { describe, it, expect } from 'vitest';

import { buildLayerStack } from '../../model/layer-stack';
import {
  EXPLODE_LIFT_RATIO,
  EXPLODE_SETTLE_EPSILON,
  EXPLODE_TWEEN_SPEED,
  explodedLift,
  isExplodeSettled,
  splitModelBySide,
  stepExplodeFactor,
} from '../exploded-view';

import type {
  SceneComponent,
  SceneModel,
  ScenePad,
  SceneTrace,
  SceneVia,
} from '../../model/scene-model';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeComponent(over: Partial<SceneComponent> = {}): SceneComponent {
  return {
    id: 'circuit-instance-1',
    refDes: 'U1',
    package: 'SOIC-8',
    x: 10,
    z: -5,
    rotationDeg: 0,
    side: 'top',
    bodyW: 6,
    bodyD: 4,
    bodyH: 1.5,
    color: '#1a1a1a',
    material: 'body-ic',
    ...over,
  };
}

function makePad(over: Partial<ScenePad> = {}): ScenePad {
  return {
    id: 'pad-1',
    componentId: 'circuit-instance-1',
    x: 10,
    z: -5,
    diameter: 1.2,
    through: false,
    side: 'top',
    material: 'gold',
    ...over,
  };
}

function makeTrace(over: Partial<SceneTrace> = {}): SceneTrace {
  return {
    id: 'trace-1',
    points: [
      { x: 0, z: 0 },
      { x: 5, z: 0 },
    ],
    width: 0.25,
    side: 'top',
    y: 0.8,
    material: 'copper',
    ...over,
  };
}

function makeVia(over: Partial<SceneVia> = {}): SceneVia {
  return {
    id: 'via-1',
    x: 2,
    z: 2,
    drillDiameter: 0.3,
    outerDiameter: 0.6,
    yBottom: -0.8,
    yTop: 0.8,
    material: 'copper',
    ...over,
  };
}

function makeModel(over: Partial<SceneModel> = {}): SceneModel {
  return {
    board: {
      widthMm: 100,
      heightMm: 80,
      thicknessMm: 1.6,
      cornerRadiusMm: 0,
      layerCount: 2,
      maskColor: '#1a6b1a',
      silkColor: '#f5f5f5',
      finish: 'HASL',
      padMaterial: 'tin',
    },
    stack: buildLayerStack(2, 1.6),
    components: [],
    pads: [],
    traces: [],
    vias: [],
    drillHoles: [],
    isEmpty: true,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// explodedLift
// ---------------------------------------------------------------------------

describe('explodedLift', () => {
  it('is zero at factor 0 (assembled board)', () => {
    expect(explodedLift('top', 0, 1.6)).toBe(0);
    expect(explodedLift('bottom', 0, 1.6)).toBe(0);
  });

  it('lifts top up and bottom down, symmetrically', () => {
    const top = explodedLift('top', 1, 1.6);
    const bottom = explodedLift('bottom', 1, 1.6);
    expect(top).toBeCloseTo(1.6 * EXPLODE_LIFT_RATIO, 9);
    expect(bottom).toBeCloseTo(-top, 9);
  });

  it('scales linearly with the factor and the board thickness', () => {
    expect(explodedLift('top', 0.5, 1.6)).toBeCloseTo(explodedLift('top', 1, 1.6) / 2, 9);
    expect(explodedLift('top', 1, 3.2)).toBeCloseTo(explodedLift('top', 1, 1.6) * 2, 9);
  });
});

// ---------------------------------------------------------------------------
// stepExplodeFactor / isExplodeSettled
// ---------------------------------------------------------------------------

describe('stepExplodeFactor', () => {
  it('advances toward the target at the tween speed', () => {
    const next = stepExplodeFactor(0, 1, 0.1);
    expect(next).toBeCloseTo(EXPLODE_TWEEN_SPEED * 0.1, 9);
  });

  it('moves down when the target is below the current factor', () => {
    const next = stepExplodeFactor(1, 0, 0.1);
    expect(next).toBeCloseTo(1 - EXPLODE_TWEEN_SPEED * 0.1, 9);
  });

  it('snaps to the target instead of overshooting', () => {
    expect(stepExplodeFactor(0.999, 1, 0.5)).toBe(1);
    expect(stepExplodeFactor(0.001, 0, 0.5)).toBe(0);
  });

  it('is stable once settled', () => {
    expect(stepExplodeFactor(1, 1, 0.016)).toBe(1);
  });

  it('converges from 0 to 1 in a bounded number of frames', () => {
    let factor = 0;
    let frames = 0;
    while (!isExplodeSettled(factor, 1) && frames < 120) {
      factor = stepExplodeFactor(factor, 1, 1 / 60);
      frames += 1;
    }
    expect(factor).toBe(1);
    expect(frames).toBeLessThan(60); // ~1/3 s at 60 fps
  });
});

describe('isExplodeSettled', () => {
  it('respects the settle epsilon', () => {
    expect(isExplodeSettled(1, 1)).toBe(true);
    expect(isExplodeSettled(1 - EXPLODE_SETTLE_EPSILON / 2, 1)).toBe(true);
    expect(isExplodeSettled(0.9, 1)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// splitModelBySide
// ---------------------------------------------------------------------------

describe('splitModelBySide', () => {
  const model = makeModel({
    components: [makeComponent(), makeComponent({ id: 'circuit-instance-2', side: 'bottom' })],
    pads: [makePad(), makePad({ id: 'pad-2', side: 'bottom' })],
    traces: [makeTrace(), makeTrace({ id: 'trace-2', side: 'bottom', y: -0.8 })],
    vias: [makeVia()],
    isEmpty: false,
  });

  it('partitions components/pads/traces by side', () => {
    const { top, bottom } = splitModelBySide(model);
    expect(top.components.map((c) => c.id)).toEqual(['circuit-instance-1']);
    expect(bottom.components.map((c) => c.id)).toEqual(['circuit-instance-2']);
    expect(top.pads.map((p) => p.id)).toEqual(['pad-1']);
    expect(bottom.pads.map((p) => p.id)).toEqual(['pad-2']);
    expect(top.traces.map((t) => t.id)).toEqual(['trace-1']);
    expect(bottom.traces.map((t) => t.id)).toEqual(['trace-2']);
  });

  it('keeps vias (and drill holes) in the fixed partition only', () => {
    const { top, bottom, fixed } = splitModelBySide(model);
    expect(top.vias).toEqual([]);
    expect(bottom.vias).toEqual([]);
    expect(fixed.vias.map((v) => v.id)).toEqual(['via-1']);
    expect(fixed.components).toEqual([]);
    expect(fixed.pads).toEqual([]);
    expect(fixed.traces).toEqual([]);
  });

  it('recomputes isEmpty per partition and shares board/stack by reference', () => {
    const single = makeModel({ components: [makeComponent()], isEmpty: false });
    const { top, bottom, fixed } = splitModelBySide(single);
    expect(top.isEmpty).toBe(false);
    expect(bottom.isEmpty).toBe(true);
    expect(fixed.isEmpty).toBe(true);
    expect(top.board).toBe(single.board);
    expect(top.stack).toBe(single.stack);
  });

  it('does not mutate the source model', () => {
    const before = JSON.stringify(model);
    splitModelBySide(model);
    expect(JSON.stringify(model)).toBe(before);
  });
});
