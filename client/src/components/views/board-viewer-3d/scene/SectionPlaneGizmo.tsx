import { useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { BoardScene } from '@/lib/board-viewer-3d';
import { clampSectionPlaneConstant, getSectionPlaneRange, getSectionPlaneX } from './section-plane';

export function SectionPlaneGizmo({
  board,
  enabled,
  constant,
  onChangeConstant,
}: {
  board: BoardScene['board'];
  enabled: boolean;
  constant: number;
  onChangeConstant: (constant: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const { invalidate } = useThree();

  if (!enabled) {
    return null;
  }

  const range = getSectionPlaneRange(board);
  const mmPerPixel = (range.max - range.min) / 420;
  const height = Math.max(7, board.thickness * 4);

  return (
    <mesh
      data-testid="viewer-3d-webgl-section-plane-gizmo"
      position={[getSectionPlaneX(constant), 0, 0]}
      rotation={[0, Math.PI / 2, 0]}
      onPointerDown={(event) => {
        event.stopPropagation();
        setDragging(true);
      }}
      onPointerMove={(event) => {
        if (!dragging) {
          return;
        }
        event.stopPropagation();
        const movementX = Number.isFinite(event.movementX) ? event.movementX : 0;
        if (movementX !== 0) {
          onChangeConstant(clampSectionPlaneConstant(constant - movementX * mmPerPixel, board));
          invalidate();
        }
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
        setDragging(false);
      }}
      onPointerOut={() => {
        setDragging(false);
      }}
    >
      <planeGeometry args={[board.height, height]} />
      <meshBasicMaterial color="#67e8f9" depthWrite={false} opacity={0.2} side={THREE.DoubleSide} transparent />
    </mesh>
  );
}
