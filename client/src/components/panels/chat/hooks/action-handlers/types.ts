import type { Node, Edge } from '@xyflow/react';
import type { BomItem, ValidationIssue, ViewMode } from '@/lib/project-context';
import type { AIAction } from '../../chat-types';

/** Mutable accumulator state passed by reference to all handlers. */
export interface ActionState {
  currentNodes: Node[];
  currentEdges: Edge[];
  currentBom: BomItem[];
  currentIssues: ValidationIssue[];
  nodesDirty: boolean;
  edgesDirty: boolean;
}

/** Context hooks and metadata that handlers use to dispatch side-effects. */
export interface ActionContext {
  state: ActionState;
  arch: {
    setActiveView: (view: ViewMode) => void;
    undo: () => void;
    redo: () => void;
  };
  bom: {
    addBomItem: (item: Omit<BomItem, 'id'>) => void;
    deleteBomItem: (id: string) => void;
    updateBomItem: (id: string, updates: Record<string, unknown>) => void;
  };
  validation: {
    runValidation: () => void;
    deleteValidationIssue: (id: string) => void;
    addValidationIssue: (issue: Omit<ValidationIssue, 'id'>) => void;
  };
  meta: {
    projectName: string;
    projectDescription: string;
    setProjectName: (name: string) => void;
    setProjectDescription: (desc: string) => void;
  };
  history: {
    addToHistory: (message: string, source: 'AI' | 'User') => void;
  };
  output: {
    addOutputLog: (message: string) => void;
  };
}

/** A single action handler function. */
export type ActionHandler = (action: AIAction, ctx: ActionContext) => void;
