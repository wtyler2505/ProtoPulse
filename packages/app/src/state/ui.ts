import { create } from 'zustand';

import type { Vec } from '@protopulse/graph';

/**
 * Ephemeral editor UI state (never persisted): active tool, panel tab,
 * cursor readout, camera commands, concept viewer overlay.
 */

export type ToolId = 'select' | 'wire' | 'place';
export type TabId =
  | 'inspector'
  | 'erc'
  | 'branches'
  | 'export'
  | 'draftsman'
  | 'sim'
  | 'analyst';
export type CameraCommand = { kind: 'fit' } | { kind: 'center'; at: Vec };

export interface UiState {
  tool: ToolId;
  /** Part being placed when tool === 'place'. */
  placePartId: string | null;
  activeTab: TabId;
  cursorWorld: Vec | null;
  /** Concept wiki slug shown in the viewer overlay, or null. */
  conceptSlug: string | null;
  /** Node ids to highlight on canvas (e.g. hovered ERC anchors). */
  highlight: readonly string[];
  cameraCommand: CameraCommand | null;
  /** Bumped per command — CanvasHost consumes by sequence number. */
  cameraCommandSeq: number;

  setTool: (tool: Exclude<ToolId, 'place'>) => void;
  startPlace: (partId: string) => void;
  setTab: (tab: TabId) => void;
  setCursorWorld: (v: Vec | null) => void;
  openConcept: (slug: string) => void;
  closeConcept: () => void;
  setHighlight: (ids: readonly string[]) => void;
  requestFit: () => void;
  requestCenter: (at: Vec) => void;
}

export const useUi = create<UiState>()((set, get) => ({
  tool: 'select',
  placePartId: null,
  activeTab: 'inspector',
  cursorWorld: null,
  conceptSlug: null,
  highlight: [],
  cameraCommand: null,
  cameraCommandSeq: 0,

  setTool: (tool) => { set({ tool, placePartId: null }); },
  startPlace: (partId) => { set({ tool: 'place', placePartId: partId }); },
  setTab: (tab) => { set({ activeTab: tab }); },
  setCursorWorld: (v) => { set({ cursorWorld: v }); },
  openConcept: (slug) => { set({ conceptSlug: slug }); },
  closeConcept: () => { set({ conceptSlug: null }); },
  setHighlight: (ids) => { set({ highlight: ids }); },
  requestFit: () =>
    { set({ cameraCommand: { kind: 'fit' }, cameraCommandSeq: get().cameraCommandSeq + 1 }); },
  requestCenter: (at) =>
    { set({ cameraCommand: { kind: 'center', at }, cameraCommandSeq: get().cameraCommandSeq + 1 }); },
}));
