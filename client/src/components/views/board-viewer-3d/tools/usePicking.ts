/**
 * usePicking — selection state for the WebGL board viewer (PP3D-5).
 *
 * Raycasting itself is handled by R3F pointer events (accelerated by drei
 * `<Bvh>` in `BoardScene`); this hook owns the resulting selection state.
 * The transition logic is the pure `nextSelection` reducer in
 * `model/scene-lookup.ts` (click → select, re-click → deselect, background →
 * clear), which is where it gets unit-tested.
 */

import { useCallback, useState } from 'react';

import { nextSelection } from '../model/scene-lookup';
import type { SceneSelection } from '../model/scene-model';

export interface PickingState {
  /** Currently selected element, or null. */
  selection: SceneSelection | null;
  /** Apply a pick (toggle semantics via `nextSelection`). */
  pick: (clicked: SceneSelection) => void;
  /** Clear the selection (background click / Escape). */
  clear: () => void;
}

export function usePicking(): PickingState {
  const [selection, setSelection] = useState<SceneSelection | null>(null);

  const pick = useCallback((clicked: SceneSelection) => {
    setSelection((current) => nextSelection(current, clicked));
  }, []);

  const clear = useCallback(() => setSelection(null), []);

  return { selection, pick, clear };
}
