/**
 * trace-geometry — three.js geometry builders for SceneModel traces (PP3D-4).
 *
 * Lives in the R3F/scene layer (NOT in `model/`) because it imports three.js;
 * the model layer stays three-free per the upgrade-plan contract. Each trace
 * centreline becomes a merged strip of thin copper boxes (one per segment),
 * baked into a single `BufferGeometry` so an entire trace costs one draw call.
 *
 * Geometry is built in trace-local space at y = 0; the caller positions the
 * mesh at the copper plane (`trace.y`) and picks the material.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import type { SceneTrace } from '../model/scene-model';

/** Nominal 1 oz copper thickness (mm) used for trace ribbons. */
export const COPPER_THICKNESS_MM = 0.035;

/**
 * Build a single merged geometry for one trace centreline.
 *
 * Returns `null` when the centreline has fewer than 2 points or zero total
 * length (nothing to render). All segment transforms are baked into the
 * vertex data so the result needs no per-segment nodes.
 */
export function buildTraceGeometry(
  trace: Pick<SceneTrace, 'points' | 'width'>,
  copperThicknessMm: number = COPPER_THICKNESS_MM,
): THREE.BufferGeometry | null {
  const { points, width } = trace;
  if (points.length < 2) {
    return null;
  }

  const segments: THREE.BufferGeometry[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    if (length === 0) {
      continue;
    }

    // Box runs along local X; rotate about Y to align with the segment.
    const box = new THREE.BoxGeometry(length, copperThicknessMm, width);
    const angle = Math.atan2(-dz, dx); // scene z grows "down"; +Y rotation is CCW
    const matrix = new THREE.Matrix4()
      .makeRotationY(angle)
      .setPosition((a.x + b.x) / 2, 0, (a.z + b.z) / 2);
    box.applyMatrix4(matrix);
    segments.push(box);

    // Round joint at interior points so corners don't show gaps.
    if (i < points.length - 2) {
      const joint = new THREE.CylinderGeometry(width / 2, width / 2, copperThicknessMm, 12);
      joint.translate(b.x, 0, b.z);
      segments.push(joint);
    }
  }

  if (segments.length === 0) {
    return null;
  }

  const merged = mergeGeometries(segments, false);
  for (const s of segments) {
    s.dispose();
  }
  return merged;
}
