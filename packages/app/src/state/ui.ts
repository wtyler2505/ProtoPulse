import { isTeachingDepth } from '@protopulse/ai';
import { create } from 'zustand';

import type { TeachingDepth } from '@protopulse/ai';
import type { Vec } from '@protopulse/graph';

/**
 * Editor UI state: active tool, panel tab, cursor readout, camera
 * commands, concept viewer overlay, status-bar flash, and the Professor
 * handoff. Everything is ephemeral EXCEPT the teaching depth, which
 * round-trips through localStorage 'pp-depth'.
 */

export type ToolId = 'select' | 'wire' | 'place';
export type TabId =
  | 'inspector'
  | 'erc'
  | 'review'
  | 'branches'
  | 'export'
  | 'draftsman'
  | 'sim'
  | 'analyst'
  | 'professor';
export type CameraCommand = { kind: 'fit' } | { kind: 'center'; at: Vec };

// ── Teaching-depth persistence ──────────────────────────────────────

export const DEPTH_STORAGE_KEY = 'pp-depth';
export const DEFAULT_DEPTH: TeachingDepth = 'show-me';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

/** Read the persisted depth; unknown or missing values fall back to show-me. */
export function loadDepth(storage: StorageLike | null = defaultStorage()): TeachingDepth {
  try {
    const raw = storage?.getItem(DEPTH_STORAGE_KEY);
    return isTeachingDepth(raw) ? raw : DEFAULT_DEPTH;
  } catch {
    return DEFAULT_DEPTH;
  }
}

export function storeDepth(
  depth: TeachingDepth,
  storage: StorageLike | null = defaultStorage(),
): void {
  try {
    storage?.setItem(DEPTH_STORAGE_KEY, depth);
  } catch {
    // privacy mode — depth stays in-memory for this session only
  }
}

// ── Store ────────────────────────────────────────────────────────────

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
  /** The depth dial — shared by the Professor and all AI narration. */
  teachingDepth: TeachingDepth;
  /** One-line status-bar flash (auto-cleared), or null. */
  statusFlash: string | null;
  /** Bumped per flash — the status bar keys its auto-clear timer on it. */
  statusFlashSeq: number;
  /** Prompt pre-seeded into the Professor panel (Review handoff), or null. */
  professorSeed: string | null;

  setTool: (tool: Exclude<ToolId, 'place'>) => void;
  startPlace: (partId: string) => void;
  setTab: (tab: TabId) => void;
  setCursorWorld: (v: Vec | null) => void;
  openConcept: (slug: string) => void;
  closeConcept: () => void;
  setHighlight: (ids: readonly string[]) => void;
  requestFit: () => void;
  requestCenter: (at: Vec) => void;
  setTeachingDepth: (depth: TeachingDepth) => void;
  flashStatus: (text: string) => void;
  /** Clears only when seq still matches — stale timers are no-ops. */
  clearStatusFlash: (seq: number) => void;
  /** Review → Professor handoff: seed the prompt and switch tabs. */
  askProfessor: (prompt: string) => void;
  /** The Professor panel takes the seed exactly once. */
  consumeProfessorSeed: () => string | null;
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
  teachingDepth: loadDepth(),
  statusFlash: null,
  statusFlashSeq: 0,
  professorSeed: null,

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
  setTeachingDepth: (depth) => {
    storeDepth(depth);
    set({ teachingDepth: depth });
  },
  flashStatus: (text) =>
    { set({ statusFlash: text, statusFlashSeq: get().statusFlashSeq + 1 }); },
  clearStatusFlash: (seq) => {
    if (get().statusFlashSeq === seq) set({ statusFlash: null });
  },
  askProfessor: (prompt) => { set({ professorSeed: prompt, activeTab: 'professor' }); },
  consumeProfessorSeed: () => {
    const seed = get().professorSeed;
    if (seed !== null) set({ professorSeed: null });
    return seed;
  },
}));
