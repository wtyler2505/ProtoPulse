/**
 * trace-geometry tests (PP3D-4) — pure three.js geometry, no WebGL needed.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { buildTraceGeometry, COPPER_THICKNESS_MM } from '../trace-geometry';

function expectGeometry(geom: THREE.BufferGeometry | null): THREE.BufferGeometry {
  if (geom === null) {
    throw new Error('expected trace geometry');
  }
  return geom;
}

function expectBoundingBox(geom: THREE.BufferGeometry): THREE.Box3 {
  geom.computeBoundingBox();
  if (geom.boundingBox === null) {
    throw new Error('expected computed bounding box');
  }
  return geom.boundingBox;
}

describe('buildTraceGeometry', () => {
  it('returns null for fewer than 2 points', () => {
    expect(buildTraceGeometry({ points: [], width: 0.2 })).toBeNull();
    expect(buildTraceGeometry({ points: [{ x: 0, z: 0 }], width: 0.2 })).toBeNull();
  });

  it('returns null for zero-length centrelines', () => {
    expect(
      buildTraceGeometry({ points: [{ x: 1, z: 1 }, { x: 1, z: 1 }], width: 0.2 }),
    ).toBeNull();
  });

  it('builds a single-segment ribbon with the right bounding box', () => {
    const geom = expectGeometry(buildTraceGeometry({
      points: [{ x: -5, z: 0 }, { x: 5, z: 0 }],
      width: 0.4,
    }));
    const bb = expectBoundingBox(geom);
    expect(bb.min.x).toBeCloseTo(-5);
    expect(bb.max.x).toBeCloseTo(5);
    expect(bb.max.z - bb.min.z).toBeCloseTo(0.4);
    expect(bb.max.y - bb.min.y).toBeCloseTo(COPPER_THICKNESS_MM);
    geom.dispose();
  });

  it('handles diagonal segments (rotation baked into vertices)', () => {
    const geom = expectGeometry(buildTraceGeometry({
      points: [{ x: 0, z: 0 }, { x: 3, z: 4 }],
      width: 0.2,
    }));
    const bb = expectBoundingBox(geom);
    // The 5mm-long box, rotated, must span the segment extents (± half width).
    expect(bb.max.x).toBeGreaterThanOrEqual(3 - 0.2);
    expect(bb.max.z).toBeGreaterThanOrEqual(4 - 0.2);
    geom.dispose();
  });

  it('merges multi-segment polylines into one geometry with corner joints', () => {
    const single = expectGeometry(buildTraceGeometry({
      points: [{ x: 0, z: 0 }, { x: 10, z: 0 }],
      width: 0.2,
    }));
    const multi = expectGeometry(buildTraceGeometry({
      points: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }],
      width: 0.2,
    }));
    // Two segments + one cylindrical joint > one segment's worth of vertices.
    expect(multi.attributes.position.count).toBeGreaterThan(
      single.attributes.position.count * 2,
    );
    expect(multi).toBeInstanceOf(THREE.BufferGeometry);
    single.dispose();
    multi.dispose();
  });

  it('skips zero-length interior segments without producing degenerate boxes', () => {
    const geom = expectGeometry(buildTraceGeometry({
      points: [{ x: 0, z: 0 }, { x: 0, z: 0 }, { x: 5, z: 0 }],
      width: 0.2,
    }));
    const bb = expectBoundingBox(geom);
    expect(bb.max.x).toBeCloseTo(5);
    geom.dispose();
  });
});
