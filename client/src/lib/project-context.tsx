import { createContext, useContext, useState, useEffect } from 'react';
import { Node, Edge } from '@xyflow/react';

// --- Types ---

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
  mode?: 'chat' | 'image' | 'video'; // For multi-modal stubs
}

export interface ProjectHistoryItem {
  id: string;
  action: string;
  timestamp: string;
  user: 'User' | 'AI';
}

export type ViewMode = 'project_explorer' | 'output' | 'architecture' | 'schematic' | 'procurement' | 'validation';

// --- State Interface ---

interface ProjectState {
  // Navigation
  activeView: ViewMode;
  setActiveView: (view: ViewMode) => void;

  // Architecture (Block Diagram)
  nodes: Node[];
  edges: Edge[];
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;

  // Schematic (Simplified)
  schematicSheets: { id: string; name: string; content: any }[];
  activeSheetId: string;
  setActiveSheetId: (id: string) => void;

  // Procurement
  bom: BomItem[];
  bomSettings: {
    maxCost: number;
    batchSize: number;
    inStockOnly: boolean;
    manufacturingDate: Date;
  };
  setBomSettings: (settings: any) => void;

  // Validation
  issues: ValidationIssue[];
  runValidation: () => void;

  // Chat / AI
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  isGenerating: boolean;
  setIsGenerating: (bg: boolean) => void;

  // History
  history: ProjectHistoryItem[];
  addToHistory: (action: string, user: 'User' | 'AI') => void;

  // Output
  outputLog: string[];
  addOutputLog: (log: string) => void;
}

// --- Context ---

const ProjectContext = createContext<ProjectState | undefined>(undefined);

// --- Provider ---

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  // Navigation
  const [activeView, setActiveView] = useState<ViewMode>('architecture');

  // Architecture Data (Mocked Initial State)
  const [nodes, setNodes] = useState<Node[]>([
    { id: '1', type: 'custom', position: { x: 400, y: 100 }, data: { label: 'ESP32-S3-WROOM-1', type: 'mcu', description: 'Dual-core MCU, Wi-Fi/BLE' } },
    { id: '2', type: 'custom', position: { x: 150, y: 250 }, data: { label: 'TP4056 PMU', type: 'power', description: 'Li-Ion Battery Charger' } },
    { id: '3', type: 'custom', position: { x: 650, y: 250 }, data: { label: 'SX1262 LoRa', type: 'comm', description: 'Long Range Transceiver' } },
    { id: '4', type: 'custom', position: { x: 400, y: 400 }, data: { label: 'SHT40', type: 'sensor', description: 'Temp/Humidity Sensor' } },
    { id: '5', type: 'custom', position: { x: 150, y: 100 }, data: { label: 'USB-C Connector', type: 'connector', description: 'Power/Data Input' } },
  ]);
  
  const [edges, setEdges] = useState<Edge[]>([
    { id: 'e5-2', source: '5', target: '2', animated: true, label: '5V VBUS', style: { stroke: '#ef4444' } },
    { id: 'e2-1', source: '2', target: '1', animated: true, label: '3.3V', style: { stroke: '#ef4444' } },
    { id: 'e1-3', source: '1', target: '3', animated: true, label: 'SPI', style: { stroke: '#06b6d4' } },
    { id: 'e1-4', source: '1', target: '4', animated: true, label: 'I2C', style: { stroke: '#06b6d4' } },
  ]);

  // Schematic Data
  const [schematicSheets, setSchematicSheets] = useState([
    { id: 'top', name: 'Top Level.sch', content: {} },
    { id: 'power', name: 'Power.sch', content: {} },
    { id: 'mcu', name: 'MCU_Core.sch', content: {} },
  ]);
  const [activeSheetId, setActiveSheetId] = useState('top');

  // Procurement Data
  const [bom, setBom] = useState<BomItem[]>([
    { id: '1', partNumber: 'ESP32-S3-WROOM-1', manufacturer: 'Espressif', description: 'Wi-Fi/BLE MCU Module', quantity: 1, unitPrice: 3.50, totalPrice: 3.50, supplier: 'Mouser', stock: 1240, status: 'In Stock' },
    { id: '2', partNumber: 'TP4056', manufacturer: 'Top Power', description: 'Li-Ion Charger IC', quantity: 1, unitPrice: 0.15, totalPrice: 0.15, supplier: 'LCSC', stock: 50000, status: 'In Stock' },
    { id: '3', partNumber: 'SX1262IMLTRT', manufacturer: 'Semtech', description: 'LoRa Transceiver', quantity: 1, unitPrice: 4.20, totalPrice: 4.20, supplier: 'Digi-Key', stock: 85, status: 'Low Stock' },
    { id: '4', partNumber: 'SHT40-AD1B-R2', manufacturer: 'Sensirion', description: 'Sensor Humidity/Temp', quantity: 1, unitPrice: 1.85, totalPrice: 1.85, supplier: 'Mouser', stock: 5000, status: 'In Stock' },
    { id: '5', partNumber: 'USB4105-GF-A', manufacturer: 'GCT', description: 'USB Type-C Receptacle', quantity: 1, unitPrice: 0.65, totalPrice: 0.65, supplier: 'Digi-Key', stock: 12000, status: 'In Stock' },
  ]);
  const [bomSettings, setBomSettings] = useState({
    maxCost: 50,
    batchSize: 1000,
    inStockOnly: true,
    manufacturingDate: new Date(),
  });

  // Validation Data
  const [issues, setIssues] = useState<ValidationIssue[]>([
    { id: '1', severity: 'warning', message: 'Missing decoupling capacitor on ESP32 VDD', componentId: '1', suggestion: 'Add 10uF + 0.1uF ceramic capacitors close to pins.' },
    { id: '2', severity: 'error', message: 'LoRa antenna path impedance mismatch likely', componentId: '3', suggestion: 'Check RF trace width and add Pi-matching network.' },
  ]);

  const runValidation = () => {
    // Mock validation logic
    const newIssues: ValidationIssue[] = [...issues];
    // Randomly add an issue if list is short
    if (newIssues.length < 3) {
      newIssues.push({
         id: Date.now().toString(),
         severity: 'info',
         message: 'Check I2C pull-up resistor values for SHT40',
         componentId: '4',
         suggestion: 'Recommended 4.7kΩ for 100kHz standard mode.'
      });
    }
    setIssues(newIssues);
  };

  // Chat Data
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'system', content: 'Welcome to ProtoPulse AI. I can help you generate architectures, create schematics, and optimize your BOM.', timestamp: Date.now(), mode: 'chat' }
  ]);
  const [isGenerating, setIsGenerating] = useState(false);

  const addMessage = (msg: ChatMessage) => {
    setMessages(prev => [...prev, msg]);
  };

  // History Data
  const [history, setHistory] = useState<ProjectHistoryItem[]>([
    { id: '1', action: 'Project Created', timestamp: '1h ago', user: 'User' },
    { id: '2', action: 'Added ESP32-S3', timestamp: '45m ago', user: 'User' },
    { id: '3', action: 'Auto-connected Power Rails', timestamp: '10m ago', user: 'AI' },
  ]);

  const addToHistory = (action: string, user: 'User' | 'AI') => {
    const newItem: ProjectHistoryItem = {
      id: Date.now().toString(),
      action,
      timestamp: 'Just now',
      user
    };
    setHistory(prev => [newItem, ...prev]);
  };

  // Output Logs
  const [outputLog, setOutputLog] = useState<string[]>([
    "[SYSTEM] Initializing ProtoPulse Core...",
    "[PROJECT] Smart_Agro_Node_v1 loaded.",
    "[AI] Ready for queries."
  ]);

  const addOutputLog = (log: string) => {
    setOutputLog(prev => [...prev, log]);
  };

  return (
    <ProjectContext.Provider value={{
      activeView, setActiveView,
      nodes, edges, setNodes, setEdges,
      schematicSheets, activeSheetId, setActiveSheetId,
      bom, bomSettings, setBomSettings,
      issues, runValidation,
      messages, addMessage, isGenerating, setIsGenerating,
      history, addToHistory,
      outputLog, addOutputLog
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
