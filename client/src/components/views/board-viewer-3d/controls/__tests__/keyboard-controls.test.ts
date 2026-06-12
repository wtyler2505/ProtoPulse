import { describe, it, expect } from 'vitest';

import { CAMERA_PRESET_LABELS, presetDistance, presetPose } from '../camera-presets';
import {
  DOLLY_STEP_RATIO,
  ORBIT_FINE_STEP_DEG,
  ORBIT_STEP_DEG,
  applyCameraAction,
  describeViewerAction,
  resolveKeyboardAction,
} from '../keyboard-controls';

import type { PresetBoardDims } from '../camera-presets';
import type { CameraRig, ViewerAction } from '../keyboard-controls';

const BOARD: PresetBoardDims = { widthMm: 100, heightMm: 80, thicknessMm: 1.6 };

/** Recording stub satisfying the structural CameraRig interface. */
function makeRig(polarAngle = Math.PI / 4) {
  const calls: { method: string; args: unknown[] }[] = [];
  const rig: CameraRig = {
    polarAngle,
    rotate: (...args) => calls.push({ method: 'rotate', args }),
    rotatePolarTo: (...args) => calls.push({ method: 'rotatePolarTo', args }),
    dolly: (...args) => calls.push({ method: 'dolly', args }),
    setLookAt: (...args) => calls.push({ method: 'setLookAt', args }),
    reset: (...args) => calls.push({ method: 'reset', args }),
  };
  return { rig, calls };
}

// ---------------------------------------------------------------------------
// resolveKeyboardAction
// ---------------------------------------------------------------------------

describe('resolveKeyboardAction', () => {
  it('maps arrow keys to coarse orbit steps', () => {
    expect(resolveKeyboardAction({ key: 'ArrowLeft' })).toEqual({
      type: 'orbit',
      azimuthDeg: -ORBIT_STEP_DEG,
      polarDeg: 0,
    });
    expect(resolveKeyboardAction({ key: 'ArrowRight' })).toEqual({
      type: 'orbit',
      azimuthDeg: ORBIT_STEP_DEG,
      polarDeg: 0,
    });
    expect(resolveKeyboardAction({ key: 'ArrowUp' })).toEqual({
      type: 'orbit',
      azimuthDeg: 0,
      polarDeg: -ORBIT_STEP_DEG,
    });
    expect(resolveKeyboardAction({ key: 'ArrowDown' })).toEqual({
      type: 'orbit',
      azimuthDeg: 0,
      polarDeg: ORBIT_STEP_DEG,
    });
  });

  it('shift+arrows orbit in fine steps', () => {
    expect(resolveKeyboardAction({ key: 'ArrowLeft', shiftKey: true })).toEqual({
      type: 'orbit',
      azimuthDeg: -ORBIT_FINE_STEP_DEG,
      polarDeg: 0,
    });
  });

  it('maps +/=/-/_ to dolly', () => {
    expect(resolveKeyboardAction({ key: '+' })).toEqual({ type: 'dolly', direction: 1 });
    expect(resolveKeyboardAction({ key: '=' })).toEqual({ type: 'dolly', direction: 1 });
    expect(resolveKeyboardAction({ key: '-' })).toEqual({ type: 'dolly', direction: -1 });
    expect(resolveKeyboardAction({ key: '_' })).toEqual({ type: 'dolly', direction: -1 });
  });

  it('maps R/Home to reset, F to flip, X to explode toggle, Escape to clear', () => {
    expect(resolveKeyboardAction({ key: 'r' })).toEqual({ type: 'reset' });
    expect(resolveKeyboardAction({ key: 'R' })).toEqual({ type: 'reset' });
    expect(resolveKeyboardAction({ key: 'Home' })).toEqual({ type: 'reset' });
    expect(resolveKeyboardAction({ key: 'f' })).toEqual({ type: 'flip' });
    expect(resolveKeyboardAction({ key: 'X' })).toEqual({ type: 'explode-toggle' });
    expect(resolveKeyboardAction({ key: 'Escape' })).toEqual({ type: 'clear-selection' });
  });

  it('maps digits 1-7 to the preset order', () => {
    expect(resolveKeyboardAction({ key: '1' })).toEqual({ type: 'preset', preset: 'top' });
    expect(resolveKeyboardAction({ key: '2' })).toEqual({ type: 'preset', preset: 'bottom' });
    expect(resolveKeyboardAction({ key: '7' })).toEqual({ type: 'preset', preset: 'iso' });
  });

  it('returns null for unbound keys (Tab, 8, letters, etc.)', () => {
    expect(resolveKeyboardAction({ key: 'Tab' })).toBeNull();
    expect(resolveKeyboardAction({ key: '8' })).toBeNull();
    expect(resolveKeyboardAction({ key: '0' })).toBeNull();
    expect(resolveKeyboardAction({ key: 'q' })).toBeNull();
    expect(resolveKeyboardAction({ key: ' ' })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// describeViewerAction
// ---------------------------------------------------------------------------

describe('describeViewerAction', () => {
  it('produces a non-empty announcement for every action shape', () => {
    const actions: ViewerAction[] = [
      { type: 'orbit', azimuthDeg: -15, polarDeg: 0 },
      { type: 'orbit', azimuthDeg: 0, polarDeg: 15 },
      { type: 'dolly', direction: 1 },
      { type: 'dolly', direction: -1 },
      { type: 'preset', preset: 'top' },
      { type: 'flip' },
      { type: 'reset' },
      { type: 'explode-toggle' },
      { type: 'clear-selection' },
    ];
    for (const action of actions) {
      expect(describeViewerAction(action).length).toBeGreaterThan(0);
    }
  });

  it('uses the preset label for preset actions', () => {
    expect(describeViewerAction({ type: 'preset', preset: 'iso' })).toBe(
      CAMERA_PRESET_LABELS.iso,
    );
  });
});

// ---------------------------------------------------------------------------
// applyCameraAction
// ---------------------------------------------------------------------------

describe('applyCameraAction', () => {
  it('orbit calls rotate with radians and a transition', () => {
    const { rig, calls } = makeRig();
    const handled = applyCameraAction(rig, { type: 'orbit', azimuthDeg: 15, polarDeg: -15 }, BOARD);
    expect(handled).toBe(true);
    expect(calls).toHaveLength(1);
    const [az, pol, transition] = calls[0].args as [number, number, boolean];
    expect(calls[0].method).toBe('rotate');
    expect(az).toBeCloseTo((15 * Math.PI) / 180, 9);
    expect(pol).toBeCloseTo((-15 * Math.PI) / 180, 9);
    expect(transition).toBe(true);
  });

  it('dolly steps by the board-relative distance', () => {
    const { rig, calls } = makeRig();
    applyCameraAction(rig, { type: 'dolly', direction: -1 }, BOARD);
    const [distance, transition] = calls[0].args as [number, boolean];
    expect(calls[0].method).toBe('dolly');
    expect(distance).toBeCloseTo(-presetDistance(BOARD) * DOLLY_STEP_RATIO, 9);
    expect(transition).toBe(true);
  });

  it('preset issues an animated setLookAt with the preset pose', () => {
    const { rig, calls } = makeRig();
    applyCameraAction(rig, { type: 'preset', preset: 'top' }, BOARD);
    const pose = presetPose('top', BOARD);
    expect(calls[0].method).toBe('setLookAt');
    expect(calls[0].args).toEqual([
      pose.position.x,
      pose.position.y,
      pose.position.z,
      pose.target.x,
      pose.target.y,
      pose.target.z,
      true,
    ]);
  });

  it('home preset and reset both restore the saved state via reset(true)', () => {
    for (const action of [{ type: 'preset', preset: 'home' }, { type: 'reset' }] as const) {
      const { rig, calls } = makeRig();
      applyCameraAction(rig, action as ViewerAction, BOARD);
      expect(calls).toEqual([{ method: 'reset', args: [true] }]);
    }
  });

  it('flip mirrors the current polar angle across the board plane', () => {
    const { rig, calls } = makeRig(Math.PI / 3);
    applyCameraAction(rig, { type: 'flip' }, BOARD);
    expect(calls[0].method).toBe('rotatePolarTo');
    const [polar, transition] = calls[0].args as [number, boolean];
    expect(polar).toBeCloseTo(Math.PI - Math.PI / 3, 9);
    expect(transition).toBe(true);
  });

  it('returns false (and does not touch the rig) for non-camera actions', () => {
    const { rig, calls } = makeRig();
    expect(applyCameraAction(rig, { type: 'explode-toggle' }, BOARD)).toBe(false);
    expect(applyCameraAction(rig, { type: 'clear-selection' }, BOARD)).toBe(false);
    expect(calls).toEqual([]);
  });
});
