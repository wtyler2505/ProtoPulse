import { createContext, useContext, useState, useEffect, useRef } from 'react';
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
  addBomItem: (item: Omit<BomItem, 'id'>) => void;
  deleteBomItem: (id: number) => void;
  updateBomItem: (id: number, data: Partial<BomItem>) => void;

  issues: ValidationIssue[];
  runValidation: () => void;
  addValidationIssue: (issue: { severity: string; message: string; componentId?: string; suggestion?: string }) => void;
  deleteValidationIssue: (id: number) => void;

  messages: ChatMessage[];
  addMessage: (msg: ChatMessage | string) => void;
  isGenerating: boolean;
  setIsGenerating: (bg: boolean) => void;

  history: ProjectHistoryItem[];
  addToHistory: (action: string, user: 'User' | 'AI') => void;

  outputLog: string[];
  addOutputLog: (log: string) => void;
  clearOutputLog: () => void;

  projectName: string;
  setProjectName: (name: string) => void;
  projectDescription: string;
  setProjectDescription: (desc: string) => void;

  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  focusNodeId: string | null;
  focusNode: (nodeId: string) => void;

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

const validationChecks = [
  { severity: 'info', message: 'Check I2C pull-up resistor values for SHT40', componentId: '4', suggestion: 'Recommended 4.7kΩ for 100kHz standard mode.' },
  { severity: 'warning', message: 'No ESD protection on USB-C data lines', componentId: '5', suggestion: 'Add TVS diode array (e.g., USBLC6-2SC6) for ESD protection.' },
  { severity: 'info', message: 'Consider adding watchdog timer configuration', componentId: '1', suggestion: 'Enable ESP32 hardware WDT with 5s timeout for field reliability.' },
  { severity: 'warning', message: 'Battery reverse polarity protection missing', componentId: '2', suggestion: 'Add P-channel MOSFET or Schottky diode for reverse polarity protection.' },
  { severity: 'error', message: 'SPI bus contention possible without proper CS management', componentId: '3', suggestion: 'Ensure CS lines have pull-up resistors and are properly sequenced.' },
  { severity: 'info', message: 'Power sequencing not defined for multi-rail design', componentId: '2', suggestion: 'Define power-up sequence: 3.3V → 1.8V → I/O to prevent latch-up.' },
];

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const validationCheckIndex = useRef(0);

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

  const [projectName, setProjectName] = useState('Smart_Agro_Node_v1');
  const [projectDescription, setProjectDescription] = useState('IoT Agriculture Sensor Node');

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);

  const focusNode = (nodeId: string) => {
    setFocusNodeId(nodeId);
    setSelectedNodeId(nodeId);
    setActiveView('architecture');
    setTimeout(() => setFocusNodeId(null), 500);
  };

  const [isGenerating, setIsGenerating] = useState(false);

  const [outputLog, setOutputLog] = useState<string[]>([
    "[SYSTEM] Initializing ProtoPulse Core...",
    "[PROJECT] Smart_Agro_Node_v1 loaded.",
    "[AI] Ready for queries."
  ]);

  const addOutputLog = (log: string) => {
    setOutputLog(prev => [...prev, log]);
  };

  const clearOutputLog = () => {
    setOutputLog([]);
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

  const projectQuery = useQuery({
    queryKey: [`/api/projects/${PROJECT_ID}`],
    enabled: seeded,
  });

  const updateProjectMutation = useMutation({
    mutationFn: async (data: { name?: string; description?: string }) => {
      await apiRequest('PATCH', `/api/projects/${PROJECT_ID}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${PROJECT_ID}`] });
    },
  });

  const handleSetProjectName = (name: string) => {
    setProjectName(name);
    updateProjectMutation.mutate({ name });
  };

  const handleSetProjectDescription = (desc: string) => {
    setProjectDescription(desc);
    updateProjectMutation.mutate({ description: desc });
  };

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

  const addBomItemMutation = useMutation({
    mutationFn: async (item: Omit<BomItem, 'id'>) => {
      await apiRequest('POST', `/api/projects/${PROJECT_ID}/bom`, item);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${PROJECT_ID}/bom`] });
    },
  });

  const deleteBomItemMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/bom/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${PROJECT_ID}/bom`] });
    },
  });

  const updateBomItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<BomItem> }) => {
      await apiRequest('PATCH', `/api/bom/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${PROJECT_ID}/bom`] });
    },
  });

  const deleteValidationIssueMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/validation/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${PROJECT_ID}/validation`] });
    },
  });

  // Track whether nodes/edges have been modified after hydration so we don't trigger an unnecessary
  // initial save. The first call to setNodes or setEdges simply marks the data as dirty; subsequent
  // calls will persist the changes to the server. This helps avoid a save on initial hydration
  // without introducing debouncing complexity.
  const nodesDirtyRef = useRef(false);
  const edgesDirtyRef = useRef(false);

  const setNodes = (nodes: Node[]) => {
    if (nodesDirtyRef.current) {
      saveNodesMutation.mutate(nodes);
    } else {
      nodesDirtyRef.current = true;
    }
  };

  const setEdges = (edges: Edge[]) => {
    if (edgesDirtyRef.current) {
      saveEdgesMutation.mutate(edges);
    } else {
      edgesDirtyRef.current = true;
    }
  };

  const addMessage = (msg: ChatMessage | string) => {
    if (typeof msg === 'string') {
      addChatMutation.mutate({ role: 'user', content: msg });
    } else {
      addChatMutation.mutate({ role: msg.role, content: msg.content, mode: msg.mode });
    }
  };

  const addToHistory = (action: string, user: 'User' | 'AI') => {
    addHistoryMutation.mutate({ action, user });
  };

  const runValidation = () => {
    const check = validationChecks[validationCheckIndex.current % validationChecks.length];
    validationCheckIndex.current += 1;
    addValidationIssueMutation.mutate(check);
  };

  const addValidationIssue = (issue: { severity: string; message: string; componentId?: string; suggestion?: string }) => {
    addValidationIssueMutation.mutate(issue);
  };

  const addBomItem = (item: Omit<BomItem, 'id'>) => addBomItemMutation.mutate(item);
  const deleteBomItemFn = (id: number) => deleteBomItemMutation.mutate(id);
  const updateBomItemFn = (id: number, data: Partial<BomItem>) => updateBomItemMutation.mutate({ id, data });
  const deleteValidationIssue = (id: number) => deleteValidationIssueMutation.mutate(id);

  useEffect(() => {
    if (projectQuery.data) {
      const p = projectQuery.data as any;
      if (p.name && p.name !== projectName) setProjectName(p.name);
      if (p.description !== undefined && p.description !== projectDescription) setProjectDescription(p.description ?? '');
    }
  }, [projectQuery.data]);

  const isLoading = !seeded || nodesQuery.isLoading || edgesQuery.isLoading || bomQuery.isLoading || validationQuery.isLoading || chatQuery.isLoading || historyQuery.isLoading || projectQuery.isLoading;
  const hasError = nodesQuery.isError || edgesQuery.isError || bomQuery.isError || validationQuery.isError || chatQuery.isError || historyQuery.isError;

  if (isLoading) {
    // Show a simple loader; in a real app we might show a spinner. This avoids rendering empty UI while data loads.
    return null;
  }

  if (hasError) {
    return (
      <div className="h-full flex items-center justify-center text-destructive">
        <p>Failed to load project data. Please check your connection and try again.</p>
      </div>
    );
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
      addBomItem, deleteBomItem: deleteBomItemFn, updateBomItem: updateBomItemFn,
      issues: validationQuery.data ?? [],
      runValidation,
      addValidationIssue,
      deleteValidationIssue,
      messages: chatQuery.data ?? [],
      addMessage, isGenerating, setIsGenerating,
      history: historyQuery.data ?? [],
      addToHistory,
      outputLog, addOutputLog, clearOutputLog,
      projectName, setProjectName: handleSetProjectName, projectDescription, setProjectDescription: handleSetProjectDescription,
      selectedNodeId, setSelectedNodeId, focusNodeId, focusNode,
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
