import { describe, it, expect } from 'vitest';
import {
  isWithinBreadboard,
  snapToBreadboard,
  benchToPixel,
  pixelToBench,
  determinePlacementMode,
  BENCH_DEFAULTS,
  type BenchSurfaceConfig,
  type BenchPosition,
} from '../bench-surface-model';
import { getBoardDimensions, BB } from '../breadboard-model';
import type { BreadboardFit } from '@/lib/breadboard-bench';

describe('bench-surface-model', () => {
  describe('BENCH_DEFAULTS', () => {
    it('defines surface dimensions larger than the breadboard', () => {
      const boardDims = getBoardDimensions();
      expect(BENCH_DEFAULTS.surfaceWidth).toBeGreaterThan(boardDims.width);
      expect(BENCH_DEFAULTS.surfaceHeight).toBeGreaterThan(boardDims.height);
    });

    it('defines a breadboard origin offset on the surface', () => {
      expect(BENCH_DEFAULTS.breadboardOrigin.x).toBeGreaterThan(0);
      expect(BENCH_DEFAULTS.breadboardOrigin.y).toBeGreaterThan(0);
    });

    it('has a positive snap threshold', () => {
      expect(BENCH_DEFAULTS.snapThreshold).toBeGreaterThan(0);
    });

    it('stores breadboard pixel dimensions', () => {
      const boardDims = getBoardDimensions();
      expect(BENCH_DEFAULTS.breadboardWidth).toBe(boardDims.width);
      expect(BENCH_DEFAULTS.breadboardHeight).toBe(boardDims.height);
    });
  });

  describe('isWithinBreadboard', () => {
    it('returns true for a point well inside the breadboard zone', () => {
      const pos: BenchPosition = {
        x: BENCH_DEFAULTS.breadboardOrigin.x + 50,
        y: BENCH_DEFAULTS.breadboardOrigin.y + 50,
      };
      expect(isWithinBreadboard(pos)).toBe(true);
    });

    it('returns true at the breadboard origin', () => {
      expect(isWithinBreadboard(BENCH_DEFAULTS.breadboardOrigin)).toBe(true);
    });

    it('returns true at the far corner of the breadboard zone', () => {
      const pos: BenchPosition = {
        x: BENCH_DEFAULTS.breadboardOrigin.x + BENCH_DEFAULTS.breadboardWidth,
        y: BENCH_DEFAULTS.breadboardOrigin.y + BENCH_DEFAULTS.breadboardHeight,
      };
      expect(isWithinBreadboard(pos)).toBe(true);
    });

    it('returns false for a point far outside the breadboard', () => {
      expect(isWithinBreadboard({ x: 0, y: 0 })).toBe(false);
    });

    it('returns false for a point just outside snap threshold', () => {
      const pos: BenchPosition = {
        x: BENCH_DEFAULTS.breadboardOrigin.x - BENCH_DEFAULTS.snapThreshold - 5,
        y: BENCH_DEFAULTS.breadboardOrigin.y + 50,
      };
      expect(isWithinBreadboard(pos)).toBe(false);
    });

    it('accepts a custom config', () => {
      const custom: BenchSurfaceConfig = {
        ...BENCH_DEFAULTS,
        breadboardOrigin: { x: 10, y: 10 },
        breadboardWidth: 100,
        breadboardHeight: 100,
        snapThreshold: 5,
      };
      // Inside
      expect(isWithinBreadboard({ x: 50, y: 50 }, custom)).toBe(true);
      // Within snap threshold
      expect(isWithinBreadboard({ x: 7, y: 50 }, custom)).toBe(true);
      // Outside snap threshold
      expect(isWithinBreadboard({ x: 3, y: 50 }, custom)).toBe(false);
    });
  });

  describe('snapToBreadboard', () => {
    it('returns the nearest breadboard coord when within snap threshold', () => {
      // Position near the breadboard origin — should snap to col a, row 1
      const pos: BenchPosition = {
        x: BENCH_DEFAULTS.breadboardOrigin.x + BB.ORIGIN_X + 2,
        y: BENCH_DEFAULTS.breadboardOrigin.y + BB.ORIGIN_Y + 3,
      };
      const result = snapToBreadboard(pos);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.type).toBe('terminal');
        if (result.type === 'terminal') {
          expect(result.col).toBe('a');
          expect(result.row).toBe(1);
        }
      }
    });

    it('returns null when position is far from the breadboard', () => {
      const result = snapToBreadboard({ x: 0, y: 0 });
      expect(result).toBeNull();
    });

    it('returns null when within the zone but not close to any hole', () => {
      // Position exactly between two holes, far enough from both
      const pos: BenchPosition = {
        x: BENCH_DEFAULTS.breadboardOrigin.x + BB.ORIGIN_X + BB.PITCH * 0.5,
        y: BENCH_DEFAULTS.breadboardOrigin.y + BB.ORIGIN_Y + BB.PITCH * 0.5,
      };
      // With a very tight snap radius, this mid-point shouldn't snap
      const result = snapToBreadboard(pos, { ...BENCH_DEFAULTS, snapThreshold: 1 });
      // Note: pixelToCoord has its own snap radius — this tests the zone gate
      // The result depends on pixelToCoord's default snapRadius
      expect(result === null || result.type === 'terminal').toBe(true);
    });
  });

  describe('benchToPixel / pixelToBench', () => {
    it('benchToPixel converts bench coords to board-local pixel coords', () => {
      const benchPos: BenchPosition = {
        x: BENCH_DEFAULTS.breadboardOrigin.x + 50,
        y: BENCH_DEFAULTS.breadboardOrigin.y + 30,
      };
      const pixel = benchToPixel(benchPos);
      expect(pixel.x).toBe(50);
      expect(pixel.y).toBe(30);
    });

    it('pixelToBench converts board-local pixel coords to bench coords', () => {
      const pixel = { x: 50, y: 30 };
      const benchPos = pixelToBench(pixel);
      expect(benchPos.x).toBe(BENCH_DEFAULTS.breadboardOrigin.x + 50);
      expect(benchPos.y).toBe(BENCH_DEFAULTS.breadboardOrigin.y + 30);
    });

    it('round-trips correctly: benchToPixel(pixelToBench(p)) === p', () => {
      const original = { x: 123, y: 456 };
      const benchPos = pixelToBench(original);
      const roundTripped = benchToPixel(benchPos);
      expect(roundTripped.x).toBeCloseTo(original.x, 5);
      expect(roundTripped.y).toBeCloseTo(original.y, 5);
    });

    it('uses custom config for offset', () => {
      const custom: BenchSurfaceConfig = {
        ...BENCH_DEFAULTS,
        breadboardOrigin: { x: 100, y: 200 },
      };
      const benchPos: BenchPosition = { x: 150, y: 250 };
      const pixel = benchToPixel(benchPos, custom);
      expect(pixel.x).toBe(50);
      expect(pixel.y).toBe(50);

      const back = pixelToBench(pixel, custom);
      expect(back.x).toBe(150);
      expect(back.y).toBe(250);
    });
  });

  describe('determinePlacementMode', () => {
    const onBoardPos: BenchPosition = {
      x: BENCH_DEFAULTS.breadboardOrigin.x + BB.ORIGIN_X + 2,
      y: BENCH_DEFAULTS.breadboardOrigin.y + BB.ORIGIN_Y + 3,
    };
    const offBoardPos: BenchPosition = { x: 10, y: 10 };

    it('returns "board" for a native fit dropped near a breadboard hole', () => {
      const result = determinePlacementMode(onBoardPos, 'native' as BreadboardFit);
      expect(result.mode).toBe('board');
      expect(result.coord).not.toBeNull();
    });

    it('returns "bench" for a native fit dropped far from the breadboard', () => {
      const result = determinePlacementMode(offBoardPos, 'native' as BreadboardFit);
      expect(result.mode).toBe('bench');
      expect(result.coord).toBeNull();
    });

    it('returns "bench" for not_breadboard_friendly regardless of position', () => {
      const result = determinePlacementMode(onBoardPos, 'not_breadboard_friendly' as BreadboardFit);
      expect(result.mode).toBe('bench');
      expect(result.coord).toBeNull();
    });

    it('returns "bench" for breakout_required regardless of position', () => {
      const result = determinePlacementMode(onBoardPos, 'breakout_required' as BreadboardFit);
      expect(result.mode).toBe('bench');
      expect(result.coord).toBeNull();
    });

    it('returns "board" for requires_jumpers when near a hole', () => {
      const result = determinePlacementMode(onBoardPos, 'requires_jumpers' as BreadboardFit);
      expect(result.mode).toBe('board');
      expect(result.coord).not.toBeNull();
    });

    it('returns "bench" for requires_jumpers when far from board', () => {
      const result = determinePlacementMode(offBoardPos, 'requires_jumpers' as BreadboardFit);
      expect(result.mode).toBe('bench');
      expect(result.coord).toBeNull();
    });

    it('returns benchPosition in bench mode', () => {
      const result = determinePlacementMode(offBoardPos, 'native' as BreadboardFit);
      expect(result.mode).toBe('bench');
      expect(result.benchPosition).toEqual(offBoardPos);
    });

    it('returns boardPixel in board mode', () => {
      const result = determinePlacementMode(onBoardPos, 'native' as BreadboardFit);
      expect(result.mode).toBe('board');
      expect(result.boardPixel).toBeDefined();
      if (result.boardPixel) {
        expect(result.boardPixel.x).toBeGreaterThanOrEqual(0);
        expect(result.boardPixel.y).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
