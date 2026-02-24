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

export interface Connection {
  id: string;
  source: string;
  target: string;
  label?: string;
  type: 'power' | 'data' | 'analog' | 'rf';
}

export interface BomItem {
  id: string;
  partNumber: string;
  manufacturer: string;
  description: string;
  quantity: number;
  unitPrice: number;
  supplier: 'Digi-Key' | 'Mouser' | 'LCSC';
  stock: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
}

export interface ValidationIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  componentId?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  attachments?: Array<{ type: string; url?: string; name?: string; data?: unknown }>;
}
