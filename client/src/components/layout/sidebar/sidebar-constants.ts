import type { LucideIcon } from 'lucide-react';
import {
  LayoutGrid,
  Cpu,
  Activity,
  Package,
  TerminalSquare,
  Zap,
} from 'lucide-react';
import type { ViewMode } from '@/lib/project-context';

export interface NavItem {
  icon: LucideIcon;
  view: ViewMode;
  label: string;
}

export const navItems: NavItem[] = [
  { icon: LayoutGrid, view: 'architecture', label: 'Architecture' },
  { icon: Cpu, view: 'component_editor', label: 'Component Editor' },
  { icon: Package, view: 'procurement', label: 'Procurement' },
  { icon: Activity, view: 'validation', label: 'Validation' },
  { icon: Zap, view: 'simulation', label: 'Simulation' },
  { icon: TerminalSquare, view: 'output', label: 'Output' },
];
