/**
 * SelectionHighlight — outline highlight for the picked element (PP3D-5).
 *
 * Renders an invisible proxy box over the selected element's world-space
 * bounds (from the pure `selectionBounds` helper) and attaches drei
 * `<Outlines>` to it — an inverted-hull outline that needs no postprocessing
 * pass (the `<EffectComposer>`-based `<Outline>` upgrade is PP3D-12). The
 * proxy's `raycast` is disabled so the highlight never swallows picks.
 */

import { useMemo } from 'react';

import { Outlines } from '@react-three/drei';

import { selectionBounds } from '../model/scene-lookup';

import type { SceneModel, SceneSelection } from '../model/scene-model';

/** Accent used for the selection outline (matches the app primary hue). */
export const SELECTION_OUTLINE_COLOR = '#38bdf8';

/** Outline thickness in world units (mm) — reads well at board scale. */
const OUTLINE_THICKNESS_MM = 0.35;

/** Padding so the outline box clears the element's own surface. */
const BOUNDS_PADDING_MM = 0.15;

export interface SelectionHighlightProps {
  model: SceneModel;
  selection: SceneSelection | null;
}

export function SelectionHighlight({ model, selection }: SelectionHighlightProps) {
  const box = useMemo(() => selectionBounds(model, selection), [model, selection]);
  if (!box) return null;

  const size: [number, number, number] = [
    box.max.x - box.min.x + BOUNDS_PADDING_MM * 2,
    box.max.y - box.min.y + BOUNDS_PADDING_MM * 2,
    box.max.z - box.min.z + BOUNDS_PADDING_MM * 2,
  ];
  const center: [number, number, number] = [
    (box.min.x + box.max.x) / 2,
    (box.min.y + box.max.y) / 2,
    (box.min.z + box.max.z) / 2,
  ];

  return (
    <mesh name="selection-highlight" position={center} raycast={() => null}>
      <boxGeometry args={size} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      <Outlines thickness={OUTLINE_THICKNESS_MM} color={SELECTION_OUTLINE_COLOR} screenspace={false} />
    </mesh>
  );
}

export default SelectionHighlight;
