/**
 * ViewerCamera — CAD-style orbit/pan/zoom controls for the WebGL board viewer.
 *
 * Wraps drei's `<CameraControls>` (yomotsu camera-controls 3.x) with
 * `makeDefault` so other drei helpers — notably `<GizmoHelper>`/`<Bounds>` —
 * pick it up as the scene's default controls automatically (confirmed via
 * Context7: with `makeDefault`, GizmoHelper needs no onTarget/onUpdate wiring).
 *
 * `CameraControls` calls `invalidate()` on change internally, so it plays well
 * with the parent `<Canvas frameloop="demand">`.
 */

import { CameraControls } from '@react-three/drei';

export interface ViewerCameraProps {
  /** Minimum dolly distance (world units / mm). */
  minDistance?: number;
  /** Maximum dolly distance (world units / mm). */
  maxDistance?: number;
}

export function ViewerCamera({ minDistance = 10, maxDistance = 1000 }: ViewerCameraProps) {
  return (
    <CameraControls
      makeDefault
      minDistance={minDistance}
      maxDistance={maxDistance}
      dollyToCursor
    />
  );
}

export default ViewerCamera;
