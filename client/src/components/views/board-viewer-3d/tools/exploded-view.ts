/**
 * exploded-view — pure math for the exploded-view tween (PP3D-8).
 *
 * The exploded view lifts top-side content up (+y) and bottom-side content
 * down (−y) along the board normal (Altium "thickness slider" / EasyEDA
 * "layer exposure spacing" inspiration, plan §7). Vias span the substrate and
 * stay put.
 *
 * Everything here is deterministic and three.js/React-free:
 *   - `explodedLift`        — y offset for a side at a given explode factor.
 *   - `stepExplodeFactor`   — one frame of the linear tween toward a target.
 *   - `isExplodeSettled`    — tween termination predicate.
 *   - `splitModelBySide`    — partition a SceneModel into top / bottom /
 *                             static (via) sub-models so the R3F layer can
 *                             move whole groups via refs (no per-frame React
 *                             re-render).
 *
 * The animation itself lives in `useExplodedView.ts` (R3F `useFrame` +
 * `invalidate()` per tick so `frameloop="demand"` keeps ticking only while
 * the tween is live, plan §8).
 */

import type { SceneModel } from '../model/scene-model';

/** Lift at factor 1, as a multiple of the board thickness. */
export const EXPLODE_LIFT_RATIO = 5;

/** Tween speed in factor-units per second (0 → 1 in ~1/3 s). */
export const EXPLODE_TWEEN_SPEED = 3;

/** Factors closer than this to the target snap to it (tween settles). */
export const EXPLODE_SETTLE_EPSILON = 1e-3;

/**
 * Vertical lift (mm) applied to one board side at a given explode factor.
 * Top content rises, bottom content sinks; factor 0 is the assembled board.
 */
export function explodedLift(
  side: 'top' | 'bottom',
  factor: number,
  thicknessMm: number,
): number {
  const magnitude = factor * thicknessMm * EXPLODE_LIFT_RATIO;
  const signed = side === 'top' ? magnitude : -magnitude;
  // Normalise -0 → 0 (factor 0 on the bottom side) for clean equality checks.
  return signed === 0 ? 0 : signed;
}

/** Has the tween reached its target (within epsilon)? */
export function isExplodeSettled(current: number, target: number): boolean {
  return Math.abs(target - current) <= EXPLODE_SETTLE_EPSILON;
}

/**
 * Advance the explode factor one frame toward `target` at
 * {@link EXPLODE_TWEEN_SPEED}, snapping when within epsilon. `deltaSeconds`
 * is the frame delta from `useFrame`.
 */
export function stepExplodeFactor(
  current: number,
  target: number,
  deltaSeconds: number,
): number {
  const maxStep = EXPLODE_TWEEN_SPEED * Math.max(deltaSeconds, 0);
  const remaining = target - current;
  if (Math.abs(remaining) <= Math.max(maxStep, EXPLODE_SETTLE_EPSILON)) {
    return target;
  }
  return current + Math.sign(remaining) * maxStep;
}

/** The per-side partition of a SceneModel produced by {@link splitModelBySide}. */
export interface SideSplitModel {
  /** Top-side components/pads/traces (lifts +y during explode). */
  top: SceneModel;
  /** Bottom-side components/pads/traces (lifts −y during explode). */
  bottom: SceneModel;
  /** Side-agnostic geometry (vias span the board; never lifted). */
  fixed: SceneModel;
}

/**
 * Partition a SceneModel by board side so each side can be rendered inside
 * its own `<group>` and lifted as a unit. Board/stack metadata is shared by
 * reference; `isEmpty` is recomputed per partition.
 */
export function splitModelBySide(model: SceneModel): SideSplitModel {
  const part = (side: 'top' | 'bottom'): SceneModel => {
    const components = model.components.filter((c) => c.side === side);
    const pads = model.pads.filter((p) => p.side === side);
    const traces = model.traces.filter((t) => t.side === side);
    return {
      board: model.board,
      stack: model.stack,
      components,
      pads,
      traces,
      vias: [],
      drillHoles: [],
      isEmpty: components.length === 0 && pads.length === 0 && traces.length === 0,
    };
  };

  const fixed: SceneModel = {
    board: model.board,
    stack: model.stack,
    components: [],
    pads: [],
    traces: [],
    vias: model.vias,
    drillHoles: model.drillHoles,
    isEmpty: model.vias.length === 0 && model.drillHoles.length === 0,
  };

  return { top: part('top'), bottom: part('bottom'), fixed };
}
