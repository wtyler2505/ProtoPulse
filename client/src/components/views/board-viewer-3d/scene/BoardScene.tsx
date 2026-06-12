/**
 * BoardScene — composes the WebGL board viewer scene (PP3D-1/PP3D-4).
 *
 * This is the in-`<Canvas>` content: lighting, the extruded board substrate,
 * the data-driven SceneModel geometry (components/pads/traces/vias), the orbit
 * camera, the navigation view cube, and a `<Bounds fit>` wrapper that frames
 * whatever is inside it.
 *
 * When a {@link SceneModel} is supplied (PP3D-4, real project data via
 * `buildSceneModel`), the substrate takes its dimensions/colour from the model
 * and `SceneModelView` renders the real geometry. Without a model (or with an
 * empty one) a few placeholder bodies keep the Phase-1 non-blank-canvas gate
 * honest.
 */

import { useEffect, useMemo, useRef } from 'react';
import type { Ref } from 'react';

import { Bounds, Bvh, useBounds } from '@react-three/drei';
import * as THREE from 'three';

import { ViewCube } from '../controls/ViewCube';
import { ViewerCamera } from '../controls/ViewerCamera';
import { selectionBounds } from '../model/scene-lookup';
import { explodedLift, splitModelBySide } from '../tools/exploded-view';
import { useExplodedView } from '../tools/useExplodedView';



import { BoardSubstrate, DEFAULT_BOARD } from './BoardSubstrate';
import { SceneModelView } from './SceneModelView';
import { SelectionHighlight } from './SelectionHighlight';

import type { BoardSubstrateProps } from './BoardSubstrate';
import type { SceneModel, SceneSelection } from '../model/scene-model';
import type { CameraControlsImpl } from '@react-three/drei';

export interface BoardSceneProps {
  /** Board dimensions (defaults to schema board defaults). Ignored when `model` is given. */
  board?: BoardSubstrateProps;
  /** Real project data (PP3D-4). When present it drives substrate + geometry. */
  model?: SceneModel | null;
  /** Currently selected element (PP3D-5). */
  selection?: SceneSelection | null;
  /** Single-click pick (toggle semantics applied by the caller). */
  onPick?: (selection: SceneSelection) => void;
  /** Double-click pick — caller bumps `focusNonce` to fit the camera. */
  onFocus?: (selection: SceneSelection) => void;
  /** Increment to animate the camera onto the current selection. */
  focusNonce?: number;
  /** Exploded-view target factor: 0 = assembled, 1 = fully exploded (PP3D-8). */
  explodeTarget?: number;
  /** Camera-controls rig, exposed for the toolbar/keyboard layer (PP3D-8). */
  controlsRef?: Ref<CameraControlsImpl | null>;
}

/**
 * Renders the SceneModel split into per-side groups so the exploded view can
 * lift the top/bottom content along the board normal via group refs — no
 * per-frame React re-render (PP3D-8). Vias stay fixed (they span the board).
 */
function ExplodedSceneModel({
  model,
  explodeTarget,
  onPick,
  onFocus,
}: {
  model: SceneModel;
  explodeTarget: number;
  onPick?: (selection: SceneSelection) => void;
  onFocus?: (selection: SceneSelection) => void;
}) {
  const topRef = useRef<THREE.Group>(null);
  const bottomRef = useRef<THREE.Group>(null);
  const split = useMemo(() => splitModelBySide(model), [model]);
  const thicknessMm = model.board.thicknessMm;

  useExplodedView(explodeTarget, (factor) => {
    if (topRef.current) {
      topRef.current.position.y = explodedLift('top', factor, thicknessMm);
    }
    if (bottomRef.current) {
      bottomRef.current.position.y = explodedLift('bottom', factor, thicknessMm);
    }
  });

  return (
    <>
      <group ref={topRef} name="explode-top">
        <SceneModelView model={split.top} onPick={onPick} onFocus={onFocus} />
      </group>
      <group ref={bottomRef} name="explode-bottom">
        <SceneModelView model={split.bottom} onPick={onPick} onFocus={onFocus} />
      </group>
      <SceneModelView model={split.fixed} onPick={onPick} onFocus={onFocus} />
    </>
  );
}

/**
 * Fits the `<Bounds>`-managed camera onto the selected element whenever
 * `focusNonce` changes (double-click → fit-to-selection, plan §7).
 */
function FitToSelection({
  model,
  selection,
  focusNonce,
}: {
  model: SceneModel | null | undefined;
  selection: SceneSelection | null | undefined;
  focusNonce: number;
}) {
  const bounds = useBounds();

  useEffect(() => {
    if (focusNonce === 0 || !model || !selection) return;
    const box = selectionBounds(model, selection);
    if (!box) return;
    bounds
      .refresh(
        new THREE.Box3(
          new THREE.Vector3(box.min.x, box.min.y, box.min.z),
          new THREE.Vector3(box.max.x, box.max.y, box.max.z),
        ),
      )
      .fit();
    // `bounds` is a stable drei API object; refit only on an explicit request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce]);

  return null;
}

/**
 * A few placeholder component bodies so an empty scene reads as a populated
 * board (and gives the non-blank-canvas gate real geometry to detect).
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

export function BoardScene({
  board,
  model,
  selection = null,
  onPick,
  onFocus,
  focusNonce = 0,
  explodeTarget = 0,
  controlsRef,
}: BoardSceneProps) {
  const dims: BoardSubstrateProps = model
    ? {
        widthMm: model.board.widthMm,
        heightMm: model.board.heightMm,
        thicknessMm: model.board.thicknessMm,
        cornerRadiusMm: model.board.cornerRadiusMm,
        color: model.board.maskColor,
      }
    : { ...DEFAULT_BOARD, ...board };

  const thicknessMm = dims.thicknessMm ?? DEFAULT_BOARD.thicknessMm;

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

      {/* Frame the board (and its contents) on mount and when they change.
          `<Bvh>` builds three-mesh-bvh bounds trees over the contained meshes
          so picking raycasts stay cheap on dense boards (PP3D-5). */}
      <Bounds fit clip observe margin={1.2}>
        <Bvh firstHitOnly>
          <BoardSubstrate {...dims} />
          {model && !model.isEmpty ? (
            <ExplodedSceneModel
              model={model}
              explodeTarget={explodeTarget}
              onPick={onPick}
              onFocus={onFocus}
            />
          ) : (
            <PlaceholderComponents thicknessMm={thicknessMm} />
          )}
        </Bvh>
        <FitToSelection model={model} selection={selection} focusNonce={focusNonce} />
      </Bounds>

      {/* Outline highlight for the picked element (outside the Bvh/raycast tree). */}
      {model ? <SelectionHighlight model={model} selection={selection} /> : null}

      {/* CAD navigation. */}
      <ViewerCamera
        ref={controlsRef}
        maxDistance={Math.max(dims.widthMm ?? 100, dims.heightMm ?? 80) * 8}
      />
      <ViewCube />
    </>
  );
}

export default BoardScene;
