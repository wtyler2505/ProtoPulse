/**
 * ViewCube — the navigation gizmo cube for the WebGL board viewer (PP3D-1).
 *
 * Renders drei's `<GizmoHelper>` with a `<GizmoViewcube>` child. Because the
 * scene's `<CameraControls>` is mounted with `makeDefault`, clicking a cube
 * face animates the default camera to that orientation with no extra wiring
 * (confirmed via Context7: makeDefault controls supply onTarget/onUpdate).
 */

import { GizmoHelper, GizmoViewcube } from '@react-three/drei';

export interface ViewCubeProps {
  /** Corner placement of the gizmo within the canvas. */
  alignment?:
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right'
    | 'top-center'
    | 'bottom-center'
    | 'center-left'
    | 'center-right'
    | 'center-center';
  /** Pixel margin from the aligned corner, [x, y]. */
  margin?: [number, number];
}

export function ViewCube({ alignment = 'top-right', margin = [72, 72] }: ViewCubeProps) {
  return (
    <GizmoHelper alignment={alignment} margin={margin}>
      <GizmoViewcube />
    </GizmoHelper>
  );
}

export default ViewCube;
