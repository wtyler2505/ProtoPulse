import { createContext, useContext, useState, useEffect } from 'react';
import { Node, Edge } from '@xyflow/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

const PROJECT_ID = 1;

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
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
  leadTime?: string;
}

export interface ValidationIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  componentId?: string;
  suggestion?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  attachments?: any[];
  mode?: 'chat' | 'image' | 'video';
}

export interface ProjectHistoryItem {
  id: string;
  action: string;
  timestamp: string;
  user: 'User' | 'AI';
}

export type ViewMode = 'project_explorer' | 'output' | 'architecture' | 'schematic' | 'procurement' | 'validation';

interface ProjectState {
  activeView: ViewMode;
  setActiveView: (view: ViewMode) => void;

  nodes: Node[];
  edges: Edge[];
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;

  schematicSheets: { id: string; name: string; content: any }[];
  activeSheetId: string;
  setActiveSheetId: (id: string) => void;

  bom: BomItem[];
  bomSettings: {
    maxCost: number;
    batchSize: number;
    inStockOnly: boolean;
    manufacturingDate: Date;
  };
  setBomSettings: (settings: any) => void;

  issues: ValidationIssue[];
  runValidation: () => void;

  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  isGenerating: boolean;
  setIsGenerating: (bg: boolean) => void;

  history: ProjectHistoryItem[];
  addToHistory: (action: string, user: 'User' | 'AI') => void;

  outputLog: string[];
  addOutputLog: (log: string) => void;

  isLoading: boolean;
}

const ProjectContext = createContext<ProjectState | undefined>(undefined);

function formatTimeAgo(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    apiRequest('POST', '/api/seed').then(() => {
      setSeeded(true);
    }).catch(() => {
      setSeeded(true);
    });
  }, []);

  const [activeView, setActiveView] = useState<ViewMode>('architecture');

  const [schematicSheets] = useState([
    { id: 'top', name: 'Top Level.sch', content: {} },
    { id: 'power', name: 'Power.sch', content: {} },
    { id: 'mcu', name: 'MCU_Core.sch', content: {} },
  ]);
  const [activeSheetId, setActiveSheetId] = useState('top');

  const [bomSettings, setBomSettings] = useState({
    maxCost: 50,
    batchSize: 1000,
    inStockOnly: true,
    manufacturingDate: new Date(),
  });

  const [isGenerating, setIsGenerating] = useState(false);

  const [outputLog, setOutputLog] = useState<string[]>([
    "[SYSTEM] Initializing ProtoPulse Core...",
    "[PROJECT] Smart_Agro_Node_v1 loaded.",
    "[AI] Ready for queries."
  ]);

  const addOutputLog = (log: string) => {
    setOutputLog(prev => [...prev, log]);
  };

  const nodesQuery = useQuery({
    queryKey: [`/api/projects/${PROJECT_ID}/nodes`],
    enabled: seeded,
    select: (data: any[]) => data.map((n: any): Node => ({
      id: n.nodeId,
      type: 'custom',
      position: { x: n.positionX, y: n.positionY },
      data: { label: n.label, type: n.nodeType, description: (n.data as any)?.description },
    })),
  });

  const edgesQuery = useQuery({
    queryKey: [`/api/projects/${PROJECT_ID}/edges`],
    enabled: seeded,
    select: (data: any[]) => data.map((e: any): Edge => ({
      id: e.edgeId,
      source: e.source,
      target: e.target,
      label: e.label,
      animated: e.animated,
      style: e.style as any,
    })),
  });

  const bomQuery = useQuery({
    queryKey: [`/api/projects/${PROJECT_ID}/bom`],
    enabled: seeded,
    select: (data: any[]) => data.map((item: any): BomItem => ({
      ...item,
      id: String(item.id),
    })),
  });

  const validationQuery = useQuery({
    queryKey: [`/api/projects/${PROJECT_ID}/validation`],
    enabled: seeded,
    select: (data: any[]) => data.map((issue: any): ValidationIssue => ({
      ...issue,
      id: String(issue.id),
    })),
  });

  const chatQuery = useQuery({
    queryKey: [`/api/projects/${PROJECT_ID}/chat`],
    enabled: seeded,
    select: (data: any[]) => data.map((msg: any): ChatMessage => ({
      id: String(msg.id),
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.timestamp).getTime(),
      mode: msg.mode,
    })),
  });

  const historyQuery = useQuery({
    queryKey: [`/api/projects/${PROJECT_ID}/history`],
    enabled: seeded,
    select: (data: any[]) => data.map((item: any): ProjectHistoryItem => ({
      id: String(item.id),
      action: item.action,
      user: item.user,
      timestamp: formatTimeAgo(item.timestamp),
    })),
  });

  const saveNodesMutation = useMutation({
    mutationFn: async (nodes: Node[]) => {
      const body = nodes.map(node => ({
        nodeId: node.id,
        nodeType: node.data.type,
        label: node.data.label,
        positionX: node.position.x,
        positionY: node.position.y,
        data: { description: node.data.description },
      }));
      await apiRequest('PUT', `/api/projects/${PROJECT_ID}/nodes`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${PROJECT_ID}/nodes`] });
    },
  });

  const saveEdgesMutation = useMutation({
    mutationFn: async (edges: Edge[]) => {
      const body = edges.map(edge => ({
        edgeId: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        animated: edge.animated ?? false,
        style: edge.style,
      }));
      await apiRequest('PUT', `/api/projects/${PROJECT_ID}/edges`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${PROJECT_ID}/edges`] });
    },
  });

  const addChatMutation = useMutation({
    mutationFn: async (msg: { role: string; content: string; mode?: string }) => {
      await apiRequest('POST', `/api/projects/${PROJECT_ID}/chat`, msg);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${PROJECT_ID}/chat`] });
    },
  });

  const addHistoryMutation = useMutation({
    mutationFn: async (data: { action: string; user: string }) => {
      await apiRequest('POST', `/api/projects/${PROJECT_ID}/history`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${PROJECT_ID}/history`] });
    },
  });

  const addValidationIssueMutation = useMutation({
    mutationFn: async (issue: { severity: string; message: string; componentId?: string; suggestion?: string }) => {
      await apiRequest('POST', `/api/projects/${PROJECT_ID}/validation`, issue);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${PROJECT_ID}/validation`] });
    },
  });

  const setNodes = (nodes: Node[]) => {
    saveNodesMutation.mutate(nodes);
  };

  const setEdges = (edges: Edge[]) => {
    saveEdgesMutation.mutate(edges);
  };

  const addMessage = (msg: ChatMessage) => {
    addChatMutation.mutate({ role: msg.role, content: msg.content, mode: msg.mode });
  };

  const addToHistory = (action: string, user: 'User' | 'AI') => {
    addHistoryMutation.mutate({ action, user });
  };

  const runValidation = () => {
    addValidationIssueMutation.mutate({
      severity: 'info',
      message: 'Check I2C pull-up resistor values for SHT40',
      componentId: '4',
      suggestion: 'Recommended 4.7kΩ for 100kHz standard mode.',
    });
  };

  const isLoading = !seeded || nodesQuery.isLoading || edgesQuery.isLoading || bomQuery.isLoading || validationQuery.isLoading || chatQuery.isLoading || historyQuery.isLoading;

  if (isLoading) {
    return null;
  }

  return (
    <ProjectContext.Provider value={{
      activeView, setActiveView,
      nodes: nodesQuery.data ?? [],
      edges: edgesQuery.data ?? [],
      setNodes, setEdges,
      schematicSheets, activeSheetId, setActiveSheetId,
      bom: bomQuery.data ?? [],
      bomSettings, setBomSettings,
      issues: validationQuery.data ?? [],
      runValidation,
      messages: chatQuery.data ?? [],
      addMessage, isGenerating, setIsGenerating,
      history: historyQuery.data ?? [],
      addToHistory,
      outputLog, addOutputLog,
      isLoading,
    }}>
      {children}
    </ProjectContext.Provider>
  );
}

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) throw new Error('useProject must be used within ProjectProvider');
  return context;
};
