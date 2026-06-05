/**
 * WebGLBoardViewer — the WebGL (@react-three/fiber) 3D board viewer (PP3D-1).
 *
 * Phase 1 scaffold: a real, demand-rendered R3F `<Canvas>` hosting an extruded
 * board substrate, basic lighting, CAD-style `<CameraControls>`, a navigation
 * `<GizmoViewcube>`, and a `<Bounds fit>` auto-frame. No project data yet —
 * default board dimensions only (Phase 2 wires real data).
 *
 * The outer chrome mirrors the CSS viewer's title bar so the two engines feel
 * like one feature behind the `viewer3dEngine` flag.
 */

import { Canvas } from '@react-three/fiber';
import { Box } from 'lucide-react';

import { BoardScene } from './scene/BoardScene';

/** Background clear color for the viewport (dark studio). Distinct from the
 *  board green so the non-blank-canvas variance gate has signal. */
const VIEWPORT_BACKGROUND = '#15161d';

export default function WebGLBoardViewer() {
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
          <BoardScene />
        </Canvas>
      </div>
    </div>
  );
}
