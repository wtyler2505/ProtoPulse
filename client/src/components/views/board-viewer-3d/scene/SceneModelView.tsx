/**
 * SceneModelView — renders a {@link SceneModel} as WebGL meshes (PP3D-4).
 *
 * Consumes the pure, three-free model produced by `buildSceneModel()` and
 * turns it into draw-call-frugal R3F nodes per the upgrade plan (§8):
 *   - Component bodies → drei `<Instances>` (one unit box per material family,
 *     scaled per instance) → 1 draw call per material family.
 *   - Pads and vias    → drei `<Instances>` of a unit cylinder → 1 draw call each.
 *   - Traces           → one merged ribbon geometry per trace (see
 *     `trace-geometry.ts`), copper material shared per side.
 *
 * Picking (PP3D-5): every element forwards R3F pointer events as a
 * `SceneSelection` via `onPick` (single click) / `onFocus` (double click —
 * fit-to-selection). drei `<Instances>` raycasts the underlying
 * `InstancedMesh` and routes the hit's `instanceId` to the matching
 * `<Instance>`, so per-instance handlers receive exactly the picked
 * element. Events `stopPropagation()` so only the front-most hit selects.
 */

import { Instance, Instances } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

import type {
  MaterialKey,
  SceneComponent,
  SceneModel,
  SceneSelection,
} from '../model/scene-model';

import { buildTraceGeometry, COPPER_THICKNESS_MM } from './trace-geometry';

/** PBR parameter sets for each material key (plan §9 visual design). */
export const MATERIAL_PROPS: Readonly<
  Record<MaterialKey, { color: string; metalness: number; roughness: number }>
> = {
  fr4: { color: '#1a6b1a', metalness: 0.0, roughness: 0.8 },
  soldermask: { color: '#1a6b1a', metalness: 0.1, roughness: 0.55 },
  silkscreen: { color: '#f5f5f5', metalness: 0.0, roughness: 0.9 },
  copper: { color: '#b87333', metalness: 1.0, roughness: 0.35 },
  gold: { color: '#d4af37', metalness: 1.0, roughness: 0.3 },
  tin: { color: '#c0c0c0', metalness: 1.0, roughness: 0.4 },
  'body-ic': { color: '#1a1a1a', metalness: 0.2, roughness: 0.6 },
  'body-passive': { color: '#8b7355', metalness: 0.1, roughness: 0.7 },
  'body-connector': { color: '#d8d8d0', metalness: 0.3, roughness: 0.5 },
};

/** Pad puck height (mm) — sits just proud of the mask. */
const PAD_HEIGHT_MM = 0.05;

/** Body Y centre for a component sitting on its side of the board. */
function bodyCenterY(c: SceneComponent, halfThickness: number): number {
  return c.side === 'top' ? halfThickness + c.bodyH / 2 : -(halfThickness + c.bodyH / 2);
}

/**
 * Component rotation about the board normal. Circuit rotation is CCW-positive
 * in the top-left/y-down plane; after the y→z mapping that is a NEGATIVE
 * rotation about scene +Y.
 */
function bodyRotationY(c: SceneComponent): number {
  return THREE.MathUtils.degToRad(-c.rotationDeg);
}

/** Per-element pick handlers (PP3D-5). */
interface PickHandlers {
  onPick?: (selection: SceneSelection) => void;
  onFocus?: (selection: SceneSelection) => void;
}

/** Build the R3F click/double-click props for one scene element. */
function pickEvents(
  selection: SceneSelection,
  { onPick, onFocus }: PickHandlers,
): {
  onClick: (e: { stopPropagation: () => void }) => void;
  onDoubleClick: (e: { stopPropagation: () => void }) => void;
} {
  return {
    onClick: (e) => {
      e.stopPropagation();
      onPick?.(selection);
    },
    onDoubleClick: (e) => {
      e.stopPropagation();
      onFocus?.(selection);
    },
  };
}

function ComponentBodies({ model, ...handlers }: { model: SceneModel } & PickHandlers) {
  const halfThickness = model.board.thicknessMm / 2;

  const families = useMemo(() => {
    const byMaterial = new Map<MaterialKey, SceneComponent[]>();
    for (const c of model.components) {
      const list = byMaterial.get(c.material) ?? [];
      list.push(c);
      byMaterial.set(c.material, list);
    }
    return [...byMaterial.entries()];
  }, [model.components]);

  return (
    <group name="component-bodies">
      {families.map(([material, comps]) => (
        <Instances key={material} limit={Math.max(comps.length, 1)} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial {...MATERIAL_PROPS[material]} />
          {comps.map((c) => (
            <Instance
              key={c.id}
              position={[c.x, bodyCenterY(c, halfThickness), c.z]}
              rotation={[0, bodyRotationY(c), 0]}
              scale={[c.bodyW, c.bodyH, c.bodyD]}
              color={c.color}
              {...pickEvents({ kind: 'component', id: c.id }, handlers)}
            />
          ))}
        </Instances>
      ))}
    </group>
  );
}

function Pads({ model, ...handlers }: { model: SceneModel } & PickHandlers) {
  const halfThickness = model.board.thicknessMm / 2;
  if (model.pads.length === 0) return null;

  return (
    <Instances name="pads" limit={model.pads.length}>
      {/* Unit cylinder: radius 0.5, height 1 → scale x/z by diameter, y by height. */}
      <cylinderGeometry args={[0.5, 0.5, 1, 16]} />
      <meshStandardMaterial {...MATERIAL_PROPS[model.board.padMaterial]} />
      {model.pads.map((p) => (
        <Instance
          key={p.id}
          position={[
            p.x,
            p.side === 'top' ? halfThickness + PAD_HEIGHT_MM / 2 : -(halfThickness + PAD_HEIGHT_MM / 2),
            p.z,
          ]}
          scale={[p.diameter, PAD_HEIGHT_MM, p.diameter]}
          {...pickEvents({ kind: 'pad', id: p.id }, handlers)}
        />
      ))}
    </Instances>
  );
}

function Vias({ model, ...handlers }: { model: SceneModel } & PickHandlers) {
  if (model.vias.length === 0) return null;

  return (
    <Instances name="vias" limit={model.vias.length}>
      <cylinderGeometry args={[0.5, 0.5, 1, 16]} />
      <meshStandardMaterial {...MATERIAL_PROPS[model.board.padMaterial]} />
      {model.vias.map((v) => (
        <Instance
          key={v.id}
          position={[v.x, (v.yTop + v.yBottom) / 2, v.z]}
          scale={[v.outerDiameter, v.yTop - v.yBottom + COPPER_THICKNESS_MM * 2, v.outerDiameter]}
          {...pickEvents({ kind: 'via', id: v.id }, handlers)}
        />
      ))}
    </Instances>
  );
}

function Traces({ model, ...handlers }: { model: SceneModel } & PickHandlers) {
  // Build (and dispose) one merged geometry per trace.
  const traceGeometries = useMemo(
    () =>
      model.traces
        .map((t) => ({ trace: t, geometry: buildTraceGeometry(t) }))
        .filter((e): e is { trace: (typeof model.traces)[number]; geometry: THREE.BufferGeometry } =>
          e.geometry !== null,
        ),
    [model.traces],
  );

  useEffect(
    () => () => {
      for (const e of traceGeometries) {
        e.geometry.dispose();
      }
    },
    [traceGeometries],
  );

  if (traceGeometries.length === 0) return null;

  return (
    <group name="traces">
      {traceGeometries.map(({ trace, geometry }) => (
        <mesh
          key={trace.id}
          geometry={geometry}
          position={[0, trace.y + (trace.side === 'top' ? 1 : -1) * (COPPER_THICKNESS_MM / 2), 0]}
          {...pickEvents({ kind: 'trace', id: trace.id }, handlers)}
        >
          <meshStandardMaterial {...MATERIAL_PROPS[trace.material]} />
        </mesh>
      ))}
    </group>
  );
}

export interface SceneModelViewProps extends PickHandlers {
  model: SceneModel;
}

/** Renders all non-substrate SceneModel geometry (bodies, pads, traces, vias). */
export function SceneModelView({ model, onPick, onFocus }: SceneModelViewProps) {
  return (
    <group name="scene-model">
      <ComponentBodies model={model} onPick={onPick} onFocus={onFocus} />
      <Pads model={model} onPick={onPick} onFocus={onFocus} />
      <Traces model={model} onPick={onPick} onFocus={onFocus} />
      <Vias model={model} onPick={onPick} onFocus={onFocus} />
    </group>
  );
}

export default SceneModelView;
