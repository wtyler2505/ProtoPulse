import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';

// Domain context providers
import { ProjectIdProvider } from '@/lib/contexts/project-id-context';
import { OutputProvider, useOutput } from '@/lib/contexts/output-context';
import { ChatProvider, useChat } from '@/lib/contexts/chat-context';
import { HistoryProvider, useHistory } from '@/lib/contexts/history-context';
import { BomProvider, useBom } from '@/lib/contexts/bom-context';
import { ValidationProvider, useValidation } from '@/lib/contexts/validation-context';
import { ProjectMetaProvider, useProjectMeta } from '@/lib/contexts/project-meta-context';
import { ArchitectureProvider, useArchitecture } from '@/lib/contexts/architecture-context';

// Re-export domain hooks for direct use by consumers
export { useProjectId } from '@/lib/contexts/project-id-context';
export { useOutput } from '@/lib/contexts/output-context';
export { useChat } from '@/lib/contexts/chat-context';
export { useHistory } from '@/lib/contexts/history-context';
export { useBom } from '@/lib/contexts/bom-context';
export { useValidation } from '@/lib/contexts/validation-context';
export { useProjectMeta } from '@/lib/contexts/project-meta-context';
export { useArchitecture } from '@/lib/contexts/architecture-context';

export interface Position {
  x: number;
  y: number;
}

export interface BlockNode {
  id: string;
  type: 'mcu' | 'sensor' | 'power' | 'comm' | 'connector' | 'generic';
  label: string;
  position: Position;
  data: {
    partNumber?: string;
    description?: string;
    manufacturer?: string;
    specs?: Record<string, string>;
  };
}

export interface BomItem {
  id: string;
  partNumber: string;
  manufacturer: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  supplier: 'Digi-Key' | 'Mouser' | 'LCSC' | 'Unknown';
  stock: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock' | 'On Order';
  leadTime?: string;
  esdSensitive?: boolean | null;
  assemblyCategory?: 'smt' | 'through_hole' | 'hand_solder' | 'mechanical' | null;
}

export interface ValidationIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  componentId?: string;
  suggestion?: string;
}

export interface ChatAttachment {
  type: 'image' | 'file';
  name: string;
  url?: string;
  data?: string;
}

export interface ChatAction {
  type: string;
  [key: string]: unknown;
}

export interface ToolCallInfo {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result: { success: boolean; message: string; data?: unknown };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  attachments?: ChatAttachment[];
  mode?: 'chat' | 'image' | 'video';
  actions?: ChatAction[];
  toolCalls?: ToolCallInfo[];
  isError?: boolean;
  isKeyError?: boolean;
  isStreaming?: boolean;
}

export interface ProjectHistoryItem {
  id: string;
  action: string;
  timestamp: string;
  user: 'User' | 'AI';
}

export type ViewMode = 'dashboard' | 'project_explorer' | 'output' | 'architecture' | 'component_editor' | 'schematic' | 'breadboard' | 'pcb' | 'procurement' | 'validation' | 'simulation' | 'design_history' | 'lifecycle' | 'comments' | 'calculators' | 'design_patterns' | 'storage' | 'kanban' | 'knowledge' | 'viewer_3d' | 'community' | 'ordering';

/**
 * Inner provider that nests all domain providers once seeded state is ready.
 * ArchitectureProvider needs setActiveView from ProjectMetaProvider, so it
 * must be nested inside ProjectMetaProvider.
 */
function SeededProviders({ children }: { children: React.ReactNode }) {
  return (
    <OutputProvider>
      <ChatProvider seeded>
        <HistoryProvider seeded>
          <BomProvider seeded>
            <ValidationProvider seeded>
              <ProjectMetaProvider seeded>
                <ArchitectureBridge>
                  {children}
                </ArchitectureBridge>
              </ProjectMetaProvider>
            </ValidationProvider>
          </BomProvider>
        </HistoryProvider>
      </ChatProvider>
    </OutputProvider>
  );
}

/**
 * Bridge component that reads setActiveView from ProjectMetaContext and passes
 * it to ArchitectureProvider, since ArchitectureProvider.focusNode needs it.
 */
function ArchitectureBridge({ children }: { children: React.ReactNode }) {
  const { setActiveView } = useProjectMeta();
  return (
    <ArchitectureProvider seeded setActiveView={setActiveView}>
      {children}
    </ArchitectureProvider>
  );
}

/**
 * Root provider that handles seeding, loading, and error states, then nests
 * all domain providers. Drop-in replacement for the old monolithic provider.
 */
export function ProjectProvider({ projectId, children }: { projectId: number; children: React.ReactNode }) {
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    apiRequest('POST', '/api/seed').then(() => {
      setSeeded(true);
    }).catch(() => {
      setSeeded(true);
    });
  }, []);

  if (!seeded) {
    return null;
  }

  return (
    <ProjectIdProvider projectId={projectId}>
      <SeededProviders>{children}</SeededProviders>
    </ProjectIdProvider>
  );
}

/**
 * Backward-compatible hook that composes all domain hooks into the original
 * ProjectState shape. Consumers can migrate to domain-specific hooks
 * incrementally (e.g., useArchitecture, useBom, useChat).
 *
 * @deprecated Use domain-specific hooks instead: useProjectMeta, useArchitecture,
 * useBom, useValidation, useChat, useHistory, useOutput.
 */
export const useProject = () => {
  const meta = useProjectMeta();
  const arch = useArchitecture();
  const bom = useBom();
  const val = useValidation();
  const chat = useChat();
  const hist = useHistory();
  const out = useOutput();

  return {
    // Project metadata
    activeView: meta.activeView,
    setActiveView: meta.setActiveView,
    projectName: meta.projectName,
    setProjectName: meta.setProjectName,
    projectDescription: meta.projectDescription,
    setProjectDescription: meta.setProjectDescription,
    schematicSheets: meta.schematicSheets,
    activeSheetId: meta.activeSheetId,
    setActiveSheetId: meta.setActiveSheetId,
    isLoading: meta.isLoading,

    // Architecture
    nodes: arch.nodes,
    edges: arch.edges,
    setNodes: arch.setNodes,
    setEdges: arch.setEdges,
    selectedNodeId: arch.selectedNodeId,
    setSelectedNodeId: arch.setSelectedNodeId,
    focusNodeId: arch.focusNodeId,
    focusNode: arch.focusNode,
    undoStack: arch.undoStack,
    redoStack: arch.redoStack,
    pushUndoState: arch.pushUndoState,
    undo: arch.undo,
    redo: arch.redo,
    canUndo: arch.canUndo,
    canRedo: arch.canRedo,
    lastAITurnSnapshot: arch.lastAITurnSnapshot,
    captureSnapshot: arch.captureSnapshot,
    getChangeDiff: arch.getChangeDiff,
    pendingComponentPartId: arch.pendingComponentPartId,
    setPendingComponentPartId: arch.setPendingComponentPartId,

    // BOM
    bom: bom.bom,
    bomSettings: bom.bomSettings,
    setBomSettings: bom.setBomSettings,
    addBomItem: bom.addBomItem,
    deleteBomItem: bom.deleteBomItem,
    updateBomItem: bom.updateBomItem,

    // Validation
    issues: val.issues,
    runValidation: val.runValidation,
    addValidationIssue: val.addValidationIssue,
    deleteValidationIssue: val.deleteValidationIssue,

    // Chat
    messages: chat.messages,
    addMessage: chat.addMessage,
    isGenerating: chat.isGenerating,
    setIsGenerating: chat.setIsGenerating,

    // History
    history: hist.history,
    addToHistory: hist.addToHistory,

    // Output
    outputLog: out.outputLog,
    addOutputLog: out.addOutputLog,
    clearOutputLog: out.clearOutputLog,
  };
};
