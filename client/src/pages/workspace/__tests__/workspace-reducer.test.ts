import { beforeEach, describe, expect, it } from 'vitest';
import {
  createInitialWorkspaceState,
  loadPersistedLayout,
  persistLayout,
  workspaceReducer,
  type WorkspaceState,
} from '@/pages/workspace/workspace-reducer';

describe('workspace-reducer persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('protopulse-session-id', 'session-a');
  });

  it('loads the persisted layout for the requested project only', () => {
    localStorage.setItem(
      'protopulse-panel-layout:session-a:7',
      JSON.stringify({ sidebarCollapsed: true, sidebarWidth: 312 }),
    );
    localStorage.setItem(
      'protopulse-panel-layout:session-a:8',
      JSON.stringify({ sidebarCollapsed: false, sidebarWidth: 420 }),
    );

    expect(loadPersistedLayout(7)).toEqual({ sidebarCollapsed: true, sidebarWidth: 312 });
  });

  it('creates initial state from the active project scoped layout', () => {
    localStorage.setItem(
      'protopulse-panel-layout:session-a:12',
      JSON.stringify({ sidebarCollapsed: true, chatCollapsed: true, sidebarWidth: 280, chatWidth: 410 }),
    );

    expect(createInitialWorkspaceState(12)).toMatchObject({
      sidebarCollapsed: true,
      chatCollapsed: true,
      sidebarWidth: 280,
      chatWidth: 410,
    });
  });

  it('falls back to defaults when the project has no persisted layout', () => {
    expect(createInitialWorkspaceState(99)).toMatchObject({
      sidebarCollapsed: false,
      chatCollapsed: false,
      sidebarWidth: 256,
      chatWidth: 350,
    });
  });

  it('persists layout under the active session and project id', () => {
    persistLayout(42, {
      sidebarCollapsed: true,
      chatCollapsed: false,
      sidebarWidth: 300,
      chatWidth: 360,
      activeView: 'architecture',
    });

    expect(localStorage.getItem('protopulse-panel-layout:session-a:42')).toBe(
      JSON.stringify({
        sidebarCollapsed: true,
        chatCollapsed: false,
        sidebarWidth: 300,
        chatWidth: 360,
        activeView: 'architecture',
      }),
    );
  });
});

describe('workspaceReducer', () => {
  const initialState: WorkspaceState = {
    sidebarOpen: false,
    chatOpen: false,
    sidebarCollapsed: false,
    chatCollapsed: false,
    sidebarWidth: 256,
    chatWidth: 350,
    shortcutsOpen: false,
    moreMenuOpen: false,
    activityFeedOpen: false,
    pcbTutorialOpen: false,
    predictionPanelOpen: false,
  };

  it('updates sidebar width immutably', () => {
    const nextState = workspaceReducer(initialState, { type: 'SET_SIDEBAR_WIDTH', width: 288 });

    expect(nextState).toEqual({ ...initialState, sidebarWidth: 288 });
    expect(nextState).not.toBe(initialState);
  });

  it('toggles the prediction panel', () => {
    expect(workspaceReducer(initialState, { type: 'TOGGLE_PREDICTION_PANEL' }).predictionPanelOpen).toBe(true);
  });
});
