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
  { icon: TerminalSquare, view: 'output', label: 'Output' },
];
