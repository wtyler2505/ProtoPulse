import type { PartState, EditorViewType, Shape, Connector } from '@shared/component-types';

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
  activeTool: 'select' | 'rect' | 'circle' | 'text' | 'connector' | 'line' | 'measure' | 'path';
  clipboard: Shape[];
  activeLayer: string;
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
  | { type: 'REDO' }
  | { type: 'ADD_SHAPE'; payload: { view: 'breadboard' | 'schematic' | 'pcb'; shape: Shape } }
  | { type: 'UPDATE_SHAPE'; payload: { view: 'breadboard' | 'schematic' | 'pcb'; shapeId: string; updates: Partial<Shape> } }
  | { type: 'DELETE_SHAPES'; payload: { view: 'breadboard' | 'schematic' | 'pcb'; shapeIds: string[] } }
  | { type: 'MOVE_SHAPES'; payload: { view: 'breadboard' | 'schematic' | 'pcb'; moves: Array<{ id: string; x: number; y: number }> } }
  | { type: 'ADD_CONNECTOR'; payload: Connector }
  | { type: 'UPDATE_CONNECTOR'; payload: { connectorId: string; updates: Partial<Connector> } }
  | { type: 'DELETE_CONNECTOR'; payload: string }
  | { type: 'SET_TOOL'; payload: 'select' | 'rect' | 'circle' | 'text' | 'connector' | 'line' | 'measure' | 'path' }
  | { type: 'COPY_SHAPES'; payload: { view: 'breadboard' | 'schematic' | 'pcb' } }
  | { type: 'PASTE_SHAPES'; payload: { view: 'breadboard' | 'schematic' | 'pcb' } }
  | { type: 'SET_LAYER_CONFIG'; payload: { view: 'breadboard' | 'schematic' | 'pcb'; layerConfig: Record<string, { visible: boolean; locked: boolean; color?: string }> } }
  | { type: 'SET_ACTIVE_LAYER'; payload: string }
  | { type: 'JUMP_TO_HISTORY'; payload: { index: number } };

export interface EditorState {
  past: HistoryEntry[];
  present: PartState;
  future: HistoryEntry[];
  ui: EditorUIState;
}
