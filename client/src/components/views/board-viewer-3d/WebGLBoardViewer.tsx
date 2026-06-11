import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  ContactShadows,
  GizmoHelper,
  GizmoViewcube,
} from '@react-three/drei';
import type { BoardScene as BoardSceneModel, LayerType3D, RenderOptions } from '@/lib/board-viewer-3d';
import {
  isLayerVisible,
  type WebGLLayerSetting,
  type WebGLLayerSettings,
} from './layer-settings';
import { buildPadRenderInstances } from './model/geometry';
import { InspectorPanel } from './panels/InspectorPanel';
import { LayerPanel } from './panels/LayerPanel';
import { SceneToolsPanel } from './panels/SceneToolsPanel';
import { BoardScene, getSceneSignature } from './scene/BoardScene';
import {
  CameraControlsRig,
  getCameraPresetLabel,
  type CameraCommand,
  type PendingCameraCommand,
  type CameraViewPreset,
} from './scene/CameraControlsRig';
import {
  getMeasurementDistanceMm,
  type MeasurePoint3D,
  type WebGLMeasureSegment,
} from './scene/measurement';
import { RendererInfoProbe, type WebGLRenderStats } from './scene/RendererInfoProbe';
import { clampSectionPlaneConstant, getSectionPlaneRange } from './scene/section-plane';
import { useExplodedView } from './scene/useExplodedView';

interface WebGLBoardViewerProps {
  scene: BoardSceneModel;
  renderOptions: RenderOptions;
  layerVisibility: LayerType3D[];
  highlightedRefDes: ReadonlySet<string>;
  showEmptyHint?: boolean;
}

const EMPTY_RENDER_STATS: WebGLRenderStats = {
  calls: 0,
  triangles: 0,
  lines: 0,
  points: 0,
  geometries: 0,
  textures: 0,
};

function getDrawCallBudget(scene: BoardSceneModel): number {
  return Math.max(96, scene.traces.length + 36);
}

function buildLayerSettings(
  scene: BoardSceneModel,
  inheritedLayerVisibility: readonly LayerType3D[],
  current?: WebGLLayerSettings,
): WebGLLayerSettings {
  const inheritedVisible = new Set(inheritedLayerVisibility);
  const next: WebGLLayerSettings = {};
  for (const layer of scene.layers) {
    const existing = current?.[layer.type];
    const setting: WebGLLayerSetting = existing ?? {
      visible: layer.visible && inheritedVisible.has(layer.type),
      opacity: Math.min(1, Math.max(0.15, layer.opacity)),
    };
    next[layer.type] = setting;
  }
  return next;
}

function isInteractiveKeyboardTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('button, input, select, textarea, a, [contenteditable="true"]'));
}

export default function WebGLBoardViewer(props: WebGLBoardViewerProps) {
  const { scene, renderOptions, layerVisibility, highlightedRefDes, showEmptyHint = false } = props;
  const boardMax = Math.max(scene.board.width, scene.board.height);
  const [renderStats, setRenderStats] = useState<WebGLRenderStats>(EMPTY_RENDER_STATS);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [hoveredComponentId, setHoveredComponentId] = useState<string | null>(null);
  const [measureActive, setMeasureActive] = useState(false);
  const [pendingMeasurePoint, setPendingMeasurePoint] = useState<MeasurePoint3D | null>(null);
  const [measureSegments, setMeasureSegments] = useState<WebGLMeasureSegment[]>([]);
  const [sectionEnabled, setSectionEnabled] = useState(false);
  const [sectionConstant, setSectionConstant] = useState(0);
  const [cameraCommand, setCameraCommand] = useState<CameraCommand | null>(null);
  const [cameraPreset, setCameraPreset] = useState<CameraViewPreset>('home');
  const [cameraStatus, setCameraStatus] = useState(getCameraPresetLabel('home'));
  const [cameraFlipped, setCameraFlipped] = useState(false);
  const measureIdRef = useRef(0);
  const cameraCommandIdRef = useRef(0);
  const {
    exploded,
    progress: explodedProgress,
    animating: explodeAnimating,
    toggleExploded,
  } = useExplodedView();
  const [layerSettings, setLayerSettings] = useState<WebGLLayerSettings>(() =>
    buildLayerSettings(scene, layerVisibility),
  );
  const sceneSignature = useMemo(() => getSceneSignature(scene), [scene]);
  const pads = useMemo(() => buildPadRenderInstances(scene), [scene]);
  const padCount = pads.length;
  const visiblePadCount = useMemo(
    () => pads.filter((pad) => isLayerVisible(layerSettings, pad.layer)).length,
    [layerSettings, pads],
  );
  const drawCallBudget = useMemo(() => getDrawCallBudget(scene), [scene]);
  const sectionRange = useMemo(() => getSectionPlaneRange(scene.board), [scene.board]);
  const latestMeasureSegment = measureSegments.at(-1) ?? null;
  const selectedComponent = useMemo(
    () => scene.components.find((component) => component.id === selectedComponentId) ?? null,
    [scene.components, selectedComponentId],
  );
  const hoveredComponent = useMemo(
    () => scene.components.find((component) => component.id === hoveredComponentId) ?? null,
    [hoveredComponentId, scene.components],
  );
  const handleRenderStats = useCallback((stats: WebGLRenderStats) => {
    setRenderStats((current) =>
      current.calls === stats.calls &&
      current.triangles === stats.triangles &&
      current.lines === stats.lines &&
      current.points === stats.points &&
      current.geometries === stats.geometries &&
      current.textures === stats.textures
        ? current
        : stats,
    );
  }, []);
  const handleSelectComponent = useCallback((componentId: string) => {
    setSelectedComponentId(componentId);
  }, []);
  const handleHoverComponent = useCallback((componentId: string | null) => {
    setHoveredComponentId((current) => (current === componentId ? current : componentId));
  }, []);
  const handleClearSelection = useCallback(() => {
    setSelectedComponentId(null);
  }, []);
  const handleToggleLayer = useCallback((layer: LayerType3D) => {
    setLayerSettings((current) => ({
      ...current,
      [layer]: {
        visible: !(current[layer]?.visible ?? true),
        opacity: current[layer]?.opacity ?? 1,
      },
    }));
  }, []);
  const handleSetLayerOpacity = useCallback((layer: LayerType3D, opacity: number) => {
    setLayerSettings((current) => ({
      ...current,
      [layer]: {
        visible: current[layer]?.visible ?? true,
        opacity,
      },
    }));
  }, []);
  const handleToggleMeasure = useCallback(() => {
    setMeasureActive((current) => !current);
    setHoveredComponentId(null);
  }, []);
  const handleClearMeasurements = useCallback(() => {
    setPendingMeasurePoint(null);
    setMeasureSegments([]);
  }, []);
  const handleMeasurePoint = useCallback(
    (point: MeasurePoint3D) => {
      if (!pendingMeasurePoint) {
        setPendingMeasurePoint(point);
        return;
      }

      measureIdRef.current += 1;
      const distanceMm = getMeasurementDistanceMm(pendingMeasurePoint, point);
      setMeasureSegments((current) => [
        ...current,
        {
          id: `m${measureIdRef.current}`,
          start: pendingMeasurePoint,
          end: point,
          distanceMm,
        },
      ]);
      setPendingMeasurePoint(null);
    },
    [pendingMeasurePoint],
  );
  const handleToggleSection = useCallback(() => {
    setSectionEnabled((current) => !current);
  }, []);
  const handleSetSectionConstant = useCallback(
    (constant: number) => {
      setSectionConstant(clampSectionPlaneConstant(constant, scene.board));
    },
    [scene.board],
  );
  const issueCameraCommand = useCallback((command: PendingCameraCommand) => {
    cameraCommandIdRef.current += 1;
    setCameraCommand({ ...command, id: cameraCommandIdRef.current });
    setCameraStatus(command.label);
  }, []);
  const handleCameraPreset = useCallback(
    (preset: CameraViewPreset | 'flip') => {
      const nextPreset = preset === 'flip' ? (cameraFlipped ? 'top' : 'bottom') : preset;
      setCameraPreset(nextPreset);
      setCameraFlipped(nextPreset === 'bottom');
      issueCameraCommand({
        type: 'preset',
        preset: nextPreset,
        label: getCameraPresetLabel(nextPreset),
      });
    },
    [cameraFlipped, issueCameraCommand],
  );
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (isInteractiveKeyboardTarget(event.target)) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        issueCameraCommand({ type: 'orbit', azimuth: -Math.PI / 12, polar: 0, label: 'Orbit left' });
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        issueCameraCommand({ type: 'orbit', azimuth: Math.PI / 12, polar: 0, label: 'Orbit right' });
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        issueCameraCommand({ type: 'orbit', azimuth: 0, polar: -Math.PI / 18, label: 'Orbit up' });
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        issueCameraCommand({ type: 'orbit', azimuth: 0, polar: Math.PI / 18, label: 'Orbit down' });
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        issueCameraCommand({ type: 'dolly', distance: -Math.max(1, boardMax * 0.12), label: 'Zoom in' });
      } else if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        issueCameraCommand({ type: 'dolly', distance: Math.max(1, boardMax * 0.12), label: 'Zoom out' });
      } else if (event.key.toLowerCase() === 'r') {
        event.preventDefault();
        handleCameraPreset('home');
      } else if (event.key === '1') {
        event.preventDefault();
        handleCameraPreset('iso');
      } else if (event.key === '2') {
        event.preventDefault();
        handleCameraPreset('top');
      } else if (event.key === '3') {
        event.preventDefault();
        handleCameraPreset('bottom');
      } else if (event.key === '4') {
        event.preventDefault();
        handleCameraPreset('front');
      } else if (event.key === '5') {
        event.preventDefault();
        handleCameraPreset('flip');
      }
    },
    [boardMax, handleCameraPreset, issueCameraCommand],
  );

  useEffect(() => {
    if (selectedComponentId && !selectedComponent) {
      setSelectedComponentId(null);
    }
  }, [selectedComponent, selectedComponentId]);

  useEffect(() => {
    if (hoveredComponentId && !hoveredComponent) {
      setHoveredComponentId(null);
    }
  }, [hoveredComponent, hoveredComponentId]);

  useEffect(() => {
    setLayerSettings((current) => buildLayerSettings(scene, layerVisibility, current));
  }, [layerVisibility, scene]);

  useEffect(() => {
    setSectionConstant((current) => clampSectionPlaneConstant(current, scene.board));
  }, [scene.board]);

  return (
    <div
      data-testid="viewer-3d-webgl-engine"
      data-component-count={scene.components.length}
      data-pad-count={padCount}
      data-visible-pad-count={visiblePadCount}
      data-trace-count={scene.traces.length}
      data-via-count={scene.vias.length}
      data-render-calls={renderStats.calls}
      data-render-call-budget={drawCallBudget}
      data-render-triangles={renderStats.triangles}
      data-render-geometries={renderStats.geometries}
      data-selected-component-id={selectedComponent?.id ?? ''}
      data-selected-refdes={selectedComponent?.refDes ?? ''}
      data-hovered-component-id={hoveredComponent?.id ?? ''}
      data-hovered-refdes={hoveredComponent?.refDes ?? ''}
      data-measure-active={measureActive ? 'true' : 'false'}
      data-measure-pending={pendingMeasurePoint ? 'true' : 'false'}
      data-measure-segment-count={measureSegments.length}
      data-latest-measure-distance-mm={latestMeasureSegment?.distanceMm.toFixed(2) ?? ''}
      data-section-enabled={sectionEnabled ? 'true' : 'false'}
      data-section-constant={sectionConstant.toFixed(2)}
      data-exploded={exploded ? 'true' : 'false'}
      data-explode-animating={explodeAnimating ? 'true' : 'false'}
      data-explode-progress={explodedProgress.toFixed(2)}
      data-camera-preset={cameraPreset}
      data-camera-command={cameraStatus}
      data-layer-substrate-visible={isLayerVisible(layerSettings, 'substrate') ? 'true' : 'false'}
      data-layer-top-copper-visible={isLayerVisible(layerSettings, 'top-copper') ? 'true' : 'false'}
      data-layer-substrate-opacity={(layerSettings.substrate?.opacity ?? 1).toFixed(2)}
      role="application"
      tabIndex={0}
      aria-label="WebGL 3D board viewer. Use arrow keys to orbit, plus and minus to zoom, R for home, and number keys for camera presets."
      onKeyDown={handleKeyDown}
      className="absolute inset-0 h-full min-h-[320px] w-full"
    >
      <Canvas
        data-testid="viewer-3d-webgl-canvas"
        frameloop={explodeAnimating ? 'always' : 'demand'}
        dpr={[1, 2]}
        camera={{ position: [0, boardMax * 0.85, boardMax * 1.15], fov: 45, near: 0.1, far: boardMax * 8 }}
        gl={{
          antialias: true,
          alpha: false,
          preserveDrawingBuffer: true,
          powerPreference: 'high-performance',
        }}
        onPointerMissed={() => {
          handleClearSelection();
          handleHoverComponent(null);
        }}
        style={{ height: '100%', width: '100%', background: renderOptions.backgroundColor }}
        fallback={
          <div
            data-testid="viewer-3d-webgl-fallback"
            className="flex h-full items-center justify-center text-xs text-red-300"
          >
            WebGL unavailable
          </div>
        }
      >
        <color attach="background" args={[renderOptions.backgroundColor]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[0, boardMax * 0.8, boardMax * 0.4]} intensity={2.2} />
        <directionalLight position={[-boardMax * 0.6, boardMax * 0.5, -boardMax * 0.5]} intensity={0.55} />
        <BoardScene
          scene={scene}
          renderOptions={renderOptions}
          layerSettings={layerSettings}
          highlightedRefDes={highlightedRefDes}
          selectedComponentId={selectedComponentId}
          hoveredComponentId={hoveredComponentId}
          measureActive={measureActive}
          pendingMeasurePoint={pendingMeasurePoint}
          measureSegments={measureSegments}
          sectionEnabled={sectionEnabled}
          sectionConstant={sectionConstant}
          explodedProgress={explodedProgress}
          onSelectComponent={handleSelectComponent}
          onHoverComponent={handleHoverComponent}
          onMeasurePoint={handleMeasurePoint}
          onSectionConstantChange={handleSetSectionConstant}
        />
        <RendererInfoProbe signature={sceneSignature} onStats={handleRenderStats} />
        <ContactShadows
          position={[0, -scene.board.thickness / 2 - 0.1, 0]}
          opacity={0.32}
          scale={boardMax * 1.25}
          blur={1.8}
          far={boardMax}
          resolution={256}
          frames={1}
        />
        <CameraControlsRig boardMax={boardMax} command={cameraCommand} onCommandSettled={setCameraStatus} />
        <GizmoHelper alignment="top-right" margin={[72, 72]}>
          <GizmoViewcube />
        </GizmoHelper>
      </Canvas>
      <LayerPanel
        layers={scene.layers}
        settings={layerSettings}
        onToggleLayer={handleToggleLayer}
        onSetLayerOpacity={handleSetLayerOpacity}
      />
      <SceneToolsPanel
        measureActive={measureActive}
        measurePending={pendingMeasurePoint != null}
        measureSegmentCount={measureSegments.length}
        latestMeasureDistanceMm={latestMeasureSegment?.distanceMm ?? null}
        sectionEnabled={sectionEnabled}
        sectionConstant={sectionConstant}
        sectionRange={sectionRange}
        exploded={exploded}
        explodeProgress={explodedProgress}
        explodeAnimating={explodeAnimating}
        cameraPreset={cameraPreset}
        cameraStatus={cameraStatus}
        onToggleMeasure={handleToggleMeasure}
        onClearMeasures={handleClearMeasurements}
        onToggleSection={handleToggleSection}
        onSetSectionConstant={handleSetSectionConstant}
        onToggleExploded={toggleExploded}
        onCameraPreset={handleCameraPreset}
      />
      <div data-testid="viewer-3d-webgl-camera-status" className="sr-only" aria-live="polite">
        {cameraStatus}
      </div>
      {showEmptyHint && (
        <div
          data-testid="viewer-3d-webgl-empty-hint"
          className="pointer-events-none absolute bottom-3 left-3 max-w-[18rem] rounded-md border border-border/70 bg-background/85 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur"
        >
          WebGL prototype is rendering the board shell. Place PCB parts to populate component geometry.
        </div>
      )}
      {selectedComponent && <InspectorPanel component={selectedComponent} onClear={handleClearSelection} />}
    </div>
  );
}
