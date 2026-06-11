import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { BoardScene, Via3D } from '@/lib/board-viewer-3d';
import { getTopLayerY, toSceneX, toSceneZ } from './coordinates';

const VIA_RING_HEIGHT = 0.08;

export function ViaInstances({
  board,
  vias,
  opacity,
  clippingPlanes,
  explodeOffset,
}: {
  board: BoardScene['board'];
  vias: readonly Via3D[];
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

    vias.forEach((via, index) => {
      const diameter = Math.max(via.outerDiameter, 0.1);
      dummy.position.set(
        toSceneX(via.position.x, board.width),
        getTopLayerY(board) + explodeOffset,
        toSceneZ(via.position.y, board.height),
      );
      dummy.scale.set(diameter, VIA_RING_HEIGHT, diameter);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });

    mesh.count = vias.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [board.height, board.thickness, board.width, dummy, explodeOffset, vias]);

  if (vias.length === 0) {
    return null;
  }

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, vias.length]}>
      <cylinderGeometry args={[0.5, 0.5, 1, 24]} />
      <meshStandardMaterial
        color="#d9b45f"
        metalness={0.8}
        roughness={0.28}
        transparent={opacity < 1}
        opacity={opacity}
        side={THREE.DoubleSide}
        clippingPlanes={clippingPlanes.length > 0 ? clippingPlanes : undefined}
        clipShadows={clippingPlanes.length > 0}
      />
    </instancedMesh>
  );
}
