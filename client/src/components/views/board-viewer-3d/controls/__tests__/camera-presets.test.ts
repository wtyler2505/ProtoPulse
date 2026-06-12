import { describe, it, expect } from 'vitest';

import {
  CAMERA_PRESET_LABELS,
  CAMERA_PRESET_ORDER,
  MIN_PRESET_DISTANCE_MM,
  PRESET_DISTANCE_RATIO,
  flippedPolarAngle,
  presetDistance,
  presetPose,
} from '../camera-presets';

import type { CameraPresetId, PresetBoardDims } from '../camera-presets';

const BOARD: PresetBoardDims = { widthMm: 100, heightMm: 80, thicknessMm: 1.6 };

const ALL_PRESETS: CameraPresetId[] = [
  'home',
  'top',
  'bottom',
  'front',
  'back',
  'left',
  'right',
  'iso',
];

describe('presetDistance', () => {
  it('scales with the board diagonal', () => {
    const diagonal = Math.hypot(100, 80, 1.6);
    expect(presetDistance(BOARD)).toBeCloseTo(diagonal * PRESET_DISTANCE_RATIO, 6);
  });

  it('floors tiny boards at the minimum distance', () => {
    expect(presetDistance({ widthMm: 5, heightMm: 5, thicknessMm: 0.8 })).toBe(
      MIN_PRESET_DISTANCE_MM,
    );
  });
});

describe('presetPose', () => {
  it('always targets the board origin', () => {
    for (const preset of ALL_PRESETS) {
      expect(presetPose(preset, BOARD).target).toEqual({ x: 0, y: 0, z: 0 });
    }
  });

  it('keeps the camera at the preset distance for every preset', () => {
    const d = presetDistance(BOARD);
    for (const preset of ALL_PRESETS) {
      const { position } = presetPose(preset, BOARD);
      const r = Math.hypot(position.x, position.y, position.z);
      // top/bottom carry the pole epsilon; side views the lift — all within 3%.
      expect(r).toBeGreaterThan(d * 0.97);
      expect(r).toBeLessThan(d * 1.03);
    }
  });

  it('top is above the board, bottom below, never exactly on the pole', () => {
    const top = presetPose('top', BOARD).position;
    const bottom = presetPose('bottom', BOARD).position;
    expect(top.y).toBeGreaterThan(0);
    expect(bottom.y).toBeLessThan(0);
    // pole epsilon: a non-zero lateral component avoids a degenerate look-at.
    expect(Math.hypot(top.x, top.z)).toBeGreaterThan(0);
    expect(Math.hypot(bottom.x, bottom.z)).toBeGreaterThan(0);
  });

  it('front/back/left/right sit on the expected axes, slightly elevated', () => {
    expect(presetPose('front', BOARD).position.z).toBeGreaterThan(0);
    expect(presetPose('back', BOARD).position.z).toBeLessThan(0);
    expect(presetPose('left', BOARD).position.x).toBeLessThan(0);
    expect(presetPose('right', BOARD).position.x).toBeGreaterThan(0);
    for (const preset of ['front', 'back', 'left', 'right'] as const) {
      expect(presetPose(preset, BOARD).position.y).toBeGreaterThan(0);
    }
  });

  it('iso has equal positive components; home matches iso', () => {
    const iso = presetPose('iso', BOARD).position;
    expect(iso.x).toBeGreaterThan(0);
    expect(iso.x).toBeCloseTo(iso.y, 9);
    expect(iso.y).toBeCloseTo(iso.z, 9);
    expect(presetPose('home', BOARD)).toEqual(presetPose('iso', BOARD));
  });
});

describe('flippedPolarAngle', () => {
  it('mirrors the polar angle across the board plane', () => {
    expect(flippedPolarAngle(Math.PI / 4)).toBeCloseTo((3 * Math.PI) / 4, 9);
    expect(flippedPolarAngle(Math.PI / 2)).toBeCloseTo(Math.PI / 2, 9);
  });

  it('is its own inverse', () => {
    expect(flippedPolarAngle(flippedPolarAngle(1.1))).toBeCloseTo(1.1, 9);
  });
});

describe('preset metadata', () => {
  it('digit ordering covers seven presets and labels cover every id', () => {
    expect(CAMERA_PRESET_ORDER).toHaveLength(7);
    for (const preset of ALL_PRESETS) {
      expect(CAMERA_PRESET_LABELS[preset]).toBeTruthy();
    }
  });
});
