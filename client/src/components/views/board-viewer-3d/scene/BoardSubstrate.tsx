/**
 * BoardSubstrate — the extruded PCB board body for the WebGL viewer (PP3D-1).
 *
 * Phase 1 renders a real, lit, extruded slab at default board dimensions —
 * no project data yet (that arrives in Phase 2). The outline is a rounded
 * rectangle built with `THREE.Shape` and extruded to the board thickness via
 * `THREE.ExtrudeGeometry`, then laid flat so +Y is "up" out of the board.
 *
 * The geometry is memoized and disposed on unmount / dimension change to avoid
 * the VRAM leaks called out in the upgrade plan (§8 "memory hygiene").
 */

import { useMemo, useEffect } from 'react';

import * as THREE from 'three';

export interface BoardSubstrateProps {
  /** Board width in millimeters (X extent). */
  widthMm?: number;
  /** Board height in millimeters (Z extent, the in-plane depth). */
  heightMm?: number;
  /** Board thickness in millimeters (Y extent, extrusion depth). */
  thicknessMm?: number;
  /** Corner radius in millimeters. */
  cornerRadiusMm?: number;
  /** Solder-mask color (hex). Default = ProtoPulse FR4 green. */
  color?: string;
}

/** Default board dimensions mirror `shared/schema.ts` Board defaults. */
export const DEFAULT_BOARD = {
  widthMm: 100,
  heightMm: 80,
  thicknessMm: 1.6,
  cornerRadiusMm: 2,
} as const;

/**
 * Build a flat, centered, rounded-rectangle extrusion.
 *
 * `ExtrudeGeometry` extrudes a 2D `Shape` (XY plane) along +Z. We rotate the
 * result so the extrusion runs along world-Y (board thickness points "up"),
 * leaving the board lying in the XZ plane — the natural orientation for a
 * CAD-style turntable camera.
 */
function buildBoardGeometry(
  widthMm: number,
  heightMm: number,
  thicknessMm: number,
  cornerRadiusMm: number,
): THREE.ExtrudeGeometry {
  const halfW = widthMm / 2;
  const halfH = heightMm / 2;
  // Clamp radius so it never exceeds half the shorter side.
  const r = Math.max(0, Math.min(cornerRadiusMm, Math.min(halfW, halfH)));

  const shape = new THREE.Shape();
  shape.moveTo(-halfW + r, -halfH);
  shape.lineTo(halfW - r, -halfH);
  shape.quadraticCurveTo(halfW, -halfH, halfW, -halfH + r);
  shape.lineTo(halfW, halfH - r);
  shape.quadraticCurveTo(halfW, halfH, halfW - r, halfH);
  shape.lineTo(-halfW + r, halfH);
  shape.quadraticCurveTo(-halfW, halfH, -halfW, halfH - r);
  shape.lineTo(-halfW, -halfH + r);
  shape.quadraticCurveTo(-halfW, -halfH, -halfW + r, -halfH);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thicknessMm,
    bevelEnabled: false,
    curveSegments: 12,
  });

  // Extrusion runs along +Z; rotate so it runs along +Y, board flat in XZ.
  geometry.rotateX(-Math.PI / 2);
  // Center the slab vertically on the origin.
  geometry.translate(0, -thicknessMm / 2, 0);
  geometry.computeVertexNormals();

  return geometry;
}

export function BoardSubstrate({
  widthMm = DEFAULT_BOARD.widthMm,
  heightMm = DEFAULT_BOARD.heightMm,
  thicknessMm = DEFAULT_BOARD.thicknessMm,
  cornerRadiusMm = DEFAULT_BOARD.cornerRadiusMm,
  color = '#1a6b1a',
}: BoardSubstrateProps) {
  const geometry = useMemo(
    () => buildBoardGeometry(widthMm, heightMm, thicknessMm, cornerRadiusMm),
    [widthMm, heightMm, thicknessMm, cornerRadiusMm],
  );

  // Dispose the geometry when it is replaced or the component unmounts.
  useEffect(() => () => { geometry.dispose(); }, [geometry]);

  return (
    <mesh geometry={geometry} castShadow receiveShadow name="board-substrate">
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.1} />
    </mesh>
  );
}

export default BoardSubstrate;
