/**
 * trace-geometry tests (PP3D-4) — pure three.js geometry, no WebGL needed.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { buildTraceGeometry, COPPER_THICKNESS_MM } from '../trace-geometry';

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
    const geom = buildTraceGeometry({
      points: [{ x: -5, z: 0 }, { x: 5, z: 0 }],
      width: 0.4,
    });
    expect(geom).not.toBeNull();
    geom!.computeBoundingBox();
    const bb = geom!.boundingBox!;
    expect(bb.min.x).toBeCloseTo(-5);
    expect(bb.max.x).toBeCloseTo(5);
    expect(bb.max.z - bb.min.z).toBeCloseTo(0.4);
    expect(bb.max.y - bb.min.y).toBeCloseTo(COPPER_THICKNESS_MM);
    geom!.dispose();
  });

  it('handles diagonal segments (rotation baked into vertices)', () => {
    const geom = buildTraceGeometry({
      points: [{ x: 0, z: 0 }, { x: 3, z: 4 }],
      width: 0.2,
    });
    expect(geom).not.toBeNull();
    geom!.computeBoundingBox();
    const bb = geom!.boundingBox!;
    // The 5mm-long box, rotated, must span the segment extents (± half width).
    expect(bb.max.x).toBeGreaterThanOrEqual(3 - 0.2);
    expect(bb.max.z).toBeGreaterThanOrEqual(4 - 0.2);
    geom!.dispose();
  });

  it('merges multi-segment polylines into one geometry with corner joints', () => {
    const single = buildTraceGeometry({
      points: [{ x: 0, z: 0 }, { x: 10, z: 0 }],
      width: 0.2,
    })!;
    const multi = buildTraceGeometry({
      points: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }],
      width: 0.2,
    })!;
    // Two segments + one cylindrical joint > one segment's worth of vertices.
    expect(multi.attributes.position.count).toBeGreaterThan(
      single.attributes.position.count * 2,
    );
    expect(multi).toBeInstanceOf(THREE.BufferGeometry);
    single.dispose();
    multi.dispose();
  });

  it('skips zero-length interior segments without producing degenerate boxes', () => {
    const geom = buildTraceGeometry({
      points: [{ x: 0, z: 0 }, { x: 0, z: 0 }, { x: 5, z: 0 }],
      width: 0.2,
    });
    expect(geom).not.toBeNull();
    geom!.computeBoundingBox();
    expect(geom!.boundingBox!.max.x).toBeCloseTo(5);
    geom!.dispose();
  });
});
