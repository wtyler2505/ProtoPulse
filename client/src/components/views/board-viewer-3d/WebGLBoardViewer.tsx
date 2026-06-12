/**
 * WebGLBoardViewer — the WebGL (@react-three/fiber) 3D board viewer (PP3D-1/PP3D-4).
 *
 * Hosts a demand-rendered R3F `<Canvas>` with the extruded board substrate,
 * CAD-style `<CameraControls>`, a navigation `<GizmoViewcube>`, and — as of
 * PP3D-4 — the REAL project data path: `useProjectBoard` + `useCircuit*`
 * feed the pure `buildSceneModel()` transform, whose memoised output drives
 * `SceneModelView` inside `BoardScene`.
 *
 * PP3D-5 adds picking: clicks raycast the scene (drei `<Bvh>` accelerated),
 * the picked element is outlined and described in the `InspectorPanel`, and a
 * double-click fits the camera onto the element. Selection state lives in
 * `usePicking`; all display data comes from the pure `describeSelection`.
 *
 * PP3D-8 adds camera presets/flip + the exploded view + keyboard navigation:
 * a toolbar of focusable preset/flip/home/explode buttons, a focusable
 * viewport (`role="application"`) whose key bindings drive the
 * camera-controls rig via the pure `resolveKeyboardAction`/`applyCameraAction`
 * pair, and an `aria-live` region announcing every action (UI-3D-06/11,
 * unblocks BL-0870).
 *
 * The outer chrome mirrors the CSS viewer's title bar so the two engines feel
 * like one feature behind the `viewer3dEngine` flag.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { Canvas } from '@react-three/fiber';
import { Box } from 'lucide-react';

import { useProjectBoard } from '@/hooks/useProjectBoard';
import {
  useCircuitDesigns,
  useCircuitInstances,
  useCircuitNets,
  useCircuitVias,
  useCircuitWires,
} from '@/lib/circuit-editor/hooks';
import { useProjectId } from '@/lib/contexts/project-id-context';

import {
  applyCameraAction,
  describeViewerAction,
  resolveKeyboardAction,
} from './controls/keyboard-controls';
import { ViewerToolbar } from './controls/ViewerToolbar';
import { buildSceneModel } from './model/buildSceneModel';
import { describeSelection } from './model/scene-lookup';
import { InspectorPanel } from './panels/InspectorPanel';
import { BoardScene } from './scene/BoardScene';
import { usePicking } from './tools/usePicking';

import type { ViewerAction } from './controls/keyboard-controls';
import type { SceneSelection } from './model/scene-model';
import type { CameraControlsImpl } from '@react-three/drei';


/** Background clear color for the viewport (dark studio). Distinct from the
 *  board green so the non-blank-canvas variance gate has signal. */
const VIEWPORT_BACKGROUND = '#15161d';

export default function WebGLBoardViewer() {
  const projectId = useProjectId();
  const { board } = useProjectBoard(projectId);

  // A project's PCB renders its first circuit design (same convention the
  // PCB layout view uses). `enabled: circuitId > 0` keeps the child queries
  // idle until a design exists.
  const { data: designs } = useCircuitDesigns(projectId);
  const circuitId = designs?.[0]?.id ?? 0;

  const { data: instances } = useCircuitInstances(circuitId);
  const { data: wires } = useCircuitWires(circuitId);
  const { data: vias } = useCircuitVias(circuitId);
  const { data: nets } = useCircuitNets(circuitId);

  // Pure transform, memoised on query-data identity (plan §6): recomputes only
  // when the board row or circuit data actually changes — never per frame.
  const model = useMemo(
    () =>
      buildSceneModel({
        board: {
          widthMm: board.widthMm,
          heightMm: board.heightMm,
          thicknessMm: board.thicknessMm,
          cornerRadiusMm: board.cornerRadiusMm,
          layers: board.layers,
          finish: board.finish,
          solderMaskColor: board.solderMaskColor,
          silkscreenColor: board.silkscreenColor,
        },
        instances: instances ?? [],
        wires: wires ?? [],
        vias: vias ?? [],
        nets: nets ?? [],
      }),
    [board, instances, wires, vias, nets],
  );

  // --- Picking (PP3D-5) ---
  const { selection, pick, clear, set } = usePicking();
  const [focusNonce, setFocusNonce] = useState(0);

  // --- Camera presets / flip / exploded view / keyboard nav (PP3D-8) ---
  const controlsRef = useRef<CameraControlsImpl | null>(null);
  const [exploded, setExploded] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  /** Double-click: select the element (non-toggling) and fit the camera. */
  const handleFocus = useCallback(
    (target: SceneSelection) => {
      set(target);
      setFocusNonce((n) => n + 1);
    },
    [set],
  );

  const details = useMemo(() => describeSelection(model, selection), [model, selection]);

  /**
   * Execute a viewer action from the toolbar or keyboard: camera actions go
   * to the camera-controls rig, the rest (explode toggle, clear selection)
   * are component state. Every action is announced via the aria-live region
   * (fixes UI-3D-11).
   */
  const handleViewerAction = useCallback(
    (action: ViewerAction) => {
      switch (action.type) {
        case 'explode-toggle':
          setExploded((on) => {
            setAnnouncement(on ? 'Exploded view off' : 'Exploded view on');
            return !on;
          });
          return;
        case 'clear-selection':
          clear();
          setAnnouncement(describeViewerAction(action));
          return;
        default: {
          const rig = controlsRef.current;
          if (!rig) return;
          applyCameraAction(rig, action, {
            widthMm: model.board.widthMm,
            heightMm: model.board.heightMm,
            thicknessMm: model.board.thicknessMm,
          });
          setAnnouncement(describeViewerAction(action));
        }
      }
    },
    [clear, model.board.widthMm, model.board.heightMm, model.board.thicknessMm],
  );

  /** Keyboard navigation on the focusable viewport (BL-0870, plan §7). */
  const handleViewportKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const action = resolveKeyboardAction({ key: event.key, shiftKey: event.shiftKey });
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      handleViewerAction(action);
    },
    [handleViewerAction],
  );

  return (
    <div data-testid="board-viewer-3d-view" className="flex flex-col h-full gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Box className="w-5 h-5 text-primary" />
          <h2 data-testid="viewer-title" className="text-lg font-semibold">
            3D Board Viewer
          </h2>
        </div>
        <ViewerToolbar onAction={handleViewerAction} exploded={exploded} />
      </div>

      {/* Screen-reader announcements for camera/selection changes (UI-3D-11). */}
      <p aria-live="polite" className="sr-only" data-testid="viewer-3d-announcer">
        {announcement}
      </p>

      {/* WebGL viewport */}
      {/* The viewport is the keyboard-interaction surface for the WebGL canvas
          (role="application" is the canonical pattern for canvas keyboard nav;
          the listeners/tabIndex are intentional — BL-0870). */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- canvas keyboard navigation surface */}
      <div
        data-testid="board-3d-viewport"
        role="application"
        aria-label="3D board viewer. Arrow keys orbit, plus and minus zoom, F flips the board, X toggles the exploded view, R resets the view, digits 1 to 7 jump to preset views, Escape clears the selection."
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- focusable canvas wrapper is required for keyboard navigation (BL-0870)
        tabIndex={0}
        onKeyDown={handleViewportKeyDown}
        className="relative flex-1 min-h-0 rounded-lg border border-border/50 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ backgroundColor: VIEWPORT_BACKGROUND }}
      >
        <Canvas
          data-testid="board-3d-canvas"
          frameloop="demand"
          dpr={[1, 2]}
          shadows
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          camera={{ position: [120, 120, 120], fov: 45, near: 0.1, far: 5000 }}
          onCreated={({ gl }) => {
            gl.setClearColor(VIEWPORT_BACKGROUND);
          }}
          onPointerMissed={clear}
        >
          <BoardScene
            model={model}
            selection={selection}
            onPick={pick}
            onFocus={handleFocus}
            focusNonce={focusNonce}
            explodeTarget={exploded ? 1 : 0}
            controlsRef={controlsRef}
          />
        </Canvas>

        {/* Inspector for the picked element (PP3D-5). */}
        <InspectorPanel details={details} onClose={clear} />
      </div>
    </div>
  );
}
