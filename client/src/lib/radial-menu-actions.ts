import type { LucideIcon } from 'lucide-react';
import {
  Edit,
  Trash2,
  Link,
  RefreshCw,
  Copy,
  Package,
  RotateCw,
  FlipHorizontal2,
  Settings2,
  Ruler,
  FileText,
  Plus,
  Minus,
  Search,
  ArrowRight,
  CircuitBoard,
  ShieldCheck,
  Move,
  Zap,
  Grid3X3,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Identifies which canvas/view the right-click originated from. */
export type MenuContextType =
  | 'architecture'
  | 'schematic'
  | 'pcb'
  | 'breadboard'
  | 'bom';

/** What kind of target was right-clicked (node, wire, empty canvas, etc.). */
export type TargetKind = 'node' | 'wire' | 'pad' | 'via' | 'trace' | 'canvas' | 'bom_row';

export interface MenuContext {
  /** Which view the menu was triggered from. */
  view: MenuContextType;
  /** What kind of element was clicked. */
  target: TargetKind;
  /** Optional ID of the clicked element. */
  targetId?: string;
  /** Optional label of the clicked element. */
  targetLabel?: string;
}

export interface RadialMenuItem {
  /** Unique action id. */
  id: string;
  /** Display label shown on hover. */
  label: string;
  /** Lucide icon component. */
  icon: LucideIcon;
  /** Whether the item is currently disabled. */
  disabled?: boolean;
  /** If true, show a destructive (red) style. */
  destructive?: boolean;
}

// ---------------------------------------------------------------------------
// Per-context action definitions
// ---------------------------------------------------------------------------

const architectureNodeActions: RadialMenuItem[] = [
  { id: 'edit', label: 'Edit', icon: Edit },
  { id: 'delete', label: 'Delete', icon: Trash2, destructive: true },
  { id: 'connect', label: 'Connect', icon: Link },
  { id: 'change_type', label: 'Change type', icon: RefreshCw },
  { id: 'duplicate', label: 'Duplicate', icon: Copy },
  { id: 'add_to_bom', label: 'Add to BOM', icon: Package },
];

const architectureCanvasActions: RadialMenuItem[] = [
  { id: 'add_node', label: 'Add node', icon: Plus },
  { id: 'select_all', label: 'Select all', icon: Grid3X3 },
  { id: 'paste', label: 'Paste', icon: Copy },
];

const schematicNodeActions: RadialMenuItem[] = [
  { id: 'rotate', label: 'Rotate', icon: RotateCw },
  { id: 'mirror', label: 'Mirror', icon: FlipHorizontal2 },
  { id: 'edit_properties', label: 'Properties', icon: Settings2 },
  { id: 'delete', label: 'Delete', icon: Trash2, destructive: true },
  { id: 'add_wire', label: 'Add wire', icon: ArrowRight },
  { id: 'view_datasheet', label: 'Datasheet', icon: FileText },
];

const schematicCanvasActions: RadialMenuItem[] = [
  { id: 'add_component', label: 'Add part', icon: Plus },
  { id: 'add_wire', label: 'Add wire', icon: ArrowRight },
  { id: 'select_all', label: 'Select all', icon: Grid3X3 },
];

const pcbNodeActions: RadialMenuItem[] = [
  { id: 'rotate', label: 'Rotate', icon: RotateCw },
  { id: 'flip_side', label: 'Flip side', icon: FlipHorizontal2 },
  { id: 'edit_pad', label: 'Edit pad', icon: Settings2 },
  { id: 'route_trace', label: 'Route trace', icon: CircuitBoard },
  { id: 'run_drc', label: 'Run DRC', icon: ShieldCheck },
  { id: 'measure', label: 'Measure', icon: Ruler },
];

const pcbCanvasActions: RadialMenuItem[] = [
  { id: 'add_via', label: 'Add via', icon: Zap },
  { id: 'run_drc', label: 'Run DRC', icon: ShieldCheck },
  { id: 'measure', label: 'Measure', icon: Ruler },
  { id: 'select_all', label: 'Select all', icon: Grid3X3 },
];

const breadboardNodeActions: RadialMenuItem[] = [
  { id: 'rotate', label: 'Rotate', icon: RotateCw },
  { id: 'move', label: 'Move', icon: Move },
  { id: 'edit_properties', label: 'Properties', icon: Settings2 },
  { id: 'delete', label: 'Delete', icon: Trash2, destructive: true },
  { id: 'add_wire', label: 'Add wire', icon: ArrowRight },
  { id: 'view_datasheet', label: 'Datasheet', icon: FileText },
];

const breadboardCanvasActions: RadialMenuItem[] = [
  { id: 'add_component', label: 'Add part', icon: Plus },
  { id: 'add_wire', label: 'Add wire', icon: ArrowRight },
  { id: 'select_all', label: 'Select all', icon: Grid3X3 },
];

const bomRowActions: RadialMenuItem[] = [
  { id: 'edit_quantity', label: 'Edit qty', icon: Edit },
  { id: 'find_alternates', label: 'Alternates', icon: Search },
  { id: 'view_datasheet', label: 'Datasheet', icon: FileText },
  { id: 'remove', label: 'Remove', icon: Minus, destructive: true },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the appropriate radial-menu items for the given context.
 * Maximum 8 items — the radial layout works best with 4-8 segments.
 */
export function getActionsForContext(context: MenuContext): RadialMenuItem[] {
  switch (context.view) {
    case 'architecture':
      return context.target === 'node' ? architectureNodeActions : architectureCanvasActions;
    case 'schematic':
      return context.target === 'node' ? schematicNodeActions : schematicCanvasActions;
    case 'pcb':
      return context.target === 'node' ? pcbNodeActions : pcbCanvasActions;
    case 'breadboard':
      return context.target === 'node' ? breadboardNodeActions : breadboardCanvasActions;
    case 'bom':
      return context.target === 'bom_row' ? bomRowActions : [];
    default:
      return [];
  }
}

/**
 * Returns the full list of context types that have radial-menu support.
 */
export function getSupportedContextTypes(): MenuContextType[] {
  return ['architecture', 'schematic', 'pcb', 'breadboard', 'bom'];
}
