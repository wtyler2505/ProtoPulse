/**
 * camera-presets — pure camera preset poses for the WebGL board viewer (PP3D-8).
 *
 * Each preset is a deterministic {position, target} pair in scene space
 * (x = board width, z = board depth, y = up/board normal), derived from the
 * board's dimensions so any board size frames sensibly. The impure layer
 * (`applyCameraAction` / the toolbar) feeds these into camera-controls'
 * `setLookAt(px, py, pz, tx, ty, tz, true)` for an animated move
 * (camera-controls readme: https://github.com/yomotsu/camera-controls —
 * confirmed via Context7 /yomotsu/camera-controls).
 *
 * Pure module: no three.js, no React. Unit-tested in
 * `__tests__/camera-presets.test.ts`.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** A camera pose: where the camera sits and what it looks at. */
export interface CameraPose {
  position: Vec3;
  target: Vec3;
}

/** The board dimensions a preset needs to compute a sensible distance. */
export interface PresetBoardDims {
  widthMm: number;
  heightMm: number;
  thicknessMm: number;
}

/** All preset identifiers. `home` restores the saved camera state. */
export type CameraPresetId =
  | 'home'
  | 'top'
  | 'bottom'
  | 'front'
  | 'back'
  | 'left'
  | 'right'
  | 'iso';

/** Keyboard ordering: digit `n` jumps to `CAMERA_PRESET_ORDER[n-1]`. */
export const CAMERA_PRESET_ORDER: readonly CameraPresetId[] = [
  'top',
  'bottom',
  'front',
  'back',
  'left',
  'right',
  'iso',
];

/** Human labels (toolbar tooltips + aria-live announcements). */
export const CAMERA_PRESET_LABELS: Readonly<Record<CameraPresetId, string>> = {
  home: 'Home view',
  top: 'Top view',
  bottom: 'Bottom view',
  front: 'Front view',
  back: 'Back view',
  left: 'Left view',
  right: 'Right view',
  iso: 'Isometric view',
};

/** Minimum preset camera distance (mm) so tiny boards don't clip the near plane. */
export const MIN_PRESET_DISTANCE_MM = 60;

/** Distance multiplier on the board diagonal — comfortable full-board framing. */
export const PRESET_DISTANCE_RATIO = 1.35;

/**
 * Tiny lateral offset ratio used for the straight top/bottom poses so the
 * camera never sits exactly on the up-axis pole (degenerate look-at basis).
 */
export const POLE_EPSILON = 0.001;

/** Camera distance for a board: diagonal × ratio, floored. */
export function presetDistance(dims: PresetBoardDims): number {
  const diagonal = Math.hypot(dims.widthMm, dims.heightMm, dims.thicknessMm);
  return Math.max(diagonal * PRESET_DISTANCE_RATIO, MIN_PRESET_DISTANCE_MM);
}

const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };

/** Compute the {position, target} pose for a preset on a given board. */
export function presetPose(preset: CameraPresetId, dims: PresetBoardDims): CameraPose {
  const d = presetDistance(dims);
  // Elevated side views: slightly above the board plane reads better than a
  // perfectly edge-on silhouette (the board is a thin slab).
  const sideLift = d * 0.18;
  const pole = d * POLE_EPSILON;

  switch (preset) {
    case 'top':
      return { position: { x: 0, y: d, z: pole }, target: ORIGIN };
    case 'bottom':
      return { position: { x: 0, y: -d, z: pole }, target: ORIGIN };
    case 'front':
      return { position: { x: 0, y: sideLift, z: d }, target: ORIGIN };
    case 'back':
      return { position: { x: 0, y: sideLift, z: -d }, target: ORIGIN };
    case 'left':
      return { position: { x: -d, y: sideLift, z: 0 }, target: ORIGIN };
    case 'right':
      return { position: { x: d, y: sideLift, z: 0 }, target: ORIGIN };
    case 'home':
    case 'iso': {
      // Equal-component direction (classic CAD iso corner), unit-normalised.
      const c = d / Math.sqrt(3);
      return { position: { x: c, y: c, z: c }, target: ORIGIN };
    }
  }
}

/**
 * Board flip (KiCad/EasyEDA-style): mirror the camera across the board plane
 * so the user sees the opposite face, keeping the same target. In spherical
 * terms (polar measured from +y) that is `polar → π − polar`, which the impure
 * layer applies via camera-controls `rotatePolarTo(π − polarAngle, true)`.
 */
export function flippedPolarAngle(polarAngle: number): number {
  return Math.PI - polarAngle;
}
