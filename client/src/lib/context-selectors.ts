import { useMemo } from 'react';
import { useProject } from './project-context';

export function useDiagram() {
  const ctx = useProject();
  return useMemo(() => ({
    nodes: ctx.nodes,
    edges: ctx.edges,
    setNodes: ctx.setNodes,
    setEdges: ctx.setEdges,
    selectedNodeId: ctx.selectedNodeId,
    setSelectedNodeId: ctx.setSelectedNodeId,
    focusNodeId: ctx.focusNodeId,
    focusNode: ctx.focusNode,
    undoStack: ctx.undoStack,
    redoStack: ctx.redoStack,
    pushUndoState: ctx.pushUndoState,
    undo: ctx.undo,
    redo: ctx.redo,
    canUndo: ctx.canUndo,
    canRedo: ctx.canRedo,
  }), [ctx.nodes, ctx.edges, ctx.setNodes, ctx.setEdges, ctx.selectedNodeId, ctx.setSelectedNodeId, ctx.focusNodeId, ctx.focusNode, ctx.undoStack, ctx.redoStack, ctx.pushUndoState, ctx.undo, ctx.redo, ctx.canUndo, ctx.canRedo]);
}

export function useBom() {
  const ctx = useProject();
  return useMemo(() => ({
    bom: ctx.bom,
    bomSettings: ctx.bomSettings,
    setBomSettings: ctx.setBomSettings,
    addBomItem: ctx.addBomItem,
    deleteBomItem: ctx.deleteBomItem,
    updateBomItem: ctx.updateBomItem,
  }), [ctx.bom, ctx.bomSettings, ctx.setBomSettings, ctx.addBomItem, ctx.deleteBomItem, ctx.updateBomItem]);
}

export function useValidation() {
  const ctx = useProject();
  return useMemo(() => ({
    issues: ctx.issues,
    runValidation: ctx.runValidation,
    addValidationIssue: ctx.addValidationIssue,
    deleteValidationIssue: ctx.deleteValidationIssue,
  }), [ctx.issues, ctx.runValidation, ctx.addValidationIssue, ctx.deleteValidationIssue]);
}

export function useChat() {
  const ctx = useProject();
  return useMemo(() => ({
    messages: ctx.messages,
    addMessage: ctx.addMessage,
    isGenerating: ctx.isGenerating,
    setIsGenerating: ctx.setIsGenerating,
  }), [ctx.messages, ctx.addMessage, ctx.isGenerating, ctx.setIsGenerating]);
}

export function useProjectMeta() {
  const ctx = useProject();
  return useMemo(() => ({
    projectName: ctx.projectName,
    setProjectName: ctx.setProjectName,
    projectDescription: ctx.projectDescription,
    setProjectDescription: ctx.setProjectDescription,
    activeView: ctx.activeView,
    setActiveView: ctx.setActiveView,
  }), [ctx.projectName, ctx.setProjectName, ctx.projectDescription, ctx.setProjectDescription, ctx.activeView, ctx.setActiveView]);
}

export function useOutput() {
  const ctx = useProject();
  return useMemo(() => ({
    outputLog: ctx.outputLog,
    addOutputLog: ctx.addOutputLog,
    clearOutputLog: ctx.clearOutputLog,
  }), [ctx.outputLog, ctx.addOutputLog, ctx.clearOutputLog]);
}

export function useSchematic() {
  const ctx = useProject();
  return useMemo(() => ({
    schematicSheets: ctx.schematicSheets,
    activeSheetId: ctx.activeSheetId,
    setActiveSheetId: ctx.setActiveSheetId,
  }), [ctx.schematicSheets, ctx.activeSheetId, ctx.setActiveSheetId]);
}

export function useHistory() {
  const ctx = useProject();
  return useMemo(() => ({
    history: ctx.history,
    addToHistory: ctx.addToHistory,
  }), [ctx.history, ctx.addToHistory]);
}

export function useSnapshot() {
  const ctx = useProject();
  return useMemo(() => ({
    lastAITurnSnapshot: ctx.lastAITurnSnapshot,
    captureSnapshot: ctx.captureSnapshot,
    getChangeDiff: ctx.getChangeDiff,
  }), [ctx.lastAITurnSnapshot, ctx.captureSnapshot, ctx.getChangeDiff]);
}
