// ─── Workspace panel state management ──────────────────────────────────────

import { getProjectScopedStorageKey } from '@/lib/client-state-scope';

export interface WorkspaceState {
  sidebarOpen: boolean;
  chatOpen: boolean;
  sidebarCollapsed: boolean;
  chatCollapsed: boolean;
  sidebarWidth: number;
  chatWidth: number;
  shortcutsOpen: boolean;
  moreMenuOpen: boolean;
  activityFeedOpen: boolean;
  pcbTutorialOpen: boolean;
  predictionPanelOpen: boolean;
}

export type WorkspaceAction =
  | { type: 'SET_SIDEBAR_OPEN'; open: boolean }
  | { type: 'SET_CHAT_OPEN'; open: boolean }
  | { type: 'SET_SIDEBAR_COLLAPSED'; collapsed: boolean }
  | { type: 'SET_CHAT_COLLAPSED'; collapsed: boolean }
  | { type: 'SET_SIDEBAR_WIDTH'; width: number }
  | { type: 'SET_CHAT_WIDTH'; width: number }
  | { type: 'SET_SHORTCUTS_OPEN'; open: boolean }
  | { type: 'SET_MORE_MENU_OPEN'; open: boolean }
  | { type: 'TOGGLE_SHORTCUTS' }
  | { type: 'SET_ACTIVITY_FEED_OPEN'; open: boolean }
  | { type: 'SET_PCB_TUTORIAL_OPEN'; open: boolean }
  | { type: 'TOGGLE_PREDICTION_PANEL' };

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'SET_SIDEBAR_OPEN':
      return { ...state, sidebarOpen: action.open };
    case 'SET_CHAT_OPEN':
      return { ...state, chatOpen: action.open };
    case 'SET_SIDEBAR_COLLAPSED':
      return { ...state, sidebarCollapsed: action.collapsed };
    case 'SET_CHAT_COLLAPSED':
      return { ...state, chatCollapsed: action.collapsed };
    case 'SET_SIDEBAR_WIDTH':
      return { ...state, sidebarWidth: action.width };
    case 'SET_CHAT_WIDTH':
      return { ...state, chatWidth: action.width };
    case 'SET_SHORTCUTS_OPEN':
      return { ...state, shortcutsOpen: action.open };
    case 'SET_MORE_MENU_OPEN':
      return { ...state, moreMenuOpen: action.open };
    case 'TOGGLE_SHORTCUTS':
      return { ...state, shortcutsOpen: !state.shortcutsOpen };
    case 'SET_ACTIVITY_FEED_OPEN':
      return { ...state, activityFeedOpen: action.open };
    case 'SET_PCB_TUTORIAL_OPEN':
      return { ...state, pcbTutorialOpen: action.open };
    case 'TOGGLE_PREDICTION_PANEL':
      return { ...state, predictionPanelOpen: !state.predictionPanelOpen };
  }
}

// ─── Panel layout persistence ──────────────────────────────────────────────

const PANEL_LAYOUT_KEY = 'protopulse-panel-layout';

export interface PersistedPanelLayout {
  sidebarCollapsed: boolean;
  chatCollapsed: boolean;
  sidebarWidth: number;
  chatWidth: number;
  activeView?: string;
}

export function loadPersistedLayout(projectId: number): Partial<PersistedPanelLayout> {
  try {
    const raw = localStorage.getItem(getProjectScopedStorageKey(PANEL_LAYOUT_KEY, projectId));
    if (raw) {
      return JSON.parse(raw) as Partial<PersistedPanelLayout>;
    }
  } catch {
    // Ignore parse errors
  }
  return {};
}

export function createInitialWorkspaceState(projectId: number): WorkspaceState {
  const persisted = loadPersistedLayout(projectId);

  return {
    sidebarOpen: false,
    chatOpen: false,
    sidebarCollapsed: persisted.sidebarCollapsed ?? false,
    chatCollapsed: persisted.chatCollapsed ?? false,
    sidebarWidth: persisted.sidebarWidth ?? 256,
    chatWidth: persisted.chatWidth ?? 350,
    shortcutsOpen: false,
    moreMenuOpen: false,
    activityFeedOpen: false,
    pcbTutorialOpen: false,
    predictionPanelOpen: false,
  };
}

export function persistLayout(projectId: number, layout: PersistedPanelLayout): void {
  try {
    localStorage.setItem(getProjectScopedStorageKey(PANEL_LAYOUT_KEY, projectId), JSON.stringify(layout));
  } catch {
    // localStorage unavailable
  }
}
