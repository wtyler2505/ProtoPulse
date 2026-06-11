import { describe, expect, it } from 'vitest';
import type { BoardScene, Component3D } from '@/lib/board-viewer-3d';
import { buildPadRenderInstances, getComponentPadBoardPosition, rotatePoint2D } from '../geometry';

const componentBase: Component3D = {
  id: 'component-1',
  refDes: 'U1',
  package: 'SOIC-8',
  position: { x: 50, y: 40, z: 0 },
  rotation: 0,
  side: 'top',
  bodyWidth: 5.2,
  bodyHeight: 4.1,
  bodyDepth: 1.75,
  color: '#1a1a1a',
  pins: [
    { id: 'pin-1', position: { x: 2, y: -1 }, diameter: 1.4, type: 'smd' },
    { id: 'pin-2', position: { x: -2, y: 1 }, diameter: 1.2, type: 'through-hole' },
  ],
};

function makeScene(component: Component3D): BoardScene {
  return {
    board: { width: 100, height: 80, thickness: 1.6, cornerRadius: 2 },
    layers: [],
    components: [component],
    traces: [],
    vias: [],
    drillHoles: [],
  };
}

describe('3D scene geometry helpers', () => {
  it('rotates points in board-space without importing Three.js', () => {
    const rotated = rotatePoint2D({ x: 1, y: 0 }, 90);

    expect(rotated.x).toBeCloseTo(0);
    expect(rotated.y).toBeCloseTo(1);
  });

  it('projects component-local pin positions into board coordinates with rotation', () => {
    const position = getComponentPadBoardPosition({ ...componentBase, rotation: 90 }, componentBase.pins[0]);

    expect(position.x).toBeCloseTo(51);
    expect(position.y).toBeCloseTo(42);
  });

  it('builds deterministic top-side pad render instances', () => {
    const pads = buildPadRenderInstances(makeScene({ ...componentBase, rotation: 90 }));

    expect(pads).toHaveLength(2);
    expect(pads[0]).toMatchObject({
      id: 'component-1-pin-1',
      componentId: 'component-1',
      refDes: 'U1',
      pinId: 'pin-1',
      type: 'smd',
      side: 'top',
      layer: 'top-copper',
      diameter: 1.4,
    });
    expect(pads[0].position.x).toBeCloseTo(51);
    expect(pads[0].position.y).toBeCloseTo(42);
  });

  it('places bottom-side pads on bottom copper and filters invalid diameters', () => {
    const pads = buildPadRenderInstances(
      makeScene({
        ...componentBase,
        side: 'bottom',
        pins: [...componentBase.pins, { id: 'bad-pin', position: { x: 0, y: 0 }, diameter: 0, type: 'smd' }],
      }),
    );

    expect(pads).toHaveLength(2);
    expect(pads.every((pad) => pad.side === 'bottom' && pad.layer === 'bottom-copper')).toBe(true);
    expect(pads.map((pad) => pad.id)).not.toContain('component-1-bad-pin');
  });
});
