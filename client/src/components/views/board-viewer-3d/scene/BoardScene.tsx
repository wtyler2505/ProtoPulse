import { useMemo } from 'react';
import { Bounds, Bvh } from '@react-three/drei';
import * as THREE from 'three';
import type { BoardScene as BoardSceneModel, RenderOptions } from '@/lib/board-viewer-3d';
import {
  getLayerOpacity,
  isLayerVisible,
  type WebGLLayerSettings,
} from '../layer-settings';
import { buildPadRenderInstances } from '../model/geometry';
import { BoardSubstrate } from './BoardSubstrate';
import { ComponentHoverTooltip } from './ComponentHoverTooltip';
import { ComponentInstances } from './ComponentInstances';
import { LocalClippingController } from './LocalClippingController';
import { MeasureTool } from './MeasureTool';
import type { MeasurePoint3D, WebGLMeasureSegment } from './measurement';
import { PadInstances } from './PadInstances';
import { SceneFitController } from './SceneFitController';
import { SelectedComponentOutline } from './SelectedComponentOutline';
import { SectionPlaneGizmo } from './SectionPlaneGizmo';
import { TraceLines } from './TraceLines';
import { ViaInstances } from './ViaInstances';

export function getSceneSignature(scene: BoardSceneModel): string {
  const padCount = scene.components.reduce((total, component) => total + component.pins.length, 0);
  return [
    scene.board.width,
    scene.board.height,
    scene.board.thickness,
    scene.components.length,
    padCount,
    scene.traces.length,
    scene.vias.length,
  ].join(':');
}

export function BoardScene({
  scene,
  renderOptions,
  layerSettings,
  highlightedRefDes,
  selectedComponentId,
  hoveredComponentId,
  measureActive,
  pendingMeasurePoint,
  measureSegments,
  sectionEnabled,
  sectionConstant,
  explodedProgress,
  onSelectComponent,
  onHoverComponent,
  onMeasurePoint,
  onSectionConstantChange,
}: {
  scene: BoardSceneModel;
  renderOptions: RenderOptions;
  layerSettings: WebGLLayerSettings;
  highlightedRefDes: ReadonlySet<string>;
  selectedComponentId: string | null;
  hoveredComponentId: string | null;
  measureActive: boolean;
  pendingMeasurePoint: MeasurePoint3D | null;
  measureSegments: readonly WebGLMeasureSegment[];
  sectionEnabled: boolean;
  sectionConstant: number;
  explodedProgress: number;
  onSelectComponent: (componentId: string) => void;
  onHoverComponent: (componentId: string | null) => void;
  onMeasurePoint: (point: MeasurePoint3D) => void;
  onSectionConstantChange: (constant: number) => void;
}) {
  const pads = useMemo(() => buildPadRenderInstances(scene), [scene]);
  const visibleTopPads = useMemo(
    () => pads.filter((pad) => pad.layer === 'top-copper' && isLayerVisible(layerSettings, pad.layer)),
    [layerSettings, pads],
  );
  const visibleBottomPads = useMemo(
    () => pads.filter((pad) => pad.layer === 'bottom-copper' && isLayerVisible(layerSettings, pad.layer)),
    [layerSettings, pads],
  );
  const topCopperVisible = isLayerVisible(layerSettings, 'top-copper');
  const bottomCopperVisible = isLayerVisible(layerSettings, 'bottom-copper');
  const visibleVias = topCopperVisible || bottomCopperVisible ? scene.vias : [];
  const viaOpacity = Math.max(
    topCopperVisible ? getLayerOpacity(layerSettings, 'top-copper') : 0,
    bottomCopperVisible ? getLayerOpacity(layerSettings, 'bottom-copper') : 0,
  );
  const selectedComponent = useMemo(
    () => scene.components.find((component) => component.id === selectedComponentId) ?? null,
    [scene.components, selectedComponentId],
  );
  const hoveredComponent = useMemo(
    () => scene.components.find((component) => component.id === hoveredComponentId) ?? null,
    [hoveredComponentId, scene.components],
  );
  const clippingPlanes = useMemo(
    () => (sectionEnabled ? [new THREE.Plane(new THREE.Vector3(1, 0, 0), sectionConstant)] : []),
    [sectionConstant, sectionEnabled],
  );
  const explodeOffset = Math.max(2.4, scene.board.thickness * 2.8) * explodedProgress;

  return (
    <Bounds fit clip observe margin={1.2}>
      <LocalClippingController enabled={sectionEnabled} />
      <SceneFitController signature={getSceneSignature(scene)} />
      <Bvh firstHitOnly>
        <group>
          <BoardSubstrate
            scene={scene}
            renderOptions={renderOptions}
            visible={isLayerVisible(layerSettings, 'substrate')}
            opacity={getLayerOpacity(layerSettings, 'substrate')}
            clippingPlanes={clippingPlanes}
          />
          <TraceLines
            board={scene.board}
            traces={scene.traces}
            layerSettings={layerSettings}
            clippingPlanes={clippingPlanes}
            explodeOffset={explodeOffset}
          />
          <ViaInstances
            board={scene.board}
            vias={visibleVias}
            opacity={viaOpacity}
            clippingPlanes={clippingPlanes}
            explodeOffset={explodeOffset}
          />
          <PadInstances
            board={scene.board}
            pads={visibleTopPads}
            copperColor={renderOptions.copperColor}
            opacity={getLayerOpacity(layerSettings, 'top-copper')}
            clippingPlanes={clippingPlanes}
            explodeOffset={explodeOffset}
          />
          <PadInstances
            board={scene.board}
            pads={visibleBottomPads}
            copperColor={renderOptions.copperColor}
            opacity={getLayerOpacity(layerSettings, 'bottom-copper')}
            clippingPlanes={clippingPlanes}
            explodeOffset={explodeOffset}
          />
          <ComponentInstances
            board={scene.board}
            components={scene.components}
            highlightedRefDes={highlightedRefDes}
            selectedComponentId={selectedComponentId}
            hoveredComponentId={hoveredComponentId}
            clippingPlanes={clippingPlanes}
            explodeOffset={explodeOffset}
            onSelectComponent={onSelectComponent}
            onHoverComponent={onHoverComponent}
          />
          <SelectedComponentOutline board={scene.board} component={selectedComponent} explodeOffset={explodeOffset} />
          <ComponentHoverTooltip board={scene.board} component={hoveredComponent} explodeOffset={explodeOffset} />
          <MeasureTool
            board={scene.board}
            active={measureActive}
            pendingPoint={pendingMeasurePoint}
            segments={measureSegments}
            onMeasurePoint={onMeasurePoint}
          />
          <SectionPlaneGizmo
            board={scene.board}
            enabled={sectionEnabled}
            constant={sectionConstant}
            onChangeConstant={onSectionConstantChange}
          />
        </group>
      </Bvh>
    </Bounds>
  );
}
