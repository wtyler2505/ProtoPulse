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
 *
 * PP3D-8: the camera-controls instance is exposed via a forwarded ref so the
 * out-of-canvas toolbar / keyboard layer can drive `setLookAt` presets, the
 * board flip and dolly/orbit steps. The first time the controls come to rest
 * (after the initial `<Bounds fit>` framing transition) the pose is captured
 * with `saveState()`, making "Home"/`reset(true)` return to the framed board
 * (camera-controls readme: `saveState()` sets the state `reset()` restores —
 * Context7 /yomotsu/camera-controls; drei exposes the `rest` event as
 * `onRest` — Context7 /pmndrs/drei).
 */

import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';

import { CameraControls } from '@react-three/drei';

import type { CameraControlsImpl } from '@react-three/drei';

export interface ViewerCameraProps {
  /** Minimum dolly distance (world units / mm). */
  minDistance?: number;
  /** Maximum dolly distance (world units / mm). */
  maxDistance?: number;
}

export const ViewerCamera = forwardRef<CameraControlsImpl | null, ViewerCameraProps>(
  function ViewerCamera({ minDistance = 10, maxDistance = 1000 }, ref) {
    const controlsRef = useRef<CameraControlsImpl | null>(null);
    const savedHome = useRef(false);

    useImperativeHandle(ref, () => {
      if (controlsRef.current === null) {
        throw new Error('Camera controls are not mounted');
      }
      return controlsRef.current;
    }, []);

    // Capture the post-`<Bounds fit>` pose as the saved "home" state exactly
    // once, on the first rest after mount.
    const handleRest = useCallback(() => {
      if (savedHome.current || !controlsRef.current) return;
      controlsRef.current.saveState();
      savedHome.current = true;
    }, []);

    return (
      <CameraControls
        ref={controlsRef}
        makeDefault
        minDistance={minDistance}
        maxDistance={maxDistance}
        dollyToCursor
        onRest={handleRest}
      />
    );
  },
);

export default ViewerCamera;
