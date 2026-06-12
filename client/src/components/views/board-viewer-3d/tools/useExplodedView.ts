/**
 * useExplodedView — animated exploded-view tween (PP3D-8).
 *
 * Runs INSIDE the R3F `<Canvas>`. Tweens the explode factor toward `target`
 * using the pure `stepExplodeFactor`, reporting each animated value through
 * `onFactor` (the caller moves its side `<group>`s via refs — no per-frame
 * React re-render). Plays nicely with `frameloop="demand"`:
 *   - a `target` change calls `invalidate()` once to kick the loop,
 *   - each animated tick calls `invalidate()` again until settled,
 *   - a settled tween renders nothing extra (demand loop goes idle).
 */

import { useEffect, useRef } from 'react';

import { useFrame, useThree } from '@react-three/fiber';

import { isExplodeSettled, stepExplodeFactor } from './exploded-view';

export function useExplodedView(target: number, onFactor: (factor: number) => void): void {
  const invalidate = useThree((state) => state.invalidate);
  const current = useRef(target);
  const callback = useRef(onFactor);
  callback.current = onFactor;

  // Kick the demand frameloop whenever a new target arrives.
  useEffect(() => {
    if (!isExplodeSettled(current.current, target)) {
      invalidate();
    }
  }, [target, invalidate]);

  useFrame((_, delta) => {
    if (isExplodeSettled(current.current, target)) return;
    current.current = stepExplodeFactor(current.current, target, delta);
    callback.current(current.current);
    invalidate();
  });
}

export default useExplodedView;
