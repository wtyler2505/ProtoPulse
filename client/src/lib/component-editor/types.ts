import type { PartState, EditorViewType } from '@shared/component-types';

export interface HistoryEntry {
  label: string;
  state: PartState;
  timestamp: number;
}

export interface EditorUIState {
  activeEditorView: EditorViewType;
  selectedShapeIds: string[];
  selectedConnectorId: string | null;
  isDirty: boolean;
}

export type EditorAction =
  | { type: 'LOAD_PART'; payload: PartState }
  | { type: 'SET_PART_STATE'; payload: { state: PartState; label: string } }
  | { type: 'UPDATE_META'; payload: Partial<PartState['meta']> }
  | { type: 'SET_EDITOR_VIEW'; payload: EditorViewType }
  | { type: 'SET_SELECTION'; payload: string[] }
  | { type: 'SET_CONNECTOR_SELECTION'; payload: string | null }
  | { type: 'MARK_CLEAN' }
  | { type: 'UNDO' }
  | { type: 'REDO' };

export interface EditorState {
  past: HistoryEntry[];
  present: PartState;
  future: HistoryEntry[];
  ui: EditorUIState;
}
