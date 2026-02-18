import { createContext, useContext, useReducer, useCallback, type ReactNode } from 'react';
import type { PartState, Shape, Connector, CircleShape } from '@shared/component-types';
import { createDefaultPartState } from '@shared/component-types';
import type { EditorState, EditorAction, HistoryEntry } from './types';
import { nanoid } from 'nanoid';

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
      activeTool: 'select',
      clipboard: [],
      activeLayer: 'default',
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
      return { ...state, ui: { ...state.ui, activeEditorView: action.payload, activeTool: 'select' } };

    case 'SET_SELECTION':
      return { ...state, ui: { ...state.ui, selectedShapeIds: action.payload } };

    case 'SET_CONNECTOR_SELECTION':
      return { ...state, ui: { ...state.ui, selectedConnectorId: action.payload } };

    case 'MARK_CLEAN':
      return { ...state, ui: { ...state.ui, isDirty: false } };

    case 'ADD_SHAPE': {
      const { view, shape } = action.payload;
      const shapeWithLayer = shape.layer ? shape : { ...shape, layer: state.ui.activeLayer } as Shape;
      const entry: HistoryEntry = { label: `Add ${shape.type}`, state: state.present, timestamp: Date.now() };
      return {
        past: [...state.past, entry].slice(-MAX_HISTORY),
        present: {
          ...state.present,
          views: {
            ...state.present.views,
            [view]: {
              ...state.present.views[view],
              shapes: [...state.present.views[view].shapes, shapeWithLayer],
            },
          },
        },
        future: [],
        ui: { ...state.ui, isDirty: true },
      };
    }

    case 'UPDATE_SHAPE': {
      const { view, shapeId, updates } = action.payload;
      const entry: HistoryEntry = { label: 'Update shape', state: state.present, timestamp: Date.now() };
      return {
        past: [...state.past, entry].slice(-MAX_HISTORY),
        present: {
          ...state.present,
          views: {
            ...state.present.views,
            [view]: {
              ...state.present.views[view],
              shapes: state.present.views[view].shapes.map((s) =>
                s.id === shapeId ? { ...s, ...updates } as Shape : s
              ),
            },
          },
        },
        future: [],
        ui: { ...state.ui, isDirty: true },
      };
    }

    case 'DELETE_SHAPES': {
      const { view, shapeIds } = action.payload;
      const count = shapeIds.length;
      const entry: HistoryEntry = { label: `Delete ${count} shape(s)`, state: state.present, timestamp: Date.now() };
      return {
        past: [...state.past, entry].slice(-MAX_HISTORY),
        present: {
          ...state.present,
          views: {
            ...state.present.views,
            [view]: {
              ...state.present.views[view],
              shapes: state.present.views[view].shapes.filter((s) => !shapeIds.includes(s.id)),
            },
          },
        },
        future: [],
        ui: { ...state.ui, isDirty: true },
      };
    }

    case 'MOVE_SHAPES': {
      const { view, moves } = action.payload;
      const moveMap = new Map(moves.map((m) => [m.id, m]));
      return {
        ...state,
        present: {
          ...state.present,
          views: {
            ...state.present.views,
            [view]: {
              ...state.present.views[view],
              shapes: state.present.views[view].shapes.map((s) => {
                const move = moveMap.get(s.id);
                if (!move) return s;
                const dx = move.x - s.x;
                const dy = move.y - s.y;
                if (s.type === 'circle') {
                  const cs = s as CircleShape;
                  return { ...cs, x: move.x, y: move.y, cx: cs.cx + dx, cy: cs.cy + dy } as Shape;
                }
                return { ...s, x: move.x, y: move.y } as Shape;
              }),
            },
          },
        },
        ui: { ...state.ui, isDirty: true },
      };
    }

    case 'ADD_CONNECTOR': {
      const connector = action.payload;
      const entry: HistoryEntry = { label: `Add connector ${connector.name}`, state: state.present, timestamp: Date.now() };
      return {
        past: [...state.past, entry].slice(-MAX_HISTORY),
        present: {
          ...state.present,
          connectors: [...state.present.connectors, connector],
        },
        future: [],
        ui: { ...state.ui, isDirty: true },
      };
    }

    case 'UPDATE_CONNECTOR': {
      const { connectorId, updates } = action.payload;
      const entry: HistoryEntry = { label: 'Update connector', state: state.present, timestamp: Date.now() };
      return {
        past: [...state.past, entry].slice(-MAX_HISTORY),
        present: {
          ...state.present,
          connectors: state.present.connectors.map((c) =>
            c.id === connectorId ? { ...c, ...updates } : c
          ),
        },
        future: [],
        ui: { ...state.ui, isDirty: true },
      };
    }

    case 'DELETE_CONNECTOR': {
      const entry: HistoryEntry = { label: 'Delete connector', state: state.present, timestamp: Date.now() };
      return {
        past: [...state.past, entry].slice(-MAX_HISTORY),
        present: {
          ...state.present,
          connectors: state.present.connectors.filter((c) => c.id !== action.payload),
        },
        future: [],
        ui: { ...state.ui, isDirty: true },
      };
    }

    case 'SET_TOOL':
      return { ...state, ui: { ...state.ui, activeTool: action.payload } };

    case 'COPY_SHAPES': {
      const { view } = action.payload;
      const selected = state.ui.selectedShapeIds;
      const copied = state.present.views[view].shapes.filter((s) => selected.includes(s.id));
      return { ...state, ui: { ...state.ui, clipboard: copied } };
    }

    case 'PASTE_SHAPES': {
      const { view } = action.payload;
      const clipboard = state.ui.clipboard;
      if (clipboard.length === 0) return state;
      const entry: HistoryEntry = { label: `Paste ${clipboard.length} shape(s)`, state: state.present, timestamp: Date.now() };
      const newIds: string[] = [];
      const newShapes = clipboard.map((s) => {
        const newId = nanoid();
        newIds.push(newId);
        return { ...s, id: newId, x: s.x + 20, y: s.y + 20 } as Shape;
      });
      return {
        past: [...state.past, entry].slice(-MAX_HISTORY),
        present: {
          ...state.present,
          views: {
            ...state.present.views,
            [view]: {
              ...state.present.views[view],
              shapes: [...state.present.views[view].shapes, ...newShapes],
            },
          },
        },
        future: [],
        ui: { ...state.ui, isDirty: true, selectedShapeIds: newIds },
      };
    }

    case 'SET_LAYER_CONFIG': {
      const newPresent = { ...state.present };
      newPresent.views = { ...newPresent.views };
      newPresent.views[action.payload.view] = {
        ...newPresent.views[action.payload.view],
        layerConfig: action.payload.layerConfig,
      };
      return { ...state, present: newPresent, ui: { ...state.ui, isDirty: true } };
    }

    case 'SET_ACTIVE_LAYER':
      return { ...state, ui: { ...state.ui, activeLayer: action.payload } };

    case 'JUMP_TO_HISTORY': {
      const targetIndex = action.payload.index;
      const currentIndex = state.past.length;
      if (targetIndex === currentIndex) return state;

      if (targetIndex < currentIndex) {
        const keepPast = state.past.slice(0, targetIndex);
        const movedPast = state.past.slice(targetIndex);
        const newPresent = movedPast[0].state;
        const newFutureFromPast = movedPast.slice(1).map(entry => ({
          label: entry.label,
          state: entry.state,
          timestamp: entry.timestamp,
        }));
        const currentEntry: HistoryEntry = {
          label: 'Jump back',
          state: state.present,
          timestamp: Date.now(),
        };
        return {
          past: keepPast,
          present: newPresent,
          future: [...newFutureFromPast, currentEntry, ...state.future],
          ui: { ...state.ui, isDirty: keepPast.length > 0 },
        };
      } else {
        const futureIndex = targetIndex - currentIndex - 1;
        if (futureIndex < 0 || futureIndex >= state.future.length) return state;
        const movedFuture = state.future.slice(0, futureIndex + 1);
        const keepFuture = state.future.slice(futureIndex + 1);
        const currentEntry: HistoryEntry = {
          label: 'Jump forward',
          state: state.present,
          timestamp: Date.now(),
        };
        const newPastEntries = movedFuture.slice(0, -1).map(entry => ({
          label: entry.label,
          state: entry.state,
          timestamp: entry.timestamp,
        }));
        const newPresent = movedFuture[movedFuture.length - 1].state;
        return {
          past: [...state.past, currentEntry, ...newPastEntries].slice(-MAX_HISTORY),
          present: newPresent,
          future: keepFuture,
          ui: { ...state.ui, isDirty: true },
        };
      }
    }

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
