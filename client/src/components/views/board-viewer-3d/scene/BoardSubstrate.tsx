import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { BoardScene, RenderOptions } from '@/lib/board-viewer-3d';

function createRoundedBoardShape(width: number, height: number, radius: number): THREE.Shape {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const cornerRadius = Math.max(0, Math.min(radius, halfWidth, halfHeight));
  const shape = new THREE.Shape();

  if (cornerRadius <= 0.001) {
    shape.moveTo(-halfWidth, -halfHeight);
    shape.lineTo(halfWidth, -halfHeight);
    shape.lineTo(halfWidth, halfHeight);
    shape.lineTo(-halfWidth, halfHeight);
    shape.lineTo(-halfWidth, -halfHeight);
    return shape;
  }

  shape.moveTo(-halfWidth + cornerRadius, -halfHeight);
  shape.lineTo(halfWidth - cornerRadius, -halfHeight);
  shape.quadraticCurveTo(halfWidth, -halfHeight, halfWidth, -halfHeight + cornerRadius);
  shape.lineTo(halfWidth, halfHeight - cornerRadius);
  shape.quadraticCurveTo(halfWidth, halfHeight, halfWidth - cornerRadius, halfHeight);
  shape.lineTo(-halfWidth + cornerRadius, halfHeight);
  shape.quadraticCurveTo(-halfWidth, halfHeight, -halfWidth, halfHeight - cornerRadius);
  shape.lineTo(-halfWidth, -halfHeight + cornerRadius);
  shape.quadraticCurveTo(-halfWidth, -halfHeight, -halfWidth + cornerRadius, -halfHeight);

  return shape;
}

function useBoardGeometry(board: BoardScene['board']): THREE.ExtrudeGeometry {
  return useMemo(() => {
    const shape = createRoundedBoardShape(board.width, board.height, board.cornerRadius);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: board.thickness,
      bevelEnabled: board.cornerRadius > 0,
      bevelSegments: 4,
      bevelSize: Math.min(0.12, board.cornerRadius * 0.18),
      bevelThickness: Math.min(0.08, board.thickness * 0.08),
      steps: 1,
    });
    geometry.center();
    return geometry;
  }, [board.cornerRadius, board.height, board.thickness, board.width]);
}

export function BoardSubstrate({
  scene,
  renderOptions,
  visible,
  opacity,
  clippingPlanes,
}: {
  scene: BoardScene;
  renderOptions: RenderOptions;
  visible: boolean;
  opacity: number;
  clippingPlanes: THREE.Plane[];
}) {
  const geometry = useBoardGeometry(scene.board);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      data-testid="viewer-3d-webgl-board"
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      visible={visible}
    >
      <meshPhysicalMaterial
        color={renderOptions.solderMaskColor || renderOptions.boardColor}
        clearcoat={0.9}
        clearcoatRoughness={0.26}
        roughness={0.42}
        metalness={0.02}
        transparent={opacity < 1}
        opacity={opacity}
        side={THREE.DoubleSide}
        clippingPlanes={clippingPlanes.length > 0 ? clippingPlanes : undefined}
        clipShadows={clippingPlanes.length > 0}
      />
    </mesh>
  );
}
