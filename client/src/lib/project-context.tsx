import { createContext, useContext, useState, useEffect } from 'react';
import { BlockNode, Connection, BomItem, ValidationIssue, ChatMessage } from './types';
import { Node, Edge } from '@xyflow/react';

interface ProjectState {
  nodes: Node[];
  edges: Edge[];
  bom: BomItem[];
  issues: ValidationIssue[];
  messages: ChatMessage[];
  activeView: 'architecture' | 'schematic' | 'procurement' | 'validation';
  
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  setActiveView: (view: 'architecture' | 'schematic' | 'procurement' | 'validation') => void;
  addMessage: (msg: ChatMessage) => void;
}

const ProjectContext = createContext<ProjectState | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [nodes, setNodes] = useState<Node[]>([
    { id: '1', type: 'custom', position: { x: 250, y: 50 }, data: { label: 'ESP32-S3-WROOM-1', type: 'mcu' } },
    { id: '2', type: 'custom', position: { x: 100, y: 200 }, data: { label: 'TP4056 PMU', type: 'power' } },
    { id: '3', type: 'custom', position: { x: 400, y: 200 }, data: { label: 'SX1262 LoRa', type: 'comm' } },
  ]);
  
  const [edges, setEdges] = useState<Edge[]>([
    { id: 'e1-2', source: '2', target: '1', animated: true, label: '3.3V' },
    { id: 'e1-3', source: '1', target: '3', animated: true, label: 'SPI' },
  ]);

  const [bom, setBom] = useState<BomItem[]>([
    { id: '1', partNumber: 'ESP32-S3-WROOM-1', manufacturer: 'Espressif', description: 'Wi-Fi/BLE MCU Module', quantity: 1, unitPrice: 3.50, supplier: 'Mouser', stock: 1240, status: 'In Stock' },
    { id: '2', partNumber: 'TP4056', manufacturer: 'Top Power', description: 'Li-Ion Charger IC', quantity: 1, unitPrice: 0.15, supplier: 'LCSC', stock: 50000, status: 'In Stock' },
    { id: '3', partNumber: 'SX1262IMLTRT', manufacturer: 'Semtech', description: 'LoRa Transceiver', quantity: 1, unitPrice: 4.20, supplier: 'Digi-Key', stock: 85, status: 'Low Stock' },
  ]);

  const [issues, setIssues] = useState<ValidationIssue[]>([
    { id: '1', severity: 'warning', message: 'Missing decoupling capacitor on ESP32 VDD', componentId: '1' },
    { id: '2', severity: 'error', message: 'LoRa antenna path impedance mismatch likely', componentId: '3' },
  ]);

  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'system', content: 'Welcome to ProtoPulse AI. I can help you design your system architecture, select parts, and validate your connections.', timestamp: Date.now() }
  ]);

  const [activeView, setActiveView] = useState<'architecture' | 'schematic' | 'procurement' | 'validation'>('architecture');

  const addMessage = (msg: ChatMessage) => {
    setMessages(prev => [...prev, msg]);
  };

  return (
    <ProjectContext.Provider value={{ nodes, edges, setNodes, setEdges, bom, issues, messages, activeView, setActiveView, addMessage }}>
      {children}
    </ProjectContext.Provider>
  );
}

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) throw new Error('useProject must be used within ProjectProvider');
  return context;
};
