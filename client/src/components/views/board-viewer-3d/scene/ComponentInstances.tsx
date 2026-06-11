import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { BoardScene, Component3D } from '@/lib/board-viewer-3d';
import { toSceneX, toSceneZ } from './coordinates';

function getComponentY(board: BoardScene['board'], component: Component3D, explodeOffset: number): number {
  const depth = Math.max(component.bodyDepth, 0.2);
  return component.side === 'bottom'
    ? -board.thickness / 2 - depth / 2 - explodeOffset
    : board.thickness / 2 + depth / 2 + explodeOffset;
}

export function ComponentInstances({
  board,
  components,
  highlightedRefDes,
  selectedComponentId,
  hoveredComponentId,
  clippingPlanes,
  explodeOffset,
  onSelectComponent,
  onHoverComponent,
}: {
  board: BoardScene['board'];
  components: readonly Component3D[];
  highlightedRefDes: ReadonlySet<string>;
  selectedComponentId: string | null;
  hoveredComponentId: string | null;
  clippingPlanes: THREE.Plane[];
  explodeOffset: number;
  onSelectComponent: (componentId: string) => void;
  onHoverComponent: (componentId: string | null) => void;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const hitTargetRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const { invalidate } = useThree();

  useEffect(
    () => () => {
      if (typeof document !== 'undefined') {
        document.body.style.cursor = '';
      }
    },
    [],
  );

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    const hitTarget = hitTargetRef.current;
    if (!mesh || !hitTarget) {
      return;
    }

    components.forEach((component, index) => {
      dummy.position.set(
        toSceneX(component.position.x, board.width),
        getComponentY(board, component, explodeOffset),
        toSceneZ(component.position.y, board.height),
      );
      dummy.rotation.set(0, -THREE.MathUtils.degToRad(component.rotation), 0);
      dummy.scale.set(component.bodyWidth, Math.max(component.bodyDepth, 0.2), component.bodyHeight);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      color.set(
        component.id === selectedComponentId
          ? '#22d3ee'
          : highlightedRefDes.has(component.refDes.toUpperCase())
            ? '#facc15'
            : component.color || '#20232a',
      );
      mesh.setColorAt(index, color);

      dummy.scale.set(component.bodyWidth + 3, Math.max(component.bodyDepth, 0.2) + 1.2, component.bodyHeight + 3);
      dummy.updateMatrix();
      hitTarget.setMatrixAt(index, dummy.matrix);
    });

    mesh.count = components.length;
    hitTarget.count = components.length;
    mesh.instanceMatrix.needsUpdate = true;
    hitTarget.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }, [
    board.height,
    board.thickness,
    board.width,
    color,
    components,
    dummy,
    explodeOffset,
    highlightedRefDes,
    selectedComponentId,
  ]);

  if (components.length === 0) {
    return null;
  }

  const handleSelect = (instanceId: number | undefined) => {
    const component = typeof instanceId === 'number' ? components[instanceId] : undefined;
    if (component) {
      onSelectComponent(component.id);
      invalidate();
    }
  };
  const handleHover = (instanceId: number | undefined) => {
    const component = typeof instanceId === 'number' ? components[instanceId] : undefined;
    const nextId = component?.id ?? null;
    if (nextId !== hoveredComponentId) {
      onHoverComponent(nextId);
      invalidate();
    }
  };
  const handleClearHover = () => {
    if (hoveredComponentId) {
      onHoverComponent(null);
      invalidate();
    }
  };

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, components.length]}
        onClick={(event) => {
          event.stopPropagation();
          handleSelect(event.instanceId);
        }}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          roughness={0.48}
          metalness={0.08}
          vertexColors
          side={THREE.DoubleSide}
          clippingPlanes={clippingPlanes.length > 0 ? clippingPlanes : undefined}
          clipShadows={clippingPlanes.length > 0}
        />
      </instancedMesh>
      <instancedMesh
        ref={hitTargetRef}
        args={[undefined, undefined, components.length]}
        onPointerDown={(event) => {
          event.stopPropagation();
          handleSelect(event.instanceId);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          handleHover(event.instanceId);
          if (typeof document !== 'undefined') {
            document.body.style.cursor = 'pointer';
          }
        }}
        onPointerMove={(event) => {
          handleHover(event.instanceId);
        }}
        onPointerOut={() => {
          handleClearHover();
          if (typeof document !== 'undefined') {
            document.body.style.cursor = '';
          }
        }}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </instancedMesh>
    </>
  );
}
