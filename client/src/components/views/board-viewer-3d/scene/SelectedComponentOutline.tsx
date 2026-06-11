import { Outlines } from '@react-three/drei';
import * as THREE from 'three';
import type { BoardScene, Component3D } from '@/lib/board-viewer-3d';
import { toSceneX, toSceneZ } from './coordinates';

function getComponentY(board: BoardScene['board'], component: Component3D, explodeOffset: number): number {
  const depth = Math.max(component.bodyDepth, 0.2);
  return component.side === 'bottom'
    ? -board.thickness / 2 - depth / 2 - explodeOffset
    : board.thickness / 2 + depth / 2 + explodeOffset;
}

export function SelectedComponentOutline({
  board,
  component,
  explodeOffset,
}: {
  board: BoardScene['board'];
  component: Component3D | null;
  explodeOffset: number;
}) {
  if (!component) {
    return null;
  }

  return (
    <mesh
      position={[
        toSceneX(component.position.x, board.width),
        getComponentY(board, component, explodeOffset),
        toSceneZ(component.position.y, board.height),
      ]}
      rotation={[0, -THREE.MathUtils.degToRad(component.rotation), 0]}
      scale={[
        component.bodyWidth + 0.35,
        Math.max(component.bodyDepth, 0.2) + 0.22,
        component.bodyHeight + 0.35,
      ]}
      raycast={() => null}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#22d3ee" transparent opacity={0.12} depthWrite={false} />
      <Outlines thickness={0.08} color="#22d3ee" />
    </mesh>
  );
}
