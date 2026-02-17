import { createContext, useContext, useReducer, useCallback, type ReactNode } from 'react';
import type { PartState } from '@shared/component-types';
import { createDefaultPartState } from '@shared/component-types';
import type { EditorState, EditorAction, HistoryEntry } from './types';

const MAX_HISTORY = 50;

function createInitialState(): EditorState {
  return {
    past: [],
    present: createDefaultPartState(),
    future: [],
    ui: {
      activeEditorView: 'metadata',
      selectedShapeIds: [],
      selectedConnectorId: null,
      isDirty: false,
    },
  };
}

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'LOAD_PART':
      return {
        past: [],
        present: action.payload,
        future: [],
        ui: { ...state.ui, isDirty: false, selectedShapeIds: [], selectedConnectorId: null },
      };

    case 'SET_PART_STATE': {
      const entry: HistoryEntry = { label: action.payload.label, state: state.present, timestamp: Date.now() };
      return {
        past: [...state.past, entry].slice(-MAX_HISTORY),
        present: action.payload.state,
        future: [],
        ui: { ...state.ui, isDirty: true },
      };
    }

    case 'UPDATE_META': {
      const entry: HistoryEntry = { label: 'Update metadata', state: state.present, timestamp: Date.now() };
      return {
        past: [...state.past, entry].slice(-MAX_HISTORY),
        present: { ...state.present, meta: { ...state.present.meta, ...action.payload } },
        future: [],
        ui: { ...state.ui, isDirty: true },
      };
    }

    case 'UNDO': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, -1);
      const futureEntry: HistoryEntry = { label: 'Undo', state: state.present, timestamp: Date.now() };
      return {
        past: newPast,
        present: previous.state,
        future: [futureEntry, ...state.future],
        ui: { ...state.ui, isDirty: newPast.length > 0 },
      };
    }

    case 'REDO': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      const newFuture = state.future.slice(1);
      const pastEntry: HistoryEntry = { label: 'Redo', state: state.present, timestamp: Date.now() };
      return {
        past: [...state.past, pastEntry],
        present: next.state,
        future: newFuture,
        ui: { ...state.ui, isDirty: true },
      };
    }

    case 'SET_EDITOR_VIEW':
      return { ...state, ui: { ...state.ui, activeEditorView: action.payload } };

    case 'SET_SELECTION':
      return { ...state, ui: { ...state.ui, selectedShapeIds: action.payload } };

    case 'SET_CONNECTOR_SELECTION':
      return { ...state, ui: { ...state.ui, selectedConnectorId: action.payload } };

    case 'MARK_CLEAN':
      return { ...state, ui: { ...state.ui, isDirty: false } };

    default:
      return state;
  }
}

interface ComponentEditorContextValue {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}

const ComponentEditorContext = createContext<ComponentEditorContextValue | null>(null);

export function ComponentEditorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(editorReducer, undefined, createInitialState);

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;
  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);

  return (
    <ComponentEditorContext.Provider value={{ state, dispatch, canUndo, canRedo, undo, redo }}>
      {children}
    </ComponentEditorContext.Provider>
  );
}

export function useComponentEditor() {
  const ctx = useContext(ComponentEditorContext);
  if (!ctx) throw new Error('useComponentEditor must be used within ComponentEditorProvider');
  return ctx;
}
