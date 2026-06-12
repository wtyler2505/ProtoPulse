/**
 * WebGLBoardViewer — the WebGL (@react-three/fiber) 3D board viewer (PP3D-1/PP3D-4).
 *
 * Hosts a demand-rendered R3F `<Canvas>` with the extruded board substrate,
 * CAD-style `<CameraControls>`, a navigation `<GizmoViewcube>`, and — as of
 * PP3D-4 — the REAL project data path: `useProjectBoard` + `useCircuit*`
 * feed the pure `buildSceneModel()` transform, whose memoised output drives
 * `SceneModelView` inside `BoardScene`.
 *
 * The outer chrome mirrors the CSS viewer's title bar so the two engines feel
 * like one feature behind the `viewer3dEngine` flag.
 */

import { Canvas } from '@react-three/fiber';
import { Box } from 'lucide-react';
import { useMemo } from 'react';

import { useProjectBoard } from '@/hooks/useProjectBoard';
import {
  useCircuitDesigns,
  useCircuitInstances,
  useCircuitVias,
  useCircuitWires,
} from '@/lib/circuit-editor/hooks';
import { useProjectId } from '@/lib/contexts/project-id-context';

import { buildSceneModel } from './model/buildSceneModel';
import { BoardScene } from './scene/BoardScene';

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
      }),
    [board, instances, wires, vias],
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
      </div>

      {/* WebGL viewport */}
      <div
        data-testid="board-3d-viewport"
        className="flex-1 min-h-0 rounded-lg border border-border/50 overflow-hidden"
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
        >
          <BoardScene model={model} />
        </Canvas>
      </div>
    </div>
  );
}
