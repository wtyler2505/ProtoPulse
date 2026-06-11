import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { BoardScene } from '@/lib/board-viewer-3d';
import type { PadRenderInstance } from '../model/geometry';
import { getBottomLayerY, getTopLayerY, toSceneX, toSceneZ } from './coordinates';

const PAD_DISC_HEIGHT = 0.035;

function getPadY(board: BoardScene['board'], pad: PadRenderInstance, explodeOffset: number): number {
  return pad.side === 'bottom' ? getBottomLayerY(board) - explodeOffset : getTopLayerY(board) + explodeOffset;
}

export function PadInstances({
  board,
  pads,
  copperColor,
  opacity,
  clippingPlanes,
  explodeOffset,
}: {
  board: BoardScene['board'];
  pads: readonly PadRenderInstance[];
  copperColor: string;
  opacity: number;
  clippingPlanes: THREE.Plane[];
  explodeOffset: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }

    pads.forEach((pad, index) => {
      const diameter = Math.max(pad.diameter, 0.1);
      dummy.position.set(
        toSceneX(pad.position.x, board.width),
        getPadY(board, pad, explodeOffset),
        toSceneZ(pad.position.y, board.height),
      );
      dummy.scale.set(diameter, PAD_DISC_HEIGHT, diameter);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });

    mesh.count = pads.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [board.height, board.thickness, board.width, dummy, explodeOffset, pads]);

  if (pads.length === 0) {
    return null;
  }

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, pads.length]}>
      <cylinderGeometry args={[0.5, 0.5, 1, 18]} />
      <meshStandardMaterial
        color={copperColor}
        metalness={0.78}
        roughness={0.3}
        transparent={opacity < 1}
        opacity={opacity}
        side={THREE.DoubleSide}
        clippingPlanes={clippingPlanes.length > 0 ? clippingPlanes : undefined}
        clipShadows={clippingPlanes.length > 0}
      />
    </instancedMesh>
  );
}
