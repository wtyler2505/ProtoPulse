/**
 * keyboard-controls — keyboard navigation for the WebGL board viewer
 * (PP3D-8; fixes UI-3D-06/11, unblocks BL-0870).
 *
 * Bindings (plan §7): arrow keys orbit, +/− dolly, R reset (home), F flips
 * the board, X toggles the exploded view, digits 1–7 jump to presets,
 * Escape clears the selection. Shift+arrows orbit in fine steps.
 *
 * Split for testability:
 *   - `resolveKeyboardAction` — pure key → ViewerAction reducer.
 *   - `describeViewerAction`  — pure action → aria-live announcement text.
 *   - `applyCameraAction`     — drives a structural {@link CameraRig}
 *     (satisfied by the drei `CameraControls` instance, i.e. yomotsu
 *     camera-controls: `rotate`, `rotatePolarTo`, `dolly`, `setLookAt`,
 *     `reset` all take a final `enableTransition` flag — confirmed via
 *     Context7 /yomotsu/camera-controls + /pmndrs/drei). The structural
 *     interface lets unit tests substitute a recording stub.
 */

import {
  CAMERA_PRESET_LABELS,
  CAMERA_PRESET_ORDER,
  flippedPolarAngle,
  presetDistance,
  presetPose,
} from './camera-presets';

import type { CameraPresetId, PresetBoardDims } from './camera-presets';

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Coarse orbit step per arrow-key press (degrees). */
export const ORBIT_STEP_DEG = 15;

/** Fine orbit step with Shift held (degrees). */
export const ORBIT_FINE_STEP_DEG = 3;

/** Dolly step per +/− press, as a fraction of the preset camera distance. */
export const DOLLY_STEP_RATIO = 0.15;

export type ViewerAction =
  | { type: 'orbit'; azimuthDeg: number; polarDeg: number }
  | { type: 'dolly'; direction: 1 | -1 }
  | { type: 'preset'; preset: CameraPresetId }
  | { type: 'flip' }
  | { type: 'reset' }
  | { type: 'explode-toggle' }
  | { type: 'clear-selection' };

/** The minimal keyboard-event surface the reducer needs. */
export interface ViewerKeyInput {
  key: string;
  shiftKey?: boolean;
}

/**
 * Map a keyboard event to a viewer action, or `null` when the key is not
 * bound (so the caller can let it propagate — e.g. Tab keeps tabbing).
 */
export function resolveKeyboardAction(input: ViewerKeyInput): ViewerAction | null {
  const { key, shiftKey } = input;
  const step = shiftKey ? ORBIT_FINE_STEP_DEG : ORBIT_STEP_DEG;

  switch (key) {
    case 'ArrowLeft':
      return { type: 'orbit', azimuthDeg: -step, polarDeg: 0 };
    case 'ArrowRight':
      return { type: 'orbit', azimuthDeg: step, polarDeg: 0 };
    case 'ArrowUp':
      return { type: 'orbit', azimuthDeg: 0, polarDeg: -step };
    case 'ArrowDown':
      return { type: 'orbit', azimuthDeg: 0, polarDeg: step };
    case '+':
    case '=':
      return { type: 'dolly', direction: 1 };
    case '-':
    case '_':
      return { type: 'dolly', direction: -1 };
    case 'r':
    case 'R':
    case 'Home':
      return { type: 'reset' };
    case 'f':
    case 'F':
      return { type: 'flip' };
    case 'x':
    case 'X':
      return { type: 'explode-toggle' };
    case 'Escape':
      return { type: 'clear-selection' };
    default: {
      const digit = Number.parseInt(key, 10);
      if (Number.isInteger(digit) && digit >= 1 && digit <= CAMERA_PRESET_ORDER.length) {
        return { type: 'preset', preset: CAMERA_PRESET_ORDER[digit - 1] };
      }
      return null;
    }
  }
}

/** Screen-reader announcement for an action (aria-live, fixes UI-3D-11). */
export function describeViewerAction(action: ViewerAction): string {
  switch (action.type) {
    case 'orbit': {
      if (action.azimuthDeg !== 0) {
        return action.azimuthDeg < 0 ? 'Orbiting left' : 'Orbiting right';
      }
      return action.polarDeg < 0 ? 'Orbiting up' : 'Orbiting down';
    }
    case 'dolly':
      return action.direction === 1 ? 'Zooming in' : 'Zooming out';
    case 'preset':
      return CAMERA_PRESET_LABELS[action.preset];
    case 'flip':
      return 'Board flipped';
    case 'reset':
      return 'View reset to home';
    case 'explode-toggle':
      return 'Exploded view toggled';
    case 'clear-selection':
      return 'Selection cleared';
  }
}

// ---------------------------------------------------------------------------
// Camera rig
// ---------------------------------------------------------------------------

/**
 * Structural subset of the camera-controls API that viewer actions drive.
 * The drei `<CameraControls>` ref satisfies this directly; unit tests use a
 * recording stub.
 */
export interface CameraRig {
  /** Current polar angle (radians, measured from +y). */
  polarAngle: number;
  rotate(azimuthAngle: number, polarAngle: number, enableTransition?: boolean): unknown;
  rotatePolarTo(polarAngle: number, enableTransition?: boolean): unknown;
  dolly(distance: number, enableTransition?: boolean): unknown;
  setLookAt(
    positionX: number,
    positionY: number,
    positionZ: number,
    targetX: number,
    targetY: number,
    targetZ: number,
    enableTransition?: boolean,
  ): unknown;
  reset(enableTransition?: boolean): unknown;
}

const DEG2RAD = Math.PI / 180;

/**
 * Execute a camera-facing {@link ViewerAction} against a {@link CameraRig}.
 * Returns `true` when the action was a camera action (handled here);
 * `false` for `explode-toggle` / `clear-selection`, which the component
 * layer owns.
 */
export function applyCameraAction(
  rig: CameraRig,
  action: ViewerAction,
  dims: PresetBoardDims,
): boolean {
  switch (action.type) {
    case 'orbit':
      rig.rotate(action.azimuthDeg * DEG2RAD, action.polarDeg * DEG2RAD, true);
      return true;
    case 'dolly':
      rig.dolly(action.direction * presetDistance(dims) * DOLLY_STEP_RATIO, true);
      return true;
    case 'preset': {
      if (action.preset === 'home') {
        rig.reset(true);
        return true;
      }
      const pose = presetPose(action.preset, dims);
      rig.setLookAt(
        pose.position.x,
        pose.position.y,
        pose.position.z,
        pose.target.x,
        pose.target.y,
        pose.target.z,
        true,
      );
      return true;
    }
    case 'flip':
      rig.rotatePolarTo(flippedPolarAngle(rig.polarAngle), true);
      return true;
    case 'reset':
      rig.reset(true);
      return true;
    case 'explode-toggle':
    case 'clear-selection':
      return false;
  }
}
