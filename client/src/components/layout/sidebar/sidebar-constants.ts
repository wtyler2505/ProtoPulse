import type { LucideIcon } from 'lucide-react';
import {
  LayoutGrid,
  Cpu,
  Activity,
  Package,
  TerminalSquare,
  Zap,
  CircuitBoard,
  Grid3X3,
  Microchip,
  KanbanSquare,
  BookMarked,
  Box,
  Globe,
  ShoppingBag,
  Warehouse,
} from 'lucide-react';
import type { ViewMode } from '@/lib/project-context';

export interface NavItem {
  icon: LucideIcon;
  view: ViewMode;
  label: string;
}

export const navItems: NavItem[] = [
  { icon: LayoutGrid, view: 'architecture', label: 'Architecture' },
  { icon: CircuitBoard, view: 'schematic', label: 'Schematic' },
  { icon: Grid3X3, view: 'breadboard', label: 'Breadboard' },
  { icon: Microchip, view: 'pcb', label: 'PCB' },
  { icon: Cpu, view: 'component_editor', label: 'Component Editor' },
  { icon: Package, view: 'procurement', label: 'Procurement' },
  { icon: Activity, view: 'validation', label: 'Validation' },
  { icon: Zap, view: 'simulation', label: 'Simulation' },
  { icon: KanbanSquare, view: 'kanban', label: 'Tasks' },
  { icon: BookMarked, view: 'knowledge', label: 'Learn' },
  { icon: Box, view: 'viewer_3d', label: '3D View' },
  { icon: Globe, view: 'community', label: 'Community' },
  { icon: ShoppingBag, view: 'ordering', label: 'Order PCB' },
  { icon: Warehouse, view: 'storage', label: 'Inventory' },
  { icon: TerminalSquare, view: 'output', label: 'Output' },
];
