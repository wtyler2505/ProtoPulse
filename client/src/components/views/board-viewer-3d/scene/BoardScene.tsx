/**
 * BoardScene — composes the WebGL board viewer scene (PP3D-1, Phase 1).
 *
 * This is the in-`<Canvas>` content: lighting, the extruded board substrate,
 * a couple of placeholder component boxes, the orbit camera, the navigation
 * view cube, and a `<Bounds fit>` wrapper that frames whatever is inside it.
 *
 * Phase 1 uses default/placeholder dimensions only — real project data is wired
 * in Phase 2 via a pure `buildSceneModel` transform.
 */

import { Bounds } from '@react-three/drei';

import { ViewCube } from '../controls/ViewCube';
import { ViewerCamera } from '../controls/ViewerCamera';

import { BoardSubstrate, DEFAULT_BOARD  } from './BoardSubstrate';

import type {BoardSubstrateProps} from './BoardSubstrate';

export interface BoardSceneProps {
  /** Board dimensions (defaults to schema board defaults). */
  board?: BoardSubstrateProps;
}

/**
 * A few placeholder component bodies so the Phase-1 scene reads as a populated
 * board (and gives the non-blank-canvas gate real geometry to detect). These
 * are replaced by data-driven instanced bodies in Phase 2.
 */
function PlaceholderComponents({ thicknessMm }: { thicknessMm: number }) {
  const topY = thicknessMm / 2;
  return (
    <group name="placeholder-components">
      {/* A DIP-like body */}
      <mesh position={[-20, topY + 2.5, -10]} castShadow>
        <boxGeometry args={[18, 5, 8]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.6} metalness={0.2} />
      </mesh>
      {/* An SMD chip */}
      <mesh position={[18, topY + 0.9, 6]} castShadow>
        <boxGeometry args={[10, 1.8, 6]} />
        <meshStandardMaterial color="#222222" roughness={0.5} metalness={0.3} />
      </mesh>
      {/* A small passive */}
      <mesh position={[6, topY + 0.4, -22]} castShadow>
        <boxGeometry args={[2, 0.8, 1.25]} />
        <meshStandardMaterial color="#8b7355" roughness={0.7} metalness={0.1} />
      </mesh>
    </group>
  );
}

export function BoardScene({ board }: BoardSceneProps) {
  const dims = { ...DEFAULT_BOARD, ...board };

  return (
    <>
      {/* Lighting: soft ambient + a key directional that casts shadows. */}
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[60, 120, 80]}
        intensity={1.4}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-80, 40, -60]} intensity={0.4} />

      {/* Frame the board (and placeholders) on mount and when they change. */}
      <Bounds fit clip observe margin={1.2}>
        <BoardSubstrate {...dims} />
        <PlaceholderComponents thicknessMm={dims.thicknessMm ?? DEFAULT_BOARD.thicknessMm} />
      </Bounds>

      {/* CAD navigation. */}
      <ViewerCamera maxDistance={Math.max(dims.widthMm ?? 100, dims.heightMm ?? 80) * 8} />
      <ViewCube />
    </>
  );
}

export default BoardScene;
